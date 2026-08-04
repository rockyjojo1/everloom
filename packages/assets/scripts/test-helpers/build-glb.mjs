// Fixture builders for glTF/GLB tests. Minimal, no third-party dependencies.

/**
 * Build a valid minimal glTF JSON structure with a single triangle mesh.
 */
export function minimalValidGltfJson() {
  return {
    asset: { version: "2.0", generator: "test-fixture" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, skin: 0 }],
    meshes: [{
      name: "Mesh",
      primitives: [{ mode: 4, attributes: { POSITION: 0 }, indices: 1, material: 0 }],
    }],
    materials: [{ name: "Material" }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: 1, componentType: 5125, count: 3, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, byteStride: 12 },
      { buffer: 0, byteOffset: 36, byteLength: 12 },
    ],
    buffers: [{ byteLength: 48 }],
    skins: [{
      joints: Array.from({ length: 41 }, (_, i) => i),
      skeleton: 0,
      name: "Armature",
    }],
    animations: [
      { name: "Idle", channels: [], samplers: [] },
      { name: "Walking_A", channels: [], samplers: [] },
      { name: "1H_Melee_Attack_Chop", channels: [], samplers: [] },
      { name: "1H_Melee_Attack_Stab", channels: [], samplers: [] },
      { name: "Sit_Floor_Down", channels: [], samplers: [] },
      { name: "Sit_Floor_Idle", channels: [], samplers: [] },
      { name: "Sit_Floor_StandUp", channels: [], samplers: [] },
    ],
  };
}

/**
 * Build a minimal valid PNG buffer with given width/height.
 * Returns a valid PNG file (signature + IHDR chunk only; no actual image data).
 */
export function tinyPng(width, height) {
  const buf = Buffer.alloc(33);
  // PNG signature (8 bytes)
  buf.writeUInt8(0x89, 0);
  buf.write("PNG", 1, "ascii");
  buf.writeUInt8(0x0d, 4);
  buf.writeUInt8(0x0a, 5);
  buf.writeUInt8(0x1a, 6);
  buf.writeUInt8(0x0a, 7);
  // IHDR chunk header (4 bytes length + 4 bytes "IHDR")
  buf.writeUInt32BE(13, 8); // IHDR data is always 13 bytes
  buf.write("IHDR", 12, "ascii");
  // IHDR data (13 bytes): width(4), height(4), bitDepth(1), colorType(1), compression(1), filter(1), interlace(1)
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf.writeUInt8(8, 24); // bit depth
  buf.writeUInt8(6, 25); // color type RGBA
  buf.writeUInt8(0, 26); // compression method
  buf.writeUInt8(0, 27); // filter method
  buf.writeUInt8(0, 28); // interlace method
  // CRC (4 bytes) — we won't validate it in imageDimensions, so any value works
  buf.writeUInt32BE(0, 29);
  return buf;
}

/**
 * Build a GLB container around a glTF JSON and optional binary buffer.
 * Assumes valid JSON structure (as from minimalValidGltfJson).
 */
export function buildGlb(json, binChunk = Buffer.alloc(0)) {
  const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  // GLB header (12 bytes): "glTF" + version (2) + total length
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4); // version
  const totalLength = 12 + 8 + jsonBuf.length + (binChunk.length > 0 ? 8 + binChunk.length : 0);
  header.writeUInt32LE(totalLength, 8);
  // JSON chunk: length (4) + type (4) + data
  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonChunkHeader.write("JSON", 4, "ascii");
  // BIN chunk (if present)
  const binChunkParts = [];
  if (binChunk.length > 0) {
    const binChunkHeader = Buffer.alloc(8);
    binChunkHeader.writeUInt32LE(binChunk.length, 0);
    binChunkHeader.write("BIN ", 4, "ascii");
    binChunkParts.push(binChunkHeader, binChunk);
  }
  return Buffer.concat([header, jsonChunkHeader, jsonBuf, ...binChunkParts]);
}
