# IMPLEMENTATION PLAYBOOK — apps/client3d

> **You are the implementing model. This file removes all guesswork.**
> Every filename here is VERIFIED to exist on disk. Every contract is exact.
> Work ONE task at a time, in order. Stop after each for supervisor review.
> Read `../../PROJECT_REBOOT_3D.md` §0 once for context on why rigour matters.

---

## GOLDEN RULES (violating any of these fails the task)

1. **Assets are already installed. DO NOT DOWNLOAD ANYTHING.** 569 files, 32 MB,
   verified. See `ASSET_INVENTORY.md`. If a model seems missing, `ls` the folder
   — do not fetch.
2. **Never claim something works unless you SAW it work in the browser.** Write
   `BLOCKED: <reason>` and stop instead. A false "done" is the worst outcome.
3. **No full-screen DOM overlays above the canvas, ever.** No scrims. UI must be
   tightly bounded elements. A full-bleed div eats every world click.
4. **One rAF loop, created once.** Never key the render effect on state that
   changes during play (actions, positions). Read live values through refs.
5. **Verify clicks with real hit-testing**: `document.elementFromPoint(x,y)` then
   dispatch on THAT element. Dispatching straight onto the canvas hides overlay
   bugs and is not acceptable proof.
6. **Do not edit `apps/web`** (dead 2D client) or `packages/engine` unless a task
   says so explicitly.
7. TypeScript strict. `pnpm build` from repo root must be green before you report.

---

## SCREENSHOT PROOF — copy-paste recipe (required at every task)

The preview pane often can't screenshot. Use this instead. The renderer is
already created with `preserveDrawingBuffer: true` — keep it that way.

**Step 1** — in the browser (javascript_tool), after the scene has rendered:
```js
(function(){
  const c = document.querySelector('canvas');
  const t = document.createElement('canvas');
  const w = 480, h = Math.round(w * c.height / c.width);
  t.width = w; t.height = h;
  t.getContext('2d').drawImage(c, 0, 0, w, h);
  return t.toDataURL('image/jpeg', 0.7);   // returns "data:image/jpeg;base64,...."
})()
```
**Step 2** — strip the `data:image/jpeg;base64,` prefix, write the rest to
`apps/client3d/proof/<name>.b64`, then:
```bash
cd apps/client3d/proof && node -e "const fs=require('fs');const b=fs.readFileSync('<name>.b64','utf8').replace(/\s/g,'');fs.writeFileSync('<name>.jpg',Buffer.from(b,'base64'));console.log('ok',fs.statSync('<name>.jpg').size)"
```
**IMPORTANT (learned the hard way):** run the `node -e` from *inside* the proof
directory with a relative filename. Absolute `/c/Users/...` paths break under
Git Bash on this machine.

Produce two per task: `<task>-desktop.jpg` (1280×720) and `<task>-mobile.jpg`
(390×844, set via the resize tool). Then report the filenames — the supervisor
opens them directly.

---

## VERIFIED MODEL FILENAMES — use these exact strings

Paths are relative to `/models/` (served from `public/models/`).

**Careful:** most `kaykit-dungeon` files have a **double extension** `.gltf.glb`.
`kenney-*` files are plain `.glb`.

### Player + enemies
| Purpose | Path |
|---|---|
| Player (rigged, 76 clips) | `kaykit-adventurers/Character.glb` |
| Skeleton (lv2) | `kaykit-skeletons/Skeleton_Minion.glb` |
| Skeleton Archer (lv5) | `kaykit-skeletons/Skeleton_Rogue.glb` |
| Armoured Skeleton (lv9) | `kaykit-skeletons/Skeleton_Warrior.glb` |
| Skeleton Mage (lv14) | `kaykit-skeletons/Skeleton_Mage.glb` |
| Boss — reuse Warrior scaled 1.45 + dark tint | `kaykit-skeletons/Skeleton_Warrior.glb` |

### Nature (`kenney-nature/`, plain .glb)
Trees: `tree_oak.glb` `tree_default.glb` `tree_detailed.glb` `tree_fat.glb`
`tree_blocks.glb` `tree_cone.glb` (each also has `_dark` and `_fall` variants)
Rocks: `rock_largeA.glb`…`rock_largeF.glb`, `rock_smallA.glb`…`rock_smallF.glb`
Foliage: `plant_bush.glb` `plant_bushLarge.glb` `grass.glb` `grass_large.glb`
Bridge: `bridge_wood.glb`

### Town (`kenney-fantasy/`, plain .glb) — MODULAR, there is no `house.glb`
Compose cottages from: `wall.glb` `wall-door.glb` `wall-window-shutters.glb`
`roof-gable.glb` `roof-gable-end.glb` `chimney.glb`
Props: `fountain-round.glb` `cart.glb` `lantern.glb` `fence.glb`
`banner-green.glb` `hedge-large.glb`

### Dungeon (`kaykit-dungeon/`, **`.gltf.glb`** except chest)
`torch_lit.gltf.glb` `wall_arched.gltf.glb` `barrel_small.gltf.glb`
`crates_stacked.gltf.glb` `pillar_decorated.gltf.glb` `chest_gold.glb` (plain!)
`floor_dirt_large.gltf.glb`

---

## ANIMATION CLIPS (player) — exact names, from ANIMATION_CLIPS.md
Use: `Idle`, `Walking_A`, `Running_A`, `1H_Melee_Attack_Chop` (woodcutting),
`1H_Melee_Attack_Slice_Diagonal` (combat), `Interact` (mining/fishing/pickup),
`PickUp`, `Death_A`. Full list in `ANIMATION_CLIPS.md` — read it, don't guess.

---

# TASK 1 — World data file (DATA ONLY, no rendering)

**Create** `src/world/worlddata.ts`. Pure data + tiny pure helpers. No Three.js
imports. This is the whole map as declarative data.

**Exports (exact names and shapes — later tasks depend on these):**
```ts
export const WORLD_SIZE = 120;
export const WORLD_MIN = -60;   // world spans -60..60 on X and Z
export const WORLD_MAX = 60;

export type Surface = 'grass'|'darkgrass'|'dirt'|'cobble'|'stone'|'water';
export const SURFACE_COLOR: Record<Surface, number>;   // hex ints
export const WALKABLE: Record<Surface, boolean>;       // water:false, rest true

export type Paint =
  | { shape:'rect';   surface:Surface; x:number; z:number; w:number; d:number }
  | { shape:'circle'; surface:Surface; x:number; z:number; r:number }
  | { shape:'path';   surface:Surface; from:[number,number]; to:[number,number]; width:number };
export const PAINT: Paint[];      // applied in order, later entries overwrite

export interface PropPlacement {
  model:string; x:number; z:number;
  rotY?:number; scale?:number; blocks?:number; tint?:number;
}
export const PROPS: PropPlacement[];

export type InteractKind = 'tree'|'rock'|'fishing'|'furnace'|'anvil'|'cookfire'
  |'bank'|'npc'|'enemy'|'grounditem'|'dungeondoor';
export interface Interactable {
  id:string; kind:InteractKind; label:string; x:number; z:number;
  model?:string; scale?:number; tint?:number;
  nodeId?:string; itemId?:string; enemyId?:string; pick?:number;
}
export const INTERACTABLES: Interactable[];

export const SPAWN: { x:number; z:number };
```

**Layout to encode** (X east, Z south; town at origin):

| Area | Region | Surface |
|---|---|---|
| base | whole map | `grass` |
| Loomwood Forest | west: x −60..−26, z −30..34 | `darkgrass` |
| Burrow Mine | north: x −14..26, z −60..−34 | `stone` |
| Training Grounds | east: x 24..56, z −12..22 | `dirt` |
| Silverthread River | south: full width, z 34..50 | `water` |
| Thimblewick square | circle centre (0,4) r 15 | `cobble` |
| 4 dirt roads | town→forest, town→mine, town→training, town→river | `dirt` |

**PROPS requirements:**
- Write a `cottage(ox, oz, rot, wide)` helper returning `PropPlacement[]` that
  composes walls + gable roof + chimney (kit is modular). Place **4 cottages**
  around the square, none inside radius 15 of (0,4).
- Town dressing: fountain at (0,4) `blocks:2.2`, cart, 2 lanterns, banner, hedges.
- Write a **seeded** scatter helper (deterministic — same world every load; use a
  simple LCG, never `Math.random`). Scatter ~46 trees in Loomwood (`blocks:1.1`,
  scale 1.4–2.4), ~16 large rocks in the Mine (`blocks:1.6`), riverbank foliage.
- Scatter must accept keep-out circles and skip them: keep everything out of the
  town circle and off the 4 roads (avoid radius ≥5 around road endpoints).
- Mine mouth dressing: `wall_arched.gltf.glb` scaled ~2.2, two `torch_lit`,
  barrel, crates. Fences along the north and south edges of Training Grounds.
- Wooden bridge over the river at approximately (−4, 38), rotated 90°.

**INTERACTABLES requirements** (ids must be exactly these — later tasks use them):
- Trees `tree_1`…`tree_5` in Loomwood. `nodeId` values: `meadowrest_pine` (×2),
  `meadowrest_willow` (×2), `meadowrest_oak` (×1). Models: cone/detailed/oak.
- Rocks `rock_cu1`,`rock_cu2` (`meadowrest_copper_vein`, tint `0xb8703a`),
  `rock_sn1` (`meadowrest_tin_vein`, tint `0xc9ccd2`), `rock_fe1` (`ashen_iron`,
  tint `0x8a6a58`) — all in the Mine.
- Fishing `fish_1`(`meadowrest_minnow_pool`), `fish_2`,`fish_3`
  (`meadowrest_trout_stream`) — on the **grass bank at z≈33**, NOT in the water.
- Facilities in town: `furnace`, `anvil`, `cookfire`
  (`nodeId:'meadowrest_campfire'`), `bank` (`chest_gold.glb`).
- NPCs: `npc_wren` ("Wren the Weaver"), `npc_guard` ("Watchman Bram").
- Ground items: `gi_hatchet` (`worn_hatchet`) near the forest path,
  `gi_pickaxe` (`worn_pickaxe`) near the mine path, `gi_rod`
  (`worn_fishing_rod`) on the riverbank. All `pick:2.2`.
- Enemies `sk_1`…`sk_5` + `boss` in Training Grounds, models per the table above.
- `dungeon_door` at the back of the Mine (long-term tease).
- Every interactable gets `pick` between 2.0 and 2.6 (finger-sized).

**SPAWN**: `{ x: 0, z: 12 }` — town square, south of the fountain.

**Definition of done:** `pnpm build` green; add a temporary node script or a
`console.log` in dev to assert: PAINT length ≥ 10, PROPS length ≥ 90,
INTERACTABLES length ≥ 25, and **every `model` string in PROPS and
INTERACTABLES resolves to a real file** (write a throwaway node script that
checks `fs.existsSync` for each against `public/models/` and prints any misses —
this catches the `.gltf.glb` trap). Report the three counts and "0 missing
models". No screenshots needed for this task (no rendering yet).

---

# TASK 2 — Terrain + nav grid (still no player movement)

**Create** `src/world/navgrid.ts`:
```ts
export class NavGrid {
  constructor(size: number, min: number);        // 120, -60 → 1 unit cells
  blocked: Uint8Array;                            // size*size, 1 = blocked
  worldToCell(x:number,z:number): {cx:number,cz:number};
  cellToWorld(cx:number,cz:number): {x:number,z:number};   // cell CENTRE
  isWalkable(cx:number,cz:number): boolean;
  blockCircle(x:number,z:number,r:number): void;
  /** A* 8-directional, no corner-cutting. Returns world-space waypoints. */
  findPath(from:{x:number,z:number}, to:{x:number,z:number}): Array<{x:number,z:number}>;
  /** Nearest walkable cell to a point, spiral search — for clicks on blocked tiles. */
  nearestWalkable(x:number,z:number,maxR?:number): {x:number,z:number}|null;
}
```
A* must be plain and allocation-light: binary-heap or sorted-array open set,
Manhattan/octile heuristic, cap explored nodes at 20000 and return `[]` if
exceeded (never hang the frame).

**Create** `src/world/buildTerrain.ts`:
```ts
export function buildTerrain(): {
  mesh: THREE.Mesh;          // single merged PlaneGeometry, vertex-coloured
  water: THREE.Mesh;         // separate flat plane at y = -0.06
  surfaceAt(x:number,z:number): Surface;
  nav: NavGrid;              // water + PROPS `blocks` already applied
}
```
- One `PlaneGeometry(120,120,120,120)` rotated flat. Rasterise `PAINT` into a
  per-cell `Surface[]`, then set **vertex colours** from `SURFACE_COLOR`
  (material: `MeshLambertMaterial({ vertexColors:true })` — cheap on mobile).
- Water: separate plane over the water region, colour `SURFACE_COLOR.water`,
  slight transparency, `y = -0.06` so it reads as below the bank.
- Populate `nav`: block every water cell, then `blockCircle` for each PROP with
  `blocks`. **Do not block interactables** — the player must path adjacent to
  them, that's handled later.

**Definition of done:** screenshots (desktop + mobile) showing the coloured
terrain — visibly distinct green forest / grey mine / brown training ground /
cobble town circle / blue river with the dirt roads readable. Log and report the
blocked-cell count (sanity: water alone is ~2000+ cells). Build green.

---

# TASK 3 — Props + interactables placed in the scene

**Create** `src/world/assets.ts`:
```ts
export function preload(paths: string[]): Promise<void>;   // GLTFLoader + cache
export function instance(path: string, opts?: {scale?:number; rotY?:number; tint?:number}): THREE.Object3D;
```
- Cache each GLB once; `instance()` returns `SkeletonUtils.clone()` for rigged
  models and a plain `.clone()` for static props.
- `tint` multiplies the base colour of cloned materials (clone the material
  first — never mutate the cached original).
- **Performance:** for static props that repeat (trees, rocks, fences), the
  first pass may use plain clones. If desktop fps drops below 50, convert the
  repeated ones to `THREE.InstancedMesh` grouped by model. Report your fps.

**Create** `src/world/buildProps.ts`:
```ts
export function buildProps(scene: THREE.Scene): {
  interactables: Array<{ data: Interactable; object: THREE.Object3D; picker: THREE.Mesh }>;
};
```
- Place every `PROPS` entry. Random-but-seeded rotation when `rotY` is absent.
- Place every `INTERACTABLES` entry that has a `model`. For those without one
  (`fishing`, `npc`, `grounditem`), create a clear stand-in: fishing = a small
  flat ripple ring on the water edge; npc = an instance of the player model
  tinted differently, playing `Idle`; grounditem = the item shape lying flat
  with a **pulsing gold glow** so it's obviously collectable.
- Every interactable additionally gets an **invisible pick cylinder**:
  `new THREE.Mesh(new THREE.CylinderGeometry(pick, pick, 4, 8), new THREE.MeshBasicMaterial({visible:false}))`
  positioned at the interactable, `userData.interactableId = data.id`. These are
  the ONLY things the click raycaster tests against for objects (plan §9 rule 3).

**Definition of done:** screenshots showing the town with 4 cottages + fountain,
the forest, the mine mouth, the training ground with 5 visible skeletons + the
larger dark boss, and the 3 glowing ground items. Report fps at desktop.
Build green.

---

# TASK 4 — Tap-to-move

Refactor `src/App.tsx` into `src/game/Game.tsx` (keep `App.tsx` as a thin
wrapper). Scene setup, single rAF loop, camera per below.

**Camera (exact — the supervisor corrected this at P0):**
FOV 45, yaw 45°, **pitch 45° down, distance 11**, smooth-follow lerp 0.08,
`lookAt(player.x, player.y + 1.2, player.z)`. The sky gradient MUST be visible
at the top of the frame and the character should occupy roughly ⅓ of frame
height. At P0 the camera was too steep/distant and the ground filled everything —
do not repeat that.

**Movement module** `src/game/movement.ts`:
```ts
export interface Mover {
  pos: THREE.Vector3;  // current world position
  path: Array<{x:number,z:number}>;
  speed: number;       // 4.5 units/sec
  facing: number;      // radians, Y rotation
}
export function update(m: Mover, dt: number): 'idle'|'moving'|'arrived';
```
- Move along the path at constant speed; **linear** interpolation toward the next
  waypoint (never ease-toward-current-position — that stutters and never
  arrives; this exact bug shipped in v1).
- Turn smoothly toward heading (lerp the angle, ~10 rad/s), don't snap.
- On the final waypoint, snap exactly and return `'arrived'`.

**Input** `src/game/input.ts` — pointerdown on the canvas:
1. Convert to NDC, raycast.
2. Test the **pick cylinders first**. Hit → red marker, path to
   `nav.nearestWalkable` next to it, store `pendingInteractableId`.
3. Otherwise raycast the terrain mesh → yellow marker, path there. If the target
   cell is blocked, use `nearestWalkable`.
4. Marker: a flat ring on the ground that shrinks and fades over 500 ms.
5. Use **Pointer Events** (`pointerdown`), `touch-action:none` on the canvas, and
   call `setPointerCapture` off — single taps only, no drag handling yet.

**Animation**: `Running_A` while moving, `Idle` when stopped, cross-faded 0.15 s.

**Definition of done — this is the gate that matters:**
- Screenshot triple at desktop: (a) idle in town, (b) marker visible right after
  a tap on a distant spot, (c) character arrived at that spot.
- Same at mobile 390×844.
- Prove the click path with **real hit-testing**: report the output of
  `document.elementFromPoint(x,y).tagName` at your tap point — it must be
  `CANVAS`. If anything else is on top, fix that before reporting.
- Walk from town into the forest and confirm you cannot walk through a tree or
  into the river (report what happened when you tried).
- fps ≥ 55 desktop. Zero console errors. Build green.

---

## AFTER TASK 4
Stop. The supervisor reviews, then issues Tasks 5+ (gathering loop, UI,
persistence, combat) as separate instructions.

## REPORT TEMPLATE (use verbatim)
```
TASK <n>: <COMPLETE | BLOCKED>
Files created/changed: <list>
Build: <tail of pnpm build>
Proof images: <filenames under apps/client3d/proof/>
Real hit-test result: elementFromPoint at (x,y) => <TAG>
fps: <desktop> / <mobile>
Console errors: <none | list>
Counts/assertions: <the numbers the task asked for>
Deviations from playbook: <none | what and why>
BLOCKED reason (if any): <...>
```
