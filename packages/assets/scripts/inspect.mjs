#!/usr/bin/env node
// Small command-line asset inspector. One command, one small file — not a
// dashboard. Lets a developer or AI agent look up everything known about a
// runtime asset ID without manually cross-referencing the registry, the
// source-evidence file, the visual manifest and the model library by hand.
//
// Usage:
//   node scripts/inspect.mjs <query>
//   node scripts/inspect.mjs <query> --json
//   node scripts/inspect.mjs --pack kenney-nature
//   node scripts/inspect.mjs --category tree
//   node scripts/inspect.mjs --placeholder
//
// `pnpm --filter @everloom/assets run inspect -- <query>` is the intended
// entrypoint (see package.json).

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL_ROOT, resolveModelPath } from "../paths.mjs";
import { parseGlbContainer, summariseGltf } from "./gltf-parser.mjs";
import { createHash } from "node:crypto";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

export async function loadData() {
  const registry = JSON.parse(await readFile(resolve(scriptDirectory, "../src/registry.json"), "utf8"));
  const sources = JSON.parse(await readFile(resolve(scriptDirectory, "../sources/asset-sources.json"), "utf8"));
  const requirements = JSON.parse(await readFile(resolve(scriptDirectory, "../animation-requirements.json"), "utf8"));
  const manifestPath = resolve(scriptDirectory, "../../../art-direction/visual-production-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return { registry, sources, requirements, manifest };
}

/**
 * Find registry entries matching a query: exact ID, then substring on ID,
 * pack, or category (in that priority order). Returns { matches, exact }.
 */
export function findAssets(registry, query, { pack, category, placeholderOnly, manifest } = {}) {
  let pool = registry;
  if (pack) pool = pool.filter((a) => a.pack === pack);
  if (category) pool = pool.filter((a) => a.category === category);
  if (placeholderOnly) {
    const placeholderIds = new Set(
      manifest.entries.filter((e) => e.currentStatus === "procedural-placeholder" || e.currentStatus === "licensed-placeholder")
        .map((e) => e.currentAssetId).filter(Boolean),
    );
    pool = pool.filter((a) => placeholderIds.has(a.id));
  }

  if (!query) return { matches: pool, exact: null };

  const exact = pool.find((a) => a.id === query);
  if (exact) return { matches: [exact], exact };

  const q = query.toLowerCase();
  const matches = pool.filter((a) =>
    a.id.toLowerCase().includes(q) || a.pack.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
  return { matches, exact: null };
}

export async function inspectAsset(asset, { registry, sources, requirements, manifest }) {
  const source = sources.sources.find((s) => s.sourceId === asset.pack);
  const manifestEntries = manifest.entries.filter((e) => e.currentAssetId === asset.id);
  const required = requirements.requirements.find((r) => r.runtimeAssetId === asset.id);

  const info = {
    runtimeAssetId: asset.id,
    category: asset.category,
    sourceFileOrScheme: asset.sourceFile,
    pack: asset.pack,
    creator: source?.creator ?? null,
    claimedLicence: asset.licence,
    evidenceStatus: source?.evidenceStatus ?? null,
    officialSourceUrl: source?.officialSourceUrl ?? asset.sourceUrl ?? null,
    mirrorSourceUrl: source?.mirrorSourceUrl ?? null,
    manifestStatuses: manifestEntries.map((e) => ({ manifestId: e.id, currentStatus: e.currentStatus, role: e.role })),
    requiredClips: required?.requiredClips ?? null,
    warnings: [],
  };

  const isSchemeUri = asset.sourceFile.includes("://");
  if (isSchemeUri) {
    info.scheme = asset.sourceFile.split("://")[0];
    info.canonicalPath = null;
  } else {
    let full;
    try {
      full = resolveModelPath(asset.sourceFile);
    } catch (e) {
      info.warnings.push(e.message);
      return info;
    }
    info.canonicalPath = `${asset.pack}/` === "" ? full : full;
    info.repoRelativePath = `packages/assets/models/${asset.sourceFile}`;
    try {
      const buf = await readFile(full);
      info.byteSize = buf.length;
      info.sha256 = createHash("sha256").update(buf).digest("hex");
      if (full.toLowerCase().endsWith(".glb")) {
        const container = parseGlbContainer(buf);
        if (!container.ok) {
          info.warnings.push(`GLB parse error: ${container.error}`);
        } else {
          const summary = summariseGltf(container.json, { binChunk: container.binChunk });
          info.glb = {
            sceneCount: summary.sceneCount,
            nodeCount: summary.nodeCount,
            meshCount: summary.meshCount,
            materialCount: summary.materialCount,
            textureCount: summary.textureCount,
            totalTriangles: summary.totalTriangles,
            skinCount: summary.skinCount,
            joints: summary.skins.map((s) => s.jointCount),
            animationCount: summary.animationCount,
            animationNames: summary.animationNames,
          };
          if (required) {
            const have = new Set(summary.animationNames);
            const missing = required.requiredClips.filter((c) => !have.has(c));
            info.requiredClipsMissing = missing;
            if (missing.length > 0) info.warnings.push(`Missing required clip(s): ${missing.join(", ")}`);
          }
        }
      }
    } catch (e) {
      info.warnings.push(`Could not read file: ${e.message}`);
    }

    const duplicateOwners = registry.filter((a) => a.id !== asset.id && a.sourceFile === asset.sourceFile);
    if (duplicateOwners.length > 0) {
      info.semanticReuseWith = duplicateOwners.map((a) => a.id);
    }
  }

  if (source?.evidenceStatus === "repository_claim_only") {
    info.warnings.push("Evidence status is repository_claim_only: no independently verified external licence evidence exists.");
  }

  return info;
}

function formatHuman(info) {
  const lines = [];
  lines.push(`${info.runtimeAssetId}  [${info.category}]`);
  lines.push(`  pack: ${info.pack}  creator: ${info.creator ?? "unknown"}`);
  lines.push(`  licence: ${info.claimedLicence ?? "unknown"}  evidence: ${info.evidenceStatus ?? "unknown"}`);
  if (info.officialSourceUrl) lines.push(`  official: ${info.officialSourceUrl}`);
  if (info.mirrorSourceUrl) lines.push(`  mirror:   ${info.mirrorSourceUrl}`);
  if (info.scheme) {
    lines.push(`  scheme: ${info.scheme}:// (no binary file — code-generated)`);
  } else {
    lines.push(`  path: ${info.repoRelativePath ?? "(unresolved)"}`);
    if (info.byteSize !== undefined) lines.push(`  size: ${info.byteSize} bytes  sha256: ${info.sha256}`);
    if (info.glb) {
      lines.push(`  glb: scenes=${info.glb.sceneCount} nodes=${info.glb.nodeCount} meshes=${info.glb.meshCount} materials=${info.glb.materialCount} triangles=${info.glb.totalTriangles}`);
      if (info.glb.skinCount > 0) {
        lines.push(`  rig: skins=${info.glb.skinCount} joints=${info.glb.joints.join(",")} animations=${info.glb.animationCount}`);
      }
      if (info.requiredClips) {
        const status = (info.requiredClipsMissing?.length ?? 0) === 0 ? "OK" : `MISSING: ${info.requiredClipsMissing.join(", ")}`;
        lines.push(`  required clips: ${info.requiredClips.join(", ")} [${status}]`);
      }
    }
    if (info.semanticReuseWith) lines.push(`  semantic reuse: same physical file also used by ${info.semanticReuseWith.join(", ")}`);
  }
  if (info.manifestStatuses.length > 0) {
    for (const m of info.manifestStatuses) lines.push(`  manifest[${m.manifestId}]: ${m.currentStatus} (role: ${m.role ?? "?"})`);
  } else {
    lines.push(`  manifest: no entry references this runtime asset ID`);
  }
  if (info.warnings.length > 0) {
    lines.push(`  warnings:`);
    for (const w of info.warnings) lines.push(`    - ${w}`);
  }
  return lines.join("\n");
}

async function runCli() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  // pnpm's `run <script> -- <args>` passthrough does not always strip the
  // literal "--" separator before invoking the script, so tolerate it here.
  const filtered = args.filter((a) => a !== "--json" && a !== "--");

  let pack = null, category = null, placeholderOnly = false, query = null;
  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i] === "--pack") { pack = filtered[++i]; continue; }
    if (filtered[i] === "--category") { category = filtered[++i]; continue; }
    if (filtered[i] === "--placeholder") { placeholderOnly = true; continue; }
    if (!query) query = filtered[i];
  }

  const { registry, sources, requirements, manifest } = await loadData();
  const { matches, exact } = findAssets(registry, query, { pack, category, placeholderOnly, manifest });

  if (matches.length === 0) {
    console.log(`No asset matched: ${query ?? "(no query — use --pack/--category/--placeholder to filter)"}`);
    process.exitCode = 1;
    return;
  }

  if (matches.length > 1 && !exact) {
    if (jsonMode) {
      console.log(JSON.stringify({ ambiguous: true, matches: matches.map((m) => m.id) }, null, 2));
    } else {
      console.log(`${matches.length} assets matched "${query ?? ""}":`);
      for (const m of matches) console.log(`  - ${m.id} [${m.category}, ${m.pack}]`);
      console.log(`\nRun again with an exact runtime asset ID to see full detail.`);
    }
    return;
  }

  const info = await inspectAsset(matches[0], { registry, sources, requirements, manifest });
  if (jsonMode) {
    console.log(JSON.stringify(info, null, 2));
  } else {
    console.log(formatHuman(info));
  }
}

import { pathToFileURL } from "node:url";
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await runCli();
