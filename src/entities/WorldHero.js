import Phaser from 'phaser';
import {
  HERO_TEXTURE,
  HERO_DIRECTIONS,
  HERO_FRAME_HEIGHT,
  HERO_FEET_PADDING,
  HERO_DISPLAY_HEIGHT,
  heroAnimationKey,
  heroIdleFrame,
  heroTexture,
  heroFeetOriginY
} from './heroSprite.js';
import { getMovementMultiplier } from '../systems/HeroStatsSystem.js';

// Hrdina v izometrickém světě.
//
// Skládá se ze dvou částí:
//   mover – neviditelné fyzikální tělo na logické mřížce (kolize s poli a budovami),
//   view  – viditelný sprite, který se každý snímek promítne do izometrie.
// Pozice v uložené hře jsou logické souřadnice moveru.

// Směr pohybu na obrazovce (znaménko x, y) → řada spritesheetu.
// Sprite je kreslený pro obrazovku, takže "jih" = čelem ke kameře.
const DIRECTION_BY_SCREEN_VECTOR = {
  '0,-1': 'north',
  '1,-1': 'northeast',
  '1,0': 'east',
  '1,1': 'southeast',
  '0,1': 'south',
  '-1,1': 'southwest',
  '-1,0': 'west',
  '-1,-1': 'northwest'
};

// Rychlost na obrazovce (px/s).
const SCREEN_SPEED = 260;

// Velikost "nohou" v logických jednotkách (pole má 64).
const FEET_SIZE = 26;

export default class WorldHero {
  constructor(scene, projection, x, y, state) {
    this.scene = scene;
    this.projection = projection;
    this.state = state;
    this.facing = 'south';

    this.mover = scene.add.zone(x, y, FEET_SIZE, FEET_SIZE);
    scene.physics.add.existing(this.mover);
    this.mover.body.setCollideWorldBounds(true);

    this.gender = state?.gender ?? 'male';
    this.view = scene.add.sprite(0, 0, heroTexture(this.gender), heroIdleFrame('south'))
      .setOrigin(0.5, heroFeetOriginY(this.gender))
      .setScale(HERO_DISPLAY_HEIGHT / HERO_FRAME_HEIGHT);

    this.syncView();
  }

  get x() {
    return this.mover.x;
  }

  get y() {
    return this.mover.y;
  }

  face(directionName) {
    this.facing = directionName;
    this.view.setFlipX(HERO_DIRECTIONS[directionName].flipX);
  }

  updateMovement(cursors, wasd) {
    let x = 0;
    let y = 0;

    if (cursors.left.isDown || wasd.left.isDown) x -= 1;
    if (cursors.right.isDown || wasd.right.isDown) x += 1;
    if (cursors.up.isDown || wasd.up.isDown) y -= 1;
    if (cursors.down.isDown || wasd.down.isDown) y += 1;

    if (x !== 0 || y !== 0) {
      this.face(DIRECTION_BY_SCREEN_VECTOR[`${x},${y}`]);
      this.view.anims.play(heroAnimationKey(this.facing, this.gender), true);

      // Rychlost hrdiny (a pasivní bonus monster v partě) zrychluje chůzi.
      const speed = SCREEN_SPEED * getMovementMultiplier(this.state);
      // Dvě klávesy (W+A, W+D, S+A, S+D) = podél hrany izometrické mřížky: na obrazovce
      // poměr 2 : 1 (ne 45°), takže hrdina jde přesně po řadě / sloupci polí.
      const screen = new Phaser.Math.Vector2(x !== 0 && y !== 0 ? x * 2 : x, y).normalize().scale(speed);
      const logical = this.projection.screenVectorToLogical(screen.x, screen.y);
      this.mover.body.setVelocity(logical.x, logical.y);
    } else {
      this.stop();
    }

    this.state.x = this.mover.x;
    this.state.y = this.mover.y;
  }

  stop() {
    this.mover.body.setVelocity(0, 0);
    this.view.anims.stop();
    this.view.setFrame(heroIdleFrame(this.facing));
  }

  // Promítne logickou pozici do izometrie. Volá se po kroku fyziky.
  syncView() {
    const screen = this.projection.toScreen(this.mover.x, this.mover.y);
    this.view.setPosition(screen.x, screen.y);
    this.view.setDepth(screen.y);
  }
}
