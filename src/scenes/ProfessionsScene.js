import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem } from '../data/items.js';
import { RARITY, LOCATIONS } from '../data/fishing.js';
import { DEPOSITS, SPECIAL_DEPOSITS, MINING_SPECIALIZATIONS, MINING_RULES, miningClass } from '../data/mining.js';
import { HERB_SITES, SPECIAL_HERB_SITES, HERB_SPECIALIZATIONS, HERB_RULES, HERB_BY_ID, herbClass } from '../data/herbalism.js';
import { craftingClass } from '../data/crafting.js';
import { normalizeFishing } from '../systems/FishingSystem.js';
import { normalizeMining, chooseSpecialization } from '../systems/MiningSystem.js';
import { normalizeHerbalism, chooseHerbSpecialization } from '../systems/HerbalismSystem.js';
import { RECIPE_BOOKS, itemUses, itemSources, searchItems, DATABASE_FILTERS, recipeOutput } from '../systems/ProfessionDatabase.js';
import { itemIconKey, arrowKey } from '../ui/inventorySprites.js';
import {
  CARD_PANEL, cardText, cardButton, drawCardFrame, cardCloseButton, cardFlash, uiTitle, uiSection, uiSelectedRow, uiProgressBar, nineImage
} from '../ui/fantasyCard.js';
import { createCardTabBar, slideCardIn, slideCardOut } from '../ui/cardTabBar.js';

// Karta Řemesla (záložka Řemesla, klik na dovednost v kartě hrdiny, „Kde se používá“ v inventáři).
// Vlevo osm profesí a Databáze. U profese záložky Přehled (úroveň, třída, specializace, kde se
// dělá, aktivní účinky), Recepty (jen prohlížení – vyrábí se u stolu) a Naleziště (Rybolov,
// Těžba, Sběr bylin; co hráč ještě nenašel, je „???“). Databáze: všechny předměty – odkud se
// získají a ve kterých receptech se používají; klik na recept / surovinu skočí dál.

const P = CARD_PANEL;
const LEFT = { x: P.x + 34, y: P.y + 92, w: 300 };
const R = { x: P.x + 362, y: P.y + 92, w: P.w - 396 };
const C = { x: R.x, y: R.y + 74, w: R.w, h: P.y + P.h - 60 - (R.y + 74) };

const PROFS = [
  { id: 'herbalism', label: 'Sběr bylin', icon: 'herbs', master: 'Bylinkář' },
  { id: 'alchemy', label: 'Alchymie', icon: 'potion', master: 'Alchymista' },
  { id: 'mining', label: 'Těžba', icon: 'pickaxe', master: 'Horník' },
  { id: 'fishing', label: 'Rybolov', icon: 'fishing_rod', master: 'Rybář' },
  { id: 'cooking', label: 'Vaření', icon: 'cooking_pot', master: 'Kuchař' },
  { id: 'smithing', label: 'Kovářství', icon: 'ingots', master: 'Kovář' },
  { id: 'crafting', label: 'Řemeslnictví', icon: 'gear', master: 'Řemeslník' },
  { id: 'diplomacy', label: 'Diplomacie', icon: 'handshake', master: 'Diplomat' }
];
const PROF_BY_ID = Object.fromEntries(PROFS.map((p) => [p.id, p]));
const GATHERING = new Set(['fishing', 'mining', 'herbalism']);

// Kde se profese dělá (dočasně vše v Greenvale).
const WHERE = {
  herbalism: [
    'Zelené kruhy na loukách, u řeky, u vodopádu a v lese v Greenvale (E u kruhu).',
    'Záhony statku a bylinková zahrada vedle zkušebního lomu.',
    'Bylinkářka (Dům Bylinkářky): startovní srp, obchod, výkup a specializace.',
    'Srpy vykuje Kovářství.'
  ],
  alchemy: [
    'Alchymistický obchod u řeky jihozápadně od náměstí – alchymistický stůl.',
    'Byliny ze Sběru bylin, esence a materiály z monster.'
  ],
  mining: [
    'Hnědé kruhy jižně od kovárny a ve zkušebním lomu v Greenvale (E u kruhu).',
    'Hornický mistr v kovárně: startovní krumpáč, krumpáče I–III, výkup a specializace.'
  ],
  fishing: [
    'Modré kruhy na molu a na břehu řeky v Greenvale (E u kruhu).',
    'Rybář v Rybářské chatě: startovní náčiní, návnady, výkup úlovků.'
  ],
  cooking: [
    'Ohniště ve světě (klávesa F, stojí 1× Dřevo), sporák a krb v domech.',
    'Hostinská kuchyně = krb v hostinci (všechny recepty).'
  ],
  smithing: [
    'Kovárna Greenvale: výheň a kovadlina.',
    'Rudy z Těžby, kovové díly pro Řemeslnictví a Rybolov.'
  ],
  crafting: [
    'Řemeslná dílna u radnice: Koželužský stůl a Šperkařský stůl, Řemeslnice.',
    'Hvězdárna (sever za radnicí): Soul Crystal Workbench.'
  ],
  diplomacy: ['Diplomacie se připravuje – navrhneme ji samostatně.']
};

const RECIPE_FILTERS = [
  { id: 'all', label: 'Vše' },
  { id: 'can', label: 'Lze vyrobit' },
  { id: 'missing', label: 'Chybí suroviny' },
  { id: 'locked', label: 'Zamčené' }
];

const rarityColor = (item) => (RARITY[item?.rarity] ?? RARITY.common).color;
const ROW = 52;
const PAGE = 10;

export default class ProfessionsScene extends Phaser.Scene {
  constructor() {
    super('Professions');
  }

  create(data) {
    this.state = data?.state ?? SaveSystem.load();
    this.returnScene = data?.returnScene ?? 'World';
    this.storageAccess = Boolean(data?.storageAccess);
    this.closing = false;
    if (!this.state) {
      this.scene.start('Menu');
      return;
    }
    for (const book of Object.values(RECIPE_BOOKS)) book.normalize(this.state);
    normalizeFishing(this.state);
    normalizeMining(this.state);
    normalizeHerbalism(this.state);

    // Stav karty (zůstává mezi otevřeními v rámci hry).
    const memory = (this.registry.get('professionsCard') ?? {});
    this.view = {
      prof: data?.profession ?? memory.prof ?? 'herbalism',
      mode: data?.item ? 'database' : data?.profession ? 'overview' : memory.mode ?? 'overview',
      recipeFilter: 'all',
      category: {},
      recipeId: null,
      recipePage: 0,
      sitePage: 0,
      siteId: null,
      query: '',
      dbFilter: 'all',
      dbPage: 0,
      itemId: data?.item ?? memory.itemId ?? null,
      usePage: 0
    };

    drawCardFrame(this);
    uiTitle(this, P.x + 46, P.y + 22, 'Řemesla', { icon: 'anvil', size: 34 });
    this.headerText = cardText(this, P.x + P.w - 250, P.y + 34, '', { size: 20, color: '#cfe2f5', originX: 1 });
    // Zpět (i klávesa Enter): o krok zpět v historii karty až do stavu při otevření.
    this.history = [];
    this.ready = false;
    this.backButton = cardButton(this, null, P.x + P.w - 226, P.y + 18, 180, 56, 'Zpět (Enter)', () => this.back(), { size: 20 });

    // Profese vlevo + Databáze.
    this.profButtons = PROFS.map((prof, i) =>
      cardButton(this, null, LEFT.x, LEFT.y + i * 66, LEFT.w, 56, prof.label, () => this.selectProf(prof.id), { size: 21 }));
    this.dbButton = cardButton(this, null, LEFT.x, LEFT.y + PROFS.length * 66 + 22, LEFT.w, 60, 'Databáze', () => this.setMode('database'), { size: 22 });

    // Záložky profese.
    this.subButtons = {
      overview: cardButton(this, null, R.x, R.y, 220, 56, 'Přehled', () => this.setMode('overview'), { size: 21 }),
      recipes: cardButton(this, null, R.x + 236, R.y, 220, 56, 'Recepty', () => this.setMode('recipes'), { size: 21 }),
      sites: cardButton(this, null, R.x + 472, R.y, 220, 56, 'Naleziště', () => this.setMode('sites'), { size: 21 })
    };
    Object.values(this.subButtons).forEach((button, i) => { button.left = R.x + i * 236; });
    this.content = this.add.container(0, 0);

    this.input.on('wheel', (pointer, objects, dx, dy) => this.onWheel(pointer, dy));

    cardCloseButton(this, () => this.closeCard());
    const tabBar = createCardTabBar(this, 'crafting', {
      onClose: () => this.closeCard(),
      state: this.state,
      returnScene: this.returnScene,
      storageAccess: this.storageAccess,
      beforeLeave: () => this.remember()
    });
    this.tabBar = tabBar;
    if (data?.animateIn) slideCardIn(this, { hide: tabBar.objects });

    this.onKey = (event) => this.handleKey(event);
    this.input.keyboard.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));
    if (data?.item) this.openItem(data.item);
    else this.render();
    this.ready = true;
  }

  // Historie: před každým přechodem se uloží kopie zobrazení; Zpět ji obnoví.
  push() {
    if (!this.ready) return;
    this.history.push(JSON.parse(JSON.stringify(this.view)));
    if (this.history.length > 60) this.history.shift();
  }

  back() {
    const previous = this.history.pop();
    if (!previous) return;
    this.view = previous;
    this.render();
  }

  remember() {
    this.registry.set('professionsCard', { prof: this.view.prof, mode: this.view.mode, itemId: this.view.itemId });
    SaveSystem.save(this.state);
  }

  // ------------------------------------------------------------ navigace

  selectProf(id) {
    if (this.view.prof === id && this.view.mode !== 'database') return;
    this.push();
    this.view.prof = id;
    this.view.recipeId = null;
    this.view.recipePage = 0;
    this.view.siteId = null;
    this.view.sitePage = 0;
    if (this.view.mode === 'database' || !this.modeAvailable(this.view.mode)) this.view.mode = 'overview';
    this.render();
  }

  setMode(mode) {
    if (!this.modeAvailable(mode) || mode === this.view.mode) return;
    this.push();
    this.view.mode = mode;
    this.render();
  }

  modeAvailable(mode) {
    if (mode === 'database' || mode === 'overview') return true;
    if (mode === 'recipes') return Boolean(RECIPE_BOOKS[this.view.prof]);
    if (mode === 'sites') return GATHERING.has(this.view.prof);
    return false;
  }

  openItem(itemId) {
    if (this.view.mode === 'database' && this.view.itemId === itemId) return;
    this.push();
    this.view.mode = 'database';
    this.view.itemId = itemId;
    this.view.usePage = 0;
    // Stránka seznamu, na které předmět je (při aktuálním hledání; jinak hledání zrušit).
    let list = searchItems(this.view.query, this.view.dbFilter);
    if (!list.some((it) => it.id === itemId)) {
      this.view.query = '';
      this.view.dbFilter = 'all';
      list = searchItems('', 'all');
    }
    this.view.dbPage = Math.max(0, Math.floor(list.findIndex((it) => it.id === itemId) / 11));
    this.render();
  }

  openRecipe(prof, recipe) {
    this.push();
    this.view.prof = prof;
    this.view.mode = 'recipes';
    this.view.recipeFilter = 'all';
    this.view.category[prof] = recipe.category;
    this.view.recipeId = recipe.id;
    const list = this.recipeList();
    this.view.recipePage = Math.max(0, Math.floor(list.findIndex((r) => r.id === recipe.id) / PAGE));
    this.render();
  }

  handleKey(event) {
    if (event.repeat && event.key !== 'Backspace') return;
    if (event.code === 'Escape') {
      this.closeCard();
      return;
    }
    // Enter (Return) = Zpět; Backspace maže hledaný text v Databázi.
    if (event.code === 'Enter' || event.code === 'NumpadEnter') {
      if (!event.repeat) this.back();
      return;
    }
    if (event.key === 'Backspace') {
      if (this.view.mode === 'database' && this.view.query) {
        this.view.query = this.view.query.slice(0, -1);
        this.view.dbPage = 0;
        this.render();
      }
      return;
    }
    if (this.view.mode !== 'database') return;
    if (event.key.length === 1 && /[\p{L}\p{N} \-']/u.test(event.key) && this.view.query.length < 24) {
      this.view.query += event.key;
    } else {
      return;
    }
    this.view.dbPage = 0;
    this.render();
  }

  onWheel(pointer, dy) {
    const step = dy > 0 ? 1 : -1;
    if (this.view.mode === 'recipes' && pointer.x > C.x + 270 && pointer.x < C.x + 800) this.turn('recipePage', step, this.recipeList().length, PAGE);
    else if (this.view.mode === 'sites' && pointer.x < C.x + 560) this.turn('sitePage', step, this.siteList().length, 11);
    else if (this.view.mode === 'database' && pointer.x < C.x + 600) this.turn('dbPage', step, searchItems(this.view.query, this.view.dbFilter).length, 11);
  }

  turn(key, step, total, size) {
    const pages = Math.max(1, Math.ceil(total / size));
    const page = Phaser.Math.Clamp(this.view[key] + step, 0, pages - 1);
    if (page === this.view[key]) return;
    this.view[key] = page;
    this.render();
  }

  // ------------------------------------------------------------ vykreslení

  level(id) {
    return this.state.professions?.[id]?.level ?? 1;
  }

  render() {
    this.content.removeAll(true);
    const v = this.view;
    PROFS.forEach((prof, i) => {
      const button = this.profButtons[i];
      button.setLabel(prof.id === 'diplomacy' ? prof.label : `${prof.label}  ${this.level(prof.id)}`);
      button.setActive(v.mode !== 'database' && v.prof === prof.id);
    });
    this.dbButton.setActive(v.mode === 'database');
    this.backButton.setDisabled(this.history.length === 0);
    // Záložky profese vedle sebe (bez mezery za chybějící záložkou).
    let slot = 0;
    for (const [mode, button] of Object.entries(this.subButtons)) {
      const available = v.mode !== 'database' && this.modeAvailable(mode);
      if (available) {
        const target = R.x + slot * 236;
        for (const o of button.objects) o.x += target - button.left;
        button.left = target;
        slot += 1;
      }
      for (const o of button.objects) o.setVisible(available);
      button.setActive(v.mode === mode);
    }
    const prof = PROF_BY_ID[v.prof];
    this.headerText.setText(v.mode === 'database' ? 'Databáze předmětů' : `${prof.label} · úroveň ${this.level(prof.id)}`);

    if (v.mode === 'database') this.renderDatabase();
    else if (v.mode === 'recipes') this.renderRecipes();
    else if (v.mode === 'sites') this.renderSites();
    else this.renderOverview();
  }

  // Pomocníci pro obsah (vše jde do this.content a při překreslení se zničí).
  text(x, y, value, options = {}) {
    const t = cardText(this, x, y, value, options);
    this.content.add(t);
    return t;
  }

  button(x, y, w, h, label, onClick, options = {}) {
    const b = cardButton(this, null, x, y, w, h, label, onClick, options);
    this.content.add(b.objects);
    return b;
  }

  section(x, y, w, h) {
    const s = uiSection(this, x, y, w, h);
    this.content.add(s);
    return s;
  }

  icon(itemId, x, y, size) {
    const item = getItem(itemId);
    const key = item?.icon ? itemIconKey(item.icon) : null;
    if (!key || !this.textures.exists(key)) return null;
    const image = this.add.image(x, y, key).setOrigin(0.5);
    image.setScale(size / Math.max(image.width, image.height));
    this.content.add(image);
    return image;
  }

  // Klikací řádek seznamu (nevybraný = tlačítko nové sady, vybraný = zlatý).
  listRow(x, y, w, h, selected, onClick) {
    const bg = selected ? uiSelectedRow(this, x, y, w, h) : nineImage(this, 'nu-btn', x, y, w, h, 0.4);
    if (bg) this.content.add(bg);
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', onClick);
    this.content.add(zone);
  }

  // Odkaz (text, který po kliknutí někam skočí).
  link(x, y, value, onClick, options = {}) {
    const t = this.text(x, y, value, { size: 19, color: '#8fd3ff', ...options });
    t.setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setColor('#ffe7ae'));
    t.on('pointerout', () => t.setColor(options.color ?? '#8fd3ff'));
    t.on('pointerdown', onClick);
    return t;
  }

  // Šipka stránky jako v inventáři (zlatá, pod myší světlejší, nedostupná průhledná).
  arrow(cx, cy, dir, enabled, onClick) {
    const w = 44;
    const h = 76;
    if (this.textures.exists(arrowKey(dir, 'normal'))) {
      const image = this.add.image(cx, cy, arrowKey(dir, 'normal')).setDisplaySize(w, h).setAlpha(enabled ? 1 : 0.3);
      this.content.add(image);
      if (!enabled) return;
      const zone = this.add.zone(cx - w / 2 - 10, cy - h / 2, w + 20, h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => image.setTexture(arrowKey(dir, 'hover')).setDisplaySize(w, h));
      zone.on('pointerout', () => image.setTexture(arrowKey(dir, 'normal')).setDisplaySize(w, h));
      zone.on('pointerdown', onClick);
      this.content.add(zone);
      return;
    }
    this.button(cx - 45, cy - 27, 90, 54, dir === 'left' ? '<' : '>', onClick, { size: 21, disabled: !enabled });
  }

  pager(x, y, w, key, total, size) {
    const pages = Math.max(1, Math.ceil(total / size));
    if (pages <= 1) return;
    const page = this.view[key];
    this.arrow(x + 30, y + 27, 'left', page > 0, () => this.turn(key, -1, total, size));
    this.arrow(x + w - 30, y + 27, 'right', page < pages - 1, () => this.turn(key, 1, total, size));
    this.text(x + w / 2, y + 27, `${page + 1} / ${pages}`, { size: 19, color: '#9fb3c8', originX: 0.5, originY: 0.5 });
  }

  // ------------------------------------------------------------ Přehled

  renderOverview() {
    const prof = PROF_BY_ID[this.view.prof];
    this.section(C.x, C.y, C.w, C.h);
    const x = C.x + 30;
    let y = C.y + 24;
    if (prof.id === 'diplomacy') {
      this.text(x, y, 'Diplomacie', { size: 30, bold: true, color: '#ffe7ae' });
      this.text(x, y + 56, 'Diplomacie se připravuje. Navrhneme ji samostatně (vyjednávání s monstry,\nceny u obchodníků, úkoly frakcí…).', { size: 21, color: '#dbe6f3', lineSpacing: 8 });
      return;
    }

    const data = this.state.professions[prof.id];
    const cls = this.classOf(prof);
    this.text(x, y, `${prof.label} – úroveň ${data.level}`, { size: 30, bold: true, color: '#ffe7ae' });
    this.text(x + 620, y + 6, `Třída ${cls.id} – ${cls.name}`, { size: 22, color: '#ffd76a' });
    y += 54;
    const bar = uiProgressBar(this, x, y + 6, 560, 20, 0xffc94a);
    bar.set(data.level >= 100 ? 1 : data.exp / Math.max(1, data.next));
    this.content.add(bar.objects);
    this.text(x + 580, y, data.level >= 100 ? 'Maximální úroveň' : `${data.exp} / ${data.next} XP`, { size: 20, color: '#cfe2f5' });
    y += 50;

    // Shrnutí podle profese.
    const lines = this.summaryLines(prof);
    for (const line of lines) {
      this.text(x, y, line, { size: 20, color: '#dbe6f3', wrap: 1240 });
      y += 32;
    }
    y += 12;

    this.text(x, y, 'Kde se profese dělá', { size: 22, bold: true, color: '#ffe7ae' });
    y += 36;
    for (const line of WHERE[prof.id] ?? []) {
      this.text(x + 16, y, `• ${line}`, { size: 19, color: '#dbe6f3', wrap: 1220 });
      y += 30;
    }
    y += 14;

    // Specializace (Těžba, Sběr bylin) / Řemeslník (Kovářství, Řemeslnictví).
    if (prof.id === 'mining' || prof.id === 'herbalism') {
      y = this.renderSpecializations(prof, x, y);
    } else if (prof.id === 'smithing' || prof.id === 'crafting') {
      const craftsman = this.state.talentProgress?.specialization === 'crafting';
      this.text(x, y, 'Specializace', { size: 22, bold: true, color: '#ffe7ae' });
      this.text(x + 16, y + 36, craftsman
        ? 'Řemeslník (talenty): výbava z Kovářství a Řemeslnictví dává o 20 % vyšší bonusy.'
        : 'Talentová specializace Řemeslník zvýší bonusy vyrobené výbavy o 20 %.', { size: 19, color: craftsman ? '#7fd67a' : '#9fb3c8', wrap: 1220 });
      y += 80;
    }

    // Aktivní účinky (lektvary, cestovní předměty).
    const effects = Object.values(this.state.alchemyEffects ?? {}).filter((e) => e && (e.until > Date.now() || e.battlesLeft > 0));
    if (effects.length && y < C.y + C.h - 70) {
      this.text(x, y, 'Aktivní účinky', { size: 22, bold: true, color: '#ffe7ae' });
      const list = effects.map((e) => `${e.name ?? 'Účinek'} (${e.until > Date.now() ? `${Math.ceil((e.until - Date.now()) / 60000)} min` : `${e.battlesLeft} soubojů`})`).join(' · ');
      this.text(x + 16, y + 36, list, { size: 19, color: '#7fd67a', wrap: 1220 });
    }
  }

  classOf(prof) {
    const level = this.level(prof.id);
    if (prof.id === 'mining') return miningClass(level);
    if (prof.id === 'herbalism') return herbClass(level);
    if (prof.id === 'crafting') return craftingClass(level);
    const base = craftingClass(level);
    const names = { III: prof.master, VI: `Legendární ${prof.master.toLowerCase()}` };
    return { ...base, name: names[base.id] ?? base.name };
  }

  summaryLines(prof) {
    const book = RECIPE_BOOKS[prof.id];
    if (book) {
      const level = book.level(this.state);
      const known = book.all.filter((r) => book.known(this.state, r));
      const open = known.filter((r) => r.level <= level);
      const can = open.filter((r) => this.missing(prof.id, r) === 0);
      const made = Object.keys(this.state[prof.id]?.made ?? {}).length;
      return [
        `Receptů: ${book.all.length} · známých ${known.length} · dostupných na tvé úrovni ${open.length} · ze surovin v inventáři ${can.length}`,
        ...(made ? [`Vyrobeno různých receptů: ${made}`] : [])
      ];
    }
    if (prof.id === 'fishing') {
      const species = Object.keys(this.state.fishing.log).filter((id) => this.state.fishing.log[id] > 0).length;
      return [`Lokalit: ${LOCATIONS.length} · ulovených druhů: ${species} · úlovků celkem: ${Object.values(this.state.fishing.log).reduce((s, n) => s + n, 0)}`];
    }
    if (prof.id === 'mining') {
      const sites = [...DEPOSITS, ...SPECIAL_DEPOSITS];
      const mined = sites.filter((d) => this.state.mining.log[d.id] > 0).length;
      return [`Nalezišť: ${sites.length} · vytěžených: ${mined} · těžeb celkem: ${Object.values(this.state.mining.log).reduce((s, n) => s + n, 0)}`];
    }
    if (prof.id === 'herbalism') {
      const herbs = Object.keys(this.state.herbalism.log).filter((id) => this.state.herbalism.log[id] > 0).length;
      return [`Nalezišť: ${HERB_SITES.length + SPECIAL_HERB_SITES.length} · herbář: ${herbs} druhů · nasbíráno celkem: ${Object.values(this.state.herbalism.log).reduce((s, n) => s + n, 0)} ks`];
    }
    return [];
  }

  renderSpecializations(prof, x, y) {
    const mining = prof.id === 'mining';
    const specs = mining ? MINING_SPECIALIZATIONS : HERB_SPECIALIZATIONS;
    const rules = mining ? MINING_RULES : HERB_RULES;
    const current = mining ? this.state.mining.specialization : this.state.herbalism.specialization;
    const unlocked = this.level(prof.id) >= rules.specializationLevel;
    this.text(x, y, `Specializace${unlocked ? (current ? ` (změna stojí ${rules.specializationChangeCost} zl)` : ' – zvol jednu') : ` – odemkne se na úrovni ${rules.specializationLevel}`}`,
      { size: 22, bold: true, color: '#ffe7ae' });
    y += 40;
    for (const spec of specs) {
      const chosen = spec.id === current;
      this.text(x + 16, y, `${spec.name}${chosen ? '  ✓' : ''}`, { size: 20, bold: true, color: chosen ? '#7fd67a' : '#f3e4bd' });
      const about = this.text(x + 16, y + 30, spec.text, { size: 18, color: '#b9c6d3', wrap: 1040 });
      this.button(x + 1080, y + 2, 200, 54, chosen ? 'Zvoleno' : 'Zvolit', () => {
        const result = mining ? chooseSpecialization(this.state, spec.id) : chooseHerbSpecialization(this.state, spec.id);
        cardFlash(this, result.message, result.ok ? '#7fd67a' : '#ffb3a0');
        if (result.ok) SaveSystem.save(this.state);
        this.render();
      }, { size: 20, disabled: !unlocked || chosen });
      y += Math.max(66, 30 + about.height + 14);
    }
    return y;
  }

  // ------------------------------------------------------------ Recepty

  missing(prof, recipe) {
    const book = RECIPE_BOOKS[prof];
    return Object.entries(recipe.ingredients ?? {}).reduce((sum, [key, qty]) => sum + Math.max(0, qty - book.count(this.state, key)), 0);
  }

  recipeState(prof, recipe) {
    const book = RECIPE_BOOKS[prof];
    if (!book.known(this.state, recipe)) return 'unknown';
    if (book.level(this.state) < recipe.level) return 'locked';
    return this.missing(prof, recipe) === 0 ? 'can' : 'missing';
  }

  recipeList() {
    const prof = this.view.prof;
    const book = RECIPE_BOOKS[prof];
    const category = this.view.category[prof] ?? book.categories[0].id;
    const filter = this.view.recipeFilter;
    return book.all
      .filter((r) => r.category === category)
      .filter((r) => {
        if (filter === 'all') return true;
        const st = this.recipeState(prof, r);
        return filter === 'locked' ? st === 'locked' || st === 'unknown' : st === filter;
      })
      .sort((a, b) => a.level - b.level);
  }

  renderRecipes() {
    const prof = this.view.prof;
    const book = RECIPE_BOOKS[prof];
    const category = (this.view.category[prof] ??= book.categories[0].id);

    RECIPE_FILTERS.forEach((f, i) => {
      const b = this.button(C.x + 640 + i * 180, R.y, 172, 56, f.label, () => {
        this.view.recipeFilter = f.id;
        this.view.recipePage = 0;
        this.render();
      }, { size: 20 });
      b.setActive(this.view.recipeFilter === f.id);
    });

    book.categories.forEach((cat, i) => {
      const b = this.button(C.x, C.y + i * 58, 250, 54, cat.label, () => {
        this.view.category[prof] = cat.id;
        this.view.recipePage = 0;
        this.view.recipeId = null;
        this.render();
      }, { size: 19 });
      b.setActive(cat.id === category);
    });

    const list = this.recipeList();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    this.view.recipePage = Phaser.Math.Clamp(this.view.recipePage, 0, pages - 1);
    const shown = list.slice(this.view.recipePage * PAGE, (this.view.recipePage + 1) * PAGE);
    if (!shown.some((r) => r.id === this.view.recipeId)) this.view.recipeId = shown[0]?.id ?? null;

    const lx = C.x + 270;
    const lw = 520;
    if (!shown.length) this.text(lx + lw / 2, C.y + 40, 'Žádný recept neodpovídá filtru.', { size: 20, color: '#9fb3c8', originX: 0.5 });
    shown.forEach((recipe, i) => {
      const y = C.y + i * (ROW + 6);
      const st = this.recipeState(prof, recipe);
      const color = { can: '#7fd67a', missing: '#f3e4bd', locked: '#8d8378', unknown: '#6c7480' }[st];
      const label = { can: 'lze vyrobit', missing: 'chybí suroviny', locked: `úr. ${recipe.level}`, unknown: 'neznámý' }[st];
      this.listRow(lx, y, lw, ROW, recipe.id === this.view.recipeId, () => { if (recipe.id === this.view.recipeId) return; this.push(); this.view.recipeId = recipe.id; this.render(); });
      const tag = this.text(lx + lw - 16, y + ROW / 2, label, { size: 17, bold: true, color, originX: 1, originY: 0.5 });
      const name = this.text(lx + 16, y + ROW / 2, `${recipe.level}  ${recipe.name}`, { size: 19, bold: true, color, originY: 0.5 });
      const room = lw - 48 - tag.width;
      if (name.width > room) name.setScale(room / name.width);
    });
    this.pager(lx, C.y + PAGE * (ROW + 6) + 8, lw, 'recipePage', list.length, PAGE);

    const recipe = book.all.find((r) => r.id === this.view.recipeId);
    const dx = C.x + 810;
    const dw = C.w - 810;
    this.section(dx, C.y, dw, C.h);
    if (recipe) this.renderRecipeDetail(prof, recipe, dx + 24, C.y + 20, dw - 48);
  }

  renderRecipeDetail(prof, recipe, x, y, w) {
    const book = RECIPE_BOOKS[prof];
    const output = recipeOutput(prof, recipe);
    if (output) this.icon(output.id, x + 30, y + 30, 56);
    const title = output
      ? this.link(x + 72, y + 8, recipe.name, () => this.openItem(output.id), { size: 26, bold: true, color: '#ffe7ae', wrap: w - 80 })
      : this.text(x + 72, y + 8, recipe.name, { size: 26, bold: true, color: '#ffe7ae', wrap: w - 80 });
    y += Math.max(70, title.height + 24);
    const add = (value, options = {}) => {
      const t = this.text(x, y, value, { size: 19, color: '#dbe6f3', wrap: w, ...options });
      y += t.height + 10;
      return t;
    };
    add(`${recipe.category === 'M' ? 'Mezivýrobek' : recipe.id} · ${book.title} ${recipe.level} · ${book.stations[recipe.station]?.name ?? ''} · ${recipe.qty} ks`, { size: 18, color: '#9fc4e6' });
    add(book.describe(recipe.effect) || '—', { size: 19 });
    add('Suroviny (klikni pro databázi):', { size: 20, bold: true, color: '#ffe7ae' });
    for (const [key, qty] of Object.entries(recipe.ingredients ?? {})) {
      const have = book.count(this.state, key);
      const ok = have >= qty;
      const ids = key.split('|');
      let cx = x;
      const mark = this.text(cx, y, `${ok ? '✓' : '✗'} ${qty}×`, { size: 19, bold: true, color: ok ? '#7fd67a' : '#ff9a8a' });
      cx += mark.width + 8;
      // Hodně náhrad (např. kterákoli kůže z monster): jeden zalomený text místo odkazů.
      if (ids.length > 3) {
        const names = this.text(cx, y, `kterákoli z: ${ids.map((id) => getItem(id)?.name ?? id).join(', ')}  (máš ${have})`,
          { size: 17, color: '#cfd6de', wrap: w - (cx - x) });
        y += names.height + 10;
        continue;
      }
      ids.forEach((id, i) => {
        if (i > 0) cx += this.text(cx, y, ' nebo ', { size: 18, color: '#9fb3c8' }).width;
        cx += this.link(cx, y, getItem(id)?.name ?? id, () => this.openItem(id)).width;
      });
      this.text(cx + 10, y, `(máš ${have})`, { size: 18, color: '#9fb3c8' });
      y += 32;
    }
    y += 6;
    add(`Původ receptu: ${book.origins[recipe.origin] ?? recipe.origin}`, { size: 17, color: '#8f9aa6' });
    add('Vyrábí se u pracoviště, karta Řemesla recepty jen ukazuje.', { size: 17, color: '#8f9aa6' });
  }

  // ------------------------------------------------------------ Naleziště

  siteList() {
    if (this.view.prof === 'fishing') return LOCATIONS;
    if (this.view.prof === 'mining') return [...DEPOSITS, ...SPECIAL_DEPOSITS];
    return [...HERB_SITES, ...SPECIAL_HERB_SITES];
  }

  renderSites() {
    const list = this.siteList();
    const size = 11;
    const pages = Math.max(1, Math.ceil(list.length / size));
    this.view.sitePage = Phaser.Math.Clamp(this.view.sitePage, 0, pages - 1);
    const shown = list.slice(this.view.sitePage * size, (this.view.sitePage + 1) * size);
    if (!shown.some((s) => s.id === this.view.siteId)) this.view.siteId = shown[0]?.id ?? null;
    const level = this.level(this.view.prof);
    const lw = 540;
    shown.forEach((site, i) => {
      const y = C.y + i * 50;
      const open = level >= site.minLevel;
      this.listRow(C.x, y, lw, 46, site.id === this.view.siteId, () => { this.view.siteId = site.id; this.render(); });
      const tag = this.text(C.x + lw - 14, y + 23, `úr. ${site.minLevel}`, { size: 17, bold: true, color: open ? '#9fc4e6' : '#8d8378', originX: 1, originY: 0.5 });
      const name = this.text(C.x + 14, y + 23, site.name, { size: 19, bold: true, color: open ? '#f3e4bd' : '#8d8378', originY: 0.5 });
      const room = lw - 40 - tag.width;
      if (name.width > room) name.setScale(room / name.width);
    });
    this.pager(C.x, C.y + size * 50 + 8, lw, 'sitePage', list.length, size);

    const site = list.find((s) => s.id === this.view.siteId);
    const dx = C.x + lw + 20;
    const dw = C.w - lw - 20;
    this.section(dx, C.y, dw, C.h);
    if (site) this.renderSiteDetail(site, dx + 24, C.y + 20, dw - 48);
  }

  renderSiteDetail(site, x, y, w) {
    const prof = this.view.prof;
    this.text(x, y, site.name, { size: 28, bold: true, color: '#ffe7ae', wrap: w });
    y += 48;
    const extra = prof === 'fishing' ? ` · ${site.water}` : site.biome ? ` · ${site.biome}` : '';
    this.text(x, y, `${site.region}${extra} · od úrovně ${site.minLevel}`, { size: 19, color: '#9fc4e6' });
    y += 34;
    if (prof === 'mining') {
      const times = this.state.mining.log[site.id] ?? 0;
      this.text(x, y, times ? `Vytěženo: ${times}×` : 'Zatím jsi tu netěžil.', { size: 18, color: '#9fb3c8' });
      y += 32;
    }
    this.text(x, y, prof === 'fishing' ? 'Možné úlovky (bez návnady):' : 'Co se tu dá získat:', { size: 21, bold: true, color: '#ffe7ae' });
    y += 38;

    const rows = this.siteRows(site);
    const total = rows.reduce((s, r) => s + (r.weight ?? 0), 0);
    for (const row of rows) {
      if (y > C.y + C.h - 40) break;
      const item = getItem(row.id);
      const known = this.isDiscovered(row.id);
      const name = known ? item?.name ?? row.id : '???';
      const t = known
        ? this.link(x + 40, y, name, () => this.openItem(row.id), { color: rarityColor(item) })
        : this.text(x + 40, y, name, { size: 19, color: '#8d8378' });
      if (known) this.icon(row.id, x + 16, y + 12, 28);
      const note = row.weight && total ? `${((row.weight / total) * 100).toFixed(1).replace('.', ',')} %` : row.note ?? '';
      this.text(x + w, y, note, { size: 18, color: '#cfd6de', originX: 1 });
      if (prof === 'fishing' && known) this.text(x + 60 + t.width, y + 2, `(uloveno ${this.state.fishing.log[row.id]}×)`, { size: 16, color: '#8f9aa6' });
      y += 34;
    }
    if (prof !== 'mining') this.text(x, C.y + C.h - 40, 'Druhy, které jsi ještě nezískal, jsou „???“.', { size: 17, color: '#8f9aa6' });
  }

  siteRows(site) {
    const prof = this.view.prof;
    if (prof === 'fishing') return Object.entries(site.table).map(([id, weight]) => ({ id, weight })).sort((a, b) => b.weight - a.weight);
    if (site.table) return [
      ...(site.guaranteed ? [{ id: site.guaranteed, note: 'zaručeně' }] : []),
      ...Object.entries(site.table).map(([id, weight]) => ({ id, weight })).sort((a, b) => b.weight - a.weight),
      ...(site.finds ?? []).map((id) => ({ id, note: 'vzácný nález' })),
      ...(site.rareFind ? [{ id: site.rareFind.id, note: 'vzácný nález' }] : [])
    ];
    return [
      { id: site.main, note: 'hlavní' },
      ...(Array.isArray(site.sides) ? site.sides : site.side ? [site.side] : []).map((id) => ({ id, note: 'vedlejší' }))
    ];
  }

  isDiscovered(itemId) {
    if (this.view.prof === 'fishing') return this.state.fishing.log[itemId] > 0;
    if (this.view.prof === 'herbalism') return !HERB_BY_ID[itemId] || this.state.herbalism.log[itemId] > 0;
    return true;
  }

  // ------------------------------------------------------------ Databáze

  renderDatabase() {
    const v = this.view;
    // Hledání: píše se rovnou na klávesnici.
    const box = nineImage(this, 'nu-slot', R.x, R.y, 520, 56, 0.4);
    if (box) this.content.add(box);
    this.text(R.x + 18, R.y + 28, v.query ? `${v.query}|` : 'Hledat: piš na klávesnici…', { size: 20, color: v.query ? '#fff4d6' : '#8f9aa6', originY: 0.5 });
    if (v.query) this.button(R.x + 530, R.y, 120, 56, 'Smazat', () => { v.query = ''; v.dbPage = 0; this.render(); }, { size: 19 });
    DATABASE_FILTERS.forEach((f, i) => {
      const b = this.button(R.x + 660 + i * 140, R.y, 134, 56, f.label, () => { v.dbFilter = f.id; v.dbPage = 0; this.render(); }, { size: 20 });
      b.setActive(v.dbFilter === f.id);
    });

    const list = searchItems(v.query, v.dbFilter);
    const size = 11;
    const pages = Math.max(1, Math.ceil(list.length / size));
    v.dbPage = Phaser.Math.Clamp(v.dbPage, 0, pages - 1);
    const shown = list.slice(v.dbPage * size, (v.dbPage + 1) * size);
    if (!v.itemId || !list.some((it) => it.id === v.itemId)) v.itemId = shown[0]?.id ?? null;
    const lw = 580;
    if (!shown.length) this.text(C.x + lw / 2, C.y + 40, 'Nic nenalezeno.', { size: 20, color: '#9fb3c8', originX: 0.5 });
    shown.forEach((item, i) => {
      const y = C.y + i * 50;
      this.listRow(C.x, y, lw, 46, item.id === v.itemId, () => { if (item.id === this.view.itemId) return; this.push(); this.view.itemId = item.id; this.view.usePage = 0; this.render(); });
      this.icon(item.id, C.x + 28, y + 23, 34);
      const name = this.text(C.x + 56, y + 23, item.name, { size: 19, bold: true, color: rarityColor(item), originY: 0.5 });
      if (name.width > lw - 70) name.setScale((lw - 70) / name.width);
    });
    this.pager(C.x, C.y + size * 50 + 8, lw, 'dbPage', list.length, size);
    this.text(C.x + lw / 2, C.y + size * 50 + 70, `${list.length} předmětů`, { size: 17, color: '#8f9aa6', originX: 0.5 });

    const dx = C.x + lw + 20;
    const dw = C.w - lw - 20;
    this.section(dx, C.y, dw, C.h);
    const item = getItem(v.itemId);
    if (item) this.renderItemDetail(item, dx + 24, C.y + 20, dw - 48);
  }

  renderItemDetail(item, x, y, w) {
    this.icon(item.id, x + 34, y + 34, 64);
    this.text(x + 84, y + 4, item.name, { size: 28, bold: true, color: rarityColor(item), wrap: w - 90 });
    this.text(x + 84, y + 44, `${(RARITY[item.rarity] ?? RARITY.common).label}${item.price ? ` · cena ${item.price} zl` : ''} · máš ${this.countOf(item.id)}`, { size: 18, color: '#9fc4e6' });
    y += 86;
    const desc = this.text(x, y, item.description ?? '', { size: 18, color: '#dbe6f3', wrap: w });
    y += desc.height + 16;

    // Odkud.
    const sources = itemSources(item.id);
    this.text(x, y, 'Kde získat', { size: 21, bold: true, color: '#ffe7ae' });
    y += 34;
    if (!sources.length) {
      this.text(x + 16, y, 'Zatím ve hře nezískatelné (příběh, úkol nebo připravovaný obsah).', { size: 18, color: '#9fb3c8', wrap: w - 16 });
      y += 30;
    }
    const maxSources = 5;
    for (const source of sources.slice(0, maxSources)) {
      if (source.kind === 'recipe') this.link(x + 16, y, `• ${source.text}`, () => this.openRecipe(source.prof, source.recipe), { size: 18, wrap: w - 16 });
      else this.text(x + 16, y, `• ${source.text}`, { size: 18, color: '#dbe6f3', wrap: w - 16 });
      y += 28;
    }
    if (sources.length > maxSources) {
      this.text(x + 16, y, `… a dalších ${sources.length - maxSources} míst`, { size: 17, color: '#8f9aa6' });
      y += 28;
    }
    y += 12;

    // Použití v receptech (stránkované).
    const uses = itemUses(item.id);
    this.text(x, y, `Používá se v receptech (${uses.length})`, { size: 21, bold: true, color: '#ffe7ae' });
    y += 36;
    if (!uses.length) {
      this.text(x + 16, y, 'V žádném receptu.', { size: 18, color: '#9fb3c8' });
      return;
    }
    const room = Math.max(3, Math.floor((C.y + C.h - 80 - y) / 30));
    const pages = Math.ceil(uses.length / room);
    this.view.usePage = Phaser.Math.Clamp(this.view.usePage, 0, pages - 1);
    for (const use of uses.slice(this.view.usePage * room, (this.view.usePage + 1) * room)) {
      const book = RECIPE_BOOKS[use.prof];
      this.link(x + 16, y, `• ${book.title} ${use.recipe.level}: ${use.recipe.name} – ${use.qty}×${use.alternative ? ' (nebo náhrada)' : ''}`,
        () => this.openRecipe(use.prof, use.recipe), { size: 18, wrap: w - 16 });
      y += 30;
    }
    if (pages > 1) {
      const by = C.y + C.h - 70;
      this.arrow(x + 30, by + 27, 'left', this.view.usePage > 0, () => { this.view.usePage -= 1; this.render(); });
      this.arrow(x + 270, by + 27, 'right', this.view.usePage < pages - 1, () => { this.view.usePage += 1; this.render(); });
      this.text(x + 150, by + 27, `${this.view.usePage + 1} / ${pages}`, { size: 19, color: '#9fb3c8', originX: 0.5, originY: 0.5 });
    }
  }

  countOf(itemId) {
    return (this.state.inventory?.slots ?? []).reduce((sum, slot) => sum + (slot?.id === itemId ? slot.qty : 0), 0);
  }

  closeCard() {
    if (this.closing) return;
    this.closing = true;
    this.remember();
    slideCardOut(this, () => {
      this.scene.stop();
      this.scene.resume(this.returnScene);
    }, { hide: this.tabBar?.objects });
  }
}
