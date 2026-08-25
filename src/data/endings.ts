// ============================================================================
// THE HOLLOW BENEATH — Definitive Edition endings
// Three witnessed fates — and one that is only offered to those who already
// know what the Loom sounds like when it stops.
//
// The cycle:
//   • Defeat the Final Reflection → you become the next Hollow (THE HOLLOW)
//   • Lose and accept the dark    → you become a lost thing in the walls
//   • Lose and climb              → you make it home, and forget how to breathe
//   • New Game+, having silenced the Loom twice and reached Transcendent
//     resonance → you unask the question (THE SILENCE — hidden ending)
//
// Faction influence does not gate endings — it colors the epilogue overlay
// (see FACTION_EPILOGUES).
// ============================================================================

import type { EndingDef, FactionState, PlayerState } from './types';

export const ENDINGS: EndingDef[] = [
  {
    id: 'the_silence',
    name: 'THE SILENCE',
    tone: 'You answered the question by unasking it.',
    unlock: 'True New Game+ · Loom-silenced · Transcendent',
    condition: (p) =>
      !!p.flags.ng_plus && !!p.flags.silence_path_unlocked && !!p.flags.loom_silenced && p.resonance >= 75,
    epilogue: [
      'The Final Reflection opens its mouth — and you speak first.',
      '',
      'Not an answer. A refusal of the grammar. You say the sentence the Venn never finished, backward, in the old cadence, and the chamber listens the way a held breath listens.',
      '',
      'THE LOOM (not a voice, but a harmony): "...oh."',
      '',
      'One note. Almost human. Almost disappointed. Then the gold drains out of the walls like light leaving water, and for the first time in five thousand years, nothing down here is singing.',
      '',
      'You climb. It takes weeks. The tunnels do not breathe — they have stopped pretending to be alive, and the honesty suits them.',
      '',
      'The surface believes you when you tell them it is over. Seekers stop dreaming. The factions scatter, purposeless, arguing over ruins that no longer argue back.',
      '',
      'You grow old in a small room with dust on every surface except one desk, wiped clean, out of habit rather than hope.',
      '',
      'Sometimes, at the very edge of sleep, you listen for her.',
      '',
      'The silence says nothing back. That was the price. That was always the price: not power, not escape — just room. Room where a voice used to be.',
      '',
      'You live inside the room for a long time.',
    ].join('\n'),
  },
  {
    id: 'the_hollow',
    name: 'THE HOLLOW',
    tone: 'You finished the thought.',
    unlock: 'Defeat the Final Reflection.',
    condition: (p) => !!p.flags.final_reflection_defeated,
    epilogue: [
      'The Final Reflection collapses. Shatters like a mirror. You stand alone in the Final Chamber. The Loom hums — something between a mirror and a choir. The power is real. It floods into you. Absolute. Unimaginable. And empty.',
      '',
      'THE LOOM (not a voice, but a harmony): "You finished the thought."',
      '',
      'You look at your hands. They are translucent. Changing. You feel the entire Beneath breathing through you. You feel every Seeker who has ever walked these halls. You feel Eve.',
      '',
      'And then you hear it one last time — the voice from the empty camp, from the room of scratched portraits, from the tunnels that breathe. You know it anywhere now. It was never the Loom. It was never the stone. It was always her.',
      '',
      'EVE, fading: "I\'m sorry."',
      '',
      'You understand now. The Reflection wasn\'t the final boss. It was the previous Hollow. And by defeating it, you have taken its place. You are the new guardian. The new promise. The new dream.',
      '',
      'You sit on the throne of dust and silver. You wait. Time loses meaning.',
      '',
      'A new Seeker appears at the chamber entrance. Young. Fever-bright eyes. They have dreamed the dream.',
      '',
      'You stand. You raise a hand. Their own techniques appear as shadows around them.',
      '',
      '"Keep walking."',
      '',
      'They smile. They descend.',
      '',
      'The cycle continues. You have become what you defeated. And you will wait here forever, for the next one, and the next, until you forget why you ever wanted to understand.',
    ].join('\n'),
  },
  {
    id: 'lost_in_the_dark',
    name: 'LOST IN THE DARK',
    tone: 'You stopped being a sentence, and became a word.',
    unlock: 'Lose to the Final Reflection. Accept the dark.',
    condition: (p) => !!p.flags.final_reflection_lost && !!p.flags.ending_choice_dark,
    epilogue: [
      'You let go. You sink into the stone. The Beneath accepts you.',
      '',
      'Time passes. Or doesn\'t.',
      '',
      'Later — much later — a new delving party finds a figure in the Warrens. Dust-caked. Wrapped in funerary linen. It does not attack until looked at too long.',
      '',
      'It is a Dust Wight now. Or an Echo-bleached skeleton. It doesn\'t remember its name. It doesn\'t remember Eve. It only remembers to wait, and to watch, and to guard the corridors that form sentences leading to the question.',
      '',
      'You have become part of the Hollow. Not the guardian at the end, but one of the many lost things in between. Forgotten. Eternal. Empty.',
    ].join('\n'),
  },
  {
    id: 'the_return',
    name: 'THE RETURN',
    tone: 'The cycle has not been broken. It has only been delayed.',
    unlock: 'Lose to the Final Reflection. Climb to the surface.',
    condition: (p) => !!p.flags.final_reflection_lost && !!p.flags.ending_choice_climb,
    epilogue: [
      'You climb. The tunnels that descended for days take weeks to climb. You eat what you can find. You drink from underground streams. You crawl toward the light.',
      '',
      'You emerge from the sinkhole. The sun is blinding. You are home.',
      '',
      'But something is wrong.',
      '',
      'You live. You find a place to stay. You try to resume a life. But the memories begin to fade. Not all at once — slowly, like water draining from a cracked cup.',
      '',
      'You forget your mother\'s face. You forget why you went down there. You forget your own name.',
      '',
      'Years pass. You are twenty-one now. Or were. You don\'t know anymore.',
      '',
      'You sit in a small room. Dust on every surface. You hold a journal you cannot read. You know it meant something once. You know she meant something once.',
      '',
      'You try to breathe.',
      '',
      'You have forgotten how.',
      '',
      'The journal falls open to the final page. The handwriting is not Eve\'s anymore. It is yours. Shaky, childlike:',
      '',
      '"The Deep stares at you. The emotion in its gaze is the comfort of freedom itself."',
      '',
      'Somewhere in the Beneath, the Hollow waits for the next Seeker. The next child who will find this journal and wonder what happened.',
    ].join('\n'),
  },
];

/** Resolves the ending from outcome flags (falls through in ENDINGS order). */
export function evaluateEnding(player: PlayerState): EndingDef {
  for (const ending of ENDINGS) {
    if (ending.condition(player)) return ending;
  }
  // The default fate is the cycle's front door — never the hidden one above it.
  return ENDINGS.find((e) => e.id === 'the_hollow') ?? ENDINGS[0];
}

export function getEnding(id: string): EndingDef | undefined {
  return ENDINGS.find((e) => e.id === id);
}

// ---- Faction epilogue overlays ---------------------------------------------

/**
 * Faction influence no longer decides WHICH ending happens — it decides what
 * the surface world believes happened afterward. Shown during credits.
 * Tie priority: Sable > Archive > Covenant > Caravan.
 */
export const FACTION_EPILOGUES: Record<string, string> = {
  sable: 'The Sable Order sealed the sinkhole. No one descends. But the Hollow does not need an entrance. It only needs a dream.',
  archive: 'The Archive set down its annals of the Delving of Keth. Your name is a footnote. In a thousand years, someone will read it and descend anyway.',
  covenant: 'The Ash Covenant still sings in the deep. They believe you were translated, not lost. They are not wrong.',
  caravan: 'The Caravan sells maps to the sealed place. In their version, you simply walked home. The Caravan prefers endings you can pack in a satchel.',
};

export const INDEPENDENT_EPILOGUE =
  'No faction claims you. The truth becomes fragmented. The cycle does not need witnesses. It only needs participants.';

/** Picks the epilogue overlay for the credits based on highest faction ≥25. */
export function factionEpilogue(faction: FactionState): string {
  let best: keyof FactionState | null = null;
  let bestVal = 0;
  const order: Array<keyof FactionState> = ['sable', 'archive', 'covenant', 'caravan'];
  for (const key of order) {
    if (faction[key] > bestVal) {
      best = key;
      bestVal = faction[key];
    }
  }
  if (!best || bestVal < 25) return INDEPENDENT_EPILOGUE;
  return FACTION_EPILOGUES[best] ?? INDEPENDENT_EPILOGUE;
}
