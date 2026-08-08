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
import { repositoryReviewModel } from "./repository-model.ts";

test("placeholder observation prose receives one bounded repair attempt and then fails closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-placeholder-"));
  await writeFile(join(root, "main.go"), "package main\n");
  let calls = 0;
  const model: ReviewModel = repositoryReviewModel(
    ["main.go"],
    async <T>(request: ModelReviewRequest) => {
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
              citationId: "repo:read:1",
              line: 1,
              detail: "The package is the prepared source.",
            }],
          }],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  );

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
  const model: ReviewModel = repositoryReviewModel(
    ["main.go"],
    async <T>() => {
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
  );

  const result = await createApp().run({
    input: { source: { path: root } },
    model,
  });

  assert.equal(calls, 1);
  assert.equal(result.assessment?.risk, "none");
  assert.match(result.assessment?.summary ?? "", /no material evidence-backed engineering concern/i);
  assert.equal(result.opinion?.ship, true);
});

test("fabricated citation IDs are rejected instead of presented", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-evidence-"));
  await writeFile(join(root, "main.go"), "package main\n\nfunc ready() bool { return true }\n");
  const model: ReviewModel = repositoryReviewModel(
    ["main.go"],
    async <T>() => {
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
              citationId: "repo:read:999",
              line: 3,
              detail: "This citation ID was never created by a repository read.",
            }],
          }],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  );

  await assert.rejects(
    createApp().run({ input: { source: { path: root } }, model }),
    (error: unknown) =>
      error instanceof ModelReviewError && error.code === "invalid_model_evidence",
  );
});

test("prepared repository citations resolve to source locations", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-path-evidence-"));
  await writeFile(join(root, "main.go"), "package main\n\nfunc enabled() bool { return true }\n");
  const model: ReviewModel = repositoryReviewModel(
    ["main.go"],
    async <T>() => {
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
              citationId: "repo:read:1",
              line: 3,
              detail: "The decision is a literal return value.",
            }],
          }],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  );

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
  const model: ReviewModel = repositoryReviewModel(
    ["main.go"],
    async <T>() => {
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
              citationId: "repo:read:1",
              line: 3,
              detail: "The current implementation is one direct function.",
            }],
          }],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  );

  const result = await createApp().run({
    input: { source: { path: root } },
    model,
  });

  assert.deepEqual(result.findings, []);
  assert.equal(result.assessment?.risk, "none");
  assert.equal(result.opinion?.ship, true);
});

test("prompt guides model on narrow exception scopes (broad try-catch class)", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-try-scope-"));
  await writeFile(join(root, "main.go"), "package main\n\nfunc process() {\n  try {\n    foo()\n    dest.append(x)\n    bar()\n  } catch (e error) {\n    // broad\n  }\n}\n");
  const model: ReviewModel = repositoryReviewModel(
    ["main.go"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /Exception scope hygiene/);
      assert.match(request.prompt, /Broad scopes that protect unrelated code/);
      assert.match(request.prompt, /only the operations that can raise the caught exception belong inside it/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "ready-with-minor-improvements",
            risk: "low",
            ship: true,
            summary: "The implementation is mostly sound with one maintainability note on error handling.",
            primaryConcern: "the overly broad exception scope",
          },
          observations: [{
            id: "broad-try-scope",
            title: "Overly broad try block",
            category: "maintainability",
            severity: "low",
            confidence: "high",
            principle: "Try blocks should be scoped only to the operations that can raise the caught exception.",
            summary: "The try encloses unrelated statements.",
            impact: "Unrelated errors can be swallowed and the failure mode is harder to diagnose.",
            recommendation: "Wrap only the append (or equivalent) that can actually fail.",
            tradeoffs: "Narrowing the scope makes the intent clearer without changing behavior.",
            evidence: [{
              citationId: "repo:read:1",
              line: 5,
              detail: "The try block covers foo, append, and bar.",
            }],
          }],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  );

  const result = await createApp().run({
    input: { source: { path: root } },
    model,
  });

  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0]?.summary ?? "", /broad|scope|try|append|unrelated/i);
});

test("clean narrow try scope produces no observation for this class", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-narrow-try-"));
  await writeFile(join(root, "main.go"), "package main\n\nfunc process() {\n  try {\n    dest.append(x)\n  } catch (e error) {\n    // narrow and correct\n  }\n  foo()\n  bar()\n}\n");
  const model: ReviewModel = repositoryReviewModel(
    ["main.go"],
    async <T>(request: ModelReviewRequest) => {
      // still contains the guidance but model returns no observation for this
      assert.match(request.prompt, /Exception scope hygiene/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "well-engineered",
            risk: "none",
            ship: true,
            summary: "The implementation is direct and well-scoped.",
            primaryConcern: "",
          },
          observations: [],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  );

  const result = await createApp().run({
    input: { source: { path: root } },
    model,
  });

  assert.deepEqual(result.findings, []);
  assert.equal(result.opinion?.ship, true);
});

test("prompt guides model on timing and interval hygiene (timeout > interval class)", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-timeout-interval-"));
  await writeFile(join(root, "main.go"), `package main

import "time"

func monitor() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		// work that can exceed interval
		time.Sleep(30 * time.Second)
	}
}
`);
  const model: ReviewModel = repositoryReviewModel(
    ["main.go"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /Timing and interval hygiene/);
      assert.match(request.prompt, /timeout > interval/);
      assert.match(request.prompt, /goroutine accumulation/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "ready-with-minor-improvements",
            risk: "low",
            ship: true,
            summary: "The implementation is mostly sound with one operational note on timing.",
            primaryConcern: "the timeout and interval relationship",
          },
          observations: [{
            id: "timeout-interval-mismatch",
            title: "Timeout larger than interval",
            category: "operational-risk",
            severity: "low",
            confidence: "high",
            principle: "Timeout and interval values in background loops should not allow accumulation of work.",
            summary: "The timeout exceeds the poll interval.",
            impact: "Slow operations could cause goroutines to accumulate.",
            recommendation: "Ensure timeout is shorter than interval or add work bounding and single-worker enforcement.",
            tradeoffs: "Tightening the values prevents resource growth without changing the core behavior.",
            evidence: [{
              citationId: "repo:read:1",
              line: 10,
              detail: "Ticker interval 10s with work that can exceed it.",
            }],
          }],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  );

  const result = await createApp().run({
    input: { source: { path: root } },
    model,
  });

  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0]?.summary ?? "", /timeout|interval|accumulation|goroutine/i);
});

test("clean timeout/interval relationship produces no observation for this class", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-clean-timeout-"));
  await writeFile(join(root, "main.go"), `package main

import "time"

func monitor() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		// work completes well under the interval
		time.Sleep(5 * time.Second)
	}
}
`);
  const model: ReviewModel = repositoryReviewModel(
    ["main.go"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /Timing and interval hygiene/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "well-engineered",
            risk: "none",
            ship: true,
            summary: "The implementation is direct with safe timing parameters.",
            primaryConcern: "",
          },
          observations: [],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  );

  const result = await createApp().run({
    input: { source: { path: root } },
    model,
  });

  assert.deepEqual(result.findings, []);
  assert.equal(result.opinion?.ship, true);
});
