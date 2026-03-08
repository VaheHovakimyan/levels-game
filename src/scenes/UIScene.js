import Phaser from 'phaser';
import { GAME_EVENTS, SCENE_KEYS } from '../utils/constants';
import { createButton, createPanel, popIn } from '../ui/UiFactory';
import { UI_THEME } from '../ui/theme';

export class UIScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.UI);

    this.topBar = null;
    this.levelText = null;
    this.levelNameText = null;
    this.deathsText = null;
    this.runDeathsText = null;
    this.skinText = null;

    this.pauseButton = null;
    this.muteButton = null;
    this.pauseSkinButton = null;

    this.messageText = null;
    this.introBanner = null;
    this.introBannerBaseY = 0;

    this.pausePanel = null;
    this.completePanel = null;
    this.finalPanel = null;
    this.deathFlash = null;

    this.completePanelTitle = null;
    this.completePanelStats = null;
    this.nextLevelButton = null;

    this.latestUiState = null;
  }

  create() {
    this.cameras.main.setZoom(1);
    this.createHud();
    this.createOverlays();

    this.game.events.on(GAME_EVENTS.UI_UPDATE, this.onUiUpdate, this);
    this.game.events.on(GAME_EVENTS.UI_LEVEL_COMPLETE, this.onLevelComplete, this);
    this.game.events.on(GAME_EVENTS.UI_HIDE_LEVEL_COMPLETE, this.hideLevelPanels, this);
    this.game.events.on(GAME_EVENTS.UI_MESSAGE, this.showMessage, this);
    this.game.events.on(GAME_EVENTS.UI_DEATH_FEEDBACK, this.showDeathFeedback, this);
    this.game.events.on(GAME_EVENTS.UI_LEVEL_INTRO, this.showLevelIntro, this);
    this.game.events.on(GAME_EVENTS.UI_GAME_COMPLETE, this.showGameComplete, this);

    this.scale.on('resize', this.layoutUi, this);
    this.layoutUi();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(GAME_EVENTS.UI_UPDATE, this.onUiUpdate, this);
      this.game.events.off(GAME_EVENTS.UI_LEVEL_COMPLETE, this.onLevelComplete, this);
      this.game.events.off(GAME_EVENTS.UI_HIDE_LEVEL_COMPLETE, this.hideLevelPanels, this);
      this.game.events.off(GAME_EVENTS.UI_MESSAGE, this.showMessage, this);
      this.game.events.off(GAME_EVENTS.UI_DEATH_FEEDBACK, this.showDeathFeedback, this);
      this.game.events.off(GAME_EVENTS.UI_LEVEL_INTRO, this.showLevelIntro, this);
      this.game.events.off(GAME_EVENTS.UI_GAME_COMPLETE, this.showGameComplete, this);
      this.scale.off('resize', this.layoutUi, this);
    });
  }

  createHud() {
    // Sector/run stat bar removed by request.
    this.topBar = this.add.container(0, 0).setDepth(2000).setScrollFactor(0).setVisible(false);

    this.pauseButton = createButton(this, {
      x: 0,
      y: 0,
      width: 92,
      height: 34,
      label: 'Pause',
      icon: 'pause',
      fontSize: '14px',
      depth: 2002,
      scrollFactor: 0,
      onClick: () => this.callLevelScene('togglePause'),
    });

    const restartButton = createButton(this, {
      x: 0,
      y: 0,
      width: 98,
      height: 34,
      label: 'Restart',
      icon: 'restart',
      fontSize: '14px',
      depth: 2002,
      scrollFactor: 0,
      onClick: () => this.callLevelScene('restartLevel'),
    });

    this.messageText = this.add
      .text(this.scale.width / 2, 70, '', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '15px',
        color: UI_THEME.colors.textPrimary,
        backgroundColor: '#1b3658',
        padding: { left: 10, right: 10, top: 6, bottom: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2003)
      .setAlpha(0);

    this.hudButtons = [restartButton, this.pauseButton];
  }

  createOverlays() {
    this.deathFlash = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, UI_THEME.colors.danger, 0.25)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(2100)
      .setAlpha(0);

    this.introBannerBaseY = this.scale.height * 0.22;
    this.introBanner = this.add
      .text(this.scale.width / 2, this.introBannerBaseY, '', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '30px',
        color: UI_THEME.colors.textPrimary,
        backgroundColor: '#173153',
        padding: { left: 14, right: 14, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2150)
      .setAlpha(0);

    this.pausePanel = this.createPausePanel();
    this.completePanel = this.createCompletePanel();
    this.finalPanel = this.createFinalPanel();

    this.hideLevelPanels();
  }

  createPausePanel() {
    const panel = this.add.container(this.scale.width / 2, this.scale.height / 2).setScrollFactor(0).setDepth(2200);
    const base = createPanel(this, {
      x: 0,
      y: 0,
      width: 350,
      height: 290,
    }).container;

    const title = this.add
      .text(0, -108, 'PAUSED', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '28px',
        color: UI_THEME.colors.textPrimary,
      })
      .setOrigin(0.5);

    this.muteButton = createButton(this, {
      x: 0,
      y: 74,
      width: 190,
      height: 34,
      label: 'Mute / Unmute',
      icon: 'sound-on',
      onClick: () => {
        this.callLevelScene('toggleMute');
      },
    });

    this.pauseSkinButton = createButton(this, {
      x: 0,
      y: 30,
      width: 190,
      height: 34,
      label: 'Suit Bay',
      icon: 'skin',
      onClick: () => this.callLevelScene('goToMenu'),
    });

    const resumeButton = createButton(this, {
      x: 0,
      y: -58,
      width: 190,
      height: 36,
      label: 'Resume',
      icon: 'play',
      onClick: () => this.callLevelScene('togglePause'),
    });

    const retryButton = createButton(this, {
      x: 0,
      y: -14,
      width: 190,
      height: 36,
      label: 'Restart',
      icon: 'restart',
      onClick: () => this.callLevelScene('restartLevel'),
    });

    const menuButton = createButton(this, {
      x: 0,
      y: 118,
      width: 190,
      height: 34,
      label: 'Menu',
      icon: 'home',
      variant: 'alt',
      onClick: () => this.callLevelScene('goToMenu'),
    });

    panel.add([
      base,
      title,
      resumeButton.container,
      retryButton.container,
      this.pauseSkinButton.container,
      this.muteButton.container,
      menuButton.container,
    ]);

    panel.setVisible(false);
    return panel;
  }

  createCompletePanel() {
    const panel = this.add.container(this.scale.width / 2, this.scale.height / 2).setScrollFactor(0).setDepth(2230);
    const base = createPanel(this, {
      x: 0,
      y: 0,
      width: 390,
      height: 280,
    }).container;

    this.completePanelTitle = this.add
      .text(0, -100, 'MISSION CLEARED', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '27px',
        color: '#f2ffda',
      })
      .setOrigin(0.5);

    this.completePanelStats = this.add
      .text(0, -56, 'Great recovery.', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '14px',
        color: UI_THEME.colors.textSecondary,
        align: 'center',
      })
      .setOrigin(0.5);

    this.nextLevelButton = createButton(this, {
      x: 0,
      y: 16,
      width: 190,
      height: 38,
      label: 'Next Level',
      icon: 'next',
      onClick: () => this.callLevelScene('goToNextLevel'),
    });

    const retryButton = createButton(this, {
      x: 0,
      y: 60,
      width: 190,
      height: 34,
      label: 'Retry',
      icon: 'restart',
      onClick: () => this.callLevelScene('restartLevel'),
    });

    const menuButton = createButton(this, {
      x: 0,
      y: 104,
      width: 190,
      height: 34,
      label: 'Menu',
      icon: 'home',
      variant: 'alt',
      onClick: () => this.callLevelScene('goToMenu'),
    });

    panel.add([
      base,
      this.completePanelTitle,
      this.completePanelStats,
      this.nextLevelButton.container,
      retryButton.container,
      menuButton.container,
    ]);

    panel.setVisible(false);
    return panel;
  }

  createFinalPanel() {
    const panel = this.add.container(this.scale.width / 2, this.scale.height / 2).setScrollFactor(0).setDepth(2240);
    const base = createPanel(this, {
      x: 0,
      y: 0,
      width: 420,
      height: 260,
    }).container;

    const title = this.add
      .text(0, -86, 'MISSION COMPLETE', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '30px',
        color: '#b7ffd6',
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(0, -42, 'You escaped the alien station.', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '15px',
        color: UI_THEME.colors.textSecondary,
      })
      .setOrigin(0.5);

    this.finalStatsText = this.add
      .text(0, -16, '', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '13px',
        color: UI_THEME.colors.textMuted,
      })
      .setOrigin(0.5);

    const replayButton = createButton(this, {
      x: 0,
      y: 30,
      width: 200,
      height: 36,
      label: 'Replay Sector 1',
      icon: 'restart',
      onClick: () => this.callLevelScene('goToLevel', 0),
    });

    const menuButton = createButton(this, {
      x: 0,
      y: 76,
      width: 200,
      height: 34,
      label: 'Back to Menu',
      icon: 'home',
      variant: 'alt',
      onClick: () => this.callLevelScene('goToMenu'),
    });

    panel.add([base, title, subtitle, this.finalStatsText, replayButton.container, menuButton.container]);
    panel.setVisible(false);

    return panel;
  }

  layoutUi() {
    const width = this.scale.width;
    const height = this.scale.height;
    const rightMargin = Math.round(width * 0.02);
    const topY = Math.round(height * 0.053);

    this.hudButtons[1].container.setPosition(width - rightMargin - 46, topY);
    this.hudButtons[0].container.setPosition(width - rightMargin - 146, topY);

    this.messageText.setPosition(width / 2, Math.round(height * 0.106));
    this.introBannerBaseY = height * 0.22;
    this.introBanner.setPosition(width / 2, this.introBannerBaseY);

    this.pausePanel.setPosition(width / 2, height / 2);
    this.completePanel.setPosition(width / 2, height / 2);
    this.finalPanel.setPosition(width / 2, height / 2);

    this.deathFlash.setSize(width, height);
  }

  onUiUpdate(state) {
    this.latestUiState = state;
    this.pauseButton.setIcon(state.paused ? 'play' : 'pause');
    this.muteButton?.setIcon(state.muted ? 'sound-off' : 'sound-on');
    this.pauseSkinButton?.setIcon('skin');

    if (state.paused) {
      this.showPausePanel();
    } else {
      this.hidePausePanel();
    }
  }

  showPausePanel() {
    if (this.pausePanel.visible) {
      return;
    }

    this.pausePanel.setVisible(true);
    popIn(this, this.pausePanel);
  }

  hidePausePanel() {
    this.pausePanel.setVisible(false);
  }

  onLevelComplete({ isFinalLevel, level, levelName, totalLevels }) {
    if (isFinalLevel) {
      return;
    }

    this.completePanelTitle.setText(`MISSION ${level} CLEARED`);
    this.completePanelStats.setText(`${levelName || `Mission ${level}`}\nProgress: ${level}/${totalLevels}`);

    this.completePanel.setVisible(true);
    this.pausePanel.setVisible(false);
    popIn(this, this.completePanel);
    this.celebrateBurst();
  }

  showGameComplete({ deaths }) {
    this.finalStatsText.setText(`Total losses: ${deaths}`);
    this.finalPanel.setVisible(true);
    this.completePanel.setVisible(false);
    this.pausePanel.setVisible(false);
    popIn(this, this.finalPanel);
    this.celebrateBurst();
  }

  hideLevelPanels() {
    this.completePanel?.setVisible(false);
    this.finalPanel?.setVisible(false);
    this.pausePanel?.setVisible(false);
  }

  showMessage({ text }) {
    this.messageText.setText(text);
    this.messageText.setAlpha(1);
    const baseY = Math.round(this.scale.height * 0.106);

    this.tweens.killTweensOf(this.messageText);
    this.tweens.add({
      targets: this.messageText,
      y: baseY - 4,
      alpha: 0,
      delay: 1700,
      duration: 300,
      ease: 'Quad.Out',
      onStart: () => this.messageText.setY(baseY),
    });
  }

  showLevelIntro({ level, totalLevels, worldName, levelName, modifiers }) {
    const tags = [];
    if (modifiers?.reverseControls) {
      tags.push('REVERSED');
    }
    if (modifiers?.highJump) {
      tags.push('HIGH JUMP');
    }

    const extra = tags.length ? ` [${tags.join(' + ')}]` : '';
    const worldPrefix = worldName ? `${worldName} | ` : '';
    this.introBanner.setText(`${worldPrefix}MISSION ${level}/${totalLevels}: ${levelName}${extra}`);
    this.introBanner.setAlpha(0);
    this.introBanner.setY(this.introBannerBaseY + 8);

    this.tweens.killTweensOf(this.introBanner);
    this.tweens.add({
      targets: this.introBanner,
      alpha: 1,
      y: this.introBannerBaseY,
      duration: 180,
      ease: 'Cubic.Out',
    });

    this.tweens.add({
      targets: this.introBanner,
      alpha: 0,
      delay: 1000,
      duration: 250,
      ease: 'Quad.In',
    });
  }

  showDeathFeedback() {
    this.deathFlash.setAlpha(0.24);

    this.tweens.killTweensOf(this.deathFlash);
    this.tweens.add({
      targets: this.deathFlash,
      alpha: 0,
      duration: 180,
      ease: 'Quad.Out',
    });
  }

  celebrateBurst() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2 - 26;

    for (let i = 0; i < 18; i += 1) {
      const conf = this.add
        .rectangle(centerX, centerY, 4, 10, i % 2 === 0 ? UI_THEME.colors.accent : UI_THEME.colors.accentAlt, 1)
        .setScrollFactor(0)
        .setDepth(2260);

      const angle = Phaser.Math.DegToRad((360 / 18) * i + Phaser.Math.Between(-7, 7));
      const distance = Phaser.Math.Between(30, 84);

      this.tweens.add({
        targets: conf,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        angle: Phaser.Math.Between(-40, 40),
        alpha: 0,
        duration: Phaser.Math.Between(240, 360),
        ease: 'Quad.Out',
        onComplete: () => conf.destroy(),
      });
    }
  }

  callLevelScene(method, ...args) {
    if (!this.scene.isActive(SCENE_KEYS.LEVEL)) {
      return;
    }

    const levelScene = this.scene.get(SCENE_KEYS.LEVEL);
    if (levelScene && typeof levelScene[method] === 'function') {
      levelScene[method](...args);
    }
  }
}
