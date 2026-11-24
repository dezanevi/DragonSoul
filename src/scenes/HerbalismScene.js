import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem } from '../data/items.js';
import { RARITY } from '../data/fishing.js';
import { HERB_BY_ID, HERB_RARITY, HERB_SPECIALIZATIONS, HERB_TIER_LABEL, BIOMES, herbClass } from '../data/herbalism.js';
import {
  normalizeHerbalism, herbSiteById, checkHerbSite, herbSiteStatus, bestSickle, herbSeconds, herbYieldRange, herbExtraChance,
  herbSideChance, herbRareChances, harvestHerbSite, formatHerbWait, herbSpecialization, siteMain, seedBed
} from '../systems/HerbalismSystem.js';
import { getItemCount, removeItem } from '../systems/InventorySystem.js';
import { cardText, cardButton, uiWindow, uiTitle, uiProgressBar } from '../ui/fantasyCard.js';
import { openLoot } from './LootScene.js';

// Okno naleziště Sběru bylin (E u zeleného kruhu ve světě). Bez minihry: Sbírat → ukazatel
// 2–5 s → kořist v okně kořisti (vzít vybrané / vše / nic). ESC zavře; přerušený sběr nic nestojí.

const W = 980;
const H = 720;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;

const pct = (value) => {
  const p = value * 100;
  if (p <= 0) return '0 %';
  return `${(p >= 1 ? p.toFixed(p >= 10 ? 0 : 1) : p.toFixed(2)).replace('.', ',')} %`;
};
const itemName = (id) => getItem(id)?.name ?? HERB_BY_ID[id]?.name ?? id;
const rarityColor = (id) => (RARITY[getItem(id)?.rarity] ?? RARITY.common).color;

export default class HerbalismScene extends Phaser.Scene {
  constructor() {
    super('Herbalism');
  }

  create(data) {
    this.state = data.state;
    this.returnScene = data.returnScene ?? 'World';
    this.site = herbSiteById(data.siteId);
    this.region = data.region ?? 'Greenvale';
    this.closing = false;
    this.working = null;
    normalizeHerbalism(this.state);
    if (!this.site) {
      this.close();
      return;
    }

    uiWindow(this, X, Y, W, H, { shade: 0.45 });
    const s = this.site;
    uiTitle(this, X + 36, Y + 24, s.name, { icon: 'herbs', size: 34 });
    cardText(this, X + 36, Y + 72,
      `${s.region} · ${BIOMES[s.biome]} · Sběr bylin ${s.minLevel}+ · srp ${HERB_TIER_LABEL[s.tier]}`,
      { size: 19, color: '#d9b98a' });
    this.levelText = cardText(this, X + W - 36, Y + 30, '', { size: 19, color: '#f1dcc0', originX: 1 });
    this.gearText = cardText(this, X + 36, Y + 110, '', { size: 19, color: '#f3e4bd', lineSpacing: 6 });
    this.tableLayer = this.add.container(0, 0);

    this.reasonText = cardText(this, GAME_WIDTH / 2, Y + H - 150, '', { size: 20, color: '#ff9a8a', originX: 0.5, wrap: W - 80 });
    this.bar = uiProgressBar(this, GAME_WIDTH / 2 - (W - 380) / 2 - 40, Y + H - 118, W - 380, 18, 0x7fd67a);
    this.bar.setVisible(false);
    this.workText = cardText(this, GAME_WIDTH / 2, Y + H - 150, '', { size: 20, color: '#f1dcc0', originX: 0.5 });

    this.harvestButton = cardButton(this, null, X + 36, Y + H - 86, 280, 62, 'Sbírat (mezerník)', () => this.start());
    // Záhon statku: osetí Vzácnými semeny (2 h neobvyklá rostlina).
    this.seedButton = s.cultivated
      ? cardButton(this, null, X + 336, Y + H - 86, 300, 62, 'Zasít Vzácná semena', () => this.seed())
      : null;
    cardButton(this, null, X + W - 36 - 220, Y + H - 86, 220, 62, 'Zavřít (ESC)', () => this.close(), { danger: true });

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
    this.tableLayer.add(cardText(this, x, y, text, { size: 19, ...options }));
  }

  refresh() {
    const prof = this.state.professions.herbalism;
    const spec = HERB_SPECIALIZATIONS.find((sp) => sp.id === herbSpecialization(this.state));
    this.levelText.setText(`Sběr bylin úr. ${prof.level} (${herbClass(prof.level).id})  ·  ${prof.exp} / ${prof.next} XP`);
    const sickle = bestSickle(this.state);
    this.gearText.setText(`Srp: ${sickle?.name ?? '— chybí —'}${spec ? `   ·   Specializace: ${spec.name}` : ''}\n` +
      `Doba sběru: ${herbSeconds(this.state, this.site).toFixed(1).replace('.', ',')} s`);

    this.tableLayer.removeAll(true);
    const s = this.site;
    let y = Y + 188;
    if (s.special) {
      this.line(X + 36, y, `Tahy: ${s.draws}${s.guaranteed ? ` + jistá ${itemName(s.guaranteed)}` : ''}`, { bold: true });
      y += 36;
      const total = Object.values(s.table).reduce((a, b) => a + b, 0);
      for (const [id, weight] of Object.entries(s.table)) {
        const herb = HERB_BY_ID[id];
        const locked = herb.level > prof.level;
        this.line(X + 56, y, `${herb.name}${locked ? ` (až od úrovně ${herb.level})` : ''}`, { color: locked ? '#8d8378' : rarityColor(id) });
        this.line(X + 560, y, pct(weight / total), { color: '#cfd6de', originX: 1 });
        y += 30;
      }
      y += 10;
    } else {
      const main = siteMain(this.state, s);
      const herb = HERB_BY_ID[main];
      const [min, max] = herbYieldRange(this.state, s, main);
      this.line(X + 36, y, 'Hlavní rostlina:', { bold: true });
      this.line(X + 250, y, `${herb.name}  ${min}–${max} ks  ·  ${HERB_RARITY[herb.rarity].label}${main !== s.main ? '  (oseto semeny)' : ''}`,
        { color: rarityColor(main), bold: true });
      y += 30;
      this.line(X + 250, y, herb.look, { color: '#cfd6de', size: 17 });
      y += 28;
      const extra = herbExtraChance(this.state, s, main);
      if (extra > 0) {
        this.line(X + 250, y, `Šance na +1 kus: ${pct(extra)}`, { color: '#cfd6de', size: 17 });
        y += 28;
      }
      y += 12;
      if (s.side) {
        const side = HERB_BY_ID[s.side];
        const chance = herbSideChance(this.state, s);
        this.line(X + 36, y, 'Vedlejší rostlina:', { bold: true });
        this.line(X + 250, y, chance > 0 ? `${side.name} – ${pct(chance)}` : `${side.name} – až od úrovně ${side.level} a srpu ${HERB_TIER_LABEL[side.tier]}`,
          { color: chance > 0 ? '#cfd6de' : '#8d8378' });
        y += 40;
      }
      if (s.cultivated) {
        this.line(X + 36, y, 'Záhon statku: obnova 10 min, poloviční XP, bez vzácných nálezů.', { color: '#b8a890', size: 17 });
        y += 32;
      }
    }
    const rare = herbRareChances(this.state, s, siteMain(this.state, s));
    if (rare.length) {
      this.line(X + 36, y, 'Vzácné nálezy:', { bold: true });
      this.line(X + 250, y, rare.map((r) => `${itemName(r.id)} ${pct(r.chance)}`).join(', '), { color: '#c48bff', wrap: W - 300 });
      y += 40;
    }
    if (this.state.herbalism.sites[s.id] > 0) {
      this.line(X + 36, y, `Sebráno: ${this.state.herbalism.sites[s.id]}×`, { color: '#8d8378', size: 17 });
    }

    const check = checkHerbSite(this.state, s);
    this.reasonText.setText(check.ok || this.working ? '' : check.reason);
    this.harvestButton.setDisabled(!check.ok || Boolean(this.working));
    this.harvestButton.setLabel(this.working ? 'Sbíráš…' : 'Sbírat (mezerník)');
    this.seedButton?.setDisabled(Boolean(this.working) || getItemCount(this.state, 'herb_rare_seeds') < 1);
  }

  start() {
    if (this.working || this.closing) return;
    if (!checkHerbSite(this.state, this.site).ok) return;
    this.working = { total: herbSeconds(this.state, this.site) * 1000, elapsed: 0 };
    this.refresh();
  }

  seed() {
    if (this.working || !removeItem(this.state, 'herb_rare_seeds', 1)) return;
    // Neobvyklá rostlina podle záhonu: léčivý záhon → Lesní šalvěj, čistící → Vodní květ, tymián → Horský kořen.
    const herb = { Z01: 'forest_sage', Z02: 'mat_vodni_kvet', Z03: 'mountain_root' }[this.site.id] ?? 'forest_sage';
    seedBed(this.state, this.site.id, herb);
    SaveSystem.save(this.state);
    this.reasonText.setText(`Záhon je osetý – 2 h na něm poroste ${HERB_BY_ID[herb].name}.`).setColor('#7fd67a');
    this.refresh();
  }

  update(time, delta) {
    if (!this.working) return;
    this.working.elapsed += delta;
    const { elapsed, total } = this.working;
    this.bar.setVisible(true).set(Math.min(1, elapsed / total));
    this.workText.setText(`Sbíráš… ${(Math.max(0, total - elapsed) / 1000).toFixed(1).replace('.', ',')} s`);
    if (elapsed >= total) this.finish();
  }

  stopWorking() {
    this.working = null;
    this.bar?.setVisible(false);
    this.workText?.setText('');
  }

  finish() {
    this.stopWorking();
    const result = harvestHerbSite(this.state, this.site, { region: this.region });
    if (!result.ok) {
      this.reasonText.setText(result.reason);
      this.refresh();
      return;
    }
    SaveSystem.save(this.state);
    const lines = [`Sběr bylin: +${result.xp} XP`];
    if (result.firstHerbs.length) lines.push(`Nové v herbáři: ${result.firstHerbs.map(itemName).join(', ')}`);
    if (result.levelsGained > 0) lines.push(`Sběr bylin postoupil na úroveň ${result.level}!`);
    if (result.rare.length) lines.push(`Vzácný nález: ${result.rare.map(itemName).join(', ')}!`);
    if (result.revealedHidden) lines.push('Průzkumník: objevil jsi Skryté lesní naleziště na 30 min.');
    const status = herbSiteStatus(this.state, this.site);
    if (!status.ready && status.until) lines.push(`Naleziště se obnoví za ${formatHerbWait(status.until - Date.now())}.`);
    openLoot(this, {
      state: this.state,
      title: 'Sebráno',
      lines,
      items: result.items,
      onClose: () => {
        SaveSystem.save(this.state);
        this.input.keyboard.resetKeys();
        this.refresh();
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
