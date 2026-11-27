import { normalizeTalentProgress } from './TalentSystem.js';

const HERO_STAT_DEFAULTS = {
  attack: 7,
  defense: 3,
  magicAttack: 7,
  magicResistance: 3,
  intellect: 5,
  magicPower: 0
};

export function normalizeHeroStats(state) {
  if (!state) return state;

  for (const [stat, defaultValue] of Object.entries(HERO_STAT_DEFAULTS)) {
    const value = Number(state[stat]);

    state[stat] = Number.isFinite(value)
      ? Math.max(0, value)
      : defaultValue;
  }

  return state;
}

export function applyHeroLevelUp(state) {
  if (!state) return;

  normalizeHeroStats(state);

  state.maxHp = (Number(state.maxHp) || 0) + 5;
  state.maxMp = (Number(state.maxMp) || 0) + 2;
  state.attack += 1;
  state.defense += 1;
  state.magicAttack += 1;
  state.magicResistance += 1;

  let extraManaFromIntellect = 0;

  // Každá pátá úroveň zvyšuje Intelekt, manu a Spell Power.
  if ((Number(state.level) || 1) % 5 === 0) {
    state.intellect += 1;
    state.maxMp += 1;
    state.magicPower += 1;
    extraManaFromIntellect = 1;
  }

  state.hp = Math.min(
    state.maxHp,
    (Number(state.hp) || 0) + 5
  );

  state.mp = Math.min(
    state.maxMp,
    (Number(state.mp) || 0) + 2 + extraManaFromIntellect
  );

  // Body se automaticky dopočítají z aktuální úrovně:
  // jedna za každou sudou úroveň.
  normalizeTalentProgress(state);
}

// Zkušenosti hrdiny mimo souboj (odměny úkolů): stejná křivka jako po souboji
// (úroveň × 20 na další úroveň). Vrací počet získaných úrovní.
export function addHeroExp(state, amount) {
  if (!state || !(amount > 0)) return 0;
  state.level = Math.max(1, Number(state.level) || 1);
  state.exp = (Number(state.exp) || 0) + Math.round(amount);
  let gained = 0;
  while (state.exp >= state.level * 20) {
    state.exp -= state.level * 20;
    state.level += 1;
    applyHeroLevelUp(state);
    gained += 1;
  }
  return gained;
}
