import Phaser from 'phaser';
import { createGame } from './game/Game';
import { SCENE_KEYS } from './utils/constants';
import { TOTAL_LEVELS } from './data/levels';
import { TOTAL_STAGES, clampStageIndex, getRoadmapStageInfo, getStageIndex } from './data/roadmap';

const ROTATE_PROMPT_ID = 'rotate-device-prompt';
const game = createGame();

function clampLevelIndex(levelIndex) {
  return Phaser.Math.Clamp(levelIndex, 0, TOTAL_LEVELS - 1);
}

function getLevelScene() {
  if (!game.scene.isActive(SCENE_KEYS.LEVEL)) {
    return null;
  }

  return game.scene.getScene(SCENE_KEYS.LEVEL);
}

function startGame(stageIndex = 0) {
  const target = clampStageIndex(stageIndex);
  game.scene.start(SCENE_KEYS.LEVEL, { stageIndex: target });
}

function restartLevel() {
  const levelScene = getLevelScene();
  if (levelScene) {
    levelScene.restartLevel();
    return;
  }

  const currentStage = clampStageIndex(game.registry.get('currentLevel') ?? 0);
  startGame(currentStage);
}

function goToLevel(levelIndex, sublevelIndex = 0) {
  const targetLevel = clampLevelIndex(levelIndex);
  startGame(getStageIndex(targetLevel, sublevelIndex));
}

function goToStage(stageIndex) {
  startGame(stageIndex);
}

function getGameState() {
  const levelScene = getLevelScene();
  const currentStage = clampStageIndex(game.registry.get('currentLevel') ?? 0);
  const unlockedStage = clampStageIndex(game.registry.get('unlockedLevel') ?? 0);
  const currentInfo = getRoadmapStageInfo(currentStage);
  const unlockedInfo = getRoadmapStageInfo(unlockedStage);

  return {
    currentLevel: currentInfo.levelNumber,
    currentSublevel: 1,
    currentStage: currentInfo.stageNumber,
    unlockedLevel: unlockedInfo.levelNumber,
    unlockedSublevel: 1,
    unlockedStage: unlockedInfo.stageNumber,
    totalStages: TOTAL_STAGES,
    deaths: game.registry.get('deaths') ?? 0,
    selectedSkin: game.registry.get('selectedSkin') ?? 'apollo',
    muted: game.registry.get('isMuted') ?? false,
    isPaused: levelScene?.isPaused ?? false,
    isLevelComplete: levelScene?.isLevelComplete ?? false,
  };
}

function isTouchMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
  const ua = navigator.userAgent || '';
  const isMobileLike = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  return hasTouch && isMobileLike;
}

function isPortraitViewport() {
  if (typeof window === 'undefined') {
    return false;
  }

  const viewport = window.visualViewport;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;

  return height > width;
}

function installMobileViewportSync() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (!isTouchMobileDevice()) {
    return;
  }

  const app = document.getElementById('app');
  const phaserContainer = document.getElementById('phaser-container');
  if (!app || !phaserContainer) {
    return;
  }

  const syncViewportSize = () => {
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);

    app.style.width = `${width}px`;
    app.style.height = `${height}px`;
    phaserContainer.style.width = `${width}px`;
    phaserContainer.style.height = `${height}px`;

    if (game?.scale) {
      game.scale.refresh();
    }
  };

  syncViewportSize();
  window.addEventListener('resize', syncViewportSize);
  window.addEventListener('orientationchange', syncViewportSize);
  window.visualViewport?.addEventListener('resize', syncViewportSize);
  window.visualViewport?.addEventListener('scroll', syncViewportSize);
}

function installRotatePrompt() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const promptElement = document.getElementById(ROTATE_PROMPT_ID);
  if (!promptElement) {
    return;
  }

  const shouldUsePrompt = isTouchMobileDevice();
  if (!shouldUsePrompt) {
    promptElement.hidden = true;
    promptElement.setAttribute('aria-hidden', 'true');
    return;
  }

  const syncPromptVisibility = () => {
    const showPrompt = isPortraitViewport();
    promptElement.hidden = !showPrompt;
    promptElement.setAttribute('aria-hidden', String(!showPrompt));
  };

  syncPromptVisibility();

  window.addEventListener('resize', syncPromptVisibility);
  window.addEventListener('orientationchange', syncPromptVisibility);
  window.visualViewport?.addEventListener('resize', syncPromptVisibility);
  window.visualViewport?.addEventListener('scroll', syncPromptVisibility);
}

installRotatePrompt();
installMobileViewportSync();

if (typeof window !== 'undefined') {
  // These methods are intentionally global so React Native WebView can call them directly.
  window.startGame = startGame;
  window.restartLevel = restartLevel;
  window.goToLevel = goToLevel;
  window.goToStage = goToStage;
  window.getGameState = getGameState;

  window.TrollGameBridge = {
    startGame,
    restartLevel,
    goToLevel,
    goToStage,
    getGameState,
  };
}
