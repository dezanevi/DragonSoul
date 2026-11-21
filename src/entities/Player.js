import Phaser from 'phaser';
import {
  HERO_TEXTURE,
  HERO_DIRECTIONS,
  HERO_FRAME_WIDTH,
  HERO_FRAME_HEIGHT,
  HERO_FEET_PADDING,
  HERO_DISPLAY_HEIGHT,
  heroAnimationKey,
  heroIdleFrame
} from './heroSprite.js';

// Směr pohybu (znaménko x, y) → název směru ve spritesheetu.
const DIRECTION_BY_VECTOR = {
  '0,-1': 'north',
  '1,-1': 'northeast',
  '1,0': 'east',
  '1,1': 'southeast',
  '0,1': 'south',
  '-1,1': 'southwest',
  '-1,0': 'west',
  '-1,-1': 'northwest'
};

// Kolizní obdélník u nohou, v pixelech zdrojového snímku.
const FEET_WIDTH = 72;
const FEET_HEIGHT = 36;

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, state) {
    super(scene, x, y, HERO_TEXTURE, heroIdleFrame('south'));

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.state = state;
    this.facing = 'south';

    // Pozice hráče = bod mezi nohama. Díky tomu sedí řazení
    // do hloubky i kolize se spodní hranou dlaždic.
    this.setOrigin(
      0.5,
      (HERO_FRAME_HEIGHT - HERO_FEET_PADDING) / HERO_FRAME_HEIGHT
    );
    this.setDisplayHeight(HERO_DISPLAY_HEIGHT);
    this.setCollideWorldBounds(true);

    this.body.setSize(FEET_WIDTH, FEET_HEIGHT);
    this.body.setOffset(
      (HERO_FRAME_WIDTH - FEET_WIDTH) / 2,
      HERO_FRAME_HEIGHT - HERO_FEET_PADDING - FEET_HEIGHT
    );

    this.speed = 220;
    this.setDepth(y);
  }

  // Výška postavy na obrazovce v px (měřítko se dopočítá ze snímku).
  setDisplayHeight(height) {
    this.setScale(height / HERO_FRAME_HEIGHT);
    return this;
  }

  face(directionName) {
    this.facing = directionName;
    this.setFlipX(HERO_DIRECTIONS[directionName].flipX);
  }

  updateMovement(cursors, wasd) {
    let x = 0;
    let y = 0;

    if (cursors.left.isDown || wasd.left.isDown) x -= 1;
    if (cursors.right.isDown || wasd.right.isDown) x += 1;
    if (cursors.up.isDown || wasd.up.isDown) y -= 1;
    if (cursors.down.isDown || wasd.down.isDown) y += 1;

    if (x !== 0 || y !== 0) {
      this.face(DIRECTION_BY_VECTOR[`${x},${y}`]);
      this.anims.play(heroAnimationKey(this.facing), true);

      const velocity = new Phaser.Math.Vector2(x, y)
        .normalize()
        .scale(this.speed);

      this.setVelocity(velocity.x, velocity.y);
    } else {
      this.setVelocity(0, 0);
      this.anims.stop();
      this.setFrame(heroIdleFrame(this.facing));
    }

    this.setDepth(this.y);
    this.state.x = this.x;
    this.state.y = this.y;
  }
}
