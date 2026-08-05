# Gate 5A: Verification Log

Complete record of every verification command run for the Capacitor iOS
foundation, with real output. All commands below were run from a Windows
(MINGW64) environment — there is no macOS/Xcode in this environment, so
native compilation is CI-only (see "Native build" section).

## Base and branch

- Base SHA (Gate 4 accepted, verified exact): `26f36e73b15a1c1e782ec3e4b8890c13ad53194a`
- Branch: `claude/capacitor-ios-bakeoff`
- `git rev-list --left-right --count HEAD...origin/claude/meadowrest-production-room-bakeoff` at branch creation: `0	0`

## Phase 1: starting-state verification

```
git fetch origin --prune
git branch --show-current       -> claude/meadowrest-production-room-bakeoff (before branching)
git rev-parse HEAD              -> 26f36e73b15a1c1e782ec3e4b8890c13ad53194a
git status --short              -> (empty, clean)
git rev-list --left-right --count HEAD...origin/claude/meadowrest-production-room-bakeoff -> 0	0
```

Working tree was clean; `git worktree list` and `git stash list` showed no
uncommitted or stashed work belonging to this repository that would be at
risk. New branch created with `git checkout -b claude/capacitor-ios-bakeoff`
from that exact commit — confirmed via `git rev-parse HEAD` immediately
after, which still equalled `26f36e73b15a1c1e782ec3e4b8890c13ad53194a`.

## Environment record (Phase 2)

```
node --version   -> v24.17.0
pnpm --version   -> 11.17.0
uname -a         -> MINGW64_NT-10.0-26200 DESKTOP-G1DHA5K 3.6.7-fb42d713.x86_64 2026-03-29 11:44 UTC x86_64 Msys
```

- macOS available: **no**
- Xcode available: **no** (`xcodebuild` not found on PATH)
- `gh` CLI available: **no**
- Apple signing identity: **none used**
- GitHub Actions enabled for this repository: not independently confirmed from this environment (no `gh`/API access in this session); the workflow is pushed and will run on the next matching event if enabled.

`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` latest versions
confirmed directly against the npm registry (`registry.npmjs.org`, not just
search-engine results) at the time of this pass: all three `8.5.0`.
Capacitor 8's documented requirements (Node 22+, Xcode 26.0+) were fetched
from `capacitorjs.com/docs/updating/8-0` and
`capacitorjs.com/docs/next/getting-started/environment-setup` during this
pass.

## Unit tests

```
pnpm --filter @everloom/game run test
```

Result: **EXIT 0**

```
 Test Files  10 passed (10)
      Tests  118 passed (118)
```

New this gate (32 tests, up from the Gate 4-accepted 86):
- `src/native/platform.test.ts` — 2 tests
- `src/native/serviceWorkerGuard.test.ts` — 7 tests
- `src/native/capacitorVerifyHelpers.test.ts` — 23 tests

## Typecheck

```
pnpm --filter @everloom/game run typecheck
```

Result: **EXIT 0**. Required adding
`apps/game/scripts/lib/capacitorVerifyHelpers.d.mts` alongside the plain-JS
helper module so `tsc --noEmit` could type-check the import from the new
Vitest test file without a build step for `scripts/`.

## Production build

```
pnpm --filter @everloom/game run build
```

Result: **EXIT 0**. Player entry bundle: 338.2 KiB / 400 KiB budget (was
329.6 KiB before this gate's `main.tsx` addition — the native-policy guard
adds under 9 KiB, still comfortably under budget).

## Gate 0 verification

```
pnpm --filter @everloom/game run verify:gate0
```

Result: **EXIT 0** — all five checks passed (unit tests, typecheck,
focused Worn Hatchet Playwright test, fresh production build,
production-exclusion assertions).

## Visual foundation verification

```
pnpm --filter @everloom/game run verify:visual-foundation
```

Result: **EXIT 0** — all 15 core stages passed. Baseline status unchanged:
PENDING, 0/10 captured (this is a fixed status line the verifier reports
for baseline capture, not a regression introduced by this gate).

## Gate 4 bake-off suite (regression proof that Gate 4 evidence is untouched)

```
pnpm --filter @everloom/game run test:bakeoff
```

Result: **EXIT 0**

```
9 skipped
39 passed (1.3m)
```

Identical to the accepted Gate 4 evidence (39 passed, 9 skipped by
project-aware filtering) — confirms this gate did not regress or alter any
Gate 4 test outcome.

## Model-delivery smoke test

```
pnpm --filter @everloom/game exec playwright test tests/model-delivery-smoke.spec.ts --project=desktop
```

Result: **EXIT 0** — 1 passed.

## PWA / native-policy suite

```
pnpm run test:pwa
```

(runs `pnpm run build` then
`playwright test tests/pwa-offline.spec.ts tests/capacitor-native-policy.spec.ts --config=playwright.pwa.config.ts`)

Result: **EXIT 0**

```
  ok 1 [pwa-desktop] capacitor-native-policy.spec.ts > simulated native platform: service worker registration is disabled
  ok 2 [pwa-desktop] capacitor-native-policy.spec.ts > simulated native platform: normal app behaviour is unaffected
  ok 3 [pwa-desktop] capacitor-native-policy.spec.ts > normal web platform: service worker registration still proceeds (regression guard)
  ok 4 [pwa-desktop] pwa-offline.spec.ts > the installed production game reopens offline with its world and save
  ok 5 [pwa-desktop] pwa-offline.spec.ts > production world-chunk recovery > a failed production world chunk leaves the save-safe recovery screen

  5 passed (44.3s)
```

The existing `pwa-offline.spec.ts` tests (unmodified) still pass —
confirms the native/web service-worker split did not regress the existing
browser/PWA offline behaviour.

## Capacitor iOS sync and static verification

```
pnpm --filter @everloom/game run cap:sync:ios
pnpm --filter @everloom/game run verify:capacitor:ios
```

Result: **EXIT 0** for both. Full verifier output:

```
OK:   capacitor.config.ts exists
OK:   appId is com.rockyjojo1.everloom
OK:   appName is Everloom
OK:   webDir is "dist"
OK:   capacitor.config.ts has no server.url block
OK:   capacitor.config.ts has no localhost/private-LAN address
OK:   dist/index.html exists
OK:   dist/assets contains at least one JS bundle
OK:   dist/assets contains at least one CSS bundle
OK:   dist bundle retains the Gate 4 authoritative-app marker
OK:   ios/ native project directory exists
OK:   Xcode project.pbxproj exists
OK:   All PRODUCT_BUNDLE_IDENTIFIER entries equal com.rockyjojo1.everloom
OK:   Info.plist exists
OK:   Info.plist UISupportedInterfaceOrientations declares both landscape orientations
OK:   Info.plist UISupportedInterfaceOrientations~ipad declares both landscape orientations
OK:   Synced native index.html exists
OK:   Synced index.html hash matches dist/index.html exactly
OK:   All 10 synced asset file(s) byte-match dist/assets exactly (sha256)
OK:   Synced ios capacitor.config.json has no server.url
OK:   No Android platform present
OK:   No protected path changed since Gate 4 base SHA 26f36e73b15a1c1e782ec3e4b8890c13ad53194a
OK:   apps/game/src/game/saveDb.ts is unchanged since Gate 4 base SHA 26f36e73b15a1c1e782ec3e4b8890c13ad53194a

0 failure(s), 0 warning(s).

Capacitor iOS verification passed.
```

## client3d package

```
pnpm --filter @everloom/client3d run test
```
Result: **EXIT 0** — 2/2 passed.

```
pnpm --filter @everloom/client3d run build
```
Result: **EXIT 0**.

## Root workspace

```
pnpm typecheck
```
Result: **EXIT 0** — 13 tasks (12 cached, 1 executed: `@everloom/game:typecheck`).

```
pnpm build
```
Result: **EXIT 0** — 8 tasks (7 cached, 1 executed: `@everloom/game:build`).

## Git hygiene

```
git diff --check
```
Result: **EXIT 0** (no whitespace errors; only benign line-ending
advisory warnings from Git on Windows, not failures — `apps/game/package.json`
and `pnpm-lock.yaml` will be normalized to CRLF on next touch per this
repo's existing line-ending configuration, unrelated to this gate).

## Native build

**A. Local macOS/Xcode compile:** not possible. No macOS, no Xcode, no
`xcodebuild` in this environment (Windows/MINGW64).

**B. GitHub Actions CI compile:** `.github/workflows/capacitor-ios.yml` was
created and pushed with this branch. It:
- triggers on `workflow_dispatch`, and on `push`/`pull_request` scoped to
  `claude/capacitor-ios-bakeoff` only (not unrelated branches);
- runs on `macos-26` (GitHub-hosted, GA since 2026-02-26, Xcode 26
  preinstalled — matches Capacitor 8's Xcode 26.0+ requirement);
- installs Node 22 and pnpm 11.17.0, runs `pnpm install --frozen-lockfile`;
- builds `apps/game`, syncs Capacitor iOS, runs the static verifier;
- performs an **unsigned** iOS Simulator compile
  (`CODE_SIGNING_ALLOWED=NO`, `-sdk iphonesimulator`,
  `-destination "generic/platform=iOS Simulator"`);
- verifies the built `.app`'s `CFBundleIdentifier` equals
  `com.rockyjojo1.everloom`;
- uploads the build log and `.app` bundle as a workflow artifact;
- never handles signing secrets and never deploys anywhere.

**Result of this run:** see the FINAL RESPONSE section of the handoff
message for whether this workflow had completed and what it reported by
the time this gate was handed off. If it had not yet completed or could
not run (Actions disabled, no runner availability, quota), that is stated
there explicitly — this section does not claim a simulator compile passed
unless the workflow's own logs prove it.

## Physical iPhone

**NOT ATTEMPTED.** No physical iPhone was connected to this environment at
any point in this gate. Nothing here should be read as physical-device
evidence. See `OWNER_IPHONE_TEST_GUIDE.md`.

## Summary

✅ 107 asset-package tests passed
✅ 118 game unit tests passed (32 new)
✅ Game typecheck passed
✅ Game production build passed (338.2 / 400 KiB budget)
✅ Gate 0 verification passed (5/5 stages)
✅ Visual foundation verification passed (15/15 core stages)
✅ Gate 4 bake-off suite unchanged: 39 passed, 9 skipped
✅ Model-delivery smoke test passed
✅ PWA + native-policy suite passed (5/5, including 3 new native-simulation tests)
✅ Capacitor iOS sync + static verifier passed (0 failures, 0 warnings)
✅ client3d tests and build passed
✅ Root typecheck and build passed
✅ `git diff --check` clean
⬜ iOS Simulator compile — CI-dependent, see "Native build" above
❌ Physical iPhone verification — NOT ATTEMPTED
❌ App Store submission — NOT STARTED
