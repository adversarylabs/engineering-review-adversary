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
