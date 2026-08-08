import type { BossProfile, DamageType, ProfileView } from '@data/types';

const PHYSICAL_TYPES: DamageType[] = ['slash', 'pierce', 'blunt'];

/** Phase 5: the 12-metric combat-local trace a boss keeps on the player. Pure state + pure view. */
export function createProfile(): BossProfile {
  return {
    dmgByType: {},
    totalDmg: 0,
    actions: 0,
    turns: 0,
    guards: 0,
    analyzes: 0,
    items: 0,
    heals: 0,
    healCount: 0,
    buffsUsed: 0,
    statusesApplied: 0,
    momentumSpends: 0,
    weaknessHits: 0,
    crits: 0,
    combos: 0,
    repeats: 0,
  };
}

export function recordAction(p: BossProfile): void {
  p.actions += 1;
}

export function recordTurn(p: BossProfile): void {
  p.turns += 1;
}

export function recordGuard(p: BossProfile): void {
  p.guards += 1;
}

export function recordAnalyze(p: BossProfile): void {
  p.analyzes += 1;
}

export function recordItem(p: BossProfile): void {
  p.items += 1;
}

export function recordHeal(p: BossProfile, amount: number): void {
  p.heals += amount;
  p.healCount += 1;
}

export function recordBuffUsed(p: BossProfile): void {
  p.buffsUsed += 1;
}

export function recordStatusApplied(p: BossProfile): void {
  p.statusesApplied += 1;
}

export function recordMomentumSpend(p: BossProfile): void {
  p.momentumSpends += 1;
}

export function recordWeaknessHit(p: BossProfile): void {
  p.weaknessHits += 1;
}

export function recordCrit(p: BossProfile): void {
  p.crits += 1;
}

export function recordCombo(p: BossProfile): void {
  p.combos += 1;
}

export function recordRepeat(p: BossProfile): void {
  p.repeats += 1;
}

/** Records a landed hit: damage by type, physical/magic split, favourite element. */
export function recordDamage(p: BossProfile, type: DamageType, amount: number): void {
  p.dmgByType[type] = (p.dmgByType[type] ?? 0) + amount;
  p.totalDmg += Math.max(0, amount);
}

export function profileView(p: BossProfile): ProfileView {
  const total = Math.max(1, p.totalDmg);
  const phys = PHYSICAL_TYPES.reduce((s, t) => s + (p.dmgByType[t] ?? 0), 0);
  let favoriteElement: DamageType | null = null;
  let favoriteDmg = 0;
  for (const [t, v] of Object.entries(p.dmgByType) as [DamageType, number][]) {
    if (v > favoriteDmg) {
      favoriteDmg = v;
      favoriteElement = t;
    }
  }
  const favoriteShare = favoriteElement ? (p.dmgByType[favoriteElement] ?? 0) / total : 0;
  return {
    totalDmg: p.totalDmg,
    physPct: Math.round((phys / total) * 100),
    magicPct: Math.round(((total - phys) / total) * 100),
    favoriteElement,
    favoriteShare: Math.round(favoriteShare * 100) / 100,
    guardPct: p.turns > 0 ? Math.round((p.guards / p.turns) * 100) : 0,
    analyzeCount: p.analyzes,
    actionsPerTurn: p.turns > 0 ? Math.round((p.actions / p.turns) * 10) / 10 : 0,
    healCount: p.healCount,
    items: p.items,
    statusesApplied: p.statusesApplied,
    buffsUsed: p.buffsUsed,
    momentumSpends: p.momentumSpends,
    weaknessHits: p.weaknessHits,
    crits: p.crits,
    combos: p.combos,
    repeats: p.repeats,
    turns: p.turns,
  };
}