import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ChangeContext, RuleContext } from "@adversarylabs/sdk";
import type { DiscoveredSource, Discovery } from "./types.js";

export const SOURCE_PATTERNS = [
  "*.go",
  "**/*.go",
  "*.ts",
  "**/*.ts",
  "*.tsx",
  "**/*.tsx",
  "*.js",
  "**/*.js",
  "*.jsx",
  "**/*.jsx",
  "*.py",
  "**/*.py",
  "*.rs",
  "**/*.rs",
  "*.java",
  "**/*.java",
  "*.cs",
  "**/*.cs",
  "*.kt",
  "**/*.kt",
  "*.kts",
  "**/*.kts",
] as const;

const MAX_FILES = 28;
const MAX_FILE_CHARACTERS = 10_000;
const MAX_TOTAL_CHARACTERS = 180_000;

const ignoredSegments = new Set([
  ".git",
  ".idea",
  ".next",
  ".venv",
  ".vscode",
  "build",
  "coverage",
  "dist",
  "generated",
  "node_modules",
  "target",
  "vendor",
]);

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

export function isReviewableSource(path: string): boolean {
  const normalized = normalizePath(path);
  const segments = normalized.split("/");
  if (segments.some((segment) => ignoredSegments.has(segment))) return false;
  if (
    normalized.endsWith(".min.js") ||
    normalized.endsWith(".generated.ts") ||
    normalized.endsWith(".g.cs")
  ) {
    return false;
  }
  return SOURCE_PATTERNS.some((pattern) => {
    const suffix = pattern.startsWith("**/*") ? pattern.slice(4) : pattern.slice(1);
    return normalized.endsWith(suffix);
  });
}

function isTestPath(path: string): boolean {
  return /(^|\/)(test|tests|__tests__|spec)(\/|$)/.test(path) ||
    /(?:_test\.go|\.test\.[jt]sx?|\.spec\.[jt]sx?|_test\.py|Tests?\.cs)$/.test(path);
}

function relatedness(path: string, changedFiles: ReadonlySet<string>): number {
  if (changedFiles.has(path)) return 0;
  const directory = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  for (const changed of changedFiles) {
    const changedDirectory = changed.includes("/") ? changed.slice(0, changed.lastIndexOf("/")) : "";
    if (directory === changedDirectory) return isTestPath(path) ? 1 : 2;
    if (directory !== "" && (changedDirectory.startsWith(`${directory}/`) || directory.startsWith(`${changedDirectory}/`))) {
      return isTestPath(path) ? 3 : 4;
    }
  }
  return isTestPath(path) ? 5 : 6;
}

function prioritize(paths: string[], change: ChangeContext | null): string[] {
  const changedPaths = (change?.changedFiles ?? []).map(normalizePath);
  const changed = new Set(changedPaths);
  const changedOrder = new Map(changedPaths.map((path, index) => [path, index]));
  return [...new Set(paths.map(normalizePath).filter(isReviewableSource))].sort((left, right) => {
    const relation = relatedness(left, changed) - relatedness(right, changed);
    if (relation !== 0) return relation;
    const leftIndex = changedOrder.get(left);
    const rightIndex = changedOrder.get(right);
    if (leftIndex !== undefined || rightIndex !== undefined) {
      return (leftIndex ?? Number.MAX_SAFE_INTEGER) - (rightIndex ?? Number.MAX_SAFE_INTEGER);
    }
    return left.localeCompare(right);
  });
}

export async function discoverSources(ctx: RuleContext): Promise<Discovery> {
  const matches = (await Promise.all(SOURCE_PATTERNS.map((pattern) => ctx.rglob(pattern)))).flat();
  const candidates = prioritize(matches, ctx.change);
  const selected = candidates.slice(0, MAX_FILES);
  const sources: DiscoveredSource[] = [];
  let totalCharacters = 0;
  const changed = new Set((ctx.change?.changedFiles ?? []).map(normalizePath));

  for (const path of selected) {
    if (totalCharacters >= MAX_TOTAL_CHARACTERS) break;
    let raw: string;
    try {
      raw = await readFile(join(ctx.repoPath, path), "utf8");
    } catch {
      continue;
    }
    if (raw.includes("\0")) continue;

    const allowance = Math.min(MAX_FILE_CHARACTERS, MAX_TOTAL_CHARACTERS - totalCharacters);
    const content = raw.slice(0, allowance);
    sources.push({
      id: `source:${sources.length + 1}`,
      path,
      status: changed.has(path) ? "changed" : "context",
      content,
      truncated: content.length < raw.length,
      lines: content.split("\n"),
    });
    totalCharacters += content.length;
  }

  return {
    sources,
    candidates: candidates.length,
    omitted: Math.max(0, candidates.length - sources.length),
    totalCharacters,
  };
}
