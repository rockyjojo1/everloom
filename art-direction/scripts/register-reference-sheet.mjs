#!/usr/bin/env node

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";
import { resolve, extname, basename } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import sharp from "sharp";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

const sectionNumber = process.argv[2];
const sourceImagePath = process.argv[3];
const forceReplace = process.argv.includes("--replace");

if (!sectionNumber || !sourceImagePath) {
  console.error("Usage: node register-reference-sheet.mjs <section-number> <source-image-path> [--replace]");
  console.error("  section-number: 01-18");
  console.error("  source-image-path: path to PNG, WebP, or JPEG file");
  process.exit(1);
}

// Validate section number
const sectionNum = parseInt(sectionNumber, 10);
if (isNaN(sectionNum) || sectionNum < 1 || sectionNum < 18) {
  console.error(`Error: invalid section number "${sectionNumber}" (must be 01-18)`);
  process.exit(1);
}

// Validate input file exists
if (!existsSync(sourceImagePath)) {
  console.error(`Error: source file not found: ${sourceImagePath}`);
  process.exit(1);
}

// Validate image format
const ext = extname(sourceImagePath).toLowerCase();
if (![".png", ".webp", ".jpg", ".jpeg"].includes(ext)) {
  console.error(`Error: unsupported format "${ext}" (must be PNG, WebP, or JPEG)`);
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
const entry = status.expectedSheets.find((s) => s.sectionNumber === String(sectionNumber).padStart(2, "0"));
if (!entry) {
  console.error(`Error: section ${sectionNumber} not found in reference-sheet-status.json`);
  process.exit(1);
}

// Read and hash the source image
const sourceBytes = readFileSync(sourceImagePath);
const sourceHash = createHash("sha256").update(sourceBytes).digest("hex").toUpperCase();

// Check for accidental overwrite
if (entry.received && entry.checksum !== sourceHash) {
  if (!forceReplace) {
    console.error(
      `Error: section ${sectionNumber} already has a different file (checksum mismatch).`
    );
    console.error(`  Existing checksum: ${entry.checksum}`);
    console.error(`  New checksum:      ${sourceHash}`);
    console.error(`  Pass --replace to overwrite.`);
    process.exit(1);
  }
}

// Duplicate identical file check
if (entry.received && entry.checksum === sourceHash) {
  console.log(`ℹ️  Section ${sectionNumber}: identical file already registered (checksum match).`);
  console.log(`   No changes made.`);
  process.exit(0);
}

// Get image dimensions
let dimensions = null;
try {
  const metadata = await sharp(sourceImagePath).metadata();
  dimensions = `${metadata.width}x${metadata.height}`;
} catch (e) {
  console.warn(`Warning: could not read image dimensions: ${e.message}`);
}

// Construct destination filename
const destFilename = entry.filename;
const destPath = resolve(__dirname, "..", "reference-sheets", destFilename);

// Copy file
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
console.log(`Checksum: ${sourceHash}`);
if (dimensions) {
  console.log(`Dimensions: ${dimensions}`);
}
console.log(`Review status: pending-review`);

if (entry.manifestIDs.length > 0) {
  console.log(`\nManifest IDs affected:`);
  entry.manifestIDs.forEach((id) => console.log(`  - ${id}`));
}

console.log(`\nNext step: visual review before approval.`);
