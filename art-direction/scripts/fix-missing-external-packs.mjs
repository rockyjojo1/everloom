#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const manifestPath = resolve(__dirname, "..", "visual-production-manifest.json");

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}

let fixed = 0;
const blockers = [];

// Fix entries that claim approved-existing for missing external pack files
for (const entry of manifest.entries) {
  if (entry.currentStatus !== "approved-existing") continue;
  if (!entry.currentSource) continue;
  if (entry.currentSource.startsWith("http") || entry.currentSource.startsWith("procedural://") || entry.currentSource.startsWith("component://")) continue;

  // Check if file exists
  const fullPath = resolve(__dirname, "..", "..", entry.currentSource);
  if (!existsSync(fullPath)) {
    // This is a blocker - file is missing
    if (entry.currentSource.includes("kaykit-") || entry.currentSource.includes("kenney-")) {
      blockers.push(`${entry.id}: missing external pack file ${entry.currentSource}`);

      // Change status to licensed-placeholder (truth: it's not approved-existing if it doesn't exist)
      if (entry.currentStatus === "approved-existing") {
        entry.currentStatus = "licensed-placeholder";
        fixed++;
      }
    }
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`\n✅ Fixed missing external pack entries`);
console.log(`   Status updates: ${fixed}`);
if (blockers.length > 0) {
  console.log(`\n⚠️  BLOCKERS - Missing external pack files (${blockers.length}):`);
  blockers.forEach(b => console.log(`   - ${b}`));
}
