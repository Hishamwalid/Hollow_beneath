import Phaser from 'phaser';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX } from './uiTheme';
import { audio } from '@placeholder/PlaceholderAudio';
import { settingsManager } from '@systems/SettingsManager';
import { GAME_HEIGHT } from '@/config';

export interface ChoiceMenuItem {
  label: string;
  subtitle?: string;
  /** Optional right-aligned secondary text (e.g. element abbrev + MP cost). */  /** Optional right-aligned secondary text (e.g. element abbrev + MP cost). */
  rightLabel?: string;
  /** Optional element icon texture shown in a chip left of the rightLabel. */
  elementIcon?: string;
  /** Tint applied to the element icon (usually the damage-type color). */
  elementTint?: number;
  /** Requirement chip rendered under the label (e.g. "WILL DC 12", "-30 gold"). */
  chip?: string;
  disabled?: boolean;
  /** Shown instead of a numeral for locked rows. */
  locked?: boolean;
  onSelect: () => void;
}

export interface ChoiceMenu {
  container: Phaser.GameObjects.Container;
  /** Keyboard focus: highlight a row like hover (null clears). */
  setFocused: (index: number | null) => void;
  /** Activates a focused row's action (no-op while disabled). */
  activate: (index: number) => void;
  /** Number of rows. */
  length: number;
  destroy: () => void;
}

const ROW_HEIGHT = 56;

interface RowRefs {
  root: Phaser.GameObjects.Container;
  card: Phaser.GameObjects.NineSlice;
  hit: Phaser.GameObjects.Rectangle;
}

/**
 * Journal-style choice cards: parchment rows with an index numeral, ink label,
 * requirement chip, and a lock stamp on disabled rows. Lays out a vertical
 * stack starting at (x, y), adaptively compressing so nothing renders past
 * `bottomBound` (same adaptive math as before).
 */
export function createChoiceMenu(
  scene: Phaser.Scene,
  x: number,
  y: number,
  items: ChoiceMenuItem[],
  opts: { width?: number; spacing?: number; bottomBound?: number; /** Cap on upward shift so rows never slide far under content above. */ maxShift?: number } = {},
): ChoiceMenu {
  const width = opts.width ?? 620;
  const desiredSpacing = opts.spacing ?? ROW_HEIGHT + 12;
  const bottomBound = opts.bottomBound ?? GAME_HEIGHT - 20;
  const halfRow = ROW_HEIGHT / 2;
  const n = Math.max(1, items.length);

  const maxSpacingThatFits = n > 1 ? (bottomBound - halfRow - y) / (n - 1) : desiredSpacing;
  const spacing = n > 1 ? Math.max(ROW_HEIGHT + 4, Math.min(desiredSpacing, maxSpacingThatFits)) : desiredSpacing;

  const blockBottom = y + (n - 1) * spacing + halfRow;
  const shiftUp = Math.min(opts.maxShift ?? Infinity, Math.max(0, blockBottom - bottomBound));
  const startY = y - shiftUp;

  const container = scene.add.container(x, startY).setDepth(40);
  const rows: RowRefs[] = [];
  let focused = -1;

  const setRowVisual = (i: number, active: boolean) => {
    const row = rows[i];
    if (!row) return;
    const item = items[i];
    if (item.disabled) {
      row.card.setTint(0x9a9184);
      row.card.setAlpha(0.55);
      row.root.setScale(1);
    } else {
      row.card.clearTint();
      row.card.setAlpha(1);
      row.root.setScale(active ? 1.02 : 1);
      // Hover nudge: the chosen card leans forward out of the stack.
      try {
        if (!settingsManager.get().reduceMotion) {
          scene.tweens.add({ targets: row.root, x: active ? 8 : 0, duration: 120, ease: 'Sine.easeOut' });
        } else {
          row.root.x = active ? 8 : 0;
        }
      } catch {
        row.root.x = active ? 8 : 0;
      }
    }
  };

  items.forEach((item, i) => {
    const cy = i * spacing;

    const shadow = scene.add.rectangle(4, cy + 5, width, ROW_HEIGHT, 0x000000, 0.35);
    const card = scene.add.nineslice(0, cy, 'paper_panel', undefined, width, ROW_HEIGHT, 24, 24, 24, 24);

    const badgeText = item.disabled || item.locked ? '✖' : String(i + 1);
    const badge = scene.add.text(-width / 2 + 26, cy - 1, badgeText, {
      fontFamily: FONT_SERIF,
      fontSize: '20px',
      color: item.disabled ? PALETTE_HEX.oxblood : PALETTE_HEX.oxide,
    }).setOrigin(0.5);

    const hasChip = !!item.chip;
    const label = scene.add.text(-width / 2 + 48, cy - (hasChip || item.subtitle ? 9 : 0), item.label, {
      fontFamily: FONT_SERIF,
      fontSize: '17px',
      color: item.disabled ? PALETTE_HEX.inkSoft : PALETTE_HEX.ink,
      wordWrap: { width: width - (item.rightLabel ? 200 : 120) },
      align: 'left',
    }).setOrigin(0, 0.5);

    const root = scene.add.container(0, 0);
    root.add([shadow, card, badge, label]);

    if (item.subtitle) {
      const sub = scene.add.text(-width / 2 + 48, cy + 14, item.subtitle, {
        fontFamily: FONT_BODY,
        fontSize: '13px',
        color: PALETTE_HEX.inkSoft,
        fontStyle: 'italic',
      }).setOrigin(0, 0.5);
      root.add(sub);
    }

    if (item.chip) {
      const chip = scene.add.text(width / 2 - 18, cy + 13, item.chip.toUpperCase(), {
        fontFamily: FONT_MONO,
        fontSize: '11px',
        color: PALETTE_HEX.oxblood,
        backgroundColor: '#d9cdb0',
        padding: { x: 6, y: 2 },
      }).setOrigin(1, 0.5);
      if (typeof chip.setLetterSpacing === 'function') chip.setLetterSpacing(1);
      root.add(chip);
    }

    if (item.rightLabel) {
      const right = scene.add.text(width / 2 - 18, cy - (hasChip ? 10 : 0), item.rightLabel, {
        fontFamily: FONT_MONO,
        fontSize: '13px',
        color: PALETTE_HEX.inkSoft,
      }).setOrigin(1, 0.5);
      root.add(right);
    }

    const hit = scene.add.rectangle(0, cy, width, ROW_HEIGHT, 0xffffff, 0.001);
    hit.setInteractive({ useHandCursor: !item.disabled });
    hit.on('pointerover', () => { if (!items[i].disabled) setRowVisual(i, true); });
    hit.on('pointerout', () => setRowVisual(i, false));
    hit.on('pointerdown', () => {
      if (items[i].disabled) return;
      audio.click();
      items[i].onSelect();
    });
    root.add(hit);

    container.add(root);
    root.setAlpha(0);
    scene.tweens.add({ targets: root, alpha: 1, duration: 220, delay: i * 55, ease: 'Sine.easeOut' });
    setRowVisual(i, false);

    rows.push({ root, card, hit });
  });

  return {
    container,
    setFocused: (index) => {
      if (focused >= 0) setRowVisual(focused, false);
      focused = index ?? -1;
      if (index === null || !items[index] || items[index].disabled) { focused = -1; return; }
      setRowVisual(index, true);
    },
    activate: (index) => {
      const it = items[index];
      if (it && !it.disabled) it.onSelect();
    },
    length: items.length,
    destroy: () => container.destroy(),
  };
}
