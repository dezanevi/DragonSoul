// Tlačítka hlavního menu z jednoho obrázku (public/assets/ui/menu-buttons.webp).
//
// Obrázek má 4 řady × 2 sloupce na bílém pozadí:
//   levý sloupec  = modré tlačítko (v klidu)
//   pravý sloupec = zlaté tlačítko (pod myší)
// Řady shora: Nová hra, Pokračovat, Nahrát hru, Uložit hru.
//
// Při načtení hry se obrázek rozřeže podle bílých mezer a bílé pozadí
// se odstraní, takže nový obrázek se stejným rozvržením stačí jen vyměnit.

import { removeWhiteBackground } from '../entities/buildingSprites.js';

export const MENU_BUTTON_SHEET = 'assets/ui/menu-buttons.webp';
export const MENU_BUTTON_IDS = ['new', 'continue', 'load', 'save'];

const RAW_KEY = 'menu-buttons-raw';

export function menuButtonKey(id, state) {
  return `menu-button-${id}-${state}`;
}

export function loadMenuButtons(scene) {
  if (!scene.textures.exists(menuButtonKey('new', 'normal'))) {
    scene.load.image(RAW_KEY, MENU_BUTTON_SHEET);
  }
}

// Vrátí true, když se podařilo vytvořit všech 8 textur.
export function prepareMenuButtons(scene) {
  if (scene.textures.exists(menuButtonKey('new', 'normal'))) return true;
  if (!scene.textures.exists(RAW_KEY)) return false;

  const source = scene.textures.get(RAW_KEY).getSourceImage();
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const isInk = (x, y) => {
    const i = (y * canvas.width + x) * 4;
    if (data[i + 3] < 20) return false;
    return Math.min(data[i], data[i + 1], data[i + 2]) < 225;
  };

  const rows = findBands(canvas.height, (y) => countInk(canvas.width, (x) => isInk(x, y)));

  if (rows.length !== MENU_BUTTON_IDS.length) {
    console.warn(`menu-buttons: očekávány 4 řady tlačítek, nalezeno ${rows.length}.`);
    return false;
  }

  for (let r = 0; r < rows.length; r++) {
    const [y0, y1] = rows[r];
    const columns = findBands(canvas.width, (x) => countInk(y1 - y0 + 1, (dy) => isInk(x, y0 + dy)));

    if (columns.length !== 2) {
      console.warn(`menu-buttons: řada ${r + 1} má ${columns.length} sloupců místo 2.`);
      return false;
    }

    columns.forEach(([x0, x1], c) => {
      const pad = 4;
      const left = Math.max(0, x0 - pad);
      const top = Math.max(0, y0 - pad);
      const width = Math.min(canvas.width, x1 + pad + 1) - left;
      const height = Math.min(canvas.height, y1 + pad + 1) - top;

      const crop = document.createElement('canvas');
      crop.width = width;
      crop.height = height;
      crop.getContext('2d').drawImage(canvas, left, top, width, height, 0, 0, width, height);

      const key = menuButtonKey(MENU_BUTTON_IDS[r], c === 0 ? 'normal' : 'hover');
      scene.textures.addCanvas(key, removeWhiteBackground(crop));
    });
  }

  scene.textures.remove(RAW_KEY);
  return true;
}

function countInk(length, test) {
  let count = 0;
  for (let i = 0; i < length; i++) if (test(i)) count++;
  return count;
}

// Souvislé úseky s "inkoustem". Mezera = řádek/sloupec, kde je méně než 6 %
// obsahu nejplnějšího řádku (ozdoby tlačítek do mezer trochu zasahují).
// Krátké mezery se spojí, příliš malé úseky (šum) se zahodí.
function findBands(length, inkAt) {
  const counts = Array.from({ length }, (_, i) => inkAt(i));
  const threshold = Math.max(3, Math.max(...counts) * 0.06);
  const bands = [];
  let start = -1;

  for (let i = 0; i < length; i++) {
    const ink = counts[i] > threshold;
    if (ink && start < 0) start = i;
    if (!ink && start >= 0) {
      bands.push([start, i - 1]);
      start = -1;
    }
  }
  if (start >= 0) bands.push([start, length - 1]);

  const merged = [];
  for (const band of bands) {
    const last = merged[merged.length - 1];
    if (last && band[0] - last[1] <= 6) last[1] = band[1];
    else merged.push([...band]);
  }

  return merged.filter(([a, b]) => b - a > 30);
}
