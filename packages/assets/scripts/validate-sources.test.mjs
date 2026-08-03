import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSources } from "./validate-sources.mjs";

async function withTempRepoRoot(fn) {
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

test("errors on an invalid evidence kind", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack",
      evidenceStatus: "verified_local_evidence",
      claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "not_a_real_kind", path: "x" }],
      canonicalLocalRoots: [],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "x.glb" }];
  const result = await validateSources({ sources, registry, manifest: EMPTY_MANIFEST, repoRoot });
  assert.ok(result.errors.some((e) => /invalid kind/.test(e)));
}));

test("errors when a repository_file evidence path contains prose instead of a clean path", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack",
      evidenceStatus: "verified_local_evidence",
      claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "repository_file", path: "some/file.md (this is a long prose description that should never appear in a path field)" }],
      canonicalLocalRoots: [],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "x.glb" }];
  const result = await validateSources({ sources, registry, manifest: EMPTY_MANIFEST, repoRoot });
  assert.ok(result.errors.some((e) => /looks like prose/.test(e)));
}));

test("errors when a repository_file evidence path does not exist", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack",
      evidenceStatus: "verified_local_evidence",
      claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "repository_file", path: "does/not/exist.md" }],
      canonicalLocalRoots: [],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "x.glb" }];
  const result = await validateSources({ sources, registry, manifest: EMPTY_MANIFEST, repoRoot });
  assert.ok(result.errors.some((e) => /evidence path does not exist/.test(e)));
}));

test("passes when a repository_file evidence path exists", () => withTempRepoRoot(async (repoRoot) => {
  await writeFile(join(repoRoot, "CREDITS.md"), "test");
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack",
      evidenceStatus: "verified_local_evidence",
      claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "repository_file", path: "CREDITS.md" }],
      canonicalLocalRoots: [],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "x.glb" }];
  const result = await validateSources({ sources, registry, manifest: EMPTY_MANIFEST, repoRoot });
  assert.deepEqual(result.errors, []);
}));

test("errors when a git_commit evidence record does not resolve", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack",
      evidenceStatus: "verified_local_evidence",
      claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: "0000000" }],
      canonicalLocalRoots: [],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "x.glb" }];
  const result = await validateSources({
    sources, registry, manifest: EMPTY_MANIFEST, repoRoot,
    commitResolver: () => false,
  });
  assert.ok(result.errors.some((e) => /does not resolve in this repository/.test(e)));
}));

test("passes when a git_commit evidence record resolves", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack",
      evidenceStatus: "verified_local_evidence",
      claimedLicence: "CC0-1.0",
      licenceEvidence: [{ kind: "git_commit", commit: "abc1234" }],
      canonicalLocalRoots: [],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "x.glb" }];
  const result = await validateSources({
    sources, registry, manifest: EMPTY_MANIFEST, repoRoot,
    commitResolver: () => true,
  });
  assert.deepEqual(result.errors, []);
}));

test("errors when a manifest currentSource points into a dist build-output path", () => withTempRepoRoot(async (repoRoot) => {
  await mkdir(join(repoRoot, "packages/assets/models/pack"), { recursive: true });
  await writeFile(join(repoRoot, "packages/assets/models/pack/x.glb"), "x");
  const sources = baseSources();
  const registry = [];
  const manifest = { entries: [{ id: "m1", currentStatus: "approved-existing", currentSource: "apps/client3d/dist/models/pack/x.glb" }] };
  const result = await validateSources({ sources, registry, manifest, repoRoot });
  assert.ok(result.errors.some((e) => /dist.*path/.test(e)));
}));

test("errors when a manifest currentSource does not resolve to a tracked file", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources();
  const registry = [];
  const manifest = { entries: [{ id: "m1", currentStatus: "approved-existing", currentSource: "packages/assets/models/pack/missing.glb" }] };
  const result = await validateSources({ sources, registry, manifest, repoRoot });
  assert.ok(result.errors.some((e) => /does not resolve to a tracked file/.test(e)));
}));

test("passes when a manifest currentSource resolves to a real tracked file under the canonical root", () => withTempRepoRoot(async (repoRoot) => {
  await mkdir(join(repoRoot, "packages/assets/models/pack"), { recursive: true });
  await writeFile(join(repoRoot, "packages/assets/models/pack/x.glb"), "x");
  const sources = baseSources();
  const registry = [];
  const manifest = { entries: [{ id: "m1", currentStatus: "approved-existing", currentSource: "packages/assets/models/pack/x.glb" }] };
  const result = await validateSources({ sources, registry, manifest, repoRoot });
  assert.deepEqual(result.errors, []);
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
      { sourceId: "dup", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0", licenceEvidence: [], canonicalLocalRoots: [] },
      { sourceId: "dup", evidenceStatus: "verified_local_evidence", claimedLicence: "CC0-1.0", licenceEvidence: [], canonicalLocalRoots: [] },
    ],
  });
  const result = await validateSources({ sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot });
  assert.ok(result.errors.some((e) => /Duplicate sourceId/.test(e)));
}));

test("errors when canonicalLocalRoots still points at legacy apps/client3d", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack",
      evidenceStatus: "verified_local_evidence",
      claimedLicence: "CC0-1.0",
      licenceEvidence: [],
      canonicalLocalRoots: ["apps/client3d/public/models/test-pack"],
    }],
  });
  const registry = [{ id: "a", pack: "test-pack", sourceFile: "x.glb" }];
  const result = await validateSources({ sources, registry, manifest: EMPTY_MANIFEST, repoRoot });
  assert.ok(result.errors.some((e) => /legacy apps\/client3d path/.test(e)));
}));

test("warns (does not error) on repository_claim_only evidence status", () => withTempRepoRoot(async (repoRoot) => {
  const sources = baseSources({
    sources: [{
      sourceId: "test-pack",
      evidenceStatus: "repository_claim_only",
      claimedLicence: "CC0-1.0",
      licenceEvidence: [],
      canonicalLocalRoots: [],
    }],
  });
  const result = await validateSources({ sources, registry: [], manifest: EMPTY_MANIFEST, repoRoot });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((w) => /repository_claim_only/.test(w)));
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
