import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { ITEMS } from '@data/items';
import type { ItemDef, Equipment } from '@data/types';
import { FONT_MONO, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';
import { addResonanceEffects } from '@systems/ResonanceFX';

const SLOT_LABELS: Record<keyof Equipment, string> = {
  weapon: 'Weapon',
  armour: 'Armour',
  accessory: 'Accessory',
  focus: 'Focus',
};

const SLOT_KIND_MAP: Record<keyof Equipment, ItemDef['kind']> = {
  weapon: 'weapon',
  armour: 'armour',
  accessory: 'accessory',
  focus: 'focus',
};

function statBonusText(eff: ItemDef['effect']): string {
  if (!eff?.statBonus) return '';
  return Object.entries(eff.statBonus)
    .map(([k, v]) => `${k.toUpperCase()}+${v}`)
    .join(' ');
}

function computeDelta(
  currentBonus: Record<string, number> | undefined,
  candidateBonus: Record<string, number> | undefined,
): { key: string; diff: number }[] {
  const allKeys = new Set([...Object.keys(currentBonus ?? {}), ...Object.keys(candidateBonus ?? {})]);
  const result: { key: string; diff: number }[] = [];
  for (const key of allKeys) {
    const cur = currentBonus?.[key] ?? 0;
    const can = candidateBonus?.[key] ?? 0;
    if (can !== cur) {
      result.push({ key: key.toUpperCase(), diff: can - cur });
    }
  }
  return result;
}

export class InventoryScene extends Phaser.Scene {
  private equipContainer?: Phaser.GameObjects.Container;
  private pickerContainer?: Phaser.GameObjects.Container;

  constructor() {
    super('Inventory');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const cx = GAME_WIDTH / 2;
    const store = useGameStore.getState();
    const player = store.player;
    if (!player) { fadeToScene(this, 'Menu'); return; }
    addResonanceEffects(this, player.resonance, GAME_WIDTH, GAME_HEIGHT, { nodePulse: false, shake: false, shimmer: false, textGlitch: false });

    this.add.text(cx, 50, 'Inventory', { fontFamily: FONT_SERIF, fontSize: '34px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.add.text(cx, 85, `Gold: ${player.gold}`, { fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.goldBright }).setOrigin(0.5);

    const panelX = cx - 380;
    this.addSection(panelX, 120, 'Equipped');
    this.renderEquipment(panelX, player);
    this.addSection(panelX, 400, 'Inventory');
    this.renderInventory(panelX, player);

    createButton(this, cx, GAME_HEIGHT - 60, 'Back', () => fadeToScene(this, 'Board'), { width: 200 });
  }

  private addSection(x: number, y: number, label: string) {
    this.add.text(x, y, label, { fontFamily: FONT_SERIF, fontSize: '16px', color: PALETTE_HEX.gold });
    this.add.rectangle(x + 300, y + 10, 500, 1, 0xc9a24b, 0.3);
  }

  private renderEquipment(panelX: number, player: ReturnType<typeof useGameStore.getState>['player']) {
    this.equipContainer?.destroy();
    const container = this.add.container(0, 0);

    const slotKeys: (keyof Equipment)[] = ['weapon', 'armour', 'accessory', 'focus'];
    slotKeys.forEach((slot, i) => {
      const y = 165 + i * 50;
      const currentId = player!.equipment[slot];

      const bg = this.add.rectangle(panelX + 250, y, 540, 38, 0x16191d).setStrokeStyle(1, 0x2a2e33);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setFillStyle(0x1e2228))
        .on('pointerout', () => bg.setFillStyle(0x16191d))
        .on('pointerdown', () => this.openPicker(slot));

      const slotLabel = this.add.text(panelX + 20, y, SLOT_LABELS[slot], {
        fontFamily: FONT_SERIF, fontSize: '13px', color: PALETTE_HEX.boneMuted,
      }).setOrigin(0, 0.5);

      if (currentId) {
        const def = ITEMS[currentId];
        if (def) {
          const nameText = this.add.text(panelX + 130, y, def.name, {
            fontFamily: FONT_SERIF, fontSize: '13px', color: PALETTE_HEX.bone,
          }).setOrigin(0, 0.5);
          const bonusText = this.add.text(panelX + 350, y, statBonusText(def.effect), {
            fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.gold,
          }).setOrigin(0, 0.5);
          container.add([bg, slotLabel, nameText, bonusText]);
        }
      } else {
        const emptyText = this.add.text(panelX + 130, y, '— empty —', {
          fontFamily: FONT_SERIF, fontSize: '13px', color: '#555555', fontStyle: 'italic',
        }).setOrigin(0, 0.5);
        container.add([bg, slotLabel, emptyText]);
      }
    });

    this.equipContainer = container;
  }

  private renderInventory(panelX: number, player: ReturnType<typeof useGameStore.getState>['player']) {
    const items = player!.inventory.filter((e) => e.qty > 0);
    if (items.length === 0) {
      this.add.text(panelX + 20, 440, 'Nothing carried.', { fontFamily: FONT_SERIF, fontSize: '13px', color: '#555555', fontStyle: 'italic' });
    } else {
      const maxVisible = Math.min(items.length, 10);
      for (let i = 0; i < maxVisible; i++) {
        const entry = items[i];
        const y = 440 + i * 34;
        const def = ITEMS[entry.id];
        const itemName = def?.name ?? entry.id;
        const desc = def?.description ?? '';
        const kind = def?.kind ?? '';
        this.add.text(panelX + 20, y, `×${entry.qty}`, { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.gold });
        this.add.text(panelX + 55, y, itemName, { fontFamily: FONT_SERIF, fontSize: '13px', color: PALETTE_HEX.bone, wordWrap: { width: 200 } });
        this.add.text(panelX + 270, y, desc, { fontFamily: FONT_SERIF, fontSize: '11px', color: PALETTE_HEX.boneMuted, wordWrap: { width: 300 } });
        this.add.text(panelX + 600, y, kind, { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.boneMuted });
      }
      if (items.length > 10) {
        this.add.text(panelX + 20, 440 + 10 * 34, `... and ${items.length - 10} more items`, {
          fontFamily: FONT_SERIF, fontSize: '12px', color: PALETTE_HEX.boneMuted, fontStyle: 'italic',
        });
      }
    }
  }

  private openPicker(slot: keyof Equipment) {
    const store = useGameStore.getState();
    const player = store.player;
    if (!player) return;

    const currentId = player.equipment[slot];
    const kind = SLOT_KIND_MAP[slot];
    const compatibleItems = player.inventory.filter((e) => {
      const def = ITEMS[e.id];
      return def && def.kind === kind && e.qty > 0;
    });

    this.pickerContainer?.destroy();

    const depth = 50;
    const cx = GAME_WIDTH / 2;

    const container = this.add.container(0, 0).setDepth(depth);
    this.pickerContainer = container;

    const bg = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(depth);
    bg.setInteractive().on('pointerdown', () => this.closePicker());
    container.add(bg);

    const panelW = 640;
    const rowH = 38;
    const itemCount = compatibleItems.length + 1;
    const maxRows = 7;
    const rows = Math.min(itemCount, maxRows) + 1;
    const panelH = Math.max(180, 70 + rows * (rowH + 4));
    const panelY = GAME_HEIGHT / 2;

    const panel = this.add.rectangle(cx, panelY, panelW, panelH, 0x16191d).setStrokeStyle(1, 0xc9a24b, 0.5).setDepth(depth + 1);
    container.add(panel);

    const title = this.add.text(cx, panelY - panelH / 2 + 22, `Choose ${SLOT_LABELS[slot]}`, {
      fontFamily: FONT_SERIF, fontSize: '18px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5).setDepth(depth + 2);
    container.add(title);

    const listStartY = panelY - panelH / 2 + 48;

    const currentDef = currentId ? ITEMS[currentId] : null;
    const currentBonus = currentDef?.effect?.statBonus;

    const cancelBtn = createButton(this, cx + panelW / 2 - 140, panelY + panelH / 2 - 22, 'Cancel', () => this.closePicker(), { width: 100, height: 28, fontSize: '11px' });
    cancelBtn.container.setDepth(depth + 3);
    container.add(cancelBtn.container);

    function makeRow(
      scene: InventoryScene,
      label: string,
      bonusStr: string,
      deltaStr: string,
      isCurrent: boolean,
      isRemove: boolean,
      index: number,
      selectId: string | null,
    ) {
      const y = listStartY + index * (rowH + 4) + rowH / 2;
      const rowBg = scene.add.rectangle(cx + 20, y, panelW - 60, rowH, isCurrent ? 0x1a1d22 : 0x111316).setStrokeStyle(1, isCurrent ? 0x555555 : 0x2a2e33).setDepth(depth + 2);
      const elements: Phaser.GameObjects.GameObject[] = [rowBg];

      const nameText = scene.add.text(cx - panelW / 2 + 30, y, label, {
        fontFamily: FONT_SERIF, fontSize: '13px', color: isCurrent ? PALETTE_HEX.boneMuted : PALETTE_HEX.bone,
      }).setOrigin(0, 0.5).setDepth(depth + 3);
      elements.push(nameText);

      if (bonusStr) {
        const bonusT = scene.add.text(cx - 40, y, bonusStr, {
          fontFamily: FONT_MONO, fontSize: '11px', color: isCurrent ? PALETTE_HEX.boneMuted : PALETTE_HEX.gold,
        }).setOrigin(0, 0.5).setDepth(depth + 3);
        elements.push(bonusT);
      }

      if (deltaStr) {
        const isPositive = deltaStr.startsWith('+');
        const deltaT = scene.add.text(cx + 100, y, deltaStr, {
          fontFamily: FONT_MONO, fontSize: '11px', color: isPositive ? PALETTE_HEX.ok : PALETTE_HEX.danger,
        }).setOrigin(0, 0.5).setDepth(depth + 3);
        elements.push(deltaT);
      }

      if (isCurrent) {
        const eqLabel = scene.add.text(cx + panelW / 2 - 120, y, 'Equipped', {
          fontFamily: FONT_MONO, fontSize: '10px', color: '#555555',
        }).setOrigin(0, 0.5).setDepth(depth + 3);
        elements.push(eqLabel);
      } else if (!isRemove) {
        const eqBtn = createButton(scene, cx + panelW / 2 - 80, y, 'Equip', () => {
          if (selectId) store.equipItem(slot, selectId);
          scene.closePicker();
          scene.refreshScene();
        }, { width: 70, height: 26, fontSize: '10px' });
        eqBtn.container.setDepth(depth + 3);
        elements.push(eqBtn.container);
      } else {
        const rmBtn = createButton(scene, cx + panelW / 2 - 80, y, 'Remove', () => {
          store.equipItem(slot, null);
          scene.closePicker();
          scene.refreshScene();
        }, { width: 70, height: 26, fontSize: '10px' });
        rmBtn.container.setDepth(depth + 3);
        elements.push(rmBtn.container);
      }

      container.add(elements);
    }

    let rowIndex = 0;

    if (currentId && currentDef) {
      makeRow(this, `[${currentDef.name}]`, statBonusText(currentDef.effect), '', true, false, rowIndex++, null);
    }

    if (slot === 'accessory' && currentId !== null) {
      makeRow(this, '— Remove accessory —', '', '', false, true, rowIndex++, null);
    }

    compatibleItems.forEach((entry) => {
      if (entry.id === currentId) return;
      const def = ITEMS[entry.id];
      if (!def) return;
      const deltas = computeDelta(currentBonus, def.effect?.statBonus);
      const deltaStr = deltas.map((d) => `${d.diff >= 0 ? '+' : ''}${d.diff} ${d.key}`).join(', ');
      makeRow(this, def.name, statBonusText(def.effect), deltaStr, false, false, rowIndex++, entry.id);
    });
  }

  private closePicker() {
    this.pickerContainer?.destroy();
    this.pickerContainer = undefined;
  }

  private refreshScene() {
    this.scene.restart();
  }
}
