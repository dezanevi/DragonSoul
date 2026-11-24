// Interaktivní tlačítka karty hrdiny z obrázků stavů (bílé pozadí se odstraní při startu).
//   magic_school.png  6 škol × 4 řádky: výchozí, zlatá (zakliknutá), modrá (hover), šedá (zamčená)
//   skillsset1.png    Sběr bylin, Alchymie, Těžba, Rybolov – 4 sloupce ve stejném pořadí stavů
//   skillset2.png     Vaření, Kovářství, Řemeslnictví, Diplomacie
// Karta pro ženskou postavu: hero_card_female.png (stejné rozložení jako hero_card.png).

import { clearWhiteFromEdges } from './tabSprites.js';

export const HERO_CARD_FEMALE = 'hero-card-female';
export const HERO_CARD_FEMALE_PATH = 'assets/ui/_stare/hero/hero_card_female.png';

// Pořadí stavů v listech (řádky u škol, sloupce u dovedností).
export const BUTTON_STATES = ['normal', 'selected', 'hover', 'locked'];

const SHEETS = {
  magic: { key: 'hero-magic-sheet', path: 'assets/ui/_stare/hero/magic_school.png' },
  skills1: { key: 'hero-skills-sheet-1', path: 'assets/ui/_stare/hero/skillsset1.png' },
  skills2: { key: 'hero-skills-sheet-2', path: 'assets/ui/_stare/hero/skillset2.png' }
};

const MAGIC_ORDER = ['fire', 'water', 'earth', 'air', 'light', 'dark'];
const MAGIC_COLUMNS = [[243, 460], [460, 676], [676, 892], [892, 1108], [1108, 1324], [1324, 1541]];
const MAGIC_ROWS = [[8, 230], [230, 448], [448, 666], [666, 880]];

const SKILL_SHEETS = [
  { sheet: 'skills1', ids: ['herbalism', 'alchemy', 'mining', 'fishing'] },
  { sheet: 'skills2', ids: ['cooking', 'smithing', 'crafting', 'diplomacy'] }
];
const SKILL_COLUMNS = [[34, 458], [458, 888], [888, 1318], [1318, 1742]];
const SKILL_ROWS = [[36, 244], [244, 449], [449, 652], [652, 856]];

export const magicStateKey = (school, state) => `hero-magic-${school}-${state}`;
export const skillStateKey = (skill, state) => `hero-skill-${skill}-${state}`;

export function loadHeroButtonSprites(scene) {
  for (const { key, path } of Object.values(SHEETS)) scene.load.image(key, path);
}

function cut(scene, source, key, x0, x1, y0, y1) {
  if (scene.textures.exists(key)) return;
  const w = x1 - x0;
  const h = y1 - y0;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, x0, y0, w, h, 0, 0, w, h);
  clearWhiteFromEdges(ctx, w, h);
  scene.textures.addCanvas(key, canvas);
}

export function prepareHeroButtonSprites(scene) {
  const magic = SHEETS.magic.key;
  if (scene.textures.exists(magic)) {
    const source = scene.textures.get(magic).getSourceImage();
    MAGIC_ORDER.forEach((school, col) => {
      BUTTON_STATES.forEach((state, row) => {
        cut(scene, source, magicStateKey(school, state), ...MAGIC_COLUMNS[col], ...MAGIC_ROWS[row]);
      });
    });
    scene.textures.remove(magic);
  }

  for (const { sheet, ids } of SKILL_SHEETS) {
    const key = SHEETS[sheet].key;
    if (!scene.textures.exists(key)) continue;
    const source = scene.textures.get(key).getSourceImage();
    ids.forEach((id, row) => {
      BUTTON_STATES.forEach((state, col) => {
        cut(scene, source, skillStateKey(id, state), ...SKILL_COLUMNS[col], ...SKILL_ROWS[row]);
      });
    });
    scene.textures.remove(key);
  }
}

// Stav obrázku podle tlačítka: zamčené > pod myší > zakliknuté > výchozí.
export function spriteState(button, { locked = false, selected = false } = {}) {
  if (locked) return 'locked';
  if (button.hovered || button.pressed) return 'hover';
  if (selected) return 'selected';
  return 'normal';
}
