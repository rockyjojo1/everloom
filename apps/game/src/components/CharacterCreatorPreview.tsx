import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { PlayerAppearanceId } from "@everloom/core";
import { instantiateAsset } from "../world/assets";
import {
  APPEARANCE_ACCESSORY_BONES,
  buildAppearanceDecorations,
  getCharacterPresentation,
  type AccessorySlot,
} from "../world/characterPresentation";
import { disposeMaterial, disposeObject, disposeAnimationMixer, completeDisposal } from "../world/threeDisposal";

// A real rotating rig preview for the character creator, replacing the flat
// tint-swatch buttons previously used in App.tsx. Loads the same
// `player.adventurer` asset and the same `characterPresentation` decorator
// descriptors intended for world use (see world/characterPresentation.ts's
// adapter note) so this preview and the eventual GameWorld appearance render
// stay honestly in sync rather than diverging into two different looks.
//
// This component owns no gameplay state and mutates nothing outside its own
// canvas — it is presentation only.
export interface CharacterCreatorPreviewProps {
  readonly appearanceId: PlayerAppearanceId;
  readonly className?: string;
}

export function CharacterCreatorPreview({ appearanceId, className }: CharacterCreatorPreviewProps) {
  const host = useRef<HTMLDivElement>(null);
  const appearanceRef = useRef(appearanceId);
  appearanceRef.current = appearanceId;

  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    let disposed = false;
    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(0, 1.35, 3.5);
    camera.lookAt(0, 1.2, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      console.error("Creator preview WebGL initialization failed", error);
      element.textContent = "Preview unavailable on this device.";
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    element.appendChild(renderer.domElement);

    const key = new THREE.DirectionalLight(0xfff2df, 2.1);
    key.position.set(2.4, 3.2, 2.6);
    const fill = new THREE.AmbientLight(0xbcd7d6, 0.65);
    const rim = new THREE.DirectionalLight(0x9fd0e6, 0.5);
    rim.position.set(-2.2, 1.6, -2.4);
    scene.add(key, fill, rim);

    const rig = new THREE.Group();
    scene.add(rig);

    // Respond to reduced-motion preference changes at runtime.
    let reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let rotationSpeed = reducedMotion ? 0 : 0.55;
    const motionMediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
      rotationSpeed = reducedMotion ? 0 : 0.55;
    };
    if (motionMediaQuery) motionMediaQuery.addEventListener("change", onMotionChange);

    let dragging = false;
    let lastX = 0;

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      rotationSpeed = 0;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      rig.rotation.y += (event.clientX - lastX) * 0.012;
      lastX = event.clientX;
    };
    const onPointerUp = () => {
      dragging = false;
      rotationSpeed = reducedMotion ? 0 : 0.55;
    };
    const onPointerCancel = () => {
      dragging = false;
      rotationSpeed = reducedMotion ? 0 : 0.55;
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    let currentDecorations: Partial<Record<AccessorySlot, THREE.Group>> = {};
    let playerObject: THREE.Object3D | null = null;
    let playerMaterials: THREE.Material[] = [];
    let mixer: THREE.AnimationMixer | null = null;

    const applyDecorations = (object: THREE.Object3D, id: PlayerAppearanceId) => {
      // Dispose old decorations.
      for (const group of Object.values(currentDecorations)) {
        if (group) {
          disposeObject(group);
          group.removeFromParent();
        }
      }
      currentDecorations = buildAppearanceDecorations(id);
      // Attach new decorations.
      for (const [slot, bones] of Object.entries(APPEARANCE_ACCESSORY_BONES) as [AccessorySlot, readonly string[]][]) {
        const group = currentDecorations[slot];
        if (!group) continue;
        const bone = bones.map((name) => object.getObjectByName(name)).find(Boolean);
        bone?.add(group);
      }
    };

    // Load player model once and reuse it.
    const loadPlayerOnce = () => {
      void instantiateAsset("player.adventurer", getCharacterPresentation(appearanceRef.current).tint)
        .then(({ object, animations }) => {
          if (disposed) return;
          playerObject = object;

          // Hide showcase weapons.
          for (const name of ["1H_Sword", "1H_Sword_Offhand", "2H_Sword", "Badge_Shield", "Rectangle_Shield", "Round_Shield", "Spike_Shield"]) {
            const prop = object.getObjectByName(name);
            if (prop) prop.visible = false;
          }

          // Collect materials for tint changes.
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = false;
              if (Array.isArray(child.material)) {
                playerMaterials.push(...child.material);
              } else if (child.material) {
                playerMaterials.push(child.material);
              }
            }
          });

          rig.add(object);
          applyDecorations(object, appearanceRef.current);

          if (animations.length) {
            mixer = new THREE.AnimationMixer(object);
            const idleClip = animations.find((clip) => clip.name === "Idle") ?? animations[0]!;
            mixer.clipAction(idleClip).play();
          }
        })
        .catch((error) => console.warn("Creator preview player model failed", error));
    };

    loadPlayerOnce();

    let frame = 0;
    const clock = new THREE.Clock();
    const resize = () => {
      const width = element.clientWidth || 1;
      const height = element.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const delta = clock.getDelta();
      mixer?.update(delta);
      if (!dragging) rig.rotation.y += rotationSpeed * delta;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      completeDisposal({
        object: playerObject,
        mixer,
        renderer,
        animationFrameId: frame,
        resizeObserver: observer,
        eventListeners: [
          { target: renderer.domElement, event: "pointerdown", handler: onPointerDown as EventListener },
          { target: renderer.domElement, event: "pointercancel", handler: onPointerCancel as EventListener },
          { target: window, event: "pointermove", handler: onPointerMove as EventListener },
          { target: window, event: "pointerup", handler: onPointerUp as EventListener },
          { target: motionMediaQuery ?? window, event: "change", handler: onMotionChange as EventListener },
        ],
      });
      element.replaceChildren();
    };
  }, []);

  return <div ref={host} className={className ? `creator-preview ${className}` : "creator-preview"} role="img" aria-label="Rotating preview of the selected character appearance" />;
}
