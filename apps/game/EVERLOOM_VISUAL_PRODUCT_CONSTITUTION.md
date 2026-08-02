# Everloom Visual and Product Constitution

**Version:** 1.0  
**Effective:** 2026-08-02  
**Scope:** `apps/game` — the 3D client experience  
**Approved:** Gate 0: Stabilise

---

## Visual Identity

Everloom's visual identity is **OSRS-inspired adventure with Melvor idle pacing**. Specific:

### What "OSRS-Inspired" Means

1. **Asset vocabulary:** Medieval/fantasy equipment, tools, clothing, and environments from 2008–2013 RuneScape era
2. **Color palette:** Earth tones (greens, browns, greys), jewel-tone accents (blues, purples), gold/copper metallics
3. **Silhouette confidence:** Character and NPC silhouettes must remain readable at any camera distance; broad strokes over fine detail
4. **Material honesty:** Cloth reads as cloth (matte, soft), metal reads as metal (reflective, hard), wood reads as wood (diffuse, weathered)
5. **Animation restraint:** Movement is economical, not exaggerated; idle poses include fidgets, not drama

### What "OSRS-Inspired" Does NOT Mean

1. **Copying rigs or meshes:** No extracted OSRS models, rigged characters, or skeleton copies
2. **Art style replication:** Everloom is not attempting to match OSRS's polygon budget or 2000s rendering constraints
3. **UI imitation:** Everloom's interface is distinctly separate from OSRS's (no pixel-perfect UI copying)
4. **Lore borrowing:** Everloom is an original game; OSRS lore, storylines, and named locations are off-limits
5. **Exclusive inspiration:** Melvor Idle, Idle Slayer, and other games inform the design equally

### Licensed Asset Requirement

Every asset in the final game must be:
- Originally authored (written, composed, created, or modeled) by the Everloom team, or
- Explicitly licensed under a permissive free license (CC0, CC-BY, MIT, GPL, or equivalent), or
- Purchased with commercial-use rights

**No** OSRS extracts, **no** fan art recolours, **no** "inspired by" without explicit licensing or original authorship.

---

## Camera and Framing

### Primary Camera Setup

- **Projection:** Perspective (not orthogonal)
- **Field of view:** 35–45° (moderately wide; tighter than third-person action games, wider than isometric strategy games)
- **Distance:** ~3.5–4.5 world units from character head, varying by UI context
- **Angle:** ~25–35° from horizontal (looking down slightly; OSRS angle, not side-on)
- **Pivot point:** Character chest (~1.2 units above feet), not camera position
- **Pan range:** Horizontal ±45°, vertical ±30° (limited to prevent disorientation)

### Zoom Behavior

- **Desktop:** Fixed camera distance, with scroll-wheel zoom limited to ±15% (no extreme close-up or far-bird's-eye)
- **Mobile:** Touch-to-pan replaces scroll zoom; gesture zoom may not be supported (verify accessibility before adding)

### Framing Rules

1. Character must fit comfortably on-screen at all times
2. Tool/weapon in-hand must be fully visible (no hands off-screen clipping)
3. Foreground landmarks must not occlude character head at idle
4. No camera clipping through terrain or solid geometry
5. Vertical field of view must always show clear ground beneath the character (prevent vertigo confusion)

---

## Character and NPC Scale

All humanoid figures are scaled consistently:
- **Character height:** 1.8 world units (head-to-toe standing)
- **NPC height:** 1.6–2.0 world units (shorter, equal, or taller depending on role: child, peer, elder)
- **Doorway height:** 2.4–3.0 world units (a character moves under them without stooping; they're not claustrophobic)
- **Tree canopy height:** 6.0–12.0 world units (distant, imposing; not human-scaled)
- **Building eave height:** 2.8–4.0 world units (accessible from ground, not towering)

**Measure rule:** All scale decisions must relate back to the character height. A door that's 1.5× character height reads as "I can walk under this easily"; 3× reads as "this is monumental."

---

## Character Appearance System

The player character has four fixed appearance IDs (`meadow`, `ember`, `tide`, `dusk`), each:
- Reusing the same rigged base model (`player.adventurer`, KayKit CC0)
- Applying a whole-model color tint (material multiply)
- Layering 2–4 procedural accessory meshes (built from Three.js primitives at runtime)

### Silhouette Distinctness

Each appearance must be **instantly readable** without colour as its only identifier:
- **Meadow:** Gold belt + pale cuffs (horizontal accent at hips and wrists)
- **Ember:** Broad chest-plate + angled boot overlays (vertical bulk + stance widening)
- **Tide:** Large draped collar + gauntlet cuffs (soft, layered upper-body mass)
- **Dusk:** Diagonal chest-strap + buckled belt (angular, high-contrast geometry)

Test method: Render each appearance in grayscale; silhouettes must remain distinct.

### Accessory Constraint: Knight_Helmet

The base model's head bone carries a baked-in `Knight_Helmet` mesh that occludes any accessory attached at the head bone. **Do not attempt to hide or replace it.** All current and future silhouette customization must route through torso/waist/hand/foot bones only.

---

## Environment and Landmark Hierarchy

Environments must have a clear visual hierarchy:

### Primary Landmark (The Anchor)
- **Size:** Dominant visual reference (building, large tree, monument)
- **Detail level:** High (readable up close)
- **Placement:** Central or at entrance; guides player arrival
- **Examples:** Meadowrest Hall, a great oak, a stone archway

### Secondary Landmarks (Navigation)
- **Size:** 4–6 world units
- **Placement:** Evenly distributed around the zone
- **Purpose:** Guide navigation without micromanagement; support wayfinding from any direction
- **Detail level:** Medium (recognizable from 10+ units)

### Micro-Props (Environmental Storytelling)
- **Size:** 0.3–1.5 world units
- **Density:** 3–7 per "area" (a meadow section ~15×15 units)
- **Purpose:** Texture, atmosphere, gameplay context (scattered tools, barrels, crates near activity)
- **Detail level:** Low (readable as a type, not fine-grained details)

### Terrain and Paths

**Path readability (critical):**
- Paths must be **visually distinct** from surrounding terrain (lighter, darker, or a different material entirely)
- Path edges should be **soft** (grass blends, erosion marks) not hard (cliffs, walls)
- Path width: Minimum 2.0 world units (character can walk down the centre without feeling confined)

**Terrain height variation:**
- Gentle slopes acceptable (gradient ≤ 0.3 rise per 1.0 horizontal distance)
- Cliff or drop-off only if blocking is intended; must be at least 1.5 units high to read as impassable
- Avoid "floating island" silhouettes; terrain must feel anchored to a larger landscape

---

## Material and Texture Separation

Every material must have a distinct visual purpose:

| Material Type | Visual Character | Example Surfaces | Roughness | Metalness |
|---------------|------------------|------------------|-----------|-----------|
| **Cloth/Leather** | Matte, soft | Character clothes, canvas, leather armor | 0.7–0.9 | 0.0 |
| **Wood** | Warm, weathered diffuse | Structures, tool handles, furniture | 0.5–0.7 | 0.05 |
| **Metal (Tarnished)** | Dull reflection, slight texture | Worn tools, everyday implements | 0.6–0.8 | 0.3–0.5 |
| **Metal (Polished)** | Bright, mirror-like | Armor, weapons, gems | 0.2–0.4 | 0.8–1.0 |
| **Stone** | Rough, earthy | Walls, rocks, ruins | 0.7–0.9 | 0.0 |
| **Grass** | Matte, bright | Meadows, ground | 0.9 | 0.0 |
| **Water** | Reflective, transparent | Rivers, wells | 0.1 | 0.95 |

**Rule:** If two surfaces are next to each other, their material must be visually distinct (not just colour). Tarnished and polished metal must be told apart by roughness, not tint alone.

---

## Animation and Motion

### Selection Animation

Animations are **selective and purposeful**, not universal. Follow Melvor's pacing:

- **Idle:** Full animation cycle; character breathes, shifts weight, checks equipment (loopers)
- **Walk/Run:** Full-body movement with realistic proportions (not exaggerated bouncing)
- **Tool use (gathering):** Clear contact with target (hand-to-rock, axe-to-tree); no air-swinging
- **Tool use (combat):** Weapon arc matches the blade/head geometry (overhead slash, thrust, etc.)
- **Emotes:** Rare and specific (victory, rest, prayer); not cosmetic spam

### Anticipation and Contact

Critical moments must include:
1. **Anticipation:** Visible wind-up before action (draw back tool/weapon)
2. **Contact:** Visible hand-to-target or tool-to-target moment (impact frame)
3. **Hold:** Momentary pause at peak of action (readability)
4. **Recovery:** Return to neutral pose

**Example (woodcutting):**
1. Character draws axe back (0.2s)
2. Axe swings down (0.3s)
3. Axe is held in tree (0.1s, impact holds here)
4. Character returns to neutral (0.2s)
Total: ~0.8s per action, readable, no blur

### Reduced-Motion Behavior

When user sets `prefers-reduced-motion: reduce`:
- Loop animations become **static poses** or **very subtle shifts** (no swinging, spinning, or camera motion)
- Tool-use animations play at **50% speed** and **50% amplitude** (smaller gestures, longer hold)
- **No screen shake, camera zoom, or parallax**
- Character remains **readable and playable**, not frozen (subtle idle breathing is OK)

---

## Interface and Feedback

### Click Feedback (Ground Items)

When player clicks a ground item:
1. Item **briefly glows** or **scales up** (0.2s animation)
2. No sound (sound design out of scope here, but accessibility requires visual-only option)
3. Item vanishes or shows collection animation (character bends to pick up)
4. HUD inventory updates immediately (no delay)

### Pointer Interaction

- **Desktop:** Cursor changes to "pointer" or "grab" over interactive objects (not visible raycast rays or debug geometry)
- **Mobile:** Touch interactions must be **forgiving** (hitbox radius ≥ 0.5 world units, validated by Playwright tests)
- **Feedback delay:** ≤ 100ms from click to visible response

---

## Desktop and Mobile Parity

### Viewport

- **Desktop:** 1280×800 minimum; landscape orientation enforced (show portrait warning)
- **Mobile:** 375×812 (iPhone 14) supported; portrait landscape toggle available; responsive layout required

### Interaction Parity

Both desktop and mobile must:
- Support the same core gameplay (gathering, combat, inventory, settings)
- Require the same number of interactions to complete a task (no extra "OK" buttons on mobile)
- Show the same information in HUD and panels (scale UI to viewport, no hiding info on small screens)

### Touch-Specific Behaviors

- Tap-to-move (not click-to-move)
- Double-tap to interact with ground items (or single tap if area is clear)
- Pinch-to-zoom disabled (scroll zoom alternative if needed)
- Long-press for context menu (if implemented)

---

## Performance and Bundle Budgets

### WebGL Performance

- **Target frame rate:** 60 FPS on mid-range mobile (iPhone 12/Samsung Galaxy A10) over 60 seconds of continuous play
- **Memory budget:** ≤ 512 MB for game state + loaded assets (mobile)
- **VRAM budget:** ≤ 256 MB (mobile WebGL)
- **Draw calls:** ≤ 100 per frame (with terrain instancing, assumes 50–100 entities on screen)

### Bundle Size

- **Initial load:** ≤ 500 KB JavaScript (including Three.js, React, engine)
- **Asset atlas/sprite:** ≤ 2 MB (textures, models in shared format)
- **Total:** ≤ 3 MB initial download; progressive loading for secondary zones

### Audio

- Not in scope for Gate 0; if added later, budget ≤ 1 MB for all SFX + ambient.

---

## Three Visual Acceptance Gates

Every new asset or zone must pass these three gates before shipping:

### Gate 1: Silhouette Test (Grayscale)

Render the element in grayscale, no shadows, default lighting. Can you identify:
- What it is? (tree, door, rock, person)
- What it's for? (if in-game, what activity does it support?)
- Where it fits in the hierarchy? (landmark, prop, terrain detail)

**Pass condition:** Yes to all three questions.

### Gate 2: OSRS-Lexicon Test

Does it speak the visual vocabulary established by the four appearances, KayKit assets, and Melvor?
- Material separation: metal ≠ cloth ≠ wood ≠ stone visually?
- Silhouette: confident, not muddy or over-detailed?
- Scale: consistent with character heights and doorway sizes?
- Colour: grounded (not neon, not desaturated to grey)?

**Pass condition:** 3 out of 4 yes; rebalance if failing.

### Gate 3: Functional Clarity Test

If this asset is interactive (tool, NPC, zone entrance):
- Can player identify its purpose **without text hints**?
- Does the visual feedback (glow, highlight, cursor change) communicate interaction?
- Does any animation (idle, use) reinforce function?

**Pass condition:** Yes to all three; if NPC or tool, its silhouette must suggest its role (hunter looks ready to act, ore deposit has a metallic glint).

---

## Deprecated Approaches

**Do not:**
- Use random procedural variation as "composed" environment design (procedurally scattered trees are not a forest; a composed forest is intentionally placed)
- Call flat geometric fields "meadows" without path or landmark (empty rectangles are not environments)
- Use very high polygon counts under the assumption fine detail = quality (readability > polygon count)
- Mix real-world photography with 3D models (stay in-medium)
- Apply unrealistic scale (character next to a thumbnail-sized tree, or a tree that's a skyscraper)
- Over-animate idle poses (small fidgets OK; full dances not OK for workers/NPCs)

---

## Maintenance and Review

This document is the authoritative standard for `apps/game`. Any new feature or asset must:
1. Reference the relevant section of this constitution
2. Pass the three visual acceptance gates
3. Show evidence before merge (screenshots, performance metrics, or Playwright tests per the asset type)

Review cadence: Quarterly check-in or before major visual changes. Update this document if new requirements emerge.

---

**End of Constitution**
