import {
  formatOpinionAsync,
  type EvidenceInput,
  type RuleContext,
  type Severity,
} from "@adversarylabs/sdk";
import { buildModelReviewRequest } from "./model-review.js";
import type {
  DiscoveredSource,
  Discovery,
  EngineeringReviewOutput,
  ModelEvidence,
  ModelObservation,
  ReviewRisk,
} from "./types.js";

const MAX_OBSERVATIONS = 4;
const MAX_STRENGTHS = 3;

const verdictLabels: Record<EngineeringReviewOutput["overall"]["verdict"], string> = {
  "well-engineered": "Well engineered",
  "ready-with-minor-improvements": "Ready with minor improvements",
  "correct-but-over-engineered": "Correct but over-engineered",
  "significant-maintainability-concerns": "Significant maintainability concerns",
  "incomplete-implementation": "Incomplete implementation",
  "high-operational-risk": "High operational risk",
};

const severityRanks: Record<ReviewRisk, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function maxRisk(values: ReviewRisk[]): ReviewRisk {
  return values.reduce<ReviewRisk>(
    (best, current) => severityRanks[current] > severityRanks[best] ? current : best,
    "none",
  );
}

function sourceMap(discovery: Discovery): Map<string, DiscoveredSource> {
  return new Map(discovery.sources.map((source) => [source.id, source]));
}

function remediationComplexity(
  observation: ModelObservation,
): "small" | "medium" | "large" | "architectural" {
  if (observation.category === "architecture" || observation.severity === "critical") {
    return "architectural";
  }
  if (observation.severity === "high") return "large";
  if (observation.severity === "low") return "small";
  return "medium";
}

function evidenceFor(
  evidence: ModelEvidence,
  sources: ReadonlyMap<string, DiscoveredSource>,
): EvidenceInput | undefined {
  const source = sources.get(evidence.sourceId);
  if (
    source === undefined ||
    !Number.isInteger(evidence.line) ||
    evidence.line < 1 ||
    evidence.line > source.lines.length
  ) {
    return undefined;
  }
  const line = evidence.line;
  const snippet = source.lines.slice(Math.max(0, line - 2), line + 1).join("\n").slice(0, 500);
  return {
    location: { file: source.path, line },
    message: evidence.detail,
    ...(snippet === "" ? {} : { snippet }),
    data: { sourceId: evidence.sourceId, status: source.status },
  };
}

function emitObservation(
  ctx: RuleContext,
  observation: ModelObservation,
  sources: ReadonlyMap<string, DiscoveredSource>,
): boolean {
  const evidence = observation.evidence
    .map((item) => evidenceFor(item, sources))
    .filter((item): item is EvidenceInput => item !== undefined)
    .slice(0, 8);
  if (evidence.length === 0) return false;

  for (const item of evidence) {
    ctx.observe({
      ruleId: `engineering-review.${observation.category}`,
      subject: observation.title,
      groupKey: `engineering-review.${observation.id}`,
      deduplicate: true,
      category: observation.category,
      severity: observation.severity as Severity,
      confidence: observation.confidence,
      title: {
        singular: observation.title,
        plural: observation.title,
      },
      summary: {
        singular: observation.summary,
        grouped: observation.summary,
      },
      whyItMatters: `${observation.principle} ${observation.impact}`.trim(),
      impact: observation.impact,
      location: item,
      recommendation: {
        summary: observation.recommendation,
        ...(observation.tradeoffs === "" ? {} : { details: observation.tradeoffs }),
      },
      remediation: {
        complexity: remediationComplexity(observation),
      },
      tags: ["engineering-review", "model-backed"],
      metadata: {
        source: "model",
        observationId: observation.id,
        principle: observation.principle,
        tradeoffs: observation.tradeoffs,
      },
    });
  }
  return true;
}

export async function reviewEngineeringChange(
  ctx: RuleContext,
  discovery: Discovery,
): Promise<void> {
  const request = buildModelReviewRequest(ctx.change, discovery);
  const { output } = await ctx.model.review<EngineeringReviewOutput>(request);
  const sources = sourceMap(discovery);
  const accepted = output.observations
    .slice(0, MAX_OBSERVATIONS)
    .filter((observation) => emitObservation(ctx, observation, sources));
  const risk = maxRisk([
    output.overall.risk,
    ...accepted.map((observation) => observation.severity),
  ]);
  const blocking = accepted.some(
    (observation) => severityRanks[observation.severity] >= severityRanks.medium,
  );
  const ship = output.overall.ship && !blocking;

  ctx.review.assessment({
    risk,
    summary: `${verdictLabels[output.overall.verdict]} — ${output.overall.summary}`,
  });

  for (const strength of output.strengths.slice(0, MAX_STRENGTHS)) {
    const evidence = strength.evidence
      .map((item) => evidenceFor(item, sources))
      .filter((item): item is EvidenceInput => item !== undefined)
      .slice(0, 6);
    ctx.review.positive({
      key: `engineering-review.strength.${strength.summary}`,
      summary: strength.summary,
      ...(evidence.length === 0 ? {} : { evidence }),
      metadata: { source: "model" },
    });
  }

  const topObservation = accepted
    .slice()
    .sort(
      (left, right) =>
        severityRanks[right.severity] - severityRanks[left.severity] ||
        left.id.localeCompare(right.id),
    )[0];
  const concern = output.overall.primaryConcern.trim() || topObservation?.title;
  ctx.review.opinion(
    await formatOpinionAsync({
      ship,
      ...(ship || concern === undefined ? {} : { concern }),
      change: ctx.change,
      model: ctx.model,
    }),
  );
}
