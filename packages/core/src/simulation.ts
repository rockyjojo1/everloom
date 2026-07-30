import { addItem, canAddItem, hasItems, itemQuantity, removeItem } from "./inventory";
import { applyQuestEvents } from "./quests";
import { deterministicRange, deterministicRollPpm } from "./rng";
import { levelFromXp, masteryRankFromXp } from "./progression";
import {
  PROBABILITY_SCALE,
  type Activity,
  type ActivityReport,
  type ActionResult,
  type ContentBundle,
  type DropDefinition,
  type GameEvent,
  type GameSave,
  type InventoryStack,
  type ResourceDefinition,
  type SimulationResult,
  type SkillId,
  type StopReason,
  type ZoneInteractable,
} from "./types";

function cloneState(state: GameSave): GameSave {
  return {
    ...state,
    player: { ...state.player },
    position: { ...state.position },
    inventory: state.inventory.map((stack) => ({ ...stack })),
    equipment: { ...state.equipment },
    skills: Object.fromEntries(Object.entries(state.skills).map(([id, value]) => [id, { ...value }])) as GameSave["skills"],
    mastery: Object.fromEntries(Object.entries(state.mastery).map(([id, value]) => [id, { ...value }])),
    quests: Object.fromEntries(Object.entries(state.quests).map(([id, value]) => [id, { ...value }])),
    worldFlags: { ...state.worldFlags },
    worldResources: Object.fromEntries(Object.entries(state.worldResources).map(([id, value]) => [id, { ...value }])),
    worldEnemies: Object.fromEntries(Object.entries(state.worldEnemies).map(([id, value]) => [id, { ...value }])),
    collections: [...state.collections],
    currentActivity: state.currentActivity ? { ...state.currentActivity } : null,
    settings: { ...state.settings },
  };
}

function emptyReport(elapsedMs: number): ActivityReport {
  return {
    elapsedMs,
    productiveMs: 0,
    stopAtMs: null,
    stopReason: "none",
    xpGained: {},
    itemsGained: [],
    masteryGained: {},
    rareDrops: [],
    levelGains: [],
    deaths: 0,
  };
}

function mergeStack(list: readonly InventoryStack[], itemId: string, quantity: number): readonly InventoryStack[] {
  const existing = list.find((entry) => entry.itemId === itemId);
  if (!existing) return [...list, { itemId, quantity }];
  return list.map((entry) => entry.itemId === itemId ? { ...entry, quantity: entry.quantity + quantity } : entry);
}

function withEventsApplied(
  state: GameSave,
  sourceEvents: readonly GameEvent[],
  content: ContentBundle,
): { readonly state: GameSave; readonly events: readonly GameEvent[] } {
  const quest = applyQuestEvents(state, sourceEvents, content);
  return { state: quest.state, events: [...sourceEvents, ...quest.questEvents] };
}

function addXp(
  state: GameSave,
  skill: SkillId,
  amount: number,
): { readonly state: GameSave; readonly events: readonly GameEvent[] } {
  const previousXp = state.skills[skill].xp;
  const previousLevel = levelFromXp(previousXp);
  const nextXp = previousXp + amount;
  const nextLevel = levelFromXp(nextXp);
  const events: GameEvent[] = [{ type: "xp_gained", skill, amount }];
  if (nextLevel > previousLevel) events.push({ type: "level_gained", skill, from: previousLevel, to: nextLevel });
  return {
    state: { ...state, skills: { ...state.skills, [skill]: { xp: nextXp } } },
    events,
  };
}

function addMastery(
  state: GameSave,
  targetId: string,
  amount: number,
): { readonly state: GameSave; readonly events: readonly GameEvent[] } {
  const previousXp = state.mastery[targetId]?.xp ?? 0;
  const previousRank = masteryRankFromXp(previousXp);
  const nextXp = previousXp + amount;
  const nextRank = masteryRankFromXp(nextXp);
  const events: GameEvent[] = [{ type: "mastery_gained", targetId, amount }];
  if (nextRank > previousRank) {
    events.push({ type: "mastery_rank_gained", targetId, from: previousRank, to: nextRank });
  }
  return {
    state: { ...state, mastery: { ...state.mastery, [targetId]: { xp: nextXp } } },
    events,
  };
}

function requiredToolEquipped(state: GameSave, resource: ResourceDefinition, content: ContentBundle): boolean {
  const itemId = state.equipment.tool;
  return itemId !== null && content.items[itemId]?.toolKind === resource.requiredTool;
}

function activityDuration(state: GameSave, resource: ResourceDefinition): number {
  const rank = masteryRankFromXp(state.mastery[resource.id]?.xp ?? 0);
  const reductionPpm = Math.min(250_000, rank * resource.masterySpeedPpmPerRank);
  return Math.max(500, Math.floor(resource.actionDurationMs * (PROBABILITY_SCALE - reductionPpm) / PROBABILITY_SCALE));
}

function rolledDrop(
  state: GameSave,
  sequence: number,
  targetId: string,
  drop: DropDefinition,
  rollType: string,
  chanceBonusPpm = 0,
): InventoryStack | null {
  const chance = Math.min(PROBABILITY_SCALE, drop.chancePpm + chanceBonusPpm);
  if (!deterministicRollPpm(state.rngSeed, sequence, rollType, targetId, chance)) return null;
  return {
    itemId: drop.itemId,
    quantity: deterministicRange(
      state.rngSeed,
      sequence,
      `${rollType}:quantity`,
      targetId,
      drop.minQuantity,
      drop.maxQuantity,
    ),
  };
}

function canFitDrops(state: GameSave, drops: readonly InventoryStack[], content: ContentBundle): boolean {
  let inventory = state.inventory;
  for (const drop of drops) {
    const added = addItem(inventory, state.inventorySlots, drop.itemId, drop.quantity, content);
    if (!added) return false;
    inventory = added;
  }
  return true;
}

function grantDrops(
  state: GameSave,
  drops: readonly InventoryStack[],
  sourceId: string,
  rareItemIds: ReadonlySet<string>,
  content: ContentBundle,
): { readonly state: GameSave; readonly events: readonly GameEvent[] } {
  let next = state;
  const events: GameEvent[] = [];
  for (const drop of drops) {
    const inventory = addItem(next.inventory, next.inventorySlots, drop.itemId, drop.quantity, content);
    if (!inventory) throw new Error(`Preflight failed for ${drop.itemId}`);
    const itemEvent: GameEvent = { type: "item_gained", itemId: drop.itemId, quantity: drop.quantity, sourceId };
    events.push(itemEvent);
    if (rareItemIds.has(drop.itemId)) {
      events.push({ type: "rare_drop", itemId: drop.itemId, quantity: drop.quantity, sourceId });
    }
    const item = content.items[drop.itemId];
    next = {
      ...next,
      inventory,
      collections: item?.collection && !next.collections.includes(drop.itemId)
        ? [...next.collections, drop.itemId]
        : next.collections,
    };
  }
  return { state: next, events };
}

function stopActivity(
  state: GameSave,
  reason: StopReason,
  report: ActivityReport,
  events: GameEvent[],
): { readonly state: GameSave; readonly report: ActivityReport } {
  events.push({ type: "activity_stopped", reason });
  return {
    state: { ...state, currentActivity: null },
    report: { ...report, stopReason: reason, stopAtMs: state.simulationTimeMs },
  };
}

function findInteractable(content: ContentBundle, state: GameSave, targetId: string): ZoneInteractable | undefined {
  return content.zones[state.currentZone]?.interactables.find((entry) => entry.id === targetId);
}

function isLocked(state: GameSave, target: ZoneInteractable): boolean {
  return Boolean(target.requiredFlag) && !state.worldFlags[target.requiredFlag as string];
}

export function pickupGroundItem(
  state: GameSave,
  targetId: string,
  content: ContentBundle,
): ActionResult {
  const target = findInteractable(content, state, targetId);
  if (!target || target.kind !== "ground_item" || !target.itemId || state.worldFlags[`picked:${targetId}`] || isLocked(state, target)) {
    return { state, events: [], ok: false, reason: "activity_invalid" };
  }
  const inventory = addItem(state.inventory, state.inventorySlots, target.itemId, target.quantity, content);
  if (!inventory) return { state, events: [], ok: false, reason: "inventory_full" };
  const event: GameEvent = { type: "item_gained", itemId: target.itemId, quantity: target.quantity, sourceId: targetId };
  const applied = withEventsApplied({
    ...state,
    inventory,
    worldFlags: { ...state.worldFlags, [`picked:${targetId}`]: true },
  }, [event], content);
  return { state: applied.state, events: applied.events, ok: true, reason: "none" };
}

export function recordWorldInteraction(
  state: GameSave,
  targetId: string,
  content: ContentBundle,
): ActionResult {
  const target = findInteractable(content, state, targetId);
  if (!target || isLocked(state, target)) return { state, events: [], ok: false, reason: "activity_invalid" };
  const applied = withEventsApplied(state, [{ type: "world_interacted", targetId }], content);
  return { state: applied.state, events: applied.events, ok: true, reason: "none" };
}

export function startActivityForTarget(
  state: GameSave,
  targetId: string,
  content: ContentBundle,
): ActionResult {
  const target = findInteractable(content, state, targetId);
  if (!target || isLocked(state, target)) return { state, events: [], ok: false, reason: "activity_invalid" };

  let activity: Activity | null = null;
  if (target.kind === "resource" && target.resourceId) {
    const resource = content.resources[target.resourceId];
    if (!resource) return { state, events: [], ok: false, reason: "activity_invalid" };
    if (!requiredToolEquipped(state, resource, content)) {
      return { state, events: [], ok: false, reason: "missing_tool" };
    }
    activity = { type: "gathering", targetId, resourceId: target.resourceId, progressMs: 0 };
  } else if (target.kind === "facility" && target.recipeId) {
    if (!content.recipes[target.recipeId]) return { state, events: [], ok: false, reason: "activity_invalid" };
    activity = { type: "cooking", targetId, recipeId: target.recipeId, progressMs: 0 };
  } else if (target.kind === "enemy" && target.enemyId) {
    const enemy = content.enemies[target.enemyId];
    if (!enemy || (state.worldEnemies[targetId]?.defeatedUntilMs ?? 0) > state.simulationTimeMs) {
      return { state, events: [], ok: false, reason: "activity_invalid" };
    }
    activity = { type: "combat", targetId, enemyId: target.enemyId, progressMs: 0, enemyHp: enemy.maxHp };
  }

  if (!activity) return { state, events: [], ok: false, reason: "activity_invalid" };
  return { state: { ...state, currentActivity: activity }, events: [], ok: true, reason: "none" };
}

export function cancelActivity(state: GameSave): ActionResult {
  if (!state.currentActivity) return { state, events: [], ok: true, reason: "none" };
  const event: GameEvent = { type: "activity_stopped", reason: "cancelled" };
  return { state: { ...state, currentActivity: null }, events: [event], ok: true, reason: "cancelled" };
}

export function advanceSimulation(
  inputState: GameSave,
  requestedElapsedMs: number,
  content: ContentBundle,
): SimulationResult {
  const elapsedMs = Number.isFinite(requestedElapsedMs) && requestedElapsedMs > 0
    ? Math.floor(requestedElapsedMs)
    : 0;
  let state = cloneState(inputState);
  let report = emptyReport(elapsedMs);
  const events: GameEvent[] = [];
  let remainingMs = elapsedMs;

  while (remainingMs > 0) {
    const activity = state.currentActivity;
    if (!activity) {
      state = { ...state, simulationTimeMs: state.simulationTimeMs + remainingMs };
      remainingMs = 0;
      break;
    }

    if (activity.type === "gathering") {
      const resource = content.resources[activity.resourceId];
      if (!resource || !requiredToolEquipped(state, resource, content)) {
        const stopped = stopActivity(state, resource ? "missing_tool" : "activity_invalid", report, events);
        state = stopped.state;
        report = stopped.report;
        continue;
      }

      const depletedUntil = state.worldResources[activity.targetId]?.depletedUntilMs ?? 0;
      if (depletedUntil > state.simulationTimeMs) {
        const wait = Math.min(remainingMs, depletedUntil - state.simulationTimeMs);
        state = { ...state, simulationTimeMs: state.simulationTimeMs + wait };
        remainingMs -= wait;
        continue;
      }

      const duration = activityDuration(state, resource);
      const needed = Math.max(0, duration - activity.progressMs);
      const spent = Math.min(remainingMs, needed);
      state = {
        ...state,
        simulationTimeMs: state.simulationTimeMs + spent,
        currentActivity: { ...activity, progressMs: activity.progressMs + spent },
      };
      report = { ...report, productiveMs: report.productiveMs + spent };
      remainingMs -= spent;
      if (spent < needed) continue;

      const sequence = state.activitySequence;
      const rank = masteryRankFromXp(state.mastery[resource.id]?.xp ?? 0);
      const successChance = Math.min(
        PROBABILITY_SCALE,
        resource.successChancePpm + Math.min(100_000, rank * 250),
      );
      const success = deterministicRollPpm(
        state.rngSeed,
        sequence,
        "gather:success",
        activity.targetId,
        successChance,
      );
      const drops: InventoryStack[] = [];
      const rareIds = new Set<string>();
      if (success) {
        const mainDrop = rolledDrop(state, sequence, activity.targetId, resource.yield, "gather:yield");
        if (mainDrop) drops.push(mainDrop);
        const rareBonus = Math.min(100_000, rank * resource.masteryRarePpmPerRank);
        for (const rare of resource.rareDrops) {
          const drop = rolledDrop(
            state,
            sequence,
            activity.targetId,
            rare,
            `gather:rare:${rare.itemId}`,
            rareBonus,
          );
          if (drop) {
            drops.push(drop);
            rareIds.add(rare.itemId);
          }
        }
      }

      if (success && !canFitDrops(state, drops, content)) {
        const stopped = stopActivity(
          { ...state, currentActivity: { ...activity, progressMs: duration } },
          "inventory_full",
          report,
          events,
        );
        state = stopped.state;
        report = stopped.report;
        continue;
      }

      state = {
        ...state,
        activitySequence: sequence + 1,
        currentActivity: { ...activity, progressMs: 0 },
      };
      const mastery = addMastery(state, resource.id, resource.masteryXpPerAttempt);
      state = mastery.state;
      events.push(...mastery.events);
      report = {
        ...report,
        masteryGained: {
          ...report.masteryGained,
          [resource.id]: (report.masteryGained[resource.id] ?? 0) + resource.masteryXpPerAttempt,
        },
      };

      if (success) {
        const granted = grantDrops(state, drops, activity.targetId, rareIds, content);
        state = granted.state;
        events.push(...granted.events);
        const xp = addXp(state, resource.skill, resource.xpPerSuccess);
        state = xp.state;
        events.push(...xp.events);
        const untilMs = state.simulationTimeMs + resource.respawnMs;
        state = {
          ...state,
          worldResources: { ...state.worldResources, [activity.targetId]: { depletedUntilMs: untilMs } },
        };
        events.push({ type: "resource_depleted", targetId: activity.targetId, untilMs });
        report = {
          ...report,
          xpGained: {
            ...report.xpGained,
            [resource.skill]: (report.xpGained[resource.skill] ?? 0) + resource.xpPerSuccess,
          },
          itemsGained: drops.reduce(
            (list, drop) => mergeStack(list, drop.itemId, drop.quantity),
            report.itemsGained,
          ),
          rareDrops: drops.filter((drop) => rareIds.has(drop.itemId)).reduce(
            (list, drop) => mergeStack(list, drop.itemId, drop.quantity),
            report.rareDrops,
          ),
          levelGains: [
            ...report.levelGains,
            ...xp.events
              .filter((event): event is Extract<GameEvent, { type: "level_gained" }> => event.type === "level_gained")
              .map((event) => ({ skill: event.skill, from: event.from, to: event.to })),
          ],
        };
      }
    } else if (activity.type === "cooking") {
      const recipe = content.recipes[activity.recipeId];
      if (!recipe) {
        const stopped = stopActivity(state, "activity_invalid", report, events);
        state = stopped.state;
        report = stopped.report;
        continue;
      }
      if (!hasItems(state.inventory, recipe.inputs)) {
        const stopped = stopActivity(state, "inputs_exhausted", report, events);
        state = stopped.state;
        report = stopped.report;
        continue;
      }
      if (!canAddItem(state.inventory, state.inventorySlots, recipe.output.itemId, recipe.output.quantity, content)) {
        const stopped = stopActivity(state, "output_blocked", report, events);
        state = stopped.state;
        report = stopped.report;
        continue;
      }

      const needed = recipe.actionDurationMs - activity.progressMs;
      const spent = Math.min(remainingMs, needed);
      state = {
        ...state,
        simulationTimeMs: state.simulationTimeMs + spent,
        currentActivity: { ...activity, progressMs: activity.progressMs + spent },
      };
      report = { ...report, productiveMs: report.productiveMs + spent };
      remainingMs -= spent;
      if (spent < needed) continue;

      let inventory = state.inventory;
      const consumedEvents: GameEvent[] = [];
      for (const input of recipe.inputs) {
        const removed = removeItem(inventory, input.itemId, input.quantity);
        if (!removed) throw new Error(`Recipe preflight failed for ${input.itemId}`);
        inventory = removed;
        consumedEvents.push({ type: "item_consumed", itemId: input.itemId, quantity: input.quantity });
      }
      const outputInventory = addItem(inventory, state.inventorySlots, recipe.output.itemId, recipe.output.quantity, content);
      if (!outputInventory) throw new Error(`Recipe output preflight failed for ${recipe.output.itemId}`);
      state = {
        ...state,
        inventory: outputInventory,
        activitySequence: state.activitySequence + 1,
        currentActivity: { ...activity, progressMs: 0 },
      };
      const itemEvent: GameEvent = {
        type: "item_gained",
        itemId: recipe.output.itemId,
        quantity: recipe.output.quantity,
        sourceId: activity.targetId,
      };
      const xp = addXp(state, recipe.skill, recipe.xpPerSuccess);
      state = xp.state;
      events.push(...consumedEvents, itemEvent, ...xp.events);
      report = {
        ...report,
        xpGained: {
          ...report.xpGained,
          [recipe.skill]: (report.xpGained[recipe.skill] ?? 0) + recipe.xpPerSuccess,
        },
        itemsGained: mergeStack(report.itemsGained, recipe.output.itemId, recipe.output.quantity),
      };
    } else {
      const enemy = content.enemies[activity.enemyId];
      if (!enemy) {
        const stopped = stopActivity(state, "activity_invalid", report, events);
        state = stopped.state;
        report = stopped.report;
        continue;
      }
      const needed = enemy.attackIntervalMs - activity.progressMs;
      const spent = Math.min(remainingMs, needed);
      state = {
        ...state,
        simulationTimeMs: state.simulationTimeMs + spent,
        currentActivity: { ...activity, progressMs: activity.progressMs + spent },
      };
      report = { ...report, productiveMs: report.productiveMs + spent };
      remainingMs -= spent;
      if (spent < needed) continue;

      const sequence = state.activitySequence;
      const weaponBonus = state.equipment.weapon ? 2 : 0;
      const playerDamage = deterministicRange(
        state.rngSeed,
        sequence,
        "combat:player-damage",
        activity.targetId,
        enemy.minPlayerDamage + weaponBonus,
        enemy.maxPlayerDamage + weaponBonus,
      );
      const enemyHp = Math.max(0, activity.enemyHp - playerDamage);
      events.push({ type: "damage", target: "enemy", amount: playerDamage });
      state = {
        ...state,
        activitySequence: sequence + 1,
        currentActivity: { ...activity, progressMs: 0, enemyHp },
      };

      if (enemyHp <= 0) {
        const drops: InventoryStack[] = [];
        const rareIds = new Set<string>();
        for (const drop of enemy.loot) {
          const rolled = rolledDrop(
            state,
            sequence,
            activity.targetId,
            drop,
            `combat:drop:${drop.itemId}`,
          );
          if (rolled) {
            drops.push(rolled);
            if (content.items[drop.itemId]?.category === "rare") rareIds.add(drop.itemId);
          }
        }
        const fittingDrops = drops.filter((drop) =>
          canAddItem(state.inventory, state.inventorySlots, drop.itemId, drop.quantity, content));
        const granted = grantDrops(state, fittingDrops, activity.targetId, rareIds, content);
        state = granted.state;
        const xp = addXp(state, "melee", enemy.xpReward);
        state = {
          ...xp.state,
          currentActivity: null,
          worldEnemies: {
            ...state.worldEnemies,
            [activity.targetId]: { defeatedUntilMs: state.simulationTimeMs + enemy.respawnMs },
          },
        };
        const defeatEvent: GameEvent = { type: "enemy_defeated", enemyId: enemy.id, targetId: activity.targetId };
        events.push(defeatEvent, ...granted.events, ...xp.events, { type: "activity_stopped", reason: "target_defeated" });
        report = {
          ...report,
          stopReason: "target_defeated",
          stopAtMs: state.simulationTimeMs,
          xpGained: { ...report.xpGained, melee: (report.xpGained.melee ?? 0) + enemy.xpReward },
          itemsGained: fittingDrops.reduce(
            (list, drop) => mergeStack(list, drop.itemId, drop.quantity),
            report.itemsGained,
          ),
          rareDrops: fittingDrops.filter((drop) => rareIds.has(drop.itemId)).reduce(
            (list, drop) => mergeStack(list, drop.itemId, drop.quantity),
            report.rareDrops,
          ),
        };
        continue;
      }

      const enemyDamage = deterministicRange(
        state.rngSeed,
        sequence,
        "combat:enemy-damage",
        activity.targetId,
        enemy.minDamage,
        enemy.maxDamage,
      );
      const hp = Math.max(0, state.player.hp - enemyDamage);
      events.push({ type: "damage", target: "player", amount: enemyDamage });
      state = { ...state, player: { ...state.player, hp } };
      if (hp <= 0) {
        state = { ...state, currentActivity: null };
        events.push(
          { type: "player_died", enemyId: enemy.id },
          { type: "activity_stopped", reason: "player_died" },
        );
        report = {
          ...report,
          stopReason: "player_died",
          stopAtMs: state.simulationTimeMs,
          deaths: report.deaths + 1,
        };
      }
    }
  }

  const applied = withEventsApplied(state, events, content);
  return { state: applied.state, events: applied.events, report };
}

export function useFood(state: GameSave, itemId: string, content: ContentBundle): ActionResult {
  const item = content.items[itemId];
  if (!item || item.healAmount <= 0 || itemQuantity(state.inventory, itemId) < 1 || state.player.hp >= state.player.maxHp) {
    return { state, events: [], ok: false, reason: "activity_invalid" };
  }
  const inventory = removeItem(state.inventory, itemId, 1);
  if (!inventory) return { state, events: [], ok: false, reason: "activity_invalid" };
  return {
    state: {
      ...state,
      inventory,
      player: { ...state.player, hp: Math.min(state.player.maxHp, state.player.hp + item.healAmount) },
    },
    events: [{ type: "item_consumed", itemId, quantity: 1 }],
    ok: true,
    reason: "none",
  };
}
