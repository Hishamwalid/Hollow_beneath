// ============================================================================
// THE HOLLOW BENEATH — Status-effect chip row
// Tinted chips with turn/stack pips replacing bare 9px text abbreviations.
// One builder, used by both the enemy displays and the player readout.
// ============================================================================

import Phaser from 'phaser';
import { FONT_MONO } from './uiTheme';

export interface StatusChipMeta {
  label: string;
  color: number;
}

export const STATUS_META: Record<string, StatusChipMeta> = {
  // DoTs
  poison: { label: 'PSN', color: 0x6ab04c },
  burn: { label: 'BRN', color: 0xe67e22 },
  bleed: { label: 'BLD', color: 0xc0392b },
  curse: { label: 'CRS', color: 0x8e44ad },
  frostbite: { label: 'FRB', color: 0x5dade2 },
  shock_dot: { label: 'SHK', color: 0xaf7ac5 },
  // Markers
  chilled: { label: 'CHLD', color: 0x85c1e9 },
  sacred_mark: { label: 'MRK', color: 0xf5efdc },
  // Controls / debuffs
  sleep: { label: 'SLP', color: 0xbdc3c7 },
  fear: { label: 'FEAR', color: 0x9b59b6 },
  silence: { label: 'SLNT', color: 0x95a5a6 },
  blind: { label: 'BLND', color: 0xd5dbdb },
  confuse: { label: 'CNF', color: 0xaf7ac5 },
  stun: { label: 'STN', color: 0xf4d03f },
  root: { label: 'ROOT', color: 0x27ae60 },
  slowed: { label: 'SLOW', color: 0x7fb3d5 },
  vulnerable: { label: 'VULN', color: 0xe59866 },
  cursed: { label: 'CRSD', color: 0x8e44ad },
  pacified: { label: 'PAC', color: 0xbdc3c7 },
  exhausted: { label: 'EXH', color: 0xb07d62 },
  heal_block: { label: 'NO HL', color: 0xcd6155 },
  armour_break: { label: 'ARM BRK', color: 0xd35400 },
  staggered: { label: 'STGR', color: 0xec7063 },
  downed: { label: 'DOWN', color: 0xc9a24b },
  reflection: { label: 'CNTR', color: 0x76d7c4 },
  seal_mind: { label: 'SEAL', color: 0xbb8fce },
  // Buffs
  atk_up: { label: 'ATK+', color: 0x58d68d },
  def_up: { label: 'DEF+', color: 0x58d68d },
  spd_up: { label: 'SPD+', color: 0x58d68d },
  regeneration: { label: 'REGEN', color: 0x2ecc71 },
  focus: { label: 'FOCUS', color: 0xf7dc6f },
  fortify: { label: 'FORT', color: 0xf7dc6f },
  blessing: { label: 'BLESS', color: 0xf7dc6f },
  haste: { label: 'HASTE', color: 0xf7dc6f },
  veil_step: { label: 'VEIL', color: 0x5499c7 },
  momentum_gain: { label: 'MOM', color: 0xa569bd },
  atk_down: { label: 'ATK−', color: 0xcb4335 },
  def_down: { label: 'DEF−', color: 0xcb4335 },
  spd_down: { label: 'SPD−', color: 0xcb4335 },
  brace: { label: 'BRACE', color: 0x85929e },
};

export interface StatusChipInput {
  id: string;
  turnsRemaining?: number;
  stacks?: number;
}

function css(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/**
 * Rebuilds the chip row inside `container` (clearing it first).
 * Long-lived internal shields (barrier @ 99 turns) are hidden — they already
 * have their own visual. DOWNED keeps its dedicated pill on enemies.
 */
export function rebuildStatusChips(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  statuses: StatusChipInput[],
  opts: { leftAligned?: boolean; maxPerRow?: number; scale?: number; hideIds?: string[] } = {},
): void {
  container.removeAll(true);
  const scale = opts.scale ?? 1;
  const perRow = opts.maxPerRow ?? 4;
  const chipW = 36 * scale;
  const chipH = 13 * scale;
  const gapX = 4 * scale;
  const gapY = 3 * scale;

  const hide = new Set(opts.hideIds ?? ['barrier', 'downed']);
  const visible = statuses.filter((s) => !hide.has(s.id));
  if (visible.length === 0) {
    container.setVisible(false);
    return;
  }
  container.setVisible(true);

  visible.forEach((s, i) => {
    const meta = STATUS_META[s.id] ?? { label: s.id.slice(0, 4).toUpperCase(), color: 0xff8a75 };
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const rowCount = Math.min(perRow, visible.length - row * perRow);
    let x: number;
    if (opts.leftAligned) {
      x = (chipW + gapX) * col + chipW / 2;
    } else {
      const rowW = rowCount * chipW + (rowCount - 1) * gapX;
      x = -rowW / 2 + chipW / 2 + col * (chipW + gapX);
    }
    const y = row * (chipH + gapY);

    const bg = scene.add
      .rectangle(x, y, chipW, chipH, 0x0b0d10, 0.82)
      .setStrokeStyle(1, meta.color, 0.9)
      .setOrigin(0.5);
    const turns = s.turnsRemaining ?? 0;
    const stacks = s.stacks ?? 1;
    // Show countdown for real timers; show stack count otherwise.
    const suffix = turns > 1 && turns < 90 ? String(turns) : stacks > 1 ? String(stacks) : '';
    const txt = scene.add
      .text(x, y - scale, `${meta.label}${suffix}`, {
        fontFamily: FONT_MONO,
        fontSize: `${Math.max(7, Math.round(8 * scale))}px`,
        color: css(meta.color),
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    container.add([bg, txt]);
  });
}
