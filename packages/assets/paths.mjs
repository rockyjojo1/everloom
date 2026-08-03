// Single source of truth for the canonical tracked model-binary root.
//
// packages/assets owns this location. apps/game, apps/client3d, the asset
// catalogue/validator scripts, and the art-direction source-path validator
// all resolve the same directory through this module instead of each
// hardcoding their own relative path to it.
//
// Plain ESM, Node built-ins only (no bundler-specific syntax) so this file
// can be imported unmodified from .mjs scripts and from Vite's Node-context
// TypeScript config files.
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve, sep } from "node:path";

/** Directory this file lives in: packages/assets */
const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the canonical tracked model-binary root. */
export const MODEL_ROOT = resolve(PACKAGE_ROOT, "models");

/** Absolute path to the repository root (two levels above packages/assets). */
export const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, "..", "..");

/** Repository-relative form of MODEL_ROOT, forward-slashed, for display/JSON use. */
export const MODEL_ROOT_RELATIVE = relative(REPOSITORY_ROOT, MODEL_ROOT).replaceAll("\\", "/");

/**
 * Resolve a registry sourceFile (e.g. "kenney-nature/tree_oak.glb") to an
 * absolute path under the canonical model root. Rejects any path that would
 * escape the root (defence against a malicious or malformed sourceFile).
 */
export function resolveModelPath(sourceFile) {
  const full = resolve(MODEL_ROOT, sourceFile);
  if (full !== MODEL_ROOT && !full.startsWith(MODEL_ROOT + sep)) {
    throw new Error(`sourceFile escapes the canonical model root: ${sourceFile}`);
  }
  return full;
}
