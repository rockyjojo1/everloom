import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { ProductionRoomProfile } from "./productionRoomTypes";
import { ProductionRoomMetricsCollector } from "./productionRoomMetrics";
import { getProductionRoomLayout, getCharacterPlacements, getProfileSettings, ROOM_DIMENSIONS } from "./productionRoomLayout";
import { instantiateAsset } from "../world/assets";
import "./production-room.css";

export function MeadowrestProductionRoom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const animationFrameRef = useRef<number | null>(null);

  // Read profile from URL params, default to "balanced"
  const [profile, setProfile] = useState<ProductionRoomProfile>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const profileParam = params.get("profile");
      if (profileParam === "quality" || profileParam === "balanced") {
        return profileParam;
      }
    }
    return "balanced";
  });
  const [ready, setReady] = useState(false);
  const [loadedAssets, setLoadedAssets] = useState<string[]>([]);
  const [failedAssets, setFailedAssets] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  const metricsRef = useRef<ProductionRoomMetricsCollector | null>(null);
  const lastUiMetricsUpdateRef = useRef(0);
  const playerRef = useRef<THREE.Object3D | null>(null);
  const playerAnimationMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const playerAnimationActionRef = useRef<THREE.AnimationAction | null>(null);
  const playerMovementTargetRef = useRef<[number, number] | null>(null);

  const assetInstancesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const animationMixersRef = useRef<THREE.AnimationMixer[]>([]);

  // Determine landscape vs portrait
  const isPortrait = () => {
    if (typeof window !== "undefined") {
      return window.innerHeight > window.innerWidth;
    }
    return false;
  };

  const [isPortraitMode, setIsPortraitMode] = useState(isPortrait());

  useEffect(() => {
    const handleResize = () => {
      setIsPortraitMode(isPortrait());
    };
    window.addEventListener("orientationchange", handleResize);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("orientationchange", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (isPortraitMode) {
    return (
      <div
        data-everloom-authoritative-app="apps-game"
        data-everloom-bakeoff="meadowrest"
        className="production-room-portrait"
      >
        <div className="portrait-overlay">
          <h2>Rotate to landscape</h2>
          <p>The production room is measured in a wider view.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!containerRef.current || ready) return;

    let mounted = true;

    async function initializeRoom() {
      const container = containerRef.current;
      if (!container) return;

      try {
        // Get layout for current profile
        const layout = getProductionRoomLayout(profile);
        const characters = getCharacterPlacements(profile);
        const profileSettings = getProfileSettings(profile);

        // Initialize metrics
        const expectedAssets = [
          ...layout.placements.map((p) => p.runtimeAssetId),
          ...characters.map((c) => c.runtimeAssetId),
          ...characters.filter((c) => c.accessory).map((c) => c.accessory as string),
        ];
        const uniqueAssets = [...new Set(expectedAssets)];
        metricsRef.current = new ProductionRoomMetricsCollector(profile, uniqueAssets);

        // Initialize Three.js scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x91b9b7);
        scene.fog = new THREE.Fog(0x91b9b7, 38, 75);
        sceneRef.current = scene;

        // Add hemisphere light
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8dc1c1, 0.8);
        scene.add(hemiLight);

        // Add directional light
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

        // Add campfire light
        const campfireLight = new THREE.PointLight(0xff8c42, 1.5, 15);
        campfireLight.position.set(7, 2, -5);
        scene.add(campfireLight);

        // Add ground plane
        const groundGeometry = new THREE.PlaneGeometry(ROOM_DIMENSIONS.groundWidth, ROOM_DIMENSIONS.groundDepth);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x5fa572 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Add water
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
        });
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.position.z = ROOM_DIMENSIONS.riverCentreZ;
        water.position.y = 0.01;
        water.rotation.x = -Math.PI / 2;
        water.receiveShadow = false;
        scene.add(water);

        // Load placements
        let loadedCount = 0;
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

            // Set shadow properties
            obj.traverse((child: THREE.Object3D) => {
              if (child instanceof THREE.Mesh) {
                if (placement.castShadow) child.castShadow = true;
                if (placement.receiveShadow) child.receiveShadow = true;
              }
            });

            scene.add(obj);
            assetInstancesRef.current.set(placement.instance, obj);
            metricsRef.current?.assetLoaded(placement.runtimeAssetId);
            setLoadedAssets((prev) => {
              if (!prev.includes(placement.runtimeAssetId)) {
                return [...prev, placement.runtimeAssetId];
              }
              return prev;
            });
            loadedCount++;
          } catch (err) {
            console.error(`Failed to load ${placement.runtimeAssetId}:`, err);
            metricsRef.current?.assetFailed(placement.runtimeAssetId);
            setFailedAssets((prev) => {
              if (!prev.includes(placement.runtimeAssetId)) {
                return [...prev, placement.runtimeAssetId];
              }
              return prev;
            });
            loadedCount++;
          }
        };

        // Load all placements
        await Promise.all(layout.placements.map(loadPlacement));

        // Load characters
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
            obj.position.fromArray(char.position);
            obj.rotation.y = char.rotationY;

            // Apply tint. GLTFLoader produces MeshStandardMaterial for these
            // rigs (confirmed via the same pattern in ../world/assets.ts),
            // not MeshPhongMaterial -- the previous check against
            // MeshPhongMaterial silently matched nothing, so player, Mara
            // and the skeleton all rendered in their untinted source colour.
            obj.traverse((child: THREE.Object3D) => {
              if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                const next = child.material.clone();
                next.color.multiply(new THREE.Color(char.tint));
                child.material = next;
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            scene.add(obj);

            // Get animation mixer
            const mixer = new THREE.AnimationMixer(obj);
            animationMixersRef.current.push(mixer);

            // Handle player specially
            if (index === 0) {
              playerRef.current = obj;
              playerAnimationMixerRef.current = mixer;

              // Try to start with Idle animation
              const idleClip = clips.find((c: any) => c.name === "Idle");
              if (idleClip) {
                const action = mixer.clipAction(idleClip);
                playerAnimationActionRef.current = action;
                action.play();
              }
            } else {
              // Mara and skeleton
              const idleClip = clips.find((c: any) => c.name === "Idle");
              if (idleClip) {
                mixer.clipAction(idleClip).play();
              }
            }

            // Load accessory if specified
            if (char.accessory) {
              try {
                const accessoryResult = await instantiateAsset(char.accessory);
                if (mounted && accessoryResult && "object" in accessoryResult) {
                  const accessory = accessoryResult.object as THREE.Object3D;
                  accessory.traverse((child: THREE.Object3D) => {
                    if (child instanceof THREE.Mesh) {
                      child.castShadow = true;
                      child.receiveShadow = true;
                    }
                  });
                  obj.add(accessory);
                  metricsRef.current?.assetLoaded(char.accessory);
                }
              } catch (err) {
                console.error(`Failed to load accessory ${char.accessory}:`, err);
              }
            }

            metricsRef.current?.assetLoaded(char.runtimeAssetId);
            charLoaded++;
          } catch (err) {
            console.error(`Failed to load character:`, err);
            metricsRef.current?.assetFailed(char.runtimeAssetId);
            charLoaded++;
          }
        };

        await Promise.all(characters.map((c, i) => loadCharacter(c, i)));

        // React 18 StrictMode double-invokes this effect in development:
        // mount, cleanup, mount again, synchronously, before any of the
        // asset-loading awaits above resolve. The cleanup already flips
        // `mounted` to false for the first (discarded) invocation. Without
        // this guard, that discarded invocation would still create a full
        // WebGLRenderer and append its canvas to the shared container --
        // an orphaned second GPU context and DOM element that never renders
        // (its animate() loop self-cancels) but sits alive for the rest of
        // the session, contending for GPU resources with the real one and
        // roughly halving measured FPS. Individual asset loads already
        // check `mounted` (see loadPlacement/loadCharacter above); this is
        // the equivalent guard for renderer creation itself.
        if (!mounted) return;

        // Initialize camera
        const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
        camera.position.copy(playerRef.current ? new THREE.Vector3(...ROOM_DIMENSIONS.cameraFollowOffset) : new THREE.Vector3(0, 13, 20));
        cameraRef.current = camera;

        // Initialize renderer
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

        // Handle webglcontextlost
        renderer.domElement.addEventListener("webglcontextlost", () => {
          if (metricsRef.current) {
            metricsRef.current.contextLost = true;
          }
        });

        // Input handling
        const raycaster = new THREE.Raycaster();
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        const handlePointerDown = (e: PointerEvent) => {
          if (e.button !== 0) return; // Left click only

          const rect = renderer.domElement.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          const coords = new THREE.Vector2(x, y);
          raycaster.setFromCamera(coords, camera);
          const intersectionPoint = new THREE.Vector3();
          raycaster.ray.intersectPlane(groundPlane, intersectionPoint);

          // Clamp to room bounds
          intersectionPoint.x = Math.max(-22, Math.min(22, intersectionPoint.x));
          intersectionPoint.z = Math.max(-14, Math.min(14, intersectionPoint.z));

          playerMovementTargetRef.current = [intersectionPoint.x, intersectionPoint.z];

          // Start walking animation
          if (playerAnimationActionRef.current && playerAnimationMixerRef.current && playerRef.current) {
            const clips = (playerRef.current as any).animations || [];
            const walkClip = clips.find((c: any) => c.name === "Walking_A");
            if (walkClip) {
              const walkAction = playerAnimationMixerRef.current.clipAction(walkClip);
              walkAction.reset();
              playerAnimationActionRef.current.crossFadeTo(walkAction, 0.3, true);
              playerAnimationActionRef.current = walkAction;
            }
          }

          // metricsRef.currentPlayerAnimation was previously never written
          // anywhere outside the constructor default -- window.__EVERLOOM_
          // BAKEOFF__.currentPlayerAnimation stayed "Idle" forever regardless
          // of real animation state, which is why Walking_A assertions failed
          // even though the mixer itself was crossfading correctly.
          if (metricsRef.current) {
            metricsRef.current.currentPlayerAnimation = "Walking_A";
          }
        };

        renderer.domElement.addEventListener("pointerdown", handlePointerDown);
        renderer.domElement.style.touchAction = "none";

        // Mark ready
        if (mounted) {
          metricsRef.current?.markReady();
          setReady(true);
          container.setAttribute("data-bakeoff-ready", "true");
        }

        // Animation loop
        const animate = () => {
          if (!mounted) return;
          animationFrameRef.current = requestAnimationFrame(animate);

          const delta = clockRef.current.getDelta();
          metricsRef.current?.recordFrame(delta * 1000);

          // Update animation mixers
          animationMixersRef.current.forEach((mixer) => mixer.update(delta));

          // Update player movement
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

              // Return to idle
              if (playerAnimationActionRef.current && playerAnimationMixerRef.current && playerRef.current) {
                const clips = (playerRef.current as any).animations || [];
                const idleClip = clips.find((c: any) => c.name === "Idle");
                if (idleClip) {
                  const idleAction = playerAnimationMixerRef.current.clipAction(idleClip);
                  playerAnimationActionRef.current.crossFadeTo(idleAction, 0.3, true);
                  playerAnimationActionRef.current = idleAction;
                }
              }

              // movementTarget/currentPlayerAnimation were previously left
              // at their last in-motion values on arrival (movementTarget
              // never cleared; currentPlayerAnimation never written at all --
              // see handlePointerDown). Both are now the authoritative
              // per-frame state Playwright reads from window.__EVERLOOM_
              // BAKEOFF__, so they must reach "arrived" state here.
              if (metricsRef.current) {
                metricsRef.current.movementTarget = null;
                metricsRef.current.currentPlayerAnimation = "Idle";
              }
            }
          }

          // Keep reported position authoritative every frame (not only while
          // actively moving) so it never goes stale after e.g. Reset view.
          if (playerRef.current && metricsRef.current) {
            metricsRef.current.playerPosition = {
              x: playerRef.current.position.x,
              y: playerRef.current.position.y,
              z: playerRef.current.position.z,
            };
          }

          // Update camera
          if (playerRef.current && cameraRef.current) {
            const targetCamX = playerRef.current.position.x + ROOM_DIMENSIONS.cameraFollowOffset[0];
            const targetCamY = playerRef.current.position.y + ROOM_DIMENSIONS.cameraFollowOffset[1];
            const targetCamZ = playerRef.current.position.z + ROOM_DIMENSIONS.cameraFollowOffset[2];

            cameraRef.current.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.1);
            cameraRef.current.lookAt(playerRef.current.position.x, playerRef.current.position.y + 0.9, playerRef.current.position.z);
          }

          // Update water shader
          const uniforms = (water.material as THREE.ShaderMaterial).uniforms;
          if (uniforms && uniforms.time) {
            uniforms.time.value += delta;
          }

          // Update metrics. updateMetrics() writes window.__EVERLOOM_BAKEOFF__
          // synchronously every frame (cheap: array math on <=600 samples), so
          // Playwright always observes fresh state. The React setMetrics()
          // call below is throttled because it triggers a full component
          // re-render for the debug overlay only — calling it 60x/sec was
          // adding a render-loop-blocking React commit on every frame and
          // cratering FPS from ~50 to ~12 with no scene-cost change.
          if (metricsRef.current) {
            const rendererInfo = (renderer.info as any).render;
            const newMetrics = metricsRef.current.updateMetrics(
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
              setMetrics(newMetrics);
            }
          }

          renderer.render(scene, camera);
        };

        animate();

        // Handle window resize
        const handleResize = () => {
          if (!cameraRef.current || !rendererRef.current) return;
          cameraRef.current.aspect = window.innerWidth / window.innerHeight;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        };

        window.addEventListener("resize", handleResize);

        return () => {
          window.removeEventListener("resize", handleResize);
          renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
        };
      } catch (err) {
        console.error("Failed to initialize production room:", err);
      }
    }

    initializeRoom();

    return () => {
      mounted = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.domElement.remove();
      }
      if (sceneRef.current) {
        sceneRef.current.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (obj.material instanceof THREE.Material) {
              obj.material.dispose();
            }
          }
        });
      }
    };
  }, [profile]);

  const handleResetView = () => {
    if (playerRef.current) {
      playerRef.current.position.set(0, 0, -5);
      playerMovementTargetRef.current = null;
      if (playerAnimationActionRef.current && playerAnimationMixerRef.current) {
        const clips = (playerRef.current as any).animations || [];
        const idleClip = clips.find((c: any) => c.name === "Idle");
        if (idleClip) {
          playerAnimationActionRef.current.stop();
          const idleAction = playerAnimationMixerRef.current.clipAction(idleClip);
          idleAction.reset();
          playerAnimationActionRef.current = idleAction;
          idleAction.play();
        }
      }
      // Write metrics synchronously so a test reading window.__EVERLOOM_
      // BAKEOFF__ immediately after the click (before the next rAF tick)
      // observes the reset state rather than stale in-flight values.
      if (metricsRef.current) {
        metricsRef.current.playerPosition = { x: 0, y: 0, z: -5 };
        metricsRef.current.movementTarget = null;
        metricsRef.current.currentPlayerAnimation = "Idle";
      }
    }
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
                onClick={() => setProfile("balanced")}
              >
                Balanced
              </button>
              <button
                className={profile === "quality" ? "active" : ""}
                onClick={() => setProfile("quality")}
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
                <span className="label">Calls</span>
                <span className="value">{metrics.renderer.calls}</span>
              </div>
              <div className="metric">
                <span className="label">Triangles</span>
                <span className="value">{(metrics.renderer.triangles / 1000).toFixed(0)}K</span>
              </div>
              <div className="metric">
                <span className="label">Textures</span>
                <span className="value">{metrics.renderer.textures}</span>
              </div>
              <div className="metric">
                <span className="label">Load</span>
                <span className="value">{metrics.loadMs}ms</span>
              </div>
              <div className="metric">
                <span className="label">Anim</span>
                <span className="value">{metrics.currentPlayerAnimation}</span>
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
