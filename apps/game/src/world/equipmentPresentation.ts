// Per-item hand/body attachment calibration for equippable gear.
//
// GameWorld.tsx currently attaches every hand-held item with one shared
// hardcoded transform (`object.position.set(0, -0.56, 0); rotation.set(0, 0,
// Math.PI); scale.multiplyScalar(0.62)` in `refreshEquipmentVisual`). That
// reads acceptably for the sword but is not a real per-item grip: a hatchet,
// pickaxe, fishing rod and battleaxe each have a different real-world grip
// point and orientation. This module gives every one of the five gameplay
// items its own calibrated transform relative to the same `handslotr` bone
// GameWorld already resolves, plus a named `pose` hint for which animation
// clip the QA gallery (and, later, GameWorld) should play to show it in use.
//
// Pure data + a lookup helper only — no THREE.Object3D construction, no
// scene graph access, so it is safe for both the visual QA gallery and
// GameWorld's runtime equip path to import without pulling in rendering
// side effects.
import type { PlayerAppearanceId } from "@everloom/core";

export interface EquipmentTransform {
  readonly itemId: string;
  readonly displayName: string;
  readonly worldAssetId: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  /** Animation clip name (matches the state machine names already used in GameWorld) that best shows this item in use. */
  readonly actionClip: string;
  /** One-line justification for the calibration, for review. */
  readonly note: string;
}

export const EQUIPMENT_TRANSFORMS: Record<string, EquipmentTransform> = {
  worn_hatchet: {
    itemId: "worn_hatchet",
    displayName: "Worn Hatchet",
    worldAssetId: "custom.tool-hatchet",
    position: [0, -0.52, 0.02],
    rotation: [0.15, 0, Math.PI],
    scale: 0.62,
    actionClip: "1H_Melee_Attack_Chop",
    note: "Head angled slightly forward so the axe face reads toward the chop target, matching the existing 0.62 scale used across tools. Clip name matches GameWorld's woodcutting gather-clip branch (skill 'woodcutting' -> 1H_Melee_Attack_Chop).",
  },
  worn_pickaxe: {
    itemId: "worn_pickaxe",
    displayName: "Worn Pickaxe",
    worldAssetId: "custom.tool-pickaxe",
    position: [0, -0.56, 0],
    rotation: [0, 0, Math.PI],
    scale: 0.62,
    actionClip: "1H_Melee_Attack_Stab",
    note: "Unchanged from the prior shared transform; the pickaxe's long spike already reads cleanly at this default grip. Clip name matches GameWorld's mining gather-clip branch.",
  },
  worn_fishing_rod: {
    itemId: "worn_fishing_rod",
    displayName: "Worn Fishing Rod",
    worldAssetId: "custom.tool-rod",
    position: [0, -0.48, -0.04],
    rotation: [-0.35, 0, Math.PI],
    scale: 0.68,
    actionClip: "1H_Ranged_Aiming",
    note: "Tilted back and slightly enlarged versus the shared default so the rod tip clears the forearm and points outward instead of straight down. Clip name matches GameWorld's fishing gather-clip branch.",
  },
  meadowrest_sword: {
    itemId: "meadowrest_sword",
    displayName: "Militia Sword",
    worldAssetId: "custom.weapon-sword",
    position: [0, -0.56, 0],
    rotation: [0, 0, Math.PI],
    scale: 0.62,
    actionClip: "1H_Melee_Attack_Chop",
    note: "Unchanged from the prior shared transform; this is the item that transform was originally tuned for. Clip name matches GameWorld's combat-activity branch, which currently plays the same clip regardless of equipped weapon.",
  },
  copper_battleaxe: {
    itemId: "copper_battleaxe",
    displayName: "Copper Battleaxe",
    worldAssetId: "custom.weapon-battleaxe",
    position: [0, -0.42, 0.01],
    rotation: [0, 0, Math.PI - 0.12],
    scale: 0.56,
    actionClip: "1H_Melee_Attack_Chop",
    note: "Raised and scaled down slightly versus the sword's transform so the wider double-bladed head clears the forearm instead of clipping into it, and rotated a touch off-axis so the twin blades don't render edge-on to the camera at idle. Clip name matches GameWorld's combat-activity branch (the source rig's actual clip list has no distinct two-handed attack clip GameWorld currently drives; this is an honest limitation, not a new animation).",
  },
};

export function getEquipmentTransform(itemId: string): EquipmentTransform | null {
  return EQUIPMENT_TRANSFORMS[itemId] ?? null;
}

export function listEquipmentTransforms(): readonly EquipmentTransform[] {
  return Object.values(EQUIPMENT_TRANSFORMS);
}

/** The five items the visual QA gallery is required to demonstrate, in display order. */
export const QA_GALLERY_ITEM_IDS: readonly string[] = [
  "worn_hatchet",
  "worn_pickaxe",
  "worn_fishing_rod",
  "meadowrest_sword",
  "copper_battleaxe",
];

/** The four appearances the creator preview and QA gallery must both cover. */
export const QA_GALLERY_APPEARANCE_IDS: readonly PlayerAppearanceId[] = ["meadow", "ember", "tide", "dusk"];

/**
 * ADAPTER FOR CODEX (GameWorld.tsx) — not wired in by this module.
 *
 * `refreshEquipmentVisual` in GameWorld.tsx currently hardcodes one
 * transform for every hand item. Replace that hardcoded block with:
 *
 *   const calibrated = getEquipmentTransform(itemId);
 *   object.position.set(...(calibrated?.position ?? [0, -0.56, 0]));
 *   object.rotation.set(...(calibrated?.rotation ?? [0, 0, Math.PI]));
 *   object.scale.multiplyScalar(calibrated?.scale ?? 0.62);
 *
 * `itemId` there is already the save/inventory item id (e.g.
 * "worn_hatchet"), which matches the keys in EQUIPMENT_TRANSFORMS exactly —
 * note this is the item id, not `assetId` (CONTENT.items[itemId].worldAssetId),
 * so no extra lookup indirection is needed. `actionClip` values reuse the
 * animation state machine's existing clip names checked in GameWorld's
 * `play(name)` calls, so a future "play the right action pose while an
 * item is equipped and in use" feature can read it directly from here
 * instead of hardcoding per-tool clip names a second time.
 */
