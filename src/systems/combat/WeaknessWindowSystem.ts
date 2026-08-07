/**
 * Weakness Windows (Phase 3a).
 * Three consecutive weakness-exploiting hits open a 2-turn window on the enemy:
 * +50% damage, +25% crit chance, and momentum gains from weakness hits are doubled.
 * The streak resets when a player attack misses or the enemy resists a hit.
 */

export const WEAK_WINDOW_STREAK = 3;
export const WEAK_WINDOW_TURNS = 2;
export const WINDOW_DAMAGE_MULT = 1.5;
export const WINDOW_CRIT_BONUS = 0.25;
export const WINDOW_MOMENTUM_MULT = 2;

/** Per-enemy weakness-window tracking state. */
export interface WeaknessWindowState {
  /** Consecutive weakness-exploiting hits landed on this enemy. */
  streak: number;
  /** Turns remaining on an opened weakness window (0 = closed). */
  turns: number;
}

export function freshWindowState(): WeaknessWindowState {
  return { streak: 0, turns: 0 };
}

/**
 * Record a weakness hit on the enemy. Returns 'opened' when the streak crosses the
 * threshold and a new window opens, 'progress' otherwise.
 */
export function recordWeakHit(state: WeaknessWindowState): 'opened' | 'progress' {
  state.streak += 1;
  if (state.streak >= WEAK_WINDOW_STREAK) {
    state.streak = 0;
    state.turns = Math.max(state.turns, WEAK_WINDOW_TURNS);
    return 'opened';
  }
  return 'progress';
}

/** Reset the streak when a player attack misses or the enemy resists. */
export function resetWeakStreak(state: WeaknessWindowState): void {
  state.streak = 0;
}

/** Decrement window turns (called at end of round). */
export function tickWeakWindow(state: WeaknessWindowState): void {
  if (state.turns > 0) state.turns -= 1;
}

export function windowActive(state: WeaknessWindowState | undefined): boolean {
  return (state?.turns ?? 0) > 0;
}

/** Damage multiplier applied against an enemy with an open window. */
export function windowDamageMult(state: WeaknessWindowState | undefined): number {
  return windowActive(state) ? WINDOW_DAMAGE_MULT : 1;
}

/** Extra crit chance (%) against an enemy with an open window. */
export function windowCritBonus(state: WeaknessWindowState | undefined): number {
  return windowActive(state) ? WINDOW_CRIT_BONUS : 0;
}

/** Momentum multiplier for weakness hits during an open window. */
export function windowMomentumMult(state: WeaknessWindowState | undefined): number {
  return windowActive(state) ? WINDOW_MOMENTUM_MULT : 1;
}
