import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';
import { FONT_SERIF, FONT_MONO, PALETTE_HEX } from './uiTheme';
import { createButton } from './Button';
import type { StatBlock } from '@data/types';

export interface LevelUpModalHandle {
  container: Phaser.GameObjects.Container;
  destroy: () => void;
}

export function showLevelUpModal(
  scene: Phaser.Scene,
  level: number,
  onStatPoint: () => void,
  onSkillPoint: () => void,
  onClose: () => void,
): LevelUpModalHandle {
  const container = scene.add.container(GAME_WIDTH / 2, 0).setDepth(100);

  const bg = scene.add.rectangle(0, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(100);
  container.add(bg);

  const title = scene.add.text(0, GAME_HEIGHT / 2 - 140, `LEVEL ${level}!`, {
    fontFamily: FONT_SERIF, fontSize: '42px', color: PALETTE_HEX.gold,
  }).setOrigin(0.5).setDepth(101);
  container.add(title);

  const subtitle = scene.add.text(0, GAME_HEIGHT / 2 - 90, 'The Loom\'s attention sharpens...', {
    fontFamily: FONT_SERIF, fontSize: '16px', color: PALETTE_HEX.bone,
  }).setOrigin(0.5).setDepth(101);
  container.add(subtitle);

  const label = scene.add.text(0, GAME_HEIGHT / 2 - 50, 'Choose your reward:', {
    fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.boneMuted,
  }).setOrigin(0.5).setDepth(101);
  container.add(label);

  const btnSpacing = 60;
  const btnY = GAME_HEIGHT / 2;

  const statBtnBg = scene.add.rectangle(0, btnY, 280, 48, 0x2a2e33).setStrokeStyle(1, 0xc9a24b, 0.5).setDepth(101);
  const statBtnText = scene.add.text(0, btnY, '  Stat Point  (+1 to any stat)', {
    fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.bone,
  }).setOrigin(0.5).setDepth(102);
  statBtnBg.setInteractive({ useHandCursor: true })
    .on('pointerover', () => statBtnBg.setFillStyle(0x3a3e44))
    .on('pointerout', () => statBtnBg.setFillStyle(0x2a2e33))
    .on('pointerdown', () => { onStatPoint(); });
  container.add([statBtnBg, statBtnText]);

  const skillBtnBg = scene.add.rectangle(0, btnY + btnSpacing, 280, 48, 0x2a2e33).setStrokeStyle(1, 0xc9a24b, 0.5).setDepth(101);
  const skillBtnText = scene.add.text(0, btnY + btnSpacing, '  Skill Point  (unlock a skill)', {
    fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.bone,
  }).setOrigin(0.5).setDepth(102);
  skillBtnBg.setInteractive({ useHandCursor: true })
    .on('pointerover', () => skillBtnBg.setFillStyle(0x3a3e44))
    .on('pointerout', () => skillBtnBg.setFillStyle(0x2a2e33))
    .on('pointerdown', () => { onSkillPoint(); });
  container.add([skillBtnBg, skillBtnText]);

  const subtext = scene.add.text(0, GAME_HEIGHT / 2 + 140, 'You can also spend skill points in the Skills menu later.', {
    fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.boneMuted,
  }).setOrigin(0.5).setDepth(101);
  container.add(subtext);

  return {
    container,
    destroy: () => container.destroy(),
  };
}

export function showStatChoiceModal(
  scene: Phaser.Scene,
  onPick: (stat: keyof StatBlock) => void,
  onCancel: () => void,
): LevelUpModalHandle {
  const container = scene.add.container(GAME_WIDTH / 2, 0).setDepth(110);
  const bg = scene.add.rectangle(0, GAME_HEIGHT / 2, 360, 320, 0x1a1d22).setStrokeStyle(1, 0xc9a24b, 0.5).setDepth(110);
  container.add(bg);

  const title = scene.add.text(0, GAME_HEIGHT / 2 - 130, 'Choose a Stat', {
    fontFamily: FONT_SERIF, fontSize: '22px', color: PALETTE_HEX.gold,
  }).setOrigin(0.5).setDepth(111);
  container.add(title);

  const stats: { key: keyof StatBlock; label: string; desc: string }[] = [
    { key: 'str', label: 'STR', desc: '+2 ATK' },
    { key: 'dex', label: 'DEX', desc: '+2 Speed, +2% Acc, +2% Dodge' },
    { key: 'con', label: 'CON', desc: '+10 MaxHP, +2 DEF' },
    { key: 'int', label: 'INT', desc: '+2 MATK, +2 MDEF' },
    { key: 'will', label: 'WILL', desc: '+6 MaxMP, +1 MDEF' },
  ];

  const startY = GAME_HEIGHT / 2 - 85;
  stats.forEach((s, i) => {
    const y = startY + i * 42;
    const rowBg = scene.add.rectangle(0, y, 300, 36, 0x2a2e33).setStrokeStyle(1, 0x555555, 0.4).setDepth(111);
    const nameText = scene.add.text(-130, y, `+1 ${s.label}`, {
      fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.gold,
    }).setOrigin(0, 0.5).setDepth(112);
    const descText = scene.add.text(50, y, s.desc, {
      fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(0, 0.5).setDepth(112);
    rowBg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => rowBg.setFillStyle(0x3a3e44))
      .on('pointerout', () => rowBg.setFillStyle(0x2a2e33))
      .on('pointerdown', () => { container.destroy(); onPick(s.key); });
    container.add([rowBg, nameText, descText]);
  });

  return {
    container,
    destroy: () => container.destroy(),
  };
}
