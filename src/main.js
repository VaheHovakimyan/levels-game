import Phaser from 'phaser';
import { createGame } from './game/Game';
import { SCENE_KEYS } from './utils/constants';
import { TOTAL_LEVELS } from './data/levels';
import { TOTAL_STAGES, clampStageIndex, getRoadmapStageInfo, getStageIndex } from './data/roadmap';

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
