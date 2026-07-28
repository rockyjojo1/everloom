/**
 * Generates Everloom's tile + prop atlases as PNGs with a KNOWN, documented layout.
 *
 * Why this exists: the LPC terrain pack is a 512x31488 vertical stack of dozens of
 * unrelated tilesets. Indexing it by naive row/col lands on arbitrary sections
 * (that's why the world rendered as brown rock). This produces small atlases whose
 * layout is defined here in code, so the renderer can never mis-slice them.
 *
 * To swap in a purchased/licensed pack later: keep the same grid layout and replace
 * the output files. The renderer reads indices from world/atlasLayout.ts only.
 *
 * Run: node scripts/gen-tiles.js apps/web/public/sprites
 */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

/* ---------- minimal PNG encoder ---------- */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (b) => {
  let c = -1;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      raw[o++] = rgba[i]; raw[o++] = rgba[i + 1];
      raw[o++] = rgba[i + 2]; raw[o++] = rgba[i + 3];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- tiny canvas ---------- */
class Surface {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.d = Buffer.alloc(w * h * 4); // transparent
  }
  px(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const a = c[3] === undefined ? 255 : c[3];
    if (a === 255) {
      this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
    } else {
      // alpha blend over existing
      const na = a / 255, ia = 1 - na;
      this.d[i] = c[0] * na + this.d[i] * ia;
      this.d[i + 1] = c[1] * na + this.d[i + 1] * ia;
      this.d[i + 2] = c[2] * na + this.d[i + 2] * ia;
      this.d[i + 3] = Math.max(this.d[i + 3], a);
    }
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++)
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.px(cx + x, cy + y, c);
  }
  png() { return encodePNG(this.w, this.h, this.d); }
}

// Deterministic hash noise so output is byte-identical between runs.
const noise = (x, y, s = 0) => {
  let n = (x * 374761393 + y * 668265263 + s * 1442695040) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

/* ---------- palette: muted OSRS-ish earth tones ---------- */
const P = {
  grass:      [0x4a, 0x6f, 0x3a],
  grassLo:    [0x3e, 0x5f, 0x31],
  grassHi:    [0x58, 0x80, 0x45],
  grassDark:  [0x33, 0x4f, 0x2a],
  grassDarkLo:[0x2b, 0x43, 0x24],
  dirt:       [0x7a, 0x5f, 0x42],
  dirtLo:     [0x67, 0x4f, 0x37],
  dirtHi:     [0x8d, 0x70, 0x50],
  water:      [0x2f, 0x5c, 0x78],
  waterLo:    [0x27, 0x4d, 0x66],
  waterHi:    [0x44, 0x77, 0x94],
  foam:       [0xc8, 0xdc, 0xe4],
  stone:      [0x6a, 0x69, 0x60],
  stoneLo:    [0x57, 0x56, 0x4e],
  stoneHi:    [0x7e, 0x7d, 0x73],
  caveFloor:  [0x4b, 0x47, 0x42],
  caveWall:   [0x2c, 0x29, 0x26],
};

const T = 32; // tile size

function grassTile(s, ox, oy, seed, dark) {
  const base = dark ? P.grassDark : P.grass;
  const lo = dark ? P.grassDarkLo : P.grassLo;
  const hi = dark ? P.grassLo : P.grassHi;
  s.rect(ox, oy, T, T, base);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const n = noise(x + ox, y + oy, seed);
      if (n > 0.86) s.px(ox + x, oy + y, hi);
      else if (n < 0.16) s.px(ox + x, oy + y, lo);
    }
  // a few blades for texture
  for (let i = 0; i < 5; i++) {
    const bx = Math.floor(noise(i, seed, 7) * (T - 4)) + 2;
    const by = Math.floor(noise(seed, i, 11) * (T - 6)) + 3;
    s.px(ox + bx, oy + by, hi);
    s.px(ox + bx, oy + by - 1, hi);
    s.px(ox + bx + 1, oy + by, lo);
  }
}

function dirtTile(s, ox, oy, seed) {
  s.rect(ox, oy, T, T, P.dirt);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const n = noise(x + ox, y + oy, seed + 3);
      if (n > 0.88) s.px(ox + x, oy + y, P.dirtHi);
      else if (n < 0.18) s.px(ox + x, oy + y, P.dirtLo);
    }
  // pebbles
  for (let i = 0; i < 4; i++) {
    const bx = Math.floor(noise(i, seed, 21) * (T - 6)) + 3;
    const by = Math.floor(noise(seed, i, 23) * (T - 6)) + 3;
    s.px(ox + bx, oy + by, P.stoneLo);
    s.px(ox + bx + 1, oy + by, P.stoneLo);
    s.px(ox + bx, oy + by + 1, P.stone);
  }
}

function waterTile(s, ox, oy, frame) {
  s.rect(ox, oy, T, T, P.water);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      if (noise(x + ox, y + oy, 5) < 0.12) s.px(ox + x, oy + y, P.waterLo);
    }
  // scrolling wave crests — offset per frame so the 3 frames loop smoothly
  for (let band = 0; band < 3; band++) {
    const wy = ((band * 11 + frame * 4) % T);
    for (let x = 0; x < T; x++) {
      const wob = Math.round(Math.sin((x + frame * 3) * 0.4 + band) * 1.2);
      if ((x + band) % 7 < 4) s.px(ox + x, oy + ((wy + wob + T) % T), P.waterHi);
    }
  }
}

function stoneTile(s, ox, oy, seed, base, lo, hi) {
  s.rect(ox, oy, T, T, base);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const n = noise(x + ox, y + oy, seed + 9);
      if (n > 0.87) s.px(ox + x, oy + y, hi);
      else if (n < 0.17) s.px(ox + x, oy + y, lo);
    }
  // horizontal strata seams
  for (let i = 0; i < 2; i++) {
    const sy = 8 + i * 13 + Math.floor(noise(seed, i, 31) * 4);
    for (let x = 0; x < T; x++) if ((x + i) % 5 !== 0) s.px(ox + x, oy + sy, lo);
  }
}

/* ================= TILE ATLAS =================
   8 columns x 3 rows of 32px tiles = 256 x 96
   Indices are consumed by world/atlasLayout.ts — keep in sync.
   row0: grass0 grass1 grass2 grassDark0 grassDark1 dirt0 dirt1 (spare)
   row1: water0 water1 water2 (spare x5)
   row2: cliff0 cliff1 caveFloor0 caveFloor1 caveWall0 caveWall1 (spare x2)
================================================ */
function buildTiles() {
  const s = new Surface(T * 8, T * 3);
  grassTile(s, 0 * T, 0, 1, false);
  grassTile(s, 1 * T, 0, 2, false);
  grassTile(s, 2 * T, 0, 3, false);
  grassTile(s, 3 * T, 0, 4, true);
  grassTile(s, 4 * T, 0, 5, true);
  dirtTile(s, 5 * T, 0, 6);
  dirtTile(s, 6 * T, 0, 7);
  grassTile(s, 7 * T, 0, 8, false);

  waterTile(s, 0 * T, T, 0);
  waterTile(s, 1 * T, T, 1);
  waterTile(s, 2 * T, T, 2);

  stoneTile(s, 0 * T, 2 * T, 11, P.stone, P.stoneLo, P.stoneHi);
  stoneTile(s, 1 * T, 2 * T, 12, P.stone, P.stoneLo, P.stoneHi);
  stoneTile(s, 2 * T, 2 * T, 13, P.caveFloor, [0x3c, 0x39, 0x35], [0x5b, 0x57, 0x51]);
  stoneTile(s, 3 * T, 2 * T, 14, P.caveFloor, [0x3c, 0x39, 0x35], [0x5b, 0x57, 0x51]);
  stoneTile(s, 4 * T, 2 * T, 15, P.caveWall, [0x1e, 0x1c, 0x1a], [0x3b, 0x37, 0x33]);
  stoneTile(s, 5 * T, 2 * T, 16, P.caveWall, [0x1e, 0x1c, 0x1a], [0x3b, 0x37, 0x33]);
  return s;
}

/* ================= PROP ATLAS =================
   8 columns x 3 rows of 64px cells = 512 x 192
   Props are drawn bottom-anchored within their cell.
   row0: pine oak willow deadTree copperVein tinVein coalRock ironRock
   row1: campfire f0..f3, ripple f0..f2, (spare)
   row2: furnace anvil (spare x6)
================================================ */
const C = 64;

function tree(s, ox, oy, kind) {
  const trunk = [0x4a, 0x37, 0x28], trunkLo = [0x3a, 0x2b, 0x1e];
  // ground shadow
  s.ellipse(ox + 32, oy + 58, 14, 5, [0, 0, 0, 60]);
  if (kind === "dead") {
    s.rect(ox + 29, oy + 26, 6, 32, trunk);
    s.rect(ox + 29, oy + 26, 2, 32, trunkLo);
    for (const [bx, by, dx] of [[29, 30, -1], [35, 36, 1], [29, 42, -1]]) {
      for (let i = 0; i < 9; i++) s.px(ox + bx + dx * i, oy + by - i, trunk);
    }
    return;
  }
  s.rect(ox + 29, oy + 40, 6, 18, trunk);
  s.rect(ox + 29, oy + 40, 2, 18, trunkLo);
  const greens = {
    pine:   [[0x2c, 0x4a, 0x28], [0x38, 0x5c, 0x32], [0x46, 0x70, 0x3e]],
    oak:    [[0x33, 0x54, 0x2c], [0x41, 0x67, 0x38], [0x52, 0x7c, 0x46]],
    willow: [[0x3a, 0x58, 0x30], [0x4a, 0x6c, 0x3c], [0x5c, 0x82, 0x4c]],
  }[kind];
  if (kind === "pine") {
    // stacked conifer skirts, widest at bottom
    for (let tier = 0; tier < 3; tier++) {
      const cy = 40 - tier * 11;
      const half = 18 - tier * 4;
      for (let y = 0; y < 14; y++) {
        const w = Math.round((half * 2) * (y / 14));
        for (let x = -w / 2; x <= w / 2; x++) {
          const shade = x < -w / 6 ? greens[2] : x > w / 6 ? greens[0] : greens[1];
          s.px(ox + 32 + x, oy + cy - 13 + y, shade);
        }
      }
    }
  } else {
    // rounded canopy in three overlapping lobes
    s.ellipse(ox + 32, oy + 28, 19, 15, greens[0]);
    s.ellipse(ox + 26, oy + 25, 13, 11, greens[1]);
    s.ellipse(ox + 37, oy + 30, 11, 9, greens[1]);
    s.ellipse(ox + 27, oy + 22, 7, 5, greens[2]);
    if (kind === "willow") {
      // drooping fronds
      for (let i = 0; i < 7; i++) {
        const fx = 16 + i * 5;
        for (let y = 0; y < 10 + (i % 3) * 4; y++) s.px(ox + fx, oy + 36 + y, greens[0]);
      }
    }
  }
}

function oreRock(s, ox, oy, oreColor, oreHi) {
  s.ellipse(ox + 32, oy + 58, 15, 5, [0, 0, 0, 60]);
  // rock body
  s.ellipse(ox + 32, oy + 44, 18, 14, P.stone);
  s.ellipse(ox + 27, oy + 40, 12, 9, P.stoneHi);
  s.ellipse(ox + 38, oy + 48, 10, 7, P.stoneLo);
  // ore flecks
  const spots = [[26, 40], [36, 44], [30, 50], [40, 38], [22, 47]];
  for (const [sx, sy] of spots) {
    s.ellipse(ox + sx, oy + sy, 3, 2, oreColor);
    s.px(ox + sx - 1, oy + sy - 1, oreHi);
  }
}

function campfire(s, ox, oy, frame) {
  s.ellipse(ox + 32, oy + 56, 13, 4, [0, 0, 0, 60]);
  // logs
  const log = [0x4a, 0x37, 0x28], logLo = [0x36, 0x28, 0x1c];
  s.rect(ox + 20, oy + 48, 24, 5, log);
  s.rect(ox + 20, oy + 51, 24, 2, logLo);
  s.rect(ox + 28, oy + 44, 8, 5, logLo);
  // embers
  s.ellipse(ox + 32, oy + 47, 7, 3, [0x8a, 0x2f, 0x12]);
  // flame — organic teardrop with a wavering edge, 4-frame loop
  const h = [17, 21, 19, 23][frame];
  const w = [8, 9, 8, 10][frame];
  for (let y = 0; y < h; y++) {
    const t = y / h;
    // widest just above the logs, tapering to a point; the exponent keeps the
    // shoulders round so it reads as a flame rather than a cone
    const bulge = Math.pow(1 - t, 0.62) * (0.82 + 0.3 * Math.sin(t * Math.PI));
    const sway = Math.sin(t * 3.4 + frame * 1.7) * 2.2 * t;
    const half = Math.max(1, Math.round(w * bulge));
    for (let x = -half; x <= half; x++) {
      const edge = Math.abs(x) > half - 2;
      const col = t > 0.66 ? [0xf7, 0xd8, 0x62]
                : t > 0.32 ? (edge ? [0xe0, 0x6a, 0x1c] : [0xf2, 0x9a, 0x28])
                : (edge ? [0xc4, 0x4c, 0x16] : [0xee, 0x82, 0x20]);
      s.px(ox + 32 + x + sway, oy + 46 - y, col);
    }
  }
  // inner white-hot core
  for (let y = 0; y < h * 0.45; y++) {
    const half = Math.max(0, Math.round(3 * (1 - y / (h * 0.45))));
    for (let x = -half; x <= half; x++) s.px(ox + 32 + x, oy + 44 - y, [0xff, 0xef, 0xb4]);
  }
  // rising spark
  s.px(ox + 32 + (frame % 2 ? 2 : -2), oy + 44 - h - 3, [0xff, 0xd8, 0x70]);
}

function ripple(s, ox, oy, frame) {
  // Expanding concentric rings, 2px thick so they actually read over water.
  const ring = (r, alpha) => {
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      const x = ox + 32 + Math.cos(rad) * r;
      const y = oy + 44 + Math.sin(rad) * r * 0.5;
      s.px(x, y, [...P.foam, alpha]);
      s.px(x, y + 1, [...P.foam, Math.round(alpha * 0.55)]);
    }
  };
  ring(9 + frame * 6, 255 - frame * 45);
  ring(4 + frame * 5, 190 - frame * 50);
  // disturbed centre
  if (frame === 0) {
    s.ellipse(ox + 32, oy + 44, 3, 2, [...P.foam, 220]);
  }
  // a couple of splash flecks on the first frame
  if (frame === 0) {
    for (const [dx, dy] of [[-7, -4], [6, -5], [1, -7]]) {
      s.px(ox + 32 + dx, oy + 44 + dy, [...P.foam, 230]);
    }
  }
}

function furnace(s, ox, oy) {
  s.ellipse(ox + 32, oy + 58, 17, 5, [0, 0, 0, 60]);
  s.rect(ox + 16, oy + 22, 32, 36, P.stone);
  s.rect(ox + 16, oy + 22, 32, 4, P.stoneHi);
  s.rect(ox + 16, oy + 22, 4, 36, P.stoneHi);
  s.rect(ox + 44, oy + 22, 4, 36, P.stoneLo);
  // chimney
  s.rect(ox + 22, oy + 12, 12, 12, P.stoneLo);
  // mouth + fire glow
  s.rect(ox + 24, oy + 38, 16, 14, [0x1a, 0x14, 0x10]);
  s.ellipse(ox + 32, oy + 47, 7, 5, [0xd4, 0x5c, 0x1e]);
  s.ellipse(ox + 32, oy + 48, 4, 3, [0xf5, 0xd0, 0x53]);
}

function anvil(s, ox, oy) {
  s.ellipse(ox + 32, oy + 58, 15, 5, [0, 0, 0, 60]);
  // stump
  s.rect(ox + 24, oy + 44, 16, 12, [0x4a, 0x37, 0x28]);
  s.rect(ox + 24, oy + 44, 4, 12, [0x36, 0x28, 0x1c]);
  // anvil body
  const iron = [0x45, 0x48, 0x50], ironHi = [0x62, 0x66, 0x70], ironLo = [0x2e, 0x30, 0x36];
  s.rect(ox + 20, oy + 30, 24, 7, iron);
  s.rect(ox + 20, oy + 30, 24, 2, ironHi);
  s.rect(ox + 27, oy + 37, 10, 7, ironLo);
  // horn
  for (let i = 0; i < 7; i++) s.rect(ox + 13 + i, oy + 31 + Math.floor(i / 3), 2, 4 - Math.floor(i / 3), iron);
}

function buildProps() {
  const s = new Surface(C * 8, C * 3);
  tree(s, 0 * C, 0, "pine");
  tree(s, 1 * C, 0, "oak");
  tree(s, 2 * C, 0, "willow");
  tree(s, 3 * C, 0, "dead");
  oreRock(s, 4 * C, 0, [0xb8, 0x6b, 0x2e], [0xe0, 0x9a, 0x4e]); // copper
  oreRock(s, 5 * C, 0, [0xc8, 0xcc, 0xd2], [0xe8, 0xec, 0xf2]); // tin
  oreRock(s, 6 * C, 0, [0x2a, 0x28, 0x28], [0x4a, 0x48, 0x48]); // coal
  oreRock(s, 7 * C, 0, [0x8a, 0x6a, 0x58], [0xb0, 0x8c, 0x76]); // iron

  for (let f = 0; f < 4; f++) campfire(s, f * C, C, f);
  for (let f = 0; f < 3; f++) ripple(s, (4 + f) * C, C, f);

  furnace(s, 0 * C, 2 * C);
  anvil(s, 1 * C, 2 * C);
  return s;
}

const outDir = process.argv[2];
if (!outDir) { console.error("usage: node gen-tiles.js <outDir>"); process.exit(1); }
const worldDir = path.join(outDir, "world");
fs.mkdirSync(worldDir, { recursive: true });

for (const [name, surf] of [["tiles", buildTiles()], ["props", buildProps()]]) {
  const f = path.join(worldDir, `${name}.png`);
  fs.writeFileSync(f, surf.png());
  console.log(`wrote ${f} — ${surf.w}x${surf.h}, ${fs.statSync(f).size} bytes`);
}
