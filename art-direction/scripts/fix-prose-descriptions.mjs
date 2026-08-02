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

const proser = [
  { id: "vegetation.grass-tuft", source: "procedural://vegetation/grass-tuft", license: "CC-0" },
  { id: "vegetation.tree-harvestable", source: "procedural://vegetation/tree-harvestable", license: "CC-0" },
  { id: "vfx.fishing-ripples", source: "procedural://vfx/fishing-ripples", license: "CC-0" },
  { id: "vfx.item-pickup-feedback", source: "procedural://vfx/item-pickup", license: "CC-0" },
  { id: "vfx.tree-impact", source: "procedural://vfx/tree-impact", license: "CC-0" }
];

let fixed = 0;

for (const entry of manifest.entries) {
  const prose = proser.find(p => p.id === entry.id);
  if (prose && entry.currentSource && !entry.currentSource.startsWith("procedural://")) {
    entry.currentSource = prose.source;
    entry.currentLicense = prose.license;
    entry.currentStatus = "procedural-placeholder";
    entry.status = "awaiting-reference";  // procedural assets need reference sheet design
    fixed++;
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`\n✅ Fixed prose descriptions to procedural URIs`);
console.log(`   Entries updated: ${fixed}`);
