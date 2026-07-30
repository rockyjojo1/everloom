import { CONTENT } from "@everloom/content";
import { levelFromXp, masteryRankFromXp } from "@everloom/core";
import { useRef } from "react";
import { inventoryCount, type PanelId, useGameStore } from "../game/store";
import { Icon } from "./Icons";
import { Minimap } from "./Minimap";
import { ItemIcon } from "./ItemIcon";

const tabs: { id: PanelId; label: string }[] = [
  { id: "inventory", label: "Pack" }, { id: "skills", label: "Skills" }, { id: "quest", label: "Thread" },
  { id: "collection", label: "Finds" }, { id: "settings", label: "Options" },
];

export function Hud() {
  const store = useGameStore();
  const input = useRef<HTMLInputElement>(null);
  const save = store.save;
  if (!save) return null;
  const quest = save.quests.first_thread;
  const questDef = CONTENT.quests.first_thread!;
  const step = quest?.status === "completed" ? null : questDef.steps[quest?.stepIndex ?? 0];
  const attunedSkills = Object.values(save.skills).filter((progress) => levelFromXp(progress.xp) >= 5).length;
  const objectiveText = step?.objective ?? (attunedSkills < 5
    ? `Strengthen every Meadowrest skill to level 5. ${attunedSkills} of 5 attuned.`
    : "Return to the First Loomstone. The Verdant Thread is ready to reveal itself.");
  const activity = save.currentActivity;
  const activityDuration = activity?.type === "gathering"
    ? CONTENT.resources[activity.resourceId]?.actionDurationMs
    : activity?.type === "cooking"
      ? CONTENT.recipes[activity.recipeId]?.actionDurationMs
      : activity?.type === "combat"
        ? CONTENT.enemies[activity.enemyId]?.attackIntervalMs
        : undefined;
  const activityProgress = activity && activityDuration ? Math.min(100, activity.progressMs / activityDuration * 100) : 0;

  return <div className="hud">
    <section className="objective glass">
      <span className="eyebrow">THE FIRST THREAD</span>
      <strong>{objectiveText}</strong>
      {step && step.count > 1 && <small>{quest?.stepProgress ?? 0} / {step.count}</small>}
    </section>
    <section className="vitals glass">
      <span>HP</span><div><i style={{ width: `${save.player.hp / save.player.maxHp * 100}%` }} /></div><b>{save.player.hp}/{save.player.maxHp}</b>
    </section>
    <Minimap />
    {activity && <section className="activity glass">
      <span>{activity.type === "gathering" ? CONTENT.resources[activity.resourceId]?.name : activity.type === "cooking" ? CONTENT.recipes[activity.recipeId]?.name : CONTENT.enemies[activity.enemyId]?.name}</span>
      <i className="activity-progress"><b style={{ width: `${activityProgress}%` }} /></i>
      <button onClick={store.cancelCurrentActivity}>Stop</button>
    </section>}
    <div className="log" aria-live="polite">{store.logs.map((entry) => <span key={entry.id} className={entry.tone}>{entry.text}</span>)}</div>
    <nav className="dock glass" aria-label="Game panels">
      {tabs.map((tab) => <button key={tab.id} aria-label={tab.label} className={store.panelOpen && store.panel === tab.id ? "active" : ""}
        onClick={() => store.panelOpen && store.panel === tab.id ? store.togglePanel() : store.setPanel(tab.id)}>
        <Icon name={tab.id} /><small>{tab.label}</small>
      </button>)}
    </nav>
    {store.panelOpen && <aside className="panel glass">
      <header><div><span className="eyebrow">MEADOWREST</span><h2>{tabs.find((t) => t.id === store.panel)?.label}</h2></div>
        <button className="icon-button" aria-label="Close panel" onClick={store.togglePanel}><Icon name="close" /></button></header>
      <div className="panel-body">
        {store.panel === "inventory" && <>
          <p className="muted">{save.inventory.length} / {save.inventorySlots} slots</p>
          <div className="inventory">
            {save.inventory.map((stack) => {
              const item = CONTENT.items[stack.itemId]!;
              const equipped = Object.values(save.equipment).includes(item.id);
              return <article key={item.id}><div className={`item-glyph ${item.category}`}><ItemIcon iconId={item.iconId} /></div>
                <div><strong>{item.name}</strong><small>{item.description}</small></div><b>×{stack.quantity}</b>
                {(item.equipmentSlot || item.healAmount > 0) && <button onClick={() => item.healAmount ? store.consumeFood(item.id) : store.equip(item.id)}>
                  {item.healAmount ? "Eat" : equipped ? "Equipped" : "Equip"}</button>}
              </article>;
            })}
            {!save.inventory.length && <p className="empty">Your pack is empty. Tools can be found around the village.</p>}
          </div>
        </>}
        {store.panel === "skills" && <div className="rows">
          {Object.entries(save.skills).map(([id, progress]) => <div key={id}><span>{id}</span><b>Level {levelFromXp(progress.xp)}</b><small>{progress.xp} XP</small></div>)}
          <h3>Mastery</h3>
          {Object.entries(save.mastery).map(([id, progress]) => <div key={id}><span>{CONTENT.resources[id]?.name ?? id}</span><b>Rank {masteryRankFromXp(progress.xp)}</b><small>{progress.xp} XP</small></div>)}
        </div>}
        {store.panel === "quest" && <div className="quest-list">
          <h3>{questDef.name}</h3><p>{questDef.summary}</p>
          {questDef.steps.map((item, index) => <div key={item.id} className={index < (quest?.stepIndex ?? 0) || quest?.status === "completed" ? "done" : index === (quest?.stepIndex ?? 0) ? "current" : ""}>
            <i>{index + 1}</i><span>{item.objective}</span></div>)}
          {quest?.status === "completed" && <section className="loomstone-network">
            <span className="eyebrow">THE LOOMSTONE NETWORK</span>
            <div className="loomstone-track">
              {["First", "Verdant", "Tidal", "Ember", "Astral"].map((name, index) =>
                <i key={name} className={index === 0 ? "restored" : index === 1 && attunedSkills === 5 ? "ready" : ""} title={`${name} Loomstone`} />)}
            </div>
            <strong>1 of 5 restored</strong>
            <p>{attunedSkills < 5 ? `Attune all five skills to level 5 (${attunedSkills}/5).` : "The path toward the Verdant Loomstone is ready."}</p>
          </section>}
        </div>}
        {store.panel === "collection" && <div className="collection">
          {Object.values(CONTENT.items).filter((item) => item.collection).map((item) => {
            const found = save.collections.includes(item.id) || inventoryCount(save, item.id) > 0;
            return <article className={found ? "found" : ""} key={item.id}><div className="item-glyph">{found ? <ItemIcon iconId={item.iconId} /> : "?"}</div><span>{found ? item.name : "Undiscovered"}</span></article>;
          })}
          {!Object.values(CONTENT.items).some((item) => item.collection) && <p className="empty">Rare finds will be recorded here.</p>}
        </div>}
        {store.panel === "settings" && <div className="settings">
          <label>Visual quality<select value={save.settings.quality} onChange={(event) => store.setQuality(event.target.value as "low" | "standard" | "high")}>
            <option value="low">Low</option><option value="standard">Standard</option><option value="high">High</option></select></label>
          <div className="button-row"><button onClick={store.exportSave}>Export save</button><button onClick={() => input.current?.click()}>Import save</button></div>
          <input ref={input} type="file" accept=".json,application/json" hidden onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void file.text().then(store.importSaveText);
          }} />
          <button className="danger" onClick={() => { if (confirm("Erase this local save and begin again?")) void store.resetSave(); }}>Reset local save</button>
          <p className="muted">Save: {store.saveStatus}{store.saveError ? ` — ${store.saveError}` : ""}. This world is stored only on this device.</p>
        </div>}
      </div>
    </aside>}
  </div>;
}
