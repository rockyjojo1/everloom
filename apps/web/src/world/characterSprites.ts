/**
 * Character sprite generation and loading
 * For Phase 2: Uses procedurally generated placeholders pending real LPC sheets
 * Real LPC sheets from the Universal LPC Spritesheet Generator can replace these
 */

export type SpriteLayer = 'body' | 'legs' | 'torso' | 'hair';

/**
 * Load or generate character sprite layers
 * Currently generates procedural placeholders with proper dimensions
 * Real LPC sheets can be substituted via the web folder
 */
export async function loadCharacterLayers(): Promise<Record<SpriteLayer, HTMLImageElement>> {
  const layers: Record<SpriteLayer, HTMLImageElement> = {
    body: new Image(),
    legs: new Image(),
    torso: new Image(),
    hair: new Image(),
  };

  // Generate placeholder sprites with correct dimensions
  // Format: 64×64px frames, 9 cols (walk frames), 16 rows (animations)
  const spriteCanvas = generatePlaceholderSpriteSheet();

  // For now, use the same placeholder for all layers
  // Real LPC sheets would be loaded from /sprites/char/
  const spriteData = spriteCanvas.toDataURL();

  for (const layer of Object.keys(layers) as SpriteLayer[]) {
    layers[layer].src = spriteData;
    await new Promise((resolve) => {
      layers[layer].onload = resolve;
    });
  }

  return layers;
}

/**
 * Generate a placeholder character spritesheet
 * 9 columns × 16 rows of 64×64px frames
 * Real LPC sheets are 576×1024px (9×16 frames)
 */
function generatePlaceholderSpriteSheet(): HTMLCanvasElement {
  const FRAME_SIZE = 64;
  const COLS = 9;
  const ROWS = 16;

  const canvas = document.createElement('canvas');
  canvas.width = FRAME_SIZE * COLS;
  canvas.height = FRAME_SIZE * ROWS;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Draw placeholder frames
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * FRAME_SIZE;
      const y = row * FRAME_SIZE;

      // Choose color based on animation type
      let color = '#E8DCC4'; // base skin tone

      if (row >= 8 && row <= 11) {
        // Walk animations - head + body outline
        drawCharacterFrame(ctx, x, y, FRAME_SIZE, '#E8DCC4', '#8B4513', '#4A3728');
      } else if (row >= 12 && row <= 15) {
        // Chop/slash animations
        drawCharacterFrameWithWeapon(ctx, x, y, FRAME_SIZE, '#E8DCC4', '#8B4513', '#4A3728', col);
      } else if (row >= 4 && row <= 7) {
        // Mine/thrust animations
        drawCharacterFrameWithWeapon(ctx, x, y, FRAME_SIZE, '#E8DCC4', '#8B4513', '#4A3728', col);
      } else {
        // Idle/other
        drawCharacterFrame(ctx, x, y, FRAME_SIZE, '#E8DCC4', '#8B4513', '#4A3728');
      }
    }
  }

  return canvas;
}

/**
 * Draw a simple character frame (placeholder)
 */
function drawCharacterFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  skinColor: string,
  hairColor: string,
  bodyColor: string
) {
  // Head
  ctx.fillStyle = skinColor;
  ctx.fillRect(x + 24, y + 4, 16, 16);

  // Hair
  ctx.fillStyle = hairColor;
  ctx.fillRect(x + 22, y + 2, 20, 6);

  // Body
  ctx.fillStyle = bodyColor;
  ctx.fillRect(x + 22, y + 20, 20, 16);

  // Arms (simple rectangles)
  ctx.fillStyle = skinColor;
  ctx.fillRect(x + 16, y + 22, 6, 14);
  ctx.fillRect(x + 42, y + 22, 6, 14);

  // Legs
  ctx.fillStyle = '#333333'; // pants
  ctx.fillRect(x + 24, y + 36, 7, 14);
  ctx.fillRect(x + 33, y + 36, 7, 14);

  // Border for visibility
  ctx.strokeStyle = '#00000033';
  ctx.strokeRect(x, y, size, size);
}

/**
 * Draw a character frame with a weapon (for chop/mine animations)
 */
function drawCharacterFrameWithWeapon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  skinColor: string,
  hairColor: string,
  bodyColor: string,
  frameOffset: number
) {
  // Base character
  drawCharacterFrame(ctx, x, y, size, skinColor, hairColor, bodyColor);

  // Weapon angle based on frame
  const angle = (frameOffset / 6) * Math.PI * 2;

  ctx.save();
  ctx.translate(x + 32, y + 28);
  ctx.rotate(angle);

  // Draw axe/pickaxe
  ctx.fillStyle = '#8B7355';
  ctx.fillRect(-2, -20, 4, 20);

  ctx.fillStyle = '#DAA520';
  ctx.fillRect(-8, -22, 16, 4);

  ctx.restore();

  ctx.strokeStyle = '#00000033';
  ctx.strokeRect(x, y, size, size);
}

/**
 * Create a tinted version of a sprite layer
 * Uses canvas blending to apply color tint
 */
export function tintSpriteLayer(
  source: HTMLImageElement,
  tintColor: string
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Draw original image
  ctx.drawImage(source, 0, 0);

  // Apply color tint using multiply
  ctx.fillStyle = tintColor;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Restore normal blending
  ctx.globalCompositeOperation = 'source-over';

  return canvas;
}

/**
 * Composite multiple sprite layers
 * Order: body → legs → torso → hair (bottom to top)
 */
export function compositeLayers(
  layers: Record<string, HTMLCanvasElement | undefined>,
  layerOrder: string[] = ['body', 'legs', 'torso', 'hair']
): HTMLCanvasElement {
  if (layerOrder.length === 0) {
    const fallback = document.createElement('canvas');
    fallback.width = 576;
    fallback.height = 1024;
    return fallback;
  }

  let firstLayer: HTMLCanvasElement | undefined;
  for (const layerName of layerOrder) {
    if (layers[layerName]) {
      firstLayer = layers[layerName];
      break;
    }
  }

  if (!firstLayer) {
    const fallback = document.createElement('canvas');
    fallback.width = 576;
    fallback.height = 1024;
    return fallback;
  }

  const result = document.createElement('canvas');
  result.width = firstLayer.width;
  result.height = firstLayer.height;

  const ctx = result.getContext('2d');
  if (!ctx) return result;

  // Draw each layer in order
  for (const layerName of layerOrder) {
    const layer = layers[layerName];
    if (layer) {
      ctx.drawImage(layer, 0, 0);
    }
  }

  ctx.imageSmoothingEnabled = false;

  return result;
}
