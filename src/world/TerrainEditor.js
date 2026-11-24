// Editor terénu (Alt+F8 ve světě, záměrně není v nápovědě).
//
// Všechny grafické listy z public/assets/objects se automaticky rozřežou na jednotlivé
// prvky (oddělené pozadím). Prvky jde vkládat do aktuálního regionu, posouvat tažením,
// měnit velikost a hloubku, duplikovat a mazat – vše v reálném čase. Upravit, posunout
// a smazat jde i objekty, které už v mapě jsou (kromě dlaždic). Zpět / Ctrl+Z vrací kroky.
//
// Rozmístění se ukládá v prohlížeči (localStorage, zvlášť pro každý region) a zobrazuje
// se i při běžném hraní. Tlačítko Export dá rozmístění do schránky (JSON) – zápis do map
// hry doplníme, až bude editor hotový.

import { clearWhiteFromEdges } from '../ui/heroCard/tabSprites.js';
import { removeWhiteBackground, STALL_OPENINGS } from '../entities/buildingSprites.js';

export const EDITOR_SHEETS = [
  { name: 'Travnaté dlaždice', path: 'assets/objects/Izometrické dlaždice travnatého terénu.png' },
  { name: 'Travnaté dlaždice – zeleň a sucho', path: 'assets/objects/Izometrické travnaté dlaždice v odstínech zeleně a sucha.png' },
  { name: 'Travnaté terénní bloky', path: 'assets/objects/Izometrické travnaté terénní bloky.png' },
  { name: 'Pobřežní dlaždice', path: 'assets/objects/Izometrické pobřežní dlaždice RPG терénu.png' },
  { name: 'Ostrovní terén', path: 'assets/objects/Izometrické dlaždice ostrovních terénů.png' },
  { name: 'Mosty – kamenné a dřevěné', path: 'assets/objects/Izometrické fantasy mosty – kamenné a dřevěné.png' },
  { name: 'Mosty – sada 8', path: 'assets/objects/Izometrické fantasy mosty – sada 8 assetů.png' },
  { name: 'Mosty fantasy světa', path: 'assets/objects/Izometrické mosty fantasy herního světa.png' },
  { name: 'Objekty Greenvale', path: 'assets/objects/greenvale-objects.webp' },
  // Budovy sady v2: každá ve dvou variantách – dveře na jihovýchod (obrázek) a na jihozápad (zrcadlově).
  { name: 'Budovy', buildings: true }
];

// Budovy pro editor (assets/buildings/greenvale/v2). Vkládají se ve stejném měřítku jako ve vesnici.
const BUILDING_DIR = 'assets/buildings/greenvale/v2/';
export const BUILDING_SCALE = 2;
// Budovy, jejichž měřítko ve vesnici bylo upraveno v editoru (stejné jako v buildingSprites.js).
const BUILDING_SCALE_OF = { 'town-hall': BUILDING_SCALE * 0.44, 'notice-board': BUILDING_SCALE * 0.52, church: 2.41 };
const EDITOR_BUILDINGS = [
  ['town-hall', 'Radnice'], ['tavern', 'Hostinec'], ['smithy', 'Kovárna'], ['alchemist', 'Alchymista'],
  ['church', 'Kostel'], ['observatory', 'Hvězdárna'], ['warehouse', 'Sklad'], ['stable', 'Stáj'],
  ['windmill', 'Větrný mlýn'], ['fishing-hut', 'Rybářská chata'], ['hunter-lodge', 'Lovecká chata'],
  ['house-red', 'Dům červený'], ['house-blue', 'Dům modrý'], ['house-green', 'Dům zelený'], ['house-thatch', 'Dům doškový'],
  ['stall-fruit', 'Stánek s ovocem'], ['stall-pots', 'Stánek se zbožím'], ['stall-fish', 'Stánek s rybami'],
  ['stall-flowers', 'Stánek s květinami'], ['fountain', 'Kašna'], ['well', 'Studna'], ['notice-board', 'Nástěnka']
];

const STORAGE_KEY = 'dragon-souls-terrain-editor';
const CELL = 4; // mřížka pro hledání prvků (px)
const MIN_SIZE = 24; // menší skvrny (šum, písmena) se přeskočí
export const pieceKey = (sheet, piece) => `editor-piece-${sheet}-${piece}`;

// ----------------------------------------------------------- uložení

export function loadPlacements(regionId) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return Array.isArray(all[regionId]) ? all[regionId] : [];
  } catch {
    return [];
  }
}

function savePlacements(regionId, list) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    all[regionId] = list;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Bez úložiště platí rozmístění jen do obnovení stránky.
  }
}

// ------------------------------------------------- rozřezání listů

let piecesPromise = null;
export let PIECES = []; // [{ sheet, piece, key, w, h, thumb }]

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

function segment(image) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, width, height).data;
  const isInk = (i) => {
    if (data[i + 3] < 40) return false;
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    return !(min >= 225 && max - min < 28); // téměř bílé pozadí
  };
  const cw = Math.ceil(width / CELL);
  const ch = Math.ceil(height / CELL);
  const ink = new Uint8Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      let found = false;
      for (let y = cy * CELL; y < Math.min(height, cy * CELL + CELL) && !found; y += 2) {
        for (let x = cx * CELL; x < Math.min(width, cx * CELL + CELL); x += 2) {
          if (isInk((y * width + x) * 4)) { found = true; break; }
        }
      }
      ink[cy * cw + cx] = found ? 1 : 0;
    }
  }
  // Souvislé oblasti (8 sousedů) → obdélníky prvků.
  const seen = new Uint8Array(cw * ch);
  const boxes = [];
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || seen[start]) continue;
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % cw;
      const y = (p - x) / cw;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
        const q = ny * cw + nx;
        if (ink[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    const box = { x: minX * CELL, y: minY * CELL, w: (maxX - minX + 1) * CELL, h: (maxY - minY + 1) * CELL };
    if (box.w >= MIN_SIZE && box.h >= MIN_SIZE) boxes.push(box);
  }
  // Pořadí: po řádcích shora dolů, zleva doprava.
  boxes.sort((a, b) => (Math.abs(a.y - b.y) > 40 ? a.y - b.y : a.x - b.x));
  return { canvas, boxes };
}

// Rozřeže všechny listy (jednou za hru) a vytvoří z prvků textury.
export function ensurePieces(scene) {
  if (piecesPromise) return piecesPromise;
  piecesPromise = (async () => {
    const pieces = [];
    for (let s = 0; s < EDITOR_SHEETS.length; s++) {
      if (EDITOR_SHEETS[s].buildings) {
        pieces.push(...await buildingPieces(scene, s));
        continue;
      }
      let image;
      try {
        image = await loadImage(encodeURI(EDITOR_SHEETS[s].path));
      } catch {
        continue;
      }
      const { canvas: sheetCanvas, boxes } = segment(image);
      boxes.forEach((box, p) => {
        const key = pieceKey(s, p);
        const canvas = document.createElement('canvas');
        canvas.width = box.w;
        canvas.height = box.h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(sheetCanvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
        clearWhiteFromEdges(ctx, box.w, box.h);
        if (!scene.textures.exists(key)) scene.textures.addCanvas(key, canvas);
        pieces.push({ sheet: s, piece: p, key, w: box.w, h: box.h, canvas });
      });
    }
    PIECES = pieces;
    return pieces;
  })();
  return piecesPromise;
}

// Budovy: obrázek bez bílého pozadí, oříznutý; varianta B zrcadlově (dveře na jihozápad).
async function buildingPieces(scene, sheet) {
  const pieces = [];
  for (let i = 0; i < EDITOR_BUILDINGS.length; i++) {
    const [file, name] = EDITOR_BUILDINGS[i];
    let image;
    try {
      image = await loadImage(`${BUILDING_DIR}${file}.png`);
    } catch {
      continue;
    }
    // Stejné odstranění pozadí jako ve vesnici (u stánků i průhled pod stříškou), už oříznuté.
    const base = removeWhiteBackground(image, 232, file.startsWith('stall-') ? STALL_OPENINGS : null);
    const box = { x: 0, y: 0, w: base.width, h: base.height };
    [false, true].forEach((flip, variant) => {
      const p = i * 2 + variant;
      const key = pieceKey(sheet, p);
      const canvas = document.createElement('canvas');
      canvas.width = box.w;
      canvas.height = box.h;
      const ctx = canvas.getContext('2d');
      if (flip) { ctx.translate(box.w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(base, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, canvas);
      pieces.push({ sheet, piece: p, key, w: box.w, h: box.h, canvas, building: file, door: flip ? 'JZ' : 'JV', label: `${name} – dveře ${flip ? 'JZ' : 'JV'}` });
    });
  }
  return pieces;
}

// ------------------------------------------- vykreslení ve světě

// Vykreslí uložené prvky regionu (i mimo editor). Vrací pole spritů.
export async function renderPlacements(scene, regionId, onSprite) {
  const list = loadPlacements(regionId);
  if (!list.length) return [];
  await ensurePieces(scene);
  if (!scene.sys.isActive() && !scene.sys.isPaused()) return [];
  return list.map((item) => createSprite(scene, item, onSprite)).filter(Boolean);
}

function createSprite(scene, item, onSprite) {
  const key = pieceKey(item.s, item.p);
  if (!scene.textures.exists(key)) return null;
  const sprite = scene.add.image(item.x, item.y, key).setOrigin(0.5, 1).setScale(item.sc ?? 1).setDepth(item.y + (item.d ?? 0));
  sprite.editorItem = item;
  onSprite?.(sprite);
  return sprite;
}

// ---------------------------------------- úpravy objektů z mapy hry

// Objekty, které už v mapě jsou (stromy, skály, doplňky, jeskyně, budovy – ne dlaždice).
// WorldScene je zaregistruje přes registerMapObject; úpravy se ukládají jako rozdíl
// oproti mapě: { dx, dy, sc (násobek), d (hloubka), del (smazáno) }.
const EDITS_KEY = 'dragon-souls-terrain-editor-edits';

export function loadMapEdits(regionId) {
  try {
    const all = JSON.parse(localStorage.getItem(EDITS_KEY) || '{}');
    return all[regionId] && typeof all[regionId] === 'object' ? all[regionId] : {};
  } catch {
    return {};
  }
}

function saveMapEdits(regionId, edits) {
  try {
    const all = JSON.parse(localStorage.getItem(EDITS_KEY) || '{}');
    all[regionId] = edits;
    localStorage.setItem(EDITS_KEY, JSON.stringify(all));
  } catch {
    // Bez úložiště platí úpravy jen do obnovení stránky.
  }
}

export function registerMapObject(object, id, label) {
  if (!object) return object;
  object.mapBase = { id, label, x: object.x, y: object.y, scaleX: object.scaleX, scaleY: object.scaleY, depth: object.depth };
  return object;
}

export function applyMapEdit(object, edit) {
  const base = object.mapBase;
  const e = edit ?? {};
  object.setPosition(base.x + (e.dx ?? 0), base.y + (e.dy ?? 0));
  object.setScale(base.scaleX * (e.sc ?? 1), base.scaleY * (e.sc ?? 1));
  object.setDepth(base.depth + (e.dy ?? 0) + (e.d ?? 0));
  object.setVisible(!e.del);
}

export function applyMapEdits(objects, regionId) {
  const edits = loadMapEdits(regionId);
  for (const object of objects) if (edits[object.mapBase.id]) applyMapEdit(object, edits[object.mapBase.id]);
}

// --------------------------------------------------------- editor

const HISTORY_LIMIT = 100;

export default class TerrainEditor {
  constructor(scene, regionId, { onSprite, onOpen, onClose, mapObjects = [] } = {}) {
    this.scene = scene;
    this.regionId = regionId;
    this.onSprite = onSprite;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.mapObjects = mapObjects;
    this.edits = loadMapEdits(regionId);
    this.history = [];
    this.root = null;
    this.sprites = [];
    this.selectedPiece = null;
    this.selectedSprite = null;
    this.sheetFilter = -1;
  }

  get isOpen() {
    return Boolean(this.root);
  }

  // Sprity uložených prvků, které už svět vykreslil.
  adopt(sprites) {
    this.sprites = sprites;
    if (this.root) for (const sprite of sprites) this.makeEditable(sprite);
  }

  toggle() {
    if (this.root) this.close();
    else this.open();
  }

  async open() {
    if (this.root) return;
    this.buildPanel();
    this.onOpen?.();
    this.setStatus('Načítám a rozřezávám grafické listy…');
    await ensurePieces(this.scene);
    if (!this.root) return;
    for (const sprite of [...this.sprites, ...this.mapObjects]) this.makeEditable(sprite);
    this.renderPalette();
    this.setStatus(`${PIECES.length} prvků z ${EDITOR_SHEETS.length} listů. Vyber prvek a klikni do mapy, nebo klikni na objekt v mapě.`);

    const input = this.scene.input;
    const editable = (object) => object.editorItem || object.mapBase;
    this.onPointerDown = (pointer, over) => {
      if (!this.root || pointer.rightButtonDown()) return;
      if (over.length) return; // klik na objekt = výběr (řeší objekt), klik na lištu karet nic nevkládá
      if (!this.selectedPiece) {
        this.select(null);
        return;
      }
      const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.checkpoint();
      this.place(this.selectedPiece, world.x, world.y);
      this.save();
    };
    this.onDragStart = (pointer, object) => {
      if (!editable(object)) return;
      const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      object.dragOffsetX = world.x - object.x;
      object.dragOffsetY = world.y - object.y;
      this.checkpoint();
      this.select(object);
    };
    this.onDrag = (pointer, object) => {
      if (!editable(object)) return;
      const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const x = Math.round(world.x - object.dragOffsetX);
      const y = Math.round(world.y - object.dragOffsetY);
      if (object.editorItem) {
        object.setPosition(x, y).setDepth(y + (object.editorItem.d ?? 0));
      } else {
        const edit = this.editOf(object);
        edit.dx = x - object.mapBase.x;
        edit.dy = y - object.mapBase.y;
        applyMapEdit(object, edit);
      }
    };
    this.onDragEnd = (pointer, object) => {
      if (!editable(object)) return;
      if (object.editorItem) {
        object.editorItem.x = object.x;
        object.editorItem.y = object.y;
      }
      this.save();
    };
    input.on('pointerdown', this.onPointerDown);
    input.on('drag', this.onDrag);
    input.on('dragstart', this.onDragStart);
    input.on('dragend', this.onDragEnd);

    this.onKey = (event) => {
      if (!this.root || event.target?.tagName === 'INPUT') return;
      if (event.code === 'KeyZ' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); this.undo(); }
      else if (event.code === 'Delete' || event.code === 'Backspace') this.removeSelected();
      else if (event.code === 'BracketRight') this.scaleSelected(1.1);
      else if (event.code === 'BracketLeft') this.scaleSelected(1 / 1.1);
      else if (event.code === 'Escape') { this.selectedPiece = null; this.select(null); this.renderPalette(); }
    };
    window.addEventListener('keydown', this.onKey);
  }

  close() {
    if (!this.root) return;
    this.root.remove();
    this.root = null;
    const input = this.scene.input;
    input.off('pointerdown', this.onPointerDown);
    input.off('drag', this.onDrag);
    input.off('dragstart', this.onDragStart);
    input.off('dragend', this.onDragEnd);
    window.removeEventListener('keydown', this.onKey);
    for (const sprite of [...this.sprites, ...this.mapObjects]) {
      if (!sprite.active) continue;
      sprite.disableInteractive();
      sprite.clearTint?.();
    }
    this.selectedSprite = null;
    this.onClose?.();
  }

  destroy() {
    this.close();
  }

  // ------------------------------------------------------ panel (DOM)

  buildPanel() {
    const root = document.createElement('div');
    root.style.cssText = [
      'position:fixed', 'top:12px', 'left:12px', 'bottom:12px', 'z-index:1000', 'width:360px',
      'display:flex', 'flex-direction:column', 'gap:8px', 'padding:12px 14px', 'box-sizing:border-box',
      'border-radius:10px', 'background:rgba(8,14,22,0.94)', 'border:1px solid #d6a23a',
      'color:#e8eef5', 'font:13px/1.35 system-ui,sans-serif', 'box-shadow:0 8px 30px rgba(0,0,0,0.5)'
    ].join(';');
    for (const type of ['keydown', 'keyup']) {
      root.addEventListener(type, (event) => {
        if (!(event.code === 'F8' && event.altKey)) event.stopPropagation();
      });
    }
    root.addEventListener('wheel', (event) => event.stopPropagation());

    const title = document.createElement('div');
    title.textContent = `Editor terénu – ${this.regionId} (Alt+F8 zavře)`;
    title.style.cssText = 'font-weight:700;color:#ffe7ae;font-size:15px';
    root.appendChild(title);

    const help = document.createElement('div');
    help.style.cssText = 'color:#9fb3c8;font-size:12px';
    help.textContent = 'Klik do mapy = vložit vybraný prvek · klik na objekt (i stromy, skály, budovy) = výběr · tažení = posun · [ ] nebo posuvník = velikost · Delete = smazat · Ctrl+Z = zpět · Esc = zrušit výběr · WASD / šipky = posun po regionu · kolečko = zoom';
    root.appendChild(help);

    this.sheetSelect = document.createElement('select');
    this.sheetSelect.style.cssText = 'width:100%;padding:4px;background:#1c2a3a;color:#ffe7ae;border:1px solid #d6a23a;border-radius:6px';
    [['-1', 'Všechny listy'], ...EDITOR_SHEETS.map((s, i) => [String(i), s.name])].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      this.sheetSelect.appendChild(option);
    });
    this.sheetSelect.addEventListener('change', () => {
      this.sheetFilter = Number(this.sheetSelect.value);
      this.renderPalette();
    });
    root.appendChild(this.sheetSelect);

    this.palette = document.createElement('div');
    this.palette.style.cssText = 'flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;align-content:start;padding:2px';
    root.appendChild(this.palette);

    // Vybraný objekt v mapě.
    this.selectedBox = document.createElement('div');
    this.selectedBox.style.cssText = 'border-top:1px solid #3a4552;padding-top:8px;display:flex;flex-direction:column;gap:6px';
    root.appendChild(this.selectedBox);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px';
    this.undoButton = this.button('Zpět (Ctrl+Z)', () => this.undo());
    row.appendChild(this.undoButton);
    row.appendChild(this.button('Export', () => this.exportJson()));
    row.appendChild(this.button('Vymazat vložené', () => this.clearRegion(), true));
    root.appendChild(row);

    this.status = document.createElement('div');
    this.status.style.cssText = 'color:#ffd76a;font-size:12px;min-height:16px';
    root.appendChild(this.status);

    document.body.appendChild(root);
    this.root = root;
    this.renderSelected();
    this.refreshUndo();
  }

  button(text, onClick, danger = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.style.cssText = [
      'flex:1', 'padding:6px 8px', 'border-radius:6px', `border:1px solid ${danger ? '#d0574a' : '#d6a23a'}`,
      `background:${danger ? '#3a1210' : '#1c2a3a'}`, 'color:#ffe7ae', 'font:600 12px system-ui,sans-serif', 'cursor:pointer'
    ].join(';');
    button.addEventListener('click', onClick);
    return button;
  }

  setStatus(text) {
    if (this.status) this.status.textContent = text;
  }

  renderPalette() {
    if (!this.palette) return;
    this.palette.replaceChildren();
    const list = PIECES.filter((p) => this.sheetFilter < 0 || p.sheet === this.sheetFilter);
    for (const piece of list) {
      const thumb = document.createElement('canvas');
      const size = 72;
      thumb.width = size;
      thumb.height = size;
      const k = Math.min(size / piece.w, size / piece.h);
      thumb.getContext('2d').drawImage(piece.canvas, (size - piece.w * k) / 2, (size - piece.h * k) / 2, piece.w * k, piece.h * k);
      const selected = this.selectedPiece === piece;
      thumb.title = piece.label ?? `${EDITOR_SHEETS[piece.sheet].name} #${piece.piece} (${piece.w}×${piece.h})`;
      thumb.style.cssText = `width:100%;aspect-ratio:1;background:#121c28;border-radius:6px;cursor:pointer;border:2px solid ${selected ? '#ffd76a' : '#2a3644'}`;
      thumb.addEventListener('click', () => {
        this.selectedPiece = selected ? null : piece;
        this.renderPalette();
        this.setStatus(this.selectedPiece ? `Vybráno: ${thumb.title}. Klikni do mapy.` : 'Výběr zrušen.');
      });
      this.palette.appendChild(thumb);
    }
  }

  describe(sprite) {
    if (sprite.editorItem?.b) return `Vložená budova: ${PIECES.find((p) => p.sheet === sprite.editorItem.s && p.piece === sprite.editorItem.p)?.label ?? sprite.editorItem.b}`;
    if (sprite.editorItem) return `Vložený prvek: ${EDITOR_SHEETS[sprite.editorItem.s]?.name} #${sprite.editorItem.p}`;
    return `Objekt mapy: ${sprite.mapBase.label}`;
  }

  renderSelected() {
    if (!this.selectedBox) return;
    this.selectedBox.replaceChildren();
    const sprite = this.selectedSprite;
    const label = document.createElement('div');
    label.style.cssText = 'font-weight:700;color:#ffe7ae';
    label.textContent = sprite ? this.describe(sprite) : 'Žádný objekt v mapě není vybraný.';
    this.selectedBox.appendChild(label);
    if (!sprite) return;
    if (sprite.mapBase) {
      const note = document.createElement('div');
      note.style.cssText = 'color:#9fb3c8;font-size:12px';
      note.textContent = 'Upravuje se jen vzhled – kolize a dveře zůstávají podle mapy, dokud úpravy nezapíšeme do map hry.';
      this.selectedBox.appendChild(note);
    }
    this.selectedBox.appendChild(this.slider('Velikost', 0.1, 4, 0.01, this.scaleOf(sprite), (v) => this.setScale(sprite, v)));
    this.selectedBox.appendChild(this.slider('Hloubka (před / za)', -400, 400, 1, this.depthOf(sprite), (v) => this.setDepthOffset(sprite, v)));
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px';
    if (sprite.editorItem) row.appendChild(this.button('Duplikovat', () => this.duplicateSelected()));
    if (sprite.editorItem?.b) row.appendChild(this.button(`Dveře na ${sprite.editorItem.door === 'JZ' ? 'JV' : 'JZ'}`, () => this.flipBuilding()));
    row.appendChild(this.button('Smazat', () => this.removeSelected(), true));
    this.selectedBox.appendChild(row);
  }

  slider(label, min, max, step, value, onInput) {
    const wrap = document.createElement('label');
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between';
    const name = document.createElement('span');
    name.textContent = label;
    const shown = document.createElement('span');
    shown.style.color = '#ffd76a';
    const show = (v) => { shown.textContent = step < 1 ? Number(v).toFixed(2) : String(v); };
    show(value);
    head.append(name, shown);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    input.style.cssText = 'width:100%;accent-color:#d6a23a';
    // Jeden krok Zpět na celé posunutí posuvníku.
    input.addEventListener('pointerdown', () => this.checkpoint());
    input.addEventListener('keydown', (event) => { if (!event.repeat) this.checkpoint(); });
    input.addEventListener('input', () => {
      const v = Number(input.value);
      show(v);
      onInput(v);
    });
    input.addEventListener('change', () => this.save());
    wrap.append(head, input);
    return wrap;
  }

  // ------------------------------------------- vlastnosti vybraného

  editOf(object) {
    const id = object.mapBase.id;
    this.edits[id] ??= {};
    return this.edits[id];
  }

  scaleOf(sprite) {
    return sprite.editorItem ? sprite.editorItem.sc ?? 1 : this.edits[sprite.mapBase.id]?.sc ?? 1;
  }

  depthOf(sprite) {
    return sprite.editorItem ? sprite.editorItem.d ?? 0 : this.edits[sprite.mapBase.id]?.d ?? 0;
  }

  setScale(sprite, value) {
    if (sprite.editorItem) {
      sprite.editorItem.sc = value;
      sprite.setScale(value);
    } else {
      this.editOf(sprite).sc = value;
      applyMapEdit(sprite, this.editOf(sprite));
    }
  }

  setDepthOffset(sprite, value) {
    if (sprite.editorItem) {
      sprite.editorItem.d = value;
      sprite.setDepth(sprite.y + value);
    } else {
      this.editOf(sprite).d = value;
      applyMapEdit(sprite, this.editOf(sprite));
    }
  }

  // ---------------------------------------------------------- akce

  makeEditable(sprite) {
    if (!sprite.active) return;
    if (sprite.editorReady) {
      if (sprite.visible) sprite.setInteractive({ useHandCursor: true });
      return;
    }
    sprite.editorReady = true;
    if (!sprite.visible) return;
    sprite.setInteractive({ useHandCursor: true });
    this.scene.input.setDraggable(sprite);
    sprite.on('pointerdown', () => {
      if (this.root) this.select(sprite);
    });
  }

  place(piece, x, y, scale = undefined, depth = 0) {
    const item = { s: piece.sheet, p: piece.piece, x: Math.round(x), y: Math.round(y), sc: scale ?? (piece.building ? BUILDING_SCALE_OF[piece.building] ?? BUILDING_SCALE : 1), d: depth };
    if (piece.building) { item.b = piece.building; item.door = piece.door; }
    const sprite = createSprite(this.scene, item, this.onSprite);
    if (!sprite) return null;
    this.makeEditable(sprite);
    this.sprites.push(sprite);
    this.select(sprite);
    return sprite;
  }

  select(sprite) {
    this.selectedSprite?.clearTint?.();
    this.selectedSprite = sprite;
    sprite?.setTint?.(0xfff0a0);
    this.renderSelected();
  }

  scaleSelected(factor) {
    const sprite = this.selectedSprite;
    if (!sprite) return;
    this.checkpoint();
    this.setScale(sprite, Math.max(0.1, Math.min(4, this.scaleOf(sprite) * factor)));
    this.renderSelected();
    this.save();
  }

  duplicateSelected() {
    const sprite = this.selectedSprite;
    if (!sprite?.editorItem) return;
    const piece = PIECES.find((p) => p.sheet === sprite.editorItem.s && p.piece === sprite.editorItem.p);
    if (!piece) return;
    this.checkpoint();
    this.place(piece, sprite.x + 40, sprite.y + 20, sprite.editorItem.sc, sprite.editorItem.d);
    this.save();
  }

  // Budova: přepne variantu (dveře jihovýchod ↔ jihozápad), poloha a velikost zůstanou.
  flipBuilding() {
    const sprite = this.selectedSprite;
    const item = sprite?.editorItem;
    if (!item?.b) return;
    this.checkpoint();
    item.p = item.p % 2 === 0 ? item.p + 1 : item.p - 1;
    item.door = item.door === 'JZ' ? 'JV' : 'JZ';
    sprite.setTexture(pieceKey(item.s, item.p));
    this.renderSelected();
    this.save();
  }

  removeSelected() {
    const sprite = this.selectedSprite;
    if (!sprite) return;
    this.checkpoint();
    if (sprite.editorItem) {
      this.sprites = this.sprites.filter((s) => s !== sprite);
      sprite.destroy();
    } else {
      // Objekt mapy se jen skryje (Zpět ho vrátí).
      this.editOf(sprite).del = true;
      applyMapEdit(sprite, this.editOf(sprite));
      sprite.disableInteractive();
      sprite.clearTint?.();
    }
    this.selectedSprite = null;
    this.renderSelected();
    this.save();
  }

  clearRegion() {
    if (!window.confirm(`Smazat všechny vložené prvky v regionu ${this.regionId}? (Objekty mapy zůstanou.)`)) return;
    this.checkpoint();
    for (const sprite of this.sprites) sprite.destroy();
    this.sprites = [];
    this.select(null);
    this.save();
    this.setStatus('Vložené prvky smazány (Zpět je vrátí).');
  }

  // --------------------------------------------------------- zpět

  checkpoint() {
    this.history.push({
      items: JSON.stringify(this.sprites.map((s) => s.editorItem)),
      edits: JSON.stringify(this.edits)
    });
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
    this.refreshUndo();
  }

  refreshUndo() {
    if (!this.undoButton) return;
    this.undoButton.disabled = !this.history.length;
    this.undoButton.style.opacity = this.history.length ? '1' : '0.45';
  }

  undo() {
    const snapshot = this.history.pop();
    if (!snapshot) {
      this.setStatus('Není co vrátit.');
      return;
    }
    this.select(null);
    for (const sprite of this.sprites) sprite.destroy();
    this.sprites = JSON.parse(snapshot.items).map((item) => createSprite(this.scene, item, this.onSprite)).filter(Boolean);
    for (const sprite of this.sprites) this.makeEditable(sprite);
    this.edits = JSON.parse(snapshot.edits);
    for (const object of this.mapObjects) {
      applyMapEdit(object, this.edits[object.mapBase.id]);
      if (object.visible) this.makeEditable(object);
      else object.disableInteractive();
    }
    this.save();
    this.refreshUndo();
    this.setStatus(`Vráceno zpět (zbývá ${this.history.length} kroků).`);
  }

  save() {
    savePlacements(this.regionId, this.sprites.map((s) => s.editorItem));
    // Prázdné úpravy se neukládají.
    for (const [id, edit] of Object.entries(this.edits)) {
      if (!edit.del && !edit.dx && !edit.dy && !edit.d && (edit.sc ?? 1) === 1) delete this.edits[id];
    }
    saveMapEdits(this.regionId, this.edits);
  }

  async exportJson() {
    const data = {
      region: this.regionId,
      sheets: EDITOR_SHEETS.map((s) => s.path),
      items: this.sprites.map((s) => s.editorItem),
      mapEdits: this.edits
    };
    const text = JSON.stringify(data);
    try {
      await navigator.clipboard.writeText(text);
      this.setStatus(`Zkopírováno ${data.items.length} vložených prvků a ${Object.keys(data.mapEdits).length} úprav objektů mapy.`);
    } catch {
      window.prompt('Zkopíruj rozmístění:', text);
    }
  }
}
