import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ModelReviewRequest } from "@adversarylabs/sdk";
import { createApp } from "../src/index.ts";
import type { EngineeringReviewOutput } from "../src/types.ts";
import { repositoryReviewModel } from "./repository-model.ts";

const cleanReview: EngineeringReviewOutput = {
  schemaVersion: 1,
  overall: {
    verdict: "well-engineered",
    risk: "none",
    ship: true,
    summary: "The retrieved source does not expose a material engineering concern.",
    primaryConcern: "",
  },
  observations: [],
  strengths: [],
};

test("repository tools retrieve selected evidence instead of eager source bodies", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-retrieval-"));
  try {
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "node_modules", "ignored"), { recursive: true });
    for (let index = 0; index < 35; index += 1) {
      await writeFile(
        join(root, "src", `file-${String(index).padStart(2, "0")}.ts`),
        `export const eagerValue = ${index};\n`,
      );
    }
    await writeFile(join(root, "src", "changed.ts"), "export const selected = true;\n");
    await writeFile(
      join(root, "node_modules", "ignored", "index.ts"),
      "throw new Error('not reviewable');\n",
    );

    let finalInput: unknown;
    const model = repositoryReviewModel(
      ["src/changed.ts"],
      async <T>(request: ModelReviewRequest) => {
        finalInput = request.input;
        return {
          output: cleanReview as T,
          provider: "fixture",
          model: "fixture",
        };
      },
    );
    const result = await createApp().run({
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

    const encoded = JSON.stringify(finalInput);
    assert.match(encoded, /export const selected = true/);
    assert.doesNotMatch(encoded, /eagerValue/);
    assert.doesNotMatch(encoded, /not reviewable/);
    assert.equal(result.target.filesScanned, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository tools read reviewable source files at the repository root", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-root-source-"));
  try {
    await writeFile(join(root, "main.py"), "def ready():\n    return True\n");
    let finalInput: unknown;
    const model = repositoryReviewModel(
      ["main.py"],
      async <T>(request: ModelReviewRequest) => {
        finalInput = request.input;
        return {
          output: cleanReview as T,
          provider: "fixture",
          model: "fixture",
        };
      },
    );

    await createApp().run({
      input: { source: { path: root } },
      model,
    });

    assert.match(JSON.stringify(finalInput), /def ready/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
