import { UI_THEME } from './theme';
import { applyTextSmoothing } from './text';

function drawRoundedRect(graphics, x, y, width, height, radius, color, alpha = 1, strokeColor = null, strokeAlpha = 1) {
  graphics.fillStyle(color, alpha);
  graphics.fillRoundedRect(x, y, width, height, radius);

  if (strokeColor !== null) {
    graphics.lineStyle(1.6, strokeColor, strokeAlpha);
    graphics.strokeRoundedRect(x, y, width, height, radius);
  }
}

function renderPanel(bg, width, height) {
  bg.clear();

  // Holographic panel shell.
  drawRoundedRect(
    bg,
    -width / 2,
    -height / 2,
    width,
    height,
    18,
    UI_THEME.colors.panelDark,
    0.92,
    UI_THEME.colors.panelLight,
    0.68,
  );

  drawRoundedRect(bg, -width / 2 + 6, -height / 2 + 8, width - 12, 24, 12, 0xffffff, 0.1);
  drawRoundedRect(bg, -width / 2 + 10, height / 2 - 34, width - 20, 24, 12, 0x256fbe, 0.22);
  drawRoundedRect(bg, -width / 2 + 16, 0, width - 32, 2, 1, UI_THEME.colors.accent, 0.22);
}

export function createPanel(scene, config) {
  const width = config.width;
  const height = config.height;
  const container = scene.add.container(config.x, config.y);

  const shadow = scene.add.graphics();
  drawRoundedRect(shadow, -width / 2 + 4, -height / 2 + 7, width, height, 18, UI_THEME.shadowColor, 0.46);

  const bg = scene.add.graphics();
  renderPanel(bg, width, height);

  const topBand = scene.add.graphics();
  drawRoundedRect(topBand, -width / 2 + 12, -height / 2 + 12, width - 24, 14, 9, 0xffffff, 0.06);

  container.add([shadow, bg, topBand]);

  if (config.depth !== undefined) {
    container.setDepth(config.depth);
  }

  if (config.scrollFactor !== undefined) {
    container.setScrollFactor(config.scrollFactor);
  }

  return { container, shadow, bg, topBand };
}

function renderButtonVisual(bg, width, height, fillColor, pressed = false) {
  bg.clear();
  const radius = 14;
  const yShift = pressed ? 1 : 0;

  drawRoundedRect(
    bg,
    -width / 2,
    -height / 2 + yShift,
    width,
    height,
    radius,
    fillColor,
    1,
    UI_THEME.colors.panelLight,
    0.7,
  );

  drawRoundedRect(bg, -width / 2 + 4, -height / 2 + 4 + yShift, width - 8, 11, 10, 0xffffff, 0.2);
  drawRoundedRect(bg, -width / 2 + 7, height / 2 - 7 + yShift, width - 14, 2, 1, UI_THEME.colors.accent, 0.38);
}

function drawButtonIcon(graphics, iconKey, color) {
  graphics.clear();
  if (!iconKey) {
    return;
  }

  graphics.lineStyle(2.3, color, 1);
  graphics.fillStyle(color, 1);

  switch (iconKey) {
    case 'play':
      graphics.fillTriangle(-6, -8, -6, 8, 8, 0);
      break;
    case 'pause':
      graphics.fillRect(-7, -8, 4, 16);
      graphics.fillRect(3, -8, 4, 16);
      break;
    case 'restart':
      graphics.lineStyle(1.5, color, 0.26);
      graphics.strokeCircle(0, 0, 8.8);

      graphics.lineStyle(2.8, color, 0.98);
      graphics.beginPath();
      graphics.arc(0, 0, 6.8, Math.PI * 0.94, Math.PI * 2.08, false);
      graphics.strokePath();

      graphics.fillStyle(color, 0.98);
      graphics.fillTriangle(8.2, -0.2, 12.1, -3.4, 11.3, 1.2);

      graphics.fillStyle(color, 0.28);
      graphics.fillCircle(0, 0, 1.2);
      break;
    case 'roadmap':
      graphics.beginPath();
      graphics.moveTo(-10, 0);
      graphics.lineTo(0, -4);
      graphics.lineTo(10, 5);
      graphics.strokePath();
      graphics.fillCircle(-10, 0, 2.8);
      graphics.fillCircle(0, -4, 2.8);
      graphics.fillCircle(10, 5, 2.8);
      break;
    case 'skin':
      graphics.strokeCircle(0, -5, 4);
      graphics.strokeRoundedRect(-6, 1, 12, 9, 2);
      break;
    case 'reset':
      graphics.strokeRect(-5, -5, 10, 12);
      graphics.fillRect(-7, -8, 14, 2);
      graphics.beginPath();
      graphics.moveTo(-2, -10);
      graphics.lineTo(2, -10);
      graphics.strokePath();
      break;
    case 'settings':
      graphics.lineStyle(2.1, color, 0.95);
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8;
        const x1 = Math.cos(angle) * 6.2;
        const y1 = Math.sin(angle) * 6.2;
        const x2 = Math.cos(angle) * 9.2;
        const y2 = Math.sin(angle) * 9.2;
        graphics.beginPath();
        graphics.moveTo(x1, y1);
        graphics.lineTo(x2, y2);
        graphics.strokePath();
      }
      graphics.fillStyle(color, 0.98);
      graphics.fillCircle(0, 0, 6);
      graphics.fillStyle(0x1f69bb, 1);
      graphics.fillCircle(0, 0, 2.6);
      break;
    case 'sound-on':
      graphics.fillStyle(color, 0.98);
      graphics.fillRoundedRect(-10.5, -4.4, 4.8, 8.8, 1.6);
      graphics.beginPath();
      graphics.moveTo(-5.9, -4.9);
      graphics.lineTo(-0.7, -8.5);
      graphics.lineTo(-0.7, 8.5);
      graphics.lineTo(-5.9, 4.9);
      graphics.closePath();
      graphics.fillPath();

      graphics.lineStyle(2.4, color, 0.95);
      graphics.beginPath();
      graphics.arc(1.5, 0, 4.4, -0.78, 0.78, false);
      graphics.strokePath();
      graphics.lineStyle(2.1, color, 0.72);
      graphics.beginPath();
      graphics.arc(1.5, 0, 7.1, -0.8, 0.8, false);
      graphics.strokePath();
      break;
    case 'sound-off':
      graphics.fillStyle(color, 0.98);
      graphics.fillRoundedRect(-10.5, -4.4, 4.8, 8.8, 1.6);
      graphics.beginPath();
      graphics.moveTo(-5.9, -4.9);
      graphics.lineTo(-0.7, -8.5);
      graphics.lineTo(-0.7, 8.5);
      graphics.lineTo(-5.9, 4.9);
      graphics.closePath();
      graphics.fillPath();

      graphics.lineStyle(3, 0xff6b8b, 0.96);
      graphics.beginPath();
      graphics.moveTo(1.2, -7.2);
      graphics.lineTo(10.6, 2.2);
      graphics.strokePath();

      graphics.lineStyle(2.2, 0xffd5df, 0.98);
      graphics.beginPath();
      graphics.moveTo(2.8, -7.6);
      graphics.lineTo(11, 0.6);
      graphics.strokePath();
      break;
    case 'close':
      graphics.beginPath();
      graphics.moveTo(-7, -7);
      graphics.lineTo(7, 7);
      graphics.moveTo(7, -7);
      graphics.lineTo(-7, 7);
      graphics.strokePath();
      break;
    case 'home':
      graphics.fillTriangle(-8, -1, 0, -9, 8, -1);
      graphics.strokeRect(-6, -1, 12, 10);
      graphics.strokeRect(-2, 3, 4, 6);
      break;
    case 'next':
      graphics.fillStyle(color, 0.98);
      graphics.fillTriangle(-9.5, -6.8, -9.5, 6.8, -0.6, 0);
      graphics.fillTriangle(-0.8, -6.8, -0.8, 6.8, 8.1, 0);

      graphics.lineStyle(1.8, color, 0.58);
      graphics.beginPath();
      graphics.moveTo(-10.8, -9.2);
      graphics.lineTo(10.2, -9.2);
      graphics.strokePath();

      graphics.fillStyle(color, 0.9);
      graphics.fillCircle(10.8, 0, 1.9);
      break;
    default:
      graphics.fillCircle(0, 0, 4);
      break;
  }
}

export function createButton(scene, config) {
  const width = config.width ?? 180;
  const height = config.height ?? 36;
  const container = scene.add.container(config.x, config.y);

  const colorBase = config.variant === 'alt' ? UI_THEME.colors.buttonAlt : UI_THEME.colors.button;
  const colorHover = config.variant === 'alt' ? UI_THEME.colors.buttonAltHover : UI_THEME.colors.buttonHover;

  const shadow = scene.add.graphics();
  drawRoundedRect(shadow, -width / 2 + 2, -height / 2 + 5, width, height, 14, UI_THEME.shadowColor, 0.4);

  const bg = scene.add.graphics();
  renderButtonVisual(bg, width, height, colorBase, false);

  const label = applyTextSmoothing(
    scene.add
    .text(0, 0, config.label ?? '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: config.fontSize ?? '16px',
      color: UI_THEME.colors.textPrimary,
      fontStyle: '700',
    })
    .setOrigin(0.5),
    { shadow: false },
  );

  const iconGraphic = scene.add.graphics();
  const iconColor = config.iconColor ?? 0xf2f6ff;

  const hitArea = scene.add.rectangle(0, 0, width, height, 0x000000, 0.001).setInteractive({ useHandCursor: true });

  let activeIcon = null;
  const setIcon = (iconKey) => {
    activeIcon = iconKey || null;
    drawButtonIcon(iconGraphic, activeIcon, iconColor);
    iconGraphic.setVisible(Boolean(activeIcon));
    label.setVisible(!activeIcon);
  };

  container.add([shadow, bg, label, iconGraphic, hitArea]);

  if (config.depth !== undefined) {
    container.setDepth(config.depth);
  }

  if (config.scrollFactor !== undefined) {
    container.setScrollFactor(config.scrollFactor);
  }

  const ensureTopLayer = () => {
    if (container.parentContainer) {
      container.parentContainer.bringToTop(container);
    }
  };

  const setHover = () => {
    ensureTopLayer();
    renderButtonVisual(bg, width, height, colorHover, false);
  };

  const clearHover = () => {
    renderButtonVisual(bg, width, height, colorBase, false);
  };

  hitArea.on('pointerover', setHover);
  hitArea.on('pointerout', clearHover);

  hitArea.on('pointerdown', () => {
    ensureTopLayer();
    renderButtonVisual(bg, width, height, UI_THEME.colors.buttonPressed, true);
  });

  hitArea.on('pointerup', () => {
    clearHover();
    scene.soundManager?.playSfx?.('ui-blip');
    if (typeof config.onClick === 'function') {
      config.onClick();
    }
  });

  setIcon(config.icon);

  return {
    container,
    bg: hitArea,
    label,
    setLabel: (value) => label.setText(value),
    setIcon,
    setEnabled: (value) => {
      hitArea.disableInteractive();
      if (value) {
        hitArea.setInteractive({ useHandCursor: true });
      }
      container.setAlpha(value ? 1 : 0.45);
    },
  };
}

export function popIn(scene, target, delay = 0) {
  const baseY = target.y;
  target.setY(baseY + 8);
  target.setAlpha(0);

  scene.tweens.add({
    targets: target,
    alpha: 1,
    y: baseY,
    delay,
    duration: 240,
    ease: 'Cubic.Out',
  });
}
