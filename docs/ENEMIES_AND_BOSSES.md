# THE HOLLOW BENEATH — Enemies & Bosses

*Definitive Edition combat reference. Source of truth: `src/data/enemies.ts`, `src/data/bosses.ts`. Affinities listed here are the hidden truth — in-game they start unknown (`?`) and are discovered by hitting or Scanning. `wk` = weakness ×1.5 (+Down & 1-More) · `str` = resist ×0.5 · `null` = immune · `rep` = reflects · `drn` = drains.*

---

## 1. Roster by Chapter

One exclusive pool per chapter; scripted fights are scrubbed to the current chapter's roster.

| Ch | Pages | Enemies |
|----|-------|---------|
| 1 | 1–3 | Keth Deserter, Rust-Picker, Sable Scout *(human leftovers of the dig — Dust Wight/Echo Skeleton are retired from spawning)* |
| 2 | 4–7 | Venn Custodian, Sable Zealot, Ash Covenant Seer |
| 3 | 8–11 | Dust-Road Raider, Archive Cipher-Wraith (+ Memory Wraith at Resonance ≥25) |
| 4 | 12–15 | Sable Inquisitor, Ash Covenant Mutant, Dominion Echo-Soldier |
| 5 | 16–20 | Raider, Cipher-Wraith, Inquisitor, Mutant, Echo-Soldier (+ The Unread at Resonance ≥50) |

**Scaling:** enemies grow continuously with depth — +10% HP / +7.5% ATK / +5% DEF for every 10 nodes descended (multiplicative from base).

---

## 2. Standard Enemies (13)

### Chapter 1

| Enemy | Lv | HP | Attacks with | Known affinities | Moves |
|-------|----|----|--------------|------------------|-------|
| **Keth Deserter** — *a broken survivor of Anya Korr's company, all nerves and borrowed gear* | 2 | 55 | Pierce | str slash · wk blunt · null sacred | Desperate Jab (pierce); Wild Swing (high-crit slash) |
| **Rust-Picker** — *a scavenger stripping the abandoned camp for anything that rings* | 2 | 48 | Slash | str slash · wk pierce · wk flame | Hook Blade (slash); Thrown Cleat (blunt) |
| **Sable Scout** — *the Order's advance watcher on the site, censer smoking under a desert scarf* | 3 | 60 | Blunt | wk blunt · rep flame · str shock | Sling Stone (blunt); Censer Ash (flame + Burn chance) |

*(Retired, no longer spawning but kept defined for lore/tests: Dust Wight, Echo-bleached Skeleton.)*

### Chapter 2

| Enemy | Lv | HP | Attacks with | Known affinities | Moves |
|-------|----|----|--------------|------------------|-------|
| **Venn Custodian** — *an Archive golem, still shelving books no one wrote* | 5 | 110 | Blunt | wk frost · str slash/pierce/blunt · drn shock | Archive Bludgeon; Chilling Touch (Chilled); Barrier (self/ally shield) |
| **Sable Zealot** — *ash-marked, certain, and not entirely wrong* | 5 | 85 | Slash | wk flame · wk blunt · rep sacred | Frenzied Slash (two hits, costs 10% own HP); Reckless Flail (heavy blunt, low accuracy) |
| **Ash Covenant Seer** — *crystalline growths refract your face wrong* | 6 | 100 | Shock | wk shock · wk pierce · null flame | Spark Arc (shock; Brittle Frosts Chilled → Stun); Siphon (steals 5 MP) |

### Chapter 3

| Enemy | Lv | HP | Attacks with | Known affinities | Moves |
|-------|----|----|--------------|------------------|-------|
| **Dust-Road Raider** — *human combatant in layered desert fabric; deniable toll-men the Caravan pretends not to know, following the descent down because dead delvers carry maps* | 8 | 150 | Pierce | wk pierce · wk flame · str blunt | Quick Stride (fast pierce); Pocket Sand (−30% Accuracy, 2 turns) |
| **Archive Cipher-Wraith** — *a spectral text that reads you while you fail to read it* | 8 | 140 | Shadow | wk sacred · null slash · drn shadow | Erase Memory (shadow + drains 8 MP); Cipher Barrier (nullifies next skill used on it) |

### Chapter 4

| Enemy | Lv | HP | Attacks with | Known affinities | Moves |
|-------|----|----|--------------|------------------|-------|
| **Sable Inquisitor** — *masked elite, flame motifs worked into heavier armor* | 12 | 230 | Pierce | wk shadow · wk slash · null sacred · str frost | Judgment Pierce (heavy pierce, ignores 30% DEF); Interdict (heal block, 2 turns) |
| **Ash Covenant Mutant** — *further along the translation than anyone should be* | 12 | 250 | Blunt | wk frost · wk pierce · drn flame · null shock | Mutated Slam (25% crit); Acid Spit (−50% DEF, 2 turns) |
| **Dominion Echo-Soldier** — *ancient armored construct; spear and shield, weathered metal* | 12 | 240 | Pierce | wk sacred · wk blunt · rep slash · str pierce | Spear Thrust; Shield Wall (group DEF up); Counter Stance (reflects attacks, 1 turn) |

### Resonance-gated horrors

| Enemy | Gate | Profile |
|-------|------|---------|
| **Memory Wraith** — *someone else's best day, still hungry* | Ch 3+, Resonance ≥25 | Lv 8, Shadow, 160 HP. wk shadow/flame · rep sacred · drn shock. Void Drain (−10% Max MP); Mind Shatter (high Confusion chance) |
| **The Unread** — *apex predator of the deep stacks. Loom-touched. Wrong silhouette.* | Ch 5, Resonance ≥50 | Lv 14, Shadow, 300 HP. wk sacred · null slash/pierce/blunt · drn shadow · rep flame. Page Tear (**true damage**, bypasses shields); Blank Slate (strips your buffs + drains Momentum) |

### Echo summons (Final Reflection only)

Fragments of the self, all Lv 10, all weak to Sacred:

| Echo | Description |
|------|-------------|
| **Echo of Hunger** | A shard of appetite wearing your posture. Gnaw (slash). |
| **Echo of Emptiness** | A shard of absence shaped like a person-shaped hole. Hollow Touch (shadow). |
| **Echo of Harmony** | A shard of the chord that agreed too easily. Dissonant Note (sacred). |
| **Echo of Cleanliness** | A shard that cannot abide being touched. Scrub (slash). |

Summoned by the Reflection's Call Echoes in phase 2, based on the PLAYER's actual run history (ate the Venn bread → Hunger; destroyed the feast → Emptiness; joined a hymn → Harmony; accepted purification → Cleanliness).

---

## 3. The Five Landmark Bosses

One Landmark blocks the final node of each chapter (nodes 40/80/120/160/200). All bosses telegraph charged ultimates one round in advance ("⚡ charging…") and adapt their behavior every third turn.

| # | Boss | Venn name | Node | Lv | Base stats (HP·ATK·MATK·DEF·MDEF·SPD) | Theme |
|---|------|-----------|------|----|----------------------------------------|-------|
| 1 | **The Argent Sentinel** | Keth-Vor, the First Door | 40 | 3 | 150 · 15 · 12 · 12 · 11 · 14 | The danger of curiosity. |
| 2 | **Patriarch Oren Cass** | The Ash Covenant, Ascendant | 80 | 6 | 210 · 16 · 20 · 16 · 18 · 12 | Faith as anesthetic. |
| 3 | **The Merged Chorus** | The Loom, Speaking With Borrowed Mouths | 120 | 9 | 260 · 17 · 21 · 12 · 16 · 15 | The self as a chosen fiction. |
| 4 | **The Fossil King** | Dominion, Last of Its Court | 160 | 13 | 320 · 22 · 20 · 18 · 18 · 11 | Power that outlived its purpose. |
| 5 | **The Final Reflection** | The Loom, Wearing You | 200 | 15 | 360 · 22 · 22 · 15 · 15 · 18 | You were the mystery all along. |

Full scene dialogue lives in `SCENES.md`.

### 3.1 The Argent Sentinel

- **Phases:** The Curator (>66%, resists Shock) → The Erudite (>33%) → The Desperate Guardian (≤33%, weak to Slash)
- **Moves:** Aegis Slam (heavy blunt), Glint Ray (sacred), ⚡ Charge Protocol → Unstoppable Strike (massive blunt)
- **Pre-combat:** [A] "I want answers." · [B] "I want to know what my mother saw." · [C] Attack
- **Rewards:** +20 Archive, +5 Resonance, 5 shards, skill *Steady Hands*, lore *Sentinel's Confession*

### 3.2 Patriarch Oren Cass

- **Phases:** base → The Devout (>30%) → The Martyr (≤30%)
- **Moves:** Opening/Recast Barrier (45), Shadow Bolt (heavy), Miasma, Summon Zealots, Whisper Healing Prayer, Dispel Holy, Punishing Strike
- **Pre-combat:** [A] Accept purification — **skips the fight** (Resonance→0, Max MP −20%, +30 Sable) · [B] Refuse (+5 Sable) · [C] "I know what you burned." — enraged, his DEF −20%
- **Rewards:** +25 Sable, +8 Resonance, 5 shards, skill *Martyr's Flame*, lore *Cass' Unburnt Memory*

### 3.3 The Merged Chorus

- **Phase:** single — **Many Voices** — weaknesses re-randomized every round; scan and adapt or die confused
- **Moves:** Internal Argument (hesitates), Unison Shift, Discordant Howl (heavy), borrowed Flame Pulse, Many-Voiced Strike (random physical type)
- **Pre-combat:** sense if attrition can win (WILL DC 12) · challenge their sacrifice · appeal to scholarly pride · offer yourself instead (Resonance ≥30 — they refuse; big Resonance payout at Max HP cost) · attack without words
- **Rewards:** no faction delta, +5 Resonance, 5 shards, lore *The Chorus Was a Warning*

### 3.4 The Fossil King

- **Phases:** Regal Decree (>76%) → The Rebellion (>52%) → The Silence (>28%) → The Fossil (final, weak to Shadow)
- **Moves:** Imperial Edict (ATK/DEF up), Summon the Court, Primeval Crush (heavy), Petrifying Gaze (Slows your QTE needle), Tax of Flesh (drain), the Last Law, ⚡ Cataclysm
- **Pre-combat:** "What did the Venn become?" (+10 Resonance/+10 Archive) · "Why did you stay?" (+5 Res/+5 Caravan) · "Will you stop me?" (provoked, HP −10%) · "I have no question." (WILL ≥8 — free pre-fight Barrier)
- **Rewards:** +15 Caravan +10 Archive, +10 Resonance, 8 shards, item Fossil Crown, lore *The Fossil King's Court*

### 3.5 The Final Reflection

Mirrors your dominant stat via Mirror Cast (turn 1), throws your choices back as Quoted Choice attacks, summons the four Echoes of your run's decisions, seals one of your six slots (Identity Erasure), and ends fights with ⚡ Hollow Surge ("the only honest blow you will ever receive").

- **Phases:** The Argument (>72%) → The Evidence (>44%) → The Question (>16%) → The Answer
- **Special:** Eve's Memory — conditional phase-4 dialogue if `motherJournalFound` or `eveVoiceHeard ≥ 3`
- **No rewards. No victory screen.**
  - Victory → **THE HOLLOW**: you become it.
  - Defeat → **The Offer**: Accept the dark (LOST IN THE DARK) or Climb to the surface (THE RETURN).

---

## 4. Bestiary integration

Every hit with a new damage type permanently discovers that affinity slot per enemy id (`wk`/`str`/`null`/`rep`/`drn`/`-`), persisted across runs in the Bestiary (save meta `discoveredAffinities`). SCAN is always free.
