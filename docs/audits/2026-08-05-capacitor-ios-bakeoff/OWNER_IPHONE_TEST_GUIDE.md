# Gate 5A: Owner iPhone Test Guide

This is the guide for actually installing and testing Everloom on your own
iPhone. Nothing in Gate 5A itself proves this works on a real device —
that proof can only come from you (or someone with a Mac and your Apple
ID) actually doing the steps below.

## What you need

- A Mac with Xcode 26 or newer installed (from the Mac App Store).
- An iPhone running iOS 15 or newer, connected by cable or on the same network as the Mac (for wireless debugging).
- Your Apple ID signed into Xcode (free "Personal Team" signing is enough for local testing — no paid Apple Developer Program membership is required just to install on your own device for development).

## Branch and commit to use

```
git fetch origin
git checkout claude/capacitor-ios-bakeoff
```

Use the exact final commit SHA recorded in the handoff message for this
gate (check `git log --oneline -5` after checkout — the top commit should
match "Record Gate 5A Capacitor verification evidence" or "Build Gate 5A
Capacitor iOS foundation").

## Step-by-step

1. **Install dependencies** (from the repository root):
   ```
   pnpm install --frozen-lockfile
   ```

2. **Build the web app and sync it into the iOS project:**
   ```
   pnpm --filter @everloom/game run build
   pnpm --filter @everloom/game run cap:sync:ios
   ```

3. **Open the Xcode project:**
   ```
   pnpm --filter @everloom/game run cap:open:ios
   ```
   This opens `apps/game/ios/App/App.xcodeproj` in Xcode. (There is no
   `.xcworkspace` — this project uses Swift Package Manager, not
   CocoaPods, so the `.xcodeproj` is the real entry point.)

4. **Select your iPhone as the run destination** in Xcode's toolbar
   (top-left device picker, next to the scheme name "App").

5. **Set up signing** (first time only): in Xcode, select the "App"
   project in the navigator → "App" target → "Signing & Capabilities" tab
   → choose your Apple ID under "Team". Xcode will automatically manage a
   free development provisioning profile.

6. **Trust the developer certificate on your iPhone** (first install
   only): after Xcode installs the app, if iOS refuses to open it, go to
   **Settings → General → VPN & Device Management** on the iPhone and
   trust your developer certificate.

7. **Run** (▶ button in Xcode, or `Cmd+R`). The app should build, install,
   and launch on your iPhone automatically.

## What to actually check

Please go through this list and note what happened for each item — even
"worked fine" is useful, but so is "X did not happen" or "Y looked wrong."
A results template is provided at `DEVICE_TEST_RESULTS_TEMPLATE.md` if you
want a structured place to record this.

1. **Installation** — did the app install without errors?
2. **First launch** — does it open to the character-creation/intro screen
   (or the game world, if a save already exists) without a crash or blank
   screen?
3. **Landscape orientation** — does the app stay in landscape and refuse
   to rotate into portrait? (It should — there is no portrait mode.)
4. **Touch movement** — does tapping/dragging in the world move the
   character the way it does in the browser version?
5. **Animation** — do character and world animations play smoothly, not
   frozen or stuttering?
6. **Meadowrest visual quality** — does the world look the same as the
   Gate 4 browser bake-off screenshots
   (`docs/audits/2026-08-04-meadowrest-production-room/screenshots/`) —
   same lighting, same grass, no missing models, no obvious visual glitch?
7. **Performance and heat after ~10 minutes** — does the phone get
   uncomfortably warm, does the frame rate visibly drop, does the app
   still feel responsive?
8. **Background and foreground recovery** — press the Home button (or
   swipe up) to background the app, wait a few seconds, then reopen it.
   Does it resume correctly, or does it reload from scratch / show a
   blank screen?
9. **Force-close and relaunch** — swipe the app away from the App
   Switcher (fully killing it), then reopen it from the Home Screen. Does
   your save still load correctly?
10. **Local save persistence** — make some progress (equip a tool, gather
    something), force-close the app, relaunch it, and confirm your
    progress is still there.
11. **Airplane-mode launch** — turn on Airplane Mode, then launch the app.
    Does it still open and work? (It should — everything is bundled
    locally, there is no required network dependency for offline single-
    player play. The optional cloud-account feature will obviously not
    work offline, and that is expected.)
12. **No network dependency** — related to the above: confirm normal
    gameplay does not stall or show errors waiting for a network request
    that never completes.
13. **Notch and safe-area behaviour** — on notched iPhones, does any UI
    element (buttons, panels, text) get cut off or hidden behind the
    notch/Dynamic Island or the home indicator bar?
14. **Audio behaviour** (if the build has any audio at this point) — does
    audio play, and does it respect the iPhone's silent switch/volume
    correctly?
15. **Uninstall/reinstall warning** — please note before you uninstall:
    deleting the app from your iPhone **will delete its local save data**
    (this is standard iOS app-storage behaviour, not specific to
    Everloom — IndexedDB inside a Capacitor WebView is deleted along with
    the rest of the app's sandboxed storage on uninstall). If you want to
    keep test progress, don't uninstall between test sessions; if you do
    uninstall, expect to start fresh.

## Known, already-documented limitations (not new bugs)

- **App icon and launch splash are Capacitor's default placeholder
  graphics** (a blue "cap" logo), not final Everloom branding. This is
  expected — see `GATE5A_IMPLEMENTATION_REPORT.md`.
- **No offline cloud sync** — the optional Supabase cloud-account feature
  requires network access and valid credentials; it is not expected to
  work in Airplane Mode, and that is by design, not a defect.
- **First launch starts with an empty save** — Capacitor's iOS WebView
  uses its own local origin (`capacitor://localhost`), which is separate
  from Safari's storage. If you previously tested the browser/PWA version
  on the same iPhone, the native app will **not** see that save data; it
  starts fresh. This is normal, expected behaviour for any Capacitor app,
  not something Gate 5A introduced as a bug.

## If something goes wrong

Please note exactly what you saw (a screenshot or screen recording helps
enormously), which step it happened at, your iPhone model, and your iOS
version. Report this back rather than trying to work around it yourself —
whether it's a real bug or an environment/signing issue determines what
needs fixing next.
