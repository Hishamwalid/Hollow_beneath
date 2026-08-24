import Phaser from 'phaser';
import { FONT_SERIF, PALETTE_HEX, SZ } from './uiTheme';

// ============================================================================
// Panel kit — the shared framed-container system ("Expedition Journal").
//
//   parchment → aged-paper sheet, ink text (narration / dialogue / codex)
//   stone     → dark instrument card with gold hairline (board HUD cards)
//   ghost     → translucent veil (cinematic overlays, letterboxing)
//
// Panels are pure presentation: they position content, draw a titled frame,
// and expose a content origin so screens stop hand-placing rectangles.
// ============================================================================

export type PanelVariant = 'parchment' | 'stone' | 'ghost';

export interface PanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Optional heading drawn inside the frame (origin top-left content area). */
  title?: string;
  variant?: PanelVariant;
  depth?: number;
}

export interface PanelHandle {
  container: Phaser.GameObjects.Container;
  variant: PanelVariant;
  width: number;
  height: number;
  /** Top-left of the usable content area (below the title when present). */
  contentX: number;
  contentY: number;
  contentWidth: number;
  setTitle: (t: string) => void;
  destroy: () => void;
}

const PAD = 18;

export function createPanel(scene: Phaser.Scene, opts: PanelOptions): PanelHandle {
  const variant: PanelVariant = opts.variant ?? 'stone';
  const container = scene.add.container(opts.x, opts.y);
  if (opts.depth !== undefined) container.setDepth(opts.depth);

  let titleText: Phaser.GameObjects.Text | null = null;
  let contentY = -opts.height / 2 + PAD;

  if (variant === 'parchment') {
    const bg = scene.add.nineslice(0, 0, 'paper_panel', undefined, opts.width, opts.height, 24, 24, 24, 24);
    // Soft drop shadow so the sheet sits above the dark world.
    const shadow = scene.add.rectangle(6, 8, opts.width, opts.height, 0x000000, 0.45);
    shadow.setOrigin(0.5);
    container.add([shadow, bg]);
    if (opts.title) {
      titleText = scene.add.text(-opts.width / 2 + PAD, -opts.height / 2 + 12, opts.title.toUpperCase(), {
        fontFamily: FONT_SERIF,
        fontSize: SZ.sm,
        color: PALETTE_HEX.oxide,
      }).setLetterSpacing(2);
      const rule = scene.add.rectangle(-opts.width / 2 + PAD, -opts.height / 2 + 40, opts.width - PAD * 2, 1, 0x33291c, 0.35);
      container.add(rule);
      contentY = -opts.height / 2 + 52;
    }
  } else if (variant === 'stone') {
    const bg = scene.add.rectangle(0, 0, opts.width, opts.height, 0x16191d, 0.94).setStrokeStyle(1, 0xc9a24b, 0.55);
    container.add(bg);
    if (opts.title) {
      titleText = scene.add.text(-opts.width / 2 + PAD, -opts.height / 2 + 10, opts.title.toUpperCase(), {
        fontFamily: FONT_SERIF,
        fontSize: '15px',
        color: PALETTE_HEX.gold,
      }).setLetterSpacing(2);
      const rule = scene.add.rectangle(-opts.width / 2 + PAD, -opts.height / 2 + 34, opts.width - PAD * 2, 1, 0xc9a24b, 0.4);
      container.add(rule);
      contentY = -opts.height / 2 + 44;
    }
  } else {
    const veil = scene.add.rectangle(0, 0, opts.width, opts.height, 0x000000, 0.82);
    container.add(veil);
  }

  return {
    container,
    variant,
    width: opts.width,
    height: opts.height,
    contentX: -opts.width / 2 + PAD,
    contentY,
    contentWidth: opts.width - PAD * 2,
    setTitle: (t: string) => {
      titleText?.setText(t.toUpperCase());
    },
    destroy: () => container.destroy(),
  };
}
