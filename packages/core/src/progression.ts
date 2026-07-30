import type { SkillId } from "./types";

const MAX_SKILL_LEVEL = 100;
const XP_TABLE = buildXpTable();

function buildXpTable(): readonly number[] {
  const table = [0, 0];
  let points = 0;
  for (let level = 1; level < MAX_SKILL_LEVEL; level += 1) {
    points += Math.floor(level + 300 * 2 ** (level / 7));
    table[level + 1] = Math.floor(points / 4);
  }
  return table;
}

export function xpForLevel(level: number): number {
  const normalized = Math.max(1, Math.min(MAX_SKILL_LEVEL, Math.floor(level)));
  return XP_TABLE[normalized] ?? 0;
}

export function levelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let low = 1;
  let high = MAX_SKILL_LEVEL;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (safeXp >= xpForLevel(middle)) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function masteryRankFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 25));
}

export function emptySkills(): Readonly<Record<SkillId, { readonly xp: number }>> {
  return {
    woodcutting: { xp: 0 },
    mining: { xp: 0 },
    fishing: { xp: 0 },
    cooking: { xp: 0 },
    melee: { xp: 0 },
  };
}

/**
 * Meadowrest's post-tutorial gate: every skill must reach this level before the
 * Verdant Loomstone can be approached. A single source of truth so the quest
 * engine, save migration and HUD can never disagree about what "attuned" means.
 */
export const ATTUNEMENT_REQUIRED_LEVEL = 5;

export function countAttunedSkills(
  skills: Readonly<Record<string, { readonly xp: number }>>,
  requiredLevel: number = ATTUNEMENT_REQUIRED_LEVEL,
): number {
  return Object.values(skills).filter((progress) => levelFromXp(progress.xp) >= requiredLevel).length;
}
