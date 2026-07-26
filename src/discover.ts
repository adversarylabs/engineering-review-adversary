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
  return SOURCE_PATTERNS.some((pattern) => {
    const suffix = pattern.startsWith("**/*") ? pattern.slice(4) : pattern.slice(1);
    return normalized.endsWith(suffix);
  });
}
