import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import type { ModelReviewRequest, ReviewModel } from "@adversarylabs/sdk";
import type { EngineeringReviewOutput } from "../src/types.ts";
import { repositoryReviewModel } from "./repository-model.ts";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const execute = promisify(execFile);

test("package intent excludes authoring inputs but retains runtime assets", async () => {
  const ignored = new Set(
    (await readFile(join(projectRoot, ".adversaryignore"), "utf8"))
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

  for (const authoringInput of [
    "src/",
    "test/",
    "fixtures/",
    "scripts/",
    "node_modules/",
    ".depot/",
    ".git",
    "tsconfig.json",
    "AGENTS.md",
    "CHECKS.md",
  ]) {
    assert.equal(ignored.has(authoringInput), true, `${authoringInput} should not ship`);
  }
  for (const runtimeAsset of [
    "dist/",
    "schemas/",
    "adversary.yaml",
    "package.json",
    "README.md",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
  ]) {
    assert.equal(ignored.has(runtimeAsset), false, `${runtimeAsset} must remain packageable`);
  }
});

test("the published runtime executes without node_modules", async () => {
  const artifact = await mkdtemp(join(tmpdir(), "engineering-review-artifact-"));
  const repository = await mkdtemp(join(tmpdir(), "engineering-review-target-"));
  const entrypoint = join(artifact, "dist", "index.js");
  const noticesPath = join(artifact, "THIRD_PARTY_NOTICES.md");
  const archive = join(artifact, "package.tar");
  const runtimeFiles = [
    "adversary.yaml",
    "dist/index.js",
    "schemas/adversary.review.v1.schema.json",
    "THIRD_PARTY_NOTICES.md",
    "package.json",
  ];
  for (const path of runtimeFiles) {
    await execute("git", ["ls-files", "--error-unmatch", path], { cwd: projectRoot });
  }
  await execute("git", ["archive", "--format=tar", `--output=${archive}`, "HEAD", ...runtimeFiles], {
    cwd: projectRoot,
  });
  const { stdout: archiveListing } = await execute("tar", ["-tf", archive]);
  const archivePaths = archiveListing.split(/\r?\n/).filter(Boolean);
  assert.ok(archivePaths.length >= runtimeFiles.length);
  for (const path of archivePaths) {
    assert.equal(path.split("/").includes("node_modules"), false, `${path} must not ship`);
    assert.equal(path.split("/").includes(".git"), false, `${path} must not ship`);
  }
  await execute("tar", ["-xf", archive, "-C", artifact]);
  await writeFile(join(repository, "main.go"), "package sample\n\nfunc ready() bool { return true }\n");

  const bundle = await readFile(entrypoint, "utf8");
  assert.doesNotMatch(bundle, /from\s+["']@adversarylabs\/sdk["']/);
  for (const path of runtimeFiles) {
    const content = await readFile(join(artifact, path), "utf8");
    assert.doesNotMatch(content, /\/Users\/[^/\s]+|\/private\/tmp\/|[A-Za-z]:\\Users\\/);
  }
  const notices = await readFile(noticesPath, "utf8");
  assert.deepEqual([...notices.matchAll(/^## (.+?) \(/gm)].map((match) => match[1]), [
    "@adversarylabs/sdk",
    "ajv",
    "fast-deep-equal",
    "fast-uri",
    "json-schema-traverse",
    "yaml",
  ]);
  for (const section of notices.split(/^## /m).slice(1)) {
    assert.ok(section.length > 300, `expected a full license text, got ${section.length} bytes`);
    assert.match(section, /copyright|permission|redistribution|license/i);
  }

  const runtime = await import(pathToFileURL(entrypoint).href) as {
    createApp(): {
      run(options: { input: unknown; model: ReviewModel }): Promise<{
        adversary: { name: string; version?: string };
        findings: unknown[];
      }>;
    };
  };
  const output: EngineeringReviewOutput = {
    schemaVersion: 1,
    overall: {
      verdict: "well-engineered",
      risk: "none",
      ship: true,
      summary: "The small implementation is coherent.",
      primaryConcern: "",
    },
    observations: [],
    strengths: [],
  };
  const model: ReviewModel = repositoryReviewModel(
    ["main.go"],
    async <T>(_request: ModelReviewRequest) => {
      return { output: output as T, provider: "fixture", model: "fixture" };
    },
  );
  const result = await runtime.createApp().run({
    input: { source: { path: repository } },
    model,
  });

  assert.equal(result.adversary.name, "engineering-review");
  assert.equal(result.adversary.version, "0.0.31");
  assert.deepEqual(result.findings, []);
});
