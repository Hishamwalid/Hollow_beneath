// ============================================================================
// THE HOLLOW BENEATH — Core Types
// Source of truth for every system. Matches GDD v2.0 formulas exactly.
// ============================================================================

// ---- Stats -----------------------------------------------------------------

export interface StatBlock {
  str: number;
  dex: number;
  con: number;
  int: number;
  will: number;
}

export interface DerivedStats {
  maxHP: number;
  maxMP: number;
  attack: number;
  defense: number;
  magicAttack: number;
  magicDefense: number;
  speed: number;
  accuracy: number; // capped 95
  dodge: number; // capped 40
}

// ---- Damage & Affinity -------------------------------------------------------

export type DamageType =
  | 'slash'
  | 'pierce'
  | 'blunt'
  | 'flame'
  | 'frost'
  | 'shock'
  | 'sacred'
  | 'shadow';

/** Multiplier map. 1.5 weak, 1.0 normal, 0.5 resist, 0 immune, -1 absorb (heals target). */
export type AffinityMap = Partial<Record<DamageType, number>>;

// ---- Status Effects ----------------------------------------------------------

export type DotId = 'poison' | 'burn' | 'bleed' | 'curse' | 'frostbite' | 'shock_dot';
export type ControlId = 'sleep' | 'fear' | 'silence' | 'blind' | 'confuse' | 'stun' | 'root';
export type BuffId = 'focus' | 'barrier' | 'regeneration' | 'fortify' | 'blessing' | 'haste' | 'reflection' | 'brace' | 'echo_surge' | 'atk_up';
export type DebuffId = 'weakness' | 'defense_down' | 'slow' | 'armour_break' | 'seal_mind' | 'fragile_perception' | 'exhausted';
export type StatusId = DotId | ControlId | BuffId | DebuffId;

export interface StatusInstance {
  id: StatusId;
  stacks: number; // DoTs stack to 3; everything else is non-stacking (stacks stays 1)
  turnsRemaining: number;
  meta?: Record<string, number>; // e.g. barrier absorb amount
}

// ---- Combat Actions ------------------------------------------------------------

export type ActionId =
  | 'attack'
  | 'skill'
  | 'resonance_ability'
  | 'guard'
  | 'use_item'
  | 'analyze'
  | 'sunder'
  | 'withdraw'
  | 'focus'
  | 'brace';

/** Structured effect resolved generically by CombatEngine (Phase 4a). */
export type SkillEffect =
  | { kind: 'damage'; type: DamageType; power: number; target: 'single' | 'all'; stat: 'atk' | 'magic'; guaranteed?: boolean }
  | { kind: 'status'; id: StatusId; turns: number; stacks?: number; target: 'single' | 'all' }
  | { kind: 'buff'; id: StatusId; turns: number }
  | { kind: 'debuff'; id: StatusId; turns: number }
  | { kind: 'heal'; pct?: number; flat?: number }
  | { kind: 'barrier'; pct: number; turns: number }
  | { kind: 'cost'; hpFlat?: number; hpPct?: number; resonance?: number; onHit?: boolean }
  | { kind: 'resource'; momentum?: number; mp?: number }
  | { kind: 'evade' }
  | { kind: 'next_attack_amp'; dmg: number; guaranteed?: boolean };

export interface SkillDef {
  id: string;
  name: string;
  apCost: number;
  mpCost?: number; // MP cost to use (optional, default 0)
  damageType?: DamageType;
  skillPower?: number; // multiplier in the damage formula (style hint / fallback for non-effects computed)
  minResonance?: number; // resonance ability gate
  description: string;
  /** Structured effects resolved generically by CombatEngine (Phase 4a). Active skills use this. */
  effects?: SkillEffect[];
  /** legacy custom effect hook — retained for passive checks & backwards-compat until full migration */
  tag?: string;
  /** organizational grouping only (Warrior/Ranger/Scholar/Guardian/Shadow/Universal); no separate spend-points system */
  tree?: 'warrior' | 'ranger' | 'scholar' | 'guardian' | 'shadow' | 'balanced' | 'universal';
  /** Combo tags (Phase 3): Strike/Break/Analyze/Guard + Physical/Elemental + damage-type + specials (Mark, Taunt). */
  tags?: ActionTag[];
}

export type ActionTag =
  | 'Strike' | 'Break' | 'Analyze' | 'Guard'
  | 'Physical' | 'Elemental'
  | 'Slash' | 'Pierce' | 'Blunt' | 'Flame' | 'Frost' | 'Shock' | 'Sacred' | 'Shadow'
  | 'Mark' | 'Counter' | 'Knowledge' | 'Mental' | 'Defense' | 'Stance' | 'Taunt' | 'Stealth' | 'Charge';

// ---- Combatants ----------------------------------------------------------------

export interface CombatantBase {
  name: string;
  hp: number;
  maxHp: number;
  mp?: number;
  maxMp?: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  spd: number;
  accuracy: number;
  dodge: number;
  statuses: StatusInstance[];
  momentum: number; // 0-3, player only conceptually, but tracked generically
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  spd: number;
  dodge?: number; // default 10
  accuracy?: number; // default 80
  attackType: DamageType;
  affinities: AffinityMap;
  xp: number;
  echoVariant?: boolean; // true if this is a Resonance-tier "Echo" reskin
  minResonance?: number; // only spawns if resonance >= this (e.g. Memory Wraith)
  description: string;
  /** Personality archetype, used for the HUD tendency glyph and investigation flavor. */
  tendency?: EnemyTendency;
  /** Phase 6b (override): preferred battlefield row. Defaults to a tendency-derived row. */
  position?: Row;
  /** Pre-declared move pool. Engine picks one at round start and resolves it when the enemy acts. */
  intents?: IntentDef[];
  /** Called on this enemy's turn. Mutates ctx and returns a log line. Legacy fallback when `intents` is absent. */
  act(ctx: EnemyTurnContext): string;
}

export interface EnemyTurnContext {
  self: CombatState_Enemy;
  player: CombatState_Player;
  allies: CombatState_Enemy[]; // other enemies in the fight
  turn: number;
  rng: () => number;
  applyDamageToPlayer: (amount: number, type: DamageType, sourceLabel: string) => number;
  applyStatusToPlayer: (id: StatusId, turns: number, stacks?: number, meta?: Record<string, number>) => void;
  healSelf: (amount: number) => void;
  applyStatusToSelf: (id: StatusId, turns: number, stacks?: number, meta?: Record<string, number>) => void;
  spawnAlly: (enemyId: string, hpOverride?: number) => void;
  removePlayerBuffs: () => void;
}

export interface CombatState_Enemy extends CombatantBase {
  defId: string;
  attackType: DamageType;
  affinities: AffinityMap;
  xp: number;
  tag?: string; // free-form flag storage for AI memory (e.g. "usedRattle")
  flags: Record<string, number>;
}

export interface CombatState_Player extends CombatantBase {
  guarding: boolean;
}

// ---- Enemy tendency & intent system (Phase 2) --------------------------------

/** The 10 behavioral archetypes from the battle system doc, Part 5. */
export type EnemyTendency =
  | 'aggressor' | 'tactician' | 'berserker' | 'guardian' | 'caster'
  | 'hunter' | 'sage' | 'coward' | 'fanatic' | 'manipulator';

/** Battlefield row occupied by an entity (Phase 6b: Positioning). Rows 0..2 over `back/middle/front`. */
export type Row = 'back' | 'middle' | 'front';

export interface IntentDef {
  id: string;
  label: string;
  weight?: number; // default 1 (higher = picked more often among eligible intents)
  description: string;
  condition?: (ctx: EnemyTurnContext) => boolean;
  resolve: (ctx: EnemyTurnContext) => string;
}

export interface BossIntentDef {
  id: string;
  label: string;
  weight?: number; // default 1
  description: string;
  condition?: (ctx: BossTurnContext) => boolean;
  resolve: (ctx: BossTurnContext) => void;
  /** Phase 5: instead of resolving now, the boss declares ("charging") and unleashes it on its NEXT turn. */
  charge?: boolean;
}

// ---- Phase 5: Boss intelligence -------------------------------------------------

/** Stress bands a boss moves through during a fight. */
export type StressBand = 'low' | 'medium' | 'high' | 'critical';

/** The 12 player-metrics a boss profiles during a fight (combat-local). */
export interface BossProfile {
  dmgByType: Partial<Record<DamageType, number>>;
  totalDmg: number;
  actions: number;
  turns: number;
  guards: number;
  analyzes: number;
  items: number;
  heals: number;            // HP actually restored (for dominance checks)
  healCount: number;        // times the player healed (for Interdict adaptation)
  buffsUsed: number;        // buffs the player applied to itself
  statusesApplied: number;  // statuses the player inflicted
  momentumSpends: number;   // momentum choice trigger used
  weaknessHits: number;
  crits: number;
  combos: number;
  repeats: number;          // times the player used the same action two turns running
}

/** Read-only view of a profile used by the adaptation evaluator / HUD. */
export interface ProfileView {
  totalDmg: number;
  physPct: number;
  magicPct: number;
  favoriteElement: DamageType | null;
  favoriteShare: number;
  guardPct: number;
  analyzeCount: number;
  actionsPerTurn: number;
  healCount: number;
  items: number;
  statusesApplied: number;
  buffsUsed: number;
  momentumSpends: number;
  weaknessHits: number;
  crits: number;
  combos: number;
  repeats: number;
  turns: number;
}

/** Adaptations a boss learns mid-fight from profiling the player. */
export type AdaptationId =
  | 'magic_shield'
  | 'armor_pierce'
  | 'blind_marksman'
  | 'unreadable'
  | 'resonance_drain'
  | 'elemental_resistance'
  | 'interdict'
  | 'dispel_conclave'
  | 'echo_lock';

/** Per-boss behavioural identity (Phase 5 personalities). */
export interface BossPersona {
  label: string;   // Scholar / Executioner / Echo / Martyr / Prophet
  blurb: string;   // one flavour line about how it fights
  /** Fossil King: taking damage lashes back at the player. */
  martyr?: boolean;
}

// ---- Bosses --------------------------------------------------------------------

export interface BossPhaseInfo {
  key: string;
  label: string;
  hpFloorPercent: number; // phase active while hp% > this floor
  affinities: AffinityMap;
}

export interface BossTurnContext {
  self: CombatState_Enemy;
  player: CombatState_Player;
  turn: number;
  phaseKey: string;
  rng: () => number;
  log: string[];
  flags: Record<string, number>;
  applyDamageToPlayer: (amount: number, type: DamageType, sourceLabel: string, bypassGuard?: boolean) => number;
  applyStatusToPlayer: (id: StatusId, turns: number, stacks?: number, meta?: Record<string, number>) => void;
  applyStatusToSelf: (id: StatusId, turns: number, stacks?: number, meta?: Record<string, number>) => void;
  healSelf: (amount: number) => void;
  damageSelf: (amount: number) => void;
  buffSelf: (statKey: 'atk' | 'def' | 'matk' | 'mdef' | 'spd', percent: number) => void;
  spawnAlly: (enemyId: string, hpOverride?: number) => void;
  removePlayerBuffs: () => void;
  clearBarrier: () => void;
  setBarrier: (amount: number) => void;
  endCombat: (victory: boolean) => void;
  playerHistory: Set<string>; // flags accumulated across the run (for Reflection adaptation)
  playerBuild: StatBlock;
  playerFaction: FactionState;
  playerResonance: number;
  playerLastActionType: DamageType | null; // damage type of the player's most recent offensive action
  playerRepeatedLastAction: boolean; // true if the player used the same action id two turns running
  // Phase 5: boss intelligence read-outs (profiling / stress / adaptations)
  stress: number;
  band: StressBand;
  adaptations: AdaptationId[];
}

export interface BossDef {
  id: string;
  name: string;
  vennName: string;
  page: number;
  theme: string;
  baseStats: { hp: number; atk: number; matk: number; def: number; mdef: number; spd: number };
  approachText: string;
  preCombatChoices?: BossPreCombatChoice[];
  getPhase(hpPercent: number): BossPhaseInfo;
  /** Pre-declared move pool (intent system). Engine picks one at round start and resolves it when the boss acts. */
  intents?: BossIntentDef[];
  /** Executed once per boss turn. May call ctx.endCombat() for scripted phase transitions. Legacy fallback when `intents` is absent. */
  takeTurn(ctx: BossTurnContext): void;
  /** Phase 5: personality identity — flavour + behaviour hooks (e.g. martyr). */
  persona?: BossPersona;
  /** Phase 6b (override): preferred battlefield row for this boss. Defaults to 'middle'. */
  position?: Row;
  aftermathText(flags: Record<string, number>): string;
  getRewards(flags: Record<string, number>): BossRewards;
}

export interface BossPreCombatChoice {
  id: string;
  label: string;
  requirement?: (player: PlayerState) => boolean;
  apply: (player: PlayerState, combatFlags: Record<string, number>, rng: () => number) => string; // returns resolution text; may skip combat
  skipsCombat?: boolean;
}

export interface BossRewards {
  factionDelta?: Partial<FactionState>;
  resonanceDelta?: number;
  maxHpPercentDelta?: number; // e.g. -20 for Chorus's "offered yourself" outcome
  echoShards: number;
  skillUnlock?: string;
  loreFragment?: string;
  itemReward?: string; // item id rewarded to the player on defeat
  flag: string;
}

// ---- Factions & Resonance --------------------------------------------------------

export interface FactionState {
  sable: number;
  archive: number;
  covenant: number;
  caravan: number;
}

export type ResonanceTier = 'stable' | 'awakened' | 'unmoored' | 'transcendent';

/** Class-locked identity (Ultimate Battle System Part 8). */
export type ClassId = 'warrior' | 'ranger' | 'scholar' | 'guardian' | 'shadow' | 'balanced';

/** Battlefield row (Ultimate Battle System Part 7). */
export type Position = 'front' | 'middle' | 'back';

// ---- Items ------------------------------------------------------------------------

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  kind: 'consumable' | 'weapon' | 'armour' | 'accessory' | 'focus' | 'material';
  effect?: {
    healPercent?: number;
    cureStatus?: StatusId[];
    statBonus?: Partial<Record<'atk' | 'def' | 'matk' | 'mdef', number>>;
  };
  sellValue: number;
}

// ---- Nodes & Board ------------------------------------------------------------------

export type NodeType = 'event' | 'combat' | 'rest' | 'discovery' | 'trap' | 'landmark';

export interface BoardNode {
  index: number; // 1-100
  page: number; // 1-10
  type: NodeType;
  subtype: string; // event id, enemy set id, landmark id, etc.
  resolved: boolean;
}

// ---- Events -----------------------------------------------------------------------

export interface EventChoice {
  id: string;
  label: string;
  requirement?: (player: PlayerState) => boolean; // gates visibility/enabled state
  factionGate?: keyof FactionState; // locks choice if this faction is Hostile (≤ -25)
  check?: { stat: keyof StatBlock; dc: number }; // opposed check, success/fail branch
  onSuccess: (player: PlayerState, ctx: EventApplyCtx) => string;
  onFailure?: (player: PlayerState, ctx: EventApplyCtx) => string; // if omitted, check auto-succeeds
  combat?: { enemyIds: string[]; onVictory?: (player: PlayerState, ctx: EventApplyCtx) => string }; // triggers combat instead of/after text resolution
}

export interface EventApplyCtx {
  rng: () => number;
  setFlag: (flag: string) => void;
  hasFlag: (flag: string) => boolean;
  addLoreFragment: (id: string) => void;
  addEchoShards: (n: number) => void;
  addXp: (n: number) => void;
}

export interface EventDef {
  id: string;
  title: string;
  pageRange: [number, number];
  minResonance?: number;
  maxResonance?: number;
  repeatable?: boolean;
  /** if set, at least one of these player.flags keys must be true for the event to be eligible */
  requiresAnyFlag?: string[];
  flavorText: string;
  choices: EventChoice[];
}

// ---- Lore & Whispers ----------------------------------------------------------------

export interface LoreFragmentDef {
  id: string;
  title: string;
  text: string;
  /** loose category for Codex grouping/sorting: venn|faction|loom|personal|dominion */
  category: 'venn' | 'faction' | 'loom' | 'personal' | 'dominion';
}

export interface WhisperDef {
  id: string;
  text: string;
  tier: ResonanceTier;
  /** which moment can trigger it; used for cadence/variety, not a hard filter */
  context: 'movement' | 'combat' | 'menu';
}

// ---- Endings ------------------------------------------------------------------------

export interface EndingDef {
  id: string;
  name: string;
  tone: string;
  unlock: string;
  condition: (player: PlayerState) => boolean;
  secret?: boolean;
  epilogue: string;
}

export interface TrapDef {
  id: string;
  title: string;
  flavorText: string;
  avoidStat: keyof StatBlock;
  avoidDC: number;
  onTrigger: (player: PlayerState, ctx: EventApplyCtx) => string;
  onAvoid: (player: PlayerState, ctx: EventApplyCtx) => string;
}

// ---- Shard Shop ------------------------------------------------------------------------

export interface ShardShopEntry {
  id: string;
  name: string;
  cost: number;
  description: string;
  applied?: boolean;
}

// ---- Player & Game State ------------------------------------------------------------------

export interface Equipment {
  weapon: string;
  armour: string;
  accessory: string | null;
  focus: string;
}

export interface InventoryEntry {
  id: string;
  qty: number;
}

/** Phase 5: persistent companion record carried on a run (see systems/ally/AllyTracking). */
export interface CompanionState {
  id: 'warden_emissary' | 'covenant_courier' | 'sable_zealot' | 'archive_cartographer';
  /** 0..100 loyalty; gates tier abilities. */
  loyalty: number;
  /** Narrative hooks already spent (once-per-bond events). */
  spentHooks: string[];
  /** One-shot combat abilities consumed since last save (e.g. bitter_revival used). */
  combatCooldowns: string[];
  /** Regions the companion has bonded with; gains are faster there. */
  boundRegions: string[];
  /** Total fights fought alongside the player (feeds reward curves). */
  battlesTogether: number;
}

export interface PlayerState {
  stats: StatBlock;
  derived: DerivedStats;

  currentHP: number;
  currentMP: number;

  level: number;
  xp: number;
  skillPoints: number;
  skillTreePurchases: Record<string, number>;

  skillsKnown: string[]; // named reward/unlocked skills

  resonance: number; // 0-100
  resonancePeak: number;
  faction: FactionState;

  /** Class-locked identity: which preset the character descended as. */
  classId: ClassId;
  /** Combat fatigue gauge 0-100 (Ultimate Battle System Part 13). */
  fatigue: number;
  /** Tactical Insight resource, max 3 (Part 3). */
  insight: number;
  /** Hidden fear gauge 0-100 (Part 11). */
  fearGauge: number;
  /** Battlefield row (Part 7). */
  position: Position;

  equipment: Equipment;
  inventory: InventoryEntry[];
  /** Phase 5: companions traveling with the run (loyalty tiers in the ally systems). */
  companions: CompanionState[];

  flags: Record<string, boolean>;
  history: string[]; // ordered log of major choice ids, used by Final Reflection
  loreFragments: string[];
  enemiesKilled: number;
  bossesDefeated: string[];

  momentum: number; // persists between battles, 0-5

  echoShards: number;
  unlocks: string[]; // purchased shard-shop unlock ids
  gold: number; // in-run currency, spent at Caravan Merchant-type events

  totalRuns: number;
  bestRun: BestRunStats;
}

export interface GameState {
  currentNodeIndex: number; // 0 = not started, else 1-100
  currentPage: number;
  path: number[];
  rngSeed: number;
  runStartedAt: number;
  landings: number;
  combatRounds: number;
  choicesMade: number;
  checkpointPage: number; // last checkpoint reached (0/40/80/120/160)
  checkpointNodeIndex: number; // exact node index where checkpoint was taken
  checkpointSnapshot: PlayerState | null;
  deathNodeIndex: number | null;
  pendingNodeIndex: number | null; // after ambush combat, resume movement here
  nodes: BoardNode[];
  isRunActive: boolean;
  isDead: boolean;
  endingAchieved: string | null;
}

export interface BestRunStats {
  page: number;
  time: number;
  nodesVisited: number;
  enemiesKilled: number;
  bossesDefeated: number;
  levelReached: number;
  resonancePeak: number;
  choicesMade: number;
  loreFound: number;
}

export interface RunStats {
  nodesVisited: number;
  enemiesKilled: number;
  bossesDefeated: number;
  totalBosses: number;
  levelReached: number;
  resonancePeak: number;
  resonanceTier: string;
  choicesMade: number;
  loreFound: number;
  totalLore: number;
  runTimeSeconds: number;
  newLoreIds: string[];
  newLoreTitles: string[];
  echoShardsEarned: number;
  totalEchoShards: number;
  bestRun: BestRunStats;
  pageReached: number;
  endingUnlocked: string | null;
  isNewBest: boolean;
}

export interface MetaState {
  echoShards: number;
  purchasedUnlocks: string[];
  bestRun: BestRunStats;
  totalRuns: number;
  endingsAchieved: string[];
  loreFragmentsSeen: string[];
  bossesEverDefeated: string[];
  deathCount: number;
  lastRunStats: RunStats | null;
  /** Phase 6c: permanent enemy catalogue — fragments gained from scanning/defeating foes. */
  enemyArchive: EnemyArchive;
}

/** Phase 6c: one entry in the persistent enemy archive. */
export interface EnemyArchiveEntry {
  /** Catalogued fragment labels (max ARCHIVE_FRAGMENT_COUNT). */
  fragments: string[];
  /** Fully catalogued — unlocks the archive exploit (permanent damage bonus vs that foe). */
  exploited: boolean;
}

/** Phase 6c: persistent record of every enemy scanned/defeated across runs. */
export type EnemyArchive = Record<string, EnemyArchiveEntry>;

export interface SaveBlob {
  version: number;
  checksum: string;
  meta: MetaState;
  activeRun: { player: PlayerState; game: GameState } | null;
}
