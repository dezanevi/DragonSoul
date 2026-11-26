// Greenvale – nové rozložení oblasti z editoru (map-editor.html, karta „2D náhled oblasti“).
// Vezme úpravy hráče/autora (tools/greenvale-region-edits.json: louky a cesty jsou závazné)
// a doladí detaily, které se v editoru špatně kreslí:
//   1) osamocená pole (missclick) → podle sousedů,
//   2) útesy po nově nakreslených pobřežích a po okraji mapy (kromě jezírka u x 36, y 111),
//   3) les na nově nakreslené trávě mimo cesty, louky, budovy a naleziště,
//   4) průchody lesem ke všem loukám a nalezištím (neoznačená travnatá stezka),
//   5) naleziště: rybaření u jezírka (Lesní řeka, úr. 10), lom 8–18, divoké byliny náhodně,
//      vzácné mýtiny přesunuté do lesa, zóny setkání pro všechny louky.
// Přepisuje src/data/maps/greenvale.js (záloha v gitu). Spuštění: node tools/greenvale-region.mjs
import fs from 'node:fs';

const FILE = new URL('../src/data/maps/greenvale.js', import.meta.url);
const EDITS = JSON.parse(fs.readFileSync(new URL('./greenvale-region-edits.json', import.meta.url), 'utf8')).edits;
let src = fs.readFileSync(FILE, 'utf8');

// ------------------------------------------------------------------ načtení mapy
const start = src.indexOf('ground: [');
const end = src.indexOf('],', start);
const block = src.slice(start, end);
const rowRe = /'([^']*)'/g;
const orig = [...block.matchAll(rowRe)].map((m) => m[1].split(''));
const H = orig.length;
const W = orig[0].length;
const rows = orig.map((r) => r.slice());
for (const [key, c] of Object.entries(EDITS)) {
  const [x, y] = key.split(',').map(Number);
  if (rows[y]?.[x] !== undefined) rows[y][x] = c;
}
const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? '~' : rows[y][x]);
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) rows[y][x] = c; };
const edited = (x, y) => EDITS[`${x},${y}`] !== undefined;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
let seed = 20261126;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const WATER = '~';
const SOLID = '~^TSRF';
const walkable = (c) => !SOLID.includes(c);

// Budovy a pevné body z mapy.
const buildings = [...src.matchAll(/\{id: '([^']+)', name: '[^']+', x: (\d+), y: (\d+), width: (\d+), height: (\d+)(?:, collisionAspect: \[[^\]]+\])?(?:, door: \{x: (\d+), y: (\d+)\})?/g)]
  .map((m) => ({ id: m[1], x: +m[2], y: +m[3], w: +m[4], h: +m[5], door: m[6] ? { x: +m[6], y: +m[7] } : null }));
const inBuilding = (x, y) => buildings.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);

// Jezírko u x 36, y 111: bez útesů a stromů, nové rybářské místo.
const POND = { x: 36, y: 111 };
const pondCells = new Set();
{
  const stack = [[POND.x, POND.y]];
  while (stack.length) {
    const [x, y] = stack.pop();
    const k = `${x},${y}`;
    if (pondCells.has(k) || at(x, y) !== WATER || x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1) continue;
    pondCells.add(k);
    for (const [dx, dy] of N4) stack.push([x + dx, y + dy]);
  }
}
const nearPond = (x, y, r) => [...pondCells].some((k) => { const [px, py] = k.split(',').map(Number); return Math.abs(px - x) <= r && Math.abs(py - y) <= r; });
console.log('jezírko polí:', pondCells.size);

// ------------------------------------------------------------------ 1) missclicky
let fixed = 0;
for (let pass = 0; pass < 2; pass++) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!edited(x, y)) continue;
    const c = at(x, y);
    if (!'.,:#~^g'.includes(c)) continue;
    const around = N8.map(([dx, dy]) => at(x + dx, y + dy));
    if (around.includes(c)) continue;
    const counts = {};
    for (const a of around) counts[a] = (counts[a] ?? 0) + 1;
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    set(x, y, best);
    fixed++;
  }
}
console.log('missclicky opraveno:', fixed);

// ------------------------------------------------------------------ 2) útesy
// Nová hranice země / voda (změněné pole země nebo vody) → pole země se změní na útes.
// Cesty, dlažba, mosty, molo a parcely zůstávají (přístup k vodě).
let cliffs = 0;
const coastLand = '.,TSRg';
const toCliff = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const c = at(x, y);
  if (!coastLand.includes(c) || nearPond(x, y, 1)) continue;
  const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
  const coast = N8.some(([dx, dy]) => at(x + dx, y + dy) === WATER && (edited(x, y) || edited(x + dx, y + dy)));
  if (border || coast) toCliff.push([x, y]);
}
for (const [x, y] of toCliff) { set(x, y, '^'); cliffs++; }
console.log('útesy přidány:', cliffs);

// ------------------------------------------------------------------ 5a) naleziště (pozice, které musí zůstat volné)
const blockMatch = (key) => {
  const i = src.indexOf(`${key}: [`);
  return { i, j: src.indexOf('\n  ],', i) };
};
const listOf = (key, re) => { const { i, j } = blockMatch(key); return [...src.slice(i, j).matchAll(re)]; };
const mining = listOf('miningSpots', /\{deposit: '(\w+)', x: (\d+), y: (\d+)\}/g).map((m) => ({ deposit: m[1], x: +m[2], y: +m[3] }));
const herbs = listOf('herbSpots', /\{site: '(\w+)', x: (\d+), y: (\d+)\}/g).map((m) => ({ site: m[1], x: +m[2], y: +m[3] }));
const fishing = listOf('fishingSpots', /\{location: '(\w+)', x: (\d+), y: (\d+)\}/g).map((m) => ({ location: m[1], x: +m[2], y: +m[3] }));
const rare = listOf('rareSpots', /\{ kind: '(\w+)', (\w+): '(\w+)', x: (\d+), y: (\d+) \}/g).map((m) => ({ kind: m[1], key: m[2], id: m[3], x: +m[4], y: +m[5] }));
const fixedPoint = (key) => { const m = src.match(new RegExp(`${key}: \\{ x: (\\d+), y: (\\d+) \\}`)); return m ? { x: +m[1], y: +m[2] } : null; };
const hidden = fixedPoint('hiddenVeinSpot');
const meteor = fixedPoint('meteorSpot');

// Lom: 12 nalezišť úr. 8–18 (nejvíc Krystalových puklin).
const QUARRY_MIX = ['N27', 'N03', 'N27', 'N16', 'N27', 'N03', 'N27', 'N16', 'N27', 'N03', 'N16', 'N27'];
mining.forEach((m, i) => { m.deposit = QUARRY_MIX[i % QUARRY_MIX.length]; });

// Rybaření u jezírka: pole země u vody jezírka (Lesní řeka, úr. 10).
let pondSpot = null;
{
  let best = Infinity;
  for (const k of pondCells) {
    const [px, py] = k.split(',').map(Number);
    for (const [dx, dy] of N4) {
      const x = px + dx, y = py + dy;
      if (!walkable(at(x, y)) || at(x, y) === WATER) continue;
      const d = Math.abs(x - POND.x) + Math.abs(y - POND.y) + (at(x, y) === ',' ? 3 : 0);
      if (d < best) { best = d; pondSpot = { location: 'verdant_river', x, y }; }
    }
  }
}
if (pondSpot) fishing.push(pondSpot);
console.log('rybářské místo u jezírka:', pondSpot);

// ------------------------------------------------------------------ 3) les
const keep = new Set();
const mark = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) keep.add(`${x + dx},${y + dy}`); };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (':#=D_CGg'.includes(at(x, y))) mark(x, y, 1);
for (const b of buildings) {
  for (let y = b.y - 2; y <= b.y + b.h + 1; y++) for (let x = b.x - 2; x <= b.x + b.w + 1; x++) keep.add(`${x},${y}`);
  if (b.door) mark(b.door.x, b.door.y, 2);
}
const pinned = [...mining, ...fishing, ...herbs.filter((h) => !/^H\d/.test(h.site)), hidden, meteor].filter(Boolean);
for (const s of pinned) mark(s.x, s.y, 1);
let trees = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (at(x, y) !== '.' || !edited(x, y) || keep.has(`${x},${y}`) || nearPond(x, y, 3)) continue;
  const r = hash(x, y);
  set(x, y, r < 0.5 ? 'T' : r < 0.96 ? 'S' : 'R');
  trees++;
}
console.log('stromů přidáno:', trees);

// ------------------------------------------------------------------ 5b) vzácné mýtiny a divoké byliny
// Pole hluboko v lese: kolem samé stromy (r 2).
const deepForest = (x, y) => {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!'TS'.includes(at(x + dx, y + dy))) return false;
  return true;
};
const farFrom = (list, x, y, d) => list.every((s) => Math.abs(s.x - x) + Math.abs(s.y - y) >= d);
const placed = [...pinned];
for (const r of rare) {
  const c = at(r.x, r.y);
  const ok = walkable(c) && c !== WATER && !(r.kind === 'herb' && !'.,'.includes(c));
  if (ok && r.kind !== 'herb') { placed.push(r); continue; }
  // Přesun do nové mýtiny v lese.
  let pos = null;
  for (let tries = 0; tries < 20000 && !pos; tries++) {
    const x = 3 + Math.floor(rnd() * (W - 6));
    const y = 3 + Math.floor(rnd() * (H - 6));
    if (deepForest(x, y) && farFrom(placed, x, y, 14)) pos = { x, y };
  }
  if (!pos) { console.warn('mýtina se nenašla pro', r); continue; }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(pos.x + dx, pos.y + dy, '.');
  console.log('vzácná mýtina', r.id, `${r.x},${r.y} → ${pos.x},${pos.y}`);
  r.x = pos.x; r.y = pos.y;
  placed.push(r);
}

// Divoké byliny H01–H07: zcela náhodně po trávě a loukách oblasti (mimo vesnici, daleko od sebe).
const nearBuilding = (x, y, r) => buildings.some((b) => x >= b.x - r && x < b.x + b.w + r && y >= b.y - r && y < b.y + b.h + r);
for (const h of herbs.filter((s) => /^H\d/.test(s.site))) {
  let pos = null;
  for (let tries = 0; tries < 50000 && !pos; tries++) {
    const x = 1 + Math.floor(rnd() * (W - 2));
    const y = 1 + Math.floor(rnd() * (H - 2));
    if (!'.,'.includes(at(x, y)) || nearBuilding(x, y, 3) || !farFrom(placed, x, y, 10)) continue;
    pos = { x, y };
  }
  if (!pos) { console.warn('bylina bez místa', h.site); continue; }
  console.log('bylina', h.site, `${h.x},${h.y} → ${pos.x},${pos.y}`, at(pos.x, pos.y));
  h.x = pos.x; h.y = pos.y;
  placed.push(h);
}

// ------------------------------------------------------------------ 4) průchody lesem
// Ze spawnu se musí dát dojít ke každé louce, nalezišti a dveřím. Chybějící spojení se prokope
// nejkratší cestou přes stromy (stromy → tráva; přes vodu a útesy ne).
const spawnM = src.match(/spawn: \{ x: (\d+), y: (\d+) \}/);
const spawn = { x: +spawnM[1], y: +spawnM[2] };
const reach = () => {
  const seen = new Uint8Array(W * H);
  const q = [[spawn.x, spawn.y]];
  seen[spawn.y * W + spawn.x] = 1;
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !walkable(at(nx, ny)) || inBuilding(nx, ny)) continue;
      seen[ny * W + nx] = 1;
      q.push([nx, ny]);
    }
  }
  return seen;
};
const carve = (target, seen) => {
  // BFS od cíle přes choditelná pole a stromy k dosažitelné oblasti; stromy na trase → tráva.
  const prev = new Int32Array(W * H).fill(-1);
  const cost = new Uint8Array(W * H);
  const start = target.y * W + target.x;
  prev[start] = start;
  const q = [start];
  let hit = -1;
  while (q.length && hit < 0) {
    const p = q.shift();
    const x = p % W, y = (p - x) / W;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
      const n = ny * W + nx;
      if (prev[n] >= 0 || inBuilding(nx, ny)) continue;
      const c = at(nx, ny);
      if (!walkable(c) && !'TSR'.includes(c)) continue;
      prev[n] = p;
      if (seen[n]) { hit = n; break; }
      q.push(n);
    }
  }
  if (hit < 0) return false;
  let p = hit;
  while (p !== start) { const x = p % W, y = (p - x) / W; if ('TSR'.includes(at(x, y))) set(x, y, '.'); p = prev[p]; }
  if ('TSR'.includes(at(target.x, target.y))) set(target.x, target.y, '.');
  return true;
};
const targets = [];
{
  const seenM = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (at(x, y) !== ',' || seenM.has(`${x},${y}`)) continue;
    const stack = [[x, y]];
    seenM.add(`${x},${y}`);
    targets.push({ x, y, what: 'louka' });
    while (stack.length) {
      const [a, b] = stack.pop();
      for (const [dx, dy] of N4) { const k = `${a + dx},${b + dy}`; if (at(a + dx, b + dy) === ',' && !seenM.has(k)) { seenM.add(k); stack.push([a + dx, b + dy]); } }
    }
  }
}
for (const s of placed) targets.push({ x: s.x, y: s.y, what: 'naleziště' });
for (const b of buildings) if (b.door) targets.push({ ...b.door, what: `dveře ${b.id}` });
// Naleziště uvnitř půdorysu budovy (zahrádka u zdi) se sbírá ze sousedního pole – nekontroluje se.
for (let i = targets.length - 1; i >= 0; i--) if (inBuilding(targets[i].x, targets[i].y)) targets.splice(i, 1);
let carved = 0;
for (const t of targets) {
  const seen = reach();
  if (seen[t.y * W + t.x]) continue;
  if (carve(t, seen)) carved++;
  else console.warn('nedosažitelné:', t);
}
console.log('prokopané průchody:', carved);
{
  const seen = reach();
  const bad = targets.filter((t) => !seen[t.y * W + t.x]);
  console.log('nedosažitelné po úpravě:', bad.length, bad.slice(0, 5));
}

// ------------------------------------------------------------------ 5c) zóny setkání
const OLD_ZONES = [...src.slice(blockMatch('encounterZones').i, blockMatch('encounterZones').j).matchAll(/\{ id: '(\w+)', name: '([^']+)', x0: (\d+), y0: (\d+), x1: (\d+), y1: (\d+), level: \[(\d+), (\d+)\], species: \[([^\]]*)\](, rare: true)? \}/g)]
  .map((m) => ({ id: m[1], name: m[2], x0: +m[3], y0: +m[4], x1: +m[5], y1: +m[6], level: [+m[7], +m[8]], species: m[9], rare: !!m[10] }));
const clusters = [];
{
  const seenM = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (at(x, y) !== ',' || seenM.has(`${x},${y}`)) continue;
    const cells = [];
    const stack = [[x, y]];
    seenM.add(`${x},${y}`);
    while (stack.length) {
      const [a, b] = stack.pop();
      cells.push([a, b]);
      for (const [dx, dy] of N8) { const k = `${a + dx},${b + dy}`; if (at(a + dx, b + dy) === ',' && !seenM.has(k)) { seenM.add(k); stack.push([a + dx, b + dy]); } }
    }
    if (cells.length < 6) continue;
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
    clusters.push({ cells, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys),
      cx: xs.reduce((s, v) => s + v, 0) / cells.length, cy: ys.reduce((s, v) => s + v, 0) / cells.length });
  }
}
const VILLAGE = { x: 62, y: 52 };
const SPECIES_BY_LEVEL = [
  [9, OLD_ZONES.find((z) => z.id === 'forest_glade')?.species],
  [12, OLD_ZONES.find((z) => z.id === 'rocky_slope')?.species],
  [99, OLD_ZONES.find((z) => z.id === 'lost_cliff')?.species]
];
const compass = (c) => {
  const dx = c.cx - VILLAGE.x, dy = c.cy - VILLAGE.y;
  const ns = dy < -12 ? 'Severo' : dy > 12 ? 'Jiho' : '';
  const ew = dx < -12 ? 'západní' : dx > 12 ? 'východní' : '';
  if (ns && ew) return ns + ew;
  if (ns) return ns === 'Severo' ? 'Severní' : 'Jižní';
  return ew ? ew[0].toUpperCase() + ew.slice(1) : 'Střední';
};
// Názvy nových luk podle polohy (nejbližší střed).
const NEW_NAMES = [
  [13, 13, 'meadow_windy_plain', 'Větrná pláň'],
  [32, 14, 'meadow_north_shore', 'Louka u severního pobřeží'],
  [22, 91, 'meadow_heath', 'Vřesovištní louka'],
  [7, 92, 'meadow_west_cliffs', 'Louka nad západními útesy'],
  [97, 109, 'meadow_east_bay', 'Louka u východní zátoky'],
  [107, 110, 'meadow_far_east', 'Odlehlá východní pláň'],
  [43, 111, 'meadow_south_glade', 'Jižní paseka'],
  [13, 116, 'meadow_far_south', 'Jihozápadní výběžek'],
  [37, 117, 'meadow_pond', 'Louka u jezírka']
];
const zones = [];
const usedOld = new Set();
const center = (z) => ({ x: (z.x0 + z.x1) / 2, y: (z.y0 + z.y1) / 2 });
// a) louka zasahuje do obdélníku původní zóny → stejná zóna (monstra, úrovně, název).
for (const c of clusters) {
  const old = OLD_ZONES.find((z) => !usedOld.has(z.id) && c.cells.some(([x, y]) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1));
  if (old) { usedOld.add(old.id); c.zone = { ...old }; }
}
// b) původní zóna bez louky → nejbližší volná louka do 25 polí (louka se jen posunula).
for (const z of OLD_ZONES.filter((q) => !usedOld.has(q.id))) {
  const zc = center(z);
  const best = clusters.filter((c) => !c.zone).map((c) => [Math.hypot(c.cx - zc.x, c.cy - zc.y), c]).sort((a, b) => a[0] - b[0])[0];
  if (best && best[0] <= 25) { usedOld.add(z.id); best[1].zone = { ...z }; }
}
// c) nové louky: úroveň podle vzdálenosti od vesnice.
for (const c of clusters) {
  if (!c.zone) {
    const d = Math.hypot(c.cx - VILLAGE.x, c.cy - VILLAGE.y);
    const lo = Math.max(6, Math.min(14, Math.round(6 + ((d - 40) / 35) * 8)));
    const species = SPECIES_BY_LEVEL.find(([max]) => lo + 2 <= max || max === 99)[1];
    const [, , id, name] = NEW_NAMES.map((n) => [Math.hypot(n[0] - c.cx, n[1] - c.cy), ...n]).sort((a, b) => a[0] - b[0])[0].slice(1);
    c.zone = { id, name, level: [lo, lo + 2], species, rare: false, d: Math.round(d) };
  }
  zones.push({ ...c.zone, x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, cells: c.cells });
}
console.log('zóny bez louky (odebrány):', OLD_ZONES.filter((z) => !usedOld.has(z.id)).map((z) => z.id));
// Kontrola: každé pole louky musí patřit (první shodou) do zóny svého shluku.
let wrong = 0;
for (const z of zones) for (const [x, y] of z.cells) {
  const first = zones.find((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
  if (first !== z) wrong++;
}
console.log('zóny:', zones.map((z) => `${z.id} ${z.level.join('–')} (${z.x0},${z.y0})–(${z.x1},${z.y1})${z.d ? ' d' + z.d : ''}`));
console.log('polí louky ve špatné zóně:', wrong);

// ------------------------------------------------------------------ zápis
const replaceBlock = (key, body) => {
  const { i, j } = blockMatch(key);
  src = src.slice(0, i) + `${key}: [\n` + body + src.slice(j);
};
replaceBlock('miningSpots', mining.map((m) => `    {deposit: '${m.deposit}', x: ${m.x}, y: ${m.y}}`).join(',\n'));
replaceBlock('fishingSpots', fishing.map((f) => `    {location: '${f.location}', x: ${f.x}, y: ${f.y}}`).join(',\n'));
replaceBlock('herbSpots', herbs.map((h) => `    {site: '${h.site}', x: ${h.x}, y: ${h.y}}`).join(',\n'));
replaceBlock('rareSpots', rare.map((r) => `    { kind: '${r.kind}', ${r.key}: '${r.id}', x: ${r.x}, y: ${r.y} }`).join(',\n'));
replaceBlock('encounterZones', zones.map((z) => `    { id: '${z.id}', name: '${z.name}', x0: ${z.x0}, y0: ${z.y0}, x1: ${z.x1}, y1: ${z.y1}, level: [${z.level[0]}, ${z.level[1]}], species: [${z.species}]${z.rare ? ', rare: true' : ''} }`).join(',\n'));

// Dekorace na vodě, útesu nebo ve stromech pryč.
{
  const { i, j } = blockMatch('decor');
  const body = src.slice(i, j);
  let removed = 0;
  const kept = body.replace(/\['(\w+)',([\d.]+),([\d.]+),(\d+)\],? ?/g, (all, kind, x, y) => {
    const c = at(Math.floor(+x), Math.floor(+y));
    if ('~^TSR'.includes(c)) { removed++; return ''; }
    return all;
  });
  src = src.slice(0, i) + kept.replace(/,(\s*)$/, '$1') + src.slice(j);
  console.log('dekorace odebrány:', removed);
}

const start2 = src.indexOf('ground: [');
const end2 = src.indexOf('],', start2);
let r = 0;
src = src.slice(0, start2) + src.slice(start2, end2).replace(rowRe, () => `'${rows[r++].join('')}'`) + src.slice(end2);
fs.writeFileSync(FILE, src);
console.log('hotovo');
