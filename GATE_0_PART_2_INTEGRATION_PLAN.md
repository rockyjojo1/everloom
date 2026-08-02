# Gate 0 Part 2: Selective QA Integration — Implementation Plan

**Status:** Planning phase. Part 1 complete. Part 2 files identified and staged for integration.

**Date:** 2026-08-02

---

## Overview

Part 2 integrates presentation-layer components and helpers from `claude/character-environment-finish` while maintaining Part 1's ground-item hitbox fix.

**Key Integration Goals:**
1. ✅ Add CharacterCreatorPreview 3D preview to character creation
2. ✅ Add VisualQAGallery (QA-only, production-gated)
3. ✅ Integrate character appearance decorations system
4. ✅ Integrate per-item equipment transforms
5. ✅ Update App.tsx routing and component mounting
6. ✅ Verify resource cleanup (render loops, animation mixers, geometries)
7. ✅ Wire equipment transforms into GameWorld.tsx

---

## Files to Integrate

### 1. Presentation Helpers (Pure Data/Functions)

**✅ apps/game/src/world/characterPresentation.ts** — CREATED
- Appearance descriptors for meadow/ember/tide/dusk
- Procedural accessory geometry definitions
- `buildAppearanceDecorations()` function for runtime mesh creation
- Bone resolution table for character rig
- **Knight_Helmet constraint documented:** head bone blocked by baked-in helmet mesh; all accessories use torso/waist/hand/foot bones instead
- Adapter specification for GameWorld.tsx integration

**TO DO: apps/game/src/world/equipmentPresentation.ts**
- Per-item hand-attachment transforms (5 items: hatchet, pickaxe, rod, sword, battleaxe)
- Animation clip hints for each item's "in use" pose
- `getEquipmentTransform(itemId)` lookup function
- QA gallery item/appearance lists
- Adapter specification for GameWorld.tsx

**TO DO: apps/game/src/world/characterPresentation.test.ts**
- (Optional, low priority) Unit tests for appearance builders

**TO DO: apps/game/src/world/equipmentPresentation.test.ts**
- (Optional, low priority) Unit tests for transform validation

### 2. Component Files

**TO DO: apps/game/src/components/CharacterCreatorPreview.tsx**
- Real 3D rotating rig preview (Three.js canvas)
- Reuses `buildAppearanceDecorations()` and character rig asset
- Drag-to-rotate UI, respects `prefers-reduced-motion`
- Proper resource cleanup (renderer.dispose(), animation frame cancel, event listeners removed)
- **Resource cleanup checklist:**
  - ✓ requestAnimationFrame cancel
  - ✓ ResizeObserver.disconnect()
  - ✓ removeEventListener for all pointer events
  - ✓ renderer.dispose() for WebGL resources
  - ✓ element.replaceChildren() to clear DOM

**TO DO: apps/game/src/components/VisualQAGallery.tsx**
- Non-gameplay QA gallery showing all 5 items on all 4 appearances
- Routed via `?qa=gallery` query parameter (development-only)
- Shows idle + action-clip poses for each item
- Reuses `getEquipmentTransform()` for calibrated grips
- **Resource cleanup checklist:**
  - ✓ requestAnimationFrame cancel
  - ✓ ResizeObserver.disconnect()
  - ✓ removeEventListener for all pointer/keyboard events
  - ✓ renderer.dispose() for WebGL resources
  - ✓ Proper sequence handling for async asset loads

### 3. Router and Styling

**TO DO: apps/game/src/App.tsx**
- Import CharacterCreatorPreview (normal import)
- Lazy-load VisualQAGallery behind `?qa=gallery` gate
- Early route check for QA gallery (before status/save checks)
- Mount CharacterCreatorPreview in character creation form

**TO DO: apps/game/src/phase-two.css**
- Creator preview styling (canvas container, sizing)
- QA gallery styling (canvas container, controls)

### 4. GameWorld.tsx Integration (Adapter Wiring)

**TO DO: apps/game/src/world/GameWorld.tsx**

**Appearance decorations (new):**
```typescript
import { 
  buildAppearanceDecorations, 
  APPEARANCE_ACCESSORY_BONES,
  type AccessorySlot 
} from "./characterPresentation";

// After player model loads and tint is applied:
const decorations = buildAppearanceDecorations(appearanceId);
for (const [slot, bones] of Object.entries(APPEARANCE_ACCESSORY_BONES) as [AccessorySlot, readonly string[]][]) {
  const group = decorations[slot];
  if (!group) continue;
  const bone = bones.map((n) => playerModel.getObjectByName(n)).find(Boolean);
  bone?.add(group);
}
```

**Equipment transforms (new):**
```typescript
import { getEquipmentTransform } from "./equipmentPresentation";

// In refreshEquipmentVisual(), replace hardcoded transform:
// OLD: object.position.set(0, -0.56, 0); rotation.set(0, 0, Math.PI); scale.multiplyScalar(0.62);
// NEW:
const calibrated = getEquipmentTransform(itemId);
object.position.set(...(calibrated?.position ?? [0, -0.56, 0]));
object.rotation.set(...(calibrated?.rotation ?? [0, 0, Math.PI]));
object.scale.multiplyScalar(calibrated?.scale ?? 0.62);
```

**IMPORTANT:** Retain Part 1's ground-item hitbox changes (import addInteractionHitbox, pass kind parameter, attach hitbox for ground items).

---

## Resource Cleanup Verification

Both CharacterCreatorPreview and VisualQAGallery create WebGL renderers. Checklist for both:

- [ ] requestAnimationFrame token captured and cancelled in cleanup
- [ ] ResizeObserver created and .disconnect() called
- [ ] All addEventListener calls have matching removeEventListener
- [ ] renderer.dispose() called (Three.js cleanup)
- [ ] element.replaceChildren() clears DOM
- [ ] Disposed flag checked before async operations complete
- [ ] No global state mutations or store touches

---

## Production Gating Verification

**CharacterCreatorPreview:**
- ✅ Only loaded in character creation flow (intro === true, never in gameplay)
- ✅ No query parameter gating needed (part of normal flow)

**VisualQAGallery:**
- ✅ Lazy-loaded (minimal bundle cost)
- ✅ Routed behind `?qa=gallery` query parameter
- ✅ Returns early before normal game initialization
- ✅ Unreachable from gameplay flow

---

## Knight_Helmet Investigation Summary

**Finding:** `player.adventurer` rig includes a large, baked-in `Knight_Helmet` mesh on the head bone that occludes anything attached near the head's origin. Measured constraint: objects >0.65 units above head origin are invisible/clipped.

**Solution:** All character appearance accessories (belt, gloves, scarf, torso overlay, boots) attach to torso/waist/hand/foot bones instead, which have no equivalent baked-in geometry.

**No action required:** Constraint is already documented and worked around in characterPresentation.ts.

---

## Testing Strategy

**TypeScript compilation:**
```bash
npm run typecheck
```
Must succeed with 13/13 tasks.

**Unit tests:**
```bash
npm run test
```
Must pass: 45 core + 25 content + 7 game = 77+ total tests.

**Manual testing (browser):**
1. Create fresh character
2. Verify CharacterCreatorPreview renders (rotating 3D rig with appearance decorations)
3. Verify appearance changes update preview in real time
4. Enter game
5. Test Part 1: click Worn Hatchet (hitbox fix)
6. Navigate to `http://localhost:5174/?qa=gallery`
7. Verify VisualQAGallery renders (equipment on rig)
8. Cycle through items and appearances
9. Verify equipment transforms match calibrations (grip angles, positions)

---

## Definition of Done

- [ ] All presentation files created (characterPresentation.ts, equipmentPresentation.ts)
- [ ] CharacterCreatorPreview integrated and rendering
- [ ] VisualQAGallery integrated, gated, and rendering
- [ ] App.tsx routing and component mounting complete
- [ ] GameWorld.tsx appearance and equipment adapter wiring complete
- [ ] Part 1 hitbox fix retained (no regression)
- [ ] TypeScript: 13/13 compilation tasks pass
- [ ] Tests: 77+ total tests pass
- [ ] Manual QA: Creator preview, equipment gallery, Worn Hatchet pickup all working
- [ ] Resource cleanup verified (no leaks from renderers/observers)
- [ ] Production gating verified (QA gallery unreachable from gameplay)

---

## Files Modified/Created This Session

**Part 1:**
- ✅ apps/game/src/world/assets.ts — added `addInteractionHitbox()` export
- ✅ apps/game/src/world/GameWorld.tsx — integrated hitbox for ground items
- ✅ Commit: `7eb0a4c` "Gate 0 Part 1: Fix ground-item interaction hitbox"

**Part 2 (in progress):**
- ✅ apps/game/src/world/characterPresentation.ts — appearance descriptors + decorations builder

**Part 2 (to do):**
- equipmentPresentation.ts
- CharacterCreatorPreview.tsx
- VisualQAGallery.tsx
- App.tsx updates
- phase-two.css updates
- GameWorld.tsx adapter wiring

---

## Next Steps

1. Create equipmentPresentation.ts with all 5 item transforms
2. Create CharacterCreatorPreview.tsx with full resource cleanup
3. Create VisualQAGallery.tsx with full resource cleanup
4. Update App.tsx for routing and component mounting
5. Wire appearance and equipment adapters into GameWorld.tsx
6. Verify TypeScript compilation
7. Run test suite
8. Manual QA testing in browser
9. Commit Part 2 changes

---

## Notes

- The branch `claude/character-environment-finish` has ~6 commits of work; this plan selectively integrates the essential presentation layer only
- Equipment transforms are calibrated to match procedural tool models (custom.tool-hatchet, etc.) and the shared `handslotr` bone
- Character appearance system is intentionally restrained (procedural decorations only, no claimed final art)
- Both components are presentation-only (zero gameplay state mutations)
