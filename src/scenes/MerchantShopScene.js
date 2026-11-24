import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem } from '../data/items.js';
import { RARITY } from '../data/fishing.js';
import { MERCHANTS } from '../data/merchants.js';
import { addItem, getItemCount, removeItem, normalizeInventory } from '../systems/InventorySystem.js';
import { itemIconKey } from '../ui/inventorySprites.js';
import { cardText, cardButton, uiWindow, uiTitle, uiSection } from '../ui/fantasyCard.js';

// Obchod obchodníka na tržišti (jen nákup): zboží z data/merchants.js, listuje se po 8 řádcích.

const W = 1100;
const H = 800;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;
const ROW = 66;
const PAGE = 8;

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
    normalizeInventory(this.state);
    this.state.gold = Math.max(0, Math.floor(Number(this.state.gold) || 0));

    uiWindow(this, X, Y, W, H, { shade: 0.6 });
    uiSection(this, X + 20, Y + 84, W - 40, H - 188);
    uiTitle(this, X + 36, Y + 24, `${this.merchant.name} – obchod`, { icon: 'coins', size: 34 });
    this.goldText = cardText(this, X + W - 36, Y + 32, '', { size: 24, bold: true, color: '#ffd76a', originX: 1 });
    this.messageText = cardText(this, X + 36, Y + H - 72, '', { size: 20, color: '#ffd76a', wrap: 560 });
    this.layer = this.add.container(0, 0);
    cardButton(this, null, X + W - 36 - 220, Y + H - 86, 220, 60, 'Zavřít (ESC)', () => this.close(), { danger: true });

    this.onKey = (event) => {
      if (!event.repeat && event.code === 'Escape') this.close();
    };
    this.time.delayedCall(200, () => this.input.keyboard.on('keydown', this.onKey));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));
    this.refresh();
  }

  refresh() {
    this.layer.removeAll(true);
    this.goldText.setText(`Zlato: ${this.state.gold} zl`);
    const goods = this.merchant.goods;
    const pages = Math.ceil(goods.length / PAGE);
    goods.slice(this.page * PAGE, (this.page + 1) * PAGE).forEach((good, i) => {
      const y = Y + 100 + i * ROW;
      const item = getItem(good.id);
      const key = item?.icon ? itemIconKey(item.icon) : null;
      if (key && this.textures.exists(key)) {
        const image = this.add.image(X + 70, y + 28, key);
        image.setScale(44 / Math.max(image.width, image.height));
        this.layer.add(image);
      }
      const color = (RARITY[item?.rarity] ?? RARITY.common).color;
      this.layer.add(cardText(this, X + 108, y + 4, `${item?.name ?? good.id}${good.qty > 1 ? ` (${good.qty} ks)` : ''}`, { size: 21, bold: true, color }));
      this.layer.add(cardText(this, X + 108, y + 34, `${good.price} zl · máš ${getItemCount(this.state, good.id)}`, { size: 18, color: '#9fb3c8' }));
      this.layer.add(cardButton(this, null, X + W - 230, y + 4, 180, 56, 'Koupit', () => this.buy(good), { size: 21, disabled: this.state.gold < good.price }).objects);
    });
    if (pages > 1) {
      const py = Y + H - 160;
      this.layer.add(cardButton(this, null, X + 40, py, 90, 56, '◀', () => { this.page -= 1; this.refresh(); }, { size: 21, disabled: this.page === 0 }).objects);
      this.layer.add(cardButton(this, null, X + 250, py, 90, 56, '▶', () => { this.page += 1; this.refresh(); }, { size: 21, disabled: this.page >= pages - 1 }).objects);
      this.layer.add(cardText(this, X + 190, py + 28, `${this.page + 1} / ${pages}`, { size: 20, color: '#9fb3c8', originX: 0.5, originY: 0.5 }));
    }
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

  close() {
    if (this.closing) return;
    this.closing = true;
    SaveSystem.save(this.state);
    this.scene.stop();
    this.scene.resume(this.returnScene);
  }
}
