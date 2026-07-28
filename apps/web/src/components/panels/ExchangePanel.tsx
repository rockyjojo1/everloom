import { useGameStore } from "../../store/gameStore";
import { ITEMS } from "@everloom/gamedata";

// Synthetic market maker — algorithmic prices that drift on supply.
// In v1, this is a simple price table. Real offers slot in later.
const MARKET_PRICES: Record<string, number> = {
  pine_log: 4, willow_log: 7, oak_log: 20, charwood_log: 55,
  copper_ore: 5, tin_ore: 5, iron_ore: 22, coal: 30,
  raw_minnow: 3, raw_trout: 12, raw_perch: 25, raw_cave_eel: 60,
  cooked_minnow: 8, cooked_trout: 22, cooked_perch: 45, cooked_cave_eel: 90,
  bronze_bar: 25, iron_bar: 65,
  pine_board: 12, oak_board: 35,
  copper_rivet: 8, iron_rivet: 20,
  beast_sinew: 120, shadow_fragment: 200,
  birds_nest: 150, ancient_bark: 300,
  uncut_sapphire: 500, uncut_emerald: 800, uncut_ruby: 1200,
};

const ITEM_ICONS: Record<string, string> = {
  pine_log: "🪵", willow_log: "🌿", oak_log: "🌳", charwood_log: "🖤",
  copper_ore: "🟠", tin_ore: "⬜", iron_ore: "🔵", coal: "⚫",
  raw_minnow: "🐟", raw_trout: "🐠", raw_perch: "🫧", raw_cave_eel: "🐍",
  cooked_minnow: "🍖", cooked_trout: "🍗", cooked_perch: "🥩", cooked_cave_eel: "🍢",
  bronze_bar: "🥉", iron_bar: "⬜",
  pine_board: "🪵", oak_board: "🟫",
  copper_rivet: "🔩", iron_rivet: "🔩",
  beast_sinew: "🦴", shadow_fragment: "🫙",
  birds_nest: "🪺", ancient_bark: "🌿",
  uncut_sapphire: "💎", uncut_emerald: "💚", uncut_ruby: "❤️",
};

export function ExchangePanel() {
  const ps = useGameStore((s) => s.playerState);
  const addToast = useGameStore((s) => s.addToast);

  if (!ps) return null;

  // Items in bank that are tradeable with a market price.
  const sellable = ps.bank
    .filter((s) => {
      const item = ITEMS.find((i) => i.id === s.itemId);
      return item?.tradeable && MARKET_PRICES[s.itemId];
    })
    .map((s) => ({
      ...s,
      price: MARKET_PRICES[s.itemId] ?? 0,
      total: s.qty * (MARKET_PRICES[s.itemId] ?? 0),
      name: ITEMS.find((i) => i.id === s.itemId)?.name ?? s.itemId,
    }))
    .sort((a, b) => b.total - a.total);

  function sellAll(itemId: string) {
    addToast(`Sold! (Exchange integration coming soon)`, "normal");
  }

  return (
    <>
      <div className="panel-handle" />
      <div className="panel-title">⚖️ Exchange</div>
      <div className="panel-body">
        <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--walnut)", opacity: 0.7, marginBottom: 12 }}>
          The Loomhall Exchange. Prices set by the market maker — real player offers arrive later.
        </p>

        {sellable.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "32px 0",
            fontFamily: "var(--font-body)", fontSize: 14, color: "var(--walnut)", opacity: 0.5,
          }}>
            Your bank is empty.<br />Gather some resources first.
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--walnut)", opacity: 0.5, marginBottom: 8 }}>
              SELLABLE FROM BANK
            </div>
            {sellable.map((item) => (
              <div key={item.itemId} className="exchange-row">
                <span style={{ fontSize: 20 }}>{ITEM_ICONS[item.itemId] ?? "📦"}</span>
                <div style={{ flex: 1 }}>
                  <div className="item-name">{item.name}</div>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--walnut)", opacity: 0.6 }}>
                    {item.qty} × {item.price}gp = {item.total.toLocaleString()}gp
                  </div>
                </div>
                <button
                  className="btn btn-gold"
                  style={{ fontSize: 9, padding: "3px 8px" }}
                  onClick={() => sellAll(item.itemId)}
                >
                  Sell All
                </button>
              </div>
            ))}
          </>
        )}

        {/* Buy side — staples from market maker */}
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--walnut)", opacity: 0.5, margin: "16px 0 8px" }}>
          MARKET PRICES (REFERENCE)
        </div>
        {Object.entries(MARKET_PRICES).slice(0, 8).map(([itemId, price]) => {
          const item = ITEMS.find((i) => i.id === itemId);
          return (
            <div key={itemId} className="exchange-row">
              <span style={{ fontSize: 16 }}>{ITEM_ICONS[itemId] ?? "📦"}</span>
              <span className="item-name">{item?.name ?? itemId}</span>
              <span className="exchange-price">{price}gp</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
