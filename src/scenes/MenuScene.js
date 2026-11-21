import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
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

  // Tlačítka vpravo, pořadí podle návrhu: Nová hra, Pokračovat, Nahrát hru, Uložit hru.
  const columnX = GAME_WIDTH - 330;
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
    () => this.loadFromMenu(),
    Boolean(saved)
  );

  this.addButton(
    columnX,
    firstY + step * 3,
    'save',
    'Uložit hru',
    () => this.saveFromMenu(),
    Boolean(this.menuState)
  );

  const currentState = this.menuState ?? {
    playerName: 'Arion',
    level: 1,
    gold: 25
  };

  this.add.text(
    columnX,
    firstY + step * 3 + 82,
    `${currentState.playerName ?? 'Arion'}  |  Level ${currentState.level}  |  Zlato ${currentState.gold}`,
    {
      fontFamily: 'Verdana, Arial, sans-serif',
      fontSize: '18px',
      color: '#fff1c6',
      backgroundColor: '#15120dcc',
      padding: { x: 12, y: 6 }
    }
  )
    .setResolution(2)
    .setOrigin(0.5)
    .setDepth(1);
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

saveFromMenu() {
  if (!this.menuState) {
    this.showMessage('Není otevřená hra k uložení.');
    return;
  }

  const saved = SaveSystem.save(this.menuState);

  this.showMessage(
    saved ? 'Hra byla uložena.' : 'Hru se nepodařilo uložit.'
  );
}

loadFromMenu() {
  const saved = SaveSystem.load();

  if (!saved) {
    this.showMessage('Není dostupná uložená hra.');
    return;
  }

  this.openGameState(saved);
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
      fontFamily: 'Verdana, Arial, sans-serif',
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
        fontFamily: 'Verdana, Arial, sans-serif',
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
        fontFamily: 'Verdana, Arial, sans-serif',
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
        fontFamily: 'Verdana, Arial, sans-serif',
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
        fontFamily: 'Verdana, Arial, sans-serif',
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
this.scene.start('Interior', {
  state,
  interiorId: state.interiorId,
  fromWorld: false
});

  }

  showMessage(message) {
    const text = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 30,
      message,
      {
        fontFamily: 'Verdana, Arial, sans-serif',
        fontSize: '14px',
        color: '#ffe28b',
        backgroundColor: '#263126',
        padding: { x: 10, y: 6 }
      }
    )
      .setResolution(2)
      .setOrigin(0.5)
      .setDepth(5);

    this.time.delayedCall(1800, () => text.destroy());
  }
}
