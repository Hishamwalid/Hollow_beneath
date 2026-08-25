// ============================================================================
// THE HOLLOW BENEATH — Motion toolkit
// One shared vocabulary for UI motion so every scene animates the same way.
// Everything here is presentation-only, shutdown-safe (tweens die with their
// targets), and gated by the Reduce Motion setting where it matters.
// ============================================================================
import Phaser from 'phaser';
import { settingsManager } from '@systems/SettingsManager';

/** True when the player asked for calmer motion. */
export function reducedMotion(): boolean {
  try {
    return !!settingsManager.get().reduceMotion;
  } catch {
    return false;
  }
}

/** True when camera shake effects are allowed (both settings consulted). */
function shakeAllowed(): boolean {
  try {
    const s = settingsManager.get();
    return s.screenShake && !s.reduceMotion;
  } catch {
    return true;
  }
}

/**
 * Standard staggered entrance: items rise into place and fade in.
 * `mode 'rise'` slides up 18px; `'fall'` drops from above; `'none'` fades only.
 * Reduce Motion collapses this to a quick plain fade.
 */
export function staggerIn(
  scene: Phaser.Scene,
  targets: Phaser.GameObjects.Container[] | Phaser.GameObjects.GameObject[],
  opts: { mode?: 'rise' | 'fall' | 'none'; stagger?: number; duration?: number; delay?: number } = {},
): void {
  if (targets.length === 0) return;
  const mode = opts.mode ?? 'rise';
  const stagger = opts.stagger ?? 50;
  const duration = opts.duration ?? 240;
  const baseDelay = opts.delay ?? 0;
  targets.forEach((t, i) => {
    const go = t as unknown as { x?: number; y?: number };
    const fromY = mode === 'none' ? 0 : mode === 'rise' ? 18 : -22;
    if ('y' in go && typeof go.y === 'number') {
      const toY = go.y;
      if (!reducedMotion()) {
        go.y = toY + fromY;
        scene.tweens.add({ targets: t, y: toY, alpha: { from: 0, to: 1 }, duration, delay: baseDelay + i * stagger, ease: 'Sine.easeOut' });
        return;
      }
    }
    scene.tweens.add({ targets: t, alpha: { from: 0, to: 1 }, duration: reducedMotion() ? 120 : duration, delay: baseDelay + i * stagger });
  });
}

/** Rolls a text object's numeric content from `from` to `to`. */
export function countTo(text: Phaser.GameObjects.Text, from: number, to: number, duration = 350, suffix = ''): void {
  if (reducedMotion() || duration <= 0 || from === to) {
    text.setText(`${Math.round(to)}${suffix}`);
    return;
  }
  const state = { v: from };
  scene_tween_of(text, state, to, duration, suffix);
}

function scene_tween_of(text: Phaser.GameObjects.Text, state: { v: number }, to: number, duration: number, suffix: string): void {
  const scene = text.scene;
  scene?.tweens.add({
    targets: state,
    v: to,
    duration,
    ease: 'Sine.easeOut',
    onUpdate: () => text.setText(`${Math.round(state.v)}${suffix}`),
    onComplete: () => text.setText(`${Math.round(to)}${suffix}`),
  });
}

/** Floating +/- delta chip that rises and dissolves. Caller positions it. */
export function floatDelta(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  color: string,
  opts: { depth?: number; fontSize?: number } = {},
): void {
  const t = scene.add.text(x, y, label, {
    fontFamily: 'Courier New, monospace',
    fontSize: `${opts.fontSize ?? 15}px`,
    color,
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(opts.depth ?? 500).setAlpha(0);
  const rise = reducedMotion() ? 8 : 34;
  scene.tweens.add({ targets: t, alpha: 1, y: y - rise / 3, duration: 140, ease: 'Sine.easeOut' });
  scene.tweens.add({ targets: t, y: y - rise, alpha: 0, delay: 420, duration: 480, ease: 'Sine.easeIn', onComplete: () => t.destroy() });
}

/** Quick scale pop: target punches past its size and settles. */
export function popScale(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject & { scaleX: number; scaleY: number }, amount = 1.14, duration = 160): void {
  const sx = target.scaleX;
  const sy = target.scaleY;
  if (reducedMotion()) return;
  scene.tweens.add({ targets: target, scaleX: sx * amount, scaleY: sy * amount, duration: duration / 2, yoyo: true, ease: 'Sine.easeInOut' });
}

/** Single attention pulse (ring or glow object): expands and fades once. */
export function pulseOnce(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  color: number,
  opts: { depth?: number; lineWidth?: number; duration?: number } = {},
): void {
  if (reducedMotion()) return;
  const ring = scene.add.circle(x, y, radius * 0.4).setStrokeStyle(opts.lineWidth ?? 3, color, 0.9).setDepth(opts.depth ?? 400);
  scene.tweens.add({
    targets: ring,
    radius,
    scale: 1,
    alpha: 0,
    duration: opts.duration ?? 380,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });
}

/** Camera shake wrapper honoring both screenShake and reduceMotion settings. */
export function shake(scene: Phaser.Scene, intensity = 0.004, duration = 120): void {
  if (!shakeAllowed()) return;
  scene.cameras.main.shake(duration, intensity);
}

/** Brief full-screen dim pulse — hit-stop feel without touching timeScale. */
export function dimPulse(scene: Phaser.Scene, alpha = 0.28, duration = 60, color = 0x000000): void {
  if (reducedMotion()) return;
  const veil = scene.add.rectangle(0, 0, scene.scale.width + 4, scene.scale.height + 4, color, alpha)
    .setOrigin(0).setDepth(2000);
  scene.tweens.add({ targets: veil, alpha: 0, duration: duration * 2.2, ease: 'Quad.easeIn', onComplete: () => veil.destroy() });
}

/** Continuous idle bob for a point/container (call once; tween dies on destroy). */
export function idleBob(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject & { y: number }, amplitude = 4, duration = 1400): void {
  if (reducedMotion()) return;
  scene.tweens.add({ targets: target, y: target.y - amplitude, duration: duration / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/**
 * Universal "arrival" feel for full-screen menus: the view settles from a
 * hair of extra zoom into place. One call per scene, zero layout coupling.
 */
export function settleIn(scene: Phaser.Scene): void {
  if (reducedMotion()) return;
  const cam = scene.cameras.main;
  cam.setZoom(1.025);
  scene.tweens.add({ targets: cam, zoom: 1, duration: 340, ease: 'Sine.easeOut' });
}
