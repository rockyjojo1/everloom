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
    </div>
    {report.stopReason !== "none" && <p className="warning">Stopped naturally: {report.stopReason.replaceAll("_", " ")}</p>}
    <button className="primary" onClick={dismiss}>Return to Meadowrest</button>
  </section></div>;
}
