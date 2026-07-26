#!/usr/bin/env node

import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Adversary } from "@adversarylabs/sdk";
import { reviewEngineeringChange } from "./review.js";

export function createApp(): Adversary {
  const app = new Adversary({
    name: "engineering-review",
    review: {
      maximumFindings: 4,
      minimumConfidence: "medium",
    },
  });

  app.rule("engineering-review.review", async (ctx) => {
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
