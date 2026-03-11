import Phaser from 'phaser';

const INTERACT_COOLDOWN_MS = 170;
const SPIKE_DISABLE_MS = 900;
const HAZARD_SLOW_MS = 650;

function tentaclePalette() {
  return {
    dark: 0x20143d,
    mid: 0x4f2d89,
    bright: 0xd9b0ff,
    glow: 0x9b5eff,
    bio: 0x86ffd4,
  };
}

export class Trap extends Phaser.GameObjects.Rectangle {
  constructor(scene, config) {
    super(scene, config.x, config.y, config.width || 28, config.height || 18, 0xffffff, 0.001);

    this.scene = scene;
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);

    this.type = config.type;
    this.triggerDistance = config.triggerDistance || 120;
    this.patrol = config.patrol || null;

    this.startX = config.x;
    this.startY = config.y;

    this.activated = this.type !== 'proximitySpike';
    this.movementActivated = !config.triggerDistance || this.type !== 'movingHazard';
    this.movementDirection = 1;
    this.disableUntil = 0;
    this.nextInteractAt = 0;
    this.slowUntil = 0;
    this.speedMultiplier = 1;

    this.visualAlpha = 1;
    this.wobbleOffset = 0;

    this.body.setAllowGravity(false);
    this.body.setImmovable(true);

    this.createAlienVisuals();

    if (this.type === 'proximitySpike') {
      this.activated = true;
      this.body.enable = true;
      this.setVisualAlpha(0);
    }

    if (this.type === 'movingHazard' && !this.movementActivated) {
      this.body.setVelocity(0, 0);
      this.setVisualAlpha(0.58);
    }

    this.setupInteraction();
    this.startIdleMotion();
    this.syncVisual();
  }

  createAlienVisuals() {
    if (this.type === 'movingHazard') {
      this.glow = this.scene.add.ellipse(this.x, this.y + this.height * 0.22, this.width * 1.15, this.height * 0.45, 0x6ec5ff, 0.22).setDepth(166);
      this.droneSprite = this.scene.add
        .image(this.x, this.y, 'alien-drone')
        .setDisplaySize(this.width, this.height)
        .setDepth(170);
      this.parts = [this.glow, this.droneSprite];
      return;
    }

    if (this.type === 'proximitySpike') {
      this.hiddenTrapSprite = this.scene.add
        .image(this.x, this.y + 1, 'alien-hidden-trap')
        .setDisplaySize(this.width, this.height)
        .setDepth(173)
        .setAlpha(0);
      this.parts = [this.hiddenTrapSprite];
      return;
    }

    const p = tentaclePalette();
    this.glow = this.scene.add.ellipse(this.x, this.y + 3, this.width * 1.65, this.height * 0.94, p.glow, 0.2).setDepth(166);
    this.basePod = this.scene.add.ellipse(this.x, this.y + 4, this.width * 0.82, this.height * 0.66, p.dark, 0.94).setDepth(168);
    this.stem = this.scene.add.rectangle(this.x, this.y + 2, this.width * 0.34, this.height * 0.96, p.mid, 0.92).setDepth(169);
    this.tentacleL = this.scene.add.ellipse(this.x - this.width * 0.22, this.y - 2, this.width * 0.36, this.height * 1.06, p.dark, 0.95).setDepth(170);
    this.tentacleR = this.scene.add.ellipse(this.x + this.width * 0.22, this.y - 1, this.width * 0.36, this.height * 1.06, p.dark, 0.95).setDepth(170);
    this.jawL = this.scene.add.triangle(this.x - this.width * 0.2, this.y - this.height * 0.42, 0, 0, 8, -4, 8, 4, p.mid, 0.95).setDepth(171);
    this.jawR = this.scene.add.triangle(this.x + this.width * 0.2, this.y - this.height * 0.42, 0, 0, -8, -4, -8, 4, p.mid, 0.95).setDepth(171);
    this.tip = this.scene.add.circle(this.x, this.y - this.height * 0.55, this.width * 0.2, p.bright, 0.9).setDepth(172);
    this.fangL = this.scene.add.rectangle(this.x - 2.6, this.y - this.height * 0.29, 1.4, 3.4, p.bio, 0.9).setDepth(172);
    this.fangR = this.scene.add.rectangle(this.x + 2.6, this.y - this.height * 0.29, 1.4, 3.4, p.bio, 0.9).setDepth(172);
    this.parts = [
      this.glow,
      this.basePod,
      this.stem,
      this.tentacleL,
      this.tentacleR,
      this.jawL,
      this.jawR,
      this.tip,
      this.fangL,
      this.fangR,
    ];
  }

  setVisualAlpha(value) {
    this.visualAlpha = value;
    if (!this.parts) {
      return;
    }

    this.parts.forEach((part) => {
      if (!part) {
        return;
      }
      const mul = part === this.glow ? 0.45 : 1;
      if (part === this.hiddenTrapSprite) {
        if (this.type === 'proximitySpike') {
          part.setAlpha(Phaser.Math.Clamp(value, 0, 1));
        } else {
          part.setAlpha(Phaser.Math.Clamp(value, 0, 1));
        }
        return;
      }
      part.setAlpha(Phaser.Math.Clamp(value * mul, 0, 1));
    });
  }

  syncVisual() {
    const baseY = this.y + this.wobbleOffset;
    const flutter = Math.sin(this.scene.time.now * 0.014 + this.startX * 0.01);
    const flap = Math.sin(this.scene.time.now * 0.02 + this.startY * 0.03);

    if (this.type === 'movingHazard') {
      this.glow?.setPosition(this.x, baseY + this.height * 0.22 + flutter * 0.5);
      this.droneSprite?.setPosition(this.x, baseY + flutter * 0.35);
      this.droneSprite?.setAngle(flap * 6);
      return;
    }

    if (this.type === 'proximitySpike') {
      this.hiddenTrapSprite?.setPosition(this.x, baseY + 1);
      return;
    }

    this.glow.setPosition(this.x, baseY + 3);
    this.basePod.setPosition(this.x, baseY + 4);
    this.stem.setPosition(this.x, baseY + 3);
    this.tentacleL.setPosition(this.x - this.width * 0.2, baseY - 2);
    this.tentacleR.setPosition(this.x + this.width * 0.2, baseY - 1);
    this.jawL.setPosition(this.x - this.width * 0.2, baseY - this.height * 0.42);
    this.jawL.setAngle(-8 + flap * 7);
    this.jawR.setPosition(this.x + this.width * 0.2, baseY - this.height * 0.42);
    this.jawR.setAngle(8 - flap * 7);
    this.tip.setPosition(this.x, baseY - this.height * 0.55);
    this.fangL.setPosition(this.x - 2.6, baseY - this.height * 0.29 + flutter * 0.2);
    this.fangR.setPosition(this.x + 2.6, baseY - this.height * 0.29 - flutter * 0.2);
  }

  setupInteraction() {
    this.setInteractive({ useHandCursor: true });

    this.on('pointerdown', () => this.handleInteraction());
    this.on('pointerover', () => {
      this.parts?.forEach((part) => {
        if (part && part !== this.glow) {
          part.setScale(1.06);
        }
      });
      this.glow?.setAlpha(Math.max(0.28, this.glow.alpha));
    });
    this.on('pointerout', () => {
      this.parts?.forEach((part) => {
        if (part) {
          part.setScale(1);
        }
      });
      this.glow?.setAlpha(Math.max(0.08, this.glow.alpha * 0.86));
    });
  }

  handleInteraction() {
    if (this.type === 'proximitySpike') {
      return;
    }

    const now = this.scene.time.now;
    if (now < this.nextInteractAt) {
      return;
    }

    this.nextInteractAt = now + INTERACT_COOLDOWN_MS;
    this.scene.tweens.killTweensOf(this.parts);
    this.scene.tweens.add({
      targets: this.parts,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 90,
      yoyo: true,
      ease: 'Quad.Out',
    });

    if (this.type === 'movingHazard') {
      this.activate();
      this.movementDirection *= -1;
      this.slowUntil = now + HAZARD_SLOW_MS;
      this.speedMultiplier = 0.42;
      return;
    }

    this.disableUntil = now + SPIKE_DISABLE_MS;
    this.setVisualAlpha(0.3);
    this.scene.time.delayedCall(SPIKE_DISABLE_MS, () => {
      if (!this.active) {
        return;
      }

      if (this.type === 'proximitySpike') {
        this.setVisualAlpha(this.activated ? 1 : 0.14);
      } else {
        this.setVisualAlpha(1);
      }
    });
  }

  startIdleMotion() {
    if (this.type === 'movingHazard') {
      this.scene.tweens.add({
        targets: [this.droneSprite],
        y: '-=2',
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      return;
    }

    this.scene.tweens.add({
      targets: this.parts,
      y: '-=1.5',
      duration: this.type === 'proximitySpike' ? 780 : 560,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  activate() {
    if (this.type === 'movingHazard' && !this.movementActivated) {
      this.movementActivated = true;
      this.setVisualAlpha(1);
    }
  }

  update(player) {
    if (this.type === 'movingHazard') {
      const distance = Phaser.Math.Distance.Between(player.x, player.y, this.x, this.y);
      if (!this.movementActivated && distance <= this.triggerDistance) {
        this.activate();
      }

      if (!this.movementActivated || !this.patrol) {
        this.syncVisual();
        return;
      }

      if (this.scene.time.now > this.slowUntil) {
        this.speedMultiplier = 1;
      }

      const speed = (this.patrol.speed || 140) * this.speedMultiplier;

      if (this.patrol.axis === 'x') {
        this.body.setVelocityX(speed * this.movementDirection);
        if (this.x >= this.patrol.max) {
          this.movementDirection = -1;
        }
        if (this.x <= this.patrol.min) {
          this.movementDirection = 1;
        }
      }

      if (this.patrol.axis === 'y') {
        this.body.setVelocityY(speed * this.movementDirection);
        if (this.y >= this.patrol.max) {
          this.movementDirection = -1;
        }
        if (this.y <= this.patrol.min) {
          this.movementDirection = 1;
        }
      }
    }

    if (this.type !== 'movingHazard') {
      this.wobbleOffset = Math.sin(this.scene.time.now * 0.012 + this.startX * 0.02) * 0.9;
    }

    this.syncVisual();
  }

  isLethal() {
    if (this.scene.time.now < this.disableUntil) {
      return false;
    }

    if (this.type === 'proximitySpike') {
      return true;
    }

    return true;
  }

  onPlayerHit() {
    if (this.type !== 'proximitySpike') {
      return;
    }

    this.setVisualAlpha(1);
    this.scene.tweens.killTweensOf(this.hiddenTrapSprite);
    this.scene.tweens.add({
      targets: [this.hiddenTrapSprite],
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 80,
      yoyo: true,
      ease: 'Quad.Out',
    });
  }

  reset() {
    this.setPosition(this.startX, this.startY);
    this.body.setVelocity(0, 0);
    this.movementDirection = 1;
    this.disableUntil = 0;
    this.nextInteractAt = 0;
    this.slowUntil = 0;
    this.speedMultiplier = 1;
    this.wobbleOffset = 0;

    if (this.type === 'movingHazard') {
      this.movementActivated = !this.triggerDistance;
      this.setVisualAlpha(this.movementActivated ? 1 : 0.58);
    }

    if (this.type === 'proximitySpike') {
      this.activated = true;
      this.body.enable = true;
      this.setVisualAlpha(0);
    }

    if (this.type === 'staticSpike') {
      this.setVisualAlpha(1);
    }

    this.parts?.forEach((part) => {
      if (part) {
        part.setScale(1);
      }
    });

    this.syncVisual();
  }

  destroy(fromScene) {
    this.parts?.forEach((part) => part?.destroy());
    this.parts = [];
    super.destroy(fromScene);
  }
}
