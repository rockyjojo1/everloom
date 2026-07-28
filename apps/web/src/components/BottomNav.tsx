import { useGameStore, type ActivePanel } from "../store/gameStore";

const NAV_ITEMS: Array<{ id: ActivePanel; icon: string; label: string }> = [
  { id: "satchel",  icon: "🎒", label: "Satchel"  },
  { id: "bench",    icon: "🔨", label: "Bench"     },
  { id: "atlas",    icon: "🗺️",  label: "Atlas"    },
  { id: "ledger",   icon: "📖", label: "Ledger"   },
  { id: "exchange", icon: "⚖️",  label: "Exchange" },
];

export function BottomNav() {
  const activePanel = useGameStore((s) => s.activePanel);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  function toggle(id: ActivePanel) {
    setActivePanel(activePanel === id ? "none" : id);
  }

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`nav-btn ${activePanel === item.id ? "active" : ""}`}
          onClick={() => toggle(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
