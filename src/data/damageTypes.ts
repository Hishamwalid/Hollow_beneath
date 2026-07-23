import type { DamageType } from './types';

export interface DamageTypeMeta {
  id: DamageType;
  label: string;
  color: number; // hex for Phaser
  colorCss: string;
}

export const DAMAGE_TYPES: Record<DamageType, DamageTypeMeta> = {
  slash: { id: 'slash', label: 'Slash', color: 0xc0392b, colorCss: '#c0392b' },
  pierce: { id: 'pierce', label: 'Pierce', color: 0xd4ac0d, colorCss: '#d4ac0d' },
  blunt: { id: 'blunt', label: 'Blunt', color: 0x8b5a2b, colorCss: '#8b5a2b' },
  flame: { id: 'flame', label: 'Flame', color: 0xe67e22, colorCss: '#e67e22' },
  frost: { id: 'frost', label: 'Frost', color: 0x5dade2, colorCss: '#5dade2' },
  shock: { id: 'shock', label: 'Shock', color: 0x9b59b6, colorCss: '#9b59b6' },
  sacred: { id: 'sacred', label: 'Sacred', color: 0xf5f0e1, colorCss: '#f5f0e1' },
  shadow: { id: 'shadow', label: 'Shadow', color: 0x2c2c34, colorCss: '#2c2c34' },
};

export function weaknessLabel(multiplier: number): string {
  if (multiplier <= -0.01) return 'Absorb';
  if (multiplier === 0) return 'Immune';
  if (multiplier < 1) return 'Resist';
  if (multiplier > 1) return 'Weak';
  return 'Normal';
}
