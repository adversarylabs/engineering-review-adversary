#!/usr/bin/env node

import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Adversary } from "@adversarylabs/sdk";
import { countReviewableSources } from "./discover.js";
import { reviewEngineeringChange } from "./review.js";

export function createApp(): Adversary {
  const app = new Adversary({
    name: "engineering-review",
    version: "0.0.36",
    review: {
      maximumFindings: 4,
      minimumConfidence: "medium",
    },
  });

  app.rule("engineering-review.review", async (ctx) => {
    ctx.summary.files_scanned = await countReviewableSources(ctx);
    await reviewEngineeringChange(ctx);
  });

  return app;
}

async function runIfDirect(): Promise<void> {
  if (
    process.argv[1] !== undefined &&
    (await realpath(process.argv[1])) === (await realpath(fileURLToPath(import.meta.url)))
  ) {
    await createApp().runFromEnvironment();
  }
}

void runIfDirect();
