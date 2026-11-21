// Souřadnice karty hrdiny v referenčním systému podkladu 1536 × 1024 px.
// Všechny interaktivní vrstvy leží v kontejneru, který se škáluje s podkladem,
// takže při jiném rozlišení zůstávají na stejném místě obrázku.

export const CARD_TEXTURE = 'hero-card';
export const CARD_TEXTURE_PATH = 'assets/ui/hero/hero_card.png';
export const CARD_WIDTH = 1536;
export const CARD_HEIGHT = 1024;

export const rect = (x, y, w, h) => ({ x, y, w, h });

// Záložky: hranice podle podkladu, šířka = rozdíl − 4.
export const TAB_Y = 17;
export const TAB_HEIGHT = 65;
const TAB_BOUNDS = [36, 278, 468, 653, 838, 1020, 1192, 1350, 1525];

export const TABS = [
  { id: 'hero', label: 'Hrdina' },
  { id: 'talents', label: 'Talenty' },
  { id: 'party', label: 'Party' },
  { id: 'inventory', label: 'Inventář' },
  { id: 'crafting', label: 'Řemesla' },
  { id: 'bestiary', label: 'Bestiář' },
  { id: 'map', label: 'Mapa' },
  { id: 'quests', label: 'Úkoly' }
].map((tab, index) => ({
  ...tab,
  area: rect(
    TAB_BOUNDS[index],
    TAB_Y,
    TAB_BOUNDS[index + 1] - TAB_BOUNDS[index] - 4,
    TAB_HEIGHT
  )
}));

// V podkladu je záložka Hrdina namalovaná jako aktivní (modrá). Když je aktivní
// jiná záložka, překryje se kopií této oblasti přebarvenou na klidovou tmavou modř.
export const HERO_TAB_PAINTED = rect(66, 12, 218, 70);
export const HERO_TAB_IDLE_TEXTURE = 'hero-card-tab-hero-idle';

// Sloty vybavení 91 × 62: vlevo zbraně a šperky, vpravo zbroj.
export const EQUIPMENT_SLOTS = [
  { id: 'weapon', label: 'Meč', area: rect(360, 413, 91, 62) },
  { id: 'shield', label: 'Štít', area: rect(360, 480, 91, 62) },
  { id: 'ring', label: 'Prsten', area: rect(360, 548, 91, 62) },
  { id: 'amulet', label: 'Amulet', area: rect(360, 615, 91, 62) },
  { id: 'helmet', label: 'Helma', area: rect(690, 413, 91, 62) },
  { id: 'armor', label: 'Zbroj', area: rect(690, 480, 91, 62) },
  { id: 'legs', label: 'Nohy', area: rect(690, 548, 91, 62) },
  { id: 'boots', label: 'Boty', area: rect(690, 615, 91, 62) }
];

// Dovednosti ve dvou řadách po čtyřech. Zadání uvádělo X 91/282/473/664 a šířku 182,
// ale namalovaná tlačítka 2.–4. sloupce leží v podkladu o ~10 px vpravo
// (ověřeno překryvem na hero_card.png), proto X a šířka podle obrázku.
const SKILL_X = [93, 291, 484, 675];
const SKILL_Y = [736, 818];
const SKILL_WIDTH = 185;

export const SKILLS = [
  { id: 'herbalism', label: 'Sběr bylin' },
  { id: 'alchemy', label: 'Alchymie' },
  { id: 'mining', label: 'Těžba' },
  { id: 'fishing', label: 'Rybolov' },
  { id: 'cooking', label: 'Vaření' },
  { id: 'smithing', label: 'Kovářství' },
  { id: 'crafting', label: 'Řemeslnictví' },
  { id: 'diplomacy', label: 'Diplomacie' }
].map((skill, index) => ({
  ...skill,
  area: rect(SKILL_X[index % 4], SKILL_Y[Math.floor(index / 4)], SKILL_WIDTH, 73)
}));

// Prázdný rámeček ukazatele uvnitř tlačítka dovednosti (relativně k tlačítku).
export const SKILL_BAR = rect(97, 53, 79, 12);

// Proužek pro krátká hlášení vlevo od tlačítka Zavřít.
export const STATUS_AREA = rect(70, 912, 540, 40);

export const CLOSE_BUTTON = rect(628, 914, 275, 78);

// Obsahová plocha pod záložkami (pro ostatní záložky).
export const CONTENT_AREA = rect(30, 96, 1476, 806);

// Pole pro hodnoty, která v podkladu zůstala prázdná.
export const FIELDS = {
  name: { x: 462, y: 158 },
  level: { x: 456, y: 215 },
  expText: { x: 630, y: 264 },
  expBar: rect(357, 290, 273, 15),
  manaText: { x: 630, y: 330 },
  manaBar: rect(357, 346, 273, 15),
  heroStats: { x: 1036, rows: [181, 221, 259, 296, 334] },
  commanderStats: { x: 1466, rows: [182, 226, 270, 313] },
  gold: { x: 1428, y: 647 },
  region: { x: 1030, y: 752 },
  magicStones: { x: 1428, y: 855 },
  magicStonesDetail: { x: 1040, y: 857 }
};

// Šest karet magických škol: střed X a prázdný ukazatel pod názvem.
export const MAGIC_SCHOOLS = [
  { id: 'fire', label: 'Fire', x: 905 },
  { id: 'water', label: 'Water', x: 1011 },
  { id: 'earth', label: 'Earth', x: 1117 },
  { id: 'air', label: 'Air', x: 1223 },
  { id: 'light', label: 'Light', x: 1329 },
  { id: 'dark', label: 'Dark', x: 1434 }
];
export const MAGIC_BAR = { y: 554, width: 74, height: 13, levelY: 488 };

export const TEXT_FONT = 'Georgia, "Times New Roman", serif';
