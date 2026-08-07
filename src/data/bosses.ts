import type { BossDef, BossPhaseInfo, BossTurnContext } from './types';
import { statCheck } from '@systems/checks';

export const TOTAL_MAJOR_BOSSES = 5;

function bossDamage(atk: number, def: number, power: number): number {
  return Math.max(3, Math.round((atk - def / 2) * power));
}

function statTypeFor(build: { str: number; dex: number; con: number; int: number; will: number }) {
  const entries: Array<[string, number]> = [
    ['str', build.str], ['dex', build.dex], ['con', build.con], ['int', build.int], ['will', build.will],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

const STAT_DAMAGE_TYPE: Record<string, BossTurnContext['playerLastActionType'] & string> = {
  str: 'slash', dex: 'pierce', con: 'blunt', int: 'shock', will: 'shadow',
} as any;

/** One-time-per-fight opening adjustments shared across a boss's intents. */
function patriarchPrepare(ctx: BossTurnContext): void {
  if (ctx.flags.cassDefWeakened === 1 && !ctx.flags.cassDefWeakenedApplied) {
    ctx.flags.cassDefWeakenedApplied = 1;
    ctx.self.def = Math.round(ctx.self.def * 0.8);
  }
  if (ctx.flags.scriptureDefWeakened === 1 && !ctx.flags.scriptureDefWeakenedApplied) {
    ctx.flags.scriptureDefWeakenedApplied = 1;
    ctx.self.def = Math.round(ctx.self.def * 0.9);
  }
}

// ============================================================================
// BOSS 1 — THE ARGENT SENTINEL (Page 20)
// ============================================================================
export const SENTINEL: BossDef = {
  id: 'sentinel',
  name: 'The Argent Sentinel',
  vennName: 'Keth-Vor, the First Door',
  page: 20,
  theme: 'The danger of curiosity.',
  baseStats: { hp: 130, atk: 16, matk: 12, def: 14, mdef: 12, spd: 14 },
  approachText:
    "It stands where the corridor narrows into a single door of tarnished silver, unmoving until you are three steps away. Then it turns — not fast, not slow, exactly the speed of something that has done this before. Its surface is engraved, edge to edge, with a language that keeps almost resolving into words you know. It does not raise a weapon. It simply waits, the way a locked door waits, to see what you'll try.",
  preCombatChoices: [
    {
      id: 'will_check',
      label: "Try to read its intent. (WILL check, DC 10)",
      apply: (_player, flags, rng) => {
        if (statCheck(_player.stats.will, 10, rng)) {
          flags.sentinelInsight = 1;
          return 'You sense it is testing, not attacking. (Start the fight with +1 Momentum.)';
        }
        return "Its intent stays unreadable. You'll have to find out the hard way.";
      },
    },
  ],
  getPhase(hpPercent: number): BossPhaseInfo {
    if (hpPercent > 90 / 130) {
      return { key: 'curator', label: 'The Curator', hpFloorPercent: 90 / 130, affinities: { shock: 1.5, pierce: 1.2, blunt: 0.5, sacred: 0.8 } };
    }
    if (hpPercent > 40 / 130) {
      return { key: 'erudite', label: 'The Erudite', hpFloorPercent: 40 / 130, affinities: { pierce: 1.2, sacred: 1.5, shock: 0.5 } };
    }
    return { key: 'guardian', label: 'The Desperate Guardian', hpFloorPercent: 0, affinities: { pierce: 1.2, sacred: 1.5, shock: 0.5 } };
  },
  intents: [
    {
      id: 'catalogue', label: 'Catalogue', weight: 999,
      condition: (ctx) => ctx.turn === 1,
      description: 'Studies your stance for a round. Attack +2.',
      resolve(ctx) {
        ctx.self.atk += 2;
        ctx.log.push(`${ctx.self.name} studies your stance — "Catalogue" complete. (+2 Attack)`);
      },
    },
    {
      id: 'reshelves', label: 'Reshelves', weight: 999,
      condition: (ctx) => ctx.phaseKey === 'curator' && ctx.turn % 2 === 0,
      description: 'Heals 15 HP and raises a Barrier (25).',
      resolve(ctx) {
        ctx.healSelf(15);
        ctx.setBarrier(25);
        ctx.log.push(`${ctx.self.name} Reshelves — heals 15 HP and raises a Barrier (25).`);
      },
    },
    {
      id: 'archive_strike', label: 'Archive Strike', weight: 900,
      condition: (ctx) => ctx.phaseKey === 'curator',
      description: 'A crushing blunt archival blow.',
      resolve(ctx) {
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.2);
        ctx.applyDamageToPlayer(dmg, 'blunt', 'Archive Strike');
        ctx.log.push(`${ctx.self.name} lands an Archive Strike for ${dmg} damage.`);
      },
    },
    {
      id: 'cite_source', label: 'Cite Source', weight: 900,
      condition: (ctx) => ctx.phaseKey === 'erudite' && ctx.turn % 2 === 1,
      description: 'Sacred magic that ignores 30% of your Magic Defense.',
      resolve(ctx) {
        const dmg = bossDamage(ctx.self.matk, Math.round(ctx.player.mdef * 0.7), 1.5);
        ctx.applyDamageToPlayer(dmg, 'sacred', 'Cite Source');
        ctx.log.push(`${ctx.self.name} casts Cite Source (ignores 30% Magic Defense) for ${dmg} damage.`);
      },
    },
    {
      id: 'quotation', label: 'Quotation', weight: 900,
      condition: (ctx) => ctx.phaseKey === 'erudite',
      description: 'Echoes your own tactic back at you as sacred damage.',
      resolve(ctx) {
        const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 1.1);
        ctx.applyDamageToPlayer(dmg, 'sacred', 'Quotation');
        ctx.log.push(`${ctx.self.name} uses Quotation, echoing your own tactic for ${dmg} damage.`);
      },
    },
    {
      id: 'desperate_guard', label: 'Desperate Guard', weight: 999,
      condition: (ctx) => ctx.phaseKey === 'guardian',
      description: 'Abandons defense for raw offense; alternating Final Index (heavy, self-damaging) and desperate blows.',
      resolve(ctx) {
        if (!ctx.flags.guardianEntered) {
          ctx.flags.guardianEntered = 1;
          ctx.self.def = Math.max(1, ctx.self.def - 6);
          ctx.self.atk += 4;
          ctx.log.push(`${ctx.self.name} becomes the Desperate Guardian — Defense drops, Attack rises.`);
        }
        if (ctx.turn % 2 === 0) {
          const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.8);
          ctx.damageSelf(10);
          ctx.applyDamageToPlayer(dmg, 'blunt', 'Final Index');
          ctx.log.push(`${ctx.self.name} unleashes Final Index for ${dmg} damage (10 HP recoil).`);
        } else {
          const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.0);
          ctx.applyDamageToPlayer(dmg, 'blunt', 'a desperate blow');
          ctx.log.push(`${ctx.self.name} swings desperately for ${dmg} damage.`);
        }
      },
    },
  ],
  takeTurn(ctx: BossTurnContext) {
    if (ctx.turn === 1) {
      ctx.self.atk += 2;
      ctx.log.push(`${ctx.self.name} studies your stance — "Catalogue" complete. (+2 Attack)`);
      return;
    }
    if (ctx.phaseKey === 'curator') {
      if (ctx.turn % 2 === 0) {
        ctx.healSelf(15);
        ctx.setBarrier(25);
        ctx.log.push(`${ctx.self.name} Reshelves — heals 15 HP and raises a Barrier (25).`);
        return;
      }
      const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.2);
      ctx.applyDamageToPlayer(dmg, 'blunt', 'Archive Strike');
      ctx.log.push(`${ctx.self.name} lands an Archive Strike for ${dmg} damage.`);
      return;
    }
    if (ctx.phaseKey === 'erudite') {
      if (ctx.turn % 2 === 1) {
        const dmg = bossDamage(ctx.self.matk, Math.round(ctx.player.mdef * 0.7), 1.5);
        ctx.applyDamageToPlayer(dmg, 'sacred', 'Cite Source');
        ctx.log.push(`${ctx.self.name} casts Cite Source (ignores 30% Magic Defense) for ${dmg} damage.`);
      } else {
        const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 1.1);
        ctx.applyDamageToPlayer(dmg, 'sacred', 'Quotation');
        ctx.log.push(`${ctx.self.name} uses Quotation, echoing your own tactic for ${dmg} damage.`);
      }
      return;
    }
    if (!ctx.flags.guardianEntered) {
      ctx.flags.guardianEntered = 1;
      ctx.self.def = Math.max(1, ctx.self.def - 6);
      ctx.self.atk += 4;
      ctx.log.push(`${ctx.self.name} becomes the Desperate Guardian — Defense drops, Attack rises.`);
    }
    if (ctx.turn % 2 === 0) {
      const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.8);
      ctx.damageSelf(10);
      ctx.applyDamageToPlayer(dmg, 'blunt', "Final Index");
      ctx.log.push(`${ctx.self.name} unleashes Final Index for ${dmg} damage (10 HP recoil).`);
    } else {
      const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.0);
      ctx.applyDamageToPlayer(dmg, 'blunt', 'a desperate blow');
      ctx.log.push(`${ctx.self.name} swings desperately for ${dmg} damage.`);
    }
  },
  aftermathText: () =>
    'The silver light fades from its engravings all at once, like a held breath finally let go. It does not fall so much as settle, the way a door settles back into its frame. Somewhere underneath the corridor, you feel — rather than hear — something unlock.',
  getRewards: () => ({
    factionDelta: { archive: 20 },
    resonanceDelta: 5,
    echoShards: 5,
    skillUnlock: 'librarians_eye',
    loreFragment: 'sentinels_confession',
    flag: 'sentinel_defeated',
  }),
};

// ============================================================================
// BOSS 2 — PATRIARCH OREN CASS (Page 40)
// ============================================================================
export const PATRIARCH: BossDef = {
  id: 'patriarch',
  name: 'Patriarch Oren Cass',
  vennName: 'The Ash Covenant, Ascendant',
  page: 40,
  theme: 'Faith as anesthetic.',
  baseStats: { hp: 160, atk: 14, matk: 18, def: 16, mdef: 18, spd: 12 },
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
    getPhase(hpPercent) {
    if (hpPercent > 0.3) {
      return { key: 'devout', label: 'The Devout', hpFloorPercent: 0.3, affinities: { shadow: 1.5, pierce: 1.2, sacred: 0.25, flame: 0.5 } };
    }
    return { key: 'martyr', label: 'The Martyr', hpFloorPercent: 0, affinities: { shadow: 1.5, pierce: 1.2, sacred: 0.25, flame: 0.5 } };
  },
  intents: [
    {
      id: 'opening_barrier', label: 'Opening Barrier', weight: 2000,
      condition: (ctx) => ctx.turn === 1,
      description: 'Raises a Barrier (40) and begins to pray.',
      resolve(ctx) {
        patriarchPrepare(ctx);
        ctx.setBarrier(40);
        ctx.log.push(`${ctx.self.name} raises a Barrier (40) and begins to pray.`);
      },
    },
    {
      id: 'recast_barrier', label: 'Recast Barrier', weight: 2000,
      condition: (ctx) => ctx.turn > 1 && ctx.turn % 3 === 1 && ctx.phaseKey === 'devout',
      description: 'Renews his Barrier (40) on every third turn while he is the Devout.',
      resolve(ctx) {
        patriarchPrepare(ctx);
        ctx.setBarrier(40);
        ctx.log.push(`${ctx.self.name} recasts his Barrier (40).`);
      },
    },
    {
      id: 'summon_zealots', label: 'Summon Zealots', weight: 900,
      condition: (ctx) => ctx.self.hp / ctx.self.maxHp < 0.7 && !ctx.flags.summonedZealots,
      description: 'Calls two Sable Zealots to his side.',
      resolve(ctx) {
        patriarchPrepare(ctx);
        ctx.flags.summonedZealots = 1;
        ctx.spawnAlly('sable_zealot', 30);
        ctx.spawnAlly('sable_zealot', 30);
        ctx.log.push(`${ctx.self.name} calls two Sable Zealots to his side.`);
      },
    },
    {
      id: 'healing_prayer_self', label: 'Whisper Healing Prayer', weight: 800,
      condition: (ctx) => ctx.self.hp / ctx.self.maxHp < 0.6 && !ctx.flags.healedOnce,
      description: 'Heals himself for 25 HP the first time he is wounded.',
      resolve(ctx) {
        patriarchPrepare(ctx);
        ctx.flags.healedOnce = 1;
        ctx.healSelf(25);
        ctx.log.push(`${ctx.self.name} whispers a Healing Prayer over himself. (+25 HP)`);
      },
    },
    {
      id: 'summon_inquisitor', label: 'Summon Inquisitor', weight: 800,
      condition: (ctx) => ctx.self.hp / ctx.self.maxHp < 0.4 && !ctx.flags.summonedInquisitor,
      description: 'Calls a Sable Inquisitor when badly hurt.',
      resolve(ctx) {
        patriarchPrepare(ctx);
        ctx.flags.summonedInquisitor = 1;
        ctx.spawnAlly('sable_inquisitor', 45);
        ctx.log.push(`${ctx.self.name} calls a Sable Inquisitor.`);
      },
    },
    {
      id: 'martyr_unleashed', label: 'Martyr\'s Flame', weight: 999,
      condition: (ctx) => ctx.phaseKey === 'martyr',
      description: 'Stops holding back: alternate an unguardedable Martyr\'s Flame (2.0x magic, self-recoil) and Punishing Strike.',
      resolve(ctx) {
        patriarchPrepare(ctx);
        if (!ctx.flags.martyrEntered) {
          ctx.flags.martyrEntered = 1;
          ctx.self.atk = Math.round(ctx.self.atk * 1.3);
          ctx.log.push(`${ctx.self.name} stops holding back. (Attack +30%, he no longer heals)`);
        }
        if (ctx.turn % 2 === 0) {
          const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 2.0);
          ctx.damageSelf(15);
          ctx.applyDamageToPlayer(dmg, 'sacred', "Martyr's Flame", true);
          ctx.log.push(`${ctx.self.name} unleashes Martyr's Flame for ${dmg} damage — it cannot be Guarded (15 HP recoil).`);
        } else {
          const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.5) + Math.round(ctx.playerResonance * 0.3);
          ctx.applyDamageToPlayer(dmg, 'sacred', 'Punishing Strike');
          ctx.log.push(`${ctx.self.name} lands a Punishing Strike for ${dmg} damage.`);
        }
      },
    },
    {
      id: 'dispel_holy', label: 'Dispel Holy', weight: 600,
      condition: (ctx) => ctx.player.statuses.length >= 2,
      description: 'Strips your buffs when you are heavily enhanced.',
      resolve(ctx) {
        patriarchPrepare(ctx);
        ctx.removePlayerBuffs();
        ctx.log.push(`${ctx.self.name} casts Dispel Holy, stripping your buffs.`);
      },
    },
    {
      id: 'punishing_strike', label: 'Punishing Strike', weight: 500,
      description: 'A heavy sacred blow that scales with your Resonance.',
      resolve(ctx) {
        patriarchPrepare(ctx);
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.5) + Math.round(ctx.playerResonance * 0.3);
        ctx.applyDamageToPlayer(dmg, 'sacred', 'Punishing Strike');
        ctx.log.push(`${ctx.self.name} lands a Punishing Strike for ${dmg} damage.`);
      },
    },
  ],
  takeTurn(ctx) {
    if (ctx.flags.cassDefWeakened === 1 && !ctx.flags.cassDefWeakenedApplied) {
      ctx.flags.cassDefWeakenedApplied = 1;
      ctx.self.def = Math.round(ctx.self.def * 0.8);
    }
    if (ctx.flags.scriptureDefWeakened === 1 && !ctx.flags.scriptureDefWeakenedApplied) {
      ctx.flags.scriptureDefWeakenedApplied = 1;
      ctx.self.def = Math.round(ctx.self.def * 0.9);
    }
    if (ctx.turn === 1) {
      ctx.setBarrier(40);
      ctx.log.push(`${ctx.self.name} raises a Barrier (40) and begins to pray.`);
      return;
    }
    if (ctx.turn % 3 === 1 && ctx.phaseKey === 'devout') {
      ctx.setBarrier(40);
      ctx.log.push(`${ctx.self.name} recasts his Barrier (40).`);
      return;
    }
    if (ctx.phaseKey === 'martyr') {
      if (!ctx.flags.martyrEntered) {
        ctx.flags.martyrEntered = 1;
        ctx.self.atk = Math.round(ctx.self.atk * 1.3);
        ctx.log.push(`${ctx.self.name} stops holding back. (Attack +30%, he no longer heals)`);
      }
      if (ctx.turn % 2 === 0) {
        const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 2.0);
        ctx.damageSelf(15);
        ctx.applyDamageToPlayer(dmg, 'sacred', "Martyr's Flame", true);
        ctx.log.push(`${ctx.self.name} unleashes Martyr's Flame for ${dmg} damage — it cannot be Guarded (15 HP recoil).`);
        return;
      }
      const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.5) + Math.round(ctx.playerResonance * 0.3);
      ctx.applyDamageToPlayer(dmg, 'sacred', 'Punishing Strike');
      ctx.log.push(`${ctx.self.name} lands a Punishing Strike for ${dmg} damage.`);
      return;
    }
    if (ctx.self.hp / ctx.self.maxHp < 0.7 && !ctx.flags.summonedZealots) {
      ctx.flags.summonedZealots = 1;
      ctx.spawnAlly('sable_zealot', 30);
      ctx.spawnAlly('sable_zealot', 30);
      ctx.log.push(`${ctx.self.name} calls two Sable Zealots to his side.`);
      return;
    }
    if (ctx.self.hp / ctx.self.maxHp < 0.4 && !ctx.flags.summonedInquisitor) {
      ctx.flags.summonedInquisitor = 1;
      ctx.spawnAlly('sable_inquisitor', 45);
      ctx.log.push(`${ctx.self.name} calls a Sable Inquisitor.`);
      return;
    }
    if (ctx.self.hp / ctx.self.maxHp < 0.6 && !ctx.flags.healedOnce) {
      ctx.flags.healedOnce = 1;
      ctx.healSelf(25);
      ctx.log.push(`${ctx.self.name} whispers a Healing Prayer over himself. (+25 HP)`);
      return;
    }
    if (ctx.player.statuses.length >= 2) {
      ctx.removePlayerBuffs();
      ctx.log.push(`${ctx.self.name} casts Dispel Holy, stripping your buffs.`);
      return;
    }
    const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.5) + Math.round(ctx.playerResonance * 0.3);
    ctx.applyDamageToPlayer(dmg, 'sacred', 'Punishing Strike');
    ctx.log.push(`${ctx.self.name} lands a Punishing Strike for ${dmg} damage.`);
  },
  aftermathText: (flags) =>
    flags.cassDefWeakened === 1
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
// BOSS 3 — THE MERGED CHORUS (Page 60)
// ============================================================================
const DAMAGE_TYPE_CYCLE = ['slash', 'pierce', 'blunt', 'flame', 'frost', 'shock', 'sacred', 'shadow'] as const;

/** Chorus re-rolls its shared weakness every turn (after the challenge debuff is applied once). */
function chorusPrepare(ctx: BossTurnContext): void {
  if (ctx.flags.chorusChallenge === 1 && ctx.turn <= 3 && !ctx.flags.chorusChallengeApplied) {
    ctx.flags.chorusChallengeApplied = 1;
    ctx.self.def = Math.round(ctx.self.def * 0.8);
  }
  const weakIdx = Math.floor(ctx.rng() * 8);
  const weakType = DAMAGE_TYPE_CYCLE[weakIdx];
  ctx.self.affinities = Object.fromEntries(DAMAGE_TYPE_CYCLE.map((t) => [t, t === weakType ? 1.5 : 0.5])) as any;
  ctx.log.push(`${ctx.self.name}'s voices realign — this round, it is weak to ${weakType}.`);
}

/** Fossil King: remembers a Barrier you earned pre-combat before the first round's actions. */
function fossilPrepare(ctx: BossTurnContext): void {
  if (ctx.turn === 1 && ctx.flags.fossilBarrier === 1) {
    ctx.log.push('A quiet Barrier lingers around you from before the fight began.');
  }
}

export const CHORUS: BossDef = {
  id: 'chorus',
  name: 'The Merged Chorus',
  vennName: 'The Loom, Speaking With Borrowed Mouths',
  page: 60,
  theme: 'The self as a chosen fiction.',
  baseStats: { hp: 200, atk: 16, matk: 20, def: 12, mdef: 16, spd: 15 },
  approachText:
    "It used to be several people. You can still see the seams — a hand that doesn't match the shoulder, a voice that changes mid-word into someone else's cadence. When it speaks, it speaks in chorus, every syllable a small argument about who gets to say it. 'We volunteered,' it tells you, all at once. 'That's the part everyone forgets to ask.'",
  preCombatChoices: [
    {
      id: 'insight',
      label: 'Sense whether this is a fight you can win through attrition. (WILL check, DC 12)',
      apply: (_p, flags, rng) => {
        if (statCheck(_p.stats.will, 12, rng)) {
          flags.chorusInsight = 1;
          return "You realize you can't win this through attrition alone. (flag: chorus_insight)";
        }
        return "You can't tell, one way or the other.";
      },
    },
    {
      id: 'challenge',
      label: 'Challenge their sacrifice.',
      apply: (_p, flags) => {
        flags.chorusChallenge = 1;
        return 'The Chorus flinches — actually flinches — and loses its footing for a moment. (Its Defense -20% for 2 rounds, it wastes its first turn)';
      },
    },
    {
      id: 'appeal',
      label: 'Appeal to scholarly pride.',
      apply: (_p, flags) => {
        flags.chorusAppeal = 1;
        return 'It cannot resist correcting your assumption, and loses a turn doing it. (You gain +25% Magic Damage for 3 rounds)';
      },
    },
    {
      id: 'offer',
      label: 'Offer yourself instead. (Resonance ≥ 30)',
      requirement: (p) => p.resonance >= 30,
      apply: (_p, flags) => {
        flags.chorusOffer = 1;
        return 'Something in the chorus goes quiet, considering you. It wastes its first turn deciding not to accept — yet.';
      },
    },
    {
      id: 'attack',
      label: 'Attack without words.',
      apply: () => 'You waste no time on words. The Chorus responds in kind.',
    },
  ],
  getPhase(hpPercent) {
    return { key: 'chorus', label: 'Many Voices', hpFloorPercent: 0, affinities: {} };
  },
  intents: [
    {
      id: 'internal_argument', label: 'Internal Argument', weight: 2000,
      condition: (ctx) => ctx.turn === 1 && (ctx.flags.chorusChallenge === 1 || ctx.flags.chorusAppeal === 1 || ctx.flags.chorusOffer === 1),
      description: 'Its own voices argue about resisting you — it wastes the turn.',
      resolve(ctx) {
        ctx.log.push(`${ctx.self.name} hesitates, its voices arguing amongst themselves.`);
      },
    },
    {
      id: 'hallucination', label: 'Many-Voiced Hallucination', weight: 999,
      condition: (ctx) => ctx.turn % 3 === 0,
      description: 'Total sensory accretion: Confuse (2 turns).',
      resolve(ctx) {
        chorusPrepare(ctx);
        ctx.applyStatusToPlayer('confuse', 2);
        ctx.log.push(`${ctx.self.name} makes you Hallucinate (Confuse, 2 turns).`);
      },
    },
    {
      id: 'harmonic_overload', label: 'Harmonic Overload', weight: 950,
      condition: (ctx) => ctx.playerRepeatedLastAction === true,
      description: 'Punishes repetition — 2.0x magic damage of the type you just used.',
      resolve(ctx) {
        chorusPrepare(ctx);
        const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 2.0);
        ctx.applyDamageToPlayer(dmg, ctx.playerLastActionType ?? 'shadow', 'Harmonic Overload');
        ctx.log.push(`${ctx.self.name} punishes your repetition with Harmonic Overload for ${dmg} damage.`);
      },
    },
    {
      id: 'copy_memory', label: 'Copy Memory', weight: 900,
      condition: (ctx) => !!ctx.playerLastActionType && ctx.turn % 2 === 0,
      description: "Copies your last move back at you every other turn, same damage type.",
      resolve(ctx) {
        chorusPrepare(ctx);
        const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 1.2);
        ctx.applyDamageToPlayer(dmg, ctx.playerLastActionType!, 'Copy Memory');
        ctx.log.push(`${ctx.self.name} copies your own last move for ${dmg} damage.`);
      },
    },
    {
      id: 'many_voiced_strike', label: 'Many-Voiced Strike', weight: 800,
      description: 'A random-typed melee strike from the crowd of voices.',
      resolve(ctx) {
        chorusPrepare(ctx);
        const attackType = DAMAGE_TYPE_CYCLE[Math.floor(ctx.rng() * 8)];
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.4);
        ctx.applyDamageToPlayer(dmg, attackType, 'Many-Voiced Strike');
        ctx.log.push(`${ctx.self.name} lands a Many-Voiced Strike (${attackType}) for ${dmg} damage.`);
      },
    },
  ],
  takeTurn(ctx) {
    if (ctx.turn === 1 && (ctx.flags.chorusChallenge === 1 || ctx.flags.chorusAppeal === 1 || ctx.flags.chorusOffer === 1)) {
      ctx.log.push(`${ctx.self.name} hesitates, its voices arguing amongst themselves.`);
      return;
    }
    if (ctx.flags.chorusChallenge === 1 && ctx.turn <= 3 && !ctx.flags.chorusChallengeApplied) {
      ctx.flags.chorusChallengeApplied = 1;
      ctx.self.def = Math.round(ctx.self.def * 0.8);
    }
    // Roll this round's shared weakness (1d8)
    const weakIdx = Math.floor(ctx.rng() * 8);
    const weakType = DAMAGE_TYPE_CYCLE[weakIdx];
    ctx.self.affinities = Object.fromEntries(DAMAGE_TYPE_CYCLE.map((t) => [t, t === weakType ? 1.5 : 0.5])) as any;
    ctx.log.push(`${ctx.self.name}'s voices realign — this round, it is weak to ${weakType}.`);

    if (ctx.turn % 3 === 0) {
      ctx.applyStatusToPlayer('confuse', 2);
      ctx.log.push(`${ctx.self.name} makes you Hallucinate (Confuse, 2 turns).`);
      return;
    }
    if (ctx.playerRepeatedLastAction) {
      const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 2.0);
      ctx.applyDamageToPlayer(dmg, ctx.playerLastActionType ?? 'shadow', 'Harmonic Overload');
      ctx.log.push(`${ctx.self.name} punishes your repetition with Harmonic Overload for ${dmg} damage.`);
      return;
    }
    if (ctx.playerLastActionType && ctx.turn % 2 === 0) {
      const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 1.2);
      ctx.applyDamageToPlayer(dmg, ctx.playerLastActionType, 'Copy Memory');
      ctx.log.push(`${ctx.self.name} copies your own last move for ${dmg} damage.`);
      return;
    }
    const attackType = DAMAGE_TYPE_CYCLE[Math.floor(ctx.rng() * 8)];
    const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.4);
    ctx.applyDamageToPlayer(dmg, attackType, 'Many-Voiced Strike');
    ctx.log.push(`${ctx.self.name} lands a Many-Voiced Strike (${attackType}) for ${dmg} damage.`);
  },
  aftermathText: (flags) => {
    if (flags.chorusOffer === 1) {
      return 'The voices do not scatter so much as settle — into you, a little. Something that was several people looks at you with what might be gratitude, and stops being anything at all. You feel heavier, and more crowded, in a way that isn\'t entirely unwelcome.';
    }
    if (flags.chorusAppeal === 1) {
      return "They argue themselves apart mid-collapse, still correcting each other's citations on the way down. It might be the most scholarly death you've ever witnessed.";
    }
    if (flags.chorusChallenge === 1) {
      return 'The Chorus fragments the moment you name what was done to it. Whatever held all those voices together simply stops bothering, and they go their separate, quiet ways.';
    }
    return 'The seams finally give. What was several people separates back into something more like silence, and less like anyone. You are fairly sure, standing there, that you heard it thank you — though you couldn\'t say in which voice.';
  },
  getRewards: (flags) => {
    if (flags.chorusOffer === 1) {
      return {
        resonanceDelta: 15,
        maxHpPercentDelta: -20,
        echoShards: 5,
        skillUnlock: 'chorus_echo',
        loreFragment: 'chorus_you_are_willing',
        flag: 'chorus_offered_self',
      };
    }
    if (flags.chorusAppeal === 1) {
      return {
        factionDelta: { archive: 15 },
        resonanceDelta: 5,
        echoShards: 5,
        skillUnlock: 'archival_insight',
        loreFragment: 'chorus_the_choirs_tragedy_scholarly',
        flag: 'chorus_defeated_appeal',
      };
    }
    if (flags.chorusChallenge === 1) {
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
// BOSS 4 — THE FOSSIL KING (Page 80)
// ============================================================================
export const FOSSIL_KING: BossDef = {
  id: 'fossil_king',
  name: 'The Fossil King',
  vennName: 'Dominion, Last of Its Court',
  page: 80,
  theme: 'Power that outlived its purpose.',
  baseStats: { hp: 250, atk: 18, matk: 22, def: 18, mdef: 20, spd: 10 },
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
        return 'He laughs — stone grinding on stone. "I can certainly try." (His HP is reduced 10% before the fight, provoked into carelessness)';
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
        return "He nods, almost approving. Something about the silence between you settles into a Barrier around you before the fight even starts.";
      },
    },
  ],
  getPhase(hpPercent) {
    if (hpPercent > 0.76) return { key: 'decree', label: 'Regal Decree', hpFloorPercent: 0.76, affinities: { blunt: 1.5, pierce: 0.5 } };
    if (hpPercent > 0.52) return { key: 'rebellion', label: 'The Rebellion', hpFloorPercent: 0.52, affinities: { shock: 1.5, blunt: 0.5 } };
    if (hpPercent > 0.28) return { key: 'silence', label: 'The Silence', hpFloorPercent: 0.28, affinities: { sacred: 1.5, shadow: 0.5 } };
    return { key: 'fossil', label: 'The Fossil', hpFloorPercent: 0, affinities: { slash: 1.5, pierce: 1.5, blunt: 1.5, flame: 1.5, frost: 1.5, shock: 1.5, sacred: 1.5, shadow: 1.5 } };
  },
  intents: [
    {
      id: 'imperial_edict', label: 'Imperial Edict', weight: 999,
      condition: (ctx) => ctx.phaseKey === 'decree' && !ctx.flags.edictUsed,
      description: 'Attack and Defense +20% once, early in the fight.',
      resolve(ctx) {
        fossilPrepare(ctx);
        ctx.flags.edictUsed = 1;
        ctx.buffSelf('atk', 20);
        ctx.buffSelf('def', 20);
        ctx.log.push(`${ctx.self.name} issues an Imperial Edict — Attack and Defense +20%.`);
      },
    },
    {
      id: 'summon_court', label: 'Summon the Court', weight: 999,
      condition: (ctx) => ctx.phaseKey === 'decree' && ctx.flags.edictUsed === 1 && !ctx.flags.courtSummoned,
      description: 'Two Dominion Echo-Soldiers rise to fight for him.',
      resolve(ctx) {
        fossilPrepare(ctx);
        ctx.flags.courtSummoned = 1;
        ctx.spawnAlly('echo_soldier', 40);
        ctx.spawnAlly('echo_soldier', 40);
        ctx.log.push(`${ctx.self.name} summons the Court — two Dominion Echo-Soldiers.`);
      },
    },
    {
      id: 'tax_of_flesh', label: 'Tax of Flesh', weight: 900,
      condition: (ctx) => ctx.phaseKey === 'decree' && ctx.turn % 3 === 0,
      description: 'Drains 10% of your HP and heals himself for the same.',
      resolve(ctx) {
        fossilPrepare(ctx);
        const drain = Math.round(ctx.player.hp * 0.1);
        ctx.applyDamageToPlayer(drain, 'shadow', 'Tax of Flesh');
        ctx.healSelf(drain);
        ctx.log.push(`${ctx.self.name} levies a Tax of Flesh — ${drain} damage, drained to heal himself.`);
      },
    },
    {
      id: 'decree_strike', label: 'Decree Enforced by Force', weight: 800,
      condition: (ctx) => ctx.phaseKey === 'decree',
      description: 'A heavy blunt decree while he still rules.',
      resolve(ctx) {
        fossilPrepare(ctx);
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.1);
        ctx.applyDamageToPlayer(dmg, 'blunt', 'a decree enforced by force');
        ctx.log.push(`${ctx.self.name} strikes for ${dmg} damage.`);
      },
    },
    {
      id: 'civil_war', label: 'Civil War', weight: 999,
      condition: (ctx) => ctx.phaseKey === 'rebellion' && !ctx.flags.civilWarTriggered,
      description: 'His own court turns on itself — shock damage reaches you too.',
      resolve(ctx) {
        fossilPrepare(ctx);
        ctx.flags.civilWarTriggered = 1;
        const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 1.3);
        ctx.applyDamageToPlayer(dmg, 'shock', 'Civil War');
        ctx.log.push(`${ctx.self.name}'s own court turns on itself — Civil War tears through, ${dmg} damage reaches you too.`);
      },
    },
    {
      id: 'rebellion_lash', label: 'Rebellion Lash', weight: 900,
      condition: (ctx) => ctx.phaseKey === 'rebellion',
      description: 'A shattering shock blow while he still nominally wins.',
      resolve(ctx) {
        fossilPrepare(ctx);
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.15);
        ctx.applyDamageToPlayer(dmg, 'shock', "a rebellion he's still nominally winning");
        ctx.log.push(`${ctx.self.name} lashes out for ${dmg} damage.`);
      },
    },
    {
      id: 'grow_quiet', label: 'Grow Quiet', weight: 999,
      condition: (ctx) => ctx.phaseKey === 'silence' && !ctx.flags.silenceEntered,
      description: 'Casts a veil of quiet: Speed and Defense fall, and the Echo Court rises.',
      resolve(ctx) {
        fossilPrepare(ctx);
        ctx.flags.silenceEntered = 1;
        ctx.self.spd = Math.max(4, Math.round(ctx.self.spd * 0.6));
        ctx.self.def = Math.max(1, Math.round(ctx.self.def * 0.67));
        ctx.log.push(`${ctx.self.name} grows quiet — Speed and Defense fall.`);
        if (!ctx.flags.echoCourtSummoned) {
          ctx.flags.echoCourtSummoned = 1;
          ctx.spawnAlly('memory_wraith', 35);
          ctx.spawnAlly('memory_wraith', 35);
          ctx.log.push(`${ctx.self.name} summons an Echo of the Court — Memory Wraiths rise.`);
          return;
        }
      },
    },
    {
      id: 'last_law', label: 'The Last Law', weight: 900,
      condition: (ctx) => ctx.phaseKey === 'silence' && ctx.flags.silenceEntered === 1,
      description: 'Lawful sacred damage; you cannot repeat a skill next turn.',
      resolve(ctx) {
        fossilPrepare(ctx);
        ctx.flags.fossilLastLaw = 1;
        const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 1.2);
        ctx.applyDamageToPlayer(dmg, 'sacred', 'the Last Law');
        ctx.log.push(`${ctx.self.name} invokes the Last Law — ${dmg} damage, you cannot repeat a skill on your next turn.`);
      },
    },
    {
      id: 'silence_that_followed', label: 'The Silence That Followed', weight: 999,
      condition: (ctx) => ctx.phaseKey === 'fossil' && ctx.flags.ultimateCharging === 1,
      description: 'Releases the charged ultimate — unGuardable 2.5x sacred damage.',
      resolve(ctx) {
        fossilPrepare(ctx);
        ctx.flags.ultimateCharging = 0;
        const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 2.5);
        ctx.applyDamageToPlayer(dmg, 'sacred', 'The Silence That Followed', true);
        ctx.log.push(`${ctx.self.name} releases The Silence That Followed for ${dmg} damage — it cannot be Guarded.`);
      },
    },
    {
      id: 'charge_ultimate', label: 'Utter Stillness', weight: 900,
      condition: (ctx) => ctx.phaseKey === 'fossil' && ctx.flags.ultimateCharging !== 1 && ctx.turn % 4 === 0,
      description: 'Goes utterly still, charging something vast.',
      resolve(ctx) {
        fossilPrepare(ctx);
        ctx.flags.ultimateCharging = 1;
        ctx.log.push(`${ctx.self.name} goes utterly still. Something vast is charging.`);
      },
    },
    {
      id: 'last_unfocused_blow', label: 'Last Unfocused Blow', weight: 700,
      description: 'A weak, unfocused slash from a king past caring.',
      resolve(ctx) {
        fossilPrepare(ctx);
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.0);
        ctx.applyDamageToPlayer(dmg, 'slash', 'a last, unfocused blow');
        ctx.log.push(`${ctx.self.name} strikes weakly for ${dmg} damage.`);
      },
    },
  ],
  takeTurn(ctx) {
    if (ctx.turn === 1 && ctx.flags.fossilBarrier === 1) {
      ctx.log.push('A quiet Barrier lingers around you from before the fight began.');
    }
    if (ctx.phaseKey === 'decree') {
      if (!ctx.flags.edictUsed) {
        ctx.flags.edictUsed = 1;
        ctx.buffSelf('atk', 20);
        ctx.buffSelf('def', 20);
        ctx.log.push(`${ctx.self.name} issues an Imperial Edict — Attack and Defense +20%.`);
        return;
      }
      if (!ctx.flags.courtSummoned) {
        ctx.flags.courtSummoned = 1;
        ctx.spawnAlly('echo_soldier', 40);
        ctx.spawnAlly('echo_soldier', 40);
        ctx.log.push(`${ctx.self.name} summons the Court — two Dominion Echo-Soldiers.`);
        return;
      }
      if (ctx.turn % 3 === 0) {
        const drain = Math.round(ctx.player.hp * 0.1);
        ctx.applyDamageToPlayer(drain, 'shadow', 'Tax of Flesh');
        ctx.healSelf(drain);
        ctx.log.push(`${ctx.self.name} levies a Tax of Flesh — ${drain} damage, drained to heal himself.`);
        return;
      }
      const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.1);
      ctx.applyDamageToPlayer(dmg, 'blunt', 'a decree enforced by force');
      ctx.log.push(`${ctx.self.name} strikes for ${dmg} damage.`);
      return;
    }
    if (ctx.phaseKey === 'rebellion') {
      if (!ctx.flags.civilWarTriggered) {
        ctx.flags.civilWarTriggered = 1;
        const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 1.3);
        ctx.applyDamageToPlayer(dmg, 'shock', 'Civil War');
        ctx.log.push(`${ctx.self.name}'s own court turns on itself — Civil War tears through, ${dmg} damage reaches you too.`);
        return;
      }
      const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.15);
      ctx.applyDamageToPlayer(dmg, 'shock', "a rebellion he's still nominally winning");
      ctx.log.push(`${ctx.self.name} lashes out for ${dmg} damage.`);
      return;
    }
    if (ctx.phaseKey === 'silence') {
      if (!ctx.flags.silenceEntered) {
        ctx.flags.silenceEntered = 1;
        ctx.self.spd = Math.max(4, Math.round(ctx.self.spd * 0.6));
        ctx.self.def = Math.max(1, Math.round(ctx.self.def * 0.67));
        ctx.log.push(`${ctx.self.name} grows quiet — Speed and Defense fall.`);
      }
      if (!ctx.flags.echoCourtSummoned) {
        ctx.flags.echoCourtSummoned = 1;
        ctx.spawnAlly('memory_wraith', 35);
        ctx.spawnAlly('memory_wraith', 35);
        ctx.log.push(`${ctx.self.name} summons an Echo of the Court — Memory Wraiths rise.`);
        return;
      }
      ctx.flags.fossilLastLaw = 1;
      const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 1.2);
      ctx.applyDamageToPlayer(dmg, 'sacred', 'the Last Law');
      ctx.log.push(`${ctx.self.name} invokes the Last Law — ${dmg} damage, you cannot repeat a skill on your next turn.`);
      return;
    }
    // fossil phase
    if (ctx.flags.ultimateCharging === 1) {
      ctx.flags.ultimateCharging = 0;
      const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 2.5);
      ctx.applyDamageToPlayer(dmg, 'sacred', 'The Silence That Followed', true);
      ctx.log.push(`${ctx.self.name} releases The Silence That Followed for ${dmg} damage — it cannot be Guarded.`);
      return;
    }
    if (ctx.turn % 4 === 0) {
      ctx.flags.ultimateCharging = 1;
      ctx.log.push(`${ctx.self.name} goes utterly still. Something vast is charging.`);
      return;
    }
    const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.0);
    ctx.applyDamageToPlayer(dmg, 'slash', 'a last, unfocused blow');
    ctx.log.push(`${ctx.self.name} strikes weakly for ${dmg} damage.`);
  },
  aftermathText: (flags) =>
    flags.ultimateCharging === 1
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

// ============================================================================
// BOSS 5 — THE FINAL REFLECTION (Page 100)
// ============================================================================
export const REFLECTION: BossDef = {
  id: 'reflection',
  name: 'The Final Reflection',
  vennName: 'The Loom, Wearing You',
  page: 100,
  theme: 'You were the mystery all along.',
  baseStats: { hp: 280, atk: 20, matk: 20, def: 15, mdef: 15, spd: 18 },
  approachText:
    "The last chamber is mirrors, floor to ceiling, and every one of them is you — not flattering, not distorted, just accurate in a way that's somehow worse. When it finally steps out of the glass, it isn't wearing your face so much as your posture, your specific way of being afraid. 'You made choices,' it says, in your own voice, pitched slightly wrong. 'I'd like to show you what they were for.'",
  getPhase(hpPercent) {
    if (hpPercent > 200 / 280) return { key: 'argument', label: 'The Argument', hpFloorPercent: 200 / 280, affinities: {} };
    if (hpPercent > 110 / 280) return { key: 'evidence', label: 'The Evidence', hpFloorPercent: 110 / 280, affinities: {} };
    if (hpPercent > 40 / 280) return { key: 'question', label: 'The Question', hpFloorPercent: 40 / 280, affinities: {} };
    return { key: 'answer', label: 'The Answer', hpFloorPercent: 0, affinities: {} };
  },
  intents: [
    {
      id: 'mirror_you', label: 'Mirror You', weight: 999,
      condition: (ctx) => ctx.turn === 1,
      description: 'Wears your build: mirrors your dominant stat and notes your favoured faction.',
      resolve(ctx) {
        const primary = statTypeFor(ctx.playerBuild);
        ctx.flags.primaryDmgType = DAMAGE_TYPE_CYCLE.indexOf(STAT_DAMAGE_TYPE[primary] as any);
        if (primary === 'str') { ctx.buffSelf('atk', 25); ctx.log.push(`${ctx.self.name} mirrors your strength. (Attack +25%)`); }
        else if (primary === 'int') { ctx.buffSelf('matk', 25); ctx.log.push(`${ctx.self.name} mirrors your intellect. (Magic Attack +25%)`); }
        else if (primary === 'dex') { ctx.buffSelf('spd', 25); ctx.log.push(`${ctx.self.name} mirrors your speed. (Speed +25%)`); }
        else if (primary === 'con') { ctx.self.maxHp = Math.round(ctx.self.maxHp * 1.15); ctx.self.hp = ctx.self.maxHp; ctx.log.push(`${ctx.self.name} mirrors your endurance. (Max HP +15%)`); }
        else { ctx.buffSelf('mdef', 20); ctx.log.push(`${ctx.self.name} mirrors your will. (Magic Defense +20%)`); }

        const factions = ctx.playerFaction;
        const topFaction = (Object.keys(factions) as Array<keyof typeof factions>).sort((a, b) => factions[b] - factions[a])[0];
        ctx.flags.topFactionIsCovenant = topFaction === 'covenant' ? 1 : 0;
      },
    },
    {
      id: 'quoted_choice', label: 'Quoted Choice', weight: 900,
      condition: (ctx) => ctx.phaseKey === 'argument',
      description: 'Throws one of your own choices back at you (halved if your Will beats 14).',
      resolve(ctx) {
        const primaryType = DAMAGE_TYPE_CYCLE[ctx.flags.primaryDmgType ?? 0];
        const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 1.1);
        const finalDmg = statCheck(ctx.playerBuild.will, 14, ctx.rng) ? Math.round(dmg * 0.5) : dmg;
        ctx.applyDamageToPlayer(finalDmg, primaryType, 'a quoted choice, thrown back at you');
        ctx.log.push(`${ctx.self.name} quotes one of your own choices back at you for ${finalDmg} damage.`);
      },
    },
    {
      id: 'call_echoes', label: 'Call Echoes', weight: 999,
      condition: (ctx) => ctx.phaseKey === 'evidence' && !ctx.flags.echoesSummoned,
      description: 'Summons Echoes of your own major choices to the field.',
      resolve(ctx) {
        ctx.flags.echoesSummoned = 1;
        const candidates: string[] = [];
        if (ctx.playerHistory.has('ate_venn_bread')) candidates.push('echo_of_hunger');
        if (ctx.playerHistory.has('destroyed_feast')) candidates.push('echo_of_emptiness');
        if (ctx.playerHistory.has('joined_hymn')) candidates.push('echo_of_harmony');
        if (ctx.playerHistory.has('accepted_purification')) candidates.push('echo_of_cleanliness');
        if (candidates.length === 0) candidates.push('echo_of_emptiness');
        candidates.slice(0, 2).forEach((id) => ctx.spawnAlly(id, 60));
        ctx.log.push(`${ctx.self.name} calls up Echoes of your own major choices.`);
      },
    },
    {
      id: 'weight_of_evidence', label: 'Weight of Evidence', weight: 900,
      condition: (ctx) => ctx.phaseKey === 'evidence',
      description: 'Presses its case with a blunt strike in your own element.',
      resolve(ctx) {
        const primaryType = DAMAGE_TYPE_CYCLE[ctx.flags.primaryDmgType ?? 0];
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.2);
        ctx.applyDamageToPlayer(dmg, primaryType, 'the weight of evidence');
        ctx.log.push(`${ctx.self.name} presses its case for ${dmg} damage.`);
      },
    },
    {
      id: 'the_question', label: 'The Question', weight: 999,
      condition: (ctx) => ctx.phaseKey === 'question' && (ctx.flags.questionsAsked ?? 0) < 3,
      description: 'Asks a question. Answer wrong: 25 shadow damage and a Curse. Answer right (Will 16): it staggers itself for 40 HP.',
      resolve(ctx) {
        const asked = ctx.flags.questionsAsked ?? 0;
        ctx.flags.questionsAsked = asked + 1;
        if (statCheck(ctx.playerBuild.will, 16, ctx.rng)) {
          ctx.damageSelf(40);
          ctx.log.push(`${ctx.self.name} asks a question you can actually answer. It loses 40 HP, staggered.`);
        } else {
          const dmg = ctx.applyDamageToPlayer(25, 'shadow', 'a question you cannot answer');
          ctx.applyStatusToPlayer('curse', 1);
          ctx.log.push(`${ctx.self.name} asks a question you can't answer. It costs you ${dmg} damage.`);
        }
      },
    },
    {
      id: 'repeated_question', label: 'Repeated Question', weight: 900,
      condition: (ctx) => ctx.phaseKey === 'question',
      description: 'Repeats itself, unsatisfied.',
      resolve(ctx) {
        const primaryType = DAMAGE_TYPE_CYCLE[ctx.flags.primaryDmgType ?? 0];
        const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 1.0);
        ctx.applyDamageToPlayer(dmg, primaryType, 'a repeated question');
        ctx.log.push(`${ctx.self.name} repeats itself for ${dmg} damage.`);
      },
    },
    {
      id: 'the_story_you_told', label: 'The Story You Told', weight: 999,
      condition: (ctx) => ctx.phaseKey === 'answer' && ctx.flags.ultimateCharging === 1,
      description: 'Finishes the story: 2.5x magic damage, ignoring 50% Magic Defense.',
      resolve(ctx) {
        const primaryType = DAMAGE_TYPE_CYCLE[ctx.flags.primaryDmgType ?? 0];
        ctx.flags.ultimateCharging = 0;
        const dmg = bossDamage(ctx.self.matk, Math.round(ctx.player.mdef * 0.5), 2.5);
        ctx.applyDamageToPlayer(dmg, primaryType, 'The Story You Told');
        ctx.log.push(`${ctx.self.name} finishes The Story You Told for ${dmg} damage (ignores 50% Magic Defense).`);
      },
    },
    {
      id: 'gather_everything', label: 'Gather Everything', weight: 900,
      condition: (ctx) => ctx.phaseKey === 'answer' && ctx.flags.ultimateCharging !== 1 && ctx.turn % 3 === 0,
      description: 'Goes still, gathering everything you told it about yourself.',
      resolve(ctx) {
        ctx.flags.ultimateCharging = 1;
        ctx.log.push(`${ctx.self.name} goes still, gathering everything you've told it about yourself.`);
      },
    },
    {
      id: 'honest_blow', label: 'Final Honest Blow', weight: 800,
      condition: (ctx) => ctx.phaseKey === 'answer',
      description: 'A plain, honest strike in your own element.',
      resolve(ctx) {
        const primaryType = DAMAGE_TYPE_CYCLE[ctx.flags.primaryDmgType ?? 0];
        const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.2);
        ctx.applyDamageToPlayer(dmg, primaryType, 'a final, honest blow');
        ctx.log.push(`${ctx.self.name} strikes plainly for ${dmg} damage.`);
      },
    },
  ],
  takeTurn(ctx) {
    if (ctx.turn === 1) {
      const primary = statTypeFor(ctx.playerBuild);
      ctx.flags.primaryDmgType = DAMAGE_TYPE_CYCLE.indexOf(STAT_DAMAGE_TYPE[primary] as any);
      if (primary === 'str') { ctx.buffSelf('atk', 25); ctx.log.push(`${ctx.self.name} mirrors your strength. (Attack +25%)`); }
      else if (primary === 'int') { ctx.buffSelf('matk', 25); ctx.log.push(`${ctx.self.name} mirrors your intellect. (Magic Attack +25%)`); }
      else if (primary === 'dex') { ctx.buffSelf('spd', 25); ctx.log.push(`${ctx.self.name} mirrors your speed. (Speed +25%)`); }
      else if (primary === 'con') { ctx.self.maxHp = Math.round(ctx.self.maxHp * 1.15); ctx.self.hp = ctx.self.maxHp; ctx.log.push(`${ctx.self.name} mirrors your endurance. (Max HP +15%)`); }
      else { ctx.buffSelf('mdef', 20); ctx.log.push(`${ctx.self.name} mirrors your will. (Magic Defense +20%)`); }

      const factions = ctx.playerFaction;
      const topFaction = (Object.keys(factions) as Array<keyof typeof factions>).sort((a, b) => factions[b] - factions[a])[0];
      ctx.flags.topFactionIsCovenant = topFaction === 'covenant' ? 1 : 0;
      return;
    }
    const primaryType = DAMAGE_TYPE_CYCLE[ctx.flags.primaryDmgType ?? 0];

    if (ctx.phaseKey === 'argument') {
      const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 1.1);
      const finalDmg = statCheck(ctx.playerBuild.will, 14, ctx.rng) ? Math.round(dmg * 0.5) : dmg;
      ctx.applyDamageToPlayer(finalDmg, primaryType, 'a quoted choice, thrown back at you');
      ctx.log.push(`${ctx.self.name} quotes one of your own choices back at you for ${finalDmg} damage.`);
      return;
    }
    if (ctx.phaseKey === 'evidence') {
      if (!ctx.flags.echoesSummoned) {
        ctx.flags.echoesSummoned = 1;
        const candidates: string[] = [];
        if (ctx.playerHistory.has('ate_venn_bread')) candidates.push('echo_of_hunger');
        if (ctx.playerHistory.has('destroyed_feast')) candidates.push('echo_of_emptiness');
        if (ctx.playerHistory.has('joined_hymn')) candidates.push('echo_of_harmony');
        if (ctx.playerHistory.has('accepted_purification')) candidates.push('echo_of_cleanliness');
        if (candidates.length === 0) candidates.push('echo_of_emptiness');
        candidates.slice(0, 2).forEach((id) => ctx.spawnAlly(id, 60));
        ctx.log.push(`${ctx.self.name} calls up Echoes of your own major choices.`);
        return;
      }
      const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.2);
      ctx.applyDamageToPlayer(dmg, primaryType, 'the weight of evidence');
      ctx.log.push(`${ctx.self.name} presses its case for ${dmg} damage.`);
      return;
    }
    if (ctx.phaseKey === 'question') {
      const asked = ctx.flags.questionsAsked ?? 0;
      if (asked < 3) {
        ctx.flags.questionsAsked = asked + 1;
        if (statCheck(ctx.playerBuild.will, 16, ctx.rng)) {
          ctx.damageSelf(40);
          ctx.log.push(`${ctx.self.name} asks a question you can actually answer. It loses 40 HP, staggered.`);
        } else {
          const dmg = ctx.applyDamageToPlayer(25, 'shadow', 'a question you cannot answer');
          ctx.applyStatusToPlayer('curse', 1);
          ctx.log.push(`${ctx.self.name} asks a question you can't answer. It costs you ${dmg} damage.`);
        }
        return;
      }
      const dmg = bossDamage(ctx.self.matk, ctx.player.mdef, 1.0);
      ctx.applyDamageToPlayer(dmg, primaryType, 'a repeated question');
      ctx.log.push(`${ctx.self.name} repeats itself for ${dmg} damage.`);
      return;
    }
    // answer phase
    if (ctx.flags.ultimateCharging === 1) {
      ctx.flags.ultimateCharging = 0;
      const dmg = bossDamage(ctx.self.matk, Math.round(ctx.player.mdef * 0.5), 2.5);
      ctx.applyDamageToPlayer(dmg, primaryType, 'The Story You Told');
      ctx.log.push(`${ctx.self.name} finishes The Story You Told for ${dmg} damage (ignores 50% Magic Defense).`);
      return;
    }
    if (ctx.turn % 3 === 0) {
      ctx.flags.ultimateCharging = 1;
      ctx.log.push(`${ctx.self.name} goes still, gathering everything you've told it about yourself.`);
      return;
    }
    const dmg = bossDamage(ctx.self.atk, ctx.player.def, 1.2);
    ctx.applyDamageToPlayer(dmg, primaryType, 'a final, honest blow');
    ctx.log.push(`${ctx.self.name} strikes plainly for ${dmg} damage.`);
  },
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
