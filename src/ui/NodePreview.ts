import Phaser from 'phaser';
import type { BoardNode } from '@data/types';
import { FONT_SERIF, PALETTE_HEX } from './uiTheme';

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
  const bg = scene.add.image(0, 0, 'panel_stat').setDisplaySize(220, 90);
  const icon = scene.add.image(-80, 0, 'node_event').setDisplaySize(28, 28);
  const label = scene.add.text(-50, -14, '', { fontFamily: FONT_SERIF, fontSize: '15px', color: PALETTE_HEX.bone }).setOrigin(0, 0.5);
  const sub = scene.add.text(-50, 10, '', { fontFamily: FONT_SERIF, fontSize: '11px', color: PALETTE_HEX.boneMuted, wordWrap: { width: 150 } }).setOrigin(0, 0.5);
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
