import { CONTENT } from "@everloom/content";
import { useGameStore } from "../game/store";

export function DebugPanel() {
  const store = useGameStore();
  if (!import.meta.env.DEV || !new URLSearchParams(location.search).has("debug")) return null;
  return <details className="debug"><summary>Debug</summary>
    <button onClick={() => store.debugAddItem("worn_hatchet", 1)}>+ hatchet</button>
    <button onClick={() => store.debugAddItem("meadow_log", 1)}>+ log</button>
    <button onClick={store.debugEmptyInventory}>Empty pack</button>
    <button onClick={store.debugFillInventory}>Fill pack</button>
    <button onClick={store.debugDamagePlayer}>Damage</button>
    <button onClick={() => store.debugSimulateOffline(3_600_000)}>+1h offline</button>
    <button onClick={store.debugAttuneSkills}>Attune all 5 skills</button>
    <button onClick={() => store.debugCompleteQuest("first_thread")}>Force-complete First Thread</button>
    <button onClick={() => store.debugCompleteQuest("verdant_loomstone")}>Force-complete Verdant Loomstone</button>
    <pre>{JSON.stringify({ activity: store.save?.currentActivity, quests: store.save?.quests, flags: store.save?.worldFlags, resources: store.save?.worldResources }, null, 2)}</pre>
    <small>{Object.keys(CONTENT.items).length} items / deterministic core</small>
  </details>;
}

