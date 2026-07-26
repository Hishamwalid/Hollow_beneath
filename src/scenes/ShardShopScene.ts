import Phaser from 'phaser';
import { SHARD_SHOP } from '@data/shardShop';
import { useGameStore } from '@store/gameStore';
import { canAfford, purchase } from '@systems/EchoShardSystem';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { FONT_MONO, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH } from '@/config';

export class ShardShopScene extends Phaser.Scene {
  private shardsText!: Phaser.GameObjects.Text;
  private rows: Array<{ refresh: () => void }> = [];

  constructor() {
    super('ShardShop');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const cx = GAME_WIDTH / 2;
    this.rows = [];

    this.add.text(cx, 50, 'Echo Shard Shop', { fontFamily: FONT_SERIF, fontSize: '34px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.add
      .text(cx, 84, 'Permanent unlocks, spent from shards earned across every run.', {
        fontFamily: FONT_SERIF,
        fontSize: '13px',
        color: PALETTE_HEX.boneMuted,
      })
      .setOrigin(0.5);

    this.shardsText = this.add.text(cx, 112, '', { fontFamily: FONT_MONO, fontSize: '16px', color: PALETTE_HEX.gold }).setOrigin(0.5);

    SHARD_SHOP.forEach((entry, i) => {
      const y = 155 + i * 52;
      const bg = this.add.rectangle(cx, y, 800, 44, 0x16191d).setStrokeStyle(1, 0x2a2e33);
      this.add.text(cx - 380, y, entry.name, { fontFamily: FONT_SERIF, fontSize: '15px', color: PALETTE_HEX.bone }).setOrigin(0, 0.5);
      this.add
        .text(cx - 200, y, entry.description, { fontFamily: FONT_SERIF, fontSize: '11px', color: PALETTE_HEX.boneMuted, wordWrap: { width: 340 } })
        .setOrigin(0, 0.5);

      const costLabel = this.add.text(cx + 350, y, '', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.gold }).setOrigin(0.5);
      const btn = createButton(
        this,
        cx + 250,
        y,
        'Buy',
        () => {
          const meta = useGameStore.getState().meta;
          if (!canAfford(meta, entry.id)) return;
          const newMeta = purchase(meta, entry.id);
          useGameStore.setState({ meta: newMeta });
          useGameStore.getState().persist();
          audio.shardGain();
          this.refreshAll();
        },
        { width: 90, height: 36, fontSize: '13px' },
      );

      const refresh = () => {
        const meta = useGameStore.getState().meta;
        const owned = meta.purchasedUnlocks.includes(entry.id);
        costLabel.setText(owned ? 'Owned' : `${entry.cost}◆`);
        btn.setEnabled(!owned && canAfford(meta, entry.id));
      };
      refresh();
      this.rows.push({ refresh });
    });

    createButton(this, cx, 155 + SHARD_SHOP.length * 52 + 24, 'Back', () => fadeToScene(this, 'Menu'), { width: 200 });

    this.refreshAll();
  }

  private refreshAll() {
    this.shardsText.setText(`You hold ${useGameStore.getState().meta.echoShards} Echo Shards.`);
    this.rows.forEach((r) => r.refresh());
  }
}
