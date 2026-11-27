import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { cardText, cardButton, uiWindow, uiTitle, nineImage, openCardModal, uiToast } from '../ui/fantasyCard.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';

// Hlavní obrazovka: obrázek s logem a tlačítka nové sady UI (bez panelu; stejná tlačítka jako pauza a karty).
// Sloupec tlačítek je v pravém dolním rohu (okraj 60 px vpravo i dole).
const MENU_ITEMS = 5;
const BUTTON_W = 480;
const BUTTON_H = 68;
const BUTTON_STEP = 78; // mezera 10 px
const MARGIN = 60;
const BUTTON_X = GAME_WIDTH - MARGIN - BUTTON_W;
const BUTTON_Y = GAME_HEIGHT - MARGIN - BUTTON_H - (MENU_ITEMS - 1) * BUTTON_STEP;

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

create(data) {
  const saved = SaveSystem.load();
  this.menuState = data?.state ?? saved ?? null;

  this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'title-background')
    .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
    .setDepth(-10);

  const state = this.menuState;
  const hasSlots = SaveSystem.listSlots().some((slot) => !slot.empty);
  const items = [
    ['star', 'Nová hra', () => this.scene.start('CharacterCreate'), true],
    ['compass', 'Pokračovat', () => this.continueGame(), Boolean(state)],
    ['book', 'Nahrát hru', () => this.openSlots('load'), hasSlots],
    ['scroll', 'Uložit hru', () => this.openSlots('save'), Boolean(state)],
    // Vypnutí hry: zatím neaktivní (v prohlížeči hru zavře zavření záložky; v desktopové verzi bude funkční).
    ['castle', 'Vypnout hru', () => {}, false]
  ];
  // Jen tlačítka (bez panelu pod nimi).
  items.forEach(([icon, label, fn, enabled], i) => {
    this.menuButton(BUTTON_X, BUTTON_Y + i * BUTTON_STEP, BUTTON_W, icon, label, fn, enabled);
  });

  // Enter = Pokračovat (je-li rozehraná hra), jinak Nová hra.
  this.input.keyboard.on('keydown-ENTER', () => {
    if (this.slotLayer) return;
    if (this.menuState) this.continueGame();
    else this.scene.start('CharacterCreate');
  });
}

// Tlačítko menu: modré tlačítko nové sady s ikonou vlevo a popiskem uprostřed.
menuButton(x, y, w, icon, label, onClick, enabled) {
  cardButton(this, null, x, y, w, BUTTON_H, label, onClick, { size: 26, disabled: !enabled });
  const key = `nu-icon-${icon}`;
  if (this.textures.exists(key)) {
    const img = this.add.image(x + 44, y + BUTTON_H / 2, key);
    img.setScale(46 / Math.max(img.width, img.height)).setAlpha(enabled ? 1 : 0.4);
  }
}

continueGame() {
  const state = this.menuState ?? SaveSystem.load();
  if (state) this.openGameState(state);
  else this.showMessage('Zatím nemáš uloženou hru.');
}

openGameState(state) {
  if (state.interiorId) {
    this.scene.start('Interior', {
      state,
      interiorId: state.interiorId,
      fromWorld: false
    });
  } else {
    this.scene.start('World', { state });
  }
}

// Okno se sloty (Uložit hru / Nahrát hru): 5 slotů s náhledem hry, jménem, úrovní a časem.
openSlots(mode) {
  this.closeSlots();
  const layer = this.add.container(0, 0).setDepth(50);
  this.slotLayer = layer;
  const W = 1180;
  const H = 860;
  const X = (GAME_WIDTH - W) / 2;
  const Y = (GAME_HEIGHT - H) / 2;
  const before = this.children.list.length;
  uiWindow(this, X, Y, W, H, { shade: 0.55 });
  uiTitle(this, X + 40, Y + 26, mode === 'save' ? 'Uložit hru' : 'Nahrát hru', { icon: mode === 'save' ? 'scroll' : 'book', size: 36 });
  const ROW_H = 120;
  SaveSystem.listSlots().forEach((slot, i) => {
    const y = Y + 100 + i * (ROW_H + 8);
    const row = nineImage(this, 'nu-slot', X + 36, y, W - 72, ROW_H, 0.4);
    // Náhled hry (poslední snímek při uložení), jinak prázdný rámeček.
    const px = X + 56;
    const py = y + 12;
    const frame = this.add.rectangle(px, py, 192, 108, 0x05080c, 0.9).setOrigin(0).setStrokeStyle(2, 0xd6a23a);
    if (!slot.empty && slot.preview) {
      const key = `slot-preview-${slot.index}-${slot.savedAt}`;
      const show = () => { if (this.slotLayer === layer && this.textures.exists(key)) layer.add(this.add.image(px, py, key).setOrigin(0).setDisplaySize(192, 108)); };
      if (this.textures.exists(key)) show();
      else {
        this.textures.once(`addtexture-${key}`, show);
        this.textures.addBase64(key, slot.preview);
      }
    }
    const title = slot.empty ? `Slot ${slot.index} – prázdný` : `Slot ${slot.index} – ${slot.playerName}`;
    const info = slot.empty ? (mode === 'save' ? 'Ulož sem rozehranou hru.' : 'Zatím nic uloženého.')
      : `Úroveň ${slot.level} · ${slot.region} · Zlato ${slot.gold}
Uloženo ${new Date(slot.savedAt).toLocaleString('cs-CZ')}`;
    cardText(this, px + 216, y + 18, title, { size: 26, bold: true, color: slot.empty ? '#9fb3c8' : '#ffe7ae' });
    cardText(this, px + 216, y + 58, info, { size: 19, color: '#dbe6f3', lineSpacing: 6 });
    const action = mode === 'save'
      ? () => this.saveToSlot(slot)
      : () => this.loadFromSlot(slot);
    cardButton(this, null, X + W - 290, y + ROW_H / 2 - 30, 220, 60, mode === 'save' ? 'Uložit sem' : 'Nahrát', action, { disabled: mode === 'load' && slot.empty });
  });
  cardButton(this, null, GAME_WIDTH / 2 - 120, Y + H - 84, 240, 60, 'Zavřít', () => this.closeSlots(), { danger: true });
  // Vše, co okno vytvořilo, patří do vrstvy (zavře se najednou).
  layer.add(this.children.list.slice(before).filter((o) => o !== layer));
  this.slotKey = (event) => { if (event.code === 'Escape') this.closeSlots(); };
  this.input.keyboard.on('keydown', this.slotKey);
}

closeSlots() {
  if (this.slotKey) this.input.keyboard.off('keydown', this.slotKey);
  this.slotKey = null;
  this.slotModal?.destroy();
  this.slotModal = null;
  this.slotLayer?.destroy();
  this.slotLayer = null;
}

saveToSlot(slot) {
  if (!this.menuState) {
    this.showMessage('Není otevřená hra k uložení.');
    return;
  }
  const write = () => {
    const ok = SaveSystem.saveToSlot(slot.index, this.menuState);
    this.openSlots('save');
    this.showMessage(ok ? `Hra je uložená ve slotu ${slot.index}.` : 'Hru se nepodařilo uložit (málo místa v prohlížeči?).');
  };
  if (slot.empty) {
    write();
    return;
  }
  this.slotModal = openCardModal(this, `Přepsat slot ${slot.index}?`, [`Ve slotu je ${slot.playerName}, úroveň ${slot.level}. Uložená hra se nahradí.`], [
    { label: 'Přepsat', danger: true, onClick: () => { this.slotModal?.destroy(); this.slotModal = null; write(); } },
    { label: 'Zrušit', onClick: () => { this.slotModal?.destroy(); this.slotModal = null; } }
  ]);
  this.slotModal.setDepth(60);
}

loadFromSlot(slot) {
  const state = SaveSystem.loadSlot(slot.index);
  if (!state) {
    this.showMessage('Slot se nepodařilo nahrát.');
    return;
  }
  // Nahraná hra se stane rozehranou hrou (Pokračovat).
  SaveSystem.save(state);
  this.closeSlots();
  this.openGameState(state);
}

  showMessage(message) {
    uiToast(this, message, { y: GAME_HEIGHT - 40, depth: 100 }); // nad oknem slotů
  }
}
