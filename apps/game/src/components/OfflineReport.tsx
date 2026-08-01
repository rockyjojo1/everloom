import { CONTENT } from "@everloom/content";
import { useGameStore } from "../game/store";

export function OfflineReport() {
  const report = useGameStore((state) => state.offlineReport);
  const dismiss = useGameStore((state) => state.dismissOfflineReport);
  if (!report) return null;
  return <div className="modal-backdrop"><section className="modal glass">
    <span className="eyebrow">WHILE YOU WERE AWAY</span><h1>The thread continued</h1>
    <p>{Math.round(report.productiveMs / 60000)} productive minutes across {Math.round(report.elapsedMs / 60000)} elapsed minutes.</p>
    <div className="report-grid">
      {report.itemsGained.map((item) => <div key={item.itemId}><b>+{item.quantity}</b><span>{CONTENT.items[item.itemId]?.name}</span></div>)}
      {Object.entries(report.xpGained).map(([skill, xp]) => <div key={skill}><b>+{xp}</b><span>{skill} XP</span></div>)}
      {Object.entries(report.masteryGained).map(([target, xp]) => <div key={target}><b>+{xp}</b><span>{CONTENT.resources[target]?.name ?? target} mastery XP</span></div>)}
      {report.levelGains.map((gain) => <div key={`${gain.skill}-${gain.to}`}><b>Level {gain.to}</b><span>{gain.skill}</span></div>)}
      {report.rareDrops.map((item) => <div key={`rare-${item.itemId}`}><b>Rare ×{item.quantity}</b><span>{CONTENT.items[item.itemId]?.name}</span></div>)}
      {report.deaths > 0 && <div><b>{report.deaths}</b><span>death{report.deaths === 1 ? "" : "s"}</span></div>}
    </div>
    {report.stopReason !== "none" && <p className="warning">Stopped naturally{report.stoppedAfterMs !== null ? ` after ${Math.round(report.stoppedAfterMs / 60000)} minutes` : ""}: {report.stopReason.replaceAll("_", " ")}</p>}
    <button className="primary" onClick={dismiss}>Return to Meadowrest</button>
  </section></div>;
}
