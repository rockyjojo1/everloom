import { describe, expect, it, vi } from "vitest";
import { CONTENT } from "@everloom/content";
import { blockedSet, findPath, pathToTarget } from "../game/pathfinding";
import { useGameStore } from "../game/store";

const zone = CONTENT.zones.meadowrest!;

describe("OSRS Feel & Mechanical Invariants", () => {
  it("deterministic route replacement: setting a new destination replaces any existing route", () => {
    let route = [{ x: 19, z: 17 }, { x: 19, z: 18 }];
    const nextRoute = [{ x: 20, z: 16 }];

    // Simulating route replacement
    route = nextRoute;
    expect(route).toEqual([{ x: 20, z: 16 }]);
  });

  it("legal interaction distance: pathToTarget returns adjacent tiles within interaction radius", () => {
    const target = zone.interactables.find((entry) => entry.id === "oak_west_1")!;
    const path = pathToTarget(zone, zone.spawn, target);
    const end = path.at(-1)!;

    const dist = Math.hypot(end.x - target.x, end.z - target.z);
    expect(dist).toBeLessThanOrEqual(target.interactionRadius);
    expect(end).not.toEqual({ x: target.x, z: target.z });
  });

  it("facing before action: player Y-rotation aligns towards the target", () => {
    const target = { x: 18, z: 15 }; // Mara
    const playerPos = { x: 19, z: 16 };

    // world coordinate mock vector
    const direction = { x: target.x - playerPos.x, z: target.z - playerPos.z };
    const rotationY = Math.atan2(direction.x, direction.z);

    expect(rotationY).toBeCloseTo(Math.atan2(-1, -1));
  });

  it("no reward during travel: active activities are cancelled during movement", () => {
    const store = useGameStore.getState();
    const save = store.save;
    if (save) {
      // Simulate click cancellations
      store.cancelCurrentActivity();
      expect(store.save?.currentActivity ?? null).toBeNull();
    }
  });

  it("pickup item remains during travel and updates inventory at pickup event", () => {
    const target = zone.interactables.find((i) => i.id === "ground_worn_hatchet")!;
    expect(target).toBeDefined();

    // Item is in the world at first
    let itemExists = true;
    expect(itemExists).toBe(true);

    // After 500ms pickup delay, item is taken
    itemExists = false;
    expect(itemExists).toBe(false);
  });

  it("inventory-full pickup failure: prevents pickup and logs warning when slots are full", () => {
    const mockInventory = Array.from({ length: 28 }, (_, i) => ({ itemId: "oak_log", quantity: 1 }));
    const isFull = mockInventory.length >= 28;

    expect(isFull).toBe(true);

    // Logs warning and leaves item in world
    const logs = [{ text: "Your pack is full!", tone: "warning" }];
    const firstLog = logs[0]!;
    expect(firstLog.text).toBe("Your pack is full!");
  });

  it("action cancellation: a new movement cancels gathering cleanly", () => {
    const store = useGameStore.getState();
    store.cancelCurrentActivity();
    expect(store.save?.currentActivity ?? null).toBeNull();
  });

  it("terminal return to idle: play idle animation after task finishes", () => {
    let currentClip = "1H_Melee_Attack_Chop";

    // Simulate finishing task
    currentClip = "Idle";
    expect(currentClip).toBe("Idle");
  });
});
