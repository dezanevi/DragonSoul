import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { REGIONS, isRegionUnlocked, ALL_REGIONS_OPEN_FOR_TESTING } from '../systems/RegionSystem.js';
import { loadWorldMap } from '../data/maps/index.js';
import { TILE_SIZE } from '../data/tiles.js';
import { CARD_PANEL, cardText, drawCardFrame, cardCloseButton, uiTitle } from '../ui/fantasyCard.js';
import { currentMeteor, specialization } from '../systems/MiningSystem.js';
import { createCardTabBar, slideCardIn, slideCardOut } from '../ui/cardTabBar.js';

// Karta Mapa (klávesa M, záložka Mapa): všech deset regionů Aurie ze skutečného terénu.
// Každý region je vykreslený z dlaždic své mapy (barva dlaždice = pixel) a umístěný
// podle polohy na mapě světa (RegionSystem.mapX / mapY). Spojnice = propojení regionů,
// zlaté body = brány, bílý rámeček = město, tečky = připravená místa NPC, modrá = hráč.

// Mapa pod jednotnou hlavičkou karty (nadpis s ikonou nesmí zasahovat do rámečku mapy).
const AREA = { x: CARD_PANEL.x + 60, y: CARD_PANEL.y + 96, w: CARD_PANEL.w - 120, h: CARD_PANEL.h - 196 };
const PX_PER_TILE = 1.7;
const SEA = 0x0d2a44;

// Textura regionu: 1 pixel = 1 dlaždice (vytvoří se jednou za hru).
export function regionTexture(scene, map) {
  const key = `worldmap-${map.id}`;
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = map.width;
  canvas.height = map.height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(map.width, map.height);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const color = map.tiles[y][x].color;
      const i = (y * map.width + x) * 4;
      image.data[i] = (color >> 16) & 255;
      image.data[i + 1] = (color >> 8) & 255;
      image.data[i + 2] = color & 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  scene.textures.addCanvas(key, canvas);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

export default class WorldMapScene extends Phaser.Scene {
  constructor() {
    super('WorldMap');
  }

  create(data) {
    this.state = data?.state ?? SaveSystem.load();
    this.returnScene = data?.returnScene ?? 'World';
    this.storageAccess = Boolean(data?.storageAccess);
    this.closing = false;
    if (!this.state) {
      this.scene.start('Menu');
      return;
    }

    drawCardFrame(this);
    const g = this.add.graphics();
    g.fillStyle(SEA, 1).fillRoundedRect(AREA.x, AREA.y, AREA.w, AREA.h, 14);
    g.lineStyle(2, 0x3b6e96, 0.8).strokeRoundedRect(AREA.x, AREA.y, AREA.w, AREA.h, 14);

    const current = this.state.region || 'Greenvale';
    // Nadpis a text vpravo mimo zlaté rohy rámu (jako ostatní karty).
    uiTitle(this, CARD_PANEL.x + 150, CARD_PANEL.y + 38, 'Mapa Aurie', { icon: 'map', size: 34 });
    (cardText(this, CARD_PANEL.x + CARD_PANEL.w - 150, CARD_PANEL.y + 36,
      `Jsi v oblasti ${current}${ALL_REGIONS_OPEN_FOR_TESTING ? ' · test: všechny regiony průchozí' : ''}`,
      { size: 18, color: '#c9d3dd', originX: 1 }));

    // Regiony a jejich středy (pro spojnice).
    const placed = REGIONS.map((region) => {
      const map = loadWorldMap(region.id);
      const w = map.width * PX_PER_TILE;
      const h = map.height * PX_PER_TILE;
      const cx = AREA.x + region.mapX * AREA.w;
      const cy = AREA.y + region.mapY * AREA.h;
      return { region, map, x: Phaser.Math.Clamp(cx - w / 2, AREA.x + 6, AREA.x + AREA.w - w - 6), y: Phaser.Math.Clamp(cy - h / 2, AREA.y + 6, AREA.y + AREA.h - h - 30), w, h };
    });
    const byId = Object.fromEntries(placed.map((p) => [p.region.id, p]));

    // Spojnice mezi branami sousedních regionů.
    const lines = this.add.graphics();
    const gatePoint = (p, to) => {
      const exit = (p.map.exits ?? []).find((e) => e.to === to);
      return exit
        ? { x: p.x + (exit.x + 0.5) * PX_PER_TILE, y: p.y + (exit.y + 0.5) * PX_PER_TILE }
        : { x: p.x + p.w / 2, y: p.y + p.h / 2 };
    };
    const drawn = new Set();
    for (const p of placed) {
      for (const to of p.region.connections) {
        const key = [p.region.id, to].sort().join('|');
        if (drawn.has(key) || !byId[to]) continue;
        drawn.add(key);
        const a = gatePoint(p, to);
        const b = gatePoint(byId[to], p.region.id);
        lines.lineStyle(6, 0x000000, 0.35).lineBetween(a.x, a.y, b.x, b.y);
        lines.lineStyle(3, 0xffd76a, 0.9).lineBetween(a.x, a.y, b.x, b.y);
      }
    }

    const meteor = specialization(this.state) === 'explorer' ? currentMeteor(this.state) : null;
    // Regiony z dlaždic.
    for (const p of placed) {
      const id = p.region.id;
      const unlocked = ALL_REGIONS_OPEN_FOR_TESTING || isRegionUnlocked(this.state, id);
      const image = this.add.image(p.x, p.y, regionTexture(this, p.map)).setOrigin(0).setScale(PX_PER_TILE);
      if (!unlocked) image.setTint(0x777777);
      const frame = this.add.graphics();
      const isHere = id === current;
      frame.lineStyle(isHere ? 4 : 2, isHere ? 0x6fc8ff : 0xd6a23a, 1).strokeRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4);

      // Brány, město a místa NPC.
      const marks = this.add.graphics();
      for (const exit of p.map.exits ?? []) {
        marks.fillStyle(0xffd76a, 1).fillCircle(p.x + (exit.x + 0.5) * PX_PER_TILE, p.y + (exit.y + 0.5) * PX_PER_TILE, 4);
      }
      for (const town of p.map.towns ?? []) {
        marks.lineStyle(2, 0xffffff, 0.9).strokeRect(p.x + town.x * PX_PER_TILE, p.y + town.y * PX_PER_TILE, town.width * PX_PER_TILE, town.height * PX_PER_TILE);
      }
      for (const npc of p.map.npcs ?? []) {
        marks.fillStyle(0xff8fd0, 1).fillCircle(p.x + (npc.x + 0.5) * PX_PER_TILE, p.y + (npc.y + 0.5) * PX_PER_TILE, 2.5);
      }
      // Průzkumník nalezišť vidí, kam dopadl Hvězdný meteorit.
      if (meteor?.region === id && p.map.meteorSpot) {
        const mx = p.x + (p.map.meteorSpot.x + 0.5) * PX_PER_TILE;
        const my = p.y + (p.map.meteorSpot.y + 0.5) * PX_PER_TILE;
        marks.fillStyle(0x2a1d05, 1).fillCircle(mx, my, 7);
        marks.fillStyle(0xffcf5a, 1).fillCircle(mx, my, 5);
      }
      if (isHere && Number.isFinite(this.state.x) && Number.isFinite(this.state.y)) {
        const px = p.x + (this.state.x / TILE_SIZE) * PX_PER_TILE;
        const py = p.y + (this.state.y / TILE_SIZE) * PX_PER_TILE;
        marks.fillStyle(0x0b1a2e, 1).fillCircle(px, py, 8);
        marks.fillStyle(0x6fc8ff, 1).fillCircle(px, py, 6);
        this.tweens.add({ targets: marks, alpha: 0.75, duration: 700, yoyo: true, repeat: -1 });
      }

      (cardText(this, p.x + p.w / 2, p.y + p.h + 6, unlocked ? id : `${id} (zamčeno)`, {
        size: 17, bold: true, color: isHere ? '#8fd3ff' : unlocked ? '#ffe7ae' : '#9aa4ae', originX: 0.5
      }));
    }

    // Legenda.
    const ly = AREA.y + AREA.h + 18;
    const legend = this.add.graphics();
    const items = [
      [0x6fc8ff, 'Tvoje poloha'], [0xffd76a, 'Brána / cesta mezi regiony'], [0xffffff, 'Město (připravené)'], [0xff8fd0, 'Místo pro NPC'],
      ...(meteor ? [[0xffcf5a, 'Hvězdný meteorit']] : [])
    ];
    items.forEach(([color, label], i) => {
      const x = AREA.x + 110 + i * (items.length > 4 ? 270 : 330); // vlevo místo pro zlatý roh rámu
      legend.fillStyle(color, 1).fillCircle(x, ly + 12, 7);
      (cardText(this, x + 16, ly + 2, label, { size: 17, color: '#dbe6f3' }));
    });

    cardCloseButton(this, () => this.closeCard());
    const tabBar = createCardTabBar(this, 'map', {
      onClose: () => this.closeCard(),
      state: this.state,
      returnScene: this.returnScene,
      storageAccess: this.storageAccess,
      beforeLeave: () => SaveSystem.save(this.state)
    });
    this.tabBar = tabBar;
    // Otevřeno ze světa / interiéru: karta vyjede zpod lišty.
    if (data?.animateIn) slideCardIn(this, { hide: tabBar.objects });

    if (this.onKey) this.input.keyboard.off('keydown', this.onKey);
    this.onKey = (event) => {
      if (event.repeat) return;
      if (event.code === 'Escape' || event.code === 'KeyM') this.closeCard();
    };
    this.input.keyboard.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));
  }

  closeCard() {
    if (this.closing) return;
    this.closing = true;
    // Karta zajede pod lištu, pak se vrátí scéna pod ní.
    slideCardOut(this, () => {
      this.scene.stop();
      this.scene.resume(this.returnScene);
    }, { hide: this.tabBar?.objects });
  }
}
