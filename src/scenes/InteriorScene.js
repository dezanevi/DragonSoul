import Phaser from 'phaser';
import { goldText } from '../ui/goldText.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { unlockRegion } from '../systems/RegionSystem.js';
import { addItem, getItemCount } from '../systems/InventorySystem.js';
import { eatMeal } from '../systems/CookingSystem.js';
import { confirmSpend, withSpend } from '../ui/spendConfirm.js';
import { COOKING_BY_ID } from '../data/cooking.js';
import { createCardTabBar, CARD_FOR_TAB, slideCardIn, slideCardOut } from '../ui/cardTabBar.js';
import { nineImage, drawCardFrame, cardCloseButton, cardText, cardButton, uiToast, CARD_PANEL } from '../ui/fantasyCard.js';
import {
  bindBusinessState, grantDialogXp, onDiplomacyXp, diplomacyLevel, canBuyProperty, buyProperty, getShop,
  PROPERTIES, PROPERTY_TYPES
} from '../systems/DiplomacySystem.js';
import {
  QUESTS,
  QUEST_STATUS,
  getQuestStatus,
  acceptQuest,
  completeQuest,
  markQuestObjective,
  questMark,
  questStep,
  isQuestAvailable,
  questsBlocking,
  assignFollowUpQuests,
  chooseSecondSchool,
  SECOND_SCHOOL_OPTIONS,
  currentQuestStep,
  currentQuestGoal,
  QUEST_MARK_BLUE
} from '../systems/QuestSystem.js';
import { itemSources } from '../systems/ProfessionDatabase.js';
const HEALER_QUEST = 'greenvale_visit_healer';
const HEALER_HERBS_QUEST = 'greenvale_healer_herbs';
const INTRO_QUEST = 'greenvale_mage_intro';
import skillRowsForInterior from '../data/skills.json';
import { tickTime, isSleepTime, sleepUntilDawn, advanceMinutes, dayClockLabel } from '../systems/TimeSystem.js';

// Interiér = karta stejné velikosti jako ostatní karty s obrázkem místnosti
// (public/assets/interiors). Postavy a předměty na obrázku jsou klikací místa:
// najetí myší je zvýrazní, kliknutí otevře příslušné menu (obchod, vaření, výheň…).

const CAVE_QUEST = 'greenvale_cave_slime';
const IMAGE_DIR = 'assets/interiors/';
// Souřadnice klikacích míst jsou v náhledu obrázku 1000 × 563 (= celý obrázek).
const SOURCE = { w: 1000, h: 563 };
// Obrázek vyplní vnitřek karty (okraje se ořežou, poměr stran zůstane).
const INNER = { x: CARD_PANEL.x + 24, y: CARD_PANEL.y + 24, w: CARD_PANEL.w - 48, h: CARD_PANEL.h - 48 };

const IMAGES = {
  townHall: 'Fantazijní radnice s úředníky a mapou.png',
  tavern: 'Pohádková krčma u plápolajícího krbu.png',
  hostess: 'Zrzavá hostitelka u krbu-2.png',
  smithy: 'Kovářská dílna plná legendární výbavy.png',
  fishing: 'Rybářská dílna u horského jezera.png',
  cottage: 'Útulná chalupa s poutníkem a krbem-3.png',
  herbalist: 'Útulný domek s bylinkářkou-1.png',
  foodStall: 'Veselý stánek s ovocem na tržišti-2.png',
  clothStall: 'Stánek s látkami a usměvavým obchodníkem-1.png',
  alchemist: 'Alchymistova bylinková dílna.png',
  mage: 'Kouzelnická pracovna plná magie.png',
  tannery: 'Fantasy Koželužnická Dílná s Řemeslnicí.png',
  ownSmallShop: 'Diplomacy/Středověký obchod s kouzelnou atmosférou-1.png'
};

const cottageSpots = (residentLabel) => [
  { label: residentLabel, verb: 'mluvit', rect: [255, 135, 150, 265], action: 'talk',
    lines: ['Vítej. U krbu si můžeš uvařit, co sis přinesl.'] },
  { label: 'Krb – kuchyňský sporák', verb: 'vařit', rect: [428, 150, 285, 290], action: 'kitchen', station: 2 }
];

// title = název karty; resident = jméno hlavní postavy (dialogy, obchody); spots = klikací místa.
// Plné vyléčení: hrdina (HP, mana), monstra v partě i v úschovně.
export function restoreParty(state) {
  state.hp = state.maxHp;
  state.mp = state.maxMp;
  for (const monster of [...(state.party ?? []), ...(state.monsterStorage ?? [])]) {
    if (monster.stats) monster.currentHp = monster.stats.vitality;
    monster.skillUses ??= {};
    for (const skillId of monster.skills ?? []) {
      const skill = getSkillForInterior(skillId);
      if (skill) monster.skillUses[skillId] = skill.maxUses;
    }
  }
}

// Místa odpočinku: sem se hrdina vrátí po porážce (poslední navštívené). Hodnota = kdo ho přivítá.
export const REST_POINTS = { greenvale_tavern: 'Výčepní', greenvale_home_3: 'Liora, léčitelka' };
// Obchody nad interiérem (navštívené se značí do flags.visitedShops; sám se po vstupu
// otevře jen obchod na tržišti – autoOpenShop).
const SHOP_SCENES = ['MerchantShop', 'HerbalistShop', 'FishingShop', 'MiningShop'];
// Hostinec podle denní doby (TimeSystem): od 20:00 do 05:00 přenocování do úsvitu se snídaní,
// přes den odpočinek na pár hodin (levnější, bez snídaně). Obojí vyléčí partu a obnoví manu.
const ROOM_PRICE = 10;
const REST_PRICE = 5;
const REST_HOURS = 2;
const REST_MEAL_PRICE = 5; // jídlo k odpočinku přes den (stejný vývar jako snídaně k noclehu)
const ROOM_MEAL = 'V043'; // Masový vývar se zeleninou – snídaně k pokoji

// Liora při odevzdání Léčivých bylin řekne o hostinci (odpočinek přes den, přenocování večer).
const INN_TIP = 'A až budeš unavený, zajdi do hostince: přes den si u výčepní na pár hodin odpočineš, večer tam přespíš i se snídaní.';

// Pracoviště → profese (modrý „?“ nad pracovištěm, když má hráč pro úkol něco vyrobit).
const STATION_PROF = { kitchen: 'cooking', alchemy: 'alchemy', forge: 'smithing', craft: 'crafting' };

// Co má hráč teď vyrobit pro probíhající úkol (aktuální krok = výroba): [{ prof, station }]
// (station = pracoviště receptu; Řemeslnictví potřebuje přesně to, ostatní aspoň takové).
function questCraftNeeds(state) {
  const needs = [];
  for (const quest of Object.values(QUESTS)) {
    if (quest.goals && getQuestStatus(state, quest.id) === QUEST_STATUS.active) {
      const item = currentQuestGoal(state, quest.id)?.craftItem;
      const recipe = item ? itemSources(item).find((source) => source.kind === 'recipe') : null;
      if (recipe) needs.push({ prof: recipe.prof, station: Number(recipe.recipe?.station) || 1 });
      continue;
    }
    if (!quest.deliver || getQuestStatus(state, quest.id) !== QUEST_STATUS.active) continue;
    if (currentQuestStep(state, quest.id)?.kind !== 'craft') continue;
    const recipe = itemSources(quest.deliver.id).find((source) => source.kind === 'recipe');
    if (recipe) needs.push({ prof: recipe.prof, station: Number(recipe.recipe?.station) || 1 });
  }
  return needs;
}

// Úkoly Mága po úvodní zkoušce (nabídka rozhovoru u Mága).
const MAGE_QUESTS = ['greenvale_new_companion', 'greenvale_spell_song', 'greenvale_second_school'];
// Řemeslné linie (data/craftQuests.js): úkoly postav v pořadí linie.
const FISHER_QUESTS = ['greenvale_fish_dock', 'greenvale_fish_demand', 'greenvale_fish_rare'];
const MINER_QUESTS = ['greenvale_mine_stone', 'greenvale_mine_iron', 'greenvale_mine_tin', 'greenvale_smith_ingot', 'greenvale_smith_weapon'];
const HERBALIST_QUESTS = ['greenvale_herb_farm', 'greenvale_herb_rare'];
const MARKET_QUESTS = ['greenvale_cook_market', 'greenvale_cook_fish'];
const ALCHEMIST_QUESTS = ['greenvale_alch_mana', 'greenvale_alch_repel'];
const CRAFTER_QUESTS = ['greenvale_craft_hide', 'greenvale_craft_jewel', 'greenvale_craft_crystal'];
const giverMarker = ([quest, ...more]) => ({ quest, role: 'giver', more });
const SCHOOL_NAMES_CZ = { fire: 'Oheň', water: 'Voda', earth: 'Země', light: 'Světlo', dark: 'Stín' };
// Souhrn škol při najetí myší na volbu druhého živlu (kouzla podle data/spells.json, výhody podle ElementSystem).
const SCHOOL_INFO = {
  fire: 'Oheň: nejsilnější přímé poškození (Ohnivá koule, Meteorický úder, Pekelný žár na všechny). Silný proti přírodě, slabý proti světlu.',
  water: 'Voda: útoky i léčení party (Léčivý pramen, Pramen života, Osvěžující déšť). Silná proti stínu, slabá proti vzduchu.',
  earth: 'Země: útoky i ochrana (Kamenná kůže, Žulový štít, Zlom země na všechny). Silná proti vzduchu, slabá proti přírodě.',
  light: 'Světlo: útoky a požehnání party (Sluneční paprsek, Pád hvězdy na 3 cíle, Požehnání). Silné proti ohni, slabé proti stínu.',
  dark: 'Stín: čistě útočná škola (Stínový šíp, Trhlina duše, Paprsek propasti na všechny). Silný proti světlu, slabý proti vodě.'
};

// „Promluvit“ v nabídce postavy (InteriorScene.talkOptions): rady bez obchodu a úkolu.
const NPC_TALK = {
  herbalist: [
    'Naleziště bylin poznáš podle zeleného kruhu s lístkem – na louce, u řeky, v lese i u vodopádu.',
    'Záhony za mostem na statku obnovuju každých dvanáct hodin, vzácné byliny dorostou za dva dny. Až budeš mít Sběr bylin na pětadvacítce, přijď si vybrat specializaci.'
  ],
  fisher: [
    'Rybářská místa poznáš podle modrého kruhu u vody – na molu a podél břehu.',
    'Každý den hledám jeden druh ryby a za ten zaplatím víc. Podívej se do obchodu, co to dnes je.'
  ],
  miner: [
    'Naleziště poznáš podle hnědého kruhu s krumpáčem. Lom je za mostem na jihozápadě, u řeky.',
    'Vytěžené místo chvíli odpočívá: běžné žíly dvanáct hodin, vzácné dva dny. Až budeš mít Těžbu na pětadvacítce, přijď si vybrat specializaci.'
  ],
  mayor: [
    'Greenvale je malá vesnice, ale lidi tu drží při sobě. Kdo pomáhá, tomu se pomáhá.',
    'Vyhlášky a práce najdeš na nástěnce vlevo.'
  ]
};

const INTERIOR_DEFINITIONS = {
  greenvale_town_hall: {
    title: 'Radnice Greenvale',
    image: IMAGES.townHall,
    resident: 'Starosta Edric',
    spots: [
      { label: 'Starosta Edric', verb: 'mluvit', rect: [418, 195, 130, 125], action: 'mayor', quests: ['greenvale_own_shop'],
        questMarker: { quest: 'greenvale_cave_slime', role: 'giver', more: ['greenvale_own_shop'] } },
      { label: 'Nástěnka úkolů', verb: 'prohlédnout', rect: [22, 88, 212, 232], action: 'board' },
      { label: 'Mapa světa', verb: 'otevřít', rect: [752, 95, 232, 170], action: 'card', card: 'WorldMap' },
      { label: 'Úřednice', verb: 'mluvit', rect: [243, 182, 85, 165], action: 'talk', quests: ['greenvale_ledger'], questMarker: giverMarker(['greenvale_ledger']),
        lines: ['Starosta přijímá lovce každý den. Vyhlášky visí na nástěnce vlevo.'] },
      { label: 'Strážný', verb: 'mluvit', rect: [652, 172, 85, 228], action: 'questGiver', quest: 'greenvale_training',
        questMarker: { quest: 'greenvale_training', role: 'giver' },
        lines: ['Na radnici je klid. Ale v jeskyni za vesnicí se něco usadilo – buď opatrný.'] }
    ]
  },
  greenvale_tavern: {
    title: 'Hostinec Greenvale',
    image: IMAGES.tavern,
    resident: 'Výčepní',
    spots: [
      { label: 'Výčepní', verb: 'pokoj', rect: [185, 140, 120, 165], action: 'innRoom', quests: ['greenvale_cook_battle'], questMarker: giverMarker(['greenvale_cook_battle']) },
      { label: 'Hostinská kuchyně', verb: 'vařit', rect: [582, 160, 235, 145], action: 'kitchen', station: 4 },
      { label: 'Sklep – úschovna monster', verb: 'otevřít', rect: [0, 170, 140, 135], action: 'card', card: 'Party' },
      { label: 'Bard', verb: 'mluvit', rect: [478, 172, 110, 140], action: 'bard',
        lines: ['Zahraju ti o lovci, který ochočil draka… nebo aspoň Dire Wolfa.', 'Na louce západně od vesnice se toulají divoká monstra. Kdo je umí zkrotit, nikdy nebude sám.'] },
      { label: 'Lovec u stolu', verb: 'mluvit', rect: [840, 212, 112, 108], action: 'questGiver', quest: 'greenvale_first_hunt',
        questMarker: { quest: 'greenvale_first_hunt', role: 'giver' },
        lines: ['Než vyrazíš na louku, odpočiň si tu na pokoji – ráno k tomu dají masový vývar se zeleninou, ten tě drží po soubojích. Nebo zajdi za Liorou do domu léčitelky.', 'A dobrý pokrm z kuchyně ti v boji přidá sílu – ověřeno.'] }
    ]
  },
  greenvale_smithy: {
    title: 'Kovárna Greenvale',
    image: IMAGES.smithy,
    // Hornický mistr (Těžba): krumpáče, výkup surovin, specializace.
    resident: 'Hornický mistr',
    spots: [
      { label: 'Hornický mistr', verb: 'mluvit', rect: [490, 118, 150, 350], action: 'miner', quests: MINER_QUESTS, questMarker: giverMarker(MINER_QUESTS) },
      { label: 'Výheň (dočasně umí vše)', verb: 'kovat', rect: [690, 110, 290, 300], action: 'forge', station: 4 },
      { label: 'Kovadlina', verb: 'kovat', rect: [443, 310, 165, 80], action: 'forge', station: 4 },
      { label: 'Učednice', verb: 'mluvit', rect: [255, 140, 110, 260], action: 'questGiver', quest: 'greenvale_leather_strap', questMarker: { quest: 'greenvale_leather_strap', role: 'giver' },
        lines: ['Mistr ti prodá krumpáč a vykoupí suroviny. U výhně si ukuješ výbavu.'] }
    ]
  },
  greenvale_fishing_hut: {
    title: 'Rybářská chata',
    image: IMAGES.fishing,
    resident: 'Rybář',
    spots: [
      { label: 'Rybář', verb: 'mluvit', rect: [238, 88, 200, 315], action: 'fisher', quests: FISHER_QUESTS, questMarker: giverMarker(FISHER_QUESTS) },
      { label: 'Rybářské náčiní', verb: 'obchod', rect: [600, 82, 180, 250], action: 'fishingShop' }
    ]
  },
  greenvale_market: {
    title: 'Tržiště – potraviny',
    image: IMAGES.foodStall,
    spots: [
      { label: 'Trhovkyně', verb: 'mluvit', rect: [445, 65, 250, 330], action: 'talk',
        lines: ['Čerstvé ovoce, zelenina, houby a čistá voda! Podívej se, co dnes mám.'], shop: 'marketFood', quests: MARKET_QUESTS,
        questMarker: { quest: 'greenvale_clean_water', role: 'objective', more: MARKET_QUESTS } }
    ]
  },
  greenvale_market_wares: {
    title: 'Tržiště – zboží',
    image: IMAGES.clothStall,
    spots: [
      { label: 'Obchodník s látkami', verb: 'mluvit', rect: [365, 95, 215, 320], action: 'talk',
        lines: ['Látky, vlákno, kůže a vosk – všechno pro řemeslníky.'], shop: 'marketWares', quests: ['greenvale_gear'],
        questMarker: { quest: 'greenvale_leather_strap', role: 'objective', more: ['greenvale_gear'] } }
    ]
  },
  greenvale_alchemist: {
    title: 'Alchymistický obchod',
    image: IMAGES.alchemist,
    spots: [
      { label: 'Alchymista', verb: 'mluvit', rect: [315, 125, 170, 275], action: 'questGiver', quest: 'greenvale_clean_water', quests: ALCHEMIST_QUESTS,
        questMarker: { quest: 'greenvale_clean_water', role: 'giver', more: ALCHEMIST_QUESTS },
        lines: ['Destilační přístroj i hmoždíř jsou ti k dispozici. Zatím umí všechny recepty.'] },
      { label: 'Alchymistický stůl (dočasně umí vše)', verb: 'alchymie', rect: [560, 195, 150, 235], action: 'alchemy', station: 4 },
      { label: 'Alchymistický stůl (dočasně umí vše)', verb: 'alchymie', rect: [200, 340, 330, 120], action: 'alchemy', station: 4 }
    ]
  },
  greenvale_observatory: {
    title: 'Hvězdárna',
    image: IMAGES.mage,
    spots: [
      { label: 'Mág', verb: 'mluvit', rect: [290, 180, 180, 290], action: 'mage', quests: MAGE_QUESTS,
        questMarker: { quest: 'greenvale_mage_intro', role: 'giver', more: MAGE_QUESTS },
        lines: ['Hvězdy prozradí mnohé. Další školy magie tě naučím, až na to budeš připraven.', 'Křišťálová koule u mě slouží jako Soul Crystal Workbench – vyrobíš na ní Soul Crystaly.'] },
      { label: 'Soul Crystal Workbench', verb: 'vyrábět', rect: [200, 280, 140, 110], action: 'craft', station: 3 }
    ]
  },
  // Řemeslná dílna (Řemeslnictví): koželužský a šperkařský stůl.
  greenvale_house_e1: {
    title: 'Řemeslná dílna',
    image: IMAGES.tannery,
    spots: [
      { label: 'Řemeslnice', verb: 'mluvit', rect: [345, 110, 150, 280], action: 'talk', quests: CRAFTER_QUESTS, questMarker: giverMarker(CRAFTER_QUESTS),
        lines: ['Kůže, šperky, fokusy, brašny – tady se vyrábí všechno, co není z kovu. Kovové úchyty a dráty ti ukuje kovář.',
          'Drahokamy z Těžby ti tu nabrousíš na šperkařském stole. Soul Crystaly vyrábí mág v Hvězdárně na svém pracovním stole.'] },
      { label: 'Koželužský stůl', verb: 'vyrábět', rect: [565, 240, 275, 160], action: 'craft', station: 1 },
      { label: 'Šicí stroj – koželužský stůl', verb: 'vyrábět', rect: [95, 205, 150, 100], action: 'craft', station: 1 },
      { label: 'Šperkařský stůl', verb: 'vyrábět', rect: [110, 365, 280, 110], action: 'craft', station: 2 }
    ]
  },
  greenvale_hunter_lodge: { title: 'Lovecká chata', image: IMAGES.cottage, spots: cottageSpots('Poutník') },
  // Bylinkářka (Sběr bylin): startovní srp, obchod s omezenou zásobou bylin, výkup, specializace.
  greenvale_home_1: {
    title: 'Dům Bylinkářky',
    image: IMAGES.herbalist,
    spots: [
      { label: 'Bylinkářka', verb: 'mluvit', rect: [238, 125, 168, 425], action: 'herbalist', quests: HERBALIST_QUESTS,
        questMarker: { quest: 'greenvale_river_herbs', role: 'giver', more: HERBALIST_QUESTS } },
      { label: 'Sušené byliny a semena', verb: 'obchod', rect: [0, 0, 230, 330], action: 'herbalistShop' },
      { label: 'Krb – kuchyňský sporák', verb: 'vařit', rect: [768, 150, 232, 200], action: 'kitchen', station: 2 }
    ]
  },
  greenvale_home_2: { title: 'Dům v Greenvale', image: IMAGES.cottage, spots: cottageSpots('Obyvatel domu') },
  // Vlastní obchod hráče (Diplomacie): zelený dům u náměstí, koupě u starosty od Diplomacie 10.
  greenvale_house_w1: {
    title: 'Tvůj obchod – Zelený dům',
    image: IMAGES.ownSmallShop,
    ownShop: true,
    spots: [
      { label: 'Prodejní pult', verb: 'prodej a ceny', rect: [0, 300, 470, 175], action: 'ownShop', tab: 'sale' },
      { label: 'Sklad – police a bedny', verb: 'sklad', rect: [805, 90, 175, 300], action: 'ownShop', tab: 'storage' },
      { label: 'Účetní kniha', verb: 'statistiky', rect: [95, 245, 120, 80], action: 'ownShop', tab: 'stats' }
    ]
  },
  // Dům léčitelky Liory: léčí zdarma, u ní jde přesouvat monstra mezi partou a úschovnou.
  greenvale_home_3: {
    title: 'Dům léčitelky',
    image: IMAGES.hostess,
    resident: 'Liora, léčitelka',
    storageAccess: true,
    spots: [
      { label: 'Liora, léčitelka', verb: 'léčit', rect: [300, 115, 170, 300], action: 'healer',
        questMarker: { quest: 'greenvale_visit_healer', role: 'objective', alt: 'greenvale_healer_herbs', altRole: 'giver' } },
      { label: 'Krb – kuchyňský sporák', verb: 'vařit', rect: [632, 178, 298, 250], action: 'kitchen', station: 2 }
    ]
  }
};

const imageKey = (file) => `interior:${file}`;

export default class InteriorScene extends Phaser.Scene {
  constructor() {
    super('Interior');
  }

  create(data) {
    this.state = data?.state ?? SaveSystem.load();
    if (!this.state) {
      this.scene.start('Menu');
      return;
    }

    this.interiorId = data?.interiorId ?? this.state.interiorId;
    this.interior = INTERIOR_DEFINITIONS[this.interiorId];
    if (!this.interior) {
      console.error(`Neznámý interiér: ${this.interiorId}`);
      this.state.interiorId = null;
      this.scene.start('World', { state: this.state });
      return;
    }

    this.state.interiorId = this.interiorId;
    if (REST_POINTS[this.interiorId]) this.state.lastRestPoint = this.interiorId;
    // Diplomacie: obchody běží se stavem této hry; zisk XP = krátké oznámení dole.
    bindBusinessState(this.state);
    this.offXp?.();
    this.offXp = onDiplomacyXp((r) => {
      // Obchody hlásí XP samy (zpráva košíku, karta obchodu) – tady jen rozhovory, úkoly a nové úrovně.
      if (!this.sys.isActive() || (r.reason === 'Obchod' && !r.levelUps)) return;
      uiToast(this, r.levelUps ? `Diplomacie: úroveň ${r.level}! (+${r.gained} XP)` : `+${r.gained} XP Diplomacie (${r.reason})`, { y: INNER.y + 120, depth: 6000 });
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.offXp?.(); this.offXp = null; });
    this.fromWorld = Boolean(data?.fromWorld);
    this.dialogLines = null;
    this.dialogIndex = 0;
    this.dialogSpeaker = '';
    this.afterDialog = null;
    this.closing = false;
    // Scéna se používá znovu – odkazy na objekty minulé místnosti zahodit.
    this.questMarkers = [];
    this.choiceObjects = null;
    this.spotLabel = null;
    this.spotPlate = null;

    // Bez světa v pozadí (hra nahraná v interiéru) tmavé pozadí.
    if (!this.fromWorld) this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b0f14, 1).setOrigin(0);
    drawCardFrame(this);

    this.buildDialog();
    this.tabBar = createCardTabBar(this, null, {
      state: this.state,
      onSelect: (tabId, sceneKey) => {
        if (!this.dialogLines) this.openCard(sceneKey, CARD_FOR_TAB[tabId] ? undefined : tabId);
      }
    });
    this.closeButton = cardCloseButton(this, () => this.leaveInterior());

    // Obrázek se načítá až při prvním vstupu (velké soubory, nepotřebné při startu hry).
    const key = imageKey(this.interior.image);
    if (this.textures.exists(key)) {
      this.buildRoom(key);
    } else {
      const loading = cardText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Načítám…', { size: 28, originX: 0.5, originY: 0.5 });
      this.load.image(key, encodeURI(IMAGE_DIR + this.interior.image));
      this.load.once('complete', () => {
        loading.destroy();
        if (this.sys.isActive() || this.sys.isPaused()) this.buildRoom(key);
      });
      this.load.start();
    }

    this.onKeyDown = (event) => {
      if (event.repeat || this.closing) return;
      if (performance.now() < (this.ignoreKeysUntil ?? 0)) return;
      if (this.choiceObjects) {
        const key = event.code === 'NumpadEnter' ? 'Enter' : event.code;
        if (this.choiceKeys?.[key]) this.choiceKeys[key]();
        else if (event.code === 'Escape') this.closeChoice();
        return;
      }
      if (this.dialogLines) {
        if (['KeyE', 'Space', 'Enter'].includes(event.code)) this.advanceDialog();
        else if (event.code === 'Escape') this.closeDialog();
        return;
      }
      // Karty jdou otevřít i v interiéru.
      const cardKeys = { KeyC: 'Hero', KeyT: 'Talents', KeyP: 'Party', KeyI: 'Inventory', KeyM: 'WorldMap' };
      if (cardKeys[event.code]) {
        this.openCard(cardKeys[event.code]);
        return;
      }
      // Esc / E zavře interiér jako kartu (ven do Greenvale).
      if (event.code === 'Escape' || event.code === 'KeyE') this.leaveInterior();
    };
    this.input.keyboard.on('keydown', this.onKeyDown);

    // Stejné stisknutí, které zavřelo kartu nad interiérem, nesmí hned zavřít i interiér.
    this.onResume = () => {
      this.input.keyboard.resetKeys();
      this.ignoreKeysUntil = performance.now() + 250;
      this.tabBar?.resetHover();
      this.refreshQuestMarker();
    };
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, this.onResume);
      this.input.keyboard.off('keydown', this.onKeyDown);
    });

    // Navštívené tržiště: obchod se otevře hned (bez vysunutí interiéru, ať neproblikne).
    const shopSpot = this.textures.exists(key) ? this.autoShopSpot() : null;
    if (!shopSpot && data?.animateIn !== false && this.fromWorld) slideCardIn(this, { hide: this.tabBar.objects });
    SaveSystem.save(this.state);
    if (shopSpot) this.openMerchantShop(shopSpot.shop);
    else if (!this.textures.exists(key)) this.load.once('complete', () => this.autoOpenShop());
  }

  // Obchod, který už hráč navštívil, se po vstupu otevře hned (bez rozhovoru). Ne když
  // u postavy v interiéru čeká úkol („!“ / „?“) nebo běží úvodní hláška – to má přednost.
  autoShopSpot() {
    if (!this.state.flags?.visitedShops?.[this.interiorId] || this.dialogLines || this.choiceObjects) return null;
    if ((this.questMarkers ?? []).some(({ marker }) => marker.text)) return null;
    // Jen tržiště (stánky obchodníků, spot.shop). Bylinkářka, Rybář a Hornický mistr mají
    // úkoly a rozhovory – u nich se obchod sám neotevře (nabídka postavy).
    return (this.interior?.spots ?? []).find((s) => s.shop) ?? null;
  }

  // Náhradní cesta, když se obrázek interiéru teprve načítal (značky úkolů vznikly až po načtení).
  autoOpenShop() {
    const spot = this.autoShopSpot();
    if (!spot) return;
    const open = () => {
      if (this.dialogLines || this.choiceObjects || !this.scene.isActive()) return;
      this.openMerchantShop(spot.shop);
    };
    this.time.delayedCall(this.fromWorld ? 380 : 60, open);
  }

  // ------------------------------------------------------------------ místnost

  buildRoom(key) {
    const image = this.add.image(0, 0, key).setOrigin(0);
    const tw = image.width;
    const th = image.height;
    // „cover“: vyplnit vnitřek karty, přesah oříznout rovnoměrně.
    const scale = Math.max(INNER.w / tw, INNER.h / th);
    const cropX = (tw - INNER.w / scale) / 2;
    const cropY = (th - INNER.h / scale) / 2;
    image.setScale(scale).setPosition(INNER.x - cropX * scale, INNER.y - cropY * scale);
    image.setCrop(cropX, cropY, tw - cropX * 2, th - cropY * 2);
    if (this.closeButton?.scene === this) this.children.moveBelow(image, this.closeButton);

    // Převod souřadnic náhledu (1000 × 563) na obrazovku.
    const toScreen = ([x, y, w, h]) => ({
      x: image.x + (x / SOURCE.w) * tw * scale,
      y: image.y + (y / SOURCE.h) * th * scale,
      w: (w / SOURCE.w) * tw * scale,
      h: (h / SOURCE.h) * th * scale
    });

    // Název místnosti nahoře uprostřed na tmavém štítku.
    // Vlastní obchod nese jméno, které mu dal hráč.
    const shopName = this.interior.ownShop ? getShop(this.state, this.interiorId)?.name : null;
    const title = cardText(this, GAME_WIDTH / 2, INNER.y + 34, shopName ? `Tvůj obchod – ${shopName}` : this.interior.title, {
      size: 36, bold: true, color: '#ffe7ae', originX: 0.5, originY: 0.5, strokeThickness: 5
    });
    const plate = nineImage(this, 'nu-panel', GAME_WIDTH / 2 - title.width / 2 - 40, INNER.y + 6, title.width + 80, 58, 0.5);
    plate?.setAlpha(0.92);
    title.setDepth(11);
    plate?.setDepth(10);

    // Nápověda vlevo dole.
    cardText(this, INNER.x + 24, INNER.y + INNER.h - 30, 'Klikni na postavu nebo předmět · Esc = odejít', {
      size: 20, color: '#f3e4bd', originY: 0.5, strokeThickness: 4
    }).setDepth(11);
    // Hodiny vpravo dole (den, čas, denní doba) – mění se po herních minutách (update).
    this.clockLabel = cardText(this, INNER.x + INNER.w - 24, INNER.y + INNER.h - 30, dayClockLabel(this.state), {
      size: 20, bold: true, color: '#cfe2f5', originX: 1, originY: 0.5, strokeThickness: 4
    }).setDepth(11);

    const highlight = this.add.graphics().setDepth(12);
    this.spotLabel = cardText(this, 0, 0, '', { size: 22, bold: true, color: '#fff2c4', originX: 0.5, originY: 1, strokeThickness: 5 })
      .setDepth(13).setVisible(false);
    this.spotPlate = this.add.graphics().setDepth(12);

    for (const spot of this.interior.spots) {
      const r = toScreen(spot.rect);
      const zone = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        if (this.dialogLines) return;
        highlight.clear();
        highlight.fillStyle(0xfff2c4, 0.1).fillRoundedRect(r.x, r.y, r.w, r.h, 14);
        highlight.lineStyle(4, 0xffd76a, 0.95).strokeRoundedRect(r.x, r.y, r.w, r.h, 14);
        // Výčepní: popisek podle denní doby (přenocování / odpočinek).
        const offer = spot.action === 'innRoom' ? this.innOffer() : spot;
        this.showSpotLabel(`${offer.label} – ${offer.verb}`, r.x + r.w / 2, r.y - 8);
      });
      zone.on('pointerout', () => {
        highlight.clear();
        this.hideSpotLabel();
      });
      zone.on('pointerup', () => {
        if (this.dialogLines || this.closing) return;
        highlight.clear();
        this.hideSpotLabel();
        this.useSpot(spot);
      });

      // Pracoviště (výheň, alchymistický stůl, koželužský stůl, kuchyně): modrý „?“, když má hráč
      // pro probíhající úkol něco vyrobit – jen nad prvním pracovištěm dané profese v místnosti.
      if (STATION_PROF[spot.action]) spot.stationMarker = { prof: STATION_PROF[spot.action], rank: Number(spot.station) || 1 };
      if (spot.questMarker || spot.stationMarker) {
        const marker = cardText(this, r.x + r.w / 2, r.y - 6, '', {
          size: 54, bold: true, color: '#ffd23a', originX: 0.5, originY: 1, strokeThickness: 7
        }).setDepth(11);
        this.tweens.add({ targets: marker, y: r.y - 18, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.questMarkers.push({ marker, ...(spot.questMarker ?? {}), station: spot.stationMarker });
      }
    }
    this.refreshQuestMarker();

    // Po porážce v souboji: hrdina se probral tady (BattleScene → lastRestPoint).
    if (this.state.flags?.revivedHere) {
      this.state.flags.revivedHere = false;
      const who = REST_POINTS[this.interiorId];
      this.time.delayedCall(450, () => { if (!this.dialogLines && !this.closing) this.showDialog(who, [
        this.interiorId === 'greenvale_tavern'
          ? 'Našli tě na cestě v bezvědomí a přinesli tě sem. Vyspal ses na pokoji – tentokrát na účet podniku.'
          : 'Přinesli tě ke mně v bezvědomí. Neboj, ty i tvoji společníci jste zase v pořádku.',
        'Tvoje monstra jsou vyléčená. Příště si dej pozor, na co se na loukách pouštíš.'
      ]); });
    }

    // Hvězdárna: Mág promluví sám – na začátku nové hry (úvodní úkol) a po ochočení
    // Air Elementala (hráč se sem přenese ze souboje).
    if (this.interiorId === 'greenvale_observatory') {
      const status = getQuestStatus(this.state, INTRO_QUEST);
      if ((status === QUEST_STATUS.notStarted && this.state.flags?.introPending) || status === QUEST_STATUS.ready) {
        this.time.delayedCall(450, () => { if (!this.dialogLines && !this.closing) this.talkMageIntro(); });
      }
    }
  }

  showSpotLabel(text, x, y) {
    const t = this.spotLabel.setText(text).setVisible(true);
    const minX = INNER.x + t.width / 2 + 16;
    const maxX = INNER.x + INNER.w - t.width / 2 - 16;
    t.setPosition(Phaser.Math.Clamp(x, minX, maxX), Math.max(INNER.y + t.height + 76, y));
    this.spotPlate.clear();
    this.spotPlate.fillStyle(0x05080c, 0.78).fillRoundedRect(t.x - t.width / 2 - 14, t.y - t.height - 6, t.width + 28, t.height + 12, 10);
    this.spotPlate.lineStyle(2, 0xd6a23a, 0.9).strokeRoundedRect(t.x - t.width / 2 - 14, t.y - t.height - 6, t.width + 28, t.height + 12, 10);
  }

  hideSpotLabel() {
    this.spotLabel?.setVisible(false);
    this.spotPlate?.clear();
  }

  useSpot(spot) {
    // Postava s více možnostmi (úkol, obchod, léčení, rozhovor): nabídka, co chce hráč spustit.
    const options = this.talkOptions(spot);
    if (options && options.length > 1) {
      this.showTalkMenu(spot.label, options);
      return;
    }
    switch (spot.action) {
      case 'mayor': this.talkToMayor(); break;
      case 'ownShop': this.launchOver('OwnShop', { shopId: this.interiorId, tab: spot.tab, animateIn: true }); break;
      case 'healer': this.talkToHealer(); break;
      case 'innRoom': this.rentRoom(); break;
      case 'fisher': this.talkToFisher(); break;
      case 'fishingShop': this.openFishingShop(); break;
      case 'miner': this.talkToMiner(); break;
      case 'herbalist': this.talkToHerbalist(); break;
      case 'herbalistShop': this.openHerbalistShop(); break;
      case 'kitchen': this.openCooking(spot.station); break;
      case 'forge': this.openCooking(spot.station, 'Smithing', 'Výheň (dočasně umí vše)'); break;
      case 'alchemy': this.openCooking(spot.station, 'Alchemy', 'Alchymistický stůl (dočasně umí vše)'); break;
      case 'craft': this.openCooking(spot.station, 'Crafting', spot.label.replace(' – koželužský stůl', '')); break;
      case 'card': this.openCard(spot.card); break;
      case 'board': this.showBoard(); break;
      case 'mage': this.talkToMage(spot); break;
      case 'questGiver': this.talkQuestGiver(spot); break;
      case 'bard': this.talkToBard(spot); break;
      default:
        // Obchodník: po rozhovoru se otevře jeho obchod (data/merchants.js).
        if (spot.shop) this.afterDialog = () => this.openMerchantShop(spot.shop);
        this.showDialog(spot.label, spot.lines ?? ['…']);
        break;
    }
    // Značky „!“ / „?“ hned podle nového stavu úkolu (přijetí, splnění cíle, odevzdání).
    this.refreshQuestMarker();
  }

  // Nástěnka: nedokončené úkoly oblasti v kartě Úkoly (rozklikávací seznam, Sledovat).
  showBoard() {
    this.openCardWith('Quests', { board: this.state.region || 'Greenvale' });
  }

  // Úvodní úkol Krotitelova zkouška (tutoriál souboje): Mág dá Soul Crystal a pošle hráče
  // na louku k Air Elementalovi; po ochočení se hráč objeví zpět v Hvězdárně.
  talkMageIntro() {
    const speaker = 'Mág';
    const name = this.state.playerName ?? 'Arion';
    const status = getQuestStatus(this.state, INTRO_QUEST);
    if (status === QUEST_STATUS.notStarted) {
      // Úvodní úkol se přijme sám (bez okna Přijmout / Odmítnout) – stejně jako druhý úkol
      // Za léčitelkou. Na výběr má hráč až od třetího úkolu.
      acceptQuest(this.state, INTRO_QUEST);
      addItem(this.state, 'basic_crystal', 1);
      this.state.flags.introPending = false;
      SaveSystem.save(this.state);
      this.refreshQuestMarker();
      this.afterDialog = () => this.afterQuestAccepted(INTRO_QUEST);
      this.showDialog(speaker, [
        `Vítej ve Hvězdárně, ${name}. Lovec z lesů a jeho věrný Dire Wolf – hvězdy mi o vás řekly.`,
        'Tvůj vlk je dobrý lovecký pes. Skutečný krotitel ale umí víc: se Soul Crystalem si získá i divokou bytost.',
        'Cítím v tobě jiskru magie – vítr tě poslouchá. Kouzla Vzduchu najdeš v souboji pod tlačítkem Kouzla (Q).',
        'Na louce za Loveckou chatou krouží Air Elemental. Vlk ho musí zasáhnout, ty vyzkoušíš kouzlo a oslabený ti pak uvěří – ochočíš ho.',
        'Tady máš Soul Crystal. V souboji tě povedu krok za krokem.',
        `Nový úkol: ${QUESTS[INTRO_QUEST].title}.`
      ]);
      return;
    }
    if (status === QUEST_STATUS.active) {
      // Krystal pro jistotu doplnit, aby se úkol nedal zablokovat.
      if (getItemCount(this.state, 'basic_crystal') <= 0) addItem(this.state, 'basic_crystal', 1);
      SaveSystem.save(this.state);
      this.showDialog(speaker, ['Air Elemental čeká na louce za Loveckou chatou. Vlk ho zasáhne, ty vyzkoušej kouzlo a pak ho ochoč Soul Crystalem.']);
      return;
    }
    completeQuest(this.state, INTRO_QUEST); // zadá i další úkol Za léčitelkou (assignFollowUpQuests)
    SaveSystem.save(this.state);
    this.showDialog(speaker, [
      'Vítej zpátky – přenesl jsem tě sem, sotva krystal zazářil. Air Elemental je teď tvůj společník.',
      'Monstra v partě uvidíš v kartě Party (P). Po souboji jsou ale unavená – zajdi za Liorou do Domu léčitelky u náměstí, vyléčí je.',
      'Ve vesnici tě čekají lidé s prací: Alchymista, Učednice v kovárně a Bylinkářka. Starosta Edric na radnici má vážnější úkol – ale až si získáš důvěru vesnice.',
      'Za odvahu ti dávám pět Soul Crystalů – ať můžeš krotit dál.',
      `Úkol dokončen: Krotitelova zkouška. Odměna: ${QUESTS[INTRO_QUEST].reward}`,
      `Nový úkol: ${QUESTS[HEALER_QUEST].title} – cestu ukazují modré tečky.`
    ]);
    this.refreshQuestMarker();
  }

  // Mág v Hvězdárně: úvodní úkol, pak už jen rozhovor. (Úkol Píseň větrů je zrušený.)
  talkToMage(spot) {
    if (getQuestStatus(this.state, INTRO_QUEST) !== QUEST_STATUS.done) {
      this.talkMageIntro();
      return;
    }
    // Starší uložené hry (úvodní úkol hotový dřív): úkol Za léčitelkou se zadá teď.
    const added = assignFollowUpQuests(this.state);
    if (added.length) {
      SaveSystem.save(this.state);
      this.refreshQuestMarker();
      this.showDialog('Mág', [...(spot.lines ?? []), ...added.map((q) => `Nový úkol: ${q.title} – ${q.brief}`)]);
      return;
    }
    this.showDialog('Mág', spot.lines ?? ['…']);
  }

  // Liora: léčí zdarma; úkol Za léčitelkou se splní rozhovorem, pak nabídne Léčivé byliny.
  talkToHealer() {
    const lines = this.healAtInn(false);
    let offer = false;
    if (getQuestStatus(this.state, HEALER_QUEST) === QUEST_STATUS.active) {
      markQuestObjective(this.state, HEALER_QUEST);
      completeQuest(this.state, HEALER_QUEST);
      lines.push(`Úkol dokončen: ${QUESTS[HEALER_QUEST].title}.`);
    }
    const herbs = getQuestStatus(this.state, HEALER_HERBS_QUEST);
    if (getQuestStatus(this.state, HEALER_QUEST) === QUEST_STATUS.done && herbs === QUEST_STATUS.notStarted) {
      lines.push('Mám ale prosbu: docházejí mi léčivé byliny na obvazy. Bylinkářka je prodává – přines mi tři.');
      offer = true;
    } else if (herbs === QUEST_STATUS.active) {
      lines.push(`Pořád čekám na léčivé byliny. Teď: ${questStep(this.state, HEALER_HERBS_QUEST)}`);
    } else if (herbs === QUEST_STATUS.ready) {
      completeQuest(this.state, HEALER_HERBS_QUEST);
      lines.push('Krásné, voňavé byliny – přesně tyhle. Děkuju, tady máš za pomoc.', INN_TIP, `Úkol dokončen: ${QUESTS[HEALER_HERBS_QUEST].title}. Odměna: ${QUESTS[HEALER_HERBS_QUEST].reward}`);
    }
    SaveSystem.save(this.state);
    this.refreshQuestMarker();
    if (offer) this.afterDialog = () => this.showQuestOffer(HEALER_HERBS_QUEST);
    this.showDialog('Liora, léčitelka', lines);
  }

  // Zadavatel úvodního úkolu (Alchymista, Učednice): nabídka → připomínka → odměna.
  // Po přijetí úkolu: když hráč už má vše splněné, hned nabídka postavy s Odevzdat úkol;
  // jinak zpět do světa (hláška o novém úkolu ukáže svět).
  afterQuestAccepted(questId) {
    const quest = QUESTS[questId];
    if (getQuestStatus(this.state, questId) === QUEST_STATUS.ready) {
      const giver = (this.interior?.spots ?? []).find((spot) => spot.quest === questId || spot.quests?.includes(questId)
        || spot.questMarker?.quest === questId || spot.questMarker?.alt === questId);
      if (giver) {
        this.useSpot(giver); // hned, bez mezery (jinak by mezi okny problikl interiér)
        return;
      }
    }
    // Další krok je tady (např. výroba na stole v této budově – suroviny už hráč má): zůstat
    // uvnitř, pracoviště ukáže modrý „?“. Jinak ven, tečky vedou k dalšímu kroku (např. tržiště).
    const step = getQuestStatus(this.state, questId) === QUEST_STATUS.active ? currentQuestStep(this.state, questId) : null;
    const here = step?.target?.type === 'building' && step.target.id === this.interiorId;
    if (here) {
      this.refreshQuestMarker();
      uiToast(this, `Nový úkol: ${quest.title} – ${step.text}`, { y: GAME_HEIGHT - 150, depth: 6100 });
      return;
    }
    this.registry.set('pendingWorldMessage', `Nový úkol: ${quest.title} – cestu ukazují modré tečky.`);
    this.leaveInterior();
  }

  talkQuestGiver(spot, questId = spot.quest) {
    const quest = QUESTS[questId];
    const status = getQuestStatus(this.state, questId);
    let lines;
    if (status === QUEST_STATUS.notStarted) {
      // Nabídka → okno úkolu (Přijmout / Odmítnout); věta „Nový úkol: …“ až v okně.
      lines = quest.dialog.offer.filter((line) => !line.startsWith('Nový úkol'));
      this.afterDialog = () => this.showQuestOffer(questId);
    } else if (status === QUEST_STATUS.active) {
      lines = [...quest.dialog.active, `Teď: ${questStep(this.state, questId)}`];
    } else if (status === QUEST_STATUS.ready) {
      completeQuest(this.state, questId);
      lines = [...quest.dialog.ready, `Úkol dokončen: ${quest.title}. Odměna: ${quest.reward}`];
      // Druhá škola: hned po odevzdání volba živlu.
      if (this.state.flags?.secondSchoolPending) this.afterDialog = () => this.showSchoolChoice();
    } else {
      lines = spot.lines ?? quest.dialog.done;
    }
    SaveSystem.save(this.state);
    this.refreshQuestMarker();
    this.showDialog(spot.label, lines);
  }

  talkToBard(spot) {
    this.showDialog('Bard', spot.lines ?? ['…']);
  }

  // ------------------------------------------------------------------ postavy

  // Úkol Orčí hrozba (dřív Jeskynní sliz): starosta ho svěří až po základních úkolech
  // (QUESTS.requires), odměnou je cesta do Verdant Forest (talenty odemkne 4. úroveň hrdiny).
  // Starosta: nejdřív úkoly, potom nabídka domů na prodej (Diplomacie).
  talkToMayor() {
    this.talkToMayorQuest();
    if (this.dialogLines && !this.afterDialog && this.propertyOffer()) this.afterDialog = () => this.offerProperty();
  }

  // Nemovitost, o které má starosta mluvit: nekoupená. Pod Diplomacií 10 se o ní zmíní jen jednou.
  propertyOffer() {
    const prop = Object.values(PROPERTIES).find((p) => p.seller === 'Starosta Edric' && !getShop(this.state, p.id));
    if (!prop) return null;
    const needed = PROPERTY_TYPES[prop.type].level;
    if (diplomacyLevel(this.state) < needed && this.state.flags?.[`propertyHint_${prop.id}`]) return null;
    return prop;
  }

  offerProperty() {
    const prop = this.propertyOffer();
    if (!prop) return;
    const type = PROPERTY_TYPES[prop.type];
    const speaker = 'Starosta Edric';
    if (diplomacyLevel(this.state) < type.level) {
      this.state.flags ??= {};
      this.state.flags[`propertyHint_${prop.id}`] = true;
      this.showDialog(speaker, [
        `Ještě něco: ${prop.name.toLowerCase()} je na prodej. Mohl by v něm být pěkný obchod.`,
        `Prodám ho ale jen zkušenému obchodníkovi. Vrať se, až budeš mít Diplomacii ${type.level} (teď máš ${diplomacyLevel(this.state)}).`,
        'Diplomacii zvedneš obchodem, splněnými úkoly a rozhovory s lidmi.'
      ]);
      return;
    }
    const check = canBuyProperty(this.state, prop.id);
    this.showChoice(`${prop.name} – ${type.name}`, [
      `${type.slots} prodejních slotů · zhruba ${type.customers} zákazníků za herní den · provoz ${goldText(type.dailyCost)} / den`,
      `Cena: ${prop.price} ${prop.price === 1 ? 'zlatý' : 'zlata'}${check.ok ? '' : `\n${check.reason}`}`
    ].join('\n'), [
      { label: 'Koupit dům', disabled: !check.ok, onClick: () => withSpend(this, prop.price, { title: `Koupit dům: ${prop.name}`, lines: [`${type.name} · provoz ${goldText(type.dailyCost)} / den`] }, () => this.purchaseProperty(prop)) },
      { label: 'Teď ne', onClick: () => {} }
    ]);
  }

  purchaseProperty(prop) {
    const result = buyProperty(this.state, prop.id);
    SaveSystem.save(this.state);
    if (!result.ok) {
      this.showDialog('Starosta Edric', [result.reason]);
      return;
    }
    this.showDialog('Starosta Edric', [
      `Výborně! ${prop.name} je od teď tvůj. Tady máš klíče.`,
      'Vstup má teď fialový kruh. Uvnitř najdeš prodejní pult, sklad a účetní knihu.',
      'Zboží dej do skladu, vyber, co se má prodávat, a nastav ceny. Zákazníci chodí, i když nejsi uvnitř – jen dokud hraješ.'
    ]);
  }

  // Volba se dvěma a více tlačítky (např. koupě domu). Tlačítka mají výšku 58 a písmo 22.
  showChoice(title, text, options) {
    this.closeChoice();
    const w = 980;
    const h = 330;
    const x = GAME_WIDTH / 2 - w / 2;
    const y = GAME_HEIGHT / 2 - h / 2;
    const objects = [];
    const blocker = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setOrigin(0).setDepth(6000).setInteractive();
    objects.push(blocker);
    const panel = nineImage(this, 'nu-panel', x, y, w, h, 0.75);
    if (panel) objects.push(panel.setDepth(6001));
    objects.push(cardText(this, x + 40, y + 30, title, { size: 30, bold: true, color: '#ffe7ae' }).setDepth(6002));
    objects.push(cardText(this, x + 40, y + 86, text, { size: 22, color: '#fff2d1', wrap: w - 80, lineSpacing: 6 }).setDepth(6002));
    const bw = 260;
    options.forEach((opt, i) => {
      const bx = x + w - 40 - (options.length - i) * (bw + 20) + 20;
      const btn = cardButton(this, null, bx, y + h - 92, bw, 58, opt.label, () => {
        this.closeChoice();
        opt.onClick();
      }, { size: 22, disabled: opt.disabled, danger: i === options.length - 1 && options.length > 1 });
      for (const o of btn.objects) { o.setDepth?.(6003); objects.push(o); }
    });
    this.choiceObjects = objects;
  }

  closeChoice() {
    if (this.choiceObjects) this.calmUntil = this.time.now + 250;
    for (const o of this.choiceObjects ?? []) o.destroy();
    this.choiceObjects = null;
    this.choiceKeys = null;
  }

  // Nabídka úkolu po rozhovoru se zadavatelem: tabulka (Zadavatel, Náplň, Kroky, Odměna)
  // a tlačítka Přijmout (Enter) / Odmítnout (Esc). Odmítnutý úkol jde přijmout později –
  // u zadavatele zůstává „!“. onAccept = co se má stát po přijetí (dárky, příznaky…),
  // onDone = po přijetí i odmítnutí (např. otevření obchodu Bylinkářky).
  showQuestOffer(questId, { onAccept, onDone } = {}) {
    const quest = QUESTS[questId];
    this.closeChoice();
    const w = 1060;
    const x = GAME_WIDTH / 2 - w / 2;
    const objects = [];
    const label = (text, ty) => cardText(this, x + 44, ty, text, { size: 20, bold: true, color: '#c9b98f' });
    const value = (text, ty, opts = {}) => cardText(this, x + 250, ty, text, { size: 22, color: '#fff2d1', wrap: w - 300, lineSpacing: 4, ...opts });
    const rows = [
      ['Zadavatel', quest.giver],
      ['Náplň', quest.brief ?? quest.description],
      ...(quest.steps?.length ? [['Kroky', quest.steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n')]] : []),
      ...(quest.goals?.length > 1 ? [['Kroky', quest.goals.map((g, i) => `${i + 1}. ${g.text}.`).join('\n')]] : []),
      ['Odměna', quest.reward]
    ];
    // Výška podle obsahu: texty se nejdřív změří, pak se postaví panel.
    const measured = rows.map(([k, v]) => ({ k, v: value(v, 0, k === 'Náplň' ? { bold: true, color: '#ffe7ae' } : k === 'Kroky' ? { size: 19, color: '#dbe6f3' } : {}) }));
    const bodyH = measured.reduce((sum, r) => sum + Math.max(30, r.v.height) + 18, 0);
    const h = 120 + bodyH + 100;
    const y = GAME_HEIGHT / 2 - h / 2;
    objects.push(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setOrigin(0).setDepth(6000).setInteractive());
    const panel = nineImage(this, 'nu-panel', x, y, w, h, 0.75);
    if (panel) objects.push(panel.setDepth(6001));
    else {
      const g = this.add.graphics().setDepth(6001);
      g.fillStyle(0x0d1d33, 0.98).fillRoundedRect(x, y, w, h, 18).lineStyle(4, 0xd6a23a, 1).strokeRoundedRect(x, y, w, h, 18);
      objects.push(g);
    }
    objects.push(cardText(this, x + 44, y + 30, `Nový úkol: ${quest.title}`, { size: 32, bold: true, color: '#ffe7ae' }).setDepth(6002));
    let ty = y + 96;
    const lines = this.add.graphics().setDepth(6002);
    objects.push(lines);
    measured.forEach(({ k, v }, i) => {
      if (i) lines.lineStyle(1, 0xd6a23a, 0.35).lineBetween(x + 40, ty - 9, x + w - 40, ty - 9);
      objects.push(label(k, ty + 2).setDepth(6002), v.setPosition(x + 250, ty).setDepth(6002));
      ty += Math.max(30, v.height) + 18;
    });
    const accept = () => {
      this.closeChoice();
      acceptQuest(this.state, questId);
      onAccept?.();
      SaveSystem.save(this.state);
      this.refreshQuestMarker();
      this.afterQuestAccepted(questId);
    };
    const decline = () => {
      this.closeChoice();
      uiToast(this, `Úkol ${quest.title} můžeš přijmout později – ${quest.giver}.`, { y: GAME_HEIGHT - 150, depth: 6100 });
      onDone?.();
    };
    const bw = 300;
    [['Přijmout (Enter)', accept, false], ['Odmítnout (Esc)', decline, true]].forEach(([text, fn, danger], i) => {
      const btn = cardButton(this, null, x + w / 2 - bw - 12 + i * (bw + 24), y + h - 92, bw, 60, text, fn, { size: 22, danger });
      for (const o of btn.objects) { o.setDepth?.(6003); objects.push(o); }
    });
    this.choiceObjects = objects;
    this.choiceKeys = { Enter: accept, Escape: decline };
  }

  talkToMayorQuest() {
    const name = this.state.playerName ?? 'Arion';
    const speaker = 'Starosta Edric';
    const status = getQuestStatus(this.state, CAVE_QUEST);

    if (status === QUEST_STATUS.notStarted && !isQuestAvailable(this.state, CAVE_QUEST)) {
      const left = questsBlocking(this.state, CAVE_QUEST).map((q) => `${q.title} (${q.giver})`).join(', ');
      this.showDialog(speaker, [
        `Vítej na radnici, ${name}. Lovec s Dire Wolfem – o tobě už se v Greenvale mluví.`,
        'Mám pro tebe vážnou práci, ale nejdřív ukaž, že ti vesnice může věřit. Pomoz lidem, kteří tě potřebují.',
        `Ještě nedokončené: ${left}.`
      ]);
      return;
    }

    if (status === QUEST_STATUS.notStarted) {
      this.afterDialog = () => this.showQuestOffer(CAVE_QUEST);
      this.showDialog(speaker, [
        `${name}, celá vesnice o tobě mluví dobře. Teď tě potřebuju já.`,
        'V jeskyni za vesnicí se usadil orčí válečník. Přepadá pocestné a lovce, co jdou k lesu.',
        'Poraz ho a vrať se za mnou. Pak tě naučím, jak se vydat cestou souboje, řemesel nebo magie.',
        'Pozor: s takovým soupeřem se nedá vyjednávat (bez simulace) a ochočit ho nepůjde. K jeskyni přijď k vchodu a stiskni E.'
      ]);
      return;
    }

    if (status === QUEST_STATUS.ready) {
      completeQuest(this.state, CAVE_QUEST);
      SaveSystem.save(this.state);
      this.showDialog(speaker, [
        'Orčí válečník je poražen? Greenvale ti dluží díky.',
        'Prokázal jsi, že jsi skutečný lovec. Cesta do Verdant Forest je pro tebe otevřená – brána do lesa je v jihovýchodním cípu Greenvale.',
        `Úkol dokončen: Orčí hrozba. Odměna: ${QUESTS[CAVE_QUEST].reward}`
      ]);
      this.refreshQuestMarker();
      return;
    }

    if (status === QUEST_STATUS.done) {
      this.showDialog(speaker, [
        'Greenvale je díky tobě v bezpečí. Cesta do Verdant Forest je volná.'
      ]);
      return;
    }

    this.showDialog(speaker, [
      'Orčí válečník pořád řádí. Jeskyně je v útesu u Jižních plání – přijď k vchodu a stiskni E.',
      'Než vyrazíš, ať tě Liora v domě léčitelky dá do pořádku.'
    ]);
  }

  // „!“ = nový úkol, „?“ = splněno, vrať se. Jen u starosty.
  refreshQuestMarker() {
    // Každá potřebná výroba označí jen první vhodné pracoviště v místnosti.
    const needs = questCraftNeeds(this.state);
    const used = new Set();
    for (const { marker, quest, role, alt, altRole, more, station } of this.questMarkers ?? []) {
      if (station) {
        const need = needs.find((n, i) => !used.has(i) && n.prof === station.prof
          && (n.prof === 'crafting' ? n.station === station.rank : station.rank >= n.station));
        if (need) used.add(needs.indexOf(need));
        marker.setText(need ? '?' : '').setColor(QUEST_MARK_BLUE);
        continue;
      }
      // alt = další úkol téže postavy (Liora: Za léčitelkou, pak Léčivé byliny) – až po dokončení
      // prvního; altRole = role postavy u druhého úkolu (výchozí stejná).
      const altMark = alt && getQuestStatus(this.state, quest) === QUEST_STATUS.done ? questMark(this.state, alt, altRole ?? role, this.interiorId) : null;
      // more = další úkoly téže postavy (Mág): první, který má značku.
      const moreMark = (more ?? []).map((id) => questMark(this.state, id, 'giver', this.interiorId)).find(Boolean) ?? null;
      const mark = questMark(this.state, quest, role, this.interiorId) ?? altMark ?? moreMark;
      marker.setText(mark?.char ?? '').setColor(mark?.color ?? '#ffd23a');
    }
  }

  // Výčepní v hostinci: pokoj na noc za zlato – stejné léčení jako u Liory
  // a navíc snídaně: účinek Masového vývaru se zeleninou (regenerace po soubojích).
  // Nabídka výčepní podle denní doby: přenocování (večer a v noci) nebo odpočinek (přes den).
  innOffer() {
    return isSleepTime(this.state)
      ? { sleep: true, price: ROOM_PRICE, label: `Výčepní – pokoj na noc se snídaní (${goldText(ROOM_PRICE)})`, verb: 'přenocovat' }
      : { sleep: false, price: REST_PRICE, label: `Výčepní – odpočinek (${goldText(REST_PRICE)}, s jídlem ${goldText(REST_PRICE + REST_MEAL_PRICE)})`, verb: 'odpočinout si' };
  }

  rentRoom(withMeal = false) {
    const gold = Math.max(0, Math.floor(Number(this.state.gold) || 0));
    const base = this.innOffer();
    const eat = withMeal && !base.sleep;
    const offer = eat ? { ...base, price: base.price + REST_MEAL_PRICE } : base;
    const meal = COOKING_BY_ID[ROOM_MEAL];
    const mealEffect = `po každém z příštích ${meal.effect.battles} soubojů +${meal.effect.regen} HP monstrům v partě`;
    const mealInfo = `K pokoji na noc ráno dostaneš ${meal.name.toLowerCase()} – ${mealEffect}.`;
    if (gold < offer.price) {
      this.showDialog('Výčepní', [
        `${offer.sleep ? 'Pokoj na noc' : eat ? 'Odpočinek s jídlem' : 'Pokoj na odpočinek'} stojí ${offer.price} zlata a ty máš jen ${gold}.`,
        offer.sleep ? mealInfo : `Večer pronajímám pokoje na noc i se snídaní (${goldText(ROOM_PRICE)}).`,
        'Liora v domě léčitelky u náměstí léčí zadarmo.'
      ]);
      return;
    }
    const what = offer.sleep ? 'Pokoj na noc se snídaní' : eat ? 'Odpočinek s jídlem' : 'Odpočinek na pár hodin';
    confirmSpend(this, { title: `Výčepní – ${what}`, cost: offer.price, gold,
      lines: offer.sleep || eat ? [`K tomu ${meal.name.toLowerCase()}: ${mealEffect}.`] : [],
      onConfirm: () => this.payRoom(offer, eat) });
  }

  payRoom(offer, eat) {
    const gold = Math.max(0, Math.floor(Number(this.state.gold) || 0));
    if (gold < offer.price) return;
    const meal = COOKING_BY_ID[ROOM_MEAL];
    const mealEffect = `po každém z příštích ${meal.effect.battles} soubojů +${meal.effect.regen} HP monstrům v partě`;
    const mealInfo = `K pokoji na noc ráno dostaneš ${meal.name.toLowerCase()} – ${mealEffect}.`;
    this.state.gold = gold - offer.price;
    restoreParty(this.state);
    if (!offer.sleep) {
      advanceMinutes(this.state, REST_HOURS * 60);
      const food = eat ? eatMeal(this.state, ROOM_MEAL) : null;
      SaveSystem.save(this.state);
      this.showDialog('Výčepní', [
        `Na pár hodin si odpočiň – ${offer.price} zlata.`,
        'Vstáváš odpočatý, s plnou manou. Monstra v partě i ve stáji jsou odpočatá.',
        food?.ok ? `K jídlu ${meal.name.toLowerCase()}: ${mealEffect}.` : `Na noc pronajímám pokoj i se snídaní za ${ROOM_PRICE} zlata.`
      ]);
      return;
    }
    sleepUntilDawn(this.state);
    const breakfast = eatMeal(this.state, ROOM_MEAL);
    SaveSystem.save(this.state);
    this.showDialog('Výčepní', [
      `Pokoj je tvůj – ${offer.price} zlata. Dobrou noc!`,
      `Ráno: vyspalý, s plnou manou. Tvoje monstra v partě i ve stáji jsou odpočatá.`,
      breakfast.ok
        ? `Ke snídani ${meal.name.toLowerCase()}: ${mealEffect}.`
        : mealInfo
    ]);
  }

  // Herní čas běží i v interiéru (ne pod otevřeným obchodem nebo kartou – scéna je pozastavená).
  update(_time, delta = 16) {
    if (!this.state) return;
    tickTime(this.state, delta);
    // Zavřít (dole pod kartou) se během rozhovoru a nabídek schová – jinak prosvítá pod panelem.
    // Po zavření okna chvíli počkat – když hned naváže další okno (odevzdání, nabídka), Zavřít neproblikne.
    this.setCloseVisible(!this.dialogLines && !this.choiceObjects && !this.spendConfirmOpen && this.time.now >= (this.calmUntil ?? 0));
    // Přepis i po přenocování / odpočinku (čas skočí).
    const label = dayClockLabel(this.state);
    if (this.clockLabel?.active && this.clockLabel.text !== label) this.clockLabel.setText(label);
  }

  // show = false: jen vyléčí a vrátí řádky rozhovoru (talkToHealer k nim přidá úkoly).
  healAtInn(show = true) {
    // HP hrdiny je skryté (nikde se nezobrazuje), v uložené hře zůstává.
    restoreParty(this.state);
    SaveSystem.save(this.state);

    const lines = [
      'Pojď blíž, podívám se na tebe i na tvoje společníky.',
      'Obnovila jsem ti manu. Tvoji společníci v partě i v úschovně jsou zase v pořádku.',
      'Monstra mezi partou a úschovnou přesuneš u mě v kartě Party (P).'
    ];
    if (getQuestStatus(this.state, CAVE_QUEST) === QUEST_STATUS.active) {
      lines.push('Jdeš na toho orka? Jeho sekera je těžká jako kámen. Vrať se, kdyby bylo zle.');
    }
    if (show) this.showDialog('Liora, léčitelka', lines);
    return lines;
  }

  // Rybář: poprvé daruje základní náčiní, pak otevře obchod (FishingShopScene).
  talkToFisher() {
    this.state.flags ??= {};
    const lines = [];
    if (!this.state.flags.fishingStarterGiven) {
      this.state.flags.fishingStarterGiven = true;
      addItem(this.state, 'old_rod', 1);
      addItem(this.state, 'old_hook', 1);
      addItem(this.state, 'bread_bait', 5);
      SaveSystem.save(this.state);
      lines.push(
        'Další rybář? To rád vidím. Tumáš starý prut, starý háček a pár chlebových návnad.',
        'Rybářská místa poznáš podle modrého kruhu u vody – na molu a podél břehu. Stoupni si k nim a stiskni E.',
        'Úlovky ti vykoupím za dobrou cenu a každý den hledám jeden druh ryby, za ten zaplatím víc.'
      );
    } else {
      lines.push('Tak co, berou? Podívej se, co mám na prodej, nebo mi ukaž úlovek.');
    }
    this.afterDialog = () => this.openFishingShop();
    this.showDialog('Rybář', lines);
  }

  // Hornický mistr: poprvé daruje Starý krumpáč, pak otevře obchod (MiningShopScene).
  talkToMiner() {
    this.state.flags ??= {};
    const lines = [];
    if (!this.state.flags.miningStarterGiven) {
      this.state.flags.miningStarterGiven = true;
      addItem(this.state, 'old_pickaxe', 1);
      SaveSystem.save(this.state);
      lines.push(
        'Chceš se naučit kopat? Tumáš starý krumpáč, ať nezačínáš s holýma rukama.',
        'Naleziště poznáš podle hnědého kruhu s krumpáčem. Zkušební lom je za mostem na jihozápadě, u řeky – stoupni si k nalezišti a stiskni E.',
        'Vytěžené místo chvíli odpočívá: běžné žíly dvanáct hodin, vzácné dva dny. Suroviny ti vykoupím a lepší krumpáče prodám.',
        'Až budeš mít Těžbu na pětadvacítce, přijď si vybrat specializaci.'
      );
    } else {
      lines.push('Zdar, horníku. Krumpáče, podpěry, výkup surovin nebo specializace – co to bude?');
    }
    this.afterDialog = () => this.openMiningShop();
    this.showDialog('Hornický mistr', lines);
  }

  // Bylinkářka: poprvé daruje Starý srp a Léčivé byliny, pak otevře obchod (HerbalistShopScene).
  talkToHerbalist() {
    this.state.flags ??= {};
    const lines = [];
    if (!this.state.flags.herbStarterGiven) {
      this.state.flags.herbStarterGiven = true;
      addItem(this.state, 'old_sickle', 1);
      addItem(this.state, 'healing_herbs', 5);
      SaveSystem.save(this.state);
      lines.push(
        'Bylinky mají v sobě víc síly než leckterý meč. Tumáš starý srp a pár léčivých bylin na začátek.',
        'Naleziště poznáš podle zeleného kruhu s lístkem – na louce, u řeky, v lese i u vodopádu. Stoupni si k nim a stiskni E.',
        'Záhony za mostem na statku obnovuju každých dvanáct hodin, vzácné byliny dorostou za dva dny. A co nasbíráš navíc, to ti ráda vykoupím.',
        'Až budeš mít Sběr bylin na pětadvacítce, přijď si vybrat specializaci.'
      );
    } else {
      lines.push('Vítej zpátky. Čerstvé byliny, srp, výkup nebo specializace – co potřebuješ?');
    }
    // Úkol Byliny od řeky (nasbírat 3× Čisticí byliny na břehu řeky).
    const herbQuest = 'greenvale_river_herbs';
    const herbStatus = getQuestStatus(this.state, herbQuest);
    let offerHerbQuest = false;
    if (herbStatus === QUEST_STATUS.notStarted && isQuestAvailable(this.state, herbQuest)) {
      offerHerbQuest = true;
      lines.push('A jestli se chceš opravdu učit: na břehu řeky rostou čisticí byliny. Natrhej dvě, kup čistou vodu a u Alchymisty z nich uvař protijed. Ten mi přines.');
    } else if (herbStatus === QUEST_STATUS.active) {
      lines.push(`Pořád čekám na protijed z čisticích bylin. Teď: ${questStep(this.state, herbQuest)}`);
    } else if (herbStatus === QUEST_STATUS.ready) {
      completeQuest(this.state, herbQuest);
      lines.push('Protijed jako od mistra – čirý a bez hořkosti. Tady máš za snahu.', `Úkol dokončen: Byliny od řeky. Odměna: ${QUESTS[herbQuest].reward}`);
    }
    SaveSystem.save(this.state);
    this.refreshQuestMarker();
    // Nabídka úkolu (Přijmout / Odmítnout), pak obchod.
    this.afterDialog = offerHerbQuest
      ? () => this.showQuestOffer(herbQuest, { onDone: () => this.openHerbalistShop() })
      : () => this.openHerbalistShop();
    this.showDialog('Bylinkářka', lines);
  }

  // ------------------------------------------------------------------ nabídka rozhovoru
  // Co jde s postavou dělat. null = žádná nabídka (první návštěva s dárkem, úkol, který se
  // splní rozhovorem, postava s jedinou možností) – spustí se rovnou původní rozhovor.
  // Úkol je v nabídce první (Nový úkol / Úkol / Odevzdat úkol); nový a splněný má zlaté písmo.
  talkOptions(spot) {
    const flags = this.state.flags ?? {};
    const options = [];
    const quest = (questId, run) => {
      const option = this.questOption(questId, run);
      if (option) options.push(option);
    };
    const talk = (lines, speaker = spot.label) => options.push({ label: 'Promluvit', run: () => this.showDialog(speaker, lines) });
    // Další úkoly postavy (řemeslné linie): nový / probíhající / k odevzdání.
    const spotQuests = () => { for (const id of spot.quests ?? []) quest(id, () => this.talkQuestGiver(spot, id)); };
    switch (spot.action) {
      case 'herbalist':
        if (!flags.herbStarterGiven) return null;
        quest('greenvale_river_herbs', () => this.herbalistQuestTalk());
        spotQuests();
        options.push({ label: 'Obchod a výkup bylin', run: () => this.openHerbalistShop() });
        talk(NPC_TALK.herbalist);
        break;
      case 'fisher':
        if (!flags.fishingStarterGiven) return null;
        spotQuests();
        options.push({ label: 'Obchod a výkup ryb', run: () => this.openFishingShop() });
        talk(NPC_TALK.fisher);
        break;
      case 'miner':
        if (!flags.miningStarterGiven) return null;
        spotQuests();
        options.push({ label: 'Obchod a výkup surovin', run: () => this.openMiningShop() });
        talk(NPC_TALK.miner);
        break;
      case 'healer':
        if (getQuestStatus(this.state, HEALER_QUEST) === QUEST_STATUS.active) return null; // Za léčitelkou se splní rozhovorem
        quest(HEALER_HERBS_QUEST, () => this.healerHerbsTalk());
        options.push({ label: 'Vyléčit partu', run: () => this.healAtInn(true) });
        options.push({ label: 'Úschovna monster', run: () => this.openCard('Party') });
        break;
      case 'mayor': {
        quest(CAVE_QUEST, () => this.talkToMayorQuest());
        spotQuests(); // Vlastní obchod
        const prop = this.propertyOffer();
        if (prop) options.push({ label: `${prop.name} na prodej`, run: () => this.offerProperty() });
        if (options.length) talk(NPC_TALK.mayor, 'Starosta Edric');
        else return null; // úkol ještě není dostupný: starosta řekne, koho má hráč nejdřív navštívit
        break;
      }
      case 'mage':
        if (getQuestStatus(this.state, INTRO_QUEST) !== QUEST_STATUS.done) return null; // úvodní zkouška: Mág mluví sám
        if (flags.secondSchoolPending) options.push({ label: 'Vybrat druhý živel', run: () => this.showSchoolChoice(), highlight: true });
        for (const id of spot.quests ?? []) quest(id, () => this.talkQuestGiver(spot, id));
        talk(spot.lines ?? ['…'], 'Mág');
        break;
      case 'questGiver':
        quest(spot.quest, () => this.talkQuestGiver(spot));
        spotQuests();
        if (!options.length) return null; // vše hotové: rozhovor (talkQuestGiver → done)
        talk(spot.lines ?? ['…']);
        break;
      case 'innRoom': {
        // Přes den: odpočinek, nebo odpočinek s jídlem za příplatek. V noci jen nocleh (se snídaní).
        spotQuests();
        if (isSleepTime(this.state)) {
          if (!options.length) return null;
          options.push({ label: `Pokoj na noc (${goldText(ROOM_PRICE)})`, run: () => this.rentRoom(false) });
          break;
        }
        const meal = COOKING_BY_ID[ROOM_MEAL];
        options.push({ label: `Odpočinek (${goldText(REST_PRICE)})`, run: () => this.rentRoom(false),
          info: `${REST_HOURS} hodiny odpočinku: vyléčí partu a obnoví manu.` });
        options.push({ label: `Odpočinek s jídlem (${goldText(REST_PRICE + REST_MEAL_PRICE)})`, run: () => this.rentRoom(true),
          info: `Navíc ${meal.name.toLowerCase()}: po každém z příštích ${meal.effect.battles} soubojů +${meal.effect.regen} HP monstrům v partě.` });
        break;
      }
      case 'talk':
        spotQuests();
        if (spot.shop) options.push({ label: 'Obchod', run: () => this.openMerchantShop(spot.shop) });
        if (!options.length) return null;
        talk(spot.lines ?? ['…']);
        break;
      default:
        return null;
    }
    return options;
  }

  // Úkol do nabídky podle stavu (nedostupný a hotový úkol se nenabízí).
  questOption(questId, run) {
    const quest = QUESTS[questId];
    if (!quest) return null;
    const status = getQuestStatus(this.state, questId);
    if (status === QUEST_STATUS.notStarted && isQuestAvailable(this.state, questId)) return { label: `Nový úkol: ${quest.title}`, run, highlight: true };
    if (status === QUEST_STATUS.active) return { label: `Úkol: ${quest.title}`, run };
    if (status === QUEST_STATUS.ready) return { label: `Odevzdat úkol: ${quest.title}`, run, highlight: true };
    return null;
  }

  // Nabídka ve spodním panelu rozhovoru (místo textu): jméno postavy a tlačítka po třech
  // v řadě (výška 62, písmo 22), klávesy 1–9, Esc = odejít. Panel roste nahoru podle počtu řad.
  showTalkMenu(speaker, options) {
    this.closeChoice();
    this.hideSpotLabel();
    const all = [...options, { label: 'Odejít (Esc)', run: () => {}, danger: true }];
    const x = 120;
    const w = GAME_WIDTH - 240;
    const cols = 3;
    const gap = 16;
    const bw = Math.floor((w - 80 - gap * (cols - 1)) / cols);
    const bh = 62;
    const rows = Math.ceil(all.length / cols);
    // Volby s popisem (info): řádek nad tlačítky ukáže popis volby pod myší.
    const infoH = options.some((o) => o.info) ? 56 : 0;
    const h = Math.max(220, 80 + infoH + rows * (bh + 12) + 16);
    const y = GAME_HEIGHT - 80 - h; // spodní okraj jako u rozhovoru
    const objects = [];
    objects.push(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.25).setOrigin(0).setDepth(4999).setInteractive());
    const panel = nineImage(this, 'nu-panel', x, y, w, h, 0.75);
    if (panel) objects.push(panel.setDepth(5000));
    else {
      const g = this.add.graphics().setDepth(5000);
      g.fillStyle(0x10151a, 0.96).fillRoundedRect(x, y, w, h, 18).lineStyle(4, 0xd6a23a, 1).strokeRoundedRect(x, y, w, h, 18);
      objects.push(g);
    }
    objects.push(cardText(this, x + 40, y + 26, speaker, { size: 28, bold: true, color: '#ffe7ae' }).setDepth(5001));
    objects.push(cardText(this, x + w - 40, y + 44, 'Co chceš? · 1–9 · Esc = odejít', { size: 18, color: '#c9b98f', originX: 1, originY: 0.5 }).setDepth(5001));
    const infoText = infoH ? cardText(this, x + 40, y + 70, 'Najeď myší na volbu – ukáže se její popis.', { size: 19, color: '#c9b98f', wrap: w - 80 }).setDepth(5001) : null;
    if (infoText) objects.push(infoText);
    const keys = {};
    all.forEach((option, i) => {
      const pick = () => {
        this.closeChoice();
        option.run();
        this.refreshQuestMarker();
      };
      const bx = x + 40 + (i % cols) * (bw + gap);
      const by = y + 80 + infoH + Math.floor(i / cols) * (bh + 12);
      const label = option.danger ? option.label : `${i + 1}. ${option.label}`;
      const btn = cardButton(this, null, bx, by, bw, bh, label, pick, { size: 22, danger: option.danger });
      if (option.highlight) btn.objects[1].setColor('#ffd76a'); // nový / splněný úkol: zlaté písmo
      if (infoText && option.info) {
        btn.objects[2].on('pointerover', () => infoText.setText(option.info).setColor('#f3e4bd'));
        btn.objects[2].on('pointerout', () => infoText.setText('Najeď myší na volbu – ukáže se její popis.').setColor('#c9b98f'));
      }
      for (const o of btn.objects) { o.setDepth?.(5002); objects.push(o); }
      if (!option.danger && i < 9) keys[`Digit${i + 1}`] = keys[`Numpad${i + 1}`] = pick;
    });
    this.choiceObjects = objects;
    this.choiceKeys = keys;
  }

  // Odměna úkolu Druhá škola: výběr živlu (odemkne školu magie a její první kouzla).
  showSchoolChoice() {
    const options = SECOND_SCHOOL_OPTIONS.map((school) => ({
      label: SCHOOL_NAMES_CZ[school] ?? school,
      info: SCHOOL_INFO[school],
      run: () => {
        const result = chooseSecondSchool(this.state, school);
        SaveSystem.save(this.state);
        if (result) this.showDialog('Mág', [`${SCHOOL_NAMES_CZ[school]} – dobrá volba. Od teď tě poslouchá i tento živel.`, 'Nová kouzla najdeš v Knize kouzel a v souboji pod tlačítkem Kouzla.']);
      }
    }));
    this.showTalkMenu('Mág – vyber druhý živel', options);
  }

  // Bylinkářka – jen úkol Byliny od řeky (bez obchodu potom).
  herbalistQuestTalk() {
    const herbQuest = 'greenvale_river_herbs';
    const status = getQuestStatus(this.state, herbQuest);
    const lines = [];
    if (status === QUEST_STATUS.notStarted) {
      lines.push('Jestli se chceš opravdu učit: na břehu řeky rostou čisticí byliny. Natrhej dvě, kup čistou vodu a u Alchymisty z nich uvař protijed. Ten mi přines.');
      this.afterDialog = () => this.showQuestOffer(herbQuest);
    } else if (status === QUEST_STATUS.active) {
      lines.push(`Pořád čekám na protijed z čisticích bylin. Teď: ${questStep(this.state, herbQuest)}`);
    } else if (status === QUEST_STATUS.ready) {
      completeQuest(this.state, herbQuest);
      lines.push('Protijed jako od mistra – čirý a bez hořkosti. Tady máš za snahu.', `Úkol dokončen: Byliny od řeky. Odměna: ${QUESTS[herbQuest].reward}`);
    }
    SaveSystem.save(this.state);
    this.showDialog('Bylinkářka', lines);
  }

  // Liora – jen úkol Léčivé byliny (nabídka, připomínka, odevzdání).
  healerHerbsTalk() {
    const status = getQuestStatus(this.state, HEALER_HERBS_QUEST);
    const lines = [];
    if (status === QUEST_STATUS.notStarted) {
      lines.push('Mám prosbu: docházejí mi léčivé byliny na obvazy. Bylinkářka je prodává – přines mi tři.');
      this.afterDialog = () => this.showQuestOffer(HEALER_HERBS_QUEST);
    } else if (status === QUEST_STATUS.active) {
      lines.push(`Pořád čekám na léčivé byliny. Teď: ${questStep(this.state, HEALER_HERBS_QUEST)}`);
    } else if (status === QUEST_STATUS.ready) {
      completeQuest(this.state, HEALER_HERBS_QUEST);
      lines.push('Krásné, voňavé byliny – přesně tyhle. Děkuju, tady máš za pomoc.', INN_TIP, `Úkol dokončen: ${QUESTS[HEALER_HERBS_QUEST].title}. Odměna: ${QUESTS[HEALER_HERBS_QUEST].reward}`);
    }
    SaveSystem.save(this.state);
    this.showDialog('Liora, léčitelka', lines);
  }

  // ------------------------------------------------------------------ menu nad interiérem

  // Scéna nad interiérem: interiér se pozastaví a po zavření se vrátí.
  setCloseVisible(visible) {
    const button = this.closeButton;
    if (!button || this.closeShown === visible) return;
    this.closeShown = visible;
    const parts = button.setVisible ? [button] : (button.objects ?? []);
    for (const o of parts) {
      this.tweens.killTweensOf(o);
      o.setVisible?.(visible);
      // Návrat tlačítka plynule (zmizení hned).
      if (visible && o.setAlpha) { o.setAlpha(0); this.tweens.add({ targets: o, alpha: 1, duration: 180 }); }
    }
  }

  launchOver(sceneKey, data) {
    this.setCloseVisible(false); // obchod / karta nad interiérem: Zavřít interiéru nesmí prosvítat
    // Obchod v tomto interiéru už hráč otevřel → příště se po vstupu otevře hned (autoOpenShop).
    if (SHOP_SCENES.includes(sceneKey)) {
      this.state.flags ??= {};
      this.state.flags.visitedShops = { ...(this.state.flags.visitedShops ?? {}), [this.interiorId]: true };
    }
    SaveSystem.save(this.state);
    this.hideSpotLabel();
    this.scene.pause();
    this.scene.launch(sceneKey, { state: this.state, returnScene: this.scene.key, ...data });
    this.scene.bringToTop(sceneKey);
  }

  // Karta s vlastními daty (např. Nástěnka úkolů = karta Úkoly s oblastí).
  openCardWith(sceneKey, data) {
    this.launchOver(sceneKey, { animateIn: true, ...data });
  }

  openCard(sceneKey, initialTab = undefined) {
    // U Liory (dům léčitelky) jde v Party kartě přesouvat monstra mezi partou a úschovnou.
    this.launchOver(sceneKey, { storageAccess: Boolean(this.interior.storageAccess), initialTab, animateIn: true });
  }

  openMiningShop() {
    this.launchOver('MiningShop', { merchantName: 'Hornický mistr' });
  }

  openHerbalistShop() {
    this.launchOver('HerbalistShop', { merchantName: 'Bylinkářka' });
  }

  openMerchantShop(merchant) {
    this.launchOver('MerchantShop', { merchant });
  }

  openFishingShop() {
    this.launchOver('FishingShop', { merchantName: 'Rybář' });
  }

  // Okno výroby u pracoviště. V budově jde vyrobit vše, co umí kterékoli pracoviště téže
  // profese v ní (např. v Řemeslné dílně koželužské i šperkařské recepty u kteréhokoli stolu).
  openCooking(station, sceneKey = 'Cooking', stationName = undefined) {
    const action = { Cooking: 'kitchen', Smithing: 'forge', Alchemy: 'alchemy', Crafting: 'craft' }[sceneKey];
    const spots = this.interior?.spots ?? [];
    const stations = [...new Set(spots.filter((s) => s.action === action && s.station).map((s) => s.station))];
    if (!stations.includes(station)) stations.push(station);
    const building = this.interior?.title;
    this.launchOver(sceneKey, { station, stations, stationName: stations.length > 1 && building ? building : stationName });
  }

  // ------------------------------------------------------------------ dialog

  buildDialog() {
    const x = 120;
    const y = GAME_HEIGHT - 300;
    const w = GAME_WIDTH - 240;
    const h = 220;
    // Klik kamkoli během dialogu = pokračovat.
    this.dialogBlocker = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.25).setOrigin(0)
      .setDepth(4999).setVisible(false).setInteractive();
    // Posune jen klik, který začal v rozhovoru: puštění myši po kliknutí na tlačítko nabídky
    // (Odevzdat úkol…) by jinak hned přeskočilo první větu (problikla by).
    this.dialogBlocker.on('pointerdown', () => { this.dialogPointerArmed = true; });
    this.dialogBlocker.on('pointerup', () => {
      if (!this.dialogPointerArmed) return;
      this.dialogPointerArmed = false;
      this.advanceDialog();
    });
    this.dialogPanel = nineImage(this, 'nu-panel', x, y, w, h, 0.75);
    if (!this.dialogPanel) {
      this.dialogPanel = this.add.graphics();
      this.dialogPanel.fillStyle(0x10151a, 0.96).fillRoundedRect(x, y, w, h, 18);
      this.dialogPanel.lineStyle(4, 0xd6a23a, 1).strokeRoundedRect(x, y, w, h, 18);
    }
    this.dialogPanel.setDepth(5000).setVisible(false);
    this.dialogName = cardText(this, x + 40, y + 26, '', { size: 28, bold: true, color: '#ffe7ae' }).setDepth(5001).setVisible(false);
    this.dialogText = cardText(this, x + 40, y + 70, '', { size: 26, color: '#fff2d1', wrap: w - 80 }).setDepth(5001).setVisible(false);
    this.dialogHint = cardText(this, x + w - 40, y + h - 26, 'klik / E / mezerník = pokračovat', {
      size: 18, color: '#c9b98f', originX: 1, originY: 0.5
    }).setDepth(5001).setVisible(false);
  }

  setDialogVisible(visible) {
    for (const o of [this.dialogBlocker, this.dialogPanel, this.dialogName, this.dialogText, this.dialogHint]) o.setVisible(visible);
  }

  showDialog(speaker, lines) {
    this.hideSpotLabel();
    // Diplomacie: nový rozhovor dá XP, opakovaný stejný rozhovor už ne.
    grantDialogXp(this.state, speaker, lines);
    this.dialogSpeaker = speaker;
    this.dialogLines = lines;
    this.dialogPointerArmed = false;
    this.dialogIndex = 0;
    this.setDialogVisible(true);
    this.showDialogLine();
  }

  showDialogLine() {
    this.dialogName.setText(this.dialogSpeaker);
    this.dialogText.setText(this.dialogLines[this.dialogIndex]);
  }

  advanceDialog() {
    if (!this.dialogLines) return;
    this.dialogIndex += 1;
    if (this.dialogIndex >= this.dialogLines.length) {
      const after = this.afterDialog;
      this.closeDialog();
      after?.();
      return;
    }
    this.showDialogLine();
  }

  closeDialog() {
    if (this.dialogLines) this.calmUntil = this.time.now + 250;
    this.dialogLines = null;
    this.dialogSpeaker = '';
    this.afterDialog = null;
    this.setDialogVisible(false);
  }

  // ------------------------------------------------------------------ odchod

  leaveInterior() {
    if (this.closing) return;
    this.closing = true;
    this.state.interiorId = null;
    // Svět postaví hráče před dveře této budovy (např. po nahrání hry v interiéru).
    // Při návratu do pozastaveného světa hráč u dveří už stojí.
    if (!this.fromWorld) this.state.exitDoor = this.interiorId;
    SaveSystem.save(this.state);

    if (this.fromWorld) {
      slideCardOut(this, () => {
        this.scene.stop();
        this.scene.resume('World');
      }, { hide: this.tabBar?.objects });
      return;
    }
    this.scene.start('World', { state: this.state });
  }
}

function getSkillForInterior(skillId) {
  // Po léčení u Liory se obnoví počet použití schopností.
  return skillRowsForInterior.find((skill) => skill.id === skillId) ?? null;
}
