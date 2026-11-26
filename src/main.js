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
import SoulClashScene from './scenes/SoulClashScene.js';
import PauseScene from './scenes/PauseScene.js';
import OwnShopScene from './scenes/OwnShopScene.js';
import { tickBusiness } from './systems/DiplomacySystem.js';


// Čitelnost (karta Font): málo kontrastní šedé odstíny textů se zesvětlí (zachová se odstín,
// vedlejší text zůstane odlišený). Platí pro všechny texty – při vytvoření i při setColor.
const READABLE_GREYS = {
  '#9fb3c8': '#c6d4e3', '#9fb3c4': '#c6d4e0', '#b8a890': '#d8cbb3', '#9aa4ae': '#c3cbd3',
  '#8f9aa6': '#bcc5cf', '#8d8378': '#bfb5a8', '#aeb8bd': '#cdd5d9', '#aaa18c': '#cfc6b0',
  '#9aa6b2': '#c3ccd6', '#8a96a2': '#b9c3cd', '#8a7f6a': '#bdb29b', '#6c7480': '#a4acb6',
  '#9fc4e6': '#c4dcf2', '#b9c6d3': '#d2dce6',
  '#7f8a96': '#a7b1bb' // nápis zakázaného tlačítka
};
const readableColor = (color) => (typeof color === 'string' ? READABLE_GREYS[color.toLowerCase()] ?? color : color);
const originalSetColor = Phaser.GameObjects.Text.prototype.setColor;
Phaser.GameObjects.Text.prototype.setColor = function (color) {
  return originalSetColor.call(this, readableColor(color));
};

// Výchozí písmo pro všechny texty vytvořené ve hře.
const textFactory = Phaser.GameObjects.GameObjectFactory.prototype;
const originalText = textFactory.text;

if (typeof originalText === 'function') {
  textFactory.text = function (x, y, text, style = {}) {
    const textObject = originalText.call(this, x, y, text, {
      fontFamily: 'Lora, Georgia, "Times New Roman", serif',
      ...style,
      ...(style.color ? { color: readableColor(style.color) } : {})
    });

    return textObject.setResolution(3);
  };
}

// Texty se vykreslují do textury ve vyšším rozlišení a do obrazu se zmenšují. Hra je v režimu
// pixelArt (ostré sprity), takže by se zmenšovaly „nejbližším pixelem“ a tenké tahy písmen by
// mizely. Vyhlazený filtr dostanou jen texty – Phaser je jediné volá s noRepeat = true.
function smoothTextTextures(game) {
  const renderer = game.renderer;
  if (!renderer?.gl || typeof renderer.canvasToTexture !== 'function') return;
  const original = renderer.canvasToTexture.bind(renderer);
  renderer.canvasToTexture = (srcCanvas, dstTexture, noRepeat, flipY) => {
    if (noRepeat !== true) return original(srcCanvas, dstTexture, noRepeat, flipY);
    const antialias = renderer.config.antialias;
    renderer.config.antialias = true;
    try {
      return original(srcCanvas, dstTexture, noRepeat, flipY);
    } finally {
      renderer.config.antialias = antialias;
    }
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
    QuestsScene,
    SoulClashScene,
    PauseScene,
    OwnShopScene
  ]
});

fontsReady.then(() => {
  const game = startGame();
  // Čitelnost písma: vyhlazené textury textů a vyhlazené zmenšení obrazu na menší okno
  // (pixelArt nastavuje plátnu „crisp“ vykreslení – přepsat po spuštění).
  game.events.once(Phaser.Core.Events.READY, () => {
    smoothTextTextures(game);
    game.canvas.style.imageRendering = 'auto';
  });
  // Vlastní obchody (Diplomacie) prodávají během hraní – čas běží s herní smyčkou.
  game.events.on(Phaser.Core.Events.STEP, (time, delta) => tickBusiness(delta));
  // Jen při vývoji (npm run dev): hra je dostupná v konzoli prohlížeče jako window.game.
  if (import.meta.env.DEV) window.game = game;
});
