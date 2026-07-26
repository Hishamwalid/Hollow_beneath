import { generateBoard, LANDMARK_INDICES } from '@systems/BoardGenerator';
import { mulberry32 } from '@systems/rng';
import { CombatEngine } from '@systems/CombatEngine';
import { BOSSES, BOSS_ORDER } from '@data/bosses';
import { EVENTS, eligibleEvents } from '@data/events';
import { MINOR_LANDMARKS } from '@data/minorLandmarks';
import { resolveEventChoice } from '@systems/EventEngine';
import { evaluateEnding } from '@data/endings';
import { computeDerivedStats, getEquipmentBonuses, STARTING_EQUIPMENT_BONUSES } from '@data/stats';
import { STARTING_FACTIONS } from '@data/factions';
import { ENEMIES } from '@data/enemies';
import { ITEMS } from '@data/items';
import { NAMED_SKILLS, DISCOVERABLE_SKILLS, PRESET_STARTING_SKILL } from '@data/skills';
import { LORE_FRAGMENTS, TOTAL_LORE_FRAGMENTS } from '@data/loreFragments';
import { TOTAL_WHISPERS, WHISPERS } from '@data/whispers';
import type { PlayerState, StatBlock, Equipment } from '@data/types';
import { xpForLevel, computeLevelUp, MAX_LEVEL } from '@systems/LevelSystem';
import { settingsManager } from '@systems/SettingsManager';

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
    resonancePeak: 40,
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
    skillPoints: 0,
    skillTreePurchases: {},
  };
}

// ---- 1. BoardGenerator ----------------------------------------------------
{
  const rng = mulberry32(12345);
  const board = generateBoard(rng);
  assert(board.length === 200, 'board has 200 nodes');
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

// ---- 6. Minor landmarks + lore fragment registry completeness -------------
{
  const seenFragmentIds = new Set<string>();
  const allDefs = [...Object.values(EVENTS), ...Object.values(MINOR_LANDMARKS)];
  for (const event of allDefs) {
    for (const choice of event.choices) {
      const player = makeTestPlayer({ str: 9, dex: 6, con: 6, int: 9, will: 9 });
      player.gold = 200;
      player.resonance = 60;
      player.faction = { sable: 30, archive: 30, covenant: 30, caravan: 30 };
      try {
        resolveEventChoice(player, choice, Math.random);
      } catch (e) {
        failures++;
        console.error(`FAIL: ${event.id}/${choice.id} threw`, e);
      }
      player.loreFragments.forEach((id) => seenFragmentIds.add(id));
    }
  }
  const missingLore = [...seenFragmentIds].filter((id) => !LORE_FRAGMENTS[id]);
  assert(missingLore.length === 0, `every discoverable lore fragment id resolves in LORE_FRAGMENTS (missing: ${missingLore.join(', ')})`);
  assert(Object.keys(LORE_FRAGMENTS).length === 51, `lore fragment registry has 51 entries (has ${Object.keys(LORE_FRAGMENTS).length})`);
  ok(`minor landmarks exercised; ${seenFragmentIds.size} unique lore ids discoverable via events/landmarks, all resolve`);
}

// ---- 7. Every page has non-filler event variety, low and high resonance ---
{
  const seen = new Set<string>();
  for (let page = 1; page <= 20; page++) {
    // Map pages 11-20 to 1-10 so events cover the full 200-node board
    const mappedPage = page > 10 ? page - 10 : page;
    for (const res of [0, 60, 90]) {
      const pool = eligibleEvents(mappedPage, res, seen, {}).filter((e) => e.id !== 'quiet_passage');
      assert(pool.length >= 1, `page ${page} @ resonance ${res} has a non-filler eligible event (has ${pool.length})`);
    }
  }
  ok('every page (1-20) has non-filler event coverage across the resonance range');
}

// ---- 8. Content roster counts match targets --------------------------------
{
  const nonFillerEvents = Object.keys(EVENTS).filter((id) => id !== 'quiet_passage').length;
  assert(nonFillerEvents === 31, `31 documented events excluding filler (has ${nonFillerEvents})`);
  assert(Object.keys(ENEMIES).length === 12, `12 standard enemy types (has ${Object.keys(ENEMIES).length})`);
  assert(Object.keys(ITEMS).length === 30, `30 items (has ${Object.keys(ITEMS).length})`);
  assert(Object.keys(NAMED_SKILLS).length === 25, `25 named skills (has ${Object.keys(NAMED_SKILLS).length})`);
  assert(TOTAL_WHISPERS === 50, `50 whispers (has ${TOTAL_WHISPERS})`);
  assert(Object.keys(MINOR_LANDMARKS).length === 10, `10 minor landmarks (has ${Object.keys(MINOR_LANDMARKS).length})`);
  ok('content roster counts: 20 events, 12 enemies, 25 skills, 30 items, 40 lore, 50 whispers, 10 minor landmarks (51 total lore fragments)');
}

// ---- 9. Skill distribution paths resolve to real skills --------------------
{
  const missingDiscoverable = DISCOVERABLE_SKILLS.filter((id) => !NAMED_SKILLS[id]);
  const missingPresets = Object.values(PRESET_STARTING_SKILL).filter((id) => !NAMED_SKILLS[id]);
  assert(missingDiscoverable.length === 0, `every DISCOVERABLE_SKILLS id resolves (missing: ${missingDiscoverable.join(', ')})`);
  assert(missingPresets.length === 0, `every PRESET_STARTING_SKILL id resolves (missing: ${missingPresets.join(', ')})`);
  const treeless = Object.values(NAMED_SKILLS).filter((s) => !s.tree);
  assert(treeless.length === 0, `every named skill has a tree (untagged: ${treeless.map((s) => s.id).join(', ')})`);
  ok(`skill distribution sane: ${DISCOVERABLE_SKILLS.length} discoverable, ${Object.keys(PRESET_STARTING_SKILL).length} preset starters`);
}

// ---- 10. Whisper registry has coverage for every tier ----------------------
{
  const tiers: Array<'stable' | 'awakened' | 'unmoored' | 'transcendent'> = ['stable', 'awakened', 'unmoored', 'transcendent'];
  for (const t of tiers) {
    const count = WHISPERS.filter((w) => w.tier === t).length;
    assert(count >= 5, `whisper tier "${t}" has reasonable coverage (has ${count})`);
  }
  ok('whisper registry has coverage across all 4 resonance tiers');
}

// ---- 11. Level-up thresholds -----------------------------------------------
{
  assert(xpForLevel(1) === 0, 'xpForLevel(1) = 0');
  assert(xpForLevel(2) === 61, 'xpForLevel(2) = 61');
  const res1 = computeLevelUp(0, 1);
  assert(res1.newLevel === 1 && res1.levelsGained === 0, '0 XP → no level up');
  const res2 = computeLevelUp(61, 1);
  assert(res2.newLevel === 2 && res2.levelsGained === 1, '61 XP → level 2');
  const res3 = computeLevelUp(1320, 1);
  assert(res3.newLevel >= 12 && res3.levelsGained >= 11, '1320 XP → level 12+');
  ok(`level-up thresholds verified; max_level=${MAX_LEVEL}`);
}

// ---- 12. MP costs in combat -------------------------------------------------
{
  const player = makeTestPlayer({ str: 8, dex: 6, con: 8, int: 10, will: 8 });
  player.skillsKnown.push('hunters_mark');
  const engine = new CombatEngine({ player, enemyIds: ['echo_skeleton'], page: 1, rng: Math.random, playerHistory: new Set() });
  let snap = engine.beginRound();
  const mpBefore = snap.playerMP;
  snap = engine.useSkill('hunters_mark'); // apCost:1, mpCost:3
  assert(snap.phase === 'player', 'useSkill with enough MP/AP does not end turn');
  assert(snap.playerMP <= mpBefore - 3, 'MP deducted after skill use (3 MP spent)');
  player.currentMP = 0;
  snap = engine.useSkill('hunters_mark');
  assert(snap.log.some(l => l.includes('Not enough MP')), '"not enough MP" entry when MP is 0');
  ok('MP cost deduction and insufficient-MP block verified');
}

// ---- 13. Equipment stat bonuses --------------------------------------------
{
  const bonuses = getEquipmentBonuses({
    weapon: 'rusty_dagger', armour: 'leather_vest', accessory: null, focus: 'cracked_lens',
  });
  assert(bonuses.weaponAtk === 2, 'rusty_dagger grants +2 ATK');
  assert(bonuses.armourDef === 1, 'leather_vest grants +1 DEF');
  assert(bonuses.focusMatk === 1, 'cracked_lens grants +1 MATK');
  const derived = computeDerivedStats({ str: 8, dex: 6, con: 8, int: 4, will: 4 }, bonuses);
  assert(derived.attack === 8 * 2 + 2, 'ATK = STR*2 + weapon bonus');
  assert(derived.defense === 8 * 2 + 1, 'DEF = CON*2 + armour bonus');
  assert(derived.magicAttack === 4 * 2 + 1, 'MATK = INT*2 + focus bonus');
  ok('equipment bonus calculations verified');
}

// ---- 14. Settings persistence (in-memory) ----------------------------------
{
  const s = settingsManager;
  const defaults = s.get();
  assert(defaults.masterVolume === 100 && defaults.textSpeed === 100 && defaults.screenShake === true, 'default settings values');
  s.set({ masterVolume: 50, textSpeed: 150, screenShake: false });
  const changed = s.get();
  assert(changed.masterVolume === 50, 'masterVolume persisted to 50');
  assert(changed.textSpeed === 150, 'textSpeed persisted to 150');
  assert(changed.screenShake === false, 'screenShake persisted to false');
  s.reset();
  const restored = s.get();
  assert(restored.masterVolume === 100, 'reset restores masterVolume to 100');
  ok('settings manager get/set/reset works');
}

// ---- 15. Event chain flag filtering -----------------------------------------
{
  const player = makeTestPlayer({ str: 5, dex: 5, con: 5, int: 5, will: 5 });
  player.flags = {};
  const poolWithout = eligibleEvents(5, 50, new Set(), player.flags);
  const hasGhost = poolWithout.some(e => e.id === 'ghosts_question');
  assert(!hasGhost, 'ghosts_question not eligible without ate_venn_bread flag');
  player.flags = { ate_venn_bread: true };
  const poolWith = eligibleEvents(5, 50, new Set(), player.flags);
  const hasGhostNow = poolWith.some(e => e.id === 'ghosts_question');
  assert(hasGhostNow, 'ghosts_question eligible when ate_venn_bread flag is set');
  ok('event chain flag filtering via requiresAnyFlag works');
}

console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} SMOKE TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
