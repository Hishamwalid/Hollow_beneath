# THE HOLLOW BENEATH — Playable MVP (Placeholder Assets)

A browser build of the core game loop from the Production Plan / GDD v2: character creation → 100-node board → events, combat, rest, discovery, and trap nodes → all 5 landmark bosses → checkpoint saves → 6 endings.

**All visuals are procedurally generated shapes (no image files). All SFX are Web Audio oscillator tones (no audio files).** Everything is a placeholder for real art/audio except the writing, which is yours as-authored in the GDD.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build       # production build → dist/
npm run typecheck   # tsc, no emit
npm run test         # runtime smoke test (board gen, all 5 bosses, all events, endings)
```

## Stack

Vite + TypeScript + Phaser 3 + Zustand, per the Production Plan. No Howler (Web Audio wrapper instead, same call sites — see `src/placeholder/PlaceholderAudio.ts`), no IndexedDB/asset-caching layer (nothing binary to cache yet), no GLSL shaders (Resonance visual tiers are stubbed as flavor text only for now).

## What's actually implemented

- **Board**: full 100 nodes, exact weights from your balance config (event 45 / combat 22 / rest 12 / discovery 13 / trap 8), checkpoints at 20/40/60/80, capture points at 10/30/50/70/90, movement die 1d4+1, "can't skip an unresolved Landmark" capture rule.
- **Combat**: AP economy (2/turn), the exact damage formula `(ATK − DEF/2) × SkillPower × Weakness × Random(0.9–1.1)`, all 8 damage types + weakness matrix, Momentum (gain on weakness/crit/Analyze/first skill, 3-point payoff menu), all listed status effects (DoTs stack to 3, controls, buffs, debuffs), Guard/Analyze/Sunder/Withdraw, multi-enemy + summon support.
- **All 5 landmark bosses**, phase-accurate: Argent Sentinel (Catalogue → Reshelve/Archive Strike → Cite Source/Quotation → Desperate Guardian), Patriarch Cass (3-choice pre-combat incl. skip-combat purification path, Barrier recast, Zealot/Inquisitor summons, Martyr's Flame), Merged Chorus (per-round 1d8 weakness reroll, Copy Memory, Harmonic Overload on repeated actions, 4-way pre-combat with branching rewards), Fossil King (4 phases: Decree → Rebellion → Silence → Fossil, with Edict/Court/Tax of Flesh/Civil War/Last Law/charged ultimate), Final Reflection (adapts stats + damage type to the player's build/faction/history, Echoes of your actual major choices, WILL-check Question phase, charged ultimate).
- **8 documented enemies + Sera Voss**, all with their written AI behaviors (Rattle, Sealing Protocol/Rewrite Battlefield, Dispel Holy, Curse/Copy/Hallucinate cycle, 50% physical dodge, Judgment + summon, Devour + enrage, Empire's Memory).
- **8 documented events**, verbatim choices/checks/rewards, plus both trap events.
- Resonance tiers + enemy scaling, 4-faction influence tracking, Echo Shard economy (11-entry shop), checkpoint save/restore on death (localStorage, checksummed), all 6 endings with exact conditions.

## Deliberately out of scope this pass (data-only additions later, no engine changes needed)

Remaining 12 events, 4 enemy types, full 25-skill trees (only named boss/event-reward skills + 8 core actions exist), full 30-item catalog, 40 lore fragments / 50 whispers, real art/audio, GLSL shaders, Web Speech whisper voice, mobile responsive pass, CI/CD.

## Architecture notes

- `src/data/` — pure data + formulas (types, stats, enemies, bosses, events, endings, etc.). Bosses are the one place logic lives alongside data (`bosses.ts`), because their mechanics are too bespoke for a config table — see `BossDef.takeTurn()`.
- `src/systems/` — engine logic (CombatEngine, BoardGenerator, EventEngine, SaveManager, etc.), all framework-agnostic (no Phaser imports), so `smoketest.ts` can exercise them straight in Node.
- `src/placeholder/` — the two "fake asset" factories. Swap these out first when real art/audio arrives; nothing else references image/audio files, so there's nothing else to touch.
- `src/scenes/` + `src/ui/` — Phaser presentation layer, reads/writes the Zustand store (`src/store/gameStore.ts`) directly (no React, so no reactivity concerns — scenes just call `.getState()` imperatively).

— Team Akrasia
