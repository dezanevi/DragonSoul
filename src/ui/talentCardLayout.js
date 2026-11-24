// Karta Talenty z grafiky public/assets/ui/talents (zdroj: assets/ui/Talenttree).
// Souřadnice jsou v pixelech podkladu 1536 × 1024 (stejný rám jako karta hrdiny).
//   talent-card.png       barevný podklad (aktivní talenty)
//   talent-card-grey.png  šedá verze – výřezy pro zamčené / neaktivní talenty
//   frame-hover.png       modrý rámeček – talent pod myší
//   frame-active.png      zlatý rámeček – talent s přidělenými body

export const TALENT_CARD = {
  color: 'talent-card',
  gray: 'talent-card-gray',
  frameHover: 'talent-frame-hover',
  frameActive: 'talent-frame-active'
};

const PATHS = {
  [TALENT_CARD.color]: 'assets/ui/_stare/talents/talent-card.png',
  [TALENT_CARD.gray]: 'assets/ui/_stare/talents/talent-card-grey.png',
  [TALENT_CARD.frameHover]: 'assets/ui/_stare/talents/frame-hover.png',
  [TALENT_CARD.frameActive]: 'assets/ui/_stare/talents/frame-active.png'
};

export function loadTalentCardTextures(scene) {
  for (const [key, path] of Object.entries(PATHS)) scene.load.image(key, path);
}

// Rámečky: kde v obrázku 2172 × 724 leží zlatá linka (ta se přikládá na okraj políčka).
// Rámečky sestavuje ui/newUiKit.js z nové sady (600 × 200, linka 12 px od okraje).
export const FRAME_INNER = {
  [TALENT_CARD.frameHover]: { x: 12, y: 12, w: 576, h: 176 },
  [TALENT_CARD.frameActive]: { x: 12, y: 12, w: 576, h: 176 }
};

// Sloupce stromů (Souboj, Řemesla, Kouzelník) – celý panel.
export const TREE_PANELS = [
  { x: 31, y: 150, w: 485, h: 705 },
  { x: 538, y: 150, w: 458, h: 705 },
  { x: 1015, y: 150, w: 485, h: 705 }
];

// Políčka talentů: [strom][levé, pravé] × řádky stupňů I–V.
const NODE_X = [
  [[48, 274], [282, 507]],
  [[550, 764], [771, 984]],
  [[1026, 1252], [1259, 1490]]
];
const NODE_Y = [[287, 346], [382, 441], [475, 533], [567, 626], [659, 718]];

export function talentNodeRect(treeIndex, tierIndex, slot) {
  const [x0, x1] = NODE_X[treeIndex][slot];
  const [y0, y1] = NODE_Y[tierIndex];
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Kosočtverečky hodností (kreslí je hra, v podkladu nejsou): řada vycentrovaná pod názvem
// talentu (textová část políčka od textLeft do šířky − textRight), celá uvnitř políčka.
export const RANK_DIAMONDS = { textLeft: 65, textRight: 10, dy: 43, step: 18, half: 6, line: 1.2 };

// Závěrečné talenty (Dračí taktika, Legendární řemeslník, Dračí arkanista).
export const FINAL_BOXES = [
  { x: 46, y: 731, w: 462, h: 100 },
  { x: 553, y: 731, w: 432, h: 100 },
  { x: 1030, y: 731, w: 458, h: 100 }
];

// Hlavička sloupce vpravo (body ve stromu, stav, tlačítko Zvolit).
export const TREE_HEADER_RIGHT = [495, 975, 1478];

export const FREE_POINTS = { x: 1446, y: 100 };
export const HEADER = { subtitleX: 310, subtitleY: 118, spentY: 132, investedY: 168, statusY: 204, buttonY: 204 };
export const CLOSE_AREA = { x: 628, y: 914, w: 275, h: 78 };
