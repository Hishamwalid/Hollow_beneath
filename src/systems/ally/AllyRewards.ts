/**
 * PART 5 — ALLY REWARDS (Phase 5).
 * Formulas that tie companion activity back into the run's currencies:
 * Echo Shards (EchoShardSystem), Resonance (ResonanceSystem), and loyalty
 * (AllyTracking). Pure so the scene can preview numbers before committing.
 */
import { ECHO_SHARD_RATES } from '@data/shardShop';
import { clampResonance } from '../ResonanceSystem';
import type { AllyDef } from './AllyDefs';
import type { AllySaveState } from './AllyTracking';

/** Shards the player receives for spending time with an ally in the Estate. */
export function shardsForAllyVisit(): number {
  return Math.max(1, Math.round(ECHO_SHARD_RATES.perLandmark / 2));
}

/** Shards for bringing an ally to a victory (bonus on top of node shards). */
export function shardsForAllyVictory(loyalty: number): number {
  return Math.max(1, Math.round(ECHO_SHARD_RATES.perNode + loyalty / 25));
}

/** Resonance granted for deepening a bond past a loyalty threshold. */
export function resonanceForBondThreshold(def: AllyDef, state: AllySaveState): number {
  const tiers = [
    { at: 25, amount: 3 },
    { at: 50, amount: 5 },
    { at: 80, amount: 8 },
  ];
  let total = 0;
  for (const t of tiers) {
    if (state.loyalty >= t.at && !state.spentHooks.includes(`bond_${def.id}_${t.at}`)) total += t.amount;
  }
  return total;
}

/** Corruption decay applied to the run's dread counter when an ally rests (scaled by loyalty). */
export function corruptionRelief(state: AllySaveState): number {
  return Math.round(0.5 + state.loyalty / 10);
}

/** Faction approval granted for an ally win in their home region. */
export function factionApprovalGain(def: AllyDef, won: boolean): number {
  return won ? 4 : 1;
}

/** Curated reward preview line used by Estate menus. */
export function allyRewardPreview(def: AllyDef, state: AllySaveState): string {
  const nextTier = [25, 50, 80].find((t) => state.loyalty < t);
  if (nextTier === undefined) return `${def.name} is True to you. No reward remains to be earned.`;
  return `Loyalty ${state.loyalty}/100 — next bond at ${nextTier} (+${resonanceForBondThreshold(def, { ...state, loyalty: nextTier })} Resonance, new ability).`;
}

/** Resonance gain from an ally-driven narrative beat. */
export function allyResonanceGain(base: number, state: AllySaveState): number {
  return clampResonance(base + (state.boundRegions.length > 0 ? 1 : 0));
}