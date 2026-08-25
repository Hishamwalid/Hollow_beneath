import Phaser from 'phaser';
import { LORE_FRAGMENTS, TOTAL_LORE_FRAGMENTS } from '@data/loreFragments';
import { useGameStore } from '@store/gameStore';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { settleIn } from '@systems/motion';
import { FONT_BODY, FONT_SERIF, FONT_MONO, PALETTE_HEX, DAMAGE_TYPE_HEX } from '@ui/uiTheme';
import { createButton } from '@ui/Button';
import { createTitle } from '@ui/headings';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';
import { ENEMIES } from '@data/enemies';
import { BOSSES } from '@data/bosses';
import type { AffinityKind, DamageType, EnemyAffinities } from '@data/types';
import { DAMAGE_TYPES, DAMAGE_TYPE_ABBREV } from '@data/types';

const PER_PAGE = 4;
const ROW_H = 130;
const LIST_TOP = 125;

type CodexTab = 'lore' | 'bestiary';

interface BestiaryRow {
  id: string;
  name: string;
  level?: number;
  affinities: EnemyAffinities; // discovered slots only
  kills: number;
}

const AFFINITY_HEX: Record<AffinityKind, number> = {
  wk: 0xe9c876,
  str: 0x7fb0c9,
  null: 0x555555,
  rep: 0xc0392b,
  drn: 0x5c8a5c,
  '-': 0x9a9488,
};

/** Lore fragments + persistent Bestiary (Scan discoveries), browsable side by side. */
export class LoreCodexScene extends Phaser.Scene {
  private page = 0;
  private listContainer?: Phaser.GameObjects.Container;
  private pageLabel?: Phaser.GameObjects.Text;
  private headerNote?: Phaser.GameObjects.Text;
  private tab: CodexTab = 'lore';
  private tabButtons!: { lore: ReturnType<typeof createButton>; bestiary: ReturnType<typeof createButton> };
  private allIds: string[] = [];
  private discovered: string[] = [];
  private bestiaryRows: BestiaryRow[] = [];

  constructor() {
    super('LoreCodex');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    settleIn(this);
    this.page = 0;
    this.tab = 'lore';
    const cx = GAME_WIDTH / 2;
    const { player, meta } = useGameStore.getState();
    // Permanently banked + current-run finds, so the codex is accurate mid-run too.
    this.discovered = Array.from(new Set([...meta.loreFragmentsSeen, ...(player?.loreFragments ?? [])]));
    this.allIds = Object.keys(LORE_FRAGMENTS).sort();
    this.bestiaryRows = this.buildBestiaryRows();

    createTitle(this, cx, 44, 'Lore Codex');
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
      bestiary: createButton(this, cx - 40, GAME_HEIGHT - 50, 'Bestiary', () => this.switchTab('bestiary'), { width: 190, height: 42 }),
    };
    this.tintTab(this.tab);
    createButton(this, cx - 540, GAME_HEIGHT - 50, '< Prev', () => this.changePage(-1), { width: 150, height: 42 });
    createButton(this, cx + 200, GAME_HEIGHT - 50, 'Next >', () => this.changePage(1), { width: 150, height: 42 });
    createButton(this, cx + 420, GAME_HEIGHT - 50, 'Back to Menu', () => fadeToScene(this, 'Menu'), { width: 170, height: 42 });

    this.renderPage();
  }

  private tabLine(): string {
    if (this.tab === 'lore') return `${this.discovered.length} / ${TOTAL_LORE_FRAGMENTS} fragments discovered`;
    const known = this.bestiaryRows.filter((r) => Object.keys(r.affinities).length > 0).length;
    return `${known} / ${this.bestiaryRows.length} enemies encountered`;
  }

  private tintTab(active: CodexTab) {
    for (const key of ['lore', 'bestiary'] as const) {
      const b = this.tabButtons[key];
      if (!b) continue;
      const img = b.container.list[0] as Phaser.GameObjects.Image;
      if (key === active) img.setTint(parseInt(PALETTE_HEX.gold.replace('#', ''), 16));
      else img.clearTint();
    }
  }

  private switchTab(tab: CodexTab) {
    if (this.tab === tab) return;
    this.tab = tab;
    this.page = 0;
    this.bestiaryRows = this.buildBestiaryRows();
    this.headerNote?.setText(this.tabLine());
    this.tintTab(this.tab);
    this.renderPage();
  }

  private buildBestiaryRows(): BestiaryRow[] {
    const rows: BestiaryRow[] = [];
    for (const [id, def] of Object.entries(ENEMIES)) {
      if (def.minResonance && id !== 'the_unread' && id !== 'memory_wraith') continue;
      rows.push({
        id,
        name: def.name,
        level: def.level,
        affinities: useGameStore.getState().meta.discoveredAffinities[id] ?? {},
        kills: useGameStore.getState().meta.bestiaryKills[id] ?? 0,
      });
    }
    for (const [id, boss] of Object.entries(BOSSES)) {
      const base = boss.phases[0]?.affinities ?? {};
      rows.push({
        id,
        name: boss.name,
        level: boss.level,
        affinities: useGameStore.getState().meta.discoveredAffinities[id] ?? {},
        kills: useGameStore.getState().meta.bestiaryKills[id] ?? 0,
      });
      void base;
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  private changePage(delta: number) {
    const maxPage = Math.ceil(this.pageSize() / PER_PAGE) - 1;
    const next = Math.max(0, Math.min(maxPage, this.page + delta));
    if (next === this.page) return;
    this.page = next;
    this.renderPage();
  }

  private pageSize(): number {
    return this.tab === 'lore' ? this.allIds.length : this.bestiaryRows.length;
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
            color: known ? PALETTE_HEX.bone : PALETTE_HEX.boneMuted,
            wordWrap: { width: 860 },
            lineSpacing: 4,
          }
        );
        container.add([bg, title, body]);
      });
    } else {
      const slice = this.bestiaryRows.slice(start, start + PER_PAGE);
      slice.forEach((entry, i) => {
        const rowY = LIST_TOP + i * ROW_H + ROW_H / 2 - 8;
        const knownCount = Object.keys(entry.affinities).length;
        const bg = this.add.rectangle(cx, rowY, 960, ROW_H - 14, 0x16191d)
          .setStrokeStyle(1, knownCount >= 6 ? 0x3a3226 : 0x2a2e33);

        const lv = entry.level != null ? `   Lv ${entry.level}` : '';
        const kills = entry.kills > 0 ? `   — slain ×${entry.kills}` : '';
        const name = this.add.text(cx - 440, rowY - ROW_H / 2 + 16, `${entry.name}${lv}${kills}`, {
          fontFamily: FONT_SERIF,
          fontSize: '17px',
          color: PALETTE_HEX.gold,
        });
        container.add([bg, name]);

        // Affinity grid: 8 type chips over result chips (matches the in-combat Scan card).
        const chipX0 = cx - 420;
        const chipW = 52;
        const gap = 12;
        DAMAGE_TYPES.forEach((t, idx) => {
          const x = chipX0 + idx * (chipW + gap);
          const kind = entry.affinities[t as DamageType];
          const known = kind !== undefined;

          const topBg = this.add.rectangle(x + chipW / 2, rowY - 18, chipW, 26, 0x21252c).setStrokeStyle(1, 0x3a3f46);
          const topLabel = this.add.text(x + chipW / 2, rowY - 18, DAMAGE_TYPE_ABBREV[t], {
            fontFamily: FONT_MONO,
            fontSize: '13px',
            color: `#${(DAMAGE_TYPE_HEX[t] ?? '9a9488').replace('#', '')}`,
          }).setOrigin(0.5);

          const botBg = this.add.rectangle(x + chipW / 2, rowY + 16, chipW, 22, 0x21252c).setStrokeStyle(1, 0x3a3f46);
          const botLabel = this.add.text(x + chipW / 2, rowY + 16, known ? kind! : '?', {
            fontFamily: FONT_MONO,
            fontSize: '13px',
            color: known ? `#${AFFINITY_HEX[kind!].toString(16).padStart(6, '0')}` : PALETTE_HEX.boneMuted,
          }).setOrigin(0.5);

          container.add([topBg, topLabel, botBg, botLabel]);
        });

        const note = this.add.text(
          cx + 120,
          rowY - ROW_H / 2 + 20,
          knownCount === 0
            ? 'Unknown. Strike it in battle or use Full Knowledge.'
            : `${knownCount}/8 affinity slots mapped.`,
          {
            fontFamily: FONT_BODY,
            fontSize: '13px',
            fontStyle: 'italic',
            color: PALETTE_HEX.boneMuted,
            wordWrap: { width: 240 },
          }
        );
        container.add([note]);
      });
    }
  }
}
