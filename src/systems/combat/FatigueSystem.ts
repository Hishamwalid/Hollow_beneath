export interface FatiguePenalty {
  accuracyMult: number;
  damageMult: number;
  apPenalty: number;
  skipChance: number;
}

export function fatiguePenalty(value: number): FatiguePenalty {
  if (value >= 76) return { accuracyMult: 0.6, damageMult: 0.6, apPenalty: 2, skipChance: 0.3 };
  if (value >= 51) return { accuracyMult: 0.8, damageMult: 0.8, apPenalty: 1, skipChance: 0 };
  if (value >= 26) return { accuracyMult: 0.9, damageMult: 0.9, apPenalty: 0, skipChance: 0 };
  return { accuracyMult: 1, damageMult: 1, apPenalty: 0, skipChance: 0 };
}

export function clampFatigue(value: number): number {
  return Math.max(0, Math.min(100, value));
}