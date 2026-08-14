# Battle UI Overhaul — Implement `Battle UI.svg` into CombatScene

Source design: `public\assets\UI design\Battle UI.svg` (1920×1080, 16:9).
Game canvas: 1280×800 (16:10), `Phaser.Scale.FIT` (`src/main.ts`, `src/config.ts`).

## Core mapping decision

**Uniform scale ×2/3 (1280/1920 = 0.6667), top-left anchored.** Design height 1080 → 720, leaving an 80px strip at the bottom (matches the design's own bottom letterbox bar). Uniform scaling preserves all proportions; any fit-to-height approach would clip the action bar.

Design coordinate → game coordinate: `(x * 2/3, y * 2/3)`.

## Locked decisions (user-confirmed)

1. **Vertical**: top-anchored; 80px bottom strip stays empty.
2. **Combat log**: REMOVED from the HUD (`logText` display dropped; engine log generation unchanged — still drives banners/thoughts/archive).
3. **Enemy cards**: minimal per design — sprite + name + HP bar. Drop reveal display (affinities, stats, statuses, intent text, row pip, weak-window badge text). Keep: gold selected-diamond (target reticle), hit tint/pose, damage numbers, weakness-window gold tint pulse on the token (combat feedback, not info).
4. **END TURN** lives in the action grid's 6th slot; the standalone bottom-right `endTurnBtn` is removed.
5. **Companions** render as extra rows in the turn order panel (they participate in initiative). `companionText` removed.
6. **Insight + ROW** cluster above the action panel (top-right inside the frame).

## Coordinate table (design → game, ×2/3)

| Element | Design (x, y, w, h) | Game |
|---|---|---|
| Gold frame (stroke #C9A24B, w15) | (115.5, 115.5, 1689, 838) | rect (77, 77, 1126, 558.7), stroke |
| Turn order panel | (127, 150, 203, 235) | (84.7, 100, 135.3, 156.7) |
| AP panel | (133.5, 732.5, 277, 49) → center (272, 757) | center (181.3, 504.7), 184.7×32.7 |
| Player stat panel | (128, 788, 388, 159) → center (322, 867.5) | center (214.7, 578.3), 258.7×106 |
| Action panel | (1179, 668, 614, 274) → center (1486, 805) | center (990.7, 536.7), 409.3×182.7 |
| Tooltip panel | (559.5, 972.5, 802, 91.8) | center (373, 648.3), 534.7×61.2 |
| Player sprite (364×364) | (322, 539) | (214.7, 359.3), 242.7×242.7 |
| Player shadow | (492, 902.5) | (328, 601.7) |
| Enemy sprites (300×300) | (798, 306) / (1064, 306) | (532, 204) / (709.3, 204), 200×200 |
| Enemy shadows | (948, 567.5) / (1283, 571.5) | (632, 378.3) / (855.3, 381) |
| Enemy HP bars (#B10000) | (842.4, 306.188, 206, 14.6) | (561.6, 204.1, 137.4, 9.7) |
| Buttons (266×62) | col1 x=1213.62, col2 x=1498.71; rows y=703.149/776.077/849.005 | (809.1/999.1, 468.8/517.4/566), 177.3×41.3 |
| Stat panel rows | XP bar (219,828), HP bar (219,858), MP bar (219,887), labels y 831-889, values x=438.6 | bars (146, 552/572/591.3, 137.4, 9.7); labels x≈104; values x≈292.4 |
| MOMENTUM row + 3 dots | dots (291/322.8/354.5, 925.5) | (194/215.2/236.4, 617) |

**Re-extract from SVG during implementation** (small elements OCR'd imprecisely at scale):
- AP pip centers + radius (design ≈ x 169.9-287.4, y ≈ 757.3, r ≈ 11.7).
- Turn order title/row baselines (design title (159.3, 170.1) → game (106.2, 113.4); rows y ≈ 150 / 194.7 / 228.3 game).
- Enemy name + "LV." label positions above enemy sprites; stat-panel header "PLAYER" / "LV." exact x.
- Exact fills: stat panel / action panel = #9B741E; button inner = #21252A; MP bar fill; enemy name color; momentum bar/dot colors.
- Font sizes: header "PLAYER"/"LV." ≈ 20-22px design (→ ≈ 14px game); row labels ≈ 16px design (→ ≈ 10.7px game); value text ≈ 14px design.

## File changes

### 1. `src/ui/StatPanel.ts` — full redesign
- Panel: flat `#9b741e` rectangle 258.7×106 at (214.7, 578.3), thin gold border (drop `panel_stat` texture).
- Header: "PLAYER" gold serif left (~95, 536); "LV." gold serif right-aligned (~292, 536).
- Rows (label left x≈104, bar x=146 y=552/572/591.3 w=137.4 h=9.7, value right-aligned x≈292.4):
  - XP: gold bar `0xc9a24b`; value `63/64` gold.
  - HP: red bar `0xb0453f` (design fill re-checked; approx #B10000 family); value bone.
  - MP: blue bar `0x4a6fa5`; value bone.
  - MOMENTUM: label + 3 dots (r≈8) at (194/215.2/236.4, 617), gold-filled per momentum; FAT 0% small gold text right-aligned in the same row (design omits FAT, but it's gameplay-critical; audio gasp + AP loss otherwise invisible now that the log is gone).
- REMOVED: RES bar + tier text, faction bars, `panel_stat` bg, old layout.
- `update()` wiring: same store data; keep bar tween helper; keep tier-glow logic only if a home exists (drop — audio chime still fires).
- Signature: `createStatPanel(scene, x, y)` → place at (214.7, 578.3) center-based like today (children relative to container origin).

### 2. `src/ui/CombatHUD.ts` — component rework
- **`createEnemyDisplay`**: no card panel (drop `panel_enemy`). Sprite 200×200 (`tok_<key>`), name serif gold above (re-extracted y), HP bar #B10000 137.4×9.7 at top of sprite area (re-extracted y≈204), HP text small below. Keep: interactive click, selected diamond (position relative to new layout), `setState` tint, weakness-window gold tint (drop the text badge), row text DROPPED, affinity/stats/status/intent texts DROPPED.
- **`createApPips`** → AP panel: bg `#9b741e` 184.7×32.7 + gold border at (181.3, 504.7), 5 pips (gold-filled when `i < ap`, stroke gold, dark fill otherwise), reserve text `RES n` below-left. Re-extract pip geometry.
- **`createActionBar`** → **`createActionGrid`** (2 cols × 3 rows) at (990.7, 536.7) on a `#9b741e` rx=15 panel 409.3×182.7:
  - Slots: ATTACK, SKILL / GUARD, SCAN / ITEM, END TURN.
  - Button look: outer stroke gold + inner `#21252a` + white serif label + small AP cost gold; **selected** = outer `#0b0d10` + inner gold (design shows ATTACK selected); disabled = alpha 0.4, no hover; hover = slight brighten.
  - END TURN slot: no AP cost, calls `onEndTurn` (passed in as an item with `apCost: 0`).
  - Keep 300ms-delayed tooltip hookup; tooltip targets the new panel (below).
- **Tooltip panel**: `createTooltipPanel(scene)` → flat `#0b0d10` alpha 0.76 + gold stroke, 534.7×61.2 at (373, 648.3); `{ show(text), hide(), setText }`. Replace the plain `actionBarTooltip` text.
- **`createSpeedBar`** → **`createTurnOrderPanel`**: panel bg (re-extract fill, likely `#9b741e` or stone) 135.3×156.7 at (84.7, 100); gold serif title "TURN ORDER"; one row per actor in initiative order — "You", allies (`name — tier`), enemies (`name`); current actor highlighted gold; player row could show row position. Ally rows come from `snap.allies` (they're already in `initiativeOrder`). Flexible row list (design shows 3; re-extract rowH/startY for scaling).

### 3. `src/scenes/CombatScene.ts` — wiring
- `createStatPanel(this, 214.7, 578.3)`.
- Player sprite: (214.7, 359.3), `setDisplaySize(242.7, 242.7)` (placeholder texture is not square — acceptable until real art; note for asset pass).
- Enemy placement: 1 enemy → (640, 204); 2 → (532, 204) + (709.3, 204); 3+ → centered spread at spacing 177.3, y=204. `buildEnemyDisplays` spacing math rewritten.
- `createApPips` at (181.3, 504.7); insight text + Study button + ROW text right-aligned at x≈1180, y≈130/165/200 (top-right inside frame).
- Replace `buildActionBar` with grid at (990.7, 536.7); remove standalone `endTurnBtn` (grid END TURN → `onEndTurn`, enable state via `snap.phase === 'player'`).
- Remove `logText`, `log()`, `companionText`. Keep `showBanners` (banners still fire) and all engine calls.
- Update hard-coded FX coords: floating text for player (~214, 570), `flashTarget` sizes, heal/momentum particle offsets relative to new stat panel.
- Keep: title / phase label / battlefield label top-center, whisper overlay, all modals, `handleCombatEnd`.
- Grid item list: SKILL/ITEM keep `openSkillMenu`/`openItemMenu`; guard/scan/attack map to existing engine calls; END TURN → `onEndTurn`. Disabled rules unchanged (canAct/canAfford/inventory).

### 4. `src/ui/uiTheme.ts`
- Add palette entries: `panelOlive: '#9b741e'`, `buttonInner: '#21252a'` (re-verify from SVG fills during implementation).

## Phase 2 — Real sprite art (user-confirmed 2026-08-14)

Drop-in assets (user supplies PNGs at these paths):
```
public/assets/image_assets/player/{idle,windup,attack,hit,victory,defeat,guard}.png
public/assets/image_assets/enemy/dust_wight/{idle,attack,hit}.png
public/assets/image_assets/enemy/echo_skeleton/{idle,attack,hit}.png
```
Keys: `player_idle…player_guard`; `enemy_dust_wight_idle`…, `enemy_echo_skeleton_idle`…
Display boxes: player 243w×329h portrait, enemies 200×200 — **aspect-preserving fit** (no distortion).

File changes:
1. `src/scenes/PreloadScene.ts` — load 7 player states + per-enemy states for defIds `echo_skeleton`, `dust_wight`; keep generic `enemy_{idle,attack,hit}` as fallback. Missing files warn only (no crash).
2. `src/systems/CombatEngine.ts` — add `defId: string` to `EnemyView`; populate in snapshot (`defId: e.defId` at the key/name mapping).
3. `src/ui/CombatHUD.ts` — `createEnemyDisplay`: drop unused `textureKey` param; texture resolution `enemy_${defId}_${state}` → generic `enemy_${state}` → placeholder `tok_${defId}`; aspect-fit token within 200×200.
4. `src/scenes/CombatScene.ts`:
   - `setPlayerPose` states → `idle|windup|attack|hit|guard|victory|defeat`; windup(250ms)→attack(300ms)→idle; hit 320ms; guard 1200ms; victory/defeat persist (no auto-revert).
   - Attack actions (attack/skill/resonance/sunder/charge) play windup→attack; guard action → `guard` pose; `flashPlayerHit` still reverts to idle.
   - `handleCombatEnd`: victory pose during summary (boss + normal branches); defeat pose with 800ms delay before `handleDeath`/fade.
   - Player sprite aspect-fit within 243×329 on every texture swap.
   - `createEnemyDisplay` call site updated (no textureKey arg).
5. Verify: typecheck + build; drop art → dev smoke test (attack flow, guard, hit, victory, defeat, per-enemy textures).

### Not changed
- `CombatEngine` and all `src/systems/combat/*` (pure logic; log/thoughts generation stays).
- `ChoiceMenu`, `Button`, modals, scenes other than Combat.
- Smoketest (no Phaser UI in tests).

## Verification
1. `npm run typecheck` and `npm run build` pass.
2. `npm run dev` → enter a wild combat; headless-Chrome screenshot at 1280×800; overlay-check key anchors against `battle_ui.png` ground truth (frame corners, stat panel, action grid slots, tooltip panel, turn order panel, enemy slots).
3. Behavioral spot-checks: Attack/Guard/Scan/Item/Skill menus work from the grid; END TURN ends the player phase; selection diamond tracks; AP pips + banked reserve update; tooltip panel shows action descriptions on hover and hides on out; turn order panel highlights current actor; companions listed; 2-enemy and 3-enemy spreads correct; level-up/insight/crisis/momentum modals unaffected.
