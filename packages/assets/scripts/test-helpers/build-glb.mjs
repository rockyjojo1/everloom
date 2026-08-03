// Builds a minimal, valid (or deliberately broken, for negative tests) GLB
// buffer in memory. No fixture files are committed — every test constructs
// exactly the bytes it needs.

function pad4(buf) {
  const rem = buf.length % 4;
  if (rem === 0) return buf;
  return Buffer.concat([buf, Buffer.alloc(4 - rem, 0x20)]);
}

export function buildGlb(json, binChunk = null) {
  const jsonBuf = pad4(Buffer.from(JSON.stringify(json), "utf8"));
  const chunks = [
    { type: "JSON", data: jsonBuf },
  ];
  if (binChunk) chunks.push({ type: "BIN\0", data: pad4(Buffer.isBuffer(binChunk) ? binChunk : Buffer.from(binChunk)) });

  let totalLength = 12;
  for (const c of chunks) totalLength += 8 + c.data.length;

  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const chunkBuffers = chunks.map((c) => {
    const chunkHeader = Buffer.alloc(8);
    chunkHeader.writeUInt32LE(c.data.length, 0);
    chunkHeader.write(c.type, 4, "ascii");
    return Buffer.concat([chunkHeader, c.data]);
  });

  return Buffer.concat([header, ...chunkBuffers]);
}

/** A minimal but complete valid glTF document: one triangle, no rig. */
export function minimalValidGltfJson() {
  return {
    asset: { version: "2.0", generator: "test-fixture" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4, material: 0 }],
    }],
    materials: [{ name: "test-material" }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }, // POSITION, 3 verts
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" }, // indices, 3 -> 1 triangle
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    buffers: [{ byteLength: 42 }],
  };
}

/** A minimal 1x1 PNG (valid signature + IHDR) as a Buffer. */
export function tinyPng(width = 2, height = 2) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type RGB
  const length = Buffer.alloc(4);
  length.writeUInt32BE(13, 0);
  const type = Buffer.from("IHDR", "ascii");
  // CRC not validated by our lightweight parser; use zeros.
  const crc = Buffer.alloc(4);
  return Buffer.concat([sig, length, type, ihdrData, crc]);
}
