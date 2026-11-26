// Greenvale – lom (karta Těžba): suť (g) jižně pod Bylinkovou loukou, skály (R) po okrajích
// a uvnitř, příchod cestou z jižní cesty a z východní cesty ke statku.
// Mění řádky `ground` v src/data/maps/greenvale.js. Spuštění: node tools/greenvale-quarry.mjs
import fs from 'node:fs';

const FILE = new URL('../src/data/maps/greenvale.js', import.meta.url);
let src = fs.readFileSync(FILE, 'utf8');
const start = src.indexOf('ground: [');
const end = src.indexOf('],', start);
const block = src.slice(start, end);
const rowRe = /'([^']*)'/g;
const rows = [...block.matchAll(rowRe)].map((m) => m[1].split(''));
const at = (x, y) => rows[y]?.[x] ?? '~';
const set = (x, y, c) => { if (rows[y]) rows[y][x] = c; };
const hash = (x, y) => { const s = Math.sin(x * 91.7 + y * 47.3) * 43758.5453; return s - Math.floor(s); };

const Q = { x0: 57, y0: 89, x1: 80, y1: 96 };
// Pole, která musí zůstat volná (naleziště, mýtina s vzácnou žílou, skrytá žíla, meteorit).
export const QUARRY_SPOTS = [
  ['N01', 58, 91], ['N33', 61, 90], ['N37', 66, 90], ['N34', 69, 91], ['N01', 72, 90],
  ['N02', 60, 93], ['N36', 75, 91], ['N33', 68, 93], ['N39', 71, 93], ['N37', 74, 94],
  ['N02', 77, 92], ['N27', 66, 95]
];
const free = new Set();
const keep = (x, y, r = 1) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) free.add(`${x + dx},${y + dy}`); };
for (const [, x, y] of QUARRY_SPOTS) keep(x, y);
keep(64, 93); keep(59, 89); keep(63, 89); keep(64, 88, 0);

// 1) Suť.
for (let y = Q.y0; y <= Q.y1; y++) for (let x = Q.x0; x <= Q.x1; x++) if ('.TS,'.includes(at(x, y))) set(x, y, 'g');
// 2) Skály: pole sutě sousedící s útesem / vodou (okraj lomu) a pár balvanů uvnitř.
for (let y = Q.y0; y <= Q.y1; y++) for (let x = Q.x0; x <= Q.x1; x++) {
  if (at(x, y) !== 'g' || free.has(`${x},${y}`)) continue;
  const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => '^~'.includes(at(x + dx, y + dy)));
  if ((edge && hash(x, y) < 0.55) || (!edge && hash(x, y) < 0.08)) set(x, y, 'R');
}
// 3) Příchody: z jižní cesty (x 54) po řádku 88 a z východní cesty (x 73) dolů.
for (let x = 55; x <= 57; x++) if ('.TS'.includes(at(x, 88))) set(x, 88, ':');
for (let y = 88; y <= 89; y++) set(73, y, ':');
set(73, 88, ':');

let i = 0;
const newBlock = block.replace(rowRe, () => `'${rows[i++].join('')}'`);
src = src.slice(0, start) + newBlock + src.slice(end);
fs.writeFileSync(FILE, src);
console.log('lom hotov');
