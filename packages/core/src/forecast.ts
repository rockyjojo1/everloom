import { deterministicRollPpm, deterministicRange } from "./rng";
import type { GameSave } from "./types";

export interface ExpeditionForecast {
  readonly maxDurationMs: number;
  readonly estimatedLogsMin: number;
  readonly estimatedLogsMax: number;
  readonly estimatedWoodcuttingXpMin: number;
  readonly estimatedWoodcuttingXpMax: number;
  readonly encounterRiskPercent: number;
  readonly estimatedFoodUsageMin: number;
  readonly estimatedFoodUsageMax: number;
  readonly estimatedDamageMin: number;
  readonly estimatedDamageMax: number;
  readonly retreatHealthThreshold: number;
  readonly currentFoodSupply: number;
  readonly warnings: readonly string[];
}

// Configuration constants (must match expedition.ts)
const GATHERING_WINDOW_MS = 30_000;
const ENCOUNTER_CHANCE_PPM = 150_000;
const LOGS_PER_WINDOW = 1;
const WOODCUTTING_XP_PER_LOG = 25;
const WOLF_DAMAGE_MIN = 8;
const WOLF_DAMAGE_MAX = 12;
const FOOD_CONSUMPTION_MS = 120_000;
const RETREAT_HEALTH_THRESHOLD = 5;

export function forecastExpedition(
  save: GameSave,
  requestedDurationMs: number,
): ExpeditionForecast {
  const maxDurationMs = Math.max(5000, Math.min(3600000, requestedDurationMs));
  const windowCount = Math.ceil(maxDurationMs / GATHERING_WINDOW_MS);
  const encounterRiskPercent = Math.round((ENCOUNTER_CHANCE_PPM / 1_000_000) * 100);

  // Conservative estimates
  const estimatedLogsMin = Math.max(1, Math.floor(windowCount * 0.7)); // assume some combat interruption
  const estimatedLogsMax = windowCount; // assume no combat
  const estimatedWoodcuttingXpMin = estimatedLogsMin * WOODCUTTING_XP_PER_LOG;
  const estimatedWoodcuttingXpMax = estimatedLogsMax * WOODCUTTING_XP_PER_LOG;

  const estimatedFoodUsageMin = Math.max(0, Math.floor(maxDurationMs / FOOD_CONSUMPTION_MS));
  const estimatedFoodUsageMax = Math.ceil(maxDurationMs / FOOD_CONSUMPTION_MS);

  const estimatedEncounters = Math.round(windowCount * (ENCOUNTER_CHANCE_PPM / 1_000_000));
  const estimatedDamageMin = estimatedEncounters * WOLF_DAMAGE_MIN;
  const estimatedDamageMax = estimatedEncounters * WOLF_DAMAGE_MAX;

  const currentFood = countFoodSupply(save.inventory);
  const warnings: string[] = [];

  if (currentFood === 0) {
    warnings.push("No food in inventory. Expedition will end immediately due to hunger.");
  } else if (currentFood < estimatedFoodUsageMax) {
    warnings.push(`Food supply (${currentFood}) may not sustain full expedition (needs ${estimatedFoodUsageMax})`);
  }

  if (save.player.hp <= estimatedDamageMax + RETREAT_HEALTH_THRESHOLD) {
    warnings.push("Current health may not survive wolf encounters. Heal before starting.");
  }

  const freeSlots = save.inventorySlots - save.inventory.length;
  if (freeSlots < estimatedLogsMin) {
    warnings.push(`Insufficient inventory space (${freeSlots} free) for expected logs (${estimatedLogsMin}-${estimatedLogsMax})`);
  }

  return {
    maxDurationMs,
    estimatedLogsMin,
    estimatedLogsMax,
    estimatedWoodcuttingXpMin,
    estimatedWoodcuttingXpMax,
    encounterRiskPercent,
    estimatedFoodUsageMin,
    estimatedFoodUsageMax,
    estimatedDamageMin,
    estimatedDamageMax,
    retreatHealthThreshold: RETREAT_HEALTH_THRESHOLD,
    currentFoodSupply: currentFood,
    warnings,
  };
}

function countFoodSupply(inventory: readonly { readonly itemId: string; readonly quantity: number }[]): number {
  const food = inventory.find((s) => s.itemId === "food-bread");
  return food?.quantity ?? 0;
}
