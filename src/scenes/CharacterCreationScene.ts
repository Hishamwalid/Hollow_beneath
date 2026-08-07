import Phaser from 'phaser';
import type { StatBlock } from '@data/types';
import { computeDerivedStats, isValidBuild, pointsSpent, POINT_BUY_TOTAL, PRESET_BUILDS, STARTING_EQUIPMENT_BONUSES, STAT_MAX, STAT_MIN, closestPresetName, CLASS_OF_PRESET } from '@data/stats';
import { PRESET_STARTING_SKILL } from '@data/skills';
import { useGameStore } from '@store/gameStore';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH } from '@/config';

const STAT_KEYS: Array<keyof StatBlock> = ['str', 'dex', 'con', 'int', 'will'];
const STAT_LABELS: Record<keyof StatBlock, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intellect', will: 'Will' };

export class CharacterCreationScene extends Phaser.Scene {
  private stats: StatBlock = { str: 6, dex: 6, con: 6, int: 6, will: 6 };
  private valueTexts: Partial<Record<keyof StatBlock, Phaser.GameObjects.Text>> = {};
  private pointsText!: Phaser.GameObjects.Text;
  private derivedText!: Phaser.GameObjects.Text;
  private beginBtn?: ReturnType<typeof createButton>;

  constructor() {
    super('CharacterCreation');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, 60, 'Who Descends?', { fontFamily: FONT_SERIF, fontSize: '34px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.add
      .text(cx, 104, `Distribute ${POINT_BUY_TOTAL} points across five stats (${STAT_MIN}–${STAT_MAX} each).`, {
        fontFamily: FONT_BODY,
        fontSize: '16px',
        color: PALETTE_HEX.boneMuted,
      })
      .setOrigin(0.5);

    STAT_KEYS.forEach((key, i) => {
      const y = 170 + i * 56;
      this.add.text(cx - 260, y, STAT_LABELS[key], { fontFamily: FONT_SERIF, fontSize: '18px', color: PALETTE_HEX.bone }).setOrigin(0, 0.5);
      this.makeStepper(cx + 60, y, key);
    });

    this.pointsText = this.add
      .text(cx, 170 + STAT_KEYS.length * 56 + 10, '', { fontFamily: FONT_MONO, fontSize: '16px', color: PALETTE_HEX.gold })
      .setOrigin(0.5);

    this.derivedText = this.add
      .text(cx + 260, 152, '', { fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.boneMuted, lineSpacing: 8 })
      .setOrigin(0, 0);

    const presetY = 170 + STAT_KEYS.length * 56 + 60;
    this.add.text(cx, presetY - 24, 'Presets', { fontFamily: FONT_BODY, fontSize: '15px', color: PALETTE_HEX.boneMuted }).setOrigin(0.5);
    const presetNames = Object.keys(PRESET_BUILDS);
    const totalW = presetNames.length * 130;
    presetNames.forEach((name, i) => {
      createButton(this, cx - totalW / 2 + 65 + i * 130, presetY, name, () => {
        this.stats = { ...PRESET_BUILDS[name] };
        this.refresh();
      }, { width: 118, height: 40, fontSize: '14px', textureKey: 'panel_preset', textureHoverKey: 'panel_preset_hover' });
    });

    this.beginBtn = createButton(this, cx, presetY + 70, 'Begin the Descent', () => this.begin(), { width: 280 });

    this.refresh();
  }

  private makeStepper(x: number, y: number, key: keyof StatBlock) {
    createButton(this, x - 40, y, '-', () => this.adjust(key, -1), { width: 40, height: 40, fontSize: '18px', textureKey: 'panel_stepper', textureHoverKey: 'panel_stepper' });
    const valueText = this.add
      .text(x + 20, y, '', { fontFamily: FONT_MONO, fontSize: '20px', color: PALETTE_HEX.gold })
      .setOrigin(0.5);
    this.valueTexts[key] = valueText;
    createButton(this, x + 80, y, '+', () => this.adjust(key, 1), { width: 40, height: 40, fontSize: '18px', textureKey: 'panel_stepper', textureHoverKey: 'panel_stepper' });
  }

  private adjust(key: keyof StatBlock, delta: number) {
    const next = this.stats[key] + delta;
    if (next < STAT_MIN || next > STAT_MAX) return;
    const spentAfter = pointsSpent({ ...this.stats, [key]: next });
    if (spentAfter > POINT_BUY_TOTAL) return;
    this.stats = { ...this.stats, [key]: next };
    audio.click();
    this.refresh();
  }

  private refresh() {
    STAT_KEYS.forEach((key) => this.valueTexts[key]?.setText(String(this.stats[key])));
    const spent = pointsSpent(this.stats);
    const remaining = POINT_BUY_TOTAL - spent;
    this.pointsText.setText(`Points remaining: ${remaining}`);
    this.pointsText.setColor(remaining === 0 ? PALETTE_HEX.gold : PALETTE_HEX.danger);

    const derived = computeDerivedStats(this.stats, STARTING_EQUIPMENT_BONUSES);
    this.derivedText.setText(
      [
        `Max HP:     ${derived.maxHP}`,
        `Max MP:     ${derived.maxMP}`,
        `Attack:     ${derived.attack}`,
        `Defense:    ${derived.defense}`,
        `Magic Atk:  ${derived.magicAttack}`,
        `Magic Def:  ${derived.magicDefense}`,
        `Speed:      ${derived.speed}`,
        `Accuracy:   ${derived.accuracy}%`,
        `Dodge:      ${derived.dodge}%`,
      ].join('\n'),
    );

    this.beginBtn?.setEnabled(isValidBuild(this.stats));
  }

  private begin() {
    if (!isValidBuild(this.stats)) return;
    const preset = closestPresetName(this.stats);
    useGameStore.getState().startNewRun(this.stats, CLASS_OF_PRESET[preset] ?? 'balanced');
    const store = useGameStore.getState();
    const player = store.player;
    const startingSkill = PRESET_STARTING_SKILL[preset];
    if (player && startingSkill && !player.skillsKnown.includes(startingSkill)) {
      const updatedPlayer = { ...player, skillsKnown: [...player.skillsKnown, startingSkill] };
      if (startingSkill === 'quickstep') updatedPlayer.derived = { ...updatedPlayer.derived, speed: player.derived.speed + 5 };
      if (startingSkill === 'bulwark_stance') updatedPlayer.derived = { ...updatedPlayer.derived, defense: Math.round(player.derived.defense * 1.15) };
      if (startingSkill === 'steady_hands') updatedPlayer.derived = { ...updatedPlayer.derived, accuracy: player.derived.accuracy + 10 };
      useGameStore.setState({ player: updatedPlayer });
      useGameStore.getState().persist();
    }
    fadeToScene(this, 'Board');
  }
}
