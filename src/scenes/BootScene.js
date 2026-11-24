import Phaser from 'phaser';
import { loadHeroSprite, createHeroAnimations } from '../entities/heroSprite.js';
import {
  loadBuildingTextures,
  prepareBuildingTextures
} from '../entities/buildingSprites.js';
import { loadMenuButtons, prepareMenuButtons } from '../ui/menuButtons.js';
import { loadObjectSprites, prepareObjectSprites } from '../entities/objectSprites.js';
import { loadTerrainTiles, prepareTerrainTiles } from '../world/terrainTiles.js';
import { loadInventorySprites, prepareInventorySprites } from '../ui/inventorySprites.js';
import { loadNewUi, buildNewUi } from '../ui/newUiKit.js';
import { loadMonsterAnimations, prepareMonsterAnimations } from '../battle/monsterAnimations.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

preload() {
  // Průběh načítání pro načítací obrazovku v index.html.
  this.load.on('progress', (value) => window.dispatchEvent(new CustomEvent('ds-loading-progress', { detail: value })));
  this.load.image('title-background', 'assets/title-background.png');
  loadMenuButtons(this);
  loadObjectSprites(this);
  loadTerrainTiles(this);
  loadHeroSprite(this);
  loadBuildingTextures(this);
  // Karty: nová sada UI – podklady a stavy prvků se sestaví v create (ui/newUiKit.js).
  loadNewUi(this);
  loadInventorySprites(this);
  loadMonsterAnimations(this);
}


  makeTexture(key, width, height, draw) {
    const graphics = this.make.graphics({
      x: 0,
      y: 0,
      add: false
    });

    draw(graphics);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  create() {
    createHeroAnimations(this);
    prepareBuildingTextures(this);
    prepareObjectSprites(this);
    prepareInventorySprites(this);
    buildNewUi(this);
    prepareMonsterAnimations(this);
    this.registry.set('terrainTilesReady', prepareTerrainTiles(this));
    this.registry.set('menuButtonsReady', prepareMenuButtons(this));

    this.makeTexture('arion', 16, 20, (g) => {
      g.fillStyle(0x263246).fillRect(3, 1, 10, 6);
      g.fillStyle(0xe6b783).fillRect(4, 6, 8, 7);
      g.fillStyle(0x3d6590).fillRect(3, 13, 10, 6);
      g.fillStyle(0x29202a).fillRect(4, 18, 3, 2).fillRect(9, 18, 3, 2);
      g.fillStyle(0x3b2b20).fillRect(5, 8, 1, 1).fillRect(10, 8, 1, 1);
    });

    this.makeTexture('villager', 16, 20, (g) => {
      g.fillStyle(0x69442f).fillRect(3, 1, 10, 5);
      g.fillStyle(0xe8be8d).fillRect(4, 6, 8, 7);
      g.fillStyle(0x54704b).fillRect(3, 13, 10, 6);
      g.fillStyle(0x352620).fillRect(4, 18, 3, 2).fillRect(9, 18, 3, 2);
    });

    this.makeTexture('elder', 16, 20, (g) => {
      g.fillStyle(0xd9d2bb).fillRect(3, 1, 10, 7);
      g.fillStyle(0xe8be8d).fillRect(4, 6, 8, 7);
      g.fillStyle(0x675b86).fillRect(3, 13, 10, 6);
      g.fillStyle(0x352620).fillRect(4, 18, 3, 2).fillRect(9, 18, 3, 2);
    });

    this.makeTexture('tree', 24, 30, (g) => {
      g.fillStyle(0x60442c).fillRect(10, 17, 5, 13);
      g.fillStyle(0x244c32).fillRect(3, 8, 18, 13);
      g.fillStyle(0x347346).fillRect(6, 2, 13, 15);
      g.fillStyle(0x4c8b4c).fillRect(9, 5, 7, 5);
    });

    this.makeTexture('house', 48, 40, (g) => {
      g.fillStyle(0x725039).fillRect(4, 15, 40, 25);
      g.fillStyle(0x9a4c3b).fillRect(1, 9, 46, 9);
      g.fillStyle(0x6e342c).fillRect(5, 5, 38, 7);
      g.fillStyle(0xe3c27c).fillRect(9, 20, 8, 7);
      g.fillStyle(0x4b3025).fillRect(27, 24, 9, 16);
    });

    this.makeTexture('slime', 20, 16, (g) => {
      g.fillStyle(0x4fb874).fillRect(3, 5, 14, 9);
      g.fillStyle(0x75d58e).fillRect(6, 2, 8, 7);
      g.fillStyle(0x15251b).fillRect(7, 8, 2, 2).fillRect(12, 8, 2, 2);
    });

    // Grafika je připravená – načítací obrazovka se může zatmít.

    window.dispatchEvent(new CustomEvent('ds-loading-done'));

    this.scene.start('Menu');
  }
}
