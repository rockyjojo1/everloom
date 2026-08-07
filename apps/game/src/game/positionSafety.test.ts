import { describe, expect, it } from "vitest";
import { CONTENT } from "@everloom/content";
import { createNewSave } from "@everloom/core";
import { sanitisePlayerPosition } from "./positionSafety";
import { blockedSet } from "./pathfinding";

const zone = CONTENT.zones.meadowrest!;

function baseSave() {
  return createNewSave(0, "seed", zone.spawn);
}

describe("sanitisePlayerPosition", () => {
  it("leaves an already-legal position untouched", () => {
    const save = baseSave();
    const sanitised = sanitisePlayerPosition(save);
    expect(sanitised).toBe(save);
  });

  it("falls back to zone spawn for a non-integer position", () => {
    const save = { ...baseSave(), position: { x: 4.5, z: 6, facingX: 0, facingZ: 1 } };
    const sanitised = sanitisePlayerPosition(save);
    expect(sanitised.position).toEqual({ ...zone.spawn, facingX: 0, facingZ: 1 });
  });

  it("falls back to zone spawn for an out-of-bounds position", () => {
    const save = { ...baseSave(), position: { x: 99_999, z: -5, facingX: 0, facingZ: 1 } };
    const sanitised = sanitisePlayerPosition(save);
    expect(sanitised.position).toEqual({ ...zone.spawn, facingX: 0, facingZ: 1 });
  });

  it("falls back to zone spawn for a blocked/unwalkable cell", () => {
    const blocked = [...blockedSet(zone)][0]!;
    const [x, z] = blocked.split(",").map(Number);
    const save = { ...baseSave(), position: { x: x!, z: z!, facingX: 0, facingZ: 1 } };
    const sanitised = sanitisePlayerPosition(save);
    expect(sanitised.position).toEqual({ ...zone.spawn, facingX: 0, facingZ: 1 });
  });

  it("falls back to zone spawn for an unknown zone", () => {
    const save = { ...baseSave(), currentZone: "nonexistent-zone" };
    const sanitised = sanitisePlayerPosition(save);
    expect(sanitised.currentZone).toBe(zone.id);
    expect(sanitised.position).toEqual({ ...zone.spawn, facingX: 0, facingZ: 1 });
  });

  it("repairs non-finite facing without resetting a legal position", () => {
    const save = { ...baseSave(), position: { x: zone.spawn.x, z: zone.spawn.z, facingX: NaN, facingZ: Infinity } };
    const sanitised = sanitisePlayerPosition(save);
    expect(sanitised.position).toEqual({ x: zone.spawn.x, z: zone.spawn.z, facingX: 0, facingZ: 1 });
  });

  it("is idempotent when re-applied to an already-sanitised save", () => {
    const save = { ...baseSave(), position: { x: 99_999, z: -5, facingX: 0, facingZ: 1 } };
    const once = sanitisePlayerPosition(save);
    const twice = sanitisePlayerPosition(once);
    expect(twice).toEqual(once);
  });
});
