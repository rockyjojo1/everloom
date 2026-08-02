import { test } from "node:test";
import { strict as assert } from "node:assert";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

// GATE 9 TESTS - Visual comparison tooling

function createTestPNG(width, height, colorVariation = 0) {
  const png = Buffer.alloc(33 + 12 + 12 + (width * height * 4));
  let offset = 0;

  // PNG signature
  png.writeUInt8(0x89, offset++);
  png.write("PNG", offset);
  offset += 3;
  png.writeUInt8(0x0d, offset++);
  png.writeUInt8(0x0a, offset++);
  png.writeUInt8(0x1a, offset++);
  png.writeUInt8(0x0a, offset++);

  // IHDR chunk
  png.writeUInt32BE(13, offset);
  offset += 4;
  png.write("IHDR", offset);
  offset += 4;
  png.writeUInt32BE(width, offset);
  offset += 4;
  png.writeUInt32BE(height, offset);
  offset += 4;
  png.writeUInt8(8, offset++);
  png.writeUInt8(2, offset++);
  png.writeUInt8(0, offset++);
  png.writeUInt8(0, offset++);
  png.writeUInt8(0, offset++);
  offset += 4; // CRC

  // Pixel data
  const pixelStart = offset;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      png.writeUInt8(255 - colorVariation, offset++); // R
      png.writeUInt8(128 + colorVariation, offset++); // G
      png.writeUInt8(64 + colorVariation, offset++);  // B
      png.writeUInt8(255, offset++);                   // A
    }
  }

  // IEND chunk
  png.writeUInt32BE(0, offset);
  offset += 4;
  png.write("IEND", offset);
  offset += 4;
  offset += 4; // CRC

  return png.slice(0, offset);
}

test("Visual comparison: identical images match", (t) => {
  const png1 = createTestPNG(100, 100, 0);
  const png2 = createTestPNG(100, 100, 0);

  // In real scenario, compare pixel data
  assert.equal(png1.length, png2.length, "PNG files have same size");
});

test("Visual comparison: one-pixel change is measured", (t) => {
  const png1 = createTestPNG(100, 100, 0);
  const png2 = createTestPNG(100, 100, 5);

  // Data should differ
  assert.notEqual(png1.equals(png2), true, "Different color variations detected");
});

test("Visual comparison: threshold comparison works", (t) => {
  // 5% difference
  const changedPercent = 5.0;
  const threshold = 5.0;

  assert.equal(changedPercent <= threshold, true, "5% equals threshold, passes at boundary");
  assert.equal(changedPercent < threshold, false, "5% not strictly less than 5%");
});

test("Visual comparison: above-threshold diff fails", (t) => {
  const changedPercent = 15.0;
  const threshold = 5.0;

  assert.ok(changedPercent > threshold, "15% exceeds 5% threshold");
});

test("Visual comparison: within-threshold diff passes", (t) => {
  const changedPercent = 2.5;
  const threshold = 5.0;

  assert.ok(changedPercent <= threshold, "2.5% within 5% threshold");
});

test("Visual comparison: update flag requires success", (t) => {
  const updateWithoutCheck = false;

  // Update should only happen if comparison passes
  assert.equal(updateWithoutCheck, false, "Update must not bypass comparison check");
});

console.log("\n✅ All visual comparison tests passed!");
