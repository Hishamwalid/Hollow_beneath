/**
 * d20 + (stat * 2) vs (DC + 10). Tuned so a 6-stat "balanced" build clears DC10 checks
 * ~65% of the time and DC16 checks ~35% of the time; a 9-10 stat investment clears
 * DC16 checks ~85% of the time. Used for every WILL/INT/STR/DEX "check DC n" in the GDD.
 */
export function statCheck(statValue: number, dc: number, rng: () => number): boolean {
  const roll = Math.floor(rng() * 20) + 1;
  return roll + statValue * 2 >= dc + 10;
}

/** 1d4+1 movement die (GDD 3.1). */
export function rollMovement(rng: () => number): number {
  return Math.floor(rng() * 4) + 1 + 1;
}

/** Generic 1dN helper, e.g. 1d3 backward movement, 1d4 resonance loss. */
export function rollDie(sides: number, rng: () => number): number {
  return Math.floor(rng() * sides) + 1;
}
