import { TABS, CARD_WIDTH, CARD_HEIGHT } from './heroCard/cardLayout.js';
import { tabStateKey } from './heroCard/tabSprites.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { nineImage } from './fantasyCard.js';

// Horní lišta karet (Hrdina, Talenty, Party, Inventář, Řemesla, Bestiář, Mapa, Úkoly)
// pro samostatné karty. Stejné obrázky stavů a stejné místo na obrazovce jako na kartě
// hrdiny: klid = 1. řádek listu, pod myší = 2. řádek (zlatá), aktivní = 3. řádek (modrá).

// Přepočet ze souřadnic karty hrdiny (1536 × 1024) na obrazovku – stejně jako HeroScene.
const SCALE = Math.min(GAME_WIDTH / CARD_WIDTH, GAME_HEIGHT / CARD_HEIGHT);
const OFFSET_X = (GAME_WIDTH - CARD_WIDTH * SCALE) / 2;
const OFFSET_Y = (GAME_HEIGHT - CARD_HEIGHT * SCALE) / 2;
const PAD_X = 4;
const PAD_Y = 6;

// Podklad lišty (panel nové sady) – stejný ve světě, v interiéru i na všech kartách, aby
// karta při otevření vyjela zpod lišty a lišta se nezměnila (slideCardIn).
const first0 = TABS[0].area;
const last0 = TABS[TABS.length - 1].area;
export const TAB_STRIP = {
  x: OFFSET_X + first0.x * SCALE - 14,
  y: OFFSET_Y + first0.y * SCALE - 8,
  w: (last0.x + last0.w - first0.x) * SCALE + 28,
  h: first0.h * SCALE + 16
};
const STRIP_SLICE = 0.6;

function drawTabStrip(scene) {
  const { x, y, w, h } = TAB_STRIP;
  const strip = nineImage(scene, 'nu-panel', x, y, w, h, STRIP_SLICE);
  if (strip) return strip;
  const g = scene.add.graphics();
  g.fillStyle(0x07111f, 0.96).fillRoundedRect(x, y, w, h, 14);
  g.lineStyle(4, 0xd6a23a, 1).strokeRoundedRect(x, y, w, h, 14);
  return g;
}

// Animace vysunutí karty: karta sjede shora zpod lišty. Kamera karty je oříznutá pod lištou,
// takže nahoře zůstává vidět lišta scény pod kartou (svět / interiér) – stejná jako lišta karty.
// hide = objekty karty pevné vůči obrazovce (lišta karty), ty se ukážou až na konci.
export function slideCardIn(scene, { duration = 380, hide = [] } = {}) {
  const cam = scene.cameras.main;
  const width = scene.scale.width;
  const height = scene.scale.height;
  const top = Math.round(TAB_STRIP.y + TAB_STRIP.h);
  const anim = { offset: height - top };
  const apply = () => {
    cam.setViewport(0, top, width, height - top);
    cam.setScroll(0, top + anim.offset);
  };
  const finish = () => {
    cam.setViewport(0, 0, width, height);
    cam.setScroll(0, 0);
    for (const o of hide) if (o?.active) o.setVisible(true);
  };
  for (const o of hide) o?.setVisible?.(false);
  apply();
  // Zavření karty uprostřed animace: kamera se scénou zůstává – vrátit ji do celé obrazovky.
  scene.events.once('shutdown', finish);
  scene.tweens.add({
    targets: anim,
    offset: 0,
    duration,
    ease: 'Cubic.easeOut',
    onUpdate: apply,
    onComplete: () => {
      scene.events.off('shutdown', finish);
      finish();
    }
  });
}

// Animace zavření karty: opak vysunutí – karta zajede nahoru pod lištu, pak done().
// Lišta karty se hned skryje, nahoře zůstává (stejná) lišta scény pod kartou.
export function slideCardOut(scene, done, { duration = 300, hide = [] } = {}) {
  const cam = scene.cameras.main;
  const width = scene.scale.width;
  const height = scene.scale.height;
  const top = Math.round(TAB_STRIP.y + TAB_STRIP.h);
  const anim = { offset: 0 };
  scene.input.enabled = false;
  for (const o of hide) o?.setVisible?.(false);
  const apply = () => {
    cam.setViewport(0, top, width, height - top);
    cam.setScroll(0, top + anim.offset);
  };
  apply();
  // Kamera se vrátí do celé obrazovky až po zastavení scény – jinak by karta na jeden
  // snímek problikla celá (scéna se zastaví až v dalším kroku hry).
  scene.events.once('shutdown', () => {
    cam.setViewport(0, 0, width, height);
    cam.setScroll(0, 0);
    scene.input.enabled = true;
  });
  scene.tweens.add({
    targets: anim,
    offset: height - top,
    duration,
    ease: 'Cubic.easeIn',
    onUpdate: apply,
    onComplete: () => done()
  });
}

// Karta, kterou otevře záložka. Záložky bez vlastní karty ukáže karta hrdiny.
export const CARD_FOR_TAB = { hero: 'Hero', talents: 'Talents', party: 'Party', inventory: 'Inventory', crafting: 'Professions', bestiary: 'Bestiary', map: 'WorldMap', quests: 'Quests' };

// context.onSelect(tabId) = vlastní obsluha kliknutí (svět a interiér místo nápovědy otevřou kartu);
// bez ní lišta zavře aktuální kartu a otevře jinou. activeId null = žádná karta není zobrazená.
// context.onClose() = klik na aktivní záložku kartu zavře.
// Vrací { refresh, resetHover, setActive, objects } – objects kvůli kameře rozhraní ve světě.
export function createCardTabBar(scene, activeId, context) {
  const objects = [];

  // Podklad lišty (panel, který tlačítka spojoval) je zrušený – tlačítka stojí samostatně.
  // drawStrip: true ho vrátí (TAB_STRIP zůstává pro ořez kamery při vysunutí karty).
  if (context.drawStrip === true) objects.push(drawTabStrip(scene).setDepth(90).setScrollFactor(0));

  let hoverId = null;
  const sprites = TABS.map((tab, index) => {
    const { x, y, w, h } = tab.area;
    const sx = OFFSET_X + (x + w / 2) * SCALE;
    const sy = OFFSET_Y + (y + h / 2) * SCALE;
    const sprite = scene.textures.exists(tabStateKey('normal', index))
      ? scene.add.image(sx, sy, tabStateKey('normal', index)).setDepth(91).setScrollFactor(0)
      : null;
    if (sprite) objects.push(sprite);

    const zone = scene.add
      .zone(OFFSET_X + x * SCALE, OFFSET_Y + y * SCALE, w * SCALE, h * SCALE)
      .setOrigin(0)
      .setDepth(92)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    objects.push(zone);
    zone.on('pointerover', () => { hoverId = tab.id; refresh(); });
    zone.on('pointerout', () => { if (hoverId === tab.id) hoverId = null; refresh(); });
    zone.on('pointerdown', (pointer) => {
      pointer?.event?.stopPropagation?.();
      if (tab.id === activeId) {
        context.onClose?.();
        return;
      }
      if (context.onSelect) context.onSelect(tab.id, CARD_FOR_TAB[tab.id] ?? 'Hero');
      else openCardForTab(scene, tab.id, context);
    });
    return sprite;
  });

  function refresh() {
    TABS.forEach((tab, index) => {
      const sprite = sprites[index];
      if (!sprite) return;
      const state = tab.id === activeId ? 'active' : tab.id === hoverId ? 'hover' : 'normal';
      sprite
        .setTexture(tabStateKey(state, index))
        .setDisplaySize((tab.area.w + PAD_X) * SCALE, (tab.area.h + PAD_Y) * SCALE);
    });
  }
  refresh();

  // Po návratu z karty zůstal hover na záložce, ze které se karta otevřela.
  const resetHover = () => { hoverId = null; refresh(); };
  const setActive = (id) => { activeId = id; refresh(); };
  return { refresh, resetHover, setActive, objects };
}

// Zavře aktuální kartu a otevře kartu dané záložky nad stejnou (pozastavenou) scénou.
// context = { state, returnScene, storageAccess, beforeLeave }
export function openCardForTab(scene, tabId, context) {
  const sceneKey = CARD_FOR_TAB[tabId] ?? 'Hero';
  context.beforeLeave?.();
  scene.closing = true;
  scene.scene.stop();
  scene.scene.launch(sceneKey, {
    state: context.state,
    returnScene: context.returnScene,
    storageAccess: context.storageAccess,
    initialTab: CARD_FOR_TAB[tabId] ? undefined : tabId
  });
  scene.scene.bringToTop(sceneKey);
}

// Obdélník záložky na obrazovce (navádění – světlé okno nad záložkou, ui/guideSpotlight.js).
export function tabRect(tabId) {
  const tab = TABS.find((t) => t.id === tabId);
  if (!tab) return null;
  const { x, y, w, h } = tab.area;
  return { x: OFFSET_X + x * SCALE, y: OFFSET_Y + y * SCALE, w: w * SCALE, h: h * SCALE };
}
