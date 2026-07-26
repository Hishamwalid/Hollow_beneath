# THE HOLLOW BENEATH

*Five thousand years ago, the Venn walked into the dark and did not return. You are about to find out why.*

---

## Story

Lyra Vane is a linguist and expedition guide, three days into the Keth-7 survey — the latest in a century of attempts to map the subterranean ruins of a vanished civilization called the Venn.

The Venn did not die. They did not flee, or fall, or fade. They *left* — deliberately, systematically, through doors that should not exist — into something they called the Loom. The expedition's job is to figure out where they went, and whether whatever they found is still waiting there.

Events are stacked against you from the start: a cave-in at the Chalk Doorway costs you half your supplies and your best geologist. The expedition leader, Anya Korr, radios up that she is extending the timeline by a week. Then she goes silent. The surface loses contact entirely somewhere around Page 3. By Page 10, you stop expecting them to find you.

You are alone in the dark with a half-translated tablet, a map that rearranges itself when you aren't looking, and a growing certainty that the Venn's question — the one that made them walk away from everything — has started asking *you*.

The Loom is real. It is ancient. And it has been waiting for a new voice.

---

## The World

**The Hollow** is not a dungeon. It is a dead city, preserved in cold stone and warm bone, lit by a single gold accent that appears wherever the Venn intended you to find something. Its architecture is syntax — corridors form sentences, rooms are paragraphs, and the deeper you go, the more the structure reads like a question you are walking toward the answer of.

**The Loom** is what the Venn found at the bottom. Not a god. Not a machine. Something between a mirror and a choir — it reflects what you bring it, and it harmonizes with what it recognizes. The Venn recognized something in it that made them set down their cups, leave their bread uneaten, and walk in. No one has heard from them since.

**Resonance** is what happens when the Loom starts recognizing you back. Low Resonance feels like intuition. High Resonance feels like possession. At Transcendent levels (75+), the walls whisper your name in Venn. The distinction between what you thought and what was planted becomes academic.

---

## The Four Factions

You do not descend alone. Four surface factions have been waiting for someone to come back with answers — or to confirm their answer was right all along.

| Faction | Motto | Belief |
|---------|-------|--------|
| **The Sable Order** | *What sleeps should not be woken.* | Seal every site. Burn every record. The Venn left for a reason, and the reason is still down there. |
| **The Argent Archive** | *Understanding is the only immortality.* | Catalogue everything. The Venn are the greatest scholarly subject in human history, and the Archive intends to be the ones who publish first. |
| **The Ash Covenant** | *We do not evolve. We are translated.* | The Venn did not disappear — they *transformed*. The Covenant seeks to follow them through the Loom, whatever the cost to the body. |
| **The Dust-Road Caravan** | *The graveyards of the curious are paved with answers.* | Neutral ground. Traders, salvagers,和信息 brokers. The Caravan sells to all factions and answers to none — but they remember who treated them fairly. |

Faction influence ranges from -50 (Hostile) to +50 (Devoted). It affects shop prices (0.6x–1.5x), event availability, encounter types, and ultimately which endings are reachable.

---

## The Five Bosses

The board is 200 nodes long. At pages 20, 60, 100, 140, and 180, a Landmark blocks your path — each one a major boss with unique mechanics, phase transitions, and lore.

| Boss | Page | Theme |
|------|------|-------|
| **The Argent Sentinel** (Keth-Vor, the First Door) | 20 | *The danger of curiosity.* — A guardian that studies you. Three phases: Curator, Erudite, Desperate Guardian. |
| **Patriarch Oren Cass** | 60 | *Faith as a weapon.* — A Sable inquisitor who has been down here too long. Pre-combat choices that can skip the fight entirely. |
| **The Merged Chorus** | 100 | *The cost of not being alone.* — Forty Archive scholars who entered together and became one voice. Per-round randomized weakness. |
| **The Fossil King** | 140 | *Empire as a monument to itself.* — A Venn-era ruler preserved in stone, still issuing decrees. Four phases: Decree, Rebellion, Silence, Fossil. |
| **The Final Reflection** | 180 | *The mirror that asks questions.* — Adapts to your build, your faction alignment, your history. Fights like a version of you. |

---

## The Seven Endings

Your ending is determined by your faction allegiance, Resonance peak, lore discoveries, and choices made. Endings are evaluated top-to-bottom; the first match wins.

| Ending | Unlock | How to reach |
|--------|--------|--------------|
| **The Silence** | True New Game+, Loom Perspective | Secret. Resonance ≥100, all factions ≤25, ≥6 lore. |
| **The Seal** | Sable starting blessing | Resonance ≤24, Sable ≥50. |
| **The Keeper's Legacy** | Archive starting equipment | Archive ≥50, ≥15 lore. |
| **The Ascension** | Covenant starting curse | Resonance ≥75, Covenant ≥50. |
| **The Wanderer's End** | Caravan starting gold | Caravan ≥50, ≤3 enemies killed. |
| **The False Prophet** | Silver Tongue trait | All four factions ≥25. |
| **Unfinished** | Nothing new — but the run counts | Default fallback. No faction claims you. |

---

## Core Game Mechanics

### Stats & Character Creation

You have 5 stats, allocated from a pool of 30 points (minimum 1, maximum 10 per stat):

| Stat | Governs | Derived bonus |
|------|---------|---------------|
| **STR** | Physical attack power | ATK = STR × 2 |
| **DEX** | Speed, accuracy, dodge | SPD = DEX × 2 + 8, ACC = 80 + DEX × 2 (max 95), Dodge = DEX × 2 (max 40) |
| **CON** | Hit points, physical defense | HP = CON × 10 + 30, DEF = CON × 2 |
| **INT** | Magic attack, magic defense | MATK = INT × 2, MDEF = INT × 2 + WIL |
| **WIL** | Magic points, magic defense | MP = WIL × 6 + 20, also contributes to MDEF |

Six preset builds available: **Balanced** (6/6/6/6/6), **Warrior** (9/5/8/2/6), **Scholar** (2/5/4/9/10), **Ranger** (5/10/4/4/7), **Guardian** (6/4/10/3/7), **Shadow** (4/7/5/6/8).

### Board Movement

200 nodes arranged in a winding path across 20 pages (10 nodes per page). Each turn:
- **Roll 1d6** — advance that many nodes forward (cannot skip unresolved Landmark nodes).
- Each node type triggers different content:

| Node | Weight | What happens |
|------|--------|-------------|
| **Event** | 45% | Narrative encounter with 2–4 choices, stat checks, faction shifts, item/lore rewards |
| **Combat** | 22% | Turn-based fight against 1–3 enemies (enemy pool scales by page depth) |
| **Rest** | 12% | Restore HP/MP, remove status effects |
| **Discovery** | 13% | Random reward: gold, item, lore fragment, Echo Shards, faction influence, or skill |
| **Trap** | 8% | Triggers a hazard (collapsing floor, memory trap, etc.) — roll to avoid or take damage |
| **Landmark** | 5 fixed | Major boss encounter at pages 20, 60, 100, 140, 180 |

Enemies scale per page: +10% HP, +7.5% ATK, +5% DEF per page (multiplicative from base).

### Combat System

Turn-based with 2 Action Points (AP) per round. Initiative is determined by speed (SPD); player goes first in even rounds.

**Damage formula:**
```
Damage = (ATK − EnemyDEF / 2) × SkillPower × WeaknessMultiplier × Random(0.9–1.1)
```

**8 damage types** with a weakness matrix — each enemy has affinity multipliers (0 = immune, <1 = resist, 1 = normal, >1 = weak, negative = absorb):

| Type | Color | Type | Color |
|------|-------|------|-------|
| Slash | Red | Flame | Orange |
| Pierce | Gold | Frost | Blue |
| Blunt | Brown | Shock | Purple |
| Sacred | White | Shadow | Grey |

**Available actions (each costs 1 AP unless noted):**
- **Attack** — Basic physical strike with equipped weapon type
- **Use Skill** — Any known named skill (25 available across 6 trees), some cost MP
- **Guard** — Halve incoming damage until next turn (costs 0 AP, but ends turn)
- **Use Item** — Consume a healing/utility item from inventory
- **Analyze** — Reveal enemy affinities + gain +1 Momentum (0 AP with True Sight unlock)
- **Sunder** — Reduce enemy DEF by 3 for the rest of the fight
- **Withdraw** — Attempt to flee combat (WIL check, DC varies by enemy count)

**Momentum** — A shared gauge that fills when you exploit a weakness, land a critical hit, Analyze, or use a skill for the first time. At 3 Momentum, choose a payoff:

| Choice | Effect |
|--------|--------|
| **Extra Turn** | Gain 1 bonus AP immediately |
| **Chorus Heal** | Restore 30% of max HP |
| **Clarity** | Remove all debuffs from self |
| **Forgotten Technique** | Next attack deals double damage |
| **Unravel** | Reduce all enemy DEF/MDEF by 5 for 3 rounds |

**Status Effects:**
- **DoTs** (stack to 3): Poison (3/tick), Burn (5/tick), Bleed (4/tick + heals reduced), Curse (2/tick + ATK down), Frostbite (2/tick + SPD down), Shock (3/tick + next hit crit)
- **Controls**: Sleep, Fear, Silence, Blind, Confuse, Stun, Root
- **Buffs/Debuffs**: 7 buffs (ATK up, DEF up, SPD up, Regen, Barrier, Veil Step, Momentum Gain) and 6 debuffs (ATK down, DEF down, SPD down, Vulnerable, Cursed, Pacified)

### Resonance

The central mechanic. Earned through events, choices, and discoveries. Ranges from 0–100.

| Tier | Threshold | Effects |
|------|-----------|---------|
| **Stable** | 0–24 | Normal gameplay. Nothing extra watching you. |
| **Awakened** | 25–49 | Faint pattern recognition. Some events unlock. Whispers begin. |
| **Unmoored** | 50–74 | UI warps at edges. Enemies gain +15% HP. Perceive one extra node ahead. New faction options unlock. |
| **Transcendent** | 75–100 | Persistent distortion. Enemies gain +25% HP and +25% ATK. Player deals +30% damage to non-bosses. Resonance Abilities unlocked. Some endings lock shut. |

At Transcendent: you unlock **Resonance Abilities** (powerful 0-AP actions that cost MP and Resonance instead).

### Faction Influence

Four axes, each ranging -50 (Hostile) to +50 (Devoted):

| Influence | Effect on shop prices | Event availability |
|-----------|----------------------|-------------------|
| Hostile (-50 to -25) | ×1.5 cost | Faction-locked choices and events unavailable; ambush encounters possible |
| Neutral (-24 to 24) | ×1.0 | Standard options |
| Friendly (25 to 74) | ×0.8 | Faction-specific positive events and equipment |
| Devoted (75 to 100) | ×0.6 | Unique endings, starting blessings in next run |

### Progression

- **XP** gained from combat victories and event choices. Each level requires progressively more XP (`50 + 10n + 0.5n²` for level n).
- **Level cap:** 15. Each level grants **1 stat point** and **1 skill point**.
- **6 skill trees:** Warrior, Ranger, Scholar, Guardian, Shadow, Universal — each has a linear progression of purchasable nodes. 25 named skills total.
- **Equipment:** 4 slots (Weapon, Armour, Focus, Accessory). 15 equipment items exist, each with stat bonuses calculated on equip.

### Echo Shards

Meta-currency earned across runs:

| Source | Shards |
|--------|--------|
| Per node visited | 1 |
| Per Landmark (boss) | 5 |
| Per ending | 10 |
| Per lore fragment discovered | 2 |
| Death refund | 50% of shards earned that run |

11 permanent unlocks in the Shard Shop (see above), from Rusty Dagger+ (50 shards) to New Game+ (1000 shards). Purchases persist across all future runs.

### Stat Checks

When an event or trap calls for a check (e.g., "STR check DC 12"):
```
Roll 1d20 + StatValue × 2 ≥ DC + 10
```
At the reference stat value of 6, this passes DC 10 checks ~65% of the time and DC 16 checks ~35%. Investing to 9–10 raises DC 16 success to ~85%.

---

## How to Play

### Starting a Run

1. **Main Menu** — Click "New Descent" (or "Continue" if you have an active save).
2. **Character Creation** — Choose a preset build (Balanced, Warrior, Scholar, Ranger, Guardian, Shadow) or allocate 30 points manually across the 5 stats.
3. **Tutorial** — First-time players see 5 tutorial screens covering board movement, combat, events, Resonance, and factions. Can be skipped.
4. **The Descent** — Click "Descend" to begin. Your position resets to Page 0.

### Each Turn

1. The active node type is displayed at the top of the screen.
2. Click **Roll** to roll 1d6 — your token advances that many nodes along the path.
3. The destination node resolves automatically:
   - **Combat:** Enter turn-based combat. Survive to earn XP + loot.
   - **Event:** Read the flavor text, choose from 2–4 options. Some have stat requirements or checks.
   - **Rest:** Choose to restore HP, MP, or remove status effects.
   - **Discovery:** Receive a random reward (gold, items, lore, shards, skills, faction influence).
   - **Trap:** A danger triggers — you may take damage, lose resources, or gain Resonance.
   - **Landmark:** Enter a boss encounter with a pre-fight approach scene.
4. After resolving, click the dice to roll again and advance further.
5. **Between turns** you can access: Inventory (equip/use items), Skills (view your skill tree), Lore Codex (read discovered fragments), Settings.

### During Combat

1. Enemy information is displayed on the right (HP bars, statuses, affinities once Analyzed).
2. Your action bar shows available actions — each costs 1 AP (you have 2 per round).
3. Select an action, then select a target enemy (for attacks/skills).
4. The result plays out: damage numbers, status applications, enemy responses.
5. After you spend both AP and click **End Turn**, enemies act based on their AI.
6. Repeat until all enemies are defeated (Victory) or your HP reaches 0 (Defeat).
7. **On victory:** Earn XP and Echo Shards. If a named boss, also receive boss-specific rewards.
8. **On defeat:** If you have a checkpoint (reached pages 40/80/120/160), you can continue from there with 50% HP/MP restored. Otherwise, the run ends and you keep any Echo Shards earned.

### Between Runs

1. **End-of-run stats** — Review your performance, lore discovered, ending achieved.
2. **Shard Shop** — Spend Echo Shards on permanent unlocks that carry into your next run.
3. **New Game+** (after unlocking) — Start harder runs with knowledge and advantages from previous descents.

### Tips for New Players

- **Resonance is a double-edged sword.** High Resonance unlocks powerful abilities and content, but makes enemies significantly harder. Know what you're aiming for.
- **Faction alignment locks endings.** If you want a specific ending, commit to one or two factions early. Staying neutral across all four unlocks a different path.
- **Analyze before attacking.** Revealing enemy affinities lets you exploit weaknesses for extra damage and Momentum. Worth the 1 AP.
- **Don't neglect CON.** HP scales linearly with CON. Low-CON builds feel fragile by Page 10+.
- **Skill trees are permanent per run.** You can't refund skill points mid-run, so choose deliberately.
- **Checkpoints are your safety net.** Reaching pages 40/80/120/160 saves your progress. If you die, you restart from the last checkpoint, not from the beginning.

---

## Project Structure

```
src/
  main.ts              Phaser.Game bootstrap, scene registration
  config.ts            Constants: 1280×800, 200 nodes, 20 pages

  data/                Pure content — no Phaser, testable in Node
    types.ts           All TypeScript interfaces (source of truth)
    enemies.ts         12 enemy definitions with AI
    events.ts          31+ narrative events
    bosses.ts          5 boss definitions with phase AI
    items.ts           30 items (consumables + equipment)
    skills.ts          25 named skills
    skillTree.ts       6 skill trees
    factions.ts        4 factions + influence tracking
    loreFragments.ts   51 discoverable lore entries
    whispers.ts        50 ambient whisper lines (4 Resonance tiers)
    endings.ts         7 ending definitions
    shardShop.ts       11 meta-progression unlocks
    stats.ts           Stat formulas, point-buy system
    statusEffects.ts   DoTs, controls, buffs/debuffs

  systems/             Pure logic — no Phaser imports
    CombatEngine.ts    Turn-based combat (damage, AI, momentum)
    EventEngine.ts     Event resolution, choice application
    BoardGenerator.ts  200-node procedural board generation
    ResonanceSystem.ts Resonance tier calculations
    LevelSystem.ts     XP thresholds, level-up math
    SaveManager.ts     localStorage persistence
    SettingsManager.ts Volume, text speed, screen shake

  scenes/              Phaser presentation layer
    BootScene → PreloadScene → MenuScene → CharacterCreationScene → BoardScene
    BoardScene branches to: EventScene, CombatScene, LandmarkScene
    Endings: EndingScene, GameOverScene
    Menus: SettingsScene, ShardShopScene, LoreCodexScene, InventoryScene,
           SkillTreeScene, TutorialScene

  ui/                  Reusable Phaser UI components
    Button, DialogBox, ChoiceMenu, CombatHUD, StatPanel,
    DiceRoller, NodePreview, LevelUpModal, RunStatsScreen, WhisperOverlay

  placeholder/         Procedural asset generation (swap for real assets)
    PlaceholderTextures.ts   All sprites generated via Phaser Graphics API
    PlaceholderAudio.ts      All SFX synthesized via Web Audio API
```

---

## Build & Run

```bash
npm install
npm run dev          # Dev server at http://localhost:3000
npm run build        # Production build → dist/
npm run typecheck    # Full tsc type checking
npm run test         # Headless smoke test (exercises all systems)
```

**Tech stack:** Vite 5 + TypeScript 5.5 + Phaser 3.70 + Zustand 4.5 (no React, no Howler, no GLSL shaders — all placeholder-generated).

---

## Current State

**What's implemented:**
- Full 200-node board, 20 pages, 5 landmark bosses, 12 enemy types
- Turn-based combat with 8 damage types, status effects, momentum system
- 31+ narrative events with branching choices, stat checks, event chains
- 5 skill trees with 25 skills, level-up system (max 15)
- 4 factions with influence tracking, 7 endings
- 51 lore fragments, 50 ambient whispers
- Echo Shard meta-progression shop (11 unlocks)
- Checkpoint save/restore, fog of war, turn order indicator
- Settings (volume, text speed, screen shake), end-of-run stats

**What's placeholder:**
- **All art** — procedural shapes (colored circles for enemies, hexagons for bosses, rounded rectangles for UI)
- **All audio** — Web Audio oscillator tones (no music, no ambient, 22 wired SFX cues)
- Fonts are Georgia/Courier New (system fonts)

See `docs/AGENTS.md` for the exhaustive codebase reference. See `docs/THE_HOLLOW_BENEATH_Art_Audio_Asset_Checklist.md` for the full asset production plan.

---

*Built with Phaser 3.70 + TypeScript. State management by Zustand. Build by Vite.*
