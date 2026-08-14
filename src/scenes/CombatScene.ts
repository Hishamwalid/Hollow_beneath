import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { BOSSES } from '@data/bosses';
import { ITEMS } from '@data/items';
import { NAMED_SKILLS } from '@data/skills';
import type { EventApplyCtx, PlayerState } from '@data/types';
import { CombatEngine, type CombatSnapshot, type MomentumChoice } from '@systems/CombatEngine';
import { BATTLEFIELD_STATES } from '@systems/combat/BattlefieldStateSystem';
import { BRAVERY_ACTIONS } from '@systems/combat/FearSystem';
import { applyShardBonus } from '@systems/EchoShardSystem';
import { maybePickWhisper } from '@systems/WhisperSystem';
import { showWhisper } from '@ui/WhisperOverlay';
import { addResonanceEffects } from '@systems/ResonanceFX';
import { createStatPanel } from '@ui/StatPanel';
import { createEnemyDisplay, createApPips, createActionGrid, createTurnOrderPanel, createTooltipPanel, createCombatLogPanel, createAllyDisplay, type EnemyDisplay, type ActionGridItem, type TooltipPanelHandle, type CombatLogPanelHandle, type AllyDisplay, ENEMY_NAME_X, ENEMY_NAME_Y } from '@ui/CombatHUD';
import { createChoiceMenu, type ChoiceMenu, type ChoiceMenuItem } from '@ui/ChoiceMenu';
import { createButton } from '@ui/Button';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX, DAMAGE_TYPE_HEX } from '@ui/uiTheme';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { settingsManager } from '@systems/SettingsManager';
import { spawnHitParticles, spawnHealParticles, spawnMomentumParticles } from '@systems/particles';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';
import { computeLevelUp } from '@systems/LevelSystem';
import { showLevelUpModal, showStatChoiceModal } from '@ui/LevelUpModal';
import combatLayoutJson from '@data/combatLayout.json';

interface CombatSceneData {
  mode: 'wild' | 'event' | 'boss';
  enemyIds?: string[];
  bossId?: string;
  page: number;
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

/** Player actions that require an explicit target when more than one enemy stands. */
const TARGETED_ACTIONS = new Set(['attack', 'scan', 'sunder', 'skill', 'resonance', 'deep_analyze']);

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
const AP_PIPS_BASE = { x: 204.3, y: 523.95 };
const INSIGHT_TEXT_BASE = { x: FRAME_RIGHT - 10, y: 185.25 };
const INSIGHT_BTN_BASE = { x: FRAME_RIGHT - 130, y: 219.25 };
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
/** Vertical combat-log strip in the right margin (frame ends at FRAME_RIGHT). */
const COMBAT_LOG_BASE = { x: 1230, y: 400 };
const COMBAT_LOG_HIT = { w: 92, h: 608 };

/** Which combat background to show: stage-1 sandy areas (pages 1–3), stone areas
 *  (page 4), or the Sentinel boss arena. Stages 2–5 keep the default dark frame. */
function combatBgKeyFor(data: CombatSceneData): string | null {
  if (data.mode === 'boss') return data.bossId === 'sentinel' ? 'bg_combat_stage1_boss' : null;
  if (data.page <= 3) return 'bg_combat_stage1_sand';
  if (data.page === 4) return 'bg_combat_stage1_stone';
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
  /** Length of the engine log at the last log render (only re-render on growth). */
  private lastLogLen = 0;
  private combatLogPanel?: CombatLogPanelHandle;
  /** `?combatdebug=1` state overlay: R{round} PH:{phase} AP E:{enemyPhaseActive} T:{turnRotationActive} P:{pendingBeginRound} LA:{lastActors}. */
  private debugOverlay?: Phaser.GameObjects.Text;
  private lastAP = 0;
  private lastAPSet = false;
  private statPanel?: ReturnType<typeof createStatPanel>;
  private apPips?: ReturnType<typeof createApPips>;
  private insightText?: Phaser.GameObjects.Text;
  private insightBtn?: ReturnType<typeof createButton>;
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

  constructor() {
    super('Combat');
  }

  create(data: CombatSceneData) {
    this.resultShown = false;
    this.sentinelTransformed = false;
    this.transformCutscene = false;
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
      page: data.page,
      rng: Math.random,
      bossDef,
      precombatFlags: data.precombatFlags,
      playerHistory: new Set(player.history),
      allies: player.companions ?? [],
      difficulty: settingsManager.get().difficulty,
      enemyArchive: store.meta.enemyArchive,
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

    const spAdj = layoutAdj('statPanel');
    this.statPanel = createStatPanel(this, STAT_PANEL_BASE.x + spAdj.dx, STAT_PANEL_BASE.y + spAdj.dy);
    const prAdj = layoutAdj('playerRow');
    this.playerRowText = this.add
      .text(PLAYER_ROW_BASE.x + prAdj.dx, PLAYER_ROW_BASE.y + prAdj.dy, '', { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.gold })
      .setOrigin(1, 0.5)
      .setDepth(10);
    const apAdj = layoutAdj('apPips');
    this.apPips = createApPips(this, AP_PIPS_BASE.x + apAdj.dx, AP_PIPS_BASE.y + apAdj.dy);
    const itAdj = layoutAdj('insightText');
    this.insightText = this.add
      .text(INSIGHT_TEXT_BASE.x + itAdj.dx, INSIGHT_TEXT_BASE.y + itAdj.dy, '', { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.gold })
      .setOrigin(1, 0.5)
      .setDepth(10);
    const ibAdj = layoutAdj('insightBtn');
    this.insightBtn = createButton(this, INSIGHT_BTN_BASE.x + ibAdj.dx, INSIGHT_BTN_BASE.y + ibAdj.dy, 'Study (3 INS)', () => this.showInsightModal(), {
      width: 130, height: 28, fontSize: '13px', depth: 11,
    });

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
    const clAdj = layoutAdj('combatLog');
    this.combatLogPanel = createCombatLogPanel(this, COMBAT_LOG_BASE.x + clAdj.dx, COMBAT_LOG_BASE.y + clAdj.dy);
    const toAdj = layoutAdj('turnOrder');
    this.turnOrderPanel = createTurnOrderPanel(this, TURN_ORDER_BASE.x + toAdj.dx, TURN_ORDER_BASE.y + toAdj.dy);

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
        this.selectedTarget = e.key;
        this.updateTargetHighlight(this.engine.snapshot());
      });
      disp.update(e);
      this.placeEnemyName(disp);
      if (EDIT_LAYOUT) {
        const pillAdj = layoutAdj('enemyNamePill');
        disp.nameGroup.setData('pillBase', {
          x: disp.nameGroup.x + pillAdj.dx,
          y: disp.nameGroup.y + pillAdj.dy,
        });
        this.setupLayoutDrag(
          disp.nameGroup,
          'enemyName',
          {
            x: disp.container.x + ENEMY_NAME_X + layoutAdj('enemyName').dx,
            y: disp.container.y + ENEMY_NAME_Y + layoutAdj('enemyName').dy,
          },
          140,
          60,
        );
      }
      this.enemyDisplays.push(disp);
      this.enemyKeyMap.set(e.key, disp);
    });
    if (!this.selectedTarget && snap.enemies[0]) this.selectedTarget = null;
    this.updateEnemyMarkers();
  }

  private updateTargetHighlight(snap: CombatSnapshot) {
    this.enemyDisplays.forEach((d, i) => d.setSelected(snap.enemies[i]?.key === this.selectedTarget));
  }

  private shortTurnName(name: string): string {
    let n = name.replace(/^The /, '').trim();
    if (n.length > 13) n = `${n.slice(0, 12)}…`;
    return n;
  }

  private turnOrderNames(snap: CombatSnapshot): Map<string, string> {
    const names = new Map<string, string>();
    names.set('player', 'Player');
    for (const e of snap.enemies) names.set(e.key, this.shortTurnName(e.name));
    for (const a of snap.allies) names.set(`ally_${a.id}`, this.shortTurnName(a.name));
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
      if (this.enemyPhaseActive && this.displayedPlayerHP > 0 && this.displayedPlayerHP !== player.currentHP) {
        this.statPanel?.update({ ...player, currentHP: this.displayedPlayerHP });
      } else {
        this.displayedPlayerHP = player.currentHP;
        this.statPanel?.update(player);
      }
    }
    this.playerRowText?.setText(snap.playerRow ? `ROW: ${snap.playerRow.toUpperCase()}` : '');
    this.apPips?.update(snap.playerAP, snap.bankedAP);
    if (snap.round !== this.lastRenderedRound) {
      this.lastRenderedRound = snap.round;
      if (snap.apPenalty > 0 && this.apPips) {
        this.floatingText(
          this.apPips.container.x,
          this.apPips.container.y - 32,
          `-${snap.apPenalty} AP (${snap.apPenaltyLabel ?? 'Fatigue'})`,
          PALETTE_HEX.danger,
        );
      }
    }
    this.insightText?.setText(`INSIGHT ${snap.insight}/3`);
    this.insightBtn?.setEnabled(snap.phase === 'player' && !this.enemyPhaseActive && !this.transformCutscene && snap.insight >= 3);
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
    if (snap.enemies.length !== this.enemyDisplays.length) {
      this.buildEnemyDisplays(snap);
    } else {
      snap.enemies.forEach((e, i) => this.enemyDisplays[i]?.update(e));
      this.updateTargetHighlight(snap);
    }
    this.checkSentinelTransform(snap);
    this.buildActionGrid(snap);
    if (this.transformCutscene) return;
    this.allyDisplay?.container.setVisible(snap.allies.length > 0);
    if (snap.lastActors.length > 0) {
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

    this.renderCombatLog();

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
      this.time.delayedCall(400, () => this.handleCombatEnd(snap.phase));
    }
  }

  /** Pushes the newest combat-log lines into the right-margin log panel (renders only on growth). */
  private renderCombatLog(): void {
    const snap = this.lastSnap;
    if (!snap) return;
    if (snap.log.length === this.lastLogLen) return;
    this.lastLogLen = snap.log.length;
    this.combatLogPanel?.update(snap.log);
  }

  private buildActionGrid(snap: CombatSnapshot) {
    this.actionGridContainer?.destroy();
    const { player } = useGameStore.getState();
    if (!player) return;
    const canAct = snap.phase === 'player' && !this.enemyPhaseActive && !this.transformCutscene;
    const hasFree = snap.freeActionCharges > 0;
    const canAfford = (cost: number) => hasFree || snap.playerAP >= cost;

    const items: ActionGridItem[] = [
      { id: 'attack', label: 'Attack', apCost: 1, description: 'Basic melee attack (Slash damage).', disabled: !canAct || !canAfford(1), onHover: () => this.previewWindup(), onUnhover: () => this.endWindupPreview(), onClick: () => this.doAction('attack', () => this.engine.attack(this.selectedTarget ?? undefined)) },
      { id: 'skill', label: 'Skill', apCost: 0, description: 'All skills and special actions: Resonance, Sunder, Focus, Brace, Withdraw.', disabled: !canAct, onHover: () => this.previewWindup(), onUnhover: () => this.endWindupPreview(), onClick: () => this.openSkillMenu() },
      { id: 'guard', label: 'Guard', apCost: 1, description: 'Raise your guard. Take 50% less damage until your next turn. Eases fatigue.', disabled: !canAct || !canAfford(1), onClick: () => this.doAction('guard', () => this.engine.guard()) },
      {
        id: 'scan',
        label: 'Scan',
        apCost: 1,
        description: 'Scan the target (1 AP): reveals weaknesses, tendency, and a sense of what it intends.',
        disabled: !canAct || !canAfford(1),
        onClick: () => this.doAction('scan', () => this.engine.analyze(this.selectedTarget ?? undefined)),
      },
      {
        id: 'item',
        label: 'Item',
        apCost: 1,
        description: 'Use an item from your inventory.',
        disabled: !canAct || !canAfford(1) || player.inventory.length === 0,
        onClick: () => this.openItemMenu(),
      },
      {
        id: 'end_turn',
        label: 'End Turn',
        apCost: 0,
        description: 'End your turn and let the enemies act.',
        disabled: !canAct,
        onClick: () => this.onEndTurn(),
      },
    ];

    const gridAdj = layoutAdj('actionGrid');
    const { container } = createActionGrid(this, ACTION_GRID_BASE.x + gridAdj.dx, ACTION_GRID_BASE.y + gridAdj.dy, items, this.tooltipPanel!);
    this.actionGridContainer = container;
    if (EDIT_LAYOUT) {
      container.list.forEach((o) => o.disableInteractive());
      this.setupLayoutDrag(container, 'actionGrid', ACTION_GRID_BASE, 590, 250);
    }
  }

  private openSkillMenu() {
    const { player } = useGameStore.getState();
    if (!player) return;
    const snap = this.engine.snapshot();
    if (snap.phase !== 'player') return;
    const hasFree = snap.freeActionCharges > 0;
    const canAfford = (cost: number) => hasFree || snap.playerAP >= cost;
    const canAct = snap.phase === 'player';
    const resonanceCost = player.skillsKnown.includes('resonant_study') ? 1 : 3;
    const activeSkills = player.skillsKnown.filter((id) => (NAMED_SKILLS[id]?.apCost ?? 0) > 0);
    const targetView = snap.enemies.find((e) => e.key === this.selectedTarget);
    const targetLayer = targetView?.investigationLayer ?? 0;
    const targetProbes = targetView?.investigationProbes.length ?? 0;

    const menuItems: ChoiceMenuItem[] = [
      ...activeSkills.map((id): ChoiceMenuItem => {
        const sk = NAMED_SKILLS[id];
        const mpDesc = sk.mpCost ? ` | MP: ${sk.mpCost}` : '';
        const mpOk = sk.mpCost ? (player.currentMP >= sk.mpCost) : true;
        const disabled = !canAfford(sk.apCost) || !mpOk;
        return {
          label: `${sk.name} (${sk.apCost} AP)`,
          subtitle: `${sk.description}${sk.damageType ? ` (${sk.damageType})` : ''}${mpDesc}`,
          disabled,
          onSelect: () => { this.closeOverlay(); this.doAction('skill', () => this.engine.useSkill(id, this.selectedTarget ?? undefined)); },
        };
      }),
      {
        label: `Resonance (${resonanceCost} AP)`,
        subtitle: `Shadow burst. Needs 25 Resonance, 10 MP, -1 Resonance.`,
        disabled: !canAfford(resonanceCost) || player.resonance < 25 || player.currentMP < 10,
        onSelect: () => { this.closeOverlay(); this.doAction('resonance', () => this.engine.resonanceAbility(this.selectedTarget ?? undefined)); },
      },
      { label: 'Sunder (2 AP)', subtitle: 'Sunder an enemy: reduce its Defense by 50% for 2 turns.', disabled: !canAfford(2), onSelect: () => { this.closeOverlay(); this.doAction('sunder', () => this.engine.sunder(this.selectedTarget ?? undefined)); } },
      { label: 'Archive: Expose Weakness (2 AP)', subtitle: 'Turn a fully-catalogued foe\'s catalogue against it: +20% damage for 2 turns.', disabled: !canAfford(2) || !(targetView?.archiveExploited ?? false), onSelect: () => { this.closeOverlay(); this.doAction('sunder', () => this.engine.archiveExpose(this.selectedTarget ?? undefined)); } },
      { label: 'Probe (1 AP)', subtitle: 'Focused intel: Observe Body / Mind / Weapon / Memory / Resonance / Behavior. Requires a Scan.', disabled: !canAfford(1) || targetLayer < 1, onSelect: () => { this.closeOverlay(); this.openProbeMenu(); } },
      { label: 'Deep Analysis (2 AP)', subtitle: 'Full move pool, exact rules, hidden notes. Requires at least one Probe.', disabled: !canAfford(2) || targetProbes < 1, onSelect: () => { this.closeOverlay(); this.doAction('deep_analyze', () => this.engine.deepAnalyze(this.selectedTarget ?? undefined)); } },
      { label: 'Focus (1 AP)', subtitle: 'Regain 15 MP and gain +1 Momentum.', disabled: !canAfford(1), onSelect: () => { this.closeOverlay(); this.doAction('focus', () => this.engine.focus()); } },
      { label: 'Brace (1 AP)', subtitle: 'Guard blocks 20% more damage for 2 turns.', disabled: !canAfford(1), onSelect: () => { this.closeOverlay(); this.doAction('brace', () => this.engine.brace()); } },
      ...(snap.fear > 50
        ? BRAVERY_ACTIONS.map((b): ChoiceMenuItem => ({
            label: `${b.label} (${b.apCost} AP)`,
            subtitle: b.detail,
            disabled: !canAfford(b.apCost),
            onSelect: () => { this.closeOverlay(); this.doAction('bravery', () => this.engine.resolveBravery(b.id)); },
          }))
        : []),
      { label: 'Withdraw (2 AP)', subtitle: 'Attempt to flee. Speed-based success chance.', disabled: !canAfford(2), onSelect: () => { this.closeOverlay(); this.doAction('withdraw', () => this.engine.withdraw()); } },
      // Phase 6b repositioning
      { label: 'Advance (free)', subtitle: 'Step one row toward the front: +15% damage, but you take 10% more.', disabled: !canAct, onSelect: () => { this.closeOverlay(); this.doAction('advance', () => this.engine.advance()); } },
      { label: 'Retreat (free)', subtitle: 'Step one row back: -10% damage, shields 15%, +10 dodge.', disabled: !canAct, onSelect: () => { this.closeOverlay(); this.doAction('retreat', () => this.engine.retreat()); } },
      { label: 'Charge (1 AP)', subtitle: 'Surge two rows forward, striking as you go.', disabled: !canAfford(1), onSelect: () => { this.closeOverlay(); this.doAction('charge', () => this.engine.charge()); } },
      { label: 'Fall Back (1 AP)', subtitle: 'Drop two rows back and raise your guard.', disabled: !canAfford(1), onSelect: () => { this.closeOverlay(); this.doAction('fall_back', () => this.engine.fallBack()); } },
    ];

    this.overlayBg?.destroy();
    this.overlayMenu?.destroy();
this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setInteractive().setDepth(35);
    this.overlayBg.on('pointerdown', () => this.closeOverlay());
    this.overlayMenu = createChoiceMenu(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      menuItems,
      { width: 520, spacing: 56 },
    );
    this.previewWindup();
  }

  private doAction(type: string, fn: () => CombatSnapshot) {
    if (this.enemyPhaseActive || this.transformCutscene) return;
    try {
      audio.click();
      const before = this.engine.snapshot();
      if (TARGETED_ACTIONS.has(type) && !this.selectedTarget && before.enemies.filter((e) => e.alive).length > 1) {
        this.tooltipPanel?.show('Click an enemy to select your target first');
        return;
      }
      const prevHP = this.lastPlayerHP;
      const prevEnemyHP = new Map(before.enemies.map((e) => [e.key, e.hp]));
      const snap = fn();
      this.refresh(snap);
      if (this.transformCutscene) return;
      this.animateAction(type, this.selectedTarget ?? undefined, snap, prevHP, prevEnemyHP);
      this.maybeBeginRound();
    } catch (err) {
      console.error('doAction error:', err);
      this.tooltipPanel?.show(`Error: ${err instanceof Error ? err.message : String(err)}`);
      try { this.refresh(this.engine.snapshot()); } catch (_) { /* noop */ }
    }
  }

  private animateAction(type: string, targetKey: string | undefined, snap: CombatSnapshot, prevPlayerHP: number, prevEnemyHP: Map<string, number>) {
    const display = targetKey ? this.enemyKeyMap.get(targetKey) : undefined;
    const showAllEnemyDamage = () => {
      for (const e of snap.enemies) {
        const before = prevEnemyHP.get(e.key);
        if (before === undefined || before === e.hp) continue;
        const ed = this.enemyKeyMap.get(e.key);
        if (!ed) continue;
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
    if (snap.playerHP < prevPlayerHP && type !== 'withdraw') {
      audio.damageTaken();
      this.setPlayerPose('hit');
      if (this.statPanel) this.flashTarget(this.statPanel.container, 0xb0453f);
      const dmg = prevPlayerHP - snap.playerHP;
      this.floatingText(this.fxAnchor.x, this.fxAnchor.y, `-${dmg}`, PALETTE_HEX.danger);
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

  /** Player victorious: play the sentinel's defeat animation, then continue. */
  private playSentinelDefeat(onDone: () => void): void {
    if (this.sceneData.bossId !== 'sentinel') {
      onDone();
      return;
    }
    const disp = this.enemyDisplays.find((d) => d.defId === 'sentinel');
    if (!disp) {
      onDone();
      return;
    }
    disp.container.setVisible(true);
    disp.nameGroup.setVisible(true);
    disp.playSequence(['enemy_sentinel_defeat1', 'enemy_sentinel_defeat2', 'enemy_sentinel_defeat3'], 400, onDone);
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
    this.overlayBg?.destroy();
    this.overlayMenu?.destroy();
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setInteractive().setDepth(35);
    this.overlayBg.on('pointerdown', () => this.closeOverlay());
    this.overlayMenu = createChoiceMenu(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - player.inventory.length * 28,
      player.inventory.map((entry) => ({
        label: `${ITEMS[entry.id]?.name ?? entry.id} x${entry.qty}`,
        subtitle: ITEMS[entry.id]?.description,
        onSelect: () => {
          this.closeOverlay();
          this.doAction('item', () => this.engine.useItem(entry.id));
        },
      })),
      { width: 420, spacing: 56 },
    );
  }

  private closeOverlay() {
    this.overlayBg?.destroy();
    this.overlayMenu?.destroy();
    this.overlayTexts.forEach((t) => t.destroy());
    this.overlayTexts = [];
    this.overlayBg = undefined;
    this.overlayMenu = undefined;
  }

  private openProbeMenu() {
    const snap = this.engine.snapshot();
    if (snap.phase !== 'player' || !this.selectedTarget) return;
    const target = this.selectedTarget;
    this.overlayBg?.destroy();
    this.overlayMenu?.destroy();
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setInteractive().setDepth(35);
    this.overlayBg.on('pointerdown', () => this.closeOverlay());
    const probes: Array<{ id: string; label: string; subtitle: string }> = [
      { id: 'observe_body', label: 'Observe Body', subtitle: 'Exact stats and every damage multiplier.' },
      { id: 'observe_mind', label: 'Observe Mind', subtitle: 'Pattern, tendency triggers, phase timing.' },
      { id: 'observe_weapon', label: 'Observe Weapon', subtitle: 'Attack type and next move in detail.' },
      { id: 'observe_memory', label: 'Observe Memory', subtitle: 'Lore and weakness hints.' },
      { id: 'observe_resonance', label: 'Observe Resonance', subtitle: 'Boss phase thresholds.' },
      { id: 'observe_behavior', label: 'Observe Behavior', subtitle: 'Full action pool and tells.' },
    ];
    this.overlayMenu = createChoiceMenu(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      probes.map((p) => ({
        label: p.label,
        subtitle: p.subtitle,
        onSelect: () => {
          this.closeOverlay();
          this.doAction('probe', () => this.engine.probe(target, p.id));
        },
      })),
      { width: 460, spacing: 56 },
    );
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
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setDepth(35);
    this.overlayTexts.push(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 170, 'MOMENTUM', { fontFamily: FONT_SERIF, fontSize: '26px', color: PALETTE_HEX.gold }).setOrigin(0.5).setDepth(36));
    const choices: MomentumChoice[] = ['flow', 'harmony', 'archive', 'forgotten_technique', 'unravel', 'echo_surge', 'phase_shift', 'desperate_strike', 'overclock'];
    this.overlayMenu = createChoiceMenu(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 90,
      choices.map((c) => ({
        label: MOMENTUM_LABELS[c].label,
        subtitle: MOMENTUM_LABELS[c].subtitle,
        onSelect: () => {
          this.closeOverlay();
          const prevHP = this.lastPlayerHP;
          const snap = this.engine.resolveMomentum(c);
          this.refresh(snap);
          const healed = snap.playerHP - prevHP;
          if (healed > 0) {
            if (this.statPanel) this.flashTarget(this.statPanel.container, 0x27ae60);
            this.floatingText(this.fxAnchor.x, this.fxAnchor.y, `+${healed} HP`, PALETTE_HEX.ok);
          }
          this.lastPlayerHP = snap.playerHP;
          this.maybeBeginRound();
        },
      })),
      { width: 420, spacing: 58 },
    );
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
      const prevHP = this.lastPlayerHP;
      const next = this.engine.beginRound();
      if (next.lastActors.length > 0) {
        this.enemyPhaseActive = true;
        this.enemyPhaseLeadIn = 0;
        this.displayedPlayerHP = prevHP;
        this.afterEnemyPhase = undefined;
      }
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

  private handleCombatEnd(phase: CombatSnapshot['phase']) {
    const store = useGameStore.getState();
    const player = store.player;
    if (!player) return;

    // Phase 5: companions carry their loyalty / cooldowns out of the fight.
    player.companions = this.engine.getAllyStates();

    if (phase === 'defeat') {
      audio.defeat();
      this.setPlayerPose('defeat');
      this.playSentinelVictory();
      const hadCheckpoint = !!store.game?.checkpointSnapshot && (store.game?.checkpointPage ?? 0) > 0;
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
    audio.victory();
    this.setPlayerPose('victory');
    player.enemiesKilled += this.engine.getEnemiesKilled();
    store.commitArchiveGains(this.engine.getArchiveGains());
    const xp = this.engine.getXpEarned();
    const levelsGained = store.addXp(xp);

    if (this.sceneData.mode === 'boss' && this.sceneData.bossId) {
      player.bossesDefeated.push(this.sceneData.bossId);
      store.recordCheckpoint();
      store.persist();
      this.playSentinelDefeat(() => {
        fadeToScene(this, 'Landmark', { stage: 'aftermath', bossId: this.sceneData.bossId, combatFlags: this.engine.getFlags() });
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
        showStatChoiceModal(this,
          (stat) => {
            useGameStore.getState().awardStatPoint(stat);
            onDone();
          },
          () => { modal.destroy(); onDone(); },
        );
      },
      () => {
        modal.destroy();
        useGameStore.getState().awardSkillPoint();
        onDone();
      },
      () => { modal.destroy(); onDone(); },
    );
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
      this.placeEnemyName(d);
    });
    this.updateEnemyMarkers();
  }

  private placeEnemyName(d: EnemyDisplay) {
    d.nameGroup.setPosition(
      d.container.x + ENEMY_NAME_X + layoutAdj('enemyName').dx,
      d.container.y + ENEMY_NAME_Y + layoutAdj('enemyName').dy,
    );
    d.namePill.setPosition(layoutAdj('enemyNamePill').dx, layoutAdj('enemyNamePill').dy);
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
    this.setupLayoutDrag(this.apPips!.container, 'apPips', AP_PIPS_BASE, 184.7, 32.7);
    this.setupLayoutDrag(this.insightText!, 'insightText', INSIGHT_TEXT_BASE);
    this.setupLayoutDrag(this.insightBtn!.container, 'insightBtn', INSIGHT_BTN_BASE, 130, 28);
    this.insightBtn!.container.list.forEach((o) => o.disableInteractive());
    this.setupLayoutDrag(this.playerSprite!, 'playerSprite', PLAYER_SPRITE_BASE);
    this.allyDisplay && this.setupLayoutDrag(this.allyDisplay.container, 'allySprite', ALLY_SPRITE_BASE, 170, 200);
    this.setupLayoutDrag(this.playerShadow!, 'playerShadow', PLAYER_SHADOW_BASE);
    this.setupLayoutDrag(this.tooltipPanel!.container, 'tooltipPanel', TOOLTIP_PANEL_BASE, 534.7, 61.2);
    this.combatLogPanel && this.setupLayoutDrag(this.combatLogPanel.container, 'combatLog', COMBAT_LOG_BASE, COMBAT_LOG_HIT.w, COMBAT_LOG_HIT.h);
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
      if (key === 'enemyName') {
        const p = _p as Phaser.Input.Pointer;
        const pillW = this.enemyDisplays[0]?.namePill.width ?? 40;
        const gx = p.x - (obj as Phaser.GameObjects.Container).x;
        const gy = p.y - (obj as Phaser.GameObjects.Container).y;
        if (Math.abs(gx) <= pillW / 2 + 6 && Math.abs(gy) <= 14) {
          const base = obj.getData('pillBase') as { x: number; y: number };
          COMBAT_ADJUSTMENTS.set('enemyNamePill', { dx: p.x - base.x, dy: p.y - base.y });
        } else {
          const base = obj.getData('layoutBase') as { x: number; y: number };
          COMBAT_ADJUSTMENTS.set(key, { dx: p.x - base.x, dy: p.y - base.y });
        }
        this.enemyDisplays.forEach((d) => this.placeEnemyName(d));
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
  }
}
