// Aktivní (modré) záložky z listu „Herní navigační lišty v různých stavech“.
// List má 4 řádky stavů (klid, zlatá, modrá, šedá) na bílém pozadí.
// Bereme 3. řádek; hranice záložek jsou změřené podle zářezů mezi nimi.

export const TAB_SHEET_KEY = 'hero-card-tab-states';
export const TAB_SHEET_PATH = 'assets/ui/hero/tab-states.png';

const ACTIVE_ROW = { y: 392, h: 115 };
const TAB_EDGES = [26, 377, 634, 886, 1154, 1430, 1678, 1917, 2159];

export const activeTabKey = (index) => `hero-card-tab-active-${index}`;

export function loadTabSprites(scene) {
  scene.load.image(TAB_SHEET_KEY, TAB_SHEET_PATH);
}

// Vyřízne 8 modrých záložek a bílé pozadí kolem nich udělá průhledné.
export function prepareTabSprites(scene) {
  if (!scene.textures.exists(TAB_SHEET_KEY)) return false;

  const sheet = scene.textures.get(TAB_SHEET_KEY).getSourceImage();

  for (let i = 0; i < TAB_EDGES.length - 1; i += 1) {
    const key = activeTabKey(i);
    if (scene.textures.exists(key)) continue;

    const x = TAB_EDGES[i];
    const w = TAB_EDGES[i + 1] - x;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = ACTIVE_ROW.h;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(sheet, x, ACTIVE_ROW.y, w, ACTIVE_ROW.h, 0, 0, w, ACTIVE_ROW.h);
    clearWhiteFromEdges(ctx, w, ACTIVE_ROW.h);

    scene.textures.addCanvas(key, canvas);
  }

  scene.textures.remove(TAB_SHEET_KEY);
  return true;
}

// Bílá dotýkající se okraje výřezu → průhledná; světlý lem se zjemní.
function clearWhiteFromEdges(ctx, width, height) {
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
