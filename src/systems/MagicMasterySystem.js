import spellRows from '../data/spells.json';

const MAX_MASTERY_LEVEL = 4;

function experienceNeededForNextLevel(currentLevel) {
  return 20 * (currentLevel + 1);
}

function unlockSpellsForMastery(save, school, level) {
  save.spellbook ??= [];
  const unlockedSpellIds = [];

  for (const spell of spellRows) {
    const requiredLevel = Number(spell.requiredMastery) || 0;

    if (
      spell.school === school &&
      requiredLevel <= level &&
      !save.spellbook.includes(spell.id)
    ) {
      save.spellbook.push(spell.id);
      unlockedSpellIds.push(spell.id);
    }
  }

  return unlockedSpellIds;
}

export function gainMagicExperience(save, school, amount = 5) {
  if (!save || !school) {
    return {
      gained: 0,
      levelsGained: 0,
      level: 0,
      experience: 0,
      experienceToNext: 0,
      unlockedSpellIds: []
    };
  }

  save.magicMastery ??= {};
  save.spellbook ??= [];

  save.magicMastery[school] ??= {
    level: 0,
    exp: 0
  };

  const mastery = save.magicMastery[school];

  mastery.level = Math.max(
    0,
    Math.min(MAX_MASTERY_LEVEL, Number(mastery.level) || 0)
  );

  mastery.exp = Math.max(0, Number(mastery.exp) || 0);

  if (mastery.level >= MAX_MASTERY_LEVEL) {
    mastery.exp = 0;

    return {
      gained: 0,
      levelsGained: 0,
      level: mastery.level,
      experience: mastery.exp,
      experienceToNext: 0,
      unlockedSpellIds: []
    };
  }

  const gained = Math.max(0, Math.floor(Number(amount) || 0));
  mastery.exp += gained;

  let levelsGained = 0;

  while (mastery.level < MAX_MASTERY_LEVEL) {
    const needed = experienceNeededForNextLevel(mastery.level);

    if (mastery.exp < needed) break;

    mastery.exp -= needed;
    mastery.level += 1;
    levelsGained += 1;
  }

  if (mastery.level >= MAX_MASTERY_LEVEL) {
    mastery.exp = 0;
  }

  const unlockedSpellIds = unlockSpellsForMastery(
    save,
    school,
    mastery.level
  );

  const experienceToNext =
    mastery.level >= MAX_MASTERY_LEVEL
      ? 0
      : experienceNeededForNextLevel(mastery.level) - mastery.exp;

  return {
    gained,
    levelsGained,
    level: mastery.level,
    experience: mastery.exp,
    experienceToNext,
    unlockedSpellIds
  };
}
