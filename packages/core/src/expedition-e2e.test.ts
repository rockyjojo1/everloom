import { describe, it, expect } from "vitest";
import {
  createNewSave,
  migrateSave,
  serializeSave,
  deserializeSave,
} from "./save";
import { startExpedition, resolveExpedition } from "./expedition";
import { forecastExpedition } from "./forecast";
import type { GameSave, ExpeditionResult } from "./types";

describe("Verdant Grove end-to-end and regression verification", () => {
  describe("Complete player journey", () => {
    it("discovers, forecasts, starts, completes, and claims rewards", () => {
      // Phase 1: Create new save (player discovers Verdant Grove)
      const save = createNewSave(0, "e2e-seed");
      expect(save.player.hp).toBe(24);
      expect(save.activeExpedition).toBeNull();

      // Phase 2: View forecast before commitment
      const forecast = forecastExpedition(save, 60000);
      expect(forecast.maxDurationMs).toBe(60000);
      expect(forecast.currentFoodSupply).toBe(0); // Should warn
      expect(forecast.warnings.some((w) => w.includes("No food"))).toBe(true);

      // Phase 3: Add food to inventory
      const withFood = {
        ...save,
        inventory: [{ itemId: "food-bread", quantity: 5 }],
      };
      const forecast2 = forecastExpedition(withFood, 60000);
      expect(forecast2.currentFoodSupply).toBe(5);
      expect(forecast2.warnings.length).toBe(0); // No warnings now

      // Phase 4: Start expedition
      const { state: active, expeditionId } = startExpedition(
        withFood,
        "verdant-grove",
        "ironbark-woodcutting",
        60000
      );
      expect(active.activeExpedition).not.toBeNull();
      expect(active.activeExpedition!.expeditionId).toBe(expeditionId);
      expect(active.activeExpedition!.requestedDurationMs).toBe(60000);

      // Phase 5: Resolve expedition (60 seconds = 2 gathering windows)
      const result = resolveExpedition(active, 60000);
      expect(result).not.toBeNull();
      expect(result!.result.elapsedMs).toBe(60000);
      expect(result!.result.resourcesObtained).toBeGreaterThanOrEqual(0);

      // Phase 6: Verify rewards applied
      const resultState = result!.state;
      expect(resultState.activeExpedition).toBeNull(); // Expedition cleared
      expect(resultState.claimedExpeditions[result!.claimId]).toBe(true);
      expect(resultState.skills.woodcutting.xp).toBeGreaterThan(
        withFood.skills.woodcutting.xp
      );

      // Phase 7: Verify idempotency (cannot claim twice)
      const noDouble = resolveExpedition(resultState, 60000);
      expect(noDouble).toBeNull(); // No active expedition

      // Phase 8: Simulate save/load cycle
      const serialized = serializeSave(resultState);
      const reloaded = JSON.parse(serialized) as GameSave;
      expect(reloaded.claimedExpeditions[result!.claimId]).toBe(true);
    });

    it("completes full flow with offline resumption", () => {
      let save = createNewSave(0, "offline-seed");
      save = {
        ...save,
        inventory: [{ itemId: "food-bread", quantity: 3 }],
      };

      // Start expedition
      const { state: active } = startExpedition(
        save,
        "loc",
        "act",
        60000
      );
      expect(active.activeExpedition).not.toBeNull();

      // Simulate offline save/load (e.g., player closed app after 30s)
      const afterFirstSession = serializeSave(active);
      const reloadedAfterCrash = JSON.parse(afterFirstSession) as GameSave;
      expect(reloadedAfterCrash.activeExpedition).not.toBeNull();
      expect(
        reloadedAfterCrash.activeExpedition!.expeditionSeed
      ).toBe(active.activeExpedition!.expeditionSeed);

      // Resume: resolve for remaining 30s
      const result = resolveExpedition(reloadedAfterCrash, 30000);
      expect(result).not.toBeNull();
      expect(result!.result.elapsedMs).toBe(30000);
      expect(result!.state.claimedExpeditions[result!.claimId]).toBe(true);
    });

    it("progression after multiple expeditions", () => {
      let save = createNewSave(0, "progression-seed");
      const startXp = save.skills.woodcutting.xp;

      // First expedition
      save = {
        ...save,
        inventory: [{ itemId: "food-bread", quantity: 10 }],
      };
      const { state: exp1 } = startExpedition(save, "loc", "act", 30000);
      const result1 = resolveExpedition(exp1, 30000);
      const firstXp = result1!.state.skills.woodcutting.xp;
      expect(firstXp).toBeGreaterThan(startXp);
      save = result1!.state;

      // Second expedition on same save (should stack XP)
      const { state: exp2 } = startExpedition(save, "loc", "act", 30000);
      const result2 = resolveExpedition(exp2, 30000);
      const secondXp = result2!.state.skills.woodcutting.xp;
      expect(secondXp).toBeGreaterThanOrEqual(firstXp);

      // Both expedition claims should exist
      expect(result2!.state.claimedExpeditions[result1!.claimId]).toBe(true);
      expect(result2!.state.claimedExpeditions[result2!.claimId]).toBe(true);
    });
  });

  describe("Regression: save migration compatibility", () => {
    it("old saves still work after format upgrade", () => {
      // Simulate a v5 save from before expedition system
      const v5Save: any = {
        saveVersion: 5,
        player: { id: "legacy", name: "VeteranPlayer", appearanceId: "meadow", hp: 24, maxHp: 24 },
        position: { x: 10, z: 10, facingX: 0, facingZ: 1 },
        currentZone: "meadowrest",
        inventory: [
          { itemId: "food-bread", quantity: 20 },
          { itemId: "log-oak", quantity: 30 },
        ],
        inventorySlots: 32,
        equipment: { tool: "hatchet-bronze", weapon: null, body: null },
        skills: {
          woodcutting: { xp: 50000 },
          mining: { xp: 10000 },
          fishing: { xp: 0 },
          cooking: { xp: 5000 },
          smithing: { xp: 20000 },
          melee: { xp: 25000 },
        },
        mastery: { "hatchet-bronze": { xp: 5000 } },
        quests: { tutorial_complete: { status: "complete", stepIndex: 0, stepProgress: 0 } },
        worldFlags: { tutorial_complete: true, first_login: false },
        worldResources: {},
        worldEnemies: {},
        collections: ["item-rare-1", "item-rare-2"],
        currentActivity: null,
        activitySequence: 0,
        rngSeed: "legacy-seed",
        simulationTimeMs: 500000,
        lastSavedAt: 500000,
        lastActiveAt: 500000,
        settings: { quality: "high", musicVolume: 0.8, effectsVolume: 0.9, reducedMotion: false },
      };

      // Migrate to v6
      const upgraded = migrateSave(v5Save);
      expect(upgraded.saveVersion).toBe(6);
      expect(upgraded.player.name).toBe("VeteranPlayer");
      expect(upgraded.inventory).toHaveLength(2);
      expect(upgraded.skills.woodcutting.xp).toBe(50000);
      expect(upgraded.activeExpedition).toBeNull();
      expect(upgraded.claimedExpeditions).toEqual({});

      // Can now start new expedition on upgraded save
      const forecast = forecastExpedition(upgraded, 30000);
      expect(forecast.currentFoodSupply).toBe(20);
      expect(forecast.warnings.length).toBe(0);

      const { state: active } = startExpedition(
        upgraded,
        "verdant-grove",
        "ironbark-woodcutting",
        30000
      );
      expect(active.activeExpedition).not.toBeNull();

      // Rewards should add to existing XP
      const result = resolveExpedition(active, 30000);
      expect(result!.state.skills.woodcutting.xp).toBeGreaterThan(50000);
    });
  });

  describe("Regression: state preservation across game operations", () => {
    it("expedition state not corrupted by other game activities", () => {
      let save = createNewSave(0, "state-test-seed");
      save = { ...save, inventory: [{ itemId: "food-bread", quantity: 5 }] };

      // Start expedition
      const { state: active1 } = startExpedition(save, "loc", "act", 60000);
      expect(active1.activeExpedition).not.toBeNull();
      const activeExp = active1.activeExpedition!;

      // Simulate time passing (game loop ticks)
      const afterTick1 = { ...active1, simulationTimeMs: active1.simulationTimeMs + 1000 };
      expect(afterTick1.activeExpedition!.expeditionSeed).toBe(activeExp.expeditionSeed);
      expect(afterTick1.activeExpedition!.expeditionId).toBe(activeExp.expeditionId);

      // Simulate inventory changes (player picking something up)
      const afterPickup = {
        ...afterTick1,
        inventory: [...afterTick1.inventory, { itemId: "item-random", quantity: 1 }],
      };
      expect(afterPickup.activeExpedition).toEqual(activeExp);

      // Resolve with modified state
      const result = resolveExpedition(afterPickup, 30000); // Only 30s elapsed
      expect(result!.result.elapsedMs).toBe(30000);
    });

    it("forecast does not affect subsequent operations", () => {
      let save = createNewSave(0, "forecast-test-seed");
      save = { ...save, inventory: [{ itemId: "food-bread", quantity: 10 }] };
      const initialXp = save.skills.woodcutting.xp;

      // Generate multiple forecasts
      const f1 = forecastExpedition(save, 30000);
      const f2 = forecastExpedition(save, 60000);
      const f3 = forecastExpedition(save, 120000);

      // Save should be unmodified
      expect(save.skills.woodcutting.xp).toBe(initialXp);
      expect(save.activeExpedition).toBeNull();

      // Should still be able to start expedition
      const { state: active } = startExpedition(save, "loc", "act", 60000);
      expect(active.activeExpedition).not.toBeNull();

      // Resolution should use initial save, not forecasts
      const result = resolveExpedition(active, 60000);
      expect(result!.state.skills.woodcutting.xp).toBeGreaterThanOrEqual(initialXp);
    });
  });

  describe("Regression: claim ID stability", () => {
    it("different expeditions have different claim IDs", () => {
      let save = createNewSave(0, "claim-test-seed");
      save = { ...save, inventory: [{ itemId: "food-bread", quantity: 10 }] };

      const { state: exp1 } = startExpedition(save, "loc1", "act1", 10000);
      const result1 = resolveExpedition(exp1, 10000);

      const { state: exp2 } = startExpedition(result1!.state, "loc2", "act2", 10000);
      const result2 = resolveExpedition(exp2, 10000);

      expect(result1!.claimId).not.toBe(result2!.claimId);
      expect(result1!.claimId).toMatch(/^claim-/);
      expect(result2!.claimId).toMatch(/^claim-/);
    });

    it("cannot double-claim by manipulating state", () => {
      const save = createNewSave(0, "double-claim-test");
      const { state: active } = startExpedition(save, "loc", "act", 10000);
      const result = resolveExpedition(active, 10000);

      expect(result).not.toBeNull();
      const claimId = result!.claimId;

      // Manually add duplicate claim
      const manipulated = {
        ...result!.state,
        claimedExpeditions: {
          ...result!.state.claimedExpeditions,
          [claimId]: true, // Already true, this is idempotent
        },
      };

      // Trying to resolve on manipulated state (no active expedition) returns null
      const noDouble = resolveExpedition(manipulated, 10000);
      expect(noDouble).toBeNull();

      // Claim is still tracked
      expect(manipulated.claimedExpeditions[claimId]).toBe(true);
    });
  });

  describe("Regression: edge cases and boundaries", () => {
    it("survives many expeditions in sequence", () => {
      let save = createNewSave(0, "stress-test-seed");
      save = { ...save, inventory: [{ itemId: "food-bread", quantity: 100 }] };

      const claims: string[] = [];

      for (let i = 0; i < 10; i++) {
        const { state: active } = startExpedition(save, `loc-${i}`, "act", 5000);
        expect(active.activeExpedition).not.toBeNull();

        const result = resolveExpedition(active, 5000);
        expect(result).not.toBeNull();
        claims.push(result!.claimId);

        save = result!.state;
      }

      // All claims should be distinct and tracked
      const uniqueClaims = new Set(claims);
      expect(uniqueClaims.size).toBe(10);
      expect(Object.keys(save.claimedExpeditions)).toHaveLength(10);
    });

    it("handles maximum and minimum duration bounds", () => {
      const save = createNewSave(0, "bounds-test-seed");

      // Too short (should clamp up to 5000ms)
      const { state: tooShort } = startExpedition(save, "loc", "act", 100);
      expect(tooShort.activeExpedition!.requestedDurationMs).toBeGreaterThanOrEqual(5000);

      // Too long (should clamp down to 3600000ms)
      const { state: tooLong } = startExpedition(save, "loc", "act", 10000000);
      expect(tooLong.activeExpedition!.requestedDurationMs).toBeLessThanOrEqual(3600000);

      // Just right
      const { state: perfect } = startExpedition(save, "loc", "act", 600000);
      expect(perfect.activeExpedition!.requestedDurationMs).toBe(600000);
    });

    it("handles zero-damage scenarios (no encounters)", () => {
      // Very short expedition might not have any encounters
      let save = createNewSave(0, "no-damage-seed");
      save = { ...save, inventory: [{ itemId: "food-bread", quantity: 1 }] };

      const { state: active } = startExpedition(save, "loc", "act", 5000);
      const result = resolveExpedition(active, 5000);

      // Either no encounters or minimal damage
      expect(result!.result.damagePlayerTaken).toBeGreaterThanOrEqual(0);
      expect(result!.state.player.hp).toBeGreaterThanOrEqual(0);
    });

    it("handles maximum food consumption", () => {
      let save = createNewSave(0, "max-food-seed");
      save = {
        ...save,
        inventory: [{ itemId: "food-bread", quantity: 1 }], // Just 1 food
      };

      const { state: active } = startExpedition(save, "loc", "act", 300000); // 5 minutes
      const result = resolveExpedition(active, 300000);

      // Should stop due to food exhaustion
      expect(result!.result.stopReason).toBe("food_exhausted");
      expect(result!.result.elapsedMs).toBeLessThan(300000);
    });
  });
});
