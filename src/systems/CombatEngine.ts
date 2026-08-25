import type {
  AffinityKind,
  BossDef,
  CombatState_Enemy,
  CombatState_Player,
  DamageType,
  EnemyAffinities,
  EnemyDef,
  EnemyMoveDef,
  EnemyTurnContext,
  PlayerState,
  StatusId,
  StatusInstance,
} from '@data/types';
import { DAMAGE_TYPES, DAMAGE_TYPE_ABBREV, MAX_EQUIPPED_SKILLS } from '@data/types';
import { ENEMIES, SUMMON_ENEMIES } from '@data/enemies';
import { BOSSES } from '@data/bosses';
import { ITEMS } from '@data/items';
import { NAMED_SKILLS } from '@data/skills';
import { scalingForIndex } from './BoardGenerator';
import { NODES_PER_CHAPTER } from '@/config';
import { resonanceEnemyHpMultiplier, resonanceEnemyAtkMultiplier, resonancePlayerDamageBonus } from './ResonanceSystem';
import {
  applyStatus,
  hasStatus,
  getStatus,
  removeStatus,
  removeAllDebuffs,
  tickDots,
  tickDurations,
  statMultiplier,
} from './StatusEffectSystem';
import { difficultyMods, type DifficultyId, type DifficultyMods } from './combat/DifficultySystem';

// ============================================================================
// THE HOLLOW BENEATH — Revamped combat engine ("Echo" system)
// One action per turn · discrete affinity discovery · Guard +6 MP economy ·
// Down/Stagger on crits/weakness · QTE-timed offense · no AP/fatigue.
// ============================================================================

/**
 * Legacy phase values ('momentum_choice' | 'crisis' | 'fled') are surfaced by
 * snapshots purely for old-UI compatibility; the engine never rests in them.
 */
export type CombatPhase = 'player' | 'victory' | 'defeat' | 'momentum_choice' | 'crisis' | 'fled';
export type QteQuality = 'perfect' | 'good' | 'miss';
export type MomentumChoice =
  | 'flow'
  | 'harmony'
  | 'archive'
  | 'forgotten_technique'
  | 'unravel'
  | 'echo_surge'
  | 'phase_shift'
  | 'desperate_strike'
  | 'overclock';

const MOMENTUM_CHOICES: MomentumChoice[] = [
  'flow', 'harmony', 'archive', 'forgotten_technique',
  'unravel', 'echo_surge', 'phase_shift', 'desperate_strike', 'overclock'
];

const MOMENTUM_CAP = 5;
const BASE_CRIT = 0.1;

const AFFINITY_MULT: Record<AffinityKind, number> = {
  wk: 1.5, str: 0.5, null: 0, rep: 1, drn: 1, '-': 1,
};

export interface CombatSetup {
  player: PlayerState;
  enemyIds: string[];
  /** Node the fight takes place on — drives position-based difficulty scaling. */
  nodeIndex: number;
  rng: () => number;
  bossId?: string;
  /** @deprecated legacy callers pass the boss definition object directly. */
  bossDef?: BossDef;
  precombatFlags?: Record<string, number>;
  playerHistory?: Set<string>;
  difficulty?: DifficultyId;
  /** Persisted Bestiary discoveries keyed by enemy def id. */
  discoveredAffinities?: Record<string, EnemyAffinities>;
  /** @deprecated archive system removed — ignored. */
  enemyArchive?: unknown;
}

export interface EnemyView {
  key: string;
  defId: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  isBoss: boolean;
  statuses: StatusInstance[];
  /** Discovered slots only — unknown affinities are omitted. */
  affinities: EnemyAffinities;
  knownSlots: DamageType[];
  pendingChargeLabel?: string;

  // ---- Legacy UI fields (revamp compat; populated from new systems) ----
  /** True once at least one affinity slot has been discovered. */
  revealed: boolean;
  revealCount: number;
  /** 0 = unknown foe, 1 = some slots mapped (Scan-lite). */
  investigationLayer: number;
  investigationProbes: string[];
  tendency?: string;
  weakWindowTurns?: number;
  weakHitStreak?: number;
  lastHitType?: DamageType;
  archiveExploited: boolean;
  row?: 'front' | 'middle' | 'back';
  comboBanner?: string;
  reactionBanner?: string;
  pendingIntent?: { id: string; label: string; confidence: number; charged?: boolean } | null;
}

export interface CombatSnapshot {
  round: number;
  phase: CombatPhase;
  actionUsed: boolean;
  oneMore: boolean;
  /** @deprecated AP system removed — fixed dock for old-UI compat (2 while able to act). */
  playerAP: number;
  /** @deprecated AP system removed. */
  bankedAP: number;
  /** @deprecated AP system removed. */
  apPenalty: number;
  apPenaltyLabel?: string;
  /** @deprecated AP system removed. */
  freeActionCharges: number;
  playerHP: number;
  playerMaxHP: number;
  playerMP: number;
  playerMaxMP: number;
  playerSpd: number;
  playerStatuses: StatusInstance[];
  momentum: number;
  momentumReady: boolean;
  /** Situational momentum offers (only meaningful while phase === 'momentum_choice'). */
  momentumChoices: MomentumChoice[];
  guarding: boolean;
  /** @deprecated fatigue system removed. */
  fatigue: number;
  /** @deprecated insight system removed. */
  insight: number;
  /** @deprecated allies system removed — empty for old-UI compat. */
  allies: Array<{ id: string; name: string; loyalty?: number }>;
  /** @deprecated crisis system removed. */
  pendingCrisis?: never;
  /** @deprecated bravery system removed. */
  fear: number;
  /** @deprecated resonance duplication. */
  playerResonance: number;
  enemies: EnemyView[];
  turnOrder: string[];
  lastActors: string[];
  log: string[];
  /** @deprecated battlefield states removed. */
  battlefieldState?: { id: string; label: string; turns: number } | null;
  /** @deprecated positioning system removed. */
  playerRow?: string;
  /** Per-enemy damage dealt during the enemy phase (old HUD tween source). */
  enemyPhaseDamage: Record<string, number>;
  banners: string[];
  bossPhaseLabel?: string;
  difficulty: DifficultyId;
  qte: { targetKey: string; kind: 'attack' | 'skill'; skillId?: string; slowed: boolean } | null;
}

interface InternalPlayer {
  hp: number; maxHp: number; mp: number; maxMp: number;
  atk: number; matk: number; def: number; mdef: number;
  spd: number; accuracy: number; dodge: number;
  statuses: StatusInstance[];
  guarding: boolean;
}

interface InternalEnemy {
  key: string;
  defId: string;
  name: string;
  level: number;
  hp: number; maxHp: number; mp: number; maxMp: number;
  atk: number; matk: number; def: number; mdef: number;
  spd: number; accuracy: number; dodge: number;
  statuses: StatusInstance[];
  affinities: EnemyAffinities;
  known: Set<DamageType>;
  xp: number;
  flags: Record<string, number>;
  isBoss: boolean;
  moves: EnemyMoveDef[];
  pendingChargeMoveId?: string;
  killCounted?: boolean;
}

const MAGIC_TYPES: DamageType[] = ['flame', 'frost', 'shock', 'sacred', 'shadow'];
const BUFF_IDS = ['focus', 'barrier', 'regeneration', 'fortify', 'blessing', 'haste', 'reflection', 'brace', 'echo_surge', 'atk_up', 'defense_up'];

function isDotStatus(id: StatusId): boolean {
  return ['poison', 'burn', 'bleed', 'curse', 'frostbite', 'shock_dot'].includes(id);
}

/** Synthesize a regular-enemy view of a boss so move machinery stays uniform. */
function bossToEnemyDef(boss: BossDef): EnemyDef {
  const b = boss.baseStats;
  return {
    id: boss.id,
    name: boss.name,
    level: boss.level,
    hp: b.hp,
    mp: b.mp ?? 50,
    atk: b.atk,
    matk: b.matk,
    def: b.def,
    mdef: b.mdef,
    spd: b.spd,
    attackType: 'slash',
    affinities: {},
    xp: 0,
    description: boss.theme,
    moves: boss.moves,
  };
}

export class CombatEngine {
  private rng: () => number;
  /** Cached situational momentum offers (stable across refreshes within one momentum phase). */
  private cachedOffers?: MomentumChoice[];
  private diffId: DifficultyId;
  private diff: DifficultyMods;

  private playerStateRef: PlayerState;
  private player: InternalPlayer;
  private equippedSkills: string[];

  private enemies: InternalEnemy[] = [];
  private bossDef?: BossDef;
  private bossKey?: string;
  private bossPhaseKey = '';
  private precombatFlags: Record<string, number>;

  private round = 0;
  private phase: CombatPhase = 'player';
  private actionUsed = false;
  private oneMore = false;
  private momentum = 0;
  private turnOrder: string[] = [];
  private log: string[] = [];

  // Per-turn / per-combat combat state
  private pendingQte: { kind: 'attack' | 'skill'; targetKey: string; skillId?: string } | null = null;
  private bannersQueue: string[] = [];
  private heavyUsedThisRound = false;
  private firstSkillUsed = false;
  private firstAttackUsed = false;
  private lastHitTypes = new Map<string, DamageType>();
  private unravelPending = false;
  private nextSkillFreeMp = false;
  private echoSurgeTurns = 0;
  private dodgeCharges = 0;
  private critAllTurn = false;
  private overclockActive = false;
  private discoveryGains: Record<string, Partial<Record<DamageType, AffinityKind>>> = {};
  private killedCount = 0;
  private xpEarned = 0;
  private deathWarded = false;
  private secondWindFired = false;
  private lastAttackerKey?: string;
  private resDmgBonus: number;
  private deadDefIds: string[] = [];
  /** Enemy keys that acted during the most recent enemy phase (drives UI rotation). */
  private lastRoundActors: string[] = [];
  /** Damage each enemy dealt during the most recent enemy phase (drives UI damage beats). */
  private phaseDamage: Record<string, number> = {};
  // ---- Living-depth systems (adaptation, gambit, battlefield) ----------------
  private playerTypeTally: Partial<Record<DamageType, number>> = {};
  private bossAdapt?: { type: DamageType; until: number; original: AffinityKind };
  private harmonyRage?: { atk: number; matk: number };
  private harmonyEnrageUntil = 0;
  private gambitFired = false;
  private revelationFired = false;
  private battlefieldState?: { id: string; label: string; turns: number };

  constructor(setup: CombatSetup) {
    this.rng = setup.rng;
    this.diffId = setup.difficulty ?? 'normal';
    this.diff = difficultyMods(this.diffId);
    this.resDmgBonus = resonancePlayerDamageBonus(setup.player.resonance);
    this.playerStateRef = setup.player;
    this.equippedSkills = [...setup.player.equippedSkills].slice(0, MAX_EQUIPPED_SKILLS);
    this.precombatFlags = { ...(setup.precombatFlags ?? {}) };

    const d = setup.player.derived;
    this.player = {
      hp: setup.player.currentHP,
      maxHp: d.maxHP,
      mp: setup.player.currentMP,
      maxMp: d.maxMP,
      atk: d.attack,
      matk: d.magicAttack,
      def: Math.round(d.defense * (this.hasPassive('bulwark_stance') ? 1.15 : 1)),
      mdef: d.magicDefense,
      spd: d.speed + (this.hasPassive('quickstep') ? 5 : 0),
      accuracy: Math.min(95, d.accuracy + (this.hasPassive('steady_hands') ? 10 : 0)),
      dodge: Math.min(50, d.dodge + (this.hasPassive('chorus_step') ? 10 : 0)),
      statuses: [],
      guarding: false,
    };

    this.momentum = Math.min(MOMENTUM_CAP, setup.player.momentum);
    if (this.hasPassive('chorus_echo')) this.momentum = Math.min(MOMENTUM_CAP, this.momentum + 1);

    const rawScale = scalingForIndex(Math.max(1, setup.nodeIndex));
    const resHp = resonanceEnemyHpMultiplier(setup.player.resonance);
    const resAtk = resonanceEnemyAtkMultiplier(setup.player.resonance);
    // New Game+: the Beneath remembers you, and leans in.
    const ngPlus = !!setup.player.flags.ng_plus;
    const scale = {
      hp: rawScale.hp * (ngPlus ? 1.25 : 1),
      atk: rawScale.atk * (ngPlus ? 1.2 : 1),
      def: rawScale.def * (ngPlus ? 1.15 : 1),
    };
    if (ngPlus) this.log.push('NEW GAME+ — the Beneath remembers you, and does not pretend otherwise.');

    if (setup.bossId || setup.bossDef) {
      const boss = setup.bossDef ?? BOSSES[setup.bossId!];
      if (!boss) throw new Error(`Unknown boss id: ${setup.bossId}`);
      this.bossDef = boss;
      const e = this.buildEnemy(bossToEnemyDef(boss), setup.precombatFlags, true, scale, resHp, resAtk);
      this.enemies.push(e);
      this.bossKey = e.key;
      this.updateBossPhase(e);
    }
    for (const id of setup.enemyIds) {
      const def = ENEMIES[id] ?? SUMMON_ENEMIES[id];
      if (!def) continue;
      this.enemies.push(this.buildEnemy(def, setup.precombatFlags, false, scale, resHp, resAtk));
    }

    // Merge persisted discoveries into working copies.
    const persisted = setup.discoveredAffinities ?? {};
    for (const e of this.enemies) {
      const known = persisted[e.defId];
      if (!known) continue;
      for (const [type, kind] of Object.entries(known) as [DamageType, AffinityKind][]) {
        e.known.add(type);
        e.affinities[type] = kind;
      }
    }

    // True Sight unlock: two random truths surface unasked per foe.
    if (setup.player.flags.true_sight) {
      for (const e of this.enemies) {
        const unknown = DAMAGE_TYPES.filter((t) => !e.known.has(t));
        for (let i = 0; i < 2 && unknown.length > 0; i++) {
          const idx = Math.floor(this.rng() * unknown.length);
          this.discoverAffinity(e, unknown.splice(idx, 1)[0]);
        }
      }
      if (this.enemies.length > 0) this.log.push('True Sight — the veil thins before the fight begins.');
    }

    // Battlefield states: deep-strata weather that reshapes every exchange.
    if (!setup.bossId && !setup.bossDef && setup.nodeIndex >= 81 && this.rng() < 0.25) {
      const id = this.rng() < 0.5 ? 'dust_storm' : 'sacred_ground';
      this.battlefieldState = { id, label: id === 'dust_storm' ? 'Dust Storm' : 'Sacred Ground', turns: 99 };
      this.log.push(id === 'dust_storm'
        ? 'DUST STORM — grit fouls every aim. (-10% accuracy)'
        : 'SACRED GROUND — hallowed light seeps up through the stone. (Sacred +20%)');
    }

    this.buildTurnOrder();
    this.log.push('The fight begins.');
  }

  private hasPassive(id: string): boolean {
    return this.playerStateRef.skillsKnown.includes(id);
  }

  private buildEnemy(
    base: EnemyDef,
    preflags: Record<string, number> | undefined,
    isBoss: boolean,
    scale: { hp: number; atk: number; def: number },
    resHp: number,
    resAtk: number,
  ): InternalEnemy {
    let hpMult = scale.hp * resHp * this.diff.enemyHpMult;
    if (isBoss && (preflags?.fossilProvoked ?? 0) === 1) hpMult *= 0.9;
    // Temporary balance pass: bosses overshoot in the one-action model —
    // tune them down ~15% until per-boss balance is revisited.
    const bossNerf = isBoss ? { hp: 0.85, atk: 0.85, def: 0.9 } : { hp: 1, atk: 1, def: 1 };
    if (isBoss) hpMult *= bossNerf.hp;
    const hp = Math.max(1, Math.round(base.hp * hpMult));
    const mp = Math.round((base.mp ?? 20) * scale.hp);
    return {
      key: `${base.id}_${Math.floor(this.rng() * 1e9).toString(36)}`,
      defId: base.id,
      name: base.name,
      level: base.level,
      hp,
      maxHp: hp,
      mp,
      maxMp: mp,
      atk: Math.round(base.atk * scale.atk * resAtk * this.diff.enemyAtkMult * bossNerf.atk),
      matk: Math.round(base.matk * scale.atk * resAtk * this.diff.enemyAtkMult * bossNerf.atk),
      def: Math.max(0, Math.round(base.def * scale.def * this.diff.enemyDefMult * bossNerf.def)),
      mdef: Math.max(0, Math.round(base.mdef * scale.def * this.diff.enemyDefMult * bossNerf.def)),
      spd: base.spd,
      accuracy: base.accuracy ?? 80,
      dodge: base.dodge ?? 8,
      statuses: [],
      affinities: { ...base.affinities },
      known: new Set(),
      xp: Math.round((base.xp || 12) * scale.hp),
      flags: { ...(preflags ?? {}) },
      isBoss,
      moves: base.moves,
    };
  }

  private aliveEnemies(): InternalEnemy[] {
    return this.enemies.filter((e) => e.hp > 0);
  }

  private aliveByKey(key: string): InternalEnemy | undefined {
    return this.enemies.find((e) => e.key === key && e.hp > 0);
  }

  private getEnemy(key: string): InternalEnemy | undefined {
    return this.enemies.find((e) => e.key === key);
  }

  private buildTurnOrder(): void {
    // Initiative order includes the player so the turn-order panel can list everyone;
    // the enemy-phase loop skips the player key (it resolves to no enemy).
    const entries: Array<{ key: string; spd: number }> = [
      { key: 'player', spd: this.player.spd },
      ...this.aliveEnemies().map((e) => ({ key: e.key, spd: e.spd })),
    ];
    entries.sort((a, b) => b.spd - a.spd);
    this.turnOrder = entries.map((e) => e.key);
  }

  // ============================ Round flow ============================

  beginRound(): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    this.round++;
    this.actionUsed = false;
    this.oneMore = false;
    this.heavyUsedThisRound = false;
    this.critAllTurn = false;

    // Guard expires at the start of your next round (it covered the enemy phase).
    this.player.guarding = false;
    removeStatus(this.player.statuses, 'brace');

    // Boss phase transitions
    if (this.bossDef && this.bossKey) {
      const boss = this.getEnemy(this.bossKey);
      if (boss && boss.hp > 0) this.updateBossPhase(boss);
    }

    // Player start-of-round upkeep
    const dots = tickDots(this.player.statuses);
    if (dots.damage > 0) {
      this.player.hp = Math.max(0, this.player.hp - dots.damage);
      for (const l of dots.lines) this.log.push(l);
    }
    if (hasStatus(this.player.statuses, 'regeneration')) {
      const heal = Math.round(this.player.maxHp * 0.05);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      this.log.push(`Regeneration restores ${heal} HP.`);
    }
    if (this.echoSurgeTurns > 0) this.echoSurgeTurns--;
    if (this.dodgeCharges > 0) this.dodgeCharges = Math.max(0, this.dodgeCharges - 1);

    if (
      !this.secondWindFired &&
      this.hasPassive('second_wind') &&
      this.player.hp > 0 &&
      this.player.hp / this.player.maxHp < 0.25 &&
      this.phase === 'player'
    ) {
      this.secondWindFired = true;
      const heal = Math.round(this.player.maxHp * 0.15);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      this.log.push(`SECOND WIND — you refuse to fall. (+${heal} HP)`);
    }

    if (this.player.hp <= 0) this.onPlayerDown();
    for (const msg of tickDurations(this.player.statuses)) this.log.push(msg);

    return this.snapshot();
  }

  // ============================ Player actions ============================

  attack(targetKey?: string, qteQuality?: QteQuality): CombatSnapshot {
    if (this.blocked()) return this.snapshot();
    const key = targetKey ?? this.aliveEnemies()[0]?.key;
    if (!key) return this.snapshot();
    const target = this.aliveByKey(key);
    if (!target) return this.snapshot();

    // Basic attacks have NO timing bar (skills only): resolve immediately as a
// plain swing — standard accuracy roll, ×1.0 power, no crit bonus.
    this.pendingQte = null;
    this.consumeAction();

    let power = 1.0;
    if (qteQuality === 'perfect') power *= 1.3;
    else if (qteQuality === 'miss') power *= 0.8;
    if (this.overclockActive) power *= 1.7;
    if (!this.firstAttackUsed) {
      this.firstAttackUsed = true;
      if (this.hasPassive('opening_strike')) power *= 1.2;
    }

    const weaponType: DamageType = this.playerStateRef.equipment.weapon === 'rusty_dagger' ? 'pierce' : 'slash';
    this.strike(target, 'atk', weaponType, power, 'Attack', {
      qte: qteQuality,
      critBonus: qteQuality === 'perfect' ? 0.35 : 0,
      guaranteed: qteQuality !== undefined,
    });
    this.afterAction();
    return this.snapshot();
  }

  useSkill(skillId: string, targetKey?: string, qteQuality?: QteQuality): CombatSnapshot {
    if (this.blocked()) return this.snapshot();

    const skill = NAMED_SKILLS[skillId];
    if (!skill || !this.equippedSkills.includes(skillId)) return this.snapshot();

    // Identity Erasure disable flags
    for (const e of this.enemies) {
      if ((e.flags[`disable_${skillId}`] ?? 0) > this.round) {
        this.log.push(`${skill.name} has been erased from your memory.`);
        return this.snapshot();
      }
    }

    // Costs
    const freeMp = this.nextSkillFreeMp;
    const mpCost = freeMp ? 0 : skill.mpCost ?? 0;
    if (mpCost > this.player.mp) {
      this.log.push(`Not enough MP for ${skill.name}.`);
      return this.snapshot();
    }
    const hpFlat = skill.hpCost?.flat ?? 0;
    const hpPct = skill.hpCost?.pct ? Math.max(1, Math.round((skill.hpCost.pct / 100) * this.player.maxHp)) : 0;
    if (hpFlat >= this.player.hp || hpPct >= this.player.hp) {
      this.log.push(`Not enough HP for ${skill.name}.`);
      return this.snapshot();
    }

    // Skills may declare damage via top-level fields (damageType/skillPower/stat/target)
    // OR via an explicit 'damage' effect entry. Synthesize the implicit entry so both
    // authoring styles route through the same strike pipeline.
    const implicitDamage: Array<{ kind: 'damage'; type: DamageType; power: number; stat: 'atk' | 'magic'; target: 'single' | 'all'; guaranteed?: boolean }> =
      skill.damageType && skill.skillPower
        ? [{
            kind: 'damage',
            type: skill.damageType as DamageType,
            power: skill.skillPower!,
            stat: skill.stat ?? (MAGIC_TYPES.includes(skill.damageType) ? 'magic' : 'atk'),
            target: skill.target ?? 'single',
            guaranteed: skill.guaranteed,
          }]
        : [];
    const damageFx = skill.effects?.find((fx) => fx.kind === 'damage');
    const offensive = !!damageFx || implicitDamage.length > 0;
    if (offensive && qteQuality === undefined) {
      const target = targetKey ? this.aliveByKey(targetKey) : this.aliveEnemies()[0];
      if (!target) return this.snapshot();
      this.pendingQte = { kind: 'skill', targetKey: target.key, skillId };
      return this.snapshot();
    }

    this.pendingQte = null;
    this.consumeAction();

    // Pay costs
    this.nextSkillFreeMp = false;
    this.player.mp -= mpCost;
    if (hpFlat) this.player.hp -= hpFlat;
    if (hpPct) this.player.hp -= hpPct;

    if (!this.firstSkillUsed) {
      this.firstSkillUsed = true;
      this.gainMomentum(1);
    }
    if (skill.id === 'cleanse_surge' || skill.id === 'echo_ward') removeAllDebuffs(this.player.statuses);

    const allEffects = [...implicitDamage, ...(skill.effects ?? [])] as NonNullable<typeof skill.effects>;
    const primaryTarget = allEffects.some((fx) => fx.kind === 'damage' && fx.target === 'all')
      ? undefined
      : (targetKey ? this.aliveByKey(targetKey) : this.aliveEnemies()[0]);

    for (const fx of allEffects) {
      switch (fx.kind) {
        case 'damage': {
          const stat: 'atk' | 'matk' = fx.stat === 'magic' ? 'matk' : 'atk';
          const targets = fx.target === 'all' ? this.aliveEnemies() : primaryTarget ? [primaryTarget] : [];
          for (const t of targets) {
            const qtePower = qteQuality === 'perfect' ? 1.3 : qteQuality === 'miss' ? 0.8 : 1.0;
            this.strike(t, stat, fx.type, fx.power * qtePower, skill.name, {
              qte: qteQuality,
              guaranteed: fx.guaranteed || qteQuality !== undefined,
              critBonus: (skill.critChanceBonus ?? 0) + (qteQuality === 'perfect' ? 0.35 : 0),
            });
          }
          break;
        }
        case 'status': {
          const targets = fx.target === 'all' ? this.aliveEnemies() : primaryTarget ? [primaryTarget] : [];
          for (const t of targets) applyStatus(t.statuses, fx.id, fx.turns, fx.stacks ?? 1);
          break;
        }
        case 'buff':
          applyStatus(this.player.statuses, fx.id, fx.turns, fx.stacks ?? 1);
          break;
        case 'heal': {
          if (hasStatus(this.player.statuses, 'heal_block')) {
            this.log.push('Healing is Interdicted!');
            break;
          }
          const amt = fx.pct ? Math.round((fx.pct / 100) * this.player.maxHp) : fx.flat ?? 0;
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + amt);
          this.log.push(`${skill.name} restores ${amt} HP.`);
          break;
        }
        case 'barrier': {
          const amount = Math.round((fx.pct / 100) * this.player.maxHp);
          setBarrierSafe(this.player.statuses, amount);
          this.log.push(`${skill.name} raises a shield (${amount}).`);
          break;
        }
        case 'resource':
          if (fx.mp) this.player.mp = Math.min(this.player.maxMp, this.player.mp + fx.mp);
          break;
        case 'reveal_all_affinities': {
          for (const e of this.aliveEnemies()) {
            for (const t of DAMAGE_TYPES) this.discoverAffinity(e, t);
          }
          this.bannersQueue.push('FULL KNOWLEDGE');
          break;
        }
        default:
          break;
      }
    }
    this.afterAction();
    return this.snapshot();
  }

  guard(): CombatSnapshot {
    if (this.blocked()) return this.snapshot();
    this.consumeAction();
    this.player.guarding = true;
    const blockPct = this.hasPassive('iron_resolve') ? 65 : 50;
    this.player.statuses.push({ id: 'brace', stacks: 1, turnsRemaining: 99, meta: { blockPct } });
    this.player.mp = Math.min(this.player.maxMp, this.player.mp + 6);
    this.gainMomentum(1);
    this.log.push(`You raise your guard. (+6 MP, blocks Stagger)`);
    this.afterAction();
    return this.snapshot();
  }

  useItem(itemId: string): CombatSnapshot {
    if (this.blocked()) return this.snapshot();
    const item = ITEMS[itemId];
    if (!item?.effect) return this.snapshot();
    this.consumeAction();

    const fx = item.effect;
    let acted = false;
    if (fx.healPercent) {
      if (hasStatus(this.player.statuses, 'heal_block')) {
        this.log.push('Healing is Interdicted!');
      } else {
        const heal = Math.round((fx.healPercent / 100) * this.player.maxHp);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        this.log.push(`${item.name} restores ${heal} HP.`);
      }
      acted = true;
    }
    if (fx.healMpPercent) {
      const heal = Math.round((fx.healMpPercent / 100) * this.player.maxMp);
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + heal);
      this.log.push(`${item.name} restores ${heal} MP.`);
      acted = true;
    }
    if (fx.cureAll) {
      this.player.statuses = this.player.statuses.filter((s) => s.id === 'brace');
      this.log.push(`${item.name} cleanses everything.`);
      acted = true;
    } else if (fx.cureStatus) {
      for (const id of fx.cureStatus) removeStatus(this.player.statuses, id);
      this.log.push('You cleanse your ailments.');
      acted = true;
    }
    void acted;
    this.afterAction();
    return this.snapshot();
  }

  endTurn(): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    this.pendingQte = null;
    this.resolveEnemyPhase();
    if (this.phase !== 'player') return this.snapshot();
    return this.beginRound();
  }

  resolveQte(quality: QteQuality): CombatSnapshot {
    const p = this.pendingQte;
    if (!p) return this.snapshot();
    if (p.kind === 'attack') return this.attack(p.targetKey, quality);
    return this.useSkill(p.skillId!, p.targetKey, quality);
  }

  resolveMomentum(choice: MomentumChoice): CombatSnapshot {
    this.cachedOffers = undefined;
    if (choice === 'flow') {
      if (this.momentum < MOMENTUM_CAP) return this.snapshot();
      this.momentum = 0;
      this.oneMore = true;
      applyStatus(this.player.statuses, 'exhausted', 1);
      this.bannersQueue.push('FLOW — one more action!');
      return this.snapshot();
    }
    if (this.momentum < MOMENTUM_CAP) return this.snapshot();
    this.momentum = 0;
    switch (choice) {
      case 'harmony': {
        const heal = Math.round(this.player.maxHp * 0.25);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        const boss = this.bossKey ? this.aliveByKey(this.bossKey) : undefined;
        if (boss) {
          this.harmonyRage = { atk: boss.atk, matk: boss.matk };
          boss.atk = Math.round(boss.atk * 1.3);
          boss.matk = Math.round(boss.matk * 1.3);
          this.harmonyEnrageUntil = this.round + 2;
          this.log.push(`HARMONY — you recover ${heal} HP. ${boss.name} ENRAGES (+30%, 2 turns).`);
        } else {
          this.log.push(`HARMONY — you recover ${heal} HP.`);
        }
        break;
      }
      case 'archive': {
        const label = this.currentPhaseLabel();
        if (label) {
          this.log.push(`ARCHIVE — you recall its shape: ${label}.`);
        } else {
          const heal = Math.round(this.player.maxHp * 0.1);
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
          this.log.push(`ARCHIVE — insight steadies you (+${heal} HP).`);
        }
        break;
      }
      case 'forgotten_technique':
        this.nextSkillFreeMp = true;
        this.bannersQueue.push('FORGOTTEN TECHNIQUE — next skill costs 0 MP!');
        break;
      case 'unravel':
        this.unravelPending = true;
        this.bannersQueue.push('UNRAVEL — next hit ×2.5, ignores 75% DEF!');
        break;
      case 'echo_surge':
        this.echoSurgeTurns = 3;
        this.bannersQueue.push('ECHO SURGE — damage +20% for 3 turns!');
        break;
      case 'phase_shift':
        this.dodgeCharges = 2;
        this.bannersQueue.push('PHASE SHIFT — you will slip the next 2 attacks!');
        break;
      case 'desperate_strike':
        this.critAllTurn = true;
        this.bannersQueue.push('DESPERATE STRIKE — every blow crits this turn!');
        break;
      case 'overclock': {
        const loss = Math.max(1, Math.round(this.player.maxHp * 0.2));
        this.player.hp = Math.max(1, this.player.hp - loss);
        this.overclockActive = true;
        this.bannersQueue.push('OVERCLOCK — +70% damage this turn!');
        break;
      }
    }
    return this.snapshot();
  }

  // ============================ Strike resolution ============================

  private strike(
    target: InternalEnemy,
    stat: 'atk' | 'matk',
    type: DamageType,
    power: number,
    label: string,
    opts: { guaranteed?: boolean; critBonus?: number; qte?: QteQuality } = {},
  ): void {
    if (target.hp <= 0) return;
    this.lastAttackerKey = undefined;

    // Confusion: motor control, not aim — even a timed strike can wander.
    if (hasStatus(this.player.statuses, 'confuse') && this.rng() < 0.3) {
      this.log.push('Confusion — your strike wanders wide of anything real.');
      return;
    }

    // Cipher Barrier negates the next skill
    if ((target.flags.nullify_next_skill ?? 0) === 1 && label !== 'Attack') {
      target.flags.nullify_next_skill = 0;
      this.log.push(`${target.name}'s cipher rewrites itself — ${label} is erased.`);
      return;
    }

    // Phase Shift dodge charges
    if (this.dodgeCharges > 0 && !opts.guaranteed) {
      this.dodgeCharges--;
      this.log.push(`You are not where you were. (${label} slips past nothing.)`);
      return;
    }

    // Hit roll: any resolved QTE timing connects (a missed window just lands at
    // reduced power); un-timed strikes use the standard accuracy roll.
    if (!opts.guaranteed && !opts.qte) {
      const blind = hasStatus(this.player.statuses, 'blind') ? 30 : 0;
      const storm = this.battlefieldState?.id === 'dust_storm' ? 10 : 0;
      const chance = Math.max(15, Math.min(95, this.player.accuracy - blind - storm - target.dodge));
      if (this.rng() * 100 > chance) {
        this.log.push(`${label} misses ${target.name}.`);
        this.momentum = 0;
        return;
      }
    }

    // Affinity discovery
    const kind = this.discoverAffinity(target, type);
    this.playerTypeTally[type] = (this.playerTypeTally[type] ?? 0) + 1;

    // Null short-circuit
    if (kind === 'null') {
      this.log.push(`${target.name} NULLIFIES ${label}. (0 damage)`);
      return;
    }

    // Reactions (marker-based)
    const reactionMult = this.checkReaction(target, type);

    // Raw damage
    const magic = stat === 'matk' || MAGIC_TYPES.includes(type);
    const source = magic ? this.player.matk : this.player.atk;
    let effDef = magic ? target.mdef : target.def;
    effDef = Math.round(effDef * statMultiplier(target.statuses, magic ? 'mdef' : 'def'));
    if (this.unravelPending) effDef = Math.round(effDef * 0.25);

    let mult = AFFINITY_MULT[kind];
    if (kind !== 'wk' && reactionMult !== 1) mult *= reactionMult;
    else if (reactionMult !== 1) mult *= reactionMult;

    if (type === 'shadow' && this.hasPassive('loom_touched')) mult *= 1.3;
    if (type === 'shadow' && this.hasPassive('parting_words') && target.hp / target.maxHp < 0.3) mult *= 1.4;
    if (this.resDmgBonus > 1 && !target.isBoss) mult *= this.resDmgBonus;
    if (this.echoSurgeTurns > 0) mult *= 1.2;
    if (this.overclockActive) mult *= 1.7;
    if (hasStatus(this.player.statuses, 'exhausted')) mult *= 0.75;
    if (type === 'sacred' && this.battlefieldState?.id === 'sacred_ground') mult *= 1.2;
    if (this.unravelPending) mult *= 2.5;

    let dmg = Math.max(3, Math.round(source - effDef / 2));
    dmg = Math.max(3, Math.round(dmg * power * mult * (0.9 + this.rng() * 0.2)));
    dmg = Math.round(dmg * this.diff.playerDmgMult);

    // Desperate Gambit — once per fight, below a quarter health, the blow lands
    // like it is the last one you have.
    if (!this.gambitFired && this.player.hp <= this.player.maxHp * 0.25) {
      this.gambitFired = true;
      dmg = Math.round(dmg * 1.5);
      this.log.push('DESPERATE GAMBIT — cornered, you swing past your own limit!');
      this.bannersQueue.push('DESPERATE GAMBIT! ×1.5');
    }

    // Crit
    let critChance = BASE_CRIT + (opts.critBonus ?? 0);
    if (this.critAllTurn) critChance = 1;
    const crit = this.rng() < critChance;
    if (crit) dmg = Math.round(dmg * 1.5);

    // Counter Stance (enemy-side reflection status) — null/drain paths already returned.
    if (hasStatus(target.statuses, 'reflection')) {
      removeStatus(target.statuses, 'reflection');
      const back = Math.max(1, Math.round(dmg * 0.6));
      this.log.push(`${target.name}'s counter-stance turns ${label} back on you! (${back})`);
      this.damagePlayer(back, type, `${target.name} — Counter`, { guaranteed: true });
      return;
    }

    // Reflect
    if (kind === 'rep') {
      const back = Math.max(1, Math.round(dmg * 0.6));
      this.log.push(`REFLECT! ${label} turns back on you.`);
      this.damagePlayer(back, type, `${target.name}'s reflection`, { guaranteed: true });
      return;
    }

    // Drain
    if (kind === 'drn') {
      const healed = Math.max(1, Math.round(dmg * 0.75));
      target.hp = Math.min(target.maxHp, target.hp + healed);
      this.log.push(`DRAIN — ${target.name} drinks ${label} and recovers ${healed} HP.`);
      return;
    }

    // Weakness → Downed + 1-More — only when the strike connected meaningfully AND
    // the target wasn't already Downed (no chaining extra turns off a downed foe).
    if (kind === 'wk' && opts.qte !== 'miss' && !hasStatus(target.statuses, 'downed')) {
      applyStatus(target.statuses, 'downed', 2);
      this.oneMore = true;
      this.gainMomentum(1);
      this.bannersQueue.push('WEAKNESS! DOWNED! 1-MORE!');
    }

    target.hp -= dmg;
    this.lastHitTypes.set(target.key, type);
    this.log.push(`${label}${crit ? ' — CRITICAL!' : ''} hits ${target.name} for ${dmg}.`);
    if (crit) this.gainMomentum(1);

    if (target.hp <= 0) this.killEnemy(target);
  }

  private checkReaction(target: InternalEnemy, incoming: DamageType): number {
    if (incoming === 'shock' && hasStatus(target.statuses, 'chilled')) {
      removeStatus(target.statuses, 'chilled');
      applyStatus(target.statuses, 'stun', 1);
      this.log.push('BRITTLE FROST! The arc finds the frost. (Stun)');
      this.bannersQueue.push('BRITTLE FROST!');
      return 1.25;
    }
    if (incoming === 'shadow' && hasStatus(target.statuses, 'sacred_mark')) {
      removeStatus(target.statuses, 'sacred_mark');
      target.statuses = target.statuses.filter((s) => !BUFF_IDS.includes(s.id));
      this.log.push('ECLIPSE! The mark devours its light.');
      this.bannersQueue.push('ECLIPSE! ×2');
      return 2.0;
    }
    if (incoming === 'flame' && hasStatus(target.statuses, 'shock_dot')) {
      removeStatus(target.statuses, 'shock_dot');
      this.log.push('OVERCHARGE! The lingering charge detonates.');
      this.bannersQueue.push('OVERCHARGE!');
      return 1.3;
    }
    return 1;
  }

  private discoverAffinity(target: InternalEnemy, type: DamageType): AffinityKind {
    if (!target.known.has(type)) {
      target.known.add(type);
      const kind = target.affinities[type] ?? '-';
      if (!this.discoveryGains[target.defId]) this.discoveryGains[target.defId] = {};
      this.discoveryGains[target.defId][type] = kind;
      // Revelation — first fresh weakness read on a boss feeds Momentum.
      if (kind === 'wk' && target.isBoss && !this.revelationFired) {
        this.revelationFired = true;
        this.gainMomentum(1);
        this.bannersQueue.push('REVELATION! (+1 Momentum)');
      }
    }
    return target.affinities[type] ?? '-';
  }

  private killEnemy(e: InternalEnemy): void {
    e.hp = 0;
    if (!e.killCounted) {
      e.killCounted = true;
      this.killedCount++;
      this.xpEarned += e.xp;
      this.deadDefIds.push(e.defId);
    }
    if (e.pendingChargeMoveId) e.flags.ultimateCharging = 1;
    this.gainMomentum(1);
    this.log.push(`${e.name} falls!`);
    this.buildTurnOrder();
    if (this.aliveEnemies().length === 0) this.phase = 'victory';
  }

  // ============================ Enemy phase ============================

  private resolveEnemyPhase(): void {
    const acted: string[] = [];
    this.phaseDamage = {};

    // Harmony enrage expiry
    if (this.harmonyRage && this.round > this.harmonyEnrageUntil) {
      const b = this.bossKey ? this.aliveByKey(this.bossKey) : undefined;
      if (b) {
        b.atk = this.harmonyRage.atk;
        b.matk = this.harmonyRage.matk;
        this.log.push(`${b.name}'s rage subsides.`);
      }
      this.harmonyRage = undefined;
    }

    // Boss adaptation — every third round, the boss reads your favorite answer
    // and stiffens against it for two rounds.
    const adaptBoss = this.bossKey ? this.aliveByKey(this.bossKey) : undefined;
    if (adaptBoss && adaptBoss.isBoss) {
      if (this.bossAdapt && this.round > this.bossAdapt.until) {
        adaptBoss.affinities[this.bossAdapt.type] = this.bossAdapt.original;
        this.log.push(`${adaptBoss.name} forgets your pattern.`);
        this.bossAdapt = undefined;
      }
      if (!this.bossAdapt && this.round >= 3 && this.round % 3 === 0) {
        let best: DamageType | null = null;
        let n = 0;
        for (const t of DAMAGE_TYPES) {
          const c = this.playerTypeTally[t] ?? 0;
          if (c > n) { n = c; best = t; }
        }
        if (best && n >= 3 && (adaptBoss.affinities[best] ?? '-') === '-') {
          this.bossAdapt = { type: best, until: this.round + 2, original: adaptBoss.affinities[best] ?? '-' };
          adaptBoss.affinities[best] = 'str';
          this.log.push(`${adaptBoss.name} reads your pattern — it stiffens against ${best}.`);
          this.bannersQueue.push('IT ADAPTS!');
        }
      }
    }

    for (const key of [...this.turnOrder]) {
      if (this.phase !== 'player') return;
      const e = this.aliveByKey(key);
      if (!e) continue;

      // Bridge values bosses read via flags
      e.flags.playerResonance = this.playerStateRef.resonance;
      e.flags.playerMomentum = this.momentum;

      if (hasStatus(e.statuses, 'downed')) {
        this.log.push(`${e.name} is Downed — it struggles upright and loses its turn.`);
        continue;
      }
      if (hasStatus(e.statuses, 'stun') || hasStatus(e.statuses, 'sleep')) {
        this.log.push(`${e.name} cannot move.`);
        continue;
      }
      if (hasStatus(e.statuses, 'fear') && this.rng() < 0.4) {
        this.log.push(`${e.name} hesitates in fear.`);
        continue;
      }

      // Charged unleash takes priority
      if (e.pendingChargeMoveId) {
        const move = e.moves.find((m) => m.id === e.pendingChargeMoveId);
        e.pendingChargeMoveId = undefined;
        if (move) {
          acted.push(e.key);
          this.runMove(e, move);
          if (this.player.hp <= 0) { this.onPlayerDown(); return; }
          continue;
        }
      }

      const move = this.pickMove(e);
      if (!move) continue;
      acted.push(e.key);
      if (move.charge) {
        e.pendingChargeMoveId = move.id;
        e.flags.lastChargeTurn = this.round;
        this.log.push(`⚡ ${e.name} begins charging ${move.label}…`);
        this.bannersQueue.push(`⚡ CHARGING: ${move.label}`);
        continue;
      }
      this.runMove(e, move);
      if (this.player.hp <= 0) { this.onPlayerDown(); return; }
    }
    this.lastRoundActors = acted;

    // End-of-round upkeep
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dots = tickDots(e.statuses);
      if (dots.damage > 0) {
        e.hp -= dots.damage;
        for (const l of dots.lines) this.log.push(`${e.name}: ${l}`);
        if (e.hp <= 0) this.killEnemy(e);
      }
      for (const msg of tickDurations(e.statuses)) this.log.push(msg);
    }
    for (const msg of tickDurations(this.player.statuses)) this.log.push(msg);
  }

  private pickMove(e: InternalEnemy): EnemyMoveDef | null {
    const groupBig = this.aliveEnemies().length >= 3;
    const eligible = e.moves.filter((m) => {
      if ((m.weight ?? 1) <= 0) return false;
      if (m.heavy && groupBig && this.heavyUsedThisRound) return false;
      try {
        return m.condition ? m.condition(this.makeCtx(e)) : true;
      } catch {
        return true;
      }
    });
    if (eligible.length === 0) return null;
    const total = eligible.reduce((s, m) => s + (m.weight ?? 1), 0);
    let roll = this.rng() * total;
    for (const m of eligible) {
      roll -= m.weight ?? 1;
      if (roll <= 0) return m;
    }
    return eligible[eligible.length - 1];
  }

  private runMove(e: InternalEnemy, move: EnemyMoveDef): void {
    if (move.heavy) this.heavyUsedThisRound = true;
    this.lastAttackerKey = e.key;
    const line = move.resolve(this.makeCtx(e));
    if (line) this.log.push(line);
    this.lastAttackerKey = undefined;
  }

  private makeCtx(e: InternalEnemy): EnemyTurnContext {
    const engine = this;
    // A transparent proxy over the live enemy: reads always see current stats,
    // writes (atk +=, flags.x = …) land directly on the engine's state.
    const self = new Proxy(e, {}) as unknown as CombatState_Enemy;
    return {
      self,
      player: engine.toPlayerState(),
      allies: engine.enemies.filter((x) => x.hp > 0 && x.key !== e.key).map((x) => engine.toEnemyState(x)),
      turn: engine.round,
      phaseKey: engine.bossPhaseKey || '',
      rng: engine.rng,
      log: engine.log,
      applyDamageToPlayer: (amount, type, sourceLabel, opts) =>
        engine.damagePlayer(amount, type, sourceLabel, opts),
      applyStatusToPlayer: (id, turns, stacks?, meta?) => {
        applyStatus(engine.player.statuses, id, isDotStatus(id) ? turns : turns + 1, stacks, meta);
      },
      applyStatusToSelf: (id, turns, stacks?, meta?) => {
        applyStatus(e.statuses, id, isDotStatus(id) ? turns : turns + 1, stacks, meta);
      },
      healSelf: (amount) => { e.hp = Math.min(e.maxHp, e.hp + amount); },
      damageSelf: (amount) => { e.hp = Math.max(0, e.hp - amount); if (e.hp <= 0) engine.killEnemy(e); },
      buffSelf: (statKey, percent) => {
        const k = statKey as 'atk' | 'def' | 'matk' | 'mdef' | 'spd';
        e[k] = Math.round(e[k] * (1 + percent / 100));
      },
      spawnAlly: (enemyId, hpOverride) => engine.spawnSummon(enemyId, hpOverride),
      removePlayerBuffs: () => {
        engine.player.statuses = engine.player.statuses.filter((s) => !BUFF_IDS.includes(s.id));
      },
      drainPlayerMp: (amount) => {
        const d = Math.min(engine.player.mp, amount);
        engine.player.mp -= d;
        return d;
      },
      reducePlayerMomentum: (n) => { engine.momentum = Math.max(0, engine.momentum - n); },
      setBarrier: (amount) => setBarrierSafe(e.statuses, amount),
      playerEquippedSkills: [...engine.equippedSkills],
      playerStats: { ...engine.playerStateRef.stats },
      playerFlags: { ...engine.playerStateRef.flags },
    };
  }

  private toEnemyState(e: InternalEnemy): CombatState_Enemy {
    return {
      name: e.name,
      hp: e.hp,
      maxHp: e.maxHp,
      mp: e.mp,
      maxMp: e.maxMp,
      atk: e.atk,
      matk: e.matk,
      def: e.def,
      mdef: e.mdef,
      spd: e.spd,
      accuracy: e.accuracy,
      dodge: e.dodge,
      statuses: e.statuses,
      defId: e.defId,
      level: e.level,
      attackType: 'slash',
      affinities: e.affinities,
      xp: e.xp,
      flags: e.flags,
      isBoss: e.isBoss,
    };
  }

  private toPlayerState(): CombatState_Player {
    return {
      name: 'You',
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      mp: this.player.mp,
      maxMp: this.player.maxMp,
      atk: this.player.atk,
      matk: this.player.matk,
      def: this.player.def,
      mdef: this.player.mdef,
      spd: this.player.spd,
      accuracy: this.player.accuracy,
      dodge: this.player.dodge,
      statuses: this.player.statuses,
      guarding: this.player.guarding,
    };
  }

  private spawnSummon(enemyId: string, hpOverride?: number): void {
    const def = ENEMIES[enemyId] ?? SUMMON_ENEMIES[enemyId];
    if (!def) return;
    const scale = scalingForIndex((this.bossDef?.chapter ?? 1) * NODES_PER_CHAPTER);
    const e = this.buildEnemy(def, this.precombatFlags, false, scale, 1, 1);
    if (hpOverride != null) { e.hp = hpOverride; e.maxHp = Math.max(e.maxHp, hpOverride); }
    this.enemies.push(e);
    this.buildTurnOrder();
    this.log.push(`${def.name} answers the call.`);
  }

  // ============================ Player damage intake ============================

  private damagePlayer(
    amount: number,
    _type: DamageType,
    label: string,
    opts?: { bypassGuard?: boolean; guaranteed?: boolean; critChance?: number; accMult?: number },
  ): number {
    // Hit roll vs player dodge — dodge counts at half weight so enemies stay a
    // credible threat while evasion builds still feel slippery.
    if (!opts?.guaranteed) {
      const accMult = opts?.accMult ?? 1;
      const acc = Math.round((this.lastAttackerAccuracy() * accMult) - this.player.dodge * 0.5);
      const chance = Math.max(25, Math.min(95, acc));
      if (this.rng() * 100 > chance) {
        this.log.push(`${label} misses you.`);
        return 0;
      }
    }

    let dmg = Math.max(1, Math.round(amount * this.diff.incomingMult));

    // Barrier absorb first
    const barrier = getStatus(this.player.statuses, 'barrier');
    if (barrier) {
      const pool = barrier.meta?.amount ?? 0;
      const absorbed = Math.min(pool, dmg);
      dmg -= absorbed;
      const left = pool - absorbed;
      if (left <= 0) removeStatus(this.player.statuses, 'barrier');
      else barrier.meta = { ...(barrier.meta ?? {}), amount: left };
      if (absorbed > 0) this.log.push(`Your shield absorbs ${absorbed}.`);
      if (dmg <= 0) return 0;
    }

    // Crit → Stagger unless guarding
    const critChance = opts?.critChance ?? 0.05;
    const isCrit = this.rng() < critChance;
    if (isCrit && !this.player.guarding && !opts?.bypassGuard) {
      applyStatus(this.player.statuses, 'staggered', 1);
      this.bannersQueue.push('CRITICAL! You reel.');
    }

    // Guard mitigation
    if (this.player.guarding && !opts?.bypassGuard) {
      const brace = getStatus(this.player.statuses, 'brace');
      const blockPct = (brace?.meta?.blockPct ?? 50) / 100;
      dmg = Math.round(dmg * (1 - blockPct));
      if (isCrit) this.log.push('Your stance holds — Stagger prevented.');
      if (this.hasPassive('retaliation')) {
        const back = Math.round(amount * 0.2);
        const attacker = this.lastAttackerKey ? this.getEnemy(this.lastAttackerKey) : undefined;
        if (attacker && attacker.hp > 0) {
          attacker.hp = Math.max(0, attacker.hp - back);
          this.log.push(`Retaliation! ${back} reflected.`);
          if (attacker.hp <= 0) this.killEnemy(attacker);
        }
      }
    }

    this.player.hp = Math.max(0, this.player.hp - dmg);
    if (this.lastAttackerKey && dmg > 0) {
      this.phaseDamage[this.lastAttackerKey] = (this.phaseDamage[this.lastAttackerKey] ?? 0) + dmg;
    }
    this.log.push(`${label} deals ${dmg} damage to you.`);
    if (this.player.hp <= 0) this.onPlayerDown();
    return dmg;
  }

  private lastAttackerAccuracy(): number {
    const a = this.lastAttackerKey ? this.getEnemy(this.lastAttackerKey) : undefined;
    return a?.accuracy ?? 80;
  }

  private onPlayerDown(): void {
    if (this.hasPassive('unfinished_sentence') && !this.deathWarded) {
      this.deathWarded = true;
      this.player.hp = 1;
      this.log.push('UNFINISHED SENTENCE — the killing blow stops at 1 HP.');
      return;
    }
    this.phase = 'defeat';
  }

  // ============================ Revamp compat shims (old-UI support) ============================

  /** @deprecated allies removed. */
  getAllyStates(): never[] { return [] as never[]; }
  /** @deprecated archive removed — use getDiscoveryGains(). */
  getArchiveGains(): Record<string, number> { return {}; }
  /** @deprecated AP system removed — drains any queued banners in the old scene's pattern. */
  drainBanners(): string[] { return this.bannersQueue.splice(0); }
  recoverPhase(): CombatSnapshot { return this.snapshot(); }
  checkCrisis(): CombatSnapshot { return this.snapshot(); }
  checkDesperation(): CombatSnapshot { return this.snapshot(); }
  endPlayerPhase(): CombatSnapshot { return this.endTurn(); }
  analyze(_targetKey?: string): CombatSnapshot {
    // Free Scan-lite: mark the first target's first slot as discovered.
    const t = this.aliveEnemies()[0];
    if (t && t.known.size === 0) {
      const type = DAMAGE_TYPES.find((type) => !(t.known.has(type)));
      if (type) this.discoverAffinity(t, type);
    }
    return this.snapshot();
  }
  probe(_targetKey: string, _probeId: string): CombatSnapshot { return this.snapshot(); }
  deepAnalyze(_targetKey?: string): CombatSnapshot { return this.snapshot(); }
  spendInsight(_choice: string): CombatSnapshot { return this.snapshot(); }
  sunder(_targetKey?: string): CombatSnapshot {
    const t = _targetKey ? this.aliveByKey(_targetKey) : this.aliveEnemies()[0];
    if (t) applyStatus(t.statuses, 'armour_break', 2);
    this.consumeAction();
    this.afterAction();
    return this.snapshot();
  }
  archiveExpose(_targetKey?: string): CombatSnapshot { return this.sunder(_targetKey); }
  focus(): CombatSnapshot {
    this.player.mp = Math.min(this.player.maxMp, this.player.mp + 8);
    this.gainMomentum(1);
    this.consumeAction();
    this.afterAction();
    return this.snapshot();
  }
  brace(): CombatSnapshot {
    applyStatus(this.player.statuses, 'brace', 2);
    this.consumeAction();
    this.afterAction();
    return this.snapshot();
  }
  resolveBravery(_id: string): CombatSnapshot { return this.snapshot(); }
  resolveCrisis(_id: string): CombatSnapshot { return this.snapshot(); }
  withdraw(): CombatSnapshot { this.phase = 'defeat'; return this.snapshot(); }
  resonanceAbility(_targetKey?: string): CombatSnapshot { return this.snapshot(); }
  advance(): CombatSnapshot { this.log.push('You step forward.'); return this.snapshot(); }
  retreat(): CombatSnapshot { this.log.push('You fall back.'); return this.snapshot(); }
  charge(): CombatSnapshot { this.log.push('You surge forward.'); return this.snapshot(); }
  fallBack(): CombatSnapshot { this.log.push('You drop back and brace.'); return this.snapshot(); }

  // ============================ Small helpers ============================

  private blocked(): boolean {
    if (this.phase !== 'player') return true;
    if (hasStatus(this.player.statuses, 'staggered')) {
      removeStatus(this.player.statuses, 'staggered');
      this.actionUsed = true;
      this.log.push('You stagger — your footing betrays you. (Action lost)');
      return true;
    }
    return !this.canAct();
  }

  private canAct(): boolean {
    return !this.actionUsed || this.oneMore;
  }

  private consumeAction(): void {
    this.actionUsed = true;
  }

  private afterAction(): void {
    if (this.oneMore) {
      // Consume the extra action: the NEXT action ends the turn normally.
      this.oneMore = false;
      this.actionUsed = false;
      this.bannersQueue.push('ONE MORE!');
    } else {
      this.actionUsed = true;
    }
    this.overclockActive = false;
    this.critAllTurn = false;
  }

  private gainMomentum(n: number): void {
    if (hasStatus(this.player.statuses, 'seal_mind')) return;
    this.momentum = Math.min(MOMENTUM_CAP, this.momentum + n);
  }

  private updateBossPhase(boss: InternalEnemy): void {
    if (!this.bossDef) return;
    const pct = boss.hp / boss.maxHp;
    const phases = [...this.bossDef.phases].sort((a, b) => b.hpFloorPercent - a.hpFloorPercent);
    for (const p of phases) {
      if (pct > p.hpFloorPercent) {
        if (this.bossPhaseKey !== p.key) {
          this.bossPhaseKey = p.key;
          this.log.push(`${boss.name} shifts — ${p.label}.`);
          if (p.affinities && Object.keys(p.affinities).length > 0) {
            boss.affinities = { ...boss.affinities, ...p.affinities };
          }
        }
        return;
      }
    }
  }

  private currentPhaseLabel(): string | undefined {
    return this.bossDef?.phases.find((p) => p.key === this.bossPhaseKey)?.label;
  }

  // ============================ Snapshot & exports ============================

  private takeBanners(): string[] {
    const out = this.bannersQueue.slice();
    this.bannersQueue = [];
    return out;
  }

  /** Phase as seen by callers: full momentum surfaces as the legacy modal phase. */
  private exposedPhase(): CombatPhase {
    if (this.phase === 'player' && this.momentum >= MOMENTUM_CAP) return 'momentum_choice';
    return this.phase;
  }

  snapshot(): CombatSnapshot {
    const canAct = !this.actionUsed || this.oneMore;
    const legacyAp = canAct && this.phase === 'player' ? 2 : 0;
    return {
      round: this.round,
      phase: this.exposedPhase(),
      actionUsed: this.actionUsed,
      oneMore: this.oneMore,
      // Legacy AP surface — one-action system rendered as a fixed 2-AP dock.
      playerAP: legacyAp,
      bankedAP: 0,
      apPenalty: 0,
      freeActionCharges: 0,
      playerHP: this.player.hp,
      playerMaxHP: this.player.maxHp,
      playerMP: this.player.mp,
      playerMaxMP: this.player.maxMp,
      playerSpd: this.player.spd,
      playerStatuses: this.player.statuses.map((s) => ({ ...s })),
      momentum: this.momentum,
      momentumReady: this.momentum >= MOMENTUM_CAP,
      momentumChoices: this.exposedPhase() === 'momentum_choice' ? this.momentumOffers() : [],
      guarding: this.player.guarding,
      fatigue: 0,
      insight: 0,
      allies: [] as Array<{ id: string; name: string }>,
      playerResonance: this.playerStateRef.resonance,
      fear: 0,
      battlefieldState: this.battlefieldState ? { ...this.battlefieldState } : undefined,
      playerRow: undefined,
      enemies: this.enemies.filter((e) => e.hp > 0).map((e) => ({
        key: e.key,
        defId: e.defId,
        name: e.name,
        level: e.level,
        hp: e.hp,
        maxHp: e.maxHp,
        alive: true,
        isBoss: e.isBoss,
        statuses: e.statuses.map((s) => ({ ...s })),
        affinities: Object.fromEntries([...e.known].map((t) => [t, e.affinities[t] ?? '-'])) as EnemyAffinities,
        knownSlots: [...e.known],
        pendingChargeLabel: e.pendingChargeMoveId
          ? e.moves.find((m) => m.id === e.pendingChargeMoveId)?.label
          : undefined,
        // Legacy compat fields
        revealed: e.known.size > 0,
        revealCount: e.known.size,
        investigationLayer: e.known.size > 0 ? 1 : 0,
        investigationProbes: [],
        tendency: undefined,
        weakWindowTurns: 0,
        weakHitStreak: 0,
        lastHitType: this.lastHitTypes.get(e.key),
        archiveExploited: false,
        row: 'middle' as const,
        pendingIntent: e.pendingChargeMoveId
          ? { id: e.pendingChargeMoveId, label: e.moves.find((m) => m.id === e.pendingChargeMoveId)?.label ?? 'Charging', confidence: 100, charged: true }
          : null,
      })),
      turnOrder: [...this.turnOrder],
      lastActors: [...this.lastRoundActors],
      enemyPhaseDamage: { ...this.phaseDamage },
      log: this.log.slice(-14),
      banners: this.takeBanners(),
      bossPhaseLabel: this.currentPhaseLabel(),
      difficulty: this.diffId,
      qte: this.pendingQte
        ? {
            targetKey: this.pendingQte.targetKey,
            kind: this.pendingQte.kind,
            skillId: this.pendingQte.skillId,
            slowed: hasStatus(this.player.statuses, 'slowed'),
          }
        : null,
    };
  }

  /** Situational momentum offers: 3 picks from the full pool, weighted by the
   *  current fight context (boss present, HP pressure, etc.). Stable for the
   *  duration of one momentum phase so the modal doesn't reshuffle on refresh. */
  momentumOffers(): MomentumChoice[] {
    if (!this.cachedOffers) {
      const weights: Record<MomentumChoice, number> = {
        flow: 3,
        harmony: this.player.hp < this.player.maxHp * 0.5 ? 4 : 1,
        archive: this.enemies.some((e) => e.isBoss && e.hp > 0) ? 4 : 0.5,
        forgotten_technique: 2,
        unravel: this.enemies.some((e) => e.hp > 0 && !e.isBoss) ? 2.5 : 1.5,
        echo_surge: 2,
        phase_shift: 1.5,
        desperate_strike: this.player.hp < this.player.maxHp * 0.35 ? 3 : 1,
        overclock: 1,
      };
      const pool = [...MOMENTUM_CHOICES];
      const picks: MomentumChoice[] = [];
      while (picks.length < 3 && pool.length > 0) {
        const total = pool.reduce((s, c) => s + weights[c], 0);
        let roll = this.rng() * total;
        let idx = 0;
        for (; idx < pool.length; idx++) {
          roll -= weights[pool[idx]];
          if (roll <= 0) break;
        }
        const chosen = pool[Math.min(idx, pool.length - 1)];
        picks.push(chosen);
        pool.splice(pool.indexOf(chosen), 1);
      }
      this.cachedOffers = picks;
    }
    return [...this.cachedOffers];
  }

  getXpEarned(): number {
    const bonus = this.hasPassive('archival_insight') ? 1.1 : 1;
    return Math.round(this.xpEarned * bonus);
  }

  /** Full combat log (the snapshot only carries the tail). */
  getLog(): string[] {
    return this.log.slice();
  }

  getEnemiesKilled(): number {
    return this.killedCount;
  }

  /** Kills grouped by enemy def id (Bestiary bookkeeping). */
  getKillsByDef(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const defId of this.deadDefIds) counts[defId] = (counts[defId] ?? 0) + 1;
    return counts;
  }

  getDiscoveryGains(): Record<string, Partial<Record<DamageType, AffinityKind>>> {
    return JSON.parse(JSON.stringify(this.discoveryGains));
  }

  getScanInfo(key: string) {
    const e = this.getEnemy(key);
    if (!e) return null;
    return {
      name: e.name,
      level: e.level,
      maxHp: e.maxHp,
      maxMp: e.maxMp,
      moves: e.moves.map((m) => ({ label: m.label, description: m.description ?? '' })),
      description: e.moves.length > 0 ? '' : '',
    };
  }

  getFlags(): Record<string, number> {
    const merged: Record<string, number> = { ...this.precombatFlags };
    const boss = this.bossKey ? this.getEnemy(this.bossKey) : undefined;
    if (boss) Object.assign(merged, boss.flags);
    return merged;
  }

  getPlayerRewards() {
    return {
      currentHP: Math.min(this.player.hp, this.player.maxHp),
      currentMP: Math.max(0, this.player.mp),
      momentum: this.momentum,
    };
  }
}

function setBarrierSafe(statuses: StatusInstance[], amount: number): void {
  const existing = statuses.find((s) => s.id === 'barrier');
  if (existing) existing.meta = { amount };
  else statuses.push({ id: 'barrier', stacks: 1, turnsRemaining: 99, meta: { amount } });
}
