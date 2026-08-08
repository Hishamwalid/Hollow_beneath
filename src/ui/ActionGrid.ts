import Phaser from 'phaser';
import { PALETTE_HEX } from './uiTheme';
import { audio } from '@placeholder/PlaceholderAudio';

export interface ActionGridItem {
  icon: string;
  label: string;
  onClick: () => void;
  badge?: () => string | null;
}

export interface ActionGridHandle {
  container: Phaser.GameObjects.Container;
  refresh: () => void;
  destroy: () => void;
}

/** A 3-column grid of square icon buttons, e.g. Character / Codex / Skills / Shop / Menu / Settings. */
export function createActionGrid(scene: Phaser.Scene, x: number, y: number, items: ActionGridItem[], width = 214): ActionGridHandle {
  const cols = 3;
  const cell = Math.floor((width - 16) / cols);
  const gap = 8;
  const rows = Math.ceil(items.length / cols);
  const height = rows * cell + (rows - 1) * gap + 16;

  const container = scene.add.container(x, y).setDepth(10);
  const bg = scene.add.rectangle(width / 2, height / 2, width, height, 0x16191d, 0.94).setStrokeStyle(1, 0xc9a24b, 0.6);
  container.add(bg);

  const badgeTexts: Array<{ text: Phaser.GameObjects.Text; item: ActionGridItem }> = [];

  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = 8 + col * (cell + gap) + cell / 2;
    const cy = 8 + row * (cell + gap) + cell / 2;

    const box = scene.add.rectangle(cx, cy, cell - 4, cell - 4, 0x22262c).setStrokeStyle(1, 0x3a3f46);
    const icon = scene.add.image(cx, cy, item.icon).setDisplaySize(cell * 0.5, cell * 0.5);
    container.add([box, icon]);

    let badgeText: Phaser.GameObjects.Text | undefined;
    if (item.badge) {
      badgeText = scene.add.text(cx + cell / 2 - 10, cy - cell / 2 + 10, '', {
        fontFamily: 'monospace', fontSize: '11px', color: PALETTE_HEX.gold,
      }).setOrigin(0.5);
      container.add(badgeText);
      badgeTexts.push({ text: badgeText, item });
    }

    box.setInteractive({ useHandCursor: true });
    box.on('pointerover', () => box.setStrokeStyle(1, 0xc9a24b));
    box.on('pointerout', () => box.setStrokeStyle(1, 0x3a3f46));
    box.on('pointerdown', () => {
      audio.click();
      item.onClick();
    });
  });

  const refresh = () => {
    badgeTexts.forEach(({ text, item }) => {
      const v = item.badge?.() ?? null;
      text.setText(v ?? '');
      text.setVisible(!!v);
    });
  };
  refresh();

  return { container, refresh, destroy: () => container.destroy() };
}
