#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

console.log("\n=== Reference Sheet Status Validation ===\n");

// Validate master board at REAL path (not in reference-sheets directory)
const masterPath = resolve(__dirname, "..", "everloom-00-master-art-bible.png");
if (!existsSync(masterPath)) {
  console.error(`❌ ERROR: Master art bible not found at: ${masterPath}`);
  process.exit(1);
}

// Validate master is valid PNG
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const masterBytes = readFileSync(masterPath);
if (masterBytes.length < 8 || !masterBytes.slice(0, 8).equals(pngSignature)) {
  console.error(`❌ ERROR: Master art bible is corrupt or not a PNG`);
  process.exit(1);
}

console.log(`✅ Master art bible found and valid`);

// Load status registry
const statusPath = resolve(__dirname, "..", "reference-sheets", "reference-sheet-status.json");
let status;
try {
  status = JSON.parse(readFileSync(statusPath, "utf8"));
} catch (e) {
  console.error(`❌ ERROR: Failed to read reference-sheet-status.json: ${e.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];

let approvedCount = 0;
let awaitingCount = 0;
let receivedCount = 0;

// Validate sections 01-10 (MUST be approved)
for (let section = 1; section <= 10; section++) {
  const sectionNum = String(section).padStart(2, "0");
  const entry = status.expectedSheets.find(s => s.sectionNumber === sectionNum);

  if (!entry) {
    errors.push(`Section ${sectionNum}: not found in status registry`);
    continue;
  }

  // Check received flag
  if (!entry.received) {
    errors.push(`Section ${sectionNum}: must be marked as received`);
    continue;
  }

  // Check approval status
  if (entry.reviewStatus !== "approved") {
    errors.push(`Section ${sectionNum}: must be approved (got "${entry.reviewStatus}")`);
    continue;
  }

  // Check approval date exists
  if (!entry.approvedDate) {
    errors.push(`Section ${sectionNum}: missing approval date`);
    continue;
  }

  // Check file exists
  const sheetPath = resolve(__dirname, "..", "reference-sheets", entry.filename);
  if (!existsSync(sheetPath)) {
    errors.push(`Section ${sectionNum}: file not found at ${sheetPath}`);
    continue;
  }

  // Validate PNG file
  const sheetBytes = readFileSync(sheetPath);
  if (sheetBytes.length < 8 || !sheetBytes.slice(0, 8).equals(pngSignature)) {
    errors.push(`Section ${sectionNum}: file is corrupt or not a PNG`);
    continue;
  }

  // Validate SHA-256
  const checksum = createHash("sha256").update(sheetBytes).digest("hex").toUpperCase();
  if (checksum !== entry.checksum) {
    errors.push(`Section ${sectionNum}: checksum mismatch (expected ${entry.checksum}, got ${checksum})`);
    continue;
  }

  // Validate dimensions
  if (sheetBytes.length >= 24) {
    const width = sheetBytes.readUInt32BE(16);
    const height = sheetBytes.readUInt32BE(20);
    const dims = `${width}x${height}`;
    if (dims !== entry.dimensions) {
      errors.push(`Section ${sectionNum}: dimensions mismatch (expected ${entry.dimensions}, got ${dims})`);
      continue;
    }
  }

  console.log(`✅ Section ${sectionNum}: approved and valid`);
  approvedCount++;
}

// Validate sections 11-18 (may be awaiting submission)
for (let section = 11; section <= 18; section++) {
  const sectionNum = String(section).padStart(2, "0");
  const entry = status.expectedSheets.find(s => s.sectionNumber === sectionNum);

  if (!entry) {
    errors.push(`Section ${sectionNum}: not found in status registry`);
    continue;
  }

  // If NOT received, that's okay (awaiting submission)
  if (!entry.received) {
    console.log(`ℹ️  Section ${sectionNum}: awaiting submission`);
    awaitingCount++;
    continue;
  }

  // If received, validate it's a good PNG
  receivedCount++;
  const sheetPath = resolve(__dirname, "..", "reference-sheets", entry.filename);
  if (!existsSync(sheetPath)) {
    errors.push(`Section ${sectionNum}: marked received but file not found`);
    continue;
  }

  const sheetBytes = readFileSync(sheetPath);
  if (sheetBytes.length < 8 || !sheetBytes.slice(0, 8).equals(pngSignature)) {
    errors.push(`Section ${sectionNum}: marked received but file is corrupt`);
    continue;
  }

  console.log(`ℹ️  Section ${sectionNum}: received, status "${entry.reviewStatus}"`);
}

// Sections 19+ must NOT be registered
const invalidSections = status.expectedSheets.filter(s => {
  const num = parseInt(s.sectionNumber, 10);
  return num > 18;
});

if (invalidSections.length > 0) {
  errors.push(`Sections 19+ found in registry: ${invalidSections.map(s => s.sectionNumber).join(", ")}`);
}

// Print summary (dynamic counts, not hard-coded)
console.log(`\n=== Summary ===`);
console.log(`Approved sections (01-10): ${approvedCount}`);
console.log(`Awaiting sections (11-18): ${awaitingCount}`);
console.log(`Received sections (11-18): ${receivedCount}`);

if (errors.length > 0) {
  console.log(`\n❌ ERRORS (${errors.length}):`);
  errors.forEach(e => console.log(`  - ${e}`));
  process.exit(1);
}

if (warnings.length > 0) {
  console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
  warnings.forEach(w => console.log(`  - ${w}`));
}

console.log(`\n✅ Reference sheet status validation passed`);
process.exit(0);
