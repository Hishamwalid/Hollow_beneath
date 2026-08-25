import type { BestRunStats, GameState, MetaState, PlayerState, SaveBlob } from '@data/types';
import { MAX_EQUIPPED_SKILLS } from '@data/types';

const STORAGE_KEY = 'hollow_beneath_save_v1';
const VERSION = 10;

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
    bestRun: { chapter: 0, time: 0, nodesVisited: 0, enemiesKilled: 0, bossesDefeated: 0, levelReached: 1, resonancePeak: 0, choicesMade: 0, loreFound: 0 },
    totalRuns: 0,
    endingsAchieved: [],
    loreFragmentsSeen: [],
    bossesEverDefeated: [],
    deathCount: 0,
    lastRunStats: null,
    discoveredAffinities: {},
    bestiaryKills: {},
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

/**
 * Upgrades older save blobs to the current VERSION.
 * v8 = definitive edition: companions removed entirely; PlayerState gains
 * `story` (eveVoiceHeard / motherJournalFound) for the new narrative.
 * v7 = page system removed: GameState.currentPage/checkpointPage and BestRunStats.page
 * are gone (chapter derives from the node index); meta.bestRun.page → chapter.
 * v6 = combat revamp: classes/AP/fatigue/insight/fear/position/skill points are gone;
 * skills use a 6-slot equipped loadout; meta gains Bestiary discovery records.
 */
function migrateBlob(blob: SaveBlob): SaveBlob {
  if (blob.version >= VERSION) return blob;
  const player = blob.activeRun?.player as ((PlayerState & Record<string, unknown>) & { skillPoints?: unknown }) | null | undefined;
  if (player) {
    // Legacy fields are dropped silently — the revamp removed them outright.
    delete (player as Record<string, unknown>).classId;
    delete (player as Record<string, unknown>).fatigue;
    delete (player as Record<string, unknown>).insight;
    delete (player as Record<string, unknown>).fearGauge;
    delete (player as Record<string, unknown>).position;
    player.skillPoints = undefined;
    if (!Array.isArray(player.skillsKnown)) player.skillsKnown = [];
    // First loadout: the six most recently learned skills.
    if (!Array.isArray(player.equippedSkills)) {
      player.equippedSkills = player.skillsKnown.slice(-MAX_EQUIPPED_SKILLS);
    }
    // v8: companions no longer exist; story state is initialized fresh.
    delete (player as Record<string, unknown>).companions;
    if (!player.story || typeof player.story !== 'object') {
      player.story = { eveVoiceHeard: 0, motherJournalFound: false, shardRites: {} };
    }
    // v10: Shard Rite purchase counters.
    if (!player.story.shardRites || typeof player.story.shardRites !== 'object') {
      player.story.shardRites = {};
    }
    // v9: the player names themselves before descending.
    if (typeof player.name !== 'string' || player.name.trim().length === 0) {
      player.name = 'The Listener';
    }
  }
  if (blob.activeRun?.game) {
    const g = blob.activeRun.game as GameState & Record<string, unknown>;
    delete g.currentPage;
    delete g.checkpointPage;
  }
  if (blob.meta) {
    const m = blob.meta as MetaState & Record<string, unknown>;
    if (!m.discoveredAffinities || typeof m.discoveredAffinities !== 'object') m.discoveredAffinities = {};
    if (!m.bestiaryKills || typeof m.bestiaryKills !== 'object') m.bestiaryKills = {};
    if (m.bestRun && typeof m.bestRun === 'object') {
      const br = m.bestRun as BestRunStats & Record<string, unknown>;
      br.chapter = typeof br.chapter === 'number' ? br.chapter : Math.min(5, Math.ceil(((br.page as number) ?? 0) / 4));
      delete br.page;
    }
    delete m.enemyArchive;
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
    checkpointNodeIndex: game.currentNodeIndex,
    checkpointSnapshot: JSON.parse(JSON.stringify(player)) as PlayerState,
  };
}

/** Restores player + board position to the last checkpoint after a death. */
export function restoreCheckpoint(game: GameState): { game: GameState; player: PlayerState | null } {
  if (!game.checkpointSnapshot) return { game: { ...game, isDead: false }, player: null };
  const restoredPlayer = JSON.parse(JSON.stringify(game.checkpointSnapshot)) as PlayerState;
  const restoredNode = game.checkpointNodeIndex ?? 1;
  const restoredGame: GameState = {
    ...game,
    currentNodeIndex: restoredNode,
    isDead: false,
  };
  return { game: restoredGame, player: restoredPlayer };
}
