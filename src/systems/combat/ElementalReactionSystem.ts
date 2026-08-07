/**
 * Elemental Reactions (Phase 3b).
 * Tracks the last damage type that landed on each enemy (skips absorbed/resisted hits);
 * when the NEXT hit uses a different type, the ordered pair is checked and the reaction fires.
 * Same-type re-hits do not consume the pair. 8 of the 10 doc sequences are implementable
 * with our type-lock (Decaying Haunt / Reality Fracture need Natures/Spirits/Chaos).
 */

import type { DamageType, StatusId } from '@data/types';

export type ReactionId =
  | 'thermal_shock'
  | 'conductive_freeze'
  | 'plasma_burst'
  | 'void_collapse'
  | 'crimson_eclipse'
  | 'rending_wounds'
  | 'shattered_guard'
  | 'crushing_point';

export interface ReactionDef {
  id: ReactionId;
  label: string;
  from: DamageType;
  to: DamageType;
  description: string;
  /** Multiplies the triggering hit's damage. */
  damageMult?: number;
  /** Status (id, turns) inflicted on the target. */
  status?: { id: StatusId; turns: number };
  /** Damage dealt to all OTHER enemies, as % of the triggering hit's damage. */
  splashPct?: number;
  /** Strips all enemy buffs. */
  stripBuffs?: boolean;
  /** Ignores this fraction of the target's defense on the triggering hit. */
  armorPierce?: number;
  /** Speed-down turns for Conductive Freeze (spdSlow applied via status for now). */
  spdSlow?: number;
}

export const ELEMENTAL_REACTIONS: Record<ReactionId, ReactionDef> = {
  thermal_shock: {
    id: 'thermal_shock',
    label: 'Thermal Shock',
    from: 'flame',
    to: 'frost',
    description: 'Flame into Frost — explosive crystallisation. +50% damage and stuns the target.',
    damageMult: 1.5,
    status: { id: 'stun', turns: 1 },
  },
  conductive_freeze: {
    id: 'conductive_freeze',
    label: 'Conductive Freeze',
    from: 'frost',
    to: 'shock',
    description: 'Frost into Shock: the frozen body conducts currents. Speed -40% for 2 turns.',
    spdSlow: 2,
  },
  plasma_burst: {
    id: 'plasma_burst',
    label: 'Plasma Burst',
    from: 'shock',
    to: 'flame',
    description: 'Shock into Flame: the air ignites. 30% of the damage arcs to every other enemy.',
    splashPct: 30,
  },
  void_collapse: {
    id: 'void_collapse',
    label: 'Void Collapse',
    from: 'sacred',
    to: 'shadow',
    description: 'Sacred into Shadow: the light inverts and collapses. Strips all buffs and saps 20% of the target\'s stats for 2 turns.',
    stripBuffs: true,
    status: { id: 'weakness', turns: 2 },
    damageMult: 1.2,
  },
  crimson_eclipse: {
    id: 'crimson_eclipse',
    label: 'Crimson Eclipse',
    from: 'shadow',
    to: 'sacred',
    description: 'Shadow into Sacred: a single blooming eclipse. 3.0x damage.',
    damageMult: 3.0,
  },
  rending_wounds: {
    id: 'rending_wounds',
    label: 'Rending Wounds',
    from: 'pierce',
    to: 'slash',
    description: 'Pierce into Slash: the wound is torn wider. Bleed 10 for 3 turns.',
    status: { id: 'bleed', turns: 3 },
    damageMult: 1.1,
  },
  shattered_guard: {
    id: 'shattered_guard',
    label: 'Shattered Guard',
    from: 'slash',
    to: 'blunt',
    description: 'Slash into Blunt: the shield splinters. Defense -50% for 3 turns.',
    status: { id: 'armour_break', turns: 3 },
  },
  crushing_point: {
    id: 'crushing_point',
    label: 'Crushing Point',
    from: 'blunt',
    to: 'pierce',
    description: 'Blunt into Pierce: the armor cracks at a single point. Ignores 50% of defense on the triggering hit.',
    armorPierce: 0.5,
  },
};

export type ReactionResult = ReactionDef & { damageMult: number };

/** Resolve the reaction for a given ordered pair, if any. */
export function resolveReaction(from: DamageType, to: DamageType): ReactionResult | null {
  const def = Object.values(ELEMENTAL_REACTIONS).find((r) => r.from === from && r.to === to);
  if (!def) return null;
  return { ...def, damageMult: def.damageMult ?? 1 };
}