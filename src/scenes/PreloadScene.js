import Phaser from 'phaser';
import { SCENE_KEYS } from '../utils/constants';
import { ensurePlayerArt } from '../entities/playerArt';
import alienDroneUrl from '../../assets/space/traps/alien-drone.svg';
import alienHiddenTrapUrl from '../../assets/space/traps/alien-hidden-trap.svg';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.PRELOAD);
  }

  preload() {
    this.load.image('alien-drone', alienDroneUrl);
    this.load.image('alien-hidden-trap', alienHiddenTrapUrl);
  }

  create() {
    ensurePlayerArt(this);
    this.scene.start(SCENE_KEYS.MENU);
  }
}
