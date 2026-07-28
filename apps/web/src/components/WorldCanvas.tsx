import { useEffect, useRef, useState } from 'react';
import { MEADOWREST, getTile, isWalkable, ZoneMap } from '../world/zonemaps';
import { useGameStore } from '../store/gameStore';
import { loadCharacterLayers, tintSpriteLayer, compositeLayers } from '../world/characterSprites';
import { ANIMATIONS, getCurrentFrame, extractFrame, ActionAnimationType } from '../world/character';
import { appearanceToColors } from '../lib/appearanceColors';

interface LoadedTexture {
  img: HTMLImageElement;
  loaded: boolean;
}

const TILE_SIZE_SRC = 32; // source size
const TILE_SIZE_DRAWN = 64; // drawn at 2× scale
const SCALE = 2;

const WATER_FRAME_DURATION = 150; // ms per frame (3 frames ≈ 450ms total)

/**
 * WorldCanvas: Main game world renderer using canvas + RAF loop
 * - Renders tiles from terrain spritesheet
 * - Animates water (3 frames)
 * - Renders nodes, decor, character with y-sorting
 * - Handles click markers
 */
export function WorldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [textures, setTextures] = useState<Record<string, LoadedTexture>>({});
  const [characterSprite, setCharacterSprite] = useState<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();
  const waterFrameRef = useRef(0);
  const lastWaterTimeRef = useRef(Date.now());
  const actionStartTimeRef = useRef(Date.now());

  // Get current action from game store
  const playerState = useGameStore((s) => s.playerState);
  const currentAction = playerState?.currentAction;
  const appearance = playerState?.appearance;

  // Load sprites and character on mount
  useEffect(() => {
    const loaded: Record<string, LoadedTexture> = {};
    const textureFiles = ['world/terrain.png', 'world/trees.png', 'world/rocks.png', 'world/water_anim.png'];

    const loadTexture = (file: string) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          loaded[file] = { img, loaded: true };
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load texture: ${file}`);
          loaded[file] = { img, loaded: false };
          resolve();
        };
        img.src = `/sprites/${file}`;
      });
    };

    Promise.all(textureFiles.map(loadTexture)).then(() => {
      setTextures(loaded);
    });

    // Load character sprites
    (async () => {
      try {
        const layers = await loadCharacterLayers();
        const appColors = appearanceToColors(appearance);

        // Tint each layer based on appearance
        const tintedLayers: Record<string, HTMLCanvasElement> = {
          body: tintSpriteLayer(layers.body, appColors.skin),
          legs: tintSpriteLayer(layers.legs, appColors.legs),
          torso: tintSpriteLayer(layers.torso, appColors.torso),
          hair: tintSpriteLayer(layers.hair, appColors.hair),
        };

        // Composite all layers
        const composite = compositeLayers(tintedLayers);
        setCharacterSprite(composite);
      } catch (err) {
        console.error('Failed to load character sprites:', err);
      }
    })();
  }, [appearance]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !textures['world/terrain.png']?.loaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const zone = MEADOWREST;
    const canvasWidth = zone.width * TILE_SIZE_DRAWN;
    const canvasHeight = zone.height * TILE_SIZE_DRAWN;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Disable image smoothing for pixel-perfect rendering
    ctx.imageSmoothingEnabled = false;

    /**
     * Draw a tile from the terrain atlas
     * Row/col are in the source 32×32 grid
     */
    const drawTile = (tx: number, ty: number, row: number, col: number, texture: HTMLImageElement) => {
      const sx = col * TILE_SIZE_SRC;
      const sy = row * TILE_SIZE_SRC;
      const dx = tx * TILE_SIZE_DRAWN;
      const dy = ty * TILE_SIZE_DRAWN;

      ctx!.drawImage(
        texture,
        sx, sy, TILE_SIZE_SRC, TILE_SIZE_SRC,
        dx, dy, TILE_SIZE_DRAWN, TILE_SIZE_DRAWN
      );
    };

    /**
     * Update water animation frame (3 frames at 150ms each)
     */
    const updateWaterFrame = () => {
      const now = Date.now();
      const elapsed = now - lastWaterTimeRef.current;

      if (elapsed >= WATER_FRAME_DURATION) {
        waterFrameRef.current = (waterFrameRef.current + 1) % 3;
        lastWaterTimeRef.current = now;
      }
    };

    /**
     * Render frame
     */
    const render = () => {
      updateWaterFrame();

      const terrainTexture = textures['world/terrain.png']!.img;
      const waterTexture = textures['world/water_anim.png']?.img;

      // 1. Ground layer: render all tiles
      for (let ty = 0; ty < zone.height; ty++) {
        for (let tx = 0; tx < zone.width; tx++) {
          const tile = getTile(zone, tx, ty);
          if (!tile || tile === '.') continue;

          let row = 0, col = 0;
          switch (tile) {
            case 'g': row = 0; col = 0; break; // light grass
            case 'G': row = 0; col = 1; break; // dark grass
            case 'p': row = 1; col = 0; break; // dirt path
            case 'w': row = 2; col = waterFrameRef.current; break; // water animated
            case 'W': row = 2; col = 3 + waterFrameRef.current; break; // deep water animated
            case 'c': row = 3; col = 0; break; // cliff
          }

          drawTile(tx, ty, row, col, terrainTexture);
        }
      }

      // 2. Y-sorted entities: nodes, decor, character
      // Sort by (ty, py) so entities lower on screen render last (on top)
      const entities: Array<{ ty: number; px: number; py: number; id: string; type: 'node' | 'decor' | 'char' }> = [];

      // Add nodes
      for (const node of zone.nodes) {
        entities.push({
          ty: node.ty,
          px: node.tx * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN / 2,
          py: node.ty * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN,
          id: node.nodeId,
          type: 'node',
        });
      }

      // Add decor
      for (const dec of zone.decor) {
        entities.push({
          ty: dec.ty,
          px: dec.tx * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN / 2,
          py: dec.ty * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN,
          id: dec.spriteId,
          type: 'decor',
        });
      }

      // Add character (placeholder at spawn)
      entities.push({
        ty: zone.spawnTy,
        px: zone.spawnTx * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN / 2,
        py: zone.spawnTy * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN,
        id: 'player',
        type: 'char',
      });

      entities.sort((a, b) => a.py - b.py || a.ty - b.ty);

      // Draw sorted entities
      for (const ent of entities) {
        if (ent.type === 'node') {
          // Draw node sprite (placeholder: 16×16 colored circle)
          ctx!.fillStyle = '#8B4513';
          ctx!.fillRect(ent.px - 16, ent.py - 32, 32, 32);
        } else if (ent.type === 'decor') {
          // Draw decor (placeholder)
          ctx!.fillStyle = '#228B22';
          ctx!.fillRect(ent.px - 16, ent.py - 48, 32, 32);
        } else if (ent.type === 'char' && characterSprite) {
          // Draw character sprite with animation
          if (currentAction) {
            const actionType = (currentAction.type === 'woodcutting' ? 'chop' :
                               currentAction.type === 'mining' ? 'mine' :
                               currentAction.type === 'fishing' ? 'fish' :
                               currentAction.type === 'cooking' ? 'cook' :
                               'idle') as ActionAnimationType;

            const elapsedMs = Date.now() - actionStartTimeRef.current;
            const frame = getCurrentFrame(actionType, 'down', elapsedMs);
            const frameCanvas = extractFrame(characterSprite, frame.row, frame.col);

            // Draw at character position (centered, y-sorted)
            ctx!.drawImage(
              frameCanvas,
              ent.px - 32, // centered (64px frame width)
              ent.py - 64  // bottom of character at py
            );
          }
        }
      }

      // 3. Click marker (placeholder)
      // TODO: render click marker when implemented

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [textures, characterSprite, currentAction]);

  // Reset animation timer when action changes
  useEffect(() => {
    actionStartTimeRef.current = Date.now();
  }, [currentAction?.type]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        flex: 1,
        imageRendering: 'crisp-edges',
        backgroundColor: '#000',
      } as any}
    />
  );
}
