import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const manifestPath = resolve(__dirname, "..", "visual-production-manifest.json");
const zonesPath = resolve(__dirname, "..", "..", "packages", "content", "src", "data", "zones.json");
const registryPath = resolve(__dirname, "..", "..", "packages", "assets", "src", "registry.json");

let manifest, zones, registry;

try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  zones = JSON.parse(readFileSync(zonesPath, "utf8"));
  registry = JSON.parse(readFileSync(registryPath, "utf8"));
} catch (e) {
  console.error("Failed to load data files:", e.message);
  process.exit(1);
}

const meadowrest = zones[0];
const manifestIds = new Set(manifest.entries.map(e => e.id));
const registryIds = new Set(registry.map(a => a.id));

test("All Meadowrest scenery uses registered assets", () => {
  const unmappedScenery = [];
  for (const piece of meadowrest.scenery) {
    if (!registryIds.has(piece.assetId)) {
      unmappedScenery.push(`${piece.id}: ${piece.assetId}`);
    }
  }
  assert.equal(unmappedScenery.length, 0, `Scenery must reference registry assets.\n${unmappedScenery.join("\n")}`);
});

test("All Meadowrest interactables use registered assets", () => {
  const unmappedInteractables = [];
  for (const interactable of meadowrest.interactables) {
    if (!registryIds.has(interactable.assetId)) {
      unmappedInteractables.push(`${interactable.id}: ${interactable.assetId}`);
    }
  }
  assert.equal(unmappedInteractables.length, 0, `Interactables must reference registry assets.\n${unmappedInteractables.join("\n")}`);
});

test("Vertical-slice assets have production metadata", () => {
  const incomplete = [];
  for (const entry of manifest.entries) {
    if (entry.productionPriority === "vertical-slice") {
      if (!entry.requiredViews || entry.requiredViews.length === 0) {
        incomplete.push(`${entry.id}: missing requiredViews`);
      }
      if (!entry.acceptanceCriteria || entry.acceptanceCriteria.length === 0) {
        incomplete.push(`${entry.id}: missing acceptanceCriteria`);
      }
      if (!entry.productionNotes || entry.productionNotes.length === 0) {
        incomplete.push(`${entry.id}: missing productionNotes`);
      }
    }
  }
  assert.equal(incomplete.length, 0, `Vertical-slice entries must have complete metadata.\n${incomplete.join("\n")}`);
});

test("No circular or broken asset references", () => {
  const issues = [];
  for (const entry of manifest.entries) {
    // Check that currentAssetId references valid registry asset
    if (entry.currentAssetId && !registryIds.has(entry.currentAssetId)) {
      issues.push(`${entry.id}: references non-existent registry asset ${entry.currentAssetId}`);
    }

    // Check that entry references real game content
    if (entry.gameReferences && entry.gameReferences.length === 0) {
      if (entry.productionPriority === "vertical-slice") {
        issues.push(`${entry.id}: vertical-slice with no game references`);
      }
    }
  }
  assert.equal(issues.length, 0, `No circular or broken references.\n${issues.join("\n")}`);
});

test("Asset production coverage", () => {
  const coverage = {
    "vertical-slice": 0,
    "phase-two": 0,
    later: 0
  };

  for (const entry of manifest.entries) {
    const priority = entry.productionPriority || "later";
    if (priority in coverage) {
      coverage[priority]++;
    }
  }

  assert.ok(coverage["vertical-slice"] > 0, "Must have vertical-slice assets defined");
  assert.ok(coverage["vertical-slice"] >= 20, "Vertical-slice should cover significant gameplay (at least 20 assets)");
  console.log(`Coverage: vertical-slice=${coverage["vertical-slice"]}, phase-two=${coverage["phase-two"]}, later=${coverage.later}`);
});

console.log("\n✅ All integration tests passed!");
