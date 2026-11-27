import Phaser from 'phaser';
import { getItem } from '../data/items.js';
import { RARITY } from '../data/fishing.js';
import { itemIconKey } from './inventorySprites.js';

// Společný vzhled karty Řemesla a oken výroby: tmavé dlaždice a řádky, zlatý vybraný stav,
// tmavé panely s nadpisy sekcí a ikony předmětů v rámečku barvy vzácnosti.

export const LOOK = {
  fill: 0x0c1726, hoverFill: 0x16283e, activeFill: 0x3a2a12,
  line: 0x34506c, hoverLine: 0xd8b25a, gold: 0xffd76a
};

export const rarityColor = (item) => (RARITY[item?.rarity] ?? RARITY.common).color;
export const hexColor = (css) => Phaser.Display.Color.HexStringToColor(css).color;

export function roundBox(g, x, y, w, h, fill, fillAlpha, line, lineAlpha, lineWidth, radius = 8) {
  g.fillStyle(fill, fillAlpha).fillRoundedRect(x, y, w, h, radius);
  if (lineWidth) g.lineStyle(lineWidth, line, lineAlpha).strokeRoundedRect(x, y, w, h, radius);
}

// Dlaždice / řádek ve stavu normální – pod myší – vybraný (se zlatým proužkem vlevo).
export function drawTile(g, x, y, w, h, { active = false, hover = false, radius = 10 } = {}) {
  g.clear();
  roundBox(g, x, y, w, h,
    active ? LOOK.activeFill : hover ? LOOK.hoverFill : LOOK.fill, active ? 0.95 : 0.85,
    active ? LOOK.gold : hover ? LOOK.hoverLine : LOOK.line, active || hover ? 1 : 0.8,
    active ? 2.5 : 1.5, radius);
  if (active) g.fillStyle(LOOK.gold, 1).fillRoundedRect(x + 4, y + 8, 5, h - 16, 2);
}

// Klikací řádek (grafika + zóna). Vrací [grafika, zóna] – volající je přidá do kontejneru.
export function tileRow(scene, x, y, w, h, selected, onClick, radius = 8) {
  const g = scene.add.graphics();
  drawTile(g, x, y, w, h, { active: selected, radius });
  const zone = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => drawTile(g, x, y, w, h, { active: selected, hover: true, radius }));
  zone.on('pointerout', () => drawTile(g, x, y, w, h, { active: selected, radius }));
  zone.on('pointerdown', onClick);
  return [g, zone];
}

// Panel detailu: tmavý, tenký zlatavý okraj a jemná vnitřní linka.
export function darkPanel(scene, x, y, w, h) {
  const g = scene.add.graphics();
  roundBox(g, x, y, w, h, 0x08111d, 0.85, 0x8a6a30, 0.9, 1.5, 12);
  g.lineStyle(1, LOOK.gold, 0.16).strokeRoundedRect(x + 6, y + 6, w - 12, h - 12, 9);
  return g;
}

// Zlatá linka za nadpisem sekce (od konce textu po pravý okraj).
export function headingLine(scene, text, x, w) {
  const g = scene.add.graphics();
  g.lineStyle(1.5, LOOK.gold, 0.4).lineBetween(text.x + text.width + 14, text.y + text.height / 2 + 1, x + w, text.y + text.height / 2 + 1);
  return g;
}

// Ikona předmětu (nebo null, když chybí textura).
export function itemIcon(scene, itemId, x, y, size) {
  const item = getItem(itemId);
  const key = item?.icon ? itemIconKey(item.icon) : null;
  if (!key || !scene.textures.exists(key)) return null;
  const image = scene.add.image(x, y, key).setOrigin(0.5);
  image.setScale(size / Math.max(image.width, image.height));
  return image;
}

// Označení předmětu pro úkol (obchody, okna výroby): zlatý rámeček řádku, zlaté „!“ a štítek
// „Úkol: máš/potřeba“ (skutečný stav, např. 3/1; splněno zeleně s ✓). Předmět pro víc úkolů
// má štítek pro každý úkol s jeho názvem a barvou; když běží víc úkolů (row.named), má název
// a barvu úkolu i štítek s jediným úkolem. row = { named, quests: [{ title, need, have, color }] }.
// tagRight = pravý okraj štítků, maxW = nejširší štítek. Vrací { objects, width }.
export function questMarkObjects(scene, x, y, w, h, row, cardText, tagRight = x + w - 14, maxW = 220, frame = true) {
  const objects = [];
  if (frame) {
    const g = scene.add.graphics();
    roundBox(g, x, y, w, h, 0x3a2a12, 0.55, LOOK.gold, 1, 2.5, 10);
    objects.push(g, cardText(scene, x + 10, y + h / 2, '!', { size: 30, bold: true, color: '#ffd23a', originX: 0.5, originY: 0.5, strokeThickness: 5 }));
  }
  const quests = row.quests ?? [];
  const single = quests.length === 1 && !row.named;
  const size = quests.length === 1 ? 19 : 16;
  const lineH = Math.min(22, (h - 6) / Math.max(1, quests.length));
  let width = 0;
  quests.forEach((q, i) => {
    const done = q.have >= q.need;
    const text = `${single ? 'Úkol:' : q.title} ${q.have}/${q.need}${done ? ' ✓' : ''}`;
    const color = single ? (done ? '#8fe08a' : '#ffd76a') : q.color;
    const cy = y + h / 2 + (i - (quests.length - 1) / 2) * lineH;
    const tag = cardText(scene, tagRight, cy, text, { size, bold: true, color, originX: 1, originY: 0.5 });
    if (tag.width > maxW) tag.setScale(maxW / tag.width);
    width = Math.max(width, tag.displayWidth);
    objects.push(tag);
  });
  return { objects, width };
}

export function questBuyMark(scene, x, y, w, h, row, cardText, tagRight = x + w - 14, maxW = 220) {
  return questMarkObjects(scene, x, y, w, h, row, cardText, tagRight, maxW).objects;
}

// Ikona v rámečku barvy vzácnosti. Vrací pole objektů.
export function framedIcon(scene, itemId, cx, cy, size) {
  const g = scene.add.graphics();
  const half = size / 2 + 8;
  roundBox(g, cx - half, cy - half, half * 2, half * 2, 0x05080c, 0.85, hexColor(rarityColor(getItem(itemId))), 0.9, 2, 10);
  const icon = itemIcon(scene, itemId, cx, cy, size);
  return [g, icon].filter(Boolean);
}

// Zlatá hvězdička u nově odemčeného receptu (pulzuje). Zmizí, když hráč najede myší na řádek
// area { x, y, w, h }; onSeen() si to zapamatuje. Hlídá se pohyb myši, takže řádek pod
// hvězdičkou zůstává klikatelný. Vrací objekty k přidání do vrstvy.
export function newRecipeStar(scene, cx, cy, area, onSeen) {
  const star = scene.add.text(cx, cy, '★', {
    fontFamily: 'Lora, Georgia, serif', fontSize: '30px', color: '#ffd23a', stroke: '#5a3a00', strokeThickness: 4
  }).setOrigin(0.5);
  scene.tweens.add({ targets: star, scale: { from: 1, to: 1.2 }, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const inside = (p) => p.x >= area.x && p.x <= area.x + area.w && p.y >= area.y && p.y <= area.y + area.h;
  const onMove = (pointer) => {
    if (!star.active || !inside(pointer)) return;
    scene.input.off('pointermove', onMove);
    onSeen?.();
    scene.tweens.killTweensOf(star);
    scene.tweens.add({ targets: star, alpha: 0, scale: 1.7, duration: 260, onComplete: () => star.destroy() });
  };
  scene.input.on('pointermove', onMove);
  star.once('destroy', () => scene.input.off('pointermove', onMove));
  return [star];
}
