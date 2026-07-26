import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseAdversaryManifest } from "@adversarylabs/sdk";
import { isReviewableSource, SOURCE_PATTERNS } from "../src/discover.ts";

test("declares language-neutral automatic detection in the canonical manifest", async () => {
  const source = await readFile(new URL("../adversary.yaml", import.meta.url), "utf8");
  const manifest = parseAdversaryManifest(source);

  assert.equal(manifest.triggers?.manual, true);
  assert.deepEqual(manifest.detection?.files, manifest.triggers?.files_changed);
  assert.deepEqual(manifest.detection?.files, [...SOURCE_PATTERNS]);
  assert.equal(manifest.detection?.entrypoint, undefined);
  assert.equal(manifest.permissions?.model, true);
  assert.equal(manifest.permissions?.network, false);
});

test("source detection includes supported languages and excludes generated dependencies", () => {
  for (const path of [
    "main.go",
    "src/app.ts",
    "lib/tool.py",
    "src/main.rs",
    "app/Main.java",
    "src/App.cs",
    "src/App.kt",
  ]) {
    assert.equal(isReviewableSource(path), true, path);
  }

  for (const path of [
    "Dockerfile",
    ".github/workflows/ci.yml",
    "node_modules/pkg/index.ts",
    "vendor/example/main.go",
    "dist/app.js",
    "fixtures/risky/src/main.rs",
    "testdata/incomplete/main.go",
    "src/generated.g.cs",
  ]) {
    assert.equal(isReviewableSource(path), false, path);
  }
});
