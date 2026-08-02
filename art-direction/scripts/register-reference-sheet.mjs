#!/usr/bin/env node

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";
import { resolve, extname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

const sectionNumber = process.argv[2];
const sourceImagePath = process.argv[3];
const forceReplace = process.argv.includes("--replace");

if (!sectionNumber || !sourceImagePath) {
  console.error("Usage: node register-reference-sheet.mjs <section-number> <source-image-path> [--replace]");
  console.error("  section-number: 01-18 (PNG reference sheets only)");
  console.error("  source-image-path: path to PNG file");
  console.error("  --replace: overwrite existing section (optional)");
  process.exit(1);
}

// Validate section number (01-18 only, NOT 19+)
const sectionNum = parseInt(sectionNumber, 10);
if (isNaN(sectionNum) || sectionNum < 1 || sectionNum > 18) {
  console.error(`Error: invalid section number "${sectionNumber}" (must be 01-18)`);
  process.exit(1);
}

// Validate input file exists
if (!existsSync(sourceImagePath)) {
  console.error(`Error: source file not found: ${sourceImagePath}`);
  process.exit(1);
}

// Validate PNG format only (no JPEG, WebP, etc)
const ext = extname(sourceImagePath).toLowerCase();
if (ext !== ".png") {
  console.error(`Error: unsupported format "${ext}" (PNG only, no JPEG or WebP)`);
  process.exit(1);
}

// Reject temporary destination paths
if (sourceImagePath.includes("\\Temp\\") || sourceImagePath.includes("AppData")) {
  console.error(`Error: temporary path not allowed: ${sourceImagePath}`);
  process.exit(1);
}

// Load status JSON
const statusPath = resolve(__dirname, "..", "reference-sheets", "reference-sheet-status.json");
let status;
try {
  status = JSON.parse(readFileSync(statusPath, "utf8"));
} catch (e) {
  console.error(`Failed to read reference-sheet-status.json: ${e.message}`);
  process.exit(1);
}

// Find the section entry
const sectionPadded = String(sectionNumber).padStart(2, "0");
const entry = status.expectedSheets.find((s) => s.sectionNumber === sectionPadded);
if (!entry) {
  console.error(`Error: section ${sectionNumber} not found in reference-sheet-status.json`);
  process.exit(1);
}

// Read and validate PNG
let sourceBytes;
try {
  sourceBytes = readFileSync(sourceImagePath);
} catch (e) {
  console.error(`Error: failed to read source file: ${e.message}`);
  process.exit(1);
}

// Validate PNG signature
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (sourceBytes.length < 8 || !sourceBytes.slice(0, 8).equals(pngSignature)) {
  console.error(`Error: corrupt PNG or invalid PNG signature`);
  process.exit(1);
}

// Parse PNG dimensions from IHDR chunk
let width = 0, height = 0;
try {
  // IHDR chunk starts at byte 8, skip 4-byte length and 4-byte "IHDR" type
  if (sourceBytes.length >= 24) {
    width = sourceBytes.readUInt32BE(16);  // bytes 16-19
    height = sourceBytes.readUInt32BE(20); // bytes 20-23
  }
  if (width === 0 || height === 0) {
    throw new Error("Invalid dimensions");
  }
} catch (e) {
  console.error(`Error: failed to read PNG dimensions: ${e.message}`);
  process.exit(1);
}

const dimensions = `${width}x${height}`;

// Calculate SHA-256
const sourceHash = createHash("sha256").update(sourceBytes).digest("hex").toUpperCase();

// Duplicate identical file check (successful no-op)
if (entry.received && entry.checksum === sourceHash) {
  console.log(`ℹ️  Section ${sectionNumber}: identical file already registered.`);
  console.log(`   Checksum: ${sourceHash}`);
  console.log(`   No changes made.`);
  process.exit(0);
}

// Check for accidental overwrite
if (entry.received && entry.checksum !== sourceHash) {
  if (!forceReplace) {
    console.error(`Error: section ${sectionNumber} already has a different file.`);
    console.error(`  Existing checksum: ${entry.checksum}`);
    console.error(`  New checksum:      ${sourceHash}`);
    console.error(`  Pass --replace to overwrite.`);
    process.exit(1);
  }
}

// Construct destination filename
const destFilename = entry.filename;
const destPath = resolve(__dirname, "..", "reference-sheets", destFilename);

// Copy file without re-encoding
try {
  copyFileSync(sourceImagePath, destPath);
} catch (e) {
  console.error(`Failed to copy image: ${e.message}`);
  process.exit(1);
}

// Update status entry
entry.received = true;
entry.checksum = sourceHash;
entry.dimensions = dimensions;
entry.reviewStatus = "pending-review";
entry.approvedDate = null;

// Write updated status
try {
  writeFileSync(statusPath, JSON.stringify(status, null, 2));
} catch (e) {
  console.error(`Failed to update reference-sheet-status.json: ${e.message}`);
  process.exit(1);
}

// Print results
console.log(`\n✅ Section ${sectionNumber} registered successfully.\n`);
console.log(`File: ${destFilename}`);
console.log(`Dimensions: ${dimensions}`);
console.log(`Checksum: ${sourceHash}`);
console.log(`Review status: pending-review`);

if (entry.manifestIDs.length > 0) {
  console.log(`\nManifest IDs affected:`);
  entry.manifestIDs.forEach((id) => console.log(`  - ${id}`));
}

console.log(`\nNext step: visual review before approval.`);
