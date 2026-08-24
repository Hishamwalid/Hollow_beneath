import type { DerivedStats, Equipment, StatBlock } from './types';
import { ITEMS } from './items';

/**
 * Definitive edition: the descent is one person's journey, so every run starts
 * from the same stat spread. The only creation choice is the player's name.
 */
export const STARTING_STATS: StatBlock = { str: 6, dex: 6, con: 6, int: 6, will: 6 };
export const STAT_MAX = 10;

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

export function getEquipmentBonuses(equipment: Equipment): EquipmentBonuses {
  const slots = ['weapon', 'armour', 'focus', 'accessory'] as const;
  let atk = 0, def = 0, matk = 0, mdef = 0;
  for (const slot of slots) {
    const id = equipment[slot];
    if (!id) continue;
    const item = ITEMS[id];
    if (!item?.effect?.statBonus) continue;
    if (item.effect.statBonus.atk) atk += item.effect.statBonus.atk;
    if (item.effect.statBonus.def) def += item.effect.statBonus.def;
    if (item.effect.statBonus.matk) matk += item.effect.statBonus.matk;
    if (item.effect.statBonus.mdef) mdef += item.effect.statBonus.mdef;
  }
  return { weaponAtk: atk, armourDef: def, focusMatk: matk, accessoryMdef: mdef };
}
