import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CONTENT } from "@everloom/content";
import type { GridPosition, ZoneInteractable } from "@everloom/core";
import { blockedSet, findPath, pathToTarget, surfaceAt } from "../game/pathfinding";
import { useGameStore } from "../game/store";
import { instantiateAsset } from "./assets";

const zone = CONTENT.zones.meadowrest!;
const world = (p: GridPosition) => new THREE.Vector3((p.x - zone.width / 2) * zone.cellSize, 0, (p.z - zone.depth / 2) * zone.cellSize);
const grid = (p: THREE.Vector3): GridPosition => ({
  x: Math.max(0, Math.min(zone.width - 1, Math.round(p.x / zone.cellSize + zone.width / 2))),
  z: Math.max(0, Math.min(zone.depth - 1, Math.round(p.z / zone.cellSize + zone.depth / 2))),
});

const COLORS: Record<string, number> = {
  grass: 0x668e54, meadow: 0x7ca463, path: 0xb69a6b, stone: 0x78766e, water: 0x4d91a0, soil: 0x836a4b,
};

function buildTerrain(): THREE.Group {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(zone.cellSize + 0.025, 0.12, zone.cellSize + 0.025);
  const grouped = new Map<string, THREE.Matrix4[]>();
  for (let x = 0; x < zone.width; x += 1) {
    for (let z = 0; z < zone.depth; z += 1) {
      const surface = surfaceAt(zone, x, z);
      const position = world({ x, z });
      position.y = surface === "water" ? -0.1 : -0.03 + Math.sin(x * 1.7 + z * 0.8) * 0.015;
      const matrices = grouped.get(surface) ?? [];
      matrices.push(new THREE.Matrix4().setPosition(position));
      grouped.set(surface, matrices);
    }
  }
  for (const [surface, matrices] of grouped) {
    const tiles = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({
      color: COLORS[surface], roughness: 0.94, transparent: surface === "water", opacity: surface === "water" ? 0.78 : 1,
    }), matrices.length);
    matrices.forEach((matrix, index) => tiles.setMatrixAt(index, matrix));
    tiles.instanceMatrix.needsUpdate = true;
    tiles.receiveShadow = true;
    tiles.userData.ground = true;
    root.add(tiles);
  }
  return root;
}

function targetAvailable(target: ZoneInteractable, state: ReturnType<typeof useGameStore.getState>["save"]): boolean {
  if (!state) return false;
  if (target.kind === "ground_item") return !state.worldFlags[`picked:${target.id}`];
  if (target.kind === "resource") return (state.worldResources[target.id]?.depletedUntilMs ?? 0) <= state.simulationTimeMs;
  if (target.kind === "enemy") return (state.worldEnemies[target.id]?.defeatedUntilMs ?? 0) <= state.simulationTimeMs;
  return true;
}

export function GameWorld() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa9ced0);
    scene.fog = new THREE.Fog(0xa9ced0, 38, 82);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 150);
    camera.position.set(17, 21, 22);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    element.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xdaf4ef, 0x58604b, 2.2));
    const sun = new THREE.DirectionalLight(0xffefcf, 2.8);
    sun.position.set(-20, 30, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun, buildTerrain());

    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.43, 24),
      new THREE.MeshBasicMaterial({ color: 0xf4dc8c, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.visible = false;
    scene.add(marker);

    const targets = new Map<string, THREE.Object3D>();
    const mixers: THREE.AnimationMixer[] = [];
    const playerRoot = new THREE.Group();
    scene.add(playerRoot);
    let playerMixer: THREE.AnimationMixer | null = null;
    let currentClip = "";
    let route: GridPosition[] = [];
    let afterArrival: (() => void) | null = null;
    let disposed = false;

    const play = (name: string) => {
      if (!playerMixer || name === currentClip) return;
      const options = (playerMixer as THREE.AnimationMixer & { _root?: THREE.Object3D })._root?.userData.animations as THREE.AnimationClip[] | undefined;
      const clip = options?.find((entry) => entry.name === name) ?? options?.find((entry) => entry.name.toLowerCase().includes(name.toLowerCase()));
      if (!clip) return;
      playerMixer.stopAllAction();
      playerMixer.clipAction(clip).reset().fadeIn(0.12).play();
      currentClip = name;
    };

    void instantiateAsset("player.adventurer").then(({ object, animations }) => {
      if (disposed) return;
      object.userData.animations = animations;
      playerRoot.userData.animations = animations;
      playerRoot.add(object);
      playerMixer = new THREE.AnimationMixer(object);
      (playerMixer as THREE.AnimationMixer & { _root?: THREE.Object3D })._root = playerRoot;
      mixers.push(playerMixer);
      play("Idle");
    });

    const addAsset = async (id: string, assetId: string, x: number, z: number, rotation: number, scale: number, elevation: number, tint?: string | null) => {
      try {
        const { object, animations } = await instantiateAsset(assetId, tint);
        if (disposed) return;
        object.position.copy(world({ x, z }));
        object.position.y += elevation;
        object.rotation.y = rotation;
        object.scale.multiplyScalar(scale);
        object.userData.targetId = id;
        object.traverse((child) => { child.userData.targetId = id; });
        scene.add(object);
        targets.set(id, object);
        if (animations.length) {
          const mixer = new THREE.AnimationMixer(object);
          const idle = animations.find((clip) => clip.name === "Idle") ?? animations[0];
          if (idle) mixer.clipAction(idle).play();
          mixers.push(mixer);
        }
      } catch (error) {
        console.error(`Asset ${assetId} failed`, error);
      }
    };
    for (const item of zone.scenery) void addAsset(item.id, item.assetId, item.x, item.z, item.rotation, item.scale, item.elevation, item.tint);
    for (const item of zone.interactables) void addAsset(item.id, item.assetId, item.x, item.z, 0, 1, item.kind === "ground_item" ? 0.14 : 0);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const setRoute = (next: GridPosition[], callback: (() => void) | null) => {
      route = next;
      afterArrival = callback;
      if (route.length > 0) {
        marker.position.copy(world(route.at(-1)!));
        marker.position.y = 0.08;
        marker.visible = true;
      } else {
        afterArrival = null;
        callback?.();
      }
    };
    const actOn = (target: ZoneInteractable) => {
      const store = useGameStore.getState();
      store.setSelectedTarget(target.id);
      if (target.kind === "ground_item") store.pickup(target.id);
      else if (target.kind === "npc" || target.kind === "landmark") store.interact(target.id);
      else store.startTargetActivity(target.id);
    };
    const onPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(scene.children, true).find((entry) => entry.object.userData.targetId || entry.object.userData.ground);
      if (!hit) return;
      const targetId = hit.object.userData.targetId as string | undefined;
      const save = useGameStore.getState().save;
      if (!save) return;
      useGameStore.getState().cancelCurrentActivity();
      if (targetId) {
        const target = zone.interactables.find((entry) => entry.id === targetId);
        if (target && targetAvailable(target, save)) setRoute(pathToTarget(zone, save.position, target), () => actOn(target));
      } else {
        const destination = grid(hit.point);
        setRoute(findPath(zone, save.position, [destination], blockedSet(zone)), null);
        useGameStore.getState().setSelectedTarget(null);
      }
    };
    renderer.domElement.addEventListener("pointerup", onPointer);
    if (import.meta.env.DEV) {
      (window as Window & { __EVERLOOM_TEST__?: unknown }).__EVERLOOM_TEST__ = {
        targetPosition(targetId: string) {
          const target = zone.interactables.find((entry) => entry.id === targetId);
          if (!target) return null;
          const projected = world(target).project(camera);
          const rect = renderer.domElement.getBoundingClientRect();
          return { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2 };
        },
        snapshot: () => useGameStore.getState().save,
        navigation: () => ({ route: [...route], visual: grid(playerRoot.position), hidden: document.hidden }),
        activateTarget(targetId: string) {
          const target = zone.interactables.find((entry) => entry.id === targetId);
          const save = useGameStore.getState().save;
          if (!target || !save || !targetAvailable(target, save)) return false;
          useGameStore.getState().cancelCurrentActivity();
          setRoute(pathToTarget(zone, save.position, target), () => actOn(target));
          return true;
        },
      };
    }

    let last = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      if (disposed) return;
      requestAnimationFrame(animate);
      const elapsedMs = Math.max(0, now - last);
      const dt = Math.min(0.05, elapsedMs / 1000);
      last = now;
      if (!document.hidden) useGameStore.getState().tick(elapsedMs);
      const save = useGameStore.getState().save;
      if (save) {
        const desired = world(save.position);
        if (route.length && !document.hidden) {
          const next = world(route[0]!);
          const delta = next.clone().sub(playerRoot.position);
          delta.y = 0;
          const remaining = delta.length();
          if (remaining < 0.08) {
            const arrived = route.shift()!;
            useGameStore.getState().setPosition(arrived);
            if (!route.length) {
              marker.visible = false;
              const callback = afterArrival;
              afterArrival = null;
              callback?.();
            }
          } else {
            playerRoot.position.add(delta.normalize().multiplyScalar(Math.min(5.2 * dt, remaining)));
            playerRoot.rotation.y = Math.atan2(delta.x, delta.z);
            play("Walking_A");
          }
        } else {
          playerRoot.position.lerp(desired, 0.25);
          play(save.currentActivity?.type === "combat" ? "1H_Melee_Attack_Chop" : save.currentActivity ? "Interact" : "Idle");
        }
        for (const target of zone.interactables) {
          const object = targets.get(target.id);
          if (object) object.visible = targetAvailable(target, save);
        }
        const focus = playerRoot.position.clone();
        camera.position.lerp(focus.clone().add(new THREE.Vector3(17, 21, 22)), 0.035);
        camera.lookAt(focus);
      }
      for (const mixer of mixers) mixer.update(dt);
      marker.material.opacity = 0.55 + Math.sin(now / 180) * 0.25;
      renderer.render(scene, camera);
      frame += 1;
      if (frame % 30 === 0) element.dataset.ready = "true";
    };
    requestAnimationFrame(animate);

    const resize = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      const quality = useGameStore.getState().save?.settings.quality ?? "standard";
      renderer.setPixelRatio(Math.min(devicePixelRatio, quality === "high" ? 2 : quality === "low" ? 1 : 1.5));
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();

    return () => {
      disposed = true;
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerup", onPointer);
      renderer.dispose();
      delete (window as Window & { __EVERLOOM_TEST__?: unknown }).__EVERLOOM_TEST__;
      element.replaceChildren();
    };
  }, []);

  return <div className="world" ref={host} data-testid="game-world" />;
}
