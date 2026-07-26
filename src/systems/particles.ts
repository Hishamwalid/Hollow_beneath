import Phaser from 'phaser';

export function spawnHitParticles(scene: Phaser.Scene, x: number, y: number, tint?: number): void {
  const emitter = scene.add.particles(x, y, 'particle', {
    speed: { min: 50, max: 150 },
    angle: { min: 0, max: 360 },
    scale: { start: 1, end: 0 },
    lifespan: { min: 200, max: 400 },
    quantity: 8,
    tint: tint ?? 0xc9a24b,
    emitting: false,
  });
  emitter.explode(8);
  scene.time.delayedCall(500, () => emitter.destroy());
}

export function spawnHealParticles(scene: Phaser.Scene, x: number, y: number): void {
  const emitter = scene.add.particles(x, y, 'particle', {
    speed: { min: 20, max: 80 },
    angle: { min: 240, max: 300 },
    scale: { start: 1, end: 0 },
    lifespan: 600,
    quantity: 6,
    tint: 0x5c8a5c,
    emitting: false,
  });
  emitter.explode(6);
  scene.time.delayedCall(700, () => emitter.destroy());
}

export function spawnMomentumParticles(scene: Phaser.Scene, x: number, y: number): void {
  const emitter = scene.add.particles(x, y, 'particle', {
    speed: { min: 60, max: 140 },
    angle: { min: 0, max: 360 },
    scale: { start: 1, end: 0 },
    lifespan: 500,
    quantity: 12,
    tint: 0xc9a24b,
    emitting: false,
  });
  emitter.explode(12);
  scene.time.delayedCall(600, () => emitter.destroy());
}

export function spawnCelebrationParticles(scene: Phaser.Scene, x: number, y: number): void {
  const emitter = scene.add.particles(x, y, 'particle', {
    speed: { min: 80, max: 200 },
    angle: { min: 240, max: 300 },
    scale: { start: 1.2, end: 0 },
    lifespan: { min: 600, max: 1200 },
    quantity: 4,
    frequency: 100,
    tint: [0xc9a24b, 0xe9c876, 0x5c8a5c, 0x9a9488],
  });
  scene.time.delayedCall(1400, () => emitter.destroy());
}
