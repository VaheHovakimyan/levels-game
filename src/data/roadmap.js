import Phaser from 'phaser';
import { TOTAL_LEVELS } from './levels';

export const SUBLEVELS_PER_LEVEL = 1;
export const LEVELS_PER_WORLD = 5;
export const TOTAL_STAGES = TOTAL_LEVELS;

export const ROADMAP_WORLDS = [
  { key: 'earth', name: 'Earth Orbit', startLevel: 1, count: LEVELS_PER_WORLD, color: 0x63a4ff },
  { key: 'moon', name: 'Moon Frontier', startLevel: 6, count: LEVELS_PER_WORLD, color: 0xb3c7de },
];

export function clampStageIndex(stageIndex) {
  return Phaser.Math.Clamp(stageIndex, 0, TOTAL_STAGES - 1);
}

export function getStageIndex(levelIndex, sublevelIndex = 0) {
  const safeLevel = Phaser.Math.Clamp(levelIndex, 0, TOTAL_LEVELS - 1);
  const safeSublevel = Phaser.Math.Clamp(sublevelIndex, 0, SUBLEVELS_PER_LEVEL - 1);
  return safeLevel + safeSublevel * 0;
}

export function getRoadmapStageInfo(stageIndex) {
  const safeStage = clampStageIndex(stageIndex);
  const levelIndex = safeStage;
  const sublevelIndex = 0;
  const worldIndex = Math.floor(levelIndex / LEVELS_PER_WORLD);
  const world = ROADMAP_WORLDS[worldIndex] || ROADMAP_WORLDS[0];

  return {
    stageIndex: safeStage,
    stageNumber: safeStage + 1,
    totalStages: TOTAL_STAGES,
    levelIndex,
    levelNumber: levelIndex + 1,
    worldIndex,
    worldName: world.name,
    sublevelIndex,
    sublevelNumber: sublevelIndex + 1,
    sublevelCount: SUBLEVELS_PER_LEVEL,
  };
}

export function formatStageLabel(stageIndex) {
  const info = getRoadmapStageInfo(stageIndex);
  return `L${info.levelNumber}`;
}
