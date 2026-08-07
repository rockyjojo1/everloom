import { CONTENT } from "@everloom/content";
import type { GameSave } from "@everloom/core";
import { blockedSet } from "./pathfinding";

const FALLBACK_ZONE_ID = "meadowrest";

// A persisted GameSave's position/currentZone came out of IndexedDB (or an
// imported save file) and is not guaranteed to still describe a legal place
// in this build's content: the zone could have been renamed/removed, the
// coordinates could be non-finite/non-integer (corruption, a manual edit),
// or the cell could now be out of bounds or blocked (terrain/scenery changed
// between versions). Restoring blindly can strand the player off the
// walkable grid or inside geometry. This is a pure, deterministic check: any
// invalid position falls back to the target zone's authored spawn, which is
// always a legal, walkable cell.
export function sanitisePlayerPosition(save: GameSave): GameSave {
  const zone = CONTENT.zones[save.currentZone] ?? CONTENT.zones[FALLBACK_ZONE_ID];
  if (!zone) return save;

  const { x, z, facingX, facingZ } = save.position;
  const inBounds = Number.isInteger(x) && Number.isInteger(z)
    && x >= 0 && x < zone.width && z >= 0 && z < zone.depth;
  const onLegalCell = inBounds && !blockedSet(zone).has(`${x},${z}`);

  if (onLegalCell) {
    const safeFacingX = Number.isFinite(facingX) ? facingX : 0;
    const safeFacingZ = Number.isFinite(facingZ) ? facingZ : 1;
    if (safeFacingX === facingX && safeFacingZ === facingZ && save.currentZone === zone.id) return save;
    return { ...save, currentZone: zone.id, position: { x, z, facingX: safeFacingX, facingZ: safeFacingZ } };
  }

  return {
    ...save,
    currentZone: zone.id,
    position: { ...zone.spawn, facingX: 0, facingZ: 1 },
  };
}
