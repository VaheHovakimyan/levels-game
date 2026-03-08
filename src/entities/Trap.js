import Phaser from 'phaser';

const INTERACT_COOLDOWN_MS = 170;
const SPIKE_DISABLE_MS = 900;
const HAZARD_SLOW_MS = 650;

function tentaclePalette() {
  return {
    dark: 0x422f6b,
    mid: 0x6c4fb2,
    bright: 0xc19bff,
    glow: 0x8d62ff,
  };
}

function eggPalette() {
  return {
    shell: 0x3a5a42,
    shellDark: 0x253829,
    core: 0x9dffc2,
    glow: 0x74e4a5,
  };
}

function dronePalette() {
  return {
    hull: 0x6a7dc3,
    hullDark: 0x344478,
    eye: 0xc1fff6,
    glow: 0x5ee7ff,
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
      this.setVisualAlpha(0.14);
      this.body.enable = false;
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
      const p = dronePalette();
      this.glow = this.scene.add.ellipse(this.x, this.y, this.width * 1.8, this.height * 1.2, p.glow, 0.2).setDepth(167);
      this.shell = this.scene.add.ellipse(this.x, this.y, this.width * 1.3, this.height * 0.95, p.hull, 0.98).setDepth(169);
      this.ring = this.scene.add.ellipse(this.x, this.y, this.width * 1.02, this.height * 0.65, p.hullDark, 0.9).setDepth(170);
      this.eye = this.scene.add.ellipse(this.x, this.y, this.width * 0.28, this.height * 0.24, p.eye, 0.95).setDepth(171);
      this.finL = this.scene.add.rectangle(this.x - this.width * 0.46, this.y, this.width * 0.24, 2.8, p.hullDark, 0.88).setDepth(168);
      this.finR = this.scene.add.rectangle(this.x + this.width * 0.46, this.y, this.width * 0.24, 2.8, p.hullDark, 0.88).setDepth(168);
      this.parts = [this.glow, this.shell, this.ring, this.eye, this.finL, this.finR];
      return;
    }

    if (this.type === 'proximitySpike') {
      const p = eggPalette();
      this.glow = this.scene.add.ellipse(this.x, this.y + 4, this.width * 1.4, this.height * 1.1, p.glow, 0.18).setDepth(166);
      this.shell = this.scene.add.ellipse(this.x, this.y, this.width * 0.92, this.height * 1.12, p.shell, 0.95).setDepth(169);
      this.shellShade = this.scene.add.ellipse(this.x - 2, this.y + 2, this.width * 0.5, this.height * 0.7, p.shellDark, 0.74).setDepth(170);
      this.slit = this.scene.add.rectangle(this.x, this.y + 1, 1.8, this.height * 0.55, p.core, 0.7).setDepth(171);
      this.core = this.scene.add.circle(this.x, this.y + 2, 2.8, p.core, 0.65).setDepth(172);
      this.parts = [this.glow, this.shell, this.shellShade, this.slit, this.core];
      return;
    }

    const p = tentaclePalette();
    this.glow = this.scene.add.ellipse(this.x, this.y + 3, this.width * 1.55, this.height * 0.9, p.glow, 0.2).setDepth(166);
    this.stem = this.scene.add.rectangle(this.x, this.y + 3, this.width * 0.36, this.height * 0.9, p.mid, 0.92).setDepth(169);
    this.tentacleL = this.scene.add.ellipse(this.x - this.width * 0.2, this.y - 2, this.width * 0.34, this.height * 1.05, p.dark, 0.95).setDepth(170);
    this.tentacleR = this.scene.add.ellipse(this.x + this.width * 0.2, this.y - 1, this.width * 0.34, this.height * 1.05, p.dark, 0.95).setDepth(170);
    this.tip = this.scene.add.circle(this.x, this.y - this.height * 0.55, this.width * 0.2, p.bright, 0.88).setDepth(171);
    this.parts = [this.glow, this.stem, this.tentacleL, this.tentacleR, this.tip];
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
      part.setAlpha(Phaser.Math.Clamp(value * mul, 0, 1));
    });
  }

  syncVisual() {
    const baseY = this.y + this.wobbleOffset;

    if (this.type === 'movingHazard') {
      this.glow.setPosition(this.x, baseY + 1);
      this.shell.setPosition(this.x, baseY);
      this.ring.setPosition(this.x, baseY);
      this.eye.setPosition(this.x, baseY);
      this.finL.setPosition(this.x - this.width * 0.46, baseY + Math.sin(this.scene.time.now * 0.02) * 0.8);
      this.finR.setPosition(this.x + this.width * 0.46, baseY - Math.sin(this.scene.time.now * 0.02) * 0.8);
      return;
    }

    if (this.type === 'proximitySpike') {
      this.glow.setPosition(this.x, baseY + 4);
      this.shell.setPosition(this.x, baseY);
      this.shellShade.setPosition(this.x - 2, baseY + 2);
      this.slit.setPosition(this.x, baseY + 1);
      this.core.setPosition(this.x, baseY + 2);
      return;
    }

    this.glow.setPosition(this.x, baseY + 3);
    this.stem.setPosition(this.x, baseY + 3);
    this.tentacleL.setPosition(this.x - this.width * 0.2, baseY - 2);
    this.tentacleR.setPosition(this.x + this.width * 0.2, baseY - 1);
    this.tip.setPosition(this.x, baseY - this.height * 0.55);
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
      this.eye.setFillStyle(0xfff8d0, 1);
      this.scene.time.delayedCall(HAZARD_SLOW_MS, () => {
        if (!this.active) {
          return;
        }
        this.eye.setFillStyle(dronePalette().eye, 0.95);
      });
      return;
    }

    if (this.type === 'proximitySpike' && !this.activated) {
      this.activate();
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
        targets: [this.shell, this.ring, this.eye],
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
    if (this.type === 'proximitySpike' && !this.activated) {
      this.activated = true;
      this.body.enable = true;
      this.setVisualAlpha(1);
      this.scene.tweens.add({
        targets: [this.shell, this.slit, this.core],
        scaleX: 1.16,
        scaleY: 1.12,
        duration: 120,
        yoyo: true,
      });
    }

    if (this.type === 'movingHazard' && !this.movementActivated) {
      this.movementActivated = true;
      this.setVisualAlpha(1);
    }
  }

  update(player) {
    const distance = Phaser.Math.Distance.Between(player.x, player.y, this.x, this.y);

    if (this.type === 'proximitySpike' && !this.activated && distance <= this.triggerDistance) {
      this.activate();
    }

    if (this.type === 'movingHazard') {
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
      return this.activated;
    }

    return true;
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
      this.eye.setFillStyle(dronePalette().eye, 0.95);
      this.movementActivated = !this.triggerDistance;
      this.setVisualAlpha(this.movementActivated ? 1 : 0.58);
    }

    if (this.type === 'proximitySpike') {
      this.activated = false;
      this.body.enable = false;
      this.setVisualAlpha(0.14);
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
