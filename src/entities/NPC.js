import Phaser from 'phaser';

export default class NPC extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, name, lines) {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.name = name;
    this.lines = lines;
    this.body.setSize(12, 12);
    this.setDepth(y);
  }
}
