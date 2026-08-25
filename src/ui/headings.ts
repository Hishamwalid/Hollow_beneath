import Phaser from 'phaser';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX, SZ } from './uiTheme';

// ============================================================================
// Typography kit — the single source of truth for how text looks.
//   Title  → Cinzel caps, letter-spaced, gold
//   Sub    → IM Fell italic, muted
//   Label  → Courier small caps-ish readout
//   StatLine → label + right-aligned value pair
// Every scene should build headings through these helpers so the journal
// reads consistently everywhere.
// ============================================================================

export interface TextOpts {
  color?: string;
  size?: string;
  origin?: [number, number];
  wordWrapWidth?: number;
}

/** Screen / panel title — Cinzel caps with tracking. */
export function createTitle(scene: Phaser.Scene, x: number, y: number, text: string, opts: TextOpts = {}): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text.toUpperCase(), {
    fontFamily: FONT_SERIF,
    fontSize: opts.size ?? SZ.xl,
    color: opts.color ?? PALETTE_HEX.gold,
  }).setOrigin(opts.origin?.[0] ?? 0.5, opts.origin?.[1] ?? 0.5);
  if (typeof t.setLetterSpacing === 'function') t.setLetterSpacing(3);
  return t;
}

/** Italic sub-line under a title (IM Fell). */
export function createSubtitle(scene: Phaser.Scene, x: number, y: number, text: string, opts: TextOpts = {}): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: FONT_BODY,
    fontSize: opts.size ?? SZ.md,
    color: opts.color ?? PALETTE_HEX.boneMuted,
    fontStyle: 'italic',
    wordWrap: { width: opts.wordWrapWidth ?? 720 },
    align: 'center',
  }).setOrigin(opts.origin?.[0] ?? 0.5, opts.origin?.[1] ?? 0.5);
}

/** Small tracked data-label (Courier) for panel headers/readouts. */
export function createSectionLabel(scene: Phaser.Scene, x: number, y: number, text: string, opts: TextOpts = {}): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text.toUpperCase(), {
    fontFamily: FONT_MONO,
    fontSize: opts.size ?? SZ.xs,
    color: opts.color ?? PALETTE_HEX.gold,
  }).setOrigin(opts.origin?.[0] ?? 0, opts.origin?.[1] ?? 0.5);
  if (typeof t.setLetterSpacing === 'function') t.setLetterSpacing(2);
  return t;
}

/** Ornamental divider — hairline with a center diamond. Returns height used. */
export function createDivider(scene: Phaser.Scene, container: Phaser.GameObjects.Container, cx: number, y: number, width: number, color = parseInt(PALETTE_HEX.gold.replace('#', ''), 16)): number {
  const line = scene.add.rectangle(cx, y, width, 1, color, 0.45);
  const gem = scene.add.rectangle(cx, y, 6, 6, color).setAngle(45);
  container.add([line, gem]);
  return 12;
}
