import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generateGrassLayout } from "./grassLayout";
import { getProductionRoomLayout, getCharacterPlacements, ROOM_DIMENSIONS } from "./productionRoomLayout";

const MIN_MUTUAL_SPACING = 0.35;

function buildInput(count: number, profile: "balanced" | "quality") {
  return {
    count,
    roomDimensions: ROOM_DIMENSIONS,
    placements: getProductionRoomLayout(profile).placements,
    characters: getCharacterPlacements(profile),
  };
}

describe("generateGrassLayout", () => {
  it("returns exactly 100 transforms for Balanced", () => {
    const result = generateGrassLayout(buildInput(100, "balanced"));
    expect(result.length).toBe(100);
  });

  it("returns exactly 220 transforms for Quality", () => {
    const result = generateGrassLayout(buildInput(220, "quality"));
    expect(result.length).toBe(220);
  });

  it("repeated calls with identical input are deeply equal (deterministic)", () => {
    const input = buildInput(100, "balanced");
    const first = generateGrassLayout(input);
    const second = generateGrassLayout(input);
    expect(second).toEqual(first);
  });

  it("all points remain within room bounds", () => {
    const input = buildInput(220, "quality");
    const result = generateGrassLayout(input);
    const halfWidth = input.roomDimensions.groundWidth / 2 - 1;
    const halfDepth = input.roomDimensions.groundDepth / 2 - 1;

    result.forEach((t) => {
      expect(t.x).toBeGreaterThanOrEqual(-halfWidth);
      expect(t.x).toBeLessThanOrEqual(halfWidth);
      expect(t.z).toBeGreaterThanOrEqual(-halfDepth);
      expect(t.z).toBeLessThanOrEqual(halfDepth);
    });
  });

  it("all points avoid the river (4-unit clearance from riverCentreZ)", () => {
    const input = buildInput(220, "quality");
    const result = generateGrassLayout(input);

    result.forEach((t) => {
      const distToRiver = Math.abs(t.z - input.roomDimensions.riverCentreZ);
      expect(distToRiver).toBeGreaterThanOrEqual(4);
    });
  });

  it("all points avoid the central path (|x| > 2)", () => {
    const input = buildInput(220, "quality");
    const result = generateGrassLayout(input);

    result.forEach((t) => {
      expect(Math.abs(t.x)).toBeGreaterThan(2);
    });
  });

  it("all points clear every actual fixed (non-additional) layout placement by at least 1.5 units", () => {
    const input = buildInput(220, "quality");
    const result = generateGrassLayout(input);
    const fixedPlacements = input.placements.filter((p) => !p.instance.startsWith("additional-"));

    result.forEach((t) => {
      fixedPlacements.forEach((p) => {
        const dx = t.x - p.position[0];
        const dz = t.z - p.position[2];
        const distance = Math.sqrt(dx * dx + dz * dz);
        expect(distance).toBeGreaterThanOrEqual(1.5);
      });
    });
  });

  it("all points clear all three characters by at least 1.5 units", () => {
    const input = buildInput(220, "quality");
    const result = generateGrassLayout(input);

    result.forEach((t) => {
      input.characters.forEach((c) => {
        const dx = t.x - c.position[0];
        const dz = t.z - c.position[2];
        const distance = Math.sqrt(dx * dx + dz * dz);
        expect(distance).toBeGreaterThanOrEqual(1.5);
      });
    });
  });

  it("grass points meet the chosen minimum mutual spacing", () => {
    const input = buildInput(220, "quality");
    const result = generateGrassLayout(input);

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const dx = result[i]!.x - result[j]!.x;
        const dz = result[i]!.z - result[j]!.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        expect(distance).toBeGreaterThanOrEqual(MIN_MUTUAL_SPACING);
      }
    }
  });

  it("throws a stable error when the exact count cannot be generated", () => {
    // A deliberately tiny room with no clear space cannot hold any grass at
    // all: bounds shrink to a sliver once the river/path/margin carve it up.
    // Keeps maxAttempts (count * 200) small so the failure surfaces fast
    // instead of exhausting a huge attempt budget synchronously.
    const impossibleInput = {
      count: 50,
      roomDimensions: {
        groundWidth: 4,
        groundDepth: 4,
        playerStartX: 0,
        playerStartY: 0,
        playerStartZ: 0,
        riverCentreZ: 0,
        riverWidth: 4,
        riverDepth: 4,
        cameraFollowOffset: [0, 0, 0] as [number, number, number],
        playerMovementSpeed: 0,
      },
      placements: [],
      characters: [],
    };

    expect(() => generateGrassLayout(impossibleInput)).toThrow(
      /failed to generate 50 valid grass transforms/
    );
  });

  it("source does not use Math.random", () => {
    const sourcePath = fileURLToPath(new URL("./grassLayout.ts", import.meta.url));
    const source = readFileSync(sourcePath, "utf8");
    expect(source).not.toContain("Math.random");
  });
});
