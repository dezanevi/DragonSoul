import Phaser from 'phaser';
import { normalizeElement } from '../systems/ElementSystem.js';

// Jednoduché provizorní modely monster kreslené vektorově (Phaser Graphics).
// Tvar se odvodí z názvu druhu (vlk → čtvernožec, drak → drak s křídly,
// wisp → plovoucí koule…), barva z elementu. Finální grafika přijde později –
// stačí nahradit createMonsterModel.

export const ELEMENT_COLORS = {
  flame: 0xff7a3d,
  water: 0x3fa9ff,
  stone: 0xb89463,
  air: 0xb8e6ff,
  verdant: 0x62c96c,
  shadow: 0x8a6bff,
  astral: 0xf3d36b,
  neutral: 0xc8c8c8
};

export const ELEMENT_LABELS = {
  flame: 'Plamen',
  water: 'Voda',
  stone: 'Kámen',
  air: 'Vzduch',
  verdant: 'Příroda',
  shadow: 'Stín',
  astral: 'Astrál',
  neutral: 'Neutrální'
};

const ARCHETYPES = [
  ['dragon', /dragon|drake|wyvern|wyrm/],
  ['serpent', /worm|serpent|snake|eel|naga|hydra|basilisk/],
  ['avian', /bird|hawk|eagle|owl|harpy|phoenix|griffin|roc|raven|bat/],
  ['floater', /wisp|elemental|spirit|ghost|wraith|orb|sprite|fairy|soul|shade/],
  ['slime', /slime|ooze|jelly|blob/],
  ['biped', /goblin|imp|troll|golem|ogre|orc|kobold|knight|giant|treant|mage|minotaur/],
  ['quadruped', /wolf|hound|boar|fox|bear|cat|lynx|stag|deer|tiger|lion|ram|beast|dog|panther|bull|tortoise|turtle|lizard|salamander|crab|spider|scorpion/]
];

export function monsterArchetype(speciesId = '') {
  const id = String(speciesId).toLowerCase();
  return ARCHETYPES.find(([, test]) => test.test(id))?.[0] ?? 'slime';
}

export function elementColor(element) {
  return ELEMENT_COLORS[normalizeElement(element)] ?? ELEMENT_COLORS.neutral;
}

const shade = (color, amount) => {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v) => Phaser.Math.Clamp(Math.round(v * amount), 0, 255);
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
};
const tint = (color, amount) => {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v) => Phaser.Math.Clamp(Math.round(v + (255 - v) * amount), 0, 255);
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
};

// Model: kontejner { shadow, ring, body }. Tělo kreslíme natočené doprava;
// nepřátelé se zrcadlí, aby hleděli doleva.
export function createMonsterModel(scene, { speciesId, element, side, boss = false }) {
  const color = elementColor(element);
  const archetype = monsterArchetype(speciesId);
  const container = scene.add.container(0, 0);

  const ring = scene.add.graphics();
  const sideColor = side === 'player' ? 0x52e0ff : 0xff5468;
  ring.fillStyle(sideColor, 0.16).fillEllipse(0, 0, 118, 38);
  ring.lineStyle(3, sideColor, 0.85).strokeEllipse(0, 0, 112, 34);

  const shadowG = scene.add.graphics();
  shadowG.fillStyle(0x000000, 0.35).fillEllipse(0, 2, 96, 26);

  const body = scene.add.container(0, 0);
  const g = scene.add.graphics();
  body.add(g);
  drawArchetype(g, archetype, color);

  if (side === 'enemy') body.setScale(-1, 1);
  if (boss) body.setScale(body.scaleX * 1.35, 1.35);

  container.add([shadowG, ring, body]);
  container.setData({ body, ring, archetype, color });

  // Klidové „dýchání“ – plovoucí tvary se vznášejí víc.
  const floating = archetype === 'floater' || archetype === 'avian';
  scene.tweens.add({
    targets: body,
    y: floating ? -12 : -4,
    scaleY: body.scaleY * (floating ? 1 : 1.03),
    duration: floating ? 1300 : 900 + Math.random() * 300,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
    delay: Math.random() * 600
  });

  return container;
}

function eye(g, x, y, r, glow = 0x111111) {
  g.fillStyle(0xffffff, 1).fillCircle(x, y, r);
  g.fillStyle(glow, 1).fillCircle(x + r * 0.25, y + r * 0.1, r * 0.55);
  g.fillStyle(0xffffff, 0.9).fillCircle(x + r * 0.45, y - r * 0.3, r * 0.22);
}

function drawArchetype(g, archetype, color) {
  const dark = shade(color, 0.62);
  const deep = shade(color, 0.42);
  const light = tint(color, 0.35);

  switch (archetype) {
    case 'quadruped': {
      // Nohy.
      g.fillStyle(deep, 1);
      for (const x of [-30, -14, 14, 28]) g.fillRoundedRect(x - 6, -30, 12, 32, 5);
      // Ocas.
      g.lineStyle(10, dark, 1).beginPath();
      g.moveTo(-40, -52); g.lineTo(-58, -70); g.lineTo(-62, -82); g.strokePath();
      // Tělo.
      g.fillStyle(dark, 1).fillEllipse(0, -46, 92, 46);
      g.fillStyle(color, 1).fillEllipse(-2, -52, 86, 36);
      g.fillStyle(light, 0.55).fillEllipse(-6, -62, 52, 12);
      // Hlava.
      g.fillStyle(dark, 1).fillEllipse(40, -70, 40, 34);
      g.fillStyle(color, 1).fillEllipse(42, -74, 36, 28);
      g.fillStyle(dark, 1).fillTriangle(28, -84, 36, -106, 44, -86);
      g.fillStyle(dark, 1).fillTriangle(42, -86, 52, -104, 56, -82);
      g.fillStyle(deep, 1).fillEllipse(60, -66, 18, 12);
      eye(g, 48, -76, 5);
      break;
    }
    case 'dragon': {
      // Křídla.
      g.fillStyle(deep, 0.95).fillTriangle(-10, -70, -70, -140, 20, -96);
      g.fillStyle(dark, 0.95).fillTriangle(0, -72, -40, -150, 34, -98);
      // Nohy a ocas.
      g.fillStyle(deep, 1);
      for (const x of [-26, -10, 14, 28]) g.fillRoundedRect(x - 7, -28, 14, 30, 6);
      g.fillStyle(dark, 1).fillTriangle(-36, -40, -92, -30, -36, -58);
      // Tělo a krk.
      g.fillStyle(dark, 1).fillEllipse(0, -46, 90, 48);
      g.fillStyle(color, 1).fillEllipse(-2, -52, 84, 38);
      g.fillStyle(light, 0.6).fillEllipse(-4, -40, 54, 14);
      g.fillStyle(color, 1).fillRoundedRect(26, -98, 18, 50, 9);
      // Hlava s rohy.
      g.fillStyle(dark, 1).fillEllipse(48, -104, 44, 28);
      g.fillStyle(color, 1).fillEllipse(50, -108, 40, 22);
      g.fillStyle(light, 1).fillTriangle(34, -114, 22, -138, 42, -118);
      g.fillStyle(light, 1).fillTriangle(46, -116, 42, -142, 54, -118);
      eye(g, 56, -110, 5, 0x6a1010);
      break;
    }
    case 'serpent': {
      const segments = [[-44, -18, 26], [-24, -30, 30], [-2, -36, 32], [18, -48, 30], [30, -68, 28]];
      for (const [x, y, r] of segments) {
        g.fillStyle(dark, 1).fillCircle(x, y, r * 0.62);
        g.fillStyle(color, 1).fillCircle(x - 2, y - 3, r * 0.52);
      }
      g.fillStyle(dark, 1).fillEllipse(42, -88, 46, 34);
      g.fillStyle(color, 1).fillEllipse(44, -92, 42, 28);
      g.fillStyle(light, 0.6).fillEllipse(38, -98, 22, 8);
      g.fillStyle(deep, 1).fillEllipse(62, -84, 14, 8);
      eye(g, 48, -96, 5, 0x401010);
      break;
    }
    case 'avian': {
      g.fillStyle(deep, 1).fillRoundedRect(-8, -26, 6, 24, 3).fillRoundedRect(6, -26, 6, 24, 3);
      g.fillStyle(dark, 1).fillTriangle(-14, -66, -76, -110, -8, -46);
      g.fillStyle(dark, 1).fillEllipse(0, -56, 60, 48);
      g.fillStyle(color, 1).fillEllipse(0, -60, 54, 40);
      g.fillStyle(light, 0.6).fillEllipse(6, -48, 30, 14);
      g.fillStyle(color, 1).fillCircle(26, -88, 18);
      g.fillStyle(0xf2b13c, 1).fillTriangle(40, -92, 58, -86, 40, -80);
      eye(g, 30, -92, 5);
      break;
    }
    case 'floater': {
      g.fillStyle(color, 0.18).fillCircle(0, -70, 52);
      g.fillStyle(color, 0.35).fillCircle(0, -70, 40);
      g.fillStyle(color, 1).fillCircle(0, -70, 28);
      g.fillStyle(light, 1).fillCircle(-6, -78, 14);
      g.fillStyle(0xffffff, 0.9).fillCircle(-10, -82, 5);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.fillStyle(light, 0.9).fillCircle(Math.cos(a) * 46, -70 + Math.sin(a) * 18, 4);
      }
      eye(g, 8, -70, 4, 0x1a1a40);
      break;
    }
    case 'biped': {
      g.fillStyle(deep, 1).fillRoundedRect(-18, -34, 14, 34, 6).fillRoundedRect(4, -34, 14, 34, 6);
      g.fillStyle(dark, 1).fillRoundedRect(-30, -86, 60, 58, 18);
      g.fillStyle(color, 1).fillRoundedRect(-26, -84, 52, 50, 16);
      g.fillStyle(light, 0.55).fillRoundedRect(-18, -80, 30, 12, 6);
      g.fillStyle(dark, 1).fillRoundedRect(-42, -80, 14, 40, 7).fillRoundedRect(28, -80, 14, 40, 7);
      g.fillStyle(dark, 1).fillCircle(4, -104, 22);
      g.fillStyle(color, 1).fillCircle(5, -107, 19);
      g.fillStyle(dark, 1).fillTriangle(-14, -114, -30, -128, -8, -122);
      g.fillStyle(dark, 1).fillTriangle(20, -116, 36, -132, 14, -124);
      eye(g, 12, -108, 5, 0x5a1a10);
      break;
    }
    default: {
      // Sliz / neznámý tvar: kupole.
      g.fillStyle(dark, 1).fillEllipse(0, -32, 92, 66);
      g.fillStyle(color, 1).fillEllipse(0, -36, 84, 58);
      g.fillStyle(light, 0.6).fillEllipse(-14, -52, 34, 14);
      g.fillStyle(0xffffff, 0.75).fillCircle(-22, -56, 4);
      eye(g, 12, -40, 7);
      eye(g, -8, -40, 6);
    }
  }
}
