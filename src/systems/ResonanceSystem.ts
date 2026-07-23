import type { ResonanceTier } from '@data/types';

export const RESONANCE_THRESHOLDS = [25, 50, 75];

export function resonanceTier(value: number): ResonanceTier {
  if (value >= 75) return 'transcendent';
  if (value >= 50) return 'unmoored';
  if (value >= 25) return 'awakened';
  return 'stable';
}

export const TIER_LABELS: Record<ResonanceTier, string> = {
  stable: 'Stable',
  awakened: 'Awakened',
  unmoored: 'Unmoored',
  transcendent: 'Transcendent',
};

export const TIER_DESCRIPTIONS: Record<ResonanceTier, string> = {
  stable: 'The world holds still. Nothing extra to see, nothing extra watching back.',
  awakened: 'Faint pattern-recognition — you start noticing the seams in things.',
  unmoored: 'The UI warps at the edges. You perceive one extra node ahead. Enemies are tougher; faction options shift.',
  transcendent: 'Persistent distortion. Resonance Abilities unlocked, +30% damage to non-bosses — but enemies scale hard, and some endings lock shut.',
};

/** Enemy HP multiplier from the player's current Resonance tier (GDD 4.5). */
export function resonanceEnemyHpMultiplier(resonance: number): number {
  const tier = resonanceTier(resonance);
  if (tier === 'unmoored') return 1.15;
  if (tier === 'transcendent') return 1.25;
  return 1.0;
}

/** Enemy ATK multiplier from Resonance tier (Transcendent only, per GDD). */
export function resonanceEnemyAtkMultiplier(resonance: number): number {
  return resonanceTier(resonance) === 'transcendent' ? 1.25 : 1.0;
}

/** Player's own damage bonus vs non-boss enemies at Transcendent tier. */
export function resonancePlayerDamageBonus(resonance: number): number {
  return resonanceTier(resonance) === 'transcendent' ? 1.3 : 1.0;
}

export function clampResonance(value: number): number {
  return Math.max(0, Math.min(100, value));
}
