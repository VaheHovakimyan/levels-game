import Phaser from 'phaser';
import { LEVELS, TOTAL_LEVELS } from '../data/levels';
import { clampStageIndex, LEVELS_PER_WORLD, ROADMAP_WORLDS } from '../data/roadmap';
import { SCENE_KEYS } from '../utils/constants';
import { resetProgress, saveSelectedSkin } from '../utils/storage';
import { SoundManager } from '../systems/SoundManager';
import { createButton, createPanel, popIn } from '../ui/UiFactory';
import { MENU_LAYOUT, UI_THEME } from '../ui/theme';
import { getPlayerAnimKey, getSkinLabel, PLAYER_SKINS, sanitizeSkinKey } from '../entities/playerArt';

const ROADMAP_TEXTURE_SCALE = 3;
const ROADMAP_EARTH_SIZE = 150;
const ROADMAP_MOON_SIZE = 108;
const ROADMAP_MOON_DISPLAY_SIZE = 86;
const ROADMAP_MARS_SIZE = 130;
const ROADMAP_VOID_SIZE = 126;
const SKIN_SELECT_INPUT_GUARD_MS = 220;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.MENU);

    this.levelSelectContainer = null;
    this.skinSelectContainer = null;

    this.metaText = null;
    this.menuTitleText = null;
    this.menuSubtitleText = null;
    this.mainPanel = null;
    this.bgDecor = [];
    this.isTransitioning = false;

    this.skinButton = null;
    this.skinPreview = null;
    this.skinPreviewPanel = null;
    this.skinPreviewTitle = null;
    this.skinNameText = null;
    this.playButton = null;
    this.mapButton = null;
    this.settingsButton = null;
    this.settingsPopup = null;
    this.settingsMuteButton = null;
    this.skinSelectInputUnlockAt = 0;
  }

  create() {
    this.isTransitioning = false;
    this.soundManager = new SoundManager(this);
    this.cameras.main.setZoom(1);

    if (this.scene.isActive(SCENE_KEYS.UI)) {
      this.scene.stop(SCENE_KEYS.UI);
    }

    this.cameras.main.setBackgroundColor('#080f1f');
    this.createBackgroundDecor();

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const uiY = {
      title: Math.round(this.scale.height * 0.085),
      panel: centerY + Math.round(this.scale.height * 0.04),
      meta: centerY - Math.round(this.scale.height * 0.175),
      suitPreview: centerY - Math.round(this.scale.height * 0.08),
      play: centerY + Math.round(this.scale.height * 0.04),
      roadmap: centerY + Math.round(this.scale.height * 0.125),
      skin: centerY + Math.round(this.scale.height * 0.21),
    };

    this.menuTitleText = this.add
      .text(centerX, uiY.title, 'ASTRO GAUNTLET', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '52px',
        color: UI_THEME.colors.textPrimary,
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.tweens.add({
      targets: this.menuTitleText,
      y: this.menuTitleText.y - 2,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.mainPanel = createPanel(this, {
      x: centerX,
      y: uiY.panel,
      width: MENU_LAYOUT.panelWidth,
      height: MENU_LAYOUT.panelHeight,
      depth: 90,
    }).container;

    this.metaText = this.add
      .text(centerX, uiY.meta, '', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '16px',
        color: UI_THEME.colors.textSecondary,
      })
      .setOrigin(0.5)
      .setDepth(101);

    this.createSkinPreview(centerX, uiY.suitPreview);

    this.playButton = createButton(this, {
      x: centerX,
      y: uiY.play,
      width: MENU_LAYOUT.buttonWidth,
      height: MENU_LAYOUT.buttonHeight,
      label: 'Play',
      icon: 'play',
      depth: 102,
      onClick: () => {
        // Resume from latest unlocked stage instead of always replaying the first stage.
        const unlockedStage = clampStageIndex(this.registry.get('unlockedLevel') ?? 0);
        this.registry.set('currentLevel', unlockedStage);
        this.startLevel(unlockedStage);
      },
    });

    this.mapButton = createButton(this, {
      x: centerX,
      y: uiY.roadmap,
      width: MENU_LAYOUT.buttonWidth,
      height: MENU_LAYOUT.buttonHeight,
      label: 'Mission Map',
      icon: 'roadmap',
      depth: 102,
      onClick: () => this.toggleLevelSelect(),
    });

    this.skinButton = createButton(this, {
      x: centerX,
      y: uiY.skin,
      width: MENU_LAYOUT.buttonWidth,
      height: 46,
      label: 'Open Suit Bay',
      icon: 'skin',
      depth: 102,
      triggerOnTouchDown: false,
      onClick: () => this.toggleSkinSelect(),
    });

    this.settingsButton = createButton(this, {
      x: this.scale.width - Math.round(this.scale.width * 0.03),
      y: Math.round(this.scale.height * 0.04),
      width: 52,
      height: 36,
      icon: 'settings',
      depth: 170,
      onClick: () => this.toggleSettingsPopup(),
    });

    this.settingsPopup = this.createSettingsPopup();

    this.levelSelectContainer = this.add.container(0, 0).setVisible(false).setDepth(180);
    this.skinSelectContainer = this.add.container(0, 0).setVisible(false).setDepth(181);

    this.buildLevelSelect();
    this.buildSkinSelect();

    this.refreshMeta();
    this.refreshSkinUi();

    [
      this.mainPanel,
      this.playButton.container,
      this.mapButton.container,
      this.skinButton.container,
      this.settingsButton.container,
    ].forEach((item, index) => popIn(this, item, index * 35));

    this.cameras.main.fadeIn(220, 6, 9, 16);

    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize, this);
    });
  }

  createSettingsPopup() {
    const popupWidth = 260;
    const popupX = this.scale.width - popupWidth / 2 - Math.round(this.scale.width * 0.03);
    const popupY = Math.round(this.scale.height * 0.13);
    const popup = this.add.container(popupX, popupY).setDepth(171).setVisible(false);
    popup.setData('baseY', popupY);

    const base = createPanel(this, {
      x: 0,
      y: 0,
      width: popupWidth,
      height: 180,
    }).container;

    const title = this.add
      .text(-86, -60, 'SETTINGS', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '16px',
        color: UI_THEME.colors.textPrimary,
      })
      .setOrigin(0, 0.5);

    const closeButton = createButton(this, {
      x: 88,
      y: -60,
      width: 50,
      height: 28,
      icon: 'close',
      fontSize: '12px',
      onClick: () => this.toggleSettingsPopup(false),
    });

    this.settingsMuteButton = createButton(this, {
      x: 0,
      y: -10,
      width: 194,
      height: 36,
      label: 'Mute / Unmute',
      icon: this.registry.get('isMuted') ? 'sound-off' : 'sound-on',
      onClick: () => {
        const muted = this.soundManager.toggleMuted();
        this.settingsMuteButton.setIcon(muted ? 'sound-off' : 'sound-on');
        this.refreshMeta();
        this.showToast(muted ? 'Sound muted' : 'Sound enabled');
      },
    });

    const resetButton = createButton(this, {
      x: 0,
      y: 34,
      width: 194,
      height: 36,
      label: 'Reset Progress',
      icon: 'reset',
      variant: 'alt',
      onClick: () => this.handleResetProgress(),
    });

    popup.add([base, title, closeButton.container, this.settingsMuteButton.container, resetButton.container]);
    return popup;
  }

  toggleSettingsPopup(forceValue) {
    if (!this.settingsPopup) {
      return;
    }

    const visible = forceValue ?? !this.settingsPopup.visible;
    this.settingsPopup.setVisible(visible);

    if (visible) {
      const isMuted = this.registry.get('isMuted') ?? false;
      this.settingsMuteButton?.setIcon(isMuted ? 'sound-off' : 'sound-on');
      const baseY = this.settingsPopup.getData('baseY') ?? this.settingsPopup.y;
      this.settingsPopup.setAlpha(0);
      this.settingsPopup.setY(baseY + 8);
      this.tweens.add({
        targets: this.settingsPopup,
        alpha: 1,
        y: baseY,
        duration: 160,
        ease: 'Cubic.Out',
      });
    }
  }

  createSkinPreview(centerX, centerY) {
    const selectedSkin = sanitizeSkinKey(this.registry.get('selectedSkin') ?? PLAYER_SKINS[0].key);
    this.registry.set('selectedSkin', selectedSkin);

    this.skinPreviewPanel = this.add
      .rectangle(centerX, centerY + 2, 206, 96, 0x153154, 0.95)
      .setStrokeStyle(2, 0x5b98d1, 0.9)
      .setDepth(126);

    this.skinPreview = this.add.sprite(centerX - 56, centerY + 12, `player-${selectedSkin}-idle-0`).setDepth(127).setScale(1.34);
    this.skinPreview.play(getPlayerAnimKey(selectedSkin, 'run'));

    this.skinNameText = this.add
      .text(centerX + 34, centerY + 12, getSkinLabel(selectedSkin), {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '14px',
        color: UI_THEME.colors.textPrimary,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(127);

    this.tweens.add({
      targets: this.skinPreview,
      y: this.skinPreview.y - 2,
      yoyo: true,
      repeat: -1,
      duration: 320,
      ease: 'Sine.InOut',
    });

    this.skinPreviewTitle = this.add
      .text(centerX, centerY - 32, 'SUIT', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '13px',
        color: UI_THEME.colors.textMuted,
      })
      .setOrigin(0.5)
      .setDepth(127);

    this.skinPreviewPanel.setInteractive({ useHandCursor: true });
    this.skinPreviewPanel.on('pointerup', () => this.toggleSkinSelect(true));
  }

  selectSkin(skinKey) {
    const safe = sanitizeSkinKey(skinKey);
    this.registry.set('selectedSkin', safe);
    saveSelectedSkin(safe);

    this.refreshSkinUi();
    this.refreshMeta();
    this.buildSkinSelect();
    this.showToast(`Suit: ${getSkinLabel(safe)}`);
  }

  refreshSkinUi() {
    const selectedSkin = sanitizeSkinKey(this.registry.get('selectedSkin') ?? PLAYER_SKINS[0].key);
    const skinLabel = getSkinLabel(selectedSkin);

    if (this.skinButton) {
      this.skinButton.setIcon('skin');
    }

    if (this.skinNameText) {
      this.skinNameText.setText(skinLabel);
    }

    if (this.skinPreview) {
      this.skinPreview.setTexture(`player-${selectedSkin}-idle-0`);
      this.skinPreview.play(getPlayerAnimKey(selectedSkin, 'run'), true);
    }
  }

  buildSkinSelect() {
    this.skinSelectContainer.removeAll(true);

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const selectedSkin = sanitizeSkinKey(this.registry.get('selectedSkin') ?? PLAYER_SKINS[0].key);
    const viewportWidth = this.scale.width;
    const viewportHeight = this.scale.height;
    const panelMarginX = viewportWidth < 760 ? 20 : 32;
    const panelMarginY = viewportHeight < 640 ? 16 : 24;
    const panelWidth = Math.min(viewportWidth - panelMarginX * 2, 1020);
    const compact = panelWidth < 860;
    const columns = compact ? 1 : 2;
    const rows = Math.ceil(PLAYER_SKINS.length / columns);
    const contentPaddingX = compact ? 24 : 34;
    const gapX = compact ? 0 : 24;
    const maxCardWidth = compact ? 460 : 430;
    const minCardWidth = compact ? 250 : 320;
    const computedCardWidth = Math.floor((panelWidth - contentPaddingX * 2 - gapX * (columns - 1)) / columns);
    const cardWidth = Phaser.Math.Clamp(computedCardWidth, minCardWidth, maxCardWidth);

    let headerHeight = compact ? 96 : 108;
    let cardHeight = compact ? 108 : 126;
    let gapY = compact ? 14 : 20;
    const footerPadding = 28;
    const maxPanelHeight = viewportHeight - panelMarginY * 2;
    let panelHeight = headerHeight + rows * cardHeight + (rows - 1) * gapY + footerPadding;

    while (panelHeight > maxPanelHeight && cardHeight > 92) {
      cardHeight -= 4;
      gapY = Math.max(10, gapY - 1);
      headerHeight = Math.max(86, headerHeight - 1);
      panelHeight = headerHeight + rows * cardHeight + (rows - 1) * gapY + footerPadding;
    }

    panelHeight = Math.min(panelHeight, maxPanelHeight);
    const panelTop = centerY - panelHeight / 2;
    const titleY = panelTop + 54;
    const gridTop = panelTop + headerHeight + cardHeight / 2;

    const dimmer = this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.52).setInteractive();
    const panel = createPanel(this, {
      x: centerX,
      y: centerY,
      width: panelWidth,
      height: panelHeight,
    }).container;

    const title = this.add
      .text(centerX, titleY, 'Select Suit', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: compact ? '24px' : '28px',
        color: UI_THEME.colors.textPrimary,
      })
      .setOrigin(0.5);

    const closeButton = createButton(this, {
      x: centerX + panelWidth / 2 - 46,
      y: titleY,
      width: 46,
      height: 34,
      icon: 'close',
      onClick: () => this.toggleSkinSelect(false),
    }).container;

    this.skinSelectContainer.add([dimmer, panel, title, closeButton]);

    PLAYER_SKINS.forEach((skin, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const colOffset = (col - (columns - 1) / 2) * (cardWidth + gapX);
      const x = centerX + colOffset;
      const y = gridTop + row * (cardHeight + gapY);

      const selected = skin.key === selectedSkin;

      const card = this.add
        .rectangle(x, y, cardWidth, cardHeight, selected ? 0x385f8e : 0x203853, 1)
        .setStrokeStyle(2, selected ? 0xa6d8ff : 0x5f7b98, 1);

      const preview = this.add
        .sprite(x - cardWidth * 0.34, y + 4, `player-${skin.key}-idle-0`)
        .setScale(compact ? 1.26 : 1.38);
      preview.play(getPlayerAnimKey(skin.key, 'run'));

      const label = this.add
        .text(x + cardWidth * 0.16, y - Math.round(cardHeight * 0.1), skin.label, {
          fontFamily: UI_THEME.fontFamily,
          fontSize: compact ? '20px' : '22px',
          color: selected ? '#ffffff' : UI_THEME.colors.textSecondary,
        })
        .setOrigin(0.5);

      const sub = this.add
        .text(x + cardWidth * 0.16, y + Math.round(cardHeight * 0.12), selected ? 'EQUIPPED' : 'Tap to equip', {
          fontFamily: UI_THEME.fontFamily,
          fontSize: compact ? '14px' : '16px',
          color: selected ? '#cbf1ff' : UI_THEME.colors.textMuted,
        })
        .setOrigin(0.5);

      card.setInteractive({ useHandCursor: true });
      card.on('pointerup', () => {
        if (this.time.now < this.skinSelectInputUnlockAt) {
          return;
        }

        this.selectSkin(skin.key);
      });
      card.on('pointerover', () => card.setFillStyle(selected ? 0x4b77a9 : 0x2d4a67, 1));
      card.on('pointerout', () => card.setFillStyle(selected ? 0x385f8e : 0x203853, 1));

      this.skinSelectContainer.add([card, preview, label, sub]);
    });
  }

  ensureMenuSpaceTextures() {
    if (!this.textures.exists('menu-space-earth')) {
      const tex = this.textures.createCanvas('menu-space-earth', 420, 420);
      const ctx = tex.context;
      const cX = 210;
      const cY = 210;
      const r = 200;

      const ocean = ctx.createRadialGradient(cX - 46, cY - 62, 24, cX, cY, r);
      ocean.addColorStop(0, '#8fe4ff');
      ocean.addColorStop(0.46, '#2d8fdf');
      ocean.addColorStop(1, '#103c73');
      ctx.fillStyle = ocean;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(128, 232, 164, 0.9)';
      ctx.beginPath();
      ctx.ellipse(cX - 56, cY - 10, 74, 36, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cX + 58, cY + 46, 56, 29, 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cX + 14, cY - 76, 40, 20, -0.12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(216, 243, 255, 0.9)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.ellipse(cX - 30, cY - 80, 74, 20, -0.25, 0, Math.PI * 2);
      ctx.fill();

      tex.refresh();
    }

    if (!this.textures.exists('menu-space-moon')) {
      const tex = this.textures.createCanvas('menu-space-moon', 300, 300);
      const ctx = tex.context;
      const cX = 150;
      const cY = 150;
      const r = 136;

      const moon = ctx.createRadialGradient(cX - 22, cY - 30, 18, cX, cY, r);
      moon.addColorStop(0, '#eef6ff');
      moon.addColorStop(0.6, '#bdcbde');
      moon.addColorStop(1, '#7c8ea8');
      ctx.fillStyle = moon;
      ctx.beginPath();
      ctx.arc(cX, cY, r, 0, Math.PI * 2);
      ctx.fill();

      const craters = [
        { x: -46, y: -20, r: 20 },
        { x: 30, y: -42, r: 15 },
        { x: 50, y: 30, r: 23 },
        { x: -32, y: 54, r: 18 },
      ];

      craters.forEach((crater) => {
        ctx.fillStyle = 'rgba(101, 118, 146, 0.45)';
        ctx.beginPath();
        ctx.arc(cX + crater.x, cY + crater.y, crater.r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.strokeStyle = 'rgba(225, 237, 252, 0.84)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 4, 0, Math.PI * 2);
      ctx.stroke();

      tex.refresh();
    }

    if (!this.textures.exists('menu-space-andromeda')) {
      const tex = this.textures.createCanvas('menu-space-andromeda', 560, 300);
      const ctx = tex.context;
      const cX = 280;
      const cY = 150;

      const glow = ctx.createRadialGradient(cX, cY, 20, cX, cY, 220);
      glow.addColorStop(0, 'rgba(229, 199, 255, 0.7)');
      glow.addColorStop(0.45, 'rgba(168, 132, 255, 0.35)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 560, 300);

      for (let i = 0; i < 46; i += 1) {
        const t = i / 45;
        const alpha = 0.2 * (1 - t);
        ctx.strokeStyle = `rgba(207, 170, 255, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(cX, cY, 230 - t * 130, 88 - t * 46, -0.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      tex.refresh();
    }
  }

  createBackgroundDecor() {
    const width = this.scale.width;
    const height = this.scale.height;
    this.ensureMenuSpaceTextures();

    const halo = this.add
      .ellipse(width * 0.46, height * 0.4, width * 0.92, height * 0.66, 0x4f73d4, 0.2)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setDepth(10);
    const vignette = this.add.rectangle(width / 2, height / 2, width, height, UI_THEME.colors.overlay, 0.24).setDepth(12);
    const nebulaLeft = this.add
      .ellipse(width * 0.2, height * 0.56, width * 0.68, height * 0.46, 0x4a75d8, 0.2)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setDepth(11);
    const nebulaRight = this.add
      .ellipse(width * 0.78, height * 0.3, width * 0.52, height * 0.34, 0xb277ff, 0.16)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setDepth(11);
    const andromeda = this.add
      .image(width * 0.72, height * 0.66, 'menu-space-andromeda')
      .setDisplaySize(width * 0.42, height * 0.3)
      .setAlpha(0.62)
      .setDepth(11);

    const earth = this.add
      .image(width * 0.17, height * 0.24, 'menu-space-earth')
      .setDisplaySize(height * 0.33, height * 0.33)
      .setDepth(11);
    const moon = this.add
      .image(width * 0.82, height * 0.18, 'menu-space-moon')
      .setDisplaySize(height * 0.17, height * 0.17)
      .setDepth(11);

    this.bgDecor.push(halo, vignette, nebulaLeft, nebulaRight, andromeda, earth, moon);

    const starCount = Phaser.Math.Clamp(Math.floor((width * height) / 32000), 38, 82);
    for (let i = 0; i < starCount; i += 1) {
      const star = this.add
        .circle(
          Phaser.Math.Between(8, width - 8),
          Phaser.Math.Between(10, height - 10),
          Phaser.Math.FloatBetween(0.8, 2.5),
          i % 6 === 0 ? 0xfff6dd : 0xcce9ff,
          Phaser.Math.FloatBetween(0.2, 0.8),
        )
        .setDepth(13);
      this.bgDecor.push(star);
    }

    this.tweens.add({
      targets: [earth, moon],
      y: '-=8',
      duration: 3800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.tweens.add({
      targets: [nebulaLeft, nebulaRight],
      alpha: { from: 0.12, to: 0.24 },
      duration: 3600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.tweens.add({
      targets: andromeda,
      angle: 3,
      alpha: { from: 0.44, to: 0.72 },
      duration: 5200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.bgDecor.slice(7).forEach((star, index) => {
      this.tweens.add({
        targets: star,
        alpha: { from: 0.14, to: 0.78 },
        duration: 1100 + index * 70,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    });
  }

  refreshMeta() {
    const isMuted = this.registry.get('isMuted') ?? false;
    const skinLabel = getSkinLabel(this.registry.get('selectedSkin') ?? PLAYER_SKINS[0].key);
    this.metaText.setText(`Audio: ${isMuted ? 'OFF' : 'ON'} | ${skinLabel}`);
  }

  ensureRoadmapPlanetTextures() {
    // Always regenerate Earth so roadmap updates are visible even if an old texture key is cached.
    if (this.textures.exists('roadmap-earth')) {
      this.textures.remove('roadmap-earth');
    }

    {
      const tex = this.textures.createCanvas(
        'roadmap-earth',
        ROADMAP_EARTH_SIZE * ROADMAP_TEXTURE_SCALE,
        ROADMAP_EARTH_SIZE * ROADMAP_TEXTURE_SCALE,
      );
      const ctx = tex.context;
      const r = ROADMAP_EARTH_SIZE * 0.5;
      const cX = ROADMAP_EARTH_SIZE * 0.5;
      const cY = ROADMAP_EARTH_SIZE * 0.5;

      ctx.save();
      ctx.scale(ROADMAP_TEXTURE_SCALE, ROADMAP_TEXTURE_SCALE);

      const ocean = ctx.createRadialGradient(cX - 16, cY - 20, 8, cX, cY, r);
      ocean.addColorStop(0, '#88d6ff');
      ocean.addColorStop(0.5, '#338fda');
      ocean.addColorStop(1, '#103f70');
      ctx.fillStyle = ocean;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 3, 0, Math.PI * 2);
      ctx.fill();

      // Bigger continents for stronger "Earth" readability on roadmap.
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#7ee3a5';
      ctx.beginPath();
      ctx.ellipse(cX - 19, cY - 7, 31, 18, -0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cX + 20, cY + 11, 23, 13, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cX + 8, cY - 27, 16, 9, -0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cX - 4, cY + 14, 14, 8, 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(92, 184, 128, 0.82)';
      ctx.beginPath();
      ctx.ellipse(cX - 10, cY + 5, 14, 8, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = 'rgba(194, 238, 255, 0.9)';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(135, 202, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 10, 0.35, Math.PI * 1.82);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath();
      ctx.ellipse(cX - 10, cY - 20, 30, 8, -0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      tex.refresh();
    }

    if (!this.textures.exists('roadmap-moon')) {
      const tex = this.textures.createCanvas(
        'roadmap-moon',
        ROADMAP_MOON_SIZE * ROADMAP_TEXTURE_SCALE,
        ROADMAP_MOON_SIZE * ROADMAP_TEXTURE_SCALE,
      );
      const ctx = tex.context;
      const r = ROADMAP_MOON_SIZE * 0.5;
      const cX = ROADMAP_MOON_SIZE * 0.5;
      const cY = ROADMAP_MOON_SIZE * 0.5;

      ctx.save();
      ctx.scale(ROADMAP_TEXTURE_SCALE, ROADMAP_TEXTURE_SCALE);

      const dust = ctx.createRadialGradient(cX - 10, cY - 12, 8, cX, cY, r);
      dust.addColorStop(0, '#edf5ff');
      dust.addColorStop(0.62, '#b8c8dc');
      dust.addColorStop(1, '#7f92ab');

      ctx.fillStyle = dust;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 3, 0, Math.PI * 2);
      ctx.fill();

      const craters = [
        { x: -15, y: -7, r: 7 },
        { x: 8, y: -13, r: 5 },
        { x: 15, y: 8, r: 8 },
        { x: -8, y: 16, r: 6 },
      ];

      craters.forEach((crater) => {
        ctx.fillStyle = 'rgba(108, 126, 149, 0.45)';
        ctx.beginPath();
        ctx.arc(cX + crater.x, cY + crater.y, crater.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(223, 235, 250, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cX + crater.x, cY + crater.y, crater.r, 0.4, Math.PI * 1.7);
        ctx.stroke();
      });

      ctx.strokeStyle = 'rgba(224, 238, 255, 0.82)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
      tex.refresh();
    }

    if (!this.textures.exists('roadmap-mars')) {
      const tex = this.textures.createCanvas(
        'roadmap-mars',
        ROADMAP_MARS_SIZE * ROADMAP_TEXTURE_SCALE,
        ROADMAP_MARS_SIZE * ROADMAP_TEXTURE_SCALE,
      );
      const ctx = tex.context;
      const r = ROADMAP_MARS_SIZE * 0.5;
      const cX = ROADMAP_MARS_SIZE * 0.5;
      const cY = ROADMAP_MARS_SIZE * 0.5;

      ctx.save();
      ctx.scale(ROADMAP_TEXTURE_SCALE, ROADMAP_TEXTURE_SCALE);

      const dust = ctx.createRadialGradient(cX - 10, cY - 14, 8, cX, cY, r);
      dust.addColorStop(0, '#ffcf98');
      dust.addColorStop(0.55, '#d77943');
      dust.addColorStop(1, '#7f351e');
      ctx.fillStyle = dust;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(132, 56, 32, 0.48)';
      [
        { x: -18, y: -12, rx: 18, ry: 9, angle: -0.2 },
        { x: 20, y: 8, rx: 16, ry: 8, angle: 0.25 },
        { x: -4, y: 20, rx: 12, ry: 6, angle: 0.15 },
      ].forEach((patch) => {
        ctx.beginPath();
        ctx.ellipse(cX + patch.x, cY + patch.y, patch.rx, patch.ry, patch.angle, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = 'rgba(255, 243, 220, 0.65)';
      ctx.beginPath();
      ctx.ellipse(cX, cY - 34, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cX, cY + 34, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 214, 188, 0.78)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
      tex.refresh();
    }

    if (!this.textures.exists('roadmap-void')) {
      const tex = this.textures.createCanvas(
        'roadmap-void',
        ROADMAP_VOID_SIZE * ROADMAP_TEXTURE_SCALE,
        ROADMAP_VOID_SIZE * ROADMAP_TEXTURE_SCALE,
      );
      const ctx = tex.context;
      const r = ROADMAP_VOID_SIZE * 0.5;
      const cX = ROADMAP_VOID_SIZE * 0.5;
      const cY = ROADMAP_VOID_SIZE * 0.5;

      ctx.save();
      ctx.scale(ROADMAP_TEXTURE_SCALE, ROADMAP_TEXTURE_SCALE);

      const core = ctx.createRadialGradient(cX - 8, cY - 10, 8, cX, cY, r);
      core.addColorStop(0, '#c5b6ff');
      core.addColorStop(0.5, '#704ed4');
      core.addColorStop(1, '#24134f');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 3, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 4; i += 1) {
        const t = i / 3;
        ctx.strokeStyle = `rgba(164, 208, 255, ${(0.45 - t * 0.1).toFixed(3)})`;
        ctx.lineWidth = 2 - t * 0.35;
        ctx.beginPath();
        ctx.ellipse(cX, cY, 16 + i * 8, 8 + i * 5, -0.32 + i * 0.08, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(156, 245, 255, 0.5)';
      ctx.beginPath();
      ctx.ellipse(cX - 12, cY - 16, 10, 4, -0.24, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(220, 210, 255, 0.82)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cX, cY, r - 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
      tex.refresh();
    }
  }

  buildLevelSelect() {
    this.levelSelectContainer.removeAll(true);

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const unlockedStage = clampStageIndex(this.registry.get('unlockedLevel') ?? 0);
    const currentStage = clampStageIndex(this.registry.get('currentLevel') ?? 0);
    const panelWidth = Math.min(this.scale.width - 52, 1060);
    const panelHeight = Math.min(this.scale.height - 56, 610);
    const compact = panelWidth < 860;
    const tiny = panelWidth < 700;
    const routeScale = Math.min(panelWidth / 1220, panelHeight / 720) * 0.9;

    const dimmer = this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.52).setInteractive();
    const panel = createPanel(this, {
      x: centerX,
      y: centerY,
      width: panelWidth,
      height: panelHeight,
    }).container;

    const title = this.add
      .text(centerX, centerY - panelHeight / 2 + 44, 'Mission Roadmap', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: tiny ? '23px' : '29px',
        color: UI_THEME.colors.textPrimary,
      })
      .setOrigin(0.5);

    const closeButton = createButton(this, {
      x: centerX + panelWidth / 2 - 46,
      y: centerY - panelHeight / 2 + 44,
      width: 46,
      height: 34,
      icon: 'close',
      onClick: () => this.toggleLevelSelect(false),
    }).container;

    this.levelSelectContainer.add([dimmer, panel, title, closeButton]);

    this.ensureRoadmapPlanetTextures();

    const orbitWidth = panelWidth * (tiny ? 0.24 : 0.27);
    const orbitHeight = panelHeight * (tiny ? 0.2 : 0.21);
    const clusterSpread = tiny ? 0.72 : 0.82;
    const worldCenters = [
      { x: centerX - orbitWidth, y: centerY - orbitHeight + 12 * routeScale },
      { x: centerX + orbitWidth, y: centerY - orbitHeight - 8 * routeScale },
      { x: centerX - orbitWidth * 0.92, y: centerY + orbitHeight + 14 * routeScale },
      { x: centerX + orbitWidth * 0.94, y: centerY + orbitHeight + 4 * routeScale },
    ];

    // Each planet starts from a different orbital angle to avoid repeating the same node direction.
    const worldOrbitConfigs = [
      { startDeg: 190, stepDeg: 26 }, // Earth starts from left.
      { startDeg: -38, stepDeg: 27 }, // Moon starts from top-right.
      { startDeg: 132, stepDeg: -25 }, // Mars starts upper-left and rotates opposite direction.
      { startDeg: 34, stepDeg: 28 }, // Singularity starts right/top-right.
    ];
    const orbitSpacingMultiplier = tiny ? 1.14 : 1.2;

    const planetVisuals = {
      earth: { key: 'roadmap-earth', size: ROADMAP_EARTH_SIZE * 0.58 * routeScale },
      moon: { key: 'roadmap-moon', size: ROADMAP_MOON_DISPLAY_SIZE * 0.92 * routeScale },
      mars: { key: 'roadmap-mars', size: ROADMAP_MARS_SIZE * 0.5 * routeScale },
      singularity: { key: 'roadmap-void', size: ROADMAP_VOID_SIZE * 0.52 * routeScale },
    };

    const mapPoints = new Array(LEVELS.length);

    ROADMAP_WORLDS.forEach((world, worldIndex) => {
      const center = worldCenters[worldIndex] || { x: centerX, y: centerY };
      const visual = planetVisuals[world.key] || planetVisuals.singularity;
      const orbitConfig = worldOrbitConfigs[worldIndex % worldOrbitConfigs.length];
      const orbitRadiusX = (visual.size * 0.58 + (tiny ? 44 : 54) * routeScale) * clusterSpread * orbitSpacingMultiplier;
      const orbitRadiusY = (visual.size * 0.5 + (tiny ? 34 : 46) * routeScale) * clusterSpread * orbitSpacingMultiplier;

      const aura = this.add
        .ellipse(center.x, center.y, Math.max(100, visual.size + 78), Math.max(70, visual.size + 42), world.color, 0.14)
        .setDepth(177);
      const planet = this.add.image(center.x, center.y, visual.key).setDepth(178).setDisplaySize(visual.size, visual.size);
      const worldLabel = this.add
        .text(center.x, center.y + visual.size * 0.65 + (tiny ? 4 : 8), world.name, {
          fontFamily: UI_THEME.fontFamily,
          fontSize: tiny ? '11px' : '13px',
          color: '#d3eaff',
        })
        .setOrigin(0.5)
        .setDepth(179);

      this.levelSelectContainer.add([aura, planet, worldLabel]);

      const startIndex = Phaser.Math.Clamp(world.startLevel - 1, 0, LEVELS.length - 1);
      const endIndex = Phaser.Math.Clamp(startIndex + world.count - 1, 0, LEVELS.length - 1);
      for (let stage = startIndex; stage <= endIndex; stage += 1) {
        const localIndex = stage - startIndex;
        const angle = Phaser.Math.DegToRad(orbitConfig.startDeg + localIndex * orbitConfig.stepDeg);
        const wobble = Math.sin(localIndex * 1.26 + worldIndex * 0.82) * 9 * routeScale;
        mapPoints[stage] = {
          x: center.x + Math.cos(angle) * (orbitRadiusX + wobble * 0.4),
          y: center.y + Math.sin(angle) * (orbitRadiusY + wobble * 0.28),
        };
      }
    });

    for (let i = 0; i < mapPoints.length; i += 1) {
      if (!mapPoints[i]) {
        mapPoints[i] = {
          x: centerX + ((i % LEVELS_PER_WORLD) - 2) * 70 * routeScale,
          y: centerY + (Math.floor(i / LEVELS_PER_WORLD) - 1.5) * 62 * routeScale,
        };
      }
    }

    const canonicalStageTotal = ROADMAP_WORLDS.length * LEVELS_PER_WORLD;
    if (mapPoints.length > canonicalStageTotal) {
      const testStageIndex = mapPoints.length - 1;
      mapPoints[testStageIndex] = {
        x: centerX,
        y: centerY + (tiny ? 16 : 10) * routeScale,
      };
    }

    const worldRanges = ROADMAP_WORLDS.map((world, worldIndex) => {
      const startIndex = Phaser.Math.Clamp(world.startLevel - 1, 0, LEVELS.length - 1);
      const endIndex = Phaser.Math.Clamp(startIndex + world.count - 1, 0, LEVELS.length - 1);
      return { worldIndex, startIndex, endIndex };
    });
    const drawRouteSegments = (graphics, maxStage) => {
      worldRanges.forEach((range, rangeIndex) => {
        const segmentEnd = Math.min(range.endIndex, maxStage);
        if (segmentEnd < range.startIndex) {
          return;
        }

        graphics.beginPath();
        graphics.moveTo(mapPoints[range.startIndex].x, mapPoints[range.startIndex].y);
        for (let stage = range.startIndex + 1; stage <= segmentEnd; stage += 1) {
          graphics.lineTo(mapPoints[stage].x, mapPoints[stage].y);
        }
        graphics.strokePath();

        const nextRange = worldRanges[rangeIndex + 1];
        if (!nextRange || maxStage < nextRange.startIndex || segmentEnd < range.endIndex) {
          return;
        }

        const from = mapPoints[range.endIndex];
        const to = mapPoints[nextRange.startIndex];
        graphics.beginPath();
        graphics.moveTo(from.x, from.y);

        if (rangeIndex === 1) {
          // Moon -> Mars: route through the center corridor to avoid crossing level nodes.
          const corridorY = centerY + panelHeight * 0.02;
          const wp1 = {
            x: from.x + 34 * routeScale,
            y: from.y + 8 * routeScale,
          };
          const wp2 = {
            x: centerX + panelWidth * 0.18,
            y: corridorY,
          };
          const wp3 = {
            x: centerX - panelWidth * 0.2,
            y: corridorY + 2 * routeScale,
          };
          const wp4 = {
            x: to.x - 34 * routeScale,
            y: to.y - 10 * routeScale,
          };

          graphics.lineTo(wp1.x, wp1.y);
          graphics.lineTo(wp2.x, wp2.y);
          graphics.lineTo(wp3.x, wp3.y);
          graphics.lineTo(wp4.x, wp4.y);
          graphics.lineTo(to.x, to.y);
        } else {
          // Other world transitions keep a direct single-line connector.
          graphics.lineTo(to.x, to.y);
        }

        graphics.strokePath();
      });

      const lastWorldEnd = worldRanges.length ? worldRanges[worldRanges.length - 1].endIndex : -1;
      if (lastWorldEnd >= 0 && maxStage > lastWorldEnd) {
        graphics.beginPath();
        graphics.moveTo(mapPoints[lastWorldEnd].x, mapPoints[lastWorldEnd].y);
        for (let stage = lastWorldEnd + 1; stage <= maxStage; stage += 1) {
          graphics.lineTo(mapPoints[stage].x, mapPoints[stage].y);
        }
        graphics.strokePath();
      }
    };

    const fullStageLimit = Math.max(0, mapPoints.length - 1);
    const visibleStageLimit = Math.max(0, Math.min(unlockedStage, fullStageLimit));

    const routeFuture = this.add.graphics().setDepth(177);
    routeFuture.lineStyle(1.8, 0x3d5370, 0.46);
    drawRouteSegments(routeFuture, fullStageLimit);

    const routeBaseGlow = this.add.graphics().setDepth(178);
    routeBaseGlow.lineStyle(tiny ? 4.2 : 5.2, 0x5f9ed7, 0.16);
    drawRouteSegments(routeBaseGlow, visibleStageLimit);

    const routeBase = this.add.graphics().setDepth(178);
    routeBase.lineStyle(2.3, 0x365171, 0.92);
    drawRouteSegments(routeBase, visibleStageLimit);

    const routeUnlocked = this.add.graphics().setDepth(179);
    routeUnlocked.lineStyle(2.7, 0x71dcff, 0.85);
    drawRouteSegments(routeUnlocked, visibleStageLimit);

    this.levelSelectContainer.add([routeFuture, routeBaseGlow, routeBase, routeUnlocked]);

    const allowAllStageSelection = true;

    LEVELS.forEach((level, levelIndex) => {
      const stageIndex = levelIndex;
      const isUnlocked = stageIndex <= unlockedStage;
      const isDiscovered = allowAllStageSelection || isUnlocked;
      const isSelectable = allowAllStageSelection || isUnlocked;
      const isCompleted = stageIndex < unlockedStage;
      const isCurrent = stageIndex === currentStage;
      const point = mapPoints[levelIndex];

      const radius = tiny ? 11 : 13;

      if (!isDiscovered) {
        const fogBase = this.add
          .ellipse(point.x, point.y, radius * 3.25, radius * 2.3, 0x4d617c, 0.46)
          .setStrokeStyle(1.2, 0xaec8e2, 0.25);
        const fogSheen = this.add.ellipse(point.x + radius * 0.22, point.y - radius * 0.18, radius * 2.5, radius * 1.54, 0xd9eaff, 0.1);
        const fogHint = this.add
          .text(point.x, point.y + 0.2, '?', {
            fontFamily: UI_THEME.fontFamily,
            fontSize: tiny ? '13px' : '15px',
            color: '#d9e8f7',
          })
          .setOrigin(0.5)
          .setAlpha(0.8);

        this.levelSelectContainer.add([fogBase, fogSheen, fogHint]);
        return;
      }

      let fill = 0x1f2f45;
      let stroke = 0x566a84;
      let textColor = '#8393a6';
      let glowAlpha = 0.16;

      if (isUnlocked) {
        fill = 0x23568e;
        stroke = 0x8ed0ff;
        textColor = '#ecf7ff';
        glowAlpha = 0.26;
      }
      if (isCompleted) {
        fill = 0x216a55;
        stroke = 0x95e2c1;
        textColor = '#f0fff8';
        glowAlpha = 0.3;
      }
      if (isCurrent) {
        fill = 0xc98532;
        stroke = 0xffd18f;
        textColor = '#fff8eb';
        glowAlpha = 0.42;
      }

      const glow = this.add.circle(point.x, point.y, radius + (tiny ? 7 : 10), stroke, glowAlpha);
      const clickTarget = this.add
        .circle(point.x, point.y, radius + (tiny ? 10 : 13), 0x000000, 0.001)
        .setDepth(1);
      const node = this.add
        .circle(point.x, point.y, radius, fill, 1)
        .setStrokeStyle(2.2, stroke, 1);
      const nodeText = this.add
        .text(point.x, point.y, String(level.id), {
          fontFamily: UI_THEME.fontFamily,
          fontSize: tiny ? '12px' : '14px',
          color: textColor,
        })
        .setOrigin(0.5);
      const levelLabel = !tiny
        ? this.add
            .text(point.x, point.y + 24, compact && level.name.length > 12 ? `${level.name.slice(0, 11)}…` : level.name, {
              fontFamily: UI_THEME.fontFamily,
              fontSize: compact ? '10px' : '11px',
              color: isUnlocked ? '#d4ebff' : '#70829a',
            })
            .setOrigin(0.5)
        : null;

      if (isSelectable) {
        clickTarget.setInteractive({ useHandCursor: true });
        clickTarget.on('pointerup', () => this.startLevel(stageIndex));
        clickTarget.on('pointerover', () => {
          node.setScale(1.14);
          glow.setAlpha(Math.min(glow.alpha + 0.2, 0.7));
        });
        clickTarget.on('pointerout', () => {
          node.setScale(1);
          glow.setAlpha(glowAlpha);
        });
      }

      if (levelLabel) {
        this.levelSelectContainer.add([glow, clickTarget, node, nodeText, levelLabel]);
      } else {
        this.levelSelectContainer.add([glow, clickTarget, node, nodeText]);
      }
    });
  }

  toggleLevelSelect(forceValue) {
    const visible = forceValue ?? !this.levelSelectContainer.visible;
    if (visible) {
      this.toggleSkinSelect(false);
      this.toggleSettingsPopup(false);
    }

    this.levelSelectContainer.setVisible(visible);
    this.setMainMenuVisible(!visible);

    if (visible) {
      this.levelSelectContainer.setAlpha(0);
      this.levelSelectContainer.setY(12);
      this.tweens.add({
        targets: this.levelSelectContainer,
        alpha: 1,
        y: 0,
        duration: 180,
        ease: 'Cubic.Out',
      });
    }
  }

  toggleSkinSelect(forceValue) {
    const visible = forceValue ?? !this.skinSelectContainer.visible;
    if (visible) {
      this.toggleLevelSelect(false);
      this.toggleSettingsPopup(false);
    }

    this.skinSelectContainer.setVisible(visible);
    this.setMainMenuVisible(!visible);

    if (visible) {
      this.skinSelectInputUnlockAt = this.time.now + SKIN_SELECT_INPUT_GUARD_MS;
      this.skinSelectContainer.setAlpha(0);
      this.skinSelectContainer.setY(12);
      this.tweens.add({
        targets: this.skinSelectContainer,
        alpha: 1,
        y: 0,
        duration: 180,
        ease: 'Cubic.Out',
      });
    }
  }

  setMainMenuVisible(visible) {
    this.menuTitleText?.setVisible(visible);
    this.menuSubtitleText?.setVisible(visible);
    this.mainPanel?.setVisible(visible);
    this.metaText?.setVisible(visible);
    this.skinPreviewPanel?.setVisible(visible);
    this.skinPreviewTitle?.setVisible(visible);
    this.skinPreview?.setVisible(visible);
    this.skinNameText?.setVisible(visible);

    this.playButton?.container.setVisible(visible);
    this.mapButton?.container.setVisible(visible);
    this.skinButton?.container.setVisible(visible);
    this.settingsButton?.container.setVisible(visible);

    if (!visible) {
      this.settingsPopup?.setVisible(false);
    }
  }

  handleResetProgress() {
    resetProgress();
    this.registry.set('unlockedLevel', 0);
    this.registry.set('currentLevel', 0);
    this.buildLevelSelect();
    this.refreshMeta();
    this.showToast('Progress reset');
  }

  showToast(message) {
    const toast = this.add
      .text(this.scale.width / 2, this.scale.height - 36, message, {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '14px',
        color: UI_THEME.colors.textPrimary,
        backgroundColor: '#22415f',
        padding: { left: 10, right: 10, top: 6, bottom: 6 },
      })
      .setOrigin(0.5)
      .setDepth(250);

    this.tweens.add({
      targets: toast,
      y: toast.y - 12,
      alpha: 0,
      duration: 420,
      delay: 700,
      ease: 'Quad.Out',
      onComplete: () => toast.destroy(),
    });
  }

  startLevel(stageIndex) {
    if (this.isTransitioning) {
      return;
    }

    this.isTransitioning = true;
    this.registry.set('currentLevel', stageIndex);

    this.cameras.main.fadeOut(180, 8, 12, 20);

    this.time.delayedCall(190, () => {
      this.scene.start(SCENE_KEYS.LEVEL, { stageIndex });
    });
  }

  onResize() {
    this.scene.restart();
  }
}
