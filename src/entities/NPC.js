import Phaser from 'phaser';

export default class NPC extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, name, lines) {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.name = name;
    this.lines = lines;

    // Kolize jen u nohou, ať jde k postavě přijít až k ní.
    const feetW = Math.max(12, this.width * 0.6);
    const feetH = Math.max(12, this.height * 0.22);
    this.body.setSize(feetW, feetH);
    this.body.setOffset((this.width - feetW) / 2, this.height - feetH);
    this.setDepth(y);
  }
}
