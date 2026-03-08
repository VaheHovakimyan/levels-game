import { STORAGE_KEYS } from './constants';

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (_error) {
    // Some hosts (embedded WebViews) may block localStorage.
  }

  return null;
}

export function loadUnlockedLevel(maxLevelIndex) {
  const storage = getStorage();
  if (!storage) {
    return 0;
  }

  const raw = Number.parseInt(storage.getItem(STORAGE_KEYS.unlockedLevel) || '0', 10);
  if (Number.isNaN(raw)) {
    return 0;
  }

  return Math.max(0, Math.min(maxLevelIndex, raw));
}

export function saveUnlockedLevel(levelIndex) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEYS.unlockedLevel, String(Math.max(0, levelIndex)));
}

export function resetProgress() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEYS.unlockedLevel, '0');
}

export function loadMuteState() {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  return storage.getItem(STORAGE_KEYS.muted) === '1';
}

export function saveMuteState(isMuted) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEYS.muted, isMuted ? '1' : '0');
}

export function loadSelectedSkin(defaultSkin = 'apollo') {
  const storage = getStorage();
  if (!storage) {
    return defaultSkin;
  }

  return storage.getItem(STORAGE_KEYS.selectedSkin) || defaultSkin;
}

export function saveSelectedSkin(skinKey) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEYS.selectedSkin, skinKey);
}
