// Meadowrest landmark structures: Hall, gates, archways, and navigation markers.
// Built entirely from Three.js primitives for lightweight composition.

import * as THREE from "three";

const COLORS = {
  stone: 0x7d7566,
  stoneLight: 0x9a8b78,
  wood: 0x8b6341,
  woodDark: 0x5a3f2a,
} as const;

/**
 * Meadowrest Hall: the primary settlement anchor (6.5 × 5.5 units)
 * A simple stone building with a peaked roof, positioned as the zone's
 * visual "home" landmark.
 */
export function buildMeadowrestHall(): THREE.Group {
  const group = new THREE.Group();
  group.name = "meadowrest-hall";

  // Main building body: rectangular stone structure
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.stone,
    roughness: 0.85,
    metalness: 0.0,
  });
  const walls = new THREE.Mesh(new THREE.BoxGeometry(6.5, 4.2, 5.5), wallMaterial);
  walls.position.y = 2.1;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Roof: peaked gable (cone shape)
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.woodDark,
    roughness: 0.75,
    metalness: 0.05,
  });
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3.7, 2.2, 4, 2), // base radius, height, radial segments, height segments
    roofMaterial,
  );
  roof.position.y = 4.6;
  roof.rotation.y = Math.PI / 4; // rotate 45° so peak aligns with building corners
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Door frame and opening (visual only, not a collision)
  const doorFrameMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.stoneLight,
    roughness: 0.8,
    metalness: 0.0,
  });
  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.4, 0.15), // width, height, depth
    doorFrameMaterial,
  );
  doorFrame.position.set(0, 1.2, 2.76); // center of south face, eye height
  doorFrame.castShadow = true;
  doorFrame.receiveShadow = true;
  group.add(doorFrame);

  // Window openings (visual detail)
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x1a0d08 }); // very dark, reads as empty
  for (const x of [-1.8, 1.8]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), windowMaterial);
    window.position.set(x, 3.2, 2.76);
    window.castShadow = true;
    group.add(window);
  }

  group.castShadow = true;
  group.receiveShadow = true;
  return group;
}

/**
 * Entry Gate/Arch: welcoming threshold at settlement entrance (3.5 × 4.0 units)
 * Two pillars with a horizontal arch connecting them.
 */
export function buildEntryGate(): THREE.Group {
  const group = new THREE.Group();
  group.name = "entry-gate";

  const pillarMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.stone,
    roughness: 0.85,
    metalness: 0.0,
  });
  const archMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.wood,
    roughness: 0.7,
    metalness: 0.08,
  });

  // Left pillar
  const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3.5, 8), pillarMaterial);
  pillarL.position.set(-2.0, 1.75, 0);
  pillarL.castShadow = true;
  pillarL.receiveShadow = true;
  group.add(pillarL);

  // Right pillar
  const pillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3.5, 8), pillarMaterial);
  pillarR.position.set(2.0, 1.75, 0);
  pillarR.castShadow = true;
  pillarR.receiveShadow = true;
  group.add(pillarR);

  // Arch spanning between pillars
  const arch = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.28, 0.4), archMaterial);
  arch.position.set(0, 3.4, 0);
  arch.castShadow = true;
  arch.receiveShadow = true;
  group.add(arch);

  group.castShadow = true;
  group.receiveShadow = true;
  return group;
}

/**
 * Waystones: small navigation markers (0.8 unit tall pillars)
 * Placed at path corners to guide direction.
 */
export function buildWaystone(): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.stoneLight,
    roughness: 0.8,
    metalness: 0.0,
  });
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.8, 6), material);
  marker.castShadow = true;
  marker.receiveShadow = true;
  marker.position.y = 0.4;
  return marker;
}

/**
 * Grove Entrance Arch: decorative threshold marking the Verdant Grove boundary
 * (2.5 × 2.2 units). Smaller and more naturalistic than the Entry Gate.
 */
export function buildGroveEntrance(): THREE.Group {
  const group = new THREE.Group();
  group.name = "grove-entrance";

  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.stone,
    roughness: 0.85,
    metalness: 0.0,
  });

  // Two rounded stones flanking the entrance
  for (const x of [-1.25, 1.25]) {
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 6), stoneMaterial);
    stone.position.set(x, 0.4, 0);
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  // Arch above (simple box)
  const arch = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 0.35), stoneMaterial);
  arch.position.y = 2.2;
  arch.castShadow = true;
  arch.receiveShadow = true;
  group.add(arch);

  group.castShadow = true;
  group.receiveShadow = true;
  return group;
}

/**
 * Woodpile: stacked logs at the base of a woodcutting tree
 * Visual indicator that gathering happens here.
 */
export function buildWoodpile(): THREE.Group {
  const group = new THREE.Group();
  group.name = "woodpile";

  const logMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.wood,
    roughness: 0.65,
    metalness: 0.05,
  });

  // Three logs stacked in a pile
  const logPositions: [number, number, number][] = [
    [0, 0.25, 0],    // base log
    [-0.3, 0.5, 0.1],  // second log, offset
    [0.3, 0.75, -0.1], // third log
  ];

  for (const [x, y, z] of logPositions) {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.8, 6), // radius, radiusTop, height, segments
      logMaterial,
    );
    log.position.set(x, y, z);
    log.rotation.z = Math.random() * 0.3 - 0.15; // slight random tilt
    log.castShadow = true;
    log.receiveShadow = true;
    group.add(log);
  }

  group.castShadow = true;
  group.receiveShadow = true;
  return group;
}

/**
 * Particle effect for gather/chop feedback: wood chips bursting outward
 * Returns a THREE.Points object that can be animated in the render loop.
 */
export function createGatherParticles(): THREE.Points {
  const count = 16;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);

  // Initialize particles in a burst pattern
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 0.8 + Math.random() * 0.6;
    const upSpeed = -0.2 - Math.random() * 0.3; // gravity

    positions[i * 3] = 0;     // x
    positions[i * 3 + 1] = 0; // y
    positions[i * 3 + 2] = 0; // z

    velocities[i * 3] = Math.cos(angle) * speed;
    velocities[i * 3 + 1] = upSpeed;
    velocities[i * 3 + 2] = Math.sin(angle) * speed;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: COLORS.wood,
    size: 0.12,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(geometry, material);
  (particles.userData as any).velocities = velocities;
  (particles.userData as any).lifeTime = 0;
  (particles.userData as any).maxLifeTime = 0.4; // 0.4 seconds

  return particles;
}

/**
 * Tool ground item with glow effect (hatchet, pickaxe, or fishing rod)
 * Includes a subtle additive ring at the base.
 */
export function buildToolGroundItem(itemType: "hatchet" | "pickaxe" | "rod"): THREE.Group {
  const group = new THREE.Group();
  group.name = `tool-ground-${itemType}`;

  // Simplified tool mesh (visual only, actual model is loaded elsewhere)
  const toolMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.wood,
    roughness: 0.6,
    metalness: 0.2,
  });
  const tool = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.08), toolMaterial);
  tool.position.y = 0.4;
  tool.castShadow = true;
  tool.receiveShadow = true;
  group.add(tool);

  // Glow ring at base
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd76a,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 16), glowMaterial);
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = 0.08;
  group.add(glowRing);

  group.castShadow = true;
  group.receiveShadow = true;
  return group;
}
