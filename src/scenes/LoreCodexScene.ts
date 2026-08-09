import Phaser from 'phaser';
import { LORE_FRAGMENTS, TOTAL_LORE_FRAGMENTS } from '@data/loreFragments';
import { useGameStore } from '@store/gameStore';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { FONT_BODY, FONT_SERIF, FONT_MONO, PALETTE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';
import { ENEMIES } from '@data/enemies';
import { BOSSES } from '@data/bosses';
import type { BossDef, EnemyDef } from '@data/types';
import { ARCHIVE_FRAGMENT_NAMES } from '@systems/combat/ArchiveSystem';

const PER_PAGE = 4;
const ROW_H = 130;
const LIST_TOP = 125;

type CodexTab = 'lore' | 'archive';

interface ArchiveRow {
  id: string;
  name: string;
  fragments: number;
  exploited: boolean;
}

/** Lore fragments + Phase 6c persistent Enemy Archive, browsable side by side. */
export class LoreCodexScene extends Phaser.Scene {
  private page = 0;
  private listContainer?: Phaser.GameObjects.Container;
  private pageLabel?: Phaser.GameObjects.Text;
  private headerNote?: Phaser.GameObjects.Text;
  private tab: CodexTab = 'lore';
  private tabButtons!: { lore: ReturnType<typeof createButton>; archive: ReturnType<typeof createButton> };
  private allIds: string[] = [];
  private discovered: string[] = [];
  private archiveEntries: ArchiveRow[] = [];

  constructor() {
    super('LoreCodex');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    this.page = 0;
    this.tab = 'lore';
    const cx = GAME_WIDTH / 2;
    const { player, meta } = useGameStore.getState();
    // Permanently banked (from runs that reached an ending) + whatever the current active run has found so far,
    // so the codex is accurate whether you're between runs or mid-run.
    this.discovered = Array.from(new Set([...meta.loreFragmentsSeen, ...(player?.loreFragments ?? [])]));
    this.allIds = Object.keys(LORE_FRAGMENTS).sort();
    this.archiveEntries = this.buildArchiveEntries(meta.enemyArchive ?? {});

    this.add.text(cx, 44, 'The Codex', { fontFamily: FONT_SERIF, fontSize: '34px', color: PALETTE_HEX.gold }).setOrigin(0.5);
    this.headerNote = this.add
      .text(cx, 82, this.tabLine(), {
        fontFamily: FONT_MONO,
        fontSize: '15px',
        color: PALETTE_HEX.boneMuted,
      })
      .setOrigin(0.5);

    this.pageLabel = this.add
      .text(cx, GAME_HEIGHT - 110, '', { fontFamily: FONT_MONO, fontSize: '15px', color: PALETTE_HEX.boneMuted })
      .setOrigin(0.5);

    this.tabButtons = {
      lore: createButton(this, cx - 260, GAME_HEIGHT - 50, 'Lore Fragments', () => this.switchTab('lore'), { width: 190, height: 42 }),
      archive: createButton(this, cx - 40, GAME_HEIGHT - 50, 'Enemy Archive', () => this.switchTab('archive'), { width: 190, height: 42 }),
    };
    this.tintTab(this.tab);
    createButton(this, cx - 540, GAME_HEIGHT - 50, '< Prev', () => this.changePage(-1), { width: 150, height: 42 });
    createButton(this, cx + 200, GAME_HEIGHT - 50, 'Next >', () => this.changePage(1), { width: 150, height: 42 });
    createButton(this, cx + 420, GAME_HEIGHT - 50, 'Back to Menu', () => fadeToScene(this, 'Menu'), { width: 170, height: 42 });

    this.renderPage();
  }

  private tabLine(): string {
    if (this.tab === 'lore') return `${this.discovered.length} / ${TOTAL_LORE_FRAGMENTS} fragments discovered`;
    const total = this.archiveEntries.length;
    const complete = this.archiveEntries.filter((e) => e.exploited).length;
    return `${complete} / ${total} enemies fully catalogued`;
  }

  private tintTab(active: CodexTab) {
    for (const key of ['lore', 'archive'] as const) {
      const b = this.tabButtons[key];
      if (!b) continue;
      const img = b.container.list[0] as Phaser.GameObjects.Image;
      if (key === active) {
        img.setTint(parseInt(PALETTE_HEX.gold.replace('#', ''), 16));
      } else {
        img.clearTint();
      }
    }
  }

  private switchTab(tab: CodexTab) {
    if (this.tab === tab) return;
    this.tab = tab;
    this.page = 0;
    this.headerNote?.setText(this.tabLine());
    this.tintTab(this.tab);
    this.renderPage();
  }

  private buildArchiveEntries(archive: Record<string, { fragments: string[]; exploited: boolean }>): ArchiveRow[] {
    const entries: ArchiveRow[] = [];
    for (const [id, def] of Object.entries(ENEMIES) as [string, EnemyDef][]) {
      const entry = archive[id];
      entries.push({ id, name: def.name, fragments: entry?.fragments.length ?? 0, exploited: entry?.exploited ?? false });
    }
    for (const [id, def] of Object.entries(BOSSES) as [string, BossDef][]) {
      const entry = archive[id];
      entries.push({ id, name: def.name, fragments: entry?.fragments.length ?? 0, exploited: entry?.exploited ?? false });
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }

  private changePage(delta: number) {
    const maxPage = Math.ceil(this.pageSize() / PER_PAGE) - 1;
    const next = Math.max(0, Math.min(maxPage, this.page + delta));
    if (next === this.page) return;
    this.page = next;
    this.renderPage();
  }

  private pageSize(): number {
    return this.tab === 'lore' ? this.allIds.length : this.archiveEntries.length;
  }

  private renderPage() {
    this.listContainer?.destroy();
    const container = this.add.container(0, 0);
    this.listContainer = container;
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 220, ease: 'Sine.easeOut' });

    const maxPage = Math.ceil(this.pageSize() / PER_PAGE) - 1;
    this.pageLabel?.setText(`Page ${this.page + 1} / ${maxPage + 1}`);
    const cx = GAME_WIDTH / 2;
    const start = this.page * PER_PAGE;

    if (this.tab === 'lore') {
      const slice = this.allIds.slice(start, start + PER_PAGE);
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
    } else {
      const slice = this.archiveEntries.slice(start, start + PER_PAGE);
      slice.forEach((entry, i) => {
        const rowY = LIST_TOP + i * ROW_H + ROW_H / 2 - 8;
        const bg = this.add.rectangle(cx, rowY, 960, ROW_H - 14, 0x16191d).setStrokeStyle(1, entry.exploited ? 0x3a3226 : 0x2a2e33);
        container.add([bg]);

        const name = this.add.text(cx - 440, rowY - ROW_H / 2 + 18, entry.name, {
          fontFamily: FONT_SERIF,
          fontSize: '17px',
          color: PALETTE_HEX.gold,
        });
        container.add([name]);

        const bars = ARCHIVE_FRAGMENT_NAMES.map((fragmentName, idx) => {
          const fill = idx < entry.fragments ? '▰' : '▱';
          return `${fill} ${fragmentName}`;
        }).join('   ');
        const status = this.add.text(cx - 440, rowY - ROW_H / 2 + 46, `Catalogue: ${bars}`, {
          fontFamily: FONT_MONO,
          fontSize: '13px',
          color: entry.exploited ? PALETTE_HEX.goldBright : PALETTE_HEX.boneMuted,
        });
        container.add([status]);

        const note = this.add.text(
          cx - 440,
          rowY - ROW_H / 2 + 72,
          entry.exploited
            ? 'Fully catalogued — this foe is permanently vulnerable to the Archive Exploit in combat.'
            : `${ARCHIVE_FRAGMENT_NAMES.length - entry.fragments} fragment(s) remaining. Scan or defeat it in combat to learn more.`,
          {
            fontFamily: FONT_BODY,
            fontSize: '14px',
            fontStyle: 'italic',
            color: entry.exploited ? PALETTE_HEX.bone : PALETTE_HEX.boneMuted,
            wordWrap: { width: 860 },
          }
        );
        container.add([note]);
      });
    }

    if (this.pageSize() === 0) {
      this.add.text(cx, LIST_TOP + 40, 'Nothing to show yet.', { fontFamily: FONT_SERIF, fontSize: '16px', color: PALETTE_HEX.boneMuted }).setOrigin(0.5);
    }
  }
}