/**
 * PART 13 — ALLY & COMPANION SYSTEM (Phase 5).
 * Companion archetypes, loyalty tiers, and role definitions.
 * Pure data + pure evaluators so the files can be imported and tested headlessly;
 * the CombatEngine decides the concrete effect application.
 */
import type { DamageType, StatusId } from '@data/types';

export type AllyId = 'warden_emissary' | 'covenant_courier' | 'sable_zealot' | 'archive_cartographer';

export type LoyaltyTier = 'bonded' | 'steadfast' | 'devoted' | 'true';

/** Effects granted at each loyalty tier (player-facing summaries). */
export interface LoyaltyTierDef {
  tier: LoyaltyTier;
  threshold: number;
  label: string;
  description: string;
}

export const LOYALTY_MAX = 100;
export const LOYALTY_TIERS: LoyaltyTierDef[] = [
  { tier: 'bonded', threshold: 0, label: 'Bonded', description: 'Fights beside you in light skirmishes; a healing hand at camp.' },
  { tier: 'steadfast', threshold: 25, label: 'Steadfast', description: 'Joins battles reliably; gains a second combat ability.' },
  { tier: 'devoted', threshold: 50, label: 'Devoted', description: 'Intercedes in boss fights; carries its own overwatch.' },
  { tier: 'true', threshold: 80, label: 'True', description: 'Accompanies you anywhere; unlocks its final ability and ending hooks.' },
];

/** What an ally is willing to do each round, in preference order. */
export type AllyRole =
  | 'healer'     // prioritizes keeping the player above 50% HP
  | 'support'    // strips/denies enemy pressure, banks momentum
  | 'striker'    // deals damage, finishes weak targets first
  | 'shielding'  // guards the player, absorbs hits
  | 'arcade'     // probing attacks, reveals intents, feeds wisdom

export interface AllyAbilityDef {
  id: string;
  label: string;
  minTier: LoyaltyTier;
  description: string;
  kind: 'heal' | 'support' | 'damage' | 'guard' | 'overwatch' | 'revive' | 'signature';
  /** Fraction of the player's relevant derived stat used as its power source. */
  powerScale?: number;
  /** Status it applies on use, when kind is status-flavored. */
  statusId?: StatusId;
}

export interface AllyCombatProfile {
  /** Stats are expressed as a fraction of the player's derived bases, so allies scale with the run. */
  hpPct: number;
  atkPct: number;
  matkPct: number;
  defPct: number;
  healPct: number;
  damageType: DamageType;
  /** Chance (0..1) the ally lands on any given turn instead of fumbling. */
  reliability: number;
}

export interface AllyDef {
  id: AllyId;
  name: string;
  role: AllyRole;
  faction: string;
  blurb: string;
  profile: AllyCombatProfile;
  abilities: AllyAbilityDef[];
  /** Preference weights the evaluator uses to pick among legal actions. */
  tendencies: Record<AllyRole, number>;
}

export const ALLY_DEFS: Record<AllyId, AllyDef> = {
  warden_emissary: {
    id: 'warden_emissary',
    name: 'Sentinel-Echo',
    role: 'shielding',
    faction: 'Archive',
    blurb: 'A walking oath that remembers the ground it held. Grieves openly, fights calmly.',
    profile: {
      hpPct: 0.4,
      atkPct: 0.3,
      matkPct: 0.1,
      defPct: 0.5,
      healPct: 0,
      damageType: 'blunt',
      reliability: 0.9,
    },
    abilities: [
      { id: 'aegis_body', label: 'Aegis Body', minTier: 'bonded', kind: 'guard', description: 'Takes the next hit meant for you.' },
      { id: 'rooted_hold', label: 'Rooted Hold', minTier: 'steadfast', kind: 'support', description: 'Anchors the field, reducing incoming damage 20% for a turn.' },
      { id: 'last_oath', label: 'Last Oath', minTier: 'devoted', kind: 'overwatch', description: 'Guards a 25% threshold — intervenes when you dip below it.' },
      { id: 'unbroken_vigil', label: 'Unbroken Vigil', minTier: 'true', kind: 'signature', description: 'Once per fight, nullifies the hit that would end you and re-arms for 2 rounds.' },
    ],
    tendencies: { healer: 0.05, support: 0.3, striker: 0.05, shielding: 0.9, arcade: 0.1 },
  },
  covenant_courier: {
    id: 'covenant_courier',
    name: 'Covenant Courier',
    role: 'healer',
    faction: 'Covenant',
    blurb: 'Runs errands for a dead church; keeps your wounds patched out of habit of mercy.',
    profile: {
      hpPct: 0.3,
      atkPct: 0.2,
      matkPct: 0.35,
      defPct: 0.3,
      healPct: 0.15,
      damageType: 'sacred',
      reliability: 0.85,
    },
    abilities: [
      { id: 'field_dressing', label: 'Field Dressing', minTier: 'bonded', kind: 'heal', description: 'Restores 15% of your max HP.' },
      { id: 'mercy_pact', label: 'Mercy Pact', minTier: 'steadfast', kind: 'heal', description: 'Cures one harmful status and restores 10% HP.' },
      { id: 'bitter_revival', label: 'Bitter Revival', minTier: 'devoted', kind: 'revive', description: 'Pulls you back to 20% HP once per fight when you fall.' },
      { id: 'the_whole_letter', label: 'The Whole Letter', minTier: 'true', kind: 'signature', description: 'Reads the fight forward: heals 25% and reveals every enemy intent.' },
    ],
    tendencies: { healer: 1.0, support: 0.25, striker: 0.1, shielding: 0.15, arcade: 0.2 },
  },
  sable_zealot: {
    id: 'sable_zealot',
    name: 'Sable Zealot',
    role: 'striker',
    faction: 'Sable',
    blurb: 'The first face in many years. It attacks the way it remembers praise: without subtlety.',
    profile: {
      hpPct: 0.35,
      atkPct: 0.8,
      matkPct: 0.2,
      defPct: 0.15,
      healPct: 0,
      damageType: 'shadow',
      reliability: 0.8,
    },
    abilities: [
      { id: 'brand_swing', label: 'Brand Swing', minTier: 'bonded', kind: 'damage', description: 'Deals solid damage to the target.' },
      { id: 'unmade_grip', label: 'Unmade Grip', minTier: 'steadfast', kind: 'damage', description: 'Hits and strips one enemy buff.' },
      { id: 'flame_prayer', label: 'Flame Prayer', minTier: 'devoted', kind: 'damage', description: 'Burns the field — damage every enemy.' },
      { id: 'first_church_word', label: 'First Church Word', minTier: 'true', kind: 'signature', description: 'Until it strikes, the boss cannot act first next round.' },
    ],
    tendencies: { healer: 0, support: 0.2, striker: 1.0, shielding: 0.05, arcade: 0.2 },
  },
  archive_cartographer: {
    id: 'archive_cartographer',
    name: 'Archive Cartographer',
    role: 'arcade',
    faction: 'Archive',
    blurb: 'Maps places that no longer exist. Its probes leave small helpful bruises.',
    profile: {
      hpPct: 0.3,
      atkPct: 0.4,
      matkPct: 0.5,
      defPct: 0.2,
      healPct: 0.05,
      damageType: 'shock',
      reliability: 0.95,
    },
    abilities: [
      { id: 'survey_probe', label: 'Survey Probe', minTier: 'bonded', kind: 'damage', description: 'Probes the enemy, revealing its intent and dealing light damage.' },
      { id: 'annotation', label: 'Annotation', minTier: 'steadfast', kind: 'support', description: 'Marks an enemy; your next hit on it crits.' },
      { id: 'corrosion_graph', label: 'Corrosion Graph', minTier: 'devoted', kind: 'support', description: 'Lowers enemy defense 15% for 2 rounds.' },
      { id: 'the_quiet_route', label: 'The Quiet Route', minTier: 'true', kind: 'signature', description: 'Opens the fight guaranteed to strike a weakness window each round.' },
    ],
    tendencies: { healer: 0.1, support: 0.4, striker: 0.3, shielding: 0.1, arcade: 1.0 },
  },
};

/** Role preference resolver for the combat evaluator. */
export function roleForAlly(def: AllyDef): AllyRole {
  return def.role;
}

/** Faction-styled display name for a loyalty tier. */
export function loyaltyLabel(tier: LoyaltyTier): string {
  return LOYALTY_TIERS.find((t) => t.tier === tier)?.label ?? 'Bonded';
}

/** Highest tier a given loyalty score has reached. */
export function tierForLoyalty(loyalty: number): LoyaltyTier {
  let tier: LoyaltyTier = 'bonded';
  for (const t of LOYALTY_TIERS) {
    if (loyalty >= t.threshold) tier = t.tier;
  }
  return tier;
}

/** Abilities usable at the given loyalty score, ascending order. */
export function abilitiesForLoyalty(def: AllyDef, loyalty: number): AllyAbilityDef[] {
  const tier = tierForLoyalty(loyalty);
  return def.abilities.filter((a) => LOYALTY_TIERS.findIndex((t) => t.tier === a.minTier) <= LOYALTY_TIERS.findIndex((t) => t.tier === tier));
}