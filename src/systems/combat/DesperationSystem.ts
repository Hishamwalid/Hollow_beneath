/**
 * PART 11 — DESPERATION (Ultimate Battle System).
 * Below 35% HP on the player's turn, a low-chance roll can trigger one of several
 * combat-local gambles (a banner + immediate effect). Roguelike, never guaranteed.
 */
export const DESPERATION_HP_PCT = 0.35;
/** Base chance per qualifying player turn. */
export const DESPERATION_CHANCE = 0.18;

export type DesperationId =
  | 'broken_resolve'
  | 'forget_pain'
  | 'shatter_resonance'
  | 'burn_the_archive'
  | 'one_last_memory';

export interface DesperationDef {
  id: DesperationId;
  title: string;
  detail: string;
}

export const DESPERATIONS: Record<DesperationId, DesperationDef> = {
  broken_resolve: {
    id: 'broken_resolve',
    title: 'BROKEN RESOLVE',
    detail: 'Your next 3 attacks deal 2x damage, but every hit you take deals 1.8x.',
  },
  forget_pain: {
    id: 'forget_pain',
    title: 'FORGET PAIN',
    detail: 'Restore full HP and MP, but lose 20% of your max HP for the fight.',
  },
  shatter_resonance: {
    id: 'shatter_resonance',
    title: 'SHATTER RESONANCE',
    detail: 'Your Resonance resets to 0; every attack becomes a critical for 3 turns.',
  },
  burn_the_archive: {
    id: 'burn_the_archive',
    title: 'BURN THE ARCHIVE',
    detail: 'Instantly defeat all summoned enemies and gain +30% damage for the fight.',
  },
  one_last_memory: {
    id: 'one_last_memory',
    title: 'ONE LAST MEMORY',
    detail: 'You can no longer heal this combat, but your attacks ignore defense.',
  },
};

/** Rolls whether a desperation event fires this player turn. */
export function rollDesperation(rng: () => number): boolean {
  return rng() < DESPERATION_CHANCE;
}

/** Pick a desperation event that hasn't fired yet this combat. */
export function pickDesperation(state: DesperationId[], rng?: () => number): DesperationDef | null {
  const ids = Object.keys(DESPERATIONS) as DesperationId[];
  const fresh = ids.filter((id) => !state.includes(id));
  if (fresh.length === 0) return null;
  const roll = rng ? rng() : Math.random();
  const chosen = fresh[Math.floor(roll * fresh.length)];
  return DESPERATIONS[chosen];
}