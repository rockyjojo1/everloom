#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const queuePath = resolve(__dirname, "..", "incoming-sheets-queue.json");

let queue;
try {
  queue = JSON.parse(readFileSync(queuePath, "utf8"));
} catch (e) {
  console.error(`Error loading incoming queue: ${e.message}`);
  process.exit(1);
}

const errors = [];

if (queue.queue.length !== 10) {
  errors.push(`Expected 10 sections, found ${queue.queue.length}`);
}

for (const item of queue.queue) {
  // Sections 11-20 should be received
  if (!item.received) {
    errors.push(`Section ${item.section}: not marked as received`);
  }

  // Received items must have a file
  if (item.received && !item.file) {
    errors.push(`Section ${item.section}: marked received but no file specified`);
  }

  // Check file exists if received
  if (item.received && item.file) {
    const filePath = resolve(__dirname, "..", item.file);
    if (!existsSync(filePath)) {
      errors.push(`Section ${item.section}: file not found: ${item.file}`);
    } else {
      // Verify checksum if provided
      if (item.checksum) {
        const buffer = readFileSync(filePath);
        const actualChecksum = createHash("sha256").update(buffer).digest("hex").toUpperCase();
        if (actualChecksum !== item.checksum) {
          errors.push(`Section ${item.section}: checksum mismatch (expected ${item.checksum}, got ${actualChecksum})`);
        }
      }
    }
  }

  // Section 15 must be needs-revision
  if (item.section === "15" && item.reviewStatus !== "needs-revision") {
    errors.push(`Section 15: must be needs-revision (found: ${item.reviewStatus})`);
  }

  // Other sections 11-20 should be approved (except 19-20 if reserved)
  if (item.section !== "15" && item.section !== "19" && item.section !== "20") {
    if (item.reviewStatus !== "approved") {
      errors.push(`Section ${item.section}: expected approved (found: ${item.reviewStatus})`);
    }
  }
}

console.log("\n=== Incoming Sheets Queue Validation ===\n");

if (errors.length > 0) {
  console.log(`❌ ERRORS (${errors.length}):`);
  errors.forEach(e => console.log(`  - ${e}`));
  process.exit(1);
}

console.log(`✅ Incoming queue valid: ${queue.queue.length} sections with proper checksums and review status`);
process.exit(0);
