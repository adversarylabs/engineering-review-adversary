import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseAdversaryManifest } from "@adversarylabs/sdk";
import {
  isReviewableSource,
  SOURCE_PATTERNS,
  TRIGGER_PATTERNS,
} from "../src/discover.ts";

test("declares language-neutral automatic detection in the canonical manifest", async () => {
  const source = await readFile(new URL("../adversary.yaml", import.meta.url), "utf8");
  const manifest = parseAdversaryManifest(source);

  assert.equal(manifest.triggers?.manual, true);
  assert.deepEqual(manifest.detection?.files, manifest.triggers?.files_changed);
  assert.deepEqual(manifest.detection?.files, [...TRIGGER_PATTERNS]);
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
    "test/integration/suites/slurm-x509/00-setup",
    "test/integration/suites/slurm-x509/01-start-server",
    "test/integration/suites/slurm-x509/02-bootstrap-agent",
    "test/integration/suites/slurm-x509/03-start-agent",
    "test/integration/suites/slurm-x509/04-submit-job",
    "test/integration/suites/slurm-x509/05-create-entry",
    "test/integration/suites/slurm-x509/06-verify-fetch",
    "test/integration/suites/slurm-x509/teardown",
    "Makefile",
    "README.md",
    "Dockerfile",
    ".github/workflows/ci.yml",
  ]) {
    assert.equal(isReviewableSource(path), true, path);
  }

  for (const path of [
    "test/unit/00-setup",
    "test/integration/suites/example/01-setup",
    "test/integration/suites/example/07-cleanup",
    "test/integration/suites/example/99-teardown",
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
