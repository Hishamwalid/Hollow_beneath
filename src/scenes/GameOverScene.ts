import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { createButton } from '@ui/Button';
import { FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    audio.defeat();
    const meta = useGameStore.getState().meta;

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90, 'The Hollow Keeps You', { fontFamily: FONT_SERIF, fontSize: '36px', color: PALETTE_HEX.danger })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 'You fell before you ever reached a place worth remembering. The Loom notices, briefly, and moves on.', {
        fontFamily: FONT_SERIF,
        fontSize: '15px',
        color: PALETTE_HEX.boneMuted,
        wordWrap: { width: 640 },
        align: 'center',
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, `Echo Shards banked: ${meta.echoShards}    Deaths: ${meta.deathCount}`, {
        fontFamily: FONT_SERIF,
        fontSize: '13px',
        color: PALETTE_HEX.gold,
      })
      .setOrigin(0.5);

    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 110, 'Return to Menu', () => this.scene.start('Menu'), { width: 260 });
  }
}
