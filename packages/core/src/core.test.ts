import { describe, expect, it, vi } from "vitest";
import {
  addItem,
  ATTUNEMENT_SKILL_COUNT,
  ATTUNEMENT_SKILLS,
  advanceSimulation,
  applyQuestEvents,
  calculateOfflineElapsed,
  combatHitChancePpm,
  countAttunedSkills,
  createNewSave,
  deserializeSave,
  deterministicRollPpm,
  equipItem,
  forceCompleteQuest,
  itemQuantity,
  levelFromXp,
  migrateSave,
  pickupGroundItem,
  playerCombatStats,
  serializeSave,
  startActivityForTarget,
  xpForLevel,
  type ContentBundle,
  type GameEvent,
  type GameSave,
  type SkillId,
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

  it("keeps opposed combat identical across foreground ticks, offline time, and a mid-fight reload", () => {
    const sparringContent: ContentBundle = {
      ...TEST_CONTENT,
      enemies: {
        ...TEST_CONTENT.enemies,
        lethal_enemy: {
          ...TEST_CONTENT.enemies.lethal_enemy!,
          combatLevel: 1,
          maxHp: 10_000,
          accuracy: 1,
          evasion: 12,
          armor: 1,
          minDamage: 0,
          maxDamage: 0,
        },
      },
    };
    const base = { ...createNewSave(0, "combat-partition-seed", { x: 5, z: 5 }), quests: {} };
    const inventory = addItem(base.inventory, base.inventorySlots, "training_blade", 1, sparringContent);
    if (!inventory) throw new Error("fixture combat inventory failed");
    const equipped = equipItem({ ...base, inventory }, "training_blade", sparringContent).state;
    const initial = startActivityForTarget(equipped, "enemy", sparringContent).state;

    let foreground = initial;
    for (let second = 0; second < 11; second += 1) {
      foreground = advanceSimulation(foreground, 1_000, sparringContent).state;
    }
    const offline = advanceSimulation(initial, 11_000, sparringContent).state;
    expect(foreground).toEqual(offline);

    const partial = advanceSimulation(initial, 4_321, sparringContent).state;
    const reloaded = deserializeSave(serializeSave(partial));
    const resumed = advanceSimulation(reloaded, 6_679, sparringContent).state;
    expect(resumed).toEqual(offline);
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

  it("derives combat stats only from real equipped item definitions", () => {
    const base = { ...createNewSave(0, "weapon-seed", { x: 5, z: 5 }), quests: {} };
    const unarmed = playerCombatStats(base, TEST_CONTENT);
    const nonexistent = playerCombatStats(
      { ...base, equipment: { ...base.equipment, weapon: "missing_weapon" } },
      TEST_CONTENT,
    );
    expect(nonexistent).toEqual(unarmed);

    const inventory = addItem(base.inventory, base.inventorySlots, "training_blade", 1, TEST_CONTENT);
    if (!inventory) throw new Error("fixture weapon inventory failed");
    const armed = equipItem({ ...base, inventory }, "training_blade", TEST_CONTENT).state;
    const armedStats = playerCombatStats(armed, TEST_CONTENT);
    expect(armedStats.accuracy).toBe(unarmed.accuracy + 12);
    expect(armedStats.maxHit).toBe(unarmed.maxHit + 5);
  });

  it("makes defensive equipment reduce an enemy's deterministic hit chance", () => {
    const base = { ...createNewSave(0, "armor-seed", { x: 5, z: 5 }), quests: {} };
    const inventory = addItem(base.inventory, base.inventorySlots, "training_vest", 1, TEST_CONTENT);
    if (!inventory) throw new Error("fixture armor inventory failed");
    const armored = equipItem({ ...base, inventory }, "training_vest", TEST_CONTENT).state;
    const ordinaryEnemyAccuracy = 18;
    const unarmoredChance = combatHitChancePpm(ordinaryEnemyAccuracy, playerCombatStats(base, TEST_CONTENT).defence);
    const armoredChance = combatHitChancePpm(ordinaryEnemyAccuracy, playerCombatStats(armored, TEST_CONTENT).defence);
    expect(armoredChance).toBeLessThan(unarmoredChance);
  });

  it("awards non-stackable combat equipment once instead of filling the pack with duplicates", () => {
    const rewardContent: ContentBundle = {
      ...TEST_CONTENT,
      items: {
        ...TEST_CONTENT.items,
        training_vest: { ...TEST_CONTENT.items.training_vest!, collection: true },
      },
      enemies: {
        ...TEST_CONTENT.enemies,
        lethal_enemy: {
          ...TEST_CONTENT.enemies.lethal_enemy!,
          combatLevel: 1,
          maxHp: 1,
          accuracy: 1,
          evasion: 0,
          armor: 0,
          minDamage: 0,
          maxDamage: 0,
          loot: [{ itemId: "training_vest", minQuantity: 1, maxQuantity: 1, chancePpm: 1_000_000 }],
        },
      },
    };
    const initial = startActivityForTarget(
      { ...createNewSave(0, "unique-reward-seed", { x: 5, z: 5 }), quests: {} },
      "enemy",
      rewardContent,
    ).state;
    const first = advanceSimulation(initial, 60_000, rewardContent).state;
    expect(itemQuantity(first.inventory, "training_vest")).toBe(1);
    expect(first.collections).toContain("training_vest");

    const readyAgain = {
      ...first,
      simulationTimeMs: first.worldEnemies.enemy?.defeatedUntilMs ?? first.simulationTimeMs,
      worldEnemies: {},
    };
    const secondStarted = startActivityForTarget(readyAgain, "enemy", rewardContent).state;
    const second = advanceSimulation(secondStarted, 60_000, rewardContent).state;
    expect(itemQuantity(second.inventory, "training_vest")).toBe(1);
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

describe("Verdant attunement gate", () => {
  const SKILLS: readonly SkillId[] = ATTUNEMENT_SKILLS;

  it("counts only the five authored skills, even if a future save contains more skills", () => {
    const skills = {
      ...createNewSave(0, "future-skill-seed", { x: 5, z: 5 }).skills,
      sailing: { xp: xpForLevel(99) },
    };
    expect(ATTUNEMENT_SKILL_COUNT).toBe(5);
    expect(countAttunedSkills(skills)).toBe(0);
    expect(countAttunedSkills({
      ...skills,
      woodcutting: { xp: xpForLevel(5) },
    })).toBe(1);
  });

  const gateContent: ContentBundle = {
    ...TEST_CONTENT,
    quests: {
      ...TEST_CONTENT.quests,
      gate: {
        id: "gate",
        name: "Gate",
        summary: "Every skill must reach level five.",
        steps: [{ id: "attune_all", kind: "attune", objective: "Attune all five skills.", targetId: null, itemId: null, count: 5 }],
        nextQuestId: "reward",
        completionFlag: "gate_awakened",
      },
      reward: {
        id: "reward",
        name: "Reward",
        summary: "A reward quest chained after the gate.",
        steps: [{ id: "touch", kind: "interact", objective: "Touch the reward.", targetId: "tree", itemId: null, count: 1 }],
      },
    },
  };

  it("recomputes attunement progress from live skill levels rather than accumulating events", () => {
    let save: GameSave = {
      ...createNewSave(0, "gate-seed", { x: 5, z: 5 }),
      quests: { gate: { status: "active", stepIndex: 0, stepProgress: 0 } },
    };
    SKILLS.forEach((skill, index) => {
      const from = levelFromXp(save.skills[skill].xp);
      save = { ...save, skills: { ...save.skills, [skill]: { xp: xpForLevel(5) } } };
      const event: GameEvent = { type: "level_gained", skill, from, to: 5 };
      const applied = applyQuestEvents(save, [event], gateContent);
      save = applied.state;

      const expectedProgress = index + 1;
      if (expectedProgress < 5) {
        expect(save.quests.gate).toEqual({ status: "active", stepIndex: 0, stepProgress: expectedProgress });
        expect(save.worldFlags.gate_awakened).toBeUndefined();
      } else {
        expect(save.quests.gate?.status).toBe("completed");
      }
    });

    expect(save.worldFlags.gate_awakened).toBe(true);
    expect(save.quests.reward).toEqual({ status: "active", stepIndex: 0, stepProgress: 0 });
  });

  it("never over-counts: dropping back below the requirement is reflected too", () => {
    const save: GameSave = {
      ...createNewSave(0, "gate-drop-seed", { x: 5, z: 5 }),
      quests: { gate: { status: "active", stepIndex: 0, stepProgress: 4 } },
      skills: {
        woodcutting: { xp: xpForLevel(5) },
        mining: { xp: xpForLevel(5) },
        fishing: { xp: xpForLevel(5) },
        cooking: { xp: xpForLevel(5) },
        melee: { xp: 0 },
      },
    };
    const event: GameEvent = { type: "level_gained", skill: "melee", from: 4, to: 4 };
    const applied = applyQuestEvents(save, [event], gateContent);
    expect(applied.state.quests.gate).toEqual({ status: "active", stepIndex: 0, stepProgress: 4 });
  });

  it("forceCompleteQuest completes and chains identically to natural completion", () => {
    const save: GameSave = {
      ...createNewSave(0, "force-seed", { x: 5, z: 5 }),
      quests: { gate: { status: "active", stepIndex: 0, stepProgress: 3 } },
    };
    const forced = forceCompleteQuest(save, "gate", gateContent);
    expect(forced.quests.gate?.status).toBe("completed");
    expect(forced.worldFlags.gate_awakened).toBe(true);
    expect(forced.quests.reward).toEqual({ status: "active", stepIndex: 0, stepProgress: 0 });
  });

  it("forceCompleteQuest is a no-op once the quest is already completed", () => {
    const save: GameSave = {
      ...createNewSave(0, "force-seed-2", { x: 5, z: 5 }),
      quests: { gate: { status: "completed", stepIndex: 1, stepProgress: 0 } },
    };
    expect(forceCompleteQuest(save, "gate", gateContent)).toEqual(save);
  });

  it("gates a requiredFlag-locked interactable until its flag is set", () => {
    const lockedContent: ContentBundle = {
      ...gateContent,
      zones: {
        ...gateContent.zones,
        meadowrest: {
          ...gateContent.zones.meadowrest!,
          interactables: [
            ...gateContent.zones.meadowrest!.interactables,
            {
              id: "locked_tree",
              kind: "resource",
              displayName: "Locked Tree",
              assetId: "asset.tree",
              x: 6,
              z: 6,
              resourceId: "test_tree",
              itemId: null,
              recipeId: null,
              enemyId: null,
              quantity: 0,
              interactionRadius: 1,
              blocks: true,
              requiredFlag: "gate_awakened",
            },
          ],
        },
      },
    };
    const base = { ...createNewSave(0, "locked-seed", { x: 5, z: 5 }), quests: {} };
    const inventory = addItem(base.inventory, base.inventorySlots, "axe", 1, lockedContent);
    if (!inventory) throw new Error("fixture inventory failed");
    const equipped = equipItem({ ...base, inventory }, "axe", lockedContent).state;

    const lockedAttempt = startActivityForTarget(equipped, "locked_tree", lockedContent);
    expect(lockedAttempt.ok).toBe(false);

    const unlocked = { ...equipped, worldFlags: { ...equipped.worldFlags, gate_awakened: true } };
    const unlockedAttempt = startActivityForTarget(unlocked, "locked_tree", lockedContent);
    expect(unlockedAttempt.ok).toBe(true);
  });
});

describe("save migration", () => {
  it("upgrades a v1 save in place without touching an incomplete First Thread", () => {
    const v1 = { ...createNewSave(0, "migrate-seed-1", { x: 5, z: 5 }), saveVersion: 1 };
    const migrated = migrateSave(v1);
    expect(migrated.saveVersion).toBe(2);
    expect(migrated.quests.first_thread?.status).toBe("active");
    expect(migrated.quests.verdant_loomstone).toBeUndefined();
  });

  it("seeds the Verdant Loomstone quest for a completed First Thread, resuming partial attunement", () => {
    const v1 = {
      ...createNewSave(0, "migrate-seed-2", { x: 5, z: 5 }),
      saveVersion: 1,
      quests: { first_thread: { status: "completed" as const, stepIndex: 16, stepProgress: 0 } },
      skills: {
        woodcutting: { xp: xpForLevel(5) },
        mining: { xp: xpForLevel(5) },
        fishing: { xp: xpForLevel(3) },
        cooking: { xp: 0 },
        melee: { xp: 0 },
      },
    };
    const migrated = migrateSave(v1);
    expect(migrated.saveVersion).toBe(2);
    expect(migrated.quests.verdant_loomstone).toEqual({ status: "active", stepIndex: 0, stepProgress: 2 });
    expect(migrated.quests.first_thread?.status).toBe("completed");
  });

  it("skips straight past the attune step for a save that was already fully attuned", () => {
    const v1 = {
      ...createNewSave(0, "migrate-seed-3", { x: 5, z: 5 }),
      saveVersion: 1,
      quests: { first_thread: { status: "completed" as const, stepIndex: 16, stepProgress: 0 } },
      skills: {
        woodcutting: { xp: xpForLevel(9) },
        mining: { xp: xpForLevel(5) },
        fishing: { xp: xpForLevel(30) },
        cooking: { xp: xpForLevel(5) },
        melee: { xp: xpForLevel(12) },
      },
    };
    const migrated = migrateSave(v1);
    expect(migrated.quests.verdant_loomstone).toEqual({ status: "active", stepIndex: 1, stepProgress: 0 });
  });

  it("is idempotent and does not re-seed an already-migrated quest", () => {
    const v1 = {
      ...createNewSave(0, "migrate-seed-4", { x: 5, z: 5 }),
      saveVersion: 1,
      quests: {
        first_thread: { status: "completed" as const, stepIndex: 16, stepProgress: 0 },
        verdant_loomstone: { status: "completed" as const, stepIndex: 3, stepProgress: 0 },
      },
    };
    const migrated = migrateSave(v1);
    expect(migrated.quests.verdant_loomstone).toEqual({ status: "completed", stepIndex: 3, stepProgress: 0 });
  });

  it("rejects a genuinely unknown save version", () => {
    const fresh = createNewSave(0, "migrate-seed-5", { x: 5, z: 5 });
    expect(() => migrateSave({ ...fresh, saveVersion: 99 })).toThrow();
  });
});
