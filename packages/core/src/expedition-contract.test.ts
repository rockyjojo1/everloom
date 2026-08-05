import { describe, it, expect } from "vitest";
import {
  EXPEDITION_KERNEL_SCHEMA_VERSION,
  DeterministicExpeditionError,
  validateDeterministicExpeditionPlan,
  validateDeterministicExpeditionProgress,
  validateDeterministicExpeditionProgressAgainstPlan,
  validateDeterministicExpeditionRules,
  validateDeterministicExpeditionStartingState,
  type DeterministicExpeditionPlan,
  type DeterministicExpeditionProgress,
  type DeterministicExpeditionRules,
  type DeterministicExpeditionStartingState,
} from "./expedition-contract";

function makeRules(overrides: Partial<DeterministicExpeditionRules> = {}): DeterministicExpeditionRules {
  return {
    gatheringWindowMs: 30_000,
    encounterChancePpm: 150_000,
    combatDurationMs: 15_000,
    foodConsumptionIntervalMs: 120_000,
    resourceItemId: "log_ironbark",
    foodItemId: "food-bread",
    resourceQuantityPerGather: 1,
    resourceXpPerGather: 25,
    combatXpPerWin: 50,
    enemyDamageMin: 8,
    enemyDamageMax: 12,
    minimumHealthToContinue: 5,
    inventorySlotLimit: 18,
    ...overrides,
  };
}

function makePlan(overrides: Partial<DeterministicExpeditionPlan> = {}): DeterministicExpeditionPlan {
  return {
    schemaVersion: EXPEDITION_KERNEL_SCHEMA_VERSION,
    expeditionId: "exp-test",
    locationId: "verdant-grove",
    activityId: "ironbark-woodcutting",
    seed: "seed-1",
    requestedDurationMs: 120_000,
    startedAtSimulationMs: 0,
    rules: makeRules(),
    ...overrides,
  };
}

function makeStartingState(overrides: Partial<DeterministicExpeditionStartingState> = {}): DeterministicExpeditionStartingState {
  return {
    startingHealth: 100,
    startingInventoryUsedSlots: 0,
    existingResourceStackPresent: false,
    availableFood: 20,
    ...overrides,
  };
}

function makeProgress(overrides: Partial<DeterministicExpeditionProgress> = {}): DeterministicExpeditionProgress {
  return {
    schemaVersion: EXPEDITION_KERNEL_SCHEMA_VERSION,
    expeditionId: "exp-test",
    elapsedResolvedMs: 0,
    partialAction: null,
    nextActionSequence: 0,
    health: 100,
    inventoryUsedSlots: 0,
    existingResourceStackPresent: false,
    availableFood: 20,
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
    ...overrides,
  };
}

function expectError(fn: () => void, code: string, messagePart: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DeterministicExpeditionError);
    expect((error as DeterministicExpeditionError).code).toBe(code);
    expect((error as Error).message).toContain(messagePart);
    return;
  }
  throw new Error(`Expected DeterministicExpeditionError with code ${code} to be thrown`);
}

describe("deterministic expedition contract", () => {
  describe("rules validation", () => {
    it("accepts a valid rules object", () => {
      expect(() => validateDeterministicExpeditionRules(makeRules())).not.toThrow();
    });

    it.each([
      [{ gatheringWindowMs: 0 }, "gatheringWindowMs"],
      [{ gatheringWindowMs: -1 }, "gatheringWindowMs"],
      [{ gatheringWindowMs: 1.5 }, "gatheringWindowMs"],
      [{ encounterChancePpm: -1 }, "encounterChancePpm"],
      [{ encounterChancePpm: 1_000_001 }, "encounterChancePpm"],
      [{ encounterChancePpm: 0.5 }, "encounterChancePpm"],
      [{ combatDurationMs: 0 }, "combatDurationMs"],
      [{ foodConsumptionIntervalMs: 0 }, "foodConsumptionIntervalMs"],
      [{ resourceItemId: "" }, "resourceItemId"],
      [{ foodItemId: "" }, "foodItemId"],
      [{ resourceQuantityPerGather: 0 }, "resourceQuantityPerGather"],
      [{ resourceXpPerGather: -1 }, "resourceXpPerGather"],
      [{ combatXpPerWin: -1 }, "combatXpPerWin"],
      [{ enemyDamageMin: -1 }, "enemyDamageMin"],
      [{ enemyDamageMax: -1 }, "enemyDamageMax"],
      [{ enemyDamageMin: 15, enemyDamageMax: 10 }, "enemyDamageMax"],
      [{ minimumHealthToContinue: -1 }, "minimumHealthToContinue"],
      [{ inventorySlotLimit: 0 }, "inventorySlotLimit"],
    ])("rejects invalid field %#", (overrides, field) => {
      expectError(() => validateDeterministicExpeditionRules(makeRules(overrides)), "invalid_rules", field);
    });

    it("rejects a non-object rules value", () => {
      expectError(() => validateDeterministicExpeditionRules(null as never), "invalid_rules", "object");
    });
  });

  describe("plan validation", () => {
    it("accepts a valid plan", () => {
      expect(() => validateDeterministicExpeditionPlan(makePlan())).not.toThrow();
    });

    it("rejects a mismatched schemaVersion", () => {
      expectError(
        () => validateDeterministicExpeditionPlan(makePlan({ schemaVersion: 99 as never })),
        "invalid_plan",
        "schemaVersion",
      );
    });

    it.each([
      [{ expeditionId: "" }, "expeditionId"],
      [{ locationId: "" }, "locationId"],
      [{ activityId: "" }, "activityId"],
      [{ seed: "" }, "seed"],
      [{ requestedDurationMs: 0 }, "requestedDurationMs"],
      [{ startedAtSimulationMs: -1 }, "startedAtSimulationMs"],
    ])("rejects invalid field %#", (overrides, field) => {
      expectError(() => validateDeterministicExpeditionPlan(makePlan(overrides)), "invalid_plan", field);
    });

    it("rejects a plan with invalid nested rules", () => {
      expectError(
        () => validateDeterministicExpeditionPlan(makePlan({ rules: makeRules({ inventorySlotLimit: 0 }) })),
        "invalid_rules",
        "inventorySlotLimit",
      );
    });
  });

  describe("starting state validation", () => {
    it("accepts a valid starting state", () => {
      expect(() => validateDeterministicExpeditionStartingState(makeStartingState())).not.toThrow();
    });

    it.each([
      [{ startingHealth: -1 }, "startingHealth"],
      [{ startingInventoryUsedSlots: -1 }, "startingInventoryUsedSlots"],
      [{ existingResourceStackPresent: "yes" as never }, "existingResourceStackPresent"],
      [{ availableFood: -1 }, "availableFood"],
    ])("rejects invalid field %#", (overrides, field) => {
      expectError(
        () => validateDeterministicExpeditionStartingState(makeStartingState(overrides)),
        "invalid_starting_state",
        field,
      );
    });
  });

  describe("progress validation", () => {
    it("accepts a valid progress", () => {
      expect(() => validateDeterministicExpeditionProgress(makeProgress())).not.toThrow();
    });

    it("rejects a mismatched schemaVersion", () => {
      expectError(
        () => validateDeterministicExpeditionProgress(makeProgress({ schemaVersion: 99 as never })),
        "invalid_progress",
        "schemaVersion",
      );
    });

    it.each([
      [{ elapsedResolvedMs: -1 }, "elapsedResolvedMs"],
      [{ nextActionSequence: -1 }, "nextActionSequence"],
      [{ health: -1 }, "health"],
      [{ inventoryUsedSlots: -1 }, "inventoryUsedSlots"],
      [{ availableFood: -1 }, "availableFood"],
      [{ resourcesObtained: -1 }, "resourcesObtained"],
      [{ resourceXpGained: -1 }, "resourceXpGained"],
      [{ combatXpGained: -1 }, "combatXpGained"],
      [{ encounters: -1 }, "encounters"],
      [{ encountersWon: -1 }, "encountersWon"],
      [{ encountersLost: -1 }, "encountersLost"],
      [{ damageTaken: -1 }, "damageTaken"],
      [{ foodConsumed: -1 }, "foodConsumed"],
      [{ productiveGatheringMs: -1 }, "productiveGatheringMs"],
      [{ combatInterruptionMs: -1 }, "combatInterruptionMs"],
    ])("rejects negative counter field %#", (overrides, field) => {
      expectError(() => validateDeterministicExpeditionProgress(makeProgress(overrides)), "invalid_progress", field);
    });

    it("rejects an unknown partialAction kind", () => {
      expectError(
        () =>
          validateDeterministicExpeditionProgress(
            makeProgress({ partialAction: { kind: "smithing" as never, actionSequence: 0, elapsedInActionMs: 0 } }),
          ),
        "invalid_progress",
        "kind",
      );
    });

    it("rejects an unknown status", () => {
      expectError(
        () => validateDeterministicExpeditionProgress(makeProgress({ status: "paused" as never })),
        "invalid_progress",
        "status",
      );
    });

    it("rejects an active progress carrying a stopReason", () => {
      expectError(
        () => validateDeterministicExpeditionProgress(makeProgress({ status: "active", stopReason: "inventory_full" })),
        "invalid_progress",
        "stopReason",
      );
    });

    it("rejects a completed progress whose stopReason is not duration_reached", () => {
      expectError(
        () =>
          validateDeterministicExpeditionProgress(
            makeProgress({ status: "completed", stopReason: "food_exhausted", elapsedResolvedMs: 120_000 }),
          ),
        "invalid_progress",
        "stopReason",
      );
    });

    it("rejects a stopped progress with a null stopReason", () => {
      expectError(
        () => validateDeterministicExpeditionProgress(makeProgress({ status: "stopped", stopReason: null })),
        "invalid_progress",
        "stopReason",
      );
    });
  });

  describe("plan-aware progress validation", () => {
    it("accepts a valid active progress carrying a partial action", () => {
      const plan = makePlan();
      const progress = makeProgress({
        elapsedResolvedMs: 5_000,
        partialAction: { kind: "gathering", actionSequence: 0, elapsedInActionMs: 5_000 },
        nextActionSequence: 0,
        productiveGatheringMs: 5_000,
      });
      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress)).not.toThrow();
    });

    it("accepts a valid completed progress", () => {
      const plan = makePlan();
      const progress = makeProgress({
        elapsedResolvedMs: 120_000,
        status: "completed",
        stopReason: "duration_reached",
        productiveGatheringMs: 120_000,
      });
      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress)).not.toThrow();
    });

    it("rejects elapsedResolvedMs greater than requestedDurationMs", () => {
      const plan = makePlan({ requestedDurationMs: 120_000 });
      const progress = makeProgress({ elapsedResolvedMs: 150_000, productiveGatheringMs: 150_000 });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "exceeds requestedDurationMs",
      );
    });

    it("rejects a partial action on terminal progress", () => {
      const plan = makePlan();
      const progress = makeProgress({
        elapsedResolvedMs: 5_000,
        partialAction: { kind: "gathering", actionSequence: 0, elapsedInActionMs: 5_000 },
        nextActionSequence: 0,
        productiveGatheringMs: 5_000,
        status: "stopped",
        stopReason: "food_exhausted",
      });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "terminal progress",
      );
    });

    it("rejects a partial action whose sequence differs from nextActionSequence", () => {
      const plan = makePlan();
      const progress = makeProgress({
        elapsedResolvedMs: 5_000,
        partialAction: { kind: "gathering", actionSequence: 3, elapsedInActionMs: 5_000 },
        nextActionSequence: 0,
        productiveGatheringMs: 5_000,
      });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "nextActionSequence",
      );
    });

    it("rejects a partial action with zero or negative elapsed in action", () => {
      const plan = makePlan();
      const progress = makeProgress({
        elapsedResolvedMs: 5_000,
        partialAction: { kind: "gathering", actionSequence: 0, elapsedInActionMs: 0 },
        nextActionSequence: 0,
        productiveGatheringMs: 5_000,
      });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "strictly within",
      );
    });

    it("rejects a partial action whose elapsed in action reaches the action duration", () => {
      const plan = makePlan();
      const progress = makeProgress({
        elapsedResolvedMs: 30_000,
        partialAction: { kind: "gathering", actionSequence: 0, elapsedInActionMs: 30_000 },
        nextActionSequence: 0,
        productiveGatheringMs: 30_000,
      });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "strictly within",
      );
    });

    it("rejects an inventory used above the slot limit", () => {
      const plan = makePlan();
      const progress = makeProgress({
        elapsedResolvedMs: 30_000,
        inventoryUsedSlots: 19,
        existingResourceStackPresent: true,
        resourcesObtained: 1,
        productiveGatheringMs: 30_000,
      });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "inventorySlotLimit",
      );
    });

    it("rejects encounters whose won plus lost does not equal encounters", () => {
      const plan = makePlan();
      const progress = makeProgress({ encounters: 3, encountersWon: 2, encountersLost: 0 });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "encounters",
      );
    });

    it("rejects positive resources without an existing resource stack", () => {
      const plan = makePlan();
      const progress = makeProgress({
        elapsedResolvedMs: 30_000,
        resourcesObtained: 1,
        existingResourceStackPresent: false,
        productiveGatheringMs: 30_000,
      });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "no resource stack exists",
      );
    });

    it("rejects an existing resource stack that occupies no slot", () => {
      const plan = makePlan();
      const progress = makeProgress({ existingResourceStackPresent: true, inventoryUsedSlots: 0 });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "must be >= 1",
      );
    });

    it("rejects a completed progress without exact duration", () => {
      const plan = makePlan({ requestedDurationMs: 120_000 });
      const progress = makeProgress({
        elapsedResolvedMs: 90_000,
        status: "completed",
        stopReason: "duration_reached",
        productiveGatheringMs: 90_000,
      });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "equal to requestedDurationMs",
      );
    });

    it("rejects an active progress at or beyond the requested duration", () => {
      const plan = makePlan({ requestedDurationMs: 120_000 });
      const progress = makeProgress({ elapsedResolvedMs: 120_000, productiveGatheringMs: 120_000 });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "must not have already reached",
      );
    });

    it("rejects productive plus combat time inconsistent with elapsed", () => {
      const plan = makePlan();
      const progress = makeProgress({ elapsedResolvedMs: 10_000, productiveGatheringMs: 4_000, combatInterruptionMs: 2_000 });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "must equal elapsedResolvedMs",
      );
    });
  });

  describe("error contract", () => {
    it("produces an Error subclass with stable name and code", () => {
      try {
        validateDeterministicExpeditionPlan(makePlan({ expeditionId: "" }));
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DeterministicExpeditionError);
        const typed = error as DeterministicExpeditionError;
        expect(typed.name).toBe("DeterministicExpeditionError");
        expect(typed.code).toBe("invalid_plan");
        expect(typeof typed.message).toBe("string");
        expect(typed.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe("JSON serializability", () => {
    it("round-trips a progress without losing fidelity", () => {
      const progress = makeProgress({
        partialAction: { kind: "gathering", actionSequence: 3, elapsedInActionMs: 12_000 },
        status: "active",
        stopReason: null,
      });
      const revived = JSON.parse(JSON.stringify(progress)) as DeterministicExpeditionProgress;
      expect(revived).toEqual(progress);
      expect(() => validateDeterministicExpeditionProgress(revived)).not.toThrow();
    });

    it("round-trips a plan without losing fidelity", () => {
      const revived = JSON.parse(JSON.stringify(makePlan())) as DeterministicExpeditionPlan;
      expect(revived).toEqual(makePlan());
      expect(() => validateDeterministicExpeditionPlan(revived)).not.toThrow();
    });
  });
});
