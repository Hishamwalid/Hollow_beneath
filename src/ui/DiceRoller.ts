import Phaser from 'phaser';
import { FONT_SERIF, PALETTE_HEX } from './uiTheme';
import { reducedMotion } from '@systems/motion';

export interface DiceRoller {
  container: Phaser.GameObjects.Container;
  roll: (finalValue: number, onDone: () => void) => void;
  destroy: () => void;
}

export function createDiceRoller(scene: Phaser.Scene, x: number, y: number): DiceRoller {
  const box = scene.add.rectangle(0, 0, 72, 72, 0x22262c).setStrokeStyle(2, 0xc9a24b, 1);
  const text = scene.add
    .text(0, 0, '?', { fontFamily: FONT_SERIF, fontSize: '40px', color: PALETTE_HEX.gold })
    .setOrigin(0.5);
  const container = scene.add.container(x, y, [box, text]);
  let activeTimer: Phaser.Time.TimerEvent | null = null;

  return {
    container,
    roll: (finalValue: number, onDone: () => void) => {
      activeTimer?.remove();
      let ticks = 0;
      const total = 10;
      if (!reducedMotion()) {
        // The die tumbles while it counts (relative spin so every roll tumbles).
        scene.tweens.add({ targets: container, angle: '+=360', duration: total * 45 + 120, ease: 'Cubic.easeOut' });
      }
      const timer = scene.time.addEvent({
        delay: 45,
        repeat: total - 1,
        callback: () => {
          ticks += 1;
          if (ticks >= total) {
            activeTimer = null;
            text.setText(String(finalValue));
            if (reducedMotion()) {
              onDone();
              return;
            }
            // Result slam: overshoot past 1.4× and settle with a dust ring.
            scene.tweens.add({ targets: container, scale: { from: 1.4, to: 1 }, duration: 200, ease: 'Back.easeOut' });
            onDone();
          } else {
            text.setText(String(1 + Math.floor(Math.random() * 5)));
          }
        },
      });
      activeTimer = timer;
    },
    destroy: () => {
      activeTimer?.remove();
      container.destroy();
    },
  };
}
