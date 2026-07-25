import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { BOSSES } from '@data/bosses';
import { ITEMS } from '@data/items';
import { NAMED_SKILLS } from '@data/skills';
import type { EventApplyCtx, PlayerState } from '@data/types';
import { CombatEngine, type CombatSnapshot, type MomentumChoice } from '@systems/CombatEngine';
import { applyShardBonus } from '@systems/EchoShardSystem';
import { maybePickWhisper } from '@systems/WhisperSystem';
import { showWhisper, applyResonanceTint } from '@ui/WhisperOverlay';
import { createStatPanel } from '@ui/StatPanel';
import { createEnemyDisplay, createApPips, createActionBar, type EnemyDisplay } from '@ui/CombatHUD';
import { createChoiceMenu, type ChoiceMenu } from '@ui/ChoiceMenu';
import { createButton } from '@ui/Button';
import { FONT_MONO, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

interface CombatSceneData {
  mode: 'wild' | 'event' | 'boss';
  enemyIds?: string[];
  bossId?: string;
  page: number;
  precombatFlags?: Record<string, number>;
  onVictory?: (player: PlayerState, ctx: EventApplyCtx) => string;
}

const MOMENTUM_LABELS: Record<MomentumChoice, { label: string; subtitle: string }> = {
  extra_turn: { label: 'Extra Turn', subtitle: 'Act again immediately' },
  chorus_heal: { label: 'Chorus Heal', subtitle: '+20% Max HP now' },
  clarity: { label: 'Clarity', subtitle: '+30% Max MP now' },
  forgotten_technique: { label: 'Forgotten Technique', subtitle: 'Next action costs 0 AP' },
  unravel: { label: 'Unravel', subtitle: 'Next hit: 2.0x dmg, ignore 50% Def' },
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
  private actionBarContainer?: Phaser.GameObjects.Container;
  private logText?: Phaser.GameObjects.Text;
  private phaseLabelText?: Phaser.GameObjects.Text;
  private overlayMenu?: ChoiceMenu;
  private overlayBg?: Phaser.GameObjects.Rectangle;
  private endTurnBtn?: ReturnType<typeof createButton>;
  private resultShown = false;

  constructor() {
    super('Combat');
  }

  create(data: CombatSceneData) {
    this.resultShown = false;
    this.cameras.main.setBackgroundColor(0x0b0d10);
    this.sceneData = data;
    const store = useGameStore.getState();
    const player = store.player;
    this.lastPlayerHP = player?.currentHP ?? 0;
    if (!player) {
      this.scene.start('Board');
      return;
    }
    applyResonanceTint(this, player.resonance, GAME_WIDTH, GAME_HEIGHT);

    const bossDef = data.mode === 'boss' && data.bossId ? BOSSES[data.bossId] : undefined;
    this.engine = new CombatEngine({
      player,
      enemyIds: data.enemyIds ?? [],
      page: data.page,
      rng: Math.random,
      bossDef,
      precombatFlags: data.precombatFlags,
      playerHistory: new Set(player.history),
    });

    this.add
      .text(GAME_WIDTH / 2, 24, bossDef ? bossDef.name : 'Combat', { fontFamily: FONT_SERIF, fontSize: '24px', color: PALETTE_HEX.gold })
      .setOrigin(0.5, 0);
    this.phaseLabelText = this.add
      .text(GAME_WIDTH / 2, 54, '', { fontFamily: FONT_SERIF, fontSize: '14px', color: PALETTE_HEX.boneMuted, fontStyle: 'italic' })
      .setOrigin(0.5, 0);

    const initialSnap = this.engine.beginRound();
    this.buildEnemyDisplays(initialSnap);

    this.statPanel = createStatPanel(this, 16, GAME_HEIGHT - 190, 320);
    this.apPips = createApPips(this, GAME_WIDTH - 120, GAME_HEIGHT - 190);

    this.logText = this.add.text(16, GAME_HEIGHT - 280, '', {
      fontFamily: FONT_MONO,
      fontSize: '12px',
      color: PALETTE_HEX.boneMuted,
      wordWrap: { width: GAME_WIDTH - 32 },
    });

    this.endTurnBtn = createButton(this, GAME_WIDTH - 110, GAME_HEIGHT - 40, 'End Turn', () => this.onEndTurn(), { width: 180, height: 40 });

    const whisper = maybePickWhisper(player.resonance, 'combat', Math.random);
    if (whisper) showWhisper(this, GAME_WIDTH / 2, 100, whisper.text, 520);

    this.refresh(initialSnap);
  }

  private buildEnemyDisplays(snap: CombatSnapshot) {
    this.enemyDisplays.forEach((d) => d.destroy());
    this.enemyDisplays = [];
    this.enemyKeyMap.clear();
    const n = snap.enemies.length;
    const spacing = Math.min(220, (GAME_WIDTH - 200) / Math.max(1, n));
    const startX = GAME_WIDTH / 2 - ((n - 1) * spacing) / 2;
    snap.enemies.forEach((e, i) => {
      const disp = createEnemyDisplay(this, startX + i * spacing, 220, `tok_${e.key}`, () => {
        this.selectedTarget = e.key;
        this.updateTargetHighlight(this.engine.snapshot());
      });
      disp.update(e);
      this.enemyDisplays.push(disp);
      this.enemyKeyMap.set(e.key, disp);
    });
    if (!this.selectedTarget && snap.enemies[0]) this.selectedTarget = snap.enemies[0].key;
  }

  private updateTargetHighlight(snap: CombatSnapshot) {
    this.enemyDisplays.forEach((d, i) => d.setSelected(snap.enemies[i]?.key === this.selectedTarget));
  }

  private log(lines: string[]) {
    if (!this.logText) return;
    const recent = lines.slice(-4);
    this.logText.setText(recent.join('\n'));
  }

  private refresh(snap: CombatSnapshot) {
    const { player } = useGameStore.getState();
    if (player) this.statPanel?.update(player);
    this.apPips?.update(snap.playerAP);
    this.phaseLabelText?.setText(snap.bossPhaseLabel ?? '');
    snap.enemies.forEach((e, i) => this.enemyDisplays[i]?.update(e));
    this.updateTargetHighlight(snap);
    this.log(snap.log);
    this.buildActionBar(snap);
    this.endTurnBtn?.setEnabled(snap.phase === 'player');

    if (snap.phase === 'momentum_choice') {
      this.showMomentumModal();
      return;
    }
    if ((snap.phase === 'victory' || snap.phase === 'defeat' || snap.phase === 'fled') && !this.resultShown) {
      this.resultShown = true;
      this.time.delayedCall(400, () => this.handleCombatEnd(snap.phase));
    }
  }

  private buildActionBar(snap: CombatSnapshot) {
    this.actionBarContainer?.destroy();
    const { player } = useGameStore.getState();
    if (!player) return;
    const activeSkills = player.skillsKnown.filter((id) => (NAMED_SKILLS[id]?.apCost ?? 0) > 0);
    const canAct = snap.phase === 'player';
    const hasFree = snap.freeActionCharges > 0;
    const canAfford = (cost: number) => hasFree || snap.playerAP >= cost;

    const items = [
      { id: 'attack', label: 'Attack', apCost: 1, disabled: !canAct || !canAfford(1), onClick: () => this.doAction('attack', () => this.engine.attack(this.selectedTarget ?? undefined)) },
      ...activeSkills.map((id) => ({
        id,
        label: NAMED_SKILLS[id].name,
        apCost: NAMED_SKILLS[id].apCost,
        disabled: !canAct || !canAfford(NAMED_SKILLS[id].apCost),
        onClick: () => this.doAction('skill', () => this.engine.useSkill(id, this.selectedTarget ?? undefined)),
      })),
      {
        id: 'resonance',
        label: 'Resonance',
        apCost: 2,
        disabled: !canAct || !canAfford(2) || player.resonance < 25,
        onClick: () => this.doAction('resonance', () => this.engine.resonanceAbility(this.selectedTarget ?? undefined)),
      },
      { id: 'guard', label: 'Guard', apCost: 1, disabled: !canAct || !canAfford(1), onClick: () => this.doAction('guard', () => this.engine.guard()) },
      {
        id: 'item',
        label: 'Item',
        apCost: 1,
        disabled: !canAct || !canAfford(1) || player.inventory.length === 0,
        onClick: () => this.openItemMenu(),
      },
      { id: 'analyze', label: 'Analyze', apCost: 1, disabled: !canAct || !canAfford(1), onClick: () => this.doAction('analyze', () => this.engine.analyze(this.selectedTarget ?? undefined)) },
      { id: 'sunder', label: 'Sunder', apCost: 2, disabled: !canAct || !canAfford(2), onClick: () => this.doAction('sunder', () => this.engine.sunder(this.selectedTarget ?? undefined)) },
      { id: 'withdraw', label: 'Withdraw', apCost: 1, disabled: !canAct || !canAfford(1), onClick: () => this.doAction('withdraw', () => this.engine.withdraw()) },
    ];

    const cols = 4;
    const rowH = 52;
    const wrapper = this.add.container(450, GAME_HEIGHT - 130);
    const { container: row1 } = createActionBar(this, 0, 0, items.slice(0, cols));
    wrapper.add(row1);
    if (items.length > cols) {
      const { container: row2 } = createActionBar(this, 0, rowH, items.slice(cols, cols * 2));
      wrapper.add(row2);
    }
    this.actionBarContainer = wrapper;
  }

  private doAction(type: string, fn: () => CombatSnapshot) {
    audio.click();
    const prevHP = this.lastPlayerHP;
    const prevEnemyHP = new Map(this.engine.snapshot().enemies.map((e) => [e.key, e.hp]));
    const snap = fn();
    this.refresh(snap);
    this.animateAction(type, this.selectedTarget ?? undefined, snap, prevHP, prevEnemyHP);
  }

  private animateAction(type: string, targetKey: string | undefined, snap: CombatSnapshot, prevPlayerHP: number, prevEnemyHP: Map<string, number>) {
    const display = targetKey ? this.enemyKeyMap.get(targetKey) : undefined;
    const showEnemyDamage = () => {
      if (!targetKey || !display) return;
      const before = prevEnemyHP.get(targetKey);
      const after = snap.enemies.find((en) => en.key === targetKey)?.hp;
      if (before !== undefined && after !== undefined && after < before) {
        this.floatingText(display.container.x, display.container.y - 55, `-${before - after}`, PALETTE_HEX.danger);
      } else if (before !== undefined && after !== undefined && after > before) {
        this.floatingText(display.container.x, display.container.y - 55, `+${after - before}`, PALETTE_HEX.ok);
      }
    };
    switch (type) {
      case 'attack': {
        if (display) { this.flashTarget(display.container, 0xff4444); this.shakeTarget(display.container); }
        showEnemyDamage();
        break;
      }
      case 'skill': {
        if (display) { this.flashTarget(display.container, 0x9b59b6); this.shakeTarget(display.container); }
        showEnemyDamage();
        break;
      }
      case 'resonance': {
        if (display) { this.flashTarget(display.container, 0x2c3e50); this.shakeTarget(display.container, 10); }
        showEnemyDamage();
        break;
      }
      case 'guard': {
        if (this.statPanel) this.flashTarget(this.statPanel.container, 0x4a6fa5);
        this.floatingText(200, 620, 'GUARD', PALETTE_HEX.player);
        break;
      }
      case 'item': {
        if (this.statPanel) this.flashTarget(this.statPanel.container, 0x27ae60);
        const healed = snap.playerHP - prevPlayerHP;
        if (healed > 0) this.floatingText(200, 620, `+${healed} HP`, PALETTE_HEX.ok);
        break;
      }
      case 'analyze': {
        if (display) { this.flashTarget(display.container, 0xc9a24b); }
        if (targetKey) this.floatingText(200, 260, 'WEAKNESSES READ', PALETTE_HEX.gold);
        break;
      }
      case 'sunder': {
        if (display) { this.flashTarget(display.container, 0xe67e22); this.shakeTarget(display.container); }
        if (targetKey) this.floatingText(200, 260, 'ARMOR BROKEN', '#e67e22');
        showEnemyDamage();
        break;
      }
      case 'withdraw': {
        this.cameras.main.shake(200, 0.005);
        break;
      }
    }
    if (snap.playerHP < prevPlayerHP && type !== 'withdraw') {
      audio.damageTaken();
      if (this.statPanel) this.flashTarget(this.statPanel.container, 0xb0453f);
      const dmg = prevPlayerHP - snap.playerHP;
      this.floatingText(200, 600, `-${dmg}`, PALETTE_HEX.danger);
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
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setInteractive();
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

  private showMomentumModal() {
    this.closeOverlay();
    audio.momentumFull();
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 170, 'MOMENTUM', { fontFamily: FONT_SERIF, fontSize: '26px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    const choices: MomentumChoice[] = ['extra_turn', 'chorus_heal', 'clarity', 'forgotten_technique', 'unravel'];
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
            this.floatingText(200, 620, `+${healed} HP`, PALETTE_HEX.ok);
          }
          this.lastPlayerHP = snap.playerHP;
        },
      })),
      { width: 420, spacing: 58 },
    );
  }

  private onEndTurn() {
    audio.click();
    const prevHP = this.lastPlayerHP;
    const snap = this.engine.endPlayerPhase();
    this.refresh(snap);
    if (snap.playerHP < prevHP) {
      audio.damageTaken();
      if (this.statPanel) this.flashTarget(this.statPanel.container, 0xb0453f);
      const dmg = prevHP - snap.playerHP;
      this.floatingText(200, 600, `-${dmg}`, PALETTE_HEX.danger);
    }
    this.lastPlayerHP = snap.playerHP;
    if (snap.phase === 'player' || (snap.phase !== 'victory' && snap.phase !== 'defeat' && snap.phase !== 'fled' && snap.phase !== 'momentum_choice')) {
      this.time.delayedCall(700, () => {
        const next = this.engine.beginRound();
        this.refresh(next);
        if (next.playerHP < this.lastPlayerHP) {
          audio.damageTaken();
          if (this.statPanel) this.flashTarget(this.statPanel.container, 0xb0453f);
          const dmg2 = this.lastPlayerHP - next.playerHP;
          this.floatingText(200, 600, `-${dmg2}`, PALETTE_HEX.danger);
        }
        this.lastPlayerHP = next.playerHP;
      });
    }
  }

  private handleCombatEnd(phase: CombatSnapshot['phase']) {
    const store = useGameStore.getState();
    const player = store.player;
    if (!player) return;

    if (phase === 'defeat') {
      audio.defeat();
      const hadCheckpoint = !!store.game?.checkpointSnapshot && (store.game?.checkpointPage ?? 0) > 0;
      store.handleDeath();
      this.scene.start(hadCheckpoint ? 'Board' : 'GameOver');
      return;
    }

    if (phase === 'fled') {
      store.persist();
      this.scene.start('Board');
      return;
    }

    // victory
    audio.victory();
    player.enemiesKilled += this.engine.getEnemiesKilled();
    const xp = this.engine.getXpEarned();
    player.xp += xp;

    if (this.sceneData.mode === 'boss' && this.sceneData.bossId) {
      player.bossesDefeated.push(this.sceneData.bossId);
      store.recordCheckpoint();
      store.persist();
      this.scene.start('Landmark', { stage: 'aftermath', bossId: this.sceneData.bossId, combatFlags: this.engine.getFlags() });
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
      };
      const text = this.sceneData.onVictory(player, ctx);
      store.persist();
      this.showVictorySummary(text, xp);
      return;
    }

    store.persist();
    this.showVictorySummary(null, xp);
  }

  private showVictorySummary(extraText: string | null, xp: number) {
    this.closeOverlay();
    this.overlayBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, 'Victory', { fontFamily: FONT_SERIF, fontSize: '30px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, `+${xp} XP${extraText ? '\n\n' + extraText : ''}`, {
        fontFamily: FONT_SERIF,
        fontSize: '15px',
        color: PALETTE_HEX.bone,
        align: 'center',
        wordWrap: { width: 640 },
      })
      .setOrigin(0.5, 0);
    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 140, 'Continue', () => this.scene.start('Board'), { width: 220 });
  }
}
