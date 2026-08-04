import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getProductionRoomLayout, getProfileSettings, ROOM_DIMENSIONS } from "./productionRoomLayout";

describe("productionRoomLayout", () => {
  it("balanced profile generates expected placement count", () => {
    const layout = getProductionRoomLayout("balanced");
    // 41 core + 6 additional trees + 10 additional rocks + 2 unaccounted = 59
    expect(layout.placements.length).toBe(59);
  });

  it("quality profile generates expected placement count", () => {
    const layout = getProductionRoomLayout("quality");
    // 41 core + 12 additional trees + 20 additional rocks + 2 unaccounted = 75
    expect(layout.placements.length).toBe(75);
  });

  it("balanced and quality generate the same core layout structure", () => {
    const balanced = getProductionRoomLayout("balanced");
    const quality = getProductionRoomLayout("quality");

    const balancedCore = balanced.placements.filter((p) => !p.role.startsWith("additional"));
    const qualityCore = quality.placements.filter((p) => !p.role.startsWith("additional"));

    expect(balancedCore.length).toBe(qualityCore.length);
    balancedCore.forEach((p, i) => {
      const qp = qualityCore[i];
      expect(qp).toBeDefined();
      expect(p.instance).toBe(qp!.instance);
      expect(p.runtimeAssetId).toBe(qp!.runtimeAssetId);
    });
  });

  it("contains every required fixed core placement from the room contract", () => {
    const layout = getProductionRoomLayout("balanced");
    const byInstance = new Map(layout.placements.map((p) => [p.instance, p]));

    expect(byInstance.get("cottage-main")?.runtimeAssetId).toBe("town.cottage");
    expect(byInstance.get("bridge-main")?.runtimeAssetId).toBe("nature.bridge");
    expect(byInstance.get("campfire-main")?.runtimeAssetId).toBe("nature.campfire");

    for (const id of ["oak-a", "oak-b", "oak-c"]) {
      expect(byInstance.get(id)?.runtimeAssetId).toBe("nature.oak");
    }
    for (const id of ["canopy-northwest", "canopy-west", "canopy-northeast", "canopy-east"]) {
      expect(byInstance.get(id)?.runtimeAssetId).toBe("nature.tree-detailed");
    }
  });

  it("all placements stay within room bounds", () => {
    const layout = getProductionRoomLayout("balanced");
    layout.placements.forEach((p) => {
      const [x, , z] = p.position;
      expect(x).toBeGreaterThanOrEqual(-22);
      expect(x).toBeLessThanOrEqual(22);
      expect(z).toBeGreaterThanOrEqual(-14);
      expect(z).toBeLessThanOrEqual(14);
    });
  });

  it("additional details avoid the water rectangle", () => {
    const layout = getProductionRoomLayout("balanced");
    const additionalPlacements = layout.placements.filter((p) => p.role.startsWith("additional"));

    additionalPlacements.forEach((p) => {
      const [, , z] = p.position;
      const distToRiver = Math.abs(z - ROOM_DIMENSIONS.riverCentreZ);
      expect(distToRiver).toBeGreaterThan(4);
    });
  });

  it("additional details maintain at least 1.5 units of clearance from every core placement", () => {
    const layout = getProductionRoomLayout("quality");
    const core = layout.placements.filter((p) => !p.role.startsWith("additional"));
    const additional = layout.placements.filter((p) => p.role.startsWith("additional"));

    additional.forEach((a) => {
      core.forEach((c) => {
        const dx = a.position[0] - c.position[0];
        const dz = a.position[2] - c.position[2];
        const distance = Math.sqrt(dx * dx + dz * dz);
        expect(distance).toBeGreaterThanOrEqual(1.5);
      });
    });
  });

  it("core placements have consistent role labels", () => {
    const layout = getProductionRoomLayout("balanced");
    const roles = new Set(layout.placements.map((p) => p.role));

    const expectedRoles = [
      "shelter",
      "crossing",
      "light-source",
      "woodcutting-tree",
      "boundary-canopy",
      "cliff",
      "edge-rock",
      "path",
      "water-detail",
      "shore-rock",
      "prop",
      "additional-tree",
      "additional-rock",
    ];

    expectedRoles.forEach((role) => {
      expect(roles.has(role)).toBe(true);
    });
  });

  it("profile settings apply correct pixel ratio caps", () => {
    expect(getProfileSettings("balanced").pixelRatioCap).toBe(1.5);
    expect(getProfileSettings("quality").pixelRatioCap).toBe(2);
  });

  it("profile settings apply correct shadow map sizes", () => {
    expect(getProfileSettings("balanced").shadowMapSize).toBe(1024);
    expect(getProfileSettings("quality").shadowMapSize).toBe(1536);
  });

  it("profile settings specify correct grass counts", () => {
    expect(getProfileSettings("balanced").grassTuftCount).toBe(100);
    expect(getProfileSettings("quality").grassTuftCount).toBe(220);
  });

  it("profile settings specify correct additional tree/rock counts", () => {
    expect(getProfileSettings("balanced").additionalTreeCount).toBe(6);
    expect(getProfileSettings("balanced").additionalRockCount).toBe(10);
    expect(getProfileSettings("quality").additionalTreeCount).toBe(12);
    expect(getProfileSettings("quality").additionalRockCount).toBe(20);
  });

  it("deterministic generation is stable across repeated calls", () => {
    const layout1 = getProductionRoomLayout("balanced");
    const layout2 = getProductionRoomLayout("balanced");

    expect(layout1.placements.length).toBe(layout2.placements.length);

    layout1.placements.forEach((p1, i) => {
      const p2 = layout2.placements[i];
      expect(p2).toBeDefined();
      expect(p1.instance).toBe(p2!.instance);
      expect(p1.position).toEqual(p2!.position);
      expect(p1.rotationY).toBe(p2!.rotationY);
      expect(p1.scale).toBe(p2!.scale);
    });
  });

  it("core placements all have required runtime asset IDs", () => {
    const layout = getProductionRoomLayout("balanced");
    const corePlacements = layout.placements.filter((p) => !p.role.startsWith("additional"));

    corePlacements.forEach((p) => {
      expect(p.runtimeAssetId).toBeTruthy();
      expect(p.runtimeAssetId).toContain(".");
    });
  });

  it("does not use Math.random anywhere -- generation must be seeded/deterministic", () => {
    const sourcePath = fileURLToPath(new URL("./productionRoomLayout.ts", import.meta.url));
    const source = readFileSync(sourcePath, "utf8");
    expect(source).not.toContain("Math.random");
  });

  it("every referenced runtimeAssetId exists in the canonical asset registry", () => {
    const registryPath = fileURLToPath(
      new URL("../../../../packages/assets/src/registry.json", import.meta.url)
    );
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as Array<{ id: string }>;
    const knownIds = new Set(registry.map((r) => r.id));

    const layout = getProductionRoomLayout("quality");
    const usedIds = new Set(layout.placements.map((p) => p.runtimeAssetId));

    usedIds.forEach((id) => {
      expect(knownIds.has(id), `runtimeAssetId "${id}" is not in packages/assets/src/registry.json`).toBe(true);
    });
  });
});
