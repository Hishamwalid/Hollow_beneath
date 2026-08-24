import Phaser from 'phaser';
import { INTRO_SCREEN, TUTORIAL_SCREENS, type TutorialScreen } from '@data/tutorialText';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { createSectionLabel, createTitle, createDivider } from '@ui/headings';
import { createButton } from '@ui/Button';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { audio } from '@placeholder/PlaceholderAudio';
import { settingsManager } from '@systems/SettingsManager';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

interface TutorialSceneData {
  returnTo?: string;
  /** Single-screen mode: show only the intro page, then continue to creation. */
  introOnly?: boolean;
}

/**
 * Two roles:
 *  • introOnly — one 3-line screen before the first descent (that's all).
 *  • Field Manual — optional reference pages from Menu → How to Play.
 */
export class TutorialScene extends Phaser.Scene {
  private screens: TutorialScreen[] = [];
  private screenIndex = 0;
  private fullText = '';
  private charIndex = 0;
  private timer: Phaser.Time.TimerEvent | null = null;
  private titleText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private skipText!: Phaser.GameObjects.Text;
  private iconContainer!: Phaser.GameObjects.Container;
  private introBtn?: ReturnType<typeof createButton>;
  private busy = false;
  private returnTo = 'Menu';

  constructor() {
    super('Tutorial');
  }

  create(data?: TutorialSceneData) {
    this.returnTo = data?.returnTo ?? 'Menu';
    this.screens = data?.introOnly ? [INTRO_SCREEN] : TUTORIAL_SCREENS;
    this.screenIndex = 0;
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);

    const cx = GAME_WIDTH / 2;

    // ---- Dedicated intro: a single journal moment before the sinkhole ---------
    if (data?.introOnly) {
      this.buildIntroScreen();
      return;
    }

    if (!data?.introOnly) {
      createSectionLabel(this, cx, 44, 'Field Manual', { origin: [0.5, 0.5] });
    }

    this.titleText = this.add.text(cx, 80, '', {
      fontFamily: FONT_SERIF, fontSize: '28px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5).setDepth(10);
    if (typeof this.titleText.setLetterSpacing === 'function') this.titleText.setLetterSpacing(2);

    const panelBg = this.add.nineslice(cx, 250, 'paper_panel', undefined, 840, 280, 24, 24, 24, 24).setDepth(10);

    this.bodyText = this.add.text(cx - 380, 140, '', {
      fontFamily: FONT_BODY, fontSize: '17px', color: PALETTE_HEX.ink,
      wordWrap: { width: 760 }, lineSpacing: 7,
    }).setDepth(11);

    this.promptText = this.add.text(cx + 380, 372, '▾ Continue', {
      fontFamily: FONT_BODY, fontSize: '16px', color: PALETTE_HEX.oxide,
    }).setOrigin(1, 0).setDepth(12).setAlpha(0);

    this.skipText = this.add.text(GAME_WIDTH - 20, 20, data?.introOnly ? '[Skip]' : '[Close Manual]', {
      fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(1, 0).setDepth(20).setInteractive({ useHandCursor: true });
    this.skipText.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopImmediatePropagation?.();
      this.exitTutorial();
    });
    this.skipText.on('pointerover', () => this.skipText.setColor(PALETTE_HEX.gold));
    this.skipText.on('pointerout', () => this.skipText.setColor(PALETTE_HEX.boneMuted));

    this.iconContainer = this.add.container(0, 0).setDepth(12);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.busy) return;
      if (this.charIndex < this.fullText.length) {
        this.skipTypewriter();
      } else {
        this.advance();
      }
    });

    this.showScreen(0);
  }

  /** The one pre-descent moment: ornamented title, parchment sheet, one button.
   *  Deliberately timer-free — three lines render instantly so nothing can
   *  leave this screen blank (bad textSpeed values included). */
  private buildIntroScreen() {
    const cx = GAME_WIDTH / 2;
    const screen = INTRO_SCREEN;

    const title = createTitle(this, cx, 190, screen.title, { size: '42px' });
    title.setDepth(5);
    const divContainer = this.add.container(0, 0).setDepth(5);
    createDivider(this, divContainer, cx, 244, 360);

    const sheet = this.add.nineslice(cx, 430, 'paper_panel', undefined, 760, 230, 24, 24, 24, 24).setDepth(4);
    void sheet;

    const body = this.add.text(cx, 430, screen.body, {
      fontFamily: FONT_BODY,
      fontSize: '19px',
      color: PALETTE_HEX.ink,
      align: 'center',
      wordWrap: { width: 660 },
      lineSpacing: 9,
    }).setOrigin(0.5).setDepth(6);
    void body;

    const btn = createButton(this, cx, 600, 'To the sinkhole', () => this.exitTutorial(), {
      width: 280, height: 54, fontSize: '18px', variant: 'primary', depth: 6,
    });
    [title, btn.container].forEach((o, i) => {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 500, delay: 200 + i * 350, ease: 'Sine.easeOut' });
    });
  }

  private showScreen(index: number) {
    const screen = this.screens[index];
    if (!screen) { this.exitTutorial(); return; }

    this.screenIndex = index;
    this.titleText.setText(screen.title);

    this.fullText = screen.body;
    this.charIndex = 0;
    this.bodyText.setText('');
    this.promptText.setAlpha(0);

    this.timer?.remove();
    // Same NaN guard as DialogBox — corrupted settings must not freeze typing.
    const rawSpeed = Number(settingsManager.get().textSpeed);
    const spd = Number.isFinite(rawSpeed) && rawSpeed > 0 ? Math.max(20, rawSpeed) : 100;
    const delay = Math.round(14 * (100 / spd));
    this.timer = this.time.addEvent({ delay: Number.isFinite(delay) && delay > 0 ? delay : 14, callback: this.tick, loop: true });

    this.iconContainer.removeAll(true);
    const icons = screen.icons ?? [];
    const iconStartX = GAME_WIDTH / 2 - (icons.length - 1) * 30;
    icons.forEach((key, i) => {
      const img = this.add.image(iconStartX + i * 60, 416, key).setDisplaySize(30, 30).setDepth(13);
      this.iconContainer.add(img);
    });
  }

  private tick = () => {
    this.charIndex += 1;
    this.bodyText.setText(this.fullText.slice(0, this.charIndex));
    if (this.charIndex >= this.fullText.length) {
      this.timer?.remove();
      this.timer = null;
      this.promptText.setAlpha(1);
    }
  };

  private skipTypewriter() {
    if (this.timer) {
      this.timer.remove();
      this.timer = null;
    }
    this.charIndex = this.fullText.length;
    this.bodyText.setText(this.fullText);
    this.promptText.setAlpha(1);
  }

  private advance() {
    if (this.busy) return;
    this.busy = true;
    audio.click();
    const next = this.screenIndex + 1;
    if (next >= this.screens.length) {
      this.exitTutorial();
    } else {
      audio.pageTurn();
      this.cameras.main.fadeOut(150, 0, 0, 0);
      this.time.delayedCall(150, () => {
        this.showScreen(next);
        this.cameras.main.fadeIn(150, 0, 0, 0);
        this.busy = false;
      });
    }
  }

  private exitTutorial() {
    this.busy = true;
    this.timer?.remove();
    this.timer = null;
    audio.click();
    fadeToScene(this, this.returnTo);
  }
}
