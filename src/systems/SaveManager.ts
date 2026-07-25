import type { GameState, MetaState, PlayerState, SaveBlob } from '@data/types';

const STORAGE_KEY = 'hollow_beneath_save_v1';
const VERSION = 1;

function simpleChecksum(payload: string): string {
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (Math.imul(31, hash) + payload.charCodeAt(i)) | 0;
  }
  return hash.toString(16);
}

export function defaultMeta(): MetaState {
  return {
    echoShards: 0,
    purchasedUnlocks: [],
    bestRun: { page: 0, time: 0 },
    totalRuns: 0,
    endingsAchieved: [],
    loreFragmentsSeen: [],
    bossesEverDefeated: [],
    deathCount: 0,
  };
}

function payloadOf(meta: MetaState, activeRun: SaveBlob['activeRun']): string {
  return JSON.stringify({ meta, activeRun });
}

export function saveGame(meta: MetaState, activeRun: SaveBlob['activeRun']): void {
  try {
    const payload = payloadOf(meta, activeRun);
    const blob: SaveBlob = { version: VERSION, checksum: simpleChecksum(payload), meta, activeRun };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  } catch (e) {
    console.error('Save failed', e);
  }
}

export function loadGame(): { meta: MetaState; activeRun: SaveBlob['activeRun'] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { meta: defaultMeta(), activeRun: null };
    const blob: SaveBlob = JSON.parse(raw);
    const payload = payloadOf(blob.meta, blob.activeRun);
    if (simpleChecksum(payload) !== blob.checksum) {
      console.warn('Save checksum mismatch — save may be corrupted. Loading fresh meta.');
      return { meta: defaultMeta(), activeRun: null };
    }
    if (!blob.meta) return { meta: defaultMeta(), activeRun: null };
    return { meta: blob.meta, activeRun: blob.activeRun ?? null };
  } catch (e) {
    console.error('Load failed', e);
    return { meta: defaultMeta(), activeRun: null };
  }
}

export function clearActiveRun(meta: MetaState): void {
  saveGame(meta, null);
}

export function hasSave(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/** Deep-clones the current player state into the checkpoint slot of a GameState. */
export function takeCheckpoint(game: GameState, player: PlayerState): GameState {
  return {
    ...game,
    checkpointPage: game.currentPage,
    checkpointSnapshot: JSON.parse(JSON.stringify(player)) as PlayerState,
  };
}

/** Restores player + board position to the last checkpoint after a death. */
export function restoreCheckpoint(game: GameState): { game: GameState; player: PlayerState | null } {
  if (!game.checkpointSnapshot) return { game: { ...game, isDead: false }, player: null };
  const restoredPlayer = JSON.parse(JSON.stringify(game.checkpointSnapshot)) as PlayerState;
  const firstNodeOfPage = (game.checkpointPage - 1) * 10 + 1;
  const restoredGame: GameState = {
    ...game,
    currentNodeIndex: firstNodeOfPage,
    currentPage: game.checkpointPage,
    isDead: false,
  };
  return { game: restoredGame, player: restoredPlayer };
}
