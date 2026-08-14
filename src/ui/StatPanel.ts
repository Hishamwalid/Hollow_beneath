import Phaser from 'phaser';
import type { PlayerState } from '@data/types';
import { FONT_MONO, FONT_SERIF, PALETTE_HEX, DESIGN } from './uiTheme';
import { xpForLevel } from '@systems/LevelSystem';

function bar(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: number,
  bgColor = 0x0b0d10,
): { fg: Phaser.GameObjects.Rectangle; setPct: (p: number) => void } {
  const bg = scene.add.rectangle(x, y, w, h, bgColor, 0.45).setOrigin(0, 0.5);
  const fg = scene.add.rectangle(x, y, w, h, fillColor).setOrigin(0, 0.5).setStrokeStyle(1, 0x0b0d10);
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

const PANEL_W = 258.7;
const PANEL_H = 106;

/** Dark outline so text stays readable on the light book-page panel. */
const STROKE = { stroke: '#0b0d10', strokeThickness: 3 };

export function createStatPanel(scene: Phaser.Scene, x: number, y: number): StatPanelHandle {
  const container = scene.add.container(x, y).setDepth(10).setScale(1.15);

  if (scene.textures.exists('panel_book')) {
    const back = scene.add.image(0, 0, 'panel_book').setDisplaySize(PANEL_W, PANEL_H);
    const gold = scene.add.rectangle(0, 0, PANEL_W, PANEL_H).setStrokeStyle(2, 0xc9a24b);
    const black = scene.add.rectangle(0, 0, PANEL_W - 6, PANEL_H - 6).setStrokeStyle(1.5, 0x0b0d10);
    container.addAt([back, gold, black], 0);
  } else {
    const bg = scene.add
      .rectangle(0, 0, PANEL_W, PANEL_H, 0x9b741e)
      .setStrokeStyle(2, 0x0b0d10)
      .setOrigin(0.5);
    container.add(bg);
  }

  const headerText = scene.add.text(-119.4, -42.3, 'PLAYER', {
    fontFamily: FONT_SERIF, fontSize: '10px', color: PALETTE_HEX.gold, ...STROKE,
  }).setOrigin(0, 0.5);
  const levelText = scene.add.text(95.3, -42.3, '', {
    fontFamily: FONT_SERIF, fontSize: '10px', color: PALETTE_HEX.gold, ...STROKE,
  }).setOrigin(1, 0.5);

  const barW = 137.4;
  const labelX = -120;
  const valueX = 104;

  const xpLabel = scene.add.text(labelX, -26.3, 'XP:', { fontFamily: FONT_SERIF, fontSize: '10px', color: PALETTE_HEX.gold, ...STROKE }).setOrigin(0, 0.5);
  const xpBar = bar(scene, container, -68.7, -26.3, barW, 9.7, 0xc9a24b);
  const xpText = scene.add.text(valueX, -26.3, '', { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.gold, ...STROKE }).setOrigin(1, 0.5);

  const hpLabel = scene.add.text(labelX, -6.3, 'HP:', { fontFamily: FONT_SERIF, fontSize: '10px', color: '#e1665c', ...STROKE }).setOrigin(0, 0.5);
  const hpBar = bar(scene, container, -68.7, -6.3, barW, 9.7, 0xb10000);
  const hpText = scene.add.text(valueX, -6.3, '', { fontFamily: FONT_MONO, fontSize: '10px', color: '#e1665c', ...STROKE }).setOrigin(1, 0.5);

  const mpLabel = scene.add.text(labelX, 13, 'MP:', { fontFamily: FONT_SERIF, fontSize: '10px', color: '#64b5f5', ...STROKE }).setOrigin(0, 0.5);
  const mpBar = bar(scene, container, -68.7, 13, barW, 9.7, 0x64b5f5);
  const mpText = scene.add.text(valueX, 13, '', { fontFamily: FONT_MONO, fontSize: '10px', color: '#64b5f5', ...STROKE }).setOrigin(1, 0.5);

  const momentumLabel = scene.add.text(labelX, 38.7, 'MOMENTUM', { fontFamily: FONT_SERIF, fontSize: '10px', color: PALETTE_HEX.gold, ...STROKE }).setOrigin(0, 0.5);
  const momentumDots: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < 3; i++) {
    momentumDots.push(scene.add.circle(-20.7 + i * 21.2, 38.7, 3.5, 0x0b0d10).setStrokeStyle(1, 0x0b0d10));
  }
  const fatigueText = scene.add.text(valueX, 38.7, '', { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.gold, ...STROKE }).setOrigin(1, 0.5);

  container.add([
    headerText, levelText,
    xpLabel, xpText, hpLabel, hpText, mpLabel, mpText,
    momentumLabel, fatigueText, ...momentumDots,
  ]);

  return {
    container,
    update: (player: PlayerState) => {
      levelText.setText(`LV ${player.level}`);
      const xpNeeded = xpForLevel(player.level + 1);
      const prevXp = xpForLevel(player.level);
      const xpInLevel = player.xp - prevXp;
      const xpForNext = xpNeeded - prevXp;
      xpBar.setPct(xpForNext > 0 ? xpInLevel / xpForNext : 1);
      xpText.setText(`${player.xp}/${xpNeeded}`);
      hpBar.setPct(player.currentHP / Math.max(1, player.derived.maxHP));
      hpText.setText(`${player.currentHP}/${player.derived.maxHP}`);
      mpBar.setPct(player.currentMP / Math.max(1, player.derived.maxMP));
      mpText.setText(`${player.currentMP}/${player.derived.maxMP}`);
      momentumDots.forEach((d, i) => d.setFillStyle(i < Math.max(0, Math.min(3, player.momentum)) ? 0xb967bc : 0x0b0d10));
      fatigueText.setText(`FAT ${Math.round(player.fatigue)}%`);
    },
    destroy: () => container.destroy(),
  };
}
