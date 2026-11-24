// Karta Party z grafiky public/assets/ui/partyscene.
// Souřadnice podkladu jsou v pixelech obrázku 1536 × 1024 (stejný rám jako karta hrdiny).
//   partyscene.png          podklad karty
//   partyscene-buttons.png  tlačítka ve 4 stavech v řádku: výchozí, hover, vybrané, šedé
//   monsterselect.png       políčko monstra ve stejných 4 stavech (pod sebou)

export const PARTY_CARD = {
  background: 'party-card',
  buttons: 'party-buttons',
  monsterSelect: 'party-monsterselect'
};

export const PARTY_STATES = ['normal', 'hover', 'selected', 'disabled'];

export function loadPartyCardTextures(scene) {
  scene.load.image(PARTY_CARD.background, 'assets/ui/_stare/partyscene/partyscene.png');
  scene.load.image(PARTY_CARD.buttons, 'assets/ui/_stare/partyscene/partyscene-buttons.png');
  scene.load.image(PARTY_CARD.monsterSelect, 'assets/ui/_stare/partyscene/monsterselect.png');
}

// Výřezy v partyscene-buttons.png (2172 × 724): [x, y, w, h] pro každý stav.
const BUTTON_SHEET = {
  plus: [[1225, 267, 117, 60], [1401, 272, 111, 52], [1568, 266, 118, 61], [1741, 266, 118, 59]],
  skill: [[143, 377, 418, 58], [617, 380, 427, 53], [1105, 377, 429, 58], [1596, 377, 445, 57]],
  storage: [[121, 459, 315, 56], [479, 466, 307, 49], [820, 459, 290, 55], [1141, 459, 290, 56]],
  arrows: [[1466, 467, 126, 36], [1626, 466, 115, 38], [1771, 467, 124, 39], [1930, 466, 119, 42]],
  store: [[112, 544, 226, 58], [385, 547, 213, 50], [629, 546, 224, 58], [880, 546, 214, 55]],
  release: [[1157, 546, 193, 53], [1384, 547, 207, 52], [1616, 546, 212, 58], [1854, 544, 209, 58]]
};

// Políčko monstra v monsterselect.png (1774 × 887), 4 stavy pod sebou.
const SLOT_SHEET = [[405, 33, 965, 189], [405, 253, 965, 181], [405, 467, 965, 178], [405, 672, 965, 182]];

export const partyFrame = (kind, state) => `${kind}-${state}`;

// Rámce (frames) v načtených obrázcích – jednou za hru.
export function preparePartyFrames(scene) {
  const sheet = scene.textures.exists(PARTY_CARD.buttons) ? scene.textures.get(PARTY_CARD.buttons) : null;
  if (sheet && !sheet.has(partyFrame('plus', 'normal'))) {
    for (const [kind, rects] of Object.entries(BUTTON_SHEET)) {
      rects.forEach(([x, y, w, h], i) => {
        if (kind === 'arrows') {
          // Pár šipek: levá půlka = nahoru, pravá = dolů.
          sheet.add(partyFrame('arrowUp', PARTY_STATES[i]), 0, x, y, Math.floor(w / 2), h);
          sheet.add(partyFrame('arrowDown', PARTY_STATES[i]), 0, x + Math.floor(w / 2), y, w - Math.floor(w / 2), h);
        } else {
          sheet.add(partyFrame(kind, PARTY_STATES[i]), 0, x, y, w, h);
        }
      });
    }
  }
  const slots = scene.textures.exists(PARTY_CARD.monsterSelect) ? scene.textures.get(PARTY_CARD.monsterSelect) : null;
  if (slots && !slots.has(partyFrame('slot', 'normal'))) {
    SLOT_SHEET.forEach(([x, y, w, h], i) => slots.add(partyFrame('slot', PARTY_STATES[i]), 0, x, y, w, h));
  }
  return Boolean(sheet && slots);
}

// ------------------------------------------------------ rozložení podkladu

export const PARTY_SLOTS = [
  { x: 53, y: 234, w: 463, h: 98 },
  { x: 53, y: 343, w: 463, h: 96 },
  { x: 53, y: 449, w: 463, h: 93 },
  { x: 53, y: 554, w: 463, h: 96 }
];

export const STORAGE = {
  countX: 240, headerY: 712,
  up: { x: 417, y: 697, w: 50, h: 33 },
  down: { x: 471, y: 697, w: 50, h: 33 },
  area: { x: 50, y: 735, w: 475, h: 123 },
  columns: [60, 292], rowY: [741, 780, 819], item: { w: 228, h: 36 }
};

export const DETAIL = {
  portrait: { x: 582, y: 200, w: 151, h: 145 },
  nameY: 216, line1Y: 252, line2Y: 284,
  textX: 757,
  elementDot: { x: 1133, y: 240, r: 16 },
  hpBar: { x: 818, y: 317, w: 336, h: 20 },
  hpTextX: 1170, hpY: 327,
  model: { x: 1352, y: 330 }
};

export const STATS = {
  rowsY: [398, 436, 474, 512, 550, 588, 626],
  valueX: 878,
  diamondX: 899, diamondStep: 19.2, diamondHalf: 7,
  plus: { cx: 1027, w: 50, h: 32 },
  labelX: 645,
  // Volné tréninkové body: vlastní řádek dole v rámečku statistik (pod čarou).
  freeX: 819, freeY: 672, freeLineY: 651
};

export const SKILLS = {
  x: 1103, w: 366, h: 49, rowsY: [418, 475, 534, 593, 650],
  iconX: 1132, textX: 1172, usesX: 1458
};

export const HISTORY = { x: 615, rowsY: [778, 806, 836], wrap: 440 };

export const ACTIONS = {
  store: { x: 1094, y: 803, w: 184, h: 52 },
  release: { x: 1297, y: 803, w: 181, h: 52 }
};

export const HEADER = { infoX: 282, infoY: 117, countsX: 1402, countsY: 152 };
export const CLOSE_AREA = { x: 628, y: 914, w: 275, h: 78 };
