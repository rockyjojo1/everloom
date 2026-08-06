# Gate 5A: Physical Device Test Results

Copy this template and fill it in after testing on a real iPhone, per
`OWNER_IPHONE_TEST_GUIDE.md`. Leave any section blank/marked "not tested"
rather than guessing — an honest "did not test" is more useful than a
filled-in field that isn't actually true.

## Device and build identification

- Tester:
- Date:
- Device model (e.g. iPhone 15 Pro):
- iOS version (Settings → General → About):
- Xcode version used to build:
- Repository commit SHA tested (`git rev-parse HEAD` on the Mac that built it):
- Signing method used (Personal Team / paid Developer Program):

## Checklist results

For each item, record: **PASS**, **FAIL**, or **NOT TESTED**, plus a short
note. Screenshots/recordings are welcome as attachments alongside this
file.

| # | Item | Result | Notes |
|---|------|--------|-------|
| 1 | Installation | | |
| 2 | First launch | | |
| 3 | Landscape orientation (no portrait) | | |
| 4 | Touch movement | | |
| 5 | Animation | | |
| 6 | Meadowrest visual quality matches Gate 4 screenshots | | |
| 7 | Performance/heat after ~10 minutes | | |
| 8 | Background → foreground recovery | | |
| 9 | Force-close → relaunch | | |
| 10 | Local save persistence across relaunch | | |
| 11 | Airplane-mode launch | | |
| 12 | No network dependency for core gameplay | | |
| 13 | Notch / safe-area behaviour | | |
| 14 | Audio behaviour (if applicable) | | |
| 15 | Uninstall/reinstall data-loss warning acknowledged | | |

## Overall verdict

- [ ] All items PASS — Gate 5 physical-device evidence requirement satisfied
- [ ] Some items FAIL — list which ones and whether they block Gate 5 acceptance
- [ ] Testing incomplete

## Anything else observed

(Free text — anything that doesn't fit the checklist above: visual
glitches, unexpected crashes, confusing UX, performance concerns, etc.)
