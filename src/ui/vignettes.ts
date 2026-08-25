// ============================================================================
// THE HOLLOW BENEATH — procedural cinematic vignettes
//
// Layered silhouettes + atmosphere for the story's largest moments, drawn
// from primitives so the climax never has to be plain text-on-black while
// real CG art is still pending. Fire-and-forget: everything dies with the
// scene's display list. All motion respects Reduce Motion.
// ============================================================================
import Phaser from 'phaser';
import { reducedMotion } from '@systems/motion';

export type VignetteKind = 'offer' | 'tunnel' | 'return' | 'veil';

export interface VignetteOptions {
  depth?: number;
}

/** Drifting ash motes shared by several vignettes. */
function spawnAsh(scene: Phaser.Scene, container: Phaser.GameObjects.Container, w: number, h: number, count = 14): void {
  if (reducedMotion()) return;
  for (let i = 0; i < count; i++) {
    const x = Phaser.Math.Between(w * 0.1, w * 0.9);
    const y = Phaser.Math.Between(h * 0.15, h);
    const mote = scene.add.circle(x, y, Phaser.Math.FloatBetween(1.1, 2.6), 0x9a9488, Phaser.Math.FloatBetween(0.25, 0.55));
    container.add(mote);
    scene.tweens.add({
      targets: mote,
      y: y - Phaser.Math.Between(40, 120),
      x: x + Phaser.Math.Between(-30, 30),
      alpha: 0,
      duration: Phaser.Math.Between(6000, 12000),
      repeat: -1,
      delay: Phaser.Math.Between(0, 5000),
      onRepeat: () => { mote.y = h + 10; mote.alpha = Phaser.Math.FloatBetween(0.25, 0.55); },
    });
  }
}

/** Simple hooded/kneeling silhouette from stacked ellipses. */
function figure(
  scene: Phaser.Scene,
  cx: number,
  groundY: number,
  height: number,
  color: number,
  alpha: number,
  pose: 'stand' | 'kneel',
): Phaser.GameObjects.Container {
  const c = scene.add.container(cx, groundY);
  const headR = height * 0.11;
  if (pose === 'stand') {
    const head = scene.add.circle(0, -height, headR, color, alpha);
    const body = scene.add.ellipse(0, -height * 0.52, height * 0.34, height * 0.62, color, alpha);
    c.add([body, head]);
  } else {
    const head = scene.add.circle(height * 0.06, -height * 0.52, headR * 0.92, color, alpha);
    const body = scene.add.ellipse(0, -height * 0.26, height * 0.42, height * 0.4, color, alpha);
    c.add([body, head]);
  }
  return c;
}

/** The Offer: you kneel; the finished you stands; one gold hairline between. */
function buildOffer(scene: Phaser.Scene, container: Phaser.GameObjects.Container, w: number, h: number): void {
  const groundY = h * 0.78;
  const floor = scene.add.rectangle(w / 2, groundY + 4, w * 0.86, 2, 0xc9a24b, 0.22);
  container.add(floor);
  // Broken shards scattered near the kneeling figure.
  for (let i = 0; i < 7; i++) {
    const sx = w * 0.32 + Phaser.Math.Between(-46, 46);
    const sy = groundY - Phaser.Math.Between(0, 8);
    const shard = scene.add.rectangle(sx, sy, Phaser.Math.Between(6, 16), 2, 0xe9c876, Phaser.Math.FloatBetween(0.18, 0.4));
    shard.setAngle(Phaser.Math.Between(0, 180));
    container.add(shard);
  }
  const kneel = figure(scene, w * 0.33, groundY, 130, 0x16191d, 0.94, 'kneel');
  const stand = figure(scene, w * 0.67, groundY, 168, 0x101216, 0.97, 'stand');
  container.add([kneel, stand]);
  // The hairline between who you are and what you could finish being.
  const hair = scene.add.rectangle(w / 2, groundY - 120, 2, 150, 0xc9a24b, 0.35);
  container.add(hair);
  if (!reducedMotion()) {
    scene.tweens.add({ targets: hair, alpha: { from: 0.18, to: 0.5 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  spawnAsh(scene, container, w, h, 12);
}

/** Lost in the Dark: stone rings recede forever toward an unreachable center. */
function buildTunnel(scene: Phaser.Scene, container: Phaser.GameObjects.Container, w: number, h: number): void {
  const rings = 7;
  for (let i = rings; i >= 1; i--) {
    const t = i / rings;
    const ring = scene.add.ellipse(
      w / 2, h * 0.52,
      w * 0.95 * t, h * 0.82 * t,
      0x000000, 0,
    ).setStrokeStyle(2, 0x2a2e33, 0.16 + (1 - t) * 0.3);
    container.add(ring);
    if (!reducedMotion()) {
      scene.tweens.add({
        targets: ring,
        scaleX: ring.scaleX * 0.965,
        scaleY: ring.scaleY * 0.965,
        duration: 900 + i * 160,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onRepeat: () => {
          ring.setScale(i / rings);
        },
      });
    }
  }
  const ember = scene.add.circle(w / 2, h * 0.52, 3, 0x8e3b46, 0.6);
  container.add(ember);
  if (!reducedMotion()) {
    scene.tweens.add({ targets: ember, alpha: { from: 0.25, to: 0.75 }, scaleX: 1.5, scaleY: 1.5, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  spawnAsh(scene, container, w, h, 9);
}

/** The Return: a coin of daylight above, widening as you climb toward it. */
function buildReturn(scene: Phaser.Scene, container: Phaser.GameObjects.Container, w: number, h: number): void {
  const shaftTop = scene.add.triangle(
    w / 2, h * 0.34,
    -70, -h * 0.36, 70, -h * 0.36, 210, h * 0.36,
    0xf5efdc, 0.05,
  );
  const coin = scene.add.circle(w / 2, h * 0.05, 34, 0xf5efdc, 0.85);
  const glow = scene.add.circle(w / 2, h * 0.05, 60, 0xf5efdc, 0.12);
  const ground = scene.add.rectangle(w / 2, h + 20, w, 120, 0x000000, 0.9);
  const climber = figure(scene, w / 2, h * 0.9, 96, 0x16191d, 0.92, 'kneel');
  container.add([shaftTop, glow, coin, ground, climber]);
  if (!reducedMotion()) {
    scene.tweens.add({ targets: glow, scale: { from: 1, to: 1.28 }, alpha: { from: 0.08, to: 0.2 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: climber, y: h * 0.88, duration: 3400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  spawnAsh(scene, container, w, h, 8);
}

/** Eve / the Hollow: a veiled figure whose face never resolves. */
function buildVeil(scene: Phaser.Scene, container: Phaser.GameObjects.Container, w: number, h: number): void {
  const fig = figure(scene, w / 2, h * 0.86, 300, 0x0e1116, 0.98, 'stand');
  container.add(fig);
  // The veil: a soft pale oval where the face should be — deliberately blank.
  const veilFace = scene.add.ellipse(w / 2, h * 0.86 - 272, 44, 58, 0xd9cdb0, 0.1);
  container.add(veilFace);
  // Gold thread halo, barely there.
  const halo = scene.add.ellipse(w / 2, h * 0.86 - 292, 120, 34, 0x000000, 0).setStrokeStyle(1, 0xc9a24b, 0.28);
  container.add(halo);
  if (!reducedMotion()) {
    scene.tweens.add({
      targets: veilFace,
      alpha: { from: 0.06, to: 0.16 },
      scaleX: { from: 1, to: 1.06 },
      duration: 3100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({ targets: halo, alpha: { from: 0.35, to: 0.75 }, duration: 2700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: fig, scaleY: { from: 1, to: 1.008 }, duration: 3600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  spawnAsh(scene, container, w, h, 10);
}

/** Builds a full-screen atmospheric backdrop for `kind`. Returns its container. */
export function createVignette(scene: Phaser.Scene, kind: VignetteKind, opts: VignetteOptions = {}): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0).setDepth(opts.depth ?? 2);
  // Dim stage behind the silhouettes so text stays readable.
  const wash = scene.add.rectangle(GAME_W(scene) / 2, GAME_H(scene) / 2, GAME_W(scene), GAME_H(scene), 0x000000, 0.5);
  container.add(wash);
  const w = GAME_W(scene);
  const h = GAME_H(scene);
  if (kind === 'offer') buildOffer(scene, container, w, h);
  else if (kind === 'tunnel') buildTunnel(scene, container, w, h);
  else if (kind === 'return') buildReturn(scene, container, w, h);
  else buildVeil(scene, container, w, h);
  container.setAlpha(0);
  scene.tweens.add({ targets: container, alpha: 1, duration: reducedMotion() ? 200 : 1100, ease: 'Sine.easeOut' });
  return container;
}

function GAME_W(scene: Phaser.Scene): number {
  return scene.scale.width || scene.game.config.width as number;
}
function GAME_H(scene: Phaser.Scene): number {
  return scene.scale.height || scene.game.config.height as number;
}

// ---------------------------------------------------------------------------
// Film grain — a scrolling noise plate that intensifies with chapter depth.
// ---------------------------------------------------------------------------

let grainTextureKey: string | null = null;

/** Generates (once per session) a small RGBA noise tile for the grain overlay. */
function ensureGrainTexture(scene: Phaser.Scene): string {
  if (grainTextureKey && scene.textures.exists(grainTextureKey)) return grainTextureKey;
  const key = 'hb_film_grain';
  if (scene.textures.exists(key)) {
    grainTextureKey = key;
    return key;
  }
  const size = 128;
  const canvasTexture = scene.textures.createCanvas(key, size, size);
  if (!canvasTexture) return '';
  const ctx = canvasTexture.getContext();
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.random() < 0.24 ? Math.floor(Math.random() * 90) : 0;
  }
  ctx.putImageData(img, 0, 0);
  canvasTexture.refresh();
  grainTextureKey = key;
  return key;
}

/**
 * Animated grain overlay for cinematic scenes. `intensity` 0..1 scales alpha
 * (roughly: chapter/10 works well). No-op under Reduce Motion.
 */
export function createFilmGrain(scene: Phaser.Scene, depth: number, intensity = 0.4): void {
  if (reducedMotion() || intensity <= 0) return;
  const key = ensureGrainTexture(scene);
  if (!key || !scene.textures.exists(key)) return;
  const w = GAME_W(scene);
  const h = GAME_H(scene);
  const image = scene.add.tileSprite(0, 0, w, h, key)
    .setOrigin(0)
    .setDepth(depth)
    .setAlpha(0.045 + intensity * 0.075)
    .setBlendMode(Phaser.BlendModes.OVERLAY);
  const drift = () => {
    image.tilePositionX = Math.random() * 128;
    image.tilePositionY = Math.random() * 128;
  };
  drift();
  scene.time.addEvent({ delay: 95, loop: true, callback: drift });
}
