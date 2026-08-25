import Phaser from 'phaser';
import { FONT_MONO, FONT_SERIF, PALETTE_HEX } from './uiTheme';
import { spawnHitParticles } from '@/systems/particles';
import { reducedMotion } from '@systems/motion';

/**
 * QTE (quick-time-event) timing bar for revamped timed offense.
 * A needle sweeps back and forth across a target zone; clicking (or pressing
 * Space/Enter) resolves the strike by where the needle rests:
 *   perfect (±PERFECT_W/2 of center) / good (±GOOD_W/2) / miss (elsewhere).
 * A `slowed` subject doubles the needle speed (Petrifying Gaze). If the player
 * never inputs, the sweep auto-resolves as `miss`.
 */
export type QteQuality = 'perfect' | 'good' | 'miss';

export interface QteBarHandle {
  container: Phaser.GameObjects.Container;
  destroy: () => void;
}

const TRACK_W = 400;
const ZONE_W = 30;
const PERFECT_W = 40;
const GOOD_W = 90;
const NEEDLE_W = 5;
const NEEDLE_H = 34;
const OUTER_W = TRACK_W + 130;
const OUTER_H = 118;
/** One full edge-to-edge transit (ms); Slowed doubles that pace. */
const TRANSIT_MS = 700;
/** If the player never confirms, auto-resolve as a miss. */
const AUTO_MISS_MS = 3400;

export function createQteBar(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  opts: { slowed: boolean; resolve: (quality: QteQuality) => void },
): QteBarHandle {
  const container = scene.add.container(cx, cy).setDepth(45);

  const bg = scene.add
    .rectangle(0, 0, OUTER_W, OUTER_H, 0x0b0d10, 0.9)
    .setStrokeStyle(2, 0xc9a24b)
    .setOrigin(0.5);
  const title = scene.add
    .text(0, -46, opts.slowed ? 'TIMED HIT — PATIENCE' : 'TIMED HIT', {
      fontFamily: FONT_SERIF,
      fontSize: '20px',
      fontStyle: 'bold',
      color: PALETTE_HEX.gold,
      align: 'center',
    })
    .setOrigin(0.5);
  const hint = scene.add
    .text(0, 46, opts.slowed ? 'The needle runs fast — strike on target.' : 'Click (or Space) when the needle is on target.', {
      fontFamily: FONT_MONO,
      fontSize: '12px',
      color: PALETTE_HEX.boneMuted,
    })
    .setOrigin(0.5);

  const frame = scene.add.rectangle(0, 0, TRACK_W + 8, ZONE_W + 18, 0x000000).setOrigin(0.5).setStrokeStyle(2, 0xc9a24b);
  const good = scene.add.rectangle(0, 0, GOOD_W, ZONE_W, 0xc9a24b, 0.22).setOrigin(0.5);
  const perfect = scene.add.rectangle(0, 0, PERFECT_W, ZONE_W, 0xffd700, 0.45).setOrigin(0.5);
  // Needle dressing: soft glow halo + motion streak trailing the sweep.
  const streak = scene.add.rectangle(-24, 0, 46, NEEDLE_H - 8, 0xffffff, 0.14).setOrigin(0.5);
  const glow = scene.add.circle(0, 0, 11, 0xffffff, 0.28).setOrigin(0.5);
  const needle = scene.add.rectangle(0, 0, NEEDLE_W, NEEDLE_H, 0xffffff).setOrigin(0.5);

  container.add([bg, title, hint, frame, good, perfect, streak, glow, needle]);
  if (!reducedMotion()) {
    // Perfect zone breathes — the eye goes where the reward is.
    scene.tweens.add({ targets: perfect, alpha: { from: 0.45, to: 0.7 }, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  const half = TRACK_W / 2;
  const pace = opts.slowed ? TRANSIT_MS / 2 : TRANSIT_MS;

  let resolved = false;
  let tween: Phaser.Tweens.Tween | undefined;
  let keyHandler: ((event: KeyboardEvent) => void) | undefined;

  const cleanup = () => {
    if (tween) { tween.stop(); tween = undefined; }
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = undefined;
    }
  };

  const finish = (quality: QteQuality) => {
    if (resolved) return;
    resolved = true;
    cleanup();
    container.destroy();
    opts.resolve(quality);
  };

  const confirm = () => {
    if (resolved) return;
    const err = Math.abs(needle.x);
    const quality: QteQuality = err <= PERFECT_W / 2 ? 'perfect' : err <= GOOD_W / 2 ? 'good' : 'miss';
    resolved = true;
    cleanup(); // freeze the needle + drop inputs

    // Verdict spark at the contact point — gold for perfect, green for good.
    if (quality !== 'miss') {
      spawnHitParticles(scene, cx + needle.x, cy, quality === 'perfect' ? 0xffd700 : 0x9be29b);
    }

    // Make the result unmistakable: freeze the needle in its color and label it.
    needle.setFillStyle(quality === 'perfect' ? 0xffd700 : quality === 'good' ? 0x9be29b : 0xe1665c);
    if (quality === 'perfect') {
      perfect.setFillStyle(0xffd700, 0.9);
    } else if (quality === 'good') {
      good.setFillStyle(0x9be29b, 0.55);
    } else {
      frame.setStrokeStyle(2, 0xe1665c);
    }
    const label = scene.add
      .text(0, -16, quality === 'perfect' ? 'PERFECT!' : quality === 'good' ? 'GOOD' : 'MISS', {
        fontFamily: FONT_SERIF,
        fontSize: '26px',
        fontStyle: 'bold',
        color: quality === 'perfect' ? '#ffd700' : quality === 'good' ? '#9be29b' : '#e1665c',
        stroke: '#0b0d10',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    container.add(label);

    // Hold the verdict briefly so the player can read it, then resolve.
    scene.time.delayedCall(450, () => {
      container.destroy();
      opts.resolve(quality);
    });
  };

  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', confirm);

  keyHandler = (event: KeyboardEvent) => {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      confirm();
    }
  };
  window.addEventListener('keydown', keyHandler);

  // Sweep needle left → right, yoyo forever; glow/streak ride along.
  needle.x = -half;
  let lastX = -half;
  tween = scene.tweens.add({
    targets: needle,
    x: half,
    duration: pace,
    ease: 'Quad.easeInOut',
    yoyo: true,
    repeat: -1,
    onUpdate: () => {
      glow.x = needle.x;
      streak.x = needle.x - Math.sign(needle.x - lastX || 1) * 26;
      streak.alpha = 0.16;
      lastX = needle.x;
    },
  });

  // Never trap the player: auto-miss if they ignore the prompt.
  scene.time.delayedCall(AUTO_MISS_MS, () => finish('miss'));

  return {
    container,
    // Idempotent, non-resolving teardown (used on scene shutdown / by the scene).
    // If the player never confirmed, this drops the prompt without firing a strike.
    destroy: () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      container.destroy();
    },
  };
}