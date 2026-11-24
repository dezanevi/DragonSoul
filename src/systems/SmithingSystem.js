// ======================================================================
// Kovářství: úroveň a zkušenosti, výroba u výhně, výztuhy a velitelský bonus výbavy.
//
// Uložení:
//   state.professions.smithing = { level, exp, next }       (karta hrdiny)
//   state.smithing = { learned: { id: true }, made: { id: počet } }
//   state.reinforcement = { recipe, name, battlesLeft, bonus, resist, elementDamage }  – jedna výztuha
//
// Velitelský bonus: nasazená výbava hrdiny (state.equipment) + aktivní výztuha dávají
// procenta všem monstrům v partě. Strop +50 % na jednu hodnotu; Řemeslník ×1,2.
// ======================================================================

import { ALL_SMITHING, SMITHING_BY_ID, smithingOutputId, smithingXp } from '../data/smithing.js';
import { xpToNextFishingLevel as xpToNextLevel } from '../data/fishing.js';
import { getItem } from '../data/items.js';
import { getItemCount, removeItem, addItem } from './InventorySystem.js';
import { professionXpMultiplier } from './AlchemySystem.js';

const MAX_LEVEL = 100;
export const GEAR_STAT_CAP = 50;
const CRAFTSMAN_MULTIPLIER = 1.2;

// Kvůli testování se znají všechny recepty (kováři a úkoly zatím nejsou).
export const ALL_SMITHING_KNOWN_FOR_TESTING = true;

export function normalizeSmithing(state) {
  state.professions ??= {};
  const prof = state.professions.smithing ?? {};
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(prof.level) || 1)));
  state.professions.smithing = { ...prof, level, exp: Math.max(0, Math.floor(Number(prof.exp) || 0)), next: xpToNextLevel(level) };
  delete state.professions.smithing.locked;
  state.smithing ??= {};
  state.smithing.learned ??= {};
  state.smithing.made ??= {};
  if (state.reinforcement && !(state.reinforcement.battlesLeft > 0)) state.reinforcement = null;
  return state.smithing;
}

export const smithingLevel = (state) => normalizeSmithing(state) && state.professions.smithing.level;
export const isSmithingKnown = (state, recipe) =>
  ALL_SMITHING_KNOWN_FOR_TESTING || recipe.origin === 'base' || Boolean(state.smithing?.learned?.[recipe.id]);

const optionsOf = (key) => key.split('|');
export const smithingIngredientCount = (state, key) => optionsOf(key).reduce((sum, id) => sum + getItemCount(state, id), 0);

export function smithingMaxBatches(state, recipe) {
  let max = Infinity;
  for (const [key, qty] of Object.entries(recipe.ingredients)) max = Math.min(max, Math.floor(smithingIngredientCount(state, key) / qty));
  return Number.isFinite(max) ? max : 0;
}

export function canForge(state, recipe, stationRank, times = 1) {
  if (!isSmithingKnown(state, recipe)) return { ok: false, reason: 'Tento recept zatím neznáš.' };
  if (smithingLevel(state) < recipe.level) return { ok: false, reason: `Potřebuješ Kovářství na úrovni ${recipe.level}.` };
  if (stationRank < recipe.station) return { ok: false, reason: 'Na tomto pracovišti tento recept vyrobit nejde.' };
  if (smithingMaxBatches(state, recipe) < times) return { ok: false, reason: 'Chybí suroviny.' };
  return { ok: true, reason: '' };
}

export function forge(state, recipe, stationRank, times = 1) {
  const check = canForge(state, recipe, stationRank, times);
  if (!check.ok) return { ok: false, message: check.reason };
  for (const [key, qty] of Object.entries(recipe.ingredients)) {
    let left = qty * times;
    for (const id of optionsOf(key)) {
      const take = Math.min(left, getItemCount(state, id));
      if (take > 0) removeItem(state, id, take);
      left -= take;
    }
  }
  const made = recipe.qty * times;
  const leftOver = addItem(state, smithingOutputId(recipe), made);
  let xp = 0;
  for (let i = 0; i < times; i++) {
    const first = !(state.smithing.made[recipe.id] > 0);
    let gain = smithingXp(recipe) * (first ? 2 : 1);
    if (smithingLevel(state) - recipe.level >= 20) gain *= 0.5;
    xp += Math.max(1, Math.round(gain * professionXpMultiplier(state)));
    state.smithing.made[recipe.id] = (state.smithing.made[recipe.id] ?? 0) + 1;
  }
  const levelsGained = addSmithingXp(state, xp);
  return {
    ok: true, made: made - leftOver, xp, levelsGained,
    message: `Vykováno: ${recipe.name} ×${made - leftOver} (+${xp} XP)${leftOver ? ` – ${leftOver} ks se nevešlo do inventáře` : ''}.`
  };
}

export function addSmithingXp(state, amount) {
  const prof = state.professions.smithing;
  prof.exp += amount;
  let gained = 0;
  while (prof.level < MAX_LEVEL && prof.exp >= xpToNextLevel(prof.level)) {
    prof.exp -= xpToNextLevel(prof.level);
    prof.level += 1;
    gained += 1;
  }
  if (prof.level >= MAX_LEVEL) prof.exp = 0;
  prof.next = xpToNextLevel(prof.level);
  return gained;
}

// ---------------------------------------------------------- výztuhy

export const activeReinforcement = (state) => (state.reinforcement?.battlesLeft > 0 ? state.reinforcement : null);

// Použití výztuhy z inventáře. Vrací { ok, message, replaced }.
export function useReinforcement(state, recipeId) {
  const recipe = SMITHING_BY_ID[recipeId];
  const e = recipe?.effect;
  if (!e?.reinforce) return { ok: false, message: 'Tento předmět nejde použít.' };
  const replaced = activeReinforcement(state)?.name ?? null;
  state.reinforcement = {
    recipe: recipe.id, name: recipe.name, battlesLeft: e.battles,
    bonus: { ...(e.bonus ?? {}) }, resist: { ...(e.resist ?? {}) }, elementDamage: { ...(e.elementDamage ?? {}) }
  };
  return { ok: true, replaced, message: `${recipe.name}: výztuha platí ${e.battles} soubojů${replaced ? ` (nahrazuje: ${replaced})` : ''}.` };
}

// Po každém souboji ubude jeden souboj výztuhy.
export function applyReinforcementAfterBattle(state) {
  const r = activeReinforcement(state);
  if (!r) return null;
  r.battlesLeft -= 1;
  if (r.battlesLeft <= 0) state.reinforcement = null;
  return r;
}

// ---------------------------------------------------------- velitelský bonus výbavy

function gearSources(state) {
  const sources = [];
  for (const equipped of Object.values(state?.equipment ?? {})) {
    const item = getItem(equipped?.id);
    if (item?.gear) sources.push({ gear: item.gear, smithed: Boolean(item.smithed || item.crafted) });
  }
  const r = activeReinforcement(state);
  if (r) sources.push({ gear: r, smithed: true });
  return sources;
}

const isCraftsman = (state) => state?.talentProgress?.specialization === 'crafting';

function sumGear(state, field, key) {
  let total = 0;
  const mult = isCraftsman(state) ? CRAFTSMAN_MULTIPLIER : 1;
  for (const { gear, smithed } of gearSources(state)) {
    const value = Number(gear?.[field]?.[key]) || 0;
    total += smithed ? value * mult : value;
  }
  return Math.min(GEAR_STAT_CAP, Math.round(total * 10) / 10);
}

// Bonus statistiky v % (attack, aether, defense, resolve, speed, maxHp).
export const gearBonus = (state, stat) => sumGear(state, 'bonus', stat);
// Snížení poškození od elementu v %.
export const gearResist = (state, element) => sumGear(state, 'resist', element);
// Zvýšení poškození útoků daného elementu v %.
export const gearElementDamage = (state, element) => sumGear(state, 'elementDamage', element);

// Souhrn pro kartu hrdiny a souboj.
export function gearSummary(state) {
  const stats = ['attack', 'aether', 'defense', 'resolve', 'speed', 'maxHp'];
  const elements = ['fire', 'water', 'earth', 'air', 'verdant', 'dark', 'light'];
  return {
    bonus: Object.fromEntries(stats.map((s) => [s, gearBonus(state, s)]).filter(([, v]) => v)),
    resist: Object.fromEntries(elements.map((e) => [e, gearResist(state, e)]).filter(([, v]) => v)),
    elementDamage: Object.fromEntries(elements.map((e) => [e, gearElementDamage(state, e)]).filter(([, v]) => v))
  };
}

export const allSmithingRecipes = () => ALL_SMITHING;
