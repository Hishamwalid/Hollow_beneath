import Phaser from 'phaser';
import { computeDerivedStats, STARTING_EQUIPMENT_BONUSES, STARTING_STATS } from '@data/stats';
import { useGameStore } from '@store/gameStore';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { createPanel } from '@ui/Panel';
import { createDivider } from '@ui/headings';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

const NAME_MAX_LENGTH = 20;

/**
 * Definitive edition: there are no classes and no stat spreads to pick.
 * The descent is one person's journey. The player writes their name —
 * everything else about who they are is decided by the Beneath.
 */
export class CharacterCreationScene extends Phaser.Scene {
  private nameInput?: HTMLInputElement;
  private unposition?: () => void;
  private beginBtn?: ReturnType<typeof createButton>;
  private hint?: Phaser.GameObjects.Text;

  constructor() {
    super('CharacterCreation');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, 64, 'Before You Descend', { fontFamily: FONT_SERIF, fontSize: '34px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.add
      .text(
        cx,
        130,
        "Eve's child stands at the mouth of the sinkhole.\n\nThe journal is heavy in your hands. The desert wind is loud.\nSeven hundred years of Seekers have climbed down before you.\nYou never dreamed their dream.",
        { fontFamily: FONT_BODY, fontSize: '17px', color: PALETTE_HEX.boneMuted, align: 'center', lineSpacing: 6 },
      )
      .setOrigin(0.5);

    this.add.text(cx, 288, 'Write your name.', { fontFamily: FONT_SERIF, fontSize: '22px', color: PALETTE_HEX.bone }).setOrigin(0.5);

    const namePanel = createPanel(this, { x: cx, y: 344, width: 520, height: 96, variant: 'parchment' });
    void namePanel;

    this.mountNameInput(cx - 220, 318, 440, 52);

    const derived = computeDerivedStats(STARTING_STATS, STARTING_EQUIPMENT_BONUSES);
    this.add
      .text(cx, 452,
        [
          'You carry:',
          `HP ${derived.maxHP}   MP ${derived.maxMP}   ATK ${derived.attack}   DEF ${derived.defense}`,
          `MATK ${derived.magicAttack}   MDEF ${derived.magicDefense}   SPD ${derived.speed}`,
        ].join('\n'),
        { fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.boneMuted, align: 'center', lineSpacing: 6 },
      )
      .setOrigin(0.5);

    this.hint = this.add
      .text(cx, GAME_HEIGHT - 96, '', { fontFamily: FONT_BODY, fontSize: '13px', color: PALETTE_HEX.danger })
      .setOrigin(0.5);

    this.beginBtn = createButton(this, cx, GAME_HEIGHT - 56, 'Begin the Descent', () => this.begin(), { width: 300 });
    this.refresh();
  }

  /** Themed DOM input overlaid on the canvas; positioned relative to the
   *  FIT-scaled canvas so it lands on the parchment card at any window size.
   *  Removed (and unhooked from resize) when the scene shuts down. */
  private mountNameInput(designX: number, designY: number, designW: number, designH: number) {
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = NAME_MAX_LENGTH;
    input.spellcheck = false;
    input.placeholder = 'Name';
    const baseFontSize = 24;

    const position = () => {
      const rect = this.game.canvas.getBoundingClientRect();
      const sx = rect.width / GAME_WIDTH;
      const sy = rect.height / GAME_HEIGHT;
      input.style.left = `${rect.left + designX * sx}px`;
      input.style.top = `${rect.top + designY * sy}px`;
      input.style.width = `${designW * sx}px`;
      input.style.height = `${designH * sy}px`;
      input.style.fontSize = `${Math.round(baseFontSize * Math.min(sx, sy))}px`;
    };

    input.style.cssText = `
      position: fixed;
      background: rgba(230,221,196,0.92);
      border: 1px solid #8a6a2f; border-radius: 4px;
      color: #33291c;
      font-family: Georgia, 'Times New Roman', serif;
      text-align: center;
      outline: none;
      z-index: 1000;
    `;
    position();
    window.addEventListener('resize', position);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.begin();
    });
    input.addEventListener('input', () => this.refresh());
    document.body.appendChild(input);
    this.nameInput = input;
    this.unposition = position;
    window.setTimeout(() => input.focus(), 50);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unmountNameInput());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.unmountNameInput());
  }

  private unmountNameInput() {
    if (this.unposition) {
      window.removeEventListener('resize', this.unposition);
      this.unposition = undefined;
    }
    this.nameInput?.remove();
    this.nameInput = undefined;
  }

  private currentName(): string {
    return (this.nameInput?.value ?? '').trim().replace(/\s+/g, ' ');
  }

  private refresh() {
    const name = this.currentName();
    const valid = name.length >= 1 && name.length <= NAME_MAX_LENGTH;
    this.beginBtn?.setEnabled(valid);
    this.hint?.setText(valid || !this.nameInput ? '' : name.length === 0 ? 'A name is required.' : `Too long (${name.length}/${NAME_MAX_LENGTH}).`);
  }

  private begin() {
    const name = this.currentName();
    if (name.length < 1) return;
    audio.confirm();
    useGameStore.getState().startNewRun({ ...STARTING_STATS }, name);
    fadeToScene(this, 'Board');
  }
}
