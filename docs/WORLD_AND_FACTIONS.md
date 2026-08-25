# THE HOLLOW BENEATH — World & Factions

*A lore reference for the descent: the worlds of the Beneath, its environment, and the four surface factions. Definitive Edition.*

---

## 1. The Premise

For seven hundred years, certain people have shared the same dream — an impossible version of themselves, power without limit. They are called **Seekers**.

**Eve** was a Seeker. She entered the Beneath, reached the Loom, and chose *solitude* over *translation* — but she came back wrong. She became a **Hollow**: part of the mechanism that keeps the door open and the promise alive. When her child was eleven, she was gone into the Hollow. At twenty-one she died, having forgotten almost everything — eventually, how to breathe.

Her child — the **PLAYER** — never dreamed the dream. They descend through a sinkhole into the ruins of the vanished **Venn civilization** for one reason: *to understand what happened to their mother.* What they find instead is the shape of their own ending.

> *"She said her child would come eventually."* — The Hollowed Man

---

## 2. The Environment

### The Hollow

Not a dungeon — a dead city preserved in cold stone and warm bone. Its architecture is syntax: corridors form sentences, rooms are paragraphs, and the deeper you go the more it reads like a question you are walking toward the answer of.

- **Palette:** void-black stone (`#0b0d10`), bone-white inscriptions (`#e8e2d4`), ritual gold (`#c9a24b`) marking anything the Venn wanted found.
- **Inhabitants:** dust-caked wights, echo-bleached remains of earlier delving companies, Venn custodian constructs still working empty halls, translated remnants of the Ash Covenant, and armed agents of four surface factions.
- **The map lies.** The board rearranges between descents; landmarks stay fixed while everything around them drifts like a dream being re-read.

### The Loom

What waits at the bottom. Not a god. Not a machine. Something between a **mirror and a choir** — it reflects what you bring it and harmonizes with what it recognizes. It does not destroy identity; it *perfects* it. Whoever reaches the end and finishes the thought becomes part of the Hollow. There is no true return.

### Resonance

Resonance is what happens when the Loom starts recognizing you back. 0–100, earned through events and choices:

| Tier | Range | What the world feels like |
|------|-------|---------------------------|
| **Stable** | 0–24 | Nothing extra to see, nothing extra watching back. |
| **Awakened** | 25–49 | Whispers begin. Some events unlock. |
| **Unmoored** | 50–74 | UI warps at its edges. Enemies +15% HP. You perceive one node further ahead. |
| **Transcendent** | 75–100 | Persistent distortion. Enemies +25% HP/ATK; you deal +30% to non-bosses. Resonance Abilities unlock. |

Eve's voice is heard along the way — at Node 8 (*"Keep walking."*), in the Memory Room (*"Don't look."*), in the Ashen Tunnels (*"Does it matter?"*) — each encounter leaving the PLAYER less sure whether the voice is memory or the Loom.

---

## 3. The Five Worlds

The descent is **200 nodes across five chapters of 40 nodes**. Every chapter renders as its own full-screen map; crossing into a new chapter turns the old map away like a page, grants a fresh loadout of techniques, and ends at a Landmark guardian. Eleven pinned story beats play at fixed nodes along the way (see `SCENES.md`).

| # | World | Nodes | Landmark (final node) |
|---|-------|-------|------------------------|
| 1 | **The Archive Opens** | 1–40 | The Argent Sentinel — *Keth-Vor, the First Door* |
| 2 | **The Sable March** | 41–80 | Patriarch Oren Cass — *The Ash Covenant, Ascendant* |
| 3 | **The Singing Deep** | 81–120 | The Merged Chorus — *The Loom, Speaking With Borrowed Mouths* |
| 4 | **The Reach of Dust** | 121–160 | The Fossil King — *Dominion, Last of Its Court* |
| 5 | **The Final Descent** | 161–200 | The Final Reflection — *The Loom, Wearing You* |

### Chapter 1 — The Archive Opens *(nodes 1–40)*
Threshold strata: the company's rope and rusted iron pegs, bone-white corridors, the low Warrens, then the Archive Threshold and its gold-lit First Door. Pale sand and worn stone underfoot. Denizens: Keth deserters, rust-pickers, and Sable scouts — the armed human leftovers of the dig (the deeper dead sleep for now). Story beats: the Descent, Eve's First Voice, First Blood.

### Chapter 2 — The Sable March *(nodes 41–80)*
Faith-warrens: the Bone Gallery, humming Resonant Hall, shelves of Deep Pages written in ink that never dried, the vaulted Dark Vault where the Sable Order keeps its forward chapel. Denizens: Venn Custodians, Sable Zealots, Ash Covenant Seers. Story beats: the Hollowed Man, the Deep Pages.

### Chapter 3 — The Singing Deep *(nodes 81–120)*
Where the Loom's voice carries through rock: the sealed Loom Gate, Echoing Passages that return footsteps half a second late, the Still Library whose books read their readers. Reality becomes uncertain. Denizens: Dust-Road Raiders, Archive Cipher-Wraiths (+ Memory Wraith at Resonance ≥25). Story beats: False Memories, the Memory Room.

### Chapter 4 — The Reach of Dust *(nodes 121–160)*
Imperial strata older than the Venn's departure: Crystal Veins fracturing light into prophecy, the petrified Dominion court, the Sable Bastion on black basalt, the Archive Depths. Denizens: Sable Inquisitors, Ash Covenant Mutants, Dominion Echo-Soldiers. Story beats: the Venn Truth, Eve's First Journal.

### Chapter 5 — The Final Descent *(nodes 161–200)*
The bottom of every question: the Covenant Spire built downward, Ashen Tunnels breathing warm air, the Silver Gallery mirroring everything slightly wrong, and the Final Chamber — the door the Venn walked through. Denizens: all the deep's elites (+ The Unread at Resonance ≥50). Story beats: Ashen Tunnels, the Eve Reveal.

Full enemy roster and boss mechanics: `ENEMIES_AND_BOSSES.md`. Full scene script: `SCENES.md`.

---

## 4. The Four Factions

Four surface factions watch the sinkhole. Each tracks an influence axis from **−100 to +100** (`clampInfluence`), shifted by event choices, gear, and ambushes. In the Definitive Edition, influence **no longer decides which ending happens** — every run ends in one of the three tragic endings regardless. Instead, your highest standing colors the **epilogue overlay** during credits: what the surface world believes happened to you.

### Influence mechanics (as implemented)

| Standing | Value | Effects |
|----------|-------|---------|
| **Hostile** | ≤ −25 | Faction-gated event choices lock; hostile-flavor text appends to events; **30% ambush chance** per roll using that faction's roster; **20% chance rests are disrupted** |
| **Neutral** | −24…+24 | Standard treatment |
| **Friendly** | ≥ +25 | Faction-gated choices open (merchants, rites, methods) |
| **Devoted** | ≥ +75 | Deep-loyalty choices unlock |

Levers that move influence:

| Lever | Effect |
|-------|--------|
| Event choices | The main driver — full catalog in `EVENTS_AND_FACTIONS.md` |
| Landmark bosses | Sentinel +20 Archive · Cass +25 Sable · Fossil King +15 Caravan/+10 Archive |
| Faction gear | Equipped signature items give +1/day to their faction (Sable Ash Blade, Archive Field Coat, Traveler's Ledger, Muted Stone) |
| Discovery caches | +1 to your currently leading faction |
| Shard Shop blessings | +10 starting influence next runs (200 shards each) |

### ⚔ The Sable Order

> *"What sleeps should not be woken."*

- **Color:** `#8c2f2f`
- **Belief:** Seal every site. Burn every record. Knowledge of the Loom is contagion; containment is mercy. Patriarch Oren Cass was theirs — lost to the ascension he named himself after.
- **Pleased by:** handing over tablets and findings, sealing sites, destroying phenomena, counter-rites against Covenant rituals.
- **Angered by:** fighting their patrols, hiding ash-marked children, defending Covenant converts.
- **Ambush roster:** Sable Zealots. **Signature item:** Sable Ash Blade.

### 📖 The Argent Archive

> *"Understanding is the only immortality."*

- **Color:** `#3e6e8e`
- **Belief:** Catalogue everything; be the first to set the account down. Their scholars became the Merged Chorus; their cipher-wraiths read you back. Mira Tol still interviews travelers in the field.
- **Pleased by:** answering questions, cataloguing lore, recording hymns, deciphering glyphs, repairing Dominion relics.
- **Almost never angered** — the risk is what knowledge does to *you*.
- **Ambush roster:** Venn Custodian + Cipher-Wraith. **Signature item:** Archive Field Coat.

### 🔥 The Ash Covenant

> *"We do not change. We are translated."*

- **Color:** `#7b4b9e`
- **Belief:** The Venn transformed; the Covenant follows through the Loom whatever the cost to the body. Eve stood among them once — she almost joined, and took a fragment when she left.
- **Pleased by:** joining rites, helping transformations finish, sitting with the grieving, offering yourself to the Loom.
- **Angered by:** breaking circles, stopping conversions mid-translation.
- **Ambush roster:** Ash Seers. **Signature item:** Muted Stone.

### 🐫 The Dust-Road Caravan

> *"The graveyards of the curious are paved with answers."*

- **Color:** `#a8703b`
- **Belief:** Neutral ground. Traders, salvagers, rumor-brokers. Mara and her couriers sell to everyone and answer to no one — but they remember who treated them fairly.
- **Pleased by:** paying tolls, sharing fires, leaving offerings, walking away from trouble, humane detours.
- **Rarely angered by anyone.**
- **Ambush roster:** Dust-Road Raiders ×2. **Signature item:** Traveler's Ledger.

### Epilogue overlays (end of any run)

Highest faction ≥25 decides the closing text; ties favor Sable > Archive > Covenant > Caravan; all ≤24 gives the independent line.

| Highest | Epilogue |
|---------|----------|
| **Sable** | "The Sable Order sealed the sinkhole. No one descends. But the Hollow does not need an entrance. It only needs a dream." |
| **Archive** | "The Archive set down its annals of the Delving of Keth. Your name is a footnote. In a thousand years, someone will read it and descend anyway." |
| **Covenant** | "The Ash Covenant still sings in the deep. They believe you were translated, not lost. They are not wrong." |
| **Caravan** | "The Caravan sells maps to the sealed place. In their version, you simply walked home. The Caravan prefers endings you can pack in a satchel." |
| **Independent** | "No faction claims you. The truth becomes fragmented. The cycle does not need witnesses. It only needs participants." |

---

*Related docs: `MAIN_STORY.md`, `SCENES.md`, `ENEMIES_AND_BOSSES.md`, `EVENTS_AND_FACTIONS.md`, `ART_AUDIO_ASSETS.md`, `ROADMAP.md`. Sources: `src/data/factions.ts`, `src/data/endings.ts`, `src/scenes/{BoardScene,EndingScene}.ts`.*
