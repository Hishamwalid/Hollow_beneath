import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { showRunStatsScreen } from '@ui/RunStatsScreen';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { spawnHitParticles } from '@systems/particles';
import { FONT_BODY, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x1a0808);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x330000, 0.15);
    fadeIn(this);
    audio.defeat();
    this.time.addEvent({
      delay: 400, loop: true, callback: () => {
        spawnHitParticles(this, Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT * 0.5);
      },
    });
    const store = useGameStore.getState();
    const meta = store.meta;

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90, 'The Hollow Keeps You', { fontFamily: FONT_SERIF, fontSize: '36px', color: PALETTE_HEX.danger })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 'You fell before you ever reached a place worth remembering. The Loom notices, briefly, and moves on.', {
        fontFamily: FONT_BODY,
        fontSize: '17px',
        color: PALETTE_HEX.boneMuted,
        wordWrap: { width: 660 },
        align: 'center',
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, `Echo Shards banked: ${meta.echoShards}    Deaths: ${meta.deathCount}`, {
        fontFamily: FONT_BODY,
        fontSize: '15px',
        color: PALETTE_HEX.gold,
      })
      .setOrigin(0.5);

    this.time.delayedCall(1200, () => {
      if (!meta.lastRunStats) return;
      showRunStatsScreen(
        this,
        meta.lastRunStats,
        true,
        () => fadeToScene(this, 'Menu'),
        () => fadeToScene(this, 'LoreCodex'),
      );
    });
  }
}
