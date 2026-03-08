const FRAME_W = 30;
const FRAME_H = 40;
const RUN_FRAME_COUNT = 10;
const RUN_CYCLE = Math.PI * 2;

export const PLAYER_SKINS = [
  {
    key: 'apollo',
    label: 'Apollo Scout',
    palette: {
      suit: '#dce7ff',
      suitDark: '#8ba5cf',
      trim: '#4ecbff',
      trimDark: '#2b6d9f',
      visor: '#7ff1ff',
      visorDark: '#22657f',
      boot: '#44526b',
      glove: '#5a6c89',
      jet: '#7efeff',
    },
  },
  {
    key: 'nova',
    label: 'Nova Pilot',
    palette: {
      suit: '#f3e8ff',
      suitDark: '#a193c5',
      trim: '#ff8ad5',
      trimDark: '#904e85',
      visor: '#ffd8fb',
      visorDark: '#7e3e75',
      boot: '#5f4e77',
      glove: '#7d6aa0',
      jet: '#ffc6ff',
    },
  },
  {
    key: 'ion',
    label: 'Ion Ranger',
    palette: {
      suit: '#d3fff5',
      suitDark: '#6ca89a',
      trim: '#79ffa8',
      trimDark: '#3f8f5f',
      visor: '#b2fff3',
      visorDark: '#2e7a70',
      boot: '#3f6158',
      glove: '#557f74',
      jet: '#c9ffe2',
    },
  },
  {
    key: 'orbit',
    label: 'Orbit Guard',
    palette: {
      suit: '#e1e6f3',
      suitDark: '#7e88ac',
      trim: '#a5baff',
      trimDark: '#5063a3',
      visor: '#b9d8ff',
      visorDark: '#2d4f80',
      boot: '#3d4768',
      glove: '#4f5d84',
      jet: '#c6dcff',
    },
  },
];

function getSkinByKey(skinKey) {
  return PLAYER_SKINS.find((skin) => skin.key === skinKey) || PLAYER_SKINS[0];
}

export function sanitizeSkinKey(skinKey) {
  return getSkinByKey(skinKey).key;
}

export function getSkinLabel(skinKey) {
  return getSkinByKey(skinKey).label;
}

export function getPlayerAnimKey(skinKey, action) {
  const safe = sanitizeSkinKey(skinKey);
  return `player-${safe}-${action}`;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r, color, lineWidth = 1.2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
}

function drawArm(ctx, x, y, length, thickness, angle, color, jointColor) {
  const dx = Math.cos(angle) * length;
  const dy = Math.sin(angle) * length;

  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();

  ctx.fillStyle = jointColor;
  ctx.beginPath();
  ctx.arc(x + dx, y + dy, thickness * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function drawLeg(ctx, x, y, length, thickness, angle, color, bootColor) {
  const dx = Math.cos(angle) * length;
  const dy = Math.sin(angle) * length;

  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();

  fillRoundRect(ctx, x + dx - 3, y + dy - 2, 7, 4, 2, bootColor);
}

function drawJetpackGlow(ctx, x, y, palette, intensity) {
  if (intensity <= 0) {
    return;
  }

  ctx.globalAlpha = 0.35 + intensity * 0.35;
  ctx.fillStyle = palette.jet;
  ctx.beginPath();
  ctx.ellipse(x, y, 5, 7 + intensity * 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 2.2, 3.2 + intensity * 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
}

function drawAstronaut(ctx, palette, pose) {
  const {
    bobY = 0,
    armSwing = 0,
    legSwing = 0,
    thrust = 0,
    lean = 0,
  } = pose;

  const cX = FRAME_W * 0.5 + lean;
  const baseY = 21 + bobY;
  const shoulderY = baseY - 4.6;
  const shoulderOffset = 5.4;

  fillRoundRect(ctx, cX - 6, baseY - 7, 12, 16, 4, palette.suit);
  strokeRoundRect(ctx, cX - 6, baseY - 7, 12, 16, 4, palette.suitDark, 1.1);

  fillRoundRect(ctx, cX - 3, baseY - 6, 6, 3, 1.3, palette.trim);
  fillRoundRect(ctx, cX - 1.8, baseY - 2.2, 3.6, 6.8, 1.2, palette.trimDark);

  // Shoulder joints; keep small to avoid "extra hand" artifacts during run.
  fillRoundRect(ctx, cX - 7.1, shoulderY - 1.9, 2.1, 3.8, 1, palette.suitDark);
  fillRoundRect(ctx, cX + 5.0, shoulderY - 1.9, 2.1, 3.8, 1, palette.suitDark);

  drawArm(ctx, cX - shoulderOffset, shoulderY, 5.7, 2.3, Math.PI * (0.58 + armSwing), palette.glove, palette.suit);
  drawArm(ctx, cX + shoulderOffset, shoulderY, 5.7, 2.3, Math.PI * (0.42 - armSwing), palette.glove, palette.suit);

  drawLeg(ctx, cX - 2.8, baseY + 8, 8.4, 2.8, Math.PI * (0.58 + legSwing), palette.suitDark, palette.boot);
  drawLeg(ctx, cX + 2.8, baseY + 8, 8.4, 2.8, Math.PI * (0.42 - legSwing), palette.suitDark, palette.boot);

  fillRoundRect(ctx, cX - 4.4, baseY - 6.8, 8.8, 4, 1.6, palette.suitDark);
  drawJetpackGlow(ctx, cX, baseY + 13.5, palette, thrust);

  ctx.fillStyle = palette.suit;
  ctx.beginPath();
  ctx.arc(cX, baseY - 12, 6.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = palette.suitDark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cX, baseY - 12, 6.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = palette.visor;
  ctx.beginPath();
  ctx.ellipse(cX, baseY - 12, 4.5, 3.2, -0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.visorDark;
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.ellipse(cX + 1, baseY - 12, 2.7, 2.1, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(cX - 1.6, baseY - 13.2, 1.5, 0.9, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function makeTexture(scene, key, drawFn) {
  if (scene.textures.exists(key)) {
    return;
  }

  const texture = scene.textures.createCanvas(key, FRAME_W, FRAME_H);
  const ctx = texture.context;
  ctx.clearRect(0, 0, FRAME_W, FRAME_H);
  drawFn(ctx);
  texture.refresh();
}

function drawIdle(ctx, palette) {
  drawAstronaut(ctx, palette, { bobY: 0, armSwing: 0.01, legSwing: 0, thrust: 0, lean: 0 });
}

function getRunPose(frameIndex) {
  const t = (frameIndex / RUN_FRAME_COUNT) * RUN_CYCLE;
  const swing = Math.sin(t);
  return {
    bobY: Math.sin(t * 2) * 0.6,
    armSwing: swing * 0.18,
    legSwing: swing * 0.2,
    thrust: 0,
    lean: swing * 0.35,
  };
}

function drawRun(ctx, frameIndex, palette) {
  drawAstronaut(ctx, palette, getRunPose(frameIndex));
}

function drawJump(ctx, palette) {
  drawAstronaut(ctx, palette, {
    bobY: -0.8,
    armSwing: -0.2,
    legSwing: 0.08,
    thrust: 1,
    lean: 0,
  });
}

function drawFall(ctx, palette) {
  drawAstronaut(ctx, palette, {
    bobY: 0.7,
    armSwing: 0.16,
    legSwing: -0.1,
    thrust: 0.3,
    lean: 0,
  });
}

function ensureSkinTextures(scene, skinKey, palette) {
  makeTexture(scene, `player-${skinKey}-idle-0`, (ctx) => drawIdle(ctx, palette));

  for (let i = 0; i < RUN_FRAME_COUNT; i += 1) {
    makeTexture(scene, `player-${skinKey}-run-${i}`, (ctx) => drawRun(ctx, i, palette));
  }

  makeTexture(scene, `player-${skinKey}-jump-0`, (ctx) => drawJump(ctx, palette));
  makeTexture(scene, `player-${skinKey}-fall-0`, (ctx) => drawFall(ctx, palette));
}

function ensureSkinAnimations(scene, skinKey) {
  const idleKey = `player-${skinKey}-idle`;
  const runKey = `player-${skinKey}-run`;
  const jumpKey = `player-${skinKey}-jump`;
  const fallKey = `player-${skinKey}-fall`;

  if (!scene.anims.exists(idleKey)) {
    scene.anims.create({
      key: idleKey,
      frames: [{ key: `player-${skinKey}-idle-0` }],
      frameRate: 1,
      repeat: -1,
    });
  }

  if (!scene.anims.exists(runKey)) {
    const runFrames = [];
    for (let i = 0; i < RUN_FRAME_COUNT; i += 1) {
      runFrames.push({ key: `player-${skinKey}-run-${i}` });
    }

    scene.anims.create({
      key: runKey,
      frames: runFrames,
      frameRate: 16,
      repeat: -1,
    });
  }

  if (!scene.anims.exists(jumpKey)) {
    scene.anims.create({
      key: jumpKey,
      frames: [{ key: `player-${skinKey}-jump-0` }],
      frameRate: 1,
      repeat: -1,
    });
  }

  if (!scene.anims.exists(fallKey)) {
    scene.anims.create({
      key: fallKey,
      frames: [{ key: `player-${skinKey}-fall-0` }],
      frameRate: 1,
      repeat: -1,
    });
  }
}

export function ensurePlayerArt(scene) {
  PLAYER_SKINS.forEach((skin) => {
    ensureSkinTextures(scene, skin.key, skin.palette);
    ensureSkinAnimations(scene, skin.key);
  });
}
