import type { AdaptationId, ProfileView } from '@data/types';

/**
 * Phase 5: adaptation triggers (Ultimate Battle System Part 5.6).
 * Evaluated every 3rd boss turn; the first unmet trigger wins (doc table order),
 * and an already-active adaptation is never re-applied.
 */
export const ADAPTATION_ORDER: AdaptationId[] = [
  'magic_shield',
  'armor_pierce',
  'blind_marksman',
  'unreadable',
  'resonance_drain',
  'elemental_resistance',
  'interdict',
  'dispel_conclave',
  'echo_lock',
];

export const ADAPTATION_META: Record<AdaptationId, { label: string; text: string }> = {
  magic_shield: { label: 'Magic Shield', text: 'counters your dominance in magic — Magic Defense +40%.' },
  armor_pierce: { label: 'Armor Break', text: 'has learned your guard-dependence — its strikes now ignore half your Defense.' },
  blind_marksman: { label: 'Blind Haze', text: 'counters your critical rhythm — you are blinded.' },
  unreadable: { label: 'Hidden Mechanisms', text: 'seals its intentions from your sight.' },
  resonance_drain: { label: 'Resonance Drain', text: 'drinks your momentum with every hit against you.' },
  elemental_resistance: { label: 'Elemental Resistance', text: 'memory hardens — it resists your favourite element.' },
  interdict: { label: 'Interdict', text: 'interdicts your healing — you only restore half as much.' },
  dispel_conclave: { label: 'Dispel Conclave', text: 'concludes against your enhancements — all your buffs are erased.' },
  echo_lock: { label: 'Echo Lock', text: 'echoes your rhythm — repeating an action now costs 1 more AP.' },
};

export function evaluateAdaptation(view: ProfileView, active: AdaptationId[]): AdaptationId | null {
  const has = (id: AdaptationId) => active.includes(id);
  if (!has('magic_shield') && view.magicPct >= 70) return 'magic_shield';
  if (!has('armor_pierce') && view.guardPct >= 30) return 'armor_pierce';
  if (!has('blind_marksman') && view.crits >= 2) return 'blind_marksman';
  if (!has('unreadable') && view.analyzeCount === 0 && view.turns >= 3) return 'unreadable';
  if (!has('resonance_drain') && view.momentumSpends >= 3) return 'resonance_drain';
  if (!has('elemental_resistance') && view.favoriteElement !== null && view.favoriteShare >= 0.6 && view.totalDmg >= 60) return 'elemental_resistance';
  if (!has('interdict') && view.healCount >= 2) return 'interdict';
  if (!has('dispel_conclave') && view.buffsUsed >= 2) return 'dispel_conclave';
  if (!has('echo_lock') && view.repeats >= 2) return 'echo_lock';
  return null;
}