// Pure, dependency-free text-analysis helpers for verify-capacitor-ios.mjs.
// Kept plain-JS/ESM (no TypeScript syntax) so the verifier script can import
// them directly with plain Node, while still being unit-testable from
// Vitest via apps/game/src/native/capacitorVerifyHelpers.test.ts.

/** Extracts a `field: "value"` string literal from a config source (capacitor.config.ts or the synced JSON). Returns null if not found. */
export function extractConfigField(source, fieldName) {
  const match = source.match(new RegExp(`["']?${fieldName}["']?\\s*:\\s*["']([^"']*)["']`));
  return match ? match[1] : null;
}

/** True if the source declares a `server: { ... url: ... }` block (live-reload / remote-content wiring). */
export function hasServerUrlBlock(source) {
  return /\bserver\s*:\s*\{[^}]*\burl\b\s*:/s.test(source);
}

const PRIVATE_LAN_PATTERN =
  /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/;

/** True if the text contains a localhost, loopback, private-LAN, or ws:// address -- the signature of a live-reload/dev-server wiring left in committed config. */
export function containsLiveReloadAddress(source) {
  const lowered = source.toLowerCase();
  return (
    lowered.includes("localhost") ||
    lowered.includes("127.0.0.1") ||
    lowered.includes("ws://") ||
    PRIVATE_LAN_PATTERN.test(source)
  );
}

/** Extracts every `PRODUCT_BUNDLE_IDENTIFIER = ...;` value from an Xcode .pbxproj, deduplicated. */
export function extractBundleIdentifiers(pbxprojSource) {
  const matches = [...pbxprojSource.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/g)];
  const values = matches.map((m) => m[1].trim());
  return [...new Set(values)];
}

/** Extracts the ordered list of orientation strings under a given Info.plist key (e.g. "UISupportedInterfaceOrientations"). */
export function extractOrientationList(plistSource, keyName) {
  const escapedKey = keyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockMatch = plistSource.match(new RegExp(`<key>${escapedKey}</key>\\s*<array>([\\s\\S]*?)</array>`));
  if (!blockMatch) return [];
  return [...blockMatch[1].matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]);
}

/** True if the given SHA string appears anywhere in the text. */
export function containsShaReference(text, sha) {
  return text.includes(sha);
}

/** True if the Gate 4 authoritative-app runtime marker survived the build/copy pipeline. */
export function containsAuthoritativeMarker(text) {
  return text.includes("data-everloom-authoritative-app");
}
