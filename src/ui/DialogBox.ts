import Phaser from 'phaser';
import { FONT_BODY, PALETTE_HEX } from './uiTheme';
import { settingsManager } from '@systems/SettingsManager';

export interface DialogBox {
  container: Phaser.GameObjects.Container;
  setText: (text: string, onDone?: () => void) => void;
  skip: () => void;
  destroy: () => void;
}

export function createDialogBox(scene: Phaser.Scene, x: number, y: number, width = 760, height = 200): DialogBox {
  const bg = scene.add.image(0, 0, 'panel_dialog').setDisplaySize(width, height);
  const text = scene.add.text(-width / 2 + 28, -height / 2 + 20, '', {
    fontFamily: FONT_BODY,
    fontSize: '19px',
    color: PALETTE_HEX.bone,
    wordWrap: { width: width - 56 },
    lineSpacing: 7,
  });
  const prompt = scene.add
    .text(width / 2 - 20, height / 2 - 20, '▾', { fontFamily: FONT_BODY, fontSize: '18px', color: PALETTE_HEX.gold })
    .setOrigin(1)
    .setVisible(false);

  const container = scene.add.container(x, y, [bg, text, prompt]);
  container.setDepth(30);
  container.setAlpha(0);
  scene.tweens.add({ targets: container, alpha: 1, duration: 240, ease: 'Sine.easeOut' });

  let fullText = '';
  let charIndex = 0;
  let timer: Phaser.Time.TimerEvent | null = null;
  let doneCallback: (() => void) | undefined;

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

  return {
    container,
    setText: (t: string, onDone?: () => void) => {
      fullText = t;
      charIndex = 0;
      doneCallback = onDone;
      prompt.setVisible(false);
      text.setText('');
      timer?.remove();
      const spd = settingsManager.get().textSpeed;
      timer = scene.time.addEvent({ delay: Math.round(14 * (100 / spd)), callback: tick, loop: true });
    },
    skip: () => {
      if (timer) {
        timer.remove();
        timer = null;
        charIndex = fullText.length;
        text.setText(fullText);
        prompt.setVisible(true);
        doneCallback?.();
      }
    },
    destroy: () => {
      timer?.remove();
      container.destroy();
    },
  };
}
