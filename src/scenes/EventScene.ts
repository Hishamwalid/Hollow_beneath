import Phaser from 'phaser';
import { EVENTS } from '@data/events';
import { MINOR_LANDMARKS } from '@data/minorLandmarks';
import type { EventChoice, EventDef } from '@data/types';
import { useGameStore } from '@store/gameStore';
import { resolveEventChoice } from '@systems/EventEngine';
import { createDialogBox, type DialogBox } from '@ui/DialogBox';
import { createChoiceMenu, type ChoiceMenu } from '@ui/ChoiceMenu';
import { createButton } from '@ui/Button';
import { FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

interface EventSceneData {
  eventId: string;
}

/** Resolves an id against the main pool first, then the minor-landmark vignettes (never in the random pool). */
function findEvent(id: string): EventDef | undefined {
  if (EVENTS[id]) return EVENTS[id];
  return Object.values(MINOR_LANDMARKS).find((e) => e.id === id);
}

export class EventScene extends Phaser.Scene {
  private choiceMenu?: ChoiceMenu;
  private continueBtn?: ReturnType<typeof createButton>;
  private dialog?: DialogBox;

  constructor() {
    super('Event');
  }

  create(data: EventSceneData) {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    const { player } = useGameStore.getState();
    const event = findEvent(data.eventId);
    if (!player || !event) {
      this.scene.start('Board');
      return;
    }

    if (!player.history.includes(`event_seen:${event.id}`)) {
      player.history.push(`event_seen:${event.id}`);
    }

    this.add.text(GAME_WIDTH / 2, 90, event.title, { fontFamily: FONT_SERIF, fontSize: '30px', color: PALETTE_HEX.gold }).setOrigin(0.5);

    this.dialog?.destroy();
    this.dialog = createDialogBox(this, GAME_WIDTH / 2, 260, 820, 220);
    this.dialog.setText(event.flavorText, () => this.showChoices(event.choices));

    this.input.on('pointerdown', () => this.dialog?.skip());
  }

  private showChoices(choices: EventChoice[]) {
    const { player } = useGameStore.getState();
    if (!player) return;
    const visible = choices.filter((c) => !c.requirement || c.requirement(player));

    this.choiceMenu?.destroy();
    this.choiceMenu = createChoiceMenu(
      this,
      GAME_WIDTH / 2,
      430,
      visible.map((c) => ({
        label: c.label,
        onSelect: () => this.pickChoice(c),
      })),
      { width: 620, spacing: 58 },
    );
  }

  private pickChoice(choice: EventChoice) {
    const store = useGameStore.getState();
    const { player } = store;
    if (!player) return;
    this.choiceMenu?.destroy();
    this.choiceMenu = undefined;

    const resolution = resolveEventChoice(player, choice, Math.random);
    store.persist();

    this.dialog?.destroy();
    const dialog = createDialogBox(this, GAME_WIDTH / 2, 590, 820, 150);
    this.dialog = dialog;
    dialog.setText(resolution.text, () => {
      if (player.currentHP <= 0) {
        this.handleDeath();
        return;
      }
      if (resolution.combat) {
        this.scene.start('Combat', {
          mode: 'event',
          enemyIds: resolution.combat.enemyIds,
          page: Math.max(1, Math.ceil((store.game?.currentNodeIndex ?? 1) / 10)),
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
    this.continueBtn = createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 70, 'Continue', () => this.scene.start('Board'), { width: 220 });
  }

  private handleDeath() {
    const store = useGameStore.getState();
    const hadCheckpoint = !!store.game?.checkpointSnapshot && (store.game?.checkpointPage ?? 0) > 0;
    store.handleDeath();
    this.scene.start(hadCheckpoint ? 'Board' : 'GameOver');
  }

  shutdown() {
    this.input.removeAllListeners('pointerdown');
    this.choiceMenu?.destroy();
    this.dialog?.destroy();
    this.continueBtn?.destroy();
  }
}
