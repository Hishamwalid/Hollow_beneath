# ENEMY ROSTER BY STAGE

*Which enemies can appear in each part of the run, and why.*

---

## 1. How Stages Work

The board is 200 nodes split into 20 pages of 10 nodes each. A **chapter** covers 40 nodes (4 pages) — there are 5 chapters (`BoardScene.ts:42-47`). **Stages are offset one page from chapters**: each stage owns a 4-page range, but stage 1 is pages 1–3 (the first chapter's last page, 31–40, already belongs to stage 2's pool).

Page numbers are **1-based** (`pageForIndex` = `ceil(index/10)` in `BoardGenerator.ts:35`).

| Stage | Pages | Nodes | Chapter |
|-------|-------|-------|---------|
| 1 | 1–3 | 1–30 | 1 (pages 1–4) |
| 2 | 4–7 | 31–70 | 1–2 |
| 3 | 8–11 | 71–110 | 2–3 |
| 4 | 12–15 | 111–150 | 3–4 |
| 5 | 16–20 | 151–200 | 4–5 |

The combat-node pool is chosen by **page + Resonance** in `enemiesForPage()` (`src/data/enemies.ts`):

```ts
const stage = stageForPage(page); // 1..5
const pools: string[][] = [
  ['dust_wight', 'echo_skeleton'],                              // stage 1, pages 1–3
  ['venn_custodian', 'sable_zealot', 'ash_seer'],               // stage 2, pages 4–7
  ['dust_road_raider', 'archive_cipher_wraith'],                // stage 3, pages 8–11
  ['sable_inquisitor', 'ash_mutant', 'echo_soldier'],           // stage 4, pages 12–15
  ['dust_road_raider', 'archive_cipher_wraith',
   'sable_inquisitor', 'ash_mutant', 'echo_soldier'],           // stage 5, pages 16–20
];
if (stage >= 3 && resonance >= 25) pool.push('memory_wraith');
if (stage >= 5 && resonance >= 50) pool.push('the_unread');
```

Scripted fights (event choices, faction ambushes) are stage-scrubbed by `sanitizeFightEnemies()`: any enemy from a later stage is replaced by a random member of the current stage's pool, so stage 1 only ever fights `dust_wight` and `echo_skeleton`.

---

## 2. Roster by Stage

Each stage has an **exclusive** roster — an enemy appears in exactly one stage (except stage 5, which reuses stages 3–4 elites).

| Stage | Pages | Enemies that can appear |
|-------|-------|-------------------------|
| 1 | 1–3 | Dust Wight, Echo-bleached Skeleton |
| 2 | 4–7 | Venn Custodian, Sable Zealot, Ash Covenant Seer |
| 3 | 8–11 | Dust-Road Raider, Archive Cipher-Wraith (Memory Wraith at Resonance ≥25) |
| 4 | 12–15 | Sable Inquisitor, Ash Covenant Mutant, Dominion Echo-Soldier |
| 5 | 16–20 | Dust-Road Raider, Archive Cipher-Wraith, Sable Inquisitor, Ash Covenant Mutant, Dominion Echo-Soldier (The Unread at Resonance ≥50) |

### Standard enemies (10)

| ID | Display name | Stage |
|----|--------------|-------|
| `dust_wight` | Dust Wight | 1 |
| `echo_skeleton` | Echo-bleached Skeleton | 1 |
| `venn_custodian` | Venn Custodian | 2 |
| `sable_zealot` | Sable Zealot | 2 |
| `ash_seer` | Ash Covenant Seer | 2 |
| `dust_road_raider` | Dust-Road Raider | 3 |
| `archive_cipher_wraith` | Archive Cipher-Wraith | 3 |
| `sable_inquisitor` | Sable Inquisitor | 4 |
| `ash_mutant` | Ash Covenant Mutant | 4 |
| `echo_soldier` | Dominion Echo-Soldier | 4 |

---

## 3. Resonance-Gated Enemies

| ID | Display name | Gate |
|----|--------------|------|
| `memory_wraith` | Memory Wraith | Stage 3+ (pages 8–20) and Resonance ≥25 |
| `the_unread` | The Unread | Stage 5 (pages 16–20) and Resonance ≥50 |

---

## 4. Bosses

One per chapter — the final node of a page is a landmark on chapter-boss pages **4, 8, 12, 16, 20** (`BoardScene.ts:143`). Bosses are defined in `src/data/bosses.ts`; each boss's `page` field is its real page (4/8/12/16/20), used for combat stat scaling and XP.

| Chapter | Boss ID | Display name | Page |
|---------|---------|--------------|------|
| 1 | `sentinel` | The Argent Sentinel | 4 |
| 2 | `patriarch` | Patriarch Oren Cass | 8 |
| 3 | `chorus` | The Merged Chorus | 12 |
| 4 | `fossil_king` | The Fossil King | 16 |
| 5 | `reflection` | The Final Reflection | 20 |

---

## Source References

- `src/data/enemies.ts` — `ENEMIES` roster, `enemiesForPage()`, `stageForPage()`, `stageForEnemy()`, `sanitizeFightEnemies()`
- `src/data/bosses.ts` — boss definitions and real boss pages
- `src/scenes/BoardScene.ts` — chapter math (`chapterForNode`, `NODES_PER_MAP`, `MAP_COUNT`), ambush sanitizing
- `src/scenes/EventScene.ts` — event-triggered combat sanitizing
- `src/scenes/PreloadScene.ts` — which per-enemy art folders are currently loaded (`echo_skeleton`, `dust_wight`)
