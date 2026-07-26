# ART ASSET CHECKLIST — Detailed Production Specs

*Every texture key in the codebase, with precise specs for production. Cross-referenced against `src/placeholder/PlaceholderTextures.ts` and all scene files that consume each key.*

---

## How to Add a New Texture (Code Pattern)

In `src/scenes/PreloadScene.ts`, add before `generatePlaceholderTextures(this)`:

```ts
// Real art loading
this.load.image('tok_player', 'assets/tok_player.png');
// Optional: replace individual enemy tokens
this.load.image('tok_echo_skeleton', 'assets/tok_echo_skeleton.png');

// Then generate remaining placeholders for keys without real art
generatePlaceholderTextures(this);
```

Phaser's `generateTexture()` does **not** overwrite an existing key (`if (scene.textures.exists(key)) return`), so loaded real textures take priority.

---

## 1. Character & Creature Tokens

### 1.1 Player Token

| Field | Value |
|-------|-------|
| **Key** | `tok_player` |
| **Size** | 56×56 px |
| **Format** | PNG with alpha |
| **Used in** | `BoardScene`, all combat scenes |
| **Current** | Blue circle (`#7FB0C9`), bone ring |
| **Art direction** | Lyra Vane — hooded explorer, canvas coat, bandaged arm, facing forward. Soft cyan-blue as primary color. |
| **Priority** | **P0** |

### 1.2 Standard Enemies (12)

Base size: **52×52 px**, PNG with alpha. All used in `CombatScene` and `EventScene` (Sera Voss only).

| Key | Established Color | Visual Anchor | Notes |
|-----|------------------|---------------|-------|
| `tok_echo_skeleton` | Bone grey `#8A8A82` | Undead remnant, cracked bone, resistant to Slash | See `enemies.ts:echo_skeleton` |
| `tok_venn_custodian` | Slate `#6F7F8F` | Archive golem — stone/mechanical, inscribed glyphs | See `enemies.ts:venn_custodian` |
| `tok_sable_zealot` | Crimson `#8C2F2F` | Sable robes, ash-marked forehead, flame iconography | See `enemies.ts:sable_zealot` |
| `tok_ash_seer` | Violet `#7B4B9E` | Crystalline growths, wrong-refracting eyes | See `enemies.ts:ash_seer` |
| `tok_memory_wraith` | Cyan `#5DADE2` | Ghostly, translucent, Resonance ≥25 gated | See `enemies.ts:memory_wraith` |
| `tok_sable_inquisitor` | Deep red `#A23A3A` | Sable elite, heavier armor than Zealot | See `enemies.ts:sable_inquisitor` |
| `tok_ash_mutant` | Dark violet `#5A3A6E` | Distorted, enrages at low HP | See `enemies.ts:ash_mutant` |
| `tok_echo_soldier` | Steel `#556B78` | Ancient armored construct, Pierce-based | See `enemies.ts:echo_soldier` |
| `tok_dust_wight` | Dusty tan `#7A6A52` | Desert remnant, wrapped, early-game filler | See `enemies.ts:dust_wight` |
| `tok_dust_road_raider` | Amber `#C08A3E` | Human scavenger, layered desert fabrics | See `enemies.ts:dust_road_raider` |
| `tok_archive_cipher_wraith` | Blue `#4A6FA5` | Spectral text/cipher entity, geometric | See `enemies.ts:archive_cipher_wraith` |
| `tok_the_unread` | Near-black violet `#2C1F3D` | Apex predator, Resonance ≥50, most Loom-touched | See `enemies.ts:the_unread` |
| `tok_sera_voss` | Gold-brown `#B08A4E` | Named NPC — should read as a person, not a monster | See `events.ts` EVENT-004 |

### 1.3 Bosses (5)

Base size: **112×112 px**, PNG with alpha. Used in `LandmarkScene` and `CombatScene`.

| Key | Color | Phases | Art Notes |
|-----|-------|--------|-----------|
| `tok_sentinel` | Silver-blue `#B9C4CC` | 3 phases | DEF drops, ATK rises — visibly damage/degrade across phases |
| `tok_patriarch` | Crimson `#8C2F2F` | 2 phases | Burning/martyred visual shift at <30% HP threshold |
| `tok_chorus` | Violet `#9B59B6` | Dynamic weakness | Color-shifts visually each round to telegraph current weakness type |
| `tok_fossil_king` | Dust/tan `#7A6A4F` | 4 phases | Crumbles/degrades visually, by Phase 4 looks inert |
| `tok_reflection` | Pale gold `#D8C08A` | Build-adaptive | Modular: 1 base "you but wrong" + swappable aura/sigil/distortion per state |

### 1.4 Summons (Reflection Phase 2)

These are currently untextured (fall through to default grey). **Consider a shared "fractured shard of Lyra" template** for all 4 summons (Echo of Hunger / Emptiness / Harmony / Cleanliness) — cheaper and thematically stronger.

---

## 2. Board Node Icons (6)

| Key | Size | Shape | Color | Art Target |
|-----|------|-------|-------|------------|
| `node_event` | 32×32 | Diamond | Gold `#C9A24B` | Scroll/quill glyph |
| `node_combat` | 32×32 | Triangle | Danger `#B0453F` | Crossed swords glyph |
| `node_rest` | 32×32 | Cross | Green `#5C8A5C` | Campfire/bedroll glyph |
| `node_discovery` | 32×32 | Star | Blue `#5DADE2` | Crystal/treasure glyph |
| `node_trap` | 32×32 | Triangle | Orange `#E67E22` | Spike/trap jaws (distinct shape from combat — accessibility) |
| `node_landmark` | 44×44 | Crown | Gold `#E9C876` | Boss skull / castle glyph |
| `particle` | 8×8 | Circle | White | Small particle set (hit/crit/heal/momentum/checkpoint/victory) |

All PNG with alpha. Used in `BoardScene` for board rendering + `NodePreview` tooltips.

---

## 3. UI Panels (12)

**Priority: P0** — unified "worn stone tablet / Archive parchment" texture across all 12.

| Key | Size (px) | States | Used In |
|-----|-----------|--------|---------|
| `panel_dialog` | 800×220 | 1 | EventScene, DialogBox, TutorialScene |
| `panel_stat` | 300×165 | 1 | StatPanel, CharacterCreation, BoardScene |
| `panel_button` | 260×52 | Normal | Button.ts — all scenes |
| `panel_button_hover` | 260×52 | Hover | Button.ts — all scenes |
| `panel_combat_hud` | 780×160 | 1 | CombatHUD, CombatScene |
| `panel_enemy` | 110×130 | 1 | CombatHUD — per-enemy display |
| `panel_stepper` | 40×40 | 1 | CharacterCreation stats, LevelUpModal |
| `panel_preset` | 120×38 | Normal | CharacterCreation preset buttons |
| `panel_preset_hover` | 120×38 | Hover | CharacterCreation preset buttons |
| `panel_levelup` | 400×300 | 1 | LevelUpModal |
| `panel_skilltree` | 600×400 | 1 | SkillTreeScene |
| `panel_runstats` | 600×400 | 1 | RunStatsScreen |

Phaser 3.70 supports 9-slice textures (`this.add.nineslice()`), which would let a single small panel texture stretch cleanly to any size. Recommended for all panels if creating from scratch.

---

## 4. Faction Emblems (4)

24×24 px, PNG with alpha. Used in UI faction influence bars across all scenes.

| Key | Faction | Identity & Motif |
|-----|---------|------------------|
| `faction_sable` | Sable Order | Flame icon, deep crimson palette |
| `faction_archive` | Argent Archive | Book/scroll/inkwell, pale blue palette |
| `faction_covenant` | Ash Covenant | Crystal/geometric glyph, violet palette |
| `faction_caravan` | Dust-Road Caravan | Compass-rose or route-map, amber palette |

---

## 5. Echo Shard & Skill Icons

| Set | Count | Size | Priority |
|-----|-------|------|----------|
| Echo Shard icon | 1 | 24×24 | P1 |
| Shard Shop unlock icons | 11 | 32×32 | P1 |
| Status effect icons | 13 (dots) + 7 (controls) + 7 (buffs) + 6 (debuffs) = 33 | 24×24 | P1 (P2 for full set) |
| Skill icons | 25 | 32×32 | P1 |

---

## 6. Backgrounds

| Asset | Count | Size | Priority |
|-------|-------|------|----------|
| Page backgrounds (board/exploration) | 10 (one per 2-page pair) | 1280×800 | P1 |
| Combat arena backgrounds | 5 (one per macro-environment) | 1280×800 | P2 |
| Title screen | 1 | 1280×800 | P0 |
| Menu / Shard Shop background | 1 | 1280×800 | P1 |
| Parallax layers | ~15 reusable tileable | Half-height | P2 |

---

## 7. Audio — Wired SFX Cues (22 total)

All synthesized via Web Audio API in `src/placeholder/PlaceholderAudio.ts`.

### P1 — Replace These First (proven wired in gameplay code)

| Method | Context | Tone Character |
|--------|---------|----------------|
| `audio.click()` | UI clicks | Short triangle blip, 420Hz |
| `audio.confirm()` | Confirm actions | Rising double tone, 520→720Hz |
| `audio.diceRoll()` | Board movement rolling | 4 rapid square tones, 300→420Hz |
| `audio.moveStep()` | Board token advancing | Short square tone, 260Hz |
| `audio.hit()` | Successful attack hit | Sawtooth burst, 150Hz |
| `audio.critHit()` | Critical hit | Double sawtooth, 200→320Hz |
| `audio.miss()` | Attack miss | Soft sine, 180Hz, low volume |
| `audio.weaknessHit()` | Exploited damage type | Rising triangle, 500→700Hz |
| `audio.heal()` | HP/MP restoration | Rising sine, 480→640Hz |
| `audio.damageTaken()` | Player damaged | Low sawtooth, 120Hz |
| `audio.statusApplied()` | Status effect applied | Square tone, 380Hz |
| `audio.momentumFull()` | Momentum gauge full | 4-note ascending arpeggio, 440→880Hz |
| `audio.victory()` | Combat won | Triumphant 4-note ascending, 392→784Hz |
| `audio.defeat()` | Player death | 4-note descending, 392→220Hz |
| `audio.bossPhase()` | Boss phase transition | Low drone + deep bass, 150→80Hz |
| `audio.levelUp()` | Character level up | Bright ascending, 523→1047Hz |
| `audio.shardGain()` | Echo Shard earned | High sine double-tap, 900→1200Hz |
| `audio.pageTurn()` | Page transition | Soft double-click, 200→160Hz |
| `audio.checkpoint()` | Checkpoint save | Bright ascending, 660→880Hz |

### P1 Additional (from PLAN_OVERHAUL additions)

| Method | Context | Notes |
|--------|---------|-------|
| `audio.skillPurchase()` | SkillTreeScene purchase | (not yet implemented — code change needed) |
| `audio.pageTransition()` | Chapter card transition | (not yet implemented) |
| `audio.menuHover()` | UI element hover | (not yet implemented) |
| `audio.errorBuzzer()` | Invalid action / clear data confirm | (not yet implemented) |

### P2 — Full SFX Budget Goals

~55 sounds total including: per-damage-type hit sounds, footstep variety, spell-cast variety, UI hover/error states, faction-specific encounter stingers.

---

## 8. Music & Ambience (P2, 24 tracks total)

| Category | Count | Contexts |
|----------|-------|----------|
| Ambient loops | 5 | One per macro-environment |
| Combat intensity loops | 3 | Low / mid / high intensity |
| Boss themes | 5 | One per major land-mark |
| Ending stingers | 7 | One per ending |
| Faction leitmotifs | 4 | Ambient texture for faction-heavy encounters |

---

## 9. Typography (P0 — 2 files, highest effort-to-impact ratio)

| Current | Target | Format |
|---------|--------|--------|
| Georgia (body text everywhere) | Crimson Text | WOFF2 subset |
| Courier New (mono/UI numbers) | VT323 | WOFF2 subset |

Place in `public/fonts/`, load via `@font-face` in `index.html` or `src/style.css`.

---

## Existing Asset Files

- `docs/THE_HOLLOW_BENEATH_Art_Audio_Asset_Checklist.md` — full priority breakdown with narrative flavor notes per asset
- `docs/ASSET_PLAN_ALIGNMENT.md` — reconciliation between checklist and current codebase state
- `src/placeholder/PlaceholderTextures.ts` (lines 145–208) — `generatePlaceholderTextures()` — the complete code generating every texture above
- `src/placeholder/PlaceholderAudio.ts` (lines 43–61) — `PlaceholderAudioEngine` class generating all 22 wired SFX cues
