import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CONTENT } from "@everloom/content";
import { type GridPosition, type ZoneInteractable } from "@everloom/core";
import {
  OBJECTIVE_ROUTE_EVENT,
  objectiveGuidanceTarget,
  type ObjectiveRouteDetail,
} from "../game/objectiveGuidance";
import { blockedSet, findPath, pathToTarget } from "../game/pathfinding";
import { useGameStore } from "../game/store";
import { instantiateAsset } from "./assets";
import { buildEnvironment, terrainHeight, updateEnvironment } from "./environment";

const zone = CONTENT.zones.meadowrest!;
const world = (p: GridPosition) => new THREE.Vector3(
  (p.x - zone.width / 2) * zone.cellSize,
  terrainHeight(zone, p.x, p.z),
  (p.z - zone.depth / 2) * zone.cellSize,
);
const grid = (p: THREE.Vector3): GridPosition => ({
  x: Math.max(0, Math.min(zone.width - 1, Math.round(p.x / zone.cellSize + zone.width / 2))),
  z: Math.max(0, Math.min(zone.depth - 1, Math.round(p.z / zone.cellSize + zone.depth / 2))),
});

function fallbackFigure(color: number): THREE.Group {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.86 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.65, 4, 8), material);
  body.position.y = 0.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), material);
  head.position.y = 1.38;
  body.castShadow = true;
  head.castShadow = true;
  root.add(body, head);
  return root;
}

function fallbackTarget(): THREE.Group {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xb69a62, roughness: 0.9 });
  const marker = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), material);
  marker.position.y = 0.45;
  marker.castShadow = true;
  root.add(marker);
  return root;
}

function targetAvailable(target: ZoneInteractable, state: ReturnType<typeof useGameStore.getState>["save"]): boolean {
  if (!state) return false;
  if (target.requiredFlag && !state.worldFlags[target.requiredFlag]) return false;
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
    scene.background = new THREE.Color(0x91b9b7);
    scene.fog = new THREE.Fog(0x91b9b7, 45, 94);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 160);
    camera.position.set(16, 19, 20);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch (error) {
      console.error("WebGL initialization failed", error);
      element.dataset.error = "webgl";
      element.classList.add("world-error");
      element.setAttribute("role", "alert");
      element.textContent = "Meadowrest could not open its 3D view. Reload the game or enable hardware acceleration.";
      return () => element.replaceChildren();
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    element.appendChild(renderer.domElement);
    const contextNotice = document.createElement("section");
    contextNotice.className = "world-context-error glass";
    contextNotice.hidden = true;
    contextNotice.setAttribute("role", "alert");
    const contextTitle = document.createElement("strong");
    contextTitle.textContent = "The 3D view needs to restart.";
    const contextCopy = document.createElement("span");
    contextCopy.textContent = "Your progress has been checkpointed.";
    const contextReload = document.createElement("button");
    contextReload.className = "primary";
    contextReload.textContent = "Reload world";
    const onContextReload = () => location.reload();
    contextReload.addEventListener("click", onContextReload);
    contextNotice.append(contextTitle, contextCopy, contextReload);
    element.appendChild(contextNotice);
    const onContextLost = (event: Event) => {
      event.preventDefault();
      element.dataset.error = "context-lost";
      contextNotice.hidden = false;
      void useGameStore.getState().saveNow("webgl-context-lost", true);
    };
    const onContextRestored = () => location.reload();
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);
    const metrics = document.createElement("output");
    metrics.className = "world-metrics";
    if (import.meta.env.DEV && new URLSearchParams(location.search).has("debug")) element.appendChild(metrics);
    scene.add(new THREE.HemisphereLight(0xdff5ee, 0x435047, 2.05));
    const sun = new THREE.DirectionalLight(0xffe5b1, 3.1);
    sun.position.set(-24, 34, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -34;
    sun.shadow.camera.right = 34;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    const environment = buildEnvironment(zone, useGameStore.getState().save?.settings.quality ?? "standard");
    scene.add(sun, environment.root);

    const fireLight = new THREE.PointLight(0xff9a45, 2.2, 8, 2);
    fireLight.position.copy(world({ x: 22, z: 19 })).add(new THREE.Vector3(0, 1.1, 0));
    scene.add(fireLight);

    const verdantLoomstoneTarget = zone.interactables.find((entry) => entry.id === "verdant_loomstone");
    const verdantGlow = new THREE.PointLight(0x8fe3a8, 0, 7.5, 2);
    if (verdantLoomstoneTarget) verdantGlow.position.copy(world(verdantLoomstoneTarget)).add(new THREE.Vector3(0, 1.6, 0));
    scene.add(verdantGlow);
    const verdantAuraMaterial = new THREE.MeshBasicMaterial({
      color: 0x78e2a3,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const verdantAura = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.42, 48), verdantAuraMaterial);
    verdantAura.rotation.x = -Math.PI / 2;
    const verdantRuneMaterial = new THREE.MeshBasicMaterial({
      color: 0xc4f6cd,
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const verdantRune = new THREE.Mesh(new THREE.RingGeometry(1.58, 1.67, 6), verdantRuneMaterial);
    verdantRune.rotation.x = -Math.PI / 2;
    if (verdantLoomstoneTarget) {
      const groveFloor = world(verdantLoomstoneTarget);
      verdantAura.position.copy(groveFloor).add(new THREE.Vector3(0, 0.08, 0));
      verdantRune.position.copy(groveFloor).add(new THREE.Vector3(0, 0.09, 0));
    }
    scene.add(verdantAura, verdantRune);
    const debugGrid = new THREE.GridHelper(zone.width * zone.cellSize, zone.width, 0xe8c979, 0x4b584d);
    debugGrid.position.y = 0.16;
    debugGrid.visible = false;
    scene.add(debugGrid);

    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.43, 24),
      new THREE.MeshBasicMaterial({ color: 0xf4dc8c, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.visible = false;
    scene.add(marker);
    const targetHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 0.72, 32),
      new THREE.MeshBasicMaterial({ color: 0xffdc82, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
    );
    targetHalo.rotation.x = -Math.PI / 2;
    targetHalo.visible = false;
    scene.add(targetHalo);

    // The objective beacon is a persistent, always-visible marker over
    // whatever the player's CURRENT quest step's physical target is — unlike
    // targetHalo above (which only appears once the player has already
    // clicked something), this needs no prior interaction. It exists so a
    // new player can never lose track of a required tool or destination
    // (e.g. the starter pickaxe) purely because it blends into scenery.
    // Additive blending + a real point light (the same technique the
    // smelter's ember glow already uses) so this reads clearly even against
    // the bright daylight meadow/quarry palette, not just in shadow.
    const objectiveBeaconGroup = new THREE.Group();
    const objectiveBeaconBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.2, 2.4, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff0a8,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    objectiveBeaconBeam.position.y = 1.2;
    const objectiveBeaconRing = new THREE.Mesh(
      new THREE.RingGeometry(0.36, 0.5, 28),
      new THREE.MeshBasicMaterial({
        color: 0xfff6cf,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    objectiveBeaconRing.rotation.x = -Math.PI / 2;
    objectiveBeaconRing.position.y = 0.06;
    const objectiveBeaconLight = new THREE.PointLight(0xffd76a, 2.4, 5, 2);
    objectiveBeaconLight.position.y = 1.1;
    // Floating diamond marker well above head height: the ground ring/beam
    // can end up fully behind the player's own model once they've walked
    // right up to a ground-item objective (interactionRadius 0 means the
    // route ends exactly on that tile) — this stays visible above the
    // character regardless of standing distance, matching the common
    // above-target marker convention from other RPGs/MMOs.
    // Sized to read clearly at this game's fairly distant isometric follow
    // camera (a small marker disappears among trees/rocks at that zoom) —
    // tuned by actually viewing captured screenshots, not guessed.
    const objectiveBeaconMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff6cf, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    objectiveBeaconMarker.position.y = 2.6;
    objectiveBeaconGroup.add(objectiveBeaconBeam, objectiveBeaconRing, objectiveBeaconLight, objectiveBeaconMarker);
    objectiveBeaconGroup.visible = false;
    scene.add(objectiveBeaconGroup);
    const objectiveRouteMaterial = new THREE.PointsMaterial({
      color: 0xffdf79,
      size: 0.28,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const objectiveRouteTrail = new THREE.Points(new THREE.BufferGeometry(), objectiveRouteMaterial);
    objectiveRouteTrail.visible = false;
    scene.add(objectiveRouteTrail);
    let objectiveRouteTargetId: string | null = null;
    const effectPositions = new Float32Array(36);
    const activityEffect = new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(effectPositions, 3)),
      new THREE.PointsMaterial({ color: 0xe9bd72, size: 0.12, transparent: true, opacity: 0.82, depthWrite: false }),
    );
    activityEffect.visible = false;
    scene.add(activityEffect);

    const targets = new Map<string, THREE.Object3D>();
    const mixers: THREE.AnimationMixer[] = [];
    const playerRoot = new THREE.Group();
    scene.add(playerRoot);
    let playerMixer: THREE.AnimationMixer | null = null;
    let currentClip = "";
    let oneShotUntil = 0;
    let route: GridPosition[] = [];
    let afterArrival: (() => void) | null = null;
    let disposed = false;
    const criticalAssetJobs: Promise<unknown>[] = [];
    const sceneryAssetJobs: Promise<unknown>[] = [];

    const play = (name: string, once = false) => {
      if (!playerMixer || name === currentClip) return;
      const options = (playerMixer as THREE.AnimationMixer & { _root?: THREE.Object3D })._root?.userData.animations as THREE.AnimationClip[] | undefined;
      const clip = options?.find((entry) => entry.name === name) ?? options?.find((entry) => entry.name.toLowerCase().includes(name.toLowerCase()));
      if (!clip) return;
      playerMixer.stopAllAction();
      const action = playerMixer.clipAction(clip).reset().fadeIn(0.12);
      if (once) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        oneShotUntil = performance.now() + Math.min(900, clip.duration * 1000);
      }
      action.play();
      currentClip = name;
    };

    criticalAssetJobs.push(instantiateAsset("player.adventurer")
      .catch((error) => {
        console.warn("Player model failed; using the safe fallback figure.", error);
        element.dataset.assetWarning = "player";
        return { object: fallbackFigure(0x577b68), animations: [] };
      })
      .then(({ object, animations }) => {
        if (disposed) return;
        object.userData.animations = animations;
        playerRoot.userData.animations = animations;
        playerRoot.add(object);
        if (animations.length) {
          playerMixer = new THREE.AnimationMixer(object);
          (playerMixer as THREE.AnimationMixer & { _root?: THREE.Object3D })._root = playerRoot;
          mixers.push(playerMixer);
          play("Idle");
        }
      }));

    const addAsset = async (
      id: string,
      assetId: string,
      x: number,
      z: number,
      rotation: number,
      scale: number,
      elevation: number,
      tint?: string | null,
      interactive = false,
    ) => {
      let object: THREE.Object3D;
      let animations: THREE.AnimationClip[];
      try {
        ({ object, animations } = await instantiateAsset(assetId, tint));
      } catch (error) {
        console.warn(`Asset ${assetId} failed`, error);
        if (!interactive) return;
        element.dataset.assetWarning = "targets";
        object = fallbackTarget();
        animations = [];
      }
      if (disposed) return;
      object.position.copy(world({ x, z }));
      if (assetId === "custom.fishing-ripples") object.position.y = -0.03;
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
    };
    for (const item of zone.scenery) sceneryAssetJobs.push(addAsset(item.id, item.assetId, item.x, item.z, item.rotation, item.scale, item.elevation, item.tint));
    for (const item of zone.interactables) {
      criticalAssetJobs.push(addAsset(item.id, item.assetId, item.x, item.z, 0, 1, item.kind === "ground_item" ? 0.14 : 0, item.tint ?? null, true));
    }
    void Promise.allSettled(criticalAssetJobs).then(() => {
      if (!disposed) element.dataset.ready = "true";
    });
    void Promise.allSettled([...criticalAssetJobs, ...sceneryAssetJobs]).then(() => {
      if (!disposed) element.dataset.assetsSettled = "true";
    });

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
      const direction = world(target).sub(playerRoot.position);
      playerRoot.rotation.y = Math.atan2(direction.x, direction.z);
      store.setSelectedTarget(target.id);
      if (target.kind === "ground_item") {
        play("PickUp", true);
        store.pickup(target.id);
      } else if (target.kind === "npc" || target.kind === "landmark") {
        play("Interact", true);
        store.interact(target.id);
      }
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
    const showObjectiveRoute = (event: Event) => {
      const requestedId = (event as CustomEvent<ObjectiveRouteDetail>).detail?.targetId;
      const save = useGameStore.getState().save;
      const target = objectiveGuidanceTarget(save);
      if (!save || !requestedId || target?.id !== requestedId || !targetAvailable(target, save)) return;

      const routePoints = pathToTarget(zone, save.position, target);
      const positions = routePoints.map((position) => {
        const point = world(position);
        point.y += 0.14;
        return point;
      });
      const targetPoint = world(target);
      targetPoint.y += 0.14;
      positions.push(targetPoint);
      objectiveRouteTrail.geometry.dispose();
      objectiveRouteTrail.geometry = new THREE.BufferGeometry().setFromPoints(positions);
      const hasRoute = positions.length > 1;
      objectiveRouteTargetId = hasRoute ? target.id : null;
      objectiveRouteTrail.visible = hasRoute;
    };
    window.addEventListener(OBJECTIVE_ROUTE_EVENT, showObjectiveRoute);
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
        objectiveBeacon: () => {
          const save = useGameStore.getState().save;
          const targetId = objectiveGuidanceTarget(save)?.id ?? null;
          return {
            visible: objectiveBeaconGroup.visible,
            targetId,
          };
        },
        objectiveRoute: () => ({
          visible: objectiveRouteTrail.visible,
          targetId: objectiveRouteTargetId,
          points: objectiveRouteTrail.geometry.getAttribute("position")?.count ?? 0,
        }),
        equip: (itemId: string) => useGameStore.getState().equip(itemId),
        simulate: (elapsedMs: number) => useGameStore.getState().debugSimulateOffline(elapsedMs),
        stop: () => useGameStore.getState().cancelCurrentActivity(),
        dismissReport: () => useGameStore.getState().dismissOfflineReport(),
        save: () => useGameStore.getState().saveNow("e2e-checkpoint", true),
        resume: () => useGameStore.getState().resumeFromBackground(),
        attuneAllSkills: () => useGameStore.getState().debugAttuneSkills(),
        completeQuest: (questId: string) => useGameStore.getState().debugCompleteQuest(questId),
        giveItem: (itemId: string, quantity: number) => useGameStore.getState().debugAddItem(itemId, quantity),
        damage: () => useGameStore.getState().debugDamagePlayer(),
        consume: (itemId: string) => useGameStore.getState().consumeFood(itemId),
        activateTarget(targetId: string) {
          const target = zone.interactables.find((entry) => entry.id === targetId);
          const save = useGameStore.getState().save;
          if (!target || !save || !targetAvailable(target, save)) return false;
          useGameStore.getState().cancelCurrentActivity();
          setRoute(pathToTarget(zone, save.position, target), () => actOn(target));
          return true;
        },
        // Navigation-only counterpart to activateTarget: walks the player into
        // interaction range using the same real pathToTarget route, but never
        // calls actOn and never starts/changes any activity. activateTarget
        // both routes AND auto-acts on arrival, which is correct for normal
        // click-to-play but creates a race in tests that need to walk to a
        // target and then start its activity as two distinct, separately
        // timed steps (e.g. confirming a "Stop" button appears) — calling
        // activateTarget twice on the same facility can let the first call's
        // auto-started activity already finish and stop (inputs_exhausted)
        // before the second call ever runs, leaving the test waiting for a
        // Stop button that will never appear.
        navigateToTarget(targetId: string) {
          const target = zone.interactables.find((entry) => entry.id === targetId);
          const save = useGameStore.getState().save;
          if (!target || !save || !targetAvailable(target, save)) return false;
          setRoute(pathToTarget(zone, save.position, target), null);
          return true;
        },
      };
    }

    let last = performance.now();
    let metricFrame = 0;
    let metricStart = last;
    let activeQuality = useGameStore.getState().save?.settings.quality ?? "standard";
    const animate = (now: number) => {
      if (disposed) return;
      requestAnimationFrame(animate);
      const elapsedMs = Math.max(0, now - last);
      const animationDt = Math.min(0.05, elapsedMs / 1000);
      // Movement must follow wall-clock time even when rendering is slow.
      // Keep a separate, larger safety cap so a stalled/backgrounded frame
      // cannot teleport the player, while 4-20 FPS devices do not experience
      // severe time dilation from the conservative animation delta.
      const movementDt = Math.min(0.25, elapsedMs / 1000);
      last = now;
      if (!document.hidden) useGameStore.getState().tick(elapsedMs);
      const save = useGameStore.getState().save;
      const nextQuality = save?.settings.quality ?? "standard";
      if (nextQuality !== activeQuality) {
        activeQuality = nextQuality;
        renderer.shadowMap.enabled = activeQuality !== "low";
        sun.castShadow = activeQuality !== "low";
        resize();
      }
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
            playerRoot.position.add(delta.normalize().multiplyScalar(Math.min(5.2 * movementDt, remaining)));
            playerRoot.rotation.y = Math.atan2(delta.x, delta.z);
            play("Walking_A");
          }
        } else {
          playerRoot.position.lerp(desired, 0.25);
          if (now >= oneShotUntil) {
            if (save.player.hp <= 0) {
              play("Death_A");
            } else if (save.currentActivity?.type === "combat") {
              play("1H_Melee_Attack_Chop");
            } else if (save.currentActivity?.type === "gathering") {
              const skill = CONTENT.resources[save.currentActivity.resourceId]?.skill;
              play(skill === "fishing" ? "1H_Ranged_Aiming" : "1H_Melee_Attack_Chop");
            } else {
              play(save.currentActivity ? "Interact" : "Idle");
            }
          }
        }
        for (const target of zone.interactables) {
          const object = targets.get(target.id);
          if (object) object.visible = targetAvailable(target, save);
        }
        const focus = playerRoot.position.clone();
        camera.position.lerp(focus.clone().add(new THREE.Vector3(17, 21, 22)), 0.035);
        camera.lookAt(focus);
      }
      for (const mixer of mixers) mixer.update(animationDt);
      marker.material.opacity = 0.55 + Math.sin(now / 180) * 0.25;
      const verdantAwake = Boolean(save?.worldFlags.verdant_loomstone_awakened);
      const verdantPulse = Math.sin(now / 520);
      verdantGlow.intensity = verdantAwake ? 2.55 + verdantPulse * 0.4 : 0.5;
      verdantAuraMaterial.opacity = verdantAwake ? 0.46 + verdantPulse * 0.08 : 0.18;
      verdantRuneMaterial.opacity = verdantAwake ? 0.34 + verdantPulse * 0.06 : 0.13;
      verdantAura.scale.setScalar(verdantAwake ? 1.08 + verdantPulse * 0.035 : 1);
      verdantRune.rotation.z += animationDt * (verdantAwake ? 0.2 : 0.07);
      updateEnvironment(environment, animationDt);
      debugGrid.visible = import.meta.env.DEV && useGameStore.getState().debug.grid;
      const selectedId = useGameStore.getState().selectedTargetId;
      const selected = selectedId ? zone.interactables.find((target) => target.id === selectedId) : undefined;
      if (selected && save && targetAvailable(selected, save)) {
        targetHalo.position.copy(world(selected));
        targetHalo.position.y += 0.08;
        targetHalo.scale.setScalar(1 + Math.sin(now / 260) * 0.08);
        targetHalo.visible = true;
      } else {
        targetHalo.visible = false;
      }
      // Always-on guidance: highlight the CURRENT quest step's physical
      // target, independent of anything the player has clicked. A quest may
      // keep targetId null when any matching resource counts while supplying
      // a representative guidanceTargetId solely for navigation. This also
      // bridges semantic enemy IDs (used by quest events) to their physical
      // world interactable IDs without changing quest-completion logic.
      const objectiveTarget = objectiveGuidanceTarget(save);
      if (objectiveTarget && save && targetAvailable(objectiveTarget, save)) {
        objectiveBeaconGroup.position.copy(world(objectiveTarget));
        objectiveBeaconGroup.position.y += Math.sin(now / 420) * 0.12;
        objectiveBeaconRing.scale.setScalar(1 + Math.sin(now / 280) * 0.12);
        objectiveBeaconMarker.rotation.y += animationDt * 1.6;
        objectiveBeaconMarker.rotation.x += animationDt * 0.9;
        objectiveBeaconGroup.visible = true;
      } else {
        objectiveBeaconGroup.visible = false;
      }
      if (objectiveRouteTrail.visible && objectiveRouteTargetId !== objectiveTarget?.id) {
        objectiveRouteTrail.visible = false;
        objectiveRouteTargetId = null;
      }
      objectiveRouteMaterial.opacity = 0.72 + Math.sin(now / 230) * 0.2;
      const activity = save?.currentActivity;
      const activityTarget = activity
        ? zone.interactables.find((target) => target.id === activity.targetId)
        : undefined;
      if (activityTarget && activity) {
        activityEffect.position.copy(world(activityTarget));
        activityEffect.position.y += 0.2;
        const points = activityEffect.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let index = 0; index < 12; index += 1) {
          const phase = (now * 0.00055 + index * 0.173) % 1;
          points.setXYZ(index, Math.sin(index * 2.41) * phase * 0.58, phase * 1.25, Math.cos(index * 1.73) * phase * 0.58);
        }
        points.needsUpdate = true;
        const effectMaterial = activityEffect.material as THREE.PointsMaterial;
        const gatheringSkill = activity.type === "gathering"
          ? CONTENT.resources[activity.resourceId]?.skill
          : undefined;
        const productionSkill = activity.type === "production"
          ? CONTENT.recipes[activity.recipeId]?.skill
          : undefined;
        effectMaterial.color.set(activity.type === "combat" ? 0xef795f : productionSkill === "cooking" ? 0xffa34e : productionSkill === "smithing" ? 0xf3c66e : gatheringSkill === "fishing" ? 0x7fdce5 : 0xe9bd72);
        activityEffect.visible = true;
      } else {
        activityEffect.visible = false;
      }
      renderer.render(scene, camera);
      metricFrame += 1;
      if (metrics.isConnected && now - metricStart >= 1000) {
        const position = save?.position;
        metrics.textContent = `${Math.round(metricFrame * 1000 / (now - metricStart))} FPS · ${renderer.info.render.calls} draws · ${renderer.info.render.triangles.toLocaleString()} tris${position ? ` · ${position.x},${position.z}` : ""}`;
        metricFrame = 0;
        metricStart = now;
      }
    };
    requestAnimationFrame(animate);

    const resize = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      renderer.setPixelRatio(Math.min(devicePixelRatio, activeQuality === "high" ? 2 : activeQuality === "low" ? 1 : 1.5));
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
      window.removeEventListener(OBJECTIVE_ROUTE_EVENT, showObjectiveRoute);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      contextReload.removeEventListener("click", onContextReload);
      objectiveRouteTrail.geometry.dispose();
      objectiveRouteMaterial.dispose();
      renderer.dispose();
      delete (window as Window & { __EVERLOOM_TEST__?: unknown }).__EVERLOOM_TEST__;
      element.replaceChildren();
    };
  }, []);

  return <div className="world" ref={host} data-testid="game-world" />;
}
