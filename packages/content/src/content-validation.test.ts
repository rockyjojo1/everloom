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
