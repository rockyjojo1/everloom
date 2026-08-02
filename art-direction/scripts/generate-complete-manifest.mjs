#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

// Load registry and existing manifest
const registryPath = resolve(__dirname, "..", "..", "packages", "assets", "src", "registry.json");
const zonesPath = resolve(__dirname, "..", "..", "packages", "content", "src", "data", "zones.json");
const manifestPath = resolve(__dirname, "..", "visual-production-manifest.json");
const currentManifestPath = resolve(__dirname, "..", "visual-production-manifest.json");

let registry, zones, currentManifest;

try {
  registry = JSON.parse(readFileSync(registryPath, "utf8"));
  zones = JSON.parse(readFileSync(zonesPath, "utf8"));
  currentManifest = JSON.parse(readFileSync(currentManifestPath, "utf8"));
} catch (e) {
  console.error("Failed to load data files:", e.message);
  process.exit(1);
}

const meadowrest = zones[0];

// Helper: map asset ID to category for manifest classification
function getManifestCategory(registryId) {
  const asset = registry.find(a => a.id === registryId);
  if (!asset) return "unknown";

  const typeMap = {
    character: "character",
    tree: "vegetation",
    foliage: "vegetation",
    rock: "landmark",
    landmark: "landmark",
    building: "architecture",
    prop: "prop",
    facility: "prop",
    structure: "architecture",
    "ground-item": "prop",
    effect: "vfx",
    icon: "interface",
    armor: "equipment",
    "npc-accessory": "prop"
  };

  return typeMap[asset.category] || "prop";
}

// Collect all unique asset IDs used in Meadowrest
const usedAssets = new Set();
const interactablesByAsset = new Map();

// From scenery
for (const piece of meadowrest.scenery) {
  usedAssets.add(piece.assetId);
}

// From interactables
for (const interactable of meadowrest.interactables) {
  usedAssets.add(interactable.assetId);
  if (!interactablesByAsset.has(interactable.assetId)) {
    interactablesByAsset.set(interactable.assetId, []);
  }
  interactablesByAsset.get(interactable.assetId).push(interactable);
}

// Build new manifest entries
const newEntries = [];
const existingIds = new Set(currentManifest.entries.map(e => e.id));

// Function to create manifest entry from registry asset
function createEntry(registryId) {
  const asset = registry.find(a => a.id === registryId);
  if (!asset) return null;

  // Skip if already in manifest
  if (existingIds.has(registryId)) {
    return null;
  }

  const category = getManifestCategory(registryId);
  const interactables = interactablesByAsset.get(registryId) || [];

  let currentStatus = "needs-audit";
  let productionPriority = "later";
  let currentSource = null;
  let currentLicense = null;

  // Determine current status based on asset source
  if (asset.sourceFile.startsWith("procedural://")) {
    currentStatus = "procedural-placeholder";
    currentSource = asset.sourceFile;
    currentLicense = "CC-0";
    productionPriority = "phase-two";
  } else if (asset.sourceFile.startsWith("component://")) {
    currentStatus = "approved-existing";
    currentSource = asset.sourceFile;
    currentLicense = "Project original";
    productionPriority = "phase-two";
  } else if (asset.sourceFile.startsWith("composite://")) {
    currentStatus = "licensed-placeholder";
    currentSource = asset.sourceFile;
    currentLicense = asset.licence;
    productionPriority = "phase-two";
  } else {
    currentStatus = "approved-existing";
    currentSource = `packages/assets/src/${asset.sourceFile}`;
    currentLicense = asset.licence;
    productionPriority = interactables.length > 0 ? "vertical-slice" : "phase-two";
  }

  return {
    id: registryId,
    displayName: asset.notes.split(" ")[0] === "Original" ? asset.id : asset.notes.substring(0, 50),
    category,
    gameReferences: [
      "packages/assets/src/registry.json",
      "packages/content/src/data/zones.json"
    ].concat(interactables.length > 0 ? ["packages/content/src/index.ts"] : []),
    boardSection: null,
    currentAssetId: registryId,
    currentSource,
    currentLicense,
    currentStatus,
    productionPriority,
    requiredViews: ["gameplay-three-quarter"],
    requiredStates: ["default"],
    scaleReference: {
      heightOrSize: asset.scale,
      unit: "world-unit",
      authority: asset.sourceFile.startsWith("procedural://") ? "unconfirmed" : "source-declared"
    },
    rigRequirement: asset.category === "character" ? "humanoid" : "none",
    attachmentPoints: [],
    collisionRequirement: asset.interactionType ? asset.interactionType : "none",
    lodRequirement: "single",
    targetFormat: asset.sourceFile.includes("json") ? "json" : "glb",
    productionNotes: [
      asset.notes,
      `Pack: ${asset.pack}`,
      interactables.length > 0 ? `Used by ${interactables.length} interactable(s) in Meadowrest` : null
    ].filter(Boolean),
    acceptanceCriteria: interactables.length > 0 ? [
      "Correct scale in Meadowrest",
      "Visible and readable",
      "Matches reference sheet or placeholder specification"
    ] : [],
    status: "awaiting-reference"
  };
}

// Add entries for all registry assets
for (const asset of registry) {
  if (!existingIds.has(asset.id)) {
    const entry = createEntry(asset.id);
    if (entry) {
      newEntries.push(entry);
    }
  }
}

// Combine with existing entries
const allEntries = [...currentManifest.entries, ...newEntries];

// Write updated manifest
const updatedManifest = {
  version: "1.0.0",
  generatedAt: new Date().toISOString(),
  entries: allEntries.sort((a, b) => a.id.localeCompare(b.id))
};

writeFileSync(manifestPath, JSON.stringify(updatedManifest, null, 2) + "\n");

console.log(`\n✅ Manifest expanded from ${currentManifest.entries.length} to ${updatedManifest.entries.length} entries`);
console.log(`   Added ${newEntries.length} new entries covering all registry assets`);
console.log(`   Total unique assets in Meadowrest: ${usedAssets.size}`);
console.log(`   Interactable assets: ${interactablesByAsset.size}`);
