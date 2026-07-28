/**
 * Character movement: pathfinding, walking, click handling
 */

import { ZoneMap, getTile, isWalkable } from './zonemaps';

export interface MovementState {
  tx: number;           // current tile x
  ty: number;           // current tile y
  px: number;           // pixel x (for lerping between tiles)
  py: number;           // pixel y
  facing: 'up' | 'down' | 'left' | 'right';
  path: Array<{ tx: number; ty: number }>;
  walking: boolean;
  lastWalkTime: number; // time of last tile advancement
  pendingAction: PendingAction | null;
}

export interface PendingAction {
  type: 'gather' | 'idle';
  nodeId?: string;
}

const TILE_SIZE_DRAWN = 64;
const WALK_SPEED_TILES_PER_SEC = 4;
const TILE_ADVANCE_TIME_MS = 1000 / WALK_SPEED_TILES_PER_SEC; // 250ms per tile

/**
 * BFS pathfinding from start to end tile
 * Returns path of tiles, or empty array if no path exists
 */
export function findPath(zone: ZoneMap, startTx: number, startTy: number, endTx: number, endTy: number): Array<{ tx: number; ty: number }> {
  if (!isWalkable(getTile(zone, endTx, endTy) || '.')) {
    return [];
  }

  const queue: Array<{ tx: number; ty: number; parent: any }> = [{ tx: startTx, ty: startTy, parent: null }];
  const visited = new Set<string>();
  visited.add(`${startTx},${startTy}`);

  const directions = [
    { tx: 0, ty: -1 }, // up
    { tx: -1, ty: 0 }, // left
    { tx: 0, ty: 1 },  // down
    { tx: 1, ty: 0 },  // right
  ];

  let found: any = null;

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.tx === endTx && current.ty === endTy) {
      found = current;
      break;
    }

    for (const dir of directions) {
      const nextTx = current.tx + dir.tx;
      const nextTy = current.ty + dir.ty;
      const key = `${nextTx},${nextTy}`;

      if (visited.has(key)) continue;

      const tile = getTile(zone, nextTx, nextTy);
      if (!tile || !isWalkable(tile)) continue;

      visited.add(key);
      queue.push({
        tx: nextTx,
        ty: nextTy,
        parent: current,
      });
    }
  }

  if (!found) return [];

  // Reconstruct path
  const path: Array<{ tx: number; ty: number }> = [];
  let current = found;
  while (current.parent) {
    path.unshift({ tx: current.tx, ty: current.ty });
    current = current.parent;
  }

  return path;
}

/**
 * Get adjacent walkable tile nearest to target
 * Used when clicking on a node (character walks to adjacent tile)
 */
export function getAdjacentWalkable(zone: ZoneMap, nodeTx: number, nodeTy: number): { tx: number; ty: number } | null {
  const directions = [
    { tx: 0, ty: -1 }, // up
    { tx: -1, ty: 0 }, // left
    { tx: 0, ty: 1 },  // down
    { tx: 1, ty: 0 },  // right
  ];

  for (const dir of directions) {
    const tx = nodeTx + dir.tx;
    const ty = nodeTy + dir.ty;
    const tile = getTile(zone, tx, ty);
    if (tile && isWalkable(tile)) {
      return { tx, ty };
    }
  }

  return null;
}

/**
 * Update character position along the path
 * Returns true if character reached destination
 */
export function updateMovement(state: MovementState, elapsedMs: number): boolean {
  if (state.path.length === 0) {
    state.walking = false;
    return true; // reached destination
  }

  state.lastWalkTime += elapsedMs;

  if (state.lastWalkTime >= TILE_ADVANCE_TIME_MS) {
    // Advance to next tile
    state.lastWalkTime -= TILE_ADVANCE_TIME_MS;

    const nextTile = state.path.shift()!;

    // Update facing direction
    if (nextTile.tx < state.tx) state.facing = 'left';
    else if (nextTile.tx > state.tx) state.facing = 'right';
    else if (nextTile.ty < state.ty) state.facing = 'up';
    else if (nextTile.ty > state.ty) state.facing = 'down';

    state.tx = nextTile.tx;
    state.ty = nextTile.ty;

    if (state.path.length === 0) {
      state.walking = false;
      return true; // reached destination
    }
  }

  // Lerp pixels toward next tile
  const targetPx = state.tx * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN / 2;
  const targetPy = state.ty * TILE_SIZE_DRAWN + TILE_SIZE_DRAWN;

  const progress = state.lastWalkTime / TILE_ADVANCE_TIME_MS;
  state.px = state.px + (targetPx - state.px) * progress;
  state.py = state.py + (targetPy - state.py) * progress;

  return false;
}

/**
 * Start walking toward a tile
 */
export function startWalking(state: MovementState, zone: ZoneMap, endTx: number, endTy: number, action: PendingAction | null = null) {
  const path = findPath(zone, state.tx, state.ty, endTx, endTy);
  if (path.length === 0) return; // no path

  state.path = path;
  state.walking = true;
  state.lastWalkTime = 0;
  state.pendingAction = action;
}

/**
 * Stop walking and clear any pending action
 */
export function stopWalking(state: MovementState) {
  state.path = [];
  state.walking = false;
  state.pendingAction = null;
}
