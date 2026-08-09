export type DifficultyId = 'easy' | 'normal' | 'hard' | 'ironman';

export interface DifficultyMods {
  label: string;
  description: string;
  /** Multiplier on damage the player deals. */
  playerDmgMult: number;
  /** Multiplier on damage the player takes. */
  incomingMult: number;
  /** Multipliers applied to enemy stats at build time. */
  enemyHpMult: number;
  enemyAtkMult: number;
  enemyDefMult: number;
  /** Multiplier on fatigue gained (1 = normal rate). */
  fatigueMult: number;
  /** Multiplier on tokens forfeited when the player is punished. */
  tokenLoseMult: number;
  /** Ironman: a death ends the run — no checkpoint restore. */
  permadeath: boolean;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyMods> = {
  easy: {
    label: 'Easy',
    description: 'A gentler descent — enemies are softer, you hit harder.',
    playerDmgMult: 1.2,
    incomingMult: 0.85,
    enemyHpMult: 0.8,
    enemyAtkMult: 0.85,
    enemyDefMult: 0.85,
    fatigueMult: 0.6,
    tokenLoseMult: 0.5,
    permadeath: false,
  },
  normal: {
    label: 'Normal',
    description: 'The balanced hollow beneath, as intended.',
    playerDmgMult: 1,
    incomingMult: 1,
    enemyHpMult: 1,
    enemyAtkMult: 1,
    enemyDefMult: 1,
    fatigueMult: 1,
    tokenLoseMult: 1,
    permadeath: false,
  },
  hard: {
    label: 'Hard',
    description: 'Enemies exact a heavy toll; tokens are hard-won.',
    playerDmgMult: 0.9,
    incomingMult: 1.15,
    enemyHpMult: 1.2,
    enemyAtkMult: 1.12,
    enemyDefMult: 1.1,
    fatigueMult: 1.4,
    tokenLoseMult: 1.3,
    permadeath: false,
  },
  ironman: {
    label: 'Ironman',
    description: 'One death ends the run. No checkpoint mercy.',
    playerDmgMult: 0.85,
    incomingMult: 1.3,
    enemyHpMult: 1.3,
    enemyAtkMult: 1.18,
    enemyDefMult: 1.15,
    fatigueMult: 1.6,
    tokenLoseMult: 1.5,
    permadeath: true,
  },
};

export function difficultyMods(id: DifficultyId): DifficultyMods {
  return DIFFICULTIES[id];
}