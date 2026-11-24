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
import TalentScene from './scenes/TalentScene.js';
import InventoryScene from './scenes/InventoryScene.js';
import WorldMapScene from './scenes/WorldMapScene.js';
import FishingScene from './scenes/FishingScene.js';
import FishingShopScene from './scenes/FishingShopScene.js';
import MiningScene from './scenes/MiningScene.js';
import MiningShopScene from './scenes/MiningShopScene.js';
import HerbalismScene from './scenes/HerbalismScene.js';
import HerbalistShopScene from './scenes/HerbalistShopScene.js';
import LootScene from './scenes/LootScene.js';
import CookingScene, { AlchemyScene, SmithingScene, CraftingScene } from './scenes/CookingScene.js';
import ProfessionsScene from './scenes/ProfessionsScene.js';
import MerchantShopScene from './scenes/MerchantShopScene.js';
import QuestsScene from './scenes/QuestsScene.js';


// Výchozí písmo pro všechny texty vytvořené ve hře.
const textFactory = Phaser.GameObjects.GameObjectFactory.prototype;
const originalText = textFactory.text;

if (typeof originalText === 'function') {
  textFactory.text = function (x, y, text, style = {}) {
    const textObject = originalText.call(this, x, y, text, {
      fontFamily: 'Lora, Georgia, "Times New Roman", serif',
      ...style
    });

    return textObject.setResolution(3);
  };
}

// Písmo Lora (public/assets/fonts, @font-face v index.html) musí být načtené dřív, než hra
// začne kreslit texty a sestavovat obrázky UI s popisky.
const fontsReady = Promise.all(['400', '700'].map((weight) => document.fonts.load(`${weight} 20px Lora`, 'Aa 0123456789 ěščřžýáíéůú')))
  .catch(() => null);

const startGame = () => new Phaser.Game({
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
    TalentScene,
    InventoryScene,
    WorldMapScene,
    InteriorScene,
    FishingScene,
    FishingShopScene,
    MiningScene,
    MiningShopScene,
    HerbalismScene,
    HerbalistShopScene,
    LootScene,
    CookingScene,
    AlchemyScene,
    SmithingScene,
    CraftingScene,
    ProfessionsScene,
    MerchantShopScene,
    QuestsScene
  ]
});

fontsReady.then(() => {
  const game = startGame();
  // Jen při vývoji (npm run dev): hra je dostupná v konzoli prohlížeče jako window.game.
  if (import.meta.env.DEV) window.game = game;
});
