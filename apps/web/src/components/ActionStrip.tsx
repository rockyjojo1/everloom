import { useGameStore } from "../store/gameStore";
import { levelFromXp, masteryLevelFromXp, XP_TABLE, MASTERY_TABLE } from "@everloom/engine";
import { NODES } from "@everloom/gamedata";
import type { SkillId } from "@everloom/engine";

const SKILL_ICONS: Record<SkillId, string> = {
  woodcutting: "🪓",
  mining:      "⛏️",
  fishing:     "🎣",
  crafting:    "🔨",
  smithing:    "⚒️",
  fletching:   "🪶",
  cooking:     "🍳",
  combat:      "⚔️",
  wayfaring:   "🧭",
  slayer:      "🗡️",
};

export function ActionStrip() {
  const ps = useGameStore((s) => s.playerState);
  if (!ps) return null;

  const action = ps.currentAction;
  const isIdle = action.type === "idle";
  const isTraveling = action.type === "traveling";

  if (isIdle) {
    return (
      <div className="action-strip">
        <div className="action-label">
          <span style={{ opacity: 0.5 }}>Idle — tap a node to begin</span>
        </div>
      </div>
    );
  }

  if (isTraveling) {
    return (
      <div className="action-strip">
        <div className="action-label">
          <span className="node-name">🧭 Traveling to {action.targetZoneId?.replace(/_/g, " ")}</span>
        </div>
        <div className="action-bars">
          <div className="bar-row">
            <span className="bar-label">Progress</span>
            <div className="progress-wrap" style={{ flex: 1 }}>
              <div className="progress-fill blue" style={{ width: `${ps.travelProgress / 10}%` }} />
            </div>
            <span className="bar-value">{Math.floor(ps.travelProgress / 10)}%</span>
          </div>
        </div>
      </div>
    );
  }

  const skill = action.type as SkillId;
  const skillXp = ps.skills[skill] ?? 0;
  const skillLevel = levelFromXp(skillXp);
  const nextLvlXp = XP_TABLE[skillLevel + 1] ?? skillXp;
  const thisLvlXp = XP_TABLE[skillLevel] ?? 0;
  const skillPct = nextLvlXp > thisLvlXp
    ? Math.floor(((skillXp - thisLvlXp) / (nextLvlXp - thisLvlXp)) * 100)
    : 100;

  const nodeId = action.nodeId;
  const masteryXp = nodeId ? (ps.mastery[nodeId] ?? 0) : 0;
  const masteryLevel = masteryLevelFromXp(masteryXp);
  const nextMastXp = MASTERY_TABLE[masteryLevel + 1] ?? masteryXp;
  const thisMastXp = MASTERY_TABLE[masteryLevel] ?? 0;
  const masteryPct = nextMastXp > thisMastXp
    ? Math.floor(((masteryXp - thisMastXp) / (nextMastXp - thisMastXp)) * 100)
    : 100;

  const nodeName = nodeId ? (NODES.find((n) => n.id === nodeId)?.name ?? nodeId) : "Unknown";

  // Inventory fill.
  const invPct = Math.floor((ps.inventory.length / ps.slots) * 100);

  return (
    <div className="action-strip">
      <div className="action-label">
        <span>
          <span style={{ opacity: 0.7 }}>{SKILL_ICONS[skill]} </span>
          <span className="node-name">{nodeName}</span>
        </span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--weld)" }}>
            🎒 {ps.inventory.length}/{ps.slots}
          </span>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--linen-dark)", opacity: 0.6 }}>
            ✨ {ps.motes}
          </span>
        </span>
      </div>

      <div className="action-bars">
        {/* Skill XP bar */}
        <div className="bar-row">
          <span className="bar-label">{SKILL_ICONS[skill]} Lv {skillLevel}</span>
          <div className="progress-wrap" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: `${skillPct}%` }} />
          </div>
          <span className="bar-value">{skillPct}%</span>
        </div>

        {/* Mastery bar */}
        {nodeId && (
          <div className="bar-row">
            <span className="bar-label">⭐ M{masteryLevel}</span>
            <div className="progress-wrap" style={{ flex: 1 }}>
              <div className="progress-fill blue" style={{ width: `${masteryPct}%` }} />
            </div>
            <span className="bar-value">{masteryPct}%</span>
          </div>
        )}

        {/* Satchel fill */}
        <div className="bar-row">
          <span className="bar-label">🎒 Satchel</span>
          <div className="progress-wrap" style={{ flex: 1 }}>
            <div
              className={`progress-fill ${invPct > 80 ? "red" : "green"}`}
              style={{ width: `${invPct}%` }}
            />
          </div>
          <span className="bar-value">{invPct}%</span>
        </div>
      </div>
    </div>
  );
}
