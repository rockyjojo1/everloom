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
import { DeterministicExpeditionError } from "./expedition-contract";
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
    seed: "adversarial-seed-1",
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

describe("deterministic expedition adversarial hardening audit", () => {
  // A. ACTION-SEQUENCE INTEGRITY
  describe("A. ACTION-SEQUENCE INTEGRITY", () => {
    it("rejects progress when nextActionSequence is increased without corresponding completed actions", () => {
      const plan = makePlan({ seed: "sequence-integrity-1" });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 30_000).progress;

      // Forger manually increments nextActionSequence
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        nextActionSequence: resolved.nextActionSequence + 1,
      };

      expectError(() => resolveDeterministicExpedition(plan, forged, 30_000), "invalid_progress", "");
    });

    it("rejects progress when nextActionSequence is reduced below completed actions", () => {
      const plan = makePlan({ seed: "sequence-integrity-2" });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 60_000).progress;

      // Resolved has completed at least 1 action, let's reduce nextActionSequence to 0
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        nextActionSequence: 0,
      };

      expectError(() => resolveDeterministicExpedition(plan, forged, 30_000), "invalid_progress", "");
    });

    it("rejects progress where a completed gathering or encounter is skipped (gap in timeline)", () => {
      const plan = makePlan({ seed: "sequence-integrity-3" });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 60_000).progress;

      // Skip the first action sequence, mismatching counters and time resolution
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        nextActionSequence: resolved.nextActionSequence + 10,
        resourcesObtained: resolved.resourcesObtained + 10,
      };

      expectError(() => resolveDeterministicExpedition(plan, forged, 30_000), "invalid_progress", "");
    });

    it("rejects progress where elapsedResolvedMs and nextActionSequence describe incompatible points in the action timeline", () => {
      const plan = makePlan({ seed: "sequence-integrity-4", rules: makeRules({ encounterChancePpm: 0 }) });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 60_000).progress;

      // 60,000ms should correspond to 2 completed gatherings.
      // Let's modify nextActionSequence to represent something else.
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        nextActionSequence: 5,
      };

      expectError(() => resolveDeterministicExpedition(plan, forged, 30_000), "invalid_progress", "");
    });
  });

  // B. PARTIAL-ACTION KIND INTEGRITY
  describe("B. PARTIAL-ACTION KIND INTEGRITY", () => {
    it("rejects forged partial gathering where the deterministic stream schedules an encounter", () => {
      // Force encounters on every action
      const plan = makePlan({
        seed: "partial-integrity-1",
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 15_000, gatheringWindowMs: 30_000 }),
      });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 5_000).progress;

      // The scheduled action is an encounter. Let's forge a partial gathering instead.
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        partialAction: {
          kind: "gathering",
          actionSequence: resolved.nextActionSequence,
          elapsedInActionMs: 5_000,
        },
      };

      expectError(() => resolveDeterministicExpedition(plan, forged, 5_000), "invalid_progress", "");
    });

    it("rejects forged partial encounter where the stream schedules gathering", () => {
      // Force gathering (0 encounter chance)
      const plan = makePlan({
        seed: "partial-integrity-2",
        rules: makeRules({ encounterChancePpm: 0, gatheringWindowMs: 30_000 }),
      });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 5_000).progress;

      // Scheduled action is gathering. Let's forge a partial encounter instead.
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        partialAction: {
          kind: "encounter",
          actionSequence: resolved.nextActionSequence,
          elapsedInActionMs: 5_000,
        },
      };

      expectError(() => resolveDeterministicExpedition(plan, forged, 5_000), "invalid_progress", "");
    });

    it("rejects partial action with wrong actionSequence", () => {
      const plan = makePlan({ seed: "partial-integrity-3", rules: makeRules({ encounterChancePpm: 0 }) });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 5_000).progress;

      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        partialAction: {
          kind: "gathering",
          actionSequence: resolved.nextActionSequence + 1,
          elapsedInActionMs: 5_000,
        },
      };

      expectError(() => resolveDeterministicExpedition(plan, forged, 5_000), "invalid_progress", "");
    });

    it("rejects partial action with invalid action start and duration bounds", () => {
      const plan = makePlan({ seed: "partial-integrity-4", rules: makeRules({ encounterChancePpm: 0, gatheringWindowMs: 30_000 }) });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 5_000).progress;

      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        partialAction: {
          kind: "gathering",
          actionSequence: resolved.nextActionSequence,
          elapsedInActionMs: 35_000, // exceeds the gathering window duration!
        },
      };

      expectError(() => resolveDeterministicExpedition(plan, forged, 5_000), "invalid_progress", "");
    });
  });

  // C. GATHERING REWARD CONSISTENCY
  describe("C. GATHERING REWARD CONSISTENCY", () => {
    it("rejects if resourcesObtained is not a whole number of completed gathers", () => {
      const plan = makePlan({ seed: "gather-reward-1", rules: makeRules({ encounterChancePpm: 0, resourceQuantityPerGather: 5 }) });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 60_000).progress; // should be 2 gathers (10 resources)

      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        resourcesObtained: 7, // Not divisible by resourceQuantityPerGather (5)
      };

      expectError(() => resolveDeterministicExpedition(plan, forged, 30_000), "invalid_progress", "");
    });

    it("rejects if resourceXpGained is not equal to completed gathers multiplied by resourceXpPerGather", () => {
      const plan = makePlan({ seed: "gather-reward-2", rules: makeRules({ encounterChancePpm: 0, resourceXpPerGather: 25 }) });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 60_000).progress; // should be 2 gathers, xp=50

      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        resourceXpGained: 60, // wrong xp
      };

      expectError(() => resolveDeterministicExpedition(plan, forged, 30_000), "invalid_progress", "");
    });

    it("handles resourceXpPerGather = 0 without division/validation errors and detects XP corruption", () => {
      const plan = makePlan({ seed: "gather-reward-3", rules: makeRules({ encounterChancePpm: 0, resourceXpPerGather: 0 }) });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 60_000).progress;

      // This should validate fine with 0 XP
      expect(() => resolveDeterministicExpedition(plan, resolved, 30_000)).not.toThrow();

      // If we forge non-zero XP when xpPerGather is 0, it must be rejected
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        resourceXpGained: 10,
      };

      expectError(() => resolveDeterministicExpedition(plan, forged, 30_000), "invalid_progress", "");
    });
  });

  // D. COMBAT REWARD CONSISTENCY
  describe("D. COMBAT REWARD CONSISTENCY", () => {
    it("rejects if combatXpGained is not equal to encountersWon * combatXpPerWin", () => {
      const plan = makePlan({ seed: "combat-reward-1", rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatXpPerWin: 50, enemyDamageMin: 1, enemyDamageMax: 1 }) });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 45_000).progress; // 3 won combats, xp = 150

      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        combatXpGained: 100, // forged
      };

      expectError(() => resolveDeterministicExpedition(plan, forged, 15_000), "invalid_progress", "");
    });

    it("rejects if encounters won/lost/total is corrupted independently", () => {
      const plan = makePlan({ seed: "combat-reward-2", rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, enemyDamageMin: 1, enemyDamageMax: 1 }) });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 45_000).progress;

      // Corrupt won count
      const forgedWon: DeterministicExpeditionProgress = {
        ...resolved,
        encountersWon: resolved.encountersWon + 1,
      };
      expectError(() => resolveDeterministicExpedition(plan, forgedWon, 15_000), "invalid_progress", "");

      // Corrupt lost count
      const forgedLost: DeterministicExpeditionProgress = {
        ...resolved,
        encountersLost: resolved.encountersLost + 1,
      };
      expectError(() => resolveDeterministicExpedition(plan, forgedLost, 15_000), "invalid_progress", "");

      // Corrupt total encounters count
      const forgedTotal: DeterministicExpeditionProgress = {
        ...resolved,
        encounters: resolved.encounters + 1,
      };
      expectError(() => resolveDeterministicExpedition(plan, forgedTotal, 15_000), "invalid_progress", "");
    });
  });

  // E. TERMINAL AND PARTIAL CONSISTENCY
  describe("E. TERMINAL AND PARTIAL CONSISTENCY", () => {
    it("confirm corrupted terminal progress is rejected before terminal no-op handling", () => {
      const plan = makePlan({ seed: "terminal-consistency-1", rules: makeRules({ encounterChancePpm: 0 }) });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 120_000).progress; // terminal complete

      // Forge nextActionSequence on terminal progress
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        nextActionSequence: 99,
      };

      expectError(() => resolveDeterministicExpedition(plan, forged, 10_000), "invalid_progress", "");
    });

    it("verifies valid terminal progress remains a no-op for any non-negative elapsed", () => {
      const plan = makePlan({ seed: "terminal-consistency-2", rules: makeRules({ encounterChancePpm: 0 }) });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 120_000).progress; // terminal complete

      const result = resolveDeterministicExpedition(plan, resolved, 50_000);
      expect(result.progress).toEqual(resolved);
      expect(result.delta.elapsedAppliedMs).toBe(0);
    });
  });

  // F. EXACT FOOD/ACTION TERMINAL PRECEDENCE
  describe("F. EXACT FOOD/ACTION TERMINAL PRECEDENCE", () => {
    function resolveDeterministicExpeditionWithState(
      plan: DeterministicExpeditionPlan,
      startingState: DeterministicExpeditionStartingState,
      requestedElapsedMs: number,
    ): DeterministicExpeditionProgress {
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      return resolveDeterministicExpedition(plan, progress, requestedElapsedMs).progress;
    }

    it("exact priority test: surviving gather ending at food boundary with zero food results in food_exhausted", () => {
      const plan = makePlan({
        requestedDurationMs: 60_000,
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 30_000, gatheringWindowMs: 30_000 }),
      });
      // Start with 0 food. The gather completes at 30,000ms. Since it ends at a food boundary, the outcome is applied (1 gather, resources, etc.)
      // then food boundary is processed, and since food is 0, it stops with food_exhausted.
      const startingState = makeStartingState({ availableFood: 0 });
      const resolved = resolveDeterministicExpeditionWithState(plan, startingState, 60_000);

      expect(resolved.status).toBe("stopped");
      expect(resolved.stopReason).toBe("food_exhausted");
      expect(resolved.elapsedResolvedMs).toBe(30_000);
      expect(resolved.resourcesObtained).toBe(1); // earned gathering reward
      expect(resolved.foodConsumed).toBe(0); // no food was consumed, we stopped due to exhausted
    });

    it("exact priority test: inventory_full gather ending at food boundary with zero food results in inventory_full", () => {
      const plan = makePlan({
        requestedDurationMs: 60_000,
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 30_000, gatheringWindowMs: 30_000, inventorySlotLimit: 1 }),
      });
      // Start with 0 food, but inventory already full (1/1 slots used, stack not present).
      // At 30,000ms the gather completes. completeGathering check fails and returns "inventory_full".
      // This stops the expedition immediately, taking priority over food boundary.
      const startingState = makeStartingState({
        availableFood: 0,
        startingInventoryUsedSlots: 1,
        existingResourceStackPresent: false,
      });
      const resolved = resolveDeterministicExpeditionWithState(plan, startingState, 60_000);

      expect(resolved.status).toBe("stopped");
      expect(resolved.stopReason).toBe("inventory_full");
      expect(resolved.elapsedResolvedMs).toBe(30_000);
      expect(resolved.resourcesObtained).toBe(0);
      expect(resolved.foodConsumed).toBe(0);
    });

    it("exact priority test: surviving encounter ending at food boundary with zero food results in food_exhausted", () => {
      const plan = makePlan({
        requestedDurationMs: 60_000,
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 30_000, foodConsumptionIntervalMs: 30_000, enemyDamageMin: 10, enemyDamageMax: 10 }),
      });
      // Encounter completes at 30,000ms. Damage applied (10), health survives.
      // Food boundary processed next, food is 0 -> food_exhausted.
      const startingState = makeStartingState({ availableFood: 0, startingHealth: 100 });
      const resolved = resolveDeterministicExpeditionWithState(plan, startingState, 60_000);

      expect(resolved.status).toBe("stopped");
      expect(resolved.stopReason).toBe("food_exhausted");
      expect(resolved.elapsedResolvedMs).toBe(30_000);
      expect(resolved.encountersWon).toBe(1);
      expect(resolved.health).toBe(90);
      expect(resolved.foodConsumed).toBe(0);
    });

    it("exact priority test: losing encounter ending at food boundary with zero food results in health_critical", () => {
      const plan = makePlan({
        requestedDurationMs: 60_000,
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 30_000, foodConsumptionIntervalMs: 30_000, enemyDamageMin: 100, enemyDamageMax: 100, minimumHealthToContinue: 5 }),
      });
      // Encounter completes at 30,000ms. Health drops to 0. Stop reason is "health_critical", which takes precedence over food boundary.
      const startingState = makeStartingState({ availableFood: 0, startingHealth: 80 });
      const resolved = resolveDeterministicExpeditionWithState(plan, startingState, 60_000);

      expect(resolved.status).toBe("stopped");
      expect(resolved.stopReason).toBe("health_critical");
      expect(resolved.elapsedResolvedMs).toBe(30_000);
      expect(resolved.encountersLost).toBe(1);
      expect(resolved.health).toBe(0);
      expect(resolved.foodConsumed).toBe(0);
    });
  });

  // G. SAFE-INTEGER BOUNDARIES
  describe("G. SAFE-INTEGER BOUNDARIES", () => {
    it("handles huge requestedDurationMs gracefully near MAX_SAFE_INTEGER without precision loss", () => {
      const plan = makePlan({
        requestedDurationMs: Number.MAX_SAFE_INTEGER - 10,
        rules: makeRules({ encounterChancePpm: 0, gatheringWindowMs: 30_000 }),
      });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);

      // Verify a normal resolve inside bounds doesn't lose precision
      expect(() => resolveDeterministicExpedition(plan, progress, 30_000)).not.toThrow();
    });

    it("rejects requestedElapsedMs that would cause overflow or exceed requestedDurationMs", () => {
      const plan = makePlan({
        requestedDurationMs: 120_000,
        rules: makeRules({ encounterChancePpm: 0, gatheringWindowMs: 30_000 }),
      });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);

      // A huge requested elapsed should be safely rejected
      expectError(() => resolveDeterministicExpedition(plan, progress, Number.MAX_SAFE_INTEGER), "invalid_elapsed", "exceed requestedDurationMs");
    });
  });

  // H. SOURCE-PURITY CHECK
  describe("H. SOURCE-PURITY CHECK", () => {
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
        /\bfetch\b/,
        /XMLHttpRequest/,
      ];

      for (const filepath of filesToScan) {
        if (!fs.existsSync(filepath)) {
          throw new Error(`File not found: ${filepath}`);
        }
        const content = fs.readFileSync(filepath, "utf-8");
        // Remove single line and multi line comments to avoid false positives in documentation
        const strippedContent = content
          .replace(/\/\/.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "");

        for (const pattern of forbiddenPatterns) {
          expect(strippedContent).not.toMatch(pattern);
        }
      }
    });
  });

  // PHASE 4: EXPANDED GRANULAR PARTITION TESTING
  describe("PHASE 4: EXPANDED GRANULAR PARTITION TESTING", () => {
    function testPartitionEquivalence(
      plan: DeterministicExpeditionPlan,
      startingState: DeterministicExpeditionStartingState,
      totalElapsed: number,
      partitions: readonly number[]
    ) {
      // 1. One-shot resolution
      const initialOneShot = createDeterministicExpeditionProgress(plan, startingState);
      const oneShotRes = resolveDeterministicExpedition(plan, initialOneShot, totalElapsed);
      const oneShotProgress = oneShotRes.progress;

      // 2. Chunked resolution with JSON serialization/parsing between every single partition
      let chunkedProgress = createDeterministicExpeditionProgress(plan, startingState);
      let elapsedAppliedSum = 0;

      for (const chunk of partitions) {
        const serialized = JSON.stringify(chunkedProgress);
        const revived = JSON.parse(serialized) as DeterministicExpeditionProgress;

        const res = resolveDeterministicExpedition(plan, revived, chunk);
        chunkedProgress = res.progress;
        elapsedAppliedSum += res.delta.elapsedAppliedMs;
      }

      // 3. Assert deep equivalence of final progress
      expect(chunkedProgress).toEqual(oneShotProgress);

      // 4. Verify sum(delta.elapsedAppliedMs) matching rule
      const isTerminal = oneShotProgress.status !== "active";
      if (isTerminal) {
        expect(elapsedAppliedSum).toBe(oneShotProgress.elapsedResolvedMs);
      } else {
        expect(elapsedAppliedSum).toBe(totalElapsed);
      }
    }

    it("partitions every millisecond around gathering completion (at 30,000ms)", () => {
      const plan = makePlan({
        requestedDurationMs: 60_000,
        rules: makeRules({ encounterChancePpm: 0, gatheringWindowMs: 30_000 }),
      });
      const startingState = makeStartingState();

      // Test splits around 30,000ms
      const splits = [
        [29_998, 1, 1, 30_000],
        [29_999, 1, 30_000],
        [30_000, 30_000],
        [30_001, 29_999],
        [30_002, 29_998],
      ];

      for (const p of splits) {
        testPartitionEquivalence(plan, startingState, 60_000, p);
      }
    });

    it("partitions every millisecond around combat completion (at 15,000ms)", () => {
      const plan = makePlan({
        requestedDurationMs: 30_000,
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 15_000, enemyDamageMin: 1, enemyDamageMax: 1 }),
      });
      const startingState = makeStartingState();

      // Test splits around 15,000ms
      const splits = [
        [14_998, 1, 1, 15_000],
        [14_999, 1, 15_000],
        [15_000, 15_000],
        [15_001, 14_999],
        [15_002, 14_998],
      ];

      for (const p of splits) {
        testPartitionEquivalence(plan, startingState, 30_000, p);
      }
    });

    it("partitions every millisecond around food boundaries (at 10,000ms)", () => {
      const plan = makePlan({
        requestedDurationMs: 30_000,
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 10_000 }),
      });
      const startingState = makeStartingState();

      // Test splits around 10,000ms
      const splits = [
        [9_998, 1, 1, 20_000],
        [9_999, 1, 20_000],
        [10_000, 20_000],
        [10_001, 19_999],
        [10_002, 19_998],
      ];

      for (const p of splits) {
        testPartitionEquivalence(plan, startingState, 30_000, p);
      }
    });

    it("partitions around simultaneous action and food boundaries (at 30,000ms)", () => {
      const plan = makePlan({
        requestedDurationMs: 60_000,
        rules: makeRules({ encounterChancePpm: 0, gatheringWindowMs: 30_000, foodConsumptionIntervalMs: 30_000 }),
      });
      const startingState = makeStartingState();

      const splits = [
        [29_999, 1, 30_000],
        [30_000, 30_000],
        [30_001, 29_999],
      ];

      for (const p of splits) {
        testPartitionEquivalence(plan, startingState, 60_000, p);
      }
    });

    it("partitions around terminal action boundaries (food exhausted at 10,000ms)", () => {
      const plan = makePlan({
        requestedDurationMs: 30_000,
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 10_000 }),
      });
      const startingState = makeStartingState({ availableFood: 0 });

      // Stops at 10,000ms with food_exhausted
      const splits = [
        [9_999, 1, 20_000],
        [10_000, 20_000],
        [10_001, 19_999],
      ];

      for (const p of splits) {
        testPartitionEquivalence(plan, startingState, 30_000, p);
      }
    });

    it("partitions around short final plan windows (at 35,000ms)", () => {
      const plan = makePlan({
        requestedDurationMs: 35_000,
        rules: makeRules({ encounterChancePpm: 0, gatheringWindowMs: 30_000 }),
      });
      const startingState = makeStartingState();

      const splits = [
        [34_999, 1],
        [35_000],
      ];

      for (const p of splits) {
        testPartitionEquivalence(plan, startingState, 35_000, p);
      }
    });
  });
});
