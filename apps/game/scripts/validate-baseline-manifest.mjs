#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const manifestPath = resolve(__dirname, "..", "..", "artifacts", "meadowrest-visual-baseline-gate0", "shot-manifest.json");
const screenshotsDir = resolve(__dirname, "..", "..", "artifacts", "meadowrest-visual-baseline-gate0");

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  console.error(`Failed to read shot-manifest.json: ${e.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];

// Validate manifest structure
if (!manifest.shots || !Array.isArray(manifest.shots)) {
  errors.push("Missing or invalid shots array");
  process.exit(1);
}

if (manifest.shots.length !== 10) {
  errors.push(`Expected 10 shots, found ${manifest.shots.length}`);
}

// Validate each shot entry
manifest.shots.forEach((shot, idx) => {
  if (!shot.filename) {
    errors.push(`Shot ${idx + 1}: missing filename`);
    return;
  }

  const shotPath = resolve(screenshotsDir, shot.filename);

  // Check if file exists
  const exists = existsSync(shotPath);
  if (!exists && shot.captured) {
    errors.push(`Shot ${shot.shotNumber}: file marked as captured but not found: ${shot.filename}`);
  } else if (!exists) {
    warnings.push(`Shot ${shot.shotNumber}: baseline image not yet captured`);
  }

  // Validate required fields
  if (!shot.viewport || !shot.viewport.width || !shot.viewport.height) {
    errors.push(`Shot ${shot.shotNumber}: missing or invalid viewport`);
  }

  if (!shot.project) {
    errors.push(`Shot ${shot.shotNumber}: missing project (desktop or landscape-mobile)`);
  }
});

// Print summary
console.log("\n=== Visual Baseline Manifest Validation ===\n");
console.log(`Total shots: ${manifest.shots.length}`);
console.log(`Captured: ${manifest.shots.filter((s) => s.captured).length}`);
console.log(`Pending: ${manifest.shots.filter((s) => !s.captured).length}`);

if (errors.length > 0) {
  console.log(`\n❌ ERRORS (${errors.length}):`);
  errors.forEach((err) => console.log(`  - ${err}`));
}

if (warnings.length > 0) {
  console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
  warnings.forEach((warn) => console.log(`  - ${warn}`));
}

if (errors.length === 0) {
  if (warnings.length === 0) {
    console.log("\n✅ Baseline manifest valid.");
  } else {
    console.log("\n✅ Baseline manifest valid (with warnings).");
  }
}

process.exit(errors.length > 0 ? 1 : 0);
