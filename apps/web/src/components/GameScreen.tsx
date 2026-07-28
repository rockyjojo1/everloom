import { useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { WorldCanvas } from "./WorldCanvas";
import { GamePanel } from "./GamePanel";

function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  return (
    <>
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.message}
        </div>
      ))}
    </>
  );
}

export function GameScreen() {
  const tickFrame    = useGameStore((s) => s.tickFrame);
  const shaking      = useGameStore((s) => s.shaking);
  const commitToServer = useGameStore((s) => s.commitToServer);

  useEffect(() => {
    const id = setInterval(tickFrame, 1000 / 30);
    return () => clearInterval(id);
  }, [tickFrame]);

  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === "hidden") void commitToServer();
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [commitToServer]);

  useEffect(() => {
    const handle = () => void commitToServer();
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [commitToServer]);

  return (
    <div
      style={{ height: "100%", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}
      className={shaking ? "shake" : ""}
    >
      {/* Scene fills entire viewport */}
      <WorldCanvas />

      {/* Unified game panel with HUD, tabs, and inventory */}
      <GamePanel />

      {/* Toast notifications */}
      <Toasts />
    </div>
  );
}
