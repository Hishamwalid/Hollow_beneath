import type {
  AdaptationId,
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
  SkillDef,
  StatusId,
  StatusInstance,
  StressBand,
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
  removeAllDebuffs,
  removeDebuffs,
  setBarrier,
  statMultiplier,
  tickDots,
  tickDurations,
} from './StatusEffectSystem';
import { fatiguePenalty, clampFatigue } from './combat/FatigueSystem';
import { pickCrisis, markCrisisSeen, CRISES, type CrisisId, type CrisisOption } from './combat/CrisisSystem';
import { clampFear, FEAR_MASSIVE_GAIN, FEAR_MASSIVE_PCT, FEAR_CRIT_GAIN, FEAR_ULTIMATE_GAIN, fearModifiers, BRAVERY_ACTIONS, type BraveryActionDef } from './combat/FearSystem';
import { DESPERATIONS, pickDesperation, rollDesperation, DESPERATION_HP_PCT, type DesperationId } from './combat/DesperationSystem';
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
// ---- Phase 5: companion / ally systems ----
import { ALLY_DEFS, tierForLoyalty, type AllyDef, type AllyAbilityDef } from './ally/AllyDefs';
import {
  accompaniesIn,
  hasCooldown,
  loyaltyGain,
  setCooldown,
  type AllySaveState,
} from './ally/AllyTracking';
import { planAllyTurn, type AllyCombatInput, type AllyTurnPlan } from './ally/AllyCombat';
import { bossAssist, type BossAssistInput } from './ally/AllyBoss';
// ---- Phase 5: boss intelligence (profiling / stress / adaptation / tells) ----
import {
  createProfile,
  profileView,
  recordAction,
  recordAnalyze,
  recordBuffUsed,
  recordCombo,
  recordCrit,
  recordDamage,
  recordGuard,
  recordHeal,
  recordItem,
  recordMomentumSpend,
  recordRepeat,
  recordStatusApplied,
  recordTurn,
  recordWeaknessHit,
} from './combat/ProfileSystem';
import { bandFor, stressFor, STRESS_BAND_ORDER } from './combat/StressSystem';
import { ADAPTATION_META, evaluateAdaptation } from './combat/AdaptationSystem';
import { chargeBanner, chargeLabel, chargeLog, unleashBanner, unleashLog, adaptationBanner } from './combat/TellSystem';

const ALL_ENEMY_DEFS = { ...ENEMIES, ...SUMMON_ENEMIES };

export type CombatPhase = 'player' | 'momentum_choice' | 'crisis' | 'victory' | 'defeat' | 'fled';

export interface CombatSetup {
  player: PlayerState;
  enemyIds: string[];
  page: number;
  rng: () => number;
  bossDef?: BossDef;
  precombatFlags?: Record<string, number>;
  playerHistory: Set<string>;
  /** Phase 5: companions accompanying the player into this fight. */
  allies?: AllySaveState[];
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
  pendingIntent: { id: string; label: string; confidence: IntentConfidence; charged?: boolean } | null;
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
  /** Phase 4d: crisis waiting for the player to pick from a modal (null if none). */
  pendingCrisis?: { id: CrisisId; title: string; flavor: string; options: CrisisOption[] };
  /** Phase 4e: hidden fear gauge 0-100 (HUD may show a shiver when >50). */
  fear: number;
  /** Phase 5: companions present in the fight (name, loyalty, tier, last action note). */
  allies: Array<{ id: string; name: string; loyalty: number; tier: string; action: string }>;
  /** Phase 5: boss intelligence read-out (stress band, adaptations; absent for non-boss fights). */
  bossIntel?: BossIntelView;
}

/** Phase 5: the boss's live read on the player, exported for the HUD. */
export interface BossIntelView {
  stress: number;
  band: StressBand;
  adaptations: AdaptationId[];
  resistType: DamageType | null;
  chargedLabel: string | null;
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

  // ---- Phase 4b: class identity state (passives + signatures + progression) ----
  /** Warrior Rage: +1 per 10% HP lost (intsect), +5% dmg each, max 5. */
  private rageStacks = 0;
  /** Ranger Precision: +15% crit per dodge, max 3. */
  private precisionStacks = 0;
  /** Guardian Resolve: +1 per guard turn; spend 3 to nullify a hit. */
  private resolveStacks = 0;
  /** Scholar Knowledge: +5% damage per Analyze (max 3). */
  private knowledgeStacks = 0;
  /** Balanced Adaptation: +10% damage per unique ActionId used this combat (max 5). */
  private adaptationActions = new Set<string>();
  /** Next single attack amplified (signatures). */
  private nextAttackMult = 1;
  private nextAttackGuaranteed = false;
  /** Shadow stealth — untargetable until the next attack. */
  private stealthActive = false;
  /** Warrior Last Stand: +dmg% & +guard% for N turns. */
  private lastStandTurns = 0;
  /** Guardian Aegis: +guard% for N turns. */
  private aegisTurns = 0;
  private aegisGuard = 0;
  /** Scholar Arcane Thesis: override spell damage type for N turns + pierce resist. */
  private thesisType: DamageType | null = null;
  private thesisTurns = 0;
  /** Balanced Mirror Adapt: +15% all stats for N turns. */
  private mirrorTurns = 0;
  /** Per-enemy Death's Mark: +50% incoming damage for N turns (key -> turns). */
  private marked = new Map<string, number>();
  /** Ranger/Shadow next-attack-cannot-miss / crit conditions set by signatures. */
  private eagleAccuracyTurns = 0;
  /** Guardian Counter: reflect 100% of the next physical hit. */
  private reflectPhysical = false;
  /** Forced criticals remaining (signature/progression hooks). */
  private forcedCrits = 0;
  /** Unity's Blade: this skill's damage ignores 30% defense. */
  private unityBlade = false;
  /** Crisis All-In: the player gambles a 30% death chance on their next damaging attack. */
  private allInPending = false;

  // ---- Phase 4 crisis-option & desperation effect state ----
  /** Revelation-Exploit Focus: treat the target as weak (best affinity x2) for N turns. */
  private alwaysWeakTurns = 0;
  /** Revelation-Share: +20% damage vs this damage type for the fight. */
  private fightTypeBuff: DamageType | null = null;
  /** Critical Moment-Cascade: +100% damage this turn after spending all momentum. */
  private cascadeThisTurn = false;
  /** Fate's Edge-Final Stand: +50% damage for N turns. */
  private playerDmgMultTurns = 0;
  /** Last Prayer: +30% damage for N turns. */
  private lastPrayerDmgTurns = 0;
  /** Incoming damage multiplier (Final Stand x2 / Broken Resolve x1.8) for N turns. */
  private incomingMultTurns = 0;
  private incomingMultFactor = 1;
  /** Fate's Edge-Prolong: enemies deal 30% less damage for N turns. */
  private enemyDmgReduceTurns = 0;
  /** Desperation-Broken Resolve: next 3 attacks deal 2x. */
  private desperation2xCharges = 0;
  /** Desperation-One Last Memory: healing sealed for the fight. */
  private noHeal = false;
  /** Desperation-One Last Memory: attacks ignore defense for the fight. */
  private armorPierceAll = false;
  /** Desperation-Burn the Archive: +30% damage for the fight. */
  private fightDmgBuff = 0;

  // ---- Phase 4d/e/f: Crisis, Fear, Desperation ----
  private crisisSeen: CrisisId[] = [];
  /** Snapshot-exposed pending crisis the scene must present as a modal. */
  private pendingCrisisId: CrisisId | null = null;
  /** Hidden 0-100 fear gauge. */
  private fear = 0;
  private desperationFired: DesperationId[] = [];
  /** First weakness ever revealed (drives the Revelation crisis). */
  private firstWeaknessRevealed = false;

  // ---- Phase 5: companion / ally systems ----
  /** Companion save-states carried into this fight (mutated on victory/defeat). */
  private allyStates: AllySaveState[] = [];
  /** True while the ally absorbed the next hit meant for the player (Aegis Body). */
  private allyGuardAbsorb = 0;
  /** Once-per-combat loyalty/reward accounting. */
  private allyRewardsApplied = false;
  /** First Church Word: the boss cannot act first this combat. */
  private allyDenyBossFirstTurn = false;

  // ---- Phase 5: boss intelligence state (profiling / stress / adaptations) ----
  /** Combat-local 12-metric trace of the player's behaviour. */
  private profile = createProfile();
  /** Stress nudges: player aggression vs. caution (pure counters; merged with HP loss at read time). */
  private bossAggression = 0;
  private bossCalm = 0;
  /** Adaptations the boss has learned (ids only; effects live in the engine). */
  private adaptations: AdaptationId[] = [];
  /** Favourite-element resistance learned via adaptation. */
  private bossResistType: DamageType | null = null;
  /** Phase 5: telegraphed ultimate waiting to be unleashed next boss turn. */
  private chargedIntent: BossIntentDef | null = null;
  /** Boss round during which the charge was declared (must pass before it can unleash). */
  private chargedRound = -1;

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
    this.allyStates = (setup.allies ?? []).map((a) => ({ ...a }));

    if (this.player.skillsKnown.includes('chorus_echo')) {
      this.player.momentum = Math.max(this.player.momentum, 1);
    }

    if (setup.bossDef) {
      this.enemies.push(this.buildBossCombatant(setup.bossDef));
      if (setup.bossDef.persona) {
        this.log.push(`${setup.bossDef.name} — the ${setup.bossDef.persona.label}. ${setup.bossDef.persona.blurb}`);
      }
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
    recordTurn(this.profile);
    for (const e of this.enemies) if (e._isBoss) e.flags.martyrShockFired = 0;
    this.playerAP = 3 + (this.round === 1 && this.player.skillsKnown.includes('borrowed_time') ? 1 : 0) + this.bankedAP;
    this.bankedAP = 0;
    this.guarding = false;
    this.veilStepGuaranteed = false;
    this.nextAttackMult = 1;
    this.nextAttackGuaranteed = false;
    this.allInPending = false;
    this.stealthActive = false;
    this.unityBlade = false;
    this.fossilLastLawEnforced = false;
    this.desperateStrike = false;
    this.actionsTakenThisRound = 0;
    this.flags.fossilLastLaw = 0;
    this.overclockActive = false;
    this.cascadeThisTurn = false;
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
    // Phase 5: First Church Word — a loyal zealot can deny the boss its opening move.
    if (this.round === 1) {
      this.allyDenyBossFirstTurn = this.allyStates.some((st) => {
        if (hasCooldown(st, 'first_church_word')) return false;
        const def = this.allyDefFor(st);
        const assist = bossAssist(def, st, this.allyBossAssistInput(false));
        return assist.denyFirstStrike;
      });
      if (this.allyDenyBossFirstTurn) this.log.push('A companion speaks the First Church Word — the boss cannot begin moving.');
    }
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
    // Phase 4d: check whether a crisis should interrupt the start of the player turn.
    if (this.phase === 'player') this.checkCrisis();
    if (this.phase === 'player') this.checkDesperation();
    return this.snapshot();
  }

  endPlayerPhase(): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    this.lastActionRepeated = this.lastActionId !== null && this.lastActionId === this._prevActionId;
    this._prevActionId = this.lastActionId;
    if (this.lastActionRepeated) recordRepeat(this.profile);

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
      const regenAmt = this.interdictedHeal(Math.round(this.player.derived.maxHP * 0.05));
      this.player.currentHP = Math.min(this.player.derived.maxHP, this.player.currentHP + regenAmt);
      if (regenAmt > 0) recordHeal(this.profile, regenAmt);
      this.log.push(`Regeneration restores ${regenAmt} HP.`);
    }
    tickDurations(this.playerStatuses).forEach((m) => this.log.push(m));
    if (this.lastStandTurns > 0) this.lastStandTurns -= 1;
    if (this.alwaysWeakTurns > 0) this.alwaysWeakTurns -= 1;
    if (this.playerDmgMultTurns > 0) this.playerDmgMultTurns -= 1;
    if (this.lastPrayerDmgTurns > 0) this.lastPrayerDmgTurns -= 1;
    if (this.incomingMultTurns > 0) {
      this.incomingMultTurns -= 1;
      if (this.incomingMultTurns === 0) this.incomingMultFactor = 1;
    }
    if (this.enemyDmgReduceTurns > 0) this.enemyDmgReduceTurns -= 1;
    if (this.thesisTurns > 0) { this.thesisTurns -= 1; if (this.thesisTurns === 0) this.thesisType = null; }
    if (this.aegisTurns > 0) { this.aegisTurns -= 1; if (this.aegisTurns === 0) this.aegisGuard = 0; }
    if (this.mirrorTurns > 0) this.mirrorTurns -= 1;
    if (this.eagleAccuracyTurns > 0) this.eagleAccuracyTurns -= 1;
    for (const [key, turns] of this.marked) {
      const next = turns - 1;
      if (next <= 0) this.marked.delete(key);
      else this.marked.set(key, next);
    }

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
    if (this.phase === 'player') this.resolveAllyTurns();
    this.checkOutcome();
    return this.snapshot();
  }

  private checkOutcome(): void {
    if (this.player.currentHP <= 0) {
      // Phase 5: a devoted courier refuses to let the letter end here.
      if (this.tryAllyRevive()) {
        this.log.push('Your companion pulls you back from the threshold.');
      } else if (this.player.skillsKnown.includes('unfinished_sentence') && !this.player.flags.deathWardUsed) {
        this.player.flags.deathWardUsed = true;
        this.player.currentHP = 1;
        this.log.push('Unfinished Sentence: the killing blow leaves you at 1 HP instead.');
      } else {
        this.phase = 'defeat';
        this.restoreOverclockedMaxHp();
        this.applyAllyRewards();
        return;
      }
    }
    if (this.aliveEnemies().length === 0) {
      this.phase = 'victory';
    }
    if (this.phase === 'victory') {
      this.restoreOverclockedMaxHp();
      this.applyAllyRewards();
    }
  }

  /** Phase 5: Bitter Revival — a devoted courier restores the player at 20% HP (once per combat). */
  private tryAllyRevive(): boolean {
    for (const state of this.allyStates) {
      if (state.id !== 'covenant_courier' || !accompaniesIn(state.loyalty) || hasCooldown(state, 'bitter_revival')) continue;
      const def = this.allyDefFor(state);
      const assist = bossAssist(def, state, this.allyBossAssistInput(true));
      if (assist.reviveAvailable) {
        this.player.currentHP = assist.reviveHealAmount;
        setCooldown(state, 'bitter_revival', true);
        return true;
      }
    }
    return false;
  }

  /** Phase 5: once per combat, tabulate loyalty and battle counts for companions. */
  private applyAllyRewards(): void {
    if (this.allyRewardsApplied) return;
    this.allyRewardsApplied = true;
    for (const state of this.allyStates) {
      if (!accompaniesIn(state.loyalty)) continue;
      state.battlesTogether += 1;
      const delta = loyaltyGain(state, this.phase === 'victory');
      if (delta > 0) this.log.push(`${this.allyDefFor(state).name}'s loyalty deepens (+${delta}).`);
    }
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
      // Phase 5: a denied opening — the boss wastes its first round.
      if (this.allyDenyBossFirstTurn) {
        this.allyDenyBossFirstTurn = false;
        this.log.push(`${enemy.name} stands frozen, forbidden its first word.`);
        const zealot = this.allyStates.find((s) => s.id === 'sable_zealot');
        if (zealot) setCooldown(zealot, 'first_church_word', true);
        return;
      }
      this.bossOwnTurnCounter += 1;
      const hpPercent = enemy.hp / enemy.maxHp;
      const phaseInfo = this.bossDef.getPhase(hpPercent);
      enemy.affinities = { ...phaseInfo.affinities };
      // Phase 5: a declared ultimate unleashes instead of a fresh intent.
      if (this.isChargeDue() && this.unleashCharge(enemy)) {
        if (this.bossOwnTurnCounter % 3 === 0) this.maybeAdapt(enemy);
        this.checkOutcome();
        return;
      }
      const ctx = this.makeBossTurnCtx(enemy, this.bossOwnTurnCounter, phaseInfo.key);
      const intentId = this.pendingIntents.get(enemy._key);
      const intent = this.bossDef.intents?.find((i) => i.id === intentId);
      this.pendingIntents.delete(enemy._key);
      if (intent) intent.resolve(ctx);
      else this.bossDef.takeTurn(ctx);
      // Phase 5: adaptation checks fire every 3rd boss turn.
      if (this.bossOwnTurnCounter % 3 === 0) this.maybeAdapt(enemy);
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
        // Phase 5: a declared ultimate occupies the telegraph slot; no fresh intent is picked.
        if (this.chargedIntent) continue;
        const phaseInfo = this.bossDef.getPhase(e.hp / e.maxHp);
        const ctx = this.makeBossTurnCtx(e, this.bossOwnTurnCounter + 1, phaseInfo.key);
        const picked = pickBossIntent(this.bossDef.intents, ctx, this.rng);
        if (picked) {
          if (picked.charge) this.declareCharge(e, picked);
          else this.pendingIntents.set(e._key, picked.id);
        }
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
    const pv = this.playerCombatView();
    // Phase 5 adaptations read the player's defense through the boss's learned counters.
    if (this.adaptations.includes('armor_pierce')) pv.def = Math.round(pv.def * 0.5);
    if (this.bossBand() === 'critical') {
      // Desperate: +30% damage => the boss bypasses 30% of your defenses.
      pv.def = Math.round(pv.def * 0.7);
      pv.mdef = Math.round(pv.mdef * 0.7);
    }
    return {
      self: enemy,
      player: pv,
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
      stress: this.bossStress(),
      band: this.bossBand(),
      adaptations: [...this.adaptations],
    };
  }

  // ---- Phase 5: boss intelligence helpers ---------------------------------------

  private bossAlive(): InternalEnemy | undefined {
    return this.enemies.find((e) => e._isBoss && e.hp > 0);
  }

  private bossStress(): number {
    const boss = this.bossAlive();
    const hpPct = boss ? boss.hp / boss.maxHp : 1;
    return stressFor(hpPct, this.bossAggression, this.bossCalm);
  }

  private bossBand(): StressBand {
    return bandFor(this.bossStress());
  }

  private bossIntelView(): BossIntelView | null {
    if (!this.bossDef) return null;
    return {
      stress: this.bossStress(),
      band: this.bossBand(),
      adaptations: [...this.adaptations],
      resistType: this.bossResistType,
      chargedLabel: this.chargedIntent ? this.chargedIntent.label : null,
    };
  }

  private nudgeAggression(amount: number): void {
    if (this.bossDef) this.bossAggression += amount;
  }

  private nudgeCalm(amount: number): void {
    if (this.bossDef) this.bossCalm += amount;
  }

  private unreadable(): boolean {
    return this.bossDef !== undefined && this.adaptations.includes('unreadable');
  }

  private sureRead(key: string): boolean {
    return (this.investigations.get(key)?.layer ?? 0) >= 3;
  }

  /** Player healing passes through this — the Interdict adaptation halves it. */
  private interdictedHeal(amount: number): number {
    if (this.bossDef && this.adaptations.includes('interdict')) return Math.max(0, Math.round(amount * 0.5));
    return amount;
  }

  /** Every 3rd boss turn, the boss evaluates its profile and learns one counter. */
  private maybeAdapt(enemy: InternalEnemy): void {
    if (this.phase === 'victory' || this.phase === 'defeat' || this.phase === 'fled') return;
    const id = evaluateAdaptation(profileView(this.profile), this.adaptations);
    if (!id) return;
    this.adaptations.push(id);
    const meta = ADAPTATION_META[id];
    this.log.push(`${enemy.name} has learned: ${meta.text}`);
    this.pendingBanners.push(adaptationBanner(meta.label));
    this.nudgeAggression(3);
    switch (id) {
      case 'magic_shield':
        enemy.mdef = Math.round(enemy.mdef * 1.4);
        break;
      case 'blind_marksman':
        this.applyStatusToPlayerChecked('blind', 3);
        break;
      case 'elemental_resistance':
        this.bossResistType = profileView(this.profile).favoriteElement;
        break;
      case 'dispel_conclave':
        removeAllBuffs(this.playerStatuses);
        this.log.push(`${enemy.name} dispels your enhancements.`);
        break;
      default:
        // armor_pierce / unreadable / resonance_drain / interdict / echo_lock
        // are handled at their engine touch-points.
        break;
    }
  }

  /** Declares a charged ultimate: shown to the player, unleashed on the boss's NEXT turn. */
  private declareCharge(enemy: InternalEnemy, intent: BossIntentDef): void {
    this.chargedIntent = intent;
    this.chargedRound = this.round;
    this.log.push(chargeLog(enemy.name, intent.label));
    this.pendingBanners.push(chargeBanner(enemy.name, intent.label));
  }

  /** True when an already-declared charge may unleash (the declaration round has fully passed). */
  private isChargeDue(): boolean {
    return this.chargedIntent !== null && this.round > this.chargedRound;
  }

  /** Resolves the declared ultimate; returns true when a charge was unleashed. */
  private unleashCharge(enemy: InternalEnemy): boolean {
    const intent = this.chargedIntent;
    if (!intent) return false;
    this.chargedIntent = null;
    const phaseInfo = this.bossDef ? this.bossDef.getPhase(enemy.hp / enemy.maxHp) : null;
    const ctx = this.makeBossTurnCtx(enemy, this.bossOwnTurnCounter, phaseInfo?.key ?? '');
    intent.resolve(ctx);
    this.log.push(unleashLog(enemy.name, intent.label));
    this.pendingBanners.push(unleashBanner(enemy.name, intent.label));
    return true;
  }

  private spawnAdd(enemyId: string, hpOverride?: number): void {
    if (this.enemies.filter((e) => e.hp > 0).length >= 4) return; // capacity cap
    const uniqueKey = `${enemyId}_${this.enemies.length}_${this.round}`;
    const enemy = this.buildEnemyCombatant(enemyId, hpOverride);
    enemy._key = uniqueKey;
    this.enemies.push(enemy);
  }

  // ---- Phase 5: companion turns ----------------------------------------------

  private allyDefFor(state: AllySaveState): AllyDef {
    return ALLY_DEFS[state.id];
  }

  /** View of the battle an ally reasons over (deterministic; drives planAllyTurn). */
  private allyCombatInput(def: AllyDef, state: AllySaveState): AllyCombatInput {
    return {
      playerHp: this.player.currentHP,
      playerMaxHp: this.player.derived.maxHP,
      playerHasDebuff: this.playerStatuses.some((s) => ['poison', 'bleed', 'curse', 'shock_dot', 'wound'].includes(s.id)),
      playerGuarding: this.guarding,
      playerMomentum: this.player.momentum,
      round: this.round,
      bossPhaseKey: (() => {
        const boss = this.enemies.find((e) => e._isBoss && e.hp > 0);
        return boss && this.bossDef ? this.bossDef.getPhase(boss.hp / boss.maxHp).key : null;
      })(),
      enemies: this.aliveEnemies().map((e) => ({
        key: e._key,
        hpFraction: e.hp / e.maxHp,
        isBoss: e._isBoss,
        hasDebuff: e.statuses.length > 0,
      })),
    };
  }

  /** Companion takes one action per round, resolved at round end after enemies act. */
  private resolveAllyTurns(): void {
    if (this.phase === 'victory' || this.phase === 'defeat' || this.phase === 'fled') return;
    for (const state of this.allyStates) {
      if (!accompaniesIn(state.loyalty)) continue;
      const def = this.allyDefFor(state);
      if (this.rng() > def.profile.reliability) {
        if (this.rng() > def.profile.reliability) {
          this.log.push(`${def.name} fumbles, nearly tripping over the battlefield.`);
        }
        continue;
      }
      const plan = planAllyTurn(def, state.loyalty, this.allyCombatInput(def, state));
      this.executeAllyPlan(def, state, plan);
      this.log.push(plan.line);
    }
  }

  /** Applies the planned ally action with engine-appropriate consequences. */
  private executeAllyPlan(def: AllyDef, state: AllySaveState, plan: AllyTurnPlan): void {
    const action = plan.action;
    const profile = def.profile;
    const target = action.kind === 'attack' || action.kind === 'support'
      ? this.enemies.find((e) => e._key === action.targetKey)
      : undefined;

    switch (action.kind) {
      case 'heal': {
        if (this.noHeal) {
          this.log.push(`${def.name} tries to mend you, but One Last Memory seals all healing.`);
          return;
        }
        const amount = Math.max(1, Math.round(this.player.derived.maxHP * profile.healPct));
        this.player.currentHP = Math.min(this.player.derived.maxHP, this.player.currentHP + amount);
        this.log.push(`${def.name} restores ${amount} HP.`);
        return;
      }
      case 'guard': {
        this.allyGuardAbsorb = Math.max(this.allyGuardAbsorb, 1);
        return;
      }
      case 'attack': {
        if (!target) return;
        const useMagic = profile.matkPct > profile.atkPct;
        const power = Math.round((useMagic ? this.player.derived.magicAttack : this.player.derived.attack) * (useMagic ? profile.matkPct : profile.atkPct) * (1 + state.loyalty / 400));
        const result = this.computeAndApplyDamage(target, power, useMagic ? target.mdef : target.def, profile.damageType, `${def.name}'s attack`, useMagic ? 'mdef' : 'def', false, false);
        if (result.hit && result.crit) this.log.push(`${def.name} lands a critical blow!`);
        return;
      }
      case 'support': {
        this.applyAllySupport(def, state, target);
        return;
      }
      case 'overwatch': {
        // Last Oath: pre-armed reaction — handled reactively in dealDamageToPlayer.
        this.log.push(`${def.name} holds an overwatch — a blow that would end you is already refused.`);
        return;
      }
      case 'wait': {
        return;
      }
    }
  }

  /** Support abilities resolved by id (framework flavor, engine effects). */
  private applyAllySupport(def: AllyDef, state: AllySaveState, target?: InternalEnemy): void {
    const ability = def.abilities.find((a) => a.kind === 'support');
    if (!ability) return;
    switch (ability.id) {
      case 'rooted_hold':
        this.enemyDmgReduceTurns = Math.max(this.enemyDmgReduceTurns, 2);
        this.log.push(`${def.name} anchors the ground — enemy damage -30% while it holds.`);
        break;
      case 'mercy_pact': {
        if (this.noHeal) {
          this.log.push(`${def.name} reaches to heal, but the seal holds.`);
          break;
        }
        removeDebuffs(this.playerStatuses);
        const amount = Math.round(this.player.derived.maxHP * 0.1);
        this.player.currentHP = Math.min(this.player.derived.maxHP, this.player.currentHP + amount);
        this.log.push(`${def.name} untangles the maledictions — +${amount} HP.`);
        break;
      }
      case 'annotation':
        this.nextAttackGuaranteed = true;
        this.log.push(`${def.name} marks a line on your map — your next hit cannot miss.`);
        break;
      case 'corrosion_graph':
        if (target) {
          applyStatus(target.statuses, 'defense_down', 2);
          this.log.push(`${def.name} redraws the defense — ${target.name} Defense -20% for 2 rounds.`);
        }
        break;
    }
  }

  /** Phase 5: ally reactions at the moment damage lands (guard, warden vigil, overwatch). */
  private allyDamageMitigation(amount: number): number {
    let dmg = amount;
    if (this.allyGuardAbsorb > 0) {
      this.allyGuardAbsorb = 0;
      dmg = Math.round(dmg * 0.4);
      this.log.push('A companion throws itself between you and the blow — damage 60% absorbed.');
    }
    if (dmg > 0) {
      const warden = this.allyStates.find((s) => s.id === 'warden_emissary' && accompaniesIn(s.loyalty) && !hasCooldown(s, 'unbroken_vigil'));
      if (warden && this.aliveEnemies().length > 0) {
        const def = this.allyDefFor(warden);
        const assist = bossAssist(def, warden, this.allyBossAssistInput(false));
        if (assist.guardCanIntervene) {
          const negated = Math.round((dmg * assist.vigilNegationPct) / 100);
          dmg = Math.max(0, dmg - negated);
          this.log.push(assist.lines[0] ?? `${def.name}: an oath-echo takes the blow.`);
          setCooldown(warden, 'unbroken_vigil', true);
        }
      }
    }
    return dmg;
  }

  /** Input for bossAssist evaluations against a live state. */
  private allyBossAssistInput(playerFallen: boolean): BossAssistInput {
    const boss = this.enemies.find((e) => e._isBoss && e.hp > 0);
    return {
      playerHp: this.player.currentHP,
      playerMaxHp: this.player.derived.maxHP,
      bossPhaseKey: boss && this.bossDef ? this.bossDef.getPhase(boss.hp / boss.maxHp).key : null,
      playerFallen,
      playerHasDebuff: false,
      round: this.round,
      foughtTogether: 1,
    };
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
    // Phase 5: a desperate boss (critical stress) strikes 30% harder.
    if (this._currentAttackerKey && this.enemies.some((e) => e._key === this._currentAttackerKey && e._isBoss) && this.bossBand() === 'critical') {
      const desperateAmount = Math.round(amount * 1.3);
      if (desperateAmount !== amount) amount = desperateAmount;
    }
    if (this.incomingMultFactor > 1) {
      amount = Math.round(amount * this.incomingMultFactor);
    }
    if (this.enemyDmgReduceTurns > 0) {
      amount = Math.round(amount * 0.7);
    }
    let dodge = this.player.derived.dodge + (this.player.skillsKnown.includes('chorus_step') ? 10 : 0);
    if (this.player.skillsKnown.includes('risk') && this.player.currentHP / this.player.derived.maxHP < 0.25) {
      dodge += 15;
    }
    if (this.stealthActive) {
      dodge = 100;
      this.log.push('Stealth — the blow cannot find you.');
    }
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
      if (this.player.skillsKnown.includes('precision')) {
        this.precisionStacks = Math.min(3, this.precisionStacks + 1);
        this.log.push('Precision — you read the blow; crit chance rises.');
      }
      return 0;
    }

    let dmg = amount;
    if (this.guarding && !bypassGuard) {
      let guardMultiplier = this.player.skillsKnown.includes('iron_resolve') ? 0.35 : 0.5;
      if (this.lastStandTurns > 0) guardMultiplier -= 0.3;
      if (this.aegisGuard > 0) guardMultiplier -= this.aegisGuard;
      guardMultiplier = Math.max(0.05, guardMultiplier);
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
      if (this.player.skillsKnown.includes('resolve')) {
        this.resolveStacks = Math.min(3, this.resolveStacks + 1);
      }
      this.gainMomentum(1);
    }
    dmg = applyBarrier(this.playerStatuses, dmg);
    // Phase 5: companions can stand between you and the blow.
    dmg = this.allyDamageMitigation(dmg);
    if (dmg > 0 && this.player.skillsKnown.includes('resolve') && this.resolveStacks >= 3) {
      this.resolveStacks = 0;
      dmg = 0;
      this.log.push(`RESOLVE — you spend your will to nullify ${label} entirely.`);
    }
    this.player.currentHP = Math.max(0, this.player.currentHP - dmg);
    // Phase 5: Resonance Drain — the boss sips momentum with every landed hit.
    if (dmg > 0 && this.adaptations.includes('resonance_drain') && this.player.momentum > 0
      && this._currentAttackerKey && this.enemies.some((e) => e._key === this._currentAttackerKey && e._isBoss)) {
      this.player.momentum = Math.max(0, this.player.momentum - 1);
      this.log.push('The boss drains your momentum — −1 Momentum.');
    }
    if (dmg > 0) {
      this.player.fatigue = clampFatigue(this.player.fatigue + Math.floor(dmg / 10) * 2);
      if (this.player.skillsKnown.includes('rage')) {
        const lostPct = (dmg / this.player.derived.maxHP) * 100;
        const gained = Math.max(1, Math.floor(lostPct / 10));
        const before = this.rageStacks;
        this.rageStacks = Math.min(5, this.rageStacks + gained);
        if (this.rageStacks > before) this.log.push('Rage surges — damage rises.');
      }
      // Phase 4e: massive hits and near-death blows stoke fear.
      const hpPct = (dmg / this.player.derived.maxHP) * 100;
      const beforeHp = this.player.currentHP + dmg;
      if (hpPct >= FEAR_MASSIVE_PCT) {
        this.fear = clampFear(this.fear + FEAR_MASSIVE_GAIN);
      } else if (beforeHp / this.player.derived.maxHP >= 0.25 && this.player.currentHP / this.player.derived.maxHP < 0.25) {
        this.fear = clampFear(this.fear + FEAR_CRIT_GAIN);
      }
      // G6: a boss's crushing blow (35%+ of max HP) stokes dread even harder.
      if (hpPct >= 35 && this._currentAttackerKey && this.enemies.some((e) => e._key === this._currentAttackerKey && e._isBoss)) {
        this.fear = clampFear(this.fear + FEAR_ULTIMATE_GAIN);
      }
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
      const heal = this.interdictedHeal(Math.round(this.player.derived.maxHP * 0.15));
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
    recordAction(this.profile);
    this.actionRepeatCounts[id] = (this.actionRepeatCounts[id] ?? 0) + 1;
    if (this.actionRepeatCounts[id] >= 3) {
      this.player.fatigue = clampFatigue(this.player.fatigue + 10);
    }
    if (this.actionRepeatCounts[id] === 3 && !this.repeatPenaltyApplied) {
      this.repeatPenaltyApplied = true;
      this.applyTokenDelta(-1, 'Repeating the same action dulls your rhythm — −1 token.');
    }
    if (this.player.skillsKnown.includes('adaptation')) this.adaptationActions.add(id);
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
    if (this.nextAttackGuaranteed) {
      this.nextAttackGuaranteed = false;
      return true;
    }
    let acc = this.player.derived.accuracy + (this.player.skillsKnown.includes('steady_hands') ? 10 : 0)
      + (this.eagleAccuracyTurns > 0 ? 40 : 0);
    const fatigue = fatiguePenalty(this.player.fatigue);
    acc = acc * fatigue.accuracyMult;
    if (hasStatus(this.playerStatuses, 'blind')) acc *= 0.7;
    // Phase 4e: terrified players are 20% less accurate.
    acc *= fearModifiers(this.fear).accuracyMult;
    let shockMiss = 0;
    const sd = getStatus(this.playerStatuses, 'shock_dot');
    if (sd) shockMiss = 15 * sd.stacks;
    const chance = Math.max(5, Math.min(99, acc - target.dodge - shockMiss));
    return this.rng() * 100 < chance;
  }

  private rollCrit(): boolean {
    if (this.desperateStrike) return true;
    if (this.forcedCrits > 0) {
      this.forcedCrits -= 1;
      return true;
    }
    const precisionBonus = this.precisionStacks > 0 ? 0.15 * this.precisionStacks : 0;
    return this.rng() < 0.1 + precisionBonus;
  }

  /** Phase 4b: combined class passive damage multipliers (Rage / Risk / Adaptation / Knowledge). */
  private classDamageMult(): number {
    let mult = 1;
    if (this.player.skillsKnown.includes('rage')) mult *= 1 + 0.05 * Math.min(5, this.rageStacks);
    const hpRatio = this.player.currentHP / this.player.derived.maxHP;
    if (this.player.skillsKnown.includes('risk')) {
      if (hpRatio < 0.25) mult *= 1.25;
      else if (hpRatio < 0.5) mult *= 1.1;
    }
    if (this.player.skillsKnown.includes('adaptation')) mult *= 1 + 0.1 * Math.min(5, this.adaptationActions.size);
    if (this.player.skillsKnown.includes('knowledge')) mult *= 1 + 0.05 * Math.min(3, this.knowledgeStacks);
    return mult;
  }

  private computeAndApplyDamage(target: InternalEnemy, sourcePower: number, defenseStat: number, damageType: DamageType, label: string, statKey: 'def' | 'mdef' = 'def', guaranteedHit = false, recordProfile = true): { dmg: number; hit: boolean; crit: boolean; weak: boolean } {
    if (!guaranteedHit && !this.rollHit(target)) {
      this.log.push(`${label} misses ${target.name}.`);
      this.playerAP = 0;
      this.log.push('The miss unbalances you — all tokens lost.');
      const missState = this.windowStates.get(target._key);
      if (missState) resetWeakStreak(missState);
      return { dmg: 0, hit: false, crit: false, weak: false };
    }
    let weakness = target.affinities[damageType] ?? 1.0;
    // Revelation-Exploit Focus: while active, every strike lands as a weakness hit.
    if (this.alwaysWeakTurns > 0 && weakness <= 1) weakness = 2;
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
    if (this.unityBlade) {
      defReduction = Math.min(defReduction, 0.7);
      this.unityBlade = false;
    }
    if (this.armorPierceAll) defReduction = Math.min(defReduction, 0);
    if (this.thesisTurns > 0 && (statKey === 'mdef' || ['shadow', 'sacred', 'shock', 'frost', 'flame'].includes(damageType))) {
      defReduction = Math.min(defReduction, 0.7);
    }
    const nextMult = this.nextAttackMult;
    this.nextAttackMult = 1;
    if (nextMult > 1) unravelMult *= nextMult;
    if (this.stealthActive && nextMult > 1) this.stealthActive = false;
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
    // Phase 5: desperate — desperate criticals shed 30% of the boss's defense.
    let effDefSource = defenseStat;
    if (target._isBoss && this.bossBand() === 'critical') effDefSource = Math.round(defenseStat * 0.7);
    const effDef = Math.round(effDefSource * defReduction * reactionArmorPierce * statMultiplier(target.statuses, statKey));
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
    // Phase 4b class passives & buffs
    dmg = Math.round(dmg * this.classDamageMult());
    if (this.lastStandTurns > 0) dmg = Math.round(dmg * 0.5 + dmg); // +50%
    if (hasStatus(this.playerStatuses, 'atk_up')) dmg = Math.round(dmg * 1.25);
    if ((this.marked.get(target._key) ?? 0) > 0) dmg = Math.round(dmg * 1.5);
    if (this.eagleAccuracyTurns > 0) {
      // accuracy handled at hit-roll; no damage change
    }
    if (this.mirrorTurns > 0) dmg = Math.round(dmg * 1.15);
    // Phase 4 crisis-option & desperation damage boosts.
    if (this.playerDmgMultTurns > 0) dmg = Math.round(dmg * 1.5);
    if (this.lastPrayerDmgTurns > 0) dmg = Math.round(dmg * 1.3);
    if (this.cascadeThisTurn) dmg = Math.round(dmg * 2);
    if (this.fightDmgBuff > 0) dmg = Math.round(dmg * (1 + this.fightDmgBuff));
    if (this.fightTypeBuff !== null && damageType === this.fightTypeBuff) dmg = Math.round(dmg * 1.2);
    if (this.desperation2xCharges > 0) {
      dmg = Math.round(dmg * 2);
      this.desperation2xCharges -= 1;
    }
    // Phase 4e: terrified players deal 10% less damage.
    dmg = Math.round(dmg * fearModifiers(this.fear).damageMult);
    if (this.forcedCrits > 0) {
      // forced crit handled at crit roll — log refreshes
    }
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
    // Phase 5: Elemental Resistance — the boss has hardened against your favourite type.
    if (target._isBoss && this.adaptations.includes('elemental_resistance') && this.bossResistType === damageType) {
      dmg = Math.round(dmg * 0.7);
      this.log.push(`${target.name} has hardened against ${damageType} — your damage is dampened.`);
    }
    const mitigated = applyBarrier(target.statuses, dmg);
    if (mitigated < dmg) this.log.push(`${target.name}'s Barrier absorbs part of the blow.`);
    if (dmg > 0 && mitigated === 0) {
      const lost = Math.floor(this.playerAP / 2);
      this.applyTokenDelta(-lost, `The blow was fully absorbed — you lose ${lost} token(s).`);
    }
    target.hp = Math.max(0, target.hp - mitigated);

    // Phase 5: the martyr persona — the Fossil King answers every wound in kind.
    if (target._isBoss && this.bossDef?.persona?.martyr && mitigated > 0 && !target.flags.martyrShockFired) {
      target.flags.martyrShockFired = 1;
      const shock = Math.max(1, Math.round(mitigated * 0.3));
      this.dealDamageToPlayer(shock, 'shadow', "the martyr king's blood price", false, target._key);
      this.log.push(`The martyr king pays his own blood price — ${shock} damage bites back at you.`);
    }

    // Crisis All-In: after the gambled strike lands, a 30% chance the player collapses.
    if (this.allInPending && mitigated > 0) {
      this.allInPending = false;
      if (this.rng() < 0.3) {
        this.player.currentHP = 0;
        this.log.push('All-In pays the final price — you collapse from the strain.');
      } else {
        this.log.push('All-In holds — you weather the gamble.');
      }
    }

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
      if (this.player.skillsKnown.includes('precision')) {
        this.applyTokenDelta(1, 'Precision — the critical strike restores 1 AP.');
      }
    }
    if (target.hp <= 0) {
      this.gainMomentum(1);
      this.applyTokenDelta(1, 'Enemy slain — +1 token.');
    }
    if (investigated && this.pendingIntents.has(target._key)) {
      this.applyTokenDelta(1, 'You read its intent and struck true — +1 token.');
    }
    // Phase 5: profiling — the boss tallies what the player does.
    if (recordProfile) {
      if (mitigated > 0) {
        recordDamage(this.profile, damageType, mitigated);
        this.nudgeAggression(1);
      }
      if (weak) {
        recordWeaknessHit(this.profile);
        this.nudgeAggression(1);
      }
      if (crit) recordCrit(this.profile);
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
    recordCombo(this.profile);
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
        this.firstWeaknessRevealed = true;
        this.log.push('COMBO Full Knowledge — every enemy is revealed and weakness windows open.');
        break;
    }
  }

  attack(targetKey?: string): CombatSnapshot {
    if (this.phase !== 'player' || (this.playerAP < 1 && this.freeActionCharges < 1)) return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    const target = this.pickTarget(targetKey);
    if (!target) return this.snapshot();
    const echoLockAttack = this.adaptations.includes('echo_lock') && this.lastActionId === 'attack';
    if (this.freeActionCharges < 1 && (this.playerAP < ACTION_AP_COST.attack + (echoLockAttack ? 1 : 0))) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.attack + (echoLockAttack ? 1 : 0);
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    if (echoLockAttack) this.log.push('Echo Lock — the boss mirrors your power: repeating an attack costs 1 extra AP.');
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

    const cost = this.freeActionCharges > 0 ? 0 : skill.apCost + (this.adaptations.includes('echo_lock') && this.lastActionId === `skill:${skillId}` ? 1 : 0);
    if (this.playerAP < cost) return this.snapshot();
    this.playerAP -= cost;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    if (this.adaptations.includes('echo_lock') && this.lastActionId === `skill:${skillId}`) {
      this.log.push('Echo Lock — the boss mirrors your rhythm: repeating the skill costs 1 extra AP.');
    }
    this.actionsTakenThisRound += 1;
    if (mpCost > 0) {
      this.player.currentMP = Math.max(0, this.player.currentMP - mpCost);
      this.player.fatigue = clampFatigue(this.player.fatigue + Math.floor(mpCost / 10) * 5);
    }
    this.recordAction(`skill:${skillId}`);
    this.pushComboTags(tagsForSkill(skill), this.pickTarget(targetKey));
    this.resolveSkillEffects(skill, targetKey);
    this.resolveClassTag(skill, targetKey);

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

  /**
   * Phase 4a: generic structured-effects resolver for active skills.
   * Handles damage / status / buff / heal / barrier / cost / resource / evade.
   */
  private resolveSkillEffects(skill: SkillDef, targetKey?: string): void {
    const effects = skill.effects ?? [];
    let anyHit = false;
    for (const eff of effects) {
      switch (eff.kind) {
        case 'damage': {
          const effType = this.thesisTurns > 0 && eff.stat === 'magic' ? this.thesisType ?? eff.type : eff.type;
          const power = eff.stat === 'magic'
            ? this.player.derived.magicAttack * statMultiplier(this.playerStatuses, 'matk') * eff.power
            : this.player.derived.attack * statMultiplier(this.playerStatuses, 'atk') * eff.power;
          if (eff.target === 'all') {
            for (const e of this.aliveEnemies()) {
              const result = this.computeAndApplyDamage(e, power, eff.stat === 'magic' ? e.mdef : e.def, effType, skill.name, eff.stat === 'magic' ? 'mdef' : 'def', eff.guaranteed);
              if (result.hit) anyHit = true;
            }
          } else {
            const target = this.pickTarget(targetKey);
            if (!target) break;
            const result = this.computeAndApplyDamage(target, power, eff.stat === 'magic' ? target.mdef : target.def, effType, skill.name, eff.stat === 'magic' ? 'mdef' : 'def', eff.guaranteed);
            if (result.hit) anyHit = true;
          }
          break;
        }
        case 'status': {
          const targets = eff.target === 'all' ? this.aliveEnemies() : (() => {
            const t = this.pickTarget(targetKey);
            return t ? [t] : [];
          })();
          for (const t of targets) {
            applyStatus(t.statuses, eff.id, eff.turns, eff.stacks);
            recordStatusApplied(this.profile);
            this.log.push(`${skill.name} — ${t.name} is afflicted with ${eff.id} for ${eff.turns} turn(s).`);
          }
          break;
        }
        case 'buff':
          applyStatus(this.playerStatuses, eff.id, eff.turns);
          recordBuffUsed(this.profile);
          this.log.push(`${skill.name} — you gain ${eff.id} for ${eff.turns} turn(s).`);
          break;
        case 'debuff':
          applyStatus(this.playerStatuses, eff.id, eff.turns);
          this.log.push(`${skill.name} — you are afflicted with ${eff.id} for ${eff.turns} turn(s).`);
          break;
        case 'next_attack_amp':
          this.nextAttackMult = Math.max(this.nextAttackMult, eff.dmg);
          if (eff.guaranteed) this.nextAttackGuaranteed = true;
          this.log.push(`${skill.name} — your next attack is empowered.`);
          break;
        case 'heal': {
          let amount = eff.flat ?? 0;
          if (eff.pct) amount += Math.round(this.player.derived.maxHP * eff.pct);
          amount = this.interdictedHeal(amount);
          this.player.currentHP = Math.min(this.player.derived.maxHP, this.player.currentHP + amount);
          if (amount > 0) {
            recordHeal(this.profile, amount);
            this.log.push(`${skill.name} restores ${amount} HP.`);
          }
          break;
        }
        case 'barrier':
          applyStatus(this.playerStatuses, 'barrier', eff.turns, 1, { amount: Math.round(this.player.derived.maxHP * eff.pct) });
          this.log.push(`${skill.name} — a barrier absorbs ${eff.pct * 100}% of your max HP.`);
          break;
        case 'cost': {
          if (eff.onHit && !anyHit) break;
          let hpCost = 0;
          if (eff.hpFlat) hpCost += eff.hpFlat;
          if (eff.hpPct) hpCost += Math.max(1, Math.round(this.player.currentHP * eff.hpPct));
          if (hpCost > 0) {
            this.player.currentHP = Math.max(1, this.player.currentHP - hpCost);
            this.log.push(`${skill.name} costs you ${hpCost} HP.`);
          }
          if (eff.resonance) {
            this.player.resonance = Math.max(0, this.player.resonance - eff.resonance);
          }
          break;
        }
        case 'resource':
          if (eff.momentum) this.gainMomentum(eff.momentum);
          if (eff.mp) this.player.currentMP = Math.min(this.player.derived.maxMP, this.player.currentMP + eff.mp);
          break;
        case 'evade':
          this.veilStepGuaranteed = true;
          this.log.push('You go still, ready to slip the next blow entirely.');
          break;
      }
    }
  }

  /**
   * Phase 4b: class signature / progression tag hooks that need bespoke engine
   * behavior beyond the generic `effects` resolver.
   */
  private resolveClassTag(skill: SkillDef, targetKey?: string): void {
    const tag = skill.tag;
    if (!tag) return;
    const target = this.pickTarget(targetKey);
    switch (tag) {
      case 'sig_last_stand':
        this.lastStandTurns = 3;
        this.guarding = true;
        this.log.push('LAST STAND — +50% damage and +30% guard for 3 turns, all enemies turn to you.');
        break;
      case 'sig_shadow_step':
        this.nextAttackMult = 1.5;
        this.nextAttackGuaranteed = true;
        this.log.push('SHADOW STEP — your next attack deals +50% and cannot miss.');
        break;
      case 'sig_veil_of_silence':
        this.stealthActive = true;
        this.nextAttackMult = Math.max(this.nextAttackMult, 1.75);
        this.nextAttackGuaranteed = true;
        this.log.push('VEIL OF SILENCE — you vanish into stealth; your next attack deals +75% and you cannot be targeted.');
        break;
      case 'sig_arcane_thesis':
        this.thesisType = this.chooseThesisType();
        this.thesisTurns = 3;
        this.log.push(`ARCANE THESIS — your spells are ${this.thesisType} and pierce 30% resistance for 3 turns.`);
        break;
      case 'sig_aegis_protocol':
        this.aegisTurns = 2;
        this.aegisGuard = 0.4;
        this.log.push('AEGIS PROTOCOL — all damage redirects to you with +40% guard for 2 turns.');
        break;
      case 'sig_mirror_adapt':
        this.mirrorTurns = 3;
        this.log.push('MIRROR ADAPT — +15% to all stats for 3 turns.');
        break;
      case 'prog_berserkers_cry':
        applyStatus(this.playerStatuses, 'atk_up', 3);
        applyStatus(this.playerStatuses, 'defense_down', 3);
        this.log.push("BERSERKER'S CRY — +25% damage, -20% defense for 3 turns.");
        break;
      case 'prog_blade_of_ruin':
        if (this.player.currentHP / this.player.derived.maxHP < 0.3 && target) {
          const amp = Math.round(target.maxHp * 0);
          void amp;
          this.nextAttackMult = Math.max(this.nextAttackMult, 2.0);
          this.log.push('BLADE OF RUIN — below 30% HP, the blade doubles.');
        }
        break;
      case 'prog_pinpoint_shot':
        if (target && target.hp / target.maxHp < 0.4) {
          this.forcedCrits = Math.max(this.forcedCrits ?? 0, 1);
          this.log.push(`PINPOINT SHOT — ${target.name} is below 40% HP; the shot strikes true.`);
        }
        break;
      case 'prog_tangle_trap':
        if (target) {
          applyStatus(target.statuses, 'root', 2);
          this.log.push(`TANGLE TRAP — ${target.name} is rooted and slowed.`);
        }
        break;
      case 'prog_eagle_eye':
        this.eagleAccuracyTurns = 3;
        for (const e of this.aliveEnemies()) this.investigate(e._key, 4, []);
        this.log.push('EAGLE EYE — +40% accuracy; every weakness is revealed for 3 turns.');
        break;
      case 'prog_deaths_mark':
        if (target) {
          this.marked.set(target._key, 3);
          this.log.push(`DEATH'S MARK — ${target.name} takes +50% damage for 3 turns.`);
        }
        break;
      case 'prog_force_cascade':
        if (target && (target.affinities[skill.damageType ?? 'shock'] ?? 1) > 1) {
          this.applyTokenDelta(1, 'FORCE CASCADE — weakness exploited, 1 AP refunded.');
        }
        break;
      case 'prog_mnemonic_echo':
        this.nextAttackMult = Math.max(this.nextAttackMult, 1.5);
        this.log.push('MNEMONIC ECHO — the echo of the last spell lingers; your next hit is stronger.');
        break;
      case 'prog_forbidden_knowledge':
        if (this.rng() < 0.2) {
          for (const e of this.aliveEnemies()) applyStatus(e.statuses, 'confuse', 2);
          this.log.push('FORBIDDEN KNOWLEDGE — all enemies are confused.');
        }
        break;
      case 'prog_unwritten_page':
        if (target) {
          removeAllBuffs(target.statuses);
          this.log.push(`THE UNWRITTEN PAGE — ${target.name}'s buffs are erased.`);
        }
        break;
      case 'prog_bulwarks_awakening':
        removeAllDebuffs(this.playerStatuses);
        applyStatus(this.playerStatuses, 'fortify', 3);
        this.log.push("BULWARK'S AWAKENING — all debuffs removed; +20% defense for 3 turns.");
        break;
      case 'prog_soul_rend':
        if (target) {
          const stolen = Math.round(target.atk * 0.2);
          target.atk = Math.max(1, target.atk - stolen);
          applyStatus(this.playerStatuses, 'atk_up', 3);
          this.log.push(`SOUL REND — you steal ${stolen} ATK from ${target.name} for 3 turns.`);
        }
        break;
      case 'prog_echoing_void':
        if (target) {
          applyStatus(target.statuses, 'silence', 2);
          this.log.push(`ECHOING VOID — ${target.name} is silenced for 2 turns.`);
        }
        break;
      case 'prog_unravel_existence':
        if (target && target.hp / target.maxHp < 0.5) {
          this.unravelPending = true;
          this.log.push('UNRAVEL EXISTENCE — the foe is below half; defenses unravel.');
        }
        break;
      case 'prog_balanced_mind':
        removeDebuffs(this.playerStatuses);
        this.player.currentMP = Math.min(this.player.derived.maxMP, this.player.currentMP + 20);
        this.log.push('BALANCED MIND — one debuff removed; 20 MP restored.');
        break;
      case 'prog_harmonic_resonance':
        for (const e of this.aliveEnemies()) this.gainMomentum(1);
        this.log.push('HARMONIC RESONANCE — momentum surges with every foe struck.');
        break;
      case 'prog_unitys_blade':
        if (target) {
          this.unityBlade = true;
          this.log.push("UNITY'S BLADE — a strike of body and mind, ignoring 30% of defenses.");
        }
        break;
      case 'sig_low_hp_boost':
        // handled via atk_up effect in data; nothing extra
        break;
      default:
        break;
    }
  }

  /** Arcane Thesis: pick the player's strongest-revealed weakness, else a useful elemental type. */
  private chooseThesisType(): DamageType {
    const preferred: DamageType[] = ['shock', 'flame', 'frost', 'shadow', 'sacred'];
    for (const e of this.aliveEnemies()) {
      for (const t of preferred) {
        if ((e.affinities[t] ?? 1) > 1) return t;
      }
    }
    return 'shock';
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
    recordGuard(this.profile);
    this.nudgeCalm(1);
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
    recordAnalyze(this.profile);
    this.nudgeCalm(1);
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
    recordItem(this.profile);
    entry.qty -= 1;
    this.player.inventory = this.player.inventory.filter((i) => i.qty > 0);
    this.player.fatigue = clampFatigue(this.player.fatigue - 20);

    if (item.effect?.healPercent) {
      if (this.noHeal) {
        this.log.push(`You try to use ${item.name}, but One Last Memory seals all healing this combat.`);
      } else {
        const heal = this.interdictedHeal(Math.round(this.player.derived.maxHP * (item.effect.healPercent / 100)));
        this.player.currentHP = Math.min(this.player.derived.maxHP, this.player.currentHP + heal);
        recordHeal(this.profile, heal);
        this.log.push(`You use ${item.name}, healing ${heal} HP.`);
      }
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
    recordAnalyze(this.profile);
    this.nudgeCalm(1);
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
      else if (target._isBoss && this.unreadable()) this.log.push('You sense nothing — it has sealed its intentions behind the learning.');
    }
    this.gainMomentum(1);
    this.player.insight = Math.min(3, this.player.insight + 1);
    if (this.player.skillsKnown.includes('knowledge')) {
      this.knowledgeStacks = Math.min(3, this.knowledgeStacks + 1);
      this.log.push(`Knowledge — study sharpens your strikes (+${this.knowledgeStacks * 5}%).`);
    }
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
    // Phase 5: Hidden Mechanisms — an adapted boss hides its intent below Deep Analysis.
    if (e._isBoss && this.unreadable() && !this.sureRead(e._key)) return undefined;
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
    recordAnalyze(this.profile);
    this.nudgeCalm(1);
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
    recordAnalyze(this.profile);
    this.nudgeCalm(1);
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
      this.firstWeaknessRevealed = true;
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
    recordMomentumSpend(this.profile);
    this.nudgeAggression(2);
    if (choice === 'flow') {
      this.playerAP += 2;
      applyStatus(this.playerStatuses, 'exhausted', 1);
      this.log.push('Momentum: Flow — you act again immediately, but will start next round exhausted.');
    } else if (choice === 'harmony') {
      const heal = this.interdictedHeal(Math.round(this.player.derived.maxHP * 0.25));
      this.player.currentHP = Math.min(this.player.derived.maxHP, this.player.currentHP + heal);
      recordHeal(this.profile, heal);
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

  // ---- Phase 4d/e/f: Crisis, Fear, Desperation --------------------------------

  /** Returns the set of currently-stocked crisis options; the scene scans snapshot.pendingCrisis for the modal. */
  checkCrisis(): CombatSnapshot {
    if (this.phase === 'victory' || this.phase === 'defeat' || this.phase === 'fled') return this.snapshot();
    const boss = this.enemies.find((e) => e._isBoss && e.hp > 0);
    const found = pickCrisis(
      {
        hpPct: this.player.currentHP / this.player.derived.maxHP,
        bossPct: boss ? boss.hp / boss.maxHp : null,
        firstWeaknessSeen: this.firstWeaknessRevealed,
        momentum: this.player.momentum,
        round: this.round,
        anyEnemyAlive: this.aliveEnemies().length > 0,
      },
      { seen: this.crisisSeen },
    );
    if (found && this.phase === 'player') {
      this.pendingCrisisId = found.id;
      this.phase = 'crisis';
    }
    return this.snapshot();
  }

  /** Apply the chosen crisis option and resume the player phase. */
  resolveCrisis(optionId: string): CombatSnapshot {
    const crisisIds = Object.keys(CRISES) as CrisisId[];
    let crisisInternal: CrisisId | null = this.pendingCrisisId;
    if (this.phase !== 'crisis' || !crisisInternal) return this.snapshot();
    // Validate that optionId belongs to the pending crisis.
    const def = CRISES[crisisInternal];
    if (!def.options.some((o) => o.id === optionId)) return this.snapshot();
    this.pendingCrisisId = null;
    markCrisisSeen(this.crisisState(), crisisInternal);
    const boss = this.enemies.find((e) => e._isBoss && e.hp > 0);
    this.applyCrisisOption(optionId, boss);
    this.phase = 'player';
    this.checkOutcome();
    return this.snapshot();
  }

  /** Bravery: spend AP to lower the fear gauge and gain a boon. */
  resolveBravery(actionId: string): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    if (!this.playerCanAct()) { this.checkOutcome(); return this.snapshot(); }
    const def = BRAVERY_ACTIONS.find((a) => a.id === actionId);
    if (!def) return this.snapshot();
    if (this.playerAP < def.apCost && this.freeActionCharges < 1) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : def.apCost;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    this.actionsTakenThisRound += 1;
    this.fear = clampFear(this.fear + def.fearDelta);
    this.log.push(`Bravery: ${def.label} — your grip loosens.`);
    if (def.fearDelta < 0) applyStatus(this.playerStatuses, 'atk_up', 2);
    return this.snapshot();
  }

  checkDesperation(): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    const hpPct = this.player.currentHP / this.player.derived.maxHP;
    if (hpPct > DESPERATION_HP_PCT) return this.snapshot();
    if (!rollDesperation(this.rng)) return this.snapshot();
    const def = pickDesperation(this.desperationFired, this.rng);
    if (!def) return this.snapshot();
    this.desperationFired.push(def.id);
    this.applyDesperation(def.id);
    this.log.push(`DESPERATION — ${def.title}: ${def.detail}`);
    this.pendingBanners.push(`DESPERATION — ${def.title}`);
    this.checkOutcome();
    return this.snapshot();
  }

  private applyDesperation(id: DesperationId): void {
    switch (id) {
      case 'broken_resolve':
        this.desperation2xCharges = 3;
        this.incomingMultTurns = Math.max(this.incomingMultTurns, 3);
        this.incomingMultFactor = Math.max(this.incomingMultFactor, 1.8);
        break;
      case 'forget_pain': {
        const original = this.player.derived.maxHP;
        if (this.player.derived.maxHP > 10) {
          this.player.derived.maxHP = Math.max(1, Math.round(this.player.derived.maxHP * 0.8));
        }
        this.player.currentHP = Math.min(this.player.derived.maxHP, original);
        this.player.currentMP = this.player.derived.maxMP;
        break;
      }
      case 'shatter_resonance':
        this.forcedCrits = Math.max(this.forcedCrits, 3);
        break;
      case 'burn_the_archive': {
        let cleared = 0;
        for (const e of this.enemies) {
          if (!e._isBoss) {
            e.hp = 0;
            cleared += 1;
          }
        }
        this.fightDmgBuff = Math.max(this.fightDmgBuff, 0.3);
        this.log.push(cleared > 0 ? `Desperation: Burn the Archive — ${cleared} minion(s) unmade.` : 'Desperation: Burn the Archive — no minions to burn.');
        break;
      }
      case 'one_last_memory':
        this.noHeal = true;
        this.armorPierceAll = true;
        break;
    }
  }

  /** Bonus AP/buff surfaced by desperation so the scene can show it without editing the engine’s data. */
  getFear(): number {
    return this.fear;
  }

  getDesperationIds(): DesperationId[] {
    return [...this.desperationFired];
  }

  private crisisState(): { seen: CrisisId[] } {
    return { seen: this.crisisSeen };
  }

  private applyCrisisOption(optionId: string, boss?: InternalEnemy): void {
    switch (optionId) {
      case 'all_in':
        this.allInPending = true;
        this.pendingComboMult = Math.max(this.pendingComboMult, 2.5);
        this.log.push('Crisis: All-In — your next attack hits for 2.5x, but you gamble your life.');
        break;
      case 'retreat': {
        const heal = Math.round(this.player.derived.maxHP * 0.2);
        this.player.currentHP = Math.min(this.player.derived.maxHP, this.player.currentHP + heal);
        this.guarding = true;
        this.log.push(`Crisis: Retreat — you restore ${heal} HP and brace (Guard) for 2 turns.`);
        break;
      }
      case 'last_prayer':
        this.player.currentMP = Math.min(this.player.derived.maxMP, this.player.currentMP + Math.round(this.player.derived.maxMP * 0.4));
        this.lastPrayerDmgTurns = Math.max(this.lastPrayerDmgTurns, 3);
        this.log.push('Crisis: Last Prayer — MP restored 40%; +30% damage for 3 turns.');
        break;
      case 'defy':
        this.nextAttackMult = Math.max(this.nextAttackMult, 1.5);
        this.lastStandTurns = Math.max(this.lastStandTurns, 2);
        this.log.push('Crisis: Defy — +50% damage for 2 turns while you draw the boss’s attention.');
        break;
      case 'evade':
        this.phaseShiftCharges += 2;
        this.log.push('Crisis: Evade — you will dodge the next 2 attacks.');
        break;
      case 'sacrifice': {
        const cost = Math.round(this.player.currentHP * 0.5);
        this.player.currentHP = Math.max(1, this.player.currentHP - cost);
        if (boss) {
          const dmg = Math.round(boss.hp * 0.3);
          boss.hp = Math.max(0, boss.hp - dmg);
          this.log.push(`Crisis: Sacrifice — you pay ${cost} HP to crush the boss for ${dmg} (30% of its max).`);
        } else {
          this.log.push(`Crisis: Sacrifice — you pay ${cost} HP for nothing; no boss remains.`);
        }
        break;
      }
      case 'exploit_focus':
        this.alwaysWeakTurns = Math.max(this.alwaysWeakTurns, 2);
        this.log.push('Crisis: Exploit Focus — every strike finds the weakness for 2 turns.');
        break;
      case 'study': {
        this.gainMomentum(3);
        for (const e of this.enemies) {
          this.investigate(e._key, 3, ['observe_body', 'observe_mind', 'observe_weapon', 'observe_resonance']);
          e._revealed = true;
        }
        this.log.push('Crisis: Study — +3 Momentum; the field lays bare before you.');
        break;
      }
      case 'share': {
        const foe = this.aliveEnemies()[0] ?? this.enemies[0];
        if (foe) {
          let best: DamageType = 'slash';
          let bestAff = 0;
          for (const [t, a] of Object.entries(foe.affinities) as [DamageType, number][]) {
            if (a > bestAff) {
              bestAff = a;
              best = t;
            }
          }
          this.fightTypeBuff = best;
          this.log.push(`Crisis: Share — your study of ${foe.name} grants +20% ${best} damage for the fight.`);
        } else {
          this.log.push('Crisis: Share — no enemy stands to study.');
        }
        break;
      }
      case 'cascade':
        this.player.momentum = 0;
        this.cascadeThisTurn = true;
        this.log.push('Crisis: Cascade — all momentum spent for +100% damage this turn.');
        break;
      case 'tactical_reset':
        removeAllDebuffs(this.playerStatuses);
        applyStatus(this.playerStatuses, 'barrier', 1, 1, { amount: Math.round(this.player.derived.maxHP * 0.3) });
        this.log.push('Crisis: Tactical Reset — debuffs purged; a barrier absorbs 30% of your max HP.');
        break;
      case 'rhythm':
        this.bankedAP += 3;
        this.log.push('Crisis: Rhythm — you bank 3 AP for the next round.');
        break;
      case 'final_stand':
        this.playerDmgMultTurns = Math.max(this.playerDmgMultTurns, 2);
        this.incomingMultTurns = Math.max(this.incomingMultTurns, 2);
        this.incomingMultFactor = Math.max(this.incomingMultFactor, 2);
        this.log.push('Crisis: Final Stand — +50% damage, but you take double damage for 2 turns.');
        break;
      case 'prolong': {
        const heal = Math.round(this.player.derived.maxHP * 0.3);
        this.player.currentHP = Math.min(this.player.derived.maxHP, this.player.currentHP + heal);
        this.enemyDmgReduceTurns = Math.max(this.enemyDmgReduceTurns, 2);
        this.log.push(`Crisis: Prolong — you restore ${heal} HP and deaden the foe's blows 30% for 2 turns.`);
        break;
      }
      case 'gamble': {
        if (this.rng() < 0.5) {
          for (const e of this.enemies) e.hp = 0;
          this.log.push('Crisis: Gamble — fate favors you; the enemy is unmade.');
        } else {
          this.player.currentHP = 0;
          this.log.push('Crisis: Gamble — fate turns its back; you collapse.');
        }
        break;
      }
      default:
        this.log.push('Crisis: the moment passes.');
    }
  }

  private _prevActionId: string | null = null;

  // ---- Rewards / teardown -----------------------------------------------------

  getFlags(): Record<string, number> {
    const intel = this.bossIntelView();
    return {
      ...this.flags,
      bossStress: intel?.stress ?? 0,
      bossBand: intel ? STRESS_BAND_ORDER.indexOf(intel.band) : -1,
      bossAdaptations: intel?.adaptations.length ?? 0,
      bossCharged: this.chargedIntent ? 1 : 0,
    };
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
          // Phase 5: a declared charge replaces the intent read-out; Hidden Mechanisms hides it below layer 3.
          const bossHidden = e._isBoss && this.unreadable() && !this.sureRead(e._key);
          const charged = e._isBoss && this.chargedIntent && !this.isChargeDue() ? this.chargedIntent : null;
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
            pendingIntent: charged && !bossHidden
              ? { id: charged.id, label: chargeLabel(charged.label), confidence: 'certain', charged: true }
              : intentDef && !bossHidden
                ? { id: intentDef.id, label: intentDef.label, confidence: confidenceFor(layer) }
                : null,
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
      pendingCrisis: this.pendingCrisisId
        ? (() => {
            const def = CRISES[this.pendingCrisisId];
            return { id: def.id, title: def.title, flavor: def.flavor, options: def.options };
          })()
        : undefined,
      fear: this.fear,
      bossIntel: this.bossIntelView() ?? undefined,
      allies: this.allyStates
        .filter((s) => accompaniesIn(s.loyalty))
        .map((s) => ({
          id: s.id,
          name: ALLY_DEFS[s.id].name,
          loyalty: s.loyalty,
          tier: tierForLoyalty(s.loyalty),
          action: '',
        })),
    };
  }

  /** Phase 5: persistable copy of the companion states after a fight. */
  getAllyStates(): AllySaveState[] {
    return this.allyStates.map((a) => ({ ...a }));
  }
}
