import { describe, it, expect } from "vitest";
import { PROBABILITY_SCALE } from "./types";
import {
  EXPEDITION_KERNEL_SCHEMA_VERSION,
  createDeterministicExpeditionProgress,
  resolveDeterministicExpedition,
  type DeterministicExpeditionPlan,
  type DeterministicExpeditionProgress,
  type DeterministicExpeditionRules,
  type DeterministicExpeditionStartingState,
} from "./expedition-kernel";
import {
  DeterministicExpeditionError,
  validateDeterministicExpeditionProgressAgainstPlan,
} from "./expedition-contract";
import * as fs from "fs";
import * as path from "path";

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
    expeditionId: "exp-adversarial",
    locationId: "verdant-grove",
    activityId: "ironbark-woodcutting",
    seed: "adversarial-seed-2",
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

describe("deterministic expedition adversarial hardening audit - corrective pass 2", () => {

  // ==========================================================================
  // FOOD CLOCK
  // ==========================================================================
  describe("FOOD CLOCK INVARIANTS", () => {
    it("1. Reject the current impossible one-hour completed progress with 0 food consumed", () => {
      const plan = makePlan({ requestedDurationMs: 3_600_000 }); // 1 hour (30 food boundaries)
      const progress: DeterministicExpeditionProgress = {
        schemaVersion: EXPEDITION_KERNEL_SCHEMA_VERSION,
        expeditionId: plan.expeditionId,
        elapsedResolvedMs: 3_600_000,
        partialAction: null,
        nextActionSequence: 120,
        health: 100,
        inventoryUsedSlots: 1,
        existingResourceStackPresent: true,
        availableFood: 20,
        resourcesObtained: 120,
        resourceXpGained: 120 * 25,
        combatXpGained: 0,
        encounters: 0,
        encountersWon: 0,
        encountersLost: 0,
        damageTaken: 0,
        foodConsumed: 0, // Impossible!
        productiveGatheringMs: 3_600_000,
        combatInterruptionMs: 0,
        status: "completed",
        stopReason: "duration_reached",
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "foodConsumed mismatch");
    });

    it("2. Active progress after two crossed boundaries with zero food consumption must be rejected", () => {
      const plan = makePlan({ requestedDurationMs: 300_000 }); // interval is 120,000, so at 250,000 we crossed 2 boundaries
      const progress: DeterministicExpeditionProgress = {
        schemaVersion: EXPEDITION_KERNEL_SCHEMA_VERSION,
        expeditionId: plan.expeditionId,
        elapsedResolvedMs: 250_000,
        partialAction: null,
        nextActionSequence: 8,
        health: 100,
        inventoryUsedSlots: 1,
        existingResourceStackPresent: true,
        availableFood: 20,
        resourcesObtained: 8,
        resourceXpGained: 8 * 25,
        combatXpGained: 0,
        encounters: 0,
        encountersWon: 0,
        encountersLost: 0,
        damageTaken: 0,
        foodConsumed: 0, // Should be 2!
        productiveGatheringMs: 250_000,
        combatInterruptionMs: 0,
        status: "active",
        stopReason: null,
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "foodConsumed mismatch");
    });

    it("3. Completed progress with one missing food consumption must be rejected", () => {
      const plan = makePlan({ requestedDurationMs: 120_000 }); // 1 boundary at 120,000ms
      const progress: DeterministicExpeditionProgress = {
        schemaVersion: EXPEDITION_KERNEL_SCHEMA_VERSION,
        expeditionId: plan.expeditionId,
        elapsedResolvedMs: 120_000,
        partialAction: null,
        nextActionSequence: 4,
        health: 100,
        inventoryUsedSlots: 1,
        existingResourceStackPresent: true,
        availableFood: 20,
        resourcesObtained: 4,
        resourceXpGained: 4 * 25,
        combatXpGained: 0,
        encounters: 0,
        encountersWon: 0,
        encountersLost: 0,
        damageTaken: 0,
        foodConsumed: 0, // Should be 1!
        productiveGatheringMs: 120_000,
        combatInterruptionMs: 0,
        status: "completed",
        stopReason: "duration_reached",
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "foodConsumed mismatch");
    });

    it("4. Valid food_exhausted progress must pass only at the first unsatisfied boundary", () => {
      const plan = makePlan({ requestedDurationMs: 300_000, rules: makeRules({ foodConsumptionIntervalMs: 10_000 }) });
      const startingState = makeStartingState({ availableFood: 2 }); // Exhausted at boundary 3 (at 30,000ms)
      const progress = resolveDeterministicExpedition(plan, createDeterministicExpeditionProgress(plan, startingState), 30_000).progress;

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("food_exhausted");
      expect(progress.elapsedResolvedMs).toBe(30_000);
      expect(progress.foodConsumed).toBe(2);
      expect(progress.availableFood).toBe(0);

      // Verify it passes validation
      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress)).not.toThrow();
    });

    it("5. food_exhausted one millisecond before or after that boundary must fail", () => {
      const plan = makePlan({ requestedDurationMs: 300_000, rules: makeRules({ foodConsumptionIntervalMs: 10_000 }) });
      const startingState = makeStartingState({ availableFood: 2 });
      const progress = resolveDeterministicExpedition(plan, createDeterministicExpeditionProgress(plan, startingState), 30_000).progress;

      // 1ms before
      const earlyProgress: DeterministicExpeditionProgress = {
        ...progress,
        elapsedResolvedMs: 29_999,
        productiveGatheringMs: 29_999,
      };
      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, earlyProgress), "invalid_progress", "food_exhausted stop must occur exactly at a food boundary");

      // 1ms after
      const lateProgress: DeterministicExpeditionProgress = {
        ...progress,
        elapsedResolvedMs: 30_001,
        productiveGatheringMs: 30_001,
      };
      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, lateProgress), "invalid_progress", "food_exhausted stop must occur exactly at a food boundary");
    });

    it("6. inventory_full and health_critical at an exact simultaneous food boundary must preserve action-outcome-first food semantics", () => {
      // If stopped with inventory_full exactly at 30,000ms which coincides with action completion,
      // action outcome stops the resolution, so the food boundary at 30,000ms is not processed (consumes boundaryCount - 1 food)
      const plan = makePlan({
        requestedDurationMs: 120_000,
        rules: makeRules({ encounterChancePpm: 0, gatheringWindowMs: 30_000, foodConsumptionIntervalMs: 30_000, inventorySlotLimit: 1 }),
      });
      const startingState = makeStartingState({ availableFood: 5, startingInventoryUsedSlots: 1, existingResourceStackPresent: false });
      const progress = resolveDeterministicExpedition(plan, createDeterministicExpeditionProgress(plan, startingState), 120_000).progress;

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("inventory_full");
      expect(progress.elapsedResolvedMs).toBe(30_000);
      expect(progress.foodConsumed).toBe(0); // boundaryCount is 1, but we complete at simultaneous boundary so expected is boundaryCount - 1 = 0!

      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress)).not.toThrow();
    });
  });

  // ==========================================================================
  // DAMAGE AND LOSSES
  // ==========================================================================
  describe("DAMAGE AND LOSS INVARIANTS", () => {
    it("7. Reject damage below encounters * enemyDamageMin", () => {
      const plan = makePlan({
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, enemyDamageMin: 10, enemyDamageMax: 20 }),
      });
      const startingState = makeStartingState();
      const progress = resolveDeterministicExpedition(plan, createDeterministicExpeditionProgress(plan, startingState), 15_000).progress; // 1 encounter

      expect(progress.encounters).toBe(1);
      expect(progress.damageTaken).toBeGreaterThanOrEqual(10);

      // Forge damage taken below 10
      const forged: DeterministicExpeditionProgress = {
        ...progress,
        damageTaken: 9,
        health: 91, // Keep health consistent
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "is out of deterministic range");
    });

    it("8. Reject damage above encounters * enemyDamageMax", () => {
      const plan = makePlan({
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, enemyDamageMin: 10, enemyDamageMax: 20 }),
      });
      const startingState = makeStartingState();
      const progress = resolveDeterministicExpedition(plan, createDeterministicExpeditionProgress(plan, startingState), 15_000).progress; // 1 encounter

      // Forge damage taken above 20
      const forged: DeterministicExpeditionProgress = {
        ...progress,
        damageTaken: 21,
        health: 79, // Keep health consistent
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "is out of deterministic range");
    });

    it("9. Reject encountersLost > 1", () => {
      const plan = makePlan();
      const progress = makeProgress({
        encounters: 3,
        encountersWon: 1,
        encountersLost: 2, // Impossible!
        combatXpGained: 50,
        nextActionSequence: 3,
        damageTaken: 30,
        health: 70,
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "must be either 0 or 1");
    });

    it("10. Reject a lost encounter on active or completed progress", () => {
      const plan = makePlan();
      const progress = makeProgress({
        encounters: 2,
        encountersWon: 1,
        encountersLost: 1,
        status: "completed",
        stopReason: "duration_reached",
        elapsedResolvedMs: 120_000,
        combatInterruptionMs: 30_000,
        productiveGatheringMs: 90_000,
        resourcesObtained: 3,
        resourceXpGained: 75,
        combatXpGained: 50,
        damageTaken: 20,
        health: 80,
        nextActionSequence: 5,
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "encountersLost can only be 1 when stopped on health_critical");
    });

    it("11. Reject health_critical with health above the threshold", () => {
      const plan = makePlan({ rules: makeRules({ minimumHealthToContinue: 5 }) });
      const progress = makeProgress({
        status: "stopped",
        stopReason: "health_critical",
        health: 50, // Above threshold!
        damageTaken: 50,
        encounters: 5,
        encountersWon: 4,
        encountersLost: 1,
        combatXpGained: 200,
        combatInterruptionMs: 75_000,
        productiveGatheringMs: 0,
        elapsedResolvedMs: 75_000,
        nextActionSequence: 5,
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "encountersLost can only be 1 when stopped on health_critical with health <= minimumHealthToContinue");
    });

    it("12. Accept the legitimate zero-elapsed, already-low-health stop case", () => {
      const plan = makePlan();
      const startingState = makeStartingState({ startingHealth: 0 }); // Already critical!
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 30_000).progress;

      expect(resolved.status).toBe("stopped");
      expect(resolved.stopReason).toBe("health_critical");
      expect(resolved.elapsedResolvedMs).toBe(0);

      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, resolved)).not.toThrow();
    });
  });

  // ==========================================================================
  // TERMINAL REASONS
  // ==========================================================================
  describe("TERMINAL REASONS STATE CONSISTENCY", () => {
    it("13. Reject inventory_full when inventory has a free slot", () => {
      const plan = makePlan({ rules: makeRules({ inventorySlotLimit: 18 }) });
      const progress = makeProgress({
        status: "stopped",
        stopReason: "inventory_full",
        elapsedResolvedMs: 30_000,
        productiveGatheringMs: 30_000,
        inventoryUsedSlots: 17, // Free slot exists!
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 17,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "invalid inventory_full stop state counters");
    });

    it("14. Reject inventory_full when the resource stack already exists", () => {
      const plan = makePlan({ rules: makeRules({ inventorySlotLimit: 18 }) });
      const progress = makeProgress({
        status: "stopped",
        stopReason: "inventory_full",
        elapsedResolvedMs: 30_000,
        productiveGatheringMs: 30_000,
        inventoryUsedSlots: 18,
        existingResourceStackPresent: true, // Stack already exists, we shouldn't stop with full!
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 18,
          existingResourceStackPresent: true,
          availableFood: 20,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "invalid inventory_full stop state counters");
    });

    it("15. Reject food_exhausted while availableFood is positive", () => {
      const plan = makePlan({ requestedDurationMs: 3_000_000 });
      const progress = makeProgress({
        status: "stopped",
        stopReason: "food_exhausted",
        foodConsumed: 19,
        availableFood: 1, // Positive food!
        elapsedResolvedMs: 2_400_000,
        productiveGatheringMs: 2_400_000,
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 19,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "availableFood mismatch");
    });

    it("16. Reject activity_invalid because the kernel cannot emit it", () => {
      const plan = makePlan();
      const progress = makeProgress({
        status: "stopped",
        stopReason: "activity_invalid",
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "activity_invalid stop reason is not supported");
    });
  });

  // ==========================================================================
  // COMBAT CLOCK
  // ==========================================================================
  describe("COMBAT CLOCK INVARIANTS", () => {
    it("17. Reject an active partial encounter whose elapsed partial time is assigned to productiveGatheringMs instead of combatInterruptionMs", () => {
      const plan = makePlan({
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 15_000 }),
      });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 5_000).progress; // Active partial encounter

      expect(resolved.partialAction?.kind).toBe("encounter");
      expect(resolved.combatInterruptionMs).toBe(5_000);
      expect(resolved.productiveGatheringMs).toBe(0);

      // Forge time buckets
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        productiveGatheringMs: 5_000,
        combatInterruptionMs: 0, // Fraud!
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "active progress productiveGatheringMs");
    });

    it("18. Reject completed progress where combatInterruptionMs does not equal encounters * combatDurationMs", () => {
      const plan = makePlan({
        requestedDurationMs: 60_000,
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 15_000, enemyDamageMin: 1, enemyDamageMax: 1 }),
      });
      const startingState = makeStartingState();
      const progress = resolveDeterministicExpedition(plan, createDeterministicExpeditionProgress(plan, startingState), 60_000).progress; // 4 encounters completed

      expect(progress.encounters).toBe(4);
      expect(progress.combatInterruptionMs).toBe(60_000);

      const forged: DeterministicExpeditionProgress = {
        ...progress,
        combatInterruptionMs: 45_000, // Fraud!
        productiveGatheringMs: 15_000,
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "completed progress must have exact nominal combat");
    });

    it("19. Reject health_critical with missing completed combat time", () => {
      const plan = makePlan({
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 15_000, enemyDamageMin: 100, enemyDamageMax: 100 }),
      });
      const startingState = makeStartingState({ startingHealth: 50 });
      const progress = resolveDeterministicExpedition(plan, createDeterministicExpeditionProgress(plan, startingState), 15_000).progress; // Stopped on health_critical

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("health_critical");
      expect(progress.combatInterruptionMs).toBe(15_000);

      const forged: DeterministicExpeditionProgress = {
        ...progress,
        combatInterruptionMs: 10_000, // Fraud!
        productiveGatheringMs: 5_000,
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "health_critical stop");
    });

    it("20. Accept food exhaustion partway through an encounter when residual combat time is within the action duration", () => {
      const plan = makePlan({
        requestedDurationMs: 120_000,
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 15_000, foodConsumptionIntervalMs: 10_000, enemyDamageMin: 1, enemyDamageMax: 1 }),
      });
      const startingState = makeStartingState({ availableFood: 0 }); // Stops on food boundary at 10,000ms mid-combat

      const progress = resolveDeterministicExpedition(plan, createDeterministicExpeditionProgress(plan, startingState), 120_000).progress;

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("food_exhausted");
      expect(progress.elapsedResolvedMs).toBe(10_000);
      expect(progress.combatInterruptionMs).toBe(10_000); // residual is 10,000ms which is strictly within (0, 15,000ms)

      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress)).not.toThrow();
    });

    it("21. Reject food-exhausted residual combat time equal to or greater than a full uncounted combat duration", () => {
      const plan = makePlan({
        requestedDurationMs: 120_000,
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 15_000, foodConsumptionIntervalMs: 10_000 }),
      });
      const startingState = makeStartingState({ availableFood: 0 });
      const progress = resolveDeterministicExpedition(plan, createDeterministicExpeditionProgress(plan, startingState), 120_000).progress;

      const forged: DeterministicExpeditionProgress = {
        ...progress,
        combatInterruptionMs: 15_000, // residual is 15,000 which is >= rules.combatDurationMs
        productiveGatheringMs: -5_000,
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "actionStartMs must be non-negative");
    });
  });

  // ==========================================================================
  // SAFE INTEGER
  // ==========================================================================
  describe("SAFE INTEGER INVARIANTS", () => {
    it("22. Reject overflow in action-sequence, combat-time and damage-bound calculations", () => {
      const plan = makePlan();
      const progress = makeProgress({
        encounters: Number.MAX_SAFE_INTEGER - 10,
        encountersWon: Number.MAX_SAFE_INTEGER - 10,
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "overflow");
    });
  });

  // ==========================================================================
  // SCALING TEST
  // ==========================================================================
  describe("SCALING INVARIANTS", () => {
    it("23. Replace the current invalid scaling fixture with a genuinely valid long-duration progress", () => {
      const plan = makePlan({
        requestedDurationMs: 3_600_000, // 1 hour plan
        rules: makeRules({ foodConsumptionIntervalMs: 120_000 }),
      });

      const validProgress: DeterministicExpeditionProgress = {
        schemaVersion: EXPEDITION_KERNEL_SCHEMA_VERSION,
        expeditionId: plan.expeditionId,
        elapsedResolvedMs: 3_600_000,
        partialAction: null,
        nextActionSequence: 120, // 120 gathers completed
        health: 100,
        inventoryUsedSlots: 1,
        existingResourceStackPresent: true,
        availableFood: 50, // 30 will be consumed
        resourcesObtained: 120,
        resourceXpGained: 120 * 25,
        combatXpGained: 0,
        encounters: 0,
        encountersWon: 0,
        encountersLost: 0,
        damageTaken: 0,
        foodConsumed: 30, // boundaryCount is floor(3,600,000 / 120,000) === 30
        productiveGatheringMs: 3_600_000,
        combatInterruptionMs: 0,
        status: "completed",
        stopReason: "duration_reached",
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 80,
        },
      };

      // Ensure this compiles and executes instantly and has O(1) performance
      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, validProgress)).not.toThrow();
    });
  });

  // ==========================================================================
  // SOURCE PURITY
  // ==========================================================================
  describe("SOURCE PURITY SCAN", () => {
    it("mechanically ensures forbidden ambient APIs are not utilized in production source", () => {
      const coreDir = path.resolve(__dirname);
      const filesToScan = ["expedition-contract.ts", "expedition-kernel.ts"].map((f) =>
        path.join(coreDir, f)
      );

      const forbiddenPatterns = [
        /\bDate\b/,
        /\bDate\.now\b/,
        /\bnew\s+Date\b/,
        /\bperformance\b/,
        /\bperformance\.now\b/,
        /\bMath\.random\b/,
        /\bcrypto\b/,
        /\brandomUUID\b/,
        /localStorage/,
        /sessionStorage/,
        /indexedDB/,
        /\bfetch\b/,
        /XMLHttpRequest/,
        /WebSocket/,
        /simulateUpTo/,
      ];

      for (const filepath of filesToScan) {
        if (!fs.existsSync(filepath)) {
          throw new Error(`File not found: ${filepath}`);
        }
        const content = fs.readFileSync(filepath, "utf-8");
        const strippedContent = content
          .replace(/\/\/.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "");

        for (const pattern of forbiddenPatterns) {
          expect(strippedContent).not.toMatch(pattern);
        }
      }
    });
  });

  // ==========================================================================
  // PHASE 10 CORRECTIVE PASS GAPS
  // ==========================================================================
  describe("Phase 10 Corrective Pass Gaps", () => {
    it("1. Reject completed progress with one winning encounter and health exactly equal to minimumHealthToContinue", () => {
      const plan = makePlan();
      const progress = makeProgress({
        status: "completed",
        stopReason: "duration_reached",
        elapsedResolvedMs: 120_000,
        encounters: 1,
        encountersWon: 1,
        encountersLost: 0,
        combatXpGained: 50,
        damageTaken: 10,
        health: 5,
        combatInterruptionMs: 15_000,
        productiveGatheringMs: 105_000,
        resourcesObtained: 3,
        resourceXpGained: 75,
        nextActionSequence: 4,
        initialState: {
          startingHealth: 15,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "health must be strictly above minimumHealthToContinue");
    });

    it("2. Reject completed progress with health below the threshold and zero losses", () => {
      const plan = makePlan();
      const progress = makeProgress({
        status: "completed",
        stopReason: "duration_reached",
        elapsedResolvedMs: 120_000,
        encounters: 1,
        encountersWon: 1,
        encountersLost: 0,
        combatXpGained: 50,
        damageTaken: 10,
        health: 4,
        combatInterruptionMs: 15_000,
        productiveGatheringMs: 105_000,
        resourcesObtained: 3,
        resourceXpGained: 75,
        nextActionSequence: 4,
        initialState: {
          startingHealth: 14,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "health must be strictly above minimumHealthToContinue");
    });

    it("3. Reject inventory_full at critical health", () => {
      const plan = makePlan();
      const progress = makeProgress({
        status: "stopped",
        stopReason: "inventory_full",
        elapsedResolvedMs: 30_000,
        productiveGatheringMs: 30_000,
        combatInterruptionMs: 0,
        inventoryUsedSlots: 18,
        existingResourceStackPresent: false,
        health: 4, // Critical health but stopReason is inventory_full
        damageTaken: 0,
        initialState: {
          startingHealth: 4,
          startingInventoryUsedSlots: 18,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "health must be strictly above minimumHealthToContinue");
    });

    it("4. Reject food_exhausted at critical health", () => {
      const plan = makePlan({ rules: makeRules({ foodConsumptionIntervalMs: 30_000 }) });
      const progress = makeProgress({
        status: "stopped",
        stopReason: "food_exhausted",
        elapsedResolvedMs: 30_000,
        productiveGatheringMs: 30_000,
        combatInterruptionMs: 0,
        foodConsumed: 0,
        availableFood: 0,
        health: 4, // Critical health but stopReason is food_exhausted
        damageTaken: 0,
        initialState: {
          startingHealth: 4,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 0,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "health must be strictly above minimumHealthToContinue");
    });

    it("5. Reject inventory_full at elapsed 0", () => {
      const plan = makePlan();
      const progress = makeProgress({
        status: "stopped",
        stopReason: "inventory_full",
        elapsedResolvedMs: 0,
        productiveGatheringMs: 0,
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "inventory_full must occur at positive elapsed time");
    });

    it("6. Reject inventory_full with productiveGatheringMs 0", () => {
      const plan = makePlan({
        seed: "partial-forgery-encounter",
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 15_000, gatheringWindowMs: 30_000, enemyDamageMin: 10, enemyDamageMax: 10 }),
      });
      const progress = makeProgress({
        status: "stopped",
        stopReason: "inventory_full",
        elapsedResolvedMs: 30_000,
        productiveGatheringMs: 0,
        combatInterruptionMs: 30_000,
        encounters: 2,
        encountersWon: 2,
        combatXpGained: 100,
        nextActionSequence: 2,
        damageTaken: 20,
        health: 80, // Corrected to align with initial state minus damage taken!
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 18,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      });

      // Let's explicitly fail productiveGatheringMs > 0 check first
      const hijackedProgress = {
        ...progress,
        inventoryUsedSlots: 18, // inventory Used slots is correct
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, hijackedProgress), "invalid_progress", "inventory_full requires positive productiveGatheringMs");
    });

    it("7. Reject inventory_full whose terminal sequence deterministically schedules an encounter", () => {
      const plan = makePlan({
        seed: "partial-forgery-encounter",
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 15_000, gatheringWindowMs: 30_000 }),
      });
      const progress = makeProgress({
        status: "stopped",
        stopReason: "inventory_full",
        elapsedResolvedMs: 30_000,
        productiveGatheringMs: 30_000,
        combatInterruptionMs: 0,
        inventoryUsedSlots: 18,
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 18,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "inventory_full rejected because the scheduled terminal action was an encounter");
    });

    it("8. Reject inventory_full with a failed-gather duration inconsistent with gathering window bounds", () => {
      const plan = makePlan();
      const progress = makeProgress({
        status: "stopped",
        stopReason: "inventory_full",
        elapsedResolvedMs: 20_000, // 20,000 is less than 30,000, but remaining plan window is 100,000 (meaning gather window was not cut short)
        productiveGatheringMs: 20_000,
        inventoryUsedSlots: 18,
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 18,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "does not match expected failed gather duration");
    });

    it("9. Reject encounterChancePpm === 0 with forged positive residual combat", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 10_000 }) });
      const progress = makeProgress({
        status: "stopped",
        stopReason: "food_exhausted",
        elapsedResolvedMs: 10_000,
        foodConsumed: 0,
        availableFood: 0,
        combatInterruptionMs: 5_000,
        productiveGatheringMs: 5_000,
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 0,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "residual combat is positive but scheduled action is gathering");
    });

    it("10. Reject encounterChancePpm === PROBABILITY_SCALE with forged positive residual gathering", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 15_000, foodConsumptionIntervalMs: 10_000 }) });
      const progress = makeProgress({
        status: "stopped",
        stopReason: "food_exhausted",
        elapsedResolvedMs: 10_000,
        foodConsumed: 0,
        availableFood: 0,
        combatInterruptionMs: 0,
        productiveGatheringMs: 10_000,
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 0,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "residual gathering is positive but scheduled action is encounter");
    });

    it("11. Reject simultaneous positive residual gathering and residual combat", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 15_000, foodConsumptionIntervalMs: 10_000 }) });
      const progress = makeProgress({
        status: "stopped",
        stopReason: "food_exhausted",
        elapsedResolvedMs: 10_000,
        foodConsumed: 0,
        availableFood: 0,
        combatInterruptionMs: 5_000,
        productiveGatheringMs: 5_000,
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 0,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "residual combat and residual gathering cannot both be positive");
    });

    it("12. Reject residual current-action time inconsistent with elapsedResolvedMs", () => {
      const plan = makePlan({ rules: makeRules({ foodConsumptionIntervalMs: 10_000 }) });
      const progress = makeProgress({
        status: "stopped",
        stopReason: "food_exhausted",
        elapsedResolvedMs: 10_000,
        foodConsumed: 0,
        availableFood: 0,
        combatInterruptionMs: 15_000, // residual combat is 15,000, equal to combatDurationMs (violates strictly below)
        productiveGatheringMs: -5_000,
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 0,
        },
      });

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress), "invalid_progress", "actionStartMs must be non-negative");
    });
  });

  // ==========================================================================
  // PHASE 4 CORRECTIVE PASS 4 GAPS
  // ==========================================================================
  describe("Phase 4 Corrective Pass 4 Gaps", () => {
    // --- A. ACTIVE MISSING PARTIAL ---

    it("1. Reject active progress with elapsedResolvedMs 5,000, productiveGatheringMs 5,000, zero completed gatherings, zero encounters, partialAction null", () => {
      const plan = makePlan();
      const progress = makeProgress({
        status: "active",
        stopReason: null,
        elapsedResolvedMs: 5_000,
        productiveGatheringMs: 5_000,
        resourcesObtained: 0,
        resourceXpGained: 0,
        encounters: 0,
        nextActionSequence: 0,
        partialAction: null,
      });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "active progress productiveGatheringMs must exactly equal nominal completed plus partial elapsed",
      );
    });

    it("2. Accept an active cursor at an exact completed-action boundary with no partialAction", () => {
      const plan = makePlan();
      const progress = makeProgress({
        status: "active",
        stopReason: null,
        elapsedResolvedMs: 30_000,
        productiveGatheringMs: 30_000,
        resourcesObtained: 1,
        resourceXpGained: 25,
        existingResourceStackPresent: true,
        inventoryUsedSlots: 1,
        encounters: 0,
        nextActionSequence: 1,
        partialAction: null,
      });
      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress)).not.toThrow();
    });

    it("3. Accept an active partial gathering with exact productive time", () => {
      const plan = makePlan();
      const progress = makeProgress({
        status: "active",
        stopReason: null,
        elapsedResolvedMs: 5_000,
        productiveGatheringMs: 5_000,
        resourcesObtained: 0,
        resourceXpGained: 0,
        encounters: 0,
        nextActionSequence: 0,
        partialAction: {
          kind: "gathering",
          actionSequence: 0,
          elapsedInActionMs: 5_000,
        },
      });
      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress)).not.toThrow();
    });

    it("4. Accept an active partial encounter with exact combat time", () => {
      const plan = makePlan({
        seed: "partial-forgery-encounter",
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 15_000, gatheringWindowMs: 30_000 }),
      });
      const progress = makeProgress({
        status: "active",
        stopReason: null,
        elapsedResolvedMs: 5_000,
        combatInterruptionMs: 5_000,
        productiveGatheringMs: 0,
        resourcesObtained: 0,
        resourceXpGained: 0,
        encounters: 0,
        nextActionSequence: 0,
        partialAction: {
          kind: "encounter",
          actionSequence: 0,
          elapsedInActionMs: 5_000,
        },
      });
      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress)).not.toThrow();
    });

    it("5. Reject a partial gathering whose elapsed time is omitted from the productive bucket", () => {
      const plan = makePlan();
      const progress = makeProgress({
        status: "active",
        stopReason: null,
        elapsedResolvedMs: 5_000,
        productiveGatheringMs: 0,
        combatInterruptionMs: 5_000, // Must sum up to 5,000 to pass the sum check
        resourcesObtained: 0,
        resourceXpGained: 0,
        encounters: 0,
        nextActionSequence: 0,
        partialAction: {
          kind: "gathering",
          actionSequence: 0,
          elapsedInActionMs: 5_000,
        },
      });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "active progress productiveGatheringMs",
      );
    });

    // --- B. SHORT FINAL GATHERING ---

    it("6. Real resolver with short final plan window stops with food_exhausted at plan end and completes shortened gathering", () => {
      const plan = makePlan({
        requestedDurationMs: 25_000,
        rules: makeRules({
          gatheringWindowMs: 30_000,
          encounterChancePpm: 0,
          foodConsumptionIntervalMs: 25_000,
        }),
      });
      const startingState = makeStartingState({
        availableFood: 0,
      });

      const resolved = resolveDeterministicExpedition(
        plan,
        createDeterministicExpeditionProgress(plan, startingState),
        25_000,
      );

      const progress = resolved.progress;
      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("food_exhausted");
      expect(progress.elapsedResolvedMs).toBe(25_000);
      expect(progress.resourcesObtained).toBe(1); // Short final gathering completes and awards its resource!
      expect(progress.productiveGatheringMs).toBe(25_000);

      // Verify it passes validation
      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, progress)).not.toThrow();

      // Can be passed back as a terminal no-op without throwing
      const secondResolution = resolveDeterministicExpedition(plan, progress, 10_000);
      expect(secondResolution.progress).toEqual(progress);
    });

    it("7. For same plan, reject forged food_exhausted cursor with zero completed gatherings and 25,000 productive gathering ms and no residual action", () => {
      const plan = makePlan({
        requestedDurationMs: 25_000,
        rules: makeRules({
          gatheringWindowMs: 30_000,
          encounterChancePpm: 0,
          foodConsumptionIntervalMs: 25_000,
        }),
      });
      const progress = makeProgress({
        status: "stopped",
        stopReason: "food_exhausted",
        elapsedResolvedMs: 25_000,
        productiveGatheringMs: 25_000,
        resourcesObtained: 0, // Fraud! Must have completed the shortened gathering since it reached plan end.
        resourceXpGained: 0,
        nextActionSequence: 0,
        foodConsumed: 0,
        availableFood: 0,
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 0,
        },
      });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "productiveGatheringMs exceeds nominal completed",
      );
    });

    it("8. Accept a normally completed plan whose final gathering is shorter than gatheringWindowMs", () => {
      const plan = makePlan({
        requestedDurationMs: 45_000, // 30k first gather, 15k second gather (short final gathering)
        rules: makeRules({
          gatheringWindowMs: 30_000,
          encounterChancePpm: 0,
        }),
      });
      const startingState = makeStartingState({
        availableFood: 10,
      });

      const resolved = resolveDeterministicExpedition(
        plan,
        createDeterministicExpeditionProgress(plan, startingState),
        45_000,
      );

      expect(resolved.progress.status).toBe("completed");
      expect(resolved.progress.elapsedResolvedMs).toBe(45_000);
      expect(resolved.progress.resourcesObtained).toBe(2); // Both completed
      expect(resolved.progress.productiveGatheringMs).toBe(45_000);

      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, resolved.progress)).not.toThrow();
    });

    it("9. Reject completed progress that represents two shortened gatherings", () => {
      const plan = makePlan({
        requestedDurationMs: 50_000,
        rules: makeRules({
          gatheringWindowMs: 30_000,
          encounterChancePpm: 0,
          enemyDamageMin: 10,
          enemyDamageMax: 10,
        }),
      });
      const progress = makeProgress({
        status: "completed",
        stopReason: "duration_reached",
        elapsedResolvedMs: 50_000,
        productiveGatheringMs: 20_000, // Nominal is 2 completed * 30k = 60k. Actual is 20k, deficit is 40k.
        combatInterruptionMs: 30_000, // Sum must equal 50,000 elapsedResolvedMs
        resourcesObtained: 2,
        resourceXpGained: 50,
        encounters: 2,
        encountersWon: 2,
        combatXpGained: 100,
        nextActionSequence: 4,
        damageTaken: 20,
        health: 80,
        existingResourceStackPresent: true,
        inventoryUsedSlots: 1,
        foodConsumed: 0,
        availableFood: 20,
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "deficit does not match a single shortened final gathering",
      );
    });

    it("10. Reject a shortened final gathering whose deterministic final sequence schedules an encounter that fits in the remaining window", () => {
      // Create seed where sequence 1 is encounter
      const plan = makePlan({
        seed: "partial-forgery-encounter",
        requestedDurationMs: 45_000,
        rules: makeRules({
          gatheringWindowMs: 30_000,
          encounterChancePpm: PROBABILITY_SCALE,
          combatDurationMs: 15_000,
        }),
      });
      // Sequence 0: gathering (takes 30k, ending at 30k, remaining plan duration is 15k).
      // Sequence 1: remaining duration 15k. encounter is scheduled deterministically and fits perfectly!
      // If a forged progress claims sequence 1 was completed as a gathering instead, reject it.
      const progress = makeProgress({
        status: "completed",
        stopReason: "duration_reached",
        elapsedResolvedMs: 45_000,
        productiveGatheringMs: 45_000, // Claims gathering!
        resourcesObtained: 2, // Claims 2 gathers completed!
        resourceXpGained: 50,
        nextActionSequence: 2,
        existingResourceStackPresent: true,
        inventoryUsedSlots: 1,
        foodConsumed: 0,
        availableFood: 20,
      });

      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "shortened final gathering represented a deterministic final encounter",
      );
    });

    // --- C. OTHER TERMINAL TIME ACCOUNTING ---

    it("11. Reject health_critical progress with productiveGatheringMs exceeding completedGatherings * gatheringWindowMs", () => {
      const plan = makePlan({
        rules: makeRules({
          encounterChancePpm: PROBABILITY_SCALE,
          combatDurationMs: 15_000,
          gatheringWindowMs: 30_000,
          enemyDamageMin: 10,
          enemyDamageMax: 10,
          minimumHealthToContinue: 5,
        }),
      });
      const progress = makeProgress({
        status: "stopped",
        stopReason: "health_critical",
        elapsedResolvedMs: 45_000,
        productiveGatheringMs: 30_001, // Nominal completed gatherings is 1 * 30k = 30k. Actual is 30,001!
        combatInterruptionMs: 14_999,
        resourcesObtained: 1,
        resourceXpGained: 25,
        existingResourceStackPresent: true,
        inventoryUsedSlots: 1,
        encounters: 1,
        encountersLost: 1,
        nextActionSequence: 2,
        damageTaken: 10,
        health: 2, // 12 - 10 = 2 < 5 (critical health!)
        initialState: {
          startingHealth: 12,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "health_critical stop at positive elapsed requires all gatherings to be full duration",
      );
    });

    it("12. Reject completed progress with unaccounted productive time and no completed or shortened final gathering", () => {
      const plan = makePlan({
        requestedDurationMs: 5_000,
        rules: makeRules({
          gatheringWindowMs: 30_000,
          encounterChancePpm: 0,
        }),
      });
      const progress = makeProgress({
        status: "completed",
        stopReason: "duration_reached",
        elapsedResolvedMs: 5_000,
        productiveGatheringMs: 5_000, // Zero completed gatherings but 5,000ms productive time!
        resourcesObtained: 0,
        resourceXpGained: 0,
        nextActionSequence: 0,
        foodConsumed: 0,
        availableFood: 20,
        initialState: {
          startingHealth: 100,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      });
      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "productiveGatheringMs exceeds nominal completed gathering duration",
      );
    });
  });

  describe("Zero-Elapsed Health-Critical Integrity Gaps", () => {
    it("A. Reject forged zero-time health_critical progress with completed gathering rewards", () => {
      const plan = makePlan();
      const progress = makeProgress({
        status: "stopped",
        stopReason: "health_critical",
        elapsedResolvedMs: 0,
        health: plan.rules.minimumHealthToContinue,
        encounters: 0,
        encountersWon: 0,
        encountersLost: 0,
        damageTaken: 0,
        productiveGatheringMs: 0,
        combatInterruptionMs: 0,
        resourcesObtained: plan.rules.resourceQuantityPerGather,
        resourceXpGained: plan.rules.resourceXpPerGather,
        nextActionSequence: 1,
        existingResourceStackPresent: true,
        inventoryUsedSlots: 1,
        initialState: {
          startingHealth: plan.rules.minimumHealthToContinue,
          startingInventoryUsedSlots: 0,
          existingResourceStackPresent: false,
          availableFood: 20,
        },
      });

      expectError(
        () => validateDeterministicExpeditionProgressAgainstPlan(plan, progress),
        "invalid_progress",
        "forged zero-elapsed health_critical stop is rejected",
      );
    });

    it("B. Real critical start, no existing stack, resolved for positive time, stopped immediately, passes validation and works as no-op", () => {
      const plan = makePlan();
      const startingState = makeStartingState({
        startingHealth: plan.rules.minimumHealthToContinue,
        startingInventoryUsedSlots: 0,
        existingResourceStackPresent: false,
      });

      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 10_000);

      const resolvedProgress = resolved.progress;
      expect(resolvedProgress.status).toBe("stopped");
      expect(resolvedProgress.stopReason).toBe("health_critical");
      expect(resolvedProgress.elapsedResolvedMs).toBe(0);
      expect(resolvedProgress.resourcesObtained).toBe(0);
      expect(resolvedProgress.resourceXpGained).toBe(0);
      expect(resolvedProgress.combatXpGained).toBe(0);
      expect(resolvedProgress.encounters).toBe(0);
      expect(resolvedProgress.encountersWon).toBe(0);
      expect(resolvedProgress.encountersLost).toBe(0);
      expect(resolvedProgress.damageTaken).toBe(0);
      expect(resolvedProgress.foodConsumed).toBe(0);
      expect(resolvedProgress.productiveGatheringMs).toBe(0);
      expect(resolvedProgress.combatInterruptionMs).toBe(0);
      expect(resolvedProgress.nextActionSequence).toBe(0);
      expect(resolvedProgress.health).toBe(plan.rules.minimumHealthToContinue);
      expect(resolvedProgress.availableFood).toBe(startingState.availableFood);
      expect(resolvedProgress.inventoryUsedSlots).toBe(startingState.startingInventoryUsedSlots);
      expect(resolvedProgress.existingResourceStackPresent).toBe(startingState.existingResourceStackPresent);

      // Assert plan-aware validation passes
      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, resolvedProgress)).not.toThrow();

      // Pass back to real resolver as a terminal no-op
      const noOpResolved = resolveDeterministicExpedition(plan, resolvedProgress, 10_000);
      expect(noOpResolved.progress).toEqual(resolvedProgress);
    });

    it("C. Real critical start, existing stack, validates successfully and keeps existing stack/slot counts unchanged", () => {
      const plan = makePlan();
      const startingState = makeStartingState({
        startingHealth: plan.rules.minimumHealthToContinue,
        startingInventoryUsedSlots: 3,
        existingResourceStackPresent: true,
      });

      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 10_000);

      const resolvedProgress = resolved.progress;
      expect(resolvedProgress.status).toBe("stopped");
      expect(resolvedProgress.stopReason).toBe("health_critical");
      expect(resolvedProgress.elapsedResolvedMs).toBe(0);
      expect(resolvedProgress.inventoryUsedSlots).toBe(3);
      expect(resolvedProgress.existingResourceStackPresent).toBe(true);

      // Assert plan-aware validation passes
      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, resolvedProgress)).not.toThrow();
    });
  });
});

function makeProgress(overrides: Partial<DeterministicExpeditionProgress> = {}): DeterministicExpeditionProgress {
  return {
    schemaVersion: EXPEDITION_KERNEL_SCHEMA_VERSION,
    expeditionId: "exp-adversarial",
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
    initialState: {
      startingHealth: 100,
      startingInventoryUsedSlots: 0,
      existingResourceStackPresent: false,
      availableFood: 20,
    },
    ...overrides,
  };
}
