import Phaser from 'phaser';
import { LORE_FRAGMENTS, TOTAL_LORE_FRAGMENTS } from '@data/loreFragments';
import { useGameStore } from '@store/gameStore';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { FONT_BODY, FONT_SERIF, FONT_MONO, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

const PER_PAGE = 4;
const ROW_H = 130;
const LIST_TOP = 125;

/** Lists every lore fragment id, always in the same order regardless of discovery order, so rows don't reshuffle as the player finds more. */
export class LoreCodexScene extends Phaser.Scene {
  private page = 0;
  private listContainer?: Phaser.GameObjects.Container;
  private pageLabel?: Phaser.GameObjects.Text;
  private allIds: string[] = [];
  private discovered: string[] = [];

  constructor() {
    super('LoreCodex');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    this.page = 0;
    const cx = GAME_WIDTH / 2;
    const { player, meta } = useGameStore.getState();
    // Permanently banked (from runs that reached an ending) + whatever the current active run has found so far,
    // so the codex is accurate whether you're between runs or mid-run.
    this.discovered = Array.from(new Set([...meta.loreFragmentsSeen, ...(player?.loreFragments ?? [])]));
    this.allIds = Object.keys(LORE_FRAGMENTS).sort();

    this.add.text(cx, 50, 'Lore Codex', { fontFamily: FONT_SERIF, fontSize: '34px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.add
      .text(cx, 86, `${this.discovered.length} / ${TOTAL_LORE_FRAGMENTS} fragments discovered`, {
        fontFamily: FONT_MONO,
        fontSize: '15px',
        color: PALETTE_HEX.boneMuted,
      })
      .setOrigin(0.5);

    this.pageLabel = this.add
      .text(cx, GAME_HEIGHT - 110, '', { fontFamily: FONT_MONO, fontSize: '15px', color: PALETTE_HEX.boneMuted })
      .setOrigin(0.5);

    createButton(this, cx - 200, GAME_HEIGHT - 50, '< Prev', () => this.changePage(-1), { width: 160, height: 42 });
    createButton(this, cx, GAME_HEIGHT - 50, 'Back to Menu', () => fadeToScene(this, 'Menu'), { width: 220, height: 42 });
    createButton(this, cx + 200, GAME_HEIGHT - 50, 'Next >', () => this.changePage(1), { width: 160, height: 42 });

    this.renderPage();
  }

  private changePage(delta: number) {
    const maxPage = Math.ceil(this.allIds.length / PER_PAGE) - 1;
    const next = Math.max(0, Math.min(maxPage, this.page + delta));
    if (next === this.page) return;
    this.page = next;
    this.renderPage();
  }

  private renderPage() {
    this.listContainer?.destroy();
    const container = this.add.container(0, 0);
    this.listContainer = container;
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 220, ease: 'Sine.easeOut' });

    const maxPage = Math.ceil(this.allIds.length / PER_PAGE) - 1;
    this.pageLabel?.setText(`Page ${this.page + 1} / ${maxPage + 1}`);

    const start = this.page * PER_PAGE;
    const slice = this.allIds.slice(start, start + PER_PAGE);
    const cx = GAME_WIDTH / 2;

    slice.forEach((id, i) => {
      const frag = LORE_FRAGMENTS[id];
      const known = this.discovered.includes(id);
      const rowY = LIST_TOP + i * ROW_H + ROW_H / 2 - 8;

      const bg = this.add.rectangle(cx, rowY, 960, ROW_H - 14, 0x16191d).setStrokeStyle(1, known ? 0x3a3226 : 0x2a2e33);
      const title = this.add.text(cx - 440, rowY - ROW_H / 2 + 18, known ? frag.title : '??? — Undiscovered', {
        fontFamily: FONT_SERIF,
        fontSize: '17px',
        color: known ? PALETTE_HEX.gold : PALETTE_HEX.boneMuted,
      });
      const body = this.add.text(
        cx - 440,
        rowY - ROW_H / 2 + 46,
        known ? frag.text : 'Somewhere in the descent, this fragment is still waiting to be found.',
        {
          fontFamily: FONT_BODY,
          fontSize: '14px',
          fontStyle: known ? 'italic' : 'normal',
          color: known ? PALETTE_HEX.bone : '#555555',
          wordWrap: { width: 860 },
          lineSpacing: 4,
        }
      );
      container.add([bg, title, body]);
    });

    if (slice.length === 0) {
      this.add.text(cx, LIST_TOP + 40, 'No fragments to show.', { fontFamily: FONT_SERIF, fontSize: '16px', color: PALETTE_HEX.boneMuted }).setOrigin(0.5);
    }
  }
}
