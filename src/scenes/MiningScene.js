import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem } from '../data/items.js';
import { RARITY } from '../data/fishing.js';
import { DEPOSIT_TYPES, MINING_MATERIAL_BY_ID, MINING_SPECIALIZATIONS, TIER_LABEL, miningClass } from '../data/mining.js';
import {
  normalizeMining, depositById, checkDeposit, depositStatus, bestPickaxe, miningSeconds, yieldRange, extraChance,
  sideChance, availableSides, specialTable, specialDraws, rareFindChances, mineDeposit, formatWait, specialization
} from '../systems/MiningSystem.js';
import { CARD_GOLD, cardText, cardButton, uiWindow, uiTitle, uiProgressBar } from '../ui/fantasyCard.js';
import { openLoot } from './LootScene.js';

// Okno naleziště (E u hnědého kruhu ve světě). Bez minihry: Těžit → ukazatel 3–8 s
// → kořist v okně kořisti (vzít vybrané / vše / nic). ESC zavře; přerušená těžba nic nestojí.

const W = 980;
const H = 720;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;

const pct = (value) => {
  const p = value * 100;
  if (p <= 0) return '0 %';
  return `${(p >= 1 ? p.toFixed(p >= 10 ? 0 : 1) : p.toFixed(2)).replace('.', ',')} %`;
};
const itemName = (id) => getItem(id)?.name ?? id;
const rarityColor = (id) => (RARITY[getItem(id)?.rarity] ?? RARITY.common).color;

export default class MiningScene extends Phaser.Scene {
  constructor() {
    super('Mining');
  }

  create(data) {
    this.state = data.state;
    this.returnScene = data.returnScene ?? 'World';
    this.deposit = depositById(data.depositId);
    this.hidden = Boolean(data.hidden);
    this.region = data.region ?? 'Greenvale';
    this.closing = false;
    this.working = null;
    normalizeMining(this.state);
    if (!this.deposit) {
      this.close();
      return;
    }

    uiWindow(this, X, Y, W, H, { shade: 0.45 });

    const d = this.deposit;
    uiTitle(this, X + 36, Y + 24, this.hidden ? `Skrytá žíla – ${d.name}` : d.name, { icon: 'pickaxe', size: 34 });
    cardText(this, X + 36, Y + 70,
      `${d.region} – ${d.biome} · ${DEPOSIT_TYPES[d.type]} · Těžba ${d.minLevel}+ · krumpáč ${TIER_LABEL[d.tier]}`,
      { size: 18, color: '#d9b98a' });
    this.levelText = cardText(this, X + W - 36, Y + 30, '', { size: 19, color: '#f1dcc0', originX: 1 });
    this.gearText = cardText(this, X + 36, Y + 108, '', { size: 18, color: '#f3e4bd', lineSpacing: 6 });
    this.tableLayer = this.add.container(0, 0);

    this.reasonText = cardText(this, GAME_WIDTH / 2, Y + H - 150, '', { size: 19, color: '#ff9a8a', originX: 0.5, wrap: W - 80 });
    this.bar = uiProgressBar(this, GAME_WIDTH / 2 - (W - 380) / 2 - 40, Y + H - 118, W - 380, 18, 0xd99a4a);
    this.bar.setVisible(false);
    this.workText = cardText(this, GAME_WIDTH / 2, Y + H - 150, '', { size: 20, color: '#f1dcc0', originX: 0.5 });

    this.mineButton = cardButton(this, null, X + 36, Y + H - 82, 260, 58, 'Těžit (mezerník)', () => this.start());
    cardButton(this, null, X + W - 36 - 200, Y + H - 82, 200, 58, 'Zavřít (ESC)', () => this.close(), { danger: true });

    this.onKey = (event) => {
      if (event.repeat) return;
      if (event.code === 'Escape') this.close();
      else if (event.code === 'Space' || event.code === 'KeyE') this.start();
    };
    this.time.delayedCall(200, () => this.input.keyboard.on('keydown', this.onKey));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));

    this.refresh();
  }

  line(x, y, text, options = {}) {
    this.tableLayer.add(cardText(this, x, y, text, { size: 18, ...options }));
  }

  refresh() {
    const prof = this.state.professions.mining;
    const spec = MINING_SPECIALIZATIONS.find((s) => s.id === specialization(this.state));
    this.levelText.setText(`Těžba úr. ${prof.level} (${miningClass(prof.level).id})  ·  ${prof.exp} / ${prof.next} XP`);
    const pick = bestPickaxe(this.state);
    this.gearText.setText(`Krumpáč: ${pick?.name ?? '— chybí —'}${spec ? `   ·   Specializace: ${spec.name}` : ''}\n` +
      `Doba těžby: ${miningSeconds(this.state, this.deposit).toFixed(1).replace('.', ',')} s`);

    this.tableLayer.removeAll(true);
    const d = this.deposit;
    let y = Y + 180;
    if (d.special) {
      this.line(X + 36, y, `Tahy: ${specialDraws(this.state, d)} (každý 1 kus z tabulky)`, { bold: true });
      y += 36;
      for (const row of specialTable(this.state, d).sort((a, b) => b.percent - a.percent)) {
        this.line(X + 56, y, itemName(row.id), { color: rarityColor(row.id) });
        this.line(X + 520, y, pct(row.percent / 100), { color: '#cfd6de', originX: 1 });
        y += 28;
      }
    } else {
      const [min, max] = yieldRange(this.state, d);
      const rolls = this.hidden ? ' ×2 (Skrytá žíla)' : '';
      this.line(X + 36, y, 'Hlavní surovina:', { bold: true });
      this.line(X + 240, y, `${itemName(d.main)}  ${min}–${max} ks${rolls}`, { color: rarityColor(d.main), bold: true });
      y += 30;
      this.line(X + 240, y, `Šance na +1 kus: ${pct(extraChance(this.state, d))}`, { color: '#cfd6de', size: 17 });
      y += 40;
      const sides = availableSides(this.state, d);
      const locked = (d.sides ?? []).filter((id) => !sides.includes(id));
      this.line(X + 36, y, 'Vedlejší nález:', { bold: true });
      this.line(X + 240, y, sides.length
        ? `${this.hidden ? 'jistý' : pct(sideChance(this.state, d))} – ${sides.map(itemName).join(' nebo ')}`
        : '—', { color: '#cfd6de' });
      y += 28;
      if (locked.length) {
        this.line(X + 240, y, `Až s vyšší úrovní: ${locked.map((id) => `${itemName(id)} (${MINING_MATERIAL_BY_ID[id].level})`).join(', ')}`, { color: '#8d8378', size: 16 });
        y += 28;
      }
      y += 12;
    }
    const rare = rareFindChances(this.state, d, { hidden: this.hidden });
    if (rare.length) {
      this.line(X + 36, y, 'Vzácné nálezy:', { bold: true });
      this.line(X + 240, y, rare.map((r) => `${itemName(r.id)} ${pct(r.chance)}`).join(', '), { color: '#c48bff', wrap: W - 290 });
      y += 40;
    }
    if (!this.hidden && !d.special && this.state.mining.log[d.id] > 0) {
      this.line(X + 36, y, `Vytěženo: ${this.state.mining.log[d.id]}×`, { color: '#8d8378', size: 16 });
    }

    const check = checkDeposit(this.state, d, { hidden: this.hidden });
    this.reasonText.setText(check.ok || this.working ? '' : check.reason);
    this.mineButton.setDisabled(!check.ok || Boolean(this.working));
    this.mineButton.setLabel(this.working ? 'Těžíš…' : 'Těžit (mezerník)');
  }

  start() {
    if (this.working || this.closing) return;
    if (!checkDeposit(this.state, this.deposit, { hidden: this.hidden }).ok) return;
    this.working = { total: miningSeconds(this.state, this.deposit) * 1000, elapsed: 0 };
    this.refresh();
  }

  update(time, delta) {
    if (!this.working) return;
    this.working.elapsed += delta;
    const { elapsed, total } = this.working;
    const ratio = Math.min(1, elapsed / total);
    this.bar.setVisible(true).set(ratio);
    this.workText.setText(`Těžíš… ${(Math.max(0, total - elapsed) / 1000).toFixed(1).replace('.', ',')} s`);
    if (elapsed >= total) this.finish();
  }

  stopWorking() {
    this.working = null;
    this.bar?.setVisible(false);
    this.workText?.setText('');
  }

  finish() {
    this.stopWorking();
    const result = mineDeposit(this.state, this.deposit, { hidden: this.hidden, region: this.region });
    if (!result.ok) {
      this.reasonText.setText(result.reason);
      this.refresh();
      return;
    }
    SaveSystem.save(this.state);
    const lines = [`Těžba: +${result.xp} XP`];
    if (result.levelsGained > 0) lines.push(`Těžba postoupila na úroveň ${result.level}!`);
    if (result.rare.length) lines.push(`Vzácný nález: ${result.rare.map(itemName).join(', ')}!`);
    if (result.revealedHidden) lines.push(`Průzkumník: odhalil jsi Skrytou žílu (${depositById(result.revealedHidden.deposit).name}) na 30 min.`);
    const status = depositStatus(this.state, this.deposit);
    if (!this.hidden && !status.ready && status.until) lines.push(`Naleziště se obnoví za ${formatWait(status.until - Date.now())}.`);
    openLoot(this, {
      state: this.state,
      title: 'Vytěženo',
      lines,
      items: result.items,
      onClose: () => {
        SaveSystem.save(this.state);
        this.input.keyboard.resetKeys();
        if (this.hidden) this.close();
        else this.refresh();
      }
    });
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    this.stopWorking?.();
    SaveSystem.save(this.state);
    this.scene.stop();
    this.scene.resume(this.returnScene);
  }
}
