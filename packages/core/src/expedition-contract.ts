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

export const EXPEDITION_KERNEL_SCHEMA_VERSION = 2 as const;

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
  readonly initialState: DeterministicExpeditionStartingState;
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
  if (!progress.initialState || typeof progress.initialState !== "object") {
    fail(code, "initialState must be a snapshot object");
  }
  validateDeterministicExpeditionStartingState(progress.initialState);
}

/**
 * Plan-aware progress validation. This validator checks a progress against the
 * plan it belongs to, catching structural corruption that the schema-only
 * validator cannot see (impossible slot/stack states, counters inconsistent
 * with the plan's duration, partial actions that cannot resume, and so on).
 * `resolveDeterministicExpedition` runs it before accepting any elapsed time.
 *
 * It uses O(1) bounded algebraic invariants on the snapshot state and the current
 * action, avoiding historical replay over very long idle periods.
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

  // --- HEALTH BOUNDED INVARIANT ---
  const expectedHealth = Math.max(0, progress.initialState.startingHealth - progress.damageTaken);
  if (progress.health !== expectedHealth) {
    fail(code, `health mismatch against initial state: expected ${expectedHealth}, got ${progress.health}`);
  }
  if (progress.damageTaken > 0 && progress.encounters === 0) {
    fail(code, "damageTaken is positive but no encounters occurred");
  }

  // --- FOOD BOUNDED INVARIANT ---
  if (progress.foodConsumed > progress.initialState.availableFood) {
    fail(code, `foodConsumed (${progress.foodConsumed}) exceeds initial availableFood (${progress.initialState.availableFood})`);
  }
  const expectedAvailableFood = progress.initialState.availableFood - progress.foodConsumed;
  if (progress.availableFood !== expectedAvailableFood) {
    fail(code, `availableFood mismatch: expected ${expectedAvailableFood}, got ${progress.availableFood}`);
  }
  const maxFoodConsumed = Math.floor(progress.elapsedResolvedMs / rules.foodConsumptionIntervalMs);
  if (progress.foodConsumed > maxFoodConsumed) {
    fail(code, `foodConsumed (${progress.foodConsumed}) exceeds maximum possible for elapsedMs (${maxFoodConsumed})`);
  }

  // --- INVENTORY AND STACK SNAPSHOT TRANSITIONS ---
  if (progress.initialState.startingInventoryUsedSlots > rules.inventorySlotLimit) {
    fail(code, `initial startingInventoryUsedSlots (${progress.initialState.startingInventoryUsedSlots}) exceeds inventorySlotLimit (${rules.inventorySlotLimit})`);
  }
  if (progress.initialState.existingResourceStackPresent && progress.initialState.startingInventoryUsedSlots < 1) {
    fail(code, "an existing resource stack must occupy a slot (startingInventoryUsedSlots must be >= 1)");
  }
  if (progress.initialState.existingResourceStackPresent && !progress.existingResourceStackPresent) {
    fail(code, "existingResourceStackPresent cannot transition from true to false");
  }
  if (!progress.existingResourceStackPresent && progress.resourcesObtained > 0) {
    fail(code, "resourcesObtained is positive but no resource stack exists");
  }

  let expectedInventoryUsedSlots = progress.initialState.startingInventoryUsedSlots;
  if (!progress.initialState.existingResourceStackPresent && progress.existingResourceStackPresent) {
    if (progress.resourcesObtained <= 0) {
      fail(code, "existingResourceStackPresent transitioned to true but resourcesObtained is 0");
    }
    expectedInventoryUsedSlots += 1;
  }
  if (progress.inventoryUsedSlots !== expectedInventoryUsedSlots) {
    fail(code, `inventoryUsedSlots mismatch: expected ${expectedInventoryUsedSlots}, got ${progress.inventoryUsedSlots}`);
  }
  if (progress.inventoryUsedSlots > rules.inventorySlotLimit) {
    fail(
      code,
      `inventoryUsedSlots (${progress.inventoryUsedSlots}) exceeds inventorySlotLimit (${rules.inventorySlotLimit})`,
    );
  }

  // --- REWARDS MONOTONIC TRANSITIONS AND DIVISION ---
  if (progress.resourcesObtained % rules.resourceQuantityPerGather !== 0) {
    fail(code, `resourcesObtained (${progress.resourcesObtained}) is not a multiple of resourceQuantityPerGather (${rules.resourceQuantityPerGather})`);
  }
  const completedGatherings = progress.resourcesObtained / rules.resourceQuantityPerGather;
  const expectedResourceXp = completedGatherings * rules.resourceXpPerGather;
  if (!Number.isSafeInteger(expectedResourceXp)) {
    fail(code, "resourceXpGained overflow");
  }
  if (progress.resourceXpGained !== expectedResourceXp) {
    fail(code, `resourceXpGained mismatch: expected ${expectedResourceXp}, got ${progress.resourceXpGained}`);
  }

  if (progress.encountersWon + progress.encountersLost !== progress.encounters) {
    fail(
      code,
      `encountersWon + encountersLost (${progress.encountersWon} + ${progress.encountersLost}) must equal encounters (${progress.encounters})`,
    );
  }
  const expectedCombatXp = progress.encountersWon * rules.combatXpPerWin;
  if (!Number.isSafeInteger(expectedCombatXp)) {
    fail(code, "combatXpGained overflow");
  }
  if (progress.combatXpGained !== expectedCombatXp) {
    fail(code, `combatXpGained mismatch: expected ${expectedCombatXp}, got ${progress.combatXpGained}`);
  }

  // --- ACTION SEQUENCE ACCOUNTING ---
  const expectedSequence = completedGatherings + progress.encounters;
  if (progress.nextActionSequence !== expectedSequence) {
    fail(code, `nextActionSequence mismatch: expected ${expectedSequence}, got ${progress.nextActionSequence}`);
  }

  // --- TIME BUCKETS BOUNDS ---
  if (!Number.isSafeInteger(progress.productiveGatheringMs) || !Number.isSafeInteger(progress.combatInterruptionMs)) {
    fail(code, "time buckets must be safe integers");
  }
  if (progress.productiveGatheringMs !== progress.elapsedResolvedMs - progress.combatInterruptionMs) {
    fail(
      code,
      `productiveGatheringMs + combatInterruptionMs (${progress.productiveGatheringMs} + ${progress.combatInterruptionMs}) must equal elapsedResolvedMs (${progress.elapsedResolvedMs})`,
    );
  }
  if (progress.combatInterruptionMs > 0 && progress.encounters === 0 && (progress.partialAction === null || progress.partialAction.kind !== "encounter")) {
    fail(code, "combatInterruptionMs is positive but no encounters occurred or are active");
  }
  if (progress.productiveGatheringMs > 0 && completedGatherings === 0 && (progress.partialAction === null || progress.partialAction.kind !== "gathering")) {
    fail(code, "productiveGatheringMs is positive but no gatherings completed or are active");
  }

  // --- CURRENT PARTIAL ACTION DETAILS ---
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
    const remainingWindowMs = plan.requestedDurationMs - actionStartMs;
    const nextWindowMs = Math.min(rules.gatheringWindowMs, remainingWindowMs);
    if (nextWindowMs <= 0) {
      fail(code, "remaining plan duration is insufficient to contain partial action");
    }

    const encounter = deterministicRollPpm(
      plan.seed,
      partial.actionSequence,
      "expedition_encounter",
      plan.activityId,
      rules.encounterChancePpm,
    );
    const expectedKind = (encounter && nextWindowMs >= rules.combatDurationMs) ? "encounter" : "gathering";
    if (partial.kind !== expectedKind) {
      fail(code, `partialAction.kind mismatch: expected ${expectedKind}, got ${partial.kind}`);
    }

    const fullDurationMs = expectedKind === "encounter" ? rules.combatDurationMs : nextWindowMs;
    if (partial.elapsedInActionMs <= 0 || partial.elapsedInActionMs >= fullDurationMs) {
      fail(
        code,
        `partialAction.elapsedInActionMs (${partial.elapsedInActionMs}) must be strictly within (0, ${fullDurationMs})`,
      );
    }
  }

  // --- TERMINAL STATES INVARIANTS ---
  if (progress.status === "completed") {
    if (progress.elapsedResolvedMs !== plan.requestedDurationMs) {
      fail(
        code,
        `completed progress must have elapsedResolvedMs (${progress.elapsedResolvedMs}) equal to requestedDurationMs (${plan.requestedDurationMs})`,
      );
    }
    if (progress.stopReason !== "duration_reached") {
      fail(code, "completed progress must have stopReason duration_reached");
    }
  }
  if (progress.status === "active") {
    if (progress.elapsedResolvedMs >= plan.requestedDurationMs) {
      fail(code, "active progress must not have already reached the requested duration");
    }
    if (progress.stopReason !== null) {
      fail(code, "active progress must have null stopReason");
    }
  }
  if (progress.status === "stopped") {
    if (progress.stopReason === null || progress.stopReason === "duration_reached") {
      fail(code, `stopped progress has invalid stopReason: ${progress.stopReason}`);
    }
  }
}
