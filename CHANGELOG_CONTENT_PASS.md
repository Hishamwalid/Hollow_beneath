# Content & Mechanism Pass — Changelog

Full content buildout + bug fixes on top of the original MVP. Baseline (`npm run typecheck` + `npm run test`) was green before starting and is green after every change in this pass; `npm run build` succeeds.

## Content (data-only additions)

| Content | Before | After |
|---|---|---|
| Events | 8 (6 real + 1 filler + traps counted loosely) | **20** documented events + 1 filler (`quiet_passage`), all page-ranges verified to give every page 1–10 at least one non-filler eligible event at any Resonance |
| Minor landmarks | 0 | **5** vignettes at the capture-point nodes (10/30/50/70/90) — GDD §7.3's "5 minor story beats," previously just gold popups |
| Enemies | 8 | **12** — added Dust Wight (early), Dust-Road Raider (Caravan), Archive Cipher-Wraith, The Unread (Resonance ≥50 apex) |
| Skills | 8 | **25** — 17 new, organized into Warrior/Ranger/Scholar/Guardian/Shadow trees (`tree` field), granted via character-creation preset match + a new discovery pool |
| Items | 12 | **30** |
| Lore fragments | 0 (12 ids referenced, no text anywhere) | **40**, every id cross-checked to resolve, viewable in a new Lore Codex screen |
| Whispers | 0 | **50**, tiered by Resonance, ambient (never blocks input) |

New data files: `src/data/loreFragments.ts`, `src/data/whispers.ts`, `src/data/minorLandmarks.ts`.

## Bugs found and fixed

- **5 of 8 named skills were grantable but mechanically dead** (`chorus_step`, `loom_touched`, `librarians_eye`, `archival_insight`, `chorus_echo`) — their passive tags were never read anywhere outside their own definition. All wired now.
- **`sealing_strike` had a working active-skill implementation but no grant path** — unreachable in normal play. Added to the new discovery skill pool.
- **Player Dodge never applied against incoming attacks** — only checked for the player's own attacks. Added a real dodge roll to the incoming-damage path.
- **`unfinished_sentence`'s death ward was scoped per-combat instead of per-run** (its own description says "each run") — would have triggered in every fight instead of once per run. Fixed to use persistent player state.
- **`archival_insight`'s XP/Echo Shard bonus** wired through every shard-granting call site (node visits, event choices, event-triggered combat victories, boss rewards, discovery finds).
- **Discovery nodes only ever gave gold**, despite the GDD defining them as "Lore, items, secrets." Replaced with 11 weighted templates (gold/items/lore/shards/faction/skills/whisper/dud).
- **Off-screen choice menus, confirmed by coordinate math**: the Merged Chorus (5 pre-combat choices) and Fossil King (4 choices) rendered their last button(s) below the visible canvas. `ChoiceMenu` now adaptively compresses spacing and shifts the block up to always stay on-screen — fixes it everywhere the component is used, not just those two fights.
- **Dialog boxes were leaking** in `EventScene` and `LandmarkScene` — created as local consts, never destroyed before the next one, relying on implicit scene cleanup. Now tracked as class fields and explicitly destroyed, with `shutdown()` handlers as a backstop.
- **Dead code removed**: a computed-but-unused damage variable in `CombatScene`'s attack animation.

## New mechanisms

- `EventDef.requiresAnyFlag` — events can now require a player flag to be eligible (used for the two boss-callback events, `page_left_behind` and `patriarchs_ash`).
- `WhisperSystem` — picks a tiered, anti-repeat ambient line on board movement and combat start.
- Lore Codex scene (`LoreCodexScene`, reachable from the main menu) — paginated view of all 40 fragments, locked ones shown as undiscovered.
- Lightweight Resonance-tier screen tint (plain tweened rectangle, not a custom shader — deliberately, to stay within "no new engine-level GLSL work").

## UI / animation polish

- Buttons: hover/press scale tweening instead of an instant texture swap.
- Stat bars (HP/MP/Resonance/faction): tween to their new width instead of snapping.
- Dialog boxes: fade in on creation (centralized in `createDialogBox`, so every scene gets it for free).
- Choice menus: stagger-in fade per button.
- Combat: floating damage numbers now also appear over enemies (previously player-only); combat log capped at 4 visible lines instead of 6 to guarantee clearance above the stat panel.

## Validation

`smoketest.ts` extended with: minor-landmark + full lore-registry cross-reference check, per-page event coverage check (every page × low/high Resonance), content-count assertions (20/12/25/30/40/50/5), skill-distribution-path sanity, whisper-tier coverage. All pass.
