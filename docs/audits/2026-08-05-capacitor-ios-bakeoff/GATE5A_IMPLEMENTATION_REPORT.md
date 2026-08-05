# Gate 5A: Capacitor iOS Foundation

**Status:**
```
GATE 5A CAPACITOR FOUNDATION: COMPLETE
IOS SIMULATOR BUILD: PASS
PHYSICAL IPHONE VERIFICATION: NOT STARTED
GATE 5 ACCEPTANCE: PENDING OWNER DEVICE TEST
APP STORE SUBMISSION: NOT STARTED
```

This report covers Capacitor iOS *foundation* work only: integrating
Capacitor into the existing `apps/game` monorepo, generating and
configuring a committed native iOS project, and static/simulator-level
verification. It is explicitly **not**:

- App Store submission (not started, not attempted);
- physical iPhone verification (not started — no physical device was
  connected or tested in this pass);
- a claim that Capacitor is the final iPhone platform decision — that
  still requires the physical-device evidence listed in
  `docs/authority/TECHNICAL_ARCHITECTURE.md` ("Evidence required before
  reconsidering the stack").

## Distinct claims (do not conflate these)

| Claim | Status |
|---|---|
| Capacitor configured | ✅ Done — `capacitor.config.ts`, no `server.url`, SPM-based iOS platform added |
| Web bundle synced | ✅ Done — `cap sync ios` copies `dist/` into `ios/App/App/public`, verified byte-identical (sha256) |
| Static verifier passed | ✅ Done — `verify:capacitor:ios`, 0 failures, 0 warnings |
| iOS simulator compiled | ✅ Done — unsigned, via GitHub Actions on `macos-26`/Xcode 26 (run [30968977638](https://github.com/rockyjojo1/everloom/actions/runs/30968977638), conclusion: success); bundle ID verified in-workflow |
| Physical iPhone installed | ❌ NOT STARTED |
| Physical iPhone tested | ❌ NOT STARTED |
| App Store submission | ❌ NOT STARTED |

## Base and branch

- Accepted Gate 4 branch: `claude/meadowrest-production-room-bakeoff`
- Required exact base SHA: `26f36e73b15a1c1e782ec3e4b8890c13ad53194a`
- New branch: `claude/capacitor-ios-bakeoff`, created via `git checkout -b` from that exact SHA (verified: `git rev-parse HEAD` before any commit equalled the base SHA exactly; working tree was clean; 0/0 divergence from `origin/claude/meadowrest-production-room-bakeoff`).

## Environment

- OS: Windows (MINGW64_NT-10.0-26200, MSYS/Git Bash) — **not macOS**.
- Node: v24.17.0 (local dev/build). CI pins Node 22 (Capacitor 8's documented minimum) via `actions/setup-node`.
- pnpm: 11.17.0 (matches the repository's `packageManager` field exactly).
- Xcode: **not available locally** (no macOS). CI uses the `macos-26` GitHub-hosted runner, which has Xcode 26 preinstalled (macOS 26 runners have been GA since 2026-02-26 and became the `macos-latest` default from June 2026).
- Apple signing identity: none available or used anywhere in this gate. All builds are unsigned.
- GitHub Actions availability: not independently confirmed from this environment (no `gh` CLI, no web access to repository settings in this session). The workflow file is pushed and will run automatically on the next matching push/PR event if Actions are enabled for the repository — see "Native build" below for what to do if it does not.

## Version decision

Current official Capacitor documentation (fetched during this pass) states:

- Capacitor 8 requires Node.js 22+.
- Capacitor 8 requires Xcode 26.0+.
- Swift Package Manager (SPM) is the default iOS dependency manager as of Capacitor 8, replacing CocoaPods (which entered maintenance mode in August 2024).

Installed exact versions (all three pinned identically, not mixed):

```
@capacitor/core  8.5.0
@capacitor/cli   8.5.0
@capacitor/ios   8.5.0
```

These were the latest published versions on npm at the time of this pass
(verified directly against the npm registry, not just search results).
Node 22+ is satisfied by both the local environment (v24.17.0) and the CI
runner. Xcode 26.0+ is not available locally, hence the CI-only native
build path (Phase 7B in the task, not 7A).

No CocoaPods was added — the generated project uses `ios/App/CapApp-SPM`
(a local Swift package, `Package.swift`) instead of a `Podfile` or
`.xcworkspace`. This matches Capacitor 8's default and requires no
`pod install` step in CI.

No broad Node or monorepo toolchain upgrade was performed to reach these
versions; the existing repository Node/pnpm setup already satisfied
Capacitor 8's requirements.

## Configuration

- App name: `Everloom`
- Bundle ID: `com.rockyjojo1.everloom`
- `webDir`: `dist` (the existing, unmodified `apps/game` Vite build output — same `dist/` that Gate 4's browser bake-off and the existing PWA build both already produce)
- No `server.url`, no live-reload address, no cleartext remote-content configuration anywhere in `capacitor.config.ts` or the synced `ios/App/App/capacitor.config.json` (asserted by the static verifier, see below).
- `backgroundColor: "#17241f"` on both the root config and the `ios` block — matches the existing PWA manifest's `theme_color`/`background_color` (`apps/game/vite.config.ts`), so the native shell and the browser/PWA installs share one dark background instead of introducing a second colour decision.
- iOS platform only. No `android/` directory was created (verified explicitly by the static verifier).

### iOS project configuration

- `IPHONEOS_DEPLOYMENT_TARGET = 15.0` (Xcode-generated default for this Capacitor version).
- `Info.plist`: `UISupportedInterfaceOrientations` and the `~ipad` variant were both edited to declare **only** `UIInterfaceOrientationLandscapeLeft` and `UIInterfaceOrientationLandscapeRight` — the generated default also included `UIInterfaceOrientationPortrait` (and, for iPad, `PortraitUpsideDown`), which was removed because the product has no portrait gameplay (Gate 4's own web build shows a "Turn to landscape" prompt in portrait rather than supporting portrait play). Also added `UIStatusBarHidden = true` and `UIRequiresFullScreen = true` for a full-bleed landscape game view.
- `Base.lproj/LaunchScreen.storyboard`: the generated default used `systemBackgroundColor` (white in light mode) behind the splash image, which would show as a white flash before the WebView paints. Changed to an explicit `#17241f` RGB colour (same value as the PWA theme colour) so the launch screen background matches the app's actual background instead of flashing white.
- **App icon and splash image are Capacitor's stock template graphics** (`AppIcon-512@2x.png`, `splash-2732x2732*.png` — the default blue Capacitor logo). These are placeholders, not final Everloom art. Per `docs/authority/RISKS.md` ("Placeholder sprawl"), this is being explicitly labelled here rather than left silent: replacing them requires approved Everloom brand art, which is outside this gate's file ownership (`art-direction/**` is a protected path for this gate) and outside its scope (native-shell foundation, not visual identity work).

### Service worker: native vs. web

The existing PWA build (`vite-plugin-pwa`, `registerType: "autoUpdate"`)
unconditionally injects a `<script src="/registerSW.js">` into every build
— there is no build-time flag to omit it for a native target, since the
native and browser targets share one `dist/` output by design (Gate 5A
does not want two separate builds to keep in sync).

Layering that service worker's cache-first strategy on top of Capacitor's
own native WebView asset pipeline would be a second, independent caching
system with no demonstrated benefit and a real risk: after a native app
*update* ships new bundled assets, a stale Workbox-cached response could
still be served from the old cache, since Capacitor's own versioning
(new binary, freshly synced assets) and Workbox's cache invalidation
(driven by build-hash filenames, `cleanupOutdatedCaches`) are two
unrelated systems that have never been tested together.

**Decision:** disable service worker registration when running natively,
leave it untouched on the web.

**Implementation:**
- `apps/game/src/native/platform.ts` — `isNativePlatform()`, a one-line wrapper around `Capacitor.isNativePlatform()`.
- `apps/game/src/native/serviceWorkerGuard.ts` — `applyServiceWorkerPlatformPolicy()`, a pure function that replaces `navigator.serviceWorker.register` with a silent no-op and proactively unregisters any existing registrations, only when `isNative` is true. On web it does nothing and returns the original `register` function untouched.
- `apps/game/src/main.tsx` calls this **before** `ReactDOM.createRoot(...).render(...)`. This ordering matters: `registerSW.js`'s own registration call is wrapped in a `window.addEventListener('load', ...)` listener, which fires strictly after the entry module has already executed (module scripts are deferred, but the `load` event additionally waits for every sub-resource — images, stylesheets — to finish loading). So by the time `load` fires and `registerSW.js`'s listener runs, `main.tsx` has already patched `navigator.serviceWorker.register` into a no-op.
- `@capacitor/core`'s real native-detection logic was inspected directly (`node_modules/@capacitor/core/dist/index.js`): it checks for `window.webkit.messageHandlers.bridge` (iOS) or `window.androidBridge` (Android), with `window.CapacitorCustomPlatform` as an explicit override hook. `apps/game/tests/capacitor-native-policy.spec.ts` uses that override hook via `page.addInitScript` to make the *real* `@capacitor/core` package believe it is running on iOS inside an ordinary Playwright browser context — this is not a fake/mocked test, it exercises the actual shipped code path.

## Automated coverage added this gate

**Unit tests (Vitest, 32 new — 86 → 118 total in `pnpm --filter @everloom/game run test`; the 86 base includes the 9 added in the accepted Gate 4 pass):**
- `src/native/platform.test.ts` (2 tests) — `isNativePlatform()` reflects `Capacitor.isNativePlatform()` in both directions, via `vi.mock("@capacitor/core")`.
- `src/native/serviceWorkerGuard.test.ts` (7 tests) — no-op replacement, existing-registration unregistration, absence-of-`getRegistrations` safety, and all three branches of `applyServiceWorkerPlatformPolicy` (native/web/unavailable).
- `src/native/capacitorVerifyHelpers.test.ts` (23 tests) — every pure text-analysis helper used by the static verifier (`scripts/lib/capacitorVerifyHelpers.mjs`): config-field extraction, `server.url` detection, live-reload address detection (localhost/loopback/private-LAN/`ws://`), bundle-identifier extraction, Info.plist orientation-array extraction, rejected-SHA detection, authoritative-marker detection.

**Playwright (3 new, run via `pnpm run test:pwa` against the production preview build, not the dev server):**
- `tests/capacitor-native-policy.spec.ts`:
  1. Simulated native platform → zero service worker registrations after load.
  2. Simulated native platform → normal app boot/play flow (Enter Meadowrest → world ready) is unaffected by the native flag.
  3. Regression guard: normal web platform → service worker registration still proceeds as before (protects against ever accidentally disabling it for real browser/PWA users).

**Static verifier (`apps/game/scripts/verify-capacitor-ios.mjs`, run via `pnpm --filter @everloom/game run verify:capacitor:ios`):** see `VERIFICATION_LOG.md` for the full, exact check list and output. Summary of what it hard-fails on:
- `capacitor.config.ts` missing, or `appId`/`appName`/`webDir` not exactly `com.rockyjojo1.everloom` / `Everloom` / `dist`.
- Any `server.url` block, or any localhost/loopback/private-LAN/`ws://` address, anywhere in `capacitor.config.ts` or the synced `ios/App/App/capacitor.config.json`.
- `dist/index.html` or `dist/assets` missing, or missing a JS/CSS bundle.
- The Gate 4 authoritative-app marker (`data-everloom-authoritative-app`) absent from the built JS bundle.
- The rejected Gate 4 SHA (`40fa44878bfb7105ed5d15f4ad406898a4b799e6`) referenced anywhere in the config or built bundle.
- `ios/App/App.xcodeproj/project.pbxproj` missing, or any `PRODUCT_BUNDLE_IDENTIFIER` not exactly `com.rockyjojo1.everloom`.
- `Info.plist` missing either required landscape orientation for iPhone or iPad.
- The synced `ios/App/App/public/index.html` or any synced asset file not byte-identical (sha256) to the corresponding `dist/` file.
- An `android/` directory present.
- Any change to a protected Gate 4/Gate 6A path since the Gate 4 base SHA (`git diff --name-only 26f36e73b15a1c1e782ec3e4b8890c13ad53194a`).
- Any change to `apps/game/src/game/saveDb.ts` since that same base SHA (Gate 5A reviews persistence, it does not rewrite it).

## What was NOT done (explicitly out of scope / not claimed)

- **Physical iPhone verification.** No physical device was connected. Nothing about touch behaviour, real memory/thermal performance, background/resume lifecycle, or save persistence across a real app termination has been proven. See `OWNER_IPHONE_TEST_GUIDE.md` for exactly what the owner needs to do next.
- **App Store submission, TestFlight, or any distribution step.** Not started, not attempted, no signing identity used anywhere.
- **Replacing the app icon/splash placeholder art.** Documented above; needs approved brand art from `art-direction/`, out of this gate's ownership.
- **Android.** Explicitly out of scope for Gate 5A per the task instructions; the static verifier hard-fails if an `android/` directory is ever introduced.
- **Rewriting or "improving" the save system.** `apps/game/src/game/saveDb.ts` is unchanged (verified by hash/diff, not just "we didn't mean to touch it"). Capacitor's iOS WebView uses a `capacitor://localhost` origin; IndexedDB is origin-scoped, so the existing `everloom-local` database will be a fresh, empty database the first time the native app runs — this is expected and normal for any Capacitor app (it does **not** share IndexedDB storage with Safari or any other origin), not a defect introduced by this gate. This is documented for the owner in `OWNER_IPHONE_TEST_GUIDE.md`.

## Native build

See `VERIFICATION_LOG.md` for exact commands/output and the honest final status line.
