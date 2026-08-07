import Phaser from 'phaser';
import type { PlayerState } from '@data/types';
import { FONT_MONO, FONT_BODY, PALETTE_HEX, SZ } from './uiTheme';
import { resonanceTier } from '@systems/ResonanceSystem';
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

export function createStatPanel(scene: Phaser.Scene, x: number, y: number, pointWidth = 320): StatPanelHandle {
  const width = pointWidth;
  const container = scene.add.container(x, y).setDepth(10);
  const panelHeight = 205;
  const barH = 15;
  const bg = scene.add.image(width / 2, panelHeight / 2, 'panel_stat').setDisplaySize(width, panelHeight).setAlpha(0.88);
  container.add(bg);
  const barW = width - 92;
  const labelX = 42;
  const valueX = width - 10;

  const levelText = scene.add.text(18, -87, 'LEVEL 1', { fontFamily: FONT_MONO, fontSize: SZ.sm, color: PALETTE_HEX.gold });
  const xpBar = bar(scene, container, labelX, -76, barW, 9, 0xc9a24b, 0x2a2e33);
  const xpText = scene.add.text(valueX, -66, '', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.boneMuted }).setOrigin(1, 0);

  const hpLabel = scene.add.text(18, -48, 'HP', { fontFamily: FONT_MONO, fontSize: SZ.sm, color: PALETTE_HEX.bone });
  const hpBar = bar(scene, container, labelX, -36, barW, barH, 0xb0453f);
  const hpText = scene.add.text(valueX, -44, '', { fontFamily: FONT_MONO, fontSize: SZ.sm, color: PALETTE_HEX.bone }).setOrigin(1, 0);

  const mpLabel = scene.add.text(18, -14, 'MP', { fontFamily: FONT_MONO, fontSize: SZ.sm, color: PALETTE_HEX.bone });
  const mpBar = bar(scene, container, labelX, -2, barW, barH - 3, 0x4a6fa5);
  const mpText = scene.add.text(valueX, -10, '', { fontFamily: FONT_MONO, fontSize: SZ.sm, color: PALETTE_HEX.bone }).setOrigin(1, 0);

  const resLabel = scene.add.text(18, 22, 'RES', { fontFamily: FONT_MONO, fontSize: SZ.sm, color: PALETTE_HEX.bone });
  const resBar = bar(scene, container, labelX, 34, barW, barH - 3, 0x9b59b6);
  const resTierText = scene.add.text(valueX, 26, '', { fontFamily: FONT_MONO, fontSize: SZ.sm, color: PALETTE_HEX.gold }).setOrigin(1, 0);

  const momentumLabel = scene.add.text(18, 52, 'MOMENTUM', { fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.boneMuted });
  const momentumDots: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < 3; i++) {
    momentumDots.push(scene.add.circle(width - 92 + i * 26, 62, 8, 0x2a2e33).setStrokeStyle(1, 0xc9a24b));
  }

  const fatigueLabel = scene.add.text(18, 76, 'FAT 0%', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.boneMuted });
  const fatigueBar = bar(scene, container, labelX, 76, barW, 7, 0x8e44ad, 0x2a2e33);

  const factionBars: Record<string, ReturnType<typeof bar>> = {};
  const factionRow = 92;
  Object.values(FACTIONS).forEach((f, i) => {
    const fy = factionRow + i * 16;
    const swatch = scene.add.image(8, fy, `faction_${f.id}`).setDisplaySize(12, 12).setOrigin(0, 0.5);
    const label = scene.add.text(28, fy - 6, f.name.replace('The ', ''), { fontFamily: FONT_BODY, fontSize: '14px', color: PALETTE_HEX.boneMuted });
    const b = bar(scene, container, 148, fy, width - 158, 9, f.color);
    factionBars[f.id] = b;
    container.add([swatch, label]);
  });

  container.add([levelText, xpText, hpLabel, hpText, mpLabel, mpText, resLabel, resTierText, momentumLabel, fatigueLabel, ...momentumDots]);

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
      hpBar.setPct(player.currentHP / Math.max(1, player.derived.maxHP));
      hpText.setText(`${player.currentHP}/${player.derived.maxHP}`);
      mpBar.setPct(player.currentMP / Math.max(1, player.derived.maxMP));
      mpText.setText(`${player.currentMP}/${player.derived.maxMP}`);
      resBar.setPct(Math.max(0, Math.min(1, player.resonance / 100)));
      resTierText.setText(resonanceTier(player.resonance));
      momentumDots.forEach((d, i) => d.setFillStyle(i < Math.max(0, Math.min(3, player.momentum)) ? 0xc9a24b : 0x2a2e33));
      fatigueBar.setPct(player.fatigue / 100);
      const fat = player.fatigue;
      fatigueBar.fg.setFillStyle(fat >= 76 ? 0xb0453f : fat >= 51 ? 0xe67e22 : fat >= 26 ? 0xc9a24b : 0x8e44ad);
      fatigueLabel.setText(`FAT ${Math.round(fat)}%`);
    },
    destroy: () => container.destroy(),
  };
}