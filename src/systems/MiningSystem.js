// ======================================================================
// Těžba (bez minihry): kontrola úrovně a krumpáče, doba těžby, výtěžnost, vedlejší
// a vzácné nálezy, obnova nalezišť, Skrytá žíla, Hvězdný meteorit, specializace.
//
// Uložení:
//   state.professions.mining = { level, exp, next }          (karta hrdiny)
//   state.mining = {
//     log: { depositId: počet },            vytěžená naleziště (první těžba ×2 XP)
//     depleted: { depositId: čas obnovy },  vytěžená naleziště čekají na obnovu
//     specialization: null | 'deep' | 'gems' | 'explorer', specChanges,
//     hidden: { region, deposit, until },   Skrytá žíla (mapa / Průzkumník)
//     meteor: { region, landedAt, mined }   Hvězdný meteorit (jednou za 24 h)
//   }
// Kořist se do inventáře nedává tady – potvrdí ji hráč v okně kořisti.
// ======================================================================

import {
  MINING_RARITY, MINING_RULES, DEPOSITS, DEPOSIT_BY_ID, PICKAXES, MINING_MATERIAL_BY_ID, MINING_SPECIALIZATIONS,
  xpToNextMiningLevel, TIER_LABEL
} from '../data/mining.js';
import { getItemCount, removeItem, addItem } from './InventorySystem.js';
import { getTalentBonuses } from './TalentSystem.js';
import { exploreBonus, professionXpMultiplier } from './AlchemySystem.js';

const HOUR = 3600000;
const GEMLIKE = new Set(['gem', 'elemental', 'crystal']);
const ASTRAL = new Set(['crystal_astral', 'astral_shard', 'mat_hvezdny_prach', 'star_ore']);
const MINES = new Set(['mine', 'deep']);

export function normalizeMining(state) {
  state.professions ??= {};
  const prof = state.professions.mining ?? {};
  const level = Math.max(1, Math.min(MINING_RULES.maxLevel, Math.floor(Number(prof.level) || 1)));
  state.professions.mining = { ...prof, level, exp: Math.max(0, Math.floor(Number(prof.exp) || 0)), next: xpToNextMiningLevel(level) };
  delete state.professions.mining.locked;
  state.mining ??= {};
  state.mining.log ??= {};
  state.mining.depleted ??= {};
  state.mining.specialization ??= null;
  state.mining.specChanges ??= 0;
  state.mining.hidden ??= null;
  state.mining.meteor ??= null;
  return state.mining;
}

export const miningLevel = (state) => normalizeMining(state) && state.professions.mining.level;
export const depositById = (id) => DEPOSIT_BY_ID[id] ?? null;
export const specialization = (state) => normalizeMining(state).specialization;
export const hasTool = (state, id) => getItemCount(state, id) > 0;

// Nejlepší krumpáč, který hráč smí použít (úroveň Těžby ≥ úroveň krumpáče).
export function bestPickaxe(state) {
  const level = miningLevel(state);
  return [...PICKAXES].reverse().find((p) => getItemCount(state, p.id) > 0 && level >= p.level) ?? null;
}
const ownedPickaxe = (state) => [...PICKAXES].reverse().find((p) => getItemCount(state, p.id) > 0) ?? null;

// ------------------------------------------------------------ stav naleziště

// Hvězdný meteorit: jednou za 24 h dopadne do náhodného odemčeného regionu.
// Dočasně (testování) dopadá vždy do Greenvale, kde jsou všechna naleziště.
export function currentMeteor(state, now = Date.now()) {
  const mining = normalizeMining(state);
  if (!mining.meteor || now - mining.meteor.landedAt >= MINING_RULES.meteorHours * HOUR) {
    mining.meteor = { region: 'Greenvale', landedAt: now, mined: false };
  }
  return mining.meteor.mined ? null : mining.meteor;
}

// { ready, until } – vytěžené naleziště čeká na obnovu.
export function depositStatus(state, deposit, now = Date.now()) {
  const mining = normalizeMining(state);
  if (deposit.special === 'meteor') {
    const meteor = currentMeteor(state, now);
    return meteor ? { ready: true, until: 0 } : { ready: false, until: mining.meteor.landedAt + MINING_RULES.meteorHours * HOUR };
  }
  const until = mining.depleted[deposit.id] ?? 0;
  if (until && until <= now) delete mining.depleted[deposit.id];
  return until > now ? { ready: false, until } : { ready: true, until: 0 };
}

export const formatWait = (ms) => {
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
};

// Může hráč naleziště těžit? { ok, reason }
export function checkDeposit(state, deposit, { hidden = false, now = Date.now() } = {}) {
  const level = miningLevel(state);
  if (level < deposit.minLevel) return { ok: false, reason: `Potřebuješ Těžbu na úrovni ${deposit.minLevel} (máš ${level}).` };
  const pick = bestPickaxe(state);
  if (!pick) {
    const owned = ownedPickaxe(state);
    return { ok: false, reason: owned ? `${owned.name} vyžaduje Těžbu ${owned.level}.` : 'Potřebuješ krumpáč (Hornický mistr v kovárně Greenvale).' };
  }
  if (pick.tier < deposit.tier) {
    const need = PICKAXES.find((p) => p.tier === deposit.tier);
    return { ok: false, reason: `Potřebuješ ${need.name} (stupeň ${TIER_LABEL[need.tier]}) nebo lepší.` };
  }
  if (deposit.tool && !hasTool(state, deposit.tool)) {
    return { ok: false, reason: `Potřebuješ nástroj: ${toolName(deposit.tool)}.` };
  }
  if (hidden) {
    if (!hasTool(state, 'tool_support')) return { ok: false, reason: 'Skrytou žílu otevře jen Důlní podpěra s kovovým hrotem.' };
    return { ok: true, reason: '' };
  }
  const status = depositStatus(state, deposit, now);
  if (!status.ready) return { ok: false, reason: `Naleziště je vytěžené – obnoví se za ${formatWait(status.until - now)}.` };
  return { ok: true, reason: '' };
}

const TOOL_NAMES = {
  tool_crystal_tongs: 'Kleště na krystaly', tool_safety_tongs: 'Ochranné důlní kleště',
  tool_astral_hammer: 'Kladivo na astrální kámen', tool_support: 'Důlní podpěra s kovovým hrotem'
};
const toolName = (id) => TOOL_NAMES[id] ?? id;

// ------------------------------------------------------------ výpočty

const tiersAbove = (state, deposit) => Math.max(0, (bestPickaxe(state)?.tier ?? deposit.tier) - deposit.tier);
const isOre = (deposit) => deposit.category === 'ore';
const isGemlike = (deposit) => GEMLIKE.has(deposit.category);

// Doba těžby v sekundách.
export function miningSeconds(state, deposit) {
  let seconds = deposit.special ? MINING_RULES.specialSeconds : MINING_RARITY[deposit.rarity].seconds;
  seconds *= 1 - 0.1 * tiersAbove(state, deposit);
  if (!deposit.special && (isOre(deposit) || deposit.main === 'coal') && hasTool(state, 'tool_ore_hammer')) seconds *= 0.85;
  if (specialization(state) === 'deep' && !deposit.special && deposit.tier >= 3 && !isGemlike(deposit)) seconds *= 0.8;
  seconds *= exploreBonus(state, 'mineTime', 1); // Horníkův lektvar
  return Math.max(MINING_RULES.minSeconds, seconds);
}

// Šance na +1 kus hlavní suroviny (0–0,6).
export function extraChance(state, deposit) {
  let chance = 0.1 * tiersAbove(state, deposit) + Math.min(0.25, getTalentBonuses(state).miningBonusChance ?? 0);
  if (isOre(deposit) && hasTool(state, 'tool_wedge')) chance += 0.1;
  if (isGemlike(deposit) && hasTool(state, 'tool_crystal_tongs')) chance += 0.1;
  if (deposit.type === 'deep' && hasTool(state, 'tool_drill')) chance += 0.15;
  if ((deposit.special === 'runic' || ASTRAL.has(deposit.main)) && hasTool(state, 'tool_astral_hammer')) chance += 0.1;
  if (!deposit.special) {
    if (specialization(state) === 'deep' && isOre(deposit)) chance += 0.25;
    if (specialization(state) === 'gems' && isGemlike(deposit)) chance += 0.25;
  }
  return Math.min(MINING_RULES.extraCap, chance);
}

// Rozsah výtěžnosti hlavní suroviny [min, max].
export function yieldRange(state, deposit) {
  const [min, max] = MINING_RARITY[deposit.rarity].yield;
  const bonus = (deposit.rarity === 'common' || deposit.rarity === 'uncommon') && miningLevel(state) >= deposit.minLevel + MINING_RULES.bonusYieldOver ? 1 : 0;
  return [min, max + bonus];
}

// Šance na vedlejší nález (běžná naleziště).
export function sideChance(state, deposit) {
  const over = Math.max(0, miningLevel(state) - deposit.minLevel);
  let chance = Math.min(MINING_RULES.sideCap, MINING_RULES.sideBase + MINING_RULES.sidePerLevel * over);
  if (hasTool(state, 'tool_chisel')) chance += 0.05;
  if (specialization(state) === 'deep' && isOre(deposit)) chance += 0.05;
  return chance;
}

// Vedlejší suroviny, které hráč může najít (jen do své úrovně).
export const availableSides = (state, deposit) =>
  (deposit.sides ?? []).filter((id) => (MINING_MATERIAL_BY_ID[id]?.level ?? 1) <= miningLevel(state));

// Tabulka speciálního naleziště po vyřazení surovin nad úroveň hráče (v %, součet 100).
export function specialTable(state, deposit) {
  const level = miningLevel(state);
  const rows = Object.entries(deposit.table)
    .filter(([id]) => (MINING_MATERIAL_BY_ID[id]?.level ?? 1) <= level)
    .map(([id, weight]) => ({ id, weight: weight * (deposit.special === 'geode' && id === 'mat_kristalove_jadro' && specialization(state) === 'gems' ? 1.5 : 1) }));
  const total = rows.reduce((sum, row) => sum + row.weight, 0) || 1;
  for (const row of rows) row.percent = (row.weight / total) * 100;
  return rows;
}

export function specialDraws(state, deposit) {
  let draws = deposit.draws;
  if (deposit.special === 'geode' && specialization(state) === 'gems') draws += 1;
  if (specialization(state) === 'explorer') draws += 1;
  return draws;
}

const rareMultiplier = (state) => (specialization(state) === 'explorer' ? 2 : 1);

// Vzácné nálezy, které na nalezišti můžou padnout: [{ id, chance }].
export function rareFindChances(state, deposit, { hidden = false } = {}) {
  const list = [];
  const mult = rareMultiplier(state);
  if (deposit.minLevel >= 20 && !hidden) list.push({ id: 'ancient_mine_map', chance: 0.005 * mult });
  if (MINES.has(deposit.type)) list.push({ id: 'miner_chest', chance: 0.003 * mult });
  if (deposit.type === 'deep') list.push({ id: 'mine_relic', chance: 0.01 * (hasTool(state, 'tool_drill') ? 2 : 1) * mult });
  if (deposit.rareFind) {
    const gemBoost = deposit.rareFind.id === 'uncut_gem' && specialization(state) === 'gems' ? 1.5 : 1;
    list.push({ id: deposit.rareFind.id, chance: deposit.rareFind.chance * gemBoost * mult });
  }
  return list;
}

export function miningXp(state, deposit, { hidden = false } = {}) {
  const level = miningLevel(state);
  let xp = (15 + 4 * deposit.minLevel) * (deposit.special ? MINING_RULES.specialXp : MINING_RARITY[deposit.rarity].xp);
  if (hidden) xp *= MINING_RULES.hiddenXp;
  if (!(state.mining.log[deposit.id] > 0)) xp *= 2;
  const over = level - deposit.minLevel;
  if (over >= 40) xp *= 0.2;
  else if (over >= 20) xp *= 0.5;
  if (specialization(state) === 'deep' && MINES.has(deposit.type)) xp *= 1.1;
  return Math.max(1, Math.round(xp * professionXpMultiplier(state)));
}

const roll = (random, min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (random, list) => list[Math.floor(random() * list.length)];

function pickWeighted(rows, random) {
  let value = random() * 100;
  for (const row of rows) {
    value -= row.percent;
    if (value <= 0) return row.id;
  }
  return rows[rows.length - 1]?.id ?? null;
}

// Vytěží naleziště: spočítá kořist, zapíše obnovu a přidá zkušenosti.
// Vrací { ok, reason } nebo { ok, items: [{ id, qty }], xp, levelsGained, level, rare: [ids], revealedHidden }.
export function mineDeposit(state, deposit, { hidden = false, random = Math.random, now = Date.now(), region = 'Greenvale' } = {}) {
  normalizeMining(state);
  const check = checkDeposit(state, deposit, { hidden, now });
  if (!check.ok) return check;

  const loot = new Map();
  const add = (id, qty = 1) => id && loot.set(id, (loot.get(id) ?? 0) + qty);

  if (deposit.special) {
    const rows = specialTable(state, deposit);
    for (let i = 0; i < specialDraws(state, deposit); i++) add(pickWeighted(rows, random));
  } else {
    const [min, max] = yieldRange(state, deposit);
    const rolls = hidden ? 2 : 1;
    for (let i = 0; i < rolls; i++) {
      add(deposit.main, roll(random, min, max) + (random() < extraChance(state, deposit) ? 1 : 0));
    }
    const sides = availableSides(state, deposit);
    if (sides.length && (hidden || random() < sideChance(state, deposit))) add(pick(random, sides));
    // Hledač drahokamů: u rudných žil 3 % na drahokam (přednostně z regionu naleziště).
    if (specialization(state) === 'gems' && isOre(deposit) && random() < 0.03) {
      const gems = Object.values(MINING_MATERIAL_BY_ID).filter((m) => m.category === 'gem' && m.level <= miningLevel(state));
      const local = gems.filter((m) => DEPOSITS.some((d) => d.main === m.id && d.region === deposit.region));
      const pool = local.length ? local : gems;
      if (pool.length) add(pick(random, pool).id);
    }
  }

  const rare = [];
  for (const find of rareFindChances(state, deposit, { hidden })) {
    if (random() < find.chance) {
      rare.push(find.id);
      add(find.id);
    }
  }

  const xp = miningXp(state, deposit, { hidden });
  state.mining.log[deposit.id] = (state.mining.log[deposit.id] ?? 0) + 1;

  if (hidden) {
    removeItem(state, 'tool_support', 1);
    state.mining.hidden = null;
  } else if (deposit.special === 'meteor') {
    state.mining.meteor.mined = true;
  } else {
    const respawn = deposit.respawnMs * (deposit.special && specialization(state) === 'explorer' ? 0.75 : 1);
    state.mining.depleted[deposit.id] = now + respawn;
  }

  // Průzkumník nalezišť: 3 % odhalit Skrytou žílu i bez mapy.
  let revealedHidden = null;
  if (!hidden && specialization(state) === 'explorer' && !activeHidden(state, now) && random() < 0.03) {
    revealedHidden = revealHiddenVein(state, region, now);
  }

  const levelsGained = addMiningXp(state, xp);
  return {
    ok: true,
    items: [...loot.entries()].map(([id, qty]) => ({ id, qty })),
    xp,
    levelsGained,
    level: state.professions.mining.level,
    rare,
    revealedHidden
  };
}

export function addMiningXp(state, amount) {
  const prof = state.professions.mining;
  prof.exp += amount;
  let gained = 0;
  while (prof.level < MINING_RULES.maxLevel && prof.exp >= xpToNextMiningLevel(prof.level)) {
    prof.exp -= xpToNextMiningLevel(prof.level);
    prof.level += 1;
    gained += 1;
  }
  if (prof.level >= MINING_RULES.maxLevel) prof.exp = 0;
  prof.next = xpToNextMiningLevel(prof.level);
  return gained;
}

// ------------------------------------------------------------ Skrytá žíla

export function activeHidden(state, now = Date.now()) {
  const hidden = normalizeMining(state).hidden;
  if (!hidden) return null;
  if (hidden.until <= now) {
    state.mining.hidden = null;
    return null;
  }
  return hidden;
}

// Odhalí Skrytou žílu: nejlepší běžné naleziště, které hráč zvládne (úroveň a krumpáč).
export function revealHiddenVein(state, region = 'Greenvale', now = Date.now()) {
  const level = miningLevel(state);
  const tier = bestPickaxe(state)?.tier ?? 1;
  const best = DEPOSITS.filter((d) => d.minLevel <= level && d.tier <= tier).sort((a, b) => b.minLevel - a.minLevel)[0] ?? DEPOSITS[0];
  state.mining.hidden = { region, deposit: best.id, until: now + MINING_RULES.hiddenMinutes * 60000 };
  return state.mining.hidden;
}

// Použití Starodávné důlní mapy z inventáře.
export function useMiningMap(state, now = Date.now()) {
  normalizeMining(state);
  if (activeHidden(state, now)) return { ok: false, message: 'Jednu Skrytou žílu už máš odhalenou – nejdřív ji vytěž.' };
  const hidden = revealHiddenVein(state, state.region || 'Greenvale', now);
  return { ok: true, message: `Mapa odhalila Skrytou žílu (${depositById(hidden.deposit).name}) v regionu ${hidden.region} na 30 min. Otevře ji Důlní podpěra.` };
}

// Zapomenutá truhla horníka: rudy podle úrovně Těžby a 20–60 zl (přímo do inventáře).
export function openMinerChest(state, random = Math.random) {
  normalizeMining(state);
  const level = miningLevel(state);
  const ores = DEPOSITS.filter((d) => d.category === 'ore' && d.minLevel <= level).map((d) => d.main);
  const ore = ores.length ? pick(random, ores) : 'copper_ore';
  const qty = roll(random, 3, 6);
  const left = addItem(state, ore, qty);
  const gold = roll(random, 20, 60);
  state.gold = (Math.floor(Number(state.gold) || 0)) + gold;
  const name = MINING_MATERIAL_BY_ID[ore]?.name ?? ore;
  return { ok: true, message: `Truhla horníka: ${name} ×${qty - left}, ${gold} zl${left ? ` (${left} ks se nevešlo)` : ''}.` };
}

// ------------------------------------------------------------ specializace

export function chooseSpecialization(state, id) {
  normalizeMining(state);
  const spec = MINING_SPECIALIZATIONS.find((s) => s.id === id);
  if (!spec) return { ok: false, message: 'Neznámá specializace.' };
  if (miningLevel(state) < MINING_RULES.specializationLevel) return { ok: false, message: `Specializace se odemkne na Těžbě ${MINING_RULES.specializationLevel}.` };
  if (state.mining.specialization === id) return { ok: false, message: `${spec.name} už je tvoje specializace.` };
  const cost = state.mining.specialization ? MINING_RULES.specializationChangeCost : 0;
  const gold = Math.floor(Number(state.gold) || 0);
  if (gold < cost) return { ok: false, message: `Změna specializace stojí ${cost} zl.` };
  state.gold = gold - cost;
  state.mining.specialization = id;
  state.mining.specChanges += cost ? 1 : 0;
  return { ok: true, message: `Specializace Těžby: ${spec.name}${cost ? ` (−${cost} zl)` : ''}.` };
}

export const allDeposits = () => DEPOSITS;
