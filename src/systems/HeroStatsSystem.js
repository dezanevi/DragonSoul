import { mealMoveBonus } from './CookingSystem.js';
import { exploreBonus } from './AlchemySystem.js';
import { getItem } from '../data/items.js';
import { mealBuff } from './CookingSystem.js';
import { elixirBuff } from './AlchemySystem.js';
// Rychlost, Štěstí a Charisma hrdiny.
//
// Nový hrdina má všechny tři na 1. S úrovní nerostou – zvyšují je vybavené předměty,
// úkoly, obchod a rozhovory (ty systémy zatím nejsou) a u Rychlosti navíc pasivní
// bonus některých monster v aktivní partě.
//
// Výchozí pravidla (doladí se při balancování, viz dokument Hrdina):
//   Rychlost  – každý bod nad 1 = +2 % rychlosti chůze po mapě, nejvýš +50 %.
//   Štěstí    – každý bod nad 1 = +0,5 % šance na vzácné monstrum, nejvýš +15 %.
//   Charisma  – každý bod nad 1 = 1 % sleva u obchodníků, nejvýš 25 %.

export const HERO_ATTRIBUTE_DEFAULTS = Object.freeze({
  speed: 1,
  luck: 1,
  charisma: 1
});

// Monstra, která v aktivní partě dávají hrdinovi bonus k Rychlosti (druh → body).
// Zatím prázdné – doplní se při návrhu monster. Bonus jde zadat i přímo
// u konkrétního monstra jako monster.heroSpeedBonus.
export const HERO_SPEED_BONUS_BY_SPECIES = Object.freeze({});

const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Doplní chybějící hodnoty (starší uložené hry je nemají).
export function normalizeHeroAttributes(state) {
  if (!state) return state;
  for (const [stat, value] of Object.entries(HERO_ATTRIBUTE_DEFAULTS)) {
    state[stat] = Math.max(1, number(state[stat], value));
  }
  return state;
}

// Bonus k Rychlosti od monster v aktivní partě (omdlelá se nepočítají).
export function getPartySpeedBonus(state) {
  return (state?.party ?? [])
    .filter((monster) => (monster.currentHp ?? 1) > 0)
    .reduce(
      (sum, monster) =>
        sum + number(monster.heroSpeedBonus, HERO_SPEED_BONUS_BY_SPECIES[monster.speciesId] ?? 0),
      0
    );
}

// Celková Rychlost = základ hrdiny (+ předměty) + pasivní bonus party.
export function getHeroSpeed(state) {
  return number(state?.speed, HERO_ATTRIBUTE_DEFAULTS.speed) + getPartySpeedBonus(state);
}

// Štěstí a Charisma: nový výpočet (předměty, posílení, úroveň Charismatu) – heroLuck / heroCharisma níže.
export const getHeroLuck = (state) => heroLuck(state);
export const getHeroCharisma = (state) => heroCharisma(state);

// Násobek rychlosti chůze po mapě (1 = základ).
export function getMovementMultiplier(state) {
  // + cestovní bonus z jídla (Vaření).
  return 1 + Math.min(0.5, Math.max(0, getHeroSpeed(state) - 1) * 0.02) + mealMoveBonus(state) + exploreBonus(state, 'move') / 100;
}

// Přídavná šance na vzácné monstrum a sleva u obchodníků (nová pravidla níže).
export const getRareEncounterBonus = (state) => luckRareBonus(state);
export const getShopDiscount = (state) => 1 - npcBuyMultiplier(state);

// ============================================================ Štěstí a Charisma (nová pravidla)
// Štěstí a Charisma hrdiny.
//
// Charisma: vlastní úroveň 1–15 s XP (roste s Diplomacií – rozhovory, obchod, úkoly; 15. úrovně
//           dosáhne přesně s Diplomacií 100) + body
//           z amuletů a prstenů + dočasné posílení z jídla a lektvarů.
// Štěstí:   jen z amuletů a prstenů a z jídla a lektvarů (bez XP).
// Obě hodnoty celkem nejvýš 20 bodů.
//
// Stav: state.charismaProgress = { level, exp, next } (state.luck / state.charisma jsou starší
//       základní hodnoty hrdiny – už se nepoužívají, Štěstí a Charisma se počítají níže).
//
// Účinky (za bod):
//   Štěstí   – kritický zásah +1 % (základ 5 %, ×1,5 poškození), kořist z monster +2,5 %,
//              kus navíc při sběru, těžbě a rybolovu +0,5 %, vzácné monstrum +0,5 %.
//   Charisma – nákup u NPC −1 %, výkup +1 %, vlastní obchod: zákazníci a šance na prodej +1,5 %,
//              ochočení +0,5 %.

export const HERO_STAT_MAX = 20;
export const CHARISMA_MAX_LEVEL = 15; // zbytek do 20 bodů dorovnají předměty a posílení
// Každé XP Diplomacie jde i do Charismatu. Vlastní křivka (∝ úroveň^1,5) je spočítaná tak, aby
// součet XP do 15. úrovně Charismatu = součet XP do Diplomacie 100.
export const CHARISMA_XP_SHARE = 1;
// Křivka Diplomacie (data/diplomacy.js: max 100, 20 × úroveň^1,5) – opsaná, import by tvořil kruhovou
// závislost (data/diplomacy → items → obchody → košík → tento soubor).
const DIPLOMACY_TOTAL_XP = Array.from({ length: 99 }, (_, i) => Math.round(20 * (i + 1) ** 1.5)).reduce((a, b) => a + b, 0);
const CURVE_SUM = Array.from({ length: CHARISMA_MAX_LEVEL - 1 }, (_, i) => (i + 1) ** 1.5).reduce((a, b) => a + b, 0);
const CHARISMA_K = (DIPLOMACY_TOTAL_XP * CHARISMA_XP_SHARE) / CURVE_SUM;
export const xpToNextCharismaLevel = (level) => Math.round(CHARISMA_K * Math.max(1, level) ** 1.5);

export const BASE_CRIT_CHANCE = 0.05;
export const CRIT_MULTIPLIER = 1.5;

export function normalizeCharisma(state) {
  const c = (state.charismaProgress ??= { level: 1, exp: 0 });
  c.level = Math.min(CHARISMA_MAX_LEVEL, Math.max(1, Math.floor(Number(c.level) || 1)));
  c.exp = Math.max(0, Number(c.exp) || 0);
  c.next = xpToNextCharismaLevel(c.level);
  return c;
}

export function addCharismaXp(state, amount) {
  const c = normalizeCharisma(state);
  const gained = Math.max(0, Math.round(amount));
  if (!gained || c.level >= CHARISMA_MAX_LEVEL) return { gained: 0, levelUps: 0, level: c.level };
  c.exp += gained;
  let levelUps = 0;
  while (c.level < CHARISMA_MAX_LEVEL && c.exp >= xpToNextCharismaLevel(c.level)) {
    c.exp -= xpToNextCharismaLevel(c.level);
    c.level += 1;
    levelUps += 1;
  }
  if (c.level >= CHARISMA_MAX_LEVEL) c.exp = 0;
  c.next = xpToNextCharismaLevel(c.level);
  return { gained, levelUps, level: c.level };
}

// Body z nasazené výbavy (gear.bonus.luck / .charisma – ploché body, ne %).
export function gearHeroStat(state, stat) {
  let total = 0;
  for (const equipped of Object.values(state?.equipment ?? {})) {
    total += Number(getItem(equipped?.id)?.gear?.bonus?.[stat]) || 0;
  }
  return total;
}

// Rozpis zdrojů (karta Hrdiny): [{ label, value }].
export function heroStatSources(state, stat) {
  const rows = [];
  if (stat === 'charisma') rows.push({ label: `Úroveň ${normalizeCharisma(state).level}`, value: normalizeCharisma(state).level });
  for (const equipped of Object.values(state?.equipment ?? {})) {
    const item = getItem(equipped?.id);
    const v = Number(item?.gear?.bonus?.[stat]) || 0;
    if (v) rows.push({ label: item.name, value: v });
  }
  const meal = mealBuff(state, stat);
  if (meal) rows.push({ label: state.meal?.name ?? 'Jídlo', value: meal });
  const elixir = elixirBuff(state, stat);
  if (elixir) rows.push({ label: state.elixir?.name ?? 'Elixír', value: elixir });
  return rows;
}

const buffs = (state, stat) => mealBuff(state, stat) + elixirBuff(state, stat);

export function heroLuck(state) {
  return Math.min(HERO_STAT_MAX, Math.max(0, gearHeroStat(state, 'luck') + buffs(state, 'luck')));
}

export function heroCharisma(state) {
  const level = normalizeCharisma(state).level; // úroveň = body (15. úroveň = 15)
  return Math.min(HERO_STAT_MAX, Math.max(0, level + gearHeroStat(state, 'charisma') + buffs(state, 'charisma')));
}

// ------------------------------------------------------------ Štěstí
export const critChance = (state) => BASE_CRIT_CHANCE + heroLuck(state) * 0.01;
export const lootMultiplier = (state) => 1 + heroLuck(state) * 0.025;
export const luckGatherBonus = (state) => heroLuck(state) * 0.005;
export const luckRareBonus = (state) => heroLuck(state) * 0.005;

// ------------------------------------------------------------ Charisma
export const npcBuyMultiplier = (state) => 1 - heroCharisma(state) * 0.01;
export const npcSellMultiplier = (state) => 1 + heroCharisma(state) * 0.01;
export const ownShopMultiplier = (state) => 1 + heroCharisma(state) * 0.015;
export const charismaTameBonus = (state) => heroCharisma(state) * 0.005;

// Cena u NPC po Charismatu (nákup vždy aspoň 1 zlatý, výkup se zaokrouhlí).
export const npcBuyPrice = (state, price) => Math.max(1, Math.round(price * npcBuyMultiplier(state)));
export const npcSellPrice = (state, price) => (price > 0 ? Math.max(1, Math.round(price * npcSellMultiplier(state))) : 0);
