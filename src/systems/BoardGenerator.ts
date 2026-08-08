import type { BoardNode, NodeType } from '@data/types';
import { enemiesForPage } from '@data/enemies';
import { pick } from './rng';
import { TOTAL_NODES, NODES_PER_PAGE, PAGES } from '@/config';

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

export function pageForIndex(index: number): number {
  return Math.min(PAGES, Math.ceil(index / NODES_PER_PAGE));
}

/** Builds the full 200-node board. Deterministic given the same seeded rng. */
export function generateBoard(rng: () => number): BoardNode[] {
  const nodes: BoardNode[] = [];
  const trapPool = ['memory_trap', 'collapsing_floor', 'identity_trap', 'collapsing_ceiling'];

  for (let i = 1; i <= TOTAL_NODES; i++) {
    const page = pageForIndex(i);

    if (LANDMARK_INDICES.includes(i)) {
      const bossId = { 40: 'sentinel', 80: 'patriarch', 120: 'chorus', 160: 'fossil_king', 200: 'reflection' }[i]!;
      nodes.push({ index: i, page, type: 'landmark', subtype: bossId, resolved: false });
      continue;
    }
    if (CAPTURE_INDICES.includes(i)) {
      nodes.push({ index: i, page, type: 'discovery', subtype: 'capture_point', resolved: false });
      continue;
    }
    if (ALLY_INDICES[i]) {
      nodes.push({ index: i, page, type: 'discovery', subtype: `ally:${ALLY_INDICES[i]}`, resolved: false });
      continue;
    }

    const type = weightedNodeType(rng);
    let subtype = '';
    if (type === 'combat') {
      const pool = enemiesForPage(page, 0);
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
