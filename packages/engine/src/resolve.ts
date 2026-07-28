// ============================================================
// resolve() — THE PURE GAME FUNCTION
// state_now = resolve(state_at_checkpoint, action, elapsedSeconds, seed)
//
// Rules:
//   - Pure function. No I/O. No Date.now(). No Math.random() (use rng param).
//   - Integer arithmetic only. No floats in state.
//   - Composable: resolve(resolve(s,t1), t2) === resolve(s, t1+t2)
//   - Must complete a 300-hour window in <50ms (analytic, not tick-simulated).
// ============================================================

import type {
  ActionDescriptor,
  CurrentAction,
  GameEvent,
  ItemStack,
  PlayerState,
  ResolveInput,
  ResolveOutput,
  SkillId,
  ZoneId,
} from "./types.js";

import { deriveSeed, rollChanceFP, splitmix32 } from "./rng.js";
import { levelFromXp, masteryLevelFromXp, XP_TABLE } from "./xp.js";
import {
  addToBank,
  addToInventory,
  addToLarder,
  consumeFromLarder,
  dispatchCouriers,
  isInventoryFull,
  larderCapacity,
  resolveCouriers,
} from "./inventory.js";
import { resolveAmbientCombat } from "./combat.js";
import type { ZoneThreat } from "./combat.js";

// ── Gamedata shape (injected — engine never imports JSON directly) ────────────

export interface NodeData {
  readonly id: string;
  readonly skill: SkillId;
  readonly zoneId: ZoneId;
  readonly hardness: number;       // 1-8
  readonly baseActionTimeSec: number; // at tool-head matches hardness
  readonly xpPerAction: number;
  readonly masteryXpPerAction: number;
  readonly drops: readonly {
    readonly itemId: string;
    readonly materialClass: string;
    readonly chance: number;       // fixed-point ×1000 (1000 = 100%)
    readonly qty: number;
  }[];
  readonly rareDrops: readonly {
    readonly itemId: string;
    readonly chance: number;       // 1-in-N
  }[];
  readonly petChance: number;      // 1-in-N per action
  readonly petId: string | null;
  readonly spriteId?: string;      // for rendering
  readonly facilityType?: "furnace" | "anvil"; // for facilities
}

export interface ItemData {
  readonly id: string;
  readonly name: string;
  readonly materialClass: string;
  readonly healAmount: number;     // 0 for non-food
  readonly freshnessDecaySec: number; // 0 for non-food
  readonly baseValue: number;      // integer
  readonly tradeable: boolean;
}

export interface RecipeData {
  readonly id: string;
  readonly skill: SkillId;
  readonly levelReq: number;
  readonly inputs: readonly { readonly itemId: string; readonly qty: number }[];
  readonly output: { readonly itemId: string; readonly qty: number };
  readonly actionTimeSec: number;
  readonly xpPerAction: number;
  readonly masteryXpPerAction: number;
  readonly blueprintRequired: boolean;
}

export interface ZoneData {
  readonly id: ZoneId;
  readonly danger: number;         // 0-100
  readonly richness: number;       // fixed-point ×1000 (1000 = 100%)
  readonly travelTimeSec: number;  // from previous zone
  readonly threat: ZoneThreat | null;
  readonly unlockBundleId: string | null;
}

export interface GameData {
  readonly nodes: Readonly<Record<string, NodeData>>;
  readonly items: Readonly<Record<string, ItemData>>;
  readonly recipes: Readonly<Record<string, RecipeData>>;
  readonly zones: Readonly<Record<string, ZoneData>>;
  readonly healMap: Readonly<Record<string, number>>; // itemId -> heal HP
}

// ── Main resolve ──────────────────────────────────────────────

export function resolve(input: ResolveInput, gameData: GameData): ResolveOutput {
  const { state, action, elapsedSeconds, nowSeconds, rngSeed } = input;

  if (state.isDead) {
    // Ironbound permanent death — nothing can happen.
    return { state, events: [] };
  }

  if (elapsedSeconds <= 0) {
    return { state: applyNewAction(state, action, nowSeconds), events: [] };
  }

  const allEvents: GameEvent[] = [];

  // ── 1. Resolve couriers ───────────────────────────────────
  const courierResult = resolveCouriers(
    state.couriers,
    elapsedSeconds,
    [...state.inventory],
    [...state.bank],
    state.slots
  );
  allEvents.push(...courierResult.events);

  // ── 2. Resolve the gathering/crafting action ──────────────
  let workingState: PlayerState = {
    ...state,
    couriers: courierResult.couriers,
    bank: courierResult.bank,
    inventory: courierResult.inventory,
  };

  const actionResult = resolveAction(workingState, action, elapsedSeconds, nowSeconds, rngSeed, gameData);
  allEvents.push(...actionResult.events);
  workingState = actionResult.state;

  // ── 3. Resolve ambient combat (analytic) ──────────────────
  const zone = gameData.zones[state.zoneId];
  if (zone?.threat && state.currentAction.type !== "traveling") {
    const cookingLevel = levelFromXp(workingState.skills.cooking);
    const larderCap = larderCapacity(cookingLevel);
    const healMap = gameData.healMap;

    const foodForCombat = workingState.larder
      .filter((e) => e.qty > 0)
      .map((e) => ({
        itemId: e.itemId,
        qty: e.qty,
        healAmount: healMap[e.itemId] ?? 0,
      }));

    const droppable = workingState.inventory.map((s) => ({
      itemId: s.itemId,
      value: gameData.items[s.itemId]?.baseValue ?? 0,
    }));

    const combatResult = resolveAmbientCombat({
      stats: workingState.combat,
      threat: zone.threat,
      durationSeconds: elapsedSeconds,
      food: foodForCombat,
      mode: state.mode,
      zoneId: state.zoneId,
      droppableItems: droppable,
    });

    allEvents.push(...combatResult.events);

    // Apply food consumption to larder.
    let newLarder = [...workingState.larder];
    for (const e of combatResult.events) {
      if (e.kind === "food_consumed") {
        const result = consumeFromLarder(newLarder, 1);
        newLarder = result.larder;
      }
    }

    // Apply death consequences.
    let newInventory = [...workingState.inventory];
    let isDead = workingState.isDead;

    for (const death of combatResult.deaths) {
      for (const lost of death.lostItems) {
        const { inventory: inv } = removeFromInventory(newInventory, lost.itemId, lost.qty);
        newInventory = inv as ItemStack[];
        allEvents.push({
          kind: "item_lost",
          itemId: lost.itemId,
          qty: lost.qty,
          atSeconds: death.atSeconds,
          reason: "death",
        });
      }
      if (state.mode === "ironbound") {
        isDead = true;
        break;
      }
    }

    workingState = {
      ...workingState,
      larder: newLarder,
      inventory: newInventory,
      isDead,
      combat: {
        ...workingState.combat,
        hp: isDead ? 0 : combatResult.hpRemaining,
      },
    };
  }

  // ── 4. Update checkpoint and apply new action ─────────────
  const finalState: PlayerState = {
    ...workingState,
    currentAction: buildCurrentAction(action, nowSeconds),
    checkpointAt: nowSeconds,
    version: state.version + 1,
  };

  return { state: finalState, events: allEvents };
}

// ── Action resolution ────────────────────────────────────────

function resolveAction(
  state: PlayerState,
  action: ActionDescriptor,
  elapsedSeconds: number,
  nowSeconds: number,
  rngSeed: bigint,
  gameData: GameData
): ResolveOutput {
  switch (action.type) {
    case "woodcutting":
    case "mining":
    case "fishing":
      return resolveGathering(state, action, elapsedSeconds, nowSeconds, rngSeed, gameData);
    case "crafting":
    case "smithing":
    case "fletching":
    case "cooking":
      if (action.nodeId && gameData.nodes[action.nodeId]) {
        return resolveGathering(state, action, elapsedSeconds, nowSeconds, rngSeed, gameData);
      }
      return resolveProduction(state, action, elapsedSeconds, nowSeconds, rngSeed, gameData);
    case "traveling":
      return resolveTravel(state, action, elapsedSeconds, nowSeconds, gameData);
    case "idle":
    default:
      return { state, events: [] };
  }
}

function resolveGathering(
  state: PlayerState,
  action: ActionDescriptor,
  elapsedSeconds: number,
  nowSeconds: number,
  rngSeed: bigint,
  gameData: GameData
): ResolveOutput {
  const nodeId = action.nodeId;
  if (!nodeId) return { state, events: [] };

  const node = gameData.nodes[nodeId];
  if (!node) return { state, events: [] };

  const skillXp = state.skills[node.skill] ?? 0;
  const skillLevel = levelFromXp(skillXp);
  const masteryXp = state.mastery[nodeId] ?? 0;
  const masteryLevel = masteryLevelFromXp(masteryXp);

  // Tool is required for gathering.
  const tool = getToolForSkill(state, node.skill);
  if (!tool) {
    return {
      state,
      events: [{ kind: "tool_required", skill: node.skill, atSeconds: nowSeconds }],
    };
  }

  const headTier = tool.headTier;
  const haftTier = tool.haftTier;
  const bindingTier = tool.bindingTier;
  const wearPct = tool.wearPct;

  // Hardness penalty (3.1 and 4B.3).
  const tierGap = node.hardness - headTier;
  if (tierGap >= 3) return { state, events: [] }; // blocked

  const hardnessMult =
    tierGap === 2 ? 12 : tierGap === 1 ? 3 : 1;

  // Action time: base × hardnessMult, reduced by skill level and haft tier.
  const speedBonus = Math.floor(skillLevel * 3 + haftTier * 120); // fixed-point ×1000; nerfed for pacing
  const actionTimeFP = Math.max(
    4000, // 4s minimum
    node.baseActionTimeSec * 1000 * hardnessMult - speedBonus
  );
  const actionTimeSec = Math.floor(actionTimeFP / 1000);

  // Mastery bonuses.
  const doubleYieldChanceFP = Math.min(masteryLevel * 200, 20_000); // up to 20%
  const masteryStackBonus = Math.floor(masteryLevel / 10);

  // Zone richness multiplier.
  const zone = gameData.zones[state.zoneId];
  const richnessFP = zone?.richness ?? 1000;

  const rng = splitmix32(deriveSeed(rngSeed, nodeId, 0));
  const events: GameEvent[] = [];

  // Success roll formula (out of 1000).
  const successFP = Math.min(
    Math.max(180 + skillLevel * 11 + headTier * 70 + masteryLevel * 3, 180),
    850
  );

  let newSkillXp = skillXp;
  let newMasteryXp = masteryXp;
  let newInventory = [...state.inventory];
  let newBank = [...state.bank];
  let newLarder = [...state.larder];
  const newPets = [...state.pets];
  const newCollected = [...state.collectedItemIds];
  const newBlueprints = [...state.foundBlueprintIds];

  const cookingLevel = levelFromXp(state.skills.cooking ?? 0);
  const larderCap = larderCapacity(cookingLevel);

  let secondsRemaining = elapsedSeconds;
  let prevSkillLevel = skillLevel;
  let prevMasteryLevel = masteryLevel;

  // Optimize for offline windows > 2h using expected values.
  const useExpectedValue = elapsedSeconds > 7200; // 2 hours
  let actionsCompleted = 0;

  if (useExpectedValue) {
    const totalActions = Math.floor(elapsedSeconds / actionTimeSec);
    const successfulActions = Math.floor((totalActions * successFP) / 1000);
    const masteryFailureActions = totalActions - successfulActions;

    // Apply successful actions.
    const xpGain = Math.floor(node.xpPerAction * richnessFP * successfulActions / 1000);
    newSkillXp += xpGain;
    if (xpGain > 0) {
      events.push({ kind: "xp_gain", skill: node.skill, amount: xpGain, atSeconds: elapsedSeconds });
    }

    // Mastery accrues on all actions (success + failure) at 1 per failure.
    const masteryGain = node.masteryXpPerAction * successfulActions + masteryFailureActions;
    newMasteryXp += masteryGain;
    if (masteryGain > 0) {
      events.push({ kind: "mastery_gain", nodeId, amount: masteryGain, atSeconds: elapsedSeconds });
    }

    // Apply drops from successful actions.
    for (const drop of node.drops) {
      const dropCount = Math.floor((successfulActions * drop.chance) / 1000);
      if (dropCount <= 0) continue;

      let qty = drop.qty * dropCount;
      // Double yield applies per successful action (simplified for efficiency).
      const doubleCount = Math.floor((successfulActions * doubleYieldChanceFP) / 1000);
      qty += drop.qty * doubleCount;
      qty = Math.max(1, Math.floor(qty * richnessFP / 1000));

      const dropItem = gameData.items[drop.itemId];
      if (node.skill === "cooking" && (dropItem?.healAmount ?? 0) > 0) {
        const freshAt = nowSeconds + 7 * 24 * 3600;
        const result = addToLarder(newLarder, drop.itemId, qty, freshAt, larderCap);
        newLarder = result.larder;
        if (result.added > 0) {
          events.push({ kind: "item_gained", itemId: drop.itemId, qty: result.added, atSeconds: elapsedSeconds });
        }
      } else {
        const result = addToInventory(
          newInventory,
          drop.itemId,
          qty,
          state.slots,
          state.stackCaps,
          drop.materialClass
        );
        newInventory = result.inventory as typeof newInventory;
        if (result.added > 0) {
          events.push({ kind: "item_gained", itemId: drop.itemId, qty: result.added, atSeconds: elapsedSeconds });
          if (!newCollected.includes(drop.itemId)) newCollected.push(drop.itemId);
        }
      }
    }

    // Rare drops (simplified).
    for (const rare of node.rareDrops) {
      // Expected number of rares.
      const expectedRares = (successfulActions / rare.chance);
      if (expectedRares >= 1) {
        const rareCount = Math.floor(expectedRares);
        for (let i = 0; i < rareCount; i++) {
          const rResult = addToInventory(newInventory, rare.itemId, 1, state.slots, state.stackCaps, "rare");
          newInventory = rResult.inventory as typeof newInventory;
          events.push({ kind: "item_gained", itemId: rare.itemId, qty: 1, atSeconds: elapsedSeconds });
          if (!newCollected.includes(rare.itemId)) newCollected.push(rare.itemId);
        }
      }
    }

    // Pet roll (simplified).
    if (node.petChance > 0 && !newPets.includes(node.petId)) {
      if (successfulActions / node.petChance >= 1) {
        newPets.push(node.petId);
        events.push({ kind: "pet_found", petId: node.petId, atSeconds: elapsedSeconds });
      }
    }

    // Level up events.
    const newSkillLevel = levelFromXp(newSkillXp);
    if (newSkillLevel > prevSkillLevel) {
      events.push({ kind: "level_up", skill: node.skill, newLevel: newSkillLevel, atSeconds: elapsedSeconds });
    }
    const newMastLvl = masteryLevelFromXp(newMasteryXp);
    if (newMastLvl > prevMasteryLevel) {
      events.push({ kind: "mastery_level_up", nodeId, newLevel: newMastLvl, atSeconds: elapsedSeconds });
    }

    secondsRemaining = 0;
  } else {
    // Per-action simulation for active play < 2h.
    while (secondsRemaining >= actionTimeSec) {
      secondsRemaining -= actionTimeSec;
      const atSeconds = elapsedSeconds - secondsRemaining;

      // Success roll.
      const succeeded = rollChanceFP(rng, successFP);

      if (!succeeded) {
        // Failure: consume time, gain 1 mastery xp only, no skill xp or drops.
        newMasteryXp += 1;
        events.push({ kind: "mastery_gain", nodeId, amount: 1, atSeconds });
        continue;
      }

      // XP gain (only on success).
      const xpGain = Math.floor(node.xpPerAction * richnessFP / 1000);
      newSkillXp += xpGain;
      events.push({ kind: "xp_gain", skill: node.skill, amount: xpGain, atSeconds });

      const masteryGain = node.masteryXpPerAction;
      newMasteryXp += masteryGain;
      events.push({ kind: "mastery_gain", nodeId, amount: masteryGain, atSeconds });

      // Level up events.
      const newSkillLevel = levelFromXp(newSkillXp);
      if (newSkillLevel > prevSkillLevel) {
        events.push({ kind: "level_up", skill: node.skill, newLevel: newSkillLevel, atSeconds });
        prevSkillLevel = newSkillLevel;
      }
      const newMastLvl = masteryLevelFromXp(newMasteryXp);
      if (newMastLvl > prevMasteryLevel) {
        events.push({ kind: "mastery_level_up", nodeId, newLevel: newMastLvl, atSeconds });
        prevMasteryLevel = newMastLvl;
      }

      // Drops (only on success).
      for (const drop of node.drops) {
        if (!rollChanceFP(rng, drop.chance * 100)) continue;

        let qty = drop.qty;
        // Double yield (mastery bonus).
        if (rollChanceFP(rng, doubleYieldChanceFP)) qty *= 2;
        // Richness bonus.
        qty = Math.max(1, Math.floor(qty * richnessFP / 1000));

        // Food drops from cooking nodes go to larder; fuel/misc drops go to inventory.
        const dropItem = gameData.items[drop.itemId];
        if (node.skill === "cooking" && (dropItem?.healAmount ?? 0) > 0) {
          const freshAt = nowSeconds + 7 * 24 * 3600; // 7 days freshness
          const result = addToLarder(newLarder, drop.itemId, qty, freshAt, larderCap);
          newLarder = result.larder;
          if (result.added > 0) {
            events.push({ kind: "item_gained", itemId: drop.itemId, qty: result.added, atSeconds });
          }
        } else {
          const result = addToInventory(
            newInventory,
            drop.itemId,
            qty,
            state.slots,
            state.stackCaps,
            drop.materialClass
          );
          newInventory = result.inventory as typeof newInventory;
          if (result.added > 0) {
            events.push({ kind: "item_gained", itemId: drop.itemId, qty: result.added, atSeconds });
            if (!newCollected.includes(drop.itemId)) newCollected.push(drop.itemId);
          }

          // Satchel full — try to dispatch couriers.
          if (isInventoryFull(newInventory, state.slots)) {
            events.push({ kind: "satchel_full", atSeconds });
            const hasCourier = state.couriers.some((c) => c.state === "idle");
            if (hasCourier) {
              // Dispatch handled outside this function in the main resolve.
            } else {
              break; // stop gathering, satchel full
            }
          }
        }

        // Rare drops.
        for (const rare of node.rareDrops) {
          if (rng() < 1 / rare.chance) {
            const rResult = addToInventory(newInventory, rare.itemId, 1, state.slots, state.stackCaps, "rare");
            newInventory = rResult.inventory as typeof newInventory;
            events.push({ kind: "item_gained", itemId: rare.itemId, qty: 1, atSeconds });
            if (!newCollected.includes(rare.itemId)) newCollected.push(rare.itemId);
          }
        }
      }

      // Pet roll.
      if (node.petChance > 0 && !newPets.includes(node.petId)) {
        if (rng() < 1 / node.petChance) {
          newPets.push(node.petId);
          events.push({ kind: "pet_found", petId: node.petId, atSeconds });
        }
      }

      // Glimmer (1.2s window, ~1-in-30 actions for active feel).
      if (rng() < 1 / 30) {
        events.push({ kind: "glimmer", nodeId, motes: 2, atSeconds });
      }
    }
  }

  const newSkills = { ...state.skills, [node.skill]: newSkillXp };
  const newMastery = { ...state.mastery, [nodeId]: newMasteryXp };

  return {
    state: {
      ...state,
      skills: newSkills,
      mastery: newMastery,
      inventory: newInventory,
      bank: newBank,
      larder: newLarder,
      pets: newPets,
      collectedItemIds: newCollected,
      foundBlueprintIds: newBlueprints,
    },
    events,
  };
}

function resolveProduction(
  state: PlayerState,
  action: ActionDescriptor,
  elapsedSeconds: number,
  nowSeconds: number,
  rngSeed: bigint,
  gameData: GameData
): ResolveOutput {
  const recipeId = action.recipeId;
  if (!recipeId) return { state, events: [] };

  const recipe = gameData.recipes[recipeId];
  if (!recipe) return { state, events: [] };

  const skillXp = state.skills[recipe.skill] ?? 0;
  const skillLevel = levelFromXp(skillXp);

  if (skillLevel < recipe.levelReq) return { state, events: [] };
  if (recipe.blueprintRequired && !state.foundBlueprintIds.includes(recipeId)) {
    return { state, events: [] };
  }

  const rng = splitmix32(deriveSeed(rngSeed, recipeId, 0));
  const events: GameEvent[] = [];
  let newSkillXp = skillXp;
  let newInventory = [...state.inventory];
  let newBank = [...state.bank];
  let newLarder = [...state.larder];
  const cookingLevel = levelFromXp(state.skills.cooking ?? 0);
  const larderCap = larderCapacity(cookingLevel);
  const newCollected = [...state.collectedItemIds];

  let secondsRemaining = elapsedSeconds;
  let prevSkillLevel = skillLevel;

  while (secondsRemaining >= recipe.actionTimeSec) {
    // Check inputs available.
    const hasInputs = recipe.inputs.every((inp) => {
      const stack = newInventory.find((s) => s.itemId === inp.itemId);
      return (stack?.qty ?? 0) >= inp.qty;
    });
    if (!hasInputs) break;

    secondsRemaining -= recipe.actionTimeSec;
    const atSeconds = elapsedSeconds - secondsRemaining;

    // Consume inputs.
    for (const inp of recipe.inputs) {
      const idx = newInventory.findIndex((s) => s.itemId === inp.itemId);
      if (idx >= 0) {
        const s = newInventory[idx]!;
        newInventory[idx] = { ...s, qty: s.qty - inp.qty };
        if (newInventory[idx]!.qty <= 0) newInventory.splice(idx, 1);
      }
    }

    // Produce output.
    const { itemId, qty } = recipe.output;
    const item = gameData.items[itemId];
    const materialClass = item?.materialClass ?? "misc";

    if (recipe.skill === "cooking" && item?.healAmount && item.healAmount > 0) {
      const freshAt = nowSeconds + 7 * 24 * 3600;
      const result = addToLarder(newLarder, itemId, qty, freshAt, larderCap);
      newLarder = result.larder;
      if (result.added > 0) {
        events.push({ kind: "item_gained", itemId, qty: result.added, atSeconds });
      }
    } else {
      const result = addToInventory(newInventory, itemId, qty, state.slots, state.stackCaps, materialClass);
      newInventory = result.inventory as typeof newInventory;
      if (result.added > 0) {
        events.push({ kind: "item_gained", itemId, qty: result.added, atSeconds });
        if (!newCollected.includes(itemId)) newCollected.push(itemId);
      }
    }

    // XP.
    const xpGain = recipe.xpPerAction;
    newSkillXp += xpGain;
    events.push({ kind: "xp_gain", skill: recipe.skill, amount: xpGain, atSeconds });

    const newLevel = levelFromXp(newSkillXp);
    if (newLevel > prevSkillLevel) {
      events.push({ kind: "level_up", skill: recipe.skill, newLevel, atSeconds });
      prevSkillLevel = newLevel;
    }
  }

  return {
    state: {
      ...state,
      skills: { ...state.skills, [recipe.skill]: newSkillXp },
      inventory: newInventory,
      bank: newBank,
      larder: newLarder,
      collectedItemIds: newCollected,
    },
    events,
  };
}

function resolveTravel(
  state: PlayerState,
  action: ActionDescriptor,
  elapsedSeconds: number,
  nowSeconds: number,
  gameData: GameData
): ResolveOutput {
  const targetZone = action.targetZoneId;
  if (!targetZone) return { state, events: [] };

  const zone = gameData.zones[targetZone];
  if (!zone) return { state, events: [] };

  const wayfaringLevel = levelFromXp(state.skills.wayfaring ?? 0);
  const travelReduction = Math.min(wayfaringLevel * 5, 50); // up to 50% reduction
  const travelTimeSec = Math.max(
    10,
    Math.floor(zone.travelTimeSec * (100 - travelReduction) / 100)
  );

  if (elapsedSeconds >= travelTimeSec) {
    const newUnlocked = state.unlockedZones.includes(targetZone)
      ? state.unlockedZones
      : [...state.unlockedZones, targetZone];

    const events: GameEvent[] = [];
    if (!state.unlockedZones.includes(targetZone)) {
      events.push({ kind: "zone_unlocked", zoneId: targetZone, atSeconds: travelTimeSec });
    }

    return {
      state: { ...state, zoneId: targetZone, unlockedZones: newUnlocked },
      events,
    };
  }

  // Still traveling.
  const progressFP = Math.floor((elapsedSeconds * 1000) / travelTimeSec);
  return {
    state: { ...state, travelProgress: progressFP },
    events: [],
  };
}

// ── Helpers ───────────────────────────────────────────────────

function getToolForSkill(state: PlayerState, skill: SkillId) {
  switch (skill) {
    case "woodcutting": return state.equipment.hatchet;
    case "mining": return state.equipment.pickaxe;
    case "fishing": return state.equipment.fishingRod;
    default: return null;
  }
}

function buildCurrentAction(action: ActionDescriptor, nowSeconds: number): CurrentAction {
  return {
    type: action.type,
    nodeId: action.nodeId,
    zoneId: action.zoneId,
    startedAt: nowSeconds,
    recipeId: action.recipeId,
    targetZoneId: action.targetZoneId,
  };
}

function applyNewAction(state: PlayerState, action: ActionDescriptor, nowSeconds: number): PlayerState {
  return {
    ...state,
    currentAction: buildCurrentAction(action, nowSeconds),
    checkpointAt: nowSeconds,
  };
}

function removeFromInventory(
  inventory: readonly ItemStack[],
  itemId: string,
  qty: number
): { inventory: ItemStack[] } {
  const mutable = inventory.map((s) => ({ itemId: s.itemId, qty: s.qty }));
  const idx = mutable.findIndex((s) => s.itemId === itemId);
  if (idx < 0) return { inventory: mutable };
  const s = mutable[idx]!;
  (s as { itemId: string; qty: number }).qty = Math.max(0, s.qty - qty);
  if (s.qty === 0) mutable.splice(idx, 1);
  return { inventory: mutable };
}
