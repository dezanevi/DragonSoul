import { getItem } from '../data/items.js';
import { MERCHANTS, FISHER_EXTRA_GOODS } from '../data/merchants.js';
import { HERBALIST_STOCK } from '../data/herbalism.js';
import { GOODS as FISHER_GOODS } from '../scenes/FishingShopScene.js';
import { GOODS as MINER_GOODS } from '../scenes/MiningShopScene.js';
import { itemSources } from './ProfessionDatabase.js';

// Hodnota předmětu (zl za kus) pro výkup a vlastní obchod. Pořadí:
//   1. nejnižší cena za kus u obchodníků (u surovin i vlastní cena předmětu – price),
//   2. výrobek, který obchodníci neprodávají: nejlevnější recept (má přednost před price) – suroviny koupitelné u obchodníků za nákupní cenu (bez
//      přirážky), vlastní suroviny (nasbírané, vytěžené, kořist) s přirážkou podle obtížnosti
//      receptu (craftMarkup: úroveň 1 → 1,1×, úroveň 100 → 1,9×),
//   4. jinak podle vzácnosti.
// Výkupní cena = polovina hodnoty (aspoň 1 zlata).
//
// Ekonomika: z koupených surovin nejde vydělat – výrobek z nich má hodnotu jejich ceny
// a ve vlastním obchodě zákazníci koupitelnou část nepřeplácejí (boughtValue, DiplomacySystem).
// Vlastní suroviny a těžší recepty dávají větší zisk.

const RARITY_VALUE = { common: 2, uncommon: 6, rare: 15, epic: 40, legendary: 100 };
export const CRAFT_MARKUP_MIN = 1.1;
export const CRAFT_MARKUP_MAX = 1.9;

// Přirážka za vlastní suroviny podle úrovně receptu (obtížnost).
export const craftMarkup = (level) => CRAFT_MARKUP_MIN
  + (CRAFT_MARKUP_MAX - CRAFT_MARKUP_MIN) * (Math.min(100, Math.max(1, Number(level) || 1)) - 1) / 99;

const shopUnitPrice = new Map();
const addShopPrice = (id, price, qty = 1) => {
  const unit = price / Math.max(1, qty);
  if (!shopUnitPrice.has(id) || unit < shopUnitPrice.get(id)) shopUnitPrice.set(id, unit);
};
for (const merchant of Object.values(MERCHANTS)) for (const g of merchant.goods) addShopPrice(g.id, g.price, g.qty);
for (const g of [...FISHER_GOODS, ...FISHER_EXTRA_GOODS, ...MINER_GOODS]) addShopPrice(g.id, g.price, g.qty);
for (const g of HERBALIST_STOCK) addShopPrice(g.id, g.price);

export const merchantUnitPrice = (itemId) => shopUnitPrice.get(itemId) ?? 0;

// { value, bought }: bought = část hodnoty z koupitelných surovin (za kus, nezaokrouhleno).
const cache = new Map();
function valueParts(itemId, seen = new Set()) {
  if (cache.has(itemId)) return cache.get(itemId);
  const item = getItem(itemId);
  if (!item || item.category === 'keys') return { value: 0, bought: 0 };
  const shop = shopUnitPrice.get(itemId) ?? 0;
  // Zboží z obchodu nemá vyšší hodnotu, než za kolik se dá koupit (jinak přeprodej se ziskem).
  let value = item.price > 0 ? (shop ? Math.min(item.price, shop) : item.price) : shop;
  let bought = shop ? value : 0;
  // Cyklus receptů (předmět je surovinou sám sebe): bez receptu a bez ukládání do cache.
  if (seen.has(itemId)) return { value: value || (RARITY_VALUE[item.rarity] ?? RARITY_VALUE.common), bought };
  {
    seen.add(itemId);
    // Výrobek: nejlevnější recept (u náhrad „a|b“ se počítá první surovina).
    let best = null;
    for (const source of itemSources(itemId)) {
      if (source.kind !== 'recipe') continue;
      const { recipe } = source;
      let boughtSum = 0;
      let ownSum = 0;
      for (const [key, qty] of Object.entries(recipe.ingredients ?? {})) {
        const part = valueParts(key.split('|')[0], seen);
        boughtSum += part.bought * qty;
        ownSum += (part.value - part.bought) * qty;
      }
      const pieces = Math.max(1, recipe.qty ?? 1);
      const perPiece = (boughtSum + ownSum * craftMarkup(recipe.level)) / pieces;
      if (perPiece > 0 && (!best || perPiece < best.value)) best = { value: perPiece, bought: boughtSum / pieces };
    }
    seen.delete(itemId);
    // Výrobek, který obchodníci neprodávají: hodnota podle receptu i tam, kde má v datech
    // pevnou cenu (ta byla často 2–3× nad cenou koupených surovin = výdělek bez práce).
    if (best && !shop) ({ value, bought } = best);
  }
  if (!value) value = RARITY_VALUE[item.rarity] ?? RARITY_VALUE.common;
  const parts = { value, bought: Math.min(value, bought) };
  cache.set(itemId, parts);
  return parts;
}

export function itemValue(itemId) {
  const { value } = valueParts(itemId);
  return value ? Math.max(1, Math.round(value)) : 0;
}

// Kolik z hodnoty předmětu tvoří suroviny koupitelné u obchodníků (zl za kus).
export const boughtValue = (itemId) => Math.min(itemValue(itemId), valueParts(itemId).bought);

// Kolik obchodník za kus zaplatí.
export function sellPrice(itemId) {
  const value = itemValue(itemId);
  return value ? Math.max(1, Math.floor(value / 2)) : 0;
}
