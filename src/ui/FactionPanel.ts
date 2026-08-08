import Phaser from 'phaser';
import type { FactionState } from '@data/types';
import { FACTIONS } from '@data/factions';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX } from './uiTheme';

export interface FactionPanelHandle {
  container: Phaser.GameObjects.Container;
  update: (faction: FactionState) => void;
  destroy: () => void;
}

export function createFactionPanel(scene: Phaser.Scene, x: number, y: number, width = 214): FactionPanelHandle {
  const rowH = 30;
  const entries = Object.values(FACTIONS);
  const height = 44 + entries.length * rowH;
  const container = scene.add.container(x, y).setDepth(10);
  const bg = scene.add.rectangle(width / 2, height / 2, width, height, 0x16191d, 0.94).setStrokeStyle(1, 0xc9a24b, 0.6);
  container.add(bg);
  container.add(scene.add.text(16, 12, 'FACTION STANDINGS', {
    fontFamily: FONT_SERIF, fontSize: '15px', color: PALETTE_HEX.bone,
  }));
  container.add(scene.add.rectangle(width / 2, 34, width - 24, 1, 0x3a3f46));

  const values: Record<string, Phaser.GameObjects.Text> = {};
  entries.forEach((f, i) => {
    const ry = 46 + i * rowH;
    container.add(scene.add.text(16, ry, `${f.name.replace(/^The /, '')}:`, {
      fontFamily: FONT_BODY, fontSize: '15px', color: f.colorCss,
    }));
    const val = scene.add.text(width - 16, ry, '0', {
      fontFamily: FONT_MONO, fontSize: '15px', color: PALETTE_HEX.bone,
    }).setOrigin(1, 0);
    values[f.id] = val;
    container.add(val);
  });

  return {
    container,
    update: (faction: FactionState) => {
      entries.forEach((f) => values[f.id]?.setText(String(faction[f.id] ?? 0)));
    },
    destroy: () => container.destroy(),
  };
}
