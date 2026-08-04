import { describe, it, expect } from "vitest";
import { PROBABILITY_SCALE } from "./types";
import { DeterministicExpeditionError } from "./expedition-contract";
import {
  EXPEDITION_KERNEL_SCHEMA_VERSION,
  createDeterministicExpeditionProgress,
  resolveDeterministicExpedition,
  type DeterministicExpeditionDelta,
  type DeterministicExpeditionPlan,
  type DeterministicExpeditionProgress,
  type DeterministicExpeditionRules,
  type DeterministicExpeditionStartingState,
} from "./expedition-kernel";

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

function assertInvariants(
  plan: DeterministicExpeditionPlan,
  startingState: DeterministicExpeditionStartingState,
  progress: DeterministicExpeditionProgress,
): void {
  expect(progress.schemaVersion).toBe(EXPEDITION_KERNEL_SCHEMA_VERSION);
  expect(progress.expeditionId).toBe(plan.expeditionId);
  expect(progress.elapsedResolvedMs).toBeGreaterThanOrEqual(0);
  expect(progress.elapsedResolvedMs).toBeLessThanOrEqual(plan.requestedDurationMs);
  expect(progress.health).toBeGreaterThanOrEqual(0);
  expect(progress.availableFood).toBeGreaterThanOrEqual(0);
  expect(progress.foodConsumed + progress.availableFood).toBe(startingState.availableFood);
  expect(progress.encountersWon + progress.encountersLost).toBe(progress.encounters);
  expect(["active", "completed", "stopped"]).toContain(progress.status);
  if (progress.status === "completed") {
    expect(progress.elapsedResolvedMs).toBe(plan.requestedDurationMs);
    expect(progress.stopReason).toBe("duration_reached");
  }
  if (progress.status === "stopped") {
    expect(progress.stopReason).not.toBeNull();
  }
  if (progress.status === "active") {
    expect(progress.stopReason).toBeNull();
  }
}

function runOneShot(
  plan: DeterministicExpeditionPlan,
  startingState: DeterministicExpeditionStartingState,
  elapsedMs: number,
): DeterministicExpeditionProgress {
  const progress = createDeterministicExpeditionProgress(plan, startingState);
  return resolveDeterministicExpedition(plan, progress, elapsedMs).progress;
}

function runChunked(
  plan: DeterministicExpeditionPlan,
  startingState: DeterministicExpeditionStartingState,
  partitions: readonly number[],
): { progress: DeterministicExpeditionProgress; deltas: DeterministicExpeditionDelta[] } {
  let progress = createDeterministicExpeditionProgress(plan, startingState);
  const deltas: DeterministicExpeditionDelta[] = [];
  for (const chunk of partitions) {
    const resolution = resolveDeterministicExpedition(plan, progress, chunk);
    progress = resolution.progress;
    deltas.push(resolution.delta);
  }
  return { progress, deltas };
}

function sumDeltas(deltas: readonly DeterministicExpeditionDelta[]): DeterministicExpeditionDelta {
  const first = deltas[0];
  const last = deltas[deltas.length - 1];
  type Mutable<T> = { -readonly [K in keyof T]: T[K] };
  const sum: Mutable<DeterministicExpeditionDelta> = {
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
    startingHealth: first?.startingHealth ?? 0,
    endingHealth: last?.endingHealth ?? 0,
    statusBefore: first?.statusBefore ?? "active",
    statusAfter: last?.statusAfter ?? "active",
    stopReason: last?.stopReason ?? null,
  };
  for (const delta of deltas) {
    sum.elapsedAppliedMs += delta.elapsedAppliedMs;
    sum.resourcesObtained += delta.resourcesObtained;
    sum.resourceXpGained += delta.resourceXpGained;
    sum.combatXpGained += delta.combatXpGained;
    sum.encounters += delta.encounters;
    sum.encountersWon += delta.encountersWon;
    sum.encountersLost += delta.encountersLost;
    sum.damageTaken += delta.damageTaken;
    sum.foodConsumed += delta.foodConsumed;
    sum.productiveGatheringMs += delta.productiveGatheringMs;
    sum.combatInterruptionMs += delta.combatInterruptionMs;
  }
  return sum;
}

function splitIntoParts(total: number, parts: number): number[] {
  const result: number[] = [];
  let remaining = total;
  for (let i = 0; i < parts; i += 1) {
    if (i === parts - 1) {
      result.push(remaining);
    } else {
      const part = Math.floor(total / parts);
      result.push(part);
      remaining -= part;
    }
  }
  return result;
}

const SAWTOOTH_SIZES = [1, 999, 5_000, 13_000, 27_000, 2, 500, 4_000];

function sawtoothPartition(total: number): number[] {
  const result: number[] = [];
  let remaining = total;
  let i = 0;
  while (remaining > 0) {
    const size = Math.min(SAWTOOTH_SIZES[i % SAWTOOTH_SIZES.length]!, remaining);
    result.push(size);
    remaining -= size;
    i += 1;
  }
  return result;
}

function partitionPatterns(total: number): Record<string, number[]> {
  return {
    single: [total],
    halves: splitIntoParts(total, 2),
    quarters: splitIntoParts(total, 4),
    twelfths: splitIntoParts(total, 12),
    sawtooth: sawtoothPartition(total),
  };
}

describe("deterministic expedition kernel", () => {
  describe("progress creation", () => {
    it("creates a clean active progress from a plan and starting state", () => {
      const plan = makePlan();
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      expect(progress).toEqual({
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
      });
    });
  });

  describe("elapsed validation", () => {
    it("treats zero elapsed as a no-op", () => {
      const plan = makePlan();
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      const resolution = resolveDeterministicExpedition(plan, progress, 0);
      expect(resolution.progress).toBe(progress);
      expect(resolution.delta.elapsedAppliedMs).toBe(0);
      expect(resolution.delta.resourcesObtained).toBe(0);
      expect(resolution.delta.statusBefore).toBe("active");
      expect(resolution.delta.statusAfter).toBe("active");
      expect(resolution.delta.stopReason).toBeNull();
    });

    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      "rejects non-finite or negative elapsed %s",
      (elapsed) => {
        const plan = makePlan();
        const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
        expect(() => resolveDeterministicExpedition(plan, progress, elapsed)).toThrowError(
          DeterministicExpeditionError,
        );
        try {
          resolveDeterministicExpedition(plan, progress, elapsed);
        } catch (error) {
          expect((error as DeterministicExpeditionError).code).toBe("invalid_elapsed");
        }
      },
    );

    it("rejects elapsed that would exceed the requested duration", () => {
      const plan = makePlan({ requestedDurationMs: 120_000 });
      let progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      progress = resolveDeterministicExpedition(plan, progress, 90_000).progress;
      expect(() => resolveDeterministicExpedition(plan, progress, 40_000)).toThrowError(
        DeterministicExpeditionError,
      );
      try {
        resolveDeterministicExpedition(plan, progress, 40_000);
      } catch (error) {
        expect((error as DeterministicExpeditionError).code).toBe("invalid_elapsed");
      }
    });
  });

  describe("plan/progress consistency", () => {
    it("rejects a progress whose expeditionId differs from the plan", () => {
      const plan = makePlan();
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      const mismatched = { ...progress, expeditionId: "exp-other" };
      expect(() => resolveDeterministicExpedition(plan, mismatched, 1000)).toThrowError(
        DeterministicExpeditionError,
      );
      try {
        resolveDeterministicExpedition(plan, mismatched, 1000);
      } catch (error) {
        expect((error as DeterministicExpeditionError).code).toBe("plan_progress_mismatch");
      }
    });

    it("rejects a progress with a different schema version", () => {
      const plan = makePlan();
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      const mismatched = { ...progress, schemaVersion: 99 as never };
      expect(() => resolveDeterministicExpedition(plan, mismatched, 1000)).toThrowError(
        DeterministicExpeditionError,
      );
      try {
        resolveDeterministicExpedition(plan, mismatched, 1000);
      } catch (error) {
        // Validation rejects the foreign schema before any resolution happens.
        expect((error as DeterministicExpeditionError).code).toBe("invalid_progress");
      }
    });
  });

  describe("input immutability", () => {
    it("never mutates the plan or the progress input", () => {
      const plan = makePlan();
      const startingState = makeStartingState();
      Object.freeze(plan);
      Object.freeze(startingState);

      const progress = createDeterministicExpeditionProgress(plan, startingState);
      Object.freeze(progress);
      const progressSnapshot = JSON.stringify(progress);
      const planSnapshot = JSON.stringify(plan);

      const resolution = resolveDeterministicExpedition(plan, progress, 60_000);
      expect(JSON.stringify(progress)).toBe(progressSnapshot);
      expect(JSON.stringify(plan)).toBe(planSnapshot);
      expect(resolution.progress).not.toBe(progress);
    });

    it("returns fresh objects, never aliases the input progress when resolving", () => {
      const plan = makePlan();
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      const resolution = resolveDeterministicExpedition(plan, progress, 30_000);
      expect(resolution.progress).not.toBe(progress);
      expect(resolution.progress).not.toEqual(progress);
    });
  });

  describe("determinism", () => {
    it("produces byte-identical output for identical input", () => {
      const planA = makePlan({ seed: "repeatable" });
      const planB = makePlan({ seed: "repeatable" });
      const a = resolveDeterministicExpedition(planA, createDeterministicExpeditionProgress(planA, makeStartingState()), 90_000);
      const b = resolveDeterministicExpedition(planB, createDeterministicExpeditionProgress(planB, makeStartingState()), 90_000);
      expect(a.progress).toEqual(b.progress);
      expect(a.delta).toEqual(b.delta);
    });
  });

  describe("one-shot versus chunked equivalence", () => {
    it("resolves 120000ms identically across the required partition patterns", () => {
      const plan = makePlan({ requestedDurationMs: 120_000, seed: "equiv-seed" });
      const startingState = makeStartingState();
      const total = 120_000;

      const patterns: Record<string, number[]> = {
        oneShot: [total],
        quarterChunks: splitIntoParts(total, 4),
        dozenChunks: splitIntoParts(total, 12),
        exactRequirement: [1, 29_999, 15_000, 45_000, 30_000],
      };

      const reference = runOneShot(plan, startingState, total);
      assertInvariants(plan, startingState, reference);

      for (const [name, partitions] of Object.entries(patterns)) {
        const { progress, deltas } = runChunked(plan, startingState, partitions);
        expect(progress).toEqual(reference);
        expect(sumDeltas(deltas)).toEqual(
          resolveDeterministicExpedition(plan, createDeterministicExpeditionProgress(plan, startingState), total).delta,
        );
        assertInvariants(plan, startingState, progress);
        expect(name).toBeDefined();
      }
    });

    it("treats the offline catch-up path as the same resolver as the online chunked path", () => {
      const plan = makePlan({ requestedDurationMs: 300_000, seed: "offline-seed" });
      const startingState = makeStartingState();

      const offline = runOneShot(plan, startingState, 300_000);

      let online = createDeterministicExpeditionProgress(plan, startingState);
      const pauses = [5_000, 1_000, 42_000, 17_000, 90_000, 145_000];
      for (const pause of pauses) {
        online = resolveDeterministicExpedition(plan, online, pause).progress;
      }
      expect(online).toEqual(offline);
    });
  });

  describe("JSON resumability", () => {
    it("continues resolving after a serialize/parse cycle exactly like the uninterrupted path", () => {
      const plan = makePlan({ requestedDurationMs: 240_000, seed: "resume-seed" });
      const startingState = makeStartingState();

      const uninterrupted = runChunked(plan, startingState, splitIntoParts(240_000, 8)).progress;

      let progress = createDeterministicExpeditionProgress(plan, startingState);
      for (const chunk of splitIntoParts(240_000, 8)) {
        const serialized = JSON.stringify(progress);
        const revived = JSON.parse(serialized) as DeterministicExpeditionProgress;
        progress = resolveDeterministicExpedition(plan, revived, chunk).progress;
      }
      expect(progress).toEqual(uninterrupted);
    });
  });

  describe("inventory boundaries", () => {
    const gatheringOnly = { encounterChancePpm: 0 };

    it("stops with inventory_full before any invalid award when no stack fits", () => {
      const plan = makePlan({ rules: makeRules({ ...gatheringOnly, inventorySlotLimit: 1 }) });
      const startingState = makeStartingState({ startingInventoryUsedSlots: 1, existingResourceStackPresent: false });
      const progress = runOneShot(plan, startingState, 120_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("inventory_full");
      expect(progress.resourcesObtained).toBe(0);
      expect(progress.elapsedResolvedMs).toBe(0);
    });

    it("allows gathering into a free slot when the stack does not yet exist", () => {
      const plan = makePlan({ rules: makeRules({ ...gatheringOnly, inventorySlotLimit: 1 }) });
      const startingState = makeStartingState({ startingInventoryUsedSlots: 0, existingResourceStackPresent: false });
      const progress = runOneShot(plan, startingState, 120_000);

      expect(progress.status).toBe("completed");
      expect(progress.resourcesObtained).toBe(4);
    });

    it("does not consume a slot for an existing resource stack", () => {
      const plan = makePlan({ rules: makeRules({ ...gatheringOnly, inventorySlotLimit: 1 }) });
      const startingState = makeStartingState({ startingInventoryUsedSlots: 1, existingResourceStackPresent: true });
      const progress = runOneShot(plan, startingState, 120_000);

      expect(progress.status).toBe("completed");
      expect(progress.resourcesObtained).toBe(4);
    });
  });

  describe("food boundaries", () => {
    const gatheringOnly = { encounterChancePpm: 0 };

    it("consumes exactly one unit per cumulative 120000ms interval", () => {
      const plan = makePlan({ requestedDurationMs: 240_000, rules: makeRules(gatheringOnly) });
      const startingState = makeStartingState({ availableFood: 2 });
      const progress = runOneShot(plan, startingState, 240_000);

      expect(progress.status).toBe("completed");
      expect(progress.foodConsumed).toBe(2);
      expect(progress.availableFood).toBe(0);
    });

    it("stops with food_exhausted and never lets food go negative", () => {
      const plan = makePlan({ requestedDurationMs: 120_000, rules: makeRules(gatheringOnly) });
      const startingState = makeStartingState({ availableFood: 0 });
      const progress = runOneShot(plan, startingState, 120_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("food_exhausted");
      expect(progress.availableFood).toBe(0);
      expect(progress.foodConsumed + progress.availableFood).toBe(0);
    });
  });

  describe("health semantics", () => {
    it("stops with health_critical when health drops to or below minimumHealthToContinue", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, minimumHealthToContinue: 5 }) });
      const startingState = makeStartingState({ startingHealth: 20 });
      const progress = runOneShot(plan, startingState, 120_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("health_critical");
      expect(progress.health).toBeLessThanOrEqual(5);
      expect(progress.health).toBeGreaterThanOrEqual(0);
      expect(progress.elapsedResolvedMs).toBeLessThan(120_000);
      expect(progress.encounters).toBe(2);
      expect(progress.encountersWon + progress.encountersLost).toBe(2);
    });

    it("reports health_critical immediately when starting health is already critical", () => {
      const plan = makePlan();
      const startingState = makeStartingState({ startingHealth: 0 });
      const progress = runOneShot(plan, startingState, 30_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("health_critical");
      expect(progress.elapsedResolvedMs).toBe(0);
    });
  });

  describe("terminal no-op", () => {
    it("returns the terminal progress unchanged for further resolution", () => {
      const plan = makePlan();
      const progress = runOneShot(plan, makeStartingState(), 120_000);
      expect(progress.status).toBe("completed");

      const again = resolveDeterministicExpedition(plan, progress, 0);
      expect(again.progress).toBe(progress);
      expect(again.delta.elapsedAppliedMs).toBe(0);
      expect(again.delta.statusAfter).toBe("completed");
      expect(again.delta.stopReason).toBe("duration_reached");
    });

    it("rejects any positive elapsed beyond the requested duration on a terminal progress", () => {
      const plan = makePlan();
      const progress = runOneShot(plan, makeStartingState(), 120_000);
      expect(() => resolveDeterministicExpedition(plan, progress, 1)).toThrowError(
        DeterministicExpeditionError,
      );
    });
  });

  describe("property matrix: 10 seeds x 5 durations x 5 partition patterns", () => {
    const seeds = [
      "seed-a",
      "seed-b",
      "seed-c",
      "seed-d",
      "seed-e",
      "seed-f",
      "seed-g",
      "seed-h",
      "seed-i",
      "seed-j",
    ];
    const durations = [5_000, 30_000, 120_000, 600_000, 3_600_000];

    for (const seed of seeds) {
      for (const duration of durations) {
        it(`seed ${seed}, duration ${duration}: chunked equals one-shot and invariants hold`, () => {
          const plan = makePlan({ requestedDurationMs: duration, seed });
          const startingState = makeStartingState();
          const reference = runOneShot(plan, startingState, duration);
          assertInvariants(plan, startingState, reference);

          for (const [name, partitions] of Object.entries(partitionPatterns(duration))) {
            const { progress } = runChunked(plan, startingState, partitions);
            expect(progress).toEqual(reference);
            assertInvariants(plan, startingState, progress);
            expect(name).toBeDefined();
          }
        });
      }
    }
  });
});
