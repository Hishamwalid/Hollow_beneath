import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { evaluateEnding } from '@data/endings';
import { createDialogBox } from '@ui/DialogBox';
import { createButton } from '@ui/Button';
import { FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

export class EndingScene extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    const store = useGameStore.getState();
    const player = store.player;
    if (!player) {
      this.scene.start('Menu');
      return;
    }

    const ending = evaluateEnding(player);
    audio.victory();

    this.add.text(GAME_WIDTH / 2, 70, 'PAGE 100', { fontFamily: FONT_SERIF, fontSize: '18px', color: PALETTE_HEX.boneMuted }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 110, ending.name, { fontFamily: FONT_SERIF, fontSize: '40px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 156, ending.tone, {
        fontFamily: FONT_SERIF,
        fontSize: '15px',
        color: PALETTE_HEX.boneMuted,
        fontStyle: 'italic',
        wordWrap: { width: 700 },
        align: 'center',
      })
      .setOrigin(0.5);

    const dialog = createDialogBox(this, GAME_WIDTH / 2, 380, 880, 260);
    dialog.setText(ending.epilogue, () => {
      this.add.text(GAME_WIDTH / 2, 560, `Unlocked: ${ending.unlock}`, { fontFamily: FONT_SERIF, fontSize: '13px', color: PALETTE_HEX.gold }).setOrigin(0.5);
      store.finalizeRun(ending.id);
      createButton(this, GAME_WIDTH / 2, 640, 'Return to the Surface', () => this.scene.start('Menu'), { width: 300 });
    });
    this.input.on('pointerdown', () => dialog.skip());
  }
}
