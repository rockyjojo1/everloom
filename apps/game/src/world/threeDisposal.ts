// Three.js resource disposal utility for safe cleanup of Three.js objects,
// textures, materials, geometries, and animation state.

import * as THREE from "three";

export interface DisposalOptions {
  disposeTextures?: boolean;
  disposeMaterials?: boolean;
  disposeGeometries?: boolean;
  disposeAnimations?: boolean;
}

/**
 * Safely dispose a THREE.Material or array of materials.
 * Handles textures referenced by materials, including shader uniforms.
 */
export function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const mat of materials) {
    if (!mat) continue;
    const stdMat = mat as THREE.MeshStandardMaterial & {
      map?: THREE.Texture;
      normalMap?: THREE.Texture;
      roughnessMap?: THREE.Texture;
      metalnessMap?: THREE.Texture;
      aoMap?: THREE.Texture;
      emissiveMap?: THREE.Texture;
      alphaMap?: THREE.Texture;
      uniforms?: Record<string, { value: THREE.Texture | unknown }>;
    };
    // Dispose textures referenced by this material.
    for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap"]) {
      const texture = stdMat[key as keyof typeof stdMat] as THREE.Texture | undefined;
      if (texture instanceof THREE.Texture) {
        texture.dispose();
      }
    }
    // Dispose shader uniforms if present (ShaderMaterial).
    if (stdMat.uniforms) {
      for (const uniform of Object.values(stdMat.uniforms)) {
        if (uniform && uniform.value instanceof THREE.Texture) {
          uniform.value.dispose();
        }
      }
    }
    mat.dispose();
  }
}

/**
 * Safely dispose a THREE.BufferGeometry or array of geometries.
 */
export function disposeGeometry(geometry: THREE.BufferGeometry | THREE.BufferGeometry[]): void {
  const geometries = Array.isArray(geometry) ? geometry : [geometry];
  for (const geom of geometries) {
    if (geom) geom.dispose();
  }
}

/**
 * Recursively dispose all materials and geometries in an object tree.
 */
export function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.geometry) disposeGeometry(child.geometry);
      if (child.material) disposeMaterial(child.material);
    }
    if (child instanceof THREE.Line || child instanceof THREE.Points) {
      if (child.geometry) disposeGeometry(child.geometry);
      if (child.material) disposeMaterial(child.material);
    }
  });
}

/**
 * Safely stop and dispose animation actions and mixers.
 */
export function disposeAnimationMixer(mixer: THREE.AnimationMixer | null | undefined): void {
  if (!mixer) return;
  mixer.stopAllAction();
}

/**
 * Complete disposal: object tree, animations, canvas, and listeners.
 */
export function completeDisposal(options: {
  object?: THREE.Object3D | null;
  mixer?: THREE.AnimationMixer | null;
  renderer?: THREE.WebGLRenderer | null;
  animationFrameId?: number | null;
  resizeObserver?: ResizeObserver | null;
  eventListeners?: Array<{ target: EventTarget; event: string; handler: EventListener }>;
}): void {
  // Dispose object tree and all resources.
  if (options.object) {
    disposeObject(options.object);
  }

  // Stop and dispose animations.
  if (options.mixer) {
    disposeAnimationMixer(options.mixer);
  }

  // Stop render loop.
  if (options.animationFrameId) {
    cancelAnimationFrame(options.animationFrameId);
  }

  // Stop resize observer.
  if (options.resizeObserver) {
    options.resizeObserver.disconnect();
  }

  // Remove event listeners.
  if (options.eventListeners) {
    for (const { target, event, handler } of options.eventListeners) {
      target.removeEventListener(event, handler);
    }
  }

  // Dispose renderer last.
  if (options.renderer) {
    options.renderer.dispose();
  }
}
