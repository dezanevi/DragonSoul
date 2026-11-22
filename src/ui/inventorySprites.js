// Grafika karty Inventář (public/assets/ui/inventory). Listy mají bílé pozadí –
// výřezy se při startu hry zprůhlední (stejně jako tlačítka karty hrdiny).
//   inventory.png               podklad karty (1536 × 1024)
//   hoover-icon.png             tmavá = výchozí stav, modrá = pod myší
//   right-click-menu-empty.png  nabídka pravého tlačítka (tmavé řádky)
//   right-click-menu-hoover.png stejná nabídka s modrými řádky (řádek pod myší)

import { clearWhiteFromEdges } from './heroCard/tabSprites.js';
import { ITEMS } from '../data/items.js';
import { EQUIPMENT_SLOT_IDS } from '../systems/EquipmentSystem.js';

export const INVENTORY_CARD = 'inventory-card';
const SHEETS = {
  hover: { key: 'inventory-hover-sheet', path: 'assets/ui/inventory/hoover-icon.png' },
  menu: { key: 'inventory-menu-sheet', path: 'assets/ui/inventory/right-click-menu-empty.png' },
  menuHover: { key: 'inventory-menu-hover-sheet', path: 'assets/ui/inventory/right-click-menu-hoover.png' }
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

// Nabídka: celý rámeček a řádky (Použít, Vybavit, Přesunout, Rozdělit, Zahodit).
export const MENU_BOX = { x: 342, y: 40, w: 854, h: 879 };
export const MENU_ROWS = [[160, 282], [287, 404], [408, 526], [530, 647], [653, 777]];
export const MENU_ROW_X = [404, 1135];
export const MENU_ACTIONS = ['use', 'equip', 'move', 'split', 'drop'];

export const equipKey = (slot, state) => `inv-eq-${slot}-${state}`;
export const slotKey = (state) => `inv-slot-${state}`;
export const categoryKey = (id, state) => `inv-cat-${id}-${state}`;
export const arrowKey = (dir, state) => `inv-arrow-${dir}-${state}`;
export const MENU_KEY = 'inv-menu';
export const menuRowKey = (index) => `inv-menu-row-${index}`;
export const itemIconKey = (icon) => `item-${icon}`;

const CATEGORY_IDS = ['armor', 'materials', 'potions', 'accessories', 'keys', 'other'];

export function loadInventorySprites(scene) {
  scene.load.image(INVENTORY_CARD, 'assets/ui/inventory/inventory.png');
  for (const { key, path } of Object.values(SHEETS)) scene.load.image(key, path);
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
    cut(scene, src, MENU_KEY, MENU_BOX.x, MENU_BOX.y, MENU_BOX.w, MENU_BOX.h);
    scene.textures.remove(SHEETS.menu.key);
  }
  if (scene.textures.exists(SHEETS.menuHover.key)) {
    const src = scene.textures.get(SHEETS.menuHover.key).getSourceImage();
    MENU_ROWS.forEach(([y0, y1], i) => cut(scene, src, menuRowKey(i), MENU_ROW_X[0], y0, MENU_ROW_X[1] - MENU_ROW_X[0], y1 - y0, false));
    scene.textures.remove(SHEETS.menuHover.key);
  }
}
