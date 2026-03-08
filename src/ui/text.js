export function getRecommendedTextResolution() {
  if (typeof window === 'undefined') {
    return 1;
  }

  const rawDpr = window.devicePixelRatio || 1;
  const maxResolution = 1.5;

  return Math.min(Math.max(rawDpr, 1), maxResolution);
}

const DEFAULT_TEXT_RESOLUTION = getRecommendedTextResolution();

function snapTextPosition(text) {
  if (!text || text.__snapPositionPatched || typeof text.setPosition !== 'function') {
    return;
  }

  const originalSetPosition = text.setPosition;
  text.setPosition = function patchedSetPosition(x, y, ...rest) {
    return originalSetPosition.call(this, Math.round(x), Math.round(y), ...rest);
  };
  text.__snapPositionPatched = true;
  text.setPosition(text.x, text.y);
}

export function applyTextSmoothing(text, options = {}) {
  const resolution = options.resolution ?? DEFAULT_TEXT_RESOLUTION;
  const shadow = options.shadow ?? false;

  if (typeof text.setResolution === 'function') {
    text.setResolution(resolution);
  }

  snapTextPosition(text);

  if (shadow && typeof text.setShadow === 'function') {
    text.setShadow(0, 1, '#031022', 2, false, true);
  }

  return text;
}
