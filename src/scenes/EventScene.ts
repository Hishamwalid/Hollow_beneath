import Phaser from 'phaser';
import { HOSTILE_FLAVOR } from '@data/events';
import type { EventChoice, EventDef, FactionState } from '@data/types';
import { useGameStore } from '@store/gameStore';
import { resolveEventChoice } from '@systems/EventEngine';
import { createDialogBox, type DialogBox } from '@ui/DialogBox';
import { createChoiceMenu, type ChoiceMenu } from '@ui/ChoiceMenu';
import { createButton } from '@ui/Button';
import { FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';
import { influenceStatus } from '@data/factions';

interface EventSceneData {
  eventDef: EventDef;
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
    fadeIn(this);
    const { player } = useGameStore.getState();
    const event = data.eventDef;
    if (!player || !event) {
      fadeToScene(this, 'Board');
      return;
    }

    if (!player.history.includes(`event_seen:${event.id}`)) {
      player.history.push(`event_seen:${event.id}`);
    }

    this.add.text(GAME_WIDTH / 2, 90, event.title, { fontFamily: FONT_SERIF, fontSize: '30px', color: PALETTE_HEX.gold }).setOrigin(0.5);

    this.dialog?.destroy();
    this.dialog = createDialogBox(this, GAME_WIDTH / 2, 260, 820, 220);
    const hostileSuffix = this.hostileFlavorSuffix(player);
    this.dialog.setText(hostileSuffix ? `${event.flavorText}\n\n${hostileSuffix}` : event.flavorText, () => this.showChoices(event.choices));

    this.input.on('pointerdown', () => this.dialog?.skip());
  }

  private showChoices(choices: EventChoice[]) {
    const { player } = useGameStore.getState();
    if (!player) return;
    const visible = choices.filter((c) => !c.requirement || c.requirement?.(player));

    this.choiceMenu?.destroy();
    this.choiceMenu = createChoiceMenu(
      this,
      GAME_WIDTH / 2,
      430,
      visible.map((c) => {
        const locked = c.factionGate && influenceStatus(player.faction[c.factionGate]) === 'Hostile';
        return {
          label: locked ? `${c.label}  ✦ LOCKED` : c.label,
          disabled: !!locked,
          onSelect: () => { if (!locked) this.pickChoice(c); },
        };
      }),
      { width: 620, spacing: 58 },
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

    const resolution = resolveEventChoice(player, choice, Math.random);
    useGameStore.getState().persist();

    this.dialog?.destroy();
    const dialog = createDialogBox(this, GAME_WIDTH / 2, 590, 820, 150);
    this.dialog = dialog;
    dialog.setText(resolution.text, () => {
      const { player: currentPlayer, game: currentGame } = useGameStore.getState();
      if (!currentPlayer) return;
      if (currentPlayer.currentHP <= 0) {
        this.handleDeath();
        return;
      }
      if (resolution.combat) {
        const page = Math.max(1, Math.ceil((currentGame?.currentNodeIndex ?? 1) / 10));
        fadeToScene(this, 'Combat', {
          mode: 'event',
          enemyIds: resolution.combat.enemyIds,
          page,
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
    this.continueBtn = createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 70, 'Continue', () => fadeToScene(this, 'Board'), { width: 220 });
  }

  private handleDeath() {
    const store = useGameStore.getState();
    const hadCheckpoint = !!store.game?.checkpointSnapshot && (store.game?.checkpointPage ?? 0) > 0;
    store.handleDeath();
    fadeToScene(this, hadCheckpoint ? 'Board' : 'GameOver');
  }

  shutdown() {
    this.input.removeAllListeners('pointerdown');
    this.choiceMenu?.destroy();
    this.dialog?.destroy();
    this.continueBtn?.destroy();
  }
}
