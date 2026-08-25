import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { ITEMS } from '@data/items';
import type { ItemDef, Equipment } from '@data/types';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX, SURFACE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { createTitle, createSectionLabel } from '@ui/headings';
import { createPager, createModal, type ModalHandle, type PagerHandle } from '@ui/controls';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { settleIn } from '@systems/motion';
import { audio } from '@placeholder/PlaceholderAudio';
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

const num = (css: string): number => parseInt(css.replace('#', ''), 16);
const LIST_PER_PAGE = 6;

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
  private listContainer?: Phaser.GameObjects.Container;
  private listPager?: PagerHandle;
  private listPage = 0;
  private picker?: ModalHandle;
  private goldText?: Phaser.GameObjects.Text;

  constructor() {
    super('Inventory');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    settleIn(this);
    const cx = GAME_WIDTH / 2;
    const store = useGameStore.getState();
    const player = store.player;
    if (!player) { fadeToScene(this, 'Menu'); return; }
    addResonanceEffects(this, player.resonance, GAME_WIDTH, GAME_HEIGHT, { nodePulse: false, shake: false, shimmer: false, textGlitch: false });

    createTitle(this, cx, 50, 'Inventory');
    this.goldText = this.add.text(cx, 85, '', { fontFamily: FONT_MONO, fontSize: '16px', color: PALETTE_HEX.goldBright }).setOrigin(0.5);

    const panelX = cx - 380;
    this.renderGold();
    this.addSectionHeader(panelX, 120, 'Equipped');
    this.renderEquipment(panelX, player);
    this.addSectionHeader(panelX + 320, 120, 'Carried');
    this.renderInventoryList(panelX + 320, player);

    // Esc closes any open picker, otherwise returns to the board.
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.picker && !this.picker.closed) this.closePicker();
      else fadeToScene(this, 'Board');
    });

    createButton(this, cx, GAME_HEIGHT - 60, 'Back', () => fadeToScene(this, 'Board'), { width: 200 });
  }

  /** Live stat/gold readout — updated in place, never a scene restart. */
  private renderGold(): void {
    const player = useGameStore.getState().player;
    this.goldText?.setText(`Gold: ${player?.gold ?? 0}`);
  }

  private addSectionHeader(x: number, y: number, label: string): void {
    createSectionLabel(this, x, y, label);
    this.add.rectangle(x + 250, y + 10, 500, 1, num(PALETTE_HEX.gold), 0.3);
  }

  /** Re-renders only the equipment column — no fadeIn replay, no scroll loss. */
  private refreshPanels(): void {
    const player = useGameStore.getState().player;
    if (!player) return;
    this.renderGold();
    const panelX = GAME_WIDTH / 2 - 380;
    this.renderEquipment(panelX, player);
    this.listPage = 0;
    this.renderInventoryList(panelX + 320, player);
  }

  private renderEquipment(panelX: number, player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>) {
    this.equipContainer?.destroy();
    const container = this.add.container(0, 0);

    const slotKeys: (keyof Equipment)[] = ['weapon', 'armour', 'accessory', 'focus'];
    slotKeys.forEach((slot, i) => {
      const y = 165 + i * 50;
      const currentId = player.equipment[slot];

      const bg = this.add.rectangle(panelX + 250, y, 540, 38, SURFACE_HEX.row).setStrokeStyle(1, SURFACE_HEX.border);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setFillStyle(SURFACE_HEX.rowHoverAlt))
        .on('pointerout', () => bg.setFillStyle(SURFACE_HEX.row))
        .on('pointerdown', () => this.openPicker(slot));

      const slotLabel = this.add.text(panelX + 20, y, SLOT_LABELS[slot], {
        fontFamily: FONT_SERIF, fontSize: '14px', color: PALETTE_HEX.boneMuted,
      }).setOrigin(0, 0.5);

      if (currentId) {
        const def = ITEMS[currentId];
        if (def) {
          const nameText = this.add.text(panelX + 140, y, def.name, {
            fontFamily: FONT_SERIF, fontSize: '15px', color: PALETTE_HEX.bone,
          }).setOrigin(0, 0.5);
          const bonusText = this.add.text(panelX + 380, y, statBonusText(def.effect), {
            fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.gold,
          }).setOrigin(0, 0.5);
          container.add([bg, slotLabel, nameText, bonusText]);
        }
      } else {
        const emptyText = this.add.text(panelX + 140, y, '— empty —', {
          fontFamily: FONT_SERIF, fontSize: '15px', color: PALETTE_HEX.boneMuted, fontStyle: 'italic',
        }).setOrigin(0, 0.5);
        container.add([bg, slotLabel, emptyText]);
      }
    });

    this.equipContainer = container;
  }

  private renderInventoryList(panelX: number, player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>) {
    this.listContainer?.destroy();
    const container = this.add.container(0, 0);
    this.listContainer = container;

    const items = player.inventory.filter((e) => e.qty > 0);
    if (items.length === 0) {
      container.add(this.add.text(panelX + 20, 170, 'Nothing carried.', {
        fontFamily: FONT_SERIF, fontSize: '15px', color: PALETTE_HEX.boneMuted, fontStyle: 'italic',
      }));
      return;
    }

    const pageCount = Math.max(1, Math.ceil(items.length / LIST_PER_PAGE));
    if (this.listPage >= pageCount) this.listPage = pageCount - 1;
    const slice = items.slice(this.listPage * LIST_PER_PAGE, (this.listPage + 1) * LIST_PER_PAGE);

    slice.forEach((entry, i) => {
      const y = 165 + i * 50;
      const def = ITEMS[entry.id];
      const itemName = def?.name ?? entry.id;
      const desc = def?.description ?? '';
      const kind = def?.kind ?? '';

      const rowBg = this.add.rectangle(panelX + 220, y, 500, 38, SURFACE_HEX.row).setStrokeStyle(1, SURFACE_HEX.hairline);
      container.add(rowBg);
      container.add(this.add.text(panelX + 20, y, `×${entry.qty}`, { fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.gold }).setOrigin(0, 0.5));
      container.add(this.add.text(panelX + 60, y - 8, itemName, { fontFamily: FONT_SERIF, fontSize: '14px', color: PALETTE_HEX.bone }).setOrigin(0, 0.5));
      container.add(this.add.text(panelX + 60, y + 10, desc, { fontFamily: FONT_BODY, fontSize: '11px', color: PALETTE_HEX.boneMuted, wordWrap: { width: 300 } }).setOrigin(0, 0));
      container.add(this.add.text(panelX + 400, y, kind, { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted }).setOrigin(0, 0.5));
    });

    if (!this.listPager) {
      this.listPager = createPager(this, panelX + 220, 480, (page) => {
        this.listPage = page;
        audio.pageTurn();
        const p = useGameStore.getState().player;
        if (p) this.renderInventoryList(panelX, p);
      }, { depth: 5 });
    }
    this.listPager.update(this.listPage, pageCount);
  }

  private openPicker(slot: keyof Equipment) {
    if (this.picker && !this.picker.closed) return;
    const store = useGameStore.getState();
    const player = store.player;
    if (!player) return;

    const currentId = player.equipment[slot];
    const kind = SLOT_KIND_MAP[slot];
    const compatibleItems = player.inventory.filter((e) => {
      const def = ITEMS[e.id];
      return def && def.kind === kind && e.qty > 0;
    });

    const modal = createModal(this, `Choose ${SLOT_LABELS[slot]}`, 640, 420, {
      variant: 'stone',
      depth: 50,
      onClose: () => { this.picker = undefined; },
    });
    this.picker = modal;

    const rowH = 38;
    let rowIndex = 0;
    const listStartY = modal.contentY;

    const makeRow = (
      label: string,
      bonusStr: string,
      deltaStr: string,
      isCurrent: boolean,
      action: 'none' | 'equip' | 'remove',
      selectId: string | null,
    ) => {
      const y = listStartY + rowIndex * (rowH + 6) + rowH / 2;
      rowIndex += 1;
      const rowBg = this.add.rectangle(modal.contentX + 270, y, 592, rowH,
        isCurrent ? SURFACE_HEX.panel : SURFACE_HEX.row)
        .setStrokeStyle(1, isCurrent ? SURFACE_HEX.muted : SURFACE_HEX.border);
      modal.container.add(rowBg);

      modal.container.add(this.add.text(modal.contentX + 6, y, label, {
        fontFamily: FONT_SERIF, fontSize: '15px', color: isCurrent ? PALETTE_HEX.boneMuted : PALETTE_HEX.bone,
      }).setOrigin(0, 0.5));

      if (bonusStr) {
        modal.container.add(this.add.text(modal.contentX + 236, y, bonusStr, {
          fontFamily: FONT_MONO, fontSize: '13px', color: isCurrent ? PALETTE_HEX.boneMuted : PALETTE_HEX.gold,
        }).setOrigin(0, 0.5));
      }
      if (deltaStr) {
        const isPositive = deltaStr.startsWith('+');
        modal.container.add(this.add.text(modal.contentX + 360, y, deltaStr, {
          fontFamily: FONT_MONO, fontSize: '13px', color: isPositive ? PALETTE_HEX.ok : PALETTE_HEX.danger,
        }).setOrigin(0, 0.5));
      }

      if (action === 'equip' && selectId) {
        const eqBtn = createButton(this, modal.contentX + 512, y, 'Equip', () => {
          store.equipItem(slot, selectId);
          modal.close();
          this.refreshPanels();
        }, { width: 70, height: 28, fontSize: '12px' });
        modal.container.add(eqBtn.container);
      } else if (action === 'remove') {
        const rmBtn = createButton(this, modal.contentX + 512, y, 'Remove', () => {
          store.equipItem(slot, null);
          modal.close();
          this.refreshPanels();
        }, { width: 70, height: 28, fontSize: '12px' });
        modal.container.add(rmBtn.container);
      } else if (isCurrent) {
        modal.container.add(this.add.text(modal.contentX + 512, y, 'Equipped', {
          fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted,
        }).setOrigin(0, 0.5));
      }
    };

    const currentDef = currentId ? ITEMS[currentId] : null;
    const currentBonus = currentDef?.effect?.statBonus;

    if (currentId && currentDef) {
      makeRow(`[${currentDef.name}]`, statBonusText(currentDef.effect), '', true, 'none', null);
      // Every slot can be emptied — not just accessories.
      makeRow(`— unequip ${SLOT_LABELS[slot].toLowerCase()} —`, '', '', false, 'remove', null);
    }

    compatibleItems.forEach((entry) => {
      if (entry.id === currentId) return;
      const def = ITEMS[entry.id];
      if (!def) return;
      const deltas = computeDelta(currentBonus, def.effect?.statBonus);
      const deltaStr = deltas.map((d) => `${d.diff >= 0 ? '+' : ''}${d.diff} ${d.key}`).join(', ');
      makeRow(def.name, statBonusText(def.effect), deltaStr, false, 'equip', entry.id);
    });
  }

  private closePicker() {
    this.picker?.close();
    this.picker = undefined;
  }
}
