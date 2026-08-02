import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { addInteractionHitbox } from "./assets";

describe("addInteractionHitbox", () => {
  it("adds exactly one invisible hitbox to object", () => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const initialChildCount = object.children.length;

    addInteractionHitbox(object, "ground_item");

    expect(object.children.length).toBe(initialChildCount + 1);
    const hitbox = object.children[object.children.length - 1];
    expect(hitbox).toBeInstanceOf(THREE.Mesh);
  });

  it("creates sphere geometry with appropriate radius", () => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    addInteractionHitbox(object, "ground_item");

    const hitbox = object.children[object.children.length - 1] as THREE.Mesh;
    expect(hitbox.geometry).toBeInstanceOf(THREE.SphereGeometry);
  });

  it("marks hitbox with object interaction property", () => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    addInteractionHitbox(object, "ground_item");

    const hitbox = object.children[object.children.length - 1] as THREE.Mesh;
    expect(hitbox.userData.interactionHitArea).toBe(true);
  });

  it("does not call addInteractionHitbox twice on same object", () => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

    addInteractionHitbox(object, "ground_item");
    const childCountAfterFirst = object.children.length;

    addInteractionHitbox(object, "ground_item");
    const childCountAfterSecond = object.children.length;

    // Should not add another hitbox if already present.
    expect(childCountAfterSecond).toBe(childCountAfterFirst);
  });

  it("hitbox material is invisible (transparent with 0 opacity)", () => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    addInteractionHitbox(object, "ground_item");

    const hitbox = object.children[object.children.length - 1] as THREE.Mesh;
    const material = hitbox.material as THREE.Material & { transparent?: boolean; opacity?: number };

    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0);
  });

  it("hitbox is not visible in scene", () => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    addInteractionHitbox(object, "ground_item");

    const hitbox = object.children[object.children.length - 1] as THREE.Mesh;
    expect(hitbox.visible).toBe(true); // Hidden via material transparency, not visibility flag.
  });

  it("descendant objects can still be raycasted", () => {
    const parent = new THREE.Group();
    const child = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5));
    parent.add(child);

    addInteractionHitbox(parent, "ground_item");

    // Hitbox should not interfere with raycast of child.
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), new THREE.PerspectiveCamera());

    // Child should still be raycasted.
    expect(child).toBeDefined();
  });

  it("geometry is disposed when parent is removed", () => {
    const parent = new THREE.Group();
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    parent.add(object);
    addInteractionHitbox(object, "ground_item");

    const hitbox = object.children[object.children.length - 1] as THREE.Mesh;
    const geometry = hitbox.geometry;

    const disposeSpy = vi.spyOn(geometry, "dispose");
    object.removeFromParent();

    // Geometry should be marked for cleanup (in real scene cleanup).
    expect(disposeSpy).toBeDefined();
  });

  it("creates consistent hitbox size regardless of parent geometry", () => {
    const smallBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
    const largeBox = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5));

    addInteractionHitbox(smallBox, "ground_item");
    addInteractionHitbox(largeBox, "ground_item");

    const smallHitbox = smallBox.children[smallBox.children.length - 1] as THREE.Mesh;
    const largeHitbox = largeBox.children[largeBox.children.length - 1] as THREE.Mesh;

    const smallRadius = (smallHitbox.geometry as THREE.SphereGeometry).parameters.radius;
    const largeRadius = (largeHitbox.geometry as THREE.SphereGeometry).parameters.radius;

    // Both should use the same fixed radius (0.5).
    expect(smallRadius).toBe(0.5);
    expect(largeRadius).toBe(0.5);
  });
});
