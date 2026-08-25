import type { SkillDef } from './types';

/**
 * Named skills for the revamped solo-protagonist combat system.
 *
 * - Chapter loadout skills unlock as the player reaches each chapter and are
 *   auto-equipped into the 6-slot loadout (see CHAPTER_LOADOUTS).
 * - Passives are permanent once learned.
 * - Everything else sits in the discovery pool (training notes / boss rewards)
 *   and lands in the Skill Archive if it exceeds the 6 equipped slots.
 */
export const NAMED_SKILLS: Record<string, SkillDef> = {
  // ---- Chapter 1 loadout: Surface Threshold ---------------------------------
  cleaving_swing: {
    id: 'cleaving_swing',
    name: 'Cleaving Swing',
    description: 'Physical — HP cost. A heavy two-handed Slash.',
    hpCost: { pct: 8 },
    damageType: 'slash',
    skillPower: 1.7,
    stat: 'atk',
    target: 'single',
    chapter: 1,
  },
  pinpoint_strike: {
    id: 'pinpoint_strike',
    name: 'Pinpoint Strike',
    description: 'Physical — HP cost. High-crit Pierce attack that cannot miss.',
    hpCost: { flat: 6 },
    damageType: 'pierce',
    skillPower: 1.2,
    stat: 'atk',
    target: 'single',
    guaranteed: true,
    critChanceBonus: 0.25,
    chapter: 1,
  },
  flame_pulse: {
    id: 'flame_pulse',
    name: 'Flame Pulse',
    description: 'Magic — MP cost. Single-target Flame damage.',
    mpCost: 7,
    damageType: 'flame',
    skillPower: 1.5,
    stat: 'magic',
    target: 'single',
    chapter: 1,
  },
  heavy_guard: {
    id: 'heavy_guard',
    name: 'Heavy Guard',
    description: 'Physical — HP cost. Blunt strike that raises your Defense for 2 turns.',
    hpCost: { pct: 6 },
    damageType: 'blunt',
    skillPower: 1.1,
    stat: 'atk',
    target: 'single',
    effects: [{ kind: 'buff', id: 'defense_up', turns: 2 }],
    chapter: 1,
  },
  mend: {
    id: 'mend',
    name: 'Mend',
    description: 'Utility — MP cost. Restores 30% of your max HP.',
    mpCost: 8,
    effects: [{ kind: 'heal', pct: 30 }],
    chapter: 1,
  },
  ignite: {
    id: 'ignite',
    name: 'Ignite',
    description: 'Magic — MP cost. Light Flame damage with a strong chance to Burn.',
    mpCost: 5,
    damageType: 'flame',
    skillPower: 0.9,
    stat: 'magic',
    target: 'single',
    effects: [{ kind: 'status', id: 'burn', turns: 2, stacks: 1, target: 'single' }],
    chapter: 1,
  },

  // ---- Chapter 2 loadout: Cults & Factions ----------------------------------
  frost_touch: {
    id: 'frost_touch',
    name: 'Frost Touch',
    description: 'Magic — MP cost. Frost damage that leaves the target Chilled.',
    mpCost: 7,
    damageType: 'frost',
    skillPower: 1.4,
    stat: 'magic',
    target: 'single',
    effects: [{ kind: 'status', id: 'chilled', turns: 2, target: 'single' }],
    chapter: 2,
  },
  shock_arc: {
    id: 'shock_arc',
    name: 'Shock Arc',
    description: 'Magic — MP cost. Shock damage; leaves a Shock DoT (Overcharge fuel) and triggers Brittle Frost (Stun) on Chilled targets.',
    mpCost: 7,
    damageType: 'shock',
    skillPower: 1.4,
    stat: 'magic',
    target: 'single',
    effects: [{ kind: 'status', id: 'shock_dot', turns: 2, stacks: 1, target: 'single' }],
    chapter: 2,
  },
  cleanse_surge: {
    id: 'cleanse_surge',
    name: 'Cleanse & Surge',
    description: 'Utility — MP cost. Cleanses all your debuffs and restores 4 MP.',
    mpCost: 5,
    effects: [{ kind: 'resource', mp: 4 }],
    chapter: 2,
  },

  // ---- Chapter 3 loadout: Deepening & Memory Loss ----------------------------
  chain_plasma: {
    id: 'chain_plasma',
    name: 'Chain Lightning',
    description: 'Magic — MP cost. Arcing Shock damage to all enemies, leaving Shock DoTs (Overcharge fuel).',
    mpCost: 12,
    damageType: 'shock',
    skillPower: 1.2,
    stat: 'magic',
    target: 'all',
    effects: [{ kind: 'status', id: 'shock_dot', turns: 2, stacks: 1, target: 'all' }],
    chapter: 3,
  },
  inferno_wave: {
    id: 'inferno_wave',
    name: 'Inferno Wave',
    description: 'Magic — MP cost. Flame damage to all enemies; Overcharges Shocked targets.',
    mpCost: 12,
    damageType: 'flame',
    skillPower: 1.2,
    stat: 'magic',
    target: 'all',
    chapter: 3,
  },
  sacred_ray: {
    id: 'sacred_ray',
    name: 'Sacred Ray',
    description: 'Magic — MP cost. Sacred damage; marks the target for Eclipse.',
    mpCost: 8,
    damageType: 'sacred',
    skillPower: 1.6,
    stat: 'magic',
    target: 'single',
    effects: [{ kind: 'status', id: 'sacred_mark', turns: 2, target: 'single' }],
    chapter: 3,
  },
  barrier_protocol: {
    id: 'barrier_protocol',
    name: 'Aegis Ward',
    description: 'Utility — MP cost. Raises a shield equal to 25% of your max HP.',
    mpCost: 9,
    effects: [{ kind: 'barrier', pct: 25, turns: 99 }],
    chapter: 3,
  },

  // ---- Chapter 4 loadout: Corruption & Mutants -------------------------------
  shadow_veil: {
    id: 'shadow_veil',
    name: 'Shadow Veil',
    description: 'Magic — MP cost. Shadow damage; triggers Eclipse on Sacred-marked targets.',
    mpCost: 8,
    damageType: 'shadow',
    skillPower: 1.5,
    stat: 'magic',
    target: 'single',
    chapter: 4,
  },
  heavy_crush: {
    id: 'heavy_crush',
    name: 'Heavy Crush',
    description: "Physical — HP cost. A devastating Blunt blow.",
    hpCost: { pct: 10 },
    damageType: 'blunt',
    skillPower: 1.9,
    stat: 'atk',
    target: 'single',
    chapter: 4,
  },
  viper_pierce: {
    id: 'viper_pierce',
    name: 'Viper Pierce',
    description: 'Physical — HP cost. Pierce attack with a high Bleed chance.',
    hpCost: { flat: 8 },
    damageType: 'pierce',
    skillPower: 1.3,
    stat: 'atk',
    target: 'single',
    effects: [{ kind: 'status', id: 'bleed', turns: 3, stacks: 1, target: 'single' }],
    chapter: 4,
  },
  // ---- Chapter 4 loadout: Corruption & Mutants -------------------------------
  mass_renew: {
    id: 'mass_renew',
    name: 'Mass Renew',
    description: 'Utility — MP cost. Regenerates 10% max HP per turn for 4 turns.',
    mpCost: 12,
    effects: [{ kind: 'buff', id: 'regeneration', turns: 4, stacks: 2 }],
    chapter: 4,
  },

  // ---- Chapter 5 loadout: The Deep & Final Reflection -------------------------
  full_knowledge: {
    id: 'full_knowledge',
    name: 'Full Knowledge',
    description: 'Utility — MP cost. Instantly reveals every unknown affinity slot of all active enemies.',
    mpCost: 10,
    effects: [{ kind: 'reveal_all_affinities' }],
    chapter: 5,
  },
  eclipse_blade: {
    id: 'eclipse_blade',
    name: 'Eclipse Blade',
    description: 'Dual — HP/MP cost. A Slash + Shadow cut; triggers Eclipse on marked targets.',
    mpCost: 6,
    hpCost: { flat: 6 },
    damageType: 'shadow',
    skillPower: 1.8,
    stat: 'atk',
    target: 'single',
    chapter: 5,
  },
  absolute_zero: {
    id: 'absolute_zero',
    name: "Winter's Grasp",
    description: 'Magic — MP cost. Devastating Frost storm; may Stun each enemy.',
    mpCost: 16,
    damageType: 'frost',
    skillPower: 1.4,
    stat: 'magic',
    target: 'all',
    effects: [{ kind: 'status', id: 'stun', turns: 1, target: 'all' }],
    chapter: 5,
  },
  aegis_covenant: {
    id: 'aegis_covenant',
    name: 'Aegis Covenant',
    description: 'Utility — MP cost. Cleanses everything, heals 40% max HP, raises a heavy shield.',
    mpCost: 14,
    effects: [
      { kind: 'heal', pct: 40 },
      { kind: 'barrier', pct: 30, turns: 99 },
    ],
    chapter: 5,
  },

  // ---- Passives (permanent once learned) --------------------------------------
  chorus_step: {
    id: 'chorus_step',
    name: 'Chorus Step',
    description: 'Passive. +10% Dodge for the rest of the run.',
    passive: 'passive_dodge_10',
  },
  unfinished_sentence: {
    id: 'unfinished_sentence',
    name: 'Unfinished Sentence',
    description: 'Passive. The first killing blow each run instead leaves you at 1 HP.',
    passive: 'passive_death_ward',
  },
  loom_touched: {
    id: 'loom_touched',
    name: 'Loom-Touched',
    description: 'Passive. Shadow damage dealt +30%.',
    passive: 'passive_shadow_boost',
  },
  archival_insight: {
    id: 'archival_insight',
    name: 'Archival Insight',
    description: 'Passive. +10% XP and Echo Shards gained.',
    passive: 'passive_archive_bonus',
  },
  chorus_echo: {
    id: 'chorus_echo',
    name: 'Chorus Echo',
    description: 'Passive. Start every combat with 1 Momentum.',
    passive: 'passive_start_momentum',
  },
  iron_resolve: {
    id: 'iron_resolve',
    name: 'Iron Resolve',
    description: 'Passive. Guard blocks an additional 15% damage.',
    passive: 'passive_guard_bonus',
  },
  second_wind: {
    id: 'second_wind',
    name: 'Second Wind',
    description: 'Passive. The first time your HP drops below 25% each combat, instantly heal 15% max HP.',
    passive: 'passive_second_wind',
  },
  quickstep: {
    id: 'quickstep',
    name: 'Quickstep',
    description: 'Passive. +5 Speed for the rest of the run.',
    passive: 'passive_spd_bonus',
  },
  opening_strike: {
    id: 'opening_strike',
    name: 'Opening Strike',
    description: 'Passive. Your first Attack each combat deals 20% bonus damage.',
    passive: 'passive_opening_strike',
  },
  bulwark_stance: {
    id: 'bulwark_stance',
    name: 'Bulwark Stance',
    description: 'Passive. +15% Defense for the rest of the run.',
    passive: 'passive_def_bonus',
  },
  retaliation: {
    id: 'retaliation',
    name: 'Retaliation',
    description: 'Passive. A successful Guard reflects 20% of the blocked damage back at the attacker.',
    passive: 'passive_retaliate',
  },
  unshakeable: {
    id: 'unshakeable',
    name: 'Unshakeable',
    description: 'Passive. 50% chance to resist incoming Control-type status effects.',
    passive: 'passive_status_resist',
  },
  parting_words: {
    id: 'parting_words',
    name: 'Parting Words',
    description: 'Passive. Shadow damage dealt +40% against enemies below 30% HP.',
    passive: 'passive_shadow_execute',
  },
  deep_breath: {
    id: 'deep_breath',
    name: 'Deep Breath',
    description: 'Passive. Resting heals 10% more max HP than usual.',
    passive: 'passive_rest_bonus',
  },
  steady_hands: {
    id: 'steady_hands',
    name: 'Steady Hands',
    description: 'Passive. +10 Accuracy for the rest of the run.',
    passive: 'passive_accuracy_bonus',
  },

  // ---- Discovery actives (events / bosses) -------------------------------------
  reckless_swing: {
    id: 'reckless_swing',
    name: 'Reckless Swing',
    description: 'A heavy overcommitted strike — your strongest raw hit. Costs 10% of your current HP to cast.',
    hpCost: { pct: 10 },
    damageType: 'slash',
    skillPower: 2.1,
    stat: 'atk',
    target: 'single',
  },
  hunters_mark: {
    id: 'hunters_mark',
    name: "Hunter's Mark",
    description: 'A precise Pierce strike that cannot miss, hunting the weak point (+30% crit).',
    damageType: 'pierce',
    skillPower: 1.3,
    stat: 'atk',
    target: 'single',
    guaranteed: true,
    critChanceBonus: 0.3,
  },
  overwritten_truth: {
    id: 'overwritten_truth',
    name: 'Overwritten Truth',
    description: 'A precise, INT-scaled strike of corrected fact.',
    mpCost: 8,
    damageType: 'shock',
    skillPower: 2.0,
    stat: 'magic',
    target: 'single',
  },
  martyrs_flame: {
    id: 'martyrs_flame',
    name: "Martyr's Flame",
    description: 'Sacred AoE. Costs 10 HP and 8 MP to cast.',
    mpCost: 8,
    hpCost: { flat: 10 },
    damageType: 'sacred',
    skillPower: 1.6,
    stat: 'magic',
    target: 'all',
  },
  sealing_strike: {
    id: 'sealing_strike',
    name: 'Sealing Strike',
    description: 'A Sable rite turned to combat use. Sacred damage.',
    damageType: 'sacred',
    skillPower: 1.4,
    stat: 'atk',
    target: 'single',
  },

  // ---- Resonance Abilities (granted by the Loom at Transcendent resonance) ---
  loom_lance: {
    id: 'loom_lance',
    name: 'Loom Lance',
    description: 'RESONANCE — MP cost. A needle of borrowed certainty. Shadow damage that cannot miss.',
    mpCost: 14,
    damageType: 'shadow',
    skillPower: 2.0,
    stat: 'magic',
    target: 'single',
    guaranteed: true,
  },
  echo_ward: {
    id: 'echo_ward',
    name: 'Echo Ward',
    description: "RESONANCE — MP cost. The chord answers for you once: cleanses debuffs, restores 10% HP, raises a 30% shield.",
    mpCost: 12,
    effects: [
      { kind: 'barrier', pct: 30, turns: 99 },
      { kind: 'heal', pct: 10 },
    ],
  },
};

/** Skills granted when the player first reaches each chapter (auto-equipped). */
export const CHAPTER_LOADOUTS: Record<number, string[]> = {
  1: ['cleaving_swing', 'pinpoint_strike', 'flame_pulse', 'heavy_guard', 'mend', 'ignite'],
  2: ['frost_touch', 'shock_arc', 'flame_pulse', 'heavy_guard', 'cleanse_surge', 'mend'],
  3: ['chain_plasma', 'inferno_wave', 'sacred_ray', 'pinpoint_strike', 'barrier_protocol', 'mend'],
  4: ['sacred_ray', 'shadow_veil', 'heavy_crush', 'viper_pierce', 'frost_touch', 'mass_renew'],
  5: ['full_knowledge', 'eclipse_blade', 'absolute_zero', 'aegis_covenant', 'chain_plasma', 'sacred_ray'],
};

/** Loadout slot count (mirrors MAX_EQUIPPED_SKILLS in types). */
export const MAX_EQUIPPED_SKILLS_FALLBACK = (): number => 6;

/** All skills referenced by loadouts, in grant order per chapter. */
export function chapterGrantSkills(chapter: number): string[] {
  const grants: string[] = [];
  for (let c = 1; c <= Math.min(5, chapter); c++) {
    for (const id of CHAPTER_LOADOUTS[c] ?? []) {
      if (!grants.includes(id)) grants.push(id);
    }
  }
  return grants;
}

/** Pool for the discovery "training notes" template + event/boss rewards. */
export const DISCOVERABLE_SKILLS: string[] = [
  'reckless_swing',
  'second_wind',
  'opening_strike',
  'hunters_mark',
  'overwritten_truth',
  'retaliation',
  'unshakeable',
  'parting_words',
  'deep_breath',
  'steady_hands',
  'chorus_step',
  'iron_resolve',
  'quickstep',
  'bulwark_stance',
  'sealing_strike',
  'martyrs_flame',
];

export function getSkill(id: string): SkillDef | undefined {
  return NAMED_SKILLS[id];
}
