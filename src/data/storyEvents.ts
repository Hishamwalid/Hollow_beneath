import type { EventDef } from './types';

// ============================================================================
// THE HOLLOW BENEATH — Definitive Edition story events
// Pinned to exact board nodes (see PINNED_STORY_EVENTS below). These are
// unskippable narrative beats from the Definitive Narrative Script.
// Beats are STAGED: short narration, then a reaction — never a wall of prose.
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

/**
 * One-line context anchors shown on the board after each beat, so the thread
 * of the descent survives the long stretches between story nodes.
 */
export const STORY_BEAT_REMINDERS: Record<string, string> = {
  prologue_descent: 'The whole delving points down.',
  eves_first_voice: '"Keep walking."',
  first_blood: 'A name in the sand, almost legible.',
  the_hollowed_man: '"She said the next one would come."',
  the_deep_pages: 'An echo. Someone who said no.',
  false_memories: 'Warm hands. Did that happen?',
  the_memory_room: '"Don\'t look."',
  the_venn_truth: '"We have finished the question."',
  eves_first_journal: '"I am afraid that I already said yes."',
  ashen_tunnels: '"Does it matter?"',
  eve_reveal: '"My name is Eve."',
};

export const STORY_EVENTS: Record<string, EventDef> = {
  // ---- SCENE 1.1 — THE DESCENT (Node 1) ------------------------------------
  // Canon: the journey begins ABOVE GROUND, at the abandoned delving.
  // The Beneath stays sealed until the Sentinel falls at node 40.
  prologue_descent: {
    id: 'prologue_descent',
    title: 'The Descent',
    chapterRange: [1, 1],
    flavorText: [
      'The Delving of Keth. Marker flags snap in a dry wind that nobody else is left to feel. Tents stand open. Meals half-eaten. Resonance-crystals hiss dead static at an empty sky.',
      '',
      'At the heart of it all: the cave-in. A sinkhole punched clean through the desert floor. Rusted iron pegs still hold a rope where the company went down — and did not come back.',
      '',
      'Gold light climbs slowly out of the shaft, steady as a held note. Nine days since the leader\'s last resonance crackle. Seven centuries of dreams about whatever is making that light.',
    ].join('\n'),
    choices: [
      {
        id: 'walk_to_light',
        label: 'Walk the marker cords toward the light.',
        onSuccess: () => 'You follow the flags inward. The closer you come to the shaft, the more the ground under your boots reads like the first word of a very long sentence.',
      },
      {
        id: 'speak_to_dark',
        label: 'Lean over the edge. Say something to the dark.',
        onSuccess: (player) => {
          player.resonance = Math.min(100, player.resonance + 2);
          return '"Hello?"\n\nNothing answers. But the echo comes back a half-second late — from somewhere far, far below. (+2 Resonance)';
        },
      },
    ],
  },

  // ---- SCENE 1.2 — THE FIRST VOICE (Node 8) ---------------------------------
  eves_first_voice: {
    id: 'eves_first_voice',
    title: 'The First Voice',
    chapterRange: [1, 1],
    flavorText: [
      'An old company camp. Broken equipment. Dried blood.',
      '',
      'A journal lies open on a crate — a sketch of a door, drawn and redrawn until the paper wore through.',
    ].join('\n'),
    choices: [
      {
        id: 'take_journal',
        label: 'Take the journal.',
        onSuccess: () => '',
        then: {
          flavorText: [
            'The pages shift under your thumb.',
            '',
            'THE VOICE: "You shouldn\'t have come here."',
            '',
            'Close. Closer than a voice has any right to be — and familiar in a way you cannot place.',
          ].join('\n'),
          choices: [
            {
              id: 'ask_who',
              label: '"Who are you?"',
              onSuccess: () => 'THE VOICE: "Keep walking."',
              then: {
                flavorText: 'You turn. The camp is empty.\n\nThe voice came from everywhere and nowhere.',
                choices: [
                  {
                    id: 'keep_walking',
                    label: 'Keep walking.',
                    onSuccess: (player) => {
                      player.story.eveVoiceHeard += 1;
                      return 'You keep walking. The voice goes with you.';
                    },
                  },
                ],
              },
            },
            {
              id: 'ask_where',
              label: '"Where are you?"',
              onSuccess: () => 'Wind through stone. A long silence.\n\nTHE VOICE: "I don\'t know."',
              then: {
                flavorText: 'You turn. The camp is empty.\n\nThe voice came from everywhere and nowhere.',
                choices: [
                  {
                    id: 'keep_walking',
                    label: 'Keep walking.',
                    onSuccess: (player) => {
                      player.story.eveVoiceHeard += 1;
                      return 'You keep walking. The voice goes with you.';
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'call_out',
        label: '"Hello? Is someone there?"',
        onSuccess: () => '',
        then: {
          flavorText: [
            'Your own words come back to you wrong — doubled, arriving a half-second late.',
            '',
            'Then, underneath your echo, thinner and older:',
            '',
            'THE VOICE: "You shouldn\'t have come here."',
          ].join('\n'),
          choices: [
            {
              id: 'ask_who',
              label: '"Who are you?"',
              onSuccess: () => 'THE VOICE: "Keep walking."',
              then: {
                flavorText: 'You turn. The camp is empty.\n\nThe voice came from everywhere and nowhere.',
                choices: [
                  {
                    id: 'keep_walking',
                    label: 'Keep walking.',
                    onSuccess: (player) => {
                      player.story.eveVoiceHeard += 1;
                      return 'You keep walking. The voice goes with you.';
                    },
                  },
                ],
              },
            },
            {
              id: 'ask_where',
              label: '"Where are you?"',
              onSuccess: () => 'Wind through stone. A long silence.\n\nTHE VOICE: "I don\'t know."',
              then: {
                flavorText: 'You turn. The camp is empty.\n\nThe voice came from everywhere and nowhere.',
                choices: [
                  {
                    id: 'keep_walking',
                    label: 'Keep walking.',
                    onSuccess: (player) => {
                      player.story.eveVoiceHeard += 1;
                      return 'You keep walking. The voice goes with you.';
                    },
                  },
                ],
              },
            },
          ],
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
      'Pale sand shifts ahead. A figure rises from behind a wind-flattened tent — a scavenger in mismatched company gear, hook-blade held low, eyes doing arithmetic on what you carry.',
      '',
      'RUST-PICKER: "...You heard it too, didn\'t you. The light, singing. That makes you rich, friend. Or empty."',
    ].join('\n'),
    choices: [
      {
        id: 'face_it',
        label: 'Face him.',
        onSuccess: () => 'You raise your weapon. He circles left, blade low.',
        combat: {
          enemyIds: ['rust_picker'],
          onVictory: (_player, ctx) => {
            ctx.setFlag('first_blood_done');
            return 'He does not get up. Beside his hand: a Sable ash-mark, half-burned, torn from someone else\'s body. And a word scratched into the sand that the wind is already taking apart.';
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
      'A Sable shelter — rough stone reinforced with iron. An old man sits wrapped in blankets. His eyes are clear, and empty. Hollow.',
      '',
      'HOLLOWED MAN: "Are you with the company? No. Of course not. You\'re one of the ones who keeps walking."',
    ].join('\n'),
    choices: [
      {
        id: 'ask_about_her',
        label: '"Who did you come down here for?"',
        onSuccess: () =>
          '"A woman," he says. "She told me to go home. She said the Deep wasn\'t what I thought."\n\nHe looks directly at you. "She said the next one would come eventually. And that I should tell them—"',
        then: {
          flavorText: [
            'His hand stops mid-gesture. The sentence dies in it.',
            '',
            'HOLLOWED MAN: "...Tell them. Tell them. I had it a moment ago."',
            '',
            'The memory slips away like water. Whatever message he carried, it left before he could deliver it.',
          ].join('\n'),
          choices: [
            {
              id: 'stay_awhile',
              label: 'Sit with him a while.',
              onSuccess: (player, ctx) => {
                ctx.setFlag('met_hollowed_man');
                player.resonance = Math.min(100, player.resonance + 2);
                return 'He does not speak again. But when you rise to leave, his empty eyes follow you with something almost like purpose. (+2 Resonance)';
              },
            },
            {
              id: 'leave_message_be',
              label: 'Let the message go. Leave in peace.',
              onSuccess: () => 'Some messages arrive broken. It is not your fault the messenger forgot.',
            },
          ],
        },
      },
      {
        id: 'sit_with_him',
        label: 'Sit with him without a word.',
        onSuccess: (player, ctx) => {
          ctx.setFlag('met_hollowed_man');
          player.resonance = Math.min(100, player.resonance + 2);
          return 'You share his fire in silence. When you rise to leave, his empty eyes follow you with something almost like purpose. (+2 Resonance)';
        },
      },
      {
        id: 'leave_quietly',
        label: 'Leave him be.',
        onSuccess: () => 'Some doors are kinder unopened. You move on.',
      },
    ],
  },

  // ---- SCENE 2.2 — THE DEEP PAGES (Node 60) ---------------------------------
  the_deep_pages: {
    id: 'the_deep_pages',
    title: 'The Deep Pages',
    chapterRange: [1, 5],
    flavorText: [
      'The Resonant Hall. Shelves of books written in ink that has not dried in five millennia. You touch one spine — the pages are warm.',
      '',
      'An ASH COVENANT SEER steps out from between the shelves, crystalline growths refracting your face wrong.',
      '',
      'ASH COVENANT SEER: "You carry an echo. Someone who said no. She reached the Deep. She saw the Loom. She chose solitude over translation — a selfish choice. Ask me what you actually want to ask, or draw."',
    ].join('\n'),
    choices: [
      {
        id: 'demand_answers',
        label: '"What did she see?" (draw steel)',
        onSuccess: () => 'The Seer\'s crystals flare. It answers with light, and light answers back.',
        combat: {
          enemyIds: ['ash_seer'],
          onVictory: (_player, ctx) => {
            ctx.setFlag('deep_pages_seer_defeated');
            return 'When defeated, the Seer shatters into glass and dust. The warm pages close themselves, as if satisfied.';
          },
        },
      },
      {
        id: 'withdraw',
        label: 'Back out of the hall slowly.',
        onSuccess: () => 'The Seer does not stop you. The books do not cool. The whole way out, the shelves read like held breath.',
      },
    ],
  },

  // ---- SCENE 3.1 — FALSE MEMORIES (Node 88) ----------------------------------
  false_memories: {
    id: 'false_memories',
    title: 'False Memories',
    chapterRange: [1, 5],
    flavorText: [
      'A Venn inscription almost resolves into words. As you read, your vision blurs —',
      '',
      '— and a thought arrives that does not feel borrowed: warm hands. A low room. Someone counting brush-strokes while they teach you.',
      '',
      'Wait. Did that happen?',
    ].join('\n'),
    choices: [
      {
        id: 'let_it_slide',
        label: 'Keep the memory, even if it is false.',
        onSuccess: () => 'It is a warm lie in a cold place. You keep it.',
      },
      {
        id: 'let_it_go',
        label: 'Give the memory back.',
        onSuccess: (player) => {
          player.resonance = Math.max(0, player.resonance - 2);
          return 'The stone takes it back. It leaves the ache it came with. (-2 Resonance)';
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
      'A chamber that should not exist: a childhood bed, old toys, a reading chair worn smooth by one person, over and over, in the same spot.',
      '',
      'On the desk: family portraits, face-down. Every one of them.',
    ].join('\n'),
    choices: [
      {
        id: 'turn_photos',
        label: 'Turn over the portraits.',
        onSuccess: () => '',
        then: {
          flavorText: [
            'Every single one has the same face scratched out. Not torn — carefully, deliberately scratched away with something sharp.',
            '',
            'THE VOICE: "Don\'t look."',
          ].join('\n'),
          choices: [
            {
              id: 'look_anyway',
              label: 'Look anyway.',
              onSuccess: (player) => {
                player.story.eveVoiceHeard += 1;
                player.resonance = Math.min(100, player.resonance + 3);
                return 'You lift the last portrait anyway. The scratched faces tell you nothing. The scratch marks tell you everything: someone wanted to forget her on purpose. (+3 Resonance)';
              },
            },
            {
              id: 'step_back',
              label: 'Put the portraits down.',
              onSuccess: () => 'You set them face-down again, exactly as they lay.\n\nTHE VOICE, softer: "Thank you."',
            },
          ],
        },
      },
      {
        id: 'call_out',
        label: '"Is someone there?"',
        onSuccess: () => 'For a moment — nothing. Then the room itself seems to hold its breath.',
        then: {
          flavorText: [
            'THE VOICE: "Don\'t look at the portraits."',
            '',
            'They are still face-down. Waiting to be turned or left alone — the choice sits in your hands either way.',
          ].join('\n'),
          choices: [
            {
              id: 'look_anyway',
              label: 'Turn them over anyway.',
              onSuccess: (player) => {
                player.story.eveVoiceHeard += 1;
                player.resonance = Math.min(100, player.resonance + 3);
                return 'Every single one has the same face scratched out — carefully, deliberately. The scratch marks tell you everything: someone wanted to forget her on purpose. (+3 Resonance)';
              },
            },
            {
              id: 'step_back',
              label: 'Leave them face-down.',
              onSuccess: () => 'You leave the room exactly as you found it.\n\nTHE VOICE, softer: "Thank you."',
            },
          ],
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
      'The Crystal Veins. Light fractures into prophecy. On the wall, one inscription survives intact:',
      '',
      '"We go not because we are called, but because we have finished the question."',
      '',
      'The tables around it are set for meals nobody finished eating.',
    ].join('\n'),
    choices: [
      {
        id: 'copy_it',
        label: 'Copy the inscription into your journal.',
        onSuccess: (_player, ctx) => {
          ctx.addLoreFragment('the_departure_feast');
          ctx.addXp(10);
          return 'Finished the question. You write it down twice, in case one copy stops being true. (+10 XP, a lore fragment)';
        },
      },
      {
        id: 'leave_unread',
        label: 'Leave it unread.',
        onSuccess: () => 'Some questions finish themselves. You keep yours moving.',
      },
    ],
  },

  // ---- SCENE 4.2 — THE FIRST JOURNAL (Node 155) ------------------------------
  eves_first_journal: {
    id: 'eves_first_journal',
    title: 'The First Journal',
    chapterRange: [1, 5],
    flavorText: [
      'The Archive Depths. A locked case rests where no case should rest — centered, dusted, waiting.',
      '',
      'Inside: not the journal you inherited, but another — older, its spine cracked from a descent that happened before yours.',
    ].join('\n'),
    choices: [
      {
        id: 'open_case',
        label: 'Open the case.',
        onSuccess: () => '',
        then: {
          flavorText: [
            'THE VOICE, reading aloud over your shoulder: "I found the Loom."',
            '',
            'Next page. "It showed me myself. What I could become. I understood."',
            '',
            'Final page. The handwriting shakes. "The thing in the Deep isn\'t promising us power. It\'s showing us what we are willing to sacrifice for it. And I am afraid that I already said yes."',
            '',
            'Your hands are trembling. They are not your tremors.',
          ].join('\n'),
          choices: [
            {
              id: 'take_it',
              label: 'Take the journal.',
              onSuccess: (player, ctx) => {
                player.story.motherJournalFound = true;
                ctx.addLoreFragment('cass_unburnt_memory');
                ctx.addXp(15);
                return 'You take it. Somewhere far below, the voice pauses — mid-breath, mid-word — as if it felt the pages move. (+15 XP, a lore fragment)';
              },
            },
            {
              id: 'close_it',
              label: 'Close the case gently.',
              onSuccess: () => 'You shut it like a lid on a well.\n\nThis time, the voice does not pause. Somehow that is worse.',
            },
          ],
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
      'The tunnels breathe. Warm air, in and out, slow as sleep. The walls whisper in Venn — and you can almost understand them now.',
      '',
      'THE VOICE: "You\'re close."',
    ].join('\n'),
    choices: [
      {
        id: 'ask_who_you_are',
        label: '"I need to know who you are."',
        onSuccess: () =>
          'Silence. Then:\n\nTHE VOICE: "Does it matter?"\n\n"Yes."\n\nSofter: "That\'s what I said too."',
        then: {
          flavorText: 'The tunnels wait for you to choose a direction. Only one of them leads down.',
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
      },
      {
        id: 'say_nothing',
        label: 'Say nothing. Keep walking.',
        onSuccess: (player) => {
          player.story.eveVoiceHeard += 1;
          return 'The silence walks with you. It weighs more than any question would have.';
        },
      },
    ],
  },

  // ---- SCENE 5.2 — THE EVE REVEAL (Node 185) ----------------------------------
  eve_reveal: {
    id: 'eve_reveal',
    title: 'The Voice, Given a Face',
    chapterRange: [1, 5],
    flavorText: [
      'The Covenant Spire — a temple built toward rather than away. At its heart stands a woman. Not young, not old. Translucent: an apparition, a memory, a fragment of the Loom. Her expression is real.',
      '',
      'She speaks, and the floor drops out of you. That voice. The empty camp. The scratched portraits. The breathing tunnels. Everywhere and nowhere, the whole way down.',
      '',
      '"It was you. Every time. It was always you."',
      '',
      'EVE: "Every time. From the first camp onward. I couldn\'t come closer than this — not without becoming part of what holds you here."',
      '',
      '"Who are you?"',
      '',
      'EVE: "My name is Eve. And I am your mother."',
    ].join('\n'),
    choices: [
      {
        id: 'reach_for_her',
        label: 'Reach for her.',
        onSuccess: (player) => {
          player.story.eveVoiceHeard += 1;
          player.resonance = Math.min(100, player.resonance + 5);
          return 'Your hand closes on nothing. But the shape of her stays in it the whole rest of the way down. (+5 Resonance)';
        },
        then: {
          flavorText: [
            'EVE: "I reached the Deep. I became Hollow. Then I tried to stop the next Seeker — defeated them, saved them from becoming what I became. Saving them meant joining the mechanism. The Hollow doesn\'t just wait. It maintains. It keeps the promise alive."',
            '',
            '"You became part of the Loom."',
            '',
            'EVE, sad: "The only way to save someone is to let them choose. Even if they choose wrong. The Loom has been reading you since you entered — your techniques, your fears, what you want to become. And you want to understand. That\'s the most dangerous thing to want down here."',
            '',
            'She fades.',
            '',
            'EVE, fading: "The thing waiting at the end of the journey... is you."',
          ].join('\n'),
          choices: [
            {
              id: 'descend_final',
              label: 'Descend. Finish it.',
              onSuccess: () => 'The spire exhales. The last stretch of the descent begins.',
            },
          ],
        },
      },
      {
        id: 'ask_why_now',
        label: '"Why tell me only now?"',
        onSuccess: () => 'EVE: "Because you had stopped asking. And you were about to stop hearing me too."',
        then: {
          flavorText: [
            'EVE: "I reached the Deep. I became Hollow. Then I tried to stop the next Seeker — defeated them, saved them from becoming what I became. Saving them meant joining the mechanism. The Hollow doesn\'t just wait. It maintains. It keeps the promise alive."',
            '',
            '"You became part of the Loom."',
            '',
            'EVE, sad: "The only way to save someone is to let them choose. Even if they choose wrong. The Loom has been reading you since you entered — your techniques, your fears, what you want to become. And you want to understand. That\'s the most dangerous thing to want down here."',
            '',
            'She fades.',
            '',
            'EVE, fading: "The thing waiting at the end of the journey... is you."',
          ].join('\n'),
          choices: [
            {
              id: 'descend_final',
              label: 'Descend. Finish it.',
              onSuccess: () => 'The spire exhales. The last stretch of the descent begins.',
            },
          ],
        },
      },
    ],
  },
};
