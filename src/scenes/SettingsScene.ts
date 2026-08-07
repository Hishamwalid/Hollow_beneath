import Phaser from 'phaser';
import { settingsManager, type GameSettings } from '@systems/SettingsManager';
import { CREDITS } from '@data/credits';
import { FONT_BODY, FONT_SERIF, FONT_MONO, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

interface SliderHandle {
  setValue: (v: number) => void;
  container: Phaser.GameObjects.Container;
}

function createSlider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  initial: number,
  onChange: (v: number) => void,
): SliderHandle {
  const trackH = 10;
  const thumbR = 8;
  let value = Phaser.Math.Clamp(initial, 0, 100);

  const track = scene.add.rectangle(x, y, width, trackH, 0x22262c).setStrokeStyle(1, 0xc9a24b, 0.4).setOrigin(0, 0.5).setDepth(1);
  const fill = scene.add.rectangle(x + 2, y, Math.max(4, (width - 4) * (value / 100)), trackH - 4, 0xc9a24b, 0.6).setOrigin(0, 0.5).setDepth(2);
  const thumb = scene.add.circle(x + (width - 4) * (value / 100) + 2, y, thumbR, 0xe9c876).setStrokeStyle(1, 0x9a9488).setDepth(3);

  const setValue = (v: number) => {
    value = Phaser.Math.Clamp(v, 0, 100);
    fill.setSize(Math.max(4, (width - 4) * (value / 100)), trackH - 4);
    thumb.setPosition(x + (width - 4) * (value / 100) + 2, y);
    onChange(value);
  };

  const container = scene.add.container(0, 0, [track, fill, thumb]);

  const hitArea = scene.add.rectangle(x, y, width + 24, Math.max(trackH + 16, thumbR * 4), 0x000000, 0).setOrigin(0, 0.5).setDepth(4).setInteractive({ useHandCursor: true });
  container.addAt(hitArea, 0);

  hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    const relX = Phaser.Math.Clamp(pointer.x - x, 0, width);
    setValue((relX / width) * 100);
  });

  scene.input.setDraggable(hitArea);
  hitArea.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => {
    const relX = Phaser.Math.Clamp(dragX - x, 0, width);
    setValue((relX / width) * 100);
  });

  return { setValue, container };
}

export class SettingsScene extends Phaser.Scene {
  private content: Phaser.GameObjects.Container[] = [];

  constructor() {
    super('Settings');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const cx = GAME_WIDTH / 2;
    const settings = settingsManager.get();

    this.add.text(cx, 50, 'Settings', { fontFamily: FONT_SERIF, fontSize: '34px', color: PALETTE_HEX.gold }).setOrigin(0.5);

    this.buildVolumeSlider(cx, settings);
    this.buildTextSpeedSlider(cx, settings);
    this.buildScreenShakeToggle(cx, settings);
    this.buildCredits(cx);
    this.buildClearData(cx);
    this.buildBackButton(cx);
  }

  private buildVolumeSlider(cx: number, settings: GameSettings) {
    const y = 140;
    this.addSettingsLabel(cx - 300, y, 'Master Volume');
    const valueLabel = this.add.text(cx + 180, y, `${settings.masterVolume}%`, {
      fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.gold,
    }).setOrigin(0, 0.5);

    createSlider(this, cx - 80, y, 240, settings.masterVolume, (v) => {
      settingsManager.set({ masterVolume: v });
      audio.setMasterVolume(v);
      valueLabel.setText(`${Math.round(v)}%`);
      audio.click();
    });
  }

  private buildTextSpeedSlider(cx: number, settings: GameSettings) {
    const y = 210;
    this.addSettingsLabel(cx - 300, y, 'Text Speed');
    const valueLabel = this.add.text(cx + 180, y, `${settings.textSpeed}%`, {
      fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.gold,
    }).setOrigin(0, 0.5);

    this.add.text(cx - 100, y + 18, 'Slower', {
      fontFamily: FONT_MONO, fontSize: '12px', color: '#555555',
    }).setOrigin(0, 0.5);
    this.add.text(cx + 140, y + 18, 'Faster', {
      fontFamily: FONT_MONO, fontSize: '12px', color: '#555555',
    }).setOrigin(0, 0.5);

    createSlider(this, cx - 80, y, 240, settings.textSpeed, (v) => {
      settingsManager.set({ textSpeed: Math.round(v) });
      valueLabel.setText(`${Math.round(v)}%`);
    });
  }

  private buildScreenShakeToggle(cx: number, settings: GameSettings) {
    const y = 300;

    this.addSettingsLabel(cx - 300, y, 'Screen Shake');

    const toggle = createButton(this, cx + 40, y, settings.screenShake ? 'ON' : 'OFF', () => {
      const next = !settingsManager.get().screenShake;
      settingsManager.set({ screenShake: next });
      toggle.container.destroy();
      this.scene.restart();
    }, { width: 80, height: 36, fontSize: '14px' });
  }

  private buildCredits(cx: number) {
    let y = 370;
    const divider = this.add.rectangle(cx, y, 600, 1, 0xc9a24b, 0.3).setDepth(1);
    y += 20;

    this.add.text(cx, y, 'Credits', {
      fontFamily: FONT_SERIF, fontSize: '18px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5);
    y += 30;

    const maxLines = 14;
    const shown = CREDITS.slice(0, maxLines);
    shown.forEach((line) => {
      if (y > GAME_HEIGHT - 80) return;
      const isTitle = line === 'THE HOLLOW BENEATH';
      const isEmpty = line === '';
      const t = this.add.text(cx, y, line, {
        fontFamily: isTitle ? FONT_SERIF : FONT_BODY,
        fontSize: isTitle ? '16px' : '13px',
        color: isTitle ? PALETTE_HEX.gold : (isEmpty ? 'transparent' : PALETTE_HEX.boneMuted),
        fontStyle: isTitle ? 'normal' : 'normal',
      }).setOrigin(0.5);
      y += isEmpty ? 10 : (isTitle ? 24 : 20);
    });
    if (CREDITS.length > maxLines) {
      this.add.text(cx, y, `... ${CREDITS.length - maxLines} more lines`, {
        fontFamily: FONT_BODY, fontSize: '13px', color: PALETTE_HEX.boneMuted, fontStyle: 'italic',
      }).setOrigin(0.5);
    }
  }

  private buildClearData(cx: number) {
    const y = 640;
    const divider = this.add.rectangle(cx, y, 600, 1, 0xc9a24b, 0.3).setDepth(1);

    createButton(this, cx, y + 40, 'Clear All Data', () => this.showClearConfirm(), {
      width: 260, height: 44, fontSize: '16px',
    });
  }

  private showClearConfirm() {
    const depth = 100;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const overlay = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setDepth(depth).setInteractive();
    const box = this.add.rectangle(cx, cy, 480, 200, 0x16191d).setStrokeStyle(1, 0xc9a24b, 0.6).setDepth(depth + 1);

    const text = this.add.text(cx, cy - 50, 'This will delete all Echo Shards,\nunlocks, lore, and progress.\n\nThis cannot be undone.', {
      fontFamily: FONT_BODY, fontSize: '16px', color: PALETTE_HEX.bone,
      align: 'center', lineSpacing: 5,
    }).setOrigin(0.5).setDepth(depth + 2);

    const confirm = createButton(this, cx - 100, cy + 65, 'Clear Everything', () => {
      localStorage.removeItem('hollow_beneath_save_v1');
      settingsManager.reset();
      this.scene.restart();
    }, { width: 170, height: 36, fontSize: '12px' });

    const cancel = createButton(this, cx + 100, cy + 65, 'Cancel', () => {
      overlay.destroy(); box.destroy(); text.destroy();
      confirm.destroy(); cancel.destroy();
    }, { width: 120, height: 36, fontSize: '12px' });
  }

  private buildBackButton(cx: number) {
    createButton(this, cx, GAME_HEIGHT - 60, 'Back', () => fadeToScene(this, 'Menu'), { width: 200 });
  }

  private addSettingsLabel(x: number, y: number, label: string) {
    this.add.text(x, y, label, { fontFamily: FONT_SERIF, fontSize: '16px', color: PALETTE_HEX.bone }).setOrigin(0, 0.5);
  }
}
