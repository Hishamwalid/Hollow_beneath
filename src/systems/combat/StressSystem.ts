import type { StressBand } from '@data/types';

/**
 * Phase 5: hybrid stress model.
 * The baseline is HP loss ((1 - hp%) * 100), but player behaviour nudges it:
 * aggression (offensive momentum, weakness spam, momentum triggers) pushes the
 * boss toward high/critical bands; caution (guarding, analyzing) calms it.
 * This creates the risk/reward loop: aggressive players escalate the boss
 * faster — and reap the desperate-phase payoff (30% extra damage at the cost
 * of 30% of its defense).
 */
export const STRESS_BANDS: Record<StressBand, { min: number; label: string }> = {
  low: { min: 0, label: 'CALM' },
  medium: { min: 31, label: 'STRAINED' },
  high: { min: 61, label: 'DESPERATE' },
  critical: { min: 81, label: 'BERSERK' },
};

export const STRESS_BAND_ORDER: StressBand[] = ['low', 'medium', 'high', 'critical'];

export function stressFor(hpPct: number, aggression: number, calm: number): number {
  const hpPart = (1 - hpPct) * 100;
  return Math.max(0, Math.min(100, Math.round(hpPart + aggression * 2 - calm * 2)));
}

export function bandFor(stress: number): StressBand {
  if (stress >= 81) return 'critical';
  if (stress >= 61) return 'high';
  if (stress >= 31) return 'medium';
  return 'low';
}

export function bandLabel(band: StressBand): string {
  return STRESS_BANDS[band].label;
}

/** How much a behaviour type pushes the gauge. */
export const AGGRESSION_WEIGHT = {
  hit: 1,          // any damaging strike
  weakness: 1,     // weakness abuse
  momentum: 2,     // spending a momentum trigger
  adaptation: 3,   // a boss learning a counter adds pressure
} as const;

export const CALM_WEIGHT = {
  guard: 1,
  analyze: 1,
  focus: 1,
} as const;
