import Phaser from 'phaser';
import { SHARD_SHOP } from '@data/shardShop';
import { useGameStore } from '@store/gameStore';
import { canAfford, purchase } from '@systems/EchoShardSystem';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { settleIn } from '@systems/motion';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX, SURFACE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { createTitle } from '@ui/headings';
import { createModal } from '@ui/controls';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH } from '@/config';

// Purchases this large get a second look before they're spent.
const CONFIRM_THRESHOLD = 200;

/** CSS palette string -> numeric for Phaser stroke/fill APIs. */
const num = (css: string): number => parseInt(css.replace('#', ''), 16);

export class ShardShopScene extends Phaser.Scene {
  private shardsText!: Phaser.GameObjects.Text;
  private rows: Array<{ refresh: () => void }> = [];

  constructor() {
    super('ShardShop');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    settleIn(this);
    const cx = GAME_WIDTH / 2;
    this.rows = [];

    createTitle(this, cx, 50, 'Echo Shard Shop');
    this.add
      .text(cx, 84, 'Permanent unlocks, spent from shards earned across every run.', {
        fontFamily: FONT_BODY,
        fontSize: '15px',
        color: PALETTE_HEX.boneMuted,
      })
      .setOrigin(0.5);

    // The counter carries its own shard glyph — the currency is never abstract.
    const headIcon = this.add.image(cx - 118, 112, 'icon_shard').setDisplaySize(16, 16).setOrigin(1, 0.5);
    void headIcon;
    this.shardsText = this.add.text(cx - 108, 112, '', { fontFamily: FONT_MONO, fontSize: '16px', color: PALETTE_HEX.gold }).setOrigin(0, 0.5);

    SHARD_SHOP.forEach((entry, i) => {
      const y = 155 + i * 52;
      const bg = this.add.rectangle(cx, y, 800, 44, SURFACE_HEX.row).setStrokeStyle(1, SURFACE_HEX.border);

      const nameText = this.add.text(cx - 380, y, entry.name, { fontFamily: FONT_SERIF, fontSize: '15px', color: PALETTE_HEX.bone }).setOrigin(0, 0.5);
      const descText = this.add
        .text(cx - 200, y, entry.description, { fontFamily: FONT_BODY, fontSize: '14px', color: PALETTE_HEX.boneMuted, wordWrap: { width: 340 } })
        .setOrigin(0, 0.5);

      // Cost chip: faceted shard glyph + count, never an ambiguous glyph.
      const chip = this.add.container(cx + 350, y);
      const shardIcon = this.add.image(-24, 0, 'icon_shard').setDisplaySize(15, 15);
      const costText = this.add.text(-10, 0, '', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.gold }).setOrigin(0, 0.5);
      chip.add([shardIcon, costText]);

      // Wax-stamp OWNED — pressed into the row like a seal on a ledger line.
      const ownedStamp = this.add.container(cx + 352, y).setVisible(false).setAngle(-8);
      const stampBg = this.add.rectangle(0, 0, 92, 26, 0x000000, 0).setStrokeStyle(2, num(PALETTE_HEX.waxRed), 0.9);
      const stampText = this.add.text(0, 0, 'OWNED', {
        fontFamily: FONT_MONO, fontSize: '12px', color: '#c96a5c', fontStyle: 'bold',
      }).setOrigin(0.5);
      ownedStamp.add([stampBg, stampText]);

      const btn = createButton(
        this,
        cx + 250,
        y,
        'Buy',
        () => {
          const meta = useGameStore.getState().meta;
          if (!canAfford(meta, entry.id)) return;
          if (entry.cost >= CONFIRM_THRESHOLD) {
            this.confirmPurchase(entry.id, entry.name, entry.cost);
            return;
          }
          this.buy(entry.id);
        },
        { width: 90, height: 36, fontSize: '13px' },
      );

      const refresh = () => {
        const meta = useGameStore.getState().meta;
        const owned = meta.purchasedUnlocks.includes(entry.id);
        if (owned) {
          costText.setText('');
          shardIcon.setVisible(false);
          ownedStamp.setVisible(true);
          [nameText, descText].forEach((t) => t.setAlpha(0.45));
          bg.setStrokeStyle(1, SURFACE_HEX.hairlineKnown);
          btn.setEnabled(false);
        } else {
          costText.setText(String(entry.cost));
          shardIcon.setVisible(true);
          ownedStamp.setVisible(false);
          [nameText, descText].forEach((t) => t.setAlpha(1));
          btn.setEnabled(canAfford(meta, entry.id));
        }
      };
      refresh();
      this.rows.push({ refresh });
    });

    createButton(this, cx, 155 + SHARD_SHOP.length * 52 + 24, 'Back', () => fadeToScene(this, 'Menu'), { width: 200 });

    this.refreshAll();
  }

  private buy(entryId: string): void {
    const meta = useGameStore.getState().meta;
    if (!canAfford(meta, entryId)) return;
    const newMeta = purchase(meta, entryId);
    useGameStore.setState({ meta: newMeta });
    useGameStore.getState().persist();
    audio.shardGain();
    this.refreshAll();
  }

  /** Second-look modal for heavy purchases. */
  private confirmPurchase(entryId: string, entryName: string, cost: number): void {
    const modal = createModal(this, 'Confirm Purchase', 460, 240, {
      variant: 'parchment',
      depth: 60,
    });
    modal.container.add(
      this.add.text(modal.contentX + 180, modal.contentY + 30,
        `${entryName} — ${cost} shards,\nspent permanently.`,
        { fontFamily: FONT_BODY, fontSize: '17px', color: PALETTE_HEX.ink, align: 'center', wordWrap: { width: 380 }, lineSpacing: 6 },
      ).setOrigin(0.5),
    );
    const yes = createButton(this, modal.contentX + 130, modal.contentY + 110, 'Spend them', () => {
      modal.close();
      this.buy(entryId);
    }, { width: 160, height: 42, fontSize: '14px' });
    const no = createButton(this, modal.contentX + 310, modal.contentY + 110, 'Not yet', () => {
      audio.click();
      modal.close();
    }, { width: 140, height: 42, fontSize: '14px', variant: 'secondary' });
    // Reparent so both buttons close out with the modal.
    modal.container.add([yes.container, no.container]);
  }

  private refreshAll() {
    this.shardsText.setText(`You hold ${useGameStore.getState().meta.echoShards} Echo Shards.`);
    this.rows.forEach((r) => r.refresh());
  }
}
