import Phaser from 'phaser';
import { BOSSES } from '@data/bosses';
import type { BossPreCombatChoice } from '@data/types';
import { useGameStore } from '@store/gameStore';
import { NAMED_SKILLS } from '@data/skills';
import { clampInfluence } from '@data/factions';
import { createDialogBox } from '@ui/DialogBox';
import { createChoiceMenu, type ChoiceMenu } from '@ui/ChoiceMenu';
import { createButton } from '@ui/Button';
import { FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

interface LandmarkSceneData {
  bossId: string;
  stage?: 'approach' | 'aftermath';
  combatFlags?: Record<string, number>;
}

export class LandmarkScene extends Phaser.Scene {
  private choiceMenu?: ChoiceMenu;

  constructor() {
    super('Landmark');
  }

  create(data: LandmarkSceneData) {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    const boss = BOSSES[data.bossId];
    const { player } = useGameStore.getState();
    if (!boss || !player) {
      this.scene.start('Board');
      return;
    }
    audio.bossPhase();

    if (data.stage === 'aftermath') {
      this.showAftermath(data.bossId, data.combatFlags ?? {});
      return;
    }
    this.showApproach(data.bossId);
  }

  private showApproach(bossId: string) {
    const boss = BOSSES[bossId];
    this.add.text(GAME_WIDTH / 2, 60, boss.name, { fontFamily: FONT_SERIF, fontSize: '32px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 96, boss.theme, { fontFamily: FONT_SERIF, fontSize: '14px', color: PALETTE_HEX.boneMuted, fontStyle: 'italic' }).setOrigin(0.5);
    this.add.image(GAME_WIDTH / 2, 230, `tok_${bossId}`).setDisplaySize(140, 140);

    const dialog = createDialogBox(this, GAME_WIDTH / 2, 420, 860, 190);
    dialog.setText(boss.approachText, () => this.showPreCombatChoices(bossId));
    this.input.on('pointerdown', () => dialog.skip());
  }

  private showPreCombatChoices(bossId: string) {
    const boss = BOSSES[bossId];
    const { player } = useGameStore.getState();
    if (!player) return;
    const choices: BossPreCombatChoice[] =
      boss.preCombatChoices && boss.preCombatChoices.length > 0
        ? boss.preCombatChoices
        : [{ id: 'face', label: 'Face it.', apply: () => '' }];
    const visible = choices.filter((c) => !c.requirement || c.requirement(player));

    this.choiceMenu?.destroy();
    this.choiceMenu = createChoiceMenu(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 150,
      visible.map((c) => ({ label: c.label, onSelect: () => this.pickPreCombatChoice(bossId, c) })),
      { width: 700, spacing: 54 },
    );
  }

  private pickPreCombatChoice(bossId: string, choice: BossPreCombatChoice) {
    const { player } = useGameStore.getState();
    if (!player) return;
    this.choiceMenu?.destroy();
    this.choiceMenu = undefined;

    const combatFlags: Record<string, number> = {};
    const text = choice.apply(player, combatFlags, Math.random);
    useGameStore.getState().persist();

    const dialog = createDialogBox(this, GAME_WIDTH / 2, GAME_HEIGHT - 140, 820, 160);
    dialog.setText(text || '...', () => {
      if (choice.skipsCombat) {
        useGameStore.getState().recordCheckpoint();
        useGameStore.getState().persist();
        createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, 'Continue', () => this.scene.start('Board'), { width: 220 });
      } else {
        this.scene.start('Combat', { mode: 'boss', bossId, page: BOSSES[bossId].page, precombatFlags: combatFlags });
      }
    });
  }

  private showAftermath(bossId: string, flags: Record<string, number>) {
    const boss = BOSSES[bossId];
    const store = useGameStore.getState();
    const player = store.player;
    if (!player) {
      this.scene.start('Board');
      return;
    }

    const rewards = boss.getRewards(flags);
    const notes: string[] = [];
    if (rewards.factionDelta) {
      for (const [k, v] of Object.entries(rewards.factionDelta)) {
        (player.faction as any)[k] = clampInfluence((player.faction as any)[k] + (v ?? 0));
        notes.push(`${v! > 0 ? '+' : ''}${v} ${k[0].toUpperCase()}${k.slice(1)}`);
      }
    }
    if (rewards.resonanceDelta) {
      player.resonance = Math.max(0, Math.min(100, player.resonance + rewards.resonanceDelta));
      notes.push(`${rewards.resonanceDelta > 0 ? '+' : ''}${rewards.resonanceDelta} Resonance`);
    }
    if (rewards.maxHpPercentDelta) {
      player.derived.maxHP = Math.max(10, Math.round(player.derived.maxHP * (1 + rewards.maxHpPercentDelta / 100)));
      player.currentHP = Math.min(player.currentHP, player.derived.maxHP);
      notes.push(`Max HP ${rewards.maxHpPercentDelta > 0 ? '+' : ''}${rewards.maxHpPercentDelta}%`);
    }
    if (rewards.echoShards) {
      player.echoShards += rewards.echoShards;
      notes.push(`+${rewards.echoShards} Echo Shards`);
    }
    if (rewards.skillUnlock && !player.skillsKnown.includes(rewards.skillUnlock)) {
      player.skillsKnown.push(rewards.skillUnlock);
      notes.push(`Skill: ${NAMED_SKILLS[rewards.skillUnlock]?.name ?? rewards.skillUnlock}`);
    }
    if (rewards.loreFragment && !player.loreFragments.includes(rewards.loreFragment)) {
      player.loreFragments.push(rewards.loreFragment);
      notes.push('Lore Fragment recovered');
    }
    if (!player.flags[rewards.flag]) {
      player.flags[rewards.flag] = true;
      player.history.push(rewards.flag);
    }
    store.persist();

    this.add.text(GAME_WIDTH / 2, 70, `${boss.name} — Aftermath`, { fontFamily: FONT_SERIF, fontSize: '26px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    const dialog = createDialogBox(this, GAME_WIDTH / 2, 280, 860, 220);
    dialog.setText(boss.aftermathText(flags), () => {
      this.add
        .text(GAME_WIDTH / 2, 440, notes.join('   ·   '), { fontFamily: FONT_SERIF, fontSize: '13px', color: PALETTE_HEX.boneMuted })
        .setOrigin(0.5);
      createButton(
        this,
        GAME_WIDTH / 2,
        GAME_HEIGHT - 80,
        bossId === 'reflection' ? 'See how it ends' : 'Continue',
        () => {
          if (bossId === 'reflection') {
            this.scene.start('Ending');
          } else {
            this.scene.start('Board');
          }
        },
        { width: 260 },
      );
    });
    this.input.on('pointerdown', () => dialog.skip());
  }
}
