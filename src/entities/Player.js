import Phaser from 'phaser';
import { PLAYER_DEFAULTS } from '../utils/constants';
import { getPlayerAnimKey, sanitizeSkinKey } from './playerArt';

const BODY_W = 13;
const BODY_H = 26;
const PLAYER_BASE_SCALE = 1.18;
const JUMP_ANIM_HOLD_MS = 120;
const RUN_ANIM_BLEND = 0.22;
const VISUAL_GROUND_GRACE_MS = 70;
const LAND_SQUASH_MIN_AIR_MS = 90;
const LAND_SQUASH_MIN_FALL_SPEED = 170;
const LAND_SQUASH_COOLDOWN_MS = 160;
const JETPACK_BURST_COOLDOWN_MS = 42;

function getTouchPlayerScaleMultiplier(scene) {
  const device = scene.sys.game.device;
  const isTouchDevice = Boolean(device.input.touch) && !Boolean(device.os.desktop);
  if (!isTouchDevice) {
    return 1;
  }

  const displayWidth = scene.scale.displaySize?.width ?? scene.scale.width;
  const displayHeight = scene.scale.displaySize?.height ?? scene.scale.height;
  const gameWidth = scene.scale.gameSize?.width ?? scene.scale.width;
  const gameHeight = scene.scale.gameSize?.height ?? scene.scale.height;
  const scaleX = displayWidth / gameWidth || 1;
  const scaleY = displayHeight / gameHeight || 1;
  const displayScale = Math.min(scaleX, scaleY) || 1;

  if (displayScale <= 0.34) {
    return 1.46;
  }

  if (displayScale <= 0.52) {
    return 1.34;
  }

  if (displayScale <= 0.68) {
    return 1.24;
  }

  return 1.16;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, skinKey = 'apollo') {
    const safeSkin = sanitizeSkinKey(skinKey);
    super(scene, x, y, `player-${safeSkin}-idle-0`);

    this.scene = scene;
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);

    this.baseScale = PLAYER_BASE_SCALE * getTouchPlayerScaleMultiplier(this.scene);

    this.setOrigin(0.5, 0.5);
    this.setScale(this.baseScale);
    this.setAlpha(1);
    this.setDepth(300);

    this.body.setSize(BODY_W, BODY_H);
    this.body.setOffset((this.width - BODY_W) / 2, this.height - BODY_H - 1);

    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(PLAYER_DEFAULTS.moveSpeed, 1100);
    this.body.setDragX(1800);

    this.keys = null;
    this.virtualControls = null;
    this.skinKey = safeSkin;

    this.controlsReversed = false;
    this.jumpMultiplier = 1;

    this.jumpBufferUntil = 0;
    this.lastGroundedAt = 0;
    this.isFrozen = false;
    this.wasGrounded = false;
    this.wasOnGround = false;
    this.currentAnimKey = '';
    this.jumpVisualUntil = 0;
    this.runAnimTimeScale = 1;
    this.airborneSince = 0;
    this.maxAirborneDownSpeed = 0;
    this.lastLandSquashAt = -LAND_SQUASH_COOLDOWN_MS;
    this.lastJetpackAt = -JETPACK_BURST_COOLDOWN_MS;

    this.setStaticIdlePose();
  }

  restoreVisibility() {
    this.setVisible(true);
    this.setAlpha(1);
    this.clearTint();
  }

  setSkin(skinKey) {
    this.skinKey = sanitizeSkinKey(skinKey);
    this.setStaticIdlePose();
  }

  setAnimation(animKey) {
    if (this.currentAnimKey === animKey && this.anims.isPlaying) {
      return;
    }

    this.currentAnimKey = animKey;
    this.anims.play(animKey, true);
  }

  setStaticIdlePose() {
    const idleTextureKey = `player-${this.skinKey}-idle-0`;
    if (this.currentAnimKey === 'idle-static' && this.texture?.key === idleTextureKey && !this.anims.isPlaying) {
      return;
    }

    this.anims.stop();
    this.anims.timeScale = 1;
    this.setTexture(idleTextureKey);
    this.currentAnimKey = 'idle-static';
  }

  setInput(keys, virtualControls) {
    this.keys = keys;
    this.virtualControls = virtualControls;
  }

  setModifiers(modifiers = {}) {
    this.controlsReversed = Boolean(modifiers.reverseControls);
    this.jumpMultiplier = modifiers.highJump ? 1.28 : 1;
  }

  freeze() {
    this.isFrozen = true;
    this.body.setVelocity(0, 0);
    this.scene.tweens.killTweensOf(this);
    this.anims.pause();
  }

  unfreeze() {
    this.isFrozen = false;
    this.anims.resume();
  }

  playJumpSquash() {
    this.scene.tweens.killTweensOf(this);
    this.setScale(this.baseScale * 1.05, this.baseScale * 0.9);
    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale,
      scaleY: this.baseScale,
      duration: 120,
      ease: 'Quad.Out',
    });
  }

  playLandSquash() {
    this.scene.tweens.killTweensOf(this);
    this.setScale(this.baseScale * 0.88, this.baseScale * 1.1);
    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale,
      scaleY: this.baseScale,
      duration: 140,
      ease: 'Quad.Out',
    });
  }

  playDeathFeedback() {
    this.scene.tweens.killTweensOf(this);
    this.setTint(0xff7386);
    this.scene.tweens.add({
      targets: this,
      angle: 14,
      alpha: 0.25,
      duration: 130,
      yoyo: false,
    });
  }

  playRespawnFeedback() {
    this.restoreVisibility();
    this.setAlpha(0.3);
    this.setScale(this.baseScale * 0.82, this.baseScale * 1.14);
    this.angle = 0;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scaleX: this.baseScale,
      scaleY: this.baseScale,
      duration: 170,
      ease: 'Back.Out',
      onComplete: () => {
        if (this.active) {
          this.restoreVisibility();
        }
      },
    });
  }

  emitJetpackBurst(strength = 1) {
    const now = this.scene.time.now;
    if (now - this.lastJetpackAt < JETPACK_BURST_COOLDOWN_MS) {
      return;
    }
    this.lastJetpackAt = now;

    const count = strength > 0.8 ? 4 : 2;
    for (let i = 0; i < count; i += 1) {
      const spark = this.scene.add
        .circle(
          this.x + Phaser.Math.Between(-2, 2),
          this.y + this.displayHeight * 0.44,
          Phaser.Math.FloatBetween(1.2, 2.4),
          i % 2 === 0 ? 0x84f8ff : 0xffdcb6,
          0.95,
        )
        .setDepth(this.depth - 1);

      this.scene.tweens.add({
        targets: spark,
        x: spark.x + Phaser.Math.Between(-8, 8),
        y: spark.y + Phaser.Math.Between(10, 20),
        alpha: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: Phaser.Math.Between(130, 210),
        ease: 'Quad.Out',
        onComplete: () => spark.destroy(),
      });
    }
  }

  updateAnimation(onGround, isTryingToRun, time, forceJump = false) {
    const horizontalSpeed = Math.abs(this.body.velocity.x);

    if (!onGround || forceJump) {
      this.anims.timeScale = 1;
      const keepJumpPose = forceJump || time <= this.jumpVisualUntil || this.body.velocity.y < -35;
      if (keepJumpPose) {
        this.setAnimation(getPlayerAnimKey(this.skinKey, 'jump'));
      } else {
        this.setAnimation(getPlayerAnimKey(this.skinKey, 'fall'));
      }
      return;
    }

    // Run only when the player is actually providing movement input.
    if (isTryingToRun && horizontalSpeed > 40) {
      this.setAnimation(getPlayerAnimKey(this.skinKey, 'run'));
      const runRatio = horizontalSpeed / PLAYER_DEFAULTS.moveSpeed;
      const targetTimeScale = Phaser.Math.Clamp(0.84 + runRatio * 0.58, 0.84, 1.3);
      this.runAnimTimeScale = Phaser.Math.Linear(this.runAnimTimeScale, targetTimeScale, RUN_ANIM_BLEND);
      this.anims.timeScale = this.runAnimTimeScale;
      return;
    }

    this.runAnimTimeScale = Phaser.Math.Linear(this.runAnimTimeScale, 1, 0.28);
    this.setStaticIdlePose();
  }

  respawn(spawnPoint) {
    this.setPosition(spawnPoint.x, spawnPoint.y);
    this.body.setVelocity(0, 0);
    this.body.stop();
    this.body.enable = true;
    this.angle = 0;
    this.jumpBufferUntil = 0;
    this.lastGroundedAt = this.scene.time.now;
    this.wasGrounded = false;
    this.wasOnGround = false;
    this.jumpVisualUntil = 0;
    this.runAnimTimeScale = 1;
    this.airborneSince = 0;
    this.maxAirborneDownSpeed = 0;
    this.lastLandSquashAt = -LAND_SQUASH_COOLDOWN_MS;
    this.lastJetpackAt = -JETPACK_BURST_COOLDOWN_MS;
    this.restoreVisibility();
    this.unfreeze();
    this.playRespawnFeedback();
    this.scene.time.delayedCall(220, () => {
      if (this.active) {
        this.restoreVisibility();
      }
    });
    this.setStaticIdlePose();
  }

  update(time) {
    if (this.isFrozen || !this.keys) {
      return;
    }

    const leftDown = this.keys.left.isDown || this.keys.a.isDown || this.virtualControls?.isLeftDown();
    const rightDown = this.keys.right.isDown || this.keys.d.isDown || this.virtualControls?.isRightDown();
    const jumpDown =
      this.keys.up.isDown || this.keys.w.isDown || this.keys.space.isDown || this.virtualControls?.isJumpDown();

    const jumpJustPressed =
      Phaser.Input.Keyboard.JustDown(this.keys.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.w) ||
      Phaser.Input.Keyboard.JustDown(this.keys.space) ||
      this.virtualControls?.consumeJumpJustPressed();

    const jumpJustReleased =
      Phaser.Input.Keyboard.JustUp(this.keys.up) ||
      Phaser.Input.Keyboard.JustUp(this.keys.w) ||
      Phaser.Input.Keyboard.JustUp(this.keys.space) ||
      this.virtualControls?.consumeJumpJustReleased();

    let moveLeft = leftDown;
    let moveRight = rightDown;

    if (this.controlsReversed) {
      moveLeft = rightDown;
      moveRight = leftDown;
    }

    const isTryingToRun = moveLeft !== moveRight;

    if (moveLeft && !moveRight) {
      this.body.setVelocityX(-PLAYER_DEFAULTS.moveSpeed);
    } else if (moveRight && !moveLeft) {
      this.body.setVelocityX(PLAYER_DEFAULTS.moveSpeed);
    } else {
      this.body.setVelocityX(0);
    }

    if (this.body.velocity.x !== 0) {
      this.setFlipX(this.body.velocity.x < 0);
    }

    const onGround = this.body.blocked.down || this.body.touching.down;
    if (onGround) {
      this.lastGroundedAt = time;
    } else {
      if (this.wasOnGround) {
        this.airborneSince = time;
        this.maxAirborneDownSpeed = Math.max(0, this.body.velocity.y);
      } else {
        this.maxAirborneDownSpeed = Math.max(this.maxAirborneDownSpeed, this.body.velocity.y);
      }
    }

    if (jumpJustPressed) {
      this.jumpBufferUntil = time + PLAYER_DEFAULTS.jumpBufferMs;
    }

    const canUseCoyote = time - this.lastGroundedAt <= PLAYER_DEFAULTS.coyoteTimeMs;
    const hasJumpBuffered = time <= this.jumpBufferUntil;
    let didJump = false;

    if (hasJumpBuffered && (onGround || canUseCoyote)) {
      const jumpSpeed = PLAYER_DEFAULTS.jumpSpeed * this.jumpMultiplier;
      this.body.setVelocityY(-jumpSpeed);
      this.jumpBufferUntil = 0;
      this.jumpVisualUntil = time + JUMP_ANIM_HOLD_MS;
      didJump = true;
      this.playJumpSquash();
      this.emitJetpackBurst(1);
    }

    if (jumpJustReleased && !jumpDown && this.body.velocity.y < -80) {
      this.body.setVelocityY(this.body.velocity.y * 0.45);
    }

    if (!onGround && this.body.velocity.y < 160) {
      const upwardStrength = Phaser.Math.Clamp((-this.body.velocity.y + 120) / 760, 0.2, 1);
      this.emitJetpackBurst(upwardStrength);
    }

    const isNearGroundWindow = time - this.lastGroundedAt <= VISUAL_GROUND_GRACE_MS;
    const isNearlyFlatVerticalSpeed = this.body.velocity.y >= -40 && this.body.velocity.y < 120;
    const isGroundedForVisuals = (onGround || (isNearGroundWindow && isNearlyFlatVerticalSpeed)) && !didJump;

    if (onGround && !this.wasOnGround && this.body.velocity.y >= -20) {
      const airborneDuration = time - this.airborneSince;
      const hadEnoughImpact =
        airborneDuration >= LAND_SQUASH_MIN_AIR_MS || this.maxAirborneDownSpeed >= LAND_SQUASH_MIN_FALL_SPEED;
      const canSquashAgain = time - this.lastLandSquashAt >= LAND_SQUASH_COOLDOWN_MS;

      if (hadEnoughImpact && canSquashAgain) {
        this.playLandSquash();
        this.lastLandSquashAt = time;
      }
    }

    this.updateAnimation(isGroundedForVisuals, isTryingToRun, time, didJump);
    this.wasGrounded = isGroundedForVisuals;
    this.wasOnGround = onGround;
  }
}
