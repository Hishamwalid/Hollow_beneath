import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 160, 'THE HOLLOW BENEATH', { fontFamily: FONT_SERIF, fontSize: '52px', color: PALETTE_HEX.gold })
      .setOrigin(0.5);
    this.add
      .text(cx, 210, 'a descent, a translation, a mistake made carefully', {
        fontFamily: FONT_SERIF,
        fontSize: '16px',
        color: PALETTE_HEX.boneMuted,
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    const { meta, loadActiveRun } = useGameStore.getState();
    const canContinue = loadActiveRun();

    this.add
      .text(cx, 270, `Echo Shards: ${meta.echoShards}    Runs: ${meta.totalRuns}    Endings seen: ${meta.endingsAchieved.length}/6`, {
        fontFamily: FONT_SERIF,
        fontSize: '14px',
        color: PALETTE_HEX.boneMuted,
      })
      .setOrigin(0.5);

    let y = 360;
    if (canContinue) {
      createButton(this, cx, y, 'Continue', () => this.scene.start('Board'), { width: 320 });
      y += 70;
    }
    createButton(this, cx, y, 'New Descent', () => this.scene.start('CharacterCreation'), { width: 320 });
    y += 70;
    createButton(this, cx, y, 'Echo Shard Shop', () => this.scene.start('ShardShop'), { width: 320 });

    this.add
      .text(cx, GAME_HEIGHT - 40, 'placeholder build — art & audio pending · Team Akrasia', {
        fontFamily: FONT_SERIF,
        fontSize: '12px',
        color: '#555555',
      })
      .setOrigin(0.5);
  }
}
