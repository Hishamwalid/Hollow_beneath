import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { showRunStatsScreen } from '@ui/RunStatsScreen';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { FONT_BODY, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

/**
 * Credits sequence — over black, the voice, wind over stone.
 * "But freedom isn't the same as escape."
 */
export class CreditsScene extends Phaser.Scene {
  private lines = [
    { text: '"The Deep stares at you. The emotion in its gaze is the comfort of freedom itself."', font: FONT_SERIF, size: '22px', color: PALETTE_HEX.gold },
    { text: '', font: FONT_BODY, size: '16px', color: PALETTE_HEX.boneMuted },
    { text: '(a different tone — not from the journal, but from memory, or from the Loom itself)', font: FONT_BODY, size: '13px', color: PALETTE_HEX.boneMuted },
    { text: 'But freedom isn\'t the same as escape.', font: FONT_SERIF, size: '20px', color: PALETTE_HEX.bone },
    { text: '', font: FONT_BODY, size: '14px', color: PALETTE_HEX.boneMuted },
    { text: 'THE HOLLOW BENEATH', font: FONT_SERIF, size: '18px', color: PALETTE_HEX.boneMuted },
  ];

  constructor() {
    super('Credits');
  }

  create(data: { endingId?: string } = {}) {
    this.cameras.main.setBackgroundColor(0x000000);
    fadeIn(this);
    void data;

    const cx = GAME_WIDTH / 2;
    let y = GAME_HEIGHT + 80;
    for (const line of this.lines) {
      if (line.text !== '') {
        const t = this.add
          .text(cx, y, line.text, { fontFamily: line.font, fontSize: line.size, color: line.color, wordWrap: { width: 860 }, align: 'center' })
          .setOrigin(0.5);
        y += Number(parseInt(line.size) + 34);
      } else {
        y += 30;
      }
    }

    // Scroll the credits up slowly; when past the top, finish.
    const contentHeight = y;
    const scroll = this.tweens.add({
      targets: this.children.list,
      y: `-=${contentHeight + GAME_HEIGHT}`,
      duration: contentHeight * 90,
      ease: 'Linear',
    });
    scroll.on('complete', () => this.finish());

    this.input.once('pointerdown', () => {
      this.tweens.killAll();
      this.finish();
    });
  }

  private finish() {
    const store = useGameStore.getState();
    const meta = useGameStore.getState().meta;
    if (meta.lastRunStats) {
      showRunStatsScreen(
        this,
        meta.lastRunStats,
        false,
        () => fadeToScene(this, 'Menu'),
        () => fadeToScene(this, 'LoreCodex'),
      );
      void store;
    } else {
      fadeToScene(this, 'Menu');
    }
  }
}
