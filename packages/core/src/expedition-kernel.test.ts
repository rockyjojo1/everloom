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
  expect(progress.productiveGatheringMs + progress.combatInterruptionMs).toBe(progress.elapsedResolvedMs);
  expect(progress.health).toBeGreaterThanOrEqual(0);
  expect(progress.availableFood).toBeGreaterThanOrEqual(0);
  expect(progress.foodConsumed + progress.availableFood).toBe(startingState.availableFood);
  expect(progress.encountersWon + progress.encountersLost).toBe(progress.encounters);
  expect(progress.inventoryUsedSlots).toBeLessThanOrEqual(plan.rules.inventorySlotLimit);
  if (progress.resourcesObtained > 0) {
    expect(progress.existingResourceStackPresent).toBe(true);
  }
  if (progress.existingResourceStackPresent) {
    expect(progress.inventoryUsedSlots).toBeGreaterThanOrEqual(1);
  }
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
  if (progress.status === "completed" || progress.status === "stopped") {
    expect(progress.partialAction).toBeNull();
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

    it("rejects a starting state whose used slots exceed the slot limit", () => {
      const plan = makePlan();
      expect(() =>
        createDeterministicExpeditionProgress(
          plan,
          makeStartingState({ startingInventoryUsedSlots: plan.rules.inventorySlotLimit + 1 }),
        ),
      ).toThrowError(DeterministicExpeditionError);
    });

    it("rejects a starting state that claims a stack without occupying a slot", () => {
      const plan = makePlan();
      expect(() =>
        createDeterministicExpeditionProgress(plan, makeStartingState({ startingInventoryUsedSlots: 0, existingResourceStackPresent: true })),
      ).toThrowError(DeterministicExpeditionError);
    });
  });

  describe("elapsed validation and the time model", () => {
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

    it("counts partial time in elapsedResolvedMs and applies exactly the requested delta", () => {
      const plan = makePlan({ requestedDurationMs: 200_000, rules: makeRules({ encounterChancePpm: 0 }) });
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      const first = resolveDeterministicExpedition(plan, progress, 20_000);
      expect(first.delta.elapsedAppliedMs).toBe(20_000);
      expect(first.progress.elapsedResolvedMs).toBe(20_000);
      expect(first.progress.partialAction?.elapsedInActionMs).toBe(20_000);

      const second = resolveDeterministicExpedition(plan, first.progress, 100_000);
      expect(second.delta.elapsedAppliedMs).toBe(100_000);
      expect(second.progress.elapsedResolvedMs).toBe(120_000);
      expect(second.progress.status).toBe("active");
    });

    it("rejects a resume that would exceed the plan duration, counting partial time", () => {
      const plan = makePlan({ requestedDurationMs: 120_000, rules: makeRules({ encounterChancePpm: 0 }) });
      let progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      progress = resolveDeterministicExpedition(plan, progress, 20_000).progress;
      expect(() => resolveDeterministicExpedition(plan, progress, 101_000)).toThrowError(
        DeterministicExpeditionError,
      );
      try {
        resolveDeterministicExpedition(plan, progress, 101_000);
      } catch (error) {
        expect((error as DeterministicExpeditionError).code).toBe("invalid_elapsed");
      }
    });

    it("applies exactly the remaining partial time as the accepted delta", () => {
      const plan = makePlan({ requestedDurationMs: 120_000, rules: makeRules({ encounterChancePpm: 0 }) });
      let progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      progress = resolveDeterministicExpedition(plan, progress, 20_000).progress;
      const finished = resolveDeterministicExpedition(plan, progress, 10_000);
      expect(finished.delta.elapsedAppliedMs).toBe(10_000);
      expect(finished.progress.elapsedResolvedMs).toBe(30_000);
      expect(finished.progress.resourcesObtained).toBe(1);
      expect(finished.progress.partialAction).toBeNull();
    });

    it("persists a partial action only while mid-action", () => {
      const plan = makePlan({ requestedDurationMs: 120_000, rules: makeRules({ encounterChancePpm: 0 }) });
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      const mid = resolveDeterministicExpedition(plan, progress, 25_000).progress;
      expect(mid.status).toBe("active");
      expect(mid.partialAction).not.toBeNull();
      expect(mid.partialAction?.kind).toBe("gathering");
      expect(mid.partialAction?.actionSequence).toBe(0);
      expect(mid.partialAction?.elapsedInActionMs).toBe(25_000);

      const atEnd = resolveDeterministicExpedition(plan, mid, 5_000).progress;
      expect(atEnd.partialAction).toBeNull();
      expect(atEnd.elapsedResolvedMs).toBe(30_000);
      expect(atEnd.resourcesObtained).toBe(1);
    });

    it("never discards resolved elapsed across partial and food boundaries", () => {
      const plan = makePlan({
        requestedDurationMs: 240_000,
        seed: "no-discard",
        rules: makeRules({ encounterChancePpm: 150_000, foodConsumptionIntervalMs: 60_000 }),
      });
      const startingState = makeStartingState({ startingHealth: 500, availableFood: 4 });
      const reference = runOneShot(plan, startingState, 240_000);
      const partitions = splitIntoParts(240_000, 17);
      const { progress, deltas } = runChunked(plan, startingState, partitions);
      expect(progress).toEqual(reference);
      expect(progress.elapsedResolvedMs).toBe(240_000);
      expect(deltas.reduce((sum, d) => sum + d.elapsedAppliedMs, 0)).toBe(240_000);
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

    it("never mutates a progress carrying a partial action", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: 0 }) });
      let progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      progress = resolveDeterministicExpedition(plan, progress, 25_000).progress;
      expect(progress.partialAction).not.toBeNull();
      const snapshot = JSON.stringify(progress);
      Object.freeze(progress);

      const out = resolveDeterministicExpedition(plan, progress, 5_000);
      expect(JSON.stringify(progress)).toBe(snapshot);
      expect(out.progress).not.toBe(progress);
      expect(out.progress.resourcesObtained).toBe(1);
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

    it("round-trips a partial action through JSON and resumes identically", () => {
      const plan = makePlan({ requestedDurationMs: 240_000, seed: "resume-partial", rules: makeRules({ encounterChancePpm: 0 }) });
      const startingState = makeStartingState();

      let progress = createDeterministicExpeditionProgress(plan, startingState);
      progress = resolveDeterministicExpedition(plan, progress, 25_000).progress;
      expect(progress.partialAction).not.toBeNull();

      const revived = JSON.parse(JSON.stringify(progress)) as DeterministicExpeditionProgress;
      const after = resolveDeterministicExpedition(plan, revived, 5_000).progress;
      expect(after.resourcesObtained).toBe(1);
      expect(after.elapsedResolvedMs).toBe(30_000);
    });
  });

  describe("inventory and stack mutation", () => {
    const gatheringOnly = { encounterChancePpm: 0 };

    it("creates the resource stack on the first award and consumes exactly one slot", () => {
      const plan = makePlan({ rules: makeRules(gatheringOnly) });
      const startingState = makeStartingState({ startingInventoryUsedSlots: 17, existingResourceStackPresent: false });
      const progress = runOneShot(plan, startingState, 120_000);

      expect(progress.status).toBe("completed");
      expect(progress.inventoryUsedSlots).toBe(18);
      expect(progress.existingResourceStackPresent).toBe(true);
      expect(progress.resourcesObtained).toBe(4);
    });

    it("stops with inventory_full before any award when no stack fits and no slot is free", () => {
      const plan = makePlan({ rules: makeRules(gatheringOnly) });
      const startingState = makeStartingState({ startingInventoryUsedSlots: 18, existingResourceStackPresent: false });
      const progress = runOneShot(plan, startingState, 120_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("inventory_full");
      expect(progress.resourcesObtained).toBe(0);
      expect(progress.existingResourceStackPresent).toBe(false);
      expect(progress.inventoryUsedSlots).toBe(18);
      expect(progress.elapsedResolvedMs).toBe(30_000);
    });

    it("allows awards into an existing stack without consuming further slots", () => {
      const plan = makePlan({ rules: makeRules(gatheringOnly) });
      const startingState = makeStartingState({ startingInventoryUsedSlots: 18, existingResourceStackPresent: true });
      const progress = runOneShot(plan, startingState, 120_000);

      expect(progress.status).toBe("completed");
      expect(progress.inventoryUsedSlots).toBe(18);
      expect(progress.existingResourceStackPresent).toBe(true);
      expect(progress.resourcesObtained).toBe(4);
    });

    it("resolves the inventory path identically one-shot and chunked at every boundary", () => {
      const plan = makePlan({ requestedDurationMs: 120_000, seed: "inv-chunk", rules: makeRules(gatheringOnly) });
      const startingState = makeStartingState({ startingInventoryUsedSlots: 17, existingResourceStackPresent: false });
      const reference = runOneShot(plan, startingState, 120_000);

      for (const partitions of [splitIntoParts(120_000, 4), [9_999, 1, 20_000, 20_000, 30_000, 40_000]]) {
        const { progress } = runChunked(plan, startingState, partitions);
        expect(progress).toEqual(reference);
      }
    });
  });

  describe("encounter outcomes", () => {
    it("wins an encounter and awards combat XP when health survives above the threshold", () => {
      const plan = makePlan({
        requestedDurationMs: 15_000,
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, enemyDamageMin: 4, enemyDamageMax: 4 }),
      });
      const progress = runOneShot(plan, makeStartingState(), 15_000);

      expect(progress.status).toBe("completed");
      expect(progress.encounters).toBe(1);
      expect(progress.encountersWon).toBe(1);
      expect(progress.encountersLost).toBe(0);
      expect(progress.combatXpGained).toBe(50);
      expect(progress.health).toBe(96);
      expect(progress.combatInterruptionMs).toBe(15_000);
      expect(progress.elapsedResolvedMs).toBe(15_000);
    });

    it("loses an encounter (no XP) when health lands exactly on the minimum", () => {
      const rules = makeRules({ encounterChancePpm: PROBABILITY_SCALE, enemyDamageMin: 8, enemyDamageMax: 8 });
      const plan = makePlan({ requestedDurationMs: 15_000, rules });
      const startingState = makeStartingState({ startingHealth: 5 + rules.enemyDamageMin });
      const progress = runOneShot(plan, startingState, 15_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("health_critical");
      expect(progress.health).toBe(5);
      expect(progress.encounters).toBe(1);
      expect(progress.encountersWon).toBe(0);
      expect(progress.encountersLost).toBe(1);
      expect(progress.combatXpGained).toBe(0);
      expect(progress.elapsedResolvedMs).toBe(15_000);
    });

    it("loses an encounter when damage is lethal", () => {
      const rules = makeRules({ encounterChancePpm: PROBABILITY_SCALE, enemyDamageMin: 100, enemyDamageMax: 100 });
      const plan = makePlan({ requestedDurationMs: 15_000, rules });
      const progress = runOneShot(plan, makeStartingState({ startingHealth: 50 }), 15_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("health_critical");
      expect(progress.health).toBe(0);
      expect(progress.encounters).toBe(1);
      expect(progress.encountersWon).toBe(0);
      expect(progress.encountersLost).toBe(1);
      expect(progress.combatXpGained).toBe(0);
      expect(progress.damageTaken).toBe(100);
    });

    it("records a lost encounter in the delta with zero combat XP", () => {
      const rules = makeRules({ encounterChancePpm: PROBABILITY_SCALE, enemyDamageMin: 100, enemyDamageMax: 100 });
      const plan = makePlan({ requestedDurationMs: 15_000, rules });
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState({ startingHealth: 50 }));
      const { delta } = resolveDeterministicExpedition(plan, progress, 15_000);

      expect(delta.encounters).toBe(1);
      expect(delta.encountersWon).toBe(0);
      expect(delta.encountersLost).toBe(1);
      expect(delta.combatXpGained).toBe(0);
      expect(delta.damageTaken).toBe(100);
      expect(delta.startingHealth).toBe(50);
      expect(delta.endingHealth).toBe(0);
      expect(delta.statusBefore).toBe("active");
      expect(delta.statusAfter).toBe("stopped");
      expect(delta.stopReason).toBe("health_critical");
    });

    it("preserves progress earned before a losing encounter", () => {
      const plan = makePlan({
        requestedDurationMs: 120_000,
        seed: "probe-7",
        rules: makeRules({ encounterChancePpm: 150_000 }),
      });
      const progress = runOneShot(plan, makeStartingState({ startingHealth: 13 }), 120_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("health_critical");
      expect(progress.resourcesObtained).toBe(1);
      expect(progress.resourceXpGained).toBe(25);
      expect(progress.inventoryUsedSlots).toBe(1);
      expect(progress.existingResourceStackPresent).toBe(true);
      expect(progress.encounters).toBe(1);
      expect(progress.encountersWon).toBe(0);
      expect(progress.encountersLost).toBe(1);
      expect(progress.combatXpGained).toBe(0);
      expect(progress.elapsedResolvedMs).toBe(45_000);
    });

    it("resolves encounters identically one-shot and chunked", () => {
      const plan = makePlan({
        requestedDurationMs: 120_000,
        seed: "enc-chunk",
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, enemyDamageMin: 10, enemyDamageMax: 10 }),
      });
      const startingState = makeStartingState();
      const reference = runOneShot(plan, startingState, 120_000);

      for (const partitions of [splitIntoParts(120_000, 8), [7_500, 7_500, 15_000, 15_000, 30_000, 45_000], sawtoothPartition(120_000)]) {
        const { progress } = runChunked(plan, startingState, partitions);
        expect(progress).toEqual(reference);
      }
    });
  });

  describe("food: a cumulative clock across gathering, combat and partials", () => {
    it("stops with food_exhausted at a food boundary mid-gather", () => {
      const plan = makePlan({
        requestedDurationMs: 300_000,
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 95_000 }),
      });
      const progress = runOneShot(plan, makeStartingState({ availableFood: 0 }), 300_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("food_exhausted");
      expect(progress.elapsedResolvedMs).toBe(95_000);
      expect(progress.productiveGatheringMs).toBe(95_000);
      expect(progress.resourcesObtained).toBe(3);
      expect(progress.availableFood).toBe(0);
    });

    it("stops with food_exhausted at a food boundary mid-combat", () => {
      const plan = makePlan({
        requestedDurationMs: 240_000,
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, foodConsumptionIntervalMs: 100_000 }),
      });
      const progress = runOneShot(plan, makeStartingState({ availableFood: 0 }), 240_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("food_exhausted");
      expect(progress.elapsedResolvedMs).toBe(100_000);
      expect(progress.combatInterruptionMs).toBe(100_000);
      expect(progress.encounters).toBe(6);
      expect(progress.encountersWon).toBe(6);
      expect(progress.encountersLost).toBe(0);
    });

    it("consumes food at a mid-combat boundary and keeps fighting", () => {
      const plan = makePlan({
        requestedDurationMs: 240_000,
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, foodConsumptionIntervalMs: 100_000 }),
      });
      const progress = runOneShot(plan, makeStartingState({ availableFood: 2 }), 240_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("health_critical");
      expect(progress.foodConsumed).toBe(1);
      expect(progress.availableFood).toBe(1);
      expect(progress.elapsedResolvedMs).toBe(150_000);
      expect(progress.combatInterruptionMs).toBe(150_000);
    });

    it("commits a gathering outcome before consuming food when the action ends exactly on a boundary", () => {
      const plan = makePlan({
        requestedDurationMs: 120_000,
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 30_000 }),
      });
      const progress = runOneShot(plan, makeStartingState({ availableFood: 0 }), 120_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("food_exhausted");
      expect(progress.resourcesObtained).toBe(1);
      expect(progress.elapsedResolvedMs).toBe(30_000);
      expect(progress.productiveGatheringMs).toBe(30_000);
    });

    it("commits a combat outcome before consuming food when combat ends exactly on a boundary", () => {
      const plan = makePlan({
        requestedDurationMs: 240_000,
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, foodConsumptionIntervalMs: 120_000 }),
      });
      const progress = runOneShot(plan, makeStartingState({ availableFood: 0 }), 240_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("food_exhausted");
      expect(progress.encounters).toBe(8);
      expect(progress.encountersWon).toBe(8);
      expect(progress.encountersLost).toBe(0);
      expect(progress.elapsedResolvedMs).toBe(120_000);
      expect(progress.combatInterruptionMs).toBe(120_000);
    });

    it("consumes food exactly when a boundary is crossed inside a partial action", () => {
      const plan = makePlan({
        requestedDurationMs: 120_000,
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 10_000 }),
      });
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState({ availableFood: 2 }));

      const after5 = resolveDeterministicExpedition(plan, progress, 5_000).progress;
      expect(after5.foodConsumed).toBe(0);

      const after4999 = resolveDeterministicExpedition(plan, after5, 4_999).progress;
      expect(after4999.foodConsumed).toBe(0);
      expect(after4999.elapsedResolvedMs).toBe(9_999);

      const atBoundary = resolveDeterministicExpedition(plan, after4999, 1).progress;
      expect(atBoundary.foodConsumed).toBe(1);
      expect(atBoundary.elapsedResolvedMs).toBe(10_000);

      const pastBoundary = resolveDeterministicExpedition(plan, atBoundary, 1).progress;
      expect(pastBoundary.foodConsumed).toBe(1);
      expect(pastBoundary.elapsedResolvedMs).toBe(10_001);
    });

    it("stops exactly at a boundary crossed inside a partial action when food runs out", () => {
      const plan = makePlan({
        requestedDurationMs: 120_000,
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 10_000 }),
      });
      let progress = createDeterministicExpeditionProgress(plan, makeStartingState({ availableFood: 0 }));
      progress = resolveDeterministicExpedition(plan, progress, 5_000).progress;
      progress = resolveDeterministicExpedition(plan, progress, 4_999).progress;
      progress = resolveDeterministicExpedition(plan, progress, 1).progress;

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("food_exhausted");
      expect(progress.elapsedResolvedMs).toBe(10_000);
      expect(progress.productiveGatheringMs).toBe(10_000);
      expect(progress.availableFood).toBe(0);
    });

    it("does not consume food 1ms before a boundary but consumes exactly at it", () => {
      const plan = makePlan({
        requestedDurationMs: 120_000,
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 10_000 }),
      });
      let progress = createDeterministicExpeditionProgress(plan, makeStartingState({ availableFood: 2 }));
      progress = resolveDeterministicExpedition(plan, progress, 9_999).progress;
      expect(progress.foodConsumed).toBe(0);
      expect(progress.elapsedResolvedMs).toBe(9_999);

      progress = resolveDeterministicExpedition(plan, progress, 1).progress;
      expect(progress.foodConsumed).toBe(1);
      expect(progress.elapsedResolvedMs).toBe(10_000);

      progress = resolveDeterministicExpedition(plan, progress, 1).progress;
      expect(progress.foodConsumed).toBe(1);
    });

    it("consumes one unit per boundary over many boundaries", () => {
      const plan = makePlan({
        requestedDurationMs: 120_000,
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 10_000 }),
      });
      const progress = runOneShot(plan, makeStartingState({ availableFood: 12 }), 120_000);

      expect(progress.status).toBe("completed");
      expect(progress.foodConsumed).toBe(12);
      expect(progress.availableFood).toBe(0);
      expect(progress.resourcesObtained).toBe(4);
    });

    it("stops at the first food boundary when starting with no food", () => {
      const plan = makePlan({
        requestedDurationMs: 120_000,
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 10_000 }),
      });
      const progress = runOneShot(plan, makeStartingState({ availableFood: 0 }), 120_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("food_exhausted");
      expect(progress.elapsedResolvedMs).toBe(10_000);
      expect(progress.availableFood).toBe(0);
    });

    it("runs a single cumulative food clock across gathering and combat", () => {
      const plan = makePlan({
        requestedDurationMs: 240_000,
        seed: "food-cumul",
        rules: makeRules({ encounterChancePpm: 200_000, foodConsumptionIntervalMs: 30_000 }),
      });
      const startingState = makeStartingState({ startingHealth: 1_000, availableFood: 8 });
      const progress = runOneShot(plan, startingState, 240_000);

      assertInvariants(plan, startingState, progress);
      expect(progress.status).toBe("completed");
      expect(progress.foodConsumed).toBe(8);
    });

    it("resolves the food clock identically one-shot and chunked", () => {
      const plan = makePlan({
        requestedDurationMs: 120_000,
        seed: "food-chunk",
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 10_000 }),
      });
      const startingState = makeStartingState({ availableFood: 12 });
      const reference = runOneShot(plan, startingState, 120_000);

      for (const partitions of [splitIntoParts(120_000, 12), [9_999, 1, 9_999, 1, 9_999, 1, 9_999, 1, 9_999, 1, 9_999, 1, 9_999, 1, 9_999, 1, 9_999, 1, 9_999, 1, 9_999, 1, 9_999, 1], sawtoothPartition(120_000)]) {
        const { progress } = runChunked(plan, startingState, partitions);
        expect(progress).toEqual(reference);
      }
    });
  });

  describe("health semantics", () => {
    it("stops with health_critical when health drops to or below minimumHealthToContinue", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE }) });
      const startingState = makeStartingState({ startingHealth: 20 });
      const progress = runOneShot(plan, startingState, 120_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("health_critical");
      expect(progress.health).toBeLessThanOrEqual(5);
      expect(progress.health).toBeGreaterThanOrEqual(0);
      expect(progress.elapsedResolvedMs).toBeLessThan(120_000);
      expect(progress.encounters).toBe(2);
      expect(progress.encountersWon).toBe(1);
      expect(progress.encountersLost).toBe(1);
      expect(progress.encountersWon + progress.encountersLost).toBe(2);
    });

    it("reports health_critical immediately when starting health is already critical", () => {
      const plan = makePlan();
      const startingState = makeStartingState({ startingHealth: 0 });
      const progress = runOneShot(plan, startingState, 30_000);

      expect(progress.status).toBe("stopped");
      expect(progress.stopReason).toBe("health_critical");
      expect(progress.elapsedResolvedMs).toBe(0);
      expect(progress.partialAction).toBeNull();
    });
  });

  describe("terminal no-op", () => {
    it("returns a completed progress unchanged for any further non-negative elapsed", () => {
      const plan = makePlan();
      const progress = runOneShot(plan, makeStartingState(), 120_000);
      expect(progress.status).toBe("completed");

      const again = resolveDeterministicExpedition(plan, progress, 5_000);
      expect(again.progress).toBe(progress);
      expect(again.delta.elapsedAppliedMs).toBe(0);
      expect(again.delta.statusAfter).toBe("completed");
      expect(again.delta.stopReason).toBe("duration_reached");
    });

    it("returns a stopped progress unchanged even when the request would exceed the duration", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE }) });
      const progress = runOneShot(plan, makeStartingState({ startingHealth: 0 }), 120_000);
      expect(progress.status).toBe("stopped");

      const again = resolveDeterministicExpedition(plan, progress, 500_000);
      expect(again.progress).toBe(progress);
      expect(again.delta.elapsedAppliedMs).toBe(0);
      expect(again.delta.statusAfter).toBe("stopped");
    });

    it("still rejects negative elapsed on a terminal progress", () => {
      const plan = makePlan();
      const progress = runOneShot(plan, makeStartingState(), 120_000);
      expect(() => resolveDeterministicExpedition(plan, progress, -1)).toThrowError(
        DeterministicExpeditionError,
      );
    });
  });

  describe("plan-aware validation through resolve", () => {
    function expectInvalidProgress(plan: DeterministicExpeditionPlan, progress: DeterministicExpeditionProgress): void {
      expect(() => resolveDeterministicExpedition(plan, progress, 1_000)).toThrowError(
        DeterministicExpeditionError,
      );
      try {
        resolveDeterministicExpedition(plan, progress, 1_000);
      } catch (error) {
        expect((error as DeterministicExpeditionError).code).toBe("invalid_progress");
      }
    }

    it("rejects a progress whose elapsed exceeds the plan duration", () => {
      const plan = makePlan();
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      const corrupted = {
        ...progress,
        elapsedResolvedMs: plan.requestedDurationMs + 1,
        productiveGatheringMs: plan.requestedDurationMs + 1,
      };
      expectInvalidProgress(plan, corrupted);
    });

    it("rejects a terminal progress that carries a partial action", () => {
      const plan = makePlan();
      const progress = runOneShot(plan, makeStartingState(), 120_000);
      expect(progress.status).toBe("completed");
      const corrupted = { ...progress, partialAction: { kind: "gathering" as const, actionSequence: 4, elapsedInActionMs: 1_000 } };
      expectInvalidProgress(plan, corrupted);
    });

    it("rejects a partial action whose sequence does not match the next action sequence", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: 0 }) });
      let progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      progress = resolveDeterministicExpedition(plan, progress, 25_000).progress;
      const corrupted = { ...progress, partialAction: { ...progress.partialAction!, actionSequence: 1 } };
      expectInvalidProgress(plan, corrupted);
    });

    it.each([30_000, 0])("rejects a partial action outside the strict bounds (elapsedInActionMs=%s)", (bad) => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: 0 }) });
      let progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      progress = resolveDeterministicExpedition(plan, progress, 25_000).progress;
      const corrupted = { ...progress, partialAction: { ...progress.partialAction!, elapsedInActionMs: bad } };
      expectInvalidProgress(plan, corrupted);
    });

    it("rejects a partial action whose elapsed implies a negative action start", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: 0 }) });
      let progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      progress = resolveDeterministicExpedition(plan, progress, 25_000).progress;
      const corrupted = { ...progress, partialAction: { ...progress.partialAction!, elapsedInActionMs: 26_000 } };
      expectInvalidProgress(plan, corrupted);
    });

    it("rejects a progress whose used slots exceed the slot limit", () => {
      const plan = makePlan();
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      const corrupted = { ...progress, inventoryUsedSlots: plan.rules.inventorySlotLimit + 1 };
      expectInvalidProgress(plan, corrupted);
    });

    it("rejects a progress whose won/lost counters do not sum to encounters", () => {
      const plan = makePlan();
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      const corrupted = { ...progress, encounters: 1, encountersWon: 2, encountersLost: 0 };
      expectInvalidProgress(plan, corrupted);
    });

    it("rejects a completed progress whose elapsed does not equal the plan duration", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: 0 }) });
      const progress = runOneShot(plan, makeStartingState(), 120_000);
      expect(progress.status).toBe("completed");
      const corrupted = { ...progress, elapsedResolvedMs: 119_999, productiveGatheringMs: 119_999 };
      expectInvalidProgress(plan, corrupted);
    });

    it("rejects an active progress that has already reached the plan duration", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: 0 }) });
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      const corrupted = { ...progress, elapsedResolvedMs: 120_000, productiveGatheringMs: 120_000 };
      expectInvalidProgress(plan, corrupted);
    });

    it("rejects a progress whose productive and combat buckets do not sum to elapsed", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: 0 }) });
      let progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      progress = resolveDeterministicExpedition(plan, progress, 30_000).progress;
      const corrupted = { ...progress, productiveGatheringMs: 29_999 };
      expectInvalidProgress(plan, corrupted);
    });

    it("rejects a progress with resources but no resource stack", () => {
      const plan = makePlan();
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      const corrupted = { ...progress, resourcesObtained: 1 };
      expectInvalidProgress(plan, corrupted);
    });

    it("rejects a progress with a resource stack that occupies no slot", () => {
      const plan = makePlan();
      const progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      const corrupted = { ...progress, existingResourceStackPresent: true };
      expectInvalidProgress(plan, corrupted);
    });

    it("accepts a valid progress carrying a partial action", () => {
      const plan = makePlan({ rules: makeRules({ encounterChancePpm: 0 }) });
      let progress = createDeterministicExpeditionProgress(plan, makeStartingState());
      progress = resolveDeterministicExpedition(plan, progress, 25_000).progress;
      const out = resolveDeterministicExpedition(plan, progress, 5_000);
      expect(out.progress.resourcesObtained).toBe(1);
      expect(out.delta.elapsedAppliedMs).toBe(5_000);
    });
  });

  describe("irregular partitions", () => {
    const startingState = makeStartingState({ availableFood: 5 });
    const cases: Array<{
      name: string;
      duration: number;
      seed: string;
      rules: DeterministicExpeditionRules;
      partitions: number[];
    }> = [
      {
        name: "split inside a gathering",
        duration: 120_000,
        seed: "irr-gather",
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 60_000 }),
        partitions: [14_000, 16_000, 30_000, 60_000],
      },
      {
        name: "split inside an encounter",
        duration: 120_000,
        seed: "irr-encounter",
        rules: makeRules({ encounterChancePpm: PROBABILITY_SCALE, enemyDamageMin: 4, enemyDamageMax: 4, foodConsumptionIntervalMs: 60_000 }),
        partitions: [7_000, 8_000, 15_000, 30_000, 60_000],
      },
      {
        name: "exact food boundary",
        duration: 120_000,
        seed: "irr-boundary",
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 60_000 }),
        partitions: [60_000, 60_000],
      },
      {
        name: "1ms before a boundary",
        duration: 120_000,
        seed: "irr-before",
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 60_000 }),
        partitions: [59_999, 1, 60_000],
      },
      {
        name: "1ms after a boundary",
        duration: 120_000,
        seed: "irr-after",
        rules: makeRules({ encounterChancePpm: 0, foodConsumptionIntervalMs: 60_000 }),
        partitions: [60_001, 59_999],
      },
    ];

    for (const c of cases) {
      it(`${c.name}: chunked equals one-shot`, () => {
        const plan = makePlan({ requestedDurationMs: c.duration, seed: c.seed, rules: c.rules });
        const reference = runOneShot(plan, startingState, c.duration);
        const { progress } = runChunked(plan, startingState, c.partitions);
        expect(progress).toEqual(reference);
        assertInvariants(plan, startingState, progress);
      });
    }
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
