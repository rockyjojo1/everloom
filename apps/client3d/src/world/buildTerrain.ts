/**
 * Terrain mesh generation: vertex-colored plane + water layer + navigation grid.
 */

import * as THREE from 'three';
import { NavGrid } from './navgrid';
import { PAINT, SURFACE_COLOR, Surface, WALKABLE, PROPS, INTERACTABLES } from './worlddata';

export function buildTerrain(): {
  mesh: THREE.Mesh;
  water: THREE.Mesh;
  surfaceAt(x: number, z: number): Surface;
  nav: NavGrid;
} {
  const size = 120;
  const min = -60;
  const segments = 120;

  // =========================================================================
  // Rasterize PAINT into a surface map
  // =========================================================================

  const surfaceMap = new Map<number, Surface>();

  // Initialize all cells to grass
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const key = z * size + x;
      surfaceMap.set(key, 'grass');
    }
  }

  // Apply PAINT entries in order
  for (const paint of PAINT) {
    if (paint.shape === 'rect') {
      const x1 = Math.max(0, Math.floor(paint.x - min));
      const x2 = Math.min(size, Math.ceil(paint.x - min + paint.w));
      const z1 = Math.max(0, Math.floor(paint.z - min));
      const z2 = Math.min(size, Math.ceil(paint.z - min + paint.d));

      for (let z = z1; z < z2; z++) {
        for (let x = x1; x < x2; x++) {
          const key = z * size + x;
          surfaceMap.set(key, paint.surface);
        }
      }
    } else if (paint.shape === 'circle') {
      const cx = paint.x - min;
      const cz = paint.z - min;
      const r2 = paint.r * paint.r;

      for (let z = Math.max(0, Math.floor(cz - paint.r)); z < Math.min(size, Math.ceil(cz + paint.r)); z++) {
        for (let x = Math.max(0, Math.floor(cx - paint.r)); x < Math.min(size, Math.ceil(cx + paint.r)); x++) {
          const dx = x - cx + 0.5;
          const dz = z - cz + 0.5;
          if (dx * dx + dz * dz <= r2) {
            const key = z * size + x;
            surfaceMap.set(key, paint.surface);
          }
        }
      }
    } else if (paint.shape === 'path') {
      // Simple line rasterization
      const x1 = paint.from[0] - min;
      const z1 = paint.from[1] - min;
      const x2 = paint.to[0] - min;
      const z2 = paint.to[1] - min;
      const steps = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1)) * 2);

      for (let i = 0; i <= steps; i++) {
        const t = steps > 0 ? i / steps : 0;
        const px = x1 + (x2 - x1) * t;
        const pz = z1 + (z2 - z1) * t;
        const hw = paint.width / 2;

        for (let dx = -hw; dx <= hw; dx++) {
          for (let dz = -hw; dz <= hw; dz++) {
            const x = Math.floor(px + dx);
            const z = Math.floor(pz + dz);
            if (x >= 0 && x < size && z >= 0 && z < size) {
              const key = z * size + x;
              surfaceMap.set(key, paint.surface);
            }
          }
        }
      }
    }
  }

  // =========================================================================
  // Create terrain mesh with vertex colors
  // =========================================================================

  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);

  // IMPORTANT: Sample colors BEFORE rotation, so getX/getY return world-space coordinates
  const posAttr = geometry.attributes.position;
  if (!posAttr) throw new Error('PlaneGeometry must have position attribute');

  const colors = new Float32Array(posAttr.count * 3);

  for (let i = 0; i < posAttr.count; i++) {
    // Before rotation: PlaneGeometry spans X in [-size/2, size/2], Y in [-size/2, size/2]
    // Need to map to world space: [-60, 60]
    const localX = posAttr.getX(i);
    const localY = posAttr.getY(i);

    // Map local coordinates to world space
    const x = min + localX + size / 2;
    const z = min + localY + size / 2;

    // Find which cell this vertex belongs to
    const cx = Math.floor(x - min + 0.5);
    const cz = Math.floor(z - min + 0.5);
    const key = Math.max(0, Math.min(size - 1, cz)) * size + Math.max(0, Math.min(size - 1, cx));

    const surface = surfaceMap.get(key) || 'grass';
    const color = SURFACE_COLOR[surface];

    const r = ((color >> 16) & 0xff) / 0xff;
    const g = ((color >> 8) & 0xff) / 0xff;
    const b = (color & 0xff) / 0xff;

    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }

  // NOW rotate after colors are assigned
  geometry.rotateX(-Math.PI / 2);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // =========================================================================
  // Water layer
  // =========================================================================

  const waterGeom = new THREE.PlaneGeometry(size, size);
  waterGeom.rotateX(-Math.PI / 2);
  waterGeom.translate(0, -0.06, 0);

  const waterColor = SURFACE_COLOR.water;
  const waterR = ((waterColor >> 16) & 0xff) / 0xff;
  const waterG = ((waterColor >> 8) & 0xff) / 0xff;
  const waterB = (waterColor & 0xff) / 0xff;

  const waterMaterial = new THREE.MeshLambertMaterial({
    color: new THREE.Color(waterR, waterG, waterB),
    transparent: true,
    opacity: 0.7,
  });

  const water = new THREE.Mesh(waterGeom, waterMaterial);

  // =========================================================================
  // Navigation grid
  // =========================================================================

  const nav = new NavGrid(size, min);

  // Block all water cells
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const key = z * size + x;
      const surface = surfaceMap.get(key) || 'grass';
      if (!WALKABLE[surface]) {
        nav.blocked[z * size + x] = 1;
      }
    }
  }

  // Block circles for props with blocks
  for (const prop of PROPS) {
    if (prop.blocks !== undefined) {
      nav.blockCircle(prop.x, prop.z, prop.blocks);
    }
  }

  // =========================================================================
  // Helper function
  // =========================================================================

  function surfaceAt(x: number, z: number): Surface {
    const cx = Math.floor(x - min);
    const cz = Math.floor(z - min);

    if (cx < 0 || cx >= size || cz < 0 || cz >= size) {
      return 'grass';
    }

    const key = cz * size + cx;
    return surfaceMap.get(key) || 'grass';
  }

  // =========================================================================
  // Verify surface mapping with known test points
  // =========================================================================

  const testPoints = [
    { x: -40, z: 0, expected: 'darkgrass', name: 'Loomwood Forest (west)' },
    { x: 0, z: -45, expected: 'stone', name: 'Burrow Mine (north)' },
    { x: 40, z: 5, expected: 'dirt', name: 'Training Grounds (east)' },
    { x: 0, z: 42, expected: 'water', name: 'Silverthread River (south)' },
    { x: 0, z: 4, expected: 'cobble', name: 'Thimblewick Square (centre)' },
  ];

  console.log('=== TERRAIN SURFACE MAPPING VERIFICATION ===');
  let allCorrect = true;
  for (const test of testPoints) {
    const actual = surfaceAt(test.x, test.z);
    const match = actual === test.expected ? '✓' : '✗';
    if (actual !== test.expected) allCorrect = false;
    console.log(`${match} (${test.x}, ${test.z}): ${actual} (expected ${test.expected}) — ${test.name}`);
  }
  console.log(allCorrect ? 'All surface mappings correct!' : 'WARNING: Surface mapping errors detected!');

  return {
    mesh,
    water,
    surfaceAt,
    nav,
  };
}
