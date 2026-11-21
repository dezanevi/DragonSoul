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
    investments
  };

  return state.talentProgress;
}
