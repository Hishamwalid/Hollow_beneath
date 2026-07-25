import Phaser from 'phaser';
import type { PlayerState } from '@data/types';
import { FONT_MONO, FONT_SERIF, PALETTE_HEX } from './uiTheme';
import { resonanceTier, TIER_LABELS } from '@systems/ResonanceSystem';
import { FACTIONS } from '@data/factions';
import { xpForLevel } from '@systems/LevelSystem';

function bar(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: number,
  bgColor = 0x2a2e33,
): { fg: Phaser.GameObjects.Rectangle; setPct: (p: number) => void } {
  const bg = scene.add.rectangle(x, y, w, h, bgColor).setOrigin(0, 0.5);
  const fg = scene.add.rectangle(x, y, w, h, fillColor).setOrigin(0, 0.5);
  container.add([bg, fg]);
  return {
    fg,
    setPct: (p: number) => {
      const targetWidth = Math.max(0, Math.min(1, p)) * w;
      scene.tweens.add({ targets: fg, width: targetWidth, duration: 350, ease: 'Sine.easeOut' });
    },
  };
}

export interface StatPanelHandle {
  container: Phaser.GameObjects.Container;
  update: (player: PlayerState) => void;
  destroy: () => void;
}

export function createStatPanel(scene: Phaser.Scene, x: number, y: number, width = 300): StatPanelHandle {
  const container = scene.add.container(x, y).setDepth(10);
  const panelHeight = 180;
  const bg = scene.add.image(width / 2, panelHeight / 2, 'panel_stat').setDisplaySize(width, panelHeight).setAlpha(0.85);
  container.add(bg);
  const barW = width - 90;

  const levelText = scene.add.text(0, -26, 'LEVEL 1', { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.gold });
  const xpBar = bar(scene, container, 80, -20, width - 90, 8, 0xc9a24b, 0x2a2e33);
  const xpText = scene.add.text(width - 10, -26, '', { fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.boneMuted }).setOrigin(1, 0);

  const hpLabel = scene.add.text(0, 4, 'HP', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.bone });
  const hpBar = bar(scene, container, 40, 10, barW, 14, 0xb0453f);
  const hpText = scene.add.text(width - 10, 4, '', { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.bone }).setOrigin(1, 0);

  const mpLabel = scene.add.text(0, 30, 'MP', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.bone });
  const mpBar = bar(scene, container, 40, 36, barW, 10, 0x4a6fa5);
  const mpText = scene.add.text(width - 10, 30, '', { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.bone }).setOrigin(1, 0);

  const resLabel = scene.add.text(0, 54, 'RES', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.bone });
  const resBar = bar(scene, container, 40, 60, barW, 10, 0x9b59b6);
  const resTierText = scene.add.text(width - 10, 54, '', { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.gold }).setOrigin(1, 0);

  const momentumDots: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < 3; i++) {
    momentumDots.push(scene.add.circle(width - 66 + i * 20, 78, 6, 0x2a2e33).setStrokeStyle(1, 0xc9a24b));
  }
  const momentumLabel = scene.add.text(0, 72, 'MOMENTUM', { fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.boneMuted });

  const factionBars: Record<string, ReturnType<typeof bar>> = {};
  const factionRow = 98;
  Object.values(FACTIONS).forEach((f, i) => {
    const fy = factionRow + i * 16;
    const swatch = scene.add.image(4, fy, `faction_${f.id}`).setDisplaySize(12, 12).setOrigin(0, 0.5);
    const label = scene.add.text(20, fy - 7, f.name.replace('The ', ''), { fontFamily: FONT_SERIF, fontSize: '11px', color: PALETTE_HEX.boneMuted });
    const b = bar(scene, container, 150, fy, width - 160, 8, f.color);
    factionBars[f.id] = b;
    container.add([swatch, label]);
  });

  container.add([levelText, xpText, hpLabel, hpText, mpLabel, mpText, resLabel, resTierText, momentumLabel, ...momentumDots]);

  return {
    container,
    update: (player: PlayerState) => {
      const xpNeeded = xpForLevel(player.level + 1);
      const prevXp = xpForLevel(player.level);
      const xpInLevel = player.xp - prevXp;
      const xpForNext = xpNeeded - prevXp;
      levelText.setText(`LV ${player.level}`);
      xpBar.setPct(xpForNext > 0 ? xpInLevel / xpForNext : 1);
      xpText.setText(`${player.xp} / ${xpNeeded} XP`);
    },
    destroy: () => container.destroy(),
  };
}
