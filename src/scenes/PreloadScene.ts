import Phaser from 'phaser';
import { generatePlaceholderTextures, PALETTE } from '@placeholder/PlaceholderTextures';
import { useGameStore } from '@store/gameStore';
import { fadeToScene } from '@systems/sceneTransition';
import { reducedMotion } from '@systems/motion';
import { FONT_BODY, FONT_MONO, FONT_SERIF } from '@ui/uiTheme';

// ============================================================================
// Boot load screen — the first thing anyone sees. A gold hairline fills as
// the Hollow loads, under a single tracked line of Cinzel. No art needed:
// the theme carries it.
// ============================================================================

const BAR_W = 420;
const BAR_H = 3;

export class PreloadScene extends Phaser.Scene {
  private barFill?: Phaser.GameObjects.Rectangle;
  private pctText?: Phaser.GameObjects.Text;
  private tipText?: Phaser.GameObjects.Text;

  constructor() {
    super('Preload');
  }

  preload() {
    // ---- Themed chrome first, so the player never stares at a void -------
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    this.cameras.main.setBackgroundColor(PALETTE.void);

    const title = this.add.text(cx, cy - 64, 'THE HOLLOW BENEATH', {
      fontFamily: FONT_SERIF,
      fontSize: '26px',
      color: '#c9a24b',
    }).setOrigin(0.5);
    if (typeof title.setLetterSpacing === 'function') title.setLetterSpacing(6);

    const sub = this.add.text(cx, cy - 30, 'entering the hollow…', {
      fontFamily: FONT_BODY,
      fontSize: '15px',
      fontStyle: 'italic',
      color: '#9a9488',
    }).setOrigin(0.5);

    const track = this.add.rectangle(cx - BAR_W / 2, cy + 18, BAR_W, BAR_H, 0x22262c, 1).setOrigin(0, 0.5)
      .setStrokeStyle(1, 0xc9a24b, 0.35);
    this.barFill = this.add.rectangle(cx - BAR_W / 2 + 1, cy + 18, 1, BAR_H - 2, 0xc9a24b, 1).setOrigin(0, 0.5);
    void track;

    this.pctText = this.add.text(cx, cy + 40, '0%', {
      fontFamily: FONT_MONO,
      fontSize: '12px',
      color: '#9a9488',
    }).setOrigin(0.5, 0);

    this.tipText = this.add.text(cx, height - 46, '', {
      fontFamily: FONT_BODY,
      fontSize: '13px',
      fontStyle: 'italic',
      color: '#6b5a41',
      wordWrap: { width: 700 },
      align: 'center',
    }).setOrigin(0.5, 0.5);

    if (!reducedMotion()) {
      title.setAlpha(0);
      sub.setAlpha(0);
      this.tweens.add({ targets: [title, sub], alpha: 1, duration: 500, ease: 'Sine.easeOut' });
    }
    this.rotateTip();

    // ---- Progress wiring --------------------------------------------------
    this.load.on('progress', (v: number) => {
      if (this.barFill) this.barFill.width = Math.max(1, (BAR_W - 2) * v);
      this.pctText?.setText(`${Math.round(v * 100)}%`);
    });
    this.load.once('complete', () => {
      if (this.barFill) this.barFill.width = BAR_W - 2;
      this.pctText?.setText('100%');
    });

    for (let i = 1; i <= 5; i++) {
      this.load.image(`map_${i}`, `assets/image_assets/backgrounds/map${i}.png`);
    }
    for (const state of ['idle', 'windup', 'attack', 'hit', 'victory', 'defeated', 'guard']) {
      this.load.image(`player_${state}`, `assets/image_assets/player/${state}.png`);
    }
    this.load.image('player_face', 'assets/image_assets/player/face.png');
    this.load.image('profile_player', 'assets/image_assets/player/profile_player.png');
    for (const enemyId of ['echo_skeleton', 'dust_wight']) {
      for (const state of ['idle', 'attack', 'hit']) {
        this.load.image(`enemy_${enemyId}_${state}`, `assets/image_assets/enemy/${enemyId}/${state}.png`);
      }
      this.load.image(`enemy_${enemyId}_face`, `assets/image_assets/enemy/${enemyId}/face.png`);
    }
    for (const state of ['idle', 'attack', 'hit']) {
      this.load.image(`enemy_${state}`, `assets/image_assets/enemy/${state}.png`);
    }
    for (const frame of ['idle1', 'idle2', 'attack1', 'attack2', 'hit1', 'hit2', 'guard1', 'victory1', 'victory2', 'transform1', 'transform2', 'defeat1', 'defeat2', 'defeat3']) {
      this.load.image(`enemy_sentinel_${frame}`, `assets/image_assets/enemy/sentinel/${frame}.png`);
    }
    this.load.image('enemy_sentinel_face1', 'assets/image_assets/enemy/sentinel/face1.png');
    this.load.image('enemy_sentinel_face2', 'assets/image_assets/enemy/sentinel/face2.png');
    this.load.image('enemy_sentinel_half', 'assets/image_assets/enemy/sentinel/half.png');
    this.load.image('bg_combat_stage1_sand', 'assets/image_assets/backgrounds/combat_stage1_sand.png');
    this.load.image('bg_combat_stage1_stone', 'assets/image_assets/backgrounds/combat_stage1_stone.png');
    this.load.image('bg_combat_stage1_boss', 'assets/image_assets/backgrounds/combat_stage1_boss.png');
    this.load.image('player_pin', 'assets/image_assets/player/player_pin.png');
    this.load.image('panel_book', 'assets/image_assets/ui/panel_book.png');
    this.load.image('token_7', 'assets/image_assets/ui/token_7.png');
  }

  /** Slow-cycling descent whispers while the world streams in. */
  private rotateTip(): void {
    const tips = [
      'The Venn did not die. They left.',
      'Resonance is a door that opens both ways.',
      'Guard is an economy, not a panic button.',
      'Weakness discovered is weakness exploited.',
      'The Deep stares at you. The emotion in its gaze is the comfort of freedom itself.',
    ];
    let i = Math.floor(Math.random() * tips.length);
    const show = () => {
      this.tipText?.setText(tips[i % tips.length]);
      i += 1;
    };
    show();
    this.time.addEvent({ delay: 2600, loop: true, callback: show });
  }

  create() {
    generatePlaceholderTextures(this);
    useGameStore.getState().initFromDisk();
    // Let the full bar read for a beat before handing over.
    this.time.delayedCall(reducedMotion() ? 150 : 450, () => fadeToScene(this, 'Menu'));
  }
}
