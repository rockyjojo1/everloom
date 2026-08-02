#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isWindows = process.platform === "win32";

function getPnpmCommand() {
  return isWindows ? "pnpm.cmd" : "pnpm";
}

function run(label, command, args) {
  console.log(`\n⏳ ${label}`);
  let result;
  try {
    // For pnpm on Windows, use shell:true because .cmd files can't be executed directly with shell:false
    const usesShell = usePnpmShell && command === getPnpmCommand();
    result = spawnSync(command, args, {
      cwd: appRoot,
      stdio: "inherit",
      shell: usesShell || false  // Use shell for pnpm.cmd on Windows, false for everything else
    });
  } catch (e) {
    throw new Error(`${label} failed to spawn: ${e.message}`);
  }

  // Handle null status, signals, and non-zero exits
  if (result.status === null || result.signal !== null || result.status !== 0) {
    const exitCode = result.status !== null ? result.status : (result.signal ? `killed by ${result.signal}` : "unknown error");
    if (result.error) {
      throw new Error(`${label} failed: ${result.error.message}`);
    }
    throw new Error(`${label} failed with exit code ${exitCode}`);
  }

  return { status: result.status };
}

console.log("\n" + "=".repeat(70));
console.log("🎨 EVERLOOM VISUAL PRODUCTION FOUNDATION VERIFICATION (15 Stages)");
console.log("=".repeat(70));

// For Windows, we need to use shell:true for pnpm commands because .cmd files
// can't be executed directly with spawnSync shell:false
const usePnpmShell = isWindows;

const checks = [
  { name: "1/15 Reference-sheet status", cmd: "node", args: ["../../art-direction/scripts/validate-reference-sheet-status.mjs"] },
  { name: "2/15 Reference-sheet intake tests", cmd: "node", args: ["../../art-direction/scripts/register-reference-sheet.test.mjs"] },
  { name: "3/15 Manifest structure", cmd: "node", args: ["../../art-direction/scripts/validate-visual-production-manifest.mjs"] },
  { name: "4/15 Manifest data model tests", cmd: "node", args: ["../../art-direction/scripts/validate-visual-production-manifest.test.mjs"] },
  { name: "5/15 Integration coverage tests", cmd: "node", args: ["../../art-direction/scripts/validate-visual-production-integration.test.mjs"] },
  { name: "6/15 Source path validation", cmd: "node", args: ["../../art-direction/scripts/validate-source-paths.mjs"] },
  { name: "7/15 Production-contract validation", cmd: "node", args: ["../../art-direction/scripts/validate-production-contracts.mjs"] },
  { name: "8/15 Incoming queue validation", cmd: "node", args: ["../../art-direction/scripts/validate-incoming-queue.mjs"] },
  { name: "9/15 Visual comparison tests", cmd: "node", args: ["../../art-direction/scripts/visual-comparison.test.mjs"] },
  { name: "10/15 Safe task-generator tests", cmd: "node", args: ["../../art-direction/scripts/generate-asset-task.test.mjs"] },
  { name: "11/15 Visual workbench tests", cmd: "node", args: ["scripts/test-visual-workbench.mjs"] },
  { name: "12/15 Game unit tests", cmd: getPnpmCommand(), args: ["run", "test"] },
  { name: "13/15 TypeScript verification", cmd: getPnpmCommand(), args: ["run", "typecheck"] },
  { name: "14/15 Production build", cmd: getPnpmCommand(), args: ["run", "build"] },
  { name: "15/15 Gate 0 verification", cmd: getPnpmCommand(), args: ["run", "verify:gate0"] }
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
console.log("🎨 VISUAL FOUNDATION CORE CHECKS PASSED");
console.log("=".repeat(70));
console.log(`\nBASELINE STATUS: PENDING, 0/10 captured`);
console.log(`FULL VISUAL FOUNDATION NOT YET COMPLETE\n`);
process.exit(0);
