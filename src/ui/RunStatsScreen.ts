import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';
import { FONT_SERIF, FONT_MONO, PALETTE_HEX } from './uiTheme';
import { createButton } from './Button';
import type { RunStats } from '@data/types';

export interface RunStatsScreenHandle {
  destroy: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function showRunStatsScreen(
  scene: Phaser.Scene,
  stats: RunStats,
  isDeath: boolean,
  onReturnToMenu: () => void,
  onViewLoreCodex?: () => void,
): RunStatsScreenHandle {
  const depth = 200;
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;

  const container = scene.add.container(0, 0).setDepth(depth);

  const bg = scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85).setDepth(depth);
  container.add(bg);

  const titleText = isDeath ? 'THE HOLLOW KEEPS YOU' : 'PAGE 100';
  const title = scene.add.text(cx, 48, titleText, {
    fontFamily: FONT_SERIF, fontSize: '28px', color: isDeath ? PALETTE_HEX.danger : PALETTE_HEX.gold,
  }).setOrigin(0.5).setDepth(depth + 1);
  container.add(title);

  const subtitle = scene.add.text(cx, 80, isDeath ? 'Your run is over. The Loom notes your passage.' : stats.endingUnlocked ? `Ending: ${stats.endingUnlocked}` : 'Run Complete', {
    fontFamily: FONT_SERIF, fontSize: '13px', color: PALETTE_HEX.boneMuted, fontStyle: 'italic',
  }).setOrigin(0.5).setDepth(depth + 1);
  container.add(subtitle);

  const statsLeft = [
    { label: 'Nodes Visited', value: `${stats.nodesVisited}` },
    { label: 'Enemies Killed', value: `${stats.enemiesKilled}` },
    { label: 'Major Bosses', value: `${stats.bossesDefeated} / ${stats.totalBosses}` },
    { label: 'Level Reached', value: `${stats.levelReached}` },
    { label: 'Resonance Peak', value: `${stats.resonancePeak} (${stats.resonanceTier})` },
    { label: 'Choices Made', value: `${stats.choicesMade}` },
    { label: 'Lore Found', value: `${stats.loreFound} / ${stats.totalLore}` },
    { label: 'Run Time', value: formatTime(stats.runTimeSeconds) },
  ];

  const statStartY = 120;
  const rowH = 22;
  const col1X = cx - 220;
  const col2X = cx - 30;
  const col3X = cx + 120;

  const headerLabel = scene.add.text(col1X, statStartY, 'STAT', {
    fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.gold,
  }).setOrigin(0, 0.5).setDepth(depth + 1);
  container.add(headerLabel);

  const headerThis = scene.add.text(col2X, statStartY, 'This Run', {
    fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.gold,
  }).setOrigin(0, 0.5).setDepth(depth + 1);
  container.add(headerThis);

  const headerBest = scene.add.text(col3X, statStartY, 'Best', {
    fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.gold,
  }).setOrigin(0, 0.5).setDepth(depth + 1);
  container.add(headerBest);

  statsLeft.forEach((stat, i) => {
    const y = statStartY + 10 + (i + 1) * rowH;

    const labelText = scene.add.text(col1X, y, stat.label, {
      fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(0, 0.5).setDepth(depth + 1);
    container.add(labelText);

    const valueText = scene.add.text(col2X, y, stat.value, {
      fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.bone,
    }).setOrigin(0, 0.5).setDepth(depth + 1);
    container.add(valueText);
  });

  const bestValues = [
    `${stats.bestRun.nodesVisited}`,
    `${stats.bestRun.enemiesKilled}`,
    `${stats.bestRun.bossesDefeated} / ${stats.totalBosses}`,
    `${stats.bestRun.levelReached}`,
    `${stats.bestRun.resonancePeak}`,
    `${stats.bestRun.choicesMade}`,
    `${stats.bestRun.loreFound} / ${stats.totalLore}`,
    stats.bestRun.time > 0 ? formatTime(Math.floor(stats.bestRun.time / 1000)) : '--',
  ];

  bestValues.forEach((val, i) => {
    const y = statStartY + 10 + (i + 1) * rowH;
    const text = scene.add.text(col3X, y, val, {
      fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(0, 0.5).setDepth(depth + 1);
    container.add(text);
  });

  if (stats.isNewBest) {
    const newBest = scene.add.text(cx, statStartY + 10 + 9 * rowH + 6, '★ NEW BEST RUN!', {
      fontFamily: FONT_SERIF, fontSize: '14px', color: PALETTE_HEX.goldBright,
    }).setOrigin(0.5).setDepth(depth + 1);
    container.add(newBest);
  }

  const dividerY = statStartY + 10 + 9 * rowH + 28;
  const divider = scene.add.rectangle(cx, dividerY, 500, 1, 0x555555, 0.5).setDepth(depth + 1);
  container.add(divider);

  let currentY = dividerY + 8;

  if (stats.newLoreTitles.length > 0) {
    const loreHeader = scene.add.text(cx - 200, currentY, '★ New Lore Fragments:', {
      fontFamily: FONT_MONO, fontSize: '11px', color: PALETTE_HEX.gold,
    }).setOrigin(0, 0.5).setDepth(depth + 1);
    container.add(loreHeader);
    currentY += 18;
    stats.newLoreTitles.forEach((title) => {
      const t = scene.add.text(cx - 180, currentY, `"${title}"`, {
        fontFamily: FONT_SERIF, fontSize: '12px', color: PALETTE_HEX.bone, fontStyle: 'italic',
      }).setOrigin(0, 0.5).setDepth(depth + 1);
      container.add(t);
      currentY += 16;
    });
    currentY += 4;
  }

  const shardsSectionY = currentY;
  const earnedText = scene.add.text(cx - 200, shardsSectionY, `Echo Shards earned this run:  +${stats.echoShardsEarned}`, {
    fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.gold,
  }).setOrigin(0, 0.5).setDepth(depth + 1);
  container.add(earnedText);

  const totalShardsText = scene.add.text(cx - 200, shardsSectionY + 18, `Total Echo Shards:  ${stats.totalEchoShards}`, {
    fontFamily: FONT_MONO, fontSize: '12px', color: PALETTE_HEX.bone,
  }).setOrigin(0, 0.5).setDepth(depth + 1);
  container.add(totalShardsText);

  const flavorY = shardsSectionY + 50;
  const flavorPhrases = isDeath
    ? ['The stone remembers your footsteps.', 'The Loom adds your voice to its collection.']
    : ['The story settles into the bedrock.', 'The Loom turns the page.'];
  const flavorText = scene.add.text(cx, flavorY, flavorPhrases.join(' '), {
    fontFamily: FONT_SERIF, fontSize: '12px', color: PALETTE_HEX.boneMuted, fontStyle: 'italic',
    wordWrap: { width: 500 }, align: 'center',
  }).setOrigin(0.5).setDepth(depth + 1);
  container.add(flavorText);

  const btnY = GAME_HEIGHT - 50;
  const menuBtn = createButton(scene, cx - 80, btnY, 'Return to Menu', () => {
    container.destroy();
    onReturnToMenu();
  }, { width: 180, depth: depth + 2 });
  container.add(menuBtn.container);
  if (onViewLoreCodex) {
    const codexBtn = createButton(scene, cx + 100, btnY, 'View Lore Codex', () => {
      container.destroy();
      onViewLoreCodex();
    }, { width: 180, depth: depth + 2 });
    container.add(codexBtn.container);
  }

  return {
    destroy: () => container.destroy(),
  };
}
