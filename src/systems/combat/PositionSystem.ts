import type { EnemyTendency, Row } from '@data/types';

export const ROW_ORDER: Row[] = ['back', 'middle', 'front'];

export const POSITION_META: Record<Row, { label: string; dmgMult: number; defMult: number; evadeBonus: number }> = {
  front: { label: 'FRONT', dmgMult: 1.15, defMult: 1.1, evadeBonus: 0 },
  middle: { label: 'MID', dmgMult: 1, defMult: 1, evadeBonus: 0 },
  back: { label: 'BACK', dmgMult: 0.9, defMult: 0.85, evadeBonus: 10 },
};

/** Phase 6b notes
 * dmgMult  — multiplier on damage this row deals.
 * defMult  — multiplier on incoming damage (front is exposed, back is shielded).
 * evadeBonus — flat dodge added while the occupant holds this row.
 */

/** Clamps a row index (0..2 over ROW_ORDER) to the valid range. */
export function clampRow(index: number): number {
  return Math.max(0, Math.min(ROW_ORDER.length - 1, index));
}

/** Steps a row index by `delta` (negative retreats, positive advances), clamped. */
export function stepRow(index: number, delta: number): number {
  return clampRow(index + delta);
}

export function rowLabel(row: Row): string {
  return POSITION_META[row].label;
}

/**
 * Phase 6b: default battlefield row for an enemy based on its tendency.
 * Aggressors / berserkers / fanatics favour the front; casters / sages /
 * hunters keep to the back; everything else occupies the middle.
 */
export function defaultRowFor(tendency?: EnemyTendency): Row {
  switch (tendency) {
    case 'aggressor':
    case 'berserker':
    case 'fanatic':
      return 'front';
    case 'caster':
    case 'sage':
    case 'hunter':
      return 'back';
    default:
      return 'middle';
  }
}
