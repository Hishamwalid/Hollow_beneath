import type { EventDef } from './types';

// ============================================================================
// THE HOLLOW BENEATH — Definitive Edition story events
// Pinned to exact board nodes (see PINNED_STORY_EVENTS below). These are
// unskippable narrative beats from the Definitive Narrative Script.
// Boss pre-combat scenes (nodes 40/80/120/160/200) live in bosses.ts.
// ============================================================================

/** Node → story event id. Movement halts at unresolved pinned nodes. */
export const PINNED_STORY_EVENTS: Record<number, string> = {
  1: 'prologue_descent',
  8: 'eves_first_voice',
  15: 'first_blood',
  48: 'the_hollowed_man',
  60: 'the_deep_pages',
  88: 'false_memories',
  92: 'the_memory_room',
  132: 'the_venn_truth',
  155: 'eves_first_journal',
  175: 'ashen_tunnels',
  185: 'eve_reveal',
};

export const STORY_EVENTS: Record<string, EventDef> = {
  // ---- SCENE 1.1 — THE DESCENT (Node 1) ------------------------------------
  prologue_descent: {
    id: 'prologue_descent',
    title: 'The Descent',
    chapterRange: [1, 1],
    flavorText: [
      'You descend through a collapsed sinkhole. Rope creaks. Expedition rope and rusted pitons give way to ashfall corridors ribbed with Venn masonry. Gold light pulses at the far end.',
      '',
      'Three days into the Keth-7 survey. A cave-in at the Chalk Doorway cost the expedition half its supplies and its best geologist. Expedition leader Anya Korr extended the timeline by a week. Then she went silent. Contact with the surface failed yesterday.',
      '',
      'You reach the bottom. A corridor stretches ahead. Bone-white inscriptions almost resolve into words.',
      '',
      'The Hollow is not a dungeon. It is a dead city preserved in cold stone and warm bone. Its architecture is syntax. Corridors form sentences. Rooms are paragraphs. The deeper you descend, the more the structure reads like a question you are walking toward the answer of.',
    ].join('\n'),
    choices: [],
  },

  // ---- SCENE 1.2 — EVE'S FIRST VOICE (Node 8) -------------------------------
  eves_first_voice: {
    id: 'eves_first_voice',
    title: "Eve's First Voice",
    chapterRange: [1, 1],
    flavorText: [
      'An old expedition camp. Broken equipment. Dried blood. A journal lies open on a crate. You approach.',
      '',
      '"Mom?"',
      '',
      'Silence. You pick up the journal. A sketch of the First Door.',
      '',
      'EVE (V.O.): "You shouldn\'t have come here."',
      '',
      'You freeze. "Mom?"',
      '',
      'EVE (V.O.): "Keep walking."',
      '',
      '"Where are you?"',
      '',
      'Long silence. Wind through stone.',
      '',
      'EVE (V.O.): "I don\'t know."',
      '',
      'You look around. The camp is empty. The voice came from everywhere and nowhere.',
    ].join('\n'),
    choices: [
      {
        id: 'keep_walking',
        label: 'Keep walking.',
        onSuccess: (player) => {
          player.story.eveVoiceHeard += 1;
          return 'You keep walking. Her voice goes with you.';
        },
      },
    ],
  },

  // ---- SCENE 1.3 — FIRST BLOOD (Node 15) ------------------------------------
  first_blood: {
    id: 'first_blood',
    title: 'First Blood',
    chapterRange: [1, 1],
    flavorText: [
      'Pale sand. A DUST WIGHT rises from the ground — a desert-dusted remnant wrapped in funerary linen. It does not attack until looked at too long.',
      '',
      'The dust-caked dead do not mind being dead. They mind being watched.',
    ].join('\n'),
    choices: [
      {
        id: 'face_it',
        label: 'Face it.',
        onSuccess: () => 'You raise your weapon. The Wight turns toward you.',
        combat: {
          enemyIds: ['dust_wight'],
          onVictory: (_player, ctx) => {
            ctx.setFlag('first_blood_done');
            return 'After combat, the Wight crumbles. Beneath it: a Sable ash-mark, half-burned. And a name scratched in the sand — "EVE."';
          },
        },
      },
    ],
  },

  // ---- SCENE 2.1 — THE HOLLOWED MAN (Node 48) -------------------------------
  the_hollowed_man: {
    id: 'the_hollowed_man',
    title: 'The Hollowed Man',
    chapterRange: [1, 5],
    flavorText: [
      'A Sable shelter — rough stone reinforced with iron. An old man sits inside, wrapped in blankets. His eyes are clear but empty. He is Hollow.',
      '',
      '"Are you with the expedition?" you ask.',
      '',
      'HOLLOWED MAN: "I was... something. I came down here for the same reason everyone does."',
      '',
      '"The dream?"',
      '',
      'He shakes his head. "No. I came because of a woman."',
      '',
      'You go still.',
      '',
      '"She told me to go home. She said the Deep wasn\'t what I thought. She said..." He looks directly at you. "She said her child would come eventually. And that I should tell them..."',
      '',
      'He frowns. The memory slips away like water.',
      '',
      '"I don\'t remember what I was supposed to tell them."',
    ].join('\n'),
    choices: [
      {
        id: 'sit_with_him',
        label: 'Sit with him a while.',
        onSuccess: (player, ctx) => {
          ctx.setFlag('met_hollowed_man');
          player.resonance = Math.min(100, player.resonance + 2);
          return 'He does not speak again. But when you rise to leave, his empty eyes follow you with something almost like purpose.';
        },
      },
      {
        id: 'leave_quietly',
        label: 'Leave him in peace.',
        onSuccess: () => 'Some messages arrive broken. It is not your fault the messenger forgot.',
      },
    ],
  },

  // ---- SCENE 2.2 — THE DEEP PAGES (Node 60) ---------------------------------
  the_deep_pages: {
    id: 'the_deep_pages',
    title: 'The Deep Pages',
    chapterRange: [1, 5],
    flavorText: [
      'The Resonant Hall. Shelves of books written in ink that has not dried in five millennia. You touch one.',
      '',
      'The pages are warm. The ink shifts when unobserved. The books are not records. They are invitations.',
      '',
      'An ASH COVENANT SEER appears — crystalline growths refracting your face wrong.',
      '',
      'ASH COVENANT SEER: "You carry her echo. The woman who said no."',
      '',
      '"What do you know about Eve?"',
      '',
      '"She reached the Deep. She saw the Loom. And she chose solitude over translation. A strange choice. A selfish one."',
    ].join('\n'),
    choices: [
      {
        id: 'demand_answers',
        label: '"Tell me everything. Now."',
        onSuccess: () => 'The Seer\'s crystals flare. It answers with light, and light answers back.',
        combat: {
          enemyIds: ['ash_seer'],
          onVictory: (_player, ctx) => {
            ctx.setFlag('deep_pages_seer_defeated');
            return 'When defeated, the Seer shatters into glass and dust. The warm pages close themselves, as if satisfied.';
          },
        },
      },
    ],
  },

  // ---- SCENE 3.1 — FALSE MEMORIES (Node 88) ----------------------------------
  false_memories: {
    id: 'false_memories',
    title: 'False Memories',
    chapterRange: [1, 5],
    flavorText: [
      'You find a Venn inscription that almost resolves into words. As you read it, your vision blurs.',
      '',
      '"I remember Mom teaching me this," you say to yourself.',
      '',
      'A pause.',
      '',
      '"Wait."',
      '',
      'The memory slips. Did she? Or did the stone teach you to remember it that way?',
      '',
      'The deeper you go, the less certain reality becomes. The Loom is not just below you. It is around you. Reading.',
    ].join('\n'),
    choices: [
      {
        id: 'let_it_slide',
        label: 'Let the memory stay, even if it is false.',
        onSuccess: (player) => {
          player.story.eveVoiceHeard += 0;
          return 'It is a warm lie in a cold place. You keep it.';
        },
      },
    ],
  },

  // ---- SCENE 3.2 — THE MEMORY ROOM (Node 92) ---------------------------------
  the_memory_room: {
    id: 'the_memory_room',
    title: 'The Memory Room',
    chapterRange: [1, 5],
    flavorText: [
      'You enter a chamber that should not exist. A childhood bed. Old toys. Eve\'s chair. Family photographs. Everything looks normal.',
      '',
      'You approach the photographs.',
      '',
      'Every single one has Eve\'s face scratched out. Not torn — carefully, deliberately scratched away with something sharp.',
      '',
      'EVE (V.O.): "Don\'t look."',
      '',
      '"Why?"',
      '',
      '"Because you\'ll remember."',
      '',
      '"Remember what?"',
      '',
      'EVE (V.O.), softer, almost pleading: "That I wasn\'t always your mother."',
      '',
      'You turn. For a fraction of a second, you see a figure in the corner — Eve, young, wearing expedition gear, holding a journal. Then she is gone.',
    ].join('\n'),
    choices: [
      {
        id: 'look_anyway',
        label: 'Look at the photographs anyway.',
        onSuccess: (player) => {
          player.story.eveVoiceHeard += 1;
          player.resonance = Math.min(100, player.resonance + 3);
          return 'The scratched faces tell you nothing. The scratch marks tell you everything: someone wanted to forget her on purpose.';
        },
      },
    ],
  },

  // ---- SCENE 4.1 — THE VENN TRUTH (Node 132) ---------------------------------
  the_venn_truth: {
    id: 'the_venn_truth',
    title: 'The Venn Truth',
    chapterRange: [1, 5],
    flavorText: [
      'The Crystal Veins. Light fractures into prophecy. You find a Venn inscription, intact.',
      '',
      'The Venn were not destroyed. They did not fall. They walked into the Loom deliberately, systematically. They set down their cups. They left their bread uneaten. And they did not return.',
      '',
      'You read aloud: "We go not because we are called, but because we have finished the question."',
    ].join('\n'),
    choices: [
      {
        id: 'copy_it',
        label: 'Copy the inscription into your journal.',
        onSuccess: (_player, ctx) => {
          ctx.addLoreFragment('the_departure_feast');
          ctx.addXp(10);
          return 'Finished the question. You write it down twice, in case one copy stops being true.';
        },
      },
    ],
  },

  // ---- SCENE 4.2 — EVE'S FIRST JOURNAL (Node 155) ----------------------------
  eves_first_journal: {
    id: 'eves_first_journal',
    title: "Eve's First Journal",
    chapterRange: [1, 5],
    flavorText: [
      'The Archive Depths. You find a locked case. Inside: not the journal you inherited, but Eve\'s FIRST journal. Written before the surface. Before the forgetting.',
      '',
      'You open it.',
      '',
      'EVE (V.O., reading): "I found the Loom."',
      '',
      'Next page.',
      '',
      '"It showed me myself. It showed me the person I could become. I understood."',
      '',
      'Next page.',
      '',
      '"The thing in the Deep isn\'t promising us power. It\'s showing us what we are willing to sacrifice for it."',
      '',
      'Final page. The handwriting is shaky.',
      '',
      '"And I am afraid that I already said yes."',
      '',
      'You close the journal. Your hands are trembling.',
    ].join('\n'),
    choices: [
      {
        id: 'take_it',
        label: 'Take the journal.',
        onSuccess: (player, ctx) => {
          player.story.motherJournalFound = true;
          ctx.addLoreFragment('cass_unburnt_memory');
          ctx.addXp(15);
          return 'You take it. Somewhere far below, something that wears your mother\'s voice feels the pages move.';
        },
      },
    ],
  },

  // ---- SCENE 5.1 — THE ASHEN TUNNELS (Node 175) -------------------------------
  ashen_tunnels: {
    id: 'ashen_tunnels',
    title: 'The Ashen Tunnels',
    chapterRange: [1, 5],
    flavorText: [
      'The tunnels breathe. The walls whisper in Venn. You can almost understand it now.',
      '',
      'EVE (V.O.): "You\'re close."',
      '',
      'You stop. "Mom. I need to know. Are you really my mother?"',
      '',
      'Silence. Then:',
      '',
      'EVE (V.O.): "Does it matter?"',
      '',
      '"Yes."',
      '',
      'EVE (V.O.), softer: "That\'s what I said too."',
    ].join('\n'),
    choices: [
      {
        id: 'keep_descending',
        label: 'Keep descending.',
        onSuccess: (player) => {
          player.story.eveVoiceHeard += 1;
          return 'The tunnels exhale behind you. Warm air that no cave should breathe follows you down.';
        },
      },
    ],
  },

  // ---- SCENE 5.2 — THE EVE REVEAL (Node 185) ----------------------------------
  eve_reveal: {
    id: 'eve_reveal',
    title: 'The Eve Reveal',
    chapterRange: [1, 5],
    flavorText: [
      'The Covenant Spire — a temple built toward rather than away. At its heart, Eve stands. Not young, not old. The age she was when she died, but clear-eyed, present. She is translucent — a projection, a memory, a fragment of the Loom. But her expression is real.',
      '',
      'EVE: "I reached the Deep. I became Hollow. Then I tried to stop the next Seeker. I defeated them. They lost themselves. That was the cycle."',
      '',
      '"You killed them?"',
      '',
      '"No. I saved them from becoming what I became. But saving them meant... becoming part of the mechanism. The Hollow doesn\'t just wait. It maintains. It keeps the door open. It keeps the promise alive."',
      '',
      '"You became part of the Loom."',
      '',
      '"I thought saving someone meant keeping them away from the Deep. I was wrong. The only way to save someone is to let them choose. Even if they choose wrong."',
      '',
      'She steps closer.',
      '',
      '"The Loom has been reading you since you entered. It knows your techniques. It knows your fears. It knows what you want to become."',
      '',
      '"And what do I want to become?"',
      '',
      'She smiles, sad. "You want to become someone who understands. That\'s the most dangerous thing to want down here."',
      '',
      'She fades.',
      '',
      'EVE, fading: "The thing waiting at the end of the journey... is you."',
    ].join('\n'),
    choices: [
      {
        id: 'reach_for_her',
        label: 'Reach for her.',
        onSuccess: (player) => {
          player.story.eveVoiceHeard += 1;
          player.resonance = Math.min(100, player.resonance + 5);
          return 'Your hand closes on nothing. But the shape of her stays in it the whole rest of the way down.';
        },
      },
    ],
  },
};
