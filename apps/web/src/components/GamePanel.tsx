import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { levelFromXp, masteryLevelFromXp, XP_TABLE, MASTERY_TABLE } from "@everloom/engine";
import { NODES } from "@everloom/gamedata";
import type { SkillId } from "@everloom/engine";

// Import tab content
import { SatchelPanel } from "./panels/SatchelPanel";
import { EquipmentPanel } from "./panels/EquipmentPanel";
import { BenchPanel } from "./panels/BenchPanel";
import { AtlasPanel } from "./panels/AtlasPanel";
import { LedgerPanel } from "./panels/LedgerPanel";
import { ExchangePanel } from "./panels/ExchangePanel";

const SKILL_ICONS: Record<SkillId, string> = {
  woodcutting: "🪓", mining: "⛏️", fishing: "🎣",
  crafting: "🔨", smithing: "⚒️", fletching: "🪶",
  cooking: "🍳", combat: "⚔️", wayfaring: "🧭", slayer: "🗡️",
};

type TabId = "inventory" | "equipment" | "skills" | "bench" | "atlas" | "ledger" | "exchange";

const TABS: Array<{ id: TabId; icon: string; label: string }> = [
  { id: "inventory",  icon: "🎒", label: "Inventory" },
  { id: "equipment",  icon: "⚔️", label: "Equipment" },
  { id: "skills",     icon: "📊", label: "Skills" },
  { id: "bench",      icon: "🔨", label: "Bench" },
  { id: "atlas",      icon: "🗺️",  label: "Atlas" },
  { id: "ledger",     icon: "📖", label: "Ledger" },
  { id: "exchange",   icon: "⚖️",  label: "Exchange" },
];

function SkillsTabContent() {
  const ps = useGameStore((s) => s.playerState);
  if (!ps) return null;

  const skillIds: SkillId[] = [
    "woodcutting", "mining", "fishing", "crafting", "smithing",
    "fletching", "cooking", "combat", "wayfaring", "slayer"
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
      {skillIds.map((skill) => {
        const xp = ps.skills[skill] ?? 0;
        const level = levelFromXp(xp);
        const nextXp = XP_TABLE[level + 1] ?? xp;
        const thisXp = XP_TABLE[level] ?? 0;
        const pct = nextXp > thisXp ? Math.floor(((xp - thisXp) / (nextXp - thisXp)) * 100) : 100;

        return (
          <div key={skill} style={{ padding: "0 4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                <span>{SKILL_ICONS[skill]}</span>
                <span style={{ textTransform: "capitalize" }}>{skill.replace(/_/g, " ")}</span>
              </span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, opacity: 0.7 }}>Lv {level}</span>
            </div>
            <div className="progress-wrap" style={{ marginBottom: 2 }}>
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GamePanel() {
  const ps = useGameStore((s) => s.playerState);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("inventory");

  if (!ps) return null;

  // Compact HUD data
  const action = ps.currentAction;
  const isIdle = action.type === "idle";
  const skill = action.type as SkillId;
  const skillXp = ps.skills[skill] ?? 0;
  const lvl = levelFromXp(skillXp);
  const nextXp = XP_TABLE[lvl + 1] ?? skillXp;
  const thisXp = XP_TABLE[lvl] ?? 0;
  const skillPct = nextXp > thisXp ? Math.floor(((skillXp - thisXp) / (nextXp - thisXp)) * 100) : 100;
  const nodeId = action.nodeId;
  const nodeName = nodeId ? (NODES.find((n) => n.id === nodeId)?.name ?? nodeId) : "—";

  const renderTabContent = () => {
    switch (activeTab) {
      case "inventory":
        return <SatchelPanel />;
      case "equipment":
        return <EquipmentPanel />;
      case "skills":
        return <SkillsTabContent />;
      case "bench":
        return <BenchPanel />;
      case "atlas":
        return <AtlasPanel />;
      case "ledger":
        return <LedgerPanel />;
      case "exchange":
        return <ExchangePanel />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Compact top-left HUD */}
      {!isIdle && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 50,
            background: "rgba(0,0,0,0.7)",
            border: "1px solid var(--walnut)",
            borderRadius: 4,
            padding: 8,
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            color: "white",
            maxWidth: 240,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>{SKILL_ICONS[skill]}</span>
            <div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>{nodeName}</div>
              <div style={{ fontSize: 9, opacity: 0.6 }}>Lv {lvl}</div>
            </div>
          </div>
          <div className="progress-wrap" style={{ height: 4, marginBottom: 4 }}>
            <div className="progress-fill" style={{ width: `${skillPct}%` }} />
          </div>
          <div style={{ fontSize: 9, opacity: 0.7, textAlign: "center" }}>
            {skillPct}% to next level
          </div>
        </div>
      )}

      {/* Stone tab bar */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          zIndex: 100,
          display: "grid",
          gridTemplateColumns: "repeat(1, 48px)",
          gap: 4,
          padding: 6,
          background: "rgba(100, 90, 80, 0.8)",
          border: "2px solid var(--walnut)",
          borderRadius: 4,
          boxShadow: "inset 0 0 4px rgba(0,0,0,0.5)",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (isOpen && activeTab === tab.id) {
                setIsOpen(false);
              } else {
                setActiveTab(tab.id);
                setIsOpen(true);
              }
            }}
            title={tab.label}
            style={{
              width: 48,
              height: 48,
              border: `2px solid ${activeTab === tab.id && isOpen ? "var(--gold)" : "var(--walnut)"}`,
              background: activeTab === tab.id && isOpen ? "rgba(200, 160, 80, 0.4)" : "rgba(80, 70, 60, 0.6)",
              color: "white",
              fontSize: 20,
              cursor: "pointer",
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
              boxShadow: activeTab === tab.id && isOpen ? "inset 0 0 6px rgba(200, 160, 80, 0.4)" : "none",
            }}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {/* Main panel (open state) */}
      {isOpen && (
        <>
          {/* Scrim (click to close) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 99,
              background: "rgba(0,0,0,0.3)",
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Panel container */}
          <div
            style={{
              position: "absolute",
              bottom: 70,
              right: 8,
              zIndex: 101,
              width: `min(340px, 62vw)`,
              height: `min(420px, 58vh)`,
              background: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><rect fill=\"%23F5DEB3\" width=\"100\" height=\"100\"/><circle cx=\"5\" cy=\"5\" r=\"2\" fill=\"%238B7355\" opacity=\"0.3\"/><circle cx=\"95\" cy=\"95\" r=\"2\" fill=\"%238B7355\" opacity=\"0.3\"/></svg>')",
              backgroundSize: "20px 20px",
              border: "3px solid var(--walnut)",
              borderRadius: 2,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: "slideUp 0.2s ease-out",
            }}
          >
            {/* Corner rivets */}
            <div
              style={{
                position: "absolute",
                top: -2,
                left: -2,
                width: 12,
                height: 12,
                background: "radial-gradient(circle at 30% 30%, #ccc, #999)",
                borderRadius: "50%",
                boxShadow: "inset -1px -1px 2px rgba(0,0,0,0.5)",
                zIndex: 1,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 12,
                height: 12,
                background: "radial-gradient(circle at 30% 30%, #ccc, #999)",
                borderRadius: "50%",
                boxShadow: "inset -1px -1px 2px rgba(0,0,0,0.5)",
                zIndex: 1,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -2,
                left: -2,
                width: 12,
                height: 12,
                background: "radial-gradient(circle at 30% 30%, #ccc, #999)",
                borderRadius: "50%",
                boxShadow: "inset -1px -1px 2px rgba(0,0,0,0.5)",
                zIndex: 1,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 12,
                height: 12,
                background: "radial-gradient(circle at 30% 30%, #ccc, #999)",
                borderRadius: "50%",
                boxShadow: "inset -1px -1px 2px rgba(0,0,0,0.5)",
                zIndex: 1,
              }}
            />

            {/* Panel header */}
            <div
              style={{
                padding: "12px 12px 0",
                borderBottom: "1px solid rgba(139, 115, 85, 0.3)",
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                color: "var(--walnut)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {TABS.find((t) => t.id === activeTab)?.label}
            </div>

            {/* Tab content (scrollable) */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                overflowX: "hidden",
                padding: 12,
              }}
              className="panel-content"
            >
              {renderTabContent()}
            </div>
          </div>
        </>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .panel-content {
          scrollbar-width: thin;
          scrollbar-color: rgba(139, 115, 85, 0.4) rgba(139, 115, 85, 0.1);
        }

        .panel-content::-webkit-scrollbar {
          width: 6px;
        }

        .panel-content::-webkit-scrollbar-track {
          background: rgba(139, 115, 85, 0.1);
        }

        .panel-content::-webkit-scrollbar-thumb {
          background: rgba(139, 115, 85, 0.4);
          border-radius: 3px;
        }

        .panel-content::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 115, 85, 0.6);
        }
      `}</style>
    </>
  );
}
