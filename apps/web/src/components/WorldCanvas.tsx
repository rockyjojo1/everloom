import { useEffect, useRef, useState } from 'react';
import { MEADOWREST, getTile, isWalkable, ZoneMap } from '../world/zonemaps';
import { useGameStore } from '../store/gameStore';
import { loadCharacterLayers, tintSpriteLayer, compositeLayers } from '../world/characterSprites';
import { ANIMATIONS, getCurrentFrame, extractFrame, ActionAnimationType } from '../world/character';
import { appearanceToColors } from '../lib/appearanceColors';
import { MovementState, findPath, getAdjacentWalkable, updateMovement, startWalking, stopWalking } from '../world/movement';

interface LoadedTexture {
  img: HTMLImageElement;
  loaded: boolean;
}

interface ClickMarker {
  px: number;
  py: number;
  startTime: number;
  isRed: boolean; // true for node interaction, false for walk
}

const TILE_SIZE_SRC = 32; // source size
const TILE_SIZE_DRAWN = 64; // drawn at 2× scale
const WATER_FRAME_DURATION = 150; // ms per frame
const CLICK_MARKER_DURATION = 400; // ms total

/**
 * WorldCanvas: Main game world renderer with movement, pathfinding, and click handling
 */
export function WorldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [textures, setTextures] = useState<Record<string, LoadedTexture>>({});
  const [characterSprite, setCharacterSprite] = useState<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();
  const waterFrameRef = useRef(0);
  const lastWaterTimeRef = useRef(Date.now());
  const lastFrameTimeRef = useRef(Date.now());
  const actionStartTimeRef = useRef(Date.now());

  // Movement state
  const movementRef = useRef<MovementState>({
    tx: MEADOWREST.spawnTx,
    ty: MEADOWREST.spawnTy,
    px: MEADOWREST.spawnTx * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN / 2,
    py: MEADOWREST.spawnTy * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN,
    facing: 'down',
    path: [],
    walking: false,
    lastWalkTime: 0,
    pendingAction: null,
  });

  const clickMarkersRef = useRef<ClickMarker[]>([]);

  // Get current action from game store
  const playerState = useGameStore((s) => s.playerState);
  const startAction = useGameStore((s) => s.startAction);
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
    ctx.imageSmoothingEnabled = false;

    // Click handler
    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Hit-test nodes first
      for (const node of zone.nodes) {
        const nodePx = node.tx * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN / 2;
        const nodePy = node.ty * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN;

        // Hit-box around node
        if (Math.abs(clickX - nodePx) < 32 && Math.abs(clickY - nodePy) < 32) {
          // Click on a node
          const adjTile = getAdjacentWalkable(zone, node.tx, node.ty);
          if (adjTile) {
            stopWalking(movementRef.current);
            startWalking(movementRef.current, zone, adjTile.tx, adjTile.ty, {
              type: 'gather',
              nodeId: node.nodeId,
            });
            clickMarkersRef.current.push({
              px: clickX,
              py: clickY,
              startTime: Date.now(),
              isRed: true,
            });
            return;
          }
        }
      }

      // Otherwise check if walkable tile
      const tileX = Math.floor(clickX / TILE_SIZE_DRAWN);
      const tileY = Math.floor(clickY / TILE_SIZE_DRAWN);

      if (tileX >= 0 && tileX < zone.width && tileY >= 0 && tileY < zone.height) {
        const tile = getTile(zone, tileX, tileY);
        if (tile && isWalkable(tile)) {
          // Cancel current action and walk
          if (currentAction && currentAction.type !== 'idle') {
            startAction({
              type: 'idle',
              nodeId: null,
              zoneId: zone.zoneId as any,
              recipeId: null,
              targetZoneId: null,
            });
          }
          stopWalking(movementRef.current);
          startWalking(movementRef.current, zone, tileX, tileY);
          clickMarkersRef.current.push({
            px: clickX,
            py: clickY,
            startTime: Date.now(),
            isRed: false,
          });
        }
      }
    };

    canvas.addEventListener('click', handleCanvasClick);

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

    const updateWaterFrame = () => {
      const now = Date.now();
      const elapsed = now - lastWaterTimeRef.current;

      if (elapsed >= WATER_FRAME_DURATION) {
        waterFrameRef.current = (waterFrameRef.current + 1) % 3;
        lastWaterTimeRef.current = now;
      }
    };

    const drawClickMarker = (marker: ClickMarker) => {
      const elapsed = Date.now() - marker.startTime;
      if (elapsed > CLICK_MARKER_DURATION) return false; // marker expired

      // 4-frame shrinking X animation
      const progress = elapsed / CLICK_MARKER_DURATION;
      const size = 32 * (1 - progress * 0.5); // shrink as it fades
      const alpha = 1 - progress;

      ctx!.globalAlpha = alpha;
      ctx!.strokeStyle = marker.isRed ? '#FF4444' : '#FFFF00';
      ctx!.lineWidth = 2;

      const x1 = marker.px - size / 2;
      const y1 = marker.py - size / 2;
      const x2 = marker.px + size / 2;
      const y2 = marker.py + size / 2;

      ctx!.beginPath();
      ctx!.moveTo(x1, y1);
      ctx!.lineTo(x2, y2);
      ctx!.moveTo(x2, y1);
      ctx!.lineTo(x1, y2);
      ctx!.stroke();

      ctx!.globalAlpha = 1;
      return true;
    };

    const render = () => {
      // Update frame timing
      const now = Date.now();
      const deltaTime = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      updateWaterFrame();

      // Update movement
      if (movementRef.current.walking) {
        const reached = updateMovement(movementRef.current, deltaTime);
        if (reached && movementRef.current.pendingAction) {
          // Execute pending action
          const action = movementRef.current.pendingAction;
          if (action.type === 'gather' && action.nodeId) {
            startAction({
              type: 'woodcutting',
              nodeId: action.nodeId,
              zoneId: zone.zoneId as any,
              recipeId: null,
              targetZoneId: null,
            });
          }
          movementRef.current.pendingAction = null;
        }
      }

      const terrainTexture = textures['world/terrain.png']!.img;

      // 1. Ground layer
      for (let ty = 0; ty < zone.height; ty++) {
        for (let tx = 0; tx < zone.width; tx++) {
          const tile = getTile(zone, tx, ty);
          if (!tile || tile === '.') continue;

          let row = 0, col = 0;
          switch (tile) {
            case 'g': row = 0; col = 0; break;
            case 'G': row = 0; col = 1; break;
            case 'p': row = 1; col = 0; break;
            case 'w': row = 2; col = waterFrameRef.current; break;
            case 'W': row = 2; col = 3 + waterFrameRef.current; break;
            case 'c': row = 3; col = 0; break;
          }

          drawTile(tx, ty, row, col, terrainTexture);
        }
      }

      // 2. Y-sorted entities
      const entities: Array<{ ty: number; px: number; py: number; id: string; type: 'node' | 'decor' | 'char' }> = [];

      for (const node of zone.nodes) {
        entities.push({
          ty: node.ty,
          px: node.tx * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN / 2,
          py: node.ty * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN,
          id: node.nodeId,
          type: 'node',
        });
      }

      for (const dec of zone.decor) {
        entities.push({
          ty: dec.ty,
          px: dec.tx * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN / 2,
          py: dec.ty * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN,
          id: dec.spriteId,
          type: 'decor',
        });
      }

      // Add character at current movement position
      entities.push({
        ty: movementRef.current.ty,
        px: movementRef.current.px,
        py: movementRef.current.py,
        id: 'player',
        type: 'char',
      });

      entities.sort((a, b) => a.py - b.py || a.ty - b.ty);

      // Draw sorted entities
      for (const ent of entities) {
        if (ent.type === 'node') {
          ctx!.fillStyle = '#8B4513';
          ctx!.fillRect(ent.px - 16, ent.py - 32, 32, 32);
        } else if (ent.type === 'decor') {
          ctx!.fillStyle = '#228B22';
          ctx!.fillRect(ent.px - 16, ent.py - 48, 32, 32);
        } else if (ent.type === 'char' && characterSprite) {
          if (currentAction) {
            const actionType = (currentAction.type === 'woodcutting' ? 'chop' :
                               currentAction.type === 'mining' ? 'mine' :
                               currentAction.type === 'fishing' ? 'fish' :
                               currentAction.type === 'cooking' ? 'cook' :
                               'idle') as ActionAnimationType;

            const elapsedMs = Date.now() - actionStartTimeRef.current;
            const frame = getCurrentFrame(actionType, movementRef.current.facing, elapsedMs);
            const frameCanvas = extractFrame(characterSprite, frame.row, frame.col);

            ctx!.drawImage(
              frameCanvas,
              ent.px - 32,
              ent.py - 64
            );
          }
        }
      }

      // 3. Click markers
      clickMarkersRef.current = clickMarkersRef.current.filter(drawClickMarker);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [textures, characterSprite, currentAction, startAction]);

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
        cursor: 'crosshair',
      } as any}
    />
  );
}
