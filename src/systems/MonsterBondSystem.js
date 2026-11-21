import { learnBondSkill } from './MonsterSkillSystem.js';

const BOND_LEVELS = [
  { minimum: 0, name: 'Cizinec' },
  { minimum: 20, name: 'Známý' },
  { minimum: 40, name: 'Přítel' },
  { minimum: 60, name: 'Věrný' },
  { minimum: 80, name: 'Oddaný' },
  { minimum: 100, name: 'Soulbound' }
];

export function getBondLevel(value) {
  const bond = Math.max(0, Math.min(100, Number(value) || 0));

  for (let index = BOND_LEVELS.length - 1; index >= 0; index--) {
    if (bond >= BOND_LEVELS[index].minimum) {
      return BOND_LEVELS[index].name;
    }
  }

  return BOND_LEVELS[0].name;
}

export function changeMonsterBond(monster, amount, reason = '') {
  if (!monster) {
    return {
      oldValue: 0,
      newValue: 0,
      levelUp: false,
      bondSkillResult: null
    };
  }

  const oldValue = Math.max(0, Math.min(100, Number(monster.bond) || 0));
  const oldLevel = getBondLevel(oldValue);

  monster.bond = Math.max(
    0,
    Math.min(100, oldValue + Math.floor(amount))
  );

  const newLevel = getBondLevel(monster.bond);

  monster.history ??= [];

  if (monster.bond !== oldValue && reason) {
    monster.history.push(
      `${reason}: důvěra ${oldValue} → ${monster.bond}.`
    );

    if (monster.history.length > 50) {
      monster.history.shift();
    }
  }

  let bondSkillResult = null;

  if (oldValue < 100 && monster.bond >= 100) {
    bondSkillResult = learnBondSkill(monster);
  }

  return {
    oldValue,
    newValue: monster.bond,
    oldLevel,
    newLevel,
    levelUp: oldLevel !== newLevel,
    bondSkillResult
  };
}

export function rewardBondForVictory(monster) {
  return changeMonsterBond(
    monster,
    2,
    'Společné vítězství po boku svého lovce'
);
}

export function getMonsterBondBonuses(monster) {
  const bond = Math.max(
    0,
    Math.min(100, Number(monster?.bond) || 0)
  );

  return {
    attack: Math.floor(bond / 20),
    defense: Math.floor(bond / 40),
    speed: bond >= 80 ? 1 : 0
  };
}
