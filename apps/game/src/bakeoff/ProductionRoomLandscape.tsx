import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { ProductionRoomProfile } from "./productionRoomTypes";
import { ProductionRoomMetricsCollector } from "./productionRoomMetrics";
import { getProductionRoomLayout, getCharacterPlacements, getProfileSettings, ROOM_DIMENSIONS } from "./productionRoomLayout";
import { instantiateAsset } from "../world/assets";
import "./production-room.css";

function attachAccessoryToBone(root: THREE.Object3D, accessory: THREE.Object3D, boneCandidates: string[]): string | null {
  for (const boneName of boneCandidates) {
    const bone = root.getObjectByName(boneName);
    if (bone) {
      bone.add(accessory);
      return boneName;
    }
  }
  return null;
}

function deterministicHash(index: number, seed: number): number {
  let x = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function getCorePlacementsForGrassClearing(
  layout: ReturnType<typeof getProductionRoomLayout>,
  characters: ReturnType<typeof getCharacterPlacements>
): Array<{ x: number; z: number; clearance: number }> {
  const corePlacements: Array<{ x: number; z: number; clearance: number }> = [];

  // Add characters
  for (let i = 0; i < Math.min(3, characters.length); i++) {
    corePlacements.push({
      x: characters[i]!.position[0]!,
      z: characters[i]!.position[2]!,
      clearance: 1.5,
    });
  }

  // Add key fixed placements
  for (const placement of layout.placements) {
    if (
      ["cottage-main", "bridge-main", "campfire-main"].includes(placement.instance)
    ) {
      corePlacements.push({
        x: placement.position[0],
        z: placement.position[2],
        clearance: 2,
      });
    }
  }

  return corePlacements;
}

function createGrassInstancedMesh(
  count: number,
  profileSettings: any,
  layout: ReturnType<typeof getProductionRoomLayout>,
  characters: ReturnType<typeof getCharacterPlacements>
): { mesh: THREE.InstancedMesh; geometry: THREE.BufferGeometry; material: THREE.Material } {
  const geometry = new THREE.PlaneGeometry(0.15, 0.15, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0x3d8f2a,
    roughness: 0.8,
    metalness: 0,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();

  const quat = new THREE.Quaternion();
  const scale3 = new THREE.Vector3();

  const corePlacements = getCorePlacementsForGrassClearing(layout, characters);

  const isClearOfPlacements = (x: number, z: number): boolean => {
    return corePlacements.every((place) => {
      const dx = x - place.x;
      const dz = z - place.z;
      return Math.sqrt(dx * dx + dz * dz) >= place.clearance;
    });
  };

  const isClearOfRiver = (z: number): boolean => {
    return Math.abs(z - ROOM_DIMENSIONS.riverCentreZ) >= 4;
  };

  const isClearOfPath = (x: number): boolean => {
    return Math.abs(x) > 2;
  };

  const isValidPosition = (x: number, z: number): boolean => {
    return (
      x >= -22 && x <= 22 &&
      z >= -14 && z <= 14 &&
      isClearOfRiver(z) &&
      isClearOfPlacements(x, z) &&
      isClearOfPath(x)
    );
  };

  let assigned = 0;
  let attempt = 0;
  const maxAttempts = count * 50;

  while (assigned < count && attempt < maxAttempts) {
    const x = (deterministicHash(attempt, 1001) * 44) - 22;
    const z = (deterministicHash(attempt, 1002) * 28) - 14;

    if (isValidPosition(x, z)) {
      const scale = 0.8 + deterministicHash(attempt, 1003) * 0.4;
      const rotY = deterministicHash(attempt, 1004) * Math.PI * 2;

      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      scale3.set(scale, scale, scale);

      matrix.identity();
      matrix.compose(new THREE.Vector3(x, 0, z), quat, scale3);

      mesh.setMatrixAt(assigned, matrix);
      assigned++;
    }

    attempt++;
  }

  if (assigned < count) {
    throw new Error(`Failed to generate ${count} grass instances: only generated ${assigned} after ${maxAttempts} attempts`);
  }

  mesh.receiveShadow = true;
  mesh.castShadow = false;

  return { mesh, geometry, material };
}

function shouldCastShadow(instanceId: string, profile: ProductionRoomProfile): boolean {
  const balancedShadowCasters = [
    "player",
    "mara",
    "skeleton",
    "cottage-main",
    "bridge-main",
    "campfire-main",
    "oak-a",
    "oak-b",
    "oak-c",
    "canopy-northwest",
  ];

  if (profile === "quality") {
    return !instanceId.startsWith("additional-") && !instanceId.startsWith("water-") && !instanceId.startsWith("cliff-");
  }

  return balancedShadowCasters.includes(instanceId);
}

interface ProductionRoomLandscapeProps {
  profile: ProductionRoomProfile;
  onProfileChange: (profile: ProductionRoomProfile) => void;
}

export function ProductionRoomLandscape({ profile, onProfileChange }: ProductionRoomLandscapeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const animationFrameRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);

  const metricsRef = useRef<ProductionRoomMetricsCollector | null>(null);
  const lastUiMetricsUpdateRef = useRef(0);
  const playerRef = useRef<THREE.Object3D | null>(null);
  const playerAnimationMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const playerIdleActionRef = useRef<THREE.AnimationAction | null>(null);
  const playerWalkActionRef = useRef<THREE.AnimationAction | null>(null);
  const playerMovementTargetRef = useRef<[number, number] | null>(null);

  const assetInstancesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const animationMixersRef = useRef<THREE.AnimationMixer[]>([]);
  const listenersRef = useRef<{ target: any; event: string; handler: (e: any) => void }[]>([]);
  const cameraFollowVectorRef = useRef(new THREE.Vector3());

  const ownedGeometriesRef = useRef<Set<THREE.BufferGeometry>>(new Set());
  const ownedMaterialsRef = useRef<Set<THREE.Material>>(new Set());
  const firstFrameRenderedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || ready) return;

    let mounted = true;

    async function initializeRoom() {
      const container = containerRef.current;
      if (!container || !mounted) return;

      try {
        const layout = getProductionRoomLayout(profile);
        const characters = getCharacterPlacements(profile);
        const profileSettings = getProfileSettings(profile);

        const expectedAssets = [
          ...layout.placements.map((p) => p.runtimeAssetId),
          ...characters.map((c) => c.runtimeAssetId),
          ...characters.filter((c) => c.accessory).map((c) => c.accessory as string),
        ];
        const uniqueAssets = [...new Set(expectedAssets)];
        metricsRef.current = new ProductionRoomMetricsCollector(profile, uniqueAssets);

        // Expected instance IDs: all layout placements, characters, actions, and core assets
        const expectedInstanceIds = [
          ...layout.placements.map((p) => p.instance),
          "player",
          "mara",
          "skeleton",
          "mara-shawl",
          "player-idle-action",
          "player-walking-a-action",
          "mara-idle-action",
          "skeleton-idle-action",
          "grass",
          "ground",
          "water",
        ];
        metricsRef.current.expectedInstanceIds = expectedInstanceIds.sort();

        container.setAttribute("data-bakeoff-ready", "false");

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x91b9b7);
        scene.fog = new THREE.Fog(0x91b9b7, 38, 75);
        sceneRef.current = scene;

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8dc1c1, 0.8);
        scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        dirLight.position.set(20, 30, 15);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = profileSettings.shadowMapSize;
        dirLight.shadow.mapSize.height = profileSettings.shadowMapSize;
        dirLight.shadow.camera.far = 100;
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        scene.add(dirLight);

        const campfireLight = new THREE.PointLight(0xff8c42, 1.5, 15);
        campfireLight.position.set(7, 2, -5);
        scene.add(campfireLight);

        const groundGeometry = new THREE.PlaneGeometry(ROOM_DIMENSIONS.groundWidth, ROOM_DIMENSIONS.groundDepth);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x5fa572 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);
        if (metricsRef.current && !metricsRef.current.loadedInstanceIds.includes("ground")) {
          metricsRef.current.loadedInstanceIds.push("ground");
        }

        ownedGeometriesRef.current.add(groundGeometry);
        ownedMaterialsRef.current.add(groundMaterial);

        const waterGeometry = new THREE.PlaneGeometry(ROOM_DIMENSIONS.riverWidth, ROOM_DIMENSIONS.riverDepth);
        const waterMaterial = new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0 },
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float time;
            varying vec2 vUv;
            void main() {
              vec2 uv = vUv;
              uv.y += time * 0.3;
              float wave = sin(uv.x * 3.0 + time * 2.0) * 0.02 + sin(uv.y * 2.0 + time * 1.5) * 0.02;
              gl_FragColor = vec4(0.4, 0.65, 0.7, 0.7) + vec4(wave);
            }
          `,
          transparent: true,
          depthWrite: false,
        });
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.position.z = ROOM_DIMENSIONS.riverCentreZ;
        water.position.y = 0.01;
        water.rotation.x = -Math.PI / 2;
        scene.add(water);
        if (metricsRef.current && !metricsRef.current.loadedInstanceIds.includes("water")) {
          metricsRef.current.loadedInstanceIds.push("water");
        }

        ownedGeometriesRef.current.add(waterGeometry);
        ownedMaterialsRef.current.add(waterMaterial);

        // Add grass
        const grassCount = profile === "balanced" ? 100 : 220;
        const grassMesh = createGrassInstancedMesh(grassCount, profileSettings, layout, characters);
        scene.add(grassMesh.mesh);
        ownedGeometriesRef.current.add(grassMesh.geometry);
        ownedMaterialsRef.current.add(grassMesh.material);

        if (metricsRef.current) {
          metricsRef.current.grassInstances = grassCount;
          if (!metricsRef.current.loadedInstanceIds.includes("grass")) {
            metricsRef.current.loadedInstanceIds.push("grass");
          }
        }

        let placementLoaded = 0;
        const loadPlacement = async (placement: any) => {
          try {
            const result = await instantiateAsset(placement.runtimeAssetId);
            if (!mounted) return;

            if (!result || typeof result !== "object" || !("object" in result)) {
              throw new Error("instantiateAsset returned invalid result");
            }

            const obj = result.object as THREE.Object3D;
            obj.position.fromArray(placement.position);
            obj.rotation.y = placement.rotationY;
            obj.scale.multiplyScalar(placement.scale);

            const castShadow = shouldCastShadow(placement.instance, profile);
            obj.traverse((child: THREE.Object3D) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = castShadow;
                child.receiveShadow = true;
              }
            });

            scene.add(obj);
            assetInstancesRef.current.set(placement.instance, obj);
            metricsRef.current?.assetLoaded(placement.runtimeAssetId);
            if (metricsRef.current && !metricsRef.current.loadedInstanceIds.includes(placement.instance)) {
              metricsRef.current.loadedInstanceIds.push(placement.instance);
            }
            placementLoaded++;
          } catch (err) {
            console.error(`Failed to load ${placement.runtimeAssetId}:`, err);
            metricsRef.current?.assetFailed(placement.runtimeAssetId);
            if (metricsRef.current && !metricsRef.current.failedInstanceIds.includes(placement.instance)) {
              metricsRef.current.failedInstanceIds.push(placement.instance);
            }
            placementLoaded++;
          }
        };

        await Promise.all(layout.placements.map(loadPlacement));

        if (metricsRef.current) {
          metricsRef.current.additionalTrees = layout.placements.filter((p) => p.role.startsWith("additional-tree")).length;
          metricsRef.current.additionalRocks = layout.placements.filter((p) => p.role.startsWith("additional-rock")).length;
        }

        let charLoaded = 0;
        const loadCharacter = async (char: any, index: number) => {
          try {
            const result = await instantiateAsset(char.runtimeAssetId);
            if (!mounted) return;

            if (!result || typeof result !== "object" || !("object" in result)) {
              throw new Error("instantiateAsset returned invalid result");
            }

            const obj = result.object as THREE.Object3D;
            const clips = (result as any).animations || [];

            const requiredClips = ["Idle", "Walking_A"];
            const missingClips = requiredClips.filter((name) => !clips.some((c: any) => c.name === name));
            if (missingClips.length > 0) {
              throw new Error(`Missing required animation clips: ${missingClips.join(", ")}`);
            }

            obj.position.fromArray(char.position);
            obj.rotation.y = char.rotationY;

            obj.traverse((child: THREE.Object3D) => {
              if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                const next = child.material.clone();
                next.color.multiply(new THREE.Color(char.tint));
                child.material = next;
                ownedMaterialsRef.current.add(next);
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            scene.add(obj);

            const mixer = new THREE.AnimationMixer(obj);
            animationMixersRef.current.push(mixer);

            if (index === 0) {
              playerRef.current = obj;
              playerAnimationMixerRef.current = mixer;
              assetInstancesRef.current.set("player", obj);
              if (metricsRef.current && !metricsRef.current.loadedInstanceIds.includes("player")) {
                metricsRef.current.loadedInstanceIds.push("player");
              }

              const idleClip = clips.find((c: any) => c.name === "Idle");
              const walkClip = clips.find((c: any) => c.name === "Walking_A");

              if (!idleClip || !walkClip) {
                throw new Error("Player missing Idle or Walking_A clip");
              }

              playerIdleActionRef.current = mixer.clipAction(idleClip);
              playerWalkActionRef.current = mixer.clipAction(walkClip);
              playerIdleActionRef.current.play();

              if (metricsRef.current) {
                metricsRef.current.loadedInstanceIds.push("player-idle-action");
                metricsRef.current.loadedInstanceIds.push("player-walking-a-action");
              }
            } else if (index === 1) {
              // Mara
              assetInstancesRef.current.set("mara", obj);
              if (metricsRef.current && !metricsRef.current.loadedInstanceIds.includes("mara")) {
                metricsRef.current.loadedInstanceIds.push("mara");
              }
              const idleClip = clips.find((c: any) => c.name === "Idle");
              if (idleClip) {
                mixer.clipAction(idleClip).play();
                if (metricsRef.current) {
                  metricsRef.current.loadedInstanceIds.push("mara-idle-action");
                }
              }
            } else {
              // Skeleton
              assetInstancesRef.current.set("skeleton", obj);
              if (metricsRef.current && !metricsRef.current.loadedInstanceIds.includes("skeleton")) {
                metricsRef.current.loadedInstanceIds.push("skeleton");
              }
              const idleClip = clips.find((c: any) => c.name === "Idle");
              if (idleClip) {
                mixer.clipAction(idleClip).play();
                if (metricsRef.current) {
                  metricsRef.current.loadedInstanceIds.push("skeleton-idle-action");
                }
              }
            }

            if (char.accessory) {
              try {
                const accessoryResult = await instantiateAsset(char.accessory);
                if (mounted && accessoryResult && "object" in accessoryResult) {
                  const accessory = accessoryResult.object as THREE.Object3D;
                  accessory.name = "mara-shawl-accessory";
                  accessory.traverse((child: THREE.Object3D) => {
                    if (child instanceof THREE.Mesh) {
                      child.castShadow = true;
                      child.receiveShadow = true;
                    }
                  });

                  const chestBoneCandidates = ["chest", "spine"];
                  const attachedBone = attachAccessoryToBone(obj, accessory, chestBoneCandidates);

                  if (!attachedBone) {
                    throw new Error(`Shawl attachment failed: no approved bone found (tried: ${chestBoneCandidates.join(", ")})`);
                  }

                  if (metricsRef.current) {
                    metricsRef.current.maraShawlAttached = true;
                    metricsRef.current.maraShawlParentBone = attachedBone;
                    if (!metricsRef.current.loadedInstanceIds.includes("mara-shawl")) {
                      metricsRef.current.loadedInstanceIds.push("mara-shawl");
                    }
                  }

                  metricsRef.current?.assetLoaded(char.accessory);
                }
              } catch (err) {
                console.error(`Failed to load accessory ${char.accessory}:`, err);
                metricsRef.current?.assetFailed(char.accessory);
              }
            }

            metricsRef.current?.assetLoaded(char.runtimeAssetId);
            charLoaded++;
          } catch (err) {
            console.error(`Failed to load character:`, err);
            metricsRef.current?.assetFailed(char.runtimeAssetId);
            const charIds = ["player", "mara", "skeleton"];
            const charId = charIds[index];
            if (charId && metricsRef.current && !metricsRef.current.failedInstanceIds.includes(charId)) {
              metricsRef.current.failedInstanceIds.push(charId);
            }
            charLoaded++;
          }
        };

        await Promise.all(characters.map((c, i) => loadCharacter(c, i)));

        if (!mounted) return;

        // Track shadow casters: count meshes with castShadow=true and record their instance IDs
        const shadowCasterIds = new Set<string>();
        let shadowMeshCount = 0;

        assetInstancesRef.current.forEach((obj, instanceId) => {
          let hasShadow = false;
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh && child.castShadow) {
              shadowMeshCount++;
              hasShadow = true;
            }
          });
          if (hasShadow) {
            shadowCasterIds.add(instanceId);
          }
        });

        // Filter to appropriate casters based on profile
        let filteredCasterIds = Array.from(shadowCasterIds);
        if (profile === "balanced") {
          // Balanced: only specific core casters
          const balancedCasters = [
            "player", "mara", "skeleton",
            "cottage-main", "bridge-main", "campfire-main",
            "oak-a", "oak-b", "oak-c", "canopy-northwest"
          ];
          filteredCasterIds = filteredCasterIds.filter((id) => balancedCasters.includes(id));
        } else {
          // Quality: exclude only additional-* and grass
          filteredCasterIds = filteredCasterIds.filter(
            (id) => !id.startsWith("additional-") && id !== "grass"
          );
        }

        if (metricsRef.current) {
          metricsRef.current.shadowCastingMeshes = shadowMeshCount;
          metricsRef.current.shadowCasterInstanceIds = filteredCasterIds.sort();
        }

        const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
        camera.position.copy(playerRef.current ? new THREE.Vector3(...ROOM_DIMENSIONS.cameraFollowOffset) : new THREE.Vector3(0, 13, 20));
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, profileSettings.pixelRatioCap));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const handleContextLoss = () => {
          if (metricsRef.current) {
            metricsRef.current.contextLost = true;
          }
        };
        renderer.domElement.addEventListener("webglcontextlost", handleContextLoss);
        listenersRef.current.push({ target: renderer.domElement, event: "webglcontextlost", handler: handleContextLoss });

        const raycaster = new THREE.Raycaster();
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        const handlePointerDown = (e: PointerEvent) => {
          if (e.button !== 0) return;

          const rect = renderer.domElement.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          const coords = new THREE.Vector2(x, y);
          raycaster.setFromCamera(coords, camera);
          const intersectionPoint = new THREE.Vector3();
          raycaster.ray.intersectPlane(groundPlane, intersectionPoint);

          intersectionPoint.x = Math.max(-22, Math.min(22, intersectionPoint.x));
          intersectionPoint.z = Math.max(-14, Math.min(14, intersectionPoint.z));

          playerMovementTargetRef.current = [intersectionPoint.x, intersectionPoint.z];

          if (playerIdleActionRef.current && playerWalkActionRef.current && playerAnimationMixerRef.current) {
            playerIdleActionRef.current.crossFadeTo(playerWalkActionRef.current, 0.3, true);
            playerWalkActionRef.current.play();
            if (metricsRef.current) {
              metricsRef.current.currentPlayerAnimation = "Walking_A";
            }
          }
        };

        renderer.domElement.addEventListener("pointerdown", handlePointerDown);
        renderer.domElement.style.touchAction = "none";
        listenersRef.current.push({ target: renderer.domElement, event: "pointerdown", handler: handlePointerDown });

        const handleKeyDown = (e: KeyboardEvent) => {
          if (!playerRef.current) return;
          const key = e.key.toLowerCase();
          if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
            const speed = 2;
            let dx = 0, dz = 0;
            if (key === "w" || key === "arrowup") dz -= speed;
            if (key === "s" || key === "arrowdown") dz += speed;
            if (key === "a" || key === "arrowleft") dx -= speed;
            if (key === "d" || key === "arrowright") dx += speed;

            const targetX = playerRef.current.position.x + dx;
            const targetZ = playerRef.current.position.z + dz;
            playerMovementTargetRef.current = [
              Math.max(-22, Math.min(22, targetX)),
              Math.max(-14, Math.min(14, targetZ)),
            ];

            if (playerIdleActionRef.current && playerWalkActionRef.current && playerAnimationMixerRef.current) {
              playerIdleActionRef.current.crossFadeTo(playerWalkActionRef.current, 0.3, true);
              playerWalkActionRef.current.play();
              if (metricsRef.current) {
                metricsRef.current.currentPlayerAnimation = "Walking_A";
              }
            }
          }
        };

        window.addEventListener("keydown", handleKeyDown);
        listenersRef.current.push({ target: window, event: "keydown", handler: handleKeyDown });

        let frameCount = 0;
        const animate = () => {
          if (!mounted) return;
          animationFrameRef.current = requestAnimationFrame(animate);

          const delta = clockRef.current.getDelta();
          metricsRef.current?.recordFrame(delta * 1000);

          animationMixersRef.current.forEach((mixer) => mixer.update(delta));

          if (playerRef.current && playerMovementTargetRef.current) {
            const targetX = playerMovementTargetRef.current[0];
            const targetZ = playerMovementTargetRef.current[1];
            const currentX = playerRef.current.position.x;
            const currentZ = playerRef.current.position.z;

            const dx = targetX - currentX;
            const dz = targetZ - currentZ;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance > 0.08) {
              const moveSpeed = ROOM_DIMENSIONS.playerMovementSpeed * delta;
              const moveDistance = Math.min(moveSpeed, distance);
              playerRef.current.position.x += (dx / distance) * moveDistance;
              playerRef.current.position.z += (dz / distance) * moveDistance;

              if (metricsRef.current) {
                metricsRef.current.movementTarget = { x: targetX, y: 0, z: targetZ };
              }
            } else {
              playerMovementTargetRef.current = null;

              if (playerIdleActionRef.current && playerWalkActionRef.current && playerAnimationMixerRef.current) {
                playerWalkActionRef.current.crossFadeTo(playerIdleActionRef.current, 0.3, true);
                playerIdleActionRef.current.play();
              }

              if (metricsRef.current) {
                metricsRef.current.movementTarget = null;
                metricsRef.current.currentPlayerAnimation = "Idle";
              }
            }
          }

          if (playerRef.current && metricsRef.current) {
            metricsRef.current.playerPosition = {
              x: playerRef.current.position.x,
              y: playerRef.current.position.y,
              z: playerRef.current.position.z,
            };
          }

          if (playerRef.current && cameraRef.current) {
            const targetCamX = playerRef.current.position.x + ROOM_DIMENSIONS.cameraFollowOffset[0];
            const targetCamY = playerRef.current.position.y + ROOM_DIMENSIONS.cameraFollowOffset[1];
            const targetCamZ = playerRef.current.position.z + ROOM_DIMENSIONS.cameraFollowOffset[2];

            const followStrength = 2;
            const followAlpha = 1 - Math.exp(-followStrength * delta);

            cameraFollowVectorRef.current.set(targetCamX, targetCamY, targetCamZ);
            cameraRef.current.position.lerp(cameraFollowVectorRef.current, followAlpha);
            cameraRef.current.lookAt(playerRef.current.position.x, playerRef.current.position.y + 0.9, playerRef.current.position.z);
          }

          const uniforms = (water.material as THREE.ShaderMaterial).uniforms;
          if (uniforms && uniforms.time) {
            uniforms.time.value += delta;
          }

          if (metricsRef.current) {
            const rendererInfo = (renderer.info as any).render;
            metricsRef.current.updateMetrics(
              {
                calls: rendererInfo.calls,
                triangles: rendererInfo.triangles,
                points: rendererInfo.points,
                lines: rendererInfo.lines,
                geometries: (renderer.info as any).memory.geometries,
                textures: (renderer.info as any).memory.textures,
              },
              window.innerWidth,
              window.innerHeight,
              window.devicePixelRatio,
              Math.min(window.devicePixelRatio, profileSettings.pixelRatioCap)
            );

            const now = performance.now();
            if (now - lastUiMetricsUpdateRef.current >= 250) {
              lastUiMetricsUpdateRef.current = now;
              setMetrics(metricsRef.current.updateMetrics(
                {
                  calls: rendererInfo.calls,
                  triangles: rendererInfo.triangles,
                  points: rendererInfo.points,
                  lines: rendererInfo.lines,
                  geometries: (renderer.info as any).memory.geometries,
                  textures: (renderer.info as any).memory.textures,
                },
                window.innerWidth,
                window.innerHeight,
                window.devicePixelRatio,
                Math.min(window.devicePixelRatio, profileSettings.pixelRatioCap)
              ));
            }
          }

          renderer.render(scene, camera);

          frameCount++;
          if (frameCount === 1 && metricsRef.current && !ready) {
            firstFrameRenderedRef.current = true;
            metricsRef.current.firstCompleteFrameRendered = true;

            const allAssets = metricsRef.current.assetsExpected;
            const loadedAssets = metricsRef.current.assetsLoaded;
            const failed = metricsRef.current.failedAssets;

            const assetsMatch = new Set(allAssets).size === new Set(loadedAssets).size &&
              allAssets.every((a) => loadedAssets.includes(a)) &&
              failed.length === 0;

            // Placement-level readiness check
            const expectedSet = new Set(metricsRef.current.expectedInstanceIds);
            const loadedSet = new Set(metricsRef.current.loadedInstanceIds);
            const failedSet = new Set(metricsRef.current.failedInstanceIds);

            const instancesReady =
              expectedSet.size === loadedSet.size &&
              Array.from(expectedSet).every((id) => loadedSet.has(id)) &&
              failedSet.size === 0;

            if (assetsMatch && instancesReady) {
              metricsRef.current.markReady();
              setReady(true);
              container.setAttribute("data-bakeoff-ready", "true");
            }
          }
        };

        animate();

        const handleResize = () => {
          if (!cameraRef.current || !rendererRef.current) return;
          cameraRef.current.aspect = window.innerWidth / window.innerHeight;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        };

        window.addEventListener("resize", handleResize);
        listenersRef.current.push({ target: window, event: "resize", handler: handleResize });
      } catch (err) {
        console.error("Failed to initialize production room:", err);
        if (metricsRef.current) {
          metricsRef.current.assetFailed("initialization-error");
        }
      }
    }

    initializeRoom();

    return () => {
      mounted = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

      listenersRef.current.forEach(({ target, event, handler }) => {
        target.removeEventListener(event, handler);
      });
      listenersRef.current = [];

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.domElement.remove();
      }

      ownedGeometriesRef.current.forEach((geom) => geom.dispose());
      ownedMaterialsRef.current.forEach((mat) => mat.dispose());

      animationMixersRef.current.forEach((mixer) => mixer.uncacheRoot(mixer.getRoot()));
    };
  }, [profile]);

  const handleResetView = () => {
    if (playerRef.current) {
      playerRef.current.position.set(0, 0, -5);
      playerMovementTargetRef.current = null;
      if (playerIdleActionRef.current && playerWalkActionRef.current && playerAnimationMixerRef.current) {
        playerWalkActionRef.current.stop();
        playerIdleActionRef.current.reset();
        playerIdleActionRef.current.play();
      }
      if (metricsRef.current) {
        metricsRef.current.playerPosition = { x: 0, y: 0, z: -5 };
        metricsRef.current.movementTarget = null;
        metricsRef.current.currentPlayerAnimation = "Idle";
      }
    }
  };

  const handleProfileChange = (newProfile: ProductionRoomProfile) => {
    const params = new URLSearchParams(location.search);
    params.set("profile", newProfile);
    params.set("bakeoff", "meadowrest");
    location.replace(`${location.pathname}?${params.toString()}`);
  };

  return (
    <div className="production-room-container" data-everloom-authoritative-app="apps-game" data-everloom-bakeoff="meadowrest">
      <div ref={containerRef} className="production-room-canvas" />

      <div className="production-room-overlay">
        <div className="overlay-header">
          <h1>Meadowrest Production Room</h1>
          <p className="subtitle">Browser and mobile-emulation bake-off</p>
        </div>

        <div className="overlay-metrics">
          <div className="metric-group">
            <label>Profile</label>
            <div className="profile-buttons">
              <button
                className={profile === "balanced" ? "active" : ""}
                onClick={() => handleProfileChange("balanced")}
              >
                Balanced
              </button>
              <button
                className={profile === "quality" ? "active" : ""}
                onClick={() => handleProfileChange("quality")}
              >
                Quality
              </button>
            </div>
          </div>

          {metrics && (
            <div className="metrics-display">
              <div className="metric">
                <span className="label">Assets</span>
                <span className="value">{metrics.assetsLoaded.length}/{metrics.assetsExpected.length}</span>
              </div>
              <div className="metric">
                <span className="label">FPS</span>
                <span className="value">{metrics.averageFps ?? "-"}</span>
              </div>
              <div className="metric">
                <span className="label">P95ms</span>
                <span className="value">{metrics.p95FrameMs?.toFixed(0) ?? "-"}</span>
              </div>
              <div className="metric">
                <span className="label">Grass</span>
                <span className="value">{metrics.grassInstances}</span>
              </div>
            </div>
          )}

          <button className="reset-button" onClick={handleResetView}>
            Reset view
          </button>
        </div>

        <div className="overlay-footer">
          <p className="disclaimer">Browser evidence only. Physical iPhone verification is a separate gate.</p>
        </div>
      </div>
    </div>
  );
}
