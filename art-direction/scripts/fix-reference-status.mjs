#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const manifestPath = resolve(__dirname, "..", "visual-production-manifest.json");

let manifest;

try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  console.error("Failed to load manifest:", e.message);
  process.exit(1);
}

let fixed = 0;

for (const entry of manifest.entries) {
  // If status is "reference-approved" but no boardSection, change to "awaiting-reference"
  if (entry.status === "reference-approved" && !entry.boardSection) {
    entry.status = "awaiting-reference";
    fixed++;
  }

  // If status is "awaiting-reference" and has boardSection, change to "reference-approved"
  if (entry.status === "awaiting-reference" && entry.boardSection) {
    entry.status = "reference-approved";
    fixed++;
  }

  // If currently missing or needs-audit but has currentAssetId from registry, mark as approved-existing
  if ((entry.currentStatus === "missing" || entry.currentStatus === "needs-audit") &&
      entry.currentAssetId &&
      entry.currentAssetId !== "player.adventurer" &&  // skip generic player character
      !entry.currentSource?.includes("procedural") &&
      !entry.currentSource?.includes("component")) {
    entry.currentStatus = "approved-existing";
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`\n✅ Fixed reference/approval status`);
console.log(`   Entries updated: ${fixed}`);
