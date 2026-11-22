import speciesRows from '../data/monsters.json';
import {
  getSkill,
  getStarterSkillId,
  getSkillsLearnedAtLevel,
  learnSkill
} from './MonsterSkillSystem.js';

const GROWTH_TYPES = ['fast', 'mediumFast', 'mediumSlow', 'slow'];

const GROWTH_MULTIPLIER = {
  fast: 1.2,
  mediumFast: 1,
  mediumSlow: 0.9,
  slow: 0.8
};

const CAPTURE_RATES = {
  common: 0.42,
  uncommon: 0.29,
  rare: 0.16
};

const CRYSTAL_MULTIPLIERS = {
  basic: 1,
  greater: 1.35,
  elemental: 1.5,
  ancient: 1.8,
  dragonSoul: 2
};

const STAT_NAMES = [
  'vitality',
  'force',
  'armor',
  'aether',
  'resolve',
  'tempo',
  'precision'
];

const LEGACY_STAT_NAMES = {
  vitality: 'hp',
  force: 'attack',
  armor: 'defense',
  aether: 'specialAttack',
  resolve: 'specialDefense',
  tempo: 'speed'
};

const ELEMENT_STAT_MODIFIERS = Object.freeze({
  Fire: {
    force: 2,
    aether: 1,
    armor: -2,
    resolve: -1
  },
  Water: {
    vitality: 2,
    resolve: 1,
    tempo: -2,
    force: -1
  },
  Earth: {
    vitality: 2,
    armor: 2,
    tempo: -2,
    precision: -2
  },
  Air: {
    tempo: 2,
    precision: 2,
    vitality: -2,
    armor: -2
  },
  Verdant: {
    vitality: 2,
    resolve: 2,
    force: -2,
    tempo: -2
  },
  Dark: {
    force: 2,
    tempo: 2,
    vitality: -2,
    resolve: -2
  },
  Light: {
    aether: 2,
    resolve: 2,
    armor: -2,
    vitality: -2
  }
});

export const MONSTER_SPECIES = speciesRows.map((row, index) => {
  const baseStats = {
    vitality: 30 + ((index * 7) % 20),
    force: 6 + ((index * 3) % 8),
    armor: 4 + ((index * 5) % 8),
    aether: 5 + ((index * 4) % 9),
    resolve: 4 + ((index * 6) % 8),
    tempo: 5 + ((index * 2) % 10),
    precision: 72 + ((index * 7) % 19)
  };

  const modifiers = ELEMENT_STAT_MODIFIERS[row.element] ?? {};

  for (const [stat, modifier] of Object.entries(modifiers)) {
    baseStats[stat] = Math.max(1, baseStats[stat] + modifier);
  }

  return {
    ...row,
    growth: GROWTH_TYPES[index % GROWTH_TYPES.length],
    baseStats
  };
});

const SPECIES_BY_ID = new Map(
  MONSTER_SPECIES.map((species) => [species.id, species])
);


function randomInt(maxInclusive) {
  return Math.floor(Math.random() * (maxInclusive + 1));
}

function clampLevel(level) {
  const numericLevel = Number.isFinite(level) ? Math.floor(level) : 1;
  return Math.max(1, Math.min(100, numericLevel));
}

function experienceRequired(level, growth) {
  const multiplier = GROWTH_MULTIPLIER[growth] ?? 1;
  return Math.max(10, Math.floor((level + 1) * (level + 1) * multiplier));
}

function stablePotential(instanceId) {
  const text = String(instanceId ?? 'old-monster');

  let hash = 0;
  for (const character of text) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash % 16;
}

function normalizeIndividualValues(oldValues, instanceId, isTraining) {
  const result = {};

  for (const stat of STAT_NAMES) {
    const oldName = LEGACY_STAT_NAMES[stat];

    let value = oldValues?.[stat];

    if (!Number.isFinite(value) && oldName) {
      value = oldValues?.[oldName];
    }

    if (!Number.isFinite(value)) {
      value = stat === 'precision' ? stablePotential(instanceId) : 0;
    }

    const maximum = isTraining ? 255 : 15;
    result[stat] = Math.max(0, Math.min(maximum, Math.floor(value)));
  }

  return result;
}

function addCompatibilityStats(stats) {
  return {
    ...stats,

    // Dočasná zpětná kompatibilita pro části boje,
    // které převedeme na nové názvy v dalších krocích.
    hp: stats.vitality,
    attack: stats.force,
    defense: stats.armor,
    specialAttack: stats.aether,
    specialDefense: stats.resolve,
    speed: stats.tempo
  };
}

export function calculateStats(species, level, potential = {}, training = {}) {
  const safeLevel = clampLevel(level);
  const multiplier = GROWTH_MULTIPLIER[species.growth] ?? 1;
  const stats = {};

  for (const stat of STAT_NAMES) {
    const base = species.baseStats[stat];
    const geneBonus = Math.floor((potential[stat] ?? 0) / 3);
    const trainingValue = Number(training[stat]) || 0;

    let levelBonus;

    if (stat === 'vitality') {
      levelBonus = Math.floor((safeLevel - 1) * multiplier * 2);
    } else if (stat === 'precision') {
      levelBonus = Math.floor((safeLevel - 1) * multiplier * 0.12);
    } else {
      levelBonus = Math.floor((safeLevel - 1) * multiplier * 0.65);
    }

    // Každých 5 investovaných bodů přidá +1 do statistiky.
    const trainingBonus = Math.floor(trainingValue / 5);

    let value = base + levelBonus + geneBonus + trainingBonus;

    if (stat === 'precision') {
      value = Math.min(98, value);
    }

    stats[stat] = Math.max(1, value);
  }

  return addCompatibilityStats(stats);
}


export function getMonsterSpecies(speciesId) {
  return SPECIES_BY_ID.get(speciesId) ?? null;
}

/**
 * Převede starší uložené monstrum na nové statistiky.
 * Vrací true, pokud bylo potřeba monstrum převést.
 */
export function migrateMonsterStats(monster) {
  if (!monster || !monster.speciesId) return false;

  const species = getMonsterSpecies(monster.speciesId);
  if (!species) return false;

  // Element vždy převezmeme z aktuální databáze druhu.
  monster.element = species.element;

  if (
    monster.statsVersion === 4 &&
    Number.isFinite(monster.stats?.vitality)
  ) {
    return false;
  }

  const oldStats = monster.stats ?? {};
  const oldMaximumHp = Number(oldStats.vitality ?? oldStats.hp) || 1;
  const oldCurrentHp = Math.max(0, Number(monster.currentHp) || 0);
  const oldHpRatio = Math.max(0, Math.min(1, oldCurrentHp / oldMaximumHp));

  monster.geneticPotential = normalizeIndividualValues(
    monster.geneticPotential,
    monster.instanceId,
    false
  );

  monster.trainingPoints = normalizeIndividualValues(
    monster.trainingPoints,
    monster.instanceId,
    true
  );

  monster.stats = calculateStats(
    species,
    monster.level,
    monster.geneticPotential,
    monster.trainingPoints
  );

  monster.currentHp =
    oldCurrentHp <= 0
      ? 0
      : Math.max(1, Math.round(monster.stats.vitality * oldHpRatio));

  monster.growth = species.growth;
  monster.statsVersion = 4;
  monster.history ??= [];
  monster.history.push('Statistiky převedeny na nový systém.');

  return true;
}


export function createMonster(speciesId, level = 1) {
  const species = getMonsterSpecies(speciesId);

  if (!species) {
    throw new Error(`Neznámý druh monstra: ${speciesId}`);
  }

  const safeLevel = clampLevel(level);

  const instanceId =
    `monster-${Date.now().toString(36)}-` +
    Math.random().toString(36).slice(2, 8);

  const geneticPotential = Object.fromEntries(
    STAT_NAMES.map((stat) => [stat, randomInt(15)])
  );

  const trainingPoints = Object.fromEntries(
    STAT_NAMES.map((stat) => [stat, 0])
  );

  const stats = calculateStats(
    species,
    safeLevel,
    geneticPotential,
    trainingPoints
  );

  const starterSkillId = getStarterSkillId(species.id, species.element);
  const starterSkill = getSkill(starterSkillId);

  const monster = {
    instanceId,
    speciesId: species.id,
    name: species.name,
    element: species.element,
    level: safeLevel,
    experience: 0,
    growth: species.growth,
    stats,
    statsVersion: 4,
    currentHp: stats.vitality,
    geneticPotential,
    trainingPoints,
    unspentTrainingPoints: 0,
    skills: starterSkill ? [starterSkillId] : [],
    skillUses: starterSkill
      ? { [starterSkillId]: starterSkill.maxUses }
      : {},
    statusEffects: [],
    bond: 0,
    defeatedCount: 0,
    history: [`Získáno jako ${species.name}, úroveň ${safeLevel}.`]
  };

  for (const unlockLevel of [10, 20, 40, 80]) {
    if (safeLevel < unlockLevel) continue;

    const skillIds = getSkillsLearnedAtLevel(
      species.id,
      unlockLevel,
      species.element
    );

    for (const skillId of skillIds) {
      if (!monster.skills.includes(skillId)) {
        learnSkill(monster, skillId);
      }
    }
  }

  return monster;
}


export function experienceToNextLevel(monster) {
  if (monster.level >= 100) return 0;
  return experienceRequired(monster.level, monster.growth);
}

export function gainMonsterExperience(monster, amount) {
  if (!monster || monster.level >= 100) {
    return { levelsGained: 0, experienceToNext: 0 };
  }

  let levelsGained = 0;
  monster.experience += Math.max(0, Math.floor(amount));

  while (
    monster.level < 100 &&
    monster.experience >= experienceRequired(monster.level, monster.growth)
  ) {
    monster.experience -= experienceRequired(monster.level, monster.growth);
    monster.level += 1;
    levelsGained += 1;

    const oldMaxHp =
      Number(monster.stats?.vitality ?? monster.stats?.hp) || 1;

    const species = getMonsterSpecies(monster.speciesId);

    monster.stats = calculateStats(
      species,
      monster.level,
      monster.geneticPotential,
      monster.trainingPoints
    );

    const newMaxHp = monster.stats.vitality;

    monster.currentHp = Math.min(
      newMaxHp,
      monster.currentHp + (newMaxHp - oldMaxHp)
    );

    monster.history ??= [];
    monster.history.push(`Dosáhlo úrovně ${monster.level}.`);
  }

  return {
    levelsGained,
    experienceToNext: experienceToNextLevel(monster)
  };
}

export function captureChance(
  monster,
  crystalType = 'basic',
  statusEffect = null
) {
  const species = getMonsterSpecies(monster?.speciesId);
  if (!species) return 0;

  const baseRate = CAPTURE_RATES[species.rarity] ?? CAPTURE_RATES.common;
  const crystalMultiplier = CRYSTAL_MULTIPLIERS[crystalType] ?? 1;
  const maximumHp =
    Number(monster.stats?.vitality ?? monster.stats?.hp) || 1;
  const hpRatio = Math.max(0, monster.currentHp / maximumHp);
  const weakenedBonus = 1 + (1 - hpRatio) * 1.5;
  const statusBonus = statusEffect ? 0.15 : 0;

  return Math.max(
    0.03,
    Math.min(
      0.95,
      baseRate * crystalMultiplier * weakenedBonus + statusBonus
    )
  );
}

export function tryCaptureMonster(
  monster,
  crystalType = 'basic',
  statusEffect = null,
  random = Math.random()
) {
  const chance = captureChance(monster, crystalType, statusEffect);

  return {
    success: random < chance,
    chance
  };
}

export function addMonsterToCollection(save, monster) {
  save.party ??= [];
  save.monsterStorage ??= [];
  save.bestiary ??= {};

  if (save.party.length < 4) {
    save.party.push(monster);
  } else {
    save.monsterStorage.push(monster);
  }

  const record = save.bestiary[monster.speciesId] ?? {
    seen: 0,
    caught: 0,
    defeated: 0
  };

  record.caught += 1;
  save.bestiary[monster.speciesId] = record;

  monster.history ??= [];
  monster.history.push(
    save.party.includes(monster)
      ? 'Přidáno do aktivní party.'
      : 'Uloženo do monster storage.'
  );

  return save.party.includes(monster) ? 'party' : 'storage';
}
