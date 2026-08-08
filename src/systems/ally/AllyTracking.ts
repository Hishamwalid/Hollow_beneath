/**
 * PART 5 — ALLY TRACKING (Phase 5).
 * Persisted across encounters: loyalty, corruption resistance per region,
 * and any bond flags an ally has accumulated (revives used, signatures shown).
 * Pure functions operate on plain state so save/load and tests stay trivial.
 */
import type { CompanionState } from '@data/types';
import { ALLY_DEFS, LOYALTY_MAX, tierForLoyalty, type AllyId } from './AllyDefs';

/** Region a companion is anchored to in the save (their "home" node / estate wing). */
export type BoundRegion = 'keth_vor' | 'dominion' | 'sable_edge' | 'covenant_deep';

/** Persisted companion record (defined in the data layer for save compatibility). */
export type AllySaveState = CompanionState;

export function freshAllyState(id: AllyId): AllySaveState {
  return {
    id,
    loyalty: 0,
    spentHooks: [],
    combatCooldowns: [],
    boundRegions: [],
    battlesTogether: 0,
  };
}

/** Merge two states on save-load: keep newer loyalty but preserve bond history. */
export function mergeAllyStates(base: AllySaveState | undefined, incoming: AllySaveState): AllySaveState {
  if (!base) return incoming;
  return {
    ...incoming,
    loyalty: Math.max(0, Math.min(LOYALTY_MAX, incoming.loyalty)),
    spentHooks: [...new Set([...base.spentHooks, ...incoming.spentHooks])],
    combatCooldowns: [...incoming.combatCooldowns],
    boundRegions: [...new Set([...base.boundRegions, ...incoming.boundRegions])],
    battlesTogether: Math.max(base.battlesTogether, incoming.battlesTogether),
  };
}

/** Loyalty earned from an engagement: better on a win, sweetened by bonds. Returns the raw delta. */
export function loyaltyGain(state: AllySaveState, won: boolean): number {
  const winBonus = won ? 12 : 4;
  const bondBonus = state.boundRegions.length > 0 ? 4 : 0;
  const delta = Math.min(LOYALTY_MAX, state.loyalty + winBonus + bondBonus) - state.loyalty;
  state.loyalty = Math.min(LOYALTY_MAX, state.loyalty + delta);
  return delta;
}

/** Corruption decay: allies shed a small fraction of dread each rest (faster when loyal). */
export function corruptionDecay(state: AllySaveState): number {
  return Math.max(0, Math.round(0.5 + state.loyalty / 10));
}

/** Faster gains in the region the ally bonded with (used by lore events). */
export function regionBondMultiplier(state: AllySaveState, region: BoundRegion): number {
  return state.boundRegions.includes(region) ? 1.5 : 1;
}

/** Grants a bond in a region if not already held; small loyalty bump for the trust shown. */
export function bindRegion(state: AllySaveState, region: BoundRegion): AllySaveState {
  if (state.boundRegions.includes(region)) return state;
  return { ...state, boundRegions: [...state.boundRegions, region], loyalty: Math.min(LOYALTY_MAX, state.loyalty + 5) };
}

/** Marks/clears combat cooldowns that gate once-per-fight ally abilities. */
export function hasCooldown(state: AllySaveState, abilityId: string): boolean {
  return state.combatCooldowns.includes(abilityId);
}

export function setCooldown(state: AllySaveState, abilityId: string, used: boolean): AllySaveState {
  if (used && !state.combatCooldowns.includes(abilityId)) {
    return { ...state, combatCooldowns: [...state.combatCooldowns, abilityId] };
  }
  if (!used) {
    return { ...state, combatCooldowns: state.combatCooldowns.filter((c) => c !== abilityId) };
  }
  return state;
}

/** Whether the ally accompanies the player into combat (nominal loyalty). */
export function accompaniesIn(loyalty: number): boolean {
  return loyalty >= 15;
}

/** Marks a hook with a given id (once-per-bond narrative events). */
export function spendHook(state: AllySaveState, hookId: string): AllySaveState {
  if (state.spentHooks.includes(hookId)) return state;
  return { ...state, spentHooks: [...state.spentHooks, hookId] };
}

/** In-save fingerprint for HUD / events. */
export function allyStatusLine(state: AllySaveState): string {
  const tier = tierForLoyalty(state.loyalty);
  const binds = state.boundRegions.length ? ` · bound to ${state.boundRegions.join(', ')}` : '';
  const def = ALLY_DEFS[state.id];
  return `${def.name} — ${tier}${binds}`;
}