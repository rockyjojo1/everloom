import { describe, expect, it, vi } from "vitest";
import {
  addItem,
  advanceSimulation,
  calculateOfflineElapsed,
  createNewSave,
  deserializeSave,
  deterministicRollPpm,
  equipItem,
  itemQuantity,
  pickupGroundItem,
  serializeSave,
  startActivityForTarget,
} from "./index";
import { TEST_CONTENT } from "./test-fixture";

function equippedSave(seed = "test-seed") {
  const base = createNewSave(1_000, seed, { x: 5, z: 5 });
  const inventory = addItem(base.inventory, base.inventorySlots, "axe", 1, TEST_CONTENT);
  if (!inventory) throw new Error("fixture inventory failed");
  return equipItem({ ...base, inventory, quests: {} }, "axe", TEST_CONTENT).state;
}

describe("deterministic RNG", () => {
  it("uses explicit integer parts-per-million", () => {
    expect(deterministicRollPpm("seed", 0, "test", "target", 1_000_000)).toBe(true);
    expect(deterministicRollPpm("seed", 0, "test", "target", 0)).toBe(false);
    expect(() => deterministicRollPpm("seed", 0, "test", "target", 0.5)).toThrow();
  });

  it("does not call Math.random in state logic", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used");
    });
    const started = startActivityForTarget(equippedSave(), "tree", TEST_CONTENT);
    expect(() => advanceSimulation(started.state, 20_000, TEST_CONTENT)).not.toThrow();
    random.mockRestore();
  });
});

describe("time-partition invariance", () => {
  it("produces the same final state for sixty one-minute updates and one sixty-minute update", () => {
    const initial = startActivityForTarget(
      { ...equippedSave("partition-seed"), inventorySlots: 1000 },
      "tree",
      TEST_CONTENT,
    ).state;
    let split = initial;
    for (let minute = 0; minute < 60; minute += 1) {
      split = advanceSimulation(split, 60_000, TEST_CONTENT).state;
    }
    const combined = advanceSimulation(initial, 3_600_000, TEST_CONTENT).state;
    expect(split).toEqual(combined);
  });

  it("retains the same result across a serialized mid-activity reload", () => {
    const initial = startActivityForTarget(equippedSave("reload-seed"), "tree", TEST_CONTENT).state;
    const partial = advanceSimulation(initial, 4_321, TEST_CONTENT).state;
    const reloaded = deserializeSave(serializeSave(partial));
    const resumed = advanceSimulation(reloaded, 25_679, TEST_CONTENT).state;
    const uninterrupted = advanceSimulation(initial, 30_000, TEST_CONTENT).state;
    expect(resumed).toEqual(uninterrupted);
  });
});

describe("offline stop conditions", () => {
  it("has no arbitrary hour/day cap", () => {
    const started = startActivityForTarget(
      { ...equippedSave("long-seed"), inventorySlots: 1000 },
      "long_tree_target",
      TEST_CONTENT,
    ).state;
    const tenDays = 10 * 24 * 60 * 60 * 1000;
    const result = advanceSimulation(started, tenDays, TEST_CONTENT);
    expect(result.state.simulationTimeMs).toBe(tenDays);
    expect(itemQuantity(result.state.inventory, "log")).toBe(40);
    expect(result.report.elapsedMs).toBe(tenDays);
  });

  it("stops gathering naturally when inventory is full", () => {
    const cappedContent = {
      ...TEST_CONTENT,
      items: {
        ...TEST_CONTENT.items,
        log: { ...TEST_CONTENT.items.log!, maxStack: 2 },
      },
      resources: {
        ...TEST_CONTENT.resources,
        test_tree: { ...TEST_CONTENT.resources.test_tree!, rareDrops: [] },
      },
    };
    const initial = startActivityForTarget(
      { ...equippedSave("full-seed"), inventorySlots: 1 },
      "tree",
      cappedContent,
    ).state;
    const result = advanceSimulation(initial, 1_000_000, cappedContent);
    expect(result.report.stopReason).toBe("inventory_full");
    expect(result.state.currentActivity).toBeNull();
    expect(result.report.stopAtMs).toBeLessThan(result.report.elapsedMs);
    expect(itemQuantity(result.state.inventory, "log")).toBe(2);
  });

  it("stops crafting when inputs are exhausted", () => {
    const base = createNewSave(0, "craft-seed", { x: 5, z: 5 });
    const inventory = addItem(base.inventory, base.inventorySlots, "raw", 2, TEST_CONTENT);
    if (!inventory) throw new Error("fixture inventory failed");
    const started = startActivityForTarget({ ...base, inventory, quests: {} }, "fire", TEST_CONTENT).state;
    const result = advanceSimulation(started, 60_000, TEST_CONTENT);
    expect(result.report.stopReason).toBe("inputs_exhausted");
    expect(itemQuantity(result.state.inventory, "cooked")).toBe(2);
  });

  it("stops deterministic combat on death", () => {
    const initial = startActivityForTarget(
      { ...createNewSave(0, "death-seed", { x: 5, z: 5 }), quests: {} },
      "enemy",
      TEST_CONTENT,
    ).state;
    const result = advanceSimulation(initial, 60_000, TEST_CONTENT);
    expect(result.report.stopReason).toBe("player_died");
    expect(result.report.deaths).toBe(1);
    expect(result.state.currentActivity).toBeNull();
  });

  it("makes an equipped weapon meaningfully increase melee damage", () => {
    const unarmed = startActivityForTarget(
      { ...createNewSave(0, "weapon-seed", { x: 5, z: 5 }), quests: {} },
      "enemy",
      TEST_CONTENT,
    ).state;
    const armed = { ...unarmed, equipment: { ...unarmed.equipment, weapon: "training_blade" } };
    const unarmedHit = advanceSimulation(unarmed, 1_000, TEST_CONTENT).events
      .find((event) => event.type === "damage" && event.target === "enemy");
    const armedHit = advanceSimulation(armed, 1_000, TEST_CONTENT).events
      .find((event) => event.type === "damage" && event.target === "enemy");
    expect(unarmedHit?.type === "damage" ? unarmedHit.amount : 0).toBeGreaterThan(0);
    expect(armedHit?.type === "damage" ? armedHit.amount : 0).toBe((unarmedHit?.type === "damage" ? unarmedHit.amount : 0) + 2);
  });

  it("handles hours and several days without negative or corrupt elapsed time", () => {
    expect(calculateOfflineElapsed(10_000, 1_000)).toBe(9_000);
    expect(calculateOfflineElapsed(1_000, 10_000)).toBe(0);
    expect(calculateOfflineElapsed(Number.NaN, 10_000)).toBe(0);
    expect(calculateOfflineElapsed(10_000, Number.POSITIVE_INFINITY)).toBe(0);
    const state = equippedSave();
    expect(advanceSimulation(state, -100, TEST_CONTENT).state).toEqual(state);
  });
});

describe("quest-critical item flow", () => {
  it("physically picks up, equips, and uses the tutorial axe", () => {
    const initial = {
      ...createNewSave(0, "quest-seed", { x: 5, z: 5 }),
      quests: { tutorial: { status: "active" as const, stepIndex: 0, stepProgress: 0 } },
    };
    const picked = pickupGroundItem(initial, "ground_axe", TEST_CONTENT);
    expect(picked.ok).toBe(true);
    expect(picked.state.quests.tutorial?.stepIndex).toBe(1);
    const equipped = equipItem(picked.state, "axe", TEST_CONTENT);
    expect(equipped.ok).toBe(true);
    expect(equipped.state.quests.tutorial?.stepIndex).toBe(2);
    const started = startActivityForTarget(equipped.state, "tree", TEST_CONTENT);
    const gathered = advanceSimulation(started.state, 10_000, TEST_CONTENT);
    expect(gathered.state.quests.tutorial?.status).toBe("completed");
    expect(itemQuantity(gathered.state.inventory, "log")).toBe(1);
    expect(itemQuantity(gathered.state.inventory, "rare")).toBe(1);
  });
});
