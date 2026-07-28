/**
 * World zone definitions: tilemaps, node placements, decor
 * Tile size: 32px source → 64px drawn at 2× scale
 */

export type TileType = 'g' | 'G' | 'w' | 'W' | 'c' | 'p' | 't' | '.' | 's' | 'S' | 'T';

export interface TileMap {
  width: number;
  height: number;
  tiles: TileType[];
}

export interface NodePlacement {
  nodeId: string;
  tx: number;
  ty: number;
}

export interface DecorSprite {
  spriteId: string;
  tx: number;
  ty: number;
}

export interface GroundItem {
  itemId: string;
  tx: number;
  ty: number;
  qty: number;
}

export interface ZoneMap {
  zoneId: string;
  name: string;
  width: number;
  height: number;
  tiles: TileType[];
  nodes: NodePlacement[];
  decor: DecorSprite[];
  groundItems?: GroundItem[];
  spawnTx: number;
  spawnTy: number;
}

// Meadowrest: starting zone with river and waterfall
// Legend: g=grass, G=dark grass, w=water, W=deep water, c=cliff, p=path, t=tree-blocked, .=void
const MEADOWREST_TILES: TileType[] = [
  'G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','c','c',
  'G','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','G','c',
  'G','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','G','c',
  'G','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','w','c',
  'g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','w','w','c','c',
  'g','g','g','g','g','p','p','p','g','g','g','g','g','g','g','w','w','w','c','c',
  'g','g','g','g','g','p','g','p','g','g','g','g','g','g','w','w','w','w','c','c',
  'g','g','g','g','p','p','g','p','p','g','g','w','w','w','w','W','W','w','c','c',
  'g','w','w','w','w','w','w','w','w','w','w','w','W','W','W','W','W','w','w','c',
  'w','w','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','w','w','w',
  'w','w','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','w','w',
];

export const MEADOWREST: ZoneMap = {
  zoneId: 'meadowrest',
  name: 'Meadowrest',
  width: 20,
  height: 11,
  tiles: MEADOWREST_TILES,
  nodes: [
    { nodeId: 'meadowrest_pine',         tx: 3,  ty: 2 },
    { nodeId: 'meadowrest_willow',       tx: 5,  ty: 4 },
    { nodeId: 'meadowrest_campfire',     tx: 9,  ty: 3 },
    { nodeId: 'meadowrest_copper_vein',  tx: 13, ty: 2 },
    { nodeId: 'meadowrest_tin_vein',     tx: 15, ty: 4 },
    { nodeId: 'meadowrest_trout_stream', tx: 8,  ty: 7 },
    { nodeId: 'meadowrest_minnow_pool',  tx: 13, ty: 7 },
    { nodeId: 'meadowrest_furnace',      tx: 16, ty: 6 },
    { nodeId: 'meadowrest_anvil',        tx: 17, ty: 6 },
  ],
  decor: [
    // Edge trees and cliffs (visual only, non-interactive)
    { spriteId: 'tree_oak', tx: 1, ty: 1 },
    { spriteId: 'tree_oak', tx: 18, ty: 3 },
  ],
  groundItems: [
    { itemId: 'worn_hatchet', tx: 10, ty: 5, qty: 1 },    // at spawn
    { itemId: 'worn_pickaxe', tx: 14, ty: 2, qty: 1 },    // near copper vein
  ],
  spawnTx: 10,
  spawnTy: 5,
};

// Bramblewood: zone 2, dusk forest with charwood trees and stream
// Legend: g=grass, G=dark grass/forest, w=water, c=cliff, p=path, T=charwood tree
const BRAMBLEWOOD_TILES: TileType[] = [
  'c','c','c','c','c','G','G','G','G','G','G','G','G','G','G','G','G','G','c','c',
  'c','G','G','G','G','G','G','G','G','G','G','G','w','w','G','G','G','G','G','c',
  'c','G','G','G','G','G','G','G','p','p','G','w','w','w','G','G','G','G','G','c',
  'c','G','G','G','G','G','p','p','p','p','w','w','G','G','G','G','G','G','G','c',
  'c','G','G','G','G','p','p','G','G','p','w','G','G','G','G','G','G','G','G','c',
  'c','G','G','G','p','p','G','G','G','p','G','G','G','G','G','G','G','G','G','c',
  'c','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','c',
  'c','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','c',
  'c','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','c',
  'c','c','c','G','G','G','G','G','G','G','G','G','G','G','G','G','G','c','c','c',
  'c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c',
];

export const BRAMBLEWOOD: ZoneMap = {
  zoneId: 'bramblewood',
  name: 'Bramblewood',
  width: 20,
  height: 11,
  tiles: BRAMBLEWOOD_TILES,
  nodes: [
    { nodeId: 'bramblewood_charwood',  tx: 4,  ty: 2 },
    { nodeId: 'bramblewood_perch',     tx: 10, ty: 3 },
    { nodeId: 'bramblewood_cave_entrance', tx: 15, ty: 5 },
    { nodeId: 'bramblewood_ancient_bark', tx: 3, ty: 7 },
  ],
  decor: [
    { spriteId: 'tree_dead', tx: 6, ty: 6 },
    { spriteId: 'tree_dead', tx: 14, ty: 8 },
  ],
  spawnTx: 8,
  spawnTy: 9,
};

// Ashen Delve: zone 3, underground cave with stone and darkness
// Legend: s=stone, S=dark stone, w=water (pool), p=path, c=wall
const ASHEN_DELVE_TILES: TileType[] = [
  'c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c',
  'c','S','S','S','S','S','S','S','S','S','S','S','S','S','S','S','S','S','S','c',
  'c','S','s','s','s','s','s','s','s','s','s','s','s','s','s','s','s','S','S','c',
  'c','S','s','s','s','p','p','s','s','s','s','s','p','p','s','s','s','S','S','c',
  'c','S','s','s','p','p','s','s','s','s','s','p','p','s','s','s','s','S','S','c',
  'c','S','s','s','s','s','s','s','w','w','s','s','s','s','s','s','s','S','S','c',
  'c','S','s','s','s','s','s','w','w','w','s','s','s','s','s','s','s','S','S','c',
  'c','S','s','s','s','s','s','s','s','s','s','s','s','s','s','s','s','S','S','c',
  'c','S','s','s','s','s','s','s','s','s','s','s','s','s','s','s','s','S','S','c',
  'c','S','S','S','S','S','S','S','S','S','S','S','S','S','S','S','S','S','S','c',
  'c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c','c',
];

export const ASHEN_DELVE: ZoneMap = {
  zoneId: 'ashen_delve',
  name: 'Ashen Delve',
  width: 20,
  height: 11,
  tiles: ASHEN_DELVE_TILES,
  nodes: [
    { nodeId: 'ashen_delve_coal',      tx: 5,  ty: 3 },
    { nodeId: 'ashen_delve_iron_ore',  tx: 12, ty: 3 },
    { nodeId: 'ashen_delve_eel_pool',  tx: 9,  ty: 6 },
    { nodeId: 'ashen_delve_deep_iron', tx: 3,  ty: 7 },
  ],
  decor: [],
  spawnTx: 2,
  spawnTy: 2,
};

export const ZONES: Record<string, ZoneMap> = {
  meadowrest: MEADOWREST,
  bramblewood: BRAMBLEWOOD,
  ashen_delve: ASHEN_DELVE,
};

/**
 * Check if a tile is walkable (player can move there)
 */
export function isWalkable(tile: TileType): boolean {
  return tile === 'g' || tile === 'G' || tile === 'p' || tile === 's' || tile === 'S';
}

/**
 * Get tile from map at (tx, ty)
 */
export function getTile(map: ZoneMap, tx: number, ty: number): TileType | undefined {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return undefined;
  const idx = ty * map.width + tx;
  return map.tiles[idx];
}

/**
 * Sprite mappings: nodeId/spriteId → (atlasRow, atlasCol) in 32×32 grid
 * Will be loaded from sprite atlases in Phase 2
 */
export const SPRITE_SOURCES: Record<string, { file: string; row: number; col: number }> = {
  tree_oak: { file: 'world/trees.png', row: 0, col: 0 },
  tree_pine: { file: 'world/trees.png', row: 0, col: 1 },
  tree_willow: { file: 'world/trees.png', row: 0, col: 2 },
  tree_dead: { file: 'world/trees.png', row: 1, col: 0 },

  node_pine: { file: 'world/trees.png', row: 0, col: 1 },
  node_willow: { file: 'world/trees.png', row: 0, col: 2 },
  node_campfire: { file: 'world/terrain.png', row: 0, col: 0 }, // placeholder
  node_copper_vein: { file: 'world/rocks.png', row: 0, col: 0 },
  node_tin_vein: { file: 'world/rocks.png', row: 0, col: 1 },
  node_trout_stream: { file: 'world/terrain.png', row: 0, col: 1 }, // placeholder
  node_minnow_pool: { file: 'world/terrain.png', row: 0, col: 2 }, // placeholder
  node_furnace: { file: 'world/terrain.png', row: 1, col: 0 },     // placeholder
  node_anvil: { file: 'world/terrain.png', row: 1, col: 1 },       // placeholder
};
