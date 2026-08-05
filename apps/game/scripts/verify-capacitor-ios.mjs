// Static, fail-fast verifier for the Gate 5A Capacitor iOS foundation.
// Exits non-zero on any hard failure. Run after `pnpm run build` and
// `pnpm run cap:sync:ios` -- see package.json `verify:capacitor:ios`.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  containsAuthoritativeMarker,
  containsLiveReloadAddress,
  containsShaReference,
  extractBundleIdentifiers,
  extractConfigField,
  extractOrientationList,
  hasServerUrlBlock,
} from "./lib/capacitorVerifyHelpers.mjs";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const EXPECTED_APP_ID = "com.rockyjojo1.everloom";
const EXPECTED_APP_NAME = "Everloom";
const EXPECTED_WEB_DIR = "dist";
const REJECTED_GATE4_SHA = "40fa44878bfb7105ed5d15f4ad406898a4b799e6";
const REQUIRED_ORIENTATIONS = ["UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"];
const FORBIDDEN_ORIENTATION = "UIInterfaceOrientationPortrait";

const PROTECTED_PATH_PREFIXES = [
  "packages/core/",
  "packages/content/",
  "packages/assets/",
  "docs/audits/2026-08-05-deterministic-expedition-kernel/",
  "docs/audits/2026-08-04-meadowrest-production-room/",
  "apps/game/src/bakeoff/",
  "artifacts/",
  "art-direction/",
  "apps/client3d/",
  "apps/web/",
];

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`WARN: ${message}`);
}

function pass(message) {
  console.log(`OK:   ${message}`);
}

function read(path) {
  return readFileSync(path, "utf8");
}

function sha256OfFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

// --- 1. capacitor.config.ts exists and declares the expected identity ---

const configPath = resolve(appRoot, "capacitor.config.ts");
if (!existsSync(configPath)) {
  fail("capacitor.config.ts does not exist at apps/game/capacitor.config.ts");
} else {
  const configSource = read(configPath);
  pass("capacitor.config.ts exists");

  const appId = extractConfigField(configSource, "appId");
  if (appId === EXPECTED_APP_ID) pass(`appId is ${EXPECTED_APP_ID}`);
  else fail(`appId is "${appId}", expected "${EXPECTED_APP_ID}"`);

  const appName = extractConfigField(configSource, "appName");
  if (appName === EXPECTED_APP_NAME) pass(`appName is ${EXPECTED_APP_NAME}`);
  else fail(`appName is "${appName}", expected "${EXPECTED_APP_NAME}"`);

  const webDir = extractConfigField(configSource, "webDir");
  if (webDir === EXPECTED_WEB_DIR) pass(`webDir is "${EXPECTED_WEB_DIR}"`);
  else fail(`webDir is "${webDir}", expected "${EXPECTED_WEB_DIR}"`);

  if (hasServerUrlBlock(configSource)) fail("capacitor.config.ts declares a server.url block (live-reload/remote wiring)");
  else pass("capacitor.config.ts has no server.url block");

  if (containsLiveReloadAddress(configSource)) fail("capacitor.config.ts references a localhost/loopback/private-LAN address");
  else pass("capacitor.config.ts has no localhost/private-LAN address");

  if (containsShaReference(configSource, REJECTED_GATE4_SHA)) fail(`capacitor.config.ts references the rejected Gate 4 SHA ${REJECTED_GATE4_SHA}`);
}

// --- 2. Built dist/ exists and looks real ---

const distDir = resolve(appRoot, "dist");
const distIndexPath = resolve(distDir, "index.html");
if (!existsSync(distIndexPath)) {
  fail("dist/index.html does not exist -- run `pnpm run build` first");
} else {
  pass("dist/index.html exists");
  const distAssetsDir = resolve(distDir, "assets");
  if (!existsSync(distAssetsDir)) {
    fail("dist/assets does not exist");
  } else {
    const assetFiles = readdirSync(distAssetsDir);
    const hasJs = assetFiles.some((f) => f.endsWith(".js"));
    const hasCss = assetFiles.some((f) => f.endsWith(".css"));
    if (hasJs) pass("dist/assets contains at least one JS bundle");
    else fail("dist/assets contains no JS bundle");
    if (hasCss) pass("dist/assets contains at least one CSS bundle");
    else fail("dist/assets contains no CSS bundle");

    const jsContent = assetFiles
      .filter((f) => f.endsWith(".js"))
      .map((f) => read(resolve(distAssetsDir, f)))
      .join("\n");
    if (containsAuthoritativeMarker(jsContent)) pass("dist bundle retains the Gate 4 authoritative-app marker");
    else fail("dist bundle is missing the Gate 4 authoritative-app marker (data-everloom-authoritative-app)");

    if (containsShaReference(jsContent, REJECTED_GATE4_SHA)) fail(`dist bundle references the rejected Gate 4 SHA ${REJECTED_GATE4_SHA}`);
  }
}

// --- 3. iOS native project exists ---

const iosDir = resolve(appRoot, "ios");
const iosAppDir = resolve(iosDir, "App");
const pbxprojPath = resolve(iosAppDir, "App.xcodeproj", "project.pbxproj");
const infoPlistPath = resolve(iosAppDir, "App", "Info.plist");
const nativeIndexPath = resolve(iosAppDir, "App", "public", "index.html");

if (!existsSync(iosDir)) {
  fail("apps/game/ios does not exist -- run `npx cap add ios` first");
} else {
  pass("ios/ native project directory exists");
}

if (!existsSync(pbxprojPath)) {
  fail("ios/App/App.xcodeproj/project.pbxproj does not exist");
} else {
  pass("Xcode project.pbxproj exists");
  const pbxprojSource = read(pbxprojPath);
  const bundleIds = extractBundleIdentifiers(pbxprojSource);
  if (bundleIds.length === 0) {
    fail("No PRODUCT_BUNDLE_IDENTIFIER found in project.pbxproj");
  } else if (bundleIds.every((id) => id === EXPECTED_APP_ID)) {
    pass(`All PRODUCT_BUNDLE_IDENTIFIER entries equal ${EXPECTED_APP_ID}`);
  } else {
    fail(`PRODUCT_BUNDLE_IDENTIFIER mismatch: found [${bundleIds.join(", ")}], expected all "${EXPECTED_APP_ID}"`);
  }
}

if (!existsSync(infoPlistPath)) {
  fail("ios/App/App/Info.plist does not exist");
} else {
  pass("Info.plist exists");
  const plistSource = read(infoPlistPath);

  for (const key of ["UISupportedInterfaceOrientations", "UISupportedInterfaceOrientations~ipad"]) {
    const orientations = extractOrientationList(plistSource, key);
    const missing = REQUIRED_ORIENTATIONS.filter((o) => !orientations.includes(o));
    if (missing.length > 0) {
      fail(`Info.plist ${key} is missing required orientation(s): ${missing.join(", ")}`);
    } else {
      pass(`Info.plist ${key} declares both landscape orientations`);
    }
    if (orientations.includes(FORBIDDEN_ORIENTATION)) {
      warn(`Info.plist ${key} still declares ${FORBIDDEN_ORIENTATION}; product requires no portrait gameplay`);
    }
  }
}

// --- 4. Synced iOS web assets exist and match the current build ---

const nativePublicDir = resolve(iosAppDir, "App", "public");
if (!existsSync(nativeIndexPath)) {
  fail("ios/App/App/public/index.html does not exist -- run `pnpm run cap:sync:ios` first");
} else {
  pass("Synced native index.html exists");

  if (existsSync(distIndexPath)) {
    const distHash = sha256OfFile(distIndexPath);
    const nativeHash = sha256OfFile(nativeIndexPath);
    if (distHash === nativeHash) {
      pass("Synced index.html hash matches dist/index.html exactly");
    } else {
      fail("Synced ios/App/App/public/index.html does not byte-match dist/index.html -- run `pnpm run cap:sync:ios` again");
    }
  }

  const distAssetsDir = resolve(distDir, "assets");
  const nativeAssetsDir = resolve(nativePublicDir, "assets");
  if (existsSync(distAssetsDir) && existsSync(nativeAssetsDir)) {
    const distFiles = readdirSync(distAssetsDir).sort();
    const nativeFiles = readdirSync(nativeAssetsDir).sort();
    const missingInNative = distFiles.filter((f) => !nativeFiles.includes(f));
    const extraInNative = nativeFiles.filter((f) => !distFiles.includes(f));
    if (missingInNative.length === 0 && extraInNative.length === 0) {
      const mismatched = distFiles.filter(
        (f) => sha256OfFile(resolve(distAssetsDir, f)) !== sha256OfFile(resolve(nativeAssetsDir, f))
      );
      if (mismatched.length === 0) {
        pass(`All ${distFiles.length} synced asset file(s) byte-match dist/assets exactly (sha256)`);
      } else {
        fail(`Synced asset(s) do not byte-match dist/assets: ${mismatched.join(", ")}`);
      }
    } else {
      if (missingInNative.length > 0) fail(`Assets missing from synced ios copy: ${missingInNative.join(", ")}`);
      if (extraInNative.length > 0) fail(`Unexpected extra assets in synced ios copy: ${extraInNative.join(", ")}`);
    }
  }
}

const nativeConfigPath = resolve(iosAppDir, "App", "capacitor.config.json");
if (existsSync(nativeConfigPath)) {
  const nativeConfigSource = read(nativeConfigPath);
  if (hasServerUrlBlock(nativeConfigSource) || /"url"\s*:/.test(nativeConfigSource)) {
    fail("Synced ios capacitor.config.json declares a server.url");
  } else {
    pass("Synced ios capacitor.config.json has no server.url");
  }
  if (containsLiveReloadAddress(nativeConfigSource)) {
    fail("Synced ios capacitor.config.json references a localhost/loopback/private-LAN address");
  }
}

// --- 5. No Android platform introduced ---

const androidDir = resolve(appRoot, "android");
if (existsSync(androidDir)) {
  fail("apps/game/android exists -- Gate 5A is iOS-only, do not add Android in this gate");
} else {
  pass("No Android platform present");
}

// --- 6. Protected paths untouched (git diff against the Gate 4 base) ---

const GATE4_BASE_SHA = "26f36e73b15a1c1e782ec3e4b8890c13ad53194a";
try {
  const diffOutput = execFileSync("git", ["diff", "--name-only", GATE4_BASE_SHA], {
    cwd: resolve(appRoot, "..", ".."),
    encoding: "utf8",
  });
  const changedFiles = diffOutput.split("\n").filter(Boolean);
  const protectedChanges = changedFiles.filter((file) => PROTECTED_PATH_PREFIXES.some((prefix) => file.startsWith(prefix)));
  if (protectedChanges.length > 0) {
    fail(`Protected Gate 4/6A paths changed since ${GATE4_BASE_SHA}: ${protectedChanges.join(", ")}`);
  } else {
    pass(`No protected path changed since Gate 4 base SHA ${GATE4_BASE_SHA}`);
  }

  // --- 7. Save-database code untouched (this gate reviews persistence, it does not rewrite it) ---
  const SAVE_DB_PATH = "apps/game/src/game/saveDb.ts";
  if (changedFiles.includes(SAVE_DB_PATH)) {
    fail(`${SAVE_DB_PATH} was modified in this gate -- Gate 5A must not rewrite the save system`);
  } else {
    pass(`${SAVE_DB_PATH} is unchanged since Gate 4 base SHA ${GATE4_BASE_SHA}`);
  }
} catch (error) {
  warn(`Could not run git diff against ${GATE4_BASE_SHA} to check protected paths: ${error.message}`);
}

// --- Summary ---

console.log(`\n${failures.length} failure(s), ${warnings.length} warning(s).`);
if (failures.length > 0) {
  console.error("\nCapacitor iOS verification FAILED.");
  process.exit(1);
}
console.log("\nCapacitor iOS verification passed.");
