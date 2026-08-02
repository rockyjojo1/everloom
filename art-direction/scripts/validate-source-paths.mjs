#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const manifestPath = resolve(__dirname, "..", "visual-production-manifest.json");

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  console.error(`Error loading manifest: ${e.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];

// Validate every approved-existing entry
for (const entry of manifest.entries) {
  if (entry.currentStatus !== "approved-existing") continue;

  if (!entry.currentSource) {
    errors.push(`${entry.id}: approved-existing with no source path`);
    continue;
  }

  // Skip HTTP URLs
  if (entry.currentSource.startsWith("http")) continue;

  // Procedural/component/composite URIs must have valid syntax
  if (entry.currentSource.startsWith("procedural://") ||
      entry.currentSource.startsWith("component://") ||
      entry.currentSource.startsWith("composite://")) {
    // URI must have format: scheme://path
    const parts = entry.currentSource.split("://");
    if (parts.length !== 2 || !parts[1]) {
      errors.push(`${entry.id}: malformed URI: ${entry.currentSource}`);
    }
    continue;
  }

  // File-backed paths must exist
  const fullPath = resolve(__dirname, "..", "..", entry.currentSource);
  if (!existsSync(fullPath)) {
    // DO NOT suppress missing external pack files - this is an error
    if (entry.currentSource.includes("kaykit-") || entry.currentSource.includes("kenney-")) {
      errors.push(`${entry.id}: external pack file not found: ${entry.currentSource}`);
    } else {
      errors.push(`${entry.id}: file not found: ${entry.currentSource}`);
    }
  }
}

// Validate procedural-placeholder entries have proper URIs
for (const entry of manifest.entries) {
  if (entry.currentStatus !== "procedural-placeholder") continue;

  if (!entry.currentSource || !entry.currentSource.startsWith("procedural://")) {
    errors.push(`${entry.id}: procedural-placeholder missing procedural:// URI`);
  }
}

// Print summary
console.log("\n=== Source Path Validation ===\n");

if (errors.length > 0) {
  console.log(`❌ ERRORS (${errors.length}):`);
  errors.forEach(e => console.log(`  - ${e}`));
  process.exit(1);
}

if (warnings.length > 0) {
  console.log(`⚠️  WARNINGS (${warnings.length}):`);
  warnings.forEach(w => console.log(`  - ${w}`));
}

const approvedCount = manifest.entries.filter(e => e.currentStatus === "approved-existing").length;
console.log(`✅ All ${approvedCount} approved-existing entries have valid source paths`);
process.exit(0);
