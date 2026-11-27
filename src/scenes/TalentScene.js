import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import {
  TALENT_TREES,
  TALENT_MAX_RANK,
  TREE_POINT_LIMIT,
  TIER_REQUIREMENTS,
  TIER_NAMES
} from '../data/talents.js';
import {
  normalizeTalentProgress,
  canChooseSpecialization,
  chooseSpecialization,
  canInvestTalent,
  investTalent,
  getTalentRank,
  getTreeInvestment,
  isTreeComplete,
  isTreeOpen,
  isTierUnlocked
} from '../systems/TalentSystem.js';
import { MAGIC_SCHOOLS, isMagicSchoolUnlocked } from '../systems/MagicMasterySystem.js';
import { elementName } from '../systems/ElementSystem.js';
import { closeStateKey } from '../ui/heroCard/tabSprites.js';
import { createCardTabBar, slideCardIn, slideCardOut } from '../ui/cardTabBar.js';
import { drawCardFrame, CARD_FIT, CARD_PANEL, uiTitle } from '../ui/fantasyCard.js';
import { rebuildTalentCard } from '../ui/newUiKit.js';
import { talentDisplayName, TALENT_INDEX as TALENT_LOOKUP } from '../data/talents.js';
import {
  TALENT_CARD,
  FRAME_INNER,
  TREE_PANELS,
  talentNodeRect,
  RANK_DIAMONDS,
  FINAL_BOXES,
  TREE_HEADER_RIGHT,
  FREE_POINTS,
  HEADER,
  CLOSE_AREA
} from '../ui/talentCardLayout.js';

// Karta Talenty (klávesa T): tři stromy – Souboj, Řemesla, Kouzelník.
// Podklad je obrázek karty (assets/ui/talents): barevná verze, přes zamčené a neaktivní
// talenty výřezy ze šedé verze. Modrý rámeček = talent pod myší, zlatý = přidělené body.
// Klik na talent přidá hodnost, pokud to pravidla dovolí (TalentSystem).

const FONT = 'Lora, Georgia, "Times New Roman", serif';
const GOLD = 0xd6a23a;
const CARD_W = 1536;
const CARD_H = 1024;
// Obsah karty zmenšený do panelu karty Mapa (ui/fantasyCard.js CARD_FIT).
const { SCALE, OFFSET_X, OFFSET_Y } = CARD_FIT;
const CLOSE_IMAGE_WIDTH = 310;

const toScreen = (x, y) => ({ x: OFFSET_X + x * SCALE, y: OFFSET_Y + y * SCALE });

const text = (scene, x, y, value, options = {}) =>
  scene.add
    .text(x, y, value, {
      fontFamily: FONT,
      fontSize: `${options.size ?? 20}px`,
      fontStyle: options.bold ? 'bold' : 'normal',
      color: options.color ?? '#f3e4bd',
      stroke: options.stroke ?? '#0a0603',
      // Tenčí písmo: netučné texty jen se slabým obrysem (jinak drobné písmo slévá).
      strokeThickness: options.strokeThickness ?? (options.bold ? 3 : 2),
      align: options.align ?? 'left',
      wordWrap: options.wrap ? { width: options.wrap } : undefined,
      lineSpacing: 4
    })
    .setOrigin(options.originX ?? 0, options.originY ?? 0)
    .setResolution(2);

export default class TalentScene extends Phaser.Scene {
  constructor() {
    super('Talents');
  }

  create(data) {
    this.state = data?.state ?? SaveSystem.load();
    this.returnScene = data?.returnScene ?? 'World';
    this.storageAccess = Boolean(data?.storageAccess);
    this.closing = false;
    this.modal = null;

    if (!this.state) {
      this.scene.start('Menu');
      return;
    }
    normalizeTalentProgress(this.state);
    // Podklad karty s aktuálními názvy (Elementární soustředění → zvolená škola).
    const focus = TALENT_LOOKUP.get('elemental_focus')?.talent;
    // (Vždy znovu – jiná uložená hra může mít jinou nebo žádnou školu.)
    if (focus) rebuildTalentCard(this, { elemental_focus: talentDisplayName(focus, this.state.talentProgress) });

    drawCardFrame(this);

    // Celá karta v souřadnicích podkladu 1536 × 1024.
    this.card = this.add.container(OFFSET_X, OFFSET_Y).setScale(SCALE);
    if (this.textures.exists(TALENT_CARD.color)) {
      this.card.add(this.add.image(0, 0, TALENT_CARD.color).setOrigin(0));
    } else {
      this.card.add(this.add.rectangle(0, 0, CARD_W, CARD_H, 0x0b1830).setOrigin(0).setStrokeStyle(6, GOLD));
    }
    this.layer = this.add.container(0, 0);
    this.card.add(this.layer);
    // Jednotná hlavička karet (stejně jako Dovednosti, Bestiář, Úkoly, Mapa).
    uiTitle(this, CARD_PANEL.x + 150, CARD_PANEL.y + 38, 'Talenty', { icon: 'book', size: 34 });

    this.tooltip = this.createTooltip();
    this.createCloseButton();
    const tabBar = createCardTabBar(this, 'talents', {
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
      if (event.code === 'Escape') {
        if (this.modal) this.closeModal();
        else this.closeCard();
      } else if (event.code === 'KeyT' && !this.modal) {
        this.closeCard();
      }
    };
    this.input.keyboard.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));
  }

  // ---------------------------------------------------------------- obsah

  render() {
    this.layer.removeAll(true);
    this.tooltip.hide();
    const progress = this.state.talentProgress;

    // Volné body vedle namalovaného „Volné body:“.
    this.layer.add(
      text(this, FREE_POINTS.x, FREE_POINTS.y, String(progress.pointsAvailable), {
        size: 36, bold: true, originY: 0.5, strokeThickness: 5,
        color: progress.pointsAvailable > 0 ? '#ffd76a' : '#c9b98f'
      })
    );
    this.layer.add(
      text(this, 1488, HEADER.spentY, `Utraceno ${progress.pointsSpent} z ${progress.pointsEarned} · 1 bod za každou sudou úroveň`, {
        size: 14, color: '#c9d3dd', originX: 1
      })
    );

    const main = TALENT_TREES.find((tree) => tree.id === progress.specialization);
    const subtitle = main
      ? `Hlavní specializace: ${main.name} – ${main.passive}`
      : canChooseSpecialization(this.state).ok
        ? 'Zvol hlavní specializaci (tlačítko Zvolit u stromu). Její pasivní bonus bude jediný aktivní, do ostatních stromů se dostaneš až po jejím dokončení.'
        : `${canChooseSpecialization(this.state).reason} Body se zatím ukládají.`;
    this.layer.add(text(this, HEADER.subtitleX, HEADER.subtitleY, subtitle, { size: 17, color: '#dbe6f3', wrap: 840, originY: 0.5 }));

    TALENT_TREES.forEach((tree, index) => this.renderTree(tree, index));
  }

  // Výřez šedé verze podkladu přes daný obdélník.
  addGray(rect) {
    if (!this.textures.exists(TALENT_CARD.gray)) {
      const shade = this.add.rectangle(rect.x, rect.y, rect.w, rect.h, 0x10161e, 0.6).setOrigin(0);
      this.layer.add(shade);
      return shade;
    }
    const image = this.add.image(0, 0, TALENT_CARD.gray).setOrigin(0).setCrop(rect.x, rect.y, rect.w, rect.h);
    this.layer.add(image);
    return image;
  }

  // Rámeček (modrý / zlatý) přiložený zlatou linkou na okraj obdélníku.
  addFrame(key, rect) {
    if (!this.textures.exists(key)) {
      const g = this.add.graphics();
      g.lineStyle(4, key === TALENT_CARD.frameHover ? 0x6fc8ff : 0xffd76a, 1).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 8);
      this.layer.add(g);
      return g;
    }
    const inner = FRAME_INNER[key];
    const image = this.add.image(0, 0, key).setOrigin(0);
    const sx = rect.w / inner.w;
    const sy = rect.h / inner.h;
    image.setScale(sx, sy).setPosition(rect.x - inner.x * sx, rect.y - inner.y * sy);
    this.layer.add(image);
    return image;
  }

  renderTree(tree, treeIndex) {
    const progress = this.state.talentProgress;
    const invested = getTreeInvestment(this.state, tree.id);
    const isMain = progress.specialization === tree.id;
    const open = isTreeOpen(this.state, tree.id);
    const right = TREE_HEADER_RIGHT[treeIndex];
    const panel = TREE_PANELS[treeIndex];

    // Zamčený strom (po volbě specializace) celý šedě.
    const treeLocked = Boolean(progress.specialization) && !open;
    if (treeLocked) this.addGray(panel);
    const headerRect = { x: panel.x + 6, y: panel.y + 4, w: panel.w - 12, h: 86 };
    if (isMain) this.addFrame(TALENT_CARD.frameActive, headerRect);

    // Hlavička stromu: pod myší modrý rámeček a tooltip s bonusy stromu (tlačítko Zvolit zůstává nad ní).
    const headerHover = this.addFrame(TALENT_CARD.frameHover, headerRect).setVisible(false);
    const headerZone = this.add.zone(headerRect.x, headerRect.y, headerRect.w, headerRect.h).setOrigin(0).setInteractive();
    headerZone.on('pointerover', () => { headerHover.setVisible(true); this.showTreeTip(tree, headerRect); });
    headerZone.on('pointerout', () => { headerHover.setVisible(false); this.tooltip.hide(); });
    this.layer.add(headerZone);

    this.layer.add(
      text(this, right, HEADER.investedY, invested >= TREE_POINT_LIMIT ? `${invested} bodů` : `${invested} / ${TREE_POINT_LIMIT}`, {
        size: 26, bold: true, originX: 1, strokeThickness: 4,
        color: invested >= TREE_POINT_LIMIT ? '#8ff0b0' : '#f3e4bd'
      })
    );

    let status = '';
    if (!progress.specialization) {
      if (canChooseSpecialization(this.state).ok) {
        this.addButton(right - 120, HEADER.buttonY, 120, 34, 'Zvolit', () => this.confirmSpecialization(tree));
      } else {
        status = 'Odemkne 4. úroveň hrdiny';
      }
    } else if (isMain) {
      status = isTreeComplete(this.state, tree.id) ? 'Hlavní strom – dokončen' : 'Hlavní specializace';
    } else {
      status = open ? 'Otevřen (bez pasivního bonusu)' : 'Zamčeno do dokončení hlavního stromu';
    }
    if (status) {
      this.layer.add(text(this, right, HEADER.statusY, status, { size: 14, color: isMain ? '#8fd3ff' : '#aab4bf', originX: 1, wrap: 200, align: 'right' }));
    }

    tree.tiers.forEach((tier, tierIndex) => {
      tier.talents.forEach((talent, slot) => {
        this.renderNode(tree, talent, tierIndex, talentNodeRect(treeIndex, tierIndex, slot), treeLocked);
      });
    });

    // Závěrečný talent: šedě, dokud strom není dokončený.
    const done = isTreeComplete(this.state, tree.id);
    const box = FINAL_BOXES[treeIndex];
    if (!done && !treeLocked) this.addGray(box);
    if (done) this.addFrame(TALENT_CARD.frameActive, box);
    // Popis se musí vejít do rámečku (dlouhý popis = menší písmo).
    const finalText = done ? tree.final.text : `Po ${TREE_POINT_LIMIT} bodech: ${tree.final.text}`;
    const maxH = box.h - 40 - 12;
    let desc = null;
    for (let size = 13; size >= 10; size--) {
      desc?.destroy();
      desc = text(this, box.x + 92, box.y + 40, finalText, { size, color: done ? '#f3e4bd' : '#b8c0c8', wrap: box.w - 108, strokeThickness: 2 });
      if (desc.height <= maxH) break;
    }
    this.layer.add(desc);
  }

  renderNode(tree, talent, tierIndex, rect, treeLocked) {
    const rank = getTalentRank(this.state, talent.id);
    const check = canInvestTalent(this.state, talent.id);
    const maxed = rank >= TALENT_MAX_RANK;
    const tierUnlocked = isTreeOpen(this.state, tree.id) && isTierUnlocked(this.state, tree.id, tierIndex);

    // Šedě: zamčený nebo neaktivní talent (bez bodů a teď nejde přidat).
    if (rank === 0 && !check.ok && !treeLocked) this.addGray(rect);
    // Zlatý rámeček: talent má přidělené body.
    if (rank > 0) this.addFrame(TALENT_CARD.frameActive, rect);

    // Kosočtverečky hodností: plné = přidělené, tmavé = zbývající.
    {
      const g = this.add.graphics();
      const { textLeft, textRight, step } = RANK_DIAMONDS;
      const centerX = rect.x + (textLeft + rect.w - textRight) / 2;
      const firstX = centerX - ((TALENT_MAX_RANK - 1) * step) / 2;
      for (let i = 0; i < TALENT_MAX_RANK; i++) {
        const cx = firstX + i * step;
        const cy = rect.y + RANK_DIAMONDS.dy;
        const h = RANK_DIAMONDS.half;
        const points = [{ x: cx, y: cy - h }, { x: cx + h, y: cy }, { x: cx, y: cy + h }, { x: cx - h, y: cy }];
        const filled = i < rank;
        g.fillStyle(filled ? (maxed ? 0x8fdcff : 0xffd23a) : 0x2a3340, 1).fillPoints(points, true);
        g.lineStyle(RANK_DIAMONDS.line, filled ? 0x5a3a08 : 0x8a96a6, 1).strokePoints(points, true);
      }
      this.layer.add(g);
    }

    if (talent.needsSystem) {
      this.layer.add(text(this, rect.x + rect.w - 12, rect.y + rect.h - 9, 'brzy', { // uvnitř rámečku dlaždice
        size: 11, color: '#9fb3c4', originX: 1, originY: 1, strokeThickness: 2
      }));
    }

    // Modrý rámeček pod myší.
    const hover = this.addFrame(TALENT_CARD.frameHover, rect).setVisible(false);

    const zone = this.add.zone(rect.x, rect.y, rect.w, rect.h).setOrigin(0).setInteractive({ useHandCursor: check.ok });
    zone.on('pointerover', () => {
      hover.setVisible(true);
      this.showTalentTip(talent, rect, check, rank, tierIndex, tierUnlocked);
    });
    zone.on('pointerout', () => { hover.setVisible(false); this.tooltip.hide(); });
    zone.on('pointerdown', () => this.tryInvest(talent));
    this.layer.add(zone);
  }

  // Bonusy celého stromu: pasivní bonus (jen hlavní specializace), talenty s body, závěrečný talent.
  showTreeTip(tree, rect) {
    const progress = this.state.talentProgress;
    const isMain = progress.specialization === tree.id;
    const invested = getTreeInvestment(this.state, tree.id);
    const lines = [`${tree.title ?? ''}${tree.title ? ' · ' : ''}${invested} bodů ve stromu`];
    lines.push(`Pasivní bonus${isMain ? '' : ' (jen jako hlavní specializace)'}: ${tree.passive}`);
    const owned = tree.tiers.flatMap((tier) => tier.talents).filter((talent) => getTalentRank(this.state, talent.id) > 0);
    lines.push('');
    if (owned.length) {
      lines.push('Aktivní talenty:');
      for (const talent of owned) lines.push(`• ${talent.name} – hodnost ${getTalentRank(this.state, talent.id)}/${TALENT_MAX_RANK}`);
    } else {
      lines.push('Zatím žádné talenty s body.');
    }
    const done = isTreeComplete(this.state, tree.id);
    lines.push('', `${tree.final.name}${done ? ' (získáno)' : ` (po ${TREE_POINT_LIMIT} bodech)`}: ${tree.final.text}`);
    const top = toScreen(rect.x + rect.w / 2, rect.y);
    const bottom = toScreen(rect.x, rect.y + rect.h);
    this.tooltip.show(top.x, top.y, bottom.y, tree.name, lines);
  }

  showTalentTip(talent, rect, check, rank, tierIndex, tierUnlocked) {
    const lines = [talent.text, `Hodnost ${rank} / ${TALENT_MAX_RANK} · 1 bod za hodnost`];
    if (!tierUnlocked && TIER_REQUIREMENTS[tierIndex]) {
      lines.push(`${TIER_NAMES[tierIndex]}: otevře se od ${TIER_REQUIREMENTS[tierIndex]} bodů ve stromu.`);
    }
    if (talent.choosesSchool && this.state.talentProgress.focusSchool) {
      lines.push(`Vybraná škola: ${elementName(this.state.talentProgress.focusSchool)}`);
    }
    if (talent.needsSystem) lines.push(`Účinek začne platit se systémem: ${talent.needsSystem}.`);
    lines.push(check.ok ? 'Klikni pro přidání hodnosti.' : check.reason);
    const top = toScreen(rect.x + rect.w / 2, rect.y);
    const bottom = toScreen(rect.x, rect.y + rect.h);
    this.tooltip.show(top.x, top.y, bottom.y, talentDisplayName(talent, this.state.talentProgress), lines);
  }

  // --------------------------------------------------------------- akce

  tryInvest(talent) {
    if (this.modal) return;
    const check = canInvestTalent(this.state, talent.id);
    if (!check.ok) {
      this.flash(check.reason);
      return;
    }

    if (talent.choosesSchool && !this.state.talentProgress.focusSchool) {
      this.chooseSchool(talent);
      return;
    }

    const result = investTalent(this.state, talent.id, {}, this.game.events);
    if (!result.ok) {
      this.flash(result.reason);
      return;
    }
    SaveSystem.save(this.state);
    this.render();
    if (result.finalTalent) this.flash(`Strom dokončen! Získáváš ${result.finalTalent.name}.`, '#ffd76a');
  }

  confirmSpecialization(tree) {
    this.openModal(
      `Zvolit specializaci ${tree.name}?`,
      [
        `Pasivní bonus: ${tree.passive}`,
        'Ostatní stromy se otevřou až po dokončení tohoto stromu (30 bodů).',
        'Volbu zatím nejde vrátit (respec ještě není navržený).'
      ],
      [
        { label: 'Zvolit', onClick: () => {
          const result = chooseSpecialization(this.state, tree.id, this.game.events);
          this.closeModal();
          if (!result.ok) { this.flash(result.reason); return; }
          SaveSystem.save(this.state);
          this.render();
        } },
        { label: 'Zpět', onClick: () => this.closeModal() }
      ]
    );
  }

  chooseSchool(talent) {
    const buttons = MAGIC_SCHOOLS.map((school) => ({
      label: elementName(school) + (isMagicSchoolUnlocked(this.state, school) ? '' : ' (zamčená)'),
      onClick: () => {
        const result = investTalent(this.state, talent.id, { school }, this.game.events);
        this.closeModal();
        if (!result.ok) { this.flash(result.reason); return; }
        SaveSystem.save(this.state);
        // Nový název talentu je v podkladu karty – karta se otevře znovu s ním.
        this.scene.restart({ state: this.state, returnScene: this.returnScene, storageAccess: this.storageAccess });
      }
    }));
    buttons.push({ label: 'Zpět', onClick: () => this.closeModal() });
    this.openModal('Elementární soustředění', ['Vyber školu magie, jejíž kouzla budou silnější. Volba je trvalá.'], buttons);
  }

  // ------------------------------------------------------------ prvky UI

  addButton(x, y, w, h, label, onClick, container = this.layer, size = 20) {
    const g = this.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(hover ? 0x3b2c0c : 0x1b2f4c, 1).fillRoundedRect(x, y, w, h, 10);
      g.lineStyle(2, hover ? 0xffd76a : GOLD, 1).strokeRoundedRect(x, y, w, h, 10);
    };
    draw(false);
    const label_ = text(this, x + w / 2, y + h / 2, label, { size, bold: true, originX: 0.5, originY: 0.5 });
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', onClick);
    container.add([g, label_, zone]);
  }

  openModal(title, lines, buttons) {
    this.closeModal();
    this.tooltip.hide();
    const w = 760;
    const rows = Math.ceil(buttons.length / 3);
    // Řádky mohou být víceřádkové – výšku zjistíme z vykresleného textu.
    const bodyTexts = lines.map((line) => text(this, 0, 0, line, { size: 18, color: '#dbe6f3', wrap: w - 80 }));
    const bodyHeight = bodyTexts.reduce((sum, t) => sum + t.height + 10, 0);
    const h = 120 + bodyHeight + rows * 64 + 30;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    const c = this.add.container(0, 0).setDepth(200);
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    g.fillStyle(0x0d1d33, 0.98).fillRoundedRect(x, y, w, h, 18);
    g.lineStyle(4, GOLD, 1).strokeRoundedRect(x, y, w, h, 18);
    c.add([shade, g, text(this, x + w / 2, y + 26, title, { size: 30, bold: true, color: '#ffe7ae', originX: 0.5 })]);
    let lineY = y + 84;
    for (const t of bodyTexts) {
      t.setPosition(x + 40, lineY);
      c.add(t);
      lineY += t.height + 10;
    }
    const bw = 220;
    buttons.forEach((button, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const inRow = Math.min(3, buttons.length - row * 3);
      const startX = x + (w - (inRow * bw + (inRow - 1) * 16)) / 2;
      this.addButton(startX + col * (bw + 16), y + h - 40 - rows * 64 + row * 64, bw, 50, button.label, button.onClick, c);
    });
    this.modal = c;
  }

  closeModal() {
    this.modal?.destroy();
    this.modal = null;
  }

  // Popisek talentu v souřadnicích obrazovky (nad políčkem, u horního okraje pod ním).
  createTooltip() {
    const container = this.add.container(0, 0).setDepth(150).setVisible(false);
    const bg = this.add.graphics();
    const title = text(this, 16, 12, '', { size: 21, bold: true, color: '#ffd76a' });
    const body = text(this, 16, 46, '', { size: 17, color: '#e8eef5', wrap: 460 });
    container.add([bg, title, body]);
    return {
      show: (x, top, bottom, heading, lines) => {
        title.setText(heading);
        body.setText(lines.join('\n'));
        const w = Math.max(title.width, body.width) + 32;
        const h = body.height + 62;
        bg.clear().fillStyle(0x07111f, 0.97).fillRoundedRect(0, 0, w, h, 10).lineStyle(2, GOLD, 1).strokeRoundedRect(1, 1, w - 2, h - 2, 10);
        const px = Phaser.Math.Clamp(x - w / 2, 20, GAME_WIDTH - w - 20);
        const py = top - h - 10 < 100 ? bottom + 10 : top - h - 10;
        container.setPosition(px, py).setVisible(true);
      },
      hide: () => container.setVisible(false)
    };
  }

  // Hláška vlevo dole na kartě (nad krajinou, vedle tlačítka Zavřít).
  flash(message, color = '#ffb3a0') {
    this.flashText?.destroy();
    const at = toScreen(60, 912);
    this.flashText = text(this, at.x, at.y, message, { size: 22, bold: true, color, strokeThickness: 5, wrap: 560 }).setDepth(160);
    this.tweens.add({ targets: this.flashText, alpha: 0, delay: 2600, duration: 500 });
  }

  // Zavřít: obrázky stavů přes namalované tlačítko (stejně jako na kartě hrdiny).
  createCloseButton() {
    const cx = CLOSE_AREA.x + CLOSE_AREA.w / 2;
    const cy = CLOSE_AREA.y + CLOSE_AREA.h / 2;
    const zone = this.add.zone(CLOSE_AREA.x, CLOSE_AREA.y, CLOSE_AREA.w, CLOSE_AREA.h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.closeCard());
    if (this.textures.exists(closeStateKey('normal'))) {
      const image = this.add.image(cx, cy, closeStateKey('normal'));
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
