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

  const safeAdd = (a: number, b: number, msg: string): number => {
    const sum = a + b;
    if (!Number.isSafeInteger(sum)) fail(code, msg);
    return sum;
  };

  const safeMul = (a: number, b: number, msg: string): number => {
    const product = a * b;
    if (!Number.isSafeInteger(product)) fail(code, msg);
    return product;
  };

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

  // --- REJECT ACTIVITY_INVALID ---
  if (progress.stopReason === "activity_invalid") {
    fail(code, "activity_invalid stop reason is not supported or emitted by Gate 6A kernel");
  }

  // --- SAFE ENCOUNTERS & GATHERINGS REWARDS CALCULATION ---
  if (progress.resourcesObtained % rules.resourceQuantityPerGather !== 0) {
    fail(code, `resourcesObtained (${progress.resourcesObtained}) is not a multiple of resourceQuantityPerGather (${rules.resourceQuantityPerGather})`);
  }
  const completedGatherings = progress.resourcesObtained / rules.resourceQuantityPerGather;
  const expectedResourceXp = safeMul(completedGatherings, rules.resourceXpPerGather, "resourceXpGained overflow");
  if (progress.resourceXpGained !== expectedResourceXp) {
    fail(code, `resourceXpGained mismatch: expected ${expectedResourceXp}, got ${progress.resourceXpGained}`);
  }

  if (progress.encountersWon + progress.encountersLost !== progress.encounters) {
    fail(
      code,
      `encountersWon + encountersLost (${progress.encountersWon} + ${progress.encountersLost}) must equal encounters (${progress.encounters})`,
    );
  }
  const expectedCombatXp = safeMul(progress.encountersWon, rules.combatXpPerWin, "combatXpGained overflow");
  if (progress.combatXpGained !== expectedCombatXp) {
    fail(code, `combatXpGained mismatch: expected ${expectedCombatXp}, got ${progress.combatXpGained}`);
  }

  // --- ACTION SEQUENCE ACCOUNTING ---
  const expectedSequence = safeAdd(completedGatherings, progress.encounters, "nextActionSequence overflow");
  if (progress.nextActionSequence !== expectedSequence) {
    fail(code, `nextActionSequence mismatch: expected ${expectedSequence}, got ${progress.nextActionSequence}`);
  }

  // --- HEALTH & DAMAGE BOUNDS ---
  if (progress.encounters === 0) {
    if (progress.damageTaken !== 0) {
      fail(code, "damageTaken must be 0 when encounters is 0");
    }
  } else {
    const minDamage = safeMul(progress.encounters, rules.enemyDamageMin, "enemyDamageMin overflow");
    const maxDamage = safeMul(progress.encounters, rules.enemyDamageMax, "enemyDamageMax overflow");
    if (progress.damageTaken < minDamage || progress.damageTaken > maxDamage) {
      fail(code, `damageTaken (${progress.damageTaken}) is out of deterministic range [${minDamage}, ${maxDamage}]`);
    }
  }

  const expectedHealth = Math.max(0, progress.initialState.startingHealth - progress.damageTaken);
  if (progress.health !== expectedHealth) {
    fail(code, `health mismatch against initial state: expected ${expectedHealth}, got ${progress.health}`);
  }

  // --- ENCOUNTER LOSS SEMANTICS ---
  if (progress.encountersLost !== 0 && progress.encountersLost !== 1) {
    fail(code, `encountersLost (${progress.encountersLost}) must be either 0 or 1`);
  }

  if (progress.encountersLost === 1) {
    if (progress.status !== "stopped" || progress.stopReason !== "health_critical" || progress.health > rules.minimumHealthToContinue) {
      fail(code, "encountersLost can only be 1 when stopped on health_critical with health <= minimumHealthToContinue");
    }
  }

  // --- EXACT FOOD-CLOCK INVARIANTS ---
  const boundaryCount = Math.floor(progress.elapsedResolvedMs / rules.foodConsumptionIntervalMs);
  const isFoodBoundary = progress.elapsedResolvedMs > 0 && progress.elapsedResolvedMs % rules.foodConsumptionIntervalMs === 0;

  let expectedFoodConsumed = boundaryCount;
  if (progress.status === "stopped") {
    if (progress.stopReason === "inventory_full" || progress.stopReason === "health_critical") {
      expectedFoodConsumed = isFoodBoundary ? boundaryCount - 1 : boundaryCount;
    } else if (progress.stopReason === "food_exhausted") {
      expectedFoodConsumed = progress.initialState.availableFood;
    }
  }

  if (progress.foodConsumed !== expectedFoodConsumed) {
    fail(code, `foodConsumed mismatch: expected ${expectedFoodConsumed}, got ${progress.foodConsumed}`);
  }

  const expectedAvailableFood = progress.initialState.availableFood - progress.foodConsumed;
  if (progress.availableFood !== expectedAvailableFood) {
    fail(code, `availableFood mismatch: expected ${expectedAvailableFood}, got ${progress.availableFood}`);
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

  // --- EXACT COMBAT-TIME ACCOUNTING ---
  const completedCombatMs = safeMul(progress.encounters, rules.combatDurationMs, "combatMs overflow");

  let expectedCombatInterruptionMs = completedCombatMs;
  if (progress.status === "active" && progress.partialAction?.kind === "encounter") {
    expectedCombatInterruptionMs = safeAdd(completedCombatMs, progress.partialAction.elapsedInActionMs, "active combatInterruptionMs overflow");
  }

  if (progress.status === "stopped" && progress.stopReason === "food_exhausted") {
    if (progress.combatInterruptionMs < completedCombatMs) {
      fail(code, "combatInterruptionMs cannot be less than completedCombatMs");
    }
    const residualCombatMs = progress.combatInterruptionMs - completedCombatMs;
    if (residualCombatMs !== 0 && (residualCombatMs <= 0 || residualCombatMs >= rules.combatDurationMs)) {
      fail(code, "residualCombatMs must be 0 or strictly within (0, combatDurationMs)");
    }
  } else {
    if (progress.combatInterruptionMs !== expectedCombatInterruptionMs) {
      fail(code, `combatInterruptionMs mismatch: expected ${expectedCombatInterruptionMs}, got ${progress.combatInterruptionMs}`);
    }
  }

  if (progress.productiveGatheringMs !== progress.elapsedResolvedMs - progress.combatInterruptionMs) {
    fail(
      code,
      `productiveGatheringMs + combatInterruptionMs (${progress.productiveGatheringMs} + ${progress.combatInterruptionMs}) must equal elapsedResolvedMs (${progress.elapsedResolvedMs})`,
    );
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

  // --- TERMINAL STATES & REASONS STATE CONSISTENCY ---
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
    if (progress.initialState.availableFood < boundaryCount) {
      fail(code, "completed progress must have had sufficient food for all crossed boundaries");
    }
  }

  if (progress.status === "active") {
    if (progress.elapsedResolvedMs >= plan.requestedDurationMs) {
      fail(code, "active progress must not have already reached the requested duration");
    }
    if (progress.stopReason !== null) {
      fail(code, "active progress must have null stopReason");
    }
    if (progress.elapsedResolvedMs > 0 && progress.health <= rules.minimumHealthToContinue) {
      fail(code, "active progress with positive elapsed must have health above continuation threshold");
    }
    if (progress.initialState.availableFood < boundaryCount) {
      fail(code, "active progress must have had sufficient food for all crossed boundaries");
    }
  }

  if (progress.status === "stopped") {
    if (progress.stopReason === null || progress.stopReason === "duration_reached") {
      fail(code, `stopped progress has invalid stopReason: ${progress.stopReason}`);
    }

    if (progress.stopReason === "inventory_full") {
      if (
        progress.existingResourceStackPresent !== false ||
        progress.initialState.existingResourceStackPresent !== false ||
        progress.inventoryUsedSlots !== rules.inventorySlotLimit ||
        progress.resourcesObtained !== 0 ||
        progress.resourceXpGained !== 0 ||
        progress.encountersLost !== 0
      ) {
        fail(code, "invalid inventory_full stop state counters");
      }
    }

    if (progress.stopReason === "food_exhausted") {
      if (progress.elapsedResolvedMs <= 0) {
        fail(code, "food_exhausted must occur at positive elapsed time");
      }
      if (!isFoodBoundary) {
        fail(code, "food_exhausted stop must occur exactly at a food boundary");
      }
      if (progress.availableFood !== 0) {
        fail(code, "food_exhausted stop requires availableFood to be 0");
      }
      if (progress.foodConsumed !== progress.initialState.availableFood) {
        fail(code, "foodConsumed does not match starting food on food_exhausted stop");
      }
      const expectedBoundaryCount = safeAdd(progress.initialState.availableFood, 1, "food_exhausted boundaryCount overflow");
      if (boundaryCount !== expectedBoundaryCount) {
        fail(code, "boundaryCount does not match food_exhausted stop conditions");
      }
      if (progress.encountersLost !== 0) {
        fail(code, "food_exhausted stop must not have lost encounters");
      }
    }

    if (progress.stopReason === "health_critical") {
      if (progress.health > rules.minimumHealthToContinue) {
        fail(code, "health_critical stop requires current health to be at or below minimum continuation threshold");
      }

      if (progress.elapsedResolvedMs === 0) {
        if (progress.encounters !== 0 || progress.encountersLost !== 0 || progress.damageTaken !== 0) {
          fail(code, "invalid health_critical stop at 0ms");
        }
        if (progress.initialState.startingHealth > rules.minimumHealthToContinue) {
          fail(code, "starting health must be critical to stop at 0ms");
        }
      } else {
        if (progress.encountersLost !== 1) {
          fail(code, "stopped due to health_critical at positive elapsed must have exactly 1 lost encounter");
        }
      }
    }
  }
}
