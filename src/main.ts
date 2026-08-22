import Phaser from 'phaser';
import './style.css';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { BootScene } from '@scenes/BootScene';
import { PreloadScene } from '@scenes/PreloadScene';
import { MenuScene } from '@scenes/MenuScene';
import { CharacterCreationScene } from '@scenes/CharacterCreationScene';
import { ShardShopScene } from '@scenes/ShardShopScene';
import { LoreCodexScene } from '@scenes/LoreCodexScene';
import { BoardScene } from '@scenes/BoardScene';
import { EventScene } from '@scenes/EventScene';
import { CombatScene } from '@scenes/CombatScene';
import { LandmarkScene } from '@scenes/LandmarkScene';
import { EndingScene } from '@scenes/EndingScene';
import { GameOverScene } from '@scenes/GameOverScene';
import { SettingsScene } from '@scenes/SettingsScene';
import { InventoryScene } from '@scenes/InventoryScene';
import { LoadoutScene } from '@scenes/LoadoutScene';
import { TutorialScene } from '@scenes/TutorialScene';
import { PathPointPickerScene } from '@scenes/PathPointPickerScene';
import { NodePreviewScene } from '@scenes/dev/NodePreviewScene';

window.addEventListener('error', (e) => {
  console.error('GLOBAL ERROR:', e.error ?? e.message, e);
});

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'app',
  backgroundColor: '#0b0d10',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    PreloadScene,
    TutorialScene,
    MenuScene,
    CharacterCreationScene,
    ShardShopScene,
    LoreCodexScene,
    BoardScene,
    EventScene,
    CombatScene,
    LandmarkScene,
    EndingScene,
    GameOverScene,
    SettingsScene,
    InventoryScene,
    LoadoutScene,
    PathPointPickerScene,
    NodePreviewScene,
  ],
};

const game = new Phaser.Game(config);
(window as any).game = game; // dev convenience — remove before shipping
