import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { ModelReviewRequest, ReviewModel, ReviewResult } from "@adversarylabs/sdk";
import { createApp } from "../src/index.ts";
import type { EngineeringReviewOutput } from "../src/types.ts";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fixturesRoot = join(projectRoot, "fixtures");
const fixtureNames = [
  "excellent",
  "maintainable",
  "over-engineered",
  "incomplete",
  "risky",
] as const;

function snapshot(result: ReviewResult): unknown {
  return {
    assessment: result.assessment,
    positives: result.positives,
    observations: result.observations,
    findings: result.findings,
    opinion: result.opinion,
    suppressed: result.suppressed,
  };
}

for (const fixtureName of fixtureNames) {
  test(`${fixtureName} implementation matches its expected review`, async () => {
    const root = join(fixturesRoot, fixtureName);
    const fixture = JSON.parse(await readFile(join(root, "fixture.json"), "utf8")) as {
      changedFiles: string[];
    };
    const modelOutput = JSON.parse(
      await readFile(join(root, "expected.model.json"), "utf8"),
    ) as EngineeringReviewOutput;
    let calls = 0;
    const model: ReviewModel = {
      async review<T>(request: ModelReviewRequest) {
        calls += 1;
        assert.match(request.prompt, /experienced software engineer approve/);
        assert.equal((request.input as { sources: unknown[] }).sources.length > 0, true);
        return {
          output: modelOutput as T,
          provider: "fixture",
          model: fixtureName,
        };
      },
    };

    const result = await createApp().run({
      input: {
        source: { path: root },
        change: {
          type: "diff",
          base_ref: "base",
          head_ref: "head",
          scan_mode: "changed",
          changed_files: fixture.changedFiles,
        },
      },
      model,
    });
    assert.equal(calls, 1, "fixture concerns must already be valid noun phrases");

    const actual = snapshot(result);
    const expectedPath = join(root, "expected.review.json");
    if (process.env.UPDATE_SNAPSHOTS === "1") {
      await writeFile(expectedPath, `${JSON.stringify(actual, null, 2)}\n`);
    } else {
      const expected = JSON.parse(await readFile(expectedPath, "utf8"));
      assert.deepEqual(actual, expected);
    }
  });
}

test("fixture catalog contains exactly the five calibration scenarios", async () => {
  const entries = (await readdir(fixturesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(entries, [...fixtureNames].sort());
});
