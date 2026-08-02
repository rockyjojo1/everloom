#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const manifestPath = resolve(__dirname, "..", "visual-production-manifest.json");
const catalogPath = resolve(__dirname, "..", "..", "packages", "assets", "src", "catalog.ts");

let manifest;

try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  console.error(`Failed to read manifest: ${e.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];

// Basic structure validation
if (!manifest.version || !manifest.entries) {
  errors.push("Manifest missing version or entries array");
}

// Check for duplicate IDs
const ids = new Set();
for (const entry of manifest.entries) {
  if (ids.has(entry.id)) {
    errors.push(`Duplicate ID: ${entry.id}`);
  }
  ids.add(entry.id);
}

// Load semantic asset IDs from catalog
const catalogContent = readFileSync(catalogPath, "utf8");
const catalogIds = new Set();
const catalogRegex = /['"]id['"]\s*:\s*['"]([^'"]+)['"]/g;
let match;
while ((match = catalogRegex.exec(catalogContent)) !== null) {
  catalogIds.add(match[1]);
}

// Per-entry validation
for (const entry of manifest.entries) {
  // Check required fields are present
  if (!entry.acceptanceCriteria || entry.acceptanceCriteria.length === 0) {
    if (entry.productionPriority === "vertical-slice") {
      errors.push(`Entry ${entry.id}: vertical-slice lacks acceptance criteria`);
    }
  }

  // Check approved-existing has license
  if (entry.currentStatus === "approved-existing" && !entry.currentLicense) {
    errors.push(`Entry ${entry.id}: approved-existing lacks license`);
  }

  // Check claimed asset IDs exist in catalog
  if (entry.currentAssetId && !catalogIds.has(entry.currentAssetId)) {
    errors.push(`Entry ${entry.id}: currentAssetId "${entry.currentAssetId}" not found in asset catalog`);
  }

  // Check reference sheets don't point to master PNG
  if (entry.boardSection && entry.currentSource === "everloom-00-master-art-bible.png") {
    errors.push(`Entry ${entry.id}: must use dedicated reference sheet, not master PNG`);
  }

  // Check reference-approved entries have sheet path
  if (entry.status === "reference-approved" && !entry.currentSource?.includes("reference-sheets/")) {
    warnings.push(`Entry ${entry.id}: status is reference-approved but no reference-sheet path found`);
  }

  // Check source files exist
  if (entry.currentSource && !entry.currentSource.startsWith("http") && !entry.currentSource.includes("placeholder")) {
    const srcPath = resolve(__dirname, "..", "..", entry.currentSource);
    if (!existsSync(srcPath) && !entry.currentSource.includes("*")) {
      warnings.push(`Entry ${entry.id}: source file not found: ${entry.currentSource}`);
    }
  }

  // Warn about unknown license
  if (entry.currentLicense && !["CC0", "CC-BY", "CC-BY-SA", "MIT", "OFL"].some(l => entry.currentLicense.includes(l))) {
    if (entry.currentLicense !== "unknown") {
      warnings.push(`Entry ${entry.id}: unknown license type: ${entry.currentLicense}`);
    }
  }

  // Warn about unconfirmed scale
  if (entry.scaleReference?.authority === "unconfirmed") {
    warnings.push(`Entry ${entry.id}: scale is unconfirmed`);
  }

  // Warn about missing dedicated reference sheet
  if (entry.productionPriority === "vertical-slice" && entry.status === "awaiting-reference") {
    warnings.push(`Entry ${entry.id}: vertical-slice awaiting reference sheet`);
  }

  // Warn about placeholder still in use
  if (entry.currentStatus === "placeholder" || entry.currentStatus === "procedural-placeholder") {
    warnings.push(`Entry ${entry.id}: still using placeholder asset`);
  }

  // Check for Windows temp paths
  if (entry.currentSource?.includes("\\Temp\\") || entry.currentSource?.includes("AppData")) {
    errors.push(`Entry ${entry.id}: contains Windows temp path: ${entry.currentSource}`);
  }

  // Check for RuneScape/Jagex/RuneLite asset sources
  if (entry.currentSource?.match(/runelite|jagex|osrs|runescape/i) || entry.gameReferences?.some(ref => ref.match(/runelite|jagex|osrs/i))) {
    errors.push(`Entry ${entry.id}: contains RuneScape/Jagex/RuneLite assets`);
  }

  // Check target format matches category
  const validFormats = {
    character: ["glb"],
    equipment: ["glb"],
    creature: ["glb"],
    architecture: ["glb"],
    landmark: ["glb"],
    resource: ["glb"],
    terrain: ["json"],
    vegetation: ["glb"],
    prop: ["glb"],
    vfx: ["json"],
    interface: ["png", "webp"],
    animation: ["json"],
    material: ["json"]
  };

  if (entry.targetFormat && validFormats[entry.category]?.length > 0) {
    if (!validFormats[entry.category].includes(entry.targetFormat)) {
      errors.push(`Entry ${entry.id}: targetFormat ${entry.targetFormat} invalid for category ${entry.category}`);
    }
  }
}

// Count statistics
const stats = {
  total: manifest.entries.length,
  byCategory: {},
  byPriority: {},
  byStatus: {}
};

for (const entry of manifest.entries) {
  stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
  stats.byPriority[entry.productionPriority] = (stats.byPriority[entry.productionPriority] || 0) + 1;
  stats.byStatus[entry.currentStatus] = (stats.byStatus[entry.currentStatus] || 0) + 1;
}

// Print summary
console.log("\n=== Visual Production Manifest Validation ===\n");
console.log(`Total entries: ${stats.total}`);
console.log(`\nBy category:`);
Object.entries(stats.byCategory).sort().forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});
console.log(`\nBy priority:`);
Object.entries(stats.byPriority).sort().forEach(([pri, count]) => {
  console.log(`  ${pri}: ${count}`);
});
console.log(`\nBy current status:`);
Object.entries(stats.byStatus).sort().forEach(([stat, count]) => {
  console.log(`  ${stat}: ${count}`);
});

if (errors.length > 0) {
  console.log(`\n❌ ERRORS (${errors.length}):`);
  errors.forEach(err => console.log(`  - ${err}`));
}

if (warnings.length > 0) {
  console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
  warnings.forEach(warn => console.log(`  - ${warn}`));
}

if (errors.length === 0 && warnings.length === 0) {
  console.log("\n✅ Manifest valid with no errors or warnings.");
}

process.exit(errors.length > 0 ? 1 : 0);
