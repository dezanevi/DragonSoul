import { getItem } from '../data/items.js';
import { MERCHANTS, FISHER_EXTRA_GOODS } from '../data/merchants.js';
import { HERBALIST_STOCK } from '../data/herbalism.js';
import { GOODS as FISHER_GOODS } from '../scenes/FishingShopScene.js';
import { GOODS as MINER_GOODS } from '../scenes/MiningShopScene.js';
import { itemSources } from './ProfessionDatabase.js';

// Hodnota předmětu (zl za kus) pro výkup u obchodníků. Pořadí:
//   1. vlastní cena předmětu (price),
//   2. nejnižší cena za kus u obchodníků,
//   3. výrobek: hodnota surovin nejlevnějšího receptu × 1,3 / počet kusů z výroby,
//   4. jinak podle vzácnosti.
// Výkupní cena = polovina hodnoty (aspoň 1 zl).

const RARITY_VALUE = { common: 2, uncommon: 6, rare: 15, epic: 40, legendary: 100 };
const CRAFT_MARKUP = 1.3;

const shopUnitPrice = new Map();
const addShopPrice = (id, price, qty = 1) => {
  const unit = price / Math.max(1, qty);
  if (!shopUnitPrice.has(id) || unit < shopUnitPrice.get(id)) shopUnitPrice.set(id, unit);
};
for (const merchant of Object.values(MERCHANTS)) for (const g of merchant.goods) addShopPrice(g.id, g.price, g.qty);
for (const g of [...FISHER_GOODS, ...FISHER_EXTRA_GOODS, ...MINER_GOODS]) addShopPrice(g.id, g.price, g.qty);
for (const g of HERBALIST_STOCK) addShopPrice(g.id, g.price);

const cache = new Map();

export function itemValue(itemId, seen = new Set()) {
  if (cache.has(itemId)) return cache.get(itemId);
  const item = getItem(itemId);
  if (!item || item.category === 'keys') return 0;
  let value = item.price > 0 ? item.price : shopUnitPrice.get(itemId) ?? 0;
  if (!value && !seen.has(itemId)) {
    seen.add(itemId);
    // Výrobek: nejlevnější recept (u náhrad „a|b“ se počítá první surovina).
    for (const source of itemSources(itemId)) {
      if (source.kind !== 'recipe') continue;
      const { recipe } = source;
      let sum = 0;
      for (const [key, qty] of Object.entries(recipe.ingredients ?? {})) sum += itemValue(key.split('|')[0], seen) * qty;
      const perPiece = (sum * CRAFT_MARKUP) / Math.max(1, recipe.qty ?? 1);
      if (perPiece > 0 && (!value || perPiece < value)) value = perPiece;
    }
    seen.delete(itemId);
  }
  if (!value) value = RARITY_VALUE[item.rarity] ?? RARITY_VALUE.common;
  value = Math.max(1, Math.round(value));
  cache.set(itemId, value);
  return value;
}

// Kolik obchodník za kus zaplatí.
export function sellPrice(itemId) {
  const value = itemValue(itemId);
  return value ? Math.max(1, Math.floor(value / 2)) : 0;
}
