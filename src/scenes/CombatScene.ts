import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { BOSSES } from '@data/bosses';
import { ITEMS } from '@data/items';
import { NAMED_SKILLS } from '@data/skills';
import type { EventApplyCtx, PlayerState } from '@data/types';
import { CombatEngine, type CombatSnapshot, type MomentumChoice } from '@systems/CombatEngine';
import { BRAVERY_ACTIONS } from '@systems/combat/FearSystem';
import { applyShardBonus } from '@systems/EchoShardSystem';
import { maybePickWhisper } from '@systems/WhisperSystem';
import { showWhisper } from '@ui/WhisperOverlay';
import { addResonanceEffects } from '@systems/ResonanceFX';
import { createStatPanel } from '@ui/StatPanel';
import { createEnemyDisplay, createApPips, createActionBar, createSpeedBar, type EnemyDisplay, type ActionBarItem } from '@ui/CombatHUD';
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

export class CombatScene extends Phaser.Scene {
  private engine!: CombatEngine;
  private sceneData!: CombatSceneData;
  private enemyDisplays: EnemyDisplay[] = [];
  private enemyKeyMap: Map<string, EnemyDisplay> = new Map();
  private selectedTarget: string | null = null;
  private lastPlayerHP = 0;
  private statPanel?: ReturnType<typeof createStatPanel>;
  private apPips?: ReturnType<typeof createApPips>;
  private insightText?: Phaser.GameObjects.Text;
  private insightBtn?: ReturnType<typeof createButton>;
  private playerSprite?: Phaser.GameObjects.Image;
  private actionBarContainer?: Phaser.GameObjects.Container;
  private actionBarTooltip?: Phaser.GameObjects.Text;
  private logText?: Phaser.GameObjects.Text;
  private phaseLabelText?: Phaser.GameObjects.Text;
  private overlayMenu?: ChoiceMenu;
  private overlayBg?: Phaser.GameObjects.Rectangle;
  private endTurnBtn?: ReturnType<typeof createButton>;
  private speedBar?: ReturnType<typeof createSpeedBar>;
  private companionText?: Phaser.GameObjects.Text;
  private resultShown = false;

  constructor() {
    super('Combat');
  }

  create(data: CombatSceneData) {
    this.resultShown = false;
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    this.sceneData = data;
    const store = useGameStore.getState();
    const player = store.player;
    this.lastPlayerHP = player?.currentHP ?? 0;
    if (!player) {
      fadeToScene(this, 'Board');
      return;
    }
    addResonanceEffects(this, player.resonance, GAME_WIDTH, GAME_HEIGHT, { nodePulse: false, shimmer: false });

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

    const initialSnap = this.engine.beginRound();
    this.buildEnemyDisplays(initialSnap);

    this.statPanel = createStatPanel(this, 16, 585, 320);
    this.apPips = createApPips(this, 1150, 565);
    this.insightText = this.add
      .text(1150, 606, '', { fontFamily: FONT_MONO, fontSize: '13px', color: PALETTE_HEX.gold })
      .setOrigin(0.5, 0);
    this.insightBtn = createButton(this, 1150, 632, 'Study (3 INS)', () => this.showInsightModal(), {
      width: 130, height: 28, fontSize: '13px', depth: 11,
    });

    this.playerSprite = this.add.image(150, 470, 'player_idle');
    this.playerSprite.setDisplaySize(150, 128).setDepth(6);

    this.speedBar = createSpeedBar(
      this,
      GAME_WIDTH / 2,
      120,
      initialSnap.initiativeOrder,
      initialSnap.phase === 'player' ? 'player' : undefined,
      new Map(initialSnap.enemies.map((e) => [e.key, e])),
      initialSnap.playerSpd,
    );

    this.logText = this.add.text(GAME_WIDTH / 2, 582, '', {
      fontFamily: FONT_MONO,
      fontSize: '14px',
      color: PALETTE_HEX.boneMuted,
      align: 'center',
      wordWrap: { width: 600 },
      lineSpacing: 4,
    }).setOrigin(0.5, 0).setAlpha(0.85);

    this.endTurnBtn = createButton(this, 1214, GAME_HEIGHT - 150, 'End Turn', () => this.onEndTurn(), { width: 120, height: 56 });

    const whisper = maybePickWhisper(player.resonance, 'combat', Math.random);
    if (whisper) showWhisper(this, GAME_WIDTH / 2, 96, whisper.text, 600);

    this.companionText = this.add.text(16, 540, '', {
      fontFamily: FONT_MONO,
      fontSize: '13px',
      color: PALETTE_HEX.boneMuted,
      lineSpacing: 5,
    }).setDepth(9).setAlpha(0.9);

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
    const spacing = Math.max(185, Math.min(250, (GAME_WIDTH - 200) / Math.max(1, n)));
    const rowCenter = GAME_WIDTH / 2;
    const startX = rowCenter - ((n - 1) * spacing) / 2;
    snap.enemies.forEach((e, i) => {
      const disp = createEnemyDisplay(this, startX + i * spacing, 230, `tok_${e.key}`, () => {
        this.selectedTarget = e.key;
        this.updateTargetHighlight(this.engine.snapshot());
      });
      disp.update(e);
      this.enemyDisplays.push(disp);
      this.enemyKeyMap.set(e.key, disp);
    });
    if (!this.selectedTarget && snap.enemies[0]) this.selectedTarget = null;
  }

  private updateTargetHighlight(snap: CombatSnapshot) {
    this.enemyDisplays.forEach((d, i) => d.setSelected(snap.enemies[i]?.key === this.selectedTarget));
  }

  private log(lines: string[]) {
    if (!this.logText) return;
    const recent = lines.slice(-2);
    this.logText.setText(recent.join('\n'));
  }

  private refresh(snap: CombatSnapshot) {
    const { player } = useGameStore.getState();
    if (player)     this.statPanel?.update(player);
    this.apPips?.update(snap.playerAP, snap.bankedAP);
    this.insightText?.setText(`INSIGHT ${snap.insight}/3`);
    this.insightBtn?.setEnabled(snap.phase === 'player' && snap.insight >= 3);
    this.phaseLabelText?.setText(snap.bossPhaseLabel ?? '');
    if (this.selectedTarget && !snap.enemies.some((e) => e.key === this.selectedTarget)) {
      this.selectedTarget = snap.enemies[0]?.key ?? null;
    }
    if (snap.enemies.length !== this.enemyDisplays.length) {
      this.buildEnemyDisplays(snap);
    } else {
      snap.enemies.forEach((e, i) => this.enemyDisplays[i]?.update(e));
      this.updateTargetHighlight(snap);
    }
    this.buildActionBar(snap);
    this.speedBar?.update(snap.initiativeOrder, snap.phase === 'player' ? 'player' : undefined);
    this.log(snap.log);
    this.endTurnBtn?.setEnabled(snap.phase === 'player');
    this.companionText?.setText(
      snap.allies.length > 0
        ? `COMPANIONS\n${snap.allies.map((a) => `${a.name} — ${a.tier} (${a.loyalty})`).join('\n')}`
        : '',
    );

    if (snap.phase === 'momentum_choice') {
      this.showMomentumModal();
      return;
    }
    if (snap.phase === 'crisis' && snap.pendingCrisis) {
      this.showCrisisModal(snap.pendingCrisis);
      return;
    }
    if ((snap.phase === 'victory' || snap.phase === 'defeat' || snap.phase === 'fled') && !this.resultShown) {
      this.resultShown = true;
      this.time.delayedCall(400, () => this.handleCombatEnd(snap.phase));
    }
  }

  private buildActionBar(snap: CombatSnapshot) {
    this.actionBarContainer?.destroy();
    this.actionBarTooltip?.destroy();
    const { player } = useGameStore.getState();
    if (!player) return;
    const canAct = snap.phase === 'player';
    const hasFree = snap.freeActionCharges > 0;
    const canAfford = (cost: number) => hasFree || snap.playerAP >= cost;

    const items: ActionBarItem[] = [
      { id: 'attack', label: 'Attack', apCost: 1, description: 'Basic melee attack (Slash damage).', disabled: !canAct || !canAfford(1), onClick: () => this.doAction('attack', () => this.engine.attack(this.selectedTarget ?? undefined)) },
      { id: 'guard', label: 'Defend', apCost: 1, description: 'Raise your guard. Take 50% less damage until your next turn. Eases fatigue.', disabled: !canAct || !canAfford(1), onClick: () => this.doAction('guard', () => this.engine.guard()) },
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
        id: 'skill',
        label: 'Skill',
        apCost: 0,
        description: 'All skills and special actions: Resonance, Sunder, Focus, Brace, Withdraw.',
        disabled: !canAct,
        onClick: () => this.openSkillMenu(),
      },
    ];

    const sharedTooltip = this.add.text(GAME_WIDTH / 2, 520, '', {
      fontFamily: FONT_BODY, fontSize: '16px', color: PALETTE_HEX.boneMuted,
      align: 'center', wordWrap: { width: 560 },
    }).setOrigin(0.5, 0).setAlpha(0).setDepth(100);
    this.actionBarTooltip = sharedTooltip;

    const totalWidth = items.length * 156 - 8;
    const wrapper = this.add.container(444, GAME_HEIGHT - 150);
    const { container: row1 } = createActionBar(this, 0, 0, items, sharedTooltip);
    wrapper.add(row1);
    this.actionBarContainer = wrapper;
  }

  private openSkillMenu() {
    const { player } = useGameStore.getState();
    if (!player) return;
    const snap = this.engine.snapshot();
    if (snap.phase !== 'player') return;
    const hasFree = snap.freeActionCharges > 0;
    const canAfford = (cost: number) => hasFree || snap.playerAP >= cost;
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
      { width: 480, spacing: 56 },
    );
  }

  private doAction(type: string, fn: () => CombatSnapshot) {
    try {
      audio.click();
      const prevHP = this.lastPlayerHP;
      const prevEnemyHP = new Map(this.engine.snapshot().enemies.map((e) => [e.key, e.hp]));
      const snap = fn();
      this.refresh(snap);
      this.animateAction(type, this.selectedTarget ?? undefined, snap, prevHP, prevEnemyHP);
    } catch (err) {
      console.error('doAction error:', err);
      this.log([`Error: ${err instanceof Error ? err.message : String(err)}`]);
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
      spawnHealParticles(this, this.statPanel.container.x + 40, this.statPanel.container.y + 10);
    }
    if (snap.momentum >= 5 && this.statPanel) {
      spawnMomentumParticles(this, this.statPanel.container.x + 260, this.statPanel.container.y + 68);
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
        this.setPlayerPose('idle', false);
        if (this.statPanel) this.flashTarget(this.statPanel.container, 0x4a6fa5);
        this.floatingText(250, 560, 'GUARD', PALETTE_HEX.player);
        break;
      }
      case 'item': {
        this.setPlayerPose('idle', false);
        if (this.statPanel) this.flashTarget(this.statPanel.container, 0x27ae60);
        const healed = snap.playerHP - prevPlayerHP;
        if (healed > 0) this.floatingText(250, 560, `+${healed} HP`, PALETTE_HEX.ok);
        break;
      }
      case 'analyze':
      case 'scan':
      case 'probe':
      case 'deep_analyze': {
        this.setPlayerPose('idle', false);
        if (display) { this.flashTarget(display.container, 0xc9a24b); }
        if (targetKey) this.floatingText(250, 430, type === 'probe' ? 'INTEL GATHERED' : type === 'deep_analyze' ? 'LINES DECODED' : 'WEAKNESSES READ', PALETTE_HEX.gold);
        break;
      }
      case 'sunder': {
        this.setPlayerPose('attack');
        if (targetKey) this.floatingText(250, 430, 'ARMOR BROKEN', '#e67e22');
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
      this.floatingText(250, 560, `-${dmg}`, PALETTE_HEX.danger);
    }
    this.lastPlayerHP = snap.playerHP;
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

  private setPlayerPose(state: 'idle' | 'attack' | 'hit', tween = true): void {
    const sp = this.playerSprite;
    if (!sp || !this.textures.exists(`player_${state}`)) return;
    sp.setTexture(`player_${state}`);
    if (state !== 'idle') {
      this.time.delayedCall(320, () => {
        if (this.playerSprite === sp) sp.setTexture('player_idle');
      });
    }
    if (tween && this.playerSprite) {
      this.tweens.add({
        targets: sp,
        scaleX: state === 'idle' ? 1 : 1.08,
        scaleY: state === 'idle' ? 1 : 1.08,
        x: state === 'attack' ? sp.x + 14 : sp.x,
        duration: 110,
        yoyo: false,
        ease: 'Sine.easeOut',
        onComplete: () => {
          if (this.playerSprite) {
            this.playerSprite.setScale(1);
          }
        },
      });
    }
  }

  private setEnemyPose(display: EnemyDisplay | undefined, state: 'idle' | 'attack' | 'hit'): void {
    if (!display) return;
    display.setState(state);
    if (state !== 'idle') {
      this.time.delayedCall(300, () => display.setState('idle'));
    }
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
      const color = isCharge ? '#c9a24b' : isUlt ? '#e1665c' : isAdapt ? '#8e5fd9' : isWindow ? '#e9c876' : isCombo ? '#9b59b6' : '#5dade2';
      const label = banner.replace(/^(COMBO |REACTION |WEAKNESS WINDOW — |CHARGE — |ULTIMATE — |ADAPTATION — )/, '');
      const title = isCharge ? 'CHARGE' : isUlt ? 'ULTIMATE' : isAdapt ? 'ADAPTATION' : isWindow ? 'WEAKNESS WINDOW' : isCombo ? 'COMBO' : 'REACTION';
      const t = this.add.text(GAME_WIDTH / 2, 210, `${title}: ${label}`, {
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
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 150, 'INSIGHT — 3 SPENT', { fontFamily: FONT_SERIF, fontSize: '24px', color: PALETTE_HEX.gold }).setOrigin(0.5).setDepth(36);
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
        },
      })),
      { width: 480, spacing: 58 },
    );
  }

  private showMomentumModal() {
    if (this.overlayBg && this.overlayMenu) return;
    this.closeOverlay();
    audio.momentumFull();
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setDepth(35);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 170, 'MOMENTUM', { fontFamily: FONT_SERIF, fontSize: '26px', color: PALETTE_HEX.gold }).setOrigin(0.5).setDepth(36);
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
            this.floatingText(250, 560, `+${healed} HP`, PALETTE_HEX.ok);
          }
          this.lastPlayerHP = snap.playerHP;
        },
      })),
      { width: 420, spacing: 58 },
    );
  }

  private showCrisisModal(crisis: { id: string; title: string; flavor: string; options: { id: string; label: string; subtitle: string }[] }) {
    if (this.overlayBg) return;
    this.closeOverlay();
    this.cameras.main.flash(180, 138, 0, 0);
    audio.crisis();
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78).setDepth(35);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 180, crisis.title, { fontFamily: FONT_SERIF, fontSize: '28px', color: PALETTE_HEX.danger }).setOrigin(0.5).setDepth(36);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, crisis.flavor, { fontFamily: FONT_BODY, fontSize: '15px', color: PALETTE_HEX.boneMuted }).setOrigin(0.5).setDepth(36);
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
        },
      })),
      { width: 460, spacing: 62 },
    );
  }

  private onEndTurn() {
    const cur = this.engine.snapshot();
    if (cur.phase !== 'player') return;
    const prevHP = this.lastPlayerHP;
    const snap = this.engine.endPlayerPhase();
    this.refresh(snap);
    if (snap.playerHP < prevHP) {
      audio.damageTaken();
      this.setPlayerPose('hit');
      this.animateEnemyAttack(snap.playerHitEnemyKeys);
      this.flashPlayerHit();
      const dmg = prevHP - snap.playerHP;
      this.floatingText(250, 560, `-${dmg}`, PALETTE_HEX.danger);
    }
    this.lastPlayerHP = snap.playerHP;
    if (snap.phase === 'player' || (snap.phase !== 'victory' && snap.phase !== 'defeat' && snap.phase !== 'fled' && snap.phase !== 'momentum_choice')) {
      this.time.delayedCall(700, () => {
        const next = this.engine.beginRound();
        this.refresh(next);
        if (next.playerHP < this.lastPlayerHP) {
          audio.damageTaken();
          this.setPlayerPose('hit');
          this.animateEnemyAttack(next.playerHitEnemyKeys);
          this.flashPlayerHit();
          const dmg2 = this.lastPlayerHP - next.playerHP;
          this.floatingText(250, 560, `-${dmg2}`, PALETTE_HEX.danger);
        }
        this.lastPlayerHP = next.playerHP;
      });
    }
  }

  private animateEnemyAttack(attackerKeys: string[] = []): void {
    if (attackerKeys.length > 0) {
      for (const key of attackerKeys) {
        const display = this.enemyKeyMap.get(key);
        if (display) this.setEnemyPose(display, 'attack');
      }
      return;
    }
    const alive = this.enemyDisplays.find((d) => d.container.visible);
    if (alive) this.setEnemyPose(alive, 'attack');
  }

  private flashPlayerHit(): void {
    const sp = this.playerSprite;
    if (!sp) return;
    sp.setTint(0xff3b30);
    this.time.delayedCall(300, () => {
      if (this.playerSprite === sp) {
        this.playerSprite.clearTint();
        this.playerSprite.setTexture('player_idle');
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
      const hadCheckpoint = !!store.game?.checkpointSnapshot && (store.game?.checkpointPage ?? 0) > 0;
      store.handleDeath();
      fadeToScene(this, hadCheckpoint ? 'Board' : 'GameOver');
      return;
    }

    if (phase === 'fled') {
      store.persist();
      fadeToScene(this, 'Board');
      return;
    }

    // victory
    audio.victory();
    player.enemiesKilled += this.engine.getEnemiesKilled();
    store.commitArchiveGains(this.engine.getArchiveGains());
    const xp = this.engine.getXpEarned();
    const levelsGained = store.addXp(xp);

    if (this.sceneData.mode === 'boss' && this.sceneData.bossId) {
      player.bossesDefeated.push(this.sceneData.bossId);
      store.recordCheckpoint();
      store.persist();
      fadeToScene(this, 'Landmark', { stage: 'aftermath', bossId: this.sceneData.bossId, combatFlags: this.engine.getFlags() });
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
    this.actionBarContainer?.destroy();
    this.actionBarTooltip?.destroy();
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
