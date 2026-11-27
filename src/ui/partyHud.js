import Phaser from 'phaser';
import { cardText } from './fantasyCard.js';
import { LOOK, roundBox, itemIcon } from './craftLook.js';
import { monsterHeadKey, monsterStillKey } from '../battle/monsterAnimations.js';
import { ELEMENT_COLORS } from '../battle/monsterModels.js';
import { normalizeElement } from '../systems/ElementSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { activeMeal } from '../systems/CookingSystem.js';
import { activeReinforcement } from '../systems/SmithingSystem.js';
import { COOKING_BY_ID, outputItemId, describeEffect } from '../data/cooking.js';
import { getItem } from '../data/items.js';
import { ALCHEMY_BY_ID, ALL_ALCHEMY, alchemyOutputId } from '../data/alchemy.js';
import { ALL_CRAFTING, craftingOutputId } from '../data/crafting.js';
import { SMITHING_BY_ID, smithingOutputId } from '../data/smithing.js';
import { experienceToNextLevel } from '../systems/MonsterSystem.js';

// Panel dole na herní obrazovce (svět) v průhledné tabulce:
//   hrdina (portrét, jméno, úroveň, mana, XP) | účinky (ikony buffů, jen když nějaký běží) | monstra party (miniatura, jméno, úroveň, HP, XP, stav).
// Překresluje se jen při změně údajů.

const SLOT = { w: 280, h: 118, gap: 12 };
const HERO_W = 320;
const PAD = 12;
const BOTTOM = 14;
const ICON = 40;

// Aktivní účinky (jídlo, elixír, ochrana, průzkumné lektvary, výztuha): { itemId, name, left }.
const RECIPE_BY_NAME = Object.fromEntries([
  ...ALL_ALCHEMY.map((r) => [r.name, alchemyOutputId(r)]),
  ...ALL_CRAFTING.map((r) => [r.name, craftingOutputId(r)])
]);
const battles = (n) => `${n} ${n === 1 ? 'souboj' : n < 5 ? 'souboje' : 'soubojů'}`;
const minutes = (until) => `${Math.max(1, Math.ceil((until - Date.now()) / 60000))} min`;
// Krátký štítek trvání na ikoně: „3b“ = 3 souboje, „3min“ = 3 minuty.
const shortBattles = (n) => `${n}b`;
const shortMinutes = (until) => `${Math.max(1, Math.ceil((until - Date.now()) / 60000))}min`;

export function activeBuffs(state) {
  const list = [];
  const meal = activeMeal(state);
  if (meal) {
    const recipe = COOKING_BY_ID[meal.recipe];
    const left = [
      meal.battlesLeft > 0 ? battles(meal.battlesLeft) : null,
      meal.travelUntil > Date.now() ? minutes(meal.travelUntil) : null
    ].filter(Boolean).join(' · ');
    const short = meal.battlesLeft > 0 ? shortBattles(meal.battlesLeft) : meal.travelUntil > Date.now() ? shortMinutes(meal.travelUntil) : '';
    list.push({ itemId: recipe ? outputItemId(recipe) : null, name: `${meal.name} (jídlo)`, left, short, effect: recipe?.effect ? describeEffect(recipe.effect) : null });
  }
  if (state.elixir?.battlesLeft > 0) {
    const recipe = ALCHEMY_BY_ID[state.elixir.recipe];
    list.push({ itemId: recipe ? alchemyOutputId(recipe) : null, name: `${state.elixir.name} (elixír)`, left: battles(state.elixir.battlesLeft), short: shortBattles(state.elixir.battlesLeft) });
  }
  if (state.potionGuard?.battlesLeft > 0) {
    const recipe = ALCHEMY_BY_ID[state.potionGuard.recipe];
    list.push({ itemId: recipe ? alchemyOutputId(recipe) : null, name: `${state.potionGuard.name} (ochrana)`, left: battles(state.potionGuard.battlesLeft), short: shortBattles(state.potionGuard.battlesLeft) });
  }
  const seen = new Set();
  for (const effect of Object.values(state.alchemyEffects ?? {})) {
    const timed = effect?.until > Date.now();
    if (!(timed || effect?.battlesLeft > 0) || seen.has(effect.name)) continue;
    seen.add(effect.name);
    list.push({ itemId: RECIPE_BY_NAME[effect.name] ?? null, name: effect.name, left: timed ? minutes(effect.until) : battles(effect.battlesLeft),
      short: timed ? shortMinutes(effect.until) : shortBattles(effect.battlesLeft) });
  }
  const r = activeReinforcement(state);
  if (r) {
    const recipe = SMITHING_BY_ID[r.recipe];
    list.push({ itemId: recipe ? smithingOutputId(recipe) : null, name: `${r.name} (výztuha)`, left: battles(r.battlesLeft), short: shortBattles(r.battlesLeft) });
  }
  // Popis účinku pro najetí myší: u jídla z receptu, jinak popis předmětu.
  for (const buff of list) buff.effect ??= (buff.itemId ? getItem(buff.itemId)?.description : null) ?? null;
  return list;
}

const talentPoints = (state) => Math.max(0, Number(state.talentProgress?.pointsAvailable) || 0);
const trainingPoints = (monster) => Math.max(0, Number(monster?.unspentTrainingPoints) || 0);

function signature(state) {
  const party = (state.party ?? []).map((m) => `${m.instanceId}:${m.name}:${m.level}:${m.currentHp}:${m.stats?.vitality}:${m.experience}:${trainingPoints(m)}`).join('|');
  const buffs = activeBuffs(state).map((b) => `${b.name}:${b.left}`).join('|');
  return `${state.playerName}:${state.level}:${state.exp}:${talentPoints(state)}:${state.mp}:${state.maxMp}:${state.gender}#${party}#${buffs}`;
}

// onHero() – klik na hrdinu, onTalents() – klik na volné body talentů,
// onMonster(monster) – klik na monstrum (karta Party s tímto monstrem).
export function createPartyHud(scene, state, { depth = 1000, onHero = null, onTalents = null, onMonster = null } = {}) {
  const container = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  let last = null;
  let location = ""; // „Greenvale – Lom Greenvale“ – horní řádek tabulky panelu (setLocation)
  let tableTop = 0; // horní okraj tabulky (popisky nad ní)
  let clock = ""; // „Den 1 · 05:00 · Úsvit“ – vpravo v horním řádku (setClock)
  let clockText = null;

  // Klikací rámeček: pod myší zlatý okraj a světlejší plocha.
  const clickable = (x, y, w, h, color, onClick) => {
    if (!onClick) return null;
    const glow = scene.add.graphics().setVisible(false);
    roundBox(glow, x, y, w, h, 0xffffff, 0.06, 0xffd76a, 1, 2.5, 12);
    const zone = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => glow.setVisible(true));
    zone.on('pointerout', () => glow.setVisible(false));
    zone.on('pointerdown', (pointer, lx, ly, event) => { event?.stopPropagation?.(); onClick(); });
    container.add([glow, zone]);
    return zone;
  };

  // Odkaz „volné body“: zlatý text, pod myší světlejší a podtržený, popis nad panelem.
  const pointsLink = (x, y, text, tip, onClick, parentZoneDepth) => {
    const t = cardText(scene, x, y, text, { size: 17, bold: true, color: '#ffd76a', originY: 0.5 });
    const line = scene.add.graphics().setVisible(false);
    line.lineStyle(2, 0xffe7ae, 1).lineBetween(x, y + t.height / 2, x + t.width, y + t.height / 2);
    const tipText = cardText(scene, x + t.width / 2, y - SLOT.h + 4, tip, { size: 17, bold: true, color: '#f3e4bd', originX: 0.5, originY: 1 }).setVisible(false);
    container.add([t, line, tipText]);
    if (!onClick) return;
    const zone = scene.add.zone(x - 4, y - t.height / 2 - 4, t.width + 8, t.height + 8).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => { t.setColor('#fff2c8'); line.setVisible(true); tipText.setVisible(true); });
    zone.on('pointerout', () => { t.setColor('#ffd76a'); line.setVisible(false); tipText.setVisible(false); });
    zone.on('pointerdown', (pointer, lx, ly, event) => { event?.stopPropagation?.(); onClick(); });
    container.add(zone);
  };

  const thumb = (monster, cx, cy, size) => {
    const key = monsterHeadKey(scene, monster.speciesId) ?? monsterStillKey(scene, monster.speciesId);
    if (key) {
      const image = scene.add.image(cx, cy, key);
      image.setScale(size / Math.max(image.width, image.height));
      return [image];
    }
    const g = scene.add.graphics();
    g.fillStyle(ELEMENT_COLORS[normalizeElement(monster.element)] ?? 0xc8c8c8, 1).fillCircle(cx, cy, size * 0.36);
    const letter = cardText(scene, cx, cy, String(monster.name ?? '?').charAt(0), { size: 24, bold: true, color: '#05080c', originX: 0.5, originY: 0.5, strokeThickness: 0 });
    return [g, letter];
  };

  const bar = (bx, by, bw, bh, ratio, color, label, size = 18) => {
    const g = scene.add.graphics();
    g.fillStyle(0x05080c, 0.95).fillRoundedRect(bx, by, bw, bh, 7);
    if (ratio > 0) g.fillStyle(color, 1).fillRoundedRect(bx, by, Math.max(12, bw * ratio), bh, 7);
    g.lineStyle(1.5, 0x8a6a30, 0.9).strokeRoundedRect(bx, by, bw, bh, 7);
    container.add(g);
    container.add(cardText(scene, bx + bw / 2, by + bh / 2, label, { size, bold: true, color: '#ffffff', originX: 0.5, originY: 0.5, strokeThickness: 4 }));
  };
  // Tenký zlatý ukazatel zkušeností pod hlavním barem.
  const xpBar = (bx, by, bw, exp, next) => bar(bx, by, bw, 18, next ? Math.min(1, exp / next) : 1, 0xd99a22, next ? `XP ${exp} / ${next}` : 'XP max.', 15);

  // Hrdina: portrét, jméno, úroveň a mana.
  const drawHero = (x, y) => {
    const g = scene.add.graphics();
    roundBox(g, x, y, HERO_W, SLOT.h, 0x0b1022, 0.6, 0xb48cff, 0.85, 2, 12);
    clickable(x, y, HERO_W, SLOT.h, 0xb48cff, onHero);
    roundBox(g, x + 10, y + 17, 84, 84, 0x05080c, 0.9, 0xb48cff, 0.7, 1.5, 10);
    container.add(g);
    const key = `lg-hero_portrait_${state.gender === 'female' ? 'female' : 'male'}`;
    if (scene.textures.exists(key)) {
      const image = scene.add.image(0, 0, key);
      const side = Math.min(image.width, image.height);
      const cropX = (image.width - side) / 2;
      image.setCrop(cropX, 0, side, side).setScale(78 / side);
      // Střed výřezu na střed políčka.
      image.setPosition(x + 52 - (cropX + side / 2 - image.width / 2) * image.scaleX, y + 59 - (side / 2 - image.height / 2) * image.scaleY);
      container.add(image);
    }
    const tx = x + 106;
    container.add(cardText(scene, tx, y + 20, state.playerName || 'Arion', { size: 20, bold: true, color: '#f3e4bd', originY: 0.5 }));
    container.add(cardText(scene, x + HERO_W - 12, y + 20, `úr. ${state.level ?? 1}`, { size: 18, color: '#cfe2f5', originX: 1, originY: 0.5 }));
    const max = Math.max(0, Math.round(Number(state.maxMp) || 0));
    const mp = Math.max(0, Math.min(max, Math.round(Number(state.mp) || 0)));
    bar(tx, y + 36, HERO_W - 118, 22, max ? mp / max : 0, 0x4a7fe0, `MP ${mp} / ${max}`);
    const level = Math.max(1, Number(state.level) || 1);
    xpBar(tx, y + 64, HERO_W - 118, Math.max(0, Math.round(Number(state.exp) || 0)), level * 20);
    const free = talentPoints(state);
    if (free > 0) pointsLink(tx, y + 100, `★ Volné body talentů: ${free}`, 'Otevřít Talenty', onTalents);
    else container.add(cardText(scene, tx, y + 100, 'Velitel', { size: 18, bold: true, color: '#9cc0ff', originY: 0.5 }));
  };

  // Účinky jídla, lektvarů a výztuhy: ikony 4 × 2, popis při najetí myší.
  const drawBuffs = (x, y, buffs, boxW) => {
    const g = scene.add.graphics();
    roundBox(g, x, y, boxW, SLOT.h, 0x08111d, 0.6, 0x8a6a30, 0.9, 2, 12);
    container.add(g);
    container.add(cardText(scene, x + 12, y + 16, 'Účinky', { size: 16, bold: true, color: '#cdbb8a', originY: 0.5 }));
    // Popisek při najetí myší: název a trvání, pod tím účinek (na tmavém štítku nad tabulkou).
    const tip = scene.add.container(0, 0).setVisible(false);
    const tipBg = scene.add.graphics();
    const tipTitle = cardText(scene, 0, 0, '', { size: 18, bold: true, color: '#f3e4bd' });
    const tipText = cardText(scene, 0, 0, '', { size: 17, color: '#cfe2f5', wrap: 460, lineSpacing: 3 });
    tip.add([tipBg, tipTitle, tipText]);
    const showTip = (buff, cx) => {
      tipTitle.setText(`${buff.name}${buff.left ? ` – ${buff.left}` : ''}`);
      tipText.setText(buff.effect ?? '').setVisible(Boolean(buff.effect));
      const w = Math.max(tipTitle.width, buff.effect ? tipText.width : 0) + 28;
      const h = tipTitle.height + (buff.effect ? tipText.height + 6 : 0) + 20;
      const left = Phaser.Math.Clamp(cx - w / 2, 10, GAME_WIDTH - w - 10);
      const top = tableTop - 8 - h;
      tipBg.clear();
      roundBox(tipBg, left, top, w, h, 0x05080c, 0.92, 0x8a6a30, 0.9, 1.5, 10);
      tipTitle.setPosition(left + 14, top + 10);
      tipText.setPosition(left + 14, top + 16 + tipTitle.height);
      tip.setVisible(true);
    };
    const twoRows = buffs.length > 4;
    buffs.slice(0, 8).forEach((buff, i) => {
      const cx = x + 12 + ICON / 2 + (i % 4) * (ICON + 8);
      const cy = (twoRows ? y + 34 : y + 46) + ICON / 2 + Math.floor(i / 4) * (ICON + 4);
      const frame = scene.add.graphics();
      roundBox(frame, cx - ICON / 2, cy - ICON / 2, ICON, ICON, 0x05080c, 0.9, 0x7fe08a, 0.8, 1.5, 7);
      container.add(frame);
      const icon = buff.itemId ? itemIcon(scene, buff.itemId, cx, cy, ICON - 8) : null;
      container.add(icon ?? cardText(scene, cx, cy, String(buff.name).charAt(0), { size: 20, bold: true, color: '#7fe08a', originX: 0.5, originY: 0.5 }));
      // Trvání přes roh ikony: „3b“ = souboje, „3min“ = čas.
      if (buff.short) container.add(cardText(scene, cx + ICON / 2 + 2, cy + ICON / 2 + 3, buff.short, { size: 16, bold: true, color: '#ffe7ae', originX: 1, originY: 1, strokeThickness: 4 }));
      const zone = scene.add.zone(cx, cy, ICON, ICON).setInteractive();
      zone.on('pointerover', () => showTip(buff, cx));
      zone.on('pointerout', () => tip.setVisible(false));
      container.add(zone);
    });
    container.add(tip);
  };

  const draw = () => {
    container.removeAll(true);
    const party = state.party ?? [];
    const buffs = activeBuffs(state);
    // Šířka účinků podle počtu ikon (nejvýš 4 v řadě).
    const buffBox = Math.max(110, Math.min(4, buffs.length) * (ICON + 8) + 16);
    const buffW = buffs.length ? buffBox + SLOT.gap : 0;
    const total = HERO_W + buffW + party.length * (SLOT.w + SLOT.gap);
    const left = (GAME_WIDTH - total) / 2;
    const y = GAME_HEIGHT - BOTTOM - PAD - SLOT.h;

    // Průhledná tabulka pod celým panelem; nahoře v ní řádek s lokací a hodinami (jedna společná tabulka).
    const locH = location || clock ? 36 : 0;
    const back = scene.add.graphics();
    roundBox(back, left - PAD, y - PAD - locH, total + PAD * 2, SLOT.h + PAD * 2 + locH, 0x05080c, 0.42, 0x8a6a30, 0.55, 1.5, 16);
    container.add(back);
    tableTop = y - PAD - locH;

    // Horní řádek tabulky: vlevo kde hrdina je, vpravo den, čas a denní doba.
    const rowY = y - (PAD + locH) / 2 + 2;
    if (location) container.add(cardText(scene, left + 6, rowY, location, { size: 20, bold: true, color: '#ffe7ae', originY: 0.5, strokeThickness: 4 }));
    clockText = clock ? cardText(scene, left + total - 6, rowY, clock, { size: 19, bold: true, color: '#cfe2f5', originX: 1, originY: 0.5, strokeThickness: 4 }) : null;
    if (clockText) container.add(clockText);

    // Hrdina, hned vedle účinky (jen když nějaký běží), pak monstra.
    drawHero(left, y);
    if (buffs.length) drawBuffs(left + HERO_W + SLOT.gap, y, buffs, buffBox);
    const x0 = left + HERO_W + SLOT.gap + buffW;

    party.forEach((monster, i) => {
      const x = x0 + i * (SLOT.w + SLOT.gap);
      const max = Math.max(1, Number(monster.stats?.vitality) || 1);
      const hp = Math.max(0, Math.min(max, Math.round(Number(monster.currentHp) || 0)));
      const fainted = hp <= 0;

      // Rámeček.
      const g = scene.add.graphics();
      roundBox(g, x, y, SLOT.w, SLOT.h, 0x08111d, 0.6, 0x8a6a30, 0.9, 2, 12);
      g.lineStyle(1, LOOK.gold, 0.22).strokeRoundedRect(x + 5, y + 5, SLOT.w - 10, SLOT.h - 10, 9);
      // Políčko miniatury.
      roundBox(g, x + 10, y + 17, 84, 84, 0x05080c, 0.9, LOOK.line, 0.9, 1.5, 10);
      container.add(g);
      clickable(x, y, SLOT.w, SLOT.h, 0xffd76a, onMonster ? () => onMonster(monster) : null);
      const pic = thumb(monster, x + 52, y + 59, 74);
      if (fainted) pic.forEach((o) => o.setAlpha?.(0.35));
      container.add(pic);

      // Jméno a úroveň.
      const tx = x + 106;
      const name = cardText(scene, tx, y + 20, monster.name ?? monster.speciesId, { size: 20, bold: true, color: fainted ? '#8f969e' : '#f3e4bd', originY: 0.5 });
      const level = cardText(scene, x + SLOT.w - 12, y + 20, `úr. ${monster.level ?? 1}`, { size: 18, color: '#cfe2f5', originX: 1, originY: 0.5 });
      const room = SLOT.w - 106 - level.width - 20;
      if (name.width > room) name.setScale(room / name.width);
      container.add([name, level]);

      // HP bar.
      const ratio = hp / max;
      bar(tx, y + 36, SLOT.w - 118, 22, ratio, ratio > 0.5 ? 0x4fbf5a : ratio > 0.25 ? 0xd9a93a : 0xc8463c, `${hp} / ${max}`);

      xpBar(tx, y + 64, SLOT.w - 118, Math.max(0, Math.round(Number(monster.experience) || 0)), experienceToNextLevel(monster));

      // Stav (počet útoků už není omezený).
      const points = trainingPoints(monster);
      if (points > 0) {
        // Volné tréninkové body (klik = Party s tímto monstrem).
        const info = cardText(scene, tx, y + 100, `★ Volné body: ${points}`, { size: 17, bold: true, color: '#ffd76a', originY: 0.5 });
        if (info.width > SLOT.w - 118) info.setScale((SLOT.w - 118) / info.width);
        container.add(info);
      } else {
        container.add(cardText(scene, tx, y + 100, fainted ? 'Vyčerpáno' : 'Připraveno', {
          size: 18, bold: true, color: fainted ? '#e0564a' : '#8ff0b0', originY: 0.5
        }));
      }
    });

  };

  const refresh = (force = false) => {
    const sig = signature(state);
    if (!force && sig === last) return;
    last = sig;
    draw();
  };
  refresh(true);
  const setLocation = (text) => {
    if ((text ?? '') === location) return;
    location = text ?? '';
    refresh(true);
  };
  // Hodiny: jen přepis textu (mění se každou herní minutu), celý panel se nepřekresluje.
  const setClock = (text) => {
    const had = Boolean(clock);
    clock = text ?? '';
    if (clockText && had && clock) clockText.setText(clock);
    else refresh(true);
  };
  // top() = horní okraj tabulky panelu (hlášky ve světě se ukazují nad ním).
  return { container, refresh, setLocation, setClock, top: () => tableTop, setVisible: (v) => container.setVisible(v) };
}
