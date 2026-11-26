import { getItem } from '../data/items.js';
import { itemIconKey } from './inventorySprites.js';
import { cardText, cardButton, coinAmount } from './fantasyCard.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { grantTradeXp } from '../systems/DiplomacySystem.js';

// Košík obchodu (obchodník, Bylinkářka, Rybář, Hornický mistr). Tlačítka v nabídkách jen
// vkládají; košík ukazuje zeleně „+“ co hráč dostane (nákup) a červeně „−“ co odevzdá (prodej),
// dole konečnou sumu (+N / −N) a obchod se provede až „Potvrdit obchod“ (nejdřív prodej, pak
// nákup – co se nevejde do inventáře, se nekoupí). Zavření okna košík zahodí.
//
// opts:
//   sellValue(id, qty)  – kolik dostane za qty kusů (bere v úvahu denní poptávku apod.)
//   sellOne(id)         – odebere 1 kus z inventáře a vrátí výdělek (null = kus už není);
//                         zlato připíše košík
//   buyOne(good)        – koupí 1 balení: 'ok' | 'full' | 'gold'; zlato strhává sám
//   onDone(text)        – zpráva po obchodu (scéna ji ukáže a překreslí)
// good = { id, price, qty } (qty = kusů v balení).

const GREEN = '#7fe08a';
const RED = '#ff8a7a';
const ROW = 66;

export class ShopCart {
  constructor(scene, state, opts) {
    this.scene = scene;
    this.state = state;
    this.opts = opts;
    this.buy = new Map(); // id → { good, count }
    this.sell = new Map(); // id → kusů
  }

  get empty() {
    return !this.buy.size && !this.sell.size;
  }

  buyCount(id) {
    return this.buy.get(id)?.count ?? 0;
  }

  sellCount(id) {
    return this.sell.get(id) ?? 0;
  }

  buyTotal() {
    let sum = 0;
    for (const { good, count } of this.buy.values()) sum += good.price * count;
    return sum;
  }

  sellTotal() {
    let sum = 0;
    for (const [id, qty] of this.sell) sum += this.opts.sellValue(id, qty);
    return sum;
  }

  // Zlato po provedení obchodu.
  goldAfter() {
    return this.state.gold + this.sellTotal() - this.buyTotal();
  }

  canAddBuy(good) {
    return this.goldAfter() >= good.price;
  }

  addBuy(good) {
    if (!this.canAddBuy(good)) return false;
    const entry = this.buy.get(good.id) ?? { good, count: 0 };
    entry.count += 1;
    this.buy.set(good.id, entry);
    return true;
  }

  addSell(id, qty) {
    if (qty <= 0) return;
    this.sell.set(id, this.sellCount(id) + qty);
  }

  remove(kind, id) {
    if (kind === 'buy') {
      const entry = this.buy.get(id);
      if (entry && --entry.count <= 0) this.buy.delete(id);
    } else {
      const left = this.sellCount(id) - 1;
      if (left > 0) this.sell.set(id, left);
      else this.sell.delete(id);
    }
    // Bez prodeje by se nákup nemusel dát zaplatit – přebytečný nákup ubrat.
    while (this.goldAfter() < 0 && this.buy.size) {
      const [lastId, entry] = [...this.buy].at(-1);
      if (--entry.count <= 0) this.buy.delete(lastId);
    }
  }

  clear() {
    this.buy.clear();
    this.sell.clear();
  }

  confirm() {
    if (this.empty) return;
    const start = this.state.gold;
    let soldCount = 0;
    const soldLines = [];
    for (const [id, qty] of this.sell) {
      let n = 0;
      for (let i = 0; i < qty; i++) {
        const earned = this.opts.sellOne(id);
        if (earned === null) break; // kus už v inventáři není
        soldCount += 1;
        n += 1;
        this.state.gold += earned;
      }
      if (n) soldLines.push({ id, qty: n });
    }
    let bought = 0;
    let full = false;
    const boughtLines = [];
    for (const { good, count } of this.buy.values()) {
      let n = 0;
      for (let i = 0; i < count; i++) {
        const result = this.opts.buyOne(good);
        if (result === 'ok') { bought += 1; n += 1; }
        else {
          if (result === 'full') full = true;
          break;
        }
      }
      if (n) boughtLines.push({ id: good.id, qty: n * (good.qty ?? 1) });
    }
    this.clear();
    // Diplomacie: XP za uskutečněný obchod (za položku, ne za kus; opakování slábne).
    const xp = (grantTradeXp(this.state, soldLines, 'npcSell')?.gained ?? 0) + (grantTradeXp(this.state, boughtLines, 'npcBuy')?.gained ?? 0);
    const diff = this.state.gold - start;
    const parts = [];
    if (bought) parts.push(`koupeno ${bought}×`);
    if (soldCount) parts.push(`prodáno ${soldCount} ks`);
    const money = diff ? ` (${diff > 0 ? '+' : '−'}${Math.abs(diff)} zlata)` : '';
    SaveSystem.save(this.state);
    this.opts.onDone(`Obchod proveden: ${parts.join(', ') || 'nic'}${money}.${xp ? ` +${xp} XP Diplomacie.` : ''}${full ? ' Část nákupu se nevešla do inventáře.' : ''}`);
  }

  // Sloupec košíku do vrstvy layer v oblasti area { x, y, w, h } (y = horní okraj sekce).
  // refresh() = překreslení scény po změně.
  render(layer, area, refresh) {
    const { scene } = this;
    const rowsMax = Math.max(1, Math.floor((area.h - 240) / ROW));
    layer.add(cardText(scene, area.x + 20, area.y + 14, 'Košík', { size: 22, bold: true }));
    const lines = [
      ...[...this.buy.values()].map(({ good, count }) => ({
        kind: 'buy', id: good.id, label: `${getItem(good.id)?.name ?? good.id} ×${count * (good.qty ?? 1)}`, amount: -good.price * count
      })),
      ...[...this.sell].map(([id, qty]) => ({ kind: 'sell', id, label: `${getItem(id)?.name ?? id} ×${qty}`, amount: this.opts.sellValue(id, qty) }))
    ];
    const top = area.y + 56;
    if (!lines.length) {
      layer.add(cardText(scene, area.x + 20, top + 10, 'Košík je prázdný.\nVyber, co chceš koupit\nnebo prodat.', { size: 20, color: '#9aa4ae', lineSpacing: 8 }));
    }
    lines.slice(0, rowsMax).forEach((line, i) => {
      const y = top + i * ROW;
      const color = line.kind === 'buy' ? GREEN : RED;
      const item = getItem(line.id);
      const key = item?.icon ? itemIconKey(item.icon) : null;
      if (key && scene.textures.exists(key)) {
        const image = scene.add.image(area.x + 40, y + 28, key);
        image.setScale(38 / Math.max(image.width, image.height));
        layer.add(image);
      }
      const name = cardText(scene, area.x + 70, y + 6, `${line.kind === 'buy' ? '+' : '−'} ${line.label}`, { size: 19, bold: true, color });
      if (name.width > area.w - 160) name.setScale((area.w - 160) / name.width);
      layer.add(name);
      const money = line.amount >= 0 ? `+${line.amount}` : `−${Math.abs(line.amount)}`;
      layer.add(coinAmount(scene, area.x + 70, y + 36, money, { size: 17, color: line.amount >= 0 ? GREEN : RED }));
      layer.add(cardButton(scene, null, area.x + area.w - 82, y + 4, 62, 56, '−', () => { this.remove(line.kind, line.id); refresh(); }, { size: 24 }).objects);
    });
    if (lines.length > rowsMax) {
      layer.add(cardText(scene, area.x + 20, top + rowsMax * ROW, `… a ${lines.length - rowsMax} dalších`, { size: 18, color: '#9fb3c8' }));
    }

    // Konečná suma: kladná = dostaneš zlato, záporná = zaplatíš.
    const total = this.sellTotal() - this.buyTotal();
    const sy = area.y + area.h - 150;
    const g = scene.add.graphics();
    g.lineStyle(1.5, 0xd6a23a, 0.6).lineBetween(area.x + 16, sy - 12, area.x + area.w - 16, sy - 12);
    layer.add(g);
    layer.add(cardText(scene, area.x + 20, sy, 'Celkem', { size: 24, bold: true }));
    const sum = total > 0 ? `+${total}` : total < 0 ? `−${Math.abs(total)}` : '0';
    layer.add(coinAmount(scene, area.x + area.w - 24, sy, sum, { size: 26, bold: true, color: total > 0 ? GREEN : total < 0 ? RED : '#f3e4bd', originX: 1 }));
    const empty = this.empty;
    layer.add(cardButton(scene, null, area.x + 16, area.y + area.h - 80, area.w - 228, 58, 'Potvrdit obchod', () => this.confirm(), { size: 21, disabled: empty }).objects);
    layer.add(cardButton(scene, null, area.x + area.w - 202, area.y + area.h - 80, 186, 58, 'Vyprázdnit', () => { this.clear(); refresh(); }, { size: 20, disabled: empty }).objects);
  }
}
