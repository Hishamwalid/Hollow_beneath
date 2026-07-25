# THE HOLLOW BENEATH — Repo Audit & Recommendations

*Cross-checked against `THE_HOLLOW_BENEATH_Improved_GDD_v2.md`, `THE_HOLLOW_BENEATH_Production_Plan.md`, and the repo's own `PLAN_OVERHAUL.md` / `CHANGELOG_CONTENT_PASS.md`.*
*Verified by actually running `npm install`, `npm run typecheck`, `npm run test`, and `npm run build` against the uploaded repo — not just reading source.*
*Audit date: July 25, 2026.*

---

## 1. Executive Summary

This repo is further along than the "MVP" label in its own README suggests. The content scope in `THE_HOLLOW_BENEATH_Improved_GDD_v2.md` — 20 events, 12 enemies, 5 phase-accurate bosses, 25 skills, 30 items, 40 lore fragments, 50 whispers, the full faction/resonance/echo-shard economy — is **built, and I verified it against the GDD line-by-line in the areas that matter most (formulas, stat blocks, thresholds, ending conditions).** It's a faithful, careful implementation, not a stub.

Three things need your attention, in this order:

1. **A real, verified, crash-causing bug** in the combat engine that breaks 3 of your 5 boss fights for essentially every player. Found it, fixed it, proved the fix. Section 2.
2. **A second planning document already sitting in your repo** — `PLAN_OVERHAUL.md` — that proposes doubling the board from 100 to 200 nodes plus a large scope expansion, and which I think quietly contradicts the GDD's own founding premise. Nothing in it is built yet, so you're at a decision point, not a sunk-cost point. Section 4.
3. **Zero art or audio assets exist.** Every visual is a procedurally-drawn shape, every sound is a Web Audio oscillator blip. This isn't a criticism — it's the correct MVP sequencing — but it means the art checklist (separate document) is not a "nice to have," it's the entire remaining surface area of the project. Section 5 here tells you how I'd sequence it; the companion checklist tells you exactly what to make.

---

## 2. The One Bug That Matters Most

**File:** `src/systems/CombatEngine.ts`, line 344 (in `resolveEnemyTurn`)

```ts
// Before — crashes:
const def = ALL_ENEMY_DEFS[enemy._key];

// After — verified fix:
const def = ALL_ENEMY_DEFS[enemy.defId];
```

### Why it breaks

Every enemy combatant is built with two identity fields: `defId` (the stable lookup key, e.g. `"sable_zealot"`) and `_key` (a unique per-instance key used so the UI/targeting can tell two summoned copies apart, e.g. `"sable_zealot_2_3"`). `buildEnemyCombatant()` sets both correctly. But `spawnAdd()` — the function every boss calls to summon allies mid-fight — **overwrites `_key` with the unique instance string and leaves it there.** Line 344 then tries to look up that enemy's AI script using `_key` instead of `defId`, the lookup returns `undefined`, and the next line calls `.act()` on it, throwing `Cannot read properties of undefined (reading 'act')`.

The rest of the codebase already gets this right — e.g. line 538 correctly reads `e.defId === 'echo_soldier'` for the Phalanx damage-share check — which tells me this was a single copy-paste slip, not a design confusion.

### Why it matters

I ran your own `smoketest.ts` before touching anything. Result: **Argent Sentinel and Merged Chorus passed. Patriarch Cass, the Fossil King, and the Final Reflection all crashed.** That's not a coincidence — those are exactly the three bosses whose kits summon adds (Sable Zealots/Inquisitor at 70%/40% HP, Dominion Echo-Soldiers and Memory Wraiths across phases, and the four Echo manifestations in the Reflection's Phase 2). Patriarch and Fossil King *guarantee* a summon in every fight per their scripted HP triggers, so this isn't an edge case — **it will crash for essentially every player who reaches Landmark 2, 4, or 5**, which is 60% of your boss content and the entire back half of the game.

### Verification

After the one-line change:

```
npm run typecheck   → clean
npm run test         → all boss simulations complete without error
npm run build         → succeeds
```

I've included the corrected file (`CombatEngine.ts`) alongside this report. It's a drop-in replacement for your existing file — no other changes. If you'd rather hand-apply it, the diff above is the entire fix.

**One caveat, so I'm not overselling this:** the smoketest's simulated player only ever uses basic attacks (see `smoketest.ts`'s `simulateBoss()` — no skills, no Analyze, no Guard). So while the crash-fix is unambiguous, the fact that the bot *loses* to Patriarch, Fossil King, and Reflection in simulation tells you nothing about real balance — it's a dumb bot, not a balance signal. Don't read "defeat in 4 rounds" as "this boss is too hard." See Section 6.

---

## 3. Content & Systems Cross-Check

### 3.1 Structural systems — verified against the GDD

| System | GDD v2 Spec | Repo Reality | Status |
|---|---|---|---|
| Board size | 100 nodes, 10 pages | 100 nodes, 10 pages | ✅ exact |
| Movement | 1d4+1 | `Math.floor(rng()*4)+1+1` | ✅ exact |
| Capture points | 10/20/30…100 | Matches | ✅ exact |
| Checkpoints | Pages 2/4/6/8 | Matches | ✅ exact |
| Node weights | Event 45 / Combat 22 / Rest 12 / Discovery 13 / Trap 8 | Matches | ✅ exact |
| Derived stats | HP/MP/ATK/DEF/MATK/MDEF/SPD/ACC/Dodge formulas | Matches, including all 6 preset builds (Warrior, Scholar, Ranger, Guardian, Shadow) | ✅ exact |
| Damage formula | `(ATK − DEF/2) × SkillPower × Weakness × Random(0.9,1.1)`, min 3, crit 1.5× | Matches exactly | ✅ exact |
| 8 damage types + weakness multipliers | Weak 1.5×, Resist 0.5×, Immune 0×, Absorb −1.0× | Matches | ✅ exact |
| Momentum | Max 3, 5 spend options | All 5 implemented (Extra Turn, Chorus Heal, Clarity, Forgotten Technique, Unravel) | ✅ exact |
| Faction influence | 4 axes, −100 to +100, 4 threshold bands | Matches | ✅ exact |
| Resonance tiers/economy | 4 tiers at 25/50/75, listed gains/costs | Matches, including the "+30% dmg to non-bosses only" scoping | ✅ exact |
| Boss base stats (all 5) | HP 130/160/200/250/280 etc. | Matches exactly | ✅ exact |
| Echo Shard shop | 11 entries, exact costs | Matches exactly | ✅ exact |
| Ending conditions | 6 endings | 6 GDD endings implemented **+ a 7th fallback** (see 3.3) | ✅ exact, plus a fix |
| Checkpoint death handling | Return to checkpoint, 50% HP/MP | Matches | ✅ exact |

### 3.2 Content roster — verified counts

| Content | GDD/Changelog Target | Verified in Repo |
|---|---|---|
| Events | 20 | 20 |
| Enemies | 12 (8 GDD + 4 new) | 12 — the 4 additions (Dust Wight, Dust-Road Raider, Archive Cipher-Wraith, The Unread) sensibly fill gaps the GDD's original 8 left (no early trash mob, no Caravan-aligned combat enemy) |
| Bosses | 5, phase-accurate | 5, stat blocks and phase HP thresholds match the GDD exactly |
| Minor landmarks | 5 | 5 |
| Skills | 25 | 25, across Warrior(3)/Ranger(3)/Scholar(5)/Guardian(5)/Shadow(5)/Universal(4) |
| Items | 30 | 30, across weapon(5)/armour(4)/focus(4)/accessory(7)/consumable(4)/material(6) |
| Lore fragments | 40+ | 40 |
| Whispers | 50 | 50, roughly even across all 4 resonance tiers (13/13/12/12) |
| Endings | 6 | 6 + 1 fallback |

This is a genuinely complete content pass, not a partial one. I want to be direct about that so the rest of this report doesn't read as more critical than it should.

### 3.3 Where the implementation quietly improved on the GDD

Worth knowing about, since these are decisions someone made that the GDD doesn't document — you may want to fold them back into the GDD itself so future contributors don't "fix" them by accident:

- **A 7th ending ("Unfinished") exists and isn't in the GDD's table.** The GDD's 6 conditions don't partition the possible state space — a run that ends with moderate everything (no faction ≥50, not all four ≥25, Resonance under 75) satisfies none of the 6 named endings. The code catches this with a fallback epilogue. This is correct and necessary, but it means the GDD's Appendix line item "6 Ending cinematics" is now actually **7**, and needs its own art/writing treatment. I've included it as such in the asset checklist.
- **Stat checks got a real formula.** The GDD says things like "WILL check, DC 10" or "STR ≥ 7" throughout Part V/VIII but never defines the underlying roll. The code uses `d20 + stat×2 ≥ DC+10`, documented in `checks.ts` as tuned so a balanced 6-stat build clears DC10 ~65% of the time and DC16 ~35%. Reasonable, consistent, and worth formally adopting into the GDD text.
- **`Phalanx`** (Dominion Echo-Soldier's "guard ally, redirect damage") is implemented as a passive damage-share among all live Echo-Soldiers rather than an active targeted choice. A fair, simpler reading of an ambiguous GDD line — flagging only so it doesn't get "corrected" back to something more complicated without a reason.

### 3.4 Where the GDD itself has a small bug that carried into the code

**Shard Shop → Resonance Anchor.** GDD Section 11.2 says spending 300 Shards gives *"Start with Resonance = 10 (immediate Awakened tier)."* But GDD Section 4.5's own tier table puts Awakened at 25–49. Resonance 10 is **Stable** (0–24), not Awakened. The code faithfully reproduces this — `resonance: 10` with a description claiming Awakened. This is a two-minute fix, but it needs a decision from you: bump the granted value to 25 (so the perk actually does what it claims), or leave it at 10 and fix the description. I'd lean toward bumping it to 25, since a 300-Shard unlock that turns out to just be flavor text is a worse player experience than a slightly stronger perk.

### 3.5 Tech stack: Production Plan vs. reality

| Layer | Production Plan Recommendation | Actual Repo | Assessment |
|---|---|---|---|
| Build tool | Vite | Vite | ✅ matches |
| Engine | Phaser 3 | Phaser 3.70 | ✅ matches |
| Language | TypeScript, strict | TypeScript, strict enabled | ✅ matches |
| State | Zustand | Zustand | ✅ matches, clean 158-line store |
| Audio | Howler.js | Web Audio oscillator synthesis only (no library) | Reasonable for now — there's nothing to play yet. Revisit once real BGM/SFX files exist; Howler's looping/crossfade/codec-fallback handling genuinely earns its keep at that point. |
| Storage | localStorage + IndexedDB | localStorage only, with checksum validation | IndexedDB was meant for asset caching — premature until there are assets to cache. Not a gap yet. |
| Resonance VFX | GLSL shaders (chromatic aberration, warp, glitch) | Plain tweened color-tint rectangle | This is the single biggest *feel* gap relative to the Production Plan's ambition, since Resonance is meant to be **the** visible signature of the game's core narrative mechanic. Worth prioritizing once you're doing VFX work, even ahead of some art. |
| Code splitting | `manualChunks` per Vite config in the plan | None configured (`chunkSizeWarningLimit` was just raised to silence the warning) | Currently ships as a single ~1.69MB (407KB gz) bundle. Not urgent today; will matter a lot once Phaser scenes start pulling in real per-page assets. |
| Asset pipeline (`tools/build-atlases.js`, `optimize-audio.js`, `optimize-images.js`, `subset-fonts.js`, `verify-budget.js`) | Specified in full | None exist | Correct — there's nothing to run them against yet. This is the first infrastructure to build once art starts arriving, not before. |
| Fonts | Crimson Text (serif) + VT323 (mono), subset WOFF2 | Georgia + Courier New (system fonts) | Functional placeholder, zero cost, but plain. See asset checklist — this is a genuinely cheap, high-impact swap. |
| Voice ("Loom whispers") | Web Speech API + procedural reverb, described in detail | Not implemented — whispers are pure text via `WhisperOverlay` | The plan's Web Speech approach is clever specifically *because* it needs no audio files. Worth prototyping early since it's code effort, not asset-creation effort. |

**Scene architecture:** the actual repo has 13 registered Phaser scenes vs. the Production Plan's 10 — it correctly split out `CharacterCreationScene`, `ShardShopScene`, `LoreCodexScene`, `SettingsScene`, and `InventoryScene` that the plan's folder sketch didn't spell out, and folded the plan's `TransitionScene` into a lighter `sceneTransition.ts` utility instead of a full Scene class. Sensible evolution, not drift.

---

## 4. `PLAN_OVERHAUL.md` — What It Proposes, and Why I'd Slow Down

This document is already in your repo (1,713 lines), dated after the GDD, framed as a further overhaul on top of the current build. **Nothing in it is implemented** — I confirmed the board is still exactly 100 nodes, `player.level` is still hardcoded to 1 with no level-up path, MP is tracked but never spent anywhere in `CombatEngine.ts`, and `InventoryScene` is display-only with no equip/unequip handlers. Its own diagnosis of the current build's gaps is accurate. My concern is with the proposed scope, not the diagnosis.

### The core tension

GDD v2 exists *specifically* because v1 had a stated problem: **"40-min permadeath runs too punishing for web"** → fixed to a **"20-30 min target."** That single line is arguably the most important design decision in the whole document — it's why the board is 100 nodes with ~25 landings, why checkpoints exist, why Echo Shards soften permadeath. The entire v1→v2 revision is organized around session length for a browser game.

`PLAN_OVERHAUL.md` proposes doubling the board to 200 nodes. Its own justification for the movement-die change (1d4+1 → 1d6, both averaging 3.5) is *"same average speed — no pacing change,"* which is true **for a single roll** — but it doesn't address the part that actually matters: **twice the nodes means roughly twice the landings, twice the events, twice the combats, twice the reading, regardless of what the die's average is.** The plan's own XP table states the resulting run has **~57 landings**, more than double the current ~25. Section 1.1 of the same document separately claims each 40-node chapter has "~22 free landings" before capture points and mini-bosses — five chapters at 22 each is 110, which doesn't reconcile with the "~57 total" figure stated elsewhere. That internal inconsistency is itself a signal: the pacing math for the 200-node version hasn't actually been worked through the way GDD v2's Section 3.3 time budget was for the 100-node version. Before anyone estimates hours against this, I'd want that table redone properly, the way the original GDD did it.

Layered on top of more nodes: 5 new mini-bosses, more capture points, more minor-landmark page-turns. Even without doing the full arithmetic (which the plan's own numbers don't currently support doing precisely), the direction is unambiguous — this pulls average session length back up toward the 40–70 minute range the v1→v2 revision was explicitly written to eliminate.

### The sequencing problem

Separately from pacing: **zero art or audio exists yet**, and `PLAN_OVERHAUL.md` adds substantial *new* surface area that will need it — mini-boss sprites, a level-up modal, a skill-tree UI (26 icons), tutorial screens, chapter-transition cards, cinematic landmark presentation. Committing ~66 hours of engineering to grow scope before the *existing* 100% art debt has a plan attached to it means the gap between "plays" and "looks finished" only gets wider. I'd rather see the current build fully dressed before it gets bigger.

There's also no playtest data anywhere in this repo — no analytics output, no notes referencing actual runs. The GDD's own Section 15 protocol (skilled/struggling run time, rounds per combat, node of first death, ending distribution, etc.) has apparently never been run against the *current* 100-node build. Deciding to double the board before that protocol has told you anything about the board you already have is building on an untested foundation.

### What I'd actually keep from it

To be fair to the document — a lot of its individual diagnoses are good, and several of its fixes don't require touching board size at all:

**Adopt now, no scope growth:**
- MP activation (skills that actually cost MP — currently 100% decorative)
- Equipment UI (`InventoryScene` already renders equipped items; it just needs click handlers)
- Turn-order indicator in combat
- Faction-hostile consequences actually firing (ambush events, shop lockouts per GDD's own Hostile tier)
- End-of-run stats screen
- Settings/onboarding, tutorial pass
- Level-up system and skill-tree UI — **these don't require more nodes.** XP is already tracked; it just needs a threshold check. Recompute the XP curve against the *existing* 100-node/~25-landing structure rather than the 200-node numbers.
- The 12 event-variant idea and auto-generated fallback events, plus event chains — these add replay variety without adding runtime, since they reuse existing node slots rather than adding new ones. Good ROI.

**Defer or reject:**
- 200-node board expansion
- 5 new mini-bosses
- The 3→4 node visibility change *if* it's bundled with the board expansion (it's actually independent — if you like seeing further ahead, you can ship that against the current 100-node board on its own merits)
- Full cinematic landmark presentation — nice, but wait until real art/audio exist to build the finished version; a stub version now will just get rebuilt

---

## 5. Recommended Sequencing

1. **Apply the `CombatEngine.ts` fix.** Zero risk, verified, unblocks 60% of your boss content immediately.
2. **Decide the Resonance Anchor fix** (bump to 25, or correct the description) and make it.
3. **Run a real human playtest pass** against the current 100-node build using the GDD's own Section 15 protocol before scoping any further work. You have none of that data yet, and half the case for `PLAN_OVERHAUL.md` rests on assumptions it would confirm or kill.
4. **Cherry-pick the non-scope-expanding items from `PLAN_OVERHAUL.md`** listed above (MP activation, Equipment UI, level-up/skill tree on the existing board, faction-hostile consequences, event variants).
5. **Explicitly shelve the 200-node expansion** pending a redone, internally-consistent time budget — or a deliberate decision that longer sessions are actually what you want, made with eyes open rather than inherited from an unreconciled table.
6. **Start art production** using the companion checklist, prioritized by the tiers in that document — this is now the critical path, not a parallel track.
7. **Build the Production Plan's asset pipeline tooling** (atlas packer, audio/image optimizers, font subsetter, budget verifier) once real raw assets start arriving, not before — there's nothing productive to run it against today.
8. **Prototype the Web Speech whisper-voice system** early — it's pure code/design effort with no asset cost, and it's the delivery mechanism for the GDD's signature narrative device (Tier 1 Whispers).
9. **Add Vite `manualChunks` code-splitting** whenever convenient — cheap, and its payoff grows once real per-scene assets land.

---

## 6. One Balance Caveat, Stated Plainly

`npm run test` tells you the game *doesn't crash or infinite-loop*. It does not tell you the game is *fun* or *fair*. The Merged Chorus resolved in 7–12 simulated rounds against a bot that only ever basic-attacks — well outside the GDD's stated 3–6 round target — but that's expected from a bot with no skills, no Analyze, and no weakness-targeting, not evidence the boss is overtuned. Treat the smoketest as your correctness net, not your balance signal. The GDD's own Playtest Protocol (Section 15) is still the right tool for the actual balance question, and per Section 3 above, there's no evidence it's been run yet.
