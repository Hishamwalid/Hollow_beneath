import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { ITEMS } from '@data/items';
import type { ItemDef } from '@data/types';
import { FONT_MONO, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

export class InventoryScene extends Phaser.Scene {
  constructor() {
    super('Inventory');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const cx = GAME_WIDTH / 2;
    const { player } = useGameStore.getState();
    if (!player) { fadeToScene(this, 'Menu'); return; }

    this.add.text(cx, 50, 'Inventory', { fontFamily: FONT_SERIF, fontSize: '34px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.add.text(cx, 85, `Gold: ${player.gold}`, { fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.goldBright }).setOrigin(0.5);

    const panelX = cx - 380;
    this.addSection(panelX, 120, 'Equipped');

    const equipSlots: Array<{ slot: string; id: string | null }> = [
      { slot: 'Weapon', id: player.equipment.weapon },
      { slot: 'Armour', id: player.equipment.armour },
      { slot: 'Accessory', id: player.equipment.accessory },
      { slot: 'Focus', id: player.equipment.focus },
    ];

    equipSlots.forEach((s, i) => {
      const y = 165 + i * 50;
      this.add.text(panelX + 20, y, s.slot, { fontFamily: FONT_SERIF, fontSize: '13px', color: PALETTE_HEX.boneMuted });
      if (s.id) {
        const def = ITEMS[s.id];
        if (def) {
          const bonusText = def.effect?.statBonus ? Object.entries(def.effect.statBonus).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(', ') : '';
          this.add.text(panelX + 130, y, def.name, { fontFamily: FONT_SERIF, fontSize: '13px', color: PALETTE_HEX.bone });
          this.add.text(panelX + 350, y, bonusText, { fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.gold });
        }
      } else {
        this.add.text(panelX + 130, y, '— empty —', { fontFamily: FONT_SERIF, fontSize: '13px', color: '#555555', fontStyle: 'italic' });
      }
    });

    this.addSection(panelX, 400, 'Inventory');
    const items = player.inventory.filter((e) => e.qty > 0);
    if (items.length === 0) {
      this.add.text(panelX + 20, 440, 'Nothing carried.', { fontFamily: FONT_SERIF, fontSize: '13px', color: '#555555', fontStyle: 'italic' });
    } else {
      items.forEach((entry, i) => {
        const y = 440 + i * 34;
        const def = ITEMS[entry.id];
        const itemName = def?.name ?? entry.id;
        const desc = def?.description ?? '';
        const kind = def?.kind ?? '';
        this.add.text(panelX + 20, y, `×${entry.qty}`, { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.gold });
        this.add.text(panelX + 55, y, itemName, { fontFamily: FONT_SERIF, fontSize: '13px', color: PALETTE_HEX.bone });
        this.add.text(panelX + 270, y, desc, { fontFamily: FONT_SERIF, fontSize: '11px', color: PALETTE_HEX.boneMuted });
        this.add.text(panelX + 600, y, kind, { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.boneMuted });
      });
    }

    createButton(this, cx, GAME_HEIGHT - 60, 'Back', () => fadeToScene(this, 'Board'), { width: 200 });
  }

  private addSection(x: number, y: number, label: string) {
    this.add.text(x, y, label, { fontFamily: FONT_SERIF, fontSize: '16px', color: PALETTE_HEX.gold });
    this.add.rectangle(x + 300, y + 10, 500, 1, 0xc9a24b, 0.3);
  }
}
