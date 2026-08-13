import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildModelReviewRequest } from "../src/model-review.ts";
import { ENGINEERING_REVIEW_PROMPT } from "../src/prompt.ts";

test("prompt defines staff-level authority and specialist boundaries", () => {
  assert.match(ENGINEERING_REVIEW_PROMPT, /zero to four important observations/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Silence is better than speculative feedback/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Do not become a linter/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /security, observability/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /primaryConcern must be a short noun phrase/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /repository tools/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /citationId/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Contract integrity/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Ownership and boundaries/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /One source of truth/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Constraint scope/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Alternate-path semantics/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Progress accounting/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Proportional tools and work/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Lifecycle and authority/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Compatibility and operations/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Change cohesion/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Meaningful validation/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Candidate gate/);
  assert.doesNotMatch(
    ENGINEERING_REVIEW_PROMPT,
    /initConfig|g\.spec|OpenForRead|dest\.append|goroutine|context\.Background/,
  );
});

test("prompt preserves per-entity constraint semantics", () => {
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /collapses differing consumer, listener, tenant, or route policies into one aggregate gate/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /reject an item accepted by at least one applicable entity/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /first selects the applicable entities and evaluates their constraints/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /explicit system-wide invariant/);
});

test("prompt preserves value metadata on alternate paths", () => {
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /optimized, vectorized, cached, or specialized paths must preserve the generic path's observable input semantics/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /separates a value from validity, presence, or tombstone metadata/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /reads the value alone when doing so can accept, retain, or count an invalid item/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /input is statically non-nullable/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /earlier step removes invalid items/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /evaluates the value together with its metadata/);
});

test("prompt accounts for actual pagination progress", () => {
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /advance by actual consumption unless the changed code establishes that every non-final page is full/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /server can return a short non-final page or clamps the requested size/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /next request can skip unseen records/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /follows an opaque server cursor/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /advances by the returned item count/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /fixed-size byte or block ranges/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Combine sibling occurrences into one finding/);
});

test("prompt requires material cost and proven independence for cheap rejections", () => {
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /materially expensive resolution, fetch, or allocation that runs before an inexpensive rejection/,
  );
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /proves the rejecting predicate is independent of both the operation's result and its effects/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /cite both the expensive call and the cheap predicate/);
  assert.match(
    ENGINEERING_REVIEW_PROMPT,
    /repeated materially expensive retrieval of the same derived data/,
  );
  assert.match(ENGINEERING_REVIEW_PROMPT, /no intervening mutation or invalidation/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /required canonicalization or side effects/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /either cost or independence is merely assumed/);
});

test("model schema is strict and avoids provider-specific constraint keywords", async () => {
  const text = await readFile(
    new URL("../schemas/engineering-review.model.v1.schema.json", import.meta.url),
    "utf8",
  );
  const schema = JSON.parse(text);

  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, [
    "schemaVersion",
    "overall",
    "observations",
    "strengths",
  ]);
  assert.doesNotMatch(text, /"minLength"|"maxLength"|"minItems"|"maxItems"/);
  assert.doesNotMatch(text, /"\$ref"|\$defs/);
  assert.match(text, /"citationId"/);
  assert.doesNotMatch(text, /"sourceId"|"quote"/);
});

test("model request delegates bounded repository retrieval to the SDK", () => {
  const request = buildModelReviewRequest(null);
  const input = request.input as Record<string, unknown>;

  assert.equal("sources" in input, false);
  assert.equal(request.budget?.maximumOutputTokens, 12_000);
  assert.equal(request.budget?.timeoutMs, 300_000);
  assert.deepEqual(request.tools?.repository?.include, [
    "*.go",
    "**/*.go",
    "*.ts",
    "**/*.ts",
    "*.tsx",
    "**/*.tsx",
    "*.js",
    "**/*.js",
    "*.jsx",
    "**/*.jsx",
    "*.py",
    "**/*.py",
    "*.rs",
    "**/*.rs",
    "*.java",
    "**/*.java",
    "*.cs",
    "**/*.cs",
    "*.kt",
    "**/*.kt",
    "*.kts",
    "**/*.kts",
  ]);
  assert.equal(request.tools?.repository?.maxRounds, 6);
  assert.equal(request.tools?.repository?.maxToolCalls, 24);
  assert.equal(request.tools?.repository?.maxTotalBytes, 192_000);
});
