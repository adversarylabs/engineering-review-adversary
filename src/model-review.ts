import type { ChangeContext, ModelReviewRequest } from "@adversarylabs/sdk";
import modelSchema from "../schemas/engineering-review.model.v1.schema.json" with { type: "json" };
import { ENGINEERING_REVIEW_PROMPT } from "./prompt.js";
import type { Discovery } from "./types.js";

export interface PreparedModelInput {
  reviewScope: {
    scanMode: "changed" | "all";
    baseRef?: string;
    headRef?: string;
    worktree: boolean;
    changedFiles: readonly string[];
  };
  preparation: {
    candidates: number;
    included: number;
    omitted: number;
    totalCharacters: number;
  };
  platformContract: {
    modelReviewOutput: string;
    evidenceSnippets: string;
    observationSynthesis: string;
  };
  sources: Array<{
    id: string;
    path: string;
    status: "changed" | "context";
    content: string;
    truncated: boolean;
  }>;
}

export function prepareModelInput(
  change: ChangeContext | null,
  discovery: Discovery,
): PreparedModelInput {
  return {
    reviewScope: {
      scanMode: change?.scanMode ?? "all",
      ...(change?.baseRef === undefined ? {} : { baseRef: change.baseRef }),
      ...(change?.headRef === undefined ? {} : { headRef: change.headRef }),
      worktree: change?.worktree ?? false,
      changedFiles: [...(change?.changedFiles ?? [])].slice(0, 100),
    },
    preparation: {
      candidates: discovery.candidates,
      included: discovery.sources.length,
      omitted: discovery.omitted,
      totalCharacters: discovery.totalCharacters,
    },
    platformContract: {
      modelReviewOutput:
        "When a schema is supplied to ctx.model.review, the model broker validates the returned JSON against that schema before resolving.",
      evidenceSnippets:
        "Finding snippets are intentionally bounded previews, not complete source excerpts; the exact quote check establishes evidence integrity.",
      observationSynthesis:
        "Repeated ctx.observe calls with the same groupKey and deduplicate=true are intentionally synthesized by the SDK into one finding with multiple evidence locations.",
    },
    sources: discovery.sources.map(({ id, path, status, content, truncated }) => ({
      id,
      path,
      status,
      content,
      truncated,
    })),
  };
}

export function buildModelReviewRequest(
  change: ChangeContext | null,
  discovery: Discovery,
): ModelReviewRequest {
  return {
    prompt: ENGINEERING_REVIEW_PROMPT,
    input: prepareModelInput(change, discovery),
    schema: modelSchema as Record<string, unknown>,
    budget: {
      maximumOutputTokens: 6_000,
      timeoutMs: 120_000,
    },
  };
}
