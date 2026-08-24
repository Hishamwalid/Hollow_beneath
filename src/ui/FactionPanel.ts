import Phaser from 'phaser';
import type { FactionState } from '@data/types';
import { FACTIONS, influenceStatus, type InfluenceStatus } from '@data/factions';
import { FONT_MONO, FONT_SERIF, PALETTE_HEX, STATUS_HEX } from './uiTheme';

export interface FactionPanelHandle {
  container: Phaser.GameObjects.Container;
  update: (faction: FactionState) => void;
  destroy: () => void;
}

const ROW_H = 30;
const HEADER_H = 36;

function statusColor(s: InfluenceStatus): number {
  return Phaser.Display.Color.HexStringToColor(STATUS_HEX[s]).color;
}

function statusCss(s: InfluenceStatus): string {
  return STATUS_HEX[s];
}

/**
 * Faction standings card — one row per faction:
 *   [wax seal] NAME            ▍bar▍   +12  Friendly
 * The bar is centered on zero (Hostile ← | → Devoted) so the lean reads at a
 * glance; the status word is the primary signal, not the raw number.
 */
export function createFactionPanel(scene: Phaser.Scene, x: number, y: number, width = 214): FactionPanelHandle {
  const entries = Object.values(FACTIONS);
  const headerH = HEADER_H;
  const height = headerH + entries.length * ROW_H + 8;
  const container = scene.add.container(x, y).setDepth(10);

  const bg = scene.add.rectangle(width / 2, height / 2, width, height, 0x16191d, 0.94).setStrokeStyle(1, 0xc9a24b, 0.6);
  container.add(bg);

  const header = scene.add.text(16, 12, 'FACTION STANDINGS', {
    fontFamily: FONT_SERIF,
    fontSize: '15px',
    color: PALETTE_HEX.gold,
  });
  if (typeof header.setLetterSpacing === 'function') header.setLetterSpacing(2);
  container.add(header);
  container.add(scene.add.rectangle(width / 2, headerH - 6, width - 24, 1, 0xc9a24b, 0.4));

  interface RowRefs {
    barMask: Phaser.GameObjects.Rectangle;
    valueText: Phaser.GameObjects.Text;
    statusText: Phaser.GameObjects.Text;
  }
  const rows: Record<string, RowRefs> = {};

  const rowW = width - 32;
  const halfW = (rowW - 96) / 2; // bar area after seal+name and value columns
  const barCx = 16 + 24 + 8 + halfW / 2 + 20;

  entries.forEach((f, i) => {
    const ry = headerH + 8 + i * ROW_H;

    const seal = scene.add.image(26, ry + ROW_H / 2 - 4, `seal_${f.id}`).setDisplaySize(22, 22);
    const name = scene.add.text(42, ry + ROW_H / 2 - 4, f.name.replace(/^The /, ''), {
      fontFamily: FONT_SERIF,
      fontSize: '13px',
      color: f.colorCss,
    }).setOrigin(0, 0.5);

    // Centered zero bar
    const barY = ry + ROW_H / 2 - 4;
    const barW = halfW;
    const track = scene.add.rectangle(barCx - 2, barY, barW, 8, 0x22262c).setOrigin(0.5).setStrokeStyle(1, 0x3a3f46);
    const mid = scene.add.rectangle(barCx - 2 + barW / 2, barY - 6, 1, 14, 0x9a9488, 0.55).setOrigin(0.5);
    const fill = scene.add.rectangle(barCx - 2 + barW / 2, barY, 0, 8, 0x5c8a5c).setOrigin(0.5);

    const valueText = scene.add.text(barCx - 2 + barW / 2 + 8, barY, '0', {
      fontFamily: FONT_MONO,
      fontSize: '13px',
      color: PALETTE_HEX.bone,
    }).setOrigin(0, 0.5);

    const statusText = scene.add.text(width - 16, barY, 'Neutral', {
      fontFamily: FONT_MONO,
      fontSize: '11px',
      color: STATUS_HEX.Neutral,
    }).setOrigin(1, 0.5);

    container.add([seal, name, track, mid, fill, valueText, statusText]);

    rows[f.id] = {
      barMask: fill,
      valueText,
      statusText,
    };
  });

  return {
    container,
    update: (faction: FactionState) => {
      for (const f of entries) {
        const refs = rows[f.id];
        if (!refs) continue;
        const v = faction[f.id] ?? 0;
        const status = influenceStatus(v);
        const color = statusColor(status);

        refs.valueText.setText(String(v));
        refs.valueText.setColor(v === 0 ? PALETTE_HEX.bone : statusCss(status));

        refs.statusText.setText(status);
        refs.statusText.setColor(statusCss(status));

        const frac = Math.min(1, Math.abs(v) / 100);
        const w = Math.max(2, frac * (halfW / 2));
        const cx0 = refs.barMask.x; // centered zero point
        refs.barMask.setSize(w, 8);
        refs.barMask.setX(v >= 0 ? cx0 + w / 2 : cx0 - w / 2);
        refs.barMask.setFillStyle(color);
        refs.barMask.setAlpha(status === 'Neutral' && v === 0 ? 0.35 : 0.95);
      }
    },
    destroy: () => container.destroy(),
  };
}
