import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { addInteractionHitbox } from "./assets";
import { disposeObject } from "./threeDisposal";

function findHitbox(object: THREE.Object3D): THREE.Mesh {
  const hitbox = object.children.find((child) => child.userData.interactionHitArea === true);
  if (!hitbox) throw new Error("hitbox not found");
  return hitbox as THREE.Mesh;
}

describe("addInteractionHitbox", () => {
  it("ground item receives exactly one hitbox", () => {
    const object = new THREE.Group();
    object.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    addInteractionHitbox(object, "ground_item");

    const hitboxes = object.children.filter((child) => child.userData.interactionHitArea === true);
    expect(hitboxes).toHaveLength(1);
    expect(hitboxes[0]).toBeInstanceOf(THREE.Mesh);
    expect((hitboxes[0] as THREE.Mesh).geometry).toBeInstanceOf(THREE.SphereGeometry);
  });

  it("npc, resource and scenery receive no hitbox", () => {
    for (const kind of ["npc", "resource", "scenery"]) {
      const object = new THREE.Group();
      object.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
      addInteractionHitbox(object, kind);
      expect(object.children.filter((child) => child.userData.interactionHitArea === true)).toHaveLength(0);
    }
  });

  it("repeated calls remain idempotent", () => {
    const object = new THREE.Group();
    object.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    addInteractionHitbox(object, "ground_item");
    addInteractionHitbox(object, "ground_item");
    addInteractionHitbox(object, "ground_item");

    expect(object.children.filter((child) => child.userData.interactionHitArea === true)).toHaveLength(1);
  });

  it("small/medium/large geometry prove minimum, derived and maximum sizing", () => {
    const small = new THREE.Group();
    small.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1)));
    const medium = new THREE.Group();
    medium.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    const large = new THREE.Group();
    large.add(new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5)));

    addInteractionHitbox(small, "ground_item");
    addInteractionHitbox(medium, "ground_item");
    addInteractionHitbox(large, "ground_item");

    const smallRadius = (findHitbox(small).geometry as THREE.SphereGeometry).parameters.radius;
    const mediumRadius = (findHitbox(medium).geometry as THREE.SphereGeometry).parameters.radius;
    const largeRadius = (findHitbox(large).geometry as THREE.SphereGeometry).parameters.radius;

    expect(smallRadius).toBe(0.3); // clamped to documented minimum
    expect(mediumRadius).toBe(0.5); // derived from bounds, unclamped
    expect(largeRadius).toBe(1.2); // clamped to documented maximum
    expect(new Set([smallRadius, mediumRadius, largeRadius]).size).toBe(3);
  });

  it("local centre is correct for offset geometry", () => {
    const object = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.position.set(2, 3, 4);
    object.add(mesh);

    addInteractionHitbox(object, "ground_item");

    const hitbox = findHitbox(object);
    expect(hitbox.position.x).toBeCloseTo(2, 5);
    expect(hitbox.position.y).toBeCloseTo(3, 5);
    expect(hitbox.position.z).toBeCloseTo(4, 5);
  });

  it("centre remains correct when the parent is translated, rotated and scaled", () => {
    // Mirrors GameWorld's real addAsset order: position/rotation/scale are
    // applied to the object *before* addInteractionHitbox runs.
    const object = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.position.set(1, 0, 0); // local offset inside the object
    object.add(mesh);
    object.position.set(10, 0, -5);
    object.rotation.y = Math.PI / 2;
    object.scale.set(2, 2, 2);

    addInteractionHitbox(object, "ground_item");
    object.updateMatrixWorld(true);

    const hitbox = findHitbox(object);
    // Local centre must equal the mesh's own local offset, unaffected by
    // the parent's transform (that transform applies once, automatically,
    // via the scene graph when world position is read).
    expect(hitbox.position.x).toBeCloseTo(1, 5);
    expect(hitbox.position.y).toBeCloseTo(0, 5);
    expect(hitbox.position.z).toBeCloseTo(0, 5);

    // World position must reflect the parent's transform applied exactly
    // once: rotate (1,0,0) by 90° around Y -> (0,0,-1), scale by 2 ->
    // (0,0,-2), then translate by (10,0,-5) -> (10,0,-7).
    const worldPosition = hitbox.getWorldPosition(new THREE.Vector3());
    expect(worldPosition.x).toBeCloseTo(10, 4);
    expect(worldPosition.y).toBeCloseTo(0, 4);
    expect(worldPosition.z).toBeCloseTo(-7, 4);
  });

  it("material is visually invisible but raycastable", () => {
    const object = new THREE.Group();
    object.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    addInteractionHitbox(object, "ground_item");

    const hitbox = findHitbox(object);
    const material = hitbox.material as THREE.MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0);
    expect(material.depthWrite).toBe(false);
    expect(material.colorWrite).toBe(false);
    // visible=true is required for Three.js to raycast it at all.
    expect(hitbox.visible).toBe(true);
  });

  it("a real ray through the hitbox intersects it, and the correct targetId is carried", () => {
    const object = new THREE.Group();
    object.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    const scene = new THREE.Scene();
    scene.add(object);
    object.position.set(0, 0, -10);
    object.updateMatrixWorld(true);

    addInteractionHitbox(object, "ground_item", "ground_worn_hatchet");

    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.set(0, 0, 0);
    raycaster.ray.direction.set(0, 0, -1).normalize();
    const hits = raycaster.intersectObjects(scene.children, true);
    const hitboxHit = hits.find((entry) => entry.object.userData.interactionHitArea === true);

    expect(hitboxHit).toBeDefined();
    expect(hitboxHit!.object.userData.targetId).toBe("ground_worn_hatchet");
  });

  it("a real ray outside the hitbox does not intersect it", () => {
    const object = new THREE.Group();
    object.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    const scene = new THREE.Scene();
    scene.add(object);
    object.position.set(0, 0, -10);
    object.updateMatrixWorld(true);

    addInteractionHitbox(object, "ground_item", "ground_worn_hatchet");

    const raycaster = new THREE.Raycaster();
    // Origin far to the side, aimed parallel to the hitbox rather than at it.
    raycaster.ray.origin.set(5, 5, 0);
    raycaster.ray.direction.set(0, 0, -1).normalize();
    const hits = raycaster.intersectObjects(scene.children, true);
    const hitboxHit = hits.some((entry) => entry.object.userData.interactionHitArea === true);

    expect(hitboxHit).toBe(false);
  });

  it("the production disposal utility disposes hitbox geometry and material exactly once", () => {
    const object = new THREE.Group();
    object.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    addInteractionHitbox(object, "ground_item");

    const hitbox = findHitbox(object);
    const geometrySpy = vi.spyOn(hitbox.geometry, "dispose");
    const materialSpy = vi.spyOn(hitbox.material as THREE.Material, "dispose");

    disposeObject(object);

    expect(geometrySpy).toHaveBeenCalledTimes(1);
    expect(materialSpy).toHaveBeenCalledTimes(1);
  });
});
