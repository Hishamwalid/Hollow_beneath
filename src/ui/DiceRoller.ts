import Phaser from 'phaser';
import { FONT_SERIF, PALETTE_HEX } from './uiTheme';

export interface DiceRoller {
  container: Phaser.GameObjects.Container;
  roll: (finalValue: number, onDone: () => void) => void;
  destroy: () => void;
}

export function createDiceRoller(scene: Phaser.Scene, x: number, y: number): DiceRoller {
  const box = scene.add.rectangle(0, 0, 72, 72, 0x22262c).setStrokeStyle(2, 0xc9a24b, 1);
  const text = scene.add
    .text(0, 0, '?', { fontFamily: FONT_SERIF, fontSize: '32px', color: PALETTE_HEX.gold })
    .setOrigin(0.5);
  const container = scene.add.container(x, y, [box, text]);

  return {
    container,
    roll: (finalValue: number, onDone: () => void) => {
      let ticks = 0;
      const total = 10;
      const timer = scene.time.addEvent({
        delay: 45,
        repeat: total - 1,
        callback: () => {
          ticks += 1;
          if (ticks >= total) {
            text.setText(String(finalValue));
            scene.tweens.add({ targets: container, scale: 1.25, duration: 90, yoyo: true });
            onDone();
          } else {
            text.setText(String(1 + Math.floor(Math.random() * 5)));
          }
        },
      });
      void timer;
    },
    destroy: () => container.destroy(),
  };
}
