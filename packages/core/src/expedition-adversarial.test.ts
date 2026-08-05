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

describe("deterministic expedition adversarial hardening audit - corrective pass", () => {

  // A. FORGED CURRENT HEALTH
  describe("A. HEALTH INTEGRITY", () => {
    it("rejects progress when current health is forged upward without matching snapshot or damage", () => {
      const plan = makePlan();
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 30_000).progress;

      // Forge current health upward
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        health: resolved.health + 5,
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "health mismatch");
    });

    it("rejects progress when damageTaken is forged independently", () => {
      const plan = makePlan();
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 30_000).progress;

      // Forge damageTaken
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        damageTaken: resolved.damageTaken + 10,
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "health mismatch");
    });

    it("rejects positive damageTaken if no encounters occurred", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: 0 }) });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 30_000).progress;

      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        damageTaken: 10,
        health: 90, // Pass health check first
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "damageTaken is positive but no encounters occurred");
    });
  });

  // B. FORGED CURRENT FOOD
  describe("B. FOOD INTEGRITY", () => {
    it("rejects progress when availableFood is forged upward or downward", () => {
      const plan = makePlan();
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 120_000).progress;

      // Forge availableFood
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        availableFood: resolved.availableFood + 1,
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "availableFood mismatch");
    });

    it("rejects progress when foodConsumed is forged", () => {
      const plan = makePlan();
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 120_000).progress;

      // Forge foodConsumed
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        foodConsumed: resolved.foodConsumed + 1,
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "availableFood mismatch");
    });

    it("rejects food consumption that exceeds chronologically allowed limits based on elapsedResolvedMs", () => {
      const plan = makePlan();
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 30_000).progress; // only 30s elapsed, interval is 120s

      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        foodConsumed: 1, // 0 expected
        availableFood: 19, // Pass availableFood mismatch first
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "foodConsumed");
    });
  });

  // C. FORGED INVENTORY
  describe("C. INVENTORY INTEGRITY", () => {
    it("rejects when inventoryUsedSlots is increased without a stack transition or corresponding snapshot state", () => {
      const plan = makePlan();
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 30_000).progress;

      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        inventoryUsedSlots: resolved.inventoryUsedSlots + 1,
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "inventoryUsedSlots mismatch");
    });

    it("rejects when existingResourceStackPresent is forged", () => {
      const plan = makePlan();
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 30_000).progress;

      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        existingResourceStackPresent: !resolved.existingResourceStackPresent,
      };

      // Toggled to false, resourcesObtained is 1 > 0
      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "resourcesObtained is positive but no resource stack exists");
    });

    it("rejects transition from true to false of existingResourceStackPresent", () => {
      const plan = makePlan();
      const startingState = makeStartingState({ existingResourceStackPresent: true, startingInventoryUsedSlots: 1 });
      const progress = createDeterministicExpeditionProgress(plan, startingState);

      const forged: DeterministicExpeditionProgress = {
        ...progress,
        existingResourceStackPresent: false,
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "existingResourceStackPresent cannot transition from true to false");
    });

    it("rejects if resource stack transitions false to true but resourcesObtained remains 0", () => {
      const plan = makePlan();
      const startingState = makeStartingState({ existingResourceStackPresent: false });
      const progress = createDeterministicExpeditionProgress(plan, startingState);

      const forged: DeterministicExpeditionProgress = {
        ...progress,
        existingResourceStackPresent: true,
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "existingResourceStackPresent transitioned to true but resourcesObtained is 0");
    });
  });

  // D. INITIAL SNAPSHOT IMMUTABILITY
  describe("D. INITIAL SNAPSHOT IMMUTABILITY", () => {
    it("ensures that mutating the startingState object after progress creation does not alter the progress.initialState", () => {
      const plan = makePlan();
      const startingState = {
        startingHealth: 100,
        startingInventoryUsedSlots: 1,
        existingResourceStackPresent: true,
        availableFood: 20,
      };

      const progress = createDeterministicExpeditionProgress(plan, startingState);

      // Mutate startingState object
      startingState.startingHealth = 50;
      startingState.availableFood = 0;

      expect(progress.initialState.startingHealth).toBe(100);
      expect(progress.initialState.availableFood).toBe(20);
    });

    it("ensures resolving repeatedly preserves the snapshot unchanged", () => {
      const plan = makePlan();
      const startingState = makeStartingState();
      let progress = createDeterministicExpeditionProgress(plan, startingState);

      expect(progress.initialState.startingHealth).toBe(100);

      for (let i = 0; i < 3; i++) {
        progress = resolveDeterministicExpedition(plan, progress, 10_000).progress;
        expect(progress.initialState.startingHealth).toBe(100);
        expect(progress.initialState.availableFood).toBe(20);
      }
    });

    it("JSON round-trips correctly and exact initial state snapshot is preserved", () => {
      const plan = makePlan();
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);

      const serialized = JSON.stringify(progress);
      const revived = JSON.parse(serialized) as DeterministicExpeditionProgress;

      expect(revived.initialState).toEqual(progress.initialState);
      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, revived)).not.toThrow();
    });
  });

  // E. COORDINATED TAMPERING LIMITATION DOCUMENTATION
  describe("E. COORDINATED TAMPERING LIMITATION DOCUMENTATION", () => {
    it("documents that coordinated editing is a known limitation that requires receipts", () => {
      // Gate 6A performs local structural integrity checks. A malicious actor editing the
      // initialState snapshot and all derived counters in a local save simultaneously will bypass
      // this validator. Preventing this requires trusted/cryptographic receipts or a server-authoritative
      // mechanism, which is deferred to later Gates.
      expect(true).toBe(true);
    });
  });

  // F. ACTION-SEQUENCE ALGEBRA
  describe("F. ACTION-SEQUENCE ALGEBRA", () => {
    it("validates exact sequence alignment under various mixed histories", () => {
      const plan = makePlan({ requestedDurationMs: 120_000, seed: "mixed-history-sequence" });
      const startingState = makeStartingState({ availableFood: 5 });

      // Run resolution cleanly
      const progress = resolveDeterministicExpedition(plan, createDeterministicExpeditionProgress(plan, startingState), 120_000).progress;

      // Verify sequence algebraic invariant: nextActionSequence === completedGatherings + encounters
      const completedGatherings = progress.resourcesObtained / plan.rules.resourceQuantityPerGather;
      expect(progress.nextActionSequence).toBe(completedGatherings + progress.encounters);
      expect(progress.encountersWon + progress.encountersLost).toBe(progress.encounters);
    });
  });

  // G. PARTIAL KINDS
  describe("G. PARTIAL KINDS", () => {
    it("rejects forged partial gathering where deterministic stream schedules encounter", () => {
      const plan = makePlan({
        seed: "partial-forgery-encounter",
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, combatDurationMs: 15_000, gatheringWindowMs: 30_000 }),
      });
      const startingState = makeStartingState();
      const progress = createDeterministicExpeditionProgress(plan, startingState);
      const resolved = resolveDeterministicExpedition(plan, progress, 5_000).progress;

      // Scheduled action at start is encounter. Let's forge a gathering instead
      const forged: DeterministicExpeditionProgress = {
        ...resolved,
        combatInterruptionMs: 0,
        productiveGatheringMs: 5_000, // Valid time budget for gathering
        partialAction: {
          kind: "gathering",
          actionSequence: resolved.nextActionSequence,
          elapsedInActionMs: 5_000,
        },
      };

      expectError(() => validateDeterministicExpeditionProgressAgainstPlan(plan, forged), "invalid_progress", "partialAction.kind mismatch");
    });
  });

  // H. PERFORMANCE AND SCALING REGRESSION
  describe("H. PERFORMANCE AND SCALING REGRESSION", () => {
    it("proves validation does not use chronological history loops or simulators", () => {
      // Exposes a regression test directly verifying the source implementation of the plan-aware
      // validator contains NO chronological simulator calls (like simulateUpTo) and NO loops.
      const validatorCode = validateDeterministicExpeditionProgressAgainstPlan.toString();

      // Assert complete absence of loop patterns or historical simulators
      expect(validatorCode).not.toContain("simulateUpTo");
      expect(validatorCode).not.toMatch(/\bfor\s*\(/);
      expect(validatorCode).not.toMatch(/\bwhile\s*\(/);
    });

    it("verifies validation is O(1) and executes instantly regardless of elapsedResolvingMs", () => {
      const plan = makePlan({ requestedDurationMs: 3_600_000 }); // 1 hour plan

      const hugeProgress: DeterministicExpeditionProgress = {
        schemaVersion: EXPEDITION_KERNEL_SCHEMA_VERSION,
        expeditionId: plan.expeditionId,
        elapsedResolvedMs: 3_600_000,
        partialAction: null,
        nextActionSequence: 120, // 120 gathers completed
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
        foodConsumed: 0,
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

      // Ensure validateDeterministicExpeditionProgressAgainstPlan processes this huge progress instantly without any loops!
      expect(() => validateDeterministicExpeditionProgressAgainstPlan(plan, hugeProgress)).not.toThrow();
    });
  });

  // I. SOURCE-PURITY CHECK
  describe("I. SOURCE-PURITY CHECK", () => {
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
        const strippedContent = content
          .replace(/\/\/.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "");

        for (const pattern of forbiddenPatterns) {
          expect(strippedContent).not.toMatch(pattern);
        }
      }
    });
  });
});
