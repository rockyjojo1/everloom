import zonesRaw from "./data/zones.json" assert { type: "json" };
import itemsRaw from "./data/items.json" assert { type: "json" };
import recipesRaw from "./data/recipes.json" assert { type: "json" };
import nodesRaw from "./data/nodes.json" assert { type: "json" };
import ledgerRaw from "./data/ledger.json" assert { type: "json" };
import enemiesRaw from "./data/enemies.json" assert { type: "json" };

import type { GameData, ItemData, NodeData, RecipeData, ZoneData } from "@everloom/engine";
import type { ZoneThreat } from "@everloom/engine";
import type { ZoneId } from "@everloom/engine";

// ── Build typed GameData for engine consumption ───────────────

const itemsById: Record<string, ItemData> = {};
for (const item of itemsRaw as ItemData[]) {
  itemsById[item.id] = item;
}

const nodesById: Record<string, NodeData> = {};
for (const node of nodesRaw as NodeData[]) {
  nodesById[node.id] = node;
}

const recipesById: Record<string, RecipeData> = {};
for (const recipe of recipesRaw as RecipeData[]) {
  recipesById[recipe.id] = recipe;
}

const healMap: Record<string, number> = {};
for (const item of itemsRaw as ItemData[]) {
  if (item.healAmount > 0) healMap[item.id] = item.healAmount;
}

// Build zone threats from enemies.
const enemyByZone: Record<string, (typeof enemiesRaw)[number]> = {};
for (const enemy of enemiesRaw) {
  enemyByZone[enemy.zoneId] = enemy;
}

const zonesById: Record<string, ZoneData> = {};
for (const zone of zonesRaw) {
  const enemy = enemyByZone[zone.id];
  const threat: ZoneThreat | null = enemy
    ? {
        zoneId: zone.id as ZoneId,
        danger: zone.danger,
        ambientEnemyId: enemy.id,
        damagePerHit: enemy.damagePerHit,
        hitIntervalSeconds: enemy.hitIntervalSeconds,
      }
    : null;

  zonesById[zone.id] = {
    id: zone.id as ZoneId,
    danger: zone.danger,
    richness: zone.richness,
    travelTimeSec: zone.travelTimeSec,
    threat,
    unlockBundleId: zone.unlockBundleId,
  };
}

export const GAME_DATA: GameData = {
  nodes: nodesById,
  items: itemsById,
  recipes: recipesById,
  zones: zonesById,
  healMap,
};

// ── Raw exports (for UI display) ──────────────────────────────

export const ZONES = zonesRaw;
export const ITEMS = itemsRaw;
export const RECIPES = recipesRaw;
export const NODES = nodesRaw;
export const LEDGER = ledgerRaw;
export const ENEMIES = enemiesRaw;

export type { GameData, ItemData, NodeData, RecipeData, ZoneData };
