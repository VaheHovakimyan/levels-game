import Phaser from 'phaser';
import { SCENE_KEYS } from '../utils/constants';
import { UI_THEME } from '../ui/theme';
import { ensurePlayerArt } from '../entities/playerArt';
import { applyTextSmoothing } from '../ui/text';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.PRELOAD);
  }

  create() {
    ensurePlayerArt(this);

    this.cameras.main.setZoom(1);
    this.cameras.main.setBackgroundColor('#070f21');

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const glow = this.add.ellipse(centerX, centerY - 14, 470, 210, 0x5ebcff, 0.16);
    const panel = this.add.rectangle(centerX, centerY, 410, 132, 0x153255, 0.94).setStrokeStyle(2, 0x5d9ad1, 0.85);
    const shine = this.add.rectangle(centerX, centerY - 48, 386, 20, 0xffffff, 0.08);

    applyTextSmoothing(
      this.add
      .text(centerX, centerY - 14, 'Booting Starship Systems', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '30px',
        fontStyle: '700',
        color: UI_THEME.colors.textPrimary,
      })
      .setOrigin(0.5),
      { shadow: false },
    );

    const sub = applyTextSmoothing(
      this.add
      .text(centerX, centerY + 22, 'Calibrating airlocks, drones, and astronaut controls...', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '14px',
        color: UI_THEME.colors.textSecondary,
      })
      .setOrigin(0.5),
    );

    this.tweens.add({
      targets: [panel, sub, glow, shine],
      alpha: { from: 0.62, to: 1 },
      duration: 620,
      yoyo: true,
      repeat: -1,
    });

    this.time.delayedCall(200, () => {
      this.scene.start(SCENE_KEYS.MENU);
    });
  }
}
