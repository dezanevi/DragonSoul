import Phaser from 'phaser';
import WorldHero from '../entities/WorldHero.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { TILE_SIZE, TILE_TYPES } from '../data/tiles.js';
import { QUEST_STATUS, getQuestStatus, trackedQuest, questTarget } from '../systems/QuestSystem.js';
import { canTravelToRegion, isRegionUnlocked } from '../systems/RegionSystem.js';
import { loadWorldMap } from '../data/maps/index.js';
import { locationById, normalizeFishing } from '../systems/FishingSystem.js';
import { createCardTabBar, CARD_FOR_TAB } from '../ui/cardTabBar.js';

// Karty, pod kterými jde chodit (svět se při nich nepozastaví).
const WORLD_CARD_SCENES = [...new Set(['Hero', ...Object.values(CARD_FOR_TAB)])];
import { uiPrompt, uiToast } from '../ui/fantasyCard.js';
import { normalizeCooking, mealExploreStep } from '../systems/CookingSystem.js';
import { normalizeAlchemy, exploreBonus } from '../systems/AlchemySystem.js';
import { getItemCount, removeItem } from '../systems/InventorySystem.js';
import { normalizeMining, depositById, depositStatus, activeHidden, currentMeteor, formatWait } from '../systems/MiningSystem.js';
import { normalizeHerbalism, herbSiteById, herbSiteStatus, activeHiddenHerbs, formatHerbWait, siteMain } from '../systems/HerbalismSystem.js';
import { HERB_BY_ID } from '../data/herbalism.js';
import TerrainEditor, { renderPlacements, registerMapObject, applyMapEdits } from '../world/TerrainEditor.js';

const OBJECT_LABELS = {
  tree: 'Strom', spruce: 'Smrk', rock: 'Kámen', bush: 'Keř', plant: 'Rostlina',
  stump: 'Pařez', signpost: 'Rozcestník', fenceX: 'Plot', fenceY: 'Plot'
};
import { BUILDING_SPRITES, buildingTextureKey } from '../entities/buildingSprites.js';
import { createIsoProjection, ISO_TILE_WIDTH } from '../world/iso.js';
import { pickTerrainVariant, terrainPlacement } from '../world/terrainTiles.js';
import { OBJECT_VARIANTS, SHEET_SCALE, objectTextureKey } from '../entities/objectSprites.js';

// Verze rozvržení světa v uložené hře. Při změně se hráč přesune na start mapy.
const WORLD_LAYOUT_VERSION = 8;
// Doplňky (keře, rostliny, pařezy) a stromy / skály se kreslí větší – v mapě je jich méně
// (optimalizace, tools/greenvale-village.mjs, oddíl 8).
const DECOR_SCALE = 1.5;
const OBJECT_SCALE = 1.3;

const TILESET_KEY = 'world-tileset';

// Po kolika polích tmavé louky přijde náhodné setkání (náhodně v tomto rozmezí).
const ENCOUNTER_STEPS = { min: 8, max: 18 };
const DOOR_REACH = TILE_SIZE * 0.9;
const CAVE_REACH = TILE_SIZE * 1.6;
const FISHING_REACH = TILE_SIZE * 0.9;
const MINING_REACH = TILE_SIZE * 0.75;
const HERB_REACH = TILE_SIZE * 0.75;
const CAVE_QUEST = 'greenvale_cave_slime';

// Kolik místa nad horním rohem mapy nechat kameře (hlavy postav, střechy).
const CAMERA_TOP_MARGIN = 360;

const DEPTH = {
  ground: -100,
  reference: -50,
  debug: 50000,
  hud: 100000
};

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  preload() {
    // Referenční obrázek načteme jen pro aktuální oblast.
    const reference = loadWorldMap(this.state.region).reference;

    if (reference && !this.textures.exists(reference.key)) {
      this.load.image(reference.key, reference.path);
    }
  }

  init(data) {
    this.state = data?.state ?? SaveSystem.load() ?? SaveSystem.createNew();
    normalizeFishing(this.state);
    normalizeMining(this.state);
    normalizeHerbalism(this.state);
    normalizeCooking(this.state);
    normalizeAlchemy(this.state);
    this.state.region ??= 'Greenvale';
  }

  create() {
    this.mapObjects = []; // objekty mapy pro editor terénu (scéna se znovu používá)
    // Phaser instanci scény znovu používá (návrat ze souboje) – vynulovat stav.
    this.startingBattle = false;
    this.lastEncounterTile = null;
    this.encounterSteps = 0;
    this.encounterThreshold = null;

    this.map = loadWorldMap(this.state.region);
    this.iso = createIsoProjection(this.map.width, this.map.height);

    // Fyzika a kolize běží na logické mřížce (čtverec 64 jednotek na pole).
    this.physics.world.setBounds(0, 0, this.map.width * TILE_SIZE, this.map.height * TILE_SIZE);

    this.createCollisionLayer();
    this.drawGround();
    this.createObjects();
    this.createDecorations();
    this.createBuildings();
    this.createReferenceOverlay();

    const start = this.getStartPosition();
    this.player = new WorldHero(this, this.iso, start.x, start.y, this.state);

    this.physics.add.collider(this.player.mover, this.collisionLayer);
    this.physics.add.collider(this.player.mover, this.buildingBodies);
    this.physics.add.collider(this.player.mover, this.decorBodies);

    // Viditelného hrdinu promítneme až po kroku fyziky.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.player?.syncView());

    this.setupCamera();
    this.setupInput();
    this.createHud();
    this.createDebugOverlay();
    this.setupUiCamera();
    this.setupTerrainEditor();

    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      // Po návratu z interiéru by mohly zůstat "držené" klávesy.
      this.input.keyboard.resetKeys();
      this.tabBar?.resetHover();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('wheel', this.onWheel);
      this.terrainEditor?.destroy();
      this.input.keyboard.off('keydown', this.onEditorKey);
      this.savePosition();
    });
  }

  // Editor terénu (Alt+F8, záměrně není v nápovědě): vložené prvky z grafických listů
  // se vykreslí i při běžném hraní, v editoru je jde vkládat a upravovat.
  // Objekt mapy (ne dlaždice), který jde upravit v editoru terénu.
  trackMapObject(image, id, label) {
    this.mapObjects ??= [];
    this.mapObjects.push(registerMapObject(image, id, label));
    return image;
  }

  setupTerrainEditor() {
    const region = this.state.region || 'Greenvale';
    // Uložené úpravy objektů mapy (posun, velikost, smazání) platí i při hraní.
    applyMapEdits(this.mapObjects ?? [], region);
    const onSprite = (sprite) => this.uiCamera?.ignore(sprite);
    this.editorActive = false;
    this.terrainEditor = new TerrainEditor(this, region, {
      onSprite,
      mapObjects: this.mapObjects ?? [],
      onOpen: () => {
        this.editorActive = true;
        this.player.stop();
        this.prompt.setVisible(false);
        this.cameras.main.stopFollow();
      },
      onClose: () => {
        this.editorActive = false;
        this.cameras.main.startFollow(this.player.view, true, 0.12, 0.12, 0, 40);
      }
    });
    renderPlacements(this, region, onSprite).then((sprites) => this.terrainEditor?.adopt(sprites));
    this.onEditorKey = (event) => {
      if (event.code === 'F8' && event.altKey) {
        event.preventDefault?.();
        this.terrainEditor.toggle();
      }
    };
    this.input.keyboard.on('keydown', this.onEditorKey);
  }

  // V editoru se kamera posouvá po regionu klávesami (hráč stojí).
  updateEditorCamera() {
    const camera = this.cameras.main;
    const step = 14 / camera.zoom;
    const down = (key) => key?.isDown;
    if (down(this.cursors.left) || down(this.wasd.left)) camera.scrollX -= step;
    if (down(this.cursors.right) || down(this.wasd.right)) camera.scrollX += step;
    if (down(this.cursors.up) || down(this.wasd.up)) camera.scrollY -= step;
    if (down(this.cursors.down) || down(this.wasd.down)) camera.scrollY += step;
  }

  // ----------------------------------------------------------------- terén

  // Neviditelná vrstva jen pro kolize na logické mřížce.
  createCollisionLayer() {
    if (!this.textures.exists(TILESET_KEY)) {
      this.textures.createCanvas(TILESET_KEY, TILE_SIZE * TILE_TYPES.length, TILE_SIZE);
    }

    const indices = this.map.tiles.map((row) => row.map((tile) => tile.index));

    this.tilemap = this.make.tilemap({
      data: indices,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE
    });

    const tileset = this.tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);

    this.collisionLayer = this.tilemap.createLayer(0, tileset, 0, 0).setVisible(false);

    const collidingIndices = TILE_TYPES
      .map((tile, index) => (tile.collides ? index : -1))
      .filter((index) => index >= 0);

    this.collisionLayer.setCollision(collidingIndices);
  }

  // Terén z izometrických dlaždic (src/world/terrainTiles.js).
  // Nejdřív voda, potom souš a útesy odzadu dopředu – boky kostek zakryje
  // dlaždice před nimi, stěny útesů leží přes vodu. Kvůli výkonu jsou dlaždice
  // v blocích 16 × 16 polí a vykreslují se jen bloky v záběru kamery.
  drawGround() {
    if (!this.registry.get('terrainTilesReady')) {
      this.drawFlatGround();
      return;
    }

    const CHUNK = 16;
    const chunks = new Map();
    const chunkFor = (pass, cx, cy) => {
      const key = `${pass}:${cx}:${cy}`;
      if (!chunks.has(key)) {
        const base = pass === 'water' ? -400000 : -300000;
        chunks.set(key, {
          layer: this.add.layer().setDepth(base + (cx + cy) * 100 + cx),
          minX: Infinity,
          minY: Infinity,
          maxX: -Infinity,
          maxY: -Infinity
        });
      }
      return chunks.get(key);
    };

    const overlay = this.add.graphics().setDepth(DEPTH.ground);

    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const tile = this.map.tiles[y][x];
        const type = this.groundTypeAt(x, y);
        const placement = terrainPlacement(type, pickTerrainVariant(type, tileHash(x * 3 + 1, y * 5 + 2)), ISO_TILE_WIDTH);
        const center = this.iso.toScreen((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE);
        const chunk = chunkFor(type === 'water' ? 'water' : 'land', Math.floor(x / CHUNK), Math.floor(y / CHUNK));

        const image = this.add.image(center.x, center.y, placement.key)
          .setOrigin(placement.originX, placement.originY)
          .setScale(placement.scale)
          .setDepth(x + y + x * 0.001);
        chunk.layer.add(image);

        const bounds = image.getBounds();
        chunk.minX = Math.min(chunk.minX, bounds.x);
        chunk.minY = Math.min(chunk.minY, bounds.y);
        chunk.maxX = Math.max(chunk.maxX, bounds.right);
        chunk.maxY = Math.max(chunk.maxY, bounds.bottom);

        // Most, molo, vodopád a základní terény ostatních regionů (písek, sníh, láva…)
        // zatím jako plochá pole přes terén; jemné stínování podle pole.
        const flat = tile.flat || (this.map.generated && tile.id === 'cliff');
        if (['bridge', 'dock', 'waterfall'].includes(tile.id) || flat) {
          this.drawFlatTile(overlay, x, y, tile, flat ? 0.9 + tileHash(x * 7 + 3, y * 11 + 5) * 0.14 : 1);
        }
      }
    }

    this.groundChunks = [...chunks.values()];
  }

  // Typ dlaždice terénu pro pole. Strom a skála dostanou podklad podle okolí,
  // most, molo a vodopád stojí na vodě, jeskyně ve skále.
  groundTypeAt(x, y) {
    const id = this.tileAt(x, y)?.id;

    if (id === 'tree' || id === 'spruce' || id === 'rock') {
      let meadow = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) if (this.tileAt(x + dx, y + dy)?.id === 'meadow') meadow++;
      }
      return meadow >= 3 ? 'meadow' : 'grass';
    }

    if (id === 'bridge' || id === 'dock' || id === 'waterfall') return 'water';
    if (id === 'cave') return 'cliff';
    // Generované regiony: základní terény i útesy jako ploché pole (podklad hlína).
    if (this.tileAt(x, y)?.flat || (this.map.generated && id === 'cliff')) return 'plot';
    return ['grass', 'meadow', 'plot', 'path', 'plaza', 'water', 'cliff'].includes(id) ? id : 'grass';
  }

  // Skryje bloky terénu mimo záběr kamery.
  cullGround() {
    if (!this.groundChunks) return;

    const view = this.cameras.main.worldView;
    const margin = 128;

    for (const chunk of this.groundChunks) {
      chunk.layer.setVisible(
        chunk.maxX >= view.x - margin &&
        chunk.minX <= view.right + margin &&
        chunk.maxY >= view.y - margin &&
        chunk.minY <= view.bottom + margin
      );
    }
  }

  // Záloha: pole jako kosočtverce plochých barev.
  drawFlatGround() {
    const g = this.add.graphics().setDepth(DEPTH.ground);

    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        this.drawFlatTile(g, x, y, this.map.tiles[y][x], (x + y) % 2 === 0 ? 1 : 0.94);
      }
    }
  }

  drawFlatTile(g, x, y, tile, shade = 1) {
    const diamond = this.iso.tileDiamond(x, y);
    g.fillStyle(scaleColor(tile.color, shade), 1);
    g.fillPoints(diamond, true);

    // Molo: prkna napříč polem.
    if (tile.id === 'dock') {
      const [n, e, s, w] = diamond;
      g.lineStyle(2, 0x5c4128, 0.85);
      for (const t of [0.25, 0.5, 0.75]) {
        g.lineBetween(n.x + (w.x - n.x) * t, n.y + (w.y - n.y) * t, e.x + (s.x - e.x) * t, e.y + (s.y - e.y) * t);
      }
    }
  }

  // Stromy a skály z obrázku objektů. Varianta, velikost a zrcadlení se volí
  // podle souřadnic pole, takže mapa vypadá pokaždé stejně.
  // Stromy různých velikostí: velikost se volí podle pole (mapa vypadá pokaždé stejně).
  createObjects() {
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const tile = this.map.tiles[y][x];
        const variants = tile.object ? OBJECT_VARIANTS[tile.object] : null;
        if (!variants) continue;

        const roll = tileHash(x, y);
        const index = Math.floor(roll * variants.length) % variants.length;
        const key = objectTextureKey(tile.object, index);
        if (!this.textures.exists(key)) continue;

        const center = this.iso.toScreen((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE);
        const baseY = center.y + 14;
        const jitter = (tileHash(y, x) - 0.5) * 16;
        const size = tileHash(x + 7, y + 3);

        let scale = 0.9 + size * 0.2;
        if (tile.object === 'tree') scale = 0.7 + size * 0.65; // 0,7× až 1,35×
        if (tile.object === 'spruce') scale = (index >= 2 ? 1.3 : 0.95) + size * 0.55;

        this.trackMapObject(this.add.image(center.x + jitter, baseY, key)
          .setOrigin(0.5, 1)
          .setScale(SHEET_SCALE * scale * OBJECT_SCALE)
          .setFlipX(tile.object !== 'rock' && roll < 0.5)
          .setDepth(baseY), `obj-${x},${y}`, `${OBJECT_LABELS[tile.object] ?? tile.object} (${x}, ${y})`);
      }
    }
  }

  // Doplňky ze seznamu `decor` v mapě (ploty, keře, rostliny, pařezy, rozcestník)
  // a jeskyně. Kolizi mají jen ploty – tenké zdi na hraně pole.
  createDecorations() {
    this.decorBodies = this.physics.add.staticGroup();

    for (const [decorIndex, [type, x, y, extra]] of (this.map.decor ?? []).entries()) {
      const screen = this.iso.toScreen(x * TILE_SIZE, y * TILE_SIZE);
      const roll = tileHash(Math.round(x * 10), Math.round(y * 10));

      if (type === 'fence') {
        const kind = extra === 'x' ? 'fenceX' : 'fenceY';
        const index = Math.floor(roll * OBJECT_VARIANTS[kind].length);
        const key = objectTextureKey(kind, index);
        if (this.textures.exists(key)) {
          this.trackMapObject(this.add.image(screen.x, screen.y, key)
            .setOrigin(0.5, 0.84)
            .setScale(SHEET_SCALE)
            .setDepth(screen.y), `decor-${decorIndex}`, `Plot (${x}, ${y})`);
        }

        const long = TILE_SIZE;
        const thin = 10;
        this.decorBodies.add(
          this.add.zone(x * TILE_SIZE, y * TILE_SIZE, extra === 'x' ? long : thin, extra === 'x' ? thin : long)
        );
        continue;
      }

      const variants = OBJECT_VARIANTS[type];
      if (!variants) continue;
      const index = Math.min(variants.length - 1, Math.max(0, Number(extra) || 0));
      const key = objectTextureKey(type, index);
      if (!this.textures.exists(key)) continue;

      const scale = type === 'signpost' ? 1 : (0.8 + roll * 0.35) * DECOR_SCALE;
      this.trackMapObject(this.add.image(screen.x, screen.y, key)
        .setOrigin(0.5, 0.9)
        .setScale(SHEET_SCALE * scale)
        .setFlipX(type !== 'signpost' && roll < 0.5)
        .setDepth(screen.y), `decor-${decorIndex}`, `${OBJECT_LABELS[type] ?? type} (${x}, ${y})`);
    }

    this.createCave();
    this.createNpcMarkers();
    this.createFishingMarkers();
    this.createMiningMarkers();
    this.createHerbMarkers();
  }

  // Rybářská místa: modrý kruh na vodě u břehu, název ukáže výzva „E: rybařit“.
  createFishingMarkers() {
    this.fishingSpots = (this.map.fishingSpots ?? [])
      .map((spot) => ({ ...spot, info: locationById(spot.location) }))
      .filter((spot) => spot.info);
    for (const spot of this.fishingSpots) {
      const p = this.iso.toScreen((spot.x + 0.5) * TILE_SIZE, (spot.y + 0.5) * TILE_SIZE);
      const g = this.add.graphics().setDepth(p.y - 1);
      g.lineStyle(3, 0x7fd0ff, 0.95).strokeEllipse(p.x, p.y, 54, 26);
      g.fillStyle(0x7fd0ff, 0.22).fillEllipse(p.x, p.y, 54, 26);
    }
  }

  findNearbyFishingSpot() {
    let best = null;
    let bestDistance = FISHING_REACH;
    for (const spot of this.fishingSpots ?? []) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, (spot.x + 0.5) * TILE_SIZE, (spot.y + 0.5) * TILE_SIZE);
      if (d < bestDistance) {
        best = spot;
        bestDistance = d;
      }
    }
    return best;
  }

  // Naleziště Těžby: hnědý kruh (speciální fialový), vytěžené šedé. Skrytá žíla a meteorit
  // mají vlastní místo na mapě a ukážou se, jen když jsou aktivní.
  createMiningMarkers() {
    const region = this.state.region || 'Greenvale';
    const makeSpot = (spot, extra = {}) => {
      const p = this.iso.toScreen((spot.x + 0.5) * TILE_SIZE, (spot.y + 0.5) * TILE_SIZE);
      // Nad korunami stromů z jižních polí, aby značka nezmizela v lese.
      return { ...spot, ...extra, screen: p, graphics: this.add.graphics().setDepth(p.y + 150) };
    };
    this.miningSpots = (this.map.miningSpots ?? [])
      .map((spot) => ({ ...spot, info: depositById(spot.deposit) }))
      .filter((spot) => spot.info)
      .map((spot) => makeSpot(spot));
    if (this.map.hiddenVeinSpot) this.miningSpots.push(makeSpot(this.map.hiddenVeinSpot, { kind: 'hidden' }));
    if (this.map.meteorSpot) this.miningSpots.push(makeSpot(this.map.meteorSpot, { kind: 'meteor', info: depositById('S4') }));
    this.miningRegion = region;
    this.refreshMiningMarkers();
  }

  // Aktuální stav místa: null = není vidět (Skrytá žíla / meteorit neaktivní).
  miningSpotState(spot, now = Date.now()) {
    if (spot.kind === 'hidden') {
      const hidden = activeHidden(this.state, now);
      if (!hidden || hidden.region !== this.miningRegion) return null;
      return { info: depositById(hidden.deposit), ready: true, hidden: true };
    }
    if (spot.kind === 'meteor') {
      const meteor = currentMeteor(this.state, now);
      if (!meteor || meteor.region !== this.miningRegion) return null;
      return { info: spot.info, ready: true };
    }
    const status = depositStatus(this.state, spot.info, now);
    return { info: spot.info, ready: status.ready, until: status.until };
  }

  refreshMiningMarkers() {
    const now = Date.now();
    const dowsing = exploreBonus(this.state, 'dowsing', 0) > 0; // Proutkařův olej
    for (const spot of this.miningSpots ?? []) {
      const g = spot.graphics.clear();
      const st = this.miningSpotState(spot, now);
      if (!st) continue;
      const { x, y } = spot.screen;
      const color = st.hidden || spot.kind === 'meteor' ? 0xffd76a : st.info.special ? 0xc48bff : 0xffa94d;
      if (!st.ready) {
        g.lineStyle(2, 0x6b6258, 0.8).strokeEllipse(x, y, 46, 22);
        g.fillStyle(0x3a332c, 0.35).fillEllipse(x, y, 46, 22);
        continue;
      }
      if (dowsing || st.hidden || spot.kind === 'meteor') g.fillStyle(color, 0.25).fillEllipse(x, y, 72, 34);
      g.lineStyle(4, 0x2a1d13, 0.6).strokeEllipse(x, y, 54, 27);
      g.lineStyle(3, color, 1).strokeEllipse(x, y, 50, 24);
      g.fillStyle(color, 0.45).fillEllipse(x, y, 50, 24);
      g.lineStyle(3, 0x2a1d13, 0.9).lineBetween(x - 8, y + 5, x + 8, y - 7); // násada krumpáče
      g.lineStyle(3, 0xe8e0cc, 0.9).lineBetween(x + 1, y - 10, x + 13, y - 3);
    }
  }

  findNearbyMiningSpot() {
    let best = null;
    let bestDistance = MINING_REACH;
    for (const spot of this.miningSpots ?? []) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, (spot.x + 0.5) * TILE_SIZE, (spot.y + 0.5) * TILE_SIZE);
      if (d >= bestDistance) continue;
      const st = this.miningSpotState(spot);
      if (!st) continue;
      best = { ...spot, ...st };
      bestDistance = d;
    }
    return best;
  }

  miningPrompt(spot) {
    const name = spot.hidden ? `Skrytá žíla – ${spot.info.name}` : spot.info.name;
    const wait = spot.ready ? '' : ` – vytěženo, obnova za ${formatWait(spot.until - Date.now())}`;
    return `E: těžit – ${name} (Těžba ${spot.info.minLevel}+)${wait}`;
  }

  openMining(spot) {
    this.player.stop();
    this.prompt.setVisible(false);
    this.savePosition();
    this.scene.pause();
    this.scene.launch('Mining', { state: this.state, returnScene: this.scene.key, depositId: spot.info.id, hidden: Boolean(spot.hidden), region: this.miningRegion });
    this.scene.bringToTop('Mining');
  }

  // Naleziště Sběru bylin: zelený kruh s lístkem (speciální fialový, záhon statku žlutozelený),
  // sebrané šedé. Skryté lesní naleziště se ukáže jen po Botanickém zápisu.
  createHerbMarkers() {
    this.herbSpots = (this.map.herbSpots ?? [])
      .map((spot) => ({ ...spot, info: herbSiteById(spot.site) }))
      .filter((spot) => spot.info)
      .map((spot) => {
        const p = this.iso.toScreen((spot.x + 0.5) * TILE_SIZE, (spot.y + 0.5) * TILE_SIZE);
        return { ...spot, screen: p, graphics: this.add.graphics().setDepth(p.y + 150) };
      });
    this.refreshHerbMarkers();
  }

  herbSpotState(spot, now = Date.now()) {
    if (spot.info.special === 'hidden' && !activeHiddenHerbs(this.state, now)) return null;
    const status = herbSiteStatus(this.state, spot.info, now);
    return { info: spot.info, ready: status.ready, until: status.until };
  }

  refreshHerbMarkers() {
    const now = Date.now();
    for (const spot of this.herbSpots ?? []) {
      const g = spot.graphics.clear();
      const st = this.herbSpotState(spot, now);
      if (!st) continue;
      const { x, y } = spot.screen;
      if (!st.ready) {
        g.lineStyle(2, 0x5f6b58, 0.8).strokeEllipse(x, y, 46, 22);
        g.fillStyle(0x2e3a2a, 0.35).fillEllipse(x, y, 46, 22);
        continue;
      }
      // Sytá barva a tmavý okraj, aby kruh na světlé trávě nesplýval.
      const color = st.info.special ? 0xa86bff : st.info.cultivated ? 0xe0c23a : 0x2fb84a;
      g.lineStyle(5, 0x0d1f0a, 0.85).strokeEllipse(x, y, 56, 28);
      g.fillStyle(color, 0.6).fillEllipse(x, y, 52, 25);
      g.lineStyle(2, 0xf2ffe0, 0.9).strokeEllipse(x, y, 50, 24);
      // Lístek s žilkou.
      g.fillStyle(0x0f4a12, 1).fillEllipse(x + 1, y - 3, 22, 11);
      g.lineStyle(2, 0xd8f5b0, 1).lineBetween(x - 10, y + 2, x + 11, y - 7);
    }
  }

  findNearbyHerbSpot() {
    let best = null;
    let bestDistance = HERB_REACH;
    for (const spot of this.herbSpots ?? []) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, (spot.x + 0.5) * TILE_SIZE, (spot.y + 0.5) * TILE_SIZE);
      if (d >= bestDistance) continue;
      const st = this.herbSpotState(spot);
      if (!st) continue;
      best = { ...spot, ...st };
      bestDistance = d;
    }
    return best;
  }

  herbPrompt(spot) {
    const info = spot.info;
    const name = info.special ? info.name : `${info.name} – ${HERB_BY_ID[siteMain(this.state, info)]?.name ?? ''}`;
    const wait = spot.ready ? '' : ` – sebráno, obnova za ${formatHerbWait(spot.until - Date.now())}`;
    return `E: sbírat – ${name} (Sběr bylin ${info.minLevel}+)${wait}`;
  }

  openHerbalism(spot) {
    this.player.stop();
    this.prompt.setVisible(false);
    this.savePosition();
    this.scene.pause();
    this.scene.launch('Herbalism', { state: this.state, returnScene: this.scene.key, siteId: spot.info.id, region: this.state.region || 'Greenvale' });
    this.scene.bringToTop('Herbalism');
  }

  // Ohniště (Vaření): kdekoli mimo města za 1× Dřevo, otevře okno Vaření.
  makeCampfire() {
    const tx = Math.floor(this.player.x / TILE_SIZE);
    const ty = Math.floor(this.player.y / TILE_SIZE);
    const inTown = (this.map.towns ?? []).some((t) => tx >= t.x - 4 && ty >= t.y - 4 && tx < t.x + t.width + 4 && ty < t.y + t.height + 4);
    if (inTown) {
      this.showWorldMessage('Ve městě oheň rozdělat nejde – vař u sporáku nebo v hostinci.');
      return;
    }
    if (getItemCount(this.state, 'wood') < 1) {
      this.showWorldMessage('Na ohniště potřebuješ 1× Dřevo (drop z dřevěných monster, prodávají obchodníci).');
      return;
    }
    // Dřevo se spotřebuje až s prvním uvařeným receptem (fuel), ne při rozdělání ohně.
    this.player.stop();
    this.prompt.setVisible(false);
    this.savePosition();
    this.scene.pause();
    this.scene.launch('Cooking', { state: this.state, returnScene: this.scene.key, station: 1, fuel: 'wood' });
    this.scene.bringToTop('Cooking');
  }

  openFishing(spot) {
    this.player.stop();
    this.prompt.setVisible(false);
    this.savePosition();
    this.scene.pause();
    this.scene.launch('Fishing', { state: this.state, returnScene: this.scene.key, locationId: spot.location });
    this.scene.bringToTop('Fishing');
  }

  // Připravená místa pro NPC v regionech (role a postavy doplníme): zlatý kruh a popisek.
  createNpcMarkers() {
    for (const npc of this.map.npcs ?? []) {
      const p = this.iso.toScreen((npc.x + 0.5) * TILE_SIZE, (npc.y + 0.5) * TILE_SIZE);
      const g = this.add.graphics().setDepth(p.y);
      g.lineStyle(3, 0xffd76a, 0.9).strokeEllipse(p.x, p.y, 70, 34);
      g.fillStyle(0xffd76a, 0.18).fillEllipse(p.x, p.y, 70, 34);
      this.add.text(p.x, p.y - 30, `NPC: ${npc.label}`, {
        fontSize: '18px', color: '#fff1c6', backgroundColor: '#2a1a10cc', padding: { x: 6, y: 3 }
      }).setOrigin(0.5, 1).setDepth(p.y + 1);
    }
  }

  // Jeskyně: obrázek vchodu na poli C, ústím k jihovýchodu (ke kameře).
  createCave() {
    const key = objectTextureKey('cave', 0);
    this.caveSpots = [];

    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (this.map.tiles[y][x].id !== 'cave') continue;
        // Vchod do jeskyně (úkol Jeskynní sliz).
        this.caveSpots.push({ x: (x + 0.5) * TILE_SIZE, y: (y + 0.5) * TILE_SIZE });
        if (!this.textures.exists(key)) continue;

        const front = this.iso.toScreen((x + 0.85) * TILE_SIZE, (y + 0.85) * TILE_SIZE);
        this.trackMapObject(this.add.image(front.x, front.y, key)
          .setOrigin(0.5, 0.95)
          .setScale(SHEET_SCALE * 1.35)
          .setDepth(front.y), `cave-${x},${y}`, `Jeskyně (${x}, ${y})`);
      }
    }
  }

  tileAt(tileX, tileY) {
    return this.map.tiles[tileY]?.[tileX] ?? null;
  }

  isBlocked(worldX, worldY) {
    const tile = this.tileAt(
      Math.floor(worldX / TILE_SIZE),
      Math.floor(worldY / TILE_SIZE)
    );

    if (!tile || tile.collides) return true;

    return this.map.buildings.some((building) =>
      worldX >= building.x * TILE_SIZE &&
      worldX < (building.x + building.width) * TILE_SIZE &&
      worldY >= building.y * TILE_SIZE &&
      worldY < (building.y + building.height) * TILE_SIZE
    );
  }

  // ----------------------------------------------------------------- budovy

  // Budova = obrázek, jehož spodní okraj leží na předním (jihovýchodním) rohu
  // půdorysu. Do hloubky se řadí podle středu půdorysu, takže hrdina před
  // budovou je vidět a za ní se schová.
  createBuildings() {
    this.buildingBodies = this.physics.add.staticGroup();
    this.doors = [];

    for (const building of this.map.buildings) {
      const corners = this.iso.rectDiamond(building.x, building.y, building.width, building.height);
      const [north, east, south, west] = corners;
      const centerX = (west.x + east.x) / 2;
      const footprintWidth = east.x - west.x;
      const center = this.iso.toScreen(
        (building.x + building.width / 2) * TILE_SIZE,
        (building.y + building.height / 2) * TILE_SIZE
      );

      const sprite = BUILDING_SPRITES[building.id];
      const key = buildingTextureKey(building.id);

      if (sprite && this.textures.exists(key)) {
        const image = this.add.image(centerX, south.y + sprite.offsetY, key).setOrigin(0.5, 1);
        image.setScale(sprite.pixelScale ?? (footprintWidth * sprite.scale) / image.width).setDepth(center.y);
        if (sprite.flipX) image.setFlipX(true);
        this.trackMapObject(image, `building-${building.id}`, building.name);
      } else {
        // Budova bez grafiky: kosodélník s názvem.
        this.add.graphics()
          .setDepth(center.y)
          .fillStyle(0x8a6a4a, 1)
          .fillPoints(corners, true)
          .lineStyle(3, 0x3a2418, 1)
          .strokePoints(corners, true);

        this.add.text(center.x, center.y, building.name, {
          fontSize: '22px',
          color: '#fff4d6',
          stroke: '#2a1a10',
          strokeThickness: 4
        })
          .setOrigin(0.5)
          .setDepth(center.y + 1);
      }

      // Kolize na logické mřížce.
      const width = building.width * TILE_SIZE;
      const height = building.height * TILE_SIZE;
      const body = this.add.zone(
        building.x * TILE_SIZE + width / 2,
        building.y * TILE_SIZE + height / 2,
        width,
        height
      );
      this.buildingBodies.add(body);

      // Budovy bez interiéru (kostel, mlýn, kašna…) nemají dveře.
      if (!building.door) continue;
      this.doors.push({
        building,
        x: (building.door.x + 0.5) * TILE_SIZE,
        y: (building.door.y + 0.5) * TILE_SIZE
      });
    }
  }

  findNearbyDoor() {
    let best = null;
    let bestDistance = DOOR_REACH;

    for (const door of this.doors) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, door.x, door.y);

      if (distance < bestDistance) {
        best = door;
        bestDistance = distance;
      }
    }

    return best;
  }

  // ---------------------------------------------------- brány mezi regiony

  findNearbyGate() {
    return (this.map.exits ?? []).find((exit) =>
      Phaser.Math.Distance.Between(this.player.x, this.player.y, (exit.x + 0.5) * TILE_SIZE, (exit.y + 0.5) * TILE_SIZE) < TILE_SIZE * 1.3
    ) ?? null;
  }

  gatePrompt(gate) {
    return canTravelToRegion(this.state, gate.to)
      ? `E: cesta do oblasti ${gate.to}`
      : `${gate.to} – cesta je zatím uzavřená`;
  }

  // Přechod do sousedního regionu: svět se načte znovu a hráč stojí u brány zpět.
  travelThrough(gate) {
    if (!canTravelToRegion(this.state, gate.to)) {
      this.showWorldMessage(
        isRegionUnlocked(this.state, gate.to)
          ? `Do oblasti ${gate.to} se odsud nedá projít.`
          : `Cesta do oblasti ${gate.to} je zatím uzavřená.`
      );
      return;
    }
    this.player.stop();
    const from = this.state.region;
    this.state.region = gate.to;
    this.state.arrivalFrom = from;
    SaveSystem.save(this.state);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart({ state: this.state }));
  }

  findNearbyCave() {
    // Jeskyně se slizem je jen v Greenvale.
    if ((this.state.region || 'Greenvale') !== 'Greenvale') return null;
    return (this.caveSpots ?? []).find(
      (spot) => Phaser.Math.Distance.Between(this.player.x, this.player.y, spot.x, spot.y) < CAVE_REACH
    ) ?? null;
  }

  cavePrompt() {
    const status = getQuestStatus(this.state, CAVE_QUEST);
    if (status === QUEST_STATUS.active) return 'E: vstoupit do jeskyně – Jeskynní sliz';
    return 'E: prohlédnout jeskyni';
  }

  // Jeskyně: s přijatým úkolem souboj s jeskynním slizem, jinak jen hláška.
  enterCave() {
    const status = getQuestStatus(this.state, CAVE_QUEST);
    if (status === QUEST_STATUS.active) {
      const ready = (this.state.party ?? []).some((monster) => monster.currentHp > 0);
      if (!ready) {
        this.showWorldMessage('Tvoje monstra jsou vyčerpaná. Nech je vyléčit u Liory v hostinci.');
        return;
      }
      this.startBattle({ type: 'greenvale_cave_boss', backdrop: 'greenvale_meadow' });
      return;
    }
    this.showWorldMessage(
      status === QUEST_STATUS.notStarted
        ? 'Z jeskyně je cítit vlhko a slyšíš mlaskání. Starosta Edric na radnici o ní něco ví.'
        : 'Jeskyně je tichá. Jeskynní sliz je mrtvý.'
    );
  }

  showWorldMessage(text) {
    this.worldMessage?.destroy();
    this.worldMessage = uiToast(this, text, { y: this.scale.height - 120, depth: DEPTH.hud });
  }

  enterBuilding(door) {
    this.player.stop();
    this.savePosition();

    this.scene.pause();
    this.scene.launch('Interior', {
      state: this.state,
      interiorId: door.building.id,
      fromWorld: true
    });
  }

  // ---------------------------------------------------------- pozice hráče

  getStartPosition() {
    const spawn = {
      x: (this.map.spawn.x + 0.5) * TILE_SIZE,
      y: (this.map.spawn.y + 0.5) * TILE_SIZE
    };

    // Příchod z jiného regionu: hráč stojí kousek od brány, kterou přišel.
    const arrivalFrom = this.state.arrivalFrom;
    delete this.state.arrivalFrom;
    const arrivalGate = arrivalFrom && (this.map.exits ?? []).find((exit) => exit.to === arrivalFrom);
    if (arrivalGate) {
      this.state.worldLayoutVersion = WORLD_LAYOUT_VERSION;
      // O dvě pole směrem ke středu mapy.
      const sx = Math.sign(this.map.width / 2 - arrivalGate.x);
      const sy = Math.sign(this.map.height / 2 - arrivalGate.y);
      return {
        x: (arrivalGate.x + sx * 2 + 0.5) * TILE_SIZE,
        y: (arrivalGate.y + sy * 2 + 0.5) * TILE_SIZE
      };
    }

    // Odchod z interiéru: hráč stojí na poli dveří budovy.
    const exitDoor = this.state.exitDoor;
    delete this.state.exitDoor;
    const exitBuilding = exitDoor && this.map.buildings.find((building) => building.id === exitDoor && building.door);
    if (exitBuilding) {
      this.state.worldLayoutVersion = WORLD_LAYOUT_VERSION;
      return {
        x: (exitBuilding.door.x + 0.5) * TILE_SIZE,
        y: (exitBuilding.door.y + 0.5) * TILE_SIZE
      };
    }

    if (this.state.worldLayoutVersion !== WORLD_LAYOUT_VERSION) {
      this.state.worldLayoutVersion = WORLD_LAYOUT_VERSION;
      return spawn;
    }

    const { x, y } = this.state;

    if (!Number.isFinite(x) || !Number.isFinite(y) || this.isBlocked(x, y)) {
      return spawn;
    }

    return { x, y };
  }

  savePosition() {
    if (!this.player) return;

    this.state.x = this.player.x;
    this.state.y = this.player.y;
    SaveSystem.save(this.state);
  }

  // ------------------------------------------------------ kamera a ovládání

  setupCamera() {
    const camera = this.cameras.main;

    camera.setBounds(0, -CAMERA_TOP_MARGIN, this.iso.width, this.iso.height + CAMERA_TOP_MARGIN);
    camera.setZoom(1);
    camera.startFollow(this.player.view, true, 0.12, 0.12, 0, 40);

    this.onWheel = (_pointer, _objects, _dx, dy) => {
      if (this.cardOpen()) return; // kolečko patří kartě
      const zoom = Phaser.Math.Clamp(camera.zoom + (dy < 0 ? 0.1 : -0.1), 0.4, 2);
      camera.setZoom(zoom);
    };

    this.input.on('wheel', this.onWheel);
  }

  setupInput() {
    const keyboard = this.input.keyboard;
    const Keys = Phaser.Input.Keyboard.KeyCodes;

    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys({
      up: Keys.W,
      down: Keys.S,
      left: Keys.A,
      right: Keys.D
    });

    this.keys = keyboard.addKeys({
      menu: Keys.ESC,
      interact: Keys.E,
      debug: Keys.G,
      reference: Keys.R,
      heroCard: Keys.C,
      talents: Keys.T,
      party: Keys.P,
      inventory: Keys.I,
      worldMap: Keys.M,
      cook: Keys.V,
      testBattle: Keys.B
    });
  }

  // Náhodná setkání: jen na tmavé louce (zóna setkání). Po každém setkání
  // se vylosuje, po kolika nových polích louky přijde další.
  checkEncounter() {
    const tileX = Math.floor(this.player.x / TILE_SIZE);
    const tileY = Math.floor(this.player.y / TILE_SIZE);
    const key = `${tileX},${tileY}`;
    if (key === this.lastEncounterTile) return false;
    this.lastEncounterTile = key;
    // Jídlo s průzkumným bonusem: +HP monstrům každých 50 kroků.
    if (mealExploreStep(this.state)) this.showWorldMessage?.('Najedená monstra nabrala síly na cestě.');

    // Setkání jen na louce v Greenvale (ostatní regiony zatím bez náhodných setkání).
    if ((this.state.region || 'Greenvale') !== 'Greenvale') return false;
    if (!this.tileAt(tileX, tileY)?.encounter) return false;

    // Alchymie: odpuzovač / lákadlo / neviditelnost mění četnost setkání.
    const encounterBonus = exploreBonus(this.state, 'encounters');
    if (encounterBonus <= -1) return false;
    this.encounterSteps = (this.encounterSteps ?? 0) + 1;
    this.encounterThreshold ??= Phaser.Math.Between(ENCOUNTER_STEPS.min, ENCOUNTER_STEPS.max);
    if (this.encounterSteps < this.encounterThreshold / (1 + encounterBonus)) return false;

    const ready = (this.state.party ?? []).some((monster) => monster.currentHp > 0);
    if (!ready) return false;

    this.startBattle({ type: 'wild', backdrop: 'greenvale_meadow' });
    return true;
  }

  startBattle(encounter) {
    if (this.startingBattle) return;
    this.startingBattle = true;
    this.encounterSteps = 0;
    this.encounterThreshold = null;
    this.player.stop();
    this.prompt.setVisible(false);
    this.savePosition();

    this.cameras.main.flash(180, 255, 255, 255);
    this.cameras.main.fadeOut(420, 4, 8, 12);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Battle', { state: this.state, encounter });
    });
  }

  // Karta hrdiny (C): svět se pozastaví, hrdina se zastaví na místě.
  openHeroCard() {
    this.openCard('Hero');
  }

  // Karta přes svět: svět běží dál a hrdina jde ovládat i s otevřenou kartou (pohyb pod kartou,
  // ostatní akce světa čekají, viz update – cardOpen).
  openCard(sceneKey, initialTab = undefined, extra = {}) {
    this.player.stop();
    this.prompt.setVisible(false);
    this.savePosition();
    // animateIn: první karta ze světa vyjede zpod lišty (přepínání mezi kartami bez animace).
    this.scene.launch(sceneKey, { state: this.state, returnScene: this.scene.key, initialTab, animateIn: true, ...extra });
    this.scene.bringToTop(sceneKey);
  }

  // Rozhraní má vlastní kameru, aby se nezoomovalo se světem.
  setupUiCamera() {
    const hud = [...(this.tabBar?.objects ?? []), this.debugInfo];

    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.ignore(this.children.list.filter((object) => !hud.includes(object)));
    this.cameras.main.ignore(hud);
  }

  createHud() {
    // Místo nápovědy horní lišta karet (stejná jako na kartách): klid, zlatá pod myší;
    // ve světě není žádná karta zobrazená, kliknutí kartu otevře.
    this.tabBar = createCardTabBar(this, null, {
      state: this.state,
      onSelect: (tabId, sceneKey) => this.openCard(sceneKey, CARD_FOR_TAB[tabId] ? undefined : tabId)
    });

    // Výzva „E: …“ nad hrdinou – panel nové sady UI (ui/fantasyCard.js).
    this.prompt = uiPrompt(this, { size: 20, depth: DEPTH.hud });
  }

  // ------------------------------------------------- reference a ladění

  createReferenceOverlay() {
    const reference = this.map.reference;

    if (!reference || !this.textures.exists(reference.key)) {
      this.referenceImage = null;
      return;
    }

    // Obrázek leží uprostřed izometrického kosočtverce mapy, široký reference.width px
    // (stejně ho umisťuje skript tools/map-from-reference.ps1).
    const source = this.textures.get(reference.key).getSourceImage();
    const width = reference.width ?? this.iso.width;
    const height = (width * source.height) / source.width;

    this.referenceImage = this.add.image(
      reference.x ?? this.iso.width / 2,
      reference.y ?? this.iso.height / 2,
      reference.key
    )
      .setOrigin(0.5, 0.5)
      .setDisplaySize(width, height)
      .setAlpha(0.45)
      .setDepth(DEPTH.reference)
      .setVisible(false);
  }

  createDebugOverlay() {
    const g = this.add.graphics().setDepth(DEPTH.debug).setVisible(false);

    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const diamond = this.iso.tileDiamond(x, y);

        if (this.map.tiles[y][x].collides) {
          g.fillStyle(0xff3030, 0.28).fillPoints(diamond, true);
        }

        g.lineStyle(1, 0x000000, 0.3).strokePoints(diamond, true);
      }
    }

    for (const building of this.map.buildings) {
      g.fillStyle(0x3070ff, 0.3).fillPoints(
        this.iso.rectDiamond(building.x, building.y, building.width, building.height),
        true
      );
      if (building.door) {
        g.fillStyle(0xffd040, 0.55).fillPoints(
          this.iso.tileDiamond(building.door.x, building.door.y),
          true
        );
      }
    }

    for (const point of this.map.points ?? []) {
      const center = this.iso.toScreen((point.x + 0.5) * TILE_SIZE, (point.y + 0.5) * TILE_SIZE);
      g.lineStyle(4, 0xff40ff, 0.9).strokeEllipse(center.x, center.y, 70, 35);
    }

    // Popisky souřadnic po 5 polích.
    const labels = [];
    for (let y = 0; y < this.map.height; y += 5) {
      for (let x = 0; x < this.map.width; x += 5) {
        const center = this.iso.toScreen((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE);
        labels.push(
          this.add.text(center.x, center.y, `${x},${y}`, {
            fontSize: '13px',
            color: '#ffffff',
            backgroundColor: '#00000088'
          })
            .setOrigin(0.5)
            .setDepth(DEPTH.debug)
        );
      }
    }

    this.hoverOutline = this.add.graphics().setDepth(DEPTH.debug + 1);

    this.debugInfo = this.add.text(24, 64, '', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 6 }
    })
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);

    this.debugObjects = [g, this.hoverOutline, this.debugInfo, ...labels];
    this.setDebugVisible(false);
  }

  setDebugVisible(visible) {
    this.debugVisible = visible;
    this.debugObjects.forEach((object) => object.setVisible(visible));
  }

  updateDebugInfo() {
    if (!this.debugVisible) return;

    const pointer = this.input.activePointer;
    const screen = pointer.positionToCamera(this.cameras.main);
    const logical = this.iso.toLogical(screen.x, screen.y);
    const tileX = Math.floor(logical.x / TILE_SIZE);
    const tileY = Math.floor(logical.y / TILE_SIZE);
    const tile = this.tileAt(tileX, tileY);

    const playerTileX = Math.floor(this.player.x / TILE_SIZE);
    const playerTileY = Math.floor(this.player.y / TILE_SIZE);

    this.hoverOutline.clear();

    if (tile) {
      this.hoverOutline.lineStyle(3, 0xffffff, 1).strokePoints(this.iso.tileDiamond(tileX, tileY), true);
    }

    // Kolizní plocha hrdiny (nohy) promítnutá do izometrie.
    const body = this.player.mover.body;
    const feet = [
      this.iso.toScreen(body.x, body.y),
      this.iso.toScreen(body.right, body.y),
      this.iso.toScreen(body.right, body.bottom),
      this.iso.toScreen(body.x, body.bottom)
    ];
    this.hoverOutline.lineStyle(2, 0x40ff80, 1).strokePoints(feet, true);

    this.debugInfo.setText(
      tile
        ? `Myš: pole ${tileX},${tileY}  "${tile.char}" ${tile.name}${tile.collides ? ' (kolize)' : ''}\n` +
          `Hráč: pole ${playerTileX},${playerTileY}`
        : `Hráč: pole ${playerTileX},${playerTileY}`
    );
  }

  // ------------------------------------------------------------- smyčka

// ------------------------------------------------- sledovaný úkol (tečky)

  // Cílové pole sledovaného úkolu v této oblasti (dveře budovy, vchod do jeskyně), jinak null.
  questTrailTarget() {
    const questId = trackedQuest(this.state);
    if (!questId) return null;
    const target = questTarget(this.state, questId);
    if (!target || target.region !== (this.state.region || 'Greenvale')) return null;
    if (target.type === 'building') {
      const building = this.map.buildings.find((b) => b.id === target.id);
      const cell = building?.door ?? (building ? { x: building.x + Math.floor(building.width / 2), y: building.y + building.height } : null);
      return cell ? { key: `${questId}:${target.id}`, x: cell.x, y: cell.y } : null;
    }
    if (target.type === 'cave') {
      const cave = this.caveSpots?.[0];
      return cave ? { key: `${questId}:cave`, x: Math.floor(cave.x / TILE_SIZE), y: Math.floor(cave.y / TILE_SIZE) } : null;
    }
    return null;
  }

  // Průchozí pole pro cestu tečkami (stejné jako kolize: voda, útesy, stromy, budovy).
  trailWalkable(x, y) {
    const tile = this.tileAt(x, y);
    if (!tile || tile.collides) return false;
    return !this.map.buildings.some((b) => x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height);
  }

  // A* po mřížce mapy; cesty, dlažba, mosty a molo jsou levnější, takže tečky vedou po cestách.
  findTrailPath(from, to) {
    const W = this.map.width;
    const H = this.map.height;
    const idx = (x, y) => y * W + x;
    const ROAD = new Set(['path', 'plaza', 'bridge', 'dock']);
    const cost = (x, y) => (ROAD.has(this.tileAt(x, y)?.id) ? 1 : 3);
    const g = new Float32Array(W * H).fill(Infinity);
    const came = new Int32Array(W * H).fill(-1);
    const open = [];
    const push = (node) => {
      open.push(node);
      let i = open.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (open[p].f <= open[i].f) break; [open[p], open[i]] = [open[i], open[p]]; i = p; }
    };
    const pop = () => {
      const top = open[0];
      const last = open.pop();
      if (open.length) {
        open[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1; const r = l + 1; let m = i;
          if (l < open.length && open[l].f < open[m].f) m = l;
          if (r < open.length && open[r].f < open[m].f) m = r;
          if (m === i) break;
          [open[m], open[i]] = [open[i], open[m]]; i = m;
        }
      }
      return top;
    };
    const h = (x, y) => Math.hypot(x - to.x, y - to.y);
    g[idx(from.x, from.y)] = 0;
    push({ x: from.x, y: from.y, f: h(from.x, from.y) });
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let steps = 0;
    while (open.length && steps++ < 60000) {
      const node = pop();
      if (node.x === to.x && node.y === to.y) break;
      const base = g[idx(node.x, node.y)];
      for (const [dx, dy] of DIRS) {
        const nx = node.x + dx;
        const ny = node.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const isTarget = nx === to.x && ny === to.y;
        if (!isTarget && !this.trailWalkable(nx, ny)) continue;
        // Šikmo jen bez řezání rohů.
        if (dx && dy && (!this.trailWalkable(node.x + dx, node.y) || !this.trailWalkable(node.x, node.y + dy))) continue;
        const next = base + cost(nx, ny) * (dx && dy ? 1.414 : 1);
        if (next >= g[idx(nx, ny)]) continue;
        g[idx(nx, ny)] = next;
        came[idx(nx, ny)] = idx(node.x, node.y);
        push({ x: nx, y: ny, f: next + h(nx, ny) });
      }
    }
    if (came[idx(to.x, to.y)] < 0) return [];
    const path = [];
    for (let i = idx(to.x, to.y); i >= 0 && i !== idx(from.x, from.y); i = came[i]) path.push({ x: i % W, y: Math.floor(i / W) });
    return path.reverse();
  }

  // Tečky ke sledovanému cíli: cesta se přepočítá, když hrdina přejde na jiné pole nebo se změní
  // cíl (splněný úkol vede zpět k zadavateli). Tečky „tečou“ směrem k cíli.
  updateQuestTrail() {
    if (!this.questTrail) {
      // Nad budovami a stromy (pod rozhraním), aby byla cesta vidět i za domy.
      this.questTrail = this.add.graphics().setDepth(DEPTH.debug - 100);
      this.uiCamera?.ignore(this.questTrail);
    }
    const target = this.questTrailTarget();
    const px = Math.floor(this.player.x / TILE_SIZE);
    const py = Math.floor(this.player.y / TILE_SIZE);
    if (!target) {
      this.questTrail.clear();
      this.trailPath = null;
      this.trailKey = null;
      return;
    }
    const key = `${target.key}@${px},${py}`;
    if (key !== this.trailKey) {
      this.trailKey = key;
      this.trailPath = Math.hypot(px - target.x, py - target.y) < 1.5 ? [] : this.findTrailPath({ x: px, y: py }, target);
    }
    const g = this.questTrail.clear();
    const path = this.trailPath ?? [];
    const phase = (this.time.now / 450) % 2;
    for (let i = 1; i < path.length; i += 2) {
      const cell = path[i];
      const p = this.iso.toScreen((cell.x + 0.5) * TILE_SIZE, (cell.y + 0.5) * TILE_SIZE);
      const wave = 0.55 + 0.45 * Math.max(0, Math.cos(((i / 2 - phase) % 6) * (Math.PI / 3)));
      g.fillStyle(0x2a1a05, 0.6).fillEllipse(p.x, p.y + 3, 34, 18);
      g.fillStyle(0xffd76a, wave).fillEllipse(p.x, p.y, 28, 15);
      g.fillStyle(0xfff6d0, wave * 0.8).fillEllipse(p.x - 4, p.y - 2, 10, 5);
    }
    // Cíl: zlatý kroužek.
    if (path.length) {
      const end = this.iso.toScreen((target.x + 0.5) * TILE_SIZE, (target.y + 0.5) * TILE_SIZE);
      g.lineStyle(6, 0xffd76a, 0.6 + 0.4 * Math.sin(this.time.now / 250)).strokeEllipse(end.x, end.y, 90, 48);
    }
  }

  // Nástěnka na náměstí (budova bez interiéru): E otevře Nástěnku úkolů.
  findNearbyNoticeBoard() {
    const board = this.map.buildings.find((b) => b.id.endsWith('notice_board'));
    if (!board) return null;
    const cx = (board.x + board.width / 2) * TILE_SIZE;
    const cy = (board.y + board.height / 2) * TILE_SIZE;
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, cy) < TILE_SIZE * 1.8 ? board : null;
  }

  // Je nad světem otevřená karta (Hrdina, Talenty, Party, Inventář, Řemesla, Mapa)?
  cardOpen() {
    return WORLD_CARD_SCENES.some((key) => this.scene.isActive(key));
  }

  // S otevřenou kartou: jen pohyb hrdiny (ne v Databázi, kde se píše do hledání). Klávesy světa
  // se spotřebují, aby se po zavření karty nespustila akce stisknutá v kartě (M, I, E…).
  updateUnderCard() {
    this.prompt.setVisible(false);
    const professions = this.scene.isActive('Professions') ? this.scene.get('Professions') : null;
    if (professions?.view?.mode === 'database') this.player.stop();
    else this.player.updateMovement(this.cursors, this.wasd);
    for (const key of Object.values(this.keys ?? {})) if (key?.isDown !== undefined) Phaser.Input.Keyboard.JustDown(key);
    this.wasUnderCard = true;
  }

  update() {
    if (!this.player) return;

    this.cullGround();

    if (this.editorActive) {
      this.updateEditorCamera();
      return;
    }

    this.updateQuestTrail();
    if (this.cardOpen()) {
      this.updateUnderCard();
      return;
    }
    if (this.wasUnderCard) {
      this.wasUnderCard = false;
      this.savePosition();
    }

    this.player.updateMovement(this.cursors, this.wasd);

    const door = this.findNearbyDoor();

    if (door) {
      this.prompt
        .setText(`E: vstoupit – ${door.building.name}`)
        .setPosition(this.player.view.x, this.player.view.y - 125)
        .setVisible(true);
    } else {
      this.prompt.setVisible(false);
    }

    if (door && Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
      this.enterBuilding(door);
      return;
    }

    const notice = door ? null : this.findNearbyNoticeBoard();
    if (notice) {
      this.prompt
        .setText('E: Nástěnka úkolů')
        .setPosition(this.player.view.x, this.player.view.y - 125)
        .setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
        this.openCard('Quests', undefined, { board: this.state.region || 'Greenvale' });
        return;
      }
    }

    const gate = door || notice ? null : this.findNearbyGate();
    if (gate) {
      this.prompt
        .setText(this.gatePrompt(gate))
        .setPosition(this.player.view.x, this.player.view.y - 125)
        .setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
        this.travelThrough(gate);
        return;
      }
    }

    const fishing = door || gate ? null : this.findNearbyFishingSpot();
    if (fishing) {
      this.prompt
        .setText(`E: rybařit – ${fishing.info.name} (Rybolov ${fishing.info.minLevel}+)`)
        .setPosition(this.player.view.x, this.player.view.y - 125)
        .setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
        this.openFishing(fishing);
        return;
      }
    }

    const mining = door || gate || fishing ? null : this.findNearbyMiningSpot();
    if (mining) {
      this.prompt
        .setText(this.miningPrompt(mining))
        .setPosition(this.player.view.x, this.player.view.y - 125)
        .setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
        this.openMining(mining);
        return;
      }
    }
    const herb = door || gate || fishing || mining ? null : this.findNearbyHerbSpot();
    if (herb) {
      this.prompt
        .setText(this.herbPrompt(herb))
        .setPosition(this.player.view.x, this.player.view.y - 125)
        .setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
        this.openHerbalism(herb);
        return;
      }
    }
    if (this.time.now - (this.miningRefreshAt ?? 0) > 1000) {
      this.miningRefreshAt = this.time.now;
      this.refreshMiningMarkers();
      this.refreshHerbMarkers();
    }

    const cave = door || gate || fishing || mining || herb ? null : this.findNearbyCave();
    if (cave) {
      this.prompt
        .setText(this.cavePrompt())
        .setPosition(this.player.view.x, this.player.view.y - 125)
        .setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
        this.enterCave();
        return;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.debug)) {
      this.setDebugVisible(!this.debugVisible);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.reference) && this.referenceImage) {
      this.referenceImage.setVisible(!this.referenceImage.visible);
    }

    this.updateDebugInfo();

    if (Phaser.Input.Keyboard.JustDown(this.keys.heroCard)) {
      this.openHeroCard();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.talents)) {
      this.openCard('Talents');
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.cook)) {
      this.makeCampfire();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.worldMap)) {
      this.openCard('WorldMap');
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.inventory)) {
      this.openCard('Inventory');
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.party)) {
      this.openCard('Party');
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.testBattle)) {
      this.startBattle({ type: 'test' });
      return;
    }

    if (this.checkEncounter()) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.menu) && !this.leavingToMenu) {
      this.savePosition();
      // Poslední náhled hry (pro sloty uložení) – snímek před přechodem do menu.
      this.leavingToMenu = true;
      SaveSystem.capturePreview(this.game, () => {
        this.leavingToMenu = false;
        this.scene.start('Menu', { state: this.state });
      });
    }
  }
}

// Pseudonáhodné číslo 0–1 podle souřadnic (stejné při každém spuštění).
function tileHash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function scaleColor(color, factor) {
  const channel = (shift) => Math.min(255, Math.round(((color >> shift) & 0xff) * factor));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
