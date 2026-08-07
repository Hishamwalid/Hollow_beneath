import Phaser from 'phaser';
import type { EnemyView } from '@systems/CombatEngine';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX, SZ } from './uiTheme';
import { weaknessLabel } from '@data/damageTypes';
import { statusLabel } from '@data/statusEffects';
import { intentLine } from '@systems/combat/IntentSystem';
import { GAME_WIDTH } from '@/config';

export interface EnemyDisplay {
  container: Phaser.GameObjects.Container;
  update: (view: EnemyView) => void;
  setSelected: (v: boolean) => void;
  setState: (state: 'idle' | 'attack' | 'hit') => void;
  destroy: () => void;
}

const CARD_W = 150;
const CARD_H = 240;

export function createEnemyDisplay(
  scene: Phaser.Scene,
  x: number,
  y: number,
  textureKey: string,
  onClick: () => void,
): EnemyDisplay {
  const container = scene.add.container(x, y).setDepth(5);
  const panelBg = scene.add.image(0, CARD_H / 2 - 20, 'panel_enemy').setDisplaySize(CARD_W, CARD_H).setAlpha(0.85).setInteractive({ useHandCursor: true });
  const token = scene.add.image(0, -10, 'enemy_idle');
  token.setDisplaySize(96, 124).setInteractive({ useHandCursor: true });
  const nameText = scene.add
    .text(0, 58, '', {
      fontFamily: FONT_SERIF,
      fontSize: SZ.sm,
      color: PALETTE_HEX.bone,
      wordWrap: { width: CARD_W - 16 },
      align: 'center',
    })
    .setOrigin(0.5, 0);
  const hpBg = scene.add.rectangle(0, 78, CARD_W - 26, 9, 0x2a2e33);
  const hpFg = scene.add.rectangle(-(CARD_W - 26) / 2, 78, CARD_W - 26, 9, 0xb0453f).setOrigin(0, 0.5);
  const hpText = scene.add
    .text(0, 92, '', { fontFamily: FONT_MONO, fontSize: SZ.xs, color: PALETTE_HEX.bone })
    .setOrigin(0.5, 0);
  const affinityText = scene.add
    .text(0, 112, '', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.gold, align: 'center' })
    .setOrigin(0.5, 0);
  const statsText = scene.add
    .text(0, 152, '', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.boneMuted, align: 'center' })
    .setOrigin(0.5, 0);
  const statusText = scene.add
    .text(0, 184, '', {
      fontFamily: FONT_BODY,
      fontSize: '14px',
      color: '#e67e22',
      align: 'center',
      wordWrap: { width: CARD_W - 12 },
    })
    .setOrigin(0.5, 0);
  const intentText = scene.add
    .text(0, 204, '', {
      fontFamily: FONT_MONO,
      fontSize: '11px',
      color: PALETTE_HEX.gold,
      align: 'center',
      wordWrap: { width: CARD_W - 10 },
    })
    .setOrigin(0.5, 0);
  const windowBadge = scene.add
    .text(0, 72, '', { fontFamily: FONT_MONO, fontSize: '11px', color: '#e9c876', fontStyle: 'bold', align: 'center' })
    .setOrigin(0.5, 0.5)
    .setAlpha(0);
  const badgeGlow = scene.tweens.add({
    targets: windowBadge,
    alpha: { from: 0, to: 1 },
    duration: 500,
    yoyo: true,
    repeat: -1,
  });
  const diamond = scene.add.graphics({ x: 0, y: -88 });
  diamond.fillStyle(0xffd700, 1);
  diamond.fillPoints([
    { x: 0, y: -12 },
    { x: 12, y: 0 },
    { x: 0, y: 12 },
    { x: -12, y: 0 },
  ], true);
  diamond.setVisible(false);
  container.add([panelBg, token, nameText, hpBg, hpFg, hpText, affinityText, statsText, statusText, intentText, windowBadge, diamond]);
  panelBg.on('pointerdown', onClick);
  token.on('pointerdown', onClick);
  token.on('pointerover', () => { if (!selected) token.setScale(1.06); });
  token.on('pointerout', () => { if (!selected) token.setScale(1); });

  const setState = (state: 'idle' | 'attack' | 'hit') => {
    if (scene.textures.exists(`enemy_${state}`)) token.setTexture(`enemy_${state}`);
    if (state === 'hit') {
      token.setTint(0xff3b30);
    } else {
      token.clearTint();
    }
  };

  let selected = false;
  let diamondTween: Phaser.Tweens.Tween | undefined;
  const setSelected = (v: boolean) => {
    if (selected === v) return;
    selected = v;
    if (v) {
      diamond.setVisible(true);
      diamondTween = scene.tweens.add({
        targets: diamond,
        y: { from: -88, to: -96 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      diamond.setVisible(false);
      if (diamondTween) { diamondTween.stop(); diamondTween = undefined; }
      diamond.y = -88;
    }
  };

  return {
    container,
    update: (view: EnemyView) => {
      container.setVisible(view.alive);
      nameText.setText(view.tendency ? `${view.tendency} ${view.name}` : view.name);
      const pct = Math.max(0, view.hp / view.maxHp);
      hpFg.width = (CARD_W - 26) * pct;
      hpText.setText(`${view.hp}/${view.maxHp}`);
      if (view.weakWindowTurns > 0) {
        windowBadge.setText(`WEAK WINDOW (${view.weakWindowTurns})`);
        windowBadge.setAlpha(1).setX(0);
        token.setTint(0xc9a24b);
      } else {
        windowBadge.setAlpha(0);
        token.clearTint();
      }
      if (view.revealed) {
        const entries = Object.entries(view.affinities)
          .filter(([, v]) => v !== 1)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, view.investigationLayer >= 4 ? 8 : view.revealCount)
          .map(([t, v]) => `${t}: ${weaknessLabel(v as number)}`);
        affinityText.setText(entries.join('  '));
        statsText.setText(`ATK ${view.atk} | DEF ${view.def} | SPD ${view.spd}`);
      } else {
        affinityText.setText('');
        statsText.setText('');
      }
      statusText.setText(view.statuses.map((s) => statusLabel(s.id)).join(', '));
      if (view.pendingIntent) {
        intentText.setText(intentLine(view.pendingIntent.label, view.investigationLayer, false));
        intentText.setColor(view.investigationLayer >= 2 ? '#e9c876' : PALETTE_HEX.boneMuted);
      } else {
        intentText.setText(view.investigationLayer >= 1 ? '(already moved this round)' : 'intentions unreadable');
        intentText.setColor(PALETTE_HEX.boneMuted);
      }
    },
    setSelected,
    setState,
    destroy: () => { if (diamondTween) diamondTween.stop(); badgeGlow.stop(); container.destroy(); },
  };
}

export function createApPips(scene: Phaser.Scene, x: number, y: number): { update: (ap: number, banked: number) => void; destroy: () => void } {
  const container = scene.add.container(x, y);
  const label = scene.add.text(-16, -14, 'AP', { fontFamily: FONT_MONO, fontSize: SZ.sm, color: PALETTE_HEX.boneMuted }).setOrigin(1, 0.5);
  container.add(label);
  const dots: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < 5; i++) {
    const d = scene.add.circle(i * 26, 0, 10, 0x2a2e33).setStrokeStyle(2, 0xc9a24b);
    dots.push(d);
    container.add(d);
  }
  const reserveText = scene.add.text(-16, 26, '', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.gold }).setOrigin(1, 0.5);
  container.add(reserveText);
  return {
    update: (ap: number, banked: number) => {
      dots.forEach((d, i) => d.setFillStyle(i < ap ? 0xc9a24b : 0x2a2e33));
      reserveText.setText(banked > 0 ? `RES ${banked}` : '');
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
  const w = GAME_WIDTH < 1000 ? 120 : 148;
  const h = 56;
  let tooltipTimer: Phaser.Time.TimerEvent | null = null;

  items.forEach((item, i) => {
    const bx = i * (w + 8);
    const bg = scene.add.image(bx, 0, 'panel_button').setDisplaySize(w, h);
    if (item.disabled) bg.setAlpha(0.4);
    const label = scene.add
      .text(bx, -8, item.label, { fontFamily: FONT_SERIF, fontSize: SZ.sm, color: item.disabled ? PALETTE_HEX.boneMuted : PALETTE_HEX.bone })
      .setOrigin(0.5);
    const costText = scene.add
      .text(bx, 16, `${item.apCost} AP`, { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.gold })
      .setOrigin(0.5);
    container.add([bg, label, costText]);
    if (!item.disabled) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => {
        bg.setTexture('panel_button_hover');
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
      const ix = i * 78;
      const bg = scene.add.circle(ix, 0, 13, isCurrent ? 0xc9a24b : 0x2a2e33)
        .setStrokeStyle(2, isCurrent ? 0xe9c876 : 0x555555, isCurrent ? 1 : 0.3);
      const label = scene.add.text(ix, 0, displayName.slice(0, 5), {
        fontFamily: FONT_MONO, fontSize: '11px', color: isCurrent ? '#0b0d10' : '#9a9488',
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