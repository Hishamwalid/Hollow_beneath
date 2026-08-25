import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { NAMED_SKILLS, MAX_EQUIPPED_SKILLS_FALLBACK } from '@data/skills';
import { MAX_EQUIPPED_SKILLS } from '@data/types';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { settleIn, floatDelta } from '@systems/motion';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX, SURFACE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { createTitle, createSectionLabel } from '@ui/headings';
import { createPager } from '@ui/controls';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

/**
 * LOADOUT — manage your six active skill slots.
 * Everything learned sits in the archive; click to swap in/out. No points,
 * no trees — chapter unlocks and discoveries feed the pool directly.
 * The archive paginates: nothing learned is ever hidden.
 */
const ARCHIVE_PER_PAGE = 5;

export class LoadoutScene extends Phaser.Scene {
  private listContainer?: Phaser.GameObjects.Container;
  private slotsText?: Phaser.GameObjects.Text;
  private pager?: ReturnType<typeof createPager>;
  private archivePage = 0;

  constructor() {
    super('Loadout');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    settleIn(this);
    const cx = GAME_WIDTH / 2;

    createTitle(this, cx, 44, 'Skill Loadout');
    this.add.text(cx, 82, 'Six slots active in combat. Everything else waits in the archive — click a skill to move it.', {
      fontFamily: FONT_BODY,
      fontSize: '15px',
      color: PALETTE_HEX.boneMuted,
    }).setOrigin(0.5);

    this.slotsText = this.add.text(cx, GAME_HEIGHT - 108, '', { fontFamily: FONT_MONO, fontSize: '15px', color: PALETTE_HEX.gold }).setOrigin(0.5);

    // Archive pager sits under the right column; wired in render() bounds.
    this.pager = createPager(this, cx + 292, GAME_HEIGHT - 108, (page) => {
      this.archivePage = page;
      audio.pageTurn();
      this.render();
    }, { depth: 5 });

    createButton(this, cx - 260, GAME_HEIGHT - 50, 'Back', () => fadeToScene(this, 'Board'), { width: 170, height: 42 });

    this.render();
  }

  /** One-line confirmation that drifts up where the swap happened. */
  private announceSwap(text: string): void {
    floatDelta(this, GAME_WIDTH / 2 + 292, GAME_HEIGHT - 150, text, '#e9c876', { depth: 50, fontSize: 14 });
  }

  private render() {
    this.listContainer?.destroy();
    const container = this.add.container(0, 0).setDepth(4);
    this.listContainer = container;

    const player = useGameStore.getState().player;
    if (!player) return;

    const equipped = player.equippedSkills.filter((id) => NAMED_SKILLS[id]);
    const archiveAll = player.skillsKnown.filter((id) => NAMED_SKILLS[id] && !equipped.includes(id));
    const pageCount = Math.max(1, Math.ceil(archiveAll.length / ARCHIVE_PER_PAGE));
    if (this.archivePage >= pageCount) this.archivePage = pageCount - 1;
    const archive = archiveAll.slice(this.archivePage * ARCHIVE_PER_PAGE, (this.archivePage + 1) * ARCHIVE_PER_PAGE);
    this.slotsText?.setText(`Equipped ${equipped.length} / ${MAX_EQUIPPED_SKILLS}   ·   Archive ${archiveAll.length}`);
    this.pager?.update(this.archivePage, pageCount);

    const colW = 560;
    const leftX = GAME_WIDTH / 2 - colW / 2 - 12;
    const rightX = GAME_WIDTH / 2 + colW / 2 + 12;
    const topY = 120;
    const rowH = 74;

    // Column headers live INSIDE listContainer — re-renders can't stack copies.
    container.add(createSectionLabel(this, leftX + 12, topY - 26, '— EQUIPPED (active in combat) —'));
    container.add(createSectionLabel(this, rightX + 12, topY - 26, '— ARCHIVE (learned, not equipped) —', { color: PALETTE_HEX.boneMuted }));

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

      const bg = this.add.rectangle(x + colW / 2, y + rowH / 2, colW - 16, rowH - 10,
        isEquipped ? SURFACE_HEX.rowRaised : SURFACE_HEX.row)
        .setStrokeStyle(1, isEquipped ? parseInt(PALETTE_HEX.gold.replace('#', ''), 16) : SURFACE_HEX.hairline);
      bg.setInteractive({ useHandCursor: true });
      const restFill = () => bg.setFillStyle(isEquipped ? SURFACE_HEX.rowRaised : SURFACE_HEX.row);
      bg.on('pointerover', () => bg.setFillStyle(isEquipped ? SURFACE_HEX.rowHover : SURFACE_HEX.rowHoverAlt));
      bg.on('pointerout', restFill);

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

      const actionLabel = passive ? '' : isEquipped ? '×' : '+';
      const actionText = this.add.text(x + colW - 60, y + rowH / 2, actionLabel, {
        fontFamily: FONT_MONO, fontSize: '18px', color: PALETTE_HEX.gold,
      }).setOrigin(0.5);

      container.add([bg, nameText, descText, costText]);
      if (actionLabel) container.add(actionText);

      if (!passive) {
        bg.on('pointerdown', () => {
          let rotatedOut = '';
          if (isEquipped) useGameStore.getState().unequipSkill(id);
          else {
            const ok = useGameStore.getState().equipSkill(id);
            if (!ok) {
              // Full: auto-swap with the last equipped slot for one-click rotation.
              const p = useGameStore.getState().player;
              if (p && p.equippedSkills.length >= MAX_EQUIPPED_SKILLS_FALLBACK()) {
                const oldest = p.equippedSkills[p.equippedSkills.length - 1];
                rotatedOut = NAMED_SKILLS[oldest]?.name ?? oldest;
                useGameStore.getState().unequipSkill(oldest);
                useGameStore.getState().equipSkill(id);
              }
            }
          }
          if (rotatedOut) {
            audio.click();
            this.announceSwap(`swapped out ${rotatedOut}`);
          }
          this.render();
        });
      }
    };

    equipped.forEach((id, i) => drawSkillRow(leftX, topY + i * rowH, id, true));
    archive.forEach((id, i) => drawSkillRow(rightX, topY + i * rowH, id, false));

    if (archiveAll.length === 0) {
      container.add(this.add.text(rightX + colW / 2, topY + 80, 'The archive is empty.', {
        fontFamily: FONT_BODY, fontSize: '14px', color: PALETTE_HEX.boneMuted,
      }).setOrigin(0.5));
    }
  }
}
