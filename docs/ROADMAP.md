# THE HOLLOW BENEATH — Project Roadmap

*Master roadmap for the Definitive Edition. Supersedes all historical phase plans and asset checklists (removed in the documentation cleanup). The current combat spec lives in `COMBAT_SYSTEM_REVAMP.md`.*

---

## 1. Where We Are

**Version:** 0.1.0-mvp → narrative-complete Definitive Edition build.
**Stack:** Vite 5 + TypeScript 5.5 + Phaser 3.70 + Zustand 4.5. Save v8. Smoketest 205/205 · typecheck clean · production build green.

### Shipped ✅

| Milestone | Notes |
|-----------|-------|
| Core descent loop | 200-node board, dice movement, 6 node types, checkpoints at 40/80/120/160 |
| **Chapter map system** | Page system removed; 5 chapters × 40 nodes, each its own full-screen map with page-turn transition |
| "Echo" combat revamp | One action/turn, QTE timing, Scan + discrete affinity discovery, Down/1-More, reactions, momentum payoffs, boss AI + charge telegraphs |
| Chapter loadouts | 6-slot loadout, chapter technique grants (~40 named skills) |
| Resonance system | 4 tiers, enemy scaling, UI distortion FX, resonance abilities |
| Factions | 4 axes −100…+100, gates, ambushes, rest disruption, gear passives, shop blessings |
| Content roster | 32 authored events + traps + 10 minor landmarks, procedural fallbacks, lore codex, whispers |
| Meta progression | Echo Shards shop (11 unlocks incl. faction starting blessings), Bestiary persistence, NG+ |
| Difficulty | Easy / Normal / Hard / Ironman (permadeath) |
| **Definitive narrative** | Eve cycle story: prologue, 11 pinned story beats (nodes 1–185), scripted fights (15, 60), all five bosses re-scripted |
| **Three endings** | THE HOLLOW (victory override) / LOST IN THE DARK / THE RETURN via "The Offer" defeat scene; lock-in autosave; faction epilogue overlays; CreditsScene |
| **Removals** | Companions deleted entirely; Sera Voss removed from events/roster; old 7 endings replaced |
| Dev tools | `?editpath=1`, `?editlayout=1`, NodePreview |

---

## 2. Remaining Work

### Phase N1 — Ending & Final-Chamber presentation *(P0)*
- [ ] Real art: `bg_final_chamber`, `spr_final_reflection` set, 4 CGs (`cg_hollow_throne`, `cg_the_offer`, `cg_lost_in_dark`, `cg_the_return`) — see `ART_AUDIO_ASSETS.md`
- [ ] Audio: `sfx_loom_hum` replacing the sine drone; `sfx_wind_stone` under credits
- [ ] Optional: timed auto-advance mode for ending beats (currently click/space)

### Phase N2 — Full art pass *(P1)*
- [ ] Boss sprites for patriarch / chorus / fossil_king (Sentinel-depth sets)
- [ ] Enemy sprite sets for chapters 2–5 rosters (+ Memory Wraith, The Unread, 4 Echoes)
- [ ] `eve_portrait` for node 185 / Memory Room flash
- [ ] Combat backgrounds for chapters 2–5
- [ ] Node-path authoring for chapter maps 2–5 (`?editpath=1` workflow)

### Phase N3 — Audio & music *(P2)*
- [ ] `vo_eve_lines` pack (text fallback already wired)
- [ ] Music score: 5 chapter ambience tracks, 5 boss themes, 3 ending stingers
- [ ] Replace 22 synth SFX cues with recorded audio (call sites unchanged)

### Phase B1 — Balance & playtesting *(P1, ongoing)*
- [ ] Full manual playthroughs per difficulty (carries over PLAN_OVERHAUL D2–D9 edge cases: death+checkpoint, 0 HP/MP, all-factions-hostile, level-up on kill, settings persistence)
- [ ] Boss tuning against one-action combat model (post-revamp ~15% boss nerf is a stopgap — revisit per-boss numbers)
- [ ] Event reward economy pass (gold/shard curves vs shop prices)
- [ ] Ending-sequence readability pass (font sizes, pacing)

### Phase C1 — Content polish *(P2, optional)*
- [ ] Expand authored event pool beyond 32 (fallback templates still cover gaps)
- [ ] More Eve-voice micro-beats (counter supports up to 5)
- [ ] Lore fragments referencing removed canon audit (`the_departure_feast`, marker postscripts — done; sweep for stragglers)

### Phase T1 — Documentation *(P2)*
- [x] Authoritative doc set: `MAIN_STORY.md`, `SCENES.md`, `ENEMIES_AND_BOSSES.md`, `WORLD_AND_FACTIONS.md`, `EVENTS_AND_FACTIONS.md`, `ART_AUDIO_ASSETS.md`, `ROADMAP.md`
- [x] Legacy docs removed (superseded/stale): old asset checklists ×4, `ENEMY_ROSTER_BY_STAGE.md`, `PLAN_OVERHAUL.md`, `BATTLE_ROADMAP.md`, `CHANGELOG_CONTENT_PASS.md`, `AGENTS.md`
- [ ] Update `README.md` to Definitive Edition canon (still describes Lyra Vane protagonist, 7 endings, companions)

---

## 3. Definition of Done (ship target)

1. All P0 assets integrated; no placeholder visible during nodes 160–200 or any ending.
2. Three endings reachable and verified by manual playthrough (win path, lose→dark, lose→climb).
3. Zero references to companions/Sera/removed endings anywhere in build or UI.
4. Typecheck + smoketest + production build green.
5. Balance: a mid-skill player reaches the Reflection on Normal ≈50% of runs.

---

*The authoritative documentation set lives alongside this file: `MAIN_STORY.md`, `SCENES.md`, `ENEMIES_AND_BOSSES.md`, `WORLD_AND_FACTIONS.md`, `EVENTS_AND_FACTIONS.md`, `ART_AUDIO_ASSETS.md`, plus the combat spec in `COMBAT_SYSTEM_REVAMP.md`.*
