#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const manifestPath = resolve(__dirname, "..", "visual-production-manifest.json");
const registryPath = resolve(__dirname, "..", "..", "packages", "assets", "src", "registry.json");

let manifest, registry;

try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  registry = JSON.parse(readFileSync(registryPath, "utf8"));
} catch (e) {
  console.error(`Error loading files: ${e.message}`);
  process.exit(1);
}

const registryById = new Map(registry.map(a => [a.id, a]));

function determineRole(entry) {
  // runtime-asset: has currentAssetId that exists in registry, is canonical
  if (entry.currentAssetId && registryById.has(entry.currentAssetId)) {
    // Check if this is canonical (first entry for this asset)
    const isCanonical = !manifest.entries.some(e =>
      e !== entry &&
      e.currentAssetId === entry.currentAssetId &&
      (e.role === "runtime-asset" || !e.role)
    );
    if (isCanonical) return "runtime-asset";
  }

  // presentation-variant: same asset, different presentation
  if (entry.currentAssetId && entry.id.includes(".appearance")) {
    return "presentation-variant";
  }

  // procedural-system: procedural:// URI
  if (entry.currentSource && entry.currentSource.startsWith("procedural://")) {
    return "procedural-system";
  }

  // composite: composite:// URI
  if (entry.currentSource && entry.currentSource.startsWith("composite://")) {
    return "composite";
  }

  // component: component:// URI
  if (entry.currentSource && entry.currentSource.startsWith("component://")) {
    return "procedural-system";
  }

  // production-concept: no runtime asset, awaiting production
  if (!entry.currentAssetId || entry.currentStatus === "missing") {
    return "production-concept";
  }

  // default
  return "runtime-asset";
}

let updated = 0;
const canonicalAssets = new Map();

// First pass: identify canonical mappings
for (const entry of manifest.entries) {
  if (entry.role && entry.role !== "runtime-asset") continue;

  if (entry.currentAssetId && registryById.has(entry.currentAssetId)) {
    if (!canonicalAssets.has(entry.currentAssetId)) {
      canonicalAssets.set(entry.currentAssetId, entry.id);
    }
  }
}

// Second pass: add roles and validate
const duplicateReferences = new Map();
for (const entry of manifest.entries) {
  // Determine role
  let role = determineRole(entry);

  // Track duplicates
  if (entry.currentAssetId && registryById.has(entry.currentAssetId)) {
    if (!duplicateReferences.has(entry.currentAssetId)) {
      duplicateReferences.set(entry.currentAssetId, []);
    }
    duplicateReferences.get(entry.currentAssetId).push({
      id: entry.id,
      role
    });
  }

  // Set or update role
  if (!entry.role || entry.role !== role) {
    entry.role = role;
    updated++;
  }

  // Add canonicalMapping for non-canonical reuses
  if (role === "presentation-variant" || (entry.currentAssetId && entry.id !== canonicalAssets.get(entry.currentAssetId))) {
    if (entry.currentAssetId) {
      entry.canonicalMapping = {
        runtimeAssetId: entry.currentAssetId,
        canonicalEntryId: canonicalAssets.get(entry.currentAssetId),
        reason: role === "presentation-variant" ? "appearance variant of same character" : "shared asset - secondary reference"
      };
    }
  }
}

// Write updated manifest
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`\n✅ Manifest roles repair complete`);
console.log(`   Entries updated: ${updated}`);

// Report duplicates that need explicit resolution
let duplicates = 0;
for (const [assetId, entries] of duplicateReferences) {
  if (entries.length > 1) {
    duplicates += entries.length - 1;
    console.log(`   Asset ${assetId} used by: ${entries.map(e => e.id).join(", ")}`);
  }
}

if (duplicates > 0) {
  console.log(`\n⚠️  ${duplicates} duplicate asset reuses (check canonicalMapping)`);
}

process.exit(0);
