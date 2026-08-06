import { describe, expect, it } from "vitest";
import { CONTENT } from "@everloom/content";
import { findPath, findPathResult, pathToTarget, pathToTargetResult } from "./pathfinding";

const zone = CONTENT.zones.meadowrest!;

describe("A* movement", () => {
  it("reaches an open destination without repeating the start", () => {
    const path = findPath(zone, { x: 19, z: 16 }, [{ x: 20, z: 16 }]);
    expect(path).toEqual([{ x: 20, z: 16 }]);
  });

  it("does not cut diagonally between blocked cells", () => {
    const blocked = new Set(["1,0", "0,1"]);
    expect(findPath(zone, { x: 0, z: 0 }, [{ x: 1, z: 1 }], blocked)).toEqual([]);
  });

  it("selects a reachable interaction cell beside a blocking target", () => {
    const target = zone.interactables.find((entry) => entry.id === "oak_west_1")!;
    const path = pathToTarget(zone, zone.spawn, target);
    const end = path.at(-1)!;
    expect(Math.hypot(end.x - target.x, end.z - target.z)).toBeLessThanOrEqual(target.interactionRadius);
    expect(end).not.toEqual({ x: target.x, z: target.z });
  });

  it("reaches every Verdant Grove target from the village spawn", () => {
    for (const id of ["verdant_loomstone", "verdant_heartwood_1", "verdant_heartwood_2", "grove_hearth"]) {
      const target = zone.interactables.find((entry) => entry.id === id)!;
      expect(target, `missing interactable ${id}`).toBeDefined();
      const path = pathToTarget(zone, zone.spawn, target);
      expect(path.length, `no path found to ${id}`).toBeGreaterThan(0);
      const end = path.at(-1)!;
      expect(Math.hypot(end.x - target.x, end.z - target.z)).toBeLessThanOrEqual(Math.max(1, target.interactionRadius));
    }
  });

  it("reaches the Smithing facilities and every quarry copper node from the village spawn", () => {
    for (const id of ["meadowrest_smelter", "meadowrest_anvil", "copper_north_1", "copper_north_2", "copper_north_3"]) {
      const target = zone.interactables.find((entry) => entry.id === id)!;
      expect(target, `missing interactable ${id}`).toBeDefined();
      const path = pathToTarget(zone, zone.spawn, target);
      expect(path.length, `no path found to ${id}`).toBeGreaterThan(0);
      const end = path.at(-1)!;
      expect(Math.hypot(end.x - target.x, end.z - target.z)).toBeLessThanOrEqual(Math.max(1, target.interactionRadius));
    }
  });

  it("walks the smelter and anvil as a short, adjacent quarry loop", () => {
    const smelter = zone.interactables.find((entry) => entry.id === "meadowrest_smelter")!;
    const anvil = zone.interactables.find((entry) => entry.id === "meadowrest_anvil")!;
    const path = pathToTarget(zone, { x: smelter.x, z: smelter.z }, anvil);
    expect(path.length, "the smelter and anvil should be a short physical walk apart").toBeGreaterThan(0);
    expect(path.length).toBeLessThanOrEqual(3);
  });

  it("distinguishes already-there from a found route", () => {
    expect(findPathResult(zone, { x: 20, z: 16 }, [{ x: 20, z: 16 }])).toEqual({ status: "already_there" });
    expect(findPathResult(zone, { x: 19, z: 16 }, [{ x: 20, z: 16 }])).toEqual({ status: "found", path: [{ x: 20, z: 16 }] });
  });

  it("reports unreachable, not an empty found route, when no path exists", () => {
    // Box the start in on all eight neighbours (plus their orthogonal pairs,
    // so diagonal cutting can't slip through either) so no destination is
    // reachable at all — distinct from "destination equals start".
    const start = { x: 5, z: 5 };
    const blocked = new Set<string>();
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        if (dx === 0 && dz === 0) continue;
        blocked.add(`${start.x + dx},${start.z + dz}`);
      }
    }
    expect(findPathResult(zone, start, [{ x: 0, z: 0 }], blocked)).toEqual({ status: "unreachable" });
  });

  it("pathToTargetResult already-there matches pathToTarget's empty array", () => {
    const target = zone.interactables.find((entry) => entry.id === "npc_mara")!;
    const arrived = pathToTarget(zone, zone.spawn, target).at(-1) ?? zone.spawn;
    // Walk exactly onto the resolved interaction cell, then re-query from there.
    const onSite = arrived;
    expect(pathToTargetResult(zone, onSite, target)).toEqual({ status: "already_there" });
    expect(pathToTarget(zone, onSite, target)).toEqual([]);
  });

  it("pathToTargetResult reports found with the same path as pathToTarget", () => {
    const target = zone.interactables.find((entry) => entry.id === "oak_west_1")!;
    const legacy = pathToTarget(zone, zone.spawn, target);
    const result = pathToTargetResult(zone, zone.spawn, target);
    expect(result).toEqual({ status: "found", path: legacy });
  });

  it("does not let the new Smithing facilities block any existing authored route", () => {
    for (const id of ["oak_west_1", "verdant_loomstone", "verdant_heartwood_1", "verdant_heartwood_2", "grove_hearth", "first_loomstone", "npc_mara"]) {
      const target = zone.interactables.find((entry) => entry.id === id)!;
      const path = pathToTarget(zone, zone.spawn, target);
      expect(path.length, `regression: no path found to ${id}`).toBeGreaterThan(0);
    }
  });
});
