export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const LEVEL_HEIGHT = 720;
export const GRAVITY_Y = 1800;
export const DEFAULT_DEATH_Y_OFFSET = 180;

export const STORAGE_KEYS = {
  unlockedLevel: 'troll_platformer_unlocked_level',
  muted: 'troll_platformer_muted',
  selectedSkin: 'troll_platformer_selected_skin',
};

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MENU: 'MenuScene',
  LEVEL: 'LevelScene',
  UI: 'UIScene',
};

export const PLAYER_DEFAULTS = {
  width: 20,
  height: 28,
  moveSpeed: 230,
  jumpSpeed: 650,
  coyoteTimeMs: 90,
  jumpBufferMs: 130,
};

export const COLORS = {
  backgroundA: 0x0f1724,
  backgroundB: 0x18253a,
  player: 0x59d8ff,
  playerOutline: 0xffffff,
  platform: 0x6f7f8f,
  collapsingPlatform: 0xd39b3d,
  fakeFloor: 0x7d6d63,
  spike: 0xf15b5b,
  movingHazard: 0xff8a3d,
  door: 0x7ee787,
  fakeDoor: 0xf7de5f,
  uiPanel: 0x102038,
  uiButton: 0x28476b,
  uiButtonAlt: 0x6a3f2d,
  white: 0xffffff,
};

export const BRIDGE_EVENTS = {
  LEVEL_STARTED: 'level_started',
  LEVEL_FAILED: 'level_failed',
  LEVEL_COMPLETED: 'level_completed',
  GAME_COMPLETED: 'game_completed',
};

export const GAME_EVENTS = {
  UI_UPDATE: 'ui:update',
  UI_LEVEL_COMPLETE: 'ui:level-complete',
  UI_HIDE_LEVEL_COMPLETE: 'ui:hide-level-complete',
  UI_MESSAGE: 'ui:message',
  UI_DEATH_FEEDBACK: 'ui:death-feedback',
  UI_LEVEL_INTRO: 'ui:level-intro',
  UI_GAME_COMPLETE: 'ui:game-complete',
};
