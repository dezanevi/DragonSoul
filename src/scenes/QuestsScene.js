import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import {
  QUEST_STATUS, QUEST_STATUS_LABEL, getQuestStatus, questStep, trackQuest, trackedQuest, journalQuests, boardQuests
} from '../systems/QuestSystem.js';
import { CARD_PANEL, cardText, cardButton, drawCardFrame, cardCloseButton, cardFlash, uiTitle, uiSection, uiSelectedRow, nineImage } from '../ui/fantasyCard.js';
import { createCardTabBar, slideCardIn, slideCardOut } from '../ui/cardTabBar.js';

// Karta Úkoly (záložka Úkoly) a Nástěnka úkolů ve městě (data.board = oblast).
// Rozklikávací seznam: řádek úkolu (název, stav) – klik ho rozbalí (popis, co dělat, zadavatel,
// odměna, tlačítko Sledovat). Sledovaný úkol vede hrdinu tečkami ve světě (WorldScene).

const P = CARD_PANEL;
const LIST = { x: P.x + 60, y: P.y + 110, w: P.w - 120 };
const ROW_H = 64;
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
    // Rozbalený je na začátku sledovaný úkol (nebo první v seznamu).
    this.expanded = new Set([trackedQuest(this.state) ?? this.quests()[0]?.id].filter(Boolean));

    drawCardFrame(this);
    uiTitle(this, P.x + 46, P.y + 22, this.board ? `Nástěnka úkolů – ${this.board}` : 'Úkoly', { icon: 'scroll_quest', size: 34 });
    this.hint = cardText(this, P.x + P.w - 46, P.y + 34, '', { size: 19, color: '#cfe2f5', originX: 1 });
    uiSection(this, LIST.x - 20, LIST.y - 16, LIST.w + 40, P.y + P.h - 70 - (LIST.y - 16));
    this.layer = this.add.container(0, 0);

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

  quests() {
    return this.board ? boardQuests(this.state, this.board) : journalQuests(this.state);
  }

  render() {
    this.layer.removeAll(true);
    const quests = this.quests();
    const tracked = trackedQuest(this.state);
    this.hint.setText(tracked ? 'Sledovaný úkol vede hrdinu zlatými tečkami ve světě.' : 'Klikni na úkol pro podrobnosti, Sledovat ukáže cestu.');

    if (!quests.length) {
      this.layer.add(cardText(this, P.x + P.w / 2, LIST.y + 60, this.board
        ? 'Na nástěnce teď nevisí žádný nedokončený úkol.'
        : 'Zatím nemáš žádný úkol. Zajdi za starostou Edricem na radnici Greenvale nebo se podívej na nástěnku.',
      { size: 22, color: '#9fb3c8', originX: 0.5, wrap: LIST.w - 80, align: 'center' }));
      return;
    }

    let y = LIST.y;
    for (const quest of quests) {
      const status = getQuestStatus(this.state, quest.id);
      const open = this.expanded.has(quest.id);
      const isTracked = tracked === quest.id;

      // Řádek úkolu (klik = rozbalit / sbalit).
      const row = open ? uiSelectedRow(this, LIST.x, y, LIST.w, ROW_H) : nineImage(this, 'nu-btn', LIST.x, y, LIST.w, ROW_H, 0.4);
      if (row) this.layer.add(row);
      this.layer.add(cardText(this, LIST.x + 24, y + ROW_H / 2, `${open ? '▼' : '▶'}  ${quest.title}`, { size: 24, bold: true, color: '#ffe7ae', originY: 0.5, strokeThickness: 4 }));
      this.layer.add(cardText(this, LIST.x + LIST.w - 24, y + ROW_H / 2, `${isTracked ? 'Sledováno · ' : ''}${QUEST_STATUS_LABEL[status]}`, {
        size: 20, bold: true, color: isTracked ? '#ffd76a' : STATUS_COLOR[status], originX: 1, originY: 0.5, strokeThickness: 4
      }));
      const zone = this.add.zone(LIST.x, y, LIST.w, ROW_H).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (this.expanded.has(quest.id)) this.expanded.delete(quest.id);
        else this.expanded.add(quest.id);
        this.render();
      });
      this.layer.add(zone);
      y += ROW_H + 8;

      if (!open) continue;
      // Podrobnosti.
      const x = LIST.x + 40;
      const w = LIST.w - 330;
      const top = y;
      const add = (text, options = {}) => {
        const t = cardText(this, x, y, text, { size: 20, color: '#dbe6f3', wrap: w, ...options });
        this.layer.add(t);
        y += t.height + 8;
      };
      add(quest.description, { size: 20, color: '#f3e4bd' });
      add(`Co dělat: ${questStep(this.state, quest.id)}`, { size: 20, color: STATUS_COLOR[status] === '#9aa4ae' ? '#c9d3dd' : '#8fd3ff' });
      add(`Zadavatel: ${quest.giver} · Oblast: ${quest.region}`, { size: 18, color: '#9fb3c8' });
      if (status !== QUEST_STATUS.done) add(`Odměna: ${quest.reward}`, { size: 18, color: '#c9b98f' });

      if (status !== QUEST_STATUS.done) {
        const button = cardButton(this, null, LIST.x + LIST.w - 260, top + 4, 240, 58, isTracked ? 'Nesledovat' : 'Sledovat', () => {
          trackQuest(this.state, quest.id);
          SaveSystem.save(this.state);
          cardFlash(this, trackedQuest(this.state) === quest.id
            ? `Sleduješ úkol ${quest.title} – tečky ve světě ukážou cestu.`
            : `Úkol ${quest.title} už nesleduješ.`, '#ffd76a');
          this.render();
        }, { size: 21, active: isTracked });
        this.layer.add(button.objects);
      }
      y = Math.max(y, top + 70) + 16;
    }
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
