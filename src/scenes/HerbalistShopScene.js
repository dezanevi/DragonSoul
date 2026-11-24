import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem } from '../data/items.js';
import { RARITY } from '../data/fishing.js';
import { SICKLES, HERB_SPECIALIZATIONS, HERB_RULES } from '../data/herbalism.js';
import { addItem, getItemCount, removeItem, normalizeInventory } from '../systems/InventorySystem.js';
import {
  normalizeHerbalism, herbLevel, chooseHerbSpecialization, herbalistStock, recordHerbalistSale, wantedHerb
} from '../systems/HerbalismSystem.js';
import { itemIconKey } from '../ui/inventorySprites.js';
import { cardText, cardButton, uiWindow, uiTitle, uiSection } from '../ui/fantasyCard.js';

// Obchod Bylinkářky v Greenvale: omezená denní zásoba běžných bylin (vzácné se neprodávají),
// Zahradnický srp, výkup bylin a vzácných nálezů za polovinu ceny (hledaná bylina dne ×2)
// a specializace Sběru bylin.

const W = 1500;
const H = 900;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;

const sellPrice = (itemId, wanted) => {
  const base = Math.max(1, Math.floor((getItem(itemId)?.price ?? 0) / 2));
  return itemId === wanted ? base * 2 : base;
};

export default class HerbalistShopScene extends Phaser.Scene {
  constructor() {
    super('HerbalistShop');
  }

  create(data) {
    this.state = data.state;
    this.returnScene = data.returnScene ?? 'Interior';
    this.merchantName = data.merchantName ?? 'Bylinkářka';
    this.closing = false;
    normalizeInventory(this.state);
    normalizeHerbalism(this.state);
    this.state.gold = Math.max(0, Math.floor(Number(this.state.gold) || 0));

    uiWindow(this, X, Y, W, H, { shade: 0.6 });
    uiSection(this, X + 20, Y + 84, 610, H - 188);
    uiSection(this, X + 650, Y + 84, W - 670, H - 188);

    uiTitle(this, X + 36, Y + 24, `${this.merchantName} – obchod`, { icon: 'herbs', size: 34 });
    this.goldText = cardText(this, X + W - 36, Y + 32, '', { size: 24, bold: true, color: '#ffd76a', originX: 1 });
    cardText(this, X + 36, Y + 100, 'Koupit (zásoba na dnešek)', { size: 22, bold: true });
    cardText(this, X + 36, Y + 432, 'Specializace Sběru bylin', { size: 22, bold: true });
    cardText(this, X + 680, Y + 100, 'Prodat (byliny a vzácné nálezy)', { size: 22, bold: true });
    this.messageText = cardText(this, GAME_WIDTH / 2, Y + H - 140, '', { size: 21, color: '#ffd76a', originX: 0.5 });

    this.layer = this.add.container(0, 0);
    cardButton(this, null, X + W - 36 - 220, Y + H - 86, 220, 62, 'Zavřít (ESC)', () => this.close(), { danger: true });

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

    // Nákup: denní zásoba bylin + Zahradnický srp.
    const sickle = SICKLES[0];
    const goods = [
      ...herbalistStock(this.state).map((s) => ({ id: s.id, price: s.price, left: s.left, note: `zbývá dnes ${s.left} ks` })),
      { id: sickle.id, price: sickle.price, left: Infinity, note: `Sběr bylin ${sickle.level}+ · máš ${getItemCount(this.state, sickle.id)}` }
    ];
    goods.forEach((good, index) => {
      const y = Y + 140 + index * 58;
      this.icon(good.id, X + 60, y + 26);
      this.layer.add(cardText(this, X + 92, y + 4, getItem(good.id).name, { size: 21, bold: true }));
      this.layer.add(cardText(this, X + 92, y + 32, `${good.price} zl · ${good.note}`, { size: 17, color: '#b8a890' }));
      this.layer.add(cardButton(this, null, X + 470, y + 2, 140, 54, 'Koupit', () => this.buy(good),
        { size: 20, disabled: this.state.gold < good.price || good.left <= 0 }).objects);
    });

    // Specializace: od úrovně 25, první volba zdarma, změna 250 zl.
    const current = this.state.herbalism.specialization;
    const level = herbLevel(this.state);
    const cost = current ? HERB_RULES.specializationChangeCost : 0;
    this.layer.add(cardText(this, X + 36, Y + 464,
      level < HERB_RULES.specializationLevel
        ? `Odemkne se na Sběru bylin ${HERB_RULES.specializationLevel} (máš ${level}).`
        : current ? `Změna stojí ${cost} zl.` : 'První volba je zdarma.',
      { size: 17, color: '#b8a890' }));
    HERB_SPECIALIZATIONS.forEach((spec, index) => {
      const y = Y + 488 + index * 96;
      const active = current === spec.id;
      this.layer.add(cardText(this, X + 36, y, `${spec.name}${active ? '  (aktivní)' : ''}`, { size: 20, bold: true, color: active ? '#7fd67a' : '#f3e4bd' }));
      this.layer.add(cardText(this, X + 36, y + 28, spec.text, { size: 15, color: '#b8a890', wrap: 420, lineSpacing: 2 }));
      this.layer.add(cardButton(this, null, X + 470, y + 2, 140, 54, active ? 'Zvoleno' : 'Zvolit', () => this.choose(spec.id),
        { size: 20, disabled: active || level < HERB_RULES.specializationLevel || this.state.gold < cost }).objects);
    });

    // Výkup: rostliny a vzácné nálezy Sběru bylin (souhrnně podle druhu).
    const wanted = wantedHerb();
    this.layer.add(cardText(this, X + 680, Y + 134, `Dnes hledám: ${getItem(wanted)?.name ?? wanted} (dvojnásobná cena)`, { size: 18, color: '#7fd67a' }));
    const owned = [];
    for (const slot of this.state.inventory.slots) {
      if (!slot) continue;
      const item = getItem(slot.id);
      if (!item?.herbal || !item.price) continue;
      const row = owned.find((o) => o.id === slot.id);
      if (row) row.qty += slot.qty;
      else owned.push({ id: slot.id, qty: slot.qty });
    }
    if (!owned.length) {
      this.layer.add(cardText(this, X + 680, Y + 180, 'Nemáš žádné byliny na prodej.', { size: 20, color: '#9aa4ae' }));
    }
    owned.slice(0, 9).forEach((row, index) => {
      const y = Y + 172 + index * 62;
      const item = getItem(row.id);
      const color = (RARITY[item.rarity] ?? RARITY.common).color;
      this.icon(row.id, X + 704, y + 26);
      this.layer.add(cardText(this, X + 736, y + 4, `${item.name} ×${row.qty}`, { size: 20, bold: true, color }));
      this.layer.add(cardText(this, X + 736, y + 32, `${sellPrice(row.id, wanted)} zl / ks`, { size: 17, color: '#b8a890' }));
      this.layer.add(cardButton(this, null, X + 1090, y + 2, 160, 54, 'Prodat 1', () => this.sell(row.id, 1), { size: 20 }).objects);
      this.layer.add(cardButton(this, null, X + 1262, y + 2, 190, 54, 'Prodat vše', () => this.sell(row.id, row.qty), { size: 20 }).objects);
    });
  }

  buy(good) {
    if (this.state.gold < good.price || good.left <= 0) return;
    const left = addItem(this.state, good.id, 1);
    if (left > 0) {
      this.messageText.setText('Inventář je plný.');
      return;
    }
    this.state.gold -= good.price;
    if (Number.isFinite(good.left)) recordHerbalistSale(this.state, good.id, 1);
    this.messageText.setText(`Koupeno: ${getItem(good.id).name}`);
    SaveSystem.save(this.state);
    this.refresh();
  }

  choose(id) {
    const result = chooseHerbSpecialization(this.state, id);
    this.messageText.setText(result.message);
    if (result.ok) SaveSystem.save(this.state);
    this.refresh();
  }

  sell(itemId, qty) {
    const price = sellPrice(itemId, wantedHerb());
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
