import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { ENDINGS } from '@data/endings';
import { FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    const cx = GAME_WIDTH / 2;
    fadeIn(this);

    const { meta, loadActiveRun } = useGameStore.getState();
    const canContinue = loadActiveRun();

    const buttons: { label: string; onClick: () => void }[] = [];
    if (canContinue) buttons.push({ label: 'Continue', onClick: () => fadeToScene(this, 'Board') });
    buttons.push({ label: 'New Descent', onClick: () => fadeToScene(this, 'CharacterCreation') });
    buttons.push({ label: 'Echo Shard Shop', onClick: () => fadeToScene(this, 'ShardShop') });
    buttons.push({ label: 'Lore Codex', onClick: () => fadeToScene(this, 'LoreCodex') });
    buttons.push({ label: 'Settings', onClick: () => fadeToScene(this, 'Settings') });

    const btnH = 52;
    const btnGap = 70;
    const buttonsH = buttons.length * btnH + (buttons.length - 1) * btnGap;
    const contentH = 52 + 30 + 16 + 30 + 14 + 60 + buttonsH;
    let y = (GAME_HEIGHT - contentH) / 2;

    this.add
      .text(cx, y + 26, 'THE HOLLOW BENEATH', { fontFamily: FONT_SERIF, fontSize: '52px', color: PALETTE_HEX.gold })
      .setOrigin(0.5);
    y += 52 + 30;

    this.add
      .text(cx, y, 'a descent, a translation, a mistake made carefully', {
        fontFamily: FONT_SERIF,
        fontSize: '16px',
        color: PALETTE_HEX.boneMuted,
        fontStyle: 'italic',
      })
      .setOrigin(0.5);
    y += 16 + 30;

    this.add
      .text(cx, y, `Echo Shards: ${meta.echoShards}    Runs: ${meta.totalRuns}    Endings seen: ${meta.endingsAchieved.length}/${ENDINGS.length}`, {
        fontFamily: FONT_SERIF,
        fontSize: '14px',
        color: PALETTE_HEX.boneMuted,
      })
      .setOrigin(0.5);
    y += 14 + 60;

    for (const btn of buttons) {
      createButton(this, cx, y, btn.label, btn.onClick, { width: 320 });
      y += btnGap;
    }

    this.add
      .text(cx, GAME_HEIGHT - 40, 'placeholder build — art & audio pending · Team Akrasia', {
        fontFamily: FONT_SERIF,
        fontSize: '12px',
        color: '#555555',
      })
      .setOrigin(0.5);
  }
}
