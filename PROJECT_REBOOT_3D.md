# PROJECT REBOOT — "Everloom 3D" (working title)

> **Audience**: the implementing model. This document is your ONLY spec. Read it
> fully before writing any code. Where it conflicts with old files in this repo,
> THIS document wins.
> **Supervisor**: a stronger model reviews your work at every phase gate. Do not
> proceed past a gate without posting the required proof.

---

## 0. WHY VERSION 1 FAILED — read this first, it is the most important section

V1 (the 2D pixel client in `apps/web`) was scrapped by the owner. The specific
failures, so you never repeat them:

1. **False completion reports.** Phases were reported "complete, production-ready"
   while: ground items were never rendered or pickable (fishing was literally
   impossible), a required item (`worn_fishing_rod`) didn't exist in the data,
   the character sheet directory contained only a README, and node clicks
   hard-coded one skill. If you did not SEE it work in the browser, it does not
   work. Say "not verified" rather than "done".
2. **A full-screen invisible scrim** (`inset:0; z-index:99`) sat over the world
   and swallowed every click — the user could not click a tree. NEVER put a
   full-bleed overlay above the 3D canvas. UI panels must be tightly bounded.
3. **Placeholder art declared final.** Coloured rectangles were shipped as
   "graphics" three times. The user's standard: if a screenshot could be
   mistaken for programmer placeholder, the phase FAILED.
4. **Unverified interactivity.** Synthetic `dispatchEvent` on the canvas "passed"
   while real clicks hit an overlay. Verification MUST use
   `document.elementFromPoint(x,y)` and dispatch on whatever element is actually
   on top — that simulates a real finger.
5. **React effect churn.** rAF loops keyed on unstable deps got torn down every
   tick (janky walking, blanked scenes). Long-lived loops read live state via
   refs; effects that load assets run once.
6. **2D could never look like the reference.** The user's visual target is a 3D
   world. That decision is made: THIS PROJECT IS 3D. Do not propose 2D anything.

**Mandatory verification protocol (every phase):**
- `pnpm build` green, zero TS errors.
- Open the app in the browser preview, play the feature with REAL hit-testing
  (`elementFromPoint` → dispatch on the top element).
- Take a screenshot at desktop (1280×720) AND phone (390×844) sizes.
- Zero console errors.
- Post: screenshot(s) + what you clicked + what happened. THEN stop for review.

---

## 1. REFERENCE ANALYSIS (done — summary for context)

**Idle Journey** (idle-journey.com): free browser idle RPG explicitly inspired by
RuneScape/OSRS. Facts gathered:
- Real **3D world** with a playable character (not menu-only), low-poly, fixed
  camera, oldschool-MMO vibe. Browser-based; Steam/iOS/Android "coming soon".
- Skills: Mining, Woodcutting, Melee Combat (+ more); dungeons, monsters,
  equipment (weapons/armor), rare drops, character building.
- Idle/offline progression + active play both viable; multiplayer w/ proximity
  chat (we do NOT need multiplayer).
- Devs publicly used **AI-generated art for inventory/item icons** and low-poly
  3D for the world. We adopt the same split: 3D world from licensed low-poly
  packs, 2D icons AI-generated (owner will generate; you request them).

**What makes these games enjoyable** (distilled, drives every design call):
persistent character living in a world → walk everywhere; long-term skill
progression (OSRS XP curve — hundreds of hours to mastery); always-another-goal
(next level / next unlock / rare drop / better tool); offline progress that
respects active rates; relaxing, low-pressure loop; daily return hooks.

**Our identity** (not a clone): the "Loom" theme survives — the world is a
tapestry, zones are "threads", the account-wide meta is weaving patterns. Names,
world, items, art are original.

---

## 2. VISION

"A mobile-first fantasy RPG that combines the world interaction of a classic
MMORPG, the long-term progression of an idle game, and the convenience of
offline progress." Private, personal-use, iOS-first. No monetisation, no
multiplayer, no ads.

Player promise: open for 5 minutes and progress; play long sessions when desired;
close the app and return to meaningful offline gains; always another goal.

---

## 3. TECH STACK (decided — do not relitigate)

| Layer | Choice | Why |
|---|---|---|
| Renderer | **Three.js** (latest), plain — no game framework | Full control, small, proven on mobile Safari |
| App | React 18 + Vite + TypeScript (strict) | Existing tooling |
| UI | React DOM overlaid on the canvas (no drei/react-three-fiber for the world; r3f allowed if it demonstrably simplifies, but the render loop must be a single owned rAF) | UI is 2D; world is 3D |
| State | zustand | Already used |
| Game logic | **REUSE `packages/engine`** (pure TS: OSRS XP curve, success rolls, tool tiers, offline `resolve()`, mastery). It is presentation-independent and already balanced (WC 10 ≈ 1h). Extend, don't rewrite. | Months of logic + pacing work; invisible plumbing |
| Backend | **REUSE Supabase** (`el_` tables, anon + email auth, RLS). | Working cloud saves |
| Deploy | Vercel (project `everloom-web`, auto-deploy on push) as PWA → instant iPhone testing via Safari/Add-to-Home-Screen. **Capacitor wrapper is a later phase** for a true native feel. | Fastest loop to the owner's phone |
| New client | `apps/client3d` (fresh package `@everloom/client3d`). `apps/web` stays untouched/dead until the owner deletes it. Point Vercel's build at the new app when Phase 3 passes. | Clean slate without breaking the live URL |

**iOS performance rules** (bake in from day one):
- Cap pixel ratio: `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- Frustum-small scenes, merged static geometry, max ~50 draw calls in v1.
- Battery: when the tab reports `hidden`, stop the rAF entirely (engine handles
  offline anyway). When no camera/character movement for 5s, drop to 30fps
  (render every other frame) until input.
- No shadows in v1 except one cheap directional shadow on the character
  (`shadowMap.autoUpdate=false`, update on move). Baked-feel lighting: hemisphere
  + one directional.
- `powerPreference: "low-power"`, antialias on (cheap at capped DPR).
- Touch: `touch-action: none` on canvas; all taps via Pointer Events.

---

## 4. ART DIRECTION

Style target: **low-poly fantasy, early-2000s MMO charm, flat/hand-painted-feel
colours, chunky readable silhouettes.** One consistent style. NO pixel art.

### 4.1 World + characters — licensed low-poly GLTF packs (all CC0)
Download into `apps/client3d/public/models/` and record each in CREDITS.md:

1. **KayKit — Character Pack: Adventurers** (CC0, kaylousberg.itch.io/kaykit-adventurers)
   → rigged humanoid characters (Knight/Barbarian/Mage/Rogue) with a shared
   animation library (idle, walk, run, attack, interact, death, etc.). Use ONE
   body as the player; its modular weapons/armor cover equipment visuals.
2. **KayKit — Skeletons pack + Dungeon pack** (CC0, same author) → 4-5 enemies
   (skeleton variants) + dungeon props for the mine/dungeon.
3. **Kenney — Nature Kit / Fantasy Town Kit** (CC0, kenney.nl/assets) → trees,
   rocks, water tiles, town buildings, fences, props. Hundreds of GLTF pieces.
4. **Quaternius — Ultimate RPG / Monsters packs** (CC0, quaternius.com) → fills
   any gap (fish, animals, extra monsters).

These packs are stylistically compatible (flat-shaded low-poly). Unify further
with a shared palette: warm greens, walnut browns, slate stone, gold accents
(reuse the v1 CSS palette tokens — they were good).

### 4.2 Icons — AI-generated (same approach as Idle Journey)
Inventory/skill/UI icons are 2D images the OWNER will generate with an image
model. Your job: maintain `apps/client3d/public/icons/MANIFEST.md` listing every
icon needed with a ready-to-paste generation prompt, e.g.:
> `logs_pine.png` — "game inventory icon, bundle of pine logs, low-poly stylised
> fantasy, warm palette, flat background, centered, 512x512"
Until real icons land, use a neutral auto-generated placeholder (rounded square
+ item initials) — CLEARLY a stopgap, never claimed as final, and the manifest
is the deliverable that makes the phase complete.

### 4.3 Camera & look (exact spec)
- PerspectiveCamera, FOV 45. Pitch ~50° down, yaw fixed at 45° (classic ¾ MMO
  view). Distance ~14 world units from the character, smooth-follow (lerp 0.08).
- Optional: two-finger drag rotates yaw ±45° (nice-to-have, Phase 7).
- Fog: gentle distance fog matching sky colour for cosy depth.
- Sky: gradient background (no skybox texture needed in v1).
- Ground: single merged low-poly terrain mesh per zone with vertex-coloured
  grass/dirt/stone zones; water = flat animated-UV plane.

---

## 5. WORLD — VERTICAL SLICE (v1 content, complete list)

One connected map (~120×120 units), no loading screens between areas:

- **Thimblewick** (beginner town): 4-6 Kenney buildings, well, bank chest
  (banking!), anvil + furnace, cooking fire, 2 static NPCs (flavour dialogue
  only).
- **Loomwood Forest** (west): 8-10 pine/oak trees as woodcutting nodes (respawn
  30-60s after depletion — trees visually fall to a stump, OSRS-style), 1
  ground-spawn `worn hatchet` beside the path with a glowing marker.
- **Burrow Mine** (north, cave mouth into a dark pocket): copper + tin + iron
  rocks (iron gated by level), `worn pickaxe` ground spawn at the entrance,
  torch lighting.
- **Silverthread River** (south edge): 3 fishing spots (animated ripples),
  `worn fishing rod` ground spawn on the bank.
- **Training Grounds** (east): 5 enemies from KayKit skeletons — Skeleton
  (lv2), Skeleton Archer (lv5), Armoured Skeleton (lv9), Skeleton Mage (lv14),
  **boss: the Unravelled King** (lv20, dungeon-gated later; in v1 he stands at
  the far end with a warning NPC).
- Dungeon entrance door (locked, "future content" — a visible long-term tease).

Movement: tap ground → yellow marker → A* on a 1-unit walkable grid baked from
the terrain (water/buildings/props blocked) → character runs (KayKit run anim).
Tap node/enemy/NPC/item → red marker → path to adjacent cell → contextual action.
Raycast against a simplified picking layer (invisible cylinders per interactable
— generous, finger-sized), NEVER against visual meshes only.

---

## 6. SYSTEMS (mapping to the existing engine)

**Skills v1 (6):** Woodcutting, Mining, Fishing (gathering — engine's
`resolveGathering` with success rolls + tool gating, already implemented);
Smithing, Cooking (production at furnace/anvil/fire — `resolveProduction`);
**Melee** (new, see below). Ranged/Magic/Farming/Alchemy/Crafting = post-v1,
but the data schema must make adding a skill = adding data + a node model.

**Tools & equipment:** worn (found on ground) → copper (smith it) → iron ladder,
already in engine (tool tiers gate success%). Equipment visuals: swap KayKit
modular weapon meshes on the character's hand bone when equipped. Slots v1:
weapon, tool (auto-shown during gathering), body, head (armour from smithing).

**Melee combat v1** (engine extension — keep it pure/deterministic):
- Stats: Attack level (accuracy), Strength level (max hit), Defence level
  (avoidance), HP (already exists). All on OSRS XP curve.
- Tick every 1.8s: hit chance = f(attack + weapon tier vs enemy defence); damage
  = roll 0..maxHit(strength, weapon). Enemy hits back same tick pattern.
- Death: respawn in town, keep everything (cozy default; the owner's "modes"
  from v1 data can gate this later).
- Drops: per-enemy drop table (bones→prayer later, coins→nothing yet, gear
  pieces, 1/128 rares, boss uniques). Loot appears as a ground item beside the
  enemy, tap to collect (reuses ground-item system).
- Offline combat: allowed against a SELECTED enemy at reduced efficiency (70%)
  with a safety rule: stops if 10 consecutive sim deaths (then idles). Extend
  `resolve()` with `resolveCombat` mirroring the gathering EV approach for >2h
  windows.

**Offline progression:** engine `resolve()` already does gathering/production
offline with the return report. Wire the return summary UI: "While you were
away — 4,200 Mining XP, 320 iron ore, 12 rare gems" style, with per-skill lines
and rare-find callouts. This screen must feel like a reward: gold accents, item
icons, big numbers.

**Retention:** daily first-login bonus chest (small, cosmetic-ish); collection
log (every unique item silhouette→filled); "Next unlock: Oak trees at
Woodcutting 15" teasers on every skill row; level-up 3D confetti burst + banner.

---

## 7. UI (mobile-first, exact spec)

- **HUD (always visible, minimal):** top-left compact bar — HP orb, current
  action chip ("Mining ⛏ Copper — 34% to Lv 12"), XP drops float in-world above
  the character (billboarded sprites).
- **Bottom tab bar** (safe-area aware, 5 stones): Inventory · Skills ·
  Equipment · Map · More(bank/settings/log). Tapping opens a **bottom sheet**
  to 45% screen height (drag up to 85%, drag down to close). The 3D world stays
  visible and interactive above the sheet. NO SCRIM. NO full-screen pages
  except Settings and the offline-return summary.
- Inventory: 4-wide grid, scrollable, tap item → context row (Equip/Eat/Drop/
  Examine). 28 slots start.
- Skills: rows w/ icon, level big `12/99`, thin XP bar, next-unlock teaser line.
- All tap targets ≥ 44px. Test portrait 390×844 first, landscape second.

---

## 8. PHASES — with hard gates

Work in `apps/client3d`. After EVERY phase: verification protocol from §0, post
proof, STOP for supervisor review. Commit per phase with descriptive messages.

**P0 — Scaffold + assets** (no gameplay): Vite+React+TS+Three.js app renders a
lit ground plane + KayKit character standing idle, camera per §4.3. Download all
§4.1 packs, organise `public/models/`, write CREDITS.md + icons MANIFEST.md.
✔ Gate: screenshot shows the rigged character idling (animation playing) on a
ground plane at both viewports; models load from local files; build green.

**P1 — Terrain + town + navigation:** Build the §5 map (terrain mesh, water,
town props, zone props placed via a `worlddata.ts` layout file — data, not
hard-code). Bake walkable grid; tap-to-move with A*, run animation, markers.
✔ Gate: video-like screenshot sequence (3 shots: before tap / marker / arrived)
+ REAL hit-test tap moving the character around town; 55+ fps desktop.

**P2 — Gathering loop:** Interactable trees/rocks/fishing spots wired to engine
actions (walk → face node → looped interact animation → engine ticks → XP drop
floats + inventory fills). Trees deplete to stumps and respawn. Ground-spawn
worn tools: visible glow, tap → walk → pickup toast → auto-prompt equip. Tool
gating messages ("You need a hatchet…").
✔ Gate: full chain proven for ALL THREE skills in one session: find tool →
equip → gather → see XP + item. Screenshot each. This is the gate v1 died on —
it will be checked mercilessly.

**P3 — UI + persistence:** Bottom sheet UI (§7), inventory/skills/equipment
tabs, Supabase save/load (reuse store patterns; guests anonymous), offline
resolve + return summary screen. Point Vercel at client3d. iPhone test by owner.
✔ Gate: close tab 3+ min → reopen → return summary with correct gains; owner
confirms on phone.

**P4 — Combat:** Engine `resolveCombat`, 5 skeletons in Training Grounds, tap
enemy → walk → auto melee exchange w/ animations + damage splats, drops as
ground loot, death→town respawn. Attack/Strength/Defence/HP on skill screen.
✔ Gate: kill a skeleton on camera; die on camera; loot a drop; XP flows.

**P5 — Production + equipment visuals:** Smelt at furnace, smith at anvil
(hammer!), cook at fire; crafted copper gear equippable with visible mesh swap
(weapon in hand, helmet on head).
✔ Gate: ore→bar→copper sword shown IN HAND, stats change combat outcomes.

**P6 — Juice + retention:** level-up burst + banner, collection log, next-unlock
teasers, daily chest, examine text, ambient life (birds, smoke from chimneys,
water shimmer), sound OFF by default (post-v1).
✔ Gate: 15-min new-player session feels guided and alive; supervisor plays it.

**P7 — iOS polish:** PWA manifest/icons (the owner's tree icon exists), battery
rules verified (rAF stops when hidden), 30fps idle mode, safe areas, add-to-home
flow, Lighthouse mobile perf ≥ 85. Optional Capacitor scaffold.
✔ Gate: owner plays on iPhone and signs off.

**P8 — handoff doc:** update this file's status table, write ADDING_CONTENT.md
(how to add a skill/zone/enemy/item purely via data).

---

## 9. HARD RULES

1. Never claim done without the §0 proof. "Not verified" is an acceptable
   status; a false "verified" is project-fatal.
2. No full-bleed DOM overlays above the canvas, ever.
3. All interactables get generous invisible picking colliders.
4. Asset licences: CC0 packs listed in §4.1 only (+ AI icons). NO Jagex/RSPS
   rips, no scraped game assets, no pixel art.
5. Engine stays pure & deterministic (no Date.now/Math.random inside resolve
   paths — use the rng stream + passed timestamps, as it already does).
6. rAF loop: created once, reads live state via refs/stores, never keyed on
   changing deps.
7. Data-driven: new zone/enemy/item/skill = JSON + placement entry, no renderer
   edits.
8. When in doubt about scope: smaller and WORKING beats bigger and claimed.

---

## 10. STATUS

| Phase | Status |
|---|---|
| P0 | not started |
| P1–P8 | not started |

(Supervisor updates this table at each gate.)
