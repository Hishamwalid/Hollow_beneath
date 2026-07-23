import type { DerivedStats, StatBlock } from './types';

export const POINT_BUY_TOTAL = 30;
export const STAT_MIN = 1;
export const STAT_MAX = 10;
export const BALANCED_REFERENCE: StatBlock = { str: 6, dex: 6, con: 6, int: 6, will: 6 };

export interface EquipmentBonuses {
  weaponAtk: number;
  armourDef: number;
  focusMatk: number;
  accessoryMdef: number;
}

export const STARTING_EQUIPMENT_BONUSES: EquipmentBonuses = {
  weaponAtk: 2, // rusty_dagger
  armourDef: 1, // leather_vest
  focusMatk: 1, // cracked_lens
  accessoryMdef: 0,
};

/** GDD 4.2 — all integer, no rounding ambiguity. */
export function computeDerivedStats(stats: StatBlock, bonuses: EquipmentBonuses): DerivedStats {
  const maxHP = stats.con * 10 + 30;
  const maxMP = stats.will * 6 + 20;
  const attack = stats.str * 2 + bonuses.weaponAtk;
  const defense = stats.con * 2 + bonuses.armourDef;
  const magicAttack = stats.int * 2 + bonuses.focusMatk;
  const magicDefense = stats.int * 2 + stats.will + bonuses.accessoryMdef;
  const speed = stats.dex * 2 + 8;
  const accuracy = Math.min(95, 80 + stats.dex * 2);
  const dodge = Math.min(40, stats.dex * 2);

  return { maxHP, maxMP, attack, defense, magicAttack, magicDefense, speed, accuracy, dodge };
}

export function pointsSpent(stats: StatBlock): number {
  return stats.str + stats.dex + stats.con + stats.int + stats.will;
}

export function isValidBuild(stats: StatBlock): boolean {
  const vals = [stats.str, stats.dex, stats.con, stats.int, stats.will];
  if (vals.some((v) => v < STAT_MIN || v > STAT_MAX)) return false;
  return pointsSpent(stats) === POINT_BUY_TOTAL;
}

export const PRESET_BUILDS: Record<string, StatBlock> = {
  Balanced: { str: 6, dex: 6, con: 6, int: 6, will: 6 },
  Warrior: { str: 9, dex: 5, con: 8, int: 2, will: 6 },
  Scholar: { str: 2, dex: 5, con: 4, int: 9, will: 10 },
  Ranger: { str: 5, dex: 10, con: 4, int: 4, will: 7 },
  Guardian: { str: 6, dex: 4, con: 10, int: 3, will: 7 },
  Shadow: { str: 4, dex: 7, con: 5, int: 6, will: 8 },
};
