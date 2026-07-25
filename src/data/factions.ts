import type { FactionState } from './types';

export const STARTING_FACTIONS: FactionState = { sable: 0, archive: 0, covenant: 0, caravan: 0 };

export interface FactionMeta {
  id: keyof FactionState;
  name: string;
  motto: string;
  color: number;
  colorCss: string;
}

export const FACTIONS: Record<keyof FactionState, FactionMeta> = {
  sable: {
    id: 'sable',
    name: 'The Sable Order',
    motto: 'What sleeps should not be woken.',
    color: 0x8c2f2f,
    colorCss: '#8c2f2f',
  },
  archive: {
    id: 'archive',
    name: 'The Argent Archive',
    motto: 'Understanding is the only immortality.',
    color: 0x3e6e8e,
    colorCss: '#3e6e8e',
  },
  covenant: {
    id: 'covenant',
    name: 'The Ash Covenant',
    motto: 'We do not evolve. We are translated.',
    color: 0x7b4b9e,
    colorCss: '#7b4b9e',
  },
  caravan: {
    id: 'caravan',
    name: 'The Dust-Road Caravan',
    motto: 'The graveyards of the curious are paved with answers.',
    color: 0xa8703b,
    colorCss: '#a8703b',
  },
};

export type InfluenceStatus = 'Hostile' | 'Neutral' | 'Friendly' | 'Devoted';

export function influenceStatus(value: number): InfluenceStatus {
  if (value <= -25) return 'Hostile';
  if (value >= 25 && value <= 74) return 'Friendly';
  if (value >= 75) return 'Devoted';
  return 'Neutral';
}

export function clampInfluence(value: number): number {
  return Math.max(-100, Math.min(100, value));
}
