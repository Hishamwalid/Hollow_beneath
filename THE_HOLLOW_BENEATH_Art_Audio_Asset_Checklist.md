# THE HOLLOW BENEATH — Art & Audio Asset Checklist

*Grounded in the actual texture keys and audio call sites in `src/placeholder/PlaceholderTextures.ts` and `PlaceholderAudio.ts` — not just re-stated from the GDD. Every placeholder shape/color/tone in the current build is listed here as what it needs to become.*
*Cross-references `THE_HOLLOW_BENEATH_Improved_GDD_v2.md` Appendix and `THE_HOLLOW_BENEATH_Production_Plan.md` Section 3, reconciled where the two disagreed slightly on counts.*

Right now, **100% of visual art and 100% of music/ambient audio is placeholder.** Every enemy is a colored circle, every boss a colored hexagon, every UI panel a flat rounded rectangle, every sound effect a synthesized oscillator blip. This is exactly the right way to build an MVP — but it means this list isn't a "nice to have" pass, it's the entire remaining art surface of the game.

---

## How to use the priority tiers

- **P0 — First Playable Art Pass.** Highest perceived-polish-per-hour. Do these first; several are near-zero-cost swaps.
- **P1 — Core Content Parity.** Fills out the full roster so nothing in a normal playthrough is still a placeholder shape.
- **P2 — Depth & Atmosphere.** Phase variants, environments, music, and the narrative-signature VFX. Makes the difference between "complete" and "immersive."

---

## Established Art Direction (already implied by the code — don't ignore this)

The placeholder system already encodes a palette. Treat it as your starting brief, not a constraint to throw out:

| Token | Hex | Reads as |
|---|---|---|
| `void` | `#0B0D10` | Near-black background |
| `stone` / `stoneLight` | `#16191D` / `#22262C` | Charcoal architecture, UI base |
| `bone` / `boneMuted` | `#E8E2D4` / `#9A9488` | Parchment/bone — Venn architecture, primary text |
| `gold` / `goldBright` | `#C9A24B` / `#E9C876` | Venn-tech accent, UI highlight, currency |
| `danger` | `#B0453F` | Combat/threat accent |
| `ok` | `#5C8A5C` | Recovery/positive accent |
| `player` | `#7FB0C9` | Lyra's signature soft cyan-blue |

This reads as "dead civilization in cold stone and warm bone, lit by one warm gold accent" — consistent with the GDD's tone (a five-thousand-year-old dead city, not a fantasy dungeon). Whoever you brief should see this table first.

---

## 1. Character & Creature Sprites — P0/P1

### P0
| Asset | Notes |
|---|---|
| **Lyra Vane — board token** | Currently `PALETTE.player` (soft cyan-blue) circle. Small overworld token. |
| **Lyra Vane — combat sprite/portrait** | Full-body or bust, canvas explorer's coat, one bandaged arm (Keth-7 injury per GDD 2.3). This is the face of the game — prioritize it above all enemy work. |
| **Lyra's Venn tablet** | Recurring narrative prop (auto-translates unprompted per GDD). Worth a distinct icon/prop asset since it's referenced repeatedly in Whispers and events. |
| **1–2 sample enemy sprites** | Build and lock the *pipeline* (proportions, outline weight, palette application) on one or two enemies before mass-producing the other ten — cheaper to course-correct on one sprite than twelve. |

### P1 — the remaining 11 standard enemies
Each currently exists only as a flat-colored circle token; established hue is listed as a starting anchor.

| Enemy | Established color | Visual anchor from lore/kit |
|---|---|---|
| Echo-bleached Skeleton | `#8A8A82` (bone grey) | Undead remnant; resistant to Slash, weak to Blunt/Sacred |
| Venn Custodian | `#6F7F8F` (slate) | Archive golem; stone/mechanical, Blunt attacker |
| Sable Zealot | `#8C2F2F` (crimson) | Sable Order robes, ash-marked forehead, flame iconography |
| Ash Covenant Seer | `#7B4B9E` (violet) | Crystalline growths, wrong-refracting eyes |
| Memory Wraith | `#5DADE2` (cyan) | Ghostly, only appears Resonance ≥25; high dodge |
| Sable Inquisitor | `#A23A3A` (deep red) | Sable elite, heavier armor than Zealot |
| Ash Covenant Mutant | `#5A3A6E` (dark violet) | Further-transformed Covenant convert; enrages low-HP |
| Dominion Echo-Soldier | `#556B78` (steel) | Ancient armored construct, Pierce-based |
| Dust Wight | `#7A6A52` (dusty tan) | Early-game filler; desert/dust-touched remnant |
| Dust-Road Raider | `#C08A3E` (amber) | Caravan-aligned human combatant — layered desert fabrics per GDD faction visual |
| Archive Cipher-Wraith | `#4A6FA5` (archive blue) | Archive-aligned spectral text/cipher entity |
| The Unread | `#2C1F3D` (near-black violet) | Apex predator, Resonance ≥50 only — should read as the most Loom-touched/wrong of the roster |

**Note:** the last four are new additions beyond the GDD's original 8 and don't have GDD prose descriptions — the visual anchors above are inferred from their names, palette, and faction gating. Worth a short design pass to confirm intended look before an artist commits to them.

### P1/P2 — Bosses (5, each currently a colored hexagon)
| Boss | Color | Phase count | Notes |
|---|---|---|---|
| The Argent Sentinel | `#B9C4CC` (silver-blue) | 3 phases | Curator → Erudite → Desperate Guardian. DEF drops, ATK rises in Phase 3 — should visibly look more damaged/frantic. |
| Patriarch Oren Cass | `#8C2F2F` (crimson) | Base + <30% HP shift | Stops healing, gains Martyr's Flame — a "burning/martyred" visual shift at the threshold would sell the mechanic. |
| The Merged Chorus | `#9B59B6` (violet) | No discrete HP phases (adaptive weakness each round) | Consider a design where its dominant color/pattern visibly shifts round-to-round to telegraph the current weakness type — this would be a genuine gameplay-readability win, not just flavor. |
| The Fossil King | `#7A6A4F` (dust/tan) | 4 phases | Regal Decree → Rebellion → Silence → Fossil. SPD drops hard and it becomes weak to everything in Phase 4 — should look like it's crumbling/inert by the end. |
| The Final Reflection | `#D8C08A` (pale gold) | Adapts to player's build | See flag below. |

**Design flag worth resolving before art starts:** the Reflection's stats and moveset derive from the player's own build (highest stat, faction alignment, Resonance, and which prior bosses were defeated — see GDD 10.5's adaptation table). Built literally, that's a large combinatorial space of "looks." Recommend a **modular approach**: one base Reflection silhouette (it's explicitly "you, but wrong") with swappable accent elements — a damage-type-colored aura, a faction-colored sigil, a Resonance-tier distortion overlay — rather than bespoke full sprites per state. Cheaper, and thematically better since "still recognizably Lyra, subtly corrupted" is a stronger beat than "a different monster each time."

### P2 — Summons & non-combat portraits
| Asset | Notes |
|---|---|
| Echo of Hunger / Emptiness / Harmony / Cleanliness (4) | Reflection Phase 2 summons, tied to specific player choices. Currently untextured (fall through to a default grey token). **Suggestion:** since these are manifestations of the player's *own* choices, consider a shared "fractured shard of Lyra" visual template rather than four unrelated monster designs — reinforces the "the boss is made of you" theme and is cheaper than four bespoke enemies. |
| Sera Voss — combat portrait | Exists as a fightable combatant (Rob Her option, EVENT-004). Currently shares the generic token system (`#B08A4E`). |
| Sera Voss — event portrait | Distinct from her combat sprite — she's introduced as an NPC at a campfire (EVENT-004), not a monster. Needs a "person," not a "token." |
| Patriarch Oren Cass — approach portrait | The Landmark 2 Approach stage is framed as dialogue at an altar before the fight begins — a distinct, calmer portrait from his hexagon battle sprite would sell that beat. |
| Archivist Mira Tol | GDD 2.5: "met at events, never fought." **Portrait only — no combat sprite needed.** Don't budget animation work here. |
| Ash Covenant representative | GDD notes the Covenant has no single leader ("The Chorus is their cathedral"). If a portrait is wanted for Covenant-aligned events, it should read as a generic convert, not a named leader. |

---

## 2. Faction Identity — P1

Currently 4 flat-colored rounded squares (`faction_sable`, `faction_archive`, `faction_covenant`, `faction_caravan`), used in UI bars.

| Faction | GDD visual identity |
|---|---|
| Sable Order | Deep crimson robes, ash-marked foreheads, flame iconography |
| Argent Archive | Pale blue scholar's coats, brass goggles, ink-stained fingers |
| Ash Covenant | Crystalline growths, wrong-refracting eyes |
| Dust-Road Caravan | Layered desert fabrics, maps tattooed on forearms — GDD explicitly notes "no fixed symbol," so this emblem needs a deliberate design choice (a recurring motif like a compass-rose or route-map glyph would fit "no *official* symbol" while still being legible as a UI chip) |

Each needs a proper crest/emblem (not just a color swatch) for the faction UI bars, the shard-shop unlock icons that grant faction influence, and potentially a banner/wall-dressing motif for their respective Landmark backgrounds.

---

## 3. Board & Environment Backgrounds — P1/P2

The GDD Appendix asks for "10 node background variations"; the Production Plan's asset budget separately itemizes page backgrounds, combat arenas, and menu screens. Reconciled into one number:

| Category | Count | Priority | Notes |
|---|---|---|---|
| Page backgrounds (board/exploration) | 10 | P1 | One per Page (1–10). Currently solid-color rectangles per scene. |
| Combat arena backgrounds | 5 | P2 | Production Plan groups pages into 5 macro-environments (Vault, Sanctum, Chorus-chamber, Throne, Road — matching the 5 ambient BGM tracks below), each spanning 2 pages. Combat scenes reuse one arena per environment rather than needing 10 distinct arenas. |
| Title screen | 1 | P0 | First thing every player sees — outsized impact for one asset. |
| Menu/Shard Shop background | 1 | P1 | |
| Parallax layers | ~15 | P2 | Half-height, tileable, reusable across multiple backgrounds for depth. Lowest-priority line item here — the game is fully playable and readable without them. |

**Node-type icons (6)** — currently basic geometry, and this is a case where the placeholder is already *functionally* fine:

| Node | Current shape | Color |
|---|---|---|
| Event | Diamond | Gold |
| Combat | Triangle | Danger red |
| Rest | Cross | Ok green |
| Discovery | Star | Blue |
| Trap | Triangle | Orange |
| Landmark | Crown | Bright gold |

These are already legible and color-differentiated — this is a **texture pass, not a redesign** (P1, low effort/low risk). One real gap worth fixing in the process: Combat and Trap currently share the same triangle shape and rely on color alone to differentiate, which is a minor accessibility issue for colorblind players — worth giving Trap a distinct shape (e.g., a jagged/broken glyph) when it gets its real art pass.

---

## 4. UI Chrome — P0/P1

Nine panel textures, currently flat rounded rectangles differentiated only by size:

| Texture key | Size | Used for |
|---|---|---|
| `panel_dialog` | 800×220 | Dialogue/event box — highest visibility, do first |
| `panel_stat` | 300×165 | HP/MP/Resonance stat readout |
| `panel_button` / `panel_button_hover` | 260×52 | Primary buttons, 2 states |
| `panel_stepper` | 40×40 | Point-buy +/- controls |
| `panel_preset` / `panel_preset_hover` | 120×38 | Character preset buttons, 2 states |
| `panel_combat_hud` | 780×160 | AP/Momentum/turn order readout |
| `panel_enemy` | 110×130 | Per-enemy combat panel |

A single cohesive "worn stone tablet / Archive parchment" texture treatment applied consistently across all nine would do more for perceived production value than almost anything else on this list — it's the frame around every single screen in the game. **P0.**

**Particle texture** — currently one generic 8px white dot used for all effects. Needs a real small set (P1/P2): hit spark, critical burst, weakness-exploited flash, Momentum-full glow, checkpoint save sparkle, victory/ending shatter shard.

---

## 5. Resonance Visual Effects — P2 (but high-value)

The GDD calls Resonance "the visible signature" of the game's central mechanic (chromatic aberration at Awakened, UI warp/double-vision at Unmoored, persistent distortion/text-glitches at Transcendent). The Production Plan proposed GLSL shaders for this. Currently it's a single tweened color-tint rectangle — functional, but the biggest gap between ambition and reality in the whole project. This is shader/VFX-code work more than raster art, so it can proceed on a separate track from character art — worth pairing with a technical artist or doing early since it doesn't block on the character-art pipeline.

---

## 6. Iconography — P1

| Set | Count | Notes |
|---|---|---|
| Echo Shard icon | 1 | Meta-currency, shown constantly in HUD and shop — high visibility for one icon |
| Shard Shop unlock icons | 11 | Rusty Dagger+, Scholar's Coat, Venn Fragment, 4× faction Blessing, Resonance Anchor, Survivor's Mark, True Sight, New Game+ |
| Status effect icons | 13 | 6 stackable DoTs (Poison/Burn/Bleed/Curse/Frostbite/Shock) + 7 control effects (Sleep/Fear/Silence/Blind/Confuse/Stun/Root) — plus 7 buffs and 6 debuffs if you want full visual coverage |
| Skill icons | 25 | One per skill across the 6 trees. Color-coding by the already-established damage-type palette (Section 1 of this doc references the 8 damage-type colors from the GDD) would cut design decisions per icon significantly |
| Lore Fragment / Codex icon | 1–2 | For the Lore Codex screen |

---

## 7. Typography — P0 (cheap, high impact)

Currently Georgia + Courier New — functional system fonts, zero cost, but generic. The Production Plan's original recommendation (Crimson Text for body, VT323 for pixel/mono UI numbers, both subset to WOFF2) is a **two-file swap** that would meaningfully lift perceived quality for very little effort. This is one of the best effort-to-impact ratios on this entire list — do it early.

---

## 8. Audio — Music & Ambience — P2

**Currently zero music or ambience exists.** The game is silent except for UI blips. Reconciled target list:

| Category | Count | Notes |
|---|---|---|
| Ambient/environment loops | 5 | One per macro-environment (Vault, Sanctum, Chorus-chamber, Throne, Road), paired with the 5 combat arena backgrounds above |
| Combat intensity loops | 3 | Low/mid/high, per Production Plan |
| Boss themes | 5 | One per major Landmark — these can be longer, bespoke pieces (2–3 min) since there are only 5 |
| Ending stingers | 6–7 | One per ending — **now 7, not 6** (see the "Unfinished" fallback ending noted in the companion audit report) |
| Faction leitmotifs | 4 | Lowest priority in this category — nice-to-have texture for faction-heavy events, not load-bearing |

## 9. Audio — SFX — P1

17 cues are currently faked with Web Audio oscillator tones and confirmed wired into the code: `click`, `confirm`, `diceRoll`, `moveStep`, `hit`, `critHit`, `miss`, `weaknessHit`, `heal`, `damageTaken`, `statusApplied`, `momentumFull`, `victory`, `defeat`, `bossPhase`, `levelUp`, `shardGain`, `pageTurn`. These are your P1 floor — replace these 17 first since they're the ones already proven to be called from real gameplay code, not speculative.

Beyond that floor, the Production Plan's full SFX budget target (~55 sounds) implies real variety per category worth planning for eventually — different weapon-hit sounds per damage type, spell-cast variety, footstep/movement variety, UI hover/error states — but that's P2 polish on top of the P1 floor above.

---

## 10. Audio — The Loom's Voice — P2, but start the prototype early

This is the GDD's signature narrative-delivery mechanic (Tier 1 Whispers) and it's currently pure on-screen text via `WhisperOverlay`, with no voice layer at all. The Production Plan's Web Speech API approach (browser TTS + procedural reverb/delay, pitch/rate keyed to Resonance intensity) is clever specifically because **it costs zero asset files** — it's code and design work, not something that waits on an artist or a voice actor. Recommend prototyping this early and in parallel with everything else on this list, since it doesn't compete for the same production resources as the rest of the checklist.

---

## Master Count Summary

| Category | Items | Priority spread |
|---|---|---|
| Character/creature sprites | 1 protagonist + 12 enemies + 5 bosses (+ phase variants) + 5 summons + 4 portraits | P0→P2 |
| Faction emblems | 4 | P1 |
| Backgrounds | 10 page + 5 arena + title + menu (+ ~15 parallax) | P0→P2 |
| Node icons | 6 (texture pass on existing legible shapes) | P1 |
| UI panels | 9 | P0 |
| Particles | ~6-piece set | P1/P2 |
| Resonance VFX | 3 tiers (shader work) | P2 |
| Icons (Shard/unlocks/status/skills) | 1 + 11 + 13 + 25 | P1 |
| Fonts | 2 files | P0 |
| Music/ambient tracks | 5 + 3 + 5 + 7 + 4 = 24 | P2 |
| SFX | 17 confirmed-wired + ~38 more for full budget | P1→P2 |
| Loom voice system | 1 system (code, not asset) | P2 (start early) |

Recommended order of attack: **fonts → UI panel texture pass → title screen → Lyra sprite → node icon texture pass → first 2 enemy sprites (lock the pipeline) → remaining enemies → boss base states → 10 page backgrounds → SFX floor (17 cues) → everything else in Section-order above.**
