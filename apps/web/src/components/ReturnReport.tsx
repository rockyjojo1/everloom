import { useGameStore } from "../store/gameStore";
import { ITEMS } from "@everloom/gamedata";
import type { SkillId } from "@everloom/engine";

const SKILL_NAMES: Record<SkillId, string> = {
  woodcutting: "Woodcutting", mining: "Mining", fishing: "Fishing",
  crafting: "Crafting", smithing: "Smithing", fletching: "Fletching",
  cooking: "Cooking", combat: "Combat", wayfaring: "Wayfaring", slayer: "Slayer",
};

const KIND_COLOURS = {
  normal: "var(--linen)",
  death: "var(--madder)",
  levelup: "var(--weld)",
  discovery: "var(--woad)",
};

export function ReturnReport() {
  const report = useGameStore((s) => s.returnReport);
  const dismiss = useGameStore((s) => s.dismissReturnReport);

  if (!report) return null;

  const totalXp = Object.values(report.summary.xpBySkill).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="return-report">
      <h1>You Were Away</h1>
      <div className="rr-absence">{report.absenceLabel} passed.</div>

      {/* Narrative timeline */}
      <div style={{ width: "100%", maxWidth: 400 }}>
        {report.lines.map((line, i) => (
          <div key={i} className="rr-event">
            <span className="rr-time">{line.timeLabel}.</span>
            <span className="rr-text" style={{ color: KIND_COLOURS[line.kind] }}>
              {line.text}
            </span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="rr-summary" style={{ maxWidth: 400, width: "100%" }}>
        {Object.entries(report.summary.xpBySkill).map(([skill, xp]) => (
          <div key={skill} className="rr-summary-row">
            <span>+{(xp ?? 0).toLocaleString()} {SKILL_NAMES[skill as SkillId] ?? skill} XP</span>
          </div>
        ))}
        {report.summary.itemsGained.slice(0, 5).map((ig) => {
          const name = ITEMS.find((i) => i.id === ig.itemId)?.name ?? ig.itemId;
          return (
            <div key={ig.itemId} className="rr-summary-row">
              <span>{ig.qty.toLocaleString()}× {name}</span>
            </div>
          );
        })}
        {report.summary.deaths > 0 && (
          <div className="rr-summary-row">
            <span style={{ color: "var(--madder)" }}>{report.summary.deaths} death{report.summary.deaths > 1 ? "s" : ""}</span>
          </div>
        )}
        {report.summary.levelUps > 0 && (
          <div className="rr-summary-row">
            <span style={{ color: "var(--weld)" }}>{report.summary.levelUps} level{report.summary.levelUps > 1 ? "s" : ""} gained</span>
          </div>
        )}
      </div>

      <button
        className="btn btn-gold"
        style={{ marginTop: 24, minWidth: 200 }}
        onClick={dismiss}
      >
        Continue
      </button>

      <p style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.3, marginTop: 10 }}>
        Screenshot this — it's yours.
      </p>
    </div>
  );
}
