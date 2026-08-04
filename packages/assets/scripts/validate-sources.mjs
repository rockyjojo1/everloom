#!/usr/bin/env node
// Durable validator for packages/assets/sources/asset-sources.json and its
// consistency against the runtime registry and the visual-production
// manifest. Node built-ins only.
//
// This validator checks that evidence records are internally well-formed
// and that referenced paths/commits exist AND are tracked by Git. It does
// NOT and cannot verify external legal licence approval — see
// docs/authority/ASSET_SOURCES.md. A `repository_claim_only` evidenceStatus
// or missing archive evidence is reported as a warning, not an error, and
// never treated as commercial approval.
//
// `validateSources()` is the pure, parameterised core used both by the CLI
// entrypoint below and by validate-sources.test.mjs. Filesystem existence
// and Git tracking are deliberately separate facts (`pathExists` vs.
// `isTrackedPath`) — a file that merely exists on disk (untracked, or
// .gitignore'd) is not proof it is part of the committed repository.

import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REPOSITORY_ROOT, MODEL_ROOT_RELATIVE } from "../paths.mjs";

const EVIDENCE_KINDS = new Set(["repository_file", "source_code", "git_commit"]);
const EVIDENCE_STATUSES = new Set([
  "verified_local_evidence",
  "verified_embedded_metadata",
  "repository_claim_only",
  "missing",
  "conflicting",
]);
const STRONG_EVIDENCE_STATUSES = new Set(["verified_local_evidence", "verified_embedded_metadata"]);

/** True if `relPath`, resolved against `repoRoot`, stays within `repoRoot`. */
function isWithinRepo(repoRoot, relPath) {
  if (typeof relPath !== "string" || relPath.length === 0) return false;
  if (isAbsolute(relPath)) return false;
  const full = resolve(repoRoot, relPath);
  const rel = relative(repoRoot, full);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * Build the default, real-filesystem/real-Git resolver set bound to
 * `repoRoot`. Tests inject their own object with the same shape instead of
 * calling this.
 */
function makeDefaultResolvers(repoRoot) {
  return {
    pathExists: async (relPath) => {
      if (!isWithinRepo(repoRoot, relPath)) return false;
      try {
        await stat(resolve(repoRoot, relPath));
        return true;
      } catch {
        return false;
      }
    },
    isRegularFile: async (relPath) => {
      if (!isWithinRepo(repoRoot, relPath)) return false;
      try {
        const s = await stat(resolve(repoRoot, relPath));
        return s.isFile();
      } catch {
        return false;
      }
    },
    // Git ls-files --error-unmatch reports success only for a path that is
    // actually tracked in the index — untracked files, ignored files, and
    // files that merely exist on disk all fail this, unlike a bare stat().
    isTrackedPath: (relPath) => {
      if (!isWithinRepo(repoRoot, relPath)) return false;
      try {
        execFileSync("git", ["ls-files", "--error-unmatch", "--", relPath], {
          cwd: repoRoot,
          stdio: "ignore",
          shell: false,
        });
        return true;
      } catch {
        return false;
      }
    },
    // At least one tracked file exists at or beneath relDir.
    hasTrackedFileUnder: (relDir) => {
      if (!isWithinRepo(repoRoot, relDir)) return false;
      try {
        const out = execFileSync("git", ["ls-files", "--", relDir], {
          cwd: repoRoot,
          encoding: "utf8",
          shell: false,
        });
        return out.trim().length > 0;
      } catch {
        return false;
      }
    },
    commitResolver: (commit) => {
      try {
        execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], { cwd: repoRoot, stdio: "ignore", shell: false });
        return true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * @param {object} opts
 * @param {object} opts.sources parsed asset-sources.json
 * @param {Array} opts.registry parsed registry.json
 * @param {{entries: Array}} opts.manifest parsed visual-production-manifest.json
 * @param {string} opts.repoRoot absolute repository root
 * @param {object} [opts.resolvers] override any of pathExists/isRegularFile/
 *   isTrackedPath/hasTrackedFileUnder/commitResolver for fixture tests;
 *   unspecified functions fall back to the real filesystem/Git defaults.
 */
export async function validateSources({ sources, registry, manifest, repoRoot, resolvers = {} }) {
  const errors = [];
  const warnings = [];
  const err = (msg) => errors.push(msg);
  const warn = (msg) => warnings.push(msg);

  const defaults = makeDefaultResolvers(repoRoot);
  const pathExists = resolvers.pathExists || defaults.pathExists;
  const isRegularFile = resolvers.isRegularFile || defaults.isRegularFile;
  const isTrackedPath = resolvers.isTrackedPath || defaults.isTrackedPath;
  const hasTrackedFileUnder = resolvers.hasTrackedFileUnder || defaults.hasTrackedFileUnder;
  const resolveCommit = resolvers.commitResolver || defaults.commitResolver;

  /** A file-backed evidence/manifest path must exist, be a regular file, be repo-contained, and be Git-tracked. */
  async function requireTrackedFile(relPath, label) {
    if (!isWithinRepo(repoRoot, relPath)) {
      err(`${label}: path is not contained within the repository: ${relPath}`);
      return;
    }
    if (!(await pathExists(relPath))) {
      err(`${label}: path does not exist: ${relPath}`);
      return;
    }
    if (!(await isRegularFile(relPath))) {
      err(`${label}: path exists but is not a regular file: ${relPath}`);
      return;
    }
    if (!(await isTrackedPath(relPath))) {
      err(`${label}: path exists on disk but is not tracked by Git (untracked or ignored): ${relPath}`);
      return;
    }
  }

  const declaredKinds = new Set(sources.evidenceKinds || []);
  const declaredStatuses = new Set(sources.evidenceStatusValues || []);
  for (const k of declaredKinds) if (!EVIDENCE_KINDS.has(k)) warn(`asset-sources.json declares unknown evidenceKind "${k}"`);
  for (const s of declaredStatuses) if (!EVIDENCE_STATUSES.has(s)) warn(`asset-sources.json declares unknown evidenceStatusValue "${s}"`);

  const ids = sources.sources.map((s) => s.sourceId);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) err(`Duplicate sourceId values in asset-sources.json`);
  const sortedIds = [...ids].sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(ids) !== JSON.stringify(sortedIds)) err(`asset-sources.json sources are not sorted by sourceId`);

  const registryPacks = new Set(registry.map((a) => a.pack));
  for (const pack of registryPacks) {
    if (!idSet.has(pack)) err(`Registry pack "${pack}" has no matching source record in asset-sources.json`);
  }

  // Registry IDs grouped by their declared pack, for the source<->registry
  // cross-checks below.
  const registryIdsByPack = new Map();
  const registryById = new Map();
  for (const asset of registry) {
    registryById.set(asset.id, asset);
    if (!registryIdsByPack.has(asset.pack)) registryIdsByPack.set(asset.pack, new Set());
    registryIdsByPack.get(asset.pack).add(asset.id);
  }

  for (const source of sources.sources) {
    const label = source.sourceId;

    if (!EVIDENCE_STATUSES.has(source.evidenceStatus)) {
      err(`${label}: invalid evidenceStatus "${source.evidenceStatus}"`);
    }
    if (source.evidenceStatus === "repository_claim_only") {
      warn(`${label}: evidenceStatus is repository_claim_only — no independently verified external archive/licence evidence exists for this source.`);
    }
    if (source.evidenceStatus === "missing") {
      warn(`${label}: evidenceStatus is missing — no local evidence was found for this source at all.`);
    }
    if (source.evidenceStatus === "conflicting") {
      warn(`${label}: evidenceStatus is conflicting — local records disagree; see notes.`);
    }
    if (STRONG_EVIDENCE_STATUSES.has(source.evidenceStatus) && (source.licenceEvidence || []).length === 0) {
      err(`${label}: evidenceStatus is "${source.evidenceStatus}" but licenceEvidence is empty — a strong evidence status requires at least one evidence record`);
    }

    if (registryPacks.has(label) && !source.claimedLicence) {
      err(`${label}: is referenced by the runtime registry but has no claimedLicence`);
    }

    for (const ev of source.licenceEvidence || []) {
      if (!EVIDENCE_KINDS.has(ev.kind)) {
        err(`${label}: licenceEvidence has invalid kind "${ev.kind}"`);
        continue;
      }
      const hasPath = Object.prototype.hasOwnProperty.call(ev, "path") && ev.path != null;
      const hasCommit = Object.prototype.hasOwnProperty.call(ev, "commit") && ev.commit != null;
      if (hasPath && hasCommit) {
        err(`${label}: evidence record has both "path" and "commit" — an evidence record must use exactly one (found path=${JSON.stringify(ev.path)}, commit=${JSON.stringify(ev.commit)})`);
        continue;
      }
      if (ev.kind === "git_commit") {
        if (!hasCommit) {
          err(`${label}: git_commit evidence record missing "commit" field`);
        } else if (!resolveCommit(ev.commit)) {
          err(`${label}: git_commit evidence references a commit that does not resolve in this repository: ${ev.commit}`);
        }
      } else {
        if (!hasPath) {
          err(`${label}: ${ev.kind} evidence record missing "path" field`);
          continue;
        }
        if (ev.path.length > 200 || /[()"]/.test(ev.path)) {
          err(`${label}: ${ev.kind} evidence "path" field looks like prose, not a path: ${JSON.stringify(ev.path)}`);
          continue;
        }
        await requireTrackedFile(ev.path, `${label}: ${ev.kind} evidence`);
      }
    }

    for (const root of source.canonicalLocalRoots || []) {
      if (root.startsWith("apps/client3d/")) {
        err(`${label}: canonicalLocalRoots still points at legacy apps/client3d path: ${root}`);
      }
      if (!isWithinRepo(repoRoot, root)) {
        err(`${label}: canonicalLocalRoots entry is not contained within the repository: ${root}`);
        continue;
      }
      const hasFileBackedAssets = [...(registryIdsByPack.get(label) || [])]
        .some((id) => !registryById.get(id).sourceFile.includes("://"));
      if (hasFileBackedAssets && !root.startsWith(`${MODEL_ROOT_RELATIVE}/`) && root !== MODEL_ROOT_RELATIVE) {
        err(`${label}: canonicalLocalRoots entry for a file-backed pack must resolve beneath ${MODEL_ROOT_RELATIVE}: ${root}`);
        continue;
      }
      if (!(await hasTrackedFileUnder(root))) {
        warn(`${label}: canonicalLocalRoots entry has no tracked file beneath it: ${root}`);
      }
    }

    // Source <-> registry cross-checks (Phase 7).
    const declaredRuntimeIds = source.runtimeAssetIds || [];
    const dedupedRuntimeIds = new Set(declaredRuntimeIds);
    if (dedupedRuntimeIds.size !== declaredRuntimeIds.length) {
      err(`${label}: runtimeAssetIds contains duplicate entries`);
    }
    for (const rid of declaredRuntimeIds) {
      const asset = registryById.get(rid);
      if (!asset) {
        err(`${label}: runtimeAssetIds lists "${rid}", which does not exist in the runtime registry`);
        continue;
      }
      if (asset.pack !== label) {
        err(`${label}: runtimeAssetIds lists "${rid}", which belongs to pack "${asset.pack}", not "${label}"`);
      }
    }
    const actualIdsForPack = registryIdsByPack.get(label) || new Set();
    for (const rid of actualIdsForPack) {
      if (!dedupedRuntimeIds.has(rid)) {
        err(`${label}: registry asset "${rid}" belongs to this pack but is missing from runtimeAssetIds`);
      }
    }
  }

  const registryIds = new Set(registry.map((a) => a.id));
  let manifestCurrentAssetIdChecked = 0;
  let manifestSourcePathChecked = 0;
  for (const entry of manifest.entries) {
    if (entry.currentAssetId) {
      manifestCurrentAssetIdChecked++;
      if (!registryIds.has(entry.currentAssetId)) {
        err(`Manifest entry ${entry.id}: currentAssetId "${entry.currentAssetId}" is not a registered runtime asset`);
      }
    }
    const isSchemeUri = typeof entry.currentSource === "string" && entry.currentSource.includes("://");
    if ((entry.currentStatus === "approved-existing" || entry.currentStatus === "licensed-placeholder") &&
        entry.currentSource && !entry.currentSource.startsWith("http") && !isSchemeUri) {
      manifestSourcePathChecked++;
      if (entry.currentSource.includes("/dist/")) {
        err(`Manifest entry ${entry.id}: currentSource points at a build-output (dist) path: ${entry.currentSource}`);
      } else if (entry.currentSource.startsWith("apps/client3d/")) {
        err(`Manifest entry ${entry.id}: currentSource still points at a legacy path: ${entry.currentSource}`);
      } else {
        await requireTrackedFile(entry.currentSource, `Manifest entry ${entry.id}: currentSource`);
      }
    }
    if (entry.currentStatus === "procedural-placeholder" &&
        !(entry.currentSource || "").startsWith("procedural://")) {
      err(`Manifest entry ${entry.id}: currentStatus is procedural-placeholder but currentSource is not a procedural:// URI (${entry.currentSource})`);
    }
    if (entry.currentStatus === "licensed-placeholder" && entry.role === "production-asset") {
      err(`Manifest entry ${entry.id}: currentStatus is licensed-placeholder but role claims "production-asset"`);
    }
  }

  return { errors, warnings, manifestCurrentAssetIdChecked, manifestSourcePathChecked };
}

// --- CLI entrypoint ---
async function runCli() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const sourcesPath = resolve(scriptDirectory, "../sources/asset-sources.json");
  const registryPath = resolve(scriptDirectory, "../src/registry.json");
  const manifestPath = resolve(REPOSITORY_ROOT, "art-direction/visual-production-manifest.json");

  const sources = JSON.parse(await readFile(sourcesPath, "utf8"));
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  const result = await validateSources({ sources, registry, manifest, repoRoot: REPOSITORY_ROOT });

  console.log("\n=== Source & Licence Evidence Validation ===\n");
  console.log(`Checked ${sources.sources.length} source records, ${result.manifestCurrentAssetIdChecked} manifest currentAssetId references, ${result.manifestSourcePathChecked} manifest file-backed source paths.`);
  if (result.errors.length > 0) {
    console.log(`\n❌ ERRORS (${result.errors.length}):`);
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }
  if (result.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${result.warnings.length}):`);
    result.warnings.forEach((w) => console.log(`  - ${w}`));
  }
  if (result.errors.length === 0) {
    console.log(`\n✅ Source and manifest evidence structurally valid, and every checked path is Git-tracked. ${result.warnings.length} warning(s).`);
    console.log(`   This is not commercial-release legal approval — see docs/authority/ASSET_SOURCES.md.`);
  }
  process.exit(result.errors.length > 0 ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await runCli();
