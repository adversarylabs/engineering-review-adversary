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

test("generalized contract guidance supports one cross-layer finding", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-contract-"));
  await writeFile(
    join(root, "settings.py"),
    "def configure(value: int | str):\n    return send_to_adapter(value)\n\ndef send_to_adapter(value: str):\n    return value.upper()\n",
  );
  const model: ReviewModel = repositoryReviewModel(
    ["settings.py"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /Contract integrity/);
      assert.match(request.prompt, /Report one incomplete engineering story, not one issue per layer/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "incomplete-implementation",
            risk: "medium",
            ship: false,
            summary: "The widened input contract is not supported by the downstream adapter.",
            primaryConcern: "the partially propagated input contract",
          },
          observations: [{
            id: "partial-contract-migration",
            title: "Input contract stops at the adapter",
            category: "completeness",
            severity: "medium",
            confidence: "high",
            principle: "A changed contract must be carried through every related consumer.",
            summary: "The public entry point accepts integers while its adapter still accepts only strings.",
            impact: "Newly valid public inputs fail when they reach the unchanged downstream layer.",
            recommendation: "Propagate the widened contract through the adapter or keep the public input restricted.",
            tradeoffs: "Keeping the narrower contract is preferable if the adapter cannot support the new values yet.",
            evidence: [{
              citationId: "repo:read:1",
              line: 1,
              detail: "The entry point accepts both integers and strings.",
            }, {
              citationId: "repo:read:1",
              line: 4,
              detail: "The downstream adapter remains string-only.",
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
  assert.equal(result.findings[0]?.evidence?.length, 2);
  assert.equal(result.opinion?.ship, false);
});

test("candidate gate keeps optional future concerns silent", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-gate-"));
  await writeFile(
    join(root, "formatter.java"),
    "final class Formatter {\n  String format(String value) { return value.trim(); }\n}\n",
  );
  const model: ReviewModel = repositoryReviewModel(
    ["formatter.java"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /Candidate gate/);
      assert.match(request.prompt, /hypothetical future misuse/);
      assert.match(request.prompt, /specific, proportionate action/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "well-engineered",
            risk: "none",
            ship: true,
            summary: "The direct implementation has no demonstrated engineering defect.",
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

test("change cohesion guidance supports one evidence-backed independent-change finding", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-cohesion-"));
  await writeFile(
    join(root, "billing.ts"),
    "export function retryInvoice(id: string) {\n  return scheduleRetry(id, { attempts: 3 });\n}\n",
  );
  await writeFile(
    join(root, "avatar.ts"),
    "export function avatarUrl(userId: string) {\n  return `/avatars/${userId}?cache=disabled`;\n}\n",
  );
  const model: ReviewModel = repositoryReviewModel(
    ["billing.ts", "avatar.ts"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /Change cohesion/);
      assert.match(request.prompt, /materially independent behavior change/);
      assert.match(request.prompt, /Different directories, multiple concerns/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "high-operational-risk",
            risk: "medium",
            ship: false,
            summary: "The invoice retry change also batches an independent avatar-cache behavior change.",
            primaryConcern: "the independently batched avatar-cache behavior",
          },
          observations: [{
            id: "independent-avatar-cache-change",
            title: "Independent avatar-cache behavior is batched",
            category: "risk",
            severity: "medium",
            confidence: "high",
            principle: "A change should remain one cohesive engineering and rollback unit.",
            summary: "Invoice retry policy and avatar cache disabling alter unrelated product behavior in the same change.",
            impact: "Rolling back either behavior also rolls back the other, and validation of the retry change can miss the cache change.",
            recommendation: "Split the avatar-cache behavior into its own change, or establish the concrete dependency that requires the two to ship together.",
            tradeoffs: "Keeping them together is justified only if their rollout and rollback are intentionally coupled.",
            evidence: [{
              citationId: "repo:read:1",
              line: 2,
              detail: "The billing source changes invoice retry policy.",
            }, {
              citationId: "repo:read:2",
              line: 2,
              detail: "The avatar source independently disables caching.",
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
    input: {
      source: { path: root },
      change: {
        type: "diff",
        base_ref: "base",
        head_ref: "head",
        scan_mode: "changed",
        changed_files: ["billing.ts", "avatar.ts"],
      },
    },
    model,
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.evidence?.length, 2);
  assert.equal(result.opinion?.ship, false);
});

test("cohesive multi-file contract change stays quiet", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-cohesion-clean-"));
  await writeFile(
    join(root, "settings.ts"),
    "export interface RetrySettings {\n  attempts: number;\n}\n",
  );
  await writeFile(
    join(root, "worker.ts"),
    "import type { RetrySettings } from './settings.js';\nexport function retry(settings: RetrySettings) {\n  return settings.attempts;\n}\n",
  );
  const model: ReviewModel = repositoryReviewModel(
    ["settings.ts", "worker.ts"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /Change cohesion/);
      assert.match(request.prompt, /Recommend splitting the independent change or explain the required dependency/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "well-engineered",
            risk: "none",
            ship: true,
            summary: "The settings contract and its consumer form one cohesive retry-policy change.",
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
    input: {
      source: { path: root },
      change: {
        type: "diff",
        base_ref: "base",
        head_ref: "head",
        scan_mode: "changed",
        changed_files: ["settings.ts", "worker.ts"],
      },
    },
    model,
  });

  assert.deepEqual(result.findings, []);
  assert.equal(result.opinion?.ship, true);
});
