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
import { stashDeltas } from '@systems/fxDelta';
import { reducedMotion } from '@systems/motion';

interface EventSceneData {
  eventDef?: EventDef;
}

/** Compact faction+gold snapshot for cross-scene FX playback. */
function snapshotPlayerFx(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>) {
  return {
    faction: { ...player.faction } as Record<string, number>,
    gold: player.gold,
  };
}

/** Pinned beats where an unnamed presence speaks — never named before the reveal. */
const VOICE_BEAT_IDS = new Set(['eves_first_voice', 'the_memory_room', 'ashen_tunnels']);
const REVEAL_BEAT_IDS = new Set(['eve_reveal']);

/**
 * Story presentation. Two modes:
 *  - journal   — parchment entry: chapter header, narration, choice cards
 *  - cinematic — letterboxed pinned beats; the unnamed presence speaks in oxide italics
 * The narration sheet dynamically sizes to its text; choices and the
 * Continue button always tuck a few px under it.
 */
export class EventScene extends Phaser.Scene {
  private dialog?: DialogBox;
  private dialogCenterY = 300;
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
    // Title entrance: drops in and its tracking tightens from airy to set.
    if (!reducedMotion()) {
      const ty = headerY;
      titleText.y = ty - 16;
      titleText.setAlpha(0);
      if (typeof titleText.setLetterSpacing === 'function') {
        titleText.setLetterSpacing(9);
        this.tweens.add({ targets: titleText, y: ty, alpha: 1, duration: 420, ease: 'Sine.easeOut' });
        // Phaser has no tweenable letterSpacing; settle it in steps.
        this.time.delayedCall(300, () => { if (titleText.active) titleText.setLetterSpacing(6); });
        this.time.delayedCall(520, () => { if (titleText.active) titleText.setLetterSpacing(3); });
      } else {
        this.tweens.add({ targets: titleText, y: ty, alpha: 1, duration: 420, ease: 'Sine.easeOut' });
      }
    }

    const subParts: string[] = [`Chapter ${chapter} of ${CHAPTERS}`];
    if (!cinematic && currentGame) subParts.push(`Node ${currentGame.currentNodeIndex}`);
    this.add.text(GAME_WIDTH / 2, headerY + 34, subParts.join('  ·  '), {
      fontFamily: FONT_MONO,
      fontSize: '12px',
      color: PALETTE_HEX.boneMuted,
    }).setOrigin(0.5);

    addResonanceEffects(this, player.resonance, GAME_WIDTH, GAME_HEIGHT, { nodePulse: false, shake: false, shimmer: false });

    // ---- Narration panel (dynamic height) ---------------------------------------
    this.dialogCenterY = cinematic ? GAME_HEIGHT / 2 - 20 : 300;
    const dialogW = cinematic ? 1000 : 940;
    const dialogH = cinematic ? 340 : 200;

    if (cinematic) {
      const veil = createPanel(this, { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, width: GAME_WIDTH - 160, height: dialogH + 60, variant: 'ghost', depth: 5 });
      void veil;
    }

    this.dialog?.destroy();
    const hostileSuffix = this.hostileFlavorSuffix(player);
    const flavor = hostileSuffix ? `${event.flavorText}\n\n${hostileSuffix}` : event.flavorText;

    // Hostility is felt before it is read: a red breath across the screen.
    if (hostileSuffix && !reducedMotion()) {
      const vign = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xb0453f, 0).setDepth(3);
      this.tweens.add({ targets: vign, alpha: 0.13, duration: 260, yoyo: true, hold: 140, ease: 'Sine.easeInOut', onComplete: () => vign.destroy() });
    }

    const speaker = VOICE_BEAT_IDS.has(event.id) ? 'THE VOICE' : REVEAL_BEAT_IDS.has(event.id) ? 'EVE' : null;

    this.dialog = createDialogBox(this, GAME_WIDTH / 2, this.dialogCenterY, dialogW, dialogH, { variant: 'parchment' });
    this.dialog.container.setDepth(25);
    if (cinematic && speaker) this.dialog.setSpeaker(speaker);

    this.presentFlavor(flavor, () => this.showChoices(event.choices));

    this.input.removeAllListeners('pointerdown');
    this.input.on('pointerdown', () => this.dialog?.skip());
  }

  /** Types a passage out, paginating paragraphs into clickable beats. */
  private presentFlavor(text: string, onDone: () => void) {
    const beats = text.split(/\n{2,}/).map((s) => s.trim()).filter((s) => s.length > 0);
    if (!this.dialog) return;
    if (beats.length > 1) {
      this.dialog.setBeats(beats, onDone);
    } else {
      this.dialog.setText(text, onDone);
    }
  }

  /** Y of a control sitting a few px under the (dynamic) narration sheet. */
  private underDialog(gap: number): number {
    return this.dialogCenterY + (this.dialog?.getHeight() ?? 200) / 2 + gap;
  }
  private buildLetterbox() {
    const top = this.add.rectangle(GAME_WIDTH / 2, 26, GAME_WIDTH, 52, 0x000000, 0.92).setDepth(4);
    const bottom = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 26, GAME_WIDTH, 52, 0x000000, 0.92).setDepth(4);
    if (!reducedMotion()) {
      top.y = -30;
      bottom.y = GAME_HEIGHT + 30;
      this.tweens.add({ targets: top, y: 26, duration: 340, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: bottom, y: GAME_HEIGHT - 26, duration: 340, ease: 'Sine.easeOut' });
    }
  }

  private showChoices(choices: EventChoice[], depth = 0) {
    this.input.removeAllListeners('pointerdown');
    const { player } = useGameStore.getState();
    if (!player) return;

    // Cutscene story beats have no choices — a single Continue resolves them.
    if (choices.length === 0) {
      this.showContinue();
      void player;
      return;
    }

    const visible = choices.filter((c) => !c.requirement || c.requirement?.(player));

    // First story choice ever: one quiet slip, then never again.
    if (!player.flags.hint_event && visible.length > 0) {
      player.flags.hint_event = true;
      useGameStore.getState().persist();
      createCoachTip(this, GAME_WIDTH / 2, this.underDialog(150), 'Your choices shift factions and Resonance.', {
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
        onSelect: () => { if (!locked) this.pickChoice(c, depth); },
      };
    });

    this.choiceMenu?.destroy();
    this.choiceMenu = createChoiceMenu(
      this,
      GAME_WIDTH / 2,
      this.underDialog(64),
      menuItems,
      { width: 760, spacing: 66, maxShift: 44, bottomBound: GAME_HEIGHT - 40 },
    );
  }

  private hostileFlavorSuffix(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>): string | null {
    const hostile = (Object.keys(player.faction) as (keyof FactionState)[]).find(
      (k) => influenceStatus(player.faction[k]) === 'Hostile',
    );
    if (!hostile) return null;
    return HOSTILE_FLAVOR[hostile] ?? null;
  }

  private pickChoice(choice: EventChoice, depth = 0) {
    const { player } = useGameStore.getState();
    if (!player) return;
    this.choiceMenu?.destroy();
    this.choiceMenu = undefined;

    const before = snapshotPlayerFx(player);
    const resolution = resolveEventChoice(player, choice, () => Math.random());
    stashDeltas(before, snapshotPlayerFx(player));
    useGameStore.getState().persist();

    // The outcome continues in the SAME narration sheet — no second box.
    const dialog = this.dialog;
    if (!dialog) return;
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
      // Staged storytelling: flow straight into the next narration stage.
      if (choice.then && depth < 4) {
        this.showStage(choice.then, depth + 1);
        return;
      }
      this.showContinue();
    });
    this.input.removeAllListeners('pointerdown');
    this.input.on('pointerdown', () => dialog.skip());
  }

  /** Renders one interactive stage: narration beats, then its own choices. */
  private showStage(stage: NonNullable<EventChoice['then']>, depth: number) {
    this.presentFlavor(stage.flavorText, () => this.showChoices(stage.choices, depth));
  }

  private showContinue() {
    this.continueBtn?.destroy();
    this.continueBtn = createButton(this, GAME_WIDTH / 2, this.underDialog(48), 'Continue', () => fadeToScene(this, 'Board'), {
      width: 220, variant: 'primary', depth: 40,
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
