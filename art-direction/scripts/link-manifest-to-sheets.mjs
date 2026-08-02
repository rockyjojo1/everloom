#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const manifestPath = resolve(__dirname, "..", "visual-production-manifest.json");

let manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// Map manifest IDs to reference sheet sections (01-20)
// Approved sections (01-14, 16-20): entries can reference these as production direction
// Section 15 (needs-revision): entries must NOT reference this as approved production direction
const mapping = {
  // Section 01: Core gameplay composition
  "player.base-body": "01",
  "equipment.worn-hatchet": "01",
  "ground-item.worn-hatchet": "01",
  "npc.mara": "01",
  "architecture.loom-hall": "01",

  // Section 02: Player characters
  "player.appearance.meadow": "02",
  "player.appearance.ember": "02",
  "player.appearance.tide": "02",
  "player.appearance.dusk": "02",

  // Section 03: NPCs
  "animation.npc-mara-idle": "03",

  // Section 04: Creatures
  "enemy.skeleton-warrior": "04",

  // Section 05: Tools and weapons
  "animation.woodcutting": "05",

  // Section 07: Resource nodes
  "vegetation.tree-harvestable": "07",

  // Section 08: Architecture
  "architecture.cottage": "08",
  "architecture.fence-kit": "08",
  "architecture.village-gate": "08",

  // Section 09: Landmarks
  "prop.signpost": "09",
  "landmark.loom-motif": "09",

  // Section 10: Terrain and materials
  "terrain.grass-meadow": "10",
  "terrain.dirt-path": "10",
  "terrain.stone-rocky": "10",
  "terrain.water-shallow": "10",
  "terrain.river-deep": "10",

  // Section 11: Environmental props
  "prop.barrel": "11",
  "prop.crate": "11",
  "prop.woodpile": "11",
  "prop.banner-cloth": "11",

  // Section 12: Vegetation
  "vegetation.grass-tuft": "12",

  // Section 13: Animation contact sheet (direction only, not final animation data)
  // Animation entries reference this for pose guidance, not as production specs

  // Section 14: VFX
  "vfx.item-pickup-feedback": "14",
  "vfx.tree-impact": "14",

  // Section 15: Interface (NEEDS REVISION - do not mark entries as approved)
  // No entries should reference section 15 as approved production direction

  // Section 16: Inventory icons
  // Icon implementation is procedural, no direct manifest references

  // Section 17: Scale chart (relative-scale guidance)
  // All architecture entries can reference for provisional scale:
  "architecture.village-gate": "17",
  "architecture.fence-kit": "17",
  "terrain.dirt-path": "17",
  "terrain.water-shallow": "17",

  // Section 18: Do-and-do-not comparison (internal guardrail only)
  // No manifest entries reference this; it's a production guide

  // Section 19: Character modularity (supplementary direction for phase-three)
  // Future entries for phase-three character expansion

  // Section 20: Technical equipment production (supplementary technical direction)
  // Technical reference for equipment rigging, not a design specification
};

let updated = 0;
let skipped = 0;

for (const entry of manifest.entries) {
  if (mapping[entry.id]) {
    const section = mapping[entry.id];

    // Never mark section 15 entries as approved (it needs revision)
    if (section === "15") {
      if (entry.boardSection === "15") {
        delete entry.boardSection;
        skipped++;
      }
      continue;
    }

    // Set boardSection if not already set
    if (!entry.boardSection) {
      entry.boardSection = section;
      updated++;
    }
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`✅ Linked ${updated} manifest entries to reference sheets 01-20`);
if (skipped > 0) {
  console.log(`⚠️  Removed ${skipped} references to section 15 (needs-revision)`);
}
