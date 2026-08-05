import { deterministicRange, deterministicRollPpm } from "./rng";
import {
  EXPEDITION_KERNEL_SCHEMA_VERSION,
  DeterministicExpeditionError,
  validateDeterministicExpeditionPlan,
  validateDeterministicExpeditionProgress,
  validateDeterministicExpeditionProgressAgainstPlan,
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
 * Time model (chronological):
 *  - `elapsedResolvedMs` is the total simulated time already consumed,
 *    *including* time inside the current partial action.
 *  - `partialAction.elapsedInActionMs` describes where that consumed time sits
 *    within the current action (`actionStart = elapsedResolvedMs -
 *    elapsedInActionMs`).
 *  - Every call accepts exactly the requested elapsed it can accommodate and
 *    advances `elapsedResolvedMs` by exactly that amount, so
 *    `delta.elapsedAppliedMs` equals the accepted time and the remaining plan
 *    time is always `requestedDurationMs - elapsedResolvedMs`.
 *  - Elapsed is processed chronologically: actions resolve when they finish,
 *    and food boundaries interrupt the clock exactly when they are crossed.
 *    An action that completes before a boundary earns its outcome.
 *
 * Outcome model:
 *  - Encounters apply damage first; the outcome is decided afterwards. If
 *    post-damage health is above `minimumHealthToContinue` the encounter is
 *    won (combat XP awarded); at or below it the encounter is lost (no XP) and
 *    the expedition stops with `health_critical`. Every encounter is recorded
 *    exactly once, so `encountersWon + encountersLost === encounters`.
 *  - The first resource award that creates a new stack increments
 *    `inventoryUsedSlots` by exactly one and sets
 *    `existingResourceStackPresent`; later awards consume no further slot.
 *  - Food is one cumulative clock across gathering, combat and partial time:
 *    one unit is consumed at each multiple of `foodConsumptionIntervalMs` of
 *    elapsed time. If food is unavailable at a crossed boundary the expedition
 *    stops with `food_exhausted` exactly at the boundary, never advancing past
 *    it and never taking food negative.
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

/**
 * Commits a completed gathering window. Time has already been attributed by the
 * chronological loop; this function applies the award and the inventory/stack
 * mutation. The capacity check runs BEFORE the award, so an overflow never
 * produces an invalid award.
 */
function completeGathering(
  plan: DeterministicExpeditionPlan,
  work: Mutable<DeterministicExpeditionProgress>,
  actionSequence: number,
): DeterministicExpeditionStopReason | null {
  const rules = plan.rules;

  if (!work.existingResourceStackPresent) {
    if (work.inventoryUsedSlots >= rules.inventorySlotLimit) {
      return "inventory_full";
    }
  }

  work.resourcesObtained += rules.resourceQuantityPerGather;
  work.resourceXpGained += rules.resourceXpPerGather;
  if (!work.existingResourceStackPresent) {
    work.inventoryUsedSlots += 1;
    work.existingResourceStackPresent = true;
  }
  work.nextActionSequence = actionSequence + 1;
  work.partialAction = null;
  return null;
}

/**
 * Commits a completed encounter. Damage is re-derived from the pinned action
 * sequence so chunked and one-shot resolution agree exactly, and it is applied
 * before the win/lose outcome is decided. A loss always stops the expedition.
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
  work.damageTaken += damage;
  work.health = Math.max(0, work.health - damage);
  work.nextActionSequence = actionSequence + 1;
  work.partialAction = null;

  if (work.health > rules.minimumHealthToContinue) {
    work.encountersWon += 1;
    work.combatXpGained += rules.combatXpPerWin;
    return null;
  }

  work.encountersLost += 1;
  return "health_critical";
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

  if (startingState.startingInventoryUsedSlots > plan.rules.inventorySlotLimit) {
    throw new DeterministicExpeditionError(
      "invalid_starting_state",
      `startingInventoryUsedSlots (${startingState.startingInventoryUsedSlots}) exceeds inventorySlotLimit (${plan.rules.inventorySlotLimit})`,
    );
  }
  if (startingState.existingResourceStackPresent && startingState.startingInventoryUsedSlots < 1) {
    throw new DeterministicExpeditionError(
      "invalid_starting_state",
      "an existing resource stack must occupy a slot (startingInventoryUsedSlots must be >= 1)",
    );
  }

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
  validateDeterministicExpeditionProgressAgainstPlan(plan, progress);
  return progress;
}

export function resolveDeterministicExpedition(
  plan: DeterministicExpeditionPlan,
  currentProgress: DeterministicExpeditionProgress,
  requestedElapsedMs: number,
): DeterministicExpeditionResolution {
  validateDeterministicExpeditionPlan(plan);
  validateDeterministicExpeditionProgress(currentProgress);
  validateDeterministicExpeditionProgressAgainstPlan(plan, currentProgress);

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

  // Terminal progress and zero elapsed are pure no-ops. This check runs BEFORE
  // the remaining-duration bound so a completed/stopped expedition never
  // errors on a further non-negative request.
  if (currentProgress.status !== "active" || requestedElapsedMs === 0) {
    return {
      progress: currentProgress,
      delta: emptyDelta(currentProgress),
    };
  }

  if (currentProgress.elapsedResolvedMs + requestedElapsedMs > plan.requestedDurationMs) {
    throw new DeterministicExpeditionError(
      "invalid_elapsed",
      `requestedElapsedMs (${requestedElapsedMs}) would exceed requestedDurationMs (${plan.requestedDurationMs})`,
    );
  }

  const work: Mutable<DeterministicExpeditionProgress> = structuredClone(currentProgress);
  const statusBefore: DeterministicExpeditionStatus = work.status;
  const targetMs = work.elapsedResolvedMs + requestedElapsedMs;
  let stopReason: DeterministicExpeditionStopReason = null;

  // An expedition that already starts at or below the health threshold cannot
  // continue: report it immediately without advancing time.
  if (work.health <= plan.rules.minimumHealthToContinue) {
    stopReason = "health_critical";
  }

  // Chronological processing. Every loop iteration advances the clock to the
  // next event: an action completion, a food boundary, or the requested target.
  // The current action's identity (kind, sequence, start and end) is derived
  // once and held across iterations so that an in-flight action is never lost
  // when a mid-action food boundary is crossed.
  let currentKind: ActionKind | null = null;
  let currentSequence = 0;
  let currentStartMs = 0;
  let currentEndMs = 0;

  while (work.elapsedResolvedMs < targetMs && stopReason === null) {
    const rules = plan.rules;

    if (currentKind === null) {
      if (work.partialAction !== null) {
        const partial = work.partialAction;
        currentKind = partial.kind;
        currentSequence = partial.actionSequence;
        currentStartMs = work.elapsedResolvedMs - partial.elapsedInActionMs;
      } else {
        const scheduled = scheduleNextAction(plan, work);
        if (scheduled === null) {
          break;
        }
        currentKind = scheduled.kind;
        currentSequence = work.nextActionSequence;
        currentStartMs = work.elapsedResolvedMs;
      }
      currentEndMs =
        currentStartMs +
        (currentKind === "encounter"
          ? rules.combatDurationMs
          : Math.min(rules.gatheringWindowMs, plan.requestedDurationMs - currentStartMs));
    }

    const nextBoundaryMs =
      (Math.floor(work.elapsedResolvedMs / rules.foodConsumptionIntervalMs) + 1) *
      rules.foodConsumptionIntervalMs;
    const nextEventMs = Math.min(targetMs, currentEndMs, nextBoundaryMs);
    const advanceMs = nextEventMs - work.elapsedResolvedMs;
    if (advanceMs <= 0) {
      break;
    }

    // Attribute the accepted time to the current action's productivity bucket.
    if (currentKind === "gathering") {
      work.productiveGatheringMs += advanceMs;
    } else {
      work.combatInterruptionMs += advanceMs;
    }
    work.elapsedResolvedMs += advanceMs;

    // An action completing exactly at the boundary earns its outcome first.
    if (work.elapsedResolvedMs === currentEndMs) {
      if (currentKind === "gathering") {
        stopReason = completeGathering(plan, work, currentSequence);
      } else {
        stopReason = completeEncounter(plan, work, currentSequence);
      }
      currentKind = null;
      if (stopReason !== null) {
        break;
      }
    }

    // Crossing a food boundary consumes one unit; running out stops here.
    if (work.elapsedResolvedMs === nextBoundaryMs) {
      if (work.availableFood === 0) {
        stopReason = "food_exhausted";
        break;
      }
      work.availableFood -= 1;
      work.foodConsumed += 1;
    }

    // Budget exhausted: persist a partial action only when still mid-action.
    if (work.elapsedResolvedMs === targetMs) {
      if (work.elapsedResolvedMs < currentEndMs) {
        work.partialAction = {
          kind: currentKind!,
          actionSequence: currentSequence,
          elapsedInActionMs: work.elapsedResolvedMs - currentStartMs,
        };
      }
      break;
    }
  }

  if (stopReason !== null) {
    work.status = "stopped";
    work.stopReason = stopReason;
    work.partialAction = null;
  } else if (work.elapsedResolvedMs >= plan.requestedDurationMs) {
    work.status = "completed";
    work.stopReason = "duration_reached";
    work.partialAction = null;
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
    statusBefore,
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
