/**
 * Phase 5: the Tell system. Charged ultimates are declared one full boss turn
 * before they land, so the player has a round to Guard, Interdict, or prepare.
 */
export function chargeLabel(label: string): string {
  return `⚡ CHARGING ${label}`;
}

export function isChargingLabel(text: string): boolean {
  return text.startsWith('⚡ CHARGING');
}

export function chargeBanner(bossName: string, label: string): string {
  return `CHARGE — ${bossName} gathers ${label}`;
}

export function unleashBanner(bossName: string, label: string): string {
  return `ULTIMATE — ${bossName} unleashes ${label}`;
}

export function chargeLog(bossName: string, label: string): string {
  return `${bossName} draws itself up, gathering "${label}". It will strike next round — brace yourself.`;
}

export function unleashLog(bossName: string, label: string): string {
  return `${bossName} unleashes "${label}"!`;
}

export function adaptationBanner(label: string): string {
  return `ADAPTATION — ${label}`;
}
