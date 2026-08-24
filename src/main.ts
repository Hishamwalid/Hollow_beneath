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
import { CreditsScene } from '@scenes/CreditsScene';
import { TheOfferScene } from '@scenes/TheOfferScene';
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

// ---------------------------------------------------------------------------
// Sharp-text patch — every Text glyph texture renders at the display's pixel
// density. Without this, text rasterizes at 1x inside the fixed 1280x800
// canvas and looks blurry once Scale.FIT stretches it on HiDPI / scaled
// displays (Windows 125-150%, Retina). One patch point covers every
// this.add.text(...) call in the codebase.
// ---------------------------------------------------------------------------
const TEXT_RESOLUTION = Math.min(2, Math.max(1, Math.ceil(window.devicePixelRatio || 1)));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
const factoryProto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as Record<string, AnyFn>;
const factoryText = factoryProto.text;
factoryProto.text = function (
  this: unknown,
  x?: number,
  y?: number,
  content?: string,
  style?: Phaser.Types.GameObjects.Text.TextStyle,
) {
  return factoryText.call(this, x, y, content, { ...(style ?? {}), resolution: TEXT_RESOLUTION });
} as AnyFn;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'app',
  backgroundColor: '#0b0d10',
  render: {
    antialias: true,
  },
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
    CreditsScene,
    TheOfferScene,
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
