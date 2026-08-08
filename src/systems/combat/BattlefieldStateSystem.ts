/** Phase 6a: Battlefield States — global, duration-limited modifiers on the damage path.
 *
 * A state covers the whole field for N turns (new overrides old). Each state
 * maps a DamageType to a multiplier consulted by `computeAndApplyDamage`;
 * absent a state the multiplier is 1.0 (no change to existing behaviour).
 *
 * Sources (implemented later in Phase 6): enemy intents, Scholar Sacred Ground,
 * certain items. The data model + modifier logic live here so the engine and
 * tests can drive them headlessly.
 */
import type { DamageType } from '@data/types';

export type BattlefieldStateId =
  | 'dust_storm'
  | 'sacred_ground'
  | 'broken_terrain'
  | 'echo_zone'
  | 'shadow_veil'
  | 'time_distortion'
  | 'silence_field'
  | 'truth_aura';

export const BATTLEFIELD_STATES: Record<BattlefieldStateId, { label: string; damageMod: (type: DamageType) => number }> = {
  // Obscured range: ranged elemental attacks lose cohesion.
  dust_storm: {
    label: 'Dust Storm',
    damageMod: (t) => (t === 'slash' || t === 'pierce' || t === 'blunt' ? 1 : 0.85),
  },
  // Sanctified ground answers light, recoils shadow.
  sacred_ground: {
    label: 'Sacred Ground',
    damageMod: (t) => (t === 'sacred' ? 1.3 : t === 'shadow' ? 0.6 : 1),
  },
  // Shattered footing rewards blunt impact, unbalances blades.
  broken_terrain: {
    label: 'Broken Terrain',
    damageMod: (t) => (t === 'blunt' ? 1.3 : t === 'slash' ? 0.85 : t === 'pierce' ? 0.9 : 1),
  },
  // Resonant echoes amplify physical force.
  echo_zone: {
    label: 'Echo Zone',
    damageMod: (t) => (t === 'slash' || t === 'pierce' || t === 'blunt' ? 1.15 : 1),
  },
  // Gloom thickens shadow, burns away in light.
  shadow_veil: {
    label: 'Shadow Veil',
    damageMod: (t) => (t === 'shadow' ? 1.3 : t === 'sacred' ? 0.6 : 1),
  },
  // Time drags: all effects come softer, slower.
  time_distortion: {
    label: 'Time Distortion',
    damageMod: () => 0.9,
  },
  // Silenced resonance: magic sputters, steel rings true.
  silence_field: {
    label: 'Silence Field',
    damageMod: (t) => (t === 'flame' || t === 'frost' || t === 'shock' || t === 'sacred' || t === 'shadow' ? 0.5 : 1.1),
  },
  // Revelation burns shadow, magnifies sacred truth.
  truth_aura: {
    label: 'Truth Aura',
    damageMod: (t) => (t === 'sacred' ? 1.4 : t === 'shadow' ? 0.6 : 1),
  },
};

export interface BattlefieldState {
  id: BattlefieldStateId;
  turns: number;
}

/** Multiplier for a damage type under the active state (1.0 when none). */
export function battlefieldDamageMod(state: BattlefieldState | null, type: DamageType): number {
  if (!state) return 1;
  return BATTLEFIELD_STATES[state.id].damageMod(type);
}

/** Consume one turn; returns the surviving state (or null when it expires). */
export function tickBattlefieldState(state: BattlefieldState | null): BattlefieldState | null {
  if (!state) return null;
  const turns = state.turns - 1;
  return turns <= 0 ? null : { id: state.id, turns };
}
