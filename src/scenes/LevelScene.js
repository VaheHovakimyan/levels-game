import Phaser from 'phaser';
import { LEVELS, TOTAL_LEVELS } from '../data/levels';
import { TOTAL_STAGES, clampStageIndex, getRoadmapStageInfo } from '../data/roadmap';
import { Player } from '../entities/Player';
import { LevelLoader } from '../systems/LevelLoader';
import { TrapController } from '../systems/TrapController';
import { VirtualControls } from '../ui/VirtualControls';
import { SCENE_KEYS, GAME_EVENTS } from '../utils/constants';
import { saveSelectedSkin, saveUnlockedLevel } from '../utils/storage';
import { eventBridge } from '../integration/EventBridge';
import { SoundManager } from '../systems/SoundManager';
import { getSkinLabel, PLAYER_SKINS, sanitizeSkinKey } from '../entities/playerArt';

const RESPAWN_DELAY_MS = 260;

export class LevelScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.LEVEL);

    this.stageIndex = 0;
    this.levelIndex = 0;
    this.levelData = null;
    this.levelLoader = null;
    this.trapController = null;
    this.player = null;

    this.keys = null;
    this.virtualControls = null;

    this.deathCount = 0;
    this.deathsThisRun = 0;
    this.deathY = 0;

    this.isRespawning = false;
    this.isPaused = false;
    this.isLevelComplete = false;

    this.respawnTimer = null;
  }

  init(data) {
    const requestedStage = data?.stageIndex ?? data?.levelIndex ?? this.registry.get('currentLevel') ?? 0;
    this.stageIndex = clampStageIndex(requestedStage);
  }

  create() {
    this.isRespawning = false;
    this.isPaused = false;
    this.isLevelComplete = false;
    this.deathY = 0;

    if (this.respawnTimer) {
      this.respawnTimer.remove(false);
      this.respawnTimer = null;
    }

    this.physics.world.resume();

    const stageInfo = getRoadmapStageInfo(this.stageIndex);
    this.levelIndex = stageInfo.levelIndex;

    this.levelData = LEVELS[this.levelIndex];
    this.registry.set('currentLevel', this.stageIndex);

    this.soundManager = new SoundManager(this);

    this.levelLoader = new LevelLoader(this);
    const levelInfo = this.levelLoader.build(this.levelData);
    this.deathY = levelInfo.deathY;

    const selectedSkin = sanitizeSkinKey(this.registry.get('selectedSkin') ?? PLAYER_SKINS[0].key);
    this.registry.set('selectedSkin', selectedSkin);

    this.player = new Player(this, levelInfo.spawn.x, levelInfo.spawn.y, selectedSkin);
    this.player.setModifiers(levelInfo.modifiers);

    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      restart: Phaser.Input.Keyboard.KeyCodes.R,
      pause: Phaser.Input.Keyboard.KeyCodes.P,
      escape: Phaser.Input.Keyboard.KeyCodes.ESC,
    });

    this.virtualControls = new VirtualControls(this);
    this.player.setInput(this.keys, this.virtualControls);

    this.cameras.main.setZoom(1);
    this.cameras.main.startFollow(this.player, true, 0.16, 0.16);
    this.cameras.main.fadeIn(200, 6, 10, 20);

    this.trapController = new TrapController(this, {
      player: this.player,
      levelLoader: this.levelLoader,
      onFail: (reason) => this.failLevel(reason),
      onLevelComplete: (door) => this.completeLevel(door),
      onTrapTriggered: () => {
        this.cameras.main.shake(60, 0.003);
        this.soundManager.playSfx('alien-hiss');
      },
    });

    this.deathCount = this.registry.get('deaths') ?? 0;
    this.deathsThisRun = 0;

    this.emitUiUpdate();
    this.game.events.emit(GAME_EVENTS.UI_HIDE_LEVEL_COMPLETE);
    this.game.events.emit(GAME_EVENTS.UI_MESSAGE, { text: levelInfo.message });
    this.game.events.emit(GAME_EVENTS.UI_LEVEL_INTRO, {
      level: this.levelIndex + 1,
      totalLevels: TOTAL_LEVELS,
      worldName: stageInfo.worldName,
      levelName: levelInfo.levelName,
      modifiers: this.levelData.modifiers,
    });

    if (!this.scene.isActive(SCENE_KEYS.UI)) {
      this.scene.launch(SCENE_KEYS.UI);
    } else {
      this.scene.bringToTop(SCENE_KEYS.UI);
    }

    eventBridge.emitLevelStarted({
      level: this.levelIndex + 1,
      sublevel: 1,
      stage: this.stageIndex + 1,
      modifiers: this.levelData.modifiers,
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  failLevel(reason) {
    this.killPlayer(reason);
  }

  killPlayer(reason) {
    if (this.isRespawning || this.isPaused || this.isLevelComplete) {
      return;
    }

    this.isRespawning = true;
    this.physics.world.pause();

    this.deathCount += 1;
    this.deathsThisRun += 1;
    this.registry.set('deaths', this.deathCount);

    this.player.freeze();
    this.player.playDeathFeedback();
    this.spawnDeathBurst(this.player.x, this.player.y);

    this.soundManager.playSfx('death');
    this.cameras.main.shake(110, 0.007);

    this.emitUiUpdate();
    this.game.events.emit(GAME_EVENTS.UI_DEATH_FEEDBACK, {
      reason,
      deaths: this.deathCount,
      runDeaths: this.deathsThisRun,
    });

    eventBridge.emitLevelFailed({
      level: this.levelIndex + 1,
      sublevel: 1,
      stage: this.stageIndex + 1,
      deaths: this.deathCount,
      runDeaths: this.deathsThisRun,
      reason,
    });

    if (this.respawnTimer) {
      this.respawnTimer.remove(false);
      this.respawnTimer = null;
    }

    this.respawnTimer = this.time.delayedCall(RESPAWN_DELAY_MS, () => this.respawnPlayer());
  }

  respawnPlayer() {
    this.levelLoader.resetDynamicObjects();
    this.player.respawn(this.levelData.spawn);

    this.resetCameraToSpawn();

    this.physics.world.resume();
    this.isRespawning = false;
    this.respawnTimer = null;
    this.emitUiUpdate();
  }

  resetCameraToSpawn() {
    const camera = this.cameras.main;

    camera.stopFollow();

    const targetX = Phaser.Math.Clamp(
      this.levelData.spawn.x - camera.width * 0.28,
      0,
      Math.max(0, this.levelData.worldWidth - camera.width),
    );

    camera.setScroll(targetX, 0);
    camera.startFollow(this.player, true, 0.16, 0.16);
  }

  spawnDeathBurst(x, y) {
    for (let i = 0; i < 12; i += 1) {
      const bit = this.add.rectangle(x, y, 5, 5, i % 2 === 0 ? 0x8ce8ff : 0xb49fff, 1).setDepth(1200);
      const angle = Phaser.Math.DegToRad(i * 30 + Phaser.Math.Between(-12, 12));
      const speed = Phaser.Math.Between(34, 110);
      const distanceX = Math.cos(angle) * speed;
      const distanceY = Math.sin(angle) * speed;

      this.tweens.add({
        targets: bit,
        x: x + distanceX,
        y: y + distanceY,
        alpha: 0,
        duration: Phaser.Math.Between(140, 240),
        ease: 'Quad.Out',
        onComplete: () => bit.destroy(),
      });
    }
  }

  completeLevel(door = null) {
    if (this.isLevelComplete || this.isRespawning) {
      return;
    }

    this.isLevelComplete = true;
    this.player.freeze();
    this.physics.world.pause();
    this.soundManager.playSfx('complete');

    const finalize = () => this.finishLevelComplete();
    if (door?.playCompleteSequence) {
      door.playCompleteSequence(this.player, this.soundManager, finalize);
      return;
    }

    finalize();
  }

  finishLevelComplete() {
    this.player.setVisible(false);

    const currentUnlocked = clampStageIndex(this.registry.get('unlockedLevel') ?? 0);
    const nextUnlocked = Math.max(currentUnlocked, Math.min(this.stageIndex + 1, TOTAL_STAGES - 1));

    if (nextUnlocked !== currentUnlocked) {
      this.registry.set('unlockedLevel', nextUnlocked);
      saveUnlockedLevel(nextUnlocked);
    }
    // Keep "continue" aligned with latest unlocked progress.
    this.registry.set('currentLevel', nextUnlocked);

    eventBridge.emitLevelCompleted({
      level: this.levelIndex + 1,
      sublevel: 1,
      stage: this.stageIndex + 1,
      deaths: this.deathCount,
      runDeaths: this.deathsThisRun,
      unlockedStage: nextUnlocked + 1,
    });

    if (this.stageIndex === TOTAL_STAGES - 1) {
      eventBridge.emitGameCompleted({
        deaths: this.deathCount,
        totalLevels: TOTAL_LEVELS,
        totalStages: TOTAL_STAGES,
      });

      this.game.events.emit(GAME_EVENTS.UI_GAME_COMPLETE, {
        deaths: this.deathCount,
      });
    }

    this.game.events.emit(GAME_EVENTS.UI_LEVEL_COMPLETE, {
      level: this.levelIndex + 1,
      levelName: this.levelData?.name,
      totalLevels: TOTAL_LEVELS,
      isFinalLevel: this.stageIndex === TOTAL_STAGES - 1,
      runDeaths: this.deathsThisRun,
    });
  }

  restartLevel() {
    if (this.respawnTimer) {
      this.respawnTimer.remove(false);
      this.respawnTimer = null;
    }

    this.physics.world.resume();
    this.scene.restart({ stageIndex: this.stageIndex });
  }

  goToLevel(stageIndex) {
    const target = clampStageIndex(stageIndex);

    if (this.respawnTimer) {
      this.respawnTimer.remove(false);
      this.respawnTimer = null;
    }

    this.physics.world.resume();
    this.scene.restart({ stageIndex: target });
  }

  goToNextLevel() {
    if (this.stageIndex >= TOTAL_STAGES - 1) {
      this.goToMenu();
      return;
    }

    this.goToLevel(this.stageIndex + 1);
  }

  goToMenu() {
    if (this.respawnTimer) {
      this.respawnTimer.remove(false);
      this.respawnTimer = null;
    }

    this.physics.world.resume();
    if (this.scene.isActive(SCENE_KEYS.UI)) {
      this.scene.stop(SCENE_KEYS.UI);
    }
    this.scene.start(SCENE_KEYS.MENU);
  }

  togglePause() {
    if (this.isLevelComplete || this.isRespawning) {
      return;
    }

    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.physics.world.pause();
      this.player.freeze();
    } else {
      this.physics.world.resume();
      this.player.unfreeze();
    }

    this.emitUiUpdate();
  }

  toggleMute() {
    const muted = this.soundManager.toggleMuted();
    this.emitUiUpdate();
    return muted;
  }

  setSkin(skinKey) {
    const safeSkin = sanitizeSkinKey(skinKey);
    this.registry.set('selectedSkin', safeSkin);
    saveSelectedSkin(safeSkin);
    this.player.setSkin(safeSkin);
    this.emitUiUpdate();
  }

  cycleSkin() {
    const current = sanitizeSkinKey(this.registry.get('selectedSkin') ?? PLAYER_SKINS[0].key);
    const currentIndex = PLAYER_SKINS.findIndex((skin) => skin.key === current);
    const nextIndex = (currentIndex + 1) % PLAYER_SKINS.length;
    const nextSkin = PLAYER_SKINS[nextIndex].key;

    this.setSkin(nextSkin);
    return nextSkin;
  }

  emitUiUpdate() {
    this.game.events.emit(GAME_EVENTS.UI_UPDATE, {
      level: this.levelIndex + 1,
      totalLevels: TOTAL_LEVELS,
      stage: this.stageIndex + 1,
      totalStages: TOTAL_STAGES,
      levelName: this.levelData?.name,
      deaths: this.deathCount,
      runDeaths: this.deathsThisRun,
      paused: this.isPaused,
      muted: this.registry.get('isMuted') ?? false,
      skinKey: this.registry.get('selectedSkin') ?? PLAYER_SKINS[0].key,
      skinLabel: getSkinLabel(this.registry.get('selectedSkin') ?? PLAYER_SKINS[0].key),
    });
  }

  onShutdown() {
    if (this.respawnTimer) {
      this.respawnTimer.remove(false);
      this.respawnTimer = null;
    }

    this.trapController?.destroy();
    this.virtualControls?.destroy();
    this.levelLoader?.clear();
    this.tweens.killAll();
  }

  update(time) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.restart)) {
      this.restartLevel();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
      this.togglePause();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.escape)) {
      this.goToMenu();
      return;
    }

    this.virtualControls.update();

    if (this.isPaused || this.isRespawning || this.isLevelComplete) {
      return;
    }

    if (this.player.body.bottom > this.deathY) {
      this.failLevel('fall');
      return;
    }

    this.player.update(time);
    this.trapController.update();
  }
}
