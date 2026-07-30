import { ASSET_REGISTRY } from "@everloom/assets/runtime";
import type {
  ContentBundle,
  EnemyDefinition,
  ItemDefinition,
  QuestDefinition,
  RecipeDefinition,
  ResourceDefinition,
  ZoneDefinition,
} from "@everloom/core";
import enemiesRaw from "./data/enemies.json";
import itemsRaw from "./data/items.json";
import questsRaw from "./data/quests.json";
import recipesRaw from "./data/recipes.json";
import resourcesRaw from "./data/resources.json";
import zonesRaw from "./data/zones.json";
import {
  enemySchema,
  itemSchema,
  questSchema,
  recipeSchema,
  resourceSchema,
  zoneSchema,
} from "./schemas";

function uniqueRecord<T extends { readonly id: string }>(entries: readonly T[], label: string): Readonly<Record<string, T>> {
  const record: Record<string, T> = {};
  for (const entry of entries) {
    if (record[entry.id]) throw new Error(`Duplicate ${label} ID: ${entry.id}`);
    record[entry.id] = Object.freeze(entry);
  }
  return Object.freeze(record);
}

export function buildValidatedContent(): ContentBundle {
  const items = uniqueRecord(itemSchema.array().parse(itemsRaw) as ItemDefinition[], "item");
  const resources = uniqueRecord(resourceSchema.array().parse(resourcesRaw) as ResourceDefinition[], "resource");
  const recipes = uniqueRecord(recipeSchema.array().parse(recipesRaw) as RecipeDefinition[], "recipe");
  const enemies = uniqueRecord(enemySchema.array().parse(enemiesRaw) as EnemyDefinition[], "enemy");
  const quests = uniqueRecord(questSchema.array().parse(questsRaw) as QuestDefinition[], "quest");
  const zones = uniqueRecord(zoneSchema.array().parse(zonesRaw) as ZoneDefinition[], "zone");
  const errors: string[] = [];

  for (const item of Object.values(items)) {
    if (!ASSET_REGISTRY[item.iconId]) errors.push(`Item ${item.id} has missing icon asset ${item.iconId}`);
    if (!ASSET_REGISTRY[item.worldAssetId]) errors.push(`Item ${item.id} has missing world asset ${item.worldAssetId}`);
    if (item.equipmentSlot === "tool" && !item.toolKind) errors.push(`Tool ${item.id} has no toolKind`);
    if (!item.stackable && item.maxStack !== 1) errors.push(`Non-stackable item ${item.id} must have maxStack 1`);
  }

  for (const resource of Object.values(resources)) {
    const drops = [resource.yield, ...resource.rareDrops];
    for (const drop of drops) if (!items[drop.itemId]) errors.push(`Resource ${resource.id} drops missing item ${drop.itemId}`);
    if (!Object.values(items).some((item) => item.toolKind === resource.requiredTool)) {
      errors.push(`Resource ${resource.id} requires unavailable tool kind ${resource.requiredTool}`);
    }
  }

  for (const recipe of Object.values(recipes)) {
    for (const input of recipe.inputs) if (!items[input.itemId]) errors.push(`Recipe ${recipe.id} uses missing item ${input.itemId}`);
    if (!items[recipe.output.itemId]) errors.push(`Recipe ${recipe.id} outputs missing item ${recipe.output.itemId}`);
  }

  for (const enemy of Object.values(enemies)) {
    if (!ASSET_REGISTRY[enemy.assetId]) errors.push(`Enemy ${enemy.id} has missing asset ${enemy.assetId}`);
    for (const drop of enemy.loot) if (!items[drop.itemId]) errors.push(`Enemy ${enemy.id} drops missing item ${drop.itemId}`);
  }

  const allInteractables = new Map<string, ZoneDefinition["interactables"][number]>();
  for (const zone of Object.values(zones)) {
    if (zone.spawn.x < 0 || zone.spawn.z < 0 || zone.spawn.x >= zone.width || zone.spawn.z >= zone.depth) {
      errors.push(`Zone ${zone.id} spawn is out of bounds`);
    }
    for (const scenery of zone.scenery) {
      if (!ASSET_REGISTRY[scenery.assetId]) errors.push(`Scenery ${scenery.id} has missing asset ${scenery.assetId}`);
    }
    for (const target of zone.interactables) {
      if (allInteractables.has(target.id)) errors.push(`Duplicate interactable ID ${target.id}`);
      allInteractables.set(target.id, target);
      if (!ASSET_REGISTRY[target.assetId]) errors.push(`Interactable ${target.id} has missing asset ${target.assetId}`);
      if (target.resourceId && !resources[target.resourceId]) errors.push(`Interactable ${target.id} has missing resource ${target.resourceId}`);
      if (target.itemId && !items[target.itemId]) errors.push(`Interactable ${target.id} has missing item ${target.itemId}`);
      if (target.recipeId && !recipes[target.recipeId]) errors.push(`Interactable ${target.id} has missing recipe ${target.recipeId}`);
      if (target.enemyId && !enemies[target.enemyId]) errors.push(`Interactable ${target.id} has missing enemy ${target.enemyId}`);
      if (target.x < 0 || target.z < 0 || target.x >= zone.width || target.z >= zone.depth) {
        errors.push(`Interactable ${target.id} is out of zone bounds`);
      }
    }
  }

  for (const quest of Object.values(quests)) {
    const stepIds = new Set<string>();
    for (const step of quest.steps) {
      if (stepIds.has(step.id)) errors.push(`Quest ${quest.id} has duplicate step ${step.id}`);
      stepIds.add(step.id);
      if (step.itemId && !items[step.itemId]) errors.push(`Quest ${quest.id}/${step.id} references missing item ${step.itemId}`);
      if (step.targetId && !allInteractables.has(step.targetId) && !enemies[step.targetId]) {
        errors.push(`Quest ${quest.id}/${step.id} references missing target ${step.targetId}`);
      }
      if (step.kind === "pickup") {
        const target = step.targetId ? allInteractables.get(step.targetId) : undefined;
        if (!target || target.kind !== "ground_item" || target.itemId !== step.itemId) {
          errors.push(`Quest ${quest.id}/${step.id} pickup is not backed by a matching ground item`);
        }
        if (!step.itemId || !items[step.itemId]?.equipmentSlot) {
          errors.push(`Quest ${quest.id}/${step.id} pickup item cannot be equipped`);
        }
      }
    }
  }

  if (errors.length > 0) throw new Error(`Content validation failed:\n${errors.join("\n")}`);
  return Object.freeze({ items, resources, recipes, enemies, quests, zones });
}

export const CONTENT = buildValidatedContent();
export { itemSchema, resourceSchema, recipeSchema, enemySchema, questSchema, zoneSchema } from "./schemas";
