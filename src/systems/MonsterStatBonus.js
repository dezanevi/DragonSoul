// ======================================================================
// Bonusy statistik monstra v souboji (stejný výpočet jako BattleScene.createPartyUnits):
//   velitelský bonus (statistiky hrdiny / 5 + talenty Souboje), důvěra (Bond), talent
//   Vůdce smečky, jídlo + elixír (strop STAT_STACK_CAP %) a výbava + výztuha (Kovářství).
// Karta Party ukazuje zeleně „+N“ = o kolik je statistika v souboji vyšší než základ.
// ======================================================================

import { mealBuff } from './CookingSystem.js';
import { elixirBuff, STAT_STACK_CAP } from './AlchemySystem.js';
import { gearBonus } from './SmithingSystem.js';
import { getMonsterBondBonuses } from './MonsterBondSystem.js';
import { getTalentBonuses } from './TalentSystem.js';

// Statistika monstra → klíč bonusu v souboji (jídlo, elixír, výbava).
const BATTLE_STAT = { vitality: 'maxHp', force: 'attack', armor: 'defense', aether: 'aether', resolve: 'resolve', tempo: 'speed' };

// { stat: { base, value, bonus, parts: [text] } } pro statistiky s bonusem v souboji.
export function monsterStatBonuses(state, monster) {
  const stats = monster?.stats ?? {};
  const talents = getTalentBonuses(state);
  const bond = getMonsterBondBonuses(monster);
  const commander = {
    force: Math.floor(Math.max(0, Number(state.attack) || 0) / 5) + (talents.commanderAttack ?? 0),
    aether: Math.floor(Math.max(0, Number(state.magicAttack) || 0) / 5) + (talents.commanderMagicAttack ?? 0),
    armor: Math.floor(Math.max(0, Number(state.defense) || 0) / 5) + (talents.commanderDefense ?? 0),
    resolve: Math.floor(Math.max(0, Number(state.magicResistance) || 0) / 5) + (talents.commanderMagicResistance ?? 0)
  };
  const flat = {
    vitality: [],
    force: [['velitel', commander.force], ['důvěra', bond.attack]],
    armor: [['velitel', commander.armor], ['důvěra', bond.defense]],
    aether: [['velitel', commander.aether]],
    resolve: [['velitel', commander.resolve]],
    tempo: [['důvěra', bond.speed], ['Vůdce smečky', talents.monsterTempo ?? 0]]
  };
  const result = {};
  for (const [stat, key] of Object.entries(BATTLE_STAT)) {
    const base = Number(stats[stat]) || 0;
    const parts = flat[stat].filter(([, v]) => v > 0);
    const withFlat = base + parts.reduce((s, [, v]) => s + v, 0);
    const consumable = Math.min(STAT_STACK_CAP, mealBuff(state, key) + elixirBuff(state, key));
    const gear = gearBonus(state, key);
    const multiplier = (1 + consumable / 100) * (1 + gear / 100);
    const value = multiplier > 1 ? Math.ceil(withFlat * multiplier - 1e-9) : Math.round(withFlat * multiplier);
    const texts = parts.map(([label, v]) => `${label} +${v}`);
    if (consumable > 0) texts.push(`jídlo / elixír +${consumable} %`);
    if (gear > 0) texts.push(`výbava hrdiny +${gear} %`);
    result[stat] = { base, value, bonus: value - base, parts: texts };
  }
  return result;
}
