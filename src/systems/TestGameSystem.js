// ======================================================================
// Testovací nová hra: hrdina na úrovni 100 se všemi magickými školami na nejvyšší úrovni
// a všemi kouzly, výrobní a sběrné profese na 100, suroviny a mezivýrobky na výrobu
// každého předmětu (Vaření, Alchymie, Kovářství), všechno náčiní a nástroje a Dire Wolf
// na úrovni 100 s 510 volnými tréninkovými body. Spouští se z obrazovky tvorby postavy.
// ======================================================================

import spellRows from '../data/spells.json';
import { SaveSystem } from './SaveSystem.js';
import { applyHeroLevelUp } from './HeroProgressionSystem.js';
import { normalizeTalentProgress } from './TalentSystem.js';
import { MAGIC_SCHOOLS } from './MagicMasterySystem.js';
import { createMonster } from './MonsterSystem.js';
import { addItem, getItemCount, INVENTORY_PAGE_SIZE } from './InventorySystem.js';
import { ALL_COOKING } from '../data/cooking.js';
import { ALL_ALCHEMY } from '../data/alchemy.js';
import { ALL_SMITHING } from '../data/smithing.js';
import { ALL_CRAFTING } from '../data/crafting.js';
import { RODS, METAL_PARTS, BAITS, xpToNextFishingLevel } from '../data/fishing.js';
import { PICKAXES, MINING_TOOLS } from '../data/mining.js';
import { SICKLES, HERB_CATALOG, HERB_RARE_FINDS } from '../data/herbalism.js';
import { getItem } from '../data/items.js';

export const TEST_HERO_LEVEL = 100;
const MAX_MASTERY_LEVEL = 4;
const PROFESSION_LEVEL = 100;
const PROFESSIONS = ['herbalism', 'alchemy', 'mining', 'fishing', 'cooking', 'smithing', 'crafting', 'diplomacy'];
const STACK_QTY = 99;

export function createTestGame(playerName = 'Tester', gender = 'male') {
  const state = SaveSystem.createNew(playerName);
  state.gender = gender;
  state.testGame = true;

  // Hrdina: postupné zvyšování úrovní (stejné přírůstky jako ve hře), plné HP a mana.
  while (state.level < TEST_HERO_LEVEL) {
    state.level += 1;
    applyHeroLevelUp(state);
  }
  state.exp = 0;
  state.hp = state.maxHp;
  state.mp = state.maxMp;
  state.gold = 100000;
  normalizeTalentProgress(state);

  // Všechny magické školy na nejvyšší úrovni a všechna kouzla.
  state.magicMastery = Object.fromEntries(MAGIC_SCHOOLS.map((school) => [school, { level: MAX_MASTERY_LEVEL, exp: 0, unlocked: true }]));
  state.spellbook = spellRows.map((spell) => spell.id);

  // Profese na 100.
  state.professions = Object.fromEntries(PROFESSIONS.map((id) => [id, { level: PROFESSION_LEVEL, exp: 0, next: xpToNextFishingLevel(PROFESSION_LEVEL) }]));

  // Dire Wolf 100 s 510 tréninkovými body k rozdělení.
  const wolf = createMonster('dire_wolf', 100);
  wolf.unspentTrainingPoints = 510;
  wolf.history = ['Testovací hra: Dire Wolf na úrovni 100 s 510 tréninkovými body.'];
  state.party = [wolf];

  // Suroviny a mezivýrobky všech receptů (u „a|b“ první možnost), náčiní a nástroje.
  const ids = new Set();
  for (const recipe of [...ALL_COOKING, ...ALL_ALCHEMY, ...ALL_SMITHING, ...ALL_CRAFTING]) {
    for (const key of Object.keys(recipe.ingredients ?? {})) ids.add(key.split('|')[0]);
  }
  const gear = [...RODS, ...METAL_PARTS, ...PICKAXES, ...MINING_TOOLS, ...SICKLES].map((entry) => entry.id);
  const baits = BAITS.map((bait) => bait.id);
  const wanted = [...ids].filter((id) => getItem(id));
  const total = wanted.length + gear.length + baits.length + HERB_CATALOG.length + HERB_RARE_FINDS.length + 2;
  const pages = Math.ceil(total / INVENTORY_PAGE_SIZE) + 1;
  state.inventory = { slots: new Array(pages * INVENTORY_PAGE_SIZE).fill(null) };
  addItem(state, 'mana_potion', 50);
  addItem(state, 'basic_crystal', 20);
  for (const id of gear) addItem(state, id, id === 'tool_support' ? STACK_QTY : 1);
  for (const id of baits) addItem(state, id, 50);
  for (const id of wanted) addItem(state, id, STACK_QTY);
  // Sběr bylin: všech 16 rostlin a vzácné nálezy.
  for (const herb of HERB_CATALOG) if (getItemCount(state, herb.id) === 0) addItem(state, herb.id, STACK_QTY);
  for (const find of HERB_RARE_FINDS) addItem(state, find.id, 10);
  // Řemeslnictví: příběhová Dračí pečeť pro dračí recepty a všechny Soul Crystaly.
  addItem(state, 'dragon_seal', 1);
  for (const id of ['greater_crystal', 'elemental_crystal', 'ancient_crystal', 'dragon_crystal']) addItem(state, id, 5);
  state.flags = { ...state.flags, starterManaPotions: true, fishingStarterGiven: true, miningStarterGiven: true, herbStarterGiven: true };
  return state;
}
