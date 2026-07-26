import Phaser from 'phaser';
import { createButton } from './Button';
import { GAME_HEIGHT } from '@/config';

export interface ChoiceMenuItem {
  label: string;
  subtitle?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export interface ChoiceMenu {
  container: Phaser.GameObjects.Container;
  destroy: () => void;
}

const BUTTON_HEIGHT = 50;

/**
 * Lays out a vertical stack of choice buttons starting at (x, y).
 * Adaptively compresses spacing and, if still needed, shifts the whole block
 * upward so it never renders past `bottomBound` — this is what previously let
 * 4-5 item menus (e.g. boss pre-combat choices) render partially off-canvas.
 * Behavior for small item counts that already fit is unchanged.
 */
export function createChoiceMenu(
  scene: Phaser.Scene,
  x: number,
  y: number,
  items: ChoiceMenuItem[],
  opts: { width?: number; spacing?: number; bottomBound?: number } = {},
): ChoiceMenu {
  const width = opts.width ?? 560;
  const desiredSpacing = opts.spacing ?? 60;
  const bottomBound = opts.bottomBound ?? GAME_HEIGHT - 20;
  const halfButton = BUTTON_HEIGHT / 2;
  const n = Math.max(1, items.length);

  const maxSpacingThatFits = n > 1 ? (bottomBound - halfButton - y) / (n - 1) : desiredSpacing;
  const spacing = n > 1 ? Math.max(62, Math.min(desiredSpacing, maxSpacingThatFits)) : desiredSpacing;

  const blockBottom = y + (n - 1) * spacing + halfButton;
  const shiftUp = Math.max(0, blockBottom - bottomBound);
  const startY = y - shiftUp;

  const container = scene.add.container(x, startY).setDepth(40);

  items.forEach((item, i) => {
    const btn = createButton(scene, 0, i * spacing, item.label, item.onSelect, {
      width,
      height: BUTTON_HEIGHT,
      subtitle: item.subtitle,
      disabled: item.disabled,
    });
    btn.container.setAlpha(0);
    scene.tweens.add({ targets: btn.container, alpha: 1, duration: 220, delay: i * 55, ease: 'Sine.easeOut' });
    container.add(btn.container);
  });

  return {
    container,
    destroy: () => container.destroy(),
  };
}
