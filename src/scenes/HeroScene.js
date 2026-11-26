import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import {
  CARD_TEXTURE,
  CARD_WIDTH,
  CARD_HEIGHT,
  CLOSE_BUTTON,
  CONTENT_AREA,
  STATUS_AREA,
  MAGIC_SCHOOLS
} from '../ui/heroCard/cardLayout.js';
import FantasyButton from '../ui/heroCard/FantasyButton.js';
import CharacterTabs from '../ui/heroCard/CharacterTabs.js';
import { createCardTabBar, slideCardIn, slideCardOut } from '../ui/cardTabBar.js';
import { drawCardFrame, CARD_FIT, cardButton } from '../ui/fantasyCard.js';
import CardTooltip from '../ui/heroCard/CardTooltip.js';
import EquipmentPanel from '../ui/heroCard/EquipmentPanel.js';
import SkillsPanel from '../ui/heroCard/SkillsPanel.js';
import {
  HeroOverview,
  HeroStats,
  MagicSchoolsPanel,
  GameInfoPanel
} from '../ui/heroCard/heroPanels.js';
import { cardText } from '../ui/heroCard/cardText.js';
import { closeStateKey } from '../ui/heroCard/tabSprites.js';
import { describeQuests } from '../systems/QuestSystem.js';
import { HERO_CARD_FEMALE } from '../ui/heroCard/heroButtonSprites.js';

// Šířka obrázku tlačítka Zavřít v souřadnicích podkladu (namalované tlačítko je ~270 px).
const CLOSE_IMAGE_WIDTH = 310;
import { EQUIPMENT_CHANGED, normalizeEquipment, getEquippedItem } from '../systems/EquipmentSystem.js';
import { equipSlot, unequipToSlot } from '../systems/InventorySystem.js';
import { getItem } from '../data/items.js';
import { RARITY } from '../data/fishing.js';
import { describeGearBonus } from '../data/smithing.js';
import { openHeroPicker } from '../ui/heroCard/heroPicker.js';

const SCHOOL_NAMES = { fire: 'Oheň', water: 'Voda', earth: 'Země', air: 'Vzduch', light: 'Světlo', dark: 'Temnota' };

// Události karty na this.game.events (pro ostatní systémy hry).
export const HERO_CARD_EVENTS = {
  tabChanged: 'hero-card-tab-changed',
  skillSelected: 'hero-skill-selected',
  equipmentSelected: 'hero-equipment-selected',
  closed: 'hero-card-closed'
};

// Karta hrdiny (CharacterCard): schválený obrázek karty jako podklad
// a nad ním samostatné interaktivní vrstvy. Otevírá se klávesou C ze světa,
// svět je mezitím pozastavený.
export default class HeroScene extends Phaser.Scene {
  constructor() {
    super('Hero');
  }

  create(data) {
    this.state = data?.state ?? SaveSystem.load();
    this.returnScene = data?.returnScene ?? 'World';
    this.storageAccess = Boolean(data?.storageAccess);
    // Phaser instanci scény znovu používá – příznak z minulého zavření vynulovat.
    this.closing = false;

    if (!this.state) {
      this.scene.start('Menu');
      return;
    }

    normalizeEquipment(this.state);

    // Panel karty jako karta Mapa, bez ztmavení okolí (chytá kliknutí mimo kartu).
    drawCardFrame(this);

    // Celá karta je v jednom kontejneru v souřadnicích podkladu 1536 × 1024,
    // zmenšená do panelu (CARD_FIT).
    this.card = this.add.container(CARD_FIT.OFFSET_X, CARD_FIT.OFFSET_Y);
    this.card.setScale(CARD_FIT.SCALE);

    // Ženská postava má vlastní podklad karty (stejné rozložení).
    const cardTexture = this.state.gender === 'female' && this.textures.exists(HERO_CARD_FEMALE) ? HERO_CARD_FEMALE : CARD_TEXTURE;
    if (this.textures.exists(cardTexture)) {
      this.card.add(this.add.image(0, 0, cardTexture).setOrigin(0));
    } else {
      this.card.add(
        this.add
          .rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x0b1830)
          .setOrigin(0)
          .setStrokeStyle(6, 0xd6a23a)
      );
    }

    this.heroLayer = this.add.container(0, 0);
    this.otherLayer = this.add.container(0, 0).setVisible(false);
    this.uiLayer = this.add.container(0, 0);
    this.tooltipLayer = this.add.container(0, 0);
    this.card.add([this.heroLayer, this.otherLayer, this.uiLayer, this.tooltipLayer]);

    this.tooltip = new CardTooltip(this, this.tooltipLayer);

    this.createHeroTab();
    this.createOtherTabPanel();

    // Záložky karty: vlastní logika (klávesy 1–8) ve skryté vrstvě, na obrazovce společná
    // horní lišta jako na ostatních kartách (klik na aktivní záložku kartu zavře).
    this.hiddenTabsLayer = this.add.container(0, 0).setVisible(false);
    this.card.add(this.hiddenTabsLayer);
    this.tabs = new CharacterTabs(this, this.hiddenTabsLayer, (tab) => this.showTab(tab));
    this.tabBar = createCardTabBar(this, 'hero', {
      state: this.state,
      onSelect: (tabId) => this.tabs.select(tabId),
      onClose: () => this.closeCard()
    });
    // Otevřeno ze světa / interiéru: karta vyjede zpod lišty.
    if (data?.animateIn) slideCardIn(this, { hide: this.tabBar.objects });

    // Zavřít: obrázek ze „Čtyři stavy fantasy tlačítka Zavřít“ přes namalované tlačítko
    // (klid / pod myší / stisk / nedostupné). Záře tlačítka jen jako záloha bez grafiky.
    const closeSprites = this.textures.exists(closeStateKey('normal'));
    const closeImage = closeSprites
      ? this.add.image(
          CLOSE_BUTTON.x + CLOSE_BUTTON.w / 2,
          CLOSE_BUTTON.y + CLOSE_BUTTON.h / 2,
          closeStateKey('normal')
        )
      : null;
    if (closeImage) this.uiLayer.add(closeImage);

    this.closeButton = new FantasyButton(this, this.uiLayer, CLOSE_BUTTON, {
      label: 'Zavřít',
      radius: 22,
      drawHover: !closeSprites,
      onClick: () => this.closeCard(),
      onStateChange: (button) => {
        if (!closeImage) return;
        closeImage.setTexture(closeStateKey(button.visualState));
        // Stejná šířka pro všechny stavy; výška podle poměru obrázku.
        closeImage.setScale(CLOSE_IMAGE_WIDTH / closeImage.width);
      }
    });

    // Hlášení (vybraný slot, dovednost) – s vlastním podkladem, ať je čitelné přes rám.
    const { x: sx, y: sy, w: sw, h: sh } = STATUS_AREA;
    this.statusBox = this.add.graphics().setVisible(false);
    this.statusBox.fillStyle(0x07111f, 0.92).fillRoundedRect(sx, sy, sw, sh, 10);
    this.statusBox.lineStyle(2, 0xd6a23a, 0.9).strokeRoundedRect(sx + 1, sy + 1, sw - 2, sh - 2, 10);
    this.uiLayer.add(this.statusBox);
    this.status = cardText(this, this.uiLayer, sx + 16, sy + sh / 2, '', {
      size: 21,
      bold: false,
      color: '#f2ce80'
    });

    this.refresh();
    this.setupKeyboard();

    // Otevřeno z lišty jiné karty na záložce bez vlastní karty (Inventář, Mapa…).
    const initialTab = data?.initialTab;
    if (initialTab && !['hero', 'talents', 'party', 'inventory', 'map'].includes(initialTab)) {
      this.tabs.select(initialTab);
    }

    this.onEquipmentChanged = () => this.refresh();
    this.game.events.on(EQUIPMENT_CHANGED, this.onEquipmentChanged);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(EQUIPMENT_CHANGED, this.onEquipmentChanged);
      this.input.keyboard.off('keydown', this.onCardKeyDown);
    });
  }

  // ------------------------------------------------------------ záložka Hrdina

  createHeroTab() {
    this.panels = [
      new HeroOverview(this, this.heroLayer),
      new HeroStats(this, this.heroLayer, this.tooltip),
      new MagicSchoolsPanel(this, this.heroLayer, (school, info) => {
        this.setStatus(
          info.unlocked
            ? `Škola ${SCHOOL_NAMES[school.id] ?? school.label}: úroveň ${info.level} · zkušenosti ${info.exp} / ${info.needed}`
            : `Škola ${SCHOOL_NAMES[school.id] ?? school.label}: zamčeno – odemkne se v průběhu hry.`
        );
        // Klik na školu magie otevře Knihu kouzel na stránce této školy.
        this.openSpellbook(school.id);
      }),
      new GameInfoPanel(this, this.heroLayer)
    ];

    this.equipment = new EquipmentPanel(this, this.heroLayer, this.tooltip, (slot, item) => {
      this.game.events.emit(HERO_CARD_EVENTS.equipmentSelected, { slot, item, state: this.state });
      this.setStatus(
        slot ? `Vybrán slot: ${slot.label}${item ? ` – ${item.name ?? item.id}` : ' (prázdný)'} · pravý klik = obléct` : ''
      );
    }, (slot) => this.openEquipPicker(slot));
    this.input.mouse?.disableContextMenu();

    this.skills = new SkillsPanel(this, this.heroLayer, this.tooltip, (skill) => {
      this.game.events.emit(HERO_CARD_EVENTS.skillSelected, { skill, state: this.state });
      // Klik na dovednost otevře kartu Řemesla na této profesi.
      SaveSystem.save(this.state);
      this.closing = true;
      this.scene.stop();
      this.scene.launch('Professions', { state: this.state, returnScene: this.returnScene, storageAccess: this.storageAccess, profession: skill.id });
      this.scene.bringToTop('Professions');
    });

    this.panels.push(this.equipment, this.skills);

    // Kniha kouzel: tlačítko vpravo od Zavřít (souřadnice podkladu karty, stejná výška).
    this.spellbookButton = cardButton(this, this.heroLayer, 930, 914, 300, 78, 'Kniha kouzel (K)', () => this.openSpellbook(), { size: 24 });
  }

  // Kniha kouzel přes kartu hrdiny (karta se pozastaví a po zavření knihy pokračuje).
  openSpellbook(school = null) {
    this.tooltip?.hide();
    this.scene.pause();
    this.scene.launch('Spellbook', { state: this.state, school, returnScene: this.scene.key });
    this.scene.bringToTop('Spellbook');
  }

  refresh() {
    this.panels.forEach((panel) => panel.refresh(this.state));
  }

  // ----------------------------------------------------------- ostatní záložky

  // Ostatní záložky zatím nemají obsah. Rám karty, navigace i velikost zůstávají.
  createOtherTabPanel() {
    const { x, y, w, h } = CONTENT_AREA;
    const g = this.add.graphics();

    g.fillStyle(0x07111f, 0.97).fillRoundedRect(x, y, w, h, 18);
    g.lineStyle(5, 0xd6a23a, 1).strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 18);
    g.lineStyle(2, 0x8a6420, 1).strokeRoundedRect(x + 14, y + 14, w - 28, h - 28, 12);

    this.otherLayer.add(g);
    this.otherTitle = cardText(this, this.otherLayer, x + w / 2, y + h / 2 - 50, '', {
      size: 56,
      originX: 0.5,
      color: '#ffd76a'
    });
    this.otherBody = cardText(
      this,
      this.otherLayer,
      x + w / 2,
      y + h / 2 + 30,
      'Obsah této záložky se připravuje.',
      { size: 28, originX: 0.5, bold: false, color: '#d8e7f5' }
    );

    // Záložka Úkoly: seznam přijatých úkolů.
    this.questText = cardText(this, this.otherLayer, x + 90, y + 120, '', {
      size: 26,
      bold: false,
      originY: 0,
      color: '#e8eef5'
    });
    this.questText.setWordWrapWidth(w - 180);
  }

  showTab(tab) {
    // Záložky Talenty a Party otevřou samostatné karty (stejné jako klávesy T a P).
    const cardScenes = { talents: 'Talents', party: 'Party', inventory: 'Inventory', crafting: 'Professions', bestiary: 'Bestiary', map: 'WorldMap', quests: 'Quests' };
    if (cardScenes[tab.id]) {
      const sceneKey = cardScenes[tab.id];
      SaveSystem.save(this.state);
      this.closing = true;
      this.scene.stop();
      this.scene.launch(sceneKey, { state: this.state, returnScene: this.returnScene, storageAccess: this.storageAccess });
      this.scene.bringToTop(sceneKey);
      return;
    }

    const isHero = tab.id === 'hero';
    this.tabBar?.setActive(tab.id);

    this.heroLayer.setVisible(isHero);
    this.otherLayer.setVisible(!isHero);
    this.otherTitle.setText(tab.label);
    this.showQuestList(tab.id === 'quests');
    this.tooltip.hide();

    // Skryté vrstvy nesmí chytat myš.
    [...this.equipment.buttons, ...this.skills.buttons, ...this.panels[2].buttons].forEach((button) =>
      button.setVisible(isHero)
    );
    for (const o of this.spellbookButton?.objects ?? []) o.setVisible(isHero);

    this.setStatus('');
    this.clearFocus();
    this.game.events.emit(HERO_CARD_EVENTS.tabChanged, { tab, state: this.state });
  }

  showQuestList(visible) {
    const { y, h } = CONTENT_AREA;
    this.otherTitle.setY(visible ? y + 60 : y + h / 2 - 50);
    this.otherBody.setVisible(!visible);
    this.questText.setVisible(visible);
    if (!visible) return;
    const quests = describeQuests(this.state);
    this.questText.setText(
      quests.length
        ? quests.map((quest) => `◆ ${quest.title}\n${quest.text}`).join('\n\n')
        : 'Zatím nemáš žádný úkol. Zajdi za starostou Edricem na radnici Greenvale.'
    );
  }

  // Bod karty (souřadnice podkladu) → souřadnice obrazovky.
  cardPoint(x, y) {
    return { x: this.card.x + x * this.card.scaleX, y: this.card.y + y * this.card.scaleY };
  }

  // Pravý klik na slot výbavy: předměty pro tento slot z inventáře (klik = obléct)
  // a Sundat, když je slot obsazený.
  openEquipPicker(slot) {
    this.tooltip?.hide();
    const groups = new Map();
    this.state.inventory.slots.forEach((entry, index) => {
      const item = getItem(entry?.id);
      if (!item || item.slot !== slot.id) return;
      const group = groups.get(item.id) ?? { item, index, qty: 0 };
      group.qty += entry.qty;
      groups.set(item.id, group);
    });
    const rows = [...groups.values()].map(({ item, index, qty }) => ({
      itemId: item.id,
      title: `${item.name}${qty > 1 ? ` ×${qty}` : ''}`,
      sub: (item.gear ? describeGearBonus(item.gear) : '') || item.description || '',
      color: RARITY[item.rarity]?.color,
      onClick: () => {
        const result = equipSlot(this.state, index, this.game.events);
        this.setStatus(result.message);
        SaveSystem.save(this.state);
        this.refresh();
      }
    }));
    const equipped = getEquippedItem(this.state, slot.id);
    const at = this.cardPoint(slot.area.x + slot.area.w + 10, slot.area.y);
    openHeroPicker(this, {
      x: at.x, y: at.y,
      title: `${slot.label} – obléct`,
      rows,
      emptyText: 'Nemáš žádné vybavení.',
      footer: equipped ? {
        label: `Sundat: ${equipped.name ?? equipped.id}`,
        danger: true,
        onClick: () => {
          const result = unequipToSlot(this.state, slot.id, null, this.game.events);
          this.setStatus(result.message);
          SaveSystem.save(this.state);
          this.refresh();
        }
      } : null
    });
  }

  setStatus(text) {
    this.status.setText(text);
    this.statusBox.setVisible(Boolean(text));
  }

  // ------------------------------------------------------------- klávesnice

  setupKeyboard() {
    this.focusIndex = -1;

    this.onCardKeyDown = (event) => {
      // Otevřené okno výběru (výbava, kouzla) zavře Esc jako první.
      if (event.code === 'Escape' && this.heroPicker) {
        this.heroPicker.close();
        return;
      }
      if (event.code === 'Escape' || event.code === 'KeyC') {
        this.closeCard();
        return;
      }
      if (event.code === 'KeyK' && this.heroLayer.visible) {
        this.openSpellbook();
        return;
      }

      if (event.code === 'Tab') {
        event.preventDefault?.();
        this.moveFocus(event.shiftKey ? -1 : 1);
        return;
      }

      if ((event.code === 'Enter' || event.code === 'Space') && this.focusIndex >= 0) {
        this.focusables()[this.focusIndex]?.activate();
        return;
      }

      // Čísla 1–8 přepínají záložky.
      const digit = Number(event.key);
      if (digit >= 1 && digit <= this.tabs.buttons.length) {
        this.tabs.buttons[digit - 1].activate();
      }
    };

    this.input.keyboard.addCapture('TAB');
    this.input.keyboard.on('keydown', this.onCardKeyDown);
  }

  focusables() {
    const heroButtons = this.heroLayer.visible
      ? [...this.equipment.buttons, ...this.skills.buttons, ...this.panels[2].buttons]
      : [];

    return [...this.tabs.buttons, ...heroButtons, this.closeButton].filter(
      (button) => !button.disabled
    );
  }

  moveFocus(step) {
    const list = this.focusables();
    if (list.length === 0) return;

    list[this.focusIndex]?.setFocused(false);
    this.focusIndex = (this.focusIndex + step + list.length) % list.length;
    list[this.focusIndex].setFocused(true);
  }

  clearFocus() {
    [...this.tabs.buttons, ...this.equipment.buttons, ...this.skills.buttons, ...this.panels[2].buttons, this.closeButton]
      .forEach((button) => button.setFocused(false));
    this.focusIndex = -1;
  }

  // ---------------------------------------------------------------- zavření

  closeCard() {
    if (this.closing) return;
    this.closing = true;

    SaveSystem.save(this.state);
    this.game.events.emit(HERO_CARD_EVENTS.closed, { state: this.state });
    // Karta zajede pod lištu, pak se vrátí scéna pod ní.
    slideCardOut(this, () => {
      this.scene.stop();
      this.scene.resume(this.returnScene);
    }, { hide: this.tabBar?.objects });
  }
}
