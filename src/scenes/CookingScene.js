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
import { SMITHING_CATEGORIES, SMITHING_STATIONS, SMITHING_ORIGINS, ALL_SMITHING, describeSmithing } from '../data/smithing.js';
import {
  normalizeSmithing, isSmithingKnown, canForge, forge, smithingMaxBatches, smithingIngredientCount, smithingLevel
} from '../systems/SmithingSystem.js';
import { CRAFTING_CATEGORIES, CRAFTING_STATIONS, CRAFTING_ORIGINS, ALL_CRAFTING, describeCrafting } from '../data/crafting.js';
import {
  normalizeCrafting, isCraftingKnown, canCraft, craftItem, craftingMaxBatches, craftingIngredientCount, craftingLevel, craftingStationOk
} from '../systems/CraftingSystem.js';

// Výrobní profese, které okno umí (Vaření = scéna Cooking, Alchymie = scéna Alchemy).
const PROFESSIONS = {
  Cooking: {
    icon: 'cooking_pot', title: 'Vaření', prof: 'cooking', make: 'Uvařit', made: 'Vaření', categories: CATEGORIES, stations: STATIONS,
    origins: ORIGINS, all: ALL_COOKING, describe: describeEffect, normalize: normalizeCooking, known: isKnown,
    can: canCook, craft: cook, batches: maxBatches, count: ingredientCount, level: cookingLevel, firstCategory: 'A'
  },
  Alchemy: {
    icon: 'potion', title: 'Alchymie', prof: 'alchemy', make: 'Vyrobit', made: 'Alchymie', categories: ALCHEMY_CATEGORIES, stations: ALCHEMY_STATIONS,
    origins: ALCHEMY_ORIGINS, all: ALL_ALCHEMY, describe: describeAlchemy, normalize: normalizeAlchemy, known: isAlchemyKnown,
    can: canBrew, craft: brew, batches: alchemyMaxBatches, count: alchemyIngredientCount, level: alchemyLevel, firstCategory: 'A'
  },
  Smithing: {
    icon: 'anvil', title: 'Kovářství', prof: 'smithing', make: 'Vykovat', made: 'Kovářství', categories: SMITHING_CATEGORIES, stations: SMITHING_STATIONS,
    origins: SMITHING_ORIGINS, all: ALL_SMITHING, describe: describeSmithing, normalize: normalizeSmithing, known: isSmithingKnown,
    can: canForge, craft: forge, batches: smithingMaxBatches, count: smithingIngredientCount, level: smithingLevel, firstCategory: 'M'
  },
  // Řemeslnictví: tři různá pracoviště (ne stupně) – recept jen na svém pracovišti; okno začne
  // kategorií, kterou pracoviště vyrábí.
  Crafting: {
    icon: 'gear', title: 'Řemeslnictví', prof: 'crafting', make: 'Vyrobit', made: 'Řemeslnictví', categories: CRAFTING_CATEGORIES, stations: CRAFTING_STATIONS,
    origins: CRAFTING_ORIGINS, all: ALL_CRAFTING, describe: describeCrafting, normalize: normalizeCrafting, known: isCraftingKnown,
    can: canCraft, craft: craftItem, batches: craftingMaxBatches, count: craftingIngredientCount, level: craftingLevel, firstCategory: 'A',
    stationOk: craftingStationOk, stationCategory: { 1: 'D', 2: 'A', 3: 'E' }
  }
};
import { CARD_GOLD, cardText, cardButton, uiWindow, uiTitle, uiSection, uiSelectedRow, nineImage } from '../ui/fantasyCard.js';

// Okno Vaření u pracoviště (ohniště, sporák, hostinská kuchyně). Vlevo kategorie,
// uprostřed recepty (zelená = jde uvařit, bílá = chybí suroviny, šedá = nízká úroveň
// nebo jiné pracoviště), vpravo suroviny, účinek a tlačítka Uvařit ×1 / ×5.

const W = 1720;
const H = 960;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;
// Recepty jako vyšší tlačítka s větším písmem (čitelnost).
const ROW_H = 60;
const PAGE_SIZE = 12; // řádků receptů na stránku (delší kategorie se listují ◀ ▶ nebo kolečkem)

export default class CookingScene extends Phaser.Scene {
  constructor(key = 'Cooking') {
    super(key);
    this.cfg = PROFESSIONS[key];
  }

  create(data) {
    this.state = data.state;
    this.returnScene = data.returnScene ?? 'World';
    this.stationRank = data.station ?? 1;
    // Ohniště: palivo (1× Dřevo) se zaplatí až s prvním uvařeným receptem.
    this.fuel = data.fuel ?? null;
    this.fuelPaid = false;
    this.closing = false;
    this.cfg.normalize(this.state);
    this.category = this.cfg.stationCategory?.[this.stationRank] ?? this.category ?? this.cfg.firstCategory;
    this.selectedId = null;

    uiWindow(this, X, Y, W, H, { shade: 0.6 });
    // Sekce: seznam receptů a detail receptu (rámečky nové sady).
    uiSection(this, X + 306, Y + 88, 588, H - 112);
    uiSection(this, X + 912, Y + 88, W - 940, H - 112);

    uiTitle(this, X + 36, Y + 22, `${this.cfg.title} – ${data.stationName ?? this.cfg.stations[this.stationRank].name}`, { icon: this.cfg.icon, size: 34 });
    this.levelText = cardText(this, X + W - 36, Y + 30, '', { size: 20, color: '#cfe2f5', originX: 1 });

    // Kategorie.
    this.categoryButtons = this.cfg.categories.map((category, i) =>
      cardButton(this, null, X + 24, Y + 100 + i * 66, 252, 54, category.label, () => {
        this.category = category.id;
        this.selectedId = null;
        this.page = 0;
        this.refresh();
      }, { size: 21 }));

    this.listLayer = this.add.container(0, 0);
    this.page = 0;
    this.prevButton = cardButton(this, null, X + 316, Y + H - 78, 90, 48, '◀', () => this.turnPage(-1), { size: 20 });
    this.nextButton = cardButton(this, null, X + 794, Y + H - 78, 90, 48, '▶', () => this.turnPage(1), { size: 20 });
    this.pageText = cardText(this, X + 600, Y + H - 66, '', { size: 18, color: '#9fb3c8', originX: 0.5 });
    this.input.on('wheel', (pointer, objects, dx, dy) => {
      if (pointer.x > X + 300 && pointer.x < X + 900) this.turnPage(dy > 0 ? 1 : -1);
    });
    this.detailLayer = this.add.container(0, 0);
    this.messageText = cardText(this, X + 930, Y + H - 150, '', { size: 19, color: '#ffd76a', wrap: W - 970 });
    this.cookButton = cardButton(this, null, X + 930, Y + H - 92, 220, 58, this.cfg.make, () => this.doCook(1));
    this.cook5Button = cardButton(this, null, X + 1165, Y + H - 92, 200, 58, `${this.cfg.make} ×5`, () => this.doCook(5));
    cardButton(this, null, X + W - 36 - 200, Y + H - 92, 200, 58, 'Zavřít (ESC)', () => this.close(), { danger: true });

    this.onKey = (event) => {
      if (!event.repeat && event.code === 'Escape') this.close();
    };
    this.time.delayedCall(200, () => this.input.keyboard.on('keydown', this.onKey));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));
    this.refresh();
  }

  pageCount() {
    return Math.max(1, Math.ceil(this.recipesOfCategory().length / PAGE_SIZE));
  }

  turnPage(step) {
    const page = Phaser.Math.Clamp((this.page ?? 0) + step, 0, this.pageCount() - 1);
    if (page === this.page) return;
    this.page = page;
    this.selectedId = this.recipesOfCategory()[page * PAGE_SIZE]?.id ?? null;
    this.refresh();
  }

  recipesOfCategory() {
    return this.cfg.all.filter((r) => r.category === this.category).sort((a, b) => a.level - b.level);
  }

  status(recipe) {
    if (!this.cfg.known(this.state, recipe)) return { color: '#6c7480', label: 'neznámý' };
    if (this.cfg.level(this.state) < recipe.level) return { color: '#6c7480', label: `úr. ${recipe.level}` };
    const wrongStation = this.cfg.stationOk ? !this.cfg.stationOk(recipe, this.stationRank) : this.stationRank < recipe.station;
    if (wrongStation) return { color: '#8a7f6a', label: this.cfg.stations[recipe.station].name };
    if (this.cfg.batches(this.state, recipe) > 0) return { color: '#7fd67a', label: `×${this.cfg.batches(this.state, recipe)}` };
    return { color: '#f3e4bd', label: 'chybí suroviny' };
  }

  refresh() {
    this.cfg.categories.forEach((category, i) => this.categoryButtons[i].setActive(category.id === this.category));
    const prof = this.state.professions[this.cfg.prof];
    this.levelText.setText(`${this.cfg.title} úr. ${prof.level}  ·  ${prof.exp} / ${prof.next} XP`);

    this.listLayer.removeAll(true);
    const all = this.recipesOfCategory();
    const pages = this.pageCount();
    this.page = Phaser.Math.Clamp(this.page ?? 0, 0, pages - 1);
    const recipes = all.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    if (!this.selectedId || !recipes.some((r) => r.id === this.selectedId)) this.selectedId = recipes[0]?.id ?? null;
    this.prevButton.setDisabled(this.page === 0);
    this.nextButton.setDisabled(this.page >= pages - 1);
    for (const b of [this.prevButton, this.nextButton]) for (const o of b.objects ?? []) o.setVisible?.(pages > 1);
    this.pageText.setText(pages > 1 ? `${this.page + 1} / ${pages}  (${all.length} receptů)` : '');
    recipes.forEach((recipe, i) => {
      const y = Y + 100 + i * ROW_H;
      const st = this.status(recipe);
      const selected = recipe.id === this.selectedId;
      const rowBg = selected ? uiSelectedRow(this, X + 316, y, 568, ROW_H - 6) : nineImage(this, 'nu-btn', X + 316, y, 568, ROW_H - 6, 0.4);
      if (rowBg) this.listLayer.add(rowBg);
      const mid = y + (ROW_H - 6) / 2;
      const label = cardText(this, X + 866, mid, st.label, { size: 17, bold: true, color: st.color, originX: 1, originY: 0.5, strokeThickness: 4 });
      const name = cardText(this, X + 334, mid, recipe.name, { size: 21, bold: true, color: st.color, originY: 0.5, strokeThickness: 4 });
      // Dlouhý název se zmenší, aby nepřekryl stav vpravo.
      const room = 866 - 334 - label.width - 14;
      if (name.width > room) name.setScale(room / name.width);
      this.listLayer.add([name, label]);
      const zone = this.add.zone(X + 316, y, 568, ROW_H - 6).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => { this.selectedId = recipe.id; this.messageText.setText(''); this.refresh(); });
      this.listLayer.add(zone);
    });

    this.renderDetail();
  }

  renderDetail() {
    this.detailLayer.removeAll(true);
    const recipe = this.cfg.all.find((r) => r.id === this.selectedId);
    if (!recipe) {
      this.cookButton.setDisabled(true);
      this.cook5Button.setDisabled(true);
      return;
    }
    const x = X + 930;
    let y = Y + 100;
    const add = (text, options) => {
      const t = cardText(this, x, y, text, { wrap: W - 970, ...options });
      this.detailLayer.add(t);
      y += t.height + 10;
      return t;
    };
    add(recipe.name, { size: 28, bold: true, color: '#ffe7ae' });
    add(`${recipe.category === 'M' ? 'Mezivýrobek' : recipe.id} · ${this.cfg.made} ${recipe.level} · ${this.cfg.stations[recipe.station].name} · ${recipe.qty} ks`, { size: 17, color: '#9fc4e6' });
    add(this.cfg.describe(recipe.effect), { size: 19, color: '#f3e4bd' });
    add('Suroviny:', { size: 20, bold: true });
    for (const [key, qty] of Object.entries(recipe.ingredients)) {
      const names = key.split('|').map((id) => getItem(id)?.name ?? id).join(' nebo ');
      const have = this.cfg.count(this.state, key);
      add(`${have >= qty ? '✓' : '✗'} ${qty}× ${names}  (máš ${have})`, { size: 18, color: have >= qty ? '#7fd67a' : '#ff9a8a' });
    }
    add(`Původ receptu: ${this.cfg.origins[recipe.origin] ?? recipe.origin}`, { size: 16, color: '#8f9aa6' });

    const one = this.cfg.can(this.state, recipe, this.stationRank, 1);
    this.cookButton.setDisabled(!one.ok);
    this.cook5Button.setDisabled(!this.cfg.can(this.state, recipe, this.stationRank, 5).ok);
    if (!one.ok) add(one.reason, { size: 18, color: '#ff9a8a' });
  }

  doCook(times) {
    const recipe = this.cfg.all.find((r) => r.id === this.selectedId);
    if (!recipe) return;
    const needFuel = this.fuel && !this.fuelPaid;
    if (needFuel) {
      // Palivo navíc k případnému dřevu v receptu.
      const inRecipe = Object.entries(recipe.ingredients ?? {})
        .filter(([key]) => key.split('|')[0] === this.fuel)
        .reduce((sum, [, qty]) => sum + qty * times, 0);
      if (getItemCount(this.state, this.fuel) < inRecipe + 1) {
        this.messageText.setText(`Na ohniště potřebuješ ještě 1× ${getItem(this.fuel)?.name ?? this.fuel}.`);
        return;
      }
    }
    const result = this.cfg.craft(this.state, recipe, this.stationRank, times);
    if (result.ok && needFuel) {
      removeItem(this.state, this.fuel, 1);
      this.fuelPaid = true;
    }
    let message = result.message;
    if (result.ok && result.levelsGained > 0) message += ` ${this.cfg.title}: nová úroveň ${this.state.professions[this.cfg.prof].level}!`;
    this.messageText.setText(message);
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
