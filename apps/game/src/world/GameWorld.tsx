import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CONTENT } from "@everloom/content";
import { type GridPosition, type ZoneInteractable } from "@everloom/core";
import {
  OBJECTIVE_ROUTE_EVENT,
  objectiveGuidanceTarget,
  type ObjectiveRouteDetail,
} from "../game/objectiveGuidance";
import { didCycleComplete } from "../game/actionPresentation";
import { audio, type AudioCue } from "../game/audio";
import { defaultVerbFor } from "../game/interactionCommands";
import { blockedSet, findPathResult, pathToTargetResult } from "../game/pathfinding";
import { PlayerCommandController } from "../game/playerCommand";
import { sanitiseTestDelayOverride } from "../game/testDelayOverride";
import { useGameStore } from "../game/store";
import { addInteractionHitbox, instantiateAsset } from "./assets";
import {
  APPEARANCE_ACCESSORY_BONES,
  buildAppearanceDecorations,
  type AccessorySlot,
} from "./characterPresentation";
import { buildEnvironment, terrainHeight, updateEnvironment } from "./environment";
import { getEquipmentTransform } from "./equipmentPresentation";

const zone = CONTENT.zones.meadowrest!;
// Elevated three-quarter follow offset, tuned by screenshot at 852x393 and
// 1440x900 rather than guessed from code — compact enough to keep nearby
// gathering targets readable without a wide, distant strategy-game view.
const CAMERA_OFFSET = new THREE.Vector3(13, 15.5, 16.5);
const CAMERA_FOLLOW_SMOOTHING = 0.22;
// How long the pickup "reach" reads before the item is actually removed
// from the world and added to the inventory (kept in the OSRS-feel spec's
// 350-650ms target range).
const PICKUP_PRESENTATION_MS = 480;
// Multiplied against the shared adventurer model's own material colours, so
// these need to be noticeably saturated to read as distinct outfits rather
// than washing out to near-white. Chosen to stay ~120 degrees apart in hue
// so all four are distinguishable at a glance and against Mara's own tint
// (see npcTints below).
const appearanceTints = {
  meadow: "#5fbf5a",
  ember: "#e8763a",
  tide: "#3f9fd6",
  dusk: "#a463d6",
} as const;

// Distinguishing tints for named NPCs so they don't read as recolours of the
// player. Mara's warm brown/rust sits outside the four player hues above.
const npcTints = {
  npc_mara: "#8a5a34",
} as const;
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

function targetVisible(target: ZoneInteractable, state: ReturnType<typeof useGameStore.getState>["save"]): boolean {
  if (!state) return false;
  if (target.requiredFlag && !state.worldFlags[target.requiredFlag]) return false;
  if (target.kind === "ground_item") return !state.worldFlags[`picked:${target.id}`];
  // Gathering nodes remain part of the world while resting. Cooldowns govern
  // whether an action may begin, never whether a tree, rock, or shoal exists.
  if (target.kind === "resource") return true;
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
    const spawn = useGameStore.getState().save?.position ?? zone.spawn;
    camera.position.copy(world(spawn)).add(CAMERA_OFFSET);
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
    const labelLayer = document.createElement("div");
    labelLayer.className = "world-label-layer";
    labelLayer.setAttribute("aria-hidden", "true");
    element.appendChild(labelLayer);
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

    // The Quarry (smelter + anvil, around 15,5) is the zone's one clearly
    // "industrial" pocket but previously read under the same flat daylight
    // as the meadow around it. A small warm point light sells forge heat
    // without touching facility placement or recipe data.
    const forgeLight = new THREE.PointLight(0xff7a3d, 1.7, 6.5, 2);
    forgeLight.position.copy(world({ x: 15.5, z: 5.5 })).add(new THREE.Vector3(0, 0.9, 0));
    scene.add(forgeLight);

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

    // The objective marker is a restrained, always-visible ring over the
    // player's CURRENT quest step's physical target — unlike targetHalo
    // above (which only appears once the player has already clicked
    // something), this needs no prior interaction. Deliberately kept small
    // and ground-level: no tutorial beam, no additive glow tower. It exists
    // purely so a required tool or destination doesn't blend into scenery,
    // not to dominate the frame.
    const objectiveBeaconGroup = new THREE.Group();
    const objectiveBeaconRing = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.44, 28),
      new THREE.MeshBasicMaterial({
        color: 0xf4dc8c,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    objectiveBeaconRing.rotation.x = -Math.PI / 2;
    objectiveBeaconRing.position.y = 0.06;
    const objectiveBeaconLight = new THREE.PointLight(0xffd76a, 0.6, 3, 2);
    objectiveBeaconLight.position.y = 0.6;
    objectiveBeaconGroup.add(objectiveBeaconRing, objectiveBeaconLight);
    objectiveBeaconGroup.visible = false;
    scene.add(objectiveBeaconGroup);
    const objectiveRouteMaterial = new THREE.PointsMaterial({
      color: 0xffdf79,
      size: 0.12,
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
    const targetLabels = new Map<string, HTMLSpanElement>();
    const playerLabel = document.createElement("span");
    playerLabel.className = "world-label player-label";
    playerLabel.textContent = useGameStore.getState().save?.player.name ?? "Wanderer";
    labelLayer.appendChild(playerLabel);
    const mixers: THREE.AnimationMixer[] = [];
    const playerRoot = new THREE.Group();
    scene.add(playerRoot);
    let playerMixer: THREE.AnimationMixer | null = null;
    let currentClip = "";
    let oneShotUntil = 0;
    let route: GridPosition[] = [];
    let afterArrival: (() => void) | null = null;
    // Explicit command identity (see game/playerCommand.ts): every walk/act
    // helper below cancels whatever came before it and mints a fresh id, so
    // a stale arrival callback or a stale pickup/reward timer from an
    // abandoned command can prove it is no longer current instead of firing
    // regardless.
    const commands = new PlayerCommandController();
    let disposed = false;
    let playerModel: THREE.Object3D | null = null;
    let handSlot: THREE.Object3D | null = null;
    let chestSlot: THREE.Object3D | null = null;
    let equippedWorldObject: THREE.Object3D | null = null;
    let equippedWorldItemId: string | null = null;
    let equipmentLoadSequence = 0;
    let equippedBodyObject: THREE.Object3D | null = null;
    let equippedBodyItemId: string | null = null;
    let bodyLoadSequence = 0;
    let lastHp: number | null = null;
    let lastCheerLogId: number | null = null;
    let restStartMs: number | null = null;
    // Wind-up/impact/recovery presentation for the current gathering
    // activity (see game/actionPresentation.ts). Tracks the authoritative
    // simulation's own progressMs so impact FX/audio land on the exact tick
    // a reward is granted, rather than running on a second, competing timer.
    let lastGatherActivityKey: string | null = null;
    let lastGatherProgressMs = 0;
    let impactPulseUntil = 0;
    // Test-only override for PICKUP_PRESENTATION_MS, settable exclusively
    // through the dev-only __EVERLOOM_TEST__ bridge below (never touched in
    // normal play). It exists because reliably proving "cancelling before
    // the pickup event never grants the item late" requires a real click to
    // land before the deadline; on this project's CI/sandbox environments a
    // single synthetic input round-trip has been measured well past the
    // production 480ms window (and separately, Playwright's fake-clock API
    // was found to destabilise this page's Three.js render loop, so that
    // was not a viable way to make the race deterministic either). Widening
    // the real delay for an explicitly-opted-in test run gives a normal-
    // speed click a comfortable, non-racy margin while going through the
    // exact same setTimeout + isActive(id) cancellation guard production
    // play uses — nothing about the callback itself changes.
    let pickupPresentationMsOverride: number | null = null;
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
    // If the player is currently resting on the floor (see the idle/rest
    // cycle below), any new movement or activity should stand them up
    // first rather than snapping straight into the next pose. Returns true
    // when it just triggered the stand-up one-shot, so the caller should
    // wait a frame before requesting anything else.
    const standUpIfSitting = (): boolean => {
      if (!currentClip.startsWith("Sit_Floor") || performance.now() < oneShotUntil) return false;
      play(currentClip === "Sit_Floor_Idle" ? "Sit_Floor_StandUp" : "Idle", true);
      restStartMs = null;
      return true;
    };

    const appearanceId = useGameStore.getState().save?.player.appearanceId ?? "meadow";
    criticalAssetJobs.push(instantiateAsset("player.adventurer", appearanceTints[appearanceId])
      .catch((error) => {
        console.warn("Player model failed; using the safe fallback figure.", error);
        element.dataset.assetWarning = "player";
        return { object: fallbackFigure(0x577b68), animations: [] };
      })
      .then(({ object, animations }) => {
        if (disposed) return;
        playerModel = object;
        // The source character is a showcase model containing every weapon
        // variant. Hide those baked-in props; equipment below is driven by
        // the player's real save state.
        for (const name of ["1H_Sword", "1H_Sword_Offhand", "2H_Sword", "Badge_Shield", "Rectangle_Shield", "Round_Shield", "Spike_Shield"]) {
          const prop = object.getObjectByName(name);
          if (prop) prop.visible = false;
        }
        // GLTFLoader strips dots because they are reserved by Three's
        // animation binding syntax (`handslot.r` becomes `handslotr`).
        handSlot = object.getObjectByName("handslotr")
          ?? object.getObjectByName("handr")
          ?? object.getObjectByName("handslot.r")
          ?? object.getObjectByName("hand.r")
          ?? null;
        chestSlot = object.getObjectByName("chest")
          ?? object.getObjectByName("spine")
          ?? null;
        object.userData.animations = animations;
        playerRoot.userData.animations = animations;
        playerRoot.add(object);
        // Apply appearance decorations (belt, gloves, scarf, etc.) to the character rig.
        const decorations = buildAppearanceDecorations(appearanceId);
        for (const [slot, bones] of Object.entries(APPEARANCE_ACCESSORY_BONES) as [AccessorySlot, readonly string[]][]) {
          const group = decorations[slot];
          if (!group) continue;
          const bone = bones.map((n) => object.getObjectByName(n)).find(Boolean);
          bone?.add(group);
        }
        if (animations.length) {
          playerMixer = new THREE.AnimationMixer(object);
          (playerMixer as THREE.AnimationMixer & { _root?: THREE.Object3D })._root = playerRoot;
          mixers.push(playerMixer);
          play("Idle");
        }
      }));

    const refreshEquipmentVisual = (itemId: string | null) => {
      if (itemId === equippedWorldItemId || !playerModel) return;
      equippedWorldItemId = itemId;
      equipmentLoadSequence += 1;
      const sequence = equipmentLoadSequence;
      equippedWorldObject?.removeFromParent();
      equippedWorldObject = null;
      if (!itemId || !handSlot) return;
      const assetId = CONTENT.items[itemId]?.worldAssetId;
      if (!assetId) return;
      void instantiateAsset(assetId).then(({ object }) => {
        if (disposed || sequence !== equipmentLoadSequence || !handSlot) return;
        const calibrated = getEquipmentTransform(itemId);
        object.position.set(...(calibrated?.position ?? [0, -0.56, 0]));
        object.rotation.set(...(calibrated?.rotation ?? [0, 0, Math.PI]));
        object.scale.multiplyScalar(calibrated?.scale ?? 0.62);
        object.traverse((child) => {
          child.userData.playerEquipment = itemId;
          if (child instanceof THREE.Mesh) child.castShadow = true;
        });
        handSlot.add(object);
        equippedWorldObject = object;
      }).catch((error) => console.warn(`Equipped asset ${assetId} failed`, error));
    };

    // Body-slot armour (chest/torso pieces) is worn independently of the
    // hand-held tool/weapon above, so it needs its own attachment socket and
    // its own load-sequence bookkeeping to avoid races on rapid re-equips.
    const refreshBodyEquipmentVisual = (itemId: string | null) => {
      if (itemId === equippedBodyItemId || !playerModel) return;
      equippedBodyItemId = itemId;
      bodyLoadSequence += 1;
      const sequence = bodyLoadSequence;
      equippedBodyObject?.removeFromParent();
      equippedBodyObject = null;
      if (!itemId || !chestSlot) return;
      const assetId = CONTENT.items[itemId]?.worldAssetId;
      if (!assetId) return;
      void instantiateAsset(assetId).then(({ object }) => {
        if (disposed || sequence !== bodyLoadSequence || !chestSlot) return;
        object.position.set(0, 0, 0.02);
        object.rotation.set(0, 0, 0);
        object.scale.multiplyScalar(1.05);
        object.traverse((child) => {
          child.userData.playerEquipment = itemId;
          if (child instanceof THREE.Mesh) child.castShadow = true;
        });
        chestSlot.add(object);
        equippedBodyObject = object;
      }).catch((error) => console.warn(`Equipped body asset ${assetId} failed`, error));
    };

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
      kind?: string,
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
      if (assetId === "player.adventurer" && id !== "player") {
        for (const name of ["1H_Sword", "1H_Sword_Offhand", "2H_Sword", "Badge_Shield", "Rectangle_Shield", "Round_Shield", "Spike_Shield"]) {
          const prop = object.getObjectByName(name);
          if (prop) prop.visible = false;
        }
        if (id === "npc_mara") {
          // Mara shares the same base rig as every generic villager/player,
          // so a tint alone is not enough to make her read as a named,
          // recognisable tutorial guide. Give her a distinct hood/shawl
          // silhouette attached to the chest bone.
          const chest = object.getObjectByName("chest") ?? object.getObjectByName("spine");
          if (chest) {
            void instantiateAsset("custom.npc-mara-shawl").then(({ object: shawl }) => {
              if (disposed) return;
              shawl.position.set(0, 0.05, -0.01);
              shawl.traverse((child) => {
                if (child instanceof THREE.Mesh) child.castShadow = true;
              });
              chest.add(shawl);
            }).catch((error) => console.warn("Mara shawl accessory failed", error));
          }
        }
      }
      object.position.copy(world({ x, z }));
      if (assetId === "custom.fishing-ripples") object.position.y = -0.03;
      object.position.y += elevation;
      object.rotation.y = rotation;
      object.scale.multiplyScalar(scale);
      // Ripple geometry is mostly empty space, so clicking its visual centre used to
      // hit the water underneath instead of the fishing target. Keep a generous,
      // invisible interaction surface over the shoal for real pointer input.
      if (interactive && assetId === "custom.fishing-ripples") {
        const fishingHitArea = new THREE.Mesh(
          new THREE.CylinderGeometry(1.55, 1.55, 0.08, 24),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
            colorWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        fishingHitArea.position.y = 0.08;
        fishingHitArea.userData.interactionHitArea = true;
        object.add(fishingHitArea);
      }
      if (interactive && kind === "ground_item") {
        addInteractionHitbox(object, kind, id);
      }
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
      const resolvedTint = (npcTints as Record<string, string>)[item.id] ?? item.tint ?? null;
      criticalAssetJobs.push(addAsset(item.id, item.assetId, item.x, item.z, 0, 1, item.kind === "ground_item" ? 0.14 : 0, resolvedTint, true, item.kind));
      const isFishingSpot = item.kind === "resource" && item.assetId === "custom.fishing-ripples";
      if (item.kind === "ground_item" || item.kind === "npc" || isFishingSpot) {
        const label = document.createElement("span");
        label.className = item.kind === "ground_item"
          ? "world-label ground-item-label"
          : isFishingSpot
            ? "world-label resource-label"
            : "world-label npc-label";
        label.textContent = item.kind === "ground_item" ? `◆ ${item.displayName}` : isFishingSpot ? `≈ ${item.displayName}` : item.displayName;
        labelLayer.appendChild(label);
        targetLabels.set(item.id, label);
      }
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
    // Runs the target's default action once the player has physically
    // arrived (or was already standing at a legal interaction cell). `id` is
    // the moving_to_interact command's id: every branch below must first
    // transition() that exact id forward, which fails harmlessly if the
    // command was cancelled or replaced while travelling.
    const actOn = (target: ZoneInteractable, id: number) => {
      const store = useGameStore.getState();
      const direction = world(target).sub(playerRoot.position);
      playerRoot.rotation.y = Math.atan2(direction.x, direction.z);
      store.setSelectedTarget(target.id);
      if (target.kind === "ground_item") {
        if (!commands.transition(id, { type: "picking_up", id, targetId: target.id })) return;
        // Physical pickup: the item stays visible and in the world through
        // the reach/bend animation, and only disappears (together with the
        // inventory update) at the pickup event itself — never at the
        // initial tap. The isActive(id) check inside the timeout is what
        // guarantees a cancelled pickup never grants the item late; any new
        // command (commands.begin()) invalidates this id immediately.
        play("PickUp", true);
        setTimeout(() => {
          if (!commands.isActive(id)) return;
          audio.play("pickup");
          useGameStore.getState().pickup(target.id);
          commands.cancel();
        }, pickupPresentationMsOverride ?? PICKUP_PRESENTATION_MS);
      } else if (target.kind === "npc" || target.kind === "landmark") {
        if (!commands.transition(id, { type: "talking", id, targetId: target.id })) return;
        play("Interact", true);
        store.interact(target.id);
        // This codebase's interact() is a single synchronous world-flag
        // write, not a suspended dialogue session, so the command completes
        // the instant it runs.
        commands.cancel();
      } else {
        if (!commands.transition(id, { type: "gathering", id, targetId: target.id })) return;
        store.startTargetActivity(target.id);
        // Left active on purpose: gathering's reward cadence is owned by the
        // authoritative simulation (see the animate loop's currentActivity
        // sync below), not by this command object. It is cancelled the
        // moment a new command begins.
      }
    };
    // Default action for a ground tap: cancel whatever the player was doing
    // and route to the tapped cell. Shared by the ordinary tap handler and
    // the long-press "Walk here" context menu option.
    const walkToGround = (point: THREE.Vector3) => {
      const save = useGameStore.getState().save;
      if (!save) return;
      useGameStore.getState().cancelCurrentActivity();
      commands.cancel();
      const destination = grid(point);
      const result = findPathResult(zone, save.position, [destination], blockedSet(zone));
      useGameStore.getState().setSelectedTarget(null);
      if (result.status === "unreachable") {
        useGameStore.getState().pushLog("I can't reach that.", "warning");
        setRoute([], null);
        return;
      }
      commands.begin((id) => ({ type: "moving", id, destination }));
      setRoute(result.status === "found" ? result.path : [], null);
    };
    // Default action for a target tap: route to a legal interaction cell and
    // run actOn on arrival. Shared by the ordinary tap handler and the
    // long-press default-verb context menu option. Never begins movement,
    // never acts, and never grants a reward for a target that cannot
    // actually be reached.
    const walkAndActOn = (target: ZoneInteractable) => {
      const save = useGameStore.getState().save;
      if (!save || !targetAvailable(target, save)) return;
      useGameStore.getState().cancelCurrentActivity();
      commands.cancel();
      const result = pathToTargetResult(zone, save.position, target);
      if (result.status === "unreachable") {
        useGameStore.getState().pushLog("I can't reach that.", "warning");
        useGameStore.getState().setSelectedTarget(null);
        marker.visible = false;
        return;
      }
      const command = commands.begin((id) => ({ type: "moving_to_interact", id, targetId: target.id }));
      setRoute(result.status === "found" ? result.path : [], () => actOn(target, command.id));
    };
    // "Walk here" on a target from the context menu: route only, never acts.
    const walkToTargetOnly = (target: ZoneInteractable) => {
      const save = useGameStore.getState().save;
      if (!save) return;
      useGameStore.getState().cancelCurrentActivity();
      commands.cancel();
      const result = pathToTargetResult(zone, save.position, target);
      if (result.status === "unreachable") {
        useGameStore.getState().pushLog("I can't reach that.", "warning");
        return;
      }
      commands.begin((id) => ({ type: "moving", id, destination: result.status === "found" ? result.path.at(-1)! : save.position }));
      setRoute(result.status === "found" ? result.path : [], null);
    };
    type RaycastHit = ReturnType<typeof raycaster.intersectObjects>[number];
    const raycastAt = (clientX: number, clientY: number): RaycastHit | undefined => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(scene.children, true).find((entry) => entry.object.userData.targetId || entry.object.userData.ground);
    };
    const onPointer = (event: PointerEvent) => {
      const hit = raycastAt(event.clientX, event.clientY);
      if (!hit) return;
      const targetId = hit.object.userData.targetId as string | undefined;
      if (targetId) {
        const target = zone.interactables.find((entry) => entry.id === targetId);
        if (target) walkAndActOn(target);
      } else {
        walkToGround(hit.point);
      }
    };

    // Long-press context menu: ~460ms hold with movement tolerance so an
    // ordinary tap is never mistaken for a long press. Works for both mouse
    // and touch since it is built entirely on Pointer Events.
    const LONG_PRESS_MS = 460;
    const LONG_PRESS_TOLERANCE_PX = 14;
    // Test-only override, mirroring pickupPresentationMsOverride above: lets
    // a test widen the real long-press deadline so a real cancelling
    // pointermove has a comfortable, non-racy margin, without changing any
    // callback/cancellation logic. Settable only through the dev-only
    // __EVERLOOM_TEST__ bridge.
    let longPressMsOverride: number | null = null;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressFired = false;
    let pointerDownScreen = { x: 0, y: 0 };
    const clearLongPressTimer = () => {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };
    const openMenuForHit = (hit: RaycastHit, clientX: number, clientY: number) => {
      const store = useGameStore.getState();
      const targetId = hit.object.userData.targetId as string | undefined;
      if (!targetId) {
        store.openContextMenu({
          x: clientX, y: clientY, title: "Ground",
          options: [
            { label: "Walk here", onSelect: () => walkToGround(hit.point) },
            { label: "Cancel", isCancel: true, onSelect: () => {} },
          ],
        });
        return;
      }
      const target = zone.interactables.find((entry) => entry.id === targetId);
      const save = store.save;
      if (!target || !save || !targetVisible(target, save)) return;
      store.openContextMenu({
        x: clientX, y: clientY, title: target.displayName,
        options: [
          { label: defaultVerbFor(target), onSelect: () => walkAndActOn(target) },
          { label: "Walk here", onSelect: () => walkToTargetOnly(target) },
          { label: `Examine ${target.displayName}`, onSelect: () => store.pushLog(`You examine the ${target.displayName.toLowerCase()}.`) },
          { label: "Cancel", isCancel: true, onSelect: () => {} },
        ],
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      // Audio playback is blocked in most browsers until a real user
      // gesture; the first pointer down on the world is as early and
      // reliable a gesture as this scene gets.
      audio.unlock();
      if (event.pointerType === "mouse" && event.button !== 0) return;
      longPressFired = false;
      pointerDownScreen = { x: event.clientX, y: event.clientY };
      const hit = raycastAt(event.clientX, event.clientY);
      clearLongPressTimer();
      if (!hit) return;
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        longPressFired = true;
        openMenuForHit(hit, pointerDownScreen.x, pointerDownScreen.y);
      }, longPressMsOverride ?? LONG_PRESS_MS);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (longPressTimer === null) return;
      const dx = event.clientX - pointerDownScreen.x;
      const dy = event.clientY - pointerDownScreen.y;
      if (Math.hypot(dx, dy) > LONG_PRESS_TOLERANCE_PX) clearLongPressTimer();
    };
    const onPointerUp = (event: PointerEvent) => {
      clearLongPressTimer();
      if (longPressFired) {
        longPressFired = false;
        return;
      }
      onPointer(event);
    };
    const onPointerCancel = () => {
      clearLongPressTimer();
      longPressFired = false;
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerCancel);
    const onContextMenuSuppress = (event: Event) => event.preventDefault();
    renderer.domElement.addEventListener("contextmenu", onContextMenuSuppress);
    const renderObjectiveRoute = (target: ZoneInteractable, save: NonNullable<ReturnType<typeof useGameStore.getState>["save"]>) => {
      const result = pathToTargetResult(zone, save.position, target);
      // An unreachable objective draws no trail rather than a route that
      // silently stops short — nothing productive to show the player.
      const routePoints = result.status === "found" ? result.path : [];
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
    const showObjectiveRoute = (event: Event) => {
      const requestedId = (event as CustomEvent<ObjectiveRouteDetail>).detail?.targetId;
      const save = useGameStore.getState().save;
      const target = objectiveGuidanceTarget(save);
      if (!save || !requestedId || target?.id !== requestedId || !targetVisible(target, save)) return;
      renderObjectiveRoute(target, save);
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
            emphasized: Boolean(objectiveBeaconGroup.userData.emphasized),
          };
        },
        objectiveRoute: () => ({
          visible: objectiveRouteTrail.visible,
          targetId: objectiveRouteTargetId,
          points: objectiveRouteTrail.geometry.getAttribute("position")?.count ?? 0,
        }),
        equipmentVisual: () => ({
          itemId: equippedWorldItemId,
          attached: Boolean(equippedWorldObject?.parent),
          bodyItemId: equippedBodyItemId,
          bodyAttached: Boolean(equippedBodyObject?.parent),
        }),
        visibleTarget: (targetId: string) => targets.get(targetId)?.visible ?? false,
        visibleLabel: (targetId: string) => {
          const label = targetLabels.get(targetId);
          return Boolean(label && label.style.display !== "none");
        },
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
          walkAndActOn(target);
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
          walkToTargetOnly(target);
          return true;
        },
        commandState: () => commands.current,
        // Narrowly-scoped read of the real long-press timer's own pending
        // state (see longPressTimer above) — lets a test observe the exact
        // moment onPointerMove's tolerance check clears it, deterministically,
        // instead of inferring cancellation only from whether the context
        // menu DOM node appears within some real-time window. Read-only:
        // this does not set, clear, or fire the timer itself.
        longPressPending: () => longPressTimer !== null,
        // See pickupPresentationMsOverride above. Sanitised so a test can
        // only ever widen this real delay, never shorten it below the
        // production PICKUP_PRESENTATION_MS.
        setPickupPresentationMs: (ms: number) => {
          pickupPresentationMsOverride = sanitiseTestDelayOverride(PICKUP_PRESENTATION_MS, ms);
        },
        // See longPressMsOverride above. Same widen-only sanitising against
        // the production LONG_PRESS_MS.
        setLongPressMs: (ms: number) => {
          longPressMsOverride = sanitiseTestDelayOverride(LONG_PRESS_MS, ms);
        },
      };
    }
    // Read-only diagnostic bridge for Playwright, compiled only in the
    // dedicated E2E "test" Vite mode (never plain `DEV`, and never present
    // in a production build). Unlike __EVERLOOM_TEST__ above, every method
    // here only reads live scene/save state; none of them can pick up an
    // item, move the player, or otherwise mutate the save. Real pointer
    // input (page.mouse.click / page.touchscreen.tap) is what a test must
    // use to actually collect an item — this bridge only tells the test
    // where to click and what happened as a result.
    if (import.meta.env.MODE === "test") {
      (window as Window & { __EVERLOOM_READONLY_TEST__?: unknown }).__EVERLOOM_READONLY_TEST__ = {
        worldReady: () => element.dataset.ready === "true",
        selectedTargetId: () => useGameStore.getState().selectedTargetId,
        inventoryQuantity: (itemId: string) =>
          useGameStore.getState().save?.inventory.find((stack) => stack.itemId === itemId)?.quantity ?? 0,
        target(targetId: string) {
          const definition = zone.interactables.find((entry) => entry.id === targetId);
          const liveObject = targets.get(targetId);
          const save = useGameStore.getState().save;
          const available = Boolean(definition && save && targetAvailable(definition, save));
          const visible = liveObject?.visible ?? false;
          const hitboxMesh = liveObject?.children.find(
            (child) => child.userData.interactionHitArea === true,
          ) as THREE.Mesh | undefined;
          let centre: { x: number; y: number } | null = null;
          let outsidePoint: { x: number; y: number } | null = null;
          if (liveObject && hitboxMesh) {
            const rect = renderer.domElement.getBoundingClientRect();
            const toScreen = (point: THREE.Vector3) => {
              const projected = point.clone().project(camera);
              return { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2 };
            };
            const worldCentre = hitboxMesh.getWorldPosition(new THREE.Vector3());
            centre = toScreen(worldCentre);
            const worldScale = hitboxMesh.getWorldScale(new THREE.Vector3());
            const worldRadius = (hitboxMesh.geometry as THREE.SphereGeometry).parameters.radius * worldScale.x;
            const edgeScreen = toScreen(worldCentre.clone().add(new THREE.Vector3(worldRadius, 0, 0)));
            const radiusPx = Math.hypot(edgeScreen.x - centre.x, edgeScreen.y - centre.y);
            // Deterministic point well clear of the hitbox, derived from its
            // own projected radius rather than an arbitrary pixel offset.
            outsidePoint = { x: centre.x + radiusPx * 3 + 24, y: centre.y };
          }
          return { exists: Boolean(liveObject), available, visible, centre, outsidePoint };
        },
      };
    }

    let last = performance.now();
    let metricFrame = 0;
    let metricStart = last;
    let activeQuality = useGameStore.getState().save?.settings.quality ?? "standard";
    let lastAutomaticObjectiveId: string | null = null;
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
        // The gathering command's reward cadence belongs to the
        // authoritative simulation, not to this controller — if the
        // activity ended on its own (inputs exhausted, resource depleted,
        // etc. inside store.tick) without going through a new player
        // command, sync the command back to idle here rather than leaving a
        // "gathering" command referring to an activity that no longer runs.
        if (commands.current.type === "gathering" && save.currentActivity?.type !== "gathering") commands.cancel();
        const equippedItemId = save.currentActivity?.type === "gathering"
          ? save.equipment.tool
          : save.currentActivity?.type === "combat"
            ? save.equipment.weapon
            : save.equipment.weapon ?? save.equipment.tool;
        refreshEquipmentVisual(equippedItemId);
        refreshBodyEquipmentVisual(save.equipment.body ?? null);
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
              if (callback) callback();
              // A plain "moving" command (ground tap, or context-menu "Walk
              // here") has no callback and is done the instant it arrives —
              // return to idle so it can't be mistaken for still-active
              // later. Commands with a callback (walkAndActOn) own their own
              // terminal transition via actOn()/transition() above.
              else commands.cancel();
            }
          } else {
            playerRoot.position.add(delta.normalize().multiplyScalar(Math.min(5.2 * movementDt, remaining)));
            playerRoot.rotation.y = Math.atan2(delta.x, delta.z);
            if (!standUpIfSitting()) play("Walking_A");
          }
        } else {
          playerRoot.position.lerp(desired, 0.25);

          // Hurt reaction: a brief flinch whenever HP drops between frames,
          // layered in ahead of the main state selection below.
          if (lastHp !== null && save.player.hp < lastHp && save.player.hp > 0 && now >= oneShotUntil) {
            play("Hit_A", true);
          }
          lastHp = save.player.hp;

          // Cheer reaction: celebrate on quest completions and level-ups.
          // The store's log feed already tags those with tone "rare", so we
          // watch for new entries rather than re-deriving quest state here.
          const logs = useGameStore.getState().logs;
          const latestLog = logs[logs.length - 1];
          if (latestLog && latestLog.id !== lastCheerLogId) {
            const isNewCelebration = lastCheerLogId !== null && latestLog.tone === "rare";
            lastCheerLogId = latestLog.id;
            if (isNewCelebration && save.player.hp > 0 && now >= oneShotUntil) play("Cheer", true);
          }

          if (now >= oneShotUntil) {
            if (save.player.hp <= 0) {
              restStartMs = null;
              play("Death_A");
            } else if (save.currentActivity?.type === "combat") {
              restStartMs = null;
              if (!standUpIfSitting()) play("1H_Melee_Attack_Chop");
            } else if (save.currentActivity?.type === "gathering") {
              restStartMs = null;
              const skill = CONTENT.resources[save.currentActivity.resourceId]?.skill;
              const gatherClip = skill === "fishing"
                ? "1H_Ranged_Aiming"
                : skill === "mining"
                  ? "1H_Melee_Attack_Stab"
                  : "1H_Melee_Attack_Chop";
              if (!standUpIfSitting()) play(gatherClip);
            } else if (save.currentActivity?.type === "production") {
              restStartMs = null;
              if (!standUpIfSitting()) play("Use_Item");
            } else if (save.currentActivity) {
              restStartMs = null;
              if (!standUpIfSitting()) play("Interact");
            } else {
              // No activity and not moving: after a stretch of true
              // inactivity, settle into a floor-rest pose so the world
              // doesn't feel frozen mid-adventure; any new activity or
              // movement stands the character back up via standUpIfSitting().
              if (restStartMs === null) restStartMs = now;
              if (now - restStartMs > 9000) {
                play(currentClip === "Sit_Floor_Down" ? "Sit_Floor_Idle" : "Sit_Floor_Down", currentClip !== "Sit_Floor_Down" && currentClip !== "Sit_Floor_Idle");
              } else {
                play("Idle");
              }
            }
          }
        }
        for (const target of zone.interactables) {
          const object = targets.get(target.id);
          if (object) object.visible = targetVisible(target, save);
        }
        // Near-fixed elevated three-quarter camera: a small smoothing factor
        // takes out per-frame jitter without producing the cinematic
        // trailing/catch-up feel of a slow follow. The player should never
        // see the camera visibly swing or lag behind a direction change.
        const focus = playerRoot.position.clone();
        camera.position.lerp(focus.clone().add(CAMERA_OFFSET), CAMERA_FOLLOW_SMOOTHING);
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
      // World Assistance settings (RuneLite-style clarity toggles, see
      // Hud.tsx's settings panel) let players turn the always-on objective
      // beacon and route trail off if they find them intrusive; both default
      // to on.
      const worldAssistance = useGameStore.getState().worldAssistance;
      const objectiveTarget = objectiveGuidanceTarget(save);
      const emphasized = Date.now() < useGameStore.getState().highlightPulseUntil;
      if ((worldAssistance.objectiveHighlighting || emphasized) && objectiveTarget && save && targetVisible(objectiveTarget, save)) {
        objectiveBeaconGroup.position.copy(world(objectiveTarget));
        const emphasisScale = emphasized ? 1.35 : 1;
        objectiveBeaconRing.scale.setScalar((1 + Math.sin(now / 280) * 0.06) * emphasisScale);
        objectiveBeaconLight.intensity = emphasized ? 1.1 : 0.6;
        objectiveBeaconGroup.visible = true;
        objectiveBeaconGroup.userData.emphasized = emphasized;
      } else {
        objectiveBeaconGroup.visible = false;
        objectiveBeaconGroup.userData.emphasized = false;
      }
      if (worldAssistance.pathTrailVisible && objectiveTarget && save && targetVisible(objectiveTarget, save) && lastAutomaticObjectiveId !== objectiveTarget.id) {
        renderObjectiveRoute(objectiveTarget, save);
        lastAutomaticObjectiveId = objectiveTarget.id;
      } else if (!objectiveTarget) {
        lastAutomaticObjectiveId = null;
      }
      if (objectiveRouteTrail.visible && (!worldAssistance.pathTrailVisible || objectiveRouteTargetId !== objectiveTarget?.id)) {
        objectiveRouteTrail.visible = false;
        objectiveRouteTargetId = null;
      }
      objectiveRouteMaterial.opacity = 0.45;
      const activity = save?.currentActivity;
      const activityTarget = activity && activity.type !== "expedition"
        ? zone.interactables.find((target) => target.id === activity.targetId)
        : undefined;
      // Impact detection: the authoritative simulation resets progressMs to
      // 0 (or a small remainder) exactly when a gathering cycle completes
      // and grants its item_gained/xp_gained reward — see
      // packages/core/src/simulation.ts. Watching for that wrap, rather than
      // running a second timer, is what keeps impact FX/audio truthfully in
      // sync with the real reward instead of merely approximating it.
      if (activity?.type === "gathering") {
        const activityKey = `${activity.targetId}:${activity.resourceId}`;
        if (activityKey !== lastGatherActivityKey) {
          lastGatherActivityKey = activityKey;
          lastGatherProgressMs = activity.progressMs;
        } else {
          if (didCycleComplete(lastGatherProgressMs, activity.progressMs)) {
            impactPulseUntil = now + 220;
            const skill = CONTENT.resources[activity.resourceId]?.skill;
            const cue: AudioCue = skill === "fishing" ? "fishing" : skill === "mining" ? "mining" : "woodcutting";
            audio.play(cue);
          }
          lastGatherProgressMs = activity.progressMs;
        }
      } else {
        lastGatherActivityKey = null;
      }
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
        // Brief, restrained impact pulse — a short scale/opacity bump on the
        // real reward tick, not a giant particle burst.
        const impactActive = now < impactPulseUntil;
        activityEffect.scale.setScalar(impactActive ? 1.35 : 1);
        effectMaterial.opacity = impactActive ? 1 : 0.82;
        activityEffect.visible = true;
      } else {
        activityEffect.visible = false;
      }
      for (const [targetId, label] of targetLabels) {
        const target = zone.interactables.find((entry) => entry.id === targetId);
        const object = targets.get(targetId);
        const visible = Boolean(target && object?.visible);
        if (!visible) {
          label.style.display = "none";
          continue;
        }
        const anchor = object!.getWorldPosition(new THREE.Vector3());
        anchor.y += target!.kind === "npc" ? 2.35 : 1.15;
        const projected = anchor.project(camera);
        const onScreen = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.08 && Math.abs(projected.y) < 1.08;
        label.style.display = onScreen ? "block" : "none";
        if (!onScreen) continue;
        label.style.left = `${(projected.x + 1) * 50}%`;
        label.style.top = `${(1 - projected.y) * 50}%`;
        label.classList.toggle("objective-label", objectiveTarget?.id === targetId);
      }
      if (save) {
        const projected = playerRoot.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 2.25, 0)).project(camera);
        playerLabel.textContent = save.player.name;
        playerLabel.style.display = "block";
        playerLabel.style.left = `${(projected.x + 1) * 50}%`;
        playerLabel.style.top = `${(1 - projected.y) * 50}%`;
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
      commands.cancel();
      // Reset dev-only test-delay overrides so a leftover widened value from
      // one test/session can never leak into another (e.g. HMR remount or a
      // later fresh-world test run within the same page).
      pickupPresentationMsOverride = null;
      longPressMsOverride = null;
      observer.disconnect();
      clearLongPressTimer();
      useGameStore.getState().closeContextMenu();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
      renderer.domElement.removeEventListener("contextmenu", onContextMenuSuppress);
      window.removeEventListener(OBJECTIVE_ROUTE_EVENT, showObjectiveRoute);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      contextReload.removeEventListener("click", onContextReload);
      objectiveRouteTrail.geometry.dispose();
      objectiveRouteMaterial.dispose();
      renderer.dispose();
      delete (window as Window & { __EVERLOOM_TEST__?: unknown }).__EVERLOOM_TEST__;
      if (import.meta.env.MODE === "test") {
        delete (window as Window & { __EVERLOOM_READONLY_TEST__?: unknown }).__EVERLOOM_READONLY_TEST__;
      }
      element.replaceChildren();
    };
  }, []);

  return <div className="world" ref={host} data-testid="game-world" />;
}
