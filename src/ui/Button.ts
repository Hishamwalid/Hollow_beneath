import Phaser from 'phaser';
import { FONT_SERIF, PALETTE_HEX } from './uiTheme';
import { audio } from '@placeholder/PlaceholderAudio';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: string;
  disabled?: boolean;
  subtitle?: string;
}

export interface Button {
  container: Phaser.GameObjects.Container;
  setEnabled: (enabled: boolean) => void;
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
  const width = opts.width ?? 260;
  const height = opts.height ?? 52;
  const bg = scene.add.image(0, 0, 'panel_button').setDisplaySize(width, height);
  const text = scene.add
    .text(0, opts.subtitle ? -8 : 0, label, {
      fontFamily: FONT_SERIF,
      fontSize: opts.fontSize ?? '17px',
      color: PALETTE_HEX.bone,
      align: 'center',
      wordWrap: { width: width - 20 },
    })
    .setOrigin(0.5);
  const items: Phaser.GameObjects.GameObject[] = [bg, text];
  if (opts.subtitle) {
    const sub = scene.add
      .text(0, 14, opts.subtitle, { fontFamily: FONT_SERIF, fontSize: '12px', color: PALETTE_HEX.boneMuted })
      .setOrigin(0.5);
    items.push(sub);
  }
  const container = scene.add.container(x, y, items);
  container.setSize(width, height);

  let enabled = !opts.disabled;
  bg.setAlpha(enabled ? 1 : 0.4);
  text.setAlpha(enabled ? 1 : 0.5);

  if (enabled) {
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      if (!enabled) return;
      bg.setTexture('panel_button_hover');
      scene.tweens.add({ targets: container, scale: 1.03, duration: 120, ease: 'Sine.easeOut' });
    });
    bg.on('pointerout', () => {
      if (!enabled) return;
      bg.setTexture('panel_button');
      scene.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Sine.easeOut' });
    });
    bg.on('pointerdown', () => {
      if (!enabled) return;
      audio.click();
      scene.tweens.add({ targets: container, scale: 0.96, duration: 70, yoyo: true, ease: 'Sine.easeOut' });
      onClick();
    });
  }

  return {
    container,
    setEnabled: (v: boolean) => {
      enabled = v;
      bg.setAlpha(v ? 1 : 0.4);
      text.setAlpha(v ? 1 : 0.5);
      bg.setTexture('panel_button');
      if (v) bg.setInteractive({ useHandCursor: true });
      else bg.disableInteractive();
    },
    destroy: () => container.destroy(),
  };
}
