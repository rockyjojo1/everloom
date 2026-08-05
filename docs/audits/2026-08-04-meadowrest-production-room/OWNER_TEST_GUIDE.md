# Gate 4 Meadowrest Production Room — Owner Test Guide

## Deployed Branch

- **Branch:** `claude/meadowrest-production-room-bakeoff`
- **Implementation SHA:** `64359ce4d146804e28e30b5e5919bba63af9a0c2`
- **Deployment alias:** https://everloom-web-git-claude-meadowrest-production-ro-ac5979-rj-44cb.vercel.app

**Note:** `40fa44878bfb7105ed5d15f4ad406898a4b799e6` was reviewed and rejected
by independent supervisor re-audit — the Quality shadow policy wrongly
excluded all `cliff-*` placements, and grass clearance used partially
hardcoded coordinates instead of the actual layout. Both are fixed as of
the implementation SHA above; do not test against the rejected SHA.

## Test Profiles

The production room supports two rendering profiles: **Balanced** (cost-conscious, 60 FPS target on mid-range hardware) and **Quality** (visual fidelity-focused, 60 FPS target on high-end hardware).

### Balanced Profile

Desktop: https://everloom-web-git-claude-meadowrest-production-ro-ac5979-rj-44cb.vercel.app/?bakeoff=meadowrest&profile=balanced

Mobile (simulated): Use browser DevTools mobile emulation (iPhone 12 landscape) and load the same URL.

**Targets:**
- Load time: < 6000ms
- FPS: ≥ 50
- P95 frame time: ≤ 35ms

### Quality Profile

Desktop: https://everloom-web-git-claude-meadowrest-production-ro-ac5979-rj-44cb.vercel.app/?bakeoff=meadowrest&profile=quality

Mobile (simulated): Use browser DevTools mobile emulation (iPhone 12 landscape) and load the same URL.

**Targets:**
- Load time: < 8000ms
- FPS: ≥ 40
- P95 frame time: ≤ 50ms

## What to Test

### Visual Verification (both profiles)

- [ ] Player character visible and green-tinted
- [ ] Mara NPC visible near the cottage, brown-tinted, with shawl on torso
- [ ] Skeleton NPC visible
- [ ] Cottage placed north-west
- [ ] Bridge crossing the river (north)
- [ ] Campfire south-east
- [ ] River animating (water shader)
- [ ] Trees and rocks placed naturally
- [ ] Multiple distinct tree/rock assets (not all identical)
- [ ] Metrics overlay legible in top-right
- [ ] "Rotate to landscape" message appears in portrait mode
- [ ] No loading overlay remains visible
- [ ] No error messages in overlay
- [ ] No scrollbars visible

### Interaction Testing (Balanced profile recommended)

- [ ] Click on the ground → player walks toward click point
- [ ] Player animation changes from Idle to Walking_A while moving
- [ ] Player animation returns to Idle when arriving
- [ ] Multiple clicks in sequence cause smooth walk-to-walk transitions
- [ ] Clicking very close to player (< 0.5 units) doesn't cause movement
- [ ] Keyboard movement: W/ArrowUp moves forward, S/ArrowDown backward, A/ArrowLeft left, D/ArrowRight right
- [ ] Player movement respects room bounds (no walking off edges)
- [ ] "Reset view" button returns player to starting position (0, 0, -5 in world coords)
- [ ] Profile buttons (Balanced/Quality) cause page reload with new profile
- [ ] Metrics display shows real FPS (should be 50+ on desktop, 30+ on mobile emulation)

### Performance Monitoring

- [ ] FPS counter shows stable value (no rapid flickering)
- [ ] P95 frame time under target for chosen profile
- [ ] Load time under target
- [ ] No frame drops below 15 FPS (hard requirement)
- [ ] No long frames over 500ms (hard requirement)

### Mobile Emulation (portrait rotation)

- [ ] Load in portrait → "Rotate to landscape" message appears
- [ ] Overlay controls hidden in portrait
- [ ] Rotate device to landscape (or resize window to landscape) → room loads and becomes interactive
- [ ] Rotate back to portrait → overlay returns, controls hidden again

## Expected Capture Evidence

All measurements in this section come from automated browser/mobile-emulation capture. **Physical iPhone verification is a separate, not-yet-started gate.**

- **desktop-balanced.png** (1440×900): 60 FPS, 18ms P95, 83ms load
- **desktop-quality.png** (1440×900): 60 FPS, 18ms P95, 24ms load
- **iphone-landscape-balanced.png** (844×390): 60 FPS, 18ms P95, 13ms load
- **iphone-landscape-quality.png** (844×390): 60 FPS, 18ms P95, 17ms load
- **iphone-portrait-rotate.png** (390×844): No canvas, overlay only

All captures show:
- 0 failed assets (21/21 loaded)
- 0 page errors
- 0 console errors
- 0 model 404s
- WebGL renderer: ANGLE (Intel UHD Graphics Direct3D11) — confirms GPU rendering, not software fallback

Mechanical recommendation: **PROCEED_TO_CAPACITOR_BAKEOFF** — all hard requirements and balanced-profile soft targets pass.

## Known Limitations

- **Browser/emulation only:** All evidence above uses headless Chromium and mobile emulation, not a physical iPhone.
- **No Capacitor bake-off yet:** The recommendation to proceed is based on browser metrics. Actual native app performance may differ.
- **No owner visual review yet:** Screenshots have been machine-inspected against a checklist; owner review is pending.

## What This Gate Does NOT Include

- Physical iPhone testing
- Capacitor build or native compilation
- Verdant engine integration
- Advanced content beyond Meadowrest zone
- Offline simulation testing
- Accessibility/WCAG compliance
- Performance profiling on specific devices

These remain separate gates.
