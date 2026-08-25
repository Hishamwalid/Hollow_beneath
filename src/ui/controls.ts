// ============================================================================
// THE HOLLOW BENEATH — shared controls kit
//
// The five interactive components every screen was hand-rolling differently:
// tabs, pager, modal frame, toggle, slider. One vocabulary, one focus look,
// all palette-driven. Everything is presentation-only and dies with its
// container; keyboard integration stays with the calling scene.
// ============================================================================
import Phaser from 'phaser';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX, SURFACE_HEX } from './uiTheme';
import { audio } from '@placeholder/PlaceholderAudio';
import { reducedMotion } from '@systems/motion';

/** CSS-string palette value -> numeric for Phaser fill/stroke APIs. */
const num = (css: string): number => parseInt(css.replace('#', ''), 16);

// ---------------------------------------------------------------------------
// Tabs — gold underline tabs (replaces the tinted-button hack).
// ---------------------------------------------------------------------------

export interface TabSpec {
  id: string;
  label: string;
}

export interface TabsHandle {
  container: Phaser.GameObjects.Container;
  select: (id: string) => void;
  destroy: () => void;
}

export function createTabs(
  scene: Phaser.Scene,
  x: number,
  y: number,
  tabs: TabSpec[],
  onSelect: (id: string) => void,
  opts: { width?: number; initial?: string; depth?: number } = {},
): TabsHandle {
  const container = scene.add.container(x, y);
  if (opts.depth !== undefined) container.setDepth(opts.depth);
  const cellW = opts.width ?? 190;
  let selectedId = '';
  const entries: Array<{ bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; underline: Phaser.GameObjects.Rectangle; id: string }> = [];

  tabs.forEach((tab, i) => {
    const cx = (i - (tabs.length - 1) / 2) * cellW;
    const bg = scene.add.rectangle(cx, 0, cellW - 12, 40, SURFACE_HEX.row, 0)
      .setInteractive({ useHandCursor: true });
    const label = scene.add.text(cx, 0, tab.label.toUpperCase(), {
      fontFamily: FONT_SERIF,
      fontSize: '15px',
      color: PALETTE_HEX.boneMuted,
    }).setOrigin(0.5);
    const underline = scene.add.rectangle(cx, 20, cellW - 48, 2, num(PALETTE_HEX.gold), 0);
    container.add([bg, label, underline]);
    entries.push({ bg, label, underline, id: tab.id });
    bg.on('pointerover', () => { if (tab.id !== selectedId) label.setColor(PALETTE_HEX.gold); });
    bg.on('pointerout', () => { if (tab.id !== selectedId) label.setColor(PALETTE_HEX.boneMuted); });
    bg.on('pointerdown', () => {
      audio.click();
      handle.select(tab.id);
      onSelect(tab.id);
    });
  });

  const select = (id: string) => {
    selectedId = id;
    for (const e of entries) {
      const on = e.id === id;
      e.label.setColor(on ? PALETTE_HEX.gold : PALETTE_HEX.boneMuted);
      e.underline.setFillStyle(num(PALETTE_HEX.gold), on ? 0.95 : 0);
      e.bg.setFillStyle(SURFACE_HEX.rowRaised, on ? 0.55 : 0);
    }
  };
  select(opts.initial ?? tabs[0]?.id ?? '');

  const handle: TabsHandle = { container, select, destroy: () => container.destroy() };
  return handle;
}

// ---------------------------------------------------------------------------
// Pager — ‹ Page X / Y › with wraparound disabled by design (archives end).
// ---------------------------------------------------------------------------

export interface PagerHandle {
  container: Phaser.GameObjects.Container;
  /** Redraws the label + enables buttons per bounds. */
  update: (page: number, pageCount: number) => void;
  destroy: () => void;
}

export function createPager(
  scene: Phaser.Scene,
  x: number,
  y: number,
  onChange: (page: number) => void,
  opts: { depth?: number } = {},
): PagerHandle {
  const container = scene.add.container(x, y);
  if (opts.depth !== undefined) container.setDepth(opts.depth);
  let page = 0;

  const mkBtn = (cx: number, glyph: string, dir: -1 | 1): { obj: Phaser.GameObjects.Text; setEnabled: (v: boolean) => void } => {
    const t = scene.add.text(cx, 0, glyph, {
      fontFamily: FONT_MONO, fontSize: '18px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    t.on('pointerdown', () => {
      if (!t.input) return;
      audio.click();
      page += dir;
      onChange(page);
      refresh();
    });
    container.add(t);
    return {
      obj: t,
      setEnabled: (v: boolean) => {
        t.setAlpha(v ? 1 : 0.25);
        if (v && !t.input) t.setInteractive({ useHandCursor: true });
        if (!v && t.input) t.disableInteractive();
      },
    };
  };
  const prevBtn = mkBtn(-64, '‹', -1);
  const nextBtn = mkBtn(64, '›', 1);
  const label = scene.add.text(0, 1, '', {
    fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.boneMuted,
  }).setOrigin(0.5);
  container.add(label);

  const refresh = () => {
    prevBtn.setEnabled(page > 0);
    nextBtn.setEnabled(true);
  };

  return {
    container,
    update: (p, pageCount) => {
      page = Phaser.Math.Clamp(p, 0, Math.max(0, pageCount - 1));
      label.setText(`Page ${page + 1} / ${Math.max(1, pageCount)}`);
      nextBtn.obj.setVisible(page < pageCount - 1);
      prevBtn.setEnabled(page > 0);
      nextBtn.setEnabled(page < pageCount - 1);
    },
    destroy: () => container.destroy(),
  };
}

// ---------------------------------------------------------------------------
// Modal — parchment scroll frame over a veil. Returns a content origin.
// ---------------------------------------------------------------------------

export interface ModalHandle {
  container: Phaser.GameObjects.Container;
  contentX: number;
  contentY: number;
  contentWidth: number;
  close: () => void;
  /** True once dismissed — callers can guard double-close. */
  get closed(): boolean;
  destroy: () => void;
}

export function createModal(
  scene: Phaser.Scene,
  title: string,
  width: number,
  height: number,
  opts: { onClose?: () => void; variant?: 'parchment' | 'stone'; depth?: number } = {},
): ModalHandle {
  const variant = opts.variant ?? 'stone';
  const depth = opts.depth ?? 50;
  const cx = scene.scale.width / 2;
  const cy = scene.scale.height / 2;
  let closed = false;

  const container = scene.add.container(0, 0).setDepth(depth);
  const veil = scene.add.rectangle(cx, cy, scene.scale.width + 8, scene.scale.height + 8, 0x000000, 0.72).setInteractive();
  container.add(veil);

  const frame = scene.add.container(cx, cy);
  container.add(frame);

  if (variant === 'parchment' && scene.textures.exists('paper_panel')) {
    const shadow = scene.add.rectangle(6, 8, width, height, 0x000000, 0.45);
    const sheet = scene.add.nineslice(0, 0, 'paper_panel', undefined, width, height, 24, 24, 24, 24);
    frame.add([shadow, sheet]);
  } else {
    const panel = scene.add.rectangle(0, 0, width, height, SURFACE_HEX.panel, 0.97)
      .setStrokeStyle(2, num(PALETTE_HEX.gold), 0.85);
    frame.add(panel);
  }

  const titleText = scene.add.text(-width / 2 + 24, variant === 'parchment' ? -height / 2 + 22 : -height / 2 + 24, title.toUpperCase(), {
    fontFamily: FONT_SERIF,
    fontSize: '17px',
    color: variant === 'parchment' ? PALETTE_HEX.oxide : PALETTE_HEX.gold,
  }).setOrigin(0, 0.5);
  const rule = scene.add.rectangle(0, -height / 2 + 46, width - 48, 1,
    variant === 'parchment' ? 0x33291c : num(PALETTE_HEX.gold), variant === 'parchment' ? 0.35 : 0.4);
  frame.add([titleText, rule]);

  // Entrance: rise + fade, like every other overlay in the game.
  if (!reducedMotion()) {
    container.setAlpha(0);
    scene.tweens.add({ targets: container, alpha: 1, duration: 200, ease: 'Sine.easeOut' });
    frame.y = cy - 14;
    scene.tweens.add({ targets: frame, y: cy, duration: 220, ease: 'Sine.easeOut' });
  }

  const close = () => {
    if (closed) return;
    closed = true;
    opts.onClose?.();
    scene.tweens.add({
      targets: container, alpha: 0, duration: 150, ease: 'Sine.easeIn',
      onComplete: () => container.destroy(),
    });
  };
  veil.on('pointerdown', close);

  return {
    container,
    contentX: cx - width / 2 + 24,
    contentY: cy - height / 2 + 62,
    contentWidth: width - 48,
    close,
    get closed() { return closed; },
    destroy: () => container.destroy(),
  };
}

// ---------------------------------------------------------------------------
// Toggle — wax-seal stamp that presses in when active.
// ---------------------------------------------------------------------------

export interface ToggleHandle {
  container: Phaser.GameObjects.Container;
  set: (on: boolean) => void;
  destroy: () => void;
}

export function createToggle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  initial: boolean,
  onChange: (on: boolean) => void,
  opts: { width?: number; depth?: number } = {},
): ToggleHandle {
  const w = opts.width ?? 210;
  const container = scene.add.container(x, y);
  if (opts.depth !== undefined) container.setDepth(opts.depth);

  const bg = scene.add.rectangle(0, 0, w, 38, SURFACE_HEX.row).setStrokeStyle(1, SURFACE_HEX.hairline)
    .setInteractive({ useHandCursor: true });
  const labelText = scene.add.text(-w / 2 + 14, 0, label, {
    fontFamily: FONT_BODY, fontSize: '15px', color: PALETTE_HEX.bone,
  }).setOrigin(0, 0.5);
  const sealBg = scene.add.circle(w / 2 - 28, 0, 13, num(PALETTE_HEX.waxRed), 0.25).setStrokeStyle(1.5, num(PALETTE_HEX.waxRed), 0.6);
  const sealText = scene.add.text(w / 2 - 28, 0, '✕', {
    fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted,
  }).setOrigin(0.5);
  container.add([bg, labelText, sealBg, sealText]);

  let on = !!initial;
  const paint = () => {
    if (on) {
      sealBg.setFillStyle(num(PALETTE_HEX.ok), 0.3);
      sealBg.setStrokeStyle(1.5, num(PALETTE_HEX.ok), 0.9);
      sealText.setText('✓').setColor('#a8d8a8');
    } else {
      sealBg.setFillStyle(num(PALETTE_HEX.waxRed), 0.25);
      sealBg.setStrokeStyle(1.5, num(PALETTE_HEX.waxRed), 0.6);
      sealText.setText('✕').setColor(PALETTE_HEX.boneMuted);
    }
  };
  paint();

  const flip = () => {
    on = !on;
    paint();
    audio.click();
    onChange(on);
  };
  bg.on('pointerdown', flip);
  labelText.setInteractive({ useHandCursor: true }).on('pointerdown', flip);

  return { container, set: (v: boolean) => { on = v; paint(); }, destroy: () => container.destroy() };
}

// ---------------------------------------------------------------------------
// Slider — etched track, gold fill, draggable thumb. Live onChange.
// ---------------------------------------------------------------------------

export interface SliderHandle {
  container: Phaser.GameObjects.Container;
  value: number;
  set: (v: number) => void;
  destroy: () => void;
}

export function createSlider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  initial: number,
  onChange: (v: number) => void,
  opts: { depth?: number } = {},
): SliderHandle {
  const container = scene.add.container(x, y);
  if (opts.depth !== undefined) container.setDepth(opts.depth);
  const trackY = 0;
  const halfW = width / 2;

  const track = scene.add.rectangle(0, trackY, width, 10, SURFACE_HEX.rowHoverAlt)
    .setStrokeStyle(1, num(PALETTE_HEX.gold), 0.4);
  const fillW = width - 10;
  const fill = scene.add.rectangle(-halfW + 5, trackY, fillW * Phaser.Math.Clamp(initial / 100, 0, 1), 10, num(PALETTE_HEX.gold), 0.6).setOrigin(0, 0.5);
  const thumb = scene.add.circle(-halfW + 5 + fill.width, trackY, 8, 0xe9c876)
    .setStrokeStyle(1.5, num(PALETTE_HEX.boneMuted))
    .setInteractive({ useHandCursor: true, draggable: false });
  const hit = scene.add.rectangle(0, trackY, width, 34, 0x000000, 0.001).setInteractive({ useHandCursor: true });
  container.add([track, fill, thumb, hit]);

  let value = Phaser.Math.Clamp(initial, 0, 100);
  const paint = () => {
    fill.width = Math.max(0.001, fillW * value / 100);
    thumb.x = -halfW + 5 + fill.width;
  };
  paint();

  const applyFromPointer = (px: number) => {
    const localX = px - container.x + halfW;
    value = Phaser.Math.Clamp((localX / width) * 100, 0, 100);
    paint();
    onChange(value);
  };

  hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
    applyFromPointer(p.x);
    hit.scene?.input.setDraggable(hit);
  });
  hit.on('drag', (_p: unknown, dragX: number) => applyFromPointer(dragX));
  thumb.on('pointerdown', (p: Phaser.Input.Pointer) => {
    applyFromPointer(p.x);
    scene.input.setDraggable(thumb);
  });
  thumb.on('drag', (_p: unknown, dragX: number) => applyFromPointer(dragX));

  return {
    container,
    get value() { return value; },
    set: (v: number) => { value = Phaser.Math.Clamp(v, 0, 100); paint(); },
    destroy: () => container.destroy(),
  };
}
