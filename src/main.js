import Phaser from 'phaser';
import { gameConfig } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import WorldScene from './scenes/WorldScene.js';
import BattleScene from './scenes/BattleScene.js';
import PartyScene from './scenes/PartyScene.js';
import BestiaryScene from './scenes/BestiaryScene.js';
import SpellbookScene from './scenes/SpellbookScene.js';
import HeroScene from './scenes/HeroScene.js';
import InteriorScene from './scenes/InteriorScene.js';
import CharacterCreateScene from './scenes/CharacterCreateScene.js';


// Výchozí písmo pro všechny texty vytvořené ve hře.
const textFactory = Phaser.GameObjects.GameObjectFactory.prototype;
const originalText = textFactory.text;

if (typeof originalText === 'function') {
  textFactory.text = function (x, y, text, style = {}) {
    const textObject = originalText.call(this, x, y, text, {
      fontFamily: 'Verdana, Arial, sans-serif',
      ...style
    });

    return textObject.setResolution(3);
  };
}

new Phaser.Game({
  ...gameConfig,
  scene: [
    BootScene,
    MenuScene,
    CharacterCreateScene,
    WorldScene,
    BattleScene,
    PartyScene,
    BestiaryScene,
    SpellbookScene,
    HeroScene,
    InteriorScene   
  ]
});
