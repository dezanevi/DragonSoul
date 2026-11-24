// Přestavba jádra vesnice Greenvale podle referenčního obrázku (kompaktní vesnice
// kolem dlážděného náměstí se studnou, řeka s vodopádem, mlýnem a rybářskou chatou,
// kamenný most na cestě k jihu, les kolem).
//
// Vstup i výstup: src/data/maps/greenvale.js. Mimo oblast vesnice (louka setkání
// a jeskyně na západě, jih s mostem a bránou, ostrůvky) se mapa nemění.
//
//  1. Oblast vesnice (VILLAGE_AREA) se vyčistí na trávu (útesy, moře a molo zůstanou).
//  2. Řeka (RIVER) s vodopádem, náměstí, budovy s parcelami (BUILDINGS).
//  3. Cesty: od dveří k náměstí, hlavní cesty k mostu přes řeku, na západ k louce,
//     na jih k bráně a na východ k molu.
//  4. Les kolem vesnice, keře, ploty kolem domů a dvorů.
//  5. Rybářská místa podél řeky u rybářské chaty, zkušební lom u kovárny.
//
// Použití: node tools/greenvale-village.mjs        (výsledek je deterministický)
// Náhled: tools/greenvale-village-preview.bmp (izometricky, jako ve hře)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAP_FILE = 'src/data/maps/greenvale.js';
const PREVIEW_FILE = 'tools/greenvale-village-preview.bmp';

// src/package.json je prázdný – mapu načteme přes kopii mimo projekt.
const source = fs.readFileSync(MAP_FILE, 'utf8');
const tmp = path.join(os.tmpdir(), `greenvale-${process.pid}.mjs`);
fs.writeFileSync(tmp, source);
const { GREENVALE_MAP: map } = await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

const grid = map.ground.map((row) => row.split(''));
const H = grid.length;
const W = grid[0].length;
const at = (x, y) => (grid[y]?.[x] ?? '~');
const set = (x, y, c) => { if (grid[y]?.[x] !== undefined) grid[y][x] = c; };

function hash2(x, y, s = 1) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, y, s = 0, scale = 6) {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sm = (t) => t * t * (3 - 2 * t);
  const a = hash2(x0, y0, s), b = hash2(x0 + 1, y0, s), c = hash2(x0, y0 + 1, s), d = hash2(x0 + 1, y0 + 1, s);
  return (a + (b - a) * sm(tx)) + ((c + (d - c) * sm(tx)) - (a + (b - a) * sm(tx))) * sm(ty);
}

// ------------------------------------------------------------ 1. vyčištění

// Oblast vesnice: x ≥ 42 (západně je louka setkání), řádky 30–84 (jižněji most a brána).
const VILLAGE_AREA = { x0: 42, x1: 92, y0: 30, y1: 84 };
const inArea = (x, y) => x >= VILLAGE_AREA.x0 && x <= VILLAGE_AREA.x1 && y >= VILLAGE_AREA.y0 && y <= VILLAGE_AREA.y1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!inArea(x, y)) continue;
    if ('~^D'.includes(at(x, y))) continue;
    set(x, y, '.');
  }
}
// Zbytky starých parcel mimo oblast (původní lovecká chata na louce) zarostou trávou.
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === '_') set(x, y, '.');

// ------------------------------------------------------------ 2. řeka, náměstí, budovy

// Řeka: od vodopádu pod skalami na západě oblouk jihem vesnice až do moře na východě.
const RIVER = [[43, 61], [45, 68], [48, 74], [53, 79], [60, 81], [67, 79], [73, 74], [79, 69], [85, 65], [91, 62], [95, 61]];
const RIVER_WIDTH = 1.4; // poloměr koryta (pole)
function segmentDistance(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const riverDistance = (x, y) => Math.min(...RIVER.slice(1).map((p, i) => segmentDistance(x, y, RIVER[i], p)));
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!inArea(x, y) || at(x, y) === 'D') continue;
    const wobble = (noise(x, y, 5, 4) - 0.5) * 0.6;
    if (riverDistance(x + 0.5, y + 0.5) < RIVER_WIDTH + wobble) set(x, y, '~');
  }
}
// Vodopád a skalní práh, ze kterého řeka vytéká.
for (const [x, y, c] of [[42, 59, '^'], [43, 59, '^'], [44, 59, '^'], [42, 60, '^'], [45, 59, 'R'], [41, 60, 'R'], [43, 60, 'F'], [44, 60, 'F'], [42, 61, 'R']]) set(x, y, c);

// Náměstí: dlážděný kruh, uprostřed studna.
const PLAZA = { x: 61.5, y: 57.5, r: 5.2 };
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (Math.hypot(x + 0.5 - PLAZA.x, y + 0.5 - PLAZA.y) < PLAZA.r + (noise(x, y, 9, 3) - 0.5) * 0.8) set(x, y, '#');
  }
}

// Budovy: x, y = severozápadní roh půdorysu. door = pole před dveřmi (strana +x, kde je
// mají obrázky sady v2); bez door se dovnitř nevchází. yard = ohrazený dvůr (ploty).
const BUILDINGS = [
  // Sever: radnice nad náměstím, nástěnka u ní, hvězdárna v lese za ní.
  { id: 'greenvale_town_hall', name: 'Radnice', x: 58, y: 45, width: 3, height: 2, door: { x: 61, y: 46 } },
  { id: 'greenvale_notice_board', name: 'Nástěnka', x: 60, y: 47, width: 1, height: 1 },
  { id: 'greenvale_observatory', name: 'Hvězdárna', x: 65, y: 27, width: 4, height: 4, door: { x: 69, y: 29 } },
  { id: 'greenvale_house_n2', name: 'Dům', x: 73, y: 38, width: 4, height: 4, yard: true },
  { id: 'greenvale_house_n3', name: 'Dům', x: 48, y: 40, width: 4, height: 4, yard: true },
  // Náměstí: kašna uprostřed, tržiště a stánky kolem.
  { id: 'greenvale_fountain', name: 'Kašna', x: 59, y: 56, width: 3, height: 3 },
  { id: 'greenvale_stall_flowers', name: 'Stánek s květinami', x: 56, y: 56, width: 2, height: 2 },
  { id: 'greenvale_market', name: 'Tržiště – potraviny', x: 63, y: 51, width: 2, height: 3, door: { x: 64, y: 54 } },
  { id: 'greenvale_market_wares', name: 'Tržiště – zboží', x: 58, y: 51, width: 2, height: 3, door: { x: 59, y: 54 } },
  { id: 'greenvale_stall_fish', name: 'Stánek s rybami', x: 56, y: 59, width: 2, height: 2 },
  // Východ: kovárna, sklad, hostinec, alchymista u řeky, dům.
  { id: 'greenvale_smithy', name: 'Kovárna', x: 62, y: 67, width: 5, height: 5, door: { x: 67, y: 69 }, yard: true },
  { id: 'greenvale_warehouse', name: 'Sklad', x: 88, y: 65, width: 5, height: 4 },
  { id: 'greenvale_house_e1', name: 'Řemeslná dílna', x: 59, y: 33, width: 4, height: 4, door: { x: 61, y: 37 }, yard: true },
  { id: 'greenvale_tavern', name: 'Hostinec', x: 66, y: 45, width: 5, height: 4, door: { x: 71, y: 46 } },
  { id: 'greenvale_alchemist', name: 'Alchymistický obchod', x: 53, y: 72, width: 5, height: 4, door: { x: 58, y: 73 } },
  // Západ: domy, kostel, lovecká chata u vodopádu.
  { id: 'greenvale_house_green', name: 'Dům', x: 71, y: 57, width: 4, height: 3, yard: true },
  { id: 'greenvale_home_3', name: 'Dům', x: 49, y: 47, width: 4, height: 3, door: { x: 53, y: 48 }, yard: true },
  { id: 'greenvale_home_1', name: 'Dům', x: 49, y: 53, width: 4, height: 4, door: { x: 53, y: 54 }, yard: true },
  { id: 'greenvale_hunter_lodge', name: 'Lovecká chata', x: 35, y: 58, width: 4, height: 4, door: { x: 39, y: 59 }, yard: true },
  // Jih (u řeky): dům pod náměstím, rybářská chata s molem.
  { id: 'greenvale_home_2', name: 'Dům', x: 42, y: 43, width: 4, height: 4, door: { x: 46, y: 44 }, yard: true },
  { id: 'greenvale_fishing_hut', name: 'Rybářská chata', x: 84, y: 54, width: 5, height: 4, door: { x: 89, y: 56 }, yard: true },
  // Statek za mostem: statek, větrný mlýn, studna, stáj (pole viz FIELDS).
  // Vložené v editoru terénu: zelený dům u tržiště a kostel (oba dveře na jihozápad; původní kostel na kraji louky smazán).
  { id: 'greenvale_house_w1', name: 'Dům', x: 68, y: 60, width: 3, height: 4, yard: true },
  { id: 'greenvale_church', name: 'Kostel', x: 48, y: 62, width: 5, height: 5 },
  { id: 'greenvale_house_e2', name: 'Statek', x: 74, y: 79, width: 4, height: 4, yard: true },
  { id: 'greenvale_windmill', name: 'Větrný mlýn', x: 82, y: 76, width: 3, height: 3, noPath: true },
  { id: 'greenvale_well', name: 'Studna', x: 80, y: 81, width: 2, height: 1, noPath: true },
  { id: 'greenvale_stable', name: 'Stáj', x: 86, y: 76, width: 4, height: 4, noPath: true }
];

// Pole statku (později bylinky): pruhy obdělané půdy (parcela) a trávy, kolem plot.
const FIELDS = [
  { x: 61, y: 82, w: 7, h: 4, gate: 'south' },
  { x: 84, y: 80, w: 5, h: 3 },
  { x: 77, y: 83, w: 5, h: 2 }
];

// Terén se přizpůsobí budovám: pod budovou, parcelou a dveřmi je pevnina (posunutá budova
// na útesu nebo u moře), nový břeh dostane útes.
{
  const land = [];
  for (const b of BUILDINGS) {
    for (let y = b.y - 1; y <= b.y + b.height; y++) for (let x = b.x - 1; x <= b.x + b.width + (b.door ? 1 : 0); x++) {
      if ('~^'.includes(at(x, y)) && riverDistance(x + 0.5, y + 0.5) > RIVER_WIDTH + 0.6) { set(x, y, '.'); land.push([x, y]); }
    }
  }
  for (const [x, y] of land) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (at(nx, ny) === '~' && riverDistance(nx + 0.5, ny + 0.5) > RIVER_WIDTH + 1) set(nx, ny, '^');
    }
  }
}

const inFootprint = (x, y, list = BUILDINGS) => list.find((b) => x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height);
const problems = [];
for (const b of BUILDINGS) {
  for (let y = b.y; y < b.y + b.height; y++) {
    for (let x = b.x; x < b.x + b.width; x++) {
      if ('~^FD'.includes(at(x, y))) problems.push(`${b.id}: půdorys ${x},${y} na „${at(x, y)}“`);
      const other = inFootprint(x, y, BUILDINGS.filter((o) => o !== b));
      if (other && b.id < other.id) problems.push(`${b.id} se překrývá s ${other.id} na ${x},${y}`);
    }
  }
  if (b.door && (inFootprint(b.door.x, b.door.y) || '~^FD'.includes(at(b.door.x, b.door.y)))) problems.push(`${b.id}: dveře ${b.door.x},${b.door.y} nejsou volné`);
}

// Parcela = půdorys + okraj 1 pole (mimo náměstí).
for (const b of BUILDINGS) {
  for (let y = b.y - 1; y <= b.y + b.height; y++) {
    for (let x = b.x - 1; x <= b.x + b.width; x++) {
      if ('.,TSR'.includes(at(x, y))) set(x, y, '_');
    }
  }
}

// Pole statku: řádky parcely (obdělaná půda) střídavě s trávou.
for (const field of FIELDS) {
  for (let y = field.y; y < field.y + field.h; y++) {
    for (let x = field.x; x < field.x + field.w; x++) {
      if (inFootprint(x, y) || !'._TSR'.includes(at(x, y))) { problems.push(`pole ${field.x},${field.y}: pole ${x},${y} není volné`); continue; }
      set(x, y, (y - field.y) % 2 === 0 ? '_' : '.');
    }
  }
}
const inField = (x, y) => FIELDS.some((f) => x >= f.x - 1 && x <= f.x + f.w && y >= f.y - 1 && y <= f.y + f.h);

// ------------------------------------------------------------ 3. cesty

const PASSABLE_FOR_PATH = '._,:#=';
const blockedForPath = (x, y) => Boolean(inFootprint(x, y)) || inField(x, y) || !PASSABLE_FOR_PATH.includes(at(x, y));
// Nejkratší cesta (BFS) z pole `from` k cíli; vyznačí ji `mark` (jen na trávě a parcelách).
function carvePath(from, isTarget, { mark = ':', width = 1, allowWater = false } = {}) {
  const key = (x, y) => y * W + x;
  const prev = new Map([[key(from.x, from.y), null]]);
  const queue = [from];
  let found = null;
  while (queue.length) {
    const p = queue.shift();
    if (isTarget(p.x, p.y) && !(p.x === from.x && p.y === from.y)) { found = p; break; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = p.x + dx, ny = p.y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(key(nx, ny))) continue;
      const water = at(nx, ny) === '~';
      if (blockedForPath(nx, ny) && !(allowWater && water) && !isTarget(nx, ny)) continue;
      prev.set(key(nx, ny), p);
      queue.push({ x: nx, y: ny });
    }
  }
  if (!found) return false;
  const tiles = [];
  for (let p = found; p; p = prev.get(key(p.x, p.y))) tiles.push(p);
  for (const p of tiles) {
    for (let oy = 0; oy < width; oy++) {
      for (let ox = 0; ox < width; ox++) {
        const x = p.x + ox, y = p.y + oy;
        if (inFootprint(x, y)) continue;
        const c = at(x, y);
        if (c === '~') set(x, y, '=');
        else if ('._,TSR'.includes(c)) set(x, y, mark);
      }
    }
  }
  return true;
}
const isRoad = (x, y) => ':#'.includes(at(x, y));
const isPlaza = (x, y) => at(x, y) === '#';

// Uliční síť města: rovné dlážděné ulice (šířka 2) mezi body; přes řeku most.
// Body jsou rohy ulice, úseky vodorovně nebo svisle v mřížce mapy.
const STREETS = [
  // Hlavní třída: radnice → náměstí; na jih přes most (viz SOUTH_AVENUE).
  { name: 'sever', points: [[61, 51], [61, 43], [68, 43], [68, 30]] },
  // Blok kolem hostince a tržiště (okruh zpět na hlavní třídu).
  { name: 'hostinec', points: [[62, 50], [73, 50], [73, 43], [68, 43]] },
  // Na východ k rybářské chatě a molu.
  { name: 'východ', points: [[66, 55], [82, 55]] },
  // Na západ k louce (dál polní cesta k jeskyni).
  { name: 'západ', points: [[55, 58], [42, 58]] },
  // Severozápad: domy a kostel.
  { name: 'severozápad', points: [[54, 58], [54, 44], [46, 44]] },
  // Na jih k alchymistovi a velkému kostelu.
  { name: 'jihozápad', points: [[58, 63], [58, 71]] },
  // Na jih k mostu přes řeku.
  { name: 'most', points: [[62, 64], [70, 64], [70, 78]], bridge: true }
];
function paintStreet(street, width = 2) {
  const paint = (x, y) => {
    if (inFootprint(x, y) || inField(x, y)) return;
    const c = at(x, y);
    if (c === '~') { if (street.bridge) set(x, y, '='); return; }
    if ('._,TSR:'.includes(c)) set(x, y, '#');
  };
  for (let i = 1; i < street.points.length; i++) {
    const [ax, ay] = street.points[i - 1];
    const [bx, by] = street.points[i];
    const sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
    for (let x = ax, y = ay; ; x += sx, y += sy) {
      for (let k = 0; k < width; k++) paint(sx ? x : x + k, sx ? y + k : y);
      // Roh: doplnit čtverec, aby se ulice v zatáčce nezúžila.
      if (x === bx && y === by) { for (let k = 0; k < width; k++) for (let j = 0; j < width; j++) paint(x + k, y + j); break; }
    }
  }
}
for (const street of STREETS) paintStreet(street);

// Venkovské cesty (polní): od mostu k jižní cestě a statku, ze západní ulice k louce a jeskyni.
const roads = [
  { from: { x: 70, y: 78 }, target: (x, y) => at(x, y) === ':' && y >= 85 },
  { from: { x: 42, y: 58 }, target: (x, y) => at(x, y) === ':' && x < VILLAGE_AREA.x0 }
];
for (const road of roads) {
  if (!carvePath(road.from, road.target, { width: 2 })) problems.push(`cesta z ${road.from.x},${road.from.y} nenašla cíl`);
}
// Od každých dveří k nejbližší cestě nebo náměstí.
for (const b of BUILDINGS) {
  if (b.noPath) continue;
  const start = b.door ?? { x: b.x + b.width, y: b.y + Math.floor(b.height / 2) };
  if (inFootprint(start.x, start.y)) continue;
  if (!isRoad(start.x, start.y)) set(start.x, start.y, ':');
  carvePath(start, (x, y) => isRoad(x, y) && Math.hypot(x - start.x, y - start.y) > 0);
}

// Cesty ve vesnici (severně od řeky) jsou dlážděné jako náměstí; na statku zůstanou polní.
const villageSide = (x, y) => { for (let yy = y + 1; yy <= VILLAGE_AREA.y1; yy++) if (at(x, yy) === '~') return true; return false; };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inArea(x, y) && at(x, y) === ':' && villageSide(x, y)) set(x, y, '#');

// ------------------------------------------------------------ 4. molo a rybářská místa

// Staré molo u ústí řeky (odříznuté řekou) nahrazuje molo u rybářské chaty.
for (let y = 59; y <= 62; y++) for (let x = 90; x <= 99; x++) if (at(x, y) === 'D') set(x, y, '~');

// Molo od dveří rybářské chaty na východ do moře (2 pole široké, 4 pole nad vodou).
const fishingHut = BUILDINGS.find((b) => b.id === 'greenvale_fishing_hut');
const DOCK_START = { x: fishingHut.door.x + 1, y: fishingHut.door.y };
{
  let overWater = 0;
  for (let x = DOCK_START.x; x < W && overWater < 4; x++) {
    const wet = at(x, DOCK_START.y) === '~' || at(x, DOCK_START.y + 1) === '~';
    if (wet) overWater++;
    set(x, DOCK_START.y, 'D');
    set(x, DOCK_START.y + 1, 'D');
  }
}

// Rybářská místa (dočasně všechny lokality Aurie): molo a břeh řeky u chaty.
const FISHING_LOCATIONS = map.fishingSpots.map((s) => s.location);
const fishingSpots = [];
const nextToWater = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === '~');
{
  const candidates = [];
  for (let y = DOCK_START.y - 8; y <= DOCK_START.y + 8; y++) {
    for (let x = DOCK_START.x - 8; x <= DOCK_START.x + 10; x++) {
      if (!'.:_D'.includes(at(x, y)) || inFootprint(x, y) || !nextToWater(x, y)) continue;
      candidates.push({ x, y, d: Math.hypot(x - DOCK_START.x - 3, y - DOCK_START.y) });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  FISHING_LOCATIONS.forEach((location, i) => {
    const c = candidates[i];
    if (c) fishingSpots.push({ location, x: c.x, y: c.y });
    else problems.push(`málo míst pro rybaření (${location})`);
  });
}

// ------------------------------------------------------------ 5. les, keře

const occupied = (x, y) => inFootprint(x, y) || !'.TSR'.includes(at(x, y));
function nearChar(x, y, r, chars) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (chars.includes(at(x + dx, y + dy))) return true;
  return false;
}
// Zkušební lom (naleziště Těžby) – volný obdélník 14 × 4 polí co nejblíž kovárně (rezervuje se před lesem).
const QUARRY = { w: 14, h: 4 };
const smithy = BUILDINGS.find((b) => b.id === 'greenvale_smithy');
let quarry = null;
for (let y = VILLAGE_AREA.y0; y <= 92 - QUARRY.h; y++) {
  for (let x = VILLAGE_AREA.x0; x <= VILLAGE_AREA.x1 - QUARRY.w; x++) {
    let ok = true;
    for (let yy = y - 1; yy <= y + QUARRY.h && ok; yy++) for (let xx = x - 1; xx <= x + QUARRY.w && ok; xx++) if (occupied(xx, yy)) ok = false;
    if (!ok) continue;
    const d = Math.hypot(x + QUARRY.w / 2 - smithy.x, y + QUARRY.h / 2 - smithy.y);
    if (!quarry || d < quarry.d) quarry = { x, y, d };
  }
}
if (!quarry) problems.push('nenašlo se místo pro zkušební lom');
// Lom je holá tráva (stromy a skály z něj pryč).
if (quarry) for (let y = quarry.y - 1; y <= quarry.y + QUARRY.h; y++) for (let x = quarry.x - 1; x <= quarry.x + QUARRY.w; x++) set(x, y, '.');
const inQuarry = (x, y) => quarry && x >= quarry.x - 1 && x <= quarry.x + QUARRY.w && y >= quarry.y - 1 && y <= quarry.y + QUARRY.h;

// Statek je venkov – kolem něj les jako dřív.
const FARM = new Set(['greenvale_house_e2', 'greenvale_windmill', 'greenvale_well', 'greenvale_stable']);
// Les: hustě dál od cest a domů, u vesnice jen jednotlivé stromy. Smrky víc na severu.
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!inArea(x, y) || at(x, y) !== '.' || inQuarry(x, y)) continue;
    if (nearChar(x, y, 1, ':#_=D') || inFootprint(x, y)) continue;
    if (fishingSpots.some((f) => Math.abs(f.x - x) <= 1 && Math.abs(f.y - y) <= 1)) continue; // u rybářských míst volno
    if (inField(x, y)) continue;
    const roll = hash2(x, y, 71);
    const forest = noise(x, y, 3, 5);
    const inTown = villageSide(x, y) && BUILDINGS.some((b) => !FARM.has(b.id) && x >= b.x - 5 && x < b.x + b.width + 5 && y >= b.y - 5 && y < b.y + b.height + 5);
    const deep = !inTown && !nearChar(x, y, 3, ':#_=D');
    const chance = inTown ? (nearChar(x, y, 1, '#_') ? 0 : 0.05) : deep ? 0.55 + forest * 0.4 : nearChar(x, y, 2, ':#_') ? 0.04 : 0.22 + forest * 0.2;
    if (roll < chance) {
      const spruce = hash2(x, y, 72) < 0.25 + (y < 50 ? 0.3 : 0);
      set(x, y, hash2(x, y, 73) < 0.03 ? 'R' : spruce ? 'S' : 'T');
    }
  }
}

// Stromy posunuté v editoru terénu (tools/greenvale-editor-export-2.json).
for (const [[fx, fy], [tx, ty]] of [[[43, 38], [44, 41]], [[47, 89], [50, 82]]]) {
  const c = at(fx, fy);
  if ('TSR'.includes(c) && at(tx, ty) === '.' && !inFootprint(tx, ty)) { set(tx, ty, c); set(fx, fy, '.'); }
}

// Naleziště Sběru bylin (dočasně všechna v Greenvale, jako Rybolov a Těžba): Greenvale H01–H07
// na místech podle biomu, záhony Z01–Z03 uprostřed polí statku, ostatní oblasti v „bylinkové
// zahradě“ (volný obdélník co nejblíž statku). Pole pod nalezištěm je vždy tráva.
const herbSpots = [];
const takenSpot = new Set();
const spotFree = (x, y) => !inFootprint(x, y) && !inField(x, y) && !inQuarry(x, y) && !takenSpot.has(`${x},${y}`)
  && '.TSR'.includes(at(x, y)) && !fishingSpots.some((f) => f.x === x && f.y === y);
const NEIGHBOURS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
const countAround = (x, y, chars) => NEIGHBOURS8.filter(([dx, dy]) => chars.includes(at(x + dx, y + dy))).length;
function placeHerb(site, near, test) {
  let best = null;
  for (let y = 26; y < H - 4; y++) {
    for (let x = 4; x < W - 4; x++) {
      if (!spotFree(x, y) || !test(x, y)) continue;
      const d = Math.hypot(x - near.x, y - near.y);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  if (!best) {
    problems.push(`bylina ${site}: nenašlo se místo`);
    return;
  }
  takenSpot.add(`${best.x},${best.y}`);
  set(best.x, best.y, '.');
  herbSpots.push({ site, x: best.x, y: best.y });
}
placeHerb('H01', { x: 40, y: 47 }, (x, y) => countAround(x, y, ',') >= 2);
placeHerb('H02', { x: 50, y: 71 }, (x, y) => countAround(x, y, '~') >= 2 && !nearChar(x, y, 1, 'F'));
placeHerb('H03', { x: 45, y: 61 }, (x, y) => nearChar(x, y, 2, 'F'));
placeHerb('H04', { x: 78, y: 35 }, (x, y) => countAround(x, y, 'TS') >= 3);
placeHerb('H05', { x: 54, y: 37 }, (x, y) => countAround(x, y, 'TS') >= 1 && countAround(x, y, 'TS') <= 2);
placeHerb('H06', { x: 41, y: 62 }, (x, y) => nearChar(x, y, 1, '^R') && !nearChar(x, y, 1, 'F'));
placeHerb('H07', { x: 78, y: 71 }, (x, y) => countAround(x, y, '~') >= 2);
FIELDS.forEach((f, i) => herbSpots.push({ site: `Z0${i + 1}`, x: f.x + Math.floor(f.w / 2), y: f.y + Math.floor(f.h / 2) }));
const GARDEN_SITES = ['H08', 'H09', 'H10', 'H11', 'H12', 'H13', 'H14', 'H15', 'H16', 'H17', 'H18', 'H19', 'SH1', 'SH2', 'SH3', 'SH4'];
const GARDEN = { cols: 4, rows: 4, step: 2 };
let garden = null;
{
  const gw = GARDEN.cols * GARDEN.step + 1;
  const gh = GARDEN.rows * GARDEN.step + 1;
  for (let y = 30; y <= 92 - gh; y++) {
    for (let x = 42; x <= 98 - gw; x++) {
      let ok = true;
      for (let yy = y; yy < y + gh && ok; yy++) {
        for (let xx = x; xx < x + gw && ok; xx++) {
          if (inFootprint(xx, yy) || inField(xx, yy) || inQuarry(xx, yy) || !'.TSR'.includes(at(xx, yy))) ok = false;
        }
      }
      if (!ok) continue;
      const d = Math.hypot(x + gw / 2 - 80, y + gh / 2 - 84);
      if (!garden || d < garden.d) garden = { x, y, d, gw, gh };
    }
  }
  if (!garden) problems.push('nenašlo se místo pro bylinkovou zahradu');
  else {
    for (let yy = garden.y; yy < garden.y + garden.gh; yy++) for (let xx = garden.x; xx < garden.x + garden.gw; xx++) set(xx, yy, '.');
    GARDEN_SITES.forEach((site, i) => {
      herbSpots.push({ site, x: garden.x + 1 + (i % GARDEN.cols) * GARDEN.step, y: garden.y + 1 + Math.floor(i / GARDEN.cols) * GARDEN.step });
    });
  }
}
const inGarden = (x, y) => garden && x >= garden.x - 1 && x <= garden.x + garden.gw && y >= garden.y - 1 && y <= garden.y + garden.gh;
const nearHerbSpot = (x, y) => herbSpots.some((s) => Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1);

// ------------------------------------------------------------ 6. naleziště

const miningSpots = [];
const deposits = map.miningSpots.map((s) => s.deposit);
if (quarry) {
  // Tři řady po 14 nalezištích (řazeno podle regionu), mezi 1. a 2. řadou skrytá žíla a meteorit.
  const rows = [[quarry.y, QUARRY.w], [quarry.y + 2, QUARRY.w], [quarry.y + 3, QUARRY.w]];
  let i = 0;
  for (const [y, count] of rows) {
    for (let k = 0; k < count && i < deposits.length; k++, i++) miningSpots.push({ deposit: deposits[i], x: quarry.x + k, y });
  }
  if (i < deposits.length) problems.push(`lom: nevešlo se ${deposits.length - i} nalezišť`);
}
const hiddenVeinSpot = quarry ? { x: quarry.x + 2, y: quarry.y + 1 } : map.hiddenVeinSpot;
const meteorSpot = quarry ? { x: quarry.x + 6, y: quarry.y + 1 } : map.meteorSpot;

// ------------------------------------------------------------ 7. doplňky

// Staré doplňky v oblasti pryč, ploty všude (patřily ke starým parcelám).
const decor = map.decor.filter(([type, x, y]) => type !== 'fence' && !inArea(Math.floor(x), Math.floor(y)) && !(quarry && x >= quarry.x - 1 && x <= quarry.x + QUARRY.w + 1 && y >= quarry.y - 1 && y <= quarry.y + QUARRY.h + 1));
const r2 = (v) => Math.round(v * 100) / 100;
const addDecor = (type, x, y, extra) => decor.push([type, r2(x), r2(y), extra]);
const plotOf = (b, x, y) => x >= b.x - 1 && x <= b.x + b.width && y >= b.y - 1 && y <= b.y + b.height;
for (const b of BUILDINGS) {
  if (!b.yard) continue;
  for (let y = b.y - 1; y <= b.y + b.height; y++) {
    for (let x = b.x - 1; x <= b.x + b.width; x++) {
      if (at(x, y) !== '_' || inFootprint(x, y)) continue;
      const edges = [[1, 0, x + 1, y + 0.5, 'y'], [-1, 0, x, y + 0.5, 'y'], [0, 1, x + 0.5, y + 1, 'x'], [0, -1, x + 0.5, y, 'x']];
      for (const [dx, dy, ex, ey, axis] of edges) {
        const n = at(x + dx, y + dy);
        if (n === '_' && plotOf(b, x + dx, y + dy)) continue;
        if (!'.,TSR'.includes(n)) continue;
        if (hash2(Math.round(ex * 2), Math.round(ey * 2), 51) < 0.08) continue;
        addDecor('fence', ex, ey, axis);
      }
    }
  }
}
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!inArea(x, y) || inQuarry(x, y)) continue;
    const here = at(x, y);
    const jx = x + 0.25 + hash2(x, y, 61) * 0.5;
    const jy = y + 0.25 + hash2(x, y, 62) * 0.5;
    const roll = hash2(x, y, 63);
    const pick = (n) => Math.floor(hash2(x, y, 64) * n);
    if (inField(x, y) || inGarden(x, y) || nearHerbSpot(x, y)) continue;
    if (here === '_' && !inFootprint(x, y)) {
      if (roll < 0.12) addDecor('bush', jx, jy, pick(6));
    } else if (here === '.') {
      if (nearChar(x, y, 1, '~') && roll < 0.2) addDecor('plant', jx, jy, 0); // rákos u řeky
      else if (nearChar(x, y, 1, '#') && roll < 0.22) addDecor('bush', jx, jy, pick(6));
      else if (nearChar(x, y, 1, 'TS') && roll < 0.08) addDecor(roll < 0.03 ? 'stump' : 'plant', jx, jy, roll < 0.03 ? pick(2) : 1 + pick(2));
      else if (roll < 0.025) addDecor('bush', jx, jy, pick(6));
    }
  }
}
// Ploty kolem polí statku (vrátka uprostřed severní strany, u pole s gate: 'south' na jižní).
for (const fl of FIELDS) {
  for (let x = fl.x; x < fl.x + fl.w; x++) {
    const gateX = fl.x + Math.floor(fl.w / 2);
    if (x !== gateX || fl.gate === 'south') addDecor('fence', x + 0.5, fl.y, 'x');
    if (x !== gateX || fl.gate !== 'south') addDecor('fence', x + 0.5, fl.y + fl.h, 'x');
  }
  for (let y = fl.y; y < fl.y + fl.h; y++) { addDecor('fence', fl.x, y + 0.5, 'y'); addDecor('fence', fl.x + fl.w, y + 0.5, 'y'); }
}
// Rozcestník na kraji náměstí u cesty k mostu.
addDecor('plant', 87.8, 56.6, 2); // rákos přesunutý v editoru
addDecor('signpost', 64.5, 63.5, 0);
addDecor('signpost', 54.5, 59.5, 0);
addDecor('signpost', 67.5, 54.5, 0);

// ------------------------------------------------------------ 8. optimalizace

// Méně objektů v celém regionu (výkon): ubere se asi třetina stromů, smrků a skal a 60 %
// keřů, rostlin a pařezů; hra zbylé kreslí větší (WorldScene: DECOR_SCALE, OBJECT_SCALE).
// Volné pole dostane trávu nebo louku podle sousedů.
const THIN_TREES = 0.35;
const THIN_DECOR = 0.6;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!'TSR'.includes(at(x, y)) || hash2(x, y, 91) >= THIN_TREES || nearHerbSpot(x, y)) continue;
    const meadow = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => at(x + dx, y + dy) === ',').length;
    set(x, y, meadow >= 2 ? ',' : '.');
  }
}
{
  const kept = decor.filter(([type, x, y]) => !['bush', 'plant', 'stump'].includes(type) || hash2(Math.round(x * 10), Math.round(y * 10), 92) >= THIN_DECOR);
  decor.length = 0;
  decor.push(...kept);
}

// ------------------------------------------------------------ výstup

if (problems.length) {
  console.error('Problémy:\n  ' + problems.join('\n  '));
  process.exitCode = 1;
}

const json = (v) => JSON.stringify(v).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ').replace(/'/g, "\\'").replace(/"/g, "'");
const groundText = grid.map((row) => `    '${row.join('')}'`).join(',\n');
const buildingsText = BUILDINGS.map(({ yard, noPath, ...b }) => `    ${json(b)}`).join(',\n');
const decorText = decor.map((d) => JSON.stringify(d).replace(/"/g, "'").replace(/,/g, ',')).reduce((lines, d) => {
  const last = lines[lines.length - 1];
  if (last && last.length + d.length < 140) lines[lines.length - 1] = `${last}, ${d}`;
  else lines.push(d);
  return lines;
}, []).map((l) => `    ${l}`).join(',\n');
const fishingText = fishingSpots.map((s) => `    ${json(s)}`).join(',\n');
const miningText = miningSpots.map((s) => `    ${json(s)}`).join(',\n');
const herbText = herbSpots.map((s) => `    ${json(s)}`).join(',\n');

let out = source.replace(/\r\n/g, '\n');
const replaceBlock = (startMarker, endMarker, body) => {
  const a = out.indexOf(startMarker);
  const b = out.indexOf(endMarker, a + startMarker.length);
  if (a < 0 || b < 0) throw new Error(`Nenalezen blok ${startMarker}`);
  out = out.slice(0, a + startMarker.length) + body + out.slice(b);
};
replaceBlock('  ground: [\n', '\n  ],\n\n  // Hráč', groundText);
replaceBlock('  buildings: [\n', '\n  ],\n\n  // Doplňky', buildingsText);
replaceBlock('  decor: [\n', '\n  ],\n\n  // Rybářská', decorText);
replaceBlock('  fishingSpots: [\n', '\n  ],\n\n  // Naleziště', fishingText);
replaceBlock('  miningSpots: [\n', '\n  ],\n  hiddenVeinSpot', miningText);
// Naleziště Sběru bylin (src/data/herbalism.js) – blok za nalezišti Těžby.
if (out.includes('  herbSpots: [\n')) replaceBlock('  herbSpots: [\n', '\n  ],\n', herbText);
else out = out.replace('  hiddenVeinSpot:', `  // Naleziště Sběru bylin (src/data/herbalism.js). Kvůli testování jsou tu dočasně všechna\n  // naleziště Aurie – Greenvale podle biomu, záhony na polích statku, ostatní v bylinkové zahradě.\n  herbSpots: [\n${herbText}\n  ],\n  hiddenVeinSpot:`);
out = out
  .replace(/spawn: \{ x: \d+, y: \d+ \}/, 'spawn: { x: 62, y: 61 }')
  .replace(/hiddenVeinSpot: \{ x: \d+, y: \d+ \}/, `hiddenVeinSpot: { x: ${hiddenVeinSpot.x}, y: ${hiddenVeinSpot.y} }`)
  .replace(/meteorSpot: \{ x: \d+, y: \d+ \}/, `meteorSpot: { x: ${meteorSpot.x}, y: ${meteorSpot.y} }`)
  .replace(/\{ id: 'fishing_dock', name: 'Rybářské místo \(molo\)', x: \d+, y: \d+ \}/, `{ id: 'fishing_dock', name: 'Rybářské místo (molo)', x: ${fishingSpots[0]?.x ?? 0}, y: ${fishingSpots[0]?.y ?? 0} }`);
if (process.argv.includes('--dry')) {
  console.log('Suchý běh – mapa nezapsána.');
} else {
  fs.writeFileSync(MAP_FILE, source.includes('\r\n') ? out.replace(/\n/g, '\r\n') : out);
  console.log(`Zapsáno ${MAP_FILE}. Lom ${quarry?.x},${quarry?.y}; rybářských míst ${fishingSpots.length}.`);
}

// ------------------------------------------------------------ izometrický náhled

{
  const TW = 8, TH = 4; // pole = kosočtverec 8 × 4 px
  const colors = { '.': [106, 154, 80], ',': [78, 127, 60], ':': [196, 163, 112], '#': [178, 168, 150], '_': [168, 133, 96], '=': [150, 110, 70], '~': [58, 111, 154], '^': [118, 105, 92], T: [40, 100, 40], S: [25, 70, 40], R: [140, 140, 140], D: [154, 118, 80], C: [20, 20, 20], F: [200, 230, 250] };
  const x0 = 38, x1 = 98, y0 = 28, y1 = 98;
  const iw = (x1 - x0 + y1 - y0 + 2) * TW / 2;
  const ih = (x1 - x0 + y1 - y0 + 2) * TH / 2 + 40;
  const img = Array.from({ length: ih }, () => new Array(iw).fill([20, 30, 40]));
  const sx = (x, y) => (x - x0 - (y - y0) + (y1 - y0)) * TW / 2;
  const sy = (x, y) => (x - x0 + y - y0) * TH / 2 + 30;
  const diamond = (x, y, c, lift = 0) => {
    const cx = sx(x, y) + TW / 2, cy = sy(x, y) + TH / 2 - lift;
    for (let dy = -TH / 2; dy < TH / 2; dy++) {
      const half = (TW / 2) * (1 - Math.abs(dy + 0.5) / (TH / 2));
      for (let dx = -half; dx < half; dx++) {
        const px = Math.round(cx + dx), py = Math.round(cy + dy);
        if (img[py] && px >= 0 && px < iw) img[py][px] = c;
      }
    }
  };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) diamond(x, y, colors[at(x, y)] ?? [255, 0, 255]);
  for (const s of miningSpots) diamond(s.x, s.y, [230, 140, 40]);
  for (const s of fishingSpots) diamond(s.x, s.y, [80, 220, 230]);
  // Budovy: zvednuté kvádry (výška podle velikosti), ve hře jsou obrázky.
  const sorted = [...BUILDINGS].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  for (const b of sorted) {
    const tall = Math.min(b.width, b.height) * 3;
    const col = b.door ? [205, 70, 60] : [150, 80, 170];
    for (let lift = 0; lift <= tall; lift += 1) {
      const shade = lift === tall ? col.map((v) => Math.min(255, v + 40)) : col.map((v) => v * 0.7);
      for (let y = b.y; y < b.y + b.height; y++) for (let x = b.x; x < b.x + b.width; x++) diamond(x, y, shade, lift);
    }
    if (b.door) diamond(b.door.x, b.door.y, [255, 230, 0]);
  }
  for (const [type, x, y] of decor) if (type === 'fence') diamond(Math.floor(x), Math.floor(y), [120, 85, 50]);
  const row = Math.ceil(iw * 3 / 4) * 4;
  const buf = Buffer.alloc(54 + row * ih);
  buf.write('BM'); buf.writeUInt32LE(buf.length, 2); buf.writeUInt32LE(54, 10); buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(iw, 18); buf.writeInt32LE(ih, 22); buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28); buf.writeUInt32LE(row * ih, 34);
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) { const [r, g, b2] = img[ih - 1 - y][x]; const o = 54 + y * row + x * 3; buf[o] = b2; buf[o + 1] = g; buf[o + 2] = r; }
  fs.writeFileSync(PREVIEW_FILE, buf);
}
