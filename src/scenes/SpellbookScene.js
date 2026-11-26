import Phaser from 'phaser';
import spellRows from '../data/spells.json';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { getSpellManaCost, getEffectiveSpellPower, getSpellDamageMultiplier } from '../systems/TalentSystem.js';
import { cardText, cardButton, uiWindow, uiTitle, uiSection } from '../ui/fantasyCard.js';

// Kniha kouzel (karta hrdiny → tlačítko Kniha kouzel, nebo klik na školu magie): kouzla školy
// seřazená jako v souboji – útočná podle úrovně školy, potom podpůrná. U každého cena many,
// síla, cíle (jeden / více / plocha / všichni / celá parta), živelný efekt a popis.

const W = 1640;
const H = 920;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;

export const SPELL_SCHOOLS = [
  { id: 'fire', name: 'Oheň', role: 'silné útoky', color: '#ff9a5a' },
  { id: 'water', name: 'Voda', role: 'léčení', color: '#7fc8ff' },
  { id: 'earth', name: 'Země', role: 'obrana spojenců', color: '#d8b46a' },
  { id: 'air', name: 'Vzduch', role: 'rychlost', color: '#bff0e8' },
  { id: 'light', name: 'Světlo', role: 'síla a záře', color: '#ffe38a' },
  { id: 'dark', name: 'Temnota', role: 'prokletí', color: '#c9a6ff' }
];
const STATUS_NAMES = { burn: 'spálení', freeze: 'zmrazení', stun: 'omráčení', paralysis: 'paralýza', curse: 'prokletí', poison: 'otrava' };
const STAT_NAMES = { defense: 'Zbroj', speed: 'Tempo', attack: 'Síla' };

export default class SpellbookScene extends Phaser.Scene {
  constructor() {
    super('Spellbook');
  }

  create(data) {
    this.state = data?.state ?? SaveSystem.load();
    this.returnScene = data?.returnScene ?? null;
    this.closing = false;
    if (!this.state) {
      this.close();
      return;
    }
    this.state.spellbook ??= [];
    this.state.magicMastery ??= {};
    this.school = SPELL_SCHOOLS.some((s) => s.id === data?.school) ? data.school : this.firstOpenSchool();

    uiWindow(this, X, Y, W, H, { shade: 0.6 });
    uiTitle(this, X + 36, Y + 22, 'Kniha kouzel', { icon: 'book', size: 34 });
    this.layer = this.add.container(0, 0);
    cardButton(this, null, X + W - 36 - 220, Y + H - 82, 220, 58, 'Zavřít (ESC)', () => this.close(), { danger: true, size: 22 });

    this.onKey = (event) => {
      if (event.repeat) return;
      if (event.code === 'Escape' || event.code === 'KeyK') this.close();
      // Šipky nahoru / dolů = další škola.
      const index = SPELL_SCHOOLS.findIndex((s) => s.id === this.school);
      if (event.code === 'ArrowDown' || event.code === 'ArrowUp') {
        const next = (index + (event.code === 'ArrowDown' ? 1 : SPELL_SCHOOLS.length - 1)) % SPELL_SCHOOLS.length;
        this.school = SPELL_SCHOOLS[next].id;
        this.refresh();
      }
    };
    this.time.delayedCall(200, () => this.input.keyboard.on('keydown', this.onKey));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));
    this.refresh();
  }

  mastery(school) {
    const m = this.state.magicMastery?.[school] ?? {};
    return { level: Number(m.level) || 0, unlocked: m.unlocked !== false && (Number(m.level) || 0) > 0 };
  }

  firstOpenSchool() {
    return SPELL_SCHOOLS.find((s) => this.mastery(s.id).unlocked)?.id ?? 'air';
  }

  text(x, y, value, opts = {}) {
    const t = cardText(this, x, y, value, { size: 20, ...opts });
    if (opts.maxWidth && t.width > opts.maxWidth) t.setScale(opts.maxWidth / t.width);
    this.layer.add(t);
    return t;
  }

  refresh() {
    this.layer.removeAll(true);
    this.text(X + W - 280, Y + 32, `Mana ${this.state.mp ?? 0} / ${this.state.maxMp ?? 0}`, { size: 22, bold: true, color: '#8fd3ff', originX: 1 });

    // Školy vlevo.
    this.layer.add(uiSection(this, X + 20, Y + 84, 330, H - 188));
    SPELL_SCHOOLS.forEach((school, i) => {
      const m = this.mastery(school.id);
      const count = spellRows.filter((s) => s.school === school.id).length;
      const label = `${school.name}\n${m.unlocked ? `úroveň ${m.level} · ${count} kouzel` : 'zamčená škola'}`;
      const b = cardButton(this, null, X + 40, Y + 104 + i * 104, 290, 90, label, () => { this.school = school.id; this.refresh(); },
        { size: 21, active: this.school === school.id });
      for (const o of b.objects) this.layer.add(o);
    });

    // Kouzla vybrané školy vpravo.
    const school = SPELL_SCHOOLS.find((s) => s.id === this.school);
    const m = this.mastery(school.id);
    const left = X + 380;
    const width = W - 400;
    this.layer.add(uiSection(this, X + 370, Y + 84, W - 390, H - 188));
    this.text(left + 10, Y + 98, `${school.name} – ${school.role}`, { size: 28, bold: true, color: school.color });
    this.text(left + width - 20, Y + 104, m.unlocked ? `Úroveň školy ${m.level} / 4` : 'Škola je zamčená – odemkne se v průběhu hry.', { size: 20, color: '#dbe6f3', originX: 1 });

    const spells = spellRows.filter((s) => s.school === school.id);
    const attack = spells.filter((s) => (s.targetType ?? 'enemy') === 'enemy');
    const support = spells.filter((s) => s.targetType === 'ally');
    let y = Y + 146;
    const rowH = 70;
    const section = (title, list) => {
      if (!list.length) return;
      this.text(left + 10, y, title, { size: 21, bold: true, color: '#ffe7ae' });
      y += 34;
      for (const spell of list) {
        this.spellRow(spell, left + 10, y, width - 30, m);
        y += rowH;
      }
      y += 8;
    };
    section('Útočná kouzla (v souboji: Kouzla → škola → cíl)', attack);
    section('Podpůrná kouzla (v souboji: klik na své monstrum)', support);
  }

  spellRow(spell, x, y, w, m) {
    const need = Number(spell.requiredMastery) || 0;
    const known = this.state.spellbook.includes(spell.id);
    const ready = m.unlocked && known && m.level >= need;
    const state = !m.unlocked ? 'zamčená škola' : !known || m.level < need ? `od úrovně ${need}` : 'umíš';

    const g = this.add.graphics();
    g.fillStyle(ready ? 0x13233a : 0x0c141e, 0.9).fillRoundedRect(x, y, w, 62, 10);
    g.lineStyle(2, ready ? 0x6b5233 : 0x3a3f46, 1).strokeRoundedRect(x, y, w, 62, 10);
    this.layer.add(g);

    this.text(x + 16, y + 6, spell.name, { size: 21, bold: true, color: ready ? '#f3e4bd' : '#a7b1bb', maxWidth: 300 });
    this.text(x + 330, y + 9, this.describe(spell), { size: 18, color: ready ? '#dbe6f3' : '#a7b1bb', maxWidth: w - 520 });
    this.text(x + 16, y + 34, spell.description, { size: 17, color: ready ? '#c6d4e3' : '#8f99a3', maxWidth: w - 200 });
    this.text(x + w - 16, y + 19, state, { size: 19, bold: true, color: ready ? '#7fd67a' : '#c9b98f', originX: 1 });
  }

  // Krátký přehled: MP · síla · cíle · efekt.
  describe(spell) {
    const parts = [`${getSpellManaCost(this.state, spell)} MP`];
    if ((spell.targetType ?? 'enemy') === 'enemy') {
      const power = Math.max(1, Math.floor((spell.damage + getEffectiveSpellPower(this.state) / 2) * getSpellDamageMultiplier(this.state, spell.school)));
      parts.push(`poškození ${spell.damage} (teď ~${power})`);
      const area = Number(spell.area) || 0;
      parts.push(area > 0 ? `plocha ${area * 2 + 1}×${area * 2 + 1}` : spell.targets === 'all' ? 'všichni nepřátelé' : spell.targets > 1 ? `${spell.targets} cíle` : '1 cíl');
      if (spell.statusEffect) parts.push(`${STATUS_NAMES[spell.statusEffect.id] ?? spell.statusEffect.id} ${Math.round(spell.statusEffect.chance * 100)} %`);
    } else {
      const e = spell.effect ?? {};
      const who = spell.allies === 'all' ? 'celá parta' : '1 spojenec';
      parts.push(e.type === 'heal' ? `+${e.amount} HP${e.cleanse ? ' a odstraní efekty' : ''}` : `+${e.amount} ${STAT_NAMES[e.stat] ?? e.stat} na ${e.duration} tahy`);
      parts.push(who);
    }
    return parts.join(' · ');
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    if (this.state) SaveSystem.save(this.state);
    this.scene.stop();
    if (this.returnScene) this.scene.resume(this.returnScene);
  }
}
