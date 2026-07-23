import type {
  AffinityMap,
  BossDef,
  BossTurnContext,
  CombatState_Enemy,
  DamageType,
  EnemyTurnContext,
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
  hasStatus,
  removeAllBuffs,
  setBarrier,
  statMultiplier,
  tickDots,
  tickDurations,
} from './StatusEffectSystem';

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
  affinities: AffinityMap;
}

export interface CombatSnapshot {
  round: number;
  phase: CombatPhase;
  playerAP: number;
  freeActionCharges: number;
  playerHP: number;
  playerMaxHP: number;
  playerMP: number;
  playerMaxMP: number;
  playerStatuses: StatusInstance[];
  momentum: number;
  guarding: boolean;
  enemies: EnemyView[];
  log: string[];
  bossPhaseLabel?: string;
}

interface InternalEnemy extends CombatState_Enemy {
  _key: string;
  _revealed: boolean;
  _isBoss: boolean;
}

const MOMENTUM_CHOICES = ['extra_turn', 'chorus_heal', 'clarity', 'forgotten_technique', 'unravel'] as const;
export type MomentumChoice = (typeof MOMENTUM_CHOICES)[number];

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
  playerAP = 2;
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

  constructor(setup: CombatSetup) {
    this.player = setup.player;
    this.rng = setup.rng;
    this.page = setup.page;
    this.bossDef = setup.bossDef;
    this.flags = { ...(setup.precombatFlags ?? {}) };
    this.playerHistorySet = setup.playerHistory;

    if (setup.bossDef) {
      this.enemies.push(this.buildBossCombatant(setup.bossDef));
    } else {
      for (const id of setup.enemyIds) {
        this.enemies.push(this.buildEnemyCombatant(id));
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
    return this.player.derived.speed * statMultiplier(this.playerStatuses, 'spd');
  }

  // ---- Round flow -------------------------------------------------------------

  beginRound(): CombatSnapshot {
    if (this.phase === 'victory' || this.phase === 'defeat' || this.phase === 'fled') return this.snapshot();
    this.round += 1;
    this.playerAP = 2;
    this.guarding = false;
    this.lastActionRepeated = false;

    const alive = this.aliveEnemies();
    const playerSpd = this.effectivePlayerSpeed();
    const faster = alive.filter((e) => e.spd > playerSpd).sort((a, b) => b.spd - a.spd);
    for (const e of faster) this.resolveEnemyTurn(e);

    this.checkOutcome();
    this.phase = 'player';
    return this.snapshot();
  }

  endPlayerPhase(): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    this.lastActionRepeated = this.lastActionId !== null && this.lastActionId === this._prevActionId;
    this._prevActionId = this.lastActionId;

    const alive = this.aliveEnemies();
    const playerSpd = this.effectivePlayerSpeed();
    const slowerOrEqual = alive.filter((e) => e.spd <= playerSpd).sort((a, b) => b.spd - a.spd);
    for (const e of slowerOrEqual) this.resolveEnemyTurn(e);

    // End of round: DoTs tick for player and all enemies, durations decrement
    const playerDot = tickDots(this.playerStatuses);
    if (playerDot.damage > 0) {
      this.player.currentHP = Math.max(0, this.player.currentHP - playerDot.damage);
      this.log.push(...playerDot.lines);
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

    this.checkOutcome();
    return this.snapshot();
  }

  private checkOutcome(): void {
    if (this.player.currentHP <= 0) {
      if (this.player.skillsKnown.includes('unfinished_sentence') && !this.flags.deathWardUsed) {
        this.flags.deathWardUsed = 1;
        this.player.currentHP = 1;
        this.log.push('Unfinished Sentence: the killing blow leaves you at 1 HP instead.');
      } else {
        this.phase = 'defeat';
        return;
      }
    }
    if (this.aliveEnemies().length === 0) {
      this.phase = 'victory';
    }
  }

  // ---- Enemy / boss turn resolution --------------------------------------------

  private resolveEnemyTurn(enemy: InternalEnemy): void {
    if (enemy.hp <= 0 || this.phase !== 'player') return;
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
      const ctx: BossTurnContext = {
        self: enemy,
        player: this.playerCombatView(),
        turn: this.bossOwnTurnCounter,
        phaseKey: phaseInfo.key,
        rng: this.rng,
        log: this.log,
        flags: this.flags,
        applyDamageToPlayer: (amount, type, label, bypassGuard) => this.dealDamageToPlayer(amount, type, label, bypassGuard),
        applyStatusToPlayer: (id, turns, stacks, meta) => applyStatus(this.playerStatuses, id, turns, stacks, meta),
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
      this.bossDef.takeTurn(ctx);
      this.checkOutcome();
      return;
    }

    const def = ALL_ENEMY_DEFS[enemy._key];
    const ctx: EnemyTurnContext = {
      self: enemy,
      player: this.playerCombatView(),
      allies: this.aliveEnemies().filter((e) => e !== enemy),
      turn: this.round,
      rng: this.rng,
      applyDamageToPlayer: (amount, type, label) => this.dealDamageToPlayer(amount, type, label, false),
      applyStatusToPlayer: (id, turns, stacks, meta) => applyStatus(this.playerStatuses, id, turns, stacks, meta),
      healSelf: (amount) => { enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount); },
      applyStatusToSelf: (id, turns, stacks, meta) => applyStatus(enemy.statuses, id, turns, stacks, meta),
      spawnAlly: (enemyId, hpOverride) => this.spawnAdd(enemyId, hpOverride),
      removePlayerBuffs: () => removeAllBuffs(this.playerStatuses),
    };
    const line = def.act(ctx);
    this.log.push(line);
    this.checkOutcome();
  }

  private spawnAdd(enemyId: string, hpOverride?: number): void {
    if (this.enemies.filter((e) => e.hp > 0).length >= 4) return; // capacity cap
    this.enemies.push(this.buildEnemyCombatant(enemyId, hpOverride));
  }

  private playerCombatView() {
    return {
      name: 'You',
      hp: this.player.currentHP,
      maxHp: this.player.derived.maxHP,
      def: Math.round(this.player.derived.defense * statMultiplier(this.playerStatuses, 'def')),
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

  /** Applies incoming damage to the player, honoring Guard / Barrier / Reflection. */
  private dealDamageToPlayer(amount: number, type: DamageType, label: string, bypassGuard = false): number {
    let dmg = amount;
    if (this.guarding && !bypassGuard) dmg = Math.round(dmg * 0.5);
    dmg = applyBarrier(this.playerStatuses, dmg);
    this.player.currentHP = Math.max(0, this.player.currentHP - dmg);
    if (hasStatus(this.playerStatuses, 'reflection') && dmg > 0) {
      const reflected = Math.round(dmg * 0.25);
      const firstEnemy = this.aliveEnemies()[0];
      if (firstEnemy) firstEnemy.hp = Math.max(0, firstEnemy.hp - reflected);
    }
    return dmg;
  }

  // ---- Player actions --------------------------------------------------------

  private gainMomentum(n = 1): void {
    this.player.momentum = Math.min(3, this.player.momentum + n);
    if (this.player.momentum >= 3) {
      this.phase = 'momentum_choice';
    }
  }

  private pickTarget(targetKey?: string): InternalEnemy | undefined {
    const alive = this.aliveEnemies();
    if (targetKey) return alive.find((e) => e._key === targetKey || e.name === targetKey);
    return alive[0];
  }

  private rollHit(target: InternalEnemy): boolean {
    let acc = this.player.derived.accuracy;
    if (hasStatus(this.playerStatuses, 'blind')) acc *= 0.7;
    const chance = Math.max(5, Math.min(99, acc - target.dodge));
    return this.rng() * 100 < chance;
  }

  private rollCrit(): boolean {
    return this.rng() < 0.1;
  }

  private computeAndApplyDamage(target: InternalEnemy, sourcePower: number, defenseStat: number, damageType: DamageType, label: string, statKey: 'def' | 'mdef' = 'def'): { dmg: number; hit: boolean; crit: boolean; weak: boolean } {
    if (!this.rollHit(target)) {
      this.log.push(`${label} misses ${target.name}.`);
      return { dmg: 0, hit: false, crit: false, weak: false };
    }
    const weakness = target.affinities[damageType] ?? 1.0;
    const crit = this.rollCrit();
    const variance = 0.9 + this.rng() * 0.2;
    let unravelMult = 1;
    let defReduction = 1;
    if (this.unravelPending) {
      unravelMult = 2.0;
      defReduction = 0.5;
      this.unravelPending = false;
    }
    const effDef = Math.round(defenseStat * defReduction * statMultiplier(target.statuses, statKey));
    let dmg = Math.max(3, Math.round((sourcePower - effDef / 2) * weakness * variance * unravelMult));
    if (crit) dmg = Math.round(dmg * 1.5);
    const resonanceBonus = target._isBoss ? 1 : resonancePlayerDamageBonus(this.player.resonance);
    dmg = Math.round(dmg * resonanceBonus);
    if (weakness < 0) {
      // Absorb — heals the enemy instead
      target.hp = Math.min(target.maxHp, target.hp + Math.abs(dmg));
      this.log.push(`${label} is absorbed — ${target.name} heals ${Math.abs(dmg)} instead.`);
      return { dmg: 0, hit: true, crit, weak: false };
    }
    const mitigated = applyBarrier(target.statuses, dmg);
    if (mitigated < dmg) this.log.push(`${target.name}'s Barrier absorbs part of the blow.`);
    target.hp = Math.max(0, target.hp - mitigated);
    const weak = weakness > 1;
    this.log.push(`${label} hits ${target.name} for ${mitigated} damage${crit ? ' (Critical!)' : ''}${weak ? ' — weakness exploited!' : ''}.`);
    if (weak || crit) this.gainMomentum(1);
    return { dmg: mitigated, hit: true, crit, weak };
  }

  attack(targetKey?: string): CombatSnapshot {
    if (this.phase !== 'player' || (this.playerAP < 1 && this.freeActionCharges < 1)) return this.snapshot();
    const target = this.pickTarget(targetKey);
    if (!target) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.attack;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    const atk = this.player.derived.attack * statMultiplier(this.playerStatuses, 'atk');
    this.computeAndApplyDamage(target, atk, target.def, 'slash', 'Your attack');
    this.lastActionId = 'attack';
    this.lastActionType = 'slash';
    this.checkOutcome();
    return this.snapshot();
  }

  useSkill(skillId: string, targetKey?: string): CombatSnapshot {
    if (this.phase !== 'player') return this.snapshot();
    const skill = NAMED_SKILLS[skillId];
    if (!skill || !this.player.skillsKnown.includes(skillId)) return this.snapshot();
    if (skill.apCost === 0) return this.snapshot(); // passives aren't activated

    const cost = this.freeActionCharges > 0 ? 0 : skill.apCost;
    if (this.playerAP < cost) return this.snapshot();
    this.playerAP -= cost;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;

    if (hasStatus(this.playerStatuses, 'silence')) {
      this.log.push('You are Silenced and cannot use skills.');
      this.checkOutcome();
      return this.snapshot();
    }

    if (skill.tag === 'active_martyrs_flame') {
      this.player.currentHP = Math.max(1, this.player.currentHP - 10);
      const matk = this.player.derived.magicAttack * statMultiplier(this.playerStatuses, 'matk');
      for (const e of this.aliveEnemies()) {
        this.computeAndApplyDamage(e, matk, e.mdef, 'sacred', "Martyr's Flame", 'mdef');
      }
      this.log.push("Martyr's Flame costs you 10 HP.");
    } else if (skill.tag === 'active_sealing_strike') {
      const target = this.pickTarget(targetKey);
      if (target) {
        const atk = this.player.derived.attack * statMultiplier(this.playerStatuses, 'atk');
        this.computeAndApplyDamage(target, atk, target.def, 'sacred', 'Sealing Strike');
      }
      this.player.resonance = Math.max(0, this.player.resonance - 2);
    }

    if (!this.momentumUsedSkillThisCombat) {
      this.momentumUsedSkillThisCombat = true;
      this.gainMomentum(1);
    }
    this.lastActionId = `skill:${skillId}`;
    this.lastActionType = skill.damageType ?? null;
    this.checkOutcome();
    return this.snapshot();
  }

  resonanceAbility(targetKey?: string): CombatSnapshot {
    if (this.phase !== 'player' || this.player.resonance < 25) return this.snapshot();
    const cost = this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.resonance_ability;
    if (this.playerAP < cost) return this.snapshot();
    this.playerAP -= cost;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    const target = this.pickTarget(targetKey);
    if (target) {
      const matk = this.player.derived.magicAttack * statMultiplier(this.playerStatuses, 'matk');
      const effMdef = Math.round(target.mdef * 0.8);
      this.computeAndApplyDamage(target, matk, effMdef, 'shadow', 'Resonance Surge', 'mdef');
    }
    this.player.resonance = Math.max(0, this.player.resonance - 1);
    this.lastActionId = 'resonance_ability';
    this.lastActionType = 'shadow';
    this.checkOutcome();
    return this.snapshot();
  }

  guard(): CombatSnapshot {
    if (this.phase !== 'player' || (this.playerAP < 1 && this.freeActionCharges < 1)) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.guard;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    this.guarding = true;
    this.log.push('You raise your guard.');
    this.lastActionId = 'guard';
    this.lastActionType = null;
    return this.snapshot();
  }

  useItem(itemId: string): CombatSnapshot {
    if (this.phase !== 'player' || (this.playerAP < 1 && this.freeActionCharges < 1)) return this.snapshot();
    const item = ITEMS[itemId];
    const entry = this.player.inventory.find((i) => i.id === itemId && i.qty > 0);
    if (!item || !entry) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.use_item;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    entry.qty -= 1;
    this.player.inventory = this.player.inventory.filter((i) => i.qty > 0);

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
    if (this.phase !== 'player' || (this.playerAP < 1 && this.freeActionCharges < 1)) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.analyze;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    const target = this.pickTarget(targetKey);
    if (target) {
      (target as InternalEnemy)._revealed = true;
      this.log.push(`You Analyze ${target.name}, reading its weaknesses.`);
    }
    this.gainMomentum(1);
    this.lastActionId = 'analyze';
    this.lastActionType = null;
    return this.snapshot();
  }

  sunder(targetKey?: string): CombatSnapshot {
    if (this.phase !== 'player' || (this.playerAP < ACTION_AP_COST.sunder && this.freeActionCharges < 1)) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.sunder;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    const target = this.pickTarget(targetKey);
    if (target) {
      applyStatus(target.statuses, 'armour_break', 2);
      this.log.push(`You Sunder ${target.name}'s armour. Defense -50% for 2 turns.`);
    }
    this.lastActionId = 'sunder';
    this.lastActionType = null;
    return this.snapshot();
  }

  withdraw(): CombatSnapshot {
    if (this.phase !== 'player' || (this.playerAP < 1 && this.freeActionCharges < 1)) return this.snapshot();
    this.playerAP -= this.freeActionCharges > 0 ? 0 : ACTION_AP_COST.withdraw;
    if (this.freeActionCharges > 0) this.freeActionCharges -= 1;
    const alive = this.aliveEnemies();
    const avgSpd = alive.reduce((s, e) => s + e.spd, 0) / Math.max(1, alive.length);
    const chance = Math.max(10, Math.min(90, 60 + (this.effectivePlayerSpeed() - avgSpd)));
    if (this.rng() * 100 < chance) {
      this.phase = 'fled';
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
    if (choice === 'extra_turn') {
      this.playerAP += 2;
      this.log.push('Momentum: Extra Turn — you act again immediately.');
    } else if (choice === 'chorus_heal') {
      const heal = Math.round(this.player.derived.maxHP * 0.2);
      this.player.currentHP = Math.min(this.player.derived.maxHP, this.player.currentHP + heal);
      this.log.push(`Momentum: Chorus Heal — restored ${heal} HP.`);
    } else if (choice === 'clarity') {
      const restore = Math.round(this.player.derived.maxMP * 0.3);
      this.player.currentMP = Math.min(this.player.derived.maxMP, this.player.currentMP + restore);
      this.log.push(`Momentum: Clarity — restored ${restore} MP.`);
    } else if (choice === 'forgotten_technique') {
      this.freeActionCharges += 1;
      this.log.push('Momentum: Forgotten Technique — your next action costs 0 AP.');
    } else if (choice === 'unravel') {
      this.unravelPending = true;
      this.log.push('Momentum: Unravel — your next hit deals 2.0x damage, ignoring 50% Defense.');
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

  getXpEarned(): number {
    return this.enemies.filter((e) => e.hp <= 0).reduce((s, e) => s + e.xp, 0);
  }

  snapshot(): CombatSnapshot {
    const bossAlive = this.enemies.find((e) => e._isBoss && e.hp > 0);
    return {
      round: this.round,
      phase: this.phase,
      playerAP: this.playerAP,
      freeActionCharges: this.freeActionCharges,
      playerHP: this.player.currentHP,
      playerMaxHP: this.player.derived.maxHP,
      playerMP: this.player.currentMP,
      playerMaxMP: this.player.derived.maxMP,
      playerStatuses: this.playerStatuses,
      momentum: this.player.momentum,
      guarding: this.guarding,
      enemies: this.enemies
        .filter((e) => e.hp > 0 || this.phase === 'victory')
        .map((e) => ({
          key: e._key,
          name: e.name,
          hp: e.hp,
          maxHp: e.maxHp,
          alive: e.hp > 0,
          statuses: e.statuses,
          revealed: e._revealed,
          affinities: e.affinities,
        })),
      log: this.log,
      bossPhaseLabel: bossAlive && this.bossDef ? this.bossDef.getPhase(bossAlive.hp / bossAlive.maxHp).label : undefined,
    };
  }
}
