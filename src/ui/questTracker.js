import { cardText } from './fantasyCard.js';
import { roundBox } from './craftLook.js';
import { GAME_WIDTH } from '../config.js';
import { TAB_STRIP } from './cardTabBar.js';
import { QUESTS, trackedQuest, questStep, questProgress, getQuestStatus, QUEST_STATUS } from '../systems/QuestSystem.js';

// Sledovaný úkol v HUD (svět): vpravo nahoře pod lištou karet – název, co teď dělat a postup
// (ukazatel „2 / 3“). Klik otevře kartu Úkoly. Bez sledovaného úkolu se schová.
// Překresluje se jen při změně (refresh se volá s HUD party).

const W = 430;
const X = GAME_WIDTH - W - 20;
const Y = TAB_STRIP.y + TAB_STRIP.h + 14;

export function createQuestTracker(scene, state, { depth = 1000, onClick = null } = {}) {
  const container = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  let last = null;
  let hidden = false;

  const draw = (questId) => {
    container.removeAll(true);
    const quest = QUESTS[questId];
    const ready = getQuestStatus(state, questId) === QUEST_STATUS.ready;
    const progress = questProgress(state, questId);
    const title = cardText(scene, X + 16, Y + 34, quest.title, { size: 21, bold: true, color: '#ffe7ae', wrap: W - 32 });
    // Počet („: 2/3.“, „: mistrovství 12/40 XP do 2. úrovně.“) ukazuje ukazatel – z textu kroku pryč.
    const stepText = progress ? questStep(state, questId).replace(/:\s*[^:]*?\d+\s*\/\s*\d+.*$/, '.') : questStep(state, questId);
    const step = cardText(scene, X + 16, Y + 40 + title.height, stepText, { size: 17, color: ready ? '#7fd67a' : '#cfe2f5', wrap: W - 32, lineSpacing: 2 });
    let h = 50 + title.height + step.height;
    const barY = Y + h;
    if (progress) h += 34;
    h += 12;

    const g = scene.add.graphics();
    roundBox(g, X, Y, W, h, 0x08111d, 0.72, 0x8a6a30, 0.9, 2, 12);
    container.add(g);
    container.add(cardText(scene, X + 16, Y + 16, 'Sledovaný úkol', { size: 15, bold: true, color: '#cdbb8a', originY: 0.5 }));
    container.add([title, step]);
    if (progress) {
      const bw = W - 32;
      const bar = scene.add.graphics();
      bar.fillStyle(0x05080c, 0.95).fillRoundedRect(X + 16, barY, bw, 24, 7);
      if (progress.ratio > 0) bar.fillStyle(ready ? 0x2f9b45 : 0xd99a22, 1).fillRoundedRect(X + 16, barY, Math.max(14, bw * Math.min(1, progress.ratio)), 24, 7);
      bar.lineStyle(1.5, 0x8a6a30, 0.9).strokeRoundedRect(X + 16, barY, bw, 24, 7);
      container.add(bar);
      container.add(cardText(scene, X + 16 + bw / 2, barY + 12, progress.text, { size: 16, bold: true, color: '#ffffff', originX: 0.5, originY: 0.5, strokeThickness: 4 }));
    }
    if (onClick) {
      const glow = scene.add.graphics().setVisible(false);
      roundBox(glow, X, Y, W, h, 0xffffff, 0.06, 0xffd76a, 1, 2.5, 12);
      const zone = scene.add.zone(X, Y, W, h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => glow.setVisible(true));
      zone.on('pointerout', () => glow.setVisible(false));
      zone.on('pointerdown', (pointer, lx, ly, event) => { event?.stopPropagation?.(); onClick(questId); });
      container.add([glow, zone]);
    }
  };

  const refresh = (force = false) => {
    const questId = trackedQuest(state);
    const quest = questId ? QUESTS[questId] : null;
    const status = quest ? getQuestStatus(state, questId) : null;
    if (!quest || status === QUEST_STATUS.done) {
      if (last !== '') { container.removeAll(true); last = ''; }
      container.setVisible(false);
      return;
    }
    container.setVisible(!hidden);
    const sig = `${questId}|${status}|${questStep(state, questId)}|${questProgress(state, questId)?.text ?? ''}`;
    if (!force && sig === last) return;
    last = sig;
    draw(questId);
  };

  refresh(true);
  return {
    container,
    refresh,
    setVisible: (v) => { hidden = !v; container.setVisible(v && last !== ''); }
  };
}
