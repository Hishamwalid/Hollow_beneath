import Phaser from 'phaser';
import { BOSSES } from '@data/bosses';
import type { BossPreCombatChoice } from '@data/types';
import { useGameStore } from '@store/gameStore';
import { NAMED_SKILLS } from '@data/skills';
import { ITEMS } from '@data/items';
import { clampInfluence } from '@data/factions';
import { createDialogBox, type DialogBox } from '@ui/DialogBox';
import { createChoiceMenu, type ChoiceMenu } from '@ui/ChoiceMenu';
import { createButton } from '@ui/Button';
import { applyShardBonus } from '@systems/EchoShardSystem';
import { spawnCelebrationParticles } from '@systems/particles';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { FONT_BODY, FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT, NODES_PER_CHAPTER } from '@/config';

interface LandmarkSceneData {
  bossId: string;
  stage?: 'approach' | 'aftermath';
  combatFlags?: Record<string, number>;
}

export class LandmarkScene extends Phaser.Scene {
  private choiceMenu?: ChoiceMenu;
  private dialog?: DialogBox;
  private continueBtn?: ReturnType<typeof createButton>;

  constructor() {
    super('Landmark');
  }

  create(data: LandmarkSceneData) {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const boss = BOSSES[data.bossId];
    const { player } = useGameStore.getState();
    if (!boss || !player) {
      fadeToScene(this, 'Board');
      return;
    }
    audio.bossPhase();

    if (data.stage === 'aftermath') {
      this.showAftermath(data.bossId, data.combatFlags ?? {});
      return;
    }
    this.showBossCard(data.bossId);
  }

  private showBossCard(bossId: string) {
    const boss = BOSSES[bossId];
    const cx = GAME_WIDTH / 2;
    const depth = 100;
    const scene = this;

    const overlay = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.95).setDepth(depth).setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 300, ease: 'Sine.easeOut' });

    const nameText = this.add.text(cx, GAME_HEIGHT / 2 - 50, '', {
      fontFamily: FONT_SERIF, fontSize: '48px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5).setDepth(depth + 1);

    let charIndex = 0;
    const nameTimer = this.time.addEvent({
      delay: 60, callback: () => {
        charIndex++;
        nameText.setText(boss.name.slice(0, charIndex));
        if (charIndex <= boss.name.length) audio.confirm();
        if (charIndex >= boss.name.length) {
          nameTimer.remove();
          scene.showSubtitleElements(boss, cx, depth, overlay, nameText, bossId);
        }
      }, loop: true,
    });
  }

  private showSubtitleElements(boss: typeof BOSSES[string], cx: number, depth: number, overlay: Phaser.GameObjects.Rectangle, nameText: Phaser.GameObjects.Text, bossId: string) {
    const vennText = this.add.text(cx, GAME_HEIGHT / 2, `"${boss.vennName}"`, {
      fontFamily: FONT_BODY, fontSize: '22px', color: PALETTE_HEX.boneMuted, fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0);
    this.tweens.add({ targets: vennText, alpha: 1, duration: 500, delay: 200, ease: 'Sine.easeOut' });

    const themeText = this.add.text(cx, GAME_HEIGHT / 2 + 42, boss.theme, {
      fontFamily: FONT_BODY, fontSize: '17px', color: PALETTE_HEX.bone, fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0);
    this.tweens.add({ targets: themeText, alpha: 1, duration: 500, delay: 600, ease: 'Sine.easeOut' });

    const border = this.add.rectangle(cx, GAME_HEIGHT / 2 - 10, 500, 120, 0x000000, 0).setStrokeStyle(1, 0xc9a24b, 0.3).setDepth(depth + 1);
    this.tweens.add({
      targets: border, strokeAlpha: { from: 0.3, to: 0.8 }, duration: 1000, yoyo: true, repeat: -1,
    });

    this.input.once('pointerdown', () => {
      this.tweens.add({
        targets: [overlay, nameText, vennText, themeText, border],
        alpha: 0, duration: 300, ease: 'Sine.easeIn',
        onComplete: () => {
          overlay.destroy(); nameText.destroy(); vennText.destroy(); themeText.destroy(); border.destroy();
          this.showApproach(bossId);
        },
      });
    });
  }

  private showApproach(bossId: string) {
    const boss = BOSSES[bossId];
    this.add.text(GAME_WIDTH / 2, 60, boss.name, { fontFamily: FONT_SERIF, fontSize: '34px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 100, boss.theme, { fontFamily: FONT_BODY, fontSize: '16px', color: PALETTE_HEX.boneMuted, fontStyle: 'italic' }).setOrigin(0.5);
    const isSentinel = bossId === 'sentinel' && this.textures.exists('enemy_sentinel_half');
    const halfBodyKey = isSentinel ? 'enemy_sentinel_half' : `tok_${bossId}`;
    const bodyImg = this.add.image(GAME_WIDTH / 2, 230, halfBodyKey);
    const fr = this.textures.getFrame(halfBodyKey);
    const bh = 250;
    const bw = fr ? bh * (fr.realWidth / fr.realHeight) : 140;
    bodyImg.setDisplaySize(bw, bh);

    this.dialog?.destroy();
    const dialog = createDialogBox(this, GAME_WIDTH / 2, 420, 860, 190);
    this.dialog = dialog;
    dialog.setText(boss.approachText, () => this.showPreCombatChoices(bossId));
    this.input.removeAllListeners('pointerdown');
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

    this.dialog?.destroy();
    const dialog = createDialogBox(this, GAME_WIDTH / 2, GAME_HEIGHT - 140, 820, 160);
    this.dialog = dialog;
    dialog.setText(text || '...', () => {
      if (choice.skipsCombat) {
        useGameStore.getState().recordCheckpoint();
        useGameStore.getState().persist();
        this.continueBtn?.destroy();
        this.continueBtn = createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, 'Continue', () => fadeToScene(this, 'Board'), { width: 220 });
      } else {
        fadeToScene(this, 'Combat', { mode: 'boss', bossId, nodeIndex: BOSSES[bossId].chapter * NODES_PER_CHAPTER, precombatFlags: combatFlags });
      }
    });
    this.input.removeAllListeners('pointerdown');
    this.input.on('pointerdown', () => dialog.skip());
  }

  private showAftermath(bossId: string, flags: Record<string, number>) {
    const boss = BOSSES[bossId];
    const store = useGameStore.getState();
    const player = store.player;
    if (!player) {
      fadeToScene(this, 'Board');
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
      const shards = applyShardBonus(player, rewards.echoShards);
      player.echoShards += shards;
      notes.push(`+${shards} Echo Shards`);
    }
    if (rewards.skillUnlock && !player.skillsKnown.includes(rewards.skillUnlock)) {
      player.skillsKnown.push(rewards.skillUnlock);
      if (player.equippedSkills.length < 6) player.equippedSkills.push(rewards.skillUnlock);
      notes.push(`Skill: ${NAMED_SKILLS[rewards.skillUnlock]?.name ?? rewards.skillUnlock}`);
    }
    if (rewards.loreFragment && !player.loreFragments.includes(rewards.loreFragment)) {
      player.loreFragments.push(rewards.loreFragment);
      notes.push('Lore Fragment recovered');
    }
    if (rewards.itemReward) {
      const existing = player.inventory.find((i) => i.id === rewards.itemReward);
      if (existing) {
        existing.qty += 1;
      } else {
        player.inventory.push({ id: rewards.itemReward, qty: 1 });
      }
      const itemDef = ITEMS[rewards.itemReward];
      notes.push(`Item: ${itemDef?.name ?? rewards.itemReward}`);
    }
    if (!player.flags[rewards.flag]) {
      player.flags[rewards.flag] = true;
      player.history.push(rewards.flag);
    }
    store.persist();

    spawnCelebrationParticles(this, GAME_WIDTH / 2, 100);

    this.add.text(GAME_WIDTH / 2, 70, `${boss.name} — Aftermath`, { fontFamily: FONT_SERIF, fontSize: '30px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.dialog?.destroy();
    const dialog = createDialogBox(this, GAME_WIDTH / 2, 280, 860, 220);
    this.dialog = dialog;
    dialog.setText(boss.aftermathText(flags), () => {
      this.showRewardNotes(notes, () => {
        this.continueBtn?.destroy();
        this.continueBtn = createButton(
          this,
          GAME_WIDTH / 2,
          GAME_HEIGHT - 80,
          bossId === 'reflection' ? 'See how it ends' : 'Continue',
          () => {
            if (bossId === 'reflection') {
              fadeToScene(this, 'Ending');
            } else {
              fadeToScene(this, 'Board');
            }
          },
          { width: 260 },
        );
      });
    });
    this.input.removeAllListeners('pointerdown');
    this.input.on('pointerdown', () => dialog.skip());
  }

  private showRewardNotes(notes: string[], onDone: () => void) {
    if (notes.length === 0) { onDone(); return; }
    const rewardTexts: Phaser.GameObjects.Text[] = [];
    let index = 0;

    const showNext = () => {
      if (index >= notes.length) {
        rewardTexts.forEach((t) => t.destroy());
        onDone();
        return;
      }
      const rewardY = 440 + index * 24;
      const t = this.add.text(GAME_WIDTH / 2, rewardY, `✦ ${notes[index]}`, {
        fontFamily: FONT_SERIF, fontSize: '16px', color: PALETTE_HEX.goldBright,
      }).setOrigin(0.5).setAlpha(0);
      rewardTexts.push(t);
      audio.shardGain();
      this.tweens.add({ targets: t, alpha: 1, duration: 400, ease: 'Sine.easeOut' });
      index++;
      this.time.delayedCall(400, showNext);
    };
    showNext();
  }

  shutdown() {
    this.input.removeAllListeners('pointerdown');
    this.choiceMenu?.destroy();
    this.dialog?.destroy();
    this.continueBtn?.destroy();
  }
}
