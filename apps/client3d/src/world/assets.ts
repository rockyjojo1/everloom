/**
 * Asset loading and instancing: GLTFLoader cache + efficient cloning.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// @ts-ignore - This module is available at runtime
import * as SKU from 'three/examples/jsm/utils/SkeletonUtils.js';
const SkeletonUtils = (SKU as any).SkeletonUtils || (SKU as any).default;

const loader = new GLTFLoader();
const cache = new Map<string, THREE.Group>();

/**
 * Preload models into cache (fire-and-forget).
 */
export async function preload(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map(
      path =>
        new Promise<void>((resolve) => {
          if (cache.has(path)) {
            resolve();
            return;
          }
          loader.load(
            `/models/${path}`,
            (gltf) => {
              cache.set(path, gltf.scene);
              resolve();
            },
            undefined,
            () => resolve() // fail silently
          );
        })
    )
  );
}

/**
 * Instance a model: clone from cache, apply tint if given.
 * Uses SkeletonUtils.clone for rigged models, plain .clone() for static props.
 */
export function instance(
  path: string,
  opts?: { scale?: number; rotY?: number; tint?: number }
): THREE.Object3D {
  let cached = cache.get(path);
  if (!cached) {
    // Try to load synchronously (will fail if not preloaded, but we create a placeholder)
    console.warn(`Model not preloaded: ${path}`);
    cached = new THREE.Group();
  }

  // Detect if model is rigged by looking for an Armature
  const hasArmature = cached.getObjectByName('Armature') !== undefined;
  const cloned = hasArmature ? SkeletonUtils.clone(cached) : cached.clone(true);

  if (opts?.scale !== undefined) {
    cloned.scale.setScalar(opts.scale);
  }

  if (opts?.rotY !== undefined) {
    cloned.rotation.y = opts.rotY;
  }

  if (opts?.tint !== undefined) {
    const tintColor = new THREE.Color(opts.tint);
    cloned.traverse((node: THREE.Object3D) => {
      if (node instanceof THREE.Mesh && node.material) {
        // Clone the material to avoid mutating the cached original
        const origMat = Array.isArray(node.material) ? node.material[0] : node.material;
        if (origMat && 'color' in origMat) {
          const clonedMat = origMat.clone();
          (clonedMat as THREE.MeshPhongMaterial).color.multiply(tintColor);
          if (Array.isArray(node.material)) {
            node.material = node.material.map(() => clonedMat);
          } else {
            node.material = clonedMat;
          }
        }
      }
    });
  }

  return cloned;
}
