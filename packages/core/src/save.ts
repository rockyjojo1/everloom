import { emptySkills } from "./progression";
import { SAVE_VERSION, type GameSave, type GridPosition } from "./types";

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

export function migrateSave(value: unknown): GameSave {
  if (!value || typeof value !== "object") throw new Error("Save is not an object.");
  const candidate = value as Partial<GameSave> & { saveVersion?: unknown };
  if (candidate.saveVersion !== SAVE_VERSION) {
    throw new Error(`Unsupported save version: ${String(candidate.saveVersion)}`);
  }
  if (!candidate.player || !candidate.position || !candidate.currentZone || !candidate.rngSeed) {
    throw new Error("Save is missing required identity or world fields.");
  }
  if (!Array.isArray(candidate.inventory) || !candidate.skills || !candidate.equipment || !candidate.settings) {
    throw new Error("Save is missing required progression fields.");
  }
  return candidate as GameSave;
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
