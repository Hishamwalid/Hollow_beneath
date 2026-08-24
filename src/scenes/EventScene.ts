import Phaser from 'phaser';
import { HOSTILE_FLAVOR } from '@data/events';
import type { EventChoice, EventDef, FactionState } from '@data/types';
import { STORY_EVENTS } from '@data/storyEvents';
import { useGameStore } from '@store/gameStore';
import { resolveEventChoice } from '@systems/EventEngine';
import { sanitizeFightEnemies } from '@data/enemies';
import { chapterForIndex } from '@systems/BoardGenerator';
import { createDialogBox, type DialogBox } from '@ui/DialogBox';
import { createChoiceMenu, type ChoiceMenu } from '@ui/ChoiceMenu';
import { createCoachTip } from '@ui/CoachTip';
import { createButton } from '@ui/Button';
import { createPanel } from '@ui/Panel';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { GAME_WIDTH, GAME_HEIGHT, CHAPTERS, NODES_PER_CHAPTER } from '@/config';
import { influenceStatus } from '@data/factions';
import { addResonanceEffects } from '@systems/ResonanceFX';

interface EventSceneData {
  eventDef?: EventDef;
}

const EVE_BEAT_IDS = new Set([
  'eves_first_voice',
  'the_memory_room',
  'ashen_tunnels',
  'eve_reveal',
]);

/**
 * Story presentation. Two modes:
 *  • journal   — parchment entry: chapter header, narration, choice cards
 *  • cinematic — letterboxed pinned beats; EVE speaks in oxide italics
 */
export class EventScene extends Phaser.Scene {
  private dialog?: DialogBox;
  private choiceMenu?: ChoiceMenu;
  private continueBtn?: ReturnType<typeof createButton>;

  constructor() {
    super('Event');
  }

  create(data: EventSceneData) {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const { player, game: currentGame } = useGameStore.getState();
    const event = data.eventDef;
    if (!player || !event) {
      fadeToScene(this, 'Board');
      return;
    }
    const chapter = chapterForIndex(Math.max(1, currentGame?.currentNodeIndex ?? 1));

    if (!player.history.includes(`event_seen:${event.id}`)) {
      player.history.push(`event_seen:${event.id}`);
    }

    const cinematic = !!STORY_EVENTS[event.id];
    this.cameras.main.setBackgroundColor(cinematic ? 0x000000 : 0x0b0d10);
    if (cinematic) this.buildLetterbox();

    // ---- Header -----------------------------------------------------------------
    const headerY = cinematic ? 70 : 64;
    const titleText = this.add.text(GAME_WIDTH / 2, headerY, event.title.toUpperCase(), {
      fontFamily: FONT_SERIF,
      fontSize: cinematic ? '30px' : '28px',
      color: cinematic ? PALETTE_HEX.gold : PALETTE_HEX.gold,
    }).setOrigin(0.5);
    if (typeof titleText.setLetterSpacing === 'function') titleText.setLetterSpacing(3);

    const subParts: string[] = [`Chapter ${chapter} of ${CHAPTERS}`];
    if (!cinematic && currentGame) subParts.push(`Node ${currentGame.currentNodeIndex}`);
    this.add.text(GAME_WIDTH / 2, headerY + 34, subParts.join('  ·  '), {
      fontFamily: FONT_MONO,
      fontSize: '12px',
      color: PALETTE_HEX.boneMuted,
    }).setOrigin(0.5);

    addResonanceEffects(this, player.resonance, GAME_WIDTH, GAME_HEIGHT, { nodePulse: false, shake: false, shimmer: false });

    // ---- Narration panel ----------------------------------------------------------
    let dialogX = GAME_WIDTH / 2;
    let dialogY = 300;
    let dialogW = 940;
    let dialogH = 300;

    if (cinematic) {
      dialogX = GAME_WIDTH / 2;
      dialogY = GAME_HEIGHT / 2 - 20;
      dialogW = 1000;
      dialogH = 340;
      const veil = createPanel(this, { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, width: GAME_WIDTH - 160, height: dialogH + 60, variant: 'ghost', depth: 5 });
      void veil;
    } else {
      const panel = createPanel(this, { x: GAME_WIDTH / 2, y: dialogY, width: dialogW + 40, height: dialogH + 30, variant: 'parchment', title: 'Journal', depth: 20 });
      void panel;
    }

    this.dialog?.destroy();
    const hostileSuffix = this.hostileFlavorSuffix(player);
    const flavor = hostileSuffix ? `${event.flavorText}\n\n${hostileSuffix}` : event.flavorText;

    const speaker = EVE_BEAT_IDS.has(event.id) ? 'EVE (V.O.)' : null;
    if (cinematic && speaker) {
      // Split narration vs spoken lines so the nameplate lands on her voice.
      const spokenBeat = flavor.split('\n').findIndex((l) => l.includes('EVE ('));
      void spokenBeat;
    }

    this.dialog = createDialogBox(this, dialogX, dialogY, dialogW, dialogH, { variant: 'parchment' });
    this.dialog.container.setDepth(25);
    if (cinematic && speaker) this.dialog.setSpeaker(speaker);

    // Long passages paginate into beats on blank-line boundaries.
    const beats = flavor.split(/\n{2,}/).map((s) => s.trim()).filter((s) => s.length > 0);
    if (beats.length > 1) {
      this.dialog.setBeats(beats, () => this.showChoices(event.choices));
    } else {
      this.dialog.setText(flavor, () => this.showChoices(event.choices));
    }

    this.input.removeAllListeners('pointerdown');
    this.input.on('pointerdown', () => this.dialog?.skip());
  }

  private buildLetterbox() {
    this.add.rectangle(GAME_WIDTH / 2, 26, GAME_WIDTH, 52, 0x000000, 0.92).setDepth(4);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 26, GAME_WIDTH, 52, 0x000000, 0.92).setDepth(4);
  }

  private showChoices(choices: EventChoice[]) {
    this.input.removeAllListeners('pointerdown');
    const { player } = useGameStore.getState();
    if (!player) return;

    // Cutscene story beats have no choices — a single Continue resolves them.
    if (choices.length === 0) {
      this.continueBtn?.destroy();
      this.continueBtn = createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 64, 'Continue', () => fadeToScene(this, 'Board'), {
        width: 240, variant: 'primary',
      });
      void player;
      return;
    }

    const visible = choices.filter((c) => !c.requirement || c.requirement?.(player));

    // First story choice ever: one quiet slip, then never again.
    if (!player.flags.hint_event && visible.length > 0) {
      player.flags.hint_event = true;
      useGameStore.getState().persist();
      createCoachTip(this, GAME_WIDTH / 2, 470, 'Your choices shift factions and Resonance.', {
        width: 400, durationMs: 4200, depth: 60,
      });
    }
    const menuItems = visible.map((c, i) => {
      let chip: string | undefined;
      if (c.check) chip = `${c.check.stat} DC ${c.check.dc}`;
      else if (c.factionGate) chip = `requires ${c.factionGate}`;
      const locked = !!c.factionGate && influenceStatus(player.faction[c.factionGate]) === 'Hostile';
      return {
        label: c.label,
        rightLabel: i === visible.length - 1 && !chip ? '' : undefined,
        chip,
        disabled: locked,
        locked,
        onSelect: () => { if (!locked) this.pickChoice(c); },
      };
    });

    this.choiceMenu?.destroy();
    this.choiceMenu = createChoiceMenu(
      this,
      GAME_WIDTH / 2,
      520,
      menuItems,
      { width: 760, spacing: 66, maxShift: 44 },
    );
  }

  private hostileFlavorSuffix(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>): string | null {
    const hostile = (Object.keys(player.faction) as (keyof FactionState)[]).find(
      (k) => influenceStatus(player.faction[k]) === 'Hostile',
    );
    if (!hostile) return null;
    return HOSTILE_FLAVOR[hostile] ?? null;
  }

  private pickChoice(choice: EventChoice) {
    const { player } = useGameStore.getState();
    if (!player) return;
    this.choiceMenu?.destroy();
    this.choiceMenu = undefined;

    const resolution = resolveEventChoice(player, choice, () => Math.random());
    useGameStore.getState().persist();

    this.dialog?.destroy();
    const dialog = createDialogBox(this, GAME_WIDTH / 2, 620, 860, 150, { variant: 'parchment' });
    this.dialog = dialog;
    dialog.setText(resolution.text || '...', () => {
      const { player: currentPlayer, game: currentGame } = useGameStore.getState();
      if (!currentPlayer) return;
      if (currentPlayer.currentHP <= 0) {
        this.handleDeath();
        return;
      }
      if (resolution.combat) {
        const nodeIndex = Math.max(1, currentGame?.currentNodeIndex ?? 1);
        const chapter = chapterForIndex(nodeIndex);
        const enemyIds = sanitizeFightEnemies(resolution.combat.enemyIds, chapter, currentPlayer.resonance);
        fadeToScene(this, 'Combat', {
          mode: 'event',
          enemyIds,
          nodeIndex,
          onVictory: resolution.combat.onVictory,
        });
        return;
      }
      this.showContinue();
    });
    this.input.removeAllListeners('pointerdown');
    this.input.on('pointerdown', () => dialog.skip());
  }

  private showContinue() {
    this.continueBtn?.destroy();
    this.continueBtn = createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 56, 'Continue', () => fadeToScene(this, 'Board'), {
      width: 220, variant: 'primary',
    });
  }

  private handleDeath() {
    const store = useGameStore.getState();
    const hadCheckpoint = !!store.game?.checkpointSnapshot && (store.game?.checkpointNodeIndex ?? 0) > 0;
    store.handleDeath();
    fadeToScene(this, hadCheckpoint ? 'Board' : 'GameOver');
  }

  shutdown() {
    this.input.removeAllListeners('pointerdown');
    this.dialog?.destroy();
    this.choiceMenu?.destroy();
    this.continueBtn?.destroy();
  }
}
