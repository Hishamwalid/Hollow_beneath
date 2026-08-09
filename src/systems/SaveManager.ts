import type { GameState, MetaState, PlayerState, SaveBlob } from '@data/types';
import { CLASS_OF_PRESET, closestPresetName } from '@data/stats';

const STORAGE_KEY = 'hollow_beneath_save_v1';
const VERSION = 5;

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
    bestRun: { page: 0, time: 0, nodesVisited: 0, enemiesKilled: 0, bossesDefeated: 0, levelReached: 1, resonancePeak: 0, choicesMade: 0, loreFound: 0 },
    totalRuns: 0,
    endingsAchieved: [],
    loreFragmentsSeen: [],
    bossesEverDefeated: [],
    deathCount: 0,
    lastRunStats: null,
    enemyArchive: {},
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

/** Upgrades older save blobs to the current VERSION by injecting defaults for new player fields. */
function migrateBlob(blob: SaveBlob): SaveBlob {
  if (blob.version >= VERSION) return blob;
  const player = blob.activeRun?.player as (PlayerState & Record<string, unknown>) | null | undefined;
  if (player) {
    if (!player.classId) player.classId = CLASS_OF_PRESET[closestPresetName(player.stats)] ?? 'balanced';
    if (typeof player.fatigue !== 'number') player.fatigue = 0;
    if (typeof player.insight !== 'number') player.insight = 0;
    if (typeof player.fearGauge !== 'number') player.fearGauge = 0;
    if (!player.position) player.position = 'middle';
    // Phase 5: v3 saves predate companions.
    if (!Array.isArray(player.companions)) player.companions = [];
  }
  // Phase 6c: v4 saves predate the persistent enemy archive.
  if (blob.meta && (!blob.meta.enemyArchive || typeof blob.meta.enemyArchive !== 'object')) {
    blob.meta = { ...blob.meta, enemyArchive: {} };
  }
  blob.version = VERSION;
  return blob;
}

export function loadGame(): { meta: MetaState; activeRun: SaveBlob['activeRun'] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { meta: defaultMeta(), activeRun: null };
    const blob: SaveBlob = JSON.parse(raw);
    // Checksum is verified against the *stored* payload (pre-migration), so old saves aren't flagged corrupt.
    const payload = payloadOf(blob.meta, blob.activeRun);
    if (simpleChecksum(payload) !== blob.checksum) {
      console.warn('Save checksum mismatch — save may be corrupted. Loading fresh meta.');
      return { meta: defaultMeta(), activeRun: null };
    }
    const migrated = migrateBlob(blob);
    if (!migrated.meta) return { meta: defaultMeta(), activeRun: null };
    return { meta: migrated.meta, activeRun: migrated.activeRun ?? null };
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
    checkpointNodeIndex: game.currentNodeIndex,
    checkpointSnapshot: JSON.parse(JSON.stringify(player)) as PlayerState,
  };
}

/** Restores player + board position to the last checkpoint after a death. */
export function restoreCheckpoint(game: GameState): { game: GameState; player: PlayerState | null } {
  if (!game.checkpointSnapshot) return { game: { ...game, isDead: false }, player: null };
  const restoredPlayer = JSON.parse(JSON.stringify(game.checkpointSnapshot)) as PlayerState;
  const restoredNode = game.checkpointNodeIndex ?? (game.checkpointPage - 1) * 10 + 1;
  const restoredGame: GameState = {
    ...game,
    currentNodeIndex: restoredNode,
    currentPage: game.checkpointPage,
    isDead: false,
  };
  return { game: restoredGame, player: restoredPlayer };
}
