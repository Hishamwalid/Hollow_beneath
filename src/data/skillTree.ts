export interface SkillTreeNode {
  id: string;
  tier: 1 | 2 | 3;
  cost: number;
}

export interface SkillTreeDef {
  id: string;
  name: string;
  color: number;
  nodes: SkillTreeNode[];
}

export const SKILL_TREES: SkillTreeDef[] = [
  {
    id: 'warrior', name: 'Warrior', color: 0xb0453f,
    nodes: [
      { id: 'iron_resolve', tier: 1, cost: 1 },
      { id: 'reckless_swing', tier: 2, cost: 2 },
      { id: 'second_wind', tier: 3, cost: 3 },
    ],
  },
  {
    id: 'scholar', name: 'Scholar', color: 0x4a6fa5,
    nodes: [
      { id: 'resonant_study', tier: 1, cost: 1 },
      { id: 'cross_reference', tier: 2, cost: 2 },
      { id: 'overwritten_truth', tier: 3, cost: 3 },
    ],
  },
  {
    id: 'ranger', name: 'Ranger', color: 0x27ae60,
    nodes: [
      { id: 'quickstep', tier: 1, cost: 1 },
      { id: 'opening_strike', tier: 2, cost: 2 },
      { id: 'hunters_mark', tier: 3, cost: 3 },
    ],
  },
  {
    id: 'guardian', name: 'Guardian', color: 0x8e44ad,
    nodes: [
      { id: 'bulwark_stance', tier: 1, cost: 1 },
      { id: 'retaliation', tier: 2, cost: 2 },
      { id: 'unshakeable', tier: 3, cost: 3 },
    ],
  },
  {
    id: 'shadow', name: 'Shadow', color: 0x2c3e50,
    nodes: [
      { id: 'veil_step', tier: 1, cost: 1 },
      { id: 'parting_words', tier: 2, cost: 2 },
      { id: 'borrowed_time', tier: 3, cost: 3 },
    ],
  },
];
