import { PROBABILITY_SCALE } from "./types";
import { deterministicRollPpm, deterministicRange } from "./rng";

/**
 * Deterministic expedition contract.
 *
 * The expedition kernel is a pure, injected-input resolver. It never reads
 * ambient time or randomness, never generates identities, never mutates its
 * inputs, and produces identical output for identical input. This module owns
 * only the JSON-safe readonly types and the stable validation/error contract;
 * the resolution logic lives in expedition-kernel.ts.
 */

export const EXPEDITION_KERNEL_SCHEMA_VERSION = 1 as const;

// ============================================================================
// Types
// ============================================================================

export interface DeterministicExpeditionRules {
  readonly gatheringWindowMs: number;
  readonly encounterChancePpm: number;
  readonly combatDurationMs: number;
  readonly foodConsumptionIntervalMs: number;
  readonly resourceItemId: string;
  readonly foodItemId: string;
  readonly resourceQuantityPerGather: number;
  readonly resourceXpPerGather: number;
  readonly combatXpPerWin: number;
  readonly enemyDamageMin: number;
  readonly enemyDamageMax: number;
  readonly minimumHealthToContinue: number;
  readonly inventorySlotLimit: number;
}

export interface DeterministicExpeditionPlan {
  readonly schemaVersion: typeof EXPEDITION_KERNEL_SCHEMA_VERSION;
  readonly expeditionId: string;
  readonly locationId: string;
  readonly activityId: string;
  readonly seed: string;
  readonly requestedDurationMs: number;
  readonly startedAtSimulationMs: number;
  readonly rules: DeterministicExpeditionRules;
}

export interface DeterministicExpeditionStartingState {
  readonly startingHealth: number;
  readonly startingInventoryUsedSlots: number;
  readonly existingResourceStackPresent: boolean;
  readonly availableFood: number;
}

export type DeterministicExpeditionStatus = "active" | "completed" | "stopped";

export type DeterministicExpeditionStopReason =
  | "duration_reached"
  | "inventory_full"
  | "food_exhausted"
  | "health_critical"
  | "activity_invalid"
  | null;

export type DeterministicExpeditionActionKind = "gathering" | "encounter";

export interface DeterministicExpeditionPartialAction {
  readonly kind: DeterministicExpeditionActionKind;
  readonly actionSequence: number;
  readonly elapsedInActionMs: number;
}

export interface DeterministicExpeditionProgress {
  readonly schemaVersion: typeof EXPEDITION_KERNEL_SCHEMA_VERSION;
  readonly expeditionId: string;
  readonly elapsedResolvedMs: number;
  readonly partialAction: DeterministicExpeditionPartialAction | null;
  readonly nextActionSequence: number;
  readonly health: number;
  readonly inventoryUsedSlots: number;
  readonly existingResourceStackPresent: boolean;
  readonly availableFood: number;
  readonly resourcesObtained: number;
  readonly resourceXpGained: number;
  readonly combatXpGained: number;
  readonly encounters: number;
  readonly encountersWon: number;
  readonly encountersLost: number;
  readonly damageTaken: number;
  readonly foodConsumed: number;
  readonly productiveGatheringMs: number;
  readonly combatInterruptionMs: number;
  readonly status: DeterministicExpeditionStatus;
  readonly stopReason: DeterministicExpeditionStopReason;
}

export interface DeterministicExpeditionDelta {
  readonly elapsedAppliedMs: number;
  readonly resourcesObtained: number;
  readonly resourceXpGained: number;
  readonly combatXpGained: number;
  readonly encounters: number;
  readonly encountersWon: number;
  readonly encountersLost: number;
  readonly damageTaken: number;
  readonly foodConsumed: number;
  readonly productiveGatheringMs: number;
  readonly combatInterruptionMs: number;
  readonly startingHealth: number;
  readonly endingHealth: number;
  readonly statusBefore: DeterministicExpeditionStatus;
  readonly statusAfter: DeterministicExpeditionStatus;
  readonly stopReason: DeterministicExpeditionStopReason;
}

export interface DeterministicExpeditionResolution {
  readonly progress: DeterministicExpeditionProgress;
  readonly delta: DeterministicExpeditionDelta;
}

// ============================================================================
// Errors
// ============================================================================

export type DeterministicExpeditionErrorCode =
  | "invalid_plan"
  | "invalid_rules"
  | "invalid_starting_state"
  | "invalid_progress"
  | "schema_mismatch"
  | "invalid_elapsed"
  | "plan_progress_mismatch";

export class DeterministicExpeditionError extends Error {
  readonly code: DeterministicExpeditionErrorCode;

  constructor(code: DeterministicExpeditionErrorCode, message: string) {
    super(message);
    this.name = "DeterministicExpeditionError";
    this.code = code;
  }
}

// ============================================================================
// Validation helpers
// ============================================================================

function isPositiveInt(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isNonNegativeInt(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function fail(code: DeterministicExpeditionErrorCode, message: string): never {
  throw new DeterministicExpeditionError(code, message);
}

export function validateDeterministicExpeditionRules(rules: DeterministicExpeditionRules): void {
  const code: DeterministicExpeditionErrorCode = "invalid_rules";
  if (!rules || typeof rules !== "object") fail(code, "rules must be an object");
  if (!isPositiveInt(rules.gatheringWindowMs)) {
    fail(code, `gatheringWindowMs must be a positive integer; received ${String(rules.gatheringWindowMs)}`);
  }
  if (
    !Number.isSafeInteger(rules.encounterChancePpm) ||
    rules.encounterChancePpm < 0 ||
    rules.encounterChancePpm > PROBABILITY_SCALE
  ) {
    fail(code, `encounterChancePpm must be an integer from 0 to ${PROBABILITY_SCALE}; received ${String(rules.encounterChancePpm)}`);
  }
  if (!isPositiveInt(rules.combatDurationMs)) {
    fail(code, `combatDurationMs must be a positive integer; received ${String(rules.combatDurationMs)}`);
  }
  if (!isPositiveInt(rules.foodConsumptionIntervalMs)) {
    fail(code, `foodConsumptionIntervalMs must be a positive integer; received ${String(rules.foodConsumptionIntervalMs)}`);
  }
  if (!isNonEmptyString(rules.resourceItemId)) {
    fail(code, "resourceItemId must be a non-empty string");
  }
  if (!isNonEmptyString(rules.foodItemId)) {
    fail(code, "foodItemId must be a non-empty string");
  }
  if (!isPositiveInt(rules.resourceQuantityPerGather)) {
    fail(code, `resourceQuantityPerGather must be a positive integer; received ${String(rules.resourceQuantityPerGather)}`);
  }
  if (!isNonNegativeInt(rules.resourceXpPerGather)) {
    fail(code, `resourceXpPerGather must be a non-negative integer; received ${String(rules.resourceXpPerGather)}`);
  }
  if (!isNonNegativeInt(rules.combatXpPerWin)) {
    fail(code, `combatXpPerWin must be a non-negative integer; received ${String(rules.combatXpPerWin)}`);
  }
  if (!isNonNegativeInt(rules.enemyDamageMin)) {
    fail(code, `enemyDamageMin must be a non-negative integer; received ${String(rules.enemyDamageMin)}`);
  }
  if (!isNonNegativeInt(rules.enemyDamageMax)) {
    fail(code, `enemyDamageMax must be a non-negative integer; received ${String(rules.enemyDamageMax)}`);
  }
  if (rules.enemyDamageMax < rules.enemyDamageMin) {
    fail(code, `enemyDamageMax (${rules.enemyDamageMax}) must be >= enemyDamageMin (${rules.enemyDamageMin})`);
  }
  if (!isNonNegativeInt(rules.minimumHealthToContinue)) {
    fail(code, `minimumHealthToContinue must be a non-negative integer; received ${String(rules.minimumHealthToContinue)}`);
  }
  if (!isPositiveInt(rules.inventorySlotLimit)) {
    fail(code, `inventorySlotLimit must be a positive integer; received ${String(rules.inventorySlotLimit)}`);
  }
}

export function validateDeterministicExpeditionPlan(plan: DeterministicExpeditionPlan): void {
  const code: DeterministicExpeditionErrorCode = "invalid_plan";
  if (!plan || typeof plan !== "object") fail(code, "plan must be an object");
  if (plan.schemaVersion !== EXPEDITION_KERNEL_SCHEMA_VERSION) {
    fail(code, `plan schemaVersion must be ${EXPEDITION_KERNEL_SCHEMA_VERSION}; received ${String(plan.schemaVersion)}`);
  }
  if (!isNonEmptyString(plan.expeditionId)) fail(code, "expeditionId must be a non-empty string");
  if (!isNonEmptyString(plan.locationId)) fail(code, "locationId must be a non-empty string");
  if (!isNonEmptyString(plan.activityId)) fail(code, "activityId must be a non-empty string");
  if (!isNonEmptyString(plan.seed)) fail(code, "seed must be a non-empty string");
  if (!isPositiveInt(plan.requestedDurationMs)) {
    fail(code, `requestedDurationMs must be a positive integer; received ${String(plan.requestedDurationMs)}`);
  }
  if (!isNonNegativeInt(plan.startedAtSimulationMs)) {
    fail(code, `startedAtSimulationMs must be a non-negative integer; received ${String(plan.startedAtSimulationMs)}`);
  }
  validateDeterministicExpeditionRules(plan.rules);
}

export function validateDeterministicExpeditionStartingState(state: DeterministicExpeditionStartingState): void {
  const code: DeterministicExpeditionErrorCode = "invalid_starting_state";
  if (!state || typeof state !== "object") fail(code, "starting state must be an object");
  if (!isNonNegativeInt(state.startingHealth)) {
    fail(code, `startingHealth must be a non-negative integer; received ${String(state.startingHealth)}`);
  }
  if (!isNonNegativeInt(state.startingInventoryUsedSlots)) {
    fail(code, `startingInventoryUsedSlots must be a non-negative integer; received ${String(state.startingInventoryUsedSlots)}`);
  }
  if (typeof state.existingResourceStackPresent !== "boolean") {
    fail(code, "existingResourceStackPresent must be a boolean");
  }
  if (!isNonNegativeInt(state.availableFood)) {
    fail(code, `availableFood must be a non-negative integer; received ${String(state.availableFood)}`);
  }
}

const STOP_REASONS: readonly DeterministicExpeditionStopReason[] = [
  "duration_reached",
  "inventory_full",
  "food_exhausted",
  "health_critical",
  "activity_invalid",
];

export function validateDeterministicExpeditionProgress(progress: DeterministicExpeditionProgress): void {
  const code: DeterministicExpeditionErrorCode = "invalid_progress";
  if (!progress || typeof progress !== "object") fail(code, "progress must be an object");
  if (progress.schemaVersion !== EXPEDITION_KERNEL_SCHEMA_VERSION) {
    fail(code, `progress schemaVersion must be ${EXPEDITION_KERNEL_SCHEMA_VERSION}; received ${String(progress.schemaVersion)}`);
  }
  if (!isNonEmptyString(progress.expeditionId)) fail(code, "expeditionId must be a non-empty string");
  if (!isNonNegativeInt(progress.elapsedResolvedMs)) {
    fail(code, `elapsedResolvedMs must be a non-negative integer; received ${String(progress.elapsedResolvedMs)}`);
  }
  if (progress.partialAction !== null) {
    const partial = progress.partialAction;
    if (!partial || typeof partial !== "object") fail(code, "partialAction must be an object or null");
    if (partial.kind !== "gathering" && partial.kind !== "encounter") {
      fail(code, `partialAction.kind must be gathering or encounter; received ${String(partial.kind)}`);
    }
    if (!isNonNegativeInt(partial.actionSequence)) {
      fail(code, `partialAction.actionSequence must be a non-negative integer; received ${String(partial.actionSequence)}`);
    }
    if (!isNonNegativeInt(partial.elapsedInActionMs)) {
      fail(code, `partialAction.elapsedInActionMs must be a non-negative integer; received ${String(partial.elapsedInActionMs)}`);
    }
  }
  if (!isNonNegativeInt(progress.nextActionSequence)) {
    fail(code, `nextActionSequence must be a non-negative integer; received ${String(progress.nextActionSequence)}`);
  }
  if (!isNonNegativeInt(progress.health)) {
    fail(code, `health must be a non-negative integer; received ${String(progress.health)}`);
  }
  if (!isNonNegativeInt(progress.inventoryUsedSlots)) {
    fail(code, `inventoryUsedSlots must be a non-negative integer; received ${String(progress.inventoryUsedSlots)}`);
  }
  if (typeof progress.existingResourceStackPresent !== "boolean") {
    fail(code, "existingResourceStackPresent must be a boolean");
  }
  if (!isNonNegativeInt(progress.availableFood)) {
    fail(code, `availableFood must be a non-negative integer; received ${String(progress.availableFood)}`);
  }
  if (!isNonNegativeInt(progress.resourcesObtained)) {
    fail(code, `resourcesObtained must be a non-negative integer; received ${String(progress.resourcesObtained)}`);
  }
  if (!isNonNegativeInt(progress.resourceXpGained)) {
    fail(code, `resourceXpGained must be a non-negative integer; received ${String(progress.resourceXpGained)}`);
  }
  if (!isNonNegativeInt(progress.combatXpGained)) {
    fail(code, `combatXpGained must be a non-negative integer; received ${String(progress.combatXpGained)}`);
  }
  if (!isNonNegativeInt(progress.encounters)) {
    fail(code, `encounters must be a non-negative integer; received ${String(progress.encounters)}`);
  }
  if (!isNonNegativeInt(progress.encountersWon)) {
    fail(code, `encountersWon must be a non-negative integer; received ${String(progress.encountersWon)}`);
  }
  if (!isNonNegativeInt(progress.encountersLost)) {
    fail(code, `encountersLost must be a non-negative integer; received ${String(progress.encountersLost)}`);
  }
  if (!isNonNegativeInt(progress.damageTaken)) {
    fail(code, `damageTaken must be a non-negative integer; received ${String(progress.damageTaken)}`);
  }
  if (!isNonNegativeInt(progress.foodConsumed)) {
    fail(code, `foodConsumed must be a non-negative integer; received ${String(progress.foodConsumed)}`);
  }
  if (!isNonNegativeInt(progress.productiveGatheringMs)) {
    fail(code, `productiveGatheringMs must be a non-negative integer; received ${String(progress.productiveGatheringMs)}`);
  }
  if (!isNonNegativeInt(progress.combatInterruptionMs)) {
    fail(code, `combatInterruptionMs must be a non-negative integer; received ${String(progress.combatInterruptionMs)}`);
  }
  if (progress.status !== "active" && progress.status !== "completed" && progress.status !== "stopped") {
    fail(code, `status must be active, completed or stopped; received ${String(progress.status)}`);
  }
  if (progress.stopReason !== null && !(STOP_REASONS as readonly string[]).includes(progress.stopReason)) {
    fail(code, `stopReason must be a known reason or null; received ${String(progress.stopReason)}`);
  }
  if (progress.status === "active" && progress.stopReason !== null) {
    fail(code, "an active expedition must have stopReason null");
  }
  if (progress.status === "completed" && progress.stopReason !== "duration_reached") {
    fail(code, "a completed expedition must have stopReason duration_reached");
  }
  if (progress.status === "stopped" && progress.stopReason === null) {
    fail(code, "a stopped expedition must have a non-null stopReason");
  }
}

function simulateUpTo(
  plan: DeterministicExpeditionPlan,
  startingHealth: number,
  startingFood: number,
  startingInventoryUsedSlots: number,
  startingResourceStackPresent: boolean,
  targetMs: number
) {
  const rules = plan.rules;
  let elapsed = 0;
  let nextActionSequence = 0;
  let health = startingHealth;
  let availableFood = startingFood;
  let inventoryUsedSlots = startingInventoryUsedSlots;
  let existingResourceStackPresent = startingResourceStackPresent;
  let resourcesObtained = 0;
  let resourceXpGained = 0;
  let combatXpGained = 0;
  let encounters = 0;
  let encountersWon = 0;
  let encountersLost = 0;
  let damageTaken = 0;
  let foodConsumed = 0;
  let productiveGatheringMs = 0;
  let combatInterruptionMs = 0;
  let partialAction: DeterministicExpeditionPartialAction | null = null;
  let status: DeterministicExpeditionStatus = "active";
  let stopReason: DeterministicExpeditionStopReason = null;

  if (health <= rules.minimumHealthToContinue) {
    status = "stopped";
    stopReason = "health_critical";
  }

  let currentKind: DeterministicExpeditionActionKind | null = null;
  let currentSequence = 0;
  let currentStartMs = 0;
  let currentEndMs = 0;

  while (elapsed < targetMs && stopReason === null) {
    if (currentKind === null) {
      if (plan.requestedDurationMs <= elapsed) {
        break;
      }
      const remainingAvailableMs = plan.requestedDurationMs - elapsed;
      const nextWindowMs = Math.min(rules.gatheringWindowMs, remainingAvailableMs);
      if (nextWindowMs <= 0) {
        break;
      }

      const encounter = deterministicRollPpm(
        plan.seed,
        nextActionSequence,
        "expedition_encounter",
        plan.activityId,
        rules.encounterChancePpm,
      );
      if (encounter && nextWindowMs >= rules.combatDurationMs) {
        currentKind = "encounter";
        currentSequence = nextActionSequence;
        currentStartMs = elapsed;
        currentEndMs = elapsed + rules.combatDurationMs;
      } else {
        currentKind = "gathering";
        currentSequence = nextActionSequence;
        currentStartMs = elapsed;
        currentEndMs = elapsed + nextWindowMs;
      }
    }

    const timeToFoodBoundary = rules.foodConsumptionIntervalMs - (elapsed % rules.foodConsumptionIntervalMs);
    let nextBoundaryMs = elapsed + timeToFoodBoundary;
    if (!Number.isSafeInteger(nextBoundaryMs)) {
      nextBoundaryMs = Number.MAX_SAFE_INTEGER;
    }

    const nextEventMs = Math.min(targetMs, currentEndMs, nextBoundaryMs);
    const advanceMs = nextEventMs - elapsed;
    if (advanceMs <= 0) {
      break;
    }

    if (currentKind === "gathering") {
      productiveGatheringMs += advanceMs;
    } else {
      combatInterruptionMs += advanceMs;
    }
    elapsed += advanceMs;

    // Action completion exactly on a boundary
    if (elapsed === currentEndMs) {
      if (currentKind === "gathering") {
        if (!existingResourceStackPresent) {
          if (inventoryUsedSlots >= rules.inventorySlotLimit) {
            stopReason = "inventory_full";
          }
        }
        if (stopReason === null) {
          resourcesObtained += rules.resourceQuantityPerGather;
          resourceXpGained += rules.resourceXpPerGather;
          if (!existingResourceStackPresent) {
            inventoryUsedSlots += 1;
            existingResourceStackPresent = true;
          }
          nextActionSequence = currentSequence + 1;
        }
      } else {
        const damage = deterministicRange(
          plan.seed,
          currentSequence,
          "wolf_damage",
          plan.activityId,
          rules.enemyDamageMin,
          rules.enemyDamageMax,
        );
        encounters += 1;
        damageTaken += damage;
        health = Math.max(0, health - damage);
        nextActionSequence = currentSequence + 1;

        if (health > rules.minimumHealthToContinue) {
          encountersWon += 1;
          combatXpGained += rules.combatXpPerWin;
        } else {
          encountersLost += 1;
          stopReason = "health_critical";
        }
      }
      currentKind = null;
      if (stopReason !== null) {
        break;
      }
    }

    // Food consumption boundary
    if (elapsed === nextBoundaryMs) {
      if (availableFood === 0) {
        stopReason = "food_exhausted";
        break;
      }
      availableFood -= 1;
      foodConsumed += 1;
    }

    // Target reached
    if (elapsed === targetMs) {
      if (elapsed < currentEndMs) {
        partialAction = {
          kind: currentKind!,
          actionSequence: currentSequence,
          elapsedInActionMs: elapsed - currentStartMs,
        };
      }
      break;
    }
  }

  if (stopReason !== null) {
    status = "stopped";
  } else if (elapsed >= plan.requestedDurationMs) {
    status = "completed";
    stopReason = "duration_reached";
    partialAction = null;
  } else {
    status = "active";
    stopReason = null;
  }

  return {
    elapsedResolvedMs: elapsed,
    partialAction,
    nextActionSequence,
    health,
    inventoryUsedSlots,
    existingResourceStackPresent,
    availableFood,
    resourcesObtained,
    resourceXpGained,
    combatXpGained,
    encounters,
    encountersWon,
    encountersLost,
    damageTaken,
    foodConsumed,
    productiveGatheringMs,
    combatInterruptionMs,
    status,
    stopReason,
  };
}

/**
 * Plan-aware progress validation. This validator checks a progress against the
 * plan it belongs to, catching structural corruption that the schema-only
 * validator cannot see (impossible slot/stack states, counters inconsistent
 * with the plan's duration, partial actions that cannot resume, and so on).
 * `resolveDeterministicExpedition` runs it before accepting any elapsed time.
 */
export function validateDeterministicExpeditionProgressAgainstPlan(
  plan: DeterministicExpeditionPlan,
  progress: DeterministicExpeditionProgress,
): void {
  const code: DeterministicExpeditionErrorCode = "invalid_progress";
  if (!plan || typeof plan !== "object") fail(code, "plan must be an object");
  if (!progress || typeof progress !== "object") fail(code, "progress must be an object");
  const rules = plan.rules;

  if (progress.elapsedResolvedMs > plan.requestedDurationMs) {
    fail(
      code,
      `elapsedResolvedMs (${progress.elapsedResolvedMs}) exceeds requestedDurationMs (${plan.requestedDurationMs})`,
    );
  }

  const isTerminal = progress.status === "completed" || progress.status === "stopped";
  if (isTerminal && progress.partialAction !== null) {
    fail(code, "terminal progress must not carry a partial action");
  }

  if (progress.partialAction !== null) {
    const partial = progress.partialAction;
    if (partial.actionSequence !== progress.nextActionSequence) {
      fail(
        code,
        `partialAction.actionSequence (${partial.actionSequence}) must equal nextActionSequence (${progress.nextActionSequence})`,
      );
    }
    const actionStartMs = progress.elapsedResolvedMs - partial.elapsedInActionMs;
    if (actionStartMs < 0) {
      fail(
        code,
        `partialAction.elapsedInActionMs (${partial.elapsedInActionMs}) exceeds elapsedResolvedMs (${progress.elapsedResolvedMs})`,
      );
    }
    const fullDurationMs =
      partial.kind === "encounter"
        ? rules.combatDurationMs
        : Math.min(rules.gatheringWindowMs, plan.requestedDurationMs - actionStartMs);
    if (partial.elapsedInActionMs <= 0 || partial.elapsedInActionMs >= fullDurationMs) {
      fail(
        code,
        `partialAction.elapsedInActionMs (${partial.elapsedInActionMs}) must be strictly within (0, ${fullDurationMs})`,
      );
    }
  }

  if (progress.inventoryUsedSlots > rules.inventorySlotLimit) {
    fail(
      code,
      `inventoryUsedSlots (${progress.inventoryUsedSlots}) exceeds inventorySlotLimit (${rules.inventorySlotLimit})`,
    );
  }
  if (progress.encountersWon + progress.encountersLost !== progress.encounters) {
    fail(
      code,
      `encountersWon + encountersLost (${progress.encountersWon} + ${progress.encountersLost}) must equal encounters (${progress.encounters})`,
    );
  }
  if (!progress.existingResourceStackPresent && progress.resourcesObtained > 0) {
    fail(code, "resourcesObtained is positive but no resource stack exists");
  }
  if (progress.existingResourceStackPresent && progress.inventoryUsedSlots < 1) {
    fail(code, "an existing resource stack must occupy a slot (inventoryUsedSlots must be >= 1)");
  }
  if (progress.status === "completed" && progress.elapsedResolvedMs !== plan.requestedDurationMs) {
    fail(
      code,
      `completed progress must have elapsedResolvedMs (${progress.elapsedResolvedMs}) equal to requestedDurationMs (${plan.requestedDurationMs})`,
    );
  }
  if (progress.status === "active" && progress.elapsedResolvedMs >= plan.requestedDurationMs) {
    fail(code, "active progress must not have already reached the requested duration");
  }
  if (progress.productiveGatheringMs + progress.combatInterruptionMs !== progress.elapsedResolvedMs) {
    fail(
      code,
      `productiveGatheringMs + combatInterruptionMs (${progress.productiveGatheringMs} + ${progress.combatInterruptionMs}) must equal elapsedResolvedMs (${progress.elapsedResolvedMs})`,
    );
  }

  if (progress.elapsedResolvedMs === 0) {
    if (progress.partialAction !== null) fail(code, "starting progress cannot have partial action");
    if (progress.nextActionSequence !== 0) fail(code, "starting nextActionSequence must be 0");
    if (progress.resourcesObtained !== 0) fail(code, "starting resourcesObtained must be 0");
    if (progress.resourceXpGained !== 0) fail(code, "starting resourceXpGained must be 0");
    if (progress.combatXpGained !== 0) fail(code, "starting combatXpGained must be 0");
    if (progress.encounters !== 0) fail(code, "starting encounters must be 0");
    if (progress.encountersWon !== 0) fail(code, "starting encountersWon must be 0");
    if (progress.encountersLost !== 0) fail(code, "starting encountersLost must be 0");
    if (progress.damageTaken !== 0) fail(code, "starting damageTaken must be 0");
    if (progress.foodConsumed !== 0) fail(code, "starting foodConsumed must be 0");
    if (progress.productiveGatheringMs !== 0) fail(code, "starting productiveGatheringMs must be 0");
    if (progress.combatInterruptionMs !== 0) fail(code, "starting combatInterruptionMs must be 0");

    const critical = progress.health <= rules.minimumHealthToContinue;
    if (critical) {
      if (progress.status === "active") {
        if (progress.stopReason !== null) fail(code, "active progress must have null stopReason");
      } else if (progress.status === "stopped") {
        if (progress.stopReason !== "health_critical") fail(code, "stopped starting progress must have health_critical stopReason");
      } else {
        fail(code, "invalid starting progress status");
      }
    } else {
      if (progress.status !== "active") fail(code, "non-critical starting progress must be active");
      if (progress.stopReason !== null) fail(code, "non-critical starting progress must have null stopReason");
    }
    return;
  }

  // Reconstruct completed action history and verify cursor integrity.
  const startingHealth = progress.health + progress.damageTaken;
  if (!Number.isSafeInteger(startingHealth) || startingHealth < 0) {
    fail(code, "startingHealth must be a safe non-negative integer");
  }
  const startingFood = progress.availableFood + progress.foodConsumed;
  if (!Number.isSafeInteger(startingFood) || startingFood < 0) {
    fail(code, "startingFood must be a safe non-negative integer");
  }

  let match = false;
  let lastErrorMsg = "";

  const combos = [
    {
      present: progress.existingResourceStackPresent,
      slots: progress.inventoryUsedSlots,
    },
  ];
  if (
    progress.resourcesObtained > 0 &&
    progress.existingResourceStackPresent &&
    progress.inventoryUsedSlots >= 1
  ) {
    combos.push({
      present: false,
      slots: progress.inventoryUsedSlots - 1,
    });
  }

  for (const combo of combos) {
    const sim = simulateUpTo(
      plan,
      startingHealth,
      startingFood,
      combo.slots,
      combo.present,
      progress.elapsedResolvedMs,
    );

    // Compare fields
    if (sim.elapsedResolvedMs !== progress.elapsedResolvedMs) {
      lastErrorMsg = `elapsedResolvedMs mismatch: simulated ${sim.elapsedResolvedMs}, got ${progress.elapsedResolvedMs}`;
      continue;
    }
    if (sim.nextActionSequence !== progress.nextActionSequence) {
      lastErrorMsg = `nextActionSequence mismatch: simulated ${sim.nextActionSequence}, got ${progress.nextActionSequence}`;
      continue;
    }
    if (sim.health !== progress.health) {
      lastErrorMsg = `health mismatch: simulated ${sim.health}, got ${progress.health}`;
      continue;
    }
    if (sim.inventoryUsedSlots !== progress.inventoryUsedSlots) {
      lastErrorMsg = `inventoryUsedSlots mismatch: simulated ${sim.inventoryUsedSlots}, got ${progress.inventoryUsedSlots}`;
      continue;
    }
    if (sim.existingResourceStackPresent !== progress.existingResourceStackPresent) {
      lastErrorMsg = `existingResourceStackPresent mismatch: simulated ${sim.existingResourceStackPresent}, got ${progress.existingResourceStackPresent}`;
      continue;
    }
    if (sim.availableFood !== progress.availableFood) {
      lastErrorMsg = `availableFood mismatch: simulated ${sim.availableFood}, got ${progress.availableFood}`;
      continue;
    }
    if (sim.resourcesObtained !== progress.resourcesObtained) {
      lastErrorMsg = `resourcesObtained mismatch: simulated ${sim.resourcesObtained}, got ${progress.resourcesObtained}`;
      continue;
    }
    if (sim.resourceXpGained !== progress.resourceXpGained) {
      lastErrorMsg = `resourceXpGained mismatch: simulated ${sim.resourceXpGained}, got ${progress.resourceXpGained}`;
      continue;
    }
    if (sim.combatXpGained !== progress.combatXpGained) {
      lastErrorMsg = `combatXpGained mismatch: simulated ${sim.combatXpGained}, got ${progress.combatXpGained}`;
      continue;
    }
    if (sim.encounters !== progress.encounters) {
      lastErrorMsg = `encounters mismatch: simulated ${sim.encounters}, got ${progress.encounters}`;
      continue;
    }
    if (sim.encountersWon !== progress.encountersWon) {
      lastErrorMsg = `encountersWon mismatch: simulated ${sim.encountersWon}, got ${progress.encountersWon}`;
      continue;
    }
    if (sim.encountersLost !== progress.encountersLost) {
      lastErrorMsg = `encountersLost mismatch: simulated ${sim.encountersLost}, got ${progress.encountersLost}`;
      continue;
    }
    if (sim.damageTaken !== progress.damageTaken) {
      lastErrorMsg = `damageTaken mismatch: simulated ${sim.damageTaken}, got ${progress.damageTaken}`;
      continue;
    }
    if (sim.foodConsumed !== progress.foodConsumed) {
      lastErrorMsg = `foodConsumed mismatch: simulated ${sim.foodConsumed}, got ${progress.foodConsumed}`;
      continue;
    }
    if (sim.productiveGatheringMs !== progress.productiveGatheringMs) {
      lastErrorMsg = `productiveGatheringMs mismatch: simulated ${sim.productiveGatheringMs}, got ${progress.productiveGatheringMs}`;
      continue;
    }
    if (sim.combatInterruptionMs !== progress.combatInterruptionMs) {
      lastErrorMsg = `combatInterruptionMs mismatch: simulated ${sim.combatInterruptionMs}, got ${progress.combatInterruptionMs}`;
      continue;
    }
    if (sim.status !== progress.status) {
      lastErrorMsg = `status mismatch: simulated ${sim.status}, got ${progress.status}`;
      continue;
    }
    if (sim.stopReason !== progress.stopReason) {
      lastErrorMsg = `stopReason mismatch: simulated ${sim.stopReason}, got ${progress.stopReason}`;
      continue;
    }

    // Compare partial action
    if (sim.partialAction === null && progress.partialAction !== null) {
      lastErrorMsg = `partialAction mismatch: simulated null, got ${JSON.stringify(progress.partialAction)}`;
      continue;
    }
    if (sim.partialAction !== null && progress.partialAction === null) {
      lastErrorMsg = `partialAction mismatch: simulated ${JSON.stringify(sim.partialAction)}, got null`;
      continue;
    }
    if (sim.partialAction !== null && progress.partialAction !== null) {
      if (sim.partialAction.kind !== progress.partialAction.kind) {
        lastErrorMsg = `partialAction.kind mismatch: simulated ${sim.partialAction.kind}, got ${progress.partialAction.kind}`;
        continue;
      }
      if (sim.partialAction.actionSequence !== progress.partialAction.actionSequence) {
        lastErrorMsg = `partialAction.actionSequence mismatch: simulated ${sim.partialAction.actionSequence}, got ${progress.partialAction.actionSequence}`;
        continue;
      }
      if (sim.partialAction.elapsedInActionMs !== progress.partialAction.elapsedInActionMs) {
        lastErrorMsg = `partialAction.elapsedInActionMs mismatch: simulated ${sim.partialAction.elapsedInActionMs}, got ${progress.partialAction.elapsedInActionMs}`;
        continue;
      }
    }

    match = true;
    break;
  }

  if (!match) {
    fail(code, `deterministic history simulation mismatch: ${lastErrorMsg}`);
  }
}
