import { lazy, Suspense, useEffect } from "react";
import { DebugPanel } from "./components/DebugPanel";
import { Hud } from "./components/Hud";
import { OfflineReport } from "./components/OfflineReport";
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

export default function App() {
  const status = useGameStore((state) => state.status);
  const save = useGameStore((state) => state.save);
  const error = useGameStore((state) => state.loadError);
  const initialize = useGameStore((state) => state.initialize);
  const beginIntro = useGameStore((state) => state.beginIntro);

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => {
    const persist = () => void useGameStore.getState().saveNow("lifecycle", true);
    const visibility = () => { if (document.hidden) persist(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", persist);
    const autosave = window.setInterval(() => void useGameStore.getState().saveNow("autosave"), 30_000);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", persist);
      clearInterval(autosave);
    };
  }, []);

  if (new URLSearchParams(location.search).has("asset-browser")) return <Suspense fallback={<main className="loading"><div className="loom-mark" /><span>Opening the asset archive…</span></main>}><AssetBrowser /></Suspense>;
  if (status === "error") return <main className="fatal"><h1>The thread snagged.</h1><p>{error}</p><button onClick={() => location.reload()}>Try again</button></main>;
  if (status !== "ready" || !save) return <main className="loading"><div className="loom-mark" /><span>Weaving Meadowrest…</span></main>;

  const intro = !save.worldFlags.intro_seen;
  return <main className="game-shell">
    {!intro && <Suspense fallback={<div className="world-loading" role="status">Preparing Meadowrest…</div>}>
      <GameWorld />
    </Suspense>}
    <Hud />
    <OfflineReport />
    <DebugPanel />
    {intro && <div className="modal-backdrop"><section className="intro glass">
      <span className="eyebrow">A LOCAL-FIRST ADVENTURE</span><h1>Meadowrest remembers.</h1>
      <p>The First Loomstone has gone quiet. Mara waits in the village circle, and every path begins with a tool left close at hand.</p>
      <div className="intro-notes"><span>Tap the ground to move</span><span>Tap people and resources to act</span><span>Your progress stays on this device</span></div>
      <button className="primary" onPointerDown={() => void loadGameWorld()} onClick={beginIntro}>Enter Meadowrest</button>
    </section></div>}
    <div className="rotate"><div className="loom-mark" /><h1>Turn to landscape</h1><p>Everloom is shaped for a wider view.</p></div>
  </main>;
}
