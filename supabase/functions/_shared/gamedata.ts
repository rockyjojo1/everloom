// Inlined game data for edge functions (Deno Deploy cannot read local JSON at runtime).
// Keep in sync with packages/gamedata/src/data/*.json

import type { GameData, NodeData, ItemData, RecipeData, ZoneData, ZoneThreat, ZoneId } from "./engine.ts";

const NODES_RAW: NodeData[] = [
  { id: "meadowrest_pine", skill: "woodcutting", zoneId: "meadowrest", hardness: 1, baseActionTimeSec: 6, xpPerAction: 12, masteryXpPerAction: 2, petId: "pet_woodpecker", petChance: 50000, drops: [{ itemId: "pine_log", materialClass: "log", chance: 1000, qty: 1 }], rareDrops: [{ itemId: "birds_nest", chance: 256 }] },
  { id: "meadowrest_willow", skill: "woodcutting", zoneId: "meadowrest", hardness: 1, baseActionTimeSec: 8, xpPerAction: 18, masteryXpPerAction: 3, petId: "pet_woodpecker", petChance: 50000, drops: [{ itemId: "willow_log", materialClass: "log", chance: 1000, qty: 1 }], rareDrops: [] },
  { id: "meadowrest_copper_vein", skill: "mining", zoneId: "meadowrest", hardness: 1, baseActionTimeSec: 10, xpPerAction: 14, masteryXpPerAction: 2, petId: "pet_rock_lizard", petChance: 50000, drops: [{ itemId: "copper_ore", materialClass: "ore", chance: 1000, qty: 1 }], rareDrops: [{ itemId: "uncut_sapphire", chance: 1024 }] },
  { id: "meadowrest_tin_vein", skill: "mining", zoneId: "meadowrest", hardness: 1, baseActionTimeSec: 9, xpPerAction: 14, masteryXpPerAction: 2, petId: "pet_rock_lizard", petChance: 50000, drops: [{ itemId: "tin_ore", materialClass: "ore", chance: 1000, qty: 1 }], rareDrops: [] },
  { id: "meadowrest_minnow_pool", skill: "fishing", zoneId: "meadowrest", hardness: 1, baseActionTimeSec: 7, xpPerAction: 10, masteryXpPerAction: 2, petId: "pet_tiny_otter", petChance: 50000, drops: [{ itemId: "raw_minnow", materialClass: "fish", chance: 1000, qty: 1 }], rareDrops: [] },
  { id: "meadowrest_trout_stream", skill: "fishing", zoneId: "meadowrest", hardness: 1, baseActionTimeSec: 11, xpPerAction: 22, masteryXpPerAction: 3, petId: "pet_tiny_otter", petChance: 50000, drops: [{ itemId: "raw_trout", materialClass: "fish", chance: 1000, qty: 1 }], rareDrops: [] },
  { id: "bramblewood_oak", skill: "woodcutting", zoneId: "bramblewood", hardness: 2, baseActionTimeSec: 9, xpPerAction: 38, masteryXpPerAction: 5, petId: "pet_woodpecker", petChance: 50000, drops: [{ itemId: "oak_log", materialClass: "log", chance: 1000, qty: 1 }], rareDrops: [{ itemId: "birds_nest", chance: 128 }] },
  { id: "bramblewood_iron_vein", skill: "mining", zoneId: "bramblewood", hardness: 2, baseActionTimeSec: 12, xpPerAction: 35, masteryXpPerAction: 5, petId: "pet_rock_lizard", petChance: 50000, drops: [{ itemId: "iron_ore", materialClass: "ore", chance: 1000, qty: 1 }], rareDrops: [{ itemId: "uncut_emerald", chance: 512 }] },
  { id: "bramblewood_perch_pool", skill: "fishing", zoneId: "bramblewood", hardness: 2, baseActionTimeSec: 10, xpPerAction: 40, masteryXpPerAction: 5, petId: "pet_tiny_otter", petChance: 50000, drops: [{ itemId: "raw_perch", materialClass: "fish", chance: 1000, qty: 1 }], rareDrops: [] },
  { id: "ashen_delve_coal_vein", skill: "mining", zoneId: "ashen_delve", hardness: 3, baseActionTimeSec: 14, xpPerAction: 50, masteryXpPerAction: 7, petId: "pet_rock_lizard", petChance: 50000, drops: [{ itemId: "coal", materialClass: "ore", chance: 1000, qty: 1 }], rareDrops: [{ itemId: "uncut_ruby", chance: 256 }] },
  { id: "ashen_delve_iron_vein", skill: "mining", zoneId: "ashen_delve", hardness: 2, baseActionTimeSec: 11, xpPerAction: 42, masteryXpPerAction: 6, petId: "pet_rock_lizard", petChance: 50000, drops: [{ itemId: "iron_ore", materialClass: "ore", chance: 1000, qty: 1 }], rareDrops: [] },
  { id: "ashen_delve_charwood", skill: "woodcutting", zoneId: "ashen_delve", hardness: 3, baseActionTimeSec: 11, xpPerAction: 58, masteryXpPerAction: 8, petId: "pet_woodpecker", petChance: 50000, drops: [{ itemId: "charwood_log", materialClass: "log", chance: 1000, qty: 1 }], rareDrops: [{ itemId: "ancient_bark", chance: 200 }] },
  { id: "ashen_delve_cave_eel_pool", skill: "fishing", zoneId: "ashen_delve", hardness: 3, baseActionTimeSec: 13, xpPerAction: 55, masteryXpPerAction: 7, petId: "pet_tiny_otter", petChance: 50000, drops: [{ itemId: "raw_cave_eel", materialClass: "fish", chance: 1000, qty: 1 }], rareDrops: [] },
];

const ITEMS_RAW: ItemData[] = [
  // Logs
  { id: "pine_log", name: "Pine Log", materialClass: "log", healAmount: 0, freshnessDecaySec: 0, baseValue: 4, tradeable: true },
  { id: "willow_log", name: "Willow Log", materialClass: "log", healAmount: 0, freshnessDecaySec: 0, baseValue: 7, tradeable: true },
  { id: "oak_log", name: "Oak Log", materialClass: "log", healAmount: 0, freshnessDecaySec: 0, baseValue: 20, tradeable: true },
  { id: "charwood_log", name: "Charwood Log", materialClass: "log", healAmount: 0, freshnessDecaySec: 0, baseValue: 55, tradeable: true },
  // Ores
  { id: "copper_ore", name: "Copper Ore", materialClass: "ore", healAmount: 0, freshnessDecaySec: 0, baseValue: 5, tradeable: true },
  { id: "tin_ore", name: "Tin Ore", materialClass: "ore", healAmount: 0, freshnessDecaySec: 0, baseValue: 5, tradeable: true },
  { id: "iron_ore", name: "Iron Ore", materialClass: "ore", healAmount: 0, freshnessDecaySec: 0, baseValue: 22, tradeable: true },
  { id: "coal", name: "Coal", materialClass: "ore", healAmount: 0, freshnessDecaySec: 0, baseValue: 30, tradeable: true },
  // Fish
  { id: "raw_minnow", name: "Raw Minnow", materialClass: "fish", healAmount: 0, freshnessDecaySec: 0, baseValue: 3, tradeable: true },
  { id: "raw_trout", name: "Raw Trout", materialClass: "fish", healAmount: 0, freshnessDecaySec: 0, baseValue: 10, tradeable: true },
  { id: "raw_perch", name: "Raw Perch", materialClass: "fish", healAmount: 0, freshnessDecaySec: 0, baseValue: 20, tradeable: true },
  { id: "raw_cave_eel", name: "Raw Cave Eel", materialClass: "fish", healAmount: 0, freshnessDecaySec: 0, baseValue: 40, tradeable: true },
  // Cooked fish
  { id: "cooked_minnow", name: "Cooked Minnow", materialClass: "food", healAmount: 3, freshnessDecaySec: 604800, baseValue: 8, tradeable: true },
  { id: "cooked_trout", name: "Cooked Trout", materialClass: "food", healAmount: 7, freshnessDecaySec: 604800, baseValue: 20, tradeable: true },
  { id: "cooked_perch", name: "Cooked Perch", materialClass: "food", healAmount: 12, freshnessDecaySec: 604800, baseValue: 40, tradeable: true },
  { id: "cooked_cave_eel", name: "Cooked Cave Eel", materialClass: "food", healAmount: 18, freshnessDecaySec: 604800, baseValue: 75, tradeable: true },
  // Bars
  { id: "bronze_bar", name: "Bronze Bar", materialClass: "bar", healAmount: 0, freshnessDecaySec: 0, baseValue: 18, tradeable: true },
  { id: "iron_bar", name: "Iron Bar", materialClass: "bar", healAmount: 0, freshnessDecaySec: 0, baseValue: 50, tradeable: true },
  // Boards
  { id: "pine_board", name: "Pine Board", materialClass: "board", healAmount: 0, freshnessDecaySec: 0, baseValue: 12, tradeable: true },
  { id: "oak_board", name: "Oak Board", materialClass: "board", healAmount: 0, freshnessDecaySec: 0, baseValue: 30, tradeable: true },
  // Shafts
  { id: "willow_shaft", name: "Willow Shaft", materialClass: "shaft", healAmount: 0, freshnessDecaySec: 0, baseValue: 9, tradeable: true },
  { id: "oak_shaft", name: "Oak Shaft", materialClass: "shaft", healAmount: 0, freshnessDecaySec: 0, baseValue: 22, tradeable: true },
  // Hafts
  { id: "pine_haft", name: "Pine Haft", materialClass: "tool_haft", healAmount: 0, freshnessDecaySec: 0, baseValue: 10, tradeable: true },
  { id: "oak_haft", name: "Oak Haft", materialClass: "tool_haft", healAmount: 0, freshnessDecaySec: 0, baseValue: 25, tradeable: true },
  // Rivets / bindings
  { id: "copper_rivet", name: "Copper Rivet", materialClass: "rivet", healAmount: 0, freshnessDecaySec: 0, baseValue: 8, tradeable: true },
  { id: "iron_rivet", name: "Iron Rivet", materialClass: "rivet", healAmount: 0, freshnessDecaySec: 0, baseValue: 20, tradeable: true },
  { id: "rough_binding", name: "Rough Binding", materialClass: "tool_bind", healAmount: 0, freshnessDecaySec: 0, baseValue: 5, tradeable: true },
  { id: "leather_binding", name: "Leather Binding", materialClass: "tool_bind", healAmount: 0, freshnessDecaySec: 0, baseValue: 15, tradeable: true },
  // Tool heads
  { id: "copper_hatchet_head", name: "Copper Hatchet Head", materialClass: "tool_head", healAmount: 0, freshnessDecaySec: 0, baseValue: 15, tradeable: true },
  { id: "iron_hatchet_head", name: "Iron Hatchet Head", materialClass: "tool_head", healAmount: 0, freshnessDecaySec: 0, baseValue: 40, tradeable: true },
  { id: "copper_pickaxe_head", name: "Copper Pickaxe Head", materialClass: "tool_head", healAmount: 0, freshnessDecaySec: 0, baseValue: 15, tradeable: true },
  { id: "iron_pickaxe_head", name: "Iron Pickaxe Head", materialClass: "tool_head", healAmount: 0, freshnessDecaySec: 0, baseValue: 40, tradeable: true },
  // Gear (armour pieces)
  { id: "bronze_helm", name: "Bronze Helm", materialClass: "gear", healAmount: 0, freshnessDecaySec: 0, baseValue: 60, tradeable: true },
  { id: "bronze_body", name: "Bronze Body", materialClass: "gear", healAmount: 0, freshnessDecaySec: 0, baseValue: 120, tradeable: true },
  { id: "bronze_legs", name: "Bronze Legs", materialClass: "gear", healAmount: 0, freshnessDecaySec: 0, baseValue: 80, tradeable: true },
  { id: "iron_helm", name: "Iron Helm", materialClass: "gear", healAmount: 0, freshnessDecaySec: 0, baseValue: 160, tradeable: true },
  { id: "iron_body", name: "Iron Body", materialClass: "gear", healAmount: 0, freshnessDecaySec: 0, baseValue: 320, tradeable: true },
  { id: "iron_legs", name: "Iron Legs", materialClass: "gear", healAmount: 0, freshnessDecaySec: 0, baseValue: 210, tradeable: true },
  // Misc
  { id: "rope", name: "Rope", materialClass: "misc", healAmount: 0, freshnessDecaySec: 0, baseValue: 18, tradeable: true },
  { id: "courier_token", name: "Courier Token", materialClass: "misc", healAmount: 0, freshnessDecaySec: 0, baseValue: 100, tradeable: false },
  { id: "lantern", name: "Lantern", materialClass: "misc", healAmount: 0, freshnessDecaySec: 0, baseValue: 80, tradeable: true },
  // Rares / gems
  { id: "birds_nest", name: "Bird's Nest", materialClass: "rare", healAmount: 0, freshnessDecaySec: 0, baseValue: 50, tradeable: true },
  { id: "uncut_sapphire", name: "Uncut Sapphire", materialClass: "gem", healAmount: 0, freshnessDecaySec: 0, baseValue: 150, tradeable: true },
  { id: "uncut_emerald", name: "Uncut Emerald", materialClass: "gem", healAmount: 0, freshnessDecaySec: 0, baseValue: 300, tradeable: true },
  { id: "uncut_ruby", name: "Uncut Ruby", materialClass: "gem", healAmount: 0, freshnessDecaySec: 0, baseValue: 600, tradeable: true },
  { id: "ancient_bark", name: "Ancient Bark", materialClass: "rare", healAmount: 0, freshnessDecaySec: 0, baseValue: 400, tradeable: true },
  { id: "shadow_fragment", name: "Shadow Fragment", materialClass: "rare", healAmount: 0, freshnessDecaySec: 0, baseValue: 500, tradeable: true },
  { id: "beast_sinew", name: "Beast Sinew", materialClass: "slayer", healAmount: 0, freshnessDecaySec: 0, baseValue: 80, tradeable: true },
];

const ZONES_RAW: Array<{ id: string; danger: number; richness: number; travelTimeSec: number; unlockBundleId: string | null; ambientEnemyId: string | null }> = [
  { id: "meadowrest", danger: 0, richness: 1000, travelTimeSec: 0, unlockBundleId: null, ambientEnemyId: null },
  { id: "bramblewood", danger: 10, richness: 1150, travelTimeSec: 120, unlockBundleId: "prospectors_bundle", ambientEnemyId: "thornwretch" },
  { id: "ashen_delve", danger: 25, richness: 1300, travelTimeSec: 300, unlockBundleId: "deep_road_bundle", ambientEnemyId: "shade_crawler" },
];

const ENEMIES_RAW: Array<{ id: string; zoneId: string; damagePerHit: number; hitIntervalSeconds: number }> = [
  { id: "thornwretch", zoneId: "bramblewood", damagePerHit: 3, hitIntervalSeconds: 12 },
  { id: "shade_crawler", zoneId: "ashen_delve", damagePerHit: 7, hitIntervalSeconds: 10 },
];

// Build GAME_DATA
const nodesById: Record<string, NodeData> = {};
for (const n of NODES_RAW) nodesById[n.id] = n;

const itemsById: Record<string, ItemData> = {};
for (const i of ITEMS_RAW) itemsById[i.id] = i;

const healMap: Record<string, number> = {};
for (const i of ITEMS_RAW) if (i.healAmount > 0) healMap[i.id] = i.healAmount;

const enemyByZone: Record<string, typeof ENEMIES_RAW[number]> = {};
for (const e of ENEMIES_RAW) enemyByZone[e.zoneId] = e;

const zonesById: Record<string, ZoneData> = {};
for (const z of ZONES_RAW) {
  const enemy = enemyByZone[z.id];
  const threat: ZoneThreat | null = enemy
    ? { zoneId: z.id as ZoneId, danger: z.danger, ambientEnemyId: enemy.id, damagePerHit: enemy.damagePerHit, hitIntervalSeconds: enemy.hitIntervalSeconds }
    : null;
  zonesById[z.id] = { id: z.id as ZoneId, danger: z.danger, richness: z.richness, travelTimeSec: z.travelTimeSec, threat, unlockBundleId: z.unlockBundleId };
}

const RECIPES_RAW: Array<{ id: string; skill: string; levelReq: number; inputs: Array<{ itemId: string; qty: number }>; output: { itemId: string; qty: number }; actionTimeSec: number; xpPerAction: number; masteryXpPerAction: number; blueprintRequired: boolean }> = [];
// Recipes are not needed by edge functions (they only resolve gathering / offline progress)

const recipesById: Record<string, RecipeData> = {};
for (const r of RECIPES_RAW as RecipeData[]) recipesById[r.id] = r;

export const GAME_DATA: GameData = {
  nodes: nodesById,
  items: itemsById,
  recipes: recipesById,
  zones: zonesById,
  healMap,
};
