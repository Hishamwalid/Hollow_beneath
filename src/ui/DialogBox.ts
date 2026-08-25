import Phaser from 'phaser';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX } from './uiTheme';
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
  /** Optional speaker nameplate (e.g. "THE VOICE"). */
  setSpeaker: (name: string | null) => void;
  /** Current sheet height (dynamic — sized to fit the text, capped at ~5 lines). */
  getHeight: () => number;
  skip: () => void;
  destroy: () => void;
}

export interface DialogOptions {
  /** Parchment journal sheet (default) or dark stone plate. */
  variant?: 'parchment' | 'dark';
  /** Called whenever the sheet re-sizes (dynamic height). */
  onResize?: (height: number) => void;
}

const MIN_H = 128;
const MAX_H = 190; // ~5 body lines at 19px + line spacing

/**
 * Narration panel. Default look is an aged parchment sheet with ink text —
 * the page the player is writing as they descend. The sheet dynamically
 * shrinks/grows to fit its text (max ~5 lines) so buttons and choices can
 * tuck right under it.
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
  let curH = height;

  function makeBg(h: number): Phaser.GameObjects.NineSlice {
    return scene.add.nineslice(0, 0, parchment ? 'paper_panel' : 'panel_dialog', undefined, width, h, parchment ? 24 : 12, parchment ? 24 : 12, parchment ? 24 : 12, parchment ? 24 : 12);
  }

  const shadow = scene.add.rectangle(5, 7, width, height, 0x000000, parchment ? 0.45 : 0.3);
  let bg = makeBg(height);
  const inkColor = parchment ? PALETTE_HEX.ink : PALETTE_HEX.bone;
  const promptColor = parchment ? PALETTE_HEX.oxide : PALETTE_HEX.gold;

  const text = scene.add.text(-width / 2 + 30, -height / 2 + 22, '', {
    fontFamily: FONT_BODY,
    fontSize: '19px',
    color: inkColor,
    wordWrap: { width: width - 60 },
    lineSpacing: 8,
  });
  text.setResolution(2);

  const prompt = scene.add
    .text(width / 2 - 22, height / 2 - 18, '?', { fontFamily: FONT_BODY, fontSize: '18px', color: promptColor })
    .setOrigin(1)
    .setVisible(false);
  // The "more" arrow bobs gently while waiting for the player.
  let bobTween: Phaser.Tweens.Tween | null = null;
  function showPrompt(): void {
    showPrompt();
    if (!bobTween && !settingsManager.get().reduceMotion) {
      const baseY = prompt.y;
      bobTween = scene.tweens.add({ targets: prompt, y: baseY + 3, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      void baseY;
    }
  }
  function hidePrompt(): void {
    hidePrompt();
    if (bobTween) { bobTween.stop(); bobTween.remove(); bobTween = null; }
  }

  // Beat progress ("2 / 6") — bottom-left, only during multi-beat pagination.
  const beatLabel = scene.add
    .text(-width / 2 + 22, height / 2 - 14, '', { fontFamily: FONT_MONO, fontSize: '11px', color: promptColor })
    .setOrigin(0)
    .setAlpha(0.75)
    .setVisible(false);

  // Speaker nameplate — a small tab overlapping the top edge.
  let nameplateBg: Phaser.GameObjects.Rectangle | null = null;
  let nameplate: Phaser.GameObjects.Text | null = null;

  const container = scene.add.container(x, y, [shadow, bg, text, prompt, beatLabel]);
  // Render order [shadow, bg, text, prompt] is already correct — do NOT
  // bringToTop(bg) here; that moves the parchment above the text and hides it.
  container.setDepth(30);
  container.setAlpha(0);
  scene.tweens.add({ targets: container, alpha: 1, duration: 240, ease: 'Sine.easeOut' });

  /** Re-fit the sheet to a new height (clamped), repositioning everything. */
  function layout(h: number): void {
    const nh = Math.round(Math.max(MIN_H, Math.min(MAX_H, h)));
    if (nh === curH) return;
    curH = nh;
    shadow.setSize(width, curH);
    const oldBg = bg;
    bg = makeBg(curH);
    container.addAt(bg, 1);
    container.remove(oldBg);
    oldBg.destroy();
    text.setY(-curH / 2 + 22);
    prompt.setPosition(width / 2 - 22, curH / 2 - 18);
    beatLabel.setPosition(-width / 2 + 22, curH / 2 - 14);
    if (nameplateBg) nameplateBg.setY(-curH / 2 + 4);
    if (nameplate) nameplate.setY(-curH / 2 + 3);
    opts.onResize?.(curH);
  }

  /** Size the sheet to fit the full passage (capped at ~5 lines). */
  function fit(t: string): void {
    text.setText(t);
    layout(text.height + 48);
    text.setText('');
  }
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
      showPrompt();
      doneCallback?.();
    }
  }

  function startType(t: string, onDone?: () => void) {
    fullText = t;
    charIndex = 0;
    doneCallback = onDone;
    hidePrompt();
    beatLabel.setVisible(inBeats && beats.length > 1);
    if (beatLabel.visible) beatLabel.setText(`${beatIndex + 1} / ${beats.length}`);
    fit(t);
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
        showPrompt();
      }
    });
  }

  return {
    container,
    getHeight: () => curH,
    setText: (t, onDone) => {
      inBeats = false;
      beats = [];
      beatLabel.setVisible(false);
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
      nameplateBg = scene.add.rectangle(-width / 2 + 96, -curH / 2 + 4, 170, 26, parchment ? 0xd9cdb0 : 0x22262c)
        .setStrokeStyle(1, parchment ? 0xb9ab88 : 0xc9a24b, 0.9);
      nameplate = scene.add.text(-width / 2 + 96, -curH / 2 + 3, name.toUpperCase(), {
        fontFamily: FONT_SERIF,
        fontSize: '13px',
        color: parchment ? PALETTE_HEX.oxide : PALETTE_HEX.gold,
      }).setOrigin(0.5);
      if (typeof nameplate.setLetterSpacing === 'function') nameplate.setLetterSpacing(2);
      container.add([nameplateBg, nameplate]);
      // Stamp-in: plate lands at 1.15× and settles, like a seal pressed into wax.
      try {
        const s = settingsManager.get();
        if (!s.reduceMotion) {
          nameplateBg.setScale(1.15);
          nameplate.setScale(1.15);
          nameplateBg.setAlpha(0);
          nameplate.setAlpha(0);
          scene.tweens.add({ targets: [nameplateBg, nameplate], scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
        }
      } catch {
        /* settings unavailable — plate simply appears */
      }
    },
    skip: () => {
      // Finish the current typing...
      if (timer) {
        timer.remove();
        timer = null;
        charIndex = fullText.length;
        text.setText(fullText);
        showPrompt();
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
