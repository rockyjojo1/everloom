import type { PlayerState, DeathMode } from "@everloom/engine";

export function createNewPlayerState(
  playerId: string,
  displayName: string,
  mode: DeathMode
): PlayerState {
  const now = Math.floor(Date.now() / 1000);

  return {
    playerId,
    displayName,
    mode,
    rngSeed: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
    checkpointAt: now,
    currentAction: {
      type: "idle",
      nodeId: null,
      zoneId: "meadowrest",
      startedAt: now,
      recipeId: null,
      targetZoneId: null,
    },
    parallelActions: [],
    skills: {
      woodcutting: 0,
      mining: 0,
      fishing: 0,
      crafting: 0,
      smithing: 0,
      fletching: 0,
      cooking: 0,
      combat: 0,
      wayfaring: 0,
      slayer: 0,
    },
    mastery: {},
    // Start with copper hatchet (given, not crafted — first tool rule).
    inventory: [],
    slots: 10,
    stackCaps: {
      log: 1, ore: 1, fish: 3, food: 1, board: 1, bar: 1,
      shaft: 1, rivet: 1, hide: 1, misc: 1, gear: 1, rare: 1,
      gem: 1, slayer: 1, tool_head: 1, tool_haft: 1, tool_bind: 1, armour: 1,
      fuel: 50,
    },
    bank: [],
    larder: [],
    equipment: {
      hatchet: {
        headId: "copper_hatchet_head",
        haftId: "pine_haft",
        bindingId: "rough_binding",
        headTier: 1,
        haftTier: 1,
        bindingTier: 1,
        wearMastery: 0,
        wearPct: 1000,
      },
      pickaxe: null,
      fishingRod: null,
      helmet: null,
      body: null,
      legs: null,
      kitUnlocked: false,
    },
    couriers: [
      {
        id: "courier_0",
        name: "Wren",
        personality: "always leaves a pebble on top of the satchel",
        state: "idle",
        etaSeconds: 0,
        tripsCompleted: 0,
      },
    ],
    patterns: [],
    motes: 0,
    rivalXpSnapshot: {},
    rivalLastUpdatedAt: now,
    combat: {
      hp: 10,
      maxHp: 10,
      defenceRating: 0,
      attackRating: 1,
      strengthRating: 1,
    },
    zoneId: "meadowrest",
    unlockedZones: ["meadowrest"],
    travelProgress: 0,
    collectedItemIds: [],
    completedBundleIds: [],
    completedWeeklyContractIds: [],
    foundBlueprintIds: [],
    pets: [],
    version: 0,
    isDead: false,
  };
}
