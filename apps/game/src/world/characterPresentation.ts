// Shared character presentation descriptors.
//
// This module is the single source of truth for how each of the four save
// appearance IDs (`meadow` | `ember` | `tide` | `dusk`) should read visually
// beyond the flat whole-model tint multiply that GameWorld.tsx currently
// applies via `appearanceTints`. It does NOT touch save data, does NOT
// rename or add appearance IDs, and does NOT import from GameWorld.tsx or
// the store — it is a pure, side-effect-free descriptor module that both the
// new creator preview (CharacterCreatorPreview.tsx) and, later, the world
// renderer can consume through the small adapter documented at the bottom of
// this file.
//
// Asset honesty: every additive primitive below is original geometry built
// from THREE primitives at runtime (`buildAppearanceDecorations`). None of
// it is licensed/final art — the installed CC0 packs (see
// packages/assets/src/registry.json) contain exactly one usable rigged
// player-shaped character model (`player.adventurer`, KayKit Adventurers,
// CC0-1.0) and no modular hair/headwear/cloak/glove/boot parts compatible
// with its skeleton. These additions are deliberately restrained
// (a hair/headwear read, a torso overlay, a belt or scarf accent) so they
// stay honestly "placeholder original decoration," not a claim of finished
// character art. See CLAUDE_CHARACTER_ENVIRONMENT_FINISH_AUDIT.md for the
// full licensed-asset audit this decision is based on.
import * as THREE from "three";
import type { PlayerAppearanceId } from "@everloom/core";

export type AccessorySlot = "hair" | "headwear" | "torsoOverlay" | "gloves" | "boots" | "belt" | "scarf";

export interface AccessoryPrimitive {
  readonly geometry: "cone" | "sphere" | "torus" | "box" | "cylinder";
  readonly args: readonly number[];
  readonly position: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: readonly [number, number, number];
  readonly color: string;
  readonly roughness?: number;
  readonly metalness?: number;
}

export interface CharacterPresentation {
  readonly id: PlayerAppearanceId;
  readonly label: string;
  /** Multiplied against the base adventurer model materials, same value GameWorld already uses. */
  readonly tint: string;
  /** Short, honest description of what makes this silhouette distinct beyond tint. */
  readonly silhouetteNote: string;
  /** Original procedural accessories layered onto the shared rig via named bones. */
  readonly accessories: Partial<Record<AccessorySlot, AccessoryPrimitive>>;
}

// Bone names present on the KayKit adventurer rig that GameWorld already
// resolves lookalikes for (see GameWorld's `handSlot`/`chestSlot`
// resolution). Accessories attach to whichever of these exists on the
// loaded skeleton; `head` and `hips` are added here for the new slots.
export const APPEARANCE_ACCESSORY_BONES: Record<AccessorySlot, readonly string[]> = {
  hair: ["head"],
  headwear: ["head"],
  torsoOverlay: ["chest", "spine"],
  gloves: ["handslotr", "handr", "handslot.r", "hand.r", "handslotl", "handl", "handslot.l", "hand.l"],
  boots: ["foot.r", "footr", "foot.l", "footl"],
  belt: ["hips", "spine"],
  scarf: ["chest", "neck", "spine"],
};

// IMPORTANT finding from building the creator preview: `player.adventurer`'s
// skeleton already carries a large, opaque, always-visible `Knight_Helmet`
// mesh bound to the `head` bone (see GameWorld's `handSlot`/`chestSlot`
// resolution — this is the same rig). Any small accessory attached at or
// near the head bone's own origin renders fully behind/inside that helmet
// dome and is invisible however far it's offset up to roughly one full head
// radius, confirmed by direct in-engine measurement (a bright test sphere at
// a 1.0-unit head-relative offset rendered fine; cones up to 0.65 units
// above the head origin did not). Rather than fight that with an oversized,
// silly-looking "headwear" spike, every appearance below builds its
// silhouette difference from the torso/waist/hand/foot bones instead, which
// have no equivalent baked-in geometry and were confirmed visible in the
// live preview (see CLAUDE_CHARACTER_ENVIRONMENT_FINISH_AUDIT.md).
export const CHARACTER_PRESENTATIONS: Record<PlayerAppearanceId, CharacterPresentation> = {
  meadow: {
    id: "meadow",
    label: "Meadow",
    tint: "#5fbf5a",
    silhouetteNote: "A bright gold woven belt band and matching pale glove cuffs read clearly against the green tint, independent of colour alone.",
    accessories: {
      belt: { geometry: "torus", args: [0.19, 0.06, 6, 14], position: [0, -0.02, 0], rotation: [Math.PI / 2, 0, 0], color: "#ffe08a", roughness: 0.6 },
      gloves: { geometry: "sphere", args: [0.13, 8, 6], position: [0, -0.02, 0], color: "#eef0c8", roughness: 0.55 },
    },
  },
  ember: {
    id: "ember",
    label: "Ember",
    tint: "#e8763a",
    silhouetteNote: "A wide pale chest-plate overlay bulks out the torso silhouette and dark angular boot overlays widen the stance — a visibly bulkier, higher-contrast outline than the other three.",
    accessories: {
      torsoOverlay: { geometry: "box", args: [0.5, 0.36, 0.34], position: [0, 0.05, 0.04], color: "#f7ecd2", roughness: 0.45 },
      boots: { geometry: "box", args: [0.24, 0.18, 0.34], position: [0, -0.04, 0.05], color: "#1a0d08", roughness: 0.6 },
    },
  },
  tide: {
    id: "tide",
    label: "Tide",
    tint: "#3f9fd6",
    silhouetteNote: "A large draped white scarf collar stands proud at the collarbone and pale gauntlet cuffs bulk out the hands — the palest, softest upper-body outline of the four.",
    accessories: {
      scarf: { geometry: "torus", args: [0.24, 0.09, 6, 16], position: [0, 0.24, 0], rotation: [Math.PI / 2, 0, 0], color: "#f3f6f5", roughness: 0.5 },
      gloves: { geometry: "sphere", args: [0.13, 8, 6], position: [0, -0.02, 0], color: "#f3f6f5", roughness: 0.45 },
    },
  },
  dusk: {
    id: "dusk",
    label: "Dusk",
    tint: "#a463d6",
    silhouetteNote: "A narrow silver diagonal chest-strap overlay and a bright silver-buckled belt give this outfit a distinct armoured, high-contrast silhouette against the dark violet tint.",
    accessories: {
      torsoOverlay: { geometry: "box", args: [0.14, 0.46, 0.32], position: [0.12, 0.02, 0.02], rotation: [0, 0, 0.4], color: "#d8d0e6", roughness: 0.35, metalness: 0.4 },
      belt: { geometry: "torus", args: [0.2, 0.055, 6, 14], position: [0, -0.02, 0], rotation: [Math.PI / 2, 0, 0], color: "#d8d0e6", roughness: 0.35, metalness: 0.4 },
    },
  },
};

export function listCharacterPresentations(): readonly CharacterPresentation[] {
  return Object.values(CHARACTER_PRESENTATIONS);
}

export function getCharacterPresentation(appearanceId: PlayerAppearanceId): CharacterPresentation {
  return CHARACTER_PRESENTATIONS[appearanceId];
}

function makeGeometry(primitive: AccessoryPrimitive): THREE.BufferGeometry {
  switch (primitive.geometry) {
    case "cone": return new THREE.ConeGeometry(...(primitive.args as [number, number, number]));
    case "sphere": return new THREE.SphereGeometry(...(primitive.args as [number, number, number]));
    case "torus": return new THREE.TorusGeometry(...(primitive.args as [number, number, number, number]));
    case "box": return new THREE.BoxGeometry(...(primitive.args as [number, number, number]));
    case "cylinder": return new THREE.CylinderGeometry(...(primitive.args as [number, number, number, number]));
    default: return new THREE.BoxGeometry(0.1, 0.1, 0.1);
  }
}

/**
 * Builds the original decoration meshes for one appearance as a plain
 * THREE.Group per accessory slot, keyed by slot name. Callers (the creator
 * preview today, and — via the adapter documented below — GameWorld later)
 * are responsible for attaching each returned group to the matching bone.
 * This function has no side effects on any shared state and does not know
 * about the scene graph it will be attached to.
 */
export function buildAppearanceDecorations(appearanceId: PlayerAppearanceId): Partial<Record<AccessorySlot, THREE.Group>> {
  const presentation = CHARACTER_PRESENTATIONS[appearanceId];
  const out: Partial<Record<AccessorySlot, THREE.Group>> = {};
  for (const [slot, primitive] of Object.entries(presentation.accessories) as [AccessorySlot, AccessoryPrimitive][]) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      makeGeometry(primitive),
      new THREE.MeshStandardMaterial({
        color: primitive.color,
        roughness: primitive.roughness ?? 0.8,
        metalness: primitive.metalness ?? 0.05,
      }),
    );
    mesh.position.set(...primitive.position);
    if (primitive.rotation) mesh.rotation.set(...primitive.rotation);
    if (primitive.scale) mesh.scale.set(...primitive.scale);
    mesh.castShadow = true;
    group.add(mesh);
    group.name = `appearance-decoration-${slot}`;
    out[slot] = group;
  }
  return out;
}

/**
 * ADAPTER FOR CODEX (GameWorld.tsx) — not wired in by this module.
 *
 * GameWorld.tsx already resolves `chestSlot` (see its `chestSlot =
 * object.getObjectByName("chest") ?? object.getObjectByName("spine") ??
 * null` near the player model load) and could resolve a `headSlot`/`hipSlot`
 * the same way using `APPEARANCE_ACCESSORY_BONES`. After the player model
 * loads and `appearanceTints[appearanceId]` is applied as today, call:
 *
 *   const decorations = buildAppearanceDecorations(appearanceId);
 *   for (const [slot, bones] of Object.entries(APPEARANCE_ACCESSORY_BONES)) {
 *     const group = decorations[slot as AccessorySlot];
 *     if (!group) continue;
 *     const bone = bones.map((n) => object.getObjectByName(n)).find(Boolean);
 *     bone?.add(group);
 *   }
 *
 * Dispose the previous appearance's groups (removeFromParent(); no
 * geometry/material caching is shared across calls) before rebuilding if
 * GameWorld ever needs to hot-swap appearance at runtime.
 */
