#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs";
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
  console.error(`Error: ${e.message}`);
  process.exit(1);
}

const registryById = new Map(registry.map(a => [a.id, a]));

let fixed = 0;
const corrected = [];

// Fix entries that have licensed-placeholder status pointing to nonexistent packages/assets/src paths
for (const entry of manifest.entries) {
  // Only fix entries marked as licensed-placeholder (these were marked because files were missing)
  if (entry.currentStatus !== "licensed-placeholder") continue;
  if (!entry.currentSource || !entry.currentSource.startsWith("packages/assets/src/")) continue;
  if (!entry.currentAssetId || !registryById.has(entry.currentAssetId)) continue;

  const asset = registryById.get(entry.currentAssetId);
  if (!asset.sourceFile) continue;

  // Skip procedural/component/composite assets
  if (asset.sourceFile.startsWith("procedural://") ||
      asset.sourceFile.startsWith("component://") ||
      asset.sourceFile.startsWith("composite://") ||
      asset.sourceFile.startsWith("http")) {
    continue;
  }

  // Runtime path is in apps/client3d/dist/models/
  const runtimePath = `apps/client3d/dist/models/${asset.sourceFile}`;
  const fullRuntimePath = resolve(__dirname, "..", "..", runtimePath);

  if (existsSync(fullRuntimePath)) {
    // File exists at runtime path!
    entry.currentSource = runtimePath;
    entry.currentSourceCanonical = `packages/assets/src/${asset.sourceFile}`; // Record canonical source
    entry.currentStatus = "approved-existing"; // Now valid - files actually exist!
    fixed++;
    corrected.push(`${entry.id}`);
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`\n✅ Fixed ${fixed} asset paths to runtime locations\n`);
if (corrected.length > 0) {
  console.log("Corrected paths:");
  corrected.slice(0, 10).forEach(c => console.log(`  ${c}`));
  if (corrected.length > 10) {
    console.log(`  ... and ${corrected.length - 10} more`);
  }
}

console.log(`\nPath mapping: packages/assets/src/{pack}/ → apps/client3d/dist/models/{pack}/`);
console.log(`Canonical source field records original location`);
