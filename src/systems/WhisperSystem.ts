// ============================================================================
// THE HOLLOW BENEATH — Whisper System
// Ambient, non-blocking lore delivery (GDD §7.3, Tier 1). Never gates
// gameplay: callers fire-and-forget this on movement/combat-start/menu
// transitions, and simply skip rendering if it returns null.
// ============================================================================
import { WHISPERS } from '@data/whispers';
import type { WhisperDef } from '@data/types';
import { resonanceTier } from './ResonanceSystem';

/** ids shown recently, oldest first; kept short so variety returns quickly */
let recentlyShown: string[] = [];

/**
 * Roll for whether a whisper should appear right now.
 * `chance` defaults to ~1-in-6 so whispers stay ambient, not constant.
 * Returns null most of the time by design — callers should treat null as "show nothing."
 */
export function maybePickWhisper(
  resonance: number,
  context: WhisperDef['context'],
  rng: () => number = Math.random,
  chance = 0.18
): WhisperDef | null {
  if (rng() > chance) return null;

  const tier = resonanceTier(resonance);
  const notRecent = (w: WhisperDef) => !recentlyShown.includes(w.id);

  const exact = WHISPERS.filter((w) => w.tier === tier && w.context === context && notRecent(w));
  const sameTier = exact.length > 0 ? exact : WHISPERS.filter((w) => w.tier === tier && notRecent(w));
  const pool = sameTier.length > 0 ? sameTier : WHISPERS.filter((w) => w.tier === tier);

  if (pool.length === 0) return null;

  const pick = pool[Math.floor(rng() * pool.length)];
  recentlyShown.push(pick.id);
  if (recentlyShown.length > 8) recentlyShown.shift();
  return pick;
}

/** Call on new-run start so a fresh save doesn't inherit the previous run's anti-repeat memory. */
export function resetWhisperHistory(): void {
  recentlyShown = [];
}
