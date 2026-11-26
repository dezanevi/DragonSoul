import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { cardText, cardButton, nineImage } from '../ui/fantasyCard.js';
import { ensureBackdrop } from '../battle/backdrops.js';
import { createAnimatedBody } from '../battle/monsterAnimations.js';
import { ELEMENT_COLORS } from '../battle/monsterModels.js';

// =====================================================================================
// SOUL CLASH – prototyp zjednodušeného souboje (cvičné souboje z hlavního menu).
//
// Kolo: 1) nepřátelé ukážou záměry (koho napadnou, kolik, co nabíjejí), 2) hráč dá každému
// monstru jeden rozkaz (schopnost / Chránit / Obrana / Prohodit) a hrdina-velitel jedno
// kouzlo ze Soul měřidla, 3) Potvrdit → akce se provedou podle rychlosti (pořadí je vidět
// nahoře), 4) konec kola (hoření, trvání stavů, nové záměry).
// Elementální reakce: Promočený + vzduch = Bouře, Hořící + příroda = Požár,
// Promočený + oheň / Hořící + voda = Pára. Nabíjené útoky jde zásahy zlomit.
// Výpočty jsou bez náhody, náhled poškození je přesný. Původní souboj zůstává beze změny.
// =====================================================================================

const ELEMENT_CZ = { air: 'vzduch', water: 'voda', fire: 'oheň', earth: 'země', verdant: 'příroda', dark: 'temnota', light: 'světlo' };
const STATUS = {
  wet: { label: 'Promočený', color: '#6fb6ff', turns: 2 },
  burn: { label: 'Hořící', color: '#ff8a4a', turns: 2 },
  weak: { label: 'Oslabený', color: '#c9a0ff', turns: 1 },
  broken: { label: 'Zlomený', color: '#ffd23a', turns: 2 }
};
const BURN_TICK = 6;

// ---------------------------------------------------------------- jednotky prototypu
const S = (id, name, element, kind, power, extra = {}) => ({ id, name, element, kind, power, ...extra });

const PLAYER_TEAM = [
  { key: 'wolf', name: 'Dire Wolf', species: 'dire_wolf', element: 'verdant', hp: 130, atk: 18, def: 8, spd: 12, row: 'front', lane: 0,
    skills: [S('bite', 'Kousnutí', 'verdant', 'melee', 1.0), S('lunge', 'Lovecký výpad', 'verdant', 'melee', 1.35, { note: 'na Hořící = Požár' })] },
  { key: 'fire', name: 'Fire Elemental', species: 'fire_elemental', element: 'fire', hp: 95, atk: 19, def: 5, spd: 13, row: 'front', lane: 2,
    skills: [S('flame', 'Plamenný úder', 'fire', 'melee', 1.0, { applies: 'burn' }), S('ember', 'Žhavé jiskry', 'fire', 'ranged', 0.7, { applies: 'burn' })] },
  { key: 'nymph', name: 'Water Nymph', species: 'water_nymph', element: 'water', hp: 85, atk: 14, def: 6, spd: 17, row: 'back', lane: 0,
    skills: [S('stream', 'Vodní proud', 'water', 'ranged', 0.9, { applies: 'wet' }), S('mend', 'Léčivá vlna', 'water', 'heal', 1.2)] },
  { key: 'air', name: 'Air Elemental', species: 'air_elemental', element: 'air', hp: 75, atk: 16, def: 4, spd: 15, row: 'back', lane: 2,
    skills: [S('gale', 'Řezavý vítr', 'air', 'ranged', 0.95, { note: 'na Promočený = Bouře' }), S('gust', 'Poryv', 'air', 'ranged', 0.55, { breakBonus: 2, note: 'zlomí nabíjení o 3' })] }
];

const HERO_SPELLS = [
  { id: 'needle', name: 'Jehla větru', cost: 20, target: 'enemy', element: 'air', damage: 20, text: '20 poškození vzduchem (na Promočený = Bouře)' },
  { id: 'barrier', name: 'Bariéra', cost: 30, target: 'ally', text: 'spojenec dostává toto kolo −50 % poškození' },
  { id: 'soulstrike', name: 'Duší úder', cost: 50, target: 'enemy', element: null, damage: 34, breakBonus: 3, text: '34 poškození a nabíjení −4' }
];

const E = (name, species, element, row, lane, hp, atk, def, spd, skills, extra = {}) => ({ name, species, element, row, lane, hp, atk, def, spd, skills, ...extra });
const ES = (name, element, kind, power, extra = {}) => ({ name, element, kind, power, ...extra });

export const SCENARIOS = [
  {
    id: 'goblins', title: 'Tři goblini', difficulty: 'Lehký',
    text: 'Rozehřívačka: naučíš se rozkazy, záměry nepřátel a první reakce.',
    enemies: [
      E('Goblin', 'goblin', 'earth', 'front', 0, 85, 12, 5, 10, [ES('Sek dýkou', 'earth', 'melee', 1.0)]),
      E('Goblin', 'goblin', 'earth', 'front', 2, 85, 12, 5, 9, [ES('Sek dýkou', 'earth', 'melee', 1.0)]),
      E('Goblin praker', 'goblin', 'earth', 'back', 1, 65, 11, 3, 13, [ES('Kámen z praku', 'earth', 'ranged', 0.9)])
    ]
  },
  {
    id: 'warband', title: 'Smíšená tlupa', difficulty: 'Střední',
    text: 'Orčí válečník nabíjí Drtivý úder – zlom ho dřív, než udeří. Šaman léčí, harpyje je rychlá.',
    enemies: [
      E('Orčí válečník', 'orc_warrior', 'fire', 'front', 1, 140, 19, 7, 8, [ES('Sekera', 'fire', 'melee', 1.0)],
        { charge: { name: 'Drtivý úder', power: 2.3, kind: 'melee', pips: 3, every: 2 } }),
      E('Goblin', 'goblin', 'earth', 'front', 0, 55, 11, 4, 10, [ES('Sek dýkou', 'earth', 'melee', 1.0)]),
      E('Harpyje', 'harpy', 'air', 'back', 0, 60, 12, 3, 20, [ES('Drápy z výšky', 'air', 'ranged', 0.9)]),
      E('Orčí šaman', 'orc_shaman', 'dark', 'back', 1, 70, 12, 4, 9, [ES('Temná střela', 'dark', 'ranged', 0.9)], { healer: 30 }),
      E('Imp', 'imp', 'dark', 'back', 2, 50, 12, 3, 15, [ES('Ohnivý drápek', 'dark', 'ranged', 0.8)])
    ]
  },
  {
    id: 'boss', title: 'Boss: Minotaurus', difficulty: 'Těžký',
    text: 'Dvě fáze. Pod polovinou HP zuří: silnější a nabíjí každé kolo. Chraň monstra a lámej nápory.',
    enemies: [
      E('Minotaurus', 'minotaur', 'earth', 'front', 1, 560, 27, 10, 10, [ES('Rohy', 'earth', 'melee', 1.0)],
        { boss: true, charge: { name: 'Býčí nápor', power: 2.6, kind: 'melee', pips: 4, every: 2 } }),
      E('Imp', 'imp', 'dark', 'back', 0, 60, 15, 3, 15, [ES('Ohnivý drápek', 'dark', 'ranged', 0.9)]),
      E('Imp', 'imp', 'dark', 'back', 2, 60, 15, 3, 16, [ES('Ohnivý drápek', 'dark', 'ranged', 0.8)])
    ]
  }
];

// ---------------------------------------------------------------- rozložení
const COL = { player: { back: 360, front: 600 }, enemy: { front: 1300, back: 1540 } };
const LANE_Y = [395, 580, 765]; // y nohou
const SPRITE_FIT = { w: 130, h: 105 };
const PANEL_Y = 830;

const short = (name) => (name.length > 10 ? `${name.slice(0, 9)}.` : name);

export default class SoulClashScene extends Phaser.Scene {
  constructor() {
    super('SoulClash');
  }

  create(data) {
    this.returnScene = data?.returnScene ?? 'Menu';
    this.speed = this.registry.get('soulClashSpeed') ?? 1;
    const { key } = ensureBackdrop(this, 'greenvale_meadow');
    this.add.image(0, 0, key).setOrigin(0).setDepth(-10);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x02060a, 0.25).setOrigin(0).setDepth(-9);
    this.root = this.add.container(0, 0);
    this.onKey = (event) => this.handleKey(event);
    this.input.keyboard.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));
    this.showSelect();
  }

  handleKey(event) {
    if (event.repeat) return;
    if (this.phase === 'plan') {
      if (event.code === 'Enter' || event.code === 'NumpadEnter') this.confirmPlan();
      else if (event.code === 'Escape') this.cancelTargeting(true);
    } else if (this.phase === 'select' && event.code === 'Escape') {
      this.leave();
    }
  }

  // ================================================================ výběr souboje
  showSelect() {
    this.clearAll();
    this.phase = 'select';
    const ui = this.add.container(0, 0).setDepth(50);
    this.root.add(ui);
    const panel = (x, y, w, h) => {
      const bg = nineImage(this, 'nu-panel', x, y, w, h, 0.7) ?? this.add.rectangle(x, y, w, h, 0x0d1d33, 0.95).setOrigin(0);
      ui.add(bg);
    };
    panel(160, 80, 1600, 920);
    ui.add(cardText(this, 960, 120, 'Soul Clash – cvičné souboje', { size: 44, bold: true, color: '#ffe7ae', originX: 0.5 }));
    ui.add(cardText(this, 960, 182, 'Prototyp zjednodušeného souboje. Tvoje parta: Dire Wolf (příroda), Fire Elemental (oheň), Water Nymph (voda), Air Elemental (vzduch).',
      { size: 20, color: '#cfe2f5', originX: 0.5, wrap: 1400, align: 'center' }));

    const rules = [
      '• Nahoře vidíš, co nepřátelé chystají (cíl a poškození). Nabíjený útok (⚡) udeří na konci kola – každý zásah ubere jeden dílek, při nule je nepřítel Zlomený (útok propadne, dostává +50 %).',
      '• Klikni na své monstrum a dej mu jeden rozkaz: schopnost, Chránit spojence, Obrana nebo Prohodit pozici. Bez rozkazu udělá slabší instinktivní útok (50 %).',
      '• Přední řada útočí zblízka jen na přední řadu nepřátel; zadní řada útočí na dálku na kohokoli.',
      '• Hrdina velí: jednou za kolo kouzlo za Soul energii (+4 za zásah, +8 za reakci, +20 za zlomení, +5 za kolo).',
      '• Reakce: Promočený + vzduch = Bouře (×1,6, láme nabíjení) · Hořící + příroda = Požár (×1,6) · Promočený + oheň / Hořící + voda = Pára (×1,4, oslabí).',
      '• Pořadí akcí je podle rychlosti a ukazuje ho pruh nahoře. Enter = potvrdit plán, Esc = zrušit výběr.'
    ];
    let y = 240;
    for (const line of rules) {
      const t = cardText(this, 230, y, line, { size: 20, color: '#f3e4bd', wrap: 1460 });
      ui.add(t);
      y += t.height + 8;
    }
    const top = Math.max(y + 24, 560);
    SCENARIOS.forEach((sc, i) => {
      const x = 230 + i * 500;
      const g = this.add.graphics();
      g.fillStyle(0x08111d, 0.9).fillRoundedRect(x, top, 460, 250, 14).lineStyle(2, 0x8a6a30, 1).strokeRoundedRect(x, top, 460, 250, 14);
      ui.add(g);
      ui.add(cardText(this, x + 24, top + 18, sc.title, { size: 28, bold: true, color: '#ffe7ae' }));
      ui.add(cardText(this, x + 436, top + 24, sc.difficulty, { size: 20, bold: true, color: ['#8ff0b0', '#ffd76a', '#ff9a8a'][i], originX: 1 }));
      ui.add(cardText(this, x + 24, top + 62, sc.text, { size: 18, color: '#dbe6f3', wrap: 412 }));
      ui.add(cardText(this, x + 24, top + 172, sc.enemies.map((e) => e.name).join(', '), { size: 16, color: '#9fb3c8', wrap: 412, originY: 1 }));
      ui.add(cardButton(this, null, x + 120, top + 184, 220, 58, 'Bojovat', () => this.startScenario(sc), { size: 22 }).objects);
    });
    ui.add(cardButton(this, null, 960 - 130, top + 290, 260, 58, 'Zpět (Esc)', () => this.leave(), { size: 22, danger: true }).objects);
  }

  leave() {
    this.scene.start(this.returnScene);
  }

  clearAll() {
    this.root.removeAll(true);
    this.units = [];
    this.views = new Map();
  }

  // ================================================================ start souboje
  startScenario(scenario) {
    this.clearAll();
    this.scenario = scenario;
    this.round = 0;
    this.soul = 30;
    this.stats = { reactions: 0, breaks: 0 };
    this.fieldLayer = this.add.container(0, 0);
    this.arrowLayer = this.add.graphics().setDepth(40);
    this.uiLayer = this.add.container(0, 0).setDepth(60);
    this.root.add([this.fieldLayer, this.arrowLayer, this.uiLayer]);

    PLAYER_TEAM.forEach((def) => this.units.push(this.makeUnit('player', def)));
    scenario.enemies.forEach((def, i) => this.units.push(this.makeUnit('enemy', { ...def, key: `e${i}` })));
    for (const u of this.units) this.buildView(u);
    this.logLines = [];
    this.buildHud();
    this.newRound();
  }

  makeUnit(side, def) {
    return {
      ...def, side, id: `${side}-${def.key}`,
      maxHp: def.hp, hp: def.hp, baseAtk: def.atk,
      chargeDef: def.charge ?? null,
      st: {}, order: null, intent: null, charge: 0, phase: 1,
      defending: false, protectedBy: null, barrier: false
    };
  }

  pos(u) {
    return { x: COL[u.side][u.row], y: LANE_Y[u.lane] };
  }

  alive(side) {
    return this.units.filter((u) => u.side === side && u.hp > 0);
  }

  // ---------------------------------------------------------------- zobrazení jednotky
  buildView(u) {
    const p = this.pos(u);
    const c = this.add.container(p.x, p.y);
    const ring = this.add.graphics();
    const body = createAnimatedBody(this, u.species, u.side);
    let sprite;
    if (body) {
      const fit = u.boss ? 1.45 : 1;
      body.setScale(Math.min(SPRITE_FIT.w * fit / body.width, SPRITE_FIT.h * fit / body.height));
      body.setPosition(0, 0);
      sprite = body;
    } else {
      sprite = this.add.circle(0, -45, 40, ELEMENT_COLORS[u.element] ?? 0xcccccc);
    }
    const plate = this.add.graphics();
    const name = cardText(this, -62, 8, short(u.name), { size: 17, bold: true, color: u.side === 'player' ? '#cfeaff' : '#ffd1c8' });
    const hpText = cardText(this, 62, 8, '', { size: 16, color: '#ffffff', originX: 1 });
    const status = cardText(this, 0, 48, '', { size: 15, bold: true, color: '#ffd76a', originX: 0.5, strokeThickness: 4 });
    const intent = cardText(this, 0, -(u.boss ? 165 : 128), '', { size: 17, bold: true, color: '#ff9a8a', originX: 0.5, strokeThickness: 4 });
    c.add([ring, sprite, plate, name, hpText, status, intent]);
    c.setDepth(10 + p.y / 100);
    this.fieldLayer.add(c);
    const zone = this.add.zone(p.x - 75, p.y - (u.boss ? 150 : 120), 150, (u.boss ? 150 : 120) + 50).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.onUnitClick(u));
    zone.on('pointerover', () => this.onUnitHover(u));
    zone.on('pointerout', () => this.hideTip());
    this.fieldLayer.add(zone);
    this.views.set(u.id, { c, ring, sprite, plate, name, hpText, status, intent, zone });
    this.refreshUnit(u);
  }

  refreshUnit(u) {
    const v = this.views.get(u.id);
    if (!v) return;
    const dead = u.hp <= 0;
    v.c.setAlpha(dead ? 0.25 : 1);
    v.zone.input.enabled = !dead;
    v.plate.clear();
    v.plate.fillStyle(0x05080c, 0.82).fillRoundedRect(-68, 4, 136, 40, 8);
    const ratio = Math.max(0, u.hp / u.maxHp);
    v.plate.fillStyle(0x1a2028, 1).fillRoundedRect(-62, 30, 124, 9, 4);
    if (ratio > 0) v.plate.fillStyle(u.side === 'player' ? 0x4fbf5a : 0xd0564a, 1).fillRoundedRect(-62, 30, Math.max(6, 124 * ratio), 9, 4);
    v.hpText.setText(`${Math.max(0, Math.round(u.hp))}`);
    const tags = [];
    for (const [id, turns] of Object.entries(u.st)) if (turns > 0 && STATUS[id]) tags.push(STATUS[id].label);
    if (u.defending) tags.push('Obrana');
    if (u.barrier) tags.push('Bariéra');
    v.status.setText(tags.join(' · '));
    v.ring.clear();
    if (this.selected === u) v.ring.lineStyle(4, 0xffd76a, 1).strokeEllipse(0, 0, 130, 38);
    else if (this.targetable?.(u)) v.ring.lineStyle(3, 0x8ff0ff, 0.9).strokeEllipse(0, 0, 120, 34);
    else v.ring.lineStyle(2, u.side === 'player' ? 0x6fb6ff : 0xd0564a, 0.6).strokeEllipse(0, 0, 110, 30);
    this.refreshIntent(u);
  }

  refreshIntent(u) {
    const v = this.views.get(u.id);
    if (!v) return;
    if (u.side !== 'enemy' || u.hp <= 0 || !u.intent) { v.intent.setText(''); return; }
    const i = u.intent;
    if (u.st.broken > 0 && i.type === 'stunned') { v.intent.setText('Zlomený – nejedná').setColor('#ffd23a'); return; }
    if (i.type === 'charge') {
      const pips = '■'.repeat(Math.max(0, u.charge)) + '□'.repeat(Math.max(0, i.pips - u.charge));
      v.intent.setText(`⚡ ${i.name} ${pips}\n→ ${short(i.target?.name ?? '?')} ~${this.predict(u, i.skill, i.target).dmg}`).setColor('#ffb347');
    } else if (i.type === 'heal') {
      v.intent.setText(`✚ léčí ${short(i.target.name)} +${i.amount}`).setColor('#8ff0b0');
    } else {
      v.intent.setText(`⚔ ${i.skill.name}\n→ ${short(i.target?.name ?? '?')} ~${this.predict(u, i.skill, i.target).dmg}`).setColor('#ff9a8a');
    }
  }

  // ================================================================ HUD
  buildHud() {
    const ui = this.uiLayer;
    this.titleText = cardText(this, 30, 22, '', { size: 26, bold: true, color: '#ffe7ae' });
    this.orderLayer = this.add.container(0, 0);
    // Výpis boje vlevo nahoře (nad zadní řadou party), posledních 5 řádků.
    this.logText = cardText(this, 30, 126, '', { size: 15, color: '#dbe6f3', wrap: 600, lineSpacing: 2 });
    const logBg = this.add.graphics();
    logBg.fillStyle(0x05080c, 0.62).fillRoundedRect(20, 118, 620, 150, 10);
    const bottom = nineImage(this, 'nu-panel', 10, PANEL_Y, GAME_WIDTH - 20, GAME_HEIGHT - PANEL_Y - 10, 0.6)
      ?? this.add.rectangle(10, PANEL_Y, GAME_WIDTH - 20, GAME_HEIGHT - PANEL_Y - 10, 0x0d1d33, 0.95).setOrigin(0);
    this.panelLayer = this.add.container(0, 0);
    this.tip = this.add.container(0, 0).setDepth(80).setVisible(false);
    ui.add([logBg, this.logText, bottom, this.titleText, this.orderLayer, this.panelLayer, this.tip]);
  }

  log(line) {
    this.logLines.push(line);
    this.logLines = this.logLines.slice(-5);
    this.logText.setText(this.logLines.join('\n'));
  }

  // ================================================================ kolo
  newRound() {
    this.round += 1;
    this.phase = 'plan';
    this.heroOrder = null;
    this.selected = null;
    this.mode = null;
    for (const u of this.units) {
      u.order = null;
      u.defending = false;
      u.protectedBy = null;
      u.barrier = false;
    }
    this.planEnemies();
    this.titleText.setText(`${this.scenario.title} · Kolo ${this.round}`);
    this.selected = this.alive('player')[0] ?? null;
    this.refreshAll();
  }

  // Záměry nepřátel (vznikají PŘED plánem hráče a už se nemění).
  planEnemies() {
    for (const e of this.alive('enemy')) {
      e.charge = 0;
      // Zlomený nepřítel v příštím kole nejedná (a dál dostává +50 %).
      if (e.st.broken > 0) { e.intent = { type: 'stunned' }; continue; }
      const def = e.chargeDef;
      const every = e.phase === 2 ? 1 : def?.every ?? 99;
      if (def && this.round % every === 0) {
        const skill = ES(def.name, e.element, def.kind, def.power * (e.phase === 2 ? 1.15 : 1));
        const pips = def.pips + (e.phase === 2 ? 1 : 0);
        e.charge = pips;
        e.intent = { type: 'charge', name: def.name, skill, pips, target: this.pickTarget(e, skill) };
        continue;
      }
      if (e.healer) {
        const hurt = this.alive('enemy').filter((a) => a.hp < a.maxHp * 0.6).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (hurt) { e.intent = { type: 'heal', target: hurt, amount: e.healer }; continue; }
      }
      const skill = e.skills[0];
      e.intent = { type: 'attack', skill, target: this.pickTarget(e, skill) };
    }
  }

  // Cíl: zblízka přední řada (nejméně HP), na dálku kdokoli s nejméně HP.
  pickTarget(attacker, skill, side = attacker.side === 'enemy' ? 'player' : 'enemy') {
    const pool = this.reachable(attacker, skill, side);
    return pool.sort((a, b) => a.hp - b.hp)[0] ?? null;
  }

  reachable(attacker, skill, side) {
    const foes = this.alive(side);
    if (skill.kind !== 'melee') return foes;
    const front = foes.filter((u) => u.row === 'front');
    return front.length ? front : foes;
  }

  // ---------------------------------------------------------------- výpočty
  reactionFor(element, target, st = target.st) {
    if (!element) return null;
    if (st.wet > 0 && element === 'air') return { name: 'Bouře', mult: 1.6, breakExtra: 2, consume: 'wet' };
    if (st.burn > 0 && element === 'verdant') return { name: 'Požár', mult: 1.6, breakExtra: 0, refresh: 'burn' };
    if (st.wet > 0 && element === 'fire') return { name: 'Pára', mult: 1.4, breakExtra: 0, consume: 'wet', weaken: true };
    if (st.burn > 0 && element === 'water') return { name: 'Pára', mult: 1.4, breakExtra: 0, consume: 'burn', weaken: true };
    return null;
  }

  // Poškození bez náhody. st = očekávané stavy cíle (pro náhled podle plánu).
  predict(attacker, skill, target, { instinct = false, st } = {}) {
    if (!target) return { dmg: 0, reaction: null };
    const status = st ?? target.st;
    const reaction = this.reactionFor(skill.element, target, status);
    let base = skill.fixed ?? attacker.atk * skill.power;
    if (!skill.fixed) base = base * 30 / (30 + target.def);
    if (instinct) base *= 0.5;
    if (attacker.st?.weak > 0) base *= 0.6;
    if (status.broken > 0) base *= 1.5;
    if (target.defending) base *= 0.5;
    if (target.barrier) base *= 0.5;
    if (reaction) base *= reaction.mult;
    return { dmg: Math.max(1, Math.round(base)), reaction };
  }

  // Očekávané stavy cílů v okamžiku akce – podle plánovaného pořadí (pro náhled reakcí).
  expectedStatus(target, beforeActor) {
    const st = { ...target.st };
    for (const a of this.timeline()) {
      if (a.unit === beforeActor) break;
      const o = a.order;
      if (!o || o.target !== target) continue;
      if (o.skill?.applies) st[o.skill.applies] = 2;
      const r = this.reactionFor(o.skill?.element, target, st);
      if (r?.consume) st[r.consume] = 0;
    }
    return st;
  }

  // Pořadí: rychlá obrana (Obrana, Chránit, Bariéra) → hrdina → jednotky podle rychlosti → nabíjené útoky.
  timeline() {
    const list = [];
    for (const u of this.alive('player')) {
      const o = u.order ?? this.instinctOrder(u);
      if (!o) continue;
      const quick = o.type === 'defend' || o.type === 'protect';
      list.push({ unit: u, order: o, slot: quick ? 0 : 2, spd: u.spd, instinct: !u.order });
    }
    if (this.heroOrder) list.push({ unit: { name: 'Velitel', side: 'player', hero: true }, order: this.heroOrder, slot: this.heroOrder.spell.id === 'barrier' ? 0 : 1, spd: 99 });
    for (const e of this.alive('enemy')) {
      if (!e.intent || e.intent.type === 'stunned') continue;
      list.push({ unit: e, order: e.intent, slot: e.intent.type === 'charge' ? 3 : 2, spd: e.spd });
    }
    return list.sort((a, b) => a.slot - b.slot || b.spd - a.spd || (a.unit.side === 'player' ? -1 : 1));
  }

  instinctOrder(u) {
    const skill = u.skills.find((s) => s.kind !== 'heal' && (s.kind !== 'melee' || u.row === 'front'));
    if (!skill) return { type: 'defend', instinct: true };
    return { type: 'skill', skill, target: this.pickTarget(u, skill), instinct: true };
  }

  // ================================================================ plánování (UI)
  refreshAll() {
    for (const u of this.units) this.refreshUnit(u);
    this.drawArrows();
    this.drawOrderStrip();
    this.drawPanel();
  }

  onUnitClick(u) {
    if (this.phase !== 'plan') return;
    if (this.mode) {
      this.applyTarget(u);
      return;
    }
    if (u.side === 'player') {
      this.selected = u;
      this.refreshAll();
    }
  }

  // Výběr cíle pro rozkaz.
  startTargeting(mode) {
    this.mode = mode;
    const m = mode;
    this.targetable = (u) => {
      if (u.hp <= 0) return false;
      if (m.kind === 'skill') {
        if (m.skill.kind === 'heal') return u.side === 'player';
        return u.side === 'enemy' && this.reachable(this.selected, m.skill, 'enemy').includes(u);
      }
      if (m.kind === 'protect') return u.side === 'player' && u !== this.selected;
      if (m.kind === 'swap') return u.side === 'player' && u !== this.selected;
      if (m.kind === 'spell') return m.spell.target === 'ally' ? u.side === 'player' : u.side === 'enemy';
      return false;
    };
    this.refreshAll();
    if (m.kind === 'swap') this.showEmptySlots();
  }

  cancelTargeting(refresh = true) {
    this.mode = null;
    this.targetable = null;
    this.emptySlotLayer?.destroy();
    this.emptySlotLayer = null;
    this.hideTip();
    if (refresh) this.refreshAll();
  }

  applyTarget(u) {
    const m = this.mode;
    if (!m || !this.targetable?.(u)) return;
    if (m.kind === 'spell') {
      this.heroOrder = { type: 'spell', spell: m.spell, target: u };
    } else if (m.kind === 'skill') {
      this.selected.order = { type: 'skill', skill: m.skill, target: u };
    } else if (m.kind === 'protect') {
      this.selected.order = { type: 'protect', target: u };
    } else if (m.kind === 'swap') {
      this.selected.order = { type: 'swap', target: u };
    }
    this.cancelTargeting(false);
    if (m.kind !== 'spell') this.selectNextFree();
    this.refreshAll();
  }

  selectNextFree() {
    const free = this.alive('player').find((x) => !x.order);
    if (free) this.selected = free;
  }

  showEmptySlots() {
    this.emptySlotLayer = this.add.container(0, 0).setDepth(45);
    this.root.add(this.emptySlotLayer);
    for (const row of ['front', 'back']) {
      for (let lane = 0; lane < 3; lane++) {
        if (this.units.some((u) => u.side === 'player' && u.hp > 0 && u.row === row && u.lane === lane)) continue;
        const x = COL.player[row];
        const y = LANE_Y[lane];
        const g = this.add.graphics();
        g.lineStyle(3, 0x8ff0ff, 0.9).strokeEllipse(x, y, 110, 32);
        const t = cardText(this, x, y - 40, 'volné místo', { size: 16, color: '#8ff0ff', originX: 0.5 });
        const z = this.add.zone(x - 60, y - 60, 120, 80).setOrigin(0).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => {
          this.selected.order = { type: 'swap', slot: { row, lane } };
          this.cancelTargeting(false);
          this.selectNextFree();
          this.refreshAll();
        });
        this.emptySlotLayer.add([g, t, z]);
      }
    }
  }

  onUnitHover(u) {
    if (this.phase !== 'plan') return;
    if (this.mode && this.targetable?.(u)) {
      const m = this.mode;
      if (m.kind === 'skill' && m.skill.kind !== 'heal') {
        const p = this.predict(this.selected, m.skill, u, { st: this.expectedStatus(u, this.selected) });
        this.showTip(u, `${m.skill.name}: ${p.dmg} poškození${p.reaction ? `\n${p.reaction.name}! ×${String(p.reaction.mult).replace('.', ',')}` : ''}`);
      } else if (m.kind === 'spell' && m.spell.target === 'enemy') {
        const sk = { element: m.spell.element, fixed: m.spell.damage };
        const p = this.predict({ atk: 0, st: {} }, sk, u, { st: this.expectedStatus(u, { hero: true }) });
        this.showTip(u, `${m.spell.name}: ${p.dmg} poškození${p.reaction ? `\n${p.reaction.name}!` : ''}`);
      } else if (m.kind === 'skill' && m.skill.kind === 'heal') {
        this.showTip(u, `Léčení +${this.healAmount(this.selected)} HP`);
      }
      return;
    }
    if (u.side === 'enemy') {
      const tags = Object.entries(u.st).filter(([, t]) => t > 0).map(([k, t]) => `${STATUS[k].label} (${t})`).join(', ');
      this.showTip(u, `${u.name} · ${ELEMENT_CZ[u.element]} · HP ${Math.round(u.hp)}/${u.maxHp}\nÚtok ${Math.round(u.atk)} · Obrana ${u.def} · Rychlost ${u.spd}${tags ? `\n${tags}` : ''}`);
    }
  }

  showTip(u, text) {
    this.tip.removeAll(true);
    const p = this.pos(u);
    const t = cardText(this, 0, 0, text, { size: 18, color: '#fff4d6', wrap: 320 });
    const w = t.width + 28;
    const h = t.height + 20;
    const x = Phaser.Math.Clamp(p.x - w / 2, 10, GAME_WIDTH - w - 10);
    // Pod jednotkou (nad ní je záměr nepřítele).
    const y = Math.min(PANEL_Y - h - 6, p.y + 60);
    const g = this.add.graphics();
    g.fillStyle(0x05080c, 0.94).fillRoundedRect(x, y, w, h, 10).lineStyle(2, 0xd6a23a, 1).strokeRoundedRect(x, y, w, h, 10);
    t.setPosition(x + 14, y + 10);
    this.tip.add([g, t]).setVisible(true);
  }

  hideTip() {
    this.tip?.setVisible(false);
  }

  healAmount(u) {
    return Math.round(20 + u.atk * 1.2);
  }

  // Šipky: rozkazy hráče (zlaté), instinkty (šedé), záměry nepřátel (červené).
  drawArrows() {
    const g = this.arrowLayer;
    g.clear();
    if (this.phase !== 'plan') return;
    const arrow = (from, to, color, alpha, width) => {
      const a = { x: from.x, y: from.y - 55 };
      const b = { x: to.x, y: to.y - 55 };
      g.lineStyle(width, color, alpha).lineBetween(a.x, a.y, b.x, b.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      g.fillStyle(color, alpha).fillTriangle(b.x, b.y, b.x - 16 * Math.cos(ang - 0.4), b.y - 16 * Math.sin(ang - 0.4), b.x - 16 * Math.cos(ang + 0.4), b.y - 16 * Math.sin(ang + 0.4));
    };
    for (const e of this.alive('enemy')) {
      if (e.intent?.target && e.intent.type !== 'heal') arrow(this.pos(e), this.pos(e.intent.target), e.intent.type === 'charge' ? 0xffb347 : 0xff5a4a, e.intent.type === 'charge' ? 0.8 : 0.4, e.intent.type === 'charge' ? 4 : 2);
    }
    for (const u of this.alive('player')) {
      const o = u.order ?? this.instinctOrder(u);
      if (o?.target) arrow(this.pos(u), this.pos(o.target), u.order ? 0xffd76a : 0x9aa4ae, u.order ? 0.95 : 0.5, u.order ? 5 : 3);
    }
    if (this.heroOrder?.target) arrow({ x: 140, y: 600 }, this.pos(this.heroOrder.target), 0x8ff0ff, 0.9, 4);
  }

  drawOrderStrip() {
    this.orderLayer.removeAll(true);
    const list = this.timeline();
    const w = 116;
    const x0 = 960 - (list.length * (w + 6)) / 2;
    this.orderLayer.add(cardText(this, x0 - 14, 90, 'Pořadí:', { size: 18, color: '#cfe2f5', originX: 1, originY: 0.5 }));
    list.forEach((a, i) => {
      const x = x0 + i * (w + 6);
      const g = this.add.graphics();
      const color = a.unit.side === 'player' ? (a.unit.hero ? 0x1d4a5a : 0x1b2f4c) : 0x4a1b1b;
      g.fillStyle(color, 0.95).fillRoundedRect(x, 70, w, 40, 8).lineStyle(2, a.order?.type === 'charge' ? 0xffb347 : 0x8a6a30, 1).strokeRoundedRect(x, 70, w, 40, 8);
      const label = a.order.type === 'defend' ? 'Obrana' : a.order.type === 'protect' ? 'Chrání' : a.order.type === 'swap' ? 'Přesun' : a.order.type === 'charge' ? '⚡' : a.instinct ? 'instinkt' : '';
      this.orderLayer.add([g,
        cardText(this, x + w / 2, 82, short(a.unit.name), { size: 15, bold: true, color: '#f3e4bd', originX: 0.5, originY: 0.5 }),
        cardText(this, x + w / 2, 100, label, { size: 13, color: '#9fb3c8', originX: 0.5, originY: 0.5 })]);
    });
  }

  // Spodní panel: vybrané monstrum a jeho rozkazy, hrdina a Soul měřidlo, potvrzení.
  drawPanel() {
    const L = this.panelLayer;
    L.removeAll(true);
    if (this.phase !== 'plan') {
      if (this.phase === 'resolve') L.add(cardText(this, 40, PANEL_Y + 30, 'Probíhá střet… (rychlost vpravo)', { size: 26, bold: true, color: '#ffe7ae' }));
      this.addSpeedButtons(L);
      return;
    }
    const u = this.selected;
    const y1 = PANEL_Y + 18;
    const y2 = PANEL_Y + 96;
    const y3 = PANEL_Y + 168;
    if (u) {
      L.add(cardText(this, 40, y1 + 6, `${u.name}`, { size: 24, bold: true, color: '#ffe7ae' }));
      L.add(cardText(this, 40, y1 + 38, `${ELEMENT_CZ[u.element]} · ${u.row === 'front' ? 'přední' : 'zadní'} řada · rychlost ${u.spd}`, { size: 17, color: '#9fc4e6' }));
      const orderText = u.order ? this.describeOrder(u.order) : `bez rozkazu → instinkt: ${this.describeOrder(this.instinctOrder(u))}`;
      L.add(cardText(this, 40, y2 + 4, `Rozkaz: ${orderText}`, { size: 18, color: u.order ? '#8ff0b0' : '#c9d3dd', wrap: 300 }));
      let x = 360;
      u.skills.forEach((s) => {
        const blocked = s.kind === 'melee' && u.row !== 'front';
        const sub = s.kind === 'heal' ? `léčí +${this.healAmount(u)} HP` : `${ELEMENT_CZ[s.element]} · ${s.kind === 'melee' ? 'zblízka' : 'na dálku'}${s.applies ? ` · ${STATUS[s.applies].label}` : ''}${s.note ? ` · ${s.note}` : ''}${blocked ? ' · jen z přední řady' : ''}`;
        const b = cardButton(this, null, x, y1, 350, 58, s.name, () => this.startTargeting({ kind: 'skill', skill: s }), { size: 21, disabled: blocked, active: this.mode?.skill === s });
        L.add(b.objects);
        L.add(cardText(this, x + 175, y1 + 62, sub, { size: 15, color: '#9fc4e6', originX: 0.5 }));
        x += 362;
      });
      const actions = [
        ['Chránit', () => this.startTargeting({ kind: 'protect' })],
        ['Obrana', () => { u.order = { type: 'defend' }; this.cancelTargeting(false); this.selectNextFree(); this.refreshAll(); }],
        ['Prohodit', () => this.startTargeting({ kind: 'swap' })],
        ['Zrušit rozkaz', () => { u.order = null; this.cancelTargeting(); }]
      ];
      x = 360;
      actions.forEach(([label, fn]) => {
        L.add(cardButton(this, null, x, y2, 172, 60, label, fn, { size: 20 }).objects);
        x += 180;
      });
    }
    // Hrdina.
    L.add(cardText(this, 40, y3 + 6, 'Velitel', { size: 22, bold: true, color: '#8ff0ff' }));
    const g = this.add.graphics();
    g.fillStyle(0x05080c, 0.95).fillRoundedRect(150, y3 + 10, 190, 24, 8);
    g.fillStyle(0x8ff0ff, 1).fillRoundedRect(150, y3 + 10, Math.max(8, 190 * this.soul / 100), 24, 8);
    L.add([g, cardText(this, 245, y3 + 22, `Soul ${this.soul}/100`, { size: 17, bold: true, color: '#ffffff', originX: 0.5, originY: 0.5, strokeThickness: 4 })]);
    let hx = 360;
    for (const sp of HERO_SPELLS) {
      const chosen = this.heroOrder?.spell === sp;
      const b = cardButton(this, null, hx, y3, 232, 60, `${sp.name} (${sp.cost})`, () => {
        if (chosen) { this.heroOrder = null; this.refreshAll(); return; }
        this.startTargeting({ kind: 'spell', spell: sp });
      }, { size: 19, disabled: this.soul < sp.cost && !chosen, active: chosen || this.mode?.spell === sp });
      L.add(b.objects);
      hx += 240;
    }
    const hint = this.mode
      ? (this.mode.kind === 'swap' ? 'Klikni na spojence nebo volné místo (Esc = zrušit).' : 'Klikni na cíl (Esc = zrušit).')
      : this.heroOrder ? `Velitel: ${this.heroOrder.spell.name} → ${this.heroOrder.target.name}` : 'Velitel jedná jednou za kolo (kouzlo za Soul).';
    L.add(cardText(this, 1100, y3 + 4, hint, { size: 18, color: this.mode ? '#8ff0ff' : '#c9d3dd', wrap: 380 }));
    // Potvrzení a rychlost.
    L.add(cardButton(this, null, 1500, y1, 390, 70, 'Potvrdit plán (Enter)', () => this.confirmPlan(), { size: 24 }).objects);
    this.addSpeedButtons(L);
    L.add(cardButton(this, null, 1500, y3, 390, 58, 'Vzdát a zpět', () => this.showSelect(), { size: 20, danger: true }).objects);
  }

  addSpeedButtons(L) {
    [1, 2, 4].forEach((s, i) => {
      L.add(cardButton(this, null, 1500 + i * 132, PANEL_Y + 100, 124, 56, `${s}×`, () => {
        this.speed = s;
        this.registry.set('soulClashSpeed', s);
        this.drawPanel();
      }, { size: 22, active: this.speed === s }).objects);
    });
  }

  describeOrder(o) {
    if (!o) return '—';
    if (o.type === 'skill') return `${o.skill.name} → ${o.target?.name ?? '?'}${o.instinct ? ' (50 %)' : ''}`;
    if (o.type === 'defend') return 'Obrana (−50 % poškození)';
    if (o.type === 'protect') return `chrání ${o.target.name}`;
    if (o.type === 'swap') return o.slot ? `přesun na ${o.slot.row === 'front' ? 'přední' : 'zadní'} řadu` : `prohodit s ${o.target.name}`;
    return '?';
  }

  // ================================================================ střet
  async confirmPlan() {
    if (this.phase !== 'plan') return;
    this.cancelTargeting(false);
    this.phase = 'resolve';
    this.selected = null;
    if (this.heroOrder) this.soul -= this.heroOrder.spell.cost;
    const list = this.timeline();
    this.refreshAll();
    for (const a of list) {
      if (this.isOver()) break;
      if (!a.unit.hero && a.unit.hp <= 0) continue;
      await this.execute(a);
      this.refreshAll();
    }
    await this.wait(300);
    if (this.isOver()) { this.finish(); return; }
    this.endRound();
  }

  wait(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms / this.speed, resolve));
  }

  tweenTo(target, props, ms) {
    return new Promise((resolve) => this.tweens.add({ targets: target, ...props, duration: ms / this.speed, onComplete: resolve }));
  }

  float(u, text, color) {
    const p = this.pos(u);
    const t = cardText(this, p.x, p.y - 130, text, { size: 26, bold: true, color, originX: 0.5, strokeThickness: 5 }).setDepth(70);
    this.root.add(t);
    this.tweens.add({ targets: t, y: p.y - 190, alpha: 0, duration: 1100 / this.speed, onComplete: () => t.destroy() });
  }

  async execute(a) {
    const { unit: u, order: o } = a;
    if (o.type === 'defend') { u.defending = true; this.log(`${u.name} zaujímá obranu.`); this.refreshUnit(u); return this.wait(250); }
    if (o.type === 'protect') {
      if (o.target.hp > 0) { o.target.protectedBy = u; this.log(`${u.name} kryje ${o.target.name}.`); }
      return this.wait(250);
    }
    if (o.type === 'spell') return this.castHeroSpell(o);
    if (o.type === 'swap') return this.doSwap(u, o);
    if (o.type === 'heal') {
      const t = o.target.hp > 0 ? o.target : this.alive('enemy').sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
      if (!t) return null;
      t.hp = Math.min(t.maxHp, t.hp + o.amount);
      this.float(t, `+${o.amount}`, '#8ff0b0');
      this.log(`${u.name} léčí ${t.name} (+${o.amount}).`);
      return this.wait(500);
    }
    if (o.type === 'charge' && u.charge <= 0) return null; // zlomený útok propadl
    return this.doAttack(u, o.skill, o.target, { instinct: Boolean(o.instinct), charged: o.type === 'charge' });
  }

  async doSwap(u, o) {
    const v = this.views.get(u.id);
    if (o.slot) {
      if (this.units.some((x) => x.side === 'player' && x.hp > 0 && x.row === o.slot.row && x.lane === o.slot.lane)) { this.log(`${u.name}: místo je obsazené, zůstává.`); return null; }
      u.row = o.slot.row; u.lane = o.slot.lane;
    } else {
      const t = o.target;
      if (t.hp <= 0) return null;
      [u.row, t.row] = [t.row, u.row];
      [u.lane, t.lane] = [t.lane, u.lane];
      const tv = this.views.get(t.id);
      const tp = this.pos(t);
      this.tweenTo(tv.c, { x: tp.x, y: tp.y }, 400);
      tv.zone.setPosition(tp.x - 75, tp.y - 120);
    }
    const p = this.pos(u);
    v.zone.setPosition(p.x - 75, p.y - 120);
    this.log(`${u.name} mění pozici (${u.row === 'front' ? 'přední' : 'zadní'} řada).`);
    return this.tweenTo(v.c, { x: p.x, y: p.y }, 400);
  }

  async castHeroSpell(o) {
    const sp = o.spell;
    let t = o.target;
    if (sp.target === 'ally') {
      if (t.hp <= 0) return null;
      t.barrier = true;
      this.log(`Velitel: Bariéra na ${t.name}.`);
      this.float(t, 'Bariéra', '#8ff0ff');
      return this.wait(400);
    }
    if (t.hp <= 0) t = this.alive('enemy').sort((a, b) => a.hp - b.hp)[0];
    if (!t) return null;
    return this.hit({ name: 'Velitel', side: 'player', st: {}, atk: 0 }, { name: sp.name, element: sp.element, fixed: sp.damage, breakBonus: sp.breakBonus ?? 0 }, t, {});
  }

  async doAttack(u, skill, target, { instinct, charged }) {
    if (skill.kind === 'heal') {
      const t = target?.hp > 0 ? target : this.alive(u.side).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      const amount = this.healAmount(u);
      t.hp = Math.min(t.maxHp, t.hp + amount);
      this.float(t, `+${amount}`, '#8ff0b0');
      this.log(`${u.name}: ${skill.name} → ${t.name} +${amount}.`);
      return this.wait(500);
    }
    // Neplatný cíl: nejbližší dosažitelný.
    const foeSide = u.side === 'player' ? 'enemy' : 'player';
    let t = target;
    if (!t || t.hp <= 0 || !this.reachable(u, skill, foeSide).includes(t)) t = this.pickTarget(u, skill, foeSide);
    if (!t) return null;
    // Melee nemůže ze zadní řady.
    if (skill.kind === 'melee' && u.row !== 'front' && u.side === 'player') { this.log(`${u.name} je v zadní řadě – zblízka nedosáhne.`); return null; }
    // Ochrana spojence.
    if (t.protectedBy && t.protectedBy.hp > 0 && u.side === 'enemy') {
      this.log(`${t.protectedBy.name} zachytí útok na ${t.name}!`);
      t = t.protectedBy;
      t.guarding = true;
    }
    const v = this.views.get(u.id);
    const p0 = this.pos(u);
    const tp = this.pos(t);
    if (skill.kind === 'melee') await this.tweenTo(v.c, { x: p0.x + (tp.x - p0.x) * 0.55 }, 260);
    else await this.tweenTo(v.c, { y: p0.y - 18 }, 160);
    await this.hit(u, { ...skill, power: skill.power }, t, { instinct, charged });
    t.guarding = false;
    await this.tweenTo(v.c, { x: p0.x, y: p0.y }, 220);
    return null;
  }

  async hit(u, skill, t, { instinct = false, charged = false }) {
    const { dmg: raw, reaction } = this.predict(u, skill, t, { instinct });
    const dmg = t.guarding ? Math.max(1, Math.round(raw * 0.7)) : raw;
    t.hp = Math.max(0, t.hp - dmg);
    this.float(t, `-${dmg}`, '#ffffff');
    const tv = this.views.get(t.id);
    this.tweens.add({ targets: tv.c, x: tv.c.x + (t.side === 'enemy' ? 10 : -10), duration: 60, yoyo: true, repeat: 1 });
    let msg = `${u.name}${instinct ? ' (instinkt)' : ''}: ${skill.name} → ${t.name} −${dmg}`;
    if (u.side === 'player') this.soul = Math.min(100, this.soul + 4);
    if (reaction) {
      this.stats.reactions += 1;
      msg += ` · ${reaction.name}!`;
      this.time.delayedCall(180 / this.speed, () => this.float(t, `${reaction.name}!`, '#ffd76a'));
      if (reaction.consume) t.st[reaction.consume] = 0;
      if (reaction.refresh) t.st[reaction.refresh] = STATUS[reaction.refresh].turns;
      if (reaction.weaken) t.st.weak = STATUS.weak.turns + 1;
      if (u.side === 'player') this.soul = Math.min(100, this.soul + 8);
    }
    if (skill.applies && t.hp > 0 && !(reaction?.consume === skill.applies)) t.st[skill.applies] = STATUS[skill.applies].turns;
    // Lámání nabíjení (jen útoky hráče na nabíjejícího nepřítele).
    if (u.side === 'player' && t.side === 'enemy' && t.intent?.type === 'charge' && t.charge > 0) {
      const minus = 1 + (skill.breakBonus ?? 0) + (reaction?.breakExtra ?? 0) - (t.boss ? 0 : 0);
      t.charge = Math.max(0, t.charge - minus);
      if (t.charge === 0) {
        this.stats.breaks += 1;
        t.st.broken = STATUS.broken.turns;
        msg += ' · ZLOMEN!';
        this.soul = Math.min(100, this.soul + 20);
        this.time.delayedCall(320 / this.speed, () => this.float(t, 'ZLOMEN!', '#ffd23a'));
      }
    }
    if (charged) msg = `⚡ ${msg}`;
    if (t.hp <= 0) msg += ` · ${t.name} padá`;
    this.log(msg);
    this.checkPhase(t);
    this.refreshUnit(t);
    return this.wait(650);
  }

  // Boss: pod 50 % HP druhá fáze.
  checkPhase(t) {
    if (!t.boss || t.phase !== 1 || t.hp <= 0 || t.hp > t.maxHp / 2) return;
    t.phase = 2;
    t.atk = Math.round(t.baseAtk * 1.3);
    this.log(`${t.name} zuří! Silnější útoky, nabíjí každé kolo.`);
    this.float(t, 'ZUŘIVOST!', '#ff5a4a');
  }

  endRound() {
    for (const u of this.units) {
      if (u.hp <= 0) continue;
      if (u.st.burn > 0) {
        u.hp = Math.max(0, u.hp - BURN_TICK);
        this.float(u, `-${BURN_TICK} 🔥`, '#ff8a4a');
      }
      for (const k of Object.keys(u.st)) if (u.st[k] > 0) u.st[k] -= 1;
    }
    this.soul = Math.min(100, this.soul + 5);
    if (this.isOver()) { this.finish(); return; }
    this.newRound();
  }

  isOver() {
    return !this.alive('enemy').length || !this.alive('player').length;
  }

  finish() {
    this.phase = 'over';
    this.refreshAll();
    const win = !this.alive('enemy').length;
    const box = this.add.container(0, 0).setDepth(90);
    this.root.add(box);
    box.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x02060a, 0.55).setOrigin(0).setInteractive());
    const bg = nineImage(this, 'nu-panel', 560, 300, 800, 420, 0.7) ?? this.add.rectangle(560, 300, 800, 420, 0x0d1d33, 0.97).setOrigin(0);
    box.add(bg);
    box.add(cardText(this, 960, 340, win ? 'Vítězství!' : 'Porážka', { size: 48, bold: true, color: win ? '#ffe7ae' : '#ff9a8a', originX: 0.5 }));
    const survivors = this.alive('player').map((u) => u.name).join(', ') || 'nikdo';
    box.add(cardText(this, 960, 420, `${this.scenario.title} · kol: ${this.round}\nReakcí: ${this.stats.reactions} · zlomení: ${this.stats.breaks}\nPřežili: ${survivors}`,
      { size: 22, color: '#dbe6f3', originX: 0.5, align: 'center', wrap: 720 }));
    const idx = SCENARIOS.indexOf(this.scenario);
    box.add(cardButton(this, null, 600, 600, 230, 62, 'Znovu', () => this.startScenario(this.scenario), { size: 22 }).objects);
    box.add(cardButton(this, null, 845, 600, 230, 62, 'Další souboj', () => this.startScenario(SCENARIOS[(idx + 1) % SCENARIOS.length]), { size: 22 }).objects);
    box.add(cardButton(this, null, 1090, 600, 230, 62, 'Výběr', () => this.showSelect(), { size: 22 }).objects);
  }
}
