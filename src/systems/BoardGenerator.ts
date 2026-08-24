import type { BoardNode, NodeType } from '@data/types';
import { enemiesForChapter } from '@data/enemies';
import { pick } from './rng';
import { TOTAL_NODES, NODES_PER_CHAPTER, CHAPTERS } from '@/config';
import { PINNED_STORY_EVENTS } from '@data/storyEvents';

export const CHECKPOINTS = [40, 80, 120, 160];
export const LANDMARK_INDICES = [40, 80, 120, 160, 200];
export const CAPTURE_INDICES = [10, 30, 50, 70, 90, 110, 130, 150, 170, 190];

const NODE_WEIGHTS: Array<[NodeType, number]> = [
  ['event', 45],
  ['combat', 22],
  ['rest', 12],
  ['discovery', 13],
  ['trap', 8],
];
const TOTAL_WEIGHT = NODE_WEIGHTS.reduce((s, [, w]) => s + w, 0); // 100

/** How many free slots per distribution group — every ~10 nodes gets a fair share. */
const DISTRIBUTION_GROUP_SIZE = 10;

/**
 * Exact-length weighted bag via largest-remainder rounding. A 10-slot bag is
 * guaranteed to contain ~4-5 events, 2 combat, 1 rest, 1 discovery, 1 trap.
 */
export function buildQuotaBag(slots: number): NodeType[] {
  if (slots <= 0) return [];
  const parts = NODE_WEIGHTS.map(([type, weight]) => {
    const exact = (slots * weight) / TOTAL_WEIGHT;
    return { type, count: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let remaining = slots - parts.reduce((s, p) => s + p.count, 0);
  for (const part of [...parts].sort((a, b) => b.frac - a.frac)) {
    if (remaining <= 0) break;
    part.count++;
    remaining--;
  }
  const bag: NodeType[] = [];
  for (const part of parts) for (let i = 0; i < part.count; i++) bag.push(part.type);
  return bag;
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function chapterForIndex(index: number): number {
  return Math.min(CHAPTERS, Math.max(1, Math.ceil(index / NODES_PER_CHAPTER)));
}

/**
 * Continuous descent-depth scalar for a node (0 at node 1 → 19.9 at node 200).
 * Replaces the old per-page scaling so difficulty still grows smoothly with
 * position even though the board is now organised purely into chapters.
 */
export function depthForIndex(index: number): number {
  return Math.max(0, index - 1) / 10;
}

/** Enemy stat scaling by node position — GDD balance curve (hp .1/step, atk .075/step, def .05/step). */
export function scalingForIndex(index: number) {
  const d = depthForIndex(index);
  return {
    hp: 1 + 0.1 * d,
    atk: 1 + 0.075 * d,
    def: 1 + 0.05 * d,
  };
}

function isFixedIndex(i: number): boolean {
  return LANDMARK_INDICES.includes(i) || CAPTURE_INDICES.includes(i) || PINNED_STORY_EVENTS[i] !== undefined;
}

/**
 * Draws `size` types from the remaining chapter pool while keeping the pool's
 * proportions intact (largest-remainder against what's left). Mutates
 * `remaining` — callers consume it group by group, which keeps CHAPTER totals
 * exact while every screenful gets a fair share.
 */
function drawGroup(remaining: Map<NodeType, number>, size: number, rng: () => number): NodeType[] {
  const types = [...remaining.keys()];
  const totalLeft = types.reduce((s, t) => s + (remaining.get(t) ?? 0), 0);
  const parts = types.map((t) => {
    const left = remaining.get(t) ?? 0;
    const exact = totalLeft > 0 ? (left * size) / totalLeft : 0;
    return { t, take: Math.min(left, Math.floor(exact)), frac: exact - Math.floor(exact) };
  });
  let short = size - parts.reduce((s, p) => s + p.take, 0);
  for (const part of [...parts].sort((a, b) => b.frac - a.frac || rng() - 0.5)) {
    if (short <= 0) break;
    if (part.take < (remaining.get(part.t) ?? 0)) {
      part.take++;
      short--;
    }
  }
  const drawn: NodeType[] = [];
  for (const part of parts) {
    if (part.take > 0) {
      remaining.set(part.t, (remaining.get(part.t) ?? 0) - part.take);
      for (let i = 0; i < part.take; i++) drawn.push(part.t);
    }
  }
  return shuffled(drawn, rng);
}

/**
 * Places one group's drawn multiset onto its slots so that no directly
 * consecutive pair shares a type. Randomized backtracking — a solution always
 * exists at these ratios (no type reaches half of any stretch); a
 * largest-first fallback covers the theoretical visit-budget exhaustion.
 */
function arrangeGroup(
  counts: Map<NodeType, number>,
  out: Array<{ idx: number; type: NodeType }>,
  slots: number[],
  prevFreeIdx: number,
  prevType: NodeType | null,
  rng: () => number,
): void {
  const n = slots.length;
  const chosen: NodeType[] = new Array(n);
  let visits = 0;

  const largestFirst = (k: number, prev: NodeType | null): boolean => {
    if (k === n) return true;
    const idx = slots[k];
    const blocked: NodeType | null = k === 0 ? (idx === prevFreeIdx + 1 ? prevType : null) : prev;
    const candidates = [...counts.entries()].filter(([t, c]) => c > 0 && t !== blocked)
      .sort((a, b) => b[1] - a[1]);
    if (candidates.length === 0) return false;
    const t = candidates[0][0];
    counts.set(t, counts.get(t)! - 1);
    chosen[k] = t;
    const ok = largestFirst(k + 1, t);
    if (!ok) counts.set(t, counts.get(t)! + 1);
    return ok;
  };

  const place = (k: number, prev: NodeType | null): boolean => {
    if (k === n) return true;
    if (++visits > 20000) return largestFirst(k, prev);
    const idx = slots[k];
    const blocked: NodeType | null = k === 0 ? (idx === prevFreeIdx + 1 ? prevType : null) : prev;
    const candidates = [...counts.entries()].filter(([t, c]) => c > 0 && t !== blocked);

    // Weighted shuffle of the candidate order.
    const tmp = new Map(candidates);
    const order: NodeType[] = [];
    while (tmp.size > 0) {
      const total = [...tmp.values()].reduce((s, c) => s + c, 0);
      let roll = rng() * total;
      for (const [t, c] of tmp) {
        roll -= c;
        if (roll <= 0) { order.push(t); tmp.delete(t); break; }
      }
    }

    for (const t of order) {
      counts.set(t, counts.get(t)! - 1);
      chosen[k] = t;
      if (place(k + 1, t)) return true;
      counts.set(t, counts.get(t)! + 1);
    }
    return false;
  };

  if (!place(0, prevType)) largestFirst(0, prevType);
  slots.forEach((idx, k) => out.push({ idx, type: chosen[k] }));
}

/**
 * Builds the full 200-node board. Deterministic given the same seeded rng.
 *
 * Distribution rules:
 *  - Fixed nodes (landmarks / capture points / story beats) are placed first.
 *  - Each chapter's free slots receive an EXACT weighted quota of node types
 *    (event 45 / combat 22 / rest 12 / discovery 13 / trap 8), dealt in groups
 *    of ~10 so every screenful gets a fair share.
 *  - Placement is constrained so two directly adjacent free slots never share
 *    a type — fixed nodes break adjacency. Feasible by construction: no type's
 *    share approaches 50% of any stretch.
 */
export function generateBoard(rng: () => number): BoardNode[] {
  const nodes: BoardNode[] = new Array(TOTAL_NODES);
  const trapPool = ['memory_trap', 'collapsing_floor', 'identity_trap', 'collapsing_ceiling'];

  // ---- Pass 1: fixed nodes; collect free slots per chapter -------------------
  const freeByChapter: number[][] = Array.from({ length: CHAPTERS + 1 }, () => []);
  for (let i = 1; i <= TOTAL_NODES; i++) {
    const chapter = chapterForIndex(i);
    if (LANDMARK_INDICES.includes(i)) {
      const bossId = { 40: 'sentinel', 80: 'patriarch', 120: 'chorus', 160: 'fossil_king', 200: 'reflection' }[i]!;
      nodes[i - 1] = { index: i, chapter, type: 'landmark', subtype: bossId, resolved: false };
      continue;
    }
    if (CAPTURE_INDICES.includes(i)) {
      nodes[i - 1] = { index: i, chapter, type: 'discovery', subtype: 'capture_point', resolved: false };
      continue;
    }
    // Pinned story beats replace whatever would otherwise generate here.
    const storyId = PINNED_STORY_EVENTS[i];
    if (storyId) {
      nodes[i - 1] = { index: i, chapter, type: 'event', subtype: `story:${storyId}`, resolved: false };
      continue;
    }
    freeByChapter[chapter].push(i);
  }

  // ---- Pass 2+3: exact quota deal + no-side-by-side placement -----------------
  for (let chapter = 1; chapter <= CHAPTERS; chapter++) {
    const freeIdx = freeByChapter[chapter];
    const chapterBag = buildQuotaBag(freeIdx.length);
    const remaining = new Map<NodeType, number>();
    for (const t of chapterBag) remaining.set(t, (remaining.get(t) ?? 0) + 1);

    let prevFreeIdx = -Infinity;
    let prevType: NodeType | null = null;
    const placed: Array<{ idx: number; type: NodeType }> = [];

    for (let g = 0; g * DISTRIBUTION_GROUP_SIZE < freeIdx.length; g++) {
      const group = freeIdx.slice(g * DISTRIBUTION_GROUP_SIZE, (g + 1) * DISTRIBUTION_GROUP_SIZE);
      const drawn = drawGroup(remaining, group.length, rng);
      const pool = new Map<NodeType, number>();
      for (const t of drawn) pool.set(t, (pool.get(t) ?? 0) + 1);

      arrangeGroup(pool, placed, group, prevFreeIdx, prevType, rng);
      const last = placed[placed.length - 1];
      prevFreeIdx = last.idx;
      prevType = last.type;
    }

    // ---- Subtypes ------------------------------------------------------------
    for (const { idx, type } of placed) {
      const node: BoardNode = { index: idx, chapter, type, subtype: '', resolved: false };
      if (type === 'combat') {
        const pool = enemiesForChapter(chapter, 0);
        node.subtype = pick(pool, rng) ?? 'dust_road_raider';
      } else if (type === 'trap') {
        node.subtype = pick(trapPool, rng) ?? 'memory_trap';
      } else if (type === 'discovery') {
        node.subtype = 'discovery';
      } else if (type === 'rest') {
        node.subtype = 'rest';
      } else {
        node.subtype = ''; // events resolve live via EventEngine
      }
      nodes[idx - 1] = node;
    }
  }

  return nodes;
}
