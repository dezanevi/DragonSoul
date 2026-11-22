// ======================================================================
// Úkoly. Stav úkolu se odvozuje z příznaků v uložené hře (state.flags),
// takže starší uložené hry s loveckou zkouškou pokračují tam, kde byly.
// ======================================================================

export const QUEST_STATUS = {
  notStarted: 'notStarted',
  active: 'active', // úkol přijatý, cíl nesplněný
  ready: 'ready', // cíl splněný, vrátit se za zadavatelem
  done: 'done'
};

export const QUESTS = {
  greenvale_cave_slime: {
    id: 'greenvale_cave_slime',
    title: 'Jeskynní sliz',
    giver: 'Starosta Edric',
    description:
      'V jeskyni u Greenvale se usadil obří jeskynní sliz. Starosta chce, abys ho zabil.',
    objective: 'Zabij jeskynního slizu v jeskyni u Greenvale (E u vchodu do jeskyně).',
    returnTo: 'Vrať se za starostou Edricem na radnici.',
    reward: 'Odemčení talentových stromů (volba specializace) a cesta do Verdant Forest.',
    flags: {
      accepted: 'greenvaleHunterTrialAccepted',
      objective: 'greenvaleCaveBossDefeated',
      completed: 'greenvaleHunterPermitGranted'
    }
  }
};

export function getQuestStatus(state, questId) {
  const quest = QUESTS[questId];
  const flags = state?.flags ?? {};
  if (!quest) return QUEST_STATUS.notStarted;
  if (flags[quest.flags.completed]) return QUEST_STATUS.done;
  if (!flags[quest.flags.accepted]) return QUEST_STATUS.notStarted;
  return flags[quest.flags.objective] ? QUEST_STATUS.ready : QUEST_STATUS.active;
}

export function acceptQuest(state, questId) {
  const quest = QUESTS[questId];
  state.flags ??= {};
  state.flags[quest.flags.accepted] = true;
}

export function markQuestObjective(state, questId) {
  const quest = QUESTS[questId];
  state.flags ??= {};
  state.flags[quest.flags.objective] = true;
}

export function completeQuest(state, questId) {
  const quest = QUESTS[questId];
  state.flags ??= {};
  state.flags[quest.flags.completed] = true;
  if (questId === 'greenvale_cave_slime') {
    state.flags.talentTreesUnlocked = true;
    // Klíčový předmět: Lovecké povolení Greenvale.
    if (Array.isArray(state.inventory?.slots) && !state.inventory.slots.some((s) => s?.id === 'hunting_permit')) {
      const empty = state.inventory.slots.findIndex((s) => !s);
      if (empty >= 0) state.inventory.slots[empty] = { id: 'hunting_permit', qty: 1 };
    }
  }
}

// Talentové stromy odemyká úkol Jeskynní sliz.
export function areTalentTreesUnlocked(state) {
  return Boolean(state?.flags?.talentTreesUnlocked || state?.flags?.greenvaleHunterPermitGranted);
}

// Řádky pro záložku Úkoly na kartě hrdiny.
export function describeQuests(state) {
  const lines = [];
  for (const quest of Object.values(QUESTS)) {
    const status = getQuestStatus(state, quest.id);
    if (status === QUEST_STATUS.notStarted) continue;
    const label = {
      active: 'Probíhá',
      ready: 'Splněno – vrať se',
      done: 'Dokončeno'
    }[status];
    const step = status === QUEST_STATUS.active ? quest.objective : status === QUEST_STATUS.ready ? quest.returnTo : quest.reward;
    lines.push({ title: `${quest.title} · ${label}`, text: `${quest.description}\n${step}`, status });
  }
  return lines;
}
