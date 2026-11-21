// Zvětší ostrov Greenvale na dvojnásobek a vytvoří přirozenější krajinu.
//
// Vstup:  tools/greenvale-base.js – mapa 64 × 64 rozložená podle referenčního obrázku
//         (výstup tools/greenvale-layout.mjs; tady se nemění, takže skript jde
//         pouštět opakovaně s různým seedem)
// Výstup: src/data/maps/greenvale.js + náhled tools/greenvale-preview.png
//
//  1. Pobřeží se převezme z referenčního obrázku v dvojnásobném rozlišení
//     (tools/greenvale-coast-128.txt); jen tam, kde obrázek končí, se zvlní šumem.
//  2. Tmavá louka u jeskyně (zóna setkání) se zvětší a rozšíří.
//  3. Budovy si nechají velikost, jen se rozestoupí (pozice × 2). Parcela = půdorys + okraj.
//  4. Cesty, náměstí a most se zvětší, od každých dveří vede cesta k nejbližší cestě.
//  5. Útesy lemují pobřeží s proměnlivou tloušťkou, jeskyně dostane skalní masiv.
//  6. K rybářské chatě se přidá molo do vody.
//  7. Stromy v hustých lesících, smrky na okraji tmavé louky, skály náhodně.
//  8. Doplňky: ploty kolem obytných parcel, keře a kytky, rákos, kapradí, pařezy, rozcestník.
//
// Použití: node tools/greenvale-generate.mjs [seed]
// Výsledek je deterministický – stejný seed = stejná mapa.

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { GREENVALE_MAP as OLD } from './greenvale-base.js';

const SEED = Number(process.argv[2] ?? 7);
const SCALE = 2;
const MARGIN = 6;

// ------------------------------------------------------------------ šum

function hash2(x, y, s = SEED) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = (t) => t * t * (3 - 2 * t);

function noise(x, y, s = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy, SEED + s);
  const b = hash2(ix + 1, iy, SEED + s);
  const c = hash2(ix, iy + 1, SEED + s);
  const d = hash2(ix + 1, iy + 1, SEED + s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

const fbm = (x, y, s) => noise(x, y, s) * 0.6 + noise(x * 2.1, y * 2.1, s + 11) * 0.3 + noise(x * 4.3, y * 4.3, s + 23) * 0.1;

let rng = SEED * 9301 + 49297;
const random = () => {
  rng = (rng * 16807) % 2147483647;
  return rng / 2147483647;
};

// ---------------------------------------------------------- stará mapa

const oldGrid = OLD.ground.map((row) => row.split(''));
const OW = oldGrid[0].length;
const OH = oldGrid.length;
const oldAt = (x, y) => oldGrid[Math.floor(y)]?.[Math.floor(x)] ?? '~';

// --------------------------------------------------- 1. tvar pevniny

// Pobřeží podle referenčního obrázku: tools/greenvale-coast-128.txt je mapa
// 128 × 128 změřená z obrázku (tools/map-from-reference.ps1 -Tiles 128 -WorldWidth 7680),
// takže pole X,Y odpovídá starému poli X/2, Y/2.
const BW = OW * SCALE;
const BH = OH * SCALE;
const coast = readFileSync(new URL('./greenvale-coast-128.txt', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean);

// Kde obrázek končí, je pobřeží rovné (oříznutí obrázku) – tam ho zvlníme šumem.
const REF = { tiles: 128, width: 7680, height: 4320 };
const refLeft = (REF.tiles * 128 - REF.width) / 2;
const refTop = (REF.tiles * 64 - REF.height) / 2;
function distanceToImageEdge(x, y) {
  const lx = (x + 0.5) * 64;
  const ly = (y + 0.5) * 64;
  const sx = REF.tiles * 64 + (lx - ly) - refLeft;
  const sy = (lx + ly) / 2 - refTop;
  return Math.min(sx, REF.width - sx, (sy) * 2, (REF.height - sy) * 2) / 64; // přibližně v polích
}

let land = Array.from({ length: BH }, (_, y) =>
  Array.from({ length: BW }, (_, x) => {
    if ((coast[y]?.[x] ?? '~') === '~') return false;
    const edge = distanceToImageEdge(x, y);
    return !(edge < 4 && fbm(x * 0.18, y * 0.18, 1) > 0.25 + edge * 0.12);
  })
);

for (let pass = 0; pass < 2; pass++) {
  land = land.map((row, y) =>
    row.map((_, x) => {
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) if (land[y + dy]?.[x + dx]) count++;
      }
      return count >= 5;
    })
  );
}

// Drobné ostrůvky (šum měření) pryč, malá jezírka uvnitř pevniny zasypat.
function components(value) {
  const seen = new Uint8Array(BW * BH);
  const list = [];
  for (let y = 0; y < BH; y++) {
    for (let x = 0; x < BW; x++) {
      if (land[y][x] !== value || seen[y * BW + x]) continue;
      const tiles = [];
      let touchesBorder = false;
      const stack = [[x, y]];
      seen[y * BW + x] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        tiles.push([cx, cy]);
        if (cx === 0 || cy === 0 || cx === BW - 1 || cy === BH - 1) touchesBorder = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= BW || ny >= BH) continue;
          if (land[ny][nx] === value && !seen[ny * BW + nx]) { seen[ny * BW + nx] = 1; stack.push([nx, ny]); }
        }
      }
      list.push({ tiles, touchesBorder });
    }
  }
  return list;
}
for (const c of components(true)) if (c.tiles.length < 40) for (const [x, y] of c.tiles) land[y][x] = false;
for (const c of components(false)) if (!c.touchesBorder && c.tiles.length < 30) for (const [x, y] of c.tiles) land[y][x] = true;

// Ořez na pevninu + okraj vody.
let minX = BW, minY = BH, maxX = 0, maxY = 0;
land.forEach((row, y) => row.forEach((v, x) => {
  if (!v) return;
  minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}));
const OX = Math.max(0, minX - MARGIN);
const OY = Math.max(0, minY - MARGIN);
const W = Math.min(BW, maxX + MARGIN + 1) - OX;
const H = Math.min(BH, maxY + MARGIN + 1) - OY;

// Stará souřadnice pole → nová (střed).
const toNew = (x, y) => ({ x: x * SCALE - OX, y: y * SCALE - OY });

const grid = Array.from({ length: H }, (_, y) =>
  Array.from({ length: W }, (_, x) => (land[y + OY][x + OX] ? '.' : '~'))
);
const at = (x, y) => grid[y]?.[x] ?? '~';
const set = (x, y, c) => { if (grid[y]?.[x] !== undefined) grid[y][x] = c; };
const isLand = (x, y) => at(x, y) !== '~';

// --------------------------------------------- 2. louka (zóna setkání)

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!isLand(x, y)) continue;
    const ox = (x + OX + 0.5) / SCALE;
    const oy = (y + OY + 0.5) / SCALE;
    // Okolí původní louky, rozšířené o ~2,5 starého pole se zvlněným okrajem.
    let best = 99;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (oldAt(ox + dx, oy + dy) === ',') best = Math.min(best, Math.hypot(dx, dy));
      }
    }
    if (best <= 1.6 + fbm(x * 0.12, y * 0.12, 5) * 1.6) set(x, y, ',');
  }
}

// Zóna setkání je jen jedna: necháme největší souvislou louku, zbytky budou tráva.
{
  const seen = new Set();
  const components = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (at(x, y) !== ',' || seen.has(y * W + x)) continue;
      const tiles = [];
      const stack = [[x, y]];
      seen.add(y * W + x);
      while (stack.length) {
        const [cx, cy] = stack.pop();
        tiles.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (at(nx, ny) === ',' && !seen.has(ny * W + nx)) { seen.add(ny * W + nx); stack.push([nx, ny]); }
        }
      }
      components.push(tiles);
    }
  }
  components.sort((a, b) => b.length - a.length);
  for (const tiles of components.slice(1)) for (const [x, y] of tiles) set(x, y, '.');
}

// ------------------------------------------- 3.–4. náměstí, cesty, most

const oldTiles = (ch) => {
  const list = [];
  oldGrid.forEach((row, y) => row.forEach((c, x) => { if (c === ch) list.push({ x: x + 0.5, y: y + 0.5 }); }));
  return list;
};

function disc(cx, cy, r, ch, canOverride = () => true) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r && canOverride(at(x, y), x, y)) set(x, y, ch);
    }
  }
}

// Cesty: každé staré pole cesty = kotouč v nové mapě (souvislá, mírně zvlněná cesta).
for (const t of oldTiles(':')) {
  const p = toNew(t.x, t.y);
  disc(p.x, p.y, 1.25 + noise(p.x * 0.3, p.y * 0.3, 7) * 0.35, ':', (c) => c === '.' || c === ',');
}

// Náměstí: kruh se středem v těžišti staré dlažby.
const plazaOld = oldTiles('#');
const plazaCenter = toNew(
  plazaOld.reduce((s, t) => s + t.x, 0) / plazaOld.length,
  plazaOld.reduce((s, t) => s + t.y, 0) / plazaOld.length
);
const plazaRadius = Math.sqrt(plazaOld.length / Math.PI) * SCALE * 0.9;
disc(plazaCenter.x, plazaCenter.y, plazaRadius, '#', (c) => c !== '~');

// --------------------------------------------------------- budovy

const buildings = OLD.buildings.map((b) => {
  const center = toNew(b.x + b.width / 2, b.y + b.height / 2);
  return { ...b, x: Math.round(center.x - b.width / 2), y: Math.round(center.y - b.height / 2) };
});

for (const b of buildings) {
  // Parcela = půdorys + jedno pole okolo, rohy zaoblené šumem.
  for (let y = b.y - 1; y <= b.y + b.height; y++) {
    for (let x = b.x - 1; x <= b.x + b.width; x++) {
      const corner = (x === b.x - 1 || x === b.x + b.width) && (y === b.y - 1 || y === b.y + b.height);
      if (corner && hash2(x, y, 3) < 0.6) continue;
      if (isLand(x, y)) set(x, y, '_');
    }
  }
  b.door = { x: b.x + b.width, y: b.y + Math.floor(b.height / 2) };
}

// Cesta ode dveří k nejbližší cestě nebo náměstí (nejkratší cesta po pevnině).
function carvePath(from, isTarget, mark = ':') {
  const key = (x, y) => y * W + x;
  const prev = new Map([[key(from.x, from.y), null]]);
  const queue = [from];
  let found = null;
  while (queue.length) {
    const p = queue.shift();
    if (isTarget(p.x, p.y) && (p.x !== from.x || p.y !== from.y)) { found = p; break; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: p.x + dx, y: p.y + dy };
      const c = at(n.x, n.y);
      if (prev.has(key(n.x, n.y)) || !'.,_:#'.includes(c)) continue;
      if (buildings.some((b) => n.x >= b.x && n.x < b.x + b.width && n.y >= b.y && n.y < b.y + b.height)) continue;
      prev.set(key(n.x, n.y), p);
      queue.push(n);
    }
  }
  for (let p = found; p; p = prev.get(key(p.x, p.y))) {
    if ('.,_'.includes(at(p.x, p.y))) set(p.x, p.y, mark);
  }
  return found;
}

for (const b of buildings) {
  set(b.door.x, b.door.y, ':');
  carvePath(b.door, (x, y) => (at(x, y) === ':' || at(x, y) === '#') && Math.hypot(x - b.door.x, y - b.door.y) > 1.5);
}

// ------------------------------------------------------ 5. útesy

const cliffs = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!'.,_'.includes(at(x, y))) continue;
    let nearWater = 99;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) if (at(x + dx, y + dy) === '~') nearWater = Math.min(nearWater, Math.max(Math.abs(dx), Math.abs(dy)));
    }
    if (nearWater === 1 || (nearWater === 2 && fbm(x * 0.15, y * 0.15, 9) > 0.55)) cliffs.push([x, y]);
  }
}
for (const [x, y] of cliffs) set(x, y, '^');

// Most: rovný pás mezi severním a jižním koncem starého mostu, protažený na obou
// stranách až na průchozí pevninu. Nad vodou a útesy most, na pevnině cesta.
{
  const old = oldTiles('=');
  const north = old.reduce((a, t) => (t.x + t.y < a.x + a.y ? t : a));
  const south = old.reduce((a, t) => (t.x + t.y > a.x + a.y ? t : a));
  const a = toNew(north.x, north.y);
  const b = toNew(south.x, south.y);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const walkable = (x, y) => '.,:#_'.includes(at(Math.floor(x), Math.floor(y)));

  let t0 = 0;
  while (!walkable(a.x + ux * t0, a.y + uy * t0) && t0 > -20) t0 -= 0.5;
  let t1 = len;
  while (!walkable(a.x + ux * t1, a.y + uy * t1) && t1 < len + 20) t1 += 0.5;

  for (let t = t0 - 1; t <= t1 + 1; t += 0.25) {
    const cx = a.x + ux * t;
    const cy = a.y + uy * t;
    disc(cx, cy, 1.05, '=', (c) => c === '~' || c === '^' || c === '=');
    disc(cx, cy, 1.05, ':', (c) => c === '.' || c === ',' || c === 'T' || c === 'R');
  }
}

// Vodopád.
for (const t of oldTiles('F')) {
  const p = toNew(t.x, t.y);
  disc(p.x, p.y, 1.2, 'F', (c) => c === '~' || c === '^');
}

// Jeskyně: skalní masiv za vchodem (sever a západ), před vchodem průchozí pole.
const caveOld = oldTiles('C')[0];
const cave = toNew(caveOld.x, caveOld.y);
const caveX = Math.floor(cave.x);
const caveY = Math.floor(cave.y);
for (let y = caveY - 4; y <= caveY + 1; y++) {
  for (let x = caveX - 4; x <= caveX + 1; x++) {
    const behind = x <= caveX && y <= caveY;
    if (behind && Math.hypot(x - caveX, y - caveY) <= 3.8 && isLand(x, y)) set(x, y, '^');
  }
}
set(caveX, caveY, 'C');
for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) {
  if (at(caveX + dx, caveY + dy) !== '~') set(caveX + dx, caveY + dy, ',');
}

// --------------------------------------------------------- 6. molo

const hut = buildings.find((b) => b.id === 'greenvale_fishing_hut');
let dock = null;
for (const [dx, dy] of [[1, 0], [0, 1], [0, -1], [-1, 0]]) {
  let x = hut.door.x;
  let y = hut.door.y;
  let steps = 0;
  while (at(x, y) !== '~' && steps < 18) { x += dx; y += dy; steps++; }
  if (at(x, y) === '~') { dock = { x, y, dx, dy }; break; }
}

if (dock) {
  const { dx, dy } = dock;
  // Šířka 2 pole kolmo na směr, délka 5 polí do vody, začíná na břehu.
  const px = dy !== 0 ? 1 : 0;
  const py = dx !== 0 ? 1 : 0;
  for (let i = -1; i < 5; i++) {
    for (let w = 0; w < 2; w++) set(dock.x + dx * i + px * w, dock.y + dy * i + py * w, 'D');
  }
  // Cesta od chaty k molu.
  let x = hut.door.x;
  let y = hut.door.y;
  while (at(x, y) !== 'D') {
    if ('.,_^'.includes(at(x, y))) set(x, y, ':');
    x += dx; y += dy;
  }
  dock.end = { x: dock.x + dx * 4, y: dock.y + dy * 4 };
}

// ------------------------------------------------ 7. stromy a skály

const spawnOld = oldTiles('=');
const spawnTile = toNew(
  spawnOld.reduce((s, t) => s + t.x, 0) / spawnOld.length,
  spawnOld.reduce((s, t) => s + t.y, 0) / spawnOld.length
);

function clearAround(x, y, r, blocked) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) if (blocked.includes(at(x + dx, y + dy))) return false;
  }
  return true;
}

const inBuilding = (x, y) => buildings.some((b) => x >= b.x - 1 && x <= b.x + b.width && y >= b.y - 1 && y <= b.y + b.height);

// Stromy rostou v hustých lesících (šum „forest“), mimo ně jen jednotlivě.
// Na tmavé louce (zóna setkání) rostou smrky (S): hustěji na okraji louky,
// uvnitř jen pár, aby louka zůstala otevřená.
const isMeadowEdge = (x, y) => !clearAround(x, y, 1, '.') || !clearAround(x, y, 1, '^');

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const here = at(x, y);
    if (here !== '.' && here !== ',') continue;
    if (inBuilding(x, y)) continue;
    if (!clearAround(x, y, 1, ':#_=DCF')) continue;
    if (!clearAround(x, y, 2, ':#=D')) continue;
    if (Math.hypot(x - spawnTile.x, y - spawnTile.y) < 4) continue;

    const forest = fbm(x * 0.09, y * 0.09, 13);
    const roll = random();

    if (here === ',') {
      const chance = isMeadowEdge(x, y) ? 0.3 : 0.012;
      if (roll < chance) set(x, y, 'S');
      else if (roll < chance + 0.003) set(x, y, 'R');
      continue;
    }

    const coast = !clearAround(x, y, 2, '^~');
    let treeChance = forest > 0.56 ? 0.85 : forest > 0.5 ? 0.2 : 0.012;
    if (coast) treeChance = Math.min(treeChance, 0.35) + 0.03;
    const rockChance = 0.008 + (coast ? 0.035 : 0) + (forest < 0.35 ? 0.012 : 0);

    // V lesích je občas smrk, aby lesy nebyly jednotvárné.
    if (roll < treeChance) set(x, y, hash2(x, y, 41) < (forest > 0.66 ? 0.3 : 0.12) ? 'S' : 'T');
    else if (roll < treeChance + rockChance) set(x, y, 'R');
  }
}

// ------------------------------------------- 8. doplňky (ploty, keře…)
//
// Doplňky nemají vlastní znak v mapě – jsou v seznamu `decor` se souřadnicemi
// v polích (desetinná čísla = místo uvnitř pole).
//   ['fence', x, y, osa]   plot na hraně pole; osa 'x' = hrana podél osy x, 'y' = podél osy y
//   [druh, x, y, varianta] bush (keř, kytky), plant (rákos, kapradí, jetel),
//                          stump (pařez, kmen), signpost (rozcestník)

const decor = [];
const r2 = (v) => Math.round(v * 100) / 100;
const addDecor = (type, x, y, extra) => decor.push([type, r2(x), r2(y), extra]);
const inFootprint = (x, y) => buildings.some((b) => x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height);
const plotOf = (b, x, y) => x >= b.x - 1 && x <= b.x + b.width && y >= b.y - 1 && y <= b.y + b.height;

// Ploty kolem obytných parcel (náměstí s radnicí, tržištěm a hospodou zůstává otevřené).
const FENCED = ['home', 'smithy', 'hunter', 'fishing'];
for (const b of buildings) {
  if (!FENCED.some((part) => b.id.includes(part))) continue;
  for (let y = b.y - 1; y <= b.y + b.height; y++) {
    for (let x = b.x - 1; x <= b.x + b.width; x++) {
      if (at(x, y) !== '_' || inFootprint(x, y)) continue;
      const edges = [
        [1, 0, x + 1, y + 0.5, 'y'],
        [-1, 0, x, y + 0.5, 'y'],
        [0, 1, x + 0.5, y + 1, 'x'],
        [0, -1, x + 0.5, y, 'x']
      ];
      for (const [dx, dy, ex, ey, axis] of edges) {
        const n = at(x + dx, y + dy);
        if (n === '_' && plotOf(b, x + dx, y + dy)) continue;
        if (!'.,TSR'.includes(n)) continue; // u cest, vody a útesů plot není
        if (hash2(Math.round(ex * 2), Math.round(ey * 2), 51) < 0.07) continue; // občas mezera
        addDecor('fence', ex, ey, axis);
      }
    }
  }
}

const near = (x, y, r, chars) => !clearAround(x, y, r, chars);

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const here = at(x, y);
    const jx = x + 0.25 + hash2(x, y, 61) * 0.5;
    const jy = y + 0.25 + hash2(x, y, 62) * 0.5;
    const roll = hash2(x, y, 63);
    const pick = (n) => Math.floor(hash2(x, y, 64) * n);

    if (here === '_' && !inFootprint(x, y)) {
      // Zahrádky na parcelách.
      if (roll < 0.1) addDecor('bush', jx, jy, pick(6));
      continue;
    }

    if (here === '.') {
      const trees = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
        .filter(([dx, dy]) => 'TS'.includes(at(x + dx, y + dy))).length;

      if (near(x, y, 2, '_#') && roll < 0.14) addDecor('bush', jx, jy, pick(6));
      else if (near(x, y, 1, '^') && near(x, y, 2, '~') && roll < 0.12) addDecor('plant', jx, jy, 0);
      else if (trees >= 2 && roll < 0.07) addDecor('stump', jx, jy, pick(2));
      else if (trees >= 2 && roll < 0.17) addDecor('plant', jx, jy, 1 + pick(2));
      else if (roll < 0.022) addDecor(roll < 0.011 ? 'bush' : 'plant', jx, jy, roll < 0.011 ? pick(6) : 1 + pick(3));
    } else if (here === ',') {
      if (roll < 0.025) addDecor('plant', jx, jy, 1 + pick(3));
    }
  }
}

// Rozcestník u náměstí: tráva vedle cesty, co nejblíž středu náměstí.
{
  let best = null;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (at(x, y) !== '.' || !near(x, y, 1, ':') || !near(x, y, 1, '#')) continue;
      const d = Math.hypot(x - plazaCenter.x, y - plazaCenter.y);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  if (best) addDecor('signpost', best.x + 0.5, best.y + 0.5, 0);
}

// ------------------------------------------------------------ výstup

const spawn = { x: Math.floor(spawnTile.x), y: Math.floor(spawnTile.y) };
const encounterCenter = (() => {
  let sx = 0, sy = 0, n = 0;
  grid.forEach((row, y) => row.forEach((c, x) => { if (c === ',') { sx += x; sy += y; n++; } }));
  return { x: Math.round(sx / n), y: Math.round(sy / n), tiles: n };
})();

// Referenční obrázek: přepočet jeho středu ze staré izometrie do nové.
const oldIsoW = OW * 2 * 64;
const oldIsoH = OH * 2 * 32;
const oldA = oldIsoW / 2 - OH * 64; // lx - ly
const oldB = (oldIsoH / 2) * 2; // lx + ly
const refOld = { x: (oldA + oldB) / 2, y: (oldB - oldA) / 2 }; // logické px staré mapy
const refNew = { x: refOld.x * SCALE - OX * 64, y: refOld.y * SCALE - OY * 64 };
const reference = {
  x: H * 64 + (refNew.x - refNew.y),
  y: (refNew.x + refNew.y) / 2,
  width: (OLD.reference?.width ?? 3840) * SCALE
};

const rows = grid.map((row) => `    '${row.join('')}'`).join(',\n');
const buildingLines = buildings
  .map((b) => `    { id: '${b.id}', name: '${b.name}', x: ${b.x}, y: ${b.y}, width: ${b.width}, height: ${b.height}, door: { x: ${b.door.x}, y: ${b.door.y} } }`)
  .join(',\n');

const decorLines = [];
for (let i = 0; i < decor.length; i += 6) {
  decorLines.push('    ' + decor.slice(i, i + 6).map((d) => JSON.stringify(d).replace(/"/g, "'")).join(', '));
}

const counts = {};
grid.flat().forEach((c) => { counts[c] = (counts[c] ?? 0) + 1; });

const file = `// Mapa vesnice Greenvale: ${W} × ${H} polí na logické mřížce.
// Ve hře se vykresluje izometricky (kamera z jihovýchodu, pole 128 × 64 px).
//
// Vygenerováno skriptem tools/greenvale-generate.mjs (seed ${SEED}) ze zvětšeného
// rozložení podle referenčního obrázku. Dál se může upravovat ručně.
//
// Každý znak v \`ground\` je jedno pole. Význam znaků najdeš v src/data/tiles.js:
//   .  tráva        ,  louka – zóna setkání        :  cesta        #  dlažba
//   _  parcela      =  most        D  molo        ~  voda         ^  útes
//   T  strom        S  smrk        R  skála       C  jeskyně     F  vodopád
//
// Souřadnice polí: x = sloupec (0 vlevo), y = řádek (0 nahoře) v logické mřížce.
// Na obrazovce je pole 0,0 nahoře, osa x vede doprava dolů a osa y doleva dolů.
// Ve hře zapni klávesou G mřížku – ukazuje souřadnice pole pod myší.
// Klávesa R přepne průhledný referenční obrázek (původní menší rozložení).

export const GREENVALE_MAP = {
  id: 'Greenvale',
  name: 'Greenvale',

  // Referenční obrázek: střed (x, y) a šířka v px izometrické obrazovky.
  reference: {
    key: 'reference-greenvale',
    path: 'assets/greenvale/greenvale-map.png',
    x: ${Math.round(reference.x)},
    y: ${Math.round(reference.y)},
    width: ${reference.width}
  },

  ground: [
${rows}
  ],

  // Hráč začíná na mostě, pokud nemá platnou uloženou pozici.
  spawn: { x: ${spawn.x}, y: ${spawn.y} },

  // Budovy stojí na parcelách (_). x, y = severozápadní roh půdorysu v polích,
  // width × height = půdorys, přes který se nedá projít.
  // door = pole, na kterém hráč stojí, když vchází dovnitř (klávesa E).
  buildings: [
${buildingLines}
  ],

  // Doplňky bez kolize (kromě plotů): [druh, x, y, varianta / osa plotu].
  // x, y v polích, desetinná místa = poloha uvnitř pole. Viz generátor, oddíl 8.
  decor: [
${decorLines.join(',\n')}
  ],

  // Zajímavá místa – zatím jen značky v ladicím režimu.
  points: [
    { id: 'cave', name: 'Jeskyně', x: ${caveX}, y: ${caveY} },
    { id: 'encounter', name: 'Zóna setkání', x: ${encounterCenter.x}, y: ${encounterCenter.y} }${dock ? `,
    { id: 'fishing_dock', name: 'Rybářské místo (molo)', x: ${dock.end.x}, y: ${dock.end.y} }` : ''}
  ]
};
`;

writeFileSync(new URL('../src/data/maps/greenvale.js', import.meta.url), file);

// ---------------------------------------------------- náhled (PNG shora)

const colors = {
  '.': [106, 154, 80], ',': [78, 127, 60], ':': [184, 151, 106], '#': [168, 156, 136], '_': [168, 133, 96],
  '=': [138, 106, 72], 'D': [154, 118, 80], '~': [58, 111, 154], '^': [118, 105, 92], 'T': [40, 90, 40], 'S': [20, 64, 40],
  'R': [150, 145, 140], 'C': [30, 25, 20], 'F': [156, 200, 224]
};
const cell = 5;
const pw = W * cell;
const ph = H * cell;
const raw = Buffer.alloc((pw * 3 + 1) * ph);
for (let y = 0; y < ph; y++) {
  raw[y * (pw * 3 + 1)] = 0;
  for (let x = 0; x < pw; x++) {
    let c = colors[grid[Math.floor(y / cell)][Math.floor(x / cell)]] ?? [255, 0, 255];
    if (buildings.some((b) => x / cell >= b.x && x / cell < b.x + b.width && y / cell >= b.y && y / cell < b.y + b.height)) c = [200, 60, 50];
    raw.set(c, y * (pw * 3 + 1) + 1 + x * 3);
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(pw, 0); ihdr.writeUInt32BE(ph, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(new URL('./greenvale-preview.png', import.meta.url), Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
]));

console.log(`Mapa ${W} × ${H}, start ${spawn.x},${spawn.y}, jeskyně ${caveX},${caveY}, molo ${dock ? `${dock.x},${dock.y}` : 'nenalezeno'}`);
console.log(`Zóna setkání: ${encounterCenter.tiles} polí, stromy ${counts.T ?? 0}, smrky ${counts.S ?? 0}, skály ${counts.R ?? 0}`);
const decorCounts = {};
decor.forEach(([type]) => { decorCounts[type] = (decorCounts[type] ?? 0) + 1; });
console.log('Doplňky:', JSON.stringify(decorCounts));
