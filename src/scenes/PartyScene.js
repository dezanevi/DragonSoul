import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { getMonsterSkills } from '../systems/MonsterSkillSystem.js';
import { addTrainingPoints, getTotalTrainingPoints } from '../systems/TrainingSystem.js';
import { getMonsterSpecies } from '../systems/MonsterSystem.js';
import { getBondLevel } from '../systems/MonsterBondSystem.js';
import { elementName } from '../systems/ElementSystem.js';
import { createMonsterModel } from '../battle/monsterModels.js';
import { monsterHeadKey, monsterStillKey } from '../battle/monsterAnimations.js';
import { cardText, cardButton, openCardModal, drawCardFrame, CARD_FIT, nineImage } from '../ui/fantasyCard.js';
import { askName } from '../ui/nameInput.js';
import { createCardTabBar, slideCardIn, slideCardOut } from '../ui/cardTabBar.js';
import { closeStateKey } from '../ui/heroCard/tabSprites.js';
import {
  PARTY_CARD,
  partyFrame,
  preparePartyFrames,
  PARTY_SLOTS,
  STORAGE,
  DETAIL,
  STATS,
  SKILLS,
  HISTORY,
  ACTIONS,
  HEADER,
  CLOSE_AREA
} from '../ui/partyCardLayout.js';

// Karta Party (klávesa P nebo záložka Party). Podklad je obrázek karty (assets/ui/partyscene),
// interaktivní prvky jsou výřezy z partyscene-buttons.png a monsterselect.png ve stavech
// výchozí / hover / vybrané; šedá jen u tlačítek +, když nejsou body k přidělení
// (a u nedostupných tlačítek). Úschovnu jde jen prohlížet – přesouvat monstra mezi partou
// a úschovnou lze jen u Liory v domě léčitelky (data.storageAccess).

const PARTY_LIMIT = 4;
const MAX_FREE_TRAINING = 510; // stejný strop jako při načtení hry (SaveSystem)
const TRAINING_PER_STAT_UP = 5;
const MAX_TRAINING_PER_STAT = 255;
const MAX_TRAINING_TOTAL = 510;
const STORAGE_COLUMNS = 2;
const STORAGE_ROWS = 3;

const CARD_W = 1536;
const CARD_H = 1024;
// Obsah karty zmenšený do panelu karty Mapa (ui/fantasyCard.js CARD_FIT).
const { SCALE, OFFSET_X, OFFSET_Y } = CARD_FIT;
const CLOSE_IMAGE_WIDTH = 310;
// Obrázek políčka monstra je o tolik větší než klikací plocha, aby zakryl namalovaný rám.
const SLOT_PAD = 9;

// Pořadí odpovídá řádkům namalovaným na kartě (Vitalita … Přesnost).
const STAT_LABELS = {
  vitality: 'Vitalita',
  force: 'Síla',
  armor: 'Zbroj',
  aether: 'Magická síla',
  resolve: 'Magická obrana',
  tempo: 'Rychlost',
  precision: 'Přesnost'
};

const CATEGORY_LABELS = { physical: 'Fyzická', magical: 'Magická', healing: 'Léčení', buff: 'Posílení' };

export default class PartyScene extends Phaser.Scene {
  constructor() {
    super('Party');
  }

  create(data) {
    this.state = data?.state ?? SaveSystem.load();
    this.returnScene = data?.returnScene ?? 'World';
    this.storageAccess = Boolean(data?.storageAccess);
    this.closing = false;
    this.modal = null;
    this.models = [];

    if (!this.state) {
      this.scene.start('Menu');
      return;
    }

    this.state.party ??= [];
    this.state.monsterStorage ??= [];
    this.storageOffset = 0;
    // Po otevření je monstrum rovnou označené: naposledy vybrané (pokud v kartě hráč už byl),
    // jinak první v aktivní partě.
    this.selected = this.rememberedSelection() ?? (this.state.party.length > 0 ? { type: 'party', index: 0 } : null);
    this.picked = true;
    this.hasSprites = preparePartyFrames(this);

    drawCardFrame(this);
    this.card = this.add.container(OFFSET_X, OFFSET_Y).setScale(SCALE);
    if (this.textures.exists(PARTY_CARD.background)) {
      this.card.add(this.add.image(0, 0, PARTY_CARD.background).setOrigin(0));
    } else {
      this.card.add(this.add.rectangle(0, 0, CARD_W, CARD_H, 0x0b1830).setOrigin(0).setStrokeStyle(6, 0xd6a23a));
    }
    this.layer = this.add.container(0, 0);
    this.card.add(this.layer);

    this.createCloseButton();
    const tabBar = createCardTabBar(this, 'party', {
      onClose: () => this.closeCard(),
      state: this.state,
      returnScene: this.returnScene,
      storageAccess: this.storageAccess,
      beforeLeave: () => SaveSystem.save(this.state)
    });
    this.tabBar = tabBar;
    // Otevřeno ze světa / interiéru: karta vyjede zpod lišty.
    if (data?.animateIn) slideCardIn(this, { hide: tabBar.objects });
    this.render();

    if (this.onKey) this.input.keyboard.off('keydown', this.onKey);
    this.onKey = (event) => {
      if (event.repeat) return;
      if (event.code === 'Escape') {
        if (this.modal) this.closeModal();
        else this.closeCard();
      } else if (event.code === 'KeyP' && !this.modal) {
        this.closeCard();
      }
    };
    this.input.keyboard.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.onKey);
      this.clearModels();
    });
  }

  // ------------------------------------------------------------- pomocné

  list(type) {
    return type === 'party' ? this.state.party : this.state.monsterStorage;
  }

  // Naposledy vybrané monstrum (podle instanceId, takže sedí i po přesunech v partě / úschovně).
  rememberedSelection() {
    const id = this.registry.get('partySelection');
    if (!id) return null;
    for (const type of ['party', 'storage']) {
      const index = this.list(type).findIndex((m) => m?.instanceId === id);
      if (index >= 0) return { type, index };
    }
    return null;
  }

  selectedMonster() {
    if (!this.selected) return null;
    return this.list(this.selected.type)[this.selected.index] ?? null;
  }

  readiness(monster) {
    if ((Number(monster.currentHp) || 0) <= 0) return { label: 'Omdlelé', color: '#ff9a8a' };
    const canAttack = getMonsterSkills(monster).some(
      (skill) => (skill.category === 'physical' || skill.category === 'magical') && skill.remainingUses > 0
    );
    if (!canAttack) return { label: 'Bez útočných technik', color: '#ffc36a' };
    return { label: 'Připraveno', color: '#8ff0b0' };
  }

  speciesName(monster) {
    return getMonsterSpecies(monster.speciesId)?.name ?? monster.speciesId ?? '?';
  }

  text(x, y, value, options = {}) {
    const t = cardText(this, x, y, value, options);
    this.layer.add(t);
    return t;
  }

  addModel(monster, x, y, scale) {
    const model = createMonsterModel(this, { speciesId: monster.speciesId, element: monster.element, side: 'player' });
    model.setPosition(x, y).setScale(scale);
    this.layer.add(model);
    this.models.push(model);
    return model;
  }

  // Obrázek vložený do rámečku (zachová poměr stran). Vrací false, když textura není.
  addImageFit(key, cx, cy, maxW, maxH) {
    if (!key) return false;
    const image = this.add.image(cx, cy, key);
    image.setScale(Math.min(maxW / image.width, maxH / image.height));
    this.layer.add(image);
    return true;
  }

  clearModels() {
    for (const model of this.models) {
      const body = model.getData?.('body');
      if (body) this.tweens.killTweensOf(body);
    }
    this.models = [];
  }

  hpBar(g, x, y, w, h, monster) {
    const maxHp = Number(monster.stats?.vitality) || 1;
    const hp = Math.max(0, Number(monster.currentHp) || 0);
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    const color = ratio > 0.5 ? 0x4ee35a : ratio > 0.25 ? 0xffc14a : 0xff5a5a;
    g.fillStyle(0x05080c, 1).fillRoundedRect(x, y, w, h, h / 2);
    if (ratio > 0) g.fillStyle(color, 1).fillRoundedRect(x + 2, y + 2, Math.max(h - 4, (w - 4) * ratio), h - 4, (h - 4) / 2);
    g.lineStyle(2, 0x9aa4ae, 0.8).strokeRoundedRect(x, y, w, h, h / 2);
    return { hp, maxHp };
  }

  // Prvek z výřezů ve 4 stavech (výchozí / hover / vybrané / šedé).
  // pad = o kolik je obrázek větší než klikací plocha (překryje namalovaný rám podkladu),
  // hoverSelected = hover se ukáže i na vybraném prvku.
  stateButton({ rect, kind, texture = PARTY_CARD.buttons, selected = false, disabled = false, onClick, onHover, onOut, pad = 0, hoverSelected = false }) {
    const has = this.hasSprites && this.textures.get(texture).has(partyFrame(kind, 'normal'));
    let image = null;
    let fallback = null;
    const base = disabled ? 'disabled' : selected ? 'selected' : 'normal';
    const show = (state) => {
      if (image) {
        image.setFrame(partyFrame(kind, state));
        image.setDisplaySize(rect.w + pad * 2, rect.h + pad * 2);
      } else if (fallback) {
        fallback.clear();
        const edge = state === 'hover' ? 0x6fc8ff : state === 'selected' ? 0xffd76a : state === 'disabled' ? 0x5a6068 : 0xd6a23a;
        fallback.fillStyle(state === 'selected' ? 0x1c3a63 : state === 'disabled' ? 0x1a2028 : 0x0d1d33, 0.95).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 8);
        fallback.lineStyle(3, edge, 1).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 8);
      }
    };
    if (has) {
      image = this.add.image(rect.x + rect.w / 2, rect.y + rect.h / 2, texture, partyFrame(kind, base));
      this.layer.add(image);
    } else {
      fallback = this.add.graphics();
      this.layer.add(fallback);
    }
    show(base);

    const zone = this.add.zone(rect.x, rect.y, rect.w, rect.h).setOrigin(0).setInteractive({ useHandCursor: !disabled && Boolean(onClick) });
    zone.on('pointerover', () => { if (!disabled && (!selected || hoverSelected)) show('hover'); onHover?.(); });
    zone.on('pointerout', () => { show(base); onOut?.(); });
    zone.on('pointerdown', () => { if (!disabled && onClick) { show('selected'); onClick(); } });
    this.layer.add(zone);
    this.zones.push(zone);
    return { image, zone };
  }

  // ---------------------------------------------------------------- obsah

  render() {
    this.clearModels();
    this.layer.removeAll(true);
    this.zones = [];

    const party = this.state.party;
    const storage = this.state.monsterStorage;
    if (this.selected && !this.selectedMonster()) {
      this.selected = party.length > 0 ? { type: 'party', index: 0 } : null;
    }
    // Zapamatovat výběr pro příští otevření karty (v rámci hry).
    this.registry.set('partySelection', this.selectedMonster()?.instanceId ?? null);

    this.text(HEADER.infoX, HEADER.infoY,
      this.storageAccess
        ? 'Jsi u Liory: můžeš přesouvat monstra mezi partou a úschovnou. Liora léčí partu i úschovnu.'
        : 'Úschovnu tu jen prohlížíš – přesouvat monstra mezi partou a úschovnou jde u Liory v domě léčitelky.',
      { size: 16, color: this.storageAccess ? '#8fd3ff' : '#c9d3dd', wrap: 760, originY: 0.5, strokeThickness: 3 });
    this.text(HEADER.countsX, HEADER.countsY, `Aktivní parta ${party.length}/${PARTY_LIMIT} · Úschovna ${storage.length}`, {
      size: 17, originX: 1, color: '#f3e4bd', strokeThickness: 3
    });

    this.renderPartySlots();
    this.renderStorage();
    this.renderDetail();

    // Zóny (myš) nad vším ostatním v kartě.
    this.zones.forEach((zone) => this.layer.bringToTop(zone));
  }

  renderPartySlots() {
    const g = this.add.graphics();
    PARTY_SLOTS.forEach((rect, i) => {
      const monster = this.state.party[i];
      if (!monster) {
        // Prázdné místo: neaktivní (šedé) políčko z monsterselect.png přes namalovaný podklad.
        this.stateButton({ rect, kind: 'slot', texture: PARTY_CARD.monsterSelect, disabled: true, pad: SLOT_PAD });
        this.text(rect.x + 270, rect.y + 28, '— volné místo —', { size: 18, color: '#d8dee4', originX: 0.5, originY: 0.5 });
        return;
      }
      const selected = this.picked && this.selected?.type === 'party' && this.selected.index === i;
      const fainted = (Number(monster.currentHp) || 0) <= 0;
      this.stateButton({
        rect, kind: 'slot', texture: PARTY_CARD.monsterSelect, selected, pad: SLOT_PAD,
        onClick: () => this.select('party', i)
      });
      if (fainted && !selected && this.hasSprites) {
        // Omdlelé monstrum: neaktivní (šedé) políčko.
        this.layer.add(this.add.image(rect.x + rect.w / 2, rect.y + rect.h / 2, PARTY_CARD.monsterSelect, partyFrame('slot', 'disabled')).setDisplaySize(rect.w + SLOT_PAD * 2, rect.h + SLOT_PAD * 2));
      }

      const ready = this.readiness(monster);
      // Miniatura: hlava z prvního snímku animace v rámečku políčka (jinak kreslený model).
      if (!this.addImageFit(monsterHeadKey(this, monster.speciesId), rect.x + 45, rect.y + 48, 74, 72)) {
        this.addModel(monster, rect.x + 52, rect.y + rect.h - 12, 0.5);
      }
      this.text(rect.x + 120, rect.y + 12, monster.name, { size: 22, bold: true });
      this.text(rect.x + 120, rect.y + 47, `${this.speciesName(monster)} · ${elementName(monster.element)} · Úr. ${monster.level}`, {
        size: 13, color: '#c9b98f', strokeThickness: 2
      });
      const { hp, maxHp } = this.hpBar(g, rect.x + 119, rect.y + rect.h - 30, 248, 18, monster);
      this.text(rect.x + 376, rect.y + rect.h - 21, `${hp}/${maxHp}`, { size: 14, color: '#dbe6f3', originY: 0.5, strokeThickness: 2 });
      this.text(rect.x + 440, rect.y + 29, ready.label, { size: 13, bold: true, color: ready.color, originX: 1, originY: 0.5, strokeThickness: 2 });
    });
    this.layer.add(g);
  }

  renderStorage() {
    const storage = this.state.monsterStorage;
    const perPage = STORAGE_COLUMNS * STORAGE_ROWS;
    const maxOffset = Math.max(0, Math.ceil((storage.length - perPage) / STORAGE_COLUMNS) * STORAGE_COLUMNS);
    this.storageOffset = Math.min(this.storageOffset, maxOffset);

    this.text(STORAGE.countX, STORAGE.headerY, `(${storage.length})`, { size: 22, bold: true, color: '#ffe7ae', originY: 0.5 });
    this.stateButton({
      rect: STORAGE.up, kind: 'arrowUp', disabled: this.storageOffset === 0,
      onClick: () => { this.storageOffset = Math.max(0, this.storageOffset - STORAGE_COLUMNS); this.render(); }
    });
    this.stateButton({
      rect: STORAGE.down, kind: 'arrowDown', disabled: this.storageOffset >= maxOffset,
      onClick: () => { this.storageOffset = Math.min(maxOffset, this.storageOffset + STORAGE_COLUMNS); this.render(); }
    });

    if (storage.length === 0) {
      this.text(STORAGE.area.x + STORAGE.area.w / 2, STORAGE.area.y + STORAGE.area.h / 2, 'Úschovna je prázdná.', {
        size: 18, color: '#8f9aa6', originX: 0.5, originY: 0.5
      });
      return;
    }

    const g = this.add.graphics();
    const items = [];
    for (let k = 0; k < perPage; k++) {
      const index = this.storageOffset + k;
      const monster = storage[index];
      if (!monster) break;
      const rect = {
        x: STORAGE.columns[k % STORAGE_COLUMNS],
        y: STORAGE.rowY[Math.floor(k / STORAGE_COLUMNS)],
        w: STORAGE.item.w,
        h: STORAGE.item.h
      };
      const selected = this.selected?.type === 'storage' && this.selected.index === index;
      this.stateButton({ rect, kind: 'storage', selected, onClick: () => this.select('storage', index) });
      items.push([rect, monster]);
    }
    this.layer.add(g);
    for (const [rect, monster] of items) {
      this.text(rect.x + 44, rect.y + 2, `${monster.name} · Úr. ${monster.level}`, { size: 13, bold: true, strokeThickness: 2 });
      this.hpBar(g, rect.x + 44, rect.y + 21, 150, 10, monster);
    }
  }

  renderDetail() {
    const monster = this.selectedMonster();
    if (!monster) {
      this.text(1030, 520, 'Vyber monstrum vlevo.', { size: 26, color: '#8f9aa6', originX: 0.5 });
      return;
    }

    const where = this.selected.type === 'party' ? 'v aktivní partě' : 'v úschovně';
    const ready = this.readiness(monster);
    const g = this.add.graphics();
    this.layer.add(g);

    const p = DETAIL.portrait;
    // Portrét: první snímek animace bez pohybu; velký model na kruhu zůstává s animací idle.
    if (!this.addImageFit(monsterStillKey(this, monster.speciesId), p.x + p.w / 2, p.y + p.h / 2 + 4, p.w - 18, p.h - 24)) {
      this.addModel(monster, p.x + p.w / 2, p.y + p.h - 18, 0.8);
    }
    this.addModel(monster, DETAIL.model.x, DETAIL.model.y, 1.05);

    // Jméno + tlačítko přejmenování (✎) hned za ním; dlouhé jméno se zúží, aby se nepřekrývalo s živlem.
    const nameText = this.text(DETAIL.textX, DETAIL.nameY, monster.name, { size: 34, bold: true, color: '#ffe7ae', originY: 0.5, strokeThickness: 5 });
    const nameMax = DETAIL.elementDot.x - DETAIL.elementDot.r - 12 - 54 - 12 - DETAIL.textX;
    if (nameText.width > nameMax) nameText.setScale(nameMax / nameText.width);
    const rename = cardButton(this, null, DETAIL.textX + nameText.displayWidth + 12, DETAIL.nameY - 27, 54, 54, '✎', () => this.renameMonster(monster), { size: 28 });
    for (const o of rename.objects) this.layer.add(o);
    this.text(DETAIL.textX, DETAIL.line1Y - 8, `${this.speciesName(monster)} · ${elementName(monster.element)} · Úroveň ${monster.level} · ${where}`, {
      size: 16, color: '#c9b98f', strokeThickness: 2, originY: 0.5
    });

    const free = Math.max(0, Math.min(MAX_FREE_TRAINING, Number(monster.unspentTrainingPoints) || 0));
    const total = getTotalTrainingPoints(monster);
    this.text(DETAIL.textX, DETAIL.line2Y,
      `Bond ${monster.bond ?? 0} (${getBondLevel(monster.bond)}) · ${ready.label} · Training Points: volné ${free}/${MAX_FREE_TRAINING}, použité ${total}/${MAX_TRAINING_TOTAL}`,
      { size: 14, color: '#dbe6f3', strokeThickness: 2, originY: 0.5 });

    const bar = DETAIL.hpBar;
    const { hp, maxHp } = this.hpBar(g, bar.x, bar.y, bar.w, bar.h, monster);
    this.text(DETAIL.hpTextX, DETAIL.hpY, `${hp} / ${maxHp}`, { size: 18, bold: true, originY: 0.5 });

    this.renderStats(g, monster, free, total);
    this.renderSkills(monster);
    this.renderHistory(monster);
    this.renderActions();
  }

  renderStats(g, monster, free, total) {
    // Volné body k rozdělení – vlastní řádek dole v rámečku statistik.
    g.lineStyle(2, 0xc9a35a, 0.6).lineBetween(590, STATS.freeLineY, 1048, STATS.freeLineY);
    this.text(STATS.freeX, STATS.freeY, `Volné body k rozdělení: ${free}`, {
      size: 22, bold: true, color: free > 0 ? '#ffd76a' : '#c9b98f', originX: 0.5, originY: 0.5, strokeThickness: 4
    });
    const training = monster.trainingPoints ?? {};

    Object.keys(STAT_LABELS).forEach((stat, index) => {
      const y = STATS.rowsY[index];
      const value = Number(monster.stats?.[stat]) || 0;
      const invested = Number(training[stat]) || 0;
      const progress = invested % TRAINING_PER_STAT_UP;
      const canSpend = free > 0 && invested < MAX_TRAINING_PER_STAT && total < MAX_TRAINING_TOTAL;

      this.text(STATS.valueX, y, String(value), { size: 22, bold: true, color: '#fff2c4', originX: 1, originY: 0.5 });
      for (let i = 0; i < progress; i++) {
        const cx = STATS.diamondX + i * STATS.diamondStep;
        const h = STATS.diamondHalf;
        g.fillStyle(0xffd23a, 1).fillPoints([{ x: cx, y: y - h }, { x: cx + h, y }, { x: cx, y: y + h }, { x: cx - h, y }], true);
      }

      const rowInfo = `${STAT_LABELS[stat]} ${value}\n${this.statEffect(stat, value)}`;
      // Najetí na řádek ukáže, co statistika dělá v boji.
      const rowZone = this.add.zone(STATS.labelX - 50, y - 18, 340, 36).setOrigin(0).setInteractive();
      rowZone.on('pointerover', () => this.showStatTip(rowInfo, y));
      rowZone.on('pointerout', () => this.hideSkillTip());
      this.layer.add(rowZone);
      this.zones.push(rowZone);

      this.stateButton({
        rect: { x: STATS.plus.cx - STATS.plus.w / 2, y: y - STATS.plus.h / 2, w: STATS.plus.w, h: STATS.plus.h },
        kind: 'plus',
        disabled: !canSpend,
        onClick: () => this.spendTrainingPoint(stat),
        onHover: () => this.showStatTip(rowInfo, y),
        onOut: () => this.hideSkillTip()
      });
    });
  }

  renderSkills(monster) {
    const skills = getMonsterSkills(monster);
    if (skills.length === 0) {
      this.text(SKILLS.x + SKILLS.w / 2, SKILLS.rowsY[0] + 24, 'Žádné naučené schopnosti.', { size: 17, color: '#8f9aa6', originX: 0.5, originY: 0.5 });
      return;
    }
    const shown = skills.slice(0, SKILLS.rowsY.length);
    // Jen schopnost (název a použití); podrobnosti útoku v tooltipu pod myší.
    shown.forEach((skill, index) => {
      const y = SKILLS.rowsY[index];
      this.stateButton({
        rect: { x: SKILLS.x, y, w: SKILLS.w, h: SKILLS.h }, kind: 'skill', selected: Boolean(skill.bondOnly),
        onHover: () => this.showSkillTip(skill, y),
        onOut: () => this.hideSkillTip()
      });
    });
    shown.forEach((skill, index) => {
      const y = SKILLS.rowsY[index];
      // Bez počtu použití (pravidlo zrušeno) – vpravo síla útoku.
      this.text(SKILLS.x + 22, y + SKILLS.h / 2, skill.name, { size: 19, bold: true, color: '#f3e4bd', originY: 0.5, strokeThickness: 3 });
      if (skill.power) this.text(SKILLS.usesX, y + SKILLS.h / 2, `síla ${skill.power}`, { size: 17, color: '#dbe6f3', originX: 1, originY: 0.5 });
    });
  }

  // Tooltip k řádku statistiky (geny, trénink) – vpravo od tlačítka +.
  showStatTip(info, rowY) {
    this.hideSkillTip();
    const w = 380;
    const body = cardText(this, 0, 0, info, { size: 18, color: '#e8eef5', wrap: w - 40 });
    const h = body.height + 28;
    const x = STATS.plus.cx + 40;
    const y = Math.min(rowY - 16, 880 - h);
    const tip = this.add.container(0, 0);
    const bg = nineImage(this, 'nu-panel', x, y, w, h, 0.5);
    if (bg) tip.add(bg); else tip.add(this.add.rectangle(x, y, w, h, 0x0d1d33, 0.96).setOrigin(0).setStrokeStyle(3, 0xd6a23a));
    body.setPosition(x + 20, y + 14);
    tip.add(body);
    this.layer.add(tip);
    this.skillTip = tip;
  }

  // Tooltip s informacemi o útoku (vlevo od panelu schopností).
  showSkillTip(skill, rowY) {
    this.hideSkillTip();
    const STATUS = { poison: 'Otrava', sleep: 'Spánek', paralysis: 'Paralýza', freeze: 'Zmrazení', burn: 'Popálení', curse: 'Prokletí', stun: 'Omráčení', bleed: 'Krvácení' };
    const lines = [
      `${CATEGORY_LABELS[skill.category] ?? skill.category} · ${elementName(skill.element)}${skill.bondOnly ? ' · Bond' : ''}`,
      skill.power ? `Síla útoku ${skill.power} · přesnost ${Math.round((skill.accuracy ?? 1) * 100)} %` : `Přesnost ${Math.round((skill.accuracy ?? 1) * 100)} %`,
      `Dosah ${skill.range ?? 1}`
    ];
    if (skill.statusEffect) lines.push(`Efekt: ${STATUS[skill.statusEffect.id] ?? skill.statusEffect.id} (${Math.round((skill.statusEffect.chance ?? 0) * 100)} %, ${skill.statusEffect.duration ?? 1} tahy)`);
    if (skill.effect?.stat) lines.push(`Posílení: ${skill.effect.stat} +${skill.effect.amount} na ${skill.effect.duration} tahy`);
    const w = 400;
    const title = cardText(this, 0, 0, skill.name, { size: 22, bold: true, color: '#ffe7ae' });
    const body = cardText(this, 0, 0, [...lines, '', skill.description ?? ''].join('\n').trim(), { size: 16, color: '#e8eef5', wrap: w - 40 });
    const h = 34 + title.height + body.height;
    const x = SKILLS.x - w - 14;
    const y = Math.min(rowY - 10, 880 - h);
    const tip = this.add.container(0, 0);
    const bg = nineImage(this, 'nu-panel', x, y, w, h, 0.5);
    if (bg) tip.add(bg); else tip.add(this.add.rectangle(x, y, w, h, 0x0d1d33, 0.96).setOrigin(0).setStrokeStyle(3, 0xd6a23a));
    title.setPosition(x + 20, y + 14);
    body.setPosition(x + 20, y + 22 + title.height);
    tip.add([title, body]);
    this.layer.add(tip);
    this.skillTip = tip;
  }

  hideSkillTip() {
    this.skillTip?.destroy();
    this.skillTip = null;
  }

  renderHistory(monster) {
    const history = [...(monster.history ?? [])].reverse().slice(0, HISTORY.rowsY.length);
    if (history.length === 0) {
      this.text(HISTORY.x, HISTORY.rowsY[0], 'Zatím žádné zaznamenané události.', { size: 15, color: '#8f9aa6', originY: 0.5, strokeThickness: 2 });
      return;
    }
    history.forEach((entry, index) => {
      this.text(HISTORY.x, HISTORY.rowsY[index], entry, { size: 14, color: '#c9d3dd', originY: 0.5, wrap: HISTORY.wrap, strokeThickness: 2 });
    });
  }

  renderActions() {
    const inParty = this.selected.type === 'party';
    this.stateButton({ rect: ACTIONS.store, kind: 'store', disabled: !this.storageAccess, onClick: () => this.moveSelected() });
    if (!inParty) {
      // Obrázek nese nápis „Do úschovny“ – u monstra z úschovny ho překryje „Do party“.
      const r = ACTIONS.store;
      const plate = this.add.graphics();
      plate.fillStyle(this.storageAccess ? 0x0b1f45 : 0x2a2d31, 1).fillRoundedRect(r.x + 16, r.y + 12, r.w - 32, r.h - 24, 6);
      this.layer.add(plate);
      this.text(r.x + r.w / 2, r.y + r.h / 2, 'Do party', { size: 22, color: this.storageAccess ? '#f3e4bd' : '#b8bec4', originX: 0.5, originY: 0.5 });
    }
    if (!this.storageAccess) {
      this.text(ACTIONS.store.x + ACTIONS.store.w / 2, ACTIONS.store.y - 14, 'Přesun jen u Liory', { size: 13, color: '#9aa6b2', originX: 0.5, originY: 0.5, strokeThickness: 2 });
    }
    this.stateButton({ rect: ACTIONS.release, kind: 'release', onClick: () => this.requestRelease() });
  }

  // ---------------------------------------------------------------- akce

  select(type, index) {
    this.selected = { type, index };
    this.picked = true;
    this.render();
  }

  // Co statistika dělá v boji – srozumitelně a s čísly pro aktuální hodnotu.
  statEffect(stat, value) {
    const half = Math.floor(value / 2);
    switch (stat) {
      case 'vitality': return `Životy: monstrum má v boji ${value} HP. Když HP klesnou na 0, omdlí.`;
      case 'force': return `Fyzické útoky: +${half} k poškození každého fyzického zásahu (polovina Síly).`;
      case 'armor': return `Obrana proti fyzickým útokům: každý fyzický zásah je o ${half} slabší (polovina Zbroje).`;
      case 'aether': return `Magické útoky: +${half} k poškození každého magického zásahu (polovina Magické síly).`;
      case 'resolve': return `Obrana proti magii: každý magický zásah je o ${half} slabší (polovina Magické obrany).`;
      case 'tempo': return value >= 12
        ? 'Pohyb: v boji ujde 3 pole za tah (Rychlost 12 a víc).'
        : `Pohyb: v boji ujde 2 pole za tah. Od Rychlosti 12 ujde 3 pole (chybí ${12 - value}).`;
      case 'precision': {
        const diff = (value - 80) * 0.5;
        const reach = 5 + Math.max(0, Math.floor((value - 80) / 8));
        return `Fyzické útoky: ${diff >= 0 ? '+' : '−'}${String(Math.abs(diff)).replace('.', ',')} % k šanci zasáhnout (0,5 % za bod nad 80, nejvýš 98 %). Kouzla: plný dosah ${reach} polí bez postihu (+1 pole za každých 8 bodů nad 80).`;
      }
      default: return '';
    }
  }

  spendTrainingPoint(stat) {
    const monster = this.selectedMonster();
    if (!monster) return;
    monster.unspentTrainingPoints ??= 0;
    if (monster.unspentTrainingPoints <= 0) {
      this.flash('Toto monstrum nemá volné Training Points.');
      return;
    }
    const result = addTrainingPoints(monster, stat, 1);
    if (result.added <= 0) {
      this.flash('Tato statistika už dosáhla limitu tréninku.');
      return;
    }
    monster.unspentTrainingPoints -= result.added;
    SaveSystem.save(this.state);
    this.render();
    this.flash(`${monster.name}: +1 bod do statistiky ${STAT_LABELS[stat]}.`, '#ffd76a');
  }

  moveSelected() {
    if (!this.storageAccess) {
      this.flash('Přesouvat monstra mezi partou a úschovnou jde jen u Liory v domě léčitelky.');
      return;
    }
    const monster = this.selectedMonster();
    if (!monster) return;

    if (this.selected.type === 'party') {
      if (this.state.party.length <= 1) {
        this.flash('Poslední monstrum aktivní party nejde uložit do úschovny.');
        this.render();
        return;
      }
      this.state.party.splice(this.selected.index, 1);
      this.state.monsterStorage.push(monster);
      this.selected = { type: 'storage', index: this.state.monsterStorage.length - 1 };
      const perPage = STORAGE_COLUMNS * STORAGE_ROWS;
      this.storageOffset = Math.max(0, Math.ceil((this.state.monsterStorage.length - perPage) / STORAGE_COLUMNS) * STORAGE_COLUMNS);
      this.flash(`${monster.name} je v úschovně.`, '#8fd3ff');
    } else {
      if (this.state.party.length >= PARTY_LIMIT) {
        this.flash('Aktivní parta je plná (4). Nejdřív jedno monstrum ulož do úschovny.');
        this.render();
        return;
      }
      this.state.monsterStorage.splice(this.selected.index, 1);
      this.state.party.push(monster);
      this.selected = { type: 'party', index: this.state.party.length - 1 };
      this.flash(`${monster.name} je v aktivní partě.`, '#8fd3ff');
    }
    SaveSystem.save(this.state);
    this.render();
  }

  requestRelease() {
    const monster = this.selectedMonster();
    if (!monster) return;
    if (this.selected.type === 'party' && this.state.party.length <= 1) {
      this.flash('Poslední monstrum aktivní party nejde propustit.');
      this.render();
      return;
    }
    this.closeModal();
    this.modal = openCardModal(
      this,
      `Propustit ${monster.name}?`,
      ['Monstrum odejde natrvalo. Záznam o druhu v Bestiáři zůstane.'],
      [
        { label: 'Propustit', danger: true, onClick: () => { this.closeModal(); this.release(); } },
        { label: 'Zpět', onClick: () => { this.closeModal(); this.render(); } }
      ]
    );
  }

  // Přejmenování monstra kdykoli po chycení (prázdné jméno = jméno druhu).
  renameMonster(monster) {
    const speciesName = this.speciesName(monster);
    askName(this, {
      title: 'Přejmenovat monstrum',
      current: monster.name,
      fallback: speciesName,
      fallbackLabel: 'Jméno druhu',
      onDone: (name) => {
        if (!name || name === monster.name) return;
        const old = monster.name;
        monster.name = name;
        SaveSystem.save(this.state);
        this.render();
        this.flash(`${old} se teď jmenuje ${name}.`, '#ffd76a');
      }
    });
  }

  release() {
    const monster = this.selectedMonster();
    if (!monster) return;
    if (this.selected.type === 'party' && this.state.party.length <= 1) return;
    this.list(this.selected.type).splice(this.selected.index, 1);
    this.selected = this.state.party.length > 0 ? { type: 'party', index: 0 } : null;
    this.picked = false;
    SaveSystem.save(this.state);
    this.render();
    this.flash(`${monster.name} bylo propuštěno. Záznam v Bestiáři zůstává.`, '#ffd76a');
  }

  closeModal() {
    this.modal?.destroy();
    this.modal = null;
  }

  // Hláška vlevo dole na kartě (nad krajinou, vedle tlačítka Zavřít).
  flash(message, color = '#ffb3a0') {
    this.flashText?.destroy();
    this.flashText = cardText(this, OFFSET_X + 60 * SCALE, OFFSET_Y + 905 * SCALE, message, {
      size: 22, bold: true, color, strokeThickness: 5, wrap: 560
    }).setDepth(160);
    this.tweens.add({ targets: this.flashText, alpha: 0, delay: 2600, duration: 500 });
  }

  // Zavřít: obrázky stavů přes namalované tlačítko (stejně jako na kartě hrdiny).
  createCloseButton() {
    const zone = this.add.zone(CLOSE_AREA.x, CLOSE_AREA.y, CLOSE_AREA.w, CLOSE_AREA.h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.closeCard());
    if (this.textures.exists(closeStateKey('normal'))) {
      const image = this.add.image(CLOSE_AREA.x + CLOSE_AREA.w / 2, CLOSE_AREA.y + CLOSE_AREA.h / 2, closeStateKey('normal'));
      const show = (state) => { image.setTexture(closeStateKey(state)); image.setScale(CLOSE_IMAGE_WIDTH / image.width); };
      show('normal');
      this.card.add(image);
      zone.on('pointerover', () => show('hover'));
      zone.on('pointerout', () => show('normal'));
      zone.on('pointerdown', () => show('active'));
    }
    this.card.add(zone);
  }

  closeCard() {
    if (this.closing) return;
    this.closing = true;
    SaveSystem.save(this.state);
    // Karta zajede pod lištu, pak se vrátí scéna pod ní.
    slideCardOut(this, () => {
      this.scene.stop();
      this.scene.resume(this.returnScene);
    }, { hide: this.tabBar?.objects });
  }
}
