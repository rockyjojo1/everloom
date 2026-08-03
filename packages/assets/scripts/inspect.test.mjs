import { test } from "node:test";
import { strict as assert } from "node:assert";
import { findAssets, inspectAsset, loadData } from "./inspect.mjs";

test("exact lookup returns a single match by exact runtime asset ID", async () => {
  const { registry, manifest } = await loadData();
  const { matches, exact } = findAssets(registry, "player.adventurer", { manifest });
  assert.equal(matches.length, 1);
  assert.equal(exact.id, "player.adventurer");
});

test("ambiguous search returns multiple substring matches, none exact", async () => {
  const { registry, manifest } = await loadData();
  const { matches, exact } = findAssets(registry, "nature", { manifest });
  assert.ok(matches.length > 1);
  assert.equal(exact, null);
});

test("no results for a query that matches nothing", async () => {
  const { registry, manifest } = await loadData();
  const { matches } = findAssets(registry, "zzz-definitely-not-a-real-asset", { manifest });
  assert.equal(matches.length, 0);
});

test("pack filter narrows results to that pack only", async () => {
  const { registry, manifest } = await loadData();
  const { matches } = findAssets(registry, null, { pack: "kaykit-dungeon", manifest });
  assert.ok(matches.length > 0);
  assert.ok(matches.every((m) => m.pack === "kaykit-dungeon"));
});

test("category filter narrows results to that category only", async () => {
  const { registry, manifest } = await loadData();
  const { matches } = findAssets(registry, null, { category: "tree", manifest });
  assert.ok(matches.length > 0);
  assert.ok(matches.every((m) => m.category === "tree"));
});

test("placeholder filter returns only assets referenced by a placeholder manifest entry", async () => {
  const { registry, manifest } = await loadData();
  const { matches } = findAssets(registry, null, { placeholderOnly: true, manifest });
  assert.ok(matches.length > 0);
  assert.ok(matches.some((m) => m.id === "enemy.skeleton-warrior"));
});

test("inspectAsset on a file-backed asset returns GLB metadata, hash, and required-clip status", async () => {
  const { registry, sources, requirements, manifest } = await loadData();
  const asset = registry.find((a) => a.id === "player.adventurer");
  const info = await inspectAsset(asset, { registry, sources, requirements, manifest });
  assert.equal(info.runtimeAssetId, "player.adventurer");
  assert.ok(info.byteSize > 0);
  assert.ok(info.sha256);
  assert.equal(info.glb.skinCount, 1);
  assert.equal(info.glb.animationCount, 76);
  assert.deepEqual(info.requiredClipsMissing, []);
  assert.equal(info.warnings.length, 0);
});

test("inspectAsset on a procedural asset returns a scheme, no file metadata", async () => {
  const { registry, sources, requirements, manifest } = await loadData();
  const asset = registry.find((a) => a.id === "custom.tool-hatchet");
  const info = await inspectAsset(asset, { registry, sources, requirements, manifest });
  assert.equal(info.scheme, "procedural");
  assert.equal(info.canonicalPath, null);
  assert.equal(info.byteSize, undefined);
});

test("inspectAsset flags repository_claim_only evidence as a warning", async () => {
  const { registry, sources, requirements, manifest } = await loadData();
  // No registry asset actually uses lpc-legacy-sprites, so construct a
  // synthetic one against that real source record to exercise the warning path.
  const asset = { id: "test.synthetic", category: "test", sourceFile: "procedural://test", pack: "lpc-legacy-sprites", licence: "mixed" };
  const info = await inspectAsset(asset, { registry, sources, requirements, manifest });
  assert.ok(info.warnings.some((w) => /repository_claim_only/.test(w)));
});

test("inspectAsset reports manifest statuses for an asset with multiple manifest entries", async () => {
  const { registry, sources, requirements, manifest } = await loadData();
  const asset = registry.find((a) => a.id === "enemy.skeleton-warrior");
  const info = await inspectAsset(asset, { registry, sources, requirements, manifest });
  assert.ok(info.manifestStatuses.length >= 2);
  assert.ok(info.manifestStatuses.some((m) => m.currentStatus === "licensed-placeholder"));
});

test("inspectAsset detects semantic reuse between two runtime IDs sharing one file", async () => {
  const { registry, sources, requirements, manifest } = await loadData();
  const asset = registry.find((a) => a.id === "nature.stone-tall");
  const info = await inspectAsset(asset, { registry, sources, requirements, manifest });
  assert.deepEqual(info.semanticReuseWith, ["landmark.verdant-loomstone"]);
});
