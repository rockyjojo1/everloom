import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildGlb, minimalValidGltfJson, tinyPng } from "./test-helpers/build-glb.mjs";
import { parseGlbContainer, summariseGltf, pngDimensions, jpegDimensions, imageDimensions } from "./gltf-parser.mjs";
import { MODEL_ROOT } from "../paths.mjs";

test("rejects malformed GLB magic", () => {
  const buf = Buffer.concat([Buffer.from("XXXX"), Buffer.alloc(20)]);
  const result = parseGlbContainer(buf);
  assert.equal(result.ok, false);
  assert.match(result.error, /bad GLB magic/);
});

test("rejects a buffer too small for a header", () => {
  const result = parseGlbContainer(Buffer.alloc(4));
  assert.equal(result.ok, false);
  assert.match(result.error, /too small/);
});

test("reports declared length mismatch without failing the parse", () => {
  const glb = buildGlb(minimalValidGltfJson());
  // Corrupt the declared total length field only.
  glb.writeUInt32LE(glb.length + 100, 8);
  const result = parseGlbContainer(glb);
  assert.equal(result.ok, true);
  assert.equal(result.lengthMismatch, true);
});

test("rejects a chunk whose declared length overruns the buffer", () => {
  const glb = buildGlb(minimalValidGltfJson());
  // Corrupt the first chunk's length field to claim more bytes than exist.
  glb.writeUInt32LE(0xffffff, 12);
  const result = parseGlbContainer(glb);
  assert.equal(result.ok, false);
});

test("fails cleanly when no JSON chunk is present", () => {
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12, 8);
  const result = parseGlbContainer(header);
  assert.equal(result.ok, false);
  assert.match(result.error, /no JSON chunk/);
});

test("fails cleanly on invalid JSON inside the JSON chunk", () => {
  const chunkData = Buffer.from("{not valid json", "utf8");
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(chunkData.length, 0);
  chunkHeader.write("JSON", 4, "ascii");
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + chunkData.length, 8);
  const glb = Buffer.concat([header, chunkHeader, chunkData]);
  const result = parseGlbContainer(glb);
  assert.equal(result.ok, false);
  assert.match(result.error, /JSON chunk failed to parse/);
});

test("parses a valid minimal GLB and reports exact triangle/vertex counts", () => {
  const glb = buildGlb(minimalValidGltfJson(), Buffer.alloc(42));
  const result = parseGlbContainer(glb);
  assert.equal(result.ok, true);
  const summary = summariseGltf(result.json, { binChunk: result.binChunk });
  assert.equal(summary.meshCount, 1);
  assert.equal(summary.materialCount, 1);
  assert.equal(summary.totalTriangles, 1);
  assert.equal(summary.meshes[0].primitives[0].indexCount, 3);
  assert.equal(summary.meshes[0].primitives[0].vertexCount, 3);
  assert.equal(summary.meshes[0].primitives[0].malformed, false);
});

test("flags a TRIANGLES primitive whose index count is not divisible by 3", () => {
  const json = minimalValidGltfJson();
  json.accessors[1].count = 4; // 4 indices for TRIANGLES mode -> malformed
  const glb = buildGlb(json, Buffer.alloc(42));
  const result = parseGlbContainer(glb);
  const summary = summariseGltf(result.json, { binChunk: result.binChunk });
  assert.equal(summary.malformedPrimitiveCount, 1);
  assert.equal(summary.meshes[0].primitives[0].malformed, true);
});

test("computes TRIANGLE_STRIP triangle count as count - 2", () => {
  const json = minimalValidGltfJson();
  json.meshes[0].primitives[0].mode = 5; // TRIANGLE_STRIP
  json.accessors[1].count = 5; // 5 indices -> 3 triangles
  const glb = buildGlb(json, Buffer.alloc(42));
  const result = parseGlbContainer(glb);
  const summary = summariseGltf(result.json, { binChunk: result.binChunk });
  assert.equal(summary.totalTriangles, 3);
});

test("decodes an embedded PNG bufferView image and reports its dimensions", () => {
  const png = tinyPng(4, 6);
  const json = minimalValidGltfJson();
  json.images = [{ bufferView: 2, mimeType: "image/png" }];
  json.bufferViews.push({ buffer: 0, byteOffset: 42, byteLength: png.length });
  const bin = Buffer.concat([Buffer.alloc(42), png]);
  const glb = buildGlb(json, bin);
  const result = parseGlbContainer(glb);
  const summary = summariseGltf(result.json, { binChunk: result.binChunk });
  assert.equal(summary.images.length, 1);
  assert.deepEqual(summary.images[0].dimensions, { width: 4, height: 6, format: "png" });
});

test("pngDimensions returns null for non-PNG data", () => {
  assert.equal(pngDimensions(Buffer.from("not a png")), null);
});

test("jpegDimensions returns null for non-JPEG data", () => {
  assert.equal(jpegDimensions(Buffer.from([0x00, 0x01, 0x02])), null);
});

test("imageDimensions tries PNG then JPEG and returns null for neither", () => {
  assert.equal(imageDimensions(Buffer.alloc(10)), null);
  const dims = imageDimensions(tinyPng(8, 8));
  assert.deepEqual(dims, { width: 8, height: 8, format: "png" });
});

test("parses the real player.adventurer asset with expected structure", async () => {
  const full = resolve(MODEL_ROOT, "kaykit-adventurers/Character.glb");
  const buf = await readFile(full);
  const container = parseGlbContainer(buf);
  assert.equal(container.ok, true);
  const summary = summariseGltf(container.json, { binChunk: container.binChunk });
  assert.equal(summary.skinCount, 1);
  assert.equal(summary.skins[0].jointCount, 41);
  assert.equal(summary.animationCount, 76);
  assert.ok(summary.animationNames.includes("Idle"));
  assert.ok(summary.totalTriangles > 0);
});

test("parses the real enemy.skeleton-warrior asset with expected structure", async () => {
  const full = resolve(MODEL_ROOT, "kaykit-skeletons/Skeleton_Warrior.glb");
  const buf = await readFile(full);
  const container = parseGlbContainer(buf);
  assert.equal(container.ok, true);
  const summary = summariseGltf(container.json, { binChunk: container.binChunk });
  assert.equal(summary.skinCount, 1);
  assert.equal(summary.skins[0].jointCount, 41);
  assert.equal(summary.animationCount, 95);
  assert.ok(summary.animationNames.includes("1H_Melee_Attack_Chop"));
});
