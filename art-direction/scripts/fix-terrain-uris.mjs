#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const manifestPath = resolve(__dirname, "..", "visual-production-manifest.json");

let manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const fixes = {
  "terrain.dirt-path": { source: "procedural://terrain/dirt-path", license: "CC-0" },
  "terrain.grass-meadow": { source: "procedural://terrain/grass-meadow", license: "CC-0" },
  "terrain.river-deep": { source: "procedural://terrain/river-deep", license: "CC-0" },
  "terrain.water-shallow": { source: "procedural://terrain/water-shallow", license: "CC-0" },
  "terrain.stone-rocky": { source: "procedural://terrain/stone-rocky", license: "CC-0" }
};

let fixed = 0;
for (const entry of manifest.entries) {
  if (fixes[entry.id]) {
    const fix = fixes[entry.id];
    if (entry.currentSource !== fix.source) {
      entry.currentSource = fix.source;
      entry.currentLicense = fix.license;
      entry.currentStatus = "procedural-placeholder";
      fixed++;
    }
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Fixed ${fixed} terrain asset URIs`);
