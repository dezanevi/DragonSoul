import { unlockMagicSchool } from './MagicMasterySystem.js';
import { getItemCount, removeItem, addItem } from './InventorySystem.js';
import { addAlchemyXp, normalizeAlchemy } from './AlchemySystem.js';
import { grantQuestXp, addDiplomacyXp } from './DiplomacySystem.js';
import { addSmithingXp, normalizeSmithing } from './SmithingSystem.js';
import { addHerbXp, normalizeHerbalism } from './HerbalismSystem.js';
import { addFishingXp, normalizeFishing } from './FishingSystem.js';
import { addMiningXp, normalizeMining } from './MiningSystem.js';
import { addCookingXp, normalizeCooking } from './CookingSystem.js';
import { addCraftingXp, normalizeCrafting } from './CraftingSystem.js';
import { addHeroExp } from './HeroProgressionSystem.js';
import { unlockRegion } from './RegionSystem.js';
import { getItem } from '../data/items.js';
import { questCounter } from './QuestCounters.js';
import { CRAFT_QUESTS } from '../data/craftQuests.js';

// Odměna ve zkušenostech profese. Profesi nejdřív založit – hráč, který ještě nikdy
// nebyl u výhně / stolu, ji v uložené hře nemá (dřív pád při odevzdání úkolu).
const withProfession = (normalize, add) => (state, amount) => { normalize(state); return add(state, amount); };
const XP_REWARD = {
  alchemy: withProfession(normalizeAlchemy, addAlchemyXp),
  smithing: withProfession(normalizeSmithing, addSmithingXp),
  herbalism: withProfession(normalizeHerbalism, addHerbXp),
  fishing: withProfession(normalizeFishing, addFishingXp),
  mining: withProfession(normalizeMining, addMiningXp),
  cooking: withProfession(normalizeCooking, addCookingXp),
  crafting: withProfession(normalizeCrafting, addCraftingXp),
  diplomacy: (state, amount) => addDiplomacyXp(state, amount, 'Úkol'), // navíc k 50 XP za každý úkol
  hero: (state, amount) => addHeroExp(state, amount) // navíc k QUEST_HERO_XP
};

// Každý splněný úkol dá hrdinovi tolik zkušeností (Demo: 34 úkolů → úroveň 8, záložka „Demo – úkoly“).
export const QUEST_HERO_XP = 15;

// Talenty se odemknou na této úrovni hrdiny (dřív úkolem Orčí hrozba).
export const TALENT_UNLOCK_LEVEL = 4;

// ======================================================================
// Úkoly. Stav úkolu se odvozuje z příznaků v uložené hře (state.flags),
// takže starší uložené hry s loveckou zkouškou pokračují tam, kde byly.
// ======================================================================

// ------------------------------------------------ počítadla pro cíle úkolů (objectiveCheck)
// Úkol s objectiveCheck se splní podle stavu hry; onAccept si uloží výchozí hodnotu
// (state.questBase), aby se počítalo až od přijetí.
const bestiaryOf = (state) => Object.values(state?.bestiary ?? {});
const speciesSeen = (state) => bestiaryOf(state).filter((r) => (Number(r?.seen) || 0) > 0).length;
const defeatedOf = (state, speciesId) => Number(state?.bestiary?.[speciesId]?.defeated) || 0;
const ownedMonsters = (state) => [...(state?.party ?? []), ...(state?.monsterStorage ?? [])];
const trainingSpent = (state) => ownedMonsters(state).reduce((sum, m) =>
  sum + Object.values(m?.trainingPoints ?? {}).reduce((a, v) => a + (Number(v) || 0), 0), 0);
const spellsCast = (state) => Number(state?.flags?.spellsCast) || 0;
const airMastery = (state) => state?.magicMastery?.air ?? { level: 0, exp: 0 };
const setBase = (state, questId, value) => { state.questBase ??= {}; state.questBase[questId] = value; };
const sinceBase = (state, questId, value) => value - (Number(state?.questBase?.[questId]) || 0);

// Druhý živel (odměna úkolu Druhá škola) – hráč si vybere u Mága.
export const SECOND_SCHOOL_OPTIONS = ['fire', 'water', 'earth', 'light', 'dark'];

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
    brief: 'Na louce za Loveckou chatou oslab Air Elementala a ochoč ho Soul Crystalem.', // stručná náplň (okno nabídky úkolu)
    giver: 'Mág v Hvězdárně',
    description:
      'Jsi lovec a Dire Wolf je tvůj věrný lovecký pes. Mág v Hvězdárně ti probudil magii Vzduchu a naučí tě krotit divoké bytosti: na louce za Loveckou chatou krouží Air Elemental.',
    objective: 'Jdi na louku za Loveckou chatou (modré tečky). Dire Wolf musí Air Elementala zasáhnout, vyzkoušej kouzlo Vzduchu a pak ho ochoč Soul Crystalem.',
    returnTo: 'Vrať se za Mágem do Hvězdárny.',
    reward: '5× Basic Soul Crystal, 20 zlata a Air Elemental v partě (magie Vzduchu je odemčená od začátku hry).',
    region: 'Greenvale',
    rewardGold: 20,
    giverTarget: { type: 'building', id: 'greenvale_observatory', label: 'Hvězdárna' },
    objectiveTarget: { type: 'meadow', label: 'Louka za Loveckou chatou' },
    flags: { accepted: 'mageIntroAccepted', objective: 'mageIntroCaught', completed: 'mageIntroDone' }
  },
  greenvale_cave_slime: {
    id: 'greenvale_cave_slime',
    title: 'Orčí hrozba',
    brief: 'Poraz orčího válečníka v jeskyni za vesnicí a vrať se ke starostovi.', // stručná náplň (okno nabídky úkolu)
    giver: 'Starosta Edric',
    description:
      'V jeskyni u Jižních plání se usadil orčí válečník a přepadá pocestné. Starosta chce, abys ho porazil. Svěří ti to, až pomůžeš všem ve vesnici.',
    objective: 'Poraz orčího válečníka v jeskyni u Jižních plání (E u vchodu do jeskyně). Boss nejde simulovat ani ochočit.',
    returnTo: 'Vrať se za starostou Edricem na radnici.',
    reward: '30 zlata, 30 XP hrdiny navíc a cesta do Verdant Forest.',
    // Starosta úkol nabídne až po základních úkolech (seznam Demo, úkoly 1–9).
    requires: ['greenvale_mage_intro', 'greenvale_visit_healer', 'greenvale_healer_herbs', 'greenvale_first_hunt',
      'greenvale_new_companion', 'greenvale_training', 'greenvale_spell_song', 'greenvale_second_school'],
    rewardGold: 30,
    rewardXp: { prof: 'hero', amount: 30 },
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
  // (Úkol Píseň větrů – odemčení magie Vzduchu u Barda – je zrušený; Vzduch odemyká úvodní úkol.)
  // Po úvodním úkolu se sám zadá: zajít za léčitelkou Liorou (vyléčí monstra).
  greenvale_visit_healer: {
    id: 'greenvale_visit_healer',
    title: 'Za léčitelkou',
    brief: 'Zajdi za Liorou do Domu léčitelky u náměstí – vyléčí tvá zraněná monstra.',
    giver: 'Mág v Hvězdárně',
    description: 'Po souboji na louce jsou tvá monstra unavená. Léčitelka Liora v Domě léčitelky u náměstí je vyléčí zdarma.',
    objective: 'Promluv s Liorou v Domě léčitelky u náměstí (modré tečky).',
    returnTo: 'Promluv s Liorou.',
    reward: 'Vyléčená monstra a nový úkol od Liory.',
    region: 'Greenvale',
    autoAssigned: true, // zadá se sám po Krotitelově zkoušce (bez okna nabídky)
    giverTarget: { type: 'building', id: 'greenvale_home_3', label: 'Dům léčitelky' },
    objectiveTarget: { type: 'building', id: 'greenvale_home_3', label: 'Dům léčitelky', interaction: true },
    flags: { accepted: 'visitHealerAccepted', objective: 'visitHealerMet', completed: 'visitHealerDone' }
  },
  // Liora pošle hráče k Bylinkářce pro léčivé byliny (koupit nebo nasbírat) a odevzdat je.
  greenvale_healer_herbs: {
    id: 'greenvale_healer_herbs',
    title: 'Léčivé byliny pro Lioru',
    brief: 'Obstarej 3× Léčivé byliny u Bylinkářky a přines je Lioře.',
    giver: 'Liora, léčitelka',
    description: 'Lioře docházejí léčivé byliny na obvazy pro monstra. Bylinkářka je prodává a ukáže ti, kde rostou.',
    returnTo: 'Přines 3× Léčivé byliny Lioře do Domu léčitelky.',
    reward: '15 zlata a 100 XP Sběru bylin.',
    region: 'Greenvale',
    steps: [
      { kind: 'buy', item: 'healing_herbs', qty: 3, text: 'Obstarej 3× Léčivé byliny u Bylinkářky (Dům Bylinkářky) – koupit, nebo nasbírat.',
        target: { type: 'building', id: 'greenvale_home_1', label: 'Dům Bylinkářky', interaction: true } }
    ],
    deliver: { id: 'healing_herbs', qty: 3 },
    rewardGold: 15,
    rewardXp: { prof: 'herbalism', amount: 100 },
    giverTarget: { type: 'building', id: 'greenvale_home_3', label: 'Dům léčitelky' },
    flags: { accepted: 'healerHerbsAccepted', objective: 'healerHerbsHave', completed: 'healerHerbsDone' }
  },
  // Úvodní úkoly profesí: obstarat suroviny (koupit / nasbírat), vyrobit z nich předmět
  // a odevzdat ho zadavateli. Krok, jehož předmět hráč už má, se přeskočí (i celé suroviny,
  // když už má hotový výrobek).
  greenvale_clean_water: {
    id: 'greenvale_clean_water',
    title: 'Čistá voda',
    brief: 'Kup čistou vodu a léčivé byliny, uvař Menší léčivý tonik a přines ho Alchymistovi.', // stručná náplň (okno nabídky úkolu)
    giver: 'Alchymista',
    description: 'Alchymista tě naučí první lektvar. Potřebuješ čistou vodu od Trhovkyně a léčivé byliny od Bylinkářky.',
    returnTo: 'Odevzdej Menší léčivý tonik Alchymistovi v Alchymistickém obchodě.',
    reward: '25 zlata a 200 XP Alchymie.',
    region: 'Greenvale',
    requires: ['greenvale_visit_healer'], // řemeslné linie po návštěvě léčitelky
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
    rewardXp: { prof: 'alchemy', amount: 200 },
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
    brief: 'Kup kůži, v Řemeslné dílně z ní vyrob Kožený řemínek a přines ho Učednici.', // stručná náplň (okno nabídky úkolu)
    giver: 'Učednice v kovárně',
    description: 'Učednice potřebuje kožený řemínek na rukojeť. Kůži prodává Obchodník s látkami, řemínek si z ní vyrobíš na Koželužském stole v Řemeslné dílně.',
    returnTo: 'Odevzdej Kožený řemínek Učednici v kovárně.',
    reward: '20 zlata a 200 XP Kovářství.',
    region: 'Greenvale',
    requires: ['greenvale_visit_healer'],
    steps: [
      { kind: 'buy', item: 'leather', qty: 1, text: 'Kup 1× Kůži u Obchodníka s látkami (Tržiště – zboží).',
        target: { type: 'building', id: 'greenvale_market_wares', label: 'Tržiště – zboží', interaction: true } },
      { kind: 'craft', text: 'Vyrob Kožený řemínek na Koželužském stole (Řemeslná dílna).',
        target: { type: 'building', id: 'greenvale_house_e1', label: 'Řemeslná dílna' } }
    ],
    deliver: { id: 'leather_strap', qty: 1 },
    rewardGold: 20,
    rewardXp: { prof: 'smithing', amount: 200 },
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
    brief: 'Nasbírej čisticí byliny u řeky, uvař z nich protijed a přines ho Bylinkářce.', // stručná náplň (okno nabídky úkolu)
    giver: 'Bylinkářka',
    description: 'Bylinkářka tě naučí sbírat byliny. Z čisticích bylin od řeky a čisté vody uvaříš protijed.',
    returnTo: 'Odevzdej Protijed Bylinkářce (Dům Bylinkářky).',
    reward: '20 zlata a 200 XP Sběru bylin.',
    region: 'Greenvale',
    requires: ['greenvale_visit_healer'],
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
    rewardXp: { prof: 'herbalism', amount: 200 },
    giverTarget: { type: 'building', id: 'greenvale_home_1', label: 'Dům Bylinkářky' },
    flags: { accepted: 'riverHerbsAccepted', objective: 'riverHerbsHave', completed: 'riverHerbsDone' }
  },

  // ------------------------------------------------ základní úkoly Dema (2, 5–9)
  // 2 – pasivní: zadá se sám po Krotitelově zkoušce, splní a odmění se sám (bez návratu).
  greenvale_tamer_notes: {
    id: 'greenvale_tamer_notes',
    title: 'Zápisky krotitele',
    brief: 'Poznej v soubojích 5 různých druhů monster – zapíšou se do Bestiáře (B).',
    giver: 'Mág v Hvězdárně',
    description: 'Každý krotitel si vede zápisky o monstrech, která potkal. Bestiář (B) ukáže, kde které žije a co z něj padá.',
    objective: 'Poznej 5 druhů monster.',
    objectiveText: (state) => `Poznej 5 různých druhů monster (Bestiář, B): ${Math.min(5, speciesSeen(state))}/5.`,
    returnTo: 'Splní se samo.',
    reward: '10 zlata.',
    region: 'Greenvale',
    autoAssigned: true,
    passive: true,
    rewardGold: 10,
    objectiveCheck: (state) => speciesSeen(state) >= 5,
    progress: (state) => ({ have: speciesSeen(state), need: 5 }),
    flags: { accepted: 'tamerNotesAccepted', objective: 'tamerNotesSeen', completed: 'tamerNotesDone' }
  },
  // 5 – Lovec v hostinci: porazit 3× Wild Boar na louce, kde žije.
  greenvale_first_hunt: {
    id: 'greenvale_first_hunt',
    title: 'První lov',
    brief: 'Poraz 3× Wild Boar na louce, kde žijí divočáci, a vrať se za Lovcem do hostince.',
    giver: 'Lovec v hostinci',
    description: 'Lovec u stolu v hostinci tě vezme na první opravdový lov: divočáci rozrývají pastviny kolem vesnice.',
    objective: 'Poraz 3× Wild Boar.',
    objectiveText: (state) => `Poraz 3× Wild Boar (modré tečky vedou na louku s divočáky): ${Math.min(3, sinceBase(state, 'greenvale_first_hunt', defeatedOf(state, 'wild_boar')))}/3.`,
    returnTo: 'Vrať se za Lovcem do hostince.',
    reward: '15 zlata a 30 XP hrdiny navíc.',
    region: 'Greenvale',
    requires: ['greenvale_visit_healer'],
    rewardGold: 15,
    rewardXp: { prof: 'hero', amount: 30 },
    onAccept: (state) => setBase(state, 'greenvale_first_hunt', defeatedOf(state, 'wild_boar')),
    objectiveCheck: (state) => sinceBase(state, 'greenvale_first_hunt', defeatedOf(state, 'wild_boar')) >= 3,
    progress: (state) => ({ have: sinceBase(state, 'greenvale_first_hunt', defeatedOf(state, 'wild_boar')), need: 3 }),
    giverTarget: { type: 'building', id: 'greenvale_tavern', label: 'Hostinec' },
    objectiveTarget: { type: 'meadow', species: 'wild_boar', label: 'Louka s divočáky' },
    flags: { accepted: 'firstHuntAccepted', objective: 'firstHuntDone3', completed: 'firstHuntDone' },
    dialog: {
      offer: ['Ty jsi ten nový krotitel? Na pastvinách kolem vesnice řádí divočáci, rozrývají pole. Poraz tři a ukážu ti, že lov není jen o síle.'],
      active: ['Divočáky najdeš na loukách kolem vesnice – modré tečky tě dovedou. Útoč na ně společně, ať se nerozptýlí.'],
      ready: ['Tři divočáci? Dobrá práce. Z tebe bude lovec. Tady máš podíl z odměny od sedláků.'],
      done: ['Než vyrazíš na louku, odpočiň si – a dobrý pokrm z kuchyně ti v boji přidá sílu.']
    }
  },
  // 6 – Mág: ochočit další monstrum (Soul Crystal z úvodního úkolu).
  greenvale_new_companion: {
    id: 'greenvale_new_companion',
    title: 'Nový společník',
    brief: 'Na Skalní stráni oslab divoké monstrum a ochoč ho Mágovým krystalem. Vrať se za Mágem.',
    giver: 'Mág v Hvězdárně',
    description: 'Dva společníci jsou málo. Mág chce vidět, že umíš ochočit monstrum i bez jeho pomoci.',
    objective: 'Ochoč další monstrum.',
    objectiveText: () => 'Na Skalní stráni oslab divoké monstrum a ochoč ho Mágovým krystalem (v souboji Ochočit).',
    returnTo: 'Vrať se za Mágem do Hvězdárny.',
    reward: '20 zlata.',
    region: 'Greenvale',
    requires: ['greenvale_first_hunt'],
    rewardGold: 20,
    // Mágův krystal: funguje jen na Skalní stráni, v souboji tam se doplní (když došel), po
    // odevzdání úkolu se zbylé seberou (BattleScene, completeQuest). Úkol tak nejde zablokovat.
    mageCrystal: { zone: 'rocky_slope', zoneName: 'Skalní stráň', qty: 2 },
    onAccept: (state) => {
      setBase(state, 'greenvale_new_companion', ownedMonsters(state).length);
      addItem(state, 'mage_crystal', 2);
    },
    // Hráč, který už má víc než 2 monstra (Dire Wolf, Air Elemental a další), má úkol splněný hned.
    objectiveCheck: (state) => ownedMonsters(state).length > 2 || sinceBase(state, 'greenvale_new_companion', ownedMonsters(state).length) >= 1,
    progress: (state) => ({ have: ownedMonsters(state).length > 2 ? 1 : sinceBase(state, 'greenvale_new_companion', ownedMonsters(state).length), need: 1 }),
    giverTarget: { type: 'building', id: 'greenvale_observatory', label: 'Hvězdárna' },
    objectiveTarget: { type: 'meadow', label: 'Skalní stráň', zone: 'rocky_slope' },
    flags: { accepted: 'newCompanionAccepted', objective: 'newCompanionTamed', completed: 'newCompanionDone' },
    dialog: {
      offer: ['Dva společníci jsou málo. Na Skalní stráni za náměstím najdi monstrum, které se ti líbí, oslab ho a ochoč ho. Dám ti na to Mágovy krystaly – fungují jen tam, a když dojdou, v dalším souboji na stráni se ti doplní.'],
      active: ['Čím slabší monstrum, tím snáz se ochočí. Mágovy krystaly ti na Skalní stráni nedojdou.'],
      ready: ['Nový společník – a vypadá, že ti věří. Výborně.'],
      done: ['Křišťálová koule u mě slouží jako Soul Crystal Workbench – vyrobíš na ní další Soul Crystaly.']
    }
  },
  // 7 – Strážný na radnici: rozdělit tréninkové body (Party, P).
  greenvale_training: {
    id: 'greenvale_training',
    title: 'Výcvik',
    brief: 'V Party (P) rozděl monstru tréninkový bod a vrať se za Strážným na radnici.',
    giver: 'Strážný na radnici',
    description: 'Monstra rostou s úrovní, ale tréninkovými body jim sám určíš, v čem budou silnější. Monstra navíc hlídá úschovna u Liory a ve sklepě hostince.',
    objective: 'Rozděl tréninkový bod.',
    objectiveText: () => 'Otevři Party (P), vyber monstrum a rozděl mu tréninkový bod.',
    returnTo: 'Vrať se za Strážným na radnici.',
    reward: '10 zlata.',
    region: 'Greenvale',
    requires: ['greenvale_new_companion'],
    rewardGold: 10,
    onAccept: (state) => setBase(state, 'greenvale_training', trainingSpent(state)),
    objectiveCheck: (state) => sinceBase(state, 'greenvale_training', trainingSpent(state)) >= 1,
    progress: (state) => ({ have: sinceBase(state, 'greenvale_training', trainingSpent(state)), need: 1 }),
    giverTarget: { type: 'building', id: 'greenvale_town_hall', label: 'Radnice' },
    flags: { accepted: 'trainingAccepted', objective: 'trainingSpent', completed: 'trainingDone' },
    dialog: {
      offer: ['Silné monstrum se nerodí, cvičí se. V Party (P) rozděl svému monstru tréninkový bod – sílu, výdrž, rychlost, co potřebuje.', 'Kdo nemá místo v partě, počká v úschovně u Liory nebo ve sklepě hostince.'],
      active: ['Party (P), vyber monstrum a rozděl body. Nic složitého.'],
      ready: ['Tak se to dělá. Tady máš něco z obecní pokladny.'],
      done: ['Na radnici je klid. Ale v jeskyni za vesnicí se něco usadilo – buď opatrný.']
    }
  },
  // 8 – Mág: použít kouzlo hrdiny v souboji.
  greenvale_spell_song: {
    id: 'greenvale_spell_song',
    title: 'Píseň živlů',
    brief: 'Použij v souboji kouzlo hrdiny (magie Vzduchu) a vrať se za Mágem.',
    giver: 'Mág v Hvězdárně',
    description: 'Magie Vzduchu v tobě dřímá od první zkoušky. V souboji ji použiješ tlačítkem Kouzla – stojí manu.',
    objective: 'Použij kouzlo v souboji.',
    objectiveText: () => 'V souboji použij kouzlo hrdiny (Kouzla) na nepřítele.',
    returnTo: 'Vrať se za Mágem do Hvězdárny.',
    reward: '20 zlata.',
    region: 'Greenvale',
    requires: ['greenvale_first_hunt'],
    rewardGold: 20,
    onAccept: (state) => setBase(state, 'greenvale_spell_song', spellsCast(state)),
    objectiveCheck: (state) => sinceBase(state, 'greenvale_spell_song', spellsCast(state)) >= 1,
    progress: (state) => ({ have: sinceBase(state, 'greenvale_spell_song', spellsCast(state)), need: 1 }),
    giverTarget: { type: 'building', id: 'greenvale_observatory', label: 'Hvězdárna' },
    objectiveTarget: { type: 'meadow', label: 'Louka' },
    flags: { accepted: 'spellSongAccepted', objective: 'spellSongCast', completed: 'spellSongDone' },
    dialog: {
      offer: ['Vítr tě poslouchá, jen ho musíš zavolat. V příštím souboji použij kouzlo – tlačítko Kouzla. Mana se obnoví odpočinkem.'],
      active: ['Kouzla v souboji, na nepřítele. Pak přijď.'],
      ready: ['Cítil jsem to až sem. Vzduch tě přijal.'],
      done: ['Hvězdy prozradí mnohé. Další školy magie tě naučím, až na to budeš připraven.']
    }
  },
  // 9 – Mág: Vzduch na 2. úroveň mistrovství, pak volba druhé školy magie.
  greenvale_second_school: {
    id: 'greenvale_second_school',
    title: 'Druhá škola',
    brief: 'Zvládni magii Vzduchu na 2. úroveň mistrovství a vyber si u Mága druhý živel.',
    giver: 'Mág v Hvězdárně',
    description: 'Mág tě naučí druhou školu magie, až zvládneš první. Mistrovství roste každým sesláním kouzla.',
    objective: 'Vzduch na 2. úroveň mistrovství.',
    objectiveText: (state) => {
      const air = airMastery(state);
      return (Number(air.level) || 0) >= 2 ? 'Vzduch má 2. úroveň mistrovství.' : `Sesílej kouzla Vzduchu v soubojích: mistrovství ${Number(air.exp) || 0}/40 XP do 2. úrovně.`;
    },
    returnTo: 'Vrať se za Mágem do Hvězdárny a vyber si druhý živel.',
    reward: '25 zlata a druhá škola magie podle tvé volby.',
    region: 'Greenvale',
    requires: ['greenvale_spell_song'],
    rewardGold: 25,
    objectiveCheck: (state) => (Number(airMastery(state).level) || 0) >= 2,
    // Ukazatel v HUD: XP mistrovství Vzduchu do 2. úrovně (po jejím dosažení plný).
    progress: (state) => ({ have: (Number(airMastery(state).level) || 0) >= 2 ? 40 : Number(airMastery(state).exp) || 0, need: 40, unit: 'XP' }),
    giverTarget: { type: 'building', id: 'greenvale_observatory', label: 'Hvězdárna' },
    objectiveTarget: { type: 'meadow', label: 'Louka' },
    flags: { accepted: 'secondSchoolAccepted', objective: 'secondSchoolReady', completed: 'secondSchoolDone' },
    dialog: {
      offer: ['Jeden živel je začátek. Až zvládneš Vzduch na druhou úroveň mistrovství, naučím tě další – oheň, vodu, zemi, světlo, nebo stín. Vybereš si sám.'],
      active: ['Každé kouzlo Vzduchu tě posune. Mistrovství uvidíš v Knize kouzel.'],
      ready: ['Vzduch tě poslouchá. Je čas vybrat druhý živel.'],
      done: ['Dva živly v jedné ruce. Pamatuj, že každý se hodí na jiného protivníka.']
    }
  },

  // ------------------------------------------------ řemeslné linie (data/craftQuests.js)
  ...CRAFT_QUESTS
};

// ------------------------------------------------ cíle podle počítadel (quest.goals)
// Každý cíl { key, need } se počítá od přijetí úkolu (výchozí hodnota v state.questBase).
const goalBaseKey = (questId, key) => `${questId}|${key}`;
export const goalHave = (state, questId, goal) => Math.max(0, questCounter(state, goal.key) - (Number(state?.questBase?.[goalBaseKey(questId, goal.key)]) || 0));
const goalsMet = (state, quest) => quest.goals.every((g) => goalHave(state, quest.id, g) >= g.need);
// Aktuální (první nesplněný) cíl úkolu, nebo null.
export function currentQuestGoal(state, questId) {
  const quest = QUESTS[questId];
  return quest?.goals?.find((g) => goalHave(state, questId, g) < g.need) ?? null;
}

// Aktuální krok cíle: první chybějící surovina (goal.needs – nasbírat, vytěžit, koupit, vyrobit),
// když má hráč všechny, cíl sám (výroba, prodej…). Sledovat a text úkolu se tak posouvají krok
// po kroku (modré byliny → stůl, měď → uhlí → výheň). null = žádný nesplněný cíl.
// Kolik kusů suroviny hráč má (anyOf = kterákoli z možností, např. kůže z monster).
export const needCount = (state, need) => (need.anyOf ?? [need.item]).reduce((sum, id) => sum + getItemCount(state, id), 0);

export function currentGoalStep(state, questId) {
  const goal = currentQuestGoal(state, questId);
  if (!goal) return null;
  const need = (goal.needs ?? []).find((n) => needCount(state, n) < n.qty);
  return need ? { ...need, goal, isNeed: true } : { goal, text: goal.text, target: goal.target, craftItem: goal.craftItem };
}

// Má hráč teď u obchodu prodat něco pro úkol? (modrý „?“ u volby Obchod)
export function questWantsShop(state, shopKey) {
  return Object.values(QUESTS).some((quest) => {
    if (!quest.goals || getQuestStatus(state, quest.id) !== QUEST_STATUS.active) return false;
    const step = currentGoalStep(state, quest.id);
    return step && !step.isNeed && step.goal.shop === shopKey;
  });
}

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
  if (quest.goals) return currentGoalStep(state, quest.id)?.target ?? null;
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
    if (status === QUEST_STATUS.active && quest.goals) for (const need of currentQuestGoal(state, quest.id)?.needs ?? []) for (const id of need.anyOf ?? [need.item]) ids.add(id);
  }
  return ids;
}

// Barvy úkolů v označení (obchod, výroba) – předmět pro víc úkolů má u každého jinou barvu.
const QUEST_MARK_COLORS = ['#ffd76a', '#7fd6ff', '#ff9fd0', '#b6f27a'];

// Označení předmětů pro probíhající úkoly: id → { need, have, quests: [{ title, need, have, color }] }.
// pick(quest) vrací pole { item, qty } (co úkol potřebuje). Zásoba se dělí mezi úkoly v pořadí,
// poslední úkol dostane zbytek bez stropu – hráč vidí skutečný stav (např. 3/1).
function questMarkList(state, pick) {
  const list = {};
  const active = Object.values(QUESTS).filter((q) => (q.steps || q.goals) && getQuestStatus(state, q.id) === QUEST_STATUS.active);
  active.forEach((quest, index) => {
    for (const { item, qty, have } of pick(quest)) {
      // named: běží víc úkolů najednou → štítek ukazuje název úkolu v jeho barvě (rozlišení).
      const row = (list[item] ??= { need: 0, have: have ?? getItemCount(state, item), quests: [], named: active.length > 1 });
      row.need += qty;
      row.quests.push({ id: quest.id, title: quest.title, need: qty, color: QUEST_MARK_COLORS[index % QUEST_MARK_COLORS.length] });
    }
  });
  for (const row of Object.values(list)) {
    let left = row.have;
    row.quests.forEach((q, i) => {
      q.have = i === row.quests.length - 1 ? left : Math.min(left, q.need);
      left -= q.have;
    });
  }
  return list;
}

// Předměty, které má hráč pro úkoly koupit (označení v obchodě). Zůstávají označené i po
// koupi (stav 1/1, 3/1), dokud úkol probíhá.
export function questShoppingList(state) {
  return questMarkList(state, (quest) => {
    // Cíl se surovinami ke koupi (Čistá voda, Vlákno…): označené, dokud cíl běží.
    if (quest.goals) return (currentQuestGoal(state, quest.id)?.needs ?? []).filter((n) => n.kind === 'buy').map((n) => ({ item: n.item, qty: n.qty }));
    return (quest.steps ?? []).filter((s) => s.kind === 'buy').map((s) => ({ item: s.item, qty: s.qty }));
  });
}

// Předměty, které má hráč pro úkol prodat (označení ve výkupu a ve filtru): id předmětu, nebo
// 'jewel' (jakýkoli prsten / amulet) → stejný tvar jako výše (have = prodáno od přijetí).
export function questSellList(state) {
  return questMarkList(state, (quest) => {
    if (!quest.goals) return [];
    const step = currentGoalStep(state, quest.id);
    if (!step || step.isNeed || !step.goal.sellItem) return [];
    const have = goalHave(state, quest.id, step.goal);
    return [step.goal.sellItem].flat().map((item) => ({ item, qty: step.goal.need, have }));
  });
}

// Výrobky pro úkoly (označení receptů v oknech výroby): id výrobku → stejný tvar jako výše.
export function questCraftList(state) {
  return questMarkList(state, (quest) => {
    if (quest.goals) { // cíl s výrobou: označit výrobek, dokud ten cíl běží
      const step = currentGoalStep(state, quest.id);
      if (!step) return [];
      // Chybějící surovina, kterou jde vyrobit (ingot, řemínek, drát): označit ji (stav = zásoba).
      if (step.isNeed) return step.item ? [{ item: step.item, qty: step.qty, have: needCount(state, step) }] : [];
      // have = vyrobeno od přijetí (ne zásoba v inventáři – ta se nepočítá)
      return step.craftItem ? [{ item: step.craftItem, qty: step.goal.need, have: goalHave(state, quest.id, step.goal) }] : [];
    }
    return quest.steps.some((s) => s.kind === 'craft') && quest.deliver ? [{ item: quest.deliver.id, qty: quest.deliver.qty }] : [];
  });
}

export function getQuestStatus(state, questId) {
  const quest = QUESTS[questId];
  const flags = state?.flags ?? {};
  if (!quest) return QUEST_STATUS.notStarted;
  if (flags[quest.flags.completed]) return QUEST_STATUS.done;
  if (!flags[quest.flags.accepted]) return QUEST_STATUS.notStarted;
  if (quest.objectiveCheck) return flags[quest.flags.objective] || quest.objectiveCheck(state) ? QUEST_STATUS.ready : QUEST_STATUS.active;
  if (quest.goals) return flags[quest.flags.objective] || goalsMet(state, quest) ? QUEST_STATUS.ready : QUEST_STATUS.active;
  if (quest.deliver) return getItemCount(state, quest.deliver.id) >= quest.deliver.qty ? QUEST_STATUS.ready : QUEST_STATUS.active;
  if (quest.objectiveItem) return getItemCount(state, quest.objectiveItem.id) >= quest.objectiveItem.qty ? QUEST_STATUS.ready : QUEST_STATUS.active;
  return flags[quest.flags.objective] ? QUEST_STATUS.ready : QUEST_STATUS.active;
}

export function acceptQuest(state, questId) {
  const quest = QUESTS[questId];
  state.flags ??= {};
  state.flags[quest.flags.accepted] = true;
  if (!quest.passive) state.trackedQuest = questId; // přijatý úkol se rovnou sleduje (tečky k cíli)
  quest.onAccept?.(state); // výchozí stav počítadla cíle (state.questBase)
  for (const goal of quest.goals ?? []) { state.questBase ??= {}; state.questBase[goalBaseKey(questId, goal.key)] = questCounter(state, goal.key); }
}

// Úkoly, které se zadají samy (autoAssigned) po dokončení úvodního úkolu – i ve starších
// uložených hrách, kde byl úvodní úkol dokončen dřív. Vrací přijaté úkoly.
export function assignFollowUpQuests(state) {
  if (!state?.flags?.[QUESTS.greenvale_mage_intro.flags.completed]) return [];
  const added = [];
  for (const quest of Object.values(QUESTS)) {
    if (!quest.autoAssigned || getQuestStatus(state, quest.id) !== QUEST_STATUS.notStarted) continue;
    const tracked = state.trackedQuest;
    acceptQuest(state, quest.id);
    if (tracked && getQuestStatus(state, tracked) !== QUEST_STATUS.done) state.trackedQuest = tracked;
    added.push(quest);
  }
  return added;
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
  if (quest.mageCrystal) { // zbylé Mágovy krystaly si Mág vezme zpět
    const left = getItemCount(state, 'mage_crystal');
    if (left > 0) removeItem(state, 'mage_crystal', left);
  }
  if (questId === 'greenvale_mage_intro') {
    addItem(state, 'basic_crystal', 5);
    // Další krok se zadá sám: zajít za léčitelkou Liorou.
    assignFollowUpQuests(state);
  }
  if (quest.rewardGold) state.gold = (Number(state.gold) || 0) + quest.rewardGold;
  // rewardXp: { prof, amount } nebo pole – profese, 'diplomacy' (navíc) a 'hero' (navíc).
  for (const xp of [quest.rewardXp ?? []].flat()) XP_REWARD[xp.prof]?.(state, xp.amount);
  addHeroExp(state, QUEST_HERO_XP);
  // Diplomacie: jednorázové XP za každý splněný úkol.
  grantQuestXp(state, questId);
  // Orčí hrozba otevře cestu do Verdant Forest.
  if (questId === 'greenvale_cave_slime') unlockRegion(state, 'Verdant Forest');
  // Druhá škola: živel si hráč vybere u Mága (chooseSecondSchool).
  if (questId === 'greenvale_second_school') state.flags.secondSchoolPending = true;
}

// Pasivní úkoly (Zápisky krotitele): splněné se dokončí a odmění samy. Vrací dokončené úkoly.
export function completePassiveQuests(state) {
  assignFollowUpQuests(state); // starší hry: pasivní úkol se zadá i bez návštěvy Mága
  const done = [];
  for (const quest of Object.values(QUESTS)) {
    if (!quest.passive || getQuestStatus(state, quest.id) !== QUEST_STATUS.ready) continue;
    completeQuest(state, quest.id);
    done.push(quest);
  }
  return done;
}

// Odměna úkolu Druhá škola: odemkne zvolenou školu magie.
export function chooseSecondSchool(state, school) {
  if (!state?.flags?.secondSchoolPending || !SECOND_SCHOOL_OPTIONS.includes(school)) return null;
  state.flags.secondSchoolPending = false;
  return unlockMagicSchool(state, school);
}

// Úkol jde přijmout až po úkolech v requires (např. další část řemeslné linie, Orčí hrozba
// po základních úkolech).
export function isQuestAvailable(state, questId) {
  return questsBlocking(state, questId).length === 0;
}

// Nedokončené úkoly z requires (pro rozhovor „nejdřív pomoz…“).
export function questsBlocking(state, questId) {
  return (QUESTS[questId]?.requires ?? []).map((id) => QUESTS[id]).filter((q) => q && getQuestStatus(state, q.id) !== QUEST_STATUS.done);
}

// Talentové stromy se odemknou na úrovni hrdiny TALENT_UNLOCK_LEVEL (staré uložené hry,
// kde je odemkl úkol Orčí hrozba, je mají dál).
export function areTalentTreesUnlocked(state) {
  return (Number(state?.level) || 1) >= TALENT_UNLOCK_LEVEL || Boolean(state?.flags?.talentTreesUnlocked);
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
  if (status === QUEST_STATUS.active && quest.goals) {
    const step = currentGoalStep(state, questId);
    if (step?.isNeed) return `${step.text}: ${Math.min(step.qty, needCount(state, step))}/${step.qty}.`;
    const goal = step?.goal;
    return goal ? `${goal.text}: ${Math.min(goal.need, goalHave(state, questId, goal))}/${goal.need}.` : quest.returnTo;
  }
  if (status === QUEST_STATUS.active) return quest.steps ? currentQuestStep(state, questId)?.text ?? '' : quest.objectiveText?.(state) ?? quest.objective;
  if (status === QUEST_STATUS.ready) return quest.returnTo;
  return `Odměna získána: ${quest.reward}`;
}

// Postup úkolu pro HUD: { text, ratio } nebo null. Počítaný cíl (quest.progress), u úkolů
// s odevzdáním kusy předmětu, u vícekrokových číslo kroku; splněný úkol = 1.
export function questProgress(state, questId) {
  const quest = QUESTS[questId];
  if (!quest) return null;
  const status = getQuestStatus(state, questId);
  if (status === QUEST_STATUS.ready) return { text: 'Splněno – odevzdej', ratio: 1 };
  if (status !== QUEST_STATUS.active) return null;
  const goalStep = quest.goals ? currentGoalStep(state, questId) : null;
  const goal = goalStep?.goal ?? null;
  const part = goal && quest.goals.length > 1 ? `Část ${quest.goals.indexOf(goal) + 1}/${quest.goals.length}` : null;
  // Příprava surovin: ukazatel počtu té suroviny; jinak postup cíle.
  const goalProgress = goalStep?.isNeed
    ? { have: needCount(state, goalStep), need: goalStep.qty, label: part ? `${part} · suroviny` : 'Suroviny' }
    : goal ? { have: goalHave(state, questId, goal), need: goal.need, label: part } : null;
  if (quest.progress || goalProgress) {
    const { have, need, label, unit } = goalProgress ?? quest.progress(state);
    const done = Math.max(0, Math.min(need, Math.floor(Number(have) || 0)));
    return { text: `${label ? `${label}: ` : ''}${done} / ${need}${unit ? ` ${unit}` : ''}`, ratio: done / need };
  }
  if (quest.steps?.length) {
    const step = currentQuestStep(state, questId);
    const index = Math.max(0, quest.steps.indexOf(step));
    if (quest.deliver && index === quest.steps.length - 1) {
      const have = Math.min(quest.deliver.qty, getItemCount(state, quest.deliver.id));
      return { text: `${getItem(quest.deliver.id)?.name ?? quest.deliver.id}: ${have} / ${quest.deliver.qty}`, ratio: have / quest.deliver.qty };
    }
    return { text: `Krok ${index + 1} / ${quest.steps.length}`, ratio: index / quest.steps.length };
  }
  if (quest.deliver) {
    const have = Math.min(quest.deliver.qty, getItemCount(state, quest.deliver.id));
    return { text: `${getItem(quest.deliver.id)?.name ?? quest.deliver.id}: ${have} / ${quest.deliver.qty}`, ratio: have / quest.deliver.qty };
  }
  return null;
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
  if (!QUESTS[questId]) return null; // zrušený úkol (např. Píseň větrů ve starém kódu)
  const status = getQuestStatus(state, questId);
  if (role === 'giver') {
    if (status === QUEST_STATUS.notStarted) return isQuestAvailable(state, questId) ? { char: '!', color: QUEST_MARK_GOLD } : null;
    if (status === QUEST_STATUS.ready) return { char: '?', color: QUEST_MARK_GOLD };
    return null;
  }
  if (role === 'objective' && status === QUEST_STATUS.active) {
    const quest = QUESTS[questId];
    if ((quest?.steps || quest?.goals) && buildingId && objectiveTargetOf(state, quest)?.id !== buildingId) return null;
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
