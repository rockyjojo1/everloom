// Visual feedback and animation utilities for gathering, equipping, and collection actions.

import * as THREE from "three";

/**
 * Animate gather particles (wood chips) bursting from a position.
 * Updates particle positions and opacity based on elapsed time.
 */
export function updateGatherParticles(
  particles: THREE.Points,
  deltaTime: number,
): void {
  const userData = particles.userData as any;
  if (!userData.velocities) return;

  userData.lifeTime += deltaTime;
  if (userData.lifeTime > userData.maxLifeTime) {
    particles.visible = false;
    return;
  }

  const positions = (particles.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
  const velocities = userData.velocities as Float32Array;
  const life = userData.lifeTime / userData.maxLifeTime; // 0 to 1
  const opacity = Math.max(0, 1 - life);

  for (let i = 0; i < positions.length; i += 3) {
    const vx = velocities[i];
    const vy = velocities[i + 1] - 9.81 * deltaTime; // gravity
    const vz = velocities[i + 2];

    positions[i] += vx * deltaTime;
    positions[i + 1] += vy * deltaTime;
    positions[i + 2] += vz * deltaTime;

    velocities[i + 1] = vy; // update velocity for next frame
  }

  (particles.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  (particles.material as THREE.PointsMaterial).opacity = opacity;
}

/**
 * Trigger a gather particle burst at a world position.
 * Clones the template, positions it, and marks it for animation.
 */
export function triggerGatherParticles(
  template: THREE.Points,
  position: THREE.Vector3,
  scene: THREE.Scene,
): THREE.Points {
  const particles = template.clone() as THREE.Points;
  particles.position.copy(position);
  particles.visible = true;
  (particles.userData as any).lifeTime = 0;
  scene.add(particles);

  // Auto-cleanup after animation completes
  const cleanup = () => {
    if (!particles.visible) {
      scene.remove(particles);
    }
  };
  setTimeout(cleanup, 500); // slightly longer than max lifetime for safety

  return particles;
}

/**
 * Flash effect at a position (brief bright mesh expanding).
 * Used for gather contact feedback.
 */
export function createFlashEffect(position: THREE.Vector3, scene: THREE.Scene): void {
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  flash.position.copy(position).add(new THREE.Vector3(0, 0.8, 0));
  scene.add(flash);

  // Animate: expand and fade over 0.15s
  const startTime = performance.now();
  const duration = 150;
  const animate = () => {
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / duration);
    flash.scale.setScalar(1 + t * 0.8);
    (flash.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      scene.remove(flash);
    }
  };
  animate();
}

/**
 * Item collection animation: item scales up and fades out.
 * Used when player picks up a ground item.
 */
export function animateItemCollection(
  item: THREE.Object3D,
  scene: THREE.Scene,
): Promise<void> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const duration = 200; // 0.2s
    const startScale = item.scale.clone();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / duration);

      // Scale up slightly
      const scale = 1 + t * 0.2;
      item.scale.copy(startScale).multiplyScalar(scale);

      // Fade out (for meshes in the item group)
      item.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
          if (!child.material.transparent) {
            child.material = child.material.clone();
            child.material.transparent = true;
          }
          (child.material as any).opacity = Math.max(0, 1 - t);
        }
      });

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        scene.remove(item);
        resolve();
      }
    };
    animate();
  });
}

/**
 * Glow pulse effect on an object (scales glow/emissive up and down).
 * Used for highlighting interactive objects.
 */
export function pulsateGlow(
  object: THREE.Object3D,
  duration: number = 300,
): void {
  const startTime = performance.now();
  const animate = () => {
    const elapsed = performance.now() - startTime;
    const t = elapsed / duration;
    if (t >= 1) return;

    const pulse = Math.sin(t * Math.PI) * 0.5 + 0.5; // smooth easing
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        const mat = child.material as any;
        if (mat.opacity !== undefined) {
          mat.opacity = 0.5 + pulse * 0.5; // pulse between 0.5 and 1.0
        }
      }
    });

    requestAnimationFrame(animate);
  };
  animate();
}

/**
 * Animate character reaching down to pick up an item.
 * Moves character model down slightly and plays reach animation if available.
 */
export function playPickupAnimation(
  playerMixer: THREE.AnimationMixer | null,
  onComplete: () => void,
): void {
  // If a "Pickup" or "Idle" animation is available, play it
  if (playerMixer) {
    const root = (playerMixer as any)._root as THREE.Object3D;
    const clips = root.userData.animations as THREE.AnimationClip[] | undefined;
    const pickupClip = clips?.find((c) => c.name.includes("Pickup")) ?? clips?.find((c) => c.name === "Idle");

    if (pickupClip) {
      playerMixer.stopAllAction();
      const action = playerMixer.clipAction(pickupClip).reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();

      // Wait for animation to finish
      setTimeout(onComplete, pickupClip.duration * 1000);
      return;
    }
  }

  // Fallback: just wait a bit and complete
  setTimeout(onComplete, 300);
}
