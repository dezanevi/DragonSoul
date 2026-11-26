import { unlockMagicSchool, gainMagicExperience } from './MagicMasterySystem.js';
import { getItemCount, removeItem, addItem } from './InventorySystem.js';

const AIR_SONG_MAGIC_XP = 100;
import { addAlchemyXp, normalizeAlchemy } from './AlchemySystem.js';
import { grantQuestXp } from './DiplomacySystem.js';
import { addSmithingXp, normalizeSmithing } from './SmithingSystem.js';
import { addHerbXp, normalizeHerbalism } from './HerbalismSystem.js';

// Odměna ve zkušenostech profese. Profesi nejdřív založit – hráč, který ještě nikdy
// nebyl u výhně / stolu, ji v uložené hře nemá (dřív pád při odevzdání úkolu).
const withProfession = (normalize, add) => (state, amount) => { normalize(state); return add(state, amount); };
const XP_REWARD = {
  alchemy: withProfession(normalizeAlchemy, addAlchemyXp),
  smithing: withProfession(normalizeSmithing, addSmithingXp),
  herbalism: withProfession(normalizeHerbalism, addHerbXp)
};

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
  // Úvodní úkol nové hry (tutoriál souboje): Mág v Hvězdárně, Air Elemental na louce.
  greenvale_mage_intro: {
    id: 'greenvale_mage_intro',
    title: 'Krotitelova zkouška',
    giver: 'Mág v Hvězdárně',
    description:
      'Jsi lovec a Dire Wolf je tvůj věrný lovecký pes. Mág v Hvězdárně ti probudil magii Vzduchu a naučí tě krotit divoké bytosti: na louce za Loveckou chatou krouží Air Elemental.',
    objective: 'Jdi na louku za Loveckou chatou (zlaté tečky). Dire Wolf musí Air Elementala zasáhnout, vyzkoušej kouzlo Vzduchu a pak ho ochoč Soul Crystalem.',
    returnTo: 'Vrať se za Mágem do Hvězdárny.',
    reward: '5× Basic Soul Crystal, 20 zlata a Air Elemental v partě (magie Vzduchu je odemčená už od zadání).',
    region: 'Greenvale',
    rewardGold: 20,
    giverTarget: { type: 'building', id: 'greenvale_observatory', label: 'Hvězdárna' },
    objectiveTarget: { type: 'meadow', label: 'Louka za Loveckou chatou' },
    flags: { accepted: 'mageIntroAccepted', objective: 'mageIntroCaught', completed: 'mageIntroDone' }
  },
  greenvale_cave_slime: {
    id: 'greenvale_cave_slime',
    title: 'Orčí hrozba',
    giver: 'Starosta Edric',
    description:
      'V jeskyni u Greenvale se usadil orčí válečník a přepadá pocestné. Starosta chce, abys ho porazil. Svěří ti to, až pomůžeš všem ve vesnici.',
    objective: 'Poraz orčího válečníka v jeskyni u Greenvale (E u vchodu do jeskyně). Boss nejde simulovat ani ochočit.',
    returnTo: 'Vrať se za starostou Edricem na radnici.',
    reward: 'Odemčení talentových stromů (volba specializace) a cesta do Verdant Forest.',
    // Starosta úkol nabídne až po dokončení všech ostatních úkolů v Greenvale.
    requiresAllOthers: true,
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
    reward: 'Zkušenosti magie Vzduchu (Mág ti ji odemkl v úvodním úkolu).',
    region: 'Greenvale',
    giverTarget: { type: 'building', id: 'greenvale_observatory', label: 'Hvězdárna' },
    objectiveTarget: { type: 'building', id: 'greenvale_tavern', label: 'Hostinec', interaction: true },
    flags: {
      accepted: 'airSongAccepted',
      objective: 'airSongHeard',
      completed: 'airSongDone'
    }
  },
  // Úvodní úkoly profesí: obstarat suroviny (koupit / nasbírat), vyrobit z nich předmět
  // a odevzdat ho zadavateli. Krok, jehož předmět hráč už má, se přeskočí (i celé suroviny,
  // když už má hotový výrobek).
  greenvale_clean_water: {
    id: 'greenvale_clean_water',
    title: 'Čistá voda',
    giver: 'Alchymista',
    description: 'Alchymista tě naučí první lektvar. Potřebuješ čistou vodu od Trhovkyně a léčivé byliny od Bylinkářky.',
    returnTo: 'Odevzdej Menší léčivý tonik Alchymistovi v Alchymistickém obchodě.',
    reward: '25 zlata a zkušenosti v Alchymii.',
    region: 'Greenvale',
    steps: [
      { kind: 'buy', item: 'clean_water', qty: 3, text: 'Kup 3× Čistou vodu u Trhovkyně (Tržiště – potraviny).',
        target: { type: 'building', id: 'greenvale_market', label: 'Tržiště – potraviny', interaction: true } },
      { kind: 'buy', item: 'healing_herbs', qty: 2, text: 'Kup 2× Léčivé byliny u Bylinkářky (Dům Bylinkářky).',
        target: { type: 'building', id: 'greenvale_home_1', label: 'Dům Bylinkářky', interaction: true } },
      { kind: 'craft', text: 'Vyrob Menší léčivý tonik na Alchymistickém stole (Alchymistický obchod).',
        target: { type: 'building', id: 'greenvale_alchemist', label: 'Alchymistický stůl' } }
    ],
    deliver: { id: 'minor_healing_tonic', qty: 1 },
    rewardGold: 25,
    rewardXp: { prof: 'alchemy', amount: 30 },
    giverTarget: { type: 'building', id: 'greenvale_alchemist', label: 'Alchymistický obchod' },
    flags: { accepted: 'cleanWaterAccepted', objective: 'cleanWaterHave', completed: 'cleanWaterDone' },
    dialog: {
      offer: ['Bez čisté vody žádný lektvar. Kup tři lahve u Trhovkyně a dvě léčivé byliny u Bylinkářky, na mém stole z nich uvař Menší léčivý tonik a ukaž mi ho.', 'Nový úkol: Čistá voda.'],
      active: ['Čistá voda od Trhovkyně, léčivé byliny od Bylinkářky – a pak Menší léčivý tonik tady na stole.'],
      ready: ['Výborně, čistý a správně zakalený. Ten si nechám pro učedníky. Tady máš něco za námahu.'],
      done: ['Destilační přístroj i hmoždíř jsou ti k dispozici.']
    }
  },
  greenvale_leather_strap: {
    id: 'greenvale_leather_strap',
    title: 'Kožený řemínek',
    giver: 'Učednice v kovárně',
    description: 'Učednice potřebuje kožený řemínek na rukojeť. Kůži prodává Obchodník s látkami, řemínek si z ní vyrobíš na Koželužském stole v Řemeslné dílně.',
    returnTo: 'Odevzdej Kožený řemínek Učednici v kovárně.',
    reward: '20 zlata a zkušenosti v Kovářství.',
    region: 'Greenvale',
    steps: [
      { kind: 'buy', item: 'leather', qty: 1, text: 'Kup 1× Kůži u Obchodníka s látkami (Tržiště – zboží).',
        target: { type: 'building', id: 'greenvale_market_wares', label: 'Tržiště – zboží', interaction: true } },
      { kind: 'craft', text: 'Vyrob Kožený řemínek na Koželužském stole (Řemeslná dílna).',
        target: { type: 'building', id: 'greenvale_house_e1', label: 'Řemeslná dílna' } }
    ],
    deliver: { id: 'leather_strap', qty: 1 },
    rewardGold: 20,
    rewardXp: { prof: 'smithing', amount: 30 },
    giverTarget: { type: 'building', id: 'greenvale_smithy', label: 'Kovárna' },
    flags: { accepted: 'leatherStrapAccepted', objective: 'leatherStrapHave', completed: 'leatherStrapDone' },
    dialog: {
      offer: ['Mistr chce, abych omotala rukojeti, a mně došly řemínky. Kup kůži u Obchodníka s látkami a v Řemeslné dílně z ní vyrob řemínek.', 'Nový úkol: Kožený řemínek.'],
      active: ['Kůže od Obchodníka s látkami, z ní řemínek na Koželužském stole v Řemeslné dílně.'],
      ready: ['Přesně takový jsem potřebovala! Tady máš za ochotu.'],
      done: ['Mistr ti prodá krumpáč a vykoupí suroviny. U výhně si ukuješ výbavu.']
    }
  },
  greenvale_river_herbs: {
    id: 'greenvale_river_herbs',
    title: 'Byliny od řeky',
    giver: 'Bylinkářka',
    description: 'Bylinkářka tě naučí sbírat byliny. Z čisticích bylin od řeky a čisté vody uvaříš protijed.',
    returnTo: 'Odevzdej Protijed Bylinkářce (Dům Bylinkářky).',
    reward: '20 zlata a zkušenosti ve Sběru bylin.',
    region: 'Greenvale',
    steps: [
      { kind: 'gather', item: 'cleansing_herbs', qty: 2, text: 'Nasbírej 2× Čisticí byliny na nalezišti Břeh řeky (zelený kruh, E).',
        target: { type: 'herbSite', site: 'H02', label: 'Břeh řeky' } },
      { kind: 'buy', item: 'clean_water', qty: 1, text: 'Kup 1× Čistou vodu u Trhovkyně (Tržiště – potraviny).',
        target: { type: 'building', id: 'greenvale_market', label: 'Tržiště – potraviny', interaction: true } },
      { kind: 'craft', text: 'Vyrob Protijed na Alchymistickém stole (Alchymistický obchod).',
        target: { type: 'building', id: 'greenvale_alchemist', label: 'Alchymistický stůl' } }
    ],
    deliver: { id: 'antidote', qty: 1 },
    rewardGold: 20,
    rewardXp: { prof: 'herbalism', amount: 30 },
    giverTarget: { type: 'building', id: 'greenvale_home_1', label: 'Dům Bylinkářky' },
    flags: { accepted: 'riverHerbsAccepted', objective: 'riverHerbsHave', completed: 'riverHerbsDone' }
  }
};

// Aktuální krok úkolu s kroky: první surovina, kterou hráč ještě nemá; když má všechny,
// výroba. Hotový výrobek v inventáři = žádný krok (úkol je splněný). Bez kroků null.
export function currentQuestStep(state, questId) {
  const quest = QUESTS[questId];
  if (!quest?.steps) return null;
  if (getItemCount(state, quest.deliver.id) >= quest.deliver.qty) return null;
  return quest.steps.find((step) => step.kind === 'craft' || getItemCount(state, step.item) < step.qty) ?? null;
}

// Cíl probíhajícího úkolu (kam vede Sledovat, modrý kruh, modrý „?“).
function objectiveTargetOf(state, quest) {
  return quest.steps ? currentQuestStep(state, quest.id)?.target ?? null : quest.objectiveTarget;
}

// Předměty potřebné pro probíhající / splněné úkoly (varování při prodeji).
export function questNeededItems(state) {
  const ids = new Set();
  for (const quest of Object.values(QUESTS)) {
    const status = getQuestStatus(state, quest.id);
    if (status !== QUEST_STATUS.active && status !== QUEST_STATUS.ready) continue;
    if (quest.deliver) ids.add(quest.deliver.id);
    if (quest.objectiveItem) ids.add(quest.objectiveItem.id);
    if (status === QUEST_STATUS.active) for (const step of quest.steps ?? []) if (step.item) ids.add(step.item);
  }
  return ids;
}

// Předměty, které má hráč pro úkoly koupit (označení v obchodě): id → { quest, need, have }.
export function questShoppingList(state) {
  const list = {};
  for (const quest of Object.values(QUESTS)) {
    if (!quest.steps || getQuestStatus(state, quest.id) !== QUEST_STATUS.active) continue;
    for (const step of quest.steps) {
      if (step.kind !== 'buy') continue;
      const have = getItemCount(state, step.item);
      if (have >= step.qty) continue;
      const row = (list[step.item] ??= { quest: quest.title, need: 0, have });
      row.need = Math.max(row.need, step.qty);
    }
  }
  return list;
}

export function getQuestStatus(state, questId) {
  const quest = QUESTS[questId];
  const flags = state?.flags ?? {};
  if (!quest) return QUEST_STATUS.notStarted;
  if (flags[quest.flags.completed]) return QUEST_STATUS.done;
  if (!flags[quest.flags.accepted]) return QUEST_STATUS.notStarted;
  if (quest.deliver) return getItemCount(state, quest.deliver.id) >= quest.deliver.qty ? QUEST_STATUS.ready : QUEST_STATUS.active;
  if (quest.objectiveItem) return getItemCount(state, quest.objectiveItem.id) >= quest.objectiveItem.qty ? QUEST_STATUS.ready : QUEST_STATUS.active;
  return flags[quest.flags.objective] ? QUEST_STATUS.ready : QUEST_STATUS.active;
}

export function acceptQuest(state, questId) {
  const quest = QUESTS[questId];
  state.flags ??= {};
  state.flags[quest.flags.accepted] = true;
  state.trackedQuest = questId; // přijatý úkol se rovnou sleduje (tečky k cíli)
  // Úvodní úkol hned odemkne magii Vzduchu – Mág ji ukáže v souboji (tutoriál).
  if (questId === 'greenvale_mage_intro') unlockMagicSchool(state, 'air');
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
  if (quest.deliver) removeItem(state, quest.deliver.id, quest.deliver.qty); // odevzdaný výrobek
  // Píseň větrů: Vzduch už odemkl úvodní úkol – odměnou jsou zkušenosti magie Vzduchu
  // (starší hry bez úvodního úkolu ho odemknou jako dřív).
  if (questId === 'greenvale_air_song') {
    if (state.magicMastery?.air?.unlocked) gainMagicExperience(state, 'air', AIR_SONG_MAGIC_XP);
    else unlockMagicSchool(state, 'air');
  }
  if (questId === 'greenvale_mage_intro') addItem(state, 'basic_crystal', 5);
  if (quest.rewardGold) state.gold = (Number(state.gold) || 0) + quest.rewardGold;
  if (quest.rewardXp) XP_REWARD[quest.rewardXp.prof]?.(state, quest.rewardXp.amount);
  // Diplomacie: jednorázové XP za každý splněný úkol.
  grantQuestXp(state, questId);
  if (questId === 'greenvale_cave_slime') {
    state.flags.talentTreesUnlocked = true;
    // Klíčový předmět: Lovecké povolení Greenvale.
    if (Array.isArray(state.inventory?.slots) && !state.inventory.slots.some((s) => s?.id === 'hunting_permit')) {
      const empty = state.inventory.slots.findIndex((s) => !s);
      if (empty >= 0) state.inventory.slots[empty] = { id: 'hunting_permit', qty: 1 };
    }
  }
}

// Úkol s requiresAllOthers (Orčí hrozba) jde přijmout až po všech ostatních úkolech oblasti.
export function isQuestAvailable(state, questId) {
  const quest = QUESTS[questId];
  if (!quest?.requiresAllOthers) return true;
  return Object.values(QUESTS).every((q) => q.id === questId || q.region !== quest.region || getQuestStatus(state, q.id) === QUEST_STATUS.done);
}

// Nedokončené úkoly oblasti, které blokují úkol s requiresAllOthers (pro rozhovor).
export function questsBlocking(state, questId) {
  const quest = QUESTS[questId];
  return Object.values(QUESTS).filter((q) => q.id !== questId && q.region === quest?.region && getQuestStatus(state, q.id) !== QUEST_STATUS.done);
}

// Talentové stromy odemyká úkol Orčí hrozba (dřív Jeskynní sliz).
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
  if (status === QUEST_STATUS.active) return quest.steps ? currentQuestStep(state, questId)?.text ?? '' : quest.objective;
  if (status === QUEST_STATUS.ready) return quest.returnTo;
  return `Odměna získána: ${quest.reward}`;
}

// Kam vede Sledovat: nepřijatý / splněný úkol k zadavateli, probíhající k cíli.
export function questTarget(state, questId) {
  const quest = QUESTS[questId];
  if (!quest) return null;
  const status = getQuestStatus(state, questId);
  if (status === QUEST_STATUS.done) return null;
  const target = status === QUEST_STATUS.active ? objectiveTargetOf(state, quest) : quest.giverTarget;
  return target ? { ...target, region: quest.region } : null;
}

// Kam má hráč teď jít (budova cíle s rozhovorem / zadavatel při splnění) – modrý kruh u vchodu.
export function questEndBuildings(state, region) {
  const ids = new Set();
  for (const quest of Object.values(QUESTS)) {
    if (quest.region !== region) continue;
    const status = getQuestStatus(state, quest.id);
    if (status === QUEST_STATUS.ready && quest.giverTarget?.type === 'building') ids.add(quest.giverTarget.id);
    const objective = status === QUEST_STATUS.active ? objectiveTargetOf(state, quest) : null;
    if (objective?.interaction && objective.type === 'building') ids.add(objective.id);
  }
  return ids;
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

// Značky úkolů: zadavatel „!“ (nový úkol) / „?“ (splněno, vrať se) zlatě; cíl, kde je úkolem
// interakce (rozhovor), modré „?“, dokud úkol probíhá.
export const QUEST_MARK_GOLD = '#ffd23a';
export const QUEST_MARK_BLUE = '#5ab8ff';
// buildingId: u úkolu s kroky se modrý „?“ ukáže jen v budově aktuálního kroku.
export function questMark(state, questId, role, buildingId = null) {
  const status = getQuestStatus(state, questId);
  if (role === 'giver') {
    if (status === QUEST_STATUS.notStarted) return isQuestAvailable(state, questId) ? { char: '!', color: QUEST_MARK_GOLD } : null;
    if (status === QUEST_STATUS.ready) return { char: '?', color: QUEST_MARK_GOLD };
    return null;
  }
  if (role === 'objective' && status === QUEST_STATUS.active) {
    const quest = QUESTS[questId];
    if (quest?.steps && buildingId && objectiveTargetOf(state, quest)?.id !== buildingId) return null;
    return { char: '?', color: QUEST_MARK_BLUE };
  }
  return null;
}

// Značky nad budovami ve světě (podle cílů úkolů v oblasti).
export function worldQuestMarks(state, region) {
  const marks = [];
  for (const quest of Object.values(QUESTS)) {
    if (quest.region !== region) continue;
    const giver = questMark(state, quest.id, 'giver');
    if (giver && quest.giverTarget?.type === 'building') marks.push({ buildingId: quest.giverTarget.id, ...giver });
    const target = getQuestStatus(state, quest.id) === QUEST_STATUS.active ? objectiveTargetOf(state, quest) : null;
    const objective = target?.interaction ? questMark(state, quest.id, 'objective') : null;
    if (objective && target.type === 'building') marks.push({ buildingId: target.id, ...objective });
  }
  return marks;
}

// Úkoly v kartě Úkoly: přijaté (probíhající, splněné, dokončené).
export const journalQuests = (state) =>
  Object.values(QUESTS).filter((q) => getQuestStatus(state, q.id) !== QUEST_STATUS.notStarted);

// Nástěnka ve městě: nedokončené úkoly oblasti (i nepřijaté).
export const boardQuests = (state, region) =>
  Object.values(QUESTS).filter((q) => q.region === region && getQuestStatus(state, q.id) !== QUEST_STATUS.done
    && (getQuestStatus(state, q.id) !== QUEST_STATUS.notStarted || isQuestAvailable(state, q.id)));

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
    const step = status === QUEST_STATUS.done ? quest.reward : questStep(state, quest.id);
    lines.push({ title: `${quest.title} · ${label}`, text: `${quest.description}\n${step}`, status });
  }
  return lines;
}
