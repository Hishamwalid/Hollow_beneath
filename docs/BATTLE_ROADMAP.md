# BATTLE ROADMAP — The Ultimate Battle System

Source of truth: `H:\Study mat\3.1\lab\sw\ULTIMATE BATTLE SYSTEM.md` ("THE ECHO COMBAT ARCHITECTURE").

This is the step-by-step execution plan for implementing the full system into this codebase
(Phaser 3.70 + TypeScript + Vite + Zustand). Work is done phase-by-phase; the game must be
**playable after every phase**. Each phase ends with a verification gate.

---

## Locked Decisions

| Decision | Choice | Consequence |
|---|---|---|
| Damage types | **Keep the existing 8** (slash, pierce, blunt, flame, frost, shock, sacred, shadow) | Skip 2 elemental reactions that need Natures/Spirits/Chaos ("Decaying Haunt", "Reality Fracture"). All 8 combo tags remain implementable. |
| Class identity | **Full class-locked** — each class gets Passive + Signature + tier-2..5 progression skills; skills are exclusive to the class | `PlayerState.classId` added; skill trees become per-class; ~42 new skills; existing universal skills stay as generic rewards where sensible |
| Save compat | Bump `SaveManager` `VERSION` 2 → 3 with a migration step | Old saves load with defaults for new fields (`classId` inferred from closest preset) |
| Analyze | Remove the free `toggleAnalyze` — replaced by paid 4-layer Investigation (Phase 2) | `cross_reference` skill changes meaning |
| Turn flow | Enemies **pre-declare intents** at round start; resolved after player phase (speed order kept for resolution order) | The core "knowledge as power" loop |

## Ground Rules

- Every phase: `npm run typecheck` then `npm run build` must pass.
- Manual smoke test: dev server on `http://localhost:3000`, start a run, fight a wild encounter.
- New systems live in `src/systems/combat/` (keep `src/systems/` flat files untouched where possible).
- Persisted state changes only through `SaveManager` migration; combat-local state stays in `CombatEngine`.
- Update the checklist below as phases complete.

## Execution Log

| Phase | Status | Notes |
|---|---|---|
| 0 Foundations | ✅ | types.ts fields, SaveManager v3 migration, classId from preset, smoketest fields |
| 1 Action Economy | ✅ | TokenSystem.inline, FatigueSystem, momentum rebuild, ACTION_AP_COST, analyze paid |
| 2 Investigation & Intent | ✅ | IntentSystem, Scan/Probe/Deep, insight spend, 17 enemies + 5 bosses given intents; legacy `act`/`takeTurn` kept as fallbacks |
| 3 Weakness Depth | ✅ | WeaknessWindowSystem (3-hit streak→2-turn window, 1.5x dmg/+25% crit/+2 momentum), ElementalReactionSystem (8 ordered pairs), ComboSystem (8 tag sequences, +2 tokens), Snapshot bansHUD HUD badge + tint, CMG color-coded dmg by type + banners, smoketest 16 |
| 4 Classes & Crisis | ✅ | classes.ts (6×6 skills), class-locked trees, SkillEffect resolver, 5 crises × 15 options all live, fear/bravery wired, desperation applies real effects, boss-ultimate fear, smoketest §13 |
| 5 Boss Intelligence | ✅ | ProfileSystem/StressSystem/AdaptationSystem/TellSystem wired in CombatEngine; adaptations every 3rd boss turn; stress bands + flavor; band-based intent weights; charged-ultimate tells; 5e: all 5 personalities with **intentBias** weight multipliers (Chorus gained its missing Echo persona) |
| 6 States, Position, Meta | ✅ | 6a battlefield states: enemy intent (Ash Seer Shadow Veil), Scholar Sacred Ground (Unwritten Page rider), item effect kind + inverters in both damage paths, HUD banner under title; 6b positioning (row pips + 4 reposition actions); 6c archive (Codex Enemy Archive tab, Archive: Expose Weakness exploit + snapshot flag); 6d difficulty (4 modes selectable in Settings + effective in engine) |
| 7 Polish & Balance | ✅ | Audio cues (weakness crunch, adaptation warning, combo ding, AP ding, fatigue gasp, resonance chime) wired in CombatScene; intent confidence % on cards; combat-log damage breakdown + enemy "thoughts" + color coding; crisis flash/shake; resonance tier glow; tutorial teaches tokens/investigation/intents/classes; balance pass deferred to playtest notes |

---

# Phase 0 — Data Model & Foundations

**Goal:** Extend the type system and persistence so all later phases can hook in without further migration.

### Tasks

1. **`src/data/types.ts`**
   - `StatusId` additions: `exhausted` (next turn −1 AP), `terrified` (accuracy −20%, damage −10%), `class_buff_*` (rage, precision, knowledge, resolve, risk, adaptation as combat-local counters — these live in engine, not statuses), plus reaction-created statuses: `conflagrate`/`plasma` handled via effects not statuses. Keep DoT/control/buff/debuff unions intact.
   - `PlayerState` new persisted fields: `classId: ClassId`, `fatigue: number` (0–100), `insight: number` (0–3, combat-local but persisted so it survives checkpoint restore), `fearGauge: number` (0–100), `position: 'front' | 'middle' | 'back'`.
   - `ClassId = 'warrior' | 'ranger' | 'scholar' | 'guardian' | 'shadow' | 'balanced'`.
   - `EnemyDef` gains: `tendency?: EnemyTendency` and `intents?: IntentDef[]`.
   - New interfaces: `IntentDef { id, label, weight, condition?: (ctx) => boolean, resolve: (ctx) => string }`, `EnemyTendency` (10 ids from doc Part 5), `CrisisDef`, `BattlefieldStateDef`, `Position`.
   - `SkillDef`: add `tags?: ActionTag[]` (Phase 3) and `effects?: SkillEffect[]` (Phase 4). Keep `tag` until Phase 4 migrates it.
2. **`src/systems/SaveManager.ts`** — `VERSION = 3`; `migrateSave(raw)` that injects defaults: `classId` from `closestPresetName(player.stats)`, `fatigue: 0`, `insight: 0`, `fearGauge: 0`, `position: 'middle'`.
3. **`src/data/classes.ts` (new)** — skeleton with 6 `ClassDef { id, name, color, passive desc, signatureSkillId, progression: string[] }` (details filled in Phase 4).
4. **`src/systems/combat/` scaffold (new dir)** — empty module stubs only for the systems listed in Phase headers, exported from `src/systems/combat/index.ts`.
5. **`src/scenes/CharacterCreationScene.ts`** — set `player.classId` at run start from the chosen preset (preset ↔ class mapping).

### Done criteria
- Fresh run: `initFromDisk` loads an old save without errors (migration path).
- Character creation persists `classId`.
- typecheck + build pass.

---

# Phase 1 — Dynamic Action Economy

**Goal:** Tokens that flow with the fight; fatigue pressure; richer momentum; costs per doc.

### 1a. Token System (`src/systems/combat/TokenSystem.ts`)

Modifiers applied as events stream from engine actions:

| Event | Change |
|---|---|
| Hit weakness | +1 token (additive on top of existing +2 momentum? No — token only, momentum handled in 1c) |
| Critical hit | +1 |
| Enemy guarded (player hit a guarding enemy) | −1 |
| Player attack misses | lose all remaining tokens |
| Damage blocked (barrier fully absorbed) | lose half remaining (rounded down) |
| Boss predicted action correctly | −1 |
| Successful Analyze | refund 1 token (Phase 2; stub now) |
| Player dodges enemy attack | +1 |
| Kill enemy | +1 |
| Same action 3+ times in combat | −1 (once per round) |
| Execute a combo | +2 (Phase 3; stub now) |

- Engine exposes `playerAP` as tokens; modifiers clamp `0..5`.
- `actionsTakenThisRound` reuse for repeat tracking: add `actionRepeatCount` per action id; penalty applied when any single action id hits 3 in one combat, once.
- Log lines: `Momentum of the fight: +1 token (weakness hit).` etc.
- Miss penalty: track in `computeAndApplyDamage` when `hit === false`.

### 1b. Fatigue System (`src/systems/combat/FatigueSystem.ts`)

- Player gauge 0–100. Gains: high-cost skills +5 per 10 MP spent; taking damage +2 per 10 HP lost; same action repeat +10; dodge/guard +5.
- Bands: 26–50% (−10% acc, −10% dmg), 51–75% (−20% acc, −20% dmg, −1 AP at round start), 76–100% (−40% acc, −40% dmg, −2 AP, 30% skip turn roll at round start).
- Reductions: end turn without acting −15%, use item −20%, guard −10%, heal −10% per 10% HP healed.
- Wire into `computeAndApplyDamage` (accuracy/damage), `beginRound` (AP deduction, skip roll), `dealDamageToPlayer` (dodge+5).
- **UI:** fatigue bar under the HP bar in `src/ui/StatPanel.ts` (grey→red fill, 8px tall) + snapshot field `fatigue`.

### 1c. Momentum Rebuild (`CombatEngine.resolveMomentum`, `CombatScene`)

- Keep cap 5. Add gain sources: Analyze +1 (Phase 2), successful Guard +1, Dodge +1, first Skill per combat +1 (exists), weakness +2 (exists), crit +1 (exists), kill +1 (exists).
- Replace choices to match doc (labels + effects):
  - `extra_turn` → **Flow**: act again now, but gain `exhausted` status (next round −1 AP).
  - `chorus_heal` → **Harmony**: heal 25% max HP; boss enrage +30% damage 2 turns (no-op vs wild).
  - `clarity` → **Archive**: reveal current boss phase + next intent at 100% (Phase 2 stub: reveal phase label).
  - Keep `forgotten_technique` (free action), `unravel`, `echo_surge` (existing), `phase_shift`, `desperate_strike`; add **Overclock**: +70% damage this turn, lose 20% max HP (permanent this combat, floor 1).
- Update `MOMENTUM_LABELS` + modal in `CombatScene.ts`, `MomentumChoice` type, engine handlers.

### 1d. Action Cost Rebalance (`src/data/skills.ts` `ACTION_AP_COST`)

`attack 1, skill 2, resonance_ability 3, guard 1, use_item 1, analyze 1, sunder 2, withdraw 2, focus 1, brace 1`.
Note: `active_*` skills in `NAMED_SKILLS` currently `apCost: 2` — stays consistent; `useSkill` uses `skill.apCost` so skills are already 2. Verify no soft-coded 1.

### 1e. Analyze De-free-ification (`CombatEngine`)

- Delete `toggleAnalyze` (free ON/OFF). Remove the `analyzeOn` button logic in `CombatScene.buildActionBar` ("Analyze" button becomes the paid Scan of Phase 2; for now it costs 1 AP, reveals target fully — current behavior, but paid, single-target).
- `cross_reference` skill: change from "analyze free" → "Analyze costs 1 less AP" (0 AP) — keep the check.

### Files
`CombatEngine.ts`, `CombatScene.ts`, `CombatHUD.ts`, `StatPanel.ts`, `skills.ts`, `types.ts`, `snapshot()` (`fatigue`, `comboCount`).

### Done criteria
- Log shows token gains/penalties during a fight; miss wipes tokens.
- Fatigue bar visible and moving; high fatigue visibly nerfs accuracy/damage/AP.
- Momentum modal shows 10 options with doc names/effects; `exhausted` status applied after Flow.
- Skill buttons show 2 AP.

---

# Phase 2 — Investigation & Intent

**Goal:** Knowledge loop: declare → reveal → predict → exploit.

### 2a. Investigation System (`src/systems/combat/InvestigationSystem.ts`)

Per-enemy state `investigation: { layer: 0|1|2|3|4, probes: ProbeId[], insight: n }`.

- **Layer 0 (auto):** name, HP bar, current statuses, vague resist text ("Resistant/Susceptible/Neutral" — computed from affinity with `weaknessLabel`), tendency icon.
- **Layer 1 — Scan (1 AP):** exact HP, all 8 multipliers as %, status durations, tendency detail, next intent at 70–80% confidence (text), special mechanics note (from `enemy.description`).
- **Layer 2 — Probe (1 AP, needs Scan):** choose ONE of: Observe Body (DEF/MDEF + phys resists), Observe Mind (intent triggers), Observe Weapon (attack type info), Observe Memory (lore/weakness hint), Observe Resonance (phase timing for bosses), Observe Behavior (full action pool). Menu via `ChoiceMenu`.
- **Layer 3 — Deep Analysis (2 AP, needs 1 probe):** full move pool with damages, complete IF/THEN rules, hidden passives, exact stats, weakness-window trigger, lore text.
- **Layer 4 — Archive Exploit (needs full archive entry, Phase 6):** Expose Weakness (+20% dmg 2 turns), Predict Action (+1 token if right), Disrupt Pattern (delay scripted phase), Archive Note, Counter Stance.
- **Insight:** +1 per Analyze action (cap 3). Spend 3 via modal: Reveal FULL AI, Perfect Prediction (100%), +15% dmg vs analyzed enemies (combat buff), Immediate Weakness Window (Phase 3).
- **INT scaling:** int ≥7 → Scan fills Layer 1 in 1 use (already 1) — reinterpret as: int 7–9 → +1 random info on probe, int 10+ → +2 + hidden info. Implement as probe bonus text lines.

Enemy card (`CombatHUD.ts`) gains: tendency icon (tiny glyph), intent line (replaces/augments reveal text), reveal-layer-driven stat text.

### 2b. Intent System (`src/systems/combat/IntentSystem.ts`)

- At `beginRound`: for each alive enemy, pick intent from `def.intents` (weighted, condition filters). Store `pendingIntents: Map<key, IntentDef>`.
- During enemy resolution (`resolveEnemyTurn`), execute the **declared** intent instead of calling `def.act` freely. Legacy `def.act` bodies get wrapped as the intent's `resolve` (mechanical extraction: each `act` body becomes a weighted intent; conditional one-shots become `condition`).
- Confidence text by layer: L0 "intentions unreadable" → L1 vague ("preparing something aggressive") → L2 "70% chance to cast X" → L3 "92% chance" → L4/Insight "100%".
- Wildcard: if no intent matches conditions, fall back to basic attack.
- **Player predictive rewards (Phase 1 token table):** if player lands an attack on the enemy that was "predicted" while guarded/intel high — keep simple: predicted correctly +1 token happens when player's selected target matches the intent the card displayed (checked at resolution).

### 2c. Enemy Data Pass (`src/data/enemies.ts`, `src/data/bosses.ts`)

- All 17 enemies + 5 bosses: add `tendency` from the 10 doc tendencies + 2–4 `intents` each (extracted from existing `act` bodies).
- Bosses: `takeTurn` becomes intent-based too — each boss's turn branches become intents with conditions (phase-keyed). Stress/tells land in Phase 5.

### Files
`InvestigationSystem.ts`, `IntentSystem.ts`, `enemies.ts`, `bosses.ts`, `CombatHUD.ts`, `CombatScene.ts`, `CombatEngine.ts`, `ChoiceMenu` reuse.

### Done criteria
- Scan button costs 1 AP and reveals layer 1; Probe menu works; Deep Analysis costs 2 AP.
- Enemy cards show intent text whose confidence rises with layer.
- Insight counter on HUD; spending 3 opens the 4-option modal.
- Wild fights behave identically in outcome distribution to pre-change (AI equivalence check by playing a few fights).

---

# Phase 3 — Weakness Depth

**Goal:** Windows, reactions, combos.

### 3a. Weakness Windows (`src/systems/combat/WeaknessWindowSystem.ts`)
- Per enemy: `weakHitStreak`. 3 consecutive weakness hits → window 2 turns: +50% damage, crit +25%, momentum gain ×2. Closes if a player attack misses or enemy resists (streak reset). Visual: `setTint(0xc9a24b)` pulse + crack particles (`spawnHitParticles` variant, gold).

### 3b. Elemental Reactions (`src/systems/combat/ElementalReactionSystem.ts`)
- Track `lastPlayerHitType` per enemy (skips absorbed/resisted). On the *next* different-type hit, check the 10-sequence table; only 8 are implementable with our types:
  - Flame→Frost Thermal Shock (+50% dmg, stun 1), Frost→Shock Conductive Freeze (spd −40% 2 turns), Shock→Flame Plasma Burst (30% dmg to all enemies), Sacred→Shadow Void Collapse (strip buffs, −20% stats 2 turns), Shadow→Sacred Crimson Eclipse (3.0x), Pierce→Slash Rending Wounds (bleed 10, 3 turns), Slash→Blunt Shattered Guard (def −50% 3 turns), Blunt→Pierce Crushing Point (ignore 50% armor).
- Sequence pairing via damage-type order: track consecutive *different* types (same type re-hit doesn't consume pair).
- Log + floating banner text per reaction.

### 3c. Combo Tag System (`src/systems/combat/ComboSystem.ts`)
- Action tags (extend `SkillDef.tags`): Attack=Strike+Physical; Sunder=Break+Physical; Analyze=Knowledge+Mental; Guard=Defense+Stance; skills carry their damage-type tag (Elemental for magic types, Physical for slash/pierce/blunt) + optional special (Hunter's Mark=Mark; retaliate reflect=Counter).
- Track last 3 tags (`tagHistory: ActionTag[]`). On a new tag pushed, test the 8 sequences:
  - Strike→Break→Sacred Expose Truth (resistances →1.0 for 2 turns)
  - Analyze→Shock→Shadow Memory Collapse (momentum ×2, 3 turns)
  - Strike→Pierce→Slash Rending Wounds (bleed 15, 4 turns)
  - Mark→Pierce→Strike Hunter's Kill (3.0x vs marked)
  - Break→Physical→Elemental Shattered Reality (strip enemy buffs)
  - Sacred→Shadow→Sacred Eclipse (2.5x, ignore 50% def)
  - Guard→Counter→Strike Perfect Riposte (free +50% attack immediately)
  - Analyze→Analyze→Break Full Knowledge (reveal all + open window)
- `+2` tokens on combo execution (Phase 1 stub hook). Combo banner via `floatingText` center screen.

### 3d. Visuals (`CombatScene.ts`, `CombatHUD.ts`)
- Damage numbers colored by `DAMAGE_TYPES[*].colorCss`.
- Weakness hit flash (white tint flicker), window crack effect.

### Files
`WeaknessWindowSystem.ts`, `ElementalReactionSystem.ts`, `ComboSystem.ts`, `CombatEngine.ts`, `CombatScene.ts`, `damageTypes.ts` (no change), `skills.ts` (tags).

### Done criteria
- 3 weakness hits trigger a window with visible gold glow.
- Reactions fire with banner + log.
- Combos trigger from tag sequences and grant +2 tokens.

---

# Phase 4 — Classes & Crisis

**Goal:** Class-locked playstyles + dramatic moments.

### 4a. SkillDef Refactor (`src/data/types.ts`, `src/data/skills.ts`, `CombatEngine.useSkill`)
- Replace the `tag`-switch pattern with structured `effects?: SkillEffect[]`:
  `{ kind: 'damage', type, power, target: 'single'|'all', armorPierce?, guaranteed? } | { kind: 'status', id, turns, target } | { kind: 'buff', ... } | { kind: 'heal', pct | flat, target } | { kind: 'barrier', pct } | { kind: 'resource', mp | hp | resonance | momentum } | { kind: 'condition', require }`.
- Generic resolver in engine; migrate the 6 existing active skills to this format. Remove `tag` field at end of migration.

### 4b. Class Data (`src/data/classes.ts`)
Full doc Part 8 — each class: passive + signature (1 AP) + 4 progression skills (tiers 2–5). 42 skills total:

| Class | Passive | Signature |
|---|---|---|
| Warrior | Rage (+5% dmg/stack per 10% HP lost, max 5) | Last Stand (1 AP 15 MP: −30% HP, 3 turns +50% dmg +30% guard, taunt) |
| Ranger | Precision (+15% crit per dodge, max 3; crits restore 1 AP) | Shadow Step (1 AP 10 MP: next attack +50% dmg, cannot miss) |
| Scholar | Knowledge (+5% dmg per Analyze, max 3; +1 Insight) | Arcane Thesis (1 AP 5 MP: pick type, 3 turns spells that type, pierce 30% resist) |
| Guardian | Resolve (1 stack per guard turn; 3 = nullify one attack) | Aegis Protocol (1 AP: 2 turns all damage → you, +40% guard) |
| Shadow | Risk (+10% dmg <50% HP, +25% dmg +15% dodge <25%) | Veil of Silence (1 AP 12 MP: stealth, next attack +75%, untargetable) |
| Balanced | Adaptation (+10% dmg per unique action, max 5) | Mirror Adapt (1 AP: +15% all stats 3 turns + choose one stat +30%) |

- Progression skills per doc tables (Cleaving Swing, Pinpoint Shot, Force Cascade, Sacred Covenant, Soul Rend, Flicker Strike, etc.). Trim-to-feasible: implement all 4 per class (24 total) + 6 signatures + 6 passives. Implement via the new `effects` format + engine hooks where needed (taunt, stealth/untargetable, interrupt).
- Engine hooks needed: `tauntedEnemies`, `stealth` (untargetable until attack), class passive calculators (damage/dodge/AP refund hooks), `comboStacks` for Balanced.

### 4c. Class Locking
- `PlayerState.classId` gates `skillsKnown`: class skills only obtainable via the class's tree; `SkillTreeScene` renders only the player's class tree (6 trees × 5 nodes: passive tier 0 + tiers 1–4), reusing node purchase flow (`purchaseSkillTreeTier`).
- `PRESET_STARTING_SKILL` replaced by per-class signature/starting node grants; `CharacterCreationScene` writes `classId` (Phase 0 hook).
- `DISCOVERABLE_SKILLS`: keep universal skills discoverable.

### 4d. Crisis System (`src/systems/combat/CrisisSystem.ts` + `CrisisModal` UI)
- 5 crises with triggers & modal (pause combat, `ChoiceMenu`):
  - Desperate Gambit (HP < 25%), Boss's Wrath (boss < 50%), Revelation (first weakness seen), Critical Moment (3+ momentum), Fate's Edge (round ≥ 5).
- Effects per doc options; "All-In" needs the 30%-death roll (defeat on fail).
- Screen flash + drum audio cue (`PlaceholderAudio`).

### 4e. Fear/Bravery (`src/systems/combat/FearSystem.ts`)
- Hidden `fearGauge` 0–100 (massive hit >30% maxHP, boss ultimate, ally death — single player: treat "ally" as self-heavy hits).
- >50 → `terrified` debuff (−20% acc, −10% dmg). Bravery actions in Skill menu: Face Fear (1 AP), Defiant Roar (1 AP), Reckless Charge (2 AP, +40% fear).

### 4f. Desperation (`src/systems/combat/DesperationSystem.ts`)
- Below 35% HP, each enemy turn a roll (low chance) triggers one of the 5 doc events (Broken Resolve, Forget Pain, Shatter Resonance, Burn the Archive, One Last Memory) — combat-local buffs/debuffs with banner.

### Files
`classes.ts`, `skills.ts` (refactor), `types.ts`, `CombatEngine.ts` (effects resolver + hooks), `SkillTreeScene.ts`, `CharacterCreationScene.ts`, `CombatScene.ts`, `CombatHUD.ts`, `CrisisSystem.ts`, `FearSystem.ts`, `DesperationSystem.ts`, `PlaceholderAudio.ts`.

### Done criteria
- ✅ Choosing Warrior/Ranger/etc. changes combat feel (passive + signature active).
- ✅ Skill trees show only your class; class skills locked out otherwise.
- ✅ Crisis modal fires with correct triggers (Desperate Gambit <25% HP, Boss's Wrath <50%, Revelation first weakness, Critical Moment 3+ momentum, Fate's Edge round ≥5); All-In death roll wired; resilience via `resolveCrisis(optionId)`.
- ✅ Fear gauge (hidden) → Terrified −20% acc / −10% dmg when >50; Bravery actions in Skill menu (`resolveBravery`).
- ✅ Desperation roll at low HP (<35%) on player turn start; events fire once each (`checkDesperation`).

### Notes
- Crisis/Fear/Desperation state lives in `CombatEngine` (fields `crisisSeen`, `pendingCrisisId`, `fear`, `desperationFired`, `firstWeaknessRevealed`). Snapshot exposes `pendingCrisis` + `fear`; `CombatPhase` includes `'crisis'`.
- Headless `smoketest.ts` drive loops auto-resolve a pending crisis via `resolveCrisis(options[0].id)` so fights terminate deterministically.

---

# Phase 5 — Boss Intelligence

**Goal:** Bosses that profile, adapt, stress, telegraph.

### 5a. Player Profiling (`src/systems/combat/ProfileSystem.ts`)
- Engine tracks 12 metrics per boss fight (phys/magic dmg %, guard %, analyze %, heal %, items, statuses applied, favorite element, avg actions/turn, momentum usage, weakness abuse, combo rate) in `flags` + engine counters.

### 5b. Adaptation Triggers (`src/systems/combat/AdaptationSystem.ts`)
- Every 3rd boss turn, evaluate the 9-trigger table (doc Part 6) and apply responses (Magic Shield +40% mdef, Armor Break, Blind, hidden mechanics, Resonance drain, +30% same-element resist, Interdict −50% heal, Dispel, Echo Lock +1 AP on repeats). Log + "warning" audio + boss card icon.

### 5c. Stress System (`src/systems/combat/StressSystem.ts`)
- Hidden 0–100 with doc gain/loss table; 4 behavior bands shift boss intent weights (conservative → aggressive → ultimate spam → desperate +30% dmg / −30% def). Visible only as flavor log lines ("the Sentinel's strokes grow frantic") unless Layer 3.

### 5d. Tell System (`src/systems/combat/TellSystem.ts`)
- Charged ultimates: boss's declared intent "charging X" one turn before; HUD warning banner + enemy card indicator. Player options: Guard (−50%), Interrupt (Sunder or class skills), Evade (Phase 6), counter-prepare. Generalize Fossil King's existing charge.
- `CombatHUD` intent line renders "⚡ charging Archive Strike…".

### 5e. Personalities
- Map 9 doc personalities to the 5 bosses (e.g. Sentinel=Scholar, Patriarch=Executioner, Chorus=Echo, Fossil King=Martyr, Reflection=Prophet) — personality adjusts intent weights + dialogue flavor (Phase 6 dialogue).

### Files
`ProfileSystem.ts`, `AdaptationSystem.ts`, `StressSystem.ts`, `TellSystem.ts`, `bosses.ts`, `CombatEngine.ts`, `CombatHUD.ts`, `CombatScene.ts`, `PlaceholderAudio.ts`.

### Done criteria
- Spamming one element earns resistances; never analyzing hides mechanics.
- Boss enrages visibly under stress; ultimates always telegraphed a turn early.

---

# Phase 6 — States, Positioning & Meta

### 6a. Battlefield States (`src/systems/combat/BattlefieldStateSystem.ts`)
- 8 states from doc Part 7, adapted to 8 damage types: Dust Storm, Sacred Ground, Broken Terrain, Echo Zone, Shadow Veil, Time Distortion, Silence Field, Truth Aura. Effects via global modifier object consulted by engine damage/status paths. Duration 3 turns; new overrides old. Sources: enemy intents, class skills (Scholar Sacred Ground), items.
- HUD: small state banner under the combat title.

### 6b. Positioning (`src/systems/combat/PositionSystem.ts`)
- `position` on player + each enemy ('front'|'middle'|'back'): front +15% dmg −10% def; back −10% dmg +15% def, harder to hit (+10 dodge). Damage modifiers applied in `computeAndApplyDamage` / `dealDamageToPlayer`.
- Actions: Advance (free), Retreat (free), Charge (1 AP: move 2 forward + attack), Fall Back (1 AP: move 2 back + guard). Enemy tendencies set default positions; Aggressors front, Casters back.
- UI: position pips on enemy card + player stat panel ("FRONT/MID/BACK").

### 6c. Persistent Archive (`src/systems/combat/ArchiveSystem.ts`)
- `MetaState` gains `enemyArchive: Record<enemyId, { fragments: string[], exploited: boolean }>`. Defeating/scanning enemies adds fragments; full entry unlocks Archive Exploits (Layer 4) and permanent "Archive Note" boosts.
- `LoreCodexScene` new section listing enemy archive entries.

### 6d. Difficulty Modes (`src/systems/SettingsManager.ts` + `SettingsScene.ts`)
- Easy/Normal/Hard/Ironman per doc Part 17: damage multipliers, enemy stat scaling, fatigue gain, token penalties, permadeath (skip checkpoint restore in `handleDeath`).

### Files
`BattlefieldStateSystem.ts`, `PositionSystem.ts`, `ArchiveSystem.ts`, `types.ts`, `enemies.ts` (default positions), `CombatEngine.ts`, `CombatHUD.ts`, `StatPanel.ts`, `CombatScene.ts`, `SettingsManager.ts`, `SettingsScene.ts`, `LoreCodexScene.ts`, `gameStore.ts` (`handleDeath`), `SaveManager.ts`.

### Done criteria
- States visibly alter combat; positions shift with Advance/Retreat and matter.
- Archive entries persist across runs and unlock exploits.
- All 4 difficulty modes selectable and effective.

---

# Phase 7 — Polish & Balance

- UI: intent confidence % (Part 14 texts), fatigue bar (done P1), position markers, damage-type colors (done P3), crisis alert FX, resonance tier glow, AP tracker polish.
- Audio cues (Part 18): weakness crunch, resonance chime, crisis drum, adaptation warning, AP ding, combo ding, fatigue gasp — extend `PlaceholderAudio.ts`.
- Combat log: damage breakdown (base+modifiers), enemy "thoughts" (why it chose the intent), color coding, archive updates.
- `TutorialScene`: teach tokens, investigation, intents, classes.
- Balance pass against doc Part 20 principles; tune numbers after playtests; update this file's notes.

### Done criteria
- ✅ Intent confidence % shown per investigation layer (75/85/92/100).
- ✅ Crisis triggers the drum cue + red flash + screen shake; adaptation/charge/ultimate banners flash.
- ✅ Resonance tier label pulses on climb; new audio cues wired (weakness crunch, combo ding, AP ding, fatigue gasp, resonance chime, adaptation warning).
- ✅ Combat log: notable-damage breakdown tags [weakness, crit, positioning, archive, marked, combo, reaction…], tendency-flavoured enemy "thoughts" before each intent resolve, color-coded log text.
- ✅ Tutorial expanded (tokens/fatigue, investigation, intents & tells, classes).
- ⏳ Balance tuning vs Part 20 deferred to manual playtests — note numbers after real fights.

---

## Final Definition of Done

All 20 doc parts implemented or explicitly adapted (2 reactions dropped for type-lock, team-only effects adapted to single player). Game remains save-compatible via v3 migration. typecheck + build green.

### Remaining for full DoD
- Manual playtest of 3+ fights and 1 boss, then tune balance per doc Part 20.
