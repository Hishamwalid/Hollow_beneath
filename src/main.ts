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

function showErrorOverlay(label: string, detail: unknown) {
  let overlay = document.getElementById('hb-error-overlay');
  if (!overlay) {
    overlay = document.createElement('pre');
    overlay.id = 'hb-error-overlay';
    overlay.style.cssText =
      'position:fixed;left:8px;bottom:8px;max-width:80vw;max-height:45vh;overflow:auto;' +
      'background:#3a0d0d;color:#ffd9d9;border:1px solid #b0453f;padding:10px;font:12px monospace;' +
      'z-index:99999;white-space:pre-wrap;pointer-events:none;';
    document.body.appendChild(overlay);
  }
  overlay.textContent += `${label}\n${detail instanceof Error ? (detail.stack ?? detail.message) : String(detail)}\n\n`;
}

window.addEventListener('error', (e) => {
  console.error('GLOBAL ERROR:', e.error ?? e.message, e);
  showErrorOverlay('GLOBAL ERROR:', e.error ?? e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('UNHANDLED REJECTION:', e.reason);
  showErrorOverlay('UNHANDLED REJECTION:', e.reason);
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

// --- Dev/debug hook: /?debugEvent=1 boots straight into a story event scene ---
const DEBUG_EVENT = new URLSearchParams(window.location.search).has('debugEvent');

async function buildDebugScenes(): Promise<Phaser.Types.Scenes.SceneType[]> {
  const [{ useGameStore }, { STARTING_STATS }, { STORY_EVENTS }] = await Promise.all([
    import('@store/gameStore'),
    import('@data/stats'),
    import('@data/storyEvents'),
  ]);
  useGameStore.getState().startNewRun({ ...STARTING_STATS }, 'Debug');
  class DebugBoot extends Phaser.Scene {
    constructor() {
      super('DebugBoot');
    }
    async create() {
      const { generatePlaceholderTextures } = await import('@placeholder/PlaceholderTextures');
      generatePlaceholderTextures(this);
      this.scene.start('Event', { eventDef: STORY_EVENTS.eves_first_voice });
    }
  }
  return [DebugBoot, EventScene];
}

let sceneList: Phaser.Types.Scenes.SceneType[] = [
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
];
// Dev-only authoring tools ship out of the bundle unless explicitly summoned.
if (new URLSearchParams(window.location.search).has('dev')) {
  sceneList.push(PathPointPickerScene, NodePreviewScene);
}
if (DEBUG_EVENT) sceneList = await buildDebugScenes();

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
  scene: sceneList,
};

const game = new Phaser.Game(config);
export { game };
