import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { closeStateKey } from './heroCard/tabSprites.js';

// Společné prvky karet ve stylu karty hrdiny: tmavě modrý panel se zlatým rámem,
// písmo Georgia, zlatá tlačítka, potvrzovací okno a tlačítko Zavřít z obrázků stavů.

export const CARD_FONT = 'Georgia, "Times New Roman", serif';
export const CARD_GOLD = 0xd6a23a;
// Nahoře je lišta karet (ui/cardTabBar.js), panel začíná pod ní.
export const CARD_PANEL = { x: 80, y: 100, w: 1760, h: 926 };

export function cardText(scene, x, y, value, options = {}) {
  return scene.add
    .text(x, y, String(value ?? ''), {
      fontFamily: CARD_FONT,
      fontSize: `${options.size ?? 20}px`,
      fontStyle: options.bold ? 'bold' : 'normal',
      color: options.color ?? '#f3e4bd',
      stroke: options.stroke ?? '#0a0603',
      strokeThickness: options.strokeThickness ?? 3,
      align: options.align ?? 'left',
      wordWrap: options.wrap ? { width: options.wrap } : undefined,
      lineSpacing: options.lineSpacing ?? 4
    })
    .setOrigin(options.originX ?? 0, options.originY ?? 0)
    .setResolution(2);
}

// Ztmavení pozadí + velký panel karty.
export function drawCardFrame(scene, panel = CARD_PANEL) {
  scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x02060c, 0.78).setOrigin(0).setInteractive();
  const g = scene.add.graphics();
  const { x, y, w, h } = panel;
  g.fillStyle(0x000000, 0.5).fillRoundedRect(x + 10, y + 14, w, h, 26);
  g.fillGradientStyle(0x14294a, 0x14294a, 0x081325, 0x081325, 1).fillRoundedRect(x, y, w, h, 26);
  g.lineStyle(7, CARD_GOLD, 1).strokeRoundedRect(x, y, w, h, 26);
  g.lineStyle(2, 0xffe3a0, 0.55).strokeRoundedRect(x + 12, y + 12, w - 24, h - 24, 18);
  return g;
}

// Vnitřní rámeček (sekce karty).
export function drawSection(g, x, y, w, h, highlight = false) {
  g.fillStyle(highlight ? 0x1c3a63 : 0x0d1d33, 0.92).fillRoundedRect(x, y, w, h, 16);
  g.lineStyle(highlight ? 3 : 2, highlight ? 0x6fc8ff : 0x8a6a2a, highlight ? 1 : 0.8).strokeRoundedRect(x, y, w, h, 16);
}

// Zlaté tlačítko; vrací { setDisabled, destroy }.
export function cardButton(scene, container, x, y, w, h, label, onClick, options = {}) {
  const g = scene.add.graphics();
  let disabled = Boolean(options.disabled);
  const danger = Boolean(options.danger);
  const draw = (hover) => {
    g.clear();
    const fill = disabled ? 0x1a2028 : hover ? (danger ? 0x5a1a16 : 0x3b2c0c) : danger ? 0x3a1210 : 0x1b2f4c;
    const edge = disabled ? 0x4a5058 : hover ? 0xffd76a : danger ? 0xd0574a : CARD_GOLD;
    g.fillStyle(fill, 1).fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2, edge, 1).strokeRoundedRect(x, y, w, h, 10);
  };
  draw(false);
  const text = cardText(scene, x + w / 2, y + h / 2, label, {
    size: options.size ?? 19,
    bold: true,
    originX: 0.5,
    originY: 0.5,
    color: disabled ? '#7f8a96' : '#f3e4bd'
  });
  const zone = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: !disabled });
  zone.on('pointerover', () => draw(!disabled));
  zone.on('pointerout', () => draw(false));
  zone.on('pointerdown', () => { if (!disabled) onClick(); });
  container?.add([g, text, zone]);
  return {
    setDisabled(value) {
      disabled = Boolean(value);
      text.setColor(disabled ? '#7f8a96' : '#f3e4bd');
      zone.input.cursor = disabled ? 'default' : 'pointer';
      draw(false);
    },
    setLabel(value) { text.setText(value); },
    objects: [g, text, zone]
  };
}

// Potvrzovací / výběrové okno. Vrací kontejner (zničit přes destroy()).
export function openCardModal(scene, title, lines, buttons) {
  const w = 760;
  const rows = Math.ceil(buttons.length / 3);
  const bodyTexts = lines.map((line) => cardText(scene, 0, 0, line, { size: 18, color: '#dbe6f3', wrap: w - 80 }));
  const bodyHeight = bodyTexts.reduce((sum, t) => sum + t.height + 10, 0);
  const h = 120 + bodyHeight + rows * 64 + 30;
  const x = (GAME_WIDTH - w) / 2;
  const y = (GAME_HEIGHT - h) / 2;

  const c = scene.add.container(0, 0).setDepth(200);
  const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0).setInteractive();
  const g = scene.add.graphics();
  g.fillStyle(0x0d1d33, 0.98).fillRoundedRect(x, y, w, h, 18);
  g.lineStyle(4, CARD_GOLD, 1).strokeRoundedRect(x, y, w, h, 18);
  c.add([shade, g, cardText(scene, x + w / 2, y + 26, title, { size: 30, bold: true, color: '#ffe7ae', originX: 0.5 })]);

  let lineY = y + 84;
  for (const t of bodyTexts) {
    t.setPosition(x + 40, lineY);
    c.add(t);
    lineY += t.height + 10;
  }

  const bw = 220;
  buttons.forEach((button, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const inRow = Math.min(3, buttons.length - row * 3);
    const startX = x + (w - (inRow * bw + (inRow - 1) * 16)) / 2;
    cardButton(scene, c, startX + col * (bw + 16), y + h - 40 - rows * 64 + row * 64, bw, 50, button.label, button.onClick, button);
  });
  return c;
}

// Tlačítko Zavřít z obrázků stavů (stejné jako na kartě hrdiny).
export function cardCloseButton(scene, onClose, panel = CARD_PANEL) {
  const x = GAME_WIDTH / 2;
  const y = panel.y + panel.h;
  if (!scene.textures.exists(closeStateKey('normal'))) {
    return cardButton(scene, null, x - 110, y - 30, 220, 56, 'Zavřít', onClose);
  }
  const image = scene.add.image(x, y, closeStateKey('normal')).setDepth(100);
  const fit = () => image.setScale(300 / image.width);
  const show = (state) => { image.setTexture(closeStateKey(state)); fit(); };
  fit();
  image.setInteractive({ useHandCursor: true });
  image.on('pointerover', () => show('hover'));
  image.on('pointerout', () => show('normal'));
  image.on('pointerdown', () => show('active'));
  image.on('pointerup', () => onClose());
  return image;
}

// Krátká hláška vlevo dole na kartě (nahoře je lišta karet, uprostřed Zavřít).
export function cardFlash(scene, message, color = '#ffb3a0') {
  scene.cardFlashText?.destroy();
  scene.cardFlashText = cardText(scene, CARD_PANEL.x + 34, CARD_PANEL.y + CARD_PANEL.h - 52, message, {
    size: 22,
    bold: true,
    color,
    wrap: 640,
    strokeThickness: 4
  }).setDepth(160);
  scene.tweens.add({ targets: scene.cardFlashText, alpha: 0, delay: 2400, duration: 500 });
}

export function drawBar(g, x, y, w, h, ratio, color) {
  g.fillStyle(0x05080c, 0.85).fillRoundedRect(x, y, w, h, h / 2);
  const fill = Math.max(0, Math.min(1, ratio));
  if (fill > 0) g.fillStyle(color, 1).fillRoundedRect(x, y, Math.max(h, w * fill), h, h / 2);
}

export const clamp = Phaser.Math.Clamp;
