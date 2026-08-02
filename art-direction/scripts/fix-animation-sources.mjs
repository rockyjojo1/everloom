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

// Map of animation entries to their correct source paths
const animationSources = {
  "animation.npc-mara-idle": {
    source: "packages/assets/src/kaykit-adventurers/Character.glb",
    license: "CC0-1.0"
  },
  "animation.player-idle": {
    source: "packages/assets/src/kaykit-adventurers/Character.glb",
    license: "CC0-1.0"
  },
  "animation.player-walk": {
    source: "packages/assets/src/kaykit-adventurers/Character.glb",
    license: "CC0-1.0"
  },
  "animation.woodcutting": {
    source: "packages/assets/src/kaykit-adventurers/Character.glb",
    license: "CC0-1.0"
  }
};

for (const entry of manifest.entries) {
  if (animationSources[entry.id]) {
    const { source, license } = animationSources[entry.id];
    if (entry.currentSource !== source) {
      entry.currentSource = source;
      fixed++;
    }
    if (entry.currentLicense !== license) {
      entry.currentLicense = license;
      fixed++;
    }
  } else if (entry.category === "animation" && entry.currentSource) {
    // Fix other animation prose descriptions
    if (entry.currentSource.includes("Custom") || entry.currentSource === "KayKit Adventurers" || !entry.currentSource.startsWith("packages/")) {
      // Try to infer from context
      if (entry.currentSource.includes("KayKit") || entry.currentAssetId === "player.adventurer" || entry.currentAssetId === "enemy.skeleton-warrior") {
        entry.currentSource = "packages/assets/src/kaykit-adventurers/Character.glb";
        entry.currentLicense = "CC0-1.0";
        fixed++;
      }
    }
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`\n✅ Fixed animation sources`);
console.log(`   Entries updated: ${fixed}`);
