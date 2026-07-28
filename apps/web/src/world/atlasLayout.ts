/**
 * Single source of truth for sprite atlas geometry.
 *
 * The renderer must NEVER hard-code row/col numbers — it reads them from here.
 * That way, swapping in a different art pack (Kenney CC0, Oryx, etc.) means
 * regenerating the atlases to this same grid and changing nothing else.
 *
 * Atlases are produced by `scripts/gen-tiles.js`. Keep the two in sync.
 */

export const TILE_PX = 32; // one ground tile in the atlas
export const PROP_PX = 64; // one prop cell in the atlas (bottom-anchored art)

/** tiles.png — 8 cols x 3 rows of 32px cells. */
export const TILES_FILE = "world/tiles.png";
/** props.png — 8 cols x 3 rows of 64px cells. */
export const PROPS_FILE = "world/props.png";

interface Cell { row: number; col: number }

/** Ground tiles, indexed by the map legend character used in zonemaps. */
export const GROUND: Record<string, Cell[]> = {
  // multiple variants per type -> renderer picks deterministically per position
  g: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 7 }],
  G: [{ row: 0, col: 3 }, { row: 0, col: 4 }],
  p: [{ row: 0, col: 5 }, { row: 0, col: 6 }],
  // cave floor / walls (zones 2-3)
  s: [{ row: 2, col: 2 }, { row: 2, col: 3 }],
  S: [{ row: 2, col: 4 }, { row: 2, col: 5 }],
  c: [{ row: 2, col: 0 }, { row: 2, col: 1 }],
  T: [{ row: 2, col: 0 }],
};

/** Animated water: 3 frames on row 1. Both 'w' and 'W' use these. */
export const WATER_FRAMES: Cell[] = [
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: 2 },
];

/** Static props (trees, ore). Drawn bottom-anchored on the entity's tile. */
export const PROPS: Record<string, Cell> = {
  tree_pine:   { row: 0, col: 0 },
  tree_oak:    { row: 0, col: 1 },
  tree_willow: { row: 0, col: 2 },
  tree_dead:   { row: 0, col: 3 },
  ore_copper:  { row: 0, col: 4 },
  ore_tin:     { row: 0, col: 5 },
  ore_coal:    { row: 0, col: 6 },
  ore_iron:    { row: 0, col: 7 },
  furnace:     { row: 2, col: 0 },
  anvil:       { row: 2, col: 1 },
};

/** Campfire: 4 frames on row 1, cols 0-3. */
export const CAMPFIRE_FRAMES: Cell[] = [
  { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
];

/** Fishing-spot ripple: 3 frames on row 1, cols 4-6. */
export const RIPPLE_FRAMES: Cell[] = [
  { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 1, col: 6 },
];

/** Maps a gamedata node id to its prop art. */
export const NODE_PROP: Record<string, string> = {
  meadowrest_pine: "tree_pine",
  meadowrest_willow: "tree_willow",
  meadowrest_oak: "tree_oak",
  meadowrest_copper_vein: "ore_copper",
  meadowrest_tin_vein: "ore_tin",
  meadowrest_furnace: "furnace",
  meadowrest_anvil: "anvil",
  bramblewood_charwood: "tree_dead",
  bramblewood_ancient_bark: "tree_oak",
  ashen_coal: "ore_coal",
  ashen_iron: "ore_iron",
  ashen_deep_iron: "ore_iron",
};

/** Node ids that render as an animated fishing ripple instead of a solid prop. */
export const FISHING_NODES = new Set([
  "meadowrest_trout_stream",
  "meadowrest_minnow_pool",
  "bramblewood_perch_stream",
  "ashen_eel_pool",
]);

/** Node ids that render as an animated campfire. */
export const CAMPFIRE_NODES = new Set(["meadowrest_campfire"]);

/**
 * Deterministic variant pick so a given tile always looks the same
 * (no shimmering between frames) but the field isn't uniform.
 */
export function variantFor(tx: number, ty: number, count: number): number {
  if (count <= 1) return 0;
  let n = (tx * 73856093) ^ (ty * 19349663);
  n = (n ^ (n >>> 13)) >>> 0;
  return n % count;
}
