import type { BoardNode, NodeType } from '@data/types';
import { enemiesForPage } from '@data/enemies';
import { pick } from './rng';

export const CHECKPOINTS = [20, 40, 60, 80];
export const LANDMARK_INDICES = [20, 40, 60, 80, 100];
export const CAPTURE_INDICES = [10, 30, 50, 70, 90];

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

export function pageForIndex(index: number): number {
  return Math.min(10, Math.ceil(index / 10));
}

/** Builds the full 100-node board. Deterministic given the same seeded rng. */
export function generateBoard(rng: () => number): BoardNode[] {
  const nodes: BoardNode[] = [];
  const trapPool = ['memory_trap', 'collapsing_floor'];

  for (let i = 1; i <= 100; i++) {
    const page = pageForIndex(i);

    if (LANDMARK_INDICES.includes(i)) {
      const bossId = { 20: 'sentinel', 40: 'patriarch', 60: 'chorus', 80: 'fossil_king', 100: 'reflection' }[i]!;
      nodes.push({ index: i, page, type: 'landmark', subtype: bossId, resolved: false });
      continue;
    }
    if (CAPTURE_INDICES.includes(i)) {
      nodes.push({ index: i, page, type: 'discovery', subtype: 'capture_point', resolved: false });
      continue;
    }

    const type = weightedNodeType(rng);
    let subtype = '';
    if (type === 'combat') {
      const pool = enemiesForPage(page, 0); // resonance-gated enemies (memory wraith) resolved live at encounter time
      subtype = pick(pool, rng);
    } else if (type === 'trap') {
      subtype = pick(trapPool, rng);
    } else if (type === 'event') {
      subtype = ''; // resolved live by EventEngine (depends on live resonance/seen-set)
    } else if (type === 'discovery') {
      subtype = 'discovery';
    } else {
      subtype = 'rest';
    }
    nodes.push({ index: i, page, type, subtype, resolved: false });
  }
  return nodes;
}

/** Enemy stat scaling per page — GDD balance config (hpPerPage 0.1, atkPerPage 0.075, defPerPage 0.05). */
export function pageScaling(page: number) {
  const p = page - 1;
  return {
    hp: 1 + 0.1 * p,
    atk: 1 + 0.075 * p,
    def: 1 + 0.05 * p,
  };
}
