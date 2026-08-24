import Phaser from 'phaser';
import { FONT_BODY, FONT_SERIF, PALETTE_HEX } from './uiTheme';
import { settingsManager } from '@systems/SettingsManager';

export interface DialogBox {
  container: Phaser.GameObjects.Container;
  /** Types out a single passage. */
  setText: (text: string, onDone?: () => void) => void;
  /**
   * Journal mode: queues several beats (paragraphs). Click/skip completes the
   * current beat first, then advances; onDone fires after the LAST beat.
   */
  setBeats: (beats: string[], onDone?: () => void) => void;
  /** Optional speaker nameplate (e.g. "EVE (V.O.)"). */
  setSpeaker: (name: string | null) => void;
  skip: () => void;
  destroy: () => void;
}

export interface DialogOptions {
  /** Parchment journal sheet (default) or dark stone plate. */
  variant?: 'parchment' | 'dark';
}

/**
 * Narration panel. Default look is an aged parchment sheet with ink text —
 * the page the player is writing as they descend.
 */
export function createDialogBox(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width = 760,
  height = 200,
  opts: DialogOptions = {},
): DialogBox {
  const parchment = (opts.variant ?? 'parchment') === 'parchment';

  const shadow = scene.add.rectangle(5, 7, width, height, 0x000000, parchment ? 0.45 : 0.3);
  const bg = scene.add.nineslice(0, 0, parchment ? 'paper_panel' : 'panel_dialog', undefined, width, height, parchment ? 24 : 12, parchment ? 24 : 12, parchment ? 24 : 12, parchment ? 24 : 12);
  const inkColor = parchment ? PALETTE_HEX.ink : PALETTE_HEX.bone;
  const promptColor = parchment ? PALETTE_HEX.oxide : PALETTE_HEX.gold;

  const text = scene.add.text(-width / 2 + 30, -height / 2 + 22, '', {
    fontFamily: FONT_BODY,
    fontSize: '19px',
    color: inkColor,
    wordWrap: { width: width - 60 },
    lineSpacing: 8,
  });

  const prompt = scene.add
    .text(width / 2 - 22, height / 2 - 18, '▾', { fontFamily: FONT_BODY, fontSize: '18px', color: promptColor })
    .setOrigin(1)
    .setVisible(false);

  // Speaker nameplate — a small tab overlapping the top edge.
  let nameplateBg: Phaser.GameObjects.Rectangle | null = null;
  let nameplate: Phaser.GameObjects.Text | null = null;

  const container = scene.add.container(x, y, [shadow, bg, text, prompt]);
  // Render order [shadow, bg, text, prompt] is already correct — do NOT
  // bringToTop(bg) here; that moves the parchment above the text and hides it.
  container.setDepth(30);
  container.setAlpha(0);
  scene.tweens.add({ targets: container, alpha: 1, duration: 240, ease: 'Sine.easeOut' });

  let fullText = '';
  let charIndex = 0;
  let timer: Phaser.Time.TimerEvent | null = null;
  let doneCallback: (() => void) | undefined;

  // Beat queue state.
  let beats: string[] = [];
  let beatIndex = 0;
  let beatsDone: (() => void) | undefined = undefined;
  let inBeats = false;

  function tick() {
    charIndex += 1;
    text.setText(fullText.slice(0, charIndex));
    if (charIndex >= fullText.length) {
      timer?.remove();
      timer = null;
      prompt.setVisible(true);
      doneCallback?.();
    }
  }

  function startType(t: string, onDone?: () => void) {
    fullText = t;
    charIndex = 0;
    doneCallback = onDone;
    prompt.setVisible(false);
    text.setText('');
    timer?.remove();
    // Guard against corrupted settings (null/string) producing NaN delays that
    // silently kill the typewriter — the known cause of empty dialog boxes.
    const rawSpeed = Number(settingsManager.get().textSpeed);
    const spd = Number.isFinite(rawSpeed) && rawSpeed > 0 ? Math.max(20, rawSpeed) : 100;
    const delay = Math.round(14 * (100 / spd));
    timer = scene.time.addEvent({ delay: Number.isFinite(delay) && delay > 0 ? delay : 14, callback: tick, loop: true });
    // Self-diagnostic: if nothing has rendered after 900ms the timer is dead.
    scene.time.delayedCall(900, () => {
      if (timer && charIndex === 0) {
        console.error('[DialogBox] Typewriter stalled — textSpeed:', settingsManager.get().textSpeed, 'text:', t.slice(0, 60));
        text.setText(t); // fail visible rather than blank
        prompt.setVisible(true);
      }
    });
  }

  return {
    container,
    setText: (t, onDone) => {
      inBeats = false;
      beats = [];
      startType(t, onDone);
    },
    setBeats: (b, onDone) => {
      beats = b.filter((s) => s.trim().length > 0);
      beatIndex = 0;
      beatsDone = onDone;
      // Prevent a repeated doneCallback from firing showChoices twice.
      let beatsFinished = false;
      inBeats = beats.length > 0;
      if (!inBeats) {
        onDone?.();
        return;
      }
      const beatCb = (i: number) =>
        i >= beats.length - 1
          ? () => {
              if (!beatsFinished) {
                beatsFinished = true;
                beatsDone?.();
              }
            }
          : undefined;
      startType(beats[0], beatCb(0));
    },
    setSpeaker: (name) => {
      if (nameplate) { nameplate.destroy(); nameplate = null; }
      if (nameplateBg) { nameplateBg.destroy(); nameplateBg = null; }
      if (!name) return;
      nameplateBg = scene.add.rectangle(-width / 2 + 96, -height / 2 + 4, 170, 26, parchment ? 0xd9cdb0 : 0x22262c)
        .setStrokeStyle(1, parchment ? 0xb9ab88 : 0xc9a24b, 0.9);
      nameplate = scene.add.text(-width / 2 + 96, -height / 2 + 3, name.toUpperCase(), {
        fontFamily: FONT_SERIF,
        fontSize: '13px',
        color: parchment ? PALETTE_HEX.oxide : PALETTE_HEX.gold,
      }).setOrigin(0.5);
      if (typeof nameplate.setLetterSpacing === 'function') nameplate.setLetterSpacing(2);
      container.add([nameplateBg, nameplate]);
    },
    skip: () => {
      // Finish the current typing...
      if (timer) {
        timer.remove();
        timer = null;
        charIndex = fullText.length;
        text.setText(fullText);
        prompt.setVisible(true);
        doneCallback?.();
        return;
      }
      // ...or advance to the next queued beat.
      if (inBeats && beatIndex < beats.length - 1) {
        beatIndex += 1;
        const beatCb = (i: number) => (i >= beats.length - 1 ? () => beatsDone?.() : undefined);
        startType(beats[beatIndex], beatCb(beatIndex));
      }
    },
    destroy: () => {
      timer?.remove();
      container.destroy();
    },
  };
}
