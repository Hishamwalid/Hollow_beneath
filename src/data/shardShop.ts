import type { ShardShopEntry } from './types';

export const SHARD_SHOP: ShardShopEntry[] = [
  { id: 'rusty_dagger_plus', name: "Rusty Dagger+", cost: 50, description: 'Starting weapon +1 ATK.' },
  { id: 'scholars_coat', name: "Scholar's Coat", cost: 100, description: 'Starting armour +1 DEF.' },
  { id: 'venn_fragment', name: 'Venn Fragment', cost: 150, description: 'Start with 1 random lore fragment known.' },
  { id: 'sable_blessing', name: 'Sable Blessing', cost: 200, description: 'Start with +10 Sable Influence.' },
  { id: 'archive_clearance', name: 'Archive Clearance', cost: 200, description: 'Start with +10 Archive Influence.' },
  { id: 'covenant_whisper', name: 'Covenant Whisper', cost: 200, description: 'Start with +10 Covenant Influence.' },
  { id: 'caravan_map', name: 'Caravan Map', cost: 200, description: 'Start with +10 Caravan Influence.' },
  { id: 'resonance_anchor', name: 'Resonance Anchor', cost: 300, description: 'Start with Resonance = 10 (Awakened tier).' },
  { id: 'survivors_mark', name: "Survivor's Mark", cost: 400, description: '+5% dodge, permanently.' },
  { id: 'true_sight', name: 'True Sight', cost: 500, description: 'Analyze costs 0 AP.' },
  { id: 'new_game_plus', name: 'New Game+', cost: 1000, description: 'Enemies scale up. Keep contradiction knowledge across runs.' },
];

export const ECHO_SHARD_RATES = {
  perNode: 1,
  perLandmark: 5,
  perEnding: 10,
  perLoreFragment: 2,
  deathRefundPercent: 50,
};
