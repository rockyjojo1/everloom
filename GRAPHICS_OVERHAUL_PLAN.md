# Everloom Overhaul — Implementation Plan (v3)

> **Audience**: implementing model/agent. Read this whole file before writing code.
> **Baseline**: repo builds green (`pnpm build`), engine/Supabase logic works.
> Allowed engine changes are ONLY those explicitly scoped in §5b.1 and §6b.

---

## 0. Audit — what was asked vs. what was delivered

Honest scorecard of the user's requests across all sessions. ❌ items are THE
point of this plan; do not consider the project good until they're ✅.

| # | Request | Status | Gap |
|---|---------|--------|-----|
| 1 | Animated character doing skills | ❌ missed twice | SVG rectangles w/ CSS rotation ≠ sprite animation. → Phase 2 |
| 2 | Immersive forest/river/cliff diorama | ❌ | Flat SVG shapes read as placeholder. → Phase 1 tilemap |
| 3 | Cooking needs a lit fire | ✅ | Campfire node → charges → recipes consume them |
| 4 | Smithing needs rock + hammer + fire | ❌ | Bench crafts anywhere; no hammer, no anvil/furnace. → §5b.6 |
| 5 | Raw fish heavier in inventory | ✅ | fish stack cap 3 |
| 6 | Zone 2 travel: walk or wayfaring teleport | ⚠️ | Timer-based travel exists; no walking journey/teleport UI. → Phase 6 |
| 7 | Email/password + appearance creator | ✅ | works |
| 8 | Multi-character select | ⚠️ | Select screen exists but only 1 slot. → later, low priority |
| 9 | Offline return report | ✅ | works |
| 10 | OSRS-style UI, inventory always visible | ⚠️ | Rail + strip exist but don't look/behave like OSRS. → Phase 4 (§6, rewritten) |
| 11 | Point-and-click walking | ❌ | Character teleport-glides via CSS. → Phase 3 |
| 12 | Equipment: find → build → equip → use | ❌ | Engine supports it; never surfaced. → Phase 3b |
| 13 | Slow, grindy, OSRS-paced progression | ❌ | Lvl 10 WC in minutes. → Phase P (§6b) — DO THIS FIRST |

**Root-cause notes for the implementing model**
- The repeated graphics miss happened because SVG programmer-art was iterated
  instead of adopting real game assets. Do not repeat this: if a phase's output
  could be mistaken for a placeholder, it fails its acceptance criteria.
- "Feels like you just click and that's it" = three missing layers: movement
  (walking is the verb of OSRS), equipment (preparation before action), and
  pacing (scarcity of progress). All three are phased below.

## 0b. Design pillars (priority order — settle every tradeoff by this list)

1. **OSRS first**: the world is a place. You walk, you click things, tools and
   levels gate you, progress is slow and therefore meaningful. Interfaces are
   compact, diegetic-feeling stone/parchment panels. Numbers are earned.
2. **Melvor second**: clean skill panels, always-visible "next unlock at Lv X"
   teasers, mastery per node, offline progress that respects the same rates.
3. **Idle Slayer third**: the ACTIVE layer — small tap bonuses (glimmers),
   occasional flying rare (bird/spirit crossing the screen you can tap for a
   mote burst). Active play should feel ~20-30% better than idle, never required.
4. **BETTER**: no energy systems, no ads, no fake timers. The grind is honest;
   the world is cozy; every level-up feels like a small event (see §6c).

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
7. **Equipment matters (OSRS-style tool progression)** — you can NOT gather with
   bare hands. Tools must be FOUND (ground items), BUILT (head + haft + binding),
   EQUIPPED (equipment tab), and they WEAR OUT. The engine already models all of
   this (`ToolComponent`, tiers, wearPct, hardness gating) — it's just never
   surfaced or enforced. See §5b.

> **Art licensing rule**: take MECHANICS inspiration from OSRS/RSPS freely
> (ground items, examine text, interfaces), but NEVER use Jagex/RSPS-ripped
> sprites or cache assets. All art comes from the LPC/CC0 sources in §3.

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

## 5b. Equipment & tool progression (Phase 3b) — "find it, build it, use it"

The engine already supports everything below — read `packages/engine/src/types.ts`
(`ToolComponent`, `Equipment`) and `resolve.ts` (`resolveGathering` lines ~273-292:
headTier vs node hardness gates speed; tierGap ≥ 3 blocks). What's missing is
enforcement, acquisition, and UI.

### 5b.1 The one allowed engine change
`resolveGathering`: if `getToolForSkill(state, skill)` returns `null` for
woodcutting/mining/fishing → return no progress AND emit a new event
`{ kind: "tool_required", skill, atSeconds: 0 }` (add to the `GameEvent` union).
Cooking at a campfire needs no tool. This makes bare-handed gathering impossible
instead of merely slow. Keep it pure; add a unit-style check that resolve with
no tool yields zero xp events.

### 5b.2 Starting state change (`apps/web/src/lib/playerInit.ts`)
Remove the free copper hatchet: `hatchet: null`. New characters own NOTHING.

### 5b.3 Ground items (new, OSRS-style)
New module `apps/web/src/world/groundItems.ts` + rendering in WorldCanvas:
- Zone maps define **spawn points**: Meadowrest spawns a `worn_hatchet` beside
  the spawn tile and a `worn_pickaxe` near the copper vein (both new items in
  `gamedata/items.json`, tier-1 heads pre-assembled, `tradeable: false`).
- Render: small item sprite on the tile + floating label on hover/tap
  (`Take Worn hatchet` — OSRS ground-text style, item name in orange).
- Click/tap → character walks to the tile → item goes to inventory → spawn
  point starts a 60s respawn timer (client-side; these are starter tools, dupes
  are harmless — satchel/bank caps already limit hoarding).
- First-session guidance: if player owns no hatchet, a subtle arrow/sparkle on
  the ground spawn (Melvor-style onboarding nudge).

### 5b.4 Assembly & equipping
- New "assemble" recipes in `gamedata/recipes.json` (crafting skill, at bench):
  `head + haft + binding → tool item`, e.g. `copper_hatchet_head + pine_haft +
  rough_binding → copper_hatchet`. Add tool items for copper/iron ×
  hatchet/pickaxe/rod. Output `materialClass: "tool"`.
- Clicking a tool in inventory → context menu `Equip / Examine / Drop`
  (long-press on mobile). Equip moves it into `equipment.hatchet` as a
  `ToolComponent` (map item → component tiers in a new
  `apps/web/src/lib/toolItems.ts`); the previously equipped tool returns to
  inventory as its item form.
- `worn_*` tools equip the same way but have tier 1 and start at 40% wearPct —
  they get you going, a crafted copper tool is the first real upgrade, iron
  needs Bramblewood ore. That's the OSRS ladder: bronze → iron → …

### 5b.5 Feedback & flavor (RSPS-inspired, no ripped art)
- Attempt to gather with no tool → red game-message toast, OSRS wording:
  *"You need a hatchet to chop this tree."* (drive off the `tool_required` event).
- **Examine** on any item/node → flavor text line in a small message log
  (add `examine` strings to items.json; 1 sentence, wry OSRS tone).
- Equipment tab shows the three tool slots + armour slots with the equipped
  item icon, tier, and a wear bar; wear < 20% tints the bar red and shows
  *"Your hatchet is about to break."*

### 5b.6 Facilities — smithing done right (the user's ORIGINAL ask:
### "rock + hammer + fire")
OSRS model: smelting happens AT a furnace, smithing AT an anvil WITH a hammer,
cooking AT a fire. Implement as **interaction-gated menus**, no engine change:
- Add two facility nodes to the Meadowrest map (near the cliff base): a
  **stone furnace** (rough rock chimney sprite) and an **anvil** (on a flat
  rock). They're world objects like trees — click → character walks over.
- Arriving at a facility opens its menu in the GamePanel (§6): furnace →
  smelting recipes only; anvil → smith recipes only (and shows a red header
  *"You need a hammer to work the anvil"* if no hammer in inventory); campfire →
  cooking recipes (charge system stays as-is).
- The free-standing Bench tab keeps ONLY crafting + fletching (whittling and
  tying don't need a facility).
- New item `hammer` (materialClass "tool", untradeable starter variant
  `worn_hammer` ground-spawns beside the anvil; craftable proper hammer:
  1 bronze_bar + pine_haft at the anvil).
- Gating is enforced at action-START only (client): once smelting begins it
  continues offline like everything else. Document this in code comments.

### Phase 3b acceptance criteria
✔ Fresh character cannot chop/mine/fish; red message explains why.
✔ Worn hatchet visible on the ground, Take → inventory → Equip → chopping works.
✔ Assembling copper hatchet at bench from 3 components works and equips.
✔ Equipment tab shows tools + wear; wear decreases with use (engine already
  does this — verify it displays).
✔ Smelting only possible at the furnace; anvil demands a hammer; the worn
  hammer is findable on the ground beside it.

## 6. OSRS-mobile-style interface (Phase 4) — REWRITTEN per user feedback

The user's exact spec: *"inventory + other tabs exactly like it would work on
OSRS — a small shown area on the bottom right that you can toggle — and given
we'll be looking to increase the inventory, make it scrollable."*

This is the **OSRS Mobile** interaction model. Delete `InventoryBar`,
`TabStrip`, and ALL slide-up `.panel` sheets. Build one component:
`apps/web/src/components/GamePanel.tsx`.

### 6.1 Collapsed state (default)
A single **stone tab bar** anchored bottom-right of the game view
(`position:absolute; right:8px; bottom:calc(8px+env(safe-area-inset-bottom))`).
Row of 7 square stone buttons (44×44px min — Apple tap-target rule):
`inventory | equipment | skills | bench | atlas | ledger | exchange`.
Nothing else on screen — the world stays fully visible while skilling; the
ActionHUD (top-left activity card) and xp drops carry the feedback.

### 6.2 Open state (toggle)
Tapping a tab opens a **compact panel that grows UP from the tab bar**,
bottom-right anchored — OSRS mobile behavior exactly:
- Size: `width: min(340px, 62vw)` desktop / `min(320px, 86vw)` phones;
  `height: min(420px, 58%)` of game view. NEVER full-screen.
- The tab bar remains visible (docked to panel bottom edge); active tab stone
  is "pressed" (darker + gold top edge, OSRS-style).
- Tap active tab again OR tap the world → panel collapses. Small ✕ too.
- Open/close = 140ms translateY+fade. No scrim, no blur — the world stays live
  behind it (you watch your character keep chopping — this is core to the vibe).
- Frame: parchment interior (`--linen` texture), 3px `--walnut` border,
  corner rivets (4 small darker squares) — reads "OSRS panel" without ripping art.

### 6.3 Inventory tab (the default tab)
- **4 columns fixed** (OSRS), rows = ceil(slots/4), **vertical scroll** inside
  the panel (`overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch`)
  — REQUIRED because slots grow (10 → 28 → 56+ via satchels/bank upgrades).
  Grid must stay smooth at 100+ slots (it's just divs; no virtualization needed
  below 200).
- Slot: 56×56px stone-inset square; item icon centered; qty bottom-right in
  yellow `--weld` (OSRS convention: yellow < 100k). Empty slot = darker inset.
- Tap item → context menu (§5b.4): `Equip/Eat/Use | Examine | Drop`.
- Header strip: `Satchel 12/28` + weight-free (no OSRS weight — idle game).
- Larder + Bank become **sub-tabs inside the inventory tab** (small text tabs
  at top: Satchel · Larder · Bank), each a scrollable 4-col grid.

### 6.4 Other tabs (all same panel shell, all scrollable)
- **Equipment**: §5b.5 — tool slots + armour paper-doll column, wear bars.
- **Skills** (Melvor-style): list rows, one per skill: icon, name, `Lv 23/99`,
  thin xp bar, and **"Next: Oak trees at 15"** unlock teaser line (§6c.2).
- **Bench / Atlas / Ledger / Exchange**: port existing panel content into the
  new shell; 4-col or list layouts; everything scrolls within the panel.

### 6.5 HUD (outside the panel)
- Top-left compact activity card: skill icon + node name + action progress bar
  (fills per action tick) + `+N xp` accumulator + xp/hr.
- XP drops float up from the character on the canvas.
- Top-right: HP orb (small, OSRS-style circle) only in danger zones.

---

## 6b. Pacing & XP economy (Phase P — DO THIS FIRST, before any graphics work)

User verdict: leveling is far too fast ("sat a short while, already 10
woodcutting"). The XP TABLE is already OSRS-exact (`packages/engine/src/xp.ts`) —
the problem is throughput: every action succeeds, action xp is generous, and
level/haft speed bonuses compound. Fix throughput, not the table.

### 6b.1 Success rolls (the OSRS lever) — scoped engine change
In `resolveGathering`, before drops/xp each iteration, roll success on the
existing rng stream:
```
successFP = clamp(180 + skillLevel*11 + headTier*70 + masteryLevel*3, 180, 850)  // ×1000
```
- Lv1, tier-1 worn tool → ~26%. Lv30 + copper → ~58%. Cap 85% forever (OSRS
  trees never hit 100%).
- Failure consumes the full action time, yields NO xp and NO drop (a swing and
  a miss). Mastery xp DOES accrue on failure at 1 (familiarity with the spot) —
  this keeps mastery meaningful and softens frustration, Melvor-style.
- **Offline windows > 2h**: switch to expected-value (`successes =
  floor(actions × successFP / 1000)`) so 300h resolves stay <50ms and results
  stay deterministic/composable. Same rates idle vs active — pillar #4 honesty
  (the active edge comes from glimmers, §6c.4, not secret idle nerfs).
- Emit nothing on failures (no event spam); ActionHUD shows a brief "miss"
  shimmer client-side by watching action ticks without xp.

### 6b.2 Data rebalance (`gamedata` only)
- Gathering `xpPerAction` ×0.65 (pine 12→8, willow 18→12, copper/tin 14→9,
  minnow 10→6, trout 22→14, oak 38→25, iron 35→23, perch 40→26, coal 50→32,
  charwood 58→38, eel 55→36). Campfire lighting 3→2.
- Production `xpPerAction` ×0.6 across recipes.json (round sensibly).
- `masteryXpPerAction` halved (mastery should trail skill early).
- Kill the speed snowball: in `resolveGathering`, `speedBonus = skillLevel*3 +
  haftTier*120` (was `*8`/`*200`) — same engine file/section as 6b.1.
- Zone `richness` stays (it's the reward for pushing into danger).

### 6b.3 Feel targets (verify by simulation, not vibes)
Write a throwaway script (`scripts/pace-sim.ts`, run with tsx, delete after or
keep in repo) that calls `resolve()` over simulated hours and prints time-to-level:

| Milestone | Target (active play) |
|---|---|
| Woodcutting 10 | ~50-70 min |
| First copper hatchet crafted | ~2 hours in (needs WC + mining + all 3 components) |
| Any skill 30 | 2-3 days of casual idle |
| Any skill 50 | ~2-3 weeks |
| Any skill 70 | ~2 months |
| 99 | a year of devotion — a real flex |

If sim results are >±30% off target, tune §6b.2 numbers and rerun. Commit the
sim output table in the commit message.

### 6b.4 Early-game friction (deliberate, OSRS-style)
- Worn tools (§5b) are tier 1 AND get a flat −8% success (they're WORN) — one
  more reason the first crafted copper tool feels amazing.
- Satchel starts at 10 slots (already true) — banking trips are part of the
  loop until Small Satchel (~crafting 5).

## 6c. Retention, juice & "one more level" (Phase 5b)

What makes it addictive without dark patterns:

1. **Onboarding deed (first 15 min, scripted)**: wake at cold ashes → sparkle
   nudge to worn hatchet → chop 3 logs (misses teach the success roll — add
   message *"You swing at the tree... nothing yet."*) → light the campfire
   (consumes 2 logs) → cook first minnow → Deed complete → reward: **Dusty Lamp**
   (OSRS-style xp lamp item: use → pick a skill → +50xp). Implement as a simple
   ordered checklist in a `deeds.json` + store slice; show as a subtle quest-log
   line under the HUD.
2. **Next-unlock teasers everywhere** (Melvor's best trick): skills tab rows and
   the ActionHUD show *"Next: Oak trees at Woodcutting 15"* — computed from a
   static `unlocks.ts` table (node/recipe level reqs already in gamedata).
3. **Level-up moment** (OSRS fireworks): canvas particle burst above the
   character (gold/white, 20 particles, 700ms), skill-icon toast, panel row
   glow. Milestone levels (10/25/50/75/92/99) get a bigger burst + full-width
   banner toast.
4. **Glimmers = the Idle Slayer layer**: keep random glimmer spawns; tapping one
   now ALSO grants **Focus: +12% gather success for 90s** (client-passed flag →
   include in successFP calc via a `focusUntil` timestamp in PlayerState?— NO:
   keep engine pure; implement Focus as a client-side buff that calls
   startAction with a `focus` node... TOO COMPLEX → simplest honest version:
   glimmer tap grants motes + instantly completes the current action. Ship that.)
5. **Collection log** (OSRS): `collectedItemIds` already tracks firsts — add a
   Log sub-tab (inventory tab) showing all items as silhouettes, filled when
   collected, with per-zone completion %. Rares/pets get gold borders.
6. **Pets follow you**: pet drops exist in engine (1/50k actions). When owned,
   draw the pet sprite trailing 1 tile behind the character. Announce with
   fanfare + collection log entry. (LPC has cat/dog/bird sprites.)
7. **Examine text**: every item and node gets one wry line (items.json
   `examine` field). Message log, bottom-left, last 4 messages, fades.
8. **Backlog (do NOT build now, note for later)**: zone achievement diaries,
   shooting-star style random events, traveling merchant, bank placeholders,
   loadout presets, seasonal patterns on the Loom.

## 6d. iOS readiness checklist (verify at Phase 4 and again at Phase 6)

- [ ] **Create real PWA icons** — `apps/web/public/icon-192.png` and
      `icon-512.png` are referenced by the manifest but DO NOT EXIST (also
      note: a stray `public/` at repo root is unused by Vite — assets belong in
      `apps/web/public/`). Draw a simple loom/tree pixel icon.
- [ ] `apple-touch-icon` 180px + correct manifest `display: standalone`.
- [ ] Test 390×844 and 430×932 portrait: no horizontal scroll, panel usable,
      canvas letterboxes around the 20×11 tile world gracefully.
- [ ] All tap targets ≥ 44px; no hover-only affordances (context menu =
      long-press 350ms on touch).
- [ ] `100dvh` root (done), safe-area padding on tab bar (done — keep).
- [ ] Panel scroll uses `-webkit-overflow-scrolling: touch`;
      `overscroll-behavior: contain` so the page never rubber-bands.
- [ ] Add-to-Home-Screen: after the onboarding deed completes, show a one-time
      dismissible hint ("Install Everloom for offline play").
- [ ] Verify Supabase auth persists in standalone PWA mode (localStorage does).

## 7. Phases, order, and acceptance criteria

Work strictly in this order; each phase must build (`pnpm build`) and be
verified in the browser before the next.

**Phase P — pacing (§6b), FIRST**: success rolls, data rebalance, pace
simulation. Do this before graphics so every later playtest happens at real
speed. ✔ sim table hits §6b.3 targets; fresh character takes ~an hour to WC 10.

**Phase 0 — assets** (no code): download sheets listed in §3 into
`apps/web/public/sprites/`, update CREDITS.md with authors. ✔ files exist,
licenses noted.

**Phase 1 — WorldCanvas + tilemap**: canvas renders Meadowrest map w/ animated
water, decor, node sprites at tile positions, name labels. Old SVG scene gone.
✔ zone visibly made of real tiles at correct scale, 60fps, no blur (pixelated).

**Phase 2 — character**: LPC compositing + tint by appearance; idle/walk/chop/
mine/fish anims play from sheet rows; character drawn y-sorted.
✔ appearance editor colors visibly change the sprite; walk cycle animates.

**Phase 3 — point & click**: BFS pathing, click markers, walk-then-act flow,
walking cancels action. ✔ click ground → walks there; click pine → walks, faces
it, chops, logs appear in inventory; click water mid-chop → cancels and walks.

**Phase 3b — equipment & tools** (§5b): no-tool gating, ground item spawns,
assemble/equip flow, context menu, equipment tab data. ✔ criteria in §5b.

**Phase 4 — OSRS-mobile interface (§6 rewritten)**: GamePanel toggleable
bottom-right, scrollable 4-col inventory, all tabs in the shell, facility
menus, icon atlas, xp drops; delete InventoryBar/TabStrip/slide-up panels.
✔ panel behaves exactly like OSRS mobile at desktop AND iPhone width; world
stays visible and live behind it; inventory scrolls smoothly at 56+ slots.

**Phase 5 — ambience**: campfire 4-frame fire, fishing ripples, waterfall anim
(2-frame offset scroll), cloud shadows (slow moving translucent ellipses),
birds (3-frame, occasional flyover). ✔ scene feels alive at idle.

**Phase 5b — retention & juice (§6c)**: onboarding deed + lamp, next-unlock
teasers, level-up fireworks, glimmer action-complete, collection log, pet
follower, examine/message log. ✔ a new player's first 15 minutes is guided and
ends with a cooked minnow and a lamp; leveling visibly celebrates.

**Phase 6 — zones 2+3 maps + deploy**: bramblewood (dusk palette tiles) and
ashen_delve (cave tileset) maps + node placements + facility placements; iOS
checklist (§6d) full pass; run full build; push; verify Vercel deployment on
desktop + iPhone. ✔ live URL shared with user.

**Definition of done for the whole overhaul**:
1. A stranger screenshots the game and reads "a cute OSRS-like", not
   "developer placeholder art".
2. A fresh account's first hour: guided by the deed, blocked without tools,
   finds/builds them, reaches ~WC 8-10, has opened/closed the bottom-right
   panel naturally on a phone — and wants tomorrow's return report.

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
- Any engine/gamedata/Supabase changes beyond the single scoped change in §5b.1
  and the gamedata additions in §5b (new items/recipes/examine text).
- New skills (user said: graphics first, skills later).
