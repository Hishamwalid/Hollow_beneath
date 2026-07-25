# THE HOLLOW BENEATH — Full Overhaul Plan
### Storytelling × Understandability × Fun

Based on comparison between current codebase and [`THE_HOLLOW_BENEATH_Improved_GDD_v2.md`](./THE_HOLLOW_BENEATH_Improved_GDD_v2.md).

---

## Table of Contents

1. [Structural Foundation](#1-structural-foundation)
   - [1.1 Node & Page Structure](#11-node--page-structure)
   - [1.2 Mini-Boss Encounters](#12-mini-boss-encounters)
2. [Character Systems](#2-character-systems)
   - [2.1 Level-Up System](#21-level-up-system)
   - [2.2 Full Skill Tree System](#22-full-skill-tree-system)
   - [2.3 MP System Activation](#23-mp-system-activation)
   - [2.4 Equipment Change UI](#24-equipment-change-ui)
3. [Narrative & Atmosphere](#3-narrative--atmosphere)
   - [3.1 Onboarding / Tutorial](#31-onboarding--tutorial)
   - [3.2 Cinematic Landmark Presentation](#32-cinematic-landmark-presentation)
   - [3.3 Resonance Visual Effects](#33-resonance-visual-effects)
   - [3.4 Event Chains (Multi-Node Stories)](#34-event-chains-multi-node-stories)
4. [Combat & Game Feel](#4-combat--game-feel)
   - [4.1 Turn Order Indicator](#41-turn-order-indicator)
   - [4.2 Faction Hostile Consequences](#42-faction-hostile-consequences)
   - [4.3 End-of-Run Stats Screen](#43-end-of-run-stats-screen)
5. [Content Additions](#5-content-additions)
   - [5.1 12 Renamed Event Variants](#51-12-renamed-event-variants)
   - [5.2 Auto-Generated Events for Node Variety](#52-auto-generated-events-for-node-variety)
6. [Settings & Quality of Life](#6-settings--quality-of-life)
   - [6.1 Settings Expansion](#61-settings-expansion)
   - [6.2 Checkpoint Polish](#62-checkpoint-polish)
7. [Implementation Order](#7-implementation-order)
   - [Phase A — Core Systems](#phase-a--core-systems)
   - [Phase B — Content](#phase-b--content)
   - [Phase C — Polish](#phase-c--polish)
   - [Phase D — Integration & Test](#phase-d--integration--test)
8. [Open Questions](#8-open-questions)

---

## 1. Structural Foundation

### 1.1 Node & Page Structure

**200 nodes, 20 pages of 10 nodes each.**

| Page | Nodes | Content | Type |
|------|-------|---------|------|
| 1 | 1-10 | Capture point at 10 | Minor Landmark |
| 2 | 11-20 | **Mini-boss** at 20 | ★ Elite Fight |
| 3 | 21-30 | Capture point at 30 | Minor Landmark |
| 4 | 31-40 | **Major Boss** at 40 (Sentinel) | ★ Boss + Checkpoint |
| 5 | 41-50 | Capture point at 50 | Minor Landmark |
| 6 | 51-60 | **Mini-boss** at 60 | ★ Elite Fight |
| 7 | 61-70 | Capture point at 70 | Minor Landmark |
| 8 | 71-80 | **Major Boss** at 80 (Patriarch) | ★ Boss + Checkpoint |
| 9 | 81-90 | Capture point at 90 | Minor Landmark |
| 10 | 91-100 | **Mini-boss** at 100 | ★ Elite Fight |
| 11 | 101-110 | Capture point at 110 | Minor Landmark |
| 12 | 111-120 | **Major Boss** at 120 (Chorus) | ★ Boss + Checkpoint |
| 13 | 121-130 | Capture point at 130 | Minor Landmark |
| 14 | 131-140 | **Mini-boss** at 140 | ★ Elite Fight |
| 15 | 141-150 | Capture point at 150 | Minor Landmark |
| 16 | 151-160 | **Major Boss** at 160 (Fossil King) | ★ Boss + Checkpoint |
| 17 | 161-170 | Capture point at 170 | Minor Landmark |
| 18 | 171-180 | **Mini-boss** at 180 | ★ Elite Fight |
| 19 | 181-190 | Capture point at 190 | Minor Landmark |
| 20 | 191-200 | **Major Boss** at 200 (Reflection) | ★ Boss + Ending |

#### Each Chapter

Each chapter (the 40 nodes between major bosses) contains:
- ~22 free landings (events / combat / rest / discovery / trap)
- 2 capture points (minor landmarks with lore fragments)
- 1 mini-boss (elite enemy encounter)

#### Movement

**1d6** (range 1-6, average 3.5).

- Replaces current `1d4+1` (range 2-5, average 3.5)
- Same average speed — no pacing change
- Simpler to understand and explain
- More exciting variance (rolling a 6 feels great, rolling a 1 is a setback)
- Implemented in `src/systems/checks.ts` by changing `rollMovement()`

#### Checkpoints

At major boss nodes: **40, 80, 120, 160**. Auto-save on page 200 completion.

#### Fog of War

**4 nodes visible ahead.** The player sees icons of the next 4 reachable nodes. All other nodes are dark silhouettes with no type icon visible. At Resonance ≥ 50 (Unmoored), the player sees 5 nodes ahead instead of 4.

- Implemented in `src/scenes/BoardScene.ts` — the `drawBoard()` method filters visible nodes based on `currentNodeIndex + visibilityRange`
- The visibility range is `4 + (resonanceTier === 'unmoored' || resonanceTier === 'transcendent' ? 1 : 0)`
- Capture points and landmarks are always visible (they are forced stops and the player needs to know they're coming)

#### Board Changes

The current board draws a serpentine grid of all 100 nodes. For 200 nodes:
- 20 columns instead of 10 (wider board)
- Or keep 10 columns but double the rows (longer board, more scrolling)
- **Decision:** 10 columns × 20 rows, serpentine layout. The board scrolls naturally as the player progresses.

**Files to change:**
- `src/systems/BoardGenerator.ts` — increase to 200 nodes, add mini-boss indices and scaling multipliers
- `src/scenes/BoardScene.ts` — fog of war, extra rows, mini-boss node icons, checkpoint visual
- `src/data/types.ts` — add `MINI_BOSS_INDICES`, update `LANDMARK_INDICES`
- `src/config.ts` — add `TOTAL_NODES = 200`, `PAGES = 20`

---

### 1.2 Mini-Boss Encounters

5 mini-bosses at forced indices: **20, 60, 100, 140, 180**.

Each is an upgraded version of a regular enemy with the following template:

| Mini-Boss | Base Enemy | HP Mult | ATK Mult | Special Ability |
|-----------|-----------|---------|----------|-----------------|
| Warden of Ash | echo_skeleton | 2.0× | 1.5× | **"War Cry"** — buffs own ATK by 30% for 2 turns. Activates on turn 1. |
| Archive Purifier | venn_custodian | 1.8× | 1.4× | **"Reset"** — clears all player buffs and removes 1 stack of each DoT from self. Triggers at 50% HP. |
| Ash-Touched Speaker | ash_seer | 1.8× | 1.3× | **"Echo"** — copies the last skill the player used and uses it against them at 0.7× power. Triggers every 2 turns. |
| Sable Justicar | sable_inquisitor | 1.6× | 1.4× | **"Condemn"** — applies Seal Mind + Weakness for 2 turns. Opens combat with this. |
| Dust-Road Khan | dust_road_raider | 2.0× | 1.5× | **"Ambush"** — starts combat with 2 Momentum already gained. No other special AI. |

#### Rewards

- **XP:** 1.5× the base enemy's XP value
- **Gold:** 2× the base enemy's gold value
- **Item:** Guaranteed drop from a mini-boss reward table (higher-tier versions of regular consumables)

#### Implementation

1. **New file:** `src/data/miniBosses.ts`

```typescript
export interface MiniBossDef {
  id: string;
  baseEnemyId: string;
  hpMultiplier: number;
  atkMultiplier: number;
  specialAbility: string;  // references a new AI handler
  specialAbilityTrigger: 'turn1' | 'turn2' | 'hp50' | 'every2';
}

export const MINI_BOSSES: MiniBossDef[] = [
  { id: 'warden_of_ash', baseEnemyId: 'echo_skeleton', hpMultiplier: 2.0, atkMultiplier: 1.5, specialAbility: 'war_cry', specialAbilityTrigger: 'turn1' },
  { id: 'archive_purifier', baseEnemyId: 'venn_custodian', hpMultiplier: 1.8, atkMultiplier: 1.4, specialAbility: 'reset', specialAbilityTrigger: 'hp50' },
  { id: 'ash_touched_speaker', baseEnemyId: 'ash_seer', hpMultiplier: 1.8, atkMultiplier: 1.3, specialAbility: 'echo', specialAbilityTrigger: 'every2' },
  { id: 'sable_justicar', baseEnemyId: 'sable_inquisitor', hpMultiplier: 1.6, atkMultiplier: 1.4, specialAbility: 'condemn', specialAbilityTrigger: 'turn1' },
  { id: 'dust_road_khan', baseEnemyId: 'dust_road_raider', hpMultiplier: 2.0, atkMultiplier: 1.5, specialAbility: 'ambush', specialAbilityTrigger: 'turn1' },
];
```

2. **Modify** `src/systems/CombatEngine.ts`:
   - Accept a `isMiniBoss` flag in enemy config
   - Apply stat multipliers at creation
   - Add AI handlers for each special ability

3. **Modify** `src/systems/BoardGenerator.ts`:
   - Place mini-boss nodes at indices 20, 60, 100, 140, 180
   - Assign subtype as mini-boss id

4. **Modify** `src/scenes/CombatScene.ts`:
   - Show a different label for mini-boss encounters ("Elite" badge)
   - Increase particle effects for mini-boss kills
   - Award bonus XP and gold after victory

---

## 2. Character Systems

### 2.1 Level-Up System

**Problem:** XP is tracked but never used. `player.level` stays 1 permanently. No sense of progression.

**Goal:** Make every fight, discovery, and event reward feel like incremental progress toward a meaningful choice.

#### XP Thresholds

Flat XP curve that's easy to understand:

| Level | XP Needed | Cumulative | Points Earned (Total) |
|-------|-----------|------------|----------------------|
| 1 | 0 | 0 | 0 |
| 2 | 80 | 80 | 1 |
| 3 | 100 | 180 | 2 |
| 4 | 120 | 300 | 3 |
| 5 | 150 | 450 | 4 |
| 6 | 180 | 630 | 5 |
| 7 | 220 | 850 | 6 |
| 8 | 270 | 1,120 | 7 |
| 9 | 330 | 1,450 | 8 |
| 10 | 400 | 1,850 | 9 |
| 11 | 480 | 2,330 | 10 |
| 12 | 570 | 2,900 | 11 |
| 13 | 670 | 3,570 | 12 |
| 14 | 780 | 4,350 | 13 |
| 15 | 900 | 5,250 | 14 |

**Formula:** `xpForLevel(n) = round(50 + 10 * (n-1) + 0.5 * (n-1)^2)` for n ≥ 2.

#### Estimated XP Per Run

Based on 200 nodes, 1d6 movement, ~57 landings:

| Source | Count | XP Each | Total |
|--------|-------|---------|-------|
| Regular combat (~7) | 7 | 20 | 140 |
| Major bosses (5) | 5 | 40 | 200 |
| Mini-bosses (5) | 5 | 30 | 150 |
| Event XP rewards | ~10 | 15 | 150 |
| Discovery rewards | ~5 | 20 | 100 |
| Traps survived | ~3 | 10 | 30 |
| **Estimated Total** | | | **~770** |

**Expected level range per full run: Level 6-8.** Enough to fill 1-2 skill trees or spread points across 3-4 trees partially.

#### Level-Up Flow

1. XP is awarded (after combat, event, discovery).
2. `gameStore.addXp(amount)` is called.
3. If cumulative XP crosses a threshold, `gameStore.triggerLevelUp()` fires.
4. A **level-up modal** appears with:

```
╔══════════════════════════════╗
║        LEVEL 4!              ║
║   "You feel the Loom's       ║
║    attention sharpen..."     ║
║                              ║
║   Choose your reward:        ║
║                              ║
║  ┌──────────────────────┐    ║
║  │  Stat Point           │    ║
║  │  +1 to any stat       │    ║
║  │  Recalculate derived  │    ║
║  └──────────────────────┘    ║
║  ┌──────────────────────┐    ║
║  │  Skill Point          │    ║
║  │  Unlock a skill in    │    ║
║  │  the skill tree       │    ║
║  └──────────────────────┘    ║
╚══════════════════════════════╝
```

**Option A — Stat Point:** Opens a sub-modal where the player picks one stat (STR/DEX/CON/INT/WILL) to increase by 1. Derived stats recalculate immediately. The player sees the stat change previewed.

- STR +1 → ATK +2
- DEX +1 → Speed +2, Accuracy +2%, Dodge +2%
- CON +1 → MaxHP +10, DEF +2
- INT +1 → MATK +2, MDEF +2
- WILL +1 → MaxMP +6, MDEF +1

**Option B — Skill Point:** Grants 1 skill point. The player can then open the Skill Tree scene to spend it. A notification badge appears on the "Skills" button in BoardScene if unspent points exist.

#### GameStore Changes

Add to `PlayerState`:
```typescript
level: number;         // starts at 1
xp: number;            // current run XP
skillPoints: number;   // unspent skill points (earned from level-ups)
```

Add actions:
```typescript
addXp(amount: number): void;
triggerLevelUp(): void;
awardStatPoint(stat: keyof StatBlock): void;
awardSkillPoint(): void;
```

#### XP Display

- BoardScene stat panel: show `Level X` with a small XP bar underneath
- CombatScene stat panel: show level in the stat display
- XP bar color: gold, fills progressively toward next level

#### Files to Change

- `src/data/types.ts` — add xp, level, skillPoints to PlayerState
- `src/store/gameStore.ts` — add `addXp`, `triggerLevelUp`, `awardStatPoint`, `awardSkillPoint`
- `src/systems/LevelSystem.ts` — **new file** for XP threshold table and level-up logic
- `src/ui/LevelUpModal.ts` — **new file** for the level-up choice UI
- `src/ui/StatPanel.ts` — show level and XP bar
- `src/systems/CombatEngine.ts` — award XP on victory
- `src/data/events.ts` — event scripts that award XP
- `src/data/minorLandmarks.ts` — discovery nodes that award XP

---

### 2.2 Full Skill Tree System

**Problem:** Skills are handed out randomly from events and boss rewards. Players cannot plan a build or make trade-off decisions.

**Goal:** Give players agency over their character's abilities through a spendable skill point system with clear prerequisites.

#### Tree Structure: 5 Core Trees × 3 Tiers

```
WARRIOR                  SCHOLAR                    RANGER
┌──────────────────┐    ┌──────────────────┐       ┌──────────────────┐
│ Iron Resolve      │    │ Resonant Study    │       │ Quickstep         │
│ Guard blocks 65%  │    │ Resonance costs   │       │ +5 Speed          │
│ Tier 1  •  1 pt   │    │ 1 AP instead of 2 │       │ Tier 1  •  1 pt   │
├──────────────────┤    ├──────────────────┤       ├──────────────────┤
│         ↓         │    │         ↓         │       │         ↓         │
│ Reckless Swing    │    │ Cross-Reference   │       │ Opening Strike    │
│ 1 AP, 1.8× Slash  │    │ Analyze costs 0 AP│       │ First attack in   │
│ costs 8% HP       │    │ Tier 2  •  2 pt   │       │ combat deals +20% │
│ Tier 2  •  2 pt   │    ├──────────────────┤       │ Tier 2  •  2 pt   │
├──────────────────┤    │         ↓         │       ├──────────────────┤
│         ↓         │    │ Overwritten Truth │       │         ↓         │
│ Second Wind       │    │ 2 AP, 1.7× Shock, │       │ Hunter's Mark     │
│ Auto-heal 25% HP  │    │ INT-scaled magic  │       │ 1 AP, cannot miss │
│ when below 25% HP │    │ Tier 3  •  3 pt   │       │ 1.3× Pierce       │
│ Tier 3  •  3 pt   │    └──────────────────┘       │ MP cost: 3        │
└──────────────────┘                                 │ Tier 3  •  3 pt   │
                                                     └──────────────────┘

GUARDIAN                 SHADOW
┌──────────────────┐    ┌──────────────────┐
│ Bulwark Stance    │    │ Veil Step         │
│ +15% DEF passive  │    │ 1 AP, auto-dodge  │
│ Tier 1  •  1 pt   │    │ next attack       │
├──────────────────┤    │ Tier 1  •  1 pt   │
│         ↓         │    ├──────────────────┤
│ Retaliation       │    │         ↓         │
│ When guarding,    │    │ Parting Words     │
│ reflect 20% of    │    │ Shadow damage +40%│
│ blocked damage    │    │ vs <30% HP targets│
│ Tier 2  •  2 pt   │    │ Tier 2  •  2 pt   │
├──────────────────┤    ├──────────────────┤
│         ↓         │    │         ↓         │
│ Unshakeable       │    │ Borrowed Time     │
│ 50% chance to     │    │ +1 AP on round 1  │
│ resist control    │    │ Tier 3  •  3 pt   │
│ status effects    │    └──────────────────┘
│ Tier 3  •  3 pt   │
└──────────────────┘
```

#### Cost Structure

| Tier | Cost (skill points) | Prerequisite |
|------|--------------------|-------------|
| 1 | 1 | None |
| 2 | 2 | Tier 1 purchased in same tree |
| 3 | 3 | Tier 2 purchased in same tree |

**Total per tree:** 6 points to max.
**All 5 trees maxed:** 30 points (not achievable in one run — typically reach 6-8 points).

#### Skill Sources

| Source | Count | How |
|--------|-------|-----|
| Skill tree purchases | 15 (5 trees × 3) | Spend skill points |
| Character creation | 1 preset skill | Auto-awarded when picking a build |
| Universal | 4 | Always available (Chorus Step, Unfinished Sentence, Steady Hands, Deep Breath) |
| Boss rewards | 6 | Loom-Touched, Martyr's Flame, Sealing Strike, Chorus Echo, Librarian's Eye, Archival Insight |
| **Total available** | **26** | |

#### Skill Tree UI

**New scene:** `SkillTreeScene` (accessible from BoardScene via a "Skills" button labeled with unspent point count).

**Layout:**
- 5 vertical columns, evenly spaced across the screen
- Each column has 3 tier nodes connected by downward arrows
- Column headers show tree name (Warrior, Scholar, etc.)
- Below the column: total points invested in that tree

**Node states:**
| State | Visual |
|-------|--------|
| **Locked** | Gray square, lock icon overlay, cost hidden |
| **Available (can afford)** | Dimmed color, cost shown ("1 pt"), pulsing border |
| **Available (cannot afford)** | Dimmed color, cost shown ("2 pt"), static, no pulse |
| **Purchased** | Full color, checkmark overlay, connected to next tier |
| **Maxed (Tier 3)** | Full color+gild border, "MAX" label |

**Interaction:**
- Hover on any available node: tooltip shows skill name, description, AP cost, damage type, MP cost (if any)
- Click on an affordable node: purchase confirmation ("Buy [Skill Name] for [N] points?")
- Click on a purchased node: brief re-read of skill description
- "Back" button returns to BoardScene

**After purchase:** The new skill is immediately added to `player.skillsKnown` and appears in the combat action bar on the next turn.

#### File Changes

- **New:** `src/scenes/SkillTreeScene.ts` — full scene
- **New:** `src/data/skillTree.ts` — data structure defining trees, tiers, skill IDs

```typescript
export interface SkillTreeNode {
  id: string;           // matches NAMED_SKILLS key
  tier: 1 | 2 | 3;
  cost: number;
}

export interface SkillTreeDef {
  id: string;
  name: string;
  nodes: SkillTreeNode[];
}

export const SKILL_TREES: SkillTreeDef[] = [
  { id: 'warrior', name: 'Warrior', nodes: [
    { id: 'iron_resolve', tier: 1, cost: 1 },
    { id: 'reckless_swing', tier: 2, cost: 2 },
    { id: 'second_wind', tier: 3, cost: 3 },
  ]},
  // ... same for scholar, ranger, guardian, shadow
];
```

- **Modify:** `src/store/gameStore.ts` — add `player.skillPoints`, `player.skillTreePurchases: Record<string, number>` (tiers bought per tree), action `purchaseSkillTreeTier(treeId)`
- **Modify:** `src/scenes/BoardScene.ts` — add "Skills" button
- **Modify:** `src/data/types.ts` — add skill tree fields to PlayerState
- **Modify:** `src/data/skills.ts` — ensure all tree skills referenced correctly

---

### 2.3 MP System Activation

**Problem:** MP is displayed in StatPanel, `clarity` momentum restores it, but **no skill consumes MP**. The entire resource is decorative. The WILL stat is meaningless.

**Goal:** Create a meaningful second resource axis that impacts build decisions and adds depth to resource management.

#### Skills That Cost MP

| Skill | MP Cost | Tree Tier | Rationale |
|-------|---------|-----------|-----------|
| Resonance Ability | 10 MP | — (universal) | Big magical ability, should compete with other MP uses |
| Overwritten Truth | 6 MP | Scholar T3 | Scholar capstone — magic overload should cost |
| Martyr's Flame | 8 MP | Boss reward | Sacred AoE, already costs HP — add MP to limit spam |
| Hunter's Mark | 3 MP | Ranger T3 | Guaranteed hit is powerful — small MP gate |
| Veil Step | 4 MP | Shadow T1 | Auto-dodge is strong — small cost prevents free use every turn |

**Total skills with MP cost:** 5 out of 26 (approximately 20% of skills).

#### Implementation

1. **Add to `SkillDef` in `types.ts`:**

```typescript
export interface SkillDef {
  id: string;
  name: string;
  apCost: number;
  mpCost?: number;  // NEW — optional, default 0
  description: string;
  damageType?: DamageType;
  // ... existing fields
}
```

2. **Set values in `skills.ts`:**

```typescript
overwritten_truth: { ...existing, mpCost: 6 },
martyr_flame: { ...existing, mpCost: 8 },
hunters_mark: { ...existing, mpCost: 3 },
veil_step: { ...existing, mpCost: 4 },
```

The Resonance Ability already exists as a separate action type — add its MP check in `CombatEngine.ts`.

3. **CombatEngine changes** (`src/systems/CombatEngine.ts`):

In `canUseSkill(skillId)`, add:
```typescript
const sk = NAMED_SKILLS[skillId];
if (sk?.mpCost && this.player.currentMP < sk.mpCost) {
  return { allowed: false, reason: `Not enough MP (need ${sk.mpCost})` };
}
```

In `useSkill(skillId, targetKey)`, deduct MP:
```typescript
const sk = NAMED_SKILLS[skillId];
if (sk?.mpCost) {
  this.player.currentMP = Math.max(0, this.player.currentMP - sk.mpCost);
}
```

Same for `resonanceAbility`:
```typescript
if (this.player.currentMP < 10) {
  // Cannot use — no MP
  return this.snapshot();
}
this.player.currentMP -= 10;
```

4. **Action Bar Display** (`src/ui/CombatHUD.ts`):

In the skill tooltip, add MP cost line:
```typescript
const mpCostInfo = skill.mpCost ? ` | MP: ${skill.mpCost}` : '';
tooltip.setText(`${skill.description}${mpCostInfo}`);
```

Gray out skill button if player doesn't have enough MP (in addition to AP check).

5. **Rest Nodes** (`src/scenes/BoardScene.ts`):

Current: rest heals 25% HP (50% with flag). Add: rest restores 30% MP.
```typescript
player.currentMP = Math.min(player.derived.maxMP, player.currentMP + Math.round(player.derived.maxMP * 0.3));
```

6. **Event rewards** — some events can restore or drain MP as part of their effects.

#### Impact

- WILL stat becomes directly useful (increases maxMP, which gates access to powerful skills)
- Players must choose between using MP for powerful skills or saving it
- `clarity` momentum choice becomes competitive with the other options (restore 30% maxMP)
- Scholar and Shadow builds naturally want high WILL
- Warrior/Guardian builds can ignore MP entirely (they don't use those skills)

---

### 2.4 Equipment Change UI

**Problem:** The `InventoryScene` is read-only. Items found during the run (caravan knife, fossil crown, etc.) can never be equipped. Equipment stat bonuses are only applied at character creation.

**Goal:** Let players swap equipment mid-run, with immediate stat recalculation.

#### InventoryScene Rework

Current layout: simple text list of equipped items + inventory.
New layout: two-panel design.

```
╔═══════════════════════════════════════════════╗
║                  INVENTORY                     ║
╠═══════════════════════════════════════════════╣
║  GOLD:  142                                   ║
╠═══════════════════════════════════════════════╣
║  EQUIPPED                     INVENTORY       ║
║  ┌─────────────────────┐     ┌──────────────┐ ║
║  │ Weapon: Rusty Dagger│     │ Caravan Knife│ ║
║  │  ATK: +2            │     │  ATK: +3     │ ║
║  │                     │     │  [Equip]     │ ║
║  ├─────────────────────┤     ├──────────────┤ ║
║  │ Armour: Leather Vest│     │ Ration x2    │ ║
║  │  DEF: +1            │     │  Heal 25% HP │ ║
║  │                     │     │  [Use]       │ ║
║  ├─────────────────────┤     ├──────────────┤ ║
║  │ Focus: Cracked Lens │     │ Bandage x1   │ ║
║  │  MATK: +1           │     │  Cure Bleed  │ ║
║  │                     │     │  [Use]       │ ║
║  ├─────────────────────┤     ├──────────────┤ ║
║  │ Accessory: (empty)  │     │ Blank Book   │ ║
║  │                     │     │  MDEF: +5    │ ║
║  │  [Unequip]          │     │  [Equip]     │ ║
║  └─────────────────────┘     └──────────────┘ ║
╠═══════════════════════════════════════════════╣
║           [Back to Board]                     ║
╚═══════════════════════════════════════════════╝
```

#### Equip Flow

1. Player clicks **[Equip]** on an inventory item.
2. Item is placed in the correct slot (weapon → weapon slot, etc.).
3. Previously equipped item in that slot moves to inventory.
4. `recalculateDerivedStats(player)` is called immediately.
5. UI refreshes — stat changes are visible.
6. A confirmation sound plays.

#### Unequip Flow

1. Player clicks **[Unequip]** on an equipped item.
2. Item moves to inventory, slot becomes empty.
3. `recalculateDerivedStats(player)` runs with no bonus for that slot.
4. UI refreshes.

#### Stat Recalculation Function

In `src/data/stats.ts`:

```typescript
export function recalculateDerivedStats(player: PlayerState): void {
  const bonuses = getEquipmentBonuses(player.equipment);
  const newDerived = computeDerivedStats(player.stats, bonuses);
  
  // Clamp current HP/MP to new maximums
  const oldHP = player.currentHP;
  const oldMP = player.currentMP;
  
  player.derived = newDerived;
  player.currentHP = Math.min(oldHP, newDerived.maxHP);
  player.currentMP = Math.min(oldMP, newDerived.maxMP);
}
```

#### Item Kind to Slot Mapping

In `src/data/types.ts`:

```typescript
export type ItemKind = 'consumable' | 'weapon' | 'armour' | 'focus' | 'accessory' | 'material';
```

```typescript
export function slotForKind(kind: ItemKind): EquipmentSlot | null {
  switch (kind) {
    case 'weapon': return 'weapon';
    case 'armour': return 'armour';
    case 'focus': return 'focus';
    case 'accessory': return 'accessory';
    default: return null;
  }
}
```

#### Files to Change

- **Modify:** `src/scenes/InventoryScene.ts` — full rewrite with equip/unequip interaction
- **Modify:** `src/data/stats.ts` — add `recalculateDerivedStats()`, `getEquipmentBonuses()`
- **Modify:** `src/data/types.ts` — add `EquipmentSlot` type if not already present
- **Verify:** `src/data/items.ts` — ensure all items have correct `kind` field

---

## 3. Narrative & Atmosphere

### 3.1 Onboarding / Tutorial

**Problem:** No tutorial exists. New players face a blank menu screen with no instructions. No explanation of movement, combat, or the narrative goal.

**Goal:** 3-Minute Promise — within 180 seconds of starting, the player knows who they are, what they're doing, and why they should care.

#### Tutorial Flow (Auto-Shown on First Run)

A dedicated `TutorialScene` with 5 sequential screens:

**SCREEN 1 — "Who You Are"**
```
╔═══════════════════════════════════════════════╗
║    [Lyra token centered, large]               ║
║                                               ║
║  "You are Lyra Vane. A linguist. You survived ║
║   an expedition that drove thirty experts to  ║
║   murder each other. Now you hear the static  ║
║   between words."                             ║
║                                               ║
║              [Continue →]                     ║
╚═══════════════════════════════════════════════╝
```

**SCREEN 2 — "What You're Doing"**
```
╔═══════════════════════════════════════════════╗
║  "Beneath the world, something ancient reads  ║
║   minds. It has consumed entire civilizations ║
║   looking for one it cannot finish.           ║
║                                               ║
║   That mind is yours."                        ║
║                                               ║
║  [Show page ladder: 200 nodes, 20 pages]     ║
║  "Descend 200 nodes. Reach the chamber at     ║
║   the bottom. Find out why you are the one    ║
║   who cannot be read."                        ║
║              [Continue →]                     ║
╚═══════════════════════════════════════════════╝
```

**SCREEN 3 — "How to Move"**
```
╔═══════════════════════════════════════════════╗
║  [Show mock board with 4 visible nodes]       ║
║                                               ║
║  "Roll a six-sided die. Move forward that     ║
║   many nodes. You can see the next 4 nodes —  ║
║   plan your path wisely."                     ║
║                                               ║
║  Icon legend:                                 ║
║   ⚔ Combat   ? Event   ✦ Discovery           ║
║   + Rest     ! Trap    ★ Landmark/Boss       ║
║                                               ║
║  "You must stop at every Landmark and         ║
║   Capture Point. You cannot skip history."    ║
║              [Continue →]                     ║
╚═══════════════════════════════════════════════╝
```

**SCREEN 4 — "How to Fight"**
```
╔═══════════════════════════════════════════════╗
║  [Show mock action bar with buttons]          ║
║                                               ║
║  "You have 2 Action Points (AP) per turn.     ║
║   Attack costs 1 AP. Skills cost 1-2 AP.      ║
║   Guard halves incoming damage for the round."║
║                                               ║
║  "Hit enemy weaknesses to build Momentum.     ║
║   At 3 Momentum, choose a bonus: extra turn,  ║
║   heal, restore MP, free skill, or big hit."  ║
║                                               ║
║  "If you die, you return to the last          ║
║   checkpoint with 50% HP/MP."                 ║
║              [Continue →]                     ║
╚═══════════════════════════════════════════════╝
```

**SCREEN 5 — "Your Goal"**
```
╔═══════════════════════════════════════════════╗
║  "Five major bosses guard the truth:          ║
║                                               ║
║   1. The Argent Sentinel   (Page 4)           ║
║   2. The Sable Patriarch   (Page 8)           ║
║   3. The Merged Chorus     (Page 12)           ║
║   4. The Fossil King       (Page 16)           ║
║   5. The Final Reflection  (Page 20)           ║
║                                               ║
║  Each holds a piece of the Venn's story.      ║
║  Defeat all five. Reach the bottom.           ║
║  The Loom will ask you a question.            ║
║  Your entire run has been your answer."       ║
║                                               ║
║           [Begin Expedition →]                ║
╚═══════════════════════════════════════════════╝
```

#### Implementation Details

- Each screen is a separate `show()` step in the TutorialScene
- Text reveals character-by-character (reuse DialogBox typewriter)
- [Continue] appears after text is fully revealed
- Click anywhere to advance (like dialog skip)
- After screen 5: `fadeToScene(this, 'CharacterCreation')`

#### When It Shows

```typescript
// In BoardScene or MenuScene, on first run:
if (meta.totalRuns === 0) {
  // Show tutorial before character creation
  fadeToScene(this, 'Tutorial');
}
```

#### Additional Tutorial Hooks

**First 5 free landings** (page 1 only): optional contextual tooltips:
- First Event node: "This is an Event node. Your choices affect factions and Resonance."
- First Combat node: "This is a Combat node. Defeat the enemy to proceed."
- First Discovery node: "This is a Discovery node. Search for items and lore."
- First Rest node: "Restore HP and MP at Rest nodes."

These are one-time tooltips that appear as small floating labels on the board, automatically dismissing after 3 seconds.

#### Files to Create/Change

- **New:** `src/scenes/TutorialScene.ts` — 5-screen tutorial
- **New:** `src/data/tutorialText.ts` — all tutorial text strings (for i18n readiness)
- **Modify:** `src/scenes/MenuScene.ts` — add "How to Play" button
- **Modify:** `src/scenes/BoardScene.ts` — first-run tooltips for first 5 nodes
- **Modify:** `src/store/gameStore.ts` — first-run detection (already available via `meta.totalRuns`)

---

### 3.2 Cinematic Landmark Presentation

**Problem:** Landmark scenes (boss encounters) use the same dialog boxes as regular events. There's no visual distinction between a random campfire event and facing the Argent Sentinel.

**Goal:** Make bosses feel like bosses — memorable, weighty, cinematic.

#### Three-Stage Enhancement

**Stage 1 — Approach** (when entering LandmarkScene):

Current: A dialog box with approach text.
Enhanced:

1. **Full-screen fade to black** (300ms)
2. **Boss name reveal:** Large gold text (48px) appears letter-by-letter with a typewriter sound
   ```
   THE ARGENT SENTINEL
   ```
3. **Venn name subtitle:** Smaller text fades in below
   ```
   "Keth-Vor" — The First Door
   ```
4. **Theme line:** Brief italic text fades in
   ```
   The danger of curiosity. The first door was not meant
   to keep people out. It was meant to keep something in.
   ```
5. **2-second hold** with a subtle screen pulse (boss color tint)
6. **Fade to approach dialog** (the existing choice text)

**Stage 2 — Confrontation** (transitioning to CombatScene):

Current: Simple `fadeToScene(this, 'Combat', data)`.
Enhanced:

1. **Screen shake** (200ms, moderate intensity)
2. **Red vignette flash** (300ms)
3. **Combat begins** with boss displayed prominently
4. Boss token has a pulsing gold border during the fight

**Stage 3 — Aftermath** (after boss defeat):

Current: Dialog box with epilogue text + reward list.
Enhanced:

1. **Particle celebration:** Mix of gold and faction-colored particles rain down for 1 second
2. **Reward cards:** Each reward appears one at a time with a delay:
   - "+20 Archive Influence" slides in from left
   - "+5 Resonance" slides in from right
   - "Skill: Librarian's Eye" slides up from bottom
   - "Lore Fragment: The Sentinel's Confession" fades in center
3. **"Continue" button** appears after all rewards have been shown (2-second total delay)

#### Page Transition Cards

In addition to landmark moments, add transition cards when advancing to a new major chapter. These appear **once per chapter** (after each major boss defeat, when returning to the board for the next page range):

```typescript
const CHAPTER_NAMES: Record<number, string> = {
  1: 'The Archive Opens',
  2: 'The Sable March',
  3: 'The Chorus Calls',
  4: 'The Fossil Throne',
  5: 'The Final Descent',
};
```

Implementation:
- In `BoardScene`, when `currentPage` crosses a chapter boundary (pages 1, 5, 9, 13, 17), show a full-screen card
- Card shows: "CHAPTER [N]" in gold, "[Chapter Name]" in bone, stays for 2.5 seconds
- Fades out to reveal the board
- Uses a simple `add rectangle + add text + tween` — no asset needed

#### Files to Change

- **Modify:** `src/scenes/LandmarkScene.ts` — approach card, reward animations
- **Modify:** `src/scenes/CombatScene.ts` — entry shake + vignette for bosses
- **Modify:** `src/scenes/BoardScene.ts` — chapter transition cards
- **Modify:** `src/data/bosses.ts` — add theme line text per boss

---

### 3.3 Resonance Visual Effects

**Problem:** Resonance tiers exist (Stable/Awakened/Unmoored/Transcendent) with mechanical effects, but visual feedback is minimal — just a colored rectangle overlay.

**Goal:** Make Resonance changes viscerally felt. The UI should look different at 80 Resonance than at 10.

#### Effects by Tier

**Stable (0-24):** Normal UI. No effects.

**Awakened (25-49):**
- **Chromatic shift:** All text objects in the UI get a subtle RGB split (duplicate text offset by 1px in red and blue). Applied via a scene-wide tween or post-processing.
  - Implementation: In `applyResonanceTint()`, add a `Camera.setPostPipeline()` or manual text duplicate offset.
  - Alternative (simpler): Add a thin 1px overlay rectangle with alternating red/blue stripes at very low opacity (alpha 0.08). Looks like a CRT slight misalignment.
- **Node pulse:** Board nodes occasionally pulse with a faint blue hue (random nodes, random timing).

**Unmoored (50-74):**
- **UI jitter:** Stat panel, action bar, and other UI containers get a subtle random position tween (2-3px offset, random direction, every 5-8 seconds).
  ```
  scene.tweens.add({
    targets: container,
    x: container.x + Phaser.Math.Between(-3, 3),
    y: container.y + Phaser.Math.Between(-2, 2),
    duration: 50,
    yoyo: true,
    onComplete: () => container.setPosition(originalX, originalY),
  });
  ```
- **Screen pulse:** A dark vignette overlay pulses slowly every 10 seconds (alpha 0 → 0.15 → 0, 2-second cycle).
- **Whisper frequency increases** from 18% to 30% chance per trigger.

**Transcendent (75-100):**
- **Text glitch:** Dialogue text occasionally gets a brief character replacement flicker. Every 3-5 seconds, 2-3 random characters in any visible text object get replaced with random glyphs for 100ms.
  - Implementation: A recurring timer that picks a random `Phaser.GameObjects.Text` in the scene and temporarily changes a portion of its displayed characters.
- **Persistent vignette:** Screen edges are permanently darkened (alpha 0.2 dark overlay).
- **Board shimmer:** Nodes occasionally "shimmer" — faction icons on nodes swap/move momentarily.

#### Implementation Strategy

Centralize all effects in a single manager class:

```
src/systems/ResonanceFX.ts
```

```typescript
export class ResonanceFX {
  private scene: Phaser.Scene;
  private currentTier: string;
  private timers: Phaser.Time.TimerEvent[];
  
  constructor(scene: Phaser.Scene);
  
  update(resonance: number): void {
    const tier = resonanceTier(resonance);
    if (tier === this.currentTier) return;  // no change
    this.currentTier = tier;
    this.clearAll();
    this.applyEffects(tier);
  }
  
  private applyEffects(tier: string): void {
    switch (tier) {
      case 'awakened': this.startChromaticShift(); break;
      case 'unmoored': this.startUIJitter(); this.startScreenPulse(); break;
      case 'transcendent': this.startTextGlitch(); this.startPersistentVignette(); break;
    }
  }
  
  private clearAll(): void {
    this.timers.forEach(t => t.remove());
    this.timers = [];
    // Remove overlay objects
  }
  
  destroy(): void;
}
```

#### Files to Change

- **New:** `src/systems/ResonanceFX.ts` — central manager for all resonance visual effects
- **Modify:** `src/systems/ResonanceSystem.ts` — integrate with ResonanceFX
- **Modify:** `src/ui/WhisperOverlay.ts` — enhance `applyResonanceTint()` with tier-specific effects
- **Modify:** `src/scenes/BoardScene.ts` — add node shimmer effects
- **Modify:** `src/scenes/CombatScene.ts` — add combat-specific resonance UI effects

---

### 3.4 Event Chains (Multi-Node Stories)

**Problem:** Every event is self-contained. Player choices in one event never echo in later events. No sense of narrative arc within a run.

**Goal:** Create 3 event chains where choices made early in the run callback and flavor later events.

#### Chain 1: "The Bread" (Early → Mid Game)

| Step | Event | Condition | Effect |
|------|-------|-----------|--------|
| 1 | EVENT-001: The Half-Eaten Meal | Player chooses "Eat the bread" | Sets flag `ate_venn_bread` |
| 2 | EVENT-012 variant: "The Ghost's Question" | Node page 5-8, requires `ate_venn_bread` | A Venn ghost appears. "Why did you steal our farewell?" Special dialogue options. Unique lore fragment reward. |

**Implementation:**
- EVENT-012 already exists in the event pool. Add a new variant entry with `requiresAnyFlag: ['ate_venn_bread']` and modified flavor text + choices.
- The variant shares the same event ID base but has different text and rewards.

#### Chain 2: "The Scripture" (Early → Late Game)

| Step | Event | Condition | Effect |
|------|-------|-----------|--------|
| 1 | EVENT-002: The Sable Patrol | Player chooses "Quote Venn scripture" (INT ≥ 7) | Sets flag `quoted_venn_scripture` |
| 2 | Landmark 2: Patriarch Cass | Pre-combat choice | Unique dialogue option: "I know what you burned." Patriarch reacts differently — his DEF is reduced by an additional 10%. |

**Implementation:**
- In `LandmarkScene.ts`, check `player.flags.quoted_venn_scripture` during Patriarch approach.
- Add a unique pre-combat choice text and apply a bonus modifier to the boss fight.

#### Chain 3: "The Hymn" (Mid → Late Game)

| Step | Event | Condition | Effect |
|------|-------|-----------|--------|
| 1 | EVENT-005: The Choir's Hymn | Player joins or records the hymn | Sets flag `chorus_participant` |
| 2 | EVENT-007: The Loom Speaks | Requires `chorus_participant` | Extra choice option referencing the Chorus experience. +5 Covenant bonus on one choice. |

**Implementation:**
- In EVENT-007's choice list, if `chorus_participant` is true, show an additional choice with Chorus-linked flavor text.

#### EventDef Changes

Add optional fields to `EventDef`:
```typescript
export interface EventDef {
  // ...existing fields...
  chainId?: string;              // e.g., 'bread', 'scripture', 'hymn'
  chainStep?: number;            // 1 or 2
  requiresChainFlag?: string;    // e.g., 'ate_venn_bread'
}
```

#### EventEngine Changes

In `eligibleEvents()`:
```typescript
// Filter chain events: only show step 2 if step 1's flag is set
if (event.requiresChainFlag && !player.flags[event.requiresChainFlag]) {
  return false;  // Don't show this event — player hasn't done the pre-requisite
}
```

#### Files to Change

- **Modify:** `src/data/events.ts` — add chain variants, chain fields to EventDef
- **Modify:** `src/data/types.ts` — add chain fields to EventDef
- **Modify:** `src/systems/EventEngine.ts` — filter chain events by flag presence
- **Modify:** `src/scenes/LandmarkScene.ts` — check flags for Patriarch chain dialogue

---

## 4. Combat & Game Feel

### 4.1 Turn Order Indicator

**Problem:** No visual feedback for turn order. Players don't know who goes next or how fast enemies are relative to them.

**Goal:** A clear, always-visible indicator showing the turn order of all combatants.

#### UI Element

Small horizontal speed bar (600 × 30px) positioned above the action bar (y = GAME_HEIGHT - 160).

```
╔══════════════════════════════════════════════════════════════╗
║  [YOU]    [Ash Seer]    [Skeleton]    [Zealot]    [YOU]     ║
║  SPD: 22  SPD: 18       SPD: 12       SPD: 14              ║
╚══════════════════════════════════════════════════════════════╝
```

**Layout:**
- Left to right = fastest to slowest
- Player icon: a small circle with "P" or the player token texture
- Enemy icons: small circles with their token texture
- Current turn's icon: highlighted with a gold border + subtle glow
- Next turn's icon: slightly brighter than non-active
- SPD value shown below each icon in small monospace text

**Data source:**
- `CombatSnapshot` already contains `initiativeOrder: string[]` (from `CombatEngine.ts`)
- The snapshot is updated on every action and round transition

#### Implementation

In `src/ui/CombatHUD.ts`, add a new export function:

```typescript
export function createSpeedBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  order: string[],
  currentActorKey: string,
  enemies: Map<string, EnemyView>,
  playerSpeed: number,
): Phaser.GameObjects.Container;

export function updateSpeedBar(
  container: Phaser.GameObjects.Container,
  order: string[],
  currentActorKey: string,
): void;
```

The function creates icons for each actor, positions them left-to-right, and highlights the current turn. The container is recreated on round start and updated on actions.

#### Integration in CombatScene

In `create()`: call `createSpeedBar()` after building enemy displays.
In `refresh()`: call `updateSpeedBar()` whenever the snapshot changes.

#### Files to Change

- **Modify:** `src/ui/CombatHUD.ts` — add `createSpeedBar` / `updateSpeedBar`
- **Modify:** `src/scenes/CombatScene.ts` — wire speed bar into create/refresh

---

### 4.2 Faction Hostile Consequences

**Problem:** Faction influence tracks -100 to +100 with defined thresholds (Hostile/Neutral/Friendly/Devoted), but being Hostile (≤ -25) has zero gameplay effect. No enemies spawn, no choices are locked, no flavor text changes.

**Goal:** Hostile factions should feel hostile. The world should react when a faction hates you.

#### Consequences

When any faction's influence ≤ -25 (Hostile):

**1. Ambush on Movement (30% chance)**
- After rolling movement but before resolving the target node, check: `isAnyFactionHostile(player) ? random() < 0.30 : false`
- If true: an ambush combat encounter spawns with 2 faction-specific enemies
- Ambush enemies gain +10% HP (they're hunting you deliberately)
- After victory, the player continues to the rolled node normally

| Faction | Ambush Enemies |
|---------|---------------|
| Sable (≤ -25) | 2× Sable Zealot |
| Archive (≤ -25) | 1× Venn Custodian + 1× Archive Cipher Wraith |
| Covenant (≤ -25) | 2× Ash Seer |
| Caravan (≤ -25) | 1× Dust Road Raider + 1× Dust Wight |

**2. Locked Choices in Events**
- In any event that has a faction-tagged choice, if that faction is Hostile, the choice is locked with a red lock icon and text: *"They will not listen to you."*
- Example: In EVENT-002 (Sable Patrol), if Sable is Hostile, the "Quote Venn scripture" and "Hand over the tablet" options are locked. Only combat remains.

**3. Flavor Text Changes**
- Event intro texts get a hostile suffix:
  - Sable Hostile: *"The Sable agent sees your face and reaches for their blade."*
  - Archive Hostile: *"The Archive doors are barred. Through the grates, you see armed custodians."*
  - Covenant Hostile: *"The air shimmers with hostile intent. They know you refused the gift."*
  - Caravan Hostile: *"The campfire goes out as you approach. No one offers you food."*

**4. Rest Node Disruption (20% chance)**
- When resting with any Hostile faction, 20% chance of being ambushed mid-rest
- Restore only 50% of normal HP/MP
- Text: *"You wake to the sound of blades being drawn. Not enough rest."*

**5. Mini-Boss Bonus**
- If the faction associated with an upcoming mini-boss is Hostile, the mini-boss gets +10% HP
- This creates a natural consequence: angering a faction makes their mini-boss harder

#### Implementation

In `BoardScene.handleRoll()`:
```typescript
function shouldAmbush(player: PlayerState): boolean {
  return Object.values(player.faction).some(v => v <= -25) && Math.random() < 0.30;
}
```

If ambush: push an ambush combat node onto the path before advancing to the rolled node. After combat, resume movement.

In `EventScene`:
```typescript
// Before showing choices, filter out locked ones
const availableChoices = event.choices.filter(choice => {
  if (choice.factionGate && player.faction[choice.factionGate] <= -25) {
    return false;  // Lock this choice
  }
  return true;
});
```

#### Files to Change

- **Modify:** `src/scenes/BoardScene.ts` — ambush chance on movement
- **Modify:** `src/scenes/EventScene.ts` — lock choices by faction hostility
- **Modify:** `src/data/events.ts` — add `factionGate` field to choices, hostile flavor text variants
- **Modify:** `src/data/types.ts` — add `factionGate?: string` to `EventChoice`
- **Modify:** `src/scenes/CombatScene.ts` — mini-boss HP bonus if related faction is hostile

---

### 4.3 End-of-Run Stats Screen

**Problem:** After death or ending completion, the player sees a brief summary and a "Return to Menu" button. No sense of accomplishment or reflection.

**Goal:** Show the player what they achieved in their run, compare it to their best, and encourage them to try again.

#### When It Shows

Two entry points:
1. **After GameOver (death):** Shows run stats with death-specific flavor
2. **After Ending (victory):** Shows run stats with ending-specific flavor + ending details

#### Layout

```
╔═══════════════════════════════════════════════╗
║            RUN COMPLETE                        ║
║         "The Hollow Keeps You"                ║
╠═══════════════════════════════════════════════╣
║                                               ║
║  ╔═══════════════════╗  ╔═══════════════════╗ ║
║  ║   STATS           ║  ║   THIS RUN   BEST ║ ║
║  ║  Nodes visited    ║  ║   42 / 200   58   ║ ║
║  ║  Enemies killed   ║  ║   17         24   ║ ║
║  ║  Major bosses     ║  ║   3 / 5      4    ║ ║
║  ║  Mini-bosses      ║  ║   3 / 5      4    ║ ║
║  ║  Level reached    ║  ║   6          7    ║ ║
║  ║  Resonance peak   ║  ║   62         71   ║ ║
║  ║  Choices made     ║  ║   19         24   ║ ║
║  ║  Lore found       ║  ║   8 / 40     12   ║ ║
║  ║  Run time         ║  ║   38:24      35:10║ ║
║  ╚═══════════════════╝  ╚═══════════════════╝ ║
║                                               ║
║  ───────────────────────────────────────────  ║
║  ★ NEW! Lore Fragment: "The Silent Page"     ║
║  ───────────────────────────────────────────  ║
║                                               ║
║  Echo Shards earned:  +124                    ║
║  Total Echo Shards:    567                    ║
║                                               ║
║  ───────────────────────────────────────────  ║
║  Flavor text: "The stone remembers your       ║
║  footsteps. The Loom adds your voice to its   ║
║  collection."                                 ║
║                                               ║
║  [Return to Menu]  [View Lore Codex]          ║
╚═══════════════════════════════════════════════╝
```

#### Data to Display

```typescript
interface RunStats {
  // From current run
  nodesVisited: number;
  enemiesKilled: number;
  majorBossesDefeated: number;  // /5
  miniBossesDefeated: number;   // /5
  levelReached: number;
  resonancePeak: number;
  resonanceTierPeak: string;
  choicesMade: number;
  loreFound: number;
  factionsPeaked: Record<string, number>;  // highest value per faction
  runTimeSeconds: number;
  
  // From meta state for comparison
  bestRun: { /* same structure */ } | null;
  
  // New unlocks
  newLore: string[];
  endingUnlocked: string | null;
  echoShardsEarned: number;
  totalEchoShards: number;
}
```

#### Integration

- In `GameOverScene.ts`: after the game-over text, show the stats screen as an overlay with a delay
- In `EndingScene.ts`: after the epilogue dialog completes, show the stats screen before the final button

#### Files to Change

- **New:** `src/ui/RunStatsScreen.ts` — the stats display component
- **Modify:** `src/scenes/GameOverScene.ts` — integrate run stats
- **Modify:** `src/scenes/EndingScene.ts` — integrate run stats after epilogue
- **Modify:** `src/store/gameStore.ts` — compute run stats from current game/player state

---

## 5. Content Additions

### 5.1 12 Renamed Event Variants

**Problem:** There are 20 unique event scripts. With 200 nodes and ~22 event landings per run, players will see repeats across multiple runs.

**Goal:** Increase perceived event variety by 60% with minimal effort — same mechanics, new names, flavor text, and rewards.

#### Variant Table

| Original | Variant | Flavor Text | Differences |
|----------|---------|-------------|-------------|
| The Half-Eaten Meal | **The Half-Finished Letter** | Kitchen → Study. Bread → Unfinished letter. "The quill is still wet. Five thousand years later, the ink has not dried." | Flag: `found_half_letter`. Lore: "The Correspondence" instead. Same choice structure. |
| The Half-Eaten Meal | **The Half-Packed Bag** | Kitchen → Sleeping quarters. Bread → Travel bag. "Clothes folded. Bed made. Door open." | Flag: `found_half_bag`. Gold reward instead of HP restore. |
| Sable Patrol | **Sable Hunters** | Block path → Tracking you through the ruins. "They have been following you for three nodes. This is where they catch up." | Higher stakes. Combat choices have stronger enemies. |
| Sable Patrol | **Sable Interrogation** | Request → Demand. "The lead interrogator does not ask. She takes your tablet and turns it over slowly." | INT check becomes WILL check. Higher faction rewards. |
| Whispering Wall | **Echoing Hallway** | Wall → Long corridor. "Every step echoes twice. Once forward, once backward. One of them is not your step." | DEX check to avoid trap. |
| Whispering Wall | **Singing Floor** | Wall → Mosaic floor. "The tiles are arranged in a Venn sentence. As you read it, they begin to vibrate." | INT check instead of STR. Different lore fragment. |
| Caravan Merchant | **Caravan Courier** | Sera's camp → Young messenger on the road. "A Dust-Road runner with a sealed satchel. She appraises you with a merchant's eye." | Same shop inventory. Different name and description. |
| Choir's Hymn | **Choir's Lament** | Happy hymn → Mournful hymn. "The song is not celebration. It is grief. They are singing for someone they lost into the Loom." | Covenant → Archive affinity rewards. Lore: "The Grief Chorus." |
| Choir's Hymn | **Choir's Whisper** | Public ceremony → Private ritual. "Three figures in a circle. No crystals. No songs. Just whispers. A private conversion." | Shadow check option. Covenant + Shadow rewards. |
| Loom Speaks Directly | **Loom Whispers** | Stopped time → Dream sequence. "You are asleep. You know you are asleep. But the voice is clearer than any waking sound." | Same choices, dream-themed flavor. |
| Memory Trap | **Identity Trap** | Floor remembers being liquid → Mirror shows a face that is not yours. "The reflection blinks. You did not blink." | Same mechanics, different flavor. |
| Collapsing Floor | **Collapsing Ceiling** | Floor caves in → Ceiling falls. "The Venn built for eternity. They did not build for you." | Same mechanics, different direction. |

#### Implementation Pattern

Each variant is a separate entry in the events array with:
- Unique `id` (e.g., `half_finished_letter` instead of `half_eaten_meal`)
- Same `choices` array structure (same mechanical outcomes)
- Different `title`, `flavorText`, and optionally `rewards` and `flags` arrays
- Same or slightly adjusted `pageRange`

Example:
```typescript
{
  id: 'half_finished_letter',
  title: 'The Half-Finished Letter',
  pageRange: [1, 3],
  flavorText: `A Venn study. A desk. A letter, half-written, the quill still resting across the page. Five thousand years later, the ink has not dried.\n\nThe last sentence: "When this reaches you, we will already be gone. Do not follow. We have found—"`,
  choices: [
    { id: 'a', label: 'Read the letter', effect: { loreFragment: 'the_correspondence', archive: 5, resonance: 3 } },
    { id: 'b', label: 'Take the quill (STR ≥ 7)', effect: { item: 'venn_quill', sable: 3 } },
    { id: 'c', label: 'Leave it undisturbed', effect: { caravan: 2 } },
  ],
}
```

#### Files to Change

- **Modify:** `src/data/events.ts` — add 12 new event entries at the end of the array

---

### 5.2 Auto-Generated Events for Node Variety

**Problem:** The event engine picks from the event pool by matching page range, resonance, and flags. If no event matches, the node falls through as a generic "quiet passage" filler.

**Goal:** Replace the generic filler with procedurally generated event nodes that add atmosphere and minor rewards without requiring custom writing.

#### Template System

```typescript
const ATMOSPHERIC_TEMPLATES: Record<string, string[]> = {
  venn_ruins: [
    "Venn archways curve overhead. The syntax of their architecture implies a sentence you cannot read.",
    "A room of mirrors. Each reflection is you, but different. One is bleeding. One is smiling.",
    "The floor here is glass. Below it, a city — upside down, perfectly preserved, impossible.",
    "A hallway of doors. Each door has a word carved into it. None of the words are in languages that exist yet.",
    "Water drips from a ceiling that depicts a sky no one has seen in five thousand years.",
  ],
  faction_encounter: [
    "A {faction} scout blocks the path. They recognize your tablet. They do not recognize your right to carry it.",
    "{faction} symbols mark this door. It opens easily. Too easily.",
    "The air smells of {faction} incense. Someone was here recently. Someone is watching.",
  ],
  natural_wonder: [
    "A shaft of light pierces the darkness. Dust motes dance. For a moment, you forget where you are.",
    "Fungus that glows with soft blue light carpets the walls. It pulses in rhythm with your heartbeat.",
    "Underground river. The water is perfectly clear. At the bottom, shapes that might be ruins or might be bones.",
  ],
  personal: [
    "You find a footprint that matches your boot. You haven't been this way before.",
    "Your tablet displays a sentence in Venn. You have not seen this word before, but you understand it: 'Lonely.'",
    "A whisper, so quiet you almost miss it: 'Lyra.' Your name. Spoken by someone who should not know it.",
  ],
};
```

#### Choice Generation

Each auto-generated node presents 2 choices:
1. **Investigate** — Roll a stat check (random stat, varies by template). Success: gain item/gold/XP/lore. Failure: take minor damage or gain Resonance.
2. **Pass through** — Minor reward, no risk. +1 Caravan influence (you kept moving).

Example:
```
A room of mirrors. Each reflection is you, but different.
One is bleeding. One is smiling.

[A] Study the smiling reflection (INT check, DC 12)
    Success: +3 Resonance, Lore Fragment chance
    Failure: Take 5 damage, hallucination

[B] Walk past, keeping your eyes forward
    +2 Caravan. No further effect.
```

#### Integration

In `EventEngine.ts`, when no custom event matches:
```typescript
function pickFallbackEvent(player: PlayerState): EventDef {
  const templates = pickRandomTemplates(player);
  const template = templates[Math.floor(Math.random() * templates.length)];
  return generateEventFromTemplate(template, player);
}
```

#### The Faction Encounter Special Case

For faction encounters, substitute `{faction}` with the faction the player has the highest absolute influence with (positive or negative). This makes the encounter feel personalized:
- High positive Sable: a respectful Sable scholar asking for guidance
- High negative Sable: a hostile Sable patrol ready to fight

#### Files to Change

- **New:** `src/data/eventTemplates.ts` — template strings and generation logic
- **Modify:** `src/systems/EventEngine.ts` — add fallback to template generation when no event matches

---

## 6. Settings & Quality of Life

### 6.1 Settings Expansion

**Problem:** Settings scene only has a sound on/off toggle.

**Goal:** Full settings screen with volume control, text speed, screen shake toggle, credits.

#### Settings Screen Layout

```
╔═══════════════════════════════════════════════╗
║                  SETTINGS                      ║
╠═══════════════════════════════════════════════╣
║                                               ║
║  SFX Volume       [■■■■■■■■□□]  80%           ║
║  Music Volume     [■■■■■■■□□□]  70%           ║
║  Ambient Volume   [■■■■■□□□□□]  50%           ║
║                                               ║
║  Text Speed       [■■■■■■■■■□]  90%           ║
║                                               ║
║  Screen Shake     [On/Off]                     ║
║  Turn Order Bar   [On/Off]                     ║
║                                               ║
║  ───────────────────────────────────────────  ║
║                                               ║
║  CREDITS                                       ║
║  Design & Code: [Name]                        ║
║  Writing: [Name]                               ║
║  Built with Phaser 3 + TypeScript             ║
║                                               ║
║  ───────────────────────────────────────────  ║
║                                               ║
║  [Clear All Data]    [Back to Menu]            ║
╚═══════════════════════════════════════════════╝
```

#### Settings Implementation

Persist settings to localStorage:

```typescript
export interface GameSettings {
  sfxVolume: number;       // 0-100
  musicVolume: number;     // 0-100
  ambientVolume: number;   // 0-100
  textSpeed: number;       // 50-200 (% of current speed)
  screenShake: boolean;
  showTurnOrder: boolean;
}
```

Default settings:
```typescript
const DEFAULT_SETTINGS: GameSettings = {
  sfxVolume: 100,
  musicVolume: 70,
  ambientVolume: 50,
  textSpeed: 100,
  screenShake: true,
  showTurnOrder: true,
};
```

Create a simple Zustand store slice or a standalone `SettingsManager`:

```typescript
// src/systems/SettingsManager.ts
export class SettingsManager {
  private static STORAGE_KEY = 'hollow_beneath_settings';
  private settings: GameSettings;
  
  constructor() {
    this.settings = this.load();
  }
  
  get(): GameSettings { return { ...this.settings }; }
  set(partial: Partial<GameSettings>): void { ... }
  save(): void { localStorage.setItem(...) }
  
  private load(): GameSettings {
    const raw = localStorage.getItem(SettingsManager.STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  }
}
```

#### Volume Integration

Currently audio is handled by `PlaceholderAudio.ts`. Add volume control:
```typescript
// In PlaceholderAudio or a new AudioManager
setMasterVolume(vol: number): void { Howler.volume(vol / 100); }  // if using Howler
```

For Phaser's built-in audio:
```typescript
this.sound.volume = settings.sfxVolume / 100;
```

#### Text Speed Integration

In `DialogBox.ts`, replace the hardcoded `delay: 14` with a configurable value:
```typescript
const textSpeed = settingsManager.get().textSpeed;
const delay = Math.round(14 * (100 / textSpeed));
```

#### Screen Shake Integration

In `CombatScene.ts` and other places that use `camera.shake()`, check the setting:
```typescript
if (settingsManager.get().screenShake) {
  this.cameras.main.shake(200, 0.005);
}
```

#### Clear Data Button

- Shows a confirmation dialog: "Are you sure? This will delete all unlocks, Echo Shards, and progress."
- On confirm: clears `localStorage` key for the game store, resets settings to defaults.
- Does NOT close the game — just returns to fresh state.

#### Credits

Simple text block at the bottom of the settings screen. Pull from a `CREDITS` constant:
```typescript
const CREDITS = [
  'THE HOLLOW BENEATH',
  '',
  'Design & Development: [Name]',
  'Narrative Design: [Name]',
  'Original Concept: [Name]',
  '',
  'Built with Phaser 3.70 + TypeScript',
  'State management: Zustand',
  'Build tool: Vite',
  '',
  'Font: Georgia (serif), Courier New (mono)',
  '',
  'Special thanks to the playtesters',
  'who descended into the Hollow.',
];
```

#### Files to Change

- **New:** `src/systems/SettingsManager.ts` — settings persistence and retrieval
- **New:** `src/data/credits.ts` — credits text
- **Modify:** `src/scenes/SettingsScene.ts` — full rewrite with sliders, toggles, credits, clear data
- **Modify:** `src/ui/DialogBox.ts` — use text speed setting
- **Modify:** `src/systems/sceneTransition.ts` — respect screen shake setting
- **Modify:** `src/placeholder/PlaceholderAudio.ts` — respect volume settings

---

### 6.2 Checkpoint Polish

**Problem:** Checkpoints exist but have minimal visual feedback. Players may not realize they've reached one.

**Goal:** Make checkpoints feel like meaningful progress milestones.

#### Checkpoint Reached Notification

When the player reaches a checkpoint node (major boss node 40, 80, 120, 160):

1. **Visual:** A gold circle appears around the node on the board (already partially implemented)
2. **Text popup:** "★ CHECKPOINT SAVED" appears in large gold text at center screen, quickly fades in and out (1.5 seconds total)
3. **Sound:** A brief chime plays (`audio.checkpoint()`)
4. **Particle effect:** Gold sparkles rise from the node for 1 second

In `BoardScene.resolveNode()`:
```typescript
if (CHECKPOINT_INDICES.includes(node.index)) {
  store.recordCheckpoint();
  this.showCheckpointEffect();
}
```

```typescript
private showCheckpointEffect(): void {
  const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '★ CHECKPOINT', {
    fontFamily: FONT_SERIF, fontSize: '36px', color: PALETTE_HEX.gold,
  }).setOrigin(0.5).setAlpha(0);
  
  this.tweens.add({
    targets: text,
    alpha: 1, y: GAME_HEIGHT / 2 - 20,
    duration: 400, ease: 'Sine.easeOut',
    yoyo: true, hold: 800,
    onComplete: () => text.destroy(),
  });
}
```

#### Death → Checkpoint Flow

When the player dies and has a checkpoint:

1. Show "CONTINUE?" screen with:
   - "You fell at Page [X]."
   - "Returning to checkpoint at Page [Y]."
   - "HP/MP restored to 50%."
   - "[Continue] [Return to Menu]"

2. If Continue:
   - Fade to black
   - Board appears with a ghost token at the death location (faded player icon showing how far you got last time)
   - Player token is at the checkpoint node
   - Board caption: "You were here. Now you are here. Try again."

3. If Return to Menu:
   - Still awards Echo Shards for nodes reached
   - Run is discarded

#### Ghost Token

A semi-transparent player token placed at the farthest node reached before death:
```typescript
// In BoardScene.finishMove or handleDeath
this.ghostToken = this.add.image(x, y, 'tok_player').setAlpha(0.25).setScale(0.8);
```

The ghost persists only for the first checkpoing-resumed run. It's cleared when the player passes the death node.

#### Files to Change

- **Modify:** `src/scenes/BoardScene.ts` — checkpoint notification effect, ghost token, death flow
- **Modify:** `src/scenes/GameOverScene.ts` — checkpoint continue option
- **Modify:** `src/placeholder/PlaceholderAudio.ts` — add `checkpoint()` sound

---

## 7. Implementation Order

### Phase A — Core Systems

| Order | Item | Files | Est. Time | Depends On |
|-------|------|-------|-----------|------------|
| A1 | **Board Expansion: 200 nodes + 1d6** | BoardGenerator.ts, BoardScene.ts, types.ts, config.ts, checks.ts | 3h | — |
| A2 | **Mini-Bosses** | miniBosses.ts (new), CombatEngine.ts, BoardGenerator.ts | 3h | A1 |
| A3 | **Level-Up System** | LevelSystem.ts (new), gameStore.ts, types.ts, LevelUpModal.ts (new), StatPanel.ts | 4h | — |
| A4 | **Skill Tree** | skillTree.ts (new), SkillTreeScene.ts (new), gameStore.ts, types.ts, BoardScene.ts | 6h | A3 |
| A5 | **MP System Activation** | types.ts, skills.ts, CombatEngine.ts, CombatHUD.ts, BoardScene.ts | 2h | — |
| A6 | **Equipment Change UI** | InventoryScene.ts (rewrite), stats.ts | 3h | — |
| A7 | **Fog of War (4-node visibility)** | BoardScene.ts | 2h | A1 |
| A8 | **Turn Order Indicator** | CombatHUD.ts, CombatScene.ts | 2h | — |

**Phase A total: ~25 hours**

---

### Phase B — Content

| Order | Item | Files | Est. Time | Depends On |
|-------|------|-------|-----------|------------|
| B1 | **12 Event Variants** | events.ts | 3h | — |
| B2 | **Auto-Generated Events** | eventTemplates.ts (new), EventEngine.ts | 3h | — |
| B3 | **Event Chains** | events.ts, types.ts, EventEngine.ts, LandmarkScene.ts | 3h | — |
| B4 | **Faction Hostile Consequences** | BoardScene.ts, EventScene.ts, types.ts, events.ts | 3h | — |

**Phase B total: ~12 hours**

---

### Phase C — Polish

| Order | Item | Files | Est. Time | Depends On |
|-------|------|-------|-----------|------------|
| C1 | **Onboarding / Tutorial** | TutorialScene.ts (new), tutorialText.ts (new), MenuScene.ts, BoardScene.ts | 4h | — |
| C2 | **Landmark Cinematic** | LandmarkScene.ts, CombatScene.ts, BoardScene.ts, bosses.ts | 5h | — |
| C3 | **Resonance Visual Effects** | ResonanceFX.ts (new), ResonanceSystem.ts, WhisperOverlay.ts | 4h | — |
| C4 | **End-of-Run Stats** | RunStatsScreen.ts (new), GameOverScene.ts, EndingScene.ts, gameStore.ts | 3h | A3 |
| C5 | **Settings Expansion** | SettingsManager.ts (new), credits.ts (new), SettingsScene.ts (rewrite), DialogBox.ts, PlaceholderAudio.ts | 3h | — |
| C6 | **Checkpoint Polish** | BoardScene.ts, GameOverScene.ts, PlaceholderAudio.ts | 2h | — |
| C7 | **Page Transition Cards** | BoardScene.ts | 2h | C2 |

**Phase C total: ~23 hours**

---

### Phase D — Integration & Test

| Order | Item | Est. Time |
|-------|------|-----------|
| D1 | **Build verification** (`npx tsc --noEmit`) | 0.5h |
| D2 | **Playthrough test: full run** (start to finish) | 1h |
| D3 | **Playthrough test: death + checkpoint** | 0.5h |
| D4 | **Edge case: 0 HP, 0 MP boundary** | 0.5h |
| D5 | **Edge case: all factions hostile** | 0.5h |
| D6 | **Edge case: level-up at exact last enemy** | 0.5h |
| D7 | **Edge case: skill tree with 0 points** | 0.5h |
| D8 | **Settings persistence test** | 0.5h |
| D9 | **Bug fix pass** | 2h |

**Phase D total: ~6 hours**

---

### Total Estimated Time

| Phase | Hours |
|-------|-------|
| Phase A — Core Systems | ~25 |
| Phase B — Content | ~12 |
| Phase C — Polish | ~23 |
| Phase D — Integration & Test | ~6 |
| **Grand Total** | **~66 hours** |

---

## 8. Open Questions

These are design decisions confirmed or deferred during planning:

1. **Auto-generated event templates** — should these completely replace the `quiet_passage` filler, or supplement it? **Decision pending — recommend full replacement** since templates provide more flavor.

2. **Page title cards** — 4 chapter cards (at pages 41, 81, 121, 161) or per-page cards (19 total)? **Currently planned: 4 major chapter cards** (after each major boss). Per-page would be excessive.

3. **Skill tree reset** — should players be able to refund skill points? If so, at what cost? **Deferred to post-MVP.** Not implementing refund in this pass. Build decisions are permanent per run.

4. **Level-up stat point UI** — +/- steppers like character creation, or a dropdown? **Steppers** — consistent with existing character creation UX.

5. **Mini-boss special abilities** — should they use AI from the existing enemy system or bespoke handlers? **Bespoke handlers** (one per mini-boss) for variety.

6. **Settings: volume implementation** — Phaser's built-in sound manager or Howler.js? **Phaser's built-in sound** — already the audio approach. Add volume multipliers per channel.

7. **Ghost token on death** — show at death node or at checkpoint? **At death node** — to show the player "you made it this far."

8. **End-of-run stats comparison** — compare to best run only, or show last 3 runs? **Best run only** — simpler, cleaner UI.

---

*Plan version: 1.0 — July 2026*
*Based on: THE_HOLLOW_BENEATH_Improved_GDD_v2.md*
