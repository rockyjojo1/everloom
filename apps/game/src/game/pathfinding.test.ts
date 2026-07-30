import { describe, expect, it } from "vitest";
import { CONTENT } from "@everloom/content";
import { findPath, pathToTarget } from "./pathfinding";

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
});
