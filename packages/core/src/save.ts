import {
  ATTUNEMENT_REQUIRED_LEVEL,
  ATTUNEMENT_SKILL_COUNT,
  countAttunedSkills,
  emptySkills,
} from "./progression";
import { SAVE_VERSION, type GameSave, type GridPosition, type QuestProgress } from "./types";

export function createNewSave(
  nowMs: number,
  rngSeed: string,
  spawn: GridPosition = { x: 19, z: 16 },
): GameSave {
  const safeNow = Number.isFinite(nowMs) && nowMs >= 0 ? Math.floor(nowMs) : 0;
  return {
    saveVersion: SAVE_VERSION,
    player: { id: "local-player", name: "Wanderer", hp: 24, maxHp: 24 },
    position: { ...spawn, facingX: 0, facingZ: 1 },
    currentZone: "meadowrest",
    inventory: [],
    inventorySlots: 18,
    equipment: { tool: null, weapon: null, body: null },
    skills: emptySkills(),
    mastery: {},
    quests: {
      first_thread: { status: "active", stepIndex: 0, stepProgress: 0 },
    },
    worldFlags: {},
    worldResources: {},
    worldEnemies: {},
    collections: [],
    currentActivity: null,
    activitySequence: 0,
    rngSeed,
    simulationTimeMs: 0,
    lastSavedAt: safeNow,
    lastActiveAt: safeNow,
    settings: {
      quality: "standard",
      musicVolume: 0.55,
      effectsVolume: 0.7,
      reducedMotion: false,
    },
  };
}

export function calculateOfflineElapsed(nowMs: number, lastActiveAt: number): number {
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastActiveAt)) return 0;
  const now = Math.max(0, Math.floor(nowMs));
  const last = Math.max(0, Math.floor(lastActiveAt));
  if (now <= last) return 0;
  return now - last;
}

/**
 * Phase Two saves (version 1) predate the Verdant Loomstone quest and know
 * nothing of it. If a returning player already completed The First Thread we
 * seed the new quest exactly as it would look had they always had it: the
 * "attune" step recomputed from their real, already-earned skill levels (so a
 * player who is already fully attuned is not asked to re-grind anything), and
 * every later step untouched because those require real, fresh actions
 * (talking to Mara, touching the new Loomstone) that a legacy save can't have
 * already performed.
 */
function migrateV1ToV2(save: GameSave): GameSave {
  const first = save.quests.first_thread;
  if (first?.status !== "completed" || save.quests.verdant_loomstone) {
    return { ...save, saveVersion: SAVE_VERSION };
  }
  const attuned = countAttunedSkills(save.skills, ATTUNEMENT_REQUIRED_LEVEL);
  const verdantProgress: QuestProgress = attuned >= ATTUNEMENT_SKILL_COUNT
    ? { status: "active", stepIndex: 1, stepProgress: 0 }
    : { status: "active", stepIndex: 0, stepProgress: attuned };
  return {
    ...save,
    saveVersion: SAVE_VERSION,
    quests: { ...save.quests, verdant_loomstone: verdantProgress },
  };
}

export function migrateSave(value: unknown): GameSave {
  if (!value || typeof value !== "object") throw new Error("Save is not an object.");
  const candidate = value as Omit<Partial<GameSave>, "saveVersion"> & { saveVersion?: unknown };
  if (candidate.saveVersion !== SAVE_VERSION && candidate.saveVersion !== 1) {
    throw new Error(`Unsupported save version: ${String(candidate.saveVersion)}`);
  }
  if (!candidate.player || !candidate.position || !candidate.currentZone || !candidate.rngSeed) {
    throw new Error("Save is missing required identity or world fields.");
  }
  if (!Array.isArray(candidate.inventory) || !candidate.skills || !candidate.equipment || !candidate.settings) {
    throw new Error("Save is missing required progression fields.");
  }
  const normalized = candidate as GameSave;
  return candidate.saveVersion === 1 ? migrateV1ToV2(normalized) : normalized;
}

export function serializeSave(state: GameSave): string {
  return JSON.stringify(state, null, 2);
}

export function deserializeSave(text: string): GameSave {
  try {
    return migrateSave(JSON.parse(text) as unknown);
  } catch (error) {
    throw new Error(`Could not import Everloom save: ${error instanceof Error ? error.message : String(error)}`);
  }
}
