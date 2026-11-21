import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import {
  CARD_TEXTURE,
  CARD_WIDTH,
  CARD_HEIGHT,
  CLOSE_BUTTON,
  CONTENT_AREA,
  STATUS_AREA
} from '../ui/heroCard/cardLayout.js';
import FantasyButton from '../ui/heroCard/FantasyButton.js';
import CharacterTabs from '../ui/heroCard/CharacterTabs.js';
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
import { EQUIPMENT_CHANGED, normalizeEquipment } from '../systems/EquipmentSystem.js';

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
    // Phaser instanci scény znovu používá – příznak z minulého zavření vynulovat.
    this.closing = false;

    if (!this.state) {
      this.scene.start('Menu');
      return;
    }

    normalizeEquipment(this.state);

    // Ztmavení světa pod kartou; zároveň chytá kliknutí mimo kartu.
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x02060c, 0.72)
      .setOrigin(0)
      .setInteractive();

    // Celá karta je v jednom kontejneru v souřadnicích podkladu 1536 × 1024.
    const scale = Math.min(GAME_WIDTH / CARD_WIDTH, GAME_HEIGHT / CARD_HEIGHT);
    this.card = this.add.container(
      (GAME_WIDTH - CARD_WIDTH * scale) / 2,
      (GAME_HEIGHT - CARD_HEIGHT * scale) / 2
    );
    this.card.setScale(scale);

    if (this.textures.exists(CARD_TEXTURE)) {
      this.card.add(this.add.image(0, 0, CARD_TEXTURE).setOrigin(0));
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

    this.tabs = new CharacterTabs(this, this.uiLayer, (tab) => this.showTab(tab));

    this.closeButton = new FantasyButton(this, this.uiLayer, CLOSE_BUTTON, {
      label: 'Zavřít',
      radius: 22,
      onClick: () => this.closeCard()
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
      new HeroStats(this, this.heroLayer),
      new MagicSchoolsPanel(this, this.heroLayer),
      new GameInfoPanel(this, this.heroLayer)
    ];

    this.equipment = new EquipmentPanel(this, this.heroLayer, this.tooltip, (slot, item) => {
      this.game.events.emit(HERO_CARD_EVENTS.equipmentSelected, { slot, item, state: this.state });
      this.setStatus(
        slot ? `Vybrán slot: ${slot.label}${item ? ` – ${item.name ?? item.id}` : ' (prázdný)'}` : ''
      );
    });

    this.skills = new SkillsPanel(this, this.heroLayer, this.tooltip, (skill) => {
      this.game.events.emit(HERO_CARD_EVENTS.skillSelected, { skill, state: this.state });
      this.setStatus(`${skill.label}: řemeslo se připravuje.`);
    });

    this.panels.push(this.equipment, this.skills);
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
    cardText(
      this,
      this.otherLayer,
      x + w / 2,
      y + h / 2 + 30,
      'Obsah této záložky se připravuje.',
      { size: 28, originX: 0.5, bold: false, color: '#d8e7f5' }
    );
  }

  showTab(tab) {
    const isHero = tab.id === 'hero';

    this.heroLayer.setVisible(isHero);
    this.otherLayer.setVisible(!isHero);
    this.otherTitle.setText(tab.label);
    this.tooltip.hide();

    // Skryté vrstvy nesmí chytat myš.
    [...this.equipment.buttons, ...this.skills.buttons].forEach((button) =>
      button.setVisible(isHero)
    );

    this.setStatus('');
    this.clearFocus();
    this.game.events.emit(HERO_CARD_EVENTS.tabChanged, { tab, state: this.state });
  }

  setStatus(text) {
    this.status.setText(text);
    this.statusBox.setVisible(Boolean(text));
  }

  // ------------------------------------------------------------- klávesnice

  setupKeyboard() {
    this.focusIndex = -1;

    this.onCardKeyDown = (event) => {
      if (event.code === 'Escape' || event.code === 'KeyC') {
        this.closeCard();
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
      ? [...this.equipment.buttons, ...this.skills.buttons]
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
    [...this.tabs.buttons, ...this.equipment.buttons, ...this.skills.buttons, this.closeButton]
      .forEach((button) => button.setFocused(false));
    this.focusIndex = -1;
  }

  // ---------------------------------------------------------------- zavření

  closeCard() {
    if (this.closing) return;
    this.closing = true;

    SaveSystem.save(this.state);
    this.game.events.emit(HERO_CARD_EVENTS.closed, { state: this.state });
    this.scene.stop();
    this.scene.resume(this.returnScene);
  }
}
