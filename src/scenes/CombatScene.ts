import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { BOSSES } from '@data/bosses';
import { ITEMS } from '@data/items';
import { NAMED_SKILLS } from '@data/skills';
import type { EventApplyCtx, PlayerState } from '@data/types';
import { CombatEngine, type CombatSnapshot, type MomentumChoice } from '@systems/CombatEngine';
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
  private selectedTarget: string | null = null;
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
    if (!player) {
      this.scene.start('Board');
      return;
    }

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

    this.logText = this.add.text(16, GAME_HEIGHT - 240, '', {
      fontFamily: FONT_MONO,
      fontSize: '12px',
      color: PALETTE_HEX.boneMuted,
      wordWrap: { width: GAME_WIDTH - 32 },
    });

    this.endTurnBtn = createButton(this, GAME_WIDTH - 110, GAME_HEIGHT - 40, 'End Turn', () => this.onEndTurn(), { width: 180, height: 40 });

    this.refresh(initialSnap);
  }

  private buildEnemyDisplays(snap: CombatSnapshot) {
    this.enemyDisplays.forEach((d) => d.destroy());
    this.enemyDisplays = [];
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
    });
    if (!this.selectedTarget && snap.enemies[0]) this.selectedTarget = snap.enemies[0].key;
  }

  private updateTargetHighlight(snap: CombatSnapshot) {
    this.enemyDisplays.forEach((d, i) => d.setSelected(snap.enemies[i]?.key === this.selectedTarget));
  }

  private log(lines: string[]) {
    if (!this.logText) return;
    const recent = lines.slice(-6);
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
      { id: 'attack', label: 'Attack', apCost: 1, disabled: !canAct || !canAfford(1), onClick: () => this.doAction(() => this.engine.attack(this.selectedTarget ?? undefined)) },
      ...activeSkills.map((id) => ({
        id,
        label: NAMED_SKILLS[id].name,
        apCost: NAMED_SKILLS[id].apCost,
        disabled: !canAct || !canAfford(NAMED_SKILLS[id].apCost),
        onClick: () => this.doAction(() => this.engine.useSkill(id, this.selectedTarget ?? undefined)),
      })),
      {
        id: 'resonance',
        label: 'Resonance',
        apCost: 2,
        disabled: !canAct || !canAfford(2) || player.resonance < 25,
        onClick: () => this.doAction(() => this.engine.resonanceAbility(this.selectedTarget ?? undefined)),
      },
      { id: 'guard', label: 'Guard', apCost: 1, disabled: !canAct || !canAfford(1), onClick: () => this.doAction(() => this.engine.guard()) },
      {
        id: 'item',
        label: 'Item',
        apCost: 1,
        disabled: !canAct || !canAfford(1) || player.inventory.length === 0,
        onClick: () => this.openItemMenu(),
      },
      { id: 'analyze', label: 'Analyze', apCost: 1, disabled: !canAct || !canAfford(1), onClick: () => this.doAction(() => this.engine.analyze(this.selectedTarget ?? undefined)) },
      { id: 'sunder', label: 'Sunder', apCost: 2, disabled: !canAct || !canAfford(2), onClick: () => this.doAction(() => this.engine.sunder(this.selectedTarget ?? undefined)) },
      { id: 'withdraw', label: 'Withdraw', apCost: 1, disabled: !canAct || !canAfford(1), onClick: () => this.doAction(() => this.engine.withdraw()) },
    ];

    const cols = 4;
    const rowH = 52;
    const wrapper = this.add.container(16, GAME_HEIGHT - 130);
    const { container: row1 } = createActionBar(this, 0, 0, items.slice(0, cols));
    wrapper.add(row1);
    if (items.length > cols) {
      const { container: row2 } = createActionBar(this, 0, rowH, items.slice(cols, cols * 2));
      wrapper.add(row2);
    }
    this.actionBarContainer = wrapper;
  }

  private doAction(fn: () => CombatSnapshot) {
    audio.click();
    const snap = fn();
    this.refresh(snap);
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
          this.doAction(() => this.engine.useItem(entry.id));
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
          const snap = this.engine.resolveMomentum(c);
          this.refresh(snap);
        },
      })),
      { width: 420, spacing: 58 },
    );
  }

  private onEndTurn() {
    audio.click();
    const snap = this.engine.endPlayerPhase();
    this.refresh(snap);
    if (snap.phase === 'player' || (snap.phase !== 'victory' && snap.phase !== 'defeat' && snap.phase !== 'fled' && snap.phase !== 'momentum_choice')) {
      this.time.delayedCall(700, () => {
        const next = this.engine.beginRound();
        this.refresh(next);
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
        addEchoShards: (n) => { player.echoShards += n; },
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
