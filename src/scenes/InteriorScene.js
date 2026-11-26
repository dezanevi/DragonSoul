import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { unlockRegion } from '../systems/RegionSystem.js';
import { addItem, getItemCount } from '../systems/InventorySystem.js';
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
  questsBlocking
} from '../systems/QuestSystem.js';
const AIR_QUEST = 'greenvale_air_song';
const INTRO_QUEST = 'greenvale_mage_intro';
import skillRowsForInterior from '../data/skills.json';

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
const ROOM_PRICE = 15;

const INTERIOR_DEFINITIONS = {
  greenvale_town_hall: {
    title: 'Radnice Greenvale',
    image: IMAGES.townHall,
    resident: 'Starosta Edric',
    spots: [
      { label: 'Starosta Edric', verb: 'mluvit', rect: [418, 195, 130, 125], action: 'mayor', questMarker: { quest: 'greenvale_cave_slime', role: 'giver' } },
      { label: 'Nástěnka úkolů', verb: 'prohlédnout', rect: [22, 88, 212, 232], action: 'board' },
      { label: 'Mapa světa', verb: 'otevřít', rect: [752, 95, 232, 170], action: 'card', card: 'WorldMap' },
      { label: 'Úřednice', verb: 'mluvit', rect: [243, 182, 85, 165], action: 'talk',
        lines: ['Starosta přijímá lovce každý den. Vyhlášky visí na nástěnce vlevo.'] },
      { label: 'Strážný', verb: 'mluvit', rect: [652, 172, 85, 228], action: 'talk',
        lines: ['Na radnici je klid. Ale v jeskyni za vesnicí se něco usadilo – buď opatrný.'] }
    ]
  },
  greenvale_tavern: {
    title: 'Hostinec Greenvale',
    image: IMAGES.tavern,
    resident: 'Výčepní',
    spots: [
      { label: 'Výčepní – pokoj na noc', verb: 'odpočinout', rect: [185, 140, 120, 165], action: 'innRoom' },
      { label: 'Hostinská kuchyně', verb: 'vařit', rect: [582, 160, 235, 145], action: 'kitchen', station: 4 },
      { label: 'Sklep – úschovna monster', verb: 'otevřít', rect: [0, 170, 140, 135], action: 'card', card: 'Party' },
      { label: 'Bard', verb: 'mluvit', rect: [478, 172, 110, 140], action: 'bard', questMarker: { quest: 'greenvale_air_song', role: 'objective' },
        lines: ['Zahraju ti o lovci, který ochočil draka… nebo aspoň Dire Wolfa.', 'Na louce západně od vesnice se toulají divoká monstra. Kdo je umí zkrotit, nikdy nebude sám.'] },
      { label: 'Lovec u stolu', verb: 'mluvit', rect: [840, 212, 112, 108], action: 'talk',
        lines: ['Než vyrazíš na louku, odpočiň si tu na pokoji, nebo zajdi za Liorou do domu léčitelky.', 'A dobrý pokrm z kuchyně ti v boji přidá sílu – ověřeno.'] }
    ]
  },
  greenvale_smithy: {
    title: 'Kovárna Greenvale',
    image: IMAGES.smithy,
    // Hornický mistr (Těžba): krumpáče, výkup surovin, specializace.
    resident: 'Hornický mistr',
    spots: [
      { label: 'Hornický mistr', verb: 'mluvit', rect: [490, 118, 150, 350], action: 'miner' },
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
      { label: 'Rybář', verb: 'mluvit', rect: [238, 88, 200, 315], action: 'fisher' },
      { label: 'Rybářské náčiní', verb: 'obchod', rect: [600, 82, 180, 250], action: 'fishingShop' }
    ]
  },
  greenvale_market: {
    title: 'Tržiště – potraviny',
    image: IMAGES.foodStall,
    spots: [
      { label: 'Trhovkyně', verb: 'mluvit', rect: [445, 65, 250, 330], action: 'talk',
        lines: ['Čerstvé ovoce, zelenina, houby a čistá voda! Podívej se, co dnes mám.'], shop: 'marketFood',
        questMarker: { quest: 'greenvale_clean_water', role: 'objective' } }
    ]
  },
  greenvale_market_wares: {
    title: 'Tržiště – zboží',
    image: IMAGES.clothStall,
    spots: [
      { label: 'Obchodník s látkami', verb: 'mluvit', rect: [365, 95, 215, 320], action: 'talk',
        lines: ['Látky, vlákno, řemínky a vosk – všechno pro řemeslníky.'], shop: 'marketWares',
        questMarker: { quest: 'greenvale_leather_strap', role: 'objective' } }
    ]
  },
  greenvale_alchemist: {
    title: 'Alchymistický obchod',
    image: IMAGES.alchemist,
    spots: [
      { label: 'Alchymista', verb: 'mluvit', rect: [315, 125, 170, 275], action: 'questGiver', quest: 'greenvale_clean_water', questMarker: { quest: 'greenvale_clean_water', role: 'giver' },
        lines: ['Destilační přístroj i hmoždíř jsou ti k dispozici. Zatím umí všechny recepty.'] },
      { label: 'Alchymistický stůl (dočasně umí vše)', verb: 'alchymie', rect: [560, 195, 150, 235], action: 'alchemy', station: 4 },
      { label: 'Alchymistický stůl (dočasně umí vše)', verb: 'alchymie', rect: [200, 340, 330, 120], action: 'alchemy', station: 4 }
    ]
  },
  greenvale_observatory: {
    title: 'Hvězdárna',
    image: IMAGES.mage,
    spots: [
      { label: 'Mág', verb: 'mluvit', rect: [290, 180, 180, 290], action: 'mage', questMarker: { quest: 'greenvale_mage_intro', role: 'giver', alt: 'greenvale_air_song' },
        lines: ['Hvězdy prozradí mnohé. Další školy magie tě naučím, až na to budeš připraven.', 'Křišťálová koule u mě slouží jako Soul Crystal Workbench – vyrobíš na ní Soul Crystaly.'] },
      { label: 'Soul Crystal Workbench', verb: 'vyrábět', rect: [200, 280, 140, 110], action: 'craft', station: 3 }
    ]
  },
  // Řemeslná dílna (Řemeslnictví): koželužský a šperkařský stůl.
  greenvale_house_e1: {
    title: 'Řemeslná dílna',
    image: IMAGES.tannery,
    spots: [
      { label: 'Řemeslnice', verb: 'mluvit', rect: [345, 110, 150, 280], action: 'talk',
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
      { label: 'Bylinkářka', verb: 'mluvit', rect: [238, 125, 168, 425], action: 'herbalist', questMarker: { quest: 'greenvale_river_herbs', role: 'giver' } },
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
      { label: 'Liora, léčitelka', verb: 'léčit', rect: [300, 115, 170, 300], action: 'healer' },
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
        if (event.code === 'Escape') this.closeChoice();
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

    if (data?.animateIn !== false && this.fromWorld) slideCardIn(this, { hide: this.tabBar.objects });
    SaveSystem.save(this.state);
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
    this.children.moveBelow(image, this.closeButton);

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
        this.showSpotLabel(`${spot.label} – ${spot.verb}`, r.x + r.w / 2, r.y - 8);
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

      if (spot.questMarker) {
        const marker = cardText(this, r.x + r.w / 2, r.y - 6, '', {
          size: 54, bold: true, color: '#ffd23a', originX: 0.5, originY: 1, strokeThickness: 7
        }).setDepth(11);
        this.tweens.add({ targets: marker, y: r.y - 18, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.questMarkers.push({ marker, ...spot.questMarker });
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
    switch (spot.action) {
      case 'mayor': this.talkToMayor(); break;
      case 'ownShop': this.launchOver('OwnShop', { shopId: this.interiorId, tab: spot.tab, animateIn: true }); break;
      case 'healer': this.healAtInn(); break;
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
      acceptQuest(this.state, INTRO_QUEST);
      addItem(this.state, 'basic_crystal', 1);
      this.state.flags.introPending = false;
      SaveSystem.save(this.state);
      this.showDialog(speaker, [
        `Vítej ve Hvězdárně, ${name}. Lovec z lesů a jeho věrný Dire Wolf – hvězdy mi o vás řekly.`,
        'Tvůj vlk je dobrý lovecký pes. Skutečný krotitel ale umí víc: se Soul Crystalem si získá i divokou bytost.',
        'Cítím v tobě jiskru magie – probudil jsem ti vítr. Kouzla Vzduchu najdeš v souboji pod tlačítkem Kouzla (Q).',
        'Na louce za Loveckou chatou krouží Air Elemental. Vlk ho musí zasáhnout, ty vyzkoušíš kouzlo a oslabený ti pak uvěří – ochočíš ho.',
        'Tady máš Soul Crystal. V souboji tě povedu krok za krokem.',
        'Nový úkol: Krotitelova zkouška. Cestu ukazují zlaté tečky (úkol se sleduje sám).'
      ]);
      this.refreshQuestMarker();
      return;
    }
    if (status === QUEST_STATUS.active) {
      // Krystal pro jistotu doplnit, aby se úkol nedal zablokovat.
      if (getItemCount(this.state, 'basic_crystal') <= 0) addItem(this.state, 'basic_crystal', 1);
      SaveSystem.save(this.state);
      this.showDialog(speaker, ['Air Elemental čeká na louce za Loveckou chatou. Vlk ho zasáhne, ty vyzkoušej kouzlo a pak ho ochoč Soul Crystalem.']);
      return;
    }
    completeQuest(this.state, INTRO_QUEST);
    SaveSystem.save(this.state);
    this.showDialog(speaker, [
      'Vítej zpátky – přenesl jsem tě sem, sotva krystal zazářil. Air Elemental je teď tvůj společník.',
      'Monstra v partě uvidíš v kartě Party (P). Zraněné vyléčí Liora v domě léčitelky u náměstí.',
      'Ve vesnici tě čekají lidé s prací: Alchymista, Učednice v kovárně a Bylinkářka. Starosta Edric na radnici má vážnější úkol – ale až si získáš důvěru vesnice.',
      'Za odvahu ti dávám pět Soul Crystalů – ať můžeš krotit dál.',
      'A až budeš chtít vítr poznat hlouběji, vrať se ke mně.',
      `Úkol dokončen: Krotitelova zkouška. Odměna: ${QUESTS[INTRO_QUEST].reward}`
    ]);
    this.refreshQuestMarker();
  }

  // Úkol Píseň větrů: Mág zadá, Bard zazpívá, Mág odemkne magii vzduchu.
  talkToMage(spot) {
    if (getQuestStatus(this.state, INTRO_QUEST) !== QUEST_STATUS.done) {
      this.talkMageIntro();
      return;
    }
    const speaker = 'Mág';
    const status = getQuestStatus(this.state, AIR_QUEST);
    if (status === QUEST_STATUS.notStarted) {
      acceptQuest(this.state, AIR_QUEST);
      SaveSystem.save(this.state);
      this.showDialog(speaker, [
        'Vítr ti už naslouchá – ale abys mu opravdu rozuměl, musíš slyšet, jak mluví.',
        'Bard v hostinci zná starou Píseň větrů. Nech si ji zazpívat a vrať se ke mně – tvá magie Vzduchu zesílí.',
        'Nový úkol: Píseň větrů. (Úkoly a Sledovat najdeš v kartě Úkoly.)'
      ]);
      return;
    }
    if (status === QUEST_STATUS.active) {
      this.showDialog(speaker, ['Bard v hostinci zná Píseň větrů. Bez ní ti vzduch nepoví nic.']);
      return;
    }
    if (status === QUEST_STATUS.ready) {
      completeQuest(this.state, AIR_QUEST);
      SaveSystem.save(this.state);
      this.showDialog(speaker, [
        'Slyším ji v tvém hlase – Píseň větrů. Teď už vzduch poslechne i tebe.',
        `Úkol dokončen: Píseň větrů. Odměna: ${QUESTS[AIR_QUEST].reward}`
      ]);
      return;
    }
    this.showDialog(speaker, spot.lines ?? ['…']);
  }

  // Zadavatel úvodního úkolu (Alchymista, Učednice): nabídka → připomínka → odměna.
  talkQuestGiver(spot) {
    const quest = QUESTS[spot.quest];
    const status = getQuestStatus(this.state, spot.quest);
    let lines;
    if (status === QUEST_STATUS.notStarted) {
      acceptQuest(this.state, spot.quest);
      lines = quest.dialog.offer;
    } else if (status === QUEST_STATUS.active) {
      lines = [...quest.dialog.active, `Teď: ${questStep(this.state, spot.quest)}`];
    } else if (status === QUEST_STATUS.ready) {
      completeQuest(this.state, spot.quest);
      lines = [...quest.dialog.ready, `Úkol dokončen: ${quest.title}. Odměna: ${quest.reward}`];
    } else {
      lines = spot.lines ?? quest.dialog.done;
    }
    SaveSystem.save(this.state);
    this.refreshQuestMarker();
    this.showDialog(spot.label, lines);
  }

  talkToBard(spot) {
    if (getQuestStatus(this.state, AIR_QUEST) === QUEST_STATUS.active) {
      markQuestObjective(this.state, AIR_QUEST);
      SaveSystem.save(this.state);
      this.showDialog('Bard', [
        'Píseň větrů? Tu zpívala už moje babička… Poslouchej:',
        '„Kdo vítr slyší, ten s ním letí, kdo vítr zná, ten nezabloudí.“',
        'Teď ji neseš v sobě. Vrať se za Mágem do Hvězdárny.'
      ]);
      return;
    }
    this.showDialog('Bard', spot.lines ?? ['…']);
  }

  // ------------------------------------------------------------------ postavy

  // Úkol Orčí hrozba (dřív Jeskynní sliz): starosta ho svěří až po všech ostatních úkolech
  // v Greenvale, odměnou jsou talentové stromy a cesta do Verdant Forest.
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
      `${type.slots} prodejních slotů · zhruba ${type.customers} zákazníků za herní den · provoz ${type.dailyCost} zl / den`,
      `Cena: ${prop.price} ${prop.price === 1 ? 'zlatý' : 'zlata'}${check.ok ? '' : `\n${check.reason}`}`
    ].join('\n'), [
      { label: 'Koupit dům', disabled: !check.ok, onClick: () => this.purchaseProperty(prop) },
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
    for (const o of this.choiceObjects ?? []) o.destroy();
    this.choiceObjects = null;
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
      acceptQuest(this.state, CAVE_QUEST);
      SaveSystem.save(this.state);
      this.showDialog(speaker, [
        `${name}, celá vesnice o tobě mluví dobře. Teď tě potřebuju já.`,
        'V jeskyni za vesnicí se usadil orčí válečník. Přepadá pocestné a lovce, co jdou k lesu.',
        'Poraz ho a vrať se za mnou. Pak tě naučím, jak se vydat cestou souboje, řemesel nebo magie.',
        'Pozor: s takovým soupeřem se nedá vyjednávat (bez simulace) a ochočit ho nepůjde.',
        'Nový úkol: Orčí hrozba. (Jeskyně: přijď k vchodu a stiskni E.)'
      ]);
      this.refreshQuestMarker();
      return;
    }

    if (status === QUEST_STATUS.ready) {
      completeQuest(this.state, CAVE_QUEST);
      unlockRegion(this.state, 'Verdant Forest');
      SaveSystem.save(this.state);
      this.showDialog(speaker, [
        'Orčí válečník je poražen? Greenvale ti dluží díky.',
        'Prokázal jsi, že jsi skutečný lovec. Od teď si můžeš zvolit svou cestu.',
        'Odemčeno: talentové stromy. Na kartě Talenty (T) si vyber hlavní specializaci.',
        'A cesta z Greenvale do Verdant Forest je také otevřená.'
      ]);
      this.refreshQuestMarker();
      return;
    }

    if (status === QUEST_STATUS.done) {
      this.showDialog(speaker, [
        'Greenvale je díky tobě v bezpečí. Talentové stromy i cesta do Verdant Forest jsou ti otevřené.'
      ]);
      return;
    }

    this.showDialog(speaker, [
      'Orčí válečník pořád řádí. Jeskyně je za vesnicí u skal – přijď k vchodu a stiskni E.',
      'Než vyrazíš, ať tě Liora v domě léčitelky dá do pořádku.'
    ]);
  }

  // „!“ = nový úkol, „?“ = splněno, vrať se. Jen u starosty.
  refreshQuestMarker() {
    for (const { marker, quest, role, alt } of this.questMarkers ?? []) {
      // alt = další úkol téže postavy (Mág: úvodní úkol, pak Píseň větrů) – až po dokončení prvního.
      const altMark = alt && getQuestStatus(this.state, quest) === QUEST_STATUS.done ? questMark(this.state, alt, role, this.interiorId) : null;
      const mark = questMark(this.state, quest, role, this.interiorId) ?? altMark;
      marker.setText(mark?.char ?? '').setColor(mark?.color ?? '#ffd23a');
    }
  }

  // Výčepní v hostinci: pokoj na noc za zlato – stejné léčení jako u Liory.
  rentRoom() {
    const gold = Math.max(0, Math.floor(Number(this.state.gold) || 0));
    if (gold < ROOM_PRICE) {
      this.showDialog('Výčepní', [`Pokoj na noc stojí ${ROOM_PRICE} zlata a ty máš jen ${gold}.`, 'Liora v domě léčitelky u náměstí léčí zadarmo.']);
      return;
    }
    this.state.gold = gold - ROOM_PRICE;
    restoreParty(this.state);
    SaveSystem.save(this.state);
    this.showDialog('Výčepní', [
      `Pokoj je tvůj – ${ROOM_PRICE} zlata. Dobrou noc!`,
      'Ráno: vyspalý, s plnou manou. Tvoje monstra v partě i ve stáji jsou odpočatá.'
    ]);
  }

  healAtInn() {
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
    this.showDialog('Liora, léčitelka', lines);
  }

  // Rybář: poprvé daruje základní náčiní, pak otevře obchod (FishingShopScene).
  talkToFisher() {
    this.state.flags ??= {};
    const lines = [];
    if (!this.state.flags.fishingStarterGiven) {
      this.state.flags.fishingStarterGiven = true;
      addItem(this.state, 'simple_rod', 1);
      addItem(this.state, 'fishing_hook', 1);
      addItem(this.state, 'bread_bait', 5);
      SaveSystem.save(this.state);
      lines.push(
        'Další rybář? To rád vidím. Tumáš starý prut, hák a pár chlebových návnad.',
        'Rybářská místa poznáš podle modrého kruhu u vody – na molu a podél břehu. Stoupni si k nim a stiskni E.',
        'Úlovky ti vykoupím za dobrou cenu a každý den hledám jeden druh ryby, za ten zaplatím víc.'
      );
    } else {
      lines.push('Tak co, berou? Podívej se, co mám na prodej, nebo mi ukaž úlovek.');
    }
    this.afterDialog = () => this.openFishingShop();
    this.showDialog('Rybář', lines);
  }

  // Hornický mistr: poprvé daruje Základní důlní krumpáč, pak otevře obchod (MiningShopScene).
  talkToMiner() {
    this.state.flags ??= {};
    const lines = [];
    if (!this.state.flags.miningStarterGiven) {
      this.state.flags.miningStarterGiven = true;
      addItem(this.state, 'pick_basic', 1);
      SaveSystem.save(this.state);
      lines.push(
        'Chceš se naučit kopat? Tumáš starý krumpáč, ať nezačínáš s holýma rukama.',
        'Naleziště poznáš podle hnědého kruhu s krumpáčem. Zkušební lom je za mostem na jihozápadě, u řeky – stoupni si k nalezišti a stiskni E.',
        'Vytěžené místo chvíli odpočívá: běžné žíly pět minut, vzácné i hodiny. Suroviny ti vykoupím a lepší krumpáče prodám.',
        'Až budeš mít Těžbu na pětadvacítce, přijď si vybrat specializaci.'
      );
    } else {
      lines.push('Zdar, horníku. Krumpáče, podpěry, výkup surovin nebo specializace – co to bude?');
    }
    this.afterDialog = () => this.openMiningShop();
    this.showDialog('Hornický mistr', lines);
  }

  // Bylinkářka: poprvé daruje Zahradnický srp a Léčivé byliny, pak otevře obchod (HerbalistShopScene).
  talkToHerbalist() {
    this.state.flags ??= {};
    const lines = [];
    if (!this.state.flags.herbStarterGiven) {
      this.state.flags.herbStarterGiven = true;
      addItem(this.state, 'herb_sickle', 1);
      addItem(this.state, 'healing_herbs', 5);
      SaveSystem.save(this.state);
      lines.push(
        'Bylinky mají v sobě víc síly než leckterý meč. Tumáš starý zahradnický srp a pár léčivých bylin na začátek.',
        'Naleziště poznáš podle zeleného kruhu s lístkem – na louce, u řeky, v lese i u vodopádu. Stoupni si k nim a stiskni E.',
        'Záhony za mostem na statku obnovuju každých deset minut. A co nasbíráš navíc, to ti ráda vykoupím.',
        'Až budeš mít Sběr bylin na pětadvacítce, přijď si vybrat specializaci.'
      );
    } else {
      lines.push('Vítej zpátky. Čerstvé byliny, srp, výkup nebo specializace – co potřebuješ?');
    }
    // Úkol Byliny od řeky (nasbírat 3× Čisticí byliny na břehu řeky).
    const herbQuest = 'greenvale_river_herbs';
    const herbStatus = getQuestStatus(this.state, herbQuest);
    if (herbStatus === QUEST_STATUS.notStarted) {
      acceptQuest(this.state, herbQuest);
      lines.push('A jestli se chceš opravdu učit: na břehu řeky rostou čisticí byliny. Natrhej dvě, kup čistou vodu a u Alchymisty z nich uvař protijed. Ten mi přines.', 'Nový úkol: Byliny od řeky.');
    } else if (herbStatus === QUEST_STATUS.active) {
      lines.push(`Pořád čekám na protijed z čisticích bylin. Teď: ${questStep(this.state, herbQuest)}`);
    } else if (herbStatus === QUEST_STATUS.ready) {
      completeQuest(this.state, herbQuest);
      lines.push('Protijed jako od mistra – čirý a bez hořkosti. Tady máš za snahu.', `Úkol dokončen: Byliny od řeky. Odměna: ${QUESTS[herbQuest].reward}`);
    }
    SaveSystem.save(this.state);
    this.refreshQuestMarker();
    this.afterDialog = () => this.openHerbalistShop();
    this.showDialog('Bylinkářka', lines);
  }

  // ------------------------------------------------------------------ menu nad interiérem

  // Scéna nad interiérem: interiér se pozastaví a po zavření se vrátí.
  launchOver(sceneKey, data) {
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

  openCooking(station, sceneKey = 'Cooking', stationName = undefined) {
    this.launchOver(sceneKey, { station, stationName });
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
    this.dialogBlocker.on('pointerup', () => this.advanceDialog());
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
