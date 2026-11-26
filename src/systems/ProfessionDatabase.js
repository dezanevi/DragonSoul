// Databáze řemesel (karta Řemesla): ke každému předmětu odkud se získá a ve kterých
// receptech se používá. Rejstříky se sestaví jednou při prvním dotazu.
import speciesRows from '../data/monsters.json';
import { ITEMS, getItem, SPECIES_DROPS } from '../data/items.js';
import { ALL_COOKING, CATEGORIES, STATIONS, ORIGINS, outputItemId, describeEffect, MEATS, WOOD_DROP } from '../data/cooking.js';
import { ALL_ALCHEMY, ALCHEMY_CATEGORIES, ALCHEMY_STATIONS, ALCHEMY_ORIGINS, alchemyOutputId, describeAlchemy } from '../data/alchemy.js';
import { ALL_SMITHING, SMITHING_CATEGORIES, SMITHING_STATIONS, SMITHING_ORIGINS, smithingOutputId, describeSmithing } from '../data/smithing.js';
import { ALL_CRAFTING, CRAFTING_CATEGORIES, CRAFTING_STATIONS, CRAFTING_ORIGINS, craftingOutputId, describeCrafting } from '../data/crafting.js';
import { LOCATIONS } from '../data/fishing.js';
import { DEPOSITS, SPECIAL_DEPOSITS, RARE_FINDS } from '../data/mining.js';
import { HERB_SITES, SPECIAL_HERB_SITES, HERB_RARE_FINDS, HERBALIST_STOCK } from '../data/herbalism.js';
import { GOODS as FISHER_GOODS } from '../scenes/FishingShopScene.js';
import { GOODS as MINER_GOODS } from '../scenes/MiningShopScene.js';
import { FISHER_EXTRA_GOODS, MERCHANTS } from '../data/merchants.js';
import { normalizeCooking, cookingLevel, isKnown, ingredientCount } from './CookingSystem.js';
import { normalizeAlchemy, alchemyLevel, isAlchemyKnown, alchemyIngredientCount } from './AlchemySystem.js';
import { normalizeSmithing, smithingLevel, isSmithingKnown, smithingIngredientCount } from './SmithingSystem.js';
import { normalizeCrafting, craftingLevel, isCraftingKnown, craftingIngredientCount } from './CraftingSystem.js';

// Výrobní profese – stejná data jako okna výroby (CookingScene), jen ke čtení.
export const RECIPE_BOOKS = {
  cooking: {
    title: 'Vaření', all: ALL_COOKING, outputId: outputItemId, categories: CATEGORIES, stations: STATIONS, origins: ORIGINS,
    describe: describeEffect, normalize: normalizeCooking, level: cookingLevel, known: isKnown, count: ingredientCount
  },
  alchemy: {
    title: 'Alchymie', all: ALL_ALCHEMY, outputId: alchemyOutputId, categories: ALCHEMY_CATEGORIES, stations: ALCHEMY_STATIONS, origins: ALCHEMY_ORIGINS,
    describe: describeAlchemy, normalize: normalizeAlchemy, level: alchemyLevel, known: isAlchemyKnown, count: alchemyIngredientCount
  },
  smithing: {
    title: 'Kovářství', all: ALL_SMITHING, outputId: smithingOutputId, categories: SMITHING_CATEGORIES, stations: SMITHING_STATIONS, origins: SMITHING_ORIGINS,
    describe: describeSmithing, normalize: normalizeSmithing, level: smithingLevel, known: isSmithingKnown, count: smithingIngredientCount
  },
  crafting: {
    title: 'Řemeslnictví', all: ALL_CRAFTING, outputId: craftingOutputId, categories: CRAFTING_CATEGORIES, stations: CRAFTING_STATIONS, origins: CRAFTING_ORIGINS,
    describe: describeCrafting, normalize: normalizeCrafting, level: craftingLevel, known: isCraftingKnown, count: craftingIngredientCount
  }
};

const SPECIES_NAME = Object.fromEntries(speciesRows.map((s) => [s.id, s.name]));
const speciesName = (id) => SPECIES_NAME[id] ?? (id === 'jeskynni_sliz' ? 'Jeskynní sliz' : id);
const percent = (value) => `${value >= 1 ? Math.round(value) : value.toFixed(1).replace('.', ',')} %`;

let index = null;

function buildIndex() {
  const uses = {};   // itemId → [{ prof, recipe, qty }]
  const sources = {}; // itemId → [{ kind, text, prof?, recipe? }]
  const addSource = (id, source) => {
    if (!id) return;
    const list = (sources[id] ??= []);
    if (!list.some((s) => s.text === source.text)) list.push(source);
  };

  // Recepty: výrobek ← recept, surovina → recept.
  for (const [prof, book] of Object.entries(RECIPE_BOOKS)) {
    for (const recipe of book.all) {
      addSource(book.outputId(recipe), { kind: 'recipe', prof, recipe, text: `${book.title} ${recipe.level}: ${recipe.name} (${recipe.qty} ks)` });
      for (const [key, qty] of Object.entries(recipe.ingredients ?? {})) {
        for (const id of key.split('|')) (uses[id] ??= []).push({ prof, recipe, qty, alternative: key.includes('|') });
      }
    }
  }

  // Rybolov: lokality a šance (váha / součet vah).
  for (const loc of LOCATIONS) {
    const total = Object.values(loc.table).reduce((sum, w) => sum + w, 0);
    for (const [id, weight] of Object.entries(loc.table)) {
      addSource(id, { kind: 'fishing', prof: 'fishing', text: `Rybolov: ${loc.name} (${loc.region}, úr. ${loc.minLevel}) – ${percent((weight / total) * 100)}` });
    }
  }

  // Těžba: hlavní a vedlejší suroviny nalezišť, speciální naleziště, vzácné nálezy.
  for (const dep of DEPOSITS) {
    addSource(dep.main, { kind: 'mining', prof: 'mining', text: `Těžba: ${dep.name} (${dep.region}, úr. ${dep.minLevel})` });
    for (const side of dep.sides ?? []) addSource(side, { kind: 'mining', prof: 'mining', text: `Těžba – vedlejší nález: ${dep.name} (${dep.region})` });
  }
  for (const dep of SPECIAL_DEPOSITS) {
    for (const id of [dep.main, ...Object.keys(dep.table ?? {})]) addSource(id, { kind: 'mining', prof: 'mining', text: `Těžba: ${dep.name} (${dep.region}, úr. ${dep.minLevel})` });
    if (dep.rareFind) addSource(dep.rareFind.id, { kind: 'mining', prof: 'mining', text: `Těžba – vzácný nález: ${dep.name}` });
  }
  for (const find of RARE_FINDS) addSource(find.id, { kind: 'mining', prof: 'mining', text: 'Těžba – vzácný nález na nalezištích' });

  // Sběr bylin.
  for (const site of HERB_SITES) {
    addSource(site.main, { kind: 'herbalism', prof: 'herbalism', text: `Sběr bylin: ${site.name} (${site.region}, úr. ${site.minLevel})` });
    if (site.side) addSource(site.side, { kind: 'herbalism', prof: 'herbalism', text: `Sběr bylin – vedlejší rostlina: ${site.name}` });
  }
  for (const site of SPECIAL_HERB_SITES) {
    for (const id of [site.main, site.side, site.guaranteed, ...Object.keys(site.table ?? {})].filter(Boolean)) addSource(id, { kind: 'herbalism', prof: 'herbalism', text: `Sběr bylin: ${site.name} (${site.region}, úr. ${site.minLevel})` });
    for (const id of site.finds ?? []) addSource(id, { kind: 'herbalism', prof: 'herbalism', text: `Sběr bylin – vzácný nález: ${site.name}` });
  }
  for (const find of HERB_RARE_FINDS) addSource(find.id, { kind: 'herbalism', prof: 'herbalism', text: 'Sběr bylin – vzácný nález' });

  // Drop z monster (materiály, maso, dřevo).
  for (const [species, ids] of Object.entries(SPECIES_DROPS)) {
    if (species === 'cave_slime') continue;
    for (const id of ids ?? []) addSource(id, { kind: 'drop', text: `Drop: ${speciesName(species)}` });
  }
  for (const meat of MEATS) addSource(meat.id, { kind: 'drop', text: `Drop: ${meat.from.map(speciesName).join(', ')}` });
  addSource(WOOD_DROP.id, { kind: 'drop', text: `Drop: ${WOOD_DROP.from.map(speciesName).join(', ')}` });

  // Obchody.
  for (const good of [...FISHER_GOODS, ...FISHER_EXTRA_GOODS]) addSource(good.id, { kind: 'shop', text: `Obchod: Rybář v Rybářské chatě (${good.price} zlata${good.qty > 1 ? ` / ${good.qty} ks` : ''})` });
  for (const good of MINER_GOODS) addSource(good.id, { kind: 'shop', text: `Obchod: Hornický mistr v kovárně (${good.price} zlata)` });
  for (const merchant of Object.values(MERCHANTS)) {
    for (const good of merchant.goods) addSource(good.id, { kind: 'shop', text: `Obchod: ${merchant.name} (${merchant.title}, ${good.price} zlata${good.qty > 1 ? ` / ${good.qty} ks` : ''})` });
  }
  for (const good of HERBALIST_STOCK) addSource(good.id, { kind: 'shop', text: `Obchod: Bylinkářka (${good.price} zlata, ${good.daily} ks denně)` });

  index = { uses, sources };
  return index;
}

const db = () => index ?? buildIndex();

// Ve kterých receptech se předmět používá (seřazeno podle profese a úrovně).
export function itemUses(itemId) {
  const order = Object.keys(RECIPE_BOOKS);
  return [...(db().uses[itemId] ?? [])].sort((a, b) => order.indexOf(a.prof) - order.indexOf(b.prof) || a.recipe.level - b.recipe.level);
}

// Odkud se předmět získá.
export function itemSources(itemId) {
  return db().sources[itemId] ?? [];
}

// Předměty pro Databázi: všechny předměty hry seřazené podle jména; filtr a hledání.
export const DATABASE_FILTERS = [
  { id: 'all', label: 'Vše' },
  { id: 'materials', label: 'Suroviny' },
  { id: 'made', label: 'Výrobky' },
  { id: 'gear', label: 'Výbava' },
  { id: 'other', label: 'Ostatní' }
];

const isGear = (item) => Boolean(item.slot);
const isMade = (item) => (db().sources[item.id] ?? []).some((s) => s.kind === 'recipe');

// Hledání bez ohledu na velikost písmen a diakritiku („koze“ najde „Kůže“).
const plain = (text) => String(text).toLocaleLowerCase('cs').normalize('NFD').replace(/[̀-ͯ]/g, '');

export function searchItems(query = '', filter = 'all') {
  const q = plain(query.trim());
  return Object.values(ITEMS)
    .filter((item) => {
      if (q && !plain(item.name).includes(q)) return false;
      if (filter === 'materials') return item.category === 'materials' && !isGear(item);
      if (filter === 'made') return isMade(item) && !isGear(item);
      if (filter === 'gear') return isGear(item);
      if (filter === 'other') return item.category !== 'materials' && !isGear(item) && !isMade(item);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
}

export const recipeOutput = (prof, recipe) => getItem(RECIPE_BOOKS[prof].outputId(recipe));
