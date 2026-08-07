/**
 * Combo Tags (Phase 3c).
 * Every player action contributes an ordered list of action tags. The engine keeps the
 * last 3 actions' tag sets; when a new tag-set is pushed, each of the 8 doc sequences is
 * tested positionally (sequence tag i must appear somewhere in history action i's set).
 * Executing a combo grants +2 tokens (engine.executeCombo) plus a combo-specific effect.
 */

import type { ActionTag } from '@data/types';

export type ComboEffectId =
  | 'expose_truth' // resistances -> 1.0 for 2 turns
  | 'memory_collapse' // momentum gain x2 for 3 turns
  | 'rending_wounds' // bleed 15, 4 turns
  | 'hunters_kill' // 3.0x vs marked
  | 'shattered_reality' // strip enemy buffs
  | 'eclipse' // 2.5x, ignore 50% def
  | 'perfect_riposte' // free +50% attack immediately
  | 'full_knowledge'; // reveal all + open window

export interface ComboDef {
  id: string;
  label: string;
  sequence: [ActionTag, ActionTag, ActionTag];
  effect: ComboEffectId;
  description: string;
}

export const COMBO_TABLE: ComboDef[] = [
  {
    id: 'expose_truth',
    label: 'Expose Truth',
    sequence: ['Strike', 'Break', 'Sacred'],
    effect: 'expose_truth',
    description: 'Resistances collapse to neutral for 2 turns.',
  },
  {
    id: 'memory_collapse',
    label: 'Memory Collapse',
    sequence: ['Analyze', 'Shock', 'Shadow'],
    effect: 'memory_collapse',
    description: 'The pattern folds in on itself — you gain Momentum twice as fast for 3 turns.',
  },
  {
    id: 'rending_wounds',
    label: 'Rending Wounds',
    sequence: ['Strike', 'Pierce', 'Slash'],
    effect: 'rending_wounds',
    description: 'Bleed 15 for 4 turns.',
  },
  {
    id: 'hunters_kill',
    label: "Hunter's Kill",
    sequence: ['Mark', 'Pierce', 'Strike'],
    effect: 'hunters_kill',
    description: '3.0x damage against a Marked enemy.',
  },
  {
    id: 'shattered_reality',
    label: 'Shattered Reality',
    sequence: ['Break', 'Physical', 'Elemental'],
    effect: 'shattered_reality',
    description: 'Every enemy buff is stripped.',
  },
  {
    id: 'eclipse',
    label: 'Eclipse',
    sequence: ['Sacred', 'Shadow', 'Sacred'],
    effect: 'eclipse',
    description: '2.5x damage, ignoring 50% defense.',
  },
  {
    id: 'perfect_riposte',
    label: 'Perfect Riposte',
    sequence: ['Guard', 'Counter', 'Strike'],
    effect: 'perfect_riposte',
    description: 'A free counter-strike deals +50% damage immediately.',
  },
  {
    id: 'full_knowledge',
    label: 'Full Knowledge',
    sequence: ['Analyze', 'Analyze', 'Break'],
    effect: 'full_knowledge',
    description: 'Every enemy is fully revealed and a weakness window opens.',
  },
];

/**
 * Test the history (last 3 action tag-sets) against every combo sequence.
 * Returns the matched combo, or null.
 */
export function matchCombo(history: ActionTag[][]): ComboDef | null {
  if (history.length < 3) return null;
  const [a, b, c] = history.slice(-3);
  for (const combo of COMBO_TABLE) {
    const [t1, t2, t3] = combo.sequence;
    if (a.includes(t1) && b.includes(t2) && c.includes(t3)) return combo;
  }
  return null;
}

/** Tag set for the basic Attack action (slash-type strike). */
export const TAGS_ATTACK: ActionTag[] = ['Strike', 'Physical', 'Slash'];

/** Tag set for Sunder. */
export const TAGS_SUNDER: ActionTag[] = ['Break', 'Physical'];

/** Tag set for Analyze / Scan / Probe / Deep Analysis. */
export const TAGS_ANALYZE: ActionTag[] = ['Analyze', 'Knowledge', 'Mental'];

/** Tag set for Guard (Counter added when Retaliation is known). */
export function tagsForGuard(hasRetaliation: boolean): ActionTag[] {
  const tags: ActionTag[] = ['Guard', 'Defense', 'Stance'];
  if (hasRetaliation) tags.push('Counter');
  return tags;
}

/** Tag set for a named skill, from its damage type + optional special tags. */
export function tagsForSkill(skill: {
  damageType?: string;
  tag?: string;
  tags?: ActionTag[];
}): ActionTag[] {
  if (skill.tags?.length) return [...skill.tags];
  const tags: ActionTag[] = [];
  const dt = skill.damageType;
  if (dt) {
    const elemental = ['flame', 'frost', 'shock', 'sacred', 'shadow'];
    const tag = dt.charAt(0).toUpperCase() + dt.slice(1);
    if (elemental.includes(dt)) {
      tags.push('Elemental', tag as ActionTag);
    } else {
      tags.push('Physical', tag as ActionTag);
    }
  }
  return tags;
}
