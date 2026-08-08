/**
 * PART 5 — ALLY BOSS ASSIST (Phase 5).
 * Boss-fight bindings for companions: threshold guards (Last Oath), death
 * wards (Bitter Revival), intent reveal (The Whole Letter), and first-strike
 * denial (First Church Word). Pure functions — the engine decides when to call.
 */
import { abilitiesForLoyalty, type AllyDef } from './AllyDefs';
import type { AllySaveState } from './AllyTracking';

export interface BossAssistInput {
  playerHp: number;
  playerMaxHp: number;
  bossPhaseKey: string | null;
  playerFallen: boolean; // currentHP <= 0 awaiting death-ward
  playerHasDebuff: boolean;
  round: number;
  foughtTogether: number;
}

export interface BossAssist {
  /** True when the warden's Last Oath / Unbroken Vigil is armed and actionable. */
  guardCanIntervene: boolean;
  /** True when the courier can pull the player back from a death blow. */
  reviveAvailable: boolean;
  /** Heal amount the courier's Bitter Revival would restore if used now. */
  reviveHealAmount: number;
  /** True when The Whole Letter is available (reveals all intents). */
  canRevealField: boolean;
  /** True when the zealot's First Church Word is ready (enemy cannot act first). */
  denyFirstStrike: boolean;
  /** Percentage of the incoming lethal hit the Warden's vigil negates. */
  vigilNegationPct: number;
  /** Log lines describing whatever assists armed. */
  lines: string[];
}

/**
 * Evaluate boss-fight assists for the given ally state. Deterministic; the
 * engine calls it at precise moments (player fallen, round start, phase change).
 */
export function bossAssist(def: AllyDef, state: AllySaveState, input: BossAssistInput): BossAssist {
  const abilities = abilitiesForLoyalty(def, state.loyalty);
  const res: BossAssist = {
    guardCanIntervene: false,
    reviveAvailable: false,
    reviveHealAmount: 0,
    canRevealField: false,
    denyFirstStrike: false,
    vigilNegationPct: 0,
    lines: [],
  };

  // Warden: Last Oath / Unbroken Vigil threshold guard.
  const oath = abilities.find((a) => a.id === 'last_oath');
  if (oath && input.playerMaxHp > 0 && input.playerHp / input.playerMaxHp < 0.25) {
    res.guardCanIntervene = true;
    res.vigilNegationPct = 50;
    res.lines.push(`${def.name}: Last Oath — an oath-echo stands between you and the blow (50% negated).`);
  }
  const vigil = abilities.find((a) => a.id === 'unbroken_vigil');
  if (vigil) {
    res.guardCanIntervene = true;
    res.vigilNegationPct = 100;
    res.lines.push(`${def.name}: Unbroken Vigil — the hit that would end you is refused (nullified).`);
  }

  // Courier: Bitter Revival.
  const revival = abilities.find((a) => a.id === 'bitter_revival');
  if (revival && input.playerFallen) {
    res.reviveAvailable = true;
    res.reviveHealAmount = Math.round(input.playerMaxHp * 0.2);
    res.lines.push(`${def.name}: Bitter Revival — your fall is not the end of the letter.`);
  }

  // Courier: The Whole Letter.
  const letter = abilities.find((a) => a.id === 'the_whole_letter');
  if (letter) {
    res.canRevealField = true;
    res.lines.push(`${def.name}: The Whole Letter — the field lays open before you both.`);
  }

  // Zealot: First Church Word — enemy cannot act first once it has seen you fight twice.
  const word = abilities.find((a) => a.id === 'first_church_word');
  if (word && input.foughtTogether >= 2) {
    res.denyFirstStrike = true;
    res.lines.push(`${def.name}: First Church Word — the boss may not begin moving.`);
  }

  return res;
}

/** Defensive modifier the ally contributes on a boss round (fraction of incoming damage). */
export function allyDamageTaken(def: AllyDef): number {
  return def.id === 'warden_emissary' ? 0.7 : 0.85;
}

/** Flavor when the ally leaves a fight having been decisive. */
export function assistAncestry(def: AllyDef, phaseKey: string): string {
  const phase = phaseKey ?? 'opening';
  return `${def.name} carried ${phase} like a theory it no longer needed to prove.`;
}