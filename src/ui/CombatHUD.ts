import Phaser from 'phaser';
import type { EnemyView } from '@systems/CombatEngine';
import { FONT_MONO, FONT_SERIF, PALETTE_HEX } from './uiTheme';
import { weaknessLabel } from '@data/damageTypes';
import { statusLabel } from '@data/statusEffects';

export interface EnemyDisplay {
  container: Phaser.GameObjects.Container;
  update: (view: EnemyView) => void;
  setSelected: (v: boolean) => void;
  destroy: () => void;
}

export function createEnemyDisplay(
  scene: Phaser.Scene,
  x: number,
  y: number,
  textureKey: string,
  onClick: () => void,
): EnemyDisplay {
  const container = scene.add.container(x, y);
  const selectRing = scene.add.circle(0, 0, 40, 0x000000, 0).setStrokeStyle(3, 0xc9a24b, 0).setVisible(false);
  const token = scene.add.image(0, 0, textureKey).setDisplaySize(72, 72).setInteractive({ useHandCursor: true });
  const nameText = scene.add.text(0, 48, '', { fontFamily: FONT_SERIF, fontSize: '13px', color: PALETTE_HEX.bone }).setOrigin(0.5, 0);
  const hpBg = scene.add.rectangle(0, 70, 84, 8, 0x2a2e33);
  const hpFg = scene.add.rectangle(-42, 70, 84, 8, 0xb0453f).setOrigin(0, 0.5);
  const hpText = scene.add.text(0, 78, '', { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.boneMuted }).setOrigin(0.5, 0);
  const affinityText = scene.add.text(0, -52, '', { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.gold, align: 'center' }).setOrigin(0.5, 1);
  const statusText = scene.add.text(0, 94, '', { fontFamily: FONT_MONO, fontSize: '9px', color: '#e67e22', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5, 0);

  container.add([selectRing, token, nameText, hpBg, hpFg, hpText, affinityText, statusText]);
  token.on('pointerdown', onClick);

  return {
    container,
    update: (view: EnemyView) => {
      container.setVisible(view.alive);
      nameText.setText(view.name);
      const pct = Math.max(0, view.hp / view.maxHp);
      hpFg.width = 84 * pct;
      hpText.setText(`${view.hp}/${view.maxHp}`);
      if (view.revealed) {
        const entries = Object.entries(view.affinities)
          .filter(([, v]) => v !== 1)
          .slice(0, 2)
          .map(([t, v]) => `${t}: ${weaknessLabel(v as number)}`);
        affinityText.setText(entries.join('\n'));
      } else {
        affinityText.setText('');
      }
      statusText.setText(view.statuses.map((s) => statusLabel(s.id)).join(', '));
    },
    setSelected: (v: boolean) => {
      selectRing.setStrokeStyle(3, 0xc9a24b, v ? 1 : 0);
    },
    destroy: () => container.destroy(),
  };
}

export function createApPips(scene: Phaser.Scene, x: number, y: number): { update: (ap: number) => void; destroy: () => void } {
  const container = scene.add.container(x, y);
  const label = scene.add.text(-10, -10, 'AP', { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted }).setOrigin(1, 0.5);
  container.add(label);
  const dots: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < 4; i++) {
    const d = scene.add.circle(i * 20, 0, 8, 0x2a2e33).setStrokeStyle(2, 0xc9a24b);
    dots.push(d);
    container.add(d);
  }
  return {
    update: (ap: number) => {
      dots.forEach((d, i) => d.setFillStyle(i < ap ? 0xc9a24b : 0x2a2e33));
    },
    destroy: () => container.destroy(),
  };
}

export interface ActionBarItem {
  id: string;
  label: string;
  apCost: number;
  disabled?: boolean;
  onClick: () => void;
}

export function createActionBar(scene: Phaser.Scene, x: number, y: number, items: ActionBarItem[]): { container: Phaser.GameObjects.Container } {
  const container = scene.add.container(x, y);
  const w = 118;
  items.forEach((item, i) => {
    const bx = i * (w + 8);
    const bg = scene.add
      .rectangle(bx, 0, w, 44, 0x22262c)
      .setStrokeStyle(1, item.disabled ? 0x555555 : 0xc9a24b)
      .setAlpha(item.disabled ? 0.4 : 1);
    const label = scene.add
      .text(bx, -6, item.label, { fontFamily: FONT_SERIF, fontSize: '13px', color: item.disabled ? PALETTE_HEX.boneMuted : PALETTE_HEX.bone })
      .setOrigin(0.5);
    const cost = scene.add
      .text(bx, 12, `${item.apCost} AP`, { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.gold })
      .setOrigin(0.5);
    container.add([bg, label, cost]);
    if (!item.disabled) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0x33383f));
      bg.on('pointerout', () => bg.setFillStyle(0x22262c));
      bg.on('pointerdown', item.onClick);
    }
  });
  return { container };
}
