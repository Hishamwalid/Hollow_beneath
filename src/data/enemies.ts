import type { EnemyDef, EnemyTurnContext } from './types';

function basicAttack(ctx: EnemyTurnContext, type: EnemyTurnContext['self']['attackType'], power = 1.0, label = 'attacks'): string {
  const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round((ctx.self.atk - ctx.player.def / 2) * power)), type, ctx.self.name);
  return `${ctx.self.name} ${label} for ${dmg} damage.`;
}

export const ENEMIES: Record<string, EnemyDef> = {
  echo_skeleton: {
    id: 'echo_skeleton',
    name: 'Echo-bleached Skeleton',
    hp: 35, atk: 10, matk: 4, def: 6, mdef: 3, spd: 12,
    attackType: 'slash',
    affinities: { blunt: 1.5, sacred: 2.0, slash: 0.5, shadow: 0 },
    xp: 12,
    description: 'Bones that remember standing, if nothing else.',
    tendency: 'hunter',
    intents: [
      {
        id: 'rattle', label: 'Rattle Ribs', weight: 2,
        description: 'A shrill clatter of old bone that puts Fear on you (Fear, 1 turn).',
        resolve(ctx) {
          ctx.applyStatusToPlayer('fear', 1);
          return `${ctx.self.name} rattles its ribs. You flinch (Fear, 1 turn).`;
        },
      },
      {
        id: 'bone_slash', label: 'Bone Slash', weight: 98,
        description: 'A simple, sweeping slash from a blade of pale bone.',
        resolve(ctx) { return basicAttack(ctx, 'slash'); },
      },
    ],
    act(ctx) {
      if (ctx.rng() < 0.2) {
        ctx.applyStatusToPlayer('fear', 1);
        return `${ctx.self.name} rattles its ribs. You flinch (Fear, 1 turn).`;
      }
      return basicAttack(ctx, 'slash');
    },
  },

  venn_custodian: {
    id: 'venn_custodian',
    name: 'Venn Custodian',
    hp: 60, atk: 14, matk: 8, def: 12, mdef: 8, spd: 8,
    attackType: 'blunt',
    affinities: { shock: 1.5, frost: 1.2, blunt: 0.5, pierce: 0.8 },
    xp: 25,
    description: 'An Archive golem, still shelving books no one wrote.',
    tendency: 'tactician',
    intents: [
      {
        id: 'sealing_protocol', label: 'Sealing Protocol', weight: 999,
        description: 'If you cast magic last round, it intones an Archival ban and Silences you (1 turn).',
        condition: (ctx) => ctx.self.flags.playerCastMagicLastTurn === 1,
        resolve(ctx) {
          ctx.applyStatusToPlayer('silence', 1);
          ctx.self.flags.playerCastMagicLastTurn = 0;
          return `${ctx.self.name} intones "Sealing Protocol." You are Silenced (1 turn).`;
        },
      },
      {
        id: 'rewrite_battlefield', label: 'Rewrite Battlefield', weight: 999,
        description: 'At low health it re-writes itself — swapping its shock and frost resistances.',
        condition: (ctx) => ctx.self.hp / ctx.self.maxHp < 0.4 && !ctx.self.flags.reshelved,
        resolve(ctx) {
          ctx.self.flags.reshelved = 1;
          const s = ctx.self.affinities.shock;
          const f = ctx.self.affinities.frost;
          ctx.self.affinities.shock = f;
          ctx.self.affinities.frost = s;
          return `${ctx.self.name} performs "Rewrite Battlefield" — its weaknesses shift.`;
        },
      },
      {
        id: 'archive_bludgeon', label: 'Archive Bludgeon', weight: 90,
        description: 'A methodical swing of a shelving-weight fist.',
        resolve(ctx) { return basicAttack(ctx, 'blunt'); },
      },
    ],
    act(ctx) {
      const hpPct = ctx.self.hp / ctx.self.maxHp;
      if (ctx.self.flags.playerCastMagicLastTurn === 1) {
        ctx.applyStatusToPlayer('silence', 1);
        ctx.self.flags.playerCastMagicLastTurn = 0;
        return `${ctx.self.name} intones "Sealing Protocol." You are Silenced (1 turn).`;
      }
      if (hpPct < 0.4 && !ctx.self.flags.reshelved) {
        ctx.self.flags.reshelved = 1;
        const s = ctx.self.affinities.shock;
        const f = ctx.self.affinities.frost;
        ctx.self.affinities.shock = f;
        ctx.self.affinities.frost = s;
        return `${ctx.self.name} performs "Rewrite Battlefield" — its weaknesses shift.`;
      }
      return basicAttack(ctx, 'blunt');
    },
  },

  sable_zealot: {
    id: 'sable_zealot',
    name: 'Sable Zealot',
    hp: 45, atk: 12, matk: 10, def: 8, mdef: 10, spd: 14,
    attackType: 'sacred',
    affinities: { shadow: 1.5, pierce: 1.2, sacred: 0.5, flame: 0.8 },
    xp: 18,
    description: 'Ash-marked, certain, and not entirely wrong.',
    tendency: 'sage',
    intents: [
      {
        id: 'healing_prayer', label: 'Healing Prayer', weight: 900,
        description: 'Chants a rite that restores a wounded ally for 20 HP.',
        condition: (ctx) => !!ctx.allies.find((a) => a.hp > 0 && a.hp / a.maxHp < 0.4),
        resolve(ctx) {
          const woundedAlly = ctx.allies.find((a) => a.hp > 0 && a.hp / a.maxHp < 0.4);
          if (!woundedAlly) return `${ctx.self.name} begins to pray, but no ally needs it.`;
          woundedAlly.hp = Math.min(woundedAlly.maxHp, woundedAlly.hp + 20);
          return `${ctx.self.name} chants a Healing Prayer over ${woundedAlly.name} (+20 HP).`;
        },
      },
      {
        id: 'dispel_holy', label: 'Dispel Holy', weight: 900,
        description: 'Strips all of your active buffs at once.',
        condition: (ctx) => ctx.player.statuses.some((s) => ['focus', 'fortify', 'blessing', 'haste', 'barrier', 'reflection'].includes(s.id)),
        resolve(ctx) {
          ctx.removePlayerBuffs();
          return `${ctx.self.name} casts Dispel Holy. Your buffs are stripped away.`;
        },
      },
      {
        id: 'punishing_strike', label: 'Punishing Strike', weight: 500,
        description: 'A heavy, ash-stained melee blow.',
        resolve(ctx) { return basicAttack(ctx, 'sacred', 1.15, 'lands a Punishing Strike'); },
      },
    ],
    act(ctx) {
      const woundedAlly = ctx.allies.find((a) => a.hp > 0 && a.hp / a.maxHp < 0.4);
      if (woundedAlly) {
        woundedAlly.hp = Math.min(woundedAlly.maxHp, woundedAlly.hp + 20);
        return `${ctx.self.name} chants a Healing Prayer over ${woundedAlly.name} (+20 HP).`;
      }
      if (ctx.player.statuses.some((s) => ['focus', 'fortify', 'blessing', 'haste', 'barrier', 'reflection'].includes(s.id))) {
        ctx.removePlayerBuffs();
        return `${ctx.self.name} casts Dispel Holy. Your buffs are stripped away.`;
      }
      return basicAttack(ctx, 'sacred', 1.15, 'lands a Punishing Strike');
    },
  },

  ash_seer: {
    id: 'ash_seer',
    name: 'Ash Covenant Seer',
    hp: 55, atk: 8, matk: 16, def: 5, mdef: 14, spd: 18,
    attackType: 'shadow',
    affinities: { sacred: 1.5, flame: 1.2, shadow: 0.5, frost: 0.8 },
    xp: 22,
    description: 'Crystal blooms where its eyes used to focus on one thing at a time.',
    tendency: 'caster',
    intents: [
      {
        id: 'darken_veil', label: 'Shroud the Field', weight: 70,
        condition: (ctx) => !ctx.self.flags.shroudField,
        description: 'Once: casts a Shadow Veil over the whole field (3 turns).',
        resolve(ctx) {
          ctx.self.flags.shroudField = 1;
          ctx.applyBattlefieldState('shadow_veil', 3);
          return `${ctx.self.name} shroud the field — Shadow Veil settles over the fight.`;
        },
      },
      {
        id: 'weave_curse', label: 'Weave Curse', weight: 999,
        condition: (ctx) => (ctx.turn - 1) % 3 === 0,
        description: 'Every third turn: a Curse that compounds against you (Curse, 3 turns).',
        resolve(ctx) {
          ctx.applyStatusToPlayer('curse', 3);
          return `${ctx.self.name} weaves a Curse upon you.`;
        },
      },
      {
        id: 'copy_last_motion', label: 'Copy Last Motion', weight: 999,
        condition: (ctx) => (ctx.turn - 1) % 3 === 1,
        description: 'Mimics whatever you just did back at you as shadow damage.',
        resolve(ctx) {
          const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.matk - ctx.player.mdef * 0.3)), 'shadow', ctx.self.name);
          return `${ctx.self.name} copies your last motion back at you for ${dmg} damage.`;
        },
      },
      {
        id: 'hallucinate', label: 'Hallucinate', weight: 999,
        condition: (ctx) => (ctx.turn - 1) % 3 === 2,
        description: 'Every third turn: you hallucinate your own attack patterns (Confuse, 2 turns).',
        resolve(ctx) {
          ctx.applyStatusToPlayer('confuse', 2);
          return `${ctx.self.name} makes you Hallucinate (Confuse, 2 turns).`;
        },
      },
    ],
    act(ctx) {
      const cycle = (ctx.turn - 1) % 3;
      if (cycle === 0) {
        ctx.applyStatusToPlayer('curse', 3);
        return `${ctx.self.name} weaves a Curse upon you.`;
      }
      if (cycle === 1) {
        const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.matk - ctx.player.mdef * 0.3)), 'shadow', ctx.self.name);
        return `${ctx.self.name} copies your last motion back at you for ${dmg} damage.`;
      }
      ctx.applyStatusToPlayer('confuse', 2);
      return `${ctx.self.name} makes you Hallucinate (Confuse, 2 turns).`;
    },
  },

  memory_wraith: {
    id: 'memory_wraith',
    name: 'Memory Wraith',
    hp: 40, atk: 0, matk: 14, def: 4, mdef: 12, spd: 20,
    dodge: 50,
    attackType: 'shock',
    affinities: { sacred: 1.5, slash: 1.2, shock: 0, shadow: 0.5 },
    xp: 20,
    minResonance: 25,
    description: 'Only visible once the static gets loud enough.',
    tendency: 'manipulator',
    intents: [
      {
        id: 'memory_lapse', label: 'Memory Lapse', weight: 100,
        description: 'Shock damage plus a random memory-wipe debuff (Weakness, Defense Down, or Slow).',
        resolve(ctx) {
          const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.matk - ctx.player.mdef * 0.3)), 'shock', ctx.self.name);
          const debuffs: Array<'weakness' | 'defense_down' | 'slow'> = ['weakness', 'defense_down', 'slow'];
          const pick = debuffs[Math.floor(ctx.rng() * debuffs.length)];
          ctx.applyStatusToPlayer(pick, 2);
          return `${ctx.self.name} inflicts a Memory Lapse — ${dmg} damage and ${pick.replace('_', ' ')}.`;
        },
      },
    ],
    act(ctx) {
      const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.matk - ctx.player.mdef * 0.3)), 'shock', ctx.self.name);
      const debuffs: Array<'weakness' | 'defense_down' | 'slow'> = ['weakness', 'defense_down', 'slow'];
      const pick = debuffs[Math.floor(ctx.rng() * debuffs.length)];
      ctx.applyStatusToPlayer(pick, 2);
      return `${ctx.self.name} inflicts a Memory Lapse — ${dmg} damage and ${pick.replace('_', ' ')}.`;
    },
  },

  sable_inquisitor: {
    id: 'sable_inquisitor',
    name: 'Sable Inquisitor',
    hp: 75, atk: 16, matk: 12, def: 14, mdef: 16, spd: 15,
    attackType: 'sacred',
    affinities: { shadow: 1.5, shock: 1.2, sacred: 0.25, flame: 0.5 },
    xp: 35,
    description: 'Judgment with a schedule to keep.',
    tendency: 'coward',
    intents: [
      {
        id: 'judgment_opener', label: 'Judgment', weight: 999,
        condition: (ctx) => ctx.turn === 1,
        description: 'Opens with a heavy holy blow and Seal Mind (2 turns).',
        resolve(ctx) {
          const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round((ctx.self.atk - ctx.player.def / 2) * 1.2)), 'sacred', ctx.self.name);
          ctx.applyStatusToPlayer('seal_mind', 2);
          return `${ctx.self.name} opens with Judgment — ${dmg} damage, Seal Mind (2 turns).`;
        },
      },
      {
        id: 'summon_zealot', label: 'Summon Zealot', weight: 999,
        condition: (ctx) => ctx.turn > 1 && ctx.self.hp / ctx.self.maxHp < 0.5 && !ctx.self.flags.summoned,
        description: 'When wounded, calls a Sable Zealot to its side.',
        resolve(ctx) {
          ctx.self.flags.summoned = 1;
          ctx.spawnAlly('sable_zealot', 30);
          return `${ctx.self.name} summons a Sable Zealot.`;
        },
      },
      {
        id: 'judgment_blow', label: 'Judgment Blow', weight: 900,
        description: 'A measured, painful holy strike.',
        resolve(ctx) { return basicAttack(ctx, 'sacred'); },
      },
    ],
    act(ctx) {
      if (ctx.turn === 1) {
        const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round((ctx.self.atk - ctx.player.def / 2) * 1.2)), 'sacred', ctx.self.name);
        ctx.applyStatusToPlayer('seal_mind', 2);
        return `${ctx.self.name} opens with Judgment — ${dmg} damage, Seal Mind (2 turns).`;
      }
      const hpPct = ctx.self.hp / ctx.self.maxHp;
      if (hpPct < 0.5 && !ctx.self.flags.summoned) {
        ctx.self.flags.summoned = 1;
        ctx.spawnAlly('sable_zealot', 30);
        return `${ctx.self.name} summons a Sable Zealot.`;
      }
      return basicAttack(ctx, 'sacred');
    },
  },

  ash_mutant: {
    id: 'ash_mutant',
    name: 'Ash Covenant Mutant',
    hp: 90, atk: 18, matk: 10, def: 10, mdef: 8, spd: 12,
    attackType: 'shadow',
    affinities: { sacred: 1.5, frost: 1.2, shadow: 0.25 },
    xp: 40,
    description: "Translated past the point of a body that agrees with itself.",
    tendency: 'berserker',
    intents: [
      {
        id: 'enrage', label: 'Enrage', weight: 999,
        condition: (ctx) => ctx.self.hp / ctx.self.maxHp < 0.3 && !ctx.self.flags.enraged,
        description: 'At low health: Attack sharply up, Defense down.',
        resolve(ctx) {
          ctx.self.flags.enraged = 1;
          ctx.self.atk = Math.round(ctx.self.atk * 1.5);
          ctx.self.def = Math.round(ctx.self.def * 0.7);
          return `${ctx.self.name} enrages — Attack sharply up, Defense down.`;
        },
      },
      {
        id: 'devour', label: 'Devour', weight: 900,
        description: 'Cries the same hunger as you do: shadow damage, healing half back.',
        resolve(ctx) {
          const raw = Math.max(3, Math.round(ctx.self.atk - ctx.player.def / 2));
          const dmg = ctx.applyDamageToPlayer(raw, 'shadow', ctx.self.name);
          ctx.healSelf(Math.round(dmg * 0.5));
          return `${ctx.self.name} Devours you for ${dmg} damage, healing half of it back.`;
        },
      },
    ],
    act(ctx) {
      const hpPct = ctx.self.hp / ctx.self.maxHp;
      if (hpPct < 0.3 && !ctx.self.flags.enraged) {
        ctx.self.flags.enraged = 1;
        ctx.self.atk = Math.round(ctx.self.atk * 1.5);
        ctx.self.def = Math.round(ctx.self.def * 0.7);
        return `${ctx.self.name} enrages — Attack sharply up, Defense down.`;
      }
      const raw = Math.max(3, Math.round(ctx.self.atk - ctx.player.def / 2));
      const dmg = ctx.applyDamageToPlayer(raw, 'shadow', ctx.self.name);
      ctx.healSelf(Math.round(dmg * 0.5));
      return `${ctx.self.name} Devours you for ${dmg} damage, healing half of it back.`;
    },
  },

  echo_soldier: {
    id: 'echo_soldier',
    name: 'Dominion Echo-Soldier',
    hp: 80, atk: 20, matk: 6, def: 16, mdef: 10, spd: 16,
    attackType: 'pierce',
    affinities: { blunt: 1.5, shock: 1.2, pierce: 0.25, slash: 0.5 },
    xp: 38,
    description: 'A soldier for an empire that no longer issues orders.',
    tendency: 'guardian',
    intents: [
      {
        id: 'empires_memory', label: "Empire's Memory", weight: 999,
        condition: (ctx) => ctx.turn % 3 === 0 && ctx.allies.some((a) => a.hp > 0),
        description: 'Every third round it bolsters its allies — Attack +20% for the whole line.',
        resolve(ctx) {
          ctx.allies.forEach((a) => {
            if (a.hp > 0) a.atk = Math.round(a.atk * 1.2);
          });
          ctx.self.atk = Math.round(ctx.self.atk * 1.2);
          return `${ctx.self.name} invokes Empire's Memory — all allies' Attack +20%.`;
        },
      },
      {
        id: 'formation_thrust', label: 'Formation Thrust', weight: 900,
        description: 'A disciplined phalanx thrust.',
        resolve(ctx) { return basicAttack(ctx, 'pierce'); },
      },
    ],
    act(ctx) {
      if (ctx.turn % 3 === 0 && ctx.allies.some((a) => a.hp > 0)) {
        ctx.allies.forEach((a) => {
          if (a.hp > 0) a.atk = Math.round(a.atk * 1.2);
        });
        ctx.self.atk = Math.round(ctx.self.atk * 1.2);
        return `${ctx.self.name} invokes Empire's Memory — all allies' Attack +20%.`;
      }
      return basicAttack(ctx, 'pierce');
    },
  },

  dust_wight: {
    id: 'dust_wight',
    name: 'Dust Wight',
    hp: 22, atk: 7, matk: 2, def: 3, mdef: 2, spd: 10,
    attackType: 'pierce',
    affinities: { flame: 1.5, blunt: 1.3, sacred: 1.3, pierce: 0.7 },
    xp: 8,
    description: 'Something small that learned to survive on what the Loom leaves behind.',
    tendency: 'hunter',
    intents: [
      {
        id: 'dirty_claw', label: 'Dirty Claw', weight: 25,
        description: 'A quick rip that draws Bleed (2 turns).',
        resolve(ctx) {
          ctx.applyStatusToPlayer('bleed', 2);
          return `${ctx.self.name} claws at you. Bleeding (2 turns).`;
        },
      },
      {
        id: 'gnaw', label: 'Gnaw', weight: 75,
        description: 'A persistent, hungry gnaw.',
        resolve(ctx) { return basicAttack(ctx, 'pierce', 0.9, 'gnaws'); },
      },
    ],
    act(ctx) {
      if (ctx.rng() < 0.25) {
        ctx.applyStatusToPlayer('bleed', 2);
        return `${ctx.self.name} claws at you. Bleeding (2 turns).`;
      }
      return basicAttack(ctx, 'pierce', 0.9, 'gnaws');
    },
  },

  dust_road_raider: {
    id: 'dust_road_raider',
    name: 'Dust-Road Raider',
    hp: 38, atk: 13, matk: 4, def: 5, mdef: 4, spd: 20,
    dodge: 20,
    attackType: 'pierce',
    affinities: { blunt: 1.4, shock: 1.2, pierce: 0.6, slash: 0.8 },
    xp: 16,
    description: 'Not everyone on the Dust Road walked away from the Archive as clean as Sera Voss did.',
    tendency: 'aggressor',
    intents: [
      {
        id: 'press_advantage', label: 'Press Advantage', weight: 1000,
        condition: (ctx) => ctx.player.hp / ctx.player.maxHp < 0.5,
        description: 'When you are hurt it abandons caution for a heavy, open blow.',
        resolve(ctx) {
          const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round((ctx.self.atk - ctx.player.def / 2) * 1.3)), 'pierce', ctx.self.name);
          return `${ctx.self.name} presses the advantage for ${dmg} damage.`;
        },
      },
      {
        id: 'hamstring', label: 'Hamstring', weight: 420,
        description: 'A low cut that slows your footing (Slow, 2 turns).',
        resolve(ctx) {
          ctx.applyStatusToPlayer('slow', 2);
          return `${ctx.self.name} hamstrings your footing. Slowed (2 turns).`;
        },
      },
      {
        id: 'fast_low_strike', label: 'Fast Low Strike', weight: 700,
        description: 'A quick, low strike, hard to read at speed.',
        resolve(ctx) { return basicAttack(ctx, 'pierce', 1.0, 'strikes fast and low'); },
      },
    ],
    act(ctx) {
      const hpPct = ctx.player.hp / ctx.player.maxHp;
      if (hpPct < 0.5 && ctx.rng() < 0.5) {
        const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round((ctx.self.atk - ctx.player.def / 2) * 1.3)), 'pierce', ctx.self.name);
        return `${ctx.self.name} presses the advantage for ${dmg} damage.`;
      }
      if (ctx.rng() < 0.3) {
        ctx.applyStatusToPlayer('slow', 2);
        return `${ctx.self.name} hamstrings your footing. Slowed (2 turns).`;
      }
      return basicAttack(ctx, 'pierce', 1.0, 'strikes fast and low');
    },
  },

  archive_cipher_wraith: {
    id: 'archive_cipher_wraith',
    name: 'Archive Cipher-Wraith',
    hp: 50, atk: 6, matk: 15, def: 6, mdef: 12, spd: 16,
    attackType: 'shock',
    affinities: { shadow: 1.5, flame: 1.2, shock: 0.5, frost: 0.8 },
    xp: 24,
    description: 'A cataloguer that redacted itself once too often.',
    tendency: 'manipulator',
    intents: [
      {
        id: 'redact', label: 'Redact', weight: 680,
        condition: (ctx) => ctx.player.statuses.some((s) => ['focus', 'fortify', 'blessing', 'haste', 'barrier', 'reflection'].includes(s.id)),
        description: 'Strips your buffs and files them away, healing itself.',
        resolve(ctx) {
          ctx.removePlayerBuffs();
          ctx.healSelf(Math.round(ctx.self.maxHp * 0.1));
          return `${ctx.self.name} redacts your advantages and files them away, healing itself.`;
        },
      },
      {
        id: 'strike_out_lines', label: 'Strike Out Relevant Lines', weight: 350,
        description: 'Blinds you for 2 turns.',
        resolve(ctx) {
          ctx.applyStatusToPlayer('blind', 2);
          return `${ctx.self.name} strikes out your relevant lines. Blinded (2 turns).`;
        },
      },
      {
        id: 'cross_reference', label: 'Cross-Reference', weight: 700,
        description: 'Shock damage drawn from your most-used techniques.',
        resolve(ctx) {
          const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.matk - ctx.player.mdef * 0.3)), 'shock', ctx.self.name);
          return `${ctx.self.name} cross-references your weaknesses for ${dmg} damage.`;
        },
      },
    ],
    act(ctx) {
      if (ctx.player.statuses.some((s) => ['focus', 'fortify', 'blessing', 'haste', 'barrier', 'reflection'].includes(s.id)) && ctx.rng() < 0.5) {
        ctx.removePlayerBuffs();
        ctx.healSelf(Math.round(ctx.self.maxHp * 0.1));
        return `${ctx.self.name} redacts your advantages and files them away, healing itself.`;
      }
      if (ctx.rng() < 0.35) {
        ctx.applyStatusToPlayer('blind', 2);
        return `${ctx.self.name} strikes out your relevant lines. Blinded (2 turns).`;
      }
      const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.matk - ctx.player.mdef * 0.3)), 'shock', ctx.self.name);
      return `${ctx.self.name} cross-references your weaknesses for ${dmg} damage.`;
    },
  },

  the_unread: {
    id: 'the_unread',
    name: 'The Unread',
    hp: 65, atk: 4, matk: 22, def: 8, mdef: 18, spd: 24,
    dodge: 15,
    attackType: 'shadow',
    affinities: { sacred: 1.4, shadow: 0.3, shock: 0.7 },
    xp: 45,
    minResonance: 50,
    description: 'Not a creature. A sentence the Loom never finished, wearing a shape to say it in.',
    tendency: 'caster',
    intents: [
      {
        id: 'reads_you_first', label: 'Reads You First', weight: 900,
        condition: (ctx) => ctx.turn === 1,
        description: 'Opens by reading you: shadow damage plus Seal Mind (2 turns).',
        resolve(ctx) {
          ctx.applyStatusToPlayer('seal_mind', 2);
          const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.matk - ctx.player.mdef * 0.3)), 'shadow', ctx.self.name);
          return `${ctx.self.name} reads you first, then answers — ${dmg} damage, Seal Mind (2 turns).`;
        },
      },
      {
        id: 'true_ending', label: 'The Sentence\'s True Ending', weight: 900,
        condition: (ctx) => ctx.turn > 1 && ctx.self.hp / ctx.self.maxHp < 0.5 && !ctx.self.flags.unraveled,
        description: 'At low health it unspools the sentence that binds you — Weakness (3 turns).',
        resolve(ctx) {
          ctx.self.flags.unraveled = 1;
          ctx.applyStatusToPlayer('weakness', 3);
          return `${ctx.self.name} finds the sentence's true ending. Weakness (3 turns).`;
        },
      },
      {
        id: 'uninvited', label: 'Uninvited', weight: 900,
        description: 'Continues speaking out loud. Shadow damage.',
        resolve: (ctx) => {
          const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.matk - ctx.player.mdef * 0.3)), 'shadow', ctx.self.name);
          return `${ctx.self.name} continues, uninvited, for ${dmg} damage.`;
        },
      },
    ],
    act(ctx) {
      if (ctx.turn === 1) {
        ctx.applyStatusToPlayer('seal_mind', 2);
        const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.matk - ctx.player.mdef * 0.3)), 'shadow', ctx.self.name);
        return `${ctx.self.name} reads you first, then answers — ${dmg} damage, Seal Mind (2 turns).`;
      }
      const hpPct = ctx.self.hp / ctx.self.maxHp;
      if (hpPct < 0.5 && !ctx.self.flags.unraveled) {
        ctx.self.flags.unraveled = 1;
        ctx.applyStatusToPlayer('weakness', 3);
        return `${ctx.self.name} finds the sentence's true ending. Weakness (3 turns).`;
      }
      const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.matk - ctx.player.mdef * 0.3)), 'shadow', ctx.self.name);
      return `${ctx.self.name} continues, uninvited, for ${dmg} damage.`;
    },
  },
};

// ---- Minor summons used by boss fights (Sable Inquisitor's ally, Reflection's Echoes) ----

export const SUMMON_ENEMIES: Record<string, EnemyDef> = {
  echo_of_hunger: {
    id: 'echo_of_hunger', name: 'Echo of Hunger', hp: 60, atk: 10, matk: 4, def: 6, mdef: 6, spd: 12,
    attackType: 'shadow', affinities: { sacred: 1.3 }, xp: 0,
    description: 'You remember the bread. It remembers being eaten.',
    tendency: 'sage',
    intents: [
      {
        id: 'feed', label: 'Feed', weight: 100,
        description: 'Shadow damage, and it heals itself for the memory of it.',
        resolve(ctx) {
          const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.atk - ctx.player.def / 2)), 'shadow', ctx.self.name);
          ctx.healSelf(Math.round(dmg * 0.4));
          return `${ctx.self.name} feeds on the memory for ${dmg} damage, healing itself.`;
        },
      },
    ],
    act(ctx) {
      const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.atk - ctx.player.def / 2)), 'shadow', ctx.self.name);
      ctx.healSelf(Math.round(dmg * 0.4));
      return `${ctx.self.name} feeds on the memory for ${dmg} damage, healing itself.`;
    },
  },
  echo_of_emptiness: {
    id: 'echo_of_emptiness', name: 'Echo of Emptiness', hp: 60, atk: 8, matk: 8, def: 8, mdef: 8, spd: 12,
    attackType: 'shadow', affinities: { sacred: 1.3 }, xp: 0,
    description: 'What you burned burns back.',
    tendency: 'manipulator',
    intents: [
      {
        id: 'hollow_out', label: 'Hollow Out', weight: 100,
        description: 'Shadow damage and a brief Silence.',
        resolve(ctx) {
          ctx.applyStatusToPlayer('silence', 1);
          const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.matk - ctx.player.mdef / 2)), 'shadow', ctx.self.name);
          return `${ctx.self.name} hollows your options for ${dmg} damage and briefly Silences you.`;
        },
      },
    ],
    act(ctx) {
      ctx.applyStatusToPlayer('silence', 1);
      const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.matk - ctx.player.mdef / 2)), 'shadow', ctx.self.name);
      return `${ctx.self.name} hollows your options for ${dmg} damage and briefly Silences you.`;
    },
  },
  echo_of_harmony: {
    id: 'echo_of_harmony', name: 'Echo of Harmony', hp: 60, atk: 9, matk: 9, def: 7, mdef: 9, spd: 14,
    attackType: 'shadow', affinities: { sacred: 1.3 }, xp: 0,
    description: 'A voice that never sang alone.',
    tendency: 'aggressor',
    intents: [
      {
        id: 'harmonize', label: 'Harmonize', weight: 100,
        description: 'A chord of shadow damage.',
        resolve(ctx) {
          const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.atk - ctx.player.def / 2)), 'shadow', ctx.self.name);
          return `${ctx.self.name} harmonizes against you for ${dmg} damage.`;
        },
      },
    ],
    act(ctx) {
      const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.atk - ctx.player.def / 2)), 'shadow', ctx.self.name);
      return `${ctx.self.name} harmonizes against you for ${dmg} damage.`;
    },
  },
  echo_of_cleanliness: {
    id: 'echo_of_cleanliness', name: 'Echo of Cleanliness', hp: 60, atk: 10, matk: 6, def: 9, mdef: 9, spd: 10,
    attackType: 'sacred', affinities: { shadow: 1.3 }, xp: 0,
    description: 'Scrubbed white. It does not remember hurting.',
    tendency: 'aggressor',
    intents: [
      {
        id: 'scrub', label: 'Scrub Clean', weight: 100,
        description: 'A clean, straightforward strike that stifles your Resonance.',
        resolve(ctx) {
          const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.atk - ctx.player.def / 2)), 'sacred', ctx.self.name);
          return `${ctx.self.name} strikes for ${dmg} damage. Your Resonance skills feel muted.`;
        },
      },
    ],
    act(ctx) {
      const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.atk - ctx.player.def / 2)), 'sacred', ctx.self.name);
      return `${ctx.self.name} strikes for ${dmg} damage. Your Resonance skills feel muted.`;
    },
  },
  sera_voss: {
    id: 'sera_voss',
    name: 'Sera Voss',
    hp: 70, atk: 16, matk: 6, def: 8, mdef: 8, spd: 22,
    attackType: 'pierce',
    affinities: { blunt: 1.3, pierce: 0.6 },
    xp: 15,
    description: 'Ten years off the Archive payroll and still faster than you.',
    tendency: 'hunter',
    intents: [
      {
        id: 'trade_knife', label: 'Trade Knife', weight: 100,
        description: 'A fast, deceptively light throw.',
        resolve(ctx) {
          return basicAttack(ctx, 'pierce', 1.0, 'throws a trade-knife');
        },
      },
    ],
    act(ctx) {
      return basicAttack(ctx, 'pierce', 1.0, 'throws a trade-knife');
    },
  },
};

/** Which enemies are eligible per page range, for BoardGenerator's combat-node resolution. */
export function enemiesForPage(page: number, resonance: number): string[] {
  const veryEarly = ['dust_wight'];
  const early = ['echo_skeleton', 'venn_custodian', 'sable_zealot', 'ash_seer'];
  const mid = ['dust_road_raider', 'archive_cipher_wraith'];
  const late = ['sable_inquisitor', 'ash_mutant', 'echo_soldier'];
  let pool: string[];
  if (page <= 2) pool = [...veryEarly, ...early];
  else if (page <= 5) pool = [...early, ...mid];
  else pool = [...early, ...mid, ...late];
  if (resonance >= 25) pool.push('memory_wraith');
  if (resonance >= 50 && page >= 6) pool.push('the_unread');
  return pool;
}