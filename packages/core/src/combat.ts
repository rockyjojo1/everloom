import { levelFromXp } from "./progression";
import { PROBABILITY_SCALE, type ContentBundle, type GameSave, type PlayerCombatStats } from "./types";

const MIN_HIT_CHANCE_PPM = 100_000;
const MAX_HIT_CHANCE_PPM = 950_000;

/**
 * Returns the player's live combat profile from persisted skill XP and equipped
 * item definitions. Nothing is cached in the save, so imported and migrated
 * saves can never retain stale derived statistics.
 */
export function playerCombatStats(state: GameSave, content: ContentBundle): PlayerCombatStats {
  const level = levelFromXp(state.skills.melee.xp);
  let accuracyBonus = 0;
  let strengthBonus = 0;
  let defenceBonus = 0;

  for (const itemId of Object.values(state.equipment)) {
    if (!itemId) continue;
    const bonuses = content.items[itemId]?.combatBonuses;
    if (!bonuses) continue;
    accuracyBonus += bonuses.accuracy;
    strengthBonus += bonuses.strength;
    defenceBonus += bonuses.defence;
  }

  return {
    level,
    accuracy: 12 + level * 3 + accuracyBonus,
    maxHit: Math.max(1, 2 + Math.floor(level / 4) + strengthBonus),
    defence: 10 + level * 2 + defenceBonus,
  };
}

/** Integer-only opposed rating used by live and offline combat. */
export function combatHitChancePpm(accuracy: number, evasion: number): number {
  const safeAccuracy = Math.max(0, Math.floor(accuracy));
  const safeEvasion = Math.max(0, Math.floor(evasion));
  if (safeAccuracy === 0) return MIN_HIT_CHANCE_PPM;
  const opposed = Math.floor(safeAccuracy * PROBABILITY_SCALE / Math.max(1, safeAccuracy + safeEvasion));
  return Math.max(MIN_HIT_CHANCE_PPM, Math.min(MAX_HIT_CHANCE_PPM, opposed));
}
