// Grafika stavů horní lišty a tlačítka Zavřít na kartě hrdiny.
//
// Záložky: list „Herní navigační lišty v různých stavech“ (tab-states.png) má
// 4 řádky stavů na bílém pozadí. Používáme 1. řádek = klid (nezobrazená karta),
// 2. řádek = pod myší (zlatý), 3. řádek = aktivní karta (modrý).
// Hranice záložek jsou změřené podle zářezů mezi nimi (stejné ve všech řádcích).
//
// Zavřít: „Čtyři stavy fantasy tlačítka Zavřít“ (close-states.png) – 4 tlačítka
// vedle sebe: klid, pod myší, aktivní (stisk), nedostupné.

export const TAB_SHEET_KEY = 'hero-card-tab-states';
export const TAB_SHEET_PATH = 'assets/ui/hero/tab-states.png';
export const CLOSE_SHEET_KEY = 'hero-card-close-states';
export const CLOSE_SHEET_PATH = 'assets/ui/hero/close-states.png';

export const TAB_STATES = ['normal', 'hover', 'active'];
const TAB_ROWS = {
  normal: { y: 53, h: 122 },
  hover: { y: 223, h: 122 },
  active: { y: 386, h: 122 }
};
const TAB_EDGES = [26, 377, 634, 886, 1154, 1430, 1678, 1917, 2159];

export const CLOSE_STATES = ['normal', 'hover', 'active', 'disabled'];
const CLOSE_COLUMNS = [[4, 534], [545, 1083], [1091, 1625], [1635, 2168]];
const CLOSE_ROW = { y: 236, h: 240 };

export const tabStateKey = (state, index) => `hero-card-tab-${state}-${index}`;
export const activeTabKey = (index) => tabStateKey('active', index);
export const closeStateKey = (state) => `hero-card-close-${state}`;

export function loadTabSprites(scene) {
  scene.load.image(TAB_SHEET_KEY, TAB_SHEET_PATH);
  scene.load.image(CLOSE_SHEET_KEY, CLOSE_SHEET_PATH);
}

function cut(scene, sheet, key, x, y, w, h) {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sheet, x, y, w, h, 0, 0, w, h);
  clearWhiteFromEdges(ctx, w, h);
  scene.textures.addCanvas(key, canvas);
}

// Vyřízne záložky ve třech stavech a tlačítko Zavřít ve čtyřech stavech,
// bílé pozadí kolem nich udělá průhledné.
export function prepareTabSprites(scene) {
  let ok = false;

  if (scene.textures.exists(TAB_SHEET_KEY)) {
    const sheet = scene.textures.get(TAB_SHEET_KEY).getSourceImage();
    for (const state of TAB_STATES) {
      const row = TAB_ROWS[state];
      for (let i = 0; i < TAB_EDGES.length - 1; i += 1) {
        cut(scene, sheet, tabStateKey(state, i), TAB_EDGES[i], row.y, TAB_EDGES[i + 1] - TAB_EDGES[i], row.h);
      }
    }
    scene.textures.remove(TAB_SHEET_KEY);
    ok = true;
  }

  if (scene.textures.exists(CLOSE_SHEET_KEY)) {
    const sheet = scene.textures.get(CLOSE_SHEET_KEY).getSourceImage();
    CLOSE_STATES.forEach((state, index) => {
      const [x0, x1] = CLOSE_COLUMNS[index];
      cut(scene, sheet, closeStateKey(state), x0, CLOSE_ROW.y, x1 - x0, CLOSE_ROW.h);
    });
    scene.textures.remove(CLOSE_SHEET_KEY);
  }

  return ok;
}

// Bílá dotýkající se okraje výřezu → průhledná; světlý lem se zjemní.
export function clearWhiteFromEdges(ctx, width, height) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const visited = new Uint8Array(width * height);
  const stack = [];

  const isWhite = (p) => {
    const i = p * 4;
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    return min >= 225 && max - min < 28;
  };

  const push = (x, y) => {
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isWhite(p)) stack.push(p);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  const removed = new Uint8Array(width * height);

  while (stack.length) {
    const p = stack.pop();
    removed[p] = 1;
    data[p * 4 + 3] = 0;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = y * width + x;
      if (removed[p]) continue;
      if (!(removed[p - 1] || removed[p + 1] || removed[p - width] || removed[p + width])) continue;

      const i = p * 4;
      const brightness = Math.min(data[i], data[i + 1], data[i + 2]);
      if (brightness > 180) {
        data[i + 3] = Math.round(data[i + 3] * Math.max(0, 1 - (brightness - 180) / 75));
      }
    }
  }

  ctx.putImageData(image, 0, 0);
}
