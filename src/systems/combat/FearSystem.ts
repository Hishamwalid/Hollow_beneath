/**
 * PART 11 — FEAR / BRAVERY (Ultimate Battle System).
 * Hidden 0-100 fear gauge; >50 applies the Terrified debuff (-10% accuracy, -10% damage).
 * Fear increases from: massive hits (>30% max HP in one hit), boss ultimates, or
 * being brought to critical HP. The player lowers fear via bravery actions.
 */
export const FEAR_THRESHOLD = 50;

/** Fear gained when a single hit deals >= 30% of max HP. */
export const FEAR_MASSIVE_PCT = 30;
export const FEAR_MASSIVE_GAIN = 30;
/** Fear gained when a boss uses an ultimate/charged attack. */
export const FEAR_ULTIMATE_GAIN = 35;
/** Fear gained when the player is dropped below 25% HP by a single hit. */
export const FEAR_CRIT_GAIN = 20;
/** General fear for a big hardship rollback. */
export const FEAR_EVENT_GAIN = 15;

export function clampFear(fear: number): number {
  return Math.max(0, Math.min(100, fear));
}

export function isTerrified(fear: number): boolean {
  return fear > FEAR_THRESHOLD;
}

export interface FearModifiers {
  damageMult: number;
  accuracyMult: number;
}

/** Terrified: -10% accuracy, -10% damage. */
export function fearModifiers(fear: number): FearModifiers {
  return isTerrified(fear) ? { damageMult: 0.9, accuracyMult: 0.9 } : { damageMult: 1, accuracyMult: 1 };
}

export interface BraveryActionDef {
  id: string;
  label: string;
  apCost: number;
  fearDelta: number;
  detail: string;
}

/** Bravery actions available from the skill menu (Phase 4e). */
export const BRAVERY_ACTIONS: BraveryActionDef[] = [
  { id: 'face_fear', label: 'Face Fear', apCost: 1, fearDelta: -100, detail: 'Steady your nerve; -100 fear and +25% damage for 2 turns.' },
  { id: 'defiant_roar', label: 'Defiant Roar', apCost: 1, fearDelta: -50, detail: 'Shout down the dread; -50 fear, +10% damage for 3 turns.' },
  { id: 'reckless_charge', label: 'Reckless Charge', apCost: 2, fearDelta: 40, detail: 'Throw caution aside; 2.0x damage but +40 fear.' },
];

export function braveryById(id: string): BraveryActionDef | undefined {
  return BRAVERY_ACTIONS.find((a) => a.id === id);
}