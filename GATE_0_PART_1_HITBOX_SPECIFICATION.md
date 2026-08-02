# Gate 0 Part 1: Ground-Item Interaction Hitbox — Implementation Specification

**Status:** Investigation complete. Root cause identified. Implementation specification ready.

**Date:** 2026-08-02

---

## Problem Statement

On fresh saves, clicking directly on ground items (e.g., the Worn Hatchet at the start of the tutorial) silently fails to trigger pickup. The raycast hit-detection system cannot reliably intersect the ground item's model geometry.

**Verification:** The underlying pickup logic is correct — calling `activateTarget('ground_worn_hatchet')` via the browser dev test hook succeeds instantly, advances the objective, and adds the item. The failure is exclusively in the raycaster's ability to detect a click on the visible ground item.

**Root Cause:** Ground items loaded via `addAsset()` receive no explicit interactive hitbox geometry, unlike fishing spots which get a dedicated `fishingHitArea` sphere (GameWorld.tsx lines 491–504). The Worn Hatchet's model geometry is too small or geometrically incompatible with the raycast intersection logic.

---

## Solution

Add an invisible, raycast-sensitive sphere hitbox to all ground items at load time. This matches the existing fishing-spot pattern.

### File: `apps/game/src/world/assets.ts`

A new export function `addInteractionHitbox(object, kind)` has been added. This function:

- Takes the loaded object and an interaction kind (`"ground_item"`, etc.)
- For ground items, attaches an invisible 0.5-radius sphere centered at y=0.3
- Uses invisible material (opacity 0, no depth write, no color write)
- Marks the hitbox with `userData.interactionHitArea = true` for identification

```typescript
export function addInteractionHitbox(object: THREE.Object3D, kind: string): void {
  if (kind === "ground_item") {
    const hitArea = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 16),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    hitArea.position.y = 0.3;
    hitArea.userData.interactionHitArea = true;
    object.add(hitArea);
  }
}
```

### File: `apps/game/src/world/GameWorld.tsx`

**Location:** In the `addAsset()` function after the object is fully configured (after shadows/animations are set up).

**Change needed at line ~515 (after the mixer setup, before `scene.add(object)`)**:

```typescript
// Add the new import at the top
import { addInteractionHitbox } from "./assets";

// Inside addAsset, after mixer setup (around line 515), add:
if (interactive && kind === "ground_item") {
  addInteractionHitbox(object, kind);
}

// Then continue with:
object.userData.targetId = id;
object.traverse((child) => { child.userData.targetId = id; });
scene.add(object);
```

**Signature change:** The `addAsset` function signature must accept an optional `kind` parameter:

**Current (line 439–447):**
```typescript
const addAsset = async (
  id: string,
  assetId: string,
  x: number,
  z: number,
  rotation: number,
  scale: number,
  elevation: number,
  tint?: string | null,
  interactive = false,
) => {
```

**Required (add `kind?: string` parameter):**
```typescript
const addAsset = async (
  id: string,
  assetId: string,
  x: number,
  z: number,
  rotation: number,
  scale: number,
  elevation: number,
  tint?: string | null,
  interactive = false,
  kind?: string,
) => {
```

**Call sites update:** Three call sites of `addAsset()` must pass the `kind`:

1. **Line 517 (scenery):** No change needed, `kind` is optional and not used.
   ```typescript
   for (const item of zone.scenery) sceneryAssetJobs.push(addAsset(item.id, item.assetId, item.x, item.z, item.rotation, item.scale, item.elevation, item.tint));
   ```

2. **Line 520 (interactables):** Add `item.kind` as the 10th argument.
   ```typescript
   criticalAssetJobs.push(addAsset(item.id, item.assetId, item.x, item.z, 0, 1, item.kind === "ground_item" ? 0.14 : 0, resolvedTint, true, item.kind));
   ```

---

## Testing

**Regression test:** Use Playwright to click directly on the Worn Hatchet in a fresh-save scenario and verify:
- Raycast intersection succeeds (no silent miss)
- Pickup is triggered
- Inventory updates
- Quest advances to the next objective

**Manual verification:** Run the dev build, create a fresh character, and attempt clicking the Worn Hatchet at pixel-precise locations. Should now succeed reliably (the hitbox is generous, 1.0 diameter).

---

## Design Notes

- **Hitbox sizing:** 0.5-radius sphere (1.0 diameter) is conservative and forgiving. If players report mis-clicks, this can be tuned.
- **Vertical positioning:** y=0.3 centers the hitbox at ground-item model height. Ground items are placed at elevation 0.14; the hitbox sits ~0.16 units above ground, catching clicks on the visual model.
- **Consistency:** This pattern exactly mirrors the fishing-spot `fishingHitArea` (lines 491–504), reducing cognitive load during future maintenance.
- **Performance:** One sphere mesh per interactive ground item. Negligible overhead; raycaster already processes all scene objects.

---

## Files Modified

- `apps/game/src/world/assets.ts` — Added `addInteractionHitbox()` export function
- `apps/game/src/world/GameWorld.tsx` — Add import, update `addAsset()` signature, add hitbox attachment, update call site at line 520
