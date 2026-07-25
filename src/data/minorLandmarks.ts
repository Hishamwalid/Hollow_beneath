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
    pageRange: [1, 1],
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
    pageRange: [3, 3],
    flavorText:
      'This waystone carries more than one hand\'s work — Sable ash, Archive chalk, a Caravan trail-glyph, all layered on the same stone, none of them addressed to each other. Whoever passes here, they at least agree the road exists.',
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
    pageRange: [5, 5],
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
    pageRange: [7, 7],
    flavorText:
      'A Dominion boundary post, still upright, marking a border for an empire with no remaining side to defend it. Something recent has been left propped against its base — food, long gone to dust, left there anyway.',
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
    pageRange: [9, 9],
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
};

/** Same landmarks, keyed by event id instead of node index, so EventScene can resolve them by id. */
export const MINOR_LANDMARKS_BY_ID: Record<string, EventDef> = Object.fromEntries(
  Object.values(MINOR_LANDMARKS).map((def) => [def.id, def]),
);
