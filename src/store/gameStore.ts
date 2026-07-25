import { create } from 'zustand';
import type { EquipmentBonuses } from '@data/stats';
import { computeDerivedStats, STARTING_EQUIPMENT_BONUSES } from '@data/stats';
import { STARTING_FACTIONS } from '@data/factions';
import { STARTING_INVENTORY } from '@data/items';
import type { GameState, PlayerState, StatBlock } from '@data/types';
import { generateBoard } from '@systems/BoardGenerator';
import { mulberry32, randomSeed } from '@systems/rng';
import { defaultMeta, loadGame, saveGame, takeCheckpoint, restoreCheckpoint } from '@systems/SaveManager';
import { applyUnlocksToNewRun, deathRefund, shardsForEnding } from '@systems/EchoShardSystem';

export function createStartingPlayer(stats: StatBlock, purchasedUnlocks: string[]): PlayerState {
  const derived = computeDerivedStats(stats, STARTING_EQUIPMENT_BONUSES as EquipmentBonuses);
  const player: PlayerState = {
    stats,
    derived,
    currentHP: derived.maxHP,
    currentMP: derived.maxMP,
    level: 1,
    xp: 0,
    skillsKnown: [],
    resonance: 0,
    faction: { ...STARTING_FACTIONS },
    equipment: { weapon: 'rusty_dagger', armour: 'leather_vest', accessory: null, focus: 'cracked_lens' },
    inventory: STARTING_INVENTORY.map((i) => ({ ...i })),
    flags: {},
    history: [],
    loreFragments: [],
    enemiesKilled: 0,
    bossesDefeated: [],
    momentum: 0,
    echoShards: 0,
    unlocks: [...purchasedUnlocks],
    gold: 50,
    totalRuns: 0,
    bestRun: { page: 0, time: 0 },
  };
  applyUnlocksToNewRun(player, purchasedUnlocks);
  return player;
}

interface GameStore {
  meta: ReturnType<typeof defaultMeta>;
  player: PlayerState | null;
  game: GameState | null;

  initFromDisk: () => void;
  startNewRun: (stats: StatBlock) => void;
  loadActiveRun: () => boolean;
  persist: () => void;
  recordCheckpoint: () => void;
  handleDeath: () => void;
  finalizeRun: (endingId: string) => void;
  playerHistorySet: () => Set<string>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  meta: defaultMeta(),
  player: null,
  game: null,

  initFromDisk: () => {
    const { meta, activeRun } = loadGame();
    set({ meta, player: activeRun?.player ?? null, game: activeRun?.game ?? null });
  },

  startNewRun: (stats: StatBlock) => {
    const { meta } = get();
    const seed = randomSeed();
    const rng = mulberry32(seed);
    const player = createStartingPlayer(stats, meta.purchasedUnlocks);
    const nodes = generateBoard(rng);
    const game: GameState = {
      currentNodeIndex: 0,
      currentPage: 0,
      path: [],
      rngSeed: seed,
      runStartedAt: Date.now(),
      landings: 0,
      combatRounds: 0,
      choicesMade: 0,
      checkpointPage: 0,
      checkpointSnapshot: JSON.parse(JSON.stringify(player)),
      deathNodeIndex: null,
      nodes,
      isRunActive: true,
      isDead: false,
      endingAchieved: null,
    };
    set({ player, game });
    get().persist();
  },

  loadActiveRun: () => {
    const { game, player } = get();
    return !!(game && player && game.isRunActive);
  },

  persist: () => {
    const { meta, player, game } = get();
    if (player && game) {
      saveGame(meta, { player, game });
    } else {
      saveGame(meta, null);
    }
  },

  recordCheckpoint: () => {
    const { player, game } = get();
    if (!player || !game) return;
    const updated = takeCheckpoint(game, player);
    set({ game: updated });
    get().persist();
  },

  handleDeath: () => {
    const { player, game, meta } = get();
    if (!player || !game) return;
    const refund = deathRefund(player.echoShards);
    const newMeta = {
      ...meta,
      echoShards: meta.echoShards + refund,
      deathCount: meta.deathCount + 1,
      loreFragmentsSeen: Array.from(new Set([...meta.loreFragmentsSeen, ...player.loreFragments])),
    };
    if (game.checkpointPage === 0) {
      set({ meta: newMeta, player: null, game: null });
      get().persist();
      return;
    }
    set({ game: { ...game, deathNodeIndex: game.currentNodeIndex } });
    const { game: restoredGame, player: restoredPlayer } = restoreCheckpoint({ ...game, isDead: true });
    if (restoredPlayer) {
      restoredPlayer.echoShards = Math.max(0, restoredPlayer.echoShards - refund);
      set({ meta: newMeta, player: restoredPlayer, game: restoredGame });
    } else {
      set({ meta: newMeta, player: null, game: null });
    }
    get().persist();
  },

  finalizeRun: (endingId: string) => {
    const { player, game, meta } = get();
    if (!player || !game) return;
    const earned = player.echoShards + shardsForEnding();
    const newMeta = {
      ...meta,
      echoShards: meta.echoShards + earned,
      totalRuns: meta.totalRuns + 1,
      endingsAchieved: meta.endingsAchieved.includes(endingId) ? meta.endingsAchieved : [...meta.endingsAchieved, endingId],
      loreFragmentsSeen: Array.from(new Set([...meta.loreFragmentsSeen, ...player.loreFragments])),
      bossesEverDefeated: Array.from(new Set([...meta.bossesEverDefeated, ...player.bossesDefeated])),
      bestRun: game.currentPage > meta.bestRun.page ? { page: game.currentPage, time: Date.now() - game.runStartedAt } : meta.bestRun,
    };
    set({ meta: newMeta, player: null, game: { ...game, isRunActive: false, endingAchieved: endingId } });
    get().persist();
  },

  playerHistorySet: () => new Set(get().player?.history ?? []),
}));
