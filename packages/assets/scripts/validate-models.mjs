#!/usr/bin/env node
// Durable, committed technical validator for the canonical model library.
// Node built-ins only — no third-party glTF/image library.
//
// Checks (see docs/audits/2026-08-04-canonical-asset-foundation/ for the
// coverage rationale): filesystem identity, GLB/glTF structural validity,
// geometry/texture/rig/animation metadata, required animation clips, and
// duplicate-vs-semantic-reuse binary detection across the full canonical
// model library.
//
// Exit code is non-zero only on errors. Warnings are reported and counted
// but do not fail the build. This validator does not itself constitute
// commercial-release licence approval — see validate-sources.mjs and
// docs/authority/ASSET_SOURCES.md.
//
// `validateModels()` is the pure, parameterised core (no process I/O beyond
// reading the given modelRoot) used both by the CLI entrypoint below and by
// validate-models.test.mjs against temporary fixture roots.

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MODEL_ROOT, resolveModelPath } from "../paths.mjs";
import { parseGlbContainer, summariseGltf } from "./gltf-parser.mjs";

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

/**
 * @param {object} opts
 * @param {string} opts.modelRoot absolute path to the canonical model root to validate against
 * @param {Array} opts.registry parsed registry.json contents
 * @param {{requirements: Array<{runtimeAssetId: string, requiredClips: string[]}>}} opts.requirements parsed animation-requirements.json contents
 * @param {(sourceFile: string) => string} [opts.resolvePath] override for resolving a registry sourceFile to an absolute path (defaults to resolveModelPath against the real MODEL_ROOT); tests pass a root-scoped resolver.
 */
export async function validateModels({ modelRoot, registry, requirements, resolvePath }) {
  const errors = [];
  const warnings = [];
  const err = (msg) => errors.push(msg);
  const warn = (msg) => warnings.push(msg);

  const resolveInRoot = resolvePath || ((sourceFile) => {
    const full = resolve(modelRoot, sourceFile);
    if (full !== modelRoot && !full.startsWith(modelRoot + (modelRoot.includes("\\") ? "\\" : "/"))) {
      throw new Error(`sourceFile escapes the canonical model root: ${sourceFile}`);
    }
    return full;
  });

  let rootStat;
  try {
    rootStat = await stat(modelRoot);
  } catch {
    err(`Canonical model root does not exist: ${modelRoot}`);
    return { errors, warnings, modelResults: [], duplicateGroups: [], semanticReuseGroups: [], totalLibraryFiles: 0 };
  }
  if (!rootStat.isDirectory()) {
    err(`Canonical model root is not a directory: ${modelRoot}`);
    return { errors, warnings, modelResults: [], duplicateGroups: [], semanticReuseGroups: [], totalLibraryFiles: 0 };
  }

  const requirementsByAssetId = new Map((requirements.requirements || []).map((r) => [r.runtimeAssetId, r.requiredClips]));

  const allFiles = await walk(modelRoot);
  const hashByPath = new Map();
  const hashGroups = new Map();
  for (const full of allFiles) {
    const rel = relative(modelRoot, full).replaceAll("\\", "/");
    const buf = await readFile(full);
    const hash = createHash("sha256").update(buf).digest("hex");
    hashByPath.set(rel, { hash, size: buf.length });
    if (!hashGroups.has(hash)) hashGroups.set(hash, []);
    hashGroups.get(hash).push(rel);
  }

  const sourceFileToIds = new Map();
  for (const asset of registry) {
    if (asset.sourceFile.includes("://")) continue;
    if (!sourceFileToIds.has(asset.sourceFile)) sourceFileToIds.set(asset.sourceFile, []);
    sourceFileToIds.get(asset.sourceFile).push(asset.id);
  }

  const duplicateGroups = [];
  const semanticReuseGroups = [];
  for (const [hash, paths] of hashGroups) {
    if (paths.length < 2) continue;
    duplicateGroups.push({ hash, paths, size: hashByPath.get(paths[0]).size });
  }
  for (const [sourceFile, ids] of sourceFileToIds) {
    if (ids.length > 1) semanticReuseGroups.push({ sourceFile, runtimeAssetIds: ids });
  }
  for (const g of duplicateGroups) {
    warn(`Duplicate binary content across ${g.paths.length} distinct files (${g.size} bytes each): ${g.paths.join(", ")}`);
  }

  const modelResults = [];

  for (const asset of registry) {
    if (asset.sourceFile.includes("://")) continue;

    const result = { runtimeAssetId: asset.id, sourceFile: asset.sourceFile };
    let absPath;
    try {
      absPath = resolveInRoot(asset.sourceFile);
    } catch (e) {
      err(`${asset.id}: ${e.message}`);
      modelResults.push(result);
      continue;
    }

    const relPath = asset.sourceFile;
    const info = hashByPath.get(relPath);
    if (!info) {
      err(`${asset.id}: registry sourceFile not found under canonical model root: ${relPath}`);
      modelResults.push(result);
      continue;
    }
    result.byteSize = info.size;
    result.sha256 = info.hash;
    if (info.size === 0) err(`${asset.id}: source file is zero bytes: ${relPath}`);

    const ext = extname(relPath).toLowerCase();
    if (ext !== ".glb") {
      result.format = ext.slice(1);
      modelResults.push(result);
      continue;
    }
    result.format = "glb";

    const buf = await readFile(absPath);
    const container = parseGlbContainer(buf);
    if (!container.ok) {
      err(`${asset.id}: GLB parse failed for ${relPath}: ${container.error}`);
      modelResults.push(result);
      continue;
    }
    if (container.lengthMismatch) {
      warn(`${asset.id}: declared GLB length (${container.declaredLength}) != actual file length (${container.actualLength}) for ${relPath}`);
    }

    const modelDir = dirname(absPath);
    const sep = modelRoot.includes("\\") ? "\\" : "/";
    const withinRoot = (full) => full === modelRoot || full.startsWith(modelRoot + sep);
    const summary = summariseGltf(container.json, { binChunk: container.binChunk });
    result.glb = {
      sceneCount: summary.sceneCount,
      nodeCount: summary.nodeCount,
      meshCount: summary.meshCount,
      materialCount: summary.materialCount,
      textureCount: summary.textureCount,
      imageCount: summary.imageCount,
      skinCount: summary.skinCount,
      joints: summary.skins.map((s) => s.jointCount),
      animationCount: summary.animationCount,
      animationNames: summary.animationNames,
      totalTriangles: summary.totalTriangles,
      malformedPrimitiveCount: summary.malformedPrimitiveCount,
      extensionsUsed: summary.extensionsUsed,
    };

    if (summary.sceneCount === 0 && container.json.scene === undefined) {
      err(`${asset.id}: no scene present in ${relPath} (glTF asset should declare at least a default scene)`);
    }
    if (summary.meshCount === 0) {
      warn(`${asset.id}: no meshes found in ${relPath} (renders nothing)`);
    }
    if (summary.nodeCount === 0) {
      err(`${asset.id}: no nodes present in ${relPath}`);
    }
    if (summary.malformedPrimitiveCount > 0) {
      err(`${asset.id}: ${summary.malformedPrimitiveCount} primitive(s) with a TRIANGLES mode index/vertex count not divisible by 3 in ${relPath}`);
    }

    for (const uri of summary.externalBufferUris) {
      const full = resolve(modelDir, decodeURIComponent(uri));
      if (!withinRoot(full)) {
        err(`${asset.id}: external buffer URI escapes canonical model root: ${uri}`);
        continue;
      }
      try {
        await stat(full);
      } catch {
        err(`${asset.id}: missing external buffer companion for ${relPath}: ${uri}`);
      }
    }
    for (const img of summary.images) {
      if (img.source === "external-uri") {
        const full = resolve(modelDir, decodeURIComponent(img.uri));
        if (!withinRoot(full)) {
          err(`${asset.id}: external image URI escapes canonical model root: ${img.uri}`);
          continue;
        }
        try {
          const texBuf = await readFile(full);
          if (texBuf.length === 0) err(`${asset.id}: external image companion is empty: ${img.uri}`);
        } catch {
          err(`${asset.id}: missing external image companion for ${relPath}: ${img.uri}`);
        }
      } else if (img.source === "embedded-bufferview" || img.source === "embedded-data-uri") {
        if (!img.dimensions) {
          warn(`${asset.id}: embedded image in ${relPath} could not be dimension-decoded (unsupported/unrecognised format, or corrupt)`);
        }
      }
    }

    if (summary.skinCount > 0) {
      const required = requirementsByAssetId.get(asset.id);
      if (required) {
        const have = new Set(summary.animationNames);
        const missing = required.filter((clip) => !have.has(clip));
        if (missing.length > 0) {
          err(`${asset.id}: missing required animation clip(s): ${missing.join(", ")}`);
        }
        result.requiredClipsChecked = required;
        result.requiredClipsMissing = missing;
      }
    }

    result.duplicateOf = duplicateGroups.find((g) => g.paths.includes(relPath))?.paths.filter((p) => p !== relPath) ?? [];
    modelResults.push(result);
  }

  for (const req of requirements.requirements || []) {
    if (!registry.some((a) => a.id === req.runtimeAssetId)) {
      warn(`animation-requirements.json references unknown runtime asset ID: ${req.runtimeAssetId}`);
    }
  }

  return { errors, warnings, modelResults, duplicateGroups, semanticReuseGroups, totalLibraryFiles: allFiles.length };
}

// --- CLI entrypoint ---
async function runCli() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const registryPath = resolve(scriptDirectory, "../src/registry.json");
  const requirementsPath = resolve(scriptDirectory, "../animation-requirements.json");
  const jsonOutputMode = process.argv.includes("--json");

  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  const requirements = JSON.parse(await readFile(requirementsPath, "utf8"));

  const result = await validateModels({
    modelRoot: MODEL_ROOT,
    registry,
    requirements,
    resolvePath: resolveModelPath,
  });

  if (jsonOutputMode) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    console.log("\n=== Model Technical Validation ===\n");
    if (result.duplicateGroups.length) {
      console.log(`Duplicate binary groups: ${result.duplicateGroups.length}`);
    }
    if (result.semanticReuseGroups.length) {
      console.log(`Intentional semantic reuse (one file, multiple runtime IDs): ${result.semanticReuseGroups.length}`);
      for (const g of result.semanticReuseGroups) console.log(`  - ${g.sourceFile} -> ${g.runtimeAssetIds.join(", ")}`);
    }
    if (result.errors.length > 0) {
      console.log(`\n❌ ERRORS (${result.errors.length}):`);
      result.errors.forEach((e) => console.log(`  - ${e}`));
    }
    if (result.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${result.warnings.length}):`);
      result.warnings.forEach((w) => console.log(`  - ${w}`));
    }
    if (result.errors.length === 0) {
      const modelCount = result.modelResults.filter((r) => r.format === "glb").length;
      console.log(`\n✅ Validated ${modelCount} file-backed registered models across ${result.totalLibraryFiles} files in the canonical library.`);
      console.log(`   ${result.warnings.length} warning(s). This does not constitute commercial-release licence approval.`);
    }
  }
  process.exit(result.errors.length > 0 ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await runCli();
