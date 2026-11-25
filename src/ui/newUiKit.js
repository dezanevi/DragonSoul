// ======================================================================
// Nové UI karet (sada public/assets/ui/newui/split + chybějící prvky ze starého UI
// v public/assets/ui/legacy). Při startu hry se z dílů sestaví:
//   • podklady karet 1536 × 1024 pod stávajícími klíči (Hrdina muž/žena, Talenty barevné
//     i šedé, Party, Inventář) – panely, nadpisy, popisky a ikony na stejných místech,
//     takže logika karet zůstává beze změny;
//   • stavy prvků pod stávajícími klíči: záložky, Zavřít, magické školy, dovednosti,
//     sloty výbavy, políčka inventáře, kategorie, šipky, tlačítka a políčka karty Party,
//     rámečky talentů.
// Rámečky se natahují přes 9-slice (rohy zůstávají, natahují se hrany a střed).
// Stavy: výchozí = modrá, pod myší = světle modrá, aktivní (zakliknuté) = zlatá,
// nedostupné = šedá, zavřít / nevratné akce = červená.
// ======================================================================

import { TABS, SKILLS, EQUIPMENT_SLOTS, MAGIC_SCHOOLS, CARD_TEXTURE } from './heroCard/cardLayout.js';
import { tabStateKey, closeStateKey } from './heroCard/tabSprites.js';
import { magicStateKey, skillStateKey, HERO_CARD_FEMALE } from './heroCard/heroButtonSprites.js';
import { INVENTORY_CARD, equipKey, slotKey, categoryKey, arrowKey } from './inventorySprites.js';
import { PARTY_CARD, PARTY_STATES, PARTY_SLOTS, STORAGE, DETAIL, STATS, SKILLS as PARTY_SKILLS, ACTIONS } from './partyCardLayout.js';
import { TALENT_CARD, TREE_PANELS, FINAL_BOXES, talentNodeRect } from './talentCardLayout.js';
import { TALENT_TREES, TIER_NAMES } from '../data/talents.js';
import { ITEM_CATEGORIES } from '../data/items.js';

const NEW = 'assets/ui/newui/split';
const LEGACY = 'assets/ui/legacy';
const W = 1536;
const H = 1024;
const FONT = 'Lora, Georgia, "Times New Roman", serif';

// Díly sady: klíč → [soubor, okraj 9-slice ve zdroji v px].
const PIECES = {
  btn: [`${NEW}/buttons/button_blue.png`, 44],
  btnHover: [`${NEW}/buttons/button_blue_hover.png`, 44],
  btnActive: [`${NEW}/buttons/button_gold_active.png`, 44],
  btnDisabled: [`${NEW}/buttons/button_grey_disable.png`, 44],
  btnRed: [`${NEW}/buttons/button_red.png`, 44],
  frame: [`${NEW}/icon_frame/icon_frame_blue.png`, 68],
  frameHover: [`${NEW}/icon_frame/icon_frame_blue_hover.png`, 68],
  frameActive: [`${NEW}/icon_frame/icon_frame_gold_active.png`, 68],
  frameDisabled: [`${NEW}/icon_frame/icon_frame_grey_disable.png`, 68],
  frameEmpty: [`${NEW}/icon_frame/icon_frame_empty.png`, 100],
  card: [`${NEW}/card_frame/card_frame_large.png`, 124],
  panel: [`${NEW}/card_frame/card_panel.png`, 36],
  slot: [`${NEW}/card_frame/card_slot.png`, 40],
  tooltip: [`${NEW}/card_frame/card_tooltip.png`, 0]
};

const ICONS = [
  'air', 'amulet', 'anvil', 'armor', 'bag', 'book', 'boots', 'brain', 'castle', 'chest', 'clover', 'coins', 'compass',
  'cooking_pot', 'crossed_swords', 'crown', 'crystal', 'dragon_gold', 'dragon_purple', 'fire', 'fishing_rod', 'flag', 'gear',
  'handshake', 'heart', 'helmet', 'herbs', 'hero_wheel', 'ingots', 'key', 'leaf', 'legs', 'magic_staff', 'magic_star', 'map',
  'map_pin', 'moon', 'party', 'paw', 'pickaxe', 'potion', 'ring', 'scroll', 'scroll_quest', 'shield_defense', 'shield_magic',
  'spellbook', 'star', 'sun', 'sword', 'target', 'vortex', 'water', 'winged_boot'
];

const LEGACY_PARTS = [
  'hero_portrait_male', 'hero_portrait_female', 'hero_figure_male', 'hero_figure_female', 'region_greenvale',
  'inventory_figure', 'arrow_left', 'arrow_right',
  ...['combat', 'crafting', 'wizard'].flatMap((tree) =>
    [1, 2, 3, 4, 5].flatMap((tier) => [0, 1].map((slot) => `talent_${tree}_${tier}_${slot}`)))
];

const pieceKey = (id) => `nu-${id}`;
const iconKey = (id) => `nu-icon-${id}`;
const legacyKey = (id) => `lg-${id}`;

export function loadNewUi(scene) {
  for (const [id, [path]] of Object.entries(PIECES)) scene.load.image(pieceKey(id), path);
  for (const id of ICONS) scene.load.image(iconKey(id), `${NEW}/icons_cards/icon_${id}.png`);
  for (const id of LEGACY_PARTS) scene.load.image(legacyKey(id), `${LEGACY}/${id}.png`);
}

// ---------------------------------------------------------------- kreslení

const img = (scene, key) => (scene.textures.exists(key) ? scene.textures.get(key).getSourceImage() : null);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  return { c, ctx };
}

// 9-slice: source okraj s (px zdroje), cílový okraj b (px).
function nine(scene, ctx, id, x, y, w, h, b) {
  const source = img(scene, pieceKey(id));
  if (!source) return;
  const s = PIECES[id][1];
  const sw = source.width;
  const sh = source.height;
  b = Math.min(b, w / 2, h / 2);
  const sx = [0, s, sw - s, sw];
  const sy = [0, s, sh - s, sh];
  const dx = [x, x + b, x + w - b, x + w];
  const dy = [y, y + b, y + h - b, y + h];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const swi = sx[i + 1] - sx[i];
      const shj = sy[j + 1] - sy[j];
      const dwi = dx[i + 1] - dx[i];
      const dhj = dy[j + 1] - dy[j];
      if (swi > 0 && shj > 0 && dwi > 0 && dhj > 0) ctx.drawImage(source, sx[i], sy[j], swi, shj, dx[i], dy[j], dwi, dhj);
    }
  }
}

// Obrázek vepsaný do čtverce / obdélníku (zachová poměr stran).
function fit(ctx, source, x, y, w, h, alpha = 1, filter = 'none') {
  if (!source) return;
  const scale = Math.min(w / source.width, h / source.height);
  const dw = source.width * scale;
  const dh = source.height * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.filter = filter;
  ctx.drawImage(source, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}
const icon = (scene, ctx, id, x, y, size, alpha = 1, filter = 'none') => fit(ctx, img(scene, iconKey(id)), x, y, size, size, alpha, filter);

// Text ve stylu hry: Lora, zlatá / krémová, tmavý obrys.
function text(ctx, value, x, y, { size = 24, color = '#f2d28a', bold = true, italic = false, align = 'left', baseline = 'middle', stroke = true, strokeWidth, maxWidth } = {}) {
  ctx.save();
  let fontSize = size;
  const font = () => `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${FONT}`;
  ctx.font = font();
  if (maxWidth) while (fontSize > 10 && ctx.measureText(value).width > maxWidth) { fontSize -= 1; ctx.font = font(); }
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeWidth ?? Math.max(3, fontSize * 0.2);
    ctx.strokeStyle = '#0a0603';
    ctx.strokeText(value, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
  ctx.restore();
}

function bar(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#08101c';
  ctx.strokeStyle = '#d6a23a';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function divider(ctx, x1, x2, y, alpha = 0.35) {
  ctx.save();
  const g = ctx.createLinearGradient(x1, 0, x2, 0);
  g.addColorStop(0, `rgba(214,162,58,0)`);
  g.addColorStop(0.2, `rgba(214,162,58,${alpha})`);
  g.addColorStop(0.8, `rgba(214,162,58,${alpha})`);
  g.addColorStop(1, `rgba(214,162,58,0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x1, y, x2 - x1, 2);
  ctx.restore();
}

// Panel s nadpisem na štítku (jako na kartě hrdiny).
function panel(scene, ctx, x, y, w, h, title = null, { titleW = 260 } = {}) {
  nine(scene, ctx, 'panel', x, y, w, h, 20);
  if (title) {
    const tw = Math.max(titleW, title.length * 13 + 70);
    nine(scene, ctx, 'btn', x + w / 2 - tw / 2, y - 24, tw, 48, 14);
    text(ctx, title, x + w / 2, y, { size: 24, align: 'center' });
  }
}

// Nadpis panelu vlevo s ikonou (Party, Talenty).
function heading(scene, ctx, iconId, value, x, y, size = 28) {
  if (iconId) icon(scene, ctx, iconId, x, y - size * 0.75, size * 1.5);
  text(ctx, value, x + (iconId ? size * 1.7 : 0), y, { size, italic: true });
}

// Stav prvku → díl rámečku / tlačítka.
const BUTTON_FOR = { normal: 'btn', hover: 'btnHover', active: 'btnActive', selected: 'btnActive', disabled: 'btnDisabled', locked: 'btnDisabled' };
const FRAME_FOR = { normal: 'frame', hover: 'frameHover', active: 'frameActive', selected: 'frameActive', disabled: 'frameDisabled', locked: 'frameDisabled' };
const DIM = 'grayscale(1) brightness(0.65)';
const isOff = (state) => state === 'disabled' || state === 'locked';

function register(scene, key, c) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

// Podklad karty je průhledný – rám a pozadí kreslí scéna (drawCardFrame v ui/fantasyCard.js,
// stejný panel jako karta Mapa); obsah karty se do něj zmenší (CARD_FIT).
function cardBase() {
  return canvas(W, H);
}

// ---------------------------------------------------------------- karta Hrdina

function buildHeroCard(scene, key, gender) {
  const { c, ctx } = cardBase(scene);

  // Portrét
  fit(ctx, img(scene, legacyKey(`hero_portrait_${gender}`)), 52, 122, 262, 418);
  nine(scene, ctx, 'slot', 40, 110, 286, 442, 26);

  // Jméno, úroveň, zkušenosti, mana
  panel(scene, ctx, 334, 112, 334, 262);
  text(ctx, 'Jméno', 350, 152, { size: 30, color: '#ffe7ae' });
  text(ctx, 'Úroveň', 350, 204, { size: 26 });
  text(ctx, 'Zkušenosti', 354, 248, { size: 22, color: '#f3e4bd', bold: false });
  bar(ctx, 357, 272, 273, 15);
  text(ctx, 'Mana', 354, 306, { size: 22, color: '#f3e4bd', bold: false });
  bar(ctx, 357, 330, 273, 15);

  // Statistiky hrdiny a velitelské statistiky
  panel(scene, ctx, 680, 124, 390, 244, 'Statistiky hrdiny');
  [['brain', 'Intelekt'], ['magic_star', 'Spell Power'], ['winged_boot', 'Rychlost'], ['clover', 'Štěstí'], ['heart', 'Charisma']]
    .forEach(([id, label], i) => {
      const y = [181, 221, 259, 296, 334][i];
      icon(scene, ctx, id, 722, y - 19, 38);
      text(ctx, label, 776, y, { size: 24, color: '#f3e4bd', bold: false });
      if (i < 4) divider(ctx, 712, 1050, y + 19);
    });
  panel(scene, ctx, 1086, 124, 414, 244, 'Velitelské statistiky', { titleW: 300 });
  [['crossed_swords', 'Fyzický útok'], ['magic_staff', 'Magický útok'], ['shield_defense', 'Obrana'], ['shield_magic', 'Magická odolnost']]
    .forEach(([id, label], i) => {
      const y = [182, 226, 270, 313][i];
      icon(scene, ctx, id, 1124, y - 20, 40);
      text(ctx, label, 1180, y, { size: 24, color: '#f3e4bd', bold: false });
      if (i < 3) divider(ctx, 1116, 1482, y + 21);
    });

  // Vybavení (sloty kreslí karta)
  panel(scene, ctx, 336, 398, 484, 292, 'Vybavení');
  // Celá postava (výřezy hero_figure_* jsou useknuté u kolen) – pro obě pohlaví stejná zbroj.
  fit(ctx, img(scene, legacyKey('inventory_figure')), 452, 420, 256, 266);

  // Magické školy (karty škol kreslí karta) – názvy pod nimi
  panel(scene, ctx, 834, 404, 666, 192, 'Magické školy');
  const schoolNames = { fire: 'Oheň', water: 'Voda', earth: 'Země', air: 'Vzduch', light: 'Světlo', dark: 'Temnota' };
  for (const school of MAGIC_SCHOOLS) text(ctx, schoolNames[school.id] ?? school.label, school.x, 578, { size: 17, color: '#f3e4bd', align: 'center' });

  // Dovednosti (tlačítka kreslí karta)
  panel(scene, ctx, 62, 704, 822, 200, 'Dovednosti');

  // Zlato, oblast, magické kameny
  panel(scene, ctx, 932, 618, 526, 64);
  icon(scene, ctx, 'coins', 962, 624, 52);
  text(ctx, 'Zlato', 1030, 650, { size: 28, color: '#f3e4bd' });
  panel(scene, ctx, 932, 690, 526, 88);
  icon(scene, ctx, 'map_pin', 962, 700, 48);
  text(ctx, 'Oblast', 1030, 714, { size: 24, color: '#f3e4bd' });
  fit(ctx, img(scene, legacyKey('region_greenvale')), 1176, 697, 268, 74);
  panel(scene, ctx, 932, 786, 526, 110);
  icon(scene, ctx, 'crystal', 962, 806, 60);
  text(ctx, 'Magické kameny', 1040, 810, { size: 24, color: '#f3e4bd' });

  register(scene, key, c);
}

// ---------------------------------------------------------------- karta Talenty

const TREE_ICONS = { combat: 'crossed_swords', crafting: 'gear', wizard: 'magic_star' };
const FINAL_ICONS = { combat: 'dragon_gold', crafting: 'crown', wizard: 'dragon_purple' };

function buildTalentCard(scene, names = {}) {
  const { c, ctx } = cardBase(scene);
  icon(scene, ctx, 'book', 56, 70, 64);
  text(ctx, 'Talenty', 128, 102, { size: 40, italic: true, color: '#ffe7ae' });
  icon(scene, ctx, 'magic_star', 1150, 74, 54);
  text(ctx, 'Volné body:', 1210, 102, { size: 30, italic: true });

  TALENT_TREES.forEach((tree, t) => {
    const p = TREE_PANELS[t];
    nine(scene, ctx, 'panel', p.x, p.y, p.w, p.h, 22);
    icon(scene, ctx, TREE_ICONS[tree.id], p.x + 20, p.y + 16, 72);
    text(ctx, tree.name, p.x + 102, p.y + 40, { size: 34, italic: true, color: '#ffe7ae' });
    text(ctx, tree.title, p.x + 102, p.y + 72, { size: 20, color: '#f3e4bd', bold: false, strokeWidth: 2.5 });
    divider(ctx, p.x + 16, p.x + p.w - 16, p.y + 100);

    tree.tiers.forEach((tier, i) => {
      const first = talentNodeRect(t, i, 0);
      // Karta Talenty: tenčí písmo – stupně tučně jen se slabým obrysem, názvy talentů normálně.
      text(ctx, `${TIER_NAMES[i]} • ${tier.name}`, p.x + 22, first.y - 17, { size: 21, strokeWidth: 2.5 });
      tier.talents.forEach((talent, s) => {
        const r = talentNodeRect(t, i, s);
        nine(scene, ctx, 'btn', r.x, r.y, r.w, r.h, 12);
        const size = r.h - 10;
        fit(ctx, img(scene, legacyKey(`talent_${tree.id}_${i + 1}_${s}`)), r.x + 8, r.y + 5, size, size);
        text(ctx, names[talent.id] ?? talent.name, r.x + size + 16, r.y + 21, { size: 18, color: '#f3e4bd', bold: false, strokeWidth: 2, maxWidth: r.w - size - 26 });
      });
    });

    const f = FINAL_BOXES[t];
    nine(scene, ctx, 'panel', f.x, f.y, f.w, f.h, 18);
    icon(scene, ctx, 'star', f.x + 14, f.y + 8, 36);
    text(ctx, tree.final.name, f.x + 58, f.y + 27, { size: 27, italic: true, color: '#ffe7ae' });
    icon(scene, ctx, FINAL_ICONS[tree.id], f.x + 12, f.y + 44, 52);
  });
  register(scene, TALENT_CARD.color, c);

  // Šedá verze (zamčené stromy a stupně): stejný podklad bez barev.
  const gray = canvas(W, H);
  gray.ctx.filter = 'grayscale(1) brightness(0.72)';
  gray.ctx.drawImage(c, 0, 0);
  register(scene, TALENT_CARD.gray, gray.c);

  // Rámečky políčka: zlatý (talent s body) a modrý (pod myší).
  for (const [key, tint] of [[TALENT_CARD.frameActive, null], [TALENT_CARD.frameHover, 'rgba(90,180,255,0.75)']]) {
    const f = canvas(600, 200);
    nine(scene, f.ctx, 'frameEmpty', 0, 0, 600, 200, 26);
    if (tint) {
      f.ctx.globalCompositeOperation = 'source-atop';
      f.ctx.fillStyle = tint;
      f.ctx.fillRect(0, 0, 600, 200);
    }
    register(scene, key, f.c);
  }
}

// ---------------------------------------------------------------- karta Party

function buildPartyCard(scene) {
  const { c, ctx } = cardBase(scene);
  icon(scene, ctx, 'paw', 58, 74, 66);
  text(ctx, 'Parta', 134, 112, { size: 48, italic: true, color: '#ffe7ae' });

  nine(scene, ctx, 'panel', 34, 175, 506, 494, 22);
  heading(scene, ctx, 'hero_wheel', 'Aktivní parta', 62, 206, 26);
  nine(scene, ctx, 'panel', 34, 683, 506, 184, 22);
  heading(scene, ctx, 'chest', 'Úschovna', 62, 714, 26);
  ctx.save(); ctx.fillStyle = 'rgba(4,10,20,0.55)'; roundRect(ctx, STORAGE.area.x, STORAGE.area.y, STORAGE.area.w, STORAGE.area.h, 10); ctx.fill(); ctx.restore();

  // Detail monstra
  nine(scene, ctx, 'panel', 548, 172, 955, 700, 24);
  nine(scene, ctx, 'slot', DETAIL.portrait.x - 6, DETAIL.portrait.y - 6, DETAIL.portrait.w + 12, DETAIL.portrait.h + 12, 22);
  divider(ctx, DETAIL.textX, 1180, DETAIL.line1Y + 14);
  divider(ctx, DETAIL.textX, 1180, DETAIL.line2Y + 14);
  text(ctx, 'HP', 760, DETAIL.hpY, { size: 26, italic: true });
  bar(ctx, DETAIL.hpBar.x, DETAIL.hpBar.y, DETAIL.hpBar.w, DETAIL.hpBar.h);

  // Statistiky
  nine(scene, ctx, 'panel', 566, 362, 506, 342, 20);
  const stats = [['heart', 'Vitalita'], ['crossed_swords', 'Síla'], ['shield_defense', 'Zbroj'], ['magic_star', 'Magická síla'],
    ['shield_magic', 'Magická obrana'], ['winged_boot', 'Rychlost'], ['target', 'Přesnost']];
  stats.forEach(([id, label], i) => {
    const y = STATS.rowsY[i];
    icon(scene, ctx, id, 592, y - 18, 36);
    text(ctx, label, 640, y, { size: 22, color: '#f3e4bd', bold: false });
    for (let d = 0; d < 5; d++) {
      const cx = STATS.diamondX + d * STATS.diamondStep;
      const h = STATS.diamondHalf;
      ctx.save(); ctx.fillStyle = 'rgba(150,170,190,0.55)';
      ctx.beginPath(); ctx.moveTo(cx, y - h); ctx.lineTo(cx + h, y); ctx.lineTo(cx, y + h); ctx.lineTo(cx - h, y); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    if (i < stats.length - 1) divider(ctx, 590, 990, y + 19, 0.25);
  });

  // Schopnosti, historie
  nine(scene, ctx, 'panel', 1083, 362, 404, 360, 20);
  heading(scene, ctx, 'crossed_swords', 'Schopnosti', 1110, 390, 26);
  nine(scene, ctx, 'panel', 566, 712, 506, 152, 20);
  heading(scene, ctx, 'scroll', 'Historie', 592, 740, 26);

  register(scene, PARTY_CARD.background, c);

  // Tlačítka a políčka karty Party (4 stavy: výchozí / pod myší / vybrané / šedé).
  const kinds = [
    ['plus', STATS.plus.w * 2, STATS.plus.h * 2, (cx, st, x, y, w, h) => text(cx, '+', x + w / 2, y + h / 2 + 2, { size: 44, align: 'center', color: isOff(st) ? '#a6abb0' : '#fff2c4' })],
    // Schopnost jen v rámečku (bez políčka pro ikonu).
    ['skill', PARTY_SKILLS.w * 2, PARTY_SKILLS.h * 2, null],
    ['storage', STORAGE.item.w * 2, STORAGE.item.h * 2, null],
    ['arrowUp', STORAGE.up.w * 2, STORAGE.up.h * 2, (cx, st, x, y, w, h) => text(cx, '▲', x + w / 2, y + h / 2, { size: 30, align: 'center', color: isOff(st) ? '#a6abb0' : '#ffd76a' })],
    ['arrowDown', STORAGE.down.w * 2, STORAGE.down.h * 2, (cx, st, x, y, w, h) => text(cx, '▼', x + w / 2, y + h / 2, { size: 30, align: 'center', color: isOff(st) ? '#a6abb0' : '#ffd76a' })],
    ['store', ACTIONS.store.w * 2, ACTIONS.store.h * 2, (cx, st, x, y, w, h) => text(cx, 'Do úschovny', x + w / 2, y + h / 2 + 2, { size: 38, align: 'center', color: isOff(st) ? '#b9bcc0' : '#f3e4bd' })],
    ['release', ACTIONS.release.w * 2, ACTIONS.release.h * 2, (cx, st, x, y, w, h) => text(cx, 'Propustit', x + w / 2, y + h / 2 + 2, { size: 38, align: 'center', color: isOff(st) ? '#b9bcc0' : '#ffe2d8' }), 'red']
  ];
  buildAtlas(scene, PARTY_CARD.buttons, kinds);

  const slotW = 926;
  const slotH = 196;
  buildAtlas(scene, PARTY_CARD.monsterSelect, [['slot', slotW, slotH, (cx, st, x, y, w, h) => {
    nine(scene, cx, FRAME_FOR[st === 'disabled' ? 'disabled' : st === 'selected' ? 'selected' : 'normal'], x + 22, y + 22, 150, 150, 26);
  }]], { border: 30 });
}

// Atlas s rámci `${kind}-${state}` pod sebou (stejné jména rámců jako starý list).
function buildAtlas(scene, key, kinds, { border = 22 } = {}) {
  const gap = 4;
  const width = Math.max(...kinds.map(([, w]) => w)) * PARTY_STATES.length + gap * PARTY_STATES.length;
  const height = kinds.reduce((sum, [, , h]) => sum + h + gap, 0);
  const { c, ctx } = canvas(width, height);
  const frames = [];
  let y = 0;
  for (const [kind, w, h, extra, style] of kinds) {
    PARTY_STATES.forEach((state, i) => {
      const x = i * (w + gap);
      const piece = style === 'red' && (state === 'normal' || state === 'hover') ? 'btnRed' : BUTTON_FOR[state];
      ctx.save();
      if (style === 'red' && state === 'hover') ctx.filter = 'brightness(1.25)';
      nine(scene, ctx, piece, x, y, w, h, Math.min(border, h * 0.32));
      ctx.restore();
      extra?.(ctx, state, x, y, w, h);
      frames.push([`${kind}-${state}`, x, y, w, h]);
    });
    y += h + gap;
  }
  register(scene, key, c);
  const texture = scene.textures.get(key);
  for (const [name, x, fy, w, h] of frames) texture.add(name, 0, x, fy, w, h);
}

// ---------------------------------------------------------------- karta Inventář

const GRID = { cols: [674, 775, 875, 974, 1073, 1173, 1274, 1374], rows: [143, 246, 349, 452, 556], w: 93, h: 96 };
const INV_EQUIP = {
  weapon: { x: 84, y: 170 }, shield: { x: 84, y: 264 }, ring: { x: 84, y: 357 }, amulet: { x: 84, y: 451 },
  helmet: { x: 504, y: 170 }, armor: { x: 504, y: 264 }, legs: { x: 504, y: 357 }, boots: { x: 504, y: 451 }
};
const SLOT_ICONS = { weapon: 'sword', shield: 'shield_defense', ring: 'ring', amulet: 'amulet', helmet: 'helmet', armor: 'armor', legs: 'legs', boots: 'boots' };
const CATEGORY_ICONS = { armor: 'armor', materials: 'crystal', potions: 'potion', accessories: 'ring', keys: 'key', other: 'chest' };

function buildInventoryCard(scene) {
  const { c, ctx } = cardBase(scene);
  panel(scene, ctx, 40, 128, 600, 478, 'Vybavení');
  fit(ctx, img(scene, legacyKey('inventory_figure')), 190, 175, 300, 395);
  for (const [slot, p] of Object.entries(INV_EQUIP)) {
    ctx.drawImage(equipTexture(scene, slot, 'normal'), p.x - 3, p.y - 3, 107, 87);
  }
  panel(scene, ctx, 44, 626, 594, 264);

  nine(scene, ctx, 'panel', 650, 112, 848, 790, 24);
  const cell = slotTexture(scene, 'normal');
  for (const y of GRID.rows) for (const x of GRID.cols) ctx.drawImage(cell, x - 3, y - 3, GRID.w + 6, GRID.h + 6);

  // Stránky, kategorie, zlato
  ctx.drawImage(img(scene, legacyKey('arrow_left')), 677, 688, 38, 66);
  ctx.drawImage(img(scene, legacyKey('arrow_right')), 868, 688, 38, 66);
  nine(scene, ctx, 'btn', 728, 696, 128, 50, 14);
  ITEM_CATEGORIES.forEach((category, i) => {
    const x = [939, 1028, 1118, 1207, 1296, 1385][i];
    ctx.drawImage(categoryTexture(scene, category, 'normal'), x - 2, 676, 87, 93);
  });
  panel(scene, ctx, 695, 790, 753, 62);
  icon(scene, ctx, 'coins', 718, 794, 52);
  register(scene, INVENTORY_CARD, c);
}

function equipTexture(scene, slot, state) {
  const { c, ctx } = canvas(214, 174);
  nine(scene, ctx, FRAME_FOR[state], 0, 0, 214, 174, 34);
  icon(scene, ctx, SLOT_ICONS[slot], 52, 32, 110, 0.4);
  return c;
}

function slotTexture(scene, state) {
  const { c, ctx } = canvas(198, 204);
  nine(scene, ctx, FRAME_FOR[state], 0, 0, 198, 204, 34);
  return c;
}

function categoryTexture(scene, category, state) {
  const { c, ctx } = canvas(174, 186);
  nine(scene, ctx, FRAME_FOR[state], 0, 0, 174, 186, 30);
  icon(scene, ctx, CATEGORY_ICONS[category.id], 42, 24, 90);
  text(ctx, category.label, 87, 150, { size: 24, align: 'center', color: '#f3e4bd' });
  return c;
}

// ---------------------------------------------------------------- stavy prvků

const TAB_ICONS = ['hero_wheel', 'star', 'party', 'bag', 'anvil', 'paw', 'map', 'scroll_quest'];
const SKILL_ICONS = { herbalism: 'herbs', alchemy: 'potion', mining: 'pickaxe', fishing: 'fishing_rod', cooking: 'cooking_pot', smithing: 'ingots', crafting: 'gear', diplomacy: 'handshake' };
const SCHOOL_ICONS = { fire: 'fire', water: 'water', earth: 'leaf', air: 'air', light: 'sun', dark: 'moon' };

function buildStateTextures(scene) {
  // Záložky (Hrdina … Úkoly): výchozí / pod myší / aktivní.
  TABS.forEach((tab, index) => {
    const w = (tab.area.w + 4) * 2;
    const h = (tab.area.h + 6) * 2;
    for (const state of ['normal', 'hover', 'active']) {
      const { c, ctx } = canvas(w, h);
      nine(scene, ctx, BUTTON_FOR[state], 4, 6, w - 8, h - 12, 30);
      const size = h * 0.56;
      ctx.font = `bold 40px ${FONT}`;
      const labelW = Math.min(ctx.measureText(tab.label).width, w - size - 50);
      const start = (w - (size + 10 + labelW)) / 2;
      icon(scene, ctx, TAB_ICONS[index], start, (h - size) / 2, size);
      text(ctx, tab.label, start + size + 10, h / 2 + 2, { size: 40, color: state === 'active' ? '#fff6da' : '#f2d28a', maxWidth: w - size - 50 });
      register(scene, tabStateKey(state, index), c);
    }
  });

  // Zavřít: červené / světlejší pod myší / zlaté při stisku / šedé.
  for (const state of ['normal', 'hover', 'active', 'disabled']) {
    const { c, ctx } = canvas(560, 160);
    ctx.save();
    if (state === 'hover') ctx.filter = 'brightness(1.25)';
    nine(scene, ctx, state === 'active' ? 'btnActive' : state === 'disabled' ? 'btnDisabled' : 'btnRed', 8, 8, 544, 144, 44);
    ctx.restore();
    text(ctx, 'Zavřít', 280, 84, { size: 64, align: 'center', color: state === 'disabled' ? '#b9bcc0' : '#fff2e6' });
    register(scene, closeStateKey(state), c);
  }

  // Magické školy (104 × 122 ve hře): rámeček ikony nahoře, pod ním místo pro ukazatel.
  for (const school of MAGIC_SCHOOLS) {
    for (const state of ['normal', 'selected', 'hover', 'locked']) {
      const { c, ctx } = canvas(208, 244);
      nine(scene, ctx, FRAME_FOR[state], 12, 4, 184, 184, 40);
      icon(scene, ctx, SCHOOL_ICONS[school.id], 46, 38, 116, 1, isOff(state) ? DIM : 'none');
      register(scene, magicStateKey(school.id, state), c);
    }
  }

  // Dovednosti (185 × 73, obrázek o 3 % / 13 % větší): ikona vlevo, název, rámeček ukazatele.
  for (const skill of SKILLS) {
    for (const state of ['normal', 'selected', 'hover', 'locked']) {
      const w = 382;
      const h = 164;
      const { c, ctx } = canvas(w, h);
      nine(scene, ctx, BUTTON_FOR[state], 4, 10, w - 8, h - 20, 30);
      icon(scene, ctx, SKILL_ICONS[skill.id], 22, 30, 100, 1, isOff(state) ? DIM : 'none');
      text(ctx, skill.label, 132, 58, { size: 32, color: isOff(state) ? '#b9bcc0' : state === 'selected' ? '#fff6da' : '#f2d28a', maxWidth: w - 150 });
      bar(ctx, 200, 115, 158, 24);
      register(scene, skillStateKey(skill.id, state), c);
    }
  }

  // Sloty výbavy, políčka inventáře, kategorie, šipky.
  for (const { id } of EQUIPMENT_SLOTS) for (const state of ['normal', 'hover']) register(scene, equipKey(id, state), equipTexture(scene, id, state));
  for (const state of ['normal', 'hover']) register(scene, slotKey(state), slotTexture(scene, state));
  for (const category of ITEM_CATEGORIES) for (const state of ['normal', 'hover']) register(scene, categoryKey(category.id, state), categoryTexture(scene, category, state));
  for (const dir of ['left', 'right']) {
    const source = img(scene, legacyKey(`arrow_${dir}`));
    if (!source) continue;
    for (const state of ['normal', 'hover']) {
      const { c, ctx } = canvas(source.width, source.height);
      ctx.filter = state === 'hover' ? 'brightness(1.45) saturate(1.2)' : 'none';
      ctx.drawImage(source, 0, 0);
      // Šipka je vyříznutá z karty inventáře i s tmavomodrým pozadím – to se zprůhlední
      // (zlatá šipka má vysoký červený kanál, pozadí nízký; přechod pro hladký okraj).
      const data = ctx.getImageData(0, 0, source.width, source.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i];
        px[i + 3] = Math.round(px[i + 3] * Math.max(0, Math.min(1, (r - 70) / 60)));
      }
      ctx.putImageData(data, 0, 0);
      register(scene, arrowKey(dir, state), c);
    }
  }
}

// Sestaví celé nové UI (volá BootScene.create po načtení dílů).
// Karta Talenty s názvy podle stavu hry (např. „Ohnivé soustředění“ po volbě školy).
export function rebuildTalentCard(scene, names = {}) {
  buildTalentCard(scene, names);
}

export function buildNewUi(scene) {
  if (!scene.textures.exists(pieceKey('card'))) return false;
  buildStateTextures(scene);
  buildHeroCard(scene, CARD_TEXTURE, 'male');
  buildHeroCard(scene, HERO_CARD_FEMALE, 'female');
  buildTalentCard(scene);
  buildPartyCard(scene);
  buildInventoryCard(scene);
  return true;
}

// Klíče textur dílů pro ostatní okna (tlačítka a rámy v ui/fantasyCard.js).
export const NEW_UI_KEYS = { pieceKey, iconKey, PIECES };
