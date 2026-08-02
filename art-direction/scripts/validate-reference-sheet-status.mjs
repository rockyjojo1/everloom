#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const statusPath = resolve(__dirname, "..", "reference-sheets", "reference-sheet-status.json");

let status;
try {
  status = JSON.parse(readFileSync(statusPath, "utf8"));
} catch (e) {
  console.error(`Failed to read reference-sheet-status.json: ${e.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];

// Validate JSON structure
if (!status.expectedSheets || !Array.isArray(status.expectedSheets)) {
  errors.push("Missing or invalid expectedSheets array");
}

if (!status.masterBoard || typeof status.masterBoard !== "object") {
  errors.push("Missing or invalid masterBoard entry");
}

// Validate master board
if (status.masterBoard) {
  if (!status.masterBoard.checksum) {
    errors.push("Master board missing checksum");
  }
  if (!existsSync(resolve(__dirname, "..", "reference-sheets", status.masterBoard.filename))) {
    errors.push(`Master board file not found: ${status.masterBoard.filename}`);
  }
}

// Validate each expected sheet entry
status.expectedSheets.forEach((entry) => {
  if (!entry.sectionNumber || !entry.filename) {
    errors.push(`Entry missing sectionNumber or filename`);
    return;
  }

  // If received, validate file exists
  if (entry.received && !existsSync(resolve(__dirname, "..", "reference-sheets", entry.filename))) {
    errors.push(`Section ${entry.sectionNumber}: file marked as received but not found: ${entry.filename}`);
  }

  // If received without checksum, that's suspicious
  if (entry.received && !entry.checksum) {
    warnings.push(`Section ${entry.sectionNumber}: marked as received but has no checksum`);
  }

  // Warn about pending sheets
  if (!entry.received) {
    warnings.push(`Section ${entry.sectionNumber}: awaiting submission`);
  }

  // Warn about pending-review sheets
  if (entry.reviewStatus === "pending-review") {
    warnings.push(`Section ${entry.sectionNumber}: awaiting visual review`);
  }
});

// Print summary
console.log("\n=== Reference Sheet Status Validation ===\n");
console.log(`Total expected sheets: ${status.expectedSheets.length}`);
console.log(`Received: ${status.expectedSheets.filter((s) => s.received).length}`);
console.log(`Pending: ${status.expectedSheets.filter((s) => !s.received).length}`);
console.log(`Approved: ${status.expectedSheets.filter((s) => s.reviewStatus === "approved").length}`);

if (errors.length > 0) {
  console.log(`\n❌ ERRORS (${errors.length}):`);
  errors.forEach((err) => console.log(`  - ${err}`));
}

if (warnings.length > 0) {
  console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
  warnings.forEach((warn) => console.log(`  - ${warn}`));
}

if (errors.length === 0 && warnings.length === 0) {
  console.log("\n✅ Reference sheet status valid.");
}

process.exit(errors.length > 0 ? 1 : 0);
