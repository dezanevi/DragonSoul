import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';

// Vytvoření postavy po kliknutí na „Nová hra“: jméno a volba muž / žena.
// Grafika z prototypu Dragon_Souls_Character_Select_Assets
// (public/assets/ui/character-select/). Neaktivní avatar je šedý,
// aktivní svítí; tlačítko Potvrdit má stav pod myší.

const ASSET_PATH = 'assets/ui/character-select/';
const SPRITES = [
  'male_selected', 'male_inactive', 'male_button_active', 'male_button_inactive',
  'female_selected', 'female_inactive', 'female_button_active', 'female_button_inactive',
  'confirm_normal', 'confirm_hover'
];
const key = (name) => `charsel-${name}`;
const MAX_NAME_LENGTH = 20;
const FONT = 'Georgia, "Times New Roman", serif';

export default class CharacterCreateScene extends Phaser.Scene {
  constructor() {
    super('CharacterCreate');
  }

  preload() {
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

    this.drawPanel(cx - 560, 40, 1120, 1000);

    this.add.text(cx, 115, 'Vytvoření postavy', {
      fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#ffe7ae',
      stroke: '#1a0f04', strokeThickness: 6
    }).setOrigin(0.5).setResolution(2);

    this.createNameInput(cx, 185);

    this.choices = {
      male: this.createChoice('male', cx - 230, 'Muž'),
      female: this.createChoice('female', cx + 230, 'Žena')
    };

    this.createConfirm(cx, 935);

    this.status = this.add.text(cx, 1008, '', {
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
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(source, 0, 0);
      // Nad tlačítkem Potvrdit jsou zbytky sousedů těsně u okraje → nahoře ořez natěsno.
      keepMainShape(ctx, canvas.width, canvas.height, name.startsWith('confirm') ? 6 : 18);
      this.textures.addCanvas(key(name), canvas);
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
  createNameInput(cx, y) {
    this.add.text(cx, y, 'Jméno', {
      fontFamily: FONT, fontSize: '28px', color: '#ffe7ae'
    }).setOrigin(0.5).setResolution(2);

    const w = 520;
    const h = 72;
    const g = this.add.graphics();
    g.fillStyle(0x07182c, 1).fillRoundedRect(cx - w / 2, y + 30, w, h, 10);
    g.lineStyle(3, 0xb98d4b, 1).strokeRoundedRect(cx - w / 2, y + 30, w, h, 10);
    this.inputBox = { g, x: cx - w / 2, y: y + 30, w, h };

    this.nameText = this.add.text(cx, y + 30 + h / 2, '', {
      fontFamily: FONT, fontSize: '34px', color: '#f9e6b8'
    }).setOrigin(0.5).setResolution(2);

    this.caret = this.add.rectangle(cx, y + 30 + h / 2, 3, 38, 0xf9e6b8).setOrigin(0, 0.5);
    this.tweens.add({ targets: this.caret, alpha: 0, duration: 520, yoyo: true, repeat: -1 });

    this.add.text(cx, y + 30 + h + 22, `Nejvýše ${MAX_NAME_LENGTH} znaků · Enter potvrdí`, {
      fontFamily: FONT, fontSize: '18px', color: '#9fb3c4'
    }).setOrigin(0.5).setResolution(2);
  }

  createChoice(gender, x, label) {
    const avatar = this.add.image(x, 700, key(`${gender}_inactive`)).setOrigin(0.5, 1);
    const button = this.add.image(x, 772, key(`${gender}_button_inactive`)).setOrigin(0.5);
    const caption = this.add.text(x, 836, label, {
      fontFamily: FONT, fontSize: '26px', color: '#c9b98f'
    }).setOrigin(0.5, 0).setResolution(2);

    // Kliknutelná plocha přes avatar i tlačítko.
    const zone = this.add.zone(x, 600, 400, 500).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      this.gender = gender;
      this.render();
    });
    zone.on('pointerover', () => { choice.hover = true; this.render(); });
    zone.on('pointerout', () => { choice.hover = false; this.render(); });

    const choice = { avatar, button, caption, hover: false };
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
      this.fit(choice.avatar, key(`${gender}_${active ? 'selected' : 'inactive'}`), 320 * lift, 330 * lift);
      this.fit(choice.button, key(`${gender}_button_${active ? 'active' : 'inactive'}`), 240 * lift, 112 * lift);
      choice.caption.setColor(active ? '#ffe7ae' : '#8f8a7a');
    }

    this.fit(this.confirmButton, key(this.confirmHover ? 'confirm_hover' : 'confirm_normal'), 420, 125);

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
    if (!name) {
      this.status.setText('Nejdříve zadej jméno.').setColor('#ffb3a0');
      this.tweens.add({ targets: this.nameText, x: this.nameText.x + 8, duration: 50, yoyo: true, repeat: 3 });
      return;
    }

    this.confirmed = true;
    const state = SaveSystem.createNew(name);
    state.gender = this.gender;
    SaveSystem.save(state);

    this.status.setText(`Postava ${name} (${this.gender === 'male' ? 'muž' : 'žena'}) je připravena.`).setColor('#dceaff');
    this.game.events.emit('dragonSouls:newGame', { name, gender: this.gender });

    this.cameras.main.fadeOut(450, 5, 11, 20);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Interior', { state, interiorId: state.interiorId, fromWorld: false });
    });
  }
}

// Ponechá jen největší souvislý pevný tvar (alfa > 200) a vše mimo jeho obdélník
// (rozšířený o okraj na záři, nahoře méně – tam bývají zbytky sousedů) zprůhlední.
function keepMainShape(ctx, width, height, topPad = 18) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const label = new Int32Array(width * height);
  let best = null;
  let id = 0;

  for (let start = 0; start < width * height; start++) {
    if (label[start] || data[start * 4 + 3] <= 200) continue;
    id += 1;
    const stack = [start];
    label[start] = id;
    let count = 0;
    let left = width, right = 0, top = height, bottom = 0;

    while (stack.length) {
      const p = stack.pop();
      count += 1;
      const x = p % width;
      const y = (p - x) / width;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      for (const n of [p - 1, p + 1, p - width, p + width]) {
        if (n < 0 || n >= width * height || label[n]) continue;
        if ((n === p - 1 && x === 0) || (n === p + 1 && x === width - 1)) continue;
        if (data[n * 4 + 3] > 200) {
          label[n] = id;
          stack.push(n);
        }
      }
    }

    if (!best || count > best.count) best = { count, left, right, top, bottom };
  }

  if (!best) return;
  const pad = 18;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= best.left - pad && x <= best.right + pad && y >= best.top - topPad && y <= best.bottom + pad;
      if (!inside) data[(y * width + x) * 4 + 3] = 0;
    }
  }
  ctx.putImageData(image, 0, 0);
}
