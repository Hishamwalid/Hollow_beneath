/**
 * PART 11 — CRISIS SYSTEM (Ultimate Battle System).
 * Dramatic pause points with a choice menu. Evaluator is framework-agnostic so it
 * can be tested headlessly; the engine decides the concrete effect application.
 */
export type CrisisId =
  | 'desperate_gambit'
  | 'boss_wrath'
  | 'revelation'
  | 'critical_moment'
  | 'fates_edge';

export interface CrisisOption {
  id: string;
  label: string;
  subtitle: string;
}

export interface CrisisDef {
  id: CrisisId;
  title: string;
  flavor: string;
  options: CrisisOption[];
}

export interface CrisisTriggerInput {
  hpPct: number;          // player HP percentage 0..1
  bossPct: number | null; // boss HP percentage, null if no boss
  firstWeaknessSeen: boolean;
  momentum: number;
  round: number;
  anyEnemyAlive: boolean;
}

export interface CrisisState {
  seen: CrisisId[];
}

export const CRISES: Record<CrisisId, CrisisDef> = {
  desperate_gambit: {
    id: 'desperate_gambit',
    title: 'DESPERATE GAMBIT',
    flavor: 'Your blood is in the dust. Every option is a wager.',
    options: [
      { id: 'all_in', label: 'All-In', subtitle: '2.5x damage; 30% chance to die after the attack.' },
      { id: 'retreat', label: 'Retreat', subtitle: 'Heal 20% max HP and Guard for 2 turns.' },
      { id: 'last_prayer', label: 'Last Prayer', subtitle: 'Restore 40% MP and gain +30% damage for 3 turns.' },
    ],
  },
  boss_wrath: {
    id: 'boss_wrath',
    title: "BOSS'S WRATH",
    flavor: 'The towering foe turns its full gaze upon you.',
    options: [
      { id: 'defy', label: 'Defy', subtitle: 'Taunt the boss; you deal +50% damage for 2 turns.' },
      { id: 'evade', label: 'Evade', subtitle: 'Dodge the next 2 attacks.' },
      { id: 'sacrifice', label: 'Sacrifice', subtitle: 'Pay 50% of your HP to deal 3.0x damage to the boss.' },
    ],
  },
  revelation: {
    id: 'revelation',
    title: 'REVELATION',
    flavor: 'For the first time, you understand its weakness.',
    options: [
      { id: 'exploit_focus', label: 'Exploit Focus', subtitle: 'All attacks exploit weaknesses for 2 turns.' },
      { id: 'study', label: 'Study', subtitle: 'Gain +3 Momentum and reveal all enemy info.' },
      { id: 'share', label: 'Share', subtitle: '+20% damage against this enemy type for the fight.' },
    ],
  },
  critical_moment: {
    id: 'critical_moment',
    title: 'CRITICAL MOMENT',
    flavor: 'The echo of your momentum builds toward something inevitable.',
    options: [
      { id: 'cascade', label: 'Cascade', subtitle: 'Spend all Momentum for +100% damage this turn.' },
      { id: 'tactical_reset', label: 'Tactical Reset', subtitle: 'Remove all debuffs and gain a Barrier.' },
      { id: 'rhythm', label: 'Rhythm', subtitle: 'Gain an extra turn next round.' },
    ],
  },
  fates_edge: {
    id: 'fates_edge',
    title: "FATE'S EDGE",
    flavor: 'The fight has gone on long enough for fate to grow impatient.',
    options: [
      { id: 'final_stand', label: 'Final Stand', subtitle: '1.5x damage; take double damage for 2 turns.' },
      { id: 'prolong', label: 'Prolong', subtitle: 'Heal 30% and reduce enemy damage 30% for 2 turns.' },
      { id: 'gamble', label: 'Gamble', subtitle: '50% chance to instantly defeat the enemy — or yourself.' },
    ],
  },
};

/** Fires at most once per crisis id per combat, in a fixed priority order. */
export function pickCrisis(input: CrisisTriggerInput, state: CrisisState): CrisisDef | null {
  if (input.hpPct < 0.25 && !state.seen.includes('desperate_gambit')) {
    return CRISES.desperate_gambit;
  }
  if (input.bossPct !== null && input.bossPct < 0.5 && !state.seen.includes('boss_wrath')) {
    return CRISES.boss_wrath;
  }
  if (input.firstWeaknessSeen && !state.seen.includes('revelation')) {
    return CRISES.revelation;
  }
  if (input.momentum >= 3 && !state.seen.includes('critical_moment')) {
    return CRISES.critical_moment;
  }
  if (input.round >= 5 && input.anyEnemyAlive && !state.seen.includes('fates_edge')) {
    return CRISES.fates_edge;
  }
  return null;
}

export function markCrisisSeen(state: CrisisState, id: CrisisId): void {
  if (!state.seen.includes(id)) state.seen.push(id);
}
