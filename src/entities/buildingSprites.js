// Grafika budov. Obrázky z generátoru mají bílé pozadí, které se při
// načtení hry automaticky odstraní (bílá plocha propojená s okrajem obrázku).
// Obrázek se pak ořízne na samotnou budovu, aby spodní okraj = základy domu.
//
//   path     cesta k obrázku
//   scale    šířka obrázku jako násobek šířky půdorysu na obrazovce
//            (izometrický půdorys: od levého po pravý roh kosodélníku)
//   offsetY  posun dolů (px) pod přední (jihovýchodní) roh půdorysu – schody, stín

export const BUILDING_SPRITES = {
  greenvale_town_hall: { path: 'assets/buildings/greenvale/town-hall.webp', scale: 1, offsetY: 12 },
  greenvale_tavern: { path: 'assets/buildings/greenvale/tavern.webp', scale: 1, offsetY: 12 },
  greenvale_market: { path: 'assets/buildings/greenvale/market.webp', scale: 1, offsetY: 12 },
  greenvale_smithy: { path: 'assets/buildings/greenvale/smithy.webp', scale: 1, offsetY: 12 },
  greenvale_fishing_hut: { path: 'assets/buildings/greenvale/fishing-hut.webp', scale: 1, offsetY: 12 },
  greenvale_hunter_lodge: { path: 'assets/buildings/greenvale/hunter-lodge.webp', scale: 1, offsetY: 12 },
  greenvale_home_1: { path: 'assets/buildings/greenvale/home-a.webp', scale: 1, offsetY: 12 },
  greenvale_home_2: { path: 'assets/buildings/greenvale/home-b.webp', scale: 1, offsetY: 12 },
  greenvale_home_3: { path: 'assets/buildings/greenvale/home-c.webp', scale: 1, offsetY: 12 }
};

export function buildingTextureKey(buildingId) {
  return `building-${buildingId}`;
}

function rawKey(buildingId) {
  return `building-raw-${buildingId}`;
}

export function loadBuildingTextures(scene) {
  for (const [id, sprite] of Object.entries(BUILDING_SPRITES)) {
    if (!scene.textures.exists(buildingTextureKey(id))) {
      scene.load.image(rawKey(id), sprite.path);
    }
  }
}

// Vytvoří z načtených obrázků textury bez bílého pozadí.
export function prepareBuildingTextures(scene) {
  for (const id of Object.keys(BUILDING_SPRITES)) {
    const key = buildingTextureKey(id);
    if (scene.textures.exists(key) || !scene.textures.exists(rawKey(id))) continue;

    const source = scene.textures.get(rawKey(id)).getSourceImage();
    const canvas = removeWhiteBackground(source);
    scene.textures.addCanvas(key, canvas);
    scene.textures.remove(rawKey(id));
  }
}

// Odstraní bílé pozadí spojené s okrajem obrázku a ořízne prázdné okraje.
export function removeWhiteBackground(image, threshold = 232) {
  const width = image.width;
  const height = image.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);

  const pixels = ctx.getImageData(0, 0, width, height);
  const data = pixels.data;

  const isBackground = (index) => {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    if (a < 10) return true;
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    return min >= threshold && max - min < 24;
  };

  // Vyplňování od okrajů: smaže jen bílou, která se dotýká okraje,
  // takže bílá okna nebo pěna na pivu zůstanou.
  const visited = new Uint8Array(width * height);
  const stack = [];

  const push = (x, y) => {
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isBackground(p * 4)) stack.push(p);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
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

  // Zjemnění světlého lemu kolem budovy (zbytky vyhlazení k bílé).
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      if (removed[p]) continue;
      const nearRemoved =
        removed[p - 1] || removed[p + 1] || removed[p - width] || removed[p + width];
      if (!nearRemoved) continue;

      const index = p * 4;
      const brightness = Math.min(data[index], data[index + 1], data[index + 2]);
      if (brightness > 190) {
        data[index + 3] = Math.round(data[index + 3] * (1 - (brightness - 190) / 65));
      }
    }
  }

  // Ořez na neprůhledný obsah.
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  ctx.putImageData(pixels, 0, 0);

  if (right < left) return canvas;

  const trimmed = document.createElement('canvas');
  trimmed.width = right - left + 1;
  trimmed.height = bottom - top + 1;
  trimmed.getContext('2d').drawImage(
    canvas,
    left, top, trimmed.width, trimmed.height,
    0, 0, trimmed.width, trimmed.height
  );

  return trimmed;
}
