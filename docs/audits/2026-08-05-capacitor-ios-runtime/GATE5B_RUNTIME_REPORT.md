# Gate 5B: Real iOS Simulator Runtime, Lifecycle and Local-Save Persistence Proof

**Status:**
```
GATE 5B IOS SIMULATOR RUNTIME: COMPLETE
SIMULATOR NATIVE UI JOURNEY: PASS
SIMULATOR BACKGROUND/RESUME: PASS
SIMULATOR TERMINATE/RELAUNCH: PASS
SIMULATOR LOCAL-SAVE PERSISTENCE: PASS
PHYSICAL IPHONE VERIFICATION: NOT STARTED
FULL GATE 5 ACCEPTANCE: PENDING OWNER DEVICE TEST
TESTFLIGHT: NOT STARTED
APP STORE SUBMISSION: NOT STARTED
MERGE: NOT PERFORMED
```

This gate proves the committed Capacitor app actually installs, launches,
and remains functional inside a real, booted iOS Simulator, and that the
existing local (IndexedDB) save survives backgrounding and a genuine
native process termination/relaunch -- all inside one real, ordered
XCUITest journey against the real production web bundle in the real
Capacitor WKWebView. It does **not** constitute physical-device
verification, and it does not begin TestFlight or App Store work.

## Base and branch

- Accepted Gate 5A branch: `claude/capacitor-ios-bakeoff`
- Required exact base SHA: `2024830b518e892d0734d2664652dae0c08d0958`
- New branch: `claude/capacitor-ios-simulator-runtime`, created via `git checkout -b` from that exact commit (verified: `git rev-parse HEAD` immediately after equalled the base SHA exactly; clean working tree; `git rev-list --left-right --count origin/claude/capacitor-ios-bakeoff...HEAD` was `0 0`).

## Commits (all pushed to `claude/capacitor-ios-simulator-runtime`)

| SHA | Message | Why |
|---|---|---|
| `73635b7` | Add Gate 5B iOS simulator runtime tests | Initial implementation: `AppUITests` target, shared scheme, `capacitor-ios-runtime.yml`, static-verifier bundle-ID allowance |
| `f609516` | Fix XCUITest tap reliability and CI exit-code capture | First CI run diagnosis: a coordinate-tap fallback for `isHittable == false`, and a workflow bug that silently discarded the real xcodebuild exit code |
| `e332438` | Fix WKWebView text-field keyboard-focus timing | Second CI run: `typeText()` needs genuine keyboard focus, which can lag a moment behind `tap()` |
| `591658e` | Add tap-retry resilience for HUD panel interactions | Third CI run: added a bounded single retry for panel-opening taps |
| `e3ed985` | Fix the real root cause: Hud renders behind the still-open character creator | Fourth CI run, diagnosed from the actual downloaded `.xcresult` accessibility-tree dump: `Hud` renders unconditionally once a save exists, so HUD-control presence was never proof entry worked; fixed by requiring the character creator to actually disappear |
| `fa489e3` | Fix compile error: XCUIElement has no tripleTap() API | Fifth CI run: a build-time Swift compile error from an invented API |
| `2172c3a` | Fix device-orientation rotation glitch causing wrong tap coordinates | Sixth CI run: a downloaded failure screenshot showed the WKWebView content rendered sideways; added `ensureLandscapeOrientation()` after launch/activate (later shown not to be the actual root cause, but kept as a harmless reinforcement) |
| `4429f54` | Fix the actual root cause: Enter Meadowrest is scrolled below the fold | Seventh CI run, diagnosed from a second downloaded accessibility-tree dump: the character-creation form is taller than the 402pt-tall landscape viewport, and `'Enter Meadowrest'` sits below the fold (`y=456` in a `{874, 402}` window) -- `isHittable == false` was accurate, not a WKWebView quirk, and the coordinate-tap fallback was targeting a point that was never on screen. Fixed with `scrollUntilHittable()`, a real swipe-up gesture. This exact commit's CI run ([30976961883](https://github.com/rockyjojo1/everloom/actions/runs/30976961883)) passed. |
| `71ae3ac` | Record Gate 5B simulator runtime evidence | Evidence/docs commit for `4429f54`. Re-running CI on this exact (docs-only, functionally identical) SHA to confirm the evidence commit itself was clean surfaced a genuine timing flake: two separate re-runs both failed at Phase A's very first assertion (30s launch timeout), never reached by the earlier passing run of the byte-identical app/test code |
| **`a6f4568`** | **Increase launch timeout for CI simulator boot variance** | Root-caused the flake as a too-tight 30s timeout for a cold-booted CI simulator's first app launch (JIT warmup + cold WebView + parsing/executing the JS bundle), not a real app defect -- the identical code had both passed and failed the same assertion. Raised `launchTimeout` from 30s to 60s; does not weaken what is asserted. **This is the final implementation SHA whose CI run passed: [30979283286](https://github.com/rockyjojo1/everloom/actions/runs/30979283286).** |

**Implementation SHA (CI passed on this exact commit): `a6f456825d5d8d33679c61673b367633d2673989`**

The correction history above is preserved rather than squashed, per this
project's standing practice (see the Gate 4/5A correction histories) --
every failed CI attempt was diagnosed from real evidence (logs, and twice
from downloaded `.xcresult` accessibility-tree dumps), not guessed at or
weakened past.

## Why 9 CI runs were needed to reach a stable pass

Every failure was a genuine, different root cause, each confirmed from
real CI evidence (never assumed):

1. **Masked exit code** -- a GitHub Actions bash step's default `set -eo pipefail` caused the script to abort before it ever wrote the real xcodebuild exit code to `$GITHUB_OUTPUT`, so the first failure carried zero diagnostic information.
2. **Keyboard-focus timing** -- `typeText()` requires genuine focus; tapping a WKWebView `<input>` and typing immediately afterward can race WebKit's own focus-and-keyboard-surface sequence.
3. **Transient tap flakiness after a heavy WebGL mount** -- added a bounded single retry as standard UI-test resilience (this one turned out not to be the real Enter-Meadowrest blocker, but the retry itself is legitimate and kept).
4. **`Hud` renders unconditionally, even under the still-open character creator** -- discovered directly from a downloaded accessibility-tree dump showing both the HUD dock buttons and the character-creator form's elements coexisting in one snapshot. `apps/game/src/App.tsx` gates `WorldBoundary`/`GameWorld` and `EscapeIntro` on `!intro`, but not `<Hud />`. This made the test's original "HUD control exists" check meaningless as proof of successful entry.
5. **Invented API** -- `XCUIElement.tripleTap()` does not exist; a real compile error.
6. **A red-herring orientation screenshot** -- a captured screenshot showed rotated/glitched content, which looked like a device-orientation bug. The fix (re-asserting orientation post-launch) was applied and is harmless, but did not resolve the actual failure.
7. **The real root cause** -- a second downloaded accessibility-tree dump showed the Window's own accessibility frame was `{874, 402}` while `'Enter Meadowrest'` sat at `y=456`: genuinely below the visible viewport, in a form confirmed scrollable by a `"Vertical scroll bar, 1 page"` element in the same dump. `isHittable == false` was reporting the truth. The coordinate-tap fallback (added in round 2 for a different, legitimate WKWebView quirk) was blindly tapping that same off-screen point every time. Fixed with a real swipe-up gesture (`scrollUntilHittable()`) before tapping. This run passed.
8. **CI-runner launch-timing variance** -- re-running the exact same passing, unchanged app/test code (via the docs-only evidence commit, then again via `workflow_dispatch` on that same SHA) failed twice in a row on the very first assertion (30s launch timeout), which the earlier run of the identical code had cleared comfortably. A too-tight timeout for a cold-booted simulator's first app launch, not a defect. Raised `launchTimeout` 30s → 60s.

Diagnosis for rounds 4 and 7 required downloading and reading the actual
`.xcresult` bundle's exported accessibility-tree text attachments via the
GitHub Actions API, authenticated with the OAuth token already stored by
the local `git-credential-manager` (the same credential already used for
`git push` in this session) -- job logs alone were not sufficient to
explain *why* the panel wasn't opening; only inspecting the real on-device
UI hierarchy at the failure moment did.

## What the passing test actually proves

`testEverloomNativeLifecycleAndPersistenceJourney`, one ordered journey
(not several order-dependent methods), against a fresh simulator
installation:

- **Phase A -- fresh native launch:** the real production web bundle loads inside a real Capacitor WKWebView; the fresh-install character creator (`"Who washed ashore?"`, the `"Character name"` field, `"Enter Meadowrest"`) is visible via real accessibility queries; the app is not blank or showing its fatal-error screen.
- **Phase B -- real user entry:** the name field is genuinely focused and edited via real keyboard synthesis; `"Enter Meadowrest"` is scrolled into view and tapped; the character creator's actual disappearance (not merely HUD-control presence, which is not sufficient proof -- see round 4 above) is asserted as the real signal that entry completed; the HUD's `Pack`/`Skills`/`Thread`/`Options`/`HP` controls are then confirmed present; `Pack` is tapped, the panel opens (`"Close panel"` appears), and is closed again.
- **Phase C -- background and foreground:** the app is genuinely backgrounded (`XCUIDevice.shared.press(.home)`) and reactivated (`app.activate()`); the HUD is still present and a second panel (`Skills`) opens and closes, proving touch handling survived the real lifecycle transition.
- **Phase D -- terminate and relaunch:** the native process is genuinely terminated (`app.terminate()`) and relaunched (`app.launch()`) with no seeding or storage rewriting; the fresh character creator does **not** reappear (proving the local IndexedDB save persisted across a real process termination, inside this simulator installation); the HUD returns and a control remains tappable.

**Scope of the persistence claim:** this proves simulator-installation
persistence across a real process termination/relaunch. It does **not**
prove physical-iPhone persistence, and it does not prove anything about
migration between a Safari/PWA save and a Capacitor-native save (they are
different storage origins by design -- see Gate 5A's
`OWNER_IPHONE_TEST_GUIDE.md`).

## CI environment (from the passing run's own logs)

- Runner: `macos-26`
- macOS: `26.5.2`
- Xcode: `26.6` (Build 17F113)
- iOS Simulator runtime selected (dynamically, not hardcoded): `com.apple.CoreSimulator.SimRuntime.iOS-26-5`
- Device type selected (dynamically, preferring the newest available "iPhone \* Pro"): `com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro` ("iPhone 17 Pro")
- Simulator created: `Gate5B-30979283286-1`, UDID `78668796-3499-456F-929F-797A7870B477` (ephemeral -- created, used, and deleted within the workflow run)
- Signing: none anywhere in the workflow (`CODE_SIGNING_ALLOWED=NO`, `CODE_SIGNING_REQUIRED=NO`, `CODE_SIGN_IDENTITY=""`)

See `VERIFICATION_LOG.md` and `SIMULATOR_TEST_RESULTS.md` for the exact
commands, exact test counts, and full workflow-step results.

## File ownership discipline

Every change stayed within the allowed paths for this gate:

- `.github/workflows/capacitor-ios-runtime.yml` (new; the existing accepted `capacitor-ios.yml` was never touched)
- `apps/game/ios/App/App.xcodeproj/**` (new `AppUITests` target + shared scheme)
- `apps/game/ios/App/AppUITests/**` (new)
- `apps/game/scripts/verify-capacitor-ios.mjs` (one narrowly scoped change: the bundle-identifier check now allows the new UI-test target's ID alongside the app's own ID)
- `docs/audits/2026-08-05-capacitor-ios-runtime/**` (new)
- `docs/authority/CURRENT_STATE.md`, `TECHNICAL_ARCHITECTURE.md`, `RISKS.md` (narrow updates)

No dependency was added. `apps/game/package.json` was not modified (no
new script was genuinely needed -- the workflow invokes `xcodebuild test`
directly). `pnpm-lock.yaml`, `apps/game/src/game/saveDb.ts`,
`apps/game/src/game/store.ts`, every Gate 4/5A evidence directory, and
`packages/core`/`content`/`assets`/`engine`/`gamedata`,
`apps/client3d`, `apps/web`, `artifacts/`, and `art-direction/` are all
verified byte-identical to the Gate 5A base SHA -- see
`VERIFICATION_LOG.md` for the exact `git diff --stat` commands and their
(empty) output. No `android/` directory exists. No `server.url` or
live-reload address was introduced anywhere.

## What remains unproven

- **Physical iPhone verification.** Not attempted. No physical device was connected anywhere in this gate.
- **App Store submission, TestFlight, or any distribution step.** Not started.
- **Real backgrounding memory/thermal behaviour on real hardware.** The Simulator does not model this; only a physical device can.
- **Real touch-latency/haptics feel.** The Simulator's synthetic touch events prove functional correctness, not tactile quality.
- **App icon / launch-screen art.** Still Capacitor's stock placeholder graphics, as documented in Gate 5A; unchanged and out of this gate's scope.
