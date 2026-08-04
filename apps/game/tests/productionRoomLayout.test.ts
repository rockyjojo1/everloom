import { test } from "node:test";
import { strict as assert } from "node:assert";
import { getProductionRoomLayout, getProfileSettings, ROOM_DIMENSIONS } from "../src/bakeoff/productionRoomLayout";

test("balanced profile generates expected placement count", () => {
  const layout = getProductionRoomLayout("balanced");
  const corePlacements = 41; // Core fixed placements
  const additionalTrees = 6;
  const additionalRocks = 10;
  const expected = corePlacements + additionalTrees + additionalRocks;
  assert.equal(layout.placements.length, expected);
});

test("quality profile generates expected placement count", () => {
  const layout = getProductionRoomLayout("quality");
  const corePlacements = 41; // Core fixed placements
  const additionalTrees = 12;
  const additionalRocks = 20;
  const expected = corePlacements + additionalTrees + additionalRocks;
  assert.equal(layout.placements.length, expected);
});

test("balanced and quality generate same layout structure", () => {
  const balanced = getProductionRoomLayout("balanced");
  const quality = getProductionRoomLayout("quality");

  // Core placements should be identical
  const balancedCore = balanced.placements.filter((p: any) => !p.role.startsWith("additional"));
  const qualityCore = quality.placements.filter((p: any) => !p.role.startsWith("additional"));

  assert.equal(balancedCore.length, qualityCore.length);
  balancedCore.forEach((p: any, i: number) => {
    const qp = qualityCore[i];
    assert.ok(qp, `qualityCore[${i}] is undefined`);
    assert.equal(p.instance, qp.instance);
    assert.equal(p.runtimeAssetId, qp.runtimeAssetId);
  });
});

test("all placements stay within room bounds", () => {
  const layout = getProductionRoomLayout("balanced");
  layout.placements.forEach((p: any) => {
    const [x, _, z] = p.position;
    assert.ok(x >= -22 && x <= 22, `X ${x} out of bounds`);
    assert.ok(z >= -14 && z <= 14, `Z ${z} out of bounds`);
  });
});

test("additional details avoid water rectangle", () => {
  const layout = getProductionRoomLayout("balanced");
  const additionalPlacements = layout.placements.filter((p) => p.role.startsWith("additional"));

  additionalPlacements.forEach((p) => {
    const [x, _, z] = p.position;
    const distToRiver = Math.abs(z - ROOM_DIMENSIONS.riverCentreZ);
    assert.ok(distToRiver > 4, `Placement too close to river at Z ${z}`);
  });
});

test("core placements have consistent role labels", () => {
  const layout = getProductionRoomLayout("balanced");
  const roles = new Set<string>();

  layout.placements.forEach((p) => {
    roles.add(p.role);
  });

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
    assert.ok(roles.has(role), `Missing role: ${role}`);
  });
});

test("profile settings apply correct pixel ratio caps", () => {
  const balanced = getProfileSettings("balanced");
  const quality = getProfileSettings("quality");

  assert.equal(balanced.pixelRatioCap, 1.5);
  assert.equal(quality.pixelRatioCap, 2);
});

test("profile settings apply correct shadow map sizes", () => {
  const balanced = getProfileSettings("balanced");
  const quality = getProfileSettings("quality");

  assert.equal(balanced.shadowMapSize, 1024);
  assert.equal(quality.shadowMapSize, 1536);
});

test("profile settings specify correct grass counts", () => {
  const balanced = getProfileSettings("balanced");
  const quality = getProfileSettings("quality");

  assert.equal(balanced.grassTuftCount, 100);
  assert.equal(quality.grassTuftCount, 220);
});

test("deterministic generation is stable across calls", () => {
  const layout1 = getProductionRoomLayout("balanced");
  const layout2 = getProductionRoomLayout("balanced");

  assert.equal(layout1.placements.length, layout2.placements.length);

  layout1.placements.forEach((p1, i) => {
    const p2 = layout2.placements[i];
    assert.ok(p2, `placements[${i}] is undefined in layout2`);
    assert.equal(p1.instance, p2.instance);
    assert.deepEqual(p1.position, p2.position);
    assert.equal(p1.rotationY, p2.rotationY);
    assert.equal(p1.scale, p2.scale);
  });
});

test("core placements all have required runtime asset IDs", () => {
  const layout = getProductionRoomLayout("balanced");
  const corePlacements = layout.placements.filter((p) => !p.role.startsWith("additional"));

  corePlacements.forEach((p) => {
    assert.ok(p.runtimeAssetId, `Missing runtimeAssetId for ${p.instance}`);
    assert.ok(p.runtimeAssetId.includes("."), `Invalid asset ID format: ${p.runtimeAssetId}`);
  });
});
