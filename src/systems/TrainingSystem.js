import {
  calculateStats,
  getMonsterSpecies
} from './MonsterSystem.js';

const STAT_NAMES = [
  'vitality',
  'force',
  'armor',
  'aether',
  'resolve',
  'tempo',
  'precision'
];

const MAX_PER_STAT = 255;
const MAX_TOTAL = 510;

export function getTotalTrainingPoints(monster) {
  if (!monster?.trainingPoints) return 0;

  return STAT_NAMES.reduce(
    (total, stat) =>
      total + (Number(monster.trainingPoints[stat]) || 0),
    0
  );
}

export function addTrainingPoints(monster, stat, amount = 1) {
  if (!monster || !STAT_NAMES.includes(stat)) {
    return { added: 0, total: getTotalTrainingPoints(monster) };
  }

  monster.trainingPoints ??= {};

  for (const name of STAT_NAMES) {
    monster.trainingPoints[name] ??= 0;
  }

  const requested = Math.max(0, Math.floor(Number(amount) || 0));
  const currentForStat = monster.trainingPoints[stat];
  const currentTotal = getTotalTrainingPoints(monster);

  const allowed = Math.max(
    0,
    Math.min(
      requested,
      MAX_PER_STAT - currentForStat,
      MAX_TOTAL - currentTotal
    )
  );

  if (allowed === 0) {
    return { added: 0, total: currentTotal };
  }

  const species = getMonsterSpecies(monster.speciesId);

  if (!species) {
    return { added: 0, total: currentTotal };
  }

  const oldMaxHp = Number(
    monster.stats?.vitality ?? monster.stats?.hp
  ) || 1;

  const oldCurrentHp = Number(monster.currentHp) || 0;

  monster.trainingPoints[stat] += allowed;

  monster.stats = calculateStats(
    species,
    monster.level,
    monster.geneticPotential,
    monster.trainingPoints
  );

  const hpIncrease = monster.stats.vitality - oldMaxHp;

  monster.currentHp =
    oldCurrentHp <= 0
      ? 0
      : Math.min(monster.stats.vitality, oldCurrentHp + hpIncrease);

  monster.history ??= [];
  monster.history.push(
    `Získalo ${allowed} tréninkový bod do statistiky ${stat}.`
  );

  if (monster.history.length > 50) {
    monster.history.shift();
  }

  return {
    added: allowed,
    total: getTotalTrainingPoints(monster)
  };
}
