import { TABS, CARD_WIDTH, CARD_HEIGHT } from './heroCard/cardLayout.js';
import { tabStateKey } from './heroCard/tabSprites.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';

// Horní lišta karet (Hrdina, Talenty, Party, Inventář, Řemesla, Bestiář, Mapa, Úkoly)
// pro samostatné karty. Stejné obrázky stavů a stejné místo na obrazovce jako na kartě
// hrdiny: klid = 1. řádek listu, pod myší = 2. řádek (zlatá), aktivní = 3. řádek (modrá).

// Přepočet ze souřadnic karty hrdiny (1536 × 1024) na obrazovku – stejně jako HeroScene.
const SCALE = Math.min(GAME_WIDTH / CARD_WIDTH, GAME_HEIGHT / CARD_HEIGHT);
const OFFSET_X = (GAME_WIDTH - CARD_WIDTH * SCALE) / 2;
const OFFSET_Y = (GAME_HEIGHT - CARD_HEIGHT * SCALE) / 2;
const PAD_X = 4;
const PAD_Y = 6;

// Karta, kterou otevře záložka. Záložky bez vlastní karty ukáže karta hrdiny.
const CARD_FOR_TAB = { hero: 'Hero', talents: 'Talents', party: 'Party', inventory: 'Inventory' };

export function createCardTabBar(scene, activeId, context) {
  const first = TABS[0].area;
  const last = TABS[TABS.length - 1].area;
  const left = OFFSET_X + first.x * SCALE - 14;
  const right = OFFSET_X + (last.x + last.w) * SCALE + 14;
  const top = OFFSET_Y + first.y * SCALE - 8;
  const height = first.h * SCALE + 16;

  // Podklad lišty (na kartě hrdiny je namalovaný v obrázku).
  // drawStrip: false = podklad je už namalovaný v obrázku karty (karta Talenty).
  if (context.drawStrip !== false) {
    const g = scene.add.graphics().setDepth(90);
    g.fillStyle(0x07111f, 0.96).fillRoundedRect(left, top, right - left, height, 14);
    g.lineStyle(4, 0xd6a23a, 1).strokeRoundedRect(left, top, right - left, height, 14);
  }

  let hoverId = null;
  const sprites = TABS.map((tab, index) => {
    const { x, y, w, h } = tab.area;
    const sx = OFFSET_X + (x + w / 2) * SCALE;
    const sy = OFFSET_Y + (y + h / 2) * SCALE;
    const sprite = scene.textures.exists(tabStateKey('normal', index))
      ? scene.add.image(sx, sy, tabStateKey('normal', index)).setDepth(91)
      : null;

    const zone = scene.add
      .zone(OFFSET_X + x * SCALE, OFFSET_Y + y * SCALE, w * SCALE, h * SCALE)
      .setOrigin(0)
      .setDepth(92)
      .setInteractive({ useHandCursor: tab.id !== activeId });
    zone.on('pointerover', () => { hoverId = tab.id; refresh(); });
    zone.on('pointerout', () => { if (hoverId === tab.id) hoverId = null; refresh(); });
    zone.on('pointerdown', () => {
      if (tab.id !== activeId) openCardForTab(scene, tab.id, context);
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

  return { refresh };
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
