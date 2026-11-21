import Phaser from 'phaser';
import WorldHero from '../entities/WorldHero.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { TILE_SIZE, TILE_TYPES } from '../data/tiles.js';
import { loadWorldMap } from '../data/maps/index.js';
import { BUILDING_SPRITES, buildingTextureKey } from '../entities/buildingSprites.js';
import { createIsoProjection, ISO_TILE_WIDTH } from '../world/iso.js';
import { pickTerrainVariant, terrainPlacement } from '../world/terrainTiles.js';
import { OBJECT_VARIANTS, SHEET_SCALE, objectTextureKey } from '../entities/objectSprites.js';

// Verze rozvržení světa v uložené hře. Při změně se hráč přesune na start mapy.
const WORLD_LAYOUT_VERSION = 7;

const TILESET_KEY = 'world-tileset';

// Po kolika polích tmavé louky přijde náhodné setkání (náhodně v tomto rozmezí).
const ENCOUNTER_STEPS = { min: 8, max: 18 };
const DOOR_REACH = TILE_SIZE * 0.9;

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
    this.state.region ??= 'Greenvale';
  }

  create() {
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

    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      // Po návratu z interiéru by mohly zůstat "držené" klávesy.
      this.input.keyboard.resetKeys();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('wheel', this.onWheel);
      this.savePosition();
    });
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

        // Most, molo, jeskyně a vodopád zatím jako plochá pole přes terén.
        if (['bridge', 'dock', 'waterfall'].includes(tile.id)) {
          this.drawFlatTile(overlay, x, y, tile);
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

        this.add.image(center.x + jitter, baseY, key)
          .setOrigin(0.5, 1)
          .setScale(SHEET_SCALE * scale)
          .setFlipX(tile.object !== 'rock' && roll < 0.5)
          .setDepth(baseY);
      }
    }
  }

  // Doplňky ze seznamu `decor` v mapě (ploty, keře, rostliny, pařezy, rozcestník)
  // a jeskyně. Kolizi mají jen ploty – tenké zdi na hraně pole.
  createDecorations() {
    this.decorBodies = this.physics.add.staticGroup();

    for (const [type, x, y, extra] of this.map.decor ?? []) {
      const screen = this.iso.toScreen(x * TILE_SIZE, y * TILE_SIZE);
      const roll = tileHash(Math.round(x * 10), Math.round(y * 10));

      if (type === 'fence') {
        const kind = extra === 'x' ? 'fenceX' : 'fenceY';
        const index = Math.floor(roll * OBJECT_VARIANTS[kind].length);
        const key = objectTextureKey(kind, index);
        if (this.textures.exists(key)) {
          this.add.image(screen.x, screen.y, key)
            .setOrigin(0.5, 0.84)
            .setScale(SHEET_SCALE)
            .setDepth(screen.y);
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

      const scale = type === 'signpost' ? 1 : 0.8 + roll * 0.35;
      this.add.image(screen.x, screen.y, key)
        .setOrigin(0.5, 0.9)
        .setScale(SHEET_SCALE * scale)
        .setFlipX(type !== 'signpost' && roll < 0.5)
        .setDepth(screen.y);
    }

    this.createCave();
  }

  // Jeskyně: obrázek vchodu na poli C, ústím k jihovýchodu (ke kameře).
  createCave() {
    const key = objectTextureKey('cave', 0);
    if (!this.textures.exists(key)) return;

    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (this.map.tiles[y][x].id !== 'cave') continue;

        const front = this.iso.toScreen((x + 0.85) * TILE_SIZE, (y + 0.85) * TILE_SIZE);
        this.add.image(front.x, front.y, key)
          .setOrigin(0.5, 0.95)
          .setScale(SHEET_SCALE * 1.35)
          .setDepth(front.y);
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
        image.setScale((footprintWidth * sprite.scale) / image.width).setDepth(center.y);
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

    if (this.tileAt(tileX, tileY)?.id !== 'meadow') return false;

    this.encounterSteps = (this.encounterSteps ?? 0) + 1;
    this.encounterThreshold ??= Phaser.Math.Between(ENCOUNTER_STEPS.min, ENCOUNTER_STEPS.max);
    if (this.encounterSteps < this.encounterThreshold) return false;

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
    this.player.stop();
    this.prompt.setVisible(false);
    this.savePosition();
    this.scene.pause();
    this.scene.launch('Hero', { state: this.state, returnScene: this.scene.key });
  }

  // Rozhraní má vlastní kameru, aby se nezoomovalo se světem.
  setupUiCamera() {
    const hud = [this.hudText, this.debugInfo];

    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.ignore(this.children.list.filter((object) => !hud.includes(object)));
    this.cameras.main.ignore(hud);
  }

  createHud() {
    this.hudText = this.add.text(
      24,
      20,
      'POHYB: WASD / šipky   E: vstoupit   C: karta hrdiny   B: testovací souboj   ZOOM: kolečko   G: mřížka   R: referenční mapa   ESC: menu',
      {
        fontSize: '18px',
        color: '#fff1c6',
        backgroundColor: '#17251f',
        padding: { x: 10, y: 6 }
      }
    )
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);

    this.prompt = this.add.text(0, 0, '', {
      fontSize: '20px',
      color: '#fff4d6',
      backgroundColor: '#2a1a10cc',
      padding: { x: 10, y: 6 }
    })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.hud)
      .setVisible(false);
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
      g.fillStyle(0xffd040, 0.55).fillPoints(
        this.iso.tileDiamond(building.door.x, building.door.y),
        true
      );
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

  update() {
    if (!this.player) return;

    this.cullGround();

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

    if (Phaser.Input.Keyboard.JustDown(this.keys.testBattle)) {
      this.startBattle({ type: 'test' });
      return;
    }

    if (this.checkEncounter()) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.menu)) {
      this.savePosition();
      this.scene.start('Menu', { state: this.state });
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
