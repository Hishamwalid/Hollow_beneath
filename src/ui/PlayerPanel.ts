import Phaser from 'phaser';
import type { PlayerState } from '@data/types';
import { FONT_MONO, FONT_SERIF, PALETTE_HEX } from './uiTheme';

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
      scene.tweens.add({ targets: fg, width: targetWidth, duration: 300, ease: 'Sine.easeOut' });
    },
  };
}

export interface PlayerPanelHandle {
  container: Phaser.GameObjects.Container;
  update: (player: PlayerState) => void;
  destroy: () => void;
}

/** Compact "THE PLAYER" identity card used on the board HUD: portrait, level/class, points, vitals. */
export function createPlayerPanel(scene: Phaser.Scene, x: number, y: number, width = 214, height = 300): PlayerPanelHandle {
  const container = scene.add.container(x, y).setDepth(10);
  const bg = scene.add.rectangle(width / 2, height / 2, width, height, 0x16191d, 0.94).setStrokeStyle(1, 0xc9a24b, 0.6);
  container.add(bg);

  container.add(scene.add.text(width / 2, 14, 'THE PLAYER', {
    fontFamily: FONT_SERIF, fontSize: '18px', color: PALETTE_HEX.bone,
  }).setOrigin(0.5, 0));

  const portraitSize = width - 32;
  const portraitY = 42;
  container.add(scene.add.rectangle(width / 2, portraitY + portraitSize / 2, portraitSize, portraitSize, 0x22262c).setStrokeStyle(1, 0x3a3f46));
  container.add(scene.add.image(width / 2, portraitY + portraitSize / 2, 'icon_character').setDisplaySize(portraitSize * 0.55, portraitSize * 0.55).setTint(0x7fb0c9));

  const infoY = portraitY + portraitSize + 14;
  const levelText = scene.add.text(16, infoY, 'Level 1', { fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.gold });
  const skillsText = scene.add.text(width - 16, infoY, '', { fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.boneMuted }).setOrigin(1, 0);
  const shardsText = scene.add.text(16, infoY + 20, 'Echo Shards: 0', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.gold });
  container.add([levelText, skillsText, shardsText]);

  const barsY = infoY + 64;
  const barW = width - 92;
  const labelX = 42;
  const valueX = width - 16;

  const hpLabel = scene.add.text(16, barsY, 'HP', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.bone });
  const hpBar = bar(scene, container, labelX, barsY + 6, barW, 12, 0xb0453f);
  const hpText = scene.add.text(valueX, barsY - 2, '', { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.bone }).setOrigin(1, 0);

  const mpLabel = scene.add.text(16, barsY + 26, 'MP', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.bone });
  const mpBar = bar(scene, container, labelX, barsY + 32, barW, 10, 0x4a6fa5);
  const mpText = scene.add.text(valueX, barsY + 24, '', { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.bone }).setOrigin(1, 0);

  const resLabel = scene.add.text(16, barsY + 50, 'Resonance', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.bone });
  const resBar = bar(scene, container, labelX, barsY + 58, barW, 10, 0x9b59b6);
  const resText = scene.add.text(valueX, barsY + 48, '', { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.gold }).setOrigin(1, 0);

  container.add([hpLabel, hpText, mpLabel, mpText, resLabel, resText]);

  return {
    container,
    update: (player: PlayerState) => {
      levelText.setText(`Level: ${player.level}`);
      skillsText.setText(`Loadout ${player.equippedSkills.length}/6`);
      shardsText.setText(`Echo Shards: ${player.echoShards}`);
      hpBar.setPct(player.currentHP / Math.max(1, player.derived.maxHP));
      hpText.setText(`${player.currentHP}/${player.derived.maxHP}`);
      mpBar.setPct(player.currentMP / Math.max(1, player.derived.maxMP));
      mpText.setText(`${player.currentMP}/${player.derived.maxMP}`);
      resBar.setPct(Math.max(0, Math.min(1, player.resonance / 100)));
      resText.setText(`${Math.round(player.resonance)}`);
    },
    destroy: () => container.destroy(),
  };
}
