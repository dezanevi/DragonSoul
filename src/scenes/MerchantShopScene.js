import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem } from '../data/items.js';
import { RARITY } from '../data/fishing.js';
import { MERCHANTS } from '../data/merchants.js';
import { addItem, getItemCount, removeItem, normalizeInventory } from '../systems/InventorySystem.js';
import { itemIconKey } from '../ui/inventorySprites.js';
import { cardText, cardButton, uiWindow, uiTitle, uiSection } from '../ui/fantasyCard.js';
import { questBuyMark } from '../ui/craftLook.js';
import { questShoppingList, questNeededItems } from '../systems/QuestSystem.js';
import { sellPrice } from '../systems/ItemValueSystem.js';

// Obchod obchodníka na tržišti: vlevo nákup (zboží z data/merchants.js), vpravo výkup
// surovin a výrobků z inventáře za polovinu hodnoty (systems/ItemValueSystem.js).
// Obě strany se listují po stránkách.

const W = 1600;
const H = 900;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;
const BUY = { x: X + 20, w: 700 };
const SELL = { x: X + 740, w: W - 760 };
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

    uiWindow(this, X, Y, W, H, { shade: 0.6 });
    uiSection(this, BUY.x, Y + 84, BUY.w, H - 188);
    uiSection(this, SELL.x, Y + 84, SELL.w, H - 188);
    uiTitle(this, X + 36, Y + 24, `${this.merchant.name} – obchod`, { icon: 'coins', size: 34 });
    this.goldText = cardText(this, X + W - 36, Y + 32, '', { size: 24, bold: true, color: '#ffd76a', originX: 1 });
    cardText(this, BUY.x + 20, Y + 98, 'Koupit', { size: 22, bold: true });
    cardText(this, SELL.x + 20, Y + 98, 'Prodat (výkup za polovinu hodnoty)', { size: 22, bold: true });
    this.messageText = cardText(this, X + 36, Y + H - 72, '', { size: 20, color: '#ffd76a', wrap: 900 });
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

  refresh() {
    this.layer.removeAll(true);
    this.goldText.setText(`Zlato: ${this.state.gold} zl`);
    this.renderBuy();
    this.renderSell();
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
      this.layer.add(cardText(this, BUY.x + 88, y + 4, `${item?.name ?? good.id}${good.qty > 1 ? ` (${good.qty} ks)` : ''}`, { size: 21, bold: true, color }));
      this.layer.add(cardText(this, BUY.x + 88, y + 34, `${good.price} zl · máš ${getItemCount(this.state, good.id)}`, { size: 18, color: '#9fb3c8' }));
      this.layer.add(cardButton(this, null, BUY.x + BUY.w - 196, y + 4, 176, 56, 'Koupit', () => this.buy(good), { size: 21, disabled: this.state.gold < good.price }).objects);
    });
    this.pager(BUY.x + 20, Y + H - 170, this.page, pages, (step) => { this.page += step; this.refresh(); });
  }

  // Výkup: předměty z inventáře (souhrnně podle druhu), kromě klíčových.
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
    return rows;
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
      if (name.width > 380) name.setScale(380 / name.width);
      this.layer.add(name);
      // Předmět pro úkol: upozornění (prodat jde, ale úkol pak chybí).
      const note = needed.has(row.id) ? ' · potřebuješ pro úkol' : '';
      this.layer.add(cardText(this, SELL.x + 76, y + 34, `${row.price} zl / ks${note}`, { size: 17, color: note ? '#ffd76a' : '#b8a890' }));
      this.layer.add(cardButton(this, null, SELL.x + SELL.w - 350, y + 4, 150, 56, 'Prodat 1', () => this.sell(row, 1), { size: 20 }).objects);
      this.layer.add(cardButton(this, null, SELL.x + SELL.w - 190, y + 4, 170, 56, 'Prodat vše', () => this.sell(row, row.qty), { size: 20 }).objects);
    });
    this.pager(SELL.x + 20, Y + H - 170, this.sellPage, pages, (step) => { this.sellPage += step; this.refresh(); });
  }

  buy(good) {
    if (this.state.gold < good.price) return;
    const left = addItem(this.state, good.id, good.qty);
    if (left === good.qty) {
      this.messageText.setText('Inventář je plný.');
      return;
    }
    if (left > 0) {
      removeItem(this.state, good.id, good.qty - left); // nekupuj napůl
      this.messageText.setText('Do inventáře se celé balení nevejde.');
      return;
    }
    this.state.gold -= good.price;
    this.messageText.setText(`Koupeno: ${getItem(good.id)?.name ?? good.id}`);
    SaveSystem.save(this.state);
    this.refresh();
  }

  sell(row, qty) {
    let sold = 0;
    for (let i = 0; i < qty; i++) {
      if (!removeItem(this.state, row.id, 1)) break;
      sold += 1;
    }
    if (!sold) return;
    this.state.gold += sold * row.price;
    this.messageText.setText(`Prodáno: ${getItem(row.id)?.name ?? row.id} ×${sold} za ${sold * row.price} zl.`);
    SaveSystem.save(this.state);
    this.refresh();
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    SaveSystem.save(this.state);
    this.scene.stop();
    this.scene.resume(this.returnScene);
  }
}
