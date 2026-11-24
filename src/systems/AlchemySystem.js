// ======================================================================
// Alchymie: úroveň a zkušenosti, výroba u pracoviště a účinky přípravků.
//
// Uložení:
//   state.professions.alchemy = { level, exp, next }
//   state.alchemy = { learned: {}, made: {} }
//   state.elixir = { recipe, name, buffs, battlesLeft }            jeden elixír najednou
//   state.potionGuard = { recipe, name, immune, resist, battlesLeft } jedna ochrana najednou
//   state.alchemyEffects = { klíč: { value, until?, battlesLeft?, name } } průzkumné bonusy
// ======================================================================

import { ALL_ALCHEMY, ALCHEMY_BY_ID, alchemyOutputId, alchemyXp } from '../data/alchemy.js';
import { xpToNextFishingLevel as xpToNextLevel } from '../data/fishing.js';
import { getItemCount, removeItem, addItem } from './InventorySystem.js';

const MAX_LEVEL = 100;
export const ALL_ALCHEMY_KNOWN_FOR_TESTING = true;
export const STAT_STACK_CAP = 25; // jídlo + elixír na stejnou statistiku nejvýš +25 %

export function normalizeAlchemy(state) {
  state.professions ??= {};
  const prof = state.professions.alchemy ?? {};
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(prof.level) || 1)));
  state.professions.alchemy = { ...prof, level, exp: Math.max(0, Math.floor(Number(prof.exp) || 0)), next: xpToNextLevel(level) };
  state.alchemy ??= {};
  state.alchemy.learned ??= {};
  state.alchemy.made ??= {};
  state.alchemyEffects ??= {};
  return state.alchemy;
}

export const alchemyLevel = (state) => normalizeAlchemy(state) && state.professions.alchemy.level;
export const isAlchemyKnown = (state, recipe) =>
  ALL_ALCHEMY_KNOWN_FOR_TESTING || recipe.origin === 'base' || recipe.origin === 'game' || Boolean(state.alchemy?.learned?.[recipe.id]);

const optionsOf = (key) => key.split('|');
export const alchemyIngredientCount = (state, key) => optionsOf(key).reduce((sum, id) => sum + getItemCount(state, id), 0);

export function alchemyMaxBatches(state, recipe) {
  let max = Infinity;
  for (const [key, qty] of Object.entries(recipe.ingredients)) max = Math.min(max, Math.floor(alchemyIngredientCount(state, key) / qty));
  return Number.isFinite(max) ? max : 0;
}

export function canBrew(state, recipe, stationRank, times = 1) {
  if (!isAlchemyKnown(state, recipe)) return { ok: false, reason: 'Tento recept zatím neznáš.' };
  if (alchemyLevel(state) < recipe.level) return { ok: false, reason: `Potřebuješ Alchymii na úrovni ${recipe.level}.` };
  if (stationRank < recipe.station) return { ok: false, reason: 'Na tomto pracovišti tento recept vyrobit nejde.' };
  if (alchemyMaxBatches(state, recipe) < times) return { ok: false, reason: 'Chybí suroviny.' };
  return { ok: true, reason: '' };
}

export function brew(state, recipe, stationRank, times = 1) {
  const check = canBrew(state, recipe, stationRank, times);
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
  const leftOver = addItem(state, alchemyOutputId(recipe), made);
  let xp = 0;
  for (let i = 0; i < times; i++) {
    const first = !(state.alchemy.made[recipe.id] > 0);
    let gain = alchemyXp(recipe) * (first ? 2 : 1);
    if (alchemyLevel(state) - recipe.level >= 20) gain *= 0.5;
    xp += Math.round(gain * professionXpMultiplier(state));
    state.alchemy.made[recipe.id] = (state.alchemy.made[recipe.id] ?? 0) + 1;
  }
  const levelsGained = addAlchemyXp(state, xp);
  return {
    ok: true, made: made - leftOver, xp, levelsGained,
    message: `Vyrobeno: ${recipe.name} ×${made - leftOver} (+${xp} XP)${leftOver ? ` – ${leftOver} ks se nevešlo do inventáře` : ''}.`
  };
}

export function addAlchemyXp(state, amount) {
  const prof = state.professions.alchemy;
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

// ---------------------------------------------------- průzkumné bonusy

function activeExplore(state, key, now = Date.now()) {
  const effect = state.alchemyEffects?.[key];
  if (!effect) return null;
  const alive = (effect.until ?? 0) > now || (effect.battlesLeft ?? 0) > 0;
  if (!alive) {
    delete state.alchemyEffects[key];
    return null;
  }
  return effect;
}

// Hodnota průzkumného bonusu (0 / výchozí, když neplatí).
export function exploreBonus(state, key, fallback = 0) {
  return activeExplore(state, key)?.value ?? fallback;
}

export const professionXpMultiplier = (state) => 1 + exploreBonus(state, 'craftXp', 0);

// ------------------------------------------------- použití přípravků

const injuredFirst = (party) =>
  party.filter((m) => m.stats && m.currentHp > 0 && m.currentHp < m.stats.vitality)
    .sort((a, b) => (b.stats.vitality - b.currentHp) - (a.stats.vitality - a.currentHp));

const healMonster = (monster, amount) => {
  const gained = Math.min(amount, monster.stats.vitality - monster.currentHp);
  monster.currentHp += gained;
  return gained;
};

function setLasting(state, recipe, e, now) {
  const notes = [];
  if (e.buffs) {
    if (state.elixir?.battlesLeft > 0) notes.push(`nahrazuje elixír ${state.elixir.name}`);
    state.elixir = { recipe: recipe.id, name: recipe.name, buffs: { ...e.buffs }, battlesLeft: e.battles };
  }
  if (e.immune || e.resist) {
    if (state.potionGuard?.battlesLeft > 0) notes.push(`nahrazuje ochranu ${state.potionGuard.name}`);
    state.potionGuard = { recipe: recipe.id, name: recipe.name, immune: [...(e.immune ?? [])], resist: { ...(e.resist ?? {}) }, battlesLeft: e.battles };
  }
  if (e.explore) {
    for (const [key, value] of Object.entries(e.explore)) {
      state.alchemyEffects[key] = e.minutes
        ? { value, until: now + e.minutes * 60000, name: recipe.name }
        : { value, battlesLeft: e.battles, name: recipe.name };
    }
  }
  return notes;
}

// Použití mimo souboj (inventář). Vrací { ok, message }.
export function useAlchemyOutside(state, recipeId, now = Date.now()) {
  normalizeAlchemy(state);
  const recipe = ALCHEMY_BY_ID[recipeId];
  const e = recipe?.effect;
  if (!e) return { ok: false, message: 'Tento předmět nejde použít.' };
  const party = state.party ?? [];
  const parts = [];
  if (e.heal) {
    const target = injuredFirst(party)[0];
    if (target) parts.push(`${target.name} +${healMonster(target, e.heal)} HP`);
  }
  if (e.healAll) {
    let total = 0;
    for (const m of party) if (m.stats && m.currentHp > 0) total += healMonster(m, e.healAll);
    if (total) parts.push(`partě +${total} HP`);
  }
  if (e.mana) {
    const max = Number(state.maxMp) || 0;
    const gained = Math.min(e.mana, Math.max(0, max - (Number(state.mp) || 0)));
    state.mp = (Number(state.mp) || 0) + gained;
    if (gained) parts.push(`+${gained} many`);
  }
  const lasting = Boolean(e.buffs || e.immune || e.resist || e.explore);
  const notes = lasting ? setLasting(state, recipe, e, now) : [];
  if (lasting) parts.push('účinek trvá');
  if (!parts.length) return { ok: false, message: 'Monstra jsou zdravá a mana plná – přípravek by přišel nazmar.' };
  return { ok: true, message: `${recipe.name}: ${parts.join(', ')}${notes.length ? ` (${notes.join(', ')})` : ''}.` };
}

// Trvající účinky z přípravku použitého v souboji (elixír, ochrana) – jako mimo souboj.
export function applyLastingInBattle(state, recipe) {
  return setLasting(state, recipe, recipe.effect, Date.now());
}

export function elixirBuff(state, stat) {
  return state.elixir?.battlesLeft > 0 ? Number(state.elixir.buffs?.[stat]) || 0 : 0;
}

export function activeGuard(state) {
  return state.potionGuard?.battlesLeft > 0 ? state.potionGuard : null;
}

// Po souboji: odečet elixíru, ochrany a průzkumných bonusů na počet soubojů.
export function applyAlchemyAfterBattle(state) {
  if (state.elixir?.battlesLeft > 0) state.elixir.battlesLeft -= 1;
  if (state.elixir && state.elixir.battlesLeft <= 0) state.elixir = null;
  if (state.potionGuard?.battlesLeft > 0) state.potionGuard.battlesLeft -= 1;
  if (state.potionGuard && state.potionGuard.battlesLeft <= 0) state.potionGuard = null;
  for (const [key, effect] of Object.entries(state.alchemyEffects ?? {})) {
    if (effect.battlesLeft > 0) {
      effect.battlesLeft -= 1;
      if (effect.battlesLeft <= 0 && !(effect.until > Date.now())) delete state.alchemyEffects[key];
    }
  }
}

export const allAlchemyRecipes = () => ALL_ALCHEMY;
