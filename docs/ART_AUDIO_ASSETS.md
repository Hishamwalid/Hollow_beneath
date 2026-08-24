# THE HOLLOW BENEATH — Art & Audio List + Checklist

*Definitive Edition asset reference. Pipeline is **placeholder-first**: anything missing is generated procedurally at boot (`PlaceholderTextures.ts` / `PlaceholderAudio.ts`), so the game always runs. Drop real files into `public/assets/` and they take priority.*

**Status legend:** ✅ real asset integrated · 🎨 procedural placeholder in use · ⬜ required, not yet produced

---

## 1. Real Assets Currently Integrated (53 files, `public/assets/image_assets/`)

### Fonts (`public/assets/fonts/`) ✅
| Font | Role |
|------|------|
| Cinzel (WOFF2) | Display / titles (`HollowCinzel`) |
| IM Fell English (WOFF2) | Body text |
| Courier Prime (WOFF2) | Numerics / HUD (`HollowMono`) |

### Backgrounds ✅
| File | Used as | Status |
|------|---------|--------|
| `backgrounds/stage1_background.png` | Chapter 1 board map (hand-authored node path overlay) | ✅ |
| `backgrounds/map1.png … map5.png` | Chapter map screens 1–5 (The Archive Opens → The Final Descent) | ✅ |
| `backgrounds/combat_stage1_sand.png` | Combat bg, early chapter 1 (nodes 1–30) | ✅ |
| `backgrounds/combat_stage1_stone.png` | Combat bg, late chapter 1 (nodes 31–40) | ✅ |
| `backgrounds/combat_stage1_boss.png` | Argent Sentinel arena | ✅ |

### Player sprite set ✅
`player/base_player.png`, `idle`, `windup`, `attack`, `guard`, `hit`, `victory`, `defeated`, `face`, `player_pin` (board token).

### Enemy sprite sets ✅
| Set | Frames |
|-----|--------|
| `enemy/dust_wight/` | idle, attack, hit, face |
| `enemy/echo_skeleton/` | idle, attack, hit, face |
| `enemy/sentinel/` | 17 frames: idle×2, attack×2, hit×2, guard, face×2, half, transform×2, defeat×3, victory×2 |

### UI ✅
`ui/panel_book.png` (dialog/action book panel), `ui/token_2/3/4/7/8.png` (combat tokens).

---

## 2. Procedural Placeholders Currently in Use 🎨

Everything not listed above is generated at boot via Phaser Graphics / Web Audio:

- **Enemy tokens** — circle/hex tokens tinted per enemy for all 12 standard enemies, the 4 Echoes, and bosses 2–5 (patriarch, chorus, fossil king, final reflection). Only Dust Wight, Echo Skeleton, and Sentinel have real sprite sets.
- **Node icons** — event/combat/discovery/rest/trap/landmark glyphs on the board.
- **UI panels/buttons** — 9-slice panels, button plates, choice-menu frames beyond `panel_book`.
- **All SFX** — 22 synthesized cues via Web Audio oscillators (click, confirm, dice roll, move step, hit, crit, miss, weakness, heal, damage taken, status applied, momentum full, page turn, checkpoint, level up, shard gain, victory, defeat, boss phase…). No music.
- **Ending drone** — two detuned sines in `EndingScene` standing in for the Loom hum.

---

## 3. New Art Requirements — Definitive Edition ⬜

From the implementation guide (Part VII) plus gaps opened by the narrative revamp:

| Asset | Purpose | Notes | Priority |
|-------|---------|-------|----------|
| `bg_final_chamber.png` | Node 200 approach + ending backdrop | The Loom. Mirror/choir visual — no face / every face. Gold-white flood for Ending 1 | P0 |
| `cg_hollow_throne.png` | Ending 1 beat | PLAYER seated on silver throne of dust and bone | P0 |
| `cg_the_offer.png` | The Offer scene (defeat choice) | Broken chamber. PLAYER kneeling, REFLECTION standing | P0 |
| `cg_lost_in_dark.png` | Ending 2 beat | PLAYER dissolving into stone; architecture absorbing the body | P0 |
| `cg_the_return.png` | Ending 3 beat | Surface room mirroring the prologue desk — journal open, PLAYER's handwriting | P0 |
| `spr_final_reflection.png` (+ idle/attack/hit/victory/defeat) | Final boss sprite | PLAYER's model with hollow eyes, translucent skin | P0 |
| Boss sprites — `patriarch`, `chorus`, `fossil_king` | Landmark encounters ch 2–4 | Match Sentinel set depth (idle/attack/hit/face/defeat minimum) | P1 |
| Enemy sets — `venn_custodian`, `sable_zealot`, `ash_seer`, `dust_road_raider`, `archive_cipher_wraith`, `memory_wraith`, `sable_inquisitor`, `ash_mutant`, `echo_soldier`, `the_unread`, 4 Echoes | Ch 2–5 rosters | idle/attack/hit/face each | P1 |
| `eve_portrait.png` | Node 185 reveal / memory-room flash | Young Eve, expedition gear, holding a journal — used translucent/faded | P1 |
| Combat backgrounds ch 2–5 (`bg_combat_ch2…ch5`) | Combat scenes past chapter 1 | Faith-warrens stone, singing-deep blue, imperial basalt, silver gallery | P2 |
| Board map touch-ups (`map2–map5` node-path pass) | Hand-authored node positions per chapter (only ch 1 has a clicked path) | Dev tool exists: `?editpath=1` | P2 |

## 4. New Audio Requirements — Definitive Edition ⬜

| Asset | Purpose | Notes | Priority |
|-------|---------|-------|----------|
| `sfx_loom_hum.(ogg/wav)` | Ambient drone for Final Chamber + endings | Low choral drone, layered whispers. (Currently: detuned sine pair in `EndingScene`) | P0 |
| `sfx_wind_stone.(ogg/wav)` | Credits tail | Wind over stone under Eve's last line | P0 |
| `vo_eve_lines_01–06.(ogg/wav)` | Eve V.O. beats (nodes 8/92/175/185, endings, credits) | Must stay ambiguous — memory or Loom? Text-only fallback already wired | P1 |
| Music — descent ambience ×5 chapters, boss themes ×5, ending stingers ×3 | Full score | All audio is synth today; no music exists | P2 |
| Replace all 22 synth cues with recorded SFX | Global feel pass | Cue map already wired through `PlaceholderAudio` API | P2 |

---

## 5. Master Checklist

**P0 — blocking the definitive-edition experience**
- [ ] `bg_final_chamber`
- [ ] `spr_final_reflection` set
- [ ] 4 ending/Offer CGs (`cg_hollow_throne`, `cg_the_offer`, `cg_lost_in_dark`, `cg_the_return`)
- [ ] `sfx_loom_hum` + `sfx_wind_stone`

**P1 — closing the visual gap**
- [ ] Boss sprites: patriarch / chorus / fossil_king
- [ ] Enemy sets for chapters 2–5 rosters + Memory Wraith + The Unread + 4 Echoes
- [ ] `eve_portrait`
- [ ] `vo_eve_lines` pack

**P2 — polish**
- [ ] Combat backgrounds for chapters 2–5
- [ ] Node-path authoring for chapter maps 2–5 (`?editpath=1`)
- [ ] Full music score + recorded SFX replacing synth cues
- [ ] Remaining UI icon set (action grid icons, faction crests)

**Integration notes**
1. Place PNG/WOFF2/Audio in `public/assets/**`.
2. Load in `PreloadScene.ts` *before* `generatePlaceholderTextures(this)` — placeholders skip keys that already exist.
3. Audio: extend `PlaceholderAudioEngine` (or an `AudioManager`) so cue call sites don't change.
