import { mealMoveBonus } from './CookingSystem.js';
import { exploreBonus } from './AlchemySystem.js';
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

export function getHeroLuck(state) {
  return number(state?.luck, HERO_ATTRIBUTE_DEFAULTS.luck);
}

export function getHeroCharisma(state) {
  return number(state?.charisma, HERO_ATTRIBUTE_DEFAULTS.charisma);
}

// Násobek rychlosti chůze po mapě (1 = základ).
export function getMovementMultiplier(state) {
  // + cestovní bonus z jídla (Vaření).
  return 1 + Math.min(0.5, Math.max(0, getHeroSpeed(state) - 1) * 0.02) + mealMoveBonus(state) + exploreBonus(state, 'move') / 100;
}

// Přídavná šance (0–0,15), že náhodné setkání bude se vzácným monstrem.
export function getRareEncounterBonus(state) {
  return Math.min(0.15, Math.max(0, getHeroLuck(state) - 1) * 0.005);
}

// Sleva u obchodníků (0–0,25).
export function getShopDiscount(state) {
  return Math.min(0.25, Math.max(0, getHeroCharisma(state) - 1) * 0.01);
}
