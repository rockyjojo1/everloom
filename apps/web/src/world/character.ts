/**
 * LPC Character rendering: compositing, tinting, animation frame extraction
 */

export type CharacterAppearance = {
  skin: string;     // skin tone color hex
  hair: string;     // hair color hex
  torso: string;    // shirt/body color hex
  legs: string;     // pants color hex
  hairStyle: string; // hair style name
};

export type ActionAnimationType = 'idle' | 'walk' | 'chop' | 'mine' | 'fish' | 'cook';

export type WalkDirection = 'up' | 'left' | 'down' | 'right';

/**
 * LPC Spritesheet standard format:
 * - 64×64px frames
 * - Multiple rows for different actions
 * - Multiple columns for animation frames
 *
 * Row layout (universal LPC):
 * - Rows 0-1: Idle/stand
 * - Rows 2-3: Walking up
 * - Rows 4-7: Thrust (mining, fishing)
 * - Rows 8-11: Walk (up, left, down, right) with 9 frames each
 * - Rows 12-15: Slash/chop (up, left, down, right) with 6 frames each
 */

export interface AnimationFrame {
  row: number;
  col: number;
  duration: number; // ms
}

export interface Animation {
  frames: AnimationFrame[];
  loop: boolean;
}

const FRAME_SIZE = 64; // px

/**
 * Animation definitions extracted from LPC spritesheet rows
 */
export const ANIMATIONS: Record<ActionAnimationType, Animation | Record<WalkDirection, Animation>> = {
  idle: {
    frames: [{ row: 0, col: 0, duration: 500 }],
    loop: true,
  },

  walk: {
    up: {
      frames: [
        { row: 8, col: 0, duration: 60 },
        { row: 8, col: 1, duration: 60 },
        { row: 8, col: 2, duration: 60 },
        { row: 8, col: 3, duration: 60 },
        { row: 8, col: 4, duration: 60 },
        { row: 8, col: 5, duration: 60 },
        { row: 8, col: 6, duration: 60 },
        { row: 8, col: 7, duration: 60 },
        { row: 8, col: 8, duration: 60 },
      ],
      loop: true,
    },
    left: {
      frames: [
        { row: 9, col: 0, duration: 60 },
        { row: 9, col: 1, duration: 60 },
        { row: 9, col: 2, duration: 60 },
        { row: 9, col: 3, duration: 60 },
        { row: 9, col: 4, duration: 60 },
        { row: 9, col: 5, duration: 60 },
        { row: 9, col: 6, duration: 60 },
        { row: 9, col: 7, duration: 60 },
        { row: 9, col: 8, duration: 60 },
      ],
      loop: true,
    },
    down: {
      frames: [
        { row: 10, col: 0, duration: 60 },
        { row: 10, col: 1, duration: 60 },
        { row: 10, col: 2, duration: 60 },
        { row: 10, col: 3, duration: 60 },
        { row: 10, col: 4, duration: 60 },
        { row: 10, col: 5, duration: 60 },
        { row: 10, col: 6, duration: 60 },
        { row: 10, col: 7, duration: 60 },
        { row: 10, col: 8, duration: 60 },
      ],
      loop: true,
    },
    right: {
      frames: [
        { row: 11, col: 0, duration: 60 },
        { row: 11, col: 1, duration: 60 },
        { row: 11, col: 2, duration: 60 },
        { row: 11, col: 3, duration: 60 },
        { row: 11, col: 4, duration: 60 },
        { row: 11, col: 5, duration: 60 },
        { row: 11, col: 6, duration: 60 },
        { row: 11, col: 7, duration: 60 },
        { row: 11, col: 8, duration: 60 },
      ],
      loop: true,
    },
  },

  chop: {
    frames: [
      { row: 12, col: 0, duration: 80 },
      { row: 12, col: 1, duration: 80 },
      { row: 12, col: 2, duration: 80 },
      { row: 12, col: 3, duration: 80 },
      { row: 12, col: 4, duration: 80 },
      { row: 12, col: 5, duration: 80 },
    ],
    loop: true,
  },

  mine: {
    frames: [
      { row: 4, col: 0, duration: 80 },
      { row: 4, col: 1, duration: 80 },
      { row: 4, col: 2, duration: 80 },
      { row: 4, col: 3, duration: 80 },
      { row: 4, col: 4, duration: 80 },
      { row: 4, col: 5, duration: 80 },
      { row: 4, col: 6, duration: 80 },
      { row: 4, col: 7, duration: 80 },
    ],
    loop: true,
  },

  fish: {
    frames: [
      { row: 4, col: 0, duration: 100 },
      { row: 4, col: 1, duration: 100 },
      { row: 4, col: 2, duration: 100 },
      { row: 4, col: 3, duration: 100 },
    ],
    loop: true,
  },

  cook: {
    frames: [
      { row: 2, col: 0, duration: 100 },
      { row: 2, col: 1, duration: 100 },
      { row: 2, col: 2, duration: 100 },
    ],
    loop: true,
  },
};

/**
 * Composite character appearance into a single canvas
 * Layers: body → legs → torso → hair
 */
export function compositeCharacter(
  appearance: CharacterAppearance,
  layerImages: Record<string, HTMLImageElement | null>
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_SIZE * 9; // 9 walk frames
  canvas.height = FRAME_SIZE * 16; // 16 rows of animations

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Layer order: body → legs → torso → hair
  const layers = [
    { key: 'body', color: appearance.skin },
    { key: 'legs', color: appearance.legs },
    { key: 'torso', color: appearance.torso },
    { key: 'hair', color: appearance.hair },
  ];

  // Draw each layer, tinting colors if needed
  for (const layer of layers) {
    const img = layerImages[layer.key];
    if (!img) continue;

    // Tint the layer
    const tintedLayer = tintImage(img, layer.color);
    ctx.drawImage(tintedLayer, 0, 0);
  }

  ctx.imageSmoothingEnabled = false;
  return canvas;
}

/**
 * Tint an image using globalCompositeOperation
 * Applies color overlay while preserving luminosity
 */
export function tintImage(img: HTMLImageElement, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Draw original image
  ctx.drawImage(img, 0, 0);

  // Apply color tint using multiply blend
  ctx.fillStyle = color;
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;

  return canvas;
}

/**
 * Extract a single animation frame from a composite spritesheet
 */
export function extractFrame(
  spritesheet: HTMLCanvasElement,
  row: number,
  col: number
): HTMLCanvasElement {
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = FRAME_SIZE;
  frameCanvas.height = FRAME_SIZE;

  const ctx = frameCanvas.getContext('2d');
  if (!ctx) return frameCanvas;

  const sx = col * FRAME_SIZE;
  const sy = row * FRAME_SIZE;

  ctx.drawImage(spritesheet, sx, sy, FRAME_SIZE, FRAME_SIZE, 0, 0, FRAME_SIZE, FRAME_SIZE);
  ctx.imageSmoothingEnabled = false;

  return frameCanvas;
}

/**
 * Get the current animation and frame for a character
 */
export function getCurrentFrame(
  action: ActionAnimationType,
  direction: WalkDirection,
  elapsed: number // ms since action start
): AnimationFrame {
  let anim: Animation | undefined;

  if (action === 'walk') {
    const walkAnims = ANIMATIONS.walk as Record<WalkDirection, Animation>;
    anim = walkAnims[direction];
  } else {
    const animData = ANIMATIONS[action];
    if (animData && 'frames' in animData) {
      anim = animData as Animation;
    }
  }

  if (!anim) {
    const idleAnim = ANIMATIONS.idle as Animation;
    return idleAnim.frames[0] || { row: 0, col: 0, duration: 100 };
  }

  // Calculate current frame based on elapsed time
  let totalDuration = 0;
  for (const frame of anim.frames) {
    totalDuration += frame.duration;
  }

  let adjustedElapsed = elapsed % totalDuration;
  let currentTime = 0;

  for (const frame of anim.frames) {
    if (currentTime + frame.duration > adjustedElapsed) {
      return frame;
    }
    currentTime += frame.duration;
  }

  return anim.frames[anim.frames.length - 1] || { row: 0, col: 0, duration: 100 };
}
