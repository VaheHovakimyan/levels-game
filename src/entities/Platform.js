import Phaser from 'phaser';

function getPlatformStyle(type) {
  if (type === 'collapsing') {
    return {
      core: 0x5c5f74,
      side: 0x42475c,
      accent: 0x8b90ad,
      glow: 0xaec6ff,
      organic: false,
    };
  }

  if (type === 'fakeFloor') {
    return {
      core: 0x3d4a3f,
      side: 0x26322a,
      accent: 0x88ca86,
      glow: 0x7effc5,
      organic: true,
    };
  }

  return {
    core: 0x446086,
    side: 0x2f4464,
    accent: 0x7ecbff,
    glow: 0xb6f0ff,
    organic: false,
  };
}

export class Platform extends Phaser.GameObjects.Rectangle {
  constructor(scene, config) {
    const style = getPlatformStyle(config.type);
    super(scene, config.x, config.y, config.width, config.height, style.core, 1);

    this.scene = scene;
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);

    this.platformType = config.type || 'solid';
    this.style = style;
    this.collapseDelay = config.collapseDelay ?? (this.platformType === 'fakeFloor' ? 90 : 260);

    this.startX = config.x;
    this.startY = config.y;

    this.hasTriggered = false;
    this.hasCollapsed = false;
    this.collapseTimer = null;

    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.setVelocity(0, 0);

    this.setFillStyle(style.core, 0.95);
    this.setStrokeStyle(1.5, style.accent, 0.45);
    this.setDepth(100);

    this.leftCap = this.scene.add.ellipse(this.x - this.width / 2 + this.height / 2, this.y, this.height, this.height, style.side, 0.98).setDepth(101);
    this.rightCap = this.scene.add.ellipse(this.x + this.width / 2 - this.height / 2, this.y, this.height, this.height, style.side, 0.98).setDepth(101);

    this.topSheen = this.scene.add
      .rectangle(this.x, this.y - this.height * 0.32, Math.max(12, this.width - this.height * 0.7), Math.max(3, this.height * 0.2), style.glow, 0.2)
      .setDepth(102);

    this.bottomShade = this.scene.add
      .rectangle(this.x, this.y + this.height * 0.3, Math.max(12, this.width - this.height * 0.7), Math.max(3, this.height * 0.16), 0x000000, 0.2)
      .setDepth(99);

    this.scanline = this.scene.add
      .rectangle(this.x, this.y - this.height * 0.05, Math.max(8, this.width - this.height * 0.9), 2, style.accent, style.organic ? 0.14 : 0.28)
      .setDepth(103);

    this.pulseGlow = this.scene.add
      .ellipse(this.x, this.y - this.height * 0.2, this.width * 0.65, this.height * 0.8, style.glow, style.organic ? 0.16 : 0.1)
      .setDepth(98);

    this.scene.tweens.add({
      targets: [this.scanline, this.pulseGlow],
      alpha: { from: style.organic ? 0.09 : 0.07, to: style.organic ? 0.34 : 0.2 },
      duration: style.organic ? 640 : 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    if (style.organic) {
      this.scene.tweens.add({
        targets: [this.leftCap, this.rightCap],
        scaleY: 1.08,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }

  syncVisual() {
    const leftX = this.x - this.width / 2 + this.height / 2;
    const rightX = this.x + this.width / 2 - this.height / 2;

    this.leftCap.setPosition(leftX, this.y);
    this.rightCap.setPosition(rightX, this.y);
    this.topSheen.setPosition(this.x, this.y - this.height * 0.32);
    this.bottomShade.setPosition(this.x, this.y + this.height * 0.3);
    this.scanline.setPosition(this.x, this.y - this.height * 0.05);
    this.pulseGlow.setPosition(this.x, this.y - this.height * 0.2);
  }

  setVisualAlpha(value) {
    this.setAlpha(value);
    this.leftCap.setAlpha(value);
    this.rightCap.setAlpha(value);
    this.topSheen.setAlpha(value * 0.82);
    this.bottomShade.setAlpha(value * 0.74);
    this.scanline.setAlpha(value * 0.56);
    this.pulseGlow.setAlpha(value * 0.4);
  }

  onPlayerStep() {
    if (this.hasTriggered || this.platformType === 'solid') {
      return;
    }

    this.hasTriggered = true;

    this.scene.tweens.add({
      targets: [this, this.leftCap, this.rightCap, this.topSheen, this.bottomShade, this.scanline, this.pulseGlow],
      alpha: this.style.organic ? 0.5 : 0.62,
      duration: this.collapseDelay,
      yoyo: false,
    });

    this.collapseTimer = this.scene.time.delayedCall(this.collapseDelay, () => this.collapse());
  }

  collapse() {
    if (this.hasCollapsed || this.platformType === 'solid') {
      return;
    }

    this.hasCollapsed = true;
    this.body.setImmovable(false);
    this.body.setAllowGravity(true);
    this.body.setVelocityY(40);
    this.setVisualAlpha(this.style.organic ? 0.42 : 0.5);
  }

  update() {
    this.syncVisual();
  }

  reset() {
    if (this.collapseTimer) {
      this.collapseTimer.remove(false);
      this.collapseTimer = null;
    }

    this.setPosition(this.startX, this.startY);
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);

    this.hasTriggered = false;
    this.hasCollapsed = false;
    this.setVisualAlpha(1);
    this.syncVisual();
  }

  destroy(fromScene) {
    if (this.collapseTimer) {
      this.collapseTimer.remove(false);
      this.collapseTimer = null;
    }

    this.leftCap?.destroy();
    this.rightCap?.destroy();
    this.topSheen?.destroy();
    this.bottomShade?.destroy();
    this.scanline?.destroy();
    this.pulseGlow?.destroy();

    super.destroy(fromScene);
  }
}
