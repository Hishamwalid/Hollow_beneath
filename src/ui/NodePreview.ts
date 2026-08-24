import Phaser from 'phaser';
import type { BoardNode } from '@data/types';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX } from './uiTheme';

const NODE_INFO: Record<string, { label: string; explain: string; ring: number }> = {
  event: { label: 'A Choice Awaits', explain: 'A story moment — your choices shift factions & Resonance.', ring: 0xc9a24b },
  combat: { label: 'Danger Ahead', explain: 'Enemies bar the path. Win for XP and loot.', ring: 0xb0453f },
  rest: { label: 'A Place to Breathe', explain: 'Recover HP / MP. Rests also calm Resonance.', ring: 0x5c8a5c },
  discovery: { label: 'Something Left Behind', explain: 'Search for gold, items, lore, or Echo Shards.', ring: 0x5dade2 },
  trap: { label: 'Something Feels Wrong', explain: 'A hazard — DEX check to dodge the worst.', ring: 0xe67e22 },
  landmark: { label: 'The Cave Mouth', explain: 'A chapter boss guards this door.', ring: 0xe9c876 },
};

export interface NodePreviewCard {
  container: Phaser.GameObjects.Container;
  show: (node: BoardNode) => void;
  /** Sets the tip line below the node label ('' clears it). Cleared by the next `show`. */
  setTip: (text: string) => void;
  destroy: () => void;
}

/** "Next node" tile: icon badge, NODE n · name, a one-line explainer, optional tip. */
export function createNodePreview(scene: Phaser.Scene, x: number, y: number, width = 214): NodePreviewCard {
  const badgeR = 30;
  // Vertical stack sized to fit a 180px panel: badge top ≈ -78, tip bottom ≈ +84.
  const badge = scene.add.circle(0, -48, badgeR, 0x22262c).setStrokeStyle(2, 0xc9a24b, 0.9);
  const icon = scene.add.image(0, -48, 'node_event').setDisplaySize(28, 28);
  const done = scene.add.text(18, -66, '✔', {
    fontFamily: FONT_MONO, fontSize: '16px', color: PALETTE_HEX.ok,
  }).setOrigin(0.5).setVisible(false);
  const indexLine = scene.add.text(0, -14, '', {
    fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.boneMuted,
  }).setOrigin(0.5).setLetterSpacing(typeof scene.add.text === 'function' ? 1 : 0);
  const title = scene.add.text(0, 4, 'NODE —', {
    fontFamily: FONT_SERIF, fontSize: '17px', color: PALETTE_HEX.gold,
  }).setOrigin(0.5);
  const sub = scene.add.text(0, 26, '', {
    fontFamily: FONT_BODY, fontSize: '13px', color: PALETTE_HEX.bone,
    align: 'center', wordWrap: { width: width - 24 },
  }).setOrigin(0.5, 0);
  const explain = scene.add.text(0, 48, '', {
    fontFamily: FONT_BODY, fontSize: '12px', color: PALETTE_HEX.boneMuted,
    fontStyle: 'italic', align: 'center', wordWrap: { width: width - 28 },
  }).setOrigin(0.5, 0);
  const tip = scene.add.text(0, 72, '', {
    fontFamily: FONT_BODY, fontSize: '12px', color: PALETTE_HEX.gold,
    fontStyle: 'italic', align: 'center', wordWrap: { width: width - 24 },
  }).setOrigin(0.5, 0);
  const container = scene.add.container(x, y, [badge, icon, done, indexLine, title, sub, explain, tip]);

  return {
    container,
    show: (node: BoardNode) => {
      const info = NODE_INFO[node.type] ?? { label: node.type, explain: '', ring: 0xc9a24b };
      icon.setTexture(`node_${node.type}`);
      badge.setStrokeStyle(2, info.ring, 0.95);
      title.setText(info.label.toUpperCase());
      if (typeof title.setLetterSpacing === 'function') title.setLetterSpacing(1);
      indexLine.setText(`NODE ${node.index}`);
      sub.setText('');
      explain.setText(node.resolved ? 'Resolved.' : info.explain);
      done.setVisible(node.resolved);
      tip.setText('');
      // Nudge layout when resolved line hidden.
      sub.setY(node.resolved ? 22 : 26);
      explain.setY(node.resolved ? 42 : 48);
    },
    setTip: (text: string) => tip.setText(text),
    destroy: () => container.destroy(),
  };
}
