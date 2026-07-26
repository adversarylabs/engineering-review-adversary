import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ENGINEERING_REVIEW_PROMPT } from "../src/prompt.ts";

test("prompt defines staff-level authority and specialist boundaries", () => {
  assert.match(ENGINEERING_REVIEW_PROMPT, /zero to four important observations/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Silence is better than speculative feedback/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /Do not become a linter/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /security, observability/);
  assert.match(ENGINEERING_REVIEW_PROMPT, /primaryConcern must be a short noun phrase/);
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
});
