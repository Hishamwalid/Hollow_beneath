import type { EnemyArchive, EnemyArchiveEntry } from '@data/types';

/** Fragment pool per enemy: each entry is fully catalogued after we add 3 fragments. */
export const ARCHIVE_FRAGMENT_NAMES = [
  'Physiology',
  'Tactics',
  'Memories',
] as const;

/** Number of fragments required to complete an archive entry. */
export const ARCHIVE_FRAGMENT_COUNT = ARCHIVE_FRAGMENT_NAMES.length;

/** Deterministic fragment label for an enemy + slot. */
export function archiveFragmentLabel(enemyId: string, index: number): string {
  return `${enemyId}::${ARCHIVE_FRAGMENT_NAMES[index % ARCHIVE_FRAGMENT_COUNT]}`;
}

export function emptyArchive(): EnemyArchive {
  return {};
}

export function emptyEntry(): EnemyArchiveEntry {
  return { fragments: [], exploited: false };
}

/** Adds the next missing fragment to an enemy's archive entry. Returns the entry (mutated). */
export function addArchiveFragment(
  archive: EnemyArchive,
  enemyId: string,
): { entry: EnemyArchiveEntry; added: boolean; complete: boolean } {
  const entry = archive[enemyId] ?? emptyEntry();
  if (entry.fragments.length >= ARCHIVE_FRAGMENT_COUNT) {
    return { entry, added: false, complete: true };
  }
  const next = entry.fragments.length;
  if (!entry.fragments.includes(archiveFragmentLabel(enemyId, next))) {
    entry.fragments.push(archiveFragmentLabel(enemyId, next));
  }
  if (entry.fragments.length >= ARCHIVE_FRAGMENT_COUNT) entry.exploited = true;
  archive[enemyId] = entry;
  return { entry, added: true, complete: entry.exploited };
}

/** True once an enemy's archive entry is fully catalogued (exploit unlocked). */
export function archiveExploited(archive: EnemyArchive, enemyId: string): boolean {
  const entry = archive[enemyId];
  return entry ? entry.exploited : false;
}

/** Damage multiplier while attacking an enemy whose archive is fully catalogued. */
export function archiveDamageBonus(archive: EnemyArchive, enemyId: string): number {
  return archiveExploited(archive, enemyId) ? 1.15 : 1;
}