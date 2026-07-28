# Everloom Graphics Overhaul — Implementation Plan (v2)

> **Audience**: implementing model/agent. Read this whole file before writing code.
> **Baseline**: repo builds green (`pnpm build`), deployed logic works, engine is done.
> **This plan changes PRESENTATION ONLY. Do not modify `packages/engine` logic or Supabase code.**

---

## 1. What the user actually wants (read carefully)

The user has repeatedly asked for and NOT yet received:

1. **OSRS look & feel** — a 3/4 top-down game world made of REAL tile/sprite art,
   not hand-drawn SVG shapes. Think Lumbridge: grass tiles, trees with canopies,
   water with animated edges, a character that looks like a person.
2. **Point-and-click walking** — click anywhere walkable → character WALKS there
   (multi-frame walk cycle, 4 directions). Click a tree/rock/fishing spot →
   character walks TO it, then starts the skilling animation facing it.
   OSRS-style yellow/red click marker where you clicked.
3. **Real animations** — multi-frame sprite animations (walk cycles, chop swings,
   mining swings, fishing idle), NOT CSS rotations of rectangles.
4. **Always-visible inventory** — OSRS side panel: inventory grid always on screen
   during skilling, tab row of icon "stones" (inventory / skills / map / quests /
   exchange) like the OSRS interface bar.
5. **Idle-game DNA** (Melvor Idle / Idle Slayer inspiration) — keep everything that
   already works: offline progress, mastery, bank, ledger bundles, XP curves.
   The engine already does this. Don't touch it.
6. **iOS-friendly** — must run and look right on iPhone Safari (tap = click,
   dvh viewport, safe-area). Already partially done; keep it working.

**Anti-goals**: no more inline-SVG "programmer art" for world/character; no
full-screen modal panels covering the game; no emoji as item icons in the final
pass (acceptable placeholder during phases 1-3).

---

## 2. Architecture decision

Keep React + zustand for ALL UI (panels, HUD, buttons). Render the WORLD in a
single `<canvas>` with a small hand-rolled 2D renderer (no Pixi/Phaser — keep
deps minimal and the loop is simple):

```
GameScreen
├── <WorldCanvas>          ← new: canvas, rAF loop, draws tiles/props/character
├── <SidePanel>            ← new: OSRS-style right panel (inventory + tabs)
├── <ActionHUD>            ← keep, restyle (xp bars, current action)
└── <Toasts> / <XpDrops>   ← keep
```

- Canvas is sized to its container × `devicePixelRatio`, `image-rendering: pixelated`,
  `ctx.imageSmoothingEnabled = false`.
- Logical world = tile grid. **Tile size 32px source, drawn at 2× (64px)** on
  desktop; scale factor chosen so ~20×11 tiles fill the canvas.
- rAF loop only draws; game state stays in zustand/engine exactly as now.
  Character position/path/facing is **client-side cosmetic state** (a module-level
  object or a tiny zustand slice — it must NOT enter PlayerState or Supabase).

---

## 3. Assets — exact sources and pipeline (Phase 0)

All assets go in `apps/web/public/sprites/`. Update `CREDITS.md` (CC-BY-SA needs
attribution; list author names from each OpenGameArt page you download from).

### 3.1 Character — LPC (Liberated Pixel Cup) layered spritesheets
Source: **Universal LPC Spritesheet Generator**
- Repo: `https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator`
- Live: `https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/`
- License: CC-BY-SA 3.0 / GPL 3.0 — attribute in CREDITS.md.

LPC sheet format (each layer PNG is the SAME grid, so layers stack by drawing in
order): 64×64 px frames. Rows (universal layout):
- rows 8–11: **walk** (up, left, down, right), 9 columns (col 0 = idle stand)
- rows 12–15: **slash** (6 frames) → use for CHOPPING
- rows 4–7: **thrust** (8 frames) → use for MINING
- row 2 (spellcast) or reuse thrust slowed → FISHING idle cast

Download per-layer sheets (one PNG per option the appearance editor offers):
```
public/sprites/char/
  body/       body_light.png body_tan.png body_bronze.png body_brown.png body_dark.png body_black.png   (6 = SKIN_TONES)
  hair/       hair_<style>_<n>.png   (8 styles the editor already lists; pick closest LPC styles: plain, swoop, long, spiked, bun, bald→none, curly, messy) × keep ONE neutral color each
  torso/      torso_shirt_<n>.png    (10 colors — LPC "shirts" have color variants; pick 10)
  legs/       legs_pants_<n>.png     (10 colors)
```
If exact color counts are impractical, runtime-tint instead: load one white/gray
sheet per layer and tint via offscreen canvas `globalCompositeOperation =
"source-atop"` fill with the palette color already defined in `Diorama.tsx`
(SKIN_TONES / HAIR_COLORS / TORSO_COLORS / LEGS_COLORS). **Tinting is the
preferred approach** — fewer files, exactly matches the existing appearance editor.

Runtime compositing: every frame draw `body → legs → torso → hair` with the same
(row, col) source rect. Cache the composited sheet per-appearance in an offscreen
canvas once (key = JSON of appearance), then drawImage from the cache.

### 3.2 Terrain + props — LPC terrain / Kenney
- LPC terrain atlas: `https://opengameart.org/content/lpc-terrains` (CC-BY-SA) —
  grass, dirt path, water edges, cliffs.
- LPC trees: `https://opengameart.org/content/lpc-trees` (pine, oak with proper canopies).
- Animated water: `https://opengameart.org/content/lpc-animated-water-and-fire` —
  3-frame water, 4-frame fire (campfire!).
- Rocks/ore: `https://opengameart.org/content/lpc-rocks` or recolor base rock with
  ore-color overlay dots per ore type.
- Fishing spot: animated ripple — 3 frames, can be hand-made 32×32 (concentric
  circles, 3 phases) if no good source found; this one exception to "no programmer art"
  is fine because OSRS fishing spots are literally just ripples.

```
public/sprites/world/
  terrain.png      (tile atlas)
  trees.png        (pine, oak, willow, dead/charwood)
  rocks.png        (base + ore overlays)
  water_anim.png   (3 frames × edge variants)
  fire_anim.png    (4 frames)
  ripple_anim.png  (3 frames)
```

### 3.3 Item icons (Phase 4)
Replace emoji: `https://opengameart.org/content/496-pixel-art-icons-for-medievalfantasy-rpg`
(CC0) — logs, ore, fish, bars, tools all exist there. Map in one file
`apps/web/src/lib/itemIcons.ts` → `{ itemId: [atlasX, atlasY] }`, drawn as
32×32 `<canvas>` or CSS sprite backgrounds in inventory slots.

---

## 4. World/zone definition (Phase 1)

New file `apps/web/src/world/zonemaps.ts`. Each zone = ASCII tilemap, 20 wide ×
11 tall (fits 16:9 at 64px tiles; mobile crops sides, camera centers on player):

```ts
// legend: g grass, G dark grass, w water, W deep water, c cliff, p path,
//         t tree-blocked (decor placed separately), . void/black
export const MEADOWREST_MAP = [
  "GGGGGGGGGGGGGGGGGGcc",
  "GggggggggggggggggGcc",
  "Ggggggggggggggggggcc",   // etc — design a clearing with river along the
  "Gggggggggggggggggwcc",   // bottom third and waterfall from the cliff (right),
  "ggggggggggggggggwwcc",   // matching the current scene composition
  "gggggpppgggggggwwwcc",
  "gggggpgpggggggwwWwcc",
  "ggggppgppggwwwwWWwcc",
  "gwwwwwwwwwwwWWWWwwcc",
  "wwWWWWWWWWWWWWWWWwww",
  "wwWWWWWWWWWWWWWWWWww",
];
```

- `walkable(tile)`: g, G, p only.
- **Node placements** (reuse node ids from gamedata; positions in TILE coords):
```ts
export const MEADOWREST_NODES = [
  { nodeId: "meadowrest_pine",         tx: 3,  ty: 2 },
  { nodeId: "meadowrest_willow",       tx: 5,  ty: 4 },
  { nodeId: "meadowrest_campfire",     tx: 9,  ty: 3 },
  { nodeId: "meadowrest_copper_vein",  tx: 13, ty: 2 },
  { nodeId: "meadowrest_tin_vein",     tx: 15, ty: 4 },
  { nodeId: "meadowrest_trout_stream", tx: 8,  ty: 7 },   // on water EDGE tile
  { nodeId: "meadowrest_minnow_pool",  tx: 13, ty: 7 },
];
```
- Nodes occupy their tile (unwalkable); interaction targets the nearest adjacent
  walkable tile. Same for bramblewood + ashen_delve maps (Phase 6).
- Decor list per zone (non-interactive trees along edges, rocks at cliff base)
  drawn from the same atlases.

Renderer draw order per frame:
1. ground tiles (with 3-frame water animation, ~450ms/frame)
2. y-sorted entities: decor, nodes, character (sort by tile y / pixel y so the
   character walks BEHIND canopies that are lower on screen — split tall trees
   into "trunk" (sorted) + "canopy" (always-above layer) if simpler)
3. click marker, node hover highlight, name label

---

## 5. Point-and-click movement (Phase 3) — the core feature

New module `apps/web/src/world/movement.ts`:

```ts
interface CharState {
  px: number; py: number;        // pixel position (canvas space)
  path: {tx:number,ty:number}[]; // remaining tiles
  facing: "up"|"down"|"left"|"right";
  anim: "idle"|"walk"|"chop"|"mine"|"fish"|"cook";
  animStart: number;
  pendingAction: ActionDescriptor | null;  // fired on arrival
}
```

- **A\*** (or BFS — grid is 220 tiles, BFS is fine and simpler) over walkable tiles,
  4-directional. ~60 lines, no dependency.
- Speed: **4 tiles/second** (OSRS walk ≈ 1 tile per 0.6s run — 4/s feels good for
  an idle game). Lerp px/py toward next tile center each frame; pop tile when reached;
  set `facing` from movement direction.
- **Canvas click handling**:
  - Hit-test nodes first (node sprite rect). Hit → path to nearest adjacent
    walkable tile, set `pendingAction` = that node's ActionDescriptor. Show
    **red-X marker** (OSRS: red for interact). On arrival: face the node, set anim
    from skill, and ONLY THEN call `startAction(pendingAction)`.
  - Otherwise if walkable tile → path there, **yellow-X marker**, and if an action
    is running call `startAction({type:"idle",...})` (walking away cancels
    skilling, exactly like OSRS).
  - Marker: 4-frame shrinking X, ~400ms, drawn at click point.
- While `anim` is a skill anim, loop the matching LPC rows. XP keeps flowing from
  the engine exactly as now — the animation is cosmetic.
- On zone load / respawn: character stands at a defined spawn tile.
- **Mobile**: same handler via pointer events; tiles at 64px are comfortably tappable.

Store integration (small `gameStore.ts` change): `startAction` is currently called
directly by node buttons — the WorldCanvas replaces node buttons entirely.
KEEP the engine call signature unchanged. Delete the old `Diorama.tsx` node-button
rendering once WorldCanvas is live.

---

## 6. OSRS-style UI (Phase 4)

Replace `InventoryBar` + `TabStrip` + sliding panels with a **SidePanel** docked
right (desktop ≥ 700px wide) / **bottom sheet** (mobile):

- Frame: dark stone/parchment 9-slice look. Colors from existing palette
  (`--walnut` browns, `--iron-gall` dark) — draw the border as CSS
  `border-image` from a small 24×24 stone-corner PNG (make one, or nested
  box-shadows are acceptable).
- **Inventory grid**: 4 columns (OSRS is 4×7). Render `ps.slots` slots (10 now,
  grows with satchel upgrades). Item icons from the icon atlas + qty number
  bottom-right in yellow (OSRS convention, `--weld`).
- **Tab row** under/above the grid, icon-only stone buttons:
  `🎒 inventory | 📊 skills | 🗺 atlas | 📖 ledger | ⚖ exchange | 🔨 bench`
  (swap emoji for atlas icons in the same pass). Active tab = lighter stone +
  gold underline. Clicking a tab swaps the PANEL CONTENT INSIDE the side panel —
  **never** a full-screen overlay.
- **Skills tab** (new, Melvor-style): grid of all 10 skills, each cell = icon,
  level big, xp progress bar. Reuse `levelFromXp`/`XP_TABLE`.
- ActionHUD: keep, restyle to a compact top-left "activity card": skill icon,
  node name, xp/hr estimate (compute: xpPerAction / actionTime × 3600), progress
  of current action cycle.
- **XP drops**: on `xp_gain` events, spawn floating `+N ⚒` text rising from the
  character position on the canvas (or DOM-positioned over it) — OSRS xp-drop
  style. Existing `xp-popup` CSS is a starting point.

---

## 7. Phases, order, and acceptance criteria

Work strictly in this order; each phase must build (`pnpm build`) and be
verified in the browser before the next.

**Phase 0 — assets** (no code): download sheets listed in §3 into
`public/sprites/`, update CREDITS.md with authors. ✔ files exist, licenses noted.

**Phase 1 — WorldCanvas + tilemap**: canvas renders Meadowrest map w/ animated
water, decor, node sprites at tile positions, name labels. Old SVG scene gone.
✔ zone visibly made of real tiles at correct scale, 60fps, no blur (pixelated).

**Phase 2 — character**: LPC compositing + tint by appearance; idle/walk/chop/
mine/fish anims play from sheet rows; character drawn y-sorted.
✔ appearance editor colors visibly change the sprite; walk cycle animates.

**Phase 3 — point & click**: BFS pathing, click markers, walk-then-act flow,
walking cancels action. ✔ click ground → walks there; click pine → walks, faces
it, chops, logs appear in inventory; click water mid-chop → cancels and walks.

**Phase 4 — OSRS UI**: SidePanel + tabs + icon atlas + xp drops; delete
InventoryBar/TabStrip/slide-up panels. ✔ inventory always visible during
skilling on desktop AND iPhone-width; no full-screen overlays remain.

**Phase 5 — ambience**: campfire 4-frame fire, fishing ripples, waterfall anim
(2-frame offset scroll), cloud shadows (slow moving translucent ellipses),
birds (3-frame, occasional flyover). ✔ scene feels alive at idle.

**Phase 6 — zones 2+3 maps + deploy**: bramblewood (dusk palette tiles) and
ashen_delve (cave tileset) maps + node placements; run full build; push; verify
Vercel deployment on desktop + iPhone. ✔ live URL shared with user.

**Definition of done for the whole overhaul**: a stranger screenshots the game
and it reads as "a cute OSRS-like", not "developer placeholder art".

---

## 8. Verification checklist (run every phase)

1. `pnpm build` green.
2. Browser: create guest character → world renders → click-walk works.
3. Resize to 390×844 (iPhone 12): no horizontal scroll, inventory reachable,
   canvas letterboxes/centers sensibly.
4. Console: zero errors.
5. Performance: rAF loop steady (no per-frame allocations of images/canvases;
   composite character ONCE per appearance, not per frame).

## 9. Explicitly out of scope (do not build now)

- Sound. Minimap. Camera scrolling/zoom. Combat visuals. Trading UI.
- Any engine/gamedata/Supabase changes beyond what §5 requires (none).
- New skills (user said: graphics first, skills later).
