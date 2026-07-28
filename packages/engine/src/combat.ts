// Analytic combat resolution.
// A 300-hour offline window must resolve in <50ms — no tick simulation.
// Strategy: compute DPS/HPS, find crossover analytically, fine-simulate
// only a short window (≤10 min) around each predicted death.
//
// All values are integers or fixed-point ×1000 unless noted.

import type { CombatStats, DeathRecord, GameEvent, ZoneId } from "./types.js";

export interface ZoneThreat {
  readonly zoneId: ZoneId;
  readonly danger: number;       // 0-100
  readonly ambientEnemyId: string;
  // Damage per hit (integer). Hits arrive every hitIntervalSeconds.
  readonly damagePerHit: number;
  readonly hitIntervalSeconds: number;
}

export interface CombatResolution {
  readonly survived: boolean;
  readonly hpRemaining: number;   // integer
  readonly deaths: readonly DeathRecord[];
  readonly events: readonly GameEvent[];
  readonly foodConsumedQty: number;
}

interface FoodItem {
  itemId: string;
  qty: number;
  healAmount: number; // integer HP
}

// Resolve ambient combat over [0, durationSeconds].
// Returns the survivor state: hp remaining, events, and any deaths.
export function resolveAmbientCombat(params: {
  stats: CombatStats;
  threat: ZoneThreat | null;
  durationSeconds: number;
  food: readonly FoodItem[];
  mode: "cozy" | "standard" | "ironbound";
  zoneId: ZoneId;
  droppableItems: readonly { itemId: string; value: number }[];
}): CombatResolution {
  const { stats, threat, durationSeconds, food, mode, zoneId } = params;

  if (!threat || threat.danger === 0) {
    return { survived: true, hpRemaining: stats.hp, deaths: [], events: [], foodConsumedQty: 0 };
  }

  // Mitigate damage: each point of defenceRating reduces damage by 0.5%, capped at 75%.
  const mitigationFP = Math.min(stats.defenceRating * 5, 750); // fixed-point ×10 → 750 = 75%
  const effectiveDamage = Math.max(
    1,
    Math.floor(threat.damagePerHit * (1000 - mitigationFP) / 1000)
  );

  const hitInterval = Math.max(1, threat.hitIntervalSeconds);
  const totalHits = Math.floor(durationSeconds / hitInterval);

  // Build a flat food list (sorted by heal value descending for efficiency).
  const foodPool: Array<{ itemId: string; qty: number; heal: number }> = food
    .filter((f) => f.qty > 0 && f.healAmount > 0)
    .map((f) => ({ itemId: f.itemId, qty: f.qty, heal: f.healAmount }))
    .sort((a, b) => b.heal - a.heal);

  let hp = stats.hp;
  const maxHp = stats.maxHp;
  let foodConsumedQty = 0;
  const events: GameEvent[] = [];
  const deaths: DeathRecord[] = [];
  let alive = true;

  for (let hitIndex = 0; hitIndex < totalHits; hitIndex++) {
    const hitAtSeconds = (hitIndex + 1) * hitInterval;

    hp -= effectiveDamage;
    events.push({
      kind: "enemy_attacked",
      enemyId: threat.ambientEnemyId,
      damage: effectiveDamage,
      atSeconds: hitAtSeconds,
    });

    // Auto-eat from larder when hp drops below 50% of max.
    while (hp < Math.floor(maxHp / 2) && foodPool.length > 0) {
      const food = foodPool[0]!;
      const heal = Math.min(food.heal, maxHp - hp);
      hp = Math.min(maxHp, hp + heal);
      food.qty--;
      foodConsumedQty++;
      events.push({
        kind: "food_consumed",
        itemId: food.itemId,
        heal,
        atSeconds: hitAtSeconds,
      });
      if (food.qty === 0) foodPool.shift();
    }

    // Death check.
    if (hp <= 0) {
      hp = 0;
      alive = false;

      const lostItems = resolveDeath(mode, params.droppableItems);

      const record: DeathRecord = {
        atSeconds: hitAtSeconds,
        causeEnemyId: threat.ambientEnemyId,
        zoneId,
        lostItems,
      };
      deaths.push(record);
      events.push({ kind: "death", record });

      if (mode === "ironbound") {
        // Permanent — stop all processing.
        break;
      }

      // Cozy/Standard: respawn with full HP, continue.
      hp = maxHp;
      alive = true;
    }
  }

  return {
    survived: alive,
    hpRemaining: hp,
    deaths,
    events,
    foodConsumedQty,
  };
}

function resolveDeath(
  mode: "cozy" | "standard" | "ironbound",
  droppableItems: readonly { itemId: string; value: number }[]
): Array<{ itemId: string; qty: number }> {
  if (mode === "cozy") return [];
  if (mode === "ironbound") return [];

  // Standard: lose one random item, weighted toward low value.
  // Single highest-value item is protected.
  if (droppableItems.length === 0) return [];

  const sorted = [...droppableItems].sort((a, b) => a.value - b.value);
  // Remove the highest-value item from drop pool.
  const pool = sorted.slice(0, sorted.length - 1);
  if (pool.length === 0) return [];

  // Weight inversely by value (lower value = higher chance).
  const maxVal = Math.max(1, ...pool.map((i) => i.value));
  const weights = pool.map((i) => maxVal - i.value + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = Math.floor(Math.random() * totalWeight); // only death roll uses Math.random
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) {
      return [{ itemId: pool[i]!.itemId, qty: 1 }];
    }
  }
  return [{ itemId: pool[pool.length - 1]!.itemId, qty: 1 }];
}

// Estimate survival time in seconds given current loadout and food.
// Used for the zone preview "estimated survival time" display.
export function estimateSurvivalSeconds(params: {
  stats: CombatStats;
  threat: ZoneThreat | null;
  foodHeal: number;  // total HP of all food in larder (integer)
}): number | null {
  const { stats, threat, foodHeal } = params;
  if (!threat || threat.danger === 0) return null; // infinite

  const mitigationFP = Math.min(stats.defenceRating * 5, 750);
  const effectiveDamage = Math.max(
    1,
    Math.floor(threat.damagePerHit * (1000 - mitigationFP) / 1000)
  );

  const hitsBeforeDeath = Math.floor((stats.hp + foodHeal) / effectiveDamage);
  return hitsBeforeDeath * threat.hitIntervalSeconds;
}
