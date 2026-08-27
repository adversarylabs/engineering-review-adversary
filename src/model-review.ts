import type { ChangeContext, ModelReviewRequest } from "@adversarylabs/sdk";
import modelSchema from "../schemas/engineering-review.model.v1.schema.json" with { type: "json" };
import { SOURCE_PATTERNS } from "./discover.js";
import { ENGINEERING_REVIEW_PROMPT } from "./prompt.js";
import type { OperationalTargetHint } from "./operational-targets.js";

export interface PreparedModelInput {
  reviewScope: {
    scanMode: "changed" | "all";
    baseRef?: string;
    headRef?: string;
    worktree: boolean;
    changedFiles: readonly string[];
  };
  platformContract: {
    modelReviewOutput: string;
    repositoryRetrieval: string;
    observationSynthesis: string;
  };
  investigationGuide: {
    declaredOperationalTargets: string;
    failClosedBoundary: string;
    preparedCandidates: readonly OperationalTargetHint[];
  };
}

export function prepareModelInput(
  change: ChangeContext | null,
  operationalTargetHints: readonly OperationalTargetHint[] = [],
): PreparedModelInput {
  return {
    reviewScope: {
      scanMode: change?.scanMode ?? "all",
      ...(change?.baseRef === undefined ? {} : { baseRef: change.baseRef }),
      ...(change?.headRef === undefined ? {} : { headRef: change.headRef }),
      worktree: change?.worktree ?? false,
      changedFiles: [...(change?.changedFiles ?? [])].slice(0, 100),
    },
    platformContract: {
      modelReviewOutput:
        "When a schema is supplied to ctx.model.review, the model broker validates the returned JSON against that schema before resolving.",
      repositoryRetrieval:
        "The SDK exposes bounded, read-only list_directory and read_file operations. Each read_file result creates an immutable citationId with an inclusive line range.",
      observationSynthesis:
        "Repeated ctx.observe calls with the same groupKey and deduplicate=true are intentionally synthesized by the SDK into one finding with multiple evidence locations.",
    },
    investigationGuide: {
      declaredOperationalTargets:
        "For a changed Helm deployment template with literal HTTP health, liveness, or readiness paths, read the container command/image, prove the repository-built entrypoint through Dockerfile or build evidence, and inspect the complete applicable listener/route-registration surface before judging the change.",
      failClosedBoundary:
        "If ownership or the complete applicable route surface cannot be prepared, stay quiet; never replace missing cross-artifact proof with a generic Helm rendering, schema-validation, or test request.",
      preparedCandidates: operationalTargetHints,
    },
  };
}

export function buildModelReviewRequest(
  change: ChangeContext | null,
  operationalTargetHints: readonly OperationalTargetHint[] = [],
): ModelReviewRequest {
  return {
    prompt: operationalTargetHints.length === 0
      ? ENGINEERING_REVIEW_PROMPT
      : operationalTargetReviewPrompt(operationalTargetHints),
    input: prepareModelInput(change, operationalTargetHints),
    schema: modelSchema as Record<string, unknown>,
    budget: {
      maximumOutputTokens: 12_000,
      timeoutMs: 300_000,
    },
    tools: {
      repository: {
        include: SOURCE_PATTERNS,
        exclude: [
          "fixtures/**",
          "**/fixtures/**",
          "testdata/**",
          "**/testdata/**",
          "**/*.generated.*",
          "**/*.min.js",
        ],
        maxRounds: 6,
        maxToolCalls: 24,
        maxTotalBytes: 192_000,
        maxBytesPerRead: 24_000,
        maxLinesPerRead: 320,
        directoryPageSize: 200,
        planningTimeoutMs: 120_000,
      },
    },
  };
}

function operationalTargetReviewPrompt(
  hints: readonly OperationalTargetHint[],
): string {
  const candidates = hints.map((hint, index) => [
    `${index + 1}. changed deployment template: ${hint.changedTemplate}`,
    `   container command: ${hint.containerCommand}`,
    `   declared literal HTTP paths: ${hint.literalHttpPaths.join(", ")}`,
    `   paths not directly registered in the entrypoint: ${hint.missingLiteralHttpPaths.join(", ") || "none"}`,
    `   build ownership evidence: ${hint.buildFile}`,
    `   repository-built entrypoint: ${hint.entrypoint}`,
  ].join("\n")).join("\n");
  return `You are Engineering Review, an opinionated Staff/Principal engineer performing a focused cross-artifact completeness review.

Mission — Declared operational targets:
Determine whether a changed deployment template declares literal HTTP operational endpoints that the repository-built deployed binary does not register on the applicable listener. This is a contract-integrity review, not a Helm lint or generic request for validation.

MANDATORY PREPARED OPERATIONAL-TARGET AUDIT:
The deterministic preparation pass proved these bounded candidate paths:
${candidates}

Required traversal:
1. You must use read_file on every changed template, build file, and entrypoint listed above before producing the overall judgment.
2. In the template, confirm the literal HTTP probe paths belong to the container running the listed command and identify the probe port.
3. In the build file, confirm that the command names the repository-built entrypoint.
4. In the entrypoint, identify the server/listener for that probe port and inspect its complete applicable route-registration surface, following a bounded direct registration helper when necessary.
5. Compare every declared literal path with direct registrations and any proven broader matching route pattern.

Finding contract:
- If a newly declared exact path has no reachable matching registration on the proven listener, return exactly one incomplete-implementation observation for the cross-artifact mismatch.
- Cite the exact template lines containing the literal paths, the exact build or ENTRYPOINT line proving binary ownership, and the exact entrypoint lines containing the existing applicable route registrations. Do not cite file headers or line 1 unless the relevant construct is actually on line 1.
- State that the exact routes are absent from the proven surface; do not weaken the claim to merely "unproven".
- Explain the concrete effect: the platform's liveness or readiness requests receive a non-success response, so the workload can restart or remain unready.
- Recommend registering the exact paths on the applicable listener or changing the declarations to endpoints that listener actually serves.

Fail-closed boundaries:
- Return no observation when every path has a reachable direct route, helper registration, or broader route pattern on the applicable listener; the image or binary is external; ownership is unresolved; the path is templated or dynamic; the probe is not HTTP; another container or listener owns it; or the complete applicable registration surface cannot be read.
- A matching string in documentation, comments, tests, or an unrelated listener is not handler proof.
- Never invent runtime behavior, requirements, files, citations, or lines.
- Never substitute a generic Helm rendering, schema-validation, test-coverage, Dockerfile, HTTP-style, security, observability, or infrastructure concern.
- Do not report pre-existing problems that the change neither introduces nor materially relies on.

Output discipline:
- Return zero or one observation and no more than two evidence-backed strengths.
- Use only citationIds created by read_file, and choose the exact relevant line inside each citation.
- Use medium or high confidence only. Silence is required when the proof is incomplete.
- Set ship=false for the missing-route observation; otherwise set ship=true with an empty primaryConcern.`;
}
