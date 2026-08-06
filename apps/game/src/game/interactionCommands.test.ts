import { describe, expect, it } from "vitest";
import { CONTENT } from "@everloom/content";
import { defaultVerbFor } from "./interactionCommands";

const zone = CONTENT.zones.meadowrest!;
const find = (id: string) => zone.interactables.find((entry) => entry.id === id)!;

describe("defaultVerbFor", () => {
  it("uses Take for ground items", () => {
    expect(defaultVerbFor(find("ground_worn_hatchet"))).toBe("Take Worn Hatchet");
  });

  it("uses Talk-to for NPCs", () => {
    expect(defaultVerbFor(find("npc_mara"))).toBe("Talk-to Mara Threadkeeper");
  });

  it("uses Chop down for a woodcutting resource", () => {
    const target = find("oak_west_1");
    expect(defaultVerbFor(target)).toMatch(/^Chop down /);
  });

  it("uses Mine for a mining resource", () => {
    const target = find("copper_north_1");
    expect(defaultVerbFor(target)).toMatch(/^Mine /);
  });

  it("uses Fish for a fishing spot", () => {
    const fishingSpot = zone.interactables.find((entry) => entry.kind === "resource" && entry.resourceId && CONTENT.resources[entry.resourceId]?.skill === "fishing");
    expect(fishingSpot, "expected a fishing spot in Meadowrest").toBeDefined();
    expect(defaultVerbFor(fishingSpot!)).toMatch(/^Fish /);
  });

  it("uses Use for a facility", () => {
    const target = find("meadowrest_smelter");
    expect(defaultVerbFor(target)).toMatch(/^Use /);
  });
});
