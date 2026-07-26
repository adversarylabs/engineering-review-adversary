import assert from "node:assert/strict";
import test from "node:test";
import { TokenBucket } from "../src/token-bucket.js";

test("refills without exceeding capacity", () => {
  let time = 0;
  const bucket = new TokenBucket(2, 1, { now: () => time });
  assert.equal(bucket.take(2), true);
  assert.equal(bucket.take(), false);
  time = 1_000;
  assert.equal(bucket.take(), true);
  time = 10_000;
  assert.equal(bucket.take(2), true);
});

test("rejects invalid requests and backward clock movement", () => {
  let time = 1_000;
  const bucket = new TokenBucket(2, 1, { now: () => time });
  assert.equal(bucket.take(0), false);
  assert.equal(bucket.take(3), false);
  time = 500;
  assert.equal(bucket.take(2), true);
  assert.equal(bucket.take(), false);
});
