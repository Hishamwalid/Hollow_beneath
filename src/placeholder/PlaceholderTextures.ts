import Phaser from 'phaser';
import { ENEMIES, SUMMON_ENEMIES } from '@data/enemies';
import { BOSSES } from '@data/bosses';
import { FACTIONS } from '@data/factions';

export const PALETTE = {
  void: 0x0b0d10,
  stone: 0x16191d,
  stoneLight: 0x22262c,
  bone: 0xe8e2d4,
  boneMuted: 0x9a9488,
  gold: 0xc9a24b,
  goldBright: 0xe9c876,
  danger: 0xb0453f,
  ok: 0x5c8a5c,
  player: 0x7fb0c9,
};

function shapeTexture(
  scene: Phaser.Scene,
  key: string,
  size: number,
  draw: (g: Phaser.GameObjects.Graphics, s: number) => void,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g, size);
  g.generateTexture(key, size, size);
  g.destroy();
}

/** Circle token — used for regular enemies and the player. */
function circleToken(scene: Phaser.Scene, key: string, color: number, ringColor: number, size = 64): void {
  shapeTexture(scene, key, size, (g) => {
    const r = size / 2;
    g.fillStyle(color, 1);
    g.fillCircle(r, r, r - 4);
    g.lineStyle(3, ringColor, 1);
    g.strokeCircle(r, r, r - 4);
  });
}

/** Hex token — used for bosses (larger, more imposing silhouette). */
function hexToken(scene: Phaser.Scene, key: string, color: number, ringColor: number, size = 96): void {
  shapeTexture(scene, key, size, (g) => {
    const r = size / 2 - 4;
    const cx = size / 2;
    const cy = size / 2;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      pts.push(new Phaser.Math.Vector2(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
    }
    g.fillStyle(color, 1);
    g.fillPoints(pts, true);
    g.lineStyle(4, ringColor, 1);
    g.strokePoints(pts, true);
  });
}

function diamondIcon(scene: Phaser.Scene, key: string, color: number, size = 32): void {
  shapeTexture(scene, key, size, (g) => {
    const r = size / 2 - 2;
    const cx = size / 2;
    const cy = size / 2;
    g.fillStyle(color, 1);
    g.fillPoints(
      [new Phaser.Math.Vector2(cx, cy - r), new Phaser.Math.Vector2(cx + r, cy), new Phaser.Math.Vector2(cx, cy + r), new Phaser.Math.Vector2(cx - r, cy)],
      true,
    );
  });
}

function triangleIcon(scene: Phaser.Scene, key: string, color: number, size = 32): void {
  shapeTexture(scene, key, size, (g) => {
    const r = size / 2 - 2;
    const cx = size / 2;
    const cy = size / 2 + 2;
    g.fillStyle(color, 1);
    g.fillPoints(
      [new Phaser.Math.Vector2(cx, cy - r), new Phaser.Math.Vector2(cx + r, cy + r * 0.7), new Phaser.Math.Vector2(cx - r, cy + r * 0.7)],
      true,
    );
  });
}

function starIcon(scene: Phaser.Scene, key: string, color: number, size = 32): void {
  shapeTexture(scene, key, size, (g) => {
    const cx = size / 2;
    const cy = size / 2;
    const outer = size / 2 - 2;
    const inner = outer * 0.45;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(new Phaser.Math.Vector2(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
    }
    g.fillStyle(color, 1);
    g.fillPoints(pts, true);
  });
}

function crossIcon(scene: Phaser.Scene, key: string, color: number, size = 32): void {
  shapeTexture(scene, key, size, (g) => {
    g.fillStyle(color, 1);
    const t = size * 0.22;
    g.fillRect(size / 2 - t / 2, size * 0.12, t, size * 0.76);
    g.fillRect(size * 0.12, size / 2 - t / 2, size * 0.76, t);
  });
}

function crownIcon(scene: Phaser.Scene, key: string, color: number, size = 40): void {
  shapeTexture(scene, key, size, (g) => {
    const cx = size / 2;
    const base = size * 0.72;
    g.fillStyle(color, 1);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(size * 0.12, base),
        new Phaser.Math.Vector2(size * 0.12, size * 0.42),
        new Phaser.Math.Vector2(size * 0.3, size * 0.58),
        new Phaser.Math.Vector2(cx, size * 0.12),
        new Phaser.Math.Vector2(size * 0.7, size * 0.58),
        new Phaser.Math.Vector2(size * 0.88, size * 0.42),
        new Phaser.Math.Vector2(size * 0.88, base),
      ],
      true,
    );
  });
}

/** Solid rounded panel background, used for dialog/HUD chrome. */
function panelTexture(scene: Phaser.Scene, key: string, w: number, h: number, fill: number, stroke: number, radius = 12, strokeWidth = 2): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(fill, 0.94);
  g.fillRoundedRect(0, 0, w, h, radius);
  if (strokeWidth > 0) {
    g.lineStyle(strokeWidth, stroke, 1);
    g.strokeRoundedRect(1, 1, w - 2, h - 2, radius);
  }
  g.generateTexture(key, w, h);
  g.destroy();
}

export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  // Player token
  circleToken(scene, 'tok_player', PALETTE.player, PALETTE.bone, 56);

  // Enemy tokens — one per bestiary entry, colored by rough archetype
  const enemyColors: Record<string, number> = {
    echo_skeleton: 0x8a8a82,
    venn_custodian: 0x6f7f8f,
    sable_zealot: 0x8c2f2f,
    ash_seer: 0x7b4b9e,
    memory_wraith: 0x5dade2,
    sable_inquisitor: 0xa23a3a,
    ash_mutant: 0x5a3a6e,
    echo_soldier: 0x556b78,
    dust_wight: 0x7a6a52,
    dust_road_raider: 0xc08a3e,
    archive_cipher_wraith: 0x4a6fa5,
    the_unread: 0x2c1f3d,
    sera_voss: 0xb08a4e,
  };
  for (const id of Object.keys({ ...ENEMIES, ...SUMMON_ENEMIES })) {
    circleToken(scene, `tok_${id}`, enemyColors[id] ?? 0x77777f, PALETTE.bone, 52);
  }

  // Boss tokens — larger hex silhouettes
  const bossColors: Record<string, number> = {
    sentinel: 0xb9c4cc,
    patriarch: 0x8c2f2f,
    chorus: 0x9b59b6,
    fossil_king: 0x7a6a4f,
    reflection: 0xd8c08a,
  };
  for (const id of Object.keys(BOSSES)) {
    hexToken(scene, `tok_${id}`, bossColors[id] ?? PALETTE.gold, PALETTE.goldBright, 112);
  }

  // Node-type icons for the board
  diamondIcon(scene, 'node_event', PALETTE.gold);
  triangleIcon(scene, 'node_combat', PALETTE.danger);
  crossIcon(scene, 'node_rest', PALETTE.ok);
  starIcon(scene, 'node_discovery', 0x5dade2);
  triangleIcon(scene, 'node_trap', 0xe67e22);
  crownIcon(scene, 'node_landmark', PALETTE.goldBright, 44);

  // Faction emblem swatches (small squares, used in UI bars)
  for (const f of Object.values(FACTIONS)) {
    shapeTexture(scene, `faction_${f.id}`, 24, (g) => {
      g.fillStyle(f.color, 1);
      g.fillRoundedRect(2, 2, 20, 20, 4);
    });
  }

  // Board HUD action-row icons
  shapeTexture(scene, 'icon_character', 56, (g) => {
    g.fillStyle(PALETTE.boneMuted, 1);
    g.fillCircle(28, 20, 11); // head
    g.fillEllipse(28, 44, 26, 20); // shoulders
  });
  shapeTexture(scene, 'icon_codex', 56, (g) => {
    g.fillStyle(PALETTE.boneMuted, 1);
    g.fillRoundedRect(10, 10, 36, 36, 3);
    g.lineStyle(2, PALETTE.stone, 1);
    g.lineBetween(28, 12, 28, 44);
    g.lineBetween(14, 20, 24, 20);
    g.lineBetween(14, 28, 24, 28);
    g.lineBetween(32, 20, 42, 20);
    g.lineBetween(32, 28, 42, 28);
  });
  shapeTexture(scene, 'icon_skills', 56, (g) => {
    g.lineStyle(5, PALETTE.boneMuted, 1);
    g.lineBetween(12, 12, 44, 44);
    g.lineBetween(44, 12, 12, 44);
    g.fillStyle(PALETTE.boneMuted, 1);
    g.fillTriangle(12, 12, 20, 12, 12, 20);
    g.fillTriangle(44, 12, 36, 12, 44, 20);
    g.fillTriangle(12, 44, 20, 44, 12, 36);
    g.fillTriangle(44, 44, 36, 44, 44, 36);
  });
  shapeTexture(scene, 'icon_shop', 56, (g) => {
    g.lineStyle(3, PALETTE.boneMuted, 1);
    g.strokeRoundedRect(12, 20, 32, 26, 3);
    g.beginPath();
    g.arc(28, 20, 10, Math.PI, 0, false);
    g.strokePath();
  });
  shapeTexture(scene, 'icon_menu', 56, (g) => {
    g.lineStyle(3, PALETTE.boneMuted, 1);
    for (let i = 0; i < 3; i++) {
      g.strokeCircle(28, 28, 6 + i * 7);
    }
  });
  shapeTexture(scene, 'icon_settings', 56, (g) => {
    g.fillStyle(PALETTE.boneMuted, 1);
    const cx = 28;
    const cy = 28;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      g.fillRect(cx + Math.cos(a) * 16 - 3, cy + Math.sin(a) * 16 - 3, 6, 6);
    }
    g.fillCircle(cx, cy, 12);
    g.fillStyle(PALETTE.stone, 1);
    g.fillCircle(cx, cy, 6);
  });

  // UI chrome
  panelTexture(scene, 'panel_dialog', 800, 220, PALETTE.stone, PALETTE.gold);
  panelTexture(scene, 'panel_stat', 300, 165, PALETTE.stone, PALETTE.boneMuted);
  panelTexture(scene, 'panel_button', 260, 52, PALETTE.stoneLight, PALETTE.gold, 8);
  panelTexture(scene, 'panel_button_hover', 260, 52, PALETTE.gold, PALETTE.goldBright, 8);
  panelTexture(scene, 'panel_stepper', 40, 40, PALETTE.stoneLight, PALETTE.gold, 6);
  panelTexture(scene, 'panel_preset', 120, 38, PALETTE.stoneLight, PALETTE.gold, 6);
  panelTexture(scene, 'panel_preset_hover', 120, 38, PALETTE.gold, PALETTE.goldBright, 6);
  panelTexture(scene, 'panel_combat_hud', 780, 160, PALETTE.stone, PALETTE.gold);
  panelTexture(scene, 'panel_enemy', 150, 220, PALETTE.stone, PALETTE.boneMuted, 6, 0);
  shapeTexture(scene, 'particle', 8, (g) => { g.fillStyle(0xffffff, 1); g.fillCircle(4, 4, 3); });
}
