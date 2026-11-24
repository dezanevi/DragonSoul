import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem } from '../data/items.js';
import { BAITS, RODS, METAL_PARTS, FISHING_RULES, RARITY } from '../data/fishing.js';
import { addItem, getItemCount, removeItem, normalizeInventory } from '../systems/InventorySystem.js';
import { dailyDemand, sellPrice } from '../systems/FishingSystem.js';
import { STAPLES } from '../data/cooking.js';
import { FISHER_EXTRA_GOODS } from '../data/merchants.js';
import { itemIconKey } from '../ui/inventorySprites.js';
import { CARD_GOLD, cardText, cardButton, uiWindow, uiTitle, uiSection } from '../ui/fantasyCard.js';

// Obchod rybáře v Rybářské chatě: prodej základního náčiní a návnad, výkup ryb
// a vodních surovin za plnou cenu, denní poptávka (jeden druh za 150 %, nejvýš 10 ks).

const W = 1500;
const H = 860;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;

export const GOODS = [
  { id: 'simple_rod', price: RODS.find((r) => r.id === 'simple_rod').price, qty: 1 },
  { id: 'fishing_hook', price: METAL_PARTS.find((m) => m.id === 'fishing_hook').price, qty: 1 },
  ...BAITS.filter((b) => b.price).map((b) => ({ id: b.id, price: b.price, qty: b.pack })),
  // Dřevo prodává každý obchodník (nejde těžit); kuchyňské suroviny zatím jen tady,
  // dokud na tržišti nebude obchodník s potravinami.
  { id: 'wood', price: 2, qty: 1 },
  ...STAPLES.map((s) => ({ id: s.id, price: s.price * 3, qty: 3 }))
];

export default class FishingShopScene extends Phaser.Scene {
  constructor() {
    super('FishingShop');
  }

  create(data) {
    this.state = data.state;
    this.returnScene = data.returnScene ?? 'Interior';
    this.merchantName = data.merchantName ?? 'Rybář';
    this.closing = false;
    normalizeInventory(this.state);
    this.state.gold = Math.max(0, Math.floor(Number(this.state.gold) || 0));

    uiWindow(this, X, Y, W, H, { shade: 0.6 });
    uiSection(this, X + 20, Y + 84, 530, H - 188);
    uiSection(this, X + 570, Y + 84, W - 590, H - 188);

    uiTitle(this, X + 36, Y + 24, `${this.merchantName} – obchod`, { icon: 'coins', size: 34 });
    this.goldText = cardText(this, X + W - 36, Y + 32, '', { size: 24, bold: true, color: '#ffd76a', originX: 1 });
    cardText(this, X + 36, Y + 104, 'Koupit', { size: 24, bold: true });
    cardText(this, X + 600, Y + 104, 'Prodat (ryby a vodní suroviny)', { size: 24, bold: true });
    this.demandText = cardText(this, X + 600, Y + 140, '', { size: 18, color: '#7fd67a' });
    this.messageText = cardText(this, GAME_WIDTH / 2, Y + H - 140, '', { size: 20, color: '#ffd76a', originX: 0.5 });

    this.layer = this.add.container(0, 0);
    cardButton(this, null, X + W - 36 - 200, Y + H - 82, 200, 58, 'Zavřít (ESC)', () => this.close(), { danger: true });

    this.onKey = (event) => {
      if (!event.repeat && event.code === 'Escape') this.close();
    };
    this.time.delayedCall(200, () => this.input.keyboard.on('keydown', this.onKey));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));
    this.refresh();
  }

  icon(itemId, x, y) {
    const item = getItem(itemId);
    if (item?.icon && this.textures.exists(itemIconKey(item.icon))) {
      const image = this.add.image(x, y, itemIconKey(item.icon));
      image.setScale(40 / Math.max(image.width, image.height));
      this.layer.add(image);
    }
  }

  refresh() {
    this.layer.removeAll(true);
    this.goldText.setText(`Zlato: ${this.state.gold} zl`);
    const demand = dailyDemand(this.state);
    const left = Math.max(0, FISHING_RULES.dailyDemandLimit - demand.sold);
    this.demandText.setText(`Dnešní poptávka: ${getItem(demand.id)?.name} za 150 % (zbývá ${left} ks)`);

    // Zboží po 8 řádcích (základní + návnady a pruty z data/merchants.js).
    const all = [...GOODS, ...FISHER_EXTRA_GOODS];
    const pages = Math.ceil(all.length / 8);
    this.page = Phaser.Math.Clamp(this.page ?? 0, 0, pages - 1);
    if (pages > 1) {
      const py = Y + 150 + 8 * 62 + 4;
      this.layer.add(cardButton(this, null, X + 40, py, 90, 54, '◀', () => { this.page -= 1; this.refresh(); }, { size: 21, disabled: this.page === 0 }).objects);
      this.layer.add(cardButton(this, null, X + 430, py, 90, 54, '▶', () => { this.page += 1; this.refresh(); }, { size: 21, disabled: this.page >= pages - 1 }).objects);
      this.layer.add(cardText(this, X + 280, py + 27, `${this.page + 1} / ${pages}`, { size: 20, color: '#9fb3c8', originX: 0.5, originY: 0.5 }));
    }
    all.slice(this.page * 8, (this.page + 1) * 8).forEach((good, index) => {
      const y = Y + 150 + index * 62;
      const item = getItem(good.id);
      this.icon(good.id, X + 60, y + 26);
      this.layer.add(cardText(this, X + 92, y + 6, `${item.name}${good.qty > 1 ? ` (${good.qty} ks)` : ''}`, { size: 20, bold: true }));
      this.layer.add(cardText(this, X + 92, y + 32, `${good.price} zl · máš ${getItemCount(this.state, good.id)}`, { size: 16, color: '#9fb3c8' }));
      const button = cardButton(this, null, X + 420, y + 8, 110, 44, 'Koupit', () => this.buy(good), { size: 18, disabled: this.state.gold < good.price });
      this.layer.add(button.objects);
    });

    // Výkup: všechno z rybolovu, co hráč má (souhrnně podle druhu).
    const owned = [];
    for (const slot of this.state.inventory.slots) {
      if (!slot) continue;
      const item = getItem(slot.id);
      if (!item?.fishing || !item.price) continue;
      const row = owned.find((o) => o.id === slot.id);
      if (row) row.qty += slot.qty;
      else owned.push({ id: slot.id, qty: slot.qty });
    }
    if (!owned.length) {
      this.layer.add(cardText(this, X + 600, Y + 190, 'Nemáš žádné ryby ani vodní suroviny na prodej.', { size: 19, color: '#9aa4ae' }));
    }
    owned.slice(0, 9).forEach((row, index) => {
      const y = Y + 180 + index * 62;
      const item = getItem(row.id);
      const color = (RARITY[item.rarity] ?? RARITY.common).color;
      this.icon(row.id, X + 624, y + 24);
      this.layer.add(cardText(this, X + 656, y + 4, `${item.name} ×${row.qty}`, { size: 19, bold: true, color }));
      this.layer.add(cardText(this, X + 656, y + 30, `${sellPrice(this.state, row.id)} zl / ks`, { size: 16, color: '#9fb3c8' }));
      this.layer.add(cardButton(this, null, X + 1110, y + 6, 150, 44, 'Prodat 1', () => this.sell(row.id, 1), { size: 17 }).objects);
      this.layer.add(cardButton(this, null, X + 1272, y + 6, 180, 44, 'Prodat vše', () => this.sell(row.id, row.qty), { size: 17 }).objects);
    });
  }

  buy(good) {
    if (this.state.gold < good.price) return;
    const left = addItem(this.state, good.id, good.qty);
    if (left === good.qty) {
      this.messageText.setText('Inventář je plný.');
      return;
    }
    if (left > 0) removeItem(this.state, good.id, good.qty - left); // nekupuj napůl
    if (left > 0) {
      this.messageText.setText('Do inventáře se celé balení nevejde.');
      return;
    }
    this.state.gold -= good.price;
    this.messageText.setText(`Koupeno: ${getItem(good.id).name}`);
    SaveSystem.save(this.state);
    this.refresh();
  }

  sell(itemId, qty) {
    let earned = 0;
    for (let i = 0; i < qty; i++) {
      if (!removeItem(this.state, itemId, 1)) break;
      earned += sellPrice(this.state, itemId);
      const demand = dailyDemand(this.state);
      if (demand.id === itemId) demand.sold += 1;
    }
    this.state.gold += earned;
    this.messageText.setText(`Prodáno za ${earned} zl.`);
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
