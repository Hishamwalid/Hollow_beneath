import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { SKILL_TREES, type SkillTreeNode, type SkillTreeDef } from '@data/skillTree';
import { NAMED_SKILLS } from '@data/skills';
import { FONT_MONO, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

const COL_COUNT = 5;
const COL_WIDTH = 140;
const START_X = Math.round((GAME_WIDTH - COL_COUNT * COL_WIDTH) / 2 + COL_WIDTH / 2);
const TIER_1_Y = 165;
const TIER_GAP = 104;
const NODE_SIZE = 92;

export class SkillTreeScene extends Phaser.Scene {
  private tooltip?: Phaser.GameObjects.Container;

  constructor() {
    super('SkillTree');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const { player } = useGameStore.getState();
    if (!player) { fadeToScene(this, 'Menu'); return; }

    this.add.text(GAME_WIDTH / 2, 30, 'Skill Trees', {
      fontFamily: FONT_SERIF, fontSize: '32px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5);
    const pointText = this.add.text(GAME_WIDTH / 2, 70, '', {
      fontFamily: FONT_MONO, fontSize: '15px', color: PALETTE_HEX.goldBright,
    }).setOrigin(0.5);

    const refreshPointText = () => {
      const p = useGameStore.getState().player;
      pointText.setText(`Skill Points: ${p?.skillPoints ?? 0}`);
    };
    refreshPointText();

    SKILL_TREES.forEach((tree, col) => {
      this.drawTreeColumn(tree, col, refreshPointText);
    });

    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 45, 'Back', () => fadeToScene(this, 'Board'), { width: 180, height: 38 });
  }

  private drawTreeColumn(tree: SkillTreeDef, col: number, refreshPointText: () => void) {
    const cx = START_X + col * COL_WIDTH;

    const header = this.add.text(cx, 105, tree.name, {
      fontFamily: FONT_SERIF, fontSize: '18px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5);
    header.setAlpha(0.8);

    const { player } = useGameStore.getState();
    if (!player) return;

    tree.nodes.forEach((node, tIndex) => {
      const ny = TIER_1_Y + tIndex * TIER_GAP;
      this.drawNode(cx, ny, tree, node, tIndex, player, refreshPointText);

      if (tIndex < tree.nodes.length - 1) {
        const line = this.add.graphics();
        line.lineStyle(2, 0x555555, 0.4);
        line.beginPath();
        line.moveTo(cx, ny + NODE_SIZE / 2 + 4);
        line.lineTo(cx, ny + TIER_GAP - NODE_SIZE / 2 - 4);
        line.strokePath();
      }
    });
  }

  private drawNode(x: number, y: number, tree: SkillTreeDef, node: SkillTreeNode, tIndex: number, player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>, refreshPointText: () => void) {
    const purchasedTiers = player.skillTreePurchases[tree.id] ?? 0;
    const isBought = player.skillsKnown.includes(node.id);
    const isLocked = tIndex > purchasedTiers && !isBought;
    const canAfford = player.skillPoints >= node.cost && !isLocked && !isBought;
    const isAvailable = !isLocked && !isBought;
    const isMaxed = tIndex === tree.nodes.length - 1 && isBought;

    let bgColor = 0x2a2e33;
    let borderColor = 0x555555;
    let borderAlpha = 0.3;
    let textColor = '#555555';
    let label = 'LOCKED';
    let pulse = false;

    if (isMaxed) {
      bgColor = 0x1a2e1a;
      borderColor = 0xc9a24b;
      borderAlpha = 0.7;
      textColor = '#c9a24b';
      label = 'MAX';
    } else if (isBought) {
      bgColor = 0x1e3320;
      borderColor = 0x5a8a5a;
      borderAlpha = 0.6;
      textColor = PALETTE_HEX.bone;
      label = '';
    } else if (canAfford) {
      borderColor = 0xc9a24b;
      borderAlpha = 0.7;
      textColor = PALETTE_HEX.gold;
      label = `${node.cost} pt`;
      pulse = true;
    } else if (isLocked) {
      label = 'LOCKED';
    } else {
      label = `${node.cost} pt`;
    }

    const bg = this.add.rectangle(x, y, NODE_SIZE, NODE_SIZE, bgColor).setStrokeStyle(2, borderColor, borderAlpha).setDepth(1);
    if (pulse) {
      this.tweens.add({
        targets: bg, strokeAlpha: { from: 0.7, to: 0.3 }, duration: 1200, yoyo: true, repeat: -1,
      });
    }

    const skillDef = NAMED_SKILLS[node.id];
    const nameText = this.add.text(x, y - 20, skillDef?.name ?? node.id, {
      fontFamily: FONT_MONO, fontSize: '12px', color: textColor, align: 'center', wordWrap: { width: NODE_SIZE - 12 },
    }).setOrigin(0.5).setDepth(2);
    const costText = this.add.text(x, y + 20, label, {
      fontFamily: FONT_MONO, fontSize: '11px', color: textColor, align: 'center',
    }).setOrigin(0.5).setDepth(2);

    const tierLabel = this.add.text(x, y + NODE_SIZE / 2 + 10, `Tier ${node.tier}`, {
      fontFamily: FONT_MONO, fontSize: '10px', color: '#555555',
    }).setOrigin(0.5).setDepth(2);

    if (isAvailable) {
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          bg.setFillStyle(0x3a3e44);
          this.showTooltip(x, y, node, skillDef);
        })
        .on('pointerout', () => {
          bg.setFillStyle(bgColor);
          this.hideTooltip();
        })
        .on('pointerdown', () => {
          if (canAfford) this.confirmPurchase(tree, node, refreshPointText);
        });
    } else if (isBought) {
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.showTooltip(x, y, node, skillDef))
        .on('pointerout', () => this.hideTooltip());
    }
  }

  private showTooltip(x: number, y: number, node: SkillTreeNode, skillDef: typeof NAMED_SKILLS[string] | undefined) {
    this.hideTooltip();
    if (!skillDef) return;
    const tx = Math.min(x + NODE_SIZE / 2 + 10, GAME_WIDTH - 200);
    const ty = Math.max(y - 40, 10);

    const container = this.add.container(tx, ty).setDepth(20);
    const lines = [
      skillDef.name,
      '',
      `AP: ${skillDef.apCost}${skillDef.mpCost ? `  MP: ${skillDef.mpCost}` : ''}`,
      skillDef.description,
    ];
    const text = this.add.text(0, 0, lines.join('\n'), {
      fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.bone,
      wordWrap: { width: 200 }, lineSpacing: 3,
    }).setOrigin(0, 0);

    const pad = 8;
    const bg = this.add.rectangle(text.width / 2, text.height / 2, text.width + pad * 2, text.height + pad * 2, 0x16191d)
      .setStrokeStyle(1, 0xc9a24b, 0.5);
    container.add([bg, text]);
    this.tooltip = container;
  }

  private hideTooltip() {
    this.tooltip?.destroy();
    this.tooltip = undefined;
  }

  private confirmPurchase(tree: SkillTreeDef, node: SkillTreeNode, refreshPointText: () => void) {
    this.hideTooltip();
    const overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(30).setInteractive();
    const box = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 400, 180, 0x1a1d22).setStrokeStyle(1, 0xc9a24b, 0.6).setDepth(31);

    const skillDef = NAMED_SKILLS[node.id];
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, `Buy "${skillDef?.name ?? node.id}" for ${node.cost} point${node.cost > 1 ? 's' : ''}?`, {
      fontFamily: FONT_MONO, fontSize: '16px', color: PALETTE_HEX.bone, align: 'center', wordWrap: { width: 360 },
    }).setOrigin(0.5).setDepth(32);

    const confirmBtn = createButton(this, GAME_WIDTH / 2 - 80, GAME_HEIGHT / 2 + 40, 'Confirm', () => {
      const store = useGameStore.getState();
      const ok = store.purchaseSkillTreeTier(tree.id, node.id);
      if (ok) {
        text.setText(`"${skillDef?.name ?? node.id}" learned!`);
        confirmBtn.setEnabled(false);
        cancelBtn.setEnabled(false);
        this.time.delayedCall(800, () => {
          overlayBg.destroy(); box.destroy(); text.destroy();
          confirmBtn.destroy(); cancelBtn.destroy();
          refreshPointText();
          this.scene.restart();
        });
      }
    }, { width: 120, height: 36, depth: 33 });

    const cancelBtn = createButton(this, GAME_WIDTH / 2 + 80, GAME_HEIGHT / 2 + 40, 'Cancel', () => {
      overlayBg.destroy(); box.destroy(); text.destroy();
      confirmBtn.destroy(); cancelBtn.destroy();
    }, { width: 120, height: 36, depth: 33 });
  }
}
