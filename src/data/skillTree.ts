import type { ClassId } from './types';
import { CLASSES } from './classes';

export interface SkillTreeNode {
  id: string;
  tier: number;
  cost: number;
}

export interface SkillTreeDef {
  id: string;
  name: string;
  color: number;
  nodes: SkillTreeNode[];
}

/**
 * Six class-locked trees, one per ClassId. Each tree holds the class passive
 * (tier 0, free), its signature (tier 1), and four progression skills (tiers 2–5).
 * Derived from CLASSES so content stays in one place.
 */
export const SKILL_TREES: SkillTreeDef[] = CLASSES.map((c) => ({
  id: c.id,
  name: c.name,
  color: c.color,
  nodes: [
    { id: c.passive.id, tier: 0, cost: 0 },
    { id: c.signature.id, tier: 1, cost: 1 },
    { id: c.progression[0].id, tier: 2, cost: 2 },
    { id: c.progression[1].id, tier: 3, cost: 3 },
    { id: c.progression[2].id, tier: 4, cost: 4 },
    { id: c.progression[3].id, tier: 5, cost: 5 },
  ],
}));

export function skillTreeForClass(classId: ClassId): SkillTreeDef | undefined {
  return SKILL_TREES.find((t) => t.id === classId);
}