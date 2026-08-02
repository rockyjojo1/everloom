# Gate 0 Stage B: Meadowrest Visual Vertical Slice

**Version:** 1.0  
**Status:** Specification and Implementation Plan  
**Scope:** Eight key moments from player arrival through first gathering contact

---

## Overview

Stage B improves the visual clarity and landmark hierarchy of Meadowrest for the critical tutorial moments: arrival → exploration → tool discovery → gathering. Each moment has a specific visual purpose and anchor landmark.

---

## Eight Key Moments and Visual Improvements

### Moment 1: Arrival and First Orientation

**When:** Player dismisses character creation screen and first enters Meadowrest  
**Current state:** Flat meadow with distant trees; no clear landmark to orient toward  
**Visual improvement:** Add a **primary landmark** — Meadowrest Hall (the settlement building)

**Specifications:**
- **Location:** Grid position (22, 19) — center-north of the meadow zone
- **Size:** 6.5 world units wide, 5.5 units tall (clearly visible from 20+ units away)
- **Visual role:** The "home" anchor; player instinctively knows to return here
- **Construction:** Simple stone building (cube-based) with a clear roof/gable silhouette
- **Materials:** Grey stone (0x7d7566 from PALETTE), dark wood eaves, small window openings
- **Landmark feature:** A warm light inside the building (existing fireLight at this location already hints at this)

**Rendering:**
- Building casts and receives shadows
- Distinctive silhouette readable in grayscale
- Doorway entrance clearly marked (slightly lighter stone around frame)

**Camera framing:** At intro, camera positioned so Hall is visible ~20% off-center at horizon

---

### Moment 2: Initial Spawn and Safe Space

**When:** Player character first placed in the world  
**Current state:** Player spawns at grid origin; no clear "safe" gathering area nearby  
**Visual improvement:** Add **secondary landmark** — Meadowrest Gate/Entry arch at spawn point

**Specifications:**
- **Location:** Grid (24, 25) — just south of the Hall, where the intro path ends
- **Size:** 3.5 units tall, 4.0 units wide (a memorable threshold)
- **Visual role:** A transition landmark showing "you've entered a settlement"
- **Construction:** Two pillars with a horizontal arch overhead (stylized, not realistic)
- **Materials:** Weathered stone pillars (0x7d7566), worn wood arch (0x8b6341)
- **Purpose:** Frames the player's initial view toward the Hall; creates spatial hierarchy

**Rendering:**
- Pillars cast shadows independently
- Arch is solid and walkable (not a collision, just visual)
- Clear path visible on ground through the arch

**Integration:** Path-finding grid treats this as a landmark, not a barrier

---

### Moment 3: Guided Navigation to Verdant Grove

**When:** Player first objective sends them west to the Verdant Grove  
**Current state:** Meandering path is unclear; western grove area reads the same as meadow  
**Visual improvement:** Add **path clarity** landmarks and **grove entrance marker**

**Specifications:**

**Path Route (Meadowrest → Verdant Grove):**
- Clear walking path with visible color distinction (lighter, worn path vs. grass)
- Path width: 2.2 world units (wide enough to feel safe)
- Path material: Lighter dirt (0xb18b58 from PALETTE, slightly brightened)
- Intermediate landmark at path corner (24, 17): small **Waystones** (3 upright stones)

**Verdant Grove Entrance:**
- **Location:** Grid (8, 12) — western edge of the meadow
- **Marker:** Stone pillar + archway with entwined vine detail (stylized, Three.js primitives)
- **Vegetation transition:** Noticeably greener grass starting at grove entrance
- **Lighting:** Slightly cooler, dappled shadows from overhead tree canopy (reduce hemisphere light intensity by 0.2 in this region)

**Rendering:**
- Entrance arch is clearly distinct from standard meadow terrain
- Grass color shifts from 0x70a95a (meadow) to 0x3f8a58 (grove) at threshold
- Small trees/tufts increase in density approaching the arch

---

### Moment 4: Activity Discovery — Woodcutting Tree

**When:** Player reaches the grove and discovers the woodcutting resource  
**Current state:** Trees are scattered procedurally; target tree is not distinctive  
**Visual improvement:** Add a **singular, iconic woodcutting tree** as the primary resource landmark

**Specifications:**
- **Location:** Grid (5, 8) — western grove, easily reachable from entrance
- **Marker tree:** Much larger than surrounding trees (3.5× scale)
- **Visual distinctiveness:** Slightly different color (warmer brown, more saturated)
- **Animation:** Subtle sway (wind effect) to draw attention
- **Interact radius:** 1.5 units (player can approach from multiple angles)
- **Feedback:** Slight glow or shimmer around trunk when player comes within 8 units (uses existing objectiveBeaconLight if this is an objective)

**Rendering:**
- Iconic tree casts dramatic shadow westward
- Bark texture shows tool marks or damage (procedural detail on the trunk)
- Canopy is dense and clearly readable as "thing you can cut"

**World interaction:**
- Resource node placed exactly at this tree's position
- Ground around tree is cleared (no other trees within 1.2 unit radius)
- Small pile of logs visible at tree base (0.5-unit tall boxes, brown material 0x8b6341)

**Camera behavior:** When player reaches grove, subtle camera pan to frame the tree in the right third of screen

---

### Moment 5: Tool Visibility and Availability

**When:** Player learns they need a hatchet to gather  
**Current state:** Hatchet is on the ground somewhere; not visually obvious where  
**Visual improvement:** Add **tool staging area** with visible, glowing tool ground-items

**Specifications:**
- **Location:** Grid (10, 11) — between grove entrance and the woodcutting tree
- **Items:** Three ground-spawned items in a loose group:
  1. Worn Hatchet (at 10.2, 11.3)
  2. Worn Pickaxe (at 10.8, 11.2)
  3. Worn Fishing Rod (at 9.5, 11.5)
- **Visual treatment:** Each item has a subtle glow (additive ring similar to objectiveBeacon)
- **Spacing:** Items spread 0.6–0.8 units apart (easy to distinguish, not a pile)
- **Ground:** Slightly darker patch of grass (worn area) underneath tools

**Rendering:**
- Each tool casts a small shadow
- Glow intensity is lower than objective beacon (doesn't overwhelm the scene)
- Tools are slightly elevated (0.05 units up) to read as "placed intentionally," not "lying flat"

**Narrative:** This area reads as "the tool depot" — a place the player naturally returns to swap tools

---

### Moment 6: Tool Acquisition (Hatchet)

**When:** Player clicks and picks up the Worn Hatchet  
**Current state:** No visual feedback beyond inventory update  
**Visual improvement:** Add **collection animation and world feedback**

**Specifications:**

**Visual feedback when clicking hatchet:**
1. **Glow pulse** (0.3s): Glow around hatchet intensifies briefly
2. **Character reach** (0.3s): Character plays "pickup" animation (existing "Idle" animation layer transitions)
3. **Item vanish** (0.2s): Hatchet fades out and disappears from world
4. **Inventory update** (immediate): HUD shows "Worn Hatchet +1"

**Audio** (out of scope for this phase, but reserve in code):
- Soft "clink" sound effect on pickup (to be added later)

**Rendering:**
- Pickup animation: character bends slightly toward the tool, reaches down
- Item fade: alpha dissolve, not instant removal
- HUD feedback: toast notification shows tool name and icon

**Code location:** GameWorld.tsx `targetAvailable()` branch for ground_item, visual feedback in renderLoop

---

### Moment 7: Tool Equipping and Animation

**When:** Player equips the Worn Hatchet to ready it for gathering  
**Current state:** Tool appears in character's hand; no transition animation  
**Visual improvement:** Add **equip animation and pose feedback**

**Specifications:**

**Equip animation:**
1. **Idle frame** (0.5s): Character stands in normal idle pose with empty hands
2. **Reach animation** (0.4s): Character reaches toward left side (to holster/pack)
3. **Draw animation** (0.3s): Character draws hatchet up to ready position
4. **Ready pose** (hold): Character stands with hatchet held in right hand, ready

**Tool attachment (existing code already does this):**
- Hatchet position: calibrated transform from equipmentPresentation.ts
- Hatchet rotation: angled toward front (active end forward)
- Hatchet scale: 0.62 world units

**Visual confirmation:**
- HUD shows tool equipped (icon + name)
- Tool glow fades now that it's in player's hand (no longer a world ground item)
- Character silhouette clearly shows they're holding something

**Rendering:**
- Character model shows the tool visibly in hand
- No clipping into arms or torso (validated by equipment transforms)
- Tool casts shadow alongside character shadow

---

### Moment 8: Gathering Contact and Feedback

**When:** Player approaches the woodcutting tree and gathers (contact frame)  
**Current state:** No visual feedback during gathering action; tree doesn't respond  
**Visual improvement:** Add **tree feedback animation and gather effect**

**Specifications:**

**Player gathering action:**
- **Approach:** Player walks to within 1.5 units of tree center
- **Animation:** Plays "1H_Melee_Attack_Chop" clip (axe swinging animation)
- **Contact point:** Tree trunk visual changes on action completion
- **Feedback effect:** Particle effect at contact point (wood chips, dust)

**Tree response to gathering:**
1. **Swing frame** (0.3s): Axe swings downward toward trunk
2. **Contact frame** (0.1s): Visual impact at trunk (brief white flash, 0.8 intensity)
3. **Recovery** (0.4s): Character returns to ready pose
4. **Repeat:** Tree stays intact (this is a resource node with cooldown, not destructible)

**Particle effect at contact:**
- **Spawn:** At tree trunk, ~1.5 units up
- **Particles:** 12–20 small brown cubes or rectangles
- **Behavior:** Burst outward and downward, fade over 0.4s
- **Color:** 0x8b6341 (wood brown) to match logs
- **Scale:** 0.08–0.15 unit cubes

**HUD feedback:**
- Toast: "Chopping wood... [progress]"
- Action bar: Visual timer until next gather available
- Resource counter: "+1 Wood" or similar on gather completion

**Rendering:**
- Particle system uses instanced geometry for performance
- Flash effect uses full-screen shader or bright mesh
- All effects are additive blended (read clearly against daylight)

**Audio** (reserved for future):
- "Thunk" sound on axe contact
- Subtle tree creak sound
- Ambient wood chip scatter sound

---

## Visual Hierarchy Summary

### Primary Anchor (always visible)
- Meadowrest Hall: 6.5 × 5.5 world units, center-north position

### Secondary Navigation
- Entry Gate/Arch: 3.5 × 4.0 units, south of Hall
- Waystones: 0.8 unit pillars at path corners
- Grove Entrance Arch: 2.5 × 2.2 units, western threshold

### Activity Focal Points
- Woodcutting Tree: 3.5× scale, ~3.0 units tall canopy
- Tool Staging Area: Three small tool meshes with glow, ~10 units west of grove entrance

### Environmental Details
- Path color distinction: 0xb18b58 worn dirt vs. 0x70a95a meadow grass
- Grove entrance: Grass color shifts to 0x3f8a58
- Logs at tree base: 0.5-unit brown boxes
- Particle effects: Wood chips at gather contact

---

## Implementation Checklist

### Code Changes Required

**Environment (environment.ts):**
- [ ] Add Meadowrest Hall mesh: buildHall() function
- [ ] Add Entry Gate/Arch mesh: buildGate() function
- [ ] Add Waystones as small pillar group
- [ ] Add Grove entrance marker
- [ ] Adjust terrain grass colors at regional boundaries (already done for soil)
- [ ] Add logs at tree base as micro-props

**GameWorld (GameWorld.tsx):**
- [ ] Load Hall and Gate assets during zone initialization
- [ ] Place lighting for Hall interior glow
- [ ] Add particle effect system for gather feedback
- [ ] Wire up pickup animation on ground item collection
- [ ] Wire up equip animation when tool is ready
- [ ] Add gather contact effect (flash + particles)
- [ ] Integrate tree response animation

**Assets (assets.ts):**
- [ ] addMeshToScene() utility for landmark placement
- [ ] particleEffectSystem for wood chips and gather feedback

**Appearance/Equipment (already in place):**
- [ ] Character pickup animation (use existing "Idle" transition)
- [ ] Hatchet hold pose via equipmentPresentation.ts (already defined)
- [ ] Gather animation uses "1H_Melee_Attack_Chop" clip (already defined)

### Asset Creation Required

**3D Models (Three.js primitives):**
- Hall: BoxGeometry + pyramid roof (ConeGeometry)
- Gate arch: Two CylinderGeometry pillars + BoxGeometry arch bar
- Waystones: Three CylinderGeometry pillars, staggered heights
- Grove arch: BoxGeometry frame + toroidal vine details
- Logs: BoxGeometry rectangles stacked at tree base

**Textures/Materials:**
- Stone material: grey, roughness 0.8, metalness 0.0
- Wood material: warm brown, roughness 0.6, metalness 0.05
- Dirt path: light tan, roughness 0.95, metalness 0.0

**Animations:**
- Pickup animation: leverage existing idle animation set
- Equip animation: new clip "Equip_Hatchet" or reuse tool-ready pose
- Gather animation: existing "1H_Melee_Attack_Chop"

### Testing Requirements

- [ ] Visual hierarchy passes grayscale silhouette test (all 8 moments identifiable)
- [ ] OSRS-lexicon test: materials distinct (stone ≠ wood ≠ grass)
- [ ] Functional clarity test: player always knows where to go next
- [ ] Camera framing test: no important elements clipped off-screen
- [ ] Performance test: <100 draw calls per frame, <512 MB memory
- [ ] Accessibility test: all animations respect prefers-reduced-motion

---

## Performance Budgets

### Draw Calls (Target: ≤100 per frame)
- Terrain mesh: 1 draw call (single plane, vertex-colored)
- Water: 1 draw call
- Hall + Gate + Waystones: 6 draw calls (3 meshes × 2 passes)
- Trees/vegetation: 8 draw calls (instanced tufts)
- NPCs + player: 3 draw calls
- Particles: 1 draw call (instanced geometry)
- Markers/beacons: 4 draw calls
- **Total: ~24 draw calls** (well under budget)

### VRAM (Target: ≤256 MB on mobile)
- Terrain geometry: 2 MB
- Water shader: 0.5 MB
- Landmark meshes: 1.5 MB
- Character rig + decorations: 3 MB
- Textures (base + detail): 2 MB
- Particle system: 0.5 MB
- Animation data: 1 MB
- **Total: ~11 MB** (well under budget)

### Bundle Size (Target: ≤500 KB JavaScript initial)
- No new JavaScript code required; use existing Three.js primitives
- Asset data: JSON zone definitions (already in place)
- **No bundle increase expected**

---

## Camera and Framing

### Moment 1 Framing (Arrival)
- Camera at (16, 19, 20) — existing position
- Meadowrest Hall visible 30% off-center to the right
- Horizon line at approximately 60% of viewport height
- FOV: 43° (existing)

### Moment 4 Framing (Tree Discovery)
- Camera pans to right as player approaches tree
- Woodcutting tree positioned in right-third of screen
- Player character remains left-center
- No camera clipping through tree canopy

### All Gathering Actions
- Camera remains at fixed distance (isometric)
- Player and tree both visible simultaneously
- Particle effects don't obscure character or interface

---

## Accessibility and Reduced Motion

### Animations Affected by prefers-reduced-motion

**Full motion (default):**
- Equip animation: 1.2s total with easing
- Gather animation: 0.8s from start to contact
- Particle effects: 0.4s duration with arc motion
- Camera pan: smooth 2s transition

**Reduced motion mode:**
- Equip animation: static pose transition (no easing, instant)
- Gather animation: 50% speed, 50% amplitude (smaller movements, slower swings)
- Particle effects: replaced with simple fade (no arc motion)
- Camera pan: instant cut (no smooth transition)

### Implementation
- Wrap animations in `if (!prefersReducedMotion)` checks
- Provide static alternative poses
- Use `matchMedia("prefers-reduced-motion")` listeners

---

## Success Criteria for Stage B

Each moment must pass the three visual acceptance gates:

✅ **Silhouette test (grayscale):** Can identify Hall, Gate, Grove, Tree, Tools visually  
✅ **OSRS-lexicon test:** Materials distinct (stone/wood/grass), colors grounded, scale consistent  
✅ **Functional clarity test:** New player knows: "Go to Hall → Walk west to Grove → Find tree → Get hatchet → Gather"

✅ **Performance:** <100 draw calls, <512 MB memory, 60 FPS on mid-range mobile  
✅ **Accessibility:** All animations respect reduced-motion; interface remains readable at all zoom levels  

---

## Next Steps

After Stage B is complete:

1. **Stage C:** Extend visual slice to additional activities (mining, fishing, combat)
2. **Stage D:** NPC interactions and dialogue visual feedback
3. **Stage E:** Environmental storytelling details (ruins, lore markers, historical remnants)
4. **Later:** Replace primitive geometry with proper art assets as they become available

---

**End of Stage B Specification**
