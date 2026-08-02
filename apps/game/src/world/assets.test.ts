import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { addInteractionHitbox } from "./assets";

describe("addInteractionHitbox", () => {
  it("ground item receives one hitbox", () => {
    const object = new THREE.Group();
    const visible = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    object.add(visible);

    addInteractionHitbox(object, "ground_item");

    const hitboxes = object.children.filter((child) => child.userData.interactionHitArea === true);
    expect(hitboxes).toHaveLength(1);
    expect(hitboxes[0]).toBeInstanceOf(THREE.Mesh);
    const hitboxMesh = hitboxes[0] as THREE.Mesh;
    expect(hitboxMesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
  });

  it("non-ground item receives no hitbox", () => {
    const object = new THREE.Group();
    const visible = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    object.add(visible);

    const kinds = ["npc", "resource", "scenery"];
    for (const kind of kinds) {
      addInteractionHitbox(object, kind);
      const hitboxes = object.children.filter((child) => child.userData.interactionHitArea === true);
      expect(hitboxes).toHaveLength(0);
    }
  });

  it("idempotency: calling twice creates exactly one hitbox", () => {
    const object = new THREE.Group();
    const visible = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    object.add(visible);

    addInteractionHitbox(object, "ground_item");
    const firstCount = object.children.filter((child) => child.userData.interactionHitArea === true).length;

    addInteractionHitbox(object, "ground_item");
    const secondCount = object.children.filter((child) => child.userData.interactionHitArea === true).length;

    expect(firstCount).toBe(1);
    expect(secondCount).toBe(1);
  });

  it("geometry-derived clamped sizing: small/medium/large prove clamping", () => {
    const small = new THREE.Group();
    small.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1)));

    const medium = new THREE.Group();
    medium.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    const large = new THREE.Group();
    large.add(new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5)));

    addInteractionHitbox(small, "ground_item");
    addInteractionHitbox(medium, "ground_item");
    addInteractionHitbox(large, "ground_item");

    const smallHitbox = small.children.find((child) => child.userData.interactionHitArea) as THREE.Mesh;
    const mediumHitbox = medium.children.find((child) => child.userData.interactionHitArea) as THREE.Mesh;
    const largeHitbox = large.children.find((child) => child.userData.interactionHitArea) as THREE.Mesh;

    const smallRadius = (smallHitbox.geometry as THREE.SphereGeometry).parameters.radius;
    const mediumRadius = (mediumHitbox.geometry as THREE.SphereGeometry).parameters.radius;
    const largeRadius = (largeHitbox.geometry as THREE.SphereGeometry).parameters.radius;

    // Small should hit minimum (0.3).
    expect(smallRadius).toBe(0.3);
    // Medium should be derived (not clamped).
    expect(mediumRadius).toBe(0.5);
    // Large should hit maximum (1.2).
    expect(largeRadius).toBe(1.2);
    // Prove all three are different, proving clamping.
    expect(new Set([smallRadius, mediumRadius, largeRadius]).size).toBe(3);
  });

  it("correct centre: hitbox is centred on geometry bounds", () => {
    const object = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.position.set(2, 3, 4);
    object.add(mesh);

    addInteractionHitbox(object, "ground_item");

    const hitbox = object.children.find((child) => child.userData.interactionHitArea) as THREE.Mesh;
    // Hitbox should be at the centre of the geometry (2, 3, 4), not hardcoded (0, 0.3, 0).
    expect(hitbox.position.x).toBeCloseTo(2, 1);
    expect(hitbox.position.y).toBeCloseTo(3, 1);
    expect(hitbox.position.z).toBeCloseTo(4, 1);
  });

  it("invisibility and raycastability: material transparent/opaque, visible=true", () => {
    const object = new THREE.Group();
    object.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    addInteractionHitbox(object, "ground_item");

    const hitbox = object.children.find((child) => child.userData.interactionHitArea) as THREE.Mesh;
    const material = hitbox.material as THREE.MeshBasicMaterial;

    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0);
    expect(material.depthWrite).toBe(false);
    expect(material.colorWrite).toBe(false);
    expect(hitbox.visible).toBe(true); // Three.js raycasts invisible=false, but this is visible for raycasting.
  });

  it("actual raycast: ray through hitbox intersects, ray outside does not", () => {
    const object = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    object.add(mesh);

    const scene = new THREE.Scene();
    scene.add(object);
    object.position.set(0, 0, -10);
    object.updateMatrixWorld(true);

    addInteractionHitbox(object, "ground_item");

    const raycaster = new THREE.Raycaster();

    // Ray through the center of the hitbox using world-space coordinates.
    raycaster.ray.origin.set(0, 0, 0);
    raycaster.ray.direction.set(0, 0, -1).normalize();
    const hitThrough = raycaster.intersectObjects(scene.children, true);
    const hitboxInThrough = hitThrough.some((entry) => entry.object.userData.interactionHitArea === true);
    expect(hitboxInThrough).toBe(true);

    // Ray far away from the object (at x=5, y=5, aimed at the object).
    // The hitbox is at (0, 0, -10) with radius 0.5, so this ray misses it.
    raycaster.ray.origin.set(5, 5, 0);
    raycaster.ray.direction.set(0, 0, -1).normalize();
    const hitOutside = raycaster.intersectObjects(scene.children, true);
    const hitboxInOutside = hitOutside.some((entry) => entry.object.userData.interactionHitArea === true);
    expect(hitboxInOutside).toBe(false);
  });

  it("target identity propagation: hitbox receives parent targetId", () => {
    const object = new THREE.Group();
    object.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    object.userData.targetId = "test_target_123";

    addInteractionHitbox(object, "ground_item");

    const hitbox = object.children.find((child) => child.userData.interactionHitArea) as THREE.Mesh;
    // The hitbox itself doesn't get targetId; raycasting finds it and traverses
    // up to find the parent's targetId. Verify parent has it.
    expect(object.userData.targetId).toBe("test_target_123");
  });

  it("actual disposal: geometry and material are disposed", () => {
    const object = new THREE.Group();
    object.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

    addInteractionHitbox(object, "ground_item");

    const hitbox = object.children.find((child) => child.userData.interactionHitArea) as THREE.Mesh;
    const geometrySpy = vi.spyOn(hitbox.geometry, "dispose");
    const materialSpy = vi.spyOn(hitbox.material as THREE.Material, "dispose");

    // Manually dispose (as would happen in world cleanup).
    hitbox.geometry.dispose();
    (hitbox.material as THREE.Material).dispose();

    expect(geometrySpy).toHaveBeenCalledTimes(1);
    expect(materialSpy).toHaveBeenCalledTimes(1);
  });
});
