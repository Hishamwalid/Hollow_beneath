import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import type { BoardNode, FactionState } from '@data/types';
import { CHECKPOINTS, LANDMARK_INDICES, CAPTURE_INDICES } from '@systems/BoardGenerator';
import { ALLY_DEFS } from '@systems/ally/AllyDefs';
import { freshAllyState, bindRegion } from '@systems/ally/AllyTracking';
import { shardsForAllyVictory } from '@systems/ally/AllyRewards';
import { FIRST_NODE_TOOLTIPS } from '@data/tutorialText';
import { rollDie, rollMovement } from '@systems/checks';
import { TOTAL_NODES, CHAPTERS, NODES_PER_CHAPTER, GAME_WIDTH, GAME_HEIGHT } from '@/config';
import { pickEvent } from '@systems/EventEngine';
import { resolveTrap } from '@systems/EventEngine';
import { TRAPS } from '@data/events';
import { sanitizeFightEnemies } from '@data/enemies';
import { MINOR_LANDMARKS } from '@data/minorLandmarks';
import { DISCOVERABLE_SKILLS, NAMED_SKILLS } from '@data/skills';
import { shardsForNodeVisit, applyShardBonus } from '@systems/EchoShardSystem';
import { maybePickWhisper } from '@systems/WhisperSystem';
import { createDiceRoller } from '@ui/DiceRoller';
import { createNodePreview } from '@ui/NodePreview';
import { createPlayerPanel } from '@ui/PlayerPanel';
import { createFactionPanel } from '@ui/FactionPanel';
import { createActionGrid } from '@ui/ActionGrid';
import { createButton } from '@ui/Button';
import { showWhisper, applyResonanceTint } from '@ui/WhisperOverlay';
import { addResonanceEffects } from '@systems/ResonanceFX';
import { FONT_BODY, FONT_SERIF, FONT_MONO, PALETTE_HEX } from '@ui/uiTheme';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { audio } from '@placeholder/PlaceholderAudio';
import { influenceStatus } from '@data/factions';
import { STAGE1_NODES } from '@data/paths/stage1Nodes';
import stage1AdjustData from '@data/paths/stage1_adjust.json';

// ---- Chapter structure -----------------------------------------------------------------
// The descent is 5 chapters of 40 nodes each; every chapter is its own full map screen.
const CHAPTER_NAMES: Record<number, string> = {
  1: 'The Archive Opens',
  2: 'The Sable March',
  3: 'The Singing Deep',
  4: 'The Reach of Dust',
  5: 'The Final Descent',
};

const NODES_PER_MAP = NODES_PER_CHAPTER;
const MAP_COUNT = CHAPTERS;

function chapterForNode(index: number): number {
  return index <= 0 ? 1 : Math.min(MAP_COUNT, Math.ceil(index / NODES_PER_MAP));
}

function mapKeyForChapter(chapter: number): string {
  return `map_${Math.min(MAP_COUNT, Math.max(1, chapter))}`;
}

// ---- Board panel frame (left side) ----
const BOARD_X = 24;
const BOARD_Y = 24;
const TITLE_H = 64;
const MAP_SIZE = 688;
const BOARD_W = MAP_SIZE;
const BOARD_H = MAP_SIZE + TITLE_H;
const MAP_AREA_X = BOARD_X;
const MAP_AREA_Y = BOARD_Y + TITLE_H;
const MAP_AREA_W = MAP_SIZE;
const MAP_AREA_H = MAP_SIZE;

/** Cover-fit scale for a map texture inside the square map area, read from the real texture size. */
function mapCoverScale(scene: Phaser.Scene, mapKey: string): number {
  const src = scene.textures.get(mapKey).getSourceImage();
  const w = (src as { width?: number }).width ?? MAP_SIZE;
  const h = (src as { height?: number }).height ?? MAP_SIZE;
  return Math.max(MAP_SIZE / w, MAP_SIZE / h);
}

// ---- The circular path that rings the cave mouth at the board's centre ----
const RING_CX = MAP_AREA_X + MAP_AREA_W / 2;
const RING_CY = MAP_AREA_Y + MAP_AREA_H / 2;
const RING_RX = 300;
const RING_RY = 270;
const RING_GAP_DEG = 46; // gap in the ring, centred at the bottom, where the path enters/exits
const RING_START_DEG = 90 + RING_GAP_DEG / 2;
const RING_END_DEG = RING_START_DEG + (360 - RING_GAP_DEG);

// ---- Right-hand HUD columns ----
const COL_GAP = 16;
const COL2_X = BOARD_X + BOARD_W + COL_GAP;
const COL_W = 256;
const COL3_X = COL2_X + COL_W + COL_GAP;

const DICE_PANEL_Y = 24;
const DICE_PANEL_H = 196;
const TILE_PANEL_Y = DICE_PANEL_Y + DICE_PANEL_H + COL_GAP;
const TILE_PANEL_H = 180;
const FACTION_PANEL_Y = TILE_PANEL_Y + TILE_PANEL_H + COL_GAP;
const FACTION_PANEL_H = 44 + 4 * 30;
const LOG_PANEL_Y = FACTION_PANEL_Y + FACTION_PANEL_H + COL_GAP;
const LOG_PANEL_H = BOARD_Y + BOARD_H - LOG_PANEL_Y;

const PLAYER_PANEL_Y = 24;
const PLAYER_PANEL_H = 390;
const ACTIONGRID_Y = PLAYER_PANEL_Y + PLAYER_PANEL_H + COL_GAP;

const AMBUSH_CHANCE = 0.30;
const REST_DISRUPT_CHANCE = 0.20;
const AMBUSH_TABLE: Record<string, string[]> = {
  sable: ['sable_zealot', 'sable_zealot'],
  archive: ['venn_custodian', 'archive_cipher_wraith'],
  covenant: ['ash_seer', 'ash_seer'],
  caravan: ['dust_road_raider', 'dust_wight'],
};

function isAnyFactionHostile(faction: FactionState): boolean {
  return Object.values(faction).some((v) => influenceStatus(v) === 'Hostile');
}

function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** A point on the ring path, `relIndex` of `ringCount` evenly spaced around the sweep. */
function ringPoint(relIndex: number, ringCount: number): { x: number; y: number } {
  const t = ringCount <= 1 ? 0 : relIndex / (ringCount - 1);
  const angle = degToRad(Phaser.Math.Linear(RING_START_DEG, RING_END_DEG, t));
  return { x: RING_CX + RING_RX * Math.cos(angle), y: RING_CY + RING_RY * Math.sin(angle) };
}

function caveCenter(): { x: number; y: number } {
  return { x: RING_CX, y: RING_CY };
}

/** Just off the ring, near its start — where the player stands before the run's first roll. */
function entrancePoint(): { x: number; y: number } {
  const angle = degToRad(RING_START_DEG - 16);
  return { x: RING_CX + RING_RX * 1.12 * Math.cos(angle), y: RING_CY + RING_RY * 1.12 * Math.sin(angle) };
}

/** The last node of each chapter is its landmark boss. */
function chapterLandmarkIndex(chapter: number): number | null {
  const idx = chapter * NODES_PER_CHAPTER;
  return LANDMARK_INDICES.includes(idx) ? idx : null;
}

// ---- Stage path placement -------------------------------------------------
// STAGE1_NODES were clicked over stage1_background.png in a 1920x1080 frame.
// Fit that path's own bounding box into the board map area (with padding) so
// the nodes land exactly where they were drawn, without cramping.
const STAGE_PADDING = 40;
const STAGE_Y_SHIFT = 10;

const STAGE_BOUNDS = (() => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of STAGE1_NODES) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, spanX: Math.max(1, maxX - minX), spanY: Math.max(1, maxY - minY) };
})();

function stageMapTransform(): { scale: number; ox: number; oy: number; w: number; h: number } {
  const availW = MAP_AREA_W - STAGE_PADDING * 2;
  const availH = MAP_AREA_H - STAGE_PADDING * 2;
  const scale = Math.min(availW / STAGE_BOUNDS.spanX, availH / STAGE_BOUNDS.spanY);
  const fw = STAGE_BOUNDS.spanX * scale;
  const fh = STAGE_BOUNDS.spanY * scale;
  const ox = MAP_AREA_X + (MAP_AREA_W - fw) / 2;
  const oy = MAP_AREA_Y + (MAP_AREA_H - fh) / 2;
  return { scale, ox, oy, w: fw, h: fh };
}

/** Maps a stage-path point (in the 1920x1080 frame) to canvas coordinates. */
function pathToCanvas(px: number, py: number): { x: number; y: number } {
  const t = stageMapTransform();
  const nx = (px - STAGE_BOUNDS.minX) / STAGE_BOUNDS.spanX;
  const ny = (py - STAGE_BOUNDS.minY) / STAGE_BOUNDS.spanY;
  return { x: t.ox + nx * t.w, y: t.oy + ny * t.h + STAGE_Y_SHIFT };
}

function isStagePathChapter(chapter: number): boolean {
  return chapter === 1 && STAGE1_NODES.length > 0;
}

// ---- Stage path manual adjustments ----------------------------------------
// Optional per-node fine-tuning, loaded from stage1_adjust.json. Offsets are in
// the 1920x1080 source frame; they scale by `stageMapTransform().scale` to
// canvas pixels. Enabled only when the URL has ?editpath=1.
interface StageAdjust {
  dx: number;
  dy: number;
}

const STAGE_ADJUSTMENTS: Record<number, StageAdjust> = {};

function loadStageAdjustments() {
  for (const k in STAGE_ADJUSTMENTS) delete STAGE_ADJUSTMENTS[k];
  const raw = (stage1AdjustData as { adjustments?: Array<{ index: number; dx: number; dy: number }> }).adjustments;
  if (!raw) return;
  for (const a of raw) {
    if (a && typeof a.index === 'number' && Number.isFinite(a.dx) && Number.isFinite(a.dy)) {
      STAGE_ADJUSTMENTS[a.index] = { dx: a.dx, dy: a.dy };
    }
  }
}

const EDIT_PATH_ENABLED =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('editpath');

/** Landmark nodes sit at the cave mouth in the centre; every other node sits on the ring around it. */
function positionForNode(node: BoardNode): { x: number; y: number } {
  if (node.index >= 1 && node.index <= STAGE1_NODES.length) {
    const p = STAGE1_NODES[node.index - 1];
    if (p) {
      const base = pathToCanvas(p.x, p.y);
      const adj = STAGE_ADJUSTMENTS[node.index];
      if (adj) return { x: base.x + adj.dx * stageMapTransform().scale, y: base.y + adj.dy * stageMapTransform().scale };
      return base;
    }
  }
  const landmarkIdx = chapterLandmarkIndex(chapterForNode(node.index));
  if (node.type === 'landmark' || node.index === landmarkIdx) return caveCenter();
  const relIndex = (node.index - 1) % NODES_PER_CHAPTER;
  const ringCount = landmarkIdx ? NODES_PER_CHAPTER - 1 : NODES_PER_CHAPTER;
  return ringPoint(relIndex, ringCount);
}

export class BoardScene extends Phaser.Scene {
  private playerToken?: Phaser.GameObjects.Image;
  private rollBtn?: ReturnType<typeof createButton>;
  private logText?: Phaser.GameObjects.Text;
  private logBg?: Phaser.GameObjects.Rectangle;
  private playerPanel?: ReturnType<typeof createPlayerPanel>;
  private factionPanel?: ReturnType<typeof createFactionPanel>;
  private actionGrid?: ReturnType<typeof createActionGrid>;
  private preview?: ReturnType<typeof createNodePreview>;
  private diceRoller?: ReturnType<typeof createDiceRoller>;
  private titleText?: Phaser.GameObjects.Text;
  private titleSub?: Phaser.GameObjects.Text;
  private boardNodeLayer?: Phaser.GameObjects.Container;
  private mapImage?: Phaser.GameObjects.Image;
  private boardMask?: Phaser.Display.Masks.GeometryMask;
  private ghostToken?: Phaser.GameObjects.Image;
  private busy = false;
  private firstNodeTooltips: Record<string, boolean> = {};

  constructor() {
    super('Board');
  }

  create() {
    this.busy = false;
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const { player, game } = useGameStore.getState();
    if (!player || !game) {
      fadeToScene(this, 'Menu');
      return;
    }

    loadStageAdjustments();
    if (EDIT_PATH_ENABLED) {
      this.setupPathEditOverlay();
      this.input.on('drag', (_p: unknown, gameObject: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
        const img = gameObject as Phaser.GameObjects.Image;
        const idx = Number(img.getData('nodeIndex'));
        if (!Number.isInteger(idx) || idx < 1 || idx > STAGE1_NODES.length) return;
        img.x = dragX;
        img.y = dragY;
        for (const key of ['ring', 'glow', 'cpRing']) {
          const sibling = img.getData(key) as Phaser.GameObjects.Arc | undefined;
          if (sibling) {
            sibling.x = dragX;
            sibling.y = dragY;
          }
        }
        const label = img.getData('numLabel') as Phaser.GameObjects.Text | undefined;
        const labelOffset = img.getData('labelOffset') as { x: number; y: number } | undefined;
        if (label && labelOffset) {
          label.x = dragX + labelOffset.x;
          label.y = dragY + labelOffset.y;
        }
        const base = img.getData('baseCanvas') as { x: number; y: number };
        const scale = stageMapTransform().scale;
        STAGE_ADJUSTMENTS[idx] = {
          dx: (img.x - base.x) / scale,
          dy: (img.y - base.y) / scale,
        };
        const p = STAGE1_NODES[idx - 1];
        if (p) this.redrawToken(idx);
        const node = useGameStore.getState().game?.nodes[idx - 1];
        if (node) this.preview?.show(node);
      });
    }

    this.buildBoardFrame();

    const maskShape = this.make.graphics({});
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(MAP_AREA_X, MAP_AREA_Y, MAP_AREA_W, MAP_AREA_H);
    this.boardMask = maskShape.createGeometryMask();

    this.mapImage = this.add.image(MAP_AREA_X + MAP_AREA_W / 2, MAP_AREA_Y + MAP_AREA_H / 2, mapKeyForChapter(chapterForNode(game.currentNodeIndex)))
      .setOrigin(0.5)
      .setScale(mapCoverScale(this, mapKeyForChapter(chapterForNode(game.currentNodeIndex))))
      .setDepth(0)
      .setMask(this.boardMask);
    this.boardNodeLayer = this.add.container(0, 0).setDepth(1);
    this.drawBoard(game.nodes);
    this.playerToken = this.add.image(0, 0, 'player_pin').setScale(0.24).setOrigin(0.5, 1).setDepth(20);
    this.placeTokenAt(game.currentNodeIndex);

    addResonanceEffects(this, player.resonance, GAME_WIDTH, GAME_HEIGHT);

    this.playerPanel = createPlayerPanel(this, COL3_X, PLAYER_PANEL_Y, COL_W, PLAYER_PANEL_H);
    this.playerPanel.update(player);

    this.actionGrid = createActionGrid(this, COL3_X, ACTIONGRID_Y, [
      { icon: 'icon_character', label: 'Character', onClick: () => fadeToScene(this, 'Inventory') },
      { icon: 'icon_codex', label: 'Codex', onClick: () => fadeToScene(this, 'LoreCodex') },
      {
        icon: 'icon_skills', label: 'Loadout', onClick: () => fadeToScene(this, 'Loadout'),
        badge: () => null,
      },
      { icon: 'icon_shop', label: 'Shop', onClick: () => fadeToScene(this, 'ShardShop') },
      { icon: 'icon_menu', label: 'Menu', onClick: () => fadeToScene(this, 'Menu') },
      { icon: 'icon_settings', label: 'Settings', onClick: () => fadeToScene(this, 'Settings') },
    ], COL_W);

    this.add.rectangle(COL2_X + COL_W / 2, DICE_PANEL_Y + DICE_PANEL_H / 2, COL_W, DICE_PANEL_H, 0x16191d, 0.94)
      .setStrokeStyle(1, 0xc9a24b, 0.6);
    this.diceRoller = createDiceRoller(this, COL2_X + COL_W / 2, DICE_PANEL_Y + 70);
    this.diceRoller.container.setDepth(6);
    this.rollBtn = createButton(this, COL2_X + COL_W / 2, DICE_PANEL_Y + DICE_PANEL_H - 30, 'Roll (1d6)', () => this.handleRoll(), { width: COL_W - 24, height: 44, fontSize: '16px', depth: 6 });

    this.add.rectangle(COL2_X + COL_W / 2, TILE_PANEL_Y + TILE_PANEL_H / 2, COL_W, TILE_PANEL_H, 0x16191d, 0.94)
      .setStrokeStyle(1, 0xc9a24b, 0.6);
    this.preview = createNodePreview(this, COL2_X + COL_W / 2, TILE_PANEL_Y + 84, COL_W);
    this.preview.container.setDepth(6);
    this.preview.show(game.nodes[Math.max(0, game.currentNodeIndex - 1)]);

    this.factionPanel = createFactionPanel(this, COL2_X, FACTION_PANEL_Y, COL_W);
    this.factionPanel.update(player.faction);

    this.logBg = this.add.rectangle(COL2_X + COL_W / 2, LOG_PANEL_Y + LOG_PANEL_H / 2, COL_W, LOG_PANEL_H, 0x16191d, 0.9)
      .setStrokeStyle(1, 0xc9a24b, 0.5);
    const startChapter = chapterForNode(Math.max(1, game.currentNodeIndex));
    this.logText = this.add.text(COL2_X + 14, LOG_PANEL_Y + 14, this.chapterFlavor(startChapter), {
      fontFamily: FONT_BODY,
      fontSize: '14px',
      color: PALETTE_HEX.boneMuted,
      wordWrap: { width: COL_W - 28 },
    }).setDepth(6);

    this.updateBoardTitle(startChapter);

    if (game.currentNodeIndex >= TOTAL_NODES) {
      this.rollBtn.setEnabled(false);
    }

    if (game.pendingNodeIndex != null && game.pendingNodeIndex > game.currentNodeIndex) {
      const target = game.pendingNodeIndex;
      useGameStore.setState({ game: { ...game, pendingNodeIndex: null } });
      this.log('The ambush dealt with, you continue forward.');
      this.moveTo(target);
    }
  }

  private buildBoardFrame() {
    this.add.rectangle(BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2, BOARD_W, BOARD_H, 0x000000, 0)
      .setStrokeStyle(2, 0xc9a24b, 0.85).setDepth(30);
    this.add.rectangle(BOARD_X + BOARD_W / 2, BOARD_Y + TITLE_H / 2, BOARD_W, TITLE_H, 0x0e1013, 0.92).setDepth(4);
    this.add.rectangle(BOARD_X + BOARD_W / 2, BOARD_Y + TITLE_H, BOARD_W - 4, 2, 0xc9a24b, 0.6).setDepth(4);
    this.titleText = this.add.text(BOARD_X + 20, BOARD_Y + 12, '', {
      fontFamily: FONT_SERIF, fontSize: '26px', color: PALETTE_HEX.gold,
    }).setDepth(5);
    this.titleSub = this.add.text(BOARD_X + BOARD_W - 20, BOARD_Y + 22, '', {
      fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(1, 0).setDepth(5);
  }

  private updateBoardTitle(chapter: number) {
    this.titleText?.setText(CHAPTER_NAMES[chapter] ?? 'The Threshold');
    this.titleSub?.setText(`Chapter ${chapter} / ${CHAPTERS}`);
  }

  private chapterFlavor(chapter: number): string {
    if (chapter <= 0) return 'The stair down is behind you now. Ahead: five chapters of a descent that was never meant to be survived.';
    return `Chapter ${chapter} / ${CHAPTERS} — ${CHAPTER_NAMES[chapter]}`;
  }

  private drawRingPath() {
    if (!this.boardNodeLayer) return;
    const g = this.add.graphics();

    const chapter = chapterForNode(useGameStore.getState().game?.currentNodeIndex ?? 1);
    if (isStagePathChapter(chapter) && STAGE1_NODES.length > 1) {
      g.lineStyle(5, 0x8f6a27, 0.7);
      const base = { index: 1, chapter: 1, type: 'event', subtype: '', resolved: false } as BoardNode;
      const p0 = positionForNode({ ...base, index: 1 });
      g.lineBetween(p0.x, p0.y, p0.x, p0.y);
      for (let i = 2; i <= STAGE1_NODES.length; i++) {
        const p1 = positionForNode({ ...base, index: i });
        const p2 = positionForNode({ ...base, index: i - 1 });
        g.lineBetween(p2.x, p2.y, p1.x, p1.y);
      }
      this.boardNodeLayer.add(g);
      return;
    }

    g.lineStyle(3, 0xc9a24b, 0.35);
    const steps = 120;
    for (let i = 0; i < steps; i++) {
      if (i % 4 >= 2) continue; // dashed
      const a0 = degToRad(Phaser.Math.Linear(RING_START_DEG, RING_END_DEG, i / steps));
      const a1 = degToRad(Phaser.Math.Linear(RING_START_DEG, RING_END_DEG, (i + 1) / steps));
      const p0 = { x: RING_CX + RING_RX * Math.cos(a0), y: RING_CY + RING_RY * Math.sin(a0) };
      const p1 = { x: RING_CX + RING_RX * Math.cos(a1), y: RING_CY + RING_RY * Math.sin(a1) };
      g.lineBetween(p0.x, p0.y, p1.x, p1.y);
    }
    this.boardNodeLayer.add(g);
  }

  private drawBoard(nodes: BoardNode[]) {
    if (!this.boardNodeLayer) return;
    this.boardNodeLayer.removeAll(true);

    this.drawRingPath();

    const cave = caveCenter();
    const store = useGameStore.getState();
    const currentIdx = Math.max(1, store.game?.currentNodeIndex ?? 1);
    const chapter = chapterForNode(currentIdx);
    const isStagePath = isStagePathChapter(chapter);

    // Every chapter renders as its own full map — show all 40 of its nodes.
    const renderNodes = isStagePath
      ? nodes.filter((n) => n.index >= 1 && n.index <= STAGE1_NODES.length)
      : nodes.filter((n) => n.chapter === chapter);

    const hasCaveNode = renderNodes.some((n) => n.type === 'landmark');
    if (!isStagePath) {
      const caveGlyph = this.add.image(cave.x, cave.y, 'node_landmark').setDisplaySize(hasCaveNode ? 40 : 26, hasCaveNode ? 40 : 26);
      caveGlyph.setAlpha(hasCaveNode ? 0.95 : 0.22);
      if (!hasCaveNode) caveGlyph.setTint(0x000000);
      this.boardNodeLayer.add(caveGlyph);
    }

    for (const node of renderNodes) {
      if (node.type === 'landmark' && isStagePath) {
        const { x, y } = positionForNode(node);
        const ring = this.add.circle(x, y, 14, 0x000000, 0.35).setStrokeStyle(2, 0xc9a24b, 0.9);
        const icon = this.add.image(x, y, 'node_landmark').setDisplaySize(26, 26);
        icon.setName(`node_${node.index}`).setData('resolved', node.resolved);
        if (EDIT_PATH_ENABLED) {
          icon.setData('baseCanvas', pathToCanvas(STAGE1_NODES[node.index - 1].x, STAGE1_NODES[node.index - 1].y));
          icon.setData('nodeIndex', node.index);
          icon.setData('ring', ring);
          const label = this.add.text(x + 16, y - 22, String(node.index), {
            fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.gold,
            backgroundColor: '#0d0f13', padding: { x: 4, y: 2 },
          }).setStroke('#c9a24b', 1).setDepth(10);
          icon.setData('numLabel', label);
          icon.setData('labelOffset', { x: 16, y: -22 });
          this.boardNodeLayer.add(label);
          icon.setInteractive({ useHandCursor: true, draggable: true });
          this.input.setDraggable(icon);
        }
        this.boardNodeLayer.add(ring);
        this.boardNodeLayer.add(icon);
        continue;
      }
      if (node.type === 'landmark') continue; // already represented by caveGlyph above
      const { x, y } = positionForNode(node);
      const isCurrent = store.game?.currentNodeIndex === node.index;
      const size = isStagePath ? 18 : 24;
      const ring = this.add.circle(x, y, size / 2 + 4, 0x000000, 0.35).setStrokeStyle(1, 0x000000, 0.45);
      const icon = this.add.image(x, y, `node_${node.type}`).setDisplaySize(size, size);
      icon.setName(`node_${node.index}`).setData('resolved', node.resolved);
      icon.setAlpha(node.resolved ? 0.55 : 1);
      if (EDIT_PATH_ENABLED && isStagePath && node.index >= 1 && node.index <= STAGE1_NODES.length) {
        icon.setData('baseCanvas', pathToCanvas(STAGE1_NODES[node.index - 1].x, STAGE1_NODES[node.index - 1].y));
        icon.setData('nodeIndex', node.index);
        icon.setData('ring', ring);
        const label = this.add.text(x + 12, y - 18, String(node.index), {
          fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.gold,
          backgroundColor: '#0d0f13', padding: { x: 4, y: 2 },
        }).setStroke('#c9a24b', 1).setDepth(10);
        icon.setData('numLabel', label);
        icon.setData('labelOffset', { x: 12, y: -18 });
        this.boardNodeLayer.add(label);
        icon.setInteractive({ useHandCursor: true, draggable: true });
        this.input.setDraggable(icon);
      }
      this.boardNodeLayer.add(ring);
      this.boardNodeLayer.add(icon);
      if (isCurrent) {
        const glow = this.add.circle(x, y, size / 2 + 10, 0x000000, 0).setStrokeStyle(2, 0xe9c876, 0.95);
        this.boardNodeLayer.add(glow);
        if (EDIT_PATH_ENABLED && isStagePath) icon.setData('glow', glow);
      }
      if (CHECKPOINTS.includes(node.index)) {
        const cpRing = this.add.circle(x, y, size / 2 + 6, 0x000000, 0).setStrokeStyle(2, 0xc9a24b, 0.8);
        this.boardNodeLayer.add(cpRing);
        if (EDIT_PATH_ENABLED && isStagePath) icon.setData('cpRing', cpRing);
      }
    }

    if (this.ghostToken) { this.ghostToken.destroy(); this.ghostToken = undefined; }
    if (store.game?.deathNodeIndex != null) {
      const deathNode = store.game.nodes[store.game.deathNodeIndex - 1];
      const pos = deathNode ? positionForNode(deathNode) : cave;
      this.ghostToken = this.add.image(pos.x, pos.y - 24, 'tok_player').setDisplaySize(30, 30).setAlpha(0.35).setTint(0x666666).setDepth(19);
    }
  }

  // ---- Path edit tool (dev, ?editpath=1) --------------------------------
  private pathEditRoot: HTMLElement | null = null;

  private setupPathEditOverlay() {
    this.destroyPathEditOverlay();
    const root = document.createElement('div');
    root.style.cssText = `
      position: fixed; top: 10px; left: 10px; z-index: 10000;
      display: flex; gap: 6px; align-items: center;
      background: rgba(0,0,0,0.78); padding: 8px; border-radius: 6px;
      font-family: sans-serif;
    `;
    const label = document.createElement('span');
    label.style.cssText = 'color:#0ff; font-size:13px; padding:0 8px;';
    label.textContent = 'Drag nodes to adjust';
    const make = (t: string, bg: string, fn: () => void) => {
      const b = document.createElement('button');
      b.textContent = t;
      b.style.cssText = `padding:6px 10px; font-size:13px; cursor:pointer; background:${bg}; color:#fff; border:1px solid #666; border-radius:4px;`;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    const saveBtn = make('Save JSON', '#2a6b2a', () => this.savePathAdjustments());
    const resetBtn = make('Reset', '#663333', () => { this.clearPathAdjustments(); this.redrawBoard(); });
    const doneBtn = make('Done', '#333', () => {
      this.destroyPathEditOverlay();
      const url = new URL(window.location.href);
      url.searchParams.delete('editpath');
      window.history.replaceState({}, '', url.toString());
      this.scene.restart();
    });
    root.appendChild(label);
    root.appendChild(saveBtn);
    root.appendChild(resetBtn);
    root.appendChild(doneBtn);
    document.body.appendChild(root);
    this.pathEditRoot = root;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyPathEditOverlay());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroyPathEditOverlay());
  }

  private destroyPathEditOverlay() {
    this.pathEditRoot?.remove();
    this.pathEditRoot = null;
  }

  private savePathAdjustments() {
    const scale = stageMapTransform().scale;
    const entries: Array<{ index: number; dx: number; dy: number }> = [];
    for (const key of Object.keys(STAGE_ADJUSTMENTS)) {
      const a = STAGE_ADJUSTMENTS[Number(key)];
      if (!a || (Math.abs(a.dx) < 0.001 && Math.abs(a.dy) < 0.001)) continue;
      entries.push({ index: Number(key), dx: Math.round(a.dx * 10) / 10, dy: Math.round(a.dy * 10) / 10 });
    }
    const payload = { stage: 'stage1-bg', adjustments: entries };
    const json = JSON.stringify(payload, null, 2);
    // eslint-disable-next-line no-console
    console.log('=== STAGE PATH ADJUSTMENTS ===', json);
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stage1_adjust.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* fallback to console copy */ }
  }

  private clearPathAdjustments() {
    for (const key of Object.keys(STAGE_ADJUSTMENTS)) delete STAGE_ADJUSTMENTS[Number(key)];
    this.redrawBoard();
    this.preview?.show(useGameStore.getState().game?.nodes[Math.max(0, (useGameStore.getState().game?.currentNodeIndex ?? 1) - 1)] ?? { index: 1, chapter: 1, type: 'event', subtype: '', resolved: false });
  }

  private redrawBoard() {
    const { game } = useGameStore.getState();
    if (game) this.drawBoard(game.nodes);
  }

  private redrawToken(index: number) {
    const current = useGameStore.getState().game?.currentNodeIndex;
    if (current === index) this.placeTokenAt(current);
  }

  private placeTokenAt(index: number) {
    if (!this.playerToken) return;
    if (index <= 0) {
      const pos = isStagePathChapter(chapterForNode(1)) && STAGE1_NODES[0]
        ? positionForNode({ index: 1, chapter: 1, type: 'event', subtype: '', resolved: false })
        : entrancePoint();
      this.playerToken.setPosition(pos.x, pos.y);
      return;
    }
    const { game } = useGameStore.getState();
    const node = game?.nodes[index - 1];
    const pos = node ? positionForNode(node) : caveCenter();
    this.playerToken.setPosition(pos.x, pos.y);
  }

  private log(msg: string) {
    this.logText?.setText(msg);
    this.logBg?.setAlpha(0.9);
  }

  private handleRoll() {
    if (this.busy) return;
    const { player, game } = useGameStore.getState();
    if (!player || !game) return;
    this.busy = true;
    this.rollBtn?.setEnabled(false);
    audio.diceRoll();

    const roll = rollMovement(Math.random);
    let target = Math.min(TOTAL_NODES, game.currentNodeIndex + roll);
    for (let i = game.currentNodeIndex + 1; i <= target; i++) {
      if (LANDMARK_INDICES.includes(i) && !game.nodes[i - 1].resolved) {
        target = i;
        break;
      }
      if (CAPTURE_INDICES.includes(i) && !game.nodes[i - 1].resolved) {
        target = i;
        break;
      }
    }

    this.diceRoller?.roll(roll, () => {
      try {
        if (this.tryAmbush(target)) return;
        this.moveTo(target);
      } catch (e) {
        console.error('Roll handler failed', e);
        this.busy = false;
        this.rollBtn?.setEnabled(true);
      }
    });
  }

  private tryAmbush(target: number): boolean {
    const { player, game } = useGameStore.getState();
    if (!player || !game) return false;
    if (!isAnyFactionHostile(player.faction)) return false;
    if (Math.random() >= AMBUSH_CHANCE) return false;

    const hostileKey = (Object.keys(player.faction) as (keyof FactionState)[]).find(
      (k) => influenceStatus(player.faction[k]) === 'Hostile',
    );
    const chapter = chapterForNode(Math.max(1, game.currentNodeIndex));
    const enemies = sanitizeFightEnemies(
      hostileKey && AMBUSH_TABLE[hostileKey] ? AMBUSH_TABLE[hostileKey] : ['sable_zealot', 'sable_zealot'],
      chapter,
      player.resonance,
    );
    useGameStore.setState({ game: { ...game, pendingNodeIndex: target } });

    const factionNames: Record<string, string> = { sable: 'Sable', archive: 'Archive', covenant: 'Covenant', caravan: 'Caravan' };
    const factionLabel = hostileKey ? (factionNames[hostileKey] ?? hostileKey) : 'unknown';
    this.log(`The ${factionLabel} ambushes you! +${enemies.length} enemies.`);
    this.time.delayedCall(600, () => {
      fadeToScene(this, 'Combat', { mode: 'wild', enemyIds: enemies, nodeIndex: target });
    });
    return true;
  }

  private moveTo(target: number) {
    const { player, game } = useGameStore.getState();
    if (!player || !game) return;

    const node = game.nodes[target - 1];
    const dest = node ? positionForNode(node) : caveCenter();
    audio.moveStep();
    if (this.playerToken) {
      this.tweens.add({
        targets: this.playerToken, x: dest.x, y: dest.y, duration: 260, ease: 'Sine.easeInOut',
        onComplete: () => this.finishMove(target),
      });
    } else {
      this.finishMove(target);
    }
  }

  private showChapterCard(chapter: number, node: BoardNode) {
    const num = chapter;
    const name = CHAPTER_NAMES[chapter] ?? 'The Descent Continues';
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const depth = 200;

    const container = this.add.container(0, 0).setDepth(depth);
    const bg = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85).setDepth(depth).setAlpha(0);
    container.add(bg);

    const chapterText = this.add.text(cx, cy - 30, `CHAPTER ${num}`, {
      fontFamily: FONT_SERIF, fontSize: '30px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0);
    container.add(chapterText);

    const nameText = this.add.text(cx, cy + 24, name, {
      fontFamily: FONT_BODY, fontSize: '20px', color: PALETTE_HEX.bone, fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0);
    container.add(nameText);

    const elements = [bg, chapterText, nameText];
    this.tweens.add({
      targets: elements,
      alpha: { from: 0, to: 1 },
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(2500, () => {
          this.tweens.add({
            targets: elements,
            alpha: 0,
            duration: 400,
            ease: 'Sine.easeIn',
            onComplete: () => {
              container.destroy();
              this.log(this.chapterFlavor(chapter));
              this.resolveNode(node);
            },
          });
        });
      },
    });
  }

  private finishMove(target: number) {
    const store = useGameStore.getState();
    const { player, game } = store;
    if (!player || !game) return;

    const nextChapter = chapterForNode(target);
    const prevChapter = chapterForNode(game.currentNodeIndex);
    player.echoShards += applyShardBonus(player, shardsForNodeVisit());
    const updatedNodes = game.nodes.map((n) => ({ ...n }));
    const node = updatedNodes[target - 1];

    useGameStore.setState({
      game: { ...game, currentNodeIndex: target, path: [...game.path, target], landings: game.landings + 1, nodes: updatedNodes, deathNodeIndex: null },
    });

    // Chapter loadout unlocks (revamp): crossing into a new chapter grants its skills.
    if (nextChapter > prevChapter) {
      const learned = useGameStore.getState().grantChapterSkills(nextChapter);
      if (learned.length > 0) {
        const names = learned.map((id) => NAMED_SKILLS[id]?.name ?? id).join(', ');
        this.log(`New techniques surface in your memory: ${names}.`);
        audio.levelUp();
      }
    }

    this.drawBoard(updatedNodes);
    this.playerPanel?.update(player);
    this.factionPanel?.update(player.faction);
    this.actionGrid?.refresh();
    this.preview?.show(node);
    this.updateBoardTitle(nextChapter);

    const showChapterOrResolve = () => {
      if (nextChapter !== prevChapter) {
        this.showChapterCard(nextChapter, node);
      } else {
        this.log(this.chapterFlavor(nextChapter));
        this.resolveNode(node);
      }
    };

    if (nextChapter !== prevChapter) {
      this.flipToChapter(nextChapter, showChapterOrResolve);
    } else {
      showChapterOrResolve();
    }
    this.applyFactionGearBonus(player);
  }

  /** Turns the current map away like a page to reveal the next chapter's map, then resolves the landing. */
  private flipToChapter(chapter: number, onComplete: () => void) {
    const oldMap = this.mapImage;
    if (!oldMap) {
      onComplete();
      return;
    }

    const newMap = this.add.image(MAP_AREA_X + MAP_AREA_W / 2, MAP_AREA_Y + MAP_AREA_H / 2, mapKeyForChapter(chapter))
      .setOrigin(0.5)
      .setScale(mapCoverScale(this, mapKeyForChapter(chapter)))
      .setDepth(0)
      .setMask(this.boardMask!);
    this.mapImage = newMap;

    const turningMap = this.add.image(MAP_AREA_X, MAP_AREA_Y + MAP_AREA_H / 2, oldMap.texture.key)
      .setOrigin(0, 0.5)
      .setScale(mapCoverScale(this, oldMap.texture.key))
      .setDepth(2)
      .setMask(this.boardMask!);
    audio.pageTurn();

    this.tweens.add({
      targets: turningMap,
      scaleX: 0,
      ease: 'Sine.easeInOut',
      duration: 700,
      onComplete: () => {
        turningMap.destroy();
        oldMap.destroy();
        onComplete();
      },
    });
  }

  private resolveNode(node: BoardNode) {
    const store = useGameStore.getState();
    const { player, game } = store;
    if (!player || !game) return;

    if (player.totalRuns === 0 && game.currentNodeIndex <= NODES_PER_CHAPTER && !this.firstNodeTooltips[node.type]) {
      this.firstNodeTooltips[node.type] = true;
      const tip = FIRST_NODE_TOOLTIPS[node.type];
      if (tip) this.preview?.setTip(tip);
    }

    if (node.type === 'landmark') {
      fadeToScene(this, 'Landmark', { bossId: node.subtype });
      return;
    }
    if (node.type === 'combat') {
      fadeToScene(this, 'Combat', { mode: 'wild', enemyIds: [node.subtype], nodeIndex: node.index });
      return;
    }
    if (node.type === 'event') {
      const seen = new Set(player.history.filter((h) => h.startsWith('event_seen:')).map((h) => h.slice('event_seen:'.length)));
      const event = pickEvent(player, node.chapter, player.resonance, seen, Math.random, player.flags);
      fadeToScene(this, 'Event', { eventDef: event });
      return;
    }
    if (node.type === 'trap') {
      const trapDef = TRAPS[node.subtype];
      if (!trapDef) {
        this.log('The trap mechanism is rusted and non-functional.');
        this.markResolved(node);
        this.afterInlineResolution();
        return;
      }
      const result = resolveTrap(trapDef, player, Math.random);
      audio.hit();
      this.log(result.text);
      this.markResolved(node);
      this.afterInlineResolution();
      return;
    }
    if (node.type === 'rest') {
      this.resolveRest(player);
      this.markResolved(node);
      this.afterInlineResolution();
      return;
    }
    if (node.type === 'discovery') {
      if (node.subtype.startsWith('ally:')) {
        this.resolveAllyNode(player, node);
        this.markResolved(node);
        this.afterInlineResolution();
        return;
      }
      if (node.subtype === 'capture_point' && MINOR_LANDMARKS[node.index]) {
        this.markResolved(node);
        fadeToScene(this, 'Event', { eventDef: MINOR_LANDMARKS[node.index] });
        return;
      }
      this.resolveDiscovery(player, node);
      this.markResolved(node);
      this.afterInlineResolution();
      return;
    }
    this.afterInlineResolution();
  }

  private resolveRest(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>) {
    if (player.flags.skip_next_rest) {
      delete player.flags.skip_next_rest;
      this.log('You look for somewhere to rest. The floor here remembers your last fall, and offers nothing.');
      return;
    }
    let disrupted = false;
    if (isAnyFactionHostile(player.faction) && Math.random() < REST_DISRUPT_CHANCE) {
      disrupted = true;
    }
    let healPct = player.flags.next_rest_double ? 50 : 25;
    if (player.flags.next_rest_double) delete player.flags.next_rest_double;
    if (player.skillsKnown.includes('deep_breath')) healPct += 10;
    if (disrupted) healPct = Math.round(healPct * 0.5);
    const heal = Math.round(player.derived.maxHP * (healPct / 100));
    player.currentHP = Math.min(player.derived.maxHP, player.currentHP + heal);
    const mpRestore = disrupted ? Math.round(player.derived.maxMP * 0.15) : Math.round(player.derived.maxMP * 0.3);
    player.currentMP = Math.min(player.derived.maxMP, player.currentMP + mpRestore);
    player.resonance = Math.max(0, player.resonance - 1);
    audio.heal();
    if (disrupted) {
      this.log(`You wake to the sound of blades being drawn. Not enough rest. +${heal} HP, +${mpRestore} MP (-1 Resonance).`);
    } else {
      this.log(`You rest a while. +${heal} HP, +${mpRestore} MP (-1 Resonance).`);
    }
  }

  /** Phase 5: a companion found in the world chooses to walk with you. */
  private resolveAllyNode(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>, node: BoardNode) {
    const allyId = node.subtype.replace('ally:', '') as keyof typeof ALLY_DEFS;
    const def = ALLY_DEFS[allyId];
    if (!def) {
      this.log('Someone was here once, and left only a shape in the dust.');
      return;
    }
    const existing = player.companions.find((c) => c.id === allyId);
    if (existing) {
      const shards = shardsForAllyVictory(existing.loyalty);
      player.echoShards += applyShardBonus(player, shards);
      this.log(`${def.name} finds you again — you are already companions. +${shards} Echo Shards.`);
      return;
    }
    const state = freshAllyState(allyId);
    const homeRegion = { warden_emissary: 'dominion', covenant_courier: 'covenant_deep', sable_zealot: 'sable_edge', archive_cartographer: 'keth_vor' }[allyId] as 'keth_vor' | 'dominion' | 'sable_edge' | 'covenant_deep';
    // A companion that chooses to walk with you starts at the nominal accompany threshold (15)
    // and is formally bound to its home region for loyalty growth. (bindRegion returns a new
    // state, so we capture it rather than discarding the +5 loyalty bump.)
    const bound = bindRegion({ ...state, loyalty: 15 }, homeRegion);
    player.companions.push(bound);
    player.echoShards += applyShardBonus(player, shardsForAllyVictory(5));
    const s = useGameStore.getState();
    s.addXp(8);
    this.log(`${def.name} steps out of the hollow and chooses to walk with you. It is bound to ${homeRegion}.`);
    this.preview?.setTip(`${def.name} joins you — it will fight beside you.`);
  }

  private resolveDiscovery(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>, node: BoardNode) {
    // Capture points are handled separately in resolveNode (routed to a minor-landmark vignette).
    const LORE_POOL = [
      'the_hundredth_page', 'a_pressed_flower_that_isnt', 'the_counting_room', 'names_carved_then_scratched_out',
      'the_weight_of_unread_mail', 'a_childs_height_marks', 'the_last_entry', 'the_recipe_that_isnt_food',
      'the_map_that_updates_itself', 'the_second_moon_that_isnt_there', 'the_apology_never_sent',
      'the_borrowed_hour', 'sera_voss_ledger_entry',
    ].filter((id) => !player.loreFragments.includes(id));
    const RELIC_POOL = ['sable_ash_blade', 'archive_field_coat', 'raiders_charm', 'dominion_boundary_seal', 'auctioneers_token', 'pressed_page'];
    const SUPPLY_POOL = ['ration', 'bandage', 'waterskin', 'traveler_salve'];
    const unknownSkills = DISCOVERABLE_SKILLS.filter((id) => !player.skillsKnown.includes(id));

    type Template = { id: string; weight: number };
    const templates: Template[] = [
      { id: 'gold_cache', weight: 4 },
      { id: 'lost_supplies', weight: 2 },
      { id: 'forgotten_relic', weight: 2 },
      { id: 'lore_cache', weight: LORE_POOL.length > 0 ? 2 : 0 },
      { id: 'training_notes', weight: unknownSkills.length > 0 ? 2 : 0 },
      { id: 'hidden_stash', weight: 1 },
      { id: 'quiet_moment', weight: 1 },
      { id: 'echo_residue', weight: 1 },
      { id: 'old_marker', weight: 1 },
      { id: 'small_cache_faction', weight: 1 },
      { id: 'nothing_here', weight: 1 },
    ].filter((t) => t.weight > 0);

    const totalWeight = templates.reduce((s, t) => s + t.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosen = templates[0].id;
    for (const t of templates) {
      if (roll < t.weight) { chosen = t.id; break; }
      roll -= t.weight;
    }

    const xpStore = useGameStore.getState();
    switch (chosen) {
      case 'lost_supplies': {
        const gold = 3 + rollDie(6, Math.random);
        const itemId = SUPPLY_POOL[Math.floor(Math.random() * SUPPLY_POOL.length)];
        player.gold += gold;
        player.inventory.push({ id: itemId, qty: 1 });
        xpStore.addXp(8);
        this.log(`Supplies, left behind in a hurry. +${gold} gold, an item, +8 XP.`);
        break;
      }
      case 'forgotten_relic': {
        const pool = player.resonance >= 50 ? [...RELIC_POOL, 'unread_echo'] : RELIC_POOL;
        const gold = 3 + rollDie(6, Math.random);
        const itemId = pool[Math.floor(Math.random() * pool.length)];
        player.gold += gold;
        player.inventory.push({ id: itemId, qty: 1 });
        xpStore.addXp(10);
        this.log(`Something worth carrying, worked in by someone who isn't here anymore. +${gold} gold, an item, +10 XP.`);
        break;
      }
      case 'lore_cache': {
        const gold = 3 + rollDie(6, Math.random);
        const id = LORE_POOL[Math.floor(Math.random() * LORE_POOL.length)];
        player.gold += gold;
        if (!player.loreFragments.includes(id)) {
          player.loreFragments.push(id);
          player.echoShards += applyShardBonus(player, 1);
        }
        xpStore.addXp(8);
        this.log(`Something written, worth reading twice. +${gold} gold, a lore fragment, +8 XP.`);
        break;
      }
      case 'training_notes': {
        const skillId = unknownSkills[Math.floor(Math.random() * unknownSkills.length)];
        player.skillsKnown.push(skillId);
        xpStore.addXp(12);
        this.log(`Training notes, thorough and half-legible. You learn something from them. +12 XP.`);
        break;
      }
      case 'hidden_stash': {
        const gold = 10 + rollDie(15, Math.random);
        player.gold += gold;
        xpStore.addXp(10);
        this.log(`A stash, properly hidden this time. +${gold} gold, +10 XP.`);
        break;
      }
      case 'quiet_moment': {
        const gold = 3 + rollDie(6, Math.random);
        player.gold += gold;
        player.resonance = Math.max(0, player.resonance - 1);
        xpStore.addXp(3);
        this.log(`A moment of quiet that costs nothing to take. +${gold} gold, -1 Resonance, +3 XP.`);
        break;
      }
      case 'echo_residue': {
        const gold = 3 + rollDie(6, Math.random);
        player.gold += gold;
        player.echoShards += applyShardBonus(player, 1);
        xpStore.addXp(6);
        this.log(`A trace of something spent. +${gold} gold, +1 Echo Shard, +6 XP.`);
        break;
      }
      case 'old_marker': {
        const gold = 3 + rollDie(6, Math.random);
        player.gold += gold;
        const w = maybePickWhisper(player.resonance, 'movement', Math.random, 1);
        if (w) showWhisper(this, GAME_WIDTH / 2, 178, w.text, 460);
        xpStore.addXp(4);
        this.log(`An old marker, half-erased. +${gold} gold, +4 XP.`);
        break;
      }
      case 'small_cache_faction': {
        const gold = 3 + rollDie(6, Math.random);
        player.gold += gold;
        const leading = (Object.keys(player.faction) as (keyof typeof player.faction)[]).reduce((a, b) =>
          player.faction[a] >= player.faction[b] ? a : b
        );
        player.faction[leading] += 1;
        xpStore.addXp(5);
        this.log(`Something that confirms a path you're already on. +${gold} gold, +1 ${leading}, +5 XP.`);
        break;
      }
      case 'nothing_here': {
        const gold = 1 + rollDie(4, Math.random);
        player.gold += gold;
        xpStore.addXp(2);
        this.log(`Nothing here worth the detour, in the end. +${gold} gold, +2 XP.`);
        break;
      }
      default: {
        const gold = 5 + rollDie(10, Math.random);
        player.gold += gold;
        xpStore.addXp(5);
        this.log(`You find something left behind by whoever came through last. +${gold} gold, +5 XP.`);
      }
    }
    audio.shardGain();
  }

  private applyFactionGearBonus(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>) {
    const FACTION_GEAR: Record<string, keyof typeof player.faction> = {
      sable_ash_blade: 'sable',
      archive_field_coat: 'archive',
      travelers_ledger: 'caravan',
      muted_stone: 'covenant',
    };
    const equipped = [player.equipment.weapon, player.equipment.armour, player.equipment.accessory, player.equipment.focus].filter((id): id is string => !!id);
    for (const gearId of equipped) {
      const faction = FACTION_GEAR[gearId];
      if (faction) player.faction[faction] += 1;
    }
  }

  private markResolved(node: BoardNode) {
    node.resolved = true;
  }

  private afterInlineResolution() {
    const store = useGameStore.getState();
    const { player, game } = store;
    if (!player || !game) return;
    store.persist();
    if (CHECKPOINTS.includes(game.currentNodeIndex)) {
      audio.checkpoint();
      const tx = this.add.text(GAME_WIDTH / 2, 300, '✦ Checkpoint Reached — Progress Saved ✦', {
        fontFamily: FONT_MONO, fontSize: '16px', color: '#c9a24b',
      }).setOrigin(0.5).setDepth(100).setAlpha(1);
      this.tweens.add({
        targets: tx, alpha: 0, y: 280, duration: 3000, ease: 'Power2', onComplete: () => tx.destroy(),
      });
    }
    this.playerPanel?.update(player);
    this.factionPanel?.update(player.faction);
    this.actionGrid?.refresh();

    if (player.currentHP <= 0) {
      this.handleDeathFlow();
      return;
    }

    const whisper = maybePickWhisper(player.resonance, 'movement', Math.random);
    if (whisper) showWhisper(this, GAME_WIDTH / 2, 178, whisper.text, 460);

    this.busy = false;
    if (game.currentNodeIndex < TOTAL_NODES) this.rollBtn?.setEnabled(true);
  }

  private handleDeathFlow() {
    const store = useGameStore.getState();
    const { game } = store;
    const hadCheckpoint = !!game?.checkpointSnapshot && (game?.checkpointNodeIndex ?? 0) > 0;
    if (!hadCheckpoint) {
      store.handleDeath();
      fadeToScene(this, 'GameOver');
      return;
    }

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const d = 200;

    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85).setDepth(d).setInteractive();
    this.add.text(cx, cy - 90, 'You fell. But the Loom remembers.', {
      fontFamily: FONT_SERIF, fontSize: '30px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5).setDepth(d);

    this.add.text(cx, cy - 40, `Fallen in Chapter ${chapterForNode(Math.max(1, game.currentNodeIndex))}.`, {
      fontFamily: FONT_BODY, fontSize: '20px', color: PALETTE_HEX.bone,
    }).setOrigin(0.5).setDepth(d);

    this.add.text(cx, cy - 8, `Return to checkpoint at node ${game.checkpointNodeIndex}.`, {
      fontFamily: FONT_BODY, fontSize: '17px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(0.5).setDepth(d);

    this.add.text(cx, cy + 24, 'HP and MP restored to 50%.', {
      fontFamily: FONT_MONO, fontSize: '16px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5).setDepth(d);

    createButton(this, cx - 110, cy + 84, 'Continue', () => {
      store.handleDeath();
      fadeToScene(this, 'Board');
    }, { width: 200, height: 46, fontSize: '17px' }).container.setDepth(d);

    createButton(this, cx + 110, cy + 84, 'Return to Menu', () => {
      const { meta } = useGameStore.getState();
      const newMeta = { ...meta, deathCount: meta.deathCount + 1 };
      useGameStore.setState({ meta: newMeta, player: null, game: null });
      audio.click();
      fadeToScene(this, 'Menu');
    }, { width: 200, height: 46, fontSize: '17px' }).container.setDepth(d);
  }
}
