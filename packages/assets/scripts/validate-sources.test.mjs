import { test } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSources } from "./validate-sources.mjs";

// --- Real-Git fixture helper (Phase 2 requires actually initialising Git,
// not only injecting a fake resolver, for at least the core tracked-vs-
// untracked distinction) ---

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", shell: false });
}

async function withRealGitRepo(fn) {
  const repoRoot = await mkdtemp(join(tmpdir(), "everloom-source-validate-git-"));
  git(repoRoot, ["init", "-q"]);
  git(repoRoot, ["config", "user.email", "test@example.invalid"]);
  git(repoRoot, ["config", "user.name", "Test"]);
  try {
    await fn(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

async function withTempRepoRoot(fn) {
  // Non-Git fixture root, for tests that inject a deterministic resolver
  // instead of exercising real Git commands.
  const dir = await mkdtemp(join(tmpdir(), "everloom-source-validate-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function baseSources(overrides = {}) {
  return {
    evidenceKinds: ["repository_file", "source_code", "git_commit"],
    evidenceStatusValues: ["verified_local_evidence", "verified_embedded_metadata", "repository_claim_only", "missing", "conflicting"],
    sources: [],
    ...overrides,
  };
}

const EMPTY_MANIFEST = { entries: [] };

// --- Phase 2: real Git-tracked path validation ---

test("an existing but untracked manifest currentSource file fails (real Git repo)", () => withRealGitRepo(async (repoRoot) => {
  await mkdir(join(repoRoot, "packages/assets/models/pack"), { recursive: true });
  await writeFile(join(repoRoot, "packages/assets/models/pack/x.glb"), "x");
  // Deliberately NOT `git add`ed: the file exists on disk but is untracked.
  const sources = baseSources();
  const manifest = { entries: [{ id: "m1", currentStatus: "approved-existing", currentSource: "packages/assets/models/pack/x.glb" }] };
  const result = await validateSources({ sources, registry: [], manifest, repoRoot });
  assert.ok(result.errors.some((e) => /not tracked by Git/.test(e)), result.errors.join("\n"));
}));

test("the same file passes once it is actually committed to Git (real Git repo)", () => withRealGitRepo(async (repoRoot) => {
  await mkdir(join(repoRoot, "packages/assets/models/pack"), { recursive: true });
  await writeFile(join(repoRoot, "packages/assets/models/pack/x.glb"), "x");
  git(repoRoot, ["add", "packages/assets/models/pack/x.glb"]);
  git(repoRoot, ["commit", "-q", "-m", "add fixture"]);
  const sources = baseSources();
  const manifest = { entries: [{ id: "m1", currentStatus: "approved-existing", currentSource: "packages/assets/models/pack/x.glb" }] };
  const result = await validateSources({ sources, registry: [], manifest, repoRoot });
  assert.deepEqual(result.errors, []);
}));

test("an injected isTrackedPath resolver can substitute for real Git in deterministic fixtures", () => withTempRepoRoot(async (repoRoot) => {
  await mkdir(join(repoRoot, "packages/assets/models/pack"), { recursive: true });
  await writeFile(join(repoRoot, "packages/assets/models/pack/x.glb"), "x");
  const sources = baseSources();
  const manifest = { entries: [{ id: "m1", currentStatus: "approved-existing", currentSource: "packages/assets/models/pack/x.glb" }] };
  const result = await validateSources({
    sources, registry: [], manifest, repoRoot,
    resolvers: { isTrackedPath: () => true },
  });
  assert.deepEqual(result.errors, []);
}));

test("a gitignored file fails even though it exists on disk (real Git repo)", () => withRealGitRepo(async (repoRoot) => {
  await writeFile(join(repoRoot, ".gitignore"), "packages/assets/models/pack/\n");
  git(repoRoot, ["add", ".gitignore"]);
  git(repoRoot, ["commit", "-q", "-m", "add gitignore"]);
  await mkdir(join(repoRoot, "packages/assets/models/pack"), { recursive: true });
  await writeFile(join(repoRoot, "packages/assets/models/pack/x.glb"), "x");
  const sources = baseSources();
  const manifest = { entries: [{ id: "m1", currentStatus: "approved-existing", currentSource: "packages/assets/models/pack/x.glb" }] };
  const result = await validateSources({ sources, registry: [], manifest, repoRoot });
  assert.ok(result.errors.some((e) => /not tracked by Git/.test(e)), result.errors.join("\n"));
}));

test("a path outside the repository fails, before Git is even consulted", () => withRealGitRepo(async (repoRoot) => {
  const sources = baseSources();
  const manifest = { entries: [{ id: "m1", currentStatus: "approved-existing", currentSource: "../outside-the-repo.glb" }] };
  const result = await validateSources({ sources, registry: [], manifest, repoRoot });
  assert.ok(result.errors.some((e) => /not contained within the repository/.test(e)), result.errors.join("\n"));
}));

test("a tracked repository_file evidence path passes (real Git repo)", () => withRealGitRepo(async (repoRoot) => {
  await writeFile(join(repoRoot, "CREDITS.md"), "test");
  git(repoRoot, ["add", "CREDITS.md"]);
  git(repoRoot, ["commit", "-q", "-m", "add credits"]);
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "repository_file", path: "CREDITS.md" }], canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const registry = [];
  const result = await validateSources({ sources, registry, manifest: EMPTY_MANIFEST, repoRoot });
  assert.deepEqual(result.errors.filter((e) => e.includes("test-pack")), []);
}));

test("an existing but untracked evidence file fails (real Git repo)", () => withRealGitRepo(async (repoRoot) => {
  await writeFile(join(repoRoot, "CREDITS.md"), "test"); // not git-added
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "repository_file", path: "CREDITS.md" }], canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const result = await validateSources({ sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot });
  assert.ok(result.errors.some((e) => /not tracked by Git/.test(e)), result.errors.join("\n"));
}));

test("paths containing spaces are handled safely by the real Git resolver", () => withRealGitRepo(async (repoRoot) => {
  await mkdir(join(repoRoot, "packages/assets/models/pack name"), { recursive: true });
  await writeFile(join(repoRoot, "packages/assets/models/pack name/file with spaces.glb"), "x");
  git(repoRoot, ["add", "packages/assets/models/pack name/file with spaces.glb"]);
  git(repoRoot, ["commit", "-q", "-m", "add spaced fixture"]);
  const sources = baseSources();
  const manifest = { entries: [{ id: "m1", currentStatus: "approved-existing", currentSource: "packages/assets/models/pack name/file with spaces.glb" }] };
  const result = await validateSources({ sources, registry: [], manifest, repoRoot });
  assert.deepEqual(result.errors, []);
}));

test("errors when a manifest currentSource is a directory, not a regular file", () => withRealGitRepo(async (repoRoot) => {
  await mkdir(join(repoRoot, "packages/assets/models/pack"), { recursive: true });
  await writeFile(join(repoRoot, "packages/assets/models/pack/.gitkeep"), "");
  git(repoRoot, ["add", "packages/assets/models/pack/.gitkeep"]);
  git(repoRoot, ["commit", "-q", "-m", "add dir"]);
  const sources = baseSources();
  const manifest = { entries: [{ id: "m1", currentStatus: "approved-existing", currentSource: "packages/assets/models/pack" }] };
  const result = await validateSources({ sources, registry: [], manifest, repoRoot });
  assert.ok(result.errors.some((e) => /not a regular file/.test(e)), result.errors.join("\n"));
}));

// --- Existing coverage, retained with the new resolvers shape ---

test("errors on an invalid evidence kind", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "not_a_real_kind", path: "x" }], canonicalLocalRoots: [], runtimeAssetIds: ["a"],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "x.glb" }];
  const result = await validateSources({ sources, registry, manifest: EMPTY_MANIFEST, repoRoot });
  assert.ok(result.errors.some((e) => /invalid kind/.test(e)));
}));

test("errors when a repository_file evidence path contains prose instead of a clean path", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "repository_file", path: "some/file.md (this is a long prose description that should never appear in a path field)" }],
      canonicalLocalRoots: [], runtimeAssetIds: ["a"],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "x.glb" }];
  const result = await validateSources({ sources, registry, manifest: EMPTY_MANIFEST, repoRoot });
  assert.ok(result.errors.some((e) => /looks like prose/.test(e)));
}));

test("errors when a git_commit evidence record does not resolve", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: "0000000000000000000000000000000000000000" }], canonicalLocalRoots: [], runtimeAssetIds: ["a"],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "x.glb" }];
  const result = await validateSources({
    sources, registry, manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { isShallowRepository: false, commitResolver: () => false },
  });
  assert.ok(result.errors.some((e) => /does not resolve in this repository/.test(e)));
}));

test("passes when a git_commit evidence record resolves", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: "abc1234567890abcdef0123456789abcdef01234" }], canonicalLocalRoots: [], runtimeAssetIds: ["a"],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "x.glb" }];
  const result = await validateSources({
    sources, registry, manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { commitResolver: () => true },
  });
  assert.deepEqual(result.errors, []);
}));

test("errors when a manifest currentSource points into a dist build-output path", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources();
  const manifest = { entries: [{ id: "m1", currentStatus: "approved-existing", currentSource: "apps/client3d/dist/models/pack/x.glb" }] };
  const result = await validateSources({ sources, registry: [], manifest, repoRoot });
  assert.ok(result.errors.some((e) => /dist.*path/.test(e)));
}));

test("errors when a registry pack has no matching source record", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({ sources: [] });
  const registry = [{ id: "a", pack: "orphan-pack", sourceFile: "x.glb" }];
  const result = await validateSources({ sources, registry, manifest: EMPTY_MANIFEST, repoRoot });
  assert.ok(result.errors.some((e) => /has no matching source record/.test(e)));
}));

test("errors on duplicate sourceId values", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [
      { sourceId: "dup", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0", licenceEvidence: [{ kind: "git_commit", commit: "x" }], canonicalLocalRoots: [], runtimeAssetIds: [] },
      { sourceId: "dup", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0", licenceEvidence: [{ kind: "git_commit", commit: "x" }], canonicalLocalRoots: [], runtimeAssetIds: [] },
    ],
  });
  const result = await validateSources({
    sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { commitResolver: () => true },
  });
  assert.ok(result.errors.some((e) => /Duplicate sourceId/.test(e)));
}));

test("errors when canonicalLocalRoots still points at legacy apps/client3d", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: "x" }], canonicalLocalRoots: ["apps/client3d/public/models/test-pack"],
      runtimeAssetIds: ["a"],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "x.glb" }];
  const result = await validateSources({
    sources, registry, manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { commitResolver: () => true },
  });
  assert.ok(result.errors.some((e) => /legacy apps\/client3d path/.test(e)));
}));

// --- Phase 7: source-registry consistency ---

test("errors when a registry runtime ID is missing from its source record's runtimeAssetIds", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: "x" }], canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "procedural://x" }];
  const result = await validateSources({
    sources, registry, manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { commitResolver: () => true },
  });
  assert.ok(result.errors.some((e) => /missing from runtimeAssetIds/.test(e)));
}));

test("errors when runtimeAssetIds lists an unknown runtime ID", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: "x" }], canonicalLocalRoots: [], runtimeAssetIds: ["does.not.exist"],
    }],
  });
  const registry = [];
  const result = await validateSources({
    sources, registry, manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { commitResolver: () => true },
  });
  assert.ok(result.errors.some((e) => /does not exist in the runtime registry/.test(e)));
}));

test("errors when runtimeAssetIds lists a runtime ID belonging to a different pack", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [
      { sourceId: "pack-a", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0", licenceEvidence: [{ kind: "git_commit", commit: "x" }], canonicalLocalRoots: [], runtimeAssetIds: ["b"] },
      { sourceId: "pack-b", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0", licenceEvidence: [{ kind: "git_commit", commit: "x" }], canonicalLocalRoots: [], runtimeAssetIds: ["b"] },
    ],
  });
  const registry = [{ id: "b", pack: "pack-b", sourceFile: "procedural://b" }];
  const result = await validateSources({
    sources, registry, manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { commitResolver: () => true },
  });
  assert.ok(result.errors.some((e) => /pack-a.*belongs to pack "pack-b"/.test(e)));
}));

test("errors on a duplicate runtime ID within one source record", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: "x" }], canonicalLocalRoots: [], runtimeAssetIds: ["a", "a"],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "procedural://a" }];
  const result = await validateSources({
    sources, registry, manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { commitResolver: () => true },
  });
  assert.ok(result.errors.some((e) => /duplicate entries/.test(e)));
}));

test("errors when a verified_local_evidence source has zero evidence records", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [], canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const result = await validateSources({ sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot });
  assert.ok(result.errors.some((e) => /requires at least one evidence record/.test(e)));
}));

test("errors when an evidence record has both path and commit", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: "abc1234", path: "some/file.md" }], canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const result = await validateSources({
    sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { commitResolver: () => true },
  });
  assert.ok(result.errors.some((e) => /both "path" and "commit"/.test(e)));
}));

test("a valid composite source (everloom-composite pattern) passes with no errors", () => withRealGitRepo(async (repoRoot) => {
  await mkdir(join(repoRoot, "packages/assets/models/kenney-fantasy"), { recursive: true });
  await writeFile(join(repoRoot, "packages/assets/models/kenney-fantasy/wall.glb"), "wall");
  await mkdir(join(repoRoot, "apps/game/src/world"), { recursive: true });
  await writeFile(join(repoRoot, "apps/game/src/world/assets.ts"), "// buildCottage lives here");
  git(repoRoot, ["add", "-A"]);
  git(repoRoot, ["commit", "-q", "-m", "fixture"]);

  const sources = baseSources({
    sources: [
      {
        sourceId: "everloom-composite", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
        licenceEvidence: [{ kind: "source_code", path: "apps/game/src/world/assets.ts", detail: "buildCottage" }],
        canonicalLocalRoots: [], runtimeAssetIds: ["town.cottage"],
      },
      {
        sourceId: "kenney-fantasy", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
        licenceEvidence: [{ kind: "source_code", path: "apps/game/src/world/assets.ts", detail: "n/a" }],
        canonicalLocalRoots: ["packages/assets/models/kenney-fantasy"], runtimeAssetIds: ["town.wall"],
      },
    ],
  });
  const registry = [
    { id: "town.cottage", pack: "everloom-composite", sourceFile: "composite://kenney-fantasy/cottage" },
    { id: "town.wall", pack: "kenney-fantasy", sourceFile: "kenney-fantasy/wall.glb" },
  ];
  const result = await validateSources({ sources, registry, manifest: EMPTY_MANIFEST, repoRoot });
  assert.deepEqual(result.errors, []);
}));

test("validates the real asset-sources.json against the real registry and manifest with 0 errors", async () => {
  const { readFile } = await import("node:fs/promises");
  const { REPOSITORY_ROOT } = await import("../paths.mjs");
  const { resolve } = await import("node:path");
  const sources = JSON.parse(await readFile(resolve(REPOSITORY_ROOT, "packages/assets/sources/asset-sources.json"), "utf8"));
  const registry = JSON.parse(await readFile(resolve(REPOSITORY_ROOT, "packages/assets/src/registry.json"), "utf8"));
  const manifest = JSON.parse(await readFile(resolve(REPOSITORY_ROOT, "art-direction/visual-production-manifest.json"), "utf8"));
  const result = await validateSources({ sources, registry, manifest, repoRoot: REPOSITORY_ROOT });
  assert.deepEqual(result.errors, []);
});

// --- Tests for shallow-repository commit evidence handling ---

test("full 40-character SHA resolves in complete repository: no error, no warning", () => withTempRepoRoot(async (repoRoot) => {
  const fullSha = "0123456789abcdef0123456789abcdef01234567";
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: fullSha }], canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const result = await validateSources({
    sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { isShallowRepository: false, commitResolver: () => true },
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
}));

test("full 40-character SHA does not resolve in complete repository: error", () => withTempRepoRoot(async (repoRoot) => {
  const fullSha = "ffffffffffffffffffffffffffffffffffffffff";
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: fullSha }], canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const result = await validateSources({
    sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { isShallowRepository: false, commitResolver: () => false },
  });
  assert.ok(result.errors.some((e) => /does not resolve/.test(e)));
}));

test("full 40-character SHA resolves in shallow repository: no error, no warning", () => withTempRepoRoot(async (repoRoot) => {
  const fullSha = "0123456789abcdef0123456789abcdef01234567";
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: fullSha }], canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const result = await validateSources({
    sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { isShallowRepository: true, commitResolver: () => true },
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
}));

test("full 40-character SHA does not resolve in shallow repository: warning, not error", () => withTempRepoRoot(async (repoRoot) => {
  const fullSha = "ffffffffffffffffffffffffffffffffffffffff";
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: fullSha }], canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const result = await validateSources({
    sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { isShallowRepository: true, commitResolver: () => false },
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((w) => /could not be verified in this shallow repository/.test(w)));
}));

test("seven-character abbreviated SHA: error in complete repository", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: "abcdef0" }], canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const result = await validateSources({
    sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { isShallowRepository: false, commitResolver: () => true },
  });
  assert.ok(result.errors.some((e) => /must be 40 lowercase hexadecimal/.test(e)));
}));

test("seven-character abbreviated SHA: error in shallow repository", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: "abcdef0" }], canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const result = await validateSources({
    sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { isShallowRepository: true, commitResolver: () => true },
  });
  assert.ok(result.errors.some((e) => /must be 40 lowercase hexadecimal/.test(e)));
}));

test("non-hexadecimal 40-character value: error", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: "gggggggggggggggggggggggggggggggggggggg" }], canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const result = await validateSources({
    sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { isShallowRepository: false, commitResolver: () => false },
  });
  assert.ok(result.errors.some((e) => /must be 40 lowercase hexadecimal/.test(e)));
}));

test("missing commit field in git_commit evidence: error", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit" }], canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const result = await validateSources({
    sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { commitResolver: () => true },
  });
  assert.ok(result.errors.some((e) => /missing "commit" field/.test(e)));
}));

test("git_commit evidence containing both path and commit: error", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", path: "some/file.md", commit: "0123456789abcdef0123456789abcdef01234567" }],
      canonicalLocalRoots: [], runtimeAssetIds: [],
    }],
  });
  const result = await validateSources({
    sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot,
    resolvers: { commitResolver: () => true },
  });
  assert.ok(result.errors.some((e) => /both "path" and "commit"/.test(e)));
}));

test("simulated shallow validation of real registry: zero errors, unresolved historical commit as warning", async () => {
  const { readFile } = await import("node:fs/promises");
  const { REPOSITORY_ROOT } = await import("../paths.mjs");
  const { resolve } = await import("node:path");
  const sources = JSON.parse(await readFile(resolve(REPOSITORY_ROOT, "packages/assets/sources/asset-sources.json"), "utf8"));
  const registry = JSON.parse(await readFile(resolve(REPOSITORY_ROOT, "packages/assets/src/registry.json"), "utf8"));
  const manifest = JSON.parse(await readFile(resolve(REPOSITORY_ROOT, "art-direction/visual-production-manifest.json"), "utf8"));
  const result = await validateSources({
    sources, registry, manifest, repoRoot: REPOSITORY_ROOT,
    resolvers: {
      isShallowRepository: true,
      commitResolver: () => false, // Simulate that no historical commits resolve
    },
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((w) => /could not be verified in this shallow repository/.test(w)));
});
