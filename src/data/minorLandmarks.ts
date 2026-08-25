// ============================================================================
// THE HOLLOW BENEATH — Minor Landmarks
// GDD §7.3: "10 Landmark nodes (5 major bosses + 5 minor story beats)".
// These are the 5 minor beats, at the capture-point nodes (10/30/50/70/90).
// Reuses the EventDef shape (rendered by EventScene) but is looked up
// directly by node index in BoardScene — never enters the random event pool.
// Reward baseline matches the previous plain capture-point payout exactly
// (20 + 1d20 gold, +3 Echo Shards); the "linger" choice adds a lore
// fragment and a small thematic bonus on top, it never subtracts the base.
// ============================================================================
import type { EventDef } from './types';

function rollDie(sides: number, rng: () => number): number {
  return Math.floor(rng() * sides) + 1;
}

export const MINOR_LANDMARKS: Record<number, EventDef> = {
  10: {
    id: 'landmark_first_marker',
    title: 'The First Marker',
    chapterRange: [1, 1],
    flavorText:
      'A waystone, waist-high, worn smooth by hands that stopped coming here a long time ago. Someone carved a tally into its base — not of days, it looks like, but of something else entirely. It stops well short of where the stone ends.',
    choices: [
      {
        id: 'keep_moving',
        label: 'Keep moving.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          return `You note the marker and move on. +${gold} gold, +3 Echo Shards.`;
        },
      },
      {
        id: 'read_the_tally',
        label: 'Read the tally.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          ctx.addLoreFragment('the_first_marker');
          return `You count the marks twice, to be sure. Whoever kept this tally stopped on purpose, not by accident. +${gold} gold, +3 Echo Shards, a lore fragment.`;
        },
      },
    ],
  },

  30: {
    id: 'landmark_third_marker',
    title: 'The Third Marker',
    chapterRange: [1, 1],
    flavorText:
      'This waystone carries more than one hand\'s work — Sable ash, Archive chalk, a Caravan trail-glyph, all layered on the same stone, none of them addressed to each other. Whoever passes here, they at least agree the road exists.\n\nAhead, past the last stretch of corridor: gold light. A door — and something standing before it that has been asking travelers a question for a very long time.',
    choices: [
      {
        id: 'keep_moving',
        label: 'Keep moving.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          return `You leave the markers to whoever reads them next. +${gold} gold, +3 Echo Shards.`;
        },
      },
      {
        id: 'add_your_own_mark',
        label: 'Add your own mark.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          ctx.addLoreFragment('the_third_marker');
          const leading = (Object.keys(player.faction) as (keyof typeof player.faction)[]).reduce((a, b) =>
            player.faction[a] >= player.faction[b] ? a : b
          );
          player.faction[leading] += 1;
          return `You scratch a small mark of your own beside the others — not quite any of the three factions' styles, closer to your own. +${gold} gold, +3 Echo Shards, a lore fragment, +1 ${leading}.`;
        },
      },
    ],
  },

  50: {
    id: 'landmark_fifth_marker',
    title: 'The Fifth Marker',
    chapterRange: [2, 2],
    flavorText:
      'Halfway, by any honest count. The air here holds a low, constant hum, too even to be wind — the sound, maybe, of something very large and very far below that has not yet decided whether it has noticed you.',
    choices: [
      {
        id: 'keep_moving',
        label: 'Keep moving. Do not listen too closely.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          return `You keep walking. The hum fades behind you, eventually. +${gold} gold, +3 Echo Shards.`;
        },
      },
      {
        id: 'listen',
        label: 'Stop. Listen.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          ctx.addLoreFragment('the_fifth_marker');
          player.resonance += 2;
          return `You stand still longer than you meant to. The hum does not get louder. It gets more specific. +${gold} gold, +3 Echo Shards, a lore fragment, +2 Resonance.`;
        },
      },
    ],
  },

  70: {
    id: 'landmark_seventh_marker',
    title: 'The Seventh Marker',
    chapterRange: [2, 2],
    flavorText:
      'A Dominion boundary post, still upright, marking a border for an empire with no remaining side to defend it. Something recent has been left propped against its base — food, long gone to dust, left there anyway.\n\nBeyond the post: incense, drifting up from below. Someone keeps a chapel down there. Someone who talks to everyone who passes.',
    choices: [
      {
        id: 'keep_moving',
        label: 'Keep moving.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          return `You leave the offering where it sits. Not yours to take. +${gold} gold, +3 Echo Shards.`;
        },
      },
      {
        id: 'leave_your_own',
        label: 'Leave something of your own beside it.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          ctx.addLoreFragment('the_seventh_marker');
          player.faction.caravan += 1;
          return `You set down a scrap of your own supplies beside the dust. It is a small, useless gesture. You do it anyway. +${gold} gold, +3 Echo Shards, a lore fragment, +1 Caravan.`;
        },
      },
    ],
  },

  90: {
    id: 'landmark_ninth_marker',
    title: 'The Ninth Marker',
    chapterRange: [3, 3],
    flavorText:
      'This close to the end, the waystone carvings stop describing the road and start describing the traveler. Yours is not carved yet. There is, unmistakably, room.',
    choices: [
      {
        id: 'keep_moving',
        label: 'Keep moving. There will be time to think about that later.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          return `You do not look back at the stone. +${gold} gold, +3 Echo Shards.`;
        },
      },
      {
        id: 'trace_the_space',
        label: 'Trace the empty space with your fingers.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          ctx.addLoreFragment('the_ninth_marker');
          player.resonance += 1;
          ctx.setFlag('traced_ninth_marker');
          return `The stone is cold, then, for a moment, exactly body-temperature. You take your hand back first. +${gold} gold, +3 Echo Shards, a lore fragment, +1 Resonance.`;
        },
      },
    ],
  },

  110: {
    id: 'landmark_eleventh_marker',
    title: 'The Eleventh Marker',
    chapterRange: [3, 3],
    flavorText:
      'The stone here is cracked clean through, split by a root that should not grow this deep. The fracture is deliberate — this marker was placed on a fault, as if the Venn wanted it to break.\n\nFarther down, faintly, many voices hold a chord no single throat could. They have been holding it a long time.',
    choices: [
      {
        id: 'keep_moving',
        label: 'Keep moving. The floor feels unstable.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          return `You step around the crack. The root pulses faintly as you pass. +${gold} gold, +3 Echo Shards.`;
        },
      },
      {
        id: 'touch_the_root',
        label: 'Touch the root.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          ctx.addLoreFragment('the_eleventh_marker');
          player.resonance += 2;
          return `The root is warm. It knows you are here. +${gold} gold, +3 Echo Shards, a lore fragment, +2 Resonance.`;
        },
      },
    ],
  },

  130: {
    id: 'landmark_thirteenth_marker',
    title: 'The Thirteenth Marker',
    chapterRange: [4, 4],
    flavorText:
      'A circle of standing stones, each carved with a face. Thirteen faces, each expressing a different emotion, arranged in sequence. The thirteenth face is blank.',
    choices: [
      {
        id: 'keep_moving',
        label: 'Keep moving. Some questions answer themselves badly.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          return `You do not look back at the circle. +${gold} gold, +3 Echo Shards.`;
        },
      },
      {
        id: 'study_the_faces',
        label: 'Study the faces in order.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          ctx.addLoreFragment('the_thirteenth_marker');
          player.faction.archive += 2;
          return `The sequence tells a story you almost understand. The blank face, you realise, is not unfinished — it is waiting. +${gold} gold, +3 Echo Shards, a lore fragment, +2 Archive.`;
        },
      },
    ],
  },

  150: {
    id: 'landmark_fifteenth_marker',
    title: 'The Fifteenth Marker',
    chapterRange: [4, 4],
    flavorText:
      'Three paths converge on this marker, each from a different direction, each worn to a different depth. The marker itself bears only one word, carved in Venn: "Choose."\n\nOne of the three paths is newer than the others — worn by a single traveler, not so long ago, headed the way you are headed.',
    choices: [
      {
        id: 'keep_moving',
        label: 'You already chose. Keep walking.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          return `The word follows you for a few steps, then fades into the stone. +${gold} gold, +3 Echo Shards.`;
        },
      },
      {
        id: 'read_aloud',
        label: 'Read the word aloud.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          ctx.addLoreFragment('the_fifteenth_marker');
          const leading = (Object.keys(player.faction) as (keyof typeof player.faction)[]).reduce((a, b) =>
            player.faction[a] >= player.faction[b] ? a : b
          );
          player.faction[leading] += 2;
          return `The word vibrates in your throat long after you speak it. The stones remember your voice now. +${gold} gold, +3 Echo Shards, a lore fragment, +2 ${leading}.`;
        },
      },
    ],
  },

  170: {
    id: 'landmark_seventeenth_marker',
    title: 'The Seventeenth Marker',
    chapterRange: [5, 5],
    flavorText:
      'A bridge crosses a chasm so deep that light does not reach its bottom. The marker is set into the bridge\'s railing, half-gripped by rust. On the far side: darkness that moves.',
    choices: [
      {
        id: 'cross_quickly',
        label: 'Cross quickly. Do not look down.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          return `The bridge groans but holds. You do not look back. +${gold} gold, +3 Echo Shards.`;
        },
      },
      {
        id: 'look_down',
        label: 'Look into the chasm.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          ctx.addLoreFragment('the_seventeenth_marker');
          player.resonance += 3;
          return `Something looks back. Not eyes — attention. It has been waiting for someone to notice it. +${gold} gold, +3 Echo Shards, a lore fragment, +3 Resonance.`;
        },
      },
    ],
  },

  190: {
    id: 'landmark_nineteenth_marker',
    title: 'The Nineteenth Marker',
    chapterRange: [5, 5],
    flavorText:
      'The penultimate marker. It is smaller than the others — almost an afterthought. The carving is hurried, as if whoever placed it was running out of time. "Almost," it says. "Almost."\n\nThere is nothing after this marker but the door — and whatever behind it wears your face.',
    choices: [
      {
        id: 'keep_moving',
        label: 'Keep moving. Almost there.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          return `You repeat the word to yourself like a prayer. +${gold} gold, +3 Echo Shards.`;
        },
      },
      {
        id: 'read_carefully',
        label: 'Read every mark on the stone.',
        onSuccess: (player, ctx) => {
          const gold = 20 + rollDie(20, ctx.rng);
          player.gold += gold;
          ctx.addEchoShards(3);
          ctx.addLoreFragment('the_nineteenth_marker');
          ctx.setFlag('read_nineteenth_marker');
          return `There is a postscript, nearly invisible: "For my child." Your blood runs cold. +${gold} gold, +3 Echo Shards, a lore fragment, a flag set.`;
        },
      },
    ],
  },
};

/** Same landmarks, keyed by event id instead of node index, so EventScene can resolve them by id. */
export const MINOR_LANDMARKS_BY_ID: Record<string, EventDef> = Object.fromEntries(
  Object.values(MINOR_LANDMARKS).map((def) => [def.id, def]),
);
