import { useGameStore } from "../../store/gameStore";
import { LEDGER, ITEMS } from "@everloom/gamedata";

function countInAll(ps: { inventory: readonly { itemId: string; qty: number }[]; bank: readonly { itemId: string; qty: number }[] }, itemId: string): number {
  const inv = ps.inventory.find((s) => s.itemId === itemId)?.qty ?? 0;
  const bank = ps.bank.find((s) => s.itemId === itemId)?.qty ?? 0;
  return inv + bank;
}

export function LedgerPanel() {
  const ps = useGameStore((s) => s.playerState);
  const submitLedgerBundle = useGameStore((s) => s.submitLedgerBundle);
  if (!ps) return null;

  return (
    <>
      <div className="panel-handle" />
      <div className="panel-title">📖 Ledger of Deeds</div>
      <div className="panel-body">
        <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--walnut)", opacity: 0.7, marginBottom: 12 }}>
          Complete bundles to earn permanent world upgrades. Items from satchel and bank both count.
        </p>

        {/* One-time bundles */}
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--walnut)", opacity: 0.5, marginBottom: 8 }}>
          BUNDLES — PERMANENT REWARDS
        </div>
        {LEDGER.bundles.map((bundle) => {
          const completed = ps.completedBundleIds.includes(bundle.id);
          const progress = bundle.items.map((req) => ({
            ...req,
            have: Math.min(countInAll(ps, req.itemId), req.qty),
            name: ITEMS.find((i) => i.id === req.itemId)?.name ?? req.itemId,
          }));
          const allReady = progress.every((p) => p.have >= p.qty);

          return (
            <div key={bundle.id} className={`bundle-card ${completed ? "completed" : ""}`}>
              <h4>
                {completed ? "✅ " : allReady ? "🔔 " : ""}{bundle.name}
              </h4>
              <p>{bundle.description}</p>
              <div style={{
                fontFamily: "var(--font-body)", fontSize: 11,
                color: "var(--lichen)", marginBottom: 6,
              }}>
                Reward: {bundle.rewardDescription}
              </div>

              {progress.map((p) => (
                <div key={p.itemId} className="bundle-item-row">
                  <span>{p.name}</span>
                  <span className={p.have >= p.qty ? "qty-have" : "qty-need"}>
                    {p.have}/{p.qty}
                  </span>
                </div>
              ))}

              {!completed && allReady && (
                <button
                  className="btn btn-gold"
                  style={{ width: "100%", marginTop: 8, fontSize: 10 }}
                  onClick={() => submitLedgerBundle(bundle.id)}
                >
                  Hand In
                </button>
              )}
              {completed && (
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--lichen)", marginTop: 4 }}>
                  Completed ✓
                </div>
              )}
            </div>
          );
        })}

        {/* Weekly contracts */}
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--walnut)", opacity: 0.5, margin: "16px 0 8px" }}>
          WEEKLY CONTRACTS — MOTE REWARDS
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--walnut)", opacity: 0.6, marginBottom: 8 }}>
          Rotate each week. Complete for Motes — used to buy structural upgrades (Courier slots, Pattern slots).
        </p>
        {LEDGER.weeklyContracts.map((contract) => {
          const done = ps.completedWeeklyContractIds.includes(contract.id);
          const req = contract.items[0];
          const have = req ? Math.min(countInAll(ps, req.itemId), req.qty) : 0;
          const reqName = req ? (ITEMS.find((i) => i.id === req.itemId)?.name ?? req.itemId) : "";

          return (
            <div key={contract.id} style={{
              border: "1px solid var(--walnut)",
              borderRadius: 4, padding: "8px 10px", marginBottom: 6,
              background: done ? "rgba(94,115,80,0.1)" : "var(--linen)",
              opacity: done ? 0.6 : 1,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 11 }}>{contract.name}</span>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--weld)" }}>
                  ✨ {contract.rewardMotes} Motes
                </span>
              </div>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--walnut-light)", margin: "3px 0" }}>
                {contract.description}
              </p>
              {req && (
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: have >= req.qty ? "var(--lichen)" : "var(--walnut)" }}>
                  {reqName}: {have}/{req.qty}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
