import Phaser from 'phaser';
import { settingsManager } from '@systems/SettingsManager';

let transitioning = false;

/** Thematic transition flavors. Default is a fast, clean fade. */
export type TransitionMode = 'descend' | 'ascend' | 'boss' | 'plain';

function reduceMotion(): boolean {
  try {
    return !!settingsManager.get().reduceMotion;
  } catch {
    return false;
  }
}

/**
 * Wipes a solid panel across the screen in `dir` while the camera fades,
 * so scene changes read as movement through the Beneath rather than blinks.
 */
function wipe(scene: Phaser.Scene, dir: 'down' | 'up', ms: number): void {
  const w = scene.scale.width + 8;
  const h = scene.scale.height + 8;
  const rect = scene.add.rectangle(0, dir === 'down' ? -h : h, w, h, 0x000000, 1).setOrigin(0).setDepth(5000);
  scene.tweens.add({
    targets: rect,
    y: dir === 'down' ? 4 : -4 - 0,
    duration: ms,
    ease: dir === 'down' ? 'Sine.easeIn' : 'Sine.easeOut',
  });
}

export function fadeToScene(scene: Phaser.Scene, target: string, data?: object, mode: TransitionMode = 'plain'): void {
  if (transitioning) return;
  transitioning = true;

  if (mode === 'boss' && !reduceMotion()) {
    // Slow iris: fade + slight push-in before the cut.
    scene.tweens.add({ targets: scene.cameras.main, zoom: { from: 1, to: 1.06 }, duration: 380, ease: 'Sine.easeIn' });
    scene.cameras.main.fadeOut(380, 0, 0, 0);
    scene.time.delayedCall(390, () => {
      transitioning = false;
      scene.scene.start(target, data);
    });
    return;
  }

  if (!reduceMotion() && (mode === 'descend' || mode === 'ascend')) {
    wipe(scene, mode === 'descend' ? 'down' : 'up', 240);
    scene.cameras.main.fadeOut(230, 0, 0, 0);
    scene.time.delayedCall(240, () => {
      transitioning = false;
      scene.scene.start(target, data);
    });
    return;
  }

  scene.cameras.main.fadeOut(200, 0, 0, 0);
  scene.time.delayedCall(200, () => {
    transitioning = false;
    scene.scene.start(target, data);
  });
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(250, 0, 0, 0);
}
