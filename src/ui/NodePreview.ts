import Phaser from 'phaser';
import type { BoardNode } from '@data/types';
import { FONT_BODY, FONT_SERIF, PALETTE_HEX } from './uiTheme';

const NODE_LABELS: Record<string, string> = {
  event: 'A Choice Awaits',
  combat: 'Danger Ahead',
  rest: 'A Place to Breathe',
  discovery: 'Something Left Behind',
  trap: 'Something Feels Wrong',
  landmark: 'A Landmark Looms',
};

export interface NodePreviewCard {
  container: Phaser.GameObjects.Container;
  show: (node: BoardNode) => void;
  destroy: () => void;
}

export function createNodePreview(scene: Phaser.Scene, x: number, y: number): NodePreviewCard {
  const bg = scene.add.image(0, 0, 'panel_stat').setDisplaySize(250, 108);
  const icon = scene.add.image(-92, 0, 'node_event').setDisplaySize(32, 32);
  const label = scene.add.text(-60, -16, '', { fontFamily: FONT_SERIF, fontSize: '16px', color: PALETTE_HEX.bone }).setOrigin(0, 0.5);
  const sub = scene.add.text(-60, 12, '', { fontFamily: FONT_BODY, fontSize: '14px', color: PALETTE_HEX.boneMuted, wordWrap: { width: 170 } }).setOrigin(0, 0.5);
  const container = scene.add.container(x, y, [bg, icon, label, sub]);

  return {
    container,
    show: (node: BoardNode) => {
      icon.setTexture(`node_${node.type}`);
      label.setText(NODE_LABELS[node.type] ?? node.type);
      sub.setText(`Page ${node.page} · Node ${node.index}`);
    },
    destroy: () => container.destroy(),
  };
}