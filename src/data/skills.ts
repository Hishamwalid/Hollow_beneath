import type { ActionId, SkillDef } from './types';

/** AP cost for the combat actions (Battle Plan Part 2). 'skill' cost comes from the SkillDef chosen. */
export const ACTION_AP_COST: Record<ActionId, number> = {
  attack: 1,
  skill: 2,
  resonance_ability: 3,
  guard: 1,
  use_item: 1,
  analyze: 1,
  sunder: 2,
  withdraw: 2,
  focus: 1,
  brace: 1,
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
  focus: 'Focus',
  brace: 'Brace',
};

/**
 * Named skills earned from events, bosses, character creation, and discovery.
 * Most are passive hooks checked by id in CombatEngine (tag field); some are active attacks.
 * `tree` is organizational only — there is no separate skill-point-spending system;
 * skills are granted directly by whatever content awards them.
 */
export const NAMED_SKILLS: Record<string, SkillDef> = {
  chorus_step: {
    id: 'chorus_step',
    name: 'Chorus Step',
    apCost: 0,
    description: 'Passive. +10% Dodge for the rest of the run.',
    tag: 'passive_dodge_10',
    tree: 'universal',
  },
  unfinished_sentence: {
    id: 'unfinished_sentence',
    name: 'Unfinished Sentence',
    apCost: 0,
    description: 'Passive. The first killing blow each run instead leaves you at 1 HP.',
    tag: 'passive_death_ward',
    tree: 'universal',
  },
  loom_touched: {
    id: 'loom_touched',
    name: 'Loom-Touched',
    apCost: 0,
    description: 'Passive. Shadow damage dealt +30%. Max HP -10%.',
    tag: 'passive_shadow_boost',
    tree: 'shadow',
  },
  librarians_eye: {
    id: 'librarians_eye',
    name: "Librarian's Eye",
    apCost: 0,
    description: 'Passive. Analyze reveals two weaknesses instead of one.',
    tag: 'passive_analyze_double',
    tree: 'scholar',
  },
  martyrs_flame: {
    id: 'martyrs_flame',
    name: "Martyr's Flame",
    apCost: 2,
    mpCost: 8,
    damageType: 'sacred',
    skillPower: 1.6,
    description: 'Sacred AoE. Costs 10 HP and 8 MP to cast.',
    tag: 'active_martyrs_flame',
    tree: 'guardian',
  },
  archival_insight: {
    id: 'archival_insight',
    name: 'Archival Insight',
    apCost: 0,
    description: 'Passive. +10% XP and Echo Shards gained.',
    tag: 'passive_archive_bonus',
    tree: 'scholar',
  },
  chorus_echo: {
    id: 'chorus_echo',
    name: 'Chorus Echo',
    apCost: 0,
    description: 'Passive. Start every combat with 1 Momentum.',
    tag: 'passive_start_momentum',
    tree: 'shadow',
  },
  sealing_strike: {
    id: 'sealing_strike',
    name: 'Sealing Strike',
    apCost: 2,
    damageType: 'sacred',
    skillPower: 1.1,
    description: 'A Sable rite turned to combat use. -2 Resonance on hit.',
    tag: 'active_sealing_strike',
    tree: 'guardian',
  },

  // ---- Warrior tree -----------------------------------------------------------------
  iron_resolve: {
    id: 'iron_resolve',
    name: 'Iron Resolve',
    apCost: 0,
    description: 'Passive. Guard blocks an additional 15% damage.',
    tag: 'passive_guard_bonus',
    tree: 'warrior',
  },
  reckless_swing: {
    id: 'reckless_swing',
    name: 'Reckless Swing',
    apCost: 2,
    damageType: 'slash',
    skillPower: 1.8,
    description: 'A heavy overcommitted strike. Costs 8% of your current HP to cast.',
    tag: 'active_reckless_swing',
    tree: 'warrior',
  },
  second_wind: {
    id: 'second_wind',
    name: 'Second Wind',
    apCost: 0,
    description: "Passive. The first time your HP drops below 25% each combat, instantly heal 15% max HP.",
    tag: 'passive_second_wind',
    tree: 'warrior',
  },

  // ---- Ranger tree ------------------------------------------------------------------
  quickstep: {
    id: 'quickstep',
    name: 'Quickstep',
    apCost: 0,
    description: 'Passive. +5 Speed for the rest of the run.',
    tag: 'passive_spd_bonus',
    tree: 'ranger',
  },
  opening_strike: {
    id: 'opening_strike',
    name: 'Opening Strike',
    apCost: 0,
    description: "Passive. Your first Attack each combat deals 20% bonus damage.",
    tag: 'passive_opening_strike',
    tree: 'ranger',
  },
  hunters_mark: {
    id: 'hunters_mark',
    name: "Hunter's Mark",
    apCost: 2,
    mpCost: 3,
    damageType: 'pierce',
    skillPower: 1.3,
    description: 'A precise strike that cannot miss.',
    tag: 'active_hunters_mark',
    tree: 'ranger',
  },

  // ---- Scholar tree -----------------------------------------------------------------
  resonant_study: {
    id: 'resonant_study',
    name: 'Resonant Study',
    apCost: 0,
    description: 'Passive. Resonance Ability costs 1 AP instead of 3.',
    tag: 'passive_resonance_efficiency',
    tree: 'scholar',
  },
  cross_reference: {
    id: 'cross_reference',
    name: 'Cross-Reference',
    apCost: 0,
    description: 'Passive. Analyze costs 0 AP.',
    tag: 'passive_analyze_free',
    tree: 'scholar',
  },
  overwritten_truth: {
    id: 'overwritten_truth',
    name: 'Overwritten Truth',
    apCost: 2,
    mpCost: 6,
    damageType: 'shock',
    skillPower: 1.7,
    description: 'A precise, INT-scaled strike of corrected fact.',
    tag: 'active_overwritten_truth',
    tree: 'scholar',
  },

  // ---- Guardian tree ----------------------------------------------------------------
  bulwark_stance: {
    id: 'bulwark_stance',
    name: 'Bulwark Stance',
    apCost: 0,
    description: 'Passive. +15% Defense for the rest of the run.',
    tag: 'passive_def_bonus',
    tree: 'guardian',
  },
  retaliation: {
    id: 'retaliation',
    name: 'Retaliation',
    apCost: 0,
    description: 'Passive. A successful Guard reflects 20% of the blocked damage back at the attacker.',
    tag: 'passive_retaliate',
    tree: 'guardian',
  },
  unshakeable: {
    id: 'unshakeable',
    name: 'Unshakeable',
    apCost: 0,
    description: 'Passive. 50% chance to resist incoming Control-type status effects.',
    tag: 'passive_status_resist',
    tree: 'guardian',
  },

  // ---- Shadow tree ------------------------------------------------------------------
  veil_step: {
    id: 'veil_step',
    name: 'Veil Step',
    apCost: 2,
    mpCost: 4,
    description: "Guarantees you avoid the enemy's next attack this turn.",
    tag: 'active_veil_step',
    tree: 'shadow',
  },
  parting_words: {
    id: 'parting_words',
    name: 'Parting Words',
    apCost: 0,
    description: 'Passive. Shadow damage dealt +40% against enemies below 30% HP.',
    tag: 'passive_shadow_execute',
    tree: 'shadow',
  },
  borrowed_time: {
    id: 'borrowed_time',
    name: 'Borrowed Time',
    apCost: 0,
    description: 'Passive. Start every combat with 1 extra AP.',
    tag: 'passive_bonus_ap',
    tree: 'shadow',
  },

  // ---- Universal ----------------------------------------------------------------------
  deep_breath: {
    id: 'deep_breath',
    name: 'Deep Breath',
    apCost: 0,
    description: 'Passive. Resting heals 10% more max HP than usual.',
    tag: 'passive_rest_bonus',
    tree: 'universal',
  },
  steady_hands: {
    id: 'steady_hands',
    name: 'Steady Hands',
    apCost: 0,
    description: 'Passive. +10 Accuracy for the rest of the run.',
    tag: 'passive_accuracy_bonus',
    tree: 'universal',
  },
};

/** Starting skill granted at character creation, keyed by preset name (PRESET_BUILDS). */
export const PRESET_STARTING_SKILL: Record<string, string> = {
  Warrior: 'iron_resolve',
  Ranger: 'quickstep',
  Scholar: 'cross_reference',
  Guardian: 'bulwark_stance',
  Shadow: 'borrowed_time',
  Balanced: 'steady_hands',
};

/** Pool for the discovery "training notes" template — anything not already covered above. */
export const DISCOVERABLE_SKILLS: string[] = [
  'reckless_swing',
  'second_wind',
  'opening_strike',
  'hunters_mark',
  'resonant_study',
  'overwritten_truth',
  'retaliation',
  'unshakeable',
  'parting_words',
  'veil_step',
  'deep_breath',
  'sealing_strike',
];
