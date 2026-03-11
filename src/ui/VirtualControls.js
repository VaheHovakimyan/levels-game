import Phaser from 'phaser';

const HIT_RADIUS_MULTIPLIER = 1.3;
const MIN_TOUCH_RADIUS_PX = 38;
const MAX_TOUCH_RADIUS_PX = 58;
const EDGE_MARGIN_LANDSCAPE_PX = 24;
const EDGE_MARGIN_PORTRAIT_PX = 30;
const BOTTOM_MARGIN_LANDSCAPE_PX = 28;
const BOTTOM_MARGIN_PORTRAIT_PX = 36;

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
      // Ensure we can hold movement and tap jump at the same time.
      this.ensureMultiTouchCapacity();
      this.createTouchControls();
      this.layoutControls();

      this.onResize = () => {
        this.resetAll();
        this.layoutControls();
      };
      this.onGameOut = () => this.resetAll();
      this.onVisualViewportChange = () => {
        this.resetAll();
        this.layoutControls();
      };
      this.onWindowResize = () => {
        this.resetAll();
        this.layoutControls();
      };
      this.onOrientationChange = () => {
        this.resetAll();
        this.layoutControls();
        // Some mobile browsers update the visible viewport after orientation tick.
        window.setTimeout(() => this.layoutControls(), 80);
      };

      this.scene.scale.on('resize', this.onResize);
      this.scene.input.on('gameout', this.onGameOut);
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', this.onWindowResize);
        window.addEventListener('orientationchange', this.onOrientationChange);
      }
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.addEventListener('resize', this.onVisualViewportChange);
        window.visualViewport.addEventListener('scroll', this.onVisualViewportChange);
      }
    }
  }

  ensureMultiTouchCapacity() {
    const pointersTotal = this.scene.input.manager?.pointersTotal ?? 0;
    const requiredPointers = 4;
    const missingPointers = Math.max(0, requiredPointers - pointersTotal);

    if (missingPointers > 0) {
      this.scene.input.addPointer(missingPointers);
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
    const displayWidth = this.scene.scale.displaySize?.width ?? width;
    const displayHeight = this.scene.scale.displaySize?.height ?? height;
    const gameWidth = this.scene.scale.gameSize?.width ?? width;
    const gameHeight = this.scene.scale.gameSize?.height ?? height;
    const landscape = displayWidth >= displayHeight;

    const leftButton = this.controls.find((control) => control.key === 'left');
    const rightButton = this.controls.find((control) => control.key === 'right');
    const jumpButton = this.controls.find((control) => control.key === 'jump');

    if (!leftButton || !rightButton || !jumpButton) {
      return;
    }

    const scaleX = displayWidth / gameWidth || 1;
    const scaleY = displayHeight / gameHeight || 1;
    const displayScale = Math.min(scaleX, scaleY) || 1;
    const viewportShortSidePx = Math.min(displayWidth, displayHeight);
    const radiusPx = Phaser.Math.Clamp(viewportShortSidePx * 0.105, MIN_TOUCH_RADIUS_PX, MAX_TOUCH_RADIUS_PX);
    const browserInsetsPx = this.getBrowserInsetsPx();

    const moveRadius = radiusPx / displayScale;
    const jumpRadius = radiusPx / displayScale;
    const gap = (landscape ? 14 : 18) / displayScale;
    const leftMargin =
      ((landscape ? EDGE_MARGIN_LANDSCAPE_PX : EDGE_MARGIN_PORTRAIT_PX) + browserInsetsPx.left) / displayScale;
    const rightMargin =
      ((landscape ? EDGE_MARGIN_LANDSCAPE_PX : EDGE_MARGIN_PORTRAIT_PX) + browserInsetsPx.right) / displayScale;
    const bottomMargin =
      ((landscape ? BOTTOM_MARGIN_LANDSCAPE_PX : BOTTOM_MARGIN_PORTRAIT_PX) + browserInsetsPx.bottom) / displayScale;

    const leftX = leftMargin + moveRadius;
    const rightX = leftX + moveRadius + gap + moveRadius;
    const leftY = Phaser.Math.Clamp(height - bottomMargin - moveRadius, moveRadius + 4, height - moveRadius - 4);
    const rightY = leftY;
    const jumpX = width - rightMargin - jumpRadius;
    const jumpY = Phaser.Math.Clamp(height - bottomMargin - jumpRadius, jumpRadius + 4, height - jumpRadius - 4);

    leftButton.setPosition(leftX, leftY);
    rightButton.setPosition(rightX, rightY);
    jumpButton.setPosition(jumpX, jumpY);

    leftButton.setRadius(moveRadius);
    rightButton.setRadius(moveRadius);
    jumpButton.setRadius(jumpRadius);
  }

  getBrowserInsetsPx() {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return { left: 0, right: 0, bottom: 0 };
    }

    const viewport = window.visualViewport;
    const viewportLeft = viewport.offsetLeft || 0;
    const viewportTop = viewport.offsetTop || 0;
    const viewportRight = viewportLeft + viewport.width;
    const viewportBottom = viewportTop + viewport.height;

    const rightInset = Math.max(0, window.innerWidth - viewportRight);
    const bottomInset = Math.max(0, window.innerHeight - viewportBottom);

    return {
      left: Math.max(0, viewportLeft),
      right: rightInset,
      bottom: bottomInset,
    };
  }

  makePad(key, icon, radius = 30) {
    const bg = this.scene.add
      .circle(0, 0, radius, 0x9fcbff, 0.12)
      .setScrollFactor(0)
      .setDepth(260)
      .setStrokeStyle(2.2, 0xc5e8ff, 0.62);

    const hit = this.scene.add
      .circle(0, 0, radius * HIT_RADIUS_MULTIPLIER, 0xffffff, 0.001)
      .setScrollFactor(0)
      .setDepth(259);

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

    hit.setInteractive({ useHandCursor: false });
    const activePointers = new Set();

    const setDown = (value) => {
      this.state[key] = value;
      bg.setFillStyle(0x9fcbff, value ? 0.22 : 0.12);
      inner.setFillStyle(0x5d9ee4, value ? 0.3 : 0.18);
      gloss.setFillStyle(0xffffff, value ? 0.18 : 0.11);
      bg.setStrokeStyle(2.2, 0xc5e8ff, value ? 0.86 : 0.62);
      drawGlyph(bg.x, bg.y, Math.max(12, bg.radius * 0.65), value ? 1 : 0.92);
    };

    const syncFromPointers = () => {
      setDown(activePointers.size > 0);
    };

    const pressPointer = (pointer) => {
      activePointers.add(pointer.id);
      syncFromPointers();
    };

    const releasePointer = (pointer) => {
      activePointers.delete(pointer.id);
      syncFromPointers();
    };

    hit.on('pointerdown', pressPointer);
    hit.on('pointerup', releasePointer);
    hit.on('pointerout', releasePointer);
    hit.on('pointerupoutside', releasePointer);

    drawGlyph(0, 0, Math.max(12, radius * 0.65), 0.92);

    return {
      key,
      bg,
      inner,
      gloss,
      glyph,
      setPosition: (x, y) => {
        bg.setPosition(x, y);
        hit.setPosition(x, y);
        inner.setPosition(x, y);
        gloss.setPosition(x, y);
        drawGlyph(x, y, Math.max(12, bg.radius * 0.65), this.state[key] ? 1 : 0.92);
      },
      setRadius: (newRadius) => {
        bg.setRadius(newRadius);
        hit.setRadius(newRadius * HIT_RADIUS_MULTIPLIER);
        inner.setRadius(Math.max(8, newRadius - 10));
        gloss.setRadius(Math.max(6, newRadius - 16));
        drawGlyph(bg.x, bg.y, Math.max(12, newRadius * 0.65), this.state[key] ? 1 : 0.92);
      },
      reset: () => {
        activePointers.clear();
        setDown(false);
      },
      destroy: () => {
        hit.destroy();
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
      this.scene.input.off('gameout', this.onGameOut);
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', this.onWindowResize);
        window.removeEventListener('orientationchange', this.onOrientationChange);
      }
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', this.onVisualViewportChange);
        window.visualViewport.removeEventListener('scroll', this.onVisualViewportChange);
      }
    }

    this.controls.forEach((control) => control.destroy());
    this.controls = [];
  }
}
