// Grafika budov. Obrázky z generátoru mají bílé pozadí, které se při
// načtení hry automaticky odstraní (bílá plocha propojená s okrajem obrázku).
// Obrázek se pak ořízne na samotnou budovu, aby spodní okraj = základy domu.
//
//   path        cesta k obrázku
//   scale       šířka obrázku jako násobek šířky půdorysu na obrazovce
//               (izometrický půdorys: od levého po pravý roh kosodélníku)
//   pixelScale  místo `scale`: pevné zvětšení obrázku (sada v2 – všechny budovy stejně,
//               takže si drží vzájemné velikosti z listu)
//   offsetY     posun dolů (px) pod přední (jihovýchodní) roh půdorysu – schody, stín
//   offsetX     posun doprava (px) – nakreslené dveře přesně nad polem vstupu (kruhem)
//   flipX       zrcadlově (další dům stejného vzhledu, dveře na druhé straně)
//   openings    smazat i uzavřené bílé plochy (mezera mezi zbožím a stříškou u stánků):
//               { minArea, minHeight } – menší plochy (bílé pruhy markýzy) zůstanou
//
// Sada v2 (assets/buildings/greenvale/v2): rozřezaný list „Izometrická sada budov a stánků
// vesnice“ (dveře vpravo = strana +x, kde mají budovy pole dveří). Staré obrázky: _stare.

const V2 = 'assets/buildings/greenvale/v2/';
const V2_SCALE = 2;
// Stánky: průhledná mezera mezi zbožím a stříškou (viz openings).
export const STALL_OPENINGS = { minArea: 250, minHeight: 25 };
const v2 = (file, extra = {}) => ({ path: `${V2}${file}.png`, pixelScale: V2_SCALE, offsetY: 10, ...extra });

export const BUILDING_SPRITES = {
  // Měřítko radnice a nástěnky upravené v editoru terénu (× 0,44 / 0,52).
  greenvale_town_hall: v2('town-hall', { pixelScale: V2_SCALE * 0.44 }),
  greenvale_tavern: v2('tavern', { offsetX: 34 }),
  // Tržiště u náměstí = dva stánky (potraviny a zboží).
  // Stánky a rybářská chata vložené v editoru terénu (měřítko a strana dveří odtud; flipX = dveře na jihozápad).
  greenvale_market: v2('stall-fruit', { openings: STALL_OPENINGS, flipX: true, pixelScale: 1.42 }),
  greenvale_market_wares: v2('stall-pots', { openings: STALL_OPENINGS, flipX: true, pixelScale: 1.32 }),
  greenvale_smithy: v2('smithy'),
  greenvale_fishing_hut: v2('fishing-hut', { pixelScale: 1.88 }),
  greenvale_hunter_lodge: v2('hunter-lodge'),
  greenvale_home_1: v2('house-red', { offsetX: -44 }),
  greenvale_home_2: v2('house-thatch'),
  greenvale_home_3: v2('house-blue', { offsetX: 44 }),
  // Budovy a doplňky bez interiéru (zatím jen ve světě).
  greenvale_alchemist: v2('alchemist'),
  greenvale_observatory: v2('observatory'),
  greenvale_warehouse: v2('warehouse'),
  greenvale_stable: v2('stable'),
  greenvale_windmill: v2('windmill'),
  greenvale_house_green: v2('house-green'),
  greenvale_house_n2: v2('house-red', { flipX: true }),
  greenvale_house_n3: v2('house-thatch', { flipX: true }),
  greenvale_house_e1: v2('house-blue', { flipX: true }),
  greenvale_house_e2: v2('house-green', { flipX: true }),
  greenvale_fountain: v2('fountain', { offsetY: 6 }),
  greenvale_notice_board: v2('notice-board', { offsetY: 4, pixelScale: V2_SCALE * 0.52 }),
  greenvale_well: v2('well', { offsetY: 6, pixelScale: V2_SCALE * 0.71 }),
  greenvale_stall_fish: v2('stall-fish', { openings: STALL_OPENINGS, offsetY: 6, pixelScale: V2_SCALE * 0.75 }),
  greenvale_stall_flowers: v2('stall-flowers', { openings: STALL_OPENINGS, offsetY: 6, pixelScale: V2_SCALE * 0.73 }),
  // Vložené v editoru terénu: zelený dům u tržiště a kostel (dveře na jihozápad).
  greenvale_house_w1: v2('house-green', { flipX: true, pixelScale: 1.84 }),
  greenvale_church: v2('church', { flipX: true, pixelScale: 2.41 })
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
    const canvas = removeWhiteBackground(source, 232, BUILDING_SPRITES[id].openings);
    scene.textures.addCanvas(key, canvas);
    scene.textures.remove(rawKey(id));
  }
}

// Odstraní bílé pozadí spojené s okrajem obrázku a ořízne prázdné okraje.
export function removeWhiteBackground(image, threshold = 232, openings = null) {
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

  // Uzavřené bílé plochy (průhledy mezi sloupky stánku): velké souvislé oblasti pozadí,
  // které se nedotýkají okraje. Malé (bílé pruhy markýzy, okna) zůstanou.
  if (openings) {
    const seen = new Uint8Array(width * height);
    for (let start = 0; start < width * height; start++) {
      if (removed[start] || seen[start] || !isBackground(start * 4)) continue;
      const region = [start];
      seen[start] = 1;
      let minY = height, maxY = 0;
      for (let i = 0; i < region.length; i++) {
        const p = region[i];
        const x = p % width;
        const y = (p - x) / width;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
          if (q < 0 || q >= width * height || seen[q] || removed[q] || !isBackground(q * 4)) continue;
          seen[q] = 1;
          region.push(q);
        }
      }
      if (region.length < (openings.minArea ?? 250) || maxY - minY + 1 < (openings.minHeight ?? 25)) continue;
      for (const p of region) { removed[p] = 1; data[p * 4 + 3] = 0; }
    }
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
