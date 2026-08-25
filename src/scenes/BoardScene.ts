import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import type { BoardNode, FactionState } from '@data/types';
import { CHECKPOINTS, LANDMARK_INDICES, CAPTURE_INDICES } from '@systems/BoardGenerator';
import { PINNED_STORY_EVENTS, STORY_EVENTS, STORY_BEAT_REMINDERS } from '@data/storyEvents';
import { FIRST_NODE_TOOLTIPS } from '@data/tutorialText';
import { rollDie, rollMovement } from '@systems/checks';
import { mulberry32 } from '@systems/rng';
import { TOTAL_NODES, CHAPTERS, NODES_PER_CHAPTER, GAME_WIDTH, GAME_HEIGHT } from '@/config';
import { pickEvent } from '@systems/EventEngine';
import { resolveTrap } from '@systems/EventEngine';
import { TRAPS } from '@data/events';
import { sanitizeFightEnemies } from '@data/enemies';
import { MINOR_LANDMARKS } from '@data/minorLandmarks';
import { DISCOVERABLE_SKILLS, NAMED_SKILLS } from '@data/skills';
import { shardsForNodeVisit, applyShardBonus } from '@systems/EchoShardSystem';
import { maybePickWhisper } from '@systems/WhisperSystem';
import { maybeVoiceLine } from '@systems/VoiceSystem';
import { pulseOnce, shake, floatDelta, reducedMotion } from '@systems/motion';
import { spawnHitParticles } from '@systems/particles';
import { takeBoardFx } from '@systems/fxDelta';
import { createDiceRoller } from '@ui/DiceRoller';
import { createNodePreview } from '@ui/NodePreview';
import { createPlayerPanel } from '@ui/PlayerPanel';
import { createFactionPanel } from '@ui/FactionPanel';
import { createPanel } from '@ui/Panel';
import { createCoachTip } from '@ui/CoachTip';
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

/** The dramatic question each chapter asks — surfaced on transitions + title. */
const CHAPTER_QUESTIONS: Record<number, string> = {
  1: 'What spoke to them — and why am I not afraid?',
  2: 'Who else has heard it?',
  3: 'What did the Venn know?',
  4: 'What did she find?',
  5: 'What is waiting, wearing my face?',
};

const NODES_PER_MAP = NODES_PER_CHAPTER;
const MAP_COUNT = CHAPTERS;

function chapterForNode(index: number): number {
  return index <= 0 ? 1 : Math.min(MAP_COUNT, Math.ceil(index / NODES_PER_MAP));
}

function mapKeyForChapter(chapter: number): string {
  return `map_${Math.min(MAP_COUNT, Math.max(1, chapter))}`;
}

/**
 * Deterministic per-roll stream derived from the run seed + landing count:
 * same save replayed identically; dice no longer bypass the seeded rng.
 */
function runRng(game: { rngSeed: number; landings: number }): () => number {
  return mulberry32((game.rngSeed ^ Math.imul(game.landings + 1, 0x9e3779b1)) >>> 0);
}

/** Guarantees a texture exists for `key`, generating a dark stone plate if art is missing. */
function ensureMapTexture(scene: Phaser.Scene, key: string): string {
  if (scene.textures.exists(key)) return key;
  console.warn(`[Board] map texture '${key}' missing — using fallback plate`);
  const g = scene.make.graphics({});
  g.fillStyle(0x101216, 1);
  g.fillRect(0, 0, 512, 512);
  g.lineStyle(2, 0xc9a24b, 0.22);
  g.strokeCircle(256, 256, 210);
  g.lineStyle(1, 0xc9a24b, 0.12);
  g.strokeCircle(256, 256, 150);
  g.generateTexture(key, 512, 512);
  g.destroy();
  return key;
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
const TILE_PANEL_H = 200;
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

const PINNED_STORY_NODES = new Set(Object.keys(PINNED_STORY_EVENTS).map(Number));

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
  private logLines: Phaser.GameObjects.Text[] = [];
  private chapterPips: Phaser.GameObjects.Rectangle[] = [];
  private playerPanel?: ReturnType<typeof createPlayerPanel>;
  private factionPanel?: ReturnType<typeof createFactionPanel>;
  private lastBeatChip?: Phaser.GameObjects.Text;
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
  private ritesOpen = false;
  private coachBusyUntil = 0;

  /** One-time-per-save contextual hint. Queues so tips never overlap. */
  private showCoach(flagKey: string, text: string, x: number, y: number): void {
    const player = useGameStore.getState().player;
    if (!player || player.flags[flagKey]) return;
    player.flags[flagKey] = true;
    useGameStore.getState().persist();
    const startAt = Math.max(this.game.getTime(), this.coachBusyUntil + 260);
    this.coachBusyUntil = startAt + 6000;
    this.time.delayedCall(Math.max(0, startAt - this.game.getTime()), () => {
      createCoachTip(this, x, y, text);
    });
  }

  constructor() {
    super('Board');
  }

  create() {
    this.busy = false;
    this.cameras.main.setBackgroundColor(0x0b0d10);
    audio.startAmbience('descent');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.stopAmbience());
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

    const chapterNum = chapterForNode(game.currentNodeIndex);
    const mapKey = ensureMapTexture(this, mapKeyForChapter(chapterNum));
    this.mapImage = this.add.image(MAP_AREA_X + MAP_AREA_W / 2, MAP_AREA_Y + MAP_AREA_H / 2, mapKey)
      .setOrigin(0.5)
      .setScale(mapCoverScale(this, mapKey))
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
      { icon: 'icon_codex', label: 'Codex', onClick: () => fadeToScene(this, 'LoreCodex', { returnTo: 'Board' }) },
      { icon: 'icon_skills', label: 'Loadout', onClick: () => fadeToScene(this, 'Loadout'),
        badge: () => null,
      },
      { icon: 'icon_shard', label: 'Rites', onClick: () => this.openShardRites() },
      { icon: 'icon_menu', label: 'Menu', onClick: () => fadeToScene(this, 'Menu') },
      { icon: 'icon_settings', label: 'Settings', onClick: () => fadeToScene(this, 'Settings') },
    ], COL_W);

    const dicePanel = createPanel(this, { x: COL2_X + COL_W / 2, y: DICE_PANEL_Y + DICE_PANEL_H / 2, width: COL_W, height: DICE_PANEL_H, variant: 'stone', title: 'The Walk', depth: 1 });
    void dicePanel;
    this.diceRoller = createDiceRoller(this, COL2_X + COL_W / 2, DICE_PANEL_Y + 70);
    this.diceRoller.container.setDepth(6);
    this.rollBtn = createButton(this, COL2_X + COL_W / 2, DICE_PANEL_Y + DICE_PANEL_H - 30, 'Roll (1d6)', () => this.handleRoll(), { width: COL_W - 24, height: 44, fontSize: '16px', depth: 6 });

    // Space/Enter rolls — the board's one verb deserves the keyboard too.
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.busy || !this.rollBtn?.isEnabled()) return;
      this.handleRoll();
    });
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.busy || !this.rollBtn?.isEnabled()) return;
      this.handleRoll();
    });

    // Fresh descent: walk into the first chamber so the prologue always plays
    // before any roll. Roll unlocks once it resolves (board re-loads at node 1).
    if (game.currentNodeIndex < 1 && game.nodes[0]) {
      this.rollBtn.setEnabled(false);
      this.busy = true;
      this.time.delayedCall(700, () => {
        this.busy = false;
        this.moveTo(1);
      });
    }

    // First-descent coach: right after the prologue, teach the only verb.
    if (game.currentNodeIndex >= 1 && game.currentNodeIndex <= NODES_PER_CHAPTER) {
      this.showCoach('hint_roll', 'Roll the die — you will walk that many nodes.', COL2_X + COL_W / 2, DICE_PANEL_Y + DICE_PANEL_H + 18);
    }

    const aheadPanel = createPanel(this, { x: COL2_X + COL_W / 2, y: TILE_PANEL_Y + TILE_PANEL_H / 2, width: COL_W, height: TILE_PANEL_H, variant: 'stone', title: 'Ahead', depth: 1 });
    void aheadPanel;
    this.preview = createNodePreview(this, COL2_X + COL_W / 2, TILE_PANEL_Y + 104, COL_W);
    this.preview.container.setDepth(6);
    this.refreshAheadPreview();

    this.factionPanel = createFactionPanel(this, COL2_X, FACTION_PANEL_Y, COL_W);
    this.factionPanel.update(player.faction);
    this.flushPendingFx();

    const journal = createPanel(this, { x: COL2_X + COL_W / 2, y: LOG_PANEL_Y + LOG_PANEL_H / 2, width: COL_W, height: LOG_PANEL_H, variant: 'stone', title: 'Journal', depth: 1 });
    void journal;
    this.logLines = [];
    const startChapter = chapterForNode(Math.max(1, game.currentNodeIndex));
    this.pushLog(startChapter, game.currentNodeIndex, this.chapterFlavor(startChapter));
    this.updateLastBeatChip(player);

    this.updateBoardTitle(startChapter);
    this.spawnMapDust();

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
    this.titleText = this.add.text(BOARD_X + 20, BOARD_Y + 8, '', {
      fontFamily: FONT_SERIF, fontSize: '24px', color: PALETTE_HEX.gold,
    }).setDepth(5);
    this.titleSub = this.add.text(BOARD_X + 22, BOARD_Y + 40, '', {
      fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted,
    }).setDepth(5);
    if (typeof this.titleSub.setLetterSpacing === 'function') this.titleSub.setLetterSpacing(2);
  }

  private updateBoardTitle(chapter: number) {
    this.titleText?.setText(CHAPTER_NAMES[chapter] ?? 'The Threshold');
    this.titleSub?.setText(`Chapter ${chapter} / ${CHAPTERS}  ·  ${CHAPTER_QUESTIONS[chapter] ?? ''}`);

    // Chapter progress pips — five diamonds along the title bar's right edge.
    if (this.chapterPips.length === 0) {
      for (let i = 0; i < CHAPTERS; i++) {
        const pip = this.add.rectangle(0, BOARD_Y + TITLE_H / 2, 12, 12).setAngle(45).setDepth(5);
        this.chapterPips.push(pip);
      }
      const totalW = (CHAPTERS - 1) * 22;
      this.chapterPips.forEach((pip, i) => pip.setX(BOARD_X + BOARD_W - 26 - (totalW) + i * 22));
    }
    this.chapterPips.forEach((pip, i) => {
      const done = i + 1 < chapter;
      const here = i + 1 === chapter;
      if (here) pip.setFillStyle(0xe9c876, 1).setStrokeStyle(2, 0xc9a24b, 1);
      else if (done) pip.setFillStyle(0xc9a24b, 0.8).setStrokeStyle(1, 0xc9a24b, 1);
      else pip.setFillStyle(0x22262c, 1).setStrokeStyle(1, 0x9a9488, 0.6);
    });
  }

  private chapterFlavor(chapter: number): string {
    if (chapter <= 0) return 'Keth-7 dig site, morning. The wind smells like stone and waiting.';
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

      // Ambient node tells: unresolved story beats breathe gold; traps smolder.
      if (!node.resolved && !isCurrent) {
        if (node.subtype.startsWith('story:')) {
          const halo = this.add.circle(x, y, size / 2 + 4, 0x000000, 0).setStrokeStyle(2, 0xe9c876, 0.5);
          this.boardNodeLayer.add(halo);
          this.tweens.add({ targets: halo, alpha: { from: 0.25, to: 0.95 }, scale: { from: 1, to: 1.14 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } else if (node.type === 'trap') {
          const ember = this.add.circle(x, y, size / 2 + 3, 0xb0453f, 0.16);
          this.boardNodeLayer.add(ember);
          this.tweens.add({ targets: ember, alpha: { from: 0.08, to: 0.34 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
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
    const { game } = useGameStore.getState();
    this.pushLog(chapterForNode(Math.max(1, game?.currentNodeIndex ?? 1)), Math.max(1, game?.currentNodeIndex ?? 1), msg);
  }

  /** Journal feed — newest entry on top with a node marker; older lines glide down. */
  private pushLog(_chapter: number, nodeIndex: number, msg: string) {
    const entry = `N${nodeIndex} · ${msg}`;
    // Move existing lines down (animated).
    for (let i = this.logLines.length - 1; i >= 0; i--) {
      const line = this.logLines[i];
      const slot = i + 1;
      if (slot >= 3) { line.destroy(); continue; }
      this.tweens.add({ targets: line, y: line.y + (LOG_PANEL_H - 28) / 3, alpha: slot === 2 ? 0.65 : 0.4, duration: 180, ease: 'Sine.easeOut' });
    }
    const line = this.add.text(COL2_X + 14, LOG_PANEL_Y + 26, entry, {
      fontFamily: FONT_BODY,
      fontSize: '13px',
      color: PALETTE_HEX.bone,
      wordWrap: { width: COL_W - 28 },
    }).setDepth(6).setAlpha(0);
    this.tweens.add({ targets: line, alpha: 1, x: { from: COL2_X - 8 }, duration: 200, ease: 'Sine.easeOut' });
    this.logLines.unshift(line);
    if (this.logLines.length > 3) {
      const dropped = this.logLines.pop();
      dropped?.destroy();
    }
  }

  /**
   * Persistent context anchor under the Journal title: the most recent story
   * beat and its signature line, so the thread survives long node stretches.
   */
  private updateLastBeatChip(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>): void {
    let lastId: string | null = null;
    for (let i = player.history.length - 1; i >= 0; i--) {
      const h = player.history[i];
      if (!h.startsWith('event_seen:')) continue;
      const id = h.slice('event_seen:'.length);
      if (STORY_EVENTS[id]) { lastId = id; break; }
    }
    if (this.lastBeatChip) { this.lastBeatChip.destroy(); this.lastBeatChip = undefined; }
    if (!lastId) return;
    const title = STORY_EVENTS[lastId].title;
    const line = STORY_BEAT_REMINDERS[lastId] ?? '';
    this.lastBeatChip = this.add.text(COL2_X + 14, LOG_PANEL_Y + 10, `✦ ${title} — ${line}`, {
      fontFamily: FONT_BODY,
      fontSize: '11px',
      color: PALETTE_HEX.gold,
      fontStyle: 'italic',
      wordWrap: { width: COL_W - 28 },
    }).setDepth(6).setAlpha(0.9);
  }

  private handleRoll() {
    if (this.busy) return;
    const { player, game } = useGameStore.getState();
    if (!player || !game) return;
    this.busy = true;
    this.rollBtn?.setEnabled(false);
    audio.diceRoll();

    const rng = runRng(game);
    const roll = rollMovement(rng);
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
      // Pinned story beats halt movement too — crossing or landing plays them.
      if (PINNED_STORY_NODES.has(i) && !game.nodes[i - 1].resolved) {
        target = i;
        break;
      }
    }

    this.diceRoller?.roll(roll, () => {
      // Result slam: gold ring + micro-shake sell the throw before the walk.
      pulseOnce(this, COL2_X + COL_W / 2, DICE_PANEL_Y + 70, 46, 0xe9c876, { depth: 50, duration: 320 });
      shake(this, 0.0025, 90);
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
    if (runRng(game)() >= AMBUSH_CHANCE) return false;

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

  /** Gentle camera lean that keeps the walking token in frame without
   *  ever revealing the void beyond the layout. */
  private followTokenWalk(x: number, y: number): void {
    if (reducedMotion()) return;
    const cam = this.cameras.main;
    const z = 1.04;
    const halfW = GAME_WIDTH / (2 * z);
    const halfH = GAME_HEIGHT / (2 * z);
    const tx = Phaser.Math.Clamp(x, halfW, GAME_WIDTH - halfW);
    const ty = Phaser.Math.Clamp(y, halfH, GAME_HEIGHT - halfH);
    this.tweens.add({ targets: cam, scrollToX: tx - halfW, scrollToY: ty - halfH, zoom: z, duration: 180, ease: 'Sine.easeOut' });
  }

  private releaseTokenWalk(): void {
    if (reducedMotion()) return;
    const cam = this.cameras.main;
    this.tweens.add({ targets: cam, scrollToX: 0, scrollToY: 0, zoom: 1, duration: 320, ease: 'Sine.easeOut' });
  }

  private moveTo(target: number) {
    const { player, game } = useGameStore.getState();
    if (!player || !game) return;

    const nodes = game.nodes;
    const startIdx = Math.max(game.currentNodeIndex, 0);
    // One step per crossed node — the pin follows the drawn path, not a chord.
    const steps: Array<{ x: number; y: number }> = [];
    for (let i = startIdx + 1; i <= target; i++) {
      const n = nodes[i - 1];
      steps.push(n ? positionForNode(n) : caveCenter());
    }
    if (steps.length === 0 || !this.playerToken) {
      this.finishMove(target);
      return;
    }

    audio.moveStep();
    const token = this.playerToken;
    const baseScale = 0.24;
    // Landmark/capture/story blockers get a slow, weighted final approach.
    const dest = nodes[target - 1];
    const anticipates = !!dest && !dest.resolved
      && (LANDMARK_INDICES.includes(target) || CAPTURE_INDICES.includes(target) || PINNED_STORY_NODES.has(target));

    const walkHop = (i: number, fromX: number, fromY: number) => {
      if (!token.active) return; // scene died mid-walk
      const isFinal = i === steps.length - 1;
      const to = steps[i];
      const dist = Phaser.Math.Distance.Between(fromX, fromY, to.x, to.y);
      let dur = reducedMotion() ? 70 : Phaser.Math.Clamp(dist * 0.55, 110, 190);
      if (isFinal && anticipates && !reducedMotion()) dur *= 1.9;
      const arc = Phaser.Math.Clamp(dist * 0.09, 5, 12);
      const proxy = { t: 0 };
      this.followTokenWalk(to.x, to.y);
      this.tweens.add({
        targets: proxy,
        t: 1,
        duration: dur,
        ease: 'Sine.easeInOut',
        delay: isFinal && anticipates ? 200 : 0,
        onUpdate: () => {
          const t = proxy.t;
          token.x = Phaser.Math.Linear(fromX, to.x, t);
          const hop = reducedMotion() ? 0 : Math.sin(t * Math.PI);
          token.y = Phaser.Math.Linear(fromY, to.y, t) - hop * arc;
          const squash = 1 + hop * 0.16 - Math.max(0, t - 0.92) * 1.2;
          token.setScale(baseScale * squash, baseScale * (2 - squash));
        },
        onComplete: () => {
          token.setScale(baseScale);
          spawnHitParticles(this, to.x, to.y + 6, 0x9a9488);
          if (i < steps.length - 1) {
            walkHop(i + 1, to.x, to.y);
          } else {
            this.releaseTokenWalk();
            this.finishMove(target);
          }
        },
      });
    };
    walkHop(0, token.x, token.y);
  }

  /** "Ahead" card: previews the immediate next node plus everything a roll of
   *  1–6 could reach (movement blockers included), so rolling is a decision. */
  private refreshAheadPreview() {
    const { game } = useGameStore.getState();
    if (!game || !this.preview) return;
    if (game.currentNodeIndex >= TOTAL_NODES) {
      this.preview.container.setVisible(false);
      return;
    }
    const nextIdx = Math.min(TOTAL_NODES, game.currentNodeIndex + 1);
    this.preview.show(game.nodes[nextIdx - 1]);
    const counts: Partial<Record<BoardNode['type'], number>> = {};
    for (let i = game.currentNodeIndex + 1; i <= Math.min(TOTAL_NODES, game.currentNodeIndex + 6); i++) {
      const n = game.nodes[i - 1];
      if (!n || n.resolved) continue;
      counts[n.type] = (counts[n.type] ?? 0) + 1;
      // Movement halts at the first unresolved blocker — nothing beyond is reachable.
      if ((LANDMARK_INDICES.includes(i) || CAPTURE_INDICES.includes(i) || PINNED_STORY_NODES.has(i)) && !n.resolved) break;
    }
    const order: BoardNode['type'][] = ['landmark', 'combat', 'trap', 'event', 'rest', 'discovery'];
    const label: Record<string, string> = { landmark: 'Boss', combat: 'Combat', trap: 'Trap', event: 'Choice', rest: 'Rest', discovery: 'Find' };
    const parts = order.filter((t) => counts[t]).map((t) => (counts[t]! > 1 ? `${label[t]}×${counts[t]}` : label[t]));
    this.preview.setTip(parts.length ? `Within a roll of 6: ${parts.join(' · ')}` : '');
  }

  private showChapterCard(chapter: number, node: BoardNode) {
    const num = chapter;
    const name = CHAPTER_NAMES[chapter] ?? 'The Descent Continues';
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const depth = 200;

    // The map pushes toward you as the chapter announces itself.
    if (!reducedMotion()) {
      this.tweens.add({ targets: this.cameras.main, zoom: { from: 1, to: 1.045 }, duration: 520, yoyo: true, ease: 'Sine.easeInOut' });
    }

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

    const questionText = this.add.text(cx, cy + 62, CHAPTER_QUESTIONS[chapter] ?? '', {
      fontFamily: FONT_SERIF, fontSize: '17px', color: PALETTE_HEX.gold, fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0);
    container.add(questionText);

    const elements = [bg, chapterText, nameText, questionText];
    // Click / Space / Enter skips the hold — the descent never stalls on a card.
    let done = false;
    const conclude = () => {
      if (done || !container.active) return;
      done = true;
      this.input.removeListener('pointerdown', skipCard);
      this.input.keyboard?.removeListener('keydown-SPACE', skipCard);
      this.input.keyboard?.removeListener('keydown-ENTER', skipCard);
      this.tweens.killTweensOf(elements);
      this.tweens.add({
        targets: elements,
        alpha: 0,
        duration: reducedMotion() ? 90 : 260,
        ease: 'Sine.easeIn',
        onComplete: () => {
          container.destroy();
          this.log(this.chapterFlavor(chapter));
          this.resolveNode(node);
        },
      });
    };
    const skipCard = () => conclude();
    this.tweens.add({
      targets: elements,
      alpha: { from: 0, to: 1 },
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(1600, conclude);
      },
    });
    this.input.on('pointerdown', skipCard);
    this.input.keyboard?.on('keydown-SPACE', skipCard);
    this.input.keyboard?.on('keydown-ENTER', skipCard);
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

    this.playerPanel?.update(player);
    this.factionPanel?.update(player.faction);
    this.actionGrid?.refresh();

    const showChapterOrResolve = () => {
      if (nextChapter !== prevChapter) {
        this.showChapterCard(nextChapter, node);
      } else {
        this.log(this.chapterFlavor(nextChapter));
        this.resolveNode(node);
      }
    };

    if (nextChapter !== prevChapter) {
      // The old chapter keeps its map AND its nodes until the page finishes
      // turning — the new node layer lands with the new map, never before.
      this.flipToChapter(nextChapter, () => {
        this.drawBoard(updatedNodes);
        this.placeTokenAt(target);
        this.refreshAheadPreview();
        this.updateBoardTitle(nextChapter);
        showChapterOrResolve();
      });
    } else {
      this.drawBoard(updatedNodes);
      this.refreshAheadPreview();
      this.updateBoardTitle(nextChapter);
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

    const newMap = this.add.image(MAP_AREA_X + MAP_AREA_W / 2, MAP_AREA_Y + MAP_AREA_H / 2, ensureMapTexture(this, mapKeyForChapter(chapter)))
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
      // Pinned story beats take absolute precedence over the event pool.
      // They resolve exactly once — marked resolved as they begin.
      if (node.subtype.startsWith('story:')) {
        const storyId = node.subtype.slice('story:'.length);
        const storyEvent = STORY_EVENTS[storyId];
        if (storyEvent) {
          this.markResolved(node);
          fadeToScene(this, 'Event', { eventDef: storyEvent });
          return;
        }
      }
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
    const statusOf = (k: keyof typeof player.faction) => influenceStatus(player.faction[k]);
    const hostileKey = (Object.keys(player.faction) as (keyof typeof player.faction)[])
      .find((k) => influenceStatus(player.faction[k]) === 'Hostile');
    let disrupted = !!hostileKey && Math.random() < REST_DISRUPT_CHANCE;
    // Devoted Sable hunters announce themselves and stand down.
    if (disrupted && statusOf('sable') === 'Devoted') {
      disrupted = false;
      this.log('Boots circle your fire once — Sable hunters. They mark the ash on your gear, bow, and melt back into the dark.');
    }
    let healPct = player.flags.next_rest_double ? 50 : 25;
    if (player.flags.next_rest_double) delete player.flags.next_rest_double;
    if (player.skillsKnown.includes('deep_breath')) healPct += 10;
    if (disrupted) healPct = Math.round(healPct * 0.5);
    const heal = Math.round(player.derived.maxHP * (healPct / 100));
    player.currentHP = Math.min(player.derived.maxHP, player.currentHP + heal);
    const mpRestore = disrupted ? Math.round(player.derived.maxMP * 0.15) : Math.round(player.derived.maxMP * 0.3);
    player.currentMP = Math.min(player.derived.maxMP, player.currentMP + mpRestore);
    let resonanceCalm = 1;
    if (!disrupted && statusOf('covenant') === 'Devoted') resonanceCalm = 3; // the harmony settles around you
    player.resonance = Math.max(0, player.resonance - resonanceCalm);
    audio.heal();
    if (disrupted && hostileKey) {
      const WHO: Record<string, string> = {
        sable: 'Sable hunters',
        archive: 'Archive custodians',
        covenant: 'Covenant zealots',
        caravan: 'Dust-Road knives',
      };
      this.log(`You wake to ${WHO[hostileKey]} circling your fire. Not enough rest. +${heal} HP, +${mpRestore} MP (-1 Resonance).`);
    } else {
      const calmNote = resonanceCalm > 1 ? ` (-${resonanceCalm} Resonance — the Covenant's calm)` : ` (-${resonanceCalm} Resonance)`;
      this.log(`You rest a while. +${heal} HP, +${mpRestore} MP${calmNote}.`);
    }
  }

  private resolveDiscovery(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>, node: BoardNode) {
    // Capture points are handled separately in resolveNode (routed to a minor-landmark vignette).
    const LORE_POOL = [
      'the_hundredth_page', 'a_pressed_flower_that_isnt', 'the_counting_room', 'names_carved_then_scratched_out',
      'the_weight_of_unread_mail', 'a_childs_height_marks', 'the_last_entry', 'the_recipe_that_isnt_food',
      'the_map_that_updates_itself', 'the_second_moon_that_isnt_there', 'the_apology_never_sent',
      'the_borrowed_hour',
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
    const goldBeforeDiscovery = player.gold;
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
          player.echoShards += applyShardBonus(player, influenceStatus(player.faction.archive) === 'Devoted' ? 2 : 1);
          // The presence has opinions about what you carry.
          const voiceLine = maybeVoiceLine('lore_found');
          if (voiceLine) showWhisper(this, GAME_WIDTH / 2, 178, voiceLine, 460);
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
    // Devoted Caravan perk: the Dust-Road takes care of its own.
    const goldDelta = player.gold - goldBeforeDiscovery;
    if (goldDelta > 0 && influenceStatus(player.faction.caravan) === 'Devoted') {
      const bonus = Math.round(goldDelta * 0.5);
      player.gold += bonus;
      this.log(`Word of your standing travels the Dust Road. (+${bonus} gold — Caravan rates)`);
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

  /** Fine ash drifting through the map area — the Beneath is never still. */
  private spawnMapDust(): void {
    if (reducedMotion()) return;
    for (let i = 0; i < 12; i++) {
      const x = MAP_AREA_X + Math.random() * MAP_AREA_W;
      const y = MAP_AREA_Y + Math.random() * MAP_AREA_H;
      const mote = this.add.image(x, y, 'particle')
        .setTint(0xc9a24b)
        .setAlpha(0.04 + Math.random() * 0.07)
        .setScale(0.3 + Math.random() * 0.5)
        .setDepth(2);
      this.tweens.add({
        targets: mote,
        y: y - 40 - Math.random() * 60,
        x: x + (Math.random() - 0.5) * 30,
        alpha: 0.01,
        duration: 9000 + Math.random() * 8000,
        repeat: -1,
        delay: Math.random() * 5000,
        onRepeat: () => mote.setPosition(MAP_AREA_X + Math.random() * MAP_AREA_W, MAP_AREA_Y + MAP_AREA_H + 8),
      });
    }
  }

  /** Plays back state changes that happened off-screen (events/combat) as floating chips. */  private flushPendingFx(): void {
    const fx = takeBoardFx();
    if (reducedMotion()) return;
    const panelX = COL2_X + COL_W - 18;
    let row = 0;
    if (fx.faction) {
      const FACTION_COLORS: Record<string, string> = {
        sable: '#e06c6c', archive: '#7fb0c9', covenant: '#b08ae0', caravan: '#e0a45c',
      };
      for (const key of Object.keys(fx.faction)) {
        const entry = fx.faction[key];
        if (!entry) continue;
        const delta = entry.to - entry.from;
        floatDelta(this, panelX, FACTION_PANEL_Y + 26 + row * 22,
          `${key} ${delta > 0 ? '+' : ''}${delta}`,
          FACTION_COLORS[key] ?? '#e9c876', { depth: 60 });
        row++;
      }
    }
    if (fx.gold) {
      const delta = fx.gold.to - fx.gold.from;
      floatDelta(this, panelX, FACTION_PANEL_Y + 26 + row * 22 + 6,
        `${delta > 0 ? '+' : ''}${delta} gold`, delta >= 0 ? '#e9c876' : '#e06c6c', { depth: 60 });
    }
  }

  private markResolved(node: BoardNode) {    node.resolved = true;
    // Resolution feedback: gold ring burst + spark puff at the node itself.
    const pos = positionForNode(node);
    pulseOnce(this, pos.x, pos.y, 26, 0xe9c876, { depth: 15, duration: 340 });
    spawnHitParticles(this, pos.x, pos.y, 0xc9a24b);
  }

  private afterInlineResolution() {
    const store = useGameStore.getState();
    const { player, game } = store;
    if (!player || !game) return;
    store.persist();
    if (CHECKPOINTS.includes(game.currentNodeIndex)) {
      audio.checkpoint();
      const tx = this.add.text(GAME_WIDTH / 2, 300, '✦ Progress saved at this node ✦', {
        fontFamily: FONT_MONO, fontSize: '16px', color: '#c9a24b',
      }).setOrigin(0.5).setDepth(100).setAlpha(1);
      this.tweens.add({
        targets: tx, alpha: 0, y: 280, duration: 3000, ease: 'Power2', onComplete: () => tx.destroy(),
      });
    }
    if (!player.flags.hint_resonance && player.resonance >= 25) {
      this.showCoach('hint_resonance', 'The Loom is noticing you — watch the meter.', COL3_X + COL_W / 2, PLAYER_PANEL_Y + PLAYER_PANEL_H - 46);
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

  /**
   * Shard Rites — spend run-held Echo Shards on board-level boons.
   * Costs escalate +50% per purchase of the same rite this run.
   */
  private openShardRites() {
    if (this.ritesOpen) return;
    const store = useGameStore.getState();
    const player = store.player;
    if (!player) return;
    this.ritesOpen = true;

    const depth = 200;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const parts: Array<{ destroy(): void }> = [];

    const veil = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72).setDepth(depth).setInteractive();
    parts.push(veil);

    const panel = createPanel(this, { x: cx, y: cy - 10, width: 620, height: 470, variant: 'stone', title: 'Shard Rites', depth: depth + 1 });
    parts.push(panel.container);

    const balance = this.add.text(panel.width / 2 - 24, panel.contentY - 4, '', {
      fontFamily: FONT_MONO, fontSize: '14px', color: PALETTE_HEX.goldBright,
    }).setOrigin(1, 0).setDepth(depth + 2);
    panel.container.add(balance);
    panel.container.add(this.add.image(-panel.width / 2 + 26, panel.contentY + 2, 'icon_shard').setDisplaySize(20, 20).setOrigin(0.5).setDepth(depth + 2));

    interface RiteDef { key: string; name: string; desc: string; base: number }
    const RITES: RiteDef[] = [
      { key: 'mend', name: 'Mend', desc: 'Restore 40% HP & MP.', base: 15 },
      { key: 'calm', name: 'Calm', desc: '-10 Resonance.', base: 20 },
      { key: 'favor', name: 'Favor', desc: '+8 standing with your highest faction.', base: 25 },
    ];
    const costOf = (r: RiteDef) => Math.round(r.base * Math.pow(1.5, player.story.shardRites[r.key] ?? 0));

    const rows: Array<Phaser.GameObjects.Text[]> = [];
    const buttons: ReturnType<typeof createButton>[] = [];

    RITES.forEach((rite, i) => {
      const ry = panel.contentY + 44 + i * 86;
      const nameT = this.add.text(-panel.width / 2 + 26, ry, rite.name.toUpperCase(), {
        fontFamily: FONT_SERIF, fontSize: '17px', color: PALETTE_HEX.bone,
      }).setLetterSpacing(1);
      const descT = this.add.text(-panel.width / 2 + 26, ry + 22, rite.desc, {
        fontFamily: FONT_BODY, fontSize: '13px', color: PALETTE_HEX.boneMuted,
      });
      const costT = this.add.text(panel.width / 2 - 26, ry + 4, '', {
        fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.goldBright,
      }).setOrigin(1, 0);
      const timesT = this.add.text(panel.width / 2 - 26, ry + 24, '', {
        fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.boneMuted,
      }).setOrigin(1, 0);
      panel.container.add([nameT, descT, costT, timesT]);
      rows.push([costT, timesT]);

      const btn = createButton(this, 0, ry + 58, 'Perform Rite', () => buy(rite), {
        width: 200, height: 40, fontSize: '14px', variant: 'secondary', depth: depth + 2,
      });
      panel.container.add(btn.container);
      buttons.push(btn);
    });

    const closeBtn = createButton(this, 0, panel.height / 2 - 36, 'Close', () => close(), {
      width: 140, height: 38, fontSize: '14px', variant: 'ghost', depth: depth + 2,
    });
    panel.container.add(closeBtn.container);

    const refresh = () => {
      const p = useGameStore.getState().player!;
      balance.setText(`SHARDS · RUN  ${p.echoShards}`);
      RITES.forEach((rite, i) => {
        const cost = costOf(rite);
        const times = p.story.shardRites[rite.key] ?? 0;
        rows[i][0].setText(`${cost} shards`);
        rows[i][0].setColor(p.echoShards < cost ? PALETTE_HEX.danger : PALETTE_HEX.goldBright);
        rows[i][1].setText(times > 0 ? `performed ×${times}` : '');
        buttons[i].setEnabled(p.echoShards >= cost);
      });
    };

    const buy = (rite: RiteDef) => {
      const p = useGameStore.getState().player;
      if (!p) return;
      const cost = costOf(rite);
      if (p.echoShards < cost) return;
      p.echoShards -= cost;
      p.story.shardRites[rite.key] = (p.story.shardRites[rite.key] ?? 0) + 1;
      if (rite.key === 'mend') {
        p.currentHP = Math.min(p.derived.maxHP, p.currentHP + Math.round(p.derived.maxHP * 0.4));
        p.currentMP = Math.min(p.derived.maxMP, p.currentMP + Math.round(p.derived.maxMP * 0.4));
      } else if (rite.key === 'calm') {
        p.resonance = Math.max(0, p.resonance - 10);
      } else {
        const keys = Object.keys(p.faction) as (keyof typeof p.faction)[];
        const best = keys.reduce((a, b) => (p.faction[a] >= p.faction[b] ? a : b));
        p.faction[best] += 8;
      }
      audio.shardGain();
      store.persist();
      this.playerPanel?.update(p);
      this.factionPanel?.update(p.faction);
      this.log(`Shard Rite · ${rite.name} (${cost} shards).`);
      this.actionGrid?.refresh();
      refresh();
    };

    const close = () => {
      parts.forEach((p) => p.destroy());
      closeBtn.destroy();
      buttons.forEach((b) => b.destroy());
      this.ritesOpen = false;
    };
    veil.on('pointerdown', () => close());

    refresh();
  }

  private handleDeathFlow() {
    const store = useGameStore.getState();
    const { game, player } = store;    const hadCheckpoint = !!game?.checkpointSnapshot && (game?.checkpointNodeIndex ?? 0) > 0;
    if (!hadCheckpoint) {
      store.handleDeath();
      fadeToScene(this, 'GameOver');
      return;
    }

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const d = 200;

    // The dark takes you slowly: the veil closes in instead of snapping on.
    const veil = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85).setDepth(d).setInteractive();
    if (!reducedMotion()) {
      veil.setAlpha(0);
      this.tweens.add({ targets: veil, alpha: 1, duration: 700, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: this.cameras.main, zoom: { from: 1.05, to: 1 }, duration: 900, ease: 'Sine.easeOut' });
    }

    const lines = [
      { y: cy - 90, text: 'You fell. But the Loom remembers.', font: FONT_SERIF, size: '30px', color: PALETTE_HEX.gold, italic: false },
      { y: cy - 40, text: `${player?.name ?? 'The Seeker'} falls in Chapter ${chapterForNode(Math.max(1, game.currentNodeIndex))}.`, font: FONT_BODY, size: '20px', color: PALETTE_HEX.bone, italic: false },
      { y: cy - 8, text: `Return to checkpoint at node ${game.checkpointNodeIndex}.`, font: FONT_BODY, size: '17px', color: PALETTE_HEX.boneMuted, italic: false },
      { y: cy + 24, text: 'HP and MP restored to 50%.', font: FONT_MONO, size: '16px', color: PALETTE_HEX.gold, italic: false },
    ];
    lines.forEach((l, i) => {
      const t = this.add.text(cx, l.y, l.text, {
        fontFamily: l.font, fontSize: l.size, color: l.color, fontStyle: l.italic ? 'italic' : undefined,
      }).setOrigin(0.5).setDepth(d);
      if (!reducedMotion()) {
        const ty = t.y;
        t.y = ty + 18;
        t.setAlpha(0);
        this.tweens.add({ targets: t, y: ty, alpha: 1, duration: 520, delay: 250 + i * 170, ease: 'Sine.easeOut' });
      }
    });

    const mkBtn = (x: number, label: string, onClick: () => void) => {
      const btn = createButton(this, x, cy + 84, label, onClick, { width: 200, height: 46, fontSize: '17px', depth: d });
      if (!reducedMotion()) btn.container.setAlpha(0);
      this.tweens.add({ targets: btn.container, alpha: 1, duration: 400, delay: 950, ease: 'Sine.easeOut' });
      return btn;
    };
    mkBtn(cx - 110, 'Continue', () => {
      store.handleDeath();
      fadeToScene(this, 'Board');
    });
    mkBtn(cx + 110, 'Return to Menu', () => {
      const { meta } = useGameStore.getState();
      const newMeta = { ...meta, deathCount: meta.deathCount + 1 };
      useGameStore.setState({ meta: newMeta, player: null, game: null });
      audio.click();
      fadeToScene(this, 'Menu');
    });
  }
}
