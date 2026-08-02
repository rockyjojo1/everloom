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
  interface: ["png", "webp", "json"],
  animation: ["json"],
  material: ["json"],
  effect: ["json"],
  icon: ["json"],
  "npc-accessory": ["glb"],
  "ground-item": ["glb"]
};

let fixed = 0;

for (const entry of manifest.entries) {
  const validFormatsForCategory = validFormats[entry.category];
  if (!validFormatsForCategory) {
    console.warn(`Warning: unknown category "${entry.category}" for ${entry.id}`);
    continue;
  }

  const shouldBeFormat = entry.category === "interface" || entry.category === "icon" ? "json" :
                        entry.category === "animation" || entry.category === "vfx" || entry.category === "material" || entry.category === "effect" ? "json" :
                        "glb";

  if (entry.targetFormat !== shouldBeFormat) {
    entry.targetFormat = shouldBeFormat;
    fixed++;
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`\n✅ Fixed target formats`);
console.log(`   Entries updated: ${fixed}`);
