// Grafika terénu z izometrických listů v public/assets/objects/.
//
// Dlaždice jsou "kostky": horní kosočtverec + boky. Vykreslují se odzadu dopředu,
// takže boky zakryje dlaždice před nimi a vidět zůstanou jen na okrajích.
//
// Každá varianta: [list, x, y, šířka, výška, středX, středY, šířkaPlochy, váha]
//   x, y, šířka, výška   výřez z listu (px)
//   středX, středY       střed horní plochy (kosočtverce) v listu
//   šířkaPlochy          šířka horní plochy v listu – ve hře bude 128 px
//   váha                 jak často se varianta použije

const SHEETS = {
  grassA: 'assets/objects/Izometrické dlaždice travnatého terénu.png',
  grassB: 'assets/objects/Izometrické travnaté dlaždice v odstínech zeleně a sucha.png',
  grassC: 'assets/objects/Izometrické travnaté terénní bloky.png',
  coast: 'assets/objects/Izometrické pobřežní dlaždice RPG терénu.png',
  objects: 'assets/objects/greenvale-objects.webp'
};

export const TERRAIN_VARIANTS = {
  // Běžná tráva: hlavně čisté varianty, kvítí a kapradí jen občas.
  grass: [
    ['grassB', 16, 30, 368, 305, 200, 160, 367, 5],
    ['grassB', 384, 28, 381, 306, 574, 164, 380, 4],
    ['grassA', 16, 683, 368, 300, 200, 812, 367, 5],
    ['grassB', 16, 683, 368, 301, 200, 812, 367, 3],
    ['grassA', 15, 31, 369, 302, 199, 161, 368, 0.6],
    ['grassA', 15, 358, 369, 325, 199, 486, 368, 0.6],
    ['grassA', 397, 358, 366, 298, 580, 487, 365, 0.6],
    ['grassC', 16, 31, 368, 304, 200, 161, 367, 0.6],
    ['grassA', 773, 32, 368, 301, 957, 161, 367, 0.4],
    ['grassC', 384, 29, 381, 306, 574, 165, 380, 0.3]
  ],
  // Tmavá louka – zóna setkání.
  meadow: [
    ['grassB', 777, 359, 365, 299, 959, 487, 364, 4],
    ['grassB', 1155, 359, 366, 324, 1338, 488, 365, 4],
    ['grassB', 1155, 28, 368, 306, 1339, 160, 367, 3],
    ['grassA', 1153, 33, 368, 300, 1337, 161, 367, 1],
    ['grassC', 1154, 40, 371, 295, 1339, 165, 370, 1],
    ['grassC', 396, 364, 370, 319, 581, 492, 369, 0.6],
    ['grassC', 1155, 362, 369, 297, 1339, 489, 368, 0.3]
  ],
  // Stavební parcely: suchá tráva s hlínou.
  plot: [
    ['grassA', 776, 683, 365, 300, 958, 812, 364, 2],
    ['grassB', 777, 683, 367, 301, 960, 812, 366, 1],
    ['grassA', 397, 683, 367, 300, 580, 812, 366, 1]
  ],
  path: [
    ['objects', 416, 8, 122, 86, 477, 40, 121, 1]
  ],
  plaza: [
    ['objects', 550, 5, 123, 89, 611, 38, 122, 1],
    ['objects', 685, 5, 120, 95, 745, 38, 119, 1]
  ],
  water: [
    ['objects', 13, 99, 126, 106, 76, 130, 125, 1]
  ],
  // Útesy nad vodou (horní plocha = tráva, pod ní skála a voda).
  cliff: [
    ['coast', 42, 8, 460, 344, 272, 123, 459, 3],
    ['coast', 1125, 9, 463, 343, 1356, 125, 462, 1],
    ['coast', 1126, 367, 462, 346, 1357, 482, 461, 1],
    ['coast', 1669, 371, 463, 342, 1900, 487, 462, 0.6]
  ]
};

const sheetKey = (name) => `terrain-sheet-${name}`;
export const terrainTextureKey = (type, index) => `terrain-${type}-${index}`;

export function loadTerrainTiles(scene) {
  if (scene.textures.exists(terrainTextureKey('grass', 0))) return;

  for (const [name, path] of Object.entries(SHEETS)) {
    if (!scene.textures.exists(sheetKey(name))) {
      scene.load.image(sheetKey(name), encodeURI(path));
    }
  }
}

// Vyřízne varianty do samostatných textur a odstraní poloprůhlednou záři kolem dlaždic.
export function prepareTerrainTiles(scene) {
  if (scene.textures.exists(terrainTextureKey('grass', 0))) return true;

  for (const name of Object.keys(SHEETS)) {
    if (!scene.textures.exists(sheetKey(name))) return false;
  }

  for (const [type, variants] of Object.entries(TERRAIN_VARIANTS)) {
    variants.forEach(([sheet, x, y, width, height], index) => {
      const source = scene.textures.get(sheetKey(sheet)).getSourceImage();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(source, x, y, width, height, 0, 0, width, height);

      const pixels = ctx.getImageData(0, 0, width, height);
      for (let i = 3; i < pixels.data.length; i += 4) {
        if (pixels.data[i] < 160) pixels.data[i] = 0;
      }
      ctx.putImageData(pixels, 0, 0);

      scene.textures.addCanvas(terrainTextureKey(type, index), canvas);
    });
  }

  // Listy už nejsou potřeba (stromy a skály si list objektů načítají zvlášť).
  for (const name of Object.keys(SHEETS)) scene.textures.remove(sheetKey(name));

  return true;
}

// Vybere variantu podle váhy; roll je číslo 0–1 (stejné pro stejné pole).
export function pickTerrainVariant(type, roll) {
  const variants = TERRAIN_VARIANTS[type];
  const total = variants.reduce((sum, v) => sum + v[8], 0);
  let threshold = roll * total;

  for (let i = 0; i < variants.length; i++) {
    threshold -= variants[i][8];
    if (threshold <= 0) return i;
  }

  return variants.length - 1;
}

// Údaje pro umístění: počátek obrázku (střed horní plochy) a měřítko na 128 px.
export function terrainPlacement(type, index, tileWidth) {
  const [, x, y, width, height, centerX, centerY, faceWidth] = TERRAIN_VARIANTS[type][index];
  return {
    key: terrainTextureKey(type, index),
    originX: (centerX - x) / width,
    originY: (centerY - y) / height,
    scale: (tileWidth / faceWidth) * 1.02
  };
}
