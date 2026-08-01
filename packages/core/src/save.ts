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
    player: { id: "local-player", name: "Wanderer", appearanceId: "meadow", hp: 24, maxHp: 24 },
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
function seedVerdantQuestForV1(save: GameSave): GameSave {
  const first = save.quests.first_thread;
  if (first?.status !== "completed" || save.quests.verdant_loomstone) {
    return save;
  }
  const attuned = countAttunedSkills(save.skills, ATTUNEMENT_REQUIRED_LEVEL);
  const verdantProgress: QuestProgress = attuned >= ATTUNEMENT_SKILL_COUNT
    ? { status: "active", stepIndex: 1, stepProgress: 0 }
    : { status: "active", stepIndex: 0, stepProgress: attuned };
  return {
    ...save,
    quests: { ...save.quests, verdant_loomstone: verdantProgress },
  };
}

/**
 * Version 3 introduces Smithing and renames the cooking-only activity shape to
 * production. Preserve every earned value while supplying the new zero-XP
 * skill and converting an action in progress without resetting its timer.
 *
 * This function's output saveVersion is intentionally still an internal
 * mid-pipeline value, not necessarily the current SAVE_VERSION — migrateSave
 * chains it into migrateV3ToV4 below before returning to the caller.
 */
function migrateLegacyToV3(save: GameSave, sourceVersion: 1 | 2): Omit<GameSave, "saveVersion"> & { saveVersion: 3 } {
  const questSeeded = sourceVersion === 1 ? seedVerdantQuestForV1(save) : save;
  const legacyActivity = questSeeded.currentActivity as GameSave["currentActivity"] | {
    readonly type: "cooking";
    readonly targetId: string;
    readonly recipeId: string;
    readonly progressMs: number;
  };
  const currentActivity = legacyActivity?.type === "cooking"
    ? { ...legacyActivity, type: "production" as const }
    : legacyActivity;
  return {
    ...questSeeded,
    saveVersion: 3,
    skills: {
      ...questSeeded.skills,
      smithing: questSeeded.skills.smithing ?? { xp: 0 },
    },
    currentActivity,
  };
}

/** Number of authored steps in the "forge_trade" quest, mirrored here so a
 * grandfathered-completed QuestProgress can report a sensible stepIndex
 * without save.ts importing @everloom/content (which would create a
 * package cycle, since content depends on core's types). The exact value
 * is asserted against the real authored quest in content-validation.test.ts. */
const FORGE_TRADE_STEP_COUNT = 4;

/**
 * Version 4 inserts a new Smithing tutorial quest, "The Forge's Trade", into
 * the chain between The First Thread and The Verdant Loomstone
 * (first_thread -> forge_trade -> verdant_loomstone -> groves_gift). Saves
 * that already progressed past that insertion point under the old two-link
 * chain must not be asked to backtrack into content they have already
 * effectively passed; saves still mid-First-Thread need no change at all,
 * since first_thread.nextQuestId now resolves to forge_trade naturally the
 * moment they complete it through the ordinary quest-completion path.
 */
type V4Save = Omit<GameSave, "saveVersion" | "player"> & {
  readonly saveVersion: 4;
  readonly player: Omit<GameSave["player"], "appearanceId">;
};

function migrateV3ToV4(save: Omit<GameSave, "saveVersion"> & { saveVersion: 3 | 4 }): V4Save {
  if (save.quests.forge_trade) {
    // Already migrated (defensive no-op for idempotent re-application, and
    // for a save that reached v4 through some other path already holding it).
    return { ...save, saveVersion: 4 } as V4Save;
  }
  const verdant = save.quests.verdant_loomstone;
  if (verdant) {
    // Grandfather: this save already moved past the old first_thread ->
    // verdant_loomstone link (active or completed), so forge_trade is
    // treated as already done rather than inserted retroactively.
    return {
      ...save,
      saveVersion: 4,
      quests: {
        ...save.quests,
        forge_trade: { status: "completed", stepIndex: FORGE_TRADE_STEP_COUNT, stepProgress: 0 },
      },
      worldFlags: { ...save.worldFlags, forge_trade_completed: true },
    };
  }
  const first = save.quests.first_thread;
  if (first?.status === "completed") {
    // Completed First Thread with no Verdant quest yet: give them the new
    // step exactly where it now belongs in the chain, freshly active.
    return {
      ...save,
      saveVersion: 4,
      quests: { ...save.quests, forge_trade: { status: "active", stepIndex: 0, stepProgress: 0 } },
    };
  }
  // Still mid-First-Thread (or some other pre-completion state): nothing to
  // change here. The new quest link takes effect naturally, with no
  // step-index remapping, the moment they complete First Thread for real.
  return { ...save, saveVersion: 4 } as V4Save;
}

function migrateV4ToV5(save: V4Save): GameSave {
  return {
    ...save,
    saveVersion: SAVE_VERSION,
    player: { ...save.player, appearanceId: "meadow" },
  };
}

export function migrateSave(value: unknown): GameSave {
  if (!value || typeof value !== "object") throw new Error("Save is not an object.");
  const candidate = value as Omit<Partial<GameSave>, "saveVersion"> & { saveVersion?: unknown };
  const version = candidate.saveVersion;
  if (version !== SAVE_VERSION && version !== 4 && version !== 3 && version !== 2 && version !== 1) {
    throw new Error(`Unsupported save version: ${String(version)}`);
  }
  if (!candidate.player || !candidate.position || !candidate.currentZone || !candidate.rngSeed) {
    throw new Error("Save is missing required identity or world fields.");
  }
  if (!Array.isArray(candidate.inventory) || !candidate.skills || !candidate.equipment || !candidate.settings) {
    throw new Error("Save is missing required progression fields.");
  }
  if (version === SAVE_VERSION) return candidate as GameSave;
  if (version === 4) return migrateV4ToV5(candidate as unknown as V4Save);
  const atV3 = version === 3
    ? (candidate as Omit<GameSave, "saveVersion"> & { saveVersion: 3 })
    : migrateLegacyToV3(candidate as GameSave, version);
  return migrateV4ToV5(migrateV3ToV4(atV3));
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
