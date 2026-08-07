import type { BuffId, ControlId, DebuffId, DotId, StatusId } from './types';

export interface DotSpec {
  label: string;
  perStack: [number, number, number]; // damage at stack 1/2/3
  duration: number;
  scaling?: 'speed' | 'miss'; // frostbite reduces speed, shock adds miss chance
}

export const DOT_TABLE: Record<DotId, DotSpec> = {
  poison: { label: 'Poison', perStack: [4, 8, 14], duration: 3 },
  burn: { label: 'Burn', perStack: [5, 10, 16], duration: 2 },
  bleed: { label: 'Bleed', perStack: [4, 8, 14], duration: 4 },
  curse: { label: 'Curse', perStack: [6, 12, 20], duration: 3 },
  frostbite: { label: 'Frostbite', perStack: [3, 6, 10], duration: 3, scaling: 'speed' },
  shock_dot: { label: 'Shock', perStack: [4, 8, 12], duration: 2, scaling: 'miss' },
};

export const CONTROL_LABELS: Record<ControlId, string> = {
  sleep: 'Sleep — skips turn, breaks on damage',
  fear: 'Fear — 40% chance to skip turn',
  silence: 'Silence — cannot use skills',
  blind: 'Blind — accuracy -30%',
  confuse: 'Confuse — 50% chance to attack self/ally',
  stun: 'Stun — skips next turn',
  root: 'Root — cannot flee, speed halved',
};

export const BUFF_LABELS: Record<BuffId, string> = {
  focus: 'Focus — Magic Attack +20%',
  barrier: 'Barrier — absorbs incoming damage',
  regeneration: 'Regeneration — heal 5% max HP/turn',
  fortify: 'Fortify — Defense +30%',
  blessing: 'Blessing — Sacred damage +25%',
  haste: 'Haste — Speed +25%',
  reflection: 'Reflection — reflects 25% damage taken',
  brace: 'Brace — Guard blocks 20% more damage',
  echo_surge: 'Echo Surge — all damage +20%',
};

export const DEBUFF_LABELS: Record<DebuffId, string> = {
  weakness: 'Weakness — Attack -20%',
  defense_down: 'Defense Down — Defense -30%',
  slow: 'Slow — Speed -25%',
  armour_break: 'Armour Break — Defense -50%',
  seal_mind: 'Seal Mind — cannot gain Momentum',
  fragile_perception: 'Fragile Perception — Doubles Momentum gain; Resonance abilities cost 2 Resonance',
  exhausted: 'Exhausted — next round starts with 1 less AP',
};

export function statusLabel(id: StatusId): string {
  if (id in DOT_TABLE) return DOT_TABLE[id as DotId].label;
  if (id in CONTROL_LABELS) return CONTROL_LABELS[id as ControlId];
  if (id in BUFF_LABELS) return BUFF_LABELS[id as BuffId];
  return DEBUFF_LABELS[id as DebuffId] ?? id;
}

export const DEFAULT_BARRIER_AMOUNT = 25;
