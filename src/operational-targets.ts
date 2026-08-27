import { readFile } from "node:fs/promises";
import { join, posix } from "node:path";
import type { RuleContext } from "@adversarylabs/sdk";

const MAX_SOURCE_BYTES = 256_000;
const MAX_HINTS = 8;

export interface OperationalTargetHint {
  changedTemplate: string;
  containerCommand: string;
  literalHttpPaths: string[];
  missingLiteralHttpPaths: string[];
  templateEvidenceLines: number[];
  buildFile: string;
  buildEvidenceLines: number[];
  entrypoint: string;
  routeRegistrationLines: number[];
}

interface DeclaredTarget {
  command: string;
  paths: string[];
  pathLines: number[];
}

interface BuiltEntrypoint {
  path: string;
  evidenceLines: number[];
}

export async function prepareOperationalTargetHints(
  ctx: Pick<RuleContext, "repoPath" | "change" | "rglob">,
): Promise<OperationalTargetHint[]> {
  const changedTemplates = (ctx.change?.changedFiles ?? [])
    .map(normalizePath)
    .filter(isHelmTemplate)
    .slice(0, MAX_HINTS);
  if (changedTemplates.length === 0) return [];

  const dockerfiles = [...new Set((await Promise.all([
    ctx.rglob("Dockerfile"),
    ctx.rglob("**/Dockerfile"),
  ])).flat().map(normalizePath))].sort();
  const builds = await Promise.all(dockerfiles.map(async (path) => ({
    path,
    source: await readBoundedText(ctx.repoPath, path),
  })));
  const hints: OperationalTargetHint[] = [];

  for (const changedTemplate of changedTemplates) {
    const template = await readBoundedText(ctx.repoPath, changedTemplate);
    if (template === undefined) continue;
    for (const target of declaredTargets(template)) {
      const binary = posix.basename(target.command);
      for (const build of builds) {
        if (build.source === undefined) continue;
        const entrypoint = builtEntrypoint(build.path, build.source, binary);
        if (entrypoint === undefined) continue;
        const entrypointSource = await readBoundedText(ctx.repoPath, entrypoint.path);
        if (entrypointSource === undefined) continue;
        const routeRegistrationLines = matchingLineNumbers(
          entrypointSource,
          /\.\s*(?:Handle|HandleFunc)\s*\(/,
        );
        const missingLiteralHttpPaths = target.paths.filter((path) =>
          !directRouteIsRegistered(entrypointSource, path)
        );
        hints.push({
          changedTemplate,
          containerCommand: target.command,
          literalHttpPaths: target.paths,
          missingLiteralHttpPaths,
          templateEvidenceLines: target.pathLines,
          buildFile: build.path,
          buildEvidenceLines: entrypoint.evidenceLines,
          entrypoint: entrypoint.path,
          routeRegistrationLines,
        });
        if (hints.length >= MAX_HINTS) return hints;
        break;
      }
    }
  }
  return hints;
}

function declaredTargets(source: string): DeclaredTarget[] {
  const starts = [...source.matchAll(/^(\s*)-\s+command:\s*$/gm)];
  const targets: DeclaredTarget[] = [];
  for (const [index, start] of starts.entries()) {
    const indentation = start[1] ?? "";
    const bodyStart = (start.index ?? 0) + start[0].length;
    const nextStart = starts.slice(index + 1).find((candidate) => candidate[1] === indentation);
    const body = source.slice(bodyStart, nextStart?.index ?? source.length);
    const commandMatch = body.match(/^\s*-\s+(\/[A-Za-z0-9._-]+)\s*$/m);
    const command = commandMatch?.[1];
    if (commandMatch === null || command === undefined) continue;
    const pathMatches = [...body.matchAll(
      /(?:livenessProbe|readinessProbe|startupProbe):[\s\S]{0,500}?httpGet:[\s\S]{0,240}?path:\s*(\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+)\s*$/gm,
    )];
    const paths = pathMatches.map((match) => match[1] as string);
    if (paths.length === 0) continue;
    const pathLines = pathMatches.map((match) =>
      lineNumberAt(source, bodyStart + (match.index ?? 0) + match[0].lastIndexOf(match[1] as string))
    );
    const commandLine = lineNumberAt(
      source,
      bodyStart + (commandMatch.index ?? 0) + commandMatch[0].lastIndexOf(command),
    );
    targets.push({
      command,
      paths: [...new Set(paths)].sort(),
      pathLines: [...new Set([commandLine, ...pathLines])].sort((left, right) => left - right),
    });
  }
  return targets;
}

function builtEntrypoint(
  dockerfile: string,
  source: string,
  binary: string,
): BuiltEntrypoint | undefined {
  const escaped = escapeRegExp(binary);
  const entrypointPattern = new RegExp(`ENTRYPOINT\\s*\\[\\s*["']\\/${escaped}["']\\s*\\]`);
  if (!entrypointPattern.test(source)) {
    return undefined;
  }
  const buildSourceLine = source.split(/\r?\n/).find((line) =>
    /\bgo\s+build\b/.test(line) &&
    new RegExp(`(?:^|\\s)-o(?:=|\\s+)(?:\\S*\\/)?${escaped}(?:\\s|$)`).test(line)
  );
  if (buildSourceLine === undefined) return undefined;
  const candidates = [...buildSourceLine.matchAll(/(?:^|\s)([A-Za-z0-9_./-]+\.go)(?=\s|$)/g)];
  const sourcePath = candidates.at(-1)?.[1];
  if (sourcePath === undefined || sourcePath.startsWith("/")) return undefined;
  const buildLineNumber = source.split(/\r?\n/).findIndex((line) =>
    /\bgo\s+build\b/.test(line) &&
    new RegExp(`(?:^|\\s)-o(?:=|\\s+)(?:\\S*\\/)?${escaped}(?:\\s|$)`).test(line)
  ) + 1;
  const entrypointLine = matchingLineNumbers(source, entrypointPattern)[0];
  return {
    path: normalizePath(posix.join(posix.dirname(normalizePath(dockerfile)), sourcePath)),
    evidenceLines: [buildLineNumber, entrypointLine]
      .filter((line): line is number => line !== undefined && line > 0),
  };
}

function directRouteIsRegistered(source: string, path: string): boolean {
  const escaped = escapeRegExp(path);
  return new RegExp(`\\.\\s*(?:Handle|HandleFunc)\\s*\\(\\s*["']${escaped}["']`).test(source);
}

function matchingLineNumbers(source: string, pattern: RegExp): number[] {
  return source.split(/\r?\n/)
    .map((line, index) => pattern.test(line) ? index + 1 : 0)
    .filter((line) => line > 0);
}

function lineNumberAt(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

async function readBoundedText(repoPath: string, path: string): Promise<string | undefined> {
  try {
    const bytes = await readFile(join(repoPath, path));
    if (bytes.byteLength > MAX_SOURCE_BYTES || bytes.includes(0)) return undefined;
    return bytes.toString("utf8");
  } catch {
    return undefined;
  }
}

function isHelmTemplate(path: string): boolean {
  return /(?:^|\/)charts\/.*\/templates\/.*\.ya?ml$/i.test(path);
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
