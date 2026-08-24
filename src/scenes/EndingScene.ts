import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { evaluateEnding } from '@data/endings';
import { showRunStatsScreen } from '@ui/RunStatsScreen';
import { createDialogBox } from '@ui/DialogBox';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { spawnHealParticles } from '@systems/particles';
import { FONT_BODY, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

export class EndingScene extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const store = useGameStore.getState();
    const player = store.player;
    if (!player) {
      fadeToScene(this, 'Menu');
      return;
    }

    const ending = evaluateEnding(player);
    audio.victory();

    this.time.addEvent({
      delay: 300, loop: true, callback: () => {
        spawnHealParticles(this, Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT * 0.3);
      },
    });

    this.add.text(GAME_WIDTH / 2, 70, 'THE FINAL CHAMBER', { fontFamily: FONT_SERIF, fontSize: '20px', color: PALETTE_HEX.boneMuted }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 110, ending.name, { fontFamily: FONT_SERIF, fontSize: '40px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 160, ending.tone, {
        fontFamily: FONT_BODY,
        fontSize: '17px',
        color: PALETTE_HEX.boneMuted,
        fontStyle: 'italic',
        wordWrap: { width: 720 },
        align: 'center',
      })
      .setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 205, `— ${ending.unlock} —`, { fontFamily: FONT_SERIF, fontSize: '14px', color: PALETTE_HEX.gold, fontStyle: 'italic' }).setOrigin(0.5);

    const dialog = createDialogBox(this, GAME_WIDTH / 2, 380, 880, 260);
    dialog.setText(ending.epilogue, () => {
      store.finalizeRun(ending.id);
      const meta = useGameStore.getState().meta;
      if (meta.lastRunStats) {
        showRunStatsScreen(
          this,
          meta.lastRunStats,
          false,
          () => fadeToScene(this, 'Menu'),
          () => fadeToScene(this, 'LoreCodex'),
        );
      } else {
        fadeToScene(this, 'Menu');
      }
    });
    this.input.on('pointerdown', () => dialog.skip());
  }
}
