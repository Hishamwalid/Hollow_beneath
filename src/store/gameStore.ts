import { create } from 'zustand';
import type { EquipmentBonuses } from '@data/stats';
import { computeDerivedStats, STARTING_EQUIPMENT_BONUSES, getEquipmentBonuses } from '@data/stats';
import { STARTING_FACTIONS } from '@data/factions';
import { STARTING_INVENTORY } from '@data/items';
import { STAT_MAX } from '@data/stats';
import type { GameState, PlayerState, StatBlock, BestRunStats, RunStats, Equipment, ClassId } from '@data/types';
import { generateBoard } from '@systems/BoardGenerator';
import { mulberry32, randomSeed } from '@systems/rng';
import { defaultMeta, loadGame, saveGame, takeCheckpoint, restoreCheckpoint } from '@systems/SaveManager';
import { applyUnlocksToNewRun, deathRefund, shardsForEnding } from '@systems/EchoShardSystem';
import { computeLevelUp, MAX_LEVEL } from '@systems/LevelSystem';
import { SKILL_TREES } from '@data/skillTree';
import { CLASSES } from '@data/classes';
import { TOTAL_MAJOR_BOSSES } from '@data/bosses';
import { getLoreFragment, TOTAL_LORE_FRAGMENTS } from '@data/loreFragments';
import { resonanceTier, TIER_LABELS } from '@systems/ResonanceSystem';

export function createStartingPlayer(stats: StatBlock, purchasedUnlocks: string[], totalRuns = 0, classId: ClassId = 'balanced'): PlayerState {
  const derived = computeDerivedStats(stats, STARTING_EQUIPMENT_BONUSES as EquipmentBonuses);
  const classDef = CLASSES.find((c) => c.id === classId);
  const skillsKnown = classDef ? [classDef.passive.id, classDef.signature.id] : [];
  const skillTreePurchases = classDef ? { [classId]: 2 } : {};
  const player: PlayerState = {
    stats,
    derived,
    currentHP: derived.maxHP,
    currentMP: derived.maxMP,
    level: 1,
    xp: 0,
    skillPoints: 0,
    skillTreePurchases,
    skillsKnown,
    resonance: 0,
    resonancePeak: 0,
    faction: { ...STARTING_FACTIONS },
    equipment: { weapon: 'rusty_dagger', armour: 'leather_vest', accessory: null, focus: 'cracked_lens' },
    inventory: STARTING_INVENTORY.map((i) => ({ ...i })),
    companions: [],
    flags: {},
    history: [],
    loreFragments: [],
    enemiesKilled: 0,
    bossesDefeated: [],
    momentum: 0,
    classId,
    fatigue: 0,
    insight: 0,
    fearGauge: 0,
    position: 'middle',
    echoShards: 0,
    unlocks: [...purchasedUnlocks],
    gold: 50,
    totalRuns,
    bestRun: { page: 0, time: 0, nodesVisited: 0, enemiesKilled: 0, bossesDefeated: 0, levelReached: 1, resonancePeak: 0, choicesMade: 0, loreFound: 0 },
  };
  applyUnlocksToNewRun(player, purchasedUnlocks);
  return player;
}

function computeRunStatsImpl(
  player: PlayerState,
  game: GameState,
  meta: ReturnType<typeof defaultMeta>,
  earnedShards: number,
  endingId: string | null,
): RunStats {
  const peak = player.resonance > player.resonancePeak ? player.resonance : player.resonancePeak;
  const isBetter = game.currentPage > meta.bestRun.page ||
    (game.currentPage === meta.bestRun.page && (Date.now() - game.runStartedAt) < meta.bestRun.time);
  const newLoreIds = player.loreFragments.filter(id => !meta.loreFragmentsSeen.includes(id));
  const newLoreTitles = newLoreIds.map(id => getLoreFragment(id)?.title ?? id);
  return {
    nodesVisited: game.path.length,
    enemiesKilled: player.enemiesKilled,
    bossesDefeated: player.bossesDefeated.length,
    totalBosses: TOTAL_MAJOR_BOSSES,
    levelReached: player.level,
    resonancePeak: peak,
    resonanceTier: TIER_LABELS[resonanceTier(peak)],
    choicesMade: game.choicesMade,
    loreFound: player.loreFragments.length,
    totalLore: TOTAL_LORE_FRAGMENTS,
    runTimeSeconds: Math.floor((Date.now() - game.runStartedAt) / 1000),
    newLoreIds,
    newLoreTitles,
    echoShardsEarned: earnedShards,
    totalEchoShards: meta.echoShards + earnedShards,
    bestRun: meta.bestRun,
    pageReached: game.currentPage,
    endingUnlocked: endingId,
    isNewBest: isBetter && meta.bestRun.page > 0,
  };
}

interface GameStore {
  meta: ReturnType<typeof defaultMeta>;
  player: PlayerState | null;
  game: GameState | null;

  initFromDisk: () => void;
  startNewRun: (stats: StatBlock, classId?: ClassId) => void;
  loadActiveRun: () => boolean;
  persist: () => void;
  recordCheckpoint: () => void;
  handleDeath: () => void;
  finalizeRun: (endingId: string) => void;
  playerHistorySet: () => Set<string>;
  addXp: (amount: number) => number;
  awardStatPoint: (stat: keyof StatBlock) => void;
  awardSkillPoint: () => void;
  consumeSkillPoint: () => void;
  purchaseSkillTreeTier: (treeId: string, skillId: string) => boolean;
  resetSkillTreePurchases: () => void;
  computeRunStats: () => RunStats | null;
  equipItem: (slot: keyof Equipment, itemId: string | null) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  meta: defaultMeta(),
  player: null,
  game: null,

  initFromDisk: () => {
    const { meta, activeRun } = loadGame();
    set({ meta, player: activeRun?.player ?? null, game: activeRun?.game ?? null });
  },

  startNewRun: (stats: StatBlock, classId?: ClassId) => {
    const { meta } = get();
    const seed = randomSeed();
    const rng = mulberry32(seed);
    const player = createStartingPlayer(stats, meta.purchasedUnlocks, meta.totalRuns, classId);
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
      checkpointNodeIndex: 0,
      checkpointSnapshot: JSON.parse(JSON.stringify(player)),
      deathNodeIndex: null,
      pendingNodeIndex: null,
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
      if (player.resonance > player.resonancePeak) {
        player.resonancePeak = player.resonance;
      }
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
    const runStats = computeRunStatsImpl(player, game, meta, refund, null);
    const newMeta = {
      ...meta,
      echoShards: meta.echoShards + refund,
      deathCount: meta.deathCount + 1,
      loreFragmentsSeen: Array.from(new Set([...meta.loreFragmentsSeen, ...player.loreFragments])),
      lastRunStats: runStats,
    };
    if (game.checkpointPage === 0) {
      set({ meta: newMeta, player: null, game: null });
      get().persist();
      return;
    }
    const { game: restoredGame, player: restoredPlayer } = restoreCheckpoint({ ...game, deathNodeIndex: game.currentNodeIndex, isDead: true });
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
    const peak = player.resonance > player.resonancePeak ? player.resonance : player.resonancePeak;
    const runTime = Date.now() - game.runStartedAt;
    const currentRunStats: BestRunStats = {
      page: game.currentPage,
      time: runTime,
      nodesVisited: game.path.length,
      enemiesKilled: player.enemiesKilled,
      bossesDefeated: player.bossesDefeated.length,
      levelReached: player.level,
      resonancePeak: peak,
      choicesMade: game.choicesMade,
      loreFound: player.loreFragments.length,
    };
    const isBetter = game.currentPage > meta.bestRun.page ||
      (game.currentPage === meta.bestRun.page && runTime < meta.bestRun.time);
    const runStats = computeRunStatsImpl(player, game, meta, earned, endingId);
    runStats.isNewBest = isBetter && meta.bestRun.page > 0;
    const newMeta = {
      ...meta,
      echoShards: meta.echoShards + earned,
      totalRuns: meta.totalRuns + 1,
      endingsAchieved: meta.endingsAchieved.includes(endingId) ? meta.endingsAchieved : [...meta.endingsAchieved, endingId],
      loreFragmentsSeen: Array.from(new Set([...meta.loreFragmentsSeen, ...player.loreFragments])),
      bossesEverDefeated: Array.from(new Set([...meta.bossesEverDefeated, ...player.bossesDefeated])),
      bestRun: isBetter ? currentRunStats : meta.bestRun,
      lastRunStats: runStats,
    };
    set({ meta: newMeta, player: null, game: { ...game, isRunActive: false, endingAchieved: endingId } });
    get().persist();
  },

  playerHistorySet: () => new Set(get().player?.history ?? []),

  addXp: (amount: number) => {
    const { player } = get();
    if (!player) return 0;
    if (player.level >= MAX_LEVEL) return 0;
    player.xp += amount;
    const { newLevel, levelsGained } = computeLevelUp(player.xp, player.level);
    const actualLevels = Math.min(levelsGained, MAX_LEVEL - player.level);
    if (actualLevels > 0) {
      player.level += actualLevels;
      player.skillPoints += actualLevels;
      if (player.level >= MAX_LEVEL) player.xp = 0;
      set({ player: { ...player } });
    } else {
      set({ player: { ...player } });
    }
    return actualLevels;
  },

  awardStatPoint: (stat: keyof StatBlock) => {
    const { player } = get();
    if (!player) return;
    if (player.stats[stat] >= STAT_MAX) return;
    player.stats[stat] += 1;
    const bonuses = getEquipmentBonuses(player.equipment);
    const oldHP = player.currentHP;
    const oldMP = player.currentMP;
    player.derived = computeDerivedStats(player.stats, bonuses);
    player.currentHP = Math.min(oldHP, player.derived.maxHP);
    player.currentMP = Math.min(oldMP, player.derived.maxMP);
    set({ player: { ...player } });
    get().persist();
  },

  awardSkillPoint: () => {
    const { player } = get();
    if (!player) return;
    player.skillPoints += 1;
    set({ player: { ...player } });
  },

  consumeSkillPoint: () => {
    const { player } = get();
    if (!player) return;
    if (player.skillPoints > 0) player.skillPoints -= 1;
    set({ player: { ...player } });
  },

  purchaseSkillTreeTier: (treeId: string, skillId: string) => {
    const { player } = get();
    if (!player) return false;
    const tree = SKILL_TREES.find((t) => t.id === treeId);
    if (!tree) return false;
    const node = tree.nodes.find((n) => n.id === skillId);
    if (!node) return false;
    const bought = player.skillTreePurchases[treeId] ?? 0;
    const nodeTierIndex = tree.nodes.indexOf(node);
    if (nodeTierIndex !== bought) return false;
    if (player.skillPoints < node.cost) return false;
    if (player.skillsKnown.includes(skillId)) return false;
    player.skillPoints -= node.cost;
    player.skillTreePurchases[treeId] = (player.skillTreePurchases[treeId] ?? 0) + 1;
    player.skillsKnown.push(skillId);
    set({ player: { ...player } });
    get().persist();
    return true;
  },

  resetSkillTreePurchases: () => {
    const { player } = get();
    if (!player) return;
    player.skillTreePurchases = {};
    set({ player: { ...player } });
  },

  equipItem: (slot: keyof Equipment, itemId: string | null) => {
    const { player } = get();
    if (!player) return;
    const currentId = player.equipment[slot];
    if (currentId === itemId) return;
    if (itemId === null && slot !== 'accessory') return;
    if (itemId !== null) {
      const invIdx = player.inventory.findIndex((i) => i.id === itemId);
      if (invIdx === -1) return;
      const invEntry = player.inventory[invIdx];
      if (invEntry.qty > 1) {
        invEntry.qty -= 1;
      } else {
        player.inventory.splice(invIdx, 1);
      }
    }
    if (currentId !== null) {
      const existing = player.inventory.find((i) => i.id === currentId);
      if (existing) {
        existing.qty += 1;
      } else {
        player.inventory.push({ id: currentId, qty: 1 });
      }
    }
    player.equipment = { ...player.equipment, [slot]: itemId };
    const bonuses = getEquipmentBonuses(player.equipment);
    const oldMaxHP = player.derived.maxHP;
    const oldMaxMP = player.derived.maxMP;
    player.derived = computeDerivedStats(player.stats, bonuses);
    player.currentHP = Math.min(player.currentHP, player.derived.maxHP);
    player.currentMP = Math.min(player.currentMP, player.derived.maxMP);
    set({ player: { ...player } });
    get().persist();
  },

  computeRunStats: () => {
    const { player, game, meta } = get();
    if (!player || !game) return null;
    return computeRunStatsImpl(player, game, meta, player.echoShards, game.endingAchieved);
  },
}));
