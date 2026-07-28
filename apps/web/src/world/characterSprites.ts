/**
 * Character spritesheet generation.
 *
 * Builds a full LPC-LAYOUT sheet (9 cols x 16 rows of 64px frames) at runtime
 * from the player's chosen appearance colours, with real limb articulation per
 * frame. Laying it out to the LPC grid means a genuine Universal-LPC export can
 * be dropped in later and read by the same row/col tables in world/character.ts.
 *
 * Row layout (LPC standard):
 *   0-3   idle stand   (up, left, down, right)  - col 0 only
 *   4-7   thrust       (up, left, down, right)  - 8 frames  -> mining / fishing
 *   8-11  walk         (up, left, down, right)  - 9 frames
 *   12-15 slash        (up, left, down, right)  - 6 frames  -> woodcutting
 */

export const FRAME_SIZE = 64;
export const SHEET_COLS = 9;
export const SHEET_ROWS = 16;

export interface CharacterColors {
  skin: string;
  hair: string;
  torso: string;
  legs: string;
}

type Dir = 0 | 1 | 2 | 3; // up, left, down, right

/** Darken a hex colour by `amt` (0-1) for shading. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amt)));
  return `rgb(${r},${g},${b})`;
}

/** Rotate a limb about its top end and fill it as a rectangle. */
function limb(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  angleDeg: number, color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, 0, w, h);
  ctx.restore();
}

/**
 * Draw one character frame.
 * `swing` drives limb rotation (-1..1); `toolArm` overrides the front arm angle.
 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number,
  c: CharacterColors,
  dir: Dir,
  swing: number,
  toolArm: number | null,
  tool: "axe" | "pick" | "rod" | null
) {
  const cx = ox + 32;
  const groundY = oy + 56;
  const facingSide = dir === 1 || dir === 3;
  const flip = dir === 1 ? -1 : 1; // left-facing mirrors the tool

  const skinLo = shade(c.skin, 0.22);
  const legLo = shade(c.legs, 0.25);
  const torsoLo = shade(c.torso, 0.22);
  const hairLo = shade(c.hair, 0.3);

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 2, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const hipY = groundY - 16;
  const legAngle = swing * 26;

  // legs (back leg drawn first so the front one overlaps)
  limb(ctx, cx - (facingSide ? 1 : 4), hipY, 5, 16, -legAngle, legLo);
  limb(ctx, cx + (facingSide ? 1 : 4), hipY, 5, 16, legAngle, c.legs);

  // torso
  const torsoTop = groundY - 32;
  ctx.fillStyle = c.torso;
  ctx.fillRect(cx - 7, torsoTop, 14, 16);
  ctx.fillStyle = torsoLo;
  ctx.fillRect(cx - 7, torsoTop, 3, 16);
  ctx.fillRect(cx - 7, torsoTop + 14, 14, 2);

  // arms
  const shoulderY = torsoTop + 2;
  const backArm = toolArm !== null ? -swing * 18 : -swing * 30;
  limb(ctx, cx - 8 * (facingSide ? 0.4 : 1), shoulderY, 4, 14, backArm, skinLo);

  const frontArmAngle = toolArm !== null ? toolArm : swing * 30;
  const frontShoulderX = cx + 8 * (facingSide ? 0.4 : 1);
  limb(ctx, frontShoulderX, shoulderY, 4, 14, frontArmAngle, c.skin);

  // tool in the front hand
  if (tool) {
    ctx.save();
    ctx.translate(frontShoulderX, shoulderY);
    ctx.rotate((frontArmAngle * Math.PI) / 180);
    ctx.translate(0, 13);
    ctx.scale(flip, 1);
    ctx.fillStyle = "#6b4f33";
    ctx.fillRect(-1.5, -2, 3, 18);
    if (tool === "axe") {
      ctx.fillStyle = "#9aa0a8";
      ctx.fillRect(-1, 12, 9, 6);
      ctx.fillStyle = "#c8ced6";
      ctx.fillRect(5, 12, 3, 6);
    } else if (tool === "pick") {
      ctx.fillStyle = "#9aa0a8";
      ctx.fillRect(-8, 13, 17, 3);
      ctx.fillStyle = "#c8ced6";
      ctx.fillRect(-8, 13, 4, 3);
    } else {
      ctx.fillStyle = "#7a5a3a";
      ctx.fillRect(-1, -14, 2, 20);
    }
    ctx.restore();
  }

  // head
  const headY = torsoTop - 13;
  ctx.fillStyle = c.skin;
  ctx.fillRect(cx - 6, headY, 12, 13);
  ctx.fillStyle = skinLo;
  ctx.fillRect(cx - 6, headY, 2, 13);

  // hair — the back of the head is solid when facing away
  ctx.fillStyle = c.hair;
  ctx.fillRect(cx - 7, headY - 2, 14, 6);
  if (dir === 0) {
    ctx.fillRect(cx - 7, headY - 2, 14, 12);
  } else {
    ctx.fillStyle = hairLo;
    ctx.fillRect(cx - 7, headY - 2, 14, 2);
    ctx.fillStyle = c.hair;
    if (facingSide) {
      ctx.fillRect(cx - 7 + (flip < 0 ? 10 : 0), headY - 2, 4, 10);
    } else {
      ctx.fillRect(cx - 7, headY - 2, 3, 8);
      ctx.fillRect(cx + 4, headY - 2, 3, 8);
    }
  }

  // face
  if (dir !== 0) {
    ctx.fillStyle = "#241a12";
    if (facingSide) {
      ctx.fillRect(cx + (flip > 0 ? 2 : -4), headY + 5, 2, 2);
    } else {
      ctx.fillRect(cx - 4, headY + 5, 2, 2);
      ctx.fillRect(cx + 2, headY + 5, 2, 2);
    }
  }
}

/**
 * Build the full spritesheet for a given appearance (576 x 1024).
 * Cached by the caller — this is not cheap enough to run per frame.
 */
export function buildCharacterSheet(c: CharacterColors): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_SIZE * SHEET_COLS;
  canvas.height = FRAME_SIZE * SHEET_ROWS;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;

  const at = (row: number, col: number) => ({ ox: col * FRAME_SIZE, oy: row * FRAME_SIZE });

  for (let d = 0; d < 4; d++) {
    const dir = d as Dir;

    // idle: rows 0-3
    const idle = at(d, 0);
    drawFrame(ctx, idle.ox, idle.oy, c, dir, 0, null, null);

    // walk: rows 8-11, 9 frames (full sine cycle -> seamless loop)
    for (let f = 0; f < 9; f++) {
      const { ox, oy } = at(8 + d, f);
      const phase = (f / 9) * Math.PI * 2;
      const swing = Math.sin(phase);
      const bob = Math.abs(Math.cos(phase)) < 0.35 ? -1 : 0;
      ctx.save();
      ctx.translate(0, bob);
      drawFrame(ctx, ox, oy, c, dir, swing, null, null);
      ctx.restore();
    }

    // slash (woodcutting): rows 12-15, 6 frames — slow wind-up, fast strike
    for (let f = 0; f < 6; f++) {
      const { ox, oy } = at(12 + d, f);
      const t = f / 5;
      const arm = t < 0.45
        ? -150 + (t / 0.45) * 20
        : -130 + ((t - 0.45) / 0.55) * 185;
      drawFrame(ctx, ox, oy, c, dir, 0, arm, "axe");
    }

    // thrust (mining / fishing): rows 4-7, 8 frames
    for (let f = 0; f < 8; f++) {
      const { ox, oy } = at(4 + d, f);
      const t = f / 7;
      const arm = t < 0.5
        ? -110 + (t / 0.5) * 25
        : -85 + ((t - 0.5) / 0.5) * 150;
      drawFrame(ctx, ox, oy, c, dir, 0, arm, "pick");
    }
  }

  return canvas;
}
