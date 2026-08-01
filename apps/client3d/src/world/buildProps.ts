/**
 * Place props and interactables in the scene.
 */

import * as THREE from 'three';
import { instance, preload } from './assets';
import { PROPS, INTERACTABLES, Interactable } from './worlddata';

export interface PlacedInteractable {
  data: Interactable;
  object: THREE.Object3D;
  picker: THREE.Mesh;
}

export async function buildProps(scene: THREE.Scene): Promise<{
  interactables: PlacedInteractable[];
}> {
  // Preload all models
  const modelPaths = new Set<string>();

  for (const prop of PROPS) {
    modelPaths.add(prop.model);
  }

  for (const ia of INTERACTABLES) {
    if (ia.model) {
      modelPaths.add(ia.model);
    }
  }

  await preload(Array.from(modelPaths));

  const interactables: PlacedInteractable[] = [];

  // =========================================================================
  // Place PROPS
  // =========================================================================

  for (const prop of PROPS) {
    const opts: { scale?: number; rotY?: number; tint?: number } = {
      rotY: prop.rotY ?? Math.random() * Math.PI * 2,
    };
    if (prop.scale !== undefined) opts.scale = prop.scale;
    if (prop.tint !== undefined) opts.tint = prop.tint;

    const obj = instance(prop.model, opts);
    obj.position.set(prop.x, 0, prop.z);
    scene.add(obj);
  }

  // =========================================================================
  // Place INTERACTABLES
  // =========================================================================

  for (const ia of INTERACTABLES) {
    let obj: THREE.Object3D;

    if (ia.model) {
      // Model exists: instance it
      const iaOpts: { scale?: number; tint?: number } = {};
      if (ia.scale !== undefined) iaOpts.scale = ia.scale;
      if (ia.tint !== undefined) iaOpts.tint = ia.tint;
      obj = instance(ia.model, iaOpts);
    } else if (ia.kind === 'fishing') {
      // Fishing spot: ripple ring on the water edge
      obj = createFishingSpot();
    } else if (ia.kind === 'npc') {
      // NPC: clone player model, tinted
      const npcOpts: { scale?: number; tint?: number } = {};
      if (ia.scale !== undefined) npcOpts.scale = ia.scale;
      if (ia.tint !== undefined) {
        npcOpts.tint = ia.tint;
      } else {
        npcOpts.tint = 0xccccff; // light blue tint by default
      }
      obj = instance('kaykit-adventurers/Character.glb', npcOpts);
    } else if (ia.kind === 'grounditem') {
      // Ground item: glowing shape
      obj = createGroundItem(ia);
    } else {
      // Fallback: empty group
      obj = new THREE.Group();
    }

    obj.position.set(ia.x, 0, ia.z);
    scene.add(obj);

    // Create invisible pick cylinder
    const pick = ia.pick ?? 2.2;
    const pickerGeom = new THREE.CylinderGeometry(pick, pick, 4, 8);
    const pickerMat = new THREE.MeshBasicMaterial({ visible: false });
    const picker = new THREE.Mesh(pickerGeom, pickerMat);
    picker.position.set(ia.x, 2, ia.z); // Centre at waist height
    picker.userData.interactableId = ia.id;
    scene.add(picker);

    interactables.push({
      data: ia,
      object: obj,
      picker,
    });
  }

  return { interactables };
}

/**
 * Create a ripple ring for fishing spots.
 */
function createFishingSpot(): THREE.Object3D {
  const group = new THREE.Group();

  // Flat ring geometry
  const geom = new THREE.TorusGeometry(1.5, 0.2, 16, 64);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a90e2,
    transparent: true,
    opacity: 0.5,
  });
  const ring = new THREE.Mesh(geom, mat);
  ring.rotation.x = Math.PI / 2; // Lie flat
  ring.position.y = 0.05; // Slightly above water
  group.add(ring);

  return group;
}

/**
 * Create a glowing shape for ground items.
 */
function createGroundItem(ia: Interactable): THREE.Object3D {
  const group = new THREE.Group();

  // Small sphere with glow
  const geom = new THREE.SphereGeometry(0.3, 16, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffdd00,
    emissive: 0xffdd00,
    emissiveIntensity: 0.8,
  });
  const sphere = new THREE.Mesh(geom, mat);
  sphere.position.y = 0.3;
  group.add(sphere);

  // Pulse animation via update loop in parent
  group.userData.isPulsing = true;
  group.userData.itemId = ia.itemId;

  return group;
}
