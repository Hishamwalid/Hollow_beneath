# THE HOLLOW BENEATH — Events & Faction Interactions

*Complete reference of every narrative event, trap, and minor landmark in the descent — and every way the four surface factions touch your run. Generated from the current data files (`src/data/events.ts`, `src/data/minorLandmarks.ts`, `src/data/bosses.ts`, `src/data/factions.ts`).*

---

## Part I — How Factions Work Right Now

### The four axes

Each faction tracks a separate influence value, clamped to **−100…+100** (`clampInfluence`). All start at 0.

| Standing | Value | What it means mechanically |
|----------|-------|---------------------------|
| **Hostile** | ≤ −25 | That faction's gated event choices become **locked**; hostile-flavor text appends to events; **30% ambush chance per dice roll** using that faction's roster; **20% chance rests are disrupted** (half heal) |
| **Neutral** | −24…+24 | Standard treatment |
| **Friendly** | ≥ +25 | Faction-gated choices open up (merchants, rites, methods) |
| **Devoted** | ≥ +75 | Deep-loyalty choices unlock; faction endings come into reach |

### Every lever that moves influence

| Lever | Effect | Where |
|-------|--------|-------|
| **Event choices** | The main driver — see the catalog in Part II | `events.ts` |
| **Landmark bosses** | Argent Sentinel **+20 Archive** · Patriarch Oren Cass **+25 Sable** · Fossil King **+15 Caravan, +10 Archive** (Chorus & Reflection grant none) | `bosses.ts` getRewards |
| **Faction gear** | Equipping a faction's signature item gives **+1 to that faction every node visited**: Sable Ash Blade → Sable, Archive Field Coat → Archive, Traveler's Ledger → Caravan, Muted Stone → Covenant | `BoardScene.applyFactionGearBonus` |
| **Discovery nodes** | The "small cache" find grants **+1 to your currently leading faction** | `BoardScene.resolveDiscovery` |
| **Shard Shop blessings** | Permanent unlocks give **+10 starting influence** next runs (200 shards each): Sable Blessing / Archive Clearance / Covenant Whisper / Caravan Map | `EchoShardSystem` |

### What factions never do (current build)

- Shop prices are fixed by event text — no dynamic ×0.6–×1.5 price scaling exists in code yet.
- No faction ever *attacks* you outside the ambush roll; hostility is expressed through locked options and flavor.

### Per-faction profile

**⚔ Sable Order** — pleased by containment: handing over tablets and findings (+15/+18/+20), sealing sites (+10), destroying Venn phenomena (+5/+6), turning in fugitives (+15), Sable counter-rites against Covenant rituals (+8…+10). Angered by fighting them (−8/−10), hiding ash-marked children (−15), defending Covenant converts. Their gate opens merchant-free passage and scripture quotes; their ending is **The Seal** (Sable ≥50, Resonance ≤24).

**📖 Argent Archive** — pleased by scholarship: answering Mira Tol's questions (+12), cataloguing lore fragments (+10), recording hymns and frequencies (+8…+12), deciphering glyphs and mosaics (+8/+10), repairing Dominion relics (+12). Almost never angered — their risk is *you*, not them. Their ending is **The Keeper's Legacy** (Archive ≥50, ≥15 lore).

**🔥 Ash Covenant** — pleased by participation and empathy: joining hymns and whispers (+12/+15), helping transformations finish (+12), sitting with the grieving (+5), offering yourself to the Loom (+15). Angered when you break their circles or stop their conversions (−5…−8). Their ending is **The Ascension** (Covenant ≥50, Resonance ≥75).

**🐫 Dust-Road Caravan** — pleased by every neutral, practical, or humane option: paying tolls (+8), sharing stories around fires (+12), leaving offerings (+4…+5), walking away from trouble (+3…+4), funding an escape route (+12). Rarely angered by anyone; they remember fairness. Their endings are **The Wanderer's End** (Caravan ≥50, ≤3 kills) and **The False Prophet** (all four ≥25).

### Cross-faction friction (as written in events)

- Nearly every Covenant ritual offers a **"Sable method"** disruption: gains Sable, loses Covenant (−5…−8).
- Fighting Sable patrols/hunters wins **Covenant respect** (+5/+8) while tanking Sable (−5/−8) — the enemies of the Order profit from its embarrassment.
- Trading lore knowledge to Caravans costs **Archive** standing (−3) — knowledge sold is knowledge not catalogued.
- The Loom itself answers in faction voices: praying Sable-style repels it (+5 Sable), answering Covenant-style surrenders to it (+15 Covenant), answering as a scholar earns Archive (+5).

---

## Part II — The Event Catalog

32 authored events. Format: **Title** *(id)* — chapters available · requirements. Choices list outcome and faction deltas in bold. `[gate]` = requires at least Friendly standing with that faction (locked if Hostile); `[COMBAT]` = can trigger a fight on failure/refusal.

### Chapter 1 events

**The Half-Eaten Meal** *(half_eaten_meal)* — ch 1 · A Venn common-house, bread still fresh, chair pushed back mid-bite.
- Eat the bread → +25% HP, +3 Resonance *(the meal completes itself around you)*
- Read the carving → lore fragment *"The Departure Feast"*, **+5 Archive**
- Smash the table (STR ≥7) → **+3 Sable**, −2 Resonance, −5 HP
- Leave it → **+2 Caravan**

**The Sable Patrol** *(sable_patrol)* — ch 1 · Three crimson robes want your tablet.
- Hand over the tablet [gate: sable] → **+15 Sable**, −5 Resonance
- Refuse (WILL DC10) [COMBAT] → success **+5 Sable** / failure: fight
- Quote Venn scripture (INT ≥7) [gate: sable] → **+10 Sable**, +3 Resonance
- Attack [COMBAT] → **+5 Covenant, −5 Sable**

**The Whispering Wall** *(whispering_wall)* — ch 1 · Resonance ≤24 · A wall hums your unspoken words.
- Touch the wall → +5 Resonance
- Record the frequency (INT ≥6) [gate: archive] → **+8 Archive**, Resonance Sketch item
- Destroy it (STR ≥8) → **+5 Sable**, −3 Resonance, Muted Stone item
- Walk away → **+3 Caravan**

**The Caravan Merchant** *(caravan_merchant)* — ch 1–2 · Sera Voss sells supplies.
- Buy supplies (30g) [gate: caravan] → Ration, Waterskin, Caravan Knife
- Blank book for 50g [gate: caravan] → Blank Book
- Blank book for 8 Resonance [gate: caravan] → Blank Book, −8 Resonance
- Ask why she left → **+5 Caravan, +3 Archive**
- Rob her [COMBAT] → she was expecting it

**Mira Tol's Ledger** *(archivists_ledger)* — ch 1 · An Archive field scholar interviews you.
- Answer her question (INT DC12) → **+12 Archive**, +15g, lore fragment (fail: **+2 Archive**)
- Offer a lore fragment to catalogue → **+10 Archive**, +20g
- Ask what she's really looking for → **+5 Archive**, +1 Resonance
- Decline → **+3 Caravan**

**The Ash-Marked Child** *(ash_marked_child)* — ch 1 · A marked child hides from a Sable patrol.
- Hide the child (DEX DC12) [COMBAT] → **−15 Sable, +10 Caravan**, Ash-Marked Wrap
- Turn the child in → **+15 Sable**
- Ask what they did → +1 Resonance, lore fragment
- Fund their escape (10g) → **+12 Caravan**

**A Quiet Passage** *(quiet_passage)* — ch 1–5 · repeatable · Nothing wrong here. Rest a moment → +5% HP.

**The Page Left Behind** *(page_left_behind)* — ch 1 · requires Sentinel defeated · A farewell note pinned by broken Sentinel parts.
- Read it → +3 Resonance, lore fragment
- Leave it pinned → **+3 Sable**

**The Toll Road** *(tollroad_ambush)* — ch 1–2 · Independent raiders demand a toll.
- Pay (20g) → **+8 Caravan**
- Refuse, draw [COMBAT]
- Talk past them (WILL DC12) [COMBAT] → **+10 Caravan**
- Pay with a lore fragment → **+6 Caravan, −3 Archive**

**The Caravan's Campfire** *(caravan_campfire)* — ch 1–2 · Travelers share fire and story.
- Share your own story (WILL DC11) → **+12 Caravan**, −2 Resonance
- Just listen → **+5 Caravan**
- Ask about Sera Voss → **+4 Archive, +4 Caravan**, lore fragment

**Sable Hunters** *(sable_hunters)* — ch 1–2 · Four hunters close in.
- Hand over findings → **+18 Sable**, −5 Resonance
- Outrun (WILL DC11) [COMBAT] → **+8 Sable**
- Trap the leader (DEX ≥7) → **+10 Sable, +3 Covenant**, Sable Ash Blade
- Fight through [COMBAT] → **+8 Covenant, −8 Sable**

**The Echoing Hallway** *(echoing_hallway)* — ch 1–2 · Your steps echo a fraction late.
- Walk through carefully (DEX DC11) [COMBAT] → +6 Resonance, lore fragment
- Mark the walls (INT ≥6) → **+6 Archive**, +3 Resonance
- Turn back → **+3 Caravan**

**The Choir's Lament** *(choirs_lament)* — ch 1 · Resonance ≥20 · Covenant novices sing grief.
- Join the lament (WILL DC13) [COMBAT] → **+10 Archive**, +6 Resonance, lore fragment
- Record it (INT ≥7) → **+12 Archive, +5 Covenant**, +4 Resonance
- Silence them (Sable method) → **+8 Sable, −5 Covenant**, +2 Resonance
- Leave them → **+4 Caravan**

**The Unfinished Farewell** *(unfinished_farewell)* — ch 1–2 · A translucent figure waits at a set table.
- Apologize → +2 Resonance
- Ask who they were (INT DC11) → **+10 Archive**, +2 Resonance
- Sit with them → +6 Resonance, **+5 Covenant**
- Leave → **+5 Sable**

### Chapter 2 events

**The Ghost's Question** *(ghosts_question)* — ch 2 · requires flag `ate_venn_bread` · A Venn ghost wants to know who ate her farewell.
- "I was hungry. I'm sorry." → +5 Resonance, lore fragment
- "Your bread was stale." → **+5 Sable**, −2 Resonance
- "I don't answer to ghosts." → **+3 Caravan**

**Patriarch's Ash** *(patriarchs_ash)* — ch 2 · requires Cass defeated *and* purification accepted · A cold fire pit, ash in a careful spiral.
- Sit by the ash → **+5 Sable**, +2 Resonance, lore fragment
- Scatter it → **+6 Covenant, −4 Sable**
- Leave it untouched → **+3 Sable**

**The Choir's Hymn** *(choirs_hymn)* — ch 2 · Resonance ≥25 · Hundreds sing in perfect unison, crystals blooming.
- Join the hymn (WILL DC14) [COMBAT] → **+15 Covenant**, +8 Resonance, skill *Chorus Step*
- Decline → **+3 Covenant**
- Disrupt (Sable method) → **+10 Sable, −5 Covenant**, Cracked Crystal
- Record (INT ≥8) → **+10 Archive**, +5 Resonance

**The Loom Speaks Directly** *(loom_speaks_directly)* — ch 2–3 · Resonance ≥50 · Time stops. *"YOU ARE THE ONE I CANNOT FINISH. WHY?"*
- "Because I don't want to be understood." → +10 Resonance, skill *Unfinished Sentence*, **Silence-ending path unlocked**
- "Because I'm still writing myself." → **+5 Archive**, +5 Resonance, next Rest heals double
- "Let me help you understand." → **+15 Covenant**, +10 Resonance, −10% Max HP, skill *Loom-Touched*
- "Leave me alone." (Sable prayer) → **+5 Sable**, −5 Resonance
- "The Chorus taught me to listen." → **+5 Covenant**, +5 Resonance, +8 XP

**Keth-7, Revisited** *(keth7_revisited)* — ch 2–3 · The tablet shows text you never typed.
- Let yourself remember (WILL DC14) → +3 Resonance, Keth-7 Tablet Shard, lore fragment
- Push it down → −2 Resonance
- Write it down instead → **+8 Archive**

**The Reading Room** *(reading_room)* — ch 2 · Glyphs shift meaning as you read.
- Study properly (INT DC13) → **+10 Archive**, Venn Glyph Lens, lore fragment
- Chip off a sample → Venn Glyph Tablet, **+3 Sable**
- Walk away → **+4 Caravan**

**The Choir's Understudy** *(choirs_understudy)* — ch 2 · A half-transformed convert begs for help.
- Help it finish → **+12 Covenant**, +4 Resonance, Choir Tuning Fork, lore fragment
- Stop it (WILL DC13) → **+10 Sable, −5 Covenant**
- Just stay → **+5 Covenant, +3 Sable**, +1 Resonance

**The Silent Auction** *(silent_auction)* — ch 2 · No bids spoken aloud; provenance not guaranteed.
- Sealed blade (70g) → Sealed Edge, lore fragment
- Merchant ledger (45g) → Traveler's Ledger
- Steal something (DEX DC14) [COMBAT] → Auctioneer's Token, **−5 Sable**
- Browse and leave → **+3 Archive**

**The Second Excavation** *(second_excavation)* — ch 2 · A survey camp abandoned mid-sentence.
- Read the journal (INT DC13) → **+10 Archive**, +3 Resonance
- Seal the site → **+10 Sable**
- Take supplies → **+5 Caravan**, gold

**The Half-Finished Letter** *(half_finished_letter)* — ch 2 · *"When this reaches you, we will already be gone…"*
- Read it → **+6 Archive**, +3 Resonance, lore fragment
- Take the quill (STR ≥7) → **+4 Sable**, Venn Glyph Tablet
- Leave it undisturbed → **+3 Caravan**

**The Half-Packed Bag** *(half_packed_bag)* — ch 2–3 · A departure interrupted mid-decision.
- Search the bag → gold
- Take the coat (DEX ≥6) → **+5 Caravan**, +5 Dodge
- Leave everything → **+4 Archive**

**Sable Interrogation** *(sable_interrogation)* — ch 2–3 · She reads your history off the tablet like an indictment.
- Answer truthfully (WILL DC12) [COMBAT] → **+20 Sable**, −4 Resonance
- Deflect → **+6 Sable**
- Quote the Archive charter (INT ≥7) → **+8 Archive, +5 Sable**
- Fight → **−10 Sable**

**The Caravan Courier** *(caravan_courier)* — ch 2 · A runner with a merchant's eye.
- Buy supplies (35g) → 2 Rations, Traveler's Ledger
- Road charm (45g) → Raider's Charm
- Route ahead for 6 Resonance → **+8 Caravan**
- Ask about the road → **+6 Caravan, +2 Archive**
- Take her satchel [COMBAT] → she was faster

**The Singing Floor** *(singing_floor)* — ch 2–3 · You are standing on the chorus.
- Decipher it (INT DC12) [COMBAT] → **+8 Archive**, +7 Resonance, lore fragment
- Stomp the dissonance (STR ≥6) → **+6 Sable**, −2 Resonance
- Step off quickly → **+4 Caravan**

**A Kindness, Poorly Timed** *(kindness_poorly_timed)* — ch 2–3 · A broken Dominion soldier still holds its post.
- End it quickly → +3 Resonance, lore fragment
- Repair it (INT DC14) → **+12 Archive**, Dominion Plate Scrap
- Leave it → **+4 Sable**

**The Choir's Whisper** *(choirs_whisper)* — ch 2–3 · Resonance ≥30 · Three convert in perfect sync.
- Step into the circle (WILL DC14) [COMBAT] → **+12 Covenant**, +8 Resonance, +8 Dodge
- Listen from shadows (DEX ≥7) → **+6 Covenant, +6 Archive**, +4 Resonance, lore fragment
- Break the circle (Sable method) → **+10 Sable, −8 Covenant**, Choir Tuning Fork
- Back away → **+5 Caravan**

**Loom Whispers** *(loom_whispers)* — ch 2 · Resonance ≥40 · The Loom asks why it needs to finish you.
- "Because the question keeps changing." → +8 Resonance, skill *Unfinished Sentence*
- "Why do you need to finish me?" → **+6 Archive**, +6 Resonance, next Rest heals double
- "Take what you need." (Covenant ≥20) → **+12 Covenant**, +8 Resonance, −15% HP
- "Wake up. Now." (Sable prayer ≥20) → **+8 Sable**, −4 Resonance

### Late-board events

**The Last Page** *(the_last_page)* — ch 4–5 · Quiet before the end.
- Take stock → +2 Resonance, **+3 Sable**
- Keep moving → +15% HP
- Write your own page → **+5 Archive**

---

## Part III — Traps

Four hazards, avoided by DEX check:

| Trap | Avoid DC | On trigger |
|------|----------|------------|
| **Collapsing Floor** | 10 | −10 HP, fall back 1d3 nodes, your next Rest node is skipped |
| **Collapsing Ceiling** | 11 | −8 HP, fall back 1d2 nodes |
| **Memory Trap** | 12 | Lose 1d4 Resonance, take 8 damage (15 if Resonance <10) |
| **Identity Trap** | 13 | Lose 1d2 Resonance, take 10 damage (12 if Resonance <10) — the reflection blinks first |

---

## Part IV — Minor Landmarks

Ten capture-point vignettes at fixed nodes (two per chapter). Each is a small two-choice scene: pass by, or engage (engaging yields a lore fragment and usually Resonance or faction favor).

| Node | Ch | Landmark | Engage outcome highlight |
|------|----|----------|--------------------------|
| 10 | 1 | **The First Marker** | Read the tally → lore fragment |
| 30 | 1 | **The Third Marker** | Sable ash, Archive chalk, Caravan glyph layered on one stone — add your own mark → lore fragment |
| 50 | 2 | **The Fifth Marker** | Stop and listen to the hum → lore fragment, +2 Resonance |
| 70 | 2 | **The Seventh Marker** | Leave an offering at the Dominion boundary post → lore fragment, **+1 Caravan** |
| 90 | 3 | **The Ninth Marker** | Trace the empty carving meant for the traveler → lore fragment, +1 Resonance |
| 110 | 3 | **The Eleventh Marker** | Touch the root splitting the stone → lore fragment, +2 Resonance |
| 130 | 4 | **The Thirteenth Marker** | Study thirteen faces, one blank → lore fragment, +2 Resonance |
| 150 | 4 | **The Fifteenth Marker** | Read *"Choose"* aloud → lore fragment, **+2 Sable** |
| 170 | 5 | **The Seventeenth Marker** | Look into the chasm → lore fragment, +3 Resonance |
| 190 | 5 | **The Nineteenth Marker** | Find the postscript *"For Lyra."* → lore fragment + story flag |

---

## Part V — Boss Aftermath (faction rewards)

| Boss | Influence granted | Other rewards |
|------|-------------------|---------------|
| The Argent Sentinel (ch 1) | **+20 Archive** | +5 Resonance, 5 shards, lore *Sentinel's Confession*, skill *Steady Hands* |
| Patriarch Oren Cass (ch 2) | **+25 Sable** | +8 Resonance, 5 shards, lore *Cass' Unburnt Memory*, skill *Martyr's Flame* |
| The Merged Chorus (ch 3) | none | +5 Resonance, 5 shards, lore *The Chorus Was a Warning* |
| The Fossil King (ch 4) | **+15 Caravan, +10 Archive** | +10 Resonance, 8 shards, lore *The Fossil King's Court*, Fossil Crown |
| The Final Reflection (ch 5) | none | +10 Resonance, 10 shards, final lore |

---

*Procedural fallback events (`eventTemplates.ts`) fill any gap where no authored event matches — they carry no faction weight. Sources: `src/data/events.ts`, `src/data/eventTemplates.ts`, `src/data/minorLandmarks.ts`, `src/data/bosses.ts`, `src/systems/EchoShardSystem.ts`, `src/scenes/{BoardScene,EventScene,LandmarkScene}.ts`.*
