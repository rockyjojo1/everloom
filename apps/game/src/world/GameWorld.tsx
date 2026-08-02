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
import { addInteractionHitbox, instantiateAsset } from "./assets";
import {
  APPEARANCE_ACCESSORY_BONES,
  buildAppearanceDecorations,
  type AccessorySlot,
} from "./characterPresentation";
import { buildEnvironment, terrainHeight, updateEnvironment } from "./environment";
import { getEquipmentTransform } from "./equipmentPresentation";
import {
  buildMeadowrestHall,
  buildEntryGate,
  buildWaystone,
  buildGroveEntrance,
  buildWoodpile,
  createGatherParticles,
} from "./landmarks";

const zone = CONTENT.zones.meadowrest!;
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

    // Stage B landmarks: Meadowrest Hall, Entry Gate, Waystones, Grove Entrance, Woodpile
    const hall = buildMeadowrestHall();
    hall.position.copy(world({ x: 22, z: 19 }));
    scene.add(hall);

    const entryGate = buildEntryGate();
    entryGate.position.copy(world({ x: 24, z: 25 }));
    scene.add(entryGate);

    const waystone1 = buildWaystone();
    waystone1.position.copy(world({ x: 24, z: 17 }));
    scene.add(waystone1);

    const groveEntrance = buildGroveEntrance();
    groveEntrance.position.copy(world({ x: 8, z: 12 }));
    scene.add(groveEntrance);

    const woodpile = buildWoodpile();
    woodpile.position.copy(world({ x: 5, z: 8 })).add(new THREE.Vector3(0, 0, 0.4));
    scene.add(woodpile);

    // Prepare gather particle effect for reuse during gathering actions
    const gatherParticleTemplate = createGatherParticles();
    gatherParticleTemplate.visible = false;
    scene.add(gatherParticleTemplate);

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
        addInteractionHitbox(object, kind);
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
    const renderObjectiveRoute = (target: ZoneInteractable, save: NonNullable<ReturnType<typeof useGameStore.getState>["save"]>) => {
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
              callback?.();
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
      // World Assistance settings (RuneLite-style clarity toggles, see
      // Hud.tsx's settings panel) let players turn the always-on objective
      // beacon and route trail off if they find them intrusive; both default
      // to on.
      const worldAssistance = useGameStore.getState().worldAssistance;
      const objectiveTarget = objectiveGuidanceTarget(save);
      const emphasized = Date.now() < useGameStore.getState().highlightPulseUntil;
      if ((worldAssistance.objectiveHighlighting || emphasized) && objectiveTarget && save && targetVisible(objectiveTarget, save)) {
        objectiveBeaconGroup.position.copy(world(objectiveTarget));
        objectiveBeaconGroup.position.y += Math.sin(now / 420) * 0.12;
        const emphasisScale = emphasized ? 1.9 : 1;
        objectiveBeaconRing.scale.setScalar((1 + Math.sin(now / 280) * 0.12) * emphasisScale);
        objectiveBeaconLight.intensity = emphasized ? 2.4 + Math.sin(now / 90) * 1.1 : 2.4;
        objectiveBeaconMarker.scale.setScalar(emphasized ? 1.4 : 1);
        objectiveBeaconMarker.rotation.y += animationDt * (emphasized ? 4.2 : 1.6);
        objectiveBeaconMarker.rotation.x += animationDt * 0.9;
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
