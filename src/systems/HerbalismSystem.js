// ======================================================================
// Sběr bylin (bez minihry): kontrola úrovně a srpu, doba sběru, výtěžnost, vedlejší
// rostlina, vzácné nálezy, obnova nalezišť, herbář, Skryté lesní naleziště, specializace.
//
// Uložení:
//   state.professions.herbalism = { level, exp, next }        (karta hrdiny)
//   state.herbalism = {
//     log: { herbId: počet },               herbář – sebrané rostliny (první sběr = bonus XP)
//     sites: { siteId: počet },             sebraná naleziště
//     depleted: { siteId: čas obnovy },     sebraná naleziště čekají na obnovu
//     specialization: null | 'healer' | 'elemental' | 'explorer', specChanges,
//     hidden: { region, until },            Skryté lesní naleziště (zápis / Průzkumník)
//     shop: { day, sold: { itemId: kusů } }, denní zásoba Bylinkářky
//     seeded: { siteId: { herb, until } }   záhon statku osetý Vzácnými semeny
//   }
// Kořist se do inventáře nedává tady – potvrdí ji hráč v okně kořisti.
// ======================================================================

import { formatGameDuration } from './TimeSystem.js';
import { skillXpBefore, reportSkillXp } from './SkillXpEvents.js';
import { countQuestEvent } from './QuestCounters.js';
import { luckGatherBonus } from './HeroStatsSystem.js';
import { getTalentBonuses } from './TalentSystem.js';
import {
  HERB_RARITY, HERB_RULES, HERB_BY_ID, HERB_SITES, HERB_SITE_BY_ID, SICKLES, HERB_TIER_LABEL, HERB_SPECIALIZATIONS,
  FLOWER_HERBS, POLLEN_RARITIES, HERBALIST_STOCK, xpToNextHerbLevel
} from '../data/herbalism.js';
import { getItemCount } from './InventorySystem.js';
import { exploreBonus, professionXpMultiplier } from './AlchemySystem.js';
import { TOOL_MOD, toolModOf } from '../data/items.js';

const DAY = 86400000;
const FOREST = new Set(['forest']);

export function normalizeHerbalism(state) {
  state.professions ??= {};
  const prof = state.professions.herbalism ?? {};
  const level = Math.max(1, Math.min(HERB_RULES.maxLevel, Math.floor(Number(prof.level) || 1)));
  state.professions.herbalism = { ...prof, level, exp: Math.max(0, Math.floor(Number(prof.exp) || 0)), next: xpToNextHerbLevel(level) };
  delete state.professions.herbalism.locked;
  state.herbalism ??= {};
  const h = state.herbalism;
  h.log ??= {};
  h.sites ??= {};
  h.depleted ??= {};
  h.specialization ??= null;
  h.specChanges ??= 0;
  h.hidden ??= null;
  h.shop ??= { day: 0, sold: {} };
  h.seeded ??= {};
  return h;
}

export const herbLevel = (state) => normalizeHerbalism(state) && state.professions.herbalism.level;
export const herbSiteById = (id) => HERB_SITE_BY_ID[id] ?? null;
export const herbSpecialization = (state) => normalizeHerbalism(state).specialization;

// Nejlepší srp, který hráč smí použít (úroveň Sběru bylin ≥ úroveň srpu).
export function bestSickle(state) {
  const level = herbLevel(state);
  return [...SICKLES].reverse().find((s) => getItemCount(state, s.id) > 0 && level >= s.level) ?? null;
}
const ownedSickle = (state) => [...SICKLES].reverse().find((s) => getItemCount(state, s.id) > 0) ?? null;

// Hlavní rostlina naleziště (u osetého záhonu podle semen).
export function siteMain(state, site, now = Date.now()) {
  const seeded = normalizeHerbalism(state).seeded[site.id];
  return seeded && seeded.until > now ? seeded.herb : site.main;
}

// ------------------------------------------------------------ stav naleziště

export function herbSiteStatus(state, site, now = Date.now()) {
  const h = normalizeHerbalism(state);
  const until = h.depleted[site.id] ?? 0;
  if (until && until <= now) delete h.depleted[site.id];
  return until > now ? { ready: false, until } : { ready: true, until: 0 };
}

// Odpočet obnovy v herním čase (TimeSystem: 1 minuta hraní = 1 herní hodina).
export const formatHerbWait = (ms) => formatGameDuration(ms);

// Může hráč naleziště sbírat? { ok, reason }
export function checkHerbSite(state, site, { now = Date.now() } = {}) {
  const level = herbLevel(state);
  if (level < site.minLevel) return { ok: false, reason: `Potřebuješ Sběr bylin na úrovni ${site.minLevel} (máš ${level}).` };
  const sickle = bestSickle(state);
  if (!sickle) {
    const owned = ownedSickle(state);
    return { ok: false, reason: owned ? `${owned.name} vyžaduje Sběr bylin ${owned.level}.` : 'Potřebuješ srp – dostaneš ho od Bylinkářky v Greenvale.' };
  }
  if (sickle.tier < site.tier) {
    const need = SICKLES.find((s) => s.tier === site.tier && !s.starter);
    return { ok: false, reason: `Potřebuješ ${need.name} (stupeň ${HERB_TIER_LABEL[need.tier]}) nebo lepší.` };
  }
  if (site.special === 'hidden' && !activeHiddenHerbs(state, now)) return { ok: false, reason: 'Skryté naleziště se ukáže jen po Botanickém zápisu.' };
  const status = herbSiteStatus(state, site, now);
  if (!status.ready) return { ok: false, reason: `Naleziště je sebrané – obnoví se za ${formatHerbWait(status.until - now)}.` };
  return { ok: true, reason: '' };
}

// ------------------------------------------------------------ výpočty

const tiersAbove = (state, site) => Math.max(0, (bestSickle(state)?.tier ?? site.tier) - site.tier);
const herbOf = (id) => HERB_BY_ID[id];

export function herbSeconds(state, site) {
  const herb = herbOf(site.main);
  let seconds = HERB_RARITY[site.rarity].seconds;
  seconds *= 1 - HERB_RULES.secondsPerLevel * Math.max(0, herbLevel(state) - (herb?.level ?? site.minLevel));
  seconds *= 1 - 0.05 * tiersAbove(state, site);
  if (bestSickle(state)?.id === 'mithril_sickle' || bestSickle(state)?.id === 'star_sickle') seconds *= 0.85;
  seconds *= 1 - TOOL_MOD.timePerPoint * toolModOf(bestSickle(state)?.id); // modifikátor srpu
  return Math.max(HERB_RULES.minSeconds, seconds);
}

// Šance na +1 kus hlavní rostliny.
export function herbExtraChance(state, site, herbId = site.main) {
  const herb = herbOf(herbId);
  const sickle = bestSickle(state)?.id;
  let chance = 0;
  if (herb?.rarity === 'rare' && ['silver_herb_sickle', 'brass_herb_gatherer', 'mithril_sickle', 'star_sickle'].includes(sickle)) chance += sickle === 'silver_herb_sickle' ? 0.15 : 0.2;
  if (herb?.rarity === 'epic' && ['brass_herb_gatherer', 'mithril_sickle', 'star_sickle'].includes(sickle)) chance += 0.2;
  const spec = HERB_SPECIALIZATIONS.find((s) => s.id === herbSpecialization(state));
  if (spec?.herbs.includes(herbId) && !site.cultivated) chance += 0.35;
  chance += TOOL_MOD.extraPerPoint * toolModOf(sickle); // modifikátor srpu
  chance += getTalentBonuses(state).herbBonusChance; // talent Bylinkářská ruka
  chance += luckGatherBonus(state); // Štěstí
  return Math.min(0.6, chance + exploreBonus(state, 'herbExtra', 0));
}

// Rozsah výtěžnosti [min, max].
export function herbYieldRange(state, site, herbId = site.main) {
  const herb = herbOf(herbId);
  const [min, max] = HERB_RARITY[herb.rarity].yield;
  const spec = herbSpecialization(state);
  // Bonus +1 od úrovně rostliny + 25 (běžné a neobvyklé); Elementální bez bonusu u běžných,
  // Průzkumník bez bonusu na běžných nalezištích a záhonech.
  let bonus = (herb.rarity === 'common' || herb.rarity === 'uncommon') && herbLevel(state) >= herb.level + HERB_RULES.bonusYieldOver ? 1 : 0;
  if (spec === 'elemental' && herb.rarity === 'common') bonus = 0;
  if (spec === 'explorer' && !site.special) bonus = 0;
  return [min, max + bonus];
}

export function herbSideChance(state, site) {
  if (!site.side || site.cultivated) return 0;
  const side = herbOf(site.side);
  if (!side || side.level > herbLevel(state) || side.tier > (bestSickle(state)?.tier ?? 0)) return 0;
  return herbSpecialization(state) === 'healer' ? 0.35 : HERB_RULES.sideChance;
}

const rareMult = (state) => (herbSpecialization(state) === 'explorer' ? 1.5 : 1);
const sickleRareBonus = (state) => ({ silver_herb_sickle: 0.02, mithril_sickle: 0.03, star_sickle: 0.03 }[bestSickle(state)?.id] ?? 0);

// Vzácné nálezy, které na nalezišti můžou padnout: [{ id, chance }].
export function herbRareChances(state, site, herbId = site.main) {
  if (site.cultivated) return [];
  const herb = herbOf(herbId);
  const level = herbLevel(state);
  const base = site.special ? site.rareChance : Math.min(HERB_RULES.rareCap, HERB_RULES.rareBase + HERB_RULES.rarePerLevel * Math.max(0, level - site.minLevel)) * 0.25;
  const list = [];
  const push = (id, chance) => list.push({ id, chance: (chance + sickleRareBonus(state) * (chance > 0 ? 1 : 0)) * rareMult(state) });
  if (site.special) {
    for (const id of site.finds) push(id, id === 'herb_botanical_note' ? (herbSpecialization(state) === 'explorer' ? 0.04 : 0.02) : base / site.finds.length);
    return list;
  }
  if (POLLEN_RARITIES.has(herb.rarity)) push('herb_pollen', herbSpecialization(state) === 'elemental' ? 0.14 : 0.08);
  if (FLOWER_HERBS.has(herbId)) push('herb_flower_essence', 0.05);
  if (FOREST.has(site.biome)) push('herb_forest_resin', 0.06);
  if (!list.length && base > 0) push('herb_rare_seeds', Math.min(0.05, base));
  return list;
}

export function herbXp(state, site, herbId = site.main) {
  const herb = herbOf(herbId);
  const level = herbLevel(state);
  let xp = HERB_RARITY[herb.rarity].xp * (1 + herb.level / HERB_RULES.levelXpScale);
  if (site.special) xp *= HERB_RULES.specialXp;
  if (site.cultivated) xp *= HERB_RULES.cultivatedXp;
  const over = level - herb.level;
  if (over >= 40) xp *= 0.2;
  else if (over >= 20) xp *= 0.5;
  if (herbSpecialization(state) === 'healer' && ['rare', 'epic', 'magic', 'legendary'].includes(herb.rarity) && !['sun_thistle'].includes(herbId)) xp *= 0.9;
  if (herbSpecialization(state) === 'elemental' && herb.rarity === 'common') xp *= 0.9;
  return Math.max(1, Math.round(xp * professionXpMultiplier(state)));
}

const roll = (random, min, max) => min + Math.floor(random() * (max - min + 1));

function pickWeighted(table, random, level) {
  const rows = Object.entries(table).filter(([id]) => (herbOf(id)?.level ?? 1) <= level);
  const total = rows.reduce((sum, [, w]) => sum + w, 0);
  let value = random() * total;
  for (const [id, w] of rows) {
    value -= w;
    if (value <= 0) return id;
  }
  return rows[rows.length - 1]?.[0] ?? null;
}

// Sebere naleziště: kořist, obnova, herbář a zkušenosti.
// Vrací { ok, reason } nebo { ok, items, xp, levelsGained, level, rare, firstHerbs, revealedHidden }.
export function harvestHerbSite(state, site, { random = Math.random, now = Date.now(), region = 'Greenvale' } = {}) {
  const h = normalizeHerbalism(state);
  const check = checkHerbSite(state, site, { now });
  if (!check.ok) return check;

  const loot = new Map();
  const add = (id, qty = 1) => id && qty > 0 && loot.set(id, (loot.get(id) ?? 0) + qty);
  const herbs = new Set();
  let xp = 0;

  if (site.special) {
    const level = herbLevel(state);
    if (site.guaranteed) {
      add(site.guaranteed, 1);
      herbs.add(site.guaranteed);
    }
    for (let i = 0; i < site.draws; i++) {
      const id = pickWeighted(site.table, random, level);
      if (!id) continue;
      const [min, max] = herbYieldRange(state, site, id);
      const thicketBonus = site.special === 'thicket' ? site.extraYield + (herbSpecialization(state) === 'explorer' ? 1 : 0) : 0;
      add(id, roll(random, min, max) + thicketBonus);
      herbs.add(id);
    }
  } else {
    const main = siteMain(state, site, now);
    const [min, max] = herbYieldRange(state, site, main);
    add(main, roll(random, min, max) + (random() < herbExtraChance(state, site, main) ? 1 : 0));
    herbs.add(main);
    if (random() < herbSideChance(state, site)) {
      add(site.side, 1);
      herbs.add(site.side);
    }
  }

  const rare = [];
  for (const find of herbRareChances(state, site, siteMain(state, site, now))) {
    if (random() < find.chance) {
      rare.push(find.id);
      add(find.id);
    }
  }

  // XP za hlavní rostlinu (u speciálních za nejvzácnější tah), herbář: první sběr rostliny = bonus.
  const mainHerb = site.special
    ? [...herbs].sort((a, b) => herbOf(b).level - herbOf(a).level)[0]
    : siteMain(state, site, now);
  xp += herbXp(state, site, mainHerb);
  const firstHerbs = [];
  for (const id of herbs) {
    if (!(h.log[id] > 0)) {
      firstHerbs.push(id);
      xp += Math.round(HERB_RARITY[herbOf(id).rarity].xp * HERB_RULES.firstHarvestXp);
    }
    h.log[id] = (h.log[id] ?? 0) + (loot.get(id) ?? 0);
  }
  h.sites[site.id] = (h.sites[site.id] ?? 0) + 1;
  // Úkoly Sběru bylin: nasbírané rostliny, ze statku (záhony Z, ohrada L) zvlášť.
  for (const [id, qty] of loot) {
    countQuestEvent(state, `herb:${id}`, qty);
    if (/^[ZL]\d/.test(site.id)) countQuestEvent(state, 'herb:farm', qty);
  }

  // Obnova: srp III a lepší −10 %, Elementální bylinář −20 % u elementálních rostlin.
  let respawn = site.respawnMs;
  if (['brass_herb_gatherer', 'mithril_sickle', 'star_sickle'].includes(bestSickle(state)?.id)) respawn *= 0.9;
  if (herbSpecialization(state) === 'elemental' && HERB_SPECIALIZATIONS[1].herbs.includes(site.main)) respawn *= 0.8;
  h.depleted[site.id] = now + respawn;
  if (site.special === 'hidden') h.hidden = null;

  // Průzkumník: při sběru v lese 4 % odhalit Skryté lesní naleziště.
  let revealedHidden = null;
  if (!site.special && FOREST.has(site.biome) && herbSpecialization(state) === 'explorer' && !activeHiddenHerbs(state, now) && random() < 0.04) {
    revealedHidden = revealHiddenHerbs(state, region, now);
  }

  const levelsGained = addHerbXp(state, xp);
  return {
    ok: true,
    items: [...loot.entries()].map(([id, qty]) => ({ id, qty })),
    xp, levelsGained, level: state.professions.herbalism.level, rare, firstHerbs, revealedHidden
  };
}

function addHerbXpRaw(state, amount) {
  const prof = state.professions.herbalism;
  prof.exp += amount;
  let gained = 0;
  while (prof.level < HERB_RULES.maxLevel && prof.exp >= xpToNextHerbLevel(prof.level)) {
    prof.exp -= xpToNextHerbLevel(prof.level);
    prof.level += 1;
    gained += 1;
  }
  if (prof.level >= HERB_RULES.maxLevel) prof.exp = 0;
  prof.next = xpToNextHerbLevel(prof.level);
  return gained;
}

// ------------------------------------------------------------ Skryté lesní naleziště

export function activeHiddenHerbs(state, now = Date.now()) {
  const hidden = normalizeHerbalism(state).hidden;
  if (!hidden) return null;
  if (hidden.until <= now) {
    state.herbalism.hidden = null;
    return null;
  }
  return hidden;
}

export function revealHiddenHerbs(state, region = 'Greenvale', now = Date.now()) {
  state.herbalism.hidden = { region, until: now + HERB_RULES.hiddenMinutes * 60000 };
  delete state.herbalism.depleted.SH2;
  return state.herbalism.hidden;
}

// Použití Botanického zápisu z inventáře.
export function useBotanicalNote(state, now = Date.now()) {
  normalizeHerbalism(state);
  if (activeHiddenHerbs(state, now)) return { ok: false, message: 'Skryté lesní naleziště už máš odhalené – nejdřív ho sesbírej.' };
  const hidden = revealHiddenHerbs(state, state.region || 'Greenvale', now);
  return { ok: true, message: `Botanický zápis odhalil Skryté lesní naleziště v regionu ${hidden.region} na 30 min.` };
}

// Vzácná semena na záhon statku: záhon na 2 h ponese neobvyklou rostlinu.
export function seedBed(state, siteId, herbId = 'forest_sage', now = Date.now()) {
  const h = normalizeHerbalism(state);
  h.seeded[siteId] = { herb: herbId, until: now + 2 * 3600000 };
  delete h.depleted[siteId];
  return h.seeded[siteId];
}

// ------------------------------------------------------------ Bylinkářka

// Denní zásoba obchodu: kolik kusů ještě jde dnes koupit.
export function herbalistStock(state, now = Date.now()) {
  const h = normalizeHerbalism(state);
  const day = Math.floor(now / DAY);
  if (h.shop.day !== day) h.shop = { day, sold: {} };
  return HERBALIST_STOCK.map((s) => ({ ...s, left: Math.max(0, s.daily - (h.shop.sold[s.id] ?? 0)) }));
}

export function recordHerbalistSale(state, itemId, qty, now = Date.now()) {
  herbalistStock(state, now);
  state.herbalism.shop.sold[itemId] = (state.herbalism.shop.sold[itemId] ?? 0) + qty;
}

// Hledaná bylina dne (výkup za dvojnásobek) – běžná nebo neobvyklá podle dne.
export function wantedHerb(now = Date.now()) {
  const pool = HERB_SITES.filter((s) => !s.cultivated && (s.rarity === 'common' || s.rarity === 'uncommon')).map((s) => s.main);
  const unique = [...new Set(pool)];
  return unique[Math.floor(now / DAY) % unique.length];
}

// ------------------------------------------------------------ specializace

export function chooseHerbSpecialization(state, id) {
  normalizeHerbalism(state);
  const spec = HERB_SPECIALIZATIONS.find((s) => s.id === id);
  if (!spec) return { ok: false, message: 'Neznámá specializace.' };
  if (herbLevel(state) < HERB_RULES.specializationLevel) return { ok: false, message: `Specializace se odemkne na Sběru bylin ${HERB_RULES.specializationLevel}.` };
  if (state.herbalism.specialization === id) return { ok: false, message: `${spec.name} už je tvoje specializace.` };
  const cost = state.herbalism.specialization ? HERB_RULES.specializationChangeCost : 0;
  const gold = Math.floor(Number(state.gold) || 0);
  if (gold < cost) return { ok: false, message: `Změna specializace stojí ${cost} zlata.` };
  state.gold = gold - cost;
  state.herbalism.specialization = id;
  state.herbalism.specChanges += cost ? 1 : 0;
  return { ok: true, message: `Specializace Sběru bylin: ${spec.name}${cost ? ` (−${cost} zlata)` : ''}.` };
}

// Zisk XP → vyskakovací okno dovednosti (SkillXpEvents).
export function addHerbXp(state, amount, ...rest) {
  const before = skillXpBefore(state, 'herbalism');
  const result = addHerbXpRaw(state, amount, ...rest);
  reportSkillXp(state, 'herbalism', before, amount);
  return result;
}
