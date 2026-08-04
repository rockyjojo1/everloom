import { deterministicRange, deterministicRollPpm } from "./rng";
import {
  EXPEDITION_KERNEL_SCHEMA_VERSION,
  DeterministicExpeditionError,
  validateDeterministicExpeditionPlan,
  validateDeterministicExpeditionProgress,
  validateDeterministicExpeditionStartingState,
  type DeterministicExpeditionActionKind,
  type DeterministicExpeditionDelta,
  type DeterministicExpeditionPlan,
  type DeterministicExpeditionProgress,
  type DeterministicExpeditionResolution,
  type DeterministicExpeditionStartingState,
  type DeterministicExpeditionStatus,
  type DeterministicExpeditionStopReason,
} from "./expedition-contract";

export { EXPEDITION_KERNEL_SCHEMA_VERSION } from "./expedition-contract";
export type {
  DeterministicExpeditionActionKind,
  DeterministicExpeditionDelta,
  DeterministicExpeditionPlan,
  DeterministicExpeditionProgress,
  DeterministicExpeditionResolution,
  DeterministicExpeditionRules,
  DeterministicExpeditionStartingState,
  DeterministicExpeditionStatus,
  DeterministicExpeditionStopReason,
} from "./expedition-contract";

/**
 * Pure deterministic expedition resolution kernel.
 *
 * Guarantees (the "deterministic core contract"):
 *  - No ambient time or randomness is read; every input is injected.
 *  - No identities are generated; no mutation of inputs; outputs are fresh.
 *  - Identical input always produces identical output.
 *  - One-shot resolution equals chunked resolution: resolving a total amount
 *    of elapsed time in a single call produces the same result as resolving it
 *    as any sequence of partitions with the same total.
 *
 * Time model:
 *  - `elapsedResolvedMs` advances only when a full action commits.
 *  - An action that spans a chunk boundary is carried in `partialAction` as
 *    `{ kind, actionSequence, elapsedInActionMs }`. `actionSequence` pins the
 *    RNG stream, so the resumed action never re-rolls; `elapsedInActionMs`
 *    records how much of the action was already consumed. On completion the
 *    full action duration is committed to `elapsedResolvedMs` and the RNG
 *    sequence advances by exactly one, identical to the one-shot path.
 */

// ============================================================================
// Action helpers
// ============================================================================

type ActionKind = DeterministicExpeditionActionKind;

/**
 * The kernel mutates only a fresh working copy of the progress so the caller's
 * inputs are never modified. This type strips readonly from the contract shape.
 */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * Schedules the next action for `work.nextActionSequence`. Returns null when
 * there is no remaining time budget inside the plan.
 */
function scheduleNextAction(
  plan: DeterministicExpeditionPlan,
  work: DeterministicExpeditionProgress,
): { kind: ActionKind; durationMs: number } | null {
  const rules = plan.rules;
  const remainingAvailableMs = plan.requestedDurationMs - work.elapsedResolvedMs;
  const nextWindowMs = Math.min(rules.gatheringWindowMs, remainingAvailableMs);
  if (nextWindowMs <= 0) return null;

  const encounter = deterministicRollPpm(
    plan.seed,
    work.nextActionSequence,
    "expedition_encounter",
    plan.activityId,
    rules.encounterChancePpm,
  );
  if (encounter && nextWindowMs >= rules.combatDurationMs) {
    return { kind: "encounter", durationMs: rules.combatDurationMs };
  }
  return { kind: "gathering", durationMs: nextWindowMs };
}

function foodConsumedBetween(intervalMs: number, fromMs: number, toMs: number): number {
  const to = Math.floor(toMs / intervalMs);
  const from = Math.floor(fromMs / intervalMs);
  return Math.max(0, to - from);
}

/**
 * Commits a completed encounter. Damage is re-derived from the pinned action
 * sequence so chunked and one-shot resolution agree exactly.
 */
function completeEncounter(
  plan: DeterministicExpeditionPlan,
  work: Mutable<DeterministicExpeditionProgress>,
  actionSequence: number,
): DeterministicExpeditionStopReason | null {
  const rules = plan.rules;
  const damage = deterministicRange(
    plan.seed,
    actionSequence,
    "wolf_damage",
    plan.activityId,
    rules.enemyDamageMin,
    rules.enemyDamageMax,
  );

  work.encounters += 1;
  work.encountersWon += 1;
  work.combatXpGained += rules.combatXpPerWin;
  work.damageTaken += damage;
  work.health = Math.max(0, work.health - damage);
  work.combatInterruptionMs += rules.combatDurationMs;
  work.elapsedResolvedMs += rules.combatDurationMs;
  work.nextActionSequence = actionSequence + 1;
  work.partialAction = null;

  if (work.health <= rules.minimumHealthToContinue) {
    return "health_critical";
  }
  return null;
}

/**
 * Commits a completed gathering window. Order of side effects is fixed:
 *  1. inventory capacity is checked BEFORE the award (no invalid overflow),
 *  2. the award is committed,
 *  3. food is consumed across the cumulative clock, never going negative.
 */
function completeGathering(
  plan: DeterministicExpeditionPlan,
  work: Mutable<DeterministicExpeditionProgress>,
  durationMs: number,
): DeterministicExpeditionStopReason | null {
  const rules = plan.rules;

  const stackCanFit = work.existingResourceStackPresent || work.inventoryUsedSlots < rules.inventorySlotLimit;
  if (!stackCanFit) {
    return "inventory_full";
  }

  const elapsedBeforeMs = work.elapsedResolvedMs;
  work.resourcesObtained += rules.resourceQuantityPerGather;
  work.resourceXpGained += rules.resourceXpPerGather;
  work.productiveGatheringMs += durationMs;
  work.elapsedResolvedMs += durationMs;
  work.nextActionSequence += 1;
  work.partialAction = null;

  const foodNeeded = foodConsumedBetween(rules.foodConsumptionIntervalMs, elapsedBeforeMs, elapsedBeforeMs + durationMs);
  const foodConsumedNow = Math.min(work.availableFood, foodNeeded);
  work.availableFood -= foodConsumedNow;
  work.foodConsumed += foodConsumedNow;

  if (foodConsumedNow < foodNeeded) {
    return "food_exhausted";
  }
  return null;
}

// ============================================================================
// Entry points
// ============================================================================

export function createDeterministicExpeditionProgress(
  plan: DeterministicExpeditionPlan,
  startingState: DeterministicExpeditionStartingState,
): DeterministicExpeditionProgress {
  validateDeterministicExpeditionPlan(plan);
  validateDeterministicExpeditionStartingState(startingState);

  const progress: DeterministicExpeditionProgress = {
    schemaVersion: EXPEDITION_KERNEL_SCHEMA_VERSION,
    expeditionId: plan.expeditionId,
    elapsedResolvedMs: 0,
    partialAction: null,
    nextActionSequence: 0,
    health: startingState.startingHealth,
    inventoryUsedSlots: startingState.startingInventoryUsedSlots,
    existingResourceStackPresent: startingState.existingResourceStackPresent,
    availableFood: startingState.availableFood,
    resourcesObtained: 0,
    resourceXpGained: 0,
    combatXpGained: 0,
    encounters: 0,
    encountersWon: 0,
    encountersLost: 0,
    damageTaken: 0,
    foodConsumed: 0,
    productiveGatheringMs: 0,
    combatInterruptionMs: 0,
    status: "active",
    stopReason: null,
  };
  validateDeterministicExpeditionProgress(progress);
  return progress;
}

export function resolveDeterministicExpedition(
  plan: DeterministicExpeditionPlan,
  currentProgress: DeterministicExpeditionProgress,
  requestedElapsedMs: number,
): DeterministicExpeditionResolution {
  validateDeterministicExpeditionPlan(plan);
  validateDeterministicExpeditionProgress(currentProgress);

  if (!Number.isSafeInteger(requestedElapsedMs) || requestedElapsedMs < 0) {
    throw new DeterministicExpeditionError(
      "invalid_elapsed",
      `requestedElapsedMs must be a non-negative safe integer; received ${String(requestedElapsedMs)}`,
    );
  }
  if (currentProgress.expeditionId !== plan.expeditionId) {
    throw new DeterministicExpeditionError(
      "plan_progress_mismatch",
      `progress.expeditionId (${currentProgress.expeditionId}) does not match plan.expeditionId (${plan.expeditionId})`,
    );
  }
  if (currentProgress.schemaVersion !== plan.schemaVersion) {
    throw new DeterministicExpeditionError(
      "schema_mismatch",
      `progress schemaVersion (${currentProgress.schemaVersion}) does not match plan schemaVersion (${plan.schemaVersion})`,
    );
  }
  if (currentProgress.elapsedResolvedMs + requestedElapsedMs > plan.requestedDurationMs) {
    throw new DeterministicExpeditionError(
      "invalid_elapsed",
      `requestedElapsedMs (${requestedElapsedMs}) would exceed requestedDurationMs (${plan.requestedDurationMs})`,
    );
  }

  // Terminal expeditions and zero elapsed are pure no-ops.
  if (currentProgress.status !== "active" || requestedElapsedMs === 0) {
    return {
      progress: currentProgress,
      delta: emptyDelta(currentProgress),
    };
  }

  const work: Mutable<DeterministicExpeditionProgress> = structuredClone(currentProgress);
  let budget = requestedElapsedMs;
  let stopReason: DeterministicExpeditionStopReason = null;

  if (work.health <= plan.rules.minimumHealthToContinue) {
    stopReason = "health_critical";
  }

  while (budget > 0 && stopReason === null) {
    const partial = work.partialAction;
    if (partial !== null) {
      if (partial.kind === "encounter") {
        const fullDurationMs = plan.rules.combatDurationMs;
        const remainingInActionMs = Math.max(0, fullDurationMs - partial.elapsedInActionMs);
        if (budget >= remainingInActionMs) {
          budget -= remainingInActionMs;
          stopReason = completeEncounter(plan, work, partial.actionSequence);
        } else {
          work.partialAction = {
            kind: "encounter",
            actionSequence: partial.actionSequence,
            elapsedInActionMs: partial.elapsedInActionMs + budget,
          };
          budget = 0;
        }
      } else {
        const fullDurationMs = Math.min(
          plan.rules.gatheringWindowMs,
          plan.requestedDurationMs - work.elapsedResolvedMs,
        );
        const remainingInActionMs = Math.max(0, fullDurationMs - partial.elapsedInActionMs);
        if (budget >= remainingInActionMs) {
          budget -= remainingInActionMs;
          stopReason = completeGathering(plan, work, fullDurationMs);
        } else {
          work.partialAction = {
            kind: "gathering",
            actionSequence: partial.actionSequence,
            elapsedInActionMs: partial.elapsedInActionMs + budget,
          };
          budget = 0;
        }
      }
      continue;
    }

    const action = scheduleNextAction(plan, work);
    if (action === null) {
      break;
    }
    if (budget >= action.durationMs) {
      budget -= action.durationMs;
      if (action.kind === "encounter") {
        stopReason = completeEncounter(plan, work, work.nextActionSequence);
      } else {
        stopReason = completeGathering(plan, work, action.durationMs);
      }
    } else {
      work.partialAction = {
        kind: action.kind,
        actionSequence: work.nextActionSequence,
        elapsedInActionMs: budget,
      };
      budget = 0;
    }
  }

  if (stopReason !== null) {
    work.status = "stopped";
    work.stopReason = stopReason;
  } else if (work.elapsedResolvedMs >= plan.requestedDurationMs) {
    work.status = "completed";
    work.stopReason = "duration_reached";
  } else {
    work.status = "active";
    work.stopReason = null;
  }

  const delta: DeterministicExpeditionDelta = {
    elapsedAppliedMs: work.elapsedResolvedMs - currentProgress.elapsedResolvedMs,
    resourcesObtained: work.resourcesObtained - currentProgress.resourcesObtained,
    resourceXpGained: work.resourceXpGained - currentProgress.resourceXpGained,
    combatXpGained: work.combatXpGained - currentProgress.combatXpGained,
    encounters: work.encounters - currentProgress.encounters,
    encountersWon: work.encountersWon - currentProgress.encountersWon,
    encountersLost: work.encountersLost - currentProgress.encountersLost,
    damageTaken: work.damageTaken - currentProgress.damageTaken,
    foodConsumed: work.foodConsumed - currentProgress.foodConsumed,
    productiveGatheringMs: work.productiveGatheringMs - currentProgress.productiveGatheringMs,
    combatInterruptionMs: work.combatInterruptionMs - currentProgress.combatInterruptionMs,
    startingHealth: currentProgress.health,
    endingHealth: work.health,
    statusBefore: currentProgress.status,
    statusAfter: work.status,
    stopReason: work.stopReason,
  };

  return { progress: work, delta };
}

function emptyDelta(progress: DeterministicExpeditionProgress): DeterministicExpeditionDelta {
  return {
    elapsedAppliedMs: 0,
    resourcesObtained: 0,
    resourceXpGained: 0,
    combatXpGained: 0,
    encounters: 0,
    encountersWon: 0,
    encountersLost: 0,
    damageTaken: 0,
    foodConsumed: 0,
    productiveGatheringMs: 0,
    combatInterruptionMs: 0,
    startingHealth: progress.health,
    endingHealth: progress.health,
    statusBefore: progress.status,
    statusAfter: progress.status,
    stopReason: progress.stopReason,
  };
}
