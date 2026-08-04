import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { MODEL_ROOT, MODEL_ROOT_RELATIVE, REPOSITORY_ROOT, resolveModelPath, resolvePathWithinRoot } from "./paths.mjs";

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
  const { readFile } = await import("node:fs/promises");
  const gameConfig = await readFile(resolve(REPOSITORY_ROOT, "apps/game/vite.config.ts"), "utf8");
  const client3dConfig = await readFile(resolve(REPOSITORY_ROOT, "apps/client3d/vite.config.ts"), "utf8");
  assert.match(gameConfig, /from ["']\.\.\/\.\.\/packages\/assets\/paths\.mjs["']/);
  assert.match(client3dConfig, /from ["']\.\.\/\.\.\/packages\/assets\/paths\.mjs["']/);

  const buildCatalog = await readFile(resolve(REPOSITORY_ROOT, "packages/assets/scripts/build-catalog.mjs"), "utf8");
  const validateAssets = await readFile(resolve(REPOSITORY_ROOT, "packages/assets/scripts/validate-assets.mjs"), "utf8");
  assert.match(buildCatalog, /from ["']\.\.\/paths\.mjs["']/);
  assert.match(validateAssets, /from ["']\.\.\/paths\.mjs["']/);
});

test("neither Vite config reimplements its own startsWith(root) containment check", async () => {
  // The one allowed containment implementation lives in resolvePathWithinRoot
  // (this module). A bare `.startsWith(modelRoot)` in either Vite config is
  // exactly the incomplete sibling-prefix-collision bug this suite guards
  // against — fail loudly if it reappears.
  const { readFile } = await import("node:fs/promises");
  const gameConfig = await readFile(resolve(REPOSITORY_ROOT, "apps/game/vite.config.ts"), "utf8");
  const client3dConfig = await readFile(resolve(REPOSITORY_ROOT, "apps/client3d/vite.config.ts"), "utf8");
  assert.match(gameConfig, /resolvePathWithinRoot/, "apps/game/vite.config.ts must use the shared resolver");
  assert.match(client3dConfig, /resolvePathWithinRoot/, "apps/client3d/vite.config.ts must use the shared resolver");
  assert.doesNotMatch(gameConfig, /\.startsWith\(\s*modelRoot\s*\)/, "apps/game/vite.config.ts must not reimplement containment");
  assert.doesNotMatch(client3dConfig, /\.startsWith\(\s*modelRoot\s*\)/, "apps/client3d/vite.config.ts must not reimplement containment");
});

// --- resolvePathWithinRoot ---

async function withFixtureRootAndSibling(fn) {
  const base = await mkdtemp(join(tmpdir(), "everloom-paths-test-"));
  const root = join(base, "models");
  const sibling = join(base, "models-escape");
  await mkdir(root, { recursive: true });
  await mkdir(sibling, { recursive: true });
  await writeFile(join(sibling, "secret.glb"), "secret");
  try {
    await fn(root, sibling);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

test("resolvePathWithinRoot rejects a real sibling-prefix-collision path (posix separators)", () =>
  withFixtureRootAndSibling((root) => {
    // This is the exact case a naive `resolved.startsWith(root)` check gets
    // wrong: "<base>/models-escape/secret.glb" starts with the string
    // "<base>/models" even though it is a sibling directory, not a
    // descendant. A real sibling file exists on disk here specifically so
    // this test would have defeated the old startsWith(modelRoot) code.
    assert.throws(() => resolvePathWithinRoot(root, "../models-escape/secret.glb"), /escapes the allowed root/);
  }));

test("resolvePathWithinRoot rejects a real sibling-prefix-collision path (windows separators)", () =>
  withFixtureRootAndSibling((root) => {
    assert.throws(() => resolvePathWithinRoot(root, "..\\models-escape\\secret.glb"), /escapes the allowed root/);
  }));

test("resolvePathWithinRoot rejects multi-level traversal", () => {
  assert.throws(() => resolvePathWithinRoot(MODEL_ROOT, "../../../../etc/passwd"), /escapes the allowed root/);
});

test("resolvePathWithinRoot rejects an absolute POSIX path", () => {
  assert.throws(() => resolvePathWithinRoot(MODEL_ROOT, "/etc/passwd"), /must be relative/);
});

test("resolvePathWithinRoot rejects an absolute Windows path (backslash)", () => {
  assert.throws(() => resolvePathWithinRoot(MODEL_ROOT, "C:\\Windows\\system32"), /must be relative/);
});

test("resolvePathWithinRoot rejects an absolute Windows path (forward slash)", () => {
  assert.throws(() => resolvePathWithinRoot(MODEL_ROOT, "C:/Windows/system32"), /must be relative/);
});

test("resolvePathWithinRoot rejects a drive-relative Windows path", () => {
  assert.throws(() => resolvePathWithinRoot(MODEL_ROOT, "C:foo.glb"), /must be relative/);
});

test("resolvePathWithinRoot rejects a rooted-but-driveless Windows path", () => {
  assert.throws(() => resolvePathWithinRoot(MODEL_ROOT, "\\Windows\\system32"), /must be relative/);
});

test("resolvePathWithinRoot rejects a NUL-containing path", () => {
  assert.throws(() => resolvePathWithinRoot(MODEL_ROOT, "foo\0bar.glb"), /NUL byte/);
});

test("resolvePathWithinRoot accepts a normal nested path", () => {
  const full = resolvePathWithinRoot(MODEL_ROOT, "kenney-nature/tree_oak.glb");
  assert.ok(full.startsWith(MODEL_ROOT));
});

test("resolvePathWithinRoot accepts the root itself when allowRoot is true (default)", () => {
  const full = resolvePathWithinRoot(MODEL_ROOT, ".");
  assert.equal(full, resolve(MODEL_ROOT));
});

test("resolvePathWithinRoot rejects the root itself when allowRoot is false", () => {
  assert.throws(() => resolvePathWithinRoot(MODEL_ROOT, ".", { allowRoot: false }), /not permitted here/);
});

test("resolvePathWithinRoot accepts paths with spaces and Unicode", () => {
  const full = resolvePathWithinRoot(MODEL_ROOT, "valid name with spaces/café.glb");
  assert.ok(full.startsWith(MODEL_ROOT));
});

test("resolvePathWithinRoot rejects mixed-separator traversal that nets outside the root", () => {
  assert.throws(() => resolvePathWithinRoot(MODEL_ROOT, "sub/../../models-escape/secret.glb"), /escapes the allowed root/);
});

test("resolvePathWithinRoot accepts mixed-separator paths that net to a legitimate location", () => {
  const full = resolvePathWithinRoot(MODEL_ROOT, "sub/../file.glb");
  assert.equal(full, resolve(MODEL_ROOT, "file.glb"));
});

test("resolveModelPath delegates to resolvePathWithinRoot with allowRoot: false", () => {
  assert.throws(() => resolveModelPath("."), /escapes the canonical model root/);
});

test("MODEL_ROOT exists and is populated in this checkout", async () => {
  const { stat, readdir } = await import("node:fs/promises");
  const s = await stat(MODEL_ROOT);
  assert.ok(s.isDirectory());
  const entries = await readdir(MODEL_ROOT);
  assert.ok(entries.length > 0);
});
