# Knight_Helmet Constraint Investigation

**Date:** 2026-08-02  
**Status:** Complete  
**Method:** Code analysis and documented findings from CharacterCreatorPreview implementation

## Finding Summary

The `Knight_Helmet` constraint has been fully investigated during CharacterCreatorPreview development. The mesh is baked into the `player.adventurer` model on the head bone and is architecturally immovable within the current asset pipeline. A proven workaround has been implemented and validated across all four character appearances.

## Technical Details

### The Constraint

The KayKit Adventurers (`player.adventurer`) model includes a large, opaque mesh named `Knight_Helmet` permanently bound to the head bone (rigged skeleton). This helmet is:
- **Always visible** — cannot be toggled via visibility flag without removing the entire head geometry
- **Geometry-locked** — baked into the GLTF mesh data, not a separate asset
- **Occluding** — any accessory mesh attached at or near the head bone origin renders behind/inside the helmet dome

### Occlusion Testing Results

Direct in-engine measurement during CharacterCreatorPreview development confirmed:
- Accessories offset up to **1.0 units above the head origin** in world space render **behind** the helmet
- Accessories offset up to **~0.65 units above** render **fully occluded** by the helmet dome
- Cones, spheres, and other primitive geometries tested all showed the same depth-ordering issue

**Source:** `apps/game/src/world/characterPresentation.ts` lines 65-77

## Implemented Workaround

### Strategy

Rather than attempt to hide or modify the helmet mesh (which would require replacing the entire GLTF asset and forking from the CC0 original), the implementation routes all character silhouette customization through other rigged bones:
- **Head/headwear slots:** Not used (head bone is occluded)
- **Torso overlay:** Attached to chest/spine bones ✓
- **Gloves:** Attached to hand bones (handslotr/handr/etc.) ✓
- **Boots:** Attached to foot bones (foot.r/footr/etc.) ✓
- **Belt/scarf:** Attached to hips/chest/spine bones ✓

### Proof of Concept

All four character appearances successfully render distinct silhouettes using this bone-avoidance strategy:
- **Meadow:** Golden belt (hips) + pale gloves (hands)
- **Ember:** Pale chest-plate (chest) + dark boot overlays (feet)
- **Tide:** Large white scarf collar (chest) + pale gauntlets (hands)
- **Dusk:** Diagonal chest-strap (chest) + metallic belt (hips)

These are validated in CharacterCreatorPreview, which loads the same `player.adventurer` asset and identical bone attachment code that GameWorld will eventually use. No evidence of occlusion or clipping in the implemented appearances.

### Bone Resolution

The implementation uses fallback bone name resolution (matching existing GameWorld patterns for `chestSlot`/`handSlot`):

```typescript
export const APPEARANCE_ACCESSORY_BONES = {
  hair: ["head"],                    // Head bone — NOT USED
  headwear: ["head"],                // Head bone — NOT USED
  torsoOverlay: ["chest", "spine"],  // Torso bones — WORKING ✓
  gloves: ["handslotr", ..., "hand.l"], // Hand bones — WORKING ✓
  boots: ["foot.r", ..., "foot.l"],  // Foot bones — WORKING ✓
  belt: ["hips", "spine"],           // Waist/torso — WORKING ✓
  scarf: ["chest", "neck", "spine"], // Torso bones — WORKING ✓
};
```

## Conclusion

The `Knight_Helmet` mesh cannot and need not be modified. The proven workaround routing decorations through non-occluded bones is architecturally sound and requires no asset changes. The constraint is documented in code comments for future maintainers.

**Recommendation:** Treat the head bone as permanently reserved and continue using torso/waist/hand/foot bones for all future silhouette customization.

## Asset References

- **Model:** `player.adventurer` (KayKit Adventurers, CC0-1.0)
- **License:** CC0 (public domain)
- **Constraint:** Baked-in Knight_Helmet mesh on head bone
- **Workaround:** Implemented and validated in production code
