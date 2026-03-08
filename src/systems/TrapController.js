export class TrapController {
  constructor(scene, { player, levelLoader, onFail, onLevelComplete, onTrapTriggered }) {
    this.scene = scene;
    this.player = player;
    this.levelLoader = levelLoader;
    this.onFail = onFail;
    this.onLevelComplete = onLevelComplete;
    this.onTrapTriggered = onTrapTriggered;
    this.doorTriggered = false;

    this.colliders = [];
    this.setupCollisions();
  }

  setupCollisions() {
    this.colliders.push(
      this.scene.physics.add.collider(this.player, this.levelLoader.platformGroup, (_player, platform) => {
        if (platform?.onPlayerStep) {
          platform.onPlayerStep();
        }
      }),
    );

    this.colliders.push(
      this.scene.physics.add.overlap(this.player, this.levelLoader.trapGroup, (_player, trap) => {
        if (trap?.isLethal?.()) {
          this.onTrapTriggered?.(trap);
          this.onFail('trap');
        }
      }),
    );

    this.colliders.push(
      this.scene.physics.add.overlap(this.player, this.levelLoader.doorGroup, (_player, door) => {
        if (this.doorTriggered) {
          return;
        }

        if (door?.isPlayerCentered && !door.isPlayerCentered(this.player)) {
          return;
        }

        if (door?.decoy) {
          this.onFail('fake_door');
          return;
        }

        this.doorTriggered = true;
        this.onLevelComplete(door);
      }),
    );

    if (this.levelLoader.doorWallGroup) {
      this.colliders.push(this.scene.physics.add.collider(this.player, this.levelLoader.doorWallGroup));
    }
  }

  update() {
    this.levelLoader.update(this.player);
  }

  destroy() {
    this.colliders.forEach((collider) => collider.destroy());
    this.colliders = [];
  }
}
