import { useGameStore } from "../../store/gameStore";
import { ITEMS } from "@everloom/gamedata";
import { levelFromXp } from "@everloom/engine";

const ITEM_ICONS: Record<string, string> = {
  pine_log: "🪵", willow_log: "🌿", oak_log: "🌳", charwood_log: "🖤",
  copper_ore: "🟠", tin_ore: "⬜", iron_ore: "🔵", coal: "⚫",
  raw_minnow: "🐟", raw_trout: "🐠", raw_perch: "🫧", raw_cave_eel: "🐍",
  cooked_minnow: "🍖", cooked_trout: "🍗", cooked_perch: "🥩", cooked_cave_eel: "🍢",
  bronze_bar: "🥉", iron_bar: "⬜",
  pine_board: "🪵", oak_board: "🟫",
  willow_shaft: "📏", oak_shaft: "📏",
  copper_rivet: "🔩", iron_rivet: "🔩",
  rough_binding: "🧵", leather_binding: "🪢", leather_strip: "🩹",
  rope: "🪢", lantern: "🏮",
  beast_sinew: "🦴", shadow_fragment: "🫙",
  birds_nest: "🪺", ancient_bark: "🌿",
  uncut_sapphire: "💎", uncut_emerald: "💚", uncut_ruby: "❤️",
  satchel_small: "🎒", satchel_medium: "💼", satchel_large: "🧳",
  copper_pickaxe_head: "⛏️", iron_pickaxe_head: "⛏️",
  copper_hatchet_head: "🪓", iron_hatchet_head: "🪓",
  copper_rod_tip: "🎣", iron_rod_tip: "🎣",
  pine_haft: "📏", oak_haft: "📏",
  bronze_helm: "⛑️", bronze_body: "🥇", bronze_legs: "🩱",
  iron_helm: "⛑️", iron_body: "🥇", iron_legs: "🩱",
  courier_token: "🏷️",
  campfire_charge: "🔥",
};

function getIcon(itemId: string): string {
  return ITEM_ICONS[itemId] ?? "📦";
}

export function SatchelPanel() {
  const ps = useGameStore((s) => s.playerState);
  if (!ps) return null;

  const cookingLevel = levelFromXp(ps.skills.cooking ?? 0);
  const larderCap = 20 + Math.floor(cookingLevel * cookingLevel * 0.3);
  const larderQty = ps.larder.reduce((a, e) => a + e.qty, 0);

  const emptySlots = ps.slots - ps.inventory.length;

  return (
    <>
      <div className="panel-handle" />
      <div className="panel-title">🎒 Satchel</div>
      <div className="panel-body">
        {/* Skills quick view */}
        <div className="skills-grid" style={{ marginBottom: 12 }}>
          {(Object.entries(ps.skills) as Array<[string, number]>)
            .filter(([, xp]) => xp > 0)
            .map(([skill, xp]) => (
              <div key={skill} className="skill-badge">
                <span className="skill-level">{levelFromXp(xp)}</span>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.7, textTransform: "capitalize" }}>
                  {skill}
                </span>
              </div>
            ))
          }
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-chip">❤️ {ps.combat.hp}/{ps.combat.maxHp}</div>
          <div className="stat-chip">✨ {ps.motes} Motes</div>
          <div className="stat-chip">🛡️ {ps.combat.defenceRating}</div>
          <div className="stat-chip">🎒 {ps.inventory.length}/{ps.slots}</div>
        </div>

        {/* Inventory */}
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--walnut)", opacity: 0.6, marginBottom: 6 }}>
          SATCHEL — {ps.inventory.length}/{ps.slots} SLOTS
        </div>
        <div className="inv-grid" style={{ marginBottom: 12 }}>
          {ps.inventory.map((stack, i) => {
            const itemData = ITEMS.find((it) => it.id === stack.itemId);
            return (
              <div key={i} className="inv-slot">
                <span className="item-icon">{getIcon(stack.itemId)}</span>
                <span className="item-qty">{stack.qty > 1 ? stack.qty : ""}</span>
              </div>
            );
          })}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`empty-${i}`} className="inv-slot empty">
              <span style={{ fontSize: 10, opacity: 0.3 }}>·</span>
            </div>
          ))}
        </div>

        {/* Larder */}
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--walnut)", opacity: 0.6, marginBottom: 6 }}>
          LARDER — {larderQty}/{larderCap} PORTIONS
        </div>
        <div className="progress-wrap" style={{ marginBottom: 8 }}>
          <div className="progress-fill green" style={{ width: `${(larderQty / larderCap) * 100}%` }} />
        </div>
        <div className="inv-grid" style={{ marginBottom: 12 }}>
          {ps.larder.map((entry, i) => (
            <div key={i} className="inv-slot">
              <span className="item-icon">{getIcon(entry.itemId)}</span>
              <span className="item-qty">{entry.qty}</span>
            </div>
          ))}
        </div>

        {/* Bank */}
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--walnut)", opacity: 0.6, marginBottom: 6 }}>
          BANK — {ps.bank.length} STACKS
        </div>
        <div className="inv-grid">
          {ps.bank.map((stack, i) => (
            <div key={i} className="inv-slot">
              <span className="item-icon">{getIcon(stack.itemId)}</span>
              <span className="item-qty">{stack.qty > 999 ? `${Math.floor(stack.qty / 1000)}k` : stack.qty}</span>
            </div>
          ))}
        </div>

        {/* Couriers */}
        {ps.couriers.length > 0 && (
          <>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--walnut)", opacity: 0.6, margin: "12px 0 6px" }}>
              COURIERS
            </div>
            {ps.couriers.map((c) => (
              <div key={c.id} className="courier-card">
                <span className="courier-icon">🧑‍🦯</span>
                <div className="courier-info">
                  <div className="courier-name">{c.name}</div>
                  <div className="courier-status">
                    {c.state === "idle" ? `Resting. ${c.personality}` :
                     c.state === "outbound" ? `Running to the bank (${c.etaSeconds}s)` :
                     `Returning (${c.etaSeconds}s)`}
                  </div>
                </div>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--lichen)" }}>
                  {c.tripsCompleted} trips
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
