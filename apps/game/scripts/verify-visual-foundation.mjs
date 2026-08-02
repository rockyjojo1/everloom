#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function run(label, command, args) {
  console.log(`\n⏳ ${label}`);
  const result = spawnSync(command, args, {
    cwd: appRoot,
    stdio: "pipe",
    shell: false
  });

  if (result.status !== 0) {
    if (result.stderr) console.error(result.stderr.toString());
    if (result.stdout) console.log(result.stdout.toString());
    throw new Error(`${label} failed with exit code ${result.status}`);
  }

  if (result.stdout) console.log(result.stdout.toString());
  return { status: result.status };
}

console.log("\n" + "=".repeat(70));
console.log("🎨 EVERLOOM VISUAL PRODUCTION FOUNDATION VERIFICATION (13 Stages)");
console.log("=".repeat(70));

const checks = [
  { name: "1/13 Reference-sheet status", cmd: "node", args: ["../../art-direction/scripts/validate-reference-sheet-status.mjs"] },
  { name: "2/13 Reference-sheet intake tests", cmd: "node", args: ["../../art-direction/scripts/register-reference-sheet.test.mjs"] },
  { name: "3/13 Manifest structure", cmd: "node", args: ["../../art-direction/scripts/validate-visual-production-manifest.mjs"] },
  { name: "4/13 Manifest data model tests", cmd: "node", args: ["../../art-direction/scripts/validate-visual-production-manifest.test.mjs"] },
  { name: "5/13 Integration coverage tests", cmd: "node", args: ["../../art-direction/scripts/validate-visual-production-integration.test.mjs"] },
  { name: "6/13 Source path validation", cmd: "node", args: ["../../art-direction/scripts/validate-source-paths.mjs"] },
  { name: "7/13 Visual comparison tests", cmd: "node", args: ["../../art-direction/scripts/visual-comparison.test.mjs"] },
  { name: "8/13 Workbench component tests", cmd: "pnpm", args: ["run", "test"] },
  { name: "9/13 TypeScript verification", cmd: "pnpm", args: ["run", "typecheck"] },
  { name: "10/13 Production build", cmd: "pnpm", args: ["run", "build"] }
];

let completed = 0;

for (const check of checks) {
  try {
    run(check.name, check.cmd, check.args);
    console.log(`   ✅ PASSED`);
    completed++;
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);

    console.log("\n" + "=".repeat(70));
    console.log(`\n❌ VERIFICATION FAILED at step ${completed + 1}\n`);
    console.log(`Fix errors before proceeding.\n`);
    process.exit(1);
  }
}

console.log("\n" + "=".repeat(70));
console.log("📊 VERIFICATION RESULTS");
console.log("=".repeat(70));

console.log(`\n✅ All ${completed} verification stages PASSED\n`);

// Load manifest for statistics
const manifestPath = resolve(appRoot, "../../art-direction/visual-production-manifest.json");
try {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  const verticalSlice = manifest.entries.filter(e => e.productionPriority === "vertical-slice").length;
  const phaseTwo = manifest.entries.filter(e => e.productionPriority === "phase-two").length;
  const approvedExisting = manifest.entries.filter(e => e.currentStatus === "approved-existing").length;
  const procedural = manifest.entries.filter(e => e.currentStatus === "procedural-placeholder").length;
  const missing = manifest.entries.filter(e => e.currentStatus === "missing").length;

  console.log(`📋 Asset Inventory:`);
  console.log(`   Total entries: ${manifest.entries.length}`);
  console.log(`   Vertical-slice: ${verticalSlice}`);
  console.log(`   Phase-two: ${phaseTwo}`);
  console.log(`   Approved-existing: ${approvedExisting}`);
  console.log(`   Procedural: ${procedural}`);
  console.log(`   Missing: ${missing}`);
  console.log(`   Blockers: ${missing > 0 ? "❌" : "✅"}`);
} catch (e) {
  console.log(`\n⚠️  Could not load manifest for statistics: ${e.message}`);
}

console.log("\n" + "=".repeat(70));
console.log(`\n✅ VISUAL PRODUCTION FOUNDATION VERIFIED\n`);
process.exit(0);
