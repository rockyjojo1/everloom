#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

const registryPath = resolve(__dirname, "..", "..", "packages", "assets", "src", "registry.json");
const manifestPath = resolve(__dirname, "..", "visual-production-manifest.json");

let registry, manifest;

try {
  registry = JSON.parse(readFileSync(registryPath, "utf8"));
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  console.error("Failed to load files:", e.message);
  process.exit(1);
}

// Create lookup by ID
const registryById = new Map(registry.map(a => [a.id, a]));

let fixed = 0;
let licenseFixed = 0;

// Fix entries that reference registry assets
for (const entry of manifest.entries) {
  if (entry.currentAssetId && registryById.has(entry.currentAssetId)) {
    const asset = registryById.get(entry.currentAssetId);

    // Fix currentSource if it's a prose description, invalid path, or missing
    const isProse = entry.currentSource && (
      entry.currentSource.includes("Original") ||
      entry.currentSource.includes("Custom") ||
      entry.currentSource.includes("KayKit") ||
      entry.currentSource.includes("Kenney") ||
      entry.currentSource.includes("Procedural") ||
      entry.currentSource.includes("ShaderMaterial") ||
      entry.currentSource.includes("GLTF") ||
      entry.currentSource.includes("placeh") ||
      !entry.currentSource.startsWith("http") &&
      !entry.currentSource.startsWith("packages/") &&
      !entry.currentSource.startsWith("procedural://") &&
      !entry.currentSource.startsWith("component://") &&
      !entry.currentSource.startsWith("composite://")
    );

    if (!entry.currentSource || isProse) {
      const oldSource = entry.currentSource;
      if (asset.sourceFile.startsWith("procedural://") || asset.sourceFile.startsWith("component://") || asset.sourceFile.startsWith("composite://")) {
        entry.currentSource = asset.sourceFile;
      } else {
        entry.currentSource = `packages/assets/src/${asset.sourceFile}`;
      }
      if (oldSource !== entry.currentSource) {
        fixed++;
      }
    }

    // Fix license formatting
    if (entry.currentLicense) {
      const oldLicense = entry.currentLicense;
      if (entry.currentLicense === "CC-0" || entry.currentLicense === "CC0") {
        entry.currentLicense = "CC0-1.0";
        licenseFixed++;
      } else if (entry.currentLicense === "Original") {
        entry.currentLicense = "Project original";
        licenseFixed++;
      }
    }
  }
}

// Write fixed manifest
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`\n✅ Fixed manifest sources`);
console.log(`   Source paths updated: ${fixed}`);
console.log(`   License formats fixed: ${licenseFixed}`);
