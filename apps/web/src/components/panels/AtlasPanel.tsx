import { useGameStore } from "../../store/gameStore";
import { ZONES } from "@everloom/gamedata";
import { levelFromXp, estimateSurvivalSeconds } from "@everloom/engine";
import type { ActionDescriptor, ZoneId } from "@everloom/engine";

const ZONE_ICONS: Record<string, string> = {
  meadowrest:      "🌿",
  bramblewood:     "🌲",
  ashen_delve:     "⛏️",
  saltmarsh_reach: "🌊",
  gloamfen:        "🌑",
  emberpeak:       "🌋",
  frayed_reach:    "🕸️",
  loomheart:       "✨",
};

export function AtlasPanel() {
  const ps = useGameStore((s) => s.playerState);
  const startAction = useGameStore((s) => s.startAction);
  const setActivePanel = useGameStore((s) => s.setActivePanel);
  if (!ps) return null;

  function travelTo(zoneId: ZoneId) {
    if (zoneId === ps!.zoneId) return;
    const action: ActionDescriptor = {
      type: "traveling",
      nodeId: null,
      zoneId: ps!.zoneId,
      recipeId: null,
      targetZoneId: zoneId,
    };
    startAction(action);
    setActivePanel("none");
  }

  return (
    <>
      <div className="panel-handle" />
      <div className="panel-title">🗺️ Atlas</div>
      <div className="panel-body">
        <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--walnut)", opacity: 0.7, marginBottom: 12 }}>
          The tapestry, viewed whole. Woven zones you have opened; blank linen where the world waits.
        </p>

        {ZONES.map((zone) => {
          const unlocked = ps.unlockedZones.includes(zone.id as ZoneId);
          const isCurrent = ps.zoneId === zone.id;
          const isLocked = !unlocked;

          return (
            <div key={zone.id} style={{
              border: `2px solid ${isCurrent ? "var(--weld)" : isLocked ? "rgba(74,55,40,0.3)" : "var(--walnut)"}`,
              borderRadius: 6,
              padding: "10px 12px",
              marginBottom: 8,
              background: isLocked
                ? "repeating-linear-gradient(45deg,rgba(232,220,196,0.1) 0,rgba(232,220,196,0.1) 10px,transparent 10px,transparent 20px)"
                : isCurrent
                ? "rgba(217,164,65,0.1)"
                : "var(--linen)",
              opacity: isLocked ? 0.55 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 22 }}>{ZONE_ICONS[zone.id] ?? "🗺️"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "var(--font-display)", fontSize: 20,
                    color: isCurrent ? "var(--weld)" : "var(--walnut)",
                  }}>
                    {zone.name}
                  </div>
                  {isLocked && (
                    <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--walnut)", opacity: 0.5 }}>
                      Complete Ledger bundle to unlock
                    </div>
                  )}
                </div>
                {/* Danger badge */}
                <div style={{
                  fontFamily: "var(--font-ui)", fontSize: 10,
                  color: zone.danger === 0 ? "var(--lichen)" : zone.danger < 30 ? "var(--weld)" : "var(--madder)",
                  border: "1px solid currentColor",
                  borderRadius: 3,
                  padding: "2px 6px",
                }}>
                  {zone.danger === 0 ? "SAFE" : `⚔ ${zone.danger}`}
                </div>
              </div>

              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--walnut-light)", marginBottom: 8 }}>
                {zone.description}
              </p>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {zone.travelTimeSec > 0 && (
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--woad)" }}>
                    🧭 {Math.floor(zone.travelTimeSec / 60)}min travel
                  </span>
                )}
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--weld)" }}>
                  ✨ ×{(zone.richness / 1000).toFixed(2)} yield
                </span>
              </div>

              {unlocked && !isCurrent && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 8, width: "100%", fontSize: 10 }}
                  onClick={() => travelTo(zone.id as ZoneId)}
                >
                  Travel Here
                </button>
              )}
              {isCurrent && (
                <div style={{
                  marginTop: 8,
                  fontFamily: "var(--font-ui)", fontSize: 10,
                  color: "var(--weld)", textAlign: "center",
                }}>
                  ▶ You are here
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
