import Phaser from 'phaser';
import { FONT_SERIF, PALETTE_HEX } from './uiTheme';
import { audio } from '@placeholder/PlaceholderAudio';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: string;
  disabled?: boolean;
  subtitle?: string;
  textureKey?: string;
  textureHoverKey?: string;
  depth?: number;
  /** Visual weight: primary (default) = stone+gold, secondary = quiet stone, ghost = hairline. */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Optional icon texture drawn at the left edge. */
  iconKey?: string;
}

export interface Button {
  container: Phaser.GameObjects.Container;
  setEnabled: (enabled: boolean) => void;
  /** Current interactable state (keyboard guards use it). */
  isEnabled: () => boolean;
  /** Keyboard focus highlight (mirrors the hover state). */
  setFocused: (focused: boolean) => void;
  destroy: () => void;
}

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Button {
  const variant = opts.variant ?? 'primary';
  const width = opts.width ?? 260;
  const height = opts.height ?? 52;

  let bg: Phaser.GameObjects.GameObject & { setTexture?: (k: string) => void };
  let hoverBg: Phaser.GameObjects.Rectangle | null = null;
  if (variant === 'ghost') {
    const rect = scene.add.rectangle(0, 0, width, height).setStrokeStyle(1, 0xc9a24b, 0.45);
    bg = rect;
  } else {
    const texKey = opts.textureKey ?? (variant === 'secondary' ? 'panel_btn_secondary' : 'panel_button');
    const texHoverKey = opts.textureHoverKey ?? (variant === 'secondary' ? 'panel_btn_secondary_hover' : 'panel_button_hover');
    const img = scene.add.image(0, 0, texKey).setDisplaySize(width, height);
    (img as unknown as Record<string, unknown>).texKey = texKey;
    (img as unknown as Record<string, unknown>).texHoverKey = texHoverKey;
    bg = img;
    // Hidden hover veil for a soft gold wash on top of the texture.
    hoverBg = scene.add.rectangle(0, 0, width - 6, height - 6, 0xe9c876, 0);
  }

  const items: Phaser.GameObjects.GameObject[] = [];
  if (variant !== 'ghost') items.push(bg as Phaser.GameObjects.GameObject);
  if (hoverBg) items.push(hoverBg);

  let icon: Phaser.GameObjects.Image | null = null;
  if (opts.iconKey && scene.textures.exists(opts.iconKey)) {
    icon = scene.add.image(-width / 2 + 30, 0, opts.iconKey).setDisplaySize(28, 28).setAlpha(0.9);
    items.push(icon);
  }

  const textX = icon ? 14 : 0;
  const text = scene.add
    .text(textX, opts.subtitle ? -8 : 0, label, {
      fontFamily: FONT_SERIF,
      fontSize: opts.fontSize ?? '20px',
      color: PALETTE_HEX.bone,
      align: 'center',
      wordWrap: { width: width - (icon ? 70 : 20) },
    })
    .setOrigin(0.5);
  items.push(text);
  if (opts.subtitle) {
    const sub = scene.add
      .text(textX, 15, opts.subtitle, { fontFamily: FONT_SERIF, fontSize: '14px', color: PALETTE_HEX.boneMuted })
      .setOrigin(0.5);
    items.push(sub);
  }
  if (variant === 'ghost') items.unshift(bg as Phaser.GameObjects.GameObject);

  const container = scene.add.container(x, y, items);
  container.setSize(width, height);
  if (opts.depth !== undefined) container.setDepth(opts.depth);

  let enabled = !opts.disabled;
  let hovered = false;
  const applyVisuals = () => {
    if (variant === 'ghost') {
      const rect = bg as Phaser.GameObjects.Rectangle;
      rect.setStrokeStyle(1, 0xc9a24b, enabled ? (hovered ? 0.95 : 0.45) : 0.2);
      rect.setFillStyle(0xc9a24b, enabled && hovered ? 0.08 : 0);
      text.setAlpha(enabled ? 1 : 0.4);
      return;
    }
    const img = bg as Phaser.GameObjects.Image;
    img.setAlpha(enabled ? 1 : 0.4);
    text.setAlpha(enabled ? 1 : 0.5);
    if (hovered && enabled) img.setTexture(String((img as unknown as Record<string, unknown>).texHoverKey));
    else img.setTexture(String((img as unknown as Record<string, unknown>).texKey));
    if (hoverBg) hoverBg.setFillStyle(0xe9c876, hovered && enabled ? 0.07 : 0);
  };
  applyVisuals();

  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => {
    if (!enabled) return;
    hovered = true;
    applyVisuals();
    scene.tweens.add({ targets: container, y: y - 2, duration: 90, ease: 'Sine.easeOut' });
    if (hoverBg) scene.tweens.add({ targets: hoverBg, fillAlpha: 0.16, duration: 140, ease: 'Sine.easeOut' });
  });
  bg.on('pointerout', () => {
    hovered = false;
    applyVisuals();
    scene.tweens.add({ targets: container, y, duration: 90, ease: 'Sine.easeOut' });
    if (hoverBg) scene.tweens.add({ targets: hoverBg, fillAlpha: 0, duration: 160, ease: 'Sine.easeOut' });
  });
  bg.on('pointerdown', () => {
    if (!enabled) return;
    audio.click();
    scene.tweens.killTweensOf(container);
    container.setScale(1);
    scene.tweens.add({ targets: container, scale: 0.96, duration: 70, yoyo: true, ease: 'Sine.easeOut' });
    onClick();
  });

  if (opts.disabled) {
    bg.disableInteractive();
  }

  return {
    container,
    isEnabled: () => enabled,
    setEnabled: (v: boolean) => {
      enabled = v;
      scene.tweens.killTweensOf(container);
      container.setScale(1);
      if (v) bg.setInteractive({ useHandCursor: true });
      else bg.disableInteractive();
      applyVisuals();
    },
    setFocused: (focused: boolean) => {
      if (!enabled) return;
      hovered = focused;
      applyVisuals();
    },
    destroy: () => container.destroy(),
  };
}
