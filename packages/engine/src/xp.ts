// OSRS XP curve — exact formula, integer arithmetic only.
// Total XP to reach level 99: 13,034,431

// XP required to reach a given level (1-99).
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > 99) return 13_034_431;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += Math.floor(l + 300 * Math.pow(2, l / 7));
  }
  return Math.floor(total / 4);
}

// Cache the full table at module load — tiny array, fast lookups.
const XP_TABLE: readonly number[] = (() => {
  const t: number[] = [0]; // index 0 unused, level starts at 1
  for (let lvl = 1; lvl <= 99; lvl++) {
    t.push(xpForLevel(lvl));
  }
  return t;
})();

// Level from XP (1-99). O(log 99) binary search.
export function levelFromXp(xp: number): number {
  let lo = 1;
  let hi = 99;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((XP_TABLE[mid] ?? Infinity) <= xp) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

// XP table export for client-side display.
export { XP_TABLE };

// Mastery uses a shallower curve: 99 mastery in ~15% of skill-99 time.
// Total mastery XP to reach 99: ~1,955,165 (15% of 13,034,431).
const MASTERY_SCALE = 0.15;

export function masteryXpForLevel(level: number): number {
  return Math.floor(xpForLevel(level) * MASTERY_SCALE);
}

const MASTERY_TABLE: readonly number[] = (() => {
  const t: number[] = [0];
  for (let lvl = 1; lvl <= 99; lvl++) {
    t.push(masteryXpForLevel(lvl));
  }
  return t;
})();

export function masteryLevelFromXp(xp: number): number {
  let lo = 1;
  let hi = 99;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((MASTERY_TABLE[mid] ?? Infinity) <= xp) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

export { MASTERY_TABLE };
