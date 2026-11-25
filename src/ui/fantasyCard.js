import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { closeStateKey } from './heroCard/tabSprites.js';

// Společné prvky karet ve stylu karty hrdiny: tmavě modrý panel se zlatým rámem,
// písmo Lora (public/assets/fonts), zlatá tlačítka, potvrzovací okno a tlačítko Zavřít z obrázků stavů.

export const CARD_FONT = 'Lora, Georgia, "Times New Roman", serif';
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

// Díl nové sady UI natažený přes 9-slice (ui/newUiKit.js). Jen ve WebGL a když je textura
// načtená – jinak null a volající kreslí náhradní grafiku. scale < 1 = jemnější okraje.
// Okraje dílů ve zdroji (px): tlačítka 44, panel 36, rám karty 124.
const NINE_SLICE = { 'nu-btn': 44, 'nu-btnHover': 44, 'nu-btnActive': 44, 'nu-btnDisabled': 44, 'nu-btnRed': 44, 'nu-panel': 36, 'nu-card': 124 };
export function nineImage(scene, key, x, y, w, h, scale = 1) {
  if (scene.renderer?.type !== Phaser.WEBGL || !scene.textures.exists(key) || typeof scene.add.nineslice !== 'function') return null;
  const s = NINE_SLICE[key] ?? 40;
  // Vnitřní velikost musí pojmout oba rohy (≥ 2 × okraj) – jinak se díl zmenší víc.
  const k = Math.min(scale, Math.min(w, h) / (2 * s));
  return scene.add.nineslice(x + w / 2, y + h / 2, key, undefined, w / k, h / k, s, s, s, s).setScale(k);
}

// Karty (Hrdina, Talenty, Party, Inventář) mají obsah v souřadnicích podkladu 1536 × 1024;
// pás lišty nahoře (CARD_SOURCE.top) se vynechá a zbytek se vejde do panelu karty Mapa.
export const CARD_SOURCE = { w: 1536, h: 1024, top: 28 };
export const CARD_FIT = (() => {
  const p = CARD_PANEL;
  const scale = Math.min(p.w / CARD_SOURCE.w, p.h / (CARD_SOURCE.h - CARD_SOURCE.top));
  return { SCALE: scale, OFFSET_X: p.x + (p.w - CARD_SOURCE.w * scale) / 2, OFFSET_Y: p.y - CARD_SOURCE.top * scale };
})();

// Panel karty (rám karty z nové sady UI) – stejný pro všechny karty, vzor karta Mapa.
// Okolí karty se neztmavuje; průhledná plocha jen chytá kliknutí mimo kartu (blocker: false = bez ní).
export function drawCardFrame(scene, panel = CARD_PANEL, { blocker = true } = {}) {
  if (blocker) scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setOrigin(0).setInteractive();
  const g = scene.add.graphics();
  const { x, y, w, h } = panel;
  g.fillStyle(0x000000, 0.5).fillRoundedRect(x + 10, y + 14, w, h, 26);
  if (nineImage(scene, 'nu-card', x, y, w, h)) return g;
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

// Tlačítko z nové sady UI (modré / světle modré pod myší / šedé nedostupné / červené
// pro nevratné akce); bez WebGL náhradní kreslené. Vrací { setDisabled, setLabel, objects }.
export function cardButton(scene, container, x, y, w, h, label, onClick, options = {}) {
  let disabled = Boolean(options.disabled);
  let active = Boolean(options.active); // zlaté = vybraná volba (kategorie, záložka)
  const danger = Boolean(options.danger);
  // Užší zlaté rámování (menší měřítko okrajů 9-slice); velká tlačítka si drží původní rám.
  const frame = options.frameScale ?? (h <= 70 ? 0.28 : 0.5);
  const sliced = nineImage(scene, danger ? 'nu-btnRed' : 'nu-btn', x, y, w, h, frame);
  const g = sliced ?? scene.add.graphics();
  const draw = (hover) => {
    if (sliced) {
      sliced.setTexture(disabled ? 'nu-btnDisabled' : danger ? 'nu-btnRed' : active ? 'nu-btnActive' : hover ? 'nu-btnHover' : 'nu-btn');
      sliced.setTint(danger && hover && !disabled ? 0xffc8c0 : 0xffffff);
      return;
    }
    g.clear();
    const fill = disabled ? 0x1a2028 : hover || active ? (danger ? 0x5a1a16 : 0x3b2c0c) : danger ? 0x3a1210 : 0x1b2f4c;
    const edge = disabled ? 0x4a5058 : hover || active ? 0xffd76a : danger ? 0xd0574a : CARD_GOLD;
    g.fillStyle(fill, 1).fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2, edge, 1).strokeRoundedRect(x, y, w, h, 10);
  };
  draw(false);
  const text = cardText(scene, x + w / 2, y + h / 2, label, {
    size: options.size ?? 21, // čitelnost tlačítek (pravidlo od hráče)
    bold: true,
    align: 'center', // víceřádkový popisek zarovnaný na střed
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
    setActive(value) { active = Boolean(value); draw(false); },
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
  const g = nineImage(scene, 'nu-panel', x, y, w, h) ?? scene.add.graphics();
  if (g.type === 'Graphics') {
    g.fillStyle(0x0d1d33, 0.98).fillRoundedRect(x, y, w, h, 18);
    g.lineStyle(4, CARD_GOLD, 1).strokeRoundedRect(x, y, w, h, 18);
  }
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

// ------------------------------------------------------------ jednotné UI oken a výzev
// Okna profesí, obchodů, kořisti, dialogy a výzvy „E: …“ ze stejné sady jako karty.

// Vyskakovací okno: ztmavení + panel nové sady (bez WebGL kreslený náhradní). Vrací panel.
export function uiWindow(scene, x, y, w, h, { shade = 0.5, depth } = {}) {
  const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x02060c, shade).setOrigin(0).setInteractive();
  const panel = nineImage(scene, 'nu-panel', x, y, w, h, 0.75);
  let bg = panel;
  if (!bg) {
    bg = scene.add.graphics();
    bg.fillStyle(0x0d1d33, 0.97).fillRoundedRect(x, y, w, h, 18);
    bg.lineStyle(4, CARD_GOLD, 1).strokeRoundedRect(x, y, w, h, 18);
  }
  if (depth !== undefined) { dim.setDepth(depth); bg.setDepth(depth); }
  return bg;
}

// Nadpis okna s ikonou nové sady (nu-icon-*): ikona vlevo, text vedle. Vrací text.
// center: true = x je střed nadpisu (ikona + text).
export function uiTitle(scene, x, y, text, { icon, size = 34, color = '#ffe7ae', center = false } = {}) {
  const key = icon ? `nu-icon-${icon}` : null;
  const iconW = key && scene.textures.exists(key) ? size * 1.5 + 12 : 0;
  const label = cardText(scene, 0, y, text, { size, bold: true, color });
  const left = center ? x - (iconW + label.width) / 2 : x;
  label.setX(left + iconW);
  if (iconW) {
    const img = scene.add.image(left, y + size * 0.62, key).setOrigin(0, 0.5);
    img.setScale((size * 1.5) / Math.max(img.width, img.height));
  }
  return label;
}

// Sekce uvnitř okna (rámeček slotu nové sady). Vrací objekt sekce.
export function uiSection(scene, x, y, w, h) {
  const slot = nineImage(scene, 'nu-slot', x, y, w, h, 0.5);
  if (slot) return slot.setAlpha(0.9);
  const g = scene.add.graphics();
  drawSection(g, x, y, w, h);
  return g;
}

// Ztmavení zlatého „aktivního“ dílu pod textem (barevné názvy na jasné zlaté nejsou čitelné).
export const ACTIVE_ROW_TINT = 0x8a6a40;

// Zvýrazněný (vybraný) řádek seznamu: zlaté aktivní tlačítko nové sady, ztmavené pod text.
export function uiSelectedRow(scene, x, y, w, h) {
  const row = nineImage(scene, 'nu-btnActive', x, y, w, h, 0.4);
  if (row) return row.setTint(ACTIVE_ROW_TINT);
  const g = scene.add.graphics();
  g.fillStyle(0x1b2f4c, 1).fillRoundedRect(x, y, w, h, 8).lineStyle(2, 0xffd76a, 1).strokeRoundedRect(x, y, w, h, 8);
  return g;
}

// Ukazatel průběhu: drážka ze slotu nové sady a výplň s odleskem. Vrací { set(ratio), setVisible(v) }.
export function uiProgressBar(scene, x, y, w, h, color = 0xffc94a) {
  const pad = Math.max(4, Math.round(h * 0.22));
  const track = nineImage(scene, 'nu-slot', x - pad, y - pad, w + pad * 2, h + pad * 2, 0.3);
  const g = scene.add.graphics();
  const draw = (ratio) => {
    g.clear();
    if (!track) g.fillStyle(0x05080c, 0.9).fillRoundedRect(x, y, w, h, h / 2).lineStyle(2, CARD_GOLD, 0.9).strokeRoundedRect(x, y, w, h, h / 2);
    const fw = Math.max(h, w * Math.max(0, Math.min(1, ratio)));
    if (ratio <= 0) return;
    g.fillStyle(color, 1).fillRoundedRect(x, y, fw, h, h / 2);
    g.fillStyle(0xffffff, 0.28).fillRoundedRect(x + 3, y + 2, Math.max(0, fw - 6), h * 0.35, h * 0.2);
  };
  draw(0);
  return {
    set: draw,
    setVisible(visible) { track?.setVisible(visible); g.setVisible(visible); return this; },
    objects: [track, g].filter(Boolean)
  };
}

// Výzva „E: …“ nad hrdinou: text na panelu nové sady, spodní okraj na zadané pozici.
// Řetězí se stejně jako text: setText(…).setPosition(x, y).setVisible(true).
export function uiPrompt(scene, { size = 20, depth = 0, wrap } = {}) {
  const container = scene.add.container(0, 0).setDepth(depth).setVisible(false);
  const label = cardText(scene, 0, 0, '', { size, bold: true, color: '#fff4d6', originX: 0.5, originY: 1, strokeThickness: 3, wrap, align: 'center' });
  let scroll = 1;
  let bg = null;
  let current = null;
  const rebuild = () => {
    bg?.destroy();
    const w = label.width + 40;
    const h = label.height + 18;
    bg = nineImage(scene, 'nu-panel', -w / 2, -h, w, h, 0.4);
    if (!bg) {
      bg = scene.add.graphics();
      bg.fillStyle(0x0d1d33, 0.94).fillRoundedRect(-w / 2, -h, w, h, 10).lineStyle(2, CARD_GOLD, 1).strokeRoundedRect(-w / 2, -h, w, h, 10);
    }
    label.setY(-9);
    container.removeAll(false);
    container.add([bg, label]);
    container.setScrollFactor(scroll, true);
  };
  const api = {
    container,
    setText(value) {
      if (value !== current) { current = value; label.setText(value); rebuild(); }
      return api;
    },
    setPosition(x, y) { container.setPosition(x, y); return api; },
    setVisible(visible) { container.setVisible(visible); return api; },
    setDepth(value) { container.setDepth(value); return api; },
    setScrollFactor(value) { scroll = value; container.setScrollFactor(value, true); return api; },
    destroy() { container.destroy(); }
  };
  return api;
}

// Krátká hláška dole uprostřed obrazovky (ve světě): panel nové sady, po chvíli zmizí.
export function uiToast(scene, text, { y = GAME_HEIGHT - 120, depth = 0, wrap = 1100 } = {}) {
  const toast = uiPrompt(scene, { size: 22, depth, wrap });
  toast.setScrollFactor(0).setText(text).setPosition(GAME_WIDTH / 2, y).setVisible(true);
  scene.tweens.add({ targets: toast.container, alpha: 0, delay: 3200, duration: 500, onComplete: () => toast.destroy() });
  return toast;
}
