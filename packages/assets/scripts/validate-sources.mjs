#!/usr/bin/env node
// Durable validator for packages/assets/sources/asset-sources.json and its
// consistency against the runtime registry and the visual-production
// manifest. Node built-ins only.
//
// This validator checks that evidence records are internally well-formed
// and that referenced paths/commits exist. It does NOT and cannot verify
// external legal licence approval — see docs/authority/ASSET_SOURCES.md.
// A `repository_claim_only` evidenceStatus or missing archive evidence is
// reported as a warning, not an error, and never treated as commercial
// approval.
//
// `validateSources()` is the pure, parameterised core used both by the CLI
// entrypoint below and by validate-sources.test.mjs.

import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REPOSITORY_ROOT } from "../paths.mjs";

const EVIDENCE_KINDS = new Set(["repository_file", "source_code", "git_commit"]);
const EVIDENCE_STATUSES = new Set([
  "verified_local_evidence",
  "verified_embedded_metadata",
  "repository_claim_only",
  "missing",
  "conflicting",
]);

/**
 * @param {object} opts
 * @param {object} opts.sources parsed asset-sources.json
 * @param {Array} opts.registry parsed registry.json
 * @param {{entries: Array}} opts.manifest parsed visual-production-manifest.json
 * @param {string} opts.repoRoot absolute repository root, for resolving repository_file/source_code paths and canonicalLocalRoots
 * @param {(commit: string) => boolean} [opts.commitResolver] override for git commit resolution (defaults to a real `git cat-file` check against repoRoot)
 */
export async function validateSources({ sources, registry, manifest, repoRoot, commitResolver }) {
  const errors = [];
  const warnings = [];
  const err = (msg) => errors.push(msg);
  const warn = (msg) => warnings.push(msg);

  const resolveCommit = commitResolver || ((commit) => {
    try {
      execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], { cwd: repoRoot, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });

  async function pathExists(relPath) {
    try {
      await stat(resolve(repoRoot, relPath));
      return true;
    } catch {
      return false;
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

    if (registryPacks.has(label) && !source.claimedLicence) {
      err(`${label}: is referenced by the runtime registry but has no claimedLicence`);
    }

    for (const ev of source.licenceEvidence || []) {
      if (!EVIDENCE_KINDS.has(ev.kind)) {
        err(`${label}: licenceEvidence has invalid kind "${ev.kind}"`);
        continue;
      }
      if (ev.kind === "git_commit") {
        if (!ev.commit) {
          err(`${label}: git_commit evidence record missing "commit" field`);
        } else if (!resolveCommit(ev.commit)) {
          err(`${label}: git_commit evidence references a commit that does not resolve in this repository: ${ev.commit}`);
        }
        if (ev.path) err(`${label}: git_commit evidence record must not have a "path" field (found ${JSON.stringify(ev.path)}) — use "commit" only`);
      } else {
        if (!ev.path) {
          err(`${label}: ${ev.kind} evidence record missing "path" field`);
          continue;
        }
        if (ev.path.length > 200 || /[()"]/.test(ev.path)) {
          err(`${label}: ${ev.kind} evidence "path" field looks like prose, not a path: ${JSON.stringify(ev.path)}`);
          continue;
        }
        if (!(await pathExists(ev.path))) {
          err(`${label}: ${ev.kind} evidence path does not exist: ${ev.path}`);
        }
      }
    }

    for (const root of source.canonicalLocalRoots || []) {
      if (root.startsWith("apps/client3d/")) {
        err(`${label}: canonicalLocalRoots still points at legacy apps/client3d path: ${root}`);
      }
      if (!(await pathExists(root))) {
        warn(`${label}: canonicalLocalRoots entry does not exist on disk: ${root}`);
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
      }
      if (!(await pathExists(entry.currentSource))) {
        err(`Manifest entry ${entry.id}: currentSource does not resolve to a tracked file: ${entry.currentSource}`);
      }
      if (entry.currentSource.startsWith("apps/client3d/")) {
        err(`Manifest entry ${entry.id}: currentSource still points at a legacy path: ${entry.currentSource}`);
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
    console.log(`\n✅ Source and manifest evidence structurally valid. ${result.warnings.length} warning(s).`);
    console.log(`   This is not commercial-release legal approval — see docs/authority/ASSET_SOURCES.md.`);
  }
  process.exit(result.errors.length > 0 ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await runCli();
