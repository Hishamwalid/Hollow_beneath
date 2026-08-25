# COMBAT_SYSTEM_REVAMP.md

## 1. Core Combat Principles
* **Solo Protagonist Focus:** Designed specifically for a single-character turn-based loop without allies or AI party members.
* **Streamlined Action System:** Uses standard turn actions (Basic Attack, Guard, Skill, Item, Scan) with MP costs, HP costs, or 0-cost utility. Action Points (AP) and Fatigue have been removed.
* **Scan & Dynamic Affinity Discovery:** Enemy elemental/physical affinities start as unknown (`?`). Hitting an enemy with a damage type tests that slot and permanently records the affinity (`wk`, `str`, `null`, `rep`, `drn`, `-`) into your Scan UI and Bestiary.
* **Guard & MP Economy:** Guards reduce incoming damage by 50%, prevent Down/Stagger states from enemy Crits, and recover **+6 MP**.
* **6-Skill Slot Limit:** The player can equip up to 6 active skills at any time. Learning a 7th skill stores older skills in an re-equippable Archive.

---

## 2. Dynamic Scan & Discovery Loop


```

+-------------------------------------------------------------+
| [UNKNOWN ENEMY]                                             |
| HP: 120/120  |  MP: 50/50                                   |
| Affinities: [ Slash: ? ] [ Pierce: ? ] [ Blunt: ? ]         |
|             [ Flame: ? ] [ Frost:  ? ] [ Shock: ? ]         |
|             [ Sacred:? ] [ Shadow: ? ]                      |
+-------------------------------------------------------------+
|
Player uses [Flame Pulse]
|
v
+-------------------------------------------------------------+
| Floating Text: "WEAK!"                                      |
| Bestiary Updated: Flame -> 'wk'                             |
+-------------------------------------------------------------+
|
v
+-------------------------------------------------------------+
| [DUST WIGHT]                                                |
| HP: 85/120   |  MP: 50/50                                   |
| Affinities: [ Slash: ? ] [ Pierce: ? ] [ Blunt: ? ]         |
|             [ Flame: wk] [ Frost:  ? ] [ Shock: ? ]         |
|             [ Sacred:? ] [ Shadow: ? ]                      |
+-------------------------------------------------------------+

```

1. **First Encounter:** All 8 affinity icons display as grayed-out `?` marks.
2. **On Hit:** The engine evaluates the target's reaction and updates the Scan UI immediately:
   * **`wk` (Weakness):** Triggers a "1-More" extra turn and deals bonus damage. Displays in Gold.
   * **`str` (Resist):** Deals reduced damage. Displays in Blue.
   * **`null` (Nullify):** Deals 0 damage. Displays in Dark Gray.
   * **`rep` (Reflect):** Bounces damage back to the player. Displays in Red.
   * **`drn` (Drain):** Heals the target instead of dealing damage. Displays in Green.
   * **`-` (Neutral):** Standard 1.0x damage. Displays in Light Gray.
3. **Persistence:** Discovered affinities remain permanently revealed for that enemy ID in subsequent encounters.

---

## 3. Solo Protagonist Progression & Loadouts

Skills are unlocked to directly match the stage-by-stage enemy elemental vulnerabilities.

### **Chapter 1 Loadout: Surface Threshold**
* **Target Enemy Counters:** Slash, Pierce, Blunt, Flame
* **Equipped Skills (6 Slots):**
  1. `Cleaving Swing` (Physical - HP Cost) — Heavy Slash damage.
  2. `Pinpoint Strike` (Physical - HP Cost) — High-crit Pierce attack.
  3. `Flame Pulse` (Magic - MP Cost) — Single-target Flame damage.
  4. `Heavy Guard` (Physical - HP Cost) — Blunt damage + raises self DEF for 2 turns.
  5. `Mend` (Utility - MP Cost) — Restores HP.
  6. `Ignite` (Magic - MP Cost) — Light Flame damage with a chance to inflict Burn.

### **Chapter 2 Loadout: Cults & Factions**
* **Target Enemy Counters:** Frost, Shock, Flame, Blunt (Brittle Frost Reaction)
* **Equipped Skills (6 Slots):**
  1. `Frost Touch` (Magic - MP Cost) — Frost damage. Inflicts **Chilled**.
  2. `Shock Arc` (Magic - MP Cost) — Shock damage. Triggers **Brittle Frost** (1-turn Stun) on Chilled targets.
  3. `Flame Pulse` (Magic - MP Cost) — Retained from Ch. 1 for Flame weakness targets.
  4. `Heavy Guard` (Physical - HP Cost) — Retained for Blunt damage.
  5. `Cleanse & Surge` (Utility - MP Cost) — Cleanses debuffs and recovers +4 MP.
  6. `Mend` (Utility - MP Cost) — Restores HP.

### **Chapter 3 Loadout: Deepening & Memory Loss**
* **Target Enemy Counters:** Shock, Flame, Sacred, Pierce (Overcharge Reaction)
* **Equipped Skills (6 Slots):**
  1. `Chain Lightning` (Magic - MP Cost) — AOE Shock damage.
  2. `Inferno Wave` (Magic - MP Cost) — AOE Flame damage. Triggers **Overcharge** (bonus splash) on Shocked targets.
  3. `Sacred Ray` (Magic - MP Cost) — Sacred damage against wraiths/undead.
  4. `Pinpoint Strike` (Physical - HP Cost) — Retained for Pierce weakness targets.
  5. `Aegis Ward` (Utility - MP Cost) — Grants a shield equal to 25% Max HP.
  6. `Mend` (Utility - MP Cost) — Restores HP.

### **Chapter 4 Loadout: Corruption & Mutants**
* **Target Enemy Counters:** Sacred, Shadow, Blunt, Pierce, Frost (Eclipse Reaction)
* **Equipped Skills (6 Slots):**
  1. `Sacred Ray` (Magic - MP Cost) — Single-target Sacred damage.
  2. `Shadow Veil` (Magic - MP Cost) — Shadow damage. Triggers **Eclipse** (strips buffs + double damage) on Sacred-marked targets.
  3. `Heavy Crush` (Physical - HP Cost) — High-impact Blunt attack.
  4. `Viper Pierce` (Physical - HP Cost) — Pierce damage with high Bleed chance.
  5. `Frost Touch` (Magic - MP Cost) — Retained for Frost weakness targets.
  6. `Mass Renew` (Utility - MP Cost) — Applies HP regeneration over 3 turns.

### **Chapter 5 Loadout: The Deep & Final Reflection**
* **Target Enemy Counters:** Free custom configuration from the **Skill Archive**.
* **Key Tools:**
  * `Full Knowledge` (Utility - MP Cost) — Instantly reveals all unknown (`?`) affinity slots for all active enemies.
  * `Eclipse Blade` (Dual - HP/MP Cost) — Slash + Shadow dual-type attack.
  * `Winter's Grasp` (Magic - MP Cost) — High-damage AOE Frost spell with Stun chance.
  * `Aegis Covenant` (Utility - MP Cost) — Complete status immunity + massive heal.

---

## 4. Enemy Roster & Movepools by Stage

### **Stage 1: Surface Threshold (Pages 1–3)**
* **Dust Wight (`dust_wight`)**
  * *Affinities:* Weak: Slash | Resist: Pierce | Null: Blunt | Reflect: Flame
  * *Move 1:* `Dust Slap` — Basic Slash damage.
  * *Move 2:* `Sand Armor` — Increases self DEF by 20% for 2 turns.
* **Echo-bleached Skeleton (`echo_skeleton`)**
  * *Affinities:* Weak: Blunt, Flame | Resist: Pierce
  * *Move 1:* `Bone Cleave` — High-crit Slash attack.
  * *Move 2:* `Rattle` — Low Blunt damage + 15% chance to inflict Fear.
* **BOSS: The Argent Sentinel (`sentinel`) (Page 4)**
  * *Affinities:* Weak: Pierce | Null: Sacred | Drain: Frost
  * *Move 1:* `Aegis Slam` — Heavy Blunt damage.
  * *Move 2:* `Glint Ray` — Single-target Sacred damage.
  * *Move 3 (Telegraphed):* `Charge Protocol` — Charges for 1 turn; unleashes `Unstoppable Strike` next turn (Massive Physical damage—must Guard!).

---

### **Stage 2: Cults & Fractured Factions (Pages 4–7)**
* **Venn Custodian (`venn_custodian`)**
  * *Affinities:* Weak: Frost | Resist: Physical | Drain: Shock
  * *Move 1:* `Chilling Touch` — Frost damage. Inflicts **Chilled**.
  * *Move 2:* `Barrier` — Grants a absorption shield to an ally.
* **Sable Zealot (`sable_zealot`)**
  * *Affinities:* Weak: Flame, Blunt | Reflect: Sacred
  * *Move 1:* `Frenzied Slash` — 2-hit physical attack (costs enemy 10% HP).
  * *Move 2:* `Reckless Flail` — Heavy Blunt damage with reduced accuracy.
* **Ash Covenant Seer (`ash_seer`)**
  * *Affinities:* Weak: Shock, Pierce | Null: Flame
  * *Move 1:* `Spark Arc` — Shock damage. Triggers **Brittle Frost** (Stun) if player is Chilled.
  * *Move 2:* `Siphon` — Steals 5 MP from the player.
* **BOSS: Patriarch Oren Cass (`patriarch`) (Page 8)**
  * *Affinities:* Weak: Shock, Frost | Reflect: Physical | Drain: Shadow
  * *Move 1:* `Shadow Bolt` — Heavy Shadow damage.
  * *Move 2:* `Miasma` — Inflicts Poison on the player for 3 turns.
  * *Move 3:* `Executioner's Toll` — Pierce attack dealing 2.0x damage if the player is Poisoned.

---

### **Stage 3: Deepening & Memory Loss (Pages 8–11)**
* **Dust-Road Raider (`dust_road_raider`)**
  * *Affinities:* Weak: Pierce, Flame | Resist: Blunt
  * *Move 1:* `Quick Stride` — Fast Pierce attack.
  * *Move 2:* `Pocket Sand` — Reduces player Accuracy by 20% for 2 turns.
* **Archive Cipher-Wraith (`archive_cipher_wraith`)**
  * *Affinities:* Weak: Sacred | Null: Slash | Drain: Shadow
  * *Move 1:* `Erase Memory` — Deals light Shadow damage and drains 8 MP.
  * *Move 2:* `Cipher Barrier` — Nullifies the next skill targeted at it.
* **Memory Wraith (`memory_wraith`) [Resonance ≥ 25]**
  * *Affinities:* Weak: Shadow, Flame | Reflect: Sacred | Drain: Shock
  * *Move 1:* `Void Drain` — Deals Shadow damage and drains 10% Max MP.
  * *Move 2:* `Mind Shatter` — Magic attack with a high chance to inflict Confusion.
* **BOSS: The Merged Chorus (`chorus`) (Page 12)**
  * *Affinities:* Weak: Flame, Shock | Null: Physical
  * *Move 1:* `Discordant Howl` — AOE Sonic/Blunt damage.
  * *Move 2:* `Flame Pulse` — Flame damage.
  * *Move 3:* `Unison Shift` — Swaps elemental weaknesses mid-encounter.

---

### **Stage 4: Corruption & Mutants (Pages 12–15)**
* **Sable Inquisitor (`sable_inquisitor`)**
  * *Affinities:* Weak: Shadow, Slash | Null: Sacred | Resist: Frost
  * *Move 1:* `Judgment Pierce` — Heavy Pierce damage that ignores 30% DEF.
  * *Move 2:* `Interdict` — Prevents player healing for 1 turn.
* **Ash Covenant Mutant (`ash_mutant`)**
  * *Affinities:* Weak: Frost, Pierce | Drain: Flame | Null: Shock
  * *Move 1:* `Mutated Slam` — Heavy Blunt damage with 25% Crit rate.
  * *Move 2:* `Acid Spit` — Reduces player DEF by 40% for 2 turns.
* **Dominion Echo-Soldier (`echo_soldier`)**
  * *Affinities:* Weak: Sacred, Blunt | Reflect: Slash | Resist: Pierce
  * *Move 1:* `Shield Wall` — Taunts player and boosts ally DEF by 30%.
  * *Move 2:* `Counter Stance` — Reflects basic physical attacks for 1 turn.
* **BOSS: The Fossil King (`fossil_king`) (Page 16)**
  * *Affinities:* Weak: Sacred, Blunt | Drain: Flame | Reflect: Pierce
  * *Move 1:* `Primeval Crush` — Heavy Blunt AOE damage.
  * *Move 2:* `Petrifying Gaze` — Inflicts Slow (doubles QTE speed bar).
  * *Move 3 (Telegraphed):* `Cataclysm` — Charges for 1 turn before delivering an unblockable physical strike.

---

### **Stage 5: The Deep (Pages 16–20)**
* **The Unread (`the_unread`) [Resonance ≥ 50]**
  * *Affinities:* Weak: Sacred | Null: Physical | Drain: Shadow | Reflect: Flame
  * *Move 1:* `Page Tear` — True damage that bypasses player shields.
  * *Move 2:* `Blank Slate` — Strips player buffs and reduces Momentum by -20%.
* **FINAL BOSS: Reflection / The Hollow Self (`reflection`) (Page 20)**
  * *Affinities:* Dynamic / Phase-Shifting
  * *Move 1:* `Mirror Cast` — Copies and uses the player's 6 currently equipped skills.
  * *Move 2:* `Hollow Surge` — Charges and fires a true-damage Momentum Finisher at <50% HP.
  * *Move 3:* `Identity Erasure` — Cycles through active skill slots, disabling them temporarily.

---

## 5. Balance Rules for Solo Play

1. **No Enemy Extra Turns:** Enemies do not gain extra actions upon hitting player weaknesses or landing critical hits. Weakness hits deal **+50% bonus damage** instead.
2. **Enemy Action Limit:** Group encounters with 3 enemies are restricted to a maximum of **1 heavy/AOE skill** per round. Remaining enemies must default to basic attacks or utility moves.
3. **Down System:** Landing a weakness hit or critical hit on an enemy inflicts the **Downed** state. Downed enemies skip their entire next turn standing up.

```