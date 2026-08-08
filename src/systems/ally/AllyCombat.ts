/**
 * PART 5 — ALLY COMBAT EVALUATOR (Phase 5).
 * Framework-agnostic plan for what a companion does on a round, mirroring the
 * CrisisSystem's pure-evaluator pattern: the engine owns effect application,
 * the system owns *choice* (weighted preference over legal actions).
 */
import {
  abilitiesForLoyalty,
  type AllyAbilityDef,
  type AllyDef,
  type AllyRole,
} from './AllyDefs';

/** What the ally sees of the fight — enough to make a sane decision, nothing more. */
export interface AllyCombatInput {
  /** Numerator/denominator of player current HP. */
  playerHp: number;
  playerMaxHp: number;
  /** Presence of a harmful status on the player (e.g. bleeding, poison). */
  playerHasDebuff: boolean;
  playerGuarding: boolean;
  playerMomentum: number;
  round: number;
  /** Boss phase key when fighting a boss, else null. */
  bossPhaseKey: string | null;
  /** Every live enemy as the ally understands it. */
  enemies: Array<{ key: string; hpFraction: number; isBoss: boolean; hasDebuff: boolean }>;
  /** Incentive weights injected by the scene (e.g. "protect the courier" events). */
  impulse?: Partial<Record<AllyRole, number>>;
}

export type AllyAction =
  | { kind: 'heal'; abilityId: string; note: string }
  | { kind: 'guard'; abilityId: string; note: string }
  | { kind: 'attack'; abilityId: string; targetKey: string; note: string }
  | { kind: 'support'; abilityId: string; targetKey?: string; note: string }
  | { kind: 'overwatch'; abilityId: string; note: string }
  | { kind: 'wait'; note: string };

export interface AllyTurnPlan {
  action: AllyAction;
  line: string;
}

/** Minor situational weighting: urgency favors healing when hurt, finishing when weak. */
function situationalWeight(ability: AllyAbilityDef, input: AllyCombatInput): number {
  const hurt = input.playerMaxHp > 0 && input.playerHp / input.playerMaxHp < 0.6;
  const weakAdd = input.enemies.some((e) => !e.isBoss && e.hpFraction < 0.35);
  if (ability.kind === 'heal' && hurt) return 1.6;
  if (ability.kind === 'damage' && weakAdd) return 1.4;
  if (ability.kind === 'guard' && input.playerGuarding) return 0.4;
  return 1;
}

/** Picks the weakest non-boss to pressure first, boss otherwise. */
function pickTarget(input: AllyCombatInput): string | null {
  if (input.enemies.length === 0) return null;
  const sorted = [...input.enemies].sort(
    (a, b) => Number(a.isBoss) - Number(b.isBoss) || a.hpFraction - b.hpFraction,
  );
  return sorted[0].key;
}

/** Best legal ability for a given ability-kind (tier-gated), or null. */
function bestAbility(kind: AllyAbilityDef['kind'], abilities: AllyAbilityDef[], input: AllyCombatInput): AllyAbilityDef | null {
  const pool = abilities.filter((a) => a.kind === kind);
  if (pool.length === 0) return null;
  return pool.reduce((best, a) => (situationalWeight(a, input) > situationalWeight(best, input) ? a : best));
}

/** The generic ability-kind each role prefers when acting. */
const ROLE_KIND: Record<AllyRole, AllyAbilityDef['kind']> = {
  healer: 'heal',
  support: 'support',
  striker: 'damage',
  shielding: 'guard',
  arcade: 'overwatch',
};

/**
 * Plan the ally's contribution to the round. The engine executes the plan and
 * owns RNG for hit/miss; this evaluator is deterministic given the input.
 * Order of preference: save them (heal), guard, field aid (support), hunt
 * (damage), overwatch, then wait.
 */
export function planAllyTurn(def: AllyDef, loyalty: number, input: AllyCombatInput): AllyTurnPlan {
  const abilities = abilitiesForLoyalty(def, loyalty);
  const name = def.name;

  // 1. Dying player: healing wins outright.
  const dying = input.playerMaxHp > 0 && input.playerHp / input.playerMaxHp < 0.25;
  if (dying) {
    const firstAid = abilities.find((a) => a.kind === 'heal');
    if (firstAid) {
      return {
        action: { kind: 'heal', abilityId: firstAid.id, note: 'rushed cure' },
        line: `${name} rushes to your side — ${firstAid.description}`,
      };
    }
  }

  // 2. Guard against a boss's round when not already guarding.
  if (input.bossPhaseKey !== null && !input.playerGuarding) {
    const guard = bestAbility('guard', abilities, input);
    if (guard) {
      return {
        action: { kind: 'guard', abilityId: guard.id, note: 'boss round' },
        line: `${name} holds the line — ${guard.description}`,
      };
    }
  }

  // 3. Top the player off any time they're below 70%.
  if (input.playerMaxHp > 0 && input.playerHp / input.playerMaxHp < 0.7) {
    const heal = bestAbility('heal', abilities, input);
    if (heal) {
      return {
        action: { kind: 'heal', abilityId: heal.id, note: `player at ${Math.round((input.playerHp / input.playerMaxHp) * 100)}%` },
        line: `${name} mends your wounds — ${heal.description}`,
      };
    }
  }

  // 4. Field support: strip/enable when something's worth denying.
  const targetKey = pickTarget(input) ?? undefined;
  const support = bestAbility('support', abilities, input);
  if (support) {
    return {
      action: { kind: 'support', abilityId: support.id, targetKey, note: 'aids the field' },
      line: `${name} works the field — ${support.description}`,
    };
  }

  // 5. Damage: pressure the weak point, then the boss.
  const t = pickTarget(input);
  if (t) {
    const strike = bestAbility('damage', abilities, input);
    if (strike) {
      return {
        action: { kind: 'attack', abilityId: strike.id, targetKey: t, note: `pressure on ${t}` },
        line: `${name} strikes ${t} — ${strike.description}`,
      };
    }
  }

  // 6. Overwatch: keep a reaction armed for the coming blows.
  const overwatch = bestAbility('overwatch', abilities, input);
  if (overwatch) {
    return {
      action: { kind: 'overwatch', abilityId: overwatch.id, note: 'reaction armed' },
      line: `${name} sets an overwatch — ${overwatch.description}`,
    };
  }

  return {
    action: { kind: 'wait', note: 'holds position' },
    line: `${name} holds position, watching.`,
  };
}

/** Export role-kind map for scenes that show what the ally leaned toward. */
export const ALLY_ROLE_KIND = ROLE_KIND;