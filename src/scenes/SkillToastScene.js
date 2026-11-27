import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SKILLS } from '../ui/heroCard/cardLayout.js';
import { skillStateKey } from '../ui/heroCard/heroButtonSprites.js';
import { onSkillXp } from '../systems/SkillXpEvents.js';
import { CARD_FONT } from '../ui/fantasyCard.js';
import { TAB_STRIP } from '../ui/cardTabBar.js';
// Počet odemčených receptů spočítá NewRecipeSystem (event.unlocked) – recepty zároveň označí
// zlatou hvězdičkou. Jeho posluchač se registruje při importu, tedy dřív než tahle scéna.
import '../systems/NewRecipeSystem.js';
const unlockedRecipes = (event) => event.unlocked ?? 0;
const itemsWord = (n) => (n === 1 ? 'předmět' : n >= 2 && n <= 4 ? 'předměty' : 'předmětů');

// Vyskakovací okno zisku XP v dovednosti: shora vyjede nahoru doprostřed (pod lištu karet) dlaždice dovednosti z karty
// Hrdiny (Dovednosti), ukazatel se posune o získané XP; při nové úrovni se naplní, zazáří
// a ukáže „Nová úroveň“. Více zisků za sebou čeká ve frontě (stejná dovednost se sloučí).
// Scéna běží pořád nad ostatními (nic neklikatelného, nepřekáží).

const TS = 1.35; // zvětšení dlaždice (karta Hrdiny: 185 × 73)
const TILE = { w: 185 * TS, h: 73 * TS };
const BAR = { x: 58 * TS, y: 44 * TS, w: 114 * TS, h: 18 * TS }; // jako SkillsPanel
// Nahoře uprostřed, hned pod lištou karet (lištu nezakryje); vyjede shora a zajede zpět nahoru.
// Texty (+XP, Nová úroveň, Odemkl jsi…) jsou pod dlaždicí.
const SHOW_Y = TAB_STRIP.y + TAB_STRIP.h + 14 + TILE.h / 2;
const OFF_Y = -(TILE.h / 2 + 200); // nad obrazovkou i s texty pod dlaždicí
const MAX_LEVEL = 100;

const ratioOf = (s) => (s.level >= MAX_LEVEL ? 1 : Math.max(0, Math.min(1, s.exp / Math.max(1, s.next))));

export default class SkillToastScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SkillToast', active: true });
  }

  create() {
    this.queue = [];
    this.current = null;
    this.off = onSkillXp((event) => this.push(event));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.off?.());
  }

  push(event) {
    // Stejná dovednost ještě ve frontě → sečíst (stav „před“ zůstává z prvního zisku).
    const waiting = this.queue.find((e) => e.prof === event.prof);
    if (waiting) {
      waiting.amount += event.amount;
      waiting.after = event.after;
      return;
    }
    this.queue.push({ ...event });
    if (!this.current) this.next();
  }

  next() {
    this.current = this.queue.shift() ?? null;
    if (this.current) this.show(this.current);
  }

  show(event) {
    const skill = SKILLS.find((s) => s.id === event.prof);
    this.scene.bringToTop();
    const box = this.add.container(GAME_WIDTH / 2, OFF_Y).setDepth(10);
    const left = -TILE.w / 2;
    const top = -TILE.h / 2;

    // Dlaždice dovednosti (stejný obrázek jako v kartě Hrdiny), záře při nové úrovni.
    const glow = this.add.graphics();
    glow.fillStyle(0xffd76a, 0.35).fillRoundedRect(left - 14, top - 14, TILE.w + 28, TILE.h + 28, 26).setAlpha(0);
    box.add(glow);
    const key = skillStateKey(event.prof, 'normal');
    if (this.textures.exists(key)) {
      box.add(this.add.image(0, 2 * TS, key).setDisplaySize(TILE.w * 1.05, TILE.h * 1.22));
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x0d1d33, 0.97).fillRoundedRect(left, top, TILE.w, TILE.h, 18).lineStyle(4, 0xd6a23a, 1).strokeRoundedRect(left, top, TILE.w, TILE.h, 18);
      box.add([g, this.add.text(left + 78, top + 20, skill?.label ?? event.prof, { fontFamily: CARD_FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffe7ae' })]);
    }

    // Ukazatel (stejně jako v kartě), s úrovní a procenty.
    const bx = left + BAR.x;
    const by = top + BAR.y;
    const frame = this.add.graphics();
    frame.fillStyle(0x05080c, 0.95).fillRoundedRect(bx - 3, by - 3, BAR.w + 6, BAR.h + 6, 10);
    frame.lineStyle(3, 0xd6a23a, 0.95).strokeRoundedRect(bx - 3, by - 3, BAR.w + 6, BAR.h + 6, 10);
    const fill = this.add.graphics();
    const levelText = this.add.text(bx + BAR.w / 2, by + BAR.h / 2, '', {
      fontFamily: CARD_FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);
    box.add([frame, fill, levelText]);

    // „+N XP“ nad dlaždicí, „Nová úroveň!“ při postupu.
    const gain = this.add.text(0, -top + 24, `+${event.amount} XP · ${skill?.label ?? event.prof}`, {
      fontFamily: CARD_FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffd76a', stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5);
    box.add(gain);

    const draw = (ratio, level) => {
      fill.clear();
      const w = Math.round(BAR.w * Math.max(0, Math.min(1, ratio)));
      if (w > 0) {
        fill.fillStyle(0x2f9b45, 0.95).fillRoundedRect(bx, by, w, BAR.h, Math.min(BAR.h / 2, 10));
        fill.fillStyle(0xa6f0a0, 0.55).fillRoundedRect(bx + 3, by + 3, Math.max(0, w - 6), Math.max(3, BAR.h * 0.35), 5);
      }
      levelText.setText(level >= MAX_LEVEL ? `Úr. ${level} · max.` : `Úr. ${level} · ${Math.floor(ratio * 100)} %`);
    };

    const { before, after } = event;
    const levelUps = Math.max(0, after.level - before.level);
    draw(ratioOf(before), before.level);

    // Průběh: vyjet shora → posun ukazatele (při nové úrovni naplnit, zazářit, od nuly) → chvíli
    // zůstat → zajet nahoru → další ve frontě.
    const steps = [];
    steps.push((done) => this.tweens.add({ targets: box, y: SHOW_Y, duration: 400, ease: 'Back.easeOut', onComplete: done }));
    const fillTo = (from, to, level, duration) => (done) => {
      const t = { r: from };
      this.tweens.add({ targets: t, r: to, duration, ease: 'Sine.easeOut', onUpdate: () => draw(t.r, level), onComplete: done });
    };
    if (levelUps > 0) {
      steps.push(fillTo(ratioOf(before), 1, before.level, 650));
      steps.push((done) => {
        draw(after.level >= MAX_LEVEL ? 1 : 0, after.level);
        levelText.setColor('#ffd76a');
        const up = this.add.text(0, -top + 60, levelUps > 1 ? `Nová úroveň! +${levelUps}` : 'Nová úroveň!', {
          fontFamily: CARD_FONT, fontSize: '26px', fontStyle: 'bold', color: '#ffe7ae', stroke: '#5a3a00', strokeThickness: 5
        }).setOrigin(0.5).setScale(0.4).setAlpha(0);
        box.add(up);
        // Nová úroveň odemkla recepty: informační hláška nad oknem.
        const unlocked = unlockedRecipes(event);
        if (unlocked > 0) {
          const info = this.add.text(0, -top + 100, `Odemkl jsi ${unlocked} ${itemsWord(unlocked)}`, {
            fontFamily: CARD_FONT, fontSize: '21px', fontStyle: 'bold', color: '#9fe3ff', stroke: '#06121f', strokeThickness: 5
          }).setOrigin(0.5).setAlpha(0);
          box.add(info);
          this.tweens.add({ targets: info, alpha: 1, y: -top + 96, duration: 360, delay: 200 });
        }
        this.tweens.add({ targets: glow, alpha: { from: 0, to: 1 }, duration: 260, yoyo: true, repeat: 1 });
        this.tweens.add({ targets: levelText, scale: { from: 1, to: 1.35 }, duration: 220, yoyo: true });
        this.tweens.add({ targets: up, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut', onComplete: done });
      });
      if (after.level < MAX_LEVEL) steps.push(fillTo(0, ratioOf(after), after.level, 600));
    } else {
      steps.push(fillTo(ratioOf(before), ratioOf(after), after.level, 800));
    }
    steps.push((done) => this.time.delayedCall(levelUps ? 1700 : 1200, done));
    steps.push((done) => this.tweens.add({ targets: box, y: OFF_Y, duration: 320, ease: 'Sine.easeIn', onComplete: done }));
    const run = (i) => {
      if (i >= steps.length) {
        box.destroy();
        this.next();
        return;
      }
      steps[i](() => run(i + 1));
    };
    run(0);
  }
}
