import { useGameStore } from "../store/gameStore";
import { levelFromXp } from "@everloom/engine";
import type { CharacterAppearance } from "@everloom/engine";

const SKIN_TONES   = ["#FDBCB4","#F0A882","#D4845A","#B86035","#8B4215","#5C2A0A"];
const HAIR_COLORS  = ["#3C2514","#6B4226","#9B6633","#D9A441","#E8DCC4","#A63A32","#C0C0C0","#E8E8E8","#3C5A73","#5E7350"];
const TORSO_COLORS = ["#3C5A73","#A63A32","#5E7350","#4A3728","#D9A441","#7D3C98","#2C3E50","#C0392B","#1E8449","#1E2430"];
const LEGS_COLORS  = ["#4A3728","#2C3E50","#1A5276","#A63A32","#5E7350","#7D3C98","#6B4226","#E8DCC4","#1E2430","#3C5A73"];

function MiniChar({ app }: { app?: CharacterAppearance }) {
  const skin  = SKIN_TONES[app?.skinTone  ?? 0]!;
  const hair  = HAIR_COLORS[app?.hairColor ?? 3]!;
  const torso = TORSO_COLORS[app?.torsoColor ?? 0]!;
  const legs  = LEGS_COLORS[app?.legsColor  ?? 0]!;
  return (
    <svg viewBox="0 0 12 24" style={{ width: 40, height: 80, imageRendering: "pixelated", flexShrink: 0 }}>
      <rect x="3" y="0" width="6" height="3" fill={hair} />
      <rect x="2" y="3" width="8" height="6" fill={skin} />
      <rect x="4" y="5" width="1" height="1" fill="#1a0f00" />
      <rect x="7" y="5" width="1" height="1" fill="#1a0f00" />
      <rect x="3" y="9" width="6" height="6" fill={torso} />
      <rect x="1" y="9" width="2" height="7" fill={torso} />
      <rect x="9" y="9" width="2" height="7" fill={torso} />
      <rect x="3" y="15" width="2" height="5" fill={legs} />
      <rect x="7" y="15" width="2" height="5" fill={legs} />
      <rect x="2" y="20" width="3" height="2" fill="#2C1810" />
      <rect x="7" y="20" width="3" height="2" fill="#2C1810" />
    </svg>
  );
}

export function CharacterSelect() {
  const ps        = useGameStore((s) => s.playerState);
  const setScreen = useGameStore((s) => s.setScreen);

  const totalLevel = ps
    ? Object.values(ps.skills).reduce((sum, xp) => sum + levelFromXp(xp), 0)
    : 0;

  const actionLabel = ps?.currentAction.type !== "idle"
    ? `${ps!.currentAction.type}${ps!.currentAction.nodeId ? ` at ${ps!.currentAction.nodeId.replace(/_/g, " ")}` : ""}`
    : "Idle";

  function handlePlay() {
    setScreen("game");
  }

  return (
    <div className="landing" style={{ justifyContent: "flex-start", paddingTop: 40 }}>
      <h1 style={{ fontSize: 42, marginBottom: 4 }}>Choose Thread</h1>
      <p style={{ marginBottom: 24 }}>Select a character to continue.</p>

      <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 10 }}>
        {ps ? (
          <div
            className="char-card"
            onClick={handlePlay}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handlePlay()}
          >
            <MiniChar app={ps.appearance} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--weld)", marginBottom: 2 }}>
                {ps.displayName}
              </div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--linen-dark)", opacity: 0.8 }}>
                Total level {totalLevel} · {ps.mode}
              </div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--linen-dark)", opacity: 0.6, marginTop: 3 }}>
                {actionLabel}
              </div>
            </div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--lichen)", alignSelf: "center" }}>
              ▶ Play
            </div>
          </div>
        ) : (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, opacity: 0.5, textAlign: "center" }}>
            No characters found.
          </p>
        )}

        <button className="btn" onClick={() => setScreen("create")} style={{ marginTop: 4 }}>
          + New Character
        </button>
      </div>
    </div>
  );
}
