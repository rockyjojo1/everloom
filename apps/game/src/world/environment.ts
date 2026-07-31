import * as THREE from "three";
import type { QualityLevel, ZoneDefinition } from "@everloom/core";
import { surfaceAt } from "../game/pathfinding";

const PALETTE: Record<string, THREE.Color> = {
  // A deeper, cooler emerald than the meadow default — reserved for the
  // Verdant Grove so its floor reads as a distinct, consistent palette
  // rather than a copy of the rest of Meadowrest.
  grass: new THREE.Color(0x3f8a58),
  meadow: new THREE.Color(0x70a95a),
  path: new THREE.Color(0xb18b58),
  stone: new THREE.Color(0x7d7566),
  water: new THREE.Color(0x496c68),
  soil: new THREE.Color(0x8b6341),
};

// The colour the ground fades toward at the edge of the authored terrain —
// kept in lockstep with GameWorld's scene background/fog colour so the
// boundary skirt below dissolves into the horizon instead of showing a hard
// edge of empty sky.
const HORIZON_COLOR = new THREE.Color(0x91b9b7);

function hash(x: number, z: number, salt = 0): number {
  const value = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

export function terrainHeight(zone: ZoneDefinition, gridX: number, gridZ: number): number {
  const surface = surfaceAt(zone, gridX, gridZ);
  if (surface === "water") return -0.38;
  const broad = Math.sin(gridX * 0.23) * 0.08 + Math.cos(gridZ * 0.29) * 0.06;
  const detail = (hash(gridX, gridZ, 3) - 0.5) * 0.055;
  return surface === "path" || surface === "stone" ? broad * 0.28 : broad + detail;
}

function buildGround(zone: ZoneDefinition): THREE.Mesh {
  const width = zone.width * zone.cellSize;
  const depth = zone.depth * zone.cellSize;
  const geometry = new THREE.PlaneGeometry(width, depth, zone.width * 2, zone.depth * 2);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let index = 0; index < position.count; index += 1) {
    const wx = position.getX(index);
    const wz = position.getZ(index);
    const gx = wx / zone.cellSize + zone.width / 2;
    const gz = wz / zone.cellSize + zone.depth / 2;
    const surface = surfaceAt(zone, gx, gz);
    position.setY(index, terrainHeight(zone, gx, gz));
    color.copy(PALETTE[surface] ?? PALETTE.grass!);
    const variation = 0.88 + hash(gx, gz, 8) * 0.18;
    color.multiplyScalar(variation);
    if (surface === "path") color.lerp(new THREE.Color(0xd1ac72), 0.15);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
  }));
  mesh.receiveShadow = true;
  mesh.userData.ground = true;
  return mesh;
}

function buildWater(zone: ZoneDefinition): THREE.Mesh<THREE.ShapeGeometry, THREE.ShaderMaterial> {
  const halfWidth = zone.width * zone.cellSize / 2;
  const north = (25 - zone.depth / 2) * zone.cellSize;
  const south = zone.depth * zone.cellSize / 2 + 4;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth - 4, south);
  shape.lineTo(-halfWidth - 4, north + 0.5);
  for (let step = 0; step <= 16; step += 1) {
    const x = -halfWidth + step / 16 * halfWidth * 2;
    const z = north + Math.sin(step * 1.31) * 0.42 + Math.sin(step * 0.43) * 0.25;
    shape.lineTo(x, z);
  }
  shape.lineTo(halfWidth + 4, south);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 24);
  geometry.rotateX(Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
      deep: { value: new THREE.Color(0x245f70) },
      shallow: { value: new THREE.Color(0x62a9a4) },
    },
    vertexShader: `
      varying vec3 vWorld;
      uniform float time;
      void main() {
        vec3 p = position;
        p.y += sin(p.x * .18 + time * .8) * .025 + cos(p.z * .22 - time * .55) * .018;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform float time;
      uniform vec3 deep;
      uniform vec3 shallow;
      void main() {
        float shimmer = sin(vWorld.x * .65 + time) * cos(vWorld.z * .5 - time * .7) * .5 + .5;
        vec3 colour = mix(deep, shallow, .28 + shimmer * .14);
        gl_FragColor = vec4(colour, .88);
      }
    `,
  });
  const water = new THREE.Mesh(geometry, material);
  water.position.y = -0.14;
  water.renderOrder = 2;
  return water;
}

function tuftGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.11, 0, 0, 0, 0.3, 0, 0.11, 0, 0,
    0, 0, -0.11, 0, 0.26, 0, 0, 0, 0.11,
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildMeadowDetails(zone: ZoneDefinition, quality: QualityLevel): THREE.Group {
  const root = new THREE.Group();
  const density = quality === "low" ? 75 : quality === "high" ? 310 : 180;
  const grass = new THREE.InstancedMesh(
    tuftGeometry(),
    new THREE.MeshStandardMaterial({ color: 0x65994f, side: THREE.DoubleSide, roughness: 1 }),
    density,
  );
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  let placed = 0;
  for (let attempt = 0; placed < density && attempt < density * 8; attempt += 1) {
    const gx = hash(attempt, 2, 1) * (zone.width - 2) + 1;
    const gz = hash(attempt, 5, 2) * (zone.depth - 7) + 1;
    const surface = surfaceAt(zone, gx, gz);
    if (surface !== "meadow" && surface !== "grass") continue;
    position.set((gx - zone.width / 2) * zone.cellSize, terrainHeight(zone, gx, gz) + 0.02, (gz - zone.depth / 2) * zone.cellSize);
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(attempt, 7, 4) * Math.PI);
    const size = 0.65 + hash(attempt, 9, 6) * 0.75;
    scale.set(size, size, size);
    matrix.compose(position, rotation, scale);
    grass.setMatrixAt(placed, matrix);
    placed += 1;
  }
  grass.count = placed;
  grass.instanceMatrix.needsUpdate = true;
  root.add(grass);

  const rockCount = quality === "low" ? 22 : 44;
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.46, 0),
    new THREE.MeshStandardMaterial({ color: 0x667069, roughness: 0.96 }),
    rockCount,
  );
  for (let index = 0; index < rockCount; index += 1) {
    const shoreline = index < rockCount * 0.6;
    const gx = hash(index, 12, 9) * zone.width;
    const gz = shoreline ? 24.1 + hash(index, 14, 7) * 0.75 : hash(index, 18, 3) * (zone.depth - 6);
    position.set((gx - zone.width / 2) * zone.cellSize, terrainHeight(zone, gx, gz) + 0.12, (gz - zone.depth / 2) * zone.cellSize);
    rotation.setFromEuler(new THREE.Euler(hash(index, 1) * 0.3, hash(index, 4) * Math.PI, hash(index, 8) * 0.2));
    scale.set(0.65 + hash(index, 21) * 1.25, 0.45 + hash(index, 23) * 0.7, 0.75 + hash(index, 25) * 1.1);
    matrix.compose(position, rotation, scale);
    rocks.setMatrixAt(index, matrix);
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  rocks.instanceMatrix.needsUpdate = true;
  root.add(rocks);
  return root;
}

// World-boundary treatment: a cheap low-poly "skirt" that extends the ground
// well past the authored terrain and fades its colour toward the sky/fog
// colour, plus a sparse ring of instanced silhouette props scattered across
// it. Both live entirely outside the zone's own width/depth grid, so neither
// enters the pathfinding grid, blockedCells, or scenery/interactable data —
// they are purely a horizon dressing for the world-edge problem described in
// the brief (the ground plane otherwise stops abruptly against empty sky).
const SKIRT_MARGIN = 30;

function buildSkirt(zone: ZoneDefinition): THREE.Mesh {
  const halfWidth = zone.width * zone.cellSize / 2;
  const halfDepth = zone.depth * zone.cellSize / 2;
  const outerWidth = halfWidth + SKIRT_MARGIN;
  const outerDepth = halfDepth + SKIRT_MARGIN;
  const shape = new THREE.Shape();
  shape.moveTo(-outerWidth, -outerDepth);
  shape.lineTo(outerWidth, -outerDepth);
  shape.lineTo(outerWidth, outerDepth);
  shape.lineTo(-outerWidth, outerDepth);
  shape.lineTo(-outerWidth, -outerDepth);
  const hole = new THREE.Path();
  hole.moveTo(-halfWidth, -halfDepth);
  hole.lineTo(halfWidth, -halfDepth);
  hole.lineTo(halfWidth, halfDepth);
  hole.lineTo(-halfWidth, halfDepth);
  hole.lineTo(-halfWidth, -halfDepth);
  shape.holes.push(hole);
  const geometry = new THREE.ShapeGeometry(shape, 6);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const colors: number[] = [];
  const innerColor = PALETTE.meadow!.clone().multiplyScalar(0.82);
  const color = new THREE.Color();
  for (let index = 0; index < position.count; index += 1) {
    const wx = position.getX(index);
    const wz = position.getZ(index);
    const beyondX = Math.max(0, Math.abs(wx) - halfWidth);
    const beyondZ = Math.max(0, Math.abs(wz) - halfDepth);
    const t = Math.min(1, Math.max(beyondX, beyondZ) / SKIRT_MARGIN);
    color.copy(innerColor).lerp(HORIZON_COLOR, t);
    // A gentle downward slope sells the land "falling away" toward the
    // horizon instead of reading as an infinite flat plate.
    position.setY(index, -t * t * 2.4);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    fog: true,
  }));
  mesh.position.y = -0.05;
  mesh.receiveShadow = false;
  return mesh;
}

function boundaryConeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.ConeGeometry(0.85, 3.1, 6);
  geometry.translate(0, 1.55, 0);
  return geometry;
}

function buildBoundaryProps(zone: ZoneDefinition, quality: QualityLevel): THREE.Group {
  const root = new THREE.Group();
  const halfWidth = zone.width * zone.cellSize / 2;
  const halfDepth = zone.depth * zone.cellSize / 2;
  const outerWidth = halfWidth + SKIRT_MARGIN - 4;
  const outerDepth = halfDepth + SKIRT_MARGIN - 4;
  const count = quality === "low" ? 26 : quality === "high" ? 76 : 48;
  const rockCount = Math.round(count * 0.4);
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x2f4a3c, roughness: 1 });
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x5b6660, roughness: 0.95 });
  const trees = new THREE.InstancedMesh(boundaryConeGeometry(), treeMaterial, count);
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.05, 0), rockMaterial, rockCount);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let placedTrees = 0;
  let placedRocks = 0;
  for (let attempt = 0; placedTrees < count && attempt < count * 6; attempt += 1) {
    const gx = (hash(attempt, 51, 3) * 2 - 1) * outerWidth;
    const gz = (hash(attempt, 57, 6) * 2 - 1) * outerDepth;
    if (Math.abs(gx) < halfWidth + 2 && Math.abs(gz) < halfDepth + 2) continue;
    const t = Math.min(1, Math.max(Math.abs(gx) - halfWidth, Math.abs(gz) - halfDepth) / SKIRT_MARGIN);
    position.set(gx, -t * t * 2.4, gz);
    rotation.setFromAxisAngle(up, hash(attempt, 61, 9) * Math.PI * 2);
    const size = 0.8 + hash(attempt, 67, 12) * 1.7;
    scale.set(size, size * (0.85 + hash(attempt, 71, 15) * 0.4), size);
    matrix.compose(position, rotation, scale);
    trees.setMatrixAt(placedTrees, matrix);
    placedTrees += 1;
    if (placedRocks < rockCount && hash(attempt, 77, 18) > 0.55) {
      position.y -= 0.6;
      rotation.setFromEuler(new THREE.Euler(hash(attempt, 2) * 0.3, hash(attempt, 4) * Math.PI, hash(attempt, 6) * 0.3));
      const rockSize = 0.5 + hash(attempt, 81, 21) * 0.9;
      scale.set(rockSize, rockSize * 0.8, rockSize);
      matrix.compose(position, rotation, scale);
      rocks.setMatrixAt(placedRocks, matrix);
      placedRocks += 1;
    }
  }
  trees.count = placedTrees;
  trees.instanceMatrix.needsUpdate = true;
  rocks.count = placedRocks;
  rocks.instanceMatrix.needsUpdate = true;
  trees.castShadow = false;
  trees.receiveShadow = false;
  rocks.castShadow = false;
  rocks.receiveShadow = false;
  root.add(trees, rocks);
  return root;
}

export interface Environment {
  readonly root: THREE.Group;
  readonly water: THREE.Mesh<THREE.ShapeGeometry, THREE.ShaderMaterial>;
}

export function buildEnvironment(zone: ZoneDefinition, quality: QualityLevel): Environment {
  const root = new THREE.Group();
  const ground = buildGround(zone);
  const water = buildWater(zone);
  const skirt = buildSkirt(zone);
  root.add(skirt, ground, water, buildMeadowDetails(zone, quality), buildBoundaryProps(zone, quality));
  return { root, water };
}

export function updateEnvironment(environment: Environment, elapsedSeconds: number): void {
  environment.water.material.uniforms.time!.value += elapsedSeconds;
}
