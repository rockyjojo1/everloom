# Gate 5B: Simulator Test Results

Real results from the passing CI run. This is Simulator evidence, not
physical-device evidence -- see `docs/audits/2026-08-05-capacitor-ios-bakeoff/OWNER_IPHONE_TEST_GUIDE.md`
for what still needs a real iPhone.

## Run identification

- GitHub Actions run: [30979283286](https://github.com/rockyjojo1/everloom/actions/runs/30979283286) (final, stable pass)
- Head SHA: `a6f456825d5d8d33679c61673b367633d2673989`
- Runner: `macos-26`, macOS `26.5.2`, Xcode `26.6` (Build 17F113)
- Simulator: `Gate5B-30979283286-1`, iPhone 17 Pro, iOS 26.5, UDID `78668796-3499-456F-929F-797A7870B477` (ephemeral -- created and deleted within the run)
- XCUITest command: `xcodebuild test -project App.xcodeproj -scheme App -destination "id=78668796-3499-456F-929F-797A7870B477" -resultBundlePath gate5b.xcresult CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=""`

Note: an earlier run on the functionally-identical SHA `4429f54`
([30976961883](https://github.com/rockyjojo1/everloom/actions/runs/30976961883))
also passed with the same journey and the same phase results below; two
runs of the same code between them ([30978021086](https://github.com/rockyjojo1/everloom/actions/runs/30978021086),
[30978650087](https://github.com/rockyjojo1/everloom/actions/runs/30978650087))
failed on CI-runner launch-timing variance alone (the app's very first
cold launch exceeding the then-30s timeout), not a functional defect --
see `VERIFICATION_LOG.md` "Attempts 8-9". `launchTimeout` was raised to
60s in `a6f4568`, and this run is the stable result reported below.

## Test counts

- Tests executed: **1** (`AppUITests.testEverloomNativeLifecycleAndPersistenceJourney`)
- Passed: **1**
- Failed: **0**
- Skipped: **0**
- Duration: 220.212 seconds
- `xcodebuild` exit code: **0**
- Result line: `Test Suite 'AppUITests' passed ... Executed 1 test, with 0 failures (0 unexpected) in 220.212 (220.226) seconds`
- `** TEST SUCCEEDED **`

## Phase-by-phase results

| Phase | Assertion | Result |
|---|---|---|
| A: Fresh launch | `"Who washed ashore?"` heading appears within 30s | ✅ PASS |
| A: Character creator usable | `"Character name"` field and `"Enter Meadowrest"` control both found | ✅ PASS |
| A: Not a fatal/blank state | `"The thread snagged."` fatal-error text absent | ✅ PASS |
| B: Real text entry | Name field genuinely focused (system keyboard confirmed present) and edited via real key synthesis | ✅ PASS |
| B: Enter Meadowrest interaction | Scrolled into view and tapped | ✅ PASS |
| B: Entry actually completed | Character creator (`"Who washed ashore?"`) genuinely disappeared -- not just HUD-control presence | ✅ PASS |
| B: HUD ready | `Pack`/`Skills`/`Thread`/`Options`/`HP` all present | ✅ PASS |
| B: HUD interaction | `Pack` tapped → panel opens (`"Close panel"` appears) → closed again | ✅ PASS |
| C: Background | `XCUIDevice.shared.press(.home)`, held 3s | ✅ PASS (no crash, no hang) |
| C: Foreground resume | `app.activate()` → HUD (`Pack`) still present within 30s | ✅ PASS |
| C: Touch handling survives lifecycle | `Skills` tapped after resume → panel opens → closed | ✅ PASS |
| D: Terminate | `app.terminate()` | ✅ PASS (clean termination, no crash) |
| D: Relaunch | `app.launch()` | ✅ PASS |
| D: Save persisted | Character creator does **not** reappear after relaunch | ✅ PASS |
| D: World/save reloaded correctly | HUD (`Pack`) returns within 30s | ✅ PASS |
| D: Post-relaunch interactivity | `Pack` tapped after relaunch → panel opens → closed | ✅ PASS |

## Screenshots / attachments

Per Xcode's own test-attachment lifecycle policy, `XCTAttachment` images
attached with `.keepAlways` are retained in the `.xcresult` bundle
regardless of pass/fail; on a passing run the four explicitly named
attachments (`01-fresh-native-launch`, `02-meadowrest-world-ready`,
`03-background-resume`, `04-terminated-relaunched-save-present`) are
present inside `gate5b.xcresult`, uploaded as part of the
`everloom-gate5b-ios-runtime` artifact (75,397,595 bytes, artifact ID
`8919724797`, run 30979283286, 14-day retention). Individual screenshot
files were not separately extracted for this document since the
`.xcresult` bundle itself is the durable, complete evidence artifact.

## Crash and warning summary

- Crash reports matching the Everloom bundle: **none found** (both the host `~/Library/Logs/DiagnosticReports` and the simulator's own `CrashReporter` directory were searched; the workflow step would have failed the job had any match been found).
- Compiler/build warnings: only the pre-existing, known-benign `"Metadata extraction skipped. No AppIntents.framework dependency found."` (printed once per Swift module build target -- not a code-quality issue, and the workflow explicitly does not treat it as a failure signal per the task's own instruction).

## What this does NOT prove

- Physical iPhone behaviour of any kind (touch feel, real thermal/battery behaviour, real notch/Dynamic Island rendering, real background-suspension timing under real memory pressure).
- Persistence across an actual app **uninstall**/reinstall (this journey only proves persistence across process termination within the same installation -- an uninstall deletes the app's sandboxed storage entirely, by design, on both Simulator and real devices).
- Anything about TestFlight or App Store distribution.
- Migration or shared storage between a Safari/PWA save and this native Capacitor save (they are different storage origins by design).

See `docs/audits/2026-08-05-capacitor-ios-bakeoff/OWNER_IPHONE_TEST_GUIDE.md`
and `DEVICE_TEST_RESULTS_TEMPLATE.md` for what the owner still needs to do
on a real device before full Gate 5 acceptance.
