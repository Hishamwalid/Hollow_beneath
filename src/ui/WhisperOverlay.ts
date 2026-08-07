import Phaser from 'phaser';
import { FONT_BODY, PALETTE_HEX } from './uiTheme';
import { resonanceTier } from '@systems/ResonanceSystem';

/**
 * Subtle full-screen color wash that intensifies with Resonance tier — the
 * closest thing to the GDD's "chromatic aberration / warp / glitch" visual
 * escalation we can do safely with plain rectangles (no custom GLSL shaders,
 * works identically on Canvas and WebGL). Call once per scene create(); it
 * cleans up naturally with the scene's display list.
 */
export function applyResonanceTint(scene: Phaser.Scene, resonance: number, width: number, height: number): void {
  const tier = resonanceTier(resonance);
  if (tier === 'stable') return;

  const settings: Record<string, { color: number; alpha: number; pulse: boolean }> = {
    awakened: { color: 0x6a4c93, alpha: 0.035, pulse: false },
    unmoored: { color: 0x8e3b46, alpha: 0.06, pulse: true },
    transcendent: { color: 0xb0453f, alpha: 0.09, pulse: true },
  };
  const s = settings[tier];
  if (!s) return;

  const overlay = scene.add.rectangle(width / 2, height / 2, width, height, s.color, s.alpha).setDepth(-1);
  if (s.pulse) {
    scene.tweens.add({
      targets: overlay,
      alpha: { from: s.alpha, to: s.alpha * 1.6 },
      duration: tier === 'transcendent' ? 1400 : 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

/**
 * Shows a single ambient whisper line that fades in, holds, fades out, and
 * destroys itself. Fire-and-forget — never blocks input, never needs manual
 * cleanup, and stacks harmlessly if called again before the previous one clears
 * (each call owns its own text object).
 */
export function showWhisper(scene: Phaser.Scene, x: number, y: number, text: string, maxWidth = 620): void {
  const t = scene.add
    .text(x, y, text, {
      fontFamily: FONT_BODY,
      fontSize: '16px',
      fontStyle: 'italic',
      color: PALETTE_HEX.boneMuted,
      align: 'center',
      wordWrap: { width: maxWidth },
    })
    .setOrigin(0.5, 0)
    .setAlpha(0)
    .setDepth(50);

  scene.tweens.add({
    targets: t,
    alpha: { from: 0, to: 0.85 },
    duration: 900,
    ease: 'Sine.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: t,
        alpha: 0,
        duration: 1100,
        delay: 3200,
        ease: 'Sine.easeIn',
        onComplete: () => t.destroy(),
      });
    },
  });
}
