#!/usr/bin/env node

import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

/**
 * Safe task generator for visual assets.
 * Generates structured task descriptions for creating assets.
 * Refuses unsafe IDs, blocked assets, and unscoped work.
 */

function loadJSON(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`Failed to load ${path}:`, e.message);
    process.exit(1);
  }
}

function isValidAssetId(id) {
  // Allow: category.descriptor[-variant]
  // Example: player.base-body, equipment.worn-hatchet, effect.fireball-projectile
  const pattern = /^[a-z-]+\.[a-z0-9-]+(-[a-z0-9-]+)?$/;
  return pattern.test(id);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const idIndex = args.indexOf("--asset-id");
  const formatIndex = args.indexOf("--format");

  return {
    assetId: idIndex >= 0 ? args[idIndex + 1] : null,
    format: formatIndex >= 0 ? args[formatIndex + 1] : "json",
  };
}

const manifest = loadJSON(resolve(__dirname, "..", "visual-production-manifest.json"));
const contracts = loadJSON(resolve(__dirname, "..", "production-contracts.json"));
const queue = loadJSON(resolve(__dirname, "..", "incoming-sheets-queue.json"));

const { assetId, format } = parseArgs();

// Validation: asset ID is required
if (!assetId) {
  console.error("Usage: node generate-asset-task.mjs --asset-id <id> [--format json|text]");
  process.exit(1);
}

// Validation: asset ID format
if (!isValidAssetId(assetId)) {
  console.error(`❌ Invalid asset ID format: ${assetId}`);
  console.error("   Format: category.descriptor[-variant]");
  console.error("   Example: player.base-body, equipment.worn-hatchet");
  process.exit(1);
}

// Validation: asset exists in manifest
const manifestEntry = manifest.entries.find((e) => e.id === assetId);
if (!manifestEntry) {
  console.error(`❌ Asset not found in manifest: ${assetId}`);
  process.exit(1);
}

// Validation: asset is not missing or needs-audit
if (manifestEntry.currentStatus === "missing") {
  console.error(`❌ BLOCKED: Asset is marked missing: ${assetId}`);
  console.error("   This asset must be scoped in contracts or incoming queue before work can proceed.");
  process.exit(1);
}

if (manifestEntry.currentStatus === "needs-audit") {
  console.error(`❌ BLOCKED: Asset needs audit before task generation: ${assetId}`);
  process.exit(1);
}

// Validation: asset must be in a contract (vertical-slice) or queue (phase-two/three)
let contract = null;
let queueEntry = null;

contract = contracts.contracts.find((c) => c.manifestId === assetId);
if (!contract) {
  // Check if in queue
  for (const q of queue.queue) {
    if (q.expectedEntries.includes(assetId)) {
      queueEntry = q;
      break;
    }
  }
}

if (!contract && !queueEntry) {
  console.error(
    `❌ BLOCKED: Asset ${assetId} is not in any production contract or incoming queue.`
  );
  console.error("   Unscoped assets cannot be tasked. Add to a contract or queue entry first.");
  process.exit(1);
}

// Generate task description
const source = contract ? `Production Contract ${contract.id}` : `Incoming Queue Section ${queueEntry.section}`;
const priority = (contract?.productionPriority || queueEntry?.priority || "unspecified").toUpperCase();
const referenceSheets = contract?.referenceSheets || [];
const requirements = contract?.requirements || queueEntry?.requirements || {};
const acceptanceCriteria = contract?.acceptanceCriteria || [];

const task = {
  id: `task-${assetId.replace(/\./g, "-")}`,
  assetId,
  displayName: contract?.displayName || manifestEntry.name,
  priority,
  source,
  runtimeAssetId: manifestEntry.worldAssetId || contract?.runtimeAssetId || assetId,
  status: "generated",
  generatedAt: new Date().toISOString(),
  scope: {
    format: contract?.format || requirements.format || "TBD",
    referenceSheets,
    manifestEntry: {
      name: manifestEntry.name,
      currentStatus: manifestEntry.currentStatus,
      role: manifestEntry.role,
      boardSection: manifestEntry.boardSection,
    },
  },
  requirements,
  acceptanceCriteria: acceptanceCriteria.slice(0, 8), // First 8 criteria
  workflow: [
    {
      stage: "research",
      description: "Review reference sheets and production contract",
      references: referenceSheets.map((s) => `section-${s}`),
    },
    {
      stage: "modeling",
      description: "Create asset according to format and geometry requirements",
      checkpoints: ["geometry-complete", "uvs-mapped", "materials-assigned"],
    },
    {
      stage: "validation",
      description: "Verify asset meets acceptance criteria",
      checkpoints: acceptanceCriteria.map((c, i) => `criterion-${i + 1}`),
    },
    {
      stage: "integration",
      description: "Import to runtime path and verify loader compatibility",
      checkpoints: ["loader-test", "visual-match-check"],
    },
  ],
  reviewCheckpoints: [
    `Reference sheets match (${referenceSheets.join(", ") || "none"}): `,
    `Format compliance (${contract?.format || "check contract"}): `,
    `Acceptance criteria met (${acceptanceCriteria.length} items): `,
    `No blockers or warnings in console: `,
  ],
  safetyNotes: [
    "This asset is locked to the specified contract/queue entry",
    "Modifications to scope must go through the production review process",
    "Do not accept work for assets marked missing or blocked",
    "All changes must be validated against the contract acceptance criteria",
  ],
};

if (format === "json") {
  console.log(JSON.stringify(task, null, 2));
} else if (format === "text") {
  console.log("\n" + "=".repeat(70));
  console.log(`📋 ASSET PRODUCTION TASK: ${task.assetId}`);
  console.log("=".repeat(70));
  console.log(`\nDisplay Name: ${task.displayName}`);
  console.log(`Priority: ${task.priority}`);
  console.log(`Source: ${task.source}`);
  console.log(`Status: ${task.status}`);
  console.log(`Generated: ${task.generatedAt}`);

  console.log(`\n📐 SCOPE`);
  console.log(`Format: ${task.scope.format}`);
  console.log(`Reference Sheets: ${task.scope.referenceSheets.length > 0 ? task.scope.referenceSheets.join(", ") : "none"}`);
  console.log(`Runtime Asset ID: ${task.runtimeAssetId}`);

  if (acceptanceCriteria.length > 0) {
    console.log(`\n✅ ACCEPTANCE CRITERIA`);
    acceptanceCriteria.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  }

  console.log(`\n🔄 WORKFLOW`);
  task.workflow.forEach((stage) => {
    console.log(`  ${stage.stage.toUpperCase()}: ${stage.description}`);
    stage.checkpoints.forEach((cp) => console.log(`    ☐ ${cp}`));
  });

  console.log(`\n⚠️  SAFETY NOTES`);
  task.safetyNotes.forEach((note) => console.log(`  • ${note}`));

  console.log(`\n${"=".repeat(70)}\n`);
}

process.exit(0);
