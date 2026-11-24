// ======================================================================
// Řemeslnictví: úroveň a zkušenosti, výroba na pracovišti (koželužský stůl, šperkařský
// stůl, Soul Crystal Workbench), nástroje (lupa, nože), použití brašen a cestovního vybavení.
//
// Uložení:
//   state.professions.crafting = { level, exp, next }       (karta hrdiny)
//   state.crafting = { learned: { id: true }, made: { id: počet } }
// Výbava z Řemeslnictví působí stejně jako výbava z Kovářství (velitelský bonus,
// Řemeslník ×1,2) – viz SmithingSystem.gearBonus.
// ======================================================================

import { ALL_CRAFTING, CRAFTING_BY_ID, craftingOutputId, craftingXp, xpToNextCraftingLevel } from '../data/crafting.js';
import { getItemCount, removeItem, addItem, INVENTORY_PAGE_SIZE } from './InventorySystem.js';
import { professionXpMultiplier } from './AlchemySystem.js';
import skillRows from '../data/skills.json';

const MAX_LEVEL = 100;
const MAX_FREE_TRAINING = 510;

// Kvůli testování se znají všechny recepty (řemeslnice a úkoly zatím nejsou).
export const ALL_CRAFTING_KNOWN_FOR_TESTING = true;

export function normalizeCrafting(state) {
  state.professions ??= {};
  const prof = state.professions.crafting ?? {};
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(prof.level) || 1)));
  state.professions.crafting = { ...prof, level, exp: Math.max(0, Math.floor(Number(prof.exp) || 0)), next: xpToNextCraftingLevel(level) };
  delete state.professions.crafting.locked;
  state.crafting ??= {};
  state.crafting.learned ??= {};
  state.crafting.made ??= {};
  return state.crafting;
}

export const craftingLevel = (state) => normalizeCrafting(state) && state.professions.crafting.level;
export const isCraftingKnown = (state, recipe) =>
  ALL_CRAFTING_KNOWN_FOR_TESTING || recipe.origin === 'base' || Boolean(state.crafting?.learned?.[recipe.id]);
// Pracoviště nejsou stupně: recept jde vyrobit jen na svém pracovišti.
export const craftingStationOk = (recipe, station) => recipe.station === station;

const optionsOf = (key) => key.split('|');
export const craftingIngredientCount = (state, key) => optionsOf(key).reduce((sum, id) => sum + getItemCount(state, id), 0);

export function craftingMaxBatches(state, recipe) {
  let max = Infinity;
  for (const [key, qty] of Object.entries(recipe.ingredients)) max = Math.min(max, Math.floor(craftingIngredientCount(state, key) / qty));
  return Number.isFinite(max) ? max : 0;
}

export function canCraft(state, recipe, station, times = 1) {
  if (!isCraftingKnown(state, recipe)) return { ok: false, reason: 'Tento recept zatím neznáš.' };
  if (craftingLevel(state) < recipe.level) return { ok: false, reason: `Potřebuješ Řemeslnictví na úrovni ${recipe.level}.` };
  if (!craftingStationOk(recipe, station)) return { ok: false, reason: 'Na tomto pracovišti tento recept vyrobit nejde.' };
  if (recipe.story && getItemCount(state, recipe.story.item) < 1) return { ok: false, reason: recipe.story.text };
  if (craftingMaxBatches(state, recipe) < times) return { ok: false, reason: 'Chybí suroviny.' };
  return { ok: true, reason: '' };
}

// Kusů z jedné výroby (nástroje: Koželužské nože u kůže, Šperkařská lupa u broušení).
function batchQty(state, recipe, random) {
  let qty = recipe.qty;
  if (recipe.id === 'cr_tanned_leather' && getItemCount(state, 'cr_f15') > 0) qty += 1;
  if (recipe.id.startsWith('cr_cut_') && getItemCount(state, 'cr_f14') > 0 && random() < 0.25) qty += 1;
  return qty;
}

export function craftItem(state, recipe, station, times = 1, random = Math.random) {
  const check = canCraft(state, recipe, station, times);
  if (!check.ok) return { ok: false, message: check.reason };
  for (const [key, qty] of Object.entries(recipe.ingredients)) {
    let left = qty * times;
    for (const id of optionsOf(key)) {
      const take = Math.min(left, getItemCount(state, id));
      if (take > 0) removeItem(state, id, take);
      left -= take;
    }
  }
  let made = 0;
  for (let i = 0; i < times; i++) made += batchQty(state, recipe, random);
  const leftOver = addItem(state, craftingOutputId(recipe), made);
  let xp = 0;
  for (let i = 0; i < times; i++) {
    const first = !(state.crafting.made[recipe.id] > 0);
    let gain = craftingXp(recipe) * (first ? 2 : 1);
    if (craftingLevel(state) - recipe.level >= 20) gain *= 0.5;
    xp += Math.max(1, Math.round(gain * professionXpMultiplier(state)));
    state.crafting.made[recipe.id] = (state.crafting.made[recipe.id] ?? 0) + 1;
  }
  const levelsGained = addCraftingXp(state, xp);
  return {
    ok: true, made: made - leftOver, xp, levelsGained,
    message: `Vyrobeno: ${recipe.name} ×${made - leftOver} (+${xp} XP)${leftOver ? ` – ${leftOver} ks se nevešlo do inventáře` : ''}.`
  };
}

export function addCraftingXp(state, amount) {
  const prof = state.professions.crafting;
  prof.exp += amount;
  let gained = 0;
  while (prof.level < MAX_LEVEL && prof.exp >= xpToNextCraftingLevel(prof.level)) {
    prof.exp -= xpToNextCraftingLevel(prof.level);
    prof.level += 1;
    gained += 1;
  }
  if (prof.level >= MAX_LEVEL) prof.exp = 0;
  prof.next = xpToNextCraftingLevel(prof.level);
  return gained;
}

// ---------------------------------------------------------- použití výrobků

// Použití mimo souboj (brašny, cestovní vybavení, závaží, zrcadlo). Vrací { ok, message }.
export function useCraftedItem(state, recipeId, now = Date.now()) {
  const recipe = CRAFTING_BY_ID[recipeId];
  const e = recipe?.effect;
  if (!e) return { ok: false, message: 'Tento předmět nejde použít.' };

  if (e.bag) {
    const slots = state.inventory.slots;
    const pages = Math.ceil(slots.length / INVENTORY_PAGE_SIZE);
    if (pages >= e.bag) return { ok: false, message: `Inventář už má ${pages} stránek – ${recipe.name} ho nezvětší.` };
    while (slots.length < e.bag * INVENTORY_PAGE_SIZE) slots.push(null);
    return { ok: true, message: `${recipe.name}: inventář má teď ${e.bag} stránek.` };
  }

  if (e.travel) {
    state.alchemyEffects ??= {};
    for (const [key, value] of Object.entries(e.explore)) {
      state.alchemyEffects[key] = e.minutes
        ? { value, until: now + e.minutes * 60000, name: recipe.name }
        : { value, battlesLeft: e.battles, name: recipe.name };
    }
    return { ok: true, message: `${recipe.name}: účinek platí ${e.minutes ? `${e.minutes} min` : `${e.battles} ${e.battles === 1 ? 'souboj' : 'soubojů'}`}.` };
  }

  if (e.use === 'training') {
    const party = (state.party ?? []).filter((m) => (Number(m.unspentTrainingPoints) || 0) < MAX_FREE_TRAINING);
    if (!party.length) return { ok: false, message: 'Monstra v partě mají plno volných tréninkových bodů.' };
    const target = party.sort((a, b) => (Number(a.unspentTrainingPoints) || 0) - (Number(b.unspentTrainingPoints) || 0))[0];
    target.unspentTrainingPoints = Math.min(MAX_FREE_TRAINING, (Number(target.unspentTrainingPoints) || 0) + 3);
    return { ok: true, message: `${target.name}: +3 tréninkové body (volné ${target.unspentTrainingPoints}).` };
  }

  if (e.use === 'skills') {
    let restored = 0;
    for (const monster of state.party ?? []) {
      monster.skillUses ??= {};
      for (const skillId of monster.skills ?? []) {
        const skill = skillRows.find((s) => s.id === skillId);
        if (skill && monster.skillUses[skillId] !== skill.maxUses) {
          monster.skillUses[skillId] = skill.maxUses;
          restored += 1;
        }
      }
    }
    if (!restored) return { ok: false, message: 'Všechny techniky v partě mají plný počet použití.' };
    return { ok: true, message: `${recipe.name}: obnovena použití technik (${restored}).` };
  }

  return { ok: false, message: 'Tento předmět se nasazuje jako výbava nebo leží v inventáři jako nástroj.' };
}

export const allCraftingRecipes = () => ALL_CRAFTING;
