import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem, ITEM_CATEGORIES } from '../data/items.js';
// Filtr výkupu = kategorie inventáře (Jídlo má vlastní kategorii – data/items.js), bez Klíčů.
const sellCategory = (id) => getItem(id)?.category;
const SELL_FILTERS = ITEM_CATEGORIES.filter((c) => c.id !== 'keys');
import { RARITY } from '../data/fishing.js';
import { MERCHANTS } from '../data/merchants.js';
import { addItem, getItemCount, removeItem, normalizeInventory } from '../systems/InventorySystem.js';
import { itemIconKey } from '../ui/inventorySprites.js';
import { cardText, cardButton, uiWindow, uiTitle, uiSection, coinAmount } from '../ui/fantasyCard.js';
import { questMarkObjects } from '../ui/craftLook.js';
import { questShoppingList, questNeededItems, questSellList, QUEST_MARK_BLUE } from '../systems/QuestSystem.js';

// Předmět k prodeji pro úkol (id nebo „jakýkoli šperk“) → řádek označení, jinak null.
const sellMarkOf = (list, id) => list[id] ?? (list.jewel && ['ring', 'amulet'].includes(getItem(id)?.slot) ? list.jewel : null);
import { sellPrice } from '../systems/ItemValueSystem.js';
import { ShopCart, sellButtons, SELL_BUTTONS_W, shopItemHover } from '../ui/shopCart.js';

// Obchod obchodníka na tržišti se třemi sloupci:
//   Koupit (zboží z data/merchants.js) | Prodat (předměty z inventáře za polovinu hodnoty,
//   systems/ItemValueSystem.js) | Košík.
// Tlačítka v nabídkách jen vkládají do košíku. V košíku je zeleně, co hráč dostane (nákup),
// červeně, co odevzdá (prodej), a dole konečná suma: +N, když prodej převýší nákup, jinak −N.
// Obchod se provede až tlačítkem „Potvrdit obchod“; zavřením okna se košík zahodí.

const W = 1860;
const H = 900;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;
const BUY = { x: X + 20, w: 600 };
// Košík uprostřed mezi nákupem a výkupem (přání hráče).
const CART = { x: X + 636, w: 548 };
const SELL = { x: X + 1200, w: 640 };
const ROW = 66;
const PAGE = 9;

export default class MerchantShopScene extends Phaser.Scene {
  constructor() {
    super('MerchantShop');
  }

  create(data) {
    this.state = data.state;
    this.returnScene = data.returnScene ?? 'Interior';
    this.merchant = MERCHANTS[data.merchant];
    this.closing = false;
    this.page = 0;
    this.sellPage = 0;
    this.sellFilter = null; // kategorie předmětů ve výkupu (null = vše)
    this.filterMenu = null;
    normalizeInventory(this.state);
    this.state.gold = Math.max(0, Math.floor(Number(this.state.gold) || 0));
    this.cart = new ShopCart(this, this.state, {
      sellValue: (id, qty) => sellPrice(id) * qty,
      sellOne: (id) => (removeItem(this.state, id, 1) ? sellPrice(id) : null),
      buyOne: (good) => this.buyOne(good),
      onDone: (text) => { this.messageText.setText(text); this.refresh(); }
    });

    uiWindow(this, X, Y, W, H, { shade: 0.6 });
    uiSection(this, BUY.x, Y + 84, BUY.w, H - 188);
    uiSection(this, SELL.x, Y + 84, SELL.w, H - 188);
    uiSection(this, CART.x, Y + 84, CART.w, H - 188);
    uiTitle(this, X + 36, Y + 24, `${this.merchant.name} – obchod`, { icon: 'coins', size: 34 });
    cardText(this, BUY.x + 20, Y + 98, 'Koupit', { size: 22, bold: true });
    cardText(this, SELL.x + 20, Y + 98, 'Prodat (½ hodnoty)', { size: 22, bold: true });
    this.messageText = cardText(this, X + 36, Y + H - 72, '', { size: 20, color: '#ffd76a', wrap: 1100 });
    this.layer = this.add.container(0, 0);
    cardButton(this, null, X + W - 36 - 220, Y + H - 86, 220, 60, 'Zavřít (ESC)', () => this.close(), { danger: true });

    this.onKey = (event) => {
      if (!event.repeat && event.code === 'Escape') { if (this.filterMenu) this.closeFilterMenu(); else this.close(); }
    };
    this.time.delayedCall(200, () => this.input.keyboard.on('keydown', this.onKey));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));
    this.refresh();
  }

  icon(itemId, x, y, size = 44) {
    const item = getItem(itemId);
    const key = item?.icon ? itemIconKey(item.icon) : null;
    if (!key || !this.textures.exists(key)) return;
    const image = this.add.image(x, y, key);
    image.setScale(size / Math.max(image.width, image.height));
    this.layer.add(image);
  }

  pager(x, y, page, pages, turn) {
    if (pages <= 1) return;
    this.layer.add(cardButton(this, null, x, y, 90, 56, '◀', () => turn(-1), { size: 21, disabled: page === 0 }).objects);
    this.layer.add(cardButton(this, null, x + 210, y, 90, 56, '▶', () => turn(1), { size: 21, disabled: page >= pages - 1 }).objects);
    this.layer.add(cardText(this, x + 150, y + 28, `${page + 1} / ${pages}`, { size: 20, color: '#9fb3c8', originX: 0.5, originY: 0.5 }));
  }

  // ------------------------------------------------------------ vykreslení

  refresh() {
    this.layer.removeAll(true);
    this.layer.add(coinAmount(this, X + W - 36, Y + 32, this.state.gold, { size: 24, bold: true, color: '#ffd76a', originX: 1 }, { prefix: 'Zlato:' }));
    this.renderBuy();
    this.renderSell();
    this.cart.render(this.layer, { x: CART.x, y: Y + 84, w: CART.w, h: H - 188 }, () => this.refresh());
  }

  renderBuy() {
    // Předměty, které hráč potřebuje koupit pro úkol, jsou nahoře a označené.
    const shopping = questShoppingList(this.state);
    const goods = [...this.merchant.goods].sort((a, b) => Number(Boolean(shopping[b.id])) - Number(Boolean(shopping[a.id])));
    const pages = Math.max(1, Math.ceil(goods.length / PAGE));
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1);
    goods.slice(this.page * PAGE, (this.page + 1) * PAGE).forEach((good, i) => {
      const y = Y + 140 + i * ROW;
      const item = getItem(good.id);
      let tagW = 0;
      if (shopping[good.id]) {
        const mark = questMarkObjects(this, BUY.x + 10, y - 2, BUY.w - 20, ROW - 4, shopping[good.id], cardText, BUY.x + BUY.w - 214, 170);
        this.layer.add(mark.objects);
        tagW = mark.width + 12;
      }
      shopItemHover(this, this.layer, good.id, BUY.x + 26, y, BUY.w - 214 - 26, ROW - 6);
      this.icon(good.id, BUY.x + 52, y + 28);
      const color = (RARITY[item?.rarity] ?? RARITY.common).color;
      const name = cardText(this, BUY.x + 88, y + 4, `${item?.name ?? good.id}${good.qty > 1 ? ` (${good.qty} ks)` : ''}`, { size: 21, bold: true, color });
      const room = Math.min(300, BUY.w - 214 - 88 - tagW);
      if (name.width > room) name.setScale(room / name.width);
      this.layer.add(name);
      this.layer.add(coinAmount(this, BUY.x + 88, y + 34, this.cart.buyPrice(good.price), { size: 18, color: '#9fb3c8' }, { rest: `· máš ${getItemCount(this.state, good.id)}` }));
      this.layer.add(cardButton(this, null, BUY.x + BUY.w - 196, y + 4, 176, 56, 'Do košíku', () => { this.cart.addBuy(good); this.messageText.setText(''); this.refresh(); }, { size: 20, disabled: !this.cart.canAddBuy(good) }).objects);
    });
    this.pager(BUY.x + 20, Y + H - 170, this.page, pages, (step) => { this.page += step; this.refresh(); });
  }

  // Výkup: předměty z inventáře (souhrnně podle druhu), kromě klíčových. qty = co ještě není v košíku.
  sellRows() {
    const rows = [];
    for (const slot of this.state.inventory.slots) {
      if (!slot) continue;
      const price = sellPrice(slot.id);
      if (!price) continue;
      const row = rows.find((r) => r.id === slot.id);
      if (row) row.qty += slot.qty;
      else rows.push({ id: slot.id, qty: slot.qty, price });
    }
    for (const row of rows) row.qty -= this.cart.sellCount(row.id);
    return rows.filter((row) => row.qty > 0);
  }

  // Výkup jen zvolené kategorie (filtr nad seznamem Prodat).
  filteredSellRows() {
    const rows = this.sellRows();
    return this.sellFilter ? rows.filter((r) => sellCategory(r.id) === this.sellFilter) : rows;
  }

  // Kategorie (filtry), ve kterých má hráč něco prodat pro úkol – navedení modrým „?“.
  questSellCategories() {
    const list = questSellList(this.state);
    return new Set(this.sellRows().filter((r) => sellMarkOf(list, r.id)).map((r) => sellCategory(r.id)));
  }

  renderSell() {
    this.renderSellFilter();
    const sellList = questSellList(this.state);
    // Předměty k prodeji pro úkol nahoře a označené (jako věci k nákupu).
    const rows = this.filteredSellRows().sort((a, b) => Number(Boolean(sellMarkOf(sellList, b.id))) - Number(Boolean(sellMarkOf(sellList, a.id))));
    const needed = questNeededItems(this.state);
    if (!rows.length) {
      const label = SELL_FILTERS.find((c) => c.id === this.sellFilter)?.label;
      this.layer.add(cardText(this, SELL.x + 20, Y + 160, label ? `V kategorii ${label} nemáš nic na prodej.` : 'Nemáš nic na prodej.', { size: 20, color: '#9aa4ae' }));
      return;
    }
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    this.sellPage = Phaser.Math.Clamp(this.sellPage, 0, pages - 1);
    rows.slice(this.sellPage * PAGE, (this.sellPage + 1) * PAGE).forEach((row, i) => {
      const y = Y + 140 + i * ROW;
      const item = getItem(row.id);
      const sellMark = sellMarkOf(sellList, row.id);
      // Rámeček a „!“ jako u nákupu; stav úkolu (prodáno / potřeba) na řádku s cenou.
      if (sellMark) this.layer.add(questMarkObjects(this, SELL.x + 10, y - 2, SELL.w - 20, ROW - 4, { quests: [] }, cardText).objects);
      shopItemHover(this, this.layer, row.id, SELL.x + 20, y, SELL.w - 40 - SELL_BUTTONS_W, ROW - 6);
      this.icon(row.id, SELL.x + 44, y + 28, 40);
      const color = (RARITY[item?.rarity] ?? RARITY.common).color;
      const name = cardText(this, SELL.x + 76, y + 4, `${item?.name ?? row.id} ×${row.qty}`, { size: 20, bold: true, color });
      // Dlouhý název: zmenšit nejvýš na 85 %, zbytek zkrátit „…“ (jinak by byl nečitelně malý).
      if (name.width > 150) name.setScale(Math.max(0.85, 150 / name.width));
      const base = item?.name ?? row.id;
      for (let cut = base.length - 1; name.displayWidth > 150 && cut > 3; cut--) name.setText(`${base.slice(0, cut).trimEnd()}… ×${row.qty}`);
      this.layer.add(name);
      // Předmět pro úkol: upozornění (prodat jde, ale úkol pak chybí).
      const note = sellMark ? ` · úkol ${Math.min(sellMark.need, sellMark.have)}/${sellMark.need}` : needed.has(row.id) ? ' · pro úkol' : '';
      this.layer.add(coinAmount(this, SELL.x + 76, y + 34, this.cart.sellUnit(row.price), { size: 17, color: note ? '#ffd76a' : '#b8a890' }, { rest: `/ ks${note}` }));
      this.layer.add(sellButtons(this, this.cart, { x: SELL.x + SELL.w - 20 - SELL_BUTTONS_W, y: y + 4, h: 56, itemId: row.id, qty: row.qty, onSell: (n) => this.addSell(row, n) }));
    });
    this.pager(SELL.x + 20, Y + H - 170, this.sellPage, pages, (step) => { this.sellPage += step; this.refresh(); });
  }

  // Tlačítko „Filtr: … ▾“ vpravo v nadpisu výkupu; klik rozbalí kategorie s počty kusů.
  renderSellFilter() {
    const label = SELL_FILTERS.find((c) => c.id === this.sellFilter)?.label ?? 'Vše';
    const bw = 250;
    const bx = SELL.x + SELL.w - 20 - bw;
    const button = cardButton(this, null, bx, Y + 86, bw, 54, `Filtr: ${label} ▾`, () => this.toggleFilterMenu(bx, Y + 146, bw), { size: 20 });
    if (this.sellFilter) button.objects[1]?.setColor?.('#ffd76a');
    this.layer.add(button.objects);
    // Úkol chce něco prodat a zvolený filtr to neukazuje samostatně: modrý „?“ na filtru.
    const wanted = this.questSellCategories();
    if (wanted.size && !wanted.has(this.sellFilter)) {
      this.layer.add(cardText(this, bx + 24, Y + 113, '?', { size: 32, bold: true, color: QUEST_MARK_BLUE, originX: 0.5, originY: 0.5, strokeThickness: 5 }));
    }
  }

  toggleFilterMenu(x, y, w) {
    if (this.filterMenu) { this.closeFilterMenu(); return; }
    const rows = this.sellRows();
    const count = (id) => rows.filter((r) => !id || sellCategory(r.id) === id).reduce((sum, r) => sum + r.qty, 0);
    const options = [{ id: null, label: 'Vše' }, ...SELL_FILTERS];
    const wanted = this.questSellCategories();
    const objects = [];
    // Klik mimo nabídku ji zavře.
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.001).setOrigin(0).setInteractive().setDepth(50);
    shade.on('pointerdown', () => this.closeFilterMenu());
    objects.push(shade);
    const bg = this.add.graphics().setDepth(51);
    bg.fillStyle(0x0b1626, 0.97).fillRoundedRect(x - 8, y - 8, w + 16, options.length * 60 + 10, 12).lineStyle(2, 0xd6a23a, 1).strokeRoundedRect(x - 8, y - 8, w + 16, options.length * 60 + 10, 12);
    objects.push(bg);
    options.forEach((opt, i) => {
      const n = count(opt.id);
      const b = cardButton(this, null, x, y + i * 60, w, 54, `${opt.label} (${n})`, () => {
        this.sellFilter = opt.id;
        this.sellPage = 0;
        this.closeFilterMenu();
        this.refresh();
      }, { size: 20, disabled: !n && opt.id !== null });
      if (opt.id === this.sellFilter) b.objects[1]?.setColor?.('#ffd76a');
      // Kategorie s věcí k prodeji pro úkol: modrý „?“.
      if (opt.id && wanted.has(opt.id)) b.objects.push(cardText(this, x + 24, y + i * 60 + 27, '?', { size: 30, bold: true, color: QUEST_MARK_BLUE, originX: 0.5, originY: 0.5, strokeThickness: 5 }));
      for (const o of b.objects) { o.setDepth?.(52); objects.push(o); }
    });
    this.filterMenu = objects;
  }

  closeFilterMenu() {
    for (const o of this.filterMenu ?? []) o.destroy();
    this.filterMenu = null;
  }

  addSell(row, qty) {
    this.cart.addSell(row.id, qty);
    this.messageText.setText('');
    this.refresh();
  }

  // Košík: koupí 1 balení (celé, nebo nic).
  buyOne(good) {
    if (this.state.gold < good.price) return 'gold';
    const left = addItem(this.state, good.id, good.qty);
    if (left > 0) {
      if (left < good.qty) removeItem(this.state, good.id, good.qty - left);
      return 'full';
    }
    this.state.gold -= good.price;
    return 'ok';
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    SaveSystem.save(this.state);
    this.scene.stop();
    this.scene.resume(this.returnScene);
  }
}
