import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { cardText, cardButton, uiWindow, uiTitle, nineImage, openCardModal } from '../ui/fantasyCard.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { menuButtonKey } from '../ui/menuButtons.js';

// Šířka tlačítka v menu (px při rozlišení 1920 × 1080).
const MENU_BUTTON_WIDTH = 460;

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

create(data) {
  const saved = SaveSystem.load();
  this.menuState = data?.state ?? saved ?? null;

  this.nameEntryOpen = false;
  this.nameEntryObjects = [];
  this.nameBuffer = '';

  this.add.image(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2,
    'title-background'
  )
    .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
    .setDepth(-10);

  // Tlačítka uprostřed obrazovky (výška beze změny), pořadí: Nová hra, Pokračovat, Nahrát hru, Uložit hru.
  const columnX = GAME_WIDTH / 2;
  const firstY = 560;
  const step = 122;

  // Nová hra: obrazovka vytvoření postavy (jméno, muž / žena).
  this.addButton(columnX, firstY, 'new', 'Nová hra', () => this.scene.start('CharacterCreate'));

  this.addButton(
    columnX,
    firstY + step,
    'continue',
    'Pokračovat',
    () => {
      const state = this.menuState ?? SaveSystem.load();

      if (state) {
        this.openGameState(state);
      } else {
        this.showMessage('Zatím nemáš uloženou hru.');
      }
    },
    Boolean(this.menuState)
  );

  this.addButton(
    columnX,
    firstY + step * 2,
    'load',
    'Nahrát hru',
    () => this.openSlots('load'),
    SaveSystem.listSlots().some((slot) => !slot.empty)
  );

  this.addButton(
    columnX,
    firstY + step * 3,
    'save',
    'Uložit hru',
    () => this.openSlots('save'),
    Boolean(this.menuState)
  );

  // Prototyp souboje Soul Clash – cvičné souboje (nezávislé na uložené hře).
  cardButton(this, null, 40, GAME_HEIGHT - 110, 420, 66, 'Cvičné souboje (Soul Clash)', () => this.scene.start('SoulClash', { returnScene: 'Menu' }), { size: 22 });
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


  // Tlačítko z obrázku: v klidu modré, pod myší zlaté.
  // Nedostupné tlačítko je ztlumené a nereaguje.
  addButton(x, y, id, label, callback, enabled = true) {
    if (!this.registry.get('menuButtonsReady')) {
      this.addTextButton(x, y, label, callback, enabled);
      return;
    }

    const normalKey = menuButtonKey(id, 'normal');
    const hoverKey = menuButtonKey(id, 'hover');
    const button = this.add.image(x, y, normalKey).setDepth(1);

    const show = (key) => {
      button.setTexture(key);
      button.setScale(MENU_BUTTON_WIDTH / button.width);
    };

    show(normalKey);

    if (!enabled) {
      button.setAlpha(0.45);
      return;
    }

    button.setInteractive({ useHandCursor: true });
    button.on('pointerover', () => show(hoverKey));
    button.on('pointerout', () => show(normalKey));
    button.on('pointerdown', callback);
  }

  // Náhradní textové tlačítko, kdyby se obrázek tlačítek nepodařilo načíst.
  addTextButton(x, y, label, callback, enabled = true) {
    const button = this.add.text(x, y, label, {
      fontFamily: 'Lora, Georgia, "Times New Roman", serif',
      fontSize: '16px',
      color: enabled ? '#fff1c6' : '#aaa18c',
      backgroundColor: enabled ? '#59421f' : '#39352d',
      padding: { x: 16, y: 8 }
    })
      .setResolution(2)
      .setOrigin(0.5)
      .setDepth(1);

    if (!enabled) return;

    button.setInteractive({ useHandCursor: true });
    button.on('pointerover', () => {
      button.setStyle({ color: '#ffe28b' });
    });
    button.on('pointerout', () => {
      button.setStyle({ color: '#fff1c6' });
    });
    button.on('pointerdown', callback);
  }

  openNameEntry() {
    if (this.nameEntryOpen) return;

    this.nameEntryOpen = true;
    this.nameBuffer = '';
    this.nameEntryObjects = [];

    const panel = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      420,
      174,
      0x15120d,
      0.98
    )
      .setStrokeStyle(2, 0xc99b48, 1)
      .setDepth(10);

    this.nameEntryObjects.push(panel);

    const title = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 52,
      'JMÉNO HRDINY',
      {
        fontFamily: 'Lora, Georgia, "Times New Roman", serif',
        fontSize: '16px',
        color: '#f2d28a'
      }
    )
      .setResolution(2)
      .setOrigin(0.5)
      .setDepth(11);

    this.nameEntryObjects.push(title);

    this.nameInputText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 8,
      'Arion',
      {
        fontFamily: 'Lora, Georgia, "Times New Roman", serif',
        fontSize: '18px',
        color: '#fff1c6',
        backgroundColor: '#263126',
        padding: { x: 12, y: 7 },
        align: 'center'
      }
    )
      .setResolution(2)
      .setOrigin(0.5)
      .setDepth(11);

    this.nameEntryObjects.push(this.nameInputText);

    const hint = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 31,
      'Napiš jméno, potom stiskni Enter. Prázdné jméno použije Arion.',
      {
        fontFamily: 'Lora, Georgia, "Times New Roman", serif',
        fontSize: '9px',
        color: '#ead9af'
      }
    )
      .setResolution(2)
      .setOrigin(0.5)
      .setDepth(11);

    this.nameEntryObjects.push(hint);

    const cancelHint = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 54,
      'Esc: zpět  |  Nejvýše 20 znaků',
      {
        fontFamily: 'Lora, Georgia, "Times New Roman", serif',
        fontSize: '9px',
        color: '#aaa18c'
      }
    )
      .setResolution(2)
      .setOrigin(0.5)
      .setDepth(11);

    this.nameEntryObjects.push(cancelHint);

    this.onNameEntryKeyDown = (event) => {
      if (event.key === 'Escape') {
        this.closeNameEntry();
        return;
      }

      if (event.key === 'Enter') {
        this.confirmNameEntry();
        return;
      }

      if (event.key === 'Backspace') {
        this.nameBuffer = Array.from(this.nameBuffer).slice(0, -1).join('');
        this.updateNameDisplay();
        return;
      }

      if (
        event.key &&
        Array.from(event.key).length === 1 &&
        Array.from(this.nameBuffer).length < 20
      ) {
        this.nameBuffer += event.key;
        this.updateNameDisplay();
      }
    };

    this.input.keyboard.on('keydown', this.onNameEntryKeyDown);
  }

  updateNameDisplay() {
    if (!this.nameInputText) return;

    this.nameInputText.setText(this.nameBuffer || 'Arion');
  }

  closeNameEntry() {
    if (this.onNameEntryKeyDown) {
      this.input.keyboard.off('keydown', this.onNameEntryKeyDown);
      this.onNameEntryKeyDown = null;
    }

    for (const object of this.nameEntryObjects) {
      object.destroy();
    }

    this.nameEntryObjects = [];
    this.nameInputText = null;
    this.nameEntryOpen = false;
    this.nameBuffer = '';
  }

  confirmNameEntry() {
    const playerName = Array.from(
      this.nameBuffer.normalize('NFC').trim()
    )
      .slice(0, 20)
      .join('');

    this.closeNameEntry();

    const state = SaveSystem.createNew(playerName || 'Arion');
   SaveSystem.save(state);
this.openGameState(state);

  }

  showMessage(message) {
    const text = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 30,
      message,
      {
        fontFamily: 'Lora, Georgia, "Times New Roman", serif',
        fontSize: '14px',
        color: '#ffe28b',
        backgroundColor: '#263126',
        padding: { x: 10, y: 6 }
      }
    )
      .setResolution(2)
      .setOrigin(0.5)
      .setDepth(100); // nad oknem slotů

    this.time.delayedCall(1800, () => text.destroy());
  }
}
