// Animace monster z obrázků. Dvě podoby:
//   - vlastní list druhu (public/assets/monsters/<druh>/animations/<animace>.png) – Dire Wolf,
//   - buňka společného listu (data/monsterSheets.js): 2 řady × 4 monstra, každé 4 snímky.
// Při startu hry se snímky vyříznou, bílé pozadí zprůhlední a všechny snímky se oříznou na
// společný obdélník, aby tlapy zůstaly na místě. Druh bez animace dál používá jednoduchý
// kreslený model (monsterModels.js).

import { clearWhiteFromEdges } from '../ui/heroCard/tabSprites.js';
import { MONSTER_SHEET_FILES, MONSTER_SHEET_CELLS, MONSTER_STILL_SHEETS } from '../data/monsterSheets.js';

// Výchozí velikost v jednotkách modelu (kreslené modely mají ~100): monstrum se vejde do rámečku.
const FIT = { w: 150, h: 175 };

// Statické listy mají přednost (novější obrázky, např. Dire Wolf ve stylu ostatních monster).
export const MONSTER_ANIMATIONS = {};
MONSTER_STILL_SHEETS.forEach((sheet, index) => {
  sheet.rows.forEach((row) => row.forEach((species) => {
    if (species) MONSTER_ANIMATIONS[species] = { idle: { stillSheet: index, frames: 1, frameRate: 1, facesRight: true } };
  }));
});

// Druhy ze společných listů (monstra v listech koukají doprava).
for (const [species, [sheet, cell]] of Object.entries(MONSTER_SHEET_CELLS)) {
  if (MONSTER_ANIMATIONS[species]) continue;
  MONSTER_ANIMATIONS[species] = {
    idle: { sheet, cell, frames: 4, frameRate: 3, facesRight: true }
  };
}

const sheetKey = (species, anim) => `monster-sheet-${species}-${anim}`;
const sharedSheetKey = (index) => `monster-shared-sheet-${index}`;
const stillSheetKey = (index) => `monster-still-sheet-${index}`;
const frameKey = (species, anim, i) => `monster-${species}-${anim}-${i}`;
export const animationKey = (species, anim) => `monster-${species}-${anim}`;
const headKey = (species) => `monster-${species}-head`;

export function loadMonsterAnimations(scene) {
  const sheets = new Set();
  for (const [species, anims] of Object.entries(MONSTER_ANIMATIONS)) {
    for (const [anim, def] of Object.entries(anims)) {
      if (def.path) scene.load.image(sheetKey(species, anim), def.path);
      else if (def.sheet !== undefined) sheets.add(def.sheet);
    }
  }
  for (const index of sheets) {
    scene.load.image(sharedSheetKey(index), `assets/monsters/${encodeURIComponent(MONSTER_SHEET_FILES[index])}`);
  }
  MONSTER_STILL_SHEETS.forEach((sheet, index) => {
    if (!scene.textures.exists(frameKey(sheet.rows.flat().find(Boolean), 'idle', 0))) {
      scene.load.image(stillSheetKey(index), `assets/monsters/${encodeURIComponent(sheet.file)}`);
    }
  });
}

// Statický list: řady se oddělí podle nejprázdnějšího řádku, monstra v řadě podle mezer
// mezi sloupci. Když je úseků víc než monster, slévají se nejužší s nejbližším sousedem.
function prepareStillSheets(scene) {
  MONSTER_STILL_SHEETS.forEach((sheet, index) => {
    const key = stillSheetKey(index);
    if (!scene.textures.exists(key)) return;
    const source = scene.textures.get(key).getSourceImage();
    const W = source.width;
    const H = source.height;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0);
    clearWhiteFromEdges(ctx, W, H);
    clearEnclosedWhite(ctx, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    const solid = (x, y) => data[(y * W + x) * 4 + 3] > 24;

    // Hranice řad.
    const bands = [];
    const rowsCount = sheet.rows.length;
    let top = 0;
    for (let r = 1; r < rowsCount; r++) {
      const from = Math.round(H * (r - 0.25) / rowsCount);
      const to = Math.round(H * (r + 0.25) / rowsCount);
      let best = from;
      let bestCount = Infinity;
      for (let y = from; y <= to; y++) {
        let n = 0;
        for (let x = 0; x < W; x++) if (solid(x, y)) n++;
        if (n < bestCount) { bestCount = n; best = y; }
      }
      bands.push([top, best]);
      top = best + 1;
    }
    bands.push([top, H - 1]);

    sheet.rows.forEach((row, r) => {
      const [y0, y1] = bands[r];
      const count = new Array(W).fill(0);
      for (let x = 0; x < W; x++) for (let y = y0; y <= y1; y++) if (solid(x, y)) count[x]++;
      const segs = [];
      for (let x = 0; x < W; x++) {
        if (count[x] < 2) continue;
        const last = segs[segs.length - 1];
        if (last && x - last.b <= 6) last.b = x;
        else segs.push({ a: x, b: x });
      }
      while (segs.length > row.length) {
        let i = 0;
        segs.forEach((s, j) => { if (s.b - s.a < segs[i].b - segs[i].a) i = j; });
        const gapL = i > 0 ? segs[i].a - segs[i - 1].b : Infinity;
        const gapR = i < segs.length - 1 ? segs[i + 1].a - segs[i].b : Infinity;
        const j = gapL <= gapR ? i - 1 : i + 1;
        const a = Math.min(segs[i].a, segs[j].a);
        const b = Math.max(segs[i].b, segs[j].b);
        segs.splice(Math.min(i, j), 2, { a, b });
      }
      // Méně úseků (monstra se dotýkají stínem / křídlem): nejširší se rozdělí v nejužším sloupci.
      while (segs.length < row.length) {
        let i = 0;
        segs.forEach((s, j) => { if (s.b - s.a > segs[i].b - segs[i].a) i = j; });
        const { a, b } = segs[i];
        let cut = Math.round((a + b) / 2);
        for (let x = Math.round(a + (b - a) * 0.3); x <= Math.round(a + (b - a) * 0.7); x++) if (count[x] < count[cut]) cut = x;
        segs.splice(i, 1, { a, b: cut - 1 }, { a: cut + 1, b });
      }
      if (segs.length !== row.length) {
        console.warn(`Statický list ${sheet.file}: řada ${r} má ${segs.length} monster místo ${row.length}`);
        return;
      }
      row.forEach((species, k) => {
        if (!species || scene.textures.exists(frameKey(species, 'idle', 0))) return;
        const { a, b } = segs[k];
        let top = y1, bottom = y0;
        for (let y = y0; y <= y1; y++) {
          for (let x = a; x <= b; x++) if (solid(x, y)) { if (y < top) top = y; if (y > bottom) bottom = y; break; }
        }
        const out = document.createElement('canvas');
        out.width = b - a + 1;
        out.height = bottom - top + 1;
        out.getContext('2d').drawImage(canvas, a, top, out.width, out.height, 0, 0, out.width, out.height);
        scene.textures.addCanvas(frameKey(species, 'idle', 0), out);
        if (!scene.anims.exists(animationKey(species, 'idle'))) {
          scene.anims.create({ key: animationKey(species, 'idle'), frames: [{ key: frameKey(species, 'idle', 0) }], frameRate: 1, repeat: -1 });
        }
      });
    });
    scene.textures.remove(key);
  });
}

// Oblast listu s animací: vlastní list celý, společný list = jedna buňka (čtvrtina × polovina).
function sourceRect(source, def) {
  if (def.path) return { x: 0, y: 0, w: source.width, h: source.height };
  const w = source.width / 4;
  const h = source.height / 2;
  return { x: (def.cell % 4) * w, y: Math.floor(def.cell / 4) * h, w, h };
}

export function prepareMonsterAnimations(scene) {
  prepareStillSheets(scene);
  const usedShared = new Set();
  for (const [species, anims] of Object.entries(MONSTER_ANIMATIONS)) {
    for (const [anim, def] of Object.entries(anims)) {
      if (def.stillSheet !== undefined) continue;
      const key = def.path ? sheetKey(species, anim) : sharedSheetKey(def.sheet);
      if (!def.path) usedShared.add(key);
      if (!scene.textures.exists(key) || scene.textures.exists(frameKey(species, anim, 0))) continue;
      const source = scene.textures.get(key).getSourceImage();
      const rect = sourceRect(source, def);
      const fw = Math.floor(rect.w / def.frames);
      const fh = Math.floor(rect.h);

      // 1) Snímky s průhledným pozadím a jejich obsah.
      const frames = [];
      let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
      for (let i = 0; i < def.frames; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = fw;
        canvas.height = fh;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, rect.x + i * fw, rect.y, fw, fh, 0, 0, fw, fh);
        clearWhiteFromEdges(ctx, fw, fh);
        if (!KEEP_WHITE_CORE.has(species)) clearEnclosedWhite(ctx, fw, fh);
        const data = ctx.getImageData(0, 0, fw, fh).data;
        for (let y = 0; y < fh; y++) {
          for (let x = 0; x < fw; x++) {
            if (data[(y * fw + x) * 4 + 3] > 24) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        frames.push(canvas);
      }
      if (x1 < 0) continue; // prázdná buňka

      // 2) Hlava z prvního snímku (miniatura na kartě Party) – jen u vlastního listu.
      if (def.head) {
        const { x, y, w: hw, h: hh } = def.head;
        const head = document.createElement('canvas');
        head.width = hw;
        head.height = hh;
        head.getContext('2d').drawImage(frames[0], x, y, hw, hh, 0, 0, hw, hh);
        scene.textures.addCanvas(headKey(species), head);
      }

      // 3) Společný ořez pro všechny snímky (pohyb uvnitř animace zůstane zachovaný).
      const w = x1 - x0 + 1;
      const h = y1 - y0 + 1;
      frames.forEach((canvas, i) => {
        // Společný list: první snímek (statický obrázek) se vyřízne podle skutečného obrysu
        // monstra v celé buňce – mřížka snímků v listech není přesná a monstrum by bylo uříznuté.
        const still = i === 0 && !def.path ? cutFirstSprite(source, rect, fw, species) : null;
        if (still) {
          scene.textures.addCanvas(frameKey(species, anim, i), still);
          return;
        }
        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        out.getContext('2d').drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
        scene.textures.addCanvas(frameKey(species, anim, i), out);
      });

      if (!scene.anims.exists(animationKey(species, anim))) {
        scene.anims.create({
          key: animationKey(species, anim),
          frames: frames.map((_, i) => ({ key: frameKey(species, anim, i) })),
          frameRate: def.frameRate,
          repeat: -1
        });
      }
      if (def.path) scene.textures.remove(key);
    }
  }
  // Společné listy už nejsou potřeba (snímky jsou vyříznuté).
  for (const key of usedShared) if (scene.textures.exists(key)) scene.textures.remove(key);
}

// První monstrum v buňce společného listu, těsně oříznuté. Buňka se vyčistí od bílé celá,
// sloupce s obsahem se rozdělí na úseky (mezera ≥ 3 px) a vezme se první úsek široký aspoň
// třetinu snímku (plus drobné kousky těsně u něj – ocas, křídlo). Null = nepodařilo se.
function cutFirstSprite(source, rect, fw, species) {
  const W = Math.floor(rect.w);
  const H = Math.floor(rect.h);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, rect.x, rect.y, W, H, 0, 0, W, H);
  clearWhiteFromEdges(ctx, W, H);
  if (!KEEP_WHITE_CORE.has(species)) clearEnclosedWhite(ctx, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;
  // Počet neprůhledných pixelů v každém sloupci.
  const count = new Array(W).fill(0);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (data[(y * W + x) * 4 + 3] > 24) count[x]++;
  const a = count.findIndex((n) => n >= 2);
  let b = W - 1;
  while (b > a && count[b] < 2) b--;
  if (a < 0 || b - a < fw) return null;
  // Snímky se často dotýkají (křídla, ocasy) – hranice prvního snímku je nejužší sloupec
  // kolem skutečné rozteče (obsah buňky / 4), ne pevná čtvrtina buňky.
  const pitch = (b - a + 1) / 4;
  let cut = Math.round(a + pitch);
  for (let x = Math.round(a + pitch * 0.7); x <= Math.round(a + pitch * 1.3) && x < W; x++) {
    if (count[x] < count[cut]) cut = x;
  }
  // Souvislé plochy v okně o kus širším než hranice. Monstrum = největší plocha vlevo od
  // hranice; když přečnívá (hlava, křídlo) a nedotkne se kraje okna, vezme se celé.
  // Volné kousky celé vlevo od hranice (jiskry, lístky) zůstanou, cizí kousky zmizí.
  const reach = Math.min(W - 1, Math.round(cut + pitch * 0.35));
  const label = new Int32Array(W * H).fill(-1);
  const comps = [];
  for (let y = 0; y < H; y++) {
    for (let x = a; x <= reach; x++) {
      const start = y * W + x;
      if (label[start] >= 0 || data[start * 4 + 3] <= 24) continue;
      const id = comps.length;
      const c = { left: 0, minX: x, maxX: x, pixels: [start] };
      label[start] = id;
      for (let i = 0; i < c.pixels.length; i++) {
        const p = c.pixels[i];
        const px = p % W;
        if (px < cut) c.left++;
        if (px < c.minX) c.minX = px;
        if (px > c.maxX) c.maxX = px;
        for (const q of [px > a ? p - 1 : -1, px < reach ? p + 1 : -1, p - W, p + W]) {
          if (q < 0 || q >= W * H || label[q] >= 0 || data[q * 4 + 3] <= 24) continue;
          label[q] = id;
          c.pixels.push(q);
        }
      }
      comps.push(c);
    }
  }
  if (!comps.length) return null;
  const main = comps.reduce((best, c) => (c.left > best.left ? c : best));
  const mainLimit = main.maxX >= reach ? cut - 1 : main.maxX;
  const keep = new Uint8Array(W * H);
  for (const c of comps) {
    if (c !== main && c.maxX >= cut) continue;
    for (const p of c.pixels) if (p % W <= mainLimit) keep[p] = 1;
  }
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let p = 0; p < W * H; p++) {
    if (!keep[p]) {
      data[p * 4 + 3] = 0;
      continue;
    }
    const x = p % W;
    const y = (p - x) / W;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  ctx.putImageData(new ImageData(data, W, H), 0, 0);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// Druhy s bílým zářícím jádrem (nečistit uzavřenou bílou).
const KEEP_WHITE_CORE = new Set(['arcane_wisp']);

// Uzavřené plochy čistě bílého pozadí (mezi nohama, pod ocasem), které se nedotýkají okraje.
// Jen téměř čistá bílá (≥ 246) a plocha aspoň minArea px – bílá monstra (jednorožec, sova)
// mají stínovanou srst, ta zůstane.
function clearEnclosedWhite(ctx, w, h, minArea = 140) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const isWhite = (p) => d[p * 4 + 3] > 0 && Math.min(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]) >= 246;
  const seen = new Uint8Array(w * h);
  let changed = false;
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || !isWhite(start)) continue;
    const region = [start];
    seen[start] = 1;
    for (let i = 0; i < region.length; i++) {
      const p = region[i];
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= w * h || seen[q] || !isWhite(q)) continue;
        seen[q] = 1;
        region.push(q);
      }
    }
    if (region.length < minArea) continue;
    for (const p of region) d[p * 4 + 3] = 0;
    changed = true;
  }
  if (changed) ctx.putImageData(img, 0, 0);
}

// Animovaný sprite pro model monstra, nebo null (druh nemá animaci).
export function createAnimatedBody(scene, speciesId, side) {
  const def = MONSTER_ANIMATIONS[speciesId]?.idle;
  if (!def || !scene.textures.exists(frameKey(speciesId, 'idle', 0))) return null;
  const sprite = scene.add.sprite(0, 4, frameKey(speciesId, 'idle', 0)).setOrigin(0.5, 1);
  sprite.setScale(def.displayWidth ? def.displayWidth / sprite.width : Math.min(FIT.w / sprite.width, FIT.h / sprite.height));
  // Monstra nepřítele koukají doleva (zrcadlový obrázek).
  const enemy = side === 'enemy';
  const faceLeft = enemy === def.facesRight;
  if (faceLeft) sprite.setFlipX(true);

  // Animace jsou globálně vypnuté: monstrum je jen první snímek idle (statický obrázek).
  return sprite;
}

// Hlava z prvního snímku idle animace, nebo null.
export function monsterHeadKey(scene, speciesId) {
  const key = headKey(speciesId);
  return scene.textures.exists(key) ? key : null;
}

// První snímek idle animace (celé monstrum bez pohybu), nebo null.
export function monsterStillKey(scene, speciesId) {
  const key = frameKey(speciesId, 'idle', 0);
  return MONSTER_ANIMATIONS[speciesId]?.idle && scene.textures.exists(key) ? key : null;
}
