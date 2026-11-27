// ======================================================================
// Inventář hrdiny: state.inventory = { slots: [ { id, qty } | null, … ] }.
// Starší uložené hry měly jen počty (state.inventory.basic_crystal) – převedou se do slotů.
// ======================================================================

import { ITEMS, getItem, SPECIES_DROPS, RENAMED_ITEMS, ITEM_CATEGORIES } from '../data/items.js';
import { countQuestEvent } from './QuestCounters.js';
import { equipItem, unequipItem, normalizeEquipment } from './EquipmentSystem.js';
import { MEATS, MEAT_DROP_CHANCE, WOOD_DROP } from '../data/cooking.js';
import { eatMeal } from './CookingSystem.js';
import { useAlchemyOutside } from './AlchemySystem.js';
import { useMiningMap, openMinerChest } from './MiningSystem.js';
import { useBotanicalNote } from './HerbalismSystem.js';
import { useCraftedItem } from './CraftingSystem.js';
import { useReinforcement } from './SmithingSystem.js';

export const INVENTORY_PAGE_SIZE = 40; // 8 × 5 políček na kartě
export const INVENTORY_PAGES = 1;
export const INVENTORY_SIZE = INVENTORY_PAGE_SIZE * INVENTORY_PAGES;
export const INVENTORY_CHANGED = 'inventory-changed';

// Úkol z dokumentu: hráč dostane 50 lektvarů many (jednou, i do starších uložených her).
const STARTER_MANA_POTIONS = 50;

export function normalizeInventory(state) {
  if (!state) return null;
  const old = state.inventory;
  if (!old || !Array.isArray(old.slots)) {
    const legacy = old && typeof old === 'object' ? old : {};
    state.inventory = { slots: new Array(INVENTORY_SIZE).fill(null) };
    for (const [id, qty] of Object.entries(legacy)) {
      if (ITEMS[id] && Number(qty) > 0) addItem(state, id, Number(qty));
    }
  }
  const slots = state.inventory.slots;
  while (slots.length < INVENTORY_SIZE) slots.push(null);
  // Přejmenované materiály: starý kus → nový předmět.
  for (const slot of slots) if (slot && RENAMED_ITEMS[slot.id]) slot.id = RENAMED_ITEMS[slot.id];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot && (!ITEMS[slot.id] || !(Number(slot.qty) > 0))) slots[i] = null;
  }

  state.flags ??= {};
  if (!state.flags.starterManaPotions) {
    state.flags.starterManaPotions = true;
    addItem(state, 'mana_potion', STARTER_MANA_POTIONS);
  }
  normalizeTools(state);
  return state.inventory;
}

// ------------------------------------------------------------------ nástroje
// Nástroje mají vlastní sloty mimo mřížku inventáře (karta Inventář, sekce Nástroje vpravo):
// state.tools = { [slotId]: itemId | null }. Profese je najdou stejně jako dřív –
// getItemCount počítá i sloty nástrojů. Nový nástroj jde sám do prázdného slotu svého druhu.
const MINING_TOOL_IDS = ['tool_ore_hammer', 'tool_wedge', 'tool_crystal_tongs', 'tool_chisel', 'tool_drill', 'tool_astral_hammer', 'tool_safety_tongs'];
const rankIn = (list) => (item) => list.indexOf(item.id);
const listOf = (flag) => Object.values(ITEMS).filter((it) => it[flag]).map((it) => it.id);
export const TOOL_SLOTS = [
  { id: 'pickaxe', label: 'Krumpáč', accepts: (it) => Boolean(it.pickaxe), rank: (it) => it.pickaxe * 10 - (it.starterTool ? 1 : 0) },
  { id: 'sickle', label: 'Srp', accepts: (it) => Boolean(it.herbTool), rank: (it) => rankIn(listOf('herbTool'))(it) },
  { id: 'rod', label: 'Prut', accepts: (it) => Boolean(it.rod), rank: (it) => rankIn(listOf('rod'))(it) },
  { id: 'tackle', label: 'Háček / naviják', accepts: (it) => Boolean(it.fishingMetal), rank: (it) => rankIn(listOf('fishingMetal'))(it) },
  ...MINING_TOOL_IDS.map((id) => ({ id, label: ITEMS[id]?.name ?? id, accepts: (it) => it.id === id, rank: () => 0 })),
  { id: 'cr_f15', label: ITEMS.cr_f15?.name ?? 'Koželužské nože', accepts: (it) => it.id === 'cr_f15', rank: () => 0 },
  { id: 'cr_f14', label: ITEMS.cr_f14?.name ?? 'Šperkařská lupa', accepts: (it) => it.id === 'cr_f14', rank: () => 0 }
];
export const toolSlotFor = (item) => (item ? TOOL_SLOTS.find((s) => s.accepts(item)) ?? null : null);
export const isTool = (item) => Boolean(toolSlotFor(item));

// Prázdné sloty nástrojů se doplní nejlepším nástrojem daného druhu z inventáře.
export function normalizeTools(state) {
  state.tools ??= {};
  for (const slot of TOOL_SLOTS) {
    const current = state.tools[slot.id];
    if (current && !ITEMS[current]) state.tools[slot.id] = null;
    if (state.tools[slot.id]) continue;
    let best = null;
    (state.inventory?.slots ?? []).forEach((entry, index) => {
      const item = getItem(entry?.id);
      if (!item || !slot.accepts(item)) return;
      if (!best || slot.rank(item) > slot.rank(best.item)) best = { item, index };
    });
    if (best) {
      state.tools[slot.id] = best.item.id;
      const entry = state.inventory.slots[best.index];
      entry.qty -= 1;
      if (entry.qty <= 0) state.inventory.slots[best.index] = null;
    }
  }
  return state.tools;
}

// Nástroj z políčka inventáře do jeho slotu (obsazený slot si s ním vymění místo).
export function equipTool(state, index) {
  const entry = state.inventory.slots[index];
  const item = getItem(entry?.id);
  const slot = toolSlotFor(item);
  if (!slot) return { ok: false, message: 'Tohle není nástroj.' };
  state.tools ??= {};
  const previous = state.tools[slot.id];
  state.tools[slot.id] = item.id;
  entry.qty -= 1;
  if (entry.qty <= 0) state.inventory.slots[index] = null;
  if (previous) addItem(state, previous, 1, { toTools: false });
  return { ok: true, message: `Nástroj ${slot.label}: ${item.name}.` };
}

// Nástroj ze slotu zpět do inventáře.
export function unequipTool(state, slotId) {
  const id = state.tools?.[slotId];
  if (!id) return { ok: false, message: 'Slot je prázdný.' };
  if (!state.inventory.slots.some((s) => !s)) return { ok: false, message: 'Inventář je plný.' };
  state.tools[slotId] = null;
  addItem(state, id, 1, { toTools: false });
  return { ok: true, message: `${getItem(id)?.name ?? id} je zpět v inventáři.` };
}

const toolCount = (state, id) => Object.values(state?.tools ?? {}).filter((t) => t === id).length;

const slotsOf = (state) => (Array.isArray(state.inventory?.slots) ? state.inventory.slots : normalizeInventory(state).slots);

export function getItemCount(state, id) {
  return slotsOf(state).reduce((sum, slot) => sum + (slot?.id === id ? slot.qty : 0), 0) + toolCount(state, id);
}

// Přidá kusy: nástroj nejdřív do prázdného slotu nástrojů, pak do neplných hromádek a do
// prázdných políček. Vrací, co se nevešlo.
export function addItem(state, id, qty = 1, { toTools = true } = {}) {
  const item = getItem(id);
  if (!item) return qty;
  const slots = state.inventory.slots;
  let left = qty;
  const toolSlot = toTools && state.tools ? toolSlotFor(item) : null;
  if (toolSlot && !state.tools[toolSlot.id] && left > 0) {
    state.tools[toolSlot.id] = id;
    left -= 1;
  }
  for (const slot of slots) {
    if (left <= 0) break;
    if (slot?.id === id && slot.qty < item.stack) {
      const add = Math.min(left, item.stack - slot.qty);
      slot.qty += add;
      left -= add;
    }
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (slots[i]) continue;
    const add = Math.min(left, item.stack);
    slots[i] = { id, qty: add };
    left -= add;
  }
  return left;
}

// Odebere kusy odkudkoli (od posledních hromádek). Vrací true, když jich bylo dost.
// Seřadí inventář v pořadí filtrů (Zbroj, Materiály, Potiony, Doplňky, Klíče, Ostatní),
// v kategorii od nejvzácnějšího a pak podle názvu. Neúplné hromádky stejného předmětu
// se slijí. Prázdná políčka zůstanou na konci, počet políček se nemění.
const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
export function sortInventory(state) {
  const slots = state.inventory.slots;
  const totals = new Map();
  for (const slot of slots) if (slot) totals.set(slot.id, (totals.get(slot.id) ?? 0) + slot.qty);
  const categoryIndex = (item) => {
    const i = ITEM_CATEGORIES.findIndex((c) => c.id === item?.category);
    return i < 0 ? ITEM_CATEGORIES.length : i;
  };
  const rarityIndex = (item) => {
    const i = RARITY_ORDER.indexOf(item?.rarity ?? 'common');
    return i < 0 ? RARITY_ORDER.length : i;
  };
  const ids = [...totals.keys()].sort((a, b) => {
    const ia = getItem(a);
    const ib = getItem(b);
    return categoryIndex(ia) - categoryIndex(ib) || rarityIndex(ia) - rarityIndex(ib)
      || String(ia?.name ?? a).localeCompare(String(ib?.name ?? b), 'cs');
  });
  const sorted = [];
  for (const id of ids) {
    const stack = Math.max(1, getItem(id)?.stack ?? 1);
    let left = totals.get(id);
    while (left > 0) {
      const qty = Math.min(stack, left);
      sorted.push({ id, qty });
      left -= qty;
    }
  }
  for (let i = 0; i < slots.length; i++) slots[i] = sorted[i] ?? null;
  return sorted.length;
}

export function removeItem(state, id, qty = 1) {
  if (getItemCount(state, id) < qty) return false;
  const slots = slotsOf(state);
  let left = qty;
  for (let i = slots.length - 1; i >= 0 && left > 0; i--) {
    const slot = slots[i];
    if (slot?.id !== id) continue;
    const take = Math.min(left, slot.qty);
    slot.qty -= take;
    left -= take;
    if (slot.qty <= 0) slots[i] = null;
  }
  // Zbytek ze slotů nástrojů (např. výroba, která nástroj spotřebuje).
  for (const [slotId, toolId] of Object.entries(state.tools ?? {})) {
    if (left <= 0) break;
    if (toolId === id) { state.tools[slotId] = null; left -= 1; }
  }
  return true;
}

// Přesun: do prázdného políčka, sloučení stejných předmětů, jinak prohození.
export function moveSlot(state, from, to) {
  const slots = slotsOf(state);
  if (from === to || !slots[from]) return { ok: false, reason: 'Není co přesunout.' };
  const a = slots[from];
  const b = slots[to];
  if (b && b.id === a.id) {
    const stack = getItem(a.id).stack;
    const add = Math.min(a.qty, stack - b.qty);
    if (add <= 0) {
      slots[from] = b;
      slots[to] = a;
    } else {
      b.qty += add;
      a.qty -= add;
      if (a.qty <= 0) slots[from] = null;
    }
  } else {
    slots[from] = b ?? null;
    slots[to] = a;
  }
  return { ok: true };
}

// Rozdělí hromádku: amount kusů do prvního prázdného políčka.
export function splitSlot(state, index, amount) {
  const slots = slotsOf(state);
  const slot = slots[index];
  if (!slot || slot.qty < 2) return { ok: false, reason: 'Hromádku s jedním kusem nejde rozdělit.' };
  const count = Math.floor(amount);
  if (count < 1 || count >= slot.qty) return { ok: false, reason: 'Zvol počet od 1 do ' + (slot.qty - 1) + '.' };
  const empty = slots.findIndex((s) => !s);
  if (empty < 0) return { ok: false, reason: 'V inventáři není volné políčko.' };
  slot.qty -= count;
  slots[empty] = { id: slot.id, qty: count };
  return { ok: true, index: empty };
}

// Rozdělí hromádku do konkrétního políčka (tažení se Shiftem): do prázdného políčka,
// nebo do hromádky stejného předmětu (jen kolik se vejde).
export function splitToSlot(state, from, to, amount) {
  const slots = slotsOf(state);
  const source = slots[from];
  if (!source || from === to) return { ok: false, reason: 'Není co rozdělit.' };
  if (source.qty < 2) return { ok: false, reason: 'Hromádku s jedním kusem nejde rozdělit.' };
  const item = getItem(source.id);
  const target = slots[to];
  let count = Math.max(1, Math.min(Math.floor(amount), source.qty - 1));
  if (!target) {
    slots[to] = { id: source.id, qty: count };
  } else if (target.id === source.id) {
    count = Math.min(count, item.stack - target.qty);
    if (count <= 0) return { ok: false, reason: 'Cílová hromádka je plná.' };
    target.qty += count;
  } else {
    return { ok: false, reason: 'Rozdělit jde jen do prázdného políčka nebo na stejný předmět.' };
  }
  source.qty -= count;
  return { ok: true, count };
}

// Sundá výbavu do inventáře: do zvoleného prázdného políčka, jinak do prvního volného.
export function unequipToSlot(state, slotId, toIndex = null, events = null) {
  normalizeEquipment(state);
  const equipped = state.equipment?.[slotId];
  if (!equipped?.id || !ITEMS[equipped.id]) return { ok: false, message: 'Slot je prázdný.' };
  const slots = slotsOf(state);
  const target = Number.isInteger(toIndex) && !slots[toIndex] ? toIndex : slots.findIndex((s) => !s);
  if (target < 0) return { ok: false, message: 'V inventáři není volné políčko.' };
  unequipItem(state, slotId, events);
  slots[target] = { id: equipped.id, qty: 1 };
  return { ok: true, index: target, message: `Sundáno: ${getItem(equipped.id).name}.` };
}

export function dropSlot(state, index) {
  const slots = slotsOf(state);
  if (!slots[index]) return { ok: false, reason: 'Políčko je prázdné.' };
  slots[index] = null;
  return { ok: true };
}

// Drop poraženého monstra: 1. materiál 70 %, 2. materiál 35 % (po 1 kusu).
export const DROP_CHANCES = [0.7, 0.35];
export function rollDrops(speciesId, random = Math.random) {
  const list = SPECIES_DROPS[speciesId] ?? [];
  const drops = list.filter((_, i) => random() < (DROP_CHANCES[i] ?? 0.2)).map((id) => ({ id, qty: 1 }));
  // Vaření: maso z vhodných tvorů (50 %) a dřevo z dřevěných monster (60 %).
  const meat = MEATS.find((m) => m.from.includes(speciesId));
  if (meat && random() < MEAT_DROP_CHANCE) drops.push({ id: meat.id, qty: 1 });
  if (WOOD_DROP.from.includes(speciesId) && random() < WOOD_DROP.chance) drops.push({ id: WOOD_DROP.id, qty: 1 });
  return drops;
}

export function canUse(item) {
  return Boolean(item?.use);
}

export function canEquip(item) {
  return Boolean(item?.slot);
}

// Použije jeden kus z políčka. Vrací { ok, message }.
export function useSlot(state, index) {
  const slots = slotsOf(state);
  const slot = slots[index];
  const item = getItem(slot?.id);
  if (!item?.use) return { ok: false, message: 'Tento předmět nejde použít.' };

  if (item.use.type === 'healMonster' || item.use.type === 'food') {
    const heal = item.use.type === 'food' ? item.use.heal : item.use.amount;
    const mana = item.use.type === 'food' ? item.use.mana : 0;
    // Nejvíc zraněné monstrum v partě (podle chybějících HP).
    const target = (state.party ?? [])
      .filter((m) => m.stats && m.currentHp < m.stats.vitality)
      .sort((a, b) => (b.stats.vitality - b.currentHp) - (a.stats.vitality - a.currentHp))[0];
    const maxMp = Number(state.maxMp) || 0;
    const mp = Number(state.mp) || 0;
    if (!target && (!mana || mp >= maxMp)) return { ok: false, message: 'Monstra v partě jsou zdravá.' };
    const parts = [];
    if (target) {
      const gained = Math.min(heal, target.stats.vitality - target.currentHp);
      target.currentHp += gained;
      parts.push(`${target.name} +${gained} HP`);
    }
    if (mana && mp < maxMp) {
      const gainedMp = Math.min(mana, maxMp - mp);
      state.mp = mp + gainedMp;
      parts.push(`+${gainedMp} many`);
    }
    slot.qty -= 1;
    if (slot.qty <= 0) slots[index] = null;
    return { ok: true, message: `${item.name}: ${parts.join(', ')}.` };
  }

  if (item.use.type === 'alchemy') {
    const result = useAlchemyOutside(state, item.use.recipe);
    if (!result.ok) return result;
    slot.qty -= 1;
    if (slot.qty <= 0) slots[index] = null;
    return result;
  }

  if (item.use.type === 'meal') {
    const result = eatMeal(state, item.use.recipe);
    if (!result.ok) return result;
    slot.qty -= 1;
    if (slot.qty <= 0) slots[index] = null;
    return { ok: true, message: result.replaced ? `${result.message} (nahrazuje: ${result.replaced})` : result.message };
  }

  // Kovářství: výztuha výbavy na počet soubojů (jedna aktivní).
  if (item.use.type === 'reinforce') {
    const result = useReinforcement(state, item.use.recipe);
    if (!result.ok) return result;
    slot.qty -= 1;
    if (slot.qty <= 0) slots[index] = null;
    return result;
  }

  // Těžba: Starodávná důlní mapa a Zapomenutá truhla horníka.
  // Řemeslnictví: brašny, cestovní vybavení, výcvikové závaží, zrcadlo duše.
  if (item.use.type === 'craft') {
    const result = useCraftedItem(state, item.use.recipe);
    if (!result.ok) return result;
    slot.qty -= 1;
    if (slot.qty <= 0) slots[index] = null;
    return result;
  }

  if (item.use.type === 'botanicalNote') {
    // Sběr bylin: Botanický zápis odhalí Skryté lesní naleziště.
    const result = useBotanicalNote(state);
    if (!result.ok) return result;
    slot.qty -= 1;
    if (slot.qty <= 0) slots[index] = null;
    return result;
  }

  if (item.use.type === 'miningMap' || item.use.type === 'minerChest') {
    const result = item.use.type === 'miningMap' ? useMiningMap(state) : openMinerChest(state);
    if (!result.ok) return result;
    slot.qty -= 1;
    if (slot.qty <= 0) slots[index] = null;
    return result;
  }

  if (item.use.type === 'restoreMana') {
    const max = Number(state.maxMp) || 0;
    const mp = Number(state.mp) || 0;
    if (mp >= max) return { ok: false, message: 'Mana je plná.' };
    const gained = Math.min(item.use.amount, max - mp);
    state.mp = mp + gained;
    slot.qty -= 1;
    if (slot.qty <= 0) slots[index] = null;
    return { ok: true, message: `${item.name}: +${gained} many (${state.mp}/${max}).` };
  }
  return { ok: false, message: 'Účinek tohoto předmětu zatím není připravený.' };
}

// Vybaví předmět z políčka; dosavadní výbava se vrátí na jeho místo.
export function equipSlot(state, index, events = null) {
  const slots = slotsOf(state);
  const slot = slots[index];
  const item = getItem(slot?.id);
  if (!item?.slot) return { ok: false, message: 'Tento předmět nejde vybavit.' };
  normalizeEquipment(state);
  const previous = equipItem(state, item.slot, { id: item.id, name: item.name, rarity: item.rarity, description: item.description }, events);
  slot.qty -= 1;
  if (slot.qty <= 0) slots[index] = null;
  if (previous?.id && ITEMS[previous.id]) addItem(state, previous.id, 1);
  countQuestEvent(state, 'equip'); // úkol Do zbroje
  return { ok: true, message: `Vybaveno: ${item.name}.` };
}
