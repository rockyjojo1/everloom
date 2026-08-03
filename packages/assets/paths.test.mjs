import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { MODEL_ROOT, MODEL_ROOT_RELATIVE, REPOSITORY_ROOT, resolveModelPath } from "./paths.mjs";

test("MODEL_ROOT_RELATIVE is the settled canonical location", () => {
  assert.equal(MODEL_ROOT_RELATIVE, "packages/assets/models");
});

test("MODEL_ROOT is an absolute path ending in the relative root", () => {
  assert.ok(MODEL_ROOT.endsWith("models"));
  assert.ok(resolve(REPOSITORY_ROOT, MODEL_ROOT_RELATIVE) === MODEL_ROOT);
});

test("resolveModelPath resolves a normal sourceFile inside the root", () => {
  const full = resolveModelPath("kenney-nature/tree_oak.glb");
  assert.ok(full.startsWith(MODEL_ROOT));
});

test("resolveModelPath rejects path traversal", () => {
  assert.throws(() => resolveModelPath("../../../etc/passwd"), /escapes the canonical model root/);
});

test("all active consumers resolve to the exact same MODEL_ROOT", async () => {
  // apps/game/vite.config.ts and apps/client3d/vite.config.ts both import
  // MODEL_ROOT directly from this module, so there is nothing separate to
  // reconcile — but assert both files actually import from here, so a
  // future edit that reintroduces a second hardcoded root fails this test.
  const gameConfig = await readFile(resolve(REPOSITORY_ROOT, "apps/game/vite.config.ts"), "utf8");
  const client3dConfig = await readFile(resolve(REPOSITORY_ROOT, "apps/client3d/vite.config.ts"), "utf8");
  assert.match(gameConfig, /from ["']\.\.\/\.\.\/packages\/assets\/paths\.mjs["']/);
  assert.match(client3dConfig, /from ["']\.\.\/\.\.\/packages\/assets\/paths\.mjs["']/);

  const buildCatalog = await readFile(resolve(REPOSITORY_ROOT, "packages/assets/scripts/build-catalog.mjs"), "utf8");
  const validateAssets = await readFile(resolve(REPOSITORY_ROOT, "packages/assets/scripts/validate-assets.mjs"), "utf8");
  assert.match(buildCatalog, /from ["']\.\.\/paths\.mjs["']/);
  assert.match(validateAssets, /from ["']\.\.\/paths\.mjs["']/);
});

test("MODEL_ROOT exists and is populated in this checkout", async () => {
  const { stat, readdir } = await import("node:fs/promises");
  const s = await stat(MODEL_ROOT);
  assert.ok(s.isDirectory());
  const entries = await readdir(MODEL_ROOT);
  assert.ok(entries.length > 0);
});
