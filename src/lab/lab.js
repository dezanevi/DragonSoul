// Laboratoř terénů – samostatné okno mimo hru (otevři /lab.html).
// Vykresluje jen hrdinu na gridu a textury, které do okna přetáhneš.
// Nic z toho se neukládá do hry; nastavení si pamatuje jen tento prohlížeč.
//
// Dva pohledy:
//   iso     – izometrický jako ve hře (pole 128 × 64 px, kamera z JV)
//   square  – čtvercový shora (pole 64 × 64 px)
//
// Dva typy obrázků:
//   seamless – opakovatelná textura shora; v izometrii se promítne na kosočtverce
//   tile     – hotová izometrická dlaždice (kosočtverec 2 : 1, případně vyšší)

import Phaser from 'phaser';
import Player from '../entities/Player.js';
import {
  loadHeroSprite,
  createHeroAnimations,
  HERO_DISPLAY_HEIGHT,
  HERO_TEXTURE,
  HERO_FRAME_HEIGHT
} from '../entities/heroSprite.js';
import { TILE_SIZE } from '../data/tiles.js';
import { createIsoProjection, ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from '../world/iso.js';

const SQUARE_TILES_X = 40;
const SQUARE_TILES_Y = 24;
const ISO_TILES = 28;
const STORAGE_KEY = 'dragon-souls-lab-v1';
const GROUND_KEY = 'lab-ground';

// ------------------------------------------------------------- nastavení

const defaults = {
  view: 'iso',
  heroHeight: HERO_DISPLAY_HEIGHT,
  zoom: 1,
  grid: true,
  smooth: false,
  baseColor: '#5c7a4a',
  fillBase: false,
  tilesPerTexture: {},
  textureKind: {}
};

const settings = { ...defaults, ...readStorage() };
settings.tilesPerTexture ??= {};
settings.textureKind ??= {};

function readStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Úložiště nemusí být dostupné – laboratoř funguje i bez něj.
  }
}

// Načtené textury: name → { image, url }
const textures = new Map();
let selectedTexture = null;

// Namalovaná pole: "x,y" → název textury. Každý pohled má svou malbu.
const painted = { iso: new Map(), square: new Map() };

// Rozměry aktuálního pohledu.
function layout() {
  if (settings.view === 'iso') {
    const iso = createIsoProjection(ISO_TILES, ISO_TILES);
    return {
      tilesX: ISO_TILES,
      tilesY: ISO_TILES,
      width: iso.width,
      height: iso.height,
      iso
    };
  }

  return {
    tilesX: SQUARE_TILES_X,
    tilesY: SQUARE_TILES_Y,
    width: SQUARE_TILES_X * TILE_SIZE,
    height: SQUARE_TILES_Y * TILE_SIZE,
    iso: null
  };
}

// ------------------------------------------------------------------ scéna

class LabScene extends Phaser.Scene {
  constructor() {
    super('Lab');
  }

  preload() {
    loadHeroSprite(this);
  }

  create() {
    createHeroAnimations(this);

    this.gridGraphics = this.add.graphics().setDepth(5000);
    this.player = new Player(this, 0, 0, {});

    const camera = this.cameras.main;
    camera.startFollow(this.player, true, 0.15, 0.15);
    camera.setBackgroundColor('#0b0f13');

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => this.paintAt(pointer));
    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown) this.paintAt(pointer);
    });
    this.input.on('wheel', (_pointer, _objects, _dx, dy) => {
      setZoom(settings.zoom + (dy < 0 ? 0.1 : -0.1));
    });

    this.buildView();
    applySettings();
  }

  // Postaví podklad, mřížku a hranice pro aktuální pohled.
  buildView() {
    this.layout = layout();
    const { width, height } = this.layout;

    if (this.groundImage) this.groundImage.destroy();
    if (this.textures.exists(GROUND_KEY)) this.textures.remove(GROUND_KEY);

    this.groundCanvas = this.textures.createCanvas(GROUND_KEY, width, height);
    this.groundImage = this.add.image(0, 0, GROUND_KEY).setOrigin(0, 0).setDepth(-10);

    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.setBounds(-200, -300, width + 400, height + 500);
    this.player.setPosition(width / 2, height / 2);

    this.drawGrid();
  }

  update() {
    this.player.updateMovement(this.cursors, this.wasd);
  }

  // Pole pod ukazatelem myši (v souřadnicích mřížky).
  tileAtPointer(pointer) {
    const world = pointer.positionToCamera(this.cameras.main);

    if (this.layout.iso) {
      const logical = this.layout.iso.toLogical(world.x, world.y);
      return {
        x: Math.floor(logical.x / TILE_SIZE),
        y: Math.floor(logical.y / TILE_SIZE)
      };
    }

    return {
      x: Math.floor(world.x / TILE_SIZE),
      y: Math.floor(world.y / TILE_SIZE)
    };
  }

  paintAt(pointer) {
    const { x, y } = this.tileAtPointer(pointer);
    const { tilesX, tilesY } = this.layout;

    if (x < 0 || y < 0 || x >= tilesX || y >= tilesY) return;

    const key = `${x},${y}`;
    const map = painted[settings.view];

    if (pointer.rightButtonDown()) {
      if (!map.has(key)) return;
      map.delete(key);
    } else {
      if (!selectedTexture || map.get(key) === selectedTexture) return;
      map.set(key, selectedTexture);
    }

    this.redrawGround();
  }

  drawGrid() {
    const g = this.gridGraphics;
    const { tilesX, tilesY, iso } = this.layout;
    g.clear();

    if (iso) {
      for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x++) {
          const strong = x % 4 === 0 || y % 4 === 0;
          g.lineStyle(strong ? 2 : 1, 0x000000, strong ? 0.4 : 0.25);
          g.strokePoints(iso.tileDiamond(x, y), true);
        }
      }
      return;
    }

    const width = tilesX * TILE_SIZE;
    const height = tilesY * TILE_SIZE;

    for (let x = 0; x <= tilesX; x++) {
      g.lineStyle(x % 4 === 0 ? 2 : 1, 0x000000, x % 4 === 0 ? 0.45 : 0.35);
      g.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, height);
    }
    for (let y = 0; y <= tilesY; y++) {
      g.lineStyle(y % 4 === 0 ? 2 : 1, 0x000000, y % 4 === 0 ? 0.45 : 0.35);
      g.lineBetween(0, y * TILE_SIZE, width, y * TILE_SIZE);
    }
  }

  // Překreslí celý podklad. Opakovatelná textura bere výřez podle pozice pole
  // ve světě, takže sousední pole stejné textury navazují.
  redrawGround() {
    const ctx = this.groundCanvas.getContext();
    const { tilesX, tilesY, width, height, iso } = this.layout;
    const patterns = new Map();
    const map = painted[settings.view];

    const patternFor = (name) => {
      if (!patterns.has(name)) patterns.set(name, buildPattern(name));
      return patterns.get(name);
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = settings.smooth;

    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        const name = map.get(`${x},${y}`) ?? (settings.fillBase ? selectedTexture : null);
        const texture = name ? textures.get(name) : null;

        if (iso) {
          drawIsoTile(ctx, iso, x, y, texture ? name : null, patternFor);
        } else {
          drawSquareTile(ctx, x, y, texture ? name : null, patternFor);
        }
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.groundCanvas.refresh();
  }
}

function drawSquareTile(ctx, x, y, name, patternFor) {
  const worldX = x * TILE_SIZE;
  const worldY = y * TILE_SIZE;

  if (!name) {
    ctx.fillStyle = settings.baseColor;
    ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);
    return;
  }

  if (kindFor(name) === 'tile') {
    const { image } = textures.get(name);
    ctx.drawImage(image, worldX, worldY, TILE_SIZE, TILE_SIZE);
    return;
  }

  const pattern = patternFor(name);
  const size = pattern.width;
  ctx.drawImage(pattern, worldX % size, worldY % size, TILE_SIZE, TILE_SIZE, worldX, worldY, TILE_SIZE, TILE_SIZE);
}

function drawIsoTile(ctx, iso, x, y, name, patternFor) {
  const diamond = iso.tileDiamond(x, y);

  if (!name || kindFor(name) === 'seamless') {
    if (!name) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = settings.baseColor;
      ctx.beginPath();
      diamond.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
      return;
    }

    // Čtvercový výřez textury se promítne na kosočtverec stejně jako ve hře:
    // x' = originX + lx − ly, y' = (lx + ly) / 2.
    const origin = iso.toScreen(0, 0);
    ctx.setTransform(1, 0.5, -1, 0.5, origin.x, origin.y);

    const pattern = patternFor(name);
    const size = pattern.width;
    const lx = x * TILE_SIZE;
    const ly = y * TILE_SIZE;
    ctx.drawImage(pattern, lx % size, ly % size, TILE_SIZE, TILE_SIZE, lx, ly, TILE_SIZE, TILE_SIZE);
    return;
  }

  // Hotová izometrická dlaždice: šířka 128 px, spodní roh obrázku na spodním rohu pole.
  const { image } = textures.get(name);
  const drawWidth = ISO_TILE_WIDTH;
  const drawHeight = (image.height / image.width) * drawWidth;
  const bottom = diamond[2];

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(image, bottom.x - drawWidth / 2, bottom.y - drawHeight, drawWidth, drawHeight);
}

// Zmenší opakovatelnou texturu na velikost, kterou bude mít ve hře.
function buildPattern(name) {
  const { image } = textures.get(name);
  const size = tilesFor(name) * TILE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = settings.smooth;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, size, size);
  return canvas;
}

function tilesFor(name) {
  return settings.tilesPerTexture[name] ?? 8;
}

function kindFor(name) {
  return settings.textureKind[name] ?? 'seamless';
}

// ------------------------------------------------------------------ hra

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  backgroundColor: '#0b0f13',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%'
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: [LabScene]
});

function scene() {
  const lab = game.scene.getScene('Lab');
  return lab?.player && lab.groundCanvas ? lab : null;
}

// ------------------------------------------------------------ ovládací panel

const $ = (id) => document.getElementById(id);

const ui = {
  view: $('view'),
  heroHeight: $('heroHeight'),
  heroHeightOut: $('heroHeightOut'),
  heroInfo: $('heroInfo'),
  zoom: $('zoom'),
  zoomOut: $('zoomOut'),
  grid: $('grid'),
  smooth: $('smooth'),
  baseColor: $('baseColor'),
  drop: $('drop'),
  file: $('file'),
  list: $('textures'),
  kind: $('kind'),
  tiles: $('tiles'),
  tilesOut: $('tilesOut'),
  textureInfo: $('textureInfo'),
  fillBase: $('fillBase'),
  clearPaint: $('clearPaint'),
  export: $('export')
};

function setZoom(value) {
  settings.zoom = Phaser.Math.Clamp(Math.round(value * 100) / 100, 0.3, 3);
  saveSettings();
  applySettings();
}

function fieldHeight() {
  return settings.view === 'iso' ? ISO_TILE_HEIGHT : TILE_SIZE;
}

function applySettings() {
  ui.view.value = settings.view;
  ui.heroHeight.value = settings.heroHeight;
  ui.heroHeightOut.value = `${settings.heroHeight} px`;
  ui.heroInfo.textContent =
    (settings.view === 'iso'
      ? `${(settings.heroHeight / ISO_TILE_HEIGHT).toFixed(2)} výšky pole (pole 128 × 64 px)\n`
      : `${(settings.heroHeight / TILE_SIZE).toFixed(2)} pole na výšku (pole 64 × 64 px)\n`) +
    `měřítko snímku ${(settings.heroHeight / HERO_FRAME_HEIGHT).toFixed(3)}\n` +
    `ve hře nastaveno: ${HERO_DISPLAY_HEIGHT} px (heroSprite.js)`;

  ui.zoom.value = settings.zoom;
  ui.zoomOut.value = `${settings.zoom.toFixed(2)}×`;
  ui.grid.checked = settings.grid;
  ui.smooth.checked = settings.smooth;
  ui.baseColor.value = settings.baseColor;
  ui.fillBase.checked = settings.fillBase;

  updateTextureInfo();

  const lab = scene();
  if (!lab) return;

  lab.player.setDisplayHeight(settings.heroHeight);
  lab.cameras.main.setZoom(settings.zoom);
  lab.gridGraphics.setVisible(settings.grid);

  const filter = settings.smooth
    ? Phaser.Textures.FilterMode.LINEAR
    : Phaser.Textures.FilterMode.NEAREST;
  lab.textures.get(GROUND_KEY).setFilter(filter);
  lab.textures.get(HERO_TEXTURE).setFilter(filter);

  lab.redrawGround();
}

function updateTextureInfo() {
  if (!selectedTexture) {
    ui.kind.disabled = true;
    ui.tiles.disabled = true;
    ui.tilesOut.value = '';
    ui.textureInfo.textContent = 'Žádná textura. Přetáhni sem obrázek terénu.';
    return;
  }

  const { image } = textures.get(selectedTexture);
  const kind = kindFor(selectedTexture);
  ui.kind.disabled = false;
  ui.kind.value = kind;

  if (kind === 'tile') {
    const height = Math.round((image.height / image.width) * ISO_TILE_WIDTH);
    ui.tiles.disabled = true;
    ui.tilesOut.value = '';
    ui.textureInfo.textContent = [
      selectedTexture,
      `zdroj ${image.width} × ${image.height} px`,
      `ve hře ${ISO_TILE_WIDTH} × ${height} px (šířka pole)`,
      `1 px zdroje = ${(ISO_TILE_WIDTH / image.width).toFixed(3)} px ve hře`,
      Math.abs(image.width / image.height - 2) > 0.05 && height <= ISO_TILE_HEIGHT
        ? 'Pozor: plochá dlaždice má mít poměr 2 : 1.'
        : 'Dlaždice se kotví spodním rohem na spodní roh pole.'
    ].join('\n');
    return;
  }

  const tiles = tilesFor(selectedTexture);
  const size = tiles * TILE_SIZE;
  const ratio = size / image.width;

  ui.tiles.disabled = false;
  ui.tiles.value = tiles;
  ui.tilesOut.value = `${tiles}×${tiles}`;

  const lines = [
    `${selectedTexture}`,
    `zdroj ${image.width} × ${image.height} px`,
    `pokryje ${tiles} × ${tiles} polí (${size} × ${size} logických px)`,
    `1 px textury = ${ratio.toFixed(3)} px pole`,
    `ostré 1:1 by bylo při zdroji ${size} × ${size} px`
  ];

  if (settings.view === 'iso') {
    lines.push('V izometrii se textura promítne na kosočtverce.');
  }

  if (image.width !== image.height) {
    lines.push('Pozor: obrázek není čtvercový, roztáhne se.');
  }

  ui.textureInfo.textContent = lines.join('\n');
}

function renderTextureList() {
  ui.list.innerHTML = '';

  for (const [name, texture] of textures) {
    const item = document.createElement('li');
    item.classList.toggle('selected', name === selectedTexture);

    const thumb = document.createElement('img');
    thumb.src = texture.url;
    thumb.alt = '';

    const label = document.createElement('span');
    label.textContent = name;
    label.title = name;

    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.title = 'Odebrat texturu';
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      removeTexture(name);
    });

    item.append(thumb, label, remove);
    item.addEventListener('click', () => selectTexture(name));
    ui.list.append(item);
  }
}

function selectTexture(name) {
  selectedTexture = name;
  renderTextureList();
  applySettings();
}

function removeTexture(name) {
  URL.revokeObjectURL(textures.get(name).url);
  textures.delete(name);

  for (const map of Object.values(painted)) {
    for (const [key, value] of map) {
      if (value === name) map.delete(key);
    }
  }

  if (selectedTexture === name) {
    selectedTexture = textures.keys().next().value ?? null;
  }

  renderTextureList();
  applySettings();
}

function addFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      // Odhad typu: obrázek v poměru zhruba 2 : 1 bude nejspíš izometrická dlaždice.
      if (!settings.textureKind[file.name]) {
        settings.textureKind[file.name] =
          Math.abs(image.width / image.height - 2) < 0.1 ? 'tile' : 'seamless';
        saveSettings();
      }

      textures.set(file.name, { image, url });
      selectTexture(file.name);
    };
    image.onerror = () => URL.revokeObjectURL(url);
    image.src = url;
  }
}

ui.view.addEventListener('change', () => {
  settings.view = ui.view.value;
  saveSettings();
  scene()?.buildView();
  applySettings();
});

ui.heroHeight.addEventListener('input', () => {
  settings.heroHeight = Number(ui.heroHeight.value);
  saveSettings();
  applySettings();
});

ui.zoom.addEventListener('input', () => setZoom(Number(ui.zoom.value)));

for (const id of ['grid', 'smooth', 'fillBase']) {
  ui[id].addEventListener('change', () => {
    settings[id] = ui[id].checked;
    saveSettings();
    applySettings();
  });
}

ui.baseColor.addEventListener('input', () => {
  settings.baseColor = ui.baseColor.value;
  saveSettings();
  applySettings();
});

ui.kind.addEventListener('change', () => {
  if (!selectedTexture) return;
  settings.textureKind[selectedTexture] = ui.kind.value;
  saveSettings();
  applySettings();
});

ui.tiles.addEventListener('input', () => {
  if (!selectedTexture) return;
  settings.tilesPerTexture[selectedTexture] = Number(ui.tiles.value);
  saveSettings();
  applySettings();
});

ui.drop.addEventListener('click', () => ui.file.click());
ui.file.addEventListener('change', () => {
  addFiles(ui.file.files);
  ui.file.value = '';
});

// Obrázky jde přetáhnout kamkoli do okna.
window.addEventListener('dragover', (event) => {
  event.preventDefault();
  ui.drop.classList.add('active');
});
window.addEventListener('dragleave', () => ui.drop.classList.remove('active'));
window.addEventListener('drop', (event) => {
  event.preventDefault();
  ui.drop.classList.remove('active');
  addFiles(event.dataTransfer.files);
});

ui.clearPaint.addEventListener('click', () => {
  painted[settings.view].clear();
  scene()?.redrawGround();
});

ui.export.addEventListener('click', async () => {
  const data = {
    view: settings.view,
    tile: settings.view === 'iso' ? `${ISO_TILE_WIDTH}x${ISO_TILE_HEIGHT}` : `${TILE_SIZE}x${TILE_SIZE}`,
    heroHeight: settings.heroHeight,
    smoothing: settings.smooth,
    textures: [...textures.entries()].map(([name, { image }]) => ({
      name,
      source: `${image.width}x${image.height}`,
      kind: kindFor(name),
      tilesPerTexture: kindFor(name) === 'seamless' ? tilesFor(name) : null
    }))
  };
  const text = JSON.stringify(data, null, 2);

  try {
    await navigator.clipboard.writeText(text);
    ui.export.textContent = 'Zkopírováno ✓';
    setTimeout(() => (ui.export.textContent = 'Kopírovat nastavení'), 1500);
  } catch {
    window.prompt('Zkopíruj nastavení:', text);
  }
});

applySettings();
