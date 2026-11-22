import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { ITEM_CATEGORIES, getItem } from '../data/items.js';
import {
  INVENTORY_PAGE_SIZE,
  INVENTORY_PAGES,
  normalizeInventory,
  moveSlot,
  splitSlot,
  dropSlot,
  useSlot,
  equipSlot,
  canUse,
  canEquip,
  INVENTORY_CHANGED
} from '../systems/InventorySystem.js';
import { EQUIPMENT_SLOT_IDS, RARITIES, normalizeEquipment } from '../systems/EquipmentSystem.js';
import { cardText, cardButton, openCardModal } from '../ui/fantasyCard.js';
import { createCardTabBar } from '../ui/cardTabBar.js';
import { closeStateKey } from '../ui/heroCard/tabSprites.js';
import {
  INVENTORY_CARD,
  MENU_BOX,
  MENU_ROWS,
  MENU_ROW_X,
  MENU_ACTIONS,
  MENU_KEY,
  menuRowKey,
  equipKey,
  slotKey,
  categoryKey,
  arrowKey,
  itemIconKey
} from '../ui/inventorySprites.js';

// Karta Inventář (klávesa I nebo záložka Inventář). Podklad inventory.png, stavy z hoover-icon.png
// (tmavá = výchozí, modrá = pod myší). Levé tlačítko vybere předmět (detail vlevo dole),
// pravé otevře nabídku Použít / Vybavit / Přesunout / Rozdělit / Zahodit.

const CARD_W = 1536;
const CARD_H = 1024;
const SCALE = Math.min(GAME_WIDTH / CARD_W, GAME_HEIGHT / CARD_H);
const OFFSET_X = (GAME_WIDTH - CARD_W * SCALE) / 2;
const OFFSET_Y = (GAME_HEIGHT - CARD_H * SCALE) / 2;
const CLOSE_AREA = { x: 628, y: 914, w: 275, h: 78 };
const CLOSE_IMAGE_WIDTH = 310;

// Rozložení podkladu (souřadnice obrázku 1536 × 1024).
const GRID = { cols: [674, 775, 875, 974, 1073, 1173, 1274, 1374], rows: [143, 246, 349, 452, 556], w: 93, h: 96 };
const EQUIP_SLOTS = {
  weapon: { x: 84, y: 170, w: 101, h: 81 },
  shield: { x: 84, y: 264, w: 101, h: 82 },
  ring: { x: 84, y: 357, w: 101, h: 82 },
  amulet: { x: 84, y: 451, w: 101, h: 82 },
  helmet: { x: 504, y: 170, w: 101, h: 81 },
  armor: { x: 504, y: 264, w: 101, h: 82 },
  legs: { x: 504, y: 357, w: 101, h: 82 },
  boots: { x: 504, y: 451, w: 101, h: 82 }
};
const CATEGORY_RECTS = [939, 1028, 1118, 1207, 1296, 1385].map((x) => ({ x, y: 678, w: 83, h: 89 }));
const ARROW_RECTS = { left: { x: 677, y: 688, w: 38, h: 66 }, right: { x: 868, y: 688, w: 38, h: 66 } };
const PAGE_TEXT = { x: 791, y: 721, plate: { x: 728, y: 696, w: 128, h: 50 } };
const GOLD_TEXT = { x: 790, y: 817 };
const INFO = { x: 57, y: 637, w: 569, h: 241 };
const MENU_SCALE = 0.32;

const toScreen = (x, y) => ({ x: OFFSET_X + x * SCALE, y: OFFSET_Y + y * SCALE });
const toCard = (sx, sy) => ({ x: (sx - OFFSET_X) / SCALE, y: (sy - OFFSET_Y) / SCALE });

export default class InventoryScene extends Phaser.Scene {
  constructor() {
    super('Inventory');
  }

  create(data) {
    this.state = data?.state ?? SaveSystem.load();
    this.returnScene = data?.returnScene ?? 'World';
    this.storageAccess = Boolean(data?.storageAccess);
    this.closing = false;
    this.modal = null;
    this.menu = null;
    this.moving = null;
    this.selected = null;
    this.filter = null;
    this.page = 0;

    if (!this.state) {
      this.scene.start('Menu');
      return;
    }
    normalizeInventory(this.state);
    normalizeEquipment(this.state);
    this.input.mouse?.disableContextMenu();

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x02060c, 0.78).setOrigin(0).setInteractive()
      .on('pointerdown', () => this.closeMenu());
    this.card = this.add.container(OFFSET_X, OFFSET_Y).setScale(SCALE);
    this.card.add(this.add.image(0, 0, INVENTORY_CARD).setOrigin(0));
    // Klik na podklad karty zavře nabídku.
    this.card.add(this.add.zone(0, 0, CARD_W, CARD_H).setOrigin(0).setInteractive().on('pointerdown', () => this.closeMenu()));

    // Namalované „1/1“ překryje vlastní číslo stránky.
    const plate = this.add.graphics();
    const p = PAGE_TEXT.plate;
    plate.fillStyle(0x0a1628, 1).fillRect(p.x, p.y, p.w, p.h);
    this.card.add(plate);

    this.layer = this.add.container(0, 0);
    this.card.add(this.layer);

    this.createStatic();
    this.createCloseButton();
    createCardTabBar(this, 'inventory', {
      state: this.state,
      returnScene: this.returnScene,
      storageAccess: this.storageAccess,
      drawStrip: false,
      beforeLeave: () => SaveSystem.save(this.state)
    });
    this.render();

    if (this.onKey) this.input.keyboard.off('keydown', this.onKey);
    this.onKey = (event) => {
      if (event.repeat) return;
      if (event.code === 'Escape') {
        if (this.modal) this.closeModal();
        else if (this.menu) this.closeMenu();
        else if (this.moving !== null) { this.moving = null; this.render(); this.flash('Přesun zrušen.', '#c9d3dd'); }
        else this.closeCard();
      } else if (event.code === 'KeyI' && !this.modal) {
        this.closeCard();
      }
    };
    this.input.keyboard.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));
  }

  // ---------------------------------------------------------- pevné prvky

  createStatic() {
    // Výbava: modrý obrázek pod myší, detail vlevo dole.
    EQUIPMENT_SLOT_IDS.forEach((slot) => {
      const r = EQUIP_SLOTS[slot];
      const image = this.textures.exists(equipKey(slot, 'hover'))
        ? this.add.image(r.x + r.w / 2, r.y + r.h / 2, equipKey(slot, 'hover')).setDisplaySize(r.w + 6, r.h + 6).setVisible(false)
        : null;
      if (image) this.card.add(image);
      const zone = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => { image?.setVisible(true); this.showEquipInfo(slot); });
      zone.on('pointerout', () => { image?.setVisible(false); this.renderInfo(); });
      this.card.add(zone);
    });

    // Filtry kategorií: modrá pod myší, zapnutý filtr zůstane modrý.
    this.categoryImages = ITEM_CATEGORIES.map((category, i) => {
      const r = CATEGORY_RECTS[i];
      const image = this.textures.exists(categoryKey(category.id, 'hover'))
        ? this.add.image(r.x + r.w / 2, r.y + r.h / 2, categoryKey(category.id, 'hover')).setDisplaySize(r.w + 4, r.h + 4).setVisible(false)
        : null;
      if (image) this.card.add(image);
      const zone = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => image?.setVisible(true));
      zone.on('pointerout', () => image?.setVisible(this.filter === category.id));
      zone.on('pointerdown', () => {
        this.closeMenu();
        this.filter = this.filter === category.id ? null : category.id;
        this.page = 0;
        this.moving = null;
        this.render();
        this.flash(this.filter ? `Filtr: ${category.label}` : 'Filtr vypnut – všechny předměty.', '#8fd3ff');
      });
      this.card.add(zone);
      return image;
    });

    // Šipky stránek.
    this.arrowImages = {};
    for (const dir of ['left', 'right']) {
      const r = ARROW_RECTS[dir];
      const image = this.textures.exists(arrowKey(dir, 'hover'))
        ? this.add.image(r.x + r.w / 2, r.y + r.h / 2, arrowKey(dir, 'hover')).setDisplaySize(r.w, r.h).setVisible(false)
        : null;
      if (image) this.card.add(image);
      const zone = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => image?.setVisible(true));
      zone.on('pointerout', () => image?.setVisible(false));
      zone.on('pointerdown', () => this.turnPage(dir === 'left' ? -1 : 1));
      this.card.add(zone);
    }

    this.pageText = cardText(this, PAGE_TEXT.x, PAGE_TEXT.y, '', { size: 36, bold: true, color: '#f3e4bd', originX: 0.5, originY: 0.5, strokeThickness: 5 });
    this.goldText = cardText(this, GOLD_TEXT.x, GOLD_TEXT.y, '', { size: 32, bold: true, color: '#ffd76a', originY: 0.5, strokeThickness: 5 });
    this.card.add([this.pageText, this.goldText]);

    this.info = this.add.container(0, 0);
    this.card.add(this.info);
  }

  // ---------------------------------------------------------------- mřížka

  // Políčka zobrazená na stránce: skutečné indexy (s filtrem jen odpovídající předměty).
  visibleIndices() {
    const slots = this.state.inventory.slots;
    const all = slots.map((_, i) => i);
    const list = this.filter ? all.filter((i) => getItem(slots[i]?.id)?.category === this.filter) : all;
    return list.slice(this.page * INVENTORY_PAGE_SIZE, (this.page + 1) * INVENTORY_PAGE_SIZE);
  }

  pageCount() {
    if (!this.filter) return INVENTORY_PAGES;
    const count = this.state.inventory.slots.filter((s) => getItem(s?.id)?.category === this.filter).length;
    return Math.max(1, Math.ceil(count / INVENTORY_PAGE_SIZE));
  }

  turnPage(step) {
    this.closeMenu();
    const pages = this.pageCount();
    const next = Phaser.Math.Clamp(this.page + step, 0, pages - 1);
    if (next === this.page) {
      this.flash(pages === 1 ? 'Inventář má zatím jednu stránku.' : 'Další stránka už není.', '#c9d3dd');
      return;
    }
    this.page = next;
    this.render();
  }

  render() {
    this.layer.removeAll(true);
    const slots = this.state.inventory.slots;
    const visible = this.visibleIndices();

    for (let k = 0; k < INVENTORY_PAGE_SIZE; k++) {
      const col = k % GRID.cols.length;
      const row = Math.floor(k / GRID.cols.length);
      const rect = { x: GRID.cols[col], y: GRID.rows[row], w: GRID.w, h: GRID.h };
      const index = visible[k];
      const slot = index === undefined ? null : slots[index];
      this.renderSlot(rect, index, slot);
    }

    this.categoryImages.forEach((image, i) => image?.setVisible(this.filter === ITEM_CATEGORIES[i].id));
    this.pageText.setText(`${this.page + 1}/${this.pageCount()}`);
    this.goldText.setText(String(Math.max(0, Number(this.state.gold) || 0)));
    this.renderInfo();
  }

  renderSlot(rect, index, slot) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const hover = this.textures.exists(slotKey('hover'))
      ? this.add.image(cx, cy, slotKey('hover')).setDisplaySize(rect.w + 8, rect.h + 8).setVisible(false)
      : null;
    if (hover) this.layer.add(hover);

    const g = this.add.graphics();
    this.layer.add(g);
    if (index !== undefined && index === this.selected) {
      g.lineStyle(4, 0xffd76a, 1).strokeRoundedRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, 8);
    }
    if (index !== undefined && index === this.moving) {
      g.lineStyle(4, 0x6fc8ff, 1).strokeRoundedRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, 8);
    }

    const item = getItem(slot?.id);
    if (item) {
      if (item.icon && this.textures.exists(itemIconKey(item.icon))) {
        const icon = this.add.image(cx, cy - 2, itemIconKey(item.icon));
        const fit = 70 / Math.max(icon.width, icon.height);
        icon.setScale(fit);
        this.layer.add(icon);
      } else {
        this.layer.add(cardText(this, cx, cy, item.name.slice(0, 2), { size: 24, originX: 0.5, originY: 0.5 }));
      }
      if (slot.qty > 1) {
        this.layer.add(cardText(this, rect.x + rect.w - 8, rect.y + rect.h - 6, String(slot.qty), {
          size: 20, bold: true, color: '#ffffff', originX: 1, originY: 1, strokeThickness: 4
        }));
      }
    }

    if (index === undefined) return;
    const zone = this.add.zone(rect.x, rect.y, rect.w, rect.h).setOrigin(0).setInteractive({ useHandCursor: Boolean(item) || this.moving !== null });
    zone.on('pointerover', () => hover?.setVisible(true));
    zone.on('pointerout', () => hover?.setVisible(false));
    zone.on('pointerdown', (pointer) => {
      if (this.modal) return;
      if (pointer.rightButtonDown()) {
        if (item) this.openMenu(index, pointer);
        return;
      }
      this.closeMenu();
      if (this.moving !== null) {
        const result = moveSlot(this.state, this.moving, index);
        this.moving = null;
        this.selected = index;
        if (result.ok) { this.changed(); this.flash('Předmět přesunut.', '#8fd3ff'); } else this.flash(result.reason);
        this.render();
        return;
      }
      this.selected = item ? index : null;
      this.render();
    });
    this.layer.add(zone);
  }

  // ------------------------------------------------------------ detail

  clearInfo() {
    this.info.removeAll(true);
  }

  renderInfo() {
    this.clearInfo();
    const slot = this.selected !== null ? this.state.inventory.slots[this.selected] : null;
    const item = getItem(slot?.id);
    const mana = `Mana ${this.state.mp ?? 0} / ${this.state.maxMp ?? 0}`;
    if (!item) {
      this.info.add(cardText(this, INFO.x + 30, INFO.y + 28, 'Vyber předmět', { size: 26, bold: true, color: '#ffe7ae' }));
      this.info.add(cardText(this, INFO.x + 30, INFO.y + 72,
        this.moving !== null ? 'Klikni na políčko, kam se má předmět přesunout (Esc zruší).' : 'Levé tlačítko = detail předmětu, pravé tlačítko = nabídka (Použít, Vybavit, Přesunout, Rozdělit, Zahodit).',
        { size: 17, color: '#c9d3dd', wrap: INFO.w - 60 }));
      this.info.add(cardText(this, INFO.x + 30, INFO.y + INFO.h - 30, mana, { size: 18, color: '#8fd3ff', originY: 1 }));
      return;
    }
    this.describe(item, slot.qty, mana);
  }

  describe(item, qty, footer) {
    const rarity = RARITIES[item.rarity] ?? RARITIES.common;
    if (item.icon && this.textures.exists(itemIconKey(item.icon))) {
      const icon = this.add.image(INFO.x + 80, INFO.y + 90, itemIconKey(item.icon));
      icon.setScale(110 / Math.max(icon.width, icon.height));
      this.info.add(icon);
    }
    const category = ITEM_CATEGORIES.find((c) => c.id === item.category)?.label ?? '';
    this.info.add(cardText(this, INFO.x + 150, INFO.y + 26, item.name, { size: 26, bold: true, color: rarity.css }));
    this.info.add(cardText(this, INFO.x + 150, INFO.y + 62, `${rarity.label} · ${category}${qty ? ` · ${qty} ks` : ''}`, { size: 16, color: '#c9b98f' }));
    this.info.add(cardText(this, INFO.x + 150, INFO.y + 92, item.description ?? '', { size: 16, color: '#e8eef5', wrap: INFO.w - 180 }));
    if (footer) this.info.add(cardText(this, INFO.x + 30, INFO.y + INFO.h - 30, footer, { size: 18, color: '#8fd3ff', originY: 1 }));
  }

  showEquipInfo(slot) {
    if (this.menu) return;
    this.clearInfo();
    const labels = { weapon: 'Zbraň', shield: 'Štít', ring: 'Prsten', amulet: 'Amulet', helmet: 'Helma', armor: 'Zbroj', legs: 'Nohy', boots: 'Boty' };
    const equipped = this.state.equipment?.[slot];
    if (equipped) {
      this.describe({ ...getItem(equipped.id), ...equipped }, 0, `Vybaveno: ${labels[slot]}`);
    } else {
      this.info.add(cardText(this, INFO.x + 30, INFO.y + 28, labels[slot], { size: 26, bold: true, color: '#ffe7ae' }));
      this.info.add(cardText(this, INFO.x + 30, INFO.y + 72, 'Prázdný slot. Předmět vybavíš pravým tlačítkem v inventáři (Vybavit).', { size: 17, color: '#c9d3dd', wrap: INFO.w - 60 }));
    }
  }

  // ------------------------------------------------------------ nabídka

  openMenu(index, pointer) {
    this.closeMenu();
    this.selected = index;
    this.render();
    const slot = this.state.inventory.slots[index];
    const item = getItem(slot.id);
    const enabled = {
      use: canUse(item),
      equip: canEquip(item),
      move: !this.filter,
      split: slot.qty > 1,
      drop: true
    };

    const w = MENU_BOX.w * MENU_SCALE;
    const h = MENU_BOX.h * MENU_SCALE;
    const at = toCard(pointer.x, pointer.y);
    const x = Phaser.Math.Clamp(at.x + 6, 20, CARD_W - w - 20);
    const y = Phaser.Math.Clamp(at.y - 30, 90, CARD_H - h - 20);

    const menu = this.add.container(x, y);
    this.card.add(menu);
    menu.add(this.add.image(0, 0, MENU_KEY).setOrigin(0).setScale(MENU_SCALE));

    MENU_ROWS.forEach(([y0, y1], i) => {
      const action = MENU_ACTIONS[i];
      const rx = (MENU_ROW_X[0] - MENU_BOX.x) * MENU_SCALE;
      const ry = (y0 - MENU_BOX.y) * MENU_SCALE;
      const rw = (MENU_ROW_X[1] - MENU_ROW_X[0]) * MENU_SCALE;
      const rh = (y1 - y0) * MENU_SCALE;
      const hover = this.add.image(rx, ry, menuRowKey(i)).setOrigin(0).setScale(MENU_SCALE).setVisible(false);
      menu.add(hover);
      if (!enabled[action]) {
        const shade = this.add.graphics();
        shade.fillStyle(0x05080c, 0.62).fillRect(rx + 4, ry + 3, rw - 8, rh - 6);
        menu.add(shade);
      }
      const zone = this.add.zone(rx, ry, rw, rh).setOrigin(0).setInteractive({ useHandCursor: enabled[action] });
      zone.on('pointerover', () => hover.setVisible(enabled[action]));
      zone.on('pointerout', () => hover.setVisible(false));
      zone.on('pointerdown', (p) => {
        p.event?.stopPropagation?.();
        if (!enabled[action]) {
          this.flash({ use: 'Tento předmět nejde použít.', equip: 'Tento předmět nejde vybavit.', move: 'Při zapnutém filtru nejde přesouvat.', split: 'Hromádku s jedním kusem nejde rozdělit.' }[action] ?? '');
          return;
        }
        this.closeMenu();
        this.runAction(action, index);
      });
      menu.add(zone);
    });
    this.menu = menu;
  }

  closeMenu() {
    this.menu?.destroy();
    this.menu = null;
  }

  runAction(action, index) {
    const slot = this.state.inventory.slots[index];
    const item = getItem(slot?.id);
    if (!item) return;

    if (action === 'use') {
      const result = useSlot(this.state, index);
      if (result.ok) this.changed();
      if (!this.state.inventory.slots[index]) this.selected = null;
      this.render();
      this.flash(result.message, result.ok ? '#8fd3ff' : '#ffb3a0');
    } else if (action === 'equip') {
      const result = equipSlot(this.state, index, this.game.events);
      if (result.ok) this.changed();
      this.render();
      this.flash(result.message, result.ok ? '#ffd76a' : '#ffb3a0');
    } else if (action === 'move') {
      this.moving = index;
      this.render();
      this.flash('Klikni na políčko, kam se má předmět přesunout.', '#8fd3ff');
    } else if (action === 'split') {
      this.openSplit(index);
    } else if (action === 'drop') {
      this.modal = openCardModal(this, `Zahodit ${item.name}?`, [`Zahodí se celá hromádka (${slot.qty} ks). Tuto akci nejde vrátit.`], [
        { label: 'Zahodit', danger: true, onClick: () => {
          this.closeModal();
          dropSlot(this.state, index);
          this.selected = null;
          this.changed();
          this.render();
          this.flash(`${item.name} zahozeno.`, '#ffd76a');
        } },
        { label: 'Zpět', onClick: () => this.closeModal() }
      ]);
    }
  }

  // Rozdělení: výběr počtu kusů do nové hromádky.
  openSplit(index) {
    const slot = this.state.inventory.slots[index];
    const item = getItem(slot.id);
    let amount = Math.floor(slot.qty / 2);
    const w = 640;
    const h = 330;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    const c = this.add.container(0, 0).setDepth(200);
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    g.fillStyle(0x0d1d33, 0.98).fillRoundedRect(x, y, w, h, 18);
    g.lineStyle(4, 0xd6a23a, 1).strokeRoundedRect(x, y, w, h, 18);
    c.add([shade, g]);
    c.add(cardText(this, x + w / 2, y + 26, `Rozdělit: ${item.name}`, { size: 28, bold: true, color: '#ffe7ae', originX: 0.5 }));
    c.add(cardText(this, x + w / 2, y + 72, `Kolik kusů oddělit do nového políčka? (celkem ${slot.qty})`, { size: 17, color: '#dbe6f3', originX: 0.5 }));
    const value = cardText(this, x + w / 2, y + 140, '', { size: 44, bold: true, color: '#ffd76a', originX: 0.5, originY: 0.5, strokeThickness: 5 });
    c.add(value);
    const refresh = () => value.setText(`${amount}  |  ${slot.qty - amount}`);
    refresh();
    const change = (d) => { amount = Phaser.Math.Clamp(amount + d, 1, slot.qty - 1); refresh(); };
    [[-10, '−10'], [-1, '−1'], [1, '+1'], [10, '+10']].forEach(([d, label], i) => {
      cardButton(this, c, x + 70 + i * 128, y + 190, 112, 46, label, () => change(d), { size: 20 });
    });
    cardButton(this, c, x + w / 2 - 236, y + h - 70, 220, 50, 'Rozdělit', () => {
      const result = splitSlot(this.state, index, amount);
      this.closeModal();
      if (!result.ok) { this.flash(result.reason); return; }
      this.selected = result.index;
      this.changed();
      this.render();
      this.flash(`Rozděleno: ${amount} ks do nového políčka.`, '#8fd3ff');
    });
    cardButton(this, c, x + w / 2 + 16, y + h - 70, 220, 50, 'Zpět', () => this.closeModal());
    this.modal = c;
  }

  closeModal() {
    this.modal?.destroy();
    this.modal = null;
  }

  // -------------------------------------------------------------- ostatní

  changed() {
    SaveSystem.save(this.state);
    this.game.events.emit(INVENTORY_CHANGED, { state: this.state });
  }

  // Hláška vlevo dole na kartě (nad krajinou, vedle tlačítka Zavřít).
  flash(message, color = '#ffb3a0') {
    if (!message) return;
    this.flashText?.destroy();
    const at = toScreen(60, 905);
    this.flashText = cardText(this, at.x, at.y, message, { size: 22, bold: true, color, strokeThickness: 5, wrap: 560 }).setDepth(160);
    this.tweens.add({ targets: this.flashText, alpha: 0, delay: 2600, duration: 500 });
  }

  createCloseButton() {
    const zone = this.add.zone(CLOSE_AREA.x, CLOSE_AREA.y, CLOSE_AREA.w, CLOSE_AREA.h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.closeCard());
    if (this.textures.exists(closeStateKey('normal'))) {
      const image = this.add.image(CLOSE_AREA.x + CLOSE_AREA.w / 2, CLOSE_AREA.y + CLOSE_AREA.h / 2, closeStateKey('normal'));
      const show = (state) => { image.setTexture(closeStateKey(state)); image.setScale(CLOSE_IMAGE_WIDTH / image.width); };
      show('normal');
      this.card.add(image);
      zone.on('pointerover', () => show('hover'));
      zone.on('pointerout', () => show('normal'));
      zone.on('pointerdown', () => show('active'));
    }
    this.card.add(zone);
  }

  closeCard() {
    if (this.closing) return;
    this.closing = true;
    SaveSystem.save(this.state);
    this.scene.stop();
    this.scene.resume(this.returnScene);
  }
}
