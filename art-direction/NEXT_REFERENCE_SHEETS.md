# Next Reference Sheets Handoff

This document defines the priority order and expected content for incoming reference sheets, along with questions Codex must resolve during design review.

## Expected Submission Order

### Priority 1: Core Gameplay Target (Section 01)

**File:** `everloom-01-core-gameplay-target.png`

**Unlocks:** Player base body, player Meadow appearance, worn hatchet (ground item), Mara Threadkeeper (NPC), Loom Hall, signpost, village entrance.

**Design review questions:**
- Does the composed scene demonstrate the intended three-quarter camera angle and readability at gameplay distance?
- Are all player/NPC/item silhouettes distinct and immediately recognizable?
- Does the village composition establish clear hierarchy (Loom Hall as focal point)?
- Are colors consistent with the established palette (warm ochre, meadow green, dark timber, weathered stone)?
- Is the scale relationship between player and architecture readable and credible?

**Haiku must NOT implement before approval:**
- Any derived asset as production (only what is directly shown)
- Primitive versions of elements waiting for dedicated section sheets (e.g., don't build the Loom Hall from boxes)
- Interior spaces not explicitly shown

---

### Priority 2: Player Characters (Section 02)

**File:** `everloom-02-player-characters.png`

**Unlocks:** Player body variations (meadow, ember, tide, dusk appearances), character customization direction.

**Design review questions:**
- Are the four appearances sufficiently distinct to avoid confusion?
- Does each appearance feel purposeful (meadow for gathering, ember for smithing, tide for fishing, dusk for rest)?
- Are silhouettes recognizable even at reduced scale (inventory)?
- Do color tints feel cohesive or do any clash?

**Haiku must NOT implement before approval:**
- Custom character models until this reference is approved
- Appearance-specific armor or accessory overlays (wait for section 06 — Equipment)
- Animation-specific variations

---

### Priority 3: Tools & Weapons (Section 05)

**File:** `everloom-05-tools-weapons.png`

**Unlocks:** Worn hatchet, pickaxe, fishing rod, militia sword, copper battleaxe (all as handheld equipment and ground items).

**Design review questions:**
- Is each tool's silhouette immediately identifiable by shape?
- Do the tools feel appropriately scaled to player hand bones?
- Is the "worn" aesthetic consistent (patina, weathering, imperfections)?
- Do colors match the overall palette and not look overly shiny or pristine?

**Haiku must NOT implement before approval:**
- Primitive or temporary tool models
- Animation-specific tool variants (wait for section 13 — Animation)
- Crafted variants or upgrades (later phase)

---

### Priority 4: Animation Contact Sheet (Section 13)

**File:** `everloom-13-animation-contact-sheet.png`

**Unlocks:** Woodcutting, player idle, player walk, Mara idle animations. Confirms attack clip suitability.

**Design review questions:**
- Do idle/walk animations feel appropriate to the character's pace and weight?
- Does the woodcutting animation's sweep align with hatchet geometry (can tools clip)?
- Are character proportions consistent with the player reference from section 02?
- Do animation frames suggest smooth looping or do they have clear endpoints?

**Haiku must NOT implement before approval:**
- Custom animation rigs until player and tools are finalized
- Attack/skill-specific animation variants (later)
- Emote animations (later phase)

---

### Priority 5: Architecture (Section 08)

**File:** `everloom-08-architecture.png`

**Unlocks:** Loom Hall, cottage kit, fence kit, walls, roofs, chimneys, doors, windows.

**Design review questions:**
- Is the Loom Hall silhouette distinct and recognizable as the primary village structure?
- Do cottage components feel modular and combinable without visual clashing?
- Is weathering/material aging consistent across all buildings?
- Do proportions work at gameplay camera distance?
- Are roof pitches and door/window placements realistic and not overcomplicated?

**Haiku must NOT implement before approval:**
- Interior layouts (wait for specific quest/building details)
- Destructible variants or damage states (later)
- NPCs or occupancy markers (handled separately)

---

### Later Sheets (Lower Priority, No Block)

6. **Section 03 — NPCs:** Named quest contacts and dialogue characters.
7. **Section 04 — Creatures:** Enemies and wildlife for later combat phases.
8. **Section 06 — Equipment/Clothing:** Armor, accessories, wearable overlays.
9. **Section 07 — Resource Nodes:** Trees (all states), rocks, herbs, water sources.
10. **Section 09 — Landmarks:** Ruins, monuments, special locations.
11. **Section 10 — Terrain/Materials:** Ground textures, water, material properties.
12. **Section 11 — Props:** Barrels, crates, boxes, decorative elements.
13. **Section 12 — Vegetation:** Bushes, flowers, foliage, falling leaves.
14. **Section 14 — VFX:** Particles, impact effects, feedback animations.
15. **Section 15 — Interface:** UI elements, buttons, panels, tooltips.
16. **Section 16 — Inventory Icons:** Item icons at game scale.
17. **Section 17 — Scale Chart:** Relative sizing and proportion reference.
18. **Section 18 — Do/Don't Comparison:** Visual guidance on approved vs. rejected directions.

---

## Approval Workflow

1. **Reception:** Sheet arrives, `register-reference-sheet.mjs` indexes it with `status: pending-review`.
2. **Design Review:** Codex reviews against master direction and answers the questions above.
3. **Approval:** Sheet status set to `reference-approved` (manual in status JSON, or tool flag).
4. **Implementation Unblock:** Haiku can now implement assets referencing this sheet's IDs.
5. **Integration:** Assets are modeled, integrated, and tested.
6. **Acceptance:** Assets pass visual baseline, `verify:visual-foundation`, and Gate 0 checks.

Do not rush approval. A rejected sheet returns `status: rejected` with reasons, and awaits resubmission.

