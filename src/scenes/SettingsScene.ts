import Phaser from 'phaser';
import { FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, 80, 'Settings', { fontFamily: FONT_SERIF, fontSize: '34px', color: PALETTE_HEX.gold }).setOrigin(0.5);

    const soundBtn = createButton(this, cx, 220, audio.muted ? 'Sound: OFF' : 'Sound: ON', () => {
      audio.setMuted(!audio.muted);
      soundBtn.container.destroy();
      this.scene.restart();
    }, { width: 280 });

    createButton(this, cx, GAME_HEIGHT - 100, 'Back', () => fadeToScene(this, 'Menu'), { width: 200 });
  }
}
