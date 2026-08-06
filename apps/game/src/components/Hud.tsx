import { CONTENT } from "@everloom/content";
import {
  ATTUNEMENT_REQUIRED_LEVEL,
  ATTUNEMENT_SKILL_COUNT,
  ATTUNEMENT_SKILLS,
  countAttunedSkills,
  levelFromXp,
  masteryRankFromXp,
  playerCombatStats,
} from "@everloom/core";
import { Fragment, lazy, Suspense, useRef } from "react";
import { objectiveGuidanceTarget, requestObjectiveRoute } from "../game/objectiveGuidance";
import { inventoryCount, type PanelId, useGameStore } from "../game/store";
import { Icon } from "./Icons";
import { Minimap } from "./Minimap";
import { ItemIcon } from "./ItemIcon";
import { XpDrops } from "./XpDrops";

const tabs: { id: PanelId; label: string }[] = [
  { id: "inventory", label: "Pack" }, { id: "skills", label: "Skills" }, { id: "quest", label: "Thread" },
  { id: "collection", label: "Finds" }, { id: "settings", label: "Options" },
];

const CloudAccount = lazy(async () => {
  const module = await import("./CloudAccount");
  return { default: module.CloudAccount };
});

export function Hud() {
  const store = useGameStore();
  const input = useRef<HTMLInputElement>(null);
  const save = store.save;
  if (!save) return null;
  const attunedSkills = countAttunedSkills(save.skills);
  const combatStats = playerCombatStats(save, CONTENT);

  // The banner always follows whichever quest is actually active in persisted
  // state (never a HUD-only guess), so its objective text can never drift from
  // what the deterministic quest engine has really recorded.
  const activeEntry = Object.entries(save.quests).find(([, progress]) => progress.status === "active");
  const activeQuestId = activeEntry?.[0] ?? null;
  const activeProgress = activeEntry?.[1] ?? null;
  const activeQuestDef = activeQuestId ? CONTENT.quests[activeQuestId] : null;
  const activeStep = activeQuestDef && activeProgress ? activeQuestDef.steps[activeProgress.stepIndex] : null;
  const guidanceTarget = objectiveGuidanceTarget(save);
  const hasWorldGuidance = guidanceTarget !== null;
  const guidanceText = activeStep?.guidanceText
    ?? (hasWorldGuidance ? "Follow the gold marker in the world." : null);
  const guidancePanel = activeStep?.kind === "equip"
    ? { id: "inventory" as const, label: "Open Pack" }
    : activeStep?.kind === "attune"
      ? { id: "skills" as const, label: "Open Skills" }
      : null;
  const objectiveText = activeStep
    ? activeStep.kind === "attune"
      ? `${activeStep.objective} ${attunedSkills} of ${ATTUNEMENT_SKILL_COUNT} attuned.`
      : activeStep.objective
    : "Meadowrest is steady. The Verdant Loomstone hums quietly in the northern grove.";
  const activity = save.currentActivity;
  const activityDuration = activity?.type === "gathering"
    ? CONTENT.resources[activity.resourceId]?.actionDurationMs
    : activity?.type === "production"
      ? CONTENT.recipes[activity.recipeId]?.actionDurationMs
      : activity?.type === "combat"
        ? CONTENT.enemies[activity.enemyId]?.attackIntervalMs
        : undefined;
  const activityProgress = activity && activityDuration ? Math.min(100, activity.progressMs / activityDuration * 100) : 0;
  const activeResource = activity?.type === "gathering" ? CONTENT.resources[activity.resourceId] : null;
  const activeMasteryXp = activeResource ? save.mastery[activeResource.id]?.xp ?? 0 : 0;
  const activeMasteryRank = masteryRankFromXp(activeMasteryXp);

  const hudClass = ["hud", `ui-scale-${store.worldAssistance.uiScale}`, store.worldAssistance.highContrast ? "high-contrast" : ""]
    .filter(Boolean).join(" ");
  return <div className={hudClass}>
    <section className="objective glass">
      <span className="eyebrow">{(activeQuestDef?.name ?? "MEADOWREST").toUpperCase()}</span>
      <strong>{objectiveText}</strong>
      {activeStep && activeStep.kind !== "attune" && activeStep.count > 1 &&
        <small>{activeProgress?.stepProgress ?? 0} / {activeStep.count}</small>}
      {guidanceText && <small className="guide-hint">{guidanceText}</small>}
      {guidancePanel && <button className="objective-action" onClick={() => store.setPanel(guidancePanel.id)}>
        {guidancePanel.label}
      </button>}
      {guidanceTarget && <div className="objective-controls">
        <button className="objective-action" onClick={() => {
          const visible = !store.worldAssistance.pathTrailVisible;
          store.setWorldAssistance("pathTrailVisible", visible);
          if (visible) requestObjectiveRoute(guidanceTarget.id);
        }}>
          {store.worldAssistance.pathTrailVisible ? "Hide route" : "Show route"}
        </button>
        <button className="objective-action" onClick={store.highlightObjective}>Highlight target</button>
      </div>}
    </section>
    <section className="vitals glass">
      <span>HP</span><div><i style={{ width: `${save.player.hp / save.player.maxHp * 100}%` }} /></div><b>{save.player.hp}/{save.player.maxHp}</b>
    </section>
    <Minimap />
    <XpDrops />
    {activity && <section className="activity glass">
      <span>{activity.type === "gathering" ? CONTENT.resources[activity.resourceId]?.name : activity.type === "production" ? CONTENT.recipes[activity.recipeId]?.name : activity.type === "combat" ? CONTENT.enemies[activity.enemyId]?.name : activity.type === "expedition" ? `${activity.activityId} expedition` : "unknown"}
        {activity.type === "combat" && <small>Lv {CONTENT.enemies[activity.enemyId]?.combatLevel} · {activity.enemyHp}/{CONTENT.enemies[activity.enemyId]?.maxHp} HP</small>}
        {activeResource && <small className="activity-mastery">Mastery rank {activeMasteryRank} · {activeMasteryXp} XP</small>}
      </span>
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
                <div><strong>{item.name}</strong><small>{item.description}</small>
                  {item.combatBonuses && <small className="combat-bonuses">
                    {item.combatBonuses.accuracy > 0 && `Accuracy +${item.combatBonuses.accuracy} `}
                    {item.combatBonuses.strength > 0 && `Strength +${item.combatBonuses.strength} `}
                    {item.combatBonuses.defence > 0 && `Defence +${item.combatBonuses.defence}`}
                  </small>}
                </div><b>×{stack.quantity}</b>
                {(item.equipmentSlot || item.healAmount > 0) && <button onClick={() => item.healAmount ? store.consumeFood(item.id) : store.equip(item.id)}>
                  {item.healAmount ? "Eat" : equipped ? "Equipped" : "Equip"}</button>}
              </article>;
            })}
            {!save.inventory.length && <p className="empty">Your pack is empty. Tools can be found around the village.</p>}
          </div>
        </>}
        {store.panel === "skills" && <div className="rows">
          <p className="muted">{attunedSkills} of {ATTUNEMENT_SKILL_COUNT} skills attuned to level {ATTUNEMENT_REQUIRED_LEVEL}.</p>
          {Object.entries(save.skills).map(([id, progress]) => {
            const attuned = (ATTUNEMENT_SKILLS as readonly string[]).includes(id)
              && levelFromXp(progress.xp) >= ATTUNEMENT_REQUIRED_LEVEL;
            return <div key={id} className={attuned ? "attuned" : ""}>
              <span>{id}</span><b>Level {levelFromXp(progress.xp)}{attuned && <i className="attuned-mark" title="Attuned">✓</i>}</b><small>{progress.xp} XP</small>
            </div>;
          })}
          <section className="combat-summary">
            <span className="eyebrow">COMBAT PROFILE</span>
            <strong>Level {combatStats.level}</strong>
            <div><span>Accuracy</span><b>{combatStats.accuracy}</b></div>
            <div><span>Max hit</span><b>{combatStats.maxHit}</b></div>
            <div><span>Defence</span><b>{combatStats.defence}</b></div>
            <small>Weapon: {save.equipment.weapon ? CONTENT.items[save.equipment.weapon]?.name : "Unarmed"}</small>
            <small>Body: {save.equipment.body ? CONTENT.items[save.equipment.body]?.name : "Unarmoured"}</small>
          </section>
          <section className="mastery-overview">
            <header>
              <div><span className="eyebrow">ACTION MASTERY</span><h3>Practice changes the grind</h3></div>
              <small>Each resource has its own rank.</small>
            </header>
            <p>Higher mastery shortens that action and improves its rare-find chance. Mastery advances online and offline.</p>
            <div className="mastery-grid">
              {Object.entries(CONTENT.resources).map(([id, resource]) => {
                const xp = save.mastery[id]?.xp ?? 0;
                const rank = masteryRankFromXp(xp);
                const floor = rank * rank * 25;
                const ceiling = (rank + 1) * (rank + 1) * 25;
                const progress = Math.max(0, Math.min(100, (xp - floor) / Math.max(1, ceiling - floor) * 100));
                // Presentation-only rank tier for the badge colour; purely
                // cosmetic bucketing of the same rank number already shown
                // as text, no effect on the underlying mastery calculation.
                const tier = rank >= 20 ? "diamond" : rank >= 10 ? "gold" : rank >= 5 ? "silver" : "bronze";
                return <article key={id} className={activeResource?.id === id ? "active" : ""}>
                  <div>
                    <strong>{resource.name}</strong>
                    <b className={`mastery-rank-badge tier-${tier}`}>Rank {rank}</b>
                  </div>
                  <i className="mastery-progress"><b style={{ width: `${progress}%` }} /></i>
                  <small>{xp} / {ceiling} XP · next rank: {(resource.masterySpeedPpmPerRank / 10_000).toFixed(1)}% faster</small>
                </article>;
              })}
            </div>
          </section>
        </div>}
        {store.panel === "quest" && <div className="quest-list">
          {Object.entries(save.quests).map(([questId, questProgress]) => {
            const quest = CONTENT.quests[questId];
            if (!quest) return null;
            return <Fragment key={questId}>
              <h3>{quest.name}</h3><p>{quest.summary}</p>
              {quest.steps.map((item, index) => {
              const done = index < questProgress.stepIndex || questProgress.status === "completed";
              const current = questProgress.status === "active" && index === questProgress.stepIndex;
              if (item.kind === "attune") {
                return <div key={item.id} className={`attune-step ${done ? "done" : current ? "current" : ""}`}>
                  <i>{index + 1}</i>
                  <div>
                    <span>{item.objective}</span>
                    <div className="attune-grid">
                      {ATTUNEMENT_SKILLS.map((id) =>
                        <b key={id} className={levelFromXp(save.skills[id].xp) >= ATTUNEMENT_REQUIRED_LEVEL ? "ready" : ""}>{id}</b>)}
                    </div>
                  </div>
                </div>;
              }
              return <div key={item.id} className={done ? "done" : current ? "current" : ""}>
                <i>{index + 1}</i><span>{item.objective}</span></div>;
              })}
            </Fragment>;
          })}

          <section className="loomstone-network">
            <span className="eyebrow">THE LOOMSTONE NETWORK</span>
            <div className="loomstone-track">
              {["First", "Verdant", "Tidal", "Ember", "Astral"].map((name, index) =>
                <i key={name} className={
                  index === 0 ? "restored"
                    : index === 1 && save.worldFlags.verdant_loomstone_awakened ? "restored"
                    : index === 1 && attunedSkills === ATTUNEMENT_SKILL_COUNT ? "ready"
                    : ""
                } title={`${name} Loomstone`} />)}
            </div>
            <strong>{save.worldFlags.verdant_loomstone_awakened ? "2 of 5 restored" : "1 of 5 restored"}</strong>
            <p>{save.worldFlags.verdant_loomstone_awakened
              ? "The Verdant Loomstone answers. Three threads remain quiet."
              : attunedSkills < ATTUNEMENT_SKILL_COUNT
                ? `Attune all five skills to level ${ATTUNEMENT_REQUIRED_LEVEL} (${attunedSkills}/${ATTUNEMENT_SKILL_COUNT}).`
                : "The path toward the Verdant Loomstone is ready."}</p>
          </section>
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
          <section className="world-assistance">
            <h3>World Assistance</h3>
            <p className="muted">Clarity and quality-of-life toggles. Nothing here affects skills, mastery, or quest progress.</p>
            <label className="toggle-row">
              <input type="checkbox" checked={store.worldAssistance.objectiveHighlighting}
                onChange={(event) => store.setWorldAssistance("objectiveHighlighting", event.target.checked)} />
              <span>Highlight current objective in the world</span>
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={store.worldAssistance.pathTrailVisible}
                onChange={(event) => store.setWorldAssistance("pathTrailVisible", event.target.checked)} />
              <span>Show path trail to objective</span>
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={store.worldAssistance.highContrast}
                onChange={(event) => store.setWorldAssistance("highContrast", event.target.checked)} />
              <span>High-contrast HUD text</span>
            </label>
            <label>UI scale<select value={store.worldAssistance.uiScale}
              onChange={(event) => store.setWorldAssistance("uiScale", event.target.value as "compact" | "standard" | "large")}>
              <option value="compact">Compact</option><option value="standard">Standard</option><option value="large">Large</option>
            </select></label>
          </section>
          <div className="button-row"><button onClick={store.exportSave}>Export save</button><button onClick={() => input.current?.click()}>Import save</button></div>
          <input ref={input} type="file" accept=".json,application/json" hidden onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void file.text().then(store.importSaveText);
          }} />
          <button className="danger" onClick={() => { if (confirm("Erase this local save and begin again?")) void store.resetSave(); }}>Reset local save</button>
          <p className="muted">Local save: {store.saveStatus}{store.saveError ? ` — ${store.saveError}` : ""}.</p>
          <Suspense fallback={<p className="muted">Opening account options…</p>}><CloudAccount /></Suspense>
        </div>}
      </div>
    </aside>}
  </div>;
}
