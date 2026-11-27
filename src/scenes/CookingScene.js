import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem } from '../data/items.js';
import { getItemCount, removeItem } from '../systems/InventorySystem.js';
import { CATEGORIES, STATIONS, ORIGINS, ALL_COOKING, describeEffect } from '../data/cooking.js';
import {
  normalizeCooking, isKnown, canCook, cook, maxBatches, ingredientCount, cookingLevel
} from '../systems/CookingSystem.js';
import { ALCHEMY_CATEGORIES, ALCHEMY_STATIONS, ALCHEMY_ORIGINS, ALL_ALCHEMY, describeAlchemy } from '../data/alchemy.js';
import {
  normalizeAlchemy, isAlchemyKnown, canBrew, brew, alchemyMaxBatches, alchemyIngredientCount, alchemyLevel
} from '../systems/AlchemySystem.js';
import { SMITHING_CATEGORIES, SMITHING_STATIONS, SMITHING_ORIGINS, ALL_SMITHING, SMITHING_SUBFILTERS, describeSmithing } from '../data/smithing.js';
import {
  normalizeSmithing, isSmithingKnown, canForge, forge, smithingMaxBatches, smithingIngredientCount, smithingLevel
} from '../systems/SmithingSystem.js';
import { CRAFTING_CATEGORIES, CRAFTING_STATIONS, CRAFTING_ORIGINS, ALL_CRAFTING, describeCrafting } from '../data/crafting.js';
import {
  normalizeCrafting, isCraftingKnown, canCraft, craftItem, craftingMaxBatches, craftingIngredientCount, craftingLevel, craftingStationOk
} from '../systems/CraftingSystem.js';
import { recipeOutput, itemUses, RECIPE_BOOKS } from '../systems/ProfessionDatabase.js';
import { cardText, cardButton, uiWindow, uiTitle, uiProgressBar } from '../ui/fantasyCard.js';
import { arrowKey } from '../ui/inventorySprites.js';
import { tileRow, darkPanel, headingLine, itemIcon, framedIcon, rarityColor, roundBox, questMarkObjects } from '../ui/craftLook.js';
import { questCraftList } from '../systems/QuestSystem.js';
import { beginSkillXpBatch, endSkillXpBatch } from '../systems/SkillXpEvents.js';
import { isNewRecipe, seeRecipe, newRecipeCount } from '../systems/NewRecipeSystem.js';
import { newRecipeStar } from '../ui/craftLook.js';

// Výrobní profese, které okno umí (Vaření = scéna Cooking, Alchymie = scéna Alchemy).
const PROFESSIONS = {
  Cooking: {
    icon: 'cooking_pot', title: 'Vaření', prof: 'cooking', make: 'Uvařit', made: 'Vaření', categories: CATEGORIES, stations: STATIONS,
    origins: ORIGINS, all: ALL_COOKING, describe: describeEffect, normalize: normalizeCooking, known: isKnown,
    can: canCook, craft: cook, batches: maxBatches, count: ingredientCount, level: cookingLevel
  },
  Alchemy: {
    icon: 'potion', title: 'Alchymie', prof: 'alchemy', make: 'Vyrobit', made: 'Alchymie', categories: ALCHEMY_CATEGORIES, stations: ALCHEMY_STATIONS,
    origins: ALCHEMY_ORIGINS, all: ALL_ALCHEMY, describe: describeAlchemy, normalize: normalizeAlchemy, known: isAlchemyKnown,
    can: canBrew, craft: brew, batches: alchemyMaxBatches, count: alchemyIngredientCount, level: alchemyLevel
  },
  Smithing: {
    icon: 'anvil', title: 'Kovářství', prof: 'smithing', make: 'Vykovat', made: 'Kovářství', categories: SMITHING_CATEGORIES, stations: SMITHING_STATIONS,
    origins: SMITHING_ORIGINS, all: ALL_SMITHING, describe: describeSmithing, normalize: normalizeSmithing, known: isSmithingKnown,
    can: canForge, craft: forge, batches: smithingMaxBatches, count: smithingIngredientCount, level: smithingLevel,
    subfilters: SMITHING_SUBFILTERS
  },
  // Řemeslnictví: tři různá pracoviště (ne stupně) – recept jen na svém pracovišti; okno začne
  // kategorií, kterou pracoviště vyrábí.
  Crafting: {
    icon: 'gear', title: 'Řemeslnictví', prof: 'crafting', make: 'Vyrobit', made: 'Řemeslnictví', categories: CRAFTING_CATEGORIES, stations: CRAFTING_STATIONS,
    origins: CRAFTING_ORIGINS, all: ALL_CRAFTING, describe: describeCrafting, normalize: normalizeCrafting, known: isCraftingKnown,
    can: canCraft, craft: craftItem, batches: craftingMaxBatches, count: craftingIngredientCount, level: craftingLevel,
    stationOk: craftingStationOk, stationCategory: { 1: 'D', 2: 'A', 3: 'E' }
  }
};

// Okno výroby u pracoviště (Vaření, Alchymie, Kovářství, Řemeslnictví). Vlevo filtry
// (Vše + kategorie), uprostřed recepty s ikonou výrobku (zelená = jde vyrobit, bílá = chybí
// suroviny, šedá = vyšší úroveň nebo jiné pracoviště), vpravo detail se surovinami
// (klik = Databáze) a tlačítka ×1 / ×5. Ukazují se jen naučené recepty a nejvýš o
// RANGE úrovní nad úrovní profese.

const W = 1720;
const H = 960;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;
const RANGE = 5;
const ROW_H = 60; // krok řádku receptu (řádek 54 px)
const PAGE_SIZE = 12; // řádků receptů na stránku (delší seznam se listuje šipkami nebo kolečkem)
const LIST = { x: X + 304, w: 588 };
const DETAIL = { x: X + 912, y: Y + 88, w: W - 940, h: H - 112 };

export default class CookingScene extends Phaser.Scene {
  constructor(key = 'Cooking') {
    super(key);
    this.cfg = PROFESSIONS[key];
  }

  create(data) {
    this.state = data.state;
    this.returnScene = data.returnScene ?? 'World';
    this.stationRank = data.station ?? 1;
    // Všechna pracoviště téže profese v budově (InteriorScene.openCooking) – vyrábět jde vše,
    // co umí kterékoli z nich, i když hráč klikl na jiné.
    this.stations = (data.stations?.length ? data.stations : [this.stationRank]).map(Number);
    // Ohniště: palivo (1× Dřevo) se zaplatí až s prvním uvařeným receptem.
    this.fuel = data.fuel ?? null;
    this.fuelPaid = false;
    this.closing = false;
    this.cfg.normalize(this.state);
    // Filtr: okno výroby se vždy otevře na Vše (přání hráče, i u pracovišť Řemeslnictví).
    this.category = 'all';
    this.subOpen = false; // vysouvací panel podfiltrů (Kovářství: sady podle kovu)
    this.subfilter = null;
    this.working = null;
    this.selectedId = null;

    uiWindow(this, X, Y, W, H, { shade: 0.6 });
    darkPanel(this, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h);

    uiTitle(this, X + 36, Y + 22, `${this.cfg.title} – ${data.stationName ?? this.cfg.stations[this.stationRank].name}`, { icon: this.cfg.icon, size: 34 });
    this.levelText = cardText(this, X + W - 36, Y + 30, '', { size: 20, color: '#cfe2f5', originX: 1 });

    this.filterLayer = this.add.container(0, 0);
    this.listLayer = this.add.container(0, 0);
    this.page = 0;
    this.input.on('wheel', (pointer, objects, dx, dy) => {
      if (pointer.x > LIST.x && pointer.x < LIST.x + LIST.w) this.turnPage(dy > 0 ? 1 : -1);
    });
    this.detailLayer = this.add.container(0, 0);
    this.messageText = cardText(this, DETAIL.x + 24, Y + H - 232, '', { size: 19, color: '#ffd76a', wrap: DETAIL.w - 48 });
    // Vlastní množství: − / počet / + / Max a tlačítko „Vyrobit ×N“.
    this.customQty = 1;
    const qy = Y + H - 166;
    cardText(this, DETAIL.x + 24, qy + 29, 'Množství:', { size: 20, bold: true, originY: 0.5 });
    this.minusButton = cardButton(this, null, DETAIL.x + 130, qy, 64, 58, '−', () => this.setQty(this.customQty - 1), { size: 26 });
    this.qtyText = cardText(this, DETAIL.x + 236, qy + 29, '1', { size: 26, bold: true, color: '#ffe7ae', originX: 0.5, originY: 0.5 });
    this.plusButton = cardButton(this, null, DETAIL.x + 278, qy, 64, 58, '+', () => this.setQty(this.customQty + 1), { size: 26 });
    this.maxButton = cardButton(this, null, DETAIL.x + 354, qy, 104, 58, 'Max', () => this.setQty(this.maxQty()), { size: 20 });
    this.customButton = cardButton(this, null, DETAIL.x + 472, qy, DETAIL.w - 496, 58, `${this.cfg.make} ×1`, () => this.doCook(this.customQty), { size: 20 });
    this.cookButton = cardButton(this, null, DETAIL.x + 24, Y + H - 96, 220, 58, this.cfg.make, () => this.doCook(1));
    this.cook5Button = cardButton(this, null, DETAIL.x + 258, Y + H - 96, 200, 58, `${this.cfg.make} ×5`, () => this.doCook(5));
    cardButton(this, null, DETAIL.x + DETAIL.w - 224, Y + H - 96, 200, 58, 'Zavřít (ESC)', () => this.close(), { danger: true });
    this.flyLayer = this.add.container(0, 0); // vysouvací panel podfiltrů – nad vším

    // Průběh výroby (pod hláškou).
    this.craftBar = uiProgressBar(this, DETAIL.x + 24, Y + H - 196, DETAIL.w - 48, 16, 0xffc94a);
    this.craftBar.setVisible(false);

    this.onKey = (event) => {
      if (!event.repeat && event.code === 'Escape') {
        if (this.subOpen) { this.subOpen = false; this.refresh(); return; }
        if (this.working) this.finishWork(null, true);
        else this.close();
      }
      // Šipky nahoru / dolů mění vlastní množství.
      if (event.code === 'ArrowUp') this.setQty(this.customQty + 1);
      if (event.code === 'ArrowDown') this.setQty(this.customQty - 1);
    };
    this.time.delayedCall(200, () => this.input.keyboard.on('keydown', this.onKey));
    // Po návratu z Databáze (karta Řemesla) překreslit – počty surovin se mohly změnit.
    this.onResume = () => this.refresh();
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.onKey);
      this.events.off(Phaser.Scenes.Events.RESUME, this.onResume);
    });
    this.refresh();
  }

  // Naučený recept nejvýš o RANGE úrovní nad úrovní profese.
  visible(recipe) {
    return this.cfg.known(this.state, recipe) && recipe.level <= this.cfg.level(this.state) + RANGE;
  }

  // sub = podfiltr kategorie (Kovářství: sada podle kovu / vzácné), jinak všechny.
  recipesOf(category, sub = null) {
    // Recepty pro probíhající úkoly jsou nahoře (označené v seznamu).
    const quest = (r) => Number(Boolean(this.questRow(r)));
    return this.cfg.all
      .filter((r) => (category === 'all' || r.category === category) && (!sub || r.set === sub) && this.visible(r) && (!this.onlyCraftable() || this.craftable(r)))
      .sort((a, b) => quest(b) - quest(a) || a.level - b.level || a.name.localeCompare(b.name, 'cs'));
  }

  // Přepínač „Jen co vyrobím“ (pamatuje se pro všechna okna výroby): jen recepty, které jde
  // teď vyrobit aspoň 1× – úroveň, pracoviště i suroviny.
  onlyCraftable() {
    return Boolean(this.state.flags?.craftOnlyAvailable);
  }

  craftable(recipe) {
    return this.cfg.can(this.state, recipe, this.stationFor(recipe), 1).ok;
  }

  // Označení úkolu u receptu: výrobek je potřeba pro probíhající úkol (questCraftList).
  questRow(recipe) {
    const id = recipeOutput(this.cfg.prof, recipe)?.id;
    return id ? questCraftList(this.state)[id] ?? null : null;
  }

  shown() {
    return this.recipesOf(this.category, this.subfilter);
  }

  pageCount() {
    return Math.max(1, Math.ceil(this.shown().length / PAGE_SIZE));
  }

  turnPage(step) {
    const page = Phaser.Math.Clamp((this.page ?? 0) + step, 0, this.pageCount() - 1);
    if (page === this.page) return;
    this.page = page;
    this.selectedId = this.shown()[page * PAGE_SIZE]?.id ?? null;
    this.refresh();
  }

  // Pracoviště, na kterém se recept v této budově vyrobí: Řemeslnictví má různá pracoviště
  // (přesná shoda), ostatní profese stupně (nejvyšší v budově).
  stationFor(recipe) {
    if (this.cfg.stationOk) return this.stations.find((s) => this.cfg.stationOk(recipe, s)) ?? this.stationRank;
    return Math.max(this.stationRank, ...this.stations);
  }

  status(recipe) {
    if (this.cfg.level(this.state) < recipe.level) return { color: '#8d8378', label: `úr. ${recipe.level}`, dim: true };
    const station = this.stationFor(recipe);
    const wrongStation = this.cfg.stationOk ? !this.cfg.stationOk(recipe, station) : station < recipe.station;
    if (wrongStation) return { color: '#8a7f6a', label: this.cfg.stations[recipe.station].name, dim: true };
    if (this.cfg.batches(this.state, recipe) > 0) return { color: '#7fd67a', label: `×${this.cfg.batches(this.state, recipe)}` };
    return { color: '#f3e4bd', label: 'chybí suroviny' };
  }

  refresh() {
    const prof = this.state.professions[this.cfg.prof];
    this.levelText.setText(`${this.cfg.title} úr. ${prof.level}  ·  ${prof.exp} / ${prof.next} XP`);
    this.renderFilters();
    this.renderFly();
    this.renderList();
    this.renderDetail();
  }

  // Filtry vlevo: Vše + kategorie s počtem viditelných receptů.
  renderFilters() {
    this.filterLayer.removeAll(true);
    // Kategorie s podfiltry (Zbroje a štíty ›) otevře vysouvací panel se sadami (renderFly);
    // zvolená sada se ukáže v názvu kategorie.
    const subLabel = (c) => this.cfg.subfilters?.[c.id]?.find((s) => s.id === this.subfilter)?.label;
    // Kategorie se specializací (Řemeslník) jen pro hráče s tou specializací.
    const categories = this.cfg.categories.filter((c) => !c.specialization || this.state.talentProgress?.specialization === c.specialization);
    const filters = [{ id: 'all', label: 'Vše' }, ...categories.map((c) => ({
      ...c,
      label: this.cfg.subfilters?.[c.id] ? (c.id === this.category && subLabel(c) ? `${c.label}: ${subLabel(c)}` : `${c.label} ›`) : c.label
    }))];
    const step = Math.min(62, Math.floor((H - 210) / filters.length)); // dole přepínač Jen co vyrobím
    const only = this.onlyCraftable();
    const toggle = cardButton(this, null, X + 24, Y + H - 96, 262, 60, `${only ? '☑' : '☐'} Jen co vyrobím`, () => {
      this.state.flags ??= {};
      this.state.flags.craftOnlyAvailable = !only;
      this.selectedId = null;
      this.page = 0;
      this.refresh();
    }, { size: 20 });
    if (only) toggle.objects[1]?.setColor?.('#7fd67a');
    this.filterLayer.add(toggle.objects);
    filters.forEach((filter, i) => {
      const y = Y + 96 + i * step;
      const active = filter.id === this.category;
      const hasSubs = Boolean(this.cfg.subfilters?.[filter.id]);
      const count = active ? this.shown().length : this.recipesOf(filter.id).length;
      this.filterLayer.add(tileRow(this, X + 24, y, 262, step - 6, active || (hasSubs && this.subOpen), () => {
        if (hasSubs) {
          this.subOpen = !(this.subOpen && active);
          if (!active) this.subfilter = null;
        } else {
          if (active) return;
          this.subOpen = false;
          this.subfilter = null;
        }
        this.category = filter.id;
        this.selectedId = null;
        this.page = 0;
        this.refresh();
      }));
      const color = active ? '#ffe7ae' : count ? '#e8dcc0' : '#6c7480';
      const label = cardText(this, X + 46, y + (step - 6) / 2, filter.label, { size: 19, bold: true, color, originY: 0.5 });
      const num = cardText(this, X + 272, y + (step - 6) / 2, String(count), { size: 18, bold: true, color: count ? '#ffd76a' : '#6c7480', originX: 1, originY: 0.5 });
      // Podskupina (nebo Vše) s nově odemčenými recepty: zlatá hvězdička před počtem.
      const fresh = newRecipeCount(this.state, this.cfg.prof, filter.id === 'all' ? null : filter.id) > 0;
      const starW = fresh ? 26 : 0;
      if (label.width > 196 - num.width - starW) label.setScale((196 - num.width - starW) / label.width);
      this.filterLayer.add([label, num]);
      if (fresh) this.filterLayer.add(cardText(this, X + 272 - num.width - 8, y + (step - 6) / 2, '★', { size: 20, bold: true, color: '#ffd23a', originX: 1, originY: 0.5 }));
    });
  }

  // Vysouvací panel podfiltrů vedle kategorií (přes začátek seznamu receptů). Po výběru se
  // zavře; klik mimo panel nebo Esc ho zavře bez změny.
  renderFly() {
    this.flyLayer.removeAll(true);
    const subs = this.subOpen ? this.cfg.subfilters?.[this.category] : null;
    if (!subs) return;
    const entries = [{ id: null, label: 'Všechny' }, ...subs];
    const rowH = 54;
    const gap = 4;
    const w = 300;
    const x = X + 296;
    const y = Y + 88;
    const h = entries.length * (rowH + gap) + 16;
    const outside = this.add.zone(0, 0, GAME_WIDTH, GAME_HEIGHT).setOrigin(0).setInteractive();
    outside.on('pointerdown', () => { this.subOpen = false; this.refresh(); });
    const bg = this.add.graphics();
    roundBox(bg, x, y, w, h, 0x060b14, 0.97, 0xd6a23a, 1, 2, 12);
    const block = this.add.zone(x, y, w, h).setOrigin(0).setInteractive(); // klik na pozadí panelu ho nezavře
    this.flyLayer.add([outside, bg, block]);
    entries.forEach((entry, i) => {
      const ry = y + 8 + i * (rowH + gap);
      const active = entry.id === this.subfilter;
      const count = this.recipesOf(this.category, entry.id).length;
      this.flyLayer.add(tileRow(this, x + 8, ry, w - 16, rowH, active, () => {
        this.subfilter = entry.id;
        this.subOpen = false;
        this.selectedId = null;
        this.page = 0;
        this.refresh();
      }));
      const color = active ? '#ffe7ae' : count ? '#e8dcc0' : '#6c7480';
      const label = cardText(this, x + 26, ry + rowH / 2, entry.label, { size: 20, bold: true, color, originY: 0.5 });
      const num = cardText(this, x + w - 24, ry + rowH / 2, String(count), { size: 20, bold: true, color: count ? '#ffd76a' : '#6c7480', originX: 1, originY: 0.5 });
      if (label.width > w - 70 - num.width) label.setScale((w - 70 - num.width) / label.width);
      this.flyLayer.add([label, num]);
    });
  }

  renderList() {
    this.listLayer.removeAll(true);
    const all = this.shown();
    const pages = this.pageCount();
    this.page = Phaser.Math.Clamp(this.page ?? 0, 0, pages - 1);
    const recipes = all.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    if (!this.selectedId || !recipes.some((r) => r.id === this.selectedId)) this.selectedId = recipes[0]?.id ?? null;
    if (!recipes.length) {
      this.listLayer.add(cardText(this, LIST.x + LIST.w / 2, Y + 130,
        this.onlyCraftable() ? 'Na žádný recept teď nemáš suroviny. Vypni „Jen co vyrobím“ vlevo dole.' : `Žádný naučený recept do úrovně ${this.cfg.level(this.state) + RANGE}.`, { size: 20, color: '#9fb3c8', originX: 0.5, wrap: LIST.w - 40, align: 'center' }));
    }
    recipes.forEach((recipe, i) => {
      const y = Y + 96 + i * ROW_H;
      const h = ROW_H - 6;
      const st = this.status(recipe);
      this.listLayer.add(tileRow(this, LIST.x, y, LIST.w, h, recipe.id === this.selectedId, () => {
        this.selectedId = recipe.id;
        this.messageText.setText('');
        this.refresh();
      }));
      const output = recipeOutput(this.cfg.prof, recipe);
      const questRow = this.questRow(recipe);
      if (questRow) {
        const g = this.add.graphics();
        roundBox(g, LIST.x + 2, y + 2, LIST.w - 4, h - 4, 0x3a2a12, 0.35, 0xd8a640, 1, 2.5, 8);
        this.listLayer.add(g);
      }
      const icon = output ? itemIcon(this, output.id, LIST.x + 32, y + h / 2, 38) : null;
      if (icon) this.listLayer.add(icon.setAlpha(st.dim ? 0.45 : 1));
      const label = cardText(this, LIST.x + LIST.w - 16, y + h / 2, st.label, { size: 17, bold: true, color: st.color, originX: 1, originY: 0.5 });
      let tagW = 0;
      if (questRow) {
        const mark = questMarkObjects(this, LIST.x, y, LIST.w, h, questRow, cardText, LIST.x + LIST.w - 28 - label.width, 170, false);
        this.listLayer.add(mark.objects);
        tagW = mark.width + 14;
      }
      // Nově odemčený recept: zlatá hvězdička, dokud přes něj hráč nepřejede myší.
      const fresh = isNewRecipe(this.state, this.cfg.prof, recipe.id);
      const nameX = LIST.x + 62 + (fresh ? 28 : 0);
      const name = cardText(this, nameX, y + h / 2, `${recipe.level}  ${recipe.name}`, { size: 20, bold: true, color: st.color, originY: 0.5 });
      // Dlouhý název se zmenší, aby nepřekryl stav (a štítek úkolu) vpravo.
      const room = LIST.w - (nameX - LIST.x) - label.width - 30 - tagW;
      if (name.width > room) name.setScale(room / name.width);
      this.listLayer.add([name, label]);
      if (fresh) this.listLayer.add(newRecipeStar(this, LIST.x + 74, y + h / 2, { x: LIST.x, y, w: LIST.w, h }, () => {
        seeRecipe(this.state, this.cfg.prof, recipe.id);
        if (!newRecipeCount(this.state, this.cfg.prof, recipe.category)) this.time.delayedCall(280, () => { if (this.sys.isActive()) this.renderFilters(); });
      }));
    });

    // Stránky: zlaté šipky jako v inventáři.
    if (pages > 1) {
      const cy = Y + H - 66;
      this.pageArrow(LIST.x + 34, cy, 'left', this.page > 0, () => this.turnPage(-1));
      this.pageArrow(LIST.x + LIST.w - 34, cy, 'right', this.page < pages - 1, () => this.turnPage(1));
      this.listLayer.add(cardText(this, LIST.x + LIST.w / 2, cy, `${this.page + 1} / ${pages}  (${all.length} receptů)`,
        { size: 18, color: '#9fb3c8', originX: 0.5, originY: 0.5 }));
    }
  }

  pageArrow(cx, cy, dir, enabled, onClick) {
    const w = 40;
    const h = 70;
    if (!this.textures.exists(arrowKey(dir, 'normal'))) {
      const b = cardButton(this, null, cx - 45, cy - 27, 90, 54, dir === 'left' ? '◀' : '▶', onClick, { size: 20, disabled: !enabled });
      this.listLayer.add(b.objects);
      return;
    }
    const image = this.add.image(cx, cy, arrowKey(dir, 'normal')).setDisplaySize(w, h).setAlpha(enabled ? 1 : 0.3);
    this.listLayer.add(image);
    if (!enabled) return;
    const zone = this.add.zone(cx - w / 2 - 10, cy - h / 2, w + 20, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => image.setTexture(arrowKey(dir, 'hover')).setDisplaySize(w, h));
    zone.on('pointerout', () => image.setTexture(arrowKey(dir, 'normal')).setDisplaySize(w, h));
    zone.on('pointerdown', onClick);
    this.listLayer.add(zone);
  }

  renderDetail() {
    this.detailLayer.removeAll(true);
    const recipe = this.cfg.all.find((r) => r.id === this.selectedId);
    this.updateQty();
    if (!recipe) {
      this.cookButton.setDisabled(true);
      this.cook5Button.setDisabled(true);
      return;
    }
    const x = DETAIL.x + 24;
    const w = DETAIL.w - 48;
    let y = DETAIL.y + 22;
    const add = (text, options) => {
      const t = cardText(this, x, y, text, { wrap: w, ...options });
      this.detailLayer.add(t);
      y += t.height + 10;
      return t;
    };
    const heading = (text) => {
      const t = cardText(this, x, y, text, { size: 21, bold: true, color: '#ffe7ae' });
      this.detailLayer.add([t, headingLine(this, t, x, w)]);
      y += t.height + 12;
    };

    // Hlavička: ikona výrobku v rámečku vzácnosti, název a údaje receptu.
    const output = recipeOutput(this.cfg.prof, recipe);
    if (output) this.detailLayer.add(framedIcon(this, output.id, x + 36, y + 36, 52));
    const title = cardText(this, x + 88, y + 4, recipe.name, { size: 28, bold: true, color: output ? rarityColor(getItem(output.id)) : '#ffe7ae', wrap: w - 96 });
    const meta = cardText(this, x + 88, y + 12 + title.height, `${recipe.category === 'M' ? 'Mezivýrobek' : recipe.id} · ${this.cfg.made} ${recipe.level} · ${this.cfg.stations[recipe.station].name} · ${recipe.qty} ks`,
      { size: 17, color: '#9fc4e6', wrap: w - 96 });
    this.detailLayer.add([title, meta]);
    y += Math.max(92, title.height + meta.height + 24);
    add(this.cfg.describe(recipe.effect), { size: 19, color: '#f3e4bd' });
    y += 4;

    heading('Suroviny (klik = odkud získat a kde se používá)');
    for (const [key, qty] of Object.entries(recipe.ingredients)) {
      const ids = key.split('|');
      const names = ids.map((id) => getItem(id)?.name ?? id).join(' nebo ');
      const have = this.cfg.count(this.state, key);
      const color = have >= qty ? '#7fd67a' : '#ff9a8a';
      const icon = itemIcon(this, ids[0], x + 18, y + 16, 30);
      if (icon) this.detailLayer.add(icon);
      const line = cardText(this, x + 42, y + 2, `${have >= qty ? '✓' : '✗'} ${qty}× ${names}  (máš ${have})  ›`, { size: 19, color, wrap: w - 42 });
      // Proklik do Databáze v kartě Řemesla (po zavření karty se vrátí sem).
      line.setInteractive({ useHandCursor: true });
      line.on('pointerover', () => line.setColor('#ffe7ae'));
      line.on('pointerout', () => line.setColor(color));
      line.on('pointerdown', () => this.openDatabase(ids[0]));
      this.detailLayer.add(line);
      y += Math.max(36, line.height + 10);
    }
    y += 6;
    add(`Původ receptu: ${this.cfg.origins[recipe.origin] ?? recipe.origin}`, { size: 16, color: '#8f9aa6' });
    const one = this.cfg.can(this.state, recipe, this.stationFor(recipe), 1);
    this.cookButton.setDisabled(!one.ok || Boolean(this.working));
    this.cook5Button.setDisabled(!this.cfg.can(this.state, recipe, this.stationFor(recipe), 5).ok || Boolean(this.working));
    add(`Doba výroby: ${this.craftSeconds(recipe).toFixed(1).replace('.', ',')} s za kus`, { size: 16, color: '#8f9aa6' });
    if (!one.ok) add(one.reason, { size: 18, color: '#ff9a8a' });

    // Kde se výrobek dál používá (recepty všech výrobních profesí) – klik = Databáze.
    const uses = output ? itemUses(output.id) : [];
    if (uses.length) {
      y += 4;
      heading(`Používá se v (${uses.length})`);
      const bottom = Y + H - 250; // nad hláškou a ukazatelem výroby
      const lineH = 32;
      const room = Math.max(1, Math.floor((bottom - y) / lineH));
      const shown = uses.length > room ? uses.slice(0, room - 1) : uses;
      for (const use of shown) {
        const target = recipeOutput(use.prof, use.recipe);
        const icon = target ? itemIcon(this, target.id, x + 18, y + 14, 26) : null;
        if (icon) this.detailLayer.add(icon);
        const text = `${RECIPE_BOOKS[use.prof]?.title ?? use.prof} ${use.recipe.level}: ${use.recipe.name} (${use.qty}×)  ›`;
        const line = cardText(this, x + 42, y + 2, text, { size: 18, color: '#cfe2f5' });
        if (line.width > w - 42) line.setScale((w - 42) / line.width);
        line.setInteractive({ useHandCursor: true });
        line.on('pointerover', () => line.setColor('#ffe7ae'));
        line.on('pointerout', () => line.setColor('#cfe2f5'));
        line.on('pointerdown', () => this.openDatabase(target?.id ?? output.id));
        this.detailLayer.add(line);
        y += lineH;
      }
      if (shown.length < uses.length) {
        const more = cardText(this, x + 42, y + 2, `… a dalších ${uses.length - shown.length} – všechny v Databázi  ›`, { size: 18, color: '#9fc4e6' });
        more.setInteractive({ useHandCursor: true });
        more.on('pointerover', () => more.setColor('#ffe7ae'));
        more.on('pointerout', () => more.setColor('#9fc4e6'));
        more.on('pointerdown', () => this.openDatabase(output.id));
        this.detailLayer.add(more);
        y += lineH;
      }
    }
  }

  // Kolikrát jde vybraný recept vyrobit ze surovin v inventáři (aspoň 1).
  maxQty() {
    const recipe = this.cfg.all.find((r) => r.id === this.selectedId);
    return Math.max(1, recipe ? this.cfg.batches(this.state, recipe) : 1);
  }

  // Množství jde zvolit jen do počtu, který jde ze surovin vyrobit (nejvýš 99).
  qtyLimit() {
    return Math.min(99, this.maxQty());
  }

  setQty(value) {
    this.customQty = Phaser.Math.Clamp(Math.round(value) || 1, 1, this.qtyLimit());
    this.updateQty();
  }

  updateQty() {
    const recipe = this.cfg.all.find((r) => r.id === this.selectedId);
    // Jiný recept = množství znovu od 1; po výrobě (míň surovin) se sníží na maximum.
    if (this.qtyRecipe !== this.selectedId) {
      this.qtyRecipe = this.selectedId;
      this.customQty = 1;
    }
    this.customQty = Phaser.Math.Clamp(this.customQty, 1, this.qtyLimit());
    this.qtyText.setText(String(this.customQty));
    this.customButton.setLabel(`${this.cfg.make} ×${this.customQty}`);
    this.minusButton.setDisabled(this.customQty <= 1);
    this.plusButton.setDisabled(this.customQty >= this.qtyLimit());
    this.maxButton.setDisabled(!recipe);
    this.customButton.setDisabled(!recipe || Boolean(this.working) || !this.cfg.can(this.state, recipe, this.stationFor(recipe), this.customQty).ok);
  }

  // Doba výroby jednoho kusu (s): těžší recepty déle, mezivýrobky rychleji.
  craftSeconds(recipe) {
    const base = 1.2 + recipe.level * 0.04;
    return recipe.category === 'M' ? base * 0.6 : base;
  }

  // Výroba trvá: kusy se vyrábějí jeden po druhém s ukazatelem průběhu (Esc přeruší).
  doCook(times) {
    if (this.working) return;
    const recipe = this.cfg.all.find((r) => r.id === this.selectedId);
    if (!recipe) return;
    const check = this.cfg.can(this.state, recipe, this.stationFor(recipe), times);
    if (!check.ok) {
      this.messageText.setText(check.reason);
      return;
    }
    if (this.fuel && !this.fuelPaid) {
      // Palivo navíc k případnému dřevu v receptu.
      const inRecipe = Object.entries(recipe.ingredients ?? {})
        .filter(([key]) => key.split('|')[0] === this.fuel)
        .reduce((sum, [, qty]) => sum + qty * times, 0);
      if (getItemCount(this.state, this.fuel) < inRecipe + 1) {
        this.messageText.setText(`Na ohniště potřebuješ ještě 1× ${getItem(this.fuel)?.name ?? this.fuel}.`);
        return;
      }
    }
    this.working = { recipe, times, done: 0, made: 0, xp: 0, levels: 0, elapsed: 0, total: this.craftSeconds(recipe) * 1000 };
    // XP z celé várky se ohlásí najednou (vyskakovací okno dovednosti) až po skončení / přerušení.
    beginSkillXpBatch(this.cfg.prof);
    this.setBusy(true);
  }

  setBusy(busy) {
    for (const b of [this.cookButton, this.cook5Button, this.customButton, this.maxButton, this.minusButton, this.plusButton]) b.setDisabled(busy);
    this.craftBar.setVisible(busy);
    if (!busy) this.refresh();
  }

  update(time, delta) {
    const w = this.working;
    if (!w) return;
    w.elapsed += delta;
    const ratio = Math.min(1, (w.done + w.elapsed / w.total) / w.times);
    this.craftBar.set(ratio);
    const left = ((w.times - w.done) * w.total - w.elapsed) / 1000;
    this.messageText.setText(`${this.cfg.make === 'Uvařit' ? 'Vaříš' : 'Vyrábíš'}: ${w.recipe.name} ${w.done + 1}/${w.times} · ${Math.max(0, left).toFixed(1).replace('.', ',')} s (Esc = přerušit)`);
    if (w.elapsed < w.total) return;
    w.elapsed = 0;
    const result = this.cfg.craft(this.state, w.recipe, this.stationFor(w.recipe), 1);
    if (!result.ok) { this.finishWork(result.message); return; }
    if (this.fuel && !this.fuelPaid) {
      removeItem(this.state, this.fuel, 1);
      this.fuelPaid = true;
    }
    w.done += 1;
    w.made += Number(result.made) || w.recipe.qty || 1;
    w.xp += Number(result.xp) || 0;
    w.levels += Number(result.levelsGained) || 0;
    SaveSystem.save(this.state);
    this.renderList();
    if (w.done >= w.times) this.finishWork();
  }

  finishWork(error = null, interrupted = false) {
    const w = this.working;
    this.working = null;
    this.setBusy(false);
    endSkillXpBatch(this.cfg.prof);
    if (!w) return;
    let message = w.done ? `Hotovo: ${w.recipe.name} ×${w.made}${w.xp ? ` (+${w.xp} XP)` : ''}.` : '';
    if (interrupted) message = `Přerušeno. ${message}`;
    if (error) message = `${message} ${error}`.trim();
    if (w.levels > 0) message += ` ${this.cfg.title}: nová úroveň ${this.state.professions[this.cfg.prof].level}!`;
    this.messageText.setText(message);
  }

  // Databáze (karta Řemesla) nad oknem výroby; okno počká a po zavření karty pokračuje.
  openDatabase(itemId) {
    SaveSystem.save(this.state);
    this.scene.pause();
    this.scene.launch('Professions', { state: this.state, returnScene: this.scene.key, item: itemId });
    this.scene.bringToTop('Professions');
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    this.working = null; // rozdělaná výroba se přeruší (vyrobené kusy zůstávají)
    endSkillXpBatch(this.cfg.prof);
    SaveSystem.save(this.state);
    this.scene.stop();
    this.scene.resume(this.returnScene);
  }
}

// Okno Alchymie (stejné ovládání jako Vaření).
export class AlchemyScene extends CookingScene {
  constructor() {
    super('Alchemy');
  }
}

// Okno Kovářství (stejné ovládání, navíc kategorie Tavení a díly).
export class SmithingScene extends CookingScene {
  constructor() {
    super('Smithing');
  }
}

// Okno Řemeslnictví (koželužský stůl, šperkařský stůl, Soul Crystal Workbench).
export class CraftingScene extends CookingScene {
  constructor() {
    super('Crafting');
  }
}
