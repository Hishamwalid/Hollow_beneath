# THE HOLLOW BENEATH — Asset Plan Alignment

*Cross-match between `THE_HOLLOW_BENEATH_Art_Audio_Asset_Checklist.md` and the current repo state (200-node board per `PLAN_OVERHAUL.md` v1.1, no mini-bosses).*

> **STATUS UPDATE (August 2026).** This reconciliation predates the first art delivery batch
> and the battle overhaul. What actually happened since:
>
> - **Fonts delivered** — but as Cinzel / IM Fell English / Courier Prime (not the Crimson
>   Text / VT323 recommended below). Wired via `@font-face` in `style.css` as `Hollow*` families.
> - **Backgrounds delivered** — 5 chapter maps (`map1–map5`), the hand-authored Stage 1 board
>   background (`stage1_background.png`, 1920×1080), and 3 stage-1 combat backgrounds
>   (`combat_stage1_sand/_stone/_boss.png`). Stages 2–5 board/combat art still open.
> - **Combat sprites delivered** — full player set (7 poses + face + pin), Dust Wight +
>   Echo Skeleton sets, and the Argent Sentinel animation set (17 frames incl.
>   transform/victory/defeat sequences).
> - **UI delivered (partial)** — book panel + one board token; the other panels remain placeholders.
> - **SFX unchanged** — all 22+ cues are still Web Audio synthesized; no music yet.
> - Combat UI was rebuilt around the Echo Combat Architecture (intent cards, investigation,
>   positioning rows); per-element HUD offsets are live-tunable via `src/data/combatLayout.json`.
>
> Per-key status now lives in `docs/ART_ASSET_CHECKLIST_DETAILED.md` (§0/§6/§9 status columns)
> and `docs/ARTIST_ASSET_OVERVIEW.md`. The analysis below is kept as-is for reference.

---

## Overall Assessment: Feasible — 8 adjustments needed

The checklist is grounded in the actual code (verified against `PlaceholderTextures.ts`, `PlaceholderAudio.ts`, and every scene file). It correctly identifies all 17 wired SFX cues, all texture keys, all damage-type colors, and the palette. **No checklist items are obsolete.** However, the 200-node board expansion and the new systems from PLAN_OVERHAUL create 8 specific deltas:

---

## 1. Page Backgrounds — Count Mismatch

| Checklist says | Reality | Fix |
|---|---|---|
| "10 page backgrounds — one per Page (1–10)" | 20 pages exist (200 nodes, 10 per page) | Either produce **20 backgrounds** (one per page) or **group into 10 pairs** (pages 1–2 share bg A, 3–4 share bg B, etc.). The latter saves cost and matches the existing page-name themes (2 pages per "chapter" zone). |

**Recommendation:** Group pages 1–2 / 3–4 / ... / 19–20 into 10 background pairs. Each pair corresponds to one of the 10 existing page-name groups (The Vestibule + Ashfall, The Warrens + Archive Threshold, etc.). This matches what the page names already imply without requiring 20 unique pieces.

---

## 2. UI Panels — 4 New Surfaces Not in Checklist

| New surface | From PLAN_OVERHAUL phase | Panel texture needed |
|---|---|---|
| Level-up modal | A2 (Level-Up System) | Modal overlay — reuse `panel_dialog` or add `panel_levelup` (400×300) |
| Skill tree scene | A3 (Skill Tree) | `panel_skilltree` for the tree background + per-node highlight states |
| Tutorial scene (5 screens) | C1 (Onboarding) | Reuses `panel_dialog` — no new texture needed |
| End-of-run stats screen | C4 (Run Stats) | New `panel_runstats` (600×400) or reuse `panel_dialog` at larger size |

**Recommendation:** Add `panel_levelup`, `panel_skilltree`, `panel_runstats` to the UI chrome list (Section 4 of the checklist). Tutorial reuses existing `panel_dialog` for its typewriter-text screens.

---

## 3. SFX — 5 New Cues Not in the Checklist

PLAN_OVERHAUL introduces scenes that need audio cues beyond the 17 already wired:

| New cue | Scene | From |
|---|---|---|
| `checkpointSave()` | BoardScene (checkpoint polish) | C6 |
| `skillPurchase()` | SkillTreeScene | A3 |
| `levelUp()` | Already exists in checklist! | A2 (already counted) |
| `pageTransition()` | BoardScene (chapter cards) | C7 |
| `menuHover()` | Tutorial/Settings expanded UI | C1/C5 |
| `errorBuzzer()` | Settings (clear data confirm) | C5 |

**Update:** Add these 5 to the P1 SFX budget (currently 17 → 22 wired cues). The existing `levelUp()` is already wired, no change needed there.

---

## 4. Faction-Hostile Ambush SFX

Section 4.2 of PLAN_OVERHAUL adds ambush encounters when a faction is Hostile (≤-25). The combat scene already handles enemy encounters, but an ambush-specific cue (`ambushAlert()` or reuse `bossPhase()`) would sell the surprise. **Optional P2 — defer.**

---

## 5. Tutorial Scene — No New Assets Needed

The tutorial (C1) reuses `panel_dialog` for each of its 5 text screens and reuses `node_*` icons from the node-type icon set (already in the checklist at Section 3). **Zero new textures.** The typewriter effect uses the same dialog engine as EventScene.

---

## 6. Resonance VFX — Code Side Already Planned

`PLAN_OVERHAUL.md` Section 3.3 describes a `ResonanceFX.ts` manager with chromatic shift (Awakened), UI jitter + screen pulse (Unmoored), and text glitch + persistent vignette (Transcendent). The checklist Section 5 flags this as "the biggest gap between ambition and reality." **Both agree** — the code path is planned (C3, ~4h), and the checklist defers the GLSL/shader work to P2. No conflict.

---

## 7. Boss Count — Still 5 (Mini-Bosses Stripped)

The checklist lists 5 bosses (Sentinel, Patriarch, Chorus, Fossil King, Reflection) at P1/P2 priority. With mini-bosses stripped from PLAN_OVERHAUL, **this remains correct.** The 5 former mini-boss slots are now regular nodes, so no boss art is needed there. ✅

---

## 8. Page Names — Already Extended to 20

The code in `BoardScene.pageFlavor()` already defines 20 page names (`NAMES[19]`), and the depth ladder was recently updated from 10 to 20 dots. The page-flavor text displayed during gameplay references `"Page 20 / 20"` and `"two hundred pages"`. **No change needed.** ✅

---

## 9. Depth Ladder — Fixed

The right-side page navigation ladder previously showed only 10 dots (spaced `stepH = (bottomY - topY) / 9`). Now shows **20 dots** spaced by `(bottomY - topY) / 19`. ✅

---

## 10. Typography — No Conflict

The checklist's P0 recommendation (swap Georgia → Crimson Text, Courier New → VT323, subset to WOFF2) is independent of board size and systems. PLAN_OVERHAUL has no objection. **Proceed per checklist priority.**

---

## Updated Asset Inventory (Reconciled)

| Category | Checklist Original | Adjustment | Final |
|---|---|---|---|
| Page backgrounds | 10 (P1) | Group 20 pages into 10 pairs | **10** ✅ |
| Combat arena backgrounds | 5 (P2) | Unchanged — 5 macro-environments still match | **5** ✅ |
| UI panels | 9 (P0) | Add `panel_levelup`, `panel_skilltree`, `panel_runstats` | **12** |
| SFX wired cues | 17 (P1) | Add `checkpointSave`, `skillPurchase`, `pageTransition`, `menuHover`, `errorBuzzer` | **22** |
| Music tracks | 24 (P2) | Unchanged | **24** ✅ |
| Node icons | 6 (P1) | Unchanged | **6** ✅ |
| Lyra sprite + enemies | 1 + 12 (P0/P1) | Unchanged | **13** ✅ |
| Bosses | 5 (P1/P2) | Unchanged (mini-bosses stripped) | **5** ✅ |
| Faction emblems | 4 (P1) | Unchanged | **4** ✅ |
| Resonance VFX | 3 tiers (P2) | Unchanged | **3** ✅ |
| Skill icons | 25 (P1) | Unchanged | **25** ✅ |
| Fonts | 2 (P0) | Unchanged | **2** ✅ |
| Loom voice system | 1 system (P2) | Unchanged | **1 system** |

---

## Recommended Action Sequence

1. **Fonts (P0)** — swap Georgia → Crimson Text, Courier New → VT323 (subset WOFF2)
2. **UI chrome (P0)** — unified "worn stone tablet" texture pass on all 12 panels (original 9 + 3 new)
3. **SFX floor (P1)** — produce the 17 original cues + 5 new ones (22 total)
4. **Page backgrounds (P1)** — 10 backgrounds, one per 2-page pair
5. **Node icon texture pass (P1)** — legibility polish, differentiate trap shape from combat
6. **Lyra sprite + first 2 enemies (P0→P1)** — lock the art pipeline
7. **Remaining 10 enemies + 5 bosses (P1)** — full roster
8. **Tutorial/skill tree/level-up/stats UI (P1)** — these use the panel set from step 2
9. **Resonance VFX (P2)** — shader/tween code, separate track from raster art
10. **Music, Faction emblems, Loom voice (P2)** — lowest urgency

---

*Generated from: PLAN_OVERHAUL.md v1.1, THE_HOLLOW_BENEATH_Art_Audio_Asset_Checklist.md, and verified code inspection of PlaceholderTextures.ts, PlaceholderAudio.ts, BoardScene.ts, CombatScene.ts.*
