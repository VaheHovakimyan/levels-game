import Phaser from 'phaser';
import { LEVEL_HEIGHT, DEFAULT_DEATH_Y_OFFSET } from '../utils/constants';
import { Platform } from '../entities/Platform';
import { Trap } from '../entities/Trap';
import { Door } from '../entities/Door';

const LEGACY_LEVEL_HEIGHT = 540;
const CAMERA_BOTTOM_UI_GUTTER = 96;

export class LevelLoader {
  constructor(scene) {
    this.scene = scene;

    this.levelData = null;
    this.platforms = [];
    this.traps = [];
    this.doors = [];

    this.platformGroup = null;
    this.trapGroup = null;
    this.doorGroup = null;
    this.doorWallGroup = null;

    this.backgroundLayer = [];
  }

  build(levelData) {
    this.clear();
    this.levelData = levelData;
    const yOffset = this.getLayoutYOffset();

    this.scene.physics.world.setBounds(0, 0, levelData.worldWidth, LEVEL_HEIGHT);
    // Keep top / side bounds, but allow falling past bottom into pits.
    this.scene.physics.world.setBoundsCollision(true, true, true, false);
    // Add a small extra camera-only gutter so bottom on-screen controls don't cover the player.
    this.scene.cameras.main.setBounds(0, 0, levelData.worldWidth, LEVEL_HEIGHT + CAMERA_BOTTOM_UI_GUTTER);

    this.drawBackground(levelData);

    this.platformGroup = this.scene.physics.add.group({ allowGravity: false, immovable: true });
    this.trapGroup = this.scene.physics.add.group({ allowGravity: false, immovable: true });
    this.doorGroup = this.scene.physics.add.group({ allowGravity: false, immovable: true });
    this.doorWallGroup = this.scene.physics.add.group({ allowGravity: false, immovable: true });

    levelData.platforms.forEach((platformConfig) => {
      const platform = new Platform(this.scene, this.applyYOffset(platformConfig, yOffset));
      this.platforms.push(platform);
      this.platformGroup.add(platform);
    });

    levelData.traps.forEach((trapConfig) => {
      const trap = new Trap(this.scene, this.applyYOffset(trapConfig, yOffset));
      this.traps.push(trap);
      this.trapGroup.add(trap);
    });

    const realDoor = new Door(this.scene, { ...this.applyYOffset(levelData.door, yOffset), decoy: false });
    this.doors.push(realDoor);
    this.doorGroup.add(realDoor);
    if (realDoor.getExitWall()) {
      this.doorWallGroup.add(realDoor.getExitWall());
    }

    levelData.fakeDoors.forEach((doorConfig) => {
      const door = new Door(this.scene, { ...this.applyYOffset(doorConfig, yOffset), decoy: true });
      this.doors.push(door);
      this.doorGroup.add(door);
    });

    return {
      spawn: {
        ...levelData.spawn,
        y: levelData.spawn.y + yOffset,
      },
      modifiers: levelData.modifiers,
      message: levelData.message,
      levelName: levelData.name,
      deathY: levelData.deathY !== undefined ? levelData.deathY + yOffset : LEVEL_HEIGHT + DEFAULT_DEATH_Y_OFFSET,
    };
  }

  getLayoutYOffset() {
    return Math.max(0, LEVEL_HEIGHT - LEGACY_LEVEL_HEIGHT);
  }

  applyYOffset(config, yOffset) {
    if (!config || yOffset === 0) {
      return config;
    }

    const next = { ...config, y: config.y + yOffset };

    if (config.patrol?.axis === 'y') {
      next.patrol = {
        ...config.patrol,
        min: config.patrol.min + yOffset,
        max: config.patrol.max + yOffset,
      };
    }

    if (config.moving?.axis === 'y') {
      next.moving = {
        ...config.moving,
        min: config.moving.min + yOffset,
        max: config.moving.max + yOffset,
      };
    }

    return next;
  }

  getSpacePalette(themeIndex) {
    const palettes = [
      {
        skyTop: '#020914',
        skyMid: '#0a1530',
        skyBottom: '#111f3a',
        nebulaA: 'rgba(94, 158, 255, 0.36)',
        nebulaB: 'rgba(134, 91, 255, 0.3)',
        nebulaC: 'rgba(91, 234, 255, 0.2)',
        glowColor: 0x6fb9ff,
        fogA: 0x4e81bc,
        fogB: 0x5f94d4,
      },
      {
        skyTop: '#050d19',
        skyMid: '#13213f',
        skyBottom: '#1b2b48',
        nebulaA: 'rgba(123, 169, 255, 0.3)',
        nebulaB: 'rgba(88, 221, 255, 0.2)',
        nebulaC: 'rgba(167, 129, 255, 0.24)',
        glowColor: 0x79ccff,
        fogA: 0x4d7caa,
        fogB: 0x73c6e8,
      },
      {
        skyTop: '#0a0817',
        skyMid: '#1a1835',
        skyBottom: '#29233f',
        nebulaA: 'rgba(255, 156, 109, 0.3)',
        nebulaB: 'rgba(250, 121, 168, 0.23)',
        nebulaC: 'rgba(133, 187, 255, 0.2)',
        glowColor: 0xffa86d,
        fogA: 0x905780,
        fogB: 0xcd7da2,
      },
      {
        skyTop: '#030714',
        skyMid: '#0f1740',
        skyBottom: '#1a1f4a',
        nebulaA: 'rgba(128, 145, 255, 0.32)',
        nebulaB: 'rgba(196, 117, 255, 0.26)',
        nebulaC: 'rgba(107, 212, 255, 0.2)',
        glowColor: 0xc58eff,
        fogA: 0x57449a,
        fogB: 0x7d66cf,
      },
    ];

    return palettes[themeIndex % palettes.length];
  }

  ensureSpaceGradientTexture(worldWidth, themeIndex, palette) {
    const gradientKey = `space-bg-${worldWidth}-${themeIndex}`;
    if (this.scene.textures.exists(gradientKey)) {
      return gradientKey;
    }

    const texture = this.scene.textures.createCanvas(gradientKey, worldWidth, LEVEL_HEIGHT);
    const ctx = texture.context;
    const rng = new Phaser.Math.RandomDataGenerator([`space-${worldWidth}-${themeIndex}`]);

    const gradient = ctx.createLinearGradient(0, 0, 0, LEVEL_HEIGHT);
    gradient.addColorStop(0, palette.skyTop);
    gradient.addColorStop(0.54, palette.skyMid);
    gradient.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, worldWidth, LEVEL_HEIGHT);

    const nebulaAnchors = [
      { x: worldWidth * 0.18, y: LEVEL_HEIGHT * 0.2, radius: LEVEL_HEIGHT * 0.6, color: palette.nebulaA },
      { x: worldWidth * 0.58, y: LEVEL_HEIGHT * 0.26, radius: LEVEL_HEIGHT * 0.72, color: palette.nebulaB },
      { x: worldWidth * 0.84, y: LEVEL_HEIGHT * 0.72, radius: LEVEL_HEIGHT * 0.64, color: palette.nebulaC },
    ];
    nebulaAnchors.forEach((anchor) => {
      const mist = ctx.createRadialGradient(anchor.x, anchor.y, 10, anchor.x, anchor.y, anchor.radius);
      mist.addColorStop(0, anchor.color);
      mist.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, worldWidth, LEVEL_HEIGHT);
    });

    // Subtle andromeda streaks.
    for (let i = 0; i < 42; i += 1) {
      const t = i / 41;
      const alpha = 0.16 * (1 - t);
      const width = LEVEL_HEIGHT * (0.54 - t * 0.26);
      const height = LEVEL_HEIGHT * (0.18 - t * 0.08);
      const cx = worldWidth * 0.68 + Math.sin(i * 0.4) * 18;
      const cy = LEVEL_HEIGHT * 0.28 + Math.cos(i * 0.37) * 14;
      ctx.strokeStyle = `rgba(192, 157, 255, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, width, Math.max(8, height), -0.18, 0, Math.PI * 2);
      ctx.stroke();
    }

    const starTotal = Phaser.Math.Clamp(Math.floor(worldWidth / 8), 150, 280);
    for (let i = 0; i < starTotal; i += 1) {
      const x = rng.realInRange(0, worldWidth);
      const y = rng.realInRange(2, LEVEL_HEIGHT * 0.92);
      const radius = rng.realInRange(0.45, 2.2);
      const alpha = rng.realInRange(0.2, 0.9);
      const tint = i % 6 === 0 ? `rgba(255, 241, 205, ${alpha})` : `rgba(195, 226, 255, ${alpha})`;
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (radius > 1.75 && i % 3 === 0) {
        ctx.strokeStyle = `rgba(225, 242, 255, ${Math.min(0.65, alpha + 0.1)})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(x - 3.5, y);
        ctx.lineTo(x + 3.5, y);
        ctx.moveTo(x, y - 3.5);
        ctx.lineTo(x, y + 3.5);
        ctx.stroke();
      }
    }

    texture.refresh();
    return gradientKey;
  }

  ensureSpaceBodyTextures() {
    if (!this.scene.textures.exists('space-planet-blue')) {
      const tex = this.scene.textures.createCanvas('space-planet-blue', 420, 420);
      const ctx = tex.context;
      const cX = 210;
      const cY = 210;
      const r = 198;

      const ocean = ctx.createRadialGradient(cX - 50, cY - 60, 30, cX, cY, r);
      ocean.addColorStop(0, '#93e2ff');
      ocean.addColorStop(0.44, '#2c8fdf');
      ocean.addColorStop(1, '#0f3a70');
      ctx.fillStyle = ocean;
      ctx.beginPath();
      ctx.arc(cX, cY, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(138, 231, 166, 0.88)';
      ctx.beginPath();
      ctx.ellipse(cX - 55, cY - 10, 72, 36, -0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cX + 58, cY + 46, 54, 28, 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cX + 12, cY - 74, 38, 20, -0.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(220, 245, 255, 0.9)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      ctx.ellipse(cX - 36, cY - 74, 70, 18, -0.22, 0, Math.PI * 2);
      ctx.fill();

      tex.refresh();
    }

    if (!this.scene.textures.exists('space-moon-rocky')) {
      const tex = this.scene.textures.createCanvas('space-moon-rocky', 300, 300);
      const ctx = tex.context;
      const cX = 150;
      const cY = 150;
      const r = 138;

      const moon = ctx.createRadialGradient(cX - 24, cY - 36, 20, cX, cY, r);
      moon.addColorStop(0, '#f0f6ff');
      moon.addColorStop(0.58, '#becbdd');
      moon.addColorStop(1, '#798ca8');
      ctx.fillStyle = moon;
      ctx.beginPath();
      ctx.arc(cX, cY, r, 0, Math.PI * 2);
      ctx.fill();

      const craters = [
        { x: -48, y: -22, r: 20 },
        { x: 34, y: -44, r: 15 },
        { x: 52, y: 28, r: 23 },
        { x: -30, y: 52, r: 18 },
        { x: 6, y: 8, r: 11 },
      ];

      craters.forEach((crater) => {
        ctx.fillStyle = 'rgba(95, 114, 140, 0.45)';
        ctx.beginPath();
        ctx.arc(cX + crater.x, cY + crater.y, crater.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(224, 236, 252, 0.35)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(cX + crater.x, cY + crater.y, crater.r, 0.5, Math.PI * 1.72);
        ctx.stroke();
      });

      ctx.strokeStyle = 'rgba(228, 240, 255, 0.84)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 4, 0, Math.PI * 2);
      ctx.stroke();

      tex.refresh();
    }
  }

  drawBackground(levelData) {
    const worldWidth = levelData.worldWidth;
    const midY = LEVEL_HEIGHT / 2;
    const themeIndex = (levelData.id - 1) % 4;
    const palette = this.getSpacePalette(themeIndex);
    const bottomFillColor = Phaser.Display.Color.HexStringToColor(palette.skyBottom).color;
    const lowPowerDevice =
      (typeof navigator !== 'undefined' && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory <= 4);
    const sparkleCount = lowPowerDevice ? 34 : 56;
    const dustCount = lowPowerDevice ? 12 : 20;
    const cometCount = lowPowerDevice ? 2 : 4;
    const gradientKey = this.ensureSpaceGradientTexture(worldWidth, themeIndex, palette);
    this.ensureSpaceBodyTextures();

    const bottomGutterFill = this.scene
      .add.rectangle(
        worldWidth / 2,
        LEVEL_HEIGHT + CAMERA_BOTTOM_UI_GUTTER * 0.5,
        worldWidth,
        CAMERA_BOTTOM_UI_GUTTER,
        bottomFillColor,
        1,
      )
      .setDepth(-45);

    const background = this.scene.add.image(worldWidth / 2, midY, gradientKey).setDepth(-44);
    const glow = this.scene
      .add.ellipse(worldWidth / 2, midY - LEVEL_HEIGHT * 0.06, worldWidth * 0.94, LEVEL_HEIGHT * 0.82, palette.glowColor, 0.1)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setDepth(-43);

    const nebulaCloudA = this.scene
      .add.ellipse(worldWidth * 0.24, LEVEL_HEIGHT * 0.3, worldWidth * 0.46, LEVEL_HEIGHT * 0.36, 0x699dff, 0.15)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setDepth(-42);
    const nebulaCloudB = this.scene
      .add.ellipse(worldWidth * 0.7, LEVEL_HEIGHT * 0.22, worldWidth * 0.42, LEVEL_HEIGHT * 0.32, 0xc27dff, 0.14)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setDepth(-42);
    const nebulaCloudC = this.scene
      .add.ellipse(worldWidth * 0.82, LEVEL_HEIGHT * 0.74, worldWidth * 0.52, LEVEL_HEIGHT * 0.42, 0x6ad0ff, 0.1)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setDepth(-42);

    const andromedaGlow = this.scene
      .add.ellipse(worldWidth * 0.69, LEVEL_HEIGHT * 0.28, worldWidth * 0.34, LEVEL_HEIGHT * 0.21, 0xd7a8ff, 0.16)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(-42);

    const planet = this.scene.add.image(worldWidth * 0.84, LEVEL_HEIGHT * 0.17, 'space-planet-blue').setDepth(-41);
    planet.setDisplaySize(236, 236);
    const moon = this.scene.add.image(worldWidth * 0.13, LEVEL_HEIGHT * 0.21, 'space-moon-rocky').setDepth(-41);
    moon.setDisplaySize(124, 124);

    const fogBands = [
      this.scene
        .add.ellipse(worldWidth * 0.24, LEVEL_HEIGHT * 0.86, worldWidth * 0.66, 116, palette.fogA, 0.1)
        .setDepth(-40),
      this.scene
        .add.ellipse(worldWidth * 0.74, LEVEL_HEIGHT * 0.84, worldWidth * 0.58, 102, palette.fogB, 0.08)
        .setDepth(-40),
    ];

    this.scene.tweens.add({
      targets: [planet, moon],
      y: '-=8',
      duration: 4200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.scene.tweens.add({
      targets: [nebulaCloudA, nebulaCloudB, nebulaCloudC],
      alpha: { from: 0.11, to: 0.2 },
      duration: 3400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.scene.tweens.add({
      targets: andromedaGlow,
      angle: 2.4,
      alpha: { from: 0.08, to: 0.2 },
      duration: 6000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    const sparkles = [];
    for (let i = 0; i < sparkleCount; i += 1) {
      const orb = this.scene.add.circle(
        Phaser.Math.Between(20, worldWidth - 20),
        Phaser.Math.Between(18, LEVEL_HEIGHT - 28),
        Phaser.Math.Between(0.9, 2.4),
        i % 5 === 0 ? 0xfff1c8 : 0xbddfff,
        Phaser.Math.FloatBetween(0.26, 0.58),
      );
      orb.setDepth(-39);
      this.scene.tweens.add({
        targets: orb,
        alpha: { from: 0.08, to: 0.62 },
        y: orb.y - Phaser.Math.Between(4, 18),
        duration: Phaser.Math.Between(1400, 3000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      sparkles.push(orb);
    }

    const driftingDust = [];
    for (let i = 0; i < dustCount; i += 1) {
      const dust = this.scene.add
        .ellipse(
          Phaser.Math.Between(20, worldWidth - 20),
          Phaser.Math.Between(130, LEVEL_HEIGHT - 40),
          Phaser.Math.Between(10, 24),
          Phaser.Math.Between(2, 5),
          themeIndex === 2 ? 0xf8c199 : 0x95b9e6,
          Phaser.Math.FloatBetween(0.08, 0.2),
        )
        .setDepth(-38);
      this.scene.tweens.add({
        targets: dust,
        x: dust.x + Phaser.Math.Between(-24, 24),
        alpha: { from: dust.alpha * 0.6, to: dust.alpha * 1.5 },
        duration: Phaser.Math.Between(2600, 4200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      driftingDust.push(dust);
    }

    const comets = [];
    for (let i = 0; i < cometCount; i += 1) {
      const comet = this.scene.add
        .rectangle(
          Phaser.Math.Between(120, worldWidth - 140),
          Phaser.Math.Between(70, Math.max(100, LEVEL_HEIGHT * 0.48)),
          Phaser.Math.Between(20, 34),
          2,
          0xd9ecff,
          0.38,
        )
        .setDepth(-39)
        .setAngle(Phaser.Math.Between(-24, -14));
      this.scene.tweens.add({
        targets: comet,
        x: comet.x + Phaser.Math.Between(40, 90),
        y: comet.y + Phaser.Math.Between(12, 26),
        alpha: { from: 0.1, to: 0.48 },
        duration: Phaser.Math.Between(2200, 3800),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      comets.push(comet);
    }

    this.backgroundLayer.push(
      bottomGutterFill,
      background,
      glow,
      nebulaCloudA,
      nebulaCloudB,
      nebulaCloudC,
      andromedaGlow,
      planet,
      moon,
      ...fogBands,
      ...sparkles,
      ...driftingDust,
      ...comets,
    );
  }

  update(player) {
    this.platforms.forEach((platform) => platform.update?.());
    this.traps.forEach((trap) => trap.update(player));
    this.doors.forEach((door) => door.update());
  }

  resetDynamicObjects() {
    this.platforms.forEach((platform) => platform.reset());
    this.traps.forEach((trap) => trap.reset());
    this.doors.forEach((door) => door.reset());
  }

  clear() {
    this.platforms.forEach((platform) => platform.destroy());
    this.traps.forEach((trap) => trap.destroy());
    this.doors.forEach((door) => door.destroy());

    this.backgroundLayer.forEach((item) => item.destroy());

    if (this.platformGroup) {
      this.platformGroup.destroy(true);
    }

    if (this.trapGroup) {
      this.trapGroup.destroy(true);
    }

    if (this.doorGroup) {
      this.doorGroup.destroy(true);
    }

    if (this.doorWallGroup) {
      this.doorWallGroup.destroy(true);
    }

    this.platforms = [];
    this.traps = [];
    this.doors = [];
    this.backgroundLayer = [];
    this.platformGroup = null;
    this.trapGroup = null;
    this.doorGroup = null;
    this.doorWallGroup = null;
  }
}
