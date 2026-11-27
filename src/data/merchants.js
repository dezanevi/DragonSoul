// Zboží obchodníků v Greenvale (kromě Hornického mistra a Bylinkářky, kteří mají vlastní obchody).
// price = cena balení, qty = kusů v balení.
import { STAPLES } from './cooking.js';

// Rybář (Rybářská chata): návnady z Řemeslnictví a lepší pruty (doplněk k základnímu zboží).
export const FISHER_EXTRA_GOODS = [
  { id: 'herbal_bait', price: 5, qty: 5 },
  { id: 'spiced_bait', price: 8, qty: 5 },
  { id: 'ice_bait', price: 10, qty: 5 },
  { id: 'sea_bait', price: 12, qty: 5 },
  { id: 'fire_bait', price: 15, qty: 5 },
  { id: 'glow_bait', price: 25, qty: 5 },
  { id: 'moon_bait', price: 40, qty: 5 },
  { id: 'astral_bait', price: 80, qty: 5 },
  { id: 'flexible_rod', price: 120, qty: 1 },
  { id: 'master_rod', price: 400, qty: 1 }
];

// Tržiště – potraviny (Trhovkyně).
export const MARKET_FOOD_GOODS = [
  ...STAPLES.map((s) => ({ id: s.id, price: s.price * 3, qty: 3 })),
  { id: 'clean_water', price: 3, qty: 3 },
  { id: 'forest_mushrooms', price: 4, qty: 2 },
  { id: 'fish', price: 3, qty: 1 },
  { id: 'wood', price: 2, qty: 1 }
];

// Tržiště – zboží (Obchodník s látkami).
export const MARKET_WARES_GOODS = [
  { id: 'fiber', price: 4, qty: 2 },
  { id: 'leather', price: 6, qty: 1 }, // úkol Kožený řemínek (řemínek z ní na Koželužském stole – koupit nejde)
  { id: 'wax', price: 3, qty: 1 },
  { id: 'hunting_fang', price: 40, qty: 1 }
];

export const MERCHANTS = {
  marketFood: { name: 'Trhovkyně', title: 'Tržiště – potraviny', goods: MARKET_FOOD_GOODS },
  marketWares: { name: 'Obchodník s látkami', title: 'Tržiště – zboží', goods: MARKET_WARES_GOODS }
};
