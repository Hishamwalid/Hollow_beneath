import type { MetaState, PlayerState } from '@data/types';
import { ECHO_SHARD_RATES, SHARD_SHOP } from '@data/shardShop';

export function shardsForNodeVisit(): number {
  return ECHO_SHARD_RATES.perNode;
}

export function shardsForLandmark(): number {
  return ECHO_SHARD_RATES.perLandmark;
}

export function shardsForEnding(): number {
  return ECHO_SHARD_RATES.perEnding;
}

export function shardsForLoreFragment(): number {
  return ECHO_SHARD_RATES.perLoreFragment;
}

/** Wraps a raw Echo Shard amount with the Archival Insight passive's +10% bonus, if known. Use at every shard-granting site. */
export function applyShardBonus(player: PlayerState, amount: number): number {
  if (player.skillsKnown.includes('archival_insight')) {
    return Math.round(amount * 1.1);
  }
  return amount;
}

export function deathRefund(earnedThisRun: number): number {
  return Math.floor((earnedThisRun * ECHO_SHARD_RATES.deathRefundPercent) / 100);
}

export function canAfford(meta: MetaState, entryId: string): boolean {
  const entry = SHARD_SHOP.find((e) => e.id === entryId);
  if (!entry) return false;
  if (meta.purchasedUnlocks.includes(entryId)) return false;
  return meta.echoShards >= entry.cost;
}

export function purchase(meta: MetaState, entryId: string): MetaState {
  const entry = SHARD_SHOP.find((e) => e.id === entryId);
  if (!entry || !canAfford(meta, entryId)) return meta;
  return {
    ...meta,
    echoShards: meta.echoShards - entry.cost,
    purchasedUnlocks: [...meta.purchasedUnlocks, entryId],
  };
}

/** Applies purchased shard-shop unlocks to a freshly created run's starting PlayerState. */
export function applyUnlocksToNewRun(player: PlayerState, unlocks: string[]): void {
  if (unlocks.includes('rusty_dagger_plus')) player.derived.attack += 1;
  if (unlocks.includes('scholars_coat')) player.derived.defense += 1;
  if (unlocks.includes('venn_fragment') && !player.loreFragments.includes('venn_fragment_starter')) {
    player.loreFragments.push('venn_fragment_starter');
  }
  if (unlocks.includes('sable_blessing')) player.faction.sable += 10;
  if (unlocks.includes('archive_clearance')) player.faction.archive += 10;
  if (unlocks.includes('covenant_whisper')) player.faction.covenant += 10;
  if (unlocks.includes('caravan_map')) player.faction.caravan += 10;
  if (unlocks.includes('resonance_anchor')) player.resonance = Math.max(player.resonance, 25);
  if (unlocks.includes('survivors_mark')) player.derived.dodge = Math.min(45, player.derived.dodge + 5);
  if (unlocks.includes('true_sight')) player.flags.true_sight = true;
}
