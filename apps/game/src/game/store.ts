import { create } from "zustand";
import { CONTENT } from "@everloom/content";
import {
  addItem,
  advanceSimulation,
  applyQuestEvents,
  calculateOfflineElapsed,
  cancelActivity,
  createNewSave,
  deserializeSave,
  equipItem,
  forceCompleteQuest,
  itemQuantity,
  levelFromXp,
  pickupGroundItem,
  recordWorldInteraction,
  serializeSave,
  startActivityForTarget,
  useFood,
  xpForLevel,
  type ActivityReport,
  type GameEvent,
  type GameSave,
  type GridPosition,
  type QualityLevel,
  type SkillId,
} from "@everloom/core";
import { clearSaves, loadSave, writeSave } from "./saveDb";

export type PanelId = "inventory" | "skills" | "quest" | "collection" | "settings";

export interface LogEntry {
  readonly id: number;
  readonly text: string;
  readonly tone: "normal" | "good" | "rare" | "warning";
}

interface DebugFlags {
  readonly grid: boolean;
  readonly blocked: boolean;
  readonly interactions: boolean;
}

interface GameStore {
  readonly status: "booting" | "ready" | "error";
  readonly save: GameSave | null;
  readonly loadError: string | null;
  readonly saveError: string | null;
  readonly saveStatus: "idle" | "saving" | "saved" | "error";
  readonly offlineReport: ActivityReport | null;
  readonly panel: PanelId;
  readonly panelOpen: boolean;
  readonly selectedTargetId: string | null;
  readonly logs: readonly LogEntry[];
  readonly debug: DebugFlags;
  initialize: () => Promise<void>;
  beginIntro: () => void;
  setPosition: (position: GridPosition, facing?: GridPosition) => void;
  setSelectedTarget: (targetId: string | null) => void;
  pickup: (targetId: string) => boolean;
  equip: (itemId: string) => boolean;
  interact: (targetId: string) => boolean;
  startTargetActivity: (targetId: string) => boolean;
  cancelCurrentActivity: () => void;
  consumeFood: (itemId: string) => boolean;
  tick: (elapsedMs: number) => void;
  setPanel: (panel: PanelId) => void;
  togglePanel: () => void;
  dismissOfflineReport: () => void;
  saveNow: (reason: string, backup?: boolean) => Promise<void>;
  resumeFromBackground: () => Promise<void>;
  exportSave: () => void;
  importSaveText: (text: string) => Promise<void>;
  resetSave: () => Promise<void>;
  setQuality: (quality: QualityLevel) => void;
  setDebugFlag: (flag: keyof DebugFlags, value: boolean) => void;
  debugAddItem: (itemId: string, quantity: number) => void;
  debugEmptyInventory: () => void;
  debugFillInventory: () => void;
  debugDamagePlayer: () => void;
  debugSimulateOffline: (elapsedMs: number) => void;
  debugAttuneSkills: () => void;
  debugCompleteQuest: (questId: string) => void;
}

let logSequence = 1;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let initializing: Promise<void> | null = null;

function seedFromCrypto(): string {
  const values = crypto.getRandomValues(new Uint32Array(4));
  return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
}

function eventLog(event: GameEvent): LogEntry | null {
  switch (event.type) {
    case "item_gained":
      return { id: logSequence++, text: `Obtained ${event.quantity} × ${CONTENT.items[event.itemId]?.name ?? event.itemId}`, tone: "good" };
    case "item_equipped":
      return { id: logSequence++, text: `Equipped ${CONTENT.items[event.itemId]?.name ?? event.itemId}`, tone: "good" };
    case "xp_gained":
      return { id: logSequence++, text: `+${event.amount} ${event.skill} XP`, tone: "good" };
    case "level_gained":
      return { id: logSequence++, text: `${event.skill} reached level ${event.to}`, tone: "rare" };
    case "mastery_rank_gained":
      return { id: logSequence++, text: `${CONTENT.resources[event.targetId]?.name ?? event.targetId} mastery ${event.to}`, tone: "rare" };
    case "rare_drop":
      return { id: logSequence++, text: `Rare find: ${CONTENT.items[event.itemId]?.name ?? event.itemId}`, tone: "rare" };
    case "quest_advanced":
      if (event.questId === "verdant_loomstone" && event.stepIndex === 1) {
        return { id: logSequence++, text: "All five threads hold steady. Mara will want to know.", tone: "rare" };
      }
      return { id: logSequence++, text: `${CONTENT.quests[event.questId]?.name ?? "The thread"} advances.`, tone: "rare" };
    case "quest_completed":
      if (event.questId === "verdant_loomstone") {
        return { id: logSequence++, text: "The Verdant Loomstone wakes beneath the grove.", tone: "rare" };
      }
      return { id: logSequence++, text: `${CONTENT.quests[event.questId]?.name ?? "The thread"} is complete.`, tone: "rare" };
    case "activity_stopped":
      if (event.reason === "none" || event.reason === "cancelled" || event.reason === "target_defeated") return null;
      return { id: logSequence++, text: `Activity stopped: ${event.reason.replaceAll("_", " ")}`, tone: "warning" };
    case "player_died":
      return { id: logSequence++, text: "You were defeated. Return prepared.", tone: "warning" };
    default:
      return null;
  }
}

function appendLogs(existing: readonly LogEntry[], events: readonly GameEvent[]): readonly LogEntry[] {
  const entries = events.map(eventLog).filter((entry): entry is LogEntry => entry !== null);
  return [...existing, ...entries].slice(-8);
}

function withWallClock(save: GameSave, now: number): GameSave {
  return { ...save, lastActiveAt: now };
}

function scheduleSave(reason: string, delayMs = 1200, backup = false): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void useGameStore.getState().saveNow(reason, backup);
  }, delayMs);
}

export const useGameStore = create<GameStore>((set, get) => ({
  status: "booting",
  save: null,
  loadError: null,
  saveError: null,
  saveStatus: "idle",
  offlineReport: null,
  panel: "inventory",
  panelOpen: false,
  selectedTargetId: null,
  logs: [],
  debug: { grid: false, blocked: false, interactions: false },

  initialize: async () => {
    if (initializing) return initializing;
    initializing = (async () => {
      try {
        const now = Date.now();
        let save = await loadSave();
        let offlineReport: ActivityReport | null = null;
        let logs: readonly LogEntry[] = [];
        if (!save) {
          save = createNewSave(now, seedFromCrypto(), CONTENT.zones.meadowrest?.spawn ?? { x: 19, z: 16 });
          await writeSave(save, "new-game", false);
        } else {
          const elapsed = calculateOfflineElapsed(now, save.lastActiveAt);
          const result = advanceSimulation(save, elapsed, CONTENT);
          save = { ...result.state, lastActiveAt: now, lastSavedAt: now };
          logs = appendLogs(logs, result.events);
          if (elapsed >= 10_000 && (result.report.productiveMs > 0 || result.report.stopReason !== "none")) {
            offlineReport = result.report;
          }
          await writeSave(save, "offline-return", true);
        }
        set({ status: "ready", save, offlineReport, logs, loadError: null, saveError: null, saveStatus: "saved" });
      } catch (error) {
        set({ status: "error", loadError: error instanceof Error ? error.message : String(error) });
      }
    })();
    return initializing;
  },

  beginIntro: () => {
    const save = get().save;
    if (!save) return;
    set({ save: { ...save, worldFlags: { ...save.worldFlags, intro_seen: true } } });
    scheduleSave("intro", 0, true);
  },

  setPosition: (position, facing) => {
    const save = get().save;
    if (!save) return;
    set({
      save: {
        ...save,
        position: {
          x: position.x,
          z: position.z,
          facingX: facing?.x ?? save.position.facingX,
          facingZ: facing?.z ?? save.position.facingZ,
        },
      },
    });
    scheduleSave("movement", 2000);
  },

  setSelectedTarget: (selectedTargetId) => set({ selectedTargetId }),

  pickup: (targetId) => {
    const save = get().save;
    if (!save) return false;
    const result = pickupGroundItem(save, targetId, CONTENT);
    set({
      save: result.state,
      logs: result.ok ? appendLogs(get().logs, result.events) : [
        ...get().logs,
        { id: logSequence++, text: result.reason.replaceAll("_", " "), tone: "warning" as const },
      ].slice(-8),
    });
    if (result.ok) scheduleSave("ground-item", 0, true);
    return result.ok;
  },

  equip: (itemId) => {
    const save = get().save;
    if (!save) return false;
    const result = equipItem(save, itemId, CONTENT);
    set({
      save: result.state,
      logs: result.ok ? appendLogs(get().logs, result.events) : [
        ...get().logs,
        { id: logSequence++, text: result.reason.replaceAll("_", " "), tone: "warning" as const },
      ].slice(-8),
    });
    if (result.ok) scheduleSave("equipment", 0, true);
    return result.ok;
  },

  interact: (targetId) => {
    const save = get().save;
    if (!save) return false;
    const result = recordWorldInteraction(save, targetId, CONTENT);
    set({ save: result.state, logs: appendLogs(get().logs, result.events) });
    if (result.ok) scheduleSave("world-interaction", 0, true);
    return result.ok;
  },

  startTargetActivity: (targetId) => {
    const save = get().save;
    if (!save) return false;
    const result = startActivityForTarget(save, targetId, CONTENT);
    set({
      save: result.state,
      logs: result.ok ? get().logs : [
        ...get().logs,
        {
          id: logSequence++,
          text: result.reason === "missing_tool" ? "You need the correct tool equipped." : "That cannot be used right now.",
          tone: "warning" as const,
        },
      ].slice(-8),
    });
    if (result.ok) scheduleSave("activity-start", 0, true);
    return result.ok;
  },

  cancelCurrentActivity: () => {
    const save = get().save;
    if (!save) return;
    const result = cancelActivity(save);
    set({ save: result.state, logs: appendLogs(get().logs, result.events) });
    scheduleSave("activity-cancel", 0);
  },

  consumeFood: (itemId) => {
    const save = get().save;
    if (!save) return false;
    const result = useFood(save, itemId, CONTENT);
    set({ save: result.state, logs: appendLogs(get().logs, result.events) });
    if (result.ok) scheduleSave("use-food", 0);
    return result.ok;
  },

  tick: (elapsedMs) => {
    const save = get().save;
    if (!save || elapsedMs <= 0) return;
    const result = advanceSimulation(save, Math.min(1000, elapsedMs), CONTENT);
    const important = result.events.some((event) =>
      event.type === "item_gained" ||
      event.type === "quest_advanced" ||
      event.type === "quest_completed" ||
      event.type === "player_died" ||
      event.type === "enemy_defeated" ||
      event.type === "activity_stopped");
    set({
      save: withWallClock(result.state, Date.now()),
      logs: result.events.length > 0 ? appendLogs(get().logs, result.events) : get().logs,
    });
    if (important) scheduleSave("game-event", 100, true);
  },

  setPanel: (panel) => set({ panel, panelOpen: true }),
  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
  dismissOfflineReport: () => set({ offlineReport: null }),

  resumeFromBackground: async () => {
    const save = get().save;
    if (!save) return;
    const now = Date.now();
    const elapsed = calculateOfflineElapsed(now, save.lastActiveAt);
    if (elapsed < 1_000) return;
    const result = advanceSimulation(save, elapsed, CONTENT);
    const next = { ...result.state, lastActiveAt: now, lastSavedAt: now };
    const offlineReport = elapsed >= 10_000 &&
      (result.report.productiveMs > 0 || result.report.stopReason !== "none")
      ? result.report
      : get().offlineReport;
    set({
      save: next,
      offlineReport,
      logs: result.events.length > 0 ? appendLogs(get().logs, result.events) : get().logs,
    });
    await get().saveNow("visibility-return", true);
  },

  saveNow: async (reason, backup = false) => {
    const save = get().save;
    if (!save) return;
    const now = Date.now();
    const next = { ...save, lastActiveAt: now, lastSavedAt: now };
    set({ saveStatus: "saving", saveError: null });
    try {
      await writeSave(next, reason, backup);
      set((current) => ({
        save: current.save ? { ...current.save, lastSavedAt: now } : current.save,
        saveStatus: "saved",
        saveError: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ saveStatus: "error", saveError: message });
      if (import.meta.env.DEV) console.error("Everloom save failed:", error);
    }
  },

  exportSave: () => {
    const save = get().save;
    if (!save) return;
    const blob = new Blob([serializeSave(save)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `everloom-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },

  importSaveText: async (text) => {
    const imported = deserializeSave(text);
    const now = Date.now();
    const elapsed = calculateOfflineElapsed(now, imported.lastActiveAt);
    const result = advanceSimulation(imported, elapsed, CONTENT);
    const save = { ...result.state, lastActiveAt: now, lastSavedAt: now };
    await writeSave(save, "import", true);
    set({
      save,
      status: "ready",
      offlineReport: elapsed >= 10_000 ? result.report : null,
      logs: appendLogs([], result.events),
      saveError: null,
    });
  },

  resetSave: async () => {
    await clearSaves();
    const now = Date.now();
    const save = createNewSave(now, seedFromCrypto(), CONTENT.zones.meadowrest?.spawn ?? { x: 19, z: 16 });
    await writeSave(save, "reset", false);
    set({
      status: "ready",
      save,
      offlineReport: null,
      logs: [],
      panelOpen: false,
      selectedTargetId: null,
      saveError: null,
    });
  },

  setQuality: (quality) => {
    const save = get().save;
    if (!save) return;
    set({ save: { ...save, settings: { ...save.settings, quality } } });
    scheduleSave("settings", 0);
  },

  setDebugFlag: (flag, value) => set((state) => ({ debug: { ...state.debug, [flag]: value } })),

  debugAddItem: (itemId, quantity) => {
    const save = get().save;
    if (!save) return;
    const inventory = addItem(save.inventory, save.inventorySlots, itemId, quantity, CONTENT);
    if (!inventory) return;
    const event: GameEvent = { type: "item_gained", itemId, quantity, sourceId: "debug" };
    const quests = applyQuestEvents({ ...save, inventory }, [event], CONTENT);
    set({ save: quests.state, logs: appendLogs(get().logs, [event, ...quests.questEvents]) });
  },

  debugEmptyInventory: () => {
    const save = get().save;
    if (save) set({ save: { ...save, inventory: [] } });
  },

  debugFillInventory: () => {
    const save = get().save;
    if (!save) return;
    const inventory = addItem([], save.inventorySlots, "meadow_log", save.inventorySlots * 99, CONTENT);
    if (inventory) set({ save: { ...save, inventory } });
  },

  debugDamagePlayer: () => {
    const save = get().save;
    if (save) set({ save: { ...save, player: { ...save.player, hp: Math.max(0, save.player.hp - 5) } } });
  },

  debugSimulateOffline: (elapsedMs) => {
    const save = get().save;
    if (!save) return;
    const result = advanceSimulation(save, elapsedMs, CONTENT);
    set({
      save: { ...result.state, lastActiveAt: Date.now() },
      offlineReport: result.report,
      logs: appendLogs(get().logs, result.events),
    });
    scheduleSave("debug-offline", 0, true);
  },

  // Runs skills through the exact same xp_gained/level_gained event pipeline as
  // real gameplay (just without waiting), so the attunement gate advances for
  // real instead of being faked. Dev/test-only; gated behind the debug flag and
  // the __EVERLOOM_TEST__ hook, same as the other debug* helpers above.
  debugAttuneSkills: () => {
    const save = get().save;
    if (!save) return;
    const targetXp = xpForLevel(5);
    let next = save;
    const events: GameEvent[] = [];
    for (const skill of Object.keys(next.skills) as SkillId[]) {
      const previousXp = next.skills[skill].xp;
      if (previousXp >= targetXp) continue;
      const previousLevel = levelFromXp(previousXp);
      next = { ...next, skills: { ...next.skills, [skill]: { xp: targetXp } } };
      events.push({ type: "xp_gained", skill, amount: targetXp - previousXp });
      const nextLevel = levelFromXp(targetXp);
      if (nextLevel > previousLevel) events.push({ type: "level_gained", skill, from: previousLevel, to: nextLevel });
    }
    const applied = applyQuestEvents(next, events, CONTENT);
    set({ save: applied.state, logs: appendLogs(get().logs, [...events, ...applied.questEvents]) });
    scheduleSave("debug-attune", 0, true);
  },

  debugCompleteQuest: (questId) => {
    const save = get().save;
    if (!save) return;
    try {
      const nextState = forceCompleteQuest(save, questId, CONTENT);
      if (nextState === save) return;
      set({ save: nextState, logs: appendLogs(get().logs, [{ type: "quest_completed", questId }]) });
      scheduleSave("debug-complete-quest", 0, true);
    } catch (error) {
      if (import.meta.env.DEV) console.error("debugCompleteQuest failed:", error);
    }
  },
}));

export function inventoryCount(save: GameSave | null, itemId: string): number {
  return save ? itemQuantity(save.inventory, itemId) : 0;
}
