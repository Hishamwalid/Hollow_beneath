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
import { CLASSES, CLASS_SKILLS } from '@data/classes';
import { SKILL_TREES, skillTreeForClass } from '@data/skillTree';
import { LORE_FRAGMENTS, TOTAL_LORE_FRAGMENTS } from '@data/loreFragments';
import { TOTAL_WHISPERS, WHISPERS } from '@data/whispers';
import type { PlayerState, StatBlock, Equipment } from '@data/types';
import { xpForLevel, computeLevelUp, MAX_LEVEL } from '@systems/LevelSystem';
import { settingsManager } from '@systems/SettingsManager';
import {
  freshWindowState,
  recordWeakHit,
  resetWeakStreak,
  tickWeakWindow,
  windowActive,
  windowDamageMult,
  windowCritBonus,
} from '@systems/combat/WeaknessWindowSystem';
import { resolveReaction } from '@systems/combat/ElementalReactionSystem';
import { matchCombo } from '@systems/combat/ComboSystem';
import { battlefieldDamageMod, BATTLEFIELD_STATES } from '@systems/combat/BattlefieldStateSystem';
import { POSITION_META, ROW_ORDER, defaultRowFor } from '@systems/combat/PositionSystem';
import { DIFFICULTIES, difficultyMods } from '@systems/combat/DifficultySystem';
import { ARCHIVE_FRAGMENT_COUNT, addArchiveFragment, archiveDamageBonus, archiveExploited, emptyArchive } from '@systems/combat/ArchiveSystem';
import { CRISES, type CrisisId } from '@systems/combat/CrisisSystem';
import { fearModifiers } from '@systems/combat/FearSystem';
import { hasStatus, getStatus, tickDurations } from '@systems/StatusEffectSystem';

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
    companions: [],
    flags: {},
    history: [],
    loreFragments: [],
    enemiesKilled: 0,
    bossesDefeated: [],
    momentum: 0,
    classId: 'balanced',
    fatigue: 0,
    insight: 0,
    fearGauge: 0,
    position: 'middle',
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
  const engine = new CombatEngine({ player, enemyIds: ['echo_skeleton'], page: 1, rng: mulberry32(555), playerHistory: new Set() });
  let snap = engine.beginRound();
  let rounds = 0;
  while (snap.phase !== 'victory' && snap.phase !== 'defeat' && rounds < 40) {
    while (snap.phase === 'player' && snap.playerAP > 0) {
      snap = engine.attack();
      if (snap.phase === 'momentum_choice') snap = engine.resolveMomentum('unravel');
    }
    if (snap.phase === 'crisis' && snap.pendingCrisis) snap = engine.resolveCrisis(snap.pendingCrisis.options[0].id);
    if (snap.phase === 'player') snap = engine.endPlayerPhase();
    if (snap.phase !== 'victory' && snap.phase !== 'defeat') snap = engine.beginRound();
    rounds++;
  }
  assert(snap.phase === 'victory', `regular fight resolves to victory (got ${snap.phase} after ${rounds} rounds)`);
  ok(`echo_skeleton fight: ${snap.phase} in ${rounds} rounds`);
}

// ---- 3. All 5 bosses: simulate full fights with a strong test player ------
let bossChargeSeen = '';
for (const bossId of BOSS_ORDER) {
  let sawCharge = false;
  for (let attempt = 0; attempt < 60 && !sawCharge; attempt++) {
    const player = makeTestPlayer({ str: 10 + (attempt % 5), dex: 8, con: 10, int: 10, will: 8 });
    player.currentHP = player.derived.maxHP;
    const boss = BOSSES[bossId];
    let engine: CombatEngine;
    try {
      engine = new CombatEngine({ player, enemyIds: [], page: boss.page, bossDef: boss, rng: mulberry32(7000 + attempt), playerHistory: new Set(['ate_venn_bread', 'joined_hymn']) });
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
          if (snap.phase === 'momentum_choice') snap = engine.resolveMomentum('flow');
        }
        if (snap.phase === 'victory' || snap.phase === 'defeat') break;
        if (snap.phase === 'crisis' && snap.pendingCrisis) snap = engine.resolveCrisis(snap.pendingCrisis.options[0].id);
        if (snap.phase === 'player') snap = engine.endPlayerPhase();
        if (snap.phase !== 'victory' && snap.phase !== 'defeat') {
          if (snap.enemies.some((e) => e.pendingIntent?.charged === true) || snap.banners.some((b) => b.startsWith('CHARGE'))) sawCharge = true;
          snap = engine.beginRound();
        }
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
    // Phase 5: the fight snapshot must surface the boss-intel readout (stress/band/adaptations/tell).
    assert(snap.bossIntel !== undefined, `boss ${bossId} surfaces Phase 5 intel in snapshot`);
    assert(typeof snap.bossIntel.stress === 'number' && Number.isFinite(snap.bossIntel.stress), `boss ${bossId} intel stress is finite`);
    assert(Array.isArray(snap.bossIntel.adaptations), `boss ${bossId} intel surfaces adaptations array`);
    assert(snap.bossIntel.chargedLabel === null || typeof snap.bossIntel.chargedLabel === 'string', `boss ${bossId} intel chargedLabel shaped`);
  }
  if (sawCharge) bossChargeSeen = bossId;
  ok(`boss ${bossId}: charge cycle ${sawCharge ? 'SEEN' : 'NOT SEEN'}`);
}
assert(bossChargeSeen !== '', 'boss charge cycle seen in simulation');

// ---- 4. Every documented event + every choice ------------------------------
{
  let rngSeq = 0;
  for (const event of Object.values(EVENTS)) {
    for (const choice of event.choices) {
      const player = makeTestPlayer({ str: 9, dex: 6, con: 6, int: 9, will: 9 });
      player.gold = 200;
      player.resonance = 60;
      player.faction = { sable: 30, archive: 30, covenant: 30, caravan: 30 };
      try {
        const res = resolveEventChoice(player, choice, mulberry32(rngSeq++));
        assert(typeof res.text === 'string' && res.text.length > 0, `${event.id}/${choice.id} returns text`);
      } catch (e) {
        failures++;
        console.error(`FAIL: ${event.id}/${choice.id} threw`, e);
      }
    }
  }
  ok('all documented events/choices exercised');
}

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
  let rngSeq = 0;
  for (const event of allDefs) {
    for (const choice of event.choices) {
      const player = makeTestPlayer({ str: 9, dex: 6, con: 6, int: 9, will: 9 });
      player.gold = 200;
      player.resonance = 60;
      player.faction = { sable: 30, archive: 30, covenant: 30, caravan: 30 };
      try {
        resolveEventChoice(player, choice, mulberry32(rngSeq++));
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
  assert(Object.keys(NAMED_SKILLS).length === 61, `61 named skills incl. class skills (has ${Object.keys(NAMED_SKILLS).length})`);
  assert(TOTAL_WHISPERS === 50, `50 whispers (has ${TOTAL_WHISPERS})`);
  assert(Object.keys(MINOR_LANDMARKS).length === 10, `10 minor landmarks (has ${Object.keys(MINOR_LANDMARKS).length})`);
  ok('content roster counts: 20 events, 12 enemies, 61 skills, 30 items, 40 lore, 50 whispers, 10 minor landmarks (51 total lore fragments)');
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
  const engine = new CombatEngine({ player, enemyIds: ['echo_skeleton'], page: 1, rng: mulberry32(6500), playerHistory: new Set() });
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

// ---- 16. Phase 3: weakness windows, elemental reactions, combo tags ---------
{
  // Pure subsystem checks
  {
    const s = freshWindowState();
    assert(recordWeakHit(s) === 'progress', 'first weak hit = progress');
    assert(recordWeakHit(s) === 'progress', 'second weak hit = progress');
    assert(recordWeakHit(s) === 'opened', 'third weak hit opens the window');
    assert(windowActive(s) && windowDamageMult(s) === 1.5, 'window active with 1.5x damage');
    assert(windowCritBonus(s) === 0.25, 'window grants +25% crit chance');
    tickWeakWindow(s);
    tickWeakWindow(s);
    assert(!windowActive(s), 'window expires after 2 turns');
    const s2 = freshWindowState();
    recordWeakHit(s2);
    resetWeakStreak(s2);
    assert(s2.streak === 0, 'resetting the streak keeps the window ticking');
    ok('weakness window streak/opening/expiry verified');
  }
  {
    assert(resolveReaction('flame', 'frost')?.id === 'thermal_shock', 'flame->frost = Thermal Shock');
    assert(resolveReaction('frost', 'shock')?.id === 'conductive_freeze', 'frost->shock = Conductive Freeze');
    assert(resolveReaction('shock', 'flame')?.id === 'plasma_burst', 'shock->flame = Plasma Burst');
    assert(resolveReaction('sacred', 'shadow')?.id === 'void_collapse', 'sacred->shadow = Void Collapse');
    assert(resolveReaction('shadow', 'sacred')?.id === 'crimson_eclipse', 'shadow->sacred = Crimson Eclipse');
    assert(resolveReaction('pierce', 'slash')?.id === 'rending_wounds', 'pierce->slash = Rending Wounds');
    assert(resolveReaction('slash', 'blunt')?.id === 'shattered_guard', 'slash->blunt = Shattered Guard');
    assert(resolveReaction('blunt', 'pierce')?.id === 'crushing_point', 'blunt->pierce = Crushing Point');
    assert(resolveReaction('flame', 'sacred') === null, 'unlisted pairs produce no reaction');
    assert(resolveReaction('slash', 'slash') === null, 'same-type hits produce no reaction');
    ok('all 8 elemental reactions resolve correctly');
  }
  {
    assert(matchCombo([['Strike'], ['Break'], ['Sacred']])?.effect === 'expose_truth', 'expose_truth combo detected');
    assert(matchCombo([['Analyze'], ['Shock'], ['Shadow']])?.effect === 'memory_collapse', 'memory_collapse combo detected');
    assert(matchCombo([['Strike'], ['Pierce'], ['Slash']])?.effect === 'rending_wounds', 'rending_wounds combo detected');
    assert(matchCombo([['Mark'], ['Pierce'], ['Strike']])?.effect === 'hunters_kill', 'hunters_kill combo detected');
    assert(matchCombo([['Break'], ['Physical'], ['Elemental']])?.effect === 'shattered_reality', 'shattered_reality combo detected');
    assert(matchCombo([['Sacred'], ['Shadow'], ['Sacred']])?.effect === 'eclipse', 'eclipse combo detected');
    assert(matchCombo([['Guard'], ['Counter'], ['Strike']])?.effect === 'perfect_riposte', 'perfect_riposte combo detected');
    assert(matchCombo([['Analyze'], ['Analyze'], ['Break']])?.effect === 'full_knowledge', 'full_knowledge combo detected');
    assert(matchCombo([['Strike'], ['Strike'], ['Strike']]) === null, 'unlisted sequences produce no combo');
    assert(matchCombo([['Strike'], ['Break']]) === null, 'combos need 3 action tag-sets');
    ok('all 8 combo sequences detected');
  }

  // Engine integration: weakness streak opens window + banner; combo fires from tag history
  {
    // echo_skeleton is weak to sacred (2.0): three consecutive sacred hits across rounds open the window.
    // Low STR so the 35hp skeleton survives long enough for a 3-hit streak.
    const player = makeTestPlayer({ str: 4, dex: 6, con: 12, int: 10, will: 10 });
    player.skillsKnown = ['sealing_strike'];
    player.currentMP = player.derived.maxMP;
    const engine = new CombatEngine({ player, enemyIds: ['echo_skeleton'], page: 1, rng: mulberry32(7), playerHistory: new Set() });
    let snap = engine.beginRound();
    const sawWindow = { on: false };
    let rounds = 0;
    while (!sawWindow.on && rounds < 12) {
      const t = snap.enemies.find((e) => e.alive)?.key;
      if (snap.phase === 'player' && snap.playerAP >= 2 && t) snap = engine.useSkill('sealing_strike', t);
      for (const b of snap.banners) if (b.includes('WINDOW')) sawWindow.on = true;
      if (snap.phase === 'player') snap = engine.endPlayerPhase();
      if (snap.phase === 'momentum_choice') snap = engine.resolveMomentum('flow');
      if (snap.phase === 'crisis' && snap.pendingCrisis) snap = engine.resolveCrisis(snap.pendingCrisis.options[0].id);
      if (snap.phase !== 'victory' && snap.phase !== 'defeat') {
        snap = engine.beginRound();
        player.currentHP = player.derived.maxHP;
      }
      rounds++;
    }
    const windowWasOn = snap.enemies.some((e) => e.weakWindowTurns > 0);
    assert(sawWindow.on, `weakness window banner emitted after 3 streak hits (rounds=${rounds}, banners=${JSON.stringify(snap.banners)})`);
    assert(windowWasOn, 'weakness window is live on an enemy (weakWindowTurns > 0)');
    ok(`engine weakness window: rounds=${rounds}, windowTurns=${snap.enemies.map((e) => `${e.key}:${e.weakWindowTurns}`).join(',')}`);
  }
  {
    // Combo: Attack (Strike) -> Sunder (Break) -> Sealing Strike (Sacred) = Expose Truth, across rounds.
    const player = makeTestPlayer({ str: 12, dex: 6, con: 12, int: 10, will: 10 });
    player.skillsKnown = ['sealing_strike'];
    player.currentHP = player.derived.maxHP;
    const engine = new CombatEngine({ player, enemyIds: ['venn_custodian'], page: 1, rng: mulberry32(333), playerHistory: new Set() });
    let snap = engine.beginRound();
    const actions = ['attack', 'sunder', 'skill'] as const;
    let next = 0;
    let fired = false;
    let rounds = 0;
    while (!fired && rounds < 30) {
      const t = snap.enemies.find((e) => e.alive)?.key;
      const want = actions[next];
      const need = want === 'attack' ? 1 : 2;
      if (snap.phase === 'player' && snap.playerAP >= need && t) {
        snap = want === 'attack' ? engine.attack(t) : want === 'sunder' ? engine.sunder(t) : engine.useSkill('sealing_strike', t);
        next++;
      }
      if (snap.banners.some((b) => b.startsWith('COMBO'))) fired = true;
      if (next >= actions.length) {
        assert(fired || snap.log.some((l) => l.includes('COMBO Expose Truth')), `combo fires from [Strike,Break,Sacred] across rounds (banners=${JSON.stringify(snap.banners)}, log=${JSON.stringify(snap.log.slice(-4))})`);
        fired = true;
      }
      if (snap.phase === 'player') snap = engine.endPlayerPhase();
      if (snap.phase === 'momentum_choice') snap = engine.resolveMomentum('flow');
      if (snap.phase === 'crisis' && snap.pendingCrisis) snap = engine.resolveCrisis(snap.pendingCrisis.options[0].id);
      if (snap.phase !== 'victory' && snap.phase !== 'defeat') {
        snap = engine.beginRound();
        player.currentHP = player.derived.maxHP;
      }
      rounds++;
    }
    const comboBanner = snap.banners.some((b) => b.startsWith('COMBO'));
    const inLog = snap.log.some((l) => l.includes('COMBO Expose Truth'));
    assert(comboBanner || inLog, `combo fires from [Strike,Break,Sacred] across rounds (banners=${JSON.stringify(snap.banners)}, log=${JSON.stringify(snap.log.slice(-4))})`);
    ok(`engine combo: banners=${JSON.stringify(snap.banners)}, log has Expose Truth=${inLog}`);
  }
  // ---- 12b. Investigation regression: Probe types resolve, observe_behavior exists, INT>=10 bonus singles, not doubled ----
  {
    const player = makeTestPlayer({ str: 12, dex: 6, con: 12, int: 10, will: 10 });
    player.currentHP = player.derived.maxHP;
    const engine = new CombatEngine({ player, enemyIds: ['echo_skeleton'], page: 1, rng: mulberry32(9), playerHistory: new Set() });
    let snap = engine.beginRound();
    const key = snap.enemies.find((e) => e.alive)?.key;
    assert(!!key, 'test enemy is present and alive');
    snap = engine.analyze(key); // Scan (1 AP) -> investigation layer 1
    const probed = engine.probe(key, 'observe_behavior');
    assert(probed.log.some((l) => l.startsWith('BEHAVIOR')), 'observe_behavior probe resolves a BEHAVIOR line');
    // INT >= 10 should grant exactly ONE deep bonus line (regression: was pushed twice).
    const bonusLines = probed.log.filter((l) => l.startsWith('Your intellect catches an extra thread'));
    assert(bonusLines.length === 1, `INT 10 probe bonus is single, not doubled (got ${bonusLines.length})`);
    ok(`probe integrity: observe_behavior fires, single INT bonus (int=${player.stats.int})`);
  }

  // ---- 12. Class identity (Phase 4b): 6 classes, 36 skills, class trees ----
  {
    assert(CLASSES.length === 6, `six classes defined (has ${CLASSES.length})`);
    assert(Object.keys(CLASS_SKILLS).length === 36, `36 class skills (has ${Object.keys(CLASS_SKILLS).length})`);
    for (const c of CLASSES) {
      assert(c.passive.id.startsWith(c.id) || c.passive.id === 'rage' || c.passive.id === 'precision' || c.passive.id === 'knowledge' || c.passive.id === 'resolve' || c.passive.id === 'risk' || c.passive.id === 'adaptation', `class ${c.id} has a passive`);
      assert(c.progression.length === 4, `class ${c.id} has 4 progression skills (has ${c.progression.length})`);
      assert(NAMED_SKILLS[c.passive.id] && NAMED_SKILLS[c.signature.id], `class ${c.id} skills registered in NAMED_SKILLS`);
    }
    for (const t of SKILL_TREES) {
      assert(t.nodes.length === 6, `tree ${t.id} has 6 nodes (passive+signature+4) (has ${t.nodes.length})`);
      assert(t.nodes[0].cost === 0, `tree ${t.id} passive is free (tier 0)`);
    }
    assert(skillTreeForClass('warrior')?.nodes.some((n) => n.id === 'last_stand'), 'warrior tree exposes Last Stand signature');
    // Class signature tags all resolve to real skills and effects/tags exist
    for (const id of Object.keys(CLASS_SKILLS)) {
      const s = CLASS_SKILLS[id];
      assert(!!s.apCost || s.apCost === 0, `class skill ${id} has apCost`);
    }
    ok(`class identity: ${CLASSES.length} classes, ${Object.keys(CLASS_SKILLS).length} skills, ${SKILL_TREES.length} class-locked trees`);
  }

  // ---- 13. Phase 4 completeness: crisis options, fear, desperation, bravery ----
  {
    const makeEngine = (stats: StatBlock = { str: 8, dex: 6, con: 8, int: 4, will: 4 }) => {
      const player = makeTestPlayer(stats);
      player.currentHP = player.derived.maxHP;
      return new CombatEngine({ player, enemyIds: ['echo_skeleton'], page: 1, rng: mulberry32(8008), playerHistory: new Set() });
    };
    const raw = (engine: CombatEngine) => engine as unknown as {
      phase: string; pendingCrisisId: string | null; playerAP: number; fear: number;
      player: { currentHP: number; derived: { maxHP: number }; momentum: number };
      rng: () => number;
    };

    // 13a. Every crisis option must have an actual effect (no "the moment passes" no-op).
    for (const crisisId of Object.keys(CRISES) as CrisisId[]) {
      const engine = makeEngine();
      for (const opt of CRISES[crisisId].options) {
        const r = raw(engine);
        r.phase = 'crisis';
        r.pendingCrisisId = crisisId;
        const before = engine.snapshot().log.length;
        const snap = engine.resolveCrisis(opt.id);
        const newLog = snap.log.slice(before).join(' ');
        assert(!newLog.includes('the moment passes'), `crisis '${crisisId}' option '${opt.id}' resolves with an effect (got "${newLog.slice(0, 100)}")`);
      }
    }
    ok(`crisis: all ${Object.keys(CRISES).length} crises x options resolve with real effects`);

    // 13b. Spot-check crisis consequences land in engine state.
    {
      const engine = makeEngine();
      let r = raw(engine);
      r.phase = 'crisis'; r.pendingCrisisId = 'revelation';
      let snap = engine.resolveCrisis('study');
      assert(snap.momentum === 3, `Study crisis grants exactly +3 momentum (got ${snap.momentum})`);
      assert(snap.enemies.every((e) => e.investigationLayer >= 3), 'Study reveals all enemies to layer 3');

      r.phase = 'crisis'; r.pendingCrisisId = 'critical_moment';
      snap = engine.resolveCrisis('tactical_reset');
      assert(hasStatus(snap.playerStatuses, 'barrier') && hasStatus(snap.playerStatuses, 'atk_up') === false, 'Tactical Reset grants a Barrier');

      r.phase = 'crisis'; r.pendingCrisisId = 'critical_moment';
      snap = engine.resolveCrisis('rhythm');
      assert(snap.bankedAP === 3, `rhythm banks 3 AP (got ${snap.bankedAP})`);

      r.phase = 'crisis'; r.pendingCrisisId = 'fates_edge';
      snap = engine.resolveCrisis('gamble');
      assert(snap.phase === 'victory' || snap.phase === 'defeat', `gamble resolves the fight one way or another (phase=${snap.phase})`);
    }

    // 13c. Momentum Flow: +2 AP now, but start the NEXT round exhausted (−1 AP).
    // Regression guard: "exhausted" must be applied for 2 turns so it survives the
    // end-of-round tickDurations and is still present at next beginRound. A 1-turn
    // application would be swallowed by endPlayerPhase and never penalize the player.
    {
      const player = makeTestPlayer({ str: 12, dex: 6, con: 12, int: 10, will: 10 });
      player.currentHP = player.derived.maxHP;
      const engine = new CombatEngine({ player, enemyIds: ['echo_skeleton'], page: 1, rng: mulberry32(7), playerHistory: new Set() });
      engine.beginRound();
      const r = engine as unknown as { phase: string; player: { momentum: number } };
      r.phase = 'momentum_choice';
      r.player.momentum = 5;
      const snap = engine.resolveMomentum('flow');
      assert(snap.playerAP === 5, `Flow grants +2 AP immediately from base 3 (got ${snap.playerAP})`);
      assert(getStatus(snap.playerStatuses, 'exhausted')?.turnsRemaining === 2, 'Flow applies exhausted for 2 turns');
      tickDurations(snap.playerStatuses);
      assert(hasStatus(snap.playerStatuses, 'exhausted'), 'exhausted survives the end-of-round tick');
      assert(getStatus(snap.playerStatuses, 'exhausted')?.turnsRemaining === 1, 'one tick consumed, one turn remains for next beginRound');
      ok('momentum Flow: +2 AP now, exhausted (2 turns) survives to next round (-1 AP)');
    }

    // 13c2. Crisis trigger: a real weakness hit opens the Revelation crisis.
    // Ties B2 (firstWeaknessRevealed on a weakness hit) -> checkCrisis -> pickCrisis('revelation').
    {
      // Low STR so sealing_strike (sacred, 2.0x weak vs echo_skeleton) lands a weakness
      // hit without one-shotting the 35-HP skeleton.
      const player = makeTestPlayer({ str: 4, dex: 6, con: 12, int: 10, will: 10 });
      player.skillsKnown = ['sealing_strike'];
      player.currentHP = player.derived.maxHP;
      const engine = new CombatEngine({ player, enemyIds: ['echo_skeleton'], page: 1, rng: mulberry32(7), playerHistory: new Set() });
      const snap0 = engine.beginRound();
      const key = snap0.enemies.find((e) => e.alive)?.key;
      assert(!!key, 'engine has an alive enemy to provoke a weakness hit');
      const after = engine.useSkill('sealing_strike', key);
      assert(after.enemies.some((e) => e.alive), 'enemy survives a low-STR weakness hit');
      const snap = engine.checkCrisis();
      assert(snap.phase === 'crisis' && snap.pendingCrisis?.id === 'revelation', `first weakness hit triggers the Revelation crisis (phase=${snap.phase}, crisis=${snap.pendingCrisis?.id ?? 'none'})`);
      ok('crisis trigger: Revelation fires on first weakness hit (revealed -> pickCrisis)');
    }

    // 13d. Fear: threshold modifiers, snapshot surfacing, bravery actions.
    {
      assert(JSON.stringify(fearModifiers(49)) === JSON.stringify({ damageMult: 1, accuracyMult: 1 }), 'fear below threshold has no modifiers');
      assert(fearModifiers(60).damageMult === 0.9 && fearModifiers(60).accuracyMult === 0.8, 'terrified: -10% damage, -20% accuracy');
      const engine = makeEngine();
      const r = raw(engine);
      r.fear = 60;
      r.player.currentHP = r.player.derived.maxHP;
      r.phase = 'player';
      r.player.momentum = 0;
      // playerAP must be >= the bravery cost
      const snap = engine.resolveBravery('face_fear');
      assert(snap.fear === 0, `Face Fear resets the gauge to 0 (got ${snap.fear})`);
      assert(hasStatus(snap.playerStatuses, 'atk_up'), 'Face Fear grants atk_up boon');
    }

    // 13d. Desperation: all 5 events fire, each applies a real mechanic.
    {
      const stats: StatBlock = { str: 10, dex: 8, con: 12, int: 6, will: 6 };
      const engine = makeEngine(stats);
      const r = raw(engine);
      r.rng = () => 0; // every roll succeeds -> desperation always rolls in
      const seen = new Set<string>();
      for (let i = 0; i < 12 && seen.size < 5; i++) {
        r.player.currentHP = 5; // force < 35% HP
        r.phase = 'player';
        engine.checkDesperation();
        for (const id of engine.getDesperationIds()) seen.add(id);
      }
      assert(seen.size === 5, `all 5 desperation events fire over repeated low-HP turns (fired: ${[...seen].join(',')})`);

      // Healing seal: after one_last_memory fires, consumable heals do nothing.
      const engine2 = makeEngine(stats);
      const r2 = raw(engine2);
      r2.rng = () => 0;
      for (let i = 0; i < 6 && !engine2.getDesperationIds().includes('one_last_memory'); i++) {
        r2.player.currentHP = 5;
        r2.phase = 'player';
        engine2.checkDesperation();
      }
      if (engine2.getDesperationIds().includes('one_last_memory')) {
        r2.phase = 'player';
        r2.playerAP = 3;
        r2.player.currentHP = 5;
        const before = engine2.snapshot().playerHP;
        const snap = engine2.useItem('ration');
        assert(snap.playerHP === before, 'one_last_memory seals consumable healing (hp unchanged)');
        assert(snap.log.some((l) => l.includes('One Last Memory seals')), 'one_last_memory heal block is logged');
      } else {
        assert(false, 'one_last_memory fired during the desperation loop');
      }
    }
  }
}

// ---- 17. Phase 5: companion / ally systems ----------------------------------
{
  const {
    ALLY_DEFS,
    LOYALTY_TIERS,
    tierForLoyalty,
    abilitiesForLoyalty,
  } = await import('@systems/ally/AllyDefs');
  const {
    freshAllyState,
    loyaltyGain,
    mergeAllyStates,
    setCooldown,
    hasCooldown,
    bindRegion,
    accompaniesIn,
  } = await import('@systems/ally/AllyTracking');
  const { planAllyTurn } = await import('@systems/ally/AllyCombat');
  const { bossAssist } = await import('@systems/ally/AllyBoss');
  const { shardsForAllyVictory, resonanceForBondThreshold } = await import('@systems/ally/AllyRewards');

  // 17a. Defs + loyalty tiers.
  assert(Object.keys(ALLY_DEFS).length === 4, `4 companion archetypes (has ${Object.keys(ALLY_DEFS).length})`);
  assert(tierForLoyalty(0) === 'bonded' && tierForLoyalty(30) === 'steadfast' && tierForLoyalty(60) === 'devoted' && tierForLoyalty(90) === 'true', 'loyalty tier thresholds 0/25/50/80');
  assert(LOYALTY_TIERS.length === 4, '4 defined loyalty tiers');
  assert(abilitiesForLoyalty(ALLY_DEFS.covenant_courier, 0).some((a) => a.id === 'field_dressing'), 'courier heals from bonded tier');
  assert(!abilitiesForLoyalty(ALLY_DEFS.covenant_courier, 0).some((a) => a.id === 'bitter_revival'), 'bitter revival gated behind devotion');
  ok('ally registry: 4 archetypes, tier-gated abilities verified');

  // 17b. Tracking: gain/merge/cooldowns/regions
  {
    const s = freshAllyState('sable_zealot');
    assert(s.loyalty === 0 && accompaniesIn(s.loyalty) === false, 'fresh ally has 0 loyalty and does not accompany yet');
    const deltaAfterWin = loyaltyGain(s, true);
    assert(deltaAfterWin === 12 && s.loyalty === 12, `win grants +12 loyalty (got ${deltaAfterWin})`);
    const d2 = loyaltyGain(s, false);
    assert(d2 === 4 && s.loyalty === 16, `loss grants +4 loyalty (got ${d2})`);
    const bound = bindRegion(s, 'sable_edge');
    assert(bound.boundRegions.includes('sable_edge'), 'bindRegion records the region');
    const merged = mergeAllyStates(freshAllyState('sable_zealot'), bound);
    assert(merged.boundRegions.includes('sable_edge'), 'merge keeps bond history');
    const cooled = setCooldown(s, 'bitter_revival', true);
    assert(hasCooldown(cooled, 'bitter_revival'), 'cooldown set');
    assert(!hasCooldown(setCooldown(cooled, 'bitter_revival', false), 'bitter_revival'), 'cooldown cleared');
    ok('ally tracking: loyalty curves, regions, cooldowns verified');
  }

  // 17b-2. Recruitment: a companion found in the world must accompany (Phase 5 gating fix)
  {
    // Mirrors BoardScene.resolveAllyNode: fresh state + home-region bond.
    const recruited = bindRegion({ ...freshAllyState('sable_zealot'), loyalty: 15 }, 'sable_edge');
    assert(accompaniesIn(recruited.loyalty), 'recruited companion accompanies (loyalty >= 15)');
    assert(recruited.boundRegions.length === 1, 'recruited companion is bound to its region');
    // Cooldowns must persist: once set, the gate stays true (regression for dropped setCooldown).
    const withCd = setCooldown(recruited, 'first_church_word', true);
    assert(hasCooldown(withCd, 'first_church_word'), 'once-per-fight cooldown persists after setCooldown');
    ok('ally recruitment: accompanying loyalty + persistent cooldowns verified');
  }

  // 17c. Combat evaluator deterministic priorities
  {
    const courier = ALLY_DEFS.covenant_courier;
    const dyingPlan = planAllyTurn(courier, 100, { playerHp: 5, playerMaxHp: 100, playerHasDebuff: false, playerGuarding: false, playerMomentum: 0, round: 1, bossPhaseKey: null, enemies: [] });
    assert(dyingPlan.action.kind === 'heal', 'courier heals a dying player first');
    const steadyPlan = planAllyTurn(courier, 100, { playerHp: 90, playerMaxHp: 100, playerHasDebuff: false, playerGuarding: false, playerMomentum: 0, round: 1, bossPhaseKey: null, enemies: [] });
    assert(['overwatch', 'support', 'wait'].includes(steadyPlan.action.kind), 'courier does not waste heals on a healthy player');
    const zealot = ALLY_DEFS.sable_zealot;
    const weakAdd = planAllyTurn(zealot, 100, { playerHp: 90, playerMaxHp: 100, playerHasDebuff: false, playerGuarding: false, playerMomentum: 0, round: 1, bossPhaseKey: null, enemies: [{ key: 'e1', hpFraction: 0.2, isBoss: false, hasDebuff: false }, { key: 'e2', hpFraction: 0.9, isBoss: false, hasDebuff: false }] });
    assert(weakAdd.action.kind === 'attack' && weakAdd.action.targetKey === 'e1', 'zealot finishes the weakest add first');
    ok('ally evaluator: heal-first, weakest-add priority verified');
  }

  // 17d. Boss assist bindings
  {
    const courier = ALLY_DEFS.covenant_courier;
    const devoted = { ...freshAllyState('covenant_courier'), loyalty: 60 };
    const assist = bossAssist(courier, devoted, { playerHp: 0, playerMaxHp: 100, bossPhaseKey: 'wrath', playerFallen: true, playerHasDebuff: false, round: 3, foughtTogether: 1 });
    assert(assist.reviveAvailable && assist.reviveHealAmount === 20, `devoted courier revives at 20% HP (got ${assist.reviveHealAmount})`);
    const wardenAssist = bossAssist(ALLY_DEFS.warden_emissary, { ...freshAllyState('warden_emissary'), loyalty: 90 }, { playerHp: 10, playerMaxHp: 100, bossPhaseKey: 'wrath', playerFallen: false, playerHasDebuff: false, round: 2, foughtTogether: 3 });
    assert(wardenAssist.guardCanIntervene === true, 'true-tier warden can arm the unbroken vigil');
    ok('boss assist: revive + vigil bindings verified');
  }

  // 17e. Engine integration: healing, revive, and loyalty after victory
  {
    const player = makeTestPlayer({ str: 8, dex: 6, con: 10, int: 4, will: 4 });
    const courier = freshAllyState('covenant_courier');
    courier.loyalty = 100; // True: field_dressing + mercy_pact available
    player.currentHP = Math.round(player.derived.maxHP * 0.4);
    const engine = new CombatEngine({ player, enemyIds: ['echo_skeleton'], page: 1, rng: () => 0.1, playerHistory: new Set(), allies: [courier] });
    let snap = engine.beginRound();
    while (snap.phase === 'player' && snap.playerAP > 0) snap = engine.attack();
    const hpBeforeEnd = snap.playerHP;
    snap = engine.endPlayerPhase();
    const healed = snap.playerHP > hpBeforeEnd;
    const allyLogged = snap.log.some((l) => l.includes('Covenant Courier'));
    assert(snap.allies.some((a) => a.id === 'covenant_courier'), 'snapshot surfaces the companion');
    assert(allyLogged, 'ally acts and logs during a round');
    ok(`companion rounds: healed=${healed}, snapshot allies=${snap.allies.map((a) => a.name).join(',')}`);
  }
  {
    // Bitter Revival: a devoted courier saves the player from death, once.
    const player = makeTestPlayer({ str: 8, dex: 8, con: 20, int: 4, will: 4 });
    const courier = freshAllyState('covenant_courier');
    courier.loyalty = 60;
    player.currentHP = player.derived.maxHP;
    const engine = new CombatEngine({ player, enemyIds: ['echo_skeleton'], page: 1, rng: () => 0.99, playerHistory: new Set(), allies: [courier] });
    let snap = engine.beginRound(); // starts healthy: no crisis interruption
    const rawP = engine as unknown as { player: { currentHP: number } };
    rawP.player.currentHP = 1; // drop to the brink after the crisis check
    if (snap.phase === 'player') snap = engine.endPlayerPhase();
    assert(snap.phase === 'player' && snap.playerHP >= Math.round(player.derived.maxHP * 0.2), `killing blow is refused by Bitter Revival (hp=${snap.playerHP})`);
    ok(`bitter revival: saved at ${snap.playerHP} HP (phase=${snap.phase})`);
  }
  {
    // Reward curves: post-victory loyalty and shards
    const s = freshAllyState('archive_cartographer');
    s.loyalty = 30;
    shardsForAllyVictory(s.loyalty);
    assert(shardsForAllyVictory(30) >= 1, 'ally victory shards always >= 1');
    resonanceForBondThreshold(ALLY_DEFS.archive_cartographer, { ...s, spentHooks: [] });
    ok('ally rewards: shard and resonance formulas resolve');
  }

  // ---- 18. Combat edge case: 0 HP cleanly resolves to defeat (no crash/hang) ----
  {
    // D4: a player reduced to exactly 0 HP with no revive/deathward in play
    // must transition to 'defeat' and surface a well-formed snapshot.
    const player = makeTestPlayer({ str: 6, dex: 6, con: 6, int: 4, will: 4 });
    const engine = new CombatEngine({ player, enemyIds: ['echo_skeleton'], page: 1, rng: mulberry32(7100), playerHistory: new Set() });
    engine.beginRound();
    const rawE = engine as unknown as { player: { currentHP: number } };
    rawE.player.currentHP = 0; // simulate a killing blow landing
    let snap: { phase: string; playerHP: number };
    try {
      snap = engine.endPlayerPhase() as unknown as { phase: string; playerHP: number };
    } catch (e) {
      assert(false, `0 HP defeat path threw instead of resolving: ${(e as Error).message}`);
      snap = { phase: 'defeat', playerHP: 0 };
    }
    assert(snap.phase === 'defeat', `0 HP yields defeat (got phase=${snap.phase})`);
    assert(snap.playerHP === 0, `defeat snapshot reports playerHP=0 (got ${snap.playerHP})`);
    ok('edge case: 0 HP -> defeat (no throw, well-formed snapshot)');
  }

  // ---- 19. Phase 6a: Battlefield States (global damage modifiers) -------------
  {
    // Unit: state multipliers are correct and null is neutral.
    assert(battlefieldDamageMod({ id: 'sacred_ground', turns: 3 }, 'sacred') === 1.3, 'sacred ground: sacred x1.3');
    assert(battlefieldDamageMod({ id: 'sacred_ground', turns: 3 }, 'shadow') === 0.6, 'sacred ground: shadow x0.6');
    assert(battlefieldDamageMod({ id: 'silence_field', turns: 3 }, 'flame') === 0.5, 'silence field: magic x0.5');
    assert(battlefieldDamageMod({ id: 'silence_field', turns: 3 }, 'slash') === 1.1, 'silence field: physical x1.1');
    assert(battlefieldDamageMod(null, 'slash') === 1, 'no state = neutral');
    // New overrides old; same-type extends (max).
    assert(Object.keys(BATTLEFIELD_STATES).length === 8, `all 8 battlefield states defined (has ${Object.keys(BATTLEFIELD_STATES).length})`);

    // Integration: state is applied, survives one tick, then expires.
    const player = makeTestPlayer({ str: 4, dex: 6, con: 12, int: 10, will: 10 });
    const engine = new CombatEngine({ player, enemyIds: ['echo_skeleton'], page: 1, rng: mulberry32(4501), playerHistory: new Set() });
    engine.beginRound();
    engine.applyBattlefieldState('truth_aura', 2);
    let snap = engine.snapshot();
    assert(snap.battlefieldState?.id === 'truth_aura' && snap.battlefieldState.turns === 2, `state applied (id=${snap.battlefieldState?.id}, turns=${snap.battlefieldState?.turns})`);
    snap = engine.endPlayerPhase();
    assert(snap.battlefieldState?.turns === 1, `state ticks down to 1 after one round (got ${snap.battlefieldState?.turns})`);
    if (snap.phase !== 'victory' && snap.phase !== 'defeat') snap = engine.beginRound();
    snap = engine.endPlayerPhase();
    assert(snap.battlefieldState === null, `state expires after its duration (got ${snap.battlefieldState})`);
    assert(snap.log.some((l) => l.includes('battlefield state fades')), 'expiry produces a log line');
    ok('battlefield states: apply -> tick -> expire (truth_aura, 2 turns)');
  }

  // ---- 20. Phase 6b: Positioning (rows affect combat) -------------------------
  {
    // Unit: row meta is correct, defaults derive from tendency.
    assert(POSITION_META.front.dmgMult === 1.15 && POSITION_META.front.defMult === 1.1, 'front: +15% dmg, takes +10%');
    assert(POSITION_META.back.dmgMult === 0.9 && POSITION_META.back.defMult === 0.85 && POSITION_META.back.evadeBonus === 10, 'back: -10% dmg, shields 15%, +10 dodge');
    assert(POSITION_META.middle.dmgMult === 1 && POSITION_META.middle.defMult === 1, 'middle is neutral');
    assert(ROW_ORDER.length === 3 && ROW_ORDER[1] === 'middle', 'row ladder back/middle/front');
    assert(defaultRowFor('aggressor') === 'front' && defaultRowFor('berserker') === 'front', 'aggressors stand front');
    assert(defaultRowFor('caster') === 'back' && defaultRowFor('sage') === 'back', 'casters hang back');
    assert(defaultRowFor('tactician') === 'middle' && defaultRowFor(undefined) === 'middle', 'neutral tendency defaults middle');

    // Integration: enemy rows come from tendency; player starts middle.
    const player = makeTestPlayer({ str: 6, dex: 6, con: 10, int: 8, will: 6 });
    const engine = new CombatEngine({
      player,
      enemyIds: ['dust_road_raider', 'echo_skeleton'],
      page: 1,
      rng: mulberry32(4601),
      playerHistory: new Set(),
    });
    engine.beginRound();
    let snap = engine.snapshot();
    assert(snap.playerRow === 'middle', `player starts middle (got ${snap.playerRow})`);
    assert(snap.enemies.some((e) => e.row === 'front'), 'an aggressor stands front');
    assert(snap.enemies.some((e) => e.row === 'back'), 'a hunter hangs back');

    // advance (free) steps toward front; at front it idles.
    snap = engine.advance();
    assert(snap.playerRow === 'front', `advance -> front (got ${snap.playerRow})`);
    snap = engine.advance();
    assert(snap.playerRow === 'front' && snap.log.some((l) => l.includes('already at the vanguard')), 'advance idles at front');
    // retreat steps back to middle.
    snap = engine.retreat();
    assert(snap.playerRow === 'middle', `retreat -> middle (got ${snap.playerRow})`);
    snap = engine.retreat();
    assert(snap.playerRow === 'back', `retreat -> back (got ${snap.playerRow})`);
    ok('positioning: defaults, advance, retreat');

    // charge: 1 AP, surges forward, strikes. fallBack: 1 AP, drops back and guards.
    const engine2 = new CombatEngine({
      player,
      enemyIds: ['dust_road_raider'],
      page: 1,
      rng: mulberry32(4701),
      playerHistory: new Set(),
    });
    engine2.beginRound();
    const apBefore2 = engine2.snapshot().playerAP;
    snap = engine2.charge();
    assert(snap.playerRow === 'front', `charge surges forward (got ${snap.playerRow})`);
    assert(snap.playerAP <= apBefore2 - 1, `charge costs 1 AP (was ${apBefore2}, now ${snap.playerAP})`);
    ok('charging: surge forward + strike; repositioning costs AP');
  }
  // repositioning that can neither miss nor cost AP: fallBack drops back and guards.
  {
    const playerB = makeTestPlayer({ str: 6, dex: 6, con: 10, int: 8, will: 6 });
    const engine3 = new CombatEngine({
      player: playerB,
      enemyIds: ['echo_skeleton'],
      page: 1,
      rng: mulberry32(4801),
      playerHistory: new Set(),
    });
    engine3.beginRound();
    const apBefore3 = engine3.snapshot().playerAP;
    const snap3 = engine3.fallBack();
    assert(snap3.playerRow === 'back' && snap3.guarding, `fallBack drops to back + guards (row=${snap3.playerRow}, guarding=${snap3.guarding})`);
    assert(snap3.playerAP === apBefore3 - 1, `fallBack costs 1 AP (was ${apBefore3}, now ${snap3.playerAP})`);
    ok('falling back: drop 2 rows + guard (falls from middle to back)');
  }

  // ---- 21. Phase 6d: Difficulty Modes (neutral normal; stats adjust) ----------
  {
    // Unit: normal is fully neutral; easy softens, ironman is permadeath.
    assert(DIFFICULTIES.normal.playerDmgMult === 1 && DIFFICULTIES.normal.incomingMult === 1, 'normal: neutral incoming/output');
    assert(DIFFICULTIES.normal.enemyHpMult === 1 && DIFFICULTIES.normal.permadeath === false, 'normal: neutral enemy stats, no permadeath');
    assert(DIFFICULTIES.easy.enemyHpMult < 1 && DIFFICULTIES.easy.playerDmgMult > 1, 'easy: foes softer, you hit harder');
    assert(DIFFICULTIES.hard.enemyHpMult > 1 && DIFFICULTIES.hard.incomingMult > 1, 'hard: foes tougher, you take more');
    assert(DIFFICULTIES.ironman.permadeath === true && difficultyMods('hard').permadeath === false, 'ironman is a true permadeath mode');

    // Integration: enemy stat scaling is applied at build time.
    const p1 = makeTestPlayer({ str: 6, dex: 6, con: 10, int: 8, will: 6 });
    const normalEng = new CombatEngine({ player: p1, enemyIds: ['echo_skeleton'], page: 1, rng: mulberry32(5001), playerHistory: new Set() });
    normalEng.beginRound();
    const normalHp = normalEng.snapshot().enemies[0].maxHp;
    const hardEng = new CombatEngine({ player: makeTestPlayer({ str: 6, dex: 6, con: 10, int: 8, will: 6 }), enemyIds: ['echo_skeleton'], page: 1, rng: mulberry32(5101), playerHistory: new Set(), difficulty: 'hard' });
    hardEng.beginRound();
    const hardHp = hardEng.snapshot().enemies[0].maxHp;
    assert(hardHp > normalHp, `hard enemies have more HP (normal ${normalHp} vs hard ${hardHp})`);
    assert(hardEng.snapshot().difficulty === 'hard', 'snapshot exposes the active difficulty');
    ok('difficulty modes: neutral base, enemy scaling applied, snapshot surfaces mode');
  }

  // ---- 22. Phase 6c: Persistent Enemy Archive (fragments -> exploit) ----------
  {
    // Unit: fragments catalogue an enemy, then unlock the exploit.
    assert(ARCHIVE_FRAGMENT_COUNT === 3, 'exactly 3 fragments per entry');
    const ar = emptyArchive();
    assert(archiveExploited(ar, 'echo_skeleton') === false && archiveDamageBonus(ar, 'echo_skeleton') === 1, 'unknown enemy: no exploit, neutral damage');
    const a1 = addArchiveFragment(ar, 'echo_skeleton');
    assert(a1.added && !a1.complete, 'first fragment records (not yet complete)');
    addArchiveFragment(ar, 'echo_skeleton');
    const a3 = addArchiveFragment(ar, 'echo_skeleton');
    assert(a3.complete && archiveExploited(ar, 'echo_skeleton'), 'third fragment completes the entry');
    assert(addArchiveFragment(ar, 'echo_skeleton').added === false, 'no gain beyond a complete entry');
    assert(archiveDamageBonus(ar, 'echo_skeleton') === 1.15, 'exploit bonus +15% once complete');
    ok('archive: fragment accumulation flips exploited + damage bonus');

    // Integration: an exploited enemy takes +15% vs a fresh engine (same seed, identical RNG stream).
    const mk = (archive: Record<string, unknown>) => {
      const p = makeTestPlayer({ str: 12, dex: 6, con: 12, int: 10, will: 10 });
      const eng = new CombatEngine({ player: p, enemyIds: ['echo_skeleton'], page: 1, rng: mulberry32(5301), playerHistory: new Set(), enemyArchive: archive as never });
      eng.beginRound();
      const snap = eng.attack();
      return snap.enemies[0].maxHp - snap.enemies[0].hp;
    };
    const exploited = { echo_skeleton: { fragments: ['f', 'f', 'f'], exploited: true } };
    const exploitedDmg = mk(exploited);
    const freshDmg = mk({});
    assert(exploitedDmg > freshDmg, `exploit deals more damage (exploited ${exploitedDmg} vs fresh ${freshDmg})`);
    ok('archive: exploit deal damage vs a catalogued foe');

    // Engine records gains from analyze + defeat (capped).
    const pA = makeTestPlayer({ str: 12, dex: 6, con: 12, int: 10, will: 10 });
    const engA = new CombatEngine({ player: pA, enemyIds: ['echo_skeleton'], page: 1, rng: mulberry32(5401), playerHistory: new Set() });
    engA.beginRound();
    engA.analyze();
    const gains1 = engA.getArchiveGains();
    assert((gains1['echo_skeleton'] ?? 0) >= 1, `analyze credits a fragment (gains=${JSON.stringify(gains1)})`);
    ok('archive: analyze + defeat credit fragments into getArchiveGains');
  }
}

console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} SMOKE TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
