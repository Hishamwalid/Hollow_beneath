import type { BossDef, BossPhaseInfo, EnemyTurnContext } from './types';
import { statCheck } from '@systems/checks';

export const TOTAL_MAJOR_BOSSES = 5;

function bossDamage(atk: number, def: number, power: number): number {
  return Math.max(3, Math.round((atk - def / 2) * power));
}

function bossMagic(matk: number, mdef: number, power: number): number {
  return Math.max(3, Math.round((matk - mdef / 2) * power));
}

// ============================================================================
// BOSS 1 — THE ARGENT SENTINEL (Node 40 / Page 4)
// Weak: Pierce | Null: Sacred | Drain: Frost
// ============================================================================

const sentinelPhases: BossPhaseInfo[] = [
  { key: 'curator', label: 'The Curator', hpFloorPercent: 0.66, affinities: { shock: 'str' } },
  { key: 'erudite', label: 'The Erudite', hpFloorPercent: 0.33, affinities: {} },
  { key: 'guardian', label: 'The Desperate Guardian', hpFloorPercent: 0, affinities: { slash: 'wk' } },
];

export const SENTINEL: BossDef = {
  id: 'sentinel',
  name: 'The Argent Sentinel',
  vennName: 'Keth-Vor, the First Door',
  page: 4,
  level: 3,
  theme: 'The danger of curiosity.',
  baseStats: { hp: 150, mp: 50, atk: 15, matk: 12, def: 12, mdef: 11, spd: 14 },
  approachText:
    "It stands where the corridor narrows into a single door of tarnished silver, unmoving until you are three steps away. Then it turns — not fast, not slow, exactly the speed of something that has done this before. Its surface is engraved, edge to edge, with a language that keeps almost resolving into words you know. It does not raise a weapon. It simply waits, the way a locked door waits, to see what you'll try.",
  preCombatChoices: [
    {
      id: 'will_check',
      label: 'Try to read its intent. (WILL check, DC 10)',
      apply: (_player, flags, rng) => {
        if (statCheck(_player.stats.will, 10, rng)) {
          flags.sentinelInsight = 1;
          return 'You sense it is testing, not attacking. (Start the fight with +1 Momentum.)';
        }
        return "Its intent stays unreadable. You'll have to find out the hard way.";
      },
    },
    {
      id: 'attack_now',
      label: 'Strike before it finishes turning.',
      apply: () => 'Silver shrieks against your blade as it completes its turn anyway.',
    },
  ],
  phases: sentinelPhases,
  moves: [
    {
      id: 'aegis_slam', label: 'Aegis Slam', weight: 3, heavy: true,
      description: 'Heavy Blunt damage.',
      resolve(ctx) {
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.3);
        ctx.applyDamageToPlayer(dmg, 'blunt', `${ctx.self.name} — Aegis Slam`);
        ctx.log.push(`${ctx.self.name} brings its palm down like a door slamming — Aegis Slam for ${dmg}.`);
        return '';
      },
    },
    {
      id: 'glint_ray', label: 'Glint Ray', weight: 2,
      description: 'Single-target Sacred damage.',
      resolve(ctx) {
        const dmg = bossMagic(ctx.self.matk, ctx.player.mdef, 1.2);
        ctx.applyDamageToPlayer(dmg, 'sacred', `${ctx.self.name} — Glint Ray`);
        ctx.log.push(`A ray of cited light — ${dmg} damage.`);
        return '';
      },
    },
    {
      id: 'charge_protocol', label: 'Charge Protocol', weight: 4, charge: true,
      description: 'Charges for 1 turn; unleashes Unstoppable Strike next turn. Guard!',
      condition: (ctx) => !ctx.self.flags.chargedOnce || ctx.turn - (ctx.self.flags.chargedOnce ?? 0) >= 5,
      resolve(ctx) {
        // Unleash path handled by the engine on the following turn.
        void ctx;
        return '';
      },
    },
    {
      id: 'unstoppable_strike', label: 'Unstoppable Strike', weight: 0,
      description: 'Massive Physical damage — must Guard!',
      resolve(ctx) {
        const dmg = bossDamage(ctx.self.atk * 1.6, ctx.player.def, 1.8);
        ctx.applyDamageToPlayer(dmg, 'blunt', `${ctx.self.name} — Unstoppable Strike`);
        ctx.log.push(`UNSTOPPABLE STRIKE — ${dmg} damage. The corridor rings like a struck bell.`);
        return '';
      },
    },
  ],
  aftermathText: () =>
    'The silver light fades from its engravings all at once, like a held breath finally let go. It does not fall so much as settle, the way a door settles back into its frame. Somewhere underneath the corridor, you feel — rather than hear — something unlock.',
  getRewards: () => ({
    factionDelta: { archive: 20 },
    resonanceDelta: 5,
    echoShards: 5,
    skillUnlock: 'steady_hands',
    loreFragment: 'sentinels_confession',
    flag: 'sentinel_defeated',
  }),
};

// ============================================================================
// BOSS 2 — PATRIARCH OREN CASS (Node 80 / Page 8)
// Weak: Shock + Frost | Reflect: Physical | Drain: Shadow
// ============================================================================

const patriarchPhases: BossPhaseInfo[] = [
  { key: 'devout', label: 'The Devout', hpFloorPercent: 0.3, affinities: {} },
  { key: 'martyr', label: 'The Martyr', hpFloorPercent: 0, affinities: {} },
];

/** Pre-combat defense concessions applied once the fight begins. */
function patriarchPrepare(ctx: EnemyTurnContext): void {
  if ((ctx.self.flags.cassDefWeakened ?? 0) === 1 && !ctx.self.flags.cassDefWeakenedApplied) {
    ctx.self.flags.cassDefWeakenedApplied = 1;
    ctx.self.def = Math.round(ctx.self.def * 0.8);
  }
  if ((ctx.self.flags.scriptureDefWeakened ?? 0) === 1 && !ctx.self.flags.scriptureDefWeakenedApplied) {
    ctx.self.flags.scriptureDefWeakenedApplied = 1;
    ctx.self.def = Math.round(ctx.self.def * 0.9);
  }
}

export const PATRIARCH: BossDef = {
  id: 'patriarch',
  name: 'Patriarch Oren Cass',
  vennName: 'The Ash Covenant, Ascendant',
  page: 8,
  level: 6,
  theme: 'Faith as anesthetic.',
  baseStats: { hp: 210, mp: 70, atk: 16, matk: 20, def: 16, mdef: 18, spd: 12 },
  approachText:
    "He is kneeling when you find him, in front of a fire that isn't consuming anything you can see. He does not stand. 'You've been so loud,' he says, not unkindly, 'asking things that already have answers.' The ash on his sleeves is old, layered, a decade of small burnings. When he finally looks up, his eyes have the calm of a man who has already forgiven you for what you're about to make him do.",
  preCombatChoices: [
    {
      id: 'accept',
      label: 'Accept his purification. (skips the fight)',
      skipsCombat: true,
      apply: (player, _flags) => {
        player.resonance = 0;
        player.faction.sable += 30;
        player.derived.maxMP = Math.round(player.derived.maxMP * 0.8);
        player.currentMP = Math.min(player.currentMP, player.derived.maxMP);
        player.flags.accepted_purification = true;
        player.history.push('accepted_purification');
        return "You accept his mercy. The weight lifts — and so, quietly, does a part of you that used to be there. (Resonance reset to 0, Max MP -20% permanently, +30 Sable)";
      },
    },
    {
      id: 'refuse',
      label: 'Refuse him.',
      apply: (player) => {
        player.faction.sable += 5;
        return 'You refuse. Cass nods, unsurprised, and reaches for the fire himself.';
      },
    },
    {
      id: 'ask',
      label: 'Ask what he burned. (INT ≥ 7)',
      requirement: (p) => p.stats.int >= 7,
      apply: (player, flags) => {
        player.faction.sable += 10;
        player.resonance = Math.min(100, player.resonance + 5);
        flags.cassDefWeakened = 1;
        return "He tells you. His voice doesn't shake, but his hands do. (Patriarch's Defense -20% this fight)";
      },
    },
    {
      id: 'confront',
      label: '"I know what you burned."',
      requirement: (p) => !!p.flags.sable_scripture_unlocked,
      apply: (player, flags) => {
        player.faction.sable += 10;
        flags.scriptureDefWeakened = 1;
        return '"I know what you burned." The Patriarch freezes. For a moment, you see fear in his eyes. (Defense -10% this fight, +10 Sable)';
      },
    },
  ],
  phases: patriarchPhases,
  moves: [
    {
      id: 'opening_barrier', label: 'Opening Barrier', weight: 2000,
      description: 'Raises a Barrier and begins to pray.',
      condition: (ctx) => ctx.turn === 1,
      resolve(ctx) {
        patriarchPrepare(ctx);
        ctx.setBarrier(45);
        ctx.log.push(`${ctx.self.name} raises a Barrier (45) and begins to pray.`);
        return '';
      },
    },
    {
      id: 'recast_barrier', label: 'Recast Barrier', weight: 1500,
      description: 'Renews his Barrier every third turn while Devout.',
      condition: (ctx) => ctx.turn > 1 && ctx.turn % 3 === 1 && ctx.phaseKey === 'devout' && !ctx.self.statuses.some((s) => s.id === 'barrier'),
      resolve(ctx) {
        patriarchPrepare(ctx);
        ctx.setBarrier(45);
        ctx.log.push(`${ctx.self.name} recasts his Barrier (45).`);
        return '';
      },
    },
    {
      id: 'shadow_bolt', label: 'Shadow Bolt', weight: 3, heavy: true,
      description: 'Heavy Shadow damage.',
      resolve(ctx) {
        patriarchPrepare(ctx);
        const dmg = bossMagic(ctx.self.matk, ctx.player.mdef, 1.35);
        ctx.applyDamageToPlayer(dmg, 'shadow', `${ctx.self.name} — Shadow Bolt`);
        ctx.log.push(`${ctx.self.name} hurls condensed night — Shadow Bolt for ${dmg}.`);
        return '';
      },
    },
    {
      id: 'miasma', label: 'Miasma', weight: 2,
      description: 'Inflicts Poison for 3 turns.',
      condition: (ctx) => !ctx.player.statuses.some((s) => s.id === 'poison'),
      resolve(ctx) {
        patriarchPrepare(ctx);
        ctx.applyStatusToPlayer('poison', 3);
        ctx.log.push('Miasma coils around you. (Poison, 3 turns)');
        return '';
      },
    },
    {
      id: 'executioners_toll', label: "Executioner's Toll", weight: 3,
      description: 'Pierce attack dealing 2.0x damage if you are Poisoned.',
      resolve(ctx) {
        patriarchPrepare(ctx);
        const poisoned = ctx.player.statuses.some((s) => s.id === 'poison');
        const mult = poisoned ? 2.0 : 1.0;
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 0.9 * mult);
        if (poisoned) {
          ctx.applyDamageToPlayer(dmg, 'pierce', `${ctx.self.name} — Executioner's Toll`, { bypassGuard: true });
          ctx.log.push(`TOLL COLLECTED — the poison guides his blade through your guard. ${dmg} damage.`);
        } else {
          ctx.applyDamageToPlayer(dmg, 'pierce', `${ctx.self.name} — Executioner's Toll`);
          ctx.log.push(`A collector's strike for ${dmg} damage. Poisoned, it would hurt far more.`);
        }
        return '';
      },
    },
    {
      id: 'summon_zealots', label: 'Summon Zealots', weight: 900,
      description: 'Calls two Sable Zealots to his side.',
      condition: (ctx) => ctx.turn > 1 && ctx.self.hp / ctx.self.maxHp < 0.7 && !ctx.self.flags.summonedZealots,
      resolve(ctx) {
        patriarchPrepare(ctx);
        ctx.self.flags.summonedZealots = 1;
        ctx.spawnAlly('sable_zealot', 40);
        ctx.spawnAlly('sable_zealot', 40);
        ctx.log.push(`${ctx.self.name} calls two Sable Zealots to his side.`);
        return '';
      },
    },
    {
      id: 'whisper_healing_prayer', label: 'Whisper Healing Prayer', weight: 800,
      description: 'Heals himself the first time he is badly wounded.',
      condition: (ctx) => ctx.turn > 1 && ctx.self.hp / ctx.self.maxHp < 0.6 && !ctx.self.flags.healedOnce,
      resolve(ctx) {
        patriarchPrepare(ctx);
        ctx.self.flags.healedOnce = 1;
        ctx.healSelf(30);
        ctx.log.push(`${ctx.self.name} whispers a Healing Prayer over himself. (+30 HP)`);
        return '';
      },
    },
    {
      id: 'dispel_holy', label: 'Dispel Holy', weight: 600,
      description: 'Strips your buffs when you are heavily enhanced.',
      condition: (ctx) => ctx.turn > 1 && ctx.player.statuses.filter((s) => ['focus', 'fortify', 'blessing', 'haste', 'barrier', 'atk_up', 'defense_up', 'regeneration'].includes(s.id)).length >= 2,
      resolve(ctx) {
        patriarchPrepare(ctx);
        ctx.removePlayerBuffs();
        ctx.log.push(`${ctx.self.name} casts Dispel Holy, stripping your buffs.`);
        return '';
      },
    },
    {
      id: 'punishing_strike', label: 'Punishing Strike', weight: 2,
      description: 'A heavy sacred blow that scales with your Resonance.',
      resolve(ctx) {
        patriarchPrepare(ctx);
        const res = ctx.self.flags.playerResonance ?? 0;
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.4) + Math.round(res * 0.3);
        ctx.applyDamageToPlayer(dmg, 'sacred', `${ctx.self.name} — Punishing Strike`);
        ctx.log.push(`${ctx.self.name} lands a Punishing Strike for ${dmg} damage.`);
        return '';
      },
    },
    {
      id: 'martyrs_flame', label: "Martyr's Flame", weight: 999, charge: true,
      description: 'Stops holding back: an unGuardable sacred conflagration — declared one turn ahead.',
      condition: (ctx) => ctx.phaseKey === 'martyr' && !ctx.self.flags.martyrUsed,
      resolve(ctx) {
        // Unleash path handled by the engine.
        void ctx;
        return '';
      },
    },
    {
      id: 'unleash_martyrs_flame', label: "Unleash Martyr's Flame", weight: 0,
      description: 'Unguardable Martyr\'s Flame with self-recoil.',
      resolve(ctx) {
        if (!ctx.self.flags.martyrEntered) {
          ctx.self.flags.martyrEntered = 1;
          ctx.self.atk = Math.round(ctx.self.atk * 1.25);
          ctx.log.push(`${ctx.self.name} stops holding back. (Attack +25%)`);
        }
        const dmg = bossMagic(ctx.self.matk * 1.5, ctx.player.mdef, 1.6);
        ctx.damageSelf(15);
        ctx.applyDamageToPlayer(dmg, 'sacred', `${ctx.self.name} — Martyr's Flame`, { bypassGuard: true });
        ctx.log.push(`MARTYR'S FLAME — ${dmg}, unGuardable (he pays 15 HP for it).`);
        return '';
      },
    },
  ],
  aftermathText: (flags) =>
    (flags.cassDefWeakened ?? 0) === 1
      ? 'He kneels again before he falls, and this time it looks less like prayer. "You already knew," he says. "That\'s the part I couldn\'t forgive." The fire behind him finally goes out.'
      : "He goes down still murmuring the same rite, three words behind where he should be. The fire behind him gutters and, for the first time since you arrived, actually looks like it's burning something.",
  getRewards: () => ({
    factionDelta: { sable: 25 },
    resonanceDelta: 8,
    echoShards: 5,
    skillUnlock: 'martyrs_flame',
    loreFragment: 'cass_unburnt_memory',
    flag: 'cass_defeated',
  }),
};

// ============================================================================
// BOSS 3 — THE MERGED CHORUS (Node 120 / Page 12)
// Weak: Flame + Shock | Null: Physical | Unison Shift swaps weaknesses
// ============================================================================

const chorusPhases: BossPhaseInfo[] = [
  { key: 'chorus', label: 'Many Voices', hpFloorPercent: 0, affinities: {} },
];

type ChorusShift = 'flame_shock' | 'frost_sacred';

function chorusSet(shift: ChorusShift): Record<string, 'wk' | 'null'> {
  if (shift === 'flame_shock') return { flame: 'wk', shock: 'wk', slash: 'null', pierce: 'null', blunt: 'null' };
  return { frost: 'wk', sacred: 'wk', slash: 'null', pierce: 'null', blunt: 'null' };
}

export const CHORUS: BossDef = {
  id: 'chorus',
  name: 'The Merged Chorus',
  vennName: 'The Loom, Speaking With Borrowed Mouths',
  page: 12,
  level: 9,
  theme: 'The self as a chosen fiction.',
  baseStats: { hp: 260, mp: 80, atk: 17, matk: 21, def: 12, mdef: 16, spd: 15 },
  approachText:
    "It used to be several people. You can still see the seams — a hand that doesn't match the shoulder, a voice that changes mid-word into someone else's cadence. When it speaks, it speaks in chorus, every syllable a small argument about who gets to say it. 'We volunteered,' it tells you, all at once. 'That's the part everyone forgets to ask.'",
  preCombatChoices: [
    {
      id: 'insight',
      label: 'Sense whether this is a fight you can win through attrition. (WILL check, DC 12)',
      apply: (_p, flags, rng) => {
        if (statCheck(_p.stats.will, 12, rng)) {
          flags.chorusInsight = 1;
          return "You realize you can't win this through attrition alone. (Start with +1 Momentum.)";
        }
        return "You can't tell, one way or the other.";
      },
    },
    {
      id: 'challenge',
      label: 'Challenge their sacrifice.',
      apply: (_p, flags) => {
        flags.chorusChallenge = 1;
        return 'The Chorus flinches — actually flinches — and loses its footing for a moment.';
      },
    },
    {
      id: 'appeal',
      label: 'Appeal to scholarly pride.',
      apply: (_p, flags) => {
        flags.chorusAppeal = 1;
        return 'It cannot resist correcting your assumption.';
      },
    },
    {
      id: 'offer',
      label: 'Offer yourself instead. (Resonance ≥ 30)',
      requirement: (p) => p.resonance >= 30,
      apply: (_p, flags) => {
        flags.chorusOffer = 1;
        return 'Something in the chorus goes quiet, considering you.';
      },
    },
    {
      id: 'attack',
      label: 'Attack without words.',
      apply: () => 'You waste no time on words. The Chorus responds in kind.',
    },
  ],
  phases: chorusPhases,
  moves: [
    {
      id: 'hesitate', label: 'Internal Argument', weight: 4000,
      description: 'Its own voices argue about resisting you.',
      condition: (ctx) => ctx.turn === 1 && ((ctx.self.flags.chorusChallenge ?? 0) === 1 || (ctx.self.flags.chorusAppeal ?? 0) === 1 || (ctx.self.flags.chorusOffer ?? 0) === 1),
      resolve(ctx) {
        ctx.log.push(`${ctx.self.name} hesitates, its voices arguing amongst themselves.`);
        return '';
      },
    },
    {
      id: 'unison_shift', label: 'Unison Shift', weight: 3000,
      description: 'Swaps elemental weaknesses mid-encounter.',
      condition: (ctx) => ctx.turn > 1 && ctx.turn % 4 === 0,
      resolve(ctx) {
        const current: ChorusShift = ctx.self.flags.shiftState === 1 ? 'frost_sacred' : 'flame_shock';
        const next: ChorusShift = current === 'flame_shock' ? 'frost_sacred' : 'flame_shock';
        ctx.self.affinities = chorusSet(next) as typeof ctx.self.affinities;
        ctx.self.flags.shiftState = next === 'frost_sacred' ? 1 : 0;
        ctx.log.push(`UNISON SHIFT — the voices trade places. Its weaknesses realign.`);
        return '';
      },
    },
    {
      id: 'discordant_howl', label: 'Discordant Howl', weight: 3, heavy: true,
      description: 'AOE Sonic/Blunt damage.',
      resolve(ctx) {
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.15);
        ctx.applyDamageToPlayer(dmg, 'blunt', `${ctx.self.name} — Discordant Howl`);
        ctx.log.push(`Every mouth opens at once — Discordant Howl for ${dmg}.`);
        return '';
      },
    },
    {
      id: 'chorus_flame_pulse', label: 'Flame Pulse', weight: 3,
      description: 'Flame damage in borrowed cadence.',
      resolve(ctx) {
        const dmg = bossMagic(ctx.self.matk, ctx.player.mdef, 1.15);
        ctx.applyDamageToPlayer(dmg, 'flame', `${ctx.self.name} — Flame Pulse`);
        ctx.log.push(`Someone's old firelight answers for ${dmg}.`);
        return '';
      },
    },
    {
      id: 'many_voiced_strike', label: 'Many-Voiced Strike', weight: 2,
      description: 'A physical blow argued over by everyone at once.',
      resolve(ctx) {
        const types = ['slash', 'pierce', 'blunt'] as const;
        const t = types[Math.floor(ctx.rng() * types.length)];
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.05);
        ctx.applyDamageToPlayer(dmg, t, `${ctx.self.name} — Many-Voiced Strike`);
        ctx.log.push(`They all swing at once (${t}) — ${dmg} damage.`);
        return '';
      },
    },
  ],
  aftermathText: (flags) => {
    if ((flags.chorusOffer ?? 0) === 1) {
      return "The voices do not scatter so much as settle — into you, a little. Something that was several people looks at you with what might be gratitude, and stops being anything at all. You feel heavier, and more crowded, in a way that isn't entirely unwelcome.";
    }
    if ((flags.chorusAppeal ?? 0) === 1) {
      return "They argue themselves apart mid-collapse, still correcting each other's citations on the way down. It might be the most scholarly death you've ever witnessed.";
    }
    if ((flags.chorusChallenge ?? 0) === 1) {
      return 'The Chorus fragments the moment you name what was done to it. Whatever held all those voices together simply stops bothering, and they go their separate, quiet ways.';
    }
    return "The seams finally give. What was several people separates back into something more like silence, and less like anyone. You are fairly sure, standing there, that you heard it thank you — though you couldn't say in which voice.";
  },
  getRewards: (flags) => {
    if ((flags.chorusOffer ?? 0) === 1) {
      return {
        resonanceDelta: 15,
        maxHpPercentDelta: -20,
        echoShards: 5,
        skillUnlock: 'chorus_echo',
        loreFragment: 'chorus_you_are_willing',
        flag: 'chorus_offered_self',
      };
    }
    if ((flags.chorusAppeal ?? 0) === 1) {
      return {
        factionDelta: { archive: 15 },
        resonanceDelta: 5,
        echoShards: 5,
        skillUnlock: 'archival_insight',
        loreFragment: 'chorus_the_choirs_tragedy_scholarly',
        flag: 'chorus_defeated_appeal',
      };
    }
    if ((flags.chorusChallenge ?? 0) === 1) {
      return {
        factionDelta: { sable: 20 },
        resonanceDelta: 10,
        echoShards: 5,
        loreFragment: 'chorus_the_choirs_tragedy',
        flag: 'chorus_defeated_challenge',
      };
    }
    return {
      resonanceDelta: 5,
      echoShards: 5,
      loreFragment: 'chorus_was_a_warning',
      flag: 'chorus_defeated_attack',
    };
  },
};

// ============================================================================
// BOSS 4 — THE FOSSIL KING (Node 160 / Page 16)
// Weak: Sacred + Blunt | Drain: Flame | Reflect: Pierce
// ============================================================================

const fossilPhases: BossPhaseInfo[] = [
  { key: 'decree', label: 'Regal Decree', hpFloorPercent: 0.76, affinities: {} },
  { key: 'rebellion', label: 'The Rebellion', hpFloorPercent: 0.52, affinities: {} },
  { key: 'silence', label: 'The Silence', hpFloorPercent: 0.28, affinities: {} },
  { key: 'fossil', label: 'The Fossil', hpFloorPercent: 0, affinities: { shadow: 'wk' } },
];

export const FOSSIL_KING: BossDef = {
  id: 'fossil_king',
  name: 'The Fossil King',
  vennName: 'Dominion, Last of Its Court',
  page: 16,
  level: 13,
  theme: 'Power that outlived its purpose.',
  baseStats: { hp: 320, mp: 60, atk: 22, matk: 20, def: 18, mdef: 18, spd: 11 },
  approachText:
    "The throne is stone, and so, mostly, is he — a king fossilizing in real time, mid-decree, one hand still raised for an order nobody living remembers how to follow. His voice comes from somewhere behind his own calcified mouth, layered and slow. 'Kneel,' he says, from habit more than expectation. 'Or don't. There's no one left to enforce it but me, and I am so very tired.'",
  preCombatChoices: [
    {
      id: 'ask_become',
      label: 'What did the Venn become?',
      apply: (player) => {
        player.resonance = Math.min(100, player.resonance + 10);
        player.faction.archive += 10;
        return 'He answers plainly, the way only the very old or the very tired do. It costs you something to hear it.';
      },
    },
    {
      id: 'ask_stay',
      label: 'Why did you stay?',
      apply: (player) => {
        player.resonance = Math.min(100, player.resonance + 5);
        player.faction.caravan += 5;
        return "'Someone has to hold the door,' he says, 'even after everyone has stopped using it.'";
      },
    },
    {
      id: 'ask_stop',
      label: 'Will you stop me?',
      apply: (_player, flags) => {
        flags.fossilProvoked = 1;
        return 'He laughs — stone grinding on stone. "I can certainly try." (His HP is reduced 10%, provoked)';
      },
    },
    {
      id: 'no_question',
      label: 'I have no question. (WILL ≥ 8)',
      requirement: (p) => p.stats.will >= 8,
      apply: (player, flags) => {
        player.faction.caravan += 5;
        player.faction.sable += 5;
        flags.fossilBarrier = 1;
        return 'He nods, almost approving. A Barrier settles around you before the fight starts.';
      },
    },
  ],
  phases: fossilPhases,
  moves: [
    {
      id: 'imperial_edict', label: 'Imperial Edict', weight: 3000,
      description: 'Attack and Defense +20% once, early in the fight.',
      condition: (ctx) => ctx.phaseKey === 'decree' && !ctx.self.flags.edictUsed,
      resolve(ctx) {
        ctx.self.flags.edictUsed = 1;
        ctx.buffSelf('atk', 20);
        ctx.buffSelf('def', 20);
        ctx.log.push(`${ctx.self.name} issues an Imperial Edict — Attack and Defense +20%.`);
        return '';
      },
    },
    {
      id: 'summon_court', label: 'Summon the Court', weight: 2500,
      description: 'Two Dominion Echo-Soldiers rise to fight for him.',
      condition: (ctx) => ctx.phaseKey === 'decree' && (ctx.self.flags.edictUsed ?? 0) === 1 && !ctx.self.flags.courtSummoned,
      resolve(ctx) {
        ctx.self.flags.courtSummoned = 1;
        ctx.spawnAlly('echo_soldier', 50);
        ctx.spawnAlly('echo_soldier', 50);
        ctx.log.push(`${ctx.self.name} summons the Court — two Dominion Echo-Soldiers.`);
        return '';
      },
    },
    {
      id: 'primeval_crush', label: 'Primeval Crush', weight: 3, heavy: true,
      description: 'Heavy Blunt AOE damage.',
      resolve(ctx) {
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.25);
        ctx.applyDamageToPlayer(dmg, 'blunt', `${ctx.self.name} — Primeval Crush`);
        ctx.log.push(`The throne room itself seems to fall on you — Primeval Crush for ${dmg}.`);
        return '';
      },
    },
    {
      id: 'petrifying_gaze', label: 'Petrifying Gaze', weight: 2,
      description: 'Inflicts Slow — the QTE needle sweeps at double speed.',
      condition: (ctx) => !ctx.player.statuses.some((s) => s.id === 'slowed'),
      resolve(ctx) {
        ctx.applyStatusToPlayer('slowed', 3);
        ctx.log.push('His gaze catches you mid-motion. Stone creeps along your sleeves. (Slowed, 3 turns)');
        return '';
      },
    },
    {
      id: 'tax_of_flesh', label: 'Tax of Flesh', weight: 2,
      description: 'Drains 10% of your max HP and heals himself for the same.',
      condition: (ctx) => ctx.phaseKey !== 'fossil' && ctx.turn % 3 === 0 && ctx.turn > 1,
      resolve(ctx) {
        const tax = Math.max(6, Math.round(ctx.player.maxHp * 0.1));
        const dmg = ctx.applyDamageToPlayer(tax, 'blunt', `${ctx.self.name} — Tax of Flesh`, { bypassGuard: true });
        ctx.healSelf(tax);
        ctx.log.push(`"Taxed." ${dmg} of you belongs to the crown now.`);
        return '';
      },
    },
    {
      id: 'last_law', label: 'the Last Law', weight: 2,
      description: 'Sacred decree damage.',
      condition: (ctx) => ctx.phaseKey === 'silence' || ctx.phaseKey === 'rebellion',
      resolve(ctx) {
        const dmg = bossMagic(ctx.self.matk, ctx.player.mdef, 1.2);
        ctx.applyDamageToPlayer(dmg, 'sacred', `${ctx.self.name} — the Last Law`);
        ctx.log.push(`${ctx.self.name} invokes the Last Law — ${dmg} damage.`);
        return '';
      },
    },
    {
      id: 'cataclysm_charge', label: 'Cataclysm', weight: 999, charge: true,
      description: 'Charges for 1 turn; delivers an unblockable strike next turn.',
      condition: (ctx) => ctx.phaseKey !== 'fossil' && (turnsWithNoCharge(ctx) >= 4),
      resolve(ctx) {
        void ctx;
        return '';
      },
    },
    {
      id: 'cataclysm_unleash', label: 'Cataclysm', weight: 0,
      description: 'Unblockable physical devastation.',
      resolve(ctx) {
        const dmg = bossDamage(ctx.self.atk * 1.7, ctx.player.def, 1.9);
        ctx.applyDamageToPlayer(dmg, 'blunt', `${ctx.self.name} — Cataclysm`, { bypassGuard: true });
        ctx.log.push(`CATACLYSM — ${dmg}, unblockable. Dust falls from the ceiling in sheets.`);
        return '';
      },
    },
    {
      id: 'fossil_last_blow', label: 'a last, unfocused blow', weight: 3,
      description: 'The Fossil phase: weak strikes only.',
      resolve(ctx) {
        const dmg = bossDamage(ctx.self.atk * 0.6, ctx.player.def, 1.0);
        ctx.applyDamageToPlayer(dmg, 'slash', `${ctx.self.name} — a last, unfocused blow`);
        ctx.log.push(`${ctx.self.name} strikes weakly for ${dmg} damage.`);
        return '';
      },
    },
  ],
  aftermathText: (flags) =>
    (flags.ultimateCharging ?? 0) === 1
      ? 'He falls mid-syllable, the ultimate decree unfinished, and something in his stone face looks — almost — relieved. "...thank...you..." is all that makes it out before the quiet takes the rest.'
      : 'The last of him settles into the throne completely, indistinguishable now from the stone around it. The Court he ruled crumbles a little further with him, the way an argument does once no one is left to keep having it.',
  getRewards: () => ({
    factionDelta: { caravan: 15, archive: 10 },
    resonanceDelta: 10,
    echoShards: 8,
    skillUnlock: undefined,
    loreFragment: 'fossil_kings_court',
    itemReward: 'fossil_crown',
    flag: 'fossil_king_defeated',
  }),
};

/** Turns since this enemy last declared/unleashed a charged move. */
function turnsWithNoCharge(ctx: EnemyTurnContext): number {
  const last = ctx.self.flags.lastChargeTurn ?? 0;
  return ctx.turn - last;
}

// ============================================================================
// BOSS 5 — THE FINAL REFLECTION (Node 200 / Page 20)
// Dynamic affinities — it fights like you.
// ============================================================================

const reflectionPhases: BossPhaseInfo[] = [
  { key: 'argument', label: 'The Argument', hpFloorPercent: 0.72, affinities: {} },
  { key: 'evidence', label: 'The Evidence', hpFloorPercent: 0.44, affinities: {} },
  { key: 'question', label: 'The Question', hpFloorPercent: 0.16, affinities: {} },
  { key: 'answer', label: 'The Answer', hpFloorPercent: 0, affinities: {} },
];

function statTypeFor(build: { str: number; dex: number; con: number; int: number; will: number }): string {
  const entries: Array<[string, number]> = [
    ['str', build.str], ['dex', build.dex], ['con', build.con], ['int', build.int], ['will', build.will],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

const STAT_DAMAGE_TYPE: Record<string, 'slash' | 'pierce' | 'blunt' | 'shock' | 'shadow'> = {
  str: 'slash', dex: 'pierce', con: 'blunt', int: 'shock', will: 'shadow',
};

export const REFLECTION: BossDef = {
  id: 'reflection',
  name: 'The Final Reflection',
  vennName: 'The Loom, Wearing You',
  page: 20,
  level: 15,
  theme: 'You were the mystery all along.',
  baseStats: { hp: 360, mp: 90, atk: 22, matk: 22, def: 15, mdef: 15, spd: 18 },
  approachText:
    "The last chamber is mirrors, floor to ceiling, and every one of them is you — not flattering, not distorted, just accurate in a way that's somehow worse. When it finally steps out of the glass, it isn't wearing your face so much as your posture, your specific way of being afraid. 'You made choices,' it says, in your own voice, pitched slightly wrong. 'I'd like to show you what they were for.'",
  phases: reflectionPhases,
  moves: [
    {
      id: 'mirror_you', label: 'Mirror Cast', weight: 5000,
      description: "Copies your build and your six equipped skills.",
      condition: (ctx) => ctx.turn === 1,
      resolve(ctx) {
        const primary = statTypeFor(ctx.playerStats);
        if (primary === 'str') { ctx.buffSelf('atk', 25); ctx.log.push(`${ctx.self.name} mirrors your strength. (Attack +25%)`); }
        else if (primary === 'int') { ctx.buffSelf('matk', 25); ctx.log.push(`${ctx.self.name} mirrors your intellect. (Magic Attack +25%)`); }
        else if (primary === 'dex') { ctx.buffSelf('spd', 25); ctx.log.push(`${ctx.self.name} mirrors your speed. (Speed +25%)`); }
        else if (primary === 'con') { ctx.self.maxHp = Math.round(ctx.self.maxHp * 1.15); ctx.self.hp = ctx.self.maxHp; ctx.log.push(`${ctx.self.name} mirrors your endurance. (Max HP +15%)`); }
        else { ctx.buffSelf('mdef', 20); ctx.log.push(`${ctx.self.name} mirrors your will. (Magic Defense +20%)`); }
        ctx.log.push(`It rehearses your own loadout — Mirror Cast copies your equipped skills.`);
        return '';
      },
    },
    {
      id: 'quoted_choice', label: 'Quoted Choice', weight: 3,
      description: 'Throws one of your own choices back at you.',
      condition: (ctx) => ctx.phaseKey === 'argument',
      resolve(ctx) {
        const primaryType = STAT_DAMAGE_TYPE[statTypeFor(ctx.playerStats)] ?? 'slash';
        let dmg = bossMagic(ctx.self.matk, ctx.player.mdef, 1.15);
        if (statCheck(ctx.playerStats.will, 14, ctx.rng)) dmg = Math.round(dmg * 0.5);
        ctx.applyDamageToPlayer(dmg, primaryType, `${ctx.self.name} — Quoted Choice`);
        ctx.log.push(`${ctx.self.name} quotes one of your own choices back at you for ${dmg} damage.`);
        return '';
      },
    },
    {
      id: 'call_echoes', label: 'Call Echoes', weight: 4000,
      description: 'Summons Echoes of your own major choices.',
      condition: (ctx) => ctx.phaseKey === 'evidence' && !ctx.self.flags.echoesSummoned,
      resolve(ctx) {
        ctx.self.flags.echoesSummoned = 1;
        const candidates: string[] = [];
        if (ctx.playerFlags.ate_venn_bread) candidates.push('echo_of_hunger');
        if (ctx.playerFlags.destroyed_feast) candidates.push('echo_of_emptiness');
        if (ctx.playerFlags.joined_hymn) candidates.push('echo_of_harmony');
        if (ctx.playerFlags.accepted_purification) candidates.push('echo_of_cleanliness');
        if (candidates.length === 0) candidates.push('echo_of_emptiness');
        candidates.slice(0, 2).forEach((id) => ctx.spawnAlly(id, 70));
        ctx.log.push(`${ctx.self.name} calls up Echoes of your own major choices.`);
        return '';
      },
    },
    {
      id: 'weight_of_evidence', label: 'Weight of Evidence', weight: 3,
      description: 'Presses its case with a blunt strike in your own element.',
      condition: (ctx) => ctx.phaseKey === 'evidence' || ctx.phaseKey === 'argument',
      resolve(ctx) {
        const primaryType = STAT_DAMAGE_TYPE[statTypeFor(ctx.playerStats)] ?? 'slash';
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.25);
        ctx.applyDamageToPlayer(dmg, primaryType, `${ctx.self.name} — Weight of Evidence`);
        ctx.log.push(`${ctx.self.name} presses its case for ${dmg} damage.`);
        return '';
      },
    },
    {
      id: 'the_question', label: 'The Question', weight: 3500,
      description: 'Answer wrong: damage and Curse. Answer right: it staggers itself.',
      condition: (ctx) => ctx.phaseKey === 'question' && (ctx.self.flags.questionsAsked ?? 0) < 3,
      resolve(ctx) {
        ctx.self.flags.questionsAsked = (ctx.self.flags.questionsAsked ?? 0) + 1;
        if (statCheck(ctx.playerStats.will, 16, ctx.rng)) {
          ctx.damageSelf(45);
          ctx.log.push(`${ctx.self.name} asks a question you can actually answer. It loses 45 HP, staggered by the answer.`);
        } else {
          const dmg = ctx.applyDamageToPlayer(30, 'shadow', `${ctx.self.name} — a question you cannot answer`);
          ctx.applyStatusToPlayer('curse', 1);
          ctx.log.push(`${ctx.self.name} asks a question you can't answer. It costs you ${dmg} damage.`);
        }
        return '';
      },
    },
    {
      id: 'repeated_question', label: 'Repeated Question', weight: 3,
      description: 'Repeats itself, unsatisfied.',
      condition: (ctx) => ctx.phaseKey === 'question',
      resolve(ctx) {
        const primaryType = STAT_DAMAGE_TYPE[statTypeFor(ctx.playerStats)] ?? 'slash';
        const dmg = bossMagic(ctx.self.matk, ctx.player.mdef, 1.05);
        ctx.applyDamageToPlayer(dmg, primaryType, `${ctx.self.name} — Repeated Question`);
        ctx.log.push(`${ctx.self.name} repeats itself for ${dmg} damage.`);
        return '';
      },
    },
    {
      id: 'identity_erasure', label: 'Identity Erasure', weight: 2200,
      description: 'Cycles through your active slots, disabling one temporarily.',
      condition: (ctx) => (ctx.turn >= 3 && ctx.turn % 5 === 0),
      resolve(ctx) {
        const pool = ctx.playerEquippedSkills;
        if (pool.length === 0) {
          ctx.log.push(`${ctx.self.name} reaches for your skills and finds nothing to erase.`);
          return '';
        }
        const pick = pool[Math.floor(ctx.rng() * pool.length)];
        ctx.self.flags[`disable_${pick}`] = ctx.turn + 2;
        ctx.log.push(`IDENTITY ERASURE — ${pick.replace(/_/g, ' ')} slips out of your memory. (Disabled 2 turns)`);
        return '';
      },
    },
    {
      id: 'hollow_surge_charge', label: 'Hollow Surge', weight: 4000, charge: true,
      description: '<50% HP: charges a true-damage Momentum Finisher.',
      condition: (ctx) => ctx.phaseKey === 'answer' && !ctx.self.flags.surgeUsed,
      resolve(ctx) {
        void ctx;
        return '';
      },
    },
    {
      id: 'hollow_surge', label: 'Hollow Surge', weight: 0,
      description: 'True-damage finisher fueled by everything you gave the Loom.',
      resolve(ctx) {
        ctx.self.flags.surgeUsed = 1;
        const momentumFuel = Math.min(5, ctx.self.flags.playerMomentum ?? 0);
        const dmg = 40 + momentumFuel * 18;
        ctx.applyDamageToPlayer(dmg, 'shadow', `${ctx.self.name} — Hollow Surge`, { bypassGuard: true, guaranteed: true });
        ctx.log.push(`HOLLOW SURGE — ${dmg} true damage. Every word it took from you comes back at once.`);
        return '';
      },
    },
    {
      id: 'final_honest_blow', label: 'Final Honest Blow', weight: 3,
      description: 'A plain, honest strike in your own element.',
      resolve(ctx) {
        const primaryType = STAT_DAMAGE_TYPE[statTypeFor(ctx.playerStats)] ?? 'slash';
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.25);
        ctx.applyDamageToPlayer(dmg, primaryType, `${ctx.self.name} — Final Honest Blow`);
        ctx.log.push(`${ctx.self.name} strikes plainly for ${dmg} damage.`);
        return '';
      },
    },
  ],
  aftermathText: () =>
    "It doesn't dissolve so much as stop insisting on a shape. What's left in the mirrors is just your own reflection again, ordinary, breathing hard, alone in a room full of glass. Somewhere below, or above, or nowhere at all, The Loom has finished asking its question — and is waiting, with what might be patience, for you to answer it yourself.",
  getRewards: () => ({
    resonanceDelta: 10,
    echoShards: 10,
    loreFragment: 'final_reflection',
    flag: 'reflection_defeated',
  }),
};

export const BOSSES: Record<string, BossDef> = {
  sentinel: SENTINEL,
  patriarch: PATRIARCH,
  chorus: CHORUS,
  fossil_king: FOSSIL_KING,
  reflection: REFLECTION,
};

export const BOSS_ORDER = ['sentinel', 'patriarch', 'chorus', 'fossil_king', 'reflection'];

export function bossesForPage(page: number): string | null {
  const match = Object.values(BOSSES).find((b) => b.page === page);
  return match ? match.id : null;
}
