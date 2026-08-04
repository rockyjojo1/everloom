// Single source of truth for the canonical tracked model-binary root, and
// the one safe path-containment helper every consumer must use instead of
// reimplementing its own `startsWith(root)` check.
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
import { dirname, isAbsolute, relative, resolve } from "node:path";

/** Directory this file lives in: packages/assets */
const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the canonical tracked model-binary root. */
export const MODEL_ROOT = resolve(PACKAGE_ROOT, "models");

/** Absolute path to the repository root (two levels above packages/assets). */
export const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, "..", "..");

/** Repository-relative form of MODEL_ROOT, forward-slashed, for display/JSON use. */
export const MODEL_ROOT_RELATIVE = relative(REPOSITORY_ROOT, MODEL_ROOT).replaceAll("\\", "/");

/**
 * Safely resolve `relativePath` beneath `root`, rejecting anything that
 * would escape it. This is the one containment check every consumer
 * (Vite middleware, validators, the catalogue) must use — do not
 * reimplement `startsWith(root)` anywhere else.
 *
 * A naive `resolved.startsWith(root)` check is broken for a sibling-prefix
 * collision: root `/tmp/models` and an attempted path resolving to
 * `/tmp/models-escape/secret.glb` both start with the string
 * `/tmp/models`, even though the second is a completely different,
 * uncontained directory. This function instead computes
 * `path.relative(root, resolved)` and rejects any result that is empty
 * (bare-root case, handled separately via `allowRoot`), starts with `..`,
 * or is itself absolute (Windows can produce an absolute `relative()`
 * result when the two paths are on different drives).
 *
 * @param {string} root absolute directory the result must stay within
 * @param {string} relativePath the untrusted candidate path (already
 *   URL-decoded by the caller if it came from a request)
 * @param {{allowRoot?: boolean}} [options] `allowRoot` (default true)
 *   permits `relativePath` to resolve to `root` itself.
 * @returns {string} the resolved absolute path
 * @throws {Error} if `relativePath` is invalid or would escape `root`
 */
export function resolvePathWithinRoot(root, relativePath, options = {}) {
  const { allowRoot = true } = options;

  if (typeof relativePath !== "string") {
    throw new Error(`path must be a string, got ${typeof relativePath}`);
  }
  if (relativePath.includes("\0")) {
    throw new Error(`path contains a NUL byte: ${JSON.stringify(relativePath)}`);
  }
  // Absolute paths (POSIX "/foo", Windows "C:\foo" / "C:/foo") and
  // Windows drive-relative paths ("\foo", "C:foo") are never a legitimate
  // relative sourceFile/URI — reject them outright rather than letting
  // path.resolve() silently discard `root` and jump to an attacker-chosen
  // absolute location.
  if (isAbsolute(relativePath) || /^[A-Za-z]:/.test(relativePath) || /^[\\/]/.test(relativePath)) {
    throw new Error(`path must be relative, got an absolute or drive-relative path: ${JSON.stringify(relativePath)}`);
  }

  const resolvedRoot = resolve(root);
  const full = resolve(resolvedRoot, relativePath);
  const rel = relative(resolvedRoot, full);

  if (rel === "") {
    if (!allowRoot) {
      throw new Error(`path resolves to the root itself, which is not permitted here: ${JSON.stringify(relativePath)}`);
    }
    return full;
  }
  if (rel === ".." || rel.startsWith(`..${"/"}`) || rel.startsWith(`..\\`) || isAbsolute(rel)) {
    throw new Error(`path escapes the allowed root: ${JSON.stringify(relativePath)} (root: ${resolvedRoot})`);
  }
  return full;
}

/**
 * Resolve a registry sourceFile (e.g. "kenney-nature/tree_oak.glb") to an
 * absolute path under the canonical model root. Rejects any path that would
 * escape the root (defence against a malicious or malformed sourceFile).
 */
export function resolveModelPath(sourceFile) {
  try {
    return resolvePathWithinRoot(MODEL_ROOT, sourceFile, { allowRoot: false });
  } catch (e) {
    throw new Error(`sourceFile escapes the canonical model root: ${sourceFile}`);
  }
}
