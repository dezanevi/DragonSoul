import Phaser from 'phaser';
import { goldText } from '../ui/goldText.js';
import { withSpend } from '../ui/spendConfirm.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem, ITEM_CATEGORIES } from '../data/items.js';

// Filtr inventáře ve skladu (stejné kategorie jako výkup u obchodníků, bez klíčů).
const INV_FILTERS = ITEM_CATEGORIES.filter((c) => c.id !== 'keys');
import { RARITY } from '../data/fishing.js';
import { itemValue } from '../systems/ItemValueSystem.js';
import { normalizeInventory } from '../systems/InventorySystem.js';
import { countQuestEvent } from '../systems/QuestCounters.js';
import { itemIconKey } from '../ui/inventorySprites.js';
import { cardText, cardButton, uiWindow, uiTitle, uiSection, coinAmount } from '../ui/fantasyCard.js';
import { askName, renameIcon } from '../ui/nameInput.js';
import {
  ECONOMIC_CATEGORIES, economicCategory, itemPopularity, popularityLabel, priceRating, reputationBand,
  REGION_ECONOMY, diplomacyItemXp, GAME_DAY_MS
} from '../data/diplomacy.js';
import {
  getShop, normalizeDiplomacy, diplomacyLevel, moveToStorage, moveToInventory, setSlot, setSlotPrice, setShopOpen, collectTill,
  storageQty, marketSaturation, estimateDailySales, customersPerDay, onShopSale, CUSTOMER_TYPES, PROPERTY_TYPES, PROPERTIES
} from '../systems/DiplomacySystem.js';

// Vlastní obchod (Diplomacie, 1. etapa): záložky Prodej (sloty, ceny, poptávka), Sklad (přesun
// z / do inventáře) a Statistiky. Objednávky a Zaměstnanci přijdou v další etapě.
// Zboží se prodává samo během hraní (DiplomacySystem.tickBusiness), karta se jen obnovuje.

const W = 1860;
const H = 920;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;
const BTN_H = 58;
const TABS = [
  { id: 'sale', label: 'Prodej' },
  { id: 'storage', label: 'Sklad' },
  { id: 'stats', label: 'Statistiky' },
  { id: 'orders', label: 'Objednávky', locked: 'Přijde v další etapě Diplomacie.' },
  { id: 'staff', label: 'Zaměstnanci', locked: 'Od Diplomacie 20 – přijde v další etapě.' }
];

export default class OwnShopScene extends Phaser.Scene {
  constructor() {
    super('OwnShop');
  }

  create(data) {
    this.state = data.state;
    this.returnScene = data.returnScene ?? 'Interior';
    this.shopId = data.shopId;
    this.tab = data.tab ?? 'sale';
    this.selected = 0;
    this.page = { inv: 0, store: 0, offer: 0 };
    this.closing = false;
    normalizeInventory(this.state);
    normalizeDiplomacy(this.state);
    this.shop = getShop(this.state, this.shopId);
    if (!this.shop) {
      this.close();
      return;
    }

    uiWindow(this, X, Y, W, H, { shade: 0.6 });
    this.titleText = uiTitle(this, X + 36, Y + 22, `Tvůj obchod – ${this.shop.name}`, { icon: 'coins', size: 34 });
    this.layer = this.add.container(0, 0);
    this.message = cardText(this, X + 36, Y + H - 66, '', { size: 21, color: '#ffd76a', wrap: 1300 });
    cardButton(this, null, X + W - 36 - 220, Y + H - 82, 220, BTN_H, 'Zavřít (ESC)', () => this.close(), { danger: true, size: 22 });

    this.onKey = (event) => {
      if (!event.repeat && event.code === 'Escape') {
        if (this.filterMenu) this.closeFilterMenu(); // nejdřív zavřít rozbalený filtr
        else this.close();
      }
    };
    this.time.delayedCall(200, () => this.input.keyboard.on('keydown', this.onKey));
    // Prodej běží na pozadí: karta se obnoví po každém prodeji a jednou za 2 s (nasycení, čas).
    this.offSale = onShopSale(({ shop, itemId, qty, revenue }) => {
      if (shop.id !== this.shopId) return;
      this.say(`Prodáno: ${getItem(itemId)?.name} ×${qty} za ${goldText(revenue)} – v pokladně ${goldText(Math.floor(Number(shop.till) || 0))}.`);
      this.dirty = true;
    });
    this.timer = this.time.addEvent({ delay: 2000, loop: true, callback: () => { this.dirty = true; } });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.onKey);
      this.offSale?.();
    });
    this.refresh();
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      this.refresh();
    }
  }

  say(text) {
    this.message.setText(text);
  }

  // ------------------------------------------------------------------ pomocníci
  put(obj) {
    this.layer.add(obj);
    return obj;
  }

  text(x, y, value, opts = {}) {
    const t = cardText(this, x, y, value, { size: 20, ...opts });
    if (opts.maxWidth && t.width > opts.maxWidth) t.setScale(opts.maxWidth / t.width);
    return this.put(t);
  }

  button(x, y, w, label, onClick, opts = {}) {
    const b = cardButton(this, null, x, y, w, opts.h ?? BTN_H, label, onClick, { size: 21, ...opts });
    for (const o of b.objects) this.layer.add(o);
    return b;
  }

  icon(itemId, x, y, size = 44) {
    const item = getItem(itemId);
    if (item?.icon && this.textures.exists(itemIconKey(item.icon))) {
      const image = this.put(this.add.image(x, y, itemIconKey(item.icon)));
      image.setScale(size / Math.max(image.width, image.height));
    }
  }

  itemColor(itemId) {
    return (RARITY[getItem(itemId)?.rarity] ?? RARITY.common).color;
  }

  // ------------------------------------------------------------------ obnova
  refresh() {
    this.layer.removeAll(true);
    this.shop = getShop(this.state, this.shopId);
    const shop = this.shop;
    const type = PROPERTY_TYPES[shop.type];
    const [, repName] = reputationBand(shop.reputation);

    // Název obchodu (✎ = přejmenovat).
    this.titleText.setText(`Tvůj obchod – ${shop.name}`);
    if (this.titleText.width > 760) this.titleText.setScale(760 / this.titleText.width); else this.titleText.setScale(1);
    for (const o of renameIcon(this, this.titleText.x + this.titleText.displayWidth + 6, Y + 18, () => this.renameShop())) this.layer.add(o);

    // Horní lišta: zlato, stav, reputace, Diplomacie, herní den.
    this.put(coinAmount(this, X + W - 36, Y + 30, this.state.gold, { size: 24, bold: true, color: '#ffd76a', originX: 1 }, { prefix: 'Zlato:' }));
    const day = Math.floor(this.state.business.clock / GAME_DAY_MS) + 1;
    const dayPart = Math.floor(((this.state.business.clock % GAME_DAY_MS) / GAME_DAY_MS) * 100);
    this.text(X + 900, Y + 32,
      `${type.name} · Reputace ${Math.round(shop.reputation)} (${repName}) · Diplomacie ${diplomacyLevel(this.state)} · Herní den ${day} (${dayPart} %)`,
      { size: 20, color: '#dbe6f3', maxWidth: 700 });

    // Záložky + otevřeno / zavřeno.
    TABS.forEach((tab, i) => {
      this.button(X + 36 + i * 210, Y + 86, 200, tab.label, () => {
        if (tab.locked) { this.say(`${tab.label}: ${tab.locked}`); return; }
        this.tab = tab.id;
        this.say('');
        this.refresh();
      }, { active: this.tab === tab.id, disabled: false });
    });
    const status = shop.open ? 'Otevřeno' : shop.closedReason === 'unpaid' ? `Zavřeno – dluh ${goldText(shop.debt)}` : 'Zavřeno';
    this.text(X + 1100, Y + 102, status, { size: 22, bold: true, color: shop.open ? '#7fd67a' : '#ff8a7a', maxWidth: 150 });
    // Pokladna: tržby zůstávají v obchodě, hráč si je vybere (platí se z nich i provoz).
    const till = Math.floor(Number(shop.till) || 0);
    this.button(X + 1264, Y + 86, 270, till ? `Vybrat ${goldText(till)}` : 'Pokladna prázdná', () => {
      const amount = collectTill(this.state, this.shopId);
      SaveSystem.save(this.state);
      this.say(amount ? `Z pokladny jsi vybral ${goldText(amount)}.` : 'Pokladna je prázdná.');
      this.refresh();
    }, { disabled: !till, size: 20 });
    this.button(X + W - 36 - 300, Y + 86, 300, shop.open ? 'Zavřít obchod' : shop.debt ? `Uhradit ${goldText(shop.debt)} a otevřít` : 'Otevřít obchod', () => {
      withSpend(this, !shop.open ? shop.debt : 0, { title: 'Uhradit dluh za provoz', lines: ['Obchod se po úhradě znovu otevře.'] }, () => {
        const result = setShopOpen(this.state, this.shopId, !shop.open);
        this.say(result.ok ? (shop.open ? 'Obchod je otevřený, zákazníci chodí.' : 'Obchod je zavřený, nic se neprodává.') : result.reason);
        SaveSystem.save(this.state);
        this.refresh();
      });
    });

    if (this.tab === 'sale') this.renderSale();
    else if (this.tab === 'storage') this.renderStorage();
    else {
      // Úkol Účetní kniha: stačí knihu otevřít (počítá se každé zobrazení).
      countQuestEvent(this.state, 'ledger:open');
      this.renderStats();
    }
  }

  // ------------------------------------------------------------------ Prodej
  renderSale() {
    const shop = this.shop;
    const top = Y + 164;
    this.put(uiSection(this, X + 20, top, 1100, H - 250));
    this.put(uiSection(this, X + 1140, top, W - 1160, H - 250));
    this.text(X + 40, top + 14, `Prodejní sloty (${shop.slots.filter(Boolean).length} / ${shop.slots.length}) – klikni na slot`, { size: 22, bold: true });

    const cols = 4;
    const cw = 262;
    const ch = 148;
    shop.slots.forEach((slot, i) => {
      const cx = X + 40 + (i % cols) * (cw + 8);
      const cy = top + 52 + Math.floor(i / cols) * (ch + 8);
      const selected = i === this.selected;
      const g = this.put(this.add.graphics());
      g.fillStyle(selected ? 0x3b2c0c : 0x0f1822, 0.92).fillRoundedRect(cx, cy, cw, ch, 10);
      g.lineStyle(selected ? 3 : 2, selected ? 0xffd76a : 0x6b5233, 1).strokeRoundedRect(cx, cy, cw, ch, 10);
      const zone = this.put(this.add.zone(cx, cy, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true }));
      zone.on('pointerdown', () => { this.selected = i; this.page.offer = 0; this.say(''); this.refresh(); });
      if (!slot) {
        this.text(cx + cw / 2, cy + ch / 2, '+ prázdný slot', { size: 20, color: '#8a96a2', originX: 0.5, originY: 0.5 });
        return;
      }
      const item = getItem(slot.itemId);
      const stock = storageQty(shop, slot.itemId);
      this.icon(slot.itemId, cx + 34, cy + 36, 48);
      this.text(cx + 66, cy + 12, item.name, { size: 19, bold: true, color: this.itemColor(slot.itemId), maxWidth: cw - 76 });
      this.text(cx + 66, cy + 40, stock ? `skladem ${stock} ks` : 'není skladem', { size: 18, color: stock ? '#dbe6f3' : '#ff8a7a' });
      this.put(coinAmount(this, cx + 14, cy + 78, slot.price, { size: 20, bold: true, color: '#ffd76a' }, { rest: '/ ks' }));
      const [, rating, color] = priceRating(slot.price / Math.max(1, itemValue(slot.itemId)));
      this.text(cx + 14, cy + 110, rating, { size: 18, color });
    });

    const slot = shop.slots[this.selected];
    if (slot) this.renderSlotDetail(slot, X + 1160, top + 14);
    else this.renderOfferPicker(X + 1160, top + 14);
  }

  renderSlotDetail(slot, x, y) {
    const shop = this.shop;
    const item = getItem(slot.itemId);
    const value = Math.max(1, itemValue(slot.itemId));
    const cat = economicCategory(slot.itemId);
    const pop = itemPopularity(slot.itemId);
    const region = REGION_ECONOMY[shop.region] ?? REGION_ECONOMY.Greenvale;
    const sat = marketSaturation(this.state, shop.region, cat);
    const perDay = estimateDailySales(this.state, shop, slot);
    const [, rating, color] = priceRating(slot.price / value);

    this.icon(slot.itemId, x + 30, y + 30, 56);
    this.text(x + 70, y + 6, item.name, { size: 24, bold: true, color: this.itemColor(slot.itemId), maxWidth: 560 });
    this.text(x + 70, y + 38, `${ECONOMIC_CATEGORIES[cat].name} · skladem ${storageQty(shop, slot.itemId)} ks`, { size: 19, color: '#b8a890' });

    this.text(x, y + 86, 'Prodejní cena', { size: 22, bold: true });
    this.put(coinAmount(this, x + 200, y + 86, slot.price, { size: 24, bold: true, color: '#ffd76a' }, { rest: '/ ks' }));
    this.text(x + 380, y + 88, rating, { size: 21, bold: true, color });
    const steps = [[-10, '−10'], [-1, '−1'], [1, '+1'], [10, '+10']];
    steps.forEach(([d, label], i) => {
      this.button(x + i * 104, y + 126, 96, label, () => { setSlotPrice(this.state, this.shopId, this.selected, slot.price + d); this.refresh(); }, { disabled: slot.price + d < 1 });
    });
    this.button(x + 424, y + 126, 230, 'Tržní cena', () => { setSlotPrice(this.state, this.shopId, this.selected, value); this.refresh(); });
    this.put(coinAmount(this, x, y + 198, value, { size: 20, color: '#dbe6f3' }, { prefix: 'Doporučená tržní hodnota:', rest: '/ ks' }));

    const lines = [
      `Popularita: ${pop} (${popularityLabel(pop)})`,
      `Regionální poptávka (${region.name}): ×${(region.mods[cat] ?? 1).toFixed(2).replace('.', ',')}`,
      `Nasycení trhu: ${Math.round(sat * 100)} %`,
      `Odhad prodeje: ~${perDay >= 10 ? Math.round(perDay) : perDay.toFixed(1).replace('.', ',')} ks za herní den`,
      `XP Diplomacie za prodej: ${diplomacyItemXp(slot.itemId)} (za položku, opakování slábne)`
    ];
    lines.forEach((line, i) => this.text(x, y + 240 + i * 34, line, { size: 20, color: '#dbe6f3' }));

    this.button(x, y + 430, 300, 'Odebrat z nabídky', () => {
      setSlot(this.state, this.shopId, this.selected, null);
      SaveSystem.save(this.state);
      this.refresh();
    }, { danger: true });
    this.text(x, y + 506, 'Vyšší cena snižuje šanci na prodej, nižší ji zvyšuje – ale poptávka\nje omezená nasycením trhu a rozpočty zákazníků.', { size: 18, color: '#9aa4ae' });
  }

  // Prázdný slot: výběr zboží ze skladu (předmět, který už v nabídce není).
  renderOfferPicker(x, y) {
    const shop = this.shop;
    this.text(x, y, 'Prázdný slot – co nabídnout?', { size: 22, bold: true });
    const offered = new Set(shop.slots.filter(Boolean).map((s) => s.itemId));
    const rows = Object.entries(shop.storage).filter(([id, qty]) => qty > 0 && !offered.has(id))
      .sort((a, b) => getItem(a[0]).name.localeCompare(getItem(b[0]).name, 'cs'));
    if (!rows.length) {
      this.text(x, y + 50, 'Ve skladu není nic dalšího k nabídnutí.\nZboží přesuneš do skladu na záložce Sklad.', { size: 20, color: '#9aa4ae' });
      return;
    }
    const per = 8;
    const pages = Math.ceil(rows.length / per);
    this.page.offer = Math.min(this.page.offer, pages - 1);
    rows.slice(this.page.offer * per, this.page.offer * per + per).forEach(([id, qty], i) => {
      const ry = y + 46 + i * 66;
      this.icon(id, x + 24, ry + 28, 42);
      this.text(x + 56, ry + 6, `${getItem(id).name} ×${qty}`, { size: 19, bold: true, color: this.itemColor(id), maxWidth: 360 });
      this.put(coinAmount(this, x + 56, ry + 34, itemValue(id), { size: 16, color: '#b8a890' }, { prefix: 'tržní', rest: `/ ks · popularita ${itemPopularity(id)}` }));
      this.button(x + 470, ry + 2, 180, 'Nabídnout', () => {
        setSlot(this.state, this.shopId, this.selected, id);
        SaveSystem.save(this.state);
        this.say(`${getItem(id).name} je v nabídce za tržní cenu – upravit ji můžeš vpravo.`);
        this.refresh();
      });
    });
    this.pager(x, y + 46 + per * 66, 'offer', pages);
  }

  pager(x, y, key, pages) {
    if (pages <= 1) return;
    this.button(x, y, 150, '◀ Zpět', () => { this.page[key] -= 1; this.refresh(); }, { disabled: this.page[key] <= 0 });
    this.text(x + 170, y + 16, `${this.page[key] + 1} / ${pages}`, { size: 20 });
    this.button(x + 260, y, 150, 'Dál ▶', () => { this.page[key] += 1; this.refresh(); }, { disabled: this.page[key] >= pages - 1 });
  }

  // ------------------------------------------------------------------ Sklad
  // Rozbalený filtr inventáře: kategorie s počtem kusů; prázdné kategorie neaktivní.
  toggleFilterMenu(x, y, w, rows) {
    if (this.filterMenu) { this.closeFilterMenu(); return; }
    const count = (id) => rows.filter(([itemId]) => !id || getItem(itemId)?.category === id).reduce((sum, [, qty]) => sum + qty, 0);
    const options = [{ id: null, label: 'Vše' }, ...INV_FILTERS];
    const objects = [];
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.001).setOrigin(0).setInteractive().setDepth(50);
    shade.on('pointerdown', () => this.closeFilterMenu());
    objects.push(shade);
    const bg = this.add.graphics().setDepth(51);
    bg.fillStyle(0x0b1626, 0.97).fillRoundedRect(x - 8, y - 8, w + 16, options.length * 62 + 10, 12).lineStyle(2, 0xd6a23a, 1).strokeRoundedRect(x - 8, y - 8, w + 16, options.length * 62 + 10, 12);
    objects.push(bg);
    options.forEach((opt, i) => {
      const n = count(opt.id);
      const b = cardButton(this, null, x, y + i * 62, w, 56, `${opt.label} (${n})`, () => {
        this.invFilter = opt.id;
        this.page.inv = 0;
        this.closeFilterMenu();
        this.refresh();
      }, { size: 20, disabled: !n && opt.id !== null });
      if (opt.id === (this.invFilter ?? null)) b.objects[1]?.setColor?.('#ffd76a');
      for (const o of b.objects) { o.setDepth?.(52); objects.push(o); }
    });
    this.filterMenu = objects;
  }

  closeFilterMenu() {
    for (const o of this.filterMenu ?? []) o.destroy();
    this.filterMenu = null;
  }

  renderStorage() {
    const shop = this.shop;
    const top = Y + 164;
    const half = (W - 60) / 2;
    this.put(uiSection(this, X + 20, top, half, H - 250));
    this.put(uiSection(this, X + 40 + half, top, half, H - 250));
    this.text(X + 40, top + 14, 'Inventář – obchodovatelné zboží', { size: 22, bold: true });
    this.text(X + 60 + half, top + 14, 'Sklad obchodu', { size: 22, bold: true });

    // Inventář: souhrnně podle druhu, jen obchodovatelné předměty.
    const inv = new Map();
    for (const s of this.state.inventory.slots) {
      if (!s || !economicCategory(s.id)) continue;
      inv.set(s.id, (inv.get(s.id) ?? 0) + s.qty);
    }
    const allInvRows = [...inv.entries()].sort((a, b) => getItem(a[0]).name.localeCompare(getItem(b[0]).name, 'cs'));
    // Filtr kategorie (tlačítko „Filtr: … ▾“ vpravo v nadpisu inventáře).
    const invRows = this.invFilter ? allInvRows.filter(([id]) => getItem(id)?.category === this.invFilter) : allInvRows;
    const filterLabel = INV_FILTERS.find((c) => c.id === this.invFilter)?.label ?? 'Vše';
    const fw = 250;
    const fx = X + 20 + half - 20 - fw;
    const filterButton = this.button(fx, top + 4, fw, `Filtr: ${filterLabel} ▾`, () => this.toggleFilterMenu(fx, top + 70, fw, allInvRows), { size: 20, h: 54 });
    if (this.invFilter) filterButton.objects[1]?.setColor?.('#ffd76a');
    const per = 9;
    const list = (rows, key, x, actions) => {
      if (!rows.length) {
        const empty = key !== 'inv' ? 'Sklad je prázdný.' : this.invFilter ? `V kategorii ${filterLabel} nemáš nic na prodej.` : 'V inventáři nemáš nic na prodej.';
        this.text(x, top + 70, empty, { size: 20, color: '#9aa4ae' });
        return;
      }
      const pages = Math.ceil(rows.length / per);
      this.page[key] = Math.min(this.page[key], pages - 1);
      rows.slice(this.page[key] * per, this.page[key] * per + per).forEach(([id, qty], i) => {
        const ry = top + 54 + i * 66;
        this.icon(id, x + 24, ry + 28, 42);
        this.text(x + 56, ry + 6, `${getItem(id).name} ×${qty}`, { size: 19, bold: true, color: this.itemColor(id), maxWidth: 330 });
        this.text(x + 56, ry + 34, ECONOMIC_CATEGORIES[economicCategory(id)].name, { size: 16, color: '#b8a890' });
        actions(id, qty, ry);
      });
      this.pager(x, top + 54 + per * 66, key, pages);
    };

    const leftX = X + 40;
    list(invRows, 'inv', leftX, (id, qty, ry) => {
      this.button(leftX + 400, ry + 2, 170, 'Do skladu 1', () => this.move(() => moveToStorage(this.state, this.shopId, id, 1), id, 'do skladu'));
      this.button(leftX + 580, ry + 2, 170, `Vše (${qty})`, () => this.move(() => moveToStorage(this.state, this.shopId, id, qty), id, 'do skladu'));
    });

    const rightX = X + 60 + half;
    const offered = new Set(shop.slots.filter(Boolean).map((s) => s.itemId));
    const storeRows = Object.entries(shop.storage).filter(([, q]) => q > 0)
      .sort((a, b) => getItem(a[0]).name.localeCompare(getItem(b[0]).name, 'cs'));
    list(storeRows, 'store', rightX, (id, qty, ry) => {
      this.button(rightX + 380, ry + 2, 120, 'Zpět 1', () => this.move(() => moveToInventory(this.state, this.shopId, id, 1), id, 'do inventáře'));
      this.button(rightX + 508, ry + 2, 110, 'Vše', () => this.move(() => moveToInventory(this.state, this.shopId, id, qty), id, 'do inventáře'));
      const free = shop.slots.findIndex((s) => !s);
      this.button(rightX + 626, ry + 2, 180, offered.has(id) ? 'V nabídce' : 'Nabídnout', () => {
        setSlot(this.state, this.shopId, free, id);
        this.selected = free;
        SaveSystem.save(this.state);
        this.say(`${getItem(id).name} je v nabídce za tržní cenu.`);
        this.refresh();
      }, { disabled: offered.has(id) || free < 0 });
    });
  }

  move(action, itemId, where) {
    const moved = action();
    SaveSystem.save(this.state);
    this.say(moved ? `${getItem(itemId).name} ×${moved} → ${where}.` : 'Nic se nepřesunulo (plný inventář?).');
    this.refresh();
  }

  // ------------------------------------------------------------------ Statistiky
  renderStats() {
    const shop = this.shop;
    const s = shop.stats;
    const top = Y + 164;
    this.put(uiSection(this, X + 20, top, 880, H - 250));
    this.put(uiSection(this, X + 920, top, W - 940, H - 250));

    const net = s.revenue - s.costs;
    const t = s.today;
    const rows = [
      ['Dnes – tržby', `${goldText(t.revenue)}`], ['Dnes – zákazníci / obchody', `${t.customers} / ${t.trades}`],
      ['Celkové tržby', `${goldText(s.revenue)}`], ['Provozní náklady celkem', `${goldText(s.costs)} (${goldText(PROPERTY_TYPES[shop.type].dailyCost)} / den)`],
      ['Čistý provozní příjem', `${goldText(net)}`], ['Zákazníci / obchody celkem', `${s.customers} / ${s.trades}`],
      ['Reputace', `${Math.round(shop.reputation)} – ${reputationBand(shop.reputation)[1]} (návštěvnost ×${reputationBand(shop.reputation)[2].toFixed(2).replace('.', ',')})`],
      ['Očekávaní zákazníci', `~${Math.round(customersPerDay(this.state, shop))} za herní den`]
    ];
    this.text(X + 40, top + 14, 'Přehled', { size: 22, bold: true });
    rows.forEach(([label, value], i) => {
      this.text(X + 40, top + 56 + i * 40, label, { size: 20, color: '#b8a890' });
      this.text(X + 440, top + 56 + i * 40, value, { size: 20, bold: true, maxWidth: 440 });
    });
    this.text(X + 40, top + 390, 'Čistý provozní příjem = tržby − provozní náklady (bez ceny, za kterou jsi zboží\nzískal – skutečný zisk může být nižší).', { size: 16, color: '#9aa4ae' });

    // Poslední dny.
    this.text(X + 40, top + 450, 'Poslední herní dny', { size: 22, bold: true });
    const days = [...s.days].slice(-5).reverse();
    if (!days.length) this.text(X + 40, top + 490, 'Zatím žádný dokončený herní den.', { size: 19, color: '#9aa4ae' });
    days.forEach((d, i) => {
      this.text(X + 40, top + 490 + i * 34, `Den ${d.day + 1}: tržby ${goldText(d.revenue)} · náklady ${goldText(d.costs)} · zákazníci ${d.customers} · obchody ${d.trades}`, { size: 19 });
    });

    // Nejprodávanější / nejméně prodávané, historie.
    const rx = X + 940;
    const items = Object.entries(s.items).sort((a, b) => b[1].revenue - a[1].revenue);
    this.text(rx, top + 14, 'Nejprodávanější', { size: 22, bold: true });
    if (!items.length) this.text(rx, top + 52, 'Zatím se nic neprodalo.', { size: 19, color: '#9aa4ae' });
    items.slice(0, 5).forEach(([id, row], i) => {
      this.icon(id, rx + 18, top + 64 + i * 40, 30);
      this.text(rx + 40, top + 52 + i * 40, `${getItem(id).name}: ${row.qty} ks za ${goldText(row.revenue)}`, { size: 19, maxWidth: 800 });
    });
    const slow = this.shop.slots.filter(Boolean).filter((sl) => !(s.items[sl.itemId]?.qty)).map((sl) => getItem(sl.itemId).name);
    this.text(rx, top + 270, 'Nejméně prodávané (v nabídce, zatím bez prodeje)', { size: 22, bold: true });
    this.text(rx, top + 306, slow.length ? slow.slice(0, 6).join(', ') : '—', { size: 19, color: '#dbe6f3', wrap: 820 });

    this.text(rx, top + 400, 'Historie obchodů', { size: 22, bold: true });
    if (!s.history.length) this.text(rx, top + 438, 'Zatím žádné obchody.', { size: 19, color: '#9aa4ae' });
    s.history.slice(0, 8).forEach((h, i) => {
      this.text(rx, top + 438 + i * 32, `Den ${h.day + 1}: ${CUSTOMER_TYPES[h.customer]?.name ?? h.customer} koupil ${getItem(h.itemId)?.name} ×${h.qty} za ${goldText(h.qty * h.price)}`, { size: 18, maxWidth: 820 });
    });
  }

  renameShop() {
    askName(this, {
      title: 'Přejmenovat obchod',
      current: this.shop.name,
      fallback: PROPERTIES[this.shopId]?.name,
      fallbackLabel: 'Původní název',
      maxLength: 28,
      onDone: (name) => {
        if (!name || name === this.shop.name) return;
        this.shop.name = name;
        SaveSystem.save(this.state);
        this.say(`Obchod se teď jmenuje „${name}“.`);
        this.refresh();
      }
    });
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    SaveSystem.save(this.state);
    this.scene.stop();
    this.scene.resume(this.returnScene);
  }
}
