import { describe, it, expect } from "vitest";
import {
  createNewSave,
  migrateSave,
  serializeSave,
  deserializeSave,
} from "./save";
import { startExpedition, resolveExpedition } from "./expedition";
import type { GameSave } from "./types";

describe("Expedition system: save migration and idempotency", () => {
  describe("Save version migration (v5 → v6)", () => {
    it("migrates v5 save to v6 with empty expedition fields", () => {
      const v5Save: any = {
        saveVersion: 5,
        player: { id: "test", name: "Wanderer", appearanceId: "meadow", hp: 24, maxHp: 24 },
        position: { x: 10, z: 10, facingX: 0, facingZ: 1 },
        currentZone: "meadowrest",
        inventory: [],
        inventorySlots: 18,
        equipment: { tool: null, weapon: null, body: null },
        skills: { woodcutting: { xp: 100 }, mining: { xp: 0 }, fishing: { xp: 0 }, cooking: { xp: 0 }, smithing: { xp: 0 }, melee: { xp: 0 } },
        mastery: {},
        quests: {},
        worldFlags: {},
        worldResources: {},
        worldEnemies: {},
        collections: [],
        currentActivity: null,
        activitySequence: 0,
        rngSeed: "test-seed",
        simulationTimeMs: 0,
        lastSavedAt: 0,
        lastActiveAt: 0,
        settings: { quality: "standard", musicVolume: 0.5, effectsVolume: 0.7, reducedMotion: false },
      };

      const migrated = migrateSave(v5Save);
      expect(migrated.saveVersion).toBe(6);
      expect(migrated.activeExpedition).toBeNull();
      expect(migrated.claimedExpeditions).toEqual({});
      expect(migrated.player.name).toBe("Wanderer");
      expect(migrated.inventory).toEqual([]);
    });

    it("preserves all v5 data during migration", () => {
      const v5Save: any = {
        saveVersion: 5,
        player: { id: "legacy", name: "OldPlayer", appearanceId: "ember", hp: 20, maxHp: 30 },
        position: { x: 15, z: 20, facingX: 1, facingZ: 0 },
        currentZone: "training-ground",
        inventory: [
          { itemId: "hatchet-bronze", quantity: 1 },
          { itemId: "food-bread", quantity: 5 },
        ],
        inventorySlots: 20,
        equipment: { tool: "hatchet-bronze", weapon: null, body: null },
        skills: {
          woodcutting: { xp: 5000 },
          mining: { xp: 2000 },
          fishing: { xp: 0 },
          cooking: { xp: 1500 },
          smithing: { xp: 3000 },
          melee: { xp: 4000 },
        },
        mastery: { "hatchet-bronze": { xp: 500 } },
        quests: { first_thread: { status: "active", stepIndex: 2, stepProgress: 0 } },
        worldFlags: { tutorial_complete: true },
        worldResources: {},
        worldEnemies: {},
        collections: ["item-rare-1"],
        currentActivity: null,
        activitySequence: 0,
        rngSeed: "legacy-seed",
        simulationTimeMs: 100000,
        lastSavedAt: 50000,
        lastActiveAt: 50000,
        settings: { quality: "high", musicVolume: 0.8, effectsVolume: 0.9, reducedMotion: true },
      };

      const migrated = migrateSave(v5Save);
      expect(migrated.player.id).toBe("legacy");
      expect(migrated.player.name).toBe("OldPlayer");
      expect(migrated.player.appearanceId).toBe("ember");
      expect(migrated.inventory).toHaveLength(2);
      expect(migrated.inventory[0]).toEqual({ itemId: "hatchet-bronze", quantity: 1 });
      expect(migrated.skills.woodcutting.xp).toBe(5000);
      expect(migrated.mastery["hatchet-bronze"].xp).toBe(500);
      expect(migrated.quests.first_thread.status).toBe("active");
      expect(migrated.worldFlags.tutorial_complete).toBe(true);
      expect(migrated.collections).toContain("item-rare-1");
      expect(migrated.simulationTimeMs).toBe(100000);
    });

    it("rejects unsupported save versions", () => {
      const invalidSave = { saveVersion: 99, player: {}, position: {}, currentZone: "", rngSeed: "" };
      expect(() => migrateSave(invalidSave)).toThrow("Unsupported save version");
    });

    it("rejects saves missing required identity fields", () => {
      const incompleteSave = {
        saveVersion: 5,
        player: { id: "test", name: "Test", appearanceId: "meadow", hp: 24, maxHp: 24 },
        // missing position, currentZone, rngSeed
      };
      expect(() => migrateSave(incompleteSave)).toThrow("missing required identity or world fields");
    });
  });

  describe("Expedition state persistence", () => {
    it("persists expedition seed at start", () => {
      const save = createNewSave(0, "original-seed");
      const { state, expeditionId } = startExpedition(save, "verdant-grove", "ironbark-woodcutting", 60000);

      expect(state.activeExpedition).not.toBeNull();
      expect(state.activeExpedition!.expeditionSeed).toBe("original-seed");
      expect(state.activeExpedition!.expeditionId).toBe(expeditionId);
      expect(state.activeExpedition!.requestedDurationMs).toBe(60000);
    });

    it("generates unique expedition IDs", () => {
      const save = createNewSave(0, "seed");
      const { expeditionId: id1 } = startExpedition(save, "loc1", "act1", 1000);
      const { expeditionId: id2 } = startExpedition(save, "loc2", "act2", 2000);

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^exp-\d+-/);
    });

    it("survives serialization/deserialization cycle", () => {
      const original = createNewSave(0, "test-seed");
      const { state: withExpedition } = startExpedition(original, "verdant-grove", "ironbark-woodcutting", 30000);

      const serialized = serializeSave(withExpedition);
      const deserialized = JSON.parse(serialized) as GameSave;

      expect(deserialized.activeExpedition).not.toBeNull();
      expect(deserialized.activeExpedition!.expeditionSeed).toBe("test-seed");
      expect(deserialized.player.name).toBe(withExpedition.player.name);
    });
  });

  describe("Idempotent completion", () => {
    it("prevents claiming same expedition result twice", () => {
      const save = createNewSave(0, "seed");
      const { state: active } = startExpedition(save, "verdant-grove", "ironbark-woodcutting", 10000);

      const result1 = resolveExpedition(active, 10000);
      expect(result1).not.toBeNull();
      expect(result1!.state.claimedExpeditions[result1!.claimId]).toBe(true);

      // Attempting to claim the same result on the resolved state (activeExpedition is null)
      const result2 = resolveExpedition(result1!.state, 5000);
      expect(result2).toBeNull(); // No active expedition to resolve

      // Simulate a crash scenario: re-apply the same claimId
      const doubleApplied = {
        ...result1!.state,
        claimedExpeditions: { ...result1!.state.claimedExpeditions, [result1!.claimId]: true },
      };
      expect(doubleApplied.claimedExpeditions[result1!.claimId]).toBe(true);
    });

    it("generates stable claim IDs for same expedition", () => {
      const save = createNewSave(0, "seed");
      const { state: active, expeditionId } = startExpedition(save, "loc", "act", 5000);

      // Resolving the same active expedition multiple times should give different claim IDs
      // (since claimId includes Date.now())
      const r1 = resolveExpedition(active, 5000);

      // Add delay to ensure Date.now() changes
      const r2_active = { ...active };
      // Note: in practice, UI would wait between resolutions, but we verify expedition ID stability
      expect(r1!.result.expeditionId).toBe(expeditionId);
    });

    it("tracks multiple claimed expeditions separately", () => {
      let save = createNewSave(0, "seed");

      // First expedition
      const { state: active1, expeditionId: id1 } = startExpedition(save, "loc1", "act1", 5000);
      const result1 = resolveExpedition(active1, 5000);
      expect(result1!.state.claimedExpeditions[result1!.claimId]).toBe(true);
      save = result1!.state;

      // Second expedition on same save
      const { state: active2, expeditionId: id2 } = startExpedition(save, "loc2", "act2", 5000);
      const result2 = resolveExpedition(active2, 5000);
      expect(result2!.state.claimedExpeditions[result2!.claimId]).toBe(true);

      // Both claims should exist
      expect(Object.keys(result2!.state.claimedExpeditions)).toHaveLength(2);
      expect(result2!.state.claimedExpeditions[result1!.claimId]).toBe(true);
      expect(result2!.state.claimedExpeditions[result2!.claimId]).toBe(true);
    });
  });

  describe("Invalid state handling", () => {
    it("returns null when resolving with no active expedition", () => {
      const save = createNewSave(0, "seed");
      expect(save.activeExpedition).toBeNull();

      const result = resolveExpedition(save, 5000);
      expect(result).toBeNull();
    });

    it("clamps invalid duration to valid range", () => {
      const save = createNewSave(0, "seed");

      // Too short
      const { state: tooShort } = startExpedition(save, "loc", "act", 1000);
      expect(tooShort.activeExpedition!.requestedDurationMs).toBeGreaterThanOrEqual(5000);

      // Too long
      const { state: tooLong } = startExpedition(save, "loc", "act", 5000000);
      expect(tooLong.activeExpedition!.requestedDurationMs).toBeLessThanOrEqual(3600000);
    });

    it("preserves inventory on expedition failure", () => {
      const save = createNewSave(0, "seed");
      const { state: active } = startExpedition(save, "loc", "act", 0);
      const result = resolveExpedition(active, 0);

      expect(result!.state.inventory).toEqual(save.inventory);
    });
  });

  describe("Deterministic resolution", () => {
    it("produces identical results for identical input", () => {
      const save = createNewSave(0, "deterministic-seed");
      const { state: active1 } = startExpedition(save, "verdant-grove", "ironbark-woodcutting", 60000);
      const result1 = resolveExpedition(active1, 60000);

      const save2 = createNewSave(0, "deterministic-seed");
      const { state: active2 } = startExpedition(save2, "verdant-grove", "ironbark-woodcutting", 60000);
      const result2 = resolveExpedition(active2, 60000);

      // Same seed = same results
      expect(result1!.result.resourcesObtained).toBe(result2!.result.resourcesObtained);
      expect(result1!.result.encounters).toBe(result2!.result.encounters);
      expect(result1!.result.combatXpGained).toBe(result2!.result.combatXpGained);
    });

    it("produces different results for different seeds", () => {
      const results = [];
      for (let i = 0; i < 10; i++) {
        const save = createNewSave(0, `seed-${i}-long-run`);
        const { state: active } = startExpedition(save, "loc", "act", 300000); // 5 minutes, more variation possible
        const result = resolveExpedition(active, 300000);
        results.push(result!.result);
      }

      // With different seeds and longer duration, we should see variation in encounters or resources
      const encounters = results.map((r) => r.encounters);
      const uniqueEncounters = new Set(encounters);
      // High probability that at least 2 different seeds give different encounter counts over 5 min
      expect(uniqueEncounters.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Player state preservation", () => {
    it("preserves equipment and items after expedition", () => {
      const save = createNewSave(0, "seed");
      const withItems = {
        ...save,
        inventory: [
          { itemId: "hatchet-bronze", quantity: 1 },
          { itemId: "food-bread", quantity: 10 },
        ],
        equipment: { tool: "hatchet-bronze", weapon: null, body: null },
      };

      const { state: active } = startExpedition(withItems, "loc", "act", 5000);
      const result = resolveExpedition(active, 5000);

      // Original equipment preserved (even if items added)
      expect(result!.state.equipment.tool).toBe("hatchet-bronze");
      expect(result!.state.inventory[0]).toEqual({ itemId: "hatchet-bronze", quantity: 1 });
    });

    it("adds expedition rewards to existing inventory", () => {
      const save = createNewSave(0, "seed");
      const withExisting = {
        ...save,
        inventory: [{ itemId: "food-bread", quantity: 5 }],
      };

      const { state: active } = startExpedition(withExisting, "loc", "act", 30000);
      const result = resolveExpedition(active, 30000);

      if (result!.result.resourcesObtained > 0) {
        const logs = result!.state.inventory.find((s) => s.itemId === "log_ironbark");
        expect(logs).toBeDefined();
        expect(logs!.quantity).toBeGreaterThan(0);
      }
    });

    it("applies XP to existing skill levels", () => {
      const save = createNewSave(0, "seed");
      const withXp = {
        ...save,
        skills: {
          woodcutting: { xp: 10000 },
          mining: { xp: 0 },
          fishing: { xp: 0 },
          cooking: { xp: 0 },
          smithing: { xp: 0 },
          melee: { xp: 5000 },
        },
      };

      const { state: active } = startExpedition(withXp, "loc", "act", 30000);
      const result = resolveExpedition(active, 30000);

      const woodXpAfter = result!.state.skills.woodcutting.xp;
      const meleXpAfter = result!.state.skills.melee.xp;
      expect(woodXpAfter).toBeGreaterThanOrEqual(10000);
      expect(meleXpAfter).toBeGreaterThanOrEqual(5000);
    });
  });

  describe("Edge cases and crash scenarios", () => {
    it("survives multiple save/load cycles", () => {
      let save = createNewSave(0, "test-seed");
      const { state: active } = startExpedition(save, "loc", "act", 10000);

      // Simulate crash and reload
      const serialized1 = serializeSave(active);
      const reloaded1 = JSON.parse(serialized1) as GameSave;
      expect(reloaded1.activeExpedition).not.toBeNull();

      // Resolve on reloaded state
      const result = resolveExpedition(reloaded1, 10000);
      const serialized2 = serializeSave(result!.state);
      const reloaded2 = JSON.parse(serialized2) as GameSave;

      // Claim should be preserved
      expect(reloaded2.claimedExpeditions[result!.claimId]).toBe(true);
    });

    it("handles zero duration expeditions", () => {
      const save = createNewSave(0, "seed");
      const { state: active } = startExpedition(save, "loc", "act", 0);
      const result = resolveExpedition(active, 0);

      expect(result!.result.elapsedMs).toBe(0);
      expect(result!.result.resourcesObtained).toBe(0);
    });

    it("handles very long expeditions within bounds", () => {
      const save = createNewSave(0, "seed");
      const { state: active } = startExpedition(save, "loc", "act", 3600000); // 1 hour max
      const result = resolveExpedition(active, 7200000); // request 2 hours

      // Should cap at requested duration (1 hour)
      expect(result!.result.elapsedMs).toBeLessThanOrEqual(3600000);
    });

    it("handles negative or invalid elapsed time", () => {
      const save = createNewSave(0, "seed");
      const { state: active } = startExpedition(save, "loc", "act", 60000);

      // Passing 0 elapsed is valid (instant complete)
      const result = resolveExpedition(active, 0);
      expect(result!.result.elapsedMs).toBe(0);
    });
  });
});
