import { z } from "zod";
import { PROBABILITY_SCALE } from "@everloom/core";

const identifier = z.string().regex(/^[a-z][a-z0-9_]*$/);
const assetIdentifier = z.string().min(3);
const probability = z.number().int().min(0).max(PROBABILITY_SCALE);
const positiveInteger = z.number().int().positive();
const position = z.object({ x: z.number(), z: z.number() });
const stack = z.object({ itemId: identifier, quantity: positiveInteger });
const drop = z.object({
  itemId: identifier,
  minQuantity: positiveInteger,
  maxQuantity: positiveInteger,
  chancePpm: probability,
}).refine((value) => value.maxQuantity >= value.minQuantity, "maxQuantity must be >= minQuantity");

export const itemSchema = z.object({
  id: identifier,
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(["tool", "weapon", "resource", "food", "rare", "quest", "collection"]),
  stackable: z.boolean(),
  maxStack: positiveInteger,
  iconId: assetIdentifier,
  worldAssetId: assetIdentifier,
  equipmentSlot: z.enum(["tool", "weapon", "body"]).nullable(),
  toolKind: z.enum(["hatchet", "pickaxe", "fishing_rod"]).nullable(),
  healAmount: z.number().int().min(0),
  value: z.number().int().min(0),
  collection: z.boolean(),
});

export const resourceSchema = z.object({
  id: identifier,
  name: z.string().min(1),
  skill: z.enum(["woodcutting", "mining", "fishing"]),
  requiredTool: z.enum(["hatchet", "pickaxe", "fishing_rod"]),
  actionDurationMs: z.number().int().min(500),
  successChancePpm: probability,
  xpPerSuccess: positiveInteger,
  masteryXpPerAttempt: positiveInteger,
  yield: drop,
  rareDrops: z.array(drop),
  respawnMs: z.number().int().min(0),
  masterySpeedPpmPerRank: z.number().int().min(0).max(100000),
  masteryRarePpmPerRank: z.number().int().min(0).max(100000),
});

export const recipeSchema = z.object({
  id: identifier,
  name: z.string().min(1),
  skill: z.literal("cooking"),
  actionDurationMs: z.number().int().min(500),
  xpPerSuccess: positiveInteger,
  inputs: z.array(stack).min(1),
  output: stack,
  facilityKind: z.literal("cooking_fire"),
});

export const enemySchema = z.object({
  id: identifier,
  name: z.string().min(1),
  maxHp: positiveInteger,
  attackIntervalMs: z.number().int().min(500),
  minDamage: z.number().int().min(0),
  maxDamage: z.number().int().min(0),
  minPlayerDamage: positiveInteger,
  maxPlayerDamage: positiveInteger,
  xpReward: positiveInteger,
  loot: z.array(drop),
  respawnMs: z.number().int().min(0),
  assetId: assetIdentifier,
}).refine((value) => value.maxDamage >= value.minDamage, "enemy maxDamage must be >= minDamage")
  .refine((value) => value.maxPlayerDamage >= value.minPlayerDamage, "player damage range is invalid");

export const questSchema = z.object({
  id: identifier,
  name: z.string().min(1),
  summary: z.string().min(1),
  steps: z.array(z.object({
    id: identifier,
    kind: z.enum(["talk", "pickup", "equip", "gather", "cook", "defeat", "interact", "attune"]),
    objective: z.string().min(1),
    targetId: identifier.nullable(),
    itemId: identifier.nullable(),
    count: positiveInteger,
  }).refine(
    (step) => step.kind !== "attune" || (step.targetId === null && step.itemId === null && step.count === 5),
    "attune steps must have no target/item and require exactly 5 attuned skills",
  )).min(1),
  nextQuestId: identifier.nullable().optional(),
  completionFlag: identifier.nullable().optional(),
});

const terrainRegion = z.object({
  surface: z.enum(["grass", "meadow", "path", "stone", "water", "soil"]),
  shape: z.enum(["rect", "circle", "path"]),
  x: z.number(),
  z: z.number(),
  width: z.number().positive(),
  depth: z.number().min(0),
  endX: z.number().nullable(),
  endZ: z.number().nullable(),
});

export const zoneSchema = z.object({
  id: identifier,
  name: z.string().min(1),
  width: positiveInteger,
  depth: positiveInteger,
  cellSize: z.number().positive(),
  spawn: position,
  terrain: z.array(terrainRegion).min(1),
  blockedCells: z.array(position),
  scenery: z.array(position.extend({
    id: identifier,
    assetId: assetIdentifier,
    rotation: z.number(),
    scale: z.number().positive(),
    elevation: z.number(),
    blocks: z.boolean(),
    tint: z.string().nullable(),
  })),
  interactables: z.array(position.extend({
    id: identifier,
    kind: z.enum(["resource", "ground_item", "npc", "enemy", "facility", "landmark", "door", "exit"]),
    displayName: z.string().min(1),
    assetId: assetIdentifier,
    resourceId: identifier.nullable(),
    itemId: identifier.nullable(),
    recipeId: identifier.nullable(),
    enemyId: identifier.nullable(),
    quantity: z.number().int().min(0),
    interactionRadius: z.number().int().min(0).max(3),
    blocks: z.boolean(),
    tint: z.string().nullable().optional(),
    requiredFlag: identifier.nullable().optional(),
  })),
});
