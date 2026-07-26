# THE HOLLOW BENEATH — Codebase Reference for AI Agents

*Exhaustive reference for understanding and modifying this project. Every file, export, alias, convention, and system is documented here so an agent can work without prior context.*

---

## 1. Project Identity

- **Name**: THE HOLLOW BENEATH
- **Version**: `0.1.0-mvp` (`package.json`)
- **State**: MVP with placeholder art/audio — all visuals are procedural shapes, all SFX are Web Audio tones
- **Platform**: Browser (desktop-first, 1280×800)
- **Stack**: Vite 5.4 + TypeScript 5.5 + Phaser 3.70 + Zustand 4.5
- **Runtime**: Node.js ≥18 (for build/tools only — game runs in browser)

---

## 2. Build & Run Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start Vite dev server at `http://localhost:3000` |
| `npm run build` | `tsc -b --noCheck && vite build` — typecheck + production build to `dist/` |
| `npm run typecheck` | `tsc -b` — full type checking (no emit) |
| `npm run test` | `tsx smoketest.ts` — headless integration test (exercises all systems, no Phaser) |
| `npm run preview` | `vite preview` — preview production build locally |

---

## 3. Path Aliases (tsconfig.json + vite.config.ts)

| Alias | Maps to |
|-------|---------|
| `@/*` | `src/*` |
| `@data/*` | `src/data/*` |
| `@systems/*` | `src/systems/*` |
| `@store/*` | `src/store/*` |
| `@ui/*` | `src/ui/*` |
| `@scenes/*` | `src/scenes/*` |
| `@placeholder/*` | `src/placeholder/*` |
| `@utils/*` | `src/utils/*` |

Import convention: **always use aliases** for cross-directory imports. Relative imports only within the same directory.

---

## 4. Project Structure

```
ROOT/
  index.html                  Entry HTML (div#app, script src=src/main.ts)
  package.json                Dependencies & scripts
  tsconfig.json               TS config with path aliases
  vite.config.ts              Vite config with manualChunks, resolve aliases, dev server
  smoketest.ts                Headless integration test (tsx smoketest.ts)
  public/                     Vite static dir (future asset home)
    assets/                   <-- Place real art PNGs here
    fonts/                    <-- Place WOFF2 font files here
  src/
    main.ts                   Phaser.Game bootstrap, scene registration
    config.ts                 Constants: GAME_WIDTH=1280, GAME_HEIGHT=800, TOTAL_NODES=200, PAGES=20
    style.css                 Minimal global CSS (dark bg, fullscreen)

    data/                     Pure content data — no Phaser imports, testable in Node
      types.ts                SOURCE OF TRUTH: StatBlock, DerivedStats, PlayerState, GameState,
                              MetaState, BoardNode, EventDef, EventChoice, EnemyDef, BossDef,
                              SkillDef, ItemDef, EndingDef, DamageType, StatusInstance,
                              Equipment, RunStats, WhisperDef, TrapDef, and more (468 lines)
      enemies.ts              Exports: ENEMIES (Record<string, EnemyDef>), SUMMON_ENEMIES —
                              12 enemy definitions with stats, affinities, AI act() function
      events.ts               31+ EventDef objects + TRAPS constant + HOSTILE_FLAVOR.
                              Each event has id, title, flavorText, choices[], pageRange, flags.
                              Each choice has statCheck, onSuccess/onFailure callbacks.
      eventTemplates.ts       Procedural fallback events when no custom event matches.
                              Exports: ATMOSPHERIC_TEMPLATES, generateEventFromTemplate(),
                              pickRandomTemplates()
      bosses.ts               5 boss definitions (SENTINEL, CINDER_WYRM (patriarch),
                              MIRROR_KNIGHT (chorus), ARCHIVIST (fossil_king),
                              LOOM_MOTHER (reflection)). Each has BossDef with phases, AI, rewards.
                              Also exports TOTAL_MAJOR_BOSSES, MINOR_BOSSES, bossesForPage()
      items.ts                30 item definitions: 15 consumables, 15 equipment.
                              Exports: ITEMS, STARTING_INVENTORY, getItem()
      skills.ts               25 named skills (NAMED_SKILLS), action AP costs,
                              discoverable skills, preset starting skills
      skillTree.ts            6 skill tree definitions (warrior/ranger/scholar/guardian/shadow/universal).
                              Exports: SKILL_TREES
      stats.ts                Stat formulas. Exports: computeDerivedStats(), getEquipmentBonuses(),
                              POINT_BUY_TOTAL (30), PRESET_BUILDS, STAT_MAX (10),
                              isValidBuild(), STARTING_EQUIPMENT_BONUSES
      factions.ts             4 factions. Exports: FACTIONS, STARTING_FACTIONS
      loreFragments.ts        51 lore fragments. Exports: LORE_FRAGMENTS, getLoreFragment(),
                              TOTAL_LORE_FRAGMENTS
      whispers.ts             50 whispers across 4 resonance tiers. Exports: WHISPERS
      shardShop.ts            11 shop entries. Exports: SHARD_SHOP_ITEMS, shardRates
      endings.ts              7 ending definitions. Exports: ENDINGS
      minorLandmarks.ts       10 minor landmark events (at node indices 10,30,50,...,190).
                              Exports: MINOR_LANDMARKS
      damageTypes.ts          8 damage types: slash/pierce/blunt/flame/frost/shock/sacred/shadow.
                              Exports: DAMAGE_TYPES, getDamageType()
      statusEffects.ts        DoT/control/buff/debuff tables. Exports: BURN_TABLE, POISON_TABLE,
                              BLEED_TABLE, CURSED_TABLE, FROSTBITE_TABLE, SHOCK_TABLE,
                              CONTROL_LABELS, BUFF_LABELS, DEBUFF_LABELS, BARRIER_DEFAULTS
      credits.ts              Game credits text array. Export: CREDITS
      tutorialText.ts         Tutorial screens. Export: TUTORIAL_SCREENS

    systems/                  Pure logic — NO Phaser imports, testable in Node
      BoardGenerator.ts       generateBoard(rng) → BoardNode[]. 200 nodes, weighted by type.
                              Exports: generateBoard, pageForIndex, CHECKPOINT_INDICES,
                              CAPTURE_INDICES, NODE_TYPE_WEIGHTS
      CombatEngine.ts         Core turn-based combat. Class: CombatEngine.
                              Methods: beginRound(), attack(), useSkill(), guard(), useItem(),
                              analyze(), sunder(), withdraw(), endPlayerPhase(), resolveMomentum()
                              Types: CombatSetup, CombatSnapshot, CombatPhase, CombatAction
      EventEngine.ts          Event resolution. Exports: buildEventCtx(), resolveEventChoice(),
                              pickEvent(), resolveTrap(). Types: EventApplyCtx
      ResonanceSystem.ts      Resonance tier math. Exports: resonanceTier(), TIER_LABELS,
                              TIER_COLORS, playerScaling(), enemyScaling()
      ResonanceFX.ts          Visual effects by tier. Exports: applyResonanceTint(),
                              createResonanceGlow(), createVignette(), createTextGlitch()
      EchoShardSystem.ts      Shard economy. Exports: shardsForNodeVisit(), shardsForLandmark(),
                              shardsForEnding(), deathRefund(), canAfford(), purchase(),
                              applyUnlocksToNewRun()
      WhisperSystem.ts        Ambient whispers. Exports: maybePickWhisper()
      StatusEffectSystem.ts   Status manipulation. Exports: applyStatus(), removeStatus(),
                              hasStatus(), getStatus(), tickDots(), tickDurations(),
                              statMultiplier(), applyBarrier(), setBarrier(), removeAllBuffs()
      LevelSystem.ts          XP/level formulas. Exports: xpForLevel(), computeLevelUp(),
                              MAX_LEVEL (15)
      checks.ts               Dice/stats checking. Exports: statCheck(d20+stat*2 vs DC+10),
                              rollMovement() (1d6), rollDie(sides)
      rng.ts                  Seeded PRNG. Exports: mulberry32(seed), randomSeed(), pick(arr)
      SaveManager.ts          localStorage persistence. Exports: saveGame(), loadGame(),
                              defaultMeta(), takeCheckpoint(), restoreCheckpoint()
      sceneTransition.ts      Phaser scene transitions. Exports: fadeToScene(), fadeIn()
      SettingsManager.ts      Settings CRUD. Exports: SettingsManager class with get(), set(), save()
      particles.ts            Particle effects. Exports: spawnHitParticles(), spawnHealParticles(),
                              spawnMomentumParticles(), spawnCelebrationParticles()

    store/
      gameStore.ts            Zustand store (351 lines). Export: useGameStore.
                              State: { meta: MetaState, player: PlayerState|null, game: GameState|null }
                              Actions: initFromDisk(), startNewRun(stats), loadActiveRun(),
                              persist(), recordCheckpoint(), handleDeath(), finalizeRun(endingId),
                              addXp(amount), awardStatPoint(stat), awardSkillPoint(),
                              consumeSkillPoint(), purchaseSkillTreeTier(treeId, skillId),
                              resetSkillTreePurchases(), computeRunStats(), equipItem(slot, itemId),
                              playerHistorySet()
                              Also exports: createStartingPlayer(stats, unlocks, totalRuns)

    scenes/                   Phaser presentation layer — each file exports a class extending Phaser.Scene
      BootScene.ts            Key: 'Boot'. Immediately transitions to Preload. Sets bg color.
      PreloadScene.ts         Key: 'Preload'. Calls generatePlaceholderTextures(this),
                              store.initFromDisk(), then fades to Menu. <-- REAL ASSETS GO HERE
      MenuScene.ts            Key: 'Menu'. Main menu: Continue / New Descent / Settings / Codex /
                              Shard Shop / Credits. Reads store.loadActiveRun() for Continue visibility.
      CharacterCreationScene.ts Key: 'CharacterCreation'. Point-buy stat allocation (30 total),
                              preset builds, starts the run. Calls store.startNewRun().
      TutorialScene.ts        Key: 'Tutorial'. 5 scrollable tutorial screens reading from
                              TUTORIAL_SCREENS. Reuses panel_dialog for typewriter text.
      BoardScene.ts           Key: 'Board'. Main game board (200 nodes, 20 pages). Handles movement
                              (1d6), node resolution, dice rolling, fog of war, checkpoint effects,
                              ghost token. Transitions to Event/Combat/Landmark depending on node type.
                              ~680 lines. Methods: drawBoard(), rollDice(), finishMove(), resolveNode().
      EventScene.ts           Key: 'Event'. Narrative event with choices. Uses EventEngine.pickEvent()
                              and resolveEventChoice(). Shows dialog via DialogBox.
      CombatScene.ts          Key: 'Combat'. Turn-based combat UI (~609 lines). Uses CombatEngine.
                              Manages AP pips, action buttons, enemy display, animations.
      LandmarkScene.ts        Key: 'Landmark'. Boss approach/aftermath (~281 lines).
                              Shows boss lore before combat, epilogue after.
      EndingScene.ts          Key: 'Ending'. Ending epilogue. Shows ending title, text, stats.
      GameOverScene.ts        Key: 'GameOver'. Death screen with checkpoint continue option.
      ShardShopScene.ts       Key: 'ShardShop'. Echo Shard meta-progression shop.
      LoreCodexScene.ts       Key: 'LoreCodex'. Browse discovered lore fragments.
      SettingsScene.ts        Key: 'Settings'. Volume sliders, text speed, screen shake toggle,
                              clear data button, credits. Uses SettingsManager.
      InventoryScene.ts       Key: 'Inventory'. Equipment & consumables (~286 lines).
                              Equip/unequip items. Uses store.equipItem().
      SkillTreeScene.ts       Key: 'SkillTree'. Skill tree purchase UI (~215 lines).
                              Uses store.purchaseSkillTreeTier().

    ui/                       Reusable Phaser UI components (functions, not classes)
      uiTheme.ts              FONT_SERIF, FONT_MONO, PALETTE_HEX (10 colors), DAMAGE_TYPE_HEX (8)
      Button.ts               createButton(scene, x, y, text, callback, options?) → Phaser.GameObjects.Container
                              Options: width, height, disabled, subtitle, depth, hoverOnly
      DialogBox.ts            createDialogBox(scene, config) → { container, show(text, cb), skip(), destroy() }
                              Config: x, y, width, height. Reads text speed from SettingsManager.
      ChoiceMenu.ts           createChoiceMenu(scene, x, y, choices, callback, options?) → Container
                              Choices: { label, disabled, tooltip }[]. Adaptive positioning to stay on-screen.
      CombatHUD.ts            createEnemyDisplay(), createApPips(num), createActionBar(actions),
                              createSpeedBar(entities). All return Containers. ~183 lines.
      StatPanel.ts            Creates HP/MP/XP/Resonance/faction bars. Tweened animations.
                              Returns { container, update(player) }.
      DiceRoller.ts           createDiceRoller(scene, x, y, result, callback?) → animation controller
      NodePreview.ts          createNodePreview(scene, node) → tooltip overlay
      LevelUpModal.ts         showLevelUpModal(scene, player, onComplete) → modal overlay
                              Shows stat point allocation + skill point award.
      RunStatsScreen.ts       showRunStatsScreen(scene, player, game, meta, endingId) → stats overlay
                              Shows run stats, best run comparison, new lore, Echo Shards earned.
      WhisperOverlay.ts       applyResonanceTint(scene, tier), showWhisper(scene, text) → overlay

    placeholder/              Procedural asset generation — swap these for real assets
      PlaceholderTextures.ts  generatePlaceholderTextures(scene). Creates all textures via
                              Graphics.generateTexture(). Maps: PALETTE colors, circleToken()
                              for enemies, hexToken() for bosses, diamondIcon/triangleIcon/etc.
                              for node types, panelTexture() for UI, shapeTexture() for particles.
                              Also exports: PALETTE (hex numbers), shapeTexture(), circleToken()
      PlaceholderAudio.ts     PlaceholderAudioEngine class. Exports singleton: audio.
                              Methods: click(), confirm(), diceRoll(), moveStep(), hit(), critHit(),
                              miss(), weaknessHit(), heal(), damageTaken(), statusApplied(),
                              momentumFull(), victory(), defeat(), bossPhase(), levelUp(),
                              shardGain(), pageTurn(), checkpoint(), setMasterVolume(v)
```

---

## 5. Scene Flow Diagram

```
Boot → Preload → Menu ────────────────────────────────────────────┐
                    │                                              │
                    ├→ Tutorial → CharacterCreation → Board ───────┤
                    │→ Settings ───────────────────────────────────│
                    │→ ShardShop ──────────────────────────────────│
                    │→ LoreCodex ──────────────────────────────────│
                    │→ (Continue) → Board ─────────────────────────│
                                                                   │
              Board → Event        (event node)                    │
              Board → Combat       (combat node)                   │
              Board → Landmark     (landmark node)                 │
              Board → Rest/Discovery/Trap (resolve in BoardScene)  │
                                                                   │
              Landmark → Combat → Landmark (epilogue) → Board      │
              Combat → Board (victory)                             │
              Combat → GameOver (defeat) → Board (checkpoint)      │
              Board → EndingScene (page 200)                       │
```

---

## 6. Data Flow

```
┌──────────┐   reads/writes    ┌────────────┐
│  Scenes   │ ←──────────────→ │  Zustand   │ ←→ localStorage
│  (Phaser) │   getState().X   │   Store    │   SaveManager
└────┬─────┘                  └────────────┘
     │ uses                            ↑
     ↓                                 │
┌──────────┐                 ┌─────────────────┐
│  Systems  │                 │  Data (content)  │
│  (logic)  │                 │  (pure data)     │
└──────────┘                 └─────────────────┘
```

Key principle: **Scenes and UI talk to the store directly.** Systems are framework-agnostic (no Phaser imports) so `smoketest.ts` can test them headlessly. Data files are pure constants/types.

---

## 7. Coding Conventions

### Naming
- **Files**: PascalCase for classes (`CombatEngine.ts`), camelCase for utilities (`checks.ts`)
- **Exports**: `export class CombatEngine` / `export function createButton` / `export const ENEMIES`
- **Constants**: UPPER_SNAKE_CASE (`POINT_BUY_TOTAL`, `MAX_LEVEL`, `TOTAL_NODES`)
- **Types/Interfaces**: PascalCase (`PlayerState`, `EventDef`, `StatBlock`)
- **IDs (events/enemies/items)**: snake_case (`'echo_skeleton'`, `'half_eaten_meal'`)
- **Scene keys**: Single-word string literals (`'Menu'`, `'Board'`, `'Combat'`)

### Imports
```ts
// Good — use aliases
import { GAME_WIDTH } from '@/config';
import { ENEMIES } from '@data/enemies';
import { useGameStore } from '@store/gameStore';
import { createButton } from '@ui/Button';
import { fadeToScene } from '@systems/sceneTransition';
import { audio } from '@placeholder/PlaceholderAudio';

// Acceptable — relative only within the same directory
import { FONT_SERIF } from './uiTheme';
```

### Type-only imports
```ts
import type { PlayerState, GameState } from '@data/types';
```

### No React
The project uses **no React**. Phaser scenes call `useGameStore.getState()` imperatively. There is no re-rendering — the store is a plain Zustand store, not a React hook context.

### Coding patterns
- Classes for stateful systems (`CombatEngine`, `SettingsManager`)
- Standalone functions for pure/logic systems (`checks.ts`, `BoardGenerator.ts`)
- Factory functions for Phaser UI components (`createButton()`, `createDialogBox()`)
- Scenes use `this.add.text()`, `this.add.image()`, `this.add.container()` etc. for all rendering
- `unused locals/parameters` warnings are suppressed in tsconfig — don't worry about them

### Data mutation
Scenes mutate store state directly (no immutability requirement):
```ts
const store = useGameStore.getState();
store.addXp(50);
store.persist();
```

---

## 8. Key Types (src/data/types.ts)

| Type | Description |
|------|-------------|
| `StatBlock` | `{ str, dex, con, int, wis, cha }` — all 1-10, sum ≤ 30 |
| `DerivedStats` | Computed: `maxHP, maxMP, atk, def, spd, dodge` |
| `PlayerState` | Full player: stats, derived, currentHP/MP, level, xp, skillPoints, skillsKnown, resonance, faction, equipment, inventory, flags, history, loreFragments, echoShards, gold, ... |
| `GameState` | Current run: nodes[], currentNodeIndex, currentPage, path[], rngSeed, checkpoint data, isRunActive, isDead, endingAchieved |
| `MetaState` | Persistent cross-run: echoShards, purchasedUnlocks[], totalRuns, bestRun, deathCount, endingsAchieved[], loreFragmentsSeen[] |
| `BoardNode` | `{ index, page, type, enemyIds?, landmarkId? }` |
| `EventDef` | `{ id, title, flavorText, choices[], pageRange, flags?, ... }` |
| `EventChoice` | `{ id, label, statCheck?, effect, ... }` |
| `EnemyDef` | `{ id, name, stats, derived, skills[], affinities, xpReward, act(), ... }` |
| `BossDef` | `{ id, name, phases (hp thresholds, takeTurn()), rewards, onDefeat, ... }` |
| `SkillDef` | `{ id, name, apCost, mpCost?, power, type, tags[], description }` |
| `ItemDef` | `{ id, name, type ('consumable'|'weapon'|'armour'|'focus'|'accessory'), stats?, description }` |
| `Equipment` | `{ weapon: string|null, armour: string|null, focus: string|null, accessory: string|null }` |
| `RunStats` | Summary: nodesVisited, enemiesKilled, bossesDefeated, levelReached, resonancePeak, echoShardsEarned, bestRun, etc. |
| `CombatSetup` | `{ player: CombatEntity, enemies: CombatEntity[], round: number, turnOrder: ... }` |
| `CombatSnapshot` | Combat state: entities, phase, logs, rewards |
| `DamageType` | `{ id, name, color, description }` |
| `StatusInstance` | `{ id, stacks, duration, source }` |

---

## 9. Config Constants (src/config.ts)

```ts
GAME_WIDTH = 1280
GAME_HEIGHT = 800
FONT_SERIF = 'Georgia, "Times New Roman", serif'
FONT_MONO = '"Courier New", monospace'
TOTAL_NODES = 200
PAGES = 20
NODES_PER_PAGE = 10
```

---

## 10. UI Theme (src/ui/uiTheme.ts)

```ts
PALETTE_HEX = { void: '#0b0d10', stone: '#16191d', stoneLight: '#22262c',
                bone: '#e8e2d4', boneMuted: '#9a9488', gold: '#c9a24b',
                goldBright: '#e9c876', danger: '#b0453f', ok: '#5c8a5c',
                player: '#7fb0c9' }

DAMAGE_TYPE_HEX = { slash: '#c0392b', pierce: '#d4ac0d', blunt: '#8b5a2b',
                    flame: '#e67e22', frost: '#5dade2', shock: '#9b59b6',
                    sacred: '#f5f0e1', shadow: '#7a7a86' }
```

---

## 11. Testing Strategy

**File**: `smoketest.ts` (project root)

Run via `npm run test` (uses `tsx` to execute TypeScript directly).

The smoke test is a headless integration test that:
- Generates a 200-node board and validates structure
- Runs a full combat vs `echo_skeleton` to victory
- Simulates all 5 boss fights (150 rounds each)
- Exercises every documented event and every choice
- Verifies ending evaluation logic
- Tests minor landmarks + lore fragment completeness
- Verifies event coverage per page/resonance tier
- Validates content roster counts (12 enemies, 25 skills, 30 items, 50 whispers)
- Tests skill distribution paths, whisper tier coverage, level-up thresholds
- Tests MP costs in combat, equipment stat bonuses, settings persistence
- Tests event chain flag filtering

**Important**: The smoke test imports systems directly via path aliases (not scenes). It doesn't run Phaser. This means:
- Systems (`src/systems/`) must never import from Phaser
- Data (`src/data/`) must be pure data/formulas
- Scenes (`src/scenes/`) and UI (`src/ui/`) are not tested by smoketest.ts
- To add a test for a new system, add an import + test block in `smoketest.ts`

---

## 12. Build Configuration

### Vite manualChunks (code splitting)
```
phaser → ['phaser']                    # Large vendor chunk
data   → all 12 src/data/*.ts          # Content data loaded on demand
systems → all 11 src/systems/*.ts      # Engine logic
```

### TypeScript strictness
```json
{ "strict": true, "noImplicitAny": true, "strictNullChecks": true,
  "noUnusedLocals": false, "noUnusedParameters": false }
```
Unused variable warnings are **off** — don't add `_` prefixes or remove unused imports.

---

## 13. Current Status (from PLAN_OVERHAUL.md)

### Completed (as of July 2026)
- ✅ Phase A: Board expansion (200 nodes), Level-Up system, Skill Tree, MP system, Equipment UI, Fog of War, Turn Order indicator
- ✅ Phase B: 12 event variants, auto-generated events, event chains, faction hostile consequences
- ✅ Phase C: Tutorial, Landmark cinematic, Resonance VFX, End-of-run stats, Page transition cards
- ✅ 27 deep audit bugs fixed (CombatEngine, EventEngine, gameStore, etc.)
- ✅ 18 UI/layout issues fixed (Button, scenes, HUD, etc.)
- ✅ D1: Build verification (tsc --noEmit passes)

### Remaining
- D2: Playthrough test (full run)
- D3: Playthrough test (death + checkpoint)
- D4: Edge case (0 HP, 0 MP)
- D5: Edge case (all factions hostile)
- D6: Edge case (level-up at last enemy)
- D7: Edge case (skill tree with 0 points)
- D8: Settings persistence test
- D9: Bug fix pass
- Settings expansion (§6.1 / C5)
- Checkpoint polish (§6.2 / C6)
- Content additions (§5.1, §5.2)

---

## 14. Common Operations

### Adding a new event
1. Add entry to `src/data/events.ts` with id, title, flavorText, choices, pageRange
2. Event is auto-picked by `EventEngine.pickEvent()` — no registration needed
3. If the event has unique flag/state requirements, add handling in `buildEventCtx()`

### Adding a new enemy
1. Add entry to `ENEMIES` in `src/data/enemies.ts` with stats, act() function, affinities
2. The enemy token `tok_<id>` is auto-generated in `PlaceholderTextures.ts` — add color to `enemyColors` map
3. Add to `enemiesForPage()` if it should appear on certain pages

### Adding a new skill
1. Add entry to `NAMED_SKILLS` in `src/data/skills.ts`
2. If it's a tree skill, add node to SKILL_TREES in `src/data/skillTree.ts`
3. Add to discoverable pool in `getDiscoverablePool()` if discoverable

### Adding a new item
1. Add entry to `ITEMS` in `src/data/items.ts`
2. If equipment, reference from `getEquipmentBonuses()` in `src/data/stats.ts`

### Replacing placeholder textures with real art
1. Create PNG in `public/assets/<key>.png`
2. In `src/scenes/PreloadScene.ts`, add `this.load.image('<key>', 'assets/<key>.png')` before `generatePlaceholderTextures(this)`
3. The placeholder system skips keys that already exist

### Replacing placeholder audio with real files
1. Create audio files (WAV/MP3/OGG) in `public/audio/`
2. Create a proper AudioManager that loads and plays them
3. Replace call sites: `audio.hit()` → `audioManager.play('sfx_hit')`
4. Ensure settings volume integration persists

---

## 15. Key Technical Notes

- **Phaser 3.70** supports 9-slice textures (`this.add.nineslice()`) — useful for stretchable UI panels
- **No React** — Zustand store is imported directly in non-React contexts. `create<GameStore>()` returns a vanilla store, not a React hook
- **Audio** uses Web Audio API directly (not Phaser's sound manager). `PlaceholderAudioEngine` creates `AudioContext` on demand
- **localStorage keys**: `hollow_beneath_save` (game data), `hollow_beneath_settings` (settings)
- **Seeded RNG**: `mulberry32(seed)` for reproducible board generation. Seed stored in `GameState.rngSeed`
- **No asset loading** happens at boot — `PreloadScene.create()` generates all textures procedurally
- **Board coordinates**: 200 nodes arranged in a winding path. Each has index 0-199, page 0-19
- **Resonance** is the central mechanic: earned through events/choices, scales enemies, unlocks whispers, gates certain encounters
- **Factions**: 4 tracked axes (Sable/Archive/Covenant/Caravan), range -50 to +50, affect shop prices (0.6x-1.5x) and event availability

---

## 16. Documentation Files (docs/)

| File | Purpose |
|------|---------|
| `docs/PLAN_OVERHAUL.md` | Full development plan, phases A-D, estimated times |
| `docs/CHANGELOG_CONTENT_PASS.md` | Complete record of every fix and addition |
| `docs/THE_HOLLOW_BENEATH_Art_Audio_Asset_Checklist.md` | Full art/audio asset checklist with priority tiers |
| `docs/ASSET_PLAN_ALIGNMENT.md` | Reconciliation between checklist and actual codebase state |
| `docs/ARTIST_ASSET_OVERVIEW.md` | One-pager for the artist — texture key → art mapping |
| `docs/ART_ASSET_CHECKLIST_DETAILED.md` | Production-ready per-key specs (size, format, art direction) |
| `docs/AGENTS.md` | This file — exhaustive codebase reference |
