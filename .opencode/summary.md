# ULTIMATE BATTLE SYSTEM — Session Summary (contracted)

## Objective
Implement `H:\Study mat\3.1\lab\sw\ULTIMATE BATTLE SYSTEM.md` phase-by-phase per `docs\BATTLE_ROADMAP.md` (execution log at top). **Phase 0 ✅, Phase 1 ✅, Phase 2 ✅ (verified). Phase 3 = Weakness Depth (weakness windows, elemental reactions, combo tags) — IN PROGRESS, just starting.**

## Important Details
- Project: `H:\Study mat\3.1\game\Hollow_beneath-main` — Phaser 3.70 + TS + Vite + Zustand; dev server at **http://localhost:3000** (running, HTTP 200; HMR live; NEVER start dev server in foreground).
- Gates: `npm run typecheck`, `npm run build`, `npm test` (tsx smoketest.ts). Last run: ALL PASS after Phase 2.
- SaveManager `VERSION = 3`; wipe-save page `public/reset-save.html`.
- Core conventions: 8 damage types; enemy data in `src/data/enemies.ts` (12 + 5 summons), bosses `src/data/bosses.ts` (5); engine `src/systems/CombatEngine.ts` (~3400 lines); UI `src/scenes/CombatScene.ts` (actions, menu, overlay, `refresh(snap)`), `src/ui/CombatHUD.ts` (enemy cards, CARD_W=150/CARD_H=240, panelBg y=CARD_H/2-20); createChoiceMenu signature `(scene, x, y, items:[{label,subtitle?,disabled?,onSelect}], {width,spacing})`; createButton `(scene,x,y,label,onClick,{width,height,fontSize,depth})`; `this.engine.<verb>(...)` returns Snapshot passed to `refresh(snap)`; overlay pattern = `overlayBg` rect depth 35 + `overlayMenu`; `FONT_MONO/FONT_SERIF/PALETTE_HEX` in `src/ui/theme.ts`; `audio.momentumFull()`.
- Combat flow: `beginRound` (status ticks, flags, pick intents) → player acts (AP/token, momentum full → `endPlayerPhase`) → enemies act via `resolveEnemyTurn` → `beginRound`. Snapshot types in `src/data/types.ts`.
- PlayerState fields (Phase 0/1): classId, fatigue, momentum (max 4 → full), insight, fearGauge, position, echoShards; NAMED_SKILLS in `src/data/skills.ts` (apCost, classId); StatPanel shows momentum dots + fatigue bar; smoketest `makeTestPlayer` includes classId/fatigue/insight/fearGauge/position.
- Intent system (Phase 2): `src/systems/combat/IntentSystem.ts` + `index.ts` barrel (FatigueSystem too); enemies/bosses declare `intents` (weight/condition/resolve) + `tendency`; engine `pendingIntents` Map, `pickIntents()` in beginRound; `EnemyView` has tendency/investigationLayer/investigationProbes/pendingIntent{id,label,confidence}; `analyze`=Scan 1AP layer1, `probe(target,probeId)` 1AP (needs layer≥1; observe_body/mind/weapon/memory/resonance/behavior; INT≥7/10 bonus lines), `deepAnalyze` 2AP (needs ≥1 probe; layer4 full pool), `spendInsight(option)` 3 INS ('full_ai'|'perfect_prediction'|'focused_study'|'weakness_window'); prediction token: hit enemy with pending intent before it moves → +1 token, miss wipes; `insightDamageBonus` +15%, `weakWindows` Map (mult 1.5 when open AND weakness>1); boss intents via `makeBossTurnCtx` (playerResonance, playerLastActionType, playerRepeatedLastAction). Boss Tendency map: sentinel:sage, patriarch:fanatic, chorus:manipulator, fossil_king:aggressor, reflection:tactician.
- CombatScene Phase 2 UI: action bar Analyze→Scan; skill menu items include Probe (opens `openProbeMenu()`) + Deep Analysis; `insightText` at (1150,606), `insightBtn` "Study (3 INS)" (1150,632) → `showInsightModal()` (4 options); card intent text line via `intentLine(label, layer, alreadyActed)`; also `sunder` (2 AP) action exists.
- Boss intents verified via smoke flags (patriarch summonedZealots/healedOnce, fossil edictUsed/courtSummoned, reflection echoesSummoned). Smoke results: echo_skeleton 2 rounds, sentinel 7, patriarch defeat 6, chorus 38, fossil defeat 3, reflection defeat 4.
- Type-check quirk: `investigate(target._key)` — engine API takes key; CombatScene selects via `this.selectedTarget` (enemy `_key`).

## State
### Completed
- Phase 0 (data/save), Phase 1 (fatigue/momentum/AP economy), Phase 2 (Investigation & Intent) — all implemented, typecheck/build/test PASS, roadmap log updated.
### Active
- Nothing in progress — Phase 3 just starting (next move below).
### Blocked
- None.

## Next Move (Phase 3 — Weakness Depth)
1. Read `docs\BATTLE_ROADMAP.md` Phase 3 section + spec Parts 7/8 (weakness depth, elemental reactions/combos) for exact requirements.
2. Implement per roadmap, then run typecheck/build/test; verify against phase-2 baseline (echo_skeleton 2r, sentinel 7r victory, others as above — watch for drift/termination).
3. Update roadmap execution log (Phase 3 ✅ when verified).

## Relevant Files
- `H:\Study mat\3.1\lab\sw\ULTIMATE BATTLE SYSTEM.md` — spec Parts 1–20 (Part 5 tendencies, Part 6 boss adaptation, Parts 7/8 weakness depth + reactions).
- `docs\BATTLE_ROADMAP.md` — phases + execution log (0/1/2 ✅).
- `src/data/types.ts` — snapshot/state/intent/tendency types.
- `src/systems/CombatEngine.ts` — engine (AP/token, intents, investigation, insight, prediction, weakness, sunder).
- `src/systems/combat/IntentSystem.ts`, `FatigueSystem.ts`, `index.ts`.
- `src/data/enemies.ts`, `src/data/bosses.ts`, `src/data/skills.ts`, `src/data/items.ts`.
- `src/scenes/CombatScene.ts`, `src/ui/CombatHUD.ts`, `src/ui/StatPanel.ts`, `src/ui/theme.ts`.
- `src/store/gameStore.ts`, `src/systems/SaveManager.ts`, `smoketest.ts`.
- `public/reset-save.html` — wipe save.

## Session — Board & Combat UI Polish (2026-08-25)
- `src/ui/Button.ts` — removed stray `scene.add.container(0,0,[hoverBg])` that pinned the hover veil at scene origin (dark overlay bug).
- `src/ui/DialogBox.ts` — rewritten: dynamic height (min 128, cap 190 ≈5 lines), `getHeight()` + `onResize` callback, `setResolution(2)` sharp text.
- `src/scenes/EventScene.ts` — rewritten: Continue button & choice cards positioned via `underDialog(gap)`; `pickChoice` re-types resolution into the same dialog; long flavor paginates into beats.
- `src/ui/CombatHUD.ts` — turn-order panel 180→224 (rows 204), row plate fits full name (2-line wrap), rows stacked via `cursorY`, panel grows to fit.
- `src/placeholder/PlaceholderTextures.ts` — 8 procedural element icons `el_slash/pierce/blunt/flame/frost/shock/sacred/shadow`.
- `src/ui/ChoiceMenu.ts` + `src/scenes/CombatScene.ts` — skill rows: tinted element icon chip left of MP-cost chip; icon replaces the abbrev text when available; chip gaps widened (chip→chip 16, icon gap 14); label 15px `#f0ead9`; hover polish in `applyInlineFocus` (gold stroke, slide tween); Scan modal dynamic height (`max(430, 174 + skillsBoxH + 64)`, no truncation), "MOVE POOL"→"SKILLS"; modal footers 12px gold.
- `src/ui/NodePreview.ts` — vertical stack recentered to fit panel: badge −48, index −14, title +4, sub +26, explain +48, tip +72 (resolved nudges 22/42).
- `src/scenes/BoardScene.ts` — `TILE_PANEL_H` 180→200, preview origin `TILE_PANEL_Y + 104` (badge clears title); journal prefix `C{ch}·N{n}` → `N{n} · …` (flavor line already carries chapter).
- `src/ui/FactionPanel.ts` — name column reserved: seal 18px@x16, names 11px@x38 capped at 11 chars + ellipsis; bar moved right (`barCx = width-96`, `barW` 46), value right-aligned left of bar, fill `frac*21`.
- `src/ui/PlayerPanel.ts` — compacted to fit 390px: portrait `width-48`, info gap +12, `barsY = infoY+56` (Resonance bar bottom ≈382, no more spill under panel).
- Verified: `npm run typecheck` ✅, smoke 213/213 ✅. `npm run build` still fails on **pre-existing** top-level `await` at `src/main.ts:115` vs esbuild es2020 target (main.ts untouched) — fix by bumping target to es2022 or refactoring the await.

