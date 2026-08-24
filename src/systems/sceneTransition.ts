import Phaser from 'phaser';

let transitioning = false;

export function fadeToScene(scene: Phaser.Scene, target: string, data?: object): void {
  if (transitioning) return;
  transitioning = true;
  scene.cameras.main.fadeOut(200, 0, 0, 0);
  scene.time.delayedCall(200, () => {
    transitioning = false;
    scene.scene.start(target, data);
  });
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(250, 0, 0, 0);
}
