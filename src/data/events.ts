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

export function eligibleEvents(page: number, resonance: number, seen: Set<string>): EventDef[] {
  return Object.values(EVENTS).filter((e) => {
    if (!e.repeatable && seen.has(e.id)) return false;
    if (page < e.pageRange[0] || page > e.pageRange[1]) return false;
    if (e.minResonance !== undefined && resonance < e.minResonance) return false;
    if (e.maxResonance !== undefined && resonance > e.maxResonance) return false;
    return true;
  });
}
