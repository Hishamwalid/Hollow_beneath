import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { createButton } from '@ui/Button';
import { FONT_BODY, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { createTitle } from '@ui/headings';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

/**
 * "The Offer" — shown when the player falls to the Final Reflection.
 * Not a Game Over. A choice: become part of the architecture, or climb
 * home to forget. Both paths are endings. There is no third option.
 */
export class TheOfferScene extends Phaser.Scene {
  constructor() {
    super('TheOffer');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x000000);
    fadeIn(this);
    const cx = GAME_WIDTH / 2;

    createTitle(this, cx, 120, 'THE FINAL CHAMBER', { size: '20px', color: PALETTE_HEX.boneMuted });

    this.add
      .text(cx, GAME_HEIGHT / 2 - 150,
        'Broken. Kneeling. The Reflection stands over you — wearing your face with an expression you have never seen in a mirror.\n\nIt does not strike the killing blow.',
        { fontFamily: FONT_BODY, fontSize: '17px', color: PALETTE_HEX.bone, align: 'center', wordWrap: { width: 860 }, lineSpacing: 6 })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT / 2 - 20,
        'THE FINAL REFLECTION: "You cannot win. But you do not have to become me."',
        { fontFamily: FONT_SERIF, fontSize: '21px', color: PALETTE_HEX.gold, align: 'center', wordWrap: { width: 820 } })
      .setOrigin(0.5);

    // Choice A — accept the dark.
    createButton(this, cx - 190, GAME_HEIGHT - 170, 'Accept the dark.', () => this.choose('dark'), {
      width: 320, height: 56, fontSize: '17px',
    }).container.setDepth(10);
    this.add
      .text(cx - 190, GAME_HEIGHT - 128, 'Sink into the stone. Become part of the architecture.',
        { fontFamily: FONT_BODY, fontSize: '13px', color: PALETTE_HEX.boneMuted })
      .setOrigin(0.5);

    // Choice B — climb.
    createButton(this, cx + 190, GAME_HEIGHT - 170, 'Climb to the surface.', () => this.choose('climb'), {
      width: 320, height: 56, fontSize: '17px',
    }).container.setDepth(10);
    this.add
      .text(cx + 190, GAME_HEIGHT - 128, 'Go home. Live. Forget. The same fate as Eve\'s.',
        { fontFamily: FONT_BODY, fontSize: '13px', color: PALETTE_HEX.boneMuted })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT - 60,
        'This choice is final. It cannot be undone.',
        { fontFamily: FONT_BODY, fontSize: '12px', color: PALETTE_HEX.danger, fontStyle: 'italic' })
      .setOrigin(0.5);
  }

  private choose(which: 'dark' | 'climb') {
    const store = useGameStore.getState();
    const player = store.player;
    if (player) {
      player.flags.final_reflection_lost = true;
      if (which === 'dark') player.flags.ending_choice_dark = true;
      else player.flags.ending_choice_climb = true;
      store.persist(); // lock-in autosave — no save-scumming past this point
    }
    fadeToScene(this, 'Ending', { endingId: which === 'dark' ? 'lost_in_the_dark' : 'the_return' });
  }
}
