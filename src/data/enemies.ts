import type { EnemyDef, EnemyTurnContext } from './types';

// ============================================================================
// Move helpers — thin wrappers over the turn context so movepools stay terse.
// ============================================================================

function hitPlayer(ctx: EnemyTurnContext, power: number, type: EnemyTurnContext['self']['attackType'], label: string, opts?: { critChance?: number; accMult?: number }): string {
  const raw = Math.max(3, Math.round((ctx.self.atk - ctx.player.def / 2) * power));
  const dmg = ctx.applyDamageToPlayer(raw, type, `${ctx.self.name} — ${label}`, opts);
  return dmg === 0
    ? `${ctx.self.name} uses ${label} — it does nothing.`
    : `${ctx.self.name} uses ${label} for ${dmg} damage.`;
}

function magicHitPlayer(ctx: EnemyTurnContext, power: number, type: 'flame' | 'frost' | 'shock' | 'sacred' | 'shadow', label: string, opts?: { guaranteed?: boolean }): string {
  const raw = Math.max(3, Math.round((ctx.self.matk - ctx.player.mdef / 2) * power));
  const dmg = ctx.applyDamageToPlayer(raw, type, `${ctx.self.name} — ${label}`, { guaranteed: opts?.guaranteed });
  return `${ctx.self.name} uses ${label} for ${dmg} damage.`;
}

function heavyHit(ctx: EnemyTurnContext, power: number, type: EnemyTurnContext['self']['attackType'], label: string, opts?: { bypassGuard?: boolean; critChance?: number }): string {
  const raw = Math.max(5, Math.round((ctx.self.atk - ctx.player.def / 2) * power));
  const dmg = ctx.applyDamageToPlayer(raw, type, `${ctx.self.name} — ${label}`, { bypassGuard: opts?.bypassGuard, critChance: opts?.critChance });
  return `${ctx.self.name} unleashes ${label} for ${dmg} damage!`;
}

// ============================================================================
// STAGE ROSTERS (Combat System Revamp §4)
// ============================================================================

export const ENEMIES: Record<string, EnemyDef> = {
  // ---- Stage 1: Surface Threshold ------------------------------------------
  dust_wight: {
    id: 'dust_wight',
    name: 'Dust Wight',
    level: 2,
    hp: 61, mp: 30, atk: 10, matk: 4, def: 8, mdef: 6, spd: 9,
    attackType: 'slash',
    affinities: { slash: 'wk', pierce: 'str', blunt: 'null', flame: 'rep' },
    xp: 14,
    description: 'A desert-dusted remnant wrapped in funerary linen.',
    moves: [
      {
        id: 'dust_slap', label: 'Dust Slab', weight: 3,
        description: 'Basic Slash damage.',
        resolve(ctx) { return hitPlayer(ctx, 1.0, 'slash', 'Dust Slap'); },
      },
      {
        id: 'sand_armor', label: 'Sand Armor', weight: 1,
        description: 'Raises its own Defense by 20% for 2 turns.',
        condition: (ctx) => !ctx.self.statuses.some((s) => s.id === 'defense_up') && ctx.turn > 1,
        resolve(ctx) {
          ctx.applyStatusToSelf('defense_up', 2);
          return `${ctx.self.name} packs sand into its wrappings. (Defense +20%, 2 turns)`;
        },
      },
    ],
  },

  echo_skeleton: {
    id: 'echo_skeleton',
    name: 'Echo-bleached Skeleton',
    level: 2,
    hp: 48, mp: 20, atk: 11, matk: 4, def: 6, mdef: 5, spd: 12,
    attackType: 'slash',
    affinities: { blunt: 'wk', flame: 'wk', pierce: 'str' },
    xp: 12,
    description: 'Bones that remember standing, if nothing else.',
    moves: [
      {
        id: 'bone_cleave', label: 'Bone Cleave', weight: 3,
        description: 'High-crit Slash attack.',
        resolve(ctx) { return hitPlayer(ctx, 1.0, 'slash', 'Bone Cleave', { critChance: 0.3 }); },
      },
      {
        id: 'rattle', label: 'Rattle', weight: 1,
        description: 'Low Blunt damage with a chance to inflict Fear.',
        resolve(ctx) {
          const line = hitPlayer(ctx, 0.6, 'blunt', 'Rattle');
          if (ctx.rng() < 0.15) {
            ctx.applyStatusToPlayer('fear', 1);
            return `${line} The clatter leaves you shaken. (Fear, 1 turn)`;
          }
          return line;
        },
      },
    ],
  },

  venn_custodian: {
    id: 'venn_custodian',
    name: 'Venn Custodian',
    level: 5,
    hp: 85, mp: 40, atk: 15, matk: 10, def: 13, mdef: 10, spd: 9,
    attackType: 'blunt',
    affinities: { frost: 'wk', slash: 'str', pierce: 'str', blunt: 'str', shock: 'drn' },
    xp: 26,
    description: 'An Archive golem, still shelving books no one wrote.',
    moves: [
      {
        id: 'chilling_touch', label: 'Chilling Touch', weight: 2,
        description: 'Frost damage. Inflicts Chilled.',
        resolve(ctx) {
          const line = magicHitPlayer(ctx, 1.1, 'frost', 'Chilling Touch');
          ctx.applyStatusToPlayer('chilled', 2);
          return `${line} You are Chilled. (2 turns)`;
        },
      },
      {
        id: 'barrier', label: 'Barrier', weight: 1,
        description: 'Grants an absorption shield to itself or an ally.',
        condition: (ctx) => ctx.turn > 1,
        resolve(ctx) {
          const wounded = ctx.allies.find((a) => a.hp > 0 && a.hp / a.maxHp < 0.6);
          const target = wounded ?? ctx.self;
          target.statuses.push({ id: 'barrier', stacks: 1, turnsRemaining: 99, meta: { amount: 22 } });
          return `${ctx.self.name} raises a Barrier around ${target === ctx.self ? 'itself' : target.name}. (Absorbs 22)`;
        },
      },
      {
        id: 'archive_bludgeon', label: 'Archive Bludgeon', weight: 3,
        description: 'A methodical swing of a shelving-weight fist.',
        resolve(ctx) { return hitPlayer(ctx, 1.0, 'blunt', 'Archive Bludgeon'); },
      },
    ],
  },

  sable_zealot: {
    id: 'sable_zealot',
    name: 'Sable Zealot',
    level: 5,
    hp: 62, mp: 25, atk: 14, matk: 11, def: 8, mdef: 11, spd: 14,
    attackType: 'slash',
    affinities: { flame: 'wk', blunt: 'wk', sacred: 'rep' },
    xp: 20,
    description: 'Ash-marked, certain, and not entirely wrong.',
    moves: [
      {
        id: 'frenzied_slash', label: 'Frenzied Slash', weight: 2,
        description: 'Two rapid hits — costs it 10% of its own HP.',
        resolve(ctx) {
          const cost = Math.round(ctx.self.maxHp * 0.1);
          ctx.damageSelf(cost);
          const d1 = ctx.applyDamageToPlayer(Math.max(3, Math.round((ctx.self.atk - ctx.player.def / 2) * 0.7)), 'slash', `${ctx.self.name} — Frenzied Slash`);
          const d2 = ctx.applyDamageToPlayer(Math.max(3, Math.round((ctx.self.atk - ctx.player.def / 2) * 0.7)), 'slash', `${ctx.self.name} — Frenzied Slash`);
          return `${ctx.self.name} tears into you twice (${d1}, ${d2}), tearing its own robes bloody in the process.`;
        },
      },
      {
        id: 'reckless_flail', label: 'Reckless Flail', weight: 2,
        description: 'Heavy Blunt damage with reduced accuracy.',
        resolve(ctx) { return hitPlayer(ctx, 1.5, 'blunt', 'Reckless Flail', { accMult: 0.7 }); },
      },
    ],
  },

  ash_seer: {
    id: 'ash_seer',
    name: 'Ash Covenant Seer',
    level: 6,
    hp: 58, mp: 50, atk: 10, matk: 15, def: 7, mdef: 13, spd: 11,
    attackType: 'shock',
    affinities: { shock: 'wk', pierce: 'wk', flame: 'null' },
    xp: 22,
    description: 'Crystalline growths refract your face wrong.',
    moves: [
      {
        id: 'spark_arc', label: 'Spark Arc', weight: 3,
        description: 'Shock damage; Superconducts Chilled targets (Stun).',
        resolve(ctx) {
          const chilled = ctx.player.statuses.some((s) => s.id === 'chilled');
          const line = magicHitPlayer(ctx, 1.2, 'shock', 'Spark Arc');
          if (chilled) {
            ctx.applyStatusToPlayer('stun', 1);
            return `${line} SUPERCONDUCT — the arc finds the frost in your veins. (Stun, 1 turn)`;
          }
          return line;
        },
      },
      {
        id: 'siphon', label: 'Siphon', weight: 2,
        description: 'Steals 5 MP from you.',
        condition: (ctx) => ctx.player.mp > 0,
        resolve(ctx) {
          const stolen = ctx.drainPlayerMp(5);
          return `${ctx.self.name} drinks your breath of thought. (-${stolen} MP)`;
        },
      },
    ],
  },

  dust_road_raider: {
    id: 'dust_road_raider',
    name: 'Dust-Road Raider',
    level: 8,
    hp: 95, mp: 25, atk: 18, matk: 8, def: 11, mdef: 9, spd: 16,
    attackType: 'pierce',
    affinities: { pierce: 'wk', flame: 'wk', blunt: 'str' },
    xp: 34,
    description: 'Human combatant in layered desert fabrics — answers to no faction.',
    moves: [
      {
        id: 'quick_stride', label: 'Quick Stride', weight: 3,
        description: 'A blindingly fast Pierce attack.',
        resolve(ctx) { return hitPlayer(ctx, 1.1, 'pierce', 'Quick Stride'); },
      },
      {
        id: 'pocket_sand', label: 'Pocket Sand', weight: 2,
        description: 'Reduces your Accuracy by 20% for 2 turns.',
        condition: (ctx) => !ctx.player.statuses.some((s) => s.id === 'blind'),
        resolve(ctx) {
          ctx.applyStatusToPlayer('blind', 2);
          return `${ctx.self.name} flings a fistful of road-dust into your eyes. (Accuracy -30%, 2 turns)`;
        },
      },
    ],
  },

  archive_cipher_wraith: {
    id: 'archive_cipher_wraith',
    name: 'Archive Cipher-Wraith',
    level: 8,
    hp: 80, mp: 60, atk: 9, matk: 17, def: 9, mdef: 15, spd: 12,
    attackType: 'shadow',
    affinities: { sacred: 'wk', slash: 'null', shadow: 'drn' },
    xp: 36,
    description: 'A spectral text that reads you while you fail to read it.',
    moves: [
      {
        id: 'erase_memory', label: 'Erase Memory', weight: 3,
        description: 'Light Shadow damage and drains 8 MP.',
        resolve(ctx) {
          const line = magicHitPlayer(ctx, 1.0, 'shadow', 'Erase Memory');
          const drained = ctx.drainPlayerMp(8);
          return `${line} A page of you goes blank. (-${drained} MP)`;
        },
      },
      {
        id: 'cipher_barrier', label: 'Cipher Barrier', weight: 2,
        description: 'Nullifies the next skill targeted at it.',
        condition: (ctx) => !ctx.self.flags.nullify_next_skill && ctx.turn > 1,
        resolve(ctx) {
          ctx.self.flags.nullify_next_skill = 1;
          return `${ctx.self.name} rewrites itself into unreadable cipher. Your next skill will be erased.`;
        },
      },
    ],
  },

  memory_wraith: {
    id: 'memory_wraith',
    name: 'Memory Wraith',
    level: 8,
    hp: 88, mp: 70, atk: 10, matk: 18, def: 8, mdef: 14, spd: 13,
    attackType: 'shadow',
    affinities: { shadow: 'wk', flame: 'wk', sacred: 'rep', shock: 'drn' },
    xp: 40,
    minResonance: 25,
    description: 'Someone else\'s best day, still hungry.',
    moves: [
      {
        id: 'void_drain', label: 'Void Drain', weight: 3,
        description: 'Shadow damage; drains 10% of your Max MP.',
        resolve(ctx) {
          const line = magicHitPlayer(ctx, 1.1, 'shadow', 'Void Drain');
          const pctDrain = Math.max(1, Math.round(ctx.player.maxMp * 0.1));
          const drained = ctx.drainPlayerMp(pctDrain);
          return `${line} It swallows ${drained} MP whole.`;
        },
      },
      {
        id: 'mind_shatter', label: 'Mind Shatter', weight: 2,
        description: 'Magic attack with a high chance to inflict Confusion.',
        resolve(ctx) {
          const line = magicHitPlayer(ctx, 1.0, 'shadow', 'Mind Shatter');
          if (ctx.rng() < 0.5) {
            ctx.applyStatusToPlayer('confuse', 2);
            return `${line} Your own memories turn on you. (Confusion, 2 turns)`;
          }
          return line;
        },
      },
    ],
  },

  sable_inquisitor: {
    id: 'sable_inquisitor',
    name: 'Sable Inquisitor',
    level: 12,
    hp: 130, mp: 45, atk: 22, matk: 14, def: 15, mdef: 13, spd: 14,
    attackType: 'pierce',
    affinities: { shadow: 'wk', slash: 'wk', sacred: 'null', frost: 'str' },
    xp: 52,
    description: 'Masked Sable elite with flame motifs worked into heavier armor.',
    moves: [
      {
        id: 'judgment_pierce', label: 'Judgment Pierce', weight: 3,
        description: 'Heavy Pierce damage that ignores 30% of your Defense.',
        resolve(ctx) {
          const effDef = ctx.player.def * 0.7;
          const raw = Math.max(5, Math.round((ctx.self.atk - effDef / 2) * 1.4));
          const dmg = ctx.applyDamageToPlayer(raw, 'pierce', `${ctx.self.name} — Judgment Pierce`);
          return `Judgment falls. ${dmg} damage, straight through your guard-work.`;
        },
      },
      {
        id: 'interdict', label: 'Interdict', weight: 2,
        description: 'Prevents you from healing for 2 turns.',
        condition: (ctx) => !ctx.player.statuses.some((s) => s.id === 'heal_block') && ctx.turn > 1,
        resolve(ctx) {
          ctx.applyStatusToPlayer('heal_block', 2);
          return `"Interdict." The Inquisitor's seal closes over you. (Healing blocked, 2 turns)`;
        },
      },
    ],
  },

  ash_mutant: {
    id: 'ash_mutant',
    name: 'Ash Covenant Mutant',
    level: 12,
    hp: 145, mp: 30, atk: 24, matk: 10, def: 13, mdef: 11, spd: 10,
    attackType: 'blunt',
    affinities: { frost: 'wk', pierce: 'wk', flame: 'drn', shock: 'null' },
    xp: 54,
    description: 'Further along the Covenant\'s translation than anyone should be.',
    moves: [
      {
        id: 'mutated_slam', label: 'Mutated Slam', weight: 3,
        description: 'Heavy Blunt damage with a 25% crit rate.',
        resolve(ctx) { return hitPlayer(ctx, 1.3, 'blunt', 'Mutated Slam', { critChance: 0.25 }); },
      },
      {
        id: 'acid_spit', label: 'Acid Spit', weight: 2,
        description: 'Reduces your Defense by 40% for 2 turns.',
        condition: (ctx) => !ctx.player.statuses.some((s) => s.id === 'armour_break'),
        resolve(ctx) {
          ctx.applyStatusToPlayer('armour_break', 2);
          return `${ctx.self.name} retches corrosive ash across your armor. (Defense -50%, 2 turns)`;
        },
      },
    ],
  },

  echo_soldier: {
    id: 'echo_soldier',
    name: 'Dominion Echo-Soldier',
    level: 12,
    hp: 150, mp: 35, atk: 21, matk: 9, def: 17, mdef: 12, spd: 11,
    attackType: 'slash',
    affinities: { sacred: 'wk', blunt: 'wk', slash: 'rep', pierce: 'str' },
    xp: 55,
    description: 'Ancient armored construct — spear and shield, weathered metal.',
    moves: [
      {
        id: 'shield_wall', label: 'Shield Wall', weight: 2,
        description: 'Locks shields — raises Defense on itself and allies.',
        condition: (ctx) => ctx.turn > 1 && !ctx.allies.every((a) => a.statuses.some((s) => s.id === 'defense_up')),
        resolve(ctx) {
          for (const a of [ctx.self, ...ctx.allies]) {
            if (a.hp > 0) a.statuses.push({ id: 'defense_up', stacks: 1, turnsRemaining: 2 });
          }
          return `${ctx.self.name} locks formation. The wall hums. (Allies: Defense +20%, 2 turns)`;
        },
      },
      {
        id: 'counter_stance', label: 'Counter Stance', weight: 2,
        description: 'Reflects incoming attacks for 1 turn.',
        condition: (ctx) => ctx.turn > 1 && !ctx.self.statuses.some((s) => s.id === 'reflection'),
        resolve(ctx) {
          ctx.applyStatusToSelf('reflection', 1);
          return `${ctx.self.name} sets its feet. "Come." (Reflection, 1 turn)`;
        },
      },
      {
        id: 'spear_thrust', label: 'Spear Thrust', weight: 3,
        description: 'Disciplined Pierce attack.',
        resolve(ctx) { return hitPlayer(ctx, 1.05, 'pierce', 'Spear Thrust'); },
      },
    ],
  },

  the_unread: {
    id: 'the_unread',
    name: 'The Unread',
    level: 14,
    hp: 170, mp: 90, atk: 20, matk: 24, def: 14, mdef: 16, spd: 15,
    attackType: 'shadow',
    affinities: { sacred: 'wk', slash: 'null', pierce: 'null', blunt: 'null', shadow: 'drn', flame: 'rep' },
    xp: 80,
    minResonance: 50,
    description: 'Apex predator of the deep stacks. Loom-touched. Wrong silhouette.',
    moves: [
      {
        id: 'page_tear', label: 'Page Tear', weight: 3,
        description: 'True damage — bypasses shields entirely.',
        resolve(ctx) {
          const raw = Math.max(8, Math.round(ctx.self.matk * 0.9));
          const dmg = ctx.applyDamageToPlayer(raw, 'shadow', `${ctx.self.name} — Page Tear`, { bypassGuard: true, guaranteed: true });
          return `It tears a page out of the air — out of you. ${dmg} true damage.`;
        },
      },
      {
        id: 'blank_slate', label: 'Blank Slate', weight: 2,
        description: 'Strips your buffs and drains Momentum.',
        condition: (ctx) => ctx.turn >= 3 && (ctx.player.statuses.length > 0),
        resolve(ctx) {
          ctx.removePlayerBuffs();
          ctx.reducePlayerMomentum(1);
          return `The Unread revises you. Buffs stripped; your momentum smudges.`;
        },
      },
    ],
  },

  // ---- Summons & NPCs ---------------------------------------------------------
  echo_of_hunger: {
    id: 'echo_of_hunger',
    name: 'Echo of Hunger',
    level: 10,
    hp: 60, mp: 20, atk: 18, matk: 6, def: 8, mdef: 8, spd: 13,
    attackType: 'slash',
    affinities: { sacred: 'wk' },
    xp: 20,
    description: 'A shard of appetite wearing your posture.',
    moves: [{
      id: 'gnaw', label: 'Gnaw', weight: 1,
      resolve(ctx) { return hitPlayer(ctx, 1.1, 'slash', 'Gnaw'); },
    }],
  },
  echo_of_emptiness: {
    id: 'echo_of_emptiness',
    name: 'Echo of Emptiness',
    level: 10,
    hp: 65, mp: 30, atk: 10, matk: 18, def: 8, mdef: 10, spd: 12,
    attackType: 'shadow',
    affinities: { sacred: 'wk' },
    xp: 20,
    description: 'A shard of absence shaped like a person-shaped hole.',
    moves: [{
      id: 'hollow_touch', label: 'Hollow Touch', weight: 1,
      resolve(ctx) { return magicHitPlayer(ctx, 1.1, 'shadow', 'Hollow Touch'); },
    }],
  },
  echo_of_harmony: {
    id: 'echo_of_harmony',
    name: 'Echo of Harmony',
    level: 10,
    hp: 70, mp: 40, atk: 14, matk: 14, def: 10, mdef: 12, spd: 12,
    attackType: 'sacred',
    affinities: { shadow: 'wk' },
    xp: 22,
    description: 'A shard of the chord that agreed too easily.',
    moves: [{
      id: 'discord_note', label: 'Dissonant Note', weight: 1,
      resolve(ctx) { return magicHitPlayer(ctx, 1.0, 'sacred', 'Dissonant Note'); },
    }],
  },
  echo_of_cleanliness: {
    id: 'echo_of_cleanliness',
    name: 'Echo of Cleanliness',
    level: 10,
    hp: 68, mp: 35, atk: 15, matk: 12, def: 11, mdef: 11, spd: 12,
    attackType: 'slash',
    affinities: { sacred: 'wk' },
    xp: 22,
    description: 'A shard that cannot abide being touched.',
    moves: [{
      id: 'scrub', label: 'Scrub', weight: 1,
      resolve(ctx) { return hitPlayer(ctx, 1.05, 'slash', 'Scrub'); },
    }],
  },
  sera_voss: {
    id: 'sera_voss',
    name: 'Sera Voss',
    level: 4,
    hp: 90, mp: 30, atk: 14, matk: 8, def: 10, mdef: 9, spd: 13,
    attackType: 'slash',
    affinities: {},
    xp: 0,
    description: 'Expedition fighter — camp-trained, road-hardened.',
    moves: [{
      id: 'camp_knife', label: 'Camp Knife', weight: 1,
      resolve(ctx) { return hitPlayer(ctx, 1.0, 'slash', 'Camp Knife'); },
    }],
  },
};

export const SUMMON_ENEMIES: Record<string, EnemyDef> = {
  echo_of_hunger: ENEMIES.echo_of_hunger,
  echo_of_emptiness: ENEMIES.echo_of_emptiness,
  echo_of_harmony: ENEMIES.echo_of_harmony,
  echo_of_cleanliness: ENEMIES.echo_of_cleanliness,
  sera_voss: ENEMIES.sera_voss,
};

// ============================================================================
// Stage pools — which enemies can appear where (see docs/ENEMY_ROSTER_BY_STAGE.md)
// ============================================================================

export function stageForPage(page: number): number {
  if (page <= 3) return 1;
  if (page <= 7) return 2;
  if (page <= 11) return 3;
  if (page <= 15) return 4;
  return 5;
}

const STAGE_ENEMY_POOLS: string[][] = [
  ['dust_wight', 'echo_skeleton'],
  ['venn_custodian', 'sable_zealot', 'ash_seer'],
  ['dust_road_raider', 'archive_cipher_wraith'],
  ['sable_inquisitor', 'ash_mutant', 'echo_soldier'],
  ['dust_road_raider', 'archive_cipher_wraith', 'sable_inquisitor', 'ash_mutant', 'echo_soldier'],
];

export function stageForEnemy(id: string): number {
  for (let i = 0; i < STAGE_ENEMY_POOLS.length; i++) {
    if (STAGE_ENEMY_POOLS[i].includes(id)) return i + 1;
  }
  return 1;
}

/** Combat pool for a page + Resonance level. */
export function enemiesForPage(page: number, resonance: number): string[] {
  const stage = stageForPage(page);
  const pool = [...STAGE_ENEMY_POOLS[stage - 1]];
  if (stage >= 3 && resonance >= 25) pool.push('memory_wraith');
  if (stage >= 5 && resonance >= 50) pool.push('the_unread');
  return pool;
}

/** Scrubs scripted fights so later-stage enemies never appear early. */
export function sanitizeFightEnemies(enemyIds: string[], page: number, resonance: number): string[] {
  const pool = enemiesForPage(page, resonance);
  return enemyIds.map((id) => (pool.includes(id) || SUMMON_ENEMIES[id] || !ENEMIES[id] ? id : pool[Math.floor(Math.random() * pool.length)]));
}
