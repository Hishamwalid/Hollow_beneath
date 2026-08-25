import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';
import { FONT_SERIF, FONT_BODY, FONT_MONO, PALETTE_HEX, SURFACE_HEX } from './uiTheme';
import type { StatBlock } from '@data/types';

export interface LevelUpModalHandle {
  container: Phaser.GameObjects.Container;
  /** Keyboard nav: move focus up/down among the modal's rows. */
  nav: (dir: 'up' | 'down') => void;
  /** Activate the focused row. */
  confirm: () => void;
  destroy: () => void;
}

const num = (css: string): number => parseInt(css.replace('#', ''), 16);

/** Shared focus plumbing for the level-up family of modals. */
function makeNav(rows: { select: () => void; setFocused: (f: boolean) => void }[]) {
  let idx = -1;
  return {
    nav: (dir: 'up' | 'down') => {
      if (rows.length === 0) return;
      const cur = idx < 0 ? (dir === 'down' ? -1 : 0) : idx;
      if (idx >= 0) rows[idx].setFocused(false);
      idx = dir === 'down' ? Math.min(rows.length - 1, cur + 1) : Math.max(0, cur - 1);
      rows[idx].setFocused(true);
    },
    confirm: () => {
      const i = idx >= 0 ? idx : 0;
      rows[i]?.select();
    },
  };
}

export function showLevelUpModal(
  scene: Phaser.Scene,
  level: number,
  onStatPoint: () => void,
  onSkillPoint: () => void,
  onClose: () => void,
): LevelUpModalHandle {
  const container = scene.add.container(GAME_WIDTH / 2, 0).setDepth(100);

  const bg = scene.add.rectangle(0, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(100).setInteractive();
  container.add(bg);

  const title = scene.add.text(0, GAME_HEIGHT / 2 - 140, `LEVEL ${level}!`, {
    fontFamily: FONT_SERIF, fontSize: '42px', color: PALETTE_HEX.gold,
  }).setOrigin(0.5).setDepth(101);
  container.add(title);

  // Subtitles are IM Fell italic everywhere else — the hierarchy holds here too.
  const subtitle = scene.add.text(0, GAME_HEIGHT / 2 - 90, 'The Loom\'s attention sharpens...', {
    fontFamily: FONT_BODY, fontSize: '18px', color: PALETTE_HEX.boneMuted, fontStyle: 'italic',
  }).setOrigin(0.5).setDepth(101);
  container.add(subtitle);

  const label = scene.add.text(0, GAME_HEIGHT / 2 - 50, 'Choose your reward:', {
    fontFamily: FONT_MONO, fontSize: '15px', color: PALETTE_HEX.boneMuted,
  }).setOrigin(0.5).setDepth(101);
  container.add(label);

  const btnSpacing = 64;
  const btnY = GAME_HEIGHT / 2;

  const mkRewardRow = (y: number, title: string, sub: string, onPick: () => void) => {
    const rowBg = scene.add.rectangle(0, y, 320, 52, SURFACE_HEX.border).setStrokeStyle(1, num(PALETTE_HEX.gold), 0.5).setDepth(101);
    const nameText = scene.add.text(-130, y - 9, title, {
      fontFamily: FONT_SERIF, fontSize: '16px', color: PALETTE_HEX.bone,
    }).setOrigin(0, 0.5).setDepth(102);
    const subText = scene.add.text(-130, y + 11, sub, {
      fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(0, 0.5).setDepth(102);
    rowBg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { if (!focusedRowHas(y)) rowBg.setFillStyle(SURFACE_HEX.rowHover); })
      .on('pointerout', () => { if (!focusedRowHas(y)) rowBg.setFillStyle(SURFACE_HEX.border); })
      .on('pointerdown', onPick);
    container.add([rowBg, nameText, subText]);
    return rowBg;
  };
  // Whether any focused row is at this y (hover shouldn't fight keyboard focus).
  const focusedRowHas = (_y: number) => false;

  const statBg = mkRewardRow(btnY, 'Stat Point', '+1 to any stat', onStatPoint);
  const skillBg = mkRewardRow(btnY + btnSpacing, 'Skill Point', 'unlock a technique', onSkillPoint);

  const subtext = scene.add.text(0, GAME_HEIGHT / 2 + 150, 'You can also spend skill points in the Skills menu later.', {
    fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.boneMuted,
  }).setOrigin(0.5).setDepth(101);
  container.add(subtext);

  const paintFocus = (bg: Phaser.GameObjects.Rectangle, f: boolean) => {
    bg.setFillStyle(f ? SURFACE_HEX.rowHover : SURFACE_HEX.border);
    bg.setStrokeStyle(f ? 1.5 : 1, f ? num(PALETTE_HEX.goldBright) : num(PALETTE_HEX.gold), f ? 1 : 0.5);
  };

  const rows = [
    { select: onStatPoint, setFocused: (f: boolean) => paintFocus(statBg, f) },
    { select: onSkillPoint, setFocused: (f: boolean) => paintFocus(skillBg, f) },
  ];
  return {
    container,
    ...makeNav(rows),
    destroy: () => container.destroy(),
  };
}

/** Stat spending is mandatory — there is no cancel path by design. */
export function showStatChoiceModal(
  scene: Phaser.Scene,
  onPick: (stat: keyof StatBlock) => void,
): LevelUpModalHandle {
  const container = scene.add.container(GAME_WIDTH / 2, 0).setDepth(110);
  const bg = scene.add.rectangle(0, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(110).setInteractive();
  container.add(bg);
  const panelBg = scene.add.rectangle(0, GAME_HEIGHT / 2, 380, 330, SURFACE_HEX.panel).setStrokeStyle(1, num(PALETTE_HEX.gold), 0.6).setDepth(111);
  container.add(panelBg);

  const title = scene.add.text(0, GAME_HEIGHT / 2 - 132, 'Choose a Stat', {
    fontFamily: FONT_SERIF, fontSize: '26px', color: PALETTE_HEX.gold,
  }).setOrigin(0.5).setDepth(111);
  container.add(title);

  const prompt = scene.add.text(0, GAME_HEIGHT / 2 - 104, 'the point must be spent', {
    fontFamily: FONT_BODY, fontSize: '13px', fontStyle: 'italic', color: PALETTE_HEX.boneMuted,
  }).setOrigin(0.5).setDepth(111);
  void prompt;
  container.add(prompt);

  const stats: { key: keyof StatBlock; label: string; desc: string }[] = [
    { key: 'str', label: 'STR', desc: '+2 ATK' },
    { key: 'dex', label: 'DEX', desc: '+2 Speed, +2% Acc, +2% Dodge' },
    { key: 'con', label: 'CON', desc: '+10 MaxHP, +2 DEF' },
    { key: 'int', label: 'INT', desc: '+2 MATK, +2 MDEF' },
    { key: 'will', label: 'WILL', desc: '+6 MaxMP, +1 MDEF' },
  ];

  const startY = GAME_HEIGHT / 2 - 70;
  const rowBgs: { bg: Phaser.GameObjects.Rectangle; select: () => void }[] = [];
  stats.forEach((s, i) => {
    const y = startY + i * 44;
    const rowBg = scene.add.rectangle(0, y, 340, 38, SURFACE_HEX.border).setStrokeStyle(1, SURFACE_HEX.muted, 0.4).setDepth(111);
    const nameText = scene.add.text(-150, y, `+1 ${s.label}`, {
      fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.gold,
    }).setOrigin(0, 0.5).setDepth(112);
    const descText = scene.add.text(-60, y, s.desc, {
      fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(0, 0.5).setDepth(112);
    const pick = () => { container.destroy(); onPick(s.key); };
    rowBg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => rowBg.setFillStyle(SURFACE_HEX.rowHover))
      .on('pointerout', () => rowBg.setFillStyle(SURFACE_HEX.border))
      .on('pointerdown', pick);
    container.add([rowBg, nameText, descText]);
    rowBgs.push({ bg: rowBg, select: pick });
  });

  return {
    container,
    ...makeNav(rowBgs.map((r) => ({
      select: r.select,
      setFocused: (f: boolean) => {
        r.bg.setFillStyle(f ? SURFACE_HEX.rowHover : SURFACE_HEX.border);
        r.bg.setStrokeStyle(f ? 1.5 : 1, f ? num(PALETTE_HEX.goldBright) : SURFACE_HEX.muted, f ? 1 : 0.4);
      },
    }))),
    destroy: () => container.destroy(),
  };
}
