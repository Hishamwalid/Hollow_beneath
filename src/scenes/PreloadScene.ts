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
      this.load.image(`map_${i}`, `assets/image_assets/backgrounds/map${i}.png`);
    }
    for (const state of ['idle', 'windup', 'attack', 'hit', 'victory', 'defeated', 'guard']) {
      this.load.image(`player_${state}`, `assets/image_assets/player/${state}.png`);
    }
    this.load.image('player_face', 'assets/image_assets/player/face.png');
    for (const enemyId of ['echo_skeleton', 'dust_wight']) {
      for (const state of ['idle', 'attack', 'hit']) {
        this.load.image(`enemy_${enemyId}_${state}`, `assets/image_assets/enemy/${enemyId}/${state}.png`);
      }
      this.load.image(`enemy_${enemyId}_face`, `assets/image_assets/enemy/${enemyId}/face.png`);
    }
    for (const state of ['idle', 'attack', 'hit']) {
      this.load.image(`enemy_${state}`, `assets/image_assets/enemy/${state}.png`);
    }
    for (const frame of ['idle1', 'idle2', 'attack1', 'attack2', 'hit1', 'hit2', 'guard1', 'victory1', 'victory2', 'transform1', 'transform2', 'defeat1', 'defeat2', 'defeat3']) {
      this.load.image(`enemy_sentinel_${frame}`, `assets/image_assets/enemy/sentinel/${frame}.png`);
    }
    this.load.image('enemy_sentinel_face1', 'assets/image_assets/enemy/sentinel/face1.png');
    this.load.image('enemy_sentinel_face2', 'assets/image_assets/enemy/sentinel/face2.png');
    this.load.image('enemy_sentinel_half', 'assets/image_assets/enemy/sentinel/half.png');
    this.load.image('bg_combat_stage1_sand', 'assets/image_assets/backgrounds/combat_stage1_sand.png');
    this.load.image('bg_combat_stage1_stone', 'assets/image_assets/backgrounds/combat_stage1_stone.png');
    this.load.image('bg_combat_stage1_boss', 'assets/image_assets/backgrounds/combat_stage1_boss.png');
    this.load.image('player_pin', 'assets/image_assets/player/player_pin.png');
    this.load.image('panel_book', 'assets/image_assets/ui/panel_book.png');
    this.load.image('token_7', 'assets/image_assets/ui/token_7.png');
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
