// Karta Talenty z grafiky public/assets/ui/talents (zdroj: assets/ui/Talenttree).
// Souřadnice jsou v pixelech podkladu 1536 × 1024 (stejný rám jako karta hrdiny).
//   talent-card.png       barevný podklad (aktivní talenty)
//   talent-card-gray.png  šedá verze – výřezy pro zamčené / neaktivní talenty
//   frame-hover.png       modrý rámeček – talent pod myší
//   frame-active.png      zlatý rámeček – talent s přidělenými body

export const TALENT_CARD = {
  color: 'talent-card',
  gray: 'talent-card-gray',
  frameHover: 'talent-frame-hover',
  frameActive: 'talent-frame-active'
};

const PATHS = {
  [TALENT_CARD.color]: 'assets/ui/talents/talent-card.png',
  [TALENT_CARD.gray]: 'assets/ui/talents/talent-card-gray.png',
  [TALENT_CARD.frameHover]: 'assets/ui/talents/frame-hover.png',
  [TALENT_CARD.frameActive]: 'assets/ui/talents/frame-active.png'
};

export function loadTalentCardTextures(scene) {
  for (const [key, path] of Object.entries(PATHS)) scene.load.image(key, path);
}

// Rámečky: kde v obrázku 2172 × 724 leží zlatá linka (ta se přikládá na okraj políčka).
export const FRAME_INNER = {
  [TALENT_CARD.frameHover]: { x: 93, y: 100, w: 1994, h: 518 },
  [TALENT_CARD.frameActive]: { x: 70, y: 90, w: 2030, h: 550 }
};

// Sloupce stromů (Souboj, Řemesla, Kouzelník) – celý panel.
export const TREE_PANELS = [
  { x: 31, y: 178, w: 488, h: 684 },
  { x: 537, y: 178, w: 459, h: 684 },
  { x: 1013, y: 178, w: 486, h: 684 }
];

// Políčka talentů: [strom][levé, pravé] × řádky stupňů I–V.
const NODE_X = [
  [[48, 272], [283, 506]],
  [[549, 762], [773, 983]],
  [[1025, 1250], [1260, 1487]]
];
const NODE_Y = [[308, 366], [404, 460], [495, 552], [586, 641], [674, 731]];

export function talentNodeRect(treeIndex, tierIndex, slot) {
  const [x0, x1] = NODE_X[treeIndex][slot];
  const [y0, y1] = NODE_Y[tierIndex];
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Namalované kosočtverečky hodností: střed prvního a rozestup.
export const RANK_DIAMONDS = { dx: 89.5, dy: 44, step: 23.4, half: 8 };

// Závěrečné talenty (Dračí taktika, Legendární řemeslník, Dračí arkanista).
export const FINAL_BOXES = [
  { x: 46, y: 745, w: 462, h: 99 },
  { x: 553, y: 745, w: 432, h: 99 },
  { x: 1030, y: 745, w: 458, h: 99 }
];

// Hlavička sloupce vpravo (body ve stromu, stav, tlačítko Zvolit).
export const TREE_HEADER_RIGHT = [495, 975, 1478];

export const FREE_POINTS = { x: 1446, y: 116 };
export const CLOSE_AREA = { x: 628, y: 914, w: 275, h: 78 };
