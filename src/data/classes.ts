import type { ClassId, SkillDef } from './types';

/**
 * PART 8 — CLASS IDENTITY (Ultimate Battle System).
 * Each class: a passive, a signature skill (1 AP), and 4 progression skills.
 *
 * Skills whose mechanics the generic `effects` resolver can express use `effects`.
 * Skills needing special engine behavior use a `tag` (resolved by CombatEngine):
 *   - class_passive_*    passive calculators
 *   - sig_*              signature mechanics (taunt, stealth, next-attack amps, …)
 *   - prog_*             progression mechanics (threshold crits, refunds, marks, …)
 *
 * Skill ids are merged into NAMED_SKILLS by `@data/skills`.
 */
export interface ClassDef {
  id: ClassId;
  name: string;
  archetype: string;
  color: number;
  passive: SkillDef;
  signature: SkillDef;
  /** 4 progression skills, tiers 2–5. */
  progression: SkillDef[];
}

/** Class skill definitions keyed by id, merged into NAMED_SKILLS. */
export const CLASS_SKILLS: Record<string, SkillDef> = {
  // ---- Warrior ----
  rage: {
    id: 'rage', name: 'Rage', apCost: 0, tree: 'warrior',
    description: 'Passive. +5% damage per stack of Rage (1 per 10% HP lost, max 5).',
    tag: 'class_passive_rage',
  },
  last_stand: {
    id: 'last_stand', name: 'Last Stand', apCost: 1, mpCost: 15, tree: 'warrior',
    description: 'Sacrifice 30% current HP. +50% damage and +30% Guard for 3 turns, taunting all enemies.',
    effects: [{ kind: 'cost', hpPct: 30 }],
    tag: 'sig_last_stand',
    tags: ['Strike', 'Stance'],
  },
  cleaving_swing: {
    id: 'cleaving_swing', name: 'Cleaving Swing', apCost: 2, mpCost: 12, damageType: 'slash',
    skillPower: 2.0, tree: 'warrior',
    description: 'Slash 2.0 hitting all enemies, -20% damage per additional target.',
    effects: [{ kind: 'damage', type: 'slash', power: 1.6, target: 'all', stat: 'atk' }],
    tags: ['Physical', 'Slash', 'Strike'],
  },
  berserkers_cry: {
    id: 'berserkers_cry', name: "Berserker's Cry", apCost: 1, tree: 'warrior',
    description: '+25% damage, -20% defense for 3 turns.',
    tag: 'prog_berserkers_cry',
    tags: ['Strike', 'Stance'],
  },
  adamantine_shell: {
    id: 'adamantine_shell', name: 'Adamantine Shell', apCost: 2, mpCost: 18, tree: 'warrior',
    description: 'Gain a Barrier equal to 30% of max HP and Guard for 2 turns.',
    effects: [{ kind: 'barrier', pct: 0.3, turns: 2 }, { kind: 'buff', id: 'brace', turns: 2 }],
    tags: ['Defense', 'Guard'],
  },
  blade_of_ruin: {
    id: 'blade_of_ruin', name: 'Blade of Ruin', apCost: 3, mpCost: 25, damageType: 'slash',
    skillPower: 3.0, tree: 'warrior',
    description: 'Slash 3.0 to a single enemy; +100% damage if below 30% HP.',
    effects: [{ kind: 'damage', type: 'slash', power: 3.0, target: 'single', stat: 'atk' }],
    tag: 'prog_blade_of_ruin',
    tags: ['Physical', 'Slash', 'Strike'],
  },

  // ---- Ranger ----
  precision: {
    id: 'precision', name: 'Precision', apCost: 0, tree: 'ranger',
    description: 'Passive. Each dodge raises crit rate by 15% (max 3); crits restore 1 AP.',
    tag: 'class_passive_precision',
  },
  shadow_step: {
    id: 'shadow_step', name: 'Shadow Step', apCost: 1, mpCost: 10, tree: 'ranger',
    description: 'Your next attack deals +50% damage and cannot miss.',
    tag: 'sig_shadow_step',
    tags: ['Strike'],
  },
  pinpoint_shot: {
    id: 'pinpoint_shot', name: 'Pinpoint Shot', apCost: 2, mpCost: 10, damageType: 'pierce',
    skillPower: 2.0, tree: 'ranger',
    description: 'Pierce 2.0; always crits if the enemy is below 40% HP.',
    effects: [{ kind: 'damage', type: 'pierce', power: 2.0, target: 'single', stat: 'atk' }],
    tag: 'prog_pinpoint_shot',
    tags: ['Physical', 'Pierce', 'Strike'],
  },
  tangle_trap: {
    id: 'tangle_trap', name: 'Tangle Trap', apCost: 1, mpCost: 8, tree: 'ranger',
    description: 'Root the enemy for 2 turns and -30% dodge.',
    effects: [{ kind: 'status', id: 'root', turns: 2, target: 'single' }],
    tag: 'prog_tangle_trap',
    tags: ['Mark'],
  },
  eagle_eye: {
    id: 'eagle_eye', name: 'Eagle Eye', apCost: 1, mpCost: 5, tree: 'ranger',
    description: '+40% accuracy and reveal all weaknesses for 3 turns.',
    tag: 'prog_eagle_eye',
    tags: ['Analyze'],
  },
  deaths_mark: {
    id: 'deaths_mark', name: "Death's Mark", apCost: 2, mpCost: 20, damageType: 'pierce',
    skillPower: 1.0, tree: 'ranger',
    description: 'Mark the enemy — it takes +50% damage from all sources for 3 turns.',
    effects: [{ kind: 'damage', type: 'pierce', power: 1.0, target: 'single', stat: 'atk' }],
    tag: 'prog_deaths_mark',
    tags: ['Mark'],
  },

  // ---- Scholar ----
  knowledge: {
    id: 'knowledge', name: 'Knowledge', apCost: 0, tree: 'scholar',
    description: 'Passive. Every Analyze buffs your damage by 5% (max 3) and grants +1 Insight.',
    tag: 'class_passive_knowledge',
  },
  arcane_thesis: {
    id: 'arcane_thesis', name: 'Arcane Thesis', apCost: 1, mpCost: 5, tree: 'scholar',
    description: 'Pick a damage type. For 3 turns your spells are that type and pierce 30% resistance.',
    tag: 'sig_arcane_thesis',
    tags: ['Knowledge', 'Elemental'],
  },
  force_cascade: {
    id: 'force_cascade', name: 'Force Cascade', apCost: 2, mpCost: 15, damageType: 'shock',
    skillPower: 2.2, tree: 'scholar',
    description: 'Shock 2.2; refunds 1 AP if the target has a weakness.',
    effects: [{ kind: 'damage', type: 'shock', power: 2.2, target: 'single', stat: 'magic' }],
    tag: 'prog_force_cascade',
    tags: ['Elemental', 'Shock', 'Strike', 'Knowledge'],
  },
  mnemonic_echo: {
    id: 'mnemonic_echo', name: 'Mnemonic Echo', apCost: 1, mpCost: 10, damageType: 'shock',
    skillPower: 1.5, tree: 'scholar',
    description: 'Copy the last enemy spell and use it at 1.5x power.',
    effects: [{ kind: 'damage', type: 'shock', power: 1.5, target: 'single', stat: 'magic' }],
    tag: 'prog_mnemonic_echo',
    tags: ['Knowledge', 'Elemental'],
  },
  forbidden_knowledge: {
    id: 'forbidden_knowledge', name: 'Forbidden Knowledge', apCost: 3, mpCost: 25, damageType: 'shadow',
    skillPower: 3.0, tree: 'scholar',
    description: 'Shadow 3.0; 20% chance to confuse all enemies.',
    effects: [{ kind: 'damage', type: 'shadow', power: 3.0, target: 'single', stat: 'magic' }],
    tag: 'prog_forbidden_knowledge',
    tags: ['Elemental', 'Shadow', 'Strike', 'Knowledge'],
  },
  unwritten_page: {
    id: 'unwritten_page', name: 'The Unwritten Page', apCost: 2, mpCost: 30, damageType: 'sacred',
    skillPower: 2.5, tree: 'scholar',
    description: 'Sacred 2.5; removes all buffs from the target and prevents buffs for 2 turns.',
    effects: [{ kind: 'damage', type: 'sacred', power: 2.5, target: 'single', stat: 'magic' }],
    tag: 'prog_unwritten_page',
    tags: ['Elemental', 'Sacred', 'Knowledge'],
  },

  // ---- Guardian ----
  resolve: {
    id: 'resolve', name: 'Resolve', apCost: 0, tree: 'guardian',
    description: 'Passive. Gain 1 Resolve stack per guard turn; spend 3 to nullify one attack.',
    tag: 'class_passive_resolve',
  },
  aegis_protocol: {
    id: 'aegis_protocol', name: 'Aegis Protocol', apCost: 1, tree: 'guardian',
    description: 'For 2 turns all damage is redirected to you and you gain +40% Guard.',
    tag: 'sig_aegis_protocol',
    tags: ['Guard', 'Defense'],
  },
  sacred_covenant: {
    id: 'sacred_covenant', name: 'Sacred Covenant', apCost: 2, mpCost: 15, damageType: 'sacred',
    skillPower: 1.4, tree: 'guardian',
    description: 'Sacred 1.4 and heal yourself for 25% max HP.',
    effects: [
      { kind: 'damage', type: 'sacred', power: 1.4, target: 'single', stat: 'magic' },
      { kind: 'heal', pct: 0.25 },
    ],
    tags: ['Elemental', 'Sacred', 'Strike'],
  },
  righteous_rebound: {
    id: 'righteous_rebound', name: 'Righteous Rebound', apCost: 1, mpCost: 10, tree: 'guardian',
    description: 'Counter stance: reflect 100% of the next physical damage taken.',
    effects: [{ kind: 'buff', id: 'reflection', turns: 2 }],
    tags: ['Guard', 'Counter'],
  },
  bulwarks_awakening: {
    id: 'bulwarks_awakening', name: "Bulwark's Awakening", apCost: 2, mpCost: 20, tree: 'guardian',
    description: 'Remove all debuffs from you and gain +20% defense for 3 turns.',
    tag: 'prog_bulwarks_awakening',
    tags: ['Guard', 'Defense'],
  },
  final_sanctuary: {
    id: 'final_sanctuary', name: 'Final Sanctuary', apCost: 3, mpCost: 35, tree: 'guardian',
    description: 'Gain a Barrier of 40% max HP and Guard for 2 turns.',
    effects: [{ kind: 'barrier', pct: 0.4, turns: 2 }, { kind: 'buff', id: 'brace', turns: 2 }],
    tags: ['Guard', 'Defense'],
  },

  // ---- Shadow ----
  risk: {
    id: 'risk', name: 'Risk', apCost: 0, tree: 'shadow',
    description: 'Passive. +10% damage below 50% HP; +25% damage and +15% dodge below 25% HP.',
    tag: 'class_passive_risk',
  },
  veil_of_silence: {
    id: 'veil_of_silence', name: 'Veil of Silence', apCost: 1, mpCost: 12, tree: 'shadow',
    description: 'Enter stealth: your next attack deals +75% and you cannot be targeted.',
    tag: 'sig_veil_of_silence',
    tags: ['Stealth'],
  },
  soul_rend: {
    id: 'soul_rend', name: 'Soul Rend', apCost: 2, mpCost: 15, damageType: 'shadow',
    skillPower: 2.2, tree: 'shadow',
    description: 'Shadow 2.2; steals 20% of the enemy ATK for 3 turns (adds to yours).',
    effects: [{ kind: 'damage', type: 'shadow', power: 2.2, target: 'single', stat: 'magic' }],
    tag: 'prog_soul_rend',
    tags: ['Elemental', 'Shadow', 'Strike'],
  },
  echoing_void: {
    id: 'echoing_void', name: 'Echoing Void', apCost: 1, mpCost: 8, damageType: 'shadow',
    skillPower: 1.5, tree: 'shadow',
    description: 'Silence the enemy for 2 turns; 1.5x damage if it is a mage.',
    effects: [{ kind: 'damage', type: 'shadow', power: 1.5, target: 'single', stat: 'magic' }],
    tag: 'prog_echoing_void',
    tags: ['Elemental', 'Shadow', 'Strike'],
  },
  looms_touch: {
    id: 'looms_touch', name: "Loom's Touch", apCost: 2, mpCost: 20, damageType: 'shadow',
    skillPower: 2.0, tree: 'shadow',
    description: 'Curse the enemy (8 shadow damage per turn); +10% damage per curse stack.',
    effects: [{ kind: 'damage', type: 'shadow', power: 2.0, target: 'single', stat: 'magic' }, { kind: 'status', id: 'curse', turns: 4, target: 'single' }],
    tags: ['Elemental', 'Shadow'],
  },
  unravel_existence: {
    id: 'unravel_existence', name: 'Unravel Existence', apCost: 3, mpCost: 30, damageType: 'shadow',
    skillPower: 3.5, tree: 'shadow',
    description: 'Shadow 3.5; ignores all defenses if the enemy is below 50% HP.',
    effects: [{ kind: 'damage', type: 'shadow', power: 3.5, target: 'single', stat: 'magic' }],
    tag: 'prog_unravel_existence',
    tags: ['Elemental', 'Shadow'],
  },

  // ---- Balanced ----
  adaptation: {
    id: 'adaptation', name: 'Adaptation', apCost: 0, tree: 'balanced',
    description: 'Passive. +10% damage per unique action this combat (max 5).',
    tag: 'class_passive_adaptation',
  },
  mirror_adapt: {
    id: 'mirror_adapt', name: 'Mirror Adapt', apCost: 1, tree: 'balanced',
    description: '+15% to all stats for 3 turns, then focus +30% of one stat.',
    tag: 'sig_mirror_adapt',
    tags: ['Defense'],
  },
  flicker_strike: {
    id: 'flicker_strike', name: 'Flicker Strike', apCost: 2, mpCost: 12, damageType: 'slash',
    skillPower: 1.8, tree: 'balanced',
    description: 'Slash 1.8; after hitting you gain the ability to dodge the next attack.',
    effects: [{ kind: 'damage', type: 'slash', power: 1.8, target: 'single', stat: 'atk' }],
    tags: ['Physical', 'Slash', 'Strike'],
  },
  balanced_mind: {
    id: 'balanced_mind', name: 'Balanced Mind', apCost: 1, mpCost: 8, tree: 'balanced',
    description: 'Restore 20 MP and remove one debuff.',
    effects: [{ kind: 'resource', mp: 20 }],
    tag: 'prog_balanced_mind',
    tags: ['Defense'],
  },
  harmonic_resonance: {
    id: 'harmonic_resonance', name: 'Harmonic Resonance', apCost: 2, mpCost: 18, damageType: 'shock',
    skillPower: 2.0, tree: 'balanced',
    description: 'Deal Shock scaled by your highest offensive stat; +1 Momentum per enemy hit.',
    effects: [{ kind: 'damage', type: 'shock', power: 2.0, target: 'all', stat: 'magic' }],
    tag: 'prog_harmonic_resonance',
    tags: ['Elemental', 'Strike'],
  },
  unitys_blade: {
    id: 'unitys_blade', name: "Unity's Blade", apCost: 3, mpCost: 25, damageType: 'slash',
    skillPower: 2.6, tree: 'balanced',
    description: 'Slash damage equal to ATK + MATK combined; ignores 30% of all defenses.',
    effects: [{ kind: 'damage', type: 'slash', power: 2.6, target: 'single', stat: 'atk' }],
    tag: 'prog_unitys_blade',
    tags: ['Physical', 'Slash'],
  },
};

export const CLASSES: ClassDef[] = [
  {
    id: 'warrior', name: 'Warrior', archetype: 'The Unbreakable Wall', color: 0xb0453f,
    passive: CLASS_SKILLS.rage, signature: CLASS_SKILLS.last_stand,
    progression: [
      CLASS_SKILLS.cleaving_swing,
      CLASS_SKILLS.berserkers_cry,
      CLASS_SKILLS.adamantine_shell,
      CLASS_SKILLS.blade_of_ruin,
    ],
  },
  {
    id: 'ranger', name: 'Ranger', archetype: 'The Untouchable Hunter', color: 0x27ae60,
    passive: CLASS_SKILLS.precision, signature: CLASS_SKILLS.shadow_step,
    progression: [
      CLASS_SKILLS.pinpoint_shot,
      CLASS_SKILLS.tangle_trap,
      CLASS_SKILLS.eagle_eye,
      CLASS_SKILLS.deaths_mark,
    ],
  },
  {
    id: 'scholar', name: 'Scholar', archetype: 'The Arcane Savant', color: 0x4a6fa5,
    passive: CLASS_SKILLS.knowledge, signature: CLASS_SKILLS.arcane_thesis,
    progression: [
      CLASS_SKILLS.force_cascade,
      CLASS_SKILLS.mnemonic_echo,
      CLASS_SKILLS.forbidden_knowledge,
      CLASS_SKILLS.unwritten_page,
    ],
  },
  {
    id: 'guardian', name: 'Guardian', archetype: 'The Divine Bulwark', color: 0x8e44ad,
    passive: CLASS_SKILLS.resolve, signature: CLASS_SKILLS.aegis_protocol,
    progression: [
      CLASS_SKILLS.sacred_covenant,
      CLASS_SKILLS.righteous_rebound,
      CLASS_SKILLS.bulwarks_awakening,
      CLASS_SKILLS.final_sanctuary,
    ],
  },
  {
    id: 'shadow', name: 'Shadow', archetype: 'The Edge of Oblivion', color: 0x2c3e50,
    passive: CLASS_SKILLS.risk, signature: CLASS_SKILLS.veil_of_silence,
    progression: [
      CLASS_SKILLS.soul_rend,
      CLASS_SKILLS.echoing_void,
      CLASS_SKILLS.looms_touch,
      CLASS_SKILLS.unravel_existence,
    ],
  },
  {
    id: 'balanced', name: 'Balanced', archetype: 'The Adaptive Echo', color: 0xc9a24b,
    passive: CLASS_SKILLS.adaptation, signature: CLASS_SKILLS.mirror_adapt,
    progression: [
      CLASS_SKILLS.flicker_strike,
      CLASS_SKILLS.balanced_mind,
      CLASS_SKILLS.harmonic_resonance,
      CLASS_SKILLS.unitys_blade,
    ],
  },
];
