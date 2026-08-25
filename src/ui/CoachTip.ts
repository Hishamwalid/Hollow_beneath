import Phaser from 'phaser';
import { FONT_BODY, FONT_SERIF, PALETTE_HEX } from './uiTheme';

export interface CoachTipHandle {
  container: Phaser.GameObjects.Container;
  destroy: () => void;
}

/**
 * One-time contextual hint — a small parchment slip that fades in near
 * whatever the player should look at, then fades away. Never blocks input.
 */
export function createCoachTip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: { width?: number; durationMs?: number; depth?: number } = {},
): CoachTipHandle {
  const width = opts.width ?? 340;
  const depth = opts.depth ?? 90;

  const container = scene.add.container(x, y).setDepth(depth);

  const shadow = scene.add.rectangle(3, 4, width, 46, 0x000000, 0.35);
  const card = scene.add.nineslice(0, 0, 'paper_panel', undefined, width, 46, 24, 24, 24, 24);
  const label = scene.add.text(0, 0, text, {
    fontFamily: FONT_BODY,
    fontSize: '15px',
    color: PALETTE_HEX.ink,
    fontStyle: 'italic',
    align: 'center',
    wordWrap: { width: width - 36 },
  }).setOrigin(0.5);
  // Small gold pin above the card.
  const pin = scene.add.rectangle(width / 2 - 18, -26, 8, 8, Phaser.Display.Color.HexStringToColor(PALETTE_HEX.oxide).color).setAngle(45);

  container.add([shadow, card, label]);
  container.setAlpha(0);
  // Spring entrance: overshoot past full size, then settle.
  container.setScale(0.82);
  scene.tweens.add({
    targets: [container, pin],
    alpha: { from: 0, to: 1 },
    duration: 220,
    ease: 'Sine.easeOut',
  });
  scene.tweens.add({
    targets: container,
    scale: { from: 0.82, to: 1 },
    duration: 340,
    delay: 40,
    ease: 'Back.easeOut',
  });

  let destroyed = false;
  const fadeOut = () => {
    if (destroyed) return;
    destroyed = true;
    scene.tweens.add({
      targets: container,
      alpha: 0,
      y: y - 10,
      duration: 420,
      ease: 'Sine.easeIn',
      onComplete: () => container.destroy(),
    });
  };

  scene.time.delayedCall(opts.durationMs ?? 5600, fadeOut);

  return {
    container,
    destroy: () => {
      destroyed = true;
      container.destroy();
    },
  };
}
