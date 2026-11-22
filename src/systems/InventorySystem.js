// ======================================================================
// Inventář hrdiny: state.inventory = { slots: [ { id, qty } | null, … ] }.
// Starší uložené hry měly jen počty (state.inventory.basic_crystal) – převedou se do slotů.
// ======================================================================

import { ITEMS, getItem, SPECIES_DROPS } from '../data/items.js';
import { equipItem, normalizeEquipment } from './EquipmentSystem.js';

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
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot && (!ITEMS[slot.id] || !(Number(slot.qty) > 0))) slots[i] = null;
  }

  state.flags ??= {};
  if (!state.flags.starterManaPotions) {
    state.flags.starterManaPotions = true;
    addItem(state, 'mana_potion', STARTER_MANA_POTIONS);
  }
  return state.inventory;
}

const slotsOf = (state) => (Array.isArray(state.inventory?.slots) ? state.inventory.slots : normalizeInventory(state).slots);

export function getItemCount(state, id) {
  return slotsOf(state).reduce((sum, slot) => sum + (slot?.id === id ? slot.qty : 0), 0);
}

// Přidá kusy: nejdřív do neplných hromádek, pak do prázdných políček. Vrací, co se nevešlo.
export function addItem(state, id, qty = 1) {
  const item = getItem(id);
  if (!item) return qty;
  const slots = state.inventory.slots;
  let left = qty;
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
  return list.filter((_, i) => random() < (DROP_CHANCES[i] ?? 0.2)).map((id) => ({ id, qty: 1 }));
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
  return { ok: true, message: `Vybaveno: ${item.name}.` };
}
