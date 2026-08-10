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
