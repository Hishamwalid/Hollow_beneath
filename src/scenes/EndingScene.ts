import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { evaluateEnding, getEnding, factionEpilogue } from '@data/endings';
import type { EndingDef } from '@data/types';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { audio } from '@placeholder/PlaceholderAudio';
import { FONT_BODY, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

/**
 * Definitive-edition ending sequences. Three endings, all tragic:
 *   THE HOLLOW / LOST IN THE DARK / THE RETURN.
 * Each plays its scripted beat sequence, then the faction epilogue overlay,
 * then hands off to the credits. No victory fanfare anywhere.
 */
export class EndingScene extends Phaser.Scene {
  private skipKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Ending');
  }

  create(data: { endingId?: string } = {}) {
    this.cameras.main.setBackgroundColor(0x000000);
    fadeIn(this);
    const store = useGameStore.getState();
    const player = store.player;
    if (!player) {
      fadeToScene(this, 'Menu');
      return;
    }

    const ending: EndingDef | undefined = data.endingId ? getEnding(data.endingId) : undefined;
    const resolved = ending ?? evaluateEnding(player);
    if (!ending && !resolved.condition(player)) {
      // Outcome flags missing (shouldn't happen) — fall back by id order.
      void resolved;
    }

    audio.startAmbience('loom');
    this.skipKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.playSequence(resolved);
  }

  /** Runs the ending's staged beats: title → beats → faction epilogue → credits. */
  private playSequence(ending: EndingDef) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const container = this.add.container(0, 0).setDepth(10);

    const titleColor: string =
      ending.id === 'the_hollow' ? PALETTE_HEX.gold : ending.id === 'the_return' ? '#cfd6de' : PALETTE_HEX.danger;

    const title = this.add
      .text(cx, cy - 24, ending.name, { fontFamily: FONT_SERIF, fontSize: '46px', color: titleColor })
      .setOrigin(0.5)
      .setAlpha(0);
    const subtitle = this.add
      .text(cx, cy + 34, ending.tone, { fontFamily: FONT_BODY, fontSize: '17px', color: PALETTE_HEX.boneMuted, fontStyle: 'italic' })
      .setOrigin(0.5)
      .setAlpha(0);
    container.add([title, subtitle]);

    this.tweens.add({
      targets: [title, subtitle],
      alpha: { from: 0, to: 1 },
      duration: 1600,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(2200, () => {
          this.tweens.add({
            targets: container,
            alpha: 0,
            duration: 700,
            onComplete: () => {
              container.destroy();
              this.showEpilogueBeats(ending);
            },
          });
        });
      },
    });
  }

  /** The ending's full narrative text, advanced by click/space. */
  private showEpilogueBeats(ending: EndingDef) {
    const dialogBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setDepth(5);
    const header = this.add
      .text(GAME_WIDTH / 2, 60, ending.name, { fontFamily: FONT_SERIF, fontSize: '22px', color: PALETTE_HEX.boneMuted })
      .setOrigin(0.5)
      .setDepth(11);
    header.setAlpha(0);
    this.tweens.add({ targets: header, alpha: 1, duration: 900 });
    void dialogBg;

    const prompt = this.add
      .text(GAME_WIDTH - 30, GAME_HEIGHT - 26, 'click / SPACE', { fontFamily: FONT_BODY, fontSize: '12px', color: PALETTE_HEX.boneMuted })
      .setOrigin(1, 1)
      .setDepth(11)
      .setAlpha(0.7);

    const lines = ending.epilogue.split('\n');
    let idx = 0;
    let label: Phaser.GameObjects.Text | null = null;

    const advance = () => {
      if (idx >= lines.length) {
        this.input.off('pointerdown', advance);
        this.skipKey?.off('down', advance);
        prompt.destroy();
        header.setAlpha(0.4);
        this.showFactionEpilogue(ending);
        return;
      }
      const line = lines[idx++];
      label?.destroy();
      const isBeatBreak = line.trim() === '';
      label = this.add
        .text(GAME_WIDTH / 2, isBeatBreak ? GAME_HEIGHT / 2 : GAME_HEIGHT / 2, line || '. . .', {
          fontFamily: line.startsWith('EVE') || line.startsWith('THE LOOM') || line.includes('(V.O.)') ? FONT_SERIF : FONT_BODY,
          fontSize: line.startsWith('EVE') || line.startsWith('THE LOOM') ? '20px' : '18px',
          color: line.startsWith('EVE') || line.startsWith('THE LOOM') ? PALETTE_HEX.gold : PALETTE_HEX.bone,
          wordWrap: { width: 900 },
          align: 'center',
          fontStyle: line === '"Keep walking."' ? 'bold' : 'normal',
        })
        .setOrigin(0.5)
        .setDepth(11)
        .setAlpha(0);
      this.tweens.add({ targets: label, alpha: 1, duration: 450, ease: 'Sine.easeOut' });
    };

    this.input.on('pointerdown', advance);
    this.skipKey?.on('down', advance);
    advance();
  }

  /** Faction-colored epilogue overlay — what the surface believes happened. */
  private showFactionEpilogue(ending: EndingDef) {
    const store = useGameStore.getState();
    const player = store.player;
    const overlayText = player ? factionEpilogue(player.faction) : '';

    const veil = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setDepth(20).setInteractive();
    const box = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `${overlayText}\n\n— ${ending.name} —`, {
      fontFamily: FONT_BODY,
      fontSize: '19px',
      color: PALETTE_HEX.boneMuted,
      fontStyle: 'italic',
      align: 'center',
      wordWrap: { width: 860 },
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(21).setAlpha(0);

    this.tweens.add({
      targets: [veil, box],
      alpha: { from: 0, to: 1 },
      duration: 1400,
      onComplete: () => {
        this.time.delayedCall(2600, () => this.finishRun(ending));
      },
    });
  }

  /** Locks the run in (autosave — no going back), then credits. */
  private finishRun(ending: EndingDef) {
    const store = useGameStore.getState();
    store.finalizeRun(ending.id);
    audio.stopAmbience();
    fadeToScene(this, 'Credits', { endingId: ending.id });
  }

}

