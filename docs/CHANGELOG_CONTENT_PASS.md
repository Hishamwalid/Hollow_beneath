# Content & Mechanism Pass — Changelog

Full content buildout + bug fixes on top of the original MVP. Baseline (`npm run typecheck` + `npm run test`) was green before starting and is green after every change in this pass; `npm run build` succeeds.

## Content (data-only additions)

| Content | Before | After |
|---|---|---|
| Events | 8 (6 real + 1 filler + traps counted loosely) | **20** documented events + 1 filler (`quiet_passage`), all page-ranges verified to give every page 1–10 at least one non-filler eligible event at any Resonance |
| Minor landmarks | 0 | **5** vignettes at the capture-point nodes (10/30/50/70/90) — GDD §7.3's "5 minor story beats," previously just gold popups |
| Enemies | 8 | **12** — added Dust Wight (early), Dust-Road Raider (Caravan), Archive Cipher-Wraith, The Unread (Resonance ≥50 apex) |
| Skills | 8 | **25** — 17 new, organized into Warrior/Ranger/Scholar/Guardian/Shadow trees (`tree` field), granted via character-creation preset match + a new discovery pool |
| Items | 12 | **30** |
| Lore fragments | 0 (12 ids referenced, no text anywhere) | **40**, every id cross-checked to resolve, viewable in a new Lore Codex screen |
| Whispers | 0 | **50**, tiered by Resonance, ambient (never blocks input) |

New data files: `src/data/loreFragments.ts`, `src/data/whispers.ts`, `src/data/minorLandmarks.ts`.

## Bugs found and fixed

- **5 of 8 named skills were grantable but mechanically dead** (`chorus_step`, `loom_touched`, `librarians_eye`, `archival_insight`, `chorus_echo`) — their passive tags were never read anywhere outside their own definition. All wired now.
- **`sealing_strike` had a working active-skill implementation but no grant path** — unreachable in normal play. Added to the new discovery skill pool.
- **Player Dodge never applied against incoming attacks** — only checked for the player's own attacks. Added a real dodge roll to the incoming-damage path.
- **`unfinished_sentence`'s death ward was scoped per-combat instead of per-run** (its own description says "each run") — would have triggered in every fight instead of once per run. Fixed to use persistent player state.
- **`archival_insight`'s XP/Echo Shard bonus** wired through every shard-granting call site (node visits, event choices, event-triggered combat victories, boss rewards, discovery finds).
- **Discovery nodes only ever gave gold**, despite the GDD defining them as "Lore, items, secrets." Replaced with 11 weighted templates (gold/items/lore/shards/faction/skills/whisper/dud).
- **Off-screen choice menus, confirmed by coordinate math**: the Merged Chorus (5 pre-combat choices) and Fossil King (4 choices) rendered their last button(s) below the visible canvas. `ChoiceMenu` now adaptively compresses spacing and shifts the block up to always stay on-screen — fixes it everywhere the component is used, not just those two fights.
- **Dialog boxes were leaking** in `EventScene` and `LandmarkScene` — created as local consts, never destroyed before the next one, relying on implicit scene cleanup. Now tracked as class fields and explicitly destroyed, with `shutdown()` handlers as a backstop.
- **Dead code removed**: a computed-but-unused damage variable in `CombatScene`'s attack animation.

## New mechanisms

- `EventDef.requiresAnyFlag` — events can now require a player flag to be eligible (used for the two boss-callback events, `page_left_behind` and `patriarchs_ash`).
- `WhisperSystem` — picks a tiered, anti-repeat ambient line on board movement and combat start.
- Lore Codex scene (`LoreCodexScene`, reachable from the main menu) — paginated view of all 40 fragments, locked ones shown as undiscovered.
- Lightweight Resonance-tier screen tint (plain tweened rectangle, not a custom shader — deliberately, to stay within "no new engine-level GLSL work").

## UI / animation polish

- Buttons: hover/press scale tweening instead of an instant texture swap.
- Stat bars (HP/MP/Resonance/faction): tween to their new width instead of snapping.
- Dialog boxes: fade in on creation (centralized in `createDialogBox`, so every scene gets it for free).
- Choice menus: stagger-in fade per button.
- Combat: floating damage numbers now also appear over enemies (previously player-only); combat log capped at 4 visible lines instead of 6 to guarantee clearance above the stat panel.

## Overhaul Phase Implementation (PLAN_OVERHAUL.md)

Items completed from the full overhaul plan:

| Item | Description | Status |
|------|-------------|--------|
| **0b** | Fix Resonance Anchor cost (25 instead of 20) | ✅ Done |
| **0c** | Vite code-splitting (`manualChunks`) | ✅ Done |
| **A1** | Board expansion to 200 nodes + 1d6 movement | ✅ Done |
| **A2** | Level-Up System (XP thresholds, stat/skill point choices, XP bar) | ✅ Done |
| **A3** | Skill Tree System (5 trees × 3 tiers, purchase UI, BoardScene entry with badge) | ✅ Done |
| **A4** | MP System Activation (mpCost, CombatEngine gating, rest restore) | ✅ Done |
| **A6** | Fog of War (4-node visibility ahead of player) | ✅ Done |
| **A7** | Turn Order Indicator (speed bar in CombatHUD) | ✅ Done |
| **C6** | Checkpoint Polish (notification text, ghost token on death) | ✅ Done |
| **B4** | Faction Hostile Consequences (ambush on move, rest disruption, locked event choices, flavor text) | ✅ Done |
| **C4** | End-of-Run Stats Screen (resonancePeak tracking, RunStats/BestRunStats, overlay in GameOver + Ending scenes) | ✅ Done |
| **A5** | Equipment Change UI (interactive slots + picker overlay in InventoryScene, stat deltas, equip confirmation) | ✅ Done |
| **B1** | 12 Event Variants (10 new events, 2 new traps, 5 new lore fragments, trapPool extended) | ✅ Done |
| **C7** | Page Transition Cards (full-screen chapter overlay on pages 1/5/9/13/17, 2.5s blocking, fades) | ✅ Done |
| **B2** | Auto-Generated Events (14 procedural template events replacing quiet_passage filler, 4 categories, faction substitution, investigate/pass choices, repeat avoidance) | ✅ Done |
| **B3** | Event Chains (3 multi-node story chains: The Bread, The Scripture, The Hymn) | ✅ Done |
| **C1** | Onboarding / Tutorial (5-screen tutorial auto-shown on first run, How to Play button, first-run contextual tooltips, per PLAN_OVERHAUL §3.1) | ✅ Done |
| **C5** | Settings Expansion (master volume slider, text speed slider, screen shake toggle, credits, clear data, localStorage persistence, per PLAN_OVERHAUL §6.1) | ✅ Done |
| **C2** | Landmark Cinematic (boss approach cards with letter-by-letter name reveal, screen shake + red flash on boss combat entry, pulsing gold border, celebration particles + sequential reward animations on defeat, per PLAN_OVERHAUL §3.2) | ✅ Done |
| **C3** | Resonance Visual Effects (tier-based screen effects, ResonanceFX system, per PLAN_OVERHAUL §3.3) | ✅ Done |
| **D1** | Build verification (tsc, tests, vite build) | ✅ Done |

New files: `src/systems/LevelSystem.ts`, `src/ui/LevelUpModal.ts`, `src/data/skillTree.ts`, `src/scenes/SkillTreeScene.ts`, `src/ui/RunStatsScreen.ts`, `src/data/eventTemplates.ts`, `src/scenes/TutorialScene.ts`, `src/data/tutorialText.ts`, `src/systems/SettingsManager.ts`, `src/data/credits.ts`, `src/systems/ResonanceFX.ts`.

### Remaining

| Item | Description |
|------|-------------|
| **D2–D8** | Manual integration tests (full playthrough, edge cases, save/load, settings) |
| **D9** | Final wrap (changelog update, commit) |

## Deep Audit Bug Fix Pass

Three parallel audit agents (CombatSystem, Economy/Items, Events/Board/Scenes) ran a super in-depth codebase review. **27 bugs** found and fixed across 10 files.

### Critical

| Bug | File | Impact |
|-----|------|--------|
| `beginRound` set `phase='player'` after `checkOutcome()` set defeat/victory | `CombatEngine.ts` | Could soft-lock on death |
| `useSkill` consumed AP before MP check — AP lost on insufficient MP | `CombatEngine.ts` | Wasted action points |
| `resonanceAbility` consumed MP before AP check — MP lost on insufficient AP | `CombatEngine.ts` | Wasted mana |
| `veilStepGuaranteed` not reset per round — infinite dodge exploit | `CombatEngine.ts` | Balance break |
| `fossilLastLaw` flag persisted across rounds — permanent skill-repeat lock | `CombatEngine.ts` | Entire combat broken |
| Phalanx: 50% damage dealt to *each* ally instead of split among them | `CombatEngine.ts` | Damage multiplication |
| Hunter's Mark bypassed `computeAndApplyDamage` — no crit/momentum/resonance | `CombatEngine.ts` | Missing bonuses |
| EventEngine `resolveEventChoice` dropped `combat` field on check-pass path | `EventEngine.ts` | Event combats never triggered |
| 2 resonance `-=` mutations not clamped with `Math.max(0, …)` | `events.ts` | Resonance could go negative |
| `addXp` had no `MAX_LEVEL` cap — could over-level past 15 | `gameStore.ts` | Economy break |
| `awardStatPoint` had no `STAT_MAX` cap — stats above 10 | `gameStore.ts` | Economy break |
| `player.totalRuns` never synced from `meta.totalRuns` — always 0 | `gameStore.ts` | First-run tooltip every run |
| Checkpoint restored to page start instead of exact node index | `SaveManager.ts`, `types.ts` | Lost up to 9 nodes of progress |
| `handleDeath` passed stale `game` (without `deathNodeIndex`) to `restoreCheckpoint` | `gameStore.ts` | Ghost never showed |
| "Return to Menu" set `lastRunStats: null`, overwriting death record | `BoardScene.ts` | Lost death stats |

### Medium

| Bug | File | Impact |
|-----|------|--------|
| `statMultiplier` had no `mdef` branch — magic defense immune to status | `StatusEffectSystem.ts` | Missing gameplay |
| `fragile_perception` description said "Resonance gain doubled" (wrong) | `statusEffects.ts` | Misled players |
| `landmark` missing from `FIRST_NODE_TOOLTIPS` | `tutorialText.ts` | Missing tooltip |
| Initiative order double-sorted | `CombatEngine.ts` | Redundant code |

## UI / Layout Bug Fix Pass

**18 layout and click-registration issues** found and fixed across 10 files.

### Critical

| Issue | File | Fix |
|-------|------|-----|
| Button hit area used original texture size (e.g. 32×32) not `setDisplaySize` | `Button.ts` | Added explicit `Phaser.Geom.Rectangle` hit area |
| `setEnabled(true)` never re-attached event handlers after `disabled=true` | `Button.ts` | Always attach handlers; disable via `disableInteractive()` |
| RunStatsScreen buttons at depth 0 behind overlay at depth 200 — **invisible** | `RunStatsScreen.ts` | Added buttons to container with proper depth |
| CombatScene Victory "Continue" button at depth 0 behind overlay at depth 35 — **invisible** | `CombatScene.ts` | Set button depth=37 |
| MenuScene title at y=−6 — top 32px clipped off-screen | `MenuScene.ts` | Reduced font 52→44px, clamped y≥20 |
| TutorialScene "Skip Tutorial" fired both `exitTutorial` AND scene-wide handler — **double transition** | `TutorialScene.ts` | `stopImmediatePropagation` + `busy=true` guard |
| SkillTreeScene confirm purchase overlay not interactive — clicks passed through to nodes | `SkillTreeScene.ts` | Added `.setInteractive()` |
| LevelUpModal backgrounds not interactive — clicks fell through to CombatScene | `LevelUpModal.ts` | Added `.setInteractive()` to both modal backgrounds |

### High

| Issue | File | Fix |
|-------|------|-----|
| Stat description text (x=50) overflowed row bg (right edge x=150) | `LevelUpModal.ts` | Adjusted row width, name/desc positions |
| `sceneTransition.fadeToScene` had no debounce — rapid clicks queued multiple transitions | `sceneTransition.ts` | Added `transitioning` guard flag |
| Enemy token hit area mismatch (same as Button.ts bug) | `CombatHUD.ts` | Click handler moved to `panelBg` |
| Enemy name/affinity no wordWrap — long names overflowed panel | `CombatHUD.ts` | Added `wordWrap: { width: 120 }` |
| EventScene scene-wide `pointerdown` remained active after choices shown | `EventScene.ts` | `removeAllListeners` in `showChoices()` |
| Inventory items overflowed below screen; description had no wordWrap | `InventoryScene.ts` | Capped at 10 items, wordWrap on name/desc, "+N more" |
| SettingsScene credits could overflow below viewport | `SettingsScene.ts` | Added y-bound guard |
| Floating combat text at (200, 600/620) overlapped StatPanel (16→256 x-range) | `CombatScene.ts` | All floating text moved to x=280 |

### Medium

| Issue | File | Fix |
|-------|------|-----|
| ShardShop Buy button (x=250, w=90) and cost label (x=300 center) overlapped | `ShardShopScene.ts` | Cost label moved to x=350 |
| ChoiceMenu buttons compressed to 6px gap with many items | `ChoiceMenu.ts` | Min spacing 56→62 |
| BoardScene log text no wordWrap — long messages overflowed screen | `BoardScene.ts` | Added `wordWrap` |

## Validation

`npx tsc --noEmit` clean, `npm run test` (20 smoke tests) passes, `npx vite build` produces production bundle — all verified after every bug fix batch.

## Validation

`smoketest.ts` extended with: minor-landmark + full lore-registry cross-reference check, per-page event coverage check (every page × low/high Resonance), content-count assertions (20/12/25/30/40/50/5), skill-distribution-path sanity, whisper-tier coverage. All pass.

---

# Battle Architecture Overhaul + Companions + Stage 1 Map (August 2026)

Full record of the "Echo Combat Architecture" implementation (docs/BATTLE_ROADMAP.md Phases 0–7,
all complete) plus the companion system and the hand-authored Stage 1 board map.

## Combat system rebuild (Phases 0–7)

| Phase | Delivered |
|---|---|
| 0 Foundations | types.ts fields (classId, fatigue, insight, fearGauge, position), SaveManager v3 migration with defaults injection |
| 1 Action Economy | Token AP gauge (0–5; miss wipes tokens), FatigueSystem bands, 9 momentum payoffs (Flow/Harmony/Archive/Forgotten Technique/Unravel/Echo Surge/Phase Shift/Desperate Strike/Overclock), per-action AP cost table, Analyze de-free-ified |
| 2 Investigation & Intent | Layered Scan/Probe/Deep Analysis per enemy, Insight spend, enemies pre-declare intents at round start (confidence % scales with layer), all 17 enemy defs + 5 bosses given tendency + intents |
| 3 Weakness Depth | WeaknessWindowSystem (3 streak → 2-turn window), ElementalReactionSystem (8 ordered type pairs), ComboSystem (8 tag sequences, +2 tokens), damage numbers colored by type |
| 4 Classes & Crisis | classes.ts — 6 class-locked trees (passive + signature + 4 progression each = 36 skills), SkillEffect resolver, 5 crises × options, FearSystem (hidden gauge → Terrified) with bravery actions, DesperationSystem low-HP gambles |
| 5 Boss Intelligence | ProfileSystem (12 habit metrics), AdaptationSystem (every 3rd boss turn), StressSystem (4 behaviour bands), TellSystem (charged ultimates telegraphed a turn early), 5 personalities biasing intent weights |
| 6 States / Position / Meta | BattlefieldStateSystem (8 global states), PositionSystem (front/mid/back rows + Advance/Retreat/Charge/Fall Back), ArchiveSystem (persistent MetaState.enemyArchive fragments → Layer-4 exploits, Codex Enemy tab), DifficultySystem (easy/normal/hard/ironman incl. permadeath) |
| 7 Polish | Audio cues (weakness crunch, adaptation warning, combo/AP ding, fatigue gasp, resonance chime), intent confidence % on cards, combat-log damage breakdowns + enemy "thoughts" + color coding, crisis flash/shake, resonance tier glow, tutorial expanded to teach tokens/investigation/intents/classes |

## Companion/ally system (`src/systems/ally/`)

- 4 companions: Warden Emissary (shielding), Covenant Courier (healer), Sable Zealot (striker),
  Archive Cartographer (prober) — recruited from region-bound discovery nodes
- Loyalty 15→100 with tiers (Steadfast 25 / Devoted 50 / True Bond 80) gating ability tiers;
  gains +12 win / +4 loss / +5 home-region fight
- Deterministic `planAllyTurn()` combat AI (heal dying player → guard boss rounds → heal →
  support → attack weakest non-boss)
- Boss assists: Last Oath, Unbroken Vigil, Bitter Revival, The Whole Letter, First Church Word
- Rewards: victory shards scale with loyalty; bond thresholds grant one-time Resonance (+3/+5/+8)

## Board & stage work

- Hand-authored Stage 1 map: 40 anchor points over `stage1_background.png`
  (`src/data/paths/stage1_path.json` + `stage1_adjust.json` + `stage1Nodes.ts`); chapter 1
  renders the full 40-node polyline instead of the procedural ring
- Dev tools: PathPointPickerScene ('PathPointPicker') records path JSON; NodePreviewScene
  ('NodePreview') visualises it; `?editpath=1` drag-edit + export; `?editlayout=1` live-tunes
  combat HUD offsets saved to `src/data/combatLayout.json`
- Stage-based enemy pools: 5 stages with exclusive rosters; `sanitizeFightEnemies()` scrubs
  scripted fights to current-stage enemies (documented in docs/ENEMY_ROSTER_BY_STAGE.md)

## Real assets integrated

- Fonts: Cinzel (display), IM Fell English (body), Courier Prime (numerics) — WOFF2 in
  `public/assets/fonts/`, registered as `Hollow*` families in `style.css`
- Backgrounds: map1–5 chapter maps, stage1 background, 3 combat backgrounds (sand/stone/boss)
- Sprites: player set (idle/windup/attack/hit/victory/defeated/guard + face + pin),
  Dust Wight + Echo Skeleton sets, full Argent Sentinel frame set (17 frames incl.
  transform/victory/defeat sequences with failsafe timing)
- UI: book panel, board token

## Validation

`npm run typecheck`, `npm run build`, and `npm run test` green after every phase. Smoketest
extended to ~22 sections covering every battle phase (windows/reactions/combos regression,
investigation, class identity, crisis/fear/desperation, allies ×5 subsections, battlefield
states, positioning, difficulty, archive, 0 HP defeat edge case).

---

# Combat Revamp — "Echo" + Scan + QTE + Loadout (August 2026)

Source of truth: `docs/COMBAT_SYSTEM_REVAMP.md`. Supersedes the Echo Combat Architecture above. Battle UI layout/positions & action images are **unchanged** (compat shims).

## What changed

- **Combat model:** no AP/fatigue; one action/turn → `END TURN`; QTE-timed offense (perfect/good/miss), Slowed doubles needle speed, Guard skips QTE; Guard halves damage, blocks Stagger, +6 MP.
- **Affinity discovery:** 8 slots per enemy start as `?`; hitting with a damage type discovers that slot forever (`wk`/`str`/`null`/`rep`/`drn`/`-`); discoveries persist across runs in `MetaState.discoveredAffinities` and surface in a free Scan modal (geometry per `scan_UI.svg` ×⅔) + Lore Codex Bestiary. Cipher Barrier nullifies the next skill; Reflection erases a slot for two turns.
- **Down + 1-More:** `wk` (or any crit) with decent timing Downs the target (lose next turn) and grants an immediate extra action.
- **Reactions:** `Frost→Shock` Superconduct (stun, consumes Chilled), `Shock→Flame` Overcharge (+30%), `Sacred-mark→Shadow` Eclipse (strips buffs, ×2).
- **Skills:** no classes/trees/skill points. ~40 named techniques via five **chapter loadouts** (6 active + Archive); auto-granted on chapter entry, swappable on the new **Loadout** screen (replaces SkillTreeScene). One-time HP/MP costs, DISCOVERABLE_SKILLS pool, passives retained (`unfinished_sentence`, `archival_insight`, etc.).
- **Enemies/bosses:** discrete affinities + named movepools per revamp §4; charge telegraphs (`⚡ CHARGING:`) unleash next enemy phase; groups of ≥3 cap at one heavy/AOE per round; boss telegraphs & mechanics preserved (Patriarch Toll, Chorus Unison Shift, Fossil Cataclysm, Reflection Mirror/Erasure/Surge).
- **Engine:** new `CombatEngine` (~1300 lines) with headless `resolveQte()` hook, `exposedPhase` (`momentum_choice` compat), `EnemyView` legacy veneer, and 15+ no-op shims so the original battle UI scene (`CombatScene.ts`) compiles unchanged. Difficulty/Resonance scaling, page scaling, barrier, and Save **v6** migration (Bestiary + loadout) carried over.
- **UX:** Scan is a free action; full Bestiary tab in `LoreCodexScene`; Loadout replaces SkillTree; BoardScene auto-grants chapter skills; QTE respects `Slowed` and `phase_shift` dodge charges.
- **Removed:** `classes.ts`, `skillTree.ts`, 15 `systems/combat/*` subsystems, `ally/AllyCombat` + `AllyBoss`, `CombatHUD` dependency (kept for battle scene).

## Validation

`npx tsc --noEmit` 0 errors; `npm run test` 153/0; `npm run build` 102 modules. The circular-chunk warning (`systems → data → systems`) is pre-existing (data/bosses ↔ systems/checks ↔ engine).

See README "Current State" and `docs/AGENTS.md` §13 for the post-revamp picture.

---

# Combat UX & Balance Pass — post-revamp polish (August 2026)

Follow-up to the revamp above: makes the revamped combat fully playable end-to-end from the battle scene and tunes feel. All gates green (`tsc -b`, `vite build`, smoketest 165+/0).

## Battle flow & engine
- **QTE wired into the UI** (was engine-only): offensive skills open a timing bar (`src/ui/QteBar.ts`) — needle sweep, Space/Enter or click, verdict label + zone flash on confirm, auto-miss if ignored. **Basic attacks resolve instantly with no timing bar.**
- **Timing scaling:** miss ×0.8 / good ×1.0 / perfect ×1.3 (+0.35 crit). A missed window **always connects** (the old 40% whiff is gone); only true no-contact plays the miss cue.
- **1-More is single-use** and no longer chains: weakness hits on an *already-Downed* enemy grant nothing (`afterAction()` consumes the flag; strike() gates on `!downed`).
- **Turn order includes the player** (initiative merged by SPD); panel lists everyone.
- **Real enemy-phase animation data:** snapshot `lastActors` = enemies that actually acted; `enemyPhaseDamage` attributed per attacker — enemy poses/damage beats play only after END TURN, not after every player action.
- **Enemy accuracy tuning:** player dodge counts at half weight vs enemy attacks; hit-chance floor 25% (enemies land ~75% typically).
- **Boss nerf (temporary):** boss HP ×0.85, atk/mat ×0.85, def/mdef ×0.90 until per-boss balance is revisited.
- New accessor `CombatEngine.getLog()` (snapshot carries only the log tail).

## Battle UI
- **Free Scan modal**: name/Lv, MAX HP/MP, all 8 affinity chips (`?` until discovered), move pool; costs nothing.
- **LOG button** replaces the side log panel → detailed full-log modal; new log lines also toast briefly in a boxed message inside the frame's top edge.
- ACT/AP box removed (one action/turn conveyed by grid state); momentum shown as a bar; stat panel reads live HP/MP/momentum from the engine snapshot.
- Enemy cards show a DOWNED pill; kill sequence = HP drain → dissolve (regular foes) or defeat animation (bosses: `defeat1→2→3` frames when art exists, fade-and-sink fallback otherwise) → breather → result screen.

## Meta
- **Starting a new run wipes Bestiary scan data** (`discoveredAffinities`, `bestiaryKills`); Continue keeps it.
