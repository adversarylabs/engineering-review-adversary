import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";
import type { ModelReviewRequest, ReviewModel } from "@adversarylabs/sdk";
import type { EngineeringReviewOutput } from "../src/types.ts";
import { repositoryReviewModel } from "./repository-model.ts";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

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
  await mkdir(dirname(entrypoint), { recursive: true });
  await copyFile(join(projectRoot, "dist", "index.js"), entrypoint);
  await copyFile(join(projectRoot, "THIRD_PARTY_NOTICES.md"), noticesPath);
  await writeFile(join(artifact, "package.json"), '{"type":"module"}\n');
  await writeFile(join(repository, "main.go"), "package sample\n\nfunc ready() bool { return true }\n");

  const bundle = await readFile(entrypoint, "utf8");
  assert.doesNotMatch(bundle, /from\s+["']@adversarylabs\/sdk["']/);
  assert.doesNotMatch(bundle, /\/Users\/marc|\/private\/tmp\/engineering-review/);
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
  assert.equal(result.adversary.version, "0.0.26");
  assert.deepEqual(result.findings, []);
});
