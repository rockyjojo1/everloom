import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CONTENT } from "@everloom/content";
import type { PlayerAppearanceId } from "@everloom/core";
import { instantiateAsset } from "../world/assets";
import { getCharacterPresentation } from "../world/characterPresentation";
import { QA_GALLERY_ITEM_IDS, getEquipmentTransform } from "../world/equipmentPresentation";
import { disposeMaterial, disposeObject, disposeAnimationMixer, completeDisposal } from "../world/threeDisposal";
import styles from "./VisualQAGallery.module.css";

// Non-gameplay-mutating visual QA gallery: loads the real player rig (same
// `player.adventurer` asset GameWorld.tsx uses) and attaches each of the
// five required gameplay items to the real `handslotr` hand socket using
// the calibrated transforms in world/equipmentPresentation.ts, showing idle
// and the item's relevant action pose. It never touches useGameStore or any
// save data — it is evidence of what the equipment looks like on the rig,
// not a real player flow, and must not be presented as one.
//
// Development/QA use only. Mounted behind the `?qa=gallery` query flag in
// App.tsx (see that file's isolated commit).
export function VisualQAGallery() {
  const host = useRef<HTMLDivElement>(null);
  const [itemIndex, setItemIndex] = useState(0);
  const [posed, setPosed] = useState(false);
  const [appearanceId, setAppearanceId] = useState<PlayerAppearanceId>("meadow");
  const itemIndexRef = useRef(itemIndex);
  const posedRef = useRef(posed);
  const callbacksRef = useRef<{ refreshEquipped?: (() => void) | undefined; replayAnimation?: (() => void) | undefined }>({});
  itemIndexRef.current = itemIndex;
  posedRef.current = posed;

  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    let disposed = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2f33);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    camera.position.set(-1.7, 1.35, 3.5);
    camera.lookAt(-0.35, 0.85, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (error) {
      console.error("QA gallery WebGL initialization failed", error);
      element.textContent = "Gallery unavailable on this device.";
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    element.appendChild(renderer.domElement);

    const key = new THREE.DirectionalLight(0xfff2df, 2.2);
    key.position.set(2.4, 3.4, 2.6);
    scene.add(key, new THREE.AmbientLight(0xbcd7d6, 0.7));

    let handSlot: THREE.Object3D | null = null;
    let equippedObject: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let clips: THREE.AnimationClip[] = [];
    let currentAction: THREE.AnimationAction | null = null;
    let equipSequence = 0;

    const playClip = (name: string) => {
      if (!mixer) return;
      const clip = clips.find((c) => c.name === name) ?? clips.find((c) => c.name === "Idle");
      if (!clip) return;
      currentAction?.stop();
      currentAction = mixer.clipAction(clip);
      currentAction.reset().play();
    };

    const refreshEquipped = () => {
      const itemId = QA_GALLERY_ITEM_IDS[itemIndexRef.current]!;
      equipSequence += 1;
      const sequence = equipSequence;

      // Dispose old equipped object.
      if (equippedObject) {
        disposeObject(equippedObject);
        equippedObject.removeFromParent();
      }
      equippedObject = null;

      const transform = getEquipmentTransform(itemId);
      const assetId = CONTENT.items[itemId]?.worldAssetId;
      if (!transform || !assetId || !handSlot) return;
      void instantiateAsset(assetId).then(({ object }) => {
        if (disposed || sequence !== equipSequence || !handSlot) return;
        object.position.set(...transform.position);
        object.rotation.set(...transform.rotation);
        object.scale.multiplyScalar(transform.scale);
        handSlot.add(object);
        equippedObject = object;
        playClip(posedRef.current ? transform.actionClip : "Idle");
      });
    };

    const replayAnimation = () => {
      const itemId = QA_GALLERY_ITEM_IDS[itemIndexRef.current]!;
      const transform = getEquipmentTransform(itemId);
      if (transform) playClip(posedRef.current ? transform.actionClip : "Idle");
    };

    callbacksRef.current.refreshEquipped = refreshEquipped;
    callbacksRef.current.replayAnimation = replayAnimation;

    let rigGroup: THREE.Object3D | null = null;
    void instantiateAsset("player.adventurer", getCharacterPresentation(appearanceId).tint)
      .then(({ object, animations }) => {
        if (disposed) return;
        rigGroup = object;
        for (const name of ["1H_Sword", "1H_Sword_Offhand", "2H_Sword", "Badge_Shield", "Rectangle_Shield", "Round_Shield", "Spike_Shield"]) {
          const prop = object.getObjectByName(name);
          if (prop) prop.visible = false;
        }
        handSlot = object.getObjectByName("handslotr") ?? object.getObjectByName("handr") ?? null;
        scene.add(object);
        clips = animations;
        if (animations.length) {
          mixer = new THREE.AnimationMixer(object);
          playClip("Idle");
        }
        refreshEquipped();
      })
      .catch((error) => console.warn("QA gallery player model failed", error));

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
      mixer?.update(clock.getDelta());
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      callbacksRef.current.refreshEquipped = undefined;
      callbacksRef.current.replayAnimation = undefined;
      // Stop all animations and dispose mixer.
      if (currentAction) currentAction.stop();
      disposeAnimationMixer(mixer);
      // Dispose equipped object.
      if (equippedObject) {
        disposeObject(equippedObject);
      }
      // Dispose rig and all its resources.
      if (rigGroup) {
        disposeObject(rigGroup);
      }
      completeDisposal({
        renderer,
        animationFrameId: frame,
        resizeObserver: observer,
      });
      element.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearanceId]);

  // Refresh equipped item when item changes.
  useEffect(() => {
    callbacksRef.current.refreshEquipped?.();
  }, [itemIndex]);

  // Replay animation when pose changes.
  useEffect(() => {
    callbacksRef.current.replayAnimation?.();
  }, [posed]);

  const currentItemId = QA_GALLERY_ITEM_IDS[itemIndex]!;
  const transform = getEquipmentTransform(currentItemId);

  return <section className={styles.gallery} aria-label="Equipment visual QA gallery">
    <div className={styles.canvas} ref={host} />
    <div className={styles.controls}>
      <div className={styles.items}>
        {QA_GALLERY_ITEM_IDS.map((id, index) => <button key={id} type="button"
          className={index === itemIndex ? styles.selected : undefined}
          onClick={() => setItemIndex(index)}>{CONTENT.items[id]?.name ?? id}</button>)}
      </div>
      <div className={styles.appearance}>
        {(["meadow", "ember", "tide", "dusk"] as const).map((id) =>
          <button key={id} type="button" className={id === appearanceId ? styles.selected : undefined} onClick={() => setAppearanceId(id)}>{id}</button>)}
      </div>
      <button type="button" className={styles.pose} onClick={() => setPosed((value) => !value)}>
        {posed ? `Showing action pose (${transform?.actionClip ?? "?"})` : "Showing idle pose"}
      </button>
    </div>
  </section>;
}
