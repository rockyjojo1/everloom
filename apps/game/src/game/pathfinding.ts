import type { GridPosition, ZoneDefinition, ZoneInteractable } from "@everloom/core";

const DIRECTIONS = [
  { x: 1, z: 0, cost: 1 }, { x: -1, z: 0, cost: 1 },
  { x: 0, z: 1, cost: 1 }, { x: 0, z: -1, cost: 1 },
  { x: 1, z: 1, cost: Math.SQRT2 }, { x: 1, z: -1, cost: Math.SQRT2 },
  { x: -1, z: 1, cost: Math.SQRT2 }, { x: -1, z: -1, cost: Math.SQRT2 },
] as const;

const key = (p: GridPosition) => `${p.x},${p.z}`;
const distance = (a: GridPosition, b: GridPosition) => Math.hypot(a.x - b.x, a.z - b.z);

export function blockedSet(zone: ZoneDefinition, ignoreTargetId?: string): Set<string> {
  const blocked = new Set(zone.blockedCells.map(key));
  for (const item of zone.scenery) if (item.blocks) blocked.add(key({ x: Math.round(item.x), z: Math.round(item.z) }));
  for (const item of zone.interactables) {
    if (item.blocks && item.id !== ignoreTargetId) blocked.add(key(item));
  }
  for (let x = 0; x < zone.width; x += 1) {
    for (let z = 0; z < zone.depth; z += 1) {
      if (surfaceAt(zone, x, z) === "water") blocked.add(key({ x, z }));
    }
  }
  return blocked;
}

export function surfaceAt(zone: ZoneDefinition, x: number, z: number): ZoneDefinition["terrain"][number]["surface"] {
  let surface: ZoneDefinition["terrain"][number]["surface"] = "grass";
  for (const region of zone.terrain) {
    if (region.shape === "rect" && x >= region.x && z >= region.z && x < region.x + region.width && z < region.z + region.depth) {
      surface = region.surface;
    } else if (region.shape === "circle" && distance({ x, z }, region) <= region.width / 2) {
      surface = region.surface;
    } else if (region.shape === "path" && region.endX !== null && region.endZ !== null) {
      const dx = region.endX - region.x;
      const dz = region.endZ - region.z;
      const length2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - region.x) * dx + (z - region.z) * dz) / length2));
      if (Math.hypot(x - (region.x + t * dx), z - (region.z + t * dz)) <= region.width / 2) surface = region.surface;
    }
  }
  return surface;
}

export function findPath(zone: ZoneDefinition, start: GridPosition, destinations: readonly GridPosition[], blocked = blockedSet(zone)): GridPosition[] {
  const goals = new Set(destinations.map(key));
  if (goals.has(key(start))) return [];
  const open = new Map<string, { p: GridPosition; g: number; f: number }>();
  const came = new Map<string, string>();
  const points = new Map<string, GridPosition>([[key(start), start]]);
  const costs = new Map<string, number>([[key(start), 0]]);
  open.set(key(start), { p: start, g: 0, f: Math.min(...destinations.map((p) => distance(start, p))) });

  while (open.size > 0) {
    const current = [...open.values()].sort((a, b) => a.f - b.f || a.g - b.g)[0]!;
    const currentKey = key(current.p);
    open.delete(currentKey);
    if (goals.has(currentKey)) {
      const path: GridPosition[] = [];
      let cursor = currentKey;
      while (cursor !== key(start)) {
        path.unshift(points.get(cursor)!);
        cursor = came.get(cursor)!;
      }
      return path;
    }
    for (const direction of DIRECTIONS) {
      const next = { x: current.p.x + direction.x, z: current.p.z + direction.z };
      const nextKey = key(next);
      if (next.x < 0 || next.z < 0 || next.x >= zone.width || next.z >= zone.depth || blocked.has(nextKey)) continue;
      if (direction.x !== 0 && direction.z !== 0) {
        if (blocked.has(key({ x: current.p.x + direction.x, z: current.p.z })) ||
            blocked.has(key({ x: current.p.x, z: current.p.z + direction.z }))) continue;
      }
      const nextCost = current.g + direction.cost;
      if (nextCost >= (costs.get(nextKey) ?? Infinity)) continue;
      costs.set(nextKey, nextCost);
      came.set(nextKey, currentKey);
      points.set(nextKey, next);
      const heuristic = Math.min(...destinations.map((p) => distance(next, p)));
      open.set(nextKey, { p: next, g: nextCost, f: nextCost + heuristic });
    }
  }
  return [];
}

export function pathToTarget(zone: ZoneDefinition, start: GridPosition, target: ZoneInteractable): GridPosition[] {
  const blocked = blockedSet(zone, target.id);
  if (!target.blocks && target.interactionRadius === 0) return findPath(zone, start, [{ x: target.x, z: target.z }], blocked);
  const radius = Math.max(1, target.interactionRadius);
  const destinations: GridPosition[] = [];
  for (let x = Math.floor(target.x - radius); x <= Math.ceil(target.x + radius); x += 1) {
    for (let z = Math.floor(target.z - radius); z <= Math.ceil(target.z + radius); z += 1) {
      const candidate = { x, z };
      if (x >= 0 && z >= 0 && x < zone.width && z < zone.depth && distance(candidate, target) <= radius && !blocked.has(key(candidate))) {
        destinations.push(candidate);
      }
    }
  }
  return findPath(zone, start, destinations, blocked);
}

