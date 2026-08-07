import type {
  AffinityMap,
  BossDef,
  BossIntentDef,
  BossTurnContext,
  CombatState_Enemy,
  DamageType,
  EnemyTendency,
  EnemyTurnContext,
  IntentDef,
  PlayerState,
  StatusId,
  StatusInstance,
} from '@data/types';
import { ENEMIES, SUMMON_ENEMIES } from '@data/enemies';
import { ITEMS } from '@data/items';
import { NAMED_SKILLS, ACTION_AP_COST } from '@data/skills';
import { pageScaling } from './BoardGenerator';
import { resonanceEnemyHpMultiplier, resonanceEnemyAtkMultiplier, resonancePlayerDamageBonus } from './ResonanceSystem';
import {
  applyBarrier,
  applyStatus,
  getStatus,
  hasStatus,
  removeAllBuffs,
  setBarrier,
  statMultiplier,
  tickDots,
  tickDurations,
} from './StatusEffectSystem';
import { fatiguePenalty, clampFatigue } from './combat/FatigueSystem';
import {
  confidenceFor,
  intentLine,
  pickBossIntent,
  pickEnemyIntent,
  tendencyGlyph,
  tendencyHint,
  tendencyName,
  type IntentConfidence,
} from './combat/IntentSystem';
import {
  freshWindowState,
  recordWeakHit,
  resetWeakStreak,
  tickWeakWindow,
  windowActive,
  windowCritBonus,
  windowDamageMult,
  windowMomentumMult,
  type WeaknessWindowState,
} from './combat/WeaknessWindowSystem';
import { resolveReaction, type ReactionResult } from './combat/ElementalReactionSystem';
import {
  matchCombo,
  TAGS_ANALYZE,
  TAGS_ATTACK,
  TAGS_SUNDER,
  tagsForGuard,
  tagsForSkill,
  type ComboDef,
} from './combat/ComboSystem';

const ALL_ENEMY_DEFS = { ...ENEMIES, ...SUMMON_ENEMIES };

export type CombatPhase = 'player' | 'momentum_choice' | 'victory' | 'defeat' | 'fled';

export interface CombatSetup {
  player: PlayerState;
  enemyIds: string[];
  page: number;
  rng: () => number;
  bossDef?: BossDef;
  precombatFlags?: Record<string, number>;
  playerHistory: Set<string>;
}

export interface EnemyView {
  key: string;
  name: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  statuses: StatusInstance[];
  revealed: boolean;
  revealCount: number;
  affinities: AffinityMap;
  atk: number;
  def: number;
  spd: number;
  tendency: string;
  investigationLayer: number;
  investigationProbes: string[];
  pendingIntent: { id: string; label: string; confidence: IntentConfidence } | null;
  /** Turns remaining on an opened weakness window (Phase 3). */
  weakWindowTurns: number;
  /** Consecutive weakness hits landed (Phase 3). */
  weakHitStreak: number;
  /** Last damage type to land on this enemy's body (for reaction pairing / HUD color). */
  lastHitType?: DamageType;
  /** Combo banner text (from the most recent activation) — engine-accumulated, cleared per snapshot pick. */
  comboBanner?: string;
  /** Reaction banner text — engine-accumulated, cleared per snapshot pick. */
  reactionBanner?: string;
}

export interface CombatSnapshot {
  round: number;
  phase: CombatPhase;
  playerAP: number;
  bankedAP: number;
  freeActionCharges: number;
  playerHP: number;
  playerMaxHP: number;
  playerMP: number;
  playerMaxMP: number;
  playerSpd: number;
  playerStatuses: StatusInstance[];
  momentum: number;
  guarding: boolean;
  fatigue: number;
  insight: number;
  enemies: EnemyView[];
  initiativeOrder: string[];
  playerHitEnemyKeys: string[];
  log: string[];
  bossPhaseLabel?: string;
  /** Banners queued by reactions/combos since the last snapshot (now consumed by the caller read). */
  banners: string[];
  comboStacks: number;
}

interface InternalEnemy extends CombatState_Enemy {
  _key: string;
  _revealed: boolean;
  _isBoss: boolean;
}

const MOMENTUM_CHOICES = ['flow', 'harmony', 'archive', 'forgotten_technique', 'unravel', 'echo_surge', 'phase_shift', 'desperate_strike', 'overclock'] as const;
export type MomentumChoice = (typeof MOMENTUM_CHOICES)[number];

const MOMENTUM_CAP = 5;

export class CombatEngine {
  private player: PlayerState;
  private rng: () => number;
  private page: number;
  private bossDef?: BossDef;
  private enemies: InternalEnemy[] = [];
  private playerStatuses: StatusInstance[] = [];
  private flags: Record<string, number> = {};
  private playerHistorySet: Set<string>;

  round = 0;
  phase: CombatPhase = 'player';
  playerAP = 3;
  bankedAP = 0;
  guarding = false;
  log: string[] = [];
  private bossOwnTurnCounter = 0;
  private lastActionId: string | null = null;
  private lastActionType: DamageType | null = null;
  private lastActionRepeated = false;
  private momentumUsedSkillThisCombat = false;
  private unravelPending = false;
  private freeActionCharges = 0;
  private awaitingMomentumChoice = false;
  private analyzeBonusMultiplier = 1;
  private veilStepGuaranteed = false;
  private firstAttackUsed = false;
  /** Counts actions taken this round; used to allow banking up to 2 AP when the player idles. */
  private actionsTakenThisRound = 0;
  /** Keys of enemies that landed damage on the player since the start of the current enemy phase. */
  private playerHitEnemyKeys: string[] = [];
  /** Key of the enemy currently resolving its turn (used to attribute player damage). */
  private _currentAttackerKey: string | null = null;
  /** Phase Shift: dodge the next N attacks (momentum trigger). */
  private phaseShiftCharges = 0;
  /** Desperate Strike: force-crit while active (reset at round start). */
  private desperateStrike = false;
  /** Tracks whether the player used resonanceAbility or a magic-type skill last turn, for venn_custodian AI. */
  private _playerUsedMagicLastTurn = false;
  /** Whether fossilLastLaw was enforced this combat; reset per round. */
  private fossilLastLawEnforced = false;
  /** Per-action cumulative use counters this combat (token penalty at 3+ repeats). */
  private actionRepeatCounts: Record<string, number> = {};
  /** Token penalty for repeating the same action fires once per combat. */
  private repeatPenaltyApplied = false;
  /** Overclock (momentum): +70% damage while active this turn; max HP already reduced. */
  private overclockActive = false;
  /** Original max HP before Overclock's reduction; restored at combat end. */
  private overclockMaxHpReduced: number | null = null;
  /** Harmony (momentum): boss deals +30% damage for the remaining turns of this counter. */
  private bossEnrageTurns = 0;
  /** Declared intent per enemy key for the current round (cleared as each enemy acts). */
  private pendingIntents = new Map<string, string>();
  /** Combat-local investigation state per enemy key. */
  private investigations = new Map<string, { layer: number; probes: string[] }>();
  private insightDamageBonus = false;
  /** Phase 3a: per-enemy weakness-window state (streak + window turns). Insight weakness_window sets turns too. */
  private windowStates = new Map<string, WeaknessWindowState>();
  /** Phase 3b: last landed damage type per enemy key for reaction pairing (skips absorbed/resisted). */
  private lastHitTypes = new Map<string, DamageType>();
  /** Phase 3c: last 3 action tag-sets for combo matching. */
  private tagHistory: string[][] = [];
  /** Phase 3c: combo chains executed this combat-count. */
  private comboCount = 0;
  /** Phase 3c: pending combo damage multiplier for the next hit (Perfect Riposte / Hunter's Kill / Eclipse). */
  private pendingComboMult = 1;
  /** Phase 3c: pending defense-pierce fraction for the next hit (Eclipse ignores 50%). */
  private pendingComboDefPierce = 1;
  /** Banners queued by reactions/combos since the last snapshot (surfaced as snapshot.banners). */
  private pendingBanners: string[] = [];
  /** Momentum multiplier stacking (memory_collapse combo: x2 for 3 turns). */
  private momentumMultTurns = 0;
  /** Phase 3c: Expose Truth — original affinities per enemy while resistances are collapsed (2 turns). */
  private exposeTruth = new Map<string, { turns: number; original: AffinityMap }>();

  private readonly BOSS_TENDENCY: Record<string, EnemyTendency> = {
    sentinel: 'sage',
    patriarch: 'fanatic',
    chorus: 'manipulator',
    fossil_king: 'aggressor',
    reflection: 'tactician',
  };

  constructor(setup: CombatSetup) {
    this.player = setup.player;
    this.rng = setup.rng;
    this.page = setup.page;
    this.bossDef = setup.bossDef;
    this.flags = { ...(setup.precombatFlags ?? {}) };
    this.playerHistorySet = setup.playerHistory;

    if (this.player.skillsKnown.includes('chorus_echo')) {
      this.player.momentum = Math.max(this.player.momentum, 1);
    }

    if (setup.bossDef) {
      this.enemies.push(this.buildBossCombatant(setup.bossDef));
    } else {
      for (const id of setup.enemyIds) {
        const enemy = this.buildEnemyCombatant(id);
        enemy._key = `${id}_${this.enemies.length}_0`;
        this.enemies.push(enemy);
      }
    }
  }

  // ---- Construction helpers -------------------------------------------------

  private buildEnemyCombatant(id: string, hpOverride?: number): InternalEnemy {
    const def = ALL_ENEMY_DEFS[id];
    if (!def) throw new Error(`Unknown enemy id: ${id}`);
    const scale = pageScaling(this.page);
    const resHp = resonanceEnemyHpMultiplier(this.player.resonance);
    const resAtk = resonanceEnemyAtkMultiplier(this.player.resonance);
    const maxHp = hpOverride ?? Math.round(def.hp * scale.hp * resHp);
    return {
      defId: id,
      name: def.name,
      hp: maxHp,
      maxHp,
      atk: Math.round(def.atk * scale.atk * resAtk),
      matk: Math.round(def.matk * scale.atk * resAtk),
      def: Math.round(def.def * scale.def),
      mdef: Math.round(def.mdef * scale.def),
      spd: def.spd,
      accuracy: def.accuracy ?? 80,
      dodge: def.dodge ?? 10,
      attackType: def.attackType,
      affinities: { ...def.affinities },
      xp: def.xp,
      statuses: [],
      momentum: 0,
      flags: {},
      _key: id,
      _revealed: false,
      _isBoss: false,
    };
  }

  private buildBossCombatant(boss: BossDef): InternalEnemy {
    const s = boss.baseStats;
    return {
      defId: boss.id,
      name: boss.name,
      hp: s.hp,
      maxHp: s.hp,
      atk: s.atk,
      matk: s.matk,
      def: s.def,
      mdef: s.mdef,
      spd: s.spd,
      accuracy: 85,
      dodge: 5,
      attackType: 'shadow',
      affinities: boss.getPhase(1).affinities,
      xp: 0,
      statuses: [],
      momentum: 0,
      flags: {},
      _key: boss.id,
      _revealed: false,
      _isBoss: true,
    };
  }

  private aliveEnemies(): InternalEnemy[] {
    return this.enemies.filter((e) => e.hp > 0);
  }

  private effectivePlayerSpeed(): number {
    const base = this.player.derived.speed * statMultiplier(this.playerStatuses, 'spd');
    return base + (this.player.skillsKnown.includes('quickstep') ? 5 : 0);
  }

  private enemyEffectiveSpeed(enemy: InternalEnemy): number {
    return Math.round(enemy.spd * statMultiplier(enemy.statuses, 'spd'));
  }

  private readonly CONTROL_STATUSES: StatusId[] = ['stun', 'sleep', 'fear', 'silence', 'confuse', 'seal_mind', 'blind'];

  /** Applies a status to the player, honoring Unshakeable's chance to resist Control-type effects. */
  private applyStatusToPlayerChecked(id: StatusId, turns: number, stacks?: number, meta?: Record<string, number>): void {
    if (this.CONTROL_STATUSES.includes(id) && this.player.skillsKnown.includes('unshakeable') && this.rng() < 0.5) {
      this.log.push(`Unshakeable resists ${id.replace('_', ' ')}.`);
      return;
    }
    applyStatus(this.playerStatuses, id, turns, stacks, meta);
  }

  // ---- Round flow -------------------------------------------------------------

  beginRound(): CombatSnapshot {
    if (this.phase === 'victory' || this.phase === 'defeat' || this.phase === 'fled') return this.snapshot();
    this.round += 1;
    this.playerAP = 3 + (this.round === 1 && this.player.skillsKnown.includes('borrowed_time') ? 1 : 0) + this.bankedAP;
    this.bankedAP = 0;
    this.guarding = false;
    this.lastActionRepeated = false;
    this.veilStepGuaranteed = false;
    this.fossilLastLawEnforced = false;
    this.desperateStrike = false;
    this.actionsTakenThisRound = 0;
    this.flags.fossilLastLaw = 0;
    this.overclockActive = false;
    if (this.bossEnrageTurns > 0) this.bossEnrageTurns -= 1;

    // Exhaustion (from the "Flow" momentum trigger)
    if (hasStatus(this.playerStatuses, 'exhausted')) {
      this.playerAP = Math.max(0, this.playerAP - 1);
      this.log.push('Exhaustion weighs on you — you start the round with 1 less AP.');
    }
    if (this.momentumMultTurns > 0) this.momentumMultTurns -= 1;
    // Fatigue penalties
    const fatigue = fatiguePenalty(this.player.fatigue);
    if (fatigue.apPenalty > 0 && this.playerAP > 0) {
      this.playerAP = Math.max(0, this.playerAP - fatigue.apPenalty);
      this.log.push(`Fatigue leaves you short — ${fatigue.apPenalty} AP lost.`);
    }
    if (fatigue.skipChance > 0 && this.rng() < fatigue.skipChance) {
      this.log.push('You are too exhausted to act this round.');
      this.playerAP = 0;
    }

    const alive = this.aliveEnemies();
    for (const e of alive) {
      if (e.defId === 'venn_custodian') {
        e.flags.playerCastMagicLastTurn = this._playerUsedMagicLastTurn ? 1 : 0;
      }
    }
    this._playerUsedMagicLastTurn = false;
    this.pickIntents();
    const playerSpd = this.effectivePlayerSpeed();
    const faster = alive.filter((e) => this.enemyEffectiveSpeed(e) > playerSpd).sort((a, b) => this.enemyEffectiveSpeed(b) - this.enemyEffectiveSpeed(a));
    this.resolvingEnemyTurns = true;
    for (const e of faster) this.resolveEnemyTurn(e);
    this.resolvingEnemyTurns = false;

    this.checkOutcome();
    if (this.player.currentHP <= 0 || this.aliveEnemies().length === 0) return this.snapshot();
    this.phase = 'player';
    if (this.momentumChoicePending && this.player.momentum >= MOMENTUM_CAP) {
      this.momentumChoicePending = false;
      this.phase = 'momentum_choice';
    }
    return this.snapshot();
  }

  endPlayerPhase(): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    this.lastActionRepeated = this.lastActionId !== null && this.lastActionId === this._prevActionId;
    this._prevActionId = this.lastActionId;

    // AP banking: leftover AP banks 1 (max 1 stored); idling the whole turn banks up to 2.
    if (this.actionsTakenThisRound === 0) {
      this.player.fatigue = clampFatigue(this.player.fatigue - 15);
      this.log.push('You hold still for a beat — fatigue eases.');
    }
    if (this.playerAP > 0) {
      const cap = this.actionsTakenThisRound === 0 ? 2 : 1;
      this.bankedAP = Math.max(this.bankedAP, Math.min(cap, this.playerAP));
    }
    this.actionsTakenThisRound = 0;

    const alive = this.aliveEnemies();
    const playerSpd = this.effectivePlayerSpeed();
    const slowerOrEqual = alive.filter((e) => this.enemyEffectiveSpeed(e) <= playerSpd).sort((a, b) => this.enemyEffectiveSpeed(b) - this.enemyEffectiveSpeed(a));
    this.playerHitEnemyKeys = [];
    this.resolvingEnemyTurns = true;
    for (const e of slowerOrEqual) this.resolveEnemyTurn(e);
    this.resolvingEnemyTurns = false;

    // End of round: DoTs tick for player and all enemies, durations decrement
    const playerDot = tickDots(this.playerStatuses);
    if (playerDot.damage > 0) {
      this.player.currentHP = Math.max(0, this.player.currentHP - playerDot.damage);
      this.log.push(...playerDot.lines);
    }
    if (playerDot.speedPenalty > 0) {
      // applied implicitly via statMultiplier('spd') using status effects; frostbite speed penalty is informational for now
    }
    if (hasStatus(this.playerStatuses, 'regeneration')) {
      const regenAmt = Math.round(this.player.derived.maxHP * 0.05);
      this.player.currentHP = Math.min(this.player.derived.maxHP, this.player.currentHP + regenAmt);
      this.log.push(`Regeneration restores ${regenAmt} HP.`);
    }
    tickDurations(this.playerStatuses).forEach((m) => this.log.push(m));

    for (const e of this.aliveEnemies()) {
      const dot = tickDots(e.statuses);
      if (dot.damage > 0) {
        e.hp = Math.max(0, e.hp - dot.damage);
        this.log.push(`${e.name}: ${dot.lines.join(' ')}`);
      }
      tickDurations(e.statuses);
    }
    for (const [k, state] of this.windowStates) {
      tickWeakWindow(state);
      if (state.turns <= 0 && state.streak <= 0) this.windowStates.delete(k);
    }
    for (const [k, truth] of this.exposeTruth) {
      truth.turns -= 1;
      if (truth.turns <= 0) {
        const e = this.enemies.find((en) => en._key === k);
        if (e) e.affinities = { ...truth.original };
        this.exposeTruth.delete(k);
      }
    }

    this.checkOutcome();
    return this.snapshot();
  }

  private checkOutcome(): void {
    if (this.player.currentHP <= 0) {
      if (this.player.skillsKnown.includes('unfinished_sentence') && !this.player.flags.deathWardUsed) {
        this.player.flags.deathWardUsed = true;
        this.player.currentHP = 1;
        this.log.push('Unfinished Sentence: the killing blow leaves you at 1 HP instead.');
      } else {
        this.phase = 'defeat';
        this.restoreOverclockedMaxHp();
        return;
      }
    }
    if (this.aliveEnemies().length === 0) {
      this.phase = 'victory';
    }
    if (this.phase === 'victory') this.restoreOverclockedMaxHp();
  }

  /** Overclock's max-HP cost is scoped to a single combat — restore it when the fight concludes. */
  private restoreOverclockedMaxHp(): void {
    if (this.overclockMaxHpReduced !== null) {
      this.player.derived.maxHP = this.overclockMaxHpReduced;
      this.overclockMaxHpReduced = null;
    }
  }

  // ---- Enemy / boss turn resolution --------------------------------------------

  private resolveEnemyTurn(enemy: InternalEnemy): void {
    if (enemy.hp <= 0 || this.phase !== 'player') return;
    this._currentAttackerKey = enemy._key;
    // Control effects that skip the turn
    if (hasStatus(enemy.statuses, 'stun')) {
      this.log.push(`${enemy.name} is stunned and cannot act.`);
      return;
    }
    if (hasStatus(enemy.statuses, 'sleep')) {
      this.log.push(`${enemy.name} sleeps through its turn.`);
      return;
    }
    if (hasStatus(enemy.statuses, 'fear') && this.rng() < 0.4) {
      this.log.push(`${enemy.name} flinches back in Fear.`);
      return;
    }

    if (enemy._isBoss && this.bossDef) {
      this.bossOwnTurnCounter += 1;
      const hpPercent = enemy.hp / enemy.maxHp;
      const phaseInfo = this.bossDef.getPhase(hpPercent);
      enemy.affinities = { ...phaseInfo.affinities };
      const ctx = this.makeBossTurnCtx(enemy, this.bossOwnTurnCounter, phaseInfo.key);
      const intentId = this.pendingIntents.get(enemy._key);
      const intent = this.bossDef.intents?.find((i) => i.id === intentId);
      this.pendingIntents.delete(enemy._key);
      if (intent) intent.resolve(ctx);
      else this.bossDef.takeTurn(ctx);
      this.checkOutcome();
      return;
    }

    const def = ALL_ENEMY_DEFS[enemy.defId];
    const ctx = this.makeRegularTurnCtx(enemy, this.round);
    const intentId = this.pendingIntents.get(enemy._key);
    const intent = def.intents?.find((i) => i.id === intentId);
    this.pendingIntents.delete(enemy._key);
    const line = intent ? intent.resolve(ctx) : def.act ? def.act(ctx) : '';
    if (line) this.log.push(line);
    this.checkOutcome();
  }

  /** Picks each enemy's declared intent for the round (shown to the player, executed when it acts). */
  private pickIntents(): void {
    this.pendingIntents.clear();
    for (const e of this.aliveEnemies()) {
      if (e._isBoss && this.bossDef?.intents?.length) {
        const phaseInfo = this.bossDef.getPhase(e.hp / e.maxHp);
        const ctx = this.makeBossTurnCtx(e, this.bossOwnTurnCounter + 1, phaseInfo.key);
        const picked = pickBossIntent(this.bossDef.intents, ctx, this.rng);
        if (picked) this.pendingIntents.set(e._key, picked.id);
      } else {
        const def = ALL_ENEMY_DEFS[e.defId];
        if (def?.intents?.length) {
          const ctx = this.makeRegularTurnCtx(e, this.round);
          const picked = pickEnemyIntent(def.intents, ctx, this.rng);
          if (picked) this.pendingIntents.set(e._key, picked.id);
        }
      }
    }
  }

  private makeRegularTurnCtx(enemy: InternalEnemy, turn: number): EnemyTurnContext {
    return {
      self: enemy,
      player: this.playerCombatView(),
      allies: this.aliveEnemies().filter((e) => e !== enemy),
      turn,
      rng: this.rng,
      applyDamageToPlayer: (amount, type, label) => this.dealDamageToPlayer(amount, type, label, false),
      applyStatusToPlayer: (id, turns, stacks, meta) => this.applyStatusToPlayerChecked(id, turns, stacks, meta),
      healSelf: (amount) => { enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount); },
      applyStatusToSelf: (id, turns, stacks, meta) => applyStatus(enemy.statuses, id, turns, stacks, meta),
      spawnAlly: (enemyId, hpOverride) => this.spawnAdd(enemyId, hpOverride),
      removePlayerBuffs: () => removeAllBuffs(this.playerStatuses),
    };
  }

  private makeBossTurnCtx(enemy: InternalEnemy, turn: number, phaseKey: string): BossTurnContext {
    return {
      self: enemy,
      player: this.playerCombatView(),
      turn,
      phaseKey,
      rng: this.rng,
      log: this.log,
      flags: this.flags,
      applyDamageToPlayer: (amount, type, label, bypassGuard) => this.dealDamageToPlayer(amount, type, label, bypassGuard),
      applyStatusToPlayer: (id, turns, stacks, meta) => this.applyStatusToPlayerChecked(id, turns, stacks, meta),
      applyStatusToSelf: (id, turns, stacks, meta) => applyStatus(enemy.statuses, id, turns, stacks, meta),
      healSelf: (amount) => { enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount); },
      damageSelf: (amount) => { enemy.hp = Math.max(0, enemy.hp - amount); },
      buffSelf: (statKey, percent) => { (enemy as any)[statKey] = Math.round((enemy as any)[statKey] * (1 + percent / 100)); },
      spawnAlly: (enemyId, hpOverride) => this.spawnAdd(enemyId, hpOverride),
      removePlayerBuffs: () => removeAllBuffs(this.playerStatuses),
      clearBarrier: () => { const i = enemy.statuses.findIndex((s) => s.id === 'barrier'); if (i >= 0) enemy.statuses.splice(i, 1); },
      setBarrier: (amount) => setBarrier(enemy.statuses, amount),
      endCombat: (victory) => { this.phase = victory ? 'victory' : 'defeat'; },
      playerHistory: this.playerHistorySet,
      playerBuild: this.player.stats,
      playerFaction: this.player.faction,
      playerResonance: this.player.resonance,
      playerLastActionType: this.lastActionType,
      playerRepeatedLastAction: this.lastActionRepeated,
    };
  }

  private spawnAdd(enemyId: string, hpOverride?: number): void {
    if (this.enemies.filter((e) => e.hp > 0).length >= 4) return; // capacity cap
    const uniqueKey = `${enemyId}_${this.enemies.length}_${this.round}`;
    const enemy = this.buildEnemyCombatant(enemyId, hpOverride);
    enemy._key = uniqueKey;
    this.enemies.push(enemy);
  }

  private playerCombatView() {
    const defMult = this.player.skillsKnown.includes('bulwark_stance') ? 1.15 : 1;
    return {
      name: 'You',
      hp: this.player.currentHP,
      maxHp: this.player.derived.maxHP,
      def: Math.round(this.player.derived.defense * statMultiplier(this.playerStatuses, 'def') * defMult),
      mdef: this.player.derived.magicDefense,
      atk: this.player.derived.attack,
      matk: this.player.derived.magicAttack,
      spd: this.effectivePlayerSpeed(),
      accuracy: this.player.derived.accuracy,
      dodge: this.player.derived.dodge,
      statuses: this.playerStatuses,
      momentum: this.player.momentum,
      guarding: this.guarding,
    };
  }

  /** Applies incoming damage to the player, honoring Dodge / Guard / Barrier / Reflection. */
  private dealDamageToPlayer(amount: number, type: DamageType, label: string, bypassGuard = false, attackerKey?: string): number {
    if (this.bossEnrageTurns > 0 && this.bossDef) {
      const enragedAmount = Math.round(amount * 1.3);
      if (enragedAmount !== amount) {
        this.log.push('The boss is enraged — damage +30%.');
        amount = enragedAmount;
      }
    }
    let dodge = this.player.derived.dodge + (this.player.skillsKnown.includes('chorus_step') ? 10 : 0);
    if (this.phaseShiftCharges > 0) {
      dodge = 100;
      this.phaseShiftCharges -= 1;
      this.log.push(`Phase Shift: you slip out of ${label}.`);
    }
    if (this.veilStepGuaranteed) {
      dodge = 100;
      this.veilStepGuaranteed = false;
    }
    if (this.rng() * 100 < dodge) {
      this.log.push(`You dodge ${label}.`);
      this.gainMomentum(1);
      this.applyTokenDelta(1, 'Graceful dodge — +1 token.');
      this.player.fatigue = clampFatigue(this.player.fatigue + 5);
      return 0;
    }

    let dmg = amount;
    if (this.guarding && !bypassGuard) {
      const guardMultiplier = this.player.skillsKnown.includes('iron_resolve') ? 0.35 : 0.5;
      const braceBonus = hasStatus(this.playerStatuses, 'brace') ? 0.8 : 1;
      dmg = Math.round(dmg * guardMultiplier * braceBonus);
      if (this.player.skillsKnown.includes('retaliation')) {
        const blocked = amount - dmg;
        const reflected = Math.round(blocked * 0.2);
        const firstEnemy = this.aliveEnemies()[0];
        if (firstEnemy && reflected > 0) {
          firstEnemy.hp = Math.max(0, firstEnemy.hp - reflected);
          this.log.push(`Retaliation reflects ${reflected} damage back.`);
        }
      }
      this.gainMomentum(1);
    }
    dmg = applyBarrier(this.playerStatuses, dmg);
    this.player.currentHP = Math.max(0, this.player.currentHP - dmg);
    if (dmg > 0) {
      this.player.fatigue = clampFatigue(this.player.fatigue + Math.floor(dmg / 10) * 2);
    }
    if (dmg > 0 && this._currentAttackerKey) {
      if (!this.playerHitEnemyKeys.includes(this._currentAttackerKey)) this.playerHitEnemyKeys.push(this._currentAttackerKey);
    }
    if (hasStatus(this.playerStatuses, 'reflection') && dmg > 0) {
      const reflected = Math.round(dmg * 0.25);
      const firstEnemy = this.aliveEnemies()[0];
      if (firstEnemy) firstEnemy.hp = Math.max(0, firstEnemy.hp - reflected);
    }
    if (
      this.player.skillsKnown.includes('second_wind') &&
      !this.flags.secondWindUsed &&
      this.player.currentHP > 0 &&
      this.player.currentHP / this.player.derived.maxHP < 0.25
    ) {
      this.flags.secondWindUsed = 1;
      const heal = Math.round(this.player.derived.maxHP * 0.15);
      this.player.currentHP = Math.min(this.player.derived.maxHP, this.player.currentHP + heal);
      this.log.push(`Second Wind: you catch yourself and recover ${heal} HP.`);
    }
    return dmg;
  }

  // ---- Player actions --------------------------------------------------------

  private playerCanAct(): boolean {
    if (hasStatus(this.playerStatuses, 'stun')) {
      this.log.push('You are stunned and cannot act.');
      return false;
    }
    if (hasStatus(this.playerStatuses, 'sleep')) {
      this.log.push('You are asleep and cannot act.');
      return false;
    }
    if (hasStatus(this.playerStatuses, 'fear') && this.rng() < 0.4) {
      this.log.push('You are overcome with fear and cannot act.');
      return false;
    }
    if (hasStatus(this.playerStatuses, 'confuse') && this.rng() < 0.5) {
      this.log.push('You are confused and flail wildly, wasting your action.');
      return false;
    }
    return true;
  }

  private gainMomentum(n = 1): void {
    if (hasStatus(this.playerStatuses, 'seal_mind')) {
      this.log.push('Seal Mind prevents you from gaining Momentum.');
      return;
    }
    if (hasStatus(this.playerStatuses, 'fragile_perception')) n *= 2;
    if (this.momentumMultTurns > 0) n *= 2;
    this.player.momentum = Math.min(MOMENTUM_CAP, this.player.momentum + n);
    if (this.player.momentum >= MOMENTUM_CAP) {
      if (this.resolvingEnemyTurns) {
        this.momentumChoicePending = true;
      } else {
        this.phase = 'momentum_choice';
      }
    }
  }

  private momentumChoicePending = false;
  private resolvingEnemyTurns = false;

  /** Dynamic action-economy (Part 2): token flow from fight events. */
  private applyTokenDelta(n: number, reason: string): void {
    if (n === 0) return;
    this.playerAP = Math.max(0, Math.min(5, this.playerAP + n));
    this.log.push(reason);
  }

  private recordAction(id: string): void {
    this.actionRepeatCounts[id] = (this.actionRepeatCounts[id] ?? 0) + 1;
    if (this.actionRepeatCounts[id] >= 3) {
      this.player.fatigue = clampFatigue(this.player.fatigue + 10);
    }
    if (this.actionRepeatCounts[id] === 3 && !this.repeatPenaltyApplied) {
      this.repeatPenaltyApplied = true;
      this.applyTokenDelta(-1, 'Repeating the same action dulls your rhythm — −1 token.');
    }
  }

  /** Combo execution hook (Phase 3 wired; +2 tokens per Ultimate Battle System Part 12). */
  private executeCombo(label: string): void {
    this.applyTokenDelta(2, `${label} — the flow of battle rewards you: +2 tokens.`);
    this.gainMomentum(2);
  }

  private pickTarget(targetKey?: string): InternalEnemy | undefined {
    const alive = this.aliveEnemies();
    if (targetKey) return alive.find((e) => e._key === targetKey);
    return alive[0];
  }

  private rollHit(target: InternalEnemy): boolean {
    let acc = this.player.derived.accuracy + (this.player.skillsKnown.includes('steady_hands') ? 10 : 0);
    const fatigue = fatiguePenalty(this.player.fatigue);
    acc = acc * fatigue.accuracyMult;
    if (hasStatus(this.playerStatuses, 'blind')) acc *= 0.7;
    let shockMiss = 0;
    const sd = getStatus(this.playerStatuses, 'shock_dot');
    if (sd) shockMiss = 15 * sd.stacks;
    const chance = Math.max(5, Math.min(99, acc - target.dodge - shockMiss));
    return this.rng() * 100 < chance;
  }

  private rollCrit(): boolean {
    if (this.desperateStrike) return true;
    return this.rng() < 0.1;
  }

  private computeAndApplyDamage(target: InternalEnemy, sourcePower: number, defenseStat: number, damageType: DamageType, label: string, statKey: 'def' | 'mdef' = 'def', guaranteedHit = false): { dmg: number; hit: boolean; crit: boolean; weak: boolean } {
    if (!guaranteedHit && !this.rollHit(target)) {
      this.log.push(`${label} misses ${target.name}.`);
      this.playerAP = 0;
      this.log.push('The miss unbalances you — all tokens lost.');
      const missState = this.windowStates.get(target._key);
      if (missState) resetWeakStreak(missState);
      return { dmg: 0, hit: false, crit: false, weak: false };
    }
    const weakness = target.affinities[damageType] ?? 1.0;
    let state = this.windowStates.get(target._key);
    if (!state) {
      state = freshWindowState();
      this.windowStates.set(target._key, state);
    }
    const crit = this.rollCrit() || this.rng() < windowCritBonus(state);
    const variance = 0.9 + this.rng() * 0.2;
    let unravelMult = 1;
    let defReduction = 1;
    if (this.unravelPending) {
      unravelMult = 2.5;
      defReduction = 0.25;
      this.unravelPending = false;
    }
    const lastType = this.lastHitTypes.get(target._key);
    const reaction: ReactionResult | null = weakness >= 1 && lastType && lastType !== damageType ? resolveReaction(lastType, damageType) : null;
    if (weakness >= 1) this.lastHitTypes.set(target._key, damageType);
    if (reaction?.damageMult) unravelMult *= reaction.damageMult;
    const reactionArmorPierce = reaction?.armorPierce ? 1 - reaction.armorPierce : 1;
    const comboMult = this.pendingComboMult;
    this.pendingComboMult = 1;
    const comboDefPierce = this.pendingComboDefPierce;
    this.pendingComboDefPierce = 1;
    if (comboDefPierce < 1) defReduction = Math.min(defReduction, comboDefPierce);
    const effDef = Math.round(defenseStat * defReduction * reactionArmorPierce * statMultiplier(target.statuses, statKey));
    let dmg = Math.max(3, Math.round((sourcePower - effDef / 2) * weakness * variance * unravelMult * comboMult));
    dmg = Math.round(dmg * windowDamageMult(state));
    if (crit) dmg = Math.round(dmg * 1.5);
    if (hasStatus(this.playerStatuses, 'echo_surge')) dmg = Math.round(dmg * 1.2);
    if (this.overclockActive) dmg = Math.round(dmg * 1.7);
    const investigated = (this.investigations.get(target._key)?.layer ?? 0) >= 1;
    if (this.insightDamageBonus && investigated) dmg = Math.round(dmg * 1.15);
    const fatigueDmg = fatiguePenalty(this.player.fatigue).damageMult;
    if (fatigueDmg !== 1) dmg = Math.round(dmg * fatigueDmg);
    const resonanceBonus = target._isBoss ? 1 : resonancePlayerDamageBonus(this.player.resonance);
    dmg = Math.round(dmg * resonanceBonus);
    if (damageType === 'sacred' && hasStatus(this.playerStatuses, 'blessing')) {
      dmg = Math.round(dmg * 1.25);
    }
    if (weakness < 0) {
      let absorbDmg = dmg;
      if (damageType === 'shadow' && this.player.skillsKnown.includes('loom_touched')) {
        absorbDmg = Math.round(absorbDmg * 1.3);
      }
      if (damageType === 'shadow' && this.player.skillsKnown.includes('parting_words') && target.hp / target.maxHp < 0.3) {
        absorbDmg = Math.round(absorbDmg * 1.4);
      }
      target.hp = Math.min(target.maxHp, target.hp + Math.abs(absorbDmg));
      this.log.push(`${label} is absorbed — ${target.name} heals ${Math.abs(absorbDmg)} instead.`);
      const absorbState = this.windowStates.get(target._key);
      if (absorbState) resetWeakStreak(absorbState);
      return { dmg: 0, hit: true, crit, weak: false };
    }
    if (damageType === 'shadow' && this.player.skillsKnown.includes('loom_touched')) {
      dmg = Math.round(dmg * 1.3);
    }
    if (damageType === 'shadow' && this.player.skillsKnown.includes('parting_words') && target.hp / target.maxHp < 0.3) {
      dmg = Math.round(dmg * 1.4);
    }
    const mitigated = applyBarrier(target.statuses, dmg);
    if (mitigated < dmg) this.log.push(`${target.name}'s Barrier absorbs part of the blow.`);
    if (dmg > 0 && mitigated === 0) {
      const lost = Math.floor(this.playerAP / 2);
      this.applyTokenDelta(-lost, `The blow was fully absorbed — you lose ${lost} token(s).`);
    }
    target.hp = Math.max(0, target.hp - mitigated);

    // Echo-Soldier Phalanx: when one is damaged, 50% is split among allies
    if (target.defId === 'echo_soldier' && mitigated > 0) {
      const phalanxAllies = this.aliveEnemies().filter((e) => e.defId === 'echo_soldier' && e._key !== target._key);
      if (phalanxAllies.length > 0) {
        const shared = Math.round((mitigated * 0.5) / phalanxAllies.length);
        for (const ally of phalanxAllies) {
          ally.hp = Math.max(0, ally.hp - shared);
        }
        this.log.push(`The phalanx shares the blow — ${phalanxAllies.map((a) => a.name).join(', ')} take ${shared} redirected damage each.`);
      }
    }

    const weak = weakness > 1;
    this.log.push(`${label} hits ${target.name} for ${mitigated} damage${crit ? ' (Critical!)' : ''}${weak ? ' — weakness exploited!' : ''}.`);
    if (weak) {
      const windowNote = recordWeakHit(state);
      const wMult = windowMomentumMult(state);
      this.gainMomentum(2 * wMult);
      this.applyTokenDelta(1, `Weakness hit — +1 token${wMult > 1 ? ' (window doubles momentum)' : ''}.`);
      if (windowNote === 'opened') {
        this.pendingBanners.push('WEAKNESS WINDOW — resistances melt; damage +50% for 2 turns');
        this.log.push(`WINDOW — ${target.name}'s weakness is laid bare: +50% damage for ${windowActive(state) ? '2 turns' : ''}.`);
      }
    } else {
      resetWeakStreak(state);
    }
    if (reaction) {
      this.applyReactionEffect(target, reaction, mitigated);
      this.pendingBanners.push(`REACTION ${reaction.label}`);
    }
    if (crit) {
      this.gainMomentum(1);
      this.applyTokenDelta(1, 'Critical hit — +1 token.');
    }
    if (target.hp <= 0) {
      this.gainMomentum(1);
      this.applyTokenDelta(1, 'Enemy slain — +1 token.');
    }
    if (investigated && this.pendingIntents.has(target._key)) {
      this.applyTokenDelta(1, 'You read its intent and struck true — +1 token.');
    }
    return { dmg: mitigated, hit: true, crit, weak };
  }

  /** Applies an elemental reaction's status/splash/strip effects after the triggering hit resolves. */
  private applyReactionEffect(target: InternalEnemy, reaction: ReactionResult, hitDamage: number): void {
    if (reaction.status) {
      applyStatus(target.statuses, reaction.status.id, reaction.status.turns);
    }
    if (reaction.spdSlow) {
      applyStatus(target.statuses, 'slow', reaction.spdSlow);
      this.log.push(`REACTION ${reaction.label} — ${target.name} is slowed (speed -40%) for ${reaction.spdSlow} turn(s).`);
    }
    if (reaction.stripBuffs) {
      removeAllBuffs(target.statuses);
      this.log.push(`REACTION ${reaction.label} — ${target.name}'s buffs are stripped.`);
    }
    if (reaction.splashPct && hitDamage > 0) {
      const splash = Math.round((hitDamage * reaction.splashPct) / 100);
      for (const other of this.aliveEnemies()) {
        if (other._key === target._key) continue;
        const before = other.hp;
        other.hp = Math.max(0, other.hp - splash);
        if (before !== other.hp) this.log.push(`REACTION splash — ${other.name} takes ${before - other.hp} residual damage.`);
      }
    }
  }

  /** Phase 3c: push an action's tag-set into the combo history and return the matched combo, if any. */
  private pushComboTags(tags: readonly string[], target?: InternalEnemy): ComboDef | null {
    this.tagHistory.push([...tags]);
    if (this.tagHistory.length > 3) this.tagHistory.shift();
    const combo = matchCombo(this.tagHistory as never);
    if (!combo) return null;
    this.tagHistory = [];
    this.comboCount += 1;
    this.executeCombo(combo.label);
    this.pendingBanners.push(`COMBO ${combo.label}`);
    this.applyComboEffect(combo, target);
    return combo;
  }

  /** Phase 3c: resolve a combo's combat effect. */
  private applyComboEffect(combo: ComboDef, target?: InternalEnemy): void {
    switch (combo.effect) {
      case 'expose_truth': {
        for (const e of this.aliveEnemies()) {
          if (!this.exposeTruth.has(e._key)) this.exposeTruth.set(e._key, { turns: 2, original: { ...e.affinities } });
          for (const t of Object.keys(e.affinities) as DamageType[]) {
            e.affinities[t] = Math.max(e.affinities[t] ?? 0, 1);
          }
        }
        this.log.push('COMBO Expose Truth — every resistance collapses to neutral for 2 turns.');
        break;
      }
      case 'memory_collapse':
        this.momentumMultTurns = 3;
        this.log.push('COMBO Memory Collapse — momentum gains are doubled for 3 turns.');
        break;
      case 'rending_wounds':
        if (target) {
          applyStatus(target.statuses, 'bleed', 4, 3);
          this.log.push(`COMBO Rending Wounds — ${target.name} bleeds 15 per turn for 4 turns.`);
        }
        break;
      case 'hunters_kill':
        this.pendingComboMult = 3;
        this.log.push('COMBO Hunter\'s Kill — your next strike deals 3.0x damage.');
        break;
      case 'shattered_reality':
        for (const e of this.aliveEnemies()) removeAllBuffs(e.statuses);
        this.log.push('COMBO Shattered Reality — every enemy buff is stripped.');
        break;
      case 'eclipse':
        this.pendingComboMult = 2.5;
        this.pendingComboDefPierce = 0.5;
        this.log.push('COMBO Eclipse — your next strike deals 2.5x damage and ignores 50% defense.');
        break;
      case 'perfect_riposte':
        this.freeActionCharges += 1;
        this.pendingComboMult = 1.5;
        this.log.push('COMBO Perfect Riposte — a free counter-strike lands immediately at +50% damage.');
        break;
      case 'full_knowledge':
        for (const e of this.aliveEnemies()) this.investigate(e._key, 4, []);
        for (const e of this.aliveEnemies()) {
          let s = this.windowStates.get(e._key);
          if (!s) {
            s = freshWindowState();
            this.windowStates.set(e._key, s);
          }
          s.turns = Math.max(s.turns, 2);
        }
        this.log.push('COMBO Full Knowledge — every enemy is revealed and weakness windows open.');
        break;
    }
  }

  attack(targetKey?: string): CombatSnapshot {
    if (this.phase !== 'player' || (this.playerAP < 1 && this.freeActionCharges < 1)) return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    const target = this.pickTarget(targetKey);
    if (!target) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.attack;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    this.actionsTakenThisRound += 1;
    this.recordAction('attack');
    let atk = this.player.derived.attack * statMultiplier(this.playerStatuses, 'atk');
    if (!this.firstAttackUsed && this.player.skillsKnown.includes('opening_strike')) {
      atk = Math.round(atk * 1.2);
    }
    const combo = this.pushComboTags(TAGS_ATTACK, target);
    const result = this.computeAndApplyDamage(target, atk, target.def, 'slash', 'Your attack');
    if (result.hit) this.firstAttackUsed = true;
    void combo;
    this.lastActionId = 'attack';
    this.lastActionType = 'slash';
    this.checkOutcome();
    return this.snapshot();
  }

  useSkill(skillId: string, targetKey?: string): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    const skill = NAMED_SKILLS[skillId];
    if (!skill || !this.player.skillsKnown.includes(skillId)) return this.snapshot();
    if (skill.apCost === 0) return this.snapshot(); // passives aren't activated

    if (hasStatus(this.playerStatuses, 'silence')) {
      this.log.push('You are Silenced and cannot use skills.');
      this.checkOutcome();
      return this.snapshot();
    }

    // Last Law: fossil_king prevents repeating the same skill twice in a row
    if ((this.fossilLastLawEnforced || this.flags.fossilLastLaw === 1) && this.lastActionId === `skill:${skillId}`) {
      this.log.push('The Last Law prohibits repeating the same skill. The action is wasted.');
      this.fossilLastLawEnforced = true;
      this.checkOutcome();
      return this.snapshot();
    }

    // MP cost check — before AP deduction
    const mpCost = skill.mpCost ?? 0;
    if (mpCost > 0 && this.player.currentMP < mpCost) {
      this.log.push(`Not enough MP (need ${mpCost}).`);
      this.checkOutcome();
      return this.snapshot();
    }

    const cost = this.freeActionCharges > 0 ? 0 : skill.apCost;
    if (this.playerAP < cost) return this.snapshot();
    this.playerAP -= cost;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    this.actionsTakenThisRound += 1;
    if (mpCost > 0) {
      this.player.currentMP = Math.max(0, this.player.currentMP - mpCost);
      this.player.fatigue = clampFatigue(this.player.fatigue + Math.floor(mpCost / 10) * 5);
    }
    this.recordAction(`skill:${skillId}`);
    this.pushComboTags(tagsForSkill(skill), this.pickTarget(targetKey));
    if (skill.tag === 'active_martyrs_flame') {
      this.player.currentHP = Math.max(1, this.player.currentHP - 10);
      const matk = this.player.derived.magicAttack * statMultiplier(this.playerStatuses, 'matk') * (skill.skillPower ?? 1);
      for (const e of this.aliveEnemies()) {
        this.computeAndApplyDamage(e, matk, e.mdef, 'sacred', "Martyr's Flame", 'mdef');
      }
      this.log.push("Martyr's Flame costs you 10 HP.");
    } else if (skill.tag === 'active_sealing_strike') {
      const target = this.pickTarget(targetKey);
      if (target) {
        const atk = this.player.derived.attack * statMultiplier(this.playerStatuses, 'atk');
        const result = this.computeAndApplyDamage(target, atk, target.def, 'sacred', 'Sealing Strike');
        if (result.hit) this.player.resonance = Math.max(0, this.player.resonance - 2);
      }
    } else if (skill.tag === 'active_reckless_swing') {
      const target = this.pickTarget(targetKey);
      if (target) {
        const selfCost = Math.max(1, Math.round(this.player.currentHP * 0.08));
        this.player.currentHP = Math.max(1, this.player.currentHP - selfCost);
        const atk = this.player.derived.attack * statMultiplier(this.playerStatuses, 'atk') * (skill.skillPower ?? 1);
        this.computeAndApplyDamage(target, atk, target.def, 'slash', 'Reckless Swing');
        this.log.push(`Reckless Swing costs you ${selfCost} HP.`);
      }
    } else if (skill.tag === 'active_hunters_mark') {
      const target = this.pickTarget(targetKey);
      if (target) {
        const atk = this.player.derived.attack * statMultiplier(this.playerStatuses, 'atk') * (skill.skillPower ?? 1);
        this.computeAndApplyDamage(target, atk, target.def, 'pierce', "Hunter's Mark", 'def', true);
      }
    } else if (skill.tag === 'active_overwritten_truth') {
      const target = this.pickTarget(targetKey);
      if (target) {
        const matk = this.player.derived.magicAttack * statMultiplier(this.playerStatuses, 'matk') * (skill.skillPower ?? 1);
        this.computeAndApplyDamage(target, matk, target.mdef, 'shock', 'Overwritten Truth', 'mdef');
      }
    } else if (skill.tag === 'active_veil_step') {
      this.veilStepGuaranteed = true;
      this.log.push('You go still, ready to slip the next blow entirely.');
    }

    if (!this.momentumUsedSkillThisCombat) {
      this.momentumUsedSkillThisCombat = true;
      this.gainMomentum(1);
    }
    this.lastActionId = `skill:${skillId}`;
    this.lastActionType = skill.damageType ?? null;
    const MAGIC_TYPES = ['shadow', 'sacred', 'shock', 'frost', 'flame'];
    if (skill.damageType && MAGIC_TYPES.includes(skill.damageType)) {
      this._playerUsedMagicLastTurn = true;
    }
    this.checkOutcome();
    return this.snapshot();
  }

  resonanceAbility(targetKey?: string): CombatSnapshot {
    if (this.phase !== 'player' || this.player.resonance < 25) return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    const baseCost = this.player.skillsKnown.includes('resonant_study') ? 1 : ACTION_AP_COST.resonance_ability;
    const cost = this.freeActionCharges > 0 ? 0 : baseCost;
    if (this.playerAP < cost) return this.snapshot();
    if (this.player.currentMP < 10) {
      this.log.push('Not enough MP to channel Resonance (need 10 MP).');
      this.checkOutcome();
      return this.snapshot();
    }
    this.player.currentMP -= 10;
    this.playerAP -= cost;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    this.actionsTakenThisRound += 1;
    this.recordAction('resonance_ability');
    const target = this.pickTarget(targetKey);
    if (target) {
      this.pushComboTags(['Elemental', 'Shadow'] as const, target);
      const matk = this.player.derived.magicAttack * statMultiplier(this.playerStatuses, 'matk');
      const effMdef = Math.round(target.mdef * 0.8);
      this.computeAndApplyDamage(target, matk, effMdef, 'shadow', 'Resonance Surge', 'mdef');
    }
    const resonanceCost = hasStatus(this.playerStatuses, 'fragile_perception') ? 2 : 1;
    this.player.resonance = Math.max(0, this.player.resonance - resonanceCost);
    this.lastActionId = 'resonance_ability';
    this.lastActionType = 'shadow';
    this._playerUsedMagicLastTurn = true;
    this.checkOutcome();
    return this.snapshot();
  }

  guard(): CombatSnapshot {
    if (this.phase !== 'player' || (this.playerAP < 1 && this.freeActionCharges < 1)) return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.guard;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    this.actionsTakenThisRound += 1;
    this.recordAction('guard');
    this.pushComboTags(tagsForGuard(this.player.skillsKnown.includes('retaliation')));
    this.guarding = true;
    this.player.fatigue = clampFatigue(this.player.fatigue - 10);
    this.log.push('You raise your guard. Fatigue eases.');
    this.lastActionId = 'guard';
    this.lastActionType = null;
    return this.snapshot();
  }

  focus(): CombatSnapshot {
    if (this.phase !== 'player' || (this.playerAP < ACTION_AP_COST.focus && this.freeActionCharges < 1)) return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.focus;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    this.actionsTakenThisRound += 1;
    this.recordAction('focus');
    const mpRestore = Math.min(this.player.derived.maxMP, this.player.currentMP + 15);
    this.player.currentMP = mpRestore;
    this.log.push('You focus your will, restoring 15 MP.');
    this.gainMomentum(1);
    this.lastActionId = 'focus';
    this.lastActionType = null;
    return this.snapshot();
  }

  brace(): CombatSnapshot {
    if (this.phase !== 'player' || (this.playerAP < ACTION_AP_COST.brace && this.freeActionCharges < 1)) return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.brace;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    this.actionsTakenThisRound += 1;
    this.recordAction('brace');
    applyStatus(this.playerStatuses, 'brace', 2);
    this.log.push('You brace yourself — Guard blocks 20% more damage for 2 turns.');
    this.lastActionId = 'brace';
    this.lastActionType = null;
    return this.snapshot();
  }

  useItem(itemId: string): CombatSnapshot {
    if (this.phase !== 'player' || (this.playerAP < 1 && this.freeActionCharges < 1)) return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    const item = ITEMS[itemId];
    const entry = this.player.inventory.find((i) => i.id === itemId && i.qty > 0);
    if (!item || !entry) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.use_item;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    this.actionsTakenThisRound += 1;
    this.recordAction('use_item');
    entry.qty -= 1;
    this.player.inventory = this.player.inventory.filter((i) => i.qty > 0);
    this.player.fatigue = clampFatigue(this.player.fatigue - 20);

    if (item.effect?.healPercent) {
      const heal = Math.round(this.player.derived.maxHP * (item.effect.healPercent / 100));
      this.player.currentHP = Math.min(this.player.derived.maxHP, this.player.currentHP + heal);
      this.log.push(`You use ${item.name}, healing ${heal} HP.`);
    }
    if (item.effect?.cureStatus) {
      for (const s of item.effect.cureStatus) {
        const idx = this.playerStatuses.findIndex((st) => st.id === s);
        if (idx >= 0) this.playerStatuses.splice(idx, 1);
      }
      this.log.push(`You use ${item.name}, curing ${item.effect.cureStatus.join(', ')}.`);
    }
    this.lastActionId = 'use_item';
    this.lastActionType = null;
    return this.snapshot();
  }

  analyze(targetKey?: string): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    const analyzeCost = this.player.skillsKnown.includes('cross_reference') ? 0 : ACTION_AP_COST.analyze;
    if (this.playerAP < analyzeCost && this.freeActionCharges < 1) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : analyzeCost;
    if (this.freeActionCharges > 0 && analyzeCost > 0) this.freeActionCharges -= 1;
    this.actionsTakenThisRound += 1;
    this.recordAction('analyze');
    const target = this.pickTarget(targetKey);
    if (target) {
      this.pushComboTags(TAGS_ANALYZE, target);
      (target as InternalEnemy)._revealed = true;
      this.investigate(target._key, 1, []);
      const def = ALL_ENEMY_DEFS[target.defId];
      const tend = this.tendencyFor(target);
      this.log.push(`You Scan ${target.name}.${def?.description ? ` ${def.description}` : ''}`);
      if (tend) this.log.push(`Tendency: ${tendencyName(tend)} — ${tendencyHint(tend)}`);
      if (target._isBoss && this.bossDef) {
        const phaseInfo = this.bossDef.getPhase(target.hp / target.maxHp);
        this.log.push(`It is in phase "${phaseInfo.label}" (${phaseInfo.key}).`);
      }
      const intent = this.intentDefFor(target);
      if (intent) this.log.push(`You sense what it intends: ${intent.label}.`);
    }
    this.gainMomentum(1);
    this.player.insight = Math.min(3, this.player.insight + 1);
    this.applyTokenDelta(1, 'Analysis sharpens the moment — +1 token refunded.');
    this.lastActionId = 'analyze';
    this.lastActionType = null;
    return this.snapshot();
  }

  private investigate(key: string, layer: number, probes: string[]): void {
    const inv = this.investigationOf(key);
    inv.layer = Math.max(inv.layer, layer);
    for (const p of probes) {
      if (!inv.probes.includes(p)) inv.probes.push(p);
    }
  }

  private investigationOf(key: string): { layer: number; probes: string[] } {
    let inv = this.investigations.get(key);
    if (!inv) {
      inv = { layer: 0, probes: [] };
      this.investigations.set(key, inv);
    }
    return inv;
  }

  private tendencyFor(e: InternalEnemy): EnemyTendency | undefined {
    if (e._isBoss && this.bossDef) return this.BOSS_TENDENCY[this.bossDef.id];
    return ALL_ENEMY_DEFS[e.defId]?.tendency;
  }

  private intentDefFor(e: InternalEnemy): IntentDef | BossIntentDef | undefined {
    const pid = this.pendingIntents.get(e._key);
    if (pid === undefined) return undefined;
    if (e._isBoss && this.bossDef) return this.bossDef.intents?.find((i) => i.id === pid);
    return ALL_ENEMY_DEFS[e.defId]?.intents?.find((i) => i.id === pid);
  }

  /** Probe (1 AP): a focused line of intel on the target. Requires a Scan first. */
  probe(targetKey: string | undefined, probeId: string): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    const target = this.pickTarget(targetKey);
    if (!target) return this.snapshot();
    const inv = this.investigationOf(target._key);
    if (inv.layer < 1) {
      this.log.push('You need to Scan the target before probing it.');
      return this.snapshot();
    }
    if (this.playerAP < 1 && this.freeActionCharges < 1) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : 1;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    this.actionsTakenThisRound += 1;
    this.recordAction('probe');
    this.investigate(target._key, 2, [probeId]);
    this.log.push(...this.probeIntel(target, probeId));
    if (this.player.stats.int >= 10) {
      this.log.push(this.probeBonus(target));
      this.log.push(this.probeBonus(target));
    } else if (this.player.stats.int >= 7) {
      this.log.push(this.probeBonus(target));
    }
    this.lastActionId = 'probe';
    this.lastActionType = null;
    return this.snapshot();
  }

  private probeIntel(e: InternalEnemy, probeId: string): string[] {
    const tend = this.tendencyFor(e);
    const intent = this.intentDefFor(e);
    const lines: string[] = [];
    switch (probeId) {
      case 'observe_body': {
        lines.push(`BODY — ${e.name} has ATK ${e.atk} / DEF ${e.def} / SPD ${e.spd}.`);
        const weaks = Object.entries(e.affinities).filter(([, v]) => v > 1).map(([t]) => t);
        const resists = Object.entries(e.affinities).filter(([, v]) => v < 1).map(([t]) => t);
        lines.push(`Weak to: ${weaks.join(', ') || 'nothing'}. Resists: ${resists.join(', ') || 'nothing'}.`);
        break;
      }
      case 'observe_mind': {
        if (tend) lines.push(`MIND — pattern suggests ${tendencyName(tend)}. ${tendencyHint(tend)}`);
        if (e._isBoss && this.bossDef) {
          const phase = this.bossDef.getPhase(e.hp / e.maxHp);
          lines.push(`It is in phase "${phase.label}" (${phase.key}).`);
        } else {
          lines.push('It reacts to damage, not to feints.');
        }
        break;
      }
      case 'observe_weapon': {
        const atkType = e.attackType;
        lines.push(`WEAPON — it favours ${atkType} strikes.${intent ? ` Next: ${intent.label} (${intent.description})` : ''}`);
        break;
      }
      case 'observe_memory': {
        const def = ALL_ENEMY_DEFS[e.defId];
        lines.push(`MEMORY — ${def?.description ?? 'It leaves no memory worth keeping.'}`);
        if (intent) lines.push(`It is gathering itself for "${intent.label}".`);
        break;
      }
      case 'observe_resonance': {
        if (e._isBoss && this.bossDef) {
          const phase = this.bossDef.getPhase(e.hp / e.maxHp);
          lines.push(`RESONANCE — phase shift arrives at ${Math.round(phase.hpFloorPercent * 100)}% HP.`);
        } else {
          lines.push('RESONANCE — no resonant phase; its pattern is steady.');
        }
        break;
      }
      default: {
        lines.push('Nothing more to observe.');
      }
    }
    return lines;
  }

  private probeBonus(e: InternalEnemy): string {
    const intent = this.intentDefFor(e);
    if (intent) return `Your intellect catches an extra thread — "${intent.label}": ${intent.description}`;
    return 'Your intellect catches an extra thread — no further intent, but its timing is now predictable.';
  }

  /** Deep Analysis (2 AP): full read on the target. Requires at least one probe. */
  deepAnalyze(targetKey?: string): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    const target = this.pickTarget(targetKey);
    if (!target) return this.snapshot();
    const inv = this.investigationOf(target._key);
    if (inv.probes.length === 0) {
      this.log.push('You need at least one Probe before a Deep Analysis.');
      return this.snapshot();
    }
    if (this.playerAP < 2 && this.freeActionCharges < 1) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : 2;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    this.actionsTakenThisRound += 1;
    this.recordAction('deep_analyze');
    this.investigate(target._key, 4, []);
    this.log.push(`DEEP ANALYSIS — ${target.name}:`);
    const pool = this.intentPoolFor(target);
    for (const i of pool) {
      this.log.push(`  ${i.label} — ${i.description}`);
    }
    this.lastActionId = 'deep_analyze';
    this.lastActionType = null;
    return this.snapshot();
  }

  private intentPoolFor(e: InternalEnemy): Array<{ id: string; label: string; description: string }> {
    if (e._isBoss && this.bossDef?.intents) return this.bossDef.intents.map((i) => ({ id: i.id, label: i.label, description: i.description }));
    return (ALL_ENEMY_DEFS[e.defId]?.intents ?? []).map((i) => ({ id: i.id, label: i.label, description: i.description }));
  }

  /** Spend 3 Insight on a combat-wide exploitation. */
  spendInsight(option: 'full_ai' | 'perfect_prediction' | 'focused_study' | 'weakness_window'): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    if (this.player.insight < 3) {
      this.log.push('You need 3 Insight for that.');
      return this.snapshot();
    }
    this.player.insight -= 3;
    if (option === 'full_ai') {
      for (const e of this.aliveEnemies()) this.investigate(e._key, 4, []);
      this.log.push('INSIGHT — you read the full pattern of every enemy.');
    } else if (option === 'perfect_prediction') {
      for (const e of this.aliveEnemies()) this.investigate(e._key, 3, []);
      this.log.push('INSIGHT — every intent on the field is now certain.');
    } else if (option === 'focused_study') {
      this.insightDamageBonus = true;
      this.log.push('INSIGHT — studied targets take +15% damage for the rest of the fight.');
    } else {
      for (const e of this.aliveEnemies()) {
        let s = this.windowStates.get(e._key);
        if (!s) {
          s = freshWindowState();
          this.windowStates.set(e._key, s);
        }
        s.turns = Math.max(s.turns, 2);
      }
      this.log.push('INSIGHT — you open a Weakness Window on every enemy for 2 rounds.');
    }
    return this.snapshot();
  }

  sunder(targetKey?: string): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    if (this.playerAP < ACTION_AP_COST.sunder && this.freeActionCharges < 1) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.sunder;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    this.actionsTakenThisRound += 1;
    this.recordAction('sunder');
    const target = this.pickTarget(targetKey);
    if (target) {
      this.pushComboTags(TAGS_SUNDER, target);
      applyStatus(target.statuses, 'armour_break', 2);
      this.log.push(`You Sunder ${target.name}'s armour. Defense -50% for 2 turns.`);
    }
    this.lastActionId = 'sunder';
    this.lastActionType = null;
    return this.snapshot();
  }

  withdraw(): CombatSnapshot {
    if (this.phase !== 'player' || (this.playerAP < 1 && this.freeActionCharges < 1)) return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    if (hasStatus(this.playerStatuses, 'root')) {
      this.log.push('You are rooted and cannot flee.');
      this.checkOutcome();
      return this.snapshot();
    }
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.withdraw;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    this.actionsTakenThisRound += 1;
    this.recordAction('withdraw');
    const alive = this.aliveEnemies();
    const avgSpd = alive.reduce((s, e) => s + this.enemyEffectiveSpeed(e), 0) / Math.max(1, alive.length);
    const chance = Math.max(10, Math.min(90, 60 + (this.effectivePlayerSpeed() - avgSpd)));
    if (this.rng() * 100 < chance) {
      this.phase = 'fled';
      this.restoreOverclockedMaxHp();
      this.log.push('You break away and withdraw from the fight.');
    } else {
      this.log.push('You fail to withdraw.');
    }
    this.lastActionId = 'withdraw';
    this.lastActionType = null;
    return this.snapshot();
  }

  resolveMomentum(choice: MomentumChoice): CombatSnapshot {
    if (this.phase !== 'momentum_choice') return this.snapshot();
    this.player.momentum = 0;
    if (choice === 'flow') {
      this.playerAP += 2;
      applyStatus(this.playerStatuses, 'exhausted', 1);
      this.log.push('Momentum: Flow — you act again immediately, but will start next round exhausted.');
    } else if (choice === 'harmony') {
      const heal = Math.round(this.player.derived.maxHP * 0.25);
      this.player.currentHP = Math.min(this.player.derived.maxHP, this.player.currentHP + heal);
      this.bossEnrageTurns = this.bossDef ? 2 : 0;
      this.log.push(`Momentum: Harmony — restored ${heal} HP${this.bossDef ? '; the boss enrages (+30% damage).' : '.'}`);
    } else if (choice === 'archive') {
      const boss = this.enemies.find((e) => e._isBoss && e.hp > 0);
      if (boss && this.bossDef) {
        const phaseLabel = this.bossDef.getPhase(boss.hp / boss.maxHp).label;
        this.log.push(`Momentum: Archive — you remember this phase: ${phaseLabel}.`);
      } else {
        this.log.push('Momentum: Archive — nothing to recall; the fight stays as it is.');
      }
    } else if (choice === 'forgotten_technique') {
      this.freeActionCharges += 1;
      this.log.push('Momentum: Forgotten Technique — your next action costs 0 AP.');
    } else if (choice === 'unravel') {
      this.unravelPending = true;
      this.log.push('Momentum: Unravel — your next hit deals 2.5x damage, ignoring 75% Defense.');
    } else if (choice === 'echo_surge') {
      applyStatus(this.playerStatuses, 'echo_surge', 2);
      this.log.push('Momentum: Echo Surge — all your damage +20% for 2 turns.');
    } else if (choice === 'phase_shift') {
      this.phaseShiftCharges = 2;
      this.log.push('Momentum: Phase Shift — you will dodge the next 2 attacks.');
    } else if (choice === 'desperate_strike') {
      this.desperateStrike = true;
      this.log.push('Momentum: Desperate Strike — all your attacks crit this turn.');
    } else if (choice === 'overclock') {
      if (this.overclockMaxHpReduced === null) {
        this.overclockMaxHpReduced = this.player.derived.maxHP;
        this.player.derived.maxHP = Math.max(1, Math.round(this.player.derived.maxHP * 0.8));
        this.player.currentHP = Math.min(this.player.currentHP, this.player.derived.maxHP);
      }
      this.overclockActive = true;
      this.log.push('Momentum: Overclock — +70% damage this turn, in exchange for 20% of your max HP.');
    }
    this.phase = 'player';
    return this.snapshot();
  }

  private _prevActionId: string | null = null;

  // ---- Rewards / teardown -----------------------------------------------------

  getFlags(): Record<string, number> {
    return this.flags;
  }

  getEnemiesKilled(): number {
    return this.enemies.filter((e) => e.hp <= 0).length;
  }

  /** Phase 3: returns and clears the queued reaction/combo banners since the last read. */
  drainBanners(): string[] {
    const banners = [...this.pendingBanners];
    this.pendingBanners = [];
    return banners;
  }

  getXpEarned(): number {
    const base = this.enemies.filter((e) => e.hp <= 0).reduce((s, e) => s + e.xp, 0);
    const bonus = this.player.skillsKnown.includes('archival_insight') ? 1.1 : 1;
    const pageMult = 1 + (this.page - 1) * 0.15;
    return Math.round(base * bonus * pageMult);
  }

  snapshot(): CombatSnapshot {
    const bossAlive = this.enemies.find((e) => e._isBoss && e.hp > 0);
    const aliveEnemies = this.enemies.filter((e) => e.hp > 0);
    const playerSpd = this.effectivePlayerSpeed();
    const sortedEnemies = [...this.aliveEnemies()].sort((a, b) => this.enemyEffectiveSpeed(b) - this.enemyEffectiveSpeed(a));
    const initiativeOrder = [
      'player',
      ...sortedEnemies.map((e) => e._key),
    ];
    return {
      round: this.round,
      phase: this.phase,
      playerAP: this.playerAP,
      bankedAP: this.bankedAP,
      freeActionCharges: this.freeActionCharges,
      playerHP: this.player.currentHP,
      playerMaxHP: this.player.derived.maxHP,
      playerMP: this.player.currentMP,
      playerMaxMP: this.player.derived.maxMP,
      playerSpd,
      playerStatuses: this.playerStatuses,
      momentum: this.player.momentum,
      guarding: this.guarding,
      fatigue: this.player.fatigue,
      insight: this.player.insight,
      enemies: this.enemies
        .filter((e) => e.hp > 0 || this.phase === 'victory')
        .map((e) => {
          const layer = this.investigations.get(e._key)?.layer ?? 0;
          const probes = this.investigations.get(e._key)?.probes ?? [];
          const pid = this.pendingIntents.get(e._key);
          const intentDef = pid !== undefined
            ? (e._isBoss && this.bossDef
              ? this.bossDef.intents?.find((i) => i.id === pid)
              : ALL_ENEMY_DEFS[e.defId]?.intents?.find((i) => i.id === pid))
            : undefined;
          return {
            key: e._key,
            name: e.name,
            hp: e.hp,
            maxHp: e.maxHp,
            alive: e.hp > 0,
            statuses: e.statuses,
            revealed: e._revealed,
            revealCount: this.player.skillsKnown.includes('librarians_eye') ? 2 : 1,
            affinities: e.affinities,
            atk: e.atk,
            def: e.def,
            spd: this.enemyEffectiveSpeed(e),
            tendency: tendencyGlyph(this.tendencyFor(e)),
            investigationLayer: layer,
            investigationProbes: probes,
            pendingIntent: intentDef ? { id: intentDef.id, label: intentDef.label, confidence: confidenceFor(layer) } : null,
            weakWindowTurns: this.windowStates.get(e._key)?.turns ?? 0,
            weakHitStreak: this.windowStates.get(e._key)?.streak ?? 0,
            lastHitType: this.lastHitTypes.get(e._key),
          };
        }),
      initiativeOrder,
      playerHitEnemyKeys: [...this.playerHitEnemyKeys],
      log: this.log,
      bossPhaseLabel: bossAlive && this.bossDef ? this.bossDef.getPhase(bossAlive.hp / bossAlive.maxHp).label : undefined,
      banners: [...this.pendingBanners],
      comboStacks: this.comboCount,
    };
  }
}
