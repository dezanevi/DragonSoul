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

// Šest škol magie. Odemykají se postupně během hry: nový hrdina nemá žádnou, Air odemkne
// úkol Píseň větrů (Mág v Hvězdárně, Bard v hostinci).
export const MAGIC_SCHOOLS = ['air', 'water', 'fire', 'earth', 'light', 'dark'];
export const STARTING_SCHOOLS = [];
export const MAGIC_SCHOOL_UNLOCKED = 'magic-school-unlocked';

export function isMagicSchoolUnlocked(save, school) {
  return Boolean(save?.magicMastery?.[school]?.unlocked);
}

// Doplní příznak odemčení starším uloženým hrám: odemčená je startovní
// škola a každá, ve které už hrdina má mistrovství.
export function normalizeMagicSchools(save) {
  if (!save) return save;
  save.magicMastery ??= {};
  for (const school of MAGIC_SCHOOLS) {
    const mastery = (save.magicMastery[school] ??= { level: 0, exp: 0 });
    mastery.unlocked ??= STARTING_SCHOOLS.includes(school) || (Number(mastery.level) || 0) > 0;
  }
  return save;
}

// Odemkne školu (úkol, magický kámen, učitel…): dostane úroveň 1 a s ní
// kouzla první úrovně. Vrací seznam nově odemčených kouzel.
export function unlockMagicSchool(save, school, events = null) {
  if (!save || !MAGIC_SCHOOLS.includes(school)) return null;
  normalizeMagicSchools(save);
  save.spellbook ??= [];

  const mastery = save.magicMastery[school];
  if (mastery.unlocked) return { school, alreadyUnlocked: true, unlockedSpellIds: [] };

  mastery.unlocked = true;
  mastery.level = Math.max(1, Number(mastery.level) || 0);
  mastery.exp = Math.max(0, Number(mastery.exp) || 0);

  const unlockedSpellIds = unlockSpellsForMastery(save, school, mastery.level);
  events?.emit(MAGIC_SCHOOL_UNLOCKED, { school, unlockedSpellIds });
  return { school, alreadyUnlocked: false, unlockedSpellIds };
}

export function gainMagicExperience(save, school, amount = 5) {
  // Zamčená škola zkušenosti nezískává.
  if (save?.magicMastery?.[school]?.unlocked === false) {
    return {
      gained: 0,
      levelsGained: 0,
      level: 0,
      experience: 0,
      experienceToNext: 0,
      unlockedSpellIds: []
    };
  }

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
