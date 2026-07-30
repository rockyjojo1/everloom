import * as THREE from "three";
import type { QualityLevel, ZoneDefinition } from "@everloom/core";
import { surfaceAt } from "../game/pathfinding";

const PALETTE: Record<string, THREE.Color> = {
  grass: new THREE.Color(0x5f934f),
  meadow: new THREE.Color(0x70a95a),
  path: new THREE.Color(0xb18b58),
  stone: new THREE.Color(0x77756b),
  water: new THREE.Color(0x496c68),
  soil: new THREE.Color(0x8b6341),
};

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

export interface Environment {
  readonly root: THREE.Group;
  readonly water: THREE.Mesh<THREE.ShapeGeometry, THREE.ShaderMaterial>;
}

export function buildEnvironment(zone: ZoneDefinition, quality: QualityLevel): Environment {
  const root = new THREE.Group();
  const ground = buildGround(zone);
  const water = buildWater(zone);
  root.add(ground, water, buildMeadowDetails(zone, quality));
  return { root, water };
}

export function updateEnvironment(environment: Environment, elapsedSeconds: number): void {
  environment.water.material.uniforms.time!.value += elapsedSeconds;
}
