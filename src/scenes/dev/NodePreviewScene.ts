/**
 * NodePreviewScene.ts
 *
 * DEV-ONLY TOOL — verifies STAGE1_NODES visually before wiring into
 * BoardGenerator. Draws the stage background plus 40 numbered node
 * markers so you can confirm they hug the path and that node 0 / node 39
 * land where you expect (leftmost outer ring / cave mouth).
 *
 * Usage:
 *   1. Add to your scene list (see main.ts pattern used for PathPointPicker).
 *   2. game.scene.start('NodePreview')
 */

import Phaser from 'phaser';
import { STAGE1_NODES } from '../../data/paths/stage1Nodes';

const STAGE_IMAGE_KEY = 'stage1-bg-preview';
const STAGE_IMAGE_PATH = 'assets/image_assets/backgrounds/stage1_background.png';

export class NodePreviewScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NodePreview' });
  }

  preload(): void {
    this.load.image(STAGE_IMAGE_KEY, STAGE_IMAGE_PATH);
  }

  create(): void {
    const bg = this.add.image(0, 0, STAGE_IMAGE_KEY).setOrigin(0, 0);
    this.cameras.main.setBounds(0, 0, bg.width, bg.height);

    this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
      const zoom = Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.25, 4);
      this.cameras.main.setZoom(zoom);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
      }
    });

    const lineGfx = this.add.graphics();
    lineGfx.lineStyle(2, 0x00ffff, 0.6);
    lineGfx.beginPath();
    lineGfx.moveTo(STAGE1_NODES[0].x, STAGE1_NODES[0].y);
    for (let i = 1; i < STAGE1_NODES.length; i++) {
      lineGfx.lineTo(STAGE1_NODES[i].x, STAGE1_NODES[i].y);
    }
    lineGfx.strokePath();

    const markerGfx = this.add.graphics();
    STAGE1_NODES.forEach((node) => {
      const color = node.isStart ? 0x00ff00 : node.isBoss ? 0xff0000 : 0xffcc00;
      const radius = node.isStart || node.isBoss ? 10 : 7;

      markerGfx.fillStyle(color, 1);
      markerGfx.fillCircle(node.x, node.y, radius);
      markerGfx.lineStyle(2, 0x000000, 1);
      markerGfx.strokeCircle(node.x, node.y, radius);

      this.add
        .text(node.x + radius + 3, node.y - radius - 3, `${node.index}`, {
          fontSize: '12px',
          color: '#ffffff',
          backgroundColor: '#000000aa',
          padding: { x: 2, y: 1 },
        })
        .setDepth(999);
    });

    this.add
      .text(
        10,
        10,
        `${STAGE1_NODES.length} nodes | green = start (0) | red = boss (${STAGE1_NODES.length - 1}) | wheel: zoom | middle-drag: pan`,
        { fontSize: '13px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 6, y: 4 } }
      )
      .setScrollFactor(0)
      .setDepth(1000);
  }
}