import type { BoardNode, NodeType } from '@data/types';
import { enemiesForChapter } from '@data/enemies';
import { pick } from './rng';
import { TOTAL_NODES, NODES_PER_CHAPTER, CHAPTERS } from '@/config';

export const CHECKPOINTS = [40, 80, 120, 160];
export const LANDMARK_INDICES = [40, 80, 120, 160, 200];
export const CAPTURE_INDICES = [10, 30, 50, 70, 90, 110, 130, 150, 170, 190];
/** Phase 5: fixed encounter points where companions can join the run. */
export const ALLY_INDICES: Record<number, string> = {
  25: 'warden_emissary',
  70: 'covenant_courier',
  115: 'sable_zealot',
  160: 'archive_cartographer',
};

const NODE_WEIGHTS: Array<[NodeType, number]> = [
  ['event', 45],
  ['combat', 22],
  ['rest', 12],
  ['discovery', 13],
  ['trap', 8],
];
const TOTAL_WEIGHT = NODE_WEIGHTS.reduce((s, [, w]) => s + w, 0); // 100

function weightedNodeType(rng: () => number): NodeType {
  let roll = rng() * TOTAL_WEIGHT;
  for (const [type, weight] of NODE_WEIGHTS) {
    if (roll < weight) return type;
    roll -= weight;
  }
  return 'event';
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

/** Builds the full 200-node board. Deterministic given the same seeded rng. */
export function generateBoard(rng: () => number): BoardNode[] {
  const nodes: BoardNode[] = [];
  const trapPool = ['memory_trap', 'collapsing_floor', 'identity_trap', 'collapsing_ceiling'];

  for (let i = 1; i <= TOTAL_NODES; i++) {
    const chapter = chapterForIndex(i);

    if (LANDMARK_INDICES.includes(i)) {
      const bossId = { 40: 'sentinel', 80: 'patriarch', 120: 'chorus', 160: 'fossil_king', 200: 'reflection' }[i]!;
      nodes.push({ index: i, chapter, type: 'landmark', subtype: bossId, resolved: false });
      continue;
    }
    if (CAPTURE_INDICES.includes(i)) {
      nodes.push({ index: i, chapter, type: 'discovery', subtype: 'capture_point', resolved: false });
      continue;
    }
    if (ALLY_INDICES[i]) {
      nodes.push({ index: i, chapter, type: 'discovery', subtype: `ally:${ALLY_INDICES[i]}`, resolved: false });
      continue;
    }

    const type = weightedNodeType(rng);
    let subtype = '';
    if (type === 'combat') {
      const pool = enemiesForChapter(chapter, 0);
      subtype = pick(pool, rng) ?? 'dust_road_raider';
    } else if (type === 'trap') {
      subtype = pick(trapPool, rng) ?? 'memory_trap';
    } else if (type === 'event') {
      subtype = ''; // resolved live by EventEngine (depends on live resonance/seen-set)
    } else if (type === 'discovery') {
      subtype = 'discovery';
    } else {
      subtype = 'rest';
    }
    nodes.push({ index: i, chapter, type, subtype, resolved: false });
  }
  return nodes;
}
