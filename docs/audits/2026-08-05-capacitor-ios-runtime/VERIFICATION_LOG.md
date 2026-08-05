# Gate 5B: Verification Log

## Base and branch

- Base SHA (Gate 5A accepted, verified exact): `2024830b518e892d0734d2664652dae0c08d0958`
- Branch: `claude/capacitor-ios-simulator-runtime`
- `git rev-list --left-right --count origin/claude/capacitor-ios-bakeoff...HEAD` at branch creation: `0 0`
- Implementation SHA whose runtime workflow passed (final, stable): `a6f456825d5d8d33679c61673b367633d2673989`

## Phase 0: starting-state verification

```
git fetch origin --prune
git checkout claude/capacitor-ios-bakeoff
git rev-parse HEAD                -> 2024830b518e892d0734d2664652dae0c08d0958
git status --short                -> (empty, clean)
git checkout -b claude/capacitor-ios-simulator-runtime
git rev-parse HEAD                -> 2024830b518e892d0734d2664652dae0c08d0958 (unchanged, confirming the new branch starts at the exact base)
git rev-list --left-right --count origin/claude/capacitor-ios-bakeoff...HEAD -> 0	0
```

## Local environment

- OS: Windows (MINGW64_NT-10.0-26200, Git Bash/MSYS) -- no macOS, no Xcode, no `xcodebuild`. XCUITest execution is CI-only.
- Node: v24.17.0, pnpm: 11.17.0 (both matching the repository's declared versions, unchanged from Gate 5A).

## Local regression commands (run against the Gate 5B branch; app/test code identical from `4429f54` through the final `a6f4568` -- only the launch-timeout constant changed between them)

```
pnpm install --frozen-lockfile
```
Result: **EXIT 0** (already up to date).

```
pnpm --filter @everloom/game run test
```
Result: **EXIT 0** -- 10 test files, **118/118 tests passed** (unchanged from Gate 5A; no TypeScript/JavaScript source changed in any Gate 5B commit -- only Swift, YAML, and the one narrowly-scoped `.mjs` verifier change).

```
pnpm --filter @everloom/game run typecheck
```
Result: **EXIT 0**.

```
pnpm --filter @everloom/game run build
```
Result: **EXIT 0** -- Player entry bundle 338.2 KiB / 400 KiB budget (unchanged).

```
pnpm --filter @everloom/game run test:pwa
```
Result: **EXIT 0** -- 5/5 passed (`capacitor-native-policy.spec.ts` ×3, `pwa-offline.spec.ts` ×2), confirming Gate 5A's native-vs-web service-worker policy is unaffected.

```
pnpm --filter @everloom/game run test:bakeoff
```
Result: **EXIT 0** -- **39 passed, 9 skipped, 0 failed** (project-aware filtering, not failures) -- identical to the accepted Gate 4/5A evidence, confirming no regression.

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
OK:   All PRODUCT_BUNDLE_IDENTIFIER entries are within the allowed set [com.rockyjojo1.everloom, com.rockyjojo1.everloom.AppUITests]
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
```

Note: the PRODUCT_BUNDLE_IDENTIFIER check now correctly allows the new
`AppUITests` target's ID (`com.rockyjojo1.everloom.AppUITests`) alongside
the app's own ID -- this is the one narrowly-scoped change made to
`verify-capacitor-ios.mjs` for this gate.

```
pnpm --filter @everloom/assets run verify
```
Result: **EXIT 0** -- 107/107 tests passed.

```
pnpm --filter @everloom/client3d run test
pnpm --filter @everloom/client3d run build
```
Result: **EXIT 0** for both -- 2/2 tests passed, build clean.

```
pnpm typecheck
```
Result: **EXIT 0** -- 13 tasks (12 cached, 1 executed: `@everloom/game:typecheck`).

```
pnpm build
```
Result: **EXIT 0** -- 8 tasks (7 cached, 1 executed: `@everloom/game:build`).

```
git diff --check
```
Result: **EXIT 0** (only benign CRLF-normalization advisory warnings, not failures).

## Protected-path and regression checks (against base SHA `2024830b518e892d0734d2664652dae0c08d0958`)

```
git diff --stat 2024830b518e892d0734d2664652dae0c08d0958 -- \
  packages/core/ packages/content/ packages/assets/ packages/engine/ packages/gamedata/ \
  apps/game/src/game/ apps/game/src/world/ apps/game/src/bakeoff/ \
  apps/client3d/ apps/web/ \
  docs/audits/2026-08-04-meadowrest-production-room/ \
  docs/audits/2026-08-05-deterministic-expedition-kernel/ \
  docs/audits/2026-08-05-capacitor-ios-bakeoff/ \
  artifacts/ art-direction/ pnpm-lock.yaml
```
Result: **empty diff, exit 0** -- zero changes across every prohibited/protected path.

```
git diff --stat 2024830b518e892d0734d2664652dae0c08d0958 -- apps/game/src/game/saveDb.ts apps/game/src/game/store.ts
```
Result: **empty diff** -- both files byte-identical to the base SHA.

```
git diff --stat 2024830b518e892d0734d2664652dae0c08d0958 -- .github/workflows/capacitor-ios.yml
```
Result: **empty diff** -- the existing accepted Gate 5A workflow is untouched; Gate 5B added a separate `capacitor-ios-runtime.yml` instead.

```
find apps/game -maxdepth 1 -iname android
```
Result: **no output** -- no Android platform was introduced.

```
grep -n "server.url\|server:" apps/game/capacitor.config.ts
```
Result: only the pre-existing explanatory comment stating the config
deliberately omits `server.url` -- no live/remote server configuration
exists anywhere.

## CI: GitHub Actions runtime workflow

Workflow: `.github/workflows/capacitor-ios-runtime.yml`, job `iOS Simulator
runtime + XCUITest journey`.

### Attempts 1-6 (all on earlier commits, all failed for genuine, diagnosed reasons -- see GATE5B_RUNTIME_REPORT.md "Why 9 CI runs were needed to reach a stable pass")

| Run ID | SHA | Result | Root cause |
|---|---|---|---|
| 30970977278 | `73635b7` | failure | Exit code masked by default `set -e`; real xcodebuild failure was `isHittable` false-negative on Enter Meadowrest |
| 30971618713 | `f609516` | failure | `typeText()` before genuine keyboard focus |
| 30972186157 | `e332438` | failure | Pack panel tap not registering (WebGL-mount timing theory, later shown incomplete) |
| 30973368932 | `591658e` | failure | Same Pack-panel symptom persisted even with retry -- deeper cause not yet found |
| 30974415135 | `e3ed985` | failure | `Hud` renders unconditionally under the still-open character creator; HUD-presence was not proof of entry |
| 30974847156 | `fa489e3` | failure | `tripleTap()` compile error (invented API) |

### Attempt 7 (passed, code-complete)

**Run ID:** 30976961883
**URL:** https://github.com/rockyjojo1/everloom/actions/runs/30976961883
**Head SHA:** `4429f54d74fcc6f8f3fbda33d0cecca12ae4f51a`
**Conclusion:** `success`

All 23 job steps succeeded, including:

```
Set up job                                     success
Checkout                                       success
Setup Node                                     success
Setup pnpm                                     success
Install dependencies (frozen lockfile)         success
Build apps/game                                success
Sync Capacitor iOS                             success
Run accepted Gate 5A static verifier           success
Report macOS, Xcode and Simulator runtime info success
Select an available iOS runtime and iPhone device type  success
Create and boot the Gate 5B simulator          success
Mark log-collection start time                 success
Run XCUITest journey                           success
Extract test summary from .xcresult            success
Extract screenshot attachments from .xcresult  success
Collect simulator system/app logs for the tested window  success
Search for Everloom crash reports              success
Shut down and delete the Gate 5B simulator     success
Fail the job if the XCUITest run did not pass  success
Upload Gate 5B evidence                        success
```

Real log excerpts (fetched via the GitHub Actions API, authenticated with
the `git-credential-manager` OAuth token already used for `git push` in
this session -- unauthenticated API calls cannot read job logs):

```
Test Suite 'AppUITests' started at 2026-08-05 05:10:29.386.
...
Test Suite 'AppUITests' passed at 2026-08-05 05:13:28.985.
	 Executed 1 test, with 0 failures (0 unexpected) in 179.591 (179.599) seconds
** TEST SUCCEEDED **
Captured xcodebuild test exit code: 0
```

Environment (from the "Report macOS, Xcode and Simulator runtime info"
and "Select an available iOS runtime and iPhone device type" steps'
actual output):

```
ProductName:            macOS
ProductVersion:         26.5.2
Xcode 26.6 (Build 17F113)
Selected runtime: com.apple.CoreSimulator.SimRuntime.iOS-26-5
Selected device type name: iPhone 17 Pro
Selected device type: com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro
Created simulator: Gate5B-30976961883-1 (0FF60F50-8FAE-48DD-A9A5-3164845C7DCA)
```

Crash search:
```
No crash reports found for com.rockyjojo1.everloom.
```
(the job would have failed at the "Search for Everloom crash reports"
step had any been found -- it did not).

Warnings: only the pre-existing, known-benign `"Metadata extraction
skipped. No AppIntents.framework dependency found."` message (printed
twice, once per Swift target build) -- this is Xcode's own
AppIntents-metadata-processor noting the app has no App Intents, not a
code-quality warning, and the workflow explicitly does not treat it as a
failure signal.

Artifact: `everloom-gate5b-ios-runtime`, 64,383,944 bytes, artifact ID
`8918804972`, containing `xcodebuild-test.log`, the full `.xcresult`
bundle, `test-summary.json`, `environment-info.txt`,
`simulator.logarchive`, and `crash-report-search.txt`. Retained 14 days.

### Attempts 8-9 (docs-only evidence commit and a manual re-run of the same SHA, both failed on CI-runner launch timing)

After committing `71ae3ac` (Gate 5B evidence/docs -- no app or test code
changed from the passing `4429f54`), CI was re-run on that exact SHA to
confirm the evidence commit was clean, per this gate's own instruction to
verify CI on the final evidence SHA.

| Run ID | Trigger | Result | Detail |
|---|---|---|---|
| 30978021086 | `push` of `71ae3ac` | failure | Phase A: `"Who washed ashore?"` did not appear within the then-30s `launchTimeout`, on byte-identical app/test code that had just passed |
| 30978650087 | manual `workflow_dispatch` re-run of the exact same `71ae3ac` SHA | failure | Same assertion, same 30s timeout, same result -- confirming this was CI-runner timing variance on a cold simulator boot, not a code regression (nothing had changed) |

Both re-runs were triggered via the GitHub Actions API
(`POST /repos/rockyjojo1/everloom/actions/workflows/{id}/dispatches`)
authenticated with the same `git-credential-manager` OAuth token used
throughout this session -- not a manual cancellation, and not a
fabricated result; both are genuine, logged CI failures that informed the
real fix in `a6f4568` (see attempt 10 below).

### Attempt 10 (final, stable, passing)

**Run ID:** 30979283286
**URL:** https://github.com/rockyjojo1/everloom/actions/runs/30979283286
**Head SHA:** `a6f456825d5d8d33679c61673b367633d2673989` (`launchTimeout` raised 30s → 60s)
**Conclusion:** `success`

```
Test Suite 'AppUITests' started at 2026-08-05 05:56:xx
...
Test Suite 'AppUITests' passed
	 Executed 1 test, with 0 failures (0 unexpected) in 220.212 (220.226) seconds
** TEST SUCCEEDED **
Captured xcodebuild test exit code: 0
```

Environment (same runner class as before):

```
ProductVersion:         26.5.2
Xcode 26.6 (Build 17F113)
Selected runtime: com.apple.CoreSimulator.SimRuntime.iOS-26-5
Selected device type name: iPhone 17 Pro
Created simulator: Gate5B-30979283286-1 (78668796-3499-456F-929F-797A7870B477)
```

Crash search: `No crash reports found for com.rockyjojo1.everloom.`

This is the final implementation SHA for Gate 5B:
`a6f456825d5d8d33679c61673b367633d2673989`.

## Vercel

The `Vercel Preview Comments` check reported success for this branch's
pushes throughout (checked via `GET
/repos/rockyjojo1/everloom/commits/{sha}/check-runs`), consistent with
Gate 5A -- this gate made no change to anything Vercel builds.

## Summary

✅ 118/118 game unit tests
✅ Game typecheck and production build clean
✅ 5/5 PWA + native-policy tests
✅ 39 passed / 9 skipped / 0 failed Gate 4 bake-off suite (unchanged)
✅ Capacitor iOS sync + static verifier: 0 failures, 0 warnings
✅ 107/107 asset-package tests
✅ client3d tests and build clean
✅ Root typecheck and build clean
✅ `git diff --check` clean
✅ Zero diff across every protected/prohibited path since the Gate 5A base SHA
✅ `saveDb.ts` and `store.ts` byte-identical to the base SHA
✅ Existing `capacitor-ios.yml` untouched
✅ No Android platform, no `server.url`, no live-reload address
✅ GitHub Actions runtime workflow: **success** on the final implementation SHA `a6f456825d5d8d33679c61673b367633d2673989` (run [30979283286](https://github.com/rockyjojo1/everloom/actions/runs/30979283286)) -- 1 test executed, 0 failures, full lifecycle + persistence journey proven. Two intermediate CI runs on the prior, functionally-identical SHA `71ae3ac` failed on CI-runner launch-timing variance (a too-tight 30s timeout, not a defect) -- see the "Attempts 8-9" section above
❌ Physical iPhone verification -- NOT ATTEMPTED
❌ TestFlight / App Store submission -- NOT STARTED
