import Phaser from 'phaser';
import { generatePlaceholderTextures, PALETTE } from '@placeholder/PlaceholderTextures';
import { useGameStore } from '@store/gameStore';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { FONT_SERIF } from '@/config';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    for (let i = 1; i <= 5; i++) {
      this.load.image(`map_${i}`, `assets/image_assets/backgrounds/map${i}.jpeg`);
    }
    for (const who of ['player', 'enemy']) {
      for (const state of ['idle', 'attack', 'hit']) {
        this.load.image(`${who}_${state}`, `assets/image_assets/${who}/${state}.png`);
      }
    }
  }

  create() {
    fadeIn(this);
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'entering the hollow…', {
        fontFamily: FONT_SERIF,
        fontSize: '22px',
        color: '#c9a24b',
      })
      .setOrigin(0.5);

    generatePlaceholderTextures(this);
    useGameStore.getState().initFromDisk();

    this.cameras.main.setBackgroundColor(PALETTE.void);
    this.time.delayedCall(300, () => fadeToScene(this, 'Menu'));
  }
}
