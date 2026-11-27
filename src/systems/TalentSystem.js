import {
  TALENT_TREES as TREE_DATA,
  TALENT_TREE_BY_ID,
  TALENT_INDEX,
  TALENT_MAX_RANK,
  TREE_POINT_LIMIT,
  TIER_REQUIREMENTS
} from "../data/talents.js";
import { areTalentTreesUnlocked } from './QuestSystem.js';

export const TALENT_SPECIALIZATIONS = [
  { id: 'combat', name: 'Souboj' },
  { id: 'crafting', name: 'Řemesla' },
  { id: 'wizard', name: 'Kouzelník' }
];

const VALID_SPECIALIZATIONS = new Set(
  TALENT_SPECIALIZATIONS.map((entry) => entry.id)
);

const TALENT_TREES = ['combat', 'crafting', 'wizard'];

function safeInteger(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? Math.max(0, Math.floor(number))
    : fallback;
}

function createEmptyInvestments() {
  return {
    combat: {},
    crafting: {},
    wizard: {}
  };
}

export function createInitialTalentProgress(level = 1) {
  const safeLevel = Math.max(1, safeInteger(level, 1));
  const pointsEarned = Math.floor(safeLevel / 2);

  return {
    specialization: null,
    pointsEarned,
    pointsAvailable: pointsEarned,
    pointsSpent: 0,
    investments: createEmptyInvestments()
  };
}

export function normalizeTalentProgress(state) {
  if (!state) return null;

  const level = Math.max(1, safeInteger(state.level, 1));
  const progress =
    state.talentProgress &&
    typeof state.talentProgress === 'object'
      ? state.talentProgress
      : createInitialTalentProgress(level);

  const specialization = VALID_SPECIALIZATIONS.has(
    progress.specialization
  )
    ? progress.specialization
    : null;

  const investments = createEmptyInvestments();

  for (const tree of TALENT_TREES) {
    const savedTree = progress.investments?.[tree];

    if (!savedTree || typeof savedTree !== 'object') continue;

    for (const [talentId, rankValue] of Object.entries(savedTree)) {
      const rank = safeInteger(rankValue);

      if (rank > 0) {
        investments[tree][talentId] = rank;
      }
    }
  }

  const ranksInTrees = TALENT_TREES.reduce((total, tree) => {
    return total + Object.values(investments[tree]).reduce(
      (treeTotal, rank) => treeTotal + rank,
      0
    );
  }, 0);

  const pointsSpent = Math.max(
    safeInteger(progress.pointsSpent),
    ranksInTrees
  );

  const pointsAvailableSaved = safeInteger(progress.pointsAvailable);
  const pointsEarned = Math.max(
    Math.floor(level / 2),
    safeInteger(progress.pointsEarned),
    pointsSpent + pointsAvailableSaved
  );

  state.talentProgress = {
    specialization,
    pointsEarned,
    pointsSpent,
    pointsAvailable: Math.max(0, pointsEarned - pointsSpent),
    investments,
    // Škola zvolená talentem Elementární soustředění (Kouzelník III).
    focusSchool: typeof progress.focusSchool === "string" ? progress.focusSchool : null
  };

  return state.talentProgress;
}

// ======================================================================
// Talentové stromy: pravidla investování a souhrn účinků
// (návrh v dokumentu Talent tree; data v src/data/talents.js)
// ======================================================================

export const TALENTS_CHANGED = 'talents-changed';

// Specializaci (a tím talentové stromy) odemkne 4. úroveň hrdiny (QuestSystem.areTalentTreesUnlocked).
export function canChooseSpecialization(state) {
  const progress = normalizeTalentProgress(state);
  if (!progress) return { ok: false, reason: 'Chybí stav hry.' };
  if (progress.specialization) return { ok: false, reason: 'Specializace už je zvolená.' };
  if (!areTalentTreesUnlocked(state)) {
    return { ok: false, reason: 'Talentové stromy se odemknou na 4. úrovni hrdiny.' };
  }
  return { ok: true };
}

export function chooseSpecialization(state, treeId, events = null) {
  const check = canChooseSpecialization(state);
  if (!check.ok) return check;
  if (!TALENT_TREE_BY_ID[treeId]) return { ok: false, reason: 'Neznámý strom.' };

  state.talentProgress.specialization = treeId;

  // Řemeslník dostane hned základní recepty, aby pasivní bonus měl z čeho těžit.
  if (treeId === 'crafting') {
    state.knownRecipes ??= [];
    for (const recipe of ['basic_healing_potion', 'basic_mana_potion', 'basic_meal']) {
      if (!state.knownRecipes.includes(recipe)) state.knownRecipes.push(recipe);
    }
  }

  events?.emit(TALENTS_CHANGED, { type: 'specialization', treeId });
  return { ok: true };
}

export function getTalentRank(state, talentId) {
  const entry = TALENT_INDEX.get(talentId);
  if (!entry) return 0;
  return Number(state?.talentProgress?.investments?.[entry.tree.id]?.[talentId]) || 0;
}

export function getTreeInvestment(state, treeId) {
  return Object.values(state?.talentProgress?.investments?.[treeId] ?? {}).reduce(
    (sum, rank) => sum + (Number(rank) || 0),
    0
  );
}

export function isTreeComplete(state, treeId) {
  return getTreeInvestment(state, treeId) >= TREE_POINT_LIMIT;
}

export function isTierUnlocked(state, treeId, tierIndex) {
  return getTreeInvestment(state, treeId) >= TIER_REQUIREMENTS[tierIndex];
}

// Do jiného než hlavního stromu se smí investovat až po dokončení hlavního.
export function isTreeOpen(state, treeId) {
  const main = state?.talentProgress?.specialization;
  if (!main) return false;
  return treeId === main || isTreeComplete(state, main);
}

export function canInvestTalent(state, talentId) {
  const progress = normalizeTalentProgress(state);
  const entry = TALENT_INDEX.get(talentId);
  if (!progress || !entry) return { ok: false, reason: 'Neznámý talent.' };

  const { tree, tierIndex } = entry;
  if (!progress.specialization) return { ok: false, reason: 'Nejdřív zvol hlavní specializaci.' };
  if (!isTreeOpen(state, tree.id)) {
    return { ok: false, reason: 'Tento strom se otevře po dokončení hlavního stromu (30 bodů).' };
  }
  if (!isTierUnlocked(state, tree.id, tierIndex)) {
    return { ok: false, reason: `Stupeň se odemkne po ${TIER_REQUIREMENTS[tierIndex]} bodech v tomto stromu.` };
  }
  if (getTalentRank(state, talentId) >= TALENT_MAX_RANK) return { ok: false, reason: 'Talent má maximální hodnost.' };
  // 30 bodů strom dokončí (závěrečný talent, otevřou se ostatní stromy), další body jdou přidávat dál.
  if (progress.pointsAvailable <= 0) return { ok: false, reason: 'Nemáš volný talentový bod.' };
  return { ok: true };
}

// Přidá talentu jednu hodnost. options.school = škola pro Elementární soustředění.
export function investTalent(state, talentId, options = {}, events = null) {
  const check = canInvestTalent(state, talentId);
  if (!check.ok) return check;

  const { tree, talent } = TALENT_INDEX.get(talentId);
  const progress = state.talentProgress;

  if (talent.choosesSchool && !progress.focusSchool) {
    if (!options.school) return { ok: false, reason: 'Vyber školu magie.', needsSchool: true };
    progress.focusSchool = options.school;
  }

  const wasComplete = isTreeComplete(state, tree.id);
  progress.investments[tree.id][talentId] = getTalentRank(state, talentId) + 1;
  progress.pointsSpent += 1;
  progress.pointsAvailable = Math.max(0, progress.pointsEarned - progress.pointsSpent);

  // Rozšířená mana zvýší maximum i aktuální manu hned při koupi.
  if (talent.effect?.maxMana) {
    state.maxMp = (Number(state.maxMp) || 0) + talent.effect.maxMana;
    state.mp = Math.min(state.maxMp, (Number(state.mp) || 0) + talent.effect.maxMana);
  }

  const completed = !wasComplete && isTreeComplete(state, tree.id);
  events?.emit(TALENTS_CHANGED, { type: 'invest', talentId, completed });
  return { ok: true, completed, finalTalent: completed ? tree.final : null };
}

// Souhrn všech účinků talentů a pasivního bonusu specializace.
// Bonusy stejného typu se sčítají (procenta jako desetinná čísla).
// Recept za talent (kategorie Řemeslník): jen pro specializaci Řemeslník a od dané hodnosti
// talentu, nebo po dokončení stromu (req.final).
export const isCraftsmanSpecialization = (state) => state?.talentProgress?.specialization === 'crafting';
export function talentRecipeUnlocked(state, req) {
  if (!req || !isCraftsmanSpecialization(state)) return false;
  if (req.final) return isTreeComplete(state, req.final);
  return getTalentRank(state, req.id) >= (req.rank ?? 1);
}

export function getTalentBonuses(state) {
  const bonus = {
    commanderAttack: 0,
    commanderMagicAttack: 0,
    commanderDefense: 0,
    commanderMagicResistance: 0,
    monsterPhysicalDamage: 0,
    monsterMagicalDamage: 0,
    monsterPhysicalTaken: 0,
    monsterMagicalTaken: 0,
    statusChanceReduction: 0,
    elementalAdvantageBonus: 0,
    monsterTempo: 0,
    spellPower: 0,
    spellDamage: 0,
    focusSchoolDamage: 0,
    manaCostReduction: 0,
    masteryExpBonus: 0,
    otherSchoolsExpBonus: 0,
    fishingBonusChance: 0,
    miningBonusChance: 0,
    herbBonusChance: 0,
    materialCostReduction: 0,
    potionPotency: 0,
    foodDuration: 0,
    metalGearBonus: 0,
    nonMetalGearBonus: 0,
    focusSchool: state?.talentProgress?.focusSchool ?? null
  };
  const progress = state?.talentProgress;
  if (!progress) return bonus;

  const add = (effect, times) => {
    for (const [key, value] of Object.entries(effect ?? {})) {
      if (typeof bonus[key] === 'number') bonus[key] += value * times;
    }
  };

  for (const tree of TREE_DATA) {
    for (const tier of tree.tiers) {
      for (const talent of tier.talents) {
        if (talent.needsSystem) continue; // účinek čeká na chybějící systém
        add(talent.effect, getTalentRank(state, talent.id));
      }
    }
    if (isTreeComplete(state, tree.id) && !tree.final.needsSystem) add(tree.final.effect, 1);
  }

  // Jediný pasivní bonus = bonus hlavní specializace.
  if (progress.specialization === 'combat') {
    bonus.monsterPhysicalDamage += 0.05;
    bonus.monsterPhysicalTaken += 0.05;
  } else if (progress.specialization === 'wizard') {
    bonus.monsterMagicalDamage += 0.05;
    bonus.spellDamage += 0.05;
    bonus.monsterMagicalTaken += 0.05;
  }

  // Horní limity (doladí se při vyvažování).
  bonus.manaCostReduction = Math.min(0.1, bonus.manaCostReduction);
  bonus.statusChanceReduction = Math.min(0.3, bonus.statusChanceReduction);
  bonus.herbBonusChance = Math.min(0.25, bonus.herbBonusChance);
  bonus.materialCostReduction = Math.min(0.1, bonus.materialCostReduction);
  bonus.potionPotency = Math.min(0.1, bonus.potionPotency);
  bonus.foodDuration = Math.min(0.25, bonus.foodDuration);
  return bonus;
}

// Úsporné zpracování: kolik kusů suroviny se ušetří z amount (podíl talentu, zbytek náhodně),
// vždy se spotřebuje aspoň 1 kus.
export function materialSaving(state, amount, random = Math.random) {
  const r = getTalentBonuses(state).materialCostReduction;
  if (!r || amount <= 1) return 0;
  const exact = amount * r;
  const saved = Math.floor(exact) + (random() < exact - Math.floor(exact) ? 1 : 0);
  return Math.min(saved, amount - 1);
}

// Spell Power včetně talentů.
export function getEffectiveSpellPower(state) {
  return (Number(state?.magicPower) || 0) + getTalentBonuses(state).spellPower;
}

// Cena kouzla po slevě z talentů, nikdy pod 1 MP.
export function getSpellManaCost(state, spell) {
  const reduction = getTalentBonuses(state).manaCostReduction;
  return Math.max(1, Math.round((Number(spell?.manaCost) || 0) * (1 - reduction)));
}

// Násobek zkušeností školy magie z talentů.
export function getMasteryExpMultiplier(state, school) {
  const bonus = getTalentBonuses(state);
  const other = bonus.focusSchool && bonus.focusSchool !== school ? bonus.otherSchoolsExpBonus : 0;
  return 1 + bonus.masteryExpBonus + other;
}

// Násobek poškození hrdinova kouzla (pasivní bonus, Dračí arkanista, zvolená škola).
export function getSpellDamageMultiplier(state, school) {
  const bonus = getTalentBonuses(state);
  const focus = bonus.focusSchool === school ? bonus.focusSchoolDamage : 0;
  return 1 + bonus.spellDamage + focus;
}
