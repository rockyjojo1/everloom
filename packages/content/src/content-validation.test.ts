import { describe, expect, it } from "vitest";
import { ASSET_REGISTRY } from "@everloom/assets/runtime";
import { addItem, ATTUNEMENT_SKILL_COUNT, ATTUNEMENT_SKILLS, createNewSave, equipItem, PROBABILITY_SCALE, playerCombatStats } from "@everloom/core";
import { CONTENT, buildValidatedContent, questSchema, recipeSchema, resourceSchema } from "./index";

describe("Everloom authored content", () => {
  it("validates all schemas and cross-references at build time", () => {
    expect(buildValidatedContent()).toStrictEqual(CONTENT);
    expect(Object.keys(CONTENT.items).length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(CONTENT.zones)).toEqual(["meadowrest"]);
  });

  it("contains physical sources for every tutorial tool", () => {
    const groundItems = CONTENT.zones.meadowrest?.interactables.filter((entry) => entry.kind === "ground_item") ?? [];
    expect(groundItems.map((entry) => entry.itemId)).toEqual(expect.arrayContaining([
      "worn_hatchet",
      "worn_pickaxe",
      "worn_fishing_rod",
      "meadowrest_sword",
    ]));
  });

  it("rejects ambiguous or out-of-range probability values", () => {
    const valid = CONTENT.resources.meadowrest_oak;
    expect(valid).toBeDefined();
    expect(() => resourceSchema.parse({ ...valid, successChancePpm: PROBABILITY_SCALE + 1 })).toThrow();
    expect(() => resourceSchema.parse({ ...valid, successChancePpm: 0.25 })).toThrow();
  });

  it("proves the fishing rod is both spawned and touch-equippable through item data", () => {
    const rod = CONTENT.items.worn_fishing_rod;
    const source = CONTENT.zones.meadowrest?.interactables.find((entry) => entry.itemId === rod?.id);
    expect(rod?.equipmentSlot).toBe("tool");
    expect(rod?.toolKind).toBe("fishing_rod");
    expect(source?.kind).toBe("ground_item");
  });

  it("accepts Smithing at metalworking facilities and rejects mismatched production data", () => {
    const cooking = CONTENT.recipes.cook_riverling!;
    expect(recipeSchema.parse({
      ...cooking,
      id: "smith_test_bar",
      skill: "smithing",
      facilityKind: "furnace",
    })).toMatchObject({ skill: "smithing", facilityKind: "furnace" });
    expect(() => recipeSchema.parse({ ...cooking, skill: "smithing", facilityKind: "cooking_fire" })).toThrow();
    expect(() => recipeSchema.parse({ ...cooking, skill: "cooking", facilityKind: "anvil" })).toThrow();
  });

  it("accepts a source-specific production quest step", () => {
    expect(questSchema.parse({
      id: "smithing_lesson",
      name: "Smithing Lesson",
      summary: "Learn the forge.",
      steps: [{
        id: "forge_bar",
        kind: "produce",
        objective: "Forge a bar at the village furnace.",
        targetId: "village_furnace",
        itemId: "test_bar",
        count: 1,
      }],
    }).steps[0]?.kind).toBe("produce");
  });

  it("maps every authored guidance target to a real world interactable", () => {
    const interactableIds = new Set(Object.values(CONTENT.zones)
      .flatMap((zone) => zone.interactables.map((target) => target.id)));
    const guidedSteps = Object.values(CONTENT.quests)
      .flatMap((quest) => quest.steps)
      .filter((step) => step.guidanceTargetId);

    expect(guidedSteps.length).toBeGreaterThanOrEqual(8);
    for (const step of guidedSteps) expect(interactableIds.has(step.guidanceTargetId!)).toBe(true);
  });

  it("gives every physical First Thread action an honest beacon target", () => {
    const steps = CONTENT.quests.first_thread!.steps;
    const targetFor = (stepId: string) => {
      const step = steps.find((candidate) => candidate.id === stepId);
      return step?.guidanceTargetId ?? step?.targetId ?? null;
    };

    expect(targetFor("gather_logs")).toBe("oak_west_1");
    expect(targetFor("mine_ore")).toBe("copper_north_1");
    expect(targetFor("catch_fish")).toBe("riverling_south");
    expect(targetFor("cook_fish")).toBe("village_cooking_fire");
    expect(targetFor("defeat_skeleton")).toBe("skeleton_east");
  });
});

describe("The Verdant Loomstone chapter", () => {
  it("chains from The Forge's Trade (not directly from The First Thread) and awakens on completion", () => {
    const first = CONTENT.quests.first_thread;
    const forge = CONTENT.quests.forge_trade;
    const verdant = CONTENT.quests.verdant_loomstone;
    // Smithing is tutorial content, so it must sit between First Thread and
    // the Verdant attunement gate, not after groves_gift (which would make it
    // post-tutorial).
    expect(first?.nextQuestId).toBe("forge_trade");
    expect(forge).toBeDefined();
    expect(forge?.nextQuestId).toBe("verdant_loomstone");
    expect(verdant).toBeDefined();
    expect(verdant?.completionFlag).toBe("verdant_loomstone_awakened");
    expect(verdant?.nextQuestId).toBe("groves_gift");
    expect(CONTENT.quests.groves_gift?.completionFlag).toBe("groves_gift_completed");
  });

  it("gates on all five skills via a real attune step, not just HUD text", () => {
    const verdant = CONTENT.quests.verdant_loomstone!;
    expect(verdant.steps[0]).toMatchObject({ kind: "attune", count: 5, targetId: null, itemId: null });
  });

  it("includes exactly one NPC interaction and one Loomstone interaction", () => {
    const verdant = CONTENT.quests.verdant_loomstone!;
    const talkSteps = verdant.steps.filter((step) => step.kind === "talk");
    const interactSteps = verdant.steps.filter((step) => step.kind === "interact");
    expect(talkSteps).toHaveLength(1);
    expect(talkSteps[0]?.targetId).toBe("npc_mara");
    expect(interactSteps).toHaveLength(1);
    expect(interactSteps[0]?.targetId).toBe("verdant_loomstone");
  });

  it("physically places the Verdant Loomstone landmark in Meadowrest", () => {
    const landmark = CONTENT.zones.meadowrest?.interactables.find((entry) => entry.id === "verdant_loomstone");
    expect(landmark?.kind).toBe("landmark");
    expect(landmark?.assetId).toBe("landmark.verdant-loomstone");
  });

  it("gates the reward-tier resource and hearth behind the same awakening flag", () => {
    const gated = CONTENT.zones.meadowrest?.interactables.filter((entry) => entry.requiredFlag) ?? [];
    expect(gated.length).toBeGreaterThanOrEqual(3);
    for (const entry of gated) expect(entry.requiredFlag).toBe("verdant_loomstone_awakened");
    expect(gated.some((entry) => entry.kind === "resource")).toBe(true);
    expect(gated.some((entry) => entry.kind === "facility")).toBe(true);
  });

  it("provides a complete gameplay-affecting reward: a higher woodcutting tier feeding a stronger recipe", () => {
    const heartwood = CONTENT.resources.verdant_heartwood;
    const oak = CONTENT.resources.meadowrest_oak;
    expect(heartwood).toBeDefined();
    expect(heartwood?.xpPerSuccess).toBeGreaterThan(oak?.xpPerSuccess ?? 0);

    const recipe = CONTENT.recipes.cook_verdant_tonic;
    expect(recipe?.inputs.some((input) => input.itemId === "heartwood_log")).toBe(true);
    const tonic = CONTENT.items.verdant_tonic;
    const basicFood = CONTENT.items.cooked_riverling;
    expect(tonic?.healAmount ?? 0).toBeGreaterThan(basicFood?.healAmount ?? 0);
  });

  it("turns the grove reward into a persisted gather-and-brew quest", () => {
    const gift = CONTENT.quests.groves_gift;
    expect(gift?.steps).toEqual([
      expect.objectContaining({ kind: "gather", itemId: "heartwood_log", count: 2 }),
      expect.objectContaining({ kind: "cook", itemId: "verdant_tonic", count: 1 }),
    ]);
  });
});

describe("The Forge's Trade chapter", () => {
  it("has exactly the four authored steps: mine, smelt, smith, equip", () => {
    const forge = CONTENT.quests.forge_trade!;
    expect(forge.steps).toEqual([
      expect.objectContaining({ kind: "gather", itemId: "copper_ore", count: 4, targetId: null }),
      expect.objectContaining({ kind: "produce", itemId: "copper_ingot", count: 2, targetId: "meadowrest_smelter" }),
      expect.objectContaining({ kind: "produce", itemId: "copper_battleaxe", count: 1, targetId: "meadowrest_anvil" }),
      expect.objectContaining({ kind: "equip", itemId: "copper_battleaxe", count: 1, targetId: null }),
    ]);
  });

  it("constrains both production steps to their own facility via targetId, not the legacy cook kind", () => {
    const forge = CONTENT.quests.forge_trade!;
    const produceSteps = forge.steps.filter((step) => step.kind === "produce");
    expect(produceSteps).toHaveLength(2);
    for (const step of produceSteps) expect(step.targetId).not.toBeNull();
    expect(forge.steps.some((step) => step.kind === "cook")).toBe(false);
  });

  it("physically places the smelter and anvil in the quarry at the specified coordinates, one step apart", () => {
    const smelter = CONTENT.zones.meadowrest?.interactables.find((entry) => entry.id === "meadowrest_smelter");
    const anvil = CONTENT.zones.meadowrest?.interactables.find((entry) => entry.id === "meadowrest_anvil");
    expect(smelter).toMatchObject({ kind: "facility", x: 15, z: 5, recipeId: "smelt_copper_ore", assetId: "custom.facility-smelter" });
    expect(anvil).toMatchObject({ kind: "facility", x: 16, z: 6, recipeId: "smith_copper_battleaxe", assetId: "custom.facility-anvil" });
  });

  it("smelts 2 copper ore into 1 ingot at a furnace, and smiths 2 ingots + 2 logs into a battleaxe at an anvil", () => {
    const smelt = CONTENT.recipes.smelt_copper_ore!;
    const smith = CONTENT.recipes.smith_copper_battleaxe!;
    expect(smelt).toMatchObject({
      skill: "smithing",
      facilityKind: "furnace",
      xpPerSuccess: 30,
      actionDurationMs: 2600,
      inputs: [{ itemId: "copper_ore", quantity: 2 }],
      output: { itemId: "copper_ingot", quantity: 1 },
    });
    expect(smith).toMatchObject({
      skill: "smithing",
      facilityKind: "anvil",
      xpPerSuccess: 60,
      actionDurationMs: 3600,
      output: { itemId: "copper_battleaxe", quantity: 1 },
    });
    expect(smith.inputs).toEqual(expect.arrayContaining([
      { itemId: "copper_ingot", quantity: 2 },
      { itemId: "meadow_log", quantity: 2 },
    ]));
  });

  it("makes the Copper Battleaxe a genuine, visually distinct upgrade over the Militia Sword", () => {
    const axe = CONTENT.items.copper_battleaxe!;
    const sword = CONTENT.items.meadowrest_sword!;
    expect(axe.equipmentSlot).toBe("weapon");
    expect(axe.combatBonuses).toEqual({ accuracy: 13, strength: 8, defence: 0 });
    expect(axe.combatBonuses!.accuracy).toBeGreaterThan(sword.combatBonuses!.accuracy);
    expect(axe.combatBonuses!.strength).toBeGreaterThan(sword.combatBonuses!.strength);
    // Its own semantic asset, never a reuse of the sword's procedural mesh.
    expect(axe.worldAssetId).not.toBe(sword.worldAssetId);
    expect(axe.worldAssetId).toBe("custom.weapon-battleaxe");
    expect(axe.iconId).not.toBe(sword.iconId);
  });

  it("does not add Smithing to the five-skill Verdant attunement gate", () => {
    expect(ATTUNEMENT_SKILLS).not.toContain("smithing");
    expect(ATTUNEMENT_SKILL_COUNT).toBe(5);
  });
});

describe("Verdant Grove Ironbark content (post-stabilisation)", () => {
  it("builds the full validated content bundle with the Ironbark identifiers present", () => {
    // Exercises the real schema-validation and cross-reference pathway
    // (buildValidatedContent), not a standalone regex or file-existence check.
    const rebuilt = buildValidatedContent();
    expect(rebuilt).toStrictEqual(CONTENT);
    expect(CONTENT.items.log_ironbark).toBeDefined();
    expect(CONTENT.resources.ironbark_tree).toBeDefined();
    expect(CONTENT.enemies.grove_wolf).toBeDefined();
  });

  it("has the Ironbark resource yield the log_ironbark item", () => {
    const resource = CONTENT.resources.ironbark_tree!;
    expect(resource.yield.itemId).toBe("log_ironbark");
    expect(CONTENT.items[resource.yield.itemId]).toBeDefined();
  });

  it("has the Grove Wolf reference only valid item IDs in its loot table", () => {
    const wolf = CONTENT.enemies.grove_wolf!;
    for (const drop of wolf.loot) {
      expect(CONTENT.items[drop.itemId]).toBeDefined();
    }
  });

  it("has the Meadowrest verdant_ironbark interactable reference the valid resource and a registered runtime asset", () => {
    const interactable = CONTENT.zones.meadowrest?.interactables.find((entry) => entry.id === "verdant_ironbark");
    expect(interactable).toBeDefined();
    expect(interactable?.resourceId).toBe("ironbark_tree");
    expect(CONTENT.resources[interactable!.resourceId!]).toBeDefined();
    expect(ASSET_REGISTRY[interactable!.assetId]).toBeDefined();
  });
});

describe("combat progression content", () => {
  it("gives every weapon and body item explicit derived-stat bonuses", () => {
    const combatEquipment = Object.values(CONTENT.items)
      .filter((item) => item.equipmentSlot === "weapon" || item.equipmentSlot === "body");
    expect(combatEquipment.length).toBeGreaterThanOrEqual(2);
    for (const item of combatEquipment) expect(item.combatBonuses).not.toBeNull();
  });

  it("defines enemies using their own level, accuracy, evasion and armor", () => {
    const skeleton = CONTENT.enemies.restless_skeleton;
    expect(skeleton).toMatchObject({ combatLevel: 4, accuracy: 18, evasion: 12, armor: 1 });
    expect(skeleton).not.toHaveProperty("minPlayerDamage");
  });

  it("equipping the real Copper Battleaxe raises derived accuracy and max hit over the real Militia Sword", () => {
    const base = { ...createNewSave(0, "battleaxe-stat-seed", { x: 5, z: 5 }), quests: {} };
    const withSword = addItem(base.inventory, base.inventorySlots, "meadowrest_sword", 1, CONTENT);
    if (!withSword) throw new Error("fixture inventory failed");
    const swordEquipped = equipItem({ ...base, inventory: withSword }, "meadowrest_sword", CONTENT).state;
    const swordStats = playerCombatStats(swordEquipped, CONTENT);
    expect(swordEquipped.equipment.weapon).toBe("meadowrest_sword");

    const withAxe = addItem(swordEquipped.inventory, swordEquipped.inventorySlots, "copper_battleaxe", 1, CONTENT);
    if (!withAxe) throw new Error("fixture inventory failed");
    const axeEquipped = equipItem({ ...swordEquipped, inventory: withAxe }, "copper_battleaxe", CONTENT).state;
    const axeStats = playerCombatStats(axeEquipped, CONTENT);

    expect(axeEquipped.equipment.weapon).toBe("copper_battleaxe");
    // Swapping the sword back into the pack, not discarding it, proves this is
    // a real optional choice rather than a forced one-way upgrade.
    expect(axeEquipped.inventory.some((stack) => stack.itemId === "meadowrest_sword")).toBe(true);
    expect(axeStats.accuracy).toBeGreaterThan(swordStats.accuracy);
    expect(axeStats.maxHit).toBeGreaterThan(swordStats.maxHit);
  });

  it("makes the first enemy award a persistent defensive equipment upgrade", () => {
    const vest = CONTENT.items.boneguard_vest;
    expect(vest).toMatchObject({ equipmentSlot: "body", collection: true });
    expect(vest?.combatBonuses?.defence).toBeGreaterThan(0);
    expect(CONTENT.enemies.restless_skeleton?.loot).toContainEqual(
      expect.objectContaining({ itemId: "boneguard_vest", chancePpm: 1_000_000 }),
    );
  });
});
