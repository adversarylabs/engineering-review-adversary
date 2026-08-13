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

test("avoidable material work before an independent cheap rejection is reviewable", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-cheap-rejection-"));
  await writeFile(
    join(root, "imports.ts"),
    "export async function importArchive(request: Request) {\n  const archive = await downloadAndExpandArchive(request);\n  if (request.headers.get('x-import-token') !== process.env.IMPORT_TOKEN) {\n    return new Response('unauthorized', { status: 401 });\n  }\n  return persistArchive(archive);\n}\n",
  );
  const model: ReviewModel = repositoryReviewModel(
    ["imports.ts"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /Proportional tools and work/);
      assert.match(request.prompt, /materially expensive resolution, fetch, or allocation/);
      assert.match(request.prompt, /independent of both the operation's result and its effects/);
      assert.match(request.prompt, /cite both the expensive call and the cheap predicate/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "significant-maintainability-concerns",
            risk: "medium",
            ship: false,
            summary: "Unauthenticated requests download and expand an archive before an independent header check rejects them.",
            primaryConcern: "the avoidable archive work before authentication",
          },
          observations: [{
            id: "archive-work-before-authentication",
            title: "Reject unauthorized imports before expanding archives",
            category: "maintainability",
            severity: "medium",
            confidence: "high",
            principle: "Material work should follow independent inexpensive rejection predicates.",
            summary: "The handler downloads and expands an archive before checking an authentication header that does not depend on the archive.",
            impact: "Every rejected request still incurs network transfer, archive allocation, and expansion work.",
            recommendation: "Validate the import token before downloading and expanding the archive.",
            tradeoffs: "Keep the existing order only if archive resolution has a required effect used by authentication.",
            evidence: [{
              citationId: "repo:read:1",
              line: 2,
              detail: "The changed handler downloads and expands the archive first.",
            }, {
              citationId: "repo:read:1",
              line: 3,
              detail: "The later rejection reads only the request header and environment token.",
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
        changed_files: ["imports.ts"],
      },
    },
    model,
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.evidence?.length, 2);
  assert.equal(result.opinion?.ship, false);
});

test("duplicate material retrieval without invalidation is reviewable", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-duplicate-fetch-"));
  await writeFile(
    join(root, "reports.ts"),
    "export async function renderReport(id: string) {\n  const rows = await fetchFullReport(id);\n  const title = summarize(rows);\n  const exportRows = await fetchFullReport(id);\n  return writeExport(title, exportRows);\n}\n",
  );
  const model: ReviewModel = repositoryReviewModel(
    ["reports.ts"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /repeated materially expensive retrieval of the same derived data/);
      assert.match(request.prompt, /no intervening mutation or invalidation/);
      assert.match(request.prompt, /cite the duplicate call sites/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "significant-maintainability-concerns",
            risk: "medium",
            ship: false,
            summary: "The report is fully fetched twice without an intervening state change.",
            primaryConcern: "the duplicate full report retrieval",
          },
          observations: [{
            id: "duplicate-full-report-fetch",
            title: "Reuse the full report retrieval",
            category: "maintainability",
            severity: "medium",
            confidence: "high",
            principle: "Material derived data should not be retrieved repeatedly without invalidation.",
            summary: "Both calls fetch the same full report, and the code between them only derives a title.",
            impact: "Each export repeats the report query and transfer cost.",
            recommendation: "Use the first report value for both summarization and export.",
            tradeoffs: "Fetch again only if the export intentionally requires a newer snapshot.",
            evidence: [{
              citationId: "repo:read:1",
              line: 2,
              detail: "The report is fetched for summarization.",
            }, {
              citationId: "repo:read:1",
              line: 4,
              detail: "The unchanged report is fetched again for export.",
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

test("expensive work stays quiet when the rejection depends on its result", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-dependent-rejection-"));
  await writeFile(
    join(root, "imports.ts"),
    "export async function importArchive(request: Request) {\n  const archive = await downloadAndExpandArchive(request);\n  if (!archive.manifest.isCompatible) {\n    return new Response('unsupported archive', { status: 422 });\n  }\n  return persistArchive(archive);\n}\n",
  );
  const model: ReviewModel = repositoryReviewModel(
    ["imports.ts"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /predicate consumes a value produced by the operation/);
      assert.match(request.prompt, /required canonicalization or side effects/);
      assert.match(request.prompt, /cost or independence is merely assumed/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "well-engineered",
            risk: "none",
            ship: true,
            summary: "Compatibility is evaluated from the resolved archive manifest, so the operation must precede the rejection.",
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
        changed_files: ["imports.ts"],
      },
    },
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

test("approval followed by a mutable re-fetch before trusted publication is reviewable", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-approved-revision-"));
  await writeFile(
    join(root, "adopt.ts"),
    "export async function adopt(prNumber: number) {\n  const reviewed = await readPullMetadata(prNumber);\n  await confirmReview({ headOid: reviewed.headOid, files: reviewed.files });\n  const fetched = await fetchCurrentRef(`refs/pull/${prNumber}/head`);\n  await publishToTrustedCI(fetched.oid);\n}\n",
  );
  const model: ReviewModel = repositoryReviewModel(
    ["adopt.ts"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /Lifecycle and authority/);
      assert.match(request.prompt, /approved immutable identity/);
      assert.match(request.prompt, /re-resolution window and a reachable wrong-content outcome/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "high-operational-risk",
            risk: "high",
            ship: false,
            summary: "The adoption flow can publish a different pull-request revision than the one the maintainer approved.",
            primaryConcern: "the unbound pull-request approval",
          },
          observations: [{
            id: "approval-not-bound-to-fetched-revision",
            title: "Bind adoption approval to the fetched revision",
            category: "risk",
            severity: "high",
            confidence: "high",
            principle: "Approval of mutable content must remain bound to an immutable identity until the trusted action occurs.",
            summary: "The maintainer approves one head OID, but publication uses a later fetch of the mutable pull-request ref without comparing identities.",
            impact: "A contributor can update the ref after confirmation and have unreviewed content published to trusted CI.",
            recommendation: "Fetch the approved OID directly, or compare the fetched OID with reviewed.headOid and abort before publication on mismatch.",
            tradeoffs: "A mismatch requires the maintainer to review and confirm the new revision, which is the intended trust boundary.",
            evidence: [{
              citationId: "repo:read:1",
              line: 3,
              detail: "Confirmation records the head OID from the earlier metadata read.",
            }, {
              citationId: "repo:read:1",
              line: 4,
              detail: "The script later resolves the mutable pull-request head ref.",
            }, {
              citationId: "repo:read:1",
              line: 5,
              detail: "The newly fetched OID is published to the trusted environment without an identity check.",
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
        changed_files: ["adopt.ts"],
      },
    },
    model,
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.evidence?.length, 3);
  assert.equal(result.opinion?.ship, false);
});

test("identity comparison before trusted publication keeps mutable re-fetch quiet", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-pinned-approval-"));
  await writeFile(
    join(root, "adopt.ts"),
    "export async function adopt(prNumber: number) {\n  const reviewed = await readPullMetadata(prNumber);\n  await confirmReview({ headOid: reviewed.headOid, files: reviewed.files });\n  const fetched = await fetchCurrentRef(`refs/pull/${prNumber}/head`);\n  if (fetched.oid !== reviewed.headOid) throw new Error('revision changed');\n  await publishToTrustedCI(fetched.oid);\n}\n",
  );
  const model: ReviewModel = repositoryReviewModel(
    ["adopt.ts"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /identity mismatch aborts before effects/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "well-engineered",
            risk: "none",
            ship: true,
            summary: "The fetched revision is checked against the approved identity before trusted publication.",
            primaryConcern: "",
          },
          observations: [],
          strengths: [{
            summary: "The identity check preserves the confirmation boundary across the mutable fetch.",
            evidence: [{
              citationId: "repo:read:1",
              line: 5,
              detail: "A changed revision aborts before publication.",
            }],
          }],
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
        changed_files: ["adopt.ts"],
      },
    },
    model,
  });

  assert.deepEqual(result.findings, []);
  assert.equal(result.opinion?.ship, true);
});

test("material same-target writes that preserve one pre-write state are reviewable", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-coalescible-writes-"));
  await writeFile(
    join(root, "reconcile.ts"),
    "export async function reconcileAll(client, activeApps, nextStatusById) {\n  for (const app of activeApps) {\n    const target = `/applications/${app.id}`;\n    await client.mergePatch(target, { status: nextStatusById[app.id] });\n    await client.mergePatch(target, { metadata: { annotations: { refresh: null } } });\n  }\n}\n",
  );
  const model: ReviewModel = repositoryReviewModel(
    ["reconcile.ts"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /material hot-path or scale cost/);
      assert.match(request.prompt, /same logical target and current endpoint/);
      assert.match(request.prompt, /one supported atomic operation can express both changes/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "ready-with-minor-improvements",
            risk: "low",
            ship: true,
            summary: "The reconcile path is correct, but it performs two merge patches where one expresses both changes.",
            primaryConcern: "",
          },
          observations: [{
            id: "coalesce-reconcile-writes",
            title: "Coalesce the same-target reconcile writes",
            category: "maintainability",
            severity: "low",
            confidence: "high",
            principle: "Material hot-path work should use the narrowest operation that preserves its semantics.",
            summary: "Every reconciliation sends two merge patches to the same target from the same pre-write state even though one merge patch can carry both changes.",
            impact: "The duplicate request adds avoidable API-server traffic for every active application on every reconciliation pass.",
            recommendation: "Send one merge patch containing both the status and annotation removal.",
            tradeoffs: "Keep separate writes if the current API moves status to a distinct subresource or requires independent failure handling.",
            evidence: [{
              citationId: "repo:read:1",
              line: 2,
              detail: "The reconcile operation performs the mutation pair for every active application.",
            }, {
              citationId: "repo:read:1",
              line: 4,
              detail: "The first merge patch updates status on the shared target.",
            }, {
              citationId: "repo:read:1",
              line: 5,
              detail: "The second merge patch updates metadata on the same target with the same merge operation.",
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
        changed_files: ["reconcile.ts"],
      },
    },
    model,
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.evidence?.length, 3);
  assert.equal(result.opinion?.ship, true);
});

test("separate mutations stay quiet when coalescing is not proven safe or material", async () => {
  const cases = [{
    name: "guard",
    source: "export async function reconcile(client, app, nextStatus) {\n  await client.mergePatch(`/applications/${app.id}`, { status: nextStatus });\n  await client.jsonPatch(`/applications/${app.id}`, [{ op: 'test', path: '/metadata/annotations/refresh-at', value: app.refreshAt }, { op: 'remove', path: '/metadata/annotations/refresh' }]);\n}\n",
    reason: "The timestamp test preserves a concurrent refresh request.",
  }, {
    name: "subresource",
    source: "export async function reconcile(client, app, nextStatus) {\n  await client.patch(`/applications/${app.id}/status`, { status: nextStatus });\n  await client.patch(`/applications/${app.id}`, { metadata: { annotations: { refresh: null } } });\n}\n",
    reason: "Status and metadata use distinct current API boundaries.",
  }, {
    name: "fresh-state",
    source: "export async function reconcile(client, app, nextStatus) {\n  await client.mergePatch(`/applications/${app.id}`, { status: nextStatus });\n  const current = await client.get(`/applications/${app.id}`);\n  await client.mergePatch(`/applications/${app.id}`, { observedVersion: current.version });\n}\n",
    reason: "The later mutation intentionally depends on refreshed state.",
  }, {
    name: "distinct-side-effect",
    source: "export async function update(store, audit, account, nextState) {\n  await store.updateAccount(account.id, nextState);\n  await audit.append({ accountId: account.id, state: nextState });\n}\n",
    reason: "The durable audit record has separate ownership and failure semantics.",
  }, {
    name: "unproven-cost",
    source: "export async function repairOne(client, id) {\n  await client.mergePatch(`/applications/${id}`, { status: 'ready' });\n  await client.mergePatch(`/applications/${id}`, { repaired: true });\n}\n",
    reason: "The source establishes neither a hot path nor material scale.",
  }];

  for (const sample of cases) {
    const root = await mkdtemp(join(tmpdir(), `engineering-review-writes-${sample.name}-`));
    await writeFile(join(root, "change.ts"), sample.source);
    const model: ReviewModel = repositoryReviewModel(
      ["change.ts"],
      async <T>(request: ModelReviewRequest) => {
        assert.match(request.prompt, /compare, test, resource version, timestamp, or CAS/);
        assert.match(request.prompt, /distinct side effects, audit, transaction, failure, or retry semantics/);
        assert.match(request.prompt, /depends on the first response or refreshed state/);
        assert.match(request.prompt, /targets or current boundaries differ/);
        assert.match(request.prompt, /material cost, independence, or combine capability is assumed/);
        return {
          output: {
            schemaVersion: 1,
            overall: {
              verdict: "well-engineered",
              risk: "none",
              ship: true,
              summary: sample.reason,
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
          changed_files: ["change.ts"],
        },
      },
      model,
    });

    assert.deepEqual(result.findings, [], sample.name);
    assert.equal(result.opinion?.ship, true, sample.name);
  }
});
