// Greenvale – „divočina“ kolem vesnice (karta Rozložení oblasti):
//   * nové louky setkání (Lesní paseka, Skalní stráň, Útes) a lesní pás mezi Severní pastvinou
//     a Loukou za Loveckou chatou s průchodem,
//   * odbočky cest k loukám,
//   * hustý les mimo cesty, louky, budovy a naleziště (tráva → stromy), skryté mýtiny
//     s úzkou neoznačenou stezkou pro náhodná vzácná naleziště.
// Pracuje přímo nad řádky `ground` v src/data/maps/greenvale.js (jednorázově; záloha
// původního souboru je v gitu). Spuštění: node tools/greenvale-wilds.mjs
import fs from 'node:fs';

const FILE = new URL('../src/data/maps/greenvale.js', import.meta.url);
let src = fs.readFileSync(FILE, 'utf8');
const start = src.indexOf('ground: [');
const end = src.indexOf('],', start);
const block = src.slice(start, end);
const rowRe = /'([^']*)'/g;
const rows = [];
for (const m of block.matchAll(rowRe)) rows.push(m[1].split(''));
const H = rows.length;
const W = rows[0].length;
const at = (x, y) => (rows[y]?.[x] ?? '~');
const set = (x, y, c) => { if (rows[y] && x >= 0 && x < W) rows[y][x] = c; };
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

// Budovy a naleziště z mapy (jen čtení).
const buildings = [...src.matchAll(/\{id: '[^']+', name: '[^']+', x: (\d+), y: (\d+), width: (\d+), height: (\d+)(?:, door: \{x: (\d+), y: (\d+)\})?/g)]
  .map((m) => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4], door: m[5] ? { x: +m[5], y: +m[6] } : null }));
const spots = [...src.matchAll(/\{(?:site|location|deposit): '[^']+', x: (\d+), y: (\d+)\}/g)].map((m) => ({ x: +m[1], y: +m[2] }));
for (const key of ['hiddenVeinSpot', 'meteorSpot']) {
  const m = src.match(new RegExp(`${key}: \\{ x: (\\d+), y: (\\d+) \\}`));
  if (m) spots.push({ x: +m[1], y: +m[2] });
}

const fillRect = (x0, y0, x1, y1, from, to) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (from.includes(at(x, y))) set(x, y, to);
};
const line = (points, c, over = '.TS,R') => {
  for (let i = 1; i < points.length; i++) {
    let [x, y] = points[i - 1];
    const [tx, ty] = points[i];
    while (x !== tx || y !== ty) {
      if (over.includes(at(x, y))) set(x, y, c);
      if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y);
    }
    if (over.includes(at(tx, ty))) set(tx, ty, c);
  }
};

// ---------------------------------------------------------------- louky
fillRect(37, 79, 50, 89, '.T', ',');   // Lesní paseka (jih)
fillRect(79, 33, 86, 48, '.T', ',');   // Skalní stráň (severovýchod)
fillRect(88, 91, 93, 97, '.', ',');    // Útes ztracených (jihovýchodní poloostrov)

// ---------------------------------------------------------------- cesty k loukám
line([[75, 44], [79, 44]], ':');                   // náměstí → Skalní stráň
line([[51, 86], [52, 86]], ':');                   // jižní cesta → Lesní paseka
line([[29, 57], [29, 49]], ':', '.TS,R');          // Louka za chatou → Severní pastvina
line([[26, 63], [26, 66]], ':', '.TS,R');          // západní cesta → Jižní pláně

// Lesní pás mezi Severní pastvinou a Loukou za Loveckou chatou (průchod po cestě x 29).
for (let x = 14; x <= 41; x++) if (',.'.includes(at(x, 51)) && x !== 29) set(x, 51, hash(x, 51) < 0.5 ? 'T' : 'S');
// Pás mezi západní cestou a Jižními pláněmi (průchod po cestě x 26).
for (let x = 8; x <= 33; x++) if (',.'.includes(at(x, 66)) && x !== 26) set(x, 66, hash(x, 66) < 0.5 ? 'S' : 'T');

// ---------------------------------------------------------------- skryté mýtiny (vzácná naleziště)
// [střed x, y, stezka k bodu na cestě / louce]
const CLEARINGS = [
  [35, 38, [[35, 38], [35, 42]]],          // sever – les nad Severní pastvinou
  [31, 79, [[31, 79], [31, 73]]],          // jihozápad – les pod Jižními pláněmi
  [64, 93, [[64, 93], [64, 88]]],          // jih – pod Bylinkovou loukou (jižní branka)
  [87, 45, [[87, 45], [86, 45]]],          // severovýchod – u útesu za Skalní strání
  [46, 92, [[46, 92], [46, 89]]]           // jih – u pobřeží za pasekou (rybaření)
];
const clearingCells = new Set();
for (const [cx, cy, trail] of CLEARINGS) {
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
    if ('.TS'.includes(at(x, y))) set(x, y, '.');
    clearingCells.add(`${x},${y}`);
  }
  // Stezka: obyčejná tráva (neoznačená), aby byla na objevení.
  let [x, y] = trail[0];
  for (const [tx, ty] of trail.slice(1)) {
    while (x !== tx || y !== ty) {
      if ('TS'.includes(at(x, y))) set(x, y, '.');
      clearingCells.add(`${x},${y}`);
      if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y);
    }
    if ('TS'.includes(at(x, y))) set(x, y, '.');
    clearingCells.add(`${x},${y}`);
  }
}

// ---------------------------------------------------------------- hustý les
const WILDS = [
  [6, 34, 43, 82],    // západ
  [28, 76, 56, 98],   // jih
  [56, 88, 86, 98],   // jih pod statkem
  [76, 30, 89, 52],   // severovýchod
  [84, 86, 98, 100]   // jihovýchodní poloostrov
];
const KEEP_NEAR = ':#=D_CG';            // cesty, náměstí, mosty, molo, záhony, jeskyně, brány
const keep = new Set(clearingCells);
const mark = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) keep.add(`${x + dx},${y + dy}`); };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (KEEP_NEAR.includes(at(x, y))) mark(x, y, 1);
for (const b of buildings) {
  for (let y = b.y - 2; y <= b.y + b.h + 1; y++) for (let x = b.x - 2; x <= b.x + b.w + 1; x++) keep.add(`${x},${y}`);
  if (b.door) mark(b.door.x, b.door.y, 2);
}
for (const s of spots) mark(s.x, s.y, 1);
// Bylinková louka u statku (ohrada) a okolí brány na jih.
for (let y = 81; y <= 89; y++) for (let x = 56; x <= 70; x++) keep.add(`${x},${y}`);

let trees = 0;
for (const [x0, y0, x1, y1] of WILDS) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (at(x, y) !== '.' || keep.has(`${x},${y}`)) continue;
    set(x, y, hash(x, y) < 0.55 ? 'T' : 'S');
    trees++;
  }
}

// ---------------------------------------------------------------- zápis
let i = 0;
const newBlock = block.replace(rowRe, () => `'${rows[i++].join('')}'`);
src = src.slice(0, start) + newBlock + src.slice(end);
fs.writeFileSync(FILE, src);
console.log(`hotovo: ${trees} nových stromů, ${CLEARINGS.length} mýtin`);
