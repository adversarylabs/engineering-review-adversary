import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ModelReviewRequest, ReviewModel } from "@adversarylabs/sdk";
import { createApp } from "../src/index.ts";
import type { EngineeringReviewOutput } from "../src/types.ts";

const cleanReview: EngineeringReviewOutput = {
  schemaVersion: 1,
  overall: {
    verdict: "well-engineered",
    risk: "none",
    ship: true,
    summary: "The prepared source does not expose a material engineering concern.",
    primaryConcern: "",
  },
  observations: [],
  strengths: [],
};

test("discovery prioritizes changed files and bounds prepared model input", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-discovery-"));
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "node_modules", "ignored"), { recursive: true });
  for (let index = 0; index < 35; index += 1) {
    await writeFile(join(root, "src", `file-${String(index).padStart(2, "0")}.ts`), `export const value = ${index};\n`);
  }
  await writeFile(join(root, "src", "changed.ts"), "export const changed = true;\n");
  await writeFile(join(root, "node_modules", "ignored", "index.ts"), "throw new Error();\n");

  let captured: ModelReviewRequest | undefined;
  const model: ReviewModel = {
    async review<T>(request: ModelReviewRequest) {
      captured = request;
      return {
        output: cleanReview as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  };

  await createApp().run({
    input: {
      source: { path: root },
      change: {
        type: "diff",
        base_ref: "base",
        head_ref: "head",
        scan_mode: "changed",
        changed_files: ["src/changed.ts"],
      },
    },
    model,
  });

  assert.ok(captured);
  const input = captured.input as {
    preparation: { included: number; omitted: number; totalCharacters: number };
    sources: Array<{ path: string; status: string }>;
  };
  assert.equal(input.sources[0]?.path, "src/changed.ts");
  assert.equal(input.sources[0]?.status, "changed");
  assert.equal(input.preparation.included, 28);
  assert.ok(input.preparation.omitted > 0);
  assert.ok(input.preparation.totalCharacters <= 180_000);
  assert.equal(input.sources.some((source) => source.path.includes("node_modules")), false);
});

test("discovery includes source files at the repository root", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-root-source-"));
  await writeFile(join(root, "main.py"), "def ready():\n    return True\n");
  let sourcePaths: string[] = [];
  const model: ReviewModel = {
    async review<T>(request: ModelReviewRequest) {
      sourcePaths = (request.input as { sources: Array<{ path: string }> }).sources.map(
        (source) => source.path,
      );
      return { output: cleanReview as T, provider: "fixture", model: "fixture" };
    },
  };

  await createApp().run({
    input: { source: { path: root } },
    model,
  });

  assert.deepEqual(sourcePaths, ["main.py"]);
});
