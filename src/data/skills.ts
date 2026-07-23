import type { ActionId, SkillDef } from './types';

/** AP cost for the seven fixed combat actions (GDD 5.1). 'skill' cost comes from the SkillDef chosen. */
export const ACTION_AP_COST: Record<ActionId, number> = {
  attack: 1,
  skill: 1,
  resonance_ability: 2,
  guard: 1,
  use_item: 1,
  analyze: 1,
  sunder: 2,
  withdraw: 1,
};

export const ACTION_LABELS: Record<ActionId, string> = {
  attack: 'Attack',
  skill: 'Skill',
  resonance_ability: 'Resonance Ability',
  guard: 'Guard',
  use_item: 'Use Item',
  analyze: 'Analyze',
  sunder: 'Sunder',
  withdraw: 'Withdraw',
};

/**
 * Named skills earned from events and bosses. Most are passive hooks checked by id
 * in CombatEngine (tag field); a few (martyrs_flame) are active attacks.
 */
export const NAMED_SKILLS: Record<string, SkillDef> = {
  chorus_step: {
    id: 'chorus_step',
    name: 'Chorus Step',
    apCost: 0,
    description: 'Passive. +10% Dodge for the rest of the run.',
    tag: 'passive_dodge_10',
  },
  unfinished_sentence: {
    id: 'unfinished_sentence',
    name: 'Unfinished Sentence',
    apCost: 0,
    description: 'Passive. The first killing blow each run instead leaves you at 1 HP.',
    tag: 'passive_death_ward',
  },
  loom_touched: {
    id: 'loom_touched',
    name: 'Loom-Touched',
    apCost: 0,
    description: 'Passive. Shadow damage dealt +30%. Max HP -10%.',
    tag: 'passive_shadow_boost',
  },
  librarians_eye: {
    id: 'librarians_eye',
    name: "Librarian's Eye",
    apCost: 0,
    description: 'Passive. Analyze reveals two weaknesses instead of one.',
    tag: 'passive_analyze_double',
  },
  martyrs_flame: {
    id: 'martyrs_flame',
    name: "Martyr's Flame",
    apCost: 2,
    damageType: 'sacred',
    skillPower: 1.6,
    description: 'Sacred AoE. Costs 10 HP to cast.',
    tag: 'active_martyrs_flame',
  },
  archival_insight: {
    id: 'archival_insight',
    name: 'Archival Insight',
    apCost: 0,
    description: 'Passive. +10% XP and Echo Shards gained.',
    tag: 'passive_archive_bonus',
  },
  chorus_echo: {
    id: 'chorus_echo',
    name: 'Chorus Echo',
    apCost: 0,
    description: 'Passive. Start every combat with 1 Momentum.',
    tag: 'passive_start_momentum',
  },
  sealing_strike: {
    id: 'sealing_strike',
    name: 'Sealing Strike',
    apCost: 1,
    damageType: 'sacred',
    skillPower: 1.1,
    description: 'A Sable rite turned to combat use. -2 Resonance on hit.',
    tag: 'active_sealing_strike',
  },
};
