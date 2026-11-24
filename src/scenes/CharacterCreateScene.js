import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { createTestGame } from '../systems/TestGameSystem.js';

// Vytvoření postavy po kliknutí na „Nová hra“: jméno a volba muž / žena.
// Podklad je tabulka name-panel.png (rám s drakem, nápis Jméno a pole pro jméno),
// avatary a tlačítka z prototypu Dragon_Souls_Character_Select_Assets
// (public/assets/ui/character-select/). Neaktivní avatar je šedý,
// aktivní svítí; tlačítko Potvrdit má stav pod myší.

const ASSET_PATH = 'assets/ui/character-select/';
const SPRITES = [
  'male_selected', 'male_inactive', 'male_button_active', 'male_button_inactive',
  'female_selected', 'female_inactive', 'female_button_active', 'female_button_inactive',
  'confirm_normal', 'confirm_hover'
];
const key = (name) => `charsel-${name}`;
const PANEL_KEY = 'charsel-name-panel';

// Tabulka name-panel.png (1536 × 1024): umístění na obrazovce a pole pro jméno
// v souřadnicích obrázku.
const PANEL = { x: 192, y: 8, scale: 1 };
const NAME_BOX = { x: 460, y: 378, w: 615, h: 94 };
const MAX_NAME_LENGTH = 20;
const TEST_GAME_NAME = 'admin91';
const FONT = 'Lora, Georgia, "Times New Roman", serif';

export default class CharacterCreateScene extends Phaser.Scene {
  constructor() {
    super('CharacterCreate');
  }

  preload() {
    if (!this.textures.exists(PANEL_KEY)) {
      this.load.image(PANEL_KEY, `${ASSET_PATH}name-panel.png`);
    }
    for (const name of SPRITES) {
      if (!this.textures.exists(key(name)) && !this.textures.exists(`${key(name)}-raw`)) {
        this.load.image(`${key(name)}-raw`, `${ASSET_PATH}${name}.png`);
      }
    }
  }

  create() {
    this.prepareSprites();

    this.gender = 'male';
    this.nameBuffer = '';
    this.confirmed = false;

    const cx = GAME_WIDTH / 2;

    // Pozadí: úvodní obrázek ztlumený pod panelem.
    if (this.textures.exists('title-background')) {
      this.add.image(cx, GAME_HEIGHT / 2, 'title-background').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    }
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050b14, 0.62).setOrigin(0);

    // Tabulka s rámem, nápisem Jméno a polem pro jméno.
    if (this.textures.exists(PANEL_KEY)) {
      this.add.image(PANEL.x, PANEL.y, PANEL_KEY).setOrigin(0).setScale(PANEL.scale);
    } else {
      this.drawPanel(cx - 640, 160, 1280, 760);
    }

    this.add.text(cx, this.panelY(262), 'Vytvoření postavy', {
      fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#ffe7ae',
      stroke: '#1a0f04', strokeThickness: 5
    }).setOrigin(0.5).setResolution(2);

    this.createNameInput();

    this.choices = {
      male: this.createChoice('male', cx - 270, 'Muž'),
      female: this.createChoice('female', cx + 270, 'Žena')
    };

    this.createConfirm(cx, 978);

    this.status = this.add.text(cx, 1058, '', {
      fontFamily: FONT, fontSize: '24px', color: '#dceaff'
    }).setOrigin(0.5).setResolution(2);

    // Zpět do menu.
    const back = this.add.text(70, 50, '‹ Zpět do menu', {
      fontFamily: FONT, fontSize: '26px', color: '#f2d28a',
      stroke: '#05080c', strokeThickness: 4
    }).setResolution(2).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setColor('#fff1c6'));
    back.on('pointerout', () => back.setColor('#f2d28a'));
    back.on('pointerdown', () => this.scene.start('Menu'));

    // Testovací hra se spouští jménem „admin91“ (bez tlačítka) – viz confirm().

    // Pojistka: posluchač z předchozího otevření scény nesmí zůstat zapnutý
    // (jinak se znaky zapisují dvakrát).
    if (this.onKey) this.input.keyboard.off('keydown', this.onKey);
    this.onKey = (event) => this.handleKey(event);
    this.input.keyboard.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));

    this.render();
    this.cameras.main.fadeIn(300, 5, 11, 20);
  }

  // Výřezy z prototypu mají na okrajích kousky sousedních obrázků ze spritesheetu.
  // Necháme jen největší souvislý obrázek (+ jeho záři) a zbytek zprůhledníme.
  prepareSprites() {
    for (const name of SPRITES) {
      if (this.textures.exists(key(name))) continue;
      const rawKey = `${key(name)}-raw`;
      if (!this.textures.exists(rawKey)) continue;

      const source = this.textures.get(rawKey).getSourceImage();
      // Tlačítko Potvrdit má jen úzkou záři; avatary a symboly širší.
      const glow = name.startsWith('confirm') ? 10 : 18;
      this.textures.addCanvas(key(name), cleanCut(source, glow));
      this.textures.remove(rawKey);
    }
  }

  drawPanel(x, y, w, h) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.45).fillRoundedRect(x + 8, y + 14, w, h, 24);
    g.fillGradientStyle(0x1b3350, 0x1b3350, 0x0a1627, 0x0a1627, 1).fillRoundedRect(x, y, w, h, 24);
    g.lineStyle(6, 0xbd914c, 1).strokeRoundedRect(x, y, w, h, 24);
    g.lineStyle(2, 0xffe3a0, 0.45).strokeRoundedRect(x + 10, y + 10, w - 20, h - 20, 18);
  }

  // Vlastní textové pole (Phaser nemá nativní input): psaní z klávesnice,
  // Backspace maže, Enter potvrdí, blikající kurzor.
  panelX(x) { return PANEL.x + x * PANEL.scale; }
  panelY(y) { return PANEL.y + y * PANEL.scale; }

  createNameInput() {
    const x = this.panelX(NAME_BOX.x);
    const y = this.panelY(NAME_BOX.y);
    const w = NAME_BOX.w * PANEL.scale;
    const h = NAME_BOX.h * PANEL.scale;
    const cx = x + w / 2;
    const cy = y + h / 2;
    this.inputBox = { x, y, w, h };

    if (!this.textures.exists(PANEL_KEY)) {
      this.add.graphics().fillStyle(0x07182c, 1).fillRoundedRect(x, y, w, h, 10)
        .lineStyle(3, 0xb98d4b, 1).strokeRoundedRect(x, y, w, h, 10);
    }

    this.nameText = this.add.text(cx, cy, '', {
      fontFamily: FONT, fontSize: '36px', color: '#f9e6b8'
    }).setOrigin(0.5).setResolution(2);

    this.caret = this.add.rectangle(cx, cy, 3, 40, 0xf9e6b8).setOrigin(0, 0.5);
    this.tweens.add({ targets: this.caret, alpha: 0, duration: 520, yoyo: true, repeat: -1 });

    this.add.text(cx, y + h + 18, `Nejvýše ${MAX_NAME_LENGTH} znaků · Enter potvrdí`, {
      fontFamily: FONT, fontSize: '17px', color: '#9fb3c4'
    }).setOrigin(0.5).setResolution(2);
  }

  createChoice(gender, x, label) {
    const avatar = this.add.image(x, 765, key(`${gender}_inactive`)).setOrigin(0.5, 1);
    const button = this.add.image(x, 820, key(`${gender}_button_inactive`)).setOrigin(0.5);
    // Kliknutelná plocha přes avatar i tlačítko.
    const zone = this.add.zone(x, 670, 420, 420).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      this.gender = gender;
      this.render();
    });
    zone.on('pointerover', () => { choice.hover = true; this.render(); });
    zone.on('pointerout', () => { choice.hover = false; this.render(); });

    const choice = { avatar, button, hover: false };
    return choice;
  }

  createConfirm(cx, y) {
    this.confirmButton = this.add.image(cx, y, key('confirm_normal')).setInteractive({ useHandCursor: true });
    this.confirmHover = false;
    this.confirmButton.on('pointerover', () => { this.confirmHover = true; this.render(); });
    this.confirmButton.on('pointerout', () => { this.confirmHover = false; this.render(); });
    this.confirmButton.on('pointerdown', () => this.confirm());
  }

  // Obrázky stavů mají různé rozměry – zobrazujeme je v pevné velikosti.
  fit(image, textureKey, maxW, maxH) {
    image.setTexture(textureKey);
    const scale = Math.min(maxW / image.width, maxH / image.height);
    image.setScale(scale);
  }

  render() {
    for (const [gender, choice] of Object.entries(this.choices)) {
      const active = gender === this.gender;
      const lift = choice.hover && !active ? 1.03 : 1;
      this.fit(choice.avatar, key(`${gender}_${active ? 'selected' : 'inactive'}`), 260 * lift, 250 * lift);
      this.fit(choice.button, key(`${gender}_button_${active ? 'active' : 'inactive'}`), 200 * lift, 84 * lift);
    }

    this.fit(this.confirmButton, key(this.confirmHover ? 'confirm_hover' : 'confirm_normal'), 400, 120);

    const shown = this.nameBuffer;
    this.nameText.setText(shown || 'Zadej jméno').setColor(shown ? '#f9e6b8' : '#6f7f92');
    this.caret.setX(shown ? this.nameText.x + this.nameText.width / 2 + 4 : this.inputBox.x + 24);
  }

  handleKey(event) {
    if (this.confirmed) return;

    if (event.key === 'Escape') {
      this.scene.start('Menu');
      return;
    }
    if (event.key === 'Enter') {
      this.confirm();
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      this.gender = event.key === 'ArrowLeft' ? 'male' : 'female';
      this.render();
      return;
    }
    if (event.key === 'Backspace') {
      this.nameBuffer = Array.from(this.nameBuffer).slice(0, -1).join('');
      this.render();
      return;
    }
    if (event.key && Array.from(event.key).length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (Array.from(this.nameBuffer).length < MAX_NAME_LENGTH) {
        this.nameBuffer += event.key;
        this.status.setText('');
        this.render();
      }
    }
  }

  confirm() {
    if (this.confirmed) return;

    const name = Array.from(this.nameBuffer.normalize('NFC').trim()).slice(0, MAX_NAME_LENGTH).join('');
    // Jméno admin91 = testovací hra (hrdina 100, všechna kouzla, suroviny, vlk 100 s 510 body).
    const testGame = name.toLowerCase() === TEST_GAME_NAME;
    if (!name) {
      this.status.setText('Nejdříve zadej jméno.').setColor('#ffb3a0');
      this.tweens.add({ targets: this.nameText, x: this.nameText.x + 8, duration: 50, yoyo: true, repeat: 3 });
      return;
    }

    this.confirmed = true;
    const state = testGame ? createTestGame(name, this.gender) : SaveSystem.createNew(name);
    state.gender = this.gender;
    SaveSystem.save(state);

    this.status.setText(`${testGame ? 'Testovací hra: ' : ''}Postava ${name} (${this.gender === 'male' ? 'muž' : 'žena'}) je připravena.`).setColor('#dceaff');
    this.game.events.emit('dragonSouls:newGame', { name, gender: this.gender });

    this.cameras.main.fadeOut(450, 5, 11, 20);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (state.interiorId) this.scene.start('Interior', { state, interiorId: state.interiorId, fromWorld: false });
      else this.scene.start('World', { state });
    });
  }
}

// Čistý výřez: najde největší souvislý pevný tvar (alfa > 200) a ponechá jen
// pixely, které jsou od něj nejvýš `glow` px daleko (záře, vyhlazený okraj).
// Kousky sousedních obrázků ze spritesheetu tak zmizí, i když leží blízko.
// Výsledek se ořízne na velikost ponechaného obsahu.
function cleanCut(source, glow) {
  const width = source.width;
  const height = source.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const size = width * height;
  const label = new Int32Array(size);
  let best = null;
  let id = 0;

  for (let start = 0; start < size; start++) {
    if (label[start] || data[start * 4 + 3] <= 200) continue;
    id += 1;
    const pixels = [start];
    label[start] = id;
    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i];
      const x = p % width;
      for (const n of [p - 1, p + 1, p - width, p + width]) {
        if (n < 0 || n >= size || label[n]) continue;
        if ((n === p - 1 && x === 0) || (n === p + 1 && x === width - 1)) continue;
        if (data[n * 4 + 3] > 200) {
          label[n] = id;
          pixels.push(n);
        }
      }
    }
    if (!best || pixels.length > best.length) best = pixels;
  }
  if (!best) return canvas;

  // Vzdálenost od hlavního tvaru (krokově, 8 směrů) jen přes nenulové pixely.
  const distance = new Int16Array(size).fill(-1);
  let frontier = best;
  for (const p of frontier) distance[p] = 0;
  for (let d = 1; d <= glow; d++) {
    const next = [];
    for (const p of frontier) {
      const x = p % width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const n = p + dy * width + dx;
          if (n < 0 || n >= size || distance[n] !== -1 || data[n * 4 + 3] === 0) continue;
          distance[n] = d;
          next.push(n);
        }
      }
    }
    frontier = next;
  }

  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let p = 0; p < size; p++) {
    if (distance[p] === -1) {
      data[p * 4 + 3] = 0;
      continue;
    }
    const x = p % width;
    const y = (p - x) / width;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  ctx.putImageData(image, 0, 0);

  const trimmed = document.createElement('canvas');
  trimmed.width = right - left + 1;
  trimmed.height = bottom - top + 1;
  trimmed.getContext('2d').drawImage(canvas, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  return trimmed;
}
