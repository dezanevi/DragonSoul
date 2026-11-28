import Phaser from 'phaser';
import { withSpend } from '../ui/spendConfirm.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem } from '../data/items.js';
import { RARITY } from '../data/fishing.js';
import { PICKAXES, MINING_TOOLS, MINING_SPECIALIZATIONS, MINING_RULES } from '../data/mining.js';
import { addItem, getItemCount, removeItem, normalizeInventory } from '../systems/InventorySystem.js';
import { normalizeMining, miningLevel, chooseSpecialization } from '../systems/MiningSystem.js';
import { ShopCart, sellButtons, SELL_BUTTONS_W, shopItemHover } from '../ui/shopCart.js';
import { questSellList } from '../systems/QuestSystem.js';
import { questMarkObjects } from '../ui/craftLook.js';
import { itemIconKey } from '../ui/inventorySprites.js';
import { CARD_GOLD, cardText, cardButton, uiWindow, uiTitle, uiSection, coinAmount } from '../ui/fantasyCard.js';

// Obchod Hornického mistra v kovárně Greenvale. Do dokončení Kovářství prodává krumpáče
// I–III a Důlní podpěru (rudy se neprodávají), vykupuje suroviny z Těžby a mění specializaci.
// Nákup a prodej jde přes košík (ui/shopCart.js).

const W = 1860;
const H = 900;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;

export const GOODS = [
  ...PICKAXES.filter((p) => p.price && !p.starter).map((p) => ({ id: p.id, price: p.price, qty: 1, level: p.level })),
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
    const priceOf = (id) => getItem(id)?.price ?? 0;
    this.cart = new ShopCart(this, this.state, {
      sellValue: (id, qty) => priceOf(id) * qty,
      sellOne: (id) => (removeItem(this.state, id, 1) ? priceOf(id) : null),
      buyOne: (good) => this.buyOne(good),
      onDone: (text) => { this.messageText.setText(text); this.refresh(); }
    });

    uiWindow(this, X, Y, W, H, { shade: 0.6 });
    uiSection(this, X + 20, Y + 84, 610, H - 188);
    uiSection(this, X + 1180, Y + 84, 660, H - 188);
    uiSection(this, X + 650, Y + 84, W - 1350, H - 188);

    uiTitle(this, X + 36, Y + 24, `${this.merchantName} – obchod`, { icon: 'coins', size: 34 });
    this.goldText = cardText(this, X + W - 36, Y + 32, '', { size: 24, bold: true, color: '#ffd76a', originX: 1 });
    cardText(this, X + 36, Y + 100, 'Koupit (dokud krumpáče nevyrábí Kovářství)', { size: 22, bold: true });
    cardText(this, X + 36, Y + 440, 'Specializace Těžby', { size: 22, bold: true });
    cardText(this, X + 1210, Y + 100, 'Prodat (suroviny z Těžby)', { size: 22, bold: true });
    this.messageText = cardText(this, X + 36, Y + H - 72, '', { size: 20, color: '#ffd76a', wrap: 1300 });

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
    this.goldText.setText('');
    this.layer.add(coinAmount(this, X + W - 36, Y + 32, this.state.gold, { size: 24, bold: true, color: '#ffd76a', originX: 1 }, { prefix: 'Zlato:' }));

    GOODS.forEach((good, index) => {
      const y = Y + 140 + index * 64;
      const item = getItem(good.id);
      shopItemHover(this, this.layer, good.id, X + 34, y, 405, 56);
      this.icon(good.id, X + 60, y + 26);
      this.layer.add(cardText(this, X + 92, y + 6, item.name, { size: 20, bold: true }));
      this.layer.add(coinAmount(this, X + 92, y + 32, this.cart.buyPrice(good.price), { size: 16, color: '#b8a890' }, { rest: `· Těžba ${good.level}+ · máš ${getItemCount(this.state, good.id)}` }));
      this.layer.add(cardButton(this, null, X + 446, y + 4, 164, 54, 'Do košíku', () => { this.cart.addBuy(good); this.messageText.setText(''); this.refresh(); }, { size: 20, disabled: !this.cart.canAddBuy(good) }).objects);
    });

    // Specializace: od Těžby 25, první volba zdarma, změna 250 zlata.
    const current = this.state.mining.specialization;
    const level = miningLevel(this.state);
    const cost = current ? MINING_RULES.specializationChangeCost : 0;
    this.layer.add(cardText(this, X + 36, Y + 474,
      level < MINING_RULES.specializationLevel
        ? `Odemkne se na Těžbě ${MINING_RULES.specializationLevel} (máš ${level}).`
        : current ? `Změna stojí ${cost} zlata.` : 'První volba je zdarma.',
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
    for (const row of owned) row.qty -= this.cart.sellCount(row.id);
    owned.splice(0, owned.length, ...owned.filter((row) => row.qty > 0));
    // Suroviny k prodeji pro úkol (Těžba II) nahoře.
    const sellList = questSellList(this.state);
    owned.sort((a, b) => Number(Boolean(sellList[b.id])) - Number(Boolean(sellList[a.id])));
    if (!owned.length) {
      this.layer.add(cardText(this, X + 1210, Y + 150, 'Nemáš žádné suroviny z Těžby na prodej.', { size: 19, color: '#9aa4ae' }));
    }
    owned.slice(0, 10).forEach((row, index) => {
      const y = Y + 140 + index * 60;
      const item = getItem(row.id);
      const color = (RARITY[item.rarity] ?? RARITY.common).color;
      // Surovina k prodeji pro úkol: rámeček s „!“ a „úkol x/y“ na řádku s cenou (jako u nákupu).
      const sellMark = sellList[row.id];
      if (sellMark) this.layer.add(questMarkObjects(this, X + 1198, y - 2, 632, 60, { quests: [] }, cardText).objects);
      shopItemHover(this, this.layer, row.id, X + 1208, y, 1290 - SELL_BUTTONS_W - 686, 56);
      this.icon(row.id, X + 1234, y + 24);
      const name = cardText(this, X + 1266, y + 4, `${item.name} ×${row.qty}`, { size: 19, bold: true, color });
      if (name.width > 160) name.setScale(160 / name.width);
      this.layer.add(name);
      this.layer.add(coinAmount(this, X + 1266, y + 30, this.cart.sellUnit(item.price), { size: 16, color: sellMark ? '#ffd76a' : '#b8a890' }, { rest: sellMark ? `/ ks · úkol ${Math.min(sellMark.need, sellMark.have)}/${sellMark.need}` : '/ ks' }));
      this.layer.add(sellButtons(this, this.cart, { x: X + 1820 - SELL_BUTTONS_W, y: y + 3, itemId: row.id, qty: row.qty, onSell: (n) => this.addSell(row.id, n) }));
    });

    this.cart.render(this.layer, { x: X + 650, y: Y + 84, w: W - 1350, h: H - 188 }, () => this.refresh());
  }

  addSell(itemId, qty) {
    this.cart.addSell(itemId, qty);
    this.messageText.setText('');
    this.refresh();
  }

  // Košík: koupí 1 kus (celý, nebo nic).
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

  choose(id) {
    const cur = this.state.mining?.specialization;
    const cost = cur && cur !== id ? MINING_RULES.specializationChangeCost : 0;
    const name = MINING_SPECIALIZATIONS.find((s) => s.id === id)?.name ?? id;
    withSpend(this, cost, { title: `Změna specializace: ${name}` }, () => this.applyChoice(id));
  }

  applyChoice(id) {
    const result = chooseSpecialization(this.state, id);
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
