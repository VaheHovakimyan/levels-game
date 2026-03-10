import Phaser from 'phaser';

function shiftColor(color, delta) {
  const rgb = Phaser.Display.Color.IntegerToColor(color);
  return Phaser.Display.Color.GetColor(
    Phaser.Math.Clamp(rgb.red + delta, 0, 255),
    Phaser.Math.Clamp(rgb.green + delta, 0, 255),
    Phaser.Math.Clamp(rgb.blue + delta, 0, 255),
  );
}

function enrichPlatformStyle(baseStyle) {
  return {
    ...baseStyle,
    top: shiftColor(baseStyle.core, 24),
    panel: shiftColor(baseStyle.side, 18),
    bracket: shiftColor(baseStyle.side, -24),
    seam: shiftColor(baseStyle.accent, 12),
  };
}

function getPlatformStyle(type) {
  if (type === 'antiGravity') {
    return enrichPlatformStyle({
      core: 0x33516e,
      side: 0x20364d,
      accent: 0xa4e0ff,
      glow: 0x8ff0ff,
      organic: false,
    });
  }

  if (type === 'phase') {
    return enrichPlatformStyle({
      core: 0x4f3f73,
      side: 0x2f2550,
      accent: 0xd2bcff,
      glow: 0xb78fff,
      organic: false,
    });
  }

  if (type === 'collapsing') {
    return enrichPlatformStyle({
      core: 0x5c5f74,
      side: 0x42475c,
      accent: 0x8b90ad,
      glow: 0xaec6ff,
      organic: false,
    });
  }

  if (type === 'fakeFloor') {
    return enrichPlatformStyle({
      core: 0x3d4a3f,
      side: 0x26322a,
      accent: 0x88ca86,
      glow: 0x7effc5,
      organic: true,
    });
  }

  return enrichPlatformStyle({
    core: 0x446086,
    side: 0x2f4464,
    accent: 0x7ecbff,
    glow: 0xb6f0ff,
    organic: false,
  });
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
    this.moving = config.moving || null;
    this.moveDirection = this.moving?.startDirection === -1 ? -1 : 1;
    this.phase = this.platformType === 'phase' ? config.phase || { showMs: 1100, hideMs: 900 } : null;
    this.phaseOffsetMs = config.phaseOffsetMs ?? 0;
    this.phaseStartAt = this.scene.time.now + this.phaseOffsetMs;
    this.isPhaseVisible = true;

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

    const metrics = this.getVisualMetrics();

    this.underShadow = this.scene.add
      .ellipse(this.x, this.y + this.height * 0.4, Math.max(18, this.width * 0.86), Math.max(7, this.height * 0.46), 0x000000, 0.2)
      .setDepth(97);

    this.leftCap = this.scene.add.ellipse(this.x - this.width / 2 + this.height / 2, this.y, this.height, this.height, style.side, 0.98).setDepth(101);
    this.rightCap = this.scene.add.ellipse(this.x + this.width / 2 - this.height / 2, this.y, this.height, this.height, style.side, 0.98).setDepth(101);

    this.innerPanel = this.scene.add
      .rectangle(this.x, this.y + this.height * 0.03, metrics.coreWidth, Math.max(6, this.height * 0.52), style.panel, style.organic ? 0.34 : 0.46)
      .setDepth(101);

    this.topRim = this.scene.add
      .rectangle(this.x, this.y - this.height * 0.37, metrics.coreWidth, Math.max(2, this.height * 0.12), style.top, style.organic ? 0.3 : 0.58)
      .setDepth(103);

    this.leftBracket = this.scene.add
      .rectangle(
        this.x - metrics.coreWidth / 2 + metrics.bracketWidth / 2,
        this.y + this.height * 0.08,
        metrics.bracketWidth,
        metrics.bracketHeight,
        style.bracket,
        style.organic ? 0.38 : 0.64,
      )
      .setDepth(102)
      .setStrokeStyle(1, style.top, 0.28);

    this.rightBracket = this.scene.add
      .rectangle(
        this.x + metrics.coreWidth / 2 - metrics.bracketWidth / 2,
        this.y + this.height * 0.08,
        metrics.bracketWidth,
        metrics.bracketHeight,
        style.bracket,
        style.organic ? 0.38 : 0.64,
      )
      .setDepth(102)
      .setStrokeStyle(1, style.top, 0.28);

    const seamCount = Phaser.Math.Clamp(Math.floor(this.width / 120), 1, 6);
    this.seamRatios = [];
    this.seams = [];
    for (let i = 1; i <= seamCount; i += 1) {
      const ratio = i / (seamCount + 1);
      this.seamRatios.push(ratio);
      this.seams.push(
        this.scene.add
          .rectangle(
            this.x,
            this.y + this.height * 0.03,
            1.6,
            Math.max(7, this.height * 0.45),
            style.seam,
            style.organic ? 0.12 : 0.22,
          )
          .setDepth(102),
      );
    }

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
      .ellipse(
        this.x,
        this.y - this.height * 0.2,
        this.width * 0.65,
        this.height * 0.8,
        style.glow,
        style.organic ? 0.16 : this.platformType === 'antiGravity' ? 0.18 : 0.1,
      )
      .setDepth(98);

    this.scene.tweens.add({
      targets: [this.scanline, this.pulseGlow],
      alpha: {
        from: style.organic ? 0.09 : this.platformType === 'antiGravity' ? 0.15 : 0.07,
        to: style.organic ? 0.34 : this.platformType === 'antiGravity' ? 0.5 : 0.2,
      },
      duration: style.organic ? 640 : this.platformType === 'antiGravity' ? 760 : 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.scene.tweens.add({
      targets: [this.topRim],
      alpha: {
        from: style.organic ? 0.2 : 0.42,
        to: style.organic ? 0.36 : 0.72,
      },
      duration: style.organic ? 800 : 1200,
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

  getVisualMetrics() {
    const edgeInset = Math.min(this.height * 0.55, Math.max(8, this.width * 0.1));
    const coreWidth = Math.max(12, this.width - edgeInset * 2);
    const bracketWidth = Math.max(6, Math.min(14, this.height * 0.35));
    const bracketHeight = Math.max(8, this.height * 0.5);
    return { coreWidth, bracketWidth, bracketHeight };
  }

  getVisualTargets() {
    const seams = this.seams ?? [];
    return [
      this,
      this.leftCap,
      this.rightCap,
      this.innerPanel,
      this.topRim,
      this.leftBracket,
      this.rightBracket,
      this.topSheen,
      this.bottomShade,
      this.scanline,
      this.pulseGlow,
      this.underShadow,
      ...seams,
    ];
  }

  syncVisual() {
    const metrics = this.getVisualMetrics();
    const leftX = this.x - this.width / 2 + this.height / 2;
    const rightX = this.x + this.width / 2 - this.height / 2;
    const seamStartX = this.x - metrics.coreWidth / 2;

    this.underShadow.setPosition(this.x, this.y + this.height * 0.4);
    this.leftCap.setPosition(leftX, this.y);
    this.rightCap.setPosition(rightX, this.y);
    this.innerPanel.setPosition(this.x, this.y + this.height * 0.03);
    this.topRim.setPosition(this.x, this.y - this.height * 0.37);
    this.leftBracket.setPosition(this.x - metrics.coreWidth / 2 + metrics.bracketWidth / 2, this.y + this.height * 0.08);
    this.rightBracket.setPosition(this.x + metrics.coreWidth / 2 - metrics.bracketWidth / 2, this.y + this.height * 0.08);
    this.topSheen.setPosition(this.x, this.y - this.height * 0.32);
    this.bottomShade.setPosition(this.x, this.y + this.height * 0.3);
    this.scanline.setPosition(this.x, this.y - this.height * 0.05);
    this.pulseGlow.setPosition(this.x, this.y - this.height * 0.2);

    this.seams.forEach((seam, index) => {
      seam.setPosition(seamStartX + metrics.coreWidth * this.seamRatios[index], this.y + this.height * 0.03);
    });
  }

  setVisualAlpha(value) {
    this.setAlpha(value);
    this.underShadow.setAlpha(value * 0.42);
    this.leftCap.setAlpha(value);
    this.rightCap.setAlpha(value);
    this.innerPanel.setAlpha(value * (this.style.organic ? 0.32 : 0.46));
    this.topRim.setAlpha(value * (this.style.organic ? 0.3 : 0.58));
    this.leftBracket.setAlpha(value * 0.72);
    this.rightBracket.setAlpha(value * 0.72);
    this.topSheen.setAlpha(value * 0.82);
    this.bottomShade.setAlpha(value * 0.74);
    this.scanline.setAlpha(value * 0.56);
    this.pulseGlow.setAlpha(value * 0.4);
    this.seams.forEach((seam) => seam.setAlpha(value * (this.style.organic ? 0.12 : 0.22)));
  }

  isCollapsingType() {
    return this.platformType === 'collapsing' || this.platformType === 'fakeFloor';
  }

  onPlayerStep() {
    if (this.hasTriggered || !this.isCollapsingType() || !this.body.enable) {
      return;
    }

    this.hasTriggered = true;

    this.scene.tweens.add({
      targets: this.getVisualTargets(),
      alpha: this.style.organic ? 0.5 : 0.62,
      duration: this.collapseDelay,
      yoyo: false,
    });

    this.collapseTimer = this.scene.time.delayedCall(this.collapseDelay, () => this.collapse());
  }

  collapse() {
    if (this.hasCollapsed || !this.isCollapsingType()) {
      return;
    }

    this.hasCollapsed = true;
    this.body.setImmovable(false);
    this.body.setAllowGravity(true);
    this.body.setVelocityY(40);
    this.setVisualAlpha(this.style.organic ? 0.42 : 0.5);
  }

  updateMovement() {
    if (!this.moving) {
      return;
    }

    const speed = this.moving.speed ?? 80;

    if (this.moving.axis === 'x') {
      this.body.setVelocityX(speed * this.moveDirection);
      this.body.setVelocityY(0);

      if (this.x >= this.moving.max) {
        this.setX(this.moving.max);
        this.moveDirection = -1;
      } else if (this.x <= this.moving.min) {
        this.setX(this.moving.min);
        this.moveDirection = 1;
      }
      return;
    }

    if (this.moving.axis === 'y') {
      this.body.setVelocityY(speed * this.moveDirection);
      this.body.setVelocityX(0);

      if (this.y >= this.moving.max) {
        this.setY(this.moving.max);
        this.moveDirection = -1;
      } else if (this.y <= this.moving.min) {
        this.setY(this.moving.min);
        this.moveDirection = 1;
      }
    }
  }

  updatePhase() {
    if (!this.phase || this.hasCollapsed) {
      return;
    }

    const showMs = Math.max(120, this.phase.showMs ?? 1100);
    const hideMs = Math.max(120, this.phase.hideMs ?? 900);
    const cycleMs = showMs + hideMs;
    const elapsed = ((this.scene.time.now - this.phaseStartAt) % cycleMs + cycleMs) % cycleMs;
    const visibleNow = elapsed < showMs;

    if (visibleNow === this.isPhaseVisible) {
      return;
    }

    this.isPhaseVisible = visibleNow;
    this.body.enable = visibleNow;
    if (!visibleNow) {
      this.body.stop();
      this.body.setVelocity(0, 0);
    }

    this.scene.tweens.killTweensOf(this.getVisualTargets());
    this.scene.tweens.add({
      targets: this.getVisualTargets(),
      alpha: visibleNow ? 1 : 0.16,
      duration: 180,
      ease: 'Cubic.Out',
    });
  }

  update() {
    if (this.hasCollapsed) {
      this.syncVisual();
      return;
    }

    this.updateMovement();
    this.updatePhase();
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
    this.body.enable = true;

    this.hasTriggered = false;
    this.hasCollapsed = false;
    this.moveDirection = this.moving?.startDirection === -1 ? -1 : 1;
    this.phaseStartAt = this.scene.time.now + this.phaseOffsetMs;
    this.isPhaseVisible = true;
    this.setVisualAlpha(1);
    this.updatePhase();
    this.syncVisual();
  }

  destroy(fromScene) {
    if (this.collapseTimer) {
      this.collapseTimer.remove(false);
      this.collapseTimer = null;
    }

    this.scene?.tweens?.killTweensOf(this.getVisualTargets());

    this.underShadow?.destroy();
    this.leftCap?.destroy();
    this.rightCap?.destroy();
    this.innerPanel?.destroy();
    this.topRim?.destroy();
    this.leftBracket?.destroy();
    this.rightBracket?.destroy();
    this.topSheen?.destroy();
    this.bottomShade?.destroy();
    this.scanline?.destroy();
    this.pulseGlow?.destroy();
    this.seams?.forEach((seam) => seam.destroy());

    super.destroy(fromScene);
  }
}
