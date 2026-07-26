import type { ChangeContext, ModelReviewRequest } from "@adversarylabs/sdk";
import modelSchema from "../schemas/engineering-review.model.v1.schema.json" with { type: "json" };
import { SOURCE_PATTERNS } from "./discover.js";
import { ENGINEERING_REVIEW_PROMPT } from "./prompt.js";

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
}

export function prepareModelInput(
  change: ChangeContext | null,
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
  };
}

export function buildModelReviewRequest(
  change: ChangeContext | null,
): ModelReviewRequest {
  return {
    prompt: ENGINEERING_REVIEW_PROMPT,
    input: prepareModelInput(change),
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
