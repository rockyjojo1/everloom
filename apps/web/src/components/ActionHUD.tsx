import { useGameStore } from "../store/gameStore";
import { levelFromXp, masteryLevelFromXp, XP_TABLE, MASTERY_TABLE } from "@everloom/engine";
import { NODES } from "@everloom/gamedata";
import type { SkillId } from "@everloom/engine";

const SKILL_ICONS: Record<SkillId, string> = {
  woodcutting: "🪓", mining: "⛏️", fishing: "🎣",
  crafting: "🔨", smithing: "⚒️", fletching: "🪶",
  cooking: "🍳", combat: "⚔️", wayfaring: "🧭", slayer: "🗡️",
};

export function ActionHUD() {
  const ps = useGameStore((s) => s.playerState);
  if (!ps) return null;

  const action = ps.currentAction;
  const isIdle = action.type === "idle";
  const isTraveling = action.type === "traveling";

  if (isIdle) {
    return (
      <div className="action-hud">
        <span className="hud-idle">Tap a node to begin</span>
      </div>
    );
  }

  if (isTraveling) {
    return (
      <div className="action-hud">
        <span className="hud-skill-icon">🧭</span>
        <span className="hud-node-name">→ {action.targetZoneId?.replace(/_/g, " ")}</span>
        <div className="hud-bar-row">
          <div className="progress-wrap hud-bar">
            <div className="progress-fill blue" style={{ width: `${ps.travelProgress / 10}%` }} />
          </div>
          <span className="hud-pct">{Math.floor(ps.travelProgress / 10)}%</span>
        </div>
      </div>
    );
  }

  const skill    = action.type as SkillId;
  const skillXp  = ps.skills[skill] ?? 0;
  const lvl      = levelFromXp(skillXp);
  const nextXp   = XP_TABLE[lvl + 1] ?? skillXp;
  const thisXp   = XP_TABLE[lvl] ?? 0;
  const skillPct = nextXp > thisXp ? Math.floor(((skillXp - thisXp) / (nextXp - thisXp)) * 100) : 100;

  const nodeId    = action.nodeId;
  const mastXp    = nodeId ? (ps.mastery[nodeId] ?? 0) : 0;
  const mLvl      = masteryLevelFromXp(mastXp);
  const nextMXp   = MASTERY_TABLE[mLvl + 1] ?? mastXp;
  const thisMXp   = MASTERY_TABLE[mLvl] ?? 0;
  const mastPct   = nextMXp > thisMXp ? Math.floor(((mastXp - thisMXp) / (nextMXp - thisMXp)) * 100) : 100;

  const nodeName = nodeId ? (NODES.find((n) => n.id === nodeId)?.name ?? nodeId) : "—";
  const invPct   = Math.floor((ps.inventory.length / ps.slots) * 100);

  return (
    <div className="action-hud">
      <div className="hud-top-row">
        <span className="hud-skill-icon">{SKILL_ICONS[skill]}</span>
        <span className="hud-node-name">{nodeName}</span>
        <span className={`hud-inv-badge ${invPct >= 100 ? "full" : invPct >= 70 ? "warn" : ""}`}>
          🎒 {ps.inventory.length}/{ps.slots}
        </span>
      </div>
      <div className="hud-bars">
        <div className="hud-bar-row">
          <span className="hud-bar-label">Lv{lvl}</span>
          <div className="progress-wrap hud-bar">
            <div className="progress-fill" style={{ width: `${skillPct}%` }} />
          </div>
          <span className="hud-pct">{skillPct}%</span>
        </div>
        {nodeId && (
          <div className="hud-bar-row">
            <span className="hud-bar-label">M{mLvl}</span>
            <div className="progress-wrap hud-bar">
              <div className="progress-fill blue" style={{ width: `${mastPct}%` }} />
            </div>
            <span className="hud-pct">{mastPct}%</span>
          </div>
        )}
        <div className="hud-bar-row">
          <span className="hud-bar-label">Bag</span>
          <div className="progress-wrap hud-bar">
            <div className={`progress-fill ${invPct >= 100 ? "red" : "green"}`} style={{ width: `${invPct}%` }} />
          </div>
          <span className="hud-pct">{invPct}%</span>
        </div>
      </div>
    </div>
  );
}
