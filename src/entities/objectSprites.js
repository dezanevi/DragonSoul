// Objekty ve světě (stromy, smrky, skály, keře, ploty, jeskyně…) z obrázku public/assets/objects/greenvale-objects.webp.
//
// Obrázek má průhledné pozadí. Každý objekt je zadaný obdélníkem [x, y, šířka, výška]
// v pixelech obrázku. Při spuštění hry se vyřízne do samostatné textury.
//
// SHEET_SCALE: dlaždice terénu má na obrázku asi 110 px, ve hře 128 px.
// Všechny objekty se zvětší stejně, aby si zachovaly vzájemné velikosti.

export const OBJECT_SHEET_PATH = 'assets/objects/greenvale-objects.webp';
export const SHEET_SCALE = 128 / 110;

const SHEET_KEY = 'object-sheet';

export const OBJECT_VARIANTS = {
  tree: [
    [13, 395, 128, 121], // velký dub
    [149, 401, 96, 90], // dub
    [255, 402, 92, 90], // žlutý strom
    [356, 401, 101, 96] // vrba
  ],
  spruce: [
    [467, 400, 75, 94], // smrk
    [554, 398, 74, 94], // smrk
    [636, 409, 53, 72], // malý smrk
    [702, 412, 45, 62] // malý smrk
  ],
  // Doplňky (seznam `decor` v mapě).
  bush: [
    [129, 488, 64, 49], // zelený keř
    [215, 486, 72, 53], // keř s bílými květy
    [310, 486, 77, 53], // keř s růžovými květy
    [418, 488, 80, 51], // keř s oranžovými květy
    [519, 486, 71, 53], // keř s modrými květy
    [612, 484, 76, 52] // keř se žlutými květy
  ],
  plant: [
    [706, 475, 71, 60], // rákos
    [794, 480, 92, 53], // kapradí
    [910, 479, 58, 46], // malé kapradí
    [996, 488, 62, 34] // jetel
  ],
  stump: [
    [765, 413, 89, 57], // pařez
    [874, 419, 75, 51] // kmen
  ],
  // Plot podél osy x (na obrazovce klesá doprava) a podél osy y (stoupá doprava).
  fenceX: [[465, 539, 63, 52]],
  fenceY: [
    [686, 538, 55, 55],
    [763, 534, 53, 55]
  ],
  signpost: [[1046, 517, 53, 89]],
  cave: [[920, 600, 200, 141]],
  rock: [
    [853, 333, 74, 73], // skála
    [911, 299, 82, 78], // skála
    [993, 303, 123, 115], // velká skála s mechem
    [1031, 422, 76, 68], // skála
    [673, 367, 54, 39], // kameny
    [736, 375, 35, 28], // kámen
    [796, 372, 52, 31], // kameny
    [942, 381, 38, 29], // kámen
    [969, 428, 51, 40] // kameny
  ]
};

export function objectTextureKey(type, index) {
  return `object-${type}-${index}`;
}

export function loadObjectSprites(scene) {
  if (!scene.textures.exists(objectTextureKey('tree', 0))) {
    scene.load.image(SHEET_KEY, OBJECT_SHEET_PATH);
  }
}

export function prepareObjectSprites(scene) {
  if (scene.textures.exists(objectTextureKey('tree', 0))) return;
  if (!scene.textures.exists(SHEET_KEY)) return;

  const source = scene.textures.get(SHEET_KEY).getSourceImage();

  for (const [type, rects] of Object.entries(OBJECT_VARIANTS)) {
    rects.forEach(([x, y, width, height], index) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(source, x, y, width, height, 0, 0, width, height);
      scene.textures.addCanvas(objectTextureKey(type, index), canvas);
    });
  }

  scene.textures.remove(SHEET_KEY);
}
