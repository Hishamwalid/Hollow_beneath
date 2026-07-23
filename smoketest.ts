import { generateBoard, LANDMARK_INDICES } from '@systems/BoardGenerator';
import { mulberry32 } from '@systems/rng';
import { CombatEngine } from '@systems/CombatEngine';
import { BOSSES, BOSS_ORDER } from '@data/bosses';
import { EVENTS } from '@data/events';
import { resolveEventChoice } from '@systems/EventEngine';
import { evaluateEnding } from '@data/endings';
import { computeDerivedStats, STARTING_EQUIPMENT_BONUSES } from '@data/stats';
import { STARTING_FACTIONS } from '@data/factions';
import type { PlayerState, StatBlock } from '@data/types';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL:', msg);
  }
}
function ok(msg: string) {
  console.log('ok  :', msg);
}

function makeTestPlayer(stats: StatBlock): PlayerState {
  const derived = computeDerivedStats(stats, STARTING_EQUIPMENT_BONUSES);
  return {
    stats,
    derived,
    currentHP: derived.maxHP,
    currentMP: derived.maxMP,
    level: 1,
    xp: 0,
    skillsKnown: ['martyrs_flame', 'sealing_strike'],
    resonance: 40,
    faction: { ...STARTING_FACTIONS },
    equipment: { weapon: 'rusty_dagger', armour: 'leather_vest', accessory: null, focus: 'cracked_lens' },
    inventory: [{ id: 'ration', qty: 2 }, { id: 'bandage', qty: 1 }],
    flags: {},
    history: [],
    loreFragments: [],
    enemiesKilled: 0,
    bossesDefeated: [],
    momentum: 0,
    echoShards: 0,
    unlocks: [],
    gold: 50,
    totalRuns: 0,
    bestRun: { page: 0, time: 0 },
  };
}

// ---- 1. BoardGenerator ----------------------------------------------------
{
  const rng = mulberry32(12345);
  const board = generateBoard(rng);
  assert(board.length === 100, 'board has 100 nodes');
  assert(LANDMARK_INDICES.every((i) => board[i - 1].type === 'landmark'), 'landmark indices are landmark type');
  const counts: Record<string, number> = {};
  board.forEach((n) => (counts[n.type] = (counts[n.type] ?? 0) + 1));
  ok(`board type distribution: ${JSON.stringify(counts)}`);
}

// ---- 2. Regular combat vs a weak enemy ------------------------------------
{
  const player = makeTestPlayer({ str: 8, dex: 6, con: 8, int: 4, will: 4 });
  const engine = new CombatEngine({ player, enemyIds: ['echo_skeleton'], page: 1, rng: Math.random, playerHistory: new Set() });
  let snap = engine.beginRound();
  let rounds = 0;
  while (snap.phase !== 'victory' && snap.phase !== 'defeat' && rounds < 40) {
    while (snap.phase === 'player' && snap.playerAP > 0) {
      snap = engine.attack();
      if (snap.phase === 'momentum_choice') snap = engine.resolveMomentum('unravel');
    }
    if (snap.phase === 'player') snap = engine.endPlayerPhase();
    if (snap.phase !== 'victory' && snap.phase !== 'defeat') snap = engine.beginRound();
    rounds++;
  }
  assert(snap.phase === 'victory', `regular fight resolves to victory (got ${snap.phase} after ${rounds} rounds)`);
  ok(`echo_skeleton fight: ${snap.phase} in ${rounds} rounds`);
}

// ---- 3. All 5 bosses: simulate full fights with a strong test player ------
for (const bossId of BOSS_ORDER) {
  const player = makeTestPlayer({ str: 10, dex: 8, con: 8, int: 10, will: 8 });
  player.currentHP = player.derived.maxHP;
  const boss = BOSSES[bossId];
  let engine: CombatEngine;
  try {
    engine = new CombatEngine({ player, enemyIds: [], page: boss.page, bossDef: boss, rng: Math.random, playerHistory: new Set(['ate_venn_bread', 'joined_hymn']) });
  } catch (e) {
    failures++;
    console.error(`FAIL: boss ${bossId} constructor threw`, e);
    continue;
  }
  let snap = engine.beginRound();
  let rounds = 0;
  try {
    while (snap.phase !== 'victory' && snap.phase !== 'defeat' && rounds < 150) {
      let guard = 0;
      while (snap.phase === 'player' && snap.playerAP > 0 && guard < 10) {
        const target = snap.enemies.find((e) => e.alive)?.key;
        snap = engine.attack(target);
        guard++;
        if (snap.phase === 'momentum_choice') snap = engine.resolveMomentum('extra_turn');
      }
      if (snap.phase === 'player') snap = engine.endPlayerPhase();
      if (snap.phase !== 'victory' && snap.phase !== 'defeat') snap = engine.beginRound();
      rounds++;
      // heal player a bit each round to survive the simulation without real strategy
      player.currentHP = Math.min(player.derived.maxHP, player.currentHP + Math.round(player.derived.maxHP * 0.05));
    }
  } catch (e) {
    failures++;
    console.error(`FAIL: boss ${bossId} threw during simulation at round ${rounds}`, e);
    continue;
  }
  assert(snap.phase === 'victory' || snap.phase === 'defeat', `boss ${bossId} fight terminates (got ${snap.phase} after ${rounds} rounds)`);
  ok(`boss ${bossId}: ${snap.phase} in ${rounds} rounds, flags=${JSON.stringify(engine.getFlags())}`);
}

// ---- 4. Every documented event + every choice ------------------------------
for (const event of Object.values(EVENTS)) {
  for (const choice of event.choices) {
    const player = makeTestPlayer({ str: 9, dex: 6, con: 6, int: 9, will: 9 });
    player.gold = 200;
    player.resonance = 60;
    player.faction = { sable: 30, archive: 30, covenant: 30, caravan: 30 };
    try {
      const res = resolveEventChoice(player, choice, Math.random);
      assert(typeof res.text === 'string' && res.text.length > 0, `${event.id}/${choice.id} returns text`);
    } catch (e) {
      failures++;
      console.error(`FAIL: ${event.id}/${choice.id} threw`, e);
    }
  }
}
ok('all documented events/choices exercised');

// ---- 5. Endings ------------------------------------------------------------
{
  const p1 = makeTestPlayer({ str: 5, dex: 5, con: 5, int: 5, will: 5 });
  p1.resonance = 10;
  p1.faction.sable = 60;
  assert(evaluateEnding(p1).id === 'the_seal', 'seal ending triggers');

  const p2 = makeTestPlayer({ str: 5, dex: 5, con: 5, int: 5, will: 5 });
  p2.resonance = 90;
  p2.faction.covenant = 60;
  assert(evaluateEnding(p2).id === 'ascension', 'ascension ending triggers');

  const p3 = makeTestPlayer({ str: 5, dex: 5, con: 5, int: 5, will: 5 });
  p3.resonance = 10;
  p3.faction = { sable: 0, archive: 0, covenant: 0, caravan: 0 };
  assert(evaluateEnding(p3).id === 'unfinished', 'fallback ending triggers');
  ok('ending evaluation branches verified');
}

console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} SMOKE TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
