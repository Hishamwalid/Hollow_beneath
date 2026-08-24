import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { BOSSES } from '@data/bosses';
import { ITEMS } from '@data/items';
import { NAMED_SKILLS } from '@data/skills';
import type { AffinityKind, EventApplyCtx, PlayerState } from '@data/types';
import { DAMAGE_TYPES, DAMAGE_TYPE_ABBREV } from '@data/types';
import { CombatEngine, type CombatSnapshot, type EnemyView, type MomentumChoice } from '@systems/CombatEngine';
// Revamp compat: battlefield states & fear/bravery systems removed — UI still renders their labels via no-op data.
const BATTLEFIELD_STATES: Record<string, { label: string; turns?: number }> = {};
const BRAVERY_ACTIONS: Array<{ id: string; label: string; detail?: string; apCost?: number }> = [];
import { applyShardBonus } from '@systems/EchoShardSystem';
import { maybePickWhisper } from '@systems/WhisperSystem';
import { showWhisper } from '@ui/WhisperOverlay';
import { addResonanceEffects } from '@systems/ResonanceFX';
import { createStatPanel } from '@ui/StatPanel';
import { createEnemyDisplay, createActionGrid, createTurnOrderPanel, createTooltipPanel, createAllyDisplay, createBossBar, type EnemyDisplay, type ActionGridItem, type ActionGridHandle, type TooltipPanelHandle, type AllyDisplay } from '@ui/CombatHUD';
import { createQteBar, type QteBarHandle, type QteQuality } from '@ui/QteBar';
import { createChoiceMenu, type ChoiceMenu, type ChoiceMenuItem } from '@ui/ChoiceMenu';
import { createButton } from '@ui/Button';
import { createPanel } from '@ui/Panel';
import { createCoachTip } from '@ui/CoachTip';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX, DAMAGE_TYPE_HEX } from '@ui/uiTheme';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { settingsManager } from '@systems/SettingsManager';
import { spawnHitParticles, spawnHealParticles, spawnMomentumParticles } from '@systems/particles';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT, NODES_PER_CHAPTER } from '@/config';
import { computeLevelUp } from '@systems/LevelSystem';
import { showLevelUpModal, showStatChoiceModal } from '@ui/LevelUpModal';
import combatLayoutJson from '@data/combatLayout.json';

interface CombatSceneData {
  mode: 'wild' | 'event' | 'boss';
  enemyIds?: string[];
  bossId?: string;
  /** Node the fight takes place on — drives position-based difficulty scaling. */
  nodeIndex: number;
  precombatFlags?: Record<string, number>;
  onVictory?: (player: PlayerState, ctx: EventApplyCtx) => string;
}

const MOMENTUM_LABELS: Record<MomentumChoice, { label: string; subtitle: string }> = {
  flow: { label: 'Flow', subtitle: 'Act again now; start next round exhausted (-1 AP)' },
  harmony: { label: 'Harmony', subtitle: '+25% Max HP now; boss enrages (+30% dmg)' },
  archive: { label: 'Archive', subtitle: 'Recall the current boss phase' },
  forgotten_technique: { label: 'Forgotten Technique', subtitle: 'Next action costs 0 AP' },
  unravel: { label: 'Unravel', subtitle: 'Next hit: 2.5x dmg, ignore 75% Def' },
  echo_surge: { label: 'Echo Surge', subtitle: 'All damage +20% for 2 turns' },
  phase_shift: { label: 'Phase Shift', subtitle: 'Dodge the next 2 attacks' },
  desperate_strike: { label: 'Desperate Strike', subtitle: 'All attacks crit this turn' },
  overclock: { label: 'Overclock', subtitle: '+70% damage; lose 20% max HP (this fight)' },
};

/** Combat frame geometry (16:9 — 1080×607.5, centered in the 1280×800 canvas with
 *  ~100px side and ~96px top/bottom margins). The player stat box floats inside the
 *  frame's lower area; the tooltip panel hugs the frame's bottom edge.
 *  Background art must match 16:9 (e.g. 1920×1080). */
const FRAME_X = 100;
const FRAME_Y = 96.25;
const FRAME_H = 607.5;
const FRAME_W = (FRAME_H * 16) / 9;
const FRAME_RIGHT = FRAME_X + FRAME_W;

/** Duration of one actor's slot during the enemy/ally phase rotation. */
const ENEMY_STEP_MS = 750;
/** How long an enemy holds its attack pose within its slot. */
const ENEMY_POSE_MS = 400;
/** Within a slot, when the actor's damage lands (hit pose + floating text + HP tween). */
const ENEMY_DMG_AT = 300;
/** Pause after the last actor settles before re-enabling the player. */
const ENEMY_SETTLE_HOLD_MS = 450;

/** Player actions that require an explicit target when more than one enemy stands.
 *  Basic strikes (attack/sunder) skip this — they hit the selected enemy immediately. */
const TARGETED_ACTIONS = new Set(['scan', 'skill', 'resonance', 'deep_analyze']);

/** Handpicked UI position offsets (mirrors the board node-editor workflow). Loaded
 *  from src/data/combatLayout.json; edited live via `?editlayout=1`. */
const EDIT_LAYOUT =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('editlayout');
const COMBAT_ADJUSTMENTS: Map<string, { dx: number; dy: number }> = new Map(
  (combatLayoutJson.adjustments as { key: string; dx: number; dy: number }[]).map((a) => [a.key, { dx: a.dx, dy: a.dy }]),
);
const layoutAdj = (key: string): { dx: number; dy: number } =>
  COMBAT_ADJUSTMENTS.get(key) ?? { dx: 0, dy: 0 };

/** Base positions handpickable via ?editlayout=1. */
const BATTLEFIELD_LABEL_BASE = { x: GAME_WIDTH / 2, y: 101.25 };
const STAT_PANEL_BASE = { x: 237.7, y: 597.55 };
const PLAYER_ROW_BASE = { x: FRAME_RIGHT - 10, y: 151.25 };
const PLAYER_SPRITE_BASE = { x: 359.2, y: 500.05 };
const ALLY_SPRITE_BASE = { x: 545, y: 505 };
const PLAYER_SHADOW_BASE = { x: 351, y: 620.95 };
const TOOLTIP_PANEL_BASE = { x: 640.7, y: 711.75 };
const TURN_ORDER_BASE = { x: 175.7, y: 197.95 };
const ACTION_GRID_BASE = { x: FRAME_RIGHT - 107.05, y: 555.95 };
const ENEMY_ROW_BASE_Y = 323.25;
/** Enemy row sits slightly right of center (design calls for enemies further from the player). */
const ENEMY_ROW_CENTER = FRAME_X + FRAME_W / 2 + 45;
const FX_ANCHOR_BASE = { x: 359.2, y: 564.25 };
/** Where new combat-log lines toast on-screen (top of the battle frame). */
const LOG_TOAST = { x: GAME_WIDTH / 2, y: 148 };
/** Detailed-log button in the right margin (where the old side panel lived). */
const LOG_BTN_BASE = { x: 1230, y: 150 };

/** QTE timing bar sits centered over the battlefield while a strike is pending. */
const QTE_BASE = { x: 640.7, y: 402 };
/** Free Scan modal center. */
const SCAN_BASE = { x: 640.7, y: 400 };

/** Result colors for the Scan affinity chips (matches the Bestiary page). */
const AFFINITY_HEX: Record<AffinityKind, number> = {
  wk: 0xe9c876,
  str: 0x7fb0c9,
  null: 0x555555,
  rep: 0xc0392b,
  drn: 0x5c8a5c,
  '-': 0x9a9488,
};

/** Which combat background to show: chapter-1 sandy areas, stone areas near the
 *  Sentinel's door, or the Sentinel boss arena. Later chapters keep the default dark frame. */
function combatBgKeyFor(data: CombatSceneData): string | null {
  if (data.mode === 'boss') return data.bossId === 'sentinel' ? 'bg_combat_stage1_boss' : null;
  if (data.nodeIndex <= 30) return 'bg_combat_stage1_sand';
  if (data.nodeIndex <= NODES_PER_CHAPTER) return 'bg_combat_stage1_stone';
  return null;
}

export class CombatScene extends Phaser.Scene {
  private engine!: CombatEngine;
  private sceneData!: CombatSceneData;
  private enemyDisplays: EnemyDisplay[] = [];
  private enemyKeyMap: Map<string, EnemyDisplay> = new Map();
  private selectedTarget: string | null = null;
  private lastPlayerHP = 0;
  private lastFatigue = 0;
  private lastResonance = 0;
  /** Round rendered by the last refresh — used to spot AP penalties at round starts. */
  private lastRenderedRound = 0;
  /** Snapshot from the last refresh (kept for the combat-log panel). */
  private lastSnap?: CombatSnapshot;
  /** How many engine log lines have already been toasted/shown. */
  private shownLogCount = 0;
  private toastQueue: string[] = [];
  private toastBusy = false;
  /** Last-seen views per enemy key — lets fallen enemies render their drained HP bar on fight end. */
  private lastEnemyViews = new Map<string, EnemyView>();
  /** `?combatdebug=1` state overlay: R{round} PH:{phase} AP E:{enemyPhaseActive} T:{turnRotationActive} P:{pendingBeginRound} LA:{lastActors}. */
  private debugOverlay?: Phaser.GameObjects.Text;
  private lastAP = 0;
  private lastAPSet = false;
  private statPanel?: ReturnType<typeof createStatPanel>;
  private poseLockUntil = 0;
  private playerSprite?: Phaser.GameObjects.Image;
  private actionGridContainer?: Phaser.GameObjects.Container;
  private tooltipPanel?: TooltipPanelHandle;
  private phaseLabelText?: Phaser.GameObjects.Text;
  private battlefieldLabelText?: Phaser.GameObjects.Text;
  private playerRowText?: Phaser.GameObjects.Text;
  private overlayMenu?: ChoiceMenu;
  private overlayBg?: Phaser.GameObjects.Rectangle;
  /** Modal title/flavor texts that closeOverlay must clean up (they aren't children of the menu). */
  private overlayTexts: Phaser.GameObjects.Text[] = [];
  private turnOrderPanel?: ReturnType<typeof createTurnOrderPanel>;
  private bossBar?: ReturnType<typeof createBossBar>;
  private inlineMenu?: Phaser.GameObjects.Container;
  private momentumMenu?: Phaser.GameObjects.Container;
  /** Keyboard navigation state (arrows/WASD move focus, Enter/Space activate). */
  private gridHandle?: ActionGridHandle;
  private gridFocus = -1;
  private inlineRows: {
    bg: Phaser.GameObjects.Rectangle;
    t: Phaser.GameObjects.Text;
    right?: Phaser.GameObjects.Text;
    rightChips?: Phaser.GameObjects.Rectangle[];
    disabled: boolean;
    onSelect: () => void;
    onHover?: () => void;
  }[] = [];
  private inlineFocus = -1;
  private momentumButtons: { bg: Phaser.GameObjects.Rectangle; t: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text; onSelect: () => void }[] = [];
  private momentumFocus = -1;
  /** Alive-enemy keys the open Scan modal can cycle through (←/→). */
  private scanCycle?: { keys: string[]; index: number };
  /** Keyboard focus index for choice-menu overlays (crisis/insight/victory menus). */
  private overlayFocus = -1;
  /** Level-up / stat-choice modal keyboard handle. */
  private kbdModal?: { nav: (dir: 'up' | 'down') => void; confirm: () => void };
  /** Single-button screens (e.g. victory summary Continue) activatable with Enter. */
  private kbdSingle?: () => void;
  /** Nav key listeners (removed on scene shutdown so they never leak). */
  private kbHandlers: [string, () => void][] = [];
  private targetingMode = false;
  private pendingTargeted?: { type: string; fn: () => CombatSnapshot; hpCost: number };
  private resultShown = false;
  private fxAnchor = { ...FX_ANCHOR_BASE };
  private playerShadow?: Phaser.GameObjects.Ellipse;
  private allyDisplay?: AllyDisplay;
  private turnRotationTimers: Phaser.Time.TimerEvent[] = [];
  /** True while the enemy/ally phase is animating — blocks player input and action buttons. */
  private enemyPhaseActive = false;
  /** Lead-in pause before the enemy phase starts animating (set by onEndTurn). */
  private enemyPhaseLeadIn = 0;
  /** Called when the enemy-phase rotation settles (used to chain the next round). */
  private afterEnemyPhase?: () => void;
  /** HP currently shown on the stat panel during the enemy-phase rotation (staged beat-by-beat). */
  private displayedPlayerHP = 0;
  /** True while the enemy-phase rotation is chaining — guards against restarts. */
  private turnRotationActive = false;
  /** Set when a modal is open at rotation settle; `maybeBeginRound` drains it later. */
  private pendingBeginRound = false;
  private enemyPoseTimers = new Map<Phaser.GameObjects.Container, Phaser.Time.TimerEvent>();
  private enemyRowMarker?: Phaser.GameObjects.Rectangle;
  private enemySpreadMarker?: Phaser.GameObjects.Rectangle;
  private fxMarker?: Phaser.GameObjects.Rectangle;
  /** True once the Argent Sentinel has transformed into its 2nd phase (phase-2 sprite set active). */
  private sentinelTransformed = false;
  /** True while the sentinel transform cutscene is playing — blocks input and the action grid. */
  private transformCutscene = false;
  /** True while a QTE strike is awaiting timing input — locks the action grid. */
  private qteActive = false;
  private qteBar?: QteBarHandle;
  private qteType = 'attack';
  private qteTargetKey?: string;
  private qtePrevPlayerHP = 0;
  private qtePrevEnemyHP = new Map<string, number>();
  private qteHpCost = 0;
  /** In-combat Scan modal container (cleaned up by closeOverlay). */
  private scanPanel?: Phaser.GameObjects.Container;

  constructor() {
    super('Combat');
  }

  create(data: CombatSceneData) {
    this.resultShown = false;
    this.sentinelTransformed = false;
    this.transformCutscene = false;
    this.qteActive = false;
    this.qteBar = undefined;
    this.qteTargetKey = undefined;
    this.scanPanel = undefined;
    this.shownLogCount = 0;
    this.toastQueue = [];
    this.toastBusy = false;
    this.lastEnemyViews.clear();
    this.events.once('shutdown', () => {
      if (this.qteBar) { this.qteBar.destroy(); this.qteBar = undefined; }
      this.qteActive = false;
    });
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    this.sceneData = data;
    const store = useGameStore.getState();
    const player = store.player;
    this.lastPlayerHP = player?.currentHP ?? 0;
    this.displayedPlayerHP = this.lastPlayerHP;
    this.pendingBeginRound = false;
    this.afterEnemyPhase = undefined;
    this.lastFatigue = player?.fatigue ?? 0;
    this.lastResonance = player?.resonance ?? 0;
    this.lastRenderedRound = 0;
    if (!player) {
      fadeToScene(this, 'Board');
      return;
    }
    addResonanceEffects(this, player.resonance, GAME_WIDTH, GAME_HEIGHT, { nodePulse: false, shimmer: false });

    const bgKey = combatBgKeyFor(data);
    if (bgKey && this.textures.exists(bgKey)) {
      const bg = this.add.image(FRAME_X + FRAME_W / 2, FRAME_Y + FRAME_H / 2, bgKey).setDepth(0);
      bg.setScale(Math.min(FRAME_W / bg.width, FRAME_H / bg.height));
    }
    this.add
      .rectangle(FRAME_X, FRAME_Y, FRAME_W, FRAME_H, 0x0b0d10, bgKey ? 0 : 1)
      .setStrokeStyle(10, 0xc9a24b)
      .setOrigin(0)
      .setDepth(0);

    const bossDef = data.mode === 'boss' && data.bossId ? BOSSES[data.bossId] : undefined;
    const safeEnemyIds = data.enemyIds ?? [];
    if (safeEnemyIds.length === 0 && !bossDef && data.mode !== 'event') {
      fadeToScene(this, 'Board');
      return;
    }

    this.engine = new CombatEngine({
      player,
      enemyIds: safeEnemyIds,
      nodeIndex: data.nodeIndex ?? 1,
      rng: Math.random,
      bossDef,
      precombatFlags: data.precombatFlags,
      playerHistory: new Set(player.history),
      difficulty: settingsManager.get().difficulty,
      discoveredAffinities: (store.meta as unknown as Record<string, unknown>).discoveredAffinities as Record<string, import('@data/types').EnemyAffinities> ?? {},
    });

    this.add
      .text(GAME_WIDTH / 2, 24, bossDef ? bossDef.name : 'Combat', { fontFamily: FONT_SERIF, fontSize: '30px', color: PALETTE_HEX.gold })
      .setOrigin(0.5, 0);
    this.phaseLabelText = this.add
      .text(GAME_WIDTH / 2, 58, '', { fontFamily: FONT_SERIF, fontSize: '20px', color: PALETTE_HEX.boneMuted, fontStyle: 'italic' })
      .setOrigin(0.5, 0);

    this.fxAnchor = { x: FX_ANCHOR_BASE.x + layoutAdj('fxAnchor').dx, y: FX_ANCHOR_BASE.y + layoutAdj('fxAnchor').dy };

    const bfAdj = layoutAdj('battlefieldLabel');
    this.battlefieldLabelText = this.add
      .text(BATTLEFIELD_LABEL_BASE.x + bfAdj.dx, BATTLEFIELD_LABEL_BASE.y + bfAdj.dy, '', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.gold })
      .setOrigin(0.5, 0);

    const initialSnap = this.engine.beginRound();
    this.buildEnemyDisplays(initialSnap);

    // First-fight primer: three lines, once per save. Presentation-only.
    if (!player.flags.hint_combat) {
      player.flags.hint_combat = true;
      store.persist();
      this.showCombatPrimer();
    }

    const spAdj = layoutAdj('statPanel');
    this.statPanel = createStatPanel(this, STAT_PANEL_BASE.x + spAdj.dx, STAT_PANEL_BASE.y + spAdj.dy);
    const prAdj = layoutAdj('playerRow');
    this.playerRowText = this.add
      .text(PLAYER_ROW_BASE.x + prAdj.dx, PLAYER_ROW_BASE.y + prAdj.dy, '', { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.gold })
      .setOrigin(1, 0.5)
      .setDepth(10);

    const psAdj = layoutAdj('playerSprite');
    this.playerSprite = this.add.image(PLAYER_SPRITE_BASE.x + psAdj.dx, PLAYER_SPRITE_BASE.y + psAdj.dy, 'player_idle').setDepth(6);
    this.showPlayerTexture('player_idle');
    const alAdj = layoutAdj('allySprite');
    const allyName = initialSnap.allies[0]?.name ?? '';
    this.allyDisplay = createAllyDisplay(this, ALLY_SPRITE_BASE.x + alAdj.dx, ALLY_SPRITE_BASE.y + alAdj.dy, allyName);
    const pshAdj = layoutAdj('playerShadow');
    this.playerShadow = this.add.ellipse(PLAYER_SHADOW_BASE.x + pshAdj.dx, PLAYER_SHADOW_BASE.y + pshAdj.dy, 248, 56, 0x291c00, 0.76).setDepth(5);

    const tpAdj = layoutAdj('tooltipPanel');
    this.tooltipPanel = createTooltipPanel(this, TOOLTIP_PANEL_BASE.x + tpAdj.dx, TOOLTIP_PANEL_BASE.y + tpAdj.dy);
    const lbAdj = layoutAdj('logBtn');
    createButton(this, LOG_BTN_BASE.x + lbAdj.dx, LOG_BTN_BASE.y + lbAdj.dy, 'LOG', () => this.openLogModal(), {
      width: 64, height: 34, fontSize: '14px', depth: 11,
    });
    const toAdj = layoutAdj('turnOrder');
    this.turnOrderPanel = createTurnOrderPanel(this, TURN_ORDER_BASE.x + toAdj.dx, TURN_ORDER_BASE.y + toAdj.dy);
    if (data.mode === 'boss' || initialSnap.enemies.some((e) => e.isBoss)) {
      this.bossBar = createBossBar(this, FRAME_X + FRAME_W / 2, FRAME_Y + 44);
    }

    if (new URLSearchParams(window.location.search).get('combatdebug') === '1') {
      this.debugOverlay = this.add
        .text(4, 4, '', {
          fontFamily: FONT_MONO,
          fontSize: '11px',
          color: '#00e5a0',
          backgroundColor: 'rgba(0,0,0,0.75)',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0, 0)
        .setDepth(90);
    }

    const whisper = maybePickWhisper(player.resonance, 'combat', Math.random);
    if (whisper) showWhisper(this, GAME_WIDTH / 2, 96, whisper.text, 600);

    if (EDIT_LAYOUT) this.setupLayoutEditor();

    // Global keyboard navigation: arrows/WASD move focus, Enter/Space activate.
    const kb = this.input.keyboard;
    kb?.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER']);
    const NAV_KEYS: Array<[string, 'up' | 'down' | 'left' | 'right']> = [
      ['keydown-UP', 'up'], ['keydown-W', 'up'],
      ['keydown-DOWN', 'down'], ['keydown-S', 'down'],
      ['keydown-LEFT', 'left'], ['keydown-A', 'left'],
      ['keydown-RIGHT', 'right'], ['keydown-D', 'right'],
    ];
    this.kbHandlers = [['keydown-ESC', () => {
      if (this.scanPanel) { this.closeOverlay(); return; }
      if (this.momentumMenu) return; // a momentum choice is mandatory
      if (this.inlineMenu) { this.closeInlineMenu(); return; }
      this.cancelTargeting();
    }]];
    NAV_KEYS.forEach(([evt, dir]) => this.kbHandlers.push([evt, () => this.navMove(dir)]));
    this.kbHandlers.push(['keydown-ENTER', () => this.navConfirm()]);
    this.kbHandlers.push(['keydown-SPACE', () => this.navConfirm()]);
    this.kbHandlers.forEach(([evt, fn]) => kb?.on(evt, fn));
    // Scene shutdown must drop every nav listener — stale handlers surviving a
    // restart (or Vite HMR) would double-fire actions in later fights.
    this.events.once('shutdown', () => {
      this.kbHandlers.forEach(([evt, fn]) => this.input.keyboard?.off(evt, fn));
      this.kbHandlers = [];
    });
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => { if (ptr.rightButtonDown()) this.cancelTargeting(); });

    this.refresh(initialSnap);
    if (data.mode === 'boss') this.showBossEntry();
  }

  private showBossEntry() {
    if (settingsManager.get().screenShake) {
      this.cameras.main.shake(200, 0.008);
    }
    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x8b0000, 0).setDepth(60);
    this.tweens.add({
      targets: flash, alpha: 0.25, duration: 200, yoyo: true, ease: 'Sine.easeOut',
      onComplete: () => flash.destroy(),
    });
    if (this.enemyDisplays.length > 0) {
      const first = this.enemyDisplays[0];
      const ring = this.add.circle(
        first.container.x, first.container.y - 18, 44, 0x000000, 0,
      ).setStrokeStyle(2, 0xc9a24b, 0.4).setDepth(6);
      this.tweens.add({
        targets: ring, alpha: { from: 0.4, to: 1 }, duration: 1000, yoyo: true, repeat: -1,
      });
    }
  }

  private buildEnemyDisplays(snap: CombatSnapshot) {
    this.enemyDisplays.forEach((d) => d.destroy());
    this.enemyDisplays = [];
    this.enemyKeyMap.clear();
    const n = snap.enemies.length;
    const spacing = this.enemySpacing(n);
    const rowCenter = ENEMY_ROW_CENTER;
    const startX = rowCenter - ((n - 1) * spacing) / 2;
    const rowY = this.enemyRowY();
    snap.enemies.forEach((e, i) => {
      const disp = createEnemyDisplay(this, startX + i * spacing, rowY, e.isBoss, () => {
        // While the scan modal is open, clicking an enemy switches the scanned target.
        if (this.scanPanel) {
          if (e.alive) this.openScanModal(e.key);
          return;
        }
        if (this.targetingMode && this.pendingTargeted) {
          this.confirmTargetedAction(e.key);
          return;
        }
        this.selectedTarget = e.key;
        this.updateTargetHighlight(this.engine.snapshot());
      });
      disp.update(e);
      if (e.isBoss) disp.setHpBarVisible(false);
      this.lastEnemyViews.set(e.key, e);
      this.enemyDisplays.push(disp);
      this.enemyKeyMap.set(e.key, disp);
    });
    if (!this.selectedTarget && snap.enemies[0]) this.selectedTarget = null;
    this.updateEnemyMarkers();
  }

  private updateTargetHighlight(snap: CombatSnapshot) {
    this.enemyDisplays.forEach((d, i) => d.setSelected(snap.enemies[i]?.key === this.selectedTarget));
  }


  private turnOrderNames(snap: CombatSnapshot): Map<string, string> {
    const names = new Map<string, string>();
    names.set('player', 'Player');
    for (const e of snap.enemies) names.set(e.key, e.name);
    for (const a of snap.allies) names.set(`ally_${a.id}`, a.name);
    return names;
  }

  private turnOrderPortraits(snap: CombatSnapshot): Map<string, string> {
    const portraits = new Map<string, string>();
    portraits.set('player', this.textures.exists('player_face') ? 'player_face' : 'player_idle');
    for (const e of snap.enemies) {
      const faceTex = e.defId === 'sentinel'
        ? (this.sentinelTransformed ? 'enemy_sentinel_face2' : 'enemy_sentinel_face1')
        : `enemy_${e.defId}_face`;
      const tex = this.textures.exists(faceTex)
        ? faceTex
        : this.textures.exists(`enemy_${e.defId}_idle`)
          ? `enemy_${e.defId}_idle`
          : 'enemy_idle';
      portraits.set(e.key, tex);
    }
    for (const a of snap.allies) portraits.set(`ally_${a.id}`, 'token_7');
    return portraits;
  }

  private updateTurnOrderPanel(snap: CombatSnapshot, actor: string | undefined) {
    const order = [...snap.turnOrder];
    if (actor) {
      const idx = order.indexOf(actor);
      if (idx > 0) order.push(...order.splice(0, idx));
    }
    this.turnOrderPanel?.update(order, actor, this.turnOrderNames(snap), this.turnOrderPortraits(snap));
  }

  /** Round-robin highlight: step through the actors whose turns just resolved,
   *  rotating the queue so the current actor sits in the highlighted first row.
   *  Each actor gets a full `ENEMY_STEP_MS` slot; damage it dealt to the player
   *  lands at `ENEMY_DMG_AT` (hit pose + floating text + staged HP tween).
   *  Non-attributed changes (DoTs, heals, regen) apply at the settle.
   *  `leadIn` adds a pause before the sequence starts. The rotation chains
   *  sequentially (never restarts) and ends with `ENEMY_SETTLE_HOLD_MS`. */
  private startTurnRotation(snap: CombatSnapshot, leadIn = 0) {
    if (this.turnRotationActive || this.transformCutscene) return;
    this.turnRotationActive = true;
    this.turnRotationTimers.forEach((t) => t.remove());
    this.turnRotationTimers = [];
    const alive = new Set(['player', ...snap.enemies.map((e) => e.key), ...snap.allies.map((a) => `ally_${a.id}`)]);
    const actors = snap.lastActors.filter((k) => alive.has(k));
    const realHP = snap.playerHP;
    const prevHP = this.displayedPlayerHP;
    const dmgMap = snap.enemyPhaseDamage ?? {};
    const chunkSum = actors.reduce((sum, k) => sum + (dmgMap[k] ?? 0), 0);
    const settleDelta = realHP - prevHP - chunkSum;

    const step = (i: number) => {
      try {
        if (i >= actors.length) {
          this.settleEnemyPhase(snap, realHP, settleDelta);
          return;
        }
        const key = actors[i];
        const dmg = dmgMap[key] ?? 0;
        this.updateTurnOrderPanel(snap, key);
        if (key.startsWith('ally_')) {
          this.allyDisplay?.setState('attack');
          this.turnRotationTimers.push(
            this.time.delayedCall(ENEMY_STEP_MS, () => {
              if (this.enemyPhaseActive) this.allyDisplay?.setState('idle');
            }),
          );
        } else if (key !== 'player') {
          const ed = this.enemyKeyMap.get(key);
          if (ed) this.setEnemyPose(ed, 'attack', ENEMY_POSE_MS);
        }
        if (dmg > 0) {
          this.turnRotationTimers.push(this.time.delayedCall(ENEMY_DMG_AT, () => this.landPlayerDamage(dmg)));
        }
        this.turnRotationTimers.push(this.time.delayedCall(ENEMY_STEP_MS, () => step(i + 1)));
      } catch (err) {
        console.error('Combat rotation step error:', err);
        this.recoverRoundChain();
      }
    };

    if (actors.length === 0) {
      this.settleEnemyPhase(snap, realHP, settleDelta);
      return;
    }
    if (leadIn > 0) {
      this.turnRotationTimers.push(this.time.delayedCall(leadIn, () => step(0)));
    } else {
      step(0);
    }
  }

  /** Emergency recovery: clear rotation/round state and force a fresh player-phase refresh
   *  so a stray exception can never leave the fight (or the AP refill loop) locked. */
  private recoverRoundChain(): void {
    this.pendingBeginRound = false;
    this.enemyPhaseActive = false;
    this.turnRotationActive = false;
    this.turnRotationTimers.forEach((t) => t.remove());
    this.turnRotationTimers = [];
    this.afterEnemyPhase = undefined;
    try {
      this.refresh(this.engine.recoverPhase());
    } catch (_) {
      /* never leave the player locked */
    }
  }

  /** Player takes damage during an enemy slot: hit pose, flash, shake, floating text, staged HP tween. */
  private landPlayerDamage(dmg: number): void {
    audio.damageTaken();
    this.setPlayerPose('hit');
    this.flashPlayerHit();
    this.shakePlayer();
    this.floatingText(this.fxAnchor.x, this.fxAnchor.y, `-${dmg}`, PALETTE_HEX.danger);
    this.tweenDisplayedHP(Math.max(0, this.displayedPlayerHP - dmg), 380);
  }

  /** Tweens the HP shown on the stat panel (bar setPct already animates its width). */
  private tweenDisplayedHP(target: number, dur: number): void {
    const obj = { v: this.displayedPlayerHP };
    const tween = this.tweens.add({
      targets: obj,
      v: target,
      duration: dur,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        this.displayedPlayerHP = obj.v;
        const st = useGameStore.getState().player;
        if (st) this.statPanel?.update({ ...st, currentHP: obj.v });
      },
    });
    tween.once('complete', () => {
      this.displayedPlayerHP = target;
    });
  }

  /** End of the rotation: apply un-attributed deltas, re-enable the player, chain the next round. */
  private settleEnemyPhase(snap: CombatSnapshot, realHP: number, settleDelta: number): void {
    if (!this.turnRotationActive) return;
    this.turnRotationTimers.forEach((t) => t.remove());
    this.turnRotationTimers = [];
    this.enemyPhaseActive = false;
    this.buildActionGrid(this.engine.snapshot());
    this.updateTurnOrderPanel(snap, 'player');
    if (Math.abs(settleDelta) >= 1) {
      this.tweenDisplayedHP(realHP, 400);
      if (settleDelta > 0) {
        audio.damageTaken();
        this.floatingText(this.fxAnchor.x, this.fxAnchor.y, `-${settleDelta}`, PALETTE_HEX.danger);
      } else {
        this.floatingText(this.fxAnchor.x, this.fxAnchor.y, `+${-settleDelta}`, PALETTE_HEX.ok);
      }
    } else {
      this.displayedPlayerHP = realHP;
    }
    this.lastPlayerHP = realHP;
    this.turnRotationActive = false;
    if (this.afterEnemyPhase) {
      const cb = this.afterEnemyPhase;
      this.afterEnemyPhase = undefined;
      this.time.delayedCall(ENEMY_SETTLE_HOLD_MS, () => cb());
    }
  }

  private refresh(snap: CombatSnapshot) {
    this.lastSnap = snap;
    const { player } = useGameStore.getState();
    if (player) {
      // Combat truth comes from the engine snapshot (store HP/MP only update at
      // combat end). During the enemy-phase rotation HP is staged beat-by-beat.
      const staged = this.enemyPhaseActive && this.displayedPlayerHP > 0 && this.displayedPlayerHP !== player.currentHP;
      const shownHP = staged ? this.displayedPlayerHP : snap.playerHP;
      this.displayedPlayerHP = shownHP;
      this.statPanel?.update({
        ...player,
        currentHP: shownHP,
        currentMP: snap.playerMP,
        momentum: Math.max(0, Math.min(5, snap.momentum)),
      });
    }
    this.playerRowText?.setText(snap.playerRow ? `ROW: ${snap.playerRow.toUpperCase()}` : '');
    if (snap.round !== this.lastRenderedRound) {
      this.lastRenderedRound = snap.round;
    }
    this.phaseLabelText?.setText(snap.bossPhaseLabel ?? '');
    if (snap.battlefieldState) {
      const label = BATTLEFIELD_STATES[snap.battlefieldState.id].label;
      this.battlefieldLabelText?.setText(`◈ BATTLEFIELD: ${label} (${snap.battlefieldState.turns})`);
    } else {
      this.battlefieldLabelText?.setText('');
    }
    const selected = this.selectedTarget ? snap.enemies.find((e) => e.key === this.selectedTarget) : undefined;
    if (!selected || !selected.alive) {
      this.selectedTarget = snap.enemies.find((e) => e.alive)?.key ?? null;
    }
    // On a finished fight the snapshot only lists survivors — keep the fallen boss
    // on screen with its HP bar drained to zero so the kill reads visually.
    if (snap.enemies.length !== this.enemyDisplays.length && snap.phase !== 'victory' && snap.phase !== 'defeat') {
      this.buildEnemyDisplays(snap);
    } else if (snap.phase === 'victory' || snap.phase === 'defeat') {
      snap.enemies.forEach((e, i) => {
        this.enemyDisplays[i]?.update(e);
        this.lastEnemyViews.set(e.key, e);
      });
      const aliveKeys = new Set(snap.enemies.map((e) => e.key));
      for (const [key, view] of this.lastEnemyViews) {
        if (aliveKeys.has(key)) continue;
        const disp = this.enemyKeyMap.get(key);
        if (!disp) continue;
        const isBoss = this.sceneData.mode === 'boss' && this.sceneData.bossId === view.defId;
        disp.update({ ...view, hp: 0, alive: true });
        if (isBoss) continue; // bosses stay for their defeat sequence
        // Regular foes drain, then dissolve away before the result shows.
        this.tweens.add({
          targets: disp.container,
          alpha: 0,
          delay: 250,
          duration: 450,
          onComplete: () => disp.container.setVisible(false),
        });
      }
      this.updateTargetHighlight(snap);
    } else {
      snap.enemies.forEach((e, i) => {
        this.enemyDisplays[i]?.update(e);
        this.lastEnemyViews.set(e.key, e);
      });
      this.updateTargetHighlight(snap);
    }
    this.updateBossBar(snap);
    this.checkSentinelTransform(snap);
    this.buildActionGrid(snap);
    if (this.transformCutscene) return;
    this.allyDisplay?.container.setVisible(snap.allies.length > 0);
    // Only animate the enemy rotation when an enemy phase actually just ran —
    // stale lastActors from a previous phase must never replay their poses.
    if (!this.qteActive) {
      if (this.enemyPhaseActive && snap.lastActors.length > 0) {
        this.startTurnRotation(snap, this.enemyPhaseLeadIn);
      } else {
        // Guard: a stale snapshot with no pending actors must never tear down a running rotation.
        if (this.turnRotationActive) return;
        this.turnRotationTimers.forEach((t) => t.remove());
        this.turnRotationTimers = [];
        this.turnRotationActive = false;
        this.enemyPhaseActive = false;
        this.updateTurnOrderPanel(snap, snap.phase === 'player' ? 'player' : undefined);
        if (this.afterEnemyPhase) {
          const cb = this.afterEnemyPhase;
          this.afterEnemyPhase = undefined;
          cb();
        }
      }
    }

    this.pumpLogFeed();

    if (this.debugOverlay) {
      this.debugOverlay.setText(
        `R${snap.round} PH:${snap.phase} AP:${snap.playerAP} E:${this.enemyPhaseActive} T:${this.turnRotationActive} P:${this.pendingBeginRound} LA:${snap.lastActors.length}`,
      );
    }

    if (snap.phase === 'momentum_choice') {
      this.showMomentumModal();
      return;
    }
    if (snap.phase === 'crisis') {
      if (!snap.pendingCrisis) {
        console.warn('Combat: crisis phase without a pending crisis — recovering to player phase.');
        this.refresh(this.engine.recoverPhase());
        return;
      }
      this.showCrisisModal(snap.pendingCrisis);
      return;
    }
    if ((snap.phase === 'victory' || snap.phase === 'defeat' || snap.phase === 'fled') && !this.resultShown) {
      this.resultShown = true;
      // Let the killing blow land, the HP bar drain, and the foe dissolve — then show the result.
      this.time.delayedCall(850, () => this.handleCombatEnd(snap.phase));
    }
  }

  /** Feeds newly added engine log lines to the on-screen toast queue. */
  private pumpLogFeed(): void {
    const full = this.engine.getLog();
    if (full.length <= this.shownLogCount) return;
    const fresh = full.slice(this.shownLogCount);
    this.shownLogCount = full.length;
    this.toastQueue.push(...fresh);
    this.showNextToast();
  }

  /** Shows queued log lines one at a time as brief boxed messages inside the frame's top edge. */
  private showNextToast(): void {
    if (this.toastBusy || this.toastQueue.length === 0) return;
    const line = this.toastQueue.shift()!;
    this.toastBusy = true;
    // Drop below the boss HP bar when one is on screen so the two never collide.
    const toastY = this.bossBar && this.bossBar.container.visible ? FRAME_Y + 96 : LOG_TOAST.y;
    const t = this.add
      .text(LOG_TOAST.x, toastY, line, {
        fontFamily: FONT_BODY,
        fontSize: '15px',
        color: PALETTE_HEX.bone,
        align: 'center',
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setAlpha(0);
    // Boxed presentation so the message reads cleanly over the battlefield art.
    const bg = this.add
      .rectangle(LOG_TOAST.x, toastY, Math.max(t.width + 36, 120), t.height + 14, 0x0b0d10, 0.88)
      .setStrokeStyle(1, 0xc9a24b)
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);
    this.tweens.add({
      targets: [t, bg],
      alpha: 1,
      duration: 180,
      yoyo: true,
      hold: 1500,
      onComplete: () => {
        bg.destroy();
        this.toastBusy = false;
        this.showNextToast();
      },
    });
  }

  /** Detailed combat history modal (opened from the LOG button). */
  private openLogModal(): void {
    if (this.overlayBg || this.overlayMenu || this.scanPanel) return;
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72).setInteractive().setDepth(38);
    this.overlayBg.on('pointerdown', () => this.closeOverlay());
    const lines = this.engine.getLog();
    const panel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(39);
    panel.add(this.add.rectangle(0, 0, 760, 520, 0x14171b, 0.96).setStrokeStyle(2, 0xc9a24b).setOrigin(0.5));
    panel.add(this.add.text(0, -232, 'COMBAT LOG', { fontFamily: FONT_SERIF, fontSize: '22px', color: PALETTE_HEX.gold }).setOrigin(0.5));
    const body = lines.length > 0 ? lines.join('\n') : 'Nothing has happened yet.';
    panel.add(this.add
      .text(-350, -206, body, {
        fontFamily: FONT_MONO,
        fontSize: '13px',
        color: PALETTE_HEX.bone,
        lineSpacing: 4,
        wordWrap: { width: 700 },
      })
      .setOrigin(0, 0));
    panel.add(this.add.text(0, 238, 'Click anywhere to close', { fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.boneMuted }).setOrigin(0.5));
    this.scanPanel = panel; // reuse the modal-panel cleanup path in closeOverlay
  }

  private buildActionGrid(snap: CombatSnapshot) {
    this.actionGridContainer?.destroy();
    const { player } = useGameStore.getState();
    if (!player) return;
    const inCombat = snap.phase === 'player' && !this.enemyPhaseActive && !this.transformCutscene;
    // One action per turn: the 4 verbs are usable while acting; End Turn stays
    // available afterwards to pass to the enemy phase (and is blocked mid-QTE).
    const canAct = inCombat && !this.qteActive && (!snap.actionUsed || snap.oneMore);
    const canEndTurn = inCombat && !this.qteActive;

    const items: ActionGridItem[] = [
      { id: 'attack', label: 'Attack', apCost: 0, description: 'Basic melee attack (Slash damage). QTE-timed.', disabled: !canAct, onHover: () => this.previewWindup(), onUnhover: () => this.endWindupPreview(), onClick: () => this.doAction('attack', () => this.engine.attack(this.selectedTarget ?? undefined)) },
      { id: 'skill', label: 'Skill', apCost: 0, description: 'Use one of your six techniques (offensive skills are QTE-timed).', disabled: !canAct, onHover: () => this.previewWindup(), onUnhover: () => this.endWindupPreview(), onClick: () => this.openSkillMenu() },
      { id: 'guard', label: 'Guard', apCost: 0, description: 'Take 50% less damage until your next turn, block Stagger, recover +6 MP.', disabled: !canAct, onClick: () => this.doAction('guard', () => this.engine.guard()) },
      {
        id: 'scan',
        label: 'Scan',
        apCost: 0,
        description: 'Free: open the Scan modal for the selected enemy — known weaknesses, pools, and its moves.',
        disabled: !inCombat,
        onClick: () => this.openScanModal(),
      },
      {
        id: 'item',
        label: 'Item',
        apCost: 0,
        description: 'Use an item from your inventory.',
        disabled: !canAct || player.inventory.length === 0,
        onClick: () => this.openItemMenu(),
      },
      {
        id: 'end_turn',
        label: 'End Turn',
        apCost: 0,
        description: 'End your turn and let the enemies act.',
        disabled: !canEndTurn,
        onClick: () => this.onEndTurn(),
      },
    ];

    const gridAdj = layoutAdj('actionGrid');
    this.gridHandle = createActionGrid(this, ACTION_GRID_BASE.x + gridAdj.dx, ACTION_GRID_BASE.y + gridAdj.dy, items, this.tooltipPanel!);
    this.actionGridContainer = this.gridHandle.container;
    this.gridFocus = -1;
    if (EDIT_LAYOUT) {
      this.gridHandle.container.list.forEach((o) => o.disableInteractive());
      this.setupLayoutDrag(this.gridHandle.container, 'actionGrid', ACTION_GRID_BASE, 590, 250);
    }
  }

  private openSkillMenu() {
    const { player } = useGameStore.getState();
    if (!player) return;
    const snap = this.engine.snapshot();
    if (snap.phase !== 'player' || this.enemyPhaseActive || this.transformCutscene || this.qteActive) return;
    const canAct = !snap.actionUsed || snap.oneMore;
    const activeSkills = player.skillsKnown.filter((id) => NAMED_SKILLS[id] && !NAMED_SKILLS[id].passive);

    const menuItems: ChoiceMenuItem[] = activeSkills.map((id): ChoiceMenuItem => {
      const sk = NAMED_SKILLS[id];
      const costs: string[] = [];
      if (sk.mpCost) costs.push(`${sk.mpCost} MP`);
      if (sk.hpCost?.flat) costs.push(`${sk.hpCost.flat} HP`);
      if (sk.hpCost?.pct) costs.push(`${sk.hpCost.pct}% HP`);
      const mpOk = sk.mpCost ? (player.currentMP >= sk.mpCost) : true;
      const hpOk = (sk.hpCost?.flat ?? 0) < player.currentHP && (!sk.hpCost?.pct || Math.round((sk.hpCost.pct / 100) * player.derived.maxHP) < player.currentHP);
      const hpCost = (sk.hpCost?.flat ?? 0) + (sk.hpCost?.pct ? Math.max(1, Math.round((sk.hpCost.pct / 100) * player.derived.maxHP)) : 0);
      return {
        label: sk.name,
        subtitle: `${sk.description}${sk.damageType ? ` (${sk.damageType})` : ''}${costs.length ? ` · ${costs.join(' ')}` : ''}`,
        rightLabel: [sk.damageType ? DAMAGE_TYPE_ABBREV[sk.damageType] : '', costs.join(' ')].filter(Boolean).join(' · '),
        disabled: !canAct || !mpOk || !hpOk,
        onSelect: () => { this.closeOverlay(); this.doAction('skill', () => this.engine.useSkill(id, this.selectedTarget ?? undefined), hpCost); },
      };
    });

    if (menuItems.length === 0) {
      this.tooltipPanel?.show('No techniques available.');
      return;
    }

    this.openInlineMenu(menuItems, 'SKILLS');

  }

  private doAction(type: string, fn: () => CombatSnapshot, hpCost = 0, skipTargeting = false) {
    if (this.enemyPhaseActive || this.transformCutscene || this.qteActive) return;
    try {
      audio.click();
      const before = this.engine.snapshot();
      if (!skipTargeting && TARGETED_ACTIONS.has(type) && before.enemies.filter((e) => e.alive).length > 1) {
        this.beginTargeting(type, fn, hpCost);
        return;
      }
      const prevHP = this.lastPlayerHP;
      const prevEnemyHP = new Map(before.enemies.map((e) => [e.key, e.hp]));
      const snap = fn();

      // Offensive actions park a pending QTE instead of resolving instantly: hold
      // the player (grid locked, windup pose) and wait for the timing bar.
      if (snap.qte && snap.phase === 'player') {
        this.qteActive = true;
        this.qteType = type;
        this.qteTargetKey = snap.qte.targetKey;
        this.qtePrevPlayerHP = prevHP;
        this.qtePrevEnemyHP = prevEnemyHP;
        this.qteHpCost = hpCost;
        this.refresh(snap);
        this.setPlayerPose('windup', false);
        this.qteBar = createQteBar(this, QTE_BASE.x, QTE_BASE.y, {
          slowed: snap.qte.slowed,
          resolve: (quality) => this.resolvePendingQte(quality, snap.qte!.targetKey),
        });
        return;
      }
      this.refresh(snap);
      if (this.transformCutscene) return;
      this.animateAction(type, this.selectedTarget ?? undefined, snap, prevHP, prevEnemyHP, hpCost);
      this.maybeBeginRound();
    } catch (err) {
      console.error('doAction error:', err);
      this.tooltipPanel?.show(`Error: ${err instanceof Error ? err.message : String(err)}`);
      try { this.refresh(this.engine.snapshot()); } catch (_) { /* noop */ }
    }
  }

  /** Move-first targeting: park the chosen action until an enemy is clicked. */
  private beginTargeting(type: string, fn: () => CombatSnapshot, hpCost: number) {
    this.pendingTargeted = { type, fn, hpCost };
    this.targetingMode = true;
    this.gridHandle?.setFocus(null);
    this.gridFocus = -1;
    this.tooltipPanel?.show('Choose a target — click an enemy to execute (←/→ cycle · ENTER confirm · ESC cancel)');
    this.updateTargetHighlight(this.engine.snapshot());
  }

  private confirmTargetedAction(key: string) {
    const pending = this.pendingTargeted;
    if (!pending) return;
    this.pendingTargeted = undefined;
    this.targetingMode = false;
    this.selectedTarget = key;
    this.tooltipPanel?.hide();
    this.updateTargetHighlight(this.engine.snapshot());
    this.doAction(pending.type, pending.fn, pending.hpCost, true);
  }

  private cancelTargeting() {
    if (!this.targetingMode) return;
    this.pendingTargeted = undefined;
    this.targetingMode = false;
    this.tooltipPanel?.hide();
    this.updateTargetHighlight(this.engine.snapshot());
  }

  /** Global keyboard navigation, routed by the topmost open UI layer. */
  private navMove(dir: 'up' | 'down' | 'left' | 'right'): void {
    // Scan modal: ←/→ cycle through alive enemies.
    if (this.scanPanel) {
      const cyc = this.scanCycle;
      if ((dir === 'left' || dir === 'right') && cyc && cyc.keys.length > 1) {
        cyc.index = (cyc.index + (dir === 'right' ? 1 : -1) + cyc.keys.length) % cyc.keys.length;
        audio.click();
        this.openScanModal(cyc.keys[cyc.index]);
      }
      return;
    }
    // Targeting mode: ←/→ move the reticle between alive enemies.
    if (this.targetingMode) {
      const alive = this.engine.snapshot().enemies.filter((e) => e.alive);
      if (alive.length === 0) return;
      const idx = Math.max(0, alive.findIndex((e) => e.key === this.selectedTarget));
      const next = alive[(idx + (dir === 'right' || dir === 'down' ? 1 : -1) + alive.length) % alive.length];
      this.selectedTarget = next.key;
      audio.click();
      this.updateTargetHighlight(this.engine.snapshot());
      return;
    }
    // Momentum grid: 2-column layout.
    if (this.momentumMenu) {
      const n = this.momentumButtons.length;
      if (n === 0) return;
      const cols = 2;
      let i = this.momentumFocus < 0 ? 0 : this.momentumFocus;
      if (dir === 'right') i = Math.min(n - 1, i + 1);
      else if (dir === 'left') i = Math.max(0, i - 1);
      else if (dir === 'down') i = Math.min(n - 1, i + cols);
      else i = Math.max(0, i - cols);
      this.applyMomentumFocus(i);
      return;
    }
    // Inline skill/item menu rows (skipping unusable rows).
    if (this.inlineMenu) {
      if (dir !== 'up' && dir !== 'down') return;
      const n = this.inlineRows.length;
      if (n === 0) return;
      const step = dir === 'down' ? 1 : -1;
      let i = this.inlineFocus < 0 ? (dir === 'down' ? -1 : 0) : this.inlineFocus;
      let tries = n;
      do {
        i = (i + step + n) % n;
        tries--;
      } while (tries > 0 && this.inlineRows[i].disabled);
      this.applyInlineFocus(i);
      return;
    }
    // Level-up / stat-choice modals.
    if (this.kbdModal) {
      if (dir === 'up' || dir === 'down') this.kbdModal.nav(dir);
      return;
    }
    // Choice-menu overlays (crisis / insight / victory menus).
    if (this.overlayMenu) {
      const n = this.overlayMenu.length;
      if (n === 0) return;
      if (dir !== 'up' && dir !== 'down') return;
      this.overlayFocus = this.overlayFocus < 0
        ? (dir === 'down' ? 0 : n - 1)
        : (this.overlayFocus + (dir === 'down' ? 1 : -1) + n) % n;
      this.overlayMenu.setFocused(this.overlayFocus);
      return;
    }
    // Single-button screens: arrows have nothing to move between.
    if (this.kbdSingle) return;
    // Action grid (2 columns × 3 rows), skipping unusable cells.
    if (!this.gridHandle || this.enemyPhaseActive || this.qteActive || this.transformCutscene) return;
    if (this.engine.snapshot().phase !== 'player') return;
    const count = 6;
    const cols = 2;
    let i = this.gridFocus < 0 ? 0 : this.gridFocus;
    if (dir === 'right') i = Math.floor(i / cols) * cols + ((i % cols) + 1) % cols;
    else if (dir === 'left') i = Math.floor(i / cols) * cols + ((i % cols) + cols - 1) % cols;
    else if (dir === 'down') i = Math.min(count - 1, i + cols);
    else i = Math.max(0, i - cols);
    // Only land on usable cells — hop in the travel direction until one is found.
    if (!this.gridHandle.isEnabled(i)) {
      const step = dir === 'up' || dir === 'left' ? -1 : 1;
      let tries = count;
      while (tries-- > 0 && !this.gridHandle.isEnabled(((i % count) + count) % count)) {
        i = (((i + step) % count) + count) % count;
      }
    }
    if (!this.gridHandle.isEnabled(i)) {
      this.setFocusGrid(-1);
      return;
    }
    this.setFocusGrid(i);
  }

  /** Enter/Space on the focused element of the active layer. */
  private navConfirm(): void {
    // Never act while a strike is pending, the enemy phase runs, or a cutscene plays.
    if (this.qteActive || this.enemyPhaseActive || this.transformCutscene) return;
    if (this.scanPanel) return;
    if (this.targetingMode) {
      if (this.selectedTarget) {
        audio.click();
        this.confirmTargetedAction(this.selectedTarget);
      }
      return;
    }
    if (this.momentumMenu) {
      const b = this.momentumButtons[this.momentumFocus];
      if (b) { audio.click(); b.onSelect(); }
      return;
    }
    if (this.inlineMenu) {
      const r = this.inlineRows[this.inlineFocus];
      if (r && !r.disabled) {
        audio.click();
        const sel = r.onSelect;
        this.closeInlineMenu();
        sel();
      }
      return;
    }
    // Level-up / stat-choice modals.
    if (this.kbdModal) {
      audio.click();
      this.kbdModal.confirm();
      return;
    }
    // Choice-menu overlays (crisis / insight / victory menus).
    if (this.overlayMenu) {
      const idx = this.overlayFocus >= 0 ? this.overlayFocus : 0;
      audio.click();
      this.overlayMenu.activate(idx);
      return;
    }
    // Single-button screens (victory summary Continue).
    if (this.kbdSingle) {
      audio.click();
      const go = this.kbdSingle;
      this.kbdSingle = undefined;
      go();
      return;
    }
    if (this.gridFocus >= 0 && this.gridHandle && !this.qteActive) {
      if (this.engine.snapshot().phase !== 'player') return;
      this.gridHandle.activate(this.gridFocus);
    }
  }

  private setFocusGrid(index: number): void {
    if (!this.gridHandle) { this.gridFocus = -1; return; }
    this.gridFocus = index;
    this.gridHandle.setFocus(index);
  }

  private applyInlineFocus(index: number): void {
    if (this.inlineFocus === index) return;
    const prev = this.inlineRows[this.inlineFocus];
    if (prev && !prev.disabled) {
      prev.bg.setFillStyle(0x21252a);
      prev.t.setColor('#ffffff');
      // Chip text stays bright gold in every state — dark-on-dark is unreadable.
    }
    this.inlineFocus = index;
    const cur = this.inlineRows[index];
    if (cur && !cur.disabled) {
      cur.bg.setFillStyle(0xc9a24b);
      cur.t.setColor('#0b0d10');
    }
  }

  private applyMomentumFocus(index: number): void {
    if (this.momentumFocus === index) return;
    const prev = this.momentumButtons[this.momentumFocus];
    if (prev) {
      prev.bg.setFillStyle(0x21252a);
      prev.t.setColor('#ffffff');
      prev.sub.setColor(PALETTE_HEX.boneMuted);
    }
    this.momentumFocus = index;
    const cur = this.momentumButtons[index];
    if (cur) {
      cur.bg.setFillStyle(0xc9a24b);
      cur.t.setColor('#0b0d10');
      cur.sub.setColor('#0b0d10');
    }
  }

  private updateBossBar(snap: CombatSnapshot) {
    if (!this.bossBar) return;
    const boss = snap.enemies.find((e) => e.isBoss);
    if (!boss) {
      this.bossBar.container.setVisible(false);
      return;
    }
    this.bossBar.container.setVisible(true);
    this.bossBar.update(boss.name, boss.hp, boss.maxHp);
  }

  /** Skill/item menu expanded in place over the action grid. Grows only, stays in-frame.
   *  BACK lives on a top-left arrow icon; rows carry optional right-aligned meta text. */
  private openInlineMenu(items: ChoiceMenuItem[], title: string) {
    this.closeInlineMenu();
    this.gridHandle?.setFocus(null);
    this.gridFocus = -1;
    const gridAdj = layoutAdj('actionGrid');
    const cx = ACTION_GRID_BASE.x + gridAdj.dx - 86.6;
    const cy = ACTION_GRID_BASE.y + gridAdj.dy - 19.3;
    const baseW = 409.3;
    const baseH = 182.7;
    const btnW = 368;
    const btnH = 40;
    const gap = 6;
    const headerH = 56; // title row + breathing room under it
    const rows = items.length;
    const needH = headerH + rows * btnH + Math.max(0, rows - 1) * gap + 10;
    const h = Math.max(baseH, needH);
    const w = Math.max(baseW, btnW + 36);
    const frameBottom = FRAME_Y + FRAME_H - 12;
    const menuY = Math.min(cy, frameBottom - h / 2);
    const menu = this.add.container(cx, menuY).setDepth(20);
    menu.add(this.add.rectangle(0, 0, w, h, 0x9b741e).setStrokeStyle(2, 0x0b0d10).setOrigin(0.5));
    menu.add(this.add.rectangle(0, 0, w - 6, h - 6, 0x14171b).setStrokeStyle(1.5, 0xc9a24b).setOrigin(0.5));
    menu.add(this.add.text(0, -h / 2 + 26, title, { fontFamily: FONT_SERIF, fontSize: '17px', color: PALETTE_HEX.gold }).setOrigin(0.5));
    // Back button (top-left, golden box) replaces the old bottom BACK row.
    const backBox = this.add.rectangle(-w / 2 + 20, -h / 2 + 26, 30, 30, 0xc9a24b).setStrokeStyle(2, 0x0b0d10).setOrigin(0.5);
    const backIcon = this.add.text(backBox.x, backBox.y, '←', { fontFamily: FONT_SERIF, fontSize: '18px', color: '#0b0d10' }).setOrigin(0.5);
    backBox.setInteractive({ useHandCursor: true });
    backBox.on('pointerover', () => { backBox.setFillStyle(0xe9c876); });
    backBox.on('pointerout', () => { backBox.setFillStyle(0xc9a24b); });
    backBox.on('pointerdown', () => { audio.click(); this.closeInlineMenu(); });
    menu.add(backBox);
    menu.add(backIcon);

    this.inlineRows = [];
    this.inlineFocus = -1;
    const mkRow = (y: number, item: ChoiceMenuItem) => {
      const c = this.add.container(0, y);
      const bg = this.add.rectangle(0, 0, btnW, btnH, 0x21252a).setStrokeStyle(1.5, 0xc9a24b).setOrigin(0.5);
      const t = this.add.text(-btnW / 2 + 12, 0, item.label, { fontFamily: FONT_SERIF, fontSize: '13px', color: '#ffffff', wordWrap: { width: btnW - 150 } }).setOrigin(0, 0.5);
      c.add(bg);
      c.add(t);
      let right: Phaser.GameObjects.Text | undefined;
      const rightChips: Phaser.GameObjects.Rectangle[] = [];
      if (item.rightLabel) {
        // One chip per part (element / MP cost), laid out from the right edge.
        const parts = item.rightLabel.split(' · ').filter(Boolean);
        let cursor = btnW / 2 - 14;
        for (let p = parts.length - 1; p >= 0; p--) {
          const txt = this.add.text(0, 0, parts[p], { fontFamily: FONT_MONO, fontSize: '12px', fontStyle: 'bold', color: PALETTE_HEX.goldBright });
          const chipW = txt.width + 14;
          const chipX = cursor - chipW / 2;
          const chip = this.add.rectangle(chipX, 0, chipW, 20, 0x0b0d10, 0.9).setStrokeStyle(1, 0xc9a24b, 0.8);
          txt.setPosition(chipX, 0).setOrigin(0.5, 0.5);
          rightChips.push(chip);
          c.add(chip);
          c.add(txt);
          if (!right) right = txt;
          cursor = chipX - 12; // clear gap between the element and cost chips
        }
      }
      const entry = {
        bg,
        t,
        right,
        rightChips,
        disabled: !!item.disabled,
        onSelect: item.onSelect,
        onHover: item.subtitle ? () => this.tooltipPanel?.show(item.subtitle!) : undefined,
      };
      if (entry.disabled) {
        bg.setAlpha(0.4);
        t.setAlpha(0.5);
        right?.setAlpha(0.5);
        rightChips.forEach((ch) => ch.setAlpha(0.5));
      } else {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => this.applyInlineFocus(this.inlineRows.indexOf(entry)));
        bg.on('pointerout', () => { this.applyInlineFocus(-1); this.tooltipPanel?.hide(); });
        bg.on('pointerdown', () => { audio.click(); const sel = entry.onSelect; this.closeInlineMenu(); sel(); });
      }
      this.inlineRows.push(entry);
      menu.add(c);
    };
    items.forEach((item, i) => mkRow(-h / 2 + headerH + i * (btnH + gap) + btnH / 2, item));
    this.inlineMenu = menu;
  }

  private closeInlineMenu() {
    this.inlineMenu?.destroy();
    this.inlineMenu = undefined;
    this.inlineRows = [];
    this.inlineFocus = -1;
  }

  /** Called once the timing bar reports a quality: carry the strike through the engine. */
  private resolvePendingQte(quality: QteQuality, targetKey: string) {
    if (!this.qteActive) return;
    this.qteActive = false;
    if (this.qteBar) { this.qteBar.destroy(); this.qteBar = undefined; }
    const prevHP = this.qtePrevPlayerHP;
    const prevEnemyHP = this.qtePrevEnemyHP;
    const type = this.qteType;
    const hpCost = this.qteHpCost;
    try {
      const snap = this.engine.resolveQte(quality);
      this.refresh(snap);
      if (this.transformCutscene) return;
            this.animateAction(type, targetKey, snap, prevHP, prevEnemyHP, hpCost, quality);
      if (snap.phase !== 'player' || snap.actionUsed) this.maybeBeginRound();
    } catch (err) {
      console.error('resolveQte error:', err);
      this.tooltipPanel?.show(`Error: ${err instanceof Error ? err.message : String(err)}`);
      this.recoverRoundChain();
    }
  }

  private animateAction(type: string, targetKey: string | undefined, snap: CombatSnapshot, prevPlayerHP: number, prevEnemyHP: Map<string, number>, hpCost = 0, qte?: QteQuality) {
    const display = targetKey ? this.enemyKeyMap.get(targetKey) : undefined;
    let dealtAny = false;
    const showAllEnemyDamage = () => {
      for (const e of snap.enemies) {
        const before = prevEnemyHP.get(e.key);
        if (before === undefined || before === e.hp) continue;
        const ed = this.enemyKeyMap.get(e.key);
        if (!ed) continue;
        dealtAny = true;
        if (e.hp < before) {
          const dmgColor = e.lastHitType ? (DAMAGE_TYPE_HEX[e.lastHitType] ?? PALETTE_HEX.danger) : PALETTE_HEX.danger;
          this.floatingText(ed.container.x, ed.container.y - 55, `-${before - e.hp}`, dmgColor);
          this.setEnemyPose(ed, 'hit');
          this.shakeTarget(ed.container);
          spawnHitParticles(this, ed.container.x, ed.container.y, 0xb0453f);
        } else {
          this.floatingText(ed.container.x, ed.container.y - 55, `+${e.hp - before}`, PALETTE_HEX.ok);
        }
      }
      // Impact audio follows actual damage — a missed window that still connects
      // gets the normal hit; only a true no-contact gets the miss cue.
      if (dealtAny) {
        if (qte === 'perfect') audio.critHit();
        else audio.hit();
      } else if (qte === 'miss') {
        audio.miss();
      }
    };
    this.showBanners(snap);
    const playerHealed = snap.playerHP > prevPlayerHP;
    if (playerHealed && this.statPanel) {
      spawnHealParticles(this, this.statPanel.container.x - 79, this.statPanel.container.y - 7.3);
    }
    if (snap.momentum >= 5 && this.statPanel) {
      spawnMomentumParticles(this, this.statPanel.container.x, this.statPanel.container.y + 46);
    }
    switch (type) {
      case 'attack': {
        this.setPlayerPose('attack');
        showAllEnemyDamage();
        break;
      }
      case 'skill': {
        this.setPlayerPose('attack');
        showAllEnemyDamage();
        break;
      }
      case 'resonance': {
        this.setPlayerPose('attack');
        showAllEnemyDamage();
        break;
      }
      case 'guard': {
        this.setPlayerPose('guard', false);
        if (this.statPanel) this.flashTarget(this.statPanel.container, 0x4a6fa5);
        this.floatingText(this.fxAnchor.x, this.fxAnchor.y, 'GUARD', PALETTE_HEX.player);
        break;
      }
      case 'item': {
        this.setPlayerPose('idle', false);
        if (this.statPanel) this.flashTarget(this.statPanel.container, 0x27ae60);
        const healed = snap.playerHP - prevPlayerHP;
        if (healed > 0) this.floatingText(this.fxAnchor.x, this.fxAnchor.y, `+${healed} HP`, PALETTE_HEX.ok);
        break;
      }
      case 'analyze':
      case 'scan':
      case 'probe':
      case 'deep_analyze': {
        this.setPlayerPose('idle', false);
        if (display) { this.flashTarget(display.container, 0xc9a24b); }
        if (targetKey) this.floatingText(display?.container.x ?? 640, (display?.container.y ?? ENEMY_ROW_BASE_Y) - 110, type === 'probe' ? 'INTEL GATHERED' : type === 'deep_analyze' ? 'LINES DECODED' : 'WEAKNESSES READ', PALETTE_HEX.gold);
        break;
      }
      case 'sunder': {
        this.setPlayerPose('attack');
        if (targetKey) this.floatingText(display?.container.x ?? 640, (display?.container.y ?? ENEMY_ROW_BASE_Y) - 110, 'ARMOR BROKEN', '#e67e22');
        showAllEnemyDamage();
        break;
      }
      case 'withdraw': {
        this.setPlayerPose('idle', false);
        if (settingsManager.get().screenShake) {
          this.cameras.main.shake(200, 0.005);
        }
        break;
      }
      case 'advance':
      case 'retreat':
      case 'fall_back': {
        this.setPlayerPose('idle', false);
        if (snap.playerRow) this.floatingText(this.fxAnchor.x, this.fxAnchor.y, `ROW ${snap.playerRow.toUpperCase()}`, PALETTE_HEX.gold);
        if (this.statPanel) this.flashTarget(this.statPanel.container, 0xc9a24b);
        break;
      }
      case 'charge': {
        this.setPlayerPose('attack');
        showAllEnemyDamage();
        if (snap.playerRow) this.floatingText(this.fxAnchor.x, this.fxAnchor.y, `ROW ${snap.playerRow.toUpperCase()}`, PALETTE_HEX.gold);
        break;
      }
      default: {
        showAllEnemyDamage();
        break;
      }
    }
    // HP lost beyond the skill's own cost is real damage; the cost itself is a
    // price, not a hit — never present it with the damage-taken feedback.
    const hpLost = prevPlayerHP - snap.playerHP;
    const netDamage = hpLost - hpCost;
    if (netDamage > 0 && type !== 'withdraw') {
      audio.damageTaken();
      this.setPlayerPose('hit');
      if (this.statPanel) this.flashTarget(this.statPanel.container, 0xb0453f);
      this.floatingText(this.fxAnchor.x, this.fxAnchor.y, `-${netDamage}`, PALETTE_HEX.danger);
    } else if (hpCost > 0) {
      this.floatingText(this.fxAnchor.x, this.fxAnchor.y - 26, `-${hpCost} HP (cost)`, PALETTE_HEX.player);
    }
    this.lastPlayerHP = snap.playerHP;

    // Phase 7: fatigue gasp when exhaustion crosses a band (51 soft, 76 hard).
    const fatigueCrossed = (this.lastFatigue < 51 && snap.fatigue >= 51) || (this.lastFatigue < 76 && snap.fatigue >= 76);
    if (fatigueCrossed) audio.fatigueGasp();
    this.lastFatigue = snap.fatigue;
    // Phase 7: resonance chime when Resonance climbs into a new tier mid-fight.
    if (snap.playerResonance && snap.playerResonance !== this.lastResonance && snap.playerResonance > this.lastResonance) {
      audio.resonanceChime();
    }
    this.lastResonance = snap.playerResonance ?? 0;
    // Phase 7: AP ding when tokens are gained (a natural +delta from weakness/crit/etc.).
    if (snap.playerAP > this.lastAP && this.lastAPSet) {
      audio.apDing();
    }
    this.lastAP = snap.playerAP;
    this.lastAPSet = true;
  }

  private flashTarget(container: Phaser.GameObjects.Container, color: number): void {
    const overlay = this.add.rectangle(container.x, container.y, 128, 96, color, 0.6).setDepth(10);
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 300,
      onComplete: () => overlay.destroy(),
    });
  }

  private showPlayerTexture(key: string): void {
    const sp = this.playerSprite;
    if (!sp || !this.textures.exists(key)) return;
    sp.setTexture(key);
    const frame = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const w = frame.width || 1;
    const h = frame.height || 1;
    const scale = Math.min(290 / w, 392 / h);
    sp.setDisplaySize(w * scale, h * scale);
    sp.setData('poseScaleX', sp.scaleX);
    sp.setData('poseScaleY', sp.scaleY);
  }

  private setPlayerPose(state: 'idle' | 'windup' | 'attack' | 'hit' | 'guard' | 'victory' | 'defeat', tween = true): void {
    const sp = this.playerSprite;
    if (!sp) return;
    if (state === 'windup') {
      if (this.textures.exists('player_windup')) this.showPlayerTexture('player_windup');
      this.time.delayedCall(250, () => {
        if (this.playerSprite === sp) this.setPlayerPose('attack', tween);
      });
      return;
    }
    if (!this.textures.exists(`player_${state}`)) return;
    if (state !== 'idle') this.poseLockUntil = this.time.now + (state === 'guard' ? 1300 : 700);
    this.showPlayerTexture(`player_${state}`);
    if (state === 'attack' || state === 'hit') {
      this.time.delayedCall(320, () => {
        if (this.playerSprite === sp) this.showPlayerTexture('player_idle');
      });
    } else if (state === 'guard') {
      this.time.delayedCall(1200, () => {
        if (this.playerSprite === sp) this.showPlayerTexture('player_idle');
      });
    }
    if (tween && this.playerSprite) {
      const baseScaleX = sp.getData('poseScaleX') ?? 1;
      const baseScaleY = sp.getData('poseScaleY') ?? 1;
      const zoom = state === 'idle' ? 1 : 1.06;
      const origX = sp.x;
      this.tweens.add({
        targets: sp,
        scaleX: baseScaleX * zoom,
        scaleY: baseScaleY * zoom,
        x: state === 'attack' ? origX + 14 : origX,
        duration: 110,
        yoyo: false,
        ease: 'Sine.easeOut',
        onComplete: () => {
          if (this.playerSprite === sp) {
            sp.setScale(baseScaleX, baseScaleY);
            sp.x = origX;
          }
        },
      });
    }
  }

  private previewWindup(): void {
    if (!this.playerSprite) return;
    if (this.textures.exists('player_windup')) this.showPlayerTexture('player_windup');
  }

  private endWindupPreview(): void {
    if (!this.playerSprite) return;
    if (this.time.now < this.poseLockUntil) return;
    this.showPlayerTexture('player_idle');
  }

  private setEnemyPose(display: EnemyDisplay | undefined, state: 'idle' | 'attack' | 'hit', holdMs = 300): void {
    if (!display || this.transformCutscene) return;
    display.setState(state);
    if (state !== 'idle') {
      const prev = this.enemyPoseTimers.get(display.container);
      if (prev) prev.remove();
      const t = this.time.delayedCall(holdMs, () => {
        if (this.enemyPoseTimers.get(display.container) === t) {
          this.enemyPoseTimers.delete(display.container);
          display.setState('idle');
        }
      });
      this.enemyPoseTimers.set(display.container, t);
    }
  }

  /** Small hit shake on the player sprite. */
  private shakePlayer(): void {
    const sp = this.playerSprite;
    if (!sp) return;
    const base = sp.x;
    this.tweens.add({ targets: sp, x: base - 7, duration: 45, yoyo: true, repeat: 3, onComplete: () => sp.setX(base) });
  }

  /** Argent Sentinel: the first time its HP crosses into phase 2, STOP the battle,
   *  cancel any running rotation, play the transform cutscene (transform1 → transform2 →
   *  idle2), then resume. Returns true when a cutscene started (refresh should return). */
  private checkSentinelTransform(snap: CombatSnapshot): boolean {
    if (this.sentinelTransformed || this.transformCutscene) return false;
    const idx = snap.enemies.findIndex((e) => e.defId === 'sentinel' && e.alive);
    if (idx < 0) return false;
    const view = snap.enemies[idx];
    if (view.hp / view.maxHp > 40 / 130) return false;
    this.sentinelTransformed = true;
    const disp = this.enemyDisplays[idx];
    if (!disp) return false;
    this.turnRotationTimers.forEach((t) => t.remove());
    this.turnRotationTimers = [];
    this.turnRotationActive = false;
    this.enemyPhaseActive = false;
    this.enemyPoseTimers.forEach((t) => t.remove());
    this.enemyPoseTimers.clear();
    this.transformCutscene = true;
    disp.setPhase(2);
    disp.playSequence(
      ['enemy_sentinel_transform1', 'enemy_sentinel_transform2', 'enemy_sentinel_idle2'],
      800,
      () => {
        try {
          this.transformCutscene = false;
          const after = this.engine.snapshot();
          if (after.lastActors.length > 0) this.enemyPhaseActive = true;
          this.refresh(after);
          this.maybeBeginRound();
        } catch (err) {
          console.error('Transform cutscene resume error:', err);
          this.transformCutscene = false;
          try {
            this.buildActionGrid(this.engine.snapshot());
            this.maybeBeginRound();
          } catch (_) {
            /* never leave the player locked */
          }
        }
      },
    );
    this.cameras.main.flash(220, 220, 220, 255);
    return true;
  }

  /** Player defeated: the sentinel strikes its victory pose for its current phase. */
  private playSentinelVictory(): void {
    if (this.sceneData.mode !== 'boss' || this.sceneData.bossId !== 'sentinel') return;
    const disp = this.enemyDisplays.find((d) => d.container.visible);
    if (!disp) return;
    disp.playSequence([this.sentinelTransformed ? 'enemy_sentinel_victory2' : 'enemy_sentinel_victory1'], 350);
  }

  /** Boss defeated: play its defeat1→defeat2→defeat3 sequence when the art exists,
 *  otherwise a readable fade-and-sink death beat, then continue to the aftermath. */
  private playBossDefeat(onDone: () => void): void {
    if (this.sceneData.mode !== 'boss') {
      onDone();
      return;
    }
    const disp = this.enemyDisplays.find((d) => d.defId === this.sceneData.bossId)
      ?? this.enemyDisplays.find((d) => d.container.visible);
    if (!disp) {
      onDone();
      return;
    }
    disp.container.setVisible(true);

    const frames = [
      `enemy_${disp.defId}_defeat1`,
      `enemy_${disp.defId}_defeat2`,
      `enemy_${disp.defId}_defeat3`,
    ].filter((f) => this.textures.exists(f));
    if (frames.length === 3) {
      disp.playSequence(frames, 400, onDone);
      return;
    }

    // Fallback death beat while per-boss defeat art is still pending.
    this.cameras.main.shake(200, 0.006);
    this.tweens.add({
      targets: disp.container,
      alpha: 0.22,
      y: '+=20',
      duration: 900,
      ease: 'Sine.easeIn',
      onComplete: () => onDone(),
    });
  }

  private shakeTarget(container: Phaser.GameObjects.Container, intensity = 6): void {
    const origX = container.x;
    this.tweens.add({
      targets: container,
      x: origX - intensity,
      duration: 35,
      yoyo: true,
      repeat: 3,
    });
  }

  private showBanners(snap: CombatSnapshot) {
    for (const banner of snap.banners) {
      const isCombo = banner.startsWith('COMBO');
      const isWindow = banner.startsWith('WEAKNESS WINDOW');
      const isCharge = banner.startsWith('CHARGE');
      const isUlt = banner.startsWith('ULTIMATE');
      const isAdapt = banner.startsWith('ADAPTATION');
      // Phase 7 audio cues (doc Part 18).
      if (isCombo) audio.comboDing();
      else if (isAdapt) { audio.adaptationWarning(); this.cameras.main.flash(140, 76, 10, 10); }
      else if (isWindow) audio.weaknessCrunch();
      else if (isCharge || isUlt) { audio.critHit(); this.cameras.main.flash(160, 120, 0, 0); }
      const color = isCharge ? '#c9a24b' : isUlt ? '#e1665c' : isAdapt ? '#8e5fd9' : isWindow ? '#e9c876' : isCombo ? '#9b59b6' : '#5dade2';
      const label = banner.replace(/^(COMBO |REACTION |WEAKNESS WINDOW — |CHARGE — |ULTIMATE — |ADAPTATION — )/, '');
      const title = isCharge ? 'CHARGE' : isUlt ? 'ULTIMATE' : isAdapt ? 'ADAPTATION' : isWindow ? 'WEAKNESS WINDOW' : isCombo ? 'COMBO' : 'REACTION';
      const t = this.add.text(GAME_WIDTH / 2, 170, `${title}: ${label}`, {
        fontFamily: FONT_SERIF,
        fontSize: '24px',
        color,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 700 },
      }).setOrigin(0.5).setDepth(30).setAlpha(0);
      this.tweens.add({
        targets: t,
        alpha: 1,
        duration: 200,
        yoyo: true,
        hold: 1400,
        onComplete: () => t.destroy(),
      });
    }
    this.engine.drainBanners();
  }

  private floatingText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: FONT_MONO, fontSize: '14px', color, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  private openItemMenu() {
    const { player } = useGameStore.getState();
    if (!player) return;
    const items: ChoiceMenuItem[] = player.inventory.map((entry) => ({
      label: (ITEMS[entry.id]?.name ?? entry.id) + ' x' + entry.qty,
      subtitle: ITEMS[entry.id]?.description,
      onSelect: () => {
        this.doAction('item', () => this.engine.useItem(entry.id));
      },
    }));
    this.openInlineMenu(items, 'ITEMS');
  }

  private closeOverlay() {
    this.closeInlineMenu();
    this.momentumMenu?.destroy();
    this.momentumMenu = undefined;
    this.overlayBg?.destroy();
    this.overlayMenu?.destroy();
    this.overlayTexts.forEach((t) => t.destroy());
    this.overlayTexts = [];
    this.scanPanel?.destroy();
    this.scanPanel = undefined;
    this.scanCycle = undefined;
    this.overlayFocus = -1;
    this.kbdModal = undefined;
    this.overlayBg = undefined;
    this.overlayMenu = undefined;
  }

  private openScanModal(targetKey?: string) {
    const snap = this.engine.snapshot();
    if (snap.phase !== 'player' || this.enemyPhaseActive || this.transformCutscene) return;
    const aliveKeys = snap.enemies.filter((e) => e.alive).map((e) => e.key);
    if (aliveKeys.length === 0) return;
    const key = targetKey && aliveKeys.includes(targetKey)
      ? targetKey
      : (this.selectedTarget && aliveKeys.includes(this.selectedTarget) ? this.selectedTarget : aliveKeys[0]);
    const view = snap.enemies.find((e) => e.key === key)!;
    const info = this.engine.getScanInfo(key);
    if (!view || !info) return;

    this.closeOverlay();
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setInteractive().setDepth(35);
    this.overlayBg.on('pointerdown', () => this.closeOverlay());
    this.scanCycle = { keys: aliveKeys, index: aliveKeys.indexOf(key) };

    const PANEL_W = 700;
    const PANEL_H = 430;
    const panel = this.add.container(SCAN_BASE.x, SCAN_BASE.y).setDepth(36);
    panel.add(this.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x14171b, 0.96).setStrokeStyle(2, 0xc9a24b).setOrigin(0.5));
    const LX = -PANEL_W / 2 + 16; // left column x

    // Name + level plate (top-left).
    panel.add(this.add.rectangle(LX, -PANEL_H / 2 + 14, 300, 40, 0x0b0d10).setStrokeStyle(1.5, 0xc9a24b).setOrigin(0, 0));
    panel.add(this.add.text(LX + 12, -PANEL_H / 2 + 34, view.name, { fontFamily: FONT_SERIF, fontSize: '17px', color: PALETTE_HEX.gold }).setOrigin(0, 0.5));
    panel.add(this.add.text(LX + 288, -PANEL_H / 2 + 34, `LV ${view.level}`, { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted }).setOrigin(1, 0.5));

    // MAX HP / MAX MP plates.
    const statY = -PANEL_H / 2 + 62;
    panel.add(this.add.rectangle(LX, statY, 146, 30, 0x21252c).setStrokeStyle(1, 0x3a3f46).setOrigin(0, 0));
    panel.add(this.add.text(LX + 10, statY + 15, `MAX HP  ${info.maxHp}`, { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.bone }).setOrigin(0, 0.5));
    panel.add(this.add.rectangle(LX + 154, statY, 146, 30, 0x21252c).setStrokeStyle(1, 0x3a3f46).setOrigin(0, 0));
    panel.add(this.add.text(LX + 164, statY + 15, `MAX MP  ${info.maxMp}`, { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.bone }).setOrigin(0, 0.5));

    // Affinity box — 8 chips with known results (unknown slots render dim).
    const affY = -PANEL_H / 2 + 100;
    panel.add(this.add.rectangle(LX, affY, 380, 66, 0x101317).setStrokeStyle(1, 0x3a3f46).setOrigin(0, 0));
    panel.add(this.add.text(LX + 8, affY + 10, 'AFFINITIES', { fontFamily: FONT_SERIF, fontSize: '9px', color: PALETTE_HEX.boneMuted }).setOrigin(0, 0.5));
    const chipW = 45;
    for (let i = 0; i < DAMAGE_TYPES.length; i++) {
      const t = DAMAGE_TYPES[i];
      const known = view.knownSlots.includes(t);
      const kind = known ? (view.affinities[t] ?? '-') : undefined;
      const cx = LX + 8 + i * chipW + chipW / 2;
      const cyChip = affY + 42;
      panel.add(this.add.rectangle(cx, cyChip, chipW - 4, 24, 0x21252c).setStrokeStyle(1, 0x3a3f46).setOrigin(0.5));
      panel.add(this.add.text(cx, cyChip - 6, DAMAGE_TYPE_ABBREV[t], { fontFamily: FONT_MONO, fontSize: '9px', color: PALETTE_HEX.boneMuted }).setOrigin(0.5));
      const resultText = known && kind ? kind.toUpperCase() : '?';
      const resultColor = known && kind ? `#${AFFINITY_HEX[kind].toString(16).padStart(6, '0')}` : '#555555';
      panel.add(this.add.text(cx, cyChip + 7, resultText, { fontFamily: FONT_MONO, fontSize: '11px', fontStyle: 'bold', color: resultColor }).setOrigin(0.5));
    }

    // Move pool box.
    const movesY = -PANEL_H / 2 + 174;
    const movesH = PANEL_H / 2 - 16 - movesY;
    panel.add(this.add.rectangle(LX, movesY, 380, movesH, 0x101317).setStrokeStyle(1, 0x3a3f46).setOrigin(0, 0));
    panel.add(this.add.text(LX + 10, movesY + 12, 'MOVE POOL', { fontFamily: FONT_SERIF, fontSize: '11px', color: PALETTE_HEX.gold }).setOrigin(0, 0.5));
    const maxMoves = Math.floor((movesH - 34) / 32);
    info.moves.slice(0, maxMoves).forEach((m, i) => {
      const y = movesY + 36 + i * 32;
      panel.add(this.add.text(LX + 10, y, m.label, { fontFamily: FONT_SERIF, fontSize: '13px', color: '#e0b34f', wordWrap: { width: 130 } }).setOrigin(0, 0.5));
      panel.add(this.add.text(LX + 145, y, m.description || '', { fontFamily: FONT_BODY, fontSize: '11px', color: PALETTE_HEX.boneMuted, wordWrap: { width: 225 } }).setOrigin(0, 0.5));
    });
    if (info.moves.length > maxMoves) {
      panel.add(this.add.text(LX + 10, movesY + movesH - 12, `+${info.moves.length - maxMoves} more…`, { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.boneMuted }).setOrigin(0, 0.5));
    }

    // Full-body enemy art (right column), aspect-fit in a framed box.
    const idleTex = view.defId === 'sentinel'
      ? (this.sentinelTransformed ? 'enemy_sentinel_idle2' : 'enemy_sentinel_idle1')
      : `enemy_${view.defId}_idle`;
    const tex = [idleTex, `enemy_${view.defId}_idle`, 'enemy_idle'].find((t) => t && this.textures.exists(t)) ?? 'enemy_idle';
    const portraitCx = PANEL_W / 2 - 160;
    const portraitCy = -20;
    panel.add(this.add.rectangle(portraitCx, portraitCy, 250, 280, 0x0b0d10).setStrokeStyle(1.5, 0xc9a24b).setOrigin(0.5));
    if (this.textures.exists(tex)) {
      const img = this.add.image(portraitCx, portraitCy, tex);
      const frame = this.textures.get(tex).getSourceImage();
      img.setScale(Math.min(230 / (frame.width || 1), 260 / (frame.height || 1)));
      panel.add(img);
    }

    // ◀ ▶ target cycling (only when multiple enemies stand).
    if (aliveKeys.length > 1) {
      const cycle = (dir: number) => {
        const cur = this.scanCycle!;
        cur.index = (cur.index + dir + cur.keys.length) % cur.keys.length;
        audio.click();
        this.openScanModal(cur.keys[cur.index]);
      };
      const mkArrow = (ax: number, glyph: string, dir: number) => {
        const a = this.add.text(ax, -PANEL_H / 2 + 34, glyph, { fontFamily: FONT_SERIF, fontSize: '18px', color: PALETTE_HEX.gold }).setOrigin(0.5);
        a.setInteractive({ useHandCursor: true });
        a.on('pointerover', () => a.setColor('#ffffff'));
        a.on('pointerout', () => a.setColor(PALETTE_HEX.gold));
        a.on('pointerdown', () => cycle(dir));
        panel.add(a);
      };
      mkArrow(LX + 322, '◀', -1);
      mkArrow(LX + 352, '▶', 1);
      panel.add(this.add.text(portraitCx, portraitCy + 152, '←/→ to switch target', { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.boneMuted }).setOrigin(0.5));
    }

    // Close icon (top-right corner).
    const closeIcon = this.add.text(PANEL_W / 2 - 18, -PANEL_H / 2 + 18, '✕', { fontFamily: FONT_MONO, fontSize: '16px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    closeIcon.setInteractive({ useHandCursor: true });
    closeIcon.on('pointerover', () => closeIcon.setColor('#ffffff'));
    closeIcon.on('pointerout', () => closeIcon.setColor(PALETTE_HEX.gold));
    closeIcon.on('pointerdown', () => this.closeOverlay());
    panel.add(closeIcon);

    panel.add(this.add
      .text(0, PANEL_H / 2 - 14, 'Click anywhere to close — Scan costs nothing.', { fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.boneMuted })
      .setOrigin(0.5));
    panel.setSize(PANEL_W, PANEL_H);
    this.scanPanel = panel;
  }

  private showInsightModal() {
    const snap = this.engine.snapshot();
    if (snap.phase !== 'player' || snap.insight < 3) return;
    this.overlayBg?.destroy();
    this.overlayMenu?.destroy();
    audio.momentumFull();
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setDepth(35);
    this.overlayTexts.push(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 150, 'INSIGHT — 3 SPENT', { fontFamily: FONT_SERIF, fontSize: '24px', color: PALETTE_HEX.gold }).setOrigin(0.5).setDepth(36));
    const options: Array<{ id: 'full_ai' | 'perfect_prediction' | 'focused_study' | 'weakness_window'; label: string; subtitle: string }> = [
      { id: 'full_ai', label: 'Reveal Full Patterns', subtitle: 'Deep Analysis of every enemy on the field.' },
      { id: 'perfect_prediction', label: 'Perfect Prediction', subtitle: 'Every intent becomes certain.' },
      { id: 'focused_study', label: 'Focused Study', subtitle: 'Studied enemies take +15% damage for the fight.' },
      { id: 'weakness_window', label: 'Immediate Weakness Window', subtitle: 'All enemies take +50% weakness damage for 2 rounds.' },
    ];
    this.overlayMenu = createChoiceMenu(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 60,
      options.map((o) => ({
        label: o.label,
        subtitle: o.subtitle,
        onSelect: () => {
          this.closeOverlay();
          const snap2 = this.engine.spendInsight(o.id);
          this.refresh(snap2);
          this.maybeBeginRound();
        },
      })),
      { width: 480, spacing: 58 },
    );
  }

  private showMomentumModal() {
    if (this.overlayBg || this.overlayMenu) this.closeOverlay();
    audio.momentumFull();
    const cx = FRAME_X + FRAME_W / 2;
    const cy = FRAME_Y + FRAME_H / 2;
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setDepth(35);
    this.overlayTexts.push(this.add.text(cx, FRAME_Y + 30, 'MOMENTUM', { fontFamily: FONT_SERIF, fontSize: '22px', color: PALETTE_HEX.gold }).setOrigin(0.5).setDepth(36));
    // Situational offers: the engine surfaces 3 context-weighted choices.
    const offered = this.engine.snapshot().momentumChoices;
    const choices: MomentumChoice[] = offered && offered.length > 0
      ? offered
      : ['flow', 'harmony', 'archive'];
    this.momentumButtons = [];
    this.momentumFocus = -1;
    const menu = this.add.container(cx, cy).setDepth(36);
    const btnW = 302;
    const btnH = 46;
    const gapX = 14;
    const gapY = 8;
    const cols = 2;
    const rows = Math.ceil(choices.length / cols);
    const gridW = cols * btnW + gapX;
    const gridH = rows * btnH + (rows - 1) * gapY;
    menu.add(this.add.rectangle(0, 4, gridW + 32, gridH + 52, 0x0b0d10, 0.94).setStrokeStyle(2, 0xc9a24b));
    const mkBtn = (x: number, y: number, label: string, subtitle: string, onSelect: () => void) => {
      const c = this.add.container(x, y);
      const bg = this.add.rectangle(0, 0, btnW, btnH, 0x21252a).setStrokeStyle(1.5, 0xc9a24b).setOrigin(0.5);
      const t = this.add.text(0, -9, label, { fontFamily: FONT_SERIF, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
      const sub = this.add.text(0, 10, subtitle, { fontFamily: FONT_BODY, fontSize: '9px', color: PALETTE_HEX.boneMuted, wordWrap: { width: btnW - 16 } }).setOrigin(0.5);
      c.add([bg, t, sub]);
      bg.setInteractive({ useHandCursor: true });
      const entry = { bg, t, sub, onSelect };
      this.momentumButtons.push(entry);
      bg.on('pointerover', () => this.applyMomentumFocus(this.momentumButtons.indexOf(entry)));
      bg.on('pointerout', () => this.applyMomentumFocus(-1));
      bg.on('pointerdown', () => { audio.click(); onSelect(); });
      menu.add(c);
    };
    choices.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const lastRowAlone = row === rows - 1 && choices.length % cols === 1;
      const bx = -gridW / 2 + btnW / 2 + col * (btnW + gapX) + (lastRowAlone ? (btnW + gapX) / 2 : 0);
      const by = -gridH / 2 + btnH / 2 + row * (btnH + gapY);
      mkBtn(bx, by, MOMENTUM_LABELS[c].label, MOMENTUM_LABELS[c].subtitle, () => {
        this.closeOverlay();
        const prevHP = this.lastPlayerHP;
        const snap = this.engine.resolveMomentum(c);
        this.refresh(snap);
        const healed = snap.playerHP - prevHP;
        if (healed > 0) {
          if (this.statPanel) this.flashTarget(this.statPanel.container, 0x27ae60);
          this.floatingText(this.fxAnchor.x, this.fxAnchor.y, '+' + healed + ' HP', PALETTE_HEX.ok);
        }
        this.lastPlayerHP = snap.playerHP;
        this.maybeBeginRound();
      });
    });
    this.momentumMenu = menu;
  }

  private showCrisisModal(crisis: { id: string; title: string; flavor: string; options: { id: string; label: string; subtitle: string }[] }) {
    if (this.overlayBg || this.overlayMenu) this.closeOverlay();
    this.cameras.main.flash(180, 138, 0, 0);
    if (settingsManager.get().screenShake) this.cameras.main.shake(260, 0.008);
    audio.crisis();
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78).setDepth(35);
    this.overlayTexts.push(
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 180, crisis.title, { fontFamily: FONT_SERIF, fontSize: '28px', color: PALETTE_HEX.danger }).setOrigin(0.5).setDepth(36),
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, crisis.flavor, { fontFamily: FONT_BODY, fontSize: '15px', color: PALETTE_HEX.boneMuted }).setOrigin(0.5).setDepth(36),
    );
    this.overlayMenu = createChoiceMenu(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 80,
      crisis.options.map((o) => ({
        label: o.label,
        subtitle: o.subtitle,
        onSelect: () => {
          this.closeOverlay();
          const snap = this.engine.resolveCrisis(o.id);
          this.refresh(snap);
          this.maybeBeginRound();
        },
      })),
      { width: 460, spacing: 62 },
    );
  }

  private onEndTurn() {
    if (this.enemyPhaseActive || this.transformCutscene) return;
    // Drain a deferred round start (e.g. left pending behind a closed modal) before ending this turn.
    if (this.pendingBeginRound) this.maybeBeginRound();
    try {
      const cur = this.engine.snapshot();
      if (cur.phase !== 'player') return;
      const prevHP = this.lastPlayerHP;
      const snap = this.engine.endPlayerPhase();
      this.enemyPhaseActive = true;
      this.enemyPhaseLeadIn = 650;
      this.displayedPlayerHP = prevHP;
      this.afterEnemyPhase = () => this.tryBeginRound();
      this.refresh(snap);
      this.enemyPhaseLeadIn = 0;
      this.lastPlayerHP = snap.playerHP;
    } catch (err) {
      console.error('onEndTurn error:', err);
      this.enemyPhaseActive = false;
      this.turnRotationActive = false;
      this.turnRotationTimers.forEach((t) => t.remove());
      this.turnRotationTimers = [];
      this.afterEnemyPhase = undefined;
      try {
        this.refresh(this.engine.snapshot());
      } catch (_) {
        /* never leave the player locked */
      }
    }
  }

  private beginNextRound() {
    try {
      const next = this.engine.beginRound();
      this.refresh(next);
      this.lastPlayerHP = next.playerHP;
    } catch (err) {
      console.error('beginNextRound error:', err);
      this.recoverRoundChain();
    }
  }

  /** Chain the next round once the enemy phase settles — deferred while a modal
   *  is open or while the phase isn't plain `player` (momentum/crisis will open a
   *  modal in the ongoing refresh; begin the round only after the player picks). */
  private tryBeginRound(): void {
    try {
      const snap = this.engine.snapshot();
      if (snap.phase === 'victory' || snap.phase === 'defeat' || snap.phase === 'fled') return;
      if (snap.phase !== 'player' || this.overlayMenu || this.overlayBg) {
        this.pendingBeginRound = true;
        return;
      }
      this.beginNextRound();
    } catch (err) {
      console.error('tryBeginRound error:', err);
      this.recoverRoundChain();
    }
  }

  /** Drains a deferred round start after a modal closes (momentum/crisis/insight). */
  private maybeBeginRound(): void {
    try {
      if (!this.pendingBeginRound) return;
      const snap = this.engine.snapshot();
      if (snap.phase === 'victory' || snap.phase === 'defeat' || snap.phase === 'fled') {
        this.pendingBeginRound = false;
        return;
      }
      if (this.overlayMenu || this.overlayBg) return;
      this.pendingBeginRound = false;
      this.beginNextRound();
    } catch (err) {
      console.error('maybeBeginRound error:', err);
      this.recoverRoundChain();
    }
  }

  private flashPlayerHit(): void {
    const sp = this.playerSprite;
    if (!sp) return;
    sp.setTint(0xff3b30);
    this.time.delayedCall(300, () => {
      if (this.playerSprite === sp) {
        this.playerSprite.clearTint();
        this.showPlayerTexture('player_idle');
      }
    });
  }

  /** One-time, three-line primer card. Presentation-only — no mechanics touched. */
  private showCombatPrimer(): void {
    const depth = 500;
    const cx = GAME_WIDTH / 2;
    const panel = createPanel(this, { x: cx, y: 150, width: 700, height: 210, variant: 'parchment', depth: depth });
    void panel;

    const lines: Phaser.GameObjects.Text[] = [];
    ['ONE action per turn — then END TURN.',
     'ATTACK / SKILL run a timing needle — stop it center for PERFECT (+30% dmg).',
     'SCAN is free. Hit enemies with damage types to learn weaknesses: wk Downs them and grants 1-More.',
    ].forEach((line, i) => {
      lines.push(this.add.text(cx - 310, 96 + i * 34, `•  ${line}`, {
        fontFamily: FONT_BODY,
        fontSize: '15px',
        color: PALETTE_HEX.ink,
        wordWrap: { width: 620 },
      }).setDepth(depth + 1));
    });

    const gotBtn = createButton(this, cx, 236, 'Got it', () => {
      panel.destroy();
      lines.forEach((l) => l.destroy());
      gotBtn.destroy();
    }, { width: 160, height: 42, fontSize: '15px', variant: 'primary', depth: depth + 2 });
  }

  private handleCombatEnd(phase: CombatSnapshot['phase']) {    const store = useGameStore.getState();
    const player = store.player;
    if (!player) return;

    const isFinalFight =
      this.sceneData.mode === 'boss' && this.sceneData.bossId === 'reflection';

    if (phase === 'defeat') {
      // Definitive edition: falling to the Final Reflection is not a Game Over —
      // the Loom makes an offer instead. No checkpoints, no continues.
      if (isFinalFight) {
        player.flags.final_reflection_lost = true;
        store.persist();
        audio.defeat();
        this.setPlayerPose('defeat');
        this.time.delayedCall(1400, () => fadeToScene(this, 'TheOffer'));
        return;
      }
      audio.defeat();
      this.setPlayerPose('defeat');
      this.playSentinelVictory();
      const hadCheckpoint = !!store.game?.checkpointSnapshot && (store.game?.checkpointNodeIndex ?? 0) > 0;
      this.time.delayedCall(800, () => {
        store.handleDeath();
        fadeToScene(this, hadCheckpoint ? 'Board' : 'GameOver');
      });
      return;
    }

    if (phase === 'fled') {
      store.persist();
      fadeToScene(this, 'Board');
      return;
    }

    // victory
    this.setPlayerPose('victory');

    // Definitive edition: defeating the Final Reflection has no victory screen
    // and no rewards. The power floods in — and you become the next Hollow.
    if (isFinalFight) {
      player.flags.final_reflection_defeated = true;
      player.bossesDefeated.push('reflection');
      store.commitDiscoveries(this.engine.getDiscoveryGains() as Record<string, import('@data/types').EnemyAffinities>);
      store.persist();
      this.time.delayedCall(1600, () => fadeToScene(this, 'Ending', { endingId: 'the_hollow' }));
      return;
    }

    audio.victory();
    player.enemiesKilled += this.engine.getEnemiesKilled();
    store.commitDiscoveries(this.engine.getDiscoveryGains() as Record<string, import('@data/types').EnemyAffinities>);
    store.commitBestiaryKills(this.engine.getKillsByDef());
    const xp = this.engine.getXpEarned();
    const levelsGained = store.addXp(xp);

    if (this.sceneData.mode === 'boss' && this.sceneData.bossId) {
      player.bossesDefeated.push(this.sceneData.bossId);
      store.recordCheckpoint();
      store.persist();
      this.playBossDefeat(() => {
        // Hold the death beat on screen before cutting to the aftermath.
        this.time.delayedCall(700, () => fadeToScene(this, 'Landmark', { stage: 'aftermath', bossId: this.sceneData.bossId, combatFlags: this.engine.getFlags() }));
      });
      return;
    }

    if (this.sceneData.mode === 'event' && this.sceneData.onVictory) {
      const ctx: EventApplyCtx = {
        rng: Math.random,
        setFlag: (flag) => {
          player.flags[flag] = true;
          if (!player.history.includes(flag)) player.history.push(flag);
        },
        hasFlag: (flag) => !!player.flags[flag],
        addLoreFragment: (id) => {
          if (!player.loreFragments.includes(id)) player.loreFragments.push(id);
        },
        addEchoShards: (n) => { player.echoShards += applyShardBonus(player, n); },
        addXp: (n) => { store.addXp(n); },
      };
      const text = this.sceneData.onVictory(player, ctx);
      store.persist();
      if (levelsGained > 0) {
        this.showLevelUp(player.level, () => this.showVictorySummary(text, xp));
      } else {
        this.showVictorySummary(text, xp);
      }
      return;
    }

    store.persist();
    if (levelsGained > 0) {
      this.showLevelUp(player.level, () => this.showVictorySummary(null, xp));
    } else {
      this.showVictorySummary(null, xp);
    }
  }

  private showLevelUp(newLevel: number, onDone: () => void) {
    this.closeOverlay();
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85).setDepth(35);
    const modal = showLevelUpModal(this, newLevel,
      () => {
        modal.destroy();
        this.kbdModal = undefined;
        const statModal = showStatChoiceModal(this,
          (stat) => {
            statModal.destroy();
            useGameStore.getState().awardStatPoint(stat);
            onDone();
          },
          () => { statModal.destroy(); onDone(); },
        );
        this.kbdModal = statModal;
      },
      () => {
        modal.destroy();
        this.kbdModal = undefined;
        onDone();
      },
      () => { modal.destroy(); this.kbdModal = undefined; onDone(); },
    );
    this.kbdModal = modal;
  }

  shutdown() {
    this.closeOverlay();
    this.actionGridContainer?.destroy();
    this.tooltipPanel?.destroy();
  }

  private enemyRowY(): number {
    return ENEMY_ROW_BASE_Y + layoutAdj('enemyRowY').dy;
  }

  private enemySpacingBase(n: number): number {
    return Math.min(177.3, (FRAME_W - 140) / Math.max(1, n - 1));
  }

  private enemySpacing(n: number): number {
    return this.enemySpacingBase(n) + layoutAdj('enemySpacing').dy;
  }

  private applyEnemyRow() {
    const n = this.enemyDisplays.length;
    const spacing = this.enemySpacing(n);
    const rowCenter = ENEMY_ROW_CENTER;
    const startX = rowCenter - ((n - 1) * spacing) / 2;
    const rowY = this.enemyRowY();
    this.enemyDisplays.forEach((d, i) => {
      d.container.setPosition(startX + i * spacing, rowY);
    });
    this.updateEnemyMarkers();
  }


  private updateEnemyMarkers() {
    if (!this.enemyRowMarker || !this.enemySpreadMarker) return;
    const rowCenter = ENEMY_ROW_CENTER;
    const rowY = this.enemyRowY();
    this.enemyRowMarker.setPosition(rowCenter, rowY);
    const hasSpread = this.enemyDisplays.length >= 2;
    this.enemySpreadMarker.setVisible(hasSpread);
    if (hasSpread) {
      this.enemySpreadMarker.setPosition(rowCenter, rowY + this.enemySpacing(this.enemyDisplays.length));
    }
  }

  private setupLayoutDrag(
    obj: Phaser.GameObjects.GameObject,
    key: string,
    base: { x: number; y: number },
    hitW?: number,
    hitH?: number,
  ) {
    obj.setData('layoutKey', key);
    obj.setData('layoutBase', base);
    if (hitW && hitH) {
      (obj as Phaser.GameObjects.Container).setInteractive(
        new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
        Phaser.Geom.Rectangle.Contains,
      );
    } else {
      (obj as Phaser.GameObjects.Container).setInteractive({ useHandCursor: true });
    }
    this.input.setDraggable(obj as Phaser.GameObjects.Container);
  }

  private setupLayoutEditor() {
    this.setupLayoutDrag(this.battlefieldLabelText!, 'battlefieldLabel', BATTLEFIELD_LABEL_BASE);
    this.setupLayoutDrag(this.statPanel!.container, 'statPanel', STAT_PANEL_BASE, 258.7, 106);
    this.setupLayoutDrag(this.playerRowText!, 'playerRow', PLAYER_ROW_BASE);
    this.setupLayoutDrag(this.playerSprite!, 'playerSprite', PLAYER_SPRITE_BASE);
    this.allyDisplay && this.setupLayoutDrag(this.allyDisplay.container, 'allySprite', ALLY_SPRITE_BASE, 170, 200);
    this.setupLayoutDrag(this.playerShadow!, 'playerShadow', PLAYER_SHADOW_BASE);
    this.setupLayoutDrag(this.tooltipPanel!.container, 'tooltipPanel', TOOLTIP_PANEL_BASE, 534.7, 61.2);
    this.setupLayoutDrag(this.turnOrderPanel!.container, 'turnOrder', TURN_ORDER_BASE, 135.3, 156.5);

    const rowCenter = ENEMY_ROW_CENTER;
    const rowY = this.enemyRowY();
    const spacing = this.enemySpacing(this.enemyDisplays.length);
    this.enemyRowMarker = this.add
      .rectangle(rowCenter, rowY, 16, 16, 0x00e5a0, 0.6).setDepth(60).setStrokeStyle(1, 0x000000);
    this.enemySpreadMarker = this.add
      .rectangle(rowCenter, rowY + spacing, 16, 16, 0xff9900, 0.6).setDepth(60).setStrokeStyle(1, 0x000000);
    this.fxMarker = this.add
      .rectangle(this.fxAnchor.x, this.fxAnchor.y, 16, 16, 0xff4fd8, 0.6).setDepth(60).setStrokeStyle(1, 0x000000);
    this.setupLayoutDrag(this.enemyRowMarker, 'enemyRowY', { x: rowCenter, y: ENEMY_ROW_BASE_Y });
    this.setupLayoutDrag(this.enemySpreadMarker, 'enemySpacing', { x: rowCenter, y: ENEMY_ROW_BASE_Y });
    this.setupLayoutDrag(this.fxMarker, 'fxAnchor', FX_ANCHOR_BASE);
    this.enemyDisplays.forEach((d) => d.container.list.forEach((o) => o.disableInteractive()));
    this.updateEnemyMarkers();

    this.input.on('drag', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
      const key = obj.getData('layoutKey') as string | undefined;
      if (!key) return;
      if (key === 'enemyRowY') {
        COMBAT_ADJUSTMENTS.set(key, { dx: 0, dy: dragY - ENEMY_ROW_BASE_Y });
        this.applyEnemyRow();
        return;
      }
      if (key === 'enemySpacing') {
        const rowYNow = this.enemyRowY();
        COMBAT_ADJUSTMENTS.set(key, { dx: 0, dy: dragY - rowYNow - this.enemySpacingBase(this.enemyDisplays.length) });
        this.applyEnemyRow();
        return;
      }
      if (key === 'fxAnchor') {
        COMBAT_ADJUSTMENTS.set(key, { dx: dragX - FX_ANCHOR_BASE.x, dy: dragY - FX_ANCHOR_BASE.y });
        this.fxAnchor = { x: dragX, y: dragY };
        (obj as Phaser.GameObjects.Image).setPosition(dragX, dragY);
        return;
      }
      const base = obj.getData('layoutBase') as { x: number; y: number };
      COMBAT_ADJUSTMENTS.set(key, { dx: dragX - base.x, dy: dragY - base.y });
      (obj as Phaser.GameObjects.Image).setPosition(dragX, dragY);
    });
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:fixed;top:8px;left:8px;z-index:10000;',
      'background:rgba(11,13,16,0.92);border:1px solid #c9a24b;',
      'padding:8px 10px;font:12px sans-serif;color:#c9a24b;',
      'display:flex;gap:8px;align-items:center;',
    ].join('');
    const label = document.createElement('span');
    label.textContent = 'Drag UI elements to adjust';
    const save = document.createElement('button');
    save.textContent = 'Save JSON';
    save.onclick = () => this.saveLayoutAdjustments();
    const reset = document.createElement('button');
    reset.textContent = 'Reset';
    reset.onclick = () => {
      COMBAT_ADJUSTMENTS.clear();
      this.scene.restart(this.sceneData);
    };
    const done = document.createElement('button');
    done.textContent = 'Done';
    done.onclick = () => {
      wrap.remove();
      const url = new URL(window.location.href);
      url.searchParams.delete('editlayout');
      window.history.replaceState({}, '', url.toString());
      this.scene.restart(this.sceneData);
    };
    wrap.append(label, save, reset, done);
    document.body.appendChild(wrap);
  }

  private saveLayoutAdjustments() {
    const out: { key: string; dx: number; dy: number }[] = [];
    COMBAT_ADJUSTMENTS.forEach((v, k) => {
      if (Math.abs(v.dx) > 0.05 || Math.abs(v.dy) > 0.05) {
        out.push({ key: k, dx: Math.round(v.dx * 10) / 10, dy: Math.round(v.dy * 10) / 10 });
      }
    });
    out.sort((a, b) => a.key.localeCompare(b.key));
    const payload = { stage: 'combat-ui', adjustments: out };
    console.log('[editlayout] adjustments:', JSON.stringify(payload, null, 2));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'combat_layout.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  private showVictorySummary(extraText: string | null, xp: number) {
    this.closeOverlay();
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setDepth(35);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, 'Victory', { fontFamily: FONT_SERIF, fontSize: '30px', color: PALETTE_HEX.gold }).setOrigin(0.5).setDepth(36);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, `+${xp} XP${extraText ? '\n\n' + extraText : ''}`, {
        fontFamily: FONT_SERIF,
        fontSize: '15px',
        color: PALETTE_HEX.bone,
        align: 'center',
        wordWrap: { width: 640 },
      })
      .setOrigin(0.5, 0);
    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 140, 'Continue', () => fadeToScene(this, 'Board'), { width: 220, depth: 37 });
    // Enter/Space continues from the victory screen.
    this.kbdSingle = () => fadeToScene(this, 'Board');
  }
}
