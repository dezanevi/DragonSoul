import Phaser from 'phaser';
import WorldHero from '../entities/WorldHero.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { bindBusinessState, onDiplomacyXp, diplomacyLevel, getShop, PROPERTIES, PROPERTY_TYPES } from '../systems/DiplomacySystem.js';
import { TILE_SIZE, TILE_TYPES } from '../data/tiles.js';
import { createPartyHud } from '../ui/partyHud.js';
import { createQuestTracker } from '../ui/questTracker.js';
import { QUEST_STATUS, getQuestStatus, trackedQuest, questTarget, worldQuestMarks, questEndBuildings, completePassiveQuests } from '../systems/QuestSystem.js';
import { canTravelToRegion, isRegionUnlocked } from '../systems/RegionSystem.js';
import { loadWorldMap, encounterZoneAt, areaAt } from '../data/maps/index.js';
import { locationById, normalizeFishing } from '../systems/FishingSystem.js';
import { createCardTabBar, CARD_FOR_TAB, tabRect } from '../ui/cardTabBar.js';
import { showGuide } from '../ui/guideSpotlight.js';
import { canChooseSpecialization } from '../systems/TalentSystem.js';

// Karty, pod kterými jde chodit (svět se při nich nepozastaví).
const WORLD_CARD_SCENES = [...new Set(['Hero', ...Object.values(CARD_FOR_TAB)])];
import { uiPrompt, uiToast, cardText } from '../ui/fantasyCard.js';
import { normalizeCooking, mealExploreStep } from '../systems/CookingSystem.js';
import { normalizeAlchemy, exploreBonus } from '../systems/AlchemySystem.js';
import { getItemCount, removeItem } from '../systems/InventorySystem.js';
import { normalizeMining, depositById, depositStatus, activeHidden, currentMeteor, formatWait } from '../systems/MiningSystem.js';
import { depositTint } from '../data/mining.js';
import { normalizeHerbalism, herbSiteById, herbSiteStatus, activeHiddenHerbs, formatHerbWait, siteMain } from '../systems/HerbalismSystem.js';
import { HERB_BY_ID } from '../data/herbalism.js';
import TerrainEditor, { renderPlacements, registerMapObject, applyMapEdits } from '../world/TerrainEditor.js';

const OBJECT_LABELS = {
  tree: 'Strom', spruce: 'Smrk', rock: 'Kámen', bush: 'Keř', plant: 'Rostlina',
  stump: 'Pařez', signpost: 'Rozcestník', fenceX: 'Plot', fenceY: 'Plot'
};
import { BUILDING_SPRITES, buildingTextureKey } from '../entities/buildingSprites.js';
import { createIsoProjection, ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from '../world/iso.js';
import { pickTerrainVariant, terrainPlacement } from '../world/terrainTiles.js';
import { OBJECT_VARIANTS, SHEET_SCALE, objectTextureKey } from '../entities/objectSprites.js';
import { tickTime, darkness, dayClockLabel } from '../systems/TimeSystem.js';

// Verze rozvržení světa v uložené hře. Při změně se hráč přesune na start mapy.
const WORLD_LAYOUT_VERSION = 8;
// Doplňky (keře, rostliny, pařezy) a stromy / skály se kreslí větší – v mapě je jich méně
// (optimalizace, tools/greenvale-village.mjs, oddíl 8).
const DECOR_SCALE = 1.5;
const OBJECT_SCALE = 1.3;
// Bloky stromů uvnitř lesa (WorldScene.cullForestBlocks): false = všechny stromy jednotlivě.
const FOREST_BLOCKS = true;
const TRAIL_OFFROAD_COST = 12; // cena pole mimo cestu pro tečky sledovaného úkolu (cesta = 1)
const FOREST_BAND = 4; // úhlopříček (hloubkových řad) v jednom bloku
const FOREST_SEGMENT = 16; // šířka bloku v jednotkách x − y (≈ 8 polí po úhlopříčce)

const TILESET_KEY = 'world-tileset';

// Po kolika polích tmavé louky přijde náhodné setkání (náhodně v tomto rozmezí).
const ENCOUNTER_STEPS = { min: 8, max: 18 };
const DOOR_REACH = TILE_SIZE * 0.9;
const CAVE_REACH = TILE_SIZE * 1.6;
// Body elipsy (značky nalezišť, kruhy vstupů): výchozích 32 je zbytečně moc – grafika se
// přepočítává každý snímek.
const ELLIPSE_POINTS = 20;
const FISHING_REACH = TILE_SIZE * 0.9;
const MINING_REACH = TILE_SIZE * 0.75;
const HERB_REACH = TILE_SIZE * 0.75;
const CAVE_QUEST = 'greenvale_cave_slime';

// Kolik místa nad horním rohem mapy nechat kameře (hlavy postav, střechy).
const CAMERA_TOP_MARGIN = 360;

// Bod úvodního úkolu: louka za Loveckou chatou (Greenvale), tam čeká Air Elemental.
const INTRO_MEADOW = { x: 32, y: 56 };
const QUARRY_DEPTH = 40; // o kolik px je dno lomu níž

// Den a noc: lucerna hrdiny svítí do 8 polí (hranatě po polích), za ní nejsilnější tma.
const LANTERN_TILES = 8;
const LANTERN_INNER = 0.18; // nádech noci uvnitř světla (podíl plné tmy)
const LANTERN_FADE = 2; // posledních 2 pole světla slábne
const NIGHT_EDGE = 0.7; // tma hned za hranou lucerny; k okraji obrazovky plynule do 1 (úplná tma)
const NIGHT_MAX_ALPHA = 1;

const DEPTH = {
  ground: -100,
  reference: -50,
  debug: 50000,
  hud: 100000,
  night: 40000 // tma nad světem, pod výzvami a HUD
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
    // Diplomacie: vlastní obchody prodávají během hraní (main.js → tickBusiness).
    bindBusinessState(this.state);
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
    // Tečky a značky úkolů: objekty minulého běhu scény jsou zničené (po souboji tečky mizely).
    this.questTrail = null;
    this.meadowTarget = null; // cíl úvodního úkolu (pole louky) – instance scény se používá znovu
    this.trailPath = null;
    this.trailKey = null;
    this.questMarkTexts = null;
    this.questMarksAt = null;
    this.doorRings = null;
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
    this.createSignposts();
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
    this.debugObjects = []; // ladicí mřížka (G) se postaví až při prvním zapnutí
    this.debugVisible = false;
    this.createNightOverlay(); // před kamerou rozhraní – tma jen na světě, ne na HUD
    this.setupUiCamera();
    // Panel party dole (miniatury, HP, útoky) – jen na kameře rozhraní.
    // Klik: hrdina → karta Hrdina, volné body talentů → Talenty, monstrum → Party s ním.
    this.partyHud = createPartyHud(this, this.state, {
      depth: DEPTH.hud,
      onHero: () => this.openCard('Hero'),
      onTalents: () => this.openCard('Talents'),
      onMonster: (monster) => {
        this.registry.set('partySelection', monster.instanceId);
        this.openCard('Party');
      }
    });
    this.cameras.main.ignore(this.partyHud.container);
    // Sledovaný úkol vpravo nahoře (klik = karta Úkoly).
    this.questTracker = createQuestTracker(this, this.state, { depth: DEPTH.hud, onClick: () => this.openCard('Quests') });
    this.cameras.main.ignore(this.questTracker.container);
    this.partyHud.setLocation(this.locationText);
    this.partyHud.setClock(dayClockLabel(this.state));
    this.time.addEvent({ delay: 300, loop: true, callback: () => {
      // Pod otevřenou kartou (nebo interiérem) panel schovat – vykukoval by pod ní.
      this.partyHud?.setVisible(!this.cardOpen() && !this.scene.isActive('Interior'));
      this.partyHud?.refresh();
      this.questTracker?.setVisible(!this.cardOpen() && !this.scene.isActive('Interior'));
      this.questTracker?.refresh();
      this.updateGuides();
      // Pasivní úkoly (Zápisky krotitele) se splní samy – po návratu ze souboje do světa.
      if (!this.cardOpen()) {
        for (const quest of completePassiveQuests(this.state)) {
          SaveSystem.save(this.state);
          this.showWorldMessage(`Úkol splněn: ${quest.title}. Odměna: ${quest.reward}`);
        }
      }
    } });
    this.setupTerrainEditor();
    this.time.delayedCall(400, () => this.showPendingMessage());

    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      // Po návratu z interiéru by mohly zůstat "držené" klávesy.
      this.input.keyboard.resetKeys();
      this.tabBar?.resetHover();
      this.questMarksAt = -9999; // značky úkolů hned podle stavu z interiéru / karty
      this.showPendingMessage();
      this.partyHud?.refresh();
      this.partyHud?.setVisible(!this.cardOpen() && !this.scene.isActive('Interior'));
      this.questTracker?.refresh();
      this.questTracker?.setVisible(!this.cardOpen() && !this.scene.isActive('Interior'));
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
    const overlayBounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };

    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const tile = this.map.tiles[y][x];
        const type = this.groundTypeAt(x, y);
        const placement = terrainPlacement(type, pickTerrainVariant(type, tileHash(x * 3 + 1, y * 5 + 2)), ISO_TILE_WIDTH);
        const center = this.iso.toScreen((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE);
        const chunk = chunkFor(type === 'water' ? 'water' : 'land', Math.floor(x / CHUNK), Math.floor(y / CHUNK));

        const image = this.add.image(center.x, center.y + this.groundLift(x, y), placement.key)
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
        // Suť lomu v ručně kreslené mapě (Greenvale): hliněná textura místo ploché barvy.
        const quarry = tile.id === 'gravel' && !this.map.generated;
        const flat = (tile.flat && !quarry) || (this.map.generated && tile.id === 'cliff');
        if (['bridge', 'dock', 'waterfall'].includes(tile.id) || flat) {
          this.drawFlatTile(overlay, x, y, tile, flat ? 0.9 + tileHash(x * 7 + 3, y * 11 + 5) * 0.14 : 1);
          overlayBounds.x0 = Math.min(overlayBounds.x0, center.x - 80);
          overlayBounds.y0 = Math.min(overlayBounds.y0, center.y - 60);
          overlayBounds.x1 = Math.max(overlayBounds.x1, center.x + 80);
          overlayBounds.y1 = Math.max(overlayBounds.y1, center.y + 60);
        }
      }
    }

    if (overlayBounds.x1 > overlayBounds.x0) this.cullRect(overlay, overlayBounds.x0, overlayBounds.y0, overlayBounds.x1, overlayBounds.y1);
    this.drawQuarryWalls();
    this.groundChunks = [...chunks.values()];
  }

  // Typ dlaždice terénu pro pole. Strom a skála dostanou podklad podle okolí,
  // most, molo a vodopád stojí na vodě, jeskyně ve skále.
  groundTypeAt(x, y) {
    const id = this.tileAt(x, y)?.id;

    if (id === 'rock' && this.isQuarry(x, y)) return 'gravel';
    if (id === 'tree' || id === 'spruce' || id === 'rock') {
      let meadow = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) if (this.tileAt(x + dx, y + dy)?.id === 'meadow') meadow++;
      }
      return meadow >= 3 ? 'meadow' : 'grass';
    }

    if (id === 'bridge' || id === 'dock' || id === 'waterfall') return 'water';
    // Dno lomu: štěrk, u zadní (severní / západní) stěny ve stínu.
    if (this.isQuarry(x, y)) {
      const wall = (dx, dy) => !this.isQuarry(x + dx, y + dy);
      return wall(0, -1) || wall(-1, 0) || wall(-1, -1) ? 'gravelShade' : 'gravel';
    }
    if (id === 'cave') return 'cliff';
    // Generované regiony: základní terény i útesy jako ploché pole (podklad hlína).
    if (this.tileAt(x, y)?.flat || (this.map.generated && id === 'cliff')) return 'plot';
    return ['grass', 'meadow', 'plot', 'path', 'plaza', 'water', 'cliff'].includes(id) ? id : 'grass';
  }

  // Skalní stěny lomu: na zadních hranách dna (sever = y−1, západ = x−1) svislá stěna z okraje
  // terénu dolů na dno, vrstvená skála se stínem.
  drawQuarryWalls() {
    if (this.map.generated) return;
    const g = this.add.graphics().setDepth(DEPTH.ground - 10); // nad terénem, pod objekty
    const T = TILE_SIZE;
    const D = QUARRY_DEPTH;
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; // obdélník stěn (skrývání mimo záběr)
    const wall = (a, b2, base, light) => {
      const pts = [a, b2, { x: b2.x, y: b2.y + D }, { x: a.x, y: a.y + D }];
      g.fillStyle(base, 1).fillPoints(pts, true);
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        g.lineStyle(2, light, 0.35).lineBetween(a.x, a.y + D * t, b2.x, b2.y + D * t);
      }
      g.lineStyle(2, 0x3a332c, 0.6).lineBetween(a.x, a.y + D, b2.x, b2.y + D);
    };
    // Schody ze sjezdu (pole cesty) na dno: kamenné stupně, které od hrany sestupují do pole dna.
    // a–b2 = hrana u sjezdu, fwd = směr do pole dna (na obrazovce).
    const STEPS = 5;
    const SPREAD = 0.6; // jak daleko do pole dna schody sahají
    const stairs = (a, b2, fwd) => {
      const fx = (fwd.x * SPREAD) / STEPS;
      const fy = (fwd.y * SPREAD) / STEPS;
      const h = D / STEPS;
      const at = (p, i, lift = 0) => ({ x: p.x + fx * i, y: p.y + fy * i + h * i + lift });
      // Boční líce schodiště (tmavá skála pod stupni).
      // Celá boční stěna od hrany svisle na dno a k patě schodů (zakryje okraj terénu).
      const side = (p) => [p, { x: p.x, y: p.y + D }, { x: p.x + fx * STEPS, y: p.y + fy * STEPS + D }, at(p, STEPS)];
      g.fillStyle(0x5e5347, 1).fillPoints(side(a), true).fillPoints(side(b2), true);
      for (let i = 0; i < STEPS; i++) {
        const a0 = at(a, i);
        const b0 = at(b2, i);
        // čelo stupně (svislé)
        g.fillStyle(0x7a6d5e, 1).fillPoints([a0, b0, { x: b0.x, y: b0.y + h }, { x: a0.x, y: a0.y + h }], true);
        // nášlap (vodorovný, světlejší)
        const a1 = { x: a0.x, y: a0.y + h };
        const b1 = { x: b0.x, y: b0.y + h };
        g.fillStyle(0xb9ab94, 1).fillPoints([a1, b1, { x: b1.x + fx, y: b1.y + fy }, { x: a1.x + fx, y: a1.y + fy }], true);
        g.lineStyle(2, 0xe0d3bb, 0.7).lineBetween(a1.x, a1.y, b1.x, b1.y); // světlá hrana stupně
        g.lineStyle(1, 0x3a332c, 0.5).lineBetween(a0.x, a0.y, b0.x, b0.y);
      }
    };
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (!this.isQuarry(x, y)) continue;
        const n = this.iso.toScreen(x * T, y * T);
        const e = this.iso.toScreen((x + 1) * T, y * T);
        const w = this.iso.toScreen(x * T, (y + 1) * T);
        b.x0 = Math.min(b.x0, w.x); b.x1 = Math.max(b.x1, e.x); b.y0 = Math.min(b.y0, n.y); b.y1 = Math.max(b.y1, w.y + D);
        if (this.quarryStairsDir(x, y - 1) === 'S') stairs(n, e, { x: w.x - n.x, y: w.y - n.y });
        else if (!this.isQuarry(x, y - 1)) wall(n, e, 0x857563, 0xb3a28a);
        if (this.quarryStairsDir(x - 1, y) === 'E') stairs(n, w, { x: e.x - n.x, y: e.y - n.y });
        else if (!this.isQuarry(x - 1, y)) wall(w, n, 0x6c5f51, 0x9c8b75);
      }
    }
    if (b.x1 > b.x0) this.cullRect(g, b.x0, b.y0, b.x1, b.y1);
  }

  // Zahloubení terénu v px (dno lomu leží níž, okolní terén tvoří stěnu).
  groundLift(x, y) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (this.isQuarry(tx, ty)) return QUARRY_DEPTH;
    return this.isQuarryRamp(tx, ty) ? QUARRY_DEPTH / 2 : 0;
  }

  // Kterým směrem ze sjezdu vedou schody (jen jedno schodiště na sjezd): rovně od cesty,
  // která ke sjezdu vede, jinak na jih, jinak na východ. 'S' | 'E' | null.
  quarryStairsDir(x, y) {
    if (!this.isQuarryRamp(x, y)) return null;
    const south = this.isQuarry(x, y + 1);
    const east = this.isQuarry(x + 1, y);
    if (south && east) return this.tileAt(x - 1, y)?.id === 'path' && this.tileAt(x, y - 1)?.id !== 'path' ? 'E' : 'S';
    return south ? 'S' : east ? 'E' : null;
  }

  // Sjezd do lomu: pole cesty hned vedle dna.
  isQuarryRamp(x, y) {
    if (this.map.generated || this.tileAt(x, y)?.id !== 'path') return false;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.isQuarry(x + dx, y + dy));
  }

  // Pole dna lomu: štěrk, nebo balvan obklopený štěrkem (ručně kreslená mapa).
  isQuarry(x, y) {
    if (this.map.generated) return false;
    const id = this.tileAt(x, y)?.id;
    if (id === 'gravel') return true;
    if (id !== 'rock') return false;
    let n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.tileAt(x + dx, y + dy)?.id === 'gravel') n++;
    return n >= 2;
  }

  // Grafika, která se mimo záběr nekreslí (značky nalezišť, kruhy vstupů, ploché dlaždice…):
  // Phaser grafiku neořezává a každý snímek ji přepočítává, i daleko mimo obrazovku.
  cullRect(obj, x0, y0, x1, y1) {
    (this.cullMarks ??= []).push({ obj, x0, y0, x1, y1 });
    return obj;
  }

  cullPoint(obj, x, y, r = 90) {
    return this.cullRect(obj, x - r, y - r, x + r, y + r);
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

    // Stromy a skály mimo záběr se nekreslí (les má tisíce objektů). Obrázek stojí na patě
    // (počátek dole uprostřed), proto větší rezerva nahoru a do stran.
    if (this.cullMarks) {
      const left = view.x - 60;
      const right = view.right + 60;
      const top = view.y - 60;
      const bottom = view.bottom + 60;
      for (const m of this.cullMarks) {
        m.obj.visible = m.x1 >= left && m.x0 <= right && m.y1 >= top && m.y0 <= bottom;
      }
    }

    this.cullForestBlocks(view);

    if (this.cullObjects) {
      const left = view.x - 260;
      const right = view.right + 260;
      const top = view.y - 40;
      const bottom = view.bottom + 420;
      for (const image of this.cullObjects) {
        image.visible = image.x >= left && image.x <= right && image.y >= top && image.y <= bottom;
      }
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
    this.forestBlocks = new Map();
    this.forestStamp?.destroy();
    this.forestStamp = null; // razítko pro pečení bloků (instance scény se používá znovu)
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const tile = this.map.tiles[y][x];
        const variants = tile.object ? OBJECT_VARIANTS[tile.object] : null;
        if (!variants) continue;
        if (this.isInnerForestTree(x, y, tile)) {
          this.addToForestBlock(x, y, tile, variants);
          continue;
        }

        const roll = tileHash(x, y);
        const index = Math.floor(roll * variants.length) % variants.length;
        const key = objectTextureKey(tile.object, index);
        if (!this.textures.exists(key)) continue;

        const center = this.iso.toScreen((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE);
        const baseY = center.y + 14 + this.groundLift(x, y);
        const jitter = (tileHash(y, x) - 0.5) * 16;
        const size = tileHash(x + 7, y + 3);

        let scale = 0.9 + size * 0.2;
        if (tile.object === 'tree') scale = 0.7 + size * 0.65; // 0,7× až 1,35×
        if (tile.object === 'spruce') scale = (index >= 2 ? 1.3 : 0.95) + size * 0.55;

        const image = this.add.image(center.x + jitter, baseY, key)
          .setOrigin(0.5, 1)
          .setScale(SHEET_SCALE * scale * OBJECT_SCALE)
          .setFlipX(tile.object !== 'rock' && roll < 0.5)
          .setDepth(baseY);
        (this.cullObjects ??= []).push(image);
        this.trackMapObject(image, `obj-${x},${y}`, `${OBJECT_LABELS[tile.object] ?? tile.object} (${x}, ${y})`);
      }
    }
  }

  // ------------------------------------------------- bloky stromů uvnitř lesa
  // Strom uvnitř lesa: všech 8 sousedních polí je neprůchozích (stromy, skály, voda, útesy),
  // hrdina k němu nikdy nedojde. Takové stromy se nekreslí jednotlivě: stromy na stejném
  // pruhu úhlopříček (stejná hloubka na obrazovce) a v krátkém úseku se spečou do jednoho
  // obrázku (RenderTexture). Blok vznikne, až se přiblíží kamera, a daleko mimo záběr se
  // zase uvolní (paměť grafické karty). Okrajové stromy zůstávají samostatné, takže hrdina
  // za ně zajde správně.
  isInnerForestTree(x, y, tile) {
    if (!FOREST_BLOCKS || (tile.object !== 'tree' && tile.object !== 'spruce')) return false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const t = this.map.tiles[y + dy]?.[x + dx];
        if (!t || !t.collides) return false;
      }
    }
    return true;
  }

  addToForestBlock(x, y, tile, variants) {
    const roll = tileHash(x, y);
    const index = Math.floor(roll * variants.length) % variants.length;
    const key = objectTextureKey(tile.object, index);
    if (!this.textures.exists(key)) return;
    const center = this.iso.toScreen((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE);
    const baseY = center.y + 14 + this.groundLift(x, y);
    const jitter = (tileHash(y, x) - 0.5) * 16;
    const size = tileHash(x + 7, y + 3);
    let scale = 0.9 + size * 0.2;
    if (tile.object === 'tree') scale = 0.7 + size * 0.65;
    if (tile.object === 'spruce') scale = (index >= 2 ? 1.3 : 0.95) + size * 0.55;
    const s = SHEET_SCALE * scale * OBJECT_SCALE;
    const frame = this.textures.getFrame(key);
    const w = frame.width * s;
    const h = frame.height * s;
    const tx = center.x + jitter;
    const groupKey = `${Math.floor((x + y) / FOREST_BAND)}:${Math.floor((x - y) / FOREST_SEGMENT)}`;
    let block = this.forestBlocks.get(groupKey);
    if (!block) {
      block = { trees: [], x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, depth: -Infinity, rt: null };
      this.forestBlocks.set(groupKey, block);
    }
    block.trees.push({ key, x: tx, y: baseY, s, flip: roll < 0.5 });
    block.x0 = Math.min(block.x0, tx - w / 2);
    block.x1 = Math.max(block.x1, tx + w / 2);
    block.y0 = Math.min(block.y0, baseY - h);
    block.y1 = Math.max(block.y1, baseY);
    block.depth = Math.max(block.depth, baseY);
  }

  bakeForestBlock(block) {
    const x0 = Math.floor(block.x0);
    const y0 = Math.floor(block.y0);
    const w = Math.ceil(block.x1) - x0 + 2;
    const h = Math.ceil(block.y1) - y0 + 2;
    const rt = this.add.renderTexture(x0, y0, w, h).setOrigin(0).setDepth(block.depth);
    this.forestStamp ??= this.make.image({ x: 0, y: 0, key: block.trees[0].key, add: false }).setOrigin(0.5, 1);
    const stamp = this.forestStamp;
    // Strom za stromem odzadu dopředu (stejně jako by je seřadila hloubka).
    for (const t of [...block.trees].sort((a, b) => a.y - b.y)) {
      stamp.setTexture(t.key).setScale(t.s).setFlipX(t.flip).setPosition(t.x - x0, t.y - y0);
      rt.draw(stamp);
    }
    block.rt = rt;
  }

  // Bloky lesa podle kamery: v záběru (s rezervou) upéct, daleko mimo uvolnit.
  cullForestBlocks(view) {
    if (!this.forestBlocks?.size) return;
    // Viditelné bloky se upečou hned; bloky v rezervě kolem záběru nejvýš 3 za snímek
    // (předem, než do záběru vjedou), aby chůze nezaškobrtávala.
    const inside = (b, r) => b.x1 >= r.l && b.x0 <= r.r && b.y1 >= r.t && b.y0 <= r.b;
    const seen = { l: view.x - 60, r: view.right + 60, t: view.y - 60, b: view.bottom + 260 };
    const near = { l: view.x - 700, r: view.right + 700, t: view.y - 500, b: view.bottom + 800 };
    const far = { l: view.x - view.width * 1.5, r: view.right + view.width * 1.5, t: view.y - view.height * 1.5, b: view.bottom + view.height * 1.5 };
    let budget = 3;
    for (const block of this.forestBlocks.values()) {
      if (inside(block, near)) {
        const visible = inside(block, seen);
        if (!block.rt && (visible || budget-- > 0)) this.bakeForestBlock(block);
        block.rt?.setVisible(visible);
        continue;
      }
      if (!block.rt) continue;
      if (inside(block, far)) block.rt.setVisible(false);
      else { block.rt.destroy(); block.rt = null; }
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

      // Skála naleziště: ['oreRock', x, y, deposit] = skála na poli (x, y), obarvená do odstínu
      // suroviny, kolem ní naleziště stejného druhu. Skála blokuje své pole.
      if (type === 'oreRock') {
        const rocks = OBJECT_VARIANTS.rock ?? [];
        const key = objectTextureKey('rock', Math.floor(roll * rocks.length) % Math.max(1, rocks.length));
        const center = this.iso.toScreen((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE);
        const baseY = center.y + 14 + this.groundLift(x, y);
        if (this.textures.exists(key)) {
          const image = this.add.image(center.x, baseY, key)
            .setOrigin(0.5, 1)
            .setScale(SHEET_SCALE * OBJECT_SCALE * 1.25)
            .setTint(depositTint(extra))
            .setDepth(baseY);
          this.trackMapObject(image, `decor-${decorIndex}`, `Skála – ${depositById(extra)?.name ?? extra} (${x}, ${y})`);
        }
        this.decorBodies.add(this.add.zone((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE, TILE_SIZE * 0.8, TILE_SIZE * 0.8));
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
      p.y += this.groundLift(spot.x, spot.y);
      const g = this.cullPoint(this.add.graphics().setDepth(p.y - 1), p.x, p.y);
      g.lineStyle(3, 0x7fd0ff, 0.95).strokeEllipse(p.x, p.y, 54, 26, ELLIPSE_POINTS);
      g.fillStyle(0x7fd0ff, 0.22).fillEllipse(p.x, p.y, 54, 26, ELLIPSE_POINTS);
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
      p.y += this.groundLift(spot.x, spot.y);
      // Nad korunami stromů z jižních polí, aby značka nezmizela v lese.
      return { ...spot, ...extra, screen: p, graphics: this.cullPoint(this.add.graphics().setDepth(p.y + 150), p.x, p.y) };
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

  // Klíč konkrétní žíly (oblast + pole) – každá žíla v lomu odpočívá zvlášť.
  miningSpotKey(spot) {
    return `${this.miningRegion}:${spot.x},${spot.y}`;
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
    const status = depositStatus(this.state, spot.info, now, this.miningSpotKey(spot));
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
      const color = st.hidden || spot.kind === 'meteor' ? 0xffd76a : st.info.special || spot.rare ? 0xc48bff : 0xffa94d;
      if (!st.ready) {
        g.lineStyle(2, 0x6b6258, 0.8).strokeEllipse(x, y, 46, 22, ELLIPSE_POINTS);
        g.fillStyle(0x3a332c, 0.35).fillEllipse(x, y, 46, 22, ELLIPSE_POINTS);
        continue;
      }
      if (dowsing || st.hidden || spot.kind === 'meteor') g.fillStyle(color, 0.25).fillEllipse(x, y, 72, 34, ELLIPSE_POINTS);
      g.lineStyle(4, 0x2a1d13, 0.6).strokeEllipse(x, y, 54, 27, ELLIPSE_POINTS);
      g.lineStyle(3, color, 1).strokeEllipse(x, y, 50, 24, ELLIPSE_POINTS);
      g.fillStyle(color, 0.45).fillEllipse(x, y, 50, 24, ELLIPSE_POINTS);
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
    this.scene.launch('Mining', { state: this.state, returnScene: this.scene.key, depositId: spot.info.id, hidden: Boolean(spot.hidden), region: this.miningRegion,
      spotKey: spot.kind ? null : this.miningSpotKey(spot), rareSpot: Boolean(spot.rare) });
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
        p.y += this.groundLift(spot.x, spot.y);
        return { ...spot, screen: p, graphics: this.cullPoint(this.add.graphics().setDepth(p.y + 150), p.x, p.y) };
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
        g.lineStyle(2, 0x5f6b58, 0.8).strokeEllipse(x, y, 46, 22, ELLIPSE_POINTS);
        g.fillStyle(0x2e3a2a, 0.35).fillEllipse(x, y, 46, 22, ELLIPSE_POINTS);
        continue;
      }
      // Sytá barva a tmavý okraj, aby kruh na světlé trávě nesplýval.
      const color = st.info.special ? 0xa86bff : st.info.cultivated ? 0xe0c23a : 0x2fb84a;
      g.lineStyle(5, 0x0d1f0a, 0.85).strokeEllipse(x, y, 56, 28, ELLIPSE_POINTS);
      g.fillStyle(color, 0.6).fillEllipse(x, y, 52, 25, ELLIPSE_POINTS);
      g.lineStyle(2, 0xf2ffe0, 0.9).strokeEllipse(x, y, 50, 24, ELLIPSE_POINTS);
      // Lístek s žilkou.
      g.fillStyle(0x0f4a12, 1).fillEllipse(x + 1, y - 3, 22, 11, ELLIPSE_POINTS);
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
      const g = this.cullPoint(this.add.graphics().setDepth(p.y), p.x, p.y);
      g.lineStyle(3, 0xffd76a, 0.9).strokeEllipse(p.x, p.y, 70, 34, ELLIPSE_POINTS);
      g.fillStyle(0xffd76a, 0.18).fillEllipse(p.x, p.y, 70, 34, ELLIPSE_POINTS);
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
        // Vchod do jeskyně (úkol Orčí hrozba).
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
    if (this.occlusionBlocked?.has(`${Math.floor(worldX / TILE_SIZE)},${Math.floor(worldY / TILE_SIZE)}`)) return true;

    return this.collisionRects().some((r) =>
      worldX >= r.x * TILE_SIZE &&
      worldX < (r.x + r.w) * TILE_SIZE &&
      worldY >= r.y * TILE_SIZE &&
      worldY < (r.y + r.h) * TILE_SIZE
    );
  }

  // Je bod obrazovky (sx, sy) na neprůhledném pixelu obrázku budovy?
  imageOpaqueAt(image, sx, sy) {
    const profile = this.alphaCache?.get(image.texture.key);
    if (!profile?.alpha) return false;
    const scale = image.scaleX;
    let lx = Math.floor((sx - (image.x - (profile.w * scale) / 2)) / scale);
    const ly = Math.floor((sy - (image.y - profile.h * scale)) / scale);
    if (image.flipX) lx = profile.w - 1 - lx;
    if (lx < 0 || ly < 0 || lx >= profile.w || ly >= profile.h) return false;
    return profile.alpha[ly * profile.w + lx] > 140;
  }

  // Budova, za kterou hrdina zrovna stojí, zprůsvitní, aby byl hrdina vidět.
  updateBuildingFade() {
    if (!this.buildingImages) return;
    const hx = this.player.view.x;
    const hy = this.player.view.y;
    for (const image of this.buildingImages.values()) {
      const near = Math.abs(image.x - hx) < image.displayWidth && hy < image.y && hy > image.y - image.displayHeight;
      const hidden = near && hy < image.depth && [[0, -20], [0, -60]].some(([dx, dy]) => this.imageOpaqueAt(image, hx + dx, hy + dy));
      const alpha = hidden ? 0.45 : 1;
      if (image.alpha !== alpha) image.setAlpha(alpha);
    }
  }

  // Pole za budovou (sever / západ), na kterých by hrdinu skoro celého zakryl obrázek budovy.
  // Dřív se blokovala; teď jsou průchozí (budova zprůsvitní). Ponecháno pro ladění.
  occludedTiles(image, building, rect) {
    const profile = this.alphaCache?.get(image.texture.key);
    if (!profile?.alpha) return [];
    const opaque = (sx, sy) => this.imageOpaqueAt(image, sx, sy);
    const ROAD = new Set(['path', 'plaza', 'bridge', 'dock']);
    const tiles = [];
    const door = building.door;
    for (let ty = Math.floor(rect.y) - 5; ty <= Math.ceil(rect.y + rect.h); ty++) {
      for (let tx = Math.floor(rect.x) - 5; tx <= Math.ceil(rect.x + rect.w); tx++) {
        if (door && door.x === tx && door.y === ty) continue;
        const tile = this.tileAt(tx, ty);
        if (!tile || tile.collides || ROAD.has(tile.id)) continue; // cesty zůstávají průchozí
        const cx = tx + 0.5;
        const cy = ty + 0.5;
        if (cx > rect.x && cx < rect.x + rect.w && cy > rect.y && cy < rect.y + rect.h) continue;
        const p = this.iso.toScreen(cx * TILE_SIZE, cy * TILE_SIZE);
        if (p.y >= image.depth) continue; // před budovou se hrdina kreslí přes ni
        const samples = [[0, -14], [0, -50], [0, -90], [-16, -40], [16, -40]];
        const covered = samples.filter(([dx, dy]) => opaque(p.x + dx, p.y + dy)).length;
        if (covered >= 4) tiles.push({ x: tx, y: ty });
      }
    }
    return tiles;
  }

  // Kolizní obdélníky budov (v polích, mohou být desetinné).
  collisionRects() {
    return this.map.buildings.map((b) => this.buildingCollision?.get(b.id) ?? { x: b.x, y: b.y, w: b.width, h: b.height });
  }

  // Kolize podle obrázku: v dolní třetině neprůhledných pixelů (stěny, ne střecha) se najde
  // nejlevější a nejpravější bod a nejnižší bod = západní, východní a jižní roh základny.
  // Z nich se spočítá kosočtverec ve stejném poměru stran jako půdorys v mapě, mírně zmenšený,
  // aby šlo dojít až ke zdi. Pole dveří zůstává vždy mimo kolizi.
  fitBuildingCollision(image, building) {
    this.alphaCache ??= new Map();
    const key = image.texture.key;
    let profile = this.alphaCache.get(key);
    if (!profile) {
      const src = image.texture.getSourceImage();
      const w = src.width;
      const h = src.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(src, 0, 0);
      const data = ctx.getImageData(0, 0, w, h).data;
      const rows = [];
      for (let y = 0; y < h; y++) {
        let min = -1;
        let max = -1;
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 140) { if (min < 0) min = x; max = x; }
        }
        rows.push(min < 0 ? null : [min, max]);
      }
      const top = rows.findIndex(Boolean);
      let bottom = rows.length - 1;
      while (bottom > 0 && !rows[bottom]) bottom--;
      const from = Math.round(bottom - (bottom - top) * 0.33);
      let minX = Infinity;
      let maxX = -Infinity;
      for (let y = from; y <= bottom; y++) if (rows[y]) { minX = Math.min(minX, rows[y][0]); maxX = Math.max(maxX, rows[y][1]); }
      const alpha = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];
      profile = { w, h, minX, maxX, bottom, alpha };
      this.alphaCache.set(key, profile);
    }
    if (!Number.isFinite(profile.minX)) return null;
    const scale = image.scaleX;
    const left = image.x - (profile.w * scale) / 2;
    const top = image.y - profile.h * scale;
    const minX = image.flipX ? profile.w - 1 - profile.maxX : profile.minX;
    const maxX = image.flipX ? profile.w - 1 - profile.minX : profile.maxX;
    const west = left + minX * scale;
    const east = left + maxX * scale;
    const southY = top + profile.bottom * scale;
    // Šířka základny na obrazovce = (w + h) × 64 px; poměr stran podle mapy.
    const span = (east - west) / (ISO_TILE_WIDTH / 2);
    // collisionAspect [š, v]: obrázek protáhlý jinak než půdorys v mapě (radnice).
    const [aw, ah] = building.collisionAspect ?? [building.width, building.height];
    const ratio = aw / (aw + ah);
    const wTiles = span * ratio;
    const hTiles = span - wTiles;
    const southX = west + hTiles * (ISO_TILE_WIDTH / 2);
    const corner = this.iso.toLogical(southX, southY);
    const inset = 0.2;
    const rect = {
      x: corner.x / TILE_SIZE - wTiles + inset,
      y: corner.y / TILE_SIZE - hTiles + inset,
      w: Math.max(0.6, wTiles - inset * 2),
      h: Math.max(0.6, hTiles - inset * 2)
    };
    // Zadní strany (sever / západ) až po půdorys z mapy: spodní třetina obrázku vidí jen přední
    // stěny, takže kolize byla mělká a hrdina „za budovou“ stál uprostřed domu. Přední strana
    // (dveře) zůstává podle obrázku.
    const backX = Math.min(rect.x, building.x + inset);
    const backY = Math.min(rect.y, building.y + inset);
    rect.w += rect.x - backX;
    rect.h += rect.y - backY;
    rect.x = backX;
    rect.y = backY;
    // Dveře mimo kolizi: zkrátit stranu, na které dveře jsou.
    const door = building.door;
    if (door && door.x + 1 > rect.x && door.x < rect.x + rect.w && door.y + 1 > rect.y && door.y < rect.y + rect.h) {
      const east = rect.x + rect.w - door.x; // jak hluboko dveře zasahují od východní stěny
      const south = rect.y + rect.h - door.y; // a od jižní
      if (east <= south) rect.w = Math.max(0.6, door.x - rect.x);
      else rect.h = Math.max(0.6, door.y - rect.y);
    }
    return rect;
  }

  // ----------------------------------------------------------------- budovy

  // Budova = obrázek, jehož spodní okraj leží na předním (jihovýchodním) rohu
  // půdorysu. Do hloubky se řadí podle středu půdorysu, takže hrdina před
  // budovou je vidět a za ní se schová.
  createBuildings() {
    this.buildingBodies = this.physics.add.staticGroup();
    this.buildingCollision = new Map();
    this.occlusionBlocked = new Set();
    this.buildingImages = new Map();
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

      let image = null;
      if (sprite && this.textures.exists(key)) {
        image = this.add.image(centerX + (sprite.offsetX ?? 0), south.y + sprite.offsetY, key).setOrigin(0.5, 1);
        image.setScale(sprite.pixelScale ?? (footprintWidth * sprite.scale) / image.width).setDepth(center.y);
        if (sprite.flipX) image.setFlipX(true);
        this.buildingImages.set(building.id, image);
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

      // Kolize: podle spodní části obrázku budovy (stěny), ne jen podle půdorysu v mapě –
      // obrázky bývají větší / posunuté. Bez obrázku zůstává půdorys.
      const rect = (image && this.fitBuildingCollision(image, building)) ?? { x: building.x, y: building.y, w: building.width, h: building.height };
      this.buildingCollision.set(building.id, rect);
      // Pole za budovou se už neblokují (occludedTiles): hrdina za ni dojde a budova
      // zprůsvitní (updateBuildingFade). Kolize je jen půdorys stěn.
      const body = this.add.zone(
        (rect.x + rect.w / 2) * TILE_SIZE,
        (rect.y + rect.h / 2) * TILE_SIZE,
        rect.w * TILE_SIZE,
        rect.h * TILE_SIZE
      );
      this.buildingBodies.add(body);

      // Budovy bez interiéru (kostel, mlýn, kašna…) nemají dveře.
      if (!building.door) continue;
      // Hrdina u dveří se kreslí před budovou (dveře radnice leží „nad“ středem budovy).
      const doorScreen = this.iso.toScreen((building.door.x + 0.5) * TILE_SIZE, (building.door.y + 0.5) * TILE_SIZE);
      if (image && doorScreen.y - 40 < image.depth) image.setDepth(doorScreen.y - 40);
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
    if (status === QUEST_STATUS.active) return 'E: vstoupit do jeskyně – Orčí hrozba';
    return 'E: prohlédnout jeskyni';
  }

  // Jeskyně: s přijatým úkolem souboj s jeskynním slizem, jinak jen hláška.
  enterCave() {
    const status = getQuestStatus(this.state, CAVE_QUEST);
    if (status === QUEST_STATUS.active) {
      const ready = (this.state.party ?? []).some((monster) => monster.currentHp > 0);
      if (!ready) {
        this.showWorldMessage('Tvoje monstra jsou vyčerpaná. Nech je vyléčit u Liory v domě léčitelky (nebo si odpočiň v hostinci).');
        return;
      }
      this.startBattle({ type: 'greenvale_cave_boss', backdrop: 'greenvale_meadow' });
      return;
    }
    this.showWorldMessage(
      status === QUEST_STATUS.notStarted
        ? 'Z jeskyně je cítit kouř a slyšíš drsný orčí hlas. Starosta Edric na radnici o ní něco ví.'
        : 'Jeskyně je tichá. Orčí válečník je poražen.'
    );
  }

  // Navádění jako v tutoriálu souboje (ui/guideSpotlight.js), každé jen jednou:
  // po Prvním lovu na Úkoly → Co dál?, po odemknutí talentů (4. úroveň) na Talenty.
  updateGuides() {
    const busy = this.cardOpen() || this.scene.isActive('Interior');
    if (this.guide) {
      if (busy) { this.guide.destroy(); this.guide = null; }
      return;
    }
    if (busy || this.editorActive) return;
    const flags = (this.state.flags ??= {});
    let tab = null;
    let text = null;
    if (!flags.guideWhatNext && getQuestStatus(this.state, 'greenvale_first_hunt') === QUEST_STATUS.ready) {
      tab = 'quests';
      flags.guideWhatNext = true;
      this.registry.set('guideWhatNext', true); // karta Úkoly pak zvýrazní tlačítko Co dál?
      text = 'Tři divočáci padli – První lov je splněný! Klikni na Úkoly a pak na Co dál? – ukáže ti, kam jít teď.';
    } else if (!flags.guideTalents && canChooseSpecialization(this.state).ok) {
      tab = 'talents';
      flags.guideTalents = true;
      text = 'Dosáhl jsi 4. úrovně – odemkly se talenty! Klikni na Talenty a vyber si hlavní specializaci.';
    }
    if (!tab) return;
    SaveSystem.save(this.state);
    this.guide = showGuide(this, { rect: tabRect(tab), text, depth: DEPTH.hud + 50 });
    this.cameras.main.ignore(this.guide.objects);
  }

  // Hláška předaná z interiéru (např. nový úkol po přijetí – interiér se zavře).
  showPendingMessage() {
    const text = this.registry.get('pendingWorldMessage');
    if (!text) return;
    this.registry.remove('pendingWorldMessage');
    this.showWorldMessage(text);
  }

  showWorldMessage(text) {
    this.worldMessage?.destroy();
    // Nad panelem party (HUD), ne přes něj.
    const hudTop = this.partyHud?.top?.() || this.scale.height - 200;
    this.worldMessage = uiToast(this, text, { y: hudTop - 14, depth: DEPTH.hud });
  }

  enterBuilding(door) {
    this.player.stop();
    this.savePosition();

    this.partyHud?.setVisible(false);
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
    this.updateLocation(tileX, tileY);
    this.refreshSignposts(tileX, tileY);
    // Jídlo s průzkumným bonusem: +HP monstrům každých 50 kroků.
    if (mealExploreStep(this.state)) this.showWorldMessage?.('Najedená monstra nabrala síly na cestě.');

    // Setkání jen na louce v Greenvale (ostatní regiony zatím bez náhodných setkání).
    if ((this.state.region || 'Greenvale') !== 'Greenvale') return false;
    if (!this.tileAt(tileX, tileY)?.encounter) {
      this.currentZoneId = null;
      return false;
    }
    // Vstup na louku: název a úrovně monster (jako cedule u cesty).
    const enteredZone = encounterZoneAt(this.map, tileX, tileY);
    if (enteredZone && enteredZone.id !== this.currentZoneId) {
      this.showWorldMessage(`${enteredZone.name} – monstra úr. ${enteredZone.level[0]}–${enteredZone.level[1]}${enteredZone.rare ? ' (vzácná louka)' : ''}`);
    }
    this.currentZoneId = enteredZone?.id ?? null;

    // Úvodní úkol Krotitelova zkouška: Air Elemental čeká na louce za Loveckou chatou (bod úkolu).
    // Do té doby na louce žádná náhodná setkání.
    if (getQuestStatus(this.state, 'greenvale_mage_intro') === QUEST_STATUS.active) {
      if (Math.max(Math.abs(tileX - INTRO_MEADOW.x), Math.abs(tileY - INTRO_MEADOW.y)) > 1) return false;
      if (!(this.state.party ?? []).some((monster) => monster.currentHp > 0)) {
        this.showWorldMessage('Tvůj vlk je vyčerpaný. Nech ho vyléčit u Liory v domě léčitelky (nebo si odpočiň v hostinci).');
        return false;
      }
      this.startBattle({ type: 'tutorial_air', backdrop: 'greenvale_meadow' });
      return true;
    }

    // Alchymie: odpuzovač / lákadlo / neviditelnost mění četnost setkání.
    const encounterBonus = exploreBonus(this.state, 'encounters');
    if (encounterBonus <= -1) return false;
    this.encounterSteps = (this.encounterSteps ?? 0) + 1;
    this.encounterThreshold ??= Phaser.Math.Between(ENCOUNTER_STEPS.min, ENCOUNTER_STEPS.max);
    if (this.encounterSteps < this.encounterThreshold / (1 + encounterBonus)) return false;

    const ready = (this.state.party ?? []).some((monster) => monster.currentHp > 0);
    if (!ready) return false;

    // Louka setkání: konkrétní monstra a úrovně (map.encounterZones).
    const zone = encounterZoneAt(this.map, tileX, tileY);
    this.startBattle({ type: 'wild', backdrop: 'greenvale_meadow', zone: zone ? { id: zone.id, name: zone.name, level: zone.level, species: zone.species } : null });
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
    this.partyHud?.setVisible(false);
    // animateIn: první karta ze světa vyjede zpod lišty (přepínání mezi kartami bez animace).
    this.scene.launch(sceneKey, { state: this.state, returnScene: this.scene.key, initialTab, animateIn: true, ...extra });
    this.scene.bringToTop(sceneKey);
  }

  // Rozhraní má vlastní kameru, aby se nezoomovalo se světem.
  setupUiCamera() {
    const hud = [...(this.tabBar?.objects ?? []), this.debugInfo].filter(Boolean);

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

    // Kde hrdina je: „Greenvale – Lom Greenvale“, mimo pojmenované oblasti jen „Greenvale“
    // – štítek nad spodním panelem party (partyHud.setLocation).
    this.currentArea = undefined;
    this.updateLocation();
  }

  // Název oblasti pod hrdinou do HUD (volá se při změně pole).
  updateLocation(tileX = Math.floor(this.player.x / TILE_SIZE), tileY = Math.floor(this.player.y / TILE_SIZE)) {
    const region = this.state.region || 'Greenvale';
    const area = areaAt(this.map, tileX, tileY);
    if (area === this.currentArea) return;
    this.currentArea = area;
    this.locationText = area ? `${region} – ${area}` : region;
    this.partyHud?.setLocation(this.locationText);
  }

  // ------------------------------------------------------------- rozcestníky
  // Rozcestí se najdou na mapě samy: pole cesty, kolem kterého (kruh o poloměru 3) vychází
  // aspoň 3 větve cesty (mimo dlážděné náměstí). U rozcestí stojí ukazatel; když k němu
  // hrdina dojde, ukáže se nad ním, kam která cesta vede (první pojmenovaná oblast na větvi).
  createSignposts() {
    this.signposts = [];
    if (this.map.generated) return;
    const W = this.map.width;
    const H = this.map.height;
    const id = (x, y) => this.map.tiles[y]?.[x]?.id;
    const isPath = (x, y) => ['path', 'plaza', 'bridge'].includes(id(x, y));
    const ringOf = (R) => {
      const ring = [];
      for (let x = -R; x <= R; x++) ring.push([x, -R]);
      for (let y = -R + 1; y <= R; y++) ring.push([R, y]);
      for (let x = R - 1; x >= -R; x--) ring.push([x, R]);
      for (let y = R - 1; y > -R; y--) ring.push([-R, y]);
      return ring;
    };
    const runsAt = (x, y, ring) => {
      const v = ring.map(([dx, dy]) => isPath(x + dx, y + dy));
      const runs = [];
      for (let i = 0; i < v.length; i++) {
        if (!v[i] || v[(i + v.length - 1) % v.length]) continue;
        let j = i;
        const cells = [];
        while (v[j % v.length] && cells.length < v.length) { cells.push(ring[j % v.length]); j++; }
        runs.push(cells[Math.floor(cells.length / 2)]);
      }
      return runs;
    };
    // 1) Kandidáti a shluky.
    const ring3 = ringOf(3);
    const clusters = [];
    for (let y = 3; y < H - 3; y++) {
      for (let x = 3; x < W - 3; x++) {
        if (id(x, y) !== 'path' || runsAt(x, y, ring3).length < 3) continue;
        let plaza = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (id(x + dx, y + dy) === 'plaza') plaza++;
        if (plaza >= 6) continue;
        const c = clusters.find((k) => Math.abs(k.x - x) <= 6 && Math.abs(k.y - y) <= 6);
        if (c) { c.n += 1; c.sx += x; c.sy += y; c.x = c.sx / c.n; c.y = c.sy / c.n; } else clusters.push({ x, y, sx: x, sy: y, n: 1 });
      }
    }
    // 2) Pro každé rozcestí: větve a cíle.
    const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
    const key = objectTextureKey('signpost', 0);
    for (const c of clusters) {
      const jx = Math.round(c.x);
      const jy = Math.round(c.y);
      const here = areaAt(this.map, jx, jy);
      const lines = [];
      for (const [bx, by] of runsAt(jx, jy, ringOf(4))) {
        // Průchod po cestě od začátku větve (dál od rozcestí), první pojmenovaná oblast.
        const start = [jx + bx, jy + by];
        const seen = new Set([start.join()]);
        const queue = [start];
        let found = null;
        while (queue.length && seen.size < 260 && !found) {
          const [x, y] = queue.shift();
          for (let dy = -2; dy <= 2 && !found; dy++) {
            for (let dx = -2; dx <= 2 && !found; dx++) {
              const name = areaAt(this.map, x + dx, y + dy);
              if (name && name !== here) found = name;
            }
          }
          const exit = (this.map.exits ?? []).find((e) => Math.abs(e.x - x) <= 2 && Math.abs(e.y - y) <= 2);
          if (exit && !found) found = exit.to;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (!isPath(nx, ny) || seen.has(`${nx},${ny}`) || Math.max(Math.abs(nx - jx), Math.abs(ny - jy)) < 3) continue;
            seen.add(`${nx},${ny}`);
            queue.push([nx, ny]);
          }
        }
        // Směr na obrazovce (izometrie: x doprava dolů, y doleva dolů).
        const angle = Math.atan2(bx + by, bx - by);
        const arrow = ARROWS[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
        const label = found ?? (here ? 'Greenvale' : null);
        if (label && !lines.some((l) => l.endsWith(label))) lines.push(`${arrow} ${label}`);
      }
      if (lines.length < 2) continue;
      // Ukazatel na nejbližším poli trávy vedle cesty (nepřekáží v chůzi).
      let spot = null;
      for (let r = 1; r <= 3 && !spot; r++) {
        for (let dy = -r; dy <= r && !spot; dy++) {
          for (let dx = -r; dx <= r && !spot; dx++) {
            const t = this.map.tiles[jy + dy]?.[jx + dx];
            if (t && !t.collides && !isPath(jx + dx, jy + dy)) spot = { x: jx + dx, y: jy + dy };
          }
        }
      }
      spot ??= { x: jx, y: jy };
      const screen = this.iso.toScreen((spot.x + 0.5) * TILE_SIZE, (spot.y + 0.5) * TILE_SIZE);
      if (this.textures.exists(key)) {
        this.add.image(screen.x, screen.y + 10, key).setOrigin(0.5, 0.9).setScale(SHEET_SCALE).setDepth(screen.y + 10);
      }
      const text = cardText(this, screen.x, screen.y - 70, lines.join('\n'), {
        size: 19, bold: true, color: '#ffe7ae', originX: 0.5, originY: 1, strokeThickness: 5, lineSpacing: 4
      }).setDepth(DEPTH.hud - 1).setVisible(false);
      const bg = this.add.graphics().setDepth(DEPTH.hud - 2).setVisible(false);
      bg.fillStyle(0x08111d, 0.85).fillRoundedRect(text.x - text.width / 2 - 12, text.y - text.height - 8, text.width + 24, text.height + 16, 10);
      bg.lineStyle(2, 0xd6a23a, 0.9).strokeRoundedRect(text.x - text.width / 2 - 12, text.y - text.height - 8, text.width + 24, text.height + 16, 10);
      this.signposts.push({ x: spot.x, y: spot.y, text, bg, lines });
    }
  }

  // Popisky rozcestníků: vidět jen u hrdiny (do 3 polí).
  refreshSignposts(tileX, tileY) {
    for (const s of this.signposts ?? []) {
      const near = Math.max(Math.abs(s.x - tileX), Math.abs(s.y - tileY)) <= 3;
      s.text.setVisible(near);
      s.bg.setVisible(near);
    }
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
      g.lineStyle(4, 0xff40ff, 0.9).strokeEllipse(center.x, center.y, 70, 35, ELLIPSE_POINTS);
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
    // Vzniká až po nastavení kamer: svět jen na hlavní kameře, panel jen na kameře rozhraní.
    this.uiCamera?.ignore([g, this.hoverOutline, ...labels]);
    this.cameras.main.ignore(this.debugInfo);
  }

  setDebugVisible(visible) {
    if (visible && !this.debugBuilt) {
      this.debugBuilt = true;
      this.createDebugOverlay();
    }
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
    if (target.type === 'herbSite') {
      const spot = (this.map.herbSpots ?? []).find((s) => s.site === target.site);
      return spot ? { key: `${questId}:${target.site}`, x: spot.x, y: spot.y } : null;
    }
    // Rybářské místo / naleziště Těžby (řemeslné linie): první místo dané lokality / žíly.
    if (target.type === 'fishingSpot') {
      const spot = (this.map.fishingSpots ?? []).find((s) => s.location === target.location);
      return spot ? { key: `${questId}:${target.location}`, x: spot.x, y: spot.y } : null;
    }
    if (target.type === 'miningSpot') {
      const spot = (this.map.miningSpots ?? []).find((s) => s.deposit === target.deposit);
      return spot ? { key: `${questId}:${target.deposit}`, x: spot.x, y: spot.y } : null;
    }
    if (target.type === 'meadow' && questId === 'greenvale_mage_intro') {
      return { key: `${questId}:meadow`, x: INTRO_MEADOW.x, y: INTRO_MEADOW.y };
    }
    if (target.type === 'meadow') {
      // Nejbližší pole louky (zóna setkání) k hrdinovi – spočítá se jednou za úkol.
      if (!this.meadowTarget || this.meadowTarget.quest !== questId) {
        const px = Math.floor(this.player.x / TILE_SIZE);
        const py = Math.floor(this.player.y / TILE_SIZE);
        // target.species: jen louky, kde ten druh žije (např. První lov → Wild Boar).
        // target.zone: jen jedna konkrétní louka (Nový společník → Skalní stráň).
        const zones = target.zone ? (this.map.encounterZones ?? []).filter((z) => z.id === target.zone)
          : target.species ? (this.map.encounterZones ?? []).filter((z) => z.species?.includes(target.species)) : null;
        let best = null;
        for (let y = 0; y < this.map.height; y++) for (let x = 0; x < this.map.width; x++) {
          if (!this.tileAt(x, y)?.encounter || this.isBlocked((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE)) continue;
          if (zones && !zones.some((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)) continue;
          const d = (x - px) ** 2 + (y - py) ** 2;
          if (!best || d < best.d) best = { x, y, d };
        }
        this.meadowTarget = best ? { quest: questId, x: best.x, y: best.y } : null;
      }
      return this.meadowTarget ? { key: `${questId}:meadow`, x: this.meadowTarget.x, y: this.meadowTarget.y } : null;
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
    if (this.occlusionBlocked?.has(`${x},${y}`)) return false;
    const cx = x + 0.5;
    const cy = y + 0.5;
    return !this.collisionRects().some((r) => cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h);
  }

  // A* po mřížce mapy; cesty, dlažba, mosty a molo jsou mnohem levnější (pole mimo cestu
  // stojí 12×), takže tečky vedou po cestách, dokud to jde, i když to není nejkratší trasa –
  // z cesty sejdou až tam, kde k cíli jinak nevede.
  findTrailPath(from, to) {
    const W = this.map.width;
    const H = this.map.height;
    const idx = (x, y) => y * W + x;
    const ROAD = new Set(['path', 'plaza', 'bridge', 'dock']);
    const cost = (x, y) => (ROAD.has(this.tileAt(x, y)?.id) ? 1 : TRAIL_OFFROAD_COST);
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
    while (open.length && steps++ < 200000) {
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
    // Trasa drží pole: tečky leží pevně na polích mapy (jedna tečka = jedno pole) a při chůzi
    // po trase se jen odmazávají prošlá pole. Celá cesta se přepočítá jen při změně cíle nebo
    // když hrdina z trasy sejde (víc než 1 pole od ní).
    if (Math.hypot(px - target.x, py - target.y) < 1.5) {
      this.trailPath = [];
    } else if (this.trailKey !== target.key || !this.trailPath) {
      this.trailKey = target.key;
      this.trailPath = this.findTrailPath({ x: px, y: py }, target);
    } else {
      const path = this.trailPath;
      const at = path.findIndex((c) => c.x === px && c.y === py);
      if (at >= 0) {
        this.trailPath = path.slice(at + 1); // hrdina stojí na poli trasy – prošlá pole zmizí
      } else if (!path.length || Math.min(...path.slice(0, 4).map((c) => Math.max(Math.abs(c.x - px), Math.abs(c.y - py)))) > 1) {
        this.trailPath = this.findTrailPath({ x: px, y: py }, target);
      }
    }
    const g = this.questTrail.clear();
    const path = this.trailPath ?? [];
    // Tyrkysové magické tečky (dobře vidět na trávě i dlažbě), vlna běží směrem k cíli.
    const phase = this.time.now / 160;
    for (let i = 0; i < path.length - 1; i++) {
      const cell = path[i];
      const p = this.iso.toScreen((cell.x + 0.5) * TILE_SIZE, (cell.y + 0.5) * TILE_SIZE);
      const wave = 0.5 + 0.5 * Math.max(0, Math.cos((i - phase) * 0.6));
      g.fillStyle(0x062a33, 0.65).fillEllipse(p.x, p.y + 3, 30, 16, ELLIPSE_POINTS);
      g.fillStyle(0x3fe0ff, 0.55 + 0.45 * wave).fillEllipse(p.x, p.y, 24, 13, ELLIPSE_POINTS);
      g.fillStyle(0xe6fcff, 0.4 + 0.5 * wave).fillEllipse(p.x - 3, p.y - 2, 9, 5, ELLIPSE_POINTS);
    }
    // Cíl: zlatý kroužek.
    if (path.length) {
      const end = this.iso.toScreen((target.x + 0.5) * TILE_SIZE, (target.y + 0.5) * TILE_SIZE);
      g.lineStyle(6, 0x3fe0ff, 0.6 + 0.4 * Math.sin(this.time.now / 250)).strokeEllipse(end.x, end.y, 90, 48, ELLIPSE_POINTS);
    }
  }

  // Značky úkolů nad budovami („!“ / „?“ zlatě u zadavatele, modré „?“ u cíle s rozhovorem).
  // Obnoví se jednou za chvíli (stav úkolu se mění v interiérech).
  updateQuestMarks() {
    if (this.time.now - (this.questMarksAt ?? -9999) < 500) return;
    this.questMarksAt = this.time.now;
    this.questMarkTexts ??= new Map();
    const marks = worldQuestMarks(this.state, this.state.region || 'Greenvale');
    const wanted = new Set(marks.map((m) => m.buildingId));
    for (const [id, text] of this.questMarkTexts) {
      if (!wanted.has(id)) { text.destroy(); this.questMarkTexts.delete(id); }
    }
    this.drawDoorRings();
    for (const mark of marks) {
      let text = this.questMarkTexts.get(mark.buildingId);
      if (!text) {
        const building = this.map.buildings.find((b) => b.id === mark.buildingId);
        const image = this.buildingImages?.get(mark.buildingId);
        if (!building) continue;
        const base = this.iso.toScreen((building.x + building.width / 2) * TILE_SIZE, (building.y + building.height / 2) * TILE_SIZE);
        const top = image ? image.y - image.displayHeight - 10 : base.y - 220;
        text = this.add.text(image ? image.x : base.x, top, '', {
          fontFamily: 'Lora, Georgia, serif', fontSize: '96px', fontStyle: 'bold', color: mark.color, stroke: '#1a0f05', strokeThickness: 12
        }).setOrigin(0.5, 1).setDepth(DEPTH.debug - 200);
        this.uiCamera?.ignore(text);
        this.tweens.add({ targets: text, y: top - 22, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.questMarkTexts.set(mark.buildingId, text);
      }
      text.setText(mark.char).setColor(mark.color);
    }
  }

  // Trvalé kruhy před vstupy do budov s interiérem: žluté, modré tam, kde má hráč dokončit krok
  // úkolu (rozhovor u cíle, návrat k zadavateli).
  drawDoorRings() {
    // Každý kruh je samostatný objekt na poli vstupu před budovou (mimo její obrázek). Kreslí se
    // pod hrdinou i pod budovami – nikdy přes jejich texturu (u natěsno postavených domů ho
    // případně kousek zakryje sousední budova).
    this.doorRings ??= new Map();
    const blue = questEndBuildings(this.state, this.state.region || 'Greenvale');
    for (const door of this.doors ?? []) {
      const id = door.building.id;
      // Nemovitost na prodej / vlastní obchod (Diplomacie): fialový kruh, pod potřebnou úrovní šedý.
      const property = this.propertyDoorState(id);
      const color = property ? (property.locked ? 0x8a8a8a : 0xb57cff) : blue.has(id) ? 0x5ab8ff : 0xffd23a;
      let ring = this.doorRings.get(id);
      if (ring && ring.color === color) continue;
      if (!ring) {
        const p = this.iso.toScreen(door.x, door.y);
        const own = this.buildingImages?.get(id)?.depth ?? Infinity;
        const g = this.cullPoint(this.add.graphics().setPosition(p.x, p.y).setDepth(Math.min(p.y - 6, own - 1)), p.x, p.y);
        this.uiCamera?.ignore(g);
        this.tweens.add({ targets: g, alpha: 0.78, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        ring = { g, color: null };
        this.doorRings.set(id, ring);
      }
      ring.color = color;
      ring.g.clear()
        .fillStyle(color, 0.38).fillEllipse(0, 0, 104, 52, ELLIPSE_POINTS)
        .lineStyle(12, color, 0.3).strokeEllipse(0, 0, 104, 52, ELLIPSE_POINTS)
        .lineStyle(7, color, 1).strokeEllipse(0, 0, 104, 52, ELLIPSE_POINTS)
        .lineStyle(2, 0xffffff, 0.7).strokeEllipse(0, -1, 94, 45, ELLIPSE_POINTS);
    }
  }

  // Vstup do nemovitosti z Diplomacie: { owned, locked, prompt } nebo null (běžná budova).
  propertyDoorState(buildingId) {
    const prop = PROPERTIES[buildingId];
    if (!prop) return null;
    const shop = getShop(this.state, buildingId);
    const owned = Boolean(shop);
    const needed = PROPERTY_TYPES[prop.type].level;
    const level = diplomacyLevel(this.state);
    const locked = !owned && level < needed;
    let prompt;
    if (owned) prompt = `E: vstoupit – ${shop.name}`;
    else if (locked) prompt = `${prop.name} – na prodej (odemkne se na Diplomacii ${needed}, máš ${level})`;
    else prompt = `${prop.name} – na prodej · kup ho u starosty na radnici`;
    return { owned, locked, prompt };
  }

  // Nástěnka na náměstí (budova bez interiéru): E otevře Nástěnku úkolů.
  findNearbyNoticeBoard() {
    const board = this.map.buildings.find((b) => b.id.endsWith('notice_board'));
    if (!board) return null;
    const cx = (board.x + board.width / 2) * TILE_SIZE;
    const cy = (board.y + board.height / 2) * TILE_SIZE;
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, cy) < TILE_SIZE * 1.8 ? board : null;
  }

  // ---------------------------------------------------------- den a noc (TimeSystem.js)
  // Hrdina nosí stále lucernu: pole do vzdálenosti 8 polí jsou světlá (jen lehký nádech noci),
  // za hranou (hranatou po celých polích) tma, která k okraji obrazovky houstne do úplné tmy. Kreslí se po řadách polí (souvislé
  // úseky = jeden kosodélník) a jen při změně pole hrdiny nebo rozsahu pohledu.
  // Síla tmy podle denní doby (alpha celé vrstvy) – na úsvitu a soumraku plynule.
  createNightOverlay() {
    this.nightShade = this.add.graphics().setDepth(DEPTH.night);
    this.nightKey = '';
    this.updateNight();
  }

  updateNight() {
    if (!this.nightShade || !this.player) return;
    const level = darkness(this.state) * NIGHT_MAX_ALPHA;
    const visible = level > 0.01;
    this.nightShade.setVisible(visible);
    if (!visible) return;
    this.nightShade.setAlpha(level);
    const px = Math.floor(this.player.x / TILE_SIZE);
    const py = Math.floor(this.player.y / TILE_SIZE);
    // Kolik polí kolem hrdiny pokrýt, aby tma sahala za okraj pohledu (podle přiblížení).
    const view = this.cameras.main.worldView;
    const n = Math.ceil(view.width / 2 / ISO_TILE_WIDTH + view.height / 2 / ISO_TILE_HEIGHT) + 4;
    const key = `${px},${py},${n},${Math.round(view.width)}`;
    if (key === this.nightKey) return;
    this.nightKey = key;

    const g = this.nightShade.clear();
    const R = LANTERN_TILES + 0.5;
    const hw = view.width / 2;
    const hh = view.height / 2;
    const kx = ISO_TILE_WIDTH / 2;
    const ky = ISO_TILE_HEIGHT / 2;
    // Průhlednost pole: uvnitř lucerny nádech noci; za hranou od NIGHT_EDGE plynule do úplné
    // tmy na okraji obrazovky (podle přiblížení). Zaokrouhleno na kroky → souvislé úseky v řadě.
    const alphaAt = (dx, dy) => {
      const r = Math.hypot(dx, dy);
      if (r <= R - LANTERN_FADE) return LANTERN_INNER;
      // Poslední pole lucerny: světlo plynule slábne k tmě za hranou.
      if (r <= R) return Math.round((LANTERN_INNER + (NIGHT_EDGE - LANTERN_INNER) * (r - R + LANTERN_FADE) / (LANTERN_FADE + 1)) * 20) / 20;
      // Poloha středu pole na obrazovce vůči hrdinovi; e = 1 na okraji pohledu.
      const e = Math.max(Math.abs((dx - dy) * kx) / hw, Math.abs((dx + dy) * ky) / hh);
      const rEdge = e > 0 ? r / e : r;
      const t = rEdge > R ? Phaser.Math.Clamp((r - R) / (rEdge - R), 0, 1) : 1;
      return Math.round((NIGHT_EDGE + (1 - NIGHT_EDGE) * t) * 20) / 20;
    };
    const strip = (x0, x1, y, alpha) => {
      const a = this.iso.toScreen(x0 * TILE_SIZE, y * TILE_SIZE);
      const b = this.iso.toScreen(x1 * TILE_SIZE, y * TILE_SIZE);
      const c = this.iso.toScreen(x1 * TILE_SIZE, (y + 1) * TILE_SIZE);
      const d = this.iso.toScreen(x0 * TILE_SIZE, (y + 1) * TILE_SIZE);
      g.fillStyle(0x03060f, alpha).fillPoints([a, b, c, d], true);
    };
    for (let y = py - n; y <= py + n; y += 1) {
      let start = px - n;
      let current = alphaAt(start - px, y - py);
      for (let x = px - n + 1; x <= px + n + 1; x += 1) {
        const alpha = x <= px + n ? alphaAt(x - px, y - py) : -1;
        if (alpha === current) continue;
        strip(start, x, y, current);
        start = x;
        current = alpha;
      }
    }
  }

  // Čas běží jen při hraní ve světě (ne pod kartou); hodiny v HUD se mění po herních minutách.
  updateTime(delta) {
    if (tickTime(this.state, delta)) this.partyHud?.setClock(dayClockLabel(this.state));
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

  update(_time, delta = 16) {
    if (!this.player) return;

    this.cullGround();

    if (this.editorActive) {
      this.updateEditorCamera();
      return;
    }

    this.updateQuestTrail();
    this.updateQuestMarks();
    this.updateBuildingFade();
    this.updateNight();
    if (this.cardOpen()) {
      this.updateUnderCard();
      return;
    }
    this.updateTime(delta);
    if (this.wasUnderCard) {
      this.wasUnderCard = false;
      this.savePosition();
    }

    this.player.updateMovement(this.cursors, this.wasd);

    const door = this.findNearbyDoor();

    const property = door ? this.propertyDoorState(door.building.id) : null;
    if (door) {
      this.prompt
        .setText(property ? property.prompt : `E: vstoupit – ${door.building.name}`)
        .setPosition(this.player.view.x, this.player.view.y - 125)
        .setVisible(true);
    } else {
      this.prompt.setVisible(false);
    }

    if (door && Phaser.Input.Keyboard.JustDown(this.keys.interact) && (!property || property.owned)) {
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

    // Esc = nabídka pauzy (Vrátit se, Uložit, Načíst, Nastavení…), ne hlavní menu.
    if (Phaser.Input.Keyboard.JustDown(this.keys.menu) && !this.leavingToMenu) {
      this.savePosition();
      this.player.stop();
      // Náhled hry pro sloty uložení – snímek před otevřením pauzy.
      this.leavingToMenu = true;
      SaveSystem.capturePreview(this.game, () => {
        this.leavingToMenu = false;
        this.partyHud?.setVisible(false);
        this.scene.pause();
        this.scene.launch('Pause', { state: this.state, returnScene: this.scene.key });
        this.scene.bringToTop('Pause');
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
