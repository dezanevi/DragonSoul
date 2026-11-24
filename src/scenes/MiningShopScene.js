import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem } from '../data/items.js';
import { RARITY } from '../data/fishing.js';
import { PICKAXES, MINING_TOOLS, MINING_SPECIALIZATIONS, MINING_RULES } from '../data/mining.js';
import { addItem, getItemCount, removeItem, normalizeInventory } from '../systems/InventorySystem.js';
import { normalizeMining, miningLevel, chooseSpecialization } from '../systems/MiningSystem.js';
import { itemIconKey } from '../ui/inventorySprites.js';
import { CARD_GOLD, cardText, cardButton, uiWindow, uiTitle, uiSection } from '../ui/fantasyCard.js';

// Obchod Hornického mistra v kovárně Greenvale. Do dokončení Kovářství prodává krumpáče
// I–III a Důlní podpěru (rudy se neprodávají), vykupuje suroviny z Těžby a mění specializaci.

const W = 1500;
const H = 900;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;

export const GOODS = [
  ...PICKAXES.filter((p) => p.price).map((p) => ({ id: p.id, price: p.price, qty: 1, level: p.level })),
  ...MINING_TOOLS.filter((t) => t.price).map((t) => ({ id: t.id, price: t.price, qty: 1, level: t.level }))
];

export default class MiningShopScene extends Phaser.Scene {
  constructor() {
    super('MiningShop');
  }

  create(data) {
    this.state = data.state;
    this.returnScene = data.returnScene ?? 'Interior';
    this.merchantName = data.merchantName ?? 'Hornický mistr';
    this.closing = false;
    normalizeInventory(this.state);
    normalizeMining(this.state);
    this.state.gold = Math.max(0, Math.floor(Number(this.state.gold) || 0));

    uiWindow(this, X, Y, W, H, { shade: 0.6 });
    uiSection(this, X + 20, Y + 84, 610, H - 188);
    uiSection(this, X + 650, Y + 84, W - 670, H - 188);

    uiTitle(this, X + 36, Y + 24, `${this.merchantName} – obchod`, { icon: 'coins', size: 34 });
    this.goldText = cardText(this, X + W - 36, Y + 32, '', { size: 24, bold: true, color: '#ffd76a', originX: 1 });
    cardText(this, X + 36, Y + 100, 'Koupit (dokud krumpáče nevyrábí Kovářství)', { size: 22, bold: true });
    cardText(this, X + 36, Y + 440, 'Specializace Těžby', { size: 22, bold: true });
    cardText(this, X + 680, Y + 100, 'Prodat (suroviny z Těžby)', { size: 22, bold: true });
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

    GOODS.forEach((good, index) => {
      const y = Y + 140 + index * 64;
      const item = getItem(good.id);
      this.icon(good.id, X + 60, y + 26);
      this.layer.add(cardText(this, X + 92, y + 6, item.name, { size: 20, bold: true }));
      this.layer.add(cardText(this, X + 92, y + 32, `${good.price} zl · Těžba ${good.level}+ · máš ${getItemCount(this.state, good.id)}`, { size: 16, color: '#b8a890' }));
      this.layer.add(cardButton(this, null, X + 500, y + 8, 110, 44, 'Koupit', () => this.buy(good), { size: 18, disabled: this.state.gold < good.price }).objects);
    });

    // Specializace: od Těžby 25, první volba zdarma, změna 250 zl.
    const current = this.state.mining.specialization;
    const level = miningLevel(this.state);
    const cost = current ? MINING_RULES.specializationChangeCost : 0;
    this.layer.add(cardText(this, X + 36, Y + 474,
      level < MINING_RULES.specializationLevel
        ? `Odemkne se na Těžbě ${MINING_RULES.specializationLevel} (máš ${level}).`
        : current ? `Změna stojí ${cost} zl.` : 'První volba je zdarma.',
      { size: 16, color: '#b8a890' }));
    MINING_SPECIALIZATIONS.forEach((spec, index) => {
      const y = Y + 506 + index * 92;
      const active = current === spec.id;
      this.layer.add(cardText(this, X + 36, y, `${spec.name}${active ? '  (aktivní)' : ''}`, { size: 19, bold: true, color: active ? '#7fd67a' : '#f3e4bd' }));
      this.layer.add(cardText(this, X + 36, y + 26, spec.text, { size: 14, color: '#b8a890', wrap: 450 }));
      this.layer.add(cardButton(this, null, X + 500, y + 4, 110, 44, active ? 'Zvoleno' : 'Zvolit', () => this.choose(spec.id),
        { size: 17, disabled: active || level < MINING_RULES.specializationLevel || this.state.gold < cost }).objects);
    });

    // Výkup: všechno z Těžby, co má cenu (souhrnně podle druhu).
    const owned = [];
    for (const slot of this.state.inventory.slots) {
      if (!slot) continue;
      const item = getItem(slot.id);
      if (!item?.mining || !item.price) continue;
      const row = owned.find((o) => o.id === slot.id);
      if (row) row.qty += slot.qty;
      else owned.push({ id: slot.id, qty: slot.qty });
    }
    if (!owned.length) {
      this.layer.add(cardText(this, X + 680, Y + 150, 'Nemáš žádné suroviny z Těžby na prodej.', { size: 19, color: '#9aa4ae' }));
    }
    owned.slice(0, 10).forEach((row, index) => {
      const y = Y + 140 + index * 60;
      const item = getItem(row.id);
      const color = (RARITY[item.rarity] ?? RARITY.common).color;
      this.icon(row.id, X + 704, y + 24);
      this.layer.add(cardText(this, X + 736, y + 4, `${item.name} ×${row.qty}`, { size: 19, bold: true, color }));
      this.layer.add(cardText(this, X + 736, y + 30, `${item.price} zl / ks`, { size: 16, color: '#b8a890' }));
      this.layer.add(cardButton(this, null, X + 1110, y + 6, 150, 44, 'Prodat 1', () => this.sell(row.id, 1), { size: 17 }).objects);
      this.layer.add(cardButton(this, null, X + 1272, y + 6, 180, 44, 'Prodat vše', () => this.sell(row.id, row.qty), { size: 17 }).objects);
    });
  }

  buy(good) {
    if (this.state.gold < good.price) return;
    const left = addItem(this.state, good.id, good.qty);
    if (left > 0) {
      if (left < good.qty) removeItem(this.state, good.id, good.qty - left);
      this.messageText.setText('Inventář je plný.');
      return;
    }
    this.state.gold -= good.price;
    this.messageText.setText(`Koupeno: ${getItem(good.id).name}`);
    SaveSystem.save(this.state);
    this.refresh();
  }

  choose(id) {
    const result = chooseSpecialization(this.state, id);
    this.messageText.setText(result.message);
    if (result.ok) SaveSystem.save(this.state);
    this.refresh();
  }

  sell(itemId, qty) {
    const price = getItem(itemId)?.price ?? 0;
    let sold = 0;
    for (let i = 0; i < qty; i++) {
      if (!removeItem(this.state, itemId, 1)) break;
      sold += 1;
    }
    this.state.gold += sold * price;
    this.messageText.setText(`Prodáno za ${sold * price} zl.`);
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
