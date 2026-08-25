import Phaser from 'phaser';
import { settingsManager } from '@systems/SettingsManager';
import { CREDITS } from '@data/credits';
import { FONT_BODY, FONT_SERIF, FONT_MONO, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { createTitle, createSectionLabel } from '@ui/headings';
import { createSlider, createToggle, createModal } from '@ui/controls';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

// ============================================================================
// Settings — everything applies LIVE. No scene restarts, no lost scroll:
// sliders stream changes as they drag; toggles stamp in place; difficulty
// swaps its own highlight. Credits page through instead of truncating.
// ============================================================================

const CREDITS_PER_PAGE = 6;

export class SettingsScene extends Phaser.Scene {
  private creditsPage = 0;
  private creditsContainer?: Phaser.GameObjects.Container;
  private creditsPagerText?: Phaser.GameObjects.Text;

  constructor() {
    super('Settings');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const cx = GAME_WIDTH / 2;
    const settings = settingsManager.get();

    createTitle(this, cx, 50, 'Settings');

    this.buildVolumeSlider(cx, settings.masterVolume);
    this.buildMusicSlider(cx, settings.musicVolume);
    this.buildTextSpeedSlider(cx, settings.textSpeed);
    this.buildScreenShakeToggle(cx, settings.screenShake);
    this.buildReduceMotionToggle(cx, settings.reduceMotion);
    this.buildLargeTextToggle(cx, settings.largeText);
    this.buildDifficulty(cx);
    this.buildCredits(cx);
    this.buildClearData(cx);
    this.buildBackButton(cx);

    // Esc always returns to the menu.
    this.input.keyboard?.on('keydown-ESC', () => fadeToScene(this, 'Menu'));
  }

  private buildVolumeSlider(cx: number, initial: number) {
    const y = 140;
    createSectionLabel(this, cx - 300, y, 'Master Volume', { color: PALETTE_HEX.bone });
    const valueLabel = this.add.text(cx + 180, y, `${Math.round(initial)}%`, {
      fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.gold,
    }).setOrigin(0, 0.5);

    createSlider(this, cx - 40, y, 240, initial, (v) => {
      // Store rounded like the label says — one truth, no drift.
      const rounded = Math.round(v);
      settingsManager.set({ masterVolume: rounded });
      audio.setMasterVolume(rounded);
      valueLabel.setText(`${rounded}%`);
    });
  }

  private buildMusicSlider(cx: number, initial: number) {
    const y = 190;
    createSectionLabel(this, cx - 300, y, 'Music', { color: PALETTE_HEX.bone });
    this.add.text(cx - 296, y + 18, 'procedural descent beds — 0 for silence', {
      fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(0, 0.5);
    const valueLabel = this.add.text(cx + 180, y, `${Math.round(initial)}%`, {
      fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.gold,
    }).setOrigin(0, 0.5);

    createSlider(this, cx - 40, y, 240, initial, (v) => {
      const rounded = Math.round(v);
      settingsManager.set({ musicVolume: rounded });
      audio.setMusicVolume(rounded);
      valueLabel.setText(`${rounded}%`);
    });
  }

  private buildTextSpeedSlider(cx: number, initial: number) {
    const y = 245;
    createSectionLabel(this, cx - 300, y, 'Text Speed', { color: PALETTE_HEX.bone });
    const valueLabel = this.add.text(cx + 180, y, `${Math.round(initial)}%`, {
      fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.gold,
    }).setOrigin(0, 0.5);

    this.add.text(cx - 100, y + 26, 'Slower', {
      fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(0, 0.5);
    this.add.text(cx + 140, y + 26, 'Faster', {
      fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(1, 0.5);

    createSlider(this, cx - 40, y, 240, initial, (v) => {
      settingsManager.set({ textSpeed: Math.round(v) });
      valueLabel.setText(`${Math.round(v)}%`);
    });
  }

  private buildScreenShakeToggle(cx: number, initial: boolean) {
    const y = 300;
    createSectionLabel(this, cx - 300, y, 'Screen Shake', { color: PALETTE_HEX.bone });
    createToggle(this, cx + 60, y, '', initial, (on) => {
      settingsManager.set({ screenShake: on });
    }, { width: 220 });
  }

  private buildReduceMotionToggle(cx: number, initial: boolean) {
    const y = 345;
    createSectionLabel(this, cx - 300, y, 'Reduce Motion', { color: PALETTE_HEX.bone });
    this.add.text(cx - 296, y + 18, 'calms shakes & large movement', {
      fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(0, 0.5);
    createToggle(this, cx + 60, y, '', initial, (on) => {
      settingsManager.set({ reduceMotion: on });
    }, { width: 220 });
  }

  private buildLargeTextToggle(cx: number, initial: boolean) {
    const y = 392;
    createSectionLabel(this, cx - 300, y, 'Large Text', { color: PALETTE_HEX.bone });
    this.add.text(cx - 296, y + 18, 'scales dialog & ending prose ~15%', {
      fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(0, 0.5);
    createToggle(this, cx + 60, y, '', initial, (on) => {
      settingsManager.set({ largeText: on });
    }, { width: 220 });
  }

  /** Segmented difficulty control — the active mode carries a gold underline. */
  private buildDifficulty(cx: number) {
    const modes = ['easy', 'normal', 'hard', 'ironman'] as const;
    const y = 428;
    let current = settingsManager.get().difficulty;

    createSectionLabel(this, cx - 300, y, 'Difficulty', { color: PALETTE_HEX.bone });

    const marks: Record<string, Phaser.GameObjects.Rectangle> = {};
    const labels: Record<string, Phaser.GameObjects.Text> = {};
    let x = cx - 120;
    for (const mode of modes) {
      const label = this.add.text(x, y, mode[0].toUpperCase() + mode.slice(1), {
        fontFamily: FONT_MONO, fontSize: '13px',
        color: mode === current ? PALETTE_HEX.gold : PALETTE_HEX.boneMuted,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const mark = this.add.rectangle(x, y + 14, label.width - 6, 2, parseInt(PALETTE_HEX.gold.replace('#', ''), 16), mode === current ? 0.95 : 0);
      labels[mode] = label;
      marks[mode] = mark;
      label.on('pointerover', () => { if (mode !== current) label.setColor(PALETTE_HEX.gold); });
      label.on('pointerout', () => { if (mode !== current) label.setColor(PALETTE_HEX.boneMuted); });
      label.on('pointerdown', () => {
        if (mode === current) return;
        current = mode;
        settingsManager.set({ difficulty: mode });
        audio.click();
        for (const m of modes) {
          const on = m === current;
          labels[m].setColor(on ? PALETTE_HEX.gold : PALETTE_HEX.boneMuted);
          if (on && !reducedMotionPulse(marks[m])) {
            this.tweens.add({ targets: marks[m], alpha: { from: 0, to: 0.95 }, duration: 180 });
          }
          marks[m].setFillStyle(parseInt(PALETTE_HEX.gold.replace('#', ''), 16), on ? 0.95 : 0);
        }
      });
      x += 82;
    }
  }

  private buildCredits(cx: number) {
    const topY = 462;
    this.add.rectangle(cx, topY - 8, 600, 1, parseInt(PALETTE_HEX.gold.replace('#', ''), 16), 0.3);
    createSectionLabel(this, cx - 300, topY + 10, 'Credits');
    this.creditsPagerText = this.add.text(cx + 300, topY + 10, '', {
      fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(1, 0.5);

    // Pager arrows live inline beside the counter — the old bottom placement
    // rendered underneath the Clear All Data button.
    const prevBtn = this.add.text(cx + 318, topY + 10, '‹', {
      fontFamily: FONT_MONO, fontSize: '16px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const nextBtn = this.add.text(cx + 356, topY + 10, '›', {
      fontFamily: FONT_MONO, fontSize: '16px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    prevBtn.on('pointerdown', () => this.flipCredits(-1));
    nextBtn.on('pointerdown', () => this.flipCredits(1));

    this.renderCreditsPage(cx, topY + 36);
  }

  private flipCredits(delta: number): void {
    const pageCount = Math.max(1, Math.ceil(CREDITS.length / CREDITS_PER_PAGE));
    this.creditsPage = Phaser.Math.Clamp(this.creditsPage + delta, 0, pageCount - 1);
    audio.pageTurn();
    this.renderCreditsPage(GAME_WIDTH / 2, 498);
  }

  private renderCreditsPage(cx: number, startY: number): void {
    this.creditsContainer?.destroy();
    const container = this.add.container(0, 0);
    this.creditsContainer = container;

    const pageCount = Math.max(1, Math.ceil(CREDITS.length / CREDITS_PER_PAGE));
    this.creditsPagerText?.setText(`${this.creditsPage + 1} / ${pageCount}`);

    const slice = CREDITS.slice(this.creditsPage * CREDITS_PER_PAGE, (this.creditsPage + 1) * CREDITS_PER_PAGE);
    let y = startY;
    slice.forEach((line) => {
      const isTitle = line === 'THE HOLLOW BENEATH';
      const isEmpty = line.trim() === '';
      const t = this.add.text(cx, y, isEmpty ? '' : line, {
        fontFamily: isTitle ? FONT_SERIF : FONT_BODY,
        fontSize: isTitle ? '15px' : '13px',
        color: isTitle ? PALETTE_HEX.gold : PALETTE_HEX.boneMuted,
        wordWrap: { width: 640 },
        align: 'center',
      }).setOrigin(0.5, 0);
      container.add(t);
      y += isEmpty ? 10 : (isTitle ? 24 : 20);
    });
  }

  private buildClearData(cx: number) {
    const y = 640;
    this.add.rectangle(cx, y, 600, 1, parseInt(PALETTE_HEX.gold.replace('#', ''), 16), 0.3);
    createButton(this, cx, y + 42, 'Clear All Data', () => this.showClearConfirm(), {
      width: 260, height: 44, fontSize: '16px', variant: 'secondary',
    });
  }

  /** Kit modal — veil click and Cancel both dismiss; buttons live inside it. */
  private showClearConfirm(): void {
    const modal = createModal(this, 'Clear All Data', 500, 230, { variant: 'stone', depth: 100 });
    modal.container.add(
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24,
        'This will delete all Echo Shards,\nunlocks, lore, and progress.\n\nThis cannot be undone.',
        { fontFamily: FONT_BODY, fontSize: '15px', color: PALETTE_HEX.bone, align: 'center', lineSpacing: 5 },
      ).setOrigin(0.5),
    );
    const confirm = createButton(this, GAME_WIDTH / 2 - 105, GAME_HEIGHT / 2 + 52, 'Clear Everything', () => {
      localStorage.removeItem('hollow_beneath_save_v1');
      settingsManager.reset();
      this.scene.restart();
    }, { width: 170, height: 38, fontSize: '13px' });
    const cancel = createButton(this, GAME_WIDTH / 2 + 105, GAME_HEIGHT / 2 + 52, 'Cancel', () => {
      audio.click();
      modal.close();
    }, { width: 120, height: 38, fontSize: '13px' });
    modal.container.add([confirm.container, cancel.container]);
  }

  private buildBackButton(cx: number) {
    createButton(this, cx, GAME_HEIGHT - 60, 'Back', () => fadeToScene(this, 'Menu'), { width: 200 });
  }
}

function reducedMotionPulse(_target: Phaser.GameObjects.Rectangle): boolean {
  // Kept as a hook: pulse suppression would consult settings here.
  return false;
}
