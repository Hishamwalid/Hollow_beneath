export function xpForLevel(n: number): number {
  if (n <= 1) return 0;
  return Math.round(50 + 10 * (n - 1) + 0.5 * (n - 1) ** 2);
}

export interface LevelUpResult {
  newLevel: number;
  levelsGained: number;
}

export function computeLevelUp(currentXp: number, currentLevel: number): LevelUpResult {
  let level = currentLevel;
  let gained = 0;
  while (xpForLevel(level + 1) <= currentXp) {
    level++;
    gained++;
  }
  return { newLevel: level, levelsGained: gained };
}

export const MAX_LEVEL = 15;
