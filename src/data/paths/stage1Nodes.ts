/**
 * stage1Nodes.ts
 *
 * OPTION B: uses the 40 hand-picked path anchor points directly as node
 * positions — no spline smoothing, no resampling. What you clicked in
 * PathPointPickerScene is exactly what you get.
 *
 * Node 0 = first click (start of path).
 * Node 39 = last click (boss node, cave mouth).
 *
 * Note: since these are raw clicks, spacing between nodes may be uneven
 * (some of your clicks were ~25px apart, others ~65px+). If you want
 * evenly-spaced nodes instead, see the spline-based version (Option A).
 */

import stage1PathData from './stage1_path.json';

export interface StageNode {
  index: number;
  x: number;
  y: number;
  isStart: boolean;
  isBoss: boolean;
}

interface PathPoint {
  x: number;
  y: number;
}

interface StagePathData {
  stage: string;
  sourceImage: string;
  imageWidth: number;
  imageHeight: number;
  pointCount: number;
  points: PathPoint[];
}

/**
 * Maps the raw clicked anchor points directly to StageNode objects,
 * in click order, with no interpolation or resampling.
 */
export function generateStageNodes(
  pathData: StagePathData = stage1PathData as StagePathData
): StageNode[] {
  const { points } = pathData;

  if (points.length === 0) {
    throw new Error('generateStageNodes: no points found in path data');
  }

  return points.map((p, i) => ({
    index: i,
    x: p.x,
    y: p.y,
    isStart: i === 0,
    isBoss: i === points.length - 1,
  }));
}

/**
 * Convenience export: the 40 Stage 1 node positions, precomputed directly
 * from your clicked anchor points.
 */
export const STAGE1_NODES: StageNode[] = generateStageNodes();