import { getItem } from '../data/items.js';
import { goldText } from './goldText.js';
import { itemIconKey } from './inventorySprites.js';
import { cardText, cardButton, coinAmount } from './fantasyCard.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { grantTradeXp } from '../systems/DiplomacySystem.js';
import { countQuestSales } from '../systems/QuestCounters.js';
import { askQuantity } from './nameInput.js';
import { confirmSpend } from './spendConfirm.js';
import { npcBuyPrice, npcSellPrice, npcSellMultiplier } from '../systems/HeroStatsSystem.js';
import { RARITY } from '../data/fishing.js';
import { describeGearBonus } from '../data/smithing.js';
import { heroStatSuffix } from '../data/heroStatLabels.js';

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

// Tlačítka výkupu u řádku: Prodat 1 · Prodat X (okno s volbou množství) · Prodat vše.
// Zabírají SELL_BUTTONS_W px od x. onSell(qty) vloží qty kusů do košíku.
export const SELL_BUTTONS_W = 384;
export function sellButtons(scene, cart, { x, y, h = 54, itemId, qty, onSell }) {
  const objects = [];
  const name = getItem(itemId)?.name ?? itemId;
  const askX = () => askQuantity(scene, {
    title: `Prodat: ${name}`,
    max: qty,
    initial: Math.min(qty, 1),
    confirmLabel: 'Do košíku (Enter)',
    note: (n) => {
      const value = cart.opts.sellValue;
      if (!value) return '';
      const inCart = cart.sellCount(itemId);
      return `Dostaneš ${value(itemId, inCart + n) - value(itemId, inCart)} zlata`;
    },
    onDone: (n) => { if (n) onSell(n); }
  });
  objects.push(...cardButton(scene, null, x, y, 120, h, 'Prodat 1', () => onSell(1), { size: 20 }).objects);
  objects.push(...cardButton(scene, null, x + 128, y, 120, h, 'Prodat X', askX, { size: 20 }).objects);
  objects.push(...cardButton(scene, null, x + 256, y, 128, h, 'Prodat vše', () => onSell(qty), { size: 20 }).objects);
  return objects;
}

// Souhrn po uzavření obchodu (jako hláška „Úkol dokončen“): uprostřed obrazovky okno
// s koupenými (+) a prodanými (−) předměty, zlatem před → po a XP Diplomacie. Zavře ho
// tlačítko „Rozumím“, Enter, mezerník nebo Esc; do té doby obchod pod ním nereaguje.
export function showTradeSummary(scene, { boughtLines, soldLines, start, end, xp, full }) {
  const W = 760;
  const lines = [
    ...boughtLines.map(({ id, qty }) => ({ text: `+ ${getItem(id)?.name ?? id} ×${qty}`, color: GREEN })),
    ...soldLines.map(({ id, qty }) => ({ text: `− ${getItem(id)?.name ?? id} ×${qty}`, color: RED }))
  ];
  const shown = lines.slice(0, 10);
  const diff = end - start;
  const H = 230 + Math.max(1, shown.length) * 32 + (lines.length > 10 ? 30 : 0) + (xp ? 34 : 0) + (full ? 30 : 0);
  const cx = scene.scale.width / 2;
  const x = cx - W / 2;
  const y = scene.scale.height / 2 - H / 2;
  const layer = scene.add.container(0, 0).setDepth(9500);
  const shade = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x02060a, 0.55).setOrigin(0).setInteractive();
  const g = scene.add.graphics();
  g.fillStyle(0x0d1d33, 0.98).fillRoundedRect(x, y, W, H, 18).lineStyle(4, 0xd6a23a, 1).strokeRoundedRect(x, y, W, H, 18);
  layer.add([shade, g, cardText(scene, cx, y + 24, 'Obchod uzavřen', { size: 32, bold: true, color: '#ffe7ae', originX: 0.5 })]);
  let ly = y + 84;
  if (!shown.length) layer.add(cardText(scene, x + 48, ly, 'Nic se neprodalo ani nekoupilo.', { size: 21, color: '#9fb3c8' }));
  for (const line of shown) {
    layer.add(cardText(scene, x + 48, ly, line.text, { size: 21, bold: true, color: line.color }));
    ly += 32;
  }
  if (!shown.length) ly += 32;
  if (lines.length > 10) { layer.add(cardText(scene, x + 48, ly, `… a ${lines.length - 10} dalších`, { size: 18, color: '#9fb3c8' })); ly += 30; }
  ly += 8;
  const sign = diff > 0 ? `+${diff}` : diff < 0 ? `−${Math.abs(diff)}` : '±0';
  layer.add(coinAmount(scene, x + 48, ly, `${start} → ${end}  (${sign})`, { size: 22, bold: true, color: diff > 0 ? GREEN : diff < 0 ? RED : '#f3e4bd' }, { prefix: 'Zlato:' }));
  ly += 36;
  if (xp) { layer.add(cardText(scene, x + 48, ly, `+${xp} XP Diplomacie`, { size: 20, bold: true, color: '#c9a9ff' })); ly += 34; }
  if (full) layer.add(cardText(scene, x + 48, ly, 'Část nákupu se nevešla do inventáře.', { size: 19, color: '#ffb3a0' }));

  const keyboard = scene.input.keyboard;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    layer.destroy();
  };
  const onKey = (event) => {
    if (['Enter', ' ', 'Escape'].includes(event.key)) { event.preventDefault?.(); event.stopPropagation?.(); close(); }
  };
  window.addEventListener('keydown', onKey, true);
  // Klávesa nesmí zároveň zavřít obchod pod oknem: klávesnice scény chvíli nereaguje.
  if (keyboard) {
    keyboard.enabled = false;
    layer.once('destroy', () => scene.time.delayedCall(150, () => { keyboard.enabled = true; keyboard.resetKeys?.(); }));
  }
  scene.events.once('shutdown', () => window.removeEventListener('keydown', onKey, true));
  const removeCapture = () => window.removeEventListener('keydown', onKey, true);
  layer.once('destroy', removeCapture);
  for (const o of cardButton(scene, null, cx - 130, y + H - 82, 260, 60, 'Rozumím (Enter)', close, { size: 22 }).objects) layer.add(o);
  return { close };
}

// Náhled předmětu v obchodě: najetí myší na ikonu / název ukáže okénko s popisem,
// klik otevře Databázi (karta Dovednosti) nad obchodem – obchod zůstane otevřený
// a po zavření Databáze pokračuje (scéna se jen pozastaví).
export function shopItemHover(scene, layer, itemId, x, y, w, h) {
  const zone = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  zone.on('pointerover', (pointer) => showItemTip(scene, itemId, pointer.x + 18, pointer.y + 18));
  zone.on('pointermove', (pointer) => scene.itemTip?.setPosition(...tipPosition(scene, pointer.x + 18, pointer.y + 18)));
  zone.on('pointerout', () => hideItemTip(scene));
  zone.on('pointerdown', () => {
    hideItemTip(scene);
    SaveSystem.save(scene.state);
    scene.scene.pause();
    scene.scene.launch('Professions', { state: scene.state, returnScene: scene.scene.key, item: itemId });
    scene.scene.bringToTop('Professions');
  });
  zone.once('destroy', () => hideItemTip(scene));
  layer.add(zone);
  // Po návratu z Databáze překreslit (inventář se mohl změnit) – jednou na scénu.
  if (!scene.itemTipResume) {
    scene.itemTipResume = () => scene.refresh?.();
    scene.events.on('resume', scene.itemTipResume);
    scene.events.once('shutdown', () => { scene.events.off('resume', scene.itemTipResume); scene.itemTipResume = null; });
  }
  return zone;
}

const TIP_W = 420;
function tipPosition(scene, px, py) {
  const h = scene.itemTip?.tipHeight ?? 160;
  return [Math.min(px, scene.scale.width - TIP_W - 12), Math.min(py, scene.scale.height - h - 12)];
}

function showItemTip(scene, itemId, px, py) {
  hideItemTip(scene);
  const item = getItem(itemId);
  if (!item) return;
  const tip = scene.add.container(0, 0).setDepth(9400);
  const parts = [cardText(scene, 16, 12, item.name, { size: 22, bold: true, color: RARITY[item.rarity]?.color ?? '#f3e4bd', wrap: TIP_W - 32 })];
  let ty = 12 + parts[0].height + 6;
  const info = [];
  if (item.gear) info.push(`${describeGearBonus(item.gear)}${heroStatSuffix(item.gear.bonus)}`);
  if (item.description) info.push(item.description);
  for (const text of info.filter(Boolean)) {
    const t = cardText(scene, 16, ty, text, { size: 17, color: '#dbe6f3', wrap: TIP_W - 32 });
    parts.push(t);
    ty += t.height + 6;
  }
  const hint = cardText(scene, 16, ty + 4, 'Klik = Databáze (obchod zůstane otevřený)', { size: 15, color: '#ffd76a' });
  parts.push(hint);
  const h = ty + hint.height + 18;
  const g = scene.add.graphics();
  g.fillStyle(0x08111d, 0.97).fillRoundedRect(0, 0, TIP_W, h, 10).lineStyle(2, 0xd6a23a, 0.9).strokeRoundedRect(0, 0, TIP_W, h, 10);
  tip.add([g, ...parts]);
  tip.tipHeight = h;
  scene.itemTip = tip;
  tip.setPosition(...tipPosition(scene, px, py));
}

function hideItemTip(scene) {
  scene.itemTip?.destroy();
  scene.itemTip = null;
}

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

  // Charisma: nákup levnější, výkup dražší (HeroStatsSystem). Ceny v nabídkách obchodů
  // ukazuje scéna přes buyPrice / sellUnit, košík počítá s upravenými cenami.
  buyPrice(price) {
    return npcBuyPrice(this.state, price);
  }

  sellUnit(price) {
    return npcSellPrice(this.state, price);
  }

  sellValueOf(id, qty) {
    const base = this.opts.sellValue(id, qty);
    return base > 0 ? Math.max(1, Math.round(base * npcSellMultiplier(this.state))) : 0;
  }

  buyTotal() {
    let sum = 0;
    for (const { good, count } of this.buy.values()) sum += good.price * count;
    return sum;
  }

  sellTotal() {
    let sum = 0;
    for (const [id, qty] of this.sell) sum += this.sellValueOf(id, qty);
    return sum;
  }

  // Zlato po provedení obchodu.
  goldAfter() {
    return this.state.gold + this.sellTotal() - this.buyTotal();
  }

  canAddBuy(good) {
    return this.goldAfter() >= this.buyPrice(good.price);
  }

  addBuy(good) {
    if (!this.canAddBuy(good)) return false;
    // V košíku je zboží s cenou po Charismatu (buyOne scény strhne tuhle cenu).
    const entry = this.buy.get(good.id) ?? { good: { ...good, price: this.buyPrice(good.price), basePrice: good.price }, count: 0 };
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

  // Potvrdit obchod: když se platí (nákup), nejdřív okno s útratou, pak provést.
  confirm() {
    if (this.empty) return;
    const cost = this.buyTotal();
    if (cost <= 0) { this.execute(); return; }
    const lines = [...this.buy.values()].map(({ good, count }) => `${getItem(good.id)?.name ?? good.id} ×${count * (good.qty ?? 1)} – ${goldText(good.price * count)}`);
    confirmSpend(this.scene, { title: 'Potvrdit nákup', lines, cost, gold: this.state.gold, income: this.sellTotal(), onConfirm: () => this.execute() });
  }

  execute() {
    if (this.empty) return;
    const start = this.state.gold;
    let soldCount = 0;
    let soldGold = 0;
    const soldLines = [];
    for (const [id, qty] of this.sell) {
      let n = 0;
      for (let i = 0; i < qty; i++) {
        const earned = this.opts.sellOne(id);
        if (earned === null) break; // kus už v inventáři není
        soldCount += 1;
        n += 1;
        soldGold += earned;
      }
      if (n) soldLines.push({ id, qty: n });
    }
    // Výkup po Charismatu (zaokrouhleně za celý prodej, stejně jako náhled v košíku).
    if (soldGold > 0) this.state.gold += Math.max(1, Math.round(soldGold * npcSellMultiplier(this.state)));
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
    // Úkoly: prodané kusy (podle předmětu, obchodu a šperky zvlášť).
    countQuestSales(this.state, this.scene.scene?.key, soldLines, (id) => ['ring', 'amulet'].includes(getItem(id)?.slot));
    // Diplomacie: XP za uskutečněný obchod (za položku, ne za kus; opakování slábne).
    const xp = (grantTradeXp(this.state, soldLines, 'npcSell')?.gained ?? 0) + (grantTradeXp(this.state, boughtLines, 'npcBuy')?.gained ?? 0);
    const diff = this.state.gold - start;
    const parts = [];
    if (bought) parts.push(`koupeno ${bought}×`);
    if (soldCount) parts.push(`prodáno ${soldCount} ks`);
    const money = diff ? ` (${diff > 0 ? '+' : '−'}${Math.abs(diff)} zlata)` : '';
    SaveSystem.save(this.state);
    this.opts.onDone(`Obchod proveden: ${parts.join(', ') || 'nic'}${money}.${xp ? ` +${xp} XP Diplomacie.` : ''}${full ? ' Část nákupu se nevešla do inventáře.' : ''}`);
    // Souhrn jako u dokončeného úkolu – hráč ho musí odkliknout.
    showTradeSummary(this.scene, { boughtLines, soldLines, start, end: this.state.gold, xp, full });
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
      ...[...this.sell].map(([id, qty]) => ({ kind: 'sell', id, label: `${getItem(id)?.name ?? id} ×${qty}`, amount: this.sellValueOf(id, qty) }))
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
