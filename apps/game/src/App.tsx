import { lazy, Suspense, useEffect, useState } from "react";
import type { PlayerAppearanceId } from "@everloom/core";
import { CharacterCreatorPreview } from "./components/CharacterCreatorPreview";
import { DebugPanel } from "./components/DebugPanel";
import { EscapeIntro } from "./components/EscapeIntro";
import { Hud } from "./components/Hud";
import { OfflineReport } from "./components/OfflineReport";
import { WorldBoundary } from "./components/WorldBoundary";
import { useGameStore } from "./game/store";
import "./styles.css";
import "./phase-two.css";

const loadGameWorld = async () => {
  const module = await import("./world/GameWorld");
  return { default: module.GameWorld };
};

const GameWorld = lazy(loadGameWorld);

const AssetBrowser = lazy(async () => {
  const module = await import("./components/AssetBrowser");
  return { default: module.AssetBrowser };
});

const CloudAccount = lazy(async () => {
  const module = await import("./components/CloudAccount");
  return { default: module.CloudAccount };
});

// Development-only QA gallery: import and lazy load only in dev, completely tree-shaken from production.
const VisualQAGallery = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import("./components/VisualQAGallery");
      return { default: module.VisualQAGallery };
    })
  : (() => null as never);

// Development-only visual production workbench: asset pipeline status and debugging.
const VisualProductionWorkbench = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import("./components/VisualProductionWorkbench");
      return { default: module.VisualProductionWorkbench };
    })
  : (() => null as never);

const MeadowrestProductionRoom = lazy(async () => {
  const module = await import("./bakeoff/MeadowrestProductionRoom");
  return { default: module.MeadowrestProductionRoom };
});

export default function App() {
  const [characterName, setCharacterName] = useState("Wanderer");
  const [appearanceId, setAppearanceId] = useState<PlayerAppearanceId>("meadow");
  const status = useGameStore((state) => state.status);
  const save = useGameStore((state) => state.save);
  const error = useGameStore((state) => state.loadError);
  const initialize = useGameStore((state) => state.initialize);
  const beginIntro = useGameStore((state) => state.beginIntro);

  const searchParams = new URLSearchParams(location.search);
  const bakeoffMode = searchParams.get("bakeoff");
  const isMeadowrestBakeoff = bakeoffMode === "meadowrest";

  useEffect(() => {
    if (isMeadowrestBakeoff) return;
    void initialize();
  }, [initialize, isMeadowrestBakeoff]);

  useEffect(() => {
    if (isMeadowrestBakeoff) return;
    const persist = () => void useGameStore.getState().saveNow("lifecycle", true);
    const visibility = () => {
      if (document.hidden) persist();
      else void useGameStore.getState().resumeFromBackground();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", persist);
    const autosave = window.setInterval(() => void useGameStore.getState().saveNow("autosave"), 30_000);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", persist);
      clearInterval(autosave);
    };
  }, [isMeadowrestBakeoff]);

  if (new URLSearchParams(location.search).has("asset-browser")) return <Suspense fallback={<main className="loading"><div className="loom-mark" /><span>Opening the asset archive…</span></main>}><AssetBrowser /></Suspense>;
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("qa")) {
    const qaMode = new URLSearchParams(location.search).get("qa");
    if (qaMode === "gallery" && VisualQAGallery) {
      return <Suspense fallback={<main className="loading"><div className="loom-mark" /><span>Opening the QA gallery…</span></main>}><VisualQAGallery /></Suspense>;
    }
    if (qaMode === "visual-production" && VisualProductionWorkbench) {
      return <Suspense fallback={<main className="loading"><div className="loom-mark" /><span>Opening production workbench…</span></main>}><VisualProductionWorkbench /></Suspense>;
    }
  }
  if (isMeadowrestBakeoff) {
    return <Suspense fallback={<main className="loading"><div className="loom-mark" /><span>Preparing Meadowrest production room…</span></main>}><div data-everloom-authoritative-app="apps-game" data-everloom-bakeoff="meadowrest"><MeadowrestProductionRoom /></div></Suspense>;
  }
  if (status === "error") return <main className="fatal"><h1>The thread snagged.</h1><p>{error}</p><button onClick={() => location.reload()}>Try again</button></main>;
  if (status !== "ready" || !save) return <main className="loading"><div className="loom-mark" /><span>Weaving Meadowrest…</span></main>;

  const intro = !save.worldFlags.intro_seen;
  return <main className="game-shell">
    {!intro && <WorldBoundary>
      <Suspense fallback={<div className="world-loading" role="status">Preparing Meadowrest…</div>}>
        <GameWorld />
      </Suspense>
    </WorldBoundary>}
    <Hud />
    {!intro && <EscapeIntro />}
    <OfflineReport />
    <DebugPanel />
    {intro && <div className="modal-backdrop character-backdrop"><section className="intro character-creator glass">
      <span className="eyebrow">CREATE YOUR WANDERER</span><h1>Who washed ashore?</h1>
      <p>Choose the first look for your adventurer. You can change it later; your name is how Meadowrest will remember you.</p>
      <label className="character-name">Name
        <input aria-label="Character name" maxLength={18} value={characterName} onChange={(event) => setCharacterName(event.target.value)} />
      </label>
      <fieldset className="appearance-options">
        <legend>Travel colours</legend>
        {(["meadow", "ember", "tide", "dusk"] as const).map((id) =>
          <button key={id} type="button" className={appearanceId === id ? `appearance ${id} selected` : `appearance ${id}`}
            aria-pressed={appearanceId === id} onClick={() => setAppearanceId(id)}>
            <i><b /></i><span>{id}</span>
          </button>)}
      </fieldset>
      <CharacterCreatorPreview appearanceId={appearanceId} />
      <details className="cloud-details">
        <summary>Online account and cross-device saving</summary>
        <Suspense fallback={<small>Opening account options…</small>}><CloudAccount /></Suspense>
      </details>
      <div className="intro-notes"><span>Follow the gold trail</span><span>Equip tools from your Pack</span><span>Progress continues offline</span></div>
      <button className="primary" onPointerDown={() => void loadGameWorld()} onClick={() => beginIntro(characterName, appearanceId)}>Enter Meadowrest</button>
      <small className="character-save-note">Starts safely on this device. Account sync can be connected without replacing your local save.</small>
    </section></div>}
    <div className="rotate"><div className="loom-mark" /><h1>Turn to landscape</h1><p>Everloom is shaped for a wider view.</p></div>
  </main>;
}
