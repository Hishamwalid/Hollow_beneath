import type { EventDef, TrapDef } from './types';
import { statCheck, rollDie } from '@systems/checks';

export const EVENTS: Record<string, EventDef> = {
  half_eaten_meal: {
    id: 'half_eaten_meal',
    title: 'The Half-Eaten Meal',
    pageRange: [1, 2],
    flavorText:
      'A Venn common-house. Five thousand years old. The bread on the table still looks fresh. A cup sits beside it, untouched. The chair is pulled back, as if someone stood up mid-bite and simply... never sat down again.\n\nOn the wall: "The meal is finished when the guest departs." But no one departed.',
    choices: [
      {
        id: 'eat',
        label: 'Eat the bread.',
        onSuccess: (player, ctx) => {
          player.currentHP = Math.min(player.derived.maxHP, player.currentHP + Math.round(player.derived.maxHP * 0.25));
          player.resonance = Math.min(100, player.resonance + 3);
          ctx.setFlag('ate_venn_bread');
          return 'You eat the bread. It is warm, impossibly. You feel the meal complete itself around you. (+25% HP, +3 Resonance)';
        },
      },
      {
        id: 'read',
        label: 'Read the carving.',
        onSuccess: (player, ctx) => {
          player.faction.archive += 5;
          ctx.addLoreFragment('the_departure_feast');
          return 'You copy the carving into your notes. Lore Fragment: "The Departure Feast." (+5 Archive)';
        },
      },
      {
        id: 'smash',
        label: 'Smash the table. (STR ≥ 7)',
        requirement: (p) => p.stats.str >= 7,
        onSuccess: (player, ctx) => {
          player.faction.sable += 3;
          player.resonance = Math.max(0, player.resonance - 2);
          player.currentHP = Math.max(1, player.currentHP - 5);
          ctx.setFlag('destroyed_feast');
          return 'You put your fist through five thousand years of dust. It feels correct, and it costs you. (+3 Sable, -2 Resonance, -5 HP)';
        },
      },
      {
        id: 'leave',
        label: 'Leave it.',
        onSuccess: (player) => {
          player.faction.caravan += 2;
          return "You leave the room the way you found it, mostly. (+2 Caravan)";
        },
      },
    ],
  },

  sable_patrol: {
    id: 'sable_patrol',
    title: 'The Sable Patrol',
    pageRange: [1, 3],
    flavorText:
      'Three figures in crimson robes block the path.\n"Traveler. You carry a Venn tablet. That tablet is a door. We are the locksmiths."',
    choices: [
      {
        id: 'hand_over',
        label: 'Hand over the tablet.',
        onSuccess: (player, ctx) => {
          player.faction.sable += 15;
          player.resonance = Math.max(0, player.resonance - 5);
          ctx.setFlag('no_tablet');
          return "They take it without ceremony. You feel lighter, and somehow less equipped for whatever this was. (+15 Sable, -5 Resonance)";
        },
      },
      {
        id: 'refuse',
        label: 'Refuse. (WILL check, DC 10)',
        check: { stat: 'will', dc: 10 },
        onSuccess: (player) => {
          player.faction.sable += 5;
          return 'They weigh your certainty and, oddly, respect it. They let you pass. (+5 Sable)';
        },
        onFailure: () => 'They do not respect it at all.',
        combat: { enemyIds: ['sable_zealot', 'sable_zealot'] },
      },
      {
        id: 'quote',
        label: 'Quote Venn scripture. (INT ≥ 7)',
        requirement: (p) => p.stats.int >= 7,
        onSuccess: (player, ctx) => {
          player.faction.sable += 10;
          player.resonance = Math.min(100, player.resonance + 3);
          ctx.setFlag('sable_scripture_unlocked');
          return 'You recite the verse correctly, in the old cadence. Something in their posture changes. (+10 Sable, +3 Resonance)';
        },
      },
      {
        id: 'attack',
        label: 'Attack.',
        onSuccess: (player) => {
          player.faction.covenant += 5;
          player.faction.sable -= 5;
          return 'You draw first. (+5 Covenant, -5 Sable)';
        },
        combat: { enemyIds: ['sable_zealot', 'sable_zealot', 'sable_zealot'] },
      },
    ],
  },

  whispering_wall: {
    id: 'whispering_wall',
    title: 'The Whispering Wall',
    pageRange: [2, 4],
    maxResonance: 24,
    flavorText:
      'A section of Venn wall hums at a frequency you feel in your sternum. You hear your own voice — speaking words you haven\'t said yet.',
    choices: [
      {
        id: 'touch',
        label: 'Touch the wall.',
        onSuccess: (player, ctx) => {
          player.resonance = Math.min(100, player.resonance + 5);
          ctx.addLoreFragment('the_excited_departure');
          return 'The words settle into you like something remembered rather than heard. (+5 Resonance)';
        },
      },
      {
        id: 'record',
        label: 'Record the frequency. (INT ≥ 6)',
        requirement: (p) => p.stats.int >= 6,
        onSuccess: (player) => {
          player.faction.archive += 8;
          player.inventory.push({ id: 'resonance_sketch', qty: 1 });
          return 'You transcribe the frequency onto paper that probably shouldn\'t be able to hold it. (+8 Archive, Resonance Sketch)';
        },
      },
      {
        id: 'destroy',
        label: 'Destroy the wall. (STR ≥ 8)',
        requirement: (p) => p.stats.str >= 8,
        onSuccess: (player) => {
          player.faction.sable += 5;
          player.resonance = Math.max(0, player.resonance - 3);
          player.inventory.push({ id: 'muted_stone', qty: 1 });
          return 'You break the humming apart with your hands. The silence after is almost worse. (+5 Sable, -3 Resonance, Muted Stone)';
        },
      },
      {
        id: 'walk_away',
        label: 'Walk away.',
        onSuccess: (player) => {
          player.faction.caravan += 3;
          return "You keep walking. Some things aren't worth the answer. (+3 Caravan)";
        },
      },
    ],
  },

  caravan_merchant: {
    id: 'caravan_merchant',
    title: 'The Caravan Merchant',
    pageRange: [4, 7],
    flavorText:
      'A woman with maps tattooed on her forearms tends a fire. "Sera Voss. I left the Archive ten years ago. I sleep through the night now."',
    choices: [
      {
        id: 'buy_supplies',
        label: 'Buy supplies. (30 gold)',
        requirement: (p) => p.gold >= 30,
        onSuccess: (player) => {
          player.gold -= 30;
          player.inventory.push({ id: 'ration', qty: 1 }, { id: 'waterskin', qty: 1 }, { id: 'caravan_knife', qty: 1 });
          return 'You trade for a Ration, a Waterskin, and a well-balanced Caravan Knife. (-30 gold)';
        },
      },
      {
        id: 'blank_book_gold',
        label: 'Ask about the blank book. (Pay 50 gold)',
        requirement: (p) => p.gold >= 50,
        onSuccess: (player) => {
          player.gold -= 50;
          player.inventory.push({ id: 'blank_book', qty: 1 });
          return "She hands it over without a word. The pages are already, somehow, starting to fill. (-50 gold, Blank Book)";
        },
      },
      {
        id: 'blank_book_resonance',
        label: 'Ask about the blank book. (Pay 8 Resonance)',
        requirement: (p) => p.resonance >= 8,
        onSuccess: (player) => {
          player.resonance -= 8;
          player.inventory.push({ id: 'blank_book', qty: 1 });
          return 'She looks at you a long moment, then takes payment you didn\'t know you could spend. (-8 Resonance, Blank Book)';
        },
      },
      {
        id: 'ask_why',
        label: 'Ask why she left.',
        onSuccess: (player, ctx) => {
          player.faction.caravan += 5;
          player.faction.archive += 3;
          ctx.setFlag('sera_backstory_known');
          return '"The Archive preserves everything," she says, "including the mistake it\'s about to let someone else make. I got tired of watching." (+5 Caravan, +3 Archive)';
        },
      },
      {
        id: 'rob',
        label: 'Rob her.',
        onSuccess: (player) => {
          player.faction.caravan -= 20;
          return 'You go for the knife first. She was expecting that.';
        },
        combat: {
          enemyIds: ['sera_voss'],
          onVictory: (player) => {
            player.gold += 80;
            player.inventory.push({ id: 'caravan_knife', qty: 1 }, { id: 'blank_book', qty: 1 });
            return 'She goes down still cursing your entire lineage. You take the knife, the book, and 80 gold. (-20 Caravan)';
          },
        },
      },
    ],
  },

  choirs_hymn: {
    id: 'choirs_hymn',
    title: "The Choir's Hymn",
    pageRange: [5, 7],
    minResonance: 25,
    flavorText:
      'Hundreds of voices sing in perfect unison. Ash Covenant members stand in a circle, crystals growing from their foreheads. They are smiling.',
    choices: [
      {
        id: 'join',
        label: 'Join the hymn. (WILL check, DC 14)',
        check: { stat: 'will', dc: 14 },
        onSuccess: (player, ctx) => {
          player.faction.covenant += 15;
          player.resonance = Math.min(100, player.resonance + 8);
          player.derived.dodge = Math.min(90, player.derived.dodge + 10);
          player.skillsKnown.push('chorus_step');
          ctx.setFlag('joined_hymn');
          return 'You find the note and hold it. For a moment you are not entirely sure which voice is yours. (+15 Covenant, +8 Resonance, Skill: Chorus Step)';
        },
        onFailure: () => 'You lose the note almost immediately, and the circle notices.',
        combat: { enemyIds: ['ash_seer', 'ash_seer', 'ash_seer'] },
      },
      {
        id: 'decline',
        label: 'Decline.',
        onSuccess: (player) => {
          player.faction.covenant += 3;
          return 'You step back. The hymn continues without you, unbothered. (+3 Covenant)';
        },
      },
      {
        id: 'disrupt',
        label: 'Disrupt (Sable method).',
        onSuccess: (player) => {
          player.faction.sable += 10;
          player.faction.covenant -= 5;
          player.resonance = Math.min(100, player.resonance + 3);
          player.inventory.push({ id: 'cracked_crystal', qty: 1 });
          return 'You break the harmony with a Sable counter-rite. The singers stumble, furious. (+10 Sable, -5 Covenant, +3 Resonance, Cracked Crystal)';
        },
      },
      {
        id: 'record_hymn',
        label: 'Record (Archive method). (INT ≥ 8)',
        requirement: (p) => p.stats.int >= 8,
        onSuccess: (player, ctx) => {
          player.faction.archive += 10;
          player.resonance = Math.min(100, player.resonance + 5);
          ctx.addLoreFragment('the_hymn_of_unbecoming');
          return 'You transcribe the hymn instead of joining it, which feels like its own kind of betrayal. (+10 Archive, +5 Resonance)';
        },
      },
    ],
  },

  loom_speaks_directly: {
    id: 'loom_speaks_directly',
    title: 'The Loom Speaks Directly',
    pageRange: [8, 9],
    minResonance: 50,
    flavorText:
      'The world stops. A drop of water hangs motionless. And you can move.\nA voice comes from everywhere. It does not use words. It uses recognition.\nYOU ARE THE ONE I CANNOT FINISH. WHY?',
    choices: [
      {
        id: 'dont_want_understood',
        label: '"Because I don\'t want to be understood."',
        onSuccess: (player, ctx) => {
          player.resonance = Math.min(100, player.resonance + 10);
          player.skillsKnown.push('unfinished_sentence');
          ctx.setFlag('silence_path_unlocked');
          return 'The recognition falters — genuinely, for the first time. (+10 Resonance, Skill: Unfinished Sentence, "The Silence" ending path unlocked)';
        },
      },
      {
        id: 'still_writing',
        label: '"Because I\'m still writing myself."',
        onSuccess: (player, ctx) => {
          player.resonance = Math.min(100, player.resonance + 5);
          player.faction.archive += 5;
          ctx.setFlag('next_rest_double');
          return 'It considers this an acceptable, if incomplete, answer. (+5 Resonance, +5 Archive, next Rest heals 50% instead of 25%)';
        },
      },
      {
        id: 'help_understand',
        label: '"Let me help you understand." (Covenant)',
        requirement: (p) => p.faction.covenant >= 25,
        onSuccess: (player) => {
          player.faction.covenant += 15;
          player.resonance = Math.min(100, player.resonance + 10);
          player.derived.maxHP = Math.round(player.derived.maxHP * 0.9);
          player.currentHP = Math.min(player.currentHP, player.derived.maxHP);
          player.skillsKnown.push('loom_touched');
          return "Something in you opens that probably shouldn't have. (+15 Covenant, +10 Resonance, Max HP -10%, Skill: Loom-Touched)";
        },
      },
      {
        id: 'leave_alone',
        label: '"Leave me alone." (Sable prayer)',
        requirement: (p) => p.faction.sable >= 25,
        onSuccess: (player, ctx) => {
          player.faction.sable += 5;
          player.resonance = Math.max(0, player.resonance - 5);
          ctx.setFlag('loom_silenced');
          return 'The recognition withdraws, offended or respectful, you can\'t tell which. It will not speak to you again this run. (+5 Sable, -5 Resonance)';
        },
      },
    ],
  },

  quiet_passage: {
    id: 'quiet_passage',
    title: 'A Quiet Passage',
    pageRange: [1, 10],
    repeatable: true,
    flavorText: 'A stretch of corridor with nothing obviously wrong with it. You take the moment anyway.',
    choices: [
      {
        id: 'rest_a_moment',
        label: 'Rest a moment.',
        onSuccess: (player) => {
          player.currentHP = Math.min(player.derived.maxHP, player.currentHP + Math.round(player.derived.maxHP * 0.05));
          return 'You catch your breath. (+5% HP)';
        },
      },
    ],
  },

  archivists_ledger: {
    id: 'archivists_ledger',
    title: "Mira Tol's Ledger",
    pageRange: [2, 4],
    flavorText:
      'A woman in a pale blue coat sits cross-legged on a fallen column, ink-stained fingers turning a brass-hinged ledger. "Archivist Mira Tol," she says, without looking up. "You\'re carrying more Resonance than your face admits. Sit. Talk to me. I catalogue everything. Including you, now."',
    choices: [
      {
        id: 'answer_her_question',
        label: 'Answer her question about the departure. (INT check, DC 12)',
        check: { stat: 'int', dc: 12 },
        onSuccess: (player, ctx) => {
          player.faction.archive += 12;
          player.gold += 15;
          ctx.addLoreFragment('mira_tols_index');
          return 'You answer carefully, and she writes faster than you speak. "Good," she says. "Someone should have this on record besides the thing that caused it." (+12 Archive, +15 gold, a lore fragment)';
        },
        onFailure: () => 'You fumble the explanation. She writes it down anyway, verbatim, mistakes included. "Also useful data," she says, not unkindly. (+2 Archive)',
      },
      {
        id: 'offer_fragment',
        label: 'Offer a lore fragment to catalogue.',
        requirement: (p) => p.loreFragments.length > 0,
        onSuccess: (player) => {
          player.faction.archive += 10;
          player.gold += 20;
          return "She copies it into the ledger, thanks you like you've done her a genuine kindness, and pays for the privilege. (+10 Archive, +20 gold)";
        },
      },
      {
        id: 'ask_what_shes_looking_for',
        label: "Ask what she's really looking for.",
        onSuccess: (player, ctx) => {
          player.faction.archive += 5;
          player.resonance = Math.min(100, player.resonance + 1);
          ctx.setFlag('mira_tol_met');
          return '"The same thing everyone down here is looking for," she says. "A reason it was worth it." (+5 Archive, +1 Resonance)';
        },
      },
      {
        id: 'decline',
        label: 'Decline and keep walking.',
        onSuccess: (player) => {
          player.faction.caravan += 3;
          return '"Suit yourself," she says, already writing that down too. (+3 Caravan)';
        },
      },
    ],
  },

  ash_marked_child: {
    id: 'ash_marked_child',
    title: 'The Ash-Marked Child',
    pageRange: [2, 4],
    flavorText:
      "A child, no older than ten, presses into a crack in the wall, ash-mark still wet on their forehead. Sable voices call out somewhere behind you, close. The child isn't crying. They've clearly done this before.",
    choices: [
      {
        id: 'hide_the_child',
        label: 'Hide the child. (DEX check, DC 12)',
        check: { stat: 'dex', dc: 12 },
        onSuccess: (player, ctx) => {
          player.faction.sable -= 15;
          player.faction.caravan += 10;
          player.inventory.push({ id: 'ash_marked_wrap', qty: 1 });
          ctx.setFlag('saved_marked_child');
          return "The patrol passes without slowing. The child exhales like they've been holding it for days, then presses their marked wrap into your hands before running. \"Don't need it now,\" they say. (-15 Sable, +10 Caravan, Ash-Marked Wrap)";
        },
        onFailure: () => 'The patrol rounds the corner before you can do anything but stand between them and the wall.',
        combat: { enemyIds: ['sable_zealot', 'sable_zealot'] },
      },
      {
        id: 'turn_in',
        label: 'Turn the child in.',
        onSuccess: (player, ctx) => {
          player.faction.sable += 15;
          ctx.setFlag('turned_in_marked_child');
          return 'You point. The patrol is efficient about it, which is somehow worse than if they weren\'t. (+15 Sable)';
        },
      },
      {
        id: 'ask_what_they_did',
        label: 'Ask what they did to get marked.',
        onSuccess: (player, ctx) => {
          player.resonance = Math.min(100, player.resonance + 1);
          ctx.addLoreFragment('the_unmarked_names');
          return '"I asked what the Order writes down and never reads back," the child says. "Nobody\'s supposed to ask that." (+1 Resonance, a lore fragment)';
        },
      },
      {
        id: 'give_coin',
        label: 'Give them coin and a route off the Sable roads. (10 gold)',
        requirement: (p) => p.gold >= 10,
        onSuccess: (player) => {
          player.gold -= 10;
          player.faction.caravan += 12;
          return "You press coin into their hand and point them toward the Dust Road. They run without saying thank you, which is fine — they shouldn't have to. (-10 gold, +12 Caravan)";
        },
      },
    ],
  },

  unfinished_farewell: {
    id: 'unfinished_farewell',
    title: 'The Unfinished Farewell',
    pageRange: [3, 5],
    flavorText:
      'A figure stands beside a table set for one, translucent at the edges the way a held breath is translucent. It is looking directly at you, and it has clearly been waiting.',
    choices: [
      {
        id: 'apologize',
        label: 'Apologize.',
        onSuccess: (player, ctx) => {
          if (ctx.hasFlag('ate_venn_bread')) {
            player.resonance = Math.min(100, player.resonance + 4);
            ctx.addLoreFragment('the_venn_farewell_rite');
            ctx.setFlag('apologized_to_venn_ghost');
            return '"You ate my farewell," it says — not angry, almost relieved someone finally answered. "I only wanted it witnessed. Thank you for finishing it." It fades, lighter than it arrived. (+4 Resonance, a lore fragment)';
          }
          player.resonance = Math.min(100, player.resonance + 2);
          return "You're not entirely sure what you're apologizing for. The figure watches a moment longer, then simply isn't there anymore. (+2 Resonance)";
        },
      },
      {
        id: 'ask_who',
        label: 'Ask who they were. (INT check, DC 11)',
        check: { stat: 'int', dc: 11 },
        onSuccess: (player) => {
          player.faction.archive += 10;
          player.resonance = Math.min(100, player.resonance + 2);
          return 'The answer arrives less as words than as a feeling of a name, already fading as you try to hold it. You write down what you can. (+10 Archive, +2 Resonance)';
        },
        onFailure: () => "It doesn't answer. It was never going to. It just needed someone to ask.",
      },
      {
        id: 'sit_with_them',
        label: 'Sit at the table with them.',
        onSuccess: (player, ctx) => {
          player.resonance = Math.min(100, player.resonance + 6);
          player.faction.covenant += 5;
          ctx.setFlag('sat_with_venn_ghost');
          return 'You sit. Nothing is served. Nothing needs to be. Some company is the whole meal. (+6 Resonance, +5 Covenant)';
        },
      },
      {
        id: 'leave_it',
        label: 'Leave. Some doors should stay shut.',
        onSuccess: (player) => {
          player.faction.sable += 5;
          return 'You go. Behind you, the chair scrapes, once, as if someone finally stood up. (+5 Sable)';
        },
      },
    ],
  },

  tollroad_ambush: {
    id: 'tollroad_ambush',
    title: 'The Toll Road',
    pageRange: [3, 6],
    flavorText:
      'Three figures block a narrow stretch of the path, layered desert fabric, no fixed symbol. "Not all of us answer to Sera Voss," the lead one says. "Toll\'s toll. Pay it, or we take it a worse way."',
    choices: [
      {
        id: 'pay_toll',
        label: 'Pay the toll. (20 gold)',
        requirement: (p) => p.gold >= 20,
        onSuccess: (player) => {
          player.gold -= 20;
          player.faction.caravan += 8;
          return 'They step aside without another word. Business is business. (-20 gold, +8 Caravan)';
        },
      },
      {
        id: 'refuse_fight',
        label: 'Refuse. Draw your weapon.',
        onSuccess: (player) => {
          player.faction.caravan -= 10;
          return 'You make your answer clear.';
        },
        combat: {
          enemyIds: ['dust_road_raider', 'dust_road_raider'],
          onVictory: (player) => {
            player.gold += 40;
            player.inventory.push({ id: 'dust_road_cleaver', qty: 1 });
            return 'They scatter once the fight turns against them, leaving a blade behind that they clearly valued. +40 gold, Dust-Road Cleaver. (-10 Caravan)';
          },
        },
      },
      {
        id: 'talk_past',
        label: 'Talk your way past. (WILL check, DC 12)',
        check: { stat: 'will', dc: 12 },
        onSuccess: (player) => {
          player.faction.caravan += 10;
          return "You say enough of the right names that they decide you're more trouble to rob than to let through. (+10 Caravan)";
        },
        onFailure: () => "They aren't interested in names. Only in your gold, or your blood.",
        combat: { enemyIds: ['dust_road_raider', 'dust_road_raider'] },
      },
      {
        id: 'trade_rumor',
        label: 'Offer a lore fragment as payment instead of gold.',
        requirement: (p) => p.loreFragments.length > 0,
        onSuccess: (player) => {
          player.faction.caravan += 6;
          player.faction.archive -= 3;
          return 'You trade a piece of what you know instead of what you have. They seem to value it more than coin, which unsettles you a little. (+6 Caravan, -3 Archive)';
        },
      },
    ],
  },

  page_left_behind: {
    id: 'page_left_behind',
    title: 'The Page Left Behind',
    pageRange: [3, 3],
    requiresAnyFlag: ['sentinel_defeated'],
    flavorText:
      "A single sheet, pinned to the wall with what looks like one of the Sentinel's own broken components. The handwriting is careful, deliberate — the writing of something that had a great deal of time and finally decided to use some of it.",
    choices: [
      {
        id: 'read_it',
        label: 'Read it.',
        onSuccess: (player, ctx) => {
          player.resonance = Math.min(100, player.resonance + 3);
          ctx.addLoreFragment('keth_vors_last_watch');
          return '"I had started to forget there was a difference," the page reads, "between guarding a door and being one. Thank you — not for winning. For asking the right question before you did." (+3 Resonance, a lore fragment)';
        },
      },
      {
        id: 'leave_it',
        label: 'Leave it pinned. Some things were not written for you.',
        onSuccess: (player) => {
          player.faction.sable += 3;
          return "You let it be. Whatever it was for, you decide it wasn't you. (+3 Sable)";
        },
      },
    ],
  },

  patriarchs_ash: {
    id: 'patriarchs_ash',
    title: "Patriarch's Ash",
    pageRange: [5, 5],
    requiresAnyFlag: ['cass_defeated', 'accepted_purification'],
    flavorText:
      'A cold fire pit, long abandoned, still smells faintly of old smoke. Someone has left ash arranged in a careful spiral around the stones — not scattered, placed.',
    choices: [
      {
        id: 'sit_by_the_ash',
        label: 'Sit by the ash a while.',
        onSuccess: (player, ctx) => {
          ctx.addLoreFragment('oren_thals_ledger');
          if (ctx.hasFlag('cass_defeated')) {
            player.faction.sable = Math.max(0, player.faction.sable - 3);
            player.resonance = Math.min(100, player.resonance + 2);
            return "You think about a man who burned his own memory to keep a promise, and lost anyway. The ash doesn't answer. It never does. (-3 Sable, +2 Resonance, a lore fragment)";
          }
          player.faction.sable += 5;
          player.resonance = Math.min(100, player.resonance + 2);
          return "You think about a man who chose the fire before it chose him. You're still not sure that was mercy. (+5 Sable, +2 Resonance, a lore fragment)";
        },
      },
      {
        id: 'scatter_the_ash',
        label: 'Scatter it. Let it be over.',
        onSuccess: (player) => {
          player.faction.covenant += 6;
          player.faction.sable = Math.max(0, player.faction.sable - 4);
          return 'You break the careful spiral with one pass of your hand. Some endings need a witness. This one just needed someone willing to finish it. (+6 Covenant, -4 Sable)';
        },
      },
      {
        id: 'leave_undisturbed',
        label: 'Leave it exactly as you found it.',
        onSuccess: (player) => {
          player.faction.sable += 3;
          return 'You step around it, careful not to disturb a single grain. (+3 Sable)';
        },
      },
    ],
  },

  reading_room: {
    id: 'reading_room',
    title: 'The Reading Room',
    pageRange: [5, 7],
    flavorText:
      'Venn glyphs cover every wall of a small chamber, and they are not staying still — each one shifts meaning slightly depending on where your eyes land last. It is less like reading and more like being read.',
    choices: [
      {
        id: 'study_them',
        label: 'Study the glyphs properly. (INT check, DC 13)',
        check: { stat: 'int', dc: 13 },
        onSuccess: (player, ctx) => {
          player.faction.archive += 10;
          player.inventory.push({ id: 'venn_glyph_lens', qty: 1 });
          ctx.addLoreFragment('the_four_dimensional_grammar');
          return "You start to see the pattern — not what the glyphs say, but what they're waiting for you to do first. You grind a fragment into a workable lens before you leave. (+10 Archive, Venn Glyph Lens, a lore fragment)";
        },
        onFailure: () => 'The meaning slides away from you every time you get close, like trying to read while falling.',
      },
      {
        id: 'take_a_sample',
        label: 'Chip off a sample instead of reading it.',
        onSuccess: (player) => {
          player.inventory.push({ id: 'venn_glyph_tablet', qty: 1 });
          player.faction.sable += 3;
          return 'You take the safer option — a piece to sell or study later, not an answer you have to carry in your head. (Venn Glyph Tablet, +3 Sable)';
        },
      },
      {
        id: 'walk_away',
        label: "Don't look too long. Walk away.",
        onSuccess: (player) => {
          player.faction.caravan += 4;
          return "You leave before the glyphs finish whatever they were about to say. (+4 Caravan)";
        },
      },
    ],
  },

  choirs_understudy: {
    id: 'choirs_understudy',
    title: "The Choir's Understudy",
    pageRange: [6, 8],
    flavorText:
      'An Ash Covenant convert kneels alone, one crystal only half-formed at their temple, tears running clear instead of the strange light the fully-changed ones show. "It isn\'t supposed to hurt this long," they say. "Please. Make it stop, or make it finish. I don\'t care which anymore."',
    choices: [
      {
        id: 'help_it_finish',
        label: 'Help the transformation finish.',
        onSuccess: (player, ctx) => {
          player.faction.covenant += 12;
          player.resonance = Math.min(100, player.resonance + 4);
          player.inventory.push({ id: 'choir_tuning_fork', qty: 1 });
          ctx.addLoreFragment('the_first_note');
          return 'You stay with them until the second voice settles in under the first. They thank you with both of them at once, in harmony, already less afraid. (+12 Covenant, +4 Resonance, Choir Tuning Fork, a lore fragment)';
        },
      },
      {
        id: 'help_it_stop',
        label: 'Try to stop it instead. (WILL check, DC 13)',
        check: { stat: 'will', dc: 13 },
        onSuccess: (player) => {
          player.faction.sable += 10;
          player.faction.covenant = Math.max(0, player.faction.covenant - 5);
          return 'It takes everything you know about Sable counter-rites, and it works. They gasp like surfacing. Whether you saved them is a question for later. (+10 Sable, -5 Covenant)';
        },
        onFailure: () => "You don't have the technique for this. The transformation continues regardless of what you try.",
      },
      {
        id: 'just_stay',
        label: "Just stay. Don't fix anything. Just stay.",
        onSuccess: (player) => {
          player.faction.covenant += 5;
          player.faction.sable += 3;
          player.resonance = Math.min(100, player.resonance + 1);
          return "You don't have an answer, so you just don't leave. It turns out that was most of what they needed. (+5 Covenant, +3 Sable, +1 Resonance)";
        },
      },
    ],
  },

  silent_auction: {
    id: 'silent_auction',
    title: 'The Silent Auction',
    pageRange: [6, 8],
    flavorText:
      'A cloth-covered table, three items on it, no auctioneer in sight until you realize they\'ve been standing perfectly still in the corner the whole time. "Bids are silent," they say. "Provenance is not guaranteed. Questions lower your offer."',
    choices: [
      {
        id: 'buy_weapon',
        label: 'Bid on the sealed blade. (70 gold)',
        requirement: (p) => p.gold >= 70,
        onSuccess: (player, ctx) => {
          player.gold -= 70;
          player.inventory.push({ id: 'sealed_edge', qty: 1 });
          ctx.addLoreFragment('the_auctioneers_provenance');
          return 'The auctioneer nods once and hands it over, still wrapped, with a card of provenance that raises more questions than it answers. (-70 gold, Sealed Edge, a lore fragment)';
        },
      },
      {
        id: 'buy_ledger',
        label: 'Bid on the merchant ledger. (45 gold)',
        requirement: (p) => p.gold >= 45,
        onSuccess: (player) => {
          player.gold -= 45;
          player.inventory.push({ id: 'travelers_ledger', qty: 1 });
          return "It changes hands without a word. (-45 gold, Traveler's Ledger)";
        },
      },
      {
        id: 'steal_it',
        label: 'Wait for a distraction and take something. (DEX check, DC 14)',
        check: { stat: 'dex', dc: 14 },
        onSuccess: (player) => {
          player.inventory.push({ id: 'auctioneers_token', qty: 1 });
          player.faction.sable = Math.max(0, player.faction.sable - 5);
          return "You're gone before the auctioneer's stillness even breaks. (Auctioneer's Token, -5 Sable)";
        },
        onFailure: () => 'The auctioneer was never as still as they looked.',
        combat: { enemyIds: ['dust_road_raider'] },
      },
      {
        id: 'just_browse',
        label: 'Just browse, and leave.',
        onSuccess: (player) => {
          player.faction.archive += 3;
          return 'You take notes instead of items. Cheaper, and the auctioneer seems almost disappointed. (+3 Archive)';
        },
      },
    ],
  },

  keth7_revisited: {
    id: 'keth7_revisited',
    title: 'Keth-7, Revisited',
    pageRange: [7, 9],
    flavorText:
      'The tablet in your pack goes warm, then cold, then shows three lines of text you never typed. You know this feeling. You have felt it exactly once before, in a vault with ten other people who did not walk back out.',
    choices: [
      {
        id: 'face_it',
        label: 'Let yourself remember. (WILL check, DC 14)',
        check: { stat: 'will', dc: 14 },
        onSuccess: (player, ctx) => {
          player.resonance = Math.min(100, player.resonance + 3);
          player.inventory.push({ id: 'keth7_tablet_shard', qty: 1 });
          ctx.addLoreFragment('what_the_vault_showed');
          ctx.setFlag('faced_keth7');
          return 'You let the memory finish, all the way through, for the first time. It does not get smaller. It just stops being a thing you have to brace against. (+3 Resonance, Keth-7 Tablet Shard, a lore fragment)';
        },
        onFailure: () => 'You get halfway there and slam the door on it again, hands shaking.',
      },
      {
        id: 'push_it_down',
        label: 'Push it down. Keep moving.',
        onSuccess: (player) => {
          player.resonance = Math.max(0, player.resonance - 2);
          return "You've had a great deal of practice not thinking about this. It works, for now. (-2 Resonance)";
        },
      },
      {
        id: 'write_it_down',
        label: 'Write down what you remember instead of feeling it.',
        onSuccess: (player) => {
          player.faction.archive += 8;
          return "Distance helps. You get three careful pages out of it, and none of them are quite the truth, and that's alright, for now. (+8 Archive)";
        },
      },
    ],
  },

  kindness_poorly_timed: {
    id: 'kindness_poorly_timed',
    title: 'A Kindness, Poorly Timed',
    pageRange: [8, 10],
    flavorText:
      'A Dominion soldier, ancient beyond reckoning, sits propped against a wall with one arm no longer attached. It is still, technically, holding its post. It looks up at you with something that might be hope, or might just be a targeting routine finally finding a use.',
    choices: [
      {
        id: 'end_it',
        label: 'End it, quickly.',
        onSuccess: (player, ctx) => {
          player.resonance = Math.min(100, player.resonance + 3);
          ctx.addLoreFragment('the_dominion_soldiers_oath');
          ctx.setFlag('mercy_to_dominion_soldier');
          return 'It stops holding its post. Somewhere, an oath that outlived every reason for it finally gets to be finished. (+3 Resonance, a lore fragment)';
        },
      },
      {
        id: 'repair_it',
        label: 'Try to repair it instead. (INT check, DC 14)',
        check: { stat: 'int', dc: 14 },
        onSuccess: (player) => {
          player.faction.archive += 12;
          player.inventory.push({ id: 'dominion_plate_scrap', qty: 1 });
          return 'It will never fight again, but it stands, and it thanks you in a dialect nobody alive can translate. You keep the plate it no longer needs. (+12 Archive, Dominion Plate Scrap)';
        },
        onFailure: () => "You make it worse. It doesn't complain. It has clearly had worse.",
      },
      {
        id: 'leave_it',
        label: 'Leave it to its post.',
        onSuccess: (player) => {
          player.faction.sable += 4;
          return 'You leave it exactly where duty left it. It seems, in its way, to prefer that. (+4 Sable)';
        },
      },
    ],
  },

  the_last_page: {
    id: 'the_last_page',
    title: 'The Last Page',
    pageRange: [9, 10],
    flavorText:
      "The corridor widens into something almost peaceful. No threat here, no puzzle, no wall that hums. Just quiet, and the sense that whatever comes next is close enough now to stop pretending you're not thinking about it.",
    choices: [
      {
        id: 'take_stock',
        label: 'Take stock of everything that brought you here.',
        onSuccess: (player) => {
          player.resonance = Math.min(100, player.resonance + 2);
          const highest = (Object.keys(player.faction) as (keyof typeof player.faction)[]).reduce((a, b) =>
            player.faction[a] >= player.faction[b] ? a : b
          );
          player.faction[highest] += 3;
          return `You sit with it a while — the choices, the ones you'd make again and the ones you wouldn't. Whatever you've become, you've become it on purpose. (+2 Resonance, +3 ${highest})`;
        },
      },
      {
        id: 'refuse_to_stop',
        label: "Don't. Not yet. Keep moving.",
        onSuccess: (player) => {
          player.currentHP = Math.min(player.derived.maxHP, player.currentHP + Math.round(player.derived.maxHP * 0.15));
          return "You've never been good at sitting still before the hard part. No reason to start now. (+15% HP)";
        },
      },
      {
        id: 'write_a_page',
        label: 'Write your own page, before someone else finds this place.',
        onSuccess: (player, ctx) => {
          ctx.setFlag('wrote_own_page');
          player.faction.archive += 5;
          return 'You leave something behind, for whoever comes after — not an answer, just proof someone asked the questions honestly. (+5 Archive)';
        },
      },
    ],
  },

  caravan_campfire: {
    id: 'caravan_campfire',
    title: "The Caravan's Campfire",
    pageRange: [4, 6],
    flavorText:
      "A ring of Dust-Road travelers share a fire and a story that's clearly been told before, every listener jumping in on the parts they like best. One of them notices you standing at the edge of the light and simply makes room.",
    choices: [
      {
        id: 'share_your_own',
        label: 'Share a story of your own. (WILL check, DC 11)',
        check: { stat: 'will', dc: 11 },
        onSuccess: (player) => {
          player.faction.caravan += 12;
          player.resonance = Math.max(0, player.resonance - 2);
          return "It comes out easier than you expected, and better than you remember it happening. They laugh in the right places. For a while, none of it feels like it's still following you. (+12 Caravan, -2 Resonance)";
        },
        onFailure: () => "You get halfway through before it stops making sense out loud. They let you trail off gently, and pass you food instead.",
      },
      {
        id: 'just_listen',
        label: 'Just listen.',
        onSuccess: (player) => {
          player.faction.caravan += 5;
          return "You don't add anything. Nobody minds. Some nights the only thing asked of you is to be there. (+5 Caravan)";
        },
      },
      {
        id: 'ask_about_sera',
        label: 'Ask what Sera Voss was like, before.',
        onSuccess: (player, ctx) => {
          player.faction.archive += 4;
          player.faction.caravan += 4;
          ctx.addLoreFragment('sera_voss_ledger_entry');
          return '"Quieter," one of them says. "Then louder. Then quiet again, but a different kind." Nobody elaborates further, and you get the sense nobody has to. (+4 Archive, +4 Caravan, a lore fragment)';
        },
      },
    ],
  },

  second_excavation: {
    id: 'second_excavation',
    title: 'The Second Excavation',
    pageRange: [6, 8],
    flavorText:
      "A camp, professionally struck, methodically abandoned — not Keth-7, but built by people who clearly knew what Keth-7 was. A field journal sits open on a folding table, mid-sentence, waiting for a hand that isn't coming back to finish it.",
    choices: [
      {
        id: 'read_the_journal',
        label: 'Read the journal. (INT check, DC 13)',
        check: { stat: 'int', dc: 13 },
        onSuccess: (player, ctx) => {
          player.faction.archive += 10;
          player.resonance = Math.min(100, player.resonance + 3);
          ctx.setFlag('found_second_team');
          return "It's a survey team, sent quietly after Keth-7, to see if the phenomenon was isolated. Their last entry is one line: 'It is not isolated. It was never isolated. Tell no one until we understand why it chose her instead of the rest of us.' (+10 Archive, +3 Resonance)";
        },
        onFailure: () => 'The handwriting degrades badly toward the end, and you can only make out fragments. Enough to unsettle you. Not enough to understand.',
      },
      {
        id: 'seal_the_site',
        label: 'Seal the site and report nothing.',
        onSuccess: (player) => {
          player.faction.sable += 10;
          return "Some knowledge is a wound that heals cleaner if nobody keeps reopening it, or so the Order would say. You leave the camp exactly as sealed as you found it. (+10 Sable)";
        },
      },
      {
        id: 'take_their_supplies',
        label: 'Take what supplies are still usable and move on.',
        onSuccess: (player) => {
          const gold = 15 + Math.floor(Math.random() * 20);
          player.gold += gold;
          player.faction.caravan += 5;
          return `Practical, if nothing else. Whoever they were, they don't need any of it anymore. +${gold} gold. (+5 Caravan)`;
        },
      },
    ],
  },
};

export const TRAPS: Record<string, TrapDef> = {
  memory_trap: {
    id: 'memory_trap',
    title: 'Memory Trap',
    flavorText: 'The floor remembers being liquid. For a moment, so do you. You remember drowning. You remember loving it.',
    avoidStat: 'dex',
    avoidDC: 12,
    onTrigger: (player, ctx) => {
      const loss = rollDie(4, ctx.rng);
      player.resonance = Math.max(0, player.resonance - loss);
      const dmg = player.resonance < 10 ? 15 : 8;
      player.currentHP = Math.max(1, player.currentHP - dmg);
      return `The floor remembers. You lose ${loss} Resonance and take ${dmg} damage.`;
    },
    onAvoid: () => 'You feel the wrongness half a second before your foot lands, and step around it.',
  },
  collapsing_floor: {
    id: 'collapsing_floor',
    title: 'Collapsing Floor',
    flavorText: 'The step you took was the last step that stone intended to bear.',
    avoidStat: 'dex',
    avoidDC: 10,
    onTrigger: (player, ctx) => {
      const back = rollDie(3, ctx.rng);
      player.currentHP = Math.max(1, player.currentHP - 10);
      player.flags.skip_next_rest = true;
      return `You fall through. Move back ${back} nodes, take 10 damage, and your next Rest node is skipped.`;
    },
    onAvoid: () => 'You grab the edge in time, boots dangling over a very old drop.',
  },
};

export function eligibleEvents(page: number, resonance: number, seen: Set<string>, flags: Record<string, boolean> = {}): EventDef[] {
  return Object.values(EVENTS).filter((e) => {
    if (!e.repeatable && seen.has(e.id)) return false;
    if (page < e.pageRange[0] || page > e.pageRange[1]) return false;
    if (e.minResonance !== undefined && resonance < e.minResonance) return false;
    if (e.maxResonance !== undefined && resonance > e.maxResonance) return false;
    if (e.requiresAnyFlag && !e.requiresAnyFlag.some((f) => flags[f])) return false;
    return true;
  });
}
