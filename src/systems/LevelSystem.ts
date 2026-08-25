/**
 * Leveling math. Thresholds are CUMULATIVE lifetime XP, built from
 * per-level increments so pacing stretches across the whole descent:
 *   increment(k) = 25 + 7(k−1) + 0.35(k−1)²   (cost of level k → k+1)
 * Total to reach the cap (15) ≈ 1,440 XP — a full successful run's worth,
 * instead of the old curve that capped players before chapter 3.
 */
export function xpIncrementForLevel(k: number): number {
  if (k <= 0) return 0;
  return Math.round(25 + 7 * (k - 1) + 0.35 * (k - 1) ** 2);
}

/** Cumulative lifetime XP required to REACH level n. */
export function xpForLevel(n: number): number {
  let total = 0;
  for (let k = 1; k < n; k++) total += xpIncrementForLevel(k);
  return total;
}

export interface LevelUpResult {
  newLevel: number;
  levelsGained: number;
}

export function computeLevelUp(currentXp: number, currentLevel: number): LevelUpResult {
  let level = currentLevel;
  let gained = 0;
  while (level < MAX_LEVEL && xpForLevel(level + 1) <= currentXp) {
    level++;
    gained++;
  }
  return { newLevel: level, levelsGained: gained };
}

export const MAX_LEVEL = 15;

/** XP still needed for the next level (for UI display). */
export function xpToNext(level: number, currentXp: number): number {
  if (level >= MAX_LEVEL) return 0;
  return Math.max(0, xpForLevel(level + 1) - currentXp);
}
