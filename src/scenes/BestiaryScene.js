import Phaser from 'phaser';
import speciesRows from '../data/monsters.json';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem, SPECIES_DROPS } from '../data/items.js';
import { RARITY } from '../data/fishing.js';
import { normalizeElement } from '../systems/ElementSystem.js';

// České názvy elementů (Bestiář).
const ELEMENT_NAMES = { air: 'vzduch', water: 'voda', fire: 'oheň', earth: 'země', verdant: 'příroda', light: 'světlo', dark: 'temnota' };
import { ELEMENT_COLORS } from '../battle/monsterModels.js';
import { createAnimatedBody, monsterStillKey, monsterHeadKey } from '../battle/monsterAnimations.js';
import { arrowKey } from '../ui/inventorySprites.js';
import { CARD_PANEL, cardText, cardButton, drawCardFrame, cardCloseButton, uiTitle } from '../ui/fantasyCard.js';
import { REGIONS } from '../systems/RegionSystem.js';
import { loadWorldMap } from '../data/maps/index.js';
import { regionTexture } from './WorldMapScene.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';

// Výskyt druhu: louky setkání (map.encounterZones) ve všech regionech, kde se druh objevuje.
// Mapy regionů se načtou jednou (generované regiony jsou drahé).
const habitatMaps = new Map();
const regionMap = (id) => {
  if (!habitatMaps.has(id)) habitatMaps.set(id, loadWorldMap(id));
  return habitatMaps.get(id);
};
function speciesHabitat(species) {
  const found = [];
  for (const region of REGIONS) {
    const map = regionMap(region.id);
    const zones = (map.encounterZones ?? []).filter((z) => (z.species ?? []).includes(species.id));
    if (zones.length) found.push({ region: region.id, map, zones });
  }
  return found;
}
import { createCardTabBar, slideCardIn, slideCardOut } from '../ui/cardTabBar.js';
import { LOOK, roundBox, tileRow, darkPanel, headingLine, itemIcon } from '../ui/craftLook.js';
import { getSkill, getStarterSkillId, getSkillsLearnedAtLevel, getBondSkillId, skillUnlockLevels } from '../systems/MonsterSkillSystem.js';

// Schopnosti druhu a úroveň, na které se monstrum naučí (start + 10, 20, 40, 80).
const SKILL_CATEGORY = { physical: 'fyzická', magical: 'magická', buff: 'posílení', healing: 'léčení' };
function speciesSkills(species) {
  const rows = [];
  const starter = getSkill(getStarterSkillId(species.id, species.element));
  if (starter) rows.push({ level: 1, skill: starter });
  for (const level of skillUnlockLevels(species.id)) {
    for (const id of getSkillsLearnedAtLevel(species.id, level, species.element)) {
      const skill = getSkill(id);
      if (skill && !rows.some((r) => r.skill.id === id)) rows.push({ level, skill });
    }
  }
  // Bond schopnost: naučí se při důvěře (Bond) 100 – stupeň Soulbound.
  const bond = getSkill(getBondSkillId(species.id, species.element));
  if (bond && !rows.some((r) => r.skill.id === bond.id)) rows.push({ level: 'bond', skill: bond });
  return rows;
}

// Karta Bestiář (záložka Bestiář) ve stylu karty Řemesla. Vlevo filtry (Všechna, Objevená,
// Ochočená, elementy), uprostřed seznam druhů s obrázkem, vpravo detail s animací (idle),
// údaji, záznamem (výskyt s náhledem mapy / ochočeno / poraženo), schopnostmi s úrovní odemčení a kořistí
// (klik = Databáze v Řemeslech).
// Neobjevené druhy jsou „???“ a jejich obrázek je jen černá silueta.

const P = CARD_PANEL;
const LEFT = { x: P.x + 50, y: P.y + 92, w: 290 }; // odstup od rámu karty
const LIST = { x: P.x + 362, y: P.y + 92, w: 600 };
const DETAIL = { x: LIST.x + LIST.w + 20, y: P.y + 92, w: P.x + P.w - 50 - (LIST.x + LIST.w + 20), h: P.h - 92 - 60 }; // vpravo odstup od rámu
const ROW = 58;
const PAGE = 12;
const ELEMENTS = ['air', 'water', 'fire', 'earth', 'verdant', 'light', 'dark'];
const FILTERS = [
  { id: 'all', label: 'Všechna', icon: 'book' },
  { id: 'seen', label: 'Objevená', icon: 'compass' },
  { id: 'owned', label: 'Ochočená', icon: 'paw' },
  ...ELEMENTS.map((el) => ({ id: el, label: cap(ELEMENT_NAMES[el] ?? el), element: el }))
];

function cap(text) {
  return String(text).charAt(0).toUpperCase() + String(text).slice(1);
}

const rarityOf = (species) => RARITY[species.rarity] ?? RARITY.common;
const elementOf = (species) => normalizeElement(species.element);

export default class BestiaryScene extends Phaser.Scene {
  constructor() {
    super('Bestiary');
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
    this.state.bestiary ??= {};
    const memory = this.registry.get('bestiaryCard') ?? {};
    this.view = { filter: memory.filter ?? 'all', page: memory.page ?? 0, selected: memory.selected ?? null };

    drawCardFrame(this);
    uiTitle(this, P.x + 150, P.y + 38, 'Bestiář', { icon: 'paw', size: 34 });
    this.progressText = cardText(this, P.x + P.w - 150, P.y + 46, '', { size: 20, color: '#cfe2f5', originX: 1 });
    this.content = this.add.container(0, 0);

    cardCloseButton(this, () => this.closeCard());
    this.tabBar = createCardTabBar(this, 'bestiary', {
      onClose: () => this.closeCard(),
      state: this.state,
      returnScene: this.returnScene,
      storageAccess: this.storageAccess,
      beforeLeave: () => this.remember()
    });
    if (data?.animateIn) slideCardIn(this, { hide: this.tabBar.objects });

    this.input.on('wheel', (pointer, objects, dx, dy) => {
      if (pointer.x > LIST.x && pointer.x < LIST.x + LIST.w) this.turn(dy > 0 ? 1 : -1);
    });
    this.onKey = (event) => {
      if (event.repeat) return;
      if (this.habitat) { if (event.code === 'Escape') this.closeHabitat(); return; }
      if (event.code === 'Escape') this.closeCard();
      else if (event.code === 'ArrowRight' || event.code === 'PageDown') this.turn(1);
      else if (event.code === 'ArrowLeft' || event.code === 'PageUp') this.turn(-1);
    };
    this.input.keyboard.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));
    this.render();
  }

  remember() {
    this.registry.set('bestiaryCard', { ...this.view });
    SaveSystem.save(this.state);
  }

  // ------------------------------------------------------------ data

  record(species) {
    return this.state.bestiary[species.id] ?? { seen: 0, caught: 0, defeated: 0 };
  }

  isDiscovered(species) {
    const r = this.record(species);
    return r.seen > 0 || r.caught > 0 || this.ownedCount(species) > 0;
  }

  ownedCount(species) {
    return [...(this.state.party ?? []), ...(this.state.monsterStorage ?? [])].filter((m) => m.speciesId === species.id).length;
  }

  matches(species, filter) {
    if (filter === 'all') return true;
    if (filter === 'seen') return this.isDiscovered(species);
    if (filter === 'owned') return this.ownedCount(species) > 0 || this.record(species).caught > 0;
    return elementOf(species) === filter;
  }

  list(filter = this.view.filter) {
    return speciesRows
      .filter((s) => this.matches(s, filter))
      .sort((a, b) => Number(this.isDiscovered(b)) - Number(this.isDiscovered(a)) || a.name.localeCompare(b.name, 'cs'));
  }

  turn(step) {
    const pages = Math.max(1, Math.ceil(this.list().length / PAGE));
    const page = Phaser.Math.Clamp(this.view.page + step, 0, pages - 1);
    if (page === this.view.page) return;
    this.view.page = page;
    this.render();
  }

  // ------------------------------------------------------------ vykreslení

  render() {
    this.content.removeAll(true);
    this.previewSprite = null;
    const discovered = speciesRows.filter((s) => this.isDiscovered(s)).length;
    this.progressText.setText(`Objeveno ${discovered} / ${speciesRows.length}`);
    this.renderFilters();
    this.renderList();
    this.renderDetail();
  }

  put(objects) {
    this.content.add(objects);
    return objects;
  }

  renderFilters() {
    FILTERS.forEach((filter, i) => {
      const y = LEFT.y + i * 70 + (i >= 3 ? 14 : 0);
      const h = 62;
      const active = this.view.filter === filter.id;
      const count = this.list(filter.id).length;
      const seen = filter.element ? this.list(filter.id).filter((s) => this.isDiscovered(s)).length : null;
      this.put(tileRow(this, LEFT.x, y, LEFT.w, h, active, () => {
        if (active) return;
        this.view.filter = filter.id;
        this.view.page = 0;
        this.view.selected = null;
        this.render();
      }, 10));
      if (filter.element) {
        const g = this.add.graphics();
        g.fillStyle(ELEMENT_COLORS[filter.element] ?? 0xc8c8c8, 1).fillCircle(LEFT.x + 36, y + h / 2, 12);
        g.lineStyle(2, 0x05080c, 0.8).strokeCircle(LEFT.x + 36, y + h / 2, 12);
        this.put(g);
      } else if (this.textures.exists(`nu-icon-${filter.icon}`)) {
        const icon = this.add.image(LEFT.x + 36, y + h / 2, `nu-icon-${filter.icon}`);
        icon.setScale(38 / Math.max(icon.width, icon.height));
        this.put(icon);
      }
      this.put(cardText(this, LEFT.x + 66, y + h / 2, filter.label, { size: 21, bold: true, color: active ? '#ffe7ae' : '#e8dcc0', originY: 0.5 }));
      this.put(cardText(this, LEFT.x + LEFT.w - 16, y + h / 2, seen != null ? `${seen}/${count}` : String(count),
        { size: 19, bold: true, color: '#ffd76a', originX: 1, originY: 0.5 }));
    });
  }

  renderList() {
    const list = this.list();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    this.view.page = Phaser.Math.Clamp(this.view.page, 0, pages - 1);
    const shown = list.slice(this.view.page * PAGE, (this.view.page + 1) * PAGE);
    if (!this.view.selected || !list.some((s) => s.id === this.view.selected)) this.view.selected = shown[0]?.id ?? null;
    if (!shown.length) this.put(cardText(this, LIST.x + LIST.w / 2, LIST.y + 40, 'Žádné monstrum neodpovídá filtru.', { size: 20, color: '#9fb3c8', originX: 0.5 }));

    shown.forEach((species, i) => {
      const y = LIST.y + i * ROW;
      const h = ROW - 6;
      const known = this.isDiscovered(species);
      const selected = species.id === this.view.selected;
      this.put(tileRow(this, LIST.x, y, LIST.w, h, selected, () => {
        if (selected) return;
        this.view.selected = species.id;
        this.render();
      }));
      this.thumb(species, LIST.x + 36, y + h / 2, 44, known);
      const color = known ? rarityOf(species).color : '#6c7480';
      const name = this.put(cardText(this, LIST.x + 72, y + h / 2, known ? species.name : '???', { size: 21, bold: true, color, originY: 0.5 }));
      if (name.width > LIST.w - 260) name.setScale((LIST.w - 260) / name.width);
      if (known) {
        const el = elementOf(species);
        const g = this.add.graphics();
        g.fillStyle(ELEMENT_COLORS[el] ?? 0xc8c8c8, 1).fillCircle(LIST.x + LIST.w - 150, y + h / 2, 8);
        this.put(g);
        this.put(cardText(this, LIST.x + LIST.w - 136, y + h / 2, cap(ELEMENT_NAMES[el] ?? el), { size: 17, color: '#cfd6de', originY: 0.5 }));
        if (this.ownedCount(species) > 0) this.put(cardText(this, LIST.x + LIST.w - 16, y + h / 2, '✓', { size: 22, bold: true, color: '#7fd67a', originX: 1, originY: 0.5 }));
      }
    });

    if (pages > 1) {
      const cy = LIST.y + PAGE * ROW + 30;
      this.arrow(LIST.x + 34, cy, 'left', this.view.page > 0, () => this.turn(-1));
      this.arrow(LIST.x + LIST.w - 34, cy, 'right', this.view.page < pages - 1, () => this.turn(1));
      this.put(cardText(this, LIST.x + LIST.w / 2, cy, `${this.view.page + 1} / ${pages}  (${list.length} druhů)`, { size: 18, color: '#9fb3c8', originX: 0.5, originY: 0.5 }));
    }
  }

  // Malý obrázek: první snímek animace (neobjevené = černá silueta), jinak barevná tečka.
  thumb(species, cx, cy, size, known) {
    const key = monsterHeadKey(this, species.id) ?? monsterStillKey(this, species.id);
    if (key) {
      const image = this.add.image(cx, cy, key);
      image.setScale(size / Math.max(image.width, image.height));
      if (!known) image.setTintFill(0x05080c).setAlpha(0.8);
      this.put(image);
      return;
    }
    const g = this.add.graphics();
    g.fillStyle(known ? ELEMENT_COLORS[elementOf(species)] ?? 0xc8c8c8 : 0x2a323c, 1).fillCircle(cx, cy, size * 0.32);
    this.put(g);
    this.put(cardText(this, cx, cy, '?', { size: 20, bold: true, color: known ? '#05080c' : '#8f9aa6', originX: 0.5, originY: 0.5, strokeThickness: 0 }));
  }

  arrow(cx, cy, dir, enabled, onClick) {
    const w = 40;
    const h = 70;
    if (!this.textures.exists(arrowKey(dir, 'normal'))) return;
    const image = this.add.image(cx, cy, arrowKey(dir, 'normal')).setDisplaySize(w, h).setAlpha(enabled ? 1 : 0.3);
    this.put(image);
    if (!enabled) return;
    const zone = this.add.zone(cx - w / 2 - 10, cy - h / 2, w + 20, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => image.setTexture(arrowKey(dir, 'hover')).setDisplaySize(w, h));
    zone.on('pointerout', () => image.setTexture(arrowKey(dir, 'normal')).setDisplaySize(w, h));
    zone.on('pointerdown', onClick);
    this.put(zone);
  }

  renderDetail() {
    this.put(darkPanel(this, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h));
    const species = speciesRows.find((s) => s.id === this.view.selected);
    if (!species) return;
    const known = this.isDiscovered(species);
    const x = DETAIL.x + 28;
    const w = DETAIL.w - 56;
    let y = DETAIL.y + 22;

    // Pódium s animací (idle) – neobjevené jako silueta.
    const stage = { x: DETAIL.x + 20, y, w: DETAIL.w - 40, h: 190 };
    const g = this.add.graphics();
    roundBox(g, stage.x, stage.y, stage.w, stage.h, 0x05080c, 0.55, LOOK.line, 0.6, 1.5, 12);
    const el = elementOf(species);
    g.fillStyle(ELEMENT_COLORS[el] ?? 0xc8c8c8, known ? 0.18 : 0.06).fillEllipse(stage.x + stage.w / 2, stage.y + stage.h - 34, 300, 60);
    this.put(g);
    const body = createAnimatedBody(this, species.id, 'player');
    if (body) {
      body.setPosition(stage.x + stage.w / 2, stage.y + stage.h - 28);
      body.setScale(body.scaleX * 1.2, body.scaleY * 1.2);
      if (!known) { body.setTintFill(0x05080c).setAlpha(0.85); body.anims.pause(); }
      this.put(body);
      this.previewSprite = body;
    } else {
      this.put(cardText(this, stage.x + stage.w / 2, stage.y + stage.h / 2, known ? 'Obrázek zatím chybí' : '?', { size: known ? 22 : 90, bold: true, color: '#6c7480', originX: 0.5, originY: 0.5 }));
    }
    y += stage.h + 18;

    if (!known) {
      this.put(cardText(this, x, y, '???', { size: 30, bold: true, color: '#8f9aa6' }));
      this.put(cardText(this, x, y + 50, 'Tohle monstrum jsi ještě nepotkal. Až ho uvidíš v souboji, zapíše se sem.', { size: 19, color: '#9fb3c8', wrap: w }));
      return;
    }

    const rarity = rarityOf(species);
    this.put(cardText(this, x, y, species.name, { size: 30, bold: true, color: rarity.color }));
    y += 46;
    this.put(cardText(this, x, y, `${cap(ELEMENT_NAMES[el] ?? el)} · ${rarity.label} · ${species.region}`, { size: 19, color: '#9fc4e6' }));
    y += 34;
    const desc = this.put(cardText(this, x, y, species.description ?? '', { size: 19, color: '#dbe6f3', wrap: w }));
    y += desc.height + 18;

    y += this.heading(x, y, w, 'Záznam') + 12;
    const r = this.record(species);
    // Výskyt (místo Pozorováno): počet luk, kde se druh objevuje; klik = náhled mapy.
    const habitat = speciesHabitat(species);
    const meadows = habitat.reduce((n, h) => n + h.zones.length, 0);
    const stats = [
      ['Výskyt (klik)', meadows ? `${meadows} ${meadows === 1 ? 'louka' : meadows < 5 ? 'louky' : 'luk'}` : '—', () => this.openHabitat(species)],
      ['Ochočeno', r.caught], ['Poraženo', r.defeated ?? 0], ['V partě a úschovně', this.ownedCount(species)]
    ];
    const cw = (w - 30) / stats.length;
    stats.forEach(([label, value, onClick], i) => {
      const bx = x + i * (cw + 10);
      const by = y; // pevná poloha – y se níž posouvá (rámeček pod myší dřív uskočil do Schopností)
      const box = this.add.graphics();
      const draw = (hover) => { box.clear(); roundBox(box, bx, by, cw, 60, LOOK.fill, 0.9, hover ? LOOK.gold : LOOK.line, 0.9, hover ? 2.5 : 1.5, 10); };
      draw(false);
      this.put(box);
      const valueText = this.put(cardText(this, bx + cw / 2, y + 19, String(value ?? 0), { size: 24, bold: true, color: '#ffd76a', originX: 0.5, originY: 0.5 }));
      if (valueText.width > cw - 12) valueText.setScale((cw - 12) / valueText.width);
      this.put(cardText(this, bx + cw / 2, y + 45, label, { size: 15, color: onClick ? '#ffe7ae' : '#cfd6de', originX: 0.5, originY: 0.5 }));
      if (onClick) {
        const zone = this.add.zone(bx, y, cw, 60).setOrigin(0).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => draw(true));
        zone.on('pointerout', () => draw(false));
        zone.on('pointerdown', onClick);
        this.put(zone);
      }
    });
    y += 76;

    // Dva sloupce: Schopnosti s úrovní odemčení | Kořist (klik = Databáze).
    const colW = (w - 24) / 2;
    const rx = x + colW + 24;
    const top = y;
    y += this.heading(x, y, colW, 'Schopnosti') + 10;
    const skills = speciesSkills(species);
    if (!skills.length) this.put(cardText(this, x + 16, y, 'Žádné známé schopnosti.', { size: 18, color: '#9fb3c8' }));
    // Víc schopností (podpisová + Bond = 7) → hustší řádky, ať se vejdou do panelu.
    const step = skills.length > 6 ? 35 : 44;
    const dense = step < 44;
    skills.forEach(({ level, skill }, i) => {
      const ry = y + i * step;
      const isBond = level === 'bond';
      const isSignature = Boolean(skill.signature); // podpisová schopnost druhu: zlatý odznak
      const badge = this.add.graphics();
      roundBox(badge, x, ry, 64, step - 6, isBond ? 0x2a1638 : isSignature ? 0x3a2a12 : LOOK.fill, 0.9, isBond ? 0xd08cff : isSignature ? 0xffd76a : LOOK.line, 0.9, 1.5, 8);
      this.put(badge);
      this.put(cardText(this, x + 32, ry + (step - 6) / 2, isBond ? 'Bond' : level === 1 ? 'start' : `úr. ${level}`, { size: 15, bold: true, color: isBond ? '#e2b8ff' : '#ffd76a', originX: 0.5, originY: 0.5 }));
      const name = this.put(cardText(this, x + 76, ry - (dense ? 3 : 1), isSignature ? `★ ${skill.name}` : skill.name, { size: dense ? 17 : 19, bold: true, color: isSignature ? '#ffd76a' : '#f3e4bd' }));
      if (name.width > colW - 80) name.setScale((colW - 80) / name.width);
      const power = skill.power ? ` · síla ${skill.power}` : '';
      const reach = skill.range ? ` · dosah ${skill.range}` : ' · na sebe';
      this.put(cardText(this, x + 76, ry + (dense ? 15 : 22), `${isSignature ? 'podpisová · ' : ''}${SKILL_CATEGORY[skill.category] ?? skill.category}${power}${reach}`, { size: dense ? 14 : 15, color: '#9fc4e6' }));
    });
    const hasBond = skills.some((s) => s.level === 'bond');

    const drops = SPECIES_DROPS[species.id] ?? [];
    let dy = top + this.heading(rx, top, colW, 'Kořist (klik = databáze)') + 10;
    if (!drops.length) this.put(cardText(this, rx + 16, dy, 'Žádná známá kořist.', { size: 18, color: '#9fb3c8' }));
    drops.forEach((id, i) => {
      const item = getItem(id);
      const ry = dy + i * 40;
      const icon = itemIcon(this, id, rx + 18, ry + 15, 30);
      if (icon) this.put(icon);
      const t = this.put(cardText(this, rx + 44, ry + 2, item?.name ?? id, { size: 19, color: RARITY[item?.rarity]?.color ?? '#8fd3ff' }));
      if (t.width > colW - 50) t.setScale((colW - 50) / t.width);
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor('#ffe7ae'));
      t.on('pointerout', () => t.setColor(RARITY[item?.rarity]?.color ?? '#8fd3ff'));
      t.on('pointerdown', () => this.openItem(id));
    });

    // Jak se Bond schopnost získá (MonsterBondSystem) – pod kořistí, kde je místo.
    if (hasBond) {
      let by = dy + Math.max(1, drops.length) * 40 + 14;
      by += this.heading(rx, by, colW, 'Bond (důvěra)') + 8;
      this.put(cardText(this, rx, by,
        'Důvěra 0–100, roste o 2 za každé společné vítězství. Na 100 (Soulbound) se monstrum naučí Bond schopnost. Každých 20 důvěry +1 útok, každých 40 +1 obrana, od 80 +1 rychlost.',
        { size: 16, color: '#d9bff0', wrap: colW }));
    }
  }

  // Náhled výskytu: mapa regionu (dlaždice jako na kartě Mapa), louky se zlatým rámečkem
  // a na každé pomalu blikající obrázek monstra. Zavře Esc, tlačítko nebo klik mimo okno.
  openHabitat(species) {
    this.closeHabitat();
    const found = speciesHabitat(species);
    const W = 1000;
    const H = 820;
    const x = GAME_WIDTH / 2 - W / 2;
    const y = GAME_HEIGHT / 2 - H / 2;
    const layer = this.add.container(0, 0).setDepth(800);
    this.habitat = layer;
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x02060a, 0.6).setOrigin(0).setInteractive();
    shade.on('pointerdown', () => this.closeHabitat());
    const panel = this.add.graphics();
    roundBox(panel, x, y, W, H, 0x08111d, 0.98, LOOK.gold, 1, 3, 16);
    const block = this.add.zone(x, y, W, H).setOrigin(0).setInteractive();
    layer.add([shade, panel, block, cardText(this, x + 36, y + 24, `Výskyt – ${species.name}`, { size: 30, bold: true, color: '#ffe7ae' })]);

    const view = found[0] ?? { region: species.region, map: regionMap(species.region) ?? regionMap('Greenvale'), zones: [] };
    const area = { x: x + 36, y: y + 84, w: W - 72, h: H - 250 };
    const map = view.map;
    if (map) {
      const scale = Math.min(area.w / map.width, area.h / map.height);
      const mx = area.x + (area.w - map.width * scale) / 2;
      const my = area.y + (area.h - map.height * scale) / 2;
      layer.add(this.add.image(mx, my, regionTexture(this, map)).setOrigin(0).setScale(scale));
      const marks = this.add.graphics();
      marks.lineStyle(2, LOOK.gold, 0.9).strokeRect(mx - 2, my - 2, map.width * scale + 4, map.height * scale + 4);
      layer.add(marks);
      const stillKey = monsterHeadKey(this, species.id) ?? monsterStillKey(this, species.id);
      for (const zone of view.zones) {
        const zx = mx + zone.x0 * scale;
        const zy = my + zone.y0 * scale;
        const zw = (zone.x1 - zone.x0 + 1) * scale;
        const zh = (zone.y1 - zone.y0 + 1) * scale;
        marks.fillStyle(0xffd76a, 0.18).fillRect(zx, zy, zw, zh);
        marks.lineStyle(2, 0xffd76a, 1).strokeRect(zx, zy, zw, zh);
        const cx = zx + zw / 2;
        const cy = zy + zh / 2;
        let icon;
        if (stillKey) {
          icon = this.add.image(cx, cy, stillKey);
          icon.setScale(52 / Math.max(icon.width, icon.height));
        } else {
          icon = this.add.circle(cx, cy, 14, ELEMENT_COLORS[elementOf(species)] ?? 0xffd76a).setStrokeStyle(3, 0x05080c);
        }
        layer.add(icon);
        // Pomalé blikání (1,2 s tam a zpět).
        this.tweens.add({ targets: icon, alpha: 0.2, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        layer.add(cardText(this, cx, zy + zh + 4, zone.name, { size: 15, bold: true, color: '#ffe7ae', originX: 0.5, strokeThickness: 4 }));
      }
    }

    // Seznam luk pod mapou (region, název, úroveň monster).
    let ly = area.y + area.h + 16;
    const lines = found.flatMap((h) => h.zones.map((z) => `${h.region} – ${z.name} (úr. ${z.level?.[0] ?? '?'}–${z.level?.[1] ?? '?'})${z.rare ? ' · vzácná' : ''}`));
    const info = lines.length
      ? lines.slice(0, 4).join('\n') + (lines.length > 4 ? `\n… a ${lines.length - 4} dalších` : '')
      : `Konkrétní louka zatím není určená – druh patří do oblasti ${species.region}.`;
    layer.add(cardText(this, x + 40, ly, info, { size: 19, color: '#dbe6f3', lineSpacing: 4, wrap: W - 380 }));
    const close = cardButton(this, null, x + W - 300, y + H - 92, 260, 60, 'Zavřít (Esc)', () => this.closeHabitat(), { size: 22 });
    layer.add(close.objects);
  }

  closeHabitat() {
    if (!this.habitat) return;
    this.tweens.killTweensOf(this.habitat.list);
    this.habitat.destroy();
    this.habitat = null;
  }

  heading(x, y, w, value) {
    const t = this.put(cardText(this, x, y, value, { size: 21, bold: true, color: '#ffe7ae' }));
    this.put(headingLine(this, t, x, w));
    return t.height;
  }

  // Kořist → Databáze v kartě Řemesla.
  openItem(itemId) {
    this.remember();
    this.closing = true;
    this.scene.stop();
    this.scene.launch('Professions', { state: this.state, returnScene: this.returnScene, storageAccess: this.storageAccess, item: itemId });
    this.scene.bringToTop('Professions');
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
