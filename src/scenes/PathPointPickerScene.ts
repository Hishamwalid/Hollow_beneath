/**
 * PathPointPickerScene.ts
 *
 * DEV-ONLY TOOL — not for shipping.
 *
 * Click along a stage's path (in order) to record anchor points for a
 * Phaser.Curves.Spline. Used to define the node path for stages like
 * "The Hollow Beneath" Stage 1.
 *
 * All actions are driven by an on-screen HTML button bar (not keyboard
 * shortcuts) so nothing depends on canvas focus:
 *   Left click        - add a point at cursor position
 *   Right click        - undo last point (also has an Undo button)
 *   Undo button        - remove last point
 *   Clear button       - clear all points (asks to confirm)
 *   Grid button        - toggle grid overlay
 *   Export button       - shows the JSON in a copyable textarea (+ tries download)
 *   Marker +/- buttons  - resize markers
 *   Mouse wheel        - zoom
 *   Middle-drag        - pan
 *
 * Usage:
 *   1. Add this scene to your Phaser config's `scene` array.
 *   2. Set STAGE_IMAGE_KEY / STAGE_IMAGE_PATH below to your stage art.
 *   3. Launch it: game.scene.start('PathPointPicker')
 *   4. Click along the path in order, starting at your intended start node,
 *      ending at your intended boss node.
 *   5. Click "Export" in the button bar. Copy the JSON from the textarea
 *      that appears (or use the download if your browser allows it), and
 *      save it into your project, e.g. src/data/paths/stage1_path.json
 *   6. Remove this scene from your scene list when you're done (or gate it
 *      behind a dev-only flag).
 */

import Phaser from 'phaser';

// ---- CONFIGURE THESE FOR YOUR STAGE -----------------------------------
const STAGE_IMAGE_KEY = 'stage1-bg';
const STAGE_IMAGE_PATH = 'assets/image_assets/backgrounds/stage1_background.png';
const EXPORT_FILENAME = 'stage1_path.json';
// -------------------------------------------------------------------------

interface PathPoint {
  x: number;
  y: number;
}

export class PathPointPickerScene extends Phaser.Scene {
  private points: PathPoint[] = [];
  private markerGraphics!: Phaser.GameObjects.Graphics;
  private lineGraphics!: Phaser.GameObjects.Graphics;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private labelTexts: Phaser.GameObjects.Text[] = [];
  private coordText!: Phaser.GameObjects.Text;
  private markerRadius = 6;
  private showGrid = false;
  private bg!: Phaser.GameObjects.Image;

  private overlayRoot: HTMLDivElement | null = null;
  private exportPanel: HTMLDivElement | null = null;
  private pointCountLabel: HTMLSpanElement | null = null;

  constructor() {
    super({ key: 'PathPointPicker' });
  }

  preload(): void {
    this.load.image(STAGE_IMAGE_KEY, STAGE_IMAGE_PATH);
  }

  create(): void {
    this.bg = this.add.image(0, 0, STAGE_IMAGE_KEY).setOrigin(0, 0);

    this.cameras.main.setBounds(0, 0, this.bg.width, this.bg.height);

    this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
      const zoom = Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.25, 4);
      this.cameras.main.setZoom(zoom);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
      }
      this.updateCoordText(pointer);
    });

    this.markerGraphics = this.add.graphics();
    this.lineGraphics = this.add.graphics();
    this.gridGraphics = this.add.graphics();

    this.coordText = this.add
      .text(10, 10, '', { fontSize: '14px', color: '#00ff00', backgroundColor: '#000000aa' })
      .setScrollFactor(0)
      .setDepth(1000);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if ((pointer.event?.target as HTMLElement)?.closest?.('#pp-overlay')) return;

      if (pointer.rightButtonDown()) {
        this.undoLastPoint();
        return;
      }
      if (pointer.leftButtonDown()) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.addPoint(Math.round(worldPoint.x), Math.round(worldPoint.y));
      }
    });

    this.input.mouse?.disableContextMenu();

    this.buildOverlay();
    this.redraw();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyOverlay());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroyOverlay());
  }

  private buildOverlay(): void {
    this.destroyOverlay();

    const root = document.createElement('div');
    root.id = 'pp-overlay';
    root.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-end;
      font-family: sans-serif;
    `;

    const bar = document.createElement('div');
    bar.style.cssText = `
      display: flex;
      gap: 6px;
      background: rgba(0,0,0,0.75);
      padding: 8px;
      border-radius: 6px;
    `;

    const makeButton = (label: string, onClick: () => void, bg = '#333'): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        padding: 6px 10px;
        font-size: 13px;
        cursor: pointer;
        background: ${bg};
        color: #fff;
        border: 1px solid #666;
        border-radius: 4px;
      `;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      return btn;
    };

    const countLabel = document.createElement('span');
    countLabel.style.cssText = `
      color: #0f0;
      font-size: 13px;
      align-self: center;
      padding: 0 8px;
    `;
    countLabel.textContent = 'Points: 0';
    this.pointCountLabel = countLabel;

    bar.appendChild(countLabel);
    bar.appendChild(makeButton('Undo', () => this.undoLastPoint()));
    bar.appendChild(makeButton('Clear', () => this.clearAllPoints(), '#663333'));
    bar.appendChild(makeButton('Grid', () => this.toggleGrid()));
    bar.appendChild(makeButton('Marker −', () => this.changeMarkerSize(-1)));
    bar.appendChild(makeButton('Marker +', () => this.changeMarkerSize(1)));
    bar.appendChild(makeButton('Export', () => this.exportPoints(), '#2a6b2a'));

    const help = document.createElement('div');
    help.style.cssText = `
      background: rgba(0,0,0,0.75);
      color: #fff;
      font-size: 12px;
      padding: 6px 8px;
      border-radius: 6px;
      max-width: 320px;
      text-align: right;
    `;
    help.textContent =
      'Left-click: add point | Right-click: undo | Wheel: zoom | Middle-drag: pan';

    root.appendChild(bar);
    root.appendChild(help);
    document.body.appendChild(root);
    this.overlayRoot = root;
  }

  private destroyOverlay(): void {
    document.getElementById('pp-overlay')?.remove();
    this.overlayRoot = null;
    this.exportPanel = null;
    this.pointCountLabel = null;
  }

  private showExportPanel(json: string, downloadWorked: boolean): void {
    this.exportPanel?.remove();

    const panel = document.createElement('div');
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      max-height: 70vh;
      z-index: 10001;
      background: rgba(20,20,20,0.97);
      border: 1px solid #666;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family: sans-serif;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'color:#fff; font-size:14px; display:flex; justify-content:space-between; align-items:center;';
    title.innerHTML = `<span>${downloadWorked ? 'Downloaded stage1_path.json — also copyable below:' : 'Download was blocked — copy the JSON below manually:'}</span>`;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'padding:4px 10px; cursor:pointer; background:#333; color:#fff; border:1px solid #666; border-radius:4px;';
    closeBtn.addEventListener('click', () => panel.remove());
    title.appendChild(closeBtn);

    const textarea = document.createElement('textarea');
    textarea.value = json;
    textarea.readOnly = true;
    textarea.style.cssText = `
      width: 100%;
      height: 45vh;
      background: #111;
      color: #0f0;
      font-family: monospace;
      font-size: 12px;
      border: 1px solid #444;
      border-radius: 4px;
      padding: 8px;
      box-sizing: border-box;
      resize: vertical;
    `;

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy to clipboard';
    copyBtn.style.cssText = 'padding:8px 12px; cursor:pointer; background:#2a6b2a; color:#fff; border:1px solid #666; border-radius:4px; align-self:flex-start;';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(json);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy to clipboard'), 1500);
      } catch {
        textarea.focus();
        textarea.select();
      }
    });

    panel.appendChild(title);
    panel.appendChild(textarea);
    panel.appendChild(copyBtn);
    document.body.appendChild(panel);
    this.exportPanel = panel;

    textarea.focus();
    textarea.select();
  }

  private addPoint(x: number, y: number): void {
    this.points.push({ x, y });
    this.redraw();
  }

  private undoLastPoint(): void {
    this.points.pop();
    this.redraw();
  }

  private clearAllPoints(): void {
    if (this.points.length === 0) return;
    // eslint-disable-next-line no-alert
    const confirmClear = window.confirm(`Clear all ${this.points.length} points?`);
    if (confirmClear) {
      this.points = [];
      this.redraw();
    }
  }

  private toggleGrid(): void {
    this.showGrid = !this.showGrid;
    this.redraw();
  }

  private changeMarkerSize(delta: number): void {
    this.markerRadius = Phaser.Math.Clamp(this.markerRadius + delta, 2, 20);
    this.redraw();
  }

  private updateCoordText(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.coordText.setText(
      `x: ${Math.round(worldPoint.x)}, y: ${Math.round(worldPoint.y)}  |  points: ${this.points.length}  |  zoom: ${this.cameras.main.zoom.toFixed(2)}`
    );
  }

  private redraw(): void {
    this.markerGraphics.clear();
    this.lineGraphics.clear();
    this.gridGraphics.clear();
    this.labelTexts.forEach((t) => t.destroy());
    this.labelTexts = [];

    if (this.pointCountLabel) {
      this.pointCountLabel.textContent = `Points: ${this.points.length}`;
    }

    if (this.showGrid) {
      this.drawGrid();
    }

    if (this.points.length > 1) {
      this.lineGraphics.lineStyle(2, 0x00ffff, 0.8);
      this.lineGraphics.beginPath();
      this.lineGraphics.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < this.points.length; i++) {
        this.lineGraphics.lineTo(this.points[i].x, this.points[i].y);
      }
      this.lineGraphics.strokePath();
    }

    this.points.forEach((p, i) => {
      const isStart = i === 0;
      const isEnd = i === this.points.length - 1 && this.points.length > 1;
      const color = isStart ? 0x00ff00 : isEnd ? 0xff0000 : 0xffff00;

      this.markerGraphics.fillStyle(color, 1);
      this.markerGraphics.fillCircle(p.x, p.y, this.markerRadius);
      this.markerGraphics.lineStyle(2, 0x000000, 1);
      this.markerGraphics.strokeCircle(p.x, p.y, this.markerRadius);

      const label = this.add
        .text(p.x + this.markerRadius + 4, p.y - this.markerRadius - 4, `${i}`, {
          fontSize: '13px',
          color: '#ffffff',
          backgroundColor: '#000000aa',
          padding: { x: 3, y: 1 },
        })
        .setDepth(999);
      this.labelTexts.push(label);
    });
  }

  private drawGrid(): void {
    const spacing = 50;
    this.gridGraphics.lineStyle(1, 0xffffff, 0.15);
    for (let x = 0; x < this.bg.width; x += spacing) {
      this.gridGraphics.lineBetween(x, 0, x, this.bg.height);
    }
    for (let y = 0; y < this.bg.height; y += spacing) {
      this.gridGraphics.lineBetween(0, y, this.bg.width, y);
    }
  }

  private exportPoints(): void {
    if (this.points.length === 0) {
      // eslint-disable-next-line no-alert
      window.alert('No points to export yet.');
      return;
    }

    const payload = {
      stage: STAGE_IMAGE_KEY,
      sourceImage: STAGE_IMAGE_PATH,
      imageWidth: this.bg.width,
      imageHeight: this.bg.height,
      pointCount: this.points.length,
      points: this.points,
    };

    const json = JSON.stringify(payload, null, 2);
    // eslint-disable-next-line no-console
    console.log('=== PATH POINTS EXPORT ===');
    // eslint-disable-next-line no-console
    console.log(json);

    let downloadWorked = true;
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = EXPORT_FILENAME;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      downloadWorked = false;
    }

    this.showExportPanel(json, downloadWorked);
  }
}