// ============================================================================
// THE HOLLOW BENEATH — Core Types
// Source of truth for every system. Revamped combat model:
// no AP/fatigue, discrete affinity discovery (wk/str/null/rep/drn/-),
// movepool-driven enemies, 6-slot skill loadout.
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

export const DAMAGE_TYPES: DamageType[] = [
  'slash', 'pierce', 'blunt', 'flame', 'frost', 'shock', 'sacred', 'shadow',
];

/** Short labels used by the Scan UI affinity grid (sl pi bl fl fr sh sc sh). */
export const DAMAGE_TYPE_ABBREV: Record<DamageType, string> = {
  slash: 'sl', pierce: 'pi', blunt: 'bl', flame: 'fl',
  frost: 'fr', shock: 'sh', sacred: 'sc', shadow: 'sh',
};

/**
 * Discovered affinity categories (Combat System Revamp §2).
 *  wk = weakness (+50% dmg, Downed + 1-More) | str = resist (×0.5)
 *  null = nullify (0 dmg)   | rep = reflect (bounces to attacker)
 *  drn = drain (heals target) | '-' = neutral (×1)
 */
export type AffinityKind = 'wk' | 'str' | 'null' | 'rep' | 'drn' | '-';

export type EnemyAffinities = Partial<Record<DamageType, AffinityKind>>;

/** All eight slots unknown — the pre-discovery state for any enemy. */
export function unknownAffinities(): EnemyAffinities {
  return {};
}

// ---- Status Effects ----------------------------------------------------------

export type DotId = 'poison' | 'burn' | 'bleed' | 'curse' | 'frostbite' | 'shock_dot';
export type ControlId =
  | 'sleep' | 'fear' | 'silence' | 'blind' | 'confuse' | 'stun' | 'root'
  // Revamp additions:
  | 'downed'      // enemy skips its next turn standing up (weakness/crit landed)
  | 'staggered'   // player loses their next action (enemy crit, unless Guarding)
  | 'chilled';    // Frost marker → Shock triggers Superconduct (stun)
export type BuffId =
  | 'focus' | 'barrier' | 'regeneration' | 'fortify' | 'blessing' | 'haste'
  | 'reflection' | 'brace' | 'atk_up' | 'defense_up' | 'echo_surge';
export type DebuffId =
  | 'weakness' | 'defense_down' | 'slow' | 'armour_break' | 'seal_mind'
  | 'fragile_perception' | 'exhausted'
  // Revamp additions:
  | 'slowed'       // Petrifying Gaze — QTE needle moves at double speed
  | 'sacred_mark'  // Sacred marker → Shadow triggers Eclipse (strip buffs + ×2)
  | 'heal_block';  // Interdict — healing blocked for N turns
export type StatusId = DotId | ControlId | BuffId | DebuffId;

export interface StatusInstance {
  id: StatusId;
  stacks: number; // DoTs stack to 3; everything else is non-stacking (stacks stays 1)
  turnsRemaining: number;
  meta?: Record<string, number>; // e.g. barrier absorb amount
}

// ---- Combat Actions ------------------------------------------------------------

/** The six battle-screen actions (Battle UI mockup). */
export type ActionId =
  | 'attack'
  | 'skill'
  | 'guard'
  | 'item'
  | 'scan'
  | 'end_turn';

export const ACTION_LABELS: Record<ActionId, string> = {
  attack: 'ATTACK',
  skill: 'SKILL',
  guard: 'GUARD',
  item: 'ITEM',
  scan: 'SCAN',
  end_turn: 'END TURN',
};

/** QTE timing results for offensive actions (Petrified state doubles needle speed). */
export type QteQuality = 'perfect' | 'good' | 'miss';

/** Structured effect resolved generically by CombatEngine. */
export type SkillEffect =
  | { kind: 'damage'; type: DamageType; power: number; target: 'single' | 'all'; stat: 'atk' | 'magic'; guaranteed?: boolean }
  | { kind: 'status'; id: StatusId; turns: number; stacks?: number; target: 'single' | 'all' }
  | { kind: 'buff'; id: StatusId; turns: number }
  | { kind: 'heal'; pct?: number; flat?: number }
  | { kind: 'barrier'; pct: number; turns: number }
  | { kind: 'cost'; hpFlat?: number; hpPct?: number }
  | { kind: 'resource'; momentum?: number; mp?: number }
  | { kind: 'reveal_all_affinities' };

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  /** MP cost (default 0). */
  mpCost?: number;
  /** Flat/pct HP cost — physical techniques burn vitality instead of MP. */
  hpCost?: { flat?: number; pct?: number };
  damageType?: DamageType;
  /** Damage multiplier vs the relevant attack stat. */
  skillPower?: number;
  stat?: 'atk' | 'magic';
  target?: 'single' | 'all';
  guaranteed?: boolean;
  /** Extra crit chance (0-1) applied on top of the base crit rate. */
  critChanceBonus?: number;
  effects?: SkillEffect[];
  /** Passive hooks checked by id in engine/store (e.g. death ward, XP bonus). */
  passive?: string;
  /** Which chapter loadout grants this skill (display grouping only). */
  chapter?: number;
  /** @deprecated AP system removed — retained only for old-UI compat (always 1-2). */
  apCost?: number;
}

// ---- Combatants ----------------------------------------------------------------

export interface CombatantBase {
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  spd: number;
  accuracy: number;
  dodge: number;
  statuses: StatusInstance[];
}

export interface EnemyMoveDef {
  id: string;
  label: string;
  description?: string;
  /** Pick weight among eligible moves (default 1). */
  weight?: number;
  condition?: (ctx: EnemyTurnContext) => boolean;
  /** Declared ("charging …") one turn ahead, unleashed automatically next turn. */
  charge?: boolean;
  /** Heavy/AOE move — at most one enemy per round may use one in group fights. */
  heavy?: boolean;
  resolve: (ctx: EnemyTurnContext) => string;
}

export interface EnemyDef {
  id: string;
  name: string;
  level: number;
  hp: number;
  mp?: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  spd: number;
  dodge?: number; // default 10
  accuracy?: number; // default 80
  attackType: DamageType;
  affinities: EnemyAffinities;
  xp: number;
  minResonance?: number;
  description: string;
  /** Named move pool. The engine picks one eligible move when this enemy acts. */
  moves: EnemyMoveDef[];
}

export interface EnemyTurnContext {
  self: CombatState_Enemy;
  player: CombatState_Player;
  allies: CombatState_Enemy[];
  turn: number;
  phaseKey?: string; // boss phase key ('' for regular enemies)
  rng: () => number;
  log: string[];
  applyDamageToPlayer: (
    amount: number,
    type: DamageType,
    sourceLabel: string,
    opts?: { bypassGuard?: boolean; guaranteed?: boolean; critChance?: number; accMult?: number },
  ) => number;
  applyStatusToPlayer: (id: StatusId, turns: number, stacks?: number, meta?: Record<string, number>) => void;
  applyStatusToSelf: (id: StatusId, turns: number, stacks?: number, meta?: Record<string, number>) => void;
  healSelf: (amount: number) => void;
  damageSelf: (amount: number) => void;
  buffSelf: (statKey: 'atk' | 'def' | 'matk' | 'mdef' | 'spd', percent: number) => void;
  spawnAlly: (enemyId: string, hpOverride?: number) => void;
  removePlayerBuffs: () => void;
  drainPlayerMp: (amount: number) => number;
  /** Blank Slate-type effects: strip the player's Momentum gauge by n points. */
  reducePlayerMomentum: (n: number) => void;
  setBarrier: (amount: number) => void;
  /** Skills the player currently has equipped (Reflection's Mirror Cast). */
  playerEquippedSkills: string[];
  /** The player's stat block (Reflection mirrors your dominant trait). */
  playerStats: StatBlock;
  /** The player's boolean flags (for boss logic like Reflection). */
  playerFlags: Record<string, boolean>;
}

export interface CombatState_Enemy extends CombatantBase {
  defId: string;
  level: number;
  attackType: DamageType;
  affinities: EnemyAffinities;
  xp: number;
  flags: Record<string, number>;
  isBoss?: boolean;
}

export interface CombatState_Player extends CombatantBase {
  guarding: boolean;
}

// ---- Factions & Resonance --------------------------------------------------------

export interface FactionState {
  sable: number;
  archive: number;
  covenant: number;
  caravan: number;
}

export type ResonanceTier = 'stable' | 'awakened' | 'unmoored' | 'transcendent';

// ---- Bosses ----------------------------------------------------------------------

export interface BossPhaseInfo {
  key: string;
  label: string;
  hpFloorPercent: number; // phase active while hp% > this floor
  affinities: EnemyAffinities; // undefined = keep previous phase's affinities
}

export interface BossDef {
  id: string;
  name: string;
  vennName: string;
  chapter: number;
  level: number;
  theme: string;
  baseStats: { hp: number; mp?: number; atk: number; matk: number; def: number; mdef: number; spd: number };
  approachText: string;
  preCombatChoices?: BossPreCombatChoice[];
  phases: BossPhaseInfo[];
  /** Named move pool — same machinery as regular enemies, richer ctx. */
  moves: EnemyMoveDef[];
  aftermathText(flags: Record<string, number>): string;
  getRewards(flags: Record<string, number>): BossRewards;
}

export interface BossPreCombatChoice {
  id: string;
  label: string;
  requirement?: (player: PlayerState) => boolean;
  apply: (player: PlayerState, combatFlags: Record<string, number>, rng: () => number) => string;
  skipsCombat?: boolean;
}

export interface BossRewards {
  factionDelta?: Partial<FactionState>;
  resonanceDelta?: number;
  maxHpPercentDelta?: number;
  echoShards: number;
  skillUnlock?: string;
  loreFragment?: string;
  itemReward?: string;
  flag: string;
}

// ---- Items ------------------------------------------------------------------------

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  kind: 'consumable' | 'weapon' | 'armour' | 'accessory' | 'focus' | 'material';
  effect?: {
    healPercent?: number;
    healMpPercent?: number;
    cureStatus?: StatusId[];
    cureAll?: boolean;
    statBonus?: Partial<Record<'atk' | 'def' | 'matk' | 'mdef', number>>;
  };
  sellValue: number;
}

// ---- Nodes & Board ------------------------------------------------------------------

export type NodeType = 'event' | 'combat' | 'rest' | 'discovery' | 'trap' | 'landmark';

export interface BoardNode {
  index: number; // 1-200
  chapter: number; // 1-5
  type: NodeType;
  subtype: string;
  resolved: boolean;
}

// ---- Events -----------------------------------------------------------------------

export interface EventChoice {
  id: string;
  label: string;
  requirement?: (player: PlayerState) => boolean;
  factionGate?: keyof FactionState;
  check?: { stat: keyof StatBlock; dc: number };
  onSuccess: (player: PlayerState, ctx: EventApplyCtx) => string;
  onFailure?: (player: PlayerState, ctx: EventApplyCtx) => string;
  combat?: { enemyIds: string[]; onVictory?: (player: PlayerState, ctx: EventApplyCtx) => string };
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
  chapterRange: [number, number]; // 1-5
  minResonance?: number;
  maxResonance?: number;
  repeatable?: boolean;
  requiresAnyFlag?: string[];
  flavorText: string;
  choices: EventChoice[];
}

// ---- Lore & Whispers ----------------------------------------------------------------

export interface LoreFragmentDef {
  id: string;
  title: string;
  text: string;
  category: 'venn' | 'faction' | 'loom' | 'personal' | 'dominion';
}

export interface WhisperDef {
  id: string;
  text: string;
  tier: ResonanceTier;
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

/** Non-combat companion record (board flavor: recruitment, loyalty, shard rewards). */
export interface CompanionState {
  id: 'warden_emissary' | 'covenant_courier' | 'sable_zealot' | 'archive_cartographer';
  loyalty: number;
  spentHooks: string[];
  boundRegions: string[];
  battlesTogether: number;
}

export interface PlayerState {
  stats: StatBlock;
  derived: DerivedStats;

  currentHP: number;
  currentMP: number;

  level: number;
  xp: number;

  /** Everything learned (chapters, discoveries, bosses). */
  skillsKnown: string[];
  /** Active loadout — max MAX_EQUIPPED_SKILLS ids drawn from skillsKnown. */
  equippedSkills: string[];

  resonance: number; // 0-100
  resonancePeak: number;
  faction: FactionState;

  equipment: Equipment;
  inventory: InventoryEntry[];
  /** Non-combat companions (recruitment flavor + rewards only). */
  companions: CompanionState[];

  flags: Record<string, boolean>;
  history: string[];
  loreFragments: string[];
  enemiesKilled: number;
  bossesDefeated: string[];

  momentum: number; // persists between battles, 0-5

  echoShards: number;
  unlocks: string[];
  gold: number;

  totalRuns: number;
  bestRun: BestRunStats;

  // ---- Deprecated (revamp compat; old saves/scenes may still read these) ----
  fatigue?: number;
  insight?: number;
  fearGauge?: number;
  position?: string;
  classId?: string;
  skillPoints?: number;
  skillTreePurchases?: Record<string, number>;
}

export const MAX_EQUIPPED_SKILLS = 6;

export interface GameState {
  currentNodeIndex: number;
  path: number[];
  rngSeed: number;
  runStartedAt: number;
  landings: number;
  combatRounds: number;
  choicesMade: number;
  checkpointNodeIndex: number;
  checkpointSnapshot: PlayerState | null;
  deathNodeIndex: number | null;
  pendingNodeIndex: number | null;
  nodes: BoardNode[];
  isRunActive: boolean;
  isDead: boolean;
  endingAchieved: string | null;
}

export interface BestRunStats {
  chapter: number;
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
  chapterReached: number;
  endingUnlocked: string | null;
  isNewBest: boolean;
}

/** Persistent Scan discoveries for one enemy id (Bestiary). */
export interface BestiaryEntry {
  affinities: EnemyAffinities;
  kills: number;
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
  /** Discovered affinity slots persist per enemy id across runs (Scan/Bestiary). */
  discoveredAffinities: Record<string, EnemyAffinities>;
  /** Lifetime defeats per enemy id (Bestiary flavor). */
  bestiaryKills: Record<string, number>;
  /** @deprecated archive system removed. */
  enemyArchive?: unknown;
}

export interface SaveBlob {
  version: number;
  checksum: string;
  meta: MetaState;
  activeRun: { player: PlayerState; game: GameState } | null;
}
