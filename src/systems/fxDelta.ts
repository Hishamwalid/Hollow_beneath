// ============================================================================
// THE HOLLOW BENEATH — Cross-scene FX mailbox
// Scenes that mutate player state before transitioning (events, combat) can
// stash "what changed" here; the board flushes it as floating feedback on
// arrival. Deliberately module-local and never persisted.
// ============================================================================

export interface FactionDeltaEntry {
  from: number;
  to: number;
}

export interface PendingBoardFx {
  faction?: Partial<Record<string, FactionDeltaEntry>>;
  gold?: { from: number; to: number };
}

export const pendingBoardFx: PendingBoardFx = {};

/** Records faction/gold diffs between two snapshots for board playback. */
export function stashDeltas(
  before: { faction: Record<string, number>; gold: number },
  after: { faction: Record<string, number>; gold: number },
): void {
  const faction: Partial<Record<string, FactionDeltaEntry>> = {};
  for (const key of Object.keys(after.faction)) {
    const from = before.faction[key] ?? 0;
    const to = after.faction[key] ?? 0;
    if (from !== to) faction[key] = { from, to };
  }
  if (Object.keys(faction).length > 0) pendingBoardFx.faction = faction;
  else delete pendingBoardFx.faction;
  if (before.gold !== after.gold) pendingBoardFx.gold = { from: before.gold, to: after.gold };
  else delete pendingBoardFx.gold;
}

/** Returns and clears stashed FX. */
export function takeBoardFx(): PendingBoardFx {
  const out = pendingBoardFx;
  clearBoardFx();
  return out;
}

export function clearBoardFx(): void {
  delete pendingBoardFx.faction;
  delete pendingBoardFx.gold;
}
