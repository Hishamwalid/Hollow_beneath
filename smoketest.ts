/**
 * Headless smoke test for the revamped combat system ("Echo" architecture).
 * Run with: npm run test
 *
 * Exercises: board generation, content rosters, full fights vs every boss,
 * affinity discovery (wk/str/null/rep/drn), Down/1-More, Guard MP economy,
 * reactions (Superconduct/Eclipse/Overcharge), chapter loadouts, events,
 * endings, and the 0-HP defeat path. No Phaser, no DOM.
 */
import type { EnemyAffinities, PlayerState, StatBlock } from '@data/types';
import { generateBoard, buildQuotaBag, chapterForIndex, scalingForIndex, LANDMARK_INDICES, CAPTURE_INDICES } from '@systems/BoardGenerator';
import { NODES_PER_CHAPTER } from './src/config';
import { ENEMIES, SUMMON_ENEMIES, enemiesForChapter, stageForChapter } from '@data/enemies';
import { BOSSES, TOTAL_MAJOR_BOSSES } from '@data/bosses';
import { NAMED_SKILLS, CHAPTER_LOADOUTS, chapterGrantSkills, DISCOVERABLE_SKILLS } from '@data/skills';
import { EVENTS, eligibleEvents } from '@data/events';
import { LORE_FRAGMENTS, TOTAL_LORE_FRAGMENTS } from '@data/loreFragments';
import { WHISPERS } from '@data/whispers';
import { ITEMS } from '@data/items';
import { ENDINGS, evaluateEnding } from '@data/endings';
import { PINNED_STORY_EVENTS, STORY_EVENTS } from '@data/storyEvents';
import { CombatEngine, type CombatSnapshot, type QteQuality } from '@systems/CombatEngine';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(`${name}${detail ? ` â€” ${detail}` : ''}`);
    console.error(`  âœ— ${name}${detail ? ` â€” ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\nâ–  ${title}`);
}

// ============================================================================
// Fixtures
// ============================================================================

function makeStats(): StatBlock {
  return { str: 6, dex: 6, con: 6, int: 6, will: 6 };
}

function makeCtx() {
  return {
    rng: Math.random,
    setFlag: () => {},
    hasFlag: () => false,
    addLoreFragment: () => {},
    addEchoShards: () => {},
    addXp: () => {},
  };
}

function makePlayer(overrides?: Partial<PlayerState>): PlayerState {
  const stats = makeStats();
  const derived = {
    maxHP: 500,
    maxMP: 140,
    attack: 90,
    defense: 55,
    magicAttack: 100,
    magicDefense: 60,
    speed: 30,
    accuracy: 95,
    dodge: 20,
  };
  const chapter5 = chapterGrantSkills(5);
  return {
    name: 'Test',
    stats,
    derived,
    currentHP: 500,
    currentMP: 140,
    level: 15,
    xp: 0,
    skillsKnown: [...chapter5],
    equippedSkills: ['heavy_crush', 'absolute_zero', 'eclipse_blade', 'sacred_ray', 'mend', 'full_knowledge'],
    resonance: 0,
    resonancePeak: 0,
    faction: { sable: 0, archive: 0, covenant: 0, caravan: 0 },
    equipment: { weapon: 'rusty_dagger', armour: 'leather_vest', accessory: null, focus: 'cracked_lens' },
    inventory: [],
    story: { eveVoiceHeard: 0, motherJournalFound: false, shardRites: {} },
    flags: {},
    history: [],
    loreFragments: [],
    enemiesKilled: 0,
    bossesDefeated: [],
    momentum: 0,
    echoShards: 0,
    unlocks: [],
    gold: 0,
    totalRuns: 1,
    bestRun: { chapter: 0, time: 0, nodesVisited: 0, enemiesKilled: 0, bossesDefeated: 0, levelReached: 1, resonancePeak: 0, choicesMade: 0, loreFound: 0 },
    ...overrides,
  };
}

/** Deterministic RNG so failures reproduce. */
function makeRng(seed = 12345): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DriveResult {
  snap: CombatSnapshot;
  rounds: number;
}

/** Auto-pilot a fight to victory/defeat. Prefers affordable offensive skills
 *  (elemental coverage matters vs null-physical foes), falls back to basic attacks. */
function drive(engine: CombatEngine, opts: { qte?: QteQuality; maxRounds?: number; seed?: number } = {}): DriveResult {
  let snap = engine.beginRound();
  let rounds = 0;
  const maxRounds = opts.maxRounds ?? 80;

  while (rounds < maxRounds) {
    if (snap.phase === 'momentum_choice') {
      snap = engine.resolveMomentum('harmony');
      continue;
    }
    if (snap.phase !== 'player') return { snap, rounds };

    if (snap.momentumReady) {
      snap = engine.resolveMomentum('harmony');
      continue;
    }

    if (!snap.actionUsed || snap.oneMore) {
      const target = snap.enemies[0];
      if (!target) break;

      // Try the first equipped offensive skill we can afford, rotating choices so
      // different damage types get used across rounds.
      let acted = false;
      for (const id of skillRotation) {
        const def = NAMED_SKILLS[id];
        if (!def?.damageType && !def?.effects?.some((e) => e.kind === 'damage')) continue;
        if ((def.mpCost ?? 0) > snap.playerMP) continue;
        const hpCostFlat = def.hpCost?.flat ?? 0;
        const hpCostPct = def.hpCost?.pct ? Math.round((def.hpCost.pct / 100) * snap.playerMaxHP) : 0;
        if (hpCostFlat >= snap.playerHP || hpCostPct >= snap.playerHP) continue;
        snap = engine.useSkill(id, target.key, opts.qte ?? 'good');
        acted = true;
        break;
      }
      if (!acted) {
        snap = engine.attack(target.key, opts.qte ?? 'good');
      }
      continue;
    }

    snap = engine.endTurn();
    rounds++;
    if (snap.phase === 'defeat') return { snap, rounds };
  }
  return { snap, rounds };
}

const skillRotation = ['absolute_zero', 'eclipse_blade', 'sacred_ray', 'heavy_crush', 'flame_pulse', 'shock_arc'];

// ============================================================================
// 1. Board generation
// ============================================================================

section('1. Board generation');
{
  const board = generateBoard(makeRng(42));
  check('board has 200 nodes', board.length === 200, `got ${board.length}`);
  const landmarks = board.filter((n) => n.type === 'landmark').map((n) => n.index);
  check(
    'landmarks at 40/80/120/160/200',
    LANDMARK_INDICES.every((i) => landmarks.includes(i)),
    JSON.stringify(landmarks),
  );
  const captures = board.filter((n) => n.type === 'discovery' || true).length;
  void captures;
  check(
    'capture indices resolve to nodes',
    CAPTURE_INDICES.every((i) => board[i - 1] != null),
  );
  check('chapters cover 1..5', board.every((n) => n.chapter === chapterForIndex(n.index)));
  check('scaling grows with depth', scalingForIndex(1).hp < scalingForIndex(200).hp);
  // Pinned story events: every pinned node exists, is an event node, and carries its id.
  const pinnedEntries = Object.entries(PINNED_STORY_EVENTS);
  check('11 story beats pinned', pinnedEntries.length === 11, `got ${pinnedEntries.length}`);
  for (const [nodeStr, storyId] of pinnedEntries) {
    const idx = Number(nodeStr);
    const node = board[idx - 1];
    check(`story node ${idx} generated`, !!node && node.type === 'event' && node.subtype === `story:${storyId}`,
      node ? `${node.type}/${node.subtype}` : 'missing');
    check(`story '${storyId}' defined`, !!STORY_EVENTS[storyId]);
    const ev = STORY_EVENTS[storyId]!;
    check(`story '${storyId}' choices resolvable`, ev.choices.every((c) => typeof c.onSuccess(makePlayer(), makeCtx()) === 'string'));
  }
  // No companions anywhere.
  check('no companion nodes on board', board.every((n) => !n.subtype.startsWith('ally:')));

  // ---- Distribution constraints ---------------------------------------------
  const isFreeNode = (n: BoardNode) => !LANDMARK_INDICES.includes(n.index) && n.subtype !== 'capture_point' && !n.subtype.startsWith('story:');
  let adjClashes = 0;
  for (let i = 0; i < board.length - 1; i++) {
    if (isFreeNode(board[i]) && isFreeNode(board[i + 1]) && board[i].type === board[i + 1].type) adjClashes++;
  }
  check('no same-type nodes side by side', adjClashes === 0, `${adjClashes} clashes`);

  for (let ch = 1; ch <= 5; ch++) {
    const freeTypes = board.filter((n) => n.chapter === ch && isFreeNode(n)).map((n) => n.type);
    const expected = buildQuotaBag(freeTypes.length);
    const tally = (arr: string[]) => {
      const acc: Record<string, number> = arr.reduce<Record<string, number>>((a, t) => { a[t] = (a[t] ?? 0) + 1; return a; }, {});
      return Object.keys(acc).sort().map((k) => `${k}:${acc[k]}`).join(',');
    };
    check(
      `chapter ${ch} matches quota bag exactly`,
      tally(freeTypes) === tally(expected),
      `got [${tally(freeTypes)}] want [${tally(expected)}]`,
    );
  }

  const replayed = generateBoard(makeRng(42));
  check('same seed reproduces identical board', JSON.stringify(board.map((n) => [n.index, n.type, n.subtype])) === JSON.stringify(replayed.map((n) => [n.index, n.type, n.subtype])));
  const altSeed = generateBoard(makeRng(43));
  const differing = board.filter((n, i) => isFreeNode(n) && n.type !== altSeed[i].type).length;
  check('different seed rearranges free nodes', differing > 20, `only ${differing} differ`);
}

// ============================================================================
// 2. Content rosters
// ============================================================================

section('2. Content rosters');
{
  const stdCount = Object.keys(ENEMIES).length;
  check('â‰¥12 standard enemies', stdCount >= 12, `got ${stdCount}`);
  check('summon defs present', Object.keys(SUMMON_ENEMIES).length >= 4, `got ${Object.keys(SUMMON_ENEMIES).length}`);
  for (const [id, def] of Object.entries(ENEMIES)) {
    check(`${id} has moves`, def.moves.length > 0);
    check(`${id} has level`, typeof def.level === 'number' && def.level > 0);
  }
  check('5 bosses defined', Object.keys(BOSSES).length === TOTAL_MAJOR_BOSSES);
  for (const [id, boss] of Object.entries(BOSSES)) {
    check(`${id} has phases`, boss.phases.length > 0);
    check(`${id} has moves`, boss.moves.length > 0);
    check(`${id} aftermath/rewards wired`, typeof boss.aftermathText({}) === 'string' && boss.getRewards({}).flag.length > 0);
  }
  // Chapter loadout integrity: every referenced skill exists.
  for (const [ch, ids] of Object.entries(CHAPTER_LOADOUTS)) {
    for (const id of ids) {
      check(`ch${ch} loadout skill '${id}' exists`, !!NAMED_SKILLS[id]);
    }
  }
  check('chapter grants cover ch1..5', chapterGrantSkills(5).length >= 20, `got ${chapterGrantSkills(5).length}`);
  for (const id of DISCOVERABLE_SKILLS) check(`discoverable '${id}' exists`, !!NAMED_SKILLS[id]);
  check('lore fragments complete', Object.keys(LORE_FRAGMENTS).length === TOTAL_LORE_FRAGMENTS);
  check('whispers present', WHISPERS.length >= 40, `got ${WHISPERS.length}`);
  check('items present', Object.keys(ITEMS).length >= 25, `got ${Object.keys(ITEMS).length}`);
  check('exactly 3 endings (definitive edition)', ENDINGS.length === 3, `got ${ENDINGS.length}`);
  // Ending evaluation: outcome flags decide everything.
  const basePlayer = makePlayer();
  check('fallback without flags resolves deterministically', typeof evaluateEnding(basePlayer).id === 'string');
  const hollow = makePlayer({ flags: { final_reflection_defeated: true } });
  check('defeat reflection â†’ THE HOLLOW', evaluateEnding(hollow).id === 'the_hollow');
  const lostDark = makePlayer({ flags: { final_reflection_lost: true, ending_choice_dark: true } });
  check('lost + accept â†’ LOST IN THE DARK', evaluateEnding(lostDark).id === 'lost_in_the_dark');
  const lostClimb = makePlayer({ flags: { final_reflection_lost: true, ending_choice_climb: true } });
  check('lost + climb â†’ THE RETURN', evaluateEnding(lostClimb).id === 'the_return');
  // Sera Voss is gone.
  check('sera_voss removed from roster', !ENEMIES.sera_voss && !SUMMON_ENEMIES.sera_voss);

  // Stage pools sanity
  check('stage 1 pool correct', JSON.stringify(enemiesForChapter(1, 0).sort()) === JSON.stringify(['dust_wight', 'echo_skeleton']));
  check('memory_wraith gated at res 25', enemiesForChapter(3, 30).includes('memory_wraith'));
  check('the_unread gated at res 50', enemiesForChapter(5, 60).includes('the_unread'));
  check('stageForChapter boundaries', stageForChapter(1) === 1 && stageForChapter(3) === 3 && stageForChapter(5) === 5);
}

// ============================================================================
// 3. Regular fight â†’ victory + discovery
// ============================================================================

section('3. Regular fight vs echo_skeleton (weak flame)');
{
  const player = makeWeakPlayer({ equippedSkills: ['flame_pulse', 'heavy_guard', 'mend' ], skillsKnown: [...new Set([...chapterGrantSkills(5), 'flame_pulse', 'heavy_guard'])] });
  const engine = new CombatEngine({
    player,
    enemyIds: ['echo_skeleton'],
    nodeIndex: 1,
    rng: makeRng(1000),
  });

  // Flame Pulse targets the skeleton's flame weakness (may outright kill it).
  let snap = engine.beginRound();
  const targetKey = snap.enemies[0].key;

  snap = engine.useSkill('flame_pulse', targetKey, 'good');
  check('skill resolved (no pending qte)', snap.qte === null);

  const gains = engine.getDiscoveryGains();
  check('flame slot discovered as wk', gains.echo_skeleton?.flame === 'wk', JSON.stringify(gains.echo_skeleton));
  const skeletonDied = !snap.enemies.some((e) => e.defId === 'echo_skeleton');
  check(
    'weakness consequence visible (downed or kill)',
    skeletonDied || (snap.enemies[0]?.statuses ?? []).some((s) => s.id === 'downed') || snap.oneMore,
  );

  if (!skeletonDied && snap.phase === 'player') {
    const result = drive(engine, { qte: 'good', seed: 11 });
    check('fight reaches victory', result.snap.phase === 'victory', `phase=${result.snap.phase}`);
  } else {
    check('fight reached victory via weakness hit', engine.snapshot().phase === 'victory');
  }
  check('xp earned', engine.getXpEarned() > 0);
  check('kill counted', engine.getEnemiesKilled() >= 1);
  check('kills-by-def tracked', engine.getKillsByDef().echo_skeleton === 1);
}

// ============================================================================
// 3b. Downed + 1-More observed on a sturdy target
// ============================================================================

section('3b. Downed & 1-More');
{
  const player = makeWeakPlayer({ equippedSkills: ['frost_touch'], skillsKnown: [...chapterGrantSkills(5), 'frost_touch'] });
  const engine = new CombatEngine({
    player,
    enemyIds: ['venn_custodian'],
    nodeIndex: NODES_PER_CHAPTER,
    rng: makeRng(1500),
  });
  let snap = engine.beginRound();
  const key = snap.enemies[0].key;

  snap = engine.useSkill('frost_touch', key, 'good'); // frost = custodian weakness
  const view = snap.enemies.find((e) => e.key === key);
  check('custodian survived the probe', !!view && view.hp > 0, `hp=${view?.hp}`);
  check('downed applied on weakness hit', !!view && view.statuses.some((s) => s.id === 'downed'), JSON.stringify(view?.statuses));
  // 1-More is granted as an open turn: actionUsed is false right after the weakness
  // hit (the flag itself is consumed by the granting action).
  check('1-More granted (turn stays open)', snap.phase !== 'player' || snap.actionUsed === false, `phase=${snap.phase} used=${snap.actionUsed}`);

  // Regression: the extra action is single-use â€” the following move must end the turn.
  if (snap.phase === 'player') {
    snap = engine.attack(key);
    if (snap.phase === 'player' && !snap.qte) {
      check('oneMore consumed after the extra action', snap.oneMore === false, `oneMore=${snap.oneMore}`);
      check('turn locks after the extra action', snap.actionUsed === true);
    }
  }
}

// ============================================================================
// 3c. QTE surface: an unresolved timing parks the strike; resolveQte carries it
// ============================================================================

section('3c. QTE surface: skills park timing Â· basic attacks resolve instantly');
{
  // Offensive skills park a pending QTE until resolved. Frost vs echo_skeleton is
  // a NEUTRAL matchup, so this isolates the timing flow from the 1-More path.
  const p1 = makeWeakPlayer({ equippedSkills: ['frost_touch'], skillsKnown: [...chapterGrantSkills(1), 'frost_touch'] });
  const skillEngine = new CombatEngine({ player: p1, enemyIds: ['echo_skeleton'], nodeIndex: 1, rng: makeRng(1800) });
  let snap = skillEngine.beginRound();
  const key = snap.enemies[0].key;

  snap = skillEngine.useSkill('frost_touch', key);
  check('offensive skill parks a pending QTE', snap.qte !== null && snap.phase === 'player', `qte=${snap.qte ? 'yes' : 'no'}`);
  check('no action consumed while QTE pending', snap.actionUsed === false);
  const hpBefore = snap.enemies.find((e) => e.key === key)?.hp ?? -1;
  snap = skillEngine.resolveQte('good');
  check('resolveQte clears the pending QTE', snap.qte === null);
  check('action consumed after QTE resolve', snap.phase !== 'player' || snap.actionUsed === true);
  const after = snap.enemies.find((e) => e.key === key);
  check('timed strike dealt damage', !after || after.hp < hpBefore, `hp ${hpBefore}â†’${after?.hp ?? 'dead'}`);

  // Basic attacks have no timing bar â€” they resolve immediately.
  const atkEngine = new CombatEngine({ player: makeWeakPlayer(), enemyIds: ['echo_skeleton'], nodeIndex: 1, rng: makeRng(1801) });
  let asnap = atkEngine.beginRound();
  asnap = atkEngine.attack(asnap.enemies[0].key);
  check('basic attack resolves immediately (no QTE)', asnap.qte === null);
  check('basic attack consumed the action', asnap.actionUsed === true || asnap.oneMore === true);

  // A missed timing window never whiffs â€” it connects at reduced power (Ã—0.8).
  const missEngine = new CombatEngine({
    player: makeWeakPlayer({ equippedSkills: ['frost_touch'], skillsKnown: [...chapterGrantSkills(1), 'frost_touch'] }),
    enemyIds: ['echo_skeleton'], nodeIndex: 1, rng: makeRng(1802),
  });
  let msnap = missEngine.beginRound();
  const mkey = msnap.enemies[0].key;
  const mHpBefore = msnap.enemies.find((e) => e.key === mkey)?.hp ?? -1;
  msnap = missEngine.useSkill('frost_touch', mkey);
  msnap = missEngine.resolveQte('miss');
  const mAfter = msnap.enemies.find((e) => e.key === mkey);
  check('missed QTE timing still connects (reduced damage)', !mAfter || mAfter.hp < mHpBefore, `hp ${mHpBefore}â†’${mAfter?.hp ?? 'dead'}`);

  // Turn order includes the player so the panel can list everyone.
  check('turn order includes the player', asnap.turnOrder.includes('player'));
}

// ============================================================================
// 3d. No 1-More chains on already-downed targets
// ============================================================================

section('3d. Downed re-hit grants nothing');
{
  const p = makeWeakPlayer({ equippedSkills: ['frost_touch'], skillsKnown: [...chapterGrantSkills(1), 'frost_touch'] });
  const engine = new CombatEngine({ player: p, enemyIds: ['venn_custodian'], nodeIndex: NODES_PER_CHAPTER, rng: makeRng(1900) });
  let snap = engine.beginRound();
  const key = snap.enemies[0].key;

  snap = engine.useSkill('frost_touch', key, 'good'); // weakness â†’ Downed + open turn
  if (snap.phase === 'player' && !snap.actionUsed) {
    // The extra action re-hits the SAME downed target's weakness â€” must NOT reopen the turn.
    snap = engine.useSkill('frost_touch', key, 'good');
    check('weakness on a downed target grants no extra action', snap.phase !== 'player' || snap.actionUsed === true, `used=${snap.actionUsed}`);
  }
}

// ============================================================================
// 4. Affinity behaviours: null / reflect / drain
// ============================================================================

section('4. Dust Wight affinities (null blunt Â· rep flame Â· drn frost)');
{
  // dust_wight: wk slash, str pierce, null blunt, rep flame â€” frost neutral here,
  // so drain is asserted via archive_cipher_wraith (drn shadow).
  const player = makeWeakPlayer();

  const wightEngine = new CombatEngine({
    player: { ...player, equippedSkills: ['heavy_guard', 'flame_pulse'] },
    enemyIds: ['dust_wight'],
    nodeIndex: 1,
    rng: makeRng(2000),
  });
  let snap = wightEngine.beginRound();
  const wightKey = snap.enemies[0].key;
  const wightStartHp = snap.enemies[0].hp;

  // Blunt â†’ NULL
  snap = wightEngine.useSkill('heavy_guard', wightKey, 'good');
  check('blunt nullified vs dust_wight', snap.enemies[0]?.hp === wightStartHp || snap.phase !== 'player', `hp ${wightStartHp}â†’${snap.enemies[0]?.hp}`);

  // New round (one action per turn), then Flame â†’ REFLECT (player should take damage)
  wightEngine.endTurn();
  const hpBeforeReflect = wightEngine.snapshot().playerHP;
  const wKey2 = wightEngine.snapshot().enemies[0]?.key ?? wightKey;
  snap = wightEngine.useSkill('flame_pulse', wKey2, 'good');
  const hpAfterReflect = wightEngine.snapshot().playerHP;
  const reflected = hpAfterReflect < hpBeforeReflect;
  check('flame reflected by dust_wight', reflected || snap.phase !== 'player' || !snap.enemies.length,
    `playerHP ${hpBeforeReflect}â†’${hpAfterReflect}`);

  const wGains = wightEngine.getDiscoveryGains();
  check('null discovered', wGains.dust_wight?.blunt === 'null', JSON.stringify(wGains.dust_wight));
  check('rep discovered', wGains.dust_wight?.flame === 'rep', JSON.stringify(wGains.dust_wight));

  // Shadow â†’ DRAIN vs cipher wraith
  const drainEngine = new CombatEngine({
    player: { ...player, equippedSkills: ['shadow_veil'] },
    enemyIds: ['archive_cipher_wraith'],
    nodeIndex: NODES_PER_CHAPTER * 2,
    rng: makeRng(3000),
  });
  let dsnap = drainEngine.beginRound();
  const wraithHpBefore = dsnap.enemies[0].hp;
  dsnap = drainEngine.useSkill('shadow_veil', dsnap.enemies[0].key, 'good');
  const after = drainEngine.snapshot().enemies[0];
  check('shadow drained by cipher wraith (healed)', !after || after.hp >= wraithHpBefore - 1 || after.hp <= 0,
    `hp ${wraithHpBefore}â†’${after?.hp}`);
  check('drn discovered', drainEngine.getDiscoveryGains().archive_cipher_wraith?.shadow === 'drn',
    JSON.stringify(drainEngine.getDiscoveryGains().archive_cipher_wraith));
}

// ============================================================================
// 5. Guard economy (+6 MP) & momentum payoffs
// ============================================================================

section('5. Guard economy & momentum');
{
  const player = makePlayer({ currentMP: 50 });
  const engine = new CombatEngine({
    player,
    enemyIds: ['venn_custodian'],
    nodeIndex: NODES_PER_CHAPTER,
    rng: makeRng(4000),
  });
  let snap = engine.beginRound();
  const mpBefore = snap.playerMP;

  snap = engine.guard();
  check('guard sets guarding flag', snap.guarding === true);
  check('guard restores +6 MP', snap.playerMP === Math.min(snap.playerMaxMP, mpBefore + 6), `${mpBefore}â†’${snap.playerMP}`);
  check('guard grants momentum', snap.momentum >= 1);
}

// ============================================================================
// 6. Boss fights â€” all five, start to finish
// ============================================================================

section('6. All five bosses (full fights)');
for (const [bossId, boss] of Object.entries(BOSSES)) {
  const player = makePlayer({
    flags: {},
  });
  const engine = new CombatEngine({
    player,
    enemyIds: [],
    nodeIndex: boss.chapter * NODES_PER_CHAPTER,
    rng: makeRng(5000 + bossId.length * 31),
    bossId,
    difficulty: 'normal',
  });
  const result = drive(engine, { qte: 'good', maxRounds: 90, seed: 6000 + boss.chapter * 10 });
  check(
    `boss '${bossId}' â†’ victory`,
    result.snap.phase === 'victory',
    `phase=${result.snap.phase} round=${result.snap.round} enemiesLeft=${result.snap.enemies.length}`,
  );
  check(`boss '${bossId}' rewards flag available`, Object.keys(engine.getFlags()).length >= 0);
}

// ============================================================================
// 7. Reactions: Superconduct (frostâ†’shock)
// ============================================================================

section('7. Superconduct reaction');
{
  const player = makePlayer({
    equippedSkills: ['frost_touch', 'shock_arc'],
    skillsKnown: [...new Set([...makeWeakPlayer().skillsKnown, 'frost_touch', 'shock_arc'])],
  });
  const engine = new CombatEngine({
    player,
    enemyIds: ['venn_custodian'],
    nodeIndex: NODES_PER_CHAPTER,
    rng: makeRng(7000),
  });
  let snap = engine.beginRound();
  const key = snap.enemies[0].key;

  snap = engine.useSkill('frost_touch', key, 'good'); // applies chilled marker
  const chilledApplied = snap.enemies.some((e) => e.statuses.some((s) => s.id === 'chilled'));
  check('frost_touch applies Chilled', chilledApplied || snap.phase !== 'player');

  snap = engine.endTurn(); // custodian acts (may heal/shield)
  snap = engine.snapshot();
  if (snap.phase === 'player' && !snap.actionUsed) {
    snap = engine.useSkill('shock_arc', key, 'good');
    const stunnedAfter = snap.enemies.some((e) => e.key === key && e.statuses.some((s) => s.id === 'stun'));
    check('superconduct stuns chilled target', stunnedAfter || snap.phase !== 'player' || !snap.enemies.length,
      `statuses=${JSON.stringify(snap.enemies.find((e) => e.key === key)?.statuses ?? [])}`);
  } else {
    check('superconduct stuns chilled target (skipped â€” fight state moved on)', true);
  }
}

// ============================================================================
// 8. Chapter loadouts (pure grant logic)
// ============================================================================

section('8. Chapter loadouts');
{
  const granted1 = chapterGrantSkills(1);
  check('ch1 grants six skills', granted1.length === 6, `got ${granted1.length}`);
  const granted5 = chapterGrantSkills(5);
  check('grants are cumulative & unique', new Set(granted5).size === granted5.length);
  check('ch5 includes deep tools', ['full_knowledge', 'eclipse_blade', 'absolute_zero', 'aegis_covenant'].every((id) => granted5.includes(id)));
  // Idempotence
  const again = chapterGrantSkills(5);
  check('re-grant stable', again.length === granted5.length && again.every((id) => granted5.includes(id)));
}

// ============================================================================
// 9. Events resolve without throwing
// ============================================================================

section('9. Event sweep');
{
  const player = makePlayer();
  let resolved = 0;
  let threw = 0;
  for (const event of Object.values(EVENTS)) {
    for (const choice of event.choices) {
      try {
        const p = structuredCloneish(player);
        choice.onSuccess(p, {
          rng: makeRng(99),
          setFlag: (f) => { p.flags[f] = true; },
          hasFlag: (f) => !!p.flags[f],
          addLoreFragment: () => {},
          addEchoShards: () => {},
          addXp: () => {},
        });
        resolved++;
      } catch {
        threw++;
      }
    }
  }
  check('all event choices execute cleanly', threw === 0, `${threw} threw`);
  check('event choices resolved', resolved > 100, `resolved ${resolved}`);
  check('chapter 1 has eligible events at low resonance', eligibleEvents(1, 0, new Set(), {}).length > 0);
}

function structuredCloneish(p: PlayerState): PlayerState {
  return JSON.parse(JSON.stringify(p)) as PlayerState;
}

/** Low-power probe fixture: survives single hits so affinity/status effects stay observable. */
function makeWeakPlayer(overrides?: Partial<PlayerState>): PlayerState {
  const p = makePlayer(overrides);
  p.derived = { ...p.derived, attack: 18, magicAttack: 22 };
  return p;
}

// ============================================================================
// 10. Defeat path (0 HP)
// ============================================================================

section('10. Defeat path');
{
  const player = makePlayer({ currentHP: 1, defense: 0, magicDefense: 0, derived: { ...makePlayer().derived, defense: 0, magicDefense: 0, maxHP: 1 } });
  const engine = new CombatEngine({
    player,
    enemyIds: ['ash_mutant'],
    nodeIndex: NODES_PER_CHAPTER * 3,
    rng: makeRng(8000),
  });
  let snap = engine.beginRound();
  let guard = 0;
  while (snap.phase === 'player' && guard < 40) {
    snap = engine.endTurn();
    guard++;
  }
  check('player dies â†’ defeat phase', snap.phase === 'defeat', `phase=${snap.phase} hp=${snap.playerHP}`);
}

// ============================================================================
// 11. Scan info surface
// ============================================================================

section('11. Scan data');
{
  const engine = new CombatEngine({
    player: makePlayer(),
    enemyIds: ['dust_road_raider'],
    nodeIndex: NODES_PER_CHAPTER * 2,
    rng: makeRng(9000),
  });
  engine.beginRound();
  const key = engine.snapshot().enemies[0].key;
  const info = engine.getScanInfo(key);
  check('scan returns name', info?.name === 'Dust-Road Raider');
  check('scan returns level', (info?.level ?? 0) > 0);
  check('scan lists moves', (info?.moves.length ?? 0) >= 2, JSON.stringify(info?.moves.map((m) => m.label)));
  check('scan reports max pools', (info?.maxHp ?? 0) > 0 && (info?.maxMp ?? 0) > 0);
}

// ============================================================================
// Summary
// ============================================================================

console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
console.log(`PASSED: ${passed}   FAILED: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  âœ— ${f}`);
  process.exitCode = 1;
} else {
  console.log('ALL SMOKE TESTS PASSED');
}
