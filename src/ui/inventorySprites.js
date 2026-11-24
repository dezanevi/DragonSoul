// Grafika karty Inventář. Podklad karty, sloty výbavy, políčka, kategorie a šipky sestaví
// ui/newUiKit.js z nové sady UI. Nabídka pravého tlačítka v nové sadě není – zůstává ze
// starého UI (public/assets/ui/legacy, bílé pozadí se při startu zprůhlední):
//   right-click-menu-empty.png  nabídka pravého tlačítka (tmavé řádky)
//   right-click-menu-hoover.png stejná nabídka s modrými řádky (řádek pod myší)

import { clearWhiteFromEdges } from './heroCard/tabSprites.js';
import { ITEMS } from '../data/items.js';
import { EQUIPMENT_SLOT_IDS } from '../systems/EquipmentSystem.js';

export const INVENTORY_CARD = 'inventory-card';
const SHEETS = {
  hover: { key: 'inventory-hover-sheet', path: null }, // nahrazeno ui/newUiKit.js
  menu: { key: 'inventory-menu-sheet', path: 'assets/ui/legacy/right-click-menu-empty.png' },
  menuHover: { key: 'inventory-menu-hover-sheet', path: 'assets/ui/legacy/right-click-menu-hoover.png' }
};

// Výřezy v hoover-icon.png: [x, y, w, h] pro výchozí a hover stav.
const EQUIP_X = [[136, 163], [323, 163], [507, 163], [690, 164], [875, 164], [1058, 158], [1230, 154], [1397, 139]];
const EQUIP_ROWS = { normal: [38, 158], hover: [219, 157] };
const EMPTY_SLOT = { normal: [32, 452, 163, 161], hover: [217, 451, 159, 162] };
const CATEGORY_X = {
  normal: [36, 158, 278, 397, 517, 637],
  hover: [794, 917, 1036, 1156, 1277, 1398]
};
const CATEGORY_ROWS = { normal: [662, 117, 118], hover: [658, 121, 120] };
const ARROWS = {
  left: { normal: [79, 846, 72, 116], hover: [455, 846, 72, 116] },
  right: { normal: [265, 846, 70, 116], hover: [639, 846, 71, 116] }
};

// Nabídka: celý rámeček a řádky (Použít, Vybavit, Přesunout, Rozdělit, Zahodit) + šestý řádek
// „Kde se používá“, který se při startu dokreslí pod Zahodit (obrázek se o řádek prodlouží).
const SOURCE_MENU_H = 879;
const EXTRA_ROW_SRC = [655, 777]; // řádek Zahodit – vzor pro nový řádek
const EXTRA_ROW_H = EXTRA_ROW_SRC[1] - EXTRA_ROW_SRC[0];
export const MENU_BOX = { x: 342, y: 40, w: 854, h: SOURCE_MENU_H + EXTRA_ROW_H };
export const MENU_ROWS = [[160, 282], [287, 404], [408, 526], [530, 647], [653, 777], [779, 777 + EXTRA_ROW_H]];
export const MENU_ROW_X = [404, 1135];
export const MENU_ACTIONS = ['use', 'equip', 'move', 'split', 'drop', 'uses'];
const EXTRA_LABEL = 'Kde se používá';
const EXTRA_ICON = 'nu-icon-book';

export const equipKey = (slot, state) => `inv-eq-${slot}-${state}`;
export const slotKey = (state) => `inv-slot-${state}`;
export const categoryKey = (id, state) => `inv-cat-${id}-${state}`;
export const arrowKey = (dir, state) => `inv-arrow-${dir}-${state}`;
export const MENU_KEY = 'inv-menu';
export const menuRowKey = (index) => `inv-menu-row-${index}`;
export const itemIconKey = (icon) => `item-${icon}`;

const CATEGORY_IDS = ['armor', 'materials', 'potions', 'accessories', 'keys', 'other'];

export function loadInventorySprites(scene) {
  for (const { key, path } of Object.values(SHEETS)) if (path) scene.load.image(key, path);
  // Ikony jen pro předměty, které ve hře existují (ostatní se přiřadí později).
  for (const item of Object.values(ITEMS)) {
    if (item.icon) scene.load.image(itemIconKey(item.icon), `assets/items/icons/${item.icon}.png`);
  }
}

function cut(scene, source, key, x, y, w, h, clearWhite = true) {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, x, y, w, h, 0, 0, w, h);
  if (clearWhite) clearWhiteFromEdges(ctx, w, h);
  scene.textures.addCanvas(key, canvas);
}

export function prepareInventorySprites(scene) {
  if (scene.textures.exists(SHEETS.hover.key)) {
    const src = scene.textures.get(SHEETS.hover.key).getSourceImage();
    EQUIPMENT_SLOT_IDS.forEach((slot, i) => {
      for (const state of ['normal', 'hover']) {
        const [x, w] = EQUIP_X[i];
        const [y, h] = EQUIP_ROWS[state];
        cut(scene, src, equipKey(slot, state), x, y, w, h);
      }
    });
    for (const state of ['normal', 'hover']) {
      cut(scene, src, slotKey(state), ...EMPTY_SLOT[state]);
      const [y, h, w] = CATEGORY_ROWS[state];
      CATEGORY_IDS.forEach((id, i) => cut(scene, src, categoryKey(id, state), CATEGORY_X[state][i], y, w, h));
      for (const dir of ['left', 'right']) cut(scene, src, arrowKey(dir, state), ...ARROWS[dir][state]);
    }
    scene.textures.remove(SHEETS.hover.key);
  }
  if (scene.textures.exists(SHEETS.menu.key)) {
    const src = scene.textures.get(SHEETS.menu.key).getSourceImage();
    buildMenu(scene, src);
    scene.textures.remove(SHEETS.menu.key);
  }
  if (scene.textures.exists(SHEETS.menuHover.key)) {
    const src = scene.textures.get(SHEETS.menuHover.key).getSourceImage();
    MENU_ROWS.slice(0, 5).forEach(([y0, y1], i) => cut(scene, src, menuRowKey(i), MENU_ROW_X[0], y0, MENU_ROW_X[1] - MENU_ROW_X[0], y1 - y0, false));
    buildExtraHoverRow(scene, src);
    scene.textures.remove(SHEETS.menuHover.key);
  }
}

// ---------------------------------------------------------------- řádek „Kde se používá“

// Ikona a popisek řádku stejně jako namalované řádky (zlatá ikona, krémové patkové písmo).
function drawExtraLabel(scene, ctx, rowX, rowY) {
  const icon = scene.textures.exists(EXTRA_ICON) ? scene.textures.get(EXTRA_ICON).getSourceImage() : null;
  if (icon) {
    const size = 104;
    const k = size / Math.max(icon.width, icon.height);
    ctx.drawImage(icon, rowX + 518 - MENU_BOX.x - (icon.width * k) / 2, rowY + EXTRA_ROW_H / 2 - (icon.height * k) / 2, icon.width * k, icon.height * k);
  }
  ctx.save();
  ctx.font = 'bold 60px Lora, Georgia, "Times New Roman", serif';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#140b04';
  const x = rowX + 632 - MENU_BOX.x;
  const y = rowY + EXTRA_ROW_H / 2 + 2;
  ctx.strokeText(EXTRA_LABEL, x, y);
  ctx.shadowColor = 'transparent';
  const gradient = ctx.createLinearGradient(0, y - 30, 0, y + 30);
  gradient.addColorStop(0, '#fffaf0');
  gradient.addColorStop(1, '#f0d9a6');
  ctx.fillStyle = gradient;
  ctx.fillText(EXTRA_LABEL, x, y);
  ctx.restore();
}

// Zakryje namalovanou ikonu a text řádku prázdným pruhem pozadí ze stejného řádku.
function blankRow(ctx, source, srcY, destX, destY, fromX, toX) {
  const strip = [960, 1090]; // prázdné místo vpravo od textu
  for (let x = fromX; x < toX; x += strip[1] - strip[0]) {
    const w = Math.min(strip[1] - strip[0], toX - x);
    ctx.drawImage(source, strip[0], srcY + 6, w, EXTRA_ROW_H - 16, destX + (x - fromX), destY + 6, w, EXTRA_ROW_H - 16);
  }
}

function buildMenu(scene, src) {
  if (scene.textures.exists(MENU_KEY)) return;
  const canvas = document.createElement('canvas');
  canvas.width = MENU_BOX.w;
  canvas.height = MENU_BOX.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const top = EXTRA_ROW_SRC[1] - MENU_BOX.y; // horní část až pod řádek Zahodit
  ctx.drawImage(src, MENU_BOX.x, MENU_BOX.y, MENU_BOX.w, top, 0, 0, MENU_BOX.w, top);
  // Nový řádek: kopie řádku Zahodit (rám, čára), ikona a text přemalované.
  ctx.drawImage(src, MENU_BOX.x, EXTRA_ROW_SRC[0], MENU_BOX.w, EXTRA_ROW_H, 0, top, MENU_BOX.w, EXTRA_ROW_H);
  blankRow(ctx, src, EXTRA_ROW_SRC[0], 430 - MENU_BOX.x, top, 430, 960);
  drawExtraLabel(scene, ctx, 0, top);
  // Spodní část rámu.
  const rest = SOURCE_MENU_H - top;
  ctx.drawImage(src, MENU_BOX.x, EXTRA_ROW_SRC[1], MENU_BOX.w, rest, 0, top + EXTRA_ROW_H, MENU_BOX.w, rest);
  clearWhiteFromEdges(ctx, canvas.width, canvas.height);
  scene.textures.addCanvas(MENU_KEY, canvas);
}

// Modrý řádek pod myší pro „Kde se používá“ (z modrého řádku Zahodit).
function buildExtraHoverRow(scene, src) {
  const key = menuRowKey(5);
  if (scene.textures.exists(key)) return;
  const w = MENU_ROW_X[1] - MENU_ROW_X[0];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = EXTRA_ROW_H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(src, MENU_ROW_X[0], EXTRA_ROW_SRC[0], w, EXTRA_ROW_H, 0, 0, w, EXTRA_ROW_H);
  blankRow(ctx, src, EXTRA_ROW_SRC[0], 430 - MENU_ROW_X[0], 0, 430, 960);
  drawExtraLabel(scene, ctx, MENU_BOX.x - MENU_ROW_X[0], 0);
  scene.textures.addCanvas(key, canvas);
}
