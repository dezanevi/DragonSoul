import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import {
  QUEST_STATUS, QUEST_STATUS_LABEL, getQuestStatus, questStep, trackQuest, trackedQuest, journalQuests, boardQuests
} from '../systems/QuestSystem.js';
import { CARD_PANEL, cardText, cardButton, drawCardFrame, cardCloseButton, uiTitle, uiSection, uiSelectedRow, nineImage } from '../ui/fantasyCard.js';
import { createCardTabBar, slideCardIn, slideCardOut } from '../ui/cardTabBar.js';
import { TILE_SIZE } from '../data/tiles.js';
import { showGuide } from '../ui/guideSpotlight.js';

// Karta Úkoly (záložka Úkoly) a Nástěnka úkolů ve městě (data.board = oblast).
// Rozklikávací seznam: řádek úkolu (název, stav) – klik ho rozbalí (popis, co dělat, zadavatel,
// odměna, tlačítko Sledovat). Sledovaný úkol vede hrdinu tečkami ve světě (WorldScene).

const P = CARD_PANEL;
const LIST = { x: P.x + 60, y: P.y + 110, w: P.w - 120 };
const ROW_H = 64;
// Okno seznamu (posuvné): od horního okraje tabulky po spodní rám karty.
const VIEW = { x: LIST.x - 24, y: LIST.y - 20, w: LIST.w + 48, h: P.y + P.h - 70 - (LIST.y - 20) };
const STATUS_COLOR = { notStarted: '#c9b98f', active: '#8fd3ff', ready: '#7fd67a', done: '#9aa4ae' };

export default class QuestsScene extends Phaser.Scene {
  constructor() {
    super('Quests');
  }

  create(data) {
    this.state = data?.state ?? SaveSystem.load();
    this.returnScene = data?.returnScene ?? 'World';
    this.storageAccess = Boolean(data?.storageAccess);
    this.board = data?.board ?? null; // oblast nástěnky, jinak deník úkolů
    this.closing = false;
    if (!this.state) {
      this.scene.start('Menu');
      return;
    }
    // Rozbalený je na začátku sledovaný úkol (nebo první nedokončený) – hotové nikdy.
    const firstOpen = this.quests().find((q) => getQuestStatus(this.state, q.id) !== QUEST_STATUS.done)?.id;
    this.expanded = new Set([trackedQuest(this.state) ?? firstOpen].filter(Boolean));
    this.scroll = 0;

    drawCardFrame(this);
    uiTitle(this, P.x + 150, P.y + 38, this.board ? `Nástěnka úkolů – ${this.board}` : 'Úkoly', { icon: 'scroll_quest', size: 34 });
    // „Co dál?“ – šedé tlačítko v rámečku vpravo nahoře: navede na nejbližší úkol.
    if (!this.board) this.nextButton(P.x + P.w - 150 - 200, P.y + 30);
    // Navádění po Prvním lovu (WorldScene.updateGuides): světlé okno na Co dál?.
    if (!this.board && this.registry.get('guideWhatNext')) {
      this.guide = showGuide(this, { rect: { x: P.x + P.w - 150 - 200, y: P.y + 30, w: 200, h: 58 }, depth: 5000,
        text: 'Klikni na Co dál? – vybere nejbližší úkol, začne ho sledovat a ukáže k němu cestu.' });
    }
    this.hint = cardText(this, P.x + P.w - (this.board ? 150 : 372), P.y + 44, '', { size: 19, color: '#cfe2f5', originX: 1 });
    // Seznam se posouvá kolečkem myši; co je mimo okno seznamu, ořízne maska.
    this.layer = this.add.container(0, 0);
    const maskShape = this.make.graphics({ add: false }).fillStyle(0xffffff).fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    this.layer.setMask(maskShape.createGeometryMask());
    this.scrollBar = this.add.graphics();
    this.input.on('wheel', (pointer, objects, dx, dy) => {
      const max = Math.max(0, this.contentH - VIEW.h);
      const next = Phaser.Math.Clamp(this.scroll + Math.sign(dy) * 80, 0, max);
      if (next !== this.scroll) { this.scroll = next; this.render(); }
    });

    cardCloseButton(this, () => this.closeCard());
    this.tabBar = createCardTabBar(this, this.board ? null : 'quests', {
      onClose: () => this.closeCard(),
      state: this.state,
      returnScene: this.returnScene,
      storageAccess: this.storageAccess,
      beforeLeave: () => SaveSystem.save(this.state)
    });
    if (data?.animateIn) slideCardIn(this, { hide: this.tabBar.objects });

    this.onKey = (event) => {
      if (!event.repeat && event.code === 'Escape') this.closeCard();
    };
    this.input.keyboard.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));
    this.render();
  }

  // Dokončené úkoly až na konci seznamu (jinak pořadí zůstává).
  quests() {
    const list = this.board ? boardQuests(this.state, this.board) : journalQuests(this.state);
    const done = (q) => Number(getQuestStatus(this.state, q.id) === QUEST_STATUS.done);
    return list.map((q, i) => [q, i]).sort((a, b) => done(a[0]) - done(b[0]) || a[1] - b[1]).map(([q]) => q);
  }

  render() {
    this.layer.removeAll(true);
    const quests = this.quests();
    const tracked = trackedQuest(this.state);
    // Krátká hláška (Co dál?, Sledovat) zůstane v záhlaví chvíli i přes překreslení.
    if (this.time.now >= (this.noticeUntil ?? 0)) {
      this.hint.setText(tracked ? 'Sledovaný úkol vede hrdinu modrými tečkami ve světě.' : 'Klikni na úkol pro podrobnosti, Sledovat ukáže cestu.').setColor('#cfe2f5').setScale(1);
    }

    if (!quests.length) {
      this.contentH = 0;
      this.scrollBar.clear();
      this.layer.add(cardText(this, P.x + P.w / 2, LIST.y + 60, this.board
        ? 'Na nástěnce teď nevisí žádný nedokončený úkol.'
        : 'Zatím nemáš žádný úkol. Zajdi za starostou Edricem na radnici Greenvale nebo se podívej na nástěnku.',
      { size: 22, color: '#9fb3c8', originX: 0.5, wrap: LIST.w - 80, align: 'center' }));
      return;
    }

    const isDone = (q) => getQuestStatus(this.state, q.id) === QUEST_STATUS.done;
    const active = quests.filter((q) => !isDone(q));
    const done = quests.filter(isDone);
    // Interaktivní jen to, co je celé v okně seznamu (zóny mimo okno by chytaly kliky).
    const inView = (y, h) => y >= VIEW.y && y + h <= VIEW.y + VIEW.h;

    let y = LIST.y - this.scroll;
    // Tabulka probíhajících úkolů (podklad roste s obsahem; nakreslí se až po změření).
    const tableTop = y - 16;
    const tableIndex = this.layer.list.length;
    if (!active.length) {
      this.layer.add(cardText(this, P.x + P.w / 2, y + 14, 'Všechny úkoly jsou hotové.', { size: 20, color: '#9fb3c8', originX: 0.5 }));
      y += 56;
    }
    for (const quest of active) y = this.renderQuest(quest, y, tracked, inView);
    const tableBg = uiSection(this, LIST.x - 20, tableTop, LIST.w + 40, Math.max(40, y - tableTop + 8));
    this.layer.addAt(tableBg, tableIndex);

    if (done.length) {
      // Hotové úkoly mimo tabulku, oddělené tlustou zlatou čarou.
      y += 22;
      const line = this.add.graphics();
      line.fillStyle(0xd6a23a, 0.9).fillRect(LIST.x - 20, y, LIST.w + 40, 5);
      this.layer.add(line);
      y += 20;
      this.layer.add(cardText(this, LIST.x, y, `Dokončené úkoly (${done.length})`, { size: 22, bold: true, color: '#9aa4ae' }));
      y += 40;
      for (const quest of done) y = this.renderQuest(quest, y, tracked, inView);
    }

    this.contentH = y + this.scroll - LIST.y + 20;
    const max = Math.max(0, this.contentH - VIEW.h);
    if (this.scroll > max) { this.scroll = max; this.render(); return; }
    // Posuvník vpravo (jen když se seznam nevejde).
    this.scrollBar.clear();
    if (max > 0) {
      const trackH = VIEW.h - 20;
      const barH = Math.max(60, trackH * (VIEW.h / this.contentH));
      const barY = VIEW.y + 10 + (trackH - barH) * (this.scroll / max);
      this.scrollBar.fillStyle(0x05080c, 0.6).fillRoundedRect(VIEW.x + VIEW.w + 6, VIEW.y + 10, 10, trackH, 5);
      this.scrollBar.fillStyle(0xd6a23a, 0.9).fillRoundedRect(VIEW.x + VIEW.w + 6, barY, 10, barH, 5);
    }
  }

  // Jeden úkol (řádek, po rozkliknutí podrobnosti). Vrací y pod ním.
  renderQuest(quest, y, tracked, inView) {
    const status = getQuestStatus(this.state, quest.id);
    const open = this.expanded.has(quest.id);
    const isTracked = tracked === quest.id;
    const isDone = status === QUEST_STATUS.done;
    const row = open ? uiSelectedRow(this, LIST.x, y, LIST.w, ROW_H) : nineImage(this, isDone ? 'nu-btnDisabled' : 'nu-btn', LIST.x, y, LIST.w, ROW_H, 0.4);
    if (row) this.layer.add(row.setAlpha(isDone && !open ? 0.75 : 1));
    this.layer.add(cardText(this, LIST.x + 24, y + ROW_H / 2, `${open ? '▼' : '▶'}  ${quest.title}`, { size: 24, bold: true, color: isDone ? '#8f969e' : '#ffe7ae', originY: 0.5, strokeThickness: 4 }));
    this.layer.add(cardText(this, LIST.x + LIST.w - 24, y + ROW_H / 2, `${isTracked ? 'Sledováno · ' : ''}${QUEST_STATUS_LABEL[status]}`, {
      size: 20, bold: true, color: isTracked ? '#ffd76a' : STATUS_COLOR[status], originX: 1, originY: 0.5, strokeThickness: 4
    }));
    if (inView(y, ROW_H)) {
      const zone = this.add.zone(LIST.x, y, LIST.w, ROW_H).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (this.expanded.has(quest.id)) this.expanded.delete(quest.id);
        else this.expanded.add(quest.id);
        this.render();
      });
      this.layer.add(zone);
    }
    y += ROW_H + 8;
    if (!open) return y;

    const x = LIST.x + 40;
    const w = LIST.w - 330;
    const top = y;
    const add = (text, options = {}) => {
      const t = cardText(this, x, y, text, { size: 20, color: '#dbe6f3', wrap: w, ...options });
      this.layer.add(t);
      y += t.height + 8;
    };
    add(quest.description, { size: 20, color: '#f3e4bd' });
    add(`Co dělat: ${questStep(this.state, quest.id)}`, { size: 20, color: isDone ? '#c9d3dd' : '#8fd3ff' });
    add(`Zadavatel: ${quest.giver} · Oblast: ${quest.region}`, { size: 18, color: '#9fb3c8' });
    if (!isDone) add(`Odměna: ${quest.reward}`, { size: 18, color: '#c9b98f' });

    if (!isDone && inView(top + 4, 58)) {
      const button = cardButton(this, null, LIST.x + LIST.w - 260, top + 4, 240, 58, isTracked ? 'Nesledovat' : 'Sledovat', () => {
        trackQuest(this.state, quest.id);
        SaveSystem.save(this.state);
        this.notice(trackedQuest(this.state) === quest.id
          ? `Sleduješ úkol ${quest.title} – tečky ve světě ukážou cestu.`
          : `Úkol ${quest.title} už nesleduješ.`, '#ffd76a');
        this.render();
      }, { size: 21, active: isTracked });
      this.layer.add(button.objects);
    }
    return Math.max(y, top + 70) + 16;
  }

  // Šedé tlačítko „Co dál?“ (200 × 58, písmo 22) s rámečkem; pod myší zesvětlá.
  nextButton(x, y) {
    const w = 200;
    const h = 58;
    const g = this.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(hover ? 0x4a5058 : 0x30353b, 0.95).fillRoundedRect(x, y, w, h, 10);
      g.lineStyle(2.5, hover ? 0xd8dde2 : 0x9aa1a8, 1).strokeRoundedRect(x, y, w, h, 10);
      g.lineStyle(1, 0x9aa1a8, 0.35).strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, 7);
    };
    draw(false);
    const text = cardText(this, x + w / 2, y + h / 2, 'Co dál?', { size: 22, bold: true, color: '#d4d8dc', originX: 0.5, originY: 0.5 });
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => { draw(true); text.setColor('#ffffff'); });
    zone.on('pointerout', () => { draw(false); text.setColor('#d4d8dc'); });
    zone.on('pointerdown', () => this.whatNext());
  }

  // Nejbližší úkol v oblasti (probíhající → cíl, splněný → zadavatel, nepřijatý → zadavatel):
  // vzdálenost od hrdiny k cílovému poli (stejný výpočet jako tečky ve světě). Úkol se začne
  // sledovat a karta se zavře, aby tečky byly vidět.
  whatNext() {
    this.guide?.destroy();
    this.guide = null;
    this.registry.remove('guideWhatNext');
    const region = this.state.region || 'Greenvale';
    const candidates = boardQuests(this.state, region);
    if (!candidates.length) {
      this.notice('V této oblasti teď žádný úkol není.', '#c9d3dd');
      return;
    }
    const world = this.scene.get('World');
    const keep = this.state.trackedQuest;
    let best = null;
    if (world?.map && world.player && typeof world.questTrailTarget === 'function') {
      const px = world.player.x / TILE_SIZE;
      const py = world.player.y / TILE_SIZE;
      for (const quest of candidates) {
        this.state.trackedQuest = quest.id;
        world.meadowTarget = null;
        const cell = world.questTrailTarget();
        const d = cell ? (cell.x - px) ** 2 + (cell.y - py) ** 2 : Infinity;
        if (!best || d < best.d) best = { quest, d };
      }
      this.state.trackedQuest = keep;
      world.meadowTarget = null;
    }
    const quest = best?.quest ?? candidates[0];
    this.state.trackedQuest = quest.id;
    SaveSystem.save(this.state);
    this.expanded = new Set([quest.id]);
    // Hláška v záhlaví (dole by překryla dokončené úkoly); co dělat je v rozbaleném úkolu.
    this.notice(`Nejbližší úkol: ${quest.title} – modré tečky ve světě ukazují cestu.`, '#ffd76a');
    this.render();
    this.time.delayedCall(2400, () => this.closeCard()); // čas přečíst hlášku
  }

  // Hláška v záhlaví karty místo nápovědy (na 3 s). Dlouhá se zmenší, aby nevjela do nadpisu.
  notice(text, color = '#ffd76a') {
    this.noticeUntil = this.time.now + 3000;
    this.hint.setText(text).setColor(color).setScale(1);
    const max = P.w - 420;
    if (this.hint.width > max) this.hint.setScale(max / this.hint.width);
    this.time.delayedCall(3050, () => { if (this.sys.isActive() && this.time.now >= this.noticeUntil) this.render(); });
  }

  closeCard() {
    if (this.closing) return;
    this.closing = true;
    SaveSystem.save(this.state);
    slideCardOut(this, () => {
      this.scene.stop();
      this.scene.resume(this.returnScene);
    }, { hide: this.tabBar?.objects });
  }
}
