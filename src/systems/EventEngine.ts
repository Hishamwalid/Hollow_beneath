import type { EventApplyCtx, EventChoice, EventDef, PlayerState, TrapDef } from '@data/types';
import { eligibleEvents, EVENTS } from '@data/events';
import { statCheck } from './checks';
import { pick } from './rng';
import { shardsForLoreFragment, applyShardBonus } from './EchoShardSystem';
import { computeLevelUp } from './LevelSystem';

export function buildEventCtx(player: PlayerState, rng: () => number): EventApplyCtx {
  return {
    rng,
    setFlag: (flag) => {
      player.flags[flag] = true;
      if (!player.history.includes(flag)) player.history.push(flag);
    },
    hasFlag: (flag) => !!player.flags[flag],
    addLoreFragment: (id) => {
      if (!player.loreFragments.includes(id)) {
        player.loreFragments.push(id);
        player.echoShards += shardsForLoreFragment();
      }
    },
    addEchoShards: (n) => { player.echoShards += applyShardBonus(player, n); },
    addXp: (n) => {
      player.xp += n;
      const { newLevel, levelsGained } = computeLevelUp(player.xp, player.level);
      if (levelsGained > 0) {
        player.level = newLevel;
        player.skillPoints += levelsGained;
      }
    },
  };
}

export interface EventResolution {
  text: string;
  combat?: { enemyIds: string[]; onVictory?: (player: PlayerState, ctx: EventApplyCtx) => string };
}

export function resolveEventChoice(player: PlayerState, choice: EventChoice, rng: () => number): EventResolution {
  const ctx = buildEventCtx(player, rng);
  if (choice.check) {
    const passed = statCheck(player.stats[choice.check.stat], choice.check.dc, rng);
    if (passed) {
      return { text: choice.onSuccess(player, ctx) };
    }
    const text = choice.onFailure ? choice.onFailure(player, ctx) : choice.onSuccess(player, ctx);
    return { text, combat: choice.onFailure ? choice.combat : undefined };
  }
  const text = choice.onSuccess(player, ctx);
  return { text, combat: choice.combat };
}

export function resolveTrap(trap: TrapDef, player: PlayerState, rng: () => number): { avoided: boolean; text: string } {
  const ctx = buildEventCtx(player, rng);
  const avoided = statCheck(player.stats[trap.avoidStat], trap.avoidDC, rng);
  const text = avoided ? trap.onAvoid(player, ctx) : trap.onTrigger(player, ctx);
  return { avoided, text };
}

export function pickEvent(page: number, resonance: number, seen: Set<string>, rng: () => number, flags: Record<string, boolean> = {}): EventDef {
  // Map pages 11-20 to 1-10 so events with pageRange [1,10] cover the full 200-node board
  const mappedPage = page > 10 ? page - 10 : page;
  const pool = eligibleEvents(mappedPage, resonance, seen, flags);
  if (pool.length === 0) return EVENTS.quiet_passage;
  return pick(pool, rng) ?? EVENTS.quiet_passage;
}
