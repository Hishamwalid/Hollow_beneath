import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { ENDINGS } from '@data/endings';
import { FONT_BODY, FONT_MONO, PALETTE_HEX } from '@ui/uiTheme';
import { createButton, type Button } from '@ui/Button';
import { createPanel } from '@ui/Panel';
import { createDivider, createSectionLabel, createSubtitle, createTitle } from '@ui/headings';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { reducedMotion } from '@systems/motion';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

/**
 * Main menu — "the camp above the sinkhole".
 * Dimmed deep-map artwork behind an expedition ledger and a quiet nav rail.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    audio.startAmbience('menu');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.stopAmbience());

    const { meta, loadActiveRun } = useGameStore.getState();
    const canContinue = loadActiveRun();

    // ---- Backdrop: the deep, far below ---------------------------------------
    if (this.textures.exists('map_5')) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'map_5').setAlpha(0.32);
      const src = this.textures.get('map_5').getSourceImage();
      const scale = Math.max(GAME_WIDTH / src.width, GAME_HEIGHT / src.height);
      bg.setScale(scale);
    }
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05060a, 0.45);
    this.spawnDust();

    // ---- Title -----------------------------------------------------------------
    const title = createTitle(this, GAME_WIDTH / 2, 96, 'THE HOLLOW BENEATH', { size: '44px' });
    const subtitle = createSubtitle(this, GAME_WIDTH / 2, 142, 'a descent, a translation, a mistake made carefully');
    createDivider(this, this.add.container(0, 0), GAME_WIDTH / 2, 176, 420);
    // The title breathes — faint, slow, alive.
    if (!reducedMotion()) {
      this.tweens.add({ targets: title, scale: { from: 1, to: 1.012 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: subtitle, alpha: { from: 0.75, to: 1 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      title.setAlpha(0).setScale(0.96);
      subtitle.setAlpha(0);
      this.tweens.add({ targets: [title, subtitle], alpha: 1, scale: 1, duration: 600, ease: 'Sine.easeOut' });
    }

    // ---- Nav rail ---------------------------------------------------------------
    const navPanel = createPanel(this, { x: 330, y: 470, width: 480, height: 520, variant: 'stone', title: 'Expedition Camp' });
    if (!reducedMotion()) {
      navPanel.container.setAlpha(0).setY(470 + 18);
      this.tweens.add({ targets: navPanel.container, y: 470, alpha: 1, duration: 380, ease: 'Sine.easeOut' });
    }


    type Entry = { label: string; sub: string; onClick: () => void };
    const entries: Entry[] = [];
    if (canContinue) entries.push({ label: 'Continue', sub: 'return to the descent', onClick: () => fadeToScene(this, 'Board') });
    entries.push({
      label: 'New Descent',
      sub: 'begin a fresh run',
      onClick: () => {
        if (meta.totalRuns === 0) {
          // First run: one 3-line screen, then straight to the descent.
          fadeToScene(this, 'Tutorial', { returnTo: 'CharacterCreation', introOnly: true });
        } else {
          fadeToScene(this, 'CharacterCreation');
        }
      },
    });
    entries.push({ label: 'How to Play', sub: 'the field manual', onClick: () => fadeToScene(this, 'Tutorial', { returnTo: 'Menu' }) });
    entries.push({ label: 'Echo Shard Shop', sub: 'permanent boons', onClick: () => fadeToScene(this, 'ShardShop') });
    entries.push({ label: 'Lore Codex', sub: 'what you have learned', onClick: () => fadeToScene(this, 'LoreCodex') });
    entries.push({ label: 'Settings', sub: 'sound · text · difficulty', onClick: () => fadeToScene(this, 'Settings') });

    const created: Button[] = [];
    entries.forEach((e, i) => {
      const localY = navPanel.contentY + 34 + i * 72;
      const btn = createButton(
        this,
        0,
        localY,
        e.label,
        e.onClick,
        {
          width: 424,
          height: 58,
          subtitle: e.sub,
          variant: i === 0 && canContinue ? 'primary' : 'secondary',
        },
      );
      navPanel.container.add(btn.container);
      btn.container.setAlpha(0);
      this.tweens.add({ targets: btn.container, alpha: 1, duration: 260, delay: 120 + i * 70, ease: 'Sine.easeOut' });
      created.push(btn);
    });
    void created;

    // ---- Expedition ledger ------------------------------------------------------
    const ledger = createPanel(this, { x: 900, y: 470, width: 400, height: 520, variant: 'parchment', title: 'Expedition Ledger' });
    // The journal opens like a cover: horizontal unfurl.
    if (!reducedMotion()) {
      ledger.container.setScale(0.04, 1).setAlpha(0);
      this.tweens.add({ targets: ledger.container, scaleX: 1, alpha: 1, duration: 420, delay: 160, ease: 'Cubic.easeOut' });
    }

    const lx = -ledger.width / 2 + 26;
    let ly = ledger.contentY + 6;

    const statRow = (label: string, value: string) => {
      const l = this.add.text(lx, ly, label.toUpperCase(), { fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.inkSoft }).setLetterSpacing(1);
      const v = this.add.text(ledger.width / 2 - 26, ly, value, { fontFamily: FONT_MONO, fontSize: '16px', color: PALETTE_HEX.ink }).setOrigin(1, 0);
      ledger.container.add([l, v]);
      ly += 34;
    };

    statRow('Echo Shards · Bank', String(meta.echoShards));
    statRow('Descents', String(meta.totalRuns));
    statRow('Endings witnessed', `${meta.endingsAchieved.length} / ${ENDINGS.length}`);
    ly += 6;
    createDivider(this, ledger.container, 0, ly, ledger.width - 52);
    ly += 22;
    void createSectionLabel;

    if (canContinue) {
      const p = useGameStore.getState().player;
      const g = useGameStore.getState().game;
      const chapter = g ? Math.min(5, Math.max(1, Math.ceil((g.currentNodeIndex || 1) / 40))) : 1;
      this.add.text(lx, ly, 'JOURNAL IN PROGRESS', {
        fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.oxblood,
      }).setLetterSpacing(2);
      ly += 26;
      const lines = [
        p?.name ? `${p.name}` : 'A Seeker, unnamed',
        `Chapter ${chapter} of 5`,
        `Node ${g?.currentNodeIndex ?? 1} of 200`,
      ];
      for (const line of lines) {
        this.add.text(lx, ly, line, { fontFamily: FONT_BODY, fontSize: '16px', color: PALETTE_HEX.ink, fontStyle: 'italic' });
        ly += 24;
      }
      ly += 10;
      this.add.text(lx, ly, '"The stair down is still there."', {
        fontFamily: FONT_BODY, fontSize: '13px', color: PALETTE_HEX.inkSoft, fontStyle: 'italic',
      });
    } else {
      const quote = this.add.text(
        -ledger.width / 2 + 30, ly + 40,
        '"The Deep stares at you. The emotion in its gaze is\nthe comfort of freedom itself."',
        { fontFamily: FONT_BODY, fontSize: '15px', color: PALETTE_HEX.inkSoft, fontStyle: 'italic', wordWrap: { width: ledger.width - 60 } },
      );
      void quote;
      this.add.text(-ledger.width / 2 + 30, ly + 130, '— THE JOURNAL', {
        fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.oxide,
      }).setLetterSpacing(2);
    }

    // ---- Footer -----------------------------------------------------------------
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 28, 'THE HOLLOW BENEATH · definitive edition · Team Akrasia', {
        fontFamily: FONT_BODY,
        fontSize: '13px',
        color: '#7a746a',
      })
      .setOrigin(0.5);
    void FONT_BODY;
  }

  /** Slow drifting ash motes over everything. */
  private spawnDust(): void {
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT;
      const mote = this.add.image(x, y, 'particle')
        .setTint(0xc9a24b)
        .setAlpha(0.06 + Math.random() * 0.1)
        .setScale(0.4 + Math.random() * 0.7)
        .setDepth(1);
      this.tweens.add({
        targets: mote,
        y: y - 60 - Math.random() * 80,
        x: x + (Math.random() - 0.5) * 40,
        alpha: 0.02,
        duration: 8000 + Math.random() * 9000,
        repeat: -1,
        delay: Math.random() * 6000,
        onRepeat: () => mote.setPosition(Math.random() * GAME_WIDTH, GAME_HEIGHT + 10),
      });
    }
  }
}
