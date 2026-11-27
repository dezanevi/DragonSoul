// ======================================================================
// Rybolov (bez minihry): kontrola náčiní, doba čekání podle úrovně (waitRange), výběr úlovku
// z tabulky lokality, zkušenosti a úrovně, deník úlovků, denní poptávka.
//
// Uložení:
//   state.professions.fishing = { level, exp, next }  (karta hrdiny, záložka dovedností)
//   state.fishing = { log: { id: počet }, legendaryUntil: { id: čas }, demand: { day, id, sold } }
// ======================================================================

import Phaser from 'phaser';
import { skillXpBefore, reportSkillXp } from './SkillXpEvents.js';
import { countQuestEvent } from './QuestCounters.js';
import { luckGatherBonus } from './HeroStatsSystem.js';
import {
  CATCHES, LOCATION_BY_ID, LOCATIONS, METAL_PARTS, METAL_REQUIREMENT, RODS, BAIT_BY_ID,
  SEA_WATERS, FISHING_RULES, FISH, isRareOrBetter, xpToNextFishingLevel
} from '../data/fishing.js';
import { getItem, TOOL_MOD, toolModOf } from '../data/items.js';
import { getItemCount, removeItem } from './InventorySystem.js';
import { getTalentBonuses } from './TalentSystem.js';
import { exploreBonus, professionXpMultiplier } from './AlchemySystem.js';

export function normalizeFishing(state) {
  state.professions ??= {};
  const prof = state.professions.fishing ?? {};
  const level = Math.max(1, Math.min(FISHING_RULES.maxLevel, Math.floor(Number(prof.level) || 1)));
  state.professions.fishing = {
    ...prof,
    level,
    exp: Math.max(0, Math.floor(Number(prof.exp) || 0)),
    next: xpToNextFishingLevel(level)
  };
  state.fishing ??= {};
  state.fishing.log ??= {};
  state.fishing.legendaryUntil ??= {};
  return state.fishing;
}

export const fishingLevel = (state) => normalizeFishing(state) && state.professions.fishing.level;

// Nejlepší vlastněný prut a kovová část.
export function bestRod(state) {
  return [...RODS].reverse().find((rod) => getItemCount(state, rod.id) > 0) ?? null;
}
export function bestMetal(state) {
  return [...METAL_PARTS].reverse().find((part) => getItemCount(state, part.id) > 0) ?? null;
}

// Může hráč v lokalitě rybařit? { ok, reason }
export function checkLocation(state, location) {
  const level = fishingLevel(state);
  if (level < location.minLevel) return { ok: false, reason: `Potřebuješ Rybolov na úrovni ${location.minLevel} (máš ${level}).` };
  if (!bestRod(state)) return { ok: false, reason: 'Potřebuješ rybářský prut (koupíš v Rybářské chatě v Greenvale).' };
  const metal = bestMetal(state);
  const need = METAL_REQUIREMENT[location.metal] ?? METAL_REQUIREMENT.hook;
  if (!metal || metal.tier < need.tier) return { ok: false, reason: `Potřebuješ ${need.label}.` };
  return { ok: true, reason: '' };
}

const isSea = (location) => SEA_WATERS.has(location.water);
const baitAppliesToWater = (bait, location) =>
  !bait?.waters || bait.waters === 'all' || (bait.waters === 'sea') === isSea(location);

// Rozmezí čekání [min, max] v sekundách pro úroveň Rybolovu (plynule mezi úrovní 1 a 100).
export function waitRange(level) {
  const t = Phaser.Math.Clamp((level - 1) / (FISHING_RULES.maxLevel - 1), 0, 1);
  const [min1, max1] = FISHING_RULES.waitAtLevel1;
  const [minMax, maxMax] = FISHING_RULES.waitAtMaxLevel;
  return [min1 + (minMax - min1) * t, max1 + (maxMax - max1) * t];
}

// Záběr: jak dlouho (s) má hráč na zaseknutí po záběru – úr. 1: 1,2 s, úr. 100: 1,8 s.
export function strikeWindow(state) {
  const t = Phaser.Math.Clamp((fishingLevel(state) - 1) / (FISHING_RULES.maxLevel - 1), 0, 1);
  return 1.2 + 0.6 * t;
}

// Nepovedené zaseknutí (brzy nebo pozdě): nic se nechytí, návnadu ryba sežere.
export function missCast(state, baitId = null) {
  if (baitId && getItemCount(state, baitId) > 0) removeItem(state, baitId, 1);
}

// Doba čekání v sekundách: náhodně v rozmezí podle úrovně (waitRange), × prut × návnada × olej.
export function waitSeconds(state, location, baitId = null, random = Math.random) {
  const [min, max] = waitRange(fishingLevel(state));
  let wait = min + random() * (max - min);
  wait *= bestRod(state)?.wait ?? 1;
  const bait = BAIT_BY_ID[baitId];
  if (bait?.wait && baitAppliesToWater(bait, location)) wait *= bait.wait;
  wait *= exploreBonus(state, 'fishWait', 1); // Návnadový olej
  // Modifikátor prutu a háčku / navijáku: čekání −3 % za bod.
  wait *= Math.max(0.5, 1 - TOOL_MOD.timePerPoint * (toolModOf(bestRod(state)?.id) + toolModOf(bestMetal(state)?.id)));
  return Phaser.Math.Clamp(wait, FISHING_RULES.minWait, FISHING_RULES.maxWait);
}

// Násobek váhy úlovku podle návnady (skupiny viz BAITS v data/fishing.js).
function baitMultiplier(bait, entry, location) {
  if (!bait?.boost) return 1;
  const tags = entry.tags ?? [];
  const fresh = tags.includes('fresh');
  const sea = tags.includes('sea');
  const elemental = entry.id === 'fish_elemental';
  const checks = {
    commonFresh: entry.kind === 'fish' && fresh && entry.rarity === 'common',
    uncommonFresh: fresh && entry.rarity === 'uncommon',
    uncommonSea: sea && entry.rarity === 'uncommon',
    predator: tags.includes('predator'),
    ice: tags.includes('ice'),
    elementalIce: elemental && location.element === 'led',
    elementalFire: elemental && location.element === 'oheň',
    deep: entry.kind === 'fish' && tags.includes('deep'),
    deepPearlCoral: entry.id === 'deep_pearl' || entry.id === 'deep_coral',
    moonFish: entry.id === 'fish_moon',
    magicPearl: entry.id === 'magic_pearl',
    legendary: entry.rarity === 'legendary'
  };
  let mult = 1;
  for (const [group, value] of Object.entries(bait.boost)) if (checks[group]) mult *= value;
  return mult;
}

// Tabulka úlovků po všech úpravách (v %, součet 100) – pro výběr i pro zobrazení.
export function catchTable(state, location, baitId = null, now = Date.now()) {
  const level = fishingLevel(state);
  const bait = BAIT_BY_ID[baitId];
  const metal = bestMetal(state);
  const cooldown = state.fishing?.legendaryUntil ?? {};
  const rows = [];
  for (const [id, base] of Object.entries(location.table)) {
    const entry = CATCHES[id];
    if (!entry || base <= 0) continue;
    if (entry.minLevel > level) continue; // ryba nad úroveň hráče se vyřadí
    if (entry.rarity === 'legendary' && (cooldown[id] ?? 0) > now) continue;
    let weight = base * baitMultiplier(bait, entry, location);
    if (metal && isRareOrBetter(entry.rarity)) weight *= metal.rareBonus ?? 1;
    // Alchymie: lektvar hlubinného dechu a zraku.
    if ((entry.tags ?? []).includes('deep')) weight *= exploreBonus(state, 'fishDeep', 1);
    if (isRareOrBetter(entry.rarity)) weight *= exploreBonus(state, 'fishRare', 1);
    rows.push({ id, entry, weight });
  }
  const normalize = () => {
    const total = rows.reduce((sum, row) => sum + row.weight, 0) || 1;
    for (const row of rows) row.percent = (row.weight / total) * 100;
  };
  normalize();
  // Legendární úlovek nikdy nepřekročí 1 %.
  const legendary = rows.filter((row) => row.entry.rarity === 'legendary' && row.percent > FISHING_RULES.legendaryCap);
  if (legendary.length) {
    const capped = legendary.length * FISHING_RULES.legendaryCap;
    const rest = rows.filter((row) => !legendary.includes(row));
    const restTotal = rest.reduce((sum, row) => sum + row.percent, 0) || 1;
    for (const row of legendary) row.percent = FISHING_RULES.legendaryCap;
    for (const row of rest) row.percent = (row.percent / restTotal) * (100 - capped);
  }
  return rows;
}

export function rollCatch(state, location, baitId = null, random = Math.random) {
  const rows = catchTable(state, location, baitId);
  let roll = random() * 100;
  for (const row of rows) {
    roll -= row.percent;
    if (roll <= 0) return row.entry;
  }
  return rows[rows.length - 1]?.entry ?? null;
}

// Zkušenosti z úlovku: první úlovek druhu ×2, snadné úlovky (o 20+ / 40+ úrovní nad minimem) ×0,5 / ×0,2.
export function catchXp(state, entry) {
  const level = fishingLevel(state);
  let xp = entry.xp;
  const over = level - entry.minLevel;
  if (over >= 40) xp *= 0.2;
  else if (over >= 20) xp *= 0.5;
  if (!(state.fishing.log[entry.id] > 0)) xp *= 2;
  return Math.max(1, Math.round(xp));
}

// Dokončí nahození: spotřebuje návnadu, zapíše deník, přidá zkušenosti.
// Úlovek do inventáře nedává – to potvrdí hráč v okně kořisti.
// Vrací { entry, qty, xp, newSpecies, levelsGained, level }.
export function completeCast(state, location, baitId = null, random = Math.random) {
  normalizeFishing(state);
  const entry = rollCatch(state, location, baitId, random);
  if (!entry) return null;
  if (baitId && getItemCount(state, baitId) > 0) removeItem(state, baitId, 1);

  const newSpecies = !(state.fishing.log[entry.id] > 0);
  const xp = Math.round(catchXp(state, entry) * professionXpMultiplier(state));
  state.fishing.log[entry.id] = (state.fishing.log[entry.id] ?? 0) + 1;
  // Úkoly (Rybolov I a III): chycené ryby, neobvyklé a lepší zvlášť.
  if (entry.kind === 'fish') {
    countQuestEvent(state, 'fish');
    if (entry.rarity !== 'common') countQuestEvent(state, 'fish:better');
  }
  if (entry.rarity === 'legendary') state.fishing.legendaryUntil[entry.id] = Date.now() + FISHING_RULES.legendaryCooldownMs;

  // Talent Rybářská trpělivost: šance na bonusový kus (ne u legendárních).
  const bonusChance = Math.min(0.2, getTalentBonuses(state).fishingBonusChance ?? 0) + luckGatherBonus(state); // + Štěstí
  const qty = entry.rarity !== 'legendary' && random() < bonusChance ? 2 : 1;

  const levelsGained = addFishingXp(state, xp);
  const label = entry.id === 'fish_elemental' && location.element ? `${entry.name} (${location.element})` : entry.name;
  return { entry, label, qty, xp, newSpecies, levelsGained, level: state.professions.fishing.level };
}

function addFishingXpRaw(state, amount) {
  const prof = state.professions.fishing;
  prof.exp += amount;
  let gained = 0;
  while (prof.level < FISHING_RULES.maxLevel && prof.exp >= xpToNextFishingLevel(prof.level)) {
    prof.exp -= xpToNextFishingLevel(prof.level);
    prof.level += 1;
    gained += 1;
  }
  if (prof.level >= FISHING_RULES.maxLevel) prof.exp = 0;
  prof.next = xpToNextFishingLevel(prof.level);
  return gained;
}

// Denní poptávka v Rybářské chatě: jeden druh ryby za 150 % (nejvýš 10 kusů za den).
export function dailyDemand(state, today = new Date()) {
  normalizeFishing(state);
  const day = today.toISOString().slice(0, 10);
  if (state.fishing.demand?.day !== day) {
    const pool = FISH.filter((fish) => fish.rarity !== 'legendary');
    const seed = [...day].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
    state.fishing.demand = { day, id: pool[Math.abs(seed) % pool.length].id, sold: 0 };
  }
  return state.fishing.demand;
}

// Výkupní cena kusu (chata = plná cena, denní poptávka ×1,5 do limitu).
export function sellPrice(state, itemId, demandAware = true) {
  const price = getItem(itemId)?.price ?? 0;
  if (!demandAware) return price;
  const demand = dailyDemand(state);
  if (demand.id === itemId && demand.sold < FISHING_RULES.dailyDemandLimit) return Math.round(price * FISHING_RULES.dailyDemandBonus);
  return price;
}

export const locationById = (id) => LOCATION_BY_ID[id] ?? null;
export const allLocations = () => LOCATIONS;

// Zisk XP → vyskakovací okno dovednosti (SkillXpEvents).
export function addFishingXp(state, amount, ...rest) {
  const before = skillXpBefore(state, 'fishing');
  const result = addFishingXpRaw(state, amount, ...rest);
  reportSkillXp(state, 'fishing', before, amount);
  return result;
}
