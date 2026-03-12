import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, GRAVITY_Y, SCENE_KEYS } from '../utils/constants';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MenuScene } from '../scenes/MenuScene';
import { LevelScene } from '../scenes/LevelScene';
import { UIScene } from '../scenes/UIScene';
import { getRecommendedTextResolution } from '../ui/text';

function installTextSmoothing() {
  const factoryProto = Phaser.GameObjects.GameObjectFactory.prototype;
  if (factoryProto.__smoothTextInstalled) {
    return;
  }

  const textResolution = getRecommendedTextResolution();
  const originalTextFactory = factoryProto.text;
  factoryProto.text = function patchedTextFactory(...args) {
    const text = originalTextFactory.apply(this, args);
    if (typeof text.setResolution === 'function') {
      text.setResolution(textResolution);
    }

    if (!text.__snapPositionPatched && typeof text.setPosition === 'function') {
      const originalSetPosition = text.setPosition;
      text.setPosition = function patchedSetPosition(x, y, ...rest) {
        return originalSetPosition.call(this, Math.round(x), Math.round(y), ...rest);
      };
      text.__snapPositionPatched = true;
      text.setPosition(text.x, text.y);
    }

    return text;
  };

  factoryProto.__smoothTextInstalled = true;
}

function getScaleMode() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return Phaser.Scale.FIT;
  }

  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
  return hasTouch ? Phaser.Scale.ENVELOP : Phaser.Scale.FIT;
}

export function createGame() {
  installTextSmoothing();

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'phaser-container',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#000000',
    pixelArt: false,
    roundPixels: false,
    antialias: true,
    autoRound: false,
    render: {
      antialias: true,
      antialiasGL: true,
      roundPixels: false,
      pixelArt: false,
      powerPreference: 'high-performance',
    },
    scale: {
      mode: getScaleMode(),
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: GRAVITY_Y },
        debug: false,
      },
    },
    input: {
      activePointers: 6,
      touch: {
        capture: true,
      },
      mouse: {
        preventDefaultDown: true,
        preventDefaultUp: true,
        preventDefaultMove: true,
        preventDefaultWheel: true,
      },
    },
    scene: [BootScene, PreloadScene, MenuScene, LevelScene, UIScene],
    callbacks: {
      postBoot: (game) => {
        game.scale.on('resize', () => {
          // Hook point for React Native WebView host resize synchronization.
        });
      },
    },
  });
}

export { SCENE_KEYS };
