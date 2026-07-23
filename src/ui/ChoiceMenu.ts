import Phaser from 'phaser';
import { createButton } from './Button';

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

export function createChoiceMenu(
  scene: Phaser.Scene,
  x: number,
  y: number,
  items: ChoiceMenuItem[],
  opts: { width?: number; spacing?: number } = {},
): ChoiceMenu {
  const width = opts.width ?? 560;
  const spacing = opts.spacing ?? 60;
  const container = scene.add.container(x, y);

  items.forEach((item, i) => {
    const btn = createButton(scene, 0, i * spacing, item.label, item.onSelect, {
      width,
      height: 50,
      subtitle: item.subtitle,
      disabled: item.disabled,
    });
    container.add(btn.container);
  });

  return {
    container,
    destroy: () => container.destroy(),
  };
}
