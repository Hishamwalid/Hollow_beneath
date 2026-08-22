# THE HOLLOW BENEATH — Artist Asset Overview

*What every texture key in the code should become. Most visuals are still procedurally generated shapes, but the first production batch is integrated; this document maps each remaining key to its target art asset.*

> **DELIVERED SO FAR (August 2026):** fonts (Cinzel / IM Fell English / Courier Prime),
> player combat frame set (7 poses + face + board pin), Dust Wight + Echo Skeleton sets,
> Argent Sentinel animation set (17 frames incl. transform/victory/defeat), chapter maps
> `map1–map5`, `stage1_background` (hand-authored Stage 1 board), 3 stage-1 combat
> backgrounds, book panel UI, one board token. See
> `docs/ART_ASSET_CHECKLIST_DETAILED.md` §0/§6/§9 for per-file status.

---

## How Textures Work in This Build

All sprites are generated at runtime in `src/placeholder/PlaceholderTextures.ts` using Phaser's `Graphics.generateTexture(key, w, h)`. Replacing a placeholder means:

1. Create the real sprite as a `.png` (recommended) or `.webp`
2. Place it in `public/assets/` (the Vite public directory)
3. In `PreloadScene.ts`, load it before generating placeholders:
   ```ts
   this.load.image('tok_player', 'assets/tok_player.png');
   ```
4. The rest of the code references textures by key — no call-site changes needed.

---

## Texture Key Inventory

### Player & Enemies

| Key | Current | Target Description | Suggested Size |
|-----|---------|-------------------|----------------|
| `tok_player` | Blue circle, bone ring | Lyra Vane — hooded explorer figure facing forward, soft cyan-blue cloak, bandaged arm | 56×56 |
| `tok_echo_skeleton` | Grey-brown circle | Skeletal humanoid remnant, cracked bone texture, tattered cloth | 52×52 |
| `tok_venn_custodian` | Slate-blue circle | Stone/mechanical archive golem, ancient construct, inscribed glyphs | 52×52 |
| `tok_sable_zealot` | Crimson circle | Sable Order devotee in deep red robes, ash-marked forehead, censer | 52×52 |
| `tok_ash_seer` | Violet circle | Ash Covenant seer with crystalline growths, wrong-refracting eyes | 52×52 |
| `tok_memory_wraith` | Cyan circle | Translucent ghostly entity, faint blue glow, only appears at Resonance ≥25 | 52×52 |
| `tok_sable_inquisitor` | Deep red circle | Sable elite in heavier armor than Zealot, masked, flame motifs | 52×52 |
| `tok_ash_mutant` | Dark violet circle | Twisted, further-transformed Covenant convert, grotesque | 52×52 |
| `tok_echo_soldier` | Steel-blue circle | Ancient armored construct, spear/shield, weathered metal | 52×52 |
| `tok_dust_wight` | Dusty tan circle | Desert-dusted remnant, wrapped form, early-game enemy | 52×52 |
| `tok_dust_road_raider` | Amber circle | Human combatant in layered desert fabrics, scavenger look | 52×52 |
| `tok_archive_cipher_wraith` | Archive blue circle | Spectral text/cipher entity, Archive-aligned, geometric patterns | 52×52 |
| `tok_the_unread` | Near-black violet circle | Apex predator, Loom-touched, wrong silhouette. Resonance ≥50 only | 52×52 |
| `tok_sera_voss` | Gold-brown circle | Named NPC portrait (camp encounter) — distinct from generic enemies | 52×52 |

### Bosses

| Key | Current | Target Description | Suggested Size |
|-----|---------|-------------------|----------------|
| `tok_sentinel` | Pale silver hexagon | Large stone golem/guardian, 3 phases — visibly degrades as HP drops | 112×112 |
| `tok_patriarch` | Crimson hexagon | Oren Cass — robed figure, burning/martyred shift at <30% HP | 112×112 |
| `tok_chorus` | Violet hexagon | Multi-faced choir entity, color-shifts to telegraph current weakness | 112×112 |
| `tok_fossil_king` | Dust/tan hexagon | Ancient fossilized king, 4 phases — crumbles visibly in final phase | 112×112 |
| `tok_reflection` | Pale gold hexagon | "You, but wrong" — modular base + swappable aura/sigil/distortion overlay | 112×112 |

### Board Node Icons

| Key | Current | Target Description | Size |
|-----|---------|-------------------|------|
| `node_event` | Gold diamond | Scroll/quill icon | 32×32 |
| `node_combat` | Red triangle | Crossed swords icon | 32×32 |
| `node_rest` | Green cross | Campfire or bedroll icon | 32×32 |
| `node_discovery` | Blue star | Crystal or treasure icon | 32×32 |
| `node_trap` | Orange triangle | Spike/jaws trap icon (distinct shape from combat triangle — accessibility) | 32×32 |
| `node_landmark` | Bright gold crown | Boss skull or castle icon | 44×44 |

### Faction Emblems

Each a 24×24 icon for UI influence bars. Distinct visual identity per faction:

| Key | Faction | Visual Identity |
|-----|---------|-----------------|
| `faction_sable` | Sable Order | Deep crimson, flame iconography |
| `faction_archive` | Argent Archive | Pale blue, ink/scroll motifs |
| `faction_covenant` | Ash Covenant | Violet, crystalline growth motifs |
| `faction_caravan` | Dust-Road Caravan | Amber, compass-rose or route-map glyph |

### UI Panels (Stretchable 9-slice or fixed-size PNGs)

| Key | Size | Purpose |
|-----|------|---------|
| `panel_dialog` | 800×220 | Event/story dialog box — highest visibility |
| `panel_stat` | 300×165 | HP/MP/Resonance stat readout |
| `panel_button` | 260×52 | Primary buttons |
| `panel_button_hover` | 260×52 | Button hover/active state |
| `panel_combat_hud` | 780×160 | Combat AP/Momentum/turn order readout |
| `panel_enemy` | 110×130 | Per-enemy combat info panel |
| `panel_stepper` | 40×40 | Point-buy +/- stepper button |
| `panel_preset` | 120×38 | Character preset button |
| `panel_preset_hover` | 120×38 | Preset button hover state |
| `panel_levelup` | 400×300 | Level-up modal background |
| `panel_skilltree` | 600×400 | Skill tree scene background |
| `panel_runstats` | 600×400 | End-of-run stats overlay |

A unified "worn stone tablet / Archive parchment" texture treatment across all panels is the single highest-ROI art pass.

### Particle Textures

| Key | Current | Target |
|-----|---------|--------|
| `particle` | 8px white circle | Small set: hit spark, crit burst, weakness flash, momentum glow, checkpoint sparkle, victory shard |

---

## File Locations

```
public/assets/
  tok_player.png
  tok_echo_skeleton.png
  tok_venn_custodian.png
  ... (one per key)
  node_event.png
  node_combat.png
  ... (one per node type)
  faction_sable.png
  faction_archive.png
  faction_covenant.png
  faction_caravan.png
  panel_dialog.png    (or 9-slice source)
  panel_stat.png
  ... (one per panel)
```

---

## Recommended Priority Order

*(Updated August 2026 — items 1 and 6 are done; stage-1 art batch is in.)*

1. ~~**Fonts**~~ — ✅ Delivered: Cinzel / IM Fell English / Courier Prime (WOFF2, `Hollow*` families)
2. **UI panels** — Unified stone/parchment texture on all 12 panels (frames every single screen; book panel already delivered as the reference style)
3. **Title screen** — One background, outsized first-impression impact
4. ~~**Lyra Vane combat frames**~~ — ✅ Delivered (7 poses + face + board pin); board token (`tok_player`) still open
5. **Node icons** — Legibility polish on 6 existing shapes
6. ~~**Sample enemy sprites**~~ — ✅ Delivered for stage 1: Dust Wight + Echo Skeleton + full Argent Sentinel set; **continue with remaining stages 2–5 enemies + other 4 bosses**
7. **Remaining enemies + bosses** — 10 standard + 4 boss sprite sets (follow the Sentinel frame pattern: idle/attack/hit/guard/victory/transform/defeat + faces)
8. **SFX** — 22 wired cues still synthesized (or source audio files for the composer); no music yet
9. **Board backgrounds for stages 2–5** — follow the delivered Stage 1 pattern (`stage<N>_background` + path JSON via PathPointPickerScene)
10. **Faction emblems, particles, remaining UI icons**

---

## See Also

- `docs/ART_ASSET_CHECKLIST_DETAILED.md` — per-key production specs (resolution, format, color references)
- `docs/THE_HOLLOW_BENEATH_Art_Audio_Asset_Checklist.md` — full priority tiers (P0/P1/P2) with flavor notes
- `src/placeholder/PlaceholderTextures.ts` — the code generating all current placeholders
- `src/placeholder/PlaceholderAudio.ts` — all 22 wired audio cue call sites
