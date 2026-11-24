import { unlockMagicSchool } from './MagicMasterySystem.js';

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
    region: 'Greenvale',
    // Cíle pro Sledovat (tečky ve světě): zadavatel = dveře budovy, cíl = jeskyně.
    giverTarget: { type: 'building', id: 'greenvale_town_hall', label: 'Radnice' },
    objectiveTarget: { type: 'cave', label: 'Jeskyně u Greenvale' },
    flags: {
      accepted: 'greenvaleHunterTrialAccepted',
      objective: 'greenvaleCaveBossDefeated',
      completed: 'greenvaleHunterPermitGranted'
    }
  },
  greenvale_air_song: {
    id: 'greenvale_air_song',
    title: 'Píseň větrů',
    giver: 'Mág v Hvězdárně',
    description:
      'Mág v Hvězdárně tě naučí magii vzduchu, až pochopíš řeč větru. Bard v hostinci zná starou Píseň větrů.',
    objective: 'Promluv s Bardem v hostinci Greenvale.',
    returnTo: 'Vrať se za Mágem do Hvězdárny (sever za radnicí).',
    reward: 'Odemčení školy magie Vzduch a jejích prvních kouzel.',
    region: 'Greenvale',
    giverTarget: { type: 'building', id: 'greenvale_observatory', label: 'Hvězdárna' },
    objectiveTarget: { type: 'building', id: 'greenvale_tavern', label: 'Hostinec' },
    flags: {
      accepted: 'airSongAccepted',
      objective: 'airSongHeard',
      completed: 'airSongDone'
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
  if (state.trackedQuest === questId) state.trackedQuest = null; // dokončený úkol se přestane sledovat
  if (questId === 'greenvale_air_song') unlockMagicSchool(state, 'air');
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

export const QUEST_STATUS_LABEL = {
  notStarted: 'Nepřijatý',
  active: 'Probíhá',
  ready: 'Splněno – vrať se',
  done: 'Dokončeno'
};

// Co má hráč teď udělat (text kroku).
export function questStep(state, questId) {
  const quest = QUESTS[questId];
  const status = getQuestStatus(state, questId);
  if (status === QUEST_STATUS.notStarted) return `Zadává: ${quest.giver}.`;
  if (status === QUEST_STATUS.active) return quest.objective;
  if (status === QUEST_STATUS.ready) return quest.returnTo;
  return `Odměna získána: ${quest.reward}`;
}

// Kam vede Sledovat: nepřijatý / splněný úkol k zadavateli, probíhající k cíli.
export function questTarget(state, questId) {
  const quest = QUESTS[questId];
  if (!quest) return null;
  const status = getQuestStatus(state, questId);
  if (status === QUEST_STATUS.done) return null;
  const target = status === QUEST_STATUS.active ? quest.objectiveTarget : quest.giverTarget;
  return target ? { ...target, region: quest.region } : null;
}

// Sledovaný úkol (jen jeden). Dokončený se sledovat nedá.
export function trackQuest(state, questId) {
  if (!QUESTS[questId] || getQuestStatus(state, questId) === QUEST_STATUS.done) return false;
  state.trackedQuest = state.trackedQuest === questId ? null : questId;
  return true;
}

export const trackedQuest = (state) => {
  const id = state?.trackedQuest;
  return id && QUESTS[id] && getQuestStatus(state, id) !== QUEST_STATUS.done ? id : null;
};

// Úkoly v kartě Úkoly: přijaté (probíhající, splněné, dokončené).
export const journalQuests = (state) =>
  Object.values(QUESTS).filter((q) => getQuestStatus(state, q.id) !== QUEST_STATUS.notStarted);

// Nástěnka ve městě: nedokončené úkoly oblasti (i nepřijaté).
export const boardQuests = (state, region) =>
  Object.values(QUESTS).filter((q) => q.region === region && getQuestStatus(state, q.id) !== QUEST_STATUS.done);

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
