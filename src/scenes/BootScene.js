import Phaser from 'phaser';
import { SCENE_KEYS } from '../utils/constants';
import { TOTAL_STAGES } from '../data/roadmap';
import { loadUnlockedLevel, loadMuteState, loadSelectedSkin } from '../utils/storage';
import { sanitizeSkinKey } from '../entities/playerArt';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  create() {
    const unlockedLevel = loadUnlockedLevel(TOTAL_STAGES - 1);

    this.registry.set('unlockedLevel', unlockedLevel);
    this.registry.set('currentLevel', 0);
    this.registry.set('deaths', 0);
    this.registry.set('isMuted', loadMuteState());
    this.registry.set('selectedSkin', sanitizeSkinKey(loadSelectedSkin()));

    this.scene.start(SCENE_KEYS.PRELOAD);
  }
}
