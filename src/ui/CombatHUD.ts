import Phaser from 'phaser';
import type { EnemyView } from '@systems/CombatEngine';
import { FONT_MONO, FONT_SERIF, PALETTE_HEX } from './uiTheme';
import { weaknessLabel } from '@data/damageTypes';
import { statusLabel } from '@data/statusEffects';
import { GAME_WIDTH } from '@/config';

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
  const container = scene.add.container(x, y).setDepth(5);
  const panelBg = scene.add.image(0, 0, 'panel_enemy').setAlpha(0.75);
  const selectRing = scene.add.circle(0, 0, 40, 0x000000, 0).setStrokeStyle(3, 0xc9a24b, 0).setVisible(false);
  const token = scene.add.image(0, -18, textureKey).setDisplaySize(72, 72).setInteractive({ useHandCursor: true });
  const nameText = scene.add.text(0, 30, '', { fontFamily: FONT_SERIF, fontSize: '13px', color: PALETTE_HEX.bone }).setOrigin(0.5, 0);
  const hpBg = scene.add.rectangle(0, 52, 84, 8, 0x2a2e33);
  const hpFg = scene.add.rectangle(-42, 52, 84, 8, 0xb0453f).setOrigin(0, 0.5);
  const hpText = scene.add.text(0, 60, '', { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.boneMuted }).setOrigin(0.5, 0);
  const affinityText = scene.add.text(0, -64, '', { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.gold, align: 'center' }).setOrigin(0.5, 1);
  const statusText = scene.add.text(0, 76, '', { fontFamily: FONT_MONO, fontSize: '9px', color: '#e67e22', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5, 0);

  container.add([panelBg, selectRing, token, nameText, hpBg, hpFg, hpText, affinityText, statusText]);
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
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, view.revealCount)
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
  description?: string;
  onClick: () => void;
}

export function createActionBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  items: ActionBarItem[],
  sharedTooltip: Phaser.GameObjects.Text,
): { container: Phaser.GameObjects.Container } {
  const container = scene.add.container(x, y).setDepth(10);
  const w = 120;
  const h = 44;
  let tooltipTimer: Phaser.Time.TimerEvent | null = null;

  items.forEach((item, i) => {
    const bx = i * (w + 6);
    const bg = scene.add.image(bx, 0, 'panel_button').setDisplaySize(w, h);
    if (item.disabled) bg.setAlpha(0.4);
    const label = scene.add
      .text(bx, -7, item.label, { fontFamily: FONT_SERIF, fontSize: '13px', color: item.disabled ? PALETTE_HEX.boneMuted : PALETTE_HEX.bone })
      .setOrigin(0.5);
    const costText = scene.add
      .text(bx, 12, `${item.apCost} AP`, { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.gold })
      .setOrigin(0.5);
    container.add([bg, label, costText]);
    if (!item.disabled) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => {
        bg.setTexture('panel_button_hover');
        scene.tweens.killTweensOf(bg);
        bg.setScale(1);
        scene.tweens.add({ targets: bg, scale: 1.03, duration: 120, ease: 'Sine.easeOut' });
        if (item.description) {
          tooltipTimer?.remove();
          tooltipTimer = scene.time.delayedCall(300, () => {
            if (!sharedTooltip.scene) return;
            sharedTooltip.setText(item.description!);
            sharedTooltip.setAlpha(0);
            scene.tweens.killTweensOf(sharedTooltip);
            scene.tweens.add({ targets: sharedTooltip, alpha: 1, duration: 150, ease: 'Sine.easeOut' });
          });
        }
      });
      bg.on('pointerout', () => {
        bg.setTexture('panel_button');
        scene.tweens.killTweensOf(bg);
        bg.setScale(1);
        tooltipTimer?.remove();
        scene.tweens.killTweensOf(sharedTooltip);
        sharedTooltip.setAlpha(0);
      });
      bg.on('pointerdown', item.onClick);
    }
  });
  return { container };
}

export function createSpeedBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  order: string[],
  currentActorKey: string | undefined,
  enemies: Map<string, EnemyView>,
  playerSpd: number,
): { container: Phaser.GameObjects.Container; update: (order: string[], currentActorKey: string | undefined) => void; destroy: () => void } {
  const container = scene.add.container(x, y).setDepth(10);
  const items: Phaser.GameObjects.GameObject[] = [];

  function build(newOrder: string[], actor: string | undefined) {
    items.forEach((o) => o.destroy());
    items.length = 0;
    newOrder.forEach((key, i) => {
      const isPlayer = key === 'player';
      const isCurrent = key === actor;
      const displayName = isPlayer ? 'You' : enemies.get(key)?.name ?? '?';
      const spd = isPlayer ? playerSpd : enemies.get(key)?.maxHp ?? 0; // rough fallback
      const ix = i * 90;
      const bg = scene.add.circle(ix, 0, 14, isCurrent ? 0xc9a24b : 0x2a2e33)
        .setStrokeStyle(2, isCurrent ? 0xe9c876 : 0x555555, isCurrent ? 1 : 0.3);
      const label = scene.add.text(ix, 0, displayName.slice(0, 4), {
        fontFamily: '"Courier New", monospace', fontSize: '10px', color: isCurrent ? '#0b0d10' : '#9a9488',
      }).setOrigin(0.5);
      items.push(bg, label);
      container.add([bg, label]);
    });
  }

  build(order, currentActorKey);

  return {
    container,
    update: (newOrder: string[], actor: string | undefined) => build(newOrder, actor),
    destroy: () => container.destroy(),
  };
}
