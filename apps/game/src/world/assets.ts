import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ASSET_REGISTRY, assetUrl } from "@everloom/assets";

const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();

function material(color: number, roughness = 0.82): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
}

function proceduralTool(id: string): THREE.Group {
  const root = new THREE.Group();
  const wood = material(0x70452c);
  const metal = material(0xa9b0ae, 0.45);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.25, 7), wood);
  handle.position.y = 0.62;
  handle.rotation.z = id.includes("rod") ? -0.22 : 0;
  root.add(handle);
  if (id.includes("hatchet")) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.12), metal);
    head.position.set(0.13, 1.17, 0);
    root.add(head);
  } else if (id.includes("pickaxe")) {
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.8, 6), metal);
    head.rotation.z = Math.PI / 2;
    head.position.y = 1.18;
    root.add(head);
  } else if (id.includes("sword")) {
    handle.scale.set(0.72, 0.48, 0.72);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.045), metal);
    blade.position.y = 1.42;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), material(0xd0a84d));
    guard.position.y = 0.88;
    root.add(blade, guard);
  } else {
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 5), material(0xd7d2bc));
    line.position.set(0.16, 0.35, 0);
    root.add(line);
  }
  return root;
}

function proceduralRipples(): THREE.Group {
  const root = new THREE.Group();
  for (const [radius, opacity] of [[0.5, 0.75], [0.9, 0.5], [1.3, 0.3]] as const) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.025, 5, 36),
      new THREE.MeshBasicMaterial({ color: 0x9ce7ea, transparent: true, opacity }),
    );
    ring.rotation.x = Math.PI / 2;
    root.add(ring);
  }
  return root;
}

function procedural(id: string): THREE.Object3D {
  if (id.includes("fishing-ripples")) return proceduralRipples();
  return proceduralTool(id);
}

async function buildCottage(): Promise<THREE.Group> {
  const root = new THREE.Group();
  const add = async (
    assetId: string,
    x: number,
    y: number,
    z: number,
    rotation = 0,
    scale: [number, number, number] = [1, 1, 1],
  ) => {
    const { object } = await instantiateAsset(assetId);
    object.position.set(x, y, z);
    object.rotation.y = rotation;
    object.scale.multiply(new THREE.Vector3(...scale));
    root.add(object);
  };
  const jobs: Promise<void>[] = [];
  for (const x of [-1, 0, 1]) {
    jobs.push(add(x === 0 ? "town.wall-door" : "town.wall-window", x, 0, 1.08, Math.PI / 2));
    jobs.push(add(x === 0 ? "town.wall-window" : "town.wall", x, 0, -1.08, -Math.PI / 2));
    jobs.push(add("town.roof", x * 1.05, 1.05, 0, 0, [1.03, 1.08, 1.92]));
  }
  for (const z of [-0.55, 0.55]) {
    jobs.push(add("town.wall", -1.55, 0, z));
    jobs.push(add("town.wall", 1.55, 0, z, Math.PI));
  }
  jobs.push(add("town.chimney", 0.62, 1.42, -0.2, 0, [1.2, 1.35, 1.2]));
  await Promise.all(jobs);
  const porch = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.13, 0.68),
    new THREE.MeshStandardMaterial({ color: 0x6d492e, roughness: 0.9 }),
  );
  porch.position.set(0, 0.07, 1.42);
  porch.castShadow = true;
  porch.receiveShadow = true;
  root.add(porch);
  root.scale.setScalar(1.55);
  return root;
}

export async function instantiateAsset(assetId: string, tint?: string | null): Promise<{ object: THREE.Object3D; animations: THREE.AnimationClip[] }> {
  const record = ASSET_REGISTRY[assetId];
  if (!record) throw new Error(`Missing asset registry entry: ${assetId}`);
  if (record.sourceFile.startsWith("procedural://")) {
    const object = procedural(assetId);
    object.scale.setScalar(record.scale);
    return { object, animations: [] };
  }
  if (record.sourceFile.startsWith("composite://")) {
    if (assetId !== "town.cottage") throw new Error(`Unknown composite asset: ${assetId}`);
    return { object: await buildCottage(), animations: [] };
  }
  let promise = cache.get(assetId);
  if (!promise) {
    promise = loader.loadAsync(assetUrl(assetId));
    cache.set(assetId, promise);
  }
  const gltf = await promise;
  const object = clone(gltf.scene);
  object.scale.setScalar(record.scale);
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (tint) {
      const next = (child.material as THREE.MeshStandardMaterial).clone();
      next.color.multiply(new THREE.Color(tint));
      child.material = next;
    }
  });
  return { object, animations: gltf.animations };
}
