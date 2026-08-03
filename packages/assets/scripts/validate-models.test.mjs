import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validateModels } from "./validate-models.mjs";
import { buildGlb, minimalValidGltfJson, tinyPng } from "./test-helpers/build-glb.mjs";

async function makeFixtureRoot() {
  const dir = await mkdtemp(join(tmpdir(), "everloom-model-validate-"));
  return dir;
}

async function withFixtureRoot(fn) {
  const dir = await makeFixtureRoot();
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const NO_REQUIREMENTS = { requirements: [] };

test("errors when the canonical model root does not exist", async () => {
  const result = await validateModels({
    modelRoot: resolve(tmpdir(), "everloom-does-not-exist-" + Date.now()),
    registry: [],
    requirements: NO_REQUIREMENTS,
  });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /does not exist/);
});

test("errors when a registered source file is missing from the root", () => withFixtureRoot(async (root) => {
  const registry = [{ id: "test.missing", sourceFile: "nope.glb", pack: "test" }];
  const result = await validateModels({ modelRoot: root, registry, requirements: NO_REQUIREMENTS });
  assert.ok(result.errors.some((e) => /not found under canonical model root/.test(e)));
}));

test("errors on path traversal in a registry sourceFile", () => withFixtureRoot(async (root) => {
  const registry = [{ id: "test.escape", sourceFile: "../../../etc/passwd", pack: "test" }];
  const result = await validateModels({ modelRoot: root, registry, requirements: NO_REQUIREMENTS });
  assert.ok(result.errors.some((e) => /escapes the canonical model root/.test(e)));
}));

test("errors on a malformed GLB file", () => withFixtureRoot(async (root) => {
  await writeFile(join(root, "broken.glb"), Buffer.from("not a glb"));
  const registry = [{ id: "test.broken", sourceFile: "broken.glb", pack: "test" }];
  const result = await validateModels({ modelRoot: root, registry, requirements: NO_REQUIREMENTS });
  assert.ok(result.errors.some((e) => /GLB parse failed/.test(e)));
}));

test("errors on a zero-byte source file", () => withFixtureRoot(async (root) => {
  await writeFile(join(root, "empty.glb"), Buffer.alloc(0));
  const registry = [{ id: "test.empty", sourceFile: "empty.glb", pack: "test" }];
  const result = await validateModels({ modelRoot: root, registry, requirements: NO_REQUIREMENTS });
  assert.ok(result.errors.some((e) => /zero bytes/.test(e)));
}));

test("validates a valid minimal GLB with no errors", () => withFixtureRoot(async (root) => {
  const glb = buildGlb(minimalValidGltfJson(), Buffer.alloc(42));
  await writeFile(join(root, "ok.glb"), glb);
  const registry = [{ id: "test.ok", sourceFile: "ok.glb", pack: "test" }];
  const result = await validateModels({ modelRoot: root, registry, requirements: NO_REQUIREMENTS });
  assert.deepEqual(result.errors, []);
  assert.equal(result.modelResults[0].glb.meshCount, 1);
}));

test("errors when an external buffer companion is missing", () => withFixtureRoot(async (root) => {
  const json = minimalValidGltfJson();
  json.buffers = [{ uri: "missing.bin", byteLength: 42 }];
  const glb = buildGlb(json); // no BIN chunk, references external .bin that we do not create
  await writeFile(join(root, "extbuf.glb"), glb);
  const registry = [{ id: "test.extbuf", sourceFile: "extbuf.glb", pack: "test" }];
  const result = await validateModels({ modelRoot: root, registry, requirements: NO_REQUIREMENTS });
  assert.ok(result.errors.some((e) => /missing external buffer companion/.test(e)));
}));

test("errors when an external texture companion is missing", () => withFixtureRoot(async (root) => {
  const json = minimalValidGltfJson();
  json.images = [{ uri: "missing-texture.png" }];
  const glb = buildGlb(json, Buffer.alloc(42));
  await writeFile(join(root, "exttex.glb"), glb);
  const registry = [{ id: "test.exttex", sourceFile: "exttex.glb", pack: "test" }];
  const result = await validateModels({ modelRoot: root, registry, requirements: NO_REQUIREMENTS });
  assert.ok(result.errors.some((e) => /missing external image companion/.test(e)));
}));

test("succeeds when an external texture companion is present", () => withFixtureRoot(async (root) => {
  const json = minimalValidGltfJson();
  json.images = [{ uri: "present-texture.png" }];
  const glb = buildGlb(json, Buffer.alloc(42));
  await writeFile(join(root, "exttex2.glb"), glb);
  await writeFile(join(root, "present-texture.png"), tinyPng(2, 2));
  const registry = [{ id: "test.exttex2", sourceFile: "exttex2.glb", pack: "test" }];
  const result = await validateModels({ modelRoot: root, registry, requirements: NO_REQUIREMENTS });
  assert.deepEqual(result.errors, []);
}));

test("detects duplicate binary files across distinct registered paths", () => withFixtureRoot(async (root) => {
  const glb = buildGlb(minimalValidGltfJson(), Buffer.alloc(42));
  await mkdir(join(root, "packA"), { recursive: true });
  await mkdir(join(root, "packB"), { recursive: true });
  await writeFile(join(root, "packA/one.glb"), glb);
  await writeFile(join(root, "packB/two.glb"), glb); // identical bytes, different path
  const registry = [
    { id: "test.one", sourceFile: "packA/one.glb", pack: "packA" },
    { id: "test.two", sourceFile: "packB/two.glb", pack: "packB" },
  ];
  const result = await validateModels({ modelRoot: root, registry, requirements: NO_REQUIREMENTS });
  assert.equal(result.duplicateGroups.length, 1);
  assert.equal(result.duplicateGroups[0].paths.length, 2);
  assert.ok(result.warnings.some((w) => /Duplicate binary content/.test(w)));
}));

test("distinguishes intentional semantic reuse (one path, two IDs) from duplicate files", () => withFixtureRoot(async (root) => {
  const glb = buildGlb(minimalValidGltfJson(), Buffer.alloc(42));
  await writeFile(join(root, "shared.glb"), glb);
  const registry = [
    { id: "test.shared-a", sourceFile: "shared.glb", pack: "test" },
    { id: "test.shared-b", sourceFile: "shared.glb", pack: "test" },
  ];
  const result = await validateModels({ modelRoot: root, registry, requirements: NO_REQUIREMENTS });
  assert.equal(result.duplicateGroups.length, 0, "one physical file referenced twice is not a duplicate-binary finding");
  assert.equal(result.semanticReuseGroups.length, 1);
  assert.deepEqual(result.semanticReuseGroups[0].runtimeAssetIds, ["test.shared-a", "test.shared-b"]);
}));

test("fails when a required animation clip is absent from a skinned asset", () => withFixtureRoot(async (root) => {
  const json = minimalValidGltfJson();
  json.skins = [{ joints: [0] }];
  json.animations = [{ name: "SomeOtherClip", channels: [], samplers: [] }];
  const glb = buildGlb(json, Buffer.alloc(42));
  await writeFile(join(root, "rig.glb"), glb);
  const registry = [{ id: "test.rig", sourceFile: "rig.glb", pack: "test" }];
  const requirements = { requirements: [{ runtimeAssetId: "test.rig", requiredClips: ["Idle", "Walking_A"] }] };
  const result = await validateModels({ modelRoot: root, registry, requirements });
  assert.ok(result.errors.some((e) => /missing required animation clip.*Idle.*Walking_A/.test(e)));
}));

test("passes when all required animation clips are present", () => withFixtureRoot(async (root) => {
  const json = minimalValidGltfJson();
  json.skins = [{ joints: [0] }];
  json.animations = [
    { name: "Idle", channels: [], samplers: [] },
    { name: "Walking_A", channels: [], samplers: [] },
  ];
  const glb = buildGlb(json, Buffer.alloc(42));
  await writeFile(join(root, "rig2.glb"), glb);
  const registry = [{ id: "test.rig2", sourceFile: "rig2.glb", pack: "test" }];
  const requirements = { requirements: [{ runtimeAssetId: "test.rig2", requiredClips: ["Idle", "Walking_A"] }] };
  const result = await validateModels({ modelRoot: root, registry, requirements });
  assert.deepEqual(result.errors, []);
}));

test("warns (does not error) when animation-requirements.json references an unknown asset ID", () => withFixtureRoot(async (root) => {
  const registry = [];
  const requirements = { requirements: [{ runtimeAssetId: "no.such.asset", requiredClips: ["Idle"] }] };
  const result = await validateModels({ modelRoot: root, registry, requirements });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((w) => /references unknown runtime asset ID/.test(w)));
}));

test("validates the real player.adventurer and enemy.skeleton-warrior against the actual canonical library", async () => {
  const { MODEL_ROOT } = await import("../paths.mjs");
  const { readFile } = await import("node:fs/promises");
  const registry = JSON.parse(await readFile(resolve(MODEL_ROOT, "../src/registry.json"), "utf8"));
  const requirements = JSON.parse(await readFile(resolve(MODEL_ROOT, "../animation-requirements.json"), "utf8"));
  const filtered = registry.filter((a) => a.id === "player.adventurer" || a.id === "enemy.skeleton-warrior");
  const result = await validateModels({ modelRoot: MODEL_ROOT, registry: filtered, requirements });
  assert.deepEqual(result.errors, []);
  const player = result.modelResults.find((r) => r.runtimeAssetId === "player.adventurer");
  assert.equal(player.requiredClipsMissing.length, 0);
});
