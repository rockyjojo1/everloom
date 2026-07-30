import { describe, expect, it } from "vitest";
import { PROBABILITY_SCALE } from "@everloom/core";
import { CONTENT, buildValidatedContent, resourceSchema } from "./index";

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
});

describe("The Verdant Loomstone chapter", () => {
  it("chains naturally from The First Thread and awakens on completion", () => {
    const first = CONTENT.quests.first_thread;
    const verdant = CONTENT.quests.verdant_loomstone;
    expect(first?.nextQuestId).toBe("verdant_loomstone");
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
