import Phaser from 'phaser';
import { withSpend } from '../ui/spendConfirm.js';
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
import { cardText, cardButton, uiWindow, uiTitle, uiSection, coinAmount } from '../ui/fantasyCard.js';
import { questBuyMark } from '../ui/craftLook.js';
import { questShoppingList, questSellList } from '../systems/QuestSystem.js';
import { questMarkObjects } from '../ui/craftLook.js';
import { ShopCart, sellButtons, SELL_BUTTONS_W, shopItemHover } from '../ui/shopCart.js';

// Obchod Bylinkářky v Greenvale: omezená denní zásoba běžných bylin (vzácné se neprodávají),
// Zahradnický srp, výkup bylin a vzácných nálezů za polovinu ceny (hledaná bylina dne ×2)
// a specializace Sběru bylin. Nákup a prodej jde přes košík (ui/shopCart.js).

const W = 1860;
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
    this.cart = new ShopCart(this, this.state, {
      sellValue: (id, qty) => sellPrice(id, wantedHerb()) * qty,
      sellOne: (id) => (removeItem(this.state, id, 1) ? sellPrice(id, wantedHerb()) : null),
      buyOne: (good) => this.buyOne(good),
      onDone: (text) => { this.messageText.setText(text); this.refresh(); }
    });

    uiWindow(this, X, Y, W, H, { shade: 0.6 });
    uiSection(this, X + 20, Y + 84, 610, H - 188);
    uiSection(this, X + 1180, Y + 84, 660, H - 188);
    uiSection(this, X + 650, Y + 84, W - 1350, H - 188);

    uiTitle(this, X + 36, Y + 24, `${this.merchantName} – obchod`, { icon: 'herbs', size: 34 });
    this.goldText = cardText(this, X + W - 36, Y + 32, '', { size: 24, bold: true, color: '#ffd76a', originX: 1 });
    cardText(this, X + 36, Y + 100, 'Koupit (zásoba na dnešek)', { size: 22, bold: true });
    cardText(this, X + 36, Y + 432, 'Specializace Sběru bylin', { size: 22, bold: true });
    cardText(this, X + 1210, Y + 100, 'Prodat (byliny a vzácné nálezy)', { size: 22, bold: true });
    this.messageText = cardText(this, X + 36, Y + H - 72, '', { size: 20, color: '#ffd76a', wrap: 1300 });

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
    this.goldText.setText('');
    this.layer.add(coinAmount(this, X + W - 36, Y + 32, this.state.gold, { size: 24, bold: true, color: '#ffd76a', originX: 1 }, { prefix: 'Zlato:' }));

    // Nákup: denní zásoba bylin + Zahradnický srp.
    const sickle = SICKLES.find((s) => s.id === 'herb_sickle');
    const goods = [
      ...herbalistStock(this.state).map((s) => ({ id: s.id, price: s.price, left: s.left, note: `zbývá dnes ${s.left} ks` })),
      { id: sickle.id, price: sickle.price, left: Infinity, note: `Sběr bylin ${sickle.level}+ · máš ${getItemCount(this.state, sickle.id)}` }
    ];
    // Předměty pro úkol (např. Léčivé byliny pro Čistou vodu) nahoře a označené.
    const shopping = questShoppingList(this.state);
    goods.sort((a, b) => Number(Boolean(shopping[b.id])) - Number(Boolean(shopping[a.id])));
    goods.forEach((good, index) => {
      const y = Y + 140 + index * 58;
      if (shopping[good.id]) this.layer.add(questBuyMark(this, X + 26, y - 2, 598, 58, shopping[good.id], cardText, X + 428, 170));
      shopItemHover(this, this.layer, good.id, X + 34, y, 400, 54);
      this.icon(good.id, X + 60, y + 26);
      this.layer.add(cardText(this, X + 92, y + 4, getItem(good.id).name, { size: 21, bold: true }));
      this.layer.add(coinAmount(this, X + 92, y + 32, this.cart.buyPrice(good.price), { size: 17, color: '#b8a890' }, { rest: `· ${good.note}` }));
      this.layer.add(cardButton(this, null, X + 440, y + 2, 170, 54, 'Do košíku', () => { this.cart.addBuy({ ...good, qty: 1 }); this.messageText.setText(''); this.refresh(); },
        { size: 20, disabled: !this.cart.canAddBuy(good) || good.left - this.cart.buyCount(good.id) <= 0 }).objects);
    });

    // Specializace: od úrovně 25, první volba zdarma, změna 250 zlata.
    const current = this.state.herbalism.specialization;
    const level = herbLevel(this.state);
    const cost = current ? HERB_RULES.specializationChangeCost : 0;
    this.layer.add(cardText(this, X + 36, Y + 464,
      level < HERB_RULES.specializationLevel
        ? `Odemkne se na Sběru bylin ${HERB_RULES.specializationLevel} (máš ${level}).`
        : current ? `Změna stojí ${cost} zlata.` : 'První volba je zdarma.',
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
    this.layer.add(cardText(this, X + 1210, Y + 134, `Dnes hledám: ${getItem(wanted)?.name ?? wanted} (dvojnásobná cena)`, { size: 18, color: '#7fd67a' }));
    const owned = [];
    for (const slot of this.state.inventory.slots) {
      if (!slot) continue;
      const item = getItem(slot.id);
      if (!item?.herbal || !item.price) continue;
      const row = owned.find((o) => o.id === slot.id);
      if (row) row.qty += slot.qty;
      else owned.push({ id: slot.id, qty: slot.qty });
    }
    for (const row of owned) row.qty -= this.cart.sellCount(row.id);
    owned.splice(0, owned.length, ...owned.filter((row) => row.qty > 0));
    // Byliny k prodeji pro úkol (Byliny II) nahoře.
    const sellList = questSellList(this.state);
    owned.sort((a, b) => Number(Boolean(sellList[b.id])) - Number(Boolean(sellList[a.id])));
    if (!owned.length) {
      this.layer.add(cardText(this, X + 1210, Y + 180, 'Nemáš žádné byliny na prodej.', { size: 20, color: '#9aa4ae' }));
    }
    owned.slice(0, 9).forEach((row, index) => {
      const y = Y + 172 + index * 62;
      const item = getItem(row.id);
      const color = (RARITY[item.rarity] ?? RARITY.common).color;
      // Surovina k prodeji pro úkol: rámeček s „!“ a „úkol x/y“ na řádku s cenou (jako u nákupu).
      const sellMark = sellList[row.id];
      if (sellMark) this.layer.add(questMarkObjects(this, X + 1198, y - 2, 632, 60, { quests: [] }, cardText).objects);
      shopItemHover(this, this.layer, row.id, X + 1208, y, 1290 - SELL_BUTTONS_W - 686, 56);
      this.icon(row.id, X + 1234, y + 26);
      const name = cardText(this, X + 1266, y + 4, `${item.name} ×${row.qty}`, { size: 20, bold: true, color });
      if (name.width > 160) name.setScale(160 / name.width);
      this.layer.add(name);
      this.layer.add(coinAmount(this, X + 1266, y + 32, this.cart.sellUnit(sellPrice(row.id, wanted)), { size: 17, color: sellMark ? '#ffd76a' : '#b8a890' }, { rest: sellMark ? `/ ks · úkol ${Math.min(sellMark.need, sellMark.have)}/${sellMark.need}` : '/ ks' }));
      this.layer.add(sellButtons(this, this.cart, { x: X + 1820 - SELL_BUTTONS_W, y: y + 2, itemId: row.id, qty: row.qty, onSell: (n) => this.addSell(row.id, n) }));
    });

    this.cart.render(this.layer, { x: X + 650, y: Y + 84, w: W - 1350, h: H - 188 }, () => this.refresh());
  }

  addSell(itemId, qty) {
    this.cart.addSell(itemId, qty);
    this.messageText.setText('');
    this.refresh();
  }

  // Košík: koupí 1 kus (denní zásoba se odečte).
  buyOne(good) {
    if (this.state.gold < good.price) return 'gold';
    if (addItem(this.state, good.id, 1) > 0) return 'full';
    this.state.gold -= good.price;
    if (Number.isFinite(good.left)) recordHerbalistSale(this.state, good.id, 1);
    return 'ok';
  }

  choose(id) {
    const cur = this.state.herbalism?.specialization;
    const cost = cur && cur !== id ? HERB_RULES.specializationChangeCost : 0;
    const name = HERB_SPECIALIZATIONS.find((s) => s.id === id)?.name ?? id;
    withSpend(this, cost, { title: `Změna specializace: ${name}` }, () => this.applyChoice(id));
  }

  applyChoice(id) {
    const result = chooseHerbSpecialization(this.state, id);
    this.messageText.setText(result.message);
    if (result.ok) SaveSystem.save(this.state);
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
