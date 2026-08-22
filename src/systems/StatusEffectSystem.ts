import type { StatusId, StatusInstance } from '@data/types';
import { DOT_TABLE, DEFAULT_BARRIER_AMOUNT } from '@data/statusEffects';

const DOT_IDS = new Set(Object.keys(DOT_TABLE));

export function isDot(id: StatusId): boolean {
  return DOT_IDS.has(id);
}

/** Adds or refreshes a status. DoTs stack (cap 3, extends duration); everything else refreshes duration only. */
export function applyStatus(
  statuses: StatusInstance[],
  id: StatusId,
  turns: number,
  stacks = 1,
  meta?: Record<string, number>,
): void {
  const existing = statuses.find((s) => s.id === id);
  if (isDot(id)) {
    if (existing) {
      existing.stacks = Math.min(3, existing.stacks + stacks);
      existing.turnsRemaining = Math.max(existing.turnsRemaining, turns);
    } else {
      statuses.push({ id, stacks: Math.min(3, stacks), turnsRemaining: turns, meta });
    }
    return;
  }
  if (existing) {
    existing.turnsRemaining = Math.max(existing.turnsRemaining, turns);
    if (meta) existing.meta = { ...(existing.meta ?? {}), ...meta };
  } else {
    statuses.push({ id, stacks: 1, turnsRemaining: turns, meta });
  }
}

export function hasStatus(statuses: StatusInstance[], id: StatusId): boolean {
  return statuses.some((s) => s.id === id);
}

export function getStatus(statuses: StatusInstance[], id: StatusId): StatusInstance | undefined {
  return statuses.find((s) => s.id === id);
}

export function removeStatus(statuses: StatusInstance[], id: StatusId): void {
  const idx = statuses.findIndex((s) => s.id === id);
  if (idx >= 0) statuses.splice(idx, 1);
}

/** Removes all "beneficial" statuses — used by Dispel Holy-type effects. */
export function removeAllBuffs(statuses: StatusInstance[]): void {
  const buffIds = ['focus', 'barrier', 'regeneration', 'fortify', 'blessing', 'haste', 'reflection', 'brace', 'echo_surge', 'atk_up', 'defense_up'];
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (buffIds.includes(statuses[i].id)) statuses.splice(i, 1);
  }
}

const DEBUFF_IDS = ['weakness', 'defense_down', 'slow', 'armour_break', 'seal_mind', 'fragile_perception', 'exhausted', 'slowed', 'sacred_mark', 'heal_block'];

/** Removes every debuff. */
export function removeAllDebuffs(statuses: StatusInstance[]): void {
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (DEBUFF_IDS.includes(statuses[i].id)) statuses.splice(i, 1);
  }
}

/** Removes a single debuff (arbitrary choice). */
export function removeDebuffs(statuses: StatusInstance[]): void {
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (DEBUFF_IDS.includes(statuses[i].id)) {
      statuses.splice(i, 1);
      return;
    }
  }
}

/** Resolves DoT damage for this turn. Returns total damage and per-effect log lines. Mutates duration/removes expired. */
export function tickDots(statuses: StatusInstance[]): { damage: number; lines: string[]; speedPenalty: number; missChanceBonus: number } {
  let damage = 0;
  let speedPenalty = 0;
  let missChanceBonus = 0;
  const lines: string[] = [];
  for (let i = statuses.length - 1; i >= 0; i--) {
    const s = statuses[i];
    if (isDot(s.id)) {
      const spec = DOT_TABLE[s.id as keyof typeof DOT_TABLE];
      const amt = spec.perStack[Math.min(2, s.stacks - 1)];
      damage += amt;
      lines.push(`${spec.label} deals ${amt} damage.`);
      if (spec.scaling === 'speed') speedPenalty += amt / 2;
      if (spec.scaling === 'miss') missChanceBonus += 15 * s.stacks;
      s.turnsRemaining -= 1;
      if (s.turnsRemaining <= 0) statuses.splice(i, 1);
    }
  }
  return { damage, lines, speedPenalty, missChanceBonus };
}

/** Ticks down non-DoT status durations at end of round; removes expired ones. Returns expiry messages. */
export function tickDurations(statuses: StatusInstance[]): string[] {
  const messages: string[] = [];
  for (let i = statuses.length - 1; i >= 0; i--) {
    const s = statuses[i];
    if (isDot(s.id)) continue; // handled by tickDots
    s.turnsRemaining -= 1;
    if (s.turnsRemaining <= 0) {
      messages.push(`${s.id.replace('_', ' ')} fades.`);
      statuses.splice(i, 1);
    }
  }
  return messages;
}

/** Multiplier for a given stat key from active buffs/debuffs. 1.0 = no change. */
export function statMultiplier(statuses: StatusInstance[], stat: 'atk' | 'def' | 'matk' | 'mdef' | 'spd'): number {
  let mult = 1.0;
  if (stat === 'matk' && hasStatus(statuses, 'focus')) mult *= 1.2;
  if (stat === 'def' && hasStatus(statuses, 'fortify')) mult *= 1.3;
  if (stat === 'mdef' && hasStatus(statuses, 'fortify')) mult *= 1.3;
  if (stat === 'spd' && hasStatus(statuses, 'haste')) mult *= 1.25;
  if (stat === 'atk' && hasStatus(statuses, 'atk_up')) mult *= 1.25;
  if (stat === 'def' && hasStatus(statuses, 'defense_up')) mult *= 1.2;
  if (stat === 'atk' && hasStatus(statuses, 'weakness')) mult *= 0.8;
  if (stat === 'def' && hasStatus(statuses, 'defense_down')) mult *= 0.7;
  if (stat === 'mdef' && hasStatus(statuses, 'defense_down')) mult *= 0.7;
  if (stat === 'def' && hasStatus(statuses, 'armour_break')) mult *= 0.5;
  if (stat === 'spd' && hasStatus(statuses, 'slow')) mult *= 0.75;
  if (stat === 'spd' && hasStatus(statuses, 'root')) mult *= 0.5;
  if (stat === 'spd' && hasStatus(statuses, 'frostbite')) {
    const fb = getStatus(statuses, 'frostbite');
    if (fb) mult *= Math.max(0.25, 1 - fb.stacks * 0.15);
  }
  return mult;
}

/** Consumes barrier absorption against incoming damage. Returns the damage that gets through. */
export function applyBarrier(statuses: StatusInstance[], incoming: number): number {
  const barrier = getStatus(statuses, 'barrier');
  if (!barrier) return incoming;
  const amount = barrier.meta?.amount ?? DEFAULT_BARRIER_AMOUNT;
  const absorbed = Math.min(amount, incoming);
  const remaining = amount - absorbed;
  if (remaining <= 0) {
    removeStatus(statuses, 'barrier');
  } else {
    barrier.meta = { ...(barrier.meta ?? {}), amount: remaining };
  }
  return incoming - absorbed;
}

export function setBarrier(statuses: StatusInstance[], amount: number): void {
  const existing = getStatus(statuses, 'barrier');
  if (existing) {
    existing.meta = { amount };
    existing.turnsRemaining = 99;
  } else {
    statuses.push({ id: 'barrier', stacks: 1, turnsRemaining: 99, meta: { amount } });
  }
}
