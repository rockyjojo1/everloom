import { useEffect, useRef, useState } from 'react';
import { MEADOWREST, getTile, isWalkable, ZoneMap } from '../world/zonemaps';
import { useGameStore } from '../store/gameStore';
import { buildCharacterSheet } from '../world/characterSprites';
import { ANIMATIONS, getCurrentFrame, extractFrame, ActionAnimationType } from '../world/character';
import { appearanceToColors } from '../lib/appearanceColors';
import { MovementState, findPath, getAdjacentWalkable, updateMovement, startWalking, stopWalking } from '../world/movement';
import {
  TILE_PX, PROP_PX, TILES_FILE, PROPS_FILE,
  GROUND, WATER_FRAMES, PROPS, CAMPFIRE_FRAMES, RIPPLE_FRAMES,
  NODE_PROP, FISHING_NODES, CAMPFIRE_NODES, variantFor,
} from '../world/atlasLayout';

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

interface Bird {
  id: string;
  px: number;
  py: number;
  vx: number; // velocity
  frame: number;
  startTime: number;
  duration: number;
}

interface Particle {
  id: string;
  px: number;
  py: number;
  vx: number;
  vy: number;
  startTime: number;
  color: string; // "gold" or "white"
}

const TILE_SIZE_SRC = 32; // source size
const TILE_SIZE_DRAWN = 64; // drawn at 2× scale
const WATER_FRAME_DURATION = 150; // ms per frame
const CLICK_MARKER_DURATION = 400; // ms total
const CAMPFIRE_FRAME_DURATION = 150; // ms per frame (4 frames total)
const RIPPLE_FRAME_DURATION = 200; // ms per frame (3 frames)
const WATERFALL_SCROLL_SPEED = 0.3; // pixels per ms
const CLOUD_CYCLE_DURATION = 4000; // 4 seconds per cloud cycle
const BIRD_SPAWN_INTERVAL = 8000; // spawn every 8 seconds
const BIRD_FLIGHT_DURATION = 3000; // fly for 3 seconds
const LEVEL_UP_PARTICLE_DURATION = 700; // ms total for level-up particles
const LEVEL_UP_PARTICLE_COUNT = 20; // number of particles per level-up

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

  // Ambient animation state
  const campfireFrameRef = useRef(0);
  const lastCampfireTimeRef = useRef(Date.now());
  const fishingRipplesRef = useRef<Record<string, { frame: number; lastTime: number }>>({});
  const waterfallOffsetRef = useRef(0);
  const cloudsRef = useRef<Array<{ x: number; y: number; size: number; offset: number }>>([
    { x: 300, y: 150, size: 80, offset: 0 },
    { x: 600, y: 200, size: 60, offset: 1000 },
    { x: 1000, y: 120, size: 100, offset: 2000 },
  ]);
  const birdsRef = useRef<Bird[]>([]);
  const lastBirdSpawnRef = useRef(Date.now());
  const particlesRef = useRef<Particle[]>([]);
  const drawErrorLoggedRef = useRef(false);
  // Bumped on resize/rotate so the render effect recomputes the viewport.
  const [viewportTick, setViewportTick] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setViewportTick((t) => t + 1));
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  const lastSeenLevelUpEventIdRef = useRef<string>("");

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
  const pendingEvents = useGameStore((s) => s.pendingEvents);
  const currentAction = playerState?.currentAction;
  const appearance = playerState?.appearance;

  // Watch for level-up events and spawn particles
  useEffect(() => {
    for (const event of pendingEvents) {
      if (event.kind === "level_up") {
        const eventKey = `${event.skill}_${event.newLevel}`;
        if (eventKey !== lastSeenLevelUpEventIdRef.current) {
          lastSeenLevelUpEventIdRef.current = eventKey;
          // Spawn particles at character center
          const charCenterX = movementRef.current.px;
          const charCenterY = movementRef.current.py - 20;
          spawnLevelUpParticles(charCenterX, charCenterY);
        }
      }
    }
  }, [pendingEvents]);

  // Spawn level-up particles
  const spawnLevelUpParticles = (cx: number, cy: number) => {
    const now = Date.now();
    const newParticles: Particle[] = [];
    for (let i = 0; i < LEVEL_UP_PARTICLE_COUNT; i++) {
      const angle = (i / LEVEL_UP_PARTICLE_COUNT) * Math.PI * 2;
      const speed = 100 + Math.random() * 150;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 100; // upward bias
      newParticles.push({
        id: `p_${now}_${i}`,
        px: cx,
        py: cy,
        vx,
        vy,
        startTime: now,
        color: i % 2 === 0 ? "gold" : "white",
      });
    }
    particlesRef.current.push(...newParticles);
  };

  // Load world atlases exactly once. This must NOT depend on player state:
  // re-running it clears `textures`, which makes the render loop bail and the
  // whole scene blank until the images decode again.
  useEffect(() => {
    const loaded: Record<string, LoadedTexture> = {};
    const textureFiles = [TILES_FILE, PROPS_FILE];

    const loadTexture = (file: string) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
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

    Promise.all(textureFiles.map(loadTexture)).then(() => setTextures(loaded));
  }, []);

  // Rebuild the character sheet only when the appearance VALUES change.
  // The store hands back a fresh object every tick, so keying on identity
  // would rebuild a 576x1024 sheet many times a second.
  const appearanceKey = appearance
    ? `${appearance.skinTone}|${appearance.hairStyle}|${appearance.hairColor}|${appearance.torsoColor}|${appearance.legsColor}`
    : 'default';

  useEffect(() => {
    try {
      setCharacterSprite(buildCharacterSheet(appearanceToColors(appearance)));
    } catch (err) {
      console.error('Failed to build character sprite sheet:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearanceKey]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !textures[TILES_FILE]?.loaded || !textures[PROPS_FILE]?.loaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const zone = MEADOWREST;
    const worldWidth = zone.width * TILE_SIZE_DRAWN;
    const worldHeight = zone.height * TILE_SIZE_DRAWN;

    /**
     * Viewport: on a wide screen we show the whole zone; on a narrow/portrait
     * screen fitting a 20x11 landscape map would letterbox it into a thin
     * strip, so we show a player-centred window instead (OSRS-mobile style).
     */
    const container = canvas.parentElement;
    const availW = container?.clientWidth ?? window.innerWidth;
    const availH = container?.clientHeight ?? window.innerHeight;
    const portrait = availH > availW;

    const canvasWidth = portrait
      ? Math.min(worldWidth, Math.round(11 * TILE_SIZE_DRAWN))
      : worldWidth;
    const canvasHeight = portrait
      ? Math.min(worldHeight, Math.round(canvasWidth * (availH / availW)))
      : worldHeight;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.imageSmoothingEnabled = false;

    /** Camera offset in world px, clamped so we never show outside the map. */
    const camera = () => {
      if (!portrait) return { x: 0, y: 0 };
      const cx = movementRef.current.px - canvasWidth / 2;
      const cy = movementRef.current.py - canvasHeight / 2;
      return {
        x: Math.max(0, Math.min(worldWidth - canvasWidth, cx)),
        y: Math.max(0, Math.min(worldHeight - canvasHeight, cy)),
      };
    };

    // Click handler
    const handleCanvasClick = (e: MouseEvent) => {
      // The canvas is object-fit:contain, so the drawn content is centred
      // inside the element with letterbox bars. Map client coords through that
      // same transform, or clicks land offset from where the player aimed.
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
      const drawnW = canvas.width * scale;
      const drawnH = canvas.height * scale;
      const originX = rect.left + (rect.width - drawnW) / 2;
      const originY = rect.top + (rect.height - drawnH) / 2;
      const viewX = (e.clientX - originX) / scale;
      const viewY = (e.clientY - originY) / scale;
      // Ignore taps that land on the letterbox bars.
      if (viewX < 0 || viewY < 0 || viewX > canvas.width || viewY > canvas.height) return;
      // Add the camera offset to get world coords (identity on wide screens).
      const cam = camera();
      const clickX = viewX + cam.x;
      const clickY = viewY + cam.y;

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
      ctx!.drawImage(
        texture,
        col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX,
        tx * TILE_SIZE_DRAWN, ty * TILE_SIZE_DRAWN, TILE_SIZE_DRAWN, TILE_SIZE_DRAWN
      );
    };

    /**
     * Props are 64px cells whose art is bottom-anchored, so (px,py) is the
     * entity's ground contact point and the sprite is drawn up from there.
     */
    const drawProp = (px: number, py: number, row: number, col: number) => {
      const tex = textures[PROPS_FILE];
      if (!tex?.loaded) return;
      const size = TILE_SIZE_DRAWN * 1.5; // props stand taller than one tile
      ctx!.drawImage(
        tex.img,
        col * PROP_PX, row * PROP_PX, PROP_PX, PROP_PX,
        px - size / 2, py - size, size, size
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

    const updateCampfireFrame = () => {
      const now = Date.now();
      const elapsed = now - lastCampfireTimeRef.current;

      if (elapsed >= CAMPFIRE_FRAME_DURATION) {
        campfireFrameRef.current = (campfireFrameRef.current + 1) % 4;
        lastCampfireTimeRef.current = now;
      }
    };

    const updateFishingRipples = (nodeId: string) => {
      const now = Date.now();
      if (!fishingRipplesRef.current[nodeId]) {
        fishingRipplesRef.current[nodeId] = { frame: 0, lastTime: now };
        return;
      }

      const ripple = fishingRipplesRef.current[nodeId];
      const elapsed = now - ripple.lastTime;

      if (elapsed >= RIPPLE_FRAME_DURATION) {
        ripple.frame = (ripple.frame + 1) % 3;
        ripple.lastTime = now;
      }
    };

    const updateWaterfallScroll = (deltaTime: number) => {
      waterfallOffsetRef.current = (waterfallOffsetRef.current + WATERFALL_SCROLL_SPEED * deltaTime) % TILE_SIZE_SRC;
    };

    const updateBirds = (deltaTime: number) => {
      const now = Date.now();

      // Spawn new bird occasionally
      if (now - lastBirdSpawnRef.current > BIRD_SPAWN_INTERVAL) {
        const direction = Math.random() > 0.5 ? 1 : -1;
        birdsRef.current.push({
          id: `bird-${now}`,
          px: direction > 0 ? -50 : MEADOWREST.width * TILE_SIZE_DRAWN + 50,
          py: 100 + Math.random() * 150,
          vx: direction * 0.15,
          frame: 0,
          startTime: now,
          duration: BIRD_FLIGHT_DURATION,
        });
        lastBirdSpawnRef.current = now;
      }

      // Update bird positions
      birdsRef.current = birdsRef.current
        .map((bird) => ({
          ...bird,
          px: bird.px + bird.vx * deltaTime,
          frame: Math.floor(((now - bird.startTime) / 200) % 3),
        }))
        .filter((bird) => now - bird.startTime < bird.duration);
    };

    const updateParticles = (deltaTime: number) => {
      const now = Date.now();
      particlesRef.current = particlesRef.current
        .map((p) => ({
          ...p,
          px: p.px + p.vx * (deltaTime / 1000),
          py: p.py + p.vy * (deltaTime / 1000) + (9.8 * (deltaTime / 1000) * (deltaTime / 1000) * 20), // gravity
          vy: p.vy + 9.8 * (deltaTime / 1000) * 20, // gravity
        }))
        .filter((p) => now - p.startTime < LEVEL_UP_PARTICLE_DURATION);
    };

    const drawParticles = (now: number) => {
      for (const p of particlesRef.current) {
        const elapsed = now - p.startTime;
        const progress = elapsed / LEVEL_UP_PARTICLE_DURATION;
        const alpha = Math.max(0, 1 - progress);

        ctx!.globalAlpha = alpha;
        ctx!.fillStyle = p.color === "gold" ? "#FFD700" : "#FFFFFF";
        ctx!.beginPath();
        ctx!.arc(p.px, p.py, 3, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
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

    const drawCampfire = (px: number, py: number) => {
      const cell = CAMPFIRE_FRAMES[campfireFrameRef.current % CAMPFIRE_FRAMES.length]!;
      drawProp(px, py, cell.row, cell.col);
    };

    const drawRipple = (px: number, py: number, frame: number) => {
      const cell = RIPPLE_FRAMES[frame % RIPPLE_FRAMES.length]!;
      // Ripples sit flat on the water rather than standing up like a prop.
      const tex = textures[PROPS_FILE];
      if (!tex?.loaded) return;
      ctx!.drawImage(
        tex.img,
        cell.col * PROP_PX, cell.row * PROP_PX, PROP_PX, PROP_PX,
        px - TILE_SIZE_DRAWN / 2, py - TILE_SIZE_DRAWN * 0.85, TILE_SIZE_DRAWN, TILE_SIZE_DRAWN
      );
    };

    const drawCloudShadows = (now: number) => {
      ctx!.fillStyle = 'rgba(0, 0, 0, 0.12)';

      for (const cloud of cloudsRef.current) {
        const cycleProgress = ((now - cloud.offset) % CLOUD_CYCLE_DURATION) / CLOUD_CYCLE_DURATION;
        const cloudX = 50 + cycleProgress * (MEADOWREST.width * TILE_SIZE_DRAWN - 100);

        ctx!.beginPath();
        ctx!.ellipse(cloudX, cloud.y, cloud.size, cloud.size * 0.4, 0, 0, Math.PI * 2);
        ctx!.fill();
      }
    };

    const drawBirds = () => {
      ctx!.fillStyle = '#333';
      const birdSize = 12;

      for (const bird of birdsRef.current) {
        // Simple bird silhouette: body + wings
        const wingOffset = Math.sin(bird.frame * Math.PI / 1.5) * 4; // flap animation
        const bodyX = bird.px;
        const bodyY = bird.py;

        // Body
        ctx!.fillRect(bodyX - 4, bodyY - 3, 8, 6);
        // Left wing
        ctx!.fillRect(bodyX - 8, bodyY - 2, 4, 4);
        // Right wing
        ctx!.fillRect(bodyX + 4, bodyY - 2, 4, 4);
      }
    };

    const render = () => {
      // Update frame timing
      const now = Date.now();
      const deltaTime = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      updateWaterFrame();
      updateCampfireFrame();
      updateWaterfallScroll(deltaTime);
      updateBirds(deltaTime);
      updateParticles(deltaTime);

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

      const tilesTexture = textures[TILES_FILE]!.img;

      // Apply the camera for everything drawn in world space. Restored at the
      // end of the frame so screen-space overlays are unaffected.
      const cam = camera();
      ctx!.save();
      ctx!.translate(-cam.x, -cam.y);

      // 1. Ground layer — every cell comes from atlasLayout, never a literal.
      for (let ty = 0; ty < zone.height; ty++) {
        for (let tx = 0; tx < zone.width; tx++) {
          const tile = getTile(zone, tx, ty);
          if (!tile || tile === '.') continue;

          let cell;
          if (tile === 'w' || tile === 'W') {
            cell = WATER_FRAMES[waterFrameRef.current % WATER_FRAMES.length]!;
          } else {
            const variants = GROUND[tile] ?? GROUND['g']!;
            cell = variants[variantFor(tx, ty, variants.length)]!;
          }

          drawTile(tx, ty, cell.row, cell.col, tilesTexture);

          // Deep water sits darker than shallow so the river reads with depth.
          if (tile === 'W') {
            ctx!.fillStyle = 'rgba(10, 28, 44, 0.28)';
            ctx!.fillRect(tx * TILE_SIZE_DRAWN, ty * TILE_SIZE_DRAWN, TILE_SIZE_DRAWN, TILE_SIZE_DRAWN);
          }
        }
      }

      // 1.5 Ambient animations (before entities for layering)
      drawCloudShadows(now);

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

      // Draw sorted entities. Each is isolated: a throw while drawing one
      // entity must not blank every entity behind it in the sort order.
      for (const ent of entities) {
        try {
        if (ent.type === 'node') {
          if (CAMPFIRE_NODES.has(ent.id)) {
            drawCampfire(ent.px, ent.py);
          } else if (FISHING_NODES.has(ent.id)) {
            updateFishingRipples(ent.id);
            const ripple = fishingRipplesRef.current[ent.id];
            drawRipple(ent.px, ent.py, ripple ? ripple.frame : 0);
          } else {
            const propKey = NODE_PROP[ent.id];
            const cell = propKey ? PROPS[propKey] : undefined;
            if (cell) drawProp(ent.px, ent.py, cell.row, cell.col);
          }
        } else if (ent.type === 'decor') {
          const cell = PROPS[ent.id] ?? PROPS['tree_pine']!;
          drawProp(ent.px, ent.py, cell.row, cell.col);
        } else if (ent.type === 'char' && characterSprite) {
          // Walking always wins over the skill animation — you can't chop
          // while travelling. Falls back to a directional idle stand.
          let actionType: ActionAnimationType;
          let elapsedMs: number;

          if (movementRef.current.walking) {
            actionType = 'walk' as ActionAnimationType;
            elapsedMs = Date.now();
          } else {
            actionType = (currentAction?.type === 'woodcutting' ? 'chop' :
                          currentAction?.type === 'mining' ? 'mine' :
                          currentAction?.type === 'fishing' ? 'fish' :
                          currentAction?.type === 'cooking' ? 'cook' :
                          'idle') as ActionAnimationType;
            elapsedMs = Date.now() - actionStartTimeRef.current;
          }

          const frame = getCurrentFrame(actionType, movementRef.current.facing, elapsedMs);
          // Draw straight from the sheet — extractFrame allocated a canvas
          // every frame, which churned GC during the rAF loop.
          ctx!.drawImage(
            characterSprite,
            frame.col * 64, frame.row * 64, 64, 64,
            ent.px - 32, ent.py - 60, 64, 64
          );
        }
        } catch (err) {
          if (!drawErrorLoggedRef.current) {
            console.error('Entity draw failed for', ent.id, err);
            drawErrorLoggedRef.current = true; // log once, not every frame
          }
        }
      }

      // 2.5 Birds (drawn above entities)
      drawBirds();

      // 2.6 Particles (drawn above birds)
      drawParticles(now);

      // 3. Click markers (still world space — they mark a world position)
      clickMarkersRef.current = clickMarkersRef.current.filter(drawClickMarker);

      ctx!.restore(); // end camera transform

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [textures, characterSprite, currentAction, startAction, viewportTick]);

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
        minHeight: 0,
        width: '100%',
        height: '100%',
        // Letterbox instead of stretching — without this the backing store is
        // squashed to the container's aspect ratio and everything distorts.
        objectFit: 'contain',
        imageRendering: 'pixelated',
        backgroundColor: '#1E2430',
        cursor: 'crosshair',
        touchAction: 'manipulation',
      } as any}
    />
  );
}
