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
    act(ctx) {
      const hpPct = ctx.self.hp / ctx.self.maxHp;
      if (ctx.self.flags.playerCastMagicLastTurn === 1) {
        ctx.applyStatusToPlayer('silence', 1);
        ctx.self.flags.playerCastMagicLastTurn = 0;
        return `${ctx.self.name} intones "Sealing Protocol." You are Silenced (1 turn).`;
      }
      if (hpPct < 0.4 && !ctx.self.flags.reshelved) {
        ctx.self.flags.reshelved = 1;
        // Shuffle its own weakness/resist pairing by swapping shock<->frost potency
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
};

// ---- Minor summons used by boss fights (Sable Inquisitor's ally, Reflection's Echoes) ----

export const SUMMON_ENEMIES: Record<string, EnemyDef> = {
  echo_of_hunger: {
    id: 'echo_of_hunger', name: 'Echo of Hunger', hp: 60, atk: 10, matk: 4, def: 6, mdef: 6, spd: 12,
    attackType: 'shadow', affinities: { sacred: 1.3 }, xp: 0,
    description: 'You remember the bread. It remembers being eaten.',
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
    act(ctx) {
      const dmg = ctx.applyDamageToPlayer(Math.max(3, Math.round(ctx.self.atk - ctx.player.def / 2)), 'shadow', ctx.self.name);
      return `${ctx.self.name} harmonizes against you for ${dmg} damage.`;
    },
  },
  echo_of_cleanliness: {
    id: 'echo_of_cleanliness', name: 'Echo of Cleanliness', hp: 60, atk: 10, matk: 6, def: 9, mdef: 9, spd: 10,
    attackType: 'sacred', affinities: { shadow: 1.3 }, xp: 0,
    description: 'Scrubbed white. It does not remember hurting.',
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
    act(ctx) {
      return basicAttack(ctx, 'pierce', 1.0, 'throws a trade-knife');
    },
  },
};

/** Which enemies are eligible per page range, for BoardGenerator's combat-node resolution. */
export function enemiesForPage(page: number, resonance: number): string[] {
  const early = ['echo_skeleton', 'venn_custodian', 'sable_zealot', 'ash_seer'];
  const late = ['sable_inquisitor', 'ash_mutant', 'echo_soldier'];
  const pool = page <= 5 ? [...early] : [...early, ...late];
  if (resonance >= 25) pool.push('memory_wraith');
  return pool;
}
