import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { NAMED_SKILLS, MAX_EQUIPPED_SKILLS_FALLBACK } from '@data/skills';
import { MAX_EQUIPPED_SKILLS } from '@data/types';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

/**
 * LOADOUT — manage your six active skill slots.
 * Everything learned sits in the archive; click to swap in/out. No points,
 * no trees — chapter unlocks and discoveries feed the pool directly.
 */
export class LoadoutScene extends Phaser.Scene {
  private listContainer?: Phaser.GameObjects.Container;
  private slotsText?: Phaser.GameObjects.Text;

  constructor() {
    super('Loadout');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, 44, 'Skill Loadout', { fontFamily: FONT_SERIF, fontSize: '34px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.add.text(cx, 82, 'Six slots active in combat. Everything else waits in the archive — click a skill to move it.', {
      fontFamily: FONT_BODY,
      fontSize: '15px',
      color: PALETTE_HEX.boneMuted,
    }).setOrigin(0.5);

    this.slotsText = this.add.text(cx, GAME_HEIGHT - 108, '', { fontFamily: FONT_MONO, fontSize: '15px', color: PALETTE_HEX.gold }).setOrigin(0.5);

    createButton(this, cx - 260, GAME_HEIGHT - 50, '< Back', () => fadeToScene(this, 'Board'), { width: 170, height: 42 });

    this.render();
  }

  private render() {
    this.listContainer?.destroy();
    const container = this.add.container(0, 0);
    this.listContainer = container;

    const player = useGameStore.getState().player;
    if (!player) return;

    const equipped = player.equippedSkills.filter((id) => NAMED_SKILLS[id]);
    const archive = player.skillsKnown.filter((id) => NAMED_SKILLS[id] && !equipped.includes(id));
    this.slotsText?.setText(`Equipped ${equipped.length} / ${MAX_EQUIPPED_SKILLS}`);

    const colW = 560;
    const leftX = GAME_WIDTH / 2 - colW / 2 - 12;
    const rightX = GAME_WIDTH / 2 + colW / 2 + 12;
    const topY = 120;
    const rowH = 74;

    this.add.text(leftX + colW / 2, topY - 26, '— EQUIPPED (active in combat) —', {
      fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5);
    this.add.text(rightX + colW / 2, topY - 26, '— ARCHIVE (learned, not equipped) —', {
      fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(0.5);

    const drawSkillRow = (
      x: number, y: number, id: string, isEquipped: boolean,
    ) => {
      const def = NAMED_SKILLS[id];
      const passive = !!def.passive;
      const costs: string[] = [];
      if (def.mpCost) costs.push(`${def.mpCost} MP`);
      if (def.hpCost?.flat) costs.push(`${def.hpCost.flat} HP`);
      if (def.hpCost?.pct) costs.push(`${def.hpCost.pct}% HP`);
      if (def.passive) costs.push('passive');

      const bg = this.add.rectangle(x + colW / 2, y + rowH / 2, colW - 16, rowH - 10, isEquipped ? 0x1c2026 : 0x16191d)
        .setStrokeStyle(1, isEquipped ? 0xc9a24b : 0x3a3f46);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(isEquipped ? 0x232930 : 0x1e232a));
      bg.on('pointerout', () => bg.setFillStyle(isEquipped ? 0x1c2026 : 0x16191d));

      const nameColor = passive ? PALETTE_HEX.goldBright : PALETTE_HEX.bone;
      const nameText = this.add.text(x + 18, y + 14, def.name, {
        fontFamily: FONT_SERIF, fontSize: '17px', color: nameColor,
      });
      const descText = this.add.text(x + 18, y + 38, def.description, {
        fontFamily: FONT_BODY, fontSize: '13px', color: PALETTE_HEX.boneMuted,
        wordWrap: { width: colW - 190 },
      });
      const costText = this.add.text(x + colW - 130, y + 20, costs.join(' · '), {
        fontFamily: FONT_MONO, fontSize: '13px',
        color: passive ? PALETTE_HEX.gold : PALETTE_HEX.player,
      }).setOrigin(0, 0);

      const actionLabel = passive ? '' : isEquipped ? '▼' : '▲';
      const actionText = this.add.text(x + colW - 60, y + rowH / 2, actionLabel, {
        fontFamily: FONT_MONO, fontSize: '18px', color: PALETTE_HEX.gold,
      }).setOrigin(0.5);

      container.add([bg, nameText, descText, costText]);
      if (actionLabel) container.add(actionText);

      if (!passive) {
        bg.on('pointerdown', () => {
          if (isEquipped) useGameStore.getState().unequipSkill(id);
          else {
            const ok = useGameStore.getState().equipSkill(id);
            if (!ok) {
              // Full: auto-swap with the last equipped slot for one-click rotation.
              const p = useGameStore.getState().player;
              if (p && p.equippedSkills.length >= MAX_EQUIPPED_SKILLS_FALLBACK()) {
                const oldest = p.equippedSkills[p.equippedSkills.length - 1];
                useGameStore.getState().unequipSkill(oldest);
                useGameStore.getState().equipSkill(id);
              }
            }
          }
          this.render();
        });
      }
    };

    equipped.forEach((id, i) => drawSkillRow(leftX, topY + i * rowH, id, true));

    const maxRows = Math.max(equipped.length, Math.min(archive.length, 8));
    void maxRows;
    archive.slice(0, 8).forEach((id, i) => drawSkillRow(rightX, topY + i * rowH, id, false));

    if (archive.length === 0) {
      container.add(this.add.text(rightX + colW / 2, topY + 80, 'The archive is empty.', {
        fontFamily: FONT_BODY, fontSize: '14px', color: PALETTE_HEX.boneMuted,
      }).setOrigin(0.5));
    }
  }
}
