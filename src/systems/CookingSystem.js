// ======================================================================
// Vaření: úroveň a zkušenosti, známé recepty, vaření u pracoviště a účinky jídla.
//
// Uložení:
//   state.professions.cooking = { level, exp, next }        (karta hrdiny)
//   state.cooking = { learned: { id: true }, cooked: { id: počet } }
//   state.meal = { recipe, name, battlesLeft, regen, manaRegen, buffs, travelUntil, move, explore }
//     – nejvýš jeden pokrm s trvajícím účinkem („Najedený“).
// ======================================================================

import {
  ALL_COOKING, COOKING_BY_ID, outputItemId, cookingXp, hasLastingEffect
} from '../data/cooking.js';
import { xpToNextFishingLevel as xpToNextLevel } from '../data/fishing.js';
import { skillXpBefore, reportSkillXp } from './SkillXpEvents.js';
import { countQuestEvent } from './QuestCounters.js';
import { getTalentBonuses, materialSaving } from './TalentSystem.js';
import { getItemCount, removeItem, addItem } from './InventorySystem.js';
import { professionXpMultiplier } from './AlchemySystem.js';

const MAX_LEVEL = 100;

// Kvůli testování se znají všechny recepty (kuchaři, obchodníci a úkoly zatím nejsou).
export const ALL_RECIPES_KNOWN_FOR_TESTING = true;

export function normalizeCooking(state) {
  state.professions ??= {};
  const prof = state.professions.cooking ?? {};
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(prof.level) || 1)));
  state.professions.cooking = { ...prof, level, exp: Math.max(0, Math.floor(Number(prof.exp) || 0)), next: xpToNextLevel(level) };
  state.cooking ??= {};
  state.cooking.learned ??= {};
  state.cooking.cooked ??= {};
  return state.cooking;
}

export const cookingLevel = (state) => normalizeCooking(state) && state.professions.cooking.level;

export function isKnown(state, recipe) {
  return ALL_RECIPES_KNOWN_FOR_TESTING || recipe.origin === 'base' || Boolean(state.cooking?.learned?.[recipe.id]);
}

// Ingredience „a|b“ = libovolná kombinace uvedených předmětů.
const optionsOf = (key) => key.split('|');
export function ingredientCount(state, key) {
  return optionsOf(key).reduce((sum, id) => sum + getItemCount(state, id), 0);
}

// Kolikrát jde recept uvařit (0 = chybí suroviny).
export function maxBatches(state, recipe) {
  let max = Infinity;
  for (const [key, qty] of Object.entries(recipe.ingredients)) max = Math.min(max, Math.floor(ingredientCount(state, key) / qty));
  return Number.isFinite(max) ? max : 0;
}

// { ok, reason } – úroveň, pracoviště, znalost receptu, suroviny.
export function canCook(state, recipe, stationRank, times = 1) {
  if (!isKnown(state, recipe)) return { ok: false, reason: 'Tento recept zatím neznáš.' };
  if (cookingLevel(state) < recipe.level) return { ok: false, reason: `Potřebuješ Vaření na úrovni ${recipe.level}.` };
  if (stationRank < recipe.station) return { ok: false, reason: 'Na tomto pracovišti tento recept uvařit nejde.' };
  if (maxBatches(state, recipe) < times) return { ok: false, reason: 'Chybí suroviny.' };
  return { ok: true, reason: '' };
}

// Uvaří recept times-krát. Hotové jídlo jde rovnou do inventáře.
export function cook(state, recipe, stationRank, times = 1) {
  const check = canCook(state, recipe, stationRank, times);
  if (!check.ok) return { ok: false, message: check.reason };
  for (const [key, qty] of Object.entries(recipe.ingredients)) {
    let left = qty * times;
    left -= materialSaving(state, left); // talent Úsporné zpracování
    for (const id of optionsOf(key)) {
      const take = Math.min(left, getItemCount(state, id));
      if (take > 0) removeItem(state, id, take);
      left -= take;
    }
  }
  const outputId = outputItemId(recipe);
  const made = recipe.qty * times;
  const leftOver = addItem(state, outputId, made);

  let xp = 0;
  for (let i = 0; i < times; i++) {
    const first = !(state.cooking.cooked[recipe.id] > 0);
    let gain = cookingXp(recipe) * (first ? 2 : 1);
    if (cookingLevel(state) - recipe.level >= 20) gain *= 0.5;
    xp += Math.round(gain * professionXpMultiplier(state));
    state.cooking.cooked[recipe.id] = (state.cooking.cooked[recipe.id] ?? 0) + 1;
  }
  const levelsGained = addCookingXp(state, xp);
  countQuestEvent(state, `craft:cooking:${recipe.id}`, times); // úkoly Vaření
  return {
    ok: true,
    made: made - leftOver,
    lost: leftOver,
    xp,
    levelsGained,
    message: `Uvařeno: ${recipe.name} ×${made - leftOver} (+${xp} XP)${leftOver ? ` – ${leftOver} ks se nevešlo do inventáře` : ''}.`
  };
}

function addCookingXpRaw(state, amount) {
  const prof = state.professions.cooking;
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

// ---------------------------------------------------------- účinky jídla

const injuredFirst = (party) =>
  party.filter((m) => m.stats && m.currentHp > 0 && m.currentHp < m.stats.vitality)
    .sort((a, b) => (b.stats.vitality - b.currentHp) - (a.stats.vitality - a.currentHp));

function healMonster(monster, amount) {
  const gained = Math.min(amount, monster.stats.vitality - monster.currentHp);
  monster.currentHp += gained;
  return gained;
}

export const activeMeal = (state, now = Date.now()) => {
  const meal = state.meal;
  if (!meal) return null;
  const battles = meal.battlesLeft > 0;
  const travel = (meal.travelUntil ?? 0) > now;
  if (!battles && !travel) {
    state.meal = null;
    return null;
  }
  return meal;
};

// Snědení pokrmu. Vrací { ok, message, replaced }.
export function eatMeal(state, recipeId, now = Date.now()) {
  const recipe = COOKING_BY_ID[recipeId];
  const e = recipe?.effect;
  if (!e) return { ok: false, message: 'Tento předmět nejde sníst.' };
  const party = state.party ?? [];
  const parts = [];
  if (e.heal) {
    const target = injuredFirst(party)[0];
    if (target) parts.push(`${target.name} +${healMonster(target, e.heal)} HP`);
  }
  if (e.healAll) {
    let total = 0;
    for (const monster of party) if (monster.stats && monster.currentHp > 0) total += healMonster(monster, e.healAll);
    if (total) parts.push(`partě +${total} HP`);
  }
  if (e.mana) {
    const max = Number(state.maxMp) || 0;
    const gained = Math.min(e.mana, Math.max(0, max - (Number(state.mp) || 0)));
    state.mp = (Number(state.mp) || 0) + gained;
    if (gained) parts.push(`+${gained} many`);
  }
  let replaced = null;
  if (hasLastingEffect(e)) {
    replaced = activeMeal(state, now)?.name ?? null;
    state.meal = {
      recipe: recipe.id,
      name: recipe.name,
      // Mistr kuchyně: delší trvání (souboje zaokrouhleně, minuty přesně).
      battlesLeft: e.regen || e.manaRegen || e.buffs ? Math.round((e.battles ?? 0) * (1 + getTalentBonuses(state).foodDuration)) : 0,
      regen: e.regen ?? 0,
      manaRegen: e.manaRegen ?? 0,
      buffs: { ...(e.buffs ?? {}) },
      travelUntil: e.move || e.explore ? now + (e.minutes ?? 0) * 60000 * (1 + getTalentBonuses(state).foodDuration) : 0,
      move: e.move ?? 0,
      explore: e.explore ?? 0
    };
    parts.push('najedený');
  }
  if (!parts.length) return { ok: false, message: 'Monstra jsou zdravá a mana plná – jídlo by přišlo nazmar.' };
  return { ok: true, replaced, message: `${recipe.name}: ${parts.join(', ')}.` };
}

// Bonus statistiky z jídla v % (souboj). Platí jen s aktivním pokrmem.
export function mealBuff(state, stat) {
  const meal = activeMeal(state);
  return meal && meal.battlesLeft > 0 ? Number(meal.buffs?.[stat]) || 0 : 0;
}

// Po každém souboji: regenerace HP monstrům a many hrdinovi, odečet souboje.
export function applyMealAfterBattle(state) {
  const meal = activeMeal(state);
  if (!meal || !(meal.battlesLeft > 0)) return null;
  const party = state.party ?? [];
  if (meal.regen) for (const monster of party) if (monster.stats && monster.currentHp > 0) healMonster(monster, meal.regen);
  if (meal.manaRegen) {
    const max = Number(state.maxMp) || 0;
    state.mp = Math.min(max, (Number(state.mp) || 0) + meal.manaRegen);
  }
  meal.battlesLeft -= 1;
  activeMeal(state);
  return meal;
}

// Cestovní bonusy: rychlost pohybu a regenerace při průzkumu (každých 50 kroků).
export function mealMoveBonus(state) {
  const meal = activeMeal(state);
  return meal && meal.travelUntil > Date.now() ? (meal.move ?? 0) / 100 : 0;
}

export function mealExploreStep(state) {
  const meal = activeMeal(state);
  if (!meal || !(meal.travelUntil > Date.now()) || !meal.explore) return false;
  state.mealSteps = (state.mealSteps ?? 0) + 1;
  if (state.mealSteps < 50) return false;
  state.mealSteps = 0;
  for (const monster of state.party ?? []) if (monster.stats && monster.currentHp > 0) healMonster(monster, meal.explore);
  return true;
}

export const allCookingRecipes = () => ALL_COOKING;

// Zisk XP → vyskakovací okno dovednosti (SkillXpEvents).
export function addCookingXp(state, amount, ...rest) {
  const before = skillXpBefore(state, 'cooking');
  const result = addCookingXpRaw(state, amount, ...rest);
  reportSkillXp(state, 'cooking', before, amount);
  return result;
}
