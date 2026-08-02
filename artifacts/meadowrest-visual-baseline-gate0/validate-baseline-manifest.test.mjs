import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "url";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const manifestPath = resolve(__dirname, "shot-manifest.json");

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  console.error("Failed to load baseline manifest:", e.message);
  process.exit(1);
}

// GATE 8 TESTS

test("Baseline manifest has required structure", () => {
  assert.ok(manifest.version, "manifest has version");
  assert.ok(manifest.generatedAt, "manifest has generatedAt");
  assert.ok(Array.isArray(manifest.shots), "manifest has shots array");
  assert.ok(manifest.shots.length > 0, "manifest has at least one shot");
});

test("All shots have required fields", () => {
  const required = ["shotNumber", "filename", "displayName", "viewport", "captured"];
  for (const shot of manifest.shots) {
    for (const field of required) {
      assert.ok(shot[field] !== undefined, `shot ${shot.shotNumber} missing ${field}`);
    }
  }
});

test("All shots have valid viewport dimensions", () => {
  for (const shot of manifest.shots) {
    assert.ok(shot.viewport.width > 0, `shot ${shot.shotNumber} has invalid width`);
    assert.ok(shot.viewport.height > 0, `shot ${shot.shotNumber} has invalid height`);
    assert.equal(typeof shot.viewport.width, "number", `width must be number`);
    assert.equal(typeof shot.viewport.height, "number", `height must be number`);
  }
});

test("Captured shots have valid checksums", () => {
  for (const shot of manifest.shots) {
    if (shot.captured) {
      assert.ok(shot.checksum, `captured shot ${shot.shotNumber} missing checksum`);
      assert.equal(shot.checksum.length, 64, `checksum must be SHA-256`);
      assert.match(shot.checksum, /^[0-9A-F]+$/i, `checksum must be hex`);
    }
  }
});

test("Captured shots have matching PNG files", () => {
  for (const shot of manifest.shots) {
    if (shot.captured) {
      const pngPath = resolve(__dirname, shot.filename);
      assert.ok(existsSync(pngPath), `captured shot file not found: ${shot.filename}`);

      // Verify PNG validity
      const pngBytes = readFileSync(pngPath);
      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      assert.ok(pngBytes.slice(0, 8).equals(pngSignature), `${shot.filename} is not a valid PNG`);

      // Verify dimensions match
      const width = pngBytes.readUInt32BE(16);
      const height = pngBytes.readUInt32BE(20);
      assert.equal(width, shot.viewport.width, `${shot.filename} width mismatch`);
      assert.equal(height, shot.viewport.height, `${shot.filename} height mismatch`);

      // Verify checksum
      const actualChecksum = createHash("sha256").update(pngBytes).digest("hex").toUpperCase();
      assert.equal(actualChecksum, shot.checksum, `${shot.filename} checksum mismatch`);
    }
  }
});

test("Uncaptured shots have no checksum", () => {
  for (const shot of manifest.shots) {
    if (!shot.captured) {
      assert.equal(shot.checksum, null, `uncaptured shot ${shot.shotNumber} should have null checksum`);
    }
  }
});

test("Shot numbers are sequential", () => {
  for (let i = 0; i < manifest.shots.length; i++) {
    const expectedNumber = String(i + 1).padStart(2, "0");
    const actualNumber = manifest.shots[i].shotNumber;
    assert.equal(actualNumber, expectedNumber, `shot number mismatch at position ${i}`);
  }
});

test("Filenames are unique", () => {
  const filenames = new Set();
  for (const shot of manifest.shots) {
    assert.ok(!filenames.has(shot.filename), `duplicate filename: ${shot.filename}`);
    filenames.add(shot.filename);
  }
});

console.log("\n✅ All baseline manifest tests passed!");
