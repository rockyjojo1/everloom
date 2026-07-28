import { useGameStore } from "../store/gameStore";

const ITEM_ICONS: Record<string, string> = {
  pine_log: "🪵", willow_log: "🌿", oak_log: "🌳", charwood_log: "🖤",
  copper_ore: "🟠", tin_ore: "⬜", iron_ore: "🔵", coal: "⚫",
  raw_minnow: "🐟", raw_trout: "🐠", raw_perch: "🫧", raw_cave_eel: "🐍",
  cooked_minnow: "🍖", cooked_trout: "🍗", cooked_perch: "🥩", cooked_cave_eel: "🍢",
  bronze_bar: "🥉", iron_bar: "⬜",
  pine_board: "🪵", oak_board: "🟫",
  willow_shaft: "📏", oak_shaft: "📏",
  copper_rivet: "🔩", iron_rivet: "🔩",
  rough_binding: "🧵", leather_binding: "🪢",
  rope: "🪢", lantern: "🏮",
  birds_nest: "🪺", ancient_bark: "🌿",
  uncut_sapphire: "💎", uncut_emerald: "💚", uncut_ruby: "❤️",
  campfire_charge: "🔥",
  courier_token: "🏷️",
};

function getIcon(itemId: string): string {
  return ITEM_ICONS[itemId] ?? "📦";
}

export function InventoryBar() {
  const ps = useGameStore((s) => s.playerState);
  if (!ps) return null;

  const emptySlots = ps.slots - ps.inventory.length;

  return (
    <div style={{
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: "var(--inv-rail)",
      background: "rgba(74,55,40,0.94)",
      borderLeft: "3px solid #1E2430",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "8px 2px calc(8px + env(safe-area-inset-bottom))",
      gap: 2,
      overflowY: "auto",
      zIndex: 50,
      backdropFilter: "blur(2px)",
    }}>
      <div style={{
        fontFamily: "var(--font-ui)",
        fontSize: 10,
        color: "#D9A441",
        textAlign: "center",
        width: "100%",
        paddingBottom: 4,
        borderBottom: "1px solid rgba(232,220,196,0.2)",
      }}>
        🎒
        <div style={{ fontSize: 9, color: "#E8DCC4", marginTop: 2 }}>
          {ps.inventory.length}/{ps.slots}
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 2,
        width: "100%",
        flex: 1,
        overflowY: "auto",
        padding: 4,
      }}>
        {ps.inventory.map((stack, i) => (
          <div
            key={i}
            style={{
              aspectRatio: "1",
              background: "rgba(232,220,196,0.15)",
              border: "1px solid rgba(232,220,196,0.3)",
              borderRadius: 3,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              position: "relative",
              cursor: "pointer",
              transition: "background 0.1s, border-color 0.1s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#D9A441";
              (e.currentTarget as HTMLElement).style.background = "rgba(217,164,65,0.2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,220,196,0.3)";
              (e.currentTarget as HTMLElement).style.background = "rgba(232,220,196,0.15)";
            }}
          >
            {getIcon(stack.itemId)}
            {stack.qty > 1 && (
              <div style={{
                position: "absolute",
                bottom: 0,
                right: 1,
                fontFamily: "var(--font-ui)",
                fontSize: 7,
                color: "#D9A441",
                textShadow: "0 0 2px #1E2430",
              }}>
                {stack.qty > 99 ? "99+" : stack.qty}
              </div>
            )}
          </div>
        ))}

        {Array.from({ length: emptySlots }).map((_, i) => (
          <div
            key={`empty-${i}`}
            style={{
              aspectRatio: "1",
              background: "rgba(232,220,196,0.05)",
              border: "1px dashed rgba(232,220,196,0.15)",
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "rgba(232,220,196,0.2)",
            }}
          >
            ·
          </div>
        ))}
      </div>
    </div>
  );
}
