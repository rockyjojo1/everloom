import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ASSET_REGISTRY, assetUrl } from "@everloom/assets/runtime";

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
  } else if (id.includes("battleaxe")) {
    // Deliberately a different silhouette from the sword above: a short,
    // thick haft topped by a broad double-bladed copper head, rather than a
    // tall thin blade. This is the Copper Battleaxe's own procedural mesh —
    // it must never be mistaken for the Militia Sword at a glance.
    handle.scale.set(0.85, 0.62, 0.85);
    const copper = material(0xc77d43, 0.5);
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.3, 8), copper);
    socket.rotation.z = Math.PI / 2;
    socket.position.y = 1.22;
    const bladeLeft = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.14, 4), copper);
    bladeLeft.rotation.z = Math.PI / 2;
    bladeLeft.rotation.y = Math.PI / 4;
    bladeLeft.position.set(-0.24, 1.22, 0);
    const bladeRight = bladeLeft.clone();
    bladeRight.rotation.z = -Math.PI / 2;
    bladeRight.position.set(0.24, 1.22, 0);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), metal);
    spike.position.y = 1.5;
    root.add(socket, bladeLeft, bladeRight, spike);
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

function proceduralSmelter(): THREE.Group {
  // Compact quarry-stone industrial structure: a squat dark stone block with
  // a short chimney and a restrained warm emissive mouth, reading as
  // industrial stone rather than a wood campfire (nature.campfire).
  const root = new THREE.Group();
  const stone = material(0x5c554c, 0.92);
  const darkStone = material(0x433f38, 0.94);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 0.85), stone);
  body.position.y = 0.31;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 0.95), darkStone);
  base.position.y = 0.06;
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 0.55, 8), stone);
  chimney.position.set(0.26, 0.85, -0.18);
  const chimneyCap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 8), darkStone);
  chimneyCap.position.set(0.26, 1.14, -0.18);
  const mouthFrame = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 12), darkStone);
  mouthFrame.position.set(0, 0.3, 0.44);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 12),
    new THREE.MeshBasicMaterial({ color: 0xff6a2b }),
  );
  glow.position.set(0, 0.3, 0.45);
  const emberLight = new THREE.PointLight(0xff7a35, 1.1, 2.4, 2);
  emberLight.position.set(0, 0.3, 0.5);
  root.add(base, body, chimney, chimneyCap, mouthFrame, glow, emberLight);
  return root;
}

function proceduralAnvil(): THREE.Group {
  // Worked iron on a timber stump: distinct "worked metal" material (higher
  // metalness/lower roughness) sitting on the same warm wood tone used for
  // tool handles, so it reads as craft furniture rather than raw quarry rock.
  const root = new THREE.Group();
  const wood = material(0x70452c, 0.88);
  const iron = new THREE.MeshStandardMaterial({ color: 0x3d3f42, roughness: 0.4, metalness: 0.6 });
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.29, 0.42, 10), wood);
  stump.position.y = 0.21;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.22), iron);
  base.position.y = 0.47;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.26), iron);
  body.position.y = 0.56;
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 8), iron);
  horn.rotation.z = Math.PI / 2;
  horn.position.set(0.38, 0.56, 0);
  root.add(stump, base, body, horn);
  return root;
}

function proceduralBoneguardVest(): THREE.Group {
  // Original layered chest/shoulder armour, distinct from the enemy skeleton
  // model previously (incorrectly) referenced by this item's worldAssetId.
  // Sits on the character's chest bone via GameWorld's body-slot attachment,
  // so its own local origin is centred on the torso.
  const root = new THREE.Group();
  const bone = material(0xd9d0bd, 0.75);
  const strap = material(0x4a3527, 0.85);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.24), bone);
  chest.position.set(0, 0, 0.02);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 6, 12), bone);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.19, 0);
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.16, 6), bone);
    pauldron.rotation.z = side * 0.55;
    pauldron.position.set(side * 0.27, 0.14, 0);
    root.add(pauldron);
  }
  const strapMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.26), strap);
  strapMesh.rotation.z = 0.5;
  strapMesh.position.set(0.02, 0, 0);
  root.add(chest, collar, strapMesh);
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = true;
  });
  return root;
}

function proceduralMaraShawl(): THREE.Group {
  // Original hooded shawl silhouette that marks Mara Threadkeeper as a
  // distinct, recognisable named NPC rather than a recolour of the shared
  // adventurer rig used for the player and every generic villager. Attached
  // to the chest bone by GameWorld; local origin sits at the shoulders.
  const root = new THREE.Group();
  const cloth = material(0x6f4a2c, 0.9);
  const trim = material(0xdcb877, 0.7);
  const cape = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.62, 8, 1, true), cloth);
  cape.position.set(0, -0.18, -0.04);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.65), cloth);
  hood.position.set(0, 0.34, -0.05);
  hood.rotation.x = Math.PI;
  const collarTrim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 5, 14), trim);
  collarTrim.rotation.x = Math.PI / 2;
  collarTrim.position.set(0, 0.18, 0);
  root.add(cape, hood, collarTrim);
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      (child.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    }
  });
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
  if (id.includes("facility-smelter")) return proceduralSmelter();
  if (id.includes("facility-anvil")) return proceduralAnvil();
  if (id.includes("armor-boneguard")) return proceduralBoneguardVest();
  if (id.includes("npc-mara-shawl")) return proceduralMaraShawl();
  return proceduralTool(id);
}

function applyTint(object: THREE.Object3D, tint: string): void {
  const tintColor = new THREE.Color(tint);
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const material = child.material as THREE.MeshStandardMaterial;
    if (!material || !("color" in material)) return;
    const next = material.clone();
    next.color.multiply(tintColor);
    child.material = next;
  });
}

async function buildCottage(tint?: string | null): Promise<THREE.Group> {
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
  // Fix: the composite cottage assembles each wall/roof/door module through
  // instantiateAsset(assetId) with no tint argument, and this function never
  // forwarded its own `tint` parameter to (or applied it after) that
  // assembly. That silently dropped the warm tint variants zones.json
  // authors for cottage_east and cottage_south (they rendered identically to
  // cottage_west). Apply it here, after assembly, the same way the plain
  // GLTF branch below applies a runtime tint.
  if (tint) applyTint(root, tint);
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
    return { object: await buildCottage(tint), animations: [] };
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

export function addInteractionHitbox(object: THREE.Object3D, kind: string): void {
  if (kind === "ground_item") {
    const hitArea = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 16),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    hitArea.position.y = 0.3;
    hitArea.userData.interactionHitArea = true;
    object.add(hitArea);
  }
}
