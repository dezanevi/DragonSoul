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
  splitToSlot,
  unequipToSlot,
  dropSlot,
  useSlot,
  equipSlot,
  canUse,
  canEquip,
  sortInventory,
  INVENTORY_CHANGED
} from '../systems/InventorySystem.js';
import { EQUIPMENT_SLOT_IDS, RARITIES, normalizeEquipment } from '../systems/EquipmentSystem.js';
import { cardText, cardButton, openCardModal, drawCardFrame, CARD_FIT } from '../ui/fantasyCard.js';
import { COOKING_BY_ID, hasLastingEffect } from '../data/cooking.js';
import { activeMeal } from '../systems/CookingSystem.js';
import { activeReinforcement } from '../systems/SmithingSystem.js';
import { createCardTabBar, slideCardIn, slideCardOut } from '../ui/cardTabBar.js';
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
// (tmavá = výchozí, modrá = pod myší). Levé tlačítko vybere předmět (detail vlevo dole), tažením
// se předmět přesune (se Shiftem rozdělí – okno pro počet kusů, na slot výbavy vybaví, ze slotu sundá),
// dvojklik vybaví / použije / sundá, pravé tlačítko otevře nabídku Použít / Vybavit / Přesunout / Rozdělit / Zahodit.

const CARD_W = 1536;
const CARD_H = 1024;
// Obsah karty zmenšený do panelu karty Mapa (ui/fantasyCard.js CARD_FIT).
const { SCALE, OFFSET_X, OFFSET_Y } = CARD_FIT;
const CLOSE_AREA = { x: 628, y: 914, w: 275, h: 78 };
const CLOSE_IMAGE_WIDTH = 310;
// Souřadnice podkladu (karta je na obrazovce zmenšená ~0,77×): 74 px → ~57 px na obrazovce.
const SORT_AREA = { x: 1187, y: 916, w: 280, h: 74 };

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

// Záře za ikonou podle vzácnosti (barvy z RARITIES): kruhový přechod, textura jednou za hru.
// Běžné předměty mají jen slabou šedou záři, ať vynikne vzácnost ostatních.
const GLOW_ALPHA = { common: 0.28, uncommon: 0.6, rare: 0.7, epic: 0.78, legendary: 0.9 };
function rarityGlowKey(scene, rarityId) {
  const id = RARITIES[rarityId] ? rarityId : 'common';
  const key = `inv-glow-${id}`;
  if (scene.textures.exists(key)) return key;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const legendary = id === 'legendary';
  // Legendární: syté zlato, silnější střed a zlatý prstenec, aby byly vidět na první pohled.
  const c = legendary ? 0xffc21a : RARITIES[id].color;
  const rgb = `${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}`;
  const a = GLOW_ALPHA[id];
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, legendary ? 'rgba(255, 236, 150, 1)' : `rgba(${rgb}, ${a})`);
  gradient.addColorStop(legendary ? 0.55 : 0.45, `rgba(${rgb}, ${legendary ? 0.85 : a * 0.6})`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  if (legendary) {
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255, 214, 90, 0.95)';
    ctx.shadowColor = 'rgba(255, 190, 40, 1)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  scene.textures.addCanvas(key, canvas);
  return key;
}

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

    // Bez ztmavení okolí; průhledná plocha chytá kliknutí mimo kartu (zavře nabídku).
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setOrigin(0).setInteractive()
      .on('pointerdown', () => this.closeMenu());
    drawCardFrame(this, undefined, { blocker: false });
    this.card = this.add.container(OFFSET_X, OFFSET_Y).setScale(SCALE);
    this.card.add(this.add.image(0, 0, INVENTORY_CARD).setOrigin(0));
    // Klik na podklad karty zavře nabídku.
    this.card.add(this.add.zone(0, 0, CARD_W, CARD_H).setOrigin(0).setInteractive().on('pointerdown', () => this.closeMenu()));

    // Namalované „1/1“ překryje vlastní číslo stránky.
    const plate = this.add.graphics();
    const p = PAGE_TEXT.plate;
    plate.fillStyle(0x0a1628, 1).fillRect(p.x, p.y, p.w, p.h);
    this.card.add(plate);

    this.equipLayer = this.add.container(0, 0);
    this.card.add(this.equipLayer);
    this.layer = this.add.container(0, 0);
    this.card.add(this.layer);

    // Tažení myší: přesun (se Shiftem rozdělení), dvojklik = použít / vybavit / sundat.
    this.press = null;
    this.drag = null;
    this.lastClick = null;
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false);
    const onMove = (pointer) => this.onPointerMove(pointer);
    const onUp = (pointer) => this.onPointerUp(pointer);
    this.input.on('pointermove', onMove);
    this.input.on('pointerup', onUp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointermove', onMove);
      this.input.off('pointerup', onUp);
      this.endDrag();
    });

    this.createStatic();
    this.createCloseButton();
    const tabBar = createCardTabBar(this, 'inventory', {
      onClose: () => this.closeCard(),
      state: this.state,
      returnScene: this.returnScene,
      storageAccess: this.storageAccess,
      beforeLeave: () => SaveSystem.save(this.state)
    });
    this.tabBar = tabBar;
    // Otevřeno ze světa / interiéru: karta vyjede zpod lišty.
    if (data?.animateIn) slideCardIn(this, { hide: tabBar.objects });
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
    // Bez filtru podle počtu políček (testovací hra má větší inventář).
    if (!this.filter) return Math.max(INVENTORY_PAGES, Math.ceil(this.state.inventory.slots.length / INVENTORY_PAGE_SIZE));
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

  // Sloty výbavy. Prázdný slot: namalovaná ikona, pod myší modrá verze z hoover-icon.png.
  // Vybavený slot: namalovanou ikonu překryje prázdné políčko s ikonou předmětu a pod myší
  // se ukáže modré prázdné políčko (ne namalovaná ikona) – ikona předmětu zůstane nahoře.
  renderEquipment() {
    this.equipLayer.removeAll(true);
    EQUIPMENT_SLOT_IDS.forEach((slot) => {
      const r = EQUIP_SLOTS[slot];
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const item = getItem(this.state.equipment?.[slot]?.id);
      const frame = (key) => (this.textures.exists(key) ? this.add.image(cx, cy, key).setDisplaySize(r.w + 6, r.h + 6) : null);
      let hover;
      if (item) {
        const base = frame(slotKey('normal'));
        if (base) this.equipLayer.add(base);
        hover = frame(slotKey('hover'));
      } else {
        hover = frame(equipKey(slot, 'hover'));
      }
      if (hover) this.equipLayer.add(hover.setVisible(false));
      if (item) this.equipLayer.add(this.add.image(cx, cy, rarityGlowKey(this, item.rarity)).setDisplaySize(r.w - 6, r.h - 6));
      if (item?.icon && this.textures.exists(itemIconKey(item.icon))) {
        const icon = this.add.image(cx, cy, itemIconKey(item.icon));
        icon.setScale(64 / Math.max(icon.width, icon.height));
        this.equipLayer.add(icon);
      }
      const zone = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => { hover?.setVisible(true); this.showEquipInfo(slot); });
      zone.on('pointerout', () => { hover?.setVisible(false); this.renderInfo(); });
      zone.on('pointerdown', (pointer) => {
        if (this.modal || pointer.rightButtonDown()) return;
        this.closeMenu();
        this.press = { type: 'equip', slot, x: pointer.x, y: pointer.y };
      });
      this.equipLayer.add(zone);
    });
  }

  render() {
    this.renderEquipment();
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
      this.layer.add(this.add.image(cx, cy - 2, rarityGlowKey(this, item.rarity)).setDisplaySize(rect.w - 6, rect.h - 6));
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
    // Náhled a popis předmětu už při najetí myší (vlevo dole); po odjetí zase vybraný předmět.
    zone.on('pointerover', () => {
      hover?.setVisible(true);
      if (item && !this.menu && !this.modal) {
        this.clearInfo();
        this.describe(item, slot.qty, `Mana ${this.state.mp ?? 0} / ${this.state.maxMp ?? 0}`);
      }
    });
    zone.on('pointerout', () => {
      hover?.setVisible(false);
      if (item && !this.menu && !this.modal) this.renderInfo();
    });
    zone.on('pointerdown', (pointer) => {
      if (this.modal) return;
      if (pointer.rightButtonDown()) {
        if (item) this.openMenu(index, pointer);
        return;
      }
      this.closeMenu();
      // Klik / tažení / dvojklik se vyhodnotí při puštění tlačítka (onPointerUp).
      this.press = { type: 'grid', index, x: pointer.x, y: pointer.y };
    });
    this.layer.add(zone);
  }

  clickGrid(index) {
    const slot = this.state.inventory.slots[index];
    const item = getItem(slot?.id);
    if (this.moving !== null) {
      const result = moveSlot(this.state, this.moving, index);
      this.moving = null;
      this.selected = index;
      if (result.ok) { this.changed(); this.flash('Předmět přesunut.', '#8fd3ff'); } else this.flash(result.reason);
      this.render();
      return;
    }
    // Dvojklik levým tlačítkem: vybavit (výbava) nebo použít (spotřební předmět).
    const now = this.time.now;
    const double = item && this.lastClick?.index === index && now - this.lastClick.time < 350;
    this.lastClick = double ? null : { index, time: now };
    if (double) {
      if (canEquip(item)) this.runAction('equip', index);
      else if (canUse(item)) this.runAction('use', index);
      else this.flash('Tento předmět nejde použít ani vybavit.');
      return;
    }
    this.selected = item ? index : null;
    this.render();
  }

  clickEquip(slot) {
    const now = this.time.now;
    const double = this.lastClick?.slot === slot && now - this.lastClick.time < 350;
    this.lastClick = double ? null : { slot, time: now };
    if (double && this.state.equipment?.[slot]) this.unequip(slot, null);
  }

  unequip(slot, toIndex) {
    const result = unequipToSlot(this.state, slot, toIndex, this.game.events);
    if (result.ok) { this.selected = result.index; this.changed(); }
    this.render();
    this.flash(result.message, result.ok ? '#ffd76a' : '#ffb3a0');
  }

  // Co je pod kurzorem: políčko inventáře nebo slot výbavy (souřadnice podkladu karty).
  hitTest(pointer) {
    const p = toCard(pointer.x, pointer.y);
    const inside = (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    for (const slot of EQUIPMENT_SLOT_IDS) if (inside(EQUIP_SLOTS[slot])) return { type: 'equip', slot };
    const visible = this.visibleIndices();
    for (let k = 0; k < INVENTORY_PAGE_SIZE; k++) {
      const r = { x: GRID.cols[k % GRID.cols.length], y: GRID.rows[Math.floor(k / GRID.cols.length)], w: GRID.w, h: GRID.h };
      if (inside(r)) return visible[k] === undefined ? null : { type: 'grid', index: visible[k] };
    }
    return null;
  }

  pressedItem(press) {
    if (press.type === 'grid') return getItem(this.state.inventory.slots[press.index]?.id);
    return getItem(this.state.equipment?.[press.slot]?.id);
  }

  onPointerMove(pointer) {
    if (!this.press || this.modal) return;
    if (!this.drag) {
      if (Phaser.Math.Distance.Between(pointer.x, pointer.y, this.press.x, this.press.y) < 10) return;
      const item = this.pressedItem(this.press);
      if (!item) { this.press = null; return; }
      const ghost = item.icon && this.textures.exists(itemIconKey(item.icon))
        ? this.add.image(pointer.x, pointer.y, itemIconKey(item.icon)).setAlpha(0.85).setDepth(300)
        : cardText(this, pointer.x, pointer.y, item.name, { size: 18, bold: true, originX: 0.5, originY: 0.5 }).setDepth(300);
      if (ghost.type === 'Image') ghost.setScale((76 * SCALE) / Math.max(ghost.width, ghost.height));
      this.drag = { ghost };
      this.moving = null;
    }
    this.drag.ghost.setPosition(pointer.x, pointer.y);
  }

  endDrag() {
    this.drag?.ghost.destroy();
    this.drag = null;
  }

  onPointerUp(pointer) {
    const press = this.press;
    this.press = null;
    if (!press || this.modal) { this.endDrag(); return; }
    if (!this.drag) {
      if (press.type === 'grid') this.clickGrid(press.index);
      else this.clickEquip(press.slot);
      return;
    }
    this.endDrag();
    this.dropOn(press, this.hitTest(pointer), this.shiftKey.isDown || Boolean(pointer.event?.shiftKey));
  }

  // Puštění taženého předmětu.
  dropOn(press, target, shift) {
    if (!target || (target.type === press.type && (target.index ?? target.slot) === (press.index ?? press.slot))) {
      this.render();
      return;
    }
    if (press.type === 'grid' && target.type === 'grid') {
      if (shift) {
        // Se Shiftem: okno pro výběr počtu kusů, které se dají do cílového políčka.
        this.render();
        this.openSplit(press.index, target.index);
        return;
      } else {
        const result = moveSlot(this.state, press.index, target.index);
        if (result.ok) { this.selected = target.index; this.changed(); this.flash('Předmět přesunut.', '#8fd3ff'); } else this.flash(result.reason);
      }
      this.render();
      return;
    }
    if (press.type === 'grid' && target.type === 'equip') {
      const item = getItem(this.state.inventory.slots[press.index]?.id);
      if (item?.slot !== target.slot) { this.flash(canEquip(item) ? 'Tento předmět patří do jiného slotu.' : 'Tento předmět nejde vybavit.'); this.render(); return; }
      this.runAction('equip', press.index);
      return;
    }
    if (press.type === 'equip' && target.type === 'grid') {
      this.unequip(press.slot, target.index);
      return;
    }
    this.render();
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
        this.moving !== null ? 'Klikni na políčko, kam se má předmět přesunout (Esc zruší).' : 'Klik = detail, tažení = přesun (se Shiftem rozdělení – zvolíš počet), dvojklik = vybavit / použít, pravé tlačítko = nabídka.',
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
      this.describe({ ...getItem(equipped.id), ...equipped }, 0, `Vybaveno: ${labels[slot]} · dvojklik nebo tažení do inventáře = sundat`);
    } else {
      this.info.add(cardText(this, INFO.x + 30, INFO.y + 28, labels[slot], { size: 26, bold: true, color: '#ffe7ae' }));
      this.info.add(cardText(this, INFO.x + 30, INFO.y + 72, 'Prázdný slot. Přetáhni sem předmět, dej na něm dvojklik, nebo použij pravé tlačítko → Vybavit.', { size: 17, color: '#c9d3dd', wrap: INFO.w - 60 }));
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
      drop: true,
      uses: true
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

  openDatabase(itemId) {
    SaveSystem.save(this.state);
    this.closing = true;
    this.scene.stop();
    this.scene.launch('Professions', { state: this.state, returnScene: this.returnScene, storageAccess: this.storageAccess, item: itemId });
    this.scene.bringToTop('Professions');
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
      // Jen jeden pokrm s trvajícím účinkem: nový nahradí starý – zeptat se.
      const recipe = item.use?.type === 'meal' ? COOKING_BY_ID[item.use.recipe] : null;
      const current = recipe && hasLastingEffect(recipe.effect) ? activeMeal(this.state) : null;
      if (current && !this.confirmedMeal) {
        this.modal = openCardModal(this, 'Nahradit pokrm?', [`Pořád působí: ${current.name}.`, `${item.name} jeho účinek nahradí.`], [
          { label: 'Sníst', onClick: () => { this.closeModal(); this.confirmedMeal = true; this.runAction('use', index); this.confirmedMeal = false; } },
          { label: 'Zpět', onClick: () => this.closeModal() }
        ]);
        return;
      }
      // Výztuha (Kovářství): aktivní je jedna – nová nahradí starou, zeptat se.
      const reinforcement = item.use?.type === 'reinforce' ? activeReinforcement(this.state) : null;
      if (reinforcement && !this.confirmedReinforce) {
        this.modal = openCardModal(this, 'Nahradit výztuhu?', [`Pořád působí: ${reinforcement.name} (${reinforcement.battlesLeft} soubojů).`, `${item.name} ji nahradí.`], [
          { label: 'Použít', onClick: () => { this.closeModal(); this.confirmedReinforce = true; this.runAction('use', index); this.confirmedReinforce = false; } },
          { label: 'Zpět', onClick: () => this.closeModal() }
        ]);
        return;
      }
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
    } else if (action === 'uses') {
      // Databáze v kartě Řemesla: odkud se předmět získá a kde se používá.
      this.openDatabase(slot.id);
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

  // Rozdělení: výběr počtu kusů do nové hromádky (z nabídky do prvního volného políčka,
  // při tažení se Shiftem do cílového políčka targetIndex).
  openSplit(index, targetIndex = null) {
    const slot = this.state.inventory.slots[index];
    const item = getItem(slot?.id);
    if (!item) return;
    const target = targetIndex === null ? null : this.state.inventory.slots[targetIndex];
    if (slot.qty < 2) { this.flash('Hromádku s jedním kusem nejde rozdělit.'); return; }
    if (target && target.id !== slot.id) { this.flash('Rozdělit jde jen do prázdného políčka nebo na stejný předmět.'); return; }
    const max = target ? Math.min(slot.qty - 1, item.stack - target.qty) : slot.qty - 1;
    if (max < 1) { this.flash('Cílová hromádka je plná.'); return; }
    let amount = Math.min(max, Math.max(1, Math.floor(slot.qty / 2)));
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
    c.add(cardText(this, x + w / 2, y + 72, `Kolik kusů oddělit ${target ? 'do cílové hromádky' : targetIndex !== null ? 'do zvoleného políčka' : 'do nového políčka'}? (celkem ${slot.qty})`, { size: 17, color: '#dbe6f3', originX: 0.5 }));
    const value = cardText(this, x + w / 2, y + 140, '', { size: 44, bold: true, color: '#ffd76a', originX: 0.5, originY: 0.5, strokeThickness: 5 });
    c.add(value);
    const refresh = () => value.setText(`${amount}  |  ${slot.qty - amount}`);
    refresh();
    const change = (d) => { amount = Phaser.Math.Clamp(amount + d, 1, max); refresh(); };
    [[-10, '−10'], [-1, '−1'], [1, '+1'], [10, '+10']].forEach(([d, label], i) => {
      cardButton(this, c, x + 70 + i * 128, y + 190, 112, 46, label, () => change(d), { size: 20 });
    });
    cardButton(this, c, x + w / 2 - 236, y + h - 70, 220, 50, 'Rozdělit', () => {
      const result = targetIndex === null ? splitSlot(this.state, index, amount) : splitToSlot(this.state, index, targetIndex, amount);
      this.closeModal();
      if (!result.ok) { this.flash(result.reason); return; }
      this.selected = targetIndex ?? result.index;
      this.changed();
      this.render();
      this.flash(`Rozděleno: ${result.count ?? amount} ks.`, '#8fd3ff');
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

    // Seřadit (vpravo vedle Zavřít): v pořadí filtrů, sloučí neúplné hromádky.
    this.sortButton = cardButton(this, this.card, SORT_AREA.x, SORT_AREA.y, SORT_AREA.w, SORT_AREA.h, 'Seřadit', () => this.sortItems(), { size: 28 });
  }

  sortItems() {
    if (this.modal) return;
    this.closeMenu();
    this.moving = null;
    this.selected = null;
    const used = sortInventory(this.state);
    this.page = 0;
    this.changed();
    this.render();
    this.flash(`Seřazeno: ${used} políček (Zbroj, Materiály, Potiony, Doplňky, Klíče, Ostatní).`, '#8fd3ff');
  }

  closeCard() {
    if (this.closing) return;
    this.closing = true;
    SaveSystem.save(this.state);
    // Karta zajede pod lištu, pak se vrátí scéna pod ní.
    slideCardOut(this, () => {
      this.scene.stop();
      this.scene.resume(this.returnScene);
    }, { hide: this.tabBar?.objects });
  }
}
