import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { evaluateEnding, getEnding, factionEpilogue } from '@data/endings';
import type { EndingDef, PlayerState } from '@data/types';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { audio } from '@placeholder/PlaceholderAudio';
import { FONT_BODY, FONT_SERIF, PALETTE_HEX, proseScale } from '@ui/uiTheme';
import { createVignette, type VignetteKind } from '@ui/vignettes';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

/** Each ending gets the backdrop its fate deserves. */
function vignetteFor(endingId: string): VignetteKind {
  if (endingId === 'lost_in_the_dark') return 'tunnel';
  if (endingId === 'the_return') return 'return';
  return 'veil'; // THE HOLLOW — and any fallback
}

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
    // The fate staged behind its own words.
    createVignette(this, vignetteFor(resolved.id), { depth: 3 });

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

  /**
   * Conditional epilogue lines — the run's specific kindnesses and cruelties
   * braided into the ending's spine, so no two witnessed fates read alike.
   */
  private personalize(ending: EndingDef, player: PlayerState): string {
    const extras: string[] = [];
    const push = (s: string) => extras.push('', s);
    if (ending.id === 'the_return') {
      if (player.story.motherJournalFound) {
        push('In your pack: her first journal, still warm from the Archive Depths. You will never open it again. Some doors are kinder left as walls.');
      }
      if (player.flags.read_nineteenth_marker) {
        push('Somewhere on the nineteenth waystone, a carved postscript is already going soft with age: "For my child." It was never addressed to anyone else.');
      }
    }
    if (ending.id === 'the_hollow') {
      if (player.flags.wrote_own_page) {
        push('Among the throne-room dust lies one loose page in your own handwriting. Three words at the top — "For the next one." You leave it where the next one will find it.');
      }
      if ((player.story.eveVoiceHeard ?? 0) >= 3) {
        push('You can still hear her. That is the part no one warns you about. Guardians are not supposed to keep the voices they replace.');
      }
    }
    if (ending.id === 'lost_in_the_dark' && player.flags.mercy_to_dominion_soldier) {
      push('The stone accepts you the way you once accepted a broken soldier\'s gratitude: gently, and without needing to understand it.');
    }
    return ending.epilogue + (extras.length ? '\n' + extras.join('\n') : '');
  }

  /** The ending's full narrative text, advanced by click/space. */
  private showEpilogueBeats(ending: EndingDef) {
    const store = useGameStore.getState();
    const player = store.player;
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

    const lines = (player ? this.personalize(ending, player) : ending.epilogue).split('\n');
    let idx = 0;
    let label: Phaser.GameObjects.Text | null = null;
    // Optional timed auto-advance — toggle with A. Off by default.
    let autoOn = false;
    let autoTimer: Phaser.Time.TimerEvent | null = null;
    const autoBadge = this.add
      .text(30, GAME_HEIGHT - 26, 'A · auto-advance', { fontFamily: FONT_BODY, fontSize: '12px', color: PALETTE_HEX.boneMuted })
      .setOrigin(0, 1)
      .setDepth(11)
      .setAlpha(0.55);

    const clearAuto = () => { if (autoTimer) { autoTimer.remove(); autoTimer = null; } };
    const scheduleAuto = () => {
      clearAuto();
      if (!autoOn) return;
      const words = (label?.text ?? '').trim().split(/\s+/).filter(Boolean).length;
      const wait = Phaser.Math.Clamp(words * 300, 2200, 5600);
      autoTimer = this.time.delayedCall(wait, () => advance());
    };

    const advance = () => {
      clearAuto();
      if (idx >= lines.length) {
        this.input.off('pointerdown', advance);
        this.skipKey?.off('down', advance);
        this.input.keyboard?.off('keydown-A', toggleAuto);
        prompt.destroy();
        autoBadge.destroy();
        header.setAlpha(0.4);
        this.showFactionEpilogue(ending);
        return;
      }
      const line = lines[idx++];
      label?.destroy();
      const isBeatBreak = line.trim() === '';
      label = this.add
        .text(GAME_WIDTH / 2, isBeatBreak ? GAME_HEIGHT / 2 : GAME_HEIGHT / 2, line || '. . .', {
          fontFamily: line.startsWith('EVE') || line.startsWith('THE LOOM') ? FONT_SERIF : FONT_BODY,
          fontSize: `${Math.round((line.startsWith('EVE') || line.startsWith('THE LOOM') ? 20 : 18) * proseScale())}px`,
          color: line.startsWith('EVE') || line.startsWith('THE LOOM') ? PALETTE_HEX.gold : PALETTE_HEX.bone,
          wordWrap: { width: 900 },
          align: 'center',
          fontStyle: line === '"Keep walking."' ? 'bold' : 'normal',
        })
        .setOrigin(0.5)
        .setDepth(11)
        .setAlpha(0);
      this.tweens.add({ targets: label, alpha: 1, duration: 450, ease: 'Sine.easeOut' });
      scheduleAuto();
    };

    const toggleAuto = () => {
      autoOn = !autoOn;
      audio.click();
      autoBadge.setText(autoOn ? 'AUTO ▸ on (A)' : 'A · auto-advance');
      autoBadge.setAlpha(autoOn ? 0.95 : 0.55);
      if (autoOn) scheduleAuto();
      else clearAuto();
    };
    this.input.keyboard?.on('keydown-A', toggleAuto);

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
    // The Mirror Unfinished can only be read at the very end — grant it here so
    // codex completion stays possible on every route to every ending.
    const player = store.player;
    if (player && ending.id !== 'the_silence' && !player.loreFragments.includes('final_reflection')) {
      player.loreFragments.push('final_reflection');
    }
    store.finalizeRun(ending.id);
    audio.stopAmbience();
    fadeToScene(this, 'Credits', { endingId: ending.id });
  }

}

