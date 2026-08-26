import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
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

const cleanReview = {
  schemaVersion: 1,
  overall: {
    verdict: "well-engineered",
    risk: "none",
    ship: true,
    summary: "The retrieved sources do not prove a material engineering concern.",
    primaryConcern: "",
  },
  observations: [],
  strengths: [],
} as const;

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

test("normative combination and ordering mismatches are reviewable", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-normative-order-"));
  await writeFile(
    join(root, "runtime-spec.md"),
    "OCI runtime-spec v1.3.0: if l3CacheSchema, memBwSchema, and schemata are set, runtimes MUST write L3 first, MB second, and the schemata values last.\n",
  );
  await writeFile(
    join(root, "intel_rdt.rs"),
    `/// Retrieves schemata data after aligning Intel RDT with OCI runtime-spec v1.3.0.
fn get_schemata_data(intel_rdt: &LinuxIntelRdt) -> Option<String> {
    if let Some(schemata) = intel_rdt.schemata() {
        if !schemata.is_empty() {
            return Some(schemata.join("\\n"));
        }
    }

    combine_l3_cache_and_mem_bw_schemas(
        intel_rdt.l3_cache_schema(),
        intel_rdt.mem_bw_schema(),
    )
}
`,
  );
  const model: ReviewModel = repositoryReviewModel(
    ["runtime-spec.md", "intel_rdt.rs"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /normative versioned contract/);
      assert.match(request.prompt, /combination, precedence, ordering, fallback, and compatibility semantics/);
      assert.match(request.prompt, /cite both the governing requirement and the implementation branch/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "incomplete-implementation",
            risk: "medium",
            ship: false,
            summary: "The new schemata path discards configured legacy values instead of preserving the required write order.",
            primaryConcern: "the incomplete Intel RDT contract migration",
          },
          observations: [{
            id: "normative-schemata-order",
            title: "Preserve every configured schemata value in contract order",
            category: "correctness",
            severity: "medium",
            confidence: "high",
            principle: "An explicit conformance change must implement the prepared normative combination and ordering semantics.",
            summary: "The early return selects the generic schemata list instead of combining it after the legacy L3 and MB values.",
            impact: "When both representations are configured, the runtime silently drops values that the versioned contract requires it to write.",
            recommendation: "Build one result in L3, MB, then generic schemata order without returning early when the generic list is present.",
            tradeoffs: "Compatibility fields can be removed only in a separate contract version that explicitly stops accepting them.",
            evidence: [{
              citationId: "repo:read:1",
              line: 1,
              detail: "The prepared versioned contract requires all configured values in a fixed order.",
            }, {
              citationId: "repo:read:2",
              line: 3,
              detail: "The generic schemata branch returns before either legacy value can be included.",
            }],
          }],
          strengths: [],
        } as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  );

  const result = await createApp().run({ input: { source: { path: root } }, model });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.evidence?.length, 2);
  assert.equal(result.opinion?.ship, false);
});

test("complete normative combination and ordering stays quiet", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-normative-order-clean-"));
  await writeFile(
    join(root, "runtime-spec.md"),
    "OCI runtime-spec v1.3.0: if l3CacheSchema, memBwSchema, and schemata are set, write L3 first, MB second, and schemata values last.\n",
  );
  await writeFile(
    join(root, "intel_rdt.rs"),
    `/// Retrieves schemata data after aligning Intel RDT with OCI runtime-spec v1.3.0.
fn get_schemata_data(intel_rdt: &LinuxIntelRdt) -> Option<String> {
    let legacy_schemata = combine_l3_cache_and_mem_bw_schemas(
        intel_rdt.l3_cache_schema(),
        intel_rdt.mem_bw_schema(),
    );

    if let Some(schemata) = intel_rdt.schemata() {
        if !schemata.is_empty() {
            let modern_schemata = schemata.join("\\n");
            if let Some(legacy) = legacy_schemata {
                return Some(format!("{}\\n{}", legacy, modern_schemata));
            }
            return Some(modern_schemata);
        }
    }

    legacy_schemata
}
`,
  );
  const model: ReviewModel = repositoryReviewModel(
    ["runtime-spec.md", "intel_rdt.rs"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /every configured value and required order are preserved/);
      return {
        output: cleanReview as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  );

  const result = await createApp().run({ input: { source: { path: root } }, model });

  assert.deepEqual(result.findings, []);
  assert.equal(result.opinion?.ship, true);
});

test("an unrelated normative requirement stays quiet", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-normative-unrelated-"));
  await writeFile(
    join(root, "runtime-spec.md"),
    "OCI runtime-spec v1.3.0: runtimes MUST create a monitoring group when enableMonitoring is true.\n",
  );
  await writeFile(
    join(root, "intel_rdt.rs"),
    `fn get_schemata_data(intel_rdt: &LinuxIntelRdt) -> Option<String> {
    combine_l3_cache_and_mem_bw_schemas(
        intel_rdt.l3_cache_schema(),
        intel_rdt.mem_bw_schema(),
    )
}
`,
  );
  const model: ReviewModel = repositoryReviewModel(
    ["runtime-spec.md", "intel_rdt.rs"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /prepared requirement does not govern the changed path/);
      return {
        output: cleanReview as T,
        provider: "fixture",
        model: "fixture",
      };
    },
  );

  const result = await createApp().run({ input: { source: { path: root } }, model });

  assert.deepEqual(result.findings, []);
  assert.equal(result.opinion?.ship, true);
});

test("a comment-only normative edit stays quiet", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-normative-comment-"));
  await writeFile(
    join(root, "intel_rdt.rs"),
    `/// OCI runtime-spec v1.3.0 keeps legacy schemata compatibility.
fn get_schemata_data(intel_rdt: &LinuxIntelRdt) -> Option<String> {
    combine_l3_cache_and_mem_bw_schemas(
        intel_rdt.l3_cache_schema(),
        intel_rdt.mem_bw_schema(),
    )
}
`,
  );
  const model: ReviewModel = repositoryReviewModel(
    ["intel_rdt.rs"],
    async <T>(request: ModelReviewRequest) => {
      const wrapped = request.input as {
        reviewInput?: { reviewScope?: { changedFiles?: string[] } };
      };
      assert.deepEqual(wrapped.reviewInput?.reviewScope?.changedFiles, ["intel_rdt.rs"]);
      assert.match(request.prompt, /wording, naming, or repository layout/);
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
        changed_files: ["intel_rdt.rs"],
      },
    },
    model,
  });

  assert.deepEqual(result.findings, []);
  assert.equal(result.opinion?.ship, true);
});

test("release-disabled framing checks before partial decoding are reviewable", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-decoder-framing-"));
  await writeFile(
    join(root, "state.rs"),
    `pub fn merge_persisted_state(bytes: &[u8]) -> Result<u64, DecodeError> {
    debug_assert_eq!(bytes.len() % 8, 0);
    let mut total = 0;
    for chunk in bytes.chunks_exact(8) {
        total += u64::from_le_bytes(chunk.try_into().unwrap());
    }
    Ok(total)
}
`,
  );
  const model: ReviewModel = repositoryReviewModel(
    ["state.rs"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /Production decoder framing/);
      assert.match(request.prompt, /assertion disabled in production/);
      assert.match(request.prompt, /tolerant partial consumer/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "incomplete-implementation",
            risk: "medium",
            ship: false,
            summary: "Malformed persisted state is accepted as a successful partial decode in production builds.",
            primaryConcern: "the release-only framing gap",
          },
          observations: [{
            id: "release-disabled-framing-check",
            title: "Reject malformed persisted-state framing in production",
            category: "correctness",
            severity: "medium",
            confidence: "high",
            principle: "Production decoders must enforce framing invariants before tolerant partial consumption.",
            summary: "The decoder checks eight-byte alignment only in debug builds, while the production iterator drops trailing bytes.",
            impact: "A malformed persisted state can be partially merged and returned as successful instead of being rejected.",
            recommendation: "Return an error when the byte length is not aligned before iterating over complete frames.",
            tradeoffs: "The debug assertion can remain as documentation after the production check is added.",
            evidence: [{
              citationId: "repo:read:1",
              line: 2,
              detail: "The framing invariant is enforced only by a debug assertion.",
            }, {
              citationId: "repo:read:1",
              line: 4,
              detail: "The decoder consumes only exact chunks and does not inspect the remainder.",
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

test("production framing validation keeps tolerant chunk decoding quiet", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-valid-framing-"));
  await writeFile(
    join(root, "state.rs"),
    `pub fn merge_persisted_state(bytes: &[u8]) -> Result<u64, DecodeError> {
    if bytes.len() % 8 != 0 {
        return Err(DecodeError::InvalidFrameLength(bytes.len()));
    }
    debug_assert_eq!(bytes.len() % 8, 0);
    let mut total = 0;
    for chunk in bytes.chunks_exact(8) {
        total += u64::from_le_bytes(chunk.try_into().unwrap());
    }
    Ok(total)
}
`,
  );
  const model: ReviewModel = repositoryReviewModel(
    ["state.rs"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /production validation already rejects malformed framing/);
      assert.match(request.prompt, /debug assertion only duplicates a real check/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "well-engineered",
            risk: "none",
            ship: true,
            summary: "The decoder rejects malformed framing before exact-chunk iteration in every build mode.",
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

test("a locally runnable host-destructive integration harness is reviewable as one operational risk", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-host-harness-"));
  const suite = join(root, "test", "integration", "suites", "slurm-x509");
  await mkdir(suite, { recursive: true });
  await writeFile(
    join(root, "Makefile"),
    "integration:\nifeq ($(os1), windows)\n\t$(error Integration tests are not supported on windows)\nelse\n\t$(E)$(go_path) IGNORE_SUITES='$(ignore_suites)' ./test/integration/test.sh $(SUITES)\nendif\n",
  );
  await writeFile(
    join(root, "test", "integration", "test.sh"),
    "#!/bin/bash\n\nDIR=\"$( cd \"$( dirname \"${BASH_SOURCE[0]}\" )\" && pwd )\"\ncd \"${DIR}\" || fail-now \"Unable to change to script directory\"\n. ./common\n\nif [[ -z \"${SUITES}\" ]]; then\n   SUITES=suites/*\nfi\n\nif [[ -n $1 ]]; then\n        SUITES=$@\nfi\n\nfor suite in $SUITES; do\n    ./test-one.sh \"${suite}\"\ndone\n",
  );
  await writeFile(
    join(suite, "README.md"),
    "# slurm-x509 suite\n\n## Description\n\nThis suite validates the agent `slurm` WorkloadAttestor end to end against a real single-node Slurm cluster.\n\nSlurm's cgroup/v2 support requires a host systemd + dbus + cgroup v2. This suite runs Slurm 23.11 directly on the host, while SPIRE runs in containers as in the other suites.\n\n- `slurmctld` + `slurmd` + `munged` run on the host (native systemd/cgroup v2).\n- `spire-server` runs in a container.\n",
  );
  await writeFile(
    join(suite, "00-setup"),
    "#!/bin/bash\n\nset -e\n\nlog-debug \"extracting spire-agent binary to the host...\"\ncid=$(docker create spire-agent:latest-local)\ndocker cp \"${cid}:/opt/spire/bin/spire-agent\" ./spire-agent\ndocker rm \"${cid}\" >/dev/null\nsudo install -m 0755 ./spire-agent /usr/local/bin/spire-agent\n\nsudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \\\n    slurm-wlm munge\n\nsudo install -m 0644 slurm.conf.rendered /etc/slurm/slurm.conf\nsudo install -m 0644 conf/slurm/cgroup.conf /etc/slurm/cgroup.conf\n\nsudo systemctl restart munge\nsudo systemctl restart slurmctld\nsudo systemctl restart slurmd\n",
  );
  await writeFile(
    join(suite, "01-start-server"),
    "#!/bin/bash\n\ndocker-spire-server-up spire-server\n",
  );
  await writeFile(
    join(suite, "teardown"),
    "#!/bin/bash\n\nif [ -z \"${SUCCESS}\" ]; then\n    docker compose logs || true\nfi\n\ndocker-down\n\n# Restore host state (the runner is shared across suites).\nsudo scancel -a >/dev/null 2>&1 || true\nsudo systemctl stop slurmd slurmctld munge >/dev/null 2>&1 || true\nsudo rm -rf /tmp/slurm-spire-sockets /tmp/slurm-spire-jobs || true\n",
  );

  const model: ReviewModel = repositoryReviewModel(
    [
      "Makefile",
      "test/integration/test.sh",
      "test/integration/suites/slurm-x509/README.md",
      "test/integration/suites/slurm-x509/00-setup",
      "test/integration/suites/slurm-x509/01-start-server",
      "test/integration/suites/slurm-x509/teardown",
    ],
    async <T>(request: ModelReviewRequest) => {
      const input = JSON.stringify(request.input);
      assert.match(request.prompt, /Host-destructive test harnesses/);
      assert.match(request.prompt, /all of the following/);
      assert.match(input, /test\/integration\/test\.sh/);
      assert.match(input, /SUITES=suites\/\*/);
      assert.match(input, /runs Slurm 23\.11 directly on the host/);
      assert.match(input, /\/usr\/local\/bin\/spire-agent/);
      assert.match(input, /\/etc\/slurm\/slurm\.conf/);
      assert.match(input, /systemctl restart munge/);
      assert.match(input, /scancel -a/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "high-operational-risk",
            risk: "high",
            ship: false,
            summary: "The locally documented integration target can replace host Slurm state and control live system services without an isolation or refusal boundary.",
            primaryConcern: "the uncontained host-destructive integration harness",
          },
          observations: [{
            id: "host-destructive-integration-harness",
            title: "Contain the host-destructive integration harness",
            category: "risk",
            severity: "high",
            confidence: "high",
            principle: "Locally runnable test harnesses must contain persistent privileged effects and live service control behind an explicit safety boundary.",
            summary: "The documented local integration target reaches setup and teardown that install host files, replace Slurm configuration, restart daemons, and cancel all jobs.",
            impact: "A developer running the documented target can overwrite a real Slurm installation, interrupt its daemons, and cancel unrelated workloads.",
            recommendation: "Make this suite CI-only or require an explicit destructive-test opt-in or disposable host before any setup effect.",
            tradeoffs: "A disposable VM may be required when the suite needs the real host cgroup hierarchy.",
            evidence: [{
              citationId: "repo:read:1",
              line: 5,
              detail: "The local integration target reaches the default suite runner.",
            }, {
              citationId: "repo:read:2",
              line: 8,
              detail: "With no explicit suite selection, the runner executes every suite directory.",
            }, {
              citationId: "repo:read:4",
              line: 9,
              detail: "Setup installs a binary into the host's persistent executable path.",
            }, {
              citationId: "repo:read:4",
              line: 17,
              detail: "The same setup restarts the live Slurm and munge services.",
            }, {
              citationId: "repo:read:6",
              line: 10,
              detail: "Teardown cancels all Slurm jobs, not only test-owned jobs.",
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
        changed_files: [
          "Makefile",
          "test/integration/test.sh",
          "test/integration/suites/slurm-x509/README.md",
          "test/integration/suites/slurm-x509/00-setup",
          "test/integration/suites/slurm-x509/01-start-server",
          "test/integration/suites/slurm-x509/teardown",
        ],
      },
    },
    model,
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.evidence?.length, 5);
  assert.equal(result.opinion?.ship, false);
  assert.equal(result.assessment?.risk, "high");
});

test("a dominating CI refusal keeps the same integration effects quiet", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-ci-gated-harness-"));
  const suite = join(root, "test", "integration", "suites", "slurm-x509");
  await mkdir(suite, { recursive: true });
  await mkdir(join(root, ".github", "workflows"), { recursive: true });
  await writeFile(
    join(root, "Makefile"),
    "integration:\nifeq ($(os1), windows)\n\t$(error Integration tests are not supported on windows)\nelse\n\t$(E)$(go_path) IGNORE_SUITES='$(ignore_suites)' ./test/integration/test.sh $(SUITES)\nendif\n",
  );
  await writeFile(
    join(root, "test", "integration", "test.sh"),
    "#!/bin/bash\n\nDIR=\"$( cd \"$( dirname \"${BASH_SOURCE[0]}\" )\" && pwd )\"\ncd \"${DIR}\" || fail-now \"Unable to change to script directory\"\n. ./common\n\nif [[ -z \"${SUITES}\" ]]; then\n   SUITES=suites/*\nfi\n\nif [[ -n $1 ]]; then\n        SUITES=$@\nfi\n\nfor suite in $SUITES; do\n    ./test-one.sh \"${suite}\"\ndone\n",
  );
  await writeFile(
    join(suite, "README.md"),
    "# slurm-x509 suite\n\nThis suite runs Slurm 23.11 directly on the host, while SPIRE runs in containers.\n\n## GitHub Actions only\n\nBecause it installs Slurm/munge on the host, starts host systemd services, and manipulates the host cgroup tree, this suite is intended to run **only on the ephemeral GitHub Actions runners** used by the SPIRE integration job. Every step (and the teardown) sources `skip-unless-github-actions.sh`. Running the suite on a developer workstation is therefore a safe no-op.\n",
  );
  await writeFile(
    join(root, ".github", "workflows", "pr_build.yaml"),
    "jobs:\n  integration:\n    runs-on: ${{ matrix.runs-on }}\n    strategy:\n      matrix:\n        include:\n          - arch: x64\n            runs-on: ubuntu-24.04\n          - arch: arm64\n            runs-on: ubuntu-24.04-arm\n    steps:\n      - name: Run integration tests\n        run: ./.github/workflows/scripts/split.sh | xargs ./test/integration/test.sh\n",
  );
  await writeFile(
    join(suite, "skip-unless-github-actions.sh"),
    "# Sourced at the top of every step script and the teardown.\nif [ \"${GITHUB_ACTIONS:-}\" != \"true\" ]; then\n    if [ ! -f \"${RUNDIR}/.gha-skip-notified\" ]; then\n        log-warn \"the \\\"slurm-x509\\\" suite only runs on GitHub Actions runners; skipping on this machine, reported as success.\"\n        : > \"${RUNDIR}/.gha-skip-notified\" 2>/dev/null || true\n    fi\n    exit 0\nfi\n",
  );
  await writeFile(
    join(suite, "00-setup"),
    "#!/bin/bash\n\nset -e\n\n# This suite is GitHub-Actions-only; skip (with success) elsewhere.\nsource \"${RUNDIR}/skip-unless-github-actions.sh\"\n\nsudo install -m 0755 ./spire-agent /usr/local/bin/spire-agent\nsudo install -m 0644 slurm.conf.rendered /etc/slurm/slurm.conf\nsudo systemctl restart munge\nsudo systemctl restart slurmctld\nsudo systemctl restart slurmd\n",
  );
  const guardedSteps = {
    "01-start-server": "docker-spire-server-up spire-server",
    "02-bootstrap-agent": "log-debug \"bootstrapping agent...\"",
    "03-start-agent": "docker-up spire-agent",
    "04-submit-job": "JOBID=$(sbatch --parsable conf/job/fetch-svid.sh)",
    "05-create-entry": "JOBID=$(cat job.id)",
    "06-verify-fetch": "JOBID=$(cat job.id)",
  };
  for (const [name, command] of Object.entries(guardedSteps)) {
    await writeFile(
      join(suite, name),
      `#!/bin/bash\n\n# This suite is GitHub-Actions-only; skip (with success) elsewhere.\nsource "\${RUNDIR}/skip-unless-github-actions.sh"\n\n${command}\n`,
    );
  }
  await writeFile(
    join(suite, "teardown"),
    "#!/bin/bash\n\n# This suite is GitHub-Actions-only; skip (with success) elsewhere. Nothing was started locally, so there is nothing to tear down.\nsource \"${RUNDIR}/skip-unless-github-actions.sh\"\n\ndocker-down\nsudo scancel -a >/dev/null 2>&1 || true\nsudo systemctl stop slurmd slurmctld munge >/dev/null 2>&1 || true\n",
  );

  const model: ReviewModel = repositoryReviewModel(
    [
      "Makefile",
      "test/integration/test.sh",
      "test/integration/suites/slurm-x509/README.md",
      ".github/workflows/pr_build.yaml",
      "test/integration/suites/slurm-x509/skip-unless-github-actions.sh",
      "test/integration/suites/slurm-x509/00-setup",
      "test/integration/suites/slurm-x509/01-start-server",
      "test/integration/suites/slurm-x509/02-bootstrap-agent",
      "test/integration/suites/slurm-x509/03-start-agent",
      "test/integration/suites/slurm-x509/04-submit-job",
      "test/integration/suites/slurm-x509/05-create-entry",
      "test/integration/suites/slurm-x509/06-verify-fetch",
      "test/integration/suites/slurm-x509/teardown",
    ],
    async <T>(request: ModelReviewRequest) => {
      const input = JSON.stringify(request.input);
      assert.match(request.prompt, /hosted-CI\/opt-in\/existing-service refusal before every effect/);
      assert.match(input, /GITHUB_ACTIONS/);
      assert.match(input, /ubuntu-24\.04/);
      assert.match(input, /developer workstation is therefore a safe no-op/);
      assert.match(input, /skip-unless-github-actions\.sh/);
      assert.match(input, /\/etc\/slurm\/slurm\.conf/);
      assert.match(input, /scancel -a/);
      for (const name of ["00-setup", ...Object.keys(guardedSteps), "teardown"]) {
        assert.match(input, new RegExp(name));
      }
      return { output: cleanReview as T, provider: "fixture", model: "fixture" };
    },
  );

  const result = await createApp().run({ input: { source: { path: root } }, model });
  assert.deepEqual(result.findings, []);
  assert.equal(result.opinion?.ship, true);
});

test("host-harness guardrail contexts remain available without becoming findings", async () => {
  const cases = [{
    name: "container",
    paths: {
      "Dockerfile": "FROM ubuntu:24.04\nRUN cp ./slurm.conf /etc/slurm/slurm.conf && systemctl restart slurmd\n",
      "test/integration/container.sh": "#!/bin/sh\ndocker build -t slurm-test .\n",
    },
  }, {
    name: "ci-only",
    paths: {
      ".github/workflows/integration.yml": "jobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: test/integration/host.sh\n",
      "test/integration/host.sh": "#!/bin/sh\nsudo cp ./slurm.conf /etc/slurm/slurm.conf\nsudo systemctl restart slurmd\n",
    },
  }, {
    name: "explicit-opt-in",
    paths: {
      "test/integration/host.sh": "#!/bin/sh\n[ \"${ALLOW_DESTRUCTIVE_HOST_TESTS:-}\" = yes ] || exit 0\nsudo cp ./slurm.conf /etc/slurm/slurm.conf\nsudo systemctl restart slurmd\n",
    },
  }, {
    name: "existing-service-refusal",
    paths: {
      "test/integration/host.sh": "#!/bin/sh\n! systemctl is-active --quiet slurmd || exit 1\n[ ! -e /etc/slurm/slurm.conf ] || exit 1\nsudo cp ./slurm.conf /etc/slurm/slurm.conf\nsudo systemctl restart slurmd\n",
    },
  }, {
    name: "disposable-vm",
    paths: {
      "Vagrantfile": "Vagrant.configure('2') { |c| c.vm.provision 'shell', path: 'test/integration/host.sh' }\n",
      "test/integration/host.sh": "#!/bin/sh\nsudo cp ./slurm.conf /etc/slurm/slurm.conf\nsudo systemctl restart slurmd\n",
    },
  }, {
    name: "chroot-and-temp",
    paths: {
      "test/integration/host.sh": "#!/bin/sh\nroot=$(mktemp -d)\ninstall -D ./slurm.conf \"$root/etc/slurm/slurm.conf\"\nchroot \"$root\" systemctl restart slurmd\n",
    },
  }, {
    name: "uninvoked-helper",
    paths: {
      "test/integration/host.sh": "#!/bin/sh\ndangerous_setup() { sudo cp ./slurm.conf /etc/slurm/slurm.conf; sudo systemctl restart slurmd; }\necho ready\n",
    },
  }, {
    name: "partial-evidence",
    paths: {
      "test/integration/host.sh": "#!/bin/sh\nsudo install ./helper /usr/local/bin/test-helper\n",
    },
  }];

  for (const sample of cases) {
    const root = await mkdtemp(join(tmpdir(), `engineering-review-host-guardrail-${sample.name}-`));
    for (const [path, content] of Object.entries(sample.paths)) {
      await mkdir(join(root, path, ".."), { recursive: true });
      await writeFile(join(root, path), content);
    }
    const paths = Object.keys(sample.paths);
    const model: ReviewModel = repositoryReviewModel(
      paths,
      async <T>(request: ModelReviewRequest) => {
        assert.match(request.prompt, /Host-destructive test harnesses/);
        assert.match(request.prompt, /Stay quiet for Dockerfile\/image-build effects/);
        assert.ok(paths.every((path) => JSON.stringify(request.input).includes(path)));
        return { output: cleanReview as T, provider: "fixture", model: "fixture" };
      },
    );
    const result = await createApp().run({ input: { source: { path: root } }, model });
    assert.deepEqual(result.findings, [], sample.name);
    assert.equal(result.opinion?.ship, true, sample.name);
  }
});

const schemaWithInvalidDefault = `export const promptSchema = {
  variables: {
    tone: { type: "string", enum: ["formal", "casual"], default: "forma" },
  },
};

export function render(caller: Record<string, unknown>, schema = promptSchema) {
  for (const [name, value] of Object.entries(caller)) {
    const spec = schema.variables[name as keyof typeof schema.variables];
    if (spec?.enum && !spec.enum.includes(String(value))) {
      throw new Error(\`invalid \${name}\`);
    }
  }
  const effective = { tone: schema.variables.tone.default, ...caller };
  return String(effective.tone);
}
`;

const schemaWithRevalidatedDefault = schemaWithInvalidDefault.replace(
  "const effective = { tone: schema.variables.tone.default, ...caller };\n  return String(effective.tone);",
  `const effective = { tone: schema.variables.tone.default, ...caller };
  for (const [name, value] of Object.entries(effective)) {
    const spec = schema.variables[name as keyof typeof schema.variables];
    if (spec?.enum && !spec.enum.includes(String(value))) {
      throw new Error(\`invalid effective \${name}\`);
    }
  }
  return String(effective.tone);`,
);

test("a schema default that can violate its enum after caller-only validation is reviewable", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-effective-value-"));
  await writeFile(join(root, "render.ts"), schemaWithInvalidDefault);
  const model: ReviewModel = repositoryReviewModel(
    ["render.ts"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /same applicable constraints on that effective value/);
      assert.match(JSON.stringify(request.input), /default: \\"forma\\"/);
      assert.match(JSON.stringify(request.input), /const effective/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "incomplete-implementation",
            risk: "medium",
            ship: false,
            summary: "Caller values are checked against the enum, but the rendered default can violate that same enum.",
            primaryConcern: "the unvalidated effective prompt default",
          },
          observations: [{
            id: "unvalidated-effective-default",
            title: "Validate derived defaults before render",
            category: "correctness",
            severity: "medium",
            confidence: "high",
            principle: "Constraints that apply to caller values also apply to defaults that are later consumed.",
            summary: "The renderer validates caller maps, then inserts schema.default and renders it without rechecking the enum.",
            impact: "A typo such as default: forma is rendered as if it were a legal tone.",
            recommendation: "Re-apply type, enum, and range checks to effectiveVariables after defaults are merged.",
            tradeoffs: "required can remain a caller-presence rule if that is the documented contract.",
            evidence: [{
              citationId: "repo:read:1",
              line: 3,
              detail: "The schema default is outside the declared enum.",
            }, {
              citationId: "repo:read:1",
              line: 14,
              detail: "The derived effective value is what render consumes.",
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
        changed_files: ["render.ts"],
      },
    },
    model,
  });
  assert.equal(result.findings.length, 1);
  assert.equal(result.opinion?.ship, false);
});

test("revalidated effective values and caller-presence required stay quiet", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-effective-clean-"));
  await writeFile(join(root, "render.ts"), schemaWithRevalidatedDefault);
  const model: ReviewModel = repositoryReviewModel(
    ["render.ts"],
    async <T>(request: ModelReviewRequest) => {
      assert.match(request.prompt, /effective values are revalidated/);
      assert.match(request.prompt, /intentionally a caller-presence check such as required/);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "well-engineered",
            risk: "none",
            ship: true,
            summary: "Effective values are checked after defaults are applied.",
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

test("a comment-only edit beside a legacy invalid default stays quiet", async () => {
  const root = await mkdtemp(join(tmpdir(), "engineering-review-effective-comment-"));
  await writeFile(join(root, "render.ts"), `${schemaWithInvalidDefault}\n// note: keep enum and default aligned\n`);
  const model: ReviewModel = repositoryReviewModel(
    ["render.ts"],
    async <T>(request: ModelReviewRequest) => {
      const wrapped = request.input as {
        reviewInput?: { reviewScope?: { changedFiles?: string[] } };
      };
      assert.deepEqual(wrapped.reviewInput?.reviewScope?.changedFiles, ["render.ts"]);
      return {
        output: {
          schemaVersion: 1,
          overall: {
            verdict: "well-engineered",
            risk: "none",
            ship: true,
            summary: "The comment does not change the validation contract.",
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
        changed_files: ["render.ts"],
      },
    },
    model,
  });
  assert.deepEqual(result.findings, []);
  assert.equal(result.opinion?.ship, true);
});
