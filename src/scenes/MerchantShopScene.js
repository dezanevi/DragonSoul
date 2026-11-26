import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem } from '../data/items.js';
import { RARITY } from '../data/fishing.js';
import { MERCHANTS } from '../data/merchants.js';
import { addItem, getItemCount, removeItem, normalizeInventory } from '../systems/InventorySystem.js';
import { itemIconKey } from '../ui/inventorySprites.js';
import { cardText, cardButton, uiWindow, uiTitle, uiSection, coinAmount } from '../ui/fantasyCard.js';
import { questBuyMark } from '../ui/craftLook.js';
import { questShoppingList, questNeededItems } from '../systems/QuestSystem.js';
import { sellPrice } from '../systems/ItemValueSystem.js';
import { ShopCart } from '../ui/shopCart.js';

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
const SELL = { x: X + 636, w: 640 };
const CART = { x: X + 1292, w: W - 1312 };
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
    cardText(this, SELL.x + 20, Y + 98, 'Prodat (výkup za polovinu hodnoty)', { size: 22, bold: true });
    this.messageText = cardText(this, X + 36, Y + H - 72, '', { size: 20, color: '#ffd76a', wrap: 1100 });
    this.layer = this.add.container(0, 0);
    cardButton(this, null, X + W - 36 - 220, Y + H - 86, 220, 60, 'Zavřít (ESC)', () => this.close(), { danger: true });

    this.onKey = (event) => {
      if (!event.repeat && event.code === 'Escape') this.close();
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
      if (shopping[good.id]) this.layer.add(questBuyMark(this, BUY.x + 10, y - 2, BUY.w - 20, ROW - 4, shopping[good.id], cardText, BUY.x + BUY.w - 214));
      this.icon(good.id, BUY.x + 52, y + 28);
      const color = (RARITY[item?.rarity] ?? RARITY.common).color;
      const name = cardText(this, BUY.x + 88, y + 4, `${item?.name ?? good.id}${good.qty > 1 ? ` (${good.qty} ks)` : ''}`, { size: 21, bold: true, color });
      if (name.width > 300) name.setScale(300 / name.width);
      this.layer.add(name);
      this.layer.add(coinAmount(this, BUY.x + 88, y + 34, good.price, { size: 18, color: '#9fb3c8' }, { rest: `· máš ${getItemCount(this.state, good.id)}` }));
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

  renderSell() {
    const rows = this.sellRows();
    const needed = questNeededItems(this.state);
    if (!rows.length) {
      this.layer.add(cardText(this, SELL.x + 20, Y + 150, 'Nemáš nic na prodej.', { size: 20, color: '#9aa4ae' }));
      return;
    }
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    this.sellPage = Phaser.Math.Clamp(this.sellPage, 0, pages - 1);
    rows.slice(this.sellPage * PAGE, (this.sellPage + 1) * PAGE).forEach((row, i) => {
      const y = Y + 140 + i * ROW;
      const item = getItem(row.id);
      this.icon(row.id, SELL.x + 44, y + 28, 40);
      const color = (RARITY[item?.rarity] ?? RARITY.common).color;
      const name = cardText(this, SELL.x + 76, y + 4, `${item?.name ?? row.id} ×${row.qty}`, { size: 20, bold: true, color });
      if (name.width > 220) name.setScale(220 / name.width);
      this.layer.add(name);
      // Předmět pro úkol: upozornění (prodat jde, ale úkol pak chybí).
      const note = needed.has(row.id) ? ' · pro úkol' : '';
      this.layer.add(coinAmount(this, SELL.x + 76, y + 34, row.price, { size: 17, color: note ? '#ffd76a' : '#b8a890' }, { rest: `/ ks${note}` }));
      this.layer.add(cardButton(this, null, SELL.x + SELL.w - 340, y + 4, 150, 56, 'Prodat 1', () => this.addSell(row, 1), { size: 20 }).objects);
      this.layer.add(cardButton(this, null, SELL.x + SELL.w - 180, y + 4, 160, 56, 'Prodat vše', () => this.addSell(row, row.qty), { size: 20 }).objects);
    });
    this.pager(SELL.x + 20, Y + H - 170, this.sellPage, pages, (step) => { this.sellPage += step; this.refresh(); });
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
