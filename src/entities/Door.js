import Phaser from 'phaser';

const EXIT_WALL_GAP = 3;
const EXIT_WALL_MIN_THICKNESS = 16;

function doorPalette(isDecoy) {
  if (isDecoy) {
    return {
      frame: 0x7a4d34,
      shell: 0x2a1f24,
      glow: 0xffc483,
      trim: 0xc77f5f,
      light: 0xffe2b0,
      shutter: 0x5f3f3a,
    };
  }

  return {
    frame: 0x375c84,
    shell: 0x10263f,
    glow: 0x7ef7ff,
    trim: 0x7fb9ff,
    light: 0xd2f8ff,
    shutter: 0x223955,
  };
}

export class Door extends Phaser.GameObjects.Rectangle {
  constructor(scene, config) {
    const isDecoy = Boolean(config.decoy);
    const palette = doorPalette(isDecoy);
    const width = config.width || 34;
    const height = config.height || 48;

    super(scene, config.x, config.y, width, height, palette.shell, 0.001);

    this.scene = scene;
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);

    this.body.setAllowGravity(false);
    this.body.setImmovable(true);

    this.decoy = isDecoy;
    this.label = config.label || '';

    this.startX = config.x;
    this.startY = config.y;
    this.moving = config.moving || null;
    this.direction = 1;

    this.centerTolerance = config.centerTolerance ?? Math.max(8, width * 0.26);
    this.exitWall = null;
    this.exitWallVisual = null;
    this.exitWallTint = palette.glow;
    this.exitWallOffsetX = width * 0.5 + Math.max(EXIT_WALL_MIN_THICKNESS, Math.round(width * 0.55)) * 0.5 + EXIT_WALL_GAP;

    this.sequenceRunning = false;
    this.openProgress = 0;

    this.setDepth(210);

    this.outerFrame = this.scene.add
      .rectangle(this.x, this.y + 1, width + 12, height + 12, palette.frame, 0.95)
      .setStrokeStyle(2, palette.trim, 0.9)
      .setDepth(205);

    this.airlockShell = this.scene.add
      .rectangle(this.x, this.y + 1, width + 3, height + 4, palette.shell, 0.98)
      .setStrokeStyle(1.5, palette.trim, 0.5)
      .setDepth(208);

    this.shutterLeft = this.scene.add.rectangle(this.x - width * 0.17, this.y + 2, width * 0.42, height - 8, palette.shutter, 0.96).setDepth(211);
    this.shutterRight = this.scene.add.rectangle(this.x + width * 0.17, this.y + 2, width * 0.42, height - 8, palette.shutter, 0.96).setDepth(211);

    this.centerBeam = this.scene.add.rectangle(this.x, this.y + 1, 3, height - 12, palette.glow, this.decoy ? 0.3 : 0.72).setDepth(212);
    this.beacon = this.scene.add.circle(this.x, this.y - height * 0.36, 4, palette.light, this.decoy ? 0.6 : 0.95).setDepth(213);
    this.glow = this.scene.add.ellipse(this.x, this.y - 15, width * 1.35, 14, palette.glow, this.decoy ? 0.24 : 0.42).setDepth(204);

    this.scene.tweens.add({
      targets: [this.beacon, this.glow, this.centerBeam],
      alpha: { from: this.decoy ? 0.26 : 0.5, to: this.decoy ? 0.7 : 1 },
      duration: this.decoy ? 640 : 920,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    if (!this.decoy) {
      this.createExitWall();
    }

    this.syncDecor();
  }

  isPlayerCentered(player) {
    const horizontal = Math.abs(player.x - this.x) <= this.centerTolerance;
    const vertical = player.y >= this.y - this.height * 0.58 && player.y <= this.y + this.height * 0.65;
    return horizontal && vertical;
  }

  setOpenProgress(value) {
    this.openProgress = Phaser.Math.Clamp(value, 0, 1);
    this.syncDecor();
  }

  syncDecor() {
    const openOffset = this.openProgress * Math.max(5, this.width * 0.2);

    this.outerFrame.setPosition(this.x, this.y + 1);
    this.airlockShell.setPosition(this.x, this.y + 1);

    this.shutterLeft.setPosition(this.x - this.width * 0.17 - openOffset, this.y + 2);
    this.shutterRight.setPosition(this.x + this.width * 0.17 + openOffset, this.y + 2);

    this.centerBeam.setPosition(this.x, this.y + 1);
    this.centerBeam.setAlpha((this.decoy ? 0.25 : 0.6) * (1 - this.openProgress * 0.8));

    this.beacon.setPosition(this.x, this.y - this.height * 0.36);
    this.glow.setPosition(this.x, this.y - 15);

    this.syncExitWall();
  }

  createExitWall() {
    const wallThickness = Math.max(EXIT_WALL_MIN_THICKNESS, Math.round(this.width * 0.55));
    const worldHeight = this.scene.physics.world.bounds.height || this.scene.scale.height;
    const wallX = this.x + this.exitWallOffsetX;

    this.exitWall = this.scene.add.zone(wallX, worldHeight / 2, wallThickness, worldHeight).setVisible(false);
    this.scene.physics.add.existing(this.exitWall);
    this.exitWall.body.setSize(wallThickness, worldHeight);
    this.exitWall.body.setAllowGravity(false);
    this.exitWall.body.setImmovable(true);

    // Visual beam so players can see the blocked drop area near the airlock.
    this.exitWallVisual = this.scene.add
      .rectangle(wallX, worldHeight / 2, wallThickness, worldHeight, this.exitWallTint, 0.18)
      .setDepth(203)
      .setStrokeStyle(1, this.exitWallTint, 0.42);
  }

  syncExitWall() {
    if (!this.exitWall) {
      return;
    }

    const worldHeight = this.scene.physics.world.bounds.height || this.scene.scale.height;
    this.exitWall.setPosition(this.x + this.exitWallOffsetX, worldHeight / 2);
    this.exitWallVisual?.setPosition(this.x + this.exitWallOffsetX, worldHeight / 2);
    this.exitWallVisual?.setSize(this.exitWall.width, worldHeight);
  }

  getExitWall() {
    return this.exitWall;
  }

  playCompleteSequence(player, soundManager, onComplete) {
    if (this.decoy || this.sequenceRunning) {
      onComplete?.();
      return;
    }

    this.sequenceRunning = true;
    soundManager?.playSfx('airlock-open');

    this.scene.tweens.add({
      targets: this,
      openProgress: 1,
      duration: 240,
      ease: 'Sine.Out',
      onUpdate: () => this.syncDecor(),
      onComplete: () => {
        this.scene.tweens.add({
          targets: player,
          x: this.x,
          y: this.y + 2,
          alpha: 0.08,
          duration: 230,
          ease: 'Quad.In',
        });

        this.scene.time.delayedCall(250, () => {
          soundManager?.playSfx('airlock-close');
          this.scene.tweens.add({
            targets: this,
            openProgress: 0,
            duration: 260,
            ease: 'Sine.InOut',
            onUpdate: () => this.syncDecor(),
            onComplete: () => {
              this.sequenceRunning = false;
              onComplete?.();
            },
          });
        });
      },
    });
  }

  update() {
    if (!this.moving) {
      this.syncDecor();
      return;
    }

    if (this.moving.axis === 'x') {
      this.body.setVelocityX(this.moving.speed * this.direction);
      if (this.x >= this.moving.max) {
        this.direction = -1;
      }
      if (this.x <= this.moving.min) {
        this.direction = 1;
      }
    }

    if (this.moving.axis === 'y') {
      this.body.setVelocityY(this.moving.speed * this.direction);
      if (this.y >= this.moving.max) {
        this.direction = -1;
      }
      if (this.y <= this.moving.min) {
        this.direction = 1;
      }
    }

    this.syncDecor();
  }

  reset() {
    this.setPosition(this.startX, this.startY);
    this.direction = 1;
    this.sequenceRunning = false;
    this.openProgress = 0;
    this.body.setVelocity(0, 0);
    this.syncDecor();
    this.syncExitWall();
  }

  destroy(fromScene) {
    this.outerFrame?.destroy();
    this.airlockShell?.destroy();
    this.shutterLeft?.destroy();
    this.shutterRight?.destroy();
    this.centerBeam?.destroy();
    this.beacon?.destroy();
    this.glow?.destroy();
    this.exitWall?.destroy();
    this.exitWallVisual?.destroy();
    super.destroy(fromScene);
  }
}
