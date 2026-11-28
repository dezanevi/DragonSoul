// Diplomacie (1. etapa): dovednost s XP, nákup provozovny, vlastní obchod se skladem,
// prodejními sloty a automatickým prodejem zákazníkům během hraní (bez offline příjmu).
//
// Stav ve hře:
//   state.professions.diplomacy  { level, exp, next }  (stejně jako ostatní profese)
//   state.diplomacy              { dialogsSeen, questsRewarded, trades: { day, counts } }
//   state.business               { clock, nextInterval, day, market: { region: { kategorie: nasycení } },
//                                  properties: { id: obchod } }
import { SaveSystem } from './SaveSystem.js';
import { skillXpBefore, reportSkillXp } from './SkillXpEvents.js';
import { addCharismaXp, CHARISMA_XP_SHARE, ownShopMultiplier, npcBuyMultiplier } from './HeroStatsSystem.js';
import { getItem } from '../data/items.js';
import { countQuestEvent } from './QuestCounters.js';
import { itemValue, boughtValue } from './ItemValueSystem.js';
import { addItem, removeItem, getItemCount } from './InventorySystem.js';
import {
  DIPLOMACY_MAX_LEVEL, xpToNextDiplomacyLevel, DIPLOMACY_XP, diplomacyItemXp, GAME_DAY_MS, TRADE_INTERVAL_MS,
  INTERVALS_PER_DAY, PROPERTY_TYPES, PROPERTIES, maxProperties, ECONOMIC_CATEGORIES, economicCategory, itemPopularity,
  CUSTOMER_TYPES, REGION_ECONOMY, saturationModifier, REPUTATION_START, reputationBand, REPUTATION_BANDS,
  CALIBRATION, MAX_BUY_CHANCE
} from '../data/diplomacy.js';

// ------------------------------------------------------------------ stav
export function normalizeDiplomacy(state) {
  state.professions ??= {};
  const prof = (state.professions.diplomacy ??= { level: 1, exp: 0 });
  prof.level = Math.min(DIPLOMACY_MAX_LEVEL, Math.max(1, Math.floor(Number(prof.level) || 1)));
  prof.exp = Math.max(0, Number(prof.exp) || 0);
  prof.next = xpToNextDiplomacyLevel(prof.level);
  state.diplomacy ??= {};
  state.diplomacy.dialogsSeen ??= {};
  state.diplomacy.questsRewarded ??= {};
  state.diplomacy.trades ??= { day: 0, counts: {} };
  const b = (state.business ??= {});
  b.clock = Math.max(0, Number(b.clock) || 0);
  b.nextInterval ??= b.clock + TRADE_INTERVAL_MS;
  b.day ??= Math.floor(b.clock / GAME_DAY_MS);
  b.market ??= {};
  b.properties ??= {};
  return state;
}

export const diplomacyLevel = (state) => normalizeDiplomacy(state).professions.diplomacy.level;
export const currentGameDay = (state) => Math.floor((state.business?.clock ?? 0) / GAME_DAY_MS);

// Posluchači zisku XP (scény ukazují krátké oznámení „+10 XP Diplomacie“).
const xpListeners = new Set();
export function onDiplomacyXp(fn) {
  xpListeners.add(fn);
  return () => xpListeners.delete(fn);
}

function addDiplomacyXpRaw(state, amount, reason = '') {
  normalizeDiplomacy(state);
  const gained = Math.max(0, Math.round(amount));
  if (!gained) return { gained: 0, levelUps: 0 };
  const prof = state.professions.diplomacy;
  let levelUps = 0;
  if (prof.level < DIPLOMACY_MAX_LEVEL) {
    prof.exp += gained;
    while (prof.level < DIPLOMACY_MAX_LEVEL && prof.exp >= xpToNextDiplomacyLevel(prof.level)) {
      prof.exp -= xpToNextDiplomacyLevel(prof.level);
      prof.level += 1;
      levelUps += 1;
    }
    if (prof.level >= DIPLOMACY_MAX_LEVEL) prof.exp = 0;
    prof.next = xpToNextDiplomacyLevel(prof.level);
  }
  // Charisma roste spolu s Diplomacií (vlastní úroveň 1–20, polovina XP).
  const charisma = addCharismaXp(state, gained * CHARISMA_XP_SHARE);
  const result = { gained, levelUps, level: prof.level, reason, charismaLevelUps: charisma.levelUps, charismaLevel: charisma.level };
  for (const fn of xpListeners) fn(result);
  return result;
}

// Nový rozhovor s NPC: XP jen poprvé (stejný mluvčí + stejný text = bez XP).
export function grantDialogXp(state, speaker, lines) {
  if (!speaker || !lines?.length) return null;
  normalizeDiplomacy(state);
  const key = `${speaker}|${hashText(lines.join('\n'))}`;
  if (state.diplomacy.dialogsSeen[key]) return null;
  state.diplomacy.dialogsSeen[key] = 1;
  return addDiplomacyXp(state, DIPLOMACY_XP.newDialog, 'Nový rozhovor');
}

// Splněný úkol: jednorázově.
export function grantQuestXp(state, questId) {
  normalizeDiplomacy(state);
  if (state.diplomacy.questsRewarded[questId]) return null;
  state.diplomacy.questsRewarded[questId] = 1;
  return addDiplomacyXp(state, DIPLOMACY_XP.quest, 'Splněný úkol');
}

// Obchod: XP za položku (ne za kus) = XP předmětu × druh obchodu × (1 + log2 množství) / 2 …
// a s klesajícím výnosem při opakovaném obchodu stejného předmětu během herního dne.
const TRADE_FACTOR = { npcBuy: DIPLOMACY_XP.npcBuyFactor, npcSell: DIPLOMACY_XP.npcSellFactor, shopSell: DIPLOMACY_XP.shopSellFactor };
export function tradeXpFor(state, itemId, qty, kind) {
  normalizeDiplomacy(state);
  const base = diplomacyItemXp(itemId);
  if (!base || qty <= 0) return 0;
  const log = state.diplomacy.trades;
  const repeats = log.day === currentGameDay(state) ? log.counts[itemId] ?? 0 : 0;
  const decay = Math.max(DIPLOMACY_XP.repeatFloor, DIPLOMACY_XP.repeatDecay ** repeats);
  return base * (TRADE_FACTOR[kind] ?? 1) * (1 + Math.log2(qty) / 2) * decay;
}

export function grantTradeXp(state, lines, kind) {
  normalizeDiplomacy(state);
  const log = state.diplomacy.trades;
  const day = currentGameDay(state);
  if (log.day !== day) { log.day = day; log.counts = {}; }
  let total = 0;
  for (const { id, qty } of lines) {
    if (!qty) continue;
    total += tradeXpFor(state, id, qty, kind);
    log.counts[id] = (log.counts[id] ?? 0) + 1;
  }
  return total >= 0.5 ? addDiplomacyXp(state, total, 'Obchod') : null;
}

function hashText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

// ------------------------------------------------------------------ provozovny
export const propertyFor = (buildingId) => PROPERTIES[buildingId] ?? null;
export const getShop = (state, id) => normalizeDiplomacy(state).business.properties[id] ?? null;
export const ownedShops = (state) => Object.values(normalizeDiplomacy(state).business.properties);

export function canBuyProperty(state, id) {
  const prop = PROPERTIES[id];
  if (!prop) return { ok: false, reason: 'Tahle nemovitost není na prodej.' };
  const type = PROPERTY_TYPES[prop.type];
  const level = diplomacyLevel(state);
  if (getShop(state, id)) return { ok: false, reason: 'Tenhle dům už je tvůj.' };
  if (level < type.level) return { ok: false, reason: `Potřebuješ Diplomacii ${type.level} (máš ${level}).` };
  if (ownedShops(state).length >= maxProperties(level)) return { ok: false, reason: 'Na své úrovni Diplomacie už víc provozoven mít nemůžeš.' };
  if ((state.gold ?? 0) < prop.price) return { ok: false, reason: `Nemáš dost zlata (stojí ${prop.price}).` };
  return { ok: true };
}

export function buyProperty(state, id) {
  const check = canBuyProperty(state, id);
  if (!check.ok) return check;
  const prop = PROPERTIES[id];
  const type = PROPERTY_TYPES[prop.type];
  state.gold -= prop.price;
  state.business.properties[id] = {
    id, type: prop.type, region: prop.region, name: prop.name,
    open: true, debt: 0, till: 0, reputation: REPUTATION_START, repMilestones: {},
    storage: {}, slots: Array.from({ length: type.slots }, () => null),
    specialization: 'mixed', employees: [],
    purchasedDay: currentGameDay(state),
    stats: { revenue: 0, costs: 0, customers: 0, trades: 0, today: newDayStats(currentGameDay(state)), days: [], items: {}, history: [] }
  };
  return { ok: true };
}

const newDayStats = (day) => ({ day, revenue: 0, costs: 0, customers: 0, trades: 0, priceRatioSum: 0, priceRatioCount: 0 });

// ------------------------------------------------------------------ sklad a nabídka
export const storageQty = (shop, itemId) => shop.storage[itemId] ?? 0;

export function moveToStorage(state, shopId, itemId, qty) {
  const shop = getShop(state, shopId);
  const item = getItem(itemId);
  if (!shop || !economicCategory(item)) return 0;
  const moved = Math.min(qty, getItemCount(state, itemId));
  if (moved <= 0 || !removeItem(state, itemId, moved)) return 0;
  shop.storage[itemId] = storageQty(shop, itemId) + moved;
  return moved;
}

export function moveToInventory(state, shopId, itemId, qty) {
  const shop = getShop(state, shopId);
  if (!shop) return 0;
  const want = Math.min(qty, storageQty(shop, itemId));
  if (want <= 0) return 0;
  const left = addItem(state, itemId, want);
  const moved = want - left;
  shop.storage[itemId] -= moved;
  if (shop.storage[itemId] <= 0) delete shop.storage[itemId];
  return moved;
}

// Prodejní slot = předmět + cena; prodává se ze skladu (stejný předmět jen v jednom slotu).
export function setSlot(state, shopId, index, itemId) {
  const shop = getShop(state, shopId);
  if (!shop || index < 0 || index >= shop.slots.length) return false;
  if (itemId && shop.slots.some((s, i) => i !== index && s?.itemId === itemId)) return false;
  shop.slots[index] = itemId ? { itemId, price: Math.max(1, itemValue(itemId)) } : null;
  return true;
}

export function setSlotPrice(state, shopId, index, price) {
  const slot = getShop(state, shopId)?.slots[index];
  if (!slot) return;
  slot.price = Math.max(1, Math.round(price));
}

// Platba z pokladny obchodu, co chybí, ze zlata hrdiny.
function payFromTill(state, shop, amount) {
  const fromTill = Math.min(Number(shop.till) || 0, amount);
  shop.till = (Number(shop.till) || 0) - fromTill;
  state.gold = (Number(state.gold) || 0) - (amount - fromTill);
}

// Vybrání pokladny: tržby obchodu → zlato hrdiny. Vrací vybranou částku.
export function collectTill(state, shopId) {
  const shop = getShop(state, shopId);
  const amount = Math.max(0, Math.floor(Number(shop?.till) || 0));
  if (!amount) return 0;
  shop.till -= amount;
  state.gold = (Number(state.gold) || 0) + amount;
  return amount;
}

export function setShopOpen(state, shopId, open) {
  const shop = getShop(state, shopId);
  if (!shop) return { ok: false };
  if (open && shop.debt > 0) {
    if ((Number(shop.till) || 0) + (state.gold ?? 0) < shop.debt) return { ok: false, reason: `Nejdřív uhraď dluh za provoz: ${shop.debt} zlata.` };
    payFromTill(state, shop, shop.debt);
    shop.stats.costs += shop.debt;
    shop.debt = 0;
  }
  shop.open = open;
  shop.closedReason = open ? null : 'player';
  return { ok: true };
}

// ------------------------------------------------------------------ odhady pro UI
export function marketSaturation(state, region, cat) {
  return normalizeDiplomacy(state).business.market[region]?.[cat] ?? 0;
}

export function customersPerDay(state, shop) {
  const type = PROPERTY_TYPES[shop.type];
  const region = REGION_ECONOMY[shop.region] ?? REGION_ECONOMY.Greenvale;
  return type.customers * reputationBand(shop.reputation)[2] * region.population * ownShopMultiplier(state); // + Charisma
}

// Pravděpodobnost, že zákazník daného typu s potřebou kategorie koupí předmět za cenu.
export function buyChance(state, shop, itemId, price, typeId) {
  const cat = economicCategory(itemId);
  const type = CUSTOMER_TYPES[typeId];
  const region = REGION_ECONOMY[shop.region] ?? REGION_ECONOMY.Greenvale;
  const pref = type.prefs[cat] ?? 0;
  if (!cat || !pref) return 0;
  const value = itemValue(itemId);
  // Ekonomika: část hodnoty z koupitelných surovin zákazník nepřeplatí (tolerance platí jen na
  // vlastní práci a suroviny) a nad férovou cenu šance klesá tím prudčeji, čím víc je zboží
  // „z obchodu“ – přeprodej koupeného zboží se nevyplatí. Koupitelná část se počítá za cenu,
  // za kterou ji hrdina koupí (sleva z Charismatu), aby se nevyplatil ani přeprodej se slevou.
  const bought = boughtValue(itemId);
  const share = value > 0 ? bought / value : 0;
  const fair = bought * npcBuyMultiplier(state) + (value - bought) * type.tolerance;
  const ratio = fair / Math.max(1, price);
  const priceFactor = Math.min(1.5, ratio ** (ratio < 1 ? 2 + 4 * share : 2));
  const sat = saturationModifier(marketSaturation(state, shop.region, cat));
  const p = (itemPopularity(itemId) / 100) * pref * (region.mods[cat] ?? 1) * priceFactor * sat * CALIBRATION * ownShopMultiplier(state); // + Charisma
  return Math.min(MAX_BUY_CHANCE, Math.max(0, p));
}

const needWeights = (typeId, region) => {
  const prefs = CUSTOMER_TYPES[typeId].prefs;
  return Object.entries(prefs).map(([cat, w]) => [cat, w * (region.mods[cat] ?? 1)]).filter(([, w]) => w > 0);
};

// Odhad prodaných kusů za den (pro sloupec „rychlost prodeje“).
export function estimateDailySales(state, shop, slot) {
  if (!slot) return 0;
  const cat = economicCategory(slot.itemId);
  const region = REGION_ECONOMY[shop.region] ?? REGION_ECONOMY.Greenvale;
  const maxQty = ECONOMIC_CATEGORIES[cat]?.maxQty ?? 1;
  let perCustomer = 0;
  for (const [typeId, share] of Object.entries(region.mix)) {
    const weights = needWeights(typeId, region);
    const total = weights.reduce((s, [, w]) => s + w, 0);
    const w = weights.find(([c]) => c === cat)?.[1] ?? 0;
    const needChance = total ? Math.min(1, (1.5 * w) / total) : 0;
    const budgetAvg = (CUSTOMER_TYPES[typeId].budget[0] + CUSTOMER_TYPES[typeId].budget[1]) / 2;
    const qty = Math.max(0, Math.min((1 + maxQty) / 2, budgetAvg / Math.max(1, slot.price)));
    perCustomer += share * needChance * buyChance(state, shop, slot.itemId, slot.price, typeId) * qty;
  }
  return perCustomer * customersPerDay(state, shop);
}

// ------------------------------------------------------------------ simulace
let activeState = null;
export function bindBusinessState(state) {
  activeState = state ? normalizeDiplomacy(state) : null;
}

const saleListeners = new Set();
export function onShopSale(fn) {
  saleListeners.add(fn);
  return () => saleListeners.delete(fn);
}

// Voláno každý snímek hry (main.js). Čas běží jen při zapnuté hře; velké skoky (uspaný panel)
// se omezí, takže nevzniká pasivní příjem mimo hraní.
export function tickBusiness(deltaMs) {
  const state = activeState;
  if (!state || !Object.keys(state.business.properties).length) return;
  const b = state.business;
  b.clock += Math.min(Math.max(0, deltaMs), 2000);
  let sold = false;
  let guard = 0;
  while (b.clock >= b.nextInterval && guard++ < 10) {
    sold = processInterval(state) || sold;
    b.nextInterval += TRADE_INTERVAL_MS;
  }
  if (b.clock >= b.nextInterval) b.nextInterval = b.clock + TRADE_INTERVAL_MS;
  const day = Math.floor(b.clock / GAME_DAY_MS);
  while (b.day < day) {
    b.day += 1;
    processDay(state, b.day);
    sold = true;
  }
  if (sold && b.clock - (b.lastSave ?? 0) > 30000) {
    b.lastSave = b.clock;
    SaveSystem.save(state);
  }
}

const rand = (a, b) => a + Math.random() * (b - a);
const poisson = (lambda) => {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = Math.random();
  while (p > limit) { k += 1; p *= Math.random(); }
  return k;
};
const pickWeighted = (entries) => {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [key, w] of entries) { roll -= w; if (roll <= 0) return key; }
  return entries.at(-1)?.[0];
};

function processInterval(state) {
  const b = state.business;
  // Obnova poptávky (pokles nasycení) podle rychlosti spotřeby kategorie.
  for (const market of Object.values(b.market)) {
    for (const cat of Object.keys(market)) {
      market[cat] = Math.max(0, market[cat] - (ECONOMIC_CATEGORIES[cat]?.recovery ?? 0.4) / INTERVALS_PER_DAY);
    }
  }
  let sold = false;
  for (const shop of Object.values(b.properties)) {
    if (!shop.open) continue;
    rollDay(shop, b.day);
    const visitors = poisson(customersPerDay(state, shop) / INTERVALS_PER_DAY);
    for (let i = 0; i < visitors; i++) sold = serveCustomer(state, shop) || sold;
  }
  return sold;
}

function rollDay(shop, day) {
  if (shop.stats.today?.day === day) return;
  if (shop.stats.today) shop.stats.days = [...shop.stats.days, shop.stats.today].slice(-14);
  shop.stats.today = newDayStats(day);
}

// Jeden zákazník: typ podle regionu, rozpočet, 1–2 potřeby; z nabídky vybere nejlepší předmět
// pro každou potřebu a rozhodne se podle pravděpodobnosti nákupu. Nikdy nekupuje všechno.
function serveCustomer(state, shop) {
  const region = REGION_ECONOMY[shop.region] ?? REGION_ECONOMY.Greenvale;
  const typeId = pickWeighted(Object.entries(region.mix));
  const type = CUSTOMER_TYPES[typeId];
  let budget = Math.round(rand(type.budget[0], type.budget[1]));
  shop.stats.customers += 1;
  shop.stats.today.customers += 1;

  const weights = needWeights(typeId, region);
  const needs = new Set();
  const needCount = Math.random() < 0.35 ? 2 : 1;
  for (let i = 0; i < needCount && weights.length; i++) needs.add(pickWeighted(weights));

  let bought = false;
  for (const cat of needs) {
    const offers = shop.slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot && economicCategory(slot.itemId) === cat && storageQty(shop, slot.itemId) > 0 && slot.price <= budget);
    if (!offers.length) continue;
    // Zákazník si nabídku vybírá náhodně podle chuti (šance nákupu) a když ho první nepřesvědčí,
    // zváží ještě druhou. Dřív bral vždy jen tu nejlepší – ostatní zboží stejné kategorie se pak
    // neprodalo nikdy (např. Bylinný obklad vedle levnějšího Odpuzovače zvěře).
    let candidates = offers.map((o) => ({ ...o, p: buyChance(state, shop, o.slot.itemId, o.slot.price, typeId) })).filter((o) => o.p > 0);
    let best = null;
    for (let tries = 0; tries < 2 && candidates.length && !best; tries++) {
      const pick = pickWeighted(candidates.map((o) => [o, o.p]));
      if (Math.random() <= pick.p) best = pick;
      candidates = candidates.filter((o) => o !== pick);
    }
    if (!best) continue;
    const maxQty = ECONOMIC_CATEGORIES[cat].maxQty;
    const qty = Math.min(1 + Math.floor(Math.random() * maxQty), storageQty(shop, best.slot.itemId), Math.floor(budget / best.slot.price));
    if (qty < 1) continue;
    sell(state, shop, best.slot, qty, typeId);
    budget -= qty * best.slot.price;
    bought = true;
  }
  return bought;
}

function sell(state, shop, slot, qty, typeId) {
  const { itemId, price } = slot;
  const revenue = qty * price;
  const value = Math.max(1, itemValue(itemId));
  const cat = economicCategory(itemId);
  shop.storage[itemId] -= qty;
  if (shop.storage[itemId] <= 0) delete shop.storage[itemId];
  // Tržba zůstává v pokladně obchodu – hráč ji vybere v obchodě (collectTill).
  shop.till = (Number(shop.till) || 0) + revenue;

  const market = (state.business.market[shop.region] ??= {});
  market[cat] = Math.min(1, (market[cat] ?? 0) + qty / ECONOMIC_CATEGORIES[cat].capacity);

  const s = shop.stats;
  s.revenue += revenue;
  s.trades += 1;
  s.today.revenue += revenue;
  s.today.trades += 1;
  s.today.priceRatioSum += price / value;
  s.today.priceRatioCount += 1;
  const row = (s.items[itemId] ??= { qty: 0, revenue: 0 });
  row.qty += qty;
  row.revenue += revenue;
  s.history = [{ day: currentGameDay(state), time: state.business.clock, customer: typeId, itemId, qty, price }, ...s.history].slice(0, 60);

  // Férová cena a úspěšný obchod mírně zvedají reputaci.
  if (price / value <= 1.1) changeReputation(state, shop, 0.05);
  grantTradeXp(state, [{ id: itemId, qty }], 'shopSell');
  countQuestEvent(state, 'shopSale', qty); // úkol Účetní kniha
  for (const fn of saleListeners) fn({ shop, itemId, qty, revenue, customer: typeId });
}

function changeReputation(state, shop, delta) {
  shop.reputation = Math.min(100, Math.max(0, shop.reputation + delta));
  // Dosažení nového stupně reputace: jednorázově XP (každý stupeň jen jednou za obchod).
  const index = REPUTATION_BANDS.findIndex((band) => band === reputationBand(shop.reputation));
  if (index >= 3 && !shop.repMilestones[index]) {
    shop.repMilestones[index] = 1;
    addDiplomacyXp(state, 50 * (index - 2), 'Nový stupeň reputace');
  }
}

// Konec herního dne: provozní náklady, denní úprava reputace.
function processDay(state, day) {
  for (const shop of Object.values(state.business.properties)) {
    rollDay(shop, day - 1);
    const today = shop.stats.today;
    if (shop.open) {
      const cost = PROPERTY_TYPES[shop.type].dailyCost;
      // Provoz se platí nejdřív z pokladny obchodu, zbytek ze zlata hrdiny.
      if ((Number(shop.till) || 0) + (state.gold ?? 0) >= cost) {
        payFromTill(state, shop, cost);
        shop.stats.costs += cost;
        today.costs += cost;
      } else {
        // Nedostatek peněz: obchod se dočasně zavře, zboží i tržby zůstanou.
        shop.debt += cost;
        shop.open = false;
        shop.closedReason = 'unpaid';
      }
      // Reputace: férové / předražené ceny v nabídce, rozmanitost, úspěšné obchody.
      const offered = shop.slots.filter((s) => s && storageQty(shop, s.itemId) > 0);
      const ratios = offered.map((s) => s.price / Math.max(1, itemValue(s.itemId)));
      const avg = ratios.length ? ratios.reduce((a, r) => a + r, 0) / ratios.length : 1;
      let delta = 0;
      if (avg > 1.3) delta -= 2;
      else if (avg <= 1.1 && today.trades > 0) delta += 1;
      if (new Set(offered.map((s) => economicCategory(s.itemId))).size >= 4) delta += 0.5;
      if (today.trades >= 10) delta += 0.5;
      changeReputation(state, shop, delta);
    }
    rollDay(shop, day);
  }
}

export { PROPERTY_TYPES, PROPERTIES, CUSTOMER_TYPES, REGION_ECONOMY };

// Zisk XP → vyskakovací okno dovednosti (SkillXpEvents).
export function addDiplomacyXp(state, amount, ...rest) {
  const before = skillXpBefore(state, 'diplomacy');
  const result = addDiplomacyXpRaw(state, amount, ...rest);
  reportSkillXp(state, 'diplomacy', before, result?.gained ?? 0);
  return result;
}
