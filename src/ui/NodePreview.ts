import Phaser from 'phaser';
import type { BoardNode } from '@data/types';
import { FONT_BODY, FONT_SERIF, PALETTE_HEX } from './uiTheme';

const NODE_LABELS: Record<string, string> = {
  event: 'A Choice Awaits',
  combat: 'Danger Ahead',
  rest: 'A Place to Breathe',
  discovery: 'Something Left Behind',
  trap: 'Something Feels Wrong',
  landmark: 'The Cave Mouth',
};

export interface NodePreviewCard {
  container: Phaser.GameObjects.Container;
  show: (node: BoardNode) => void;
  /** Sets the tip line below the node label ('' clears it). Cleared by the next `show`. */
  setTip: (text: string) => void;
  destroy: () => void;
}

/** A vertically-stacked "tile" card: badge icon, "TILE N" title, a short description, and an optional tip. */
export function createNodePreview(scene: Phaser.Scene, x: number, y: number, width = 214): NodePreviewCard {
  const badgeR = 30;
  const badge = scene.add.circle(0, -46, badgeR, 0x22262c).setStrokeStyle(2, 0xc9a24b, 0.9);
  const icon = scene.add.image(0, -46, 'node_event').setDisplaySize(28, 28);
  const title = scene.add.text(0, -4, 'TILE —', {
    fontFamily: FONT_SERIF, fontSize: '20px', color: PALETTE_HEX.gold,
  }).setOrigin(0.5);
  const sub = scene.add.text(0, 22, '', {
    fontFamily: FONT_BODY, fontSize: '14px', color: PALETTE_HEX.boneMuted,
    align: 'center', wordWrap: { width: width - 24 },
  }).setOrigin(0.5, 0);
  const tip = scene.add.text(0, 56, '', {
    fontFamily: FONT_BODY, fontSize: '12px', color: PALETTE_HEX.gold,
    fontStyle: 'italic', align: 'center', wordWrap: { width: width - 24 },
  }).setOrigin(0.5, 0);
  const container = scene.add.container(x, y, [badge, icon, title, sub, tip]);

  return {
    container,
    show: (node: BoardNode) => {
      icon.setTexture(`node_${node.type}`);
      title.setText(`TILE ${node.index}`);
      sub.setText(NODE_LABELS[node.type] ?? node.type);
      tip.setText('');
    },
    setTip: (text: string) => tip.setText(text),
    destroy: () => container.destroy(),
  };
}
