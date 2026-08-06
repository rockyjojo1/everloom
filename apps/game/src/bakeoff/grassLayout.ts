import type { AssetPlacement, CharacterInstance, RoomDimensions } from "./productionRoomTypes";

export interface GrassTransform {
  x: number;
  z: number;
  scale: number;
  rotationY: number;
}

export interface GrassLayoutInput {
  count: number;
  roomDimensions: RoomDimensions;
  placements: AssetPlacement[];
  characters: CharacterInstance[];
}

/** Simple deterministic hash for generating positions from an index. Pure, no non-deterministic RNG. */
function deterministicHash(index: number, seed: number): number {
  const x = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const FIXED_PLACEMENT_CLEARANCE = 1.5;
const CHARACTER_CLEARANCE = 1.5;
const RIVER_CLEARANCE = 4;
const PATH_CLEARANCE = 2;
const MIN_MUTUAL_SPACING = 0.35;
const ROOM_MARGIN = 1;

/** Every fixed (non-additional) layout placement plus all characters, as clearance obstacles. Pure — derived only from input data. */
function getClearanceObstacles(
  placements: AssetPlacement[],
  characters: CharacterInstance[]
): Array<{ x: number; z: number; clearance: number }> {
  const obstacles: Array<{ x: number; z: number; clearance: number }> = [];

  for (const placement of placements) {
    if (!placement.instance.startsWith("additional-")) {
      obstacles.push({
        x: placement.position[0],
        z: placement.position[2],
        clearance: FIXED_PLACEMENT_CLEARANCE,
      });
    }
  }

  for (const character of characters) {
    obstacles.push({
      x: character.position[0],
      z: character.position[2],
      clearance: CHARACTER_CLEARANCE,
    });
  }

  return obstacles;
}

/**
 * Generates exactly `count` deterministic grass transforms via a bounded
 * retry loop. Every returned transform is guaranteed clear of the river,
 * the central path, room bounds, every fixed placement, every character,
 * and every other accepted grass point (minimum mutual spacing). Throws a
 * stable error if the exact count cannot be produced within the attempt
 * budget, rather than silently returning fewer.
 */
export function generateGrassLayout(input: GrassLayoutInput): GrassTransform[] {
  const { count, roomDimensions, placements, characters } = input;

  const halfWidth = roomDimensions.groundWidth / 2 - ROOM_MARGIN;
  const halfDepth = roomDimensions.groundDepth / 2 - ROOM_MARGIN;

  const obstacles = getClearanceObstacles(placements, characters);

  const isClearOfObstacles = (x: number, z: number): boolean => {
    return obstacles.every((obstacle) => {
      const dx = x - obstacle.x;
      const dz = z - obstacle.z;
      return Math.sqrt(dx * dx + dz * dz) >= obstacle.clearance;
    });
  };

  const isClearOfRiver = (z: number): boolean => {
    return Math.abs(z - roomDimensions.riverCentreZ) >= RIVER_CLEARANCE;
  };

  const isClearOfPath = (x: number): boolean => {
    return Math.abs(x) > PATH_CLEARANCE;
  };

  const isWithinBounds = (x: number, z: number): boolean => {
    return x >= -halfWidth && x <= halfWidth && z >= -halfDepth && z <= halfDepth;
  };

  const accepted: GrassTransform[] = [];

  const isClearOfOtherGrass = (x: number, z: number): boolean => {
    return accepted.every((g) => {
      const dx = x - g.x;
      const dz = z - g.z;
      return Math.sqrt(dx * dx + dz * dz) >= MIN_MUTUAL_SPACING;
    });
  };

  let attempt = 0;
  const maxAttempts = count * 200;

  while (accepted.length < count && attempt < maxAttempts) {
    const x = deterministicHash(attempt, 1001) * (halfWidth * 2) - halfWidth;
    const z = deterministicHash(attempt, 1002) * (halfDepth * 2) - halfDepth;

    if (
      isWithinBounds(x, z) &&
      isClearOfRiver(z) &&
      isClearOfPath(x) &&
      isClearOfObstacles(x, z) &&
      isClearOfOtherGrass(x, z)
    ) {
      const scale = 0.8 + deterministicHash(attempt, 1003) * 0.4;
      const rotationY = deterministicHash(attempt, 1004) * Math.PI * 2;
      accepted.push({ x, z, scale, rotationY });
    }

    attempt++;
  }

  if (accepted.length < count) {
    throw new Error(
      `generateGrassLayout: failed to generate ${count} valid grass transforms; only produced ${accepted.length} after ${maxAttempts} attempts`
    );
  }

  return accepted;
}
