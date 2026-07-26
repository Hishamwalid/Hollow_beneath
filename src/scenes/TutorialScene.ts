import Phaser from 'phaser';
import { TUTORIAL_SCREENS } from '@data/tutorialText';
import { FONT_SERIF, FONT_MONO, PALETTE_HEX } from '@ui/uiTheme';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { audio } from '@placeholder/PlaceholderAudio';
import { settingsManager } from '@systems/SettingsManager';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

interface TutorialSceneData {
  returnTo?: string;
}

export class TutorialScene extends Phaser.Scene {
  private screenIndex = 0;
  private fullText = '';
  private charIndex = 0;
  private timer: Phaser.Time.TimerEvent | null = null;
  private titleText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private skipText!: Phaser.GameObjects.Text;
  private iconContainer!: Phaser.GameObjects.Container;
  private busy = false;
  private returnTo = 'Menu';

  constructor() {
    super('Tutorial');
  }

  create(data?: TutorialSceneData) {
    this.returnTo = data?.returnTo ?? 'Menu';
    this.screenIndex = 0;
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);

    const cx = GAME_WIDTH / 2;

    this.titleText = this.add.text(cx, 80, '', {
      fontFamily: FONT_SERIF, fontSize: '28px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5).setDepth(10);

    const panelBg = this.add.image(cx, 250, 'panel_dialog').setDisplaySize(800, 240).setDepth(10);
    panelBg.setAlpha(0.9);

    this.bodyText = this.add.text(cx - 370, 160, '', {
      fontFamily: FONT_SERIF, fontSize: '17px', color: PALETTE_HEX.bone,
      wordWrap: { width: 740 }, lineSpacing: 6,
    }).setDepth(11);

    this.promptText = this.add.text(cx + 370, 350, '▾ Continue', {
      fontFamily: FONT_SERIF, fontSize: '15px', color: PALETTE_HEX.gold,
    }).setOrigin(1, 0).setDepth(12).setAlpha(0);

    this.skipText = this.add.text(GAME_WIDTH - 20, 20, '[Skip Tutorial]', {
      fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted,
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

  private showScreen(index: number) {
    const screen = TUTORIAL_SCREENS[index];
    if (!screen) { this.exitTutorial(); return; }

    this.screenIndex = index;
    this.titleText.setText(screen.title);

    this.fullText = screen.body;
    this.charIndex = 0;
    this.bodyText.setText('');
    this.promptText.setAlpha(0);

    this.timer?.remove();
    const spd = settingsManager.get().textSpeed;
    this.timer = this.time.addEvent({ delay: Math.round(14 * (100 / spd)), callback: this.tick, loop: true });

    this.iconContainer.removeAll(true);
    const icons = screen.icons ?? [];
    const iconStartX = GAME_WIDTH / 2 - (icons.length - 1) * 30;
    icons.forEach((key, i) => {
      const img = this.add.image(iconStartX + i * 60, 400, key).setDisplaySize(32, 32).setDepth(13);
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
    if (next >= TUTORIAL_SCREENS.length) {
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
