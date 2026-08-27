import type { RuleContext } from "@adversarylabs/sdk";

export const TRIGGER_PATTERNS = [
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
  "*.sh",
  "**/*.sh",
  "*.bash",
  "**/*.bash",
  "*.mk",
  "**/*.mk",
  "Makefile",
  "**/Makefile",
  "GNUmakefile",
  "**/GNUmakefile",
  "*.md",
  "**/*.md",
  "charts/**/templates/*.yml",
  "charts/**/templates/*.yaml",
  "charts/**/templates/**/*.yml",
  "charts/**/templates/**/*.yaml",
  "**/charts/**/templates/*.yml",
  "**/charts/**/templates/*.yaml",
  "**/charts/**/templates/**/*.yml",
  "**/charts/**/templates/**/*.yaml",
  "**/integration/**/00-setup",
  "**/integration/**/01-start-server",
  "**/integration/**/02-bootstrap-agent",
  "**/integration/**/03-start-agent",
  "**/integration/**/04-submit-job",
  "**/integration/**/05-create-entry",
  "**/integration/**/06-verify-fetch",
  "**/integration/**/teardown",
] as const;

export const SOURCE_PATTERNS = [
  ...TRIGGER_PATTERNS,
  "Dockerfile",
  "**/Dockerfile",
  "Dockerfile.*",
  "**/Dockerfile.*",
  "Vagrantfile",
  "**/Vagrantfile",
  ".github/workflows/*.yml",
  ".github/workflows/*.yaml",
  ".github/workflows/**/*.yml",
  ".github/workflows/**/*.yaml",
] as const;

const ignoredSegments = new Set([
  ".git",
  ".idea",
  ".next",
  ".venv",
  ".vscode",
  "build",
  "coverage",
  "dist",
  "fixture",
  "fixtures",
  "generated",
  "node_modules",
  "target",
  "testdata",
  "vendor",
  "__fixtures__",
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
  const name = segments.at(-1) ?? "";
  if (["Makefile", "GNUmakefile", "Vagrantfile"].includes(name) || /^Dockerfile(?:\..+)?$/.test(name)) {
    return true;
  }
  if (/\.github\/workflows\/.*\.ya?ml$/i.test(normalized)) return true;
  if (/(?:^|\/)charts\/.*\/templates\/.*\.ya?ml$/i.test(normalized)) return true;
  if (
    segments.includes("integration") &&
    /^(?:00-setup|01-start-server|02-bootstrap-agent|03-start-agent|04-submit-job|05-create-entry|06-verify-fetch|teardown)$/.test(name)
  ) {
    return true;
  }
  return /\.(?:go|ts|tsx|js|jsx|py|rs|java|cs|kt|kts|sh|bash|mk|md)$/i.test(normalized);
}

export async function countReviewableSources(ctx: RuleContext): Promise<number> {
  if (ctx.change?.scanMode === "changed") {
    return new Set(
      ctx.change.changedFiles
        .map(normalizePath)
        .filter(isReviewableSource),
    ).size;
  }

  const matches = (
    await Promise.all(SOURCE_PATTERNS.map((pattern) => ctx.rglob(pattern)))
  ).flat();
  return new Set(
    matches
      .map(normalizePath)
      .filter(isReviewableSource),
  ).size;
}
