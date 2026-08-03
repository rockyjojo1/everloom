import { deterministicRange, deterministicRollPpm } from "./rng";
import { type ExpeditionActivity, type ExpeditionResult, type GameSave, type SkillId } from "./types";

const WOODCUTTING_SKILL: SkillId = "woodcutting";
const MELEE_COMBAT_SKILL: SkillId = "melee";

const GATHERING_WINDOW_MS = 30_000;
const ENCOUNTER_CHANCE_PPM = 150_000;
const COMBAT_DURATION_MS = 15_000;
const FOOD_CONSUMPTION_MS = 120_000;
const LOGS_PER_ACTION = 1;
const WOODCUTTING_XP_PER_LOG = 25;
const COMBAT_XP_PER_WIN = 50;
const WOLF_DAMAGE_MIN = 8;
const WOLF_DAMAGE_MAX = 12;

export function startExpedition(
  save: GameSave,
  locationId: string,
  activityId: string,
  requestedDurationMs: number,
): { state: GameSave; expeditionId: string } {
  const expeditionId = `exp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const expedition: ExpeditionActivity = {
    type: "expedition",
    expeditionId,
    locationId,
    activityId,
    startedAtMs: save.simulationTimeMs,
    requestedDurationMs: Math.max(5000, Math.min(3600000, requestedDurationMs)),
    expeditionSeed: save.rngSeed,
    progressMs: 0,
  };

  return {
    state: { ...save, activeExpedition: expedition },
    expeditionId,
  };
}

export function resolveExpedition(
  save: GameSave,
  elapsedMs: number,
): { state: GameSave; result: ExpeditionResult; claimId: string } | null {
  if (!save.activeExpedition) return null;

  const exp = save.activeExpedition;
  const requestedDurationMs = exp.requestedDurationMs;
  const maxDurationMs = Math.min(elapsedMs, requestedDurationMs);

  let logsObtained = 0;
  let woodcuttingXpGained = 0;
  let combatXpGained = 0;
  let wolfEncounters = 0;
  let wolfDefeats = 0;
  let damagePlayerTaken = 0;
  let foodConsumed = 0;
  let elapsedProductiveMs = 0;
  let elapsedCombatMs = 0;
  let currentHealth = save.player.hp;
  let foodRemaining = countFood(save.inventory);
  let stopReason: "duration_reached" | "inventory_full" | "food_exhausted" | "health_critical" | "activity_invalid" = "duration_reached";
  let actionSeq = 0;

  let timeMs = 0;
  while (timeMs < maxDurationMs && currentHealth > 0) {
    const remainingMs = maxDurationMs - timeMs;
    const nextWindowMs = Math.min(GATHERING_WINDOW_MS, remainingMs);

    // Attempt encounter with deterministic RNG (use activityId for deterministic hash)
    const encounterRoll = deterministicRollPpm(
      exp.expeditionSeed,
      actionSeq,
      "expedition_encounter",
      exp.activityId,
      ENCOUNTER_CHANCE_PPM,
    );

    if (encounterRoll && nextWindowMs >= COMBAT_DURATION_MS) {
      wolfEncounters++;
      const combatMs = COMBAT_DURATION_MS;
      const damage = deterministicRange(
        exp.expeditionSeed,
        actionSeq,
        "wolf_damage",
        exp.activityId,
        WOLF_DAMAGE_MIN,
        WOLF_DAMAGE_MAX,
      );
      damagePlayerTaken += damage;
      currentHealth = Math.max(0, currentHealth - damage);
      combatXpGained += COMBAT_XP_PER_WIN;
      wolfDefeats++;
      elapsedCombatMs += combatMs;
      timeMs += combatMs;
      actionSeq++;

      if (currentHealth === 0) {
        stopReason = "health_critical";
        break;
      }
    } else {
      const gatherMs = nextWindowMs;
      logsObtained += LOGS_PER_ACTION;
      woodcuttingXpGained += WOODCUTTING_XP_PER_LOG;
      elapsedProductiveMs += gatherMs;
      timeMs += gatherMs;
      actionSeq++;

      const foodNeeded = Math.floor(timeMs / FOOD_CONSUMPTION_MS) - Math.floor((timeMs - gatherMs) / FOOD_CONSUMPTION_MS);
      if (foodNeeded > 0) {
        if (foodRemaining >= foodNeeded) {
          foodRemaining -= foodNeeded;
          foodConsumed += foodNeeded;
        } else {
          stopReason = "food_exhausted";
          break;
        }
      }

      if (logsObtained > save.inventorySlots - currentInventoryUsed(save.inventory)) {
        stopReason = "inventory_full";
        break;
      }
    }
  }

  const claimId = `claim-${exp.expeditionId}-${Date.now()}`;
  const result: ExpeditionResult = {
    expeditionId: exp.expeditionId,
    claimId,
    locationId: exp.locationId,
    activityId: exp.activityId,
    elapsedMs: timeMs,
    productiveGatheringMs: elapsedProductiveMs,
    combatInterruptionMs: elapsedCombatMs,
    resourcesObtained: logsObtained,
    resourceXpGained: woodcuttingXpGained,
    combatXpGained,
    encounters: wolfEncounters,
    encounters_won: wolfDefeats,
    encounters_lost: wolfEncounters - wolfDefeats,
    damagePlayerTaken,
    foodConsumed,
    endingHealth: currentHealth,
    stopReason,
    itemsGained: logsObtained > 0 ? [{ itemId: "log_ironbark", quantity: logsObtained }] : [],
    xpGained: {
      [WOODCUTTING_SKILL]: woodcuttingXpGained,
      [MELEE_COMBAT_SKILL]: combatXpGained,
    },
  };

  let newState = { ...save, player: { ...save.player, hp: currentHealth }, activeExpedition: null };
  if (logsObtained > 0) {
    const existing = newState.inventory.find((s) => s.itemId === "log_ironbark");
    if (existing) {
      newState = {
        ...newState,
        inventory: newState.inventory.map((s) =>
          s.itemId === "log_ironbark" ? { ...s, quantity: s.quantity + logsObtained } : s
        ),
      };
    } else {
      newState = { ...newState, inventory: [...newState.inventory, { itemId: "log_ironbark", quantity: logsObtained }] };
    }
  }
  if (woodcuttingXpGained > 0) {
    newState = {
      ...newState,
      skills: { ...newState.skills, [WOODCUTTING_SKILL]: { xp: newState.skills[WOODCUTTING_SKILL].xp + woodcuttingXpGained } },
    };
  }
  if (combatXpGained > 0) {
    newState = {
      ...newState,
      skills: { ...newState.skills, [MELEE_COMBAT_SKILL]: { xp: newState.skills[MELEE_COMBAT_SKILL].xp + combatXpGained } },
    };
  }
  newState = { ...newState, claimedExpeditions: { ...newState.claimedExpeditions, [claimId]: true } };

  return { state: newState, result, claimId };
}

function countFood(inventory: readonly { readonly itemId: string; readonly quantity: number }[]): number {
  const food = inventory.find((s) => s.itemId === "food-bread");
  return food?.quantity ?? 0;
}

function currentInventoryUsed(inventory: readonly { readonly itemId: string; readonly quantity: number }[]): number {
  return inventory.length;
}
