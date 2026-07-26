import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ModelReviewError,
  type ModelReviewRequest,
  type ReviewModel,
} from "@adversarylabs/sdk";
import { createApp } from "../src/index.ts";

test("placeholder observation prose receives one bounded repair attempt and then fails closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-placeholder-"));
  await writeFile(join(root, "main.go"), "package main\n");
  let calls = 0;
  const model: ReviewModel = {
    async review<T>(request: ModelReviewRequest) {
      calls += 1;
      if (calls === 2) assert.match(request.prompt, /REPAIR REQUIREMENT/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "incomplete-implementation",
            risk: "medium",
            ship: false,
            summary: "The implementation appears incomplete at a public engineering boundary.",
            primaryConcern: "the incomplete boundary",
          },
          observations: [{
            id: "placeholder-observation",
            title: "Incomplete public boundary",
            category: "completeness",
            severity: "medium",
            confidence: "high",
            principle: "Public behavior should match the implementation's stated intent.",
            summary: "summary",
            impact: "Callers could observe behavior that the implementation cannot complete.",
            recommendation: "Implement the missing behavior through the existing public boundary.",
            tradeoffs: "The additional path should remain localized to the current boundary.",
            evidence: [{
              sourceId: "source:1",
              line: 1,
              detail: "The package is the prepared source.",
              quote: "package main",
            }],
          }],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  };

  await assert.rejects(
    createApp().run({ input: { source: { path: root } }, model }),
    (error: unknown) =>
      error instanceof ModelReviewError && error.code === "invalid_model_judgment",
  );
  assert.equal(calls, 2);
});

test("a placeholder overall summary is synthesized from the accepted review state", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-overall-"));
  await writeFile(join(root, "main.go"), "package main\n");
  let calls = 0;
  const model: ReviewModel = {
    async review<T>() {
      calls += 1;
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "well-engineered",
            risk: "none",
            ship: true,
            summary: "summary",
            primaryConcern: "",
          },
          observations: [],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  };

  const result = await createApp().run({
    input: { source: { path: root } },
    model,
  });

  assert.equal(calls, 1);
  assert.equal(result.assessment?.risk, "none");
  assert.match(result.assessment?.summary ?? "", /no material evidence-backed engineering concern/i);
  assert.equal(result.opinion?.ship, true);
});

test("fabricated evidence quotes are rejected instead of presented", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-evidence-"));
  await writeFile(join(root, "main.go"), "package main\n\nfunc ready() bool { return true }\n");
  const model: ReviewModel = {
    async review<T>() {
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "incomplete-implementation",
            risk: "medium",
            ship: false,
            summary: "The implementation appears incomplete at an externally visible boundary.",
            primaryConcern: "the incomplete boundary",
          },
          observations: [{
            id: "invented-boundary",
            title: "Incomplete public boundary",
            category: "completeness",
            severity: "medium",
            confidence: "high",
            principle: "Public behavior should match the implementation's stated intent.",
            summary: "The implementation allegedly omits a required public transition.",
            impact: "Callers could observe behavior that the implementation cannot complete.",
            recommendation: "Implement the missing transition and validate it through the public boundary.",
            tradeoffs: "The additional path should remain localized to the existing boundary.",
            evidence: [{
              sourceId: "source:1",
              line: 3,
              detail: "This quote is not actually present.",
              quote: "func missing()",
            }],
          }],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  };

  await assert.rejects(
    createApp().run({ input: { source: { path: root } }, model }),
    (error: unknown) =>
      error instanceof ModelReviewError && error.code === "invalid_model_evidence",
  );
});

test("source paths are accepted as citation aliases when the quote is exact", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-path-evidence-"));
  await writeFile(join(root, "main.go"), "package main\n\nfunc enabled() bool { return true }\n");
  const model: ReviewModel = {
    async review<T>() {
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "ready-with-minor-improvements",
            risk: "low",
            ship: true,
            summary: "The implementation is direct, with one small maintainability improvement available.",
            primaryConcern: "",
          },
          observations: [{
            id: "hard-coded-switch",
            title: "Hard-coded feature decision",
            category: "maintainability",
            severity: "low",
            confidence: "high",
            principle: "Runtime policy should have an explicit ownership boundary.",
            summary: "The feature decision is hard-coded directly in the implementation.",
            impact: "Changing the decision requires a code edit instead of a localized policy update.",
            recommendation: "Move the decision behind the existing configuration boundary when configurability is required.",
            tradeoffs: "Keeping the literal is reasonable until the policy actually needs to vary.",
            evidence: [{
              sourceId: "main.go",
              line: 3,
              detail: "The decision is a literal return value.",
              quote: "func enabled() bool { return true }",
            }],
          }],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  };

  const result = await createApp().run({
    input: { source: { path: root } },
    model,
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.evidence?.[0]?.location?.file, "main.go");
});

test("self-negating observations cannot veto approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-actionability-"));
  await writeFile(join(root, "main.go"), "package main\n\nfunc ready() bool { return true }\n");
  const model: ReviewModel = {
    async review<T>() {
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "significant-maintainability-concerns",
            risk: "medium",
            ship: false,
            summary: "A possible future convention could eventually require a different helper.",
            primaryConcern: "a possible future convention",
          },
          observations: [{
            id: "optional-helper",
            title: "Possible future helper",
            category: "maintainability",
            severity: "medium",
            confidence: "medium",
            principle: "Shared behavior can justify a common abstraction when variation exists.",
            summary: "The current implementation is direct and has no duplicated behavior.",
            impact: "There is no current defect or maintenance burden in this implementation.",
            recommendation: "No action needed; keep the direct implementation until variation exists.",
            tradeoffs: "Adding the helper now would be optional ceremony.",
            evidence: [{
              sourceId: "source:1",
              line: 3,
              detail: "The current implementation is one direct function.",
              quote: "func ready() bool { return true }",
            }],
          }],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  };

  const result = await createApp().run({
    input: { source: { path: root } },
    model,
  });

  assert.deepEqual(result.findings, []);
  assert.equal(result.assessment?.risk, "none");
  assert.equal(result.opinion?.ship, true);
});
