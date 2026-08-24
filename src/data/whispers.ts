// ============================================================================
// THE HOLLOW BENEATH — Whispers
// Tier-1 ambient narrative delivery (GDD §7.3). Short, non-blocking, never
// gates or interrupts gameplay. Picked and paced by WhisperSystem.
// ============================================================================
import type { WhisperDef } from './types';

export const WHISPERS: WhisperDef[] = [
  // ---- Stable (0-24): quiet, curious, mostly harmless -----------------------
  { id: 'w_stable_01', tier: 'stable', context: 'movement', text: 'Something down here is very old, and very patient.' },
  { id: 'w_stable_02', tier: 'stable', context: 'movement', text: 'The dust has not been disturbed in longer than you want to think about.' },
  { id: 'w_stable_03', tier: 'stable', context: 'movement', text: 'You could swear the corridor was shorter a moment ago.' },
  { id: 'w_stable_04', tier: 'stable', context: 'movement', text: 'A draft, from somewhere that should not have any air left in it.' },
  { id: 'w_stable_05', tier: 'stable', context: 'movement', text: 'Your footsteps sound almost, but not quite, like two people walking.' },
  { id: 'w_stable_06', tier: 'stable', context: 'combat', text: 'It fights like it has done this before. Many times. To many people.' },
  { id: 'w_stable_07', tier: 'stable', context: 'combat', text: 'For a moment you could swear it hesitated before striking.' },
  { id: 'w_stable_08', tier: 'stable', context: 'movement', text: 'You catch yourself rereading your own notes, as if someone else wrote them.' },
  { id: 'w_stable_09', tier: 'stable', context: 'movement', text: 'The tablet in your pack is warm. It has never been warm before.' },
  { id: 'w_stable_10', tier: 'stable', context: 'movement', text: 'Somewhere far below, something exhales.' },
  { id: 'w_stable_11', tier: 'stable', context: 'movement', text: 'You almost remember a word in a language you have never studied.' },
  { id: 'w_stable_12', tier: 'stable', context: 'combat', text: 'It is not looking at you. It is looking at what you are about to decide.' },
  { id: 'w_stable_13', tier: 'stable', context: 'movement', text: "Curiosity is not a flaw. It is just the part of you that hasn't been hurt yet." },

  // ---- Awakened (25-49): it has started noticing you back -------------------
  { id: 'w_awakened_01', tier: 'awakened', context: 'movement', text: 'The walls remember you now. You can feel them adjusting.' },
  { id: 'w_awakened_02', tier: 'awakened', context: 'movement', text: 'You take a wrong turn and arrive exactly where you meant to go.' },
  { id: 'w_awakened_03', tier: 'awakened', context: 'movement', text: 'A voice, underneath your own thoughts, agreeing with you a half-second early.' },
  { id: 'w_awakened_04', tier: 'awakened', context: 'movement', text: 'You stop to check your reflection. It finishes checking a moment after you do.' },
  { id: 'w_awakened_05', tier: 'awakened', context: 'combat', text: "It isn't trying to kill you anymore. It's trying to finish a sentence." },
  { id: 'w_awakened_06', tier: 'awakened', context: 'combat', text: 'You predict its next move before it makes it. That should worry you more than it does.' },
  { id: 'w_awakened_07', tier: 'awakened', context: 'combat', text: 'For one exchange, you and it move like the same idea, twice.' },
  { id: 'w_awakened_08', tier: 'awakened', context: 'movement', text: 'You reread an old choice of yours and no longer remember disagreeing with it.' },
  { id: 'w_awakened_09', tier: 'awakened', context: 'movement', text: 'Your handwriting in the margins is starting to slant like someone else\'s.' },
  { id: 'w_awakened_10', tier: 'awakened', context: 'movement', text: 'It is not following you. It is walking beside you, slightly out of view.' },
  { id: 'w_awakened_11', tier: 'awakened', context: 'movement', text: 'You hum a tune you do not know the name of. It answers, one note behind.' },
  { id: 'w_awakened_12', tier: 'awakened', context: 'combat', text: 'Understanding feels good. That is exactly why it should worry you.' },
  { id: 'w_awakened_13', tier: 'awakened', context: 'movement', text: 'The next page smells, faintly, like somewhere you have already been.' },

  // ---- Unmoored (50-74): the boundary is getting thin ------------------------
  { id: 'w_unmoored_01', tier: 'unmoored', context: 'movement', text: 'You forget, briefly, which thoughts started as yours.' },
  { id: 'w_unmoored_02', tier: 'unmoored', context: 'movement', text: 'Every door here opens outward. You no longer remember which way is out.' },
  { id: 'w_unmoored_03', tier: 'unmoored', context: 'movement', text: 'It speaks now, sometimes, in the gap between one breath and the next.' },
  { id: 'w_unmoored_04', tier: 'unmoored', context: 'combat', text: "It compliments your form mid-strike. You aren't sure if the voice is yours or its." },
  { id: 'w_unmoored_05', tier: 'unmoored', context: 'combat', text: 'You feel its wound as your own for exactly one heartbeat.' },
  { id: 'w_unmoored_06', tier: 'unmoored', context: 'combat', text: 'Winning stops feeling like survival and starts feeling like agreement.' },
  { id: 'w_unmoored_07', tier: 'unmoored', context: 'movement', text: 'You check your own name in your notes, just to be sure it still matches.' },
  { id: 'w_unmoored_08', tier: 'unmoored', context: 'movement', text: 'Your inventory is exactly as you left it. You still count it twice.' },
  { id: 'w_unmoored_09', tier: 'unmoored', context: 'movement', text: 'It says your name. You are almost certain you never told it.' },
  { id: 'w_unmoored_10', tier: 'unmoored', context: 'movement', text: 'You could stop here. You are fairly sure that thought was yours.' },
  { id: 'w_unmoored_11', tier: 'unmoored', context: 'combat', text: 'You both flinch at the same moment. Neither of you was struck.' },
  { id: 'w_unmoored_12', tier: 'unmoored', context: 'movement', text: 'Being known this completely was supposed to feel worse than this.' },

  // ---- Transcendent (75-100): the door is mostly open ------------------------
  { id: 'w_transcendent_01', tier: 'transcendent', context: 'movement', text: 'You are no longer sure the footsteps behind you are behind you.' },
  { id: 'w_transcendent_02', tier: 'transcendent', context: 'movement', text: 'It stopped whispering. It is simply thinking, and you are simply overhearing.' },
  { id: 'w_transcendent_03', tier: 'transcendent', context: 'movement', text: 'The next hundred pages, and the hundred after, arrive in your mind unread and already familiar.' },
  { id: 'w_transcendent_04', tier: 'transcendent', context: 'combat', text: 'You already know how this exchange ends. You let it happen anyway, out of something like courtesy.' },
  { id: 'w_transcendent_05', tier: 'transcendent', context: 'combat', text: 'It fights you the way you fight yourself, on the nights you cannot sleep.' },
  { id: 'w_transcendent_06', tier: 'transcendent', context: 'movement', text: 'You reread your own history and it reads, now, like something you are proud of and grieving at once.' },
  { id: 'w_transcendent_07', tier: 'transcendent', context: 'movement', text: "It is not asking permission anymore. It stopped needing to somewhere around page eighty." },
  { id: 'w_transcendent_08', tier: 'transcendent', context: 'movement', text: 'You finish its sentence. It finishes yours. Neither of you notices anymore whose idea it was.' },
  { id: 'w_transcendent_09', tier: 'transcendent', context: 'movement', text: 'Somewhere, very close now, something that used to be many people is glad you came this far.' },
  { id: 'w_transcendent_10', tier: 'transcendent', context: 'combat', text: 'The fear is still there. It is just filed under something gentler now.' },
  { id: 'w_transcendent_11', tier: 'transcendent', context: 'combat', text: "It isn't an enemy anymore. You aren't sure either of you noticed the exact page that changed on." },
  { id: 'w_transcendent_12', tier: 'transcendent', context: 'movement', text: 'You are almost at the end. You are no longer entirely sure "you" is the right word for who arrives.' },
];

export function whispersForTier(tier: WhisperDef['tier']): WhisperDef[] {
  return WHISPERS.filter((w) => w.tier === tier);
}

export const TOTAL_WHISPERS = WHISPERS.length;
