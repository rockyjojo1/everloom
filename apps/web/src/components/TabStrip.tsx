import { useGameStore, type ActivePanel } from "../store/gameStore";

const TABS: Array<{ id: ActivePanel; icon: string; label: string }> = [
  { id: "satchel",  icon: "🎒", label: "Satchel"  },
  { id: "bench",    icon: "🔨", label: "Bench"     },
  { id: "atlas",    icon: "🗺️",  label: "Atlas"    },
  { id: "ledger",   icon: "📖", label: "Ledger"   },
  { id: "exchange", icon: "⚖️",  label: "Exchange" },
];

export function TabStrip() {
  const activePanel = useGameStore((s) => s.activePanel);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  function toggle(id: ActivePanel) {
    setActivePanel(activePanel === id ? "none" : id);
  }

  return (
    <nav className="tab-strip">
      {TABS.map((tab) => {
        const isActive = activePanel === tab.id;
        return (
          <button
            key={tab.id}
            className={`tab-btn ${isActive ? "active" : ""}`}
            onClick={() => toggle(tab.id)}
            title={tab.label}
          >
            <span className="tab-icon">{tab.icon}</span>
            {isActive && <span className="tab-label">{tab.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
