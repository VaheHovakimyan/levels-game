export class VirtualControls {
  constructor(scene) {
    this.scene = scene;
    const device = this.scene.sys.game.device;
    const hasTouch = Boolean(device.input.touch);
    const isDesktop = Boolean(device.os.desktop);
    // Show on-screen controls only for mobile/tablet touch devices.
    this.enabled = hasTouch && !isDesktop;

    this.state = {
      left: false,
      right: false,
      jump: false,
    };

    this.justPressed = {
      jump: false,
    };

    this.justReleased = {
      jump: false,
    };

    this.previous = {
      jump: false,
    };

    this.controls = [];

    if (this.enabled) {
      this.createTouchControls();
      this.layoutControls();

      this.onResize = () => this.layoutControls();
      this.onPointerUp = () => this.resetAll();

      this.scene.scale.on('resize', this.onResize);
      this.scene.input.on('pointerup', this.onPointerUp);
      this.scene.input.on('gameout', this.onPointerUp);
    }
  }

  createTouchControls() {
    this.controls.push(this.makePad('left', 'left', 27));
    this.controls.push(this.makePad('right', 'right', 27));
    this.controls.push(this.makePad('jump', 'jump', 31));
  }

  layoutControls() {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const landscape = width >= height;

    const leftButton = this.controls.find((control) => control.key === 'left');
    const rightButton = this.controls.find((control) => control.key === 'right');
    const jumpButton = this.controls.find((control) => control.key === 'jump');

    if (!leftButton || !rightButton || !jumpButton) {
      return;
    }

    const leftY = landscape ? height - 60 : height - 82;
    const rightY = leftY;
    const jumpY = landscape ? height - 60 : height - 88;

    leftButton.setPosition(74, leftY);
    rightButton.setPosition(156, rightY);
    jumpButton.setPosition(width - 82, jumpY);

    leftButton.setRadius(landscape ? 26 : 30);
    rightButton.setRadius(landscape ? 26 : 30);
    jumpButton.setRadius(landscape ? 30 : 36);
  }

  makePad(key, icon, radius = 30) {
    const bg = this.scene.add
      .circle(0, 0, radius, 0x9fcbff, 0.12)
      .setScrollFactor(0)
      .setDepth(260)
      .setStrokeStyle(2.2, 0xc5e8ff, 0.62);

    const inner = this.scene.add.circle(0, 0, Math.max(8, radius - 10), 0x5d9ee4, 0.18).setScrollFactor(0).setDepth(261);
    const gloss = this.scene.add.circle(0, 0, Math.max(6, radius - 16), 0xffffff, 0.11).setScrollFactor(0).setDepth(262);
    const glyph = this.scene.add.graphics().setScrollFactor(0).setDepth(263);

    const drawGlyph = (x, y, size, alpha = 1) => {
      glyph.clear();
      glyph.fillStyle(0xffffff, alpha);
      glyph.lineStyle(2, 0xffffff, alpha);
      if (icon === 'left') {
        glyph.fillTriangle(x - size * 0.36, y, x + size * 0.22, y - size * 0.46, x + size * 0.22, y + size * 0.46);
      } else if (icon === 'right') {
        glyph.fillTriangle(x + size * 0.36, y, x - size * 0.22, y - size * 0.46, x - size * 0.22, y + size * 0.46);
      } else {
        glyph.fillTriangle(x, y - size * 0.36, x - size * 0.46, y + size * 0.22, x + size * 0.46, y + size * 0.22);
      }
    };

    bg.setInteractive({ useHandCursor: false });

    const setDown = (value) => {
      this.state[key] = value;
      bg.setFillStyle(0x9fcbff, value ? 0.22 : 0.12);
      inner.setFillStyle(0x5d9ee4, value ? 0.3 : 0.18);
      gloss.setFillStyle(0xffffff, value ? 0.18 : 0.11);
      bg.setStrokeStyle(2.2, 0xc5e8ff, value ? 0.86 : 0.62);
      drawGlyph(bg.x, bg.y, Math.max(12, radius * 0.65), value ? 1 : 0.92);
    };

    bg.on('pointerdown', () => setDown(true));
    bg.on('pointerup', () => setDown(false));
    bg.on('pointerout', () => setDown(false));
    bg.on('pointerupoutside', () => setDown(false));

    drawGlyph(0, 0, Math.max(12, radius * 0.65), 0.92);

    return {
      key,
      bg,
      inner,
      gloss,
      glyph,
      setPosition: (x, y) => {
        bg.setPosition(x, y);
        inner.setPosition(x, y);
        gloss.setPosition(x, y);
        drawGlyph(x, y, Math.max(12, bg.radius * 0.65), this.state[key] ? 1 : 0.92);
      },
      setRadius: (newRadius) => {
        bg.setRadius(newRadius);
        inner.setRadius(Math.max(8, newRadius - 10));
        gloss.setRadius(Math.max(6, newRadius - 16));
        drawGlyph(bg.x, bg.y, Math.max(12, newRadius * 0.65), this.state[key] ? 1 : 0.92);
      },
      reset: () => setDown(false),
      destroy: () => {
        bg.destroy();
        inner.destroy();
        gloss.destroy();
        glyph.destroy();
      },
    };
  }

  resetAll() {
    this.controls.forEach((control) => control.reset());
  }

  update() {
    if (!this.enabled) {
      return;
    }

    this.justPressed.jump = this.state.jump && !this.previous.jump;
    this.justReleased.jump = !this.state.jump && this.previous.jump;
    this.previous.jump = this.state.jump;
  }

  isLeftDown() {
    return this.enabled && this.state.left;
  }

  isRightDown() {
    return this.enabled && this.state.right;
  }

  isJumpDown() {
    return this.enabled && this.state.jump;
  }

  consumeJumpJustPressed() {
    const value = this.justPressed.jump;
    this.justPressed.jump = false;
    return value;
  }

  consumeJumpJustReleased() {
    const value = this.justReleased.jump;
    this.justReleased.jump = false;
    return value;
  }

  destroy() {
    if (this.enabled) {
      this.scene.scale.off('resize', this.onResize);
      this.scene.input.off('pointerup', this.onPointerUp);
      this.scene.input.off('gameout', this.onPointerUp);
    }

    this.controls.forEach((control) => control.destroy());
    this.controls = [];
  }
}
