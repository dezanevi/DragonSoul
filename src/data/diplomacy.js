// Diplomacie a vlastní obchodování (dokument „Diplomacie“, 1. etapa: vlastní obchod).
// Všechna čísla jsou výchozí návrhové parametry – ekonomika (ceny, rozpočty, náklady) se bude
// ladit souhrnně později, proto jsou tady na jednom místě.
import { ITEMS, getItem } from './items.js';
import { itemValue } from '../systems/ItemValueSystem.js';

// ------------------------------------------------------------------ progrese
export const DIPLOMACY_MAX_LEVEL = 100;
export const xpToNextDiplomacyLevel = (level) => Math.round(20 * Math.max(1, level) ** 1.5);

export const DIPLOMACY_TIERS = [
  { tier: 'I', from: 1, to: 15, name: 'Začínající obchodník' },
  { tier: 'II', from: 16, to: 30, name: 'Místní obchodník' },
  { tier: 'III', from: 31, to: 50, name: 'Zkušený obchodník' },
  { tier: 'IV', from: 51, to: 70, name: 'Regionální obchodník' },
  { tier: 'V', from: 71, to: 90, name: 'Obchodní magnát' },
  { tier: 'VI', from: 91, to: 100, name: 'Mistr diplomacie' }
];
export const diplomacyTier = (level) => DIPLOMACY_TIERS.find((t) => level >= t.from && level <= t.to) ?? DIPLOMACY_TIERS[0];

// Odemykání funkcí (1. etapa: hotové je 1 a 10, ostatní přijdou v dalších etapách).
export const DIPLOMACY_UNLOCKS = [
  { level: 1, text: 'Společenské interakce a obchod s NPC', ready: true },
  { level: 10, text: 'Zakoupení vlastního stánku nebo obchodu', ready: true },
  { level: 20, text: 'Zaměstnávání prodavačů' },
  { level: 30, text: 'Rozšíření obchodu a specializace' },
  { level: 35, text: 'Zkušený prodavač' },
  { level: 45, text: 'Automatické doplňování zboží' },
  { level: 50, text: 'Obchodní dům' },
  { level: 60, text: 'Obchodní zástupce' },
  { level: 75, text: 'Automatická správa cen' },
  { level: 80, text: 'Obchodní sídlo' },
  { level: 90, text: 'Přístup k prestižním zákazníkům' },
  { level: 100, text: 'Maximální obchodní možnosti' }
];

// ------------------------------------------------------------------ zkušenosti
export const DIPLOMACY_XP = {
  newDialog: 10,          // nový rozhovor s NPC (stejný rozhovor znovu = 0)
  quest: 50,              // splněný úkol (jednorázově za každý úkol)
  npcBuyFactor: 0.5,      // nákup u NPC obchodníka = polovina XP předmětu
  npcSellFactor: 1,       // prodej NPC obchodníkovi
  shopSellFactor: 1,      // prodej zákazníkovi ve vlastním obchodě
  repeatDecay: 0.8,       // každý další obchod stejného předmětu během herního dne × 0,8
  repeatFloor: 0.1,       // …ale nejméně 10 %
  worthlessValue: 1       // předmět s hodnotou do 1 zlata nedává XP (ochrana proti zneužití)
};
const RARITY_XP_BONUS = { common: 0, uncommon: 1, rare: 3, epic: 6, legendary: 12 };

// XP hodnota předmětu: o kolik zvedne Diplomacii jeden obchod s ním (cena + vzácnost).
// Za obchod se počítá celá položka, ne každý kus: větší množství přidá jen mírně (√ množství).
const xpCache = new Map();
export function diplomacyItemXp(itemId) {
  if (xpCache.has(itemId)) return xpCache.get(itemId);
  const item = getItem(itemId);
  let xp = 0;
  if (item && isTradeable(item)) {
    const value = itemValue(itemId);
    if (value > DIPLOMACY_XP.worthlessValue) xp = Math.max(1, Math.round(Math.log2(value + 1) * 1.5)) + (RARITY_XP_BONUS[item.rarity] ?? 0);
  }
  xpCache.set(itemId, xp);
  return xp;
}

// ------------------------------------------------------------------ čas
// Herní den = 24 minut skutečného hraní (obchod běží jen při zapnuté hře – žádný offline příjem).
export const GAME_DAY_MS = 24 * 60 * 1000;
export const TRADE_INTERVAL_MS = 10 * 1000; // jeden obchodní interval (144 za den)
export const INTERVALS_PER_DAY = GAME_DAY_MS / TRADE_INTERVAL_MS;

// ------------------------------------------------------------------ provozovny
// Ceny podle dokumentu; zelený dům v Greenvale má zatím symbolickou cenu (PROPERTIES).
export const PROPERTY_TYPES = {
  stall: { name: 'Tržní stánek', level: 10, price: 2500, slots: 8, customers: 15, dailyCost: 1 },
  small_shop: { name: 'Malý obchod', level: 10, price: 10000, slots: 16, customers: 30, dailyCost: 2 },
  extended_shop: { name: 'Rozšířený obchod', level: 30, price: 30000, slots: 32, customers: 60, dailyCost: 5 },
  trade_house: { name: 'Obchodní dům', level: 50, price: 100000, slots: 64, customers: 120, dailyCost: 12 },
  trade_seat: { name: 'Obchodní sídlo', level: 80, price: 300000, slots: 128, customers: 200, dailyCost: 30 }
};

// Maximální počet vlastněných provozoven podle Diplomacie.
export const MAX_PROPERTIES = [[10, 1], [30, 2], [50, 3], [70, 5], [90, 8], [100, 10]];
export const maxProperties = (level) => MAX_PROPERTIES.reduce((n, [lvl, count]) => (level >= lvl ? count : n), 0);

// Konkrétní nemovitosti na prodej (kupují se u starosty). building = id budovy v mapě.
export const PROPERTIES = {
  greenvale_house_w1: {
    id: 'greenvale_house_w1',
    name: 'Zelený dům u náměstí',
    region: 'Greenvale',
    type: 'small_shop',
    price: 500, // první obchod: hráč na něj vydělá úkoly v Demu (záložka „Demo – úkoly“)
    seller: 'Starosta Edric'
  }
};

// ------------------------------------------------------------------ ekonomické kategorie
// pop = výchozí popularita (1–100), maxQty = nejvíc kusů na jeden nákup zákazníka,
// capacity = kolik kusů denně oblast spotřebuje (nasycení), recovery = obnova poptávky za den.
const RECOVERY = { veryFast: 1.0, fast: 0.7, medium: 0.4, slow: 0.2, verySlow: 0.1, exceptional: 0.05 };
export const ECONOMIC_CATEGORIES = {
  meals: { name: 'Hotová jídla', pop: 95, maxQty: 3, capacity: 80, recovery: RECOVERY.veryFast },
  food: { name: 'Základní potraviny', pop: 90, maxQty: 5, capacity: 100, recovery: RECOVERY.veryFast },
  fish: { name: 'Ryby', pop: 85, maxQty: 4, capacity: 80, recovery: RECOVERY.veryFast },
  herbs: { name: 'Byliny', pop: 80, maxQty: 5, capacity: 70, recovery: RECOVERY.fast },
  wood: { name: 'Dřevo a palivo', pop: 78, maxQty: 6, capacity: 60, recovery: RECOVERY.fast },
  potions: { name: 'Lektvary', pop: 75, maxQty: 2, capacity: 40, recovery: RECOVERY.fast },
  cloth: { name: 'Látky a kůže', pop: 70, maxQty: 3, capacity: 30, recovery: RECOVERY.medium },
  tools: { name: 'Pracovní nástroje', pop: 65, maxQty: 1, capacity: 10, recovery: RECOVERY.slow },
  ores: { name: 'Běžné rudy', pop: 50, maxQty: 5, capacity: 40, recovery: RECOVERY.medium },
  metals: { name: 'Zpracované kovy', pop: 45, maxQty: 3, capacity: 25, recovery: RECOVERY.medium },
  craftMaterials: { name: 'Výrobní materiály', pop: 30, maxQty: 3, capacity: 30, recovery: RECOVERY.medium },
  gear: { name: 'Zbraně a zbroje', pop: 35, maxQty: 1, capacity: 8, recovery: RECOVERY.verySlow },
  jewelry: { name: 'Šperky', pop: 25, maxQty: 1, capacity: 4, recovery: RECOVERY.verySlow },
  magicMaterials: { name: 'Magické materiály', pop: 15, maxQty: 2, capacity: 6, recovery: RECOVERY.slow },
  magicGear: { name: 'Magické vybavení', pop: 15, maxQty: 1, capacity: 4, recovery: RECOVERY.verySlow },
  soulCrystals: { name: 'Soul Crystaly', pop: 12, maxQty: 2, capacity: 6, recovery: RECOVERY.slow },
  rareMaterials: { name: 'Vzácné výrobní materiály', pop: 8, maxQty: 2, capacity: 6, recovery: RECOVERY.slow },
  legendary: { name: 'Legendární materiály', pop: 2, maxQty: 1, capacity: 1, recovery: RECOVERY.exceptional }
};

const FOOD_IDS = new Set(['vegetables', 'flour', 'forest_mushrooms', 'clean_water', 'behemoth_shoulder', 'kraken_tentacle']);
const TOOL_KEYS = ['herbTool', 'pickaxe', 'miningTool', 'rod', 'fishingMetal', 'bait'];
const RARE_RARITY = new Set(['rare', 'epic']);

// Příběhové a neobchodovatelné předměty (klíče, pověření…) se prodávat nedají.
export const isTradeable = (item) => Boolean(item) && item.category !== 'keys' && !item.quest;

export function economicCategory(itemOrId) {
  const item = typeof itemOrId === 'string' ? getItem(itemOrId) : itemOrId;
  if (!isTradeable(item)) return null;
  const id = item.id;
  if ((item.category === 'materials' || item.category === 'food') && item.rarity === 'legendary' && !item.use) return 'legendary';
  if (item.use?.type === 'meal' || id === 'travel_ration') return 'meals';
  if (item.category === 'potions') return 'potions';
  if (id.startsWith('meat_') || id.startsWith('cm_') || FOOD_IDS.has(id)) return 'food';
  if (item.fishing) return id.startsWith('fish') ? 'fish' : RARE_RARITY.has(item.rarity) ? 'jewelry' : 'craftMaterials';
  if (item.herbal) return 'herbs';
  if (id === 'wood' || id === 'wax') return 'wood';
  if (id === 'fiber' || id.startsWith('leather')) return 'cloth';
  if (TOOL_KEYS.some((k) => item[k])) return 'tools';
  if (item.mining) return id.startsWith('gem_') || id.includes('crystal') || RARE_RARITY.has(item.rarity) ? 'rareMaterials' : 'ores';
  if (id.startsWith('sm_') || id === 'iron_clasp') return 'metals';
  // Šperky a fokusy (dřív kategorie Doplňky, teď ve Vybavení) zůstávají ekonomicky šperky.
  if (item.slot === 'amulet' || item.slot === 'ring' || (item.slot === 'shield' && item.crafting)) return 'jewelry';
  if (item.category === 'armor' || id.startsWith('smith_D')) return 'gear';
  if (item.category === 'accessories' || id.startsWith('cr_cut_')) return 'jewelry';
  if (/_crystal$/.test(id)) return 'soulCrystals';
  if (id.startsWith('al_') || id.startsWith('am_') || id.startsWith('alch_')) return 'magicMaterials';
  if (item.category === 'other' && item.crafting) return 'magicGear';
  if (id.startsWith('mat_')) return RARE_RARITY.has(item.rarity) ? 'rareMaterials' : 'craftMaterials';
  return 'craftMaterials';
}

// Popularita předmětu (1–100): výchozí hodnota kategorie upravená podle vzácnosti a ceny
// a o malou individuální odchylku – předměty stejné kategorie nemají stejnou popularitu.
// Popularita nezvyšuje hodnotu předmětu (jen pravděpodobnost nákupu).
const RARITY_POP = { common: 1, uncommon: 0.85, rare: 0.6, epic: 0.4, legendary: 0.25 };
const popCache = new Map();
const hashId = (id) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return ((h >>> 0) % 1000) / 1000; };
export function itemPopularity(itemId) {
  if (popCache.has(itemId)) return popCache.get(itemId);
  const item = getItem(itemId);
  const cat = economicCategory(item);
  let pop = 0;
  if (cat) {
    const base = ECONOMIC_CATEGORIES[cat].pop;
    const value = Math.max(1, itemValue(itemId));
    const priceFactor = Math.min(1.1, Math.max(0.7, 1.1 - Math.log10(value) / 10));
    pop = base * (cat === 'legendary' ? 1 : RARITY_POP[item.rarity] ?? 1) * priceFactor + (hashId(itemId) - 0.5) * 8;
    pop = Math.round(Math.min(cat === 'legendary' ? 5 : 100, Math.max(1, pop)));
  }
  popCache.set(itemId, pop);
  return pop;
}

export const POPULARITY_LABELS = [
  [81, 'Velmi oblíbené'], [61, 'Oblíbené'], [41, 'Žádané'], [21, 'Specializované'], [6, 'Výjimečné'], [1, 'Exkluzivní']
];
export const popularityLabel = (pop) => (POPULARITY_LABELS.find(([from]) => pop >= from) ?? POPULARITY_LABELS.at(-1))[1];

// ------------------------------------------------------------------ zákazníci
// budget = rozpočet jednoho zákazníka (zl), tolerance = ochota přijmout vyšší cenu,
// prefs = preference kategorií (chybějící = 0, zákazník o ně nestojí).
export const CUSTOMER_TYPES = {
  villager: {
    name: 'Vesničan', budget: [3, 25], tolerance: 0.95,
    prefs: { meals: 1.3, food: 1.4, fish: 1.2, herbs: 1.0, wood: 1.2, tools: 1.0, potions: 0.6, cloth: 0.7, ores: 0.2, metals: 0.3, craftMaterials: 0.2, gear: 0.2, jewelry: 0.05, soulCrystals: 0.05 }
  },
  citizen: {
    name: 'Měšťan', budget: [15, 80], tolerance: 1.05,
    prefs: { meals: 1.2, food: 0.9, fish: 0.8, potions: 1.1, cloth: 1.2, jewelry: 0.4, herbs: 0.6, wood: 0.5, tools: 0.5, gear: 0.3, magicGear: 0.2, soulCrystals: 0.1, craftMaterials: 0.2, ores: 0.2, metals: 0.3, magicMaterials: 0.1, rareMaterials: 0.05 }
  },
  crafter: {
    name: 'Řemeslník', budget: [20, 120], tolerance: 1.0,
    prefs: { ores: 1.4, metals: 1.4, cloth: 1.2, craftMaterials: 1.3, wood: 1.0, tools: 0.9, rareMaterials: 0.4, meals: 0.5, food: 0.4, fish: 0.3, herbs: 0.4, potions: 0.3, magicMaterials: 0.3, gear: 0.3, jewelry: 0.1 }
  },
  adventurer: {
    name: 'Dobrodruh', budget: [40, 250], tolerance: 1.1,
    prefs: { gear: 1.4, potions: 1.4, soulCrystals: 1.3, meals: 0.8, tools: 0.6, magicGear: 0.7, jewelry: 0.4, food: 0.5, fish: 0.3, herbs: 0.4, craftMaterials: 0.3, rareMaterials: 0.2 }
  },
  mage: {
    name: 'Alchymista nebo mág', budget: [80, 500], tolerance: 1.15,
    prefs: { herbs: 1.0, magicMaterials: 1.5, potions: 1.2, soulCrystals: 1.0, magicGear: 1.3, rareMaterials: 1.0, jewelry: 0.6, legendary: 0.3, meals: 0.4 }
  },
  noble: {
    name: 'Šlechtic', budget: [200, 1500], tolerance: 1.3,
    prefs: { meals: 1.0, jewelry: 1.5, gear: 0.6, magicGear: 0.8, potions: 0.5, rareMaterials: 0.5, legendary: 0.4, cloth: 0.6 }
  },
  collector: {
    name: 'Sběratel', budget: [500, 5000], tolerance: 1.4,
    prefs: { legendary: 1.5, rareMaterials: 1.2, jewelry: 0.8, magicGear: 0.8, soulCrystals: 0.5 }
  }
};

// ------------------------------------------------------------------ regiony
// mix = zastoupení typů zákazníků, mods = regionální modifikátory poptávky kategorií,
// population = násobek návštěvnosti (velikost osady).
export const REGION_ECONOMY = {
  Greenvale: {
    name: 'Greenvale (vesnice)',
    population: 1.0,
    mix: { villager: 0.55, citizen: 0.14, crafter: 0.14, adventurer: 0.11, mage: 0.03, noble: 0.02, collector: 0.01 },
    mods: {
      meals: 1.3, food: 1.3, fish: 1.3, herbs: 1.1, wood: 1.2, potions: 1.0, cloth: 1.0, tools: 1.5,
      ores: 0.5, metals: 0.8, craftMaterials: 0.6, gear: 0.6, jewelry: 0.3, magicMaterials: 0.2,
      magicGear: 0.25, soulCrystals: 0.4, rareMaterials: 0.2, legendary: 0.1
    }
  }
};

// ------------------------------------------------------------------ trh, ceny, reputace
// Nasycení trhu (0–1) → modifikátor poptávky.
export const SATURATION_STEPS = [[0.2, 1.0], [0.4, 0.8], [0.6, 0.6], [0.8, 0.4], [0.995, 0.15], [Infinity, 0]];
export const saturationModifier = (sat) => SATURATION_STEPS.find(([to]) => sat <= to)[1];

// Hodnocení nastavené ceny (poměr k tržní hodnotě).
export const PRICE_RATINGS = [
  [0.7, 'Velmi levné', '#7fd67a'], [0.9, 'Výhodná nabídka', '#a8e07a'], [1.1, 'Přiměřená cena', '#f3e4bd'],
  [1.3, 'Dražší zboží', '#ffd76a'], [1.5, 'Předražené zboží', '#ff9a5a'], [Infinity, 'Velmi předražené', '#ff6a5a']
];
export const priceRating = (ratio) => PRICE_RATINGS.find(([to]) => ratio < to + 1e-9);

export const REPUTATION_START = 40;
export const REPUTATION_BANDS = [
  [0, 'Nedůvěryhodný', 0.7], [20, 'Neznámý', 0.85], [40, 'Běžný', 1.0], [60, 'Oblíbený', 1.15], [80, 'Vyhlášený', 1.3], [95, 'Prestižní', 1.5]
];
export const reputationBand = (rep) => [...REPUTATION_BANDS].reverse().find(([from]) => rep >= from);

// Kalibrační koeficient pravděpodobnosti nákupu (ladění ekonomiky).
export const CALIBRATION = 1.0;
export const MAX_BUY_CHANCE = 0.95;

// Obchodovatelné předměty (pro kontrolu dat a statistiky).
export const TRADEABLE_ITEM_IDS = Object.values(ITEMS).filter((i) => economicCategory(i)).map((i) => i.id);
