import type { BossIntentDef, BossTurnContext, EnemyTendency, EnemyTurnContext, IntentDef } from '@data/types';

export const TENDENCY_META: Record<EnemyTendency, { name: string; glyph: string; hint: string }> = {
  aggressor: { name: 'Aggressor', glyph: 'AGG', hint: 'Presses the most vulnerable target' },
  tactician: { name: 'Tactician', glyph: 'TAC', hint: 'Counters your last action' },
  berserker: { name: 'Berserker', glyph: 'BRK', hint: 'Grows deadlier as it is hurt' },
  guardian: { name: 'Guardian', glyph: 'GRD', hint: 'Shields or protects its allies' },
  caster: { name: 'Caster', glyph: 'CST', hint: 'Relies on magic; vulnerable when silenced' },
  hunter: { name: 'Hunter', glyph: 'HNT', hint: 'Focusses the frailest among you' },
  sage: { name: 'Sage', glyph: 'SAG', hint: 'Buffs or restores itself' },
  coward: { name: 'Coward', glyph: 'CWD', hint: 'Calls for help when it is losing' },
  fanatic: { name: 'Fanatic', glyph: 'FAN', hint: 'Strikes relentlessly, abandonning caution' },
  manipulator: { name: 'Manipulator', glyph: 'MNP', hint: 'Wields status effects against you' },
};

export function tendencyName(id?: EnemyTendency): string {
  return id ? TENDENCY_META[id].name : '';
}

export function tendencyGlyph(id?: EnemyTendency): string {
  return id ? TENDENCY_META[id].glyph : '';
}

export function tendencyHint(id?: EnemyTendency): string {
  return id ? TENDENCY_META[id].hint : '';
}

export type IntentConfidence = 'none' | 'faint' | 'likely' | 'strong' | 'certain';

/** How clearly the player reads a declared intent at a given investigation layer. */
export function confidenceFor(layer: number): IntentConfidence {
  if (layer <= 0) return 'none';
  if (layer === 1) return 'faint';
  if (layer === 2) return 'likely';
  if (layer === 3) return 'strong';
  return 'certain';
}

const CONFIDENCE_MARKER: Record<IntentConfidence, string> = {
  none: 'unreadable',
  faint: 'faint',
  likely: 'likely',
  strong: 'strong',
  certain: 'certain',
};

export function intentLine(label: string | undefined, layer: number, alreadyActed: boolean, actedLabel?: string): string {
  if (alreadyActed) return `(acted — ${actedLabel ?? ''})`;
  if (!label) return 'intentions unreadable';
  return `${CONFIDENCE_MARKER[confidenceFor(layer)]}. ${label}`;
}

/** Weighted pick among eligible intents. Conditions are evaluated against the supplied context. */
export function pickEnemyIntent(intents: IntentDef[], ctx: EnemyTurnContext, rng: () => number): IntentDef | undefined {
  const eligible = intents.filter((i) => !i.condition || i.condition(ctx));
  return weightedPick(eligible, rng) as IntentDef | undefined;
}

export function pickBossIntent(
  intents: BossIntentDef[],
  ctx: BossTurnContext,
  rng: () => number,
  bias?: Record<string, number>,
): BossIntentDef | undefined {
  const eligible = intents.filter((i) => !i.condition || i.condition(ctx));
  return weightedPick(eligible, rng, bias) as BossIntentDef | undefined;
}

function weightedPick<T>(eligible: T[], rng: () => number, bias?: Record<string, number>): T | undefined {
  if (eligible.length === 0) return undefined;
  const weight = (item: T): number => {
    const base = ((item as IntentDef).weight ?? 1) as number;
    if (bias) {
      const id = (item as IntentDef).id;
      const mult = bias[id];
      if (mult !== undefined) return base * mult;
    }
    return base;
  };
  const total = eligible.reduce((s, i) => s + weight(i), 0);
  let roll = rng() * total;
  for (const item of eligible) {
    roll -= weight(item);
    if (roll <= 0) return item;
  }
  return eligible[eligible.length - 1];
}