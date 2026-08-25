// ============================================================================
// THE HOLLOW BENEATH — Voice System
// Event-driven delivery of the unnamed presence's reactions (see
// data/voiceLines.ts). Fire-and-forget like WhisperSystem: callers roll,
// render if non-null, and move on. Anti-repeat memory lasts one run.
// ============================================================================
import { VOICE_LINES, type VoiceLine, type VoiceTrigger } from '@data/voiceLines';

let recentlyShown: string[] = [];

/** Default trigger chances — dramatic beats fire more often than ambience. */
const DEFAULT_CHANCE: Record<VoiceTrigger, number> = {
  victory: 0.35,
  low_hp: 0.6,
  boss_fall: 0.65,
  lore_found: 0.25,
};

/**
 * Rolls for a voice reaction to a play event. Returns the line text, or null
 * ("show nothing") most of the time by design.
 *
 * `familiarity` is the run's eveVoiceHeard counter — the more of her you have
 * heard, the deeper into each pool the voice reaches. Later lines sit closer
 * to the bone; early lines stay polite. Wording escalates; facts never do.
 */
export function maybeVoiceLine(
  trigger: VoiceTrigger,
  rng: () => number = Math.random,
  chance?: number,
  familiarity = 0,
): string | null {
  const pool = VOICE_LINES[trigger].filter((l) => !recentlyShown.includes(l.id));
  const candidates = pool.length > 0 ? pool : VOICE_LINES[trigger];
  if (candidates.length === 0) return null;
  if (rng() > (chance ?? DEFAULT_CHANCE[trigger])) return null;

  let pick: VoiceLine;
  if (familiarity >= 2 && candidates.length > 2 && rng() < Math.min(0.75, familiarity * 0.18)) {
    // Reach for the closer lines at the back of the pool.
    const tail = candidates.slice(Math.floor(candidates.length / 2));
    pick = tail[Math.floor(rng() * tail.length)];
  } else {
    pick = candidates[Math.floor(rng() * candidates.length)];
  }
  recentlyShown.push(pick.id);
  if (recentlyShown.length > 10) recentlyShown.shift();
  return pick.text;
}

/** Call on new-run start so a fresh run doesn't inherit anti-repeat memory. */
export function resetVoiceHistory(): void {
  recentlyShown = [];
}
