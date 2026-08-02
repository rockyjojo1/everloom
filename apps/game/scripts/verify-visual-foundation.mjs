#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function run(label, command, args, opts = {}) {
  console.log(`\n⏳ ${label}`);
  const result = spawnSync(command, args, {
    cwd: opts.cwd || appRoot,
    stdio: "pipe",
    shell: false
  });

  if (result.status !== 0) {
    if (result.stderr) console.error(result.stderr.toString());
    if (result.stdout) console.log(result.stdout.toString());
    return { status: result.status, stdout: result.stdout?.toString() || "", stderr: result.stderr?.toString() || "" };
  }

  if (result.stdout) console.log(result.stdout.toString());
  return { status: 0, stdout: result.stdout?.toString() || "" };
}

console.log("\n" + "=".repeat(70));
console.log("🎨 EVERLOOM VISUAL PRODUCTION FOUNDATION VERIFICATION");
console.log("=".repeat(70));

const checks = [
  { name: "Reference-sheet status validation", cmd: "node", args: ["../../art-direction/scripts/validate-reference-sheet-status.mjs"], severity: "blocker" },
  { name: "Reference-sheet intake tests", cmd: "node", args: ["../../art-direction/scripts/register-reference-sheet.test.mjs"], severity: "blocker" },
  { name: "Manifest structure validation", cmd: "node", args: ["../../art-direction/scripts/validate-visual-production-manifest.mjs"], severity: "error" },
  { name: "Manifest data model tests", cmd: "node", args: ["../../art-direction/scripts/validate-visual-production-manifest.test.mjs"], severity: "error" },
  { name: "Integration coverage tests", cmd: "node", args: ["../../art-direction/scripts/validate-visual-production-integration.test.mjs"], severity: "warning" },
  { name: "Source path validation", cmd: "node", args: ["../../art-direction/scripts/validate-source-paths.mjs"], severity: "blocker" }
];

const results = {
  errors: 0,
  blockers: 0,
  warnings: 0,
  info: 0
};

const severityLevels = {
  error: "❌ ERROR",
  blocker: "🚫 BLOCKER",
  warning: "⚠️  WARNING",
  info: "ℹ️  INFO"
};

for (const check of checks) {
  const result = run(check.name, check.cmd, check.args);

  if (result.status !== 0) {
    results[check.severity]++;
    console.log(`   ${severityLevels[check.severity]}`);
  } else {
    console.log(`   ✅ PASSED`);
  }
}

// Report Gate 0
console.log(`\n⏳ Gate 0 verification (prerequisite)`);
const gate0 = run("Gate 0", "pnpm", ["run", "verify:gate0"], { cwd: appRoot });
if (gate0.status === 0) {
  console.log(`   ✅ PASSED`);
} else {
  console.log(`   ❌ FAILED`);
  results.errors++;
}

// Print comprehensive summary
console.log("\n" + "=".repeat(70));
console.log("📊 VERIFICATION RESULTS");
console.log("=".repeat(70));

console.log(`\n${severityLevels.error}: ${results.errors}`);
console.log(`${severityLevels.blocker}: ${results.blockers}`);
console.log(`${severityLevels.warning}: ${results.warnings}`);
console.log(`${severityLevels.info}: ${results.info}`);

// Load manifest for statistics
const manifestPath = resolve(appRoot, "../../art-direction/visual-production-manifest.json");
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  const verticalSlice = manifest.entries.filter(e => e.productionPriority === "vertical-slice").length;
  const phaseTwo = manifest.entries.filter(e => e.productionPriority === "phase-two").length;
  const withBlockers = manifest.entries.filter(e => e.currentStatus === "licensed-placeholder" && e.currentSource.includes("kaykit-") || e.currentSource.includes("kenney-")).length;

  console.log(`\n📋 Asset Inventory:`);
  console.log(`   Total entries: ${manifest.entries.length}`);
  console.log(`   Vertical-slice: ${verticalSlice}`);
  console.log(`   Phase-two: ${phaseTwo}`);
  console.log(`   With missing dependencies: ${withBlockers}`);
} catch (e) {
  console.log(`\n⚠️  Could not load manifest for statistics`);
}

console.log("\n" + "=".repeat(70));

if (results.errors > 0 || results.blockers > 0) {
  console.log(`\n❌ VERIFICATION FAILED\n`);
  console.log(`Fix all errors and blockers before proceeding.\n`);
  process.exit(1);
} else {
  console.log(`\n✅ VERIFICATION PASSED\n`);
  if (results.warnings > 0) {
    console.log(`⚠️  ${results.warnings} warning(s) present but not blocking.\n`);
  }
  process.exit(0);
}
