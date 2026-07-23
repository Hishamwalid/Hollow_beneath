import type { EndingDef, PlayerState } from './types';

// Order matters: evaluated top-to-bottom, first match wins. Secret ending checked first
// since it is the most specific (and would otherwise be shadowed by broader conditions).
export const ENDINGS: EndingDef[] = [
  {
    id: 'silence',
    name: 'The Silence',
    tone: 'Empty chamber. Nothing. The Loom was a mirror. You were the mystery all along.',
    unlock: 'True New Game+, Loom Perspective',
    secret: true,
    condition: (p) =>
      p.resonance >= 100 &&
      p.faction.sable < 40 &&
      p.faction.archive < 40 &&
      p.faction.covenant < 40 &&
      p.faction.caravan < 40 &&
      p.loreFragments.length >= 6,
    epilogue:
      'The mirrors do not shatter. They simply stop reflecting. You realize, too late and too calmly, that there was never anyone reading you. There was only the shape of a question no one asked. The chamber is silent. You are, for the first time since Keth-7, entirely alone — and entirely yourself.',
  },
  {
    id: 'the_seal',
    name: 'The Seal',
    tone: 'You seal every site. Peace through ignorance.',
    unlock: 'Sable starting blessing',
    condition: (p) => p.resonance <= 24 && p.faction.sable >= 50,
    epilogue:
      'You spend what remains of the expedition budget on masons, not scholars. Every threshold you crossed gets a door, and every door gets a lock. The Loom goes quiet beneath the world again — not defeated, just unheard. Children born after this year will grow up believing the Venn were a myth. You let them.',
  },
  {
    id: 'keepers_legacy',
    name: "The Keeper's Legacy",
    tone: 'Knowledge preserved. History repeats.',
    unlock: 'Archive starting equipment',
    condition: (p) => p.faction.archive >= 50 && p.loreFragments.length >= 15,
    epilogue:
      "Every fragment you carried is catalogued, cross-referenced, sealed behind glass in the Archive's deepest vault — available to the next linguist reckless enough to ask. Mira Tol shakes your hand. 'We preserve everything,' she reminds you, 'including the mistake we're about to let someone else make.'",
  },
  {
    id: 'ascension',
    name: 'The Ascension',
    tone: 'Humanity enters The Loom. Some become gods. Most become static.',
    unlock: 'Covenant starting curse',
    condition: (p) => p.resonance >= 75 && p.faction.covenant >= 50,
    epilogue:
      'You stop resisting the recognition. It does not feel like dying. It feels like finally finishing a sentence you started twenty-seven years ago. Somewhere, a body that used to be Lyra Vane sits down at a table with bread that will never go stale. Somewhere else, something wearing your certainty walks toward the surface, smiling with too many voices.',
  },
  {
    id: 'wanderers_end',
    name: "The Wanderer's End",
    tone: 'You destroy your maps. The world moves on. Smaller. Happier.',
    unlock: 'Caravan starting gold',
    condition: (p) => p.faction.caravan >= 50 && p.enemiesKilled <= 3,
    epilogue:
      "Sera Voss burns your notes for you, without being asked, and doesn't apologize. 'The graveyards of the curious are paved with answers,' she says, 'and you have enough answers to bury a city.' You walk out of the last page with nothing but a waterskin and a very good reason to never look down again.",
  },
  {
    id: 'false_prophet',
    name: 'The False Prophet',
    tone: 'A new religion forms around you. You are worshipped. You are lying.',
    unlock: 'Silver Tongue trait',
    condition: (p) =>
      p.faction.sable >= 25 && p.faction.archive >= 25 && p.faction.covenant >= 25 && p.faction.caravan >= 25,
    epilogue:
      'You told each faction what it needed to hear, and every one of them believed you completely. By the time you reach the surface, there are already songs. You never once lied outright. You just never once told anyone the whole thing. That, it turns out, is worse.',
  },
];

const FALLBACK_ENDING: EndingDef = {
  id: 'unfinished',
  name: 'Unfinished',
  tone: 'No faction claims you. No pattern holds. You simply survived, which The Loom finds more interesting than any allegiance.',
  unlock: 'Nothing new — but the run counts.',
  condition: () => true,
  epilogue:
    'You reach Page 100 belonging to no one\u2019s story but your own. The Loom has no ready category for that. Neither, really, do you.',
};

export function evaluateEnding(player: PlayerState): EndingDef {
  for (const ending of ENDINGS) {
    if (ending.condition(player)) return ending;
  }
  return FALLBACK_ENDING;
}
