import Phaser from 'phaser';
import { resonanceTier } from './ResonanceSystem';
import { applyResonanceTint } from '@ui/WhisperOverlay';

export interface ResonanceFXOptions {
  nodePulse?: boolean;
  shake?: boolean;
  vignette?: boolean;
  textGlitch?: boolean;
  shimmer?: boolean;
}

export function addResonanceEffects(
  scene: Phaser.Scene,
  resonance: number,
  width: number,
  height: number,
  options: ResonanceFXOptions = {},
): void {
  const tier = resonanceTier(resonance);
  applyResonanceTint(scene, resonance, width, height);
  if (tier === 'stable') return;

  if (tier === 'awakened') {
    if (options.nodePulse !== false) addNodePulse(scene);
    return;
  }

  if (tier === 'unmoored') {
    if (options.nodePulse !== false) addNodePulse(scene);
    if (options.shake !== false) addAmbientShake(scene, tier);
    return;
  }

  if (options.nodePulse !== false) addNodePulse(scene);
  if (options.shake !== false) addAmbientShake(scene, tier);
  if (options.vignette !== false) addVignette(scene, width, height);
  if (options.textGlitch !== false) addTextGlitch(scene);
  if (options.shimmer !== false) addShimmer(scene, width, height);
}

function addNodePulse(scene: Phaser.Scene): void {
  const nodeImages = scene.children.list.filter(
    (c): c is Phaser.GameObjects.Image =>
      c.type === 'Image' && typeof c.name === 'string' && c.name.startsWith('node_'),
  );

  for (const icon of nodeImages) {
    if (icon.alpha <= 0) continue;
    if (icon.getData('resolved') === true) continue;

    const baseAlpha = icon.alpha;
    scene.tweens.add({
      targets: icon,
      alpha: { from: Math.max(0.15, baseAlpha * 0.55), to: baseAlpha },
      duration: 1000 + Math.random() * 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: Math.random() * 1000,
    });
  }
}

function addAmbientShake(scene: Phaser.Scene, tier: string): void {
  const intensity = tier === 'transcendent' ? 0.004 : 0.002;
  scene.cameras.main.shake(2000, intensity, false);
  scene.time.addEvent({
    delay: 2000,
    loop: true,
    callback: () => {
      scene.cameras.main.shake(2000, intensity, false);
    },
  });
}

function addVignette(scene: Phaser.Scene, width: number, height: number): void {
  const count = 5;
  const t = 4;
  const alphas = [0.15, 0.12, 0.09, 0.06, 0.03];

  const addStrip = (x: number, y: number, w: number, h: number, a: number) =>
    scene.add.rectangle(x, y, w, h, 0x000000, a).setDepth(5).setScrollFactor(0);

  for (let i = 0; i < count; i++) addStrip(width / 2, i * t + t / 2, width, t, alphas[i]);
  for (let i = 0; i < count; i++) addStrip(width / 2, height - i * t - t / 2, width, t, alphas[i]);
  for (let i = 0; i < count; i++) addStrip(i * t + t / 2, height / 2, t, height, alphas[i]);
  for (let i = 0; i < count; i++) addStrip(width - i * t - t / 2, height / 2, t, height, alphas[i]);
}

function addTextGlitch(scene: Phaser.Scene): void {
  const schedule = () => {
    if (!scene.scene.isActive()) return;
    const texts = scene.children.list.filter(
      (c): c is Phaser.GameObjects.Text => c.type === 'Text' && c.active,
    ).filter((t) => t.alpha > 0);
    if (texts.length > 0) {
      const target = texts[Math.floor(Math.random() * texts.length)];
      const origX = target.x;
      target.x += Math.random() > 0.5 ? 1.5 : -1.5;
      scene.time.delayedCall(80, () => { if (target.active) target.x = origX; });
    }
    scene.time.delayedCall(1500 + Math.random() * 2000, schedule);
  };
  schedule();
}

function addShimmer(scene: Phaser.Scene, width: number, height: number): void {
  for (let i = 0; i < 3; i++) {
    const band = scene.add.rectangle(-80, height * (0.15 + i * 0.35), 40, height * 0.2, 0xc9a24b, 0.02).setDepth(-1);
    scene.tweens.add({
      targets: band,
      x: width + 80,
      duration: 7000 + i * 2000,
      repeat: -1,
      delay: i * 3000,
      ease: 'Linear',
    });
  }
}
