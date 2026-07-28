import { useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { Diorama } from "./Diorama";
import { ActionHUD } from "./ActionHUD";
import { TabStrip } from "./TabStrip";
import { InventoryBar } from "./InventoryBar";
import { SatchelPanel } from "./panels/SatchelPanel";
import { BenchPanel } from "./panels/BenchPanel";
import { AtlasPanel } from "./panels/AtlasPanel";
import { LedgerPanel } from "./panels/LedgerPanel";
import { ExchangePanel } from "./panels/ExchangePanel";

function Panels() {
  const activePanel = useGameStore((s) => s.activePanel);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  const panels: Record<string, React.ReactNode> = {
    satchel:  <SatchelPanel />,
    bench:    <BenchPanel />,
    atlas:    <AtlasPanel />,
    ledger:   <LedgerPanel />,
    exchange: <ExchangePanel />,
  };

  const isOpen = activePanel !== "none";

  return (
    <>
      {isOpen && (
        <div
          className="scrim active"
          onClick={() => setActivePanel("none")}
        />
      )}
      {Object.entries(panels).map(([id, content]) => (
        <div key={id} className={`panel compact-panel ${activePanel === id ? "open" : ""}`}>
          {content}
        </div>
      ))}
    </>
  );
}

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
      <Diorama />

      {/* Floating action HUD — top strip */}
      <ActionHUD />

      {/* Always-visible inventory bar — right side */}
      <InventoryBar />

      {/* Compact tab strip — bottom right */}
      <TabStrip />

      {/* Corner panels */}
      <Panels />

      {/* Toast notifications */}
      <Toasts />
    </div>
  );
}
